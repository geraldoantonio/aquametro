/* ================= camera OCR (meter reading) =================
 * Reads the meter number from a phone-camera photo, fully on-device.
 *
 * Tesseract.js is vendored under src/vendor/tesseract/ and served same-origin —
 * there are NO runtime requests to third parties, keeping the app offline-capable
 * (the Service Worker runtime-caches these assets on first use). The engine is
 * lazy-loaded only when the camera is first opened, so users who never scan pay
 * nothing at page load.
 *
 * Public API: Ocr.open(onResult) — opens the camera overlay and calls
 * onResult(valueString) once the user confirms a reading. The recognized text is
 * always editable and the user confirms before it reaches the form; OCR never
 * writes a reading on its own.
 */
const Ocr = (function () {
  // Absolute base URL so paths resolve inside the Tesseract Web Worker (blob context).
  const BASE = new URL("vendor/tesseract/", document.baseURI).href;
  const LOW_CONF = 75; // per-digit confidence (0–100) below which we flag a digit for review

  let scriptPromise = null; // tesseract.min.js <script> load
  let workerPromise = null; // cached Tesseract worker (kept alive across scans)
  let progressCb = null; // routes the worker logger to the current UI
  let stream = null; // active MediaStream
  let root = null; // overlay root element
  let els = {}; // cached child element refs
  let onResult = null; // caller callback

  /* ---------- engine loading ---------- */
  function loadScript() {
    if (window.Tesseract) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = BASE + "tesseract.min.js";
      // onload can fire even when the response was NOT the script (e.g. the SW served
      // index.html as an offline fallback) — so verify the global actually exists and,
      // if not, reset scriptPromise so "Tentar de novo" re-attempts instead of caching a
      // resolved-but-broken load.
      s.onload = () => {
        if (window.Tesseract) return resolve();
        scriptPromise = null;
        console.error("[OCR] tesseract.min.js loaded but window.Tesseract is undefined — wrong content served for", s.src);
        reject(new Error("tesseract-undefined"));
      };
      s.onerror = () => {
        scriptPromise = null;
        console.error("[OCR] failed to load", s.src);
        reject(new Error("tesseract-load-failed"));
      };
      document.head.appendChild(s);
    });
    return scriptPromise;
  }

  async function getWorker() {
    await loadScript();
    if (workerPromise) return workerPromise;
    workerPromise = (async () => {
      const worker = await Tesseract.createWorker("eng", 1, {
        workerPath: BASE + "worker.min.js",
        langPath: BASE + "lang",
        corePath: BASE.replace(/\/$/, ""),
        logger: (m) => { if (progressCb) progressCb(m); },
      });
      await worker.setParameters({
        tessedit_char_whitelist: "0123456789.,",
        tessedit_pageseg_mode: "7", // treat the crop as a single text line
      });
      return worker;
    })();
    // Don't cache a failed load — allow a later retry to rebuild the worker.
    workerPromise.catch((e) => { console.error("[OCR] worker init failed:", e); workerPromise = null; });
    return workerPromise;
  }

  /* ---------- image capture & preprocessing ---------- */
  // Crop a centered horizontal band from the current frame, matching the on-screen
  // reticle, then upscale it — Tesseract reads larger glyphs more reliably.
  function cropFrame(video) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const cropW = Math.round(vw * 0.80);
    const cropH = Math.round(vh * 0.22);
    const cropX = Math.round((vw - cropW) / 2);
    const cropY = Math.round((vh - cropH) / 2);
    const scale = Math.min(3, Math.max(1, 900 / cropW));
    const c = document.createElement("canvas");
    c.width = Math.round(cropW * scale);
    c.height = Math.round(cropH * scale);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, c.width, c.height);
    return c;
  }

  // Grayscale + min/max contrast stretch. A gentle stretch (not hard binarization)
  // survives colored dials, glare and shadows better than a fixed threshold.
  function preprocess(canvas) {
    const ctx = canvas.getContext("2d");
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const gray = new Uint8ClampedArray(d.length / 4);
    let min = 255, max = 0;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      gray[p] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = Math.max(1, max - min);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      let v = ((gray[p] - min) / range) * 255;
      v = v < 128 ? v * 0.75 : 255 - (255 - v) * 0.75; // widen the mid contrast
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  // Flatten Tesseract's block hierarchy down to symbols, tolerating shape changes.
  function collectSymbols(data) {
    if (Array.isArray(data.symbols) && data.symbols.length) return data.symbols;
    const out = [];
    (data.blocks || []).forEach((b) =>
      (b.paragraphs || []).forEach((p) =>
        (p.lines || []).forEach((l) =>
          (l.words || []).forEach((w) =>
            (w.symbols || []).forEach((s) => out.push(s))))));
    return out;
  }

  // Turn a recognition result into { digits: [{ ch, conf, low }], value, confidence }.
  function parse(data) {
    const syms = collectSymbols(data)
      .filter((s) => /[0-9]/.test((s.text || "").trim()));
    let digits;
    if (syms.length) {
      digits = syms.map((s) => ({
        ch: s.text.trim(),
        conf: Math.round(s.confidence),
        low: s.confidence < LOW_CONF,
      }));
    } else {
      // No per-symbol data: fall back to the raw text with the overall confidence.
      digits = (data.text || "").replace(/[^0-9]/g, "").split("").map((ch) => ({
        ch, conf: Math.round(data.confidence || 0), low: (data.confidence || 0) < LOW_CONF,
      }));
    }
    // Overall confidence comes from the digits themselves (mean of per-symbol scores):
    // Tesseract's block-level data.confidence often reads 0 on odometer-style images
    // even when every digit was recognized well, which would mislead the confirm screen.
    const confidence = digits.length
      ? Math.round(digits.reduce((sum, d) => sum + d.conf, 0) / digits.length)
      : Math.round(data.confidence || 0);
    return {
      digits,
      value: digits.map((d) => d.ch).join(""),
      confidence,
    };
  }

  // Run the shared engine on an already-prepared canvas and return the parsed result.
  // Exposed for the OCR test page so it exercises the exact same recognition + parsing.
  async function recognizeCanvas(canvas) {
    const worker = await getWorker();
    const { data } = await worker.recognize(canvas);
    return parse(data);
  }

  /* ---------- overlay UI ---------- */
  function shell() {
    return (
      '<div class="ocr">' +
        '<video class="ocr-video" data-el="video" playsinline muted autoplay></video>' +
        '<div class="ocr-scrim"></div>' +
        '<div class="ocr-reticle" data-el="reticle">' +
          '<span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>' +
        "</div>" +
        '<button class="ocr-x" data-el="close" aria-label="' + esc(t("ocr.cancel")) + '">' + icon("x", 20) + "</button>" +
        '<div class="ocr-top" data-el="top"><div class="ocr-ttl">' + t("ocr.title") + "</div>" +
          '<div class="ocr-hint">' + t("ocr.hint") + "</div></div>" +
        // live: shutter
        '<div class="ocr-bar" data-el="livebar">' +
          '<button class="ocr-shutter" data-el="shutter" aria-label="' + esc(t("ocr.capture")) + '"><i></i></button>' +
        "</div>" +
        // processing
        '<div class="ocr-proc" data-el="proc" hidden>' +
          '<div class="ocr-spin"></div><div class="ocr-procmsg" data-el="procmsg">' + t("ocr.processing") + "</div>" +
          '<div class="ocr-prog"><span data-el="progbar"></span></div>' +
        "</div>" +
        // confirm
        '<div class="ocr-confirm" data-el="confirm" hidden>' +
          '<div class="ocr-badge">' + icon("check", 13) + " " + t("ocr.badge") + "</div>" +
          '<div class="ocr-readout" data-el="readout"></div>' +
          '<div class="ocr-conf" data-el="conflabel"></div>' +
          '<label class="flabel" style="text-align:left">' + t("ocr.valueLabel") + "</label>" +
          '<div class="valrow">' +
            '<input class="input valmain" data-el="int" inputmode="numeric" maxlength="5" autocomplete="off">' +
            '<span class="valsep">,</span>' +
            '<input class="input valdec" data-el="dec" inputmode="numeric" maxlength="3" placeholder="' + t("form.decPlaceholder") + '" autocomplete="off">' +
          "</div>" +
          '<div class="valhint">' + t("ocr.decHint") + "</div>" +
          '<button class="btn pri" data-el="use">' + icon("check", 17) + " " + t("ocr.use") + "</button>" +
          '<div class="two"><button class="btn ghost" style="margin:0" data-el="retry">' + t("ocr.retry") + "</button>" +
          '<button class="btn ghost" style="margin:0" data-el="manual">' + t("ocr.manual") + "</button></div>" +
        "</div>" +
        // error
        '<div class="ocr-err" data-el="err" hidden>' +
          '<div class="ocr-erric">' + icon("alert", 26) + "</div>" +
          '<div class="ocr-errmsg" data-el="errmsg"></div>' +
          '<button class="btn pri" data-el="errretry">' + t("ocr.retry") + "</button>" +
          '<button class="btn ghost" data-el="errclose">' + t("ocr.manual") + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  function show(name) {
    ["livebar", "proc", "confirm", "err"].forEach((k) => { els[k].hidden = k !== name; });
    els.top.hidden = name !== "livebar";
    els.reticle.style.display = name === "livebar" ? "" : "none";
  }

  function renderConfirm(res) {
    els.readout.innerHTML = res.digits.length
      ? res.digits.map((d) => '<span class="ocr-dig' + (d.low ? " low" : "") + '">' + esc(d.ch) + "</span>").join("")
      : '<span class="ocr-dig low">—</span>';
    const anyLow = res.digits.some((d) => d.low);
    els.conflabel.className = "ocr-conf" + (anyLow ? " warn" : "");
    els.conflabel.innerHTML = anyLow
      ? t("ocr.lowConfidence", { pct: res.confidence })
      : t("ocr.goodConfidence", { pct: res.confidence });
    // OCR reliably reads the black odometer (integer m³); the red liters are left
    // to the user, since they are often analog pointers Tesseract can't read.
    els.int.value = res.value;
    els.dec.value = "";
  }

  /* ---------- flow ---------- */
  async function capture() {
    show("proc");
    els.progbar.style.width = "0%";
    els.procmsg.textContent = window.Tesseract ? t("ocr.processing") : t("ocr.loadingEngine");
    progressCb = (m) => {
      if (typeof m.progress === "number") els.progbar.style.width = Math.round(m.progress * 100) + "%";
      if (m.status && /recogniz/i.test(m.status)) els.procmsg.textContent = t("ocr.processing");
    };
    try {
      const v = els.video;
      // Guard against capturing before the first frame arrives (videoWidth still 0).
      if (!v.videoWidth) {
        await new Promise((res) => {
          const timer = setTimeout(res, 1500);
          v.addEventListener("loadeddata", () => { clearTimeout(timer); res(); }, { once: true });
        });
      }
      if (!v.videoWidth) { progressCb = null; return fail(t("ocr.errCamera")); }
      const res = await recognizeCanvas(preprocess(cropFrame(v)));
      progressCb = null;
      if (!res.digits.length) return fail(t("ocr.errNoDigits"));
      renderConfirm(res);
      show("confirm");
    } catch (e) {
      progressCb = null;
      console.error("[OCR] capture failed:", e);
      fail(window.Tesseract ? t("ocr.errNoDigits") : t("ocr.errEngine"));
    }
  }

  function fail(msg) {
    els.errmsg.textContent = msg;
    show("err");
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }, audio: false,
      });
      const v = els.video;
      // muted/playsinline as PROPERTIES + attributes: mobile browsers block autoplay of a
      // camera stream otherwise and leave the video black.
      v.muted = true; v.defaultMuted = true; v.playsInline = true;
      ["playsinline", "webkit-playsinline", "muted", "autoplay"].forEach((a) => v.setAttribute(a, ""));
      v.srcObject = stream;
      show("livebar");
      // Some mobile browsers won't start a srcObject stream without an explicit play();
      // retry on media events too, since an early play() can be a no-op before metadata.
      const tryPlay = () => { const p = v.play(); if (p && p.catch) p.catch((e) => console.warn("[OCR] play()", e.name)); };
      v.onloadedmetadata = tryPlay;
      v.oncanplay = tryPlay;
      tryPlay();
    } catch (e) {
      console.error("[OCR] getUserMedia failed:", e && e.name, e && e.message);
      fail(t("ocr.errCamera"));
    }
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null; }
  }

  function teardown() {
    stopCamera();
    progressCb = null;
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null; els = {}; onResult = null;
    document.removeEventListener("keydown", onKey);
  }

  function onKey(e) { if (e.key === "Escape") teardown(); }

  function open(cb) {
    if (root) return; // already open
    onResult = cb;
    const host = document.getElementById("camera");
    host.innerHTML = shell();
    root = host.firstChild;
    root.querySelectorAll("[data-el]").forEach((el) => { els[el.dataset.el] = el; });

    els.close.onclick = teardown;
    els.shutter.onclick = capture;
    els.retry.onclick = () => show("livebar");
    els.errretry.onclick = () => (stream ? show("livebar") : startCamera());
    els.manual.onclick = teardown;
    els.errclose.onclick = teardown;
    els.use.onclick = () => {
      const intStr = (els.int.value || "").replace(/\D/g, "");
      const decStr = (els.dec.value || "").replace(/\D/g, "").slice(0, 3);
      const done = onResult;
      teardown();
      if (done && intStr) done(intStr, decStr);
    };

    document.addEventListener("keydown", onKey);
    startCamera();
  }

  // Feature test: exposed so the UI only shows the button when capture is possible.
  const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  return { open, supported, recognizeCanvas, preprocess };
})();
