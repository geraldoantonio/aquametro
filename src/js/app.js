/* ================= state ================= */
const KEY = "controle-agua-v2";
let state = { meters: [], activeMeterId: null };
let ui = { addOpen: false, modal: null, obStep: 1, confirmDel: false };
let deferredPrompt = null;

function newMeter(name) {
  return { id: uid(), name: name, config: { target: 11, cycleDays: 30 }, readings: [], history: [] };
}
function active() {
  return state.meters.find((m) => m.id === state.activeMeterId) || state.meters[0];
}

// Maps a meter from any persisted shape (including legacy Portuguese field names)
// onto the current English schema, so older saved data keeps working.
function normalizeMeter(m) {
  const cfg = m.config || {};
  const pick = (a, b, fallback) => (a != null ? a : b != null ? b : fallback);
  return {
    id: m.id || uid(),
    name: m.name || t("meter.defaultName", { n: 1 }),
    config: {
      target: pick(cfg.target, cfg.ideal, 11),
      cycleDays: pick(cfg.cycleDays, cfg.ciclo, 30),
    },
    readings: (m.readings || []).map((r) => ({
      id: r.id || uid(), date: r.date, value: pick(r.value, r.medidor, 0),
    })),
    history: (m.history || []).map((h) => ({
      id: h.id || uid(), start: h.start, end: h.end,
      usage: pick(h.usage, h.consumo, 0),
      target: pick(h.target, h.ideal, 0),
      days: pick(h.days, h.dias, 0),
    })),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d.meters) && d.meters.length) {
        state.meters = d.meters.map(normalizeMeter);
        state.activeMeterId = d.activeMeterId || state.meters[0].id;
      } else if (d.readings || d.config || d.history) {
        // migrate the legacy single-meter shape into one meter
        const m = normalizeMeter({ name: t("meter.defaultName", { n: 1 }), config: d.config, readings: d.readings, history: d.history });
        state.meters = [m];
        state.activeMeterId = m.id;
      }
    }
  } catch (e) {}
  if (!state.meters.length) {
    const m = newMeter(t("meter.defaultName", { n: 1 }));
    state.meters = [m];
    state.activeMeterId = m.id;
  }
  if (!active()) state.activeMeterId = state.meters[0].id;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error("Failed to save", e); }
}

/* ================= helpers ================= */
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const parseDate = (s) => new Date(s + "T12:00:00");
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const fmt = (n, d = 2) => Number(n).toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (s) => { const d = parseDate(s); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1); };
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ================= icons ================= */
function icon(name, size = 16, fill = false) {
  const paths = {
    droplet: '<path d="M12 2.7S5 10 5 14a7 7 0 0 0 14 0c0-4-7-11.3-7-11.3z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
    gauge: '<path d="M3 13a9 9 0 1 1 18 0"/><path d="M12 13l4-3"/>',
    rotate: '<path d="M3 2v6h6"/><path d="M3.5 9a9 9 0 1 0 2.2-4.2L3 8"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    alert: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    history: '<path d="M3 4v6h6"/><path d="M3.5 11a9 9 0 1 0 2-5.5L3 10"/><path d="M12 8v5l3 2"/>',
    waves: '<path d="M2 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  };
  const f = fill ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2"';
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' + f +
    ' stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
}

/* ================= stats ================= */
function computeStats() {
  const sorted = [...active().readings].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (sorted.length === 0) return { sorted };
  const cfg = active().config;
  const anchor = sorted[0], latest = sorted[sorted.length - 1];
  const usage = Math.max(0, latest.value - anchor.value);
  const days = daysBetween(anchor.date, latest.date);
  const avgPerDay = days > 0 ? usage / days : null;
  const projection = avgPerDay != null ? avgPerDay * cfg.cycleDays : null;
  const idealPerDay = cfg.target / cfg.cycleDays;
  const balance = cfg.target - usage;
  const daysLeft = Math.max(0, cfg.cycleDays - days);
  const perDay = daysLeft > 0 ? balance / daysLeft : null;
  const pacePct = days / cfg.cycleDays;
  let level = "ok";
  if (projection != null) { if (projection > cfg.target * 1.05) level = "over"; else if (projection > cfg.target * 0.98) level = "warn"; }
  else if (usage > cfg.target) level = "over";
  return { sorted, anchor, latest, usage, days, avgPerDay, projection, idealPerDay, balance, daysLeft, perDay, pacePct, level };
}

const COLORS = { ok: "#37e0c8", warn: "#f6b45a", over: "#ff6b7d" };

/* ================= visual builders ================= */
function meterHTML(v) {
  const intPart = Math.floor(v), frac = Math.round((v - intPart) * 1000);
  const black = String(intPart).padStart(5, "0").slice(-5).split("");
  const red = String(frac).padStart(3, "0").split("");
  return '<div class="meter">' +
    black.map((d) => '<span class="dig">' + d + "</span>").join("") +
    red.map((d) => '<span class="dig red">' + d + "</span>").join("") +
    '<span class="unit">m³</span></div>';
}

function tankSVG(fillPct, pacePct, color) {
  const W = 150, H = 260, top = 8, bot = H - 8, span = bot - top;
  const c = Math.max(0, Math.min(1, fillPct));
  const waterTop = bot - c * span;
  const paceY = bot - Math.max(0, Math.min(1, pacePct)) * span;
  const wave = "M0 10 Q25 2 50 10 T100 10 T150 10 T200 10 T250 10 T300 10 V" + H + " H0 Z";
  let ticks = "";
  [0.25, 0.5, 0.75].forEach((tk) => { const y = bot - tk * span; ticks += '<line x1="8" x2="14" y1="' + y + '" y2="' + y + '" stroke="#1d4257" stroke-width="1.5"/>'; });
  let water = "";
  if (c > 0.001) {
    water =
      '<g style="transform:translateY(' + (waterTop - 10) + 'px)">' +
        '<g style="animation:wavemove 3.5s linear infinite"><path d="' + wave + '" fill="url(#wg)"/></g>' +
        '<g style="animation:wavemove 5s linear infinite reverse;opacity:.4"><path d="' + wave + '" fill="' + color + '"/></g>' +
      "</g>";
  }
  let pace = "";
  if (pacePct > 0 && pacePct < 1.02) {
    pace =
      '<line x1="6" x2="' + (W - 6) + '" y1="' + paceY + '" y2="' + paceY + '" stroke="#e9f6f7" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>' +
      '<text x="' + (W - 8) + '" y="' + (paceY - 5) + '" font-size="9" fill="#e9f6f7" opacity=".8" text-anchor="end" font-family="Space Mono">' + t("tank.targetToday") + '</text>';
  }
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" style="flex:none">' +
    '<defs><clipPath id="tc"><rect x="8" y="' + top + '" width="' + (W - 16) + '" height="' + span + '" rx="14"/></clipPath>' +
    '<linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".95"/><stop offset="1" stop-color="' + color + '" stop-opacity=".55"/></linearGradient></defs>' +
    ticks +
    '<g clip-path="url(#tc)"><rect x="8" y="' + top + '" width="' + (W - 16) + '" height="' + span + '" fill="#04141c"/>' + water + "</g>" +
    pace +
    '<rect x="8" y="' + top + '" width="' + (W - 16) + '" height="' + span + '" rx="14" fill="none" stroke="#2a5470" stroke-width="2"/></svg>';
}

function chartSVG(data, target, cycleDays, color) {
  const W = 320, H = 180, pl = 34, pr = 12, pt = 12, pb = 24;
  const iw = W - pl - pr, ih = H - pt - pb;
  const maxUsage = Math.max(target, ...data.map((d) => d.usage), 0.01);
  const yMax = maxUsage * 1.12;
  const xf = (d) => pl + (Math.min(d, cycleDays) / cycleDays) * iw;
  const yf = (v) => pt + ih - (v / yMax) * ih;
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const gy = pt + ih * (i / 4), val = yMax * (1 - i / 4);
    grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" stroke="#1d4257" stroke-dasharray="3 3"/>';
    grid += '<text x="' + (pl - 5) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="9" fill="#7fa0b0" font-family="Space Mono">' + val.toFixed(0) + "</text>";
  }
  const targetLine = '<line x1="' + xf(0) + '" y1="' + yf(0) + '" x2="' + xf(cycleDays) + '" y2="' + yf(target) + '" stroke="#57b0e6" stroke-width="1.5" stroke-dasharray="5 4"/>';
  const pts = data.map((d) => xf(d.day) + "," + yf(d.usage)).join(" ");
  const line = data.length > 1 ? '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' : "";
  const dots = data.map((d) => '<circle cx="' + xf(d.day) + '" cy="' + yf(d.usage) + '" r="3.5" fill="' + color + '"/>').join("");
  const xlab = '<text x="' + pl + '" y="' + (H - 6) + '" font-size="9" fill="#7fa0b0" font-family="Space Mono">0</text>' +
    '<text x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end" font-size="9" fill="#7fa0b0" font-family="Space Mono">' + cycleDays + "d</text>";
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" style="display:block">' + grid + targetLine + line + dots + xlab + "</svg>";
}

// Grouped column chart comparing target vs. actual usage per closed cycle.
// `history` is stored newest-first; the chart shows the 6 most recent, newest at the left.
function historyChartSVG(history) {
  const cycles = history.slice(0, 6);
  const W = 320, H = 190, pl = 30, pr = 10, pt = 14, pb = 30;
  const iw = W - pl - pr, ih = H - pt - pb;
  const yMax = Math.max(0.01, ...cycles.map((h) => Math.max(h.usage, h.target))) * 1.15;
  const yf = (v) => pt + ih - (v / yMax) * ih;
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const gy = pt + ih * (i / 4), val = yMax * (1 - i / 4);
    grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" stroke="#1d4257" stroke-dasharray="3 3"/>';
    grid += '<text x="' + (pl - 5) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="9" fill="#7fa0b0" font-family="Space Mono">' + val.toFixed(0) + "</text>";
  }
  const gw = iw / cycles.length;
  const barW = Math.min(16, gw * 0.34);
  let bars = "";
  cycles.forEach((h, i) => {
    const cx = pl + gw * i + gw / 2;
    const usageColor = h.usage > h.target ? COLORS.over : COLORS.ok;
    const bar = (x, v, color) => '<rect x="' + x + '" y="' + yf(v) + '" width="' + barW +
      '" height="' + (pt + ih - yf(v)) + '" rx="2" fill="' + color + '"/>';
    bars += bar(cx - barW - 2, h.target, "#57b0e6") + bar(cx + 2, h.usage, usageColor);
    bars += '<text x="' + cx + '" y="' + (H - 16) + '" text-anchor="middle" font-size="8.5" fill="#7fa0b0" font-family="Space Mono">' + fmtDate(h.end) + "</text>";
  });
  const dot = (color, label) => '<span style="display:inline-flex;align-items:center;gap:5px">' +
    '<span style="width:9px;height:9px;border-radius:2px;background:' + color + '"></span>' + label + "</span>";
  const legend = '<div style="display:flex;gap:16px;justify-content:center;font-size:11px;color:var(--mut2);margin-top:4px">' +
    dot("#57b0e6", t("history.legendTarget")) + dot(COLORS.ok, t("history.legendUsage")) + "</div>";
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" style="display:block">' + grid + bars + "</svg>" + legend;
}

/* ================= reading form (shared) ================= */
function readingForm(prefix, defaultValue, submitAction, submitLabel) {
  return (
    '<div class="two">' +
      '<div class="field"><label class="flabel">' + t("form.dateLabel") + '</label>' +
        '<input class="input" type="date" id="' + prefix + '-date" max="' + todayStr() + '" value="' + todayStr() + '"></div>' +
      '<div class="field"><label class="flabel">' + t("form.valueLabel") + '</label>' +
        '<input class="input" inputmode="decimal" id="' + prefix + '-value" placeholder="' + t("form.valuePlaceholder") + '" value="' + (defaultValue || "") + '"></div>' +
    "</div>" +
    '<div class="warn" id="' + prefix + '-warn" style="display:none"></div>' +
    '<button class="btn pri" data-action="' + submitAction + '">' + icon("check") + " " + submitLabel + "</button>"
  );
}
function readReading(prefix, minValue) {
  const date = document.getElementById(prefix + "-date").value;
  const raw = document.getElementById(prefix + "-value").value;
  const num = parseFloat(String(raw).replace(",", "."));
  const warn = document.getElementById(prefix + "-warn");
  if (!date || isNaN(num)) { warn.innerHTML = icon("alert", 14) + " " + t("form.errRequired"); warn.style.display = "flex"; return null; }
  if (minValue != null && num < minValue) { warn.innerHTML = icon("alert", 14) + " " + t("form.errIncreasing", { min: fmt(minValue, 3) }); warn.style.display = "flex"; return null; }
  return { date, value: num };
}

/* ================= dashboard pieces ================= */
function heroCard(s) {
  const cfg = active().config, color = COLORS[s.level];
  return '<div class="card">' +
    '<div style="display:flex;justify-content:center;margin-bottom:14px">' +
      '<span class="status" style="background:' + color + '22;color:' + color + '">' +
      icon(s.level === "over" ? "alert" : s.level === "warn" ? "waves" : "check", 14) + " " + t("status." + s.level) + "</span></div>" +
    '<div class="meterlab">' + t("hero.currentReading") + '</div>' + meterHTML(s.latest.value) +
    '<div class="tankrow" style="margin-top:18px">' + tankSVG(s.usage / cfg.target, s.pacePct, color) +
      '<div class="tankfacts">' +
        '<div class="projlab">' + t("hero.cycleUsage") + '</div>' +
        '<div class="big" style="color:' + color + '">' + fmt(s.usage) + '<span class="bigunit">m³</span></div>' +
        '<div class="ofideal">' + t("hero.ofTarget", { target: fmt(cfg.target) }) + "</div>" +
        '<div class="projrow"><div class="projlab">' + t("hero.projection") + '</div>' +
          '<div class="projval" style="color:' + color + '">' + (s.projection != null ? fmt(s.projection) + " m³" : "—") + "</div>" +
          '<div class="ofideal">' + (s.projection != null ? t("hero.projectionPct", { pct: fmt((s.projection / cfg.target) * 100, 0) }) : t("hero.needMoreReadings")) + "</div>" +
        "</div></div></div></div>";
}

function statCard(ic, l, v) {
  return '<div class="stat"><div class="l">' + icon(ic, 12) + l + '</div><div class="v">' + v + "</div></div>";
}
function statsGrid(s) {
  const cfg = active().config;
  const col = (c, txt) => '<span style="color:' + c + '">' + txt + "</span>";
  return '<div class="grid">' +
    statCard("calendar", t("stats.daysInCycle"), s.days + "<small> / " + cfg.cycleDays + "</small>") +
    statCard("gauge", t("stats.avgPerDay"), s.avgPerDay != null ? fmt(s.avgPerDay, 3) + "<small> m³</small>" : "—") +
    statCard("waves", t("stats.idealPerDay"), fmt(s.idealPerDay, 3) + "<small> m³</small>") +
    statCard("droplet", t("stats.balance"), (s.balance < 0 ? col("#ff6b7d", fmt(s.balance)) : fmt(s.balance)) + "<small> m³</small>") +
    statCard("calendar", t("stats.daysLeft"), s.daysLeft) +
    statCard("gauge", t("stats.canSpendPerDay"), s.perDay != null ? (s.perDay < 0 ? col("#ff6b7d", "0,000") : fmt(s.perDay, 3)) + "<small> m³</small>" : "—") +
    "</div>";
}

function chartCard(s) {
  const cfg = active().config, color = COLORS[s.level];
  const data = s.sorted.map((r) => ({ day: daysBetween(s.sorted[0].date, r.date), usage: Math.max(0, r.value - s.sorted[0].value) }));
  if (data.length < 2) return "";
  return '<div class="card"><div class="secttl">' + icon("waves", 14) + " " + t("chart.title") + "</div>" +
    chartSVG(data, cfg.target, cfg.cycleDays, color) +
    '<div class="hint">' + t("chart.hint", { target: fmt(cfg.target), cycle: cfg.cycleDays }) + "</div></div>";
}

function addSection(s) {
  if (!ui.addOpen) return '<button class="btn pri" data-action="add-toggle">' + icon("plus", 18) + " " + t("add.open") + "</button>";
  return '<div class="card"><div class="secttl">' + icon("plus", 14) + " " + t("add.title") + "</div>" +
    '<p class="hint" style="margin-top:0;margin-bottom:14px">' + t("add.lastRecorded", { value: fmt(s.latest.value, 3), date: fmtDate(s.latest.date) }) + "</p>" +
    readingForm("add", "", "add-submit", t("add.submit")) +
    '<button class="btn ghost" style="margin-top:2px" data-action="add-cancel">' + t("common.cancel") + "</button></div>";
}

function readingsCard(s) {
  let rows = "";
  s.sorted.forEach((r, i) => {
    const prev = i > 0 ? s.sorted[i - 1] : null;
    const delta = prev ? r.value - prev.value : 0;
    const dd = prev ? daysBetween(prev.date, r.date) : 0;
    rows += '<div class="read"><span class="rdate">' + fmtDate(r.date) + '</span><span class="rmed">' + fmt(r.value, 3) + " m³</span>" +
      (i === 0
        ? '<span class="anchor">' + t("readings.baseTag") + '</span>'
        : '<span class="rdelta">+' + fmt(delta) + " m³<small>" + dd + " " + (dd === 1 ? t("reading.day") : t("reading.days")) + "</small></span>") +
      '<button class="del" data-action="del" data-id="' + r.id + '">' + icon("trash", 15) + "</button></div>";
  });
  return '<div class="card"><div class="secttl">' + icon("droplet", 14) + " " + t("readings.title") + "</div>" + rows + "</div>";
}

/* ================= meters bar ================= */
function metersBar() {
  if (state.meters.length <= 1 && active().readings.length === 0) return "";
  const chips = state.meters.map((m) => {
    const act = m.id === state.activeMeterId;
    return '<button class="mchip' + (act ? " act" : "") + '" data-action="switch-meter" data-id="' + m.id + '">' +
      icon("home", 13) + esc(m.name) + "</button>";
  }).join("");
  const add = '<button class="mchip add" data-action="add-meter">' + icon("plus", 14) + " " + t("meters.new") + "</button>";
  return '<div class="meters">' + chips + add + "</div>";
}

/* ================= onboarding ================= */
function onboarding() {
  const m = active();
  if (ui.obStep === 1) {
    return '<div class="card"><div class="empty"><div class="ic">' + icon("droplet", 30, true) + "</div>" +
      "<h2>" + t("onboarding.step1Title") + "</h2><p>" + t("onboarding.step1Desc") + "</p></div>" +
      '<div class="field"><label class="flabel">' + t("onboarding.nameLabel") + '</label>' +
        '<input class="input" id="ob-name" style="font-family:Inter" value="' + esc(m.name) + '" placeholder="' + t("onboarding.namePlaceholder") + '"></div>' +
      '<div class="two"><div class="field"><label class="flabel">' + t("onboarding.targetLabel") + '</label>' +
        '<input class="input" inputmode="decimal" id="ob-target" value="' + m.config.target + '" placeholder="11"></div>' +
      '<div class="field"><label class="flabel">' + t("onboarding.cycleLabel") + '</label>' +
        '<input class="input" inputmode="numeric" id="ob-cycle" value="' + m.config.cycleDays + '" placeholder="30"></div></div>' +
      '<button class="btn pri" data-action="ob-next">' + t("onboarding.continue") + "</button></div>";
  }
  return '<div class="card"><div class="empty"><div class="ic">' + icon("droplet", 30, true) + "</div>" +
    "<h2>" + t("onboarding.step2Title") + "</h2><p>" + t("onboarding.step2Desc") + "</p></div>" +
    readingForm("ob", "", "ob-start", t("onboarding.step2Submit")) + "</div>";
}

/* ================= render ================= */
function render() {
  const app = document.getElementById("app");
  const m = active();
  const cfg = m.config;
  const multi = state.meters.length > 1;
  const s = computeStats();

  let head = '<div class="head"><div class="logo">' + icon("droplet", 24, true) + "</div>" +
    '<div style="min-width:0"><div class="title">' + t("app.name") + '</div><div class="sub">' +
      (multi ? esc(m.name) : t("header.cycleSub", { cycle: cfg.cycleDays })) + '</div></div>' +
    '<button class="icbtn first" data-action="open-modal" data-modal="history">' + icon("history", 18) + "</button>" +
    '<button class="icbtn" data-action="open-modal" data-modal="settings">' + icon("settings", 18) + "</button></div>";

  let body;
  if (s.sorted.length === 0) {
    body = onboarding();
  } else {
    body = heroCard(s) + statsGrid(s) + chartCard(s) + addSection(s) + readingsCard(s) +
      '<button class="btn ghost" data-action="open-modal" data-modal="newcycle">' + icon("rotate", 17) + " " + t("header.newOfficial") + "</button>";
  }
  app.innerHTML = head + metersBar() + body;
  renderModal();
  renderInstall();
}

function renderModal() {
  const m = document.getElementById("modal");
  if (!ui.modal) { m.innerHTML = ""; return; }
  const s = computeStats();
  const cur = active();
  let title = "", inner = "";
  if (ui.modal === "settings") {
    title = t("settings.title");
    const delBlock = state.meters.length > 1
      ? (ui.confirmDel
          ? '<div class="warn" style="margin-top:6px">' + icon("alert", 14) + " " + t("settings.deleteConfirm", { name: esc(cur.name) }) + "</div>" +
            '<div class="two"><button class="btn ghost" style="margin:0" data-action="meter-del-cancel">' + t("common.cancel") + "</button>" +
            '<button class="btn danger" style="margin:0" data-action="meter-del-confirm">' + icon("trash", 16) + " " + t("settings.delete") + "</button></div>"
          : '<button class="btn danger" style="margin-bottom:0" data-action="meter-del">' + icon("trash", 16) + " " + t("settings.deleteMeter") + "</button>")
      : "";
    inner =
      '<div class="field"><label class="flabel">' + t("settings.nameLabel") + '</label>' +
        '<input class="input" id="set-name" style="font-family:Inter" value="' + esc(cur.name) + '"></div>' +
      '<div class="field"><label class="flabel">' + t("settings.targetLabel") + '</label>' +
        '<input class="input" inputmode="decimal" id="set-target" value="' + cur.config.target + '"></div>' +
      '<div class="field"><label class="flabel">' + t("settings.cycleLabel") + '</label>' +
        '<input class="input" inputmode="numeric" id="set-cycle" value="' + cur.config.cycleDays + '"></div>' +
      '<p class="hint" style="margin-bottom:16px">' + t("settings.hint") + "</p>" +
      '<button class="btn pri" data-action="set-save">' + icon("check", 17) + " " + t("settings.save") + "</button>" +
      delBlock;
  } else if (ui.modal === "newcycle") {
    title = t("newcycle.title");
    inner =
      '<p class="hint" style="margin-bottom:16px">' + t("newcycle.desc") + "</p>" +
      readingForm("nc", s.latest ? s.latest.value : "", "nc-submit", t("newcycle.submit"));
  } else if (ui.modal === "history") {
    title = t("history.title");
    if (cur.history.length === 0) {
      inner = '<p class="hint">' + t("history.empty") + "</p>";
    } else {
      inner = historyChartSVG(cur.history) +
        cur.history.map((h) =>
        '<div class="histrow"><span style="color:#7fa0b0;font-family:Space Mono">' + fmtDate(h.start) + " – " + fmtDate(h.end) + "</span>" +
        '<span style="font-family:Space Grotesk;font-weight:600;color:' + (h.usage > h.target ? "#ff6b7d" : "#37e0c8") + '">' +
        fmt(h.usage) + " / " + fmt(h.target) + " m³</span></div>").join("");
    }
  }
  m.innerHTML = '<div class="ov" data-action="close-modal"><div class="sheet" data-stop="1">' +
    '<div class="sheethd"><h3>' + title + '</h3><button class="close" data-action="close-modal">' + icon("x", 18) + "</button></div>" +
    inner + "</div></div>";
}

function renderInstall() {
  const el = document.getElementById("install");
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (isStandalone) { el.style.display = "none"; return; }
  if (deferredPrompt) {
    el.style.display = "flex";
    el.className = "install";
    el.innerHTML = icon("download", 18) + "<span>" + t("install.prompt") + "</span><button data-action='install'>" + t("install.button") + "</button>";
  } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    el.style.display = "flex";
    el.className = "install";
    el.innerHTML = icon("download", 18) + "<span>" + t("install.ios") + "</span>";
  } else {
    el.style.display = "none";
  }
}

/* ================= actions ================= */
function startCycle(date, value) {
  const m = active();
  const s = computeStats();
  if (s.sorted && s.sorted.length >= 2) {
    m.history.unshift({
      id: uid(), start: s.sorted[0].date, end: s.sorted[s.sorted.length - 1].date,
      usage: s.usage, target: m.config.target, days: s.days,
    });
    m.history = m.history.slice(0, 12);
  }
  m.readings = [{ id: uid(), date, value }];
  save();
}

function deleteMeter(id) {
  state.meters = state.meters.filter((m) => m.id !== id);
  if (!state.meters.length) state.meters = [newMeter(t("meter.defaultName", { n: 1 }))];
  if (state.activeMeterId === id || !active()) state.activeMeterId = state.meters[0].id;
  save();
}

document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const a = target.dataset.action;

  // Overlay carries close-modal; only close on a direct backdrop tap (not taps inside the sheet)
  if (a === "close-modal") {
    if (target.classList.contains("ov") && e.target !== target) return;
    ui.modal = null; ui.confirmDel = false; render(); return;
  }

  if (a === "ob-next") {
    const m = active();
    const nm = document.getElementById("ob-name").value.trim();
    const tg = parseFloat(String(document.getElementById("ob-target").value).replace(",", "."));
    const cy = parseInt(document.getElementById("ob-cycle").value, 10);
    if (nm) m.name = nm;
    m.config = { target: !isNaN(tg) && tg > 0 ? tg : 11, cycleDays: !isNaN(cy) && cy > 0 ? cy : 30 };
    save(); ui.obStep = 2; render();
  } else if (a === "ob-start") {
    const r = readReading("ob", null); if (!r) return;
    active().readings = [{ id: uid(), date: r.date, value: r.value }]; save(); render();
  } else if (a === "add-toggle") { ui.addOpen = true; render(); }
  else if (a === "add-cancel") { ui.addOpen = false; render(); }
  else if (a === "add-submit") {
    const s = computeStats();
    const r = readReading("add", s.latest.value); if (!r) return;
    active().readings.push({ id: uid(), date: r.date, value: r.value }); save(); ui.addOpen = false; render();
  } else if (a === "del") {
    active().readings = active().readings.filter((x) => x.id !== target.dataset.id); save(); render();
  } else if (a === "switch-meter") {
    state.activeMeterId = target.dataset.id;
    ui.addOpen = false; ui.modal = null; ui.obStep = 1; ui.confirmDel = false;
    save(); render();
  } else if (a === "add-meter") {
    const m = newMeter(t("meter.defaultName", { n: state.meters.length + 1 }));
    state.meters.push(m);
    state.activeMeterId = m.id;
    ui.addOpen = false; ui.modal = null; ui.obStep = 1; ui.confirmDel = false;
    save(); render();
  } else if (a === "meter-del") { ui.confirmDel = true; render(); }
  else if (a === "meter-del-cancel") { ui.confirmDel = false; render(); }
  else if (a === "meter-del-confirm") {
    deleteMeter(state.activeMeterId);
    ui.confirmDel = false; ui.modal = null; ui.addOpen = false; ui.obStep = 1; render();
  } else if (a === "open-modal") { ui.modal = target.dataset.modal; ui.confirmDel = false; render(); }
  else if (a === "set-save") {
    const m = active();
    const nm = document.getElementById("set-name").value.trim();
    const tg = parseFloat(String(document.getElementById("set-target").value).replace(",", "."));
    const cy = parseInt(document.getElementById("set-cycle").value, 10);
    if (nm) m.name = nm;
    m.config = { target: !isNaN(tg) && tg > 0 ? tg : m.config.target, cycleDays: !isNaN(cy) && cy > 0 ? cy : m.config.cycleDays };
    save(); ui.modal = null; ui.confirmDel = false; render();
  } else if (a === "nc-submit") {
    const r = readReading("nc", null); if (!r) return;
    startCycle(r.date, r.value); ui.modal = null; ui.addOpen = false; render();
  } else if (a === "install") {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.finally(() => { deferredPrompt = null; renderInstall(); }); }
  }
});

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; renderInstall(); });
window.addEventListener("appinstalled", () => { deferredPrompt = null; renderInstall(); });

/* ================= service worker ================= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}

loadState();
render();

// Version label is static; set it once (APP_VERSION comes from version.js).
document.getElementById("version").textContent = t("footer.version", { version: APP_VERSION });
