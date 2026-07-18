/* ================= state ================= */
const KEY = "controle-agua-v2";
let state = { config: { ideal: 11, ciclo: 30 }, readings: [], history: [] };
let ui = { addOpen: false, modal: null, obStep: 1 };
let deferredPrompt = null;

try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const d = JSON.parse(raw);
    state.config = d.config || state.config;
    state.readings = d.readings || [];
    state.history = d.history || [];
  }
} catch (e) {}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error("Falha ao salvar", e); }
}

/* ================= helpers ================= */
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const parseDate = (s) => new Date(s + "T12:00:00");
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const fmt = (n, d = 2) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
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
  };
  const f = fill ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2"';
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' + f +
    ' stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
}

/* ================= stats ================= */
function computeStats() {
  const sorted = [...state.readings].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (sorted.length === 0) return { sorted };
  const cfg = state.config;
  const anchor = sorted[0], latest = sorted[sorted.length - 1];
  const consumo = Math.max(0, latest.medidor - anchor.medidor);
  const dias = daysBetween(anchor.date, latest.date);
  const media = dias > 0 ? consumo / dias : null;
  const proj = media != null ? media * cfg.ciclo : null;
  const ritmo = cfg.ideal / cfg.ciclo;
  const saldo = cfg.ideal - consumo;
  const diasRest = Math.max(0, cfg.ciclo - dias);
  const porDia = diasRest > 0 ? saldo / diasRest : null;
  const pacePct = dias / cfg.ciclo;
  let level = "ok";
  if (proj != null) { if (proj > cfg.ideal * 1.05) level = "over"; else if (proj > cfg.ideal * 0.98) level = "warn"; }
  else if (consumo > cfg.ideal) level = "over";
  return { sorted, anchor, latest, consumo, dias, media, proj, ritmo, saldo, diasRest, porDia, pacePct, level };
}

const COLORS = { ok: "#37e0c8", warn: "#f6b45a", over: "#ff6b7d" };
const STATUS = { ok: "Dentro da meta", warn: "Perto do limite", over: "Acima da meta" };

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
  [0.25, 0.5, 0.75].forEach((t) => { const y = bot - t * span; ticks += '<line x1="8" x2="14" y1="' + y + '" y2="' + y + '" stroke="#1d4257" stroke-width="1.5"/>'; });
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
      '<text x="' + (W - 8) + '" y="' + (paceY - 5) + '" font-size="9" fill="#e9f6f7" opacity=".8" text-anchor="end" font-family="Space Mono">meta hoje</text>';
  }
  return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" style="flex:none">' +
    '<defs><clipPath id="tc"><rect x="8" y="' + top + '" width="' + (W - 16) + '" height="' + span + '" rx="14"/></clipPath>' +
    '<linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".95"/><stop offset="1" stop-color="' + color + '" stop-opacity=".55"/></linearGradient></defs>' +
    ticks +
    '<g clip-path="url(#tc)"><rect x="8" y="' + top + '" width="' + (W - 16) + '" height="' + span + '" fill="#04141c"/>' + water + "</g>" +
    pace +
    '<rect x="8" y="' + top + '" width="' + (W - 16) + '" height="' + span + '" rx="14" fill="none" stroke="#2a5470" stroke-width="2"/></svg>';
}

function chartSVG(data, ideal, ciclo, color) {
  const W = 320, H = 180, pl = 34, pr = 12, pt = 12, pb = 24;
  const iw = W - pl - pr, ih = H - pt - pb;
  const maxC = Math.max(ideal, ...data.map((d) => d.consumo), 0.01);
  const yMax = maxC * 1.12;
  const xf = (d) => pl + (Math.min(d, ciclo) / ciclo) * iw;
  const yf = (v) => pt + ih - (v / yMax) * ih;
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const gy = pt + ih * (i / 4), val = yMax * (1 - i / 4);
    grid += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '" stroke="#1d4257" stroke-dasharray="3 3"/>';
    grid += '<text x="' + (pl - 5) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="9" fill="#7fa0b0" font-family="Space Mono">' + val.toFixed(0) + "</text>";
  }
  const il = '<line x1="' + xf(0) + '" y1="' + yf(0) + '" x2="' + xf(ciclo) + '" y2="' + yf(ideal) + '" stroke="#57b0e6" stroke-width="1.5" stroke-dasharray="5 4"/>';
  const pts = data.map((d) => xf(d.dia) + "," + yf(d.consumo)).join(" ");
  const line = data.length > 1 ? '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' : "";
  const dots = data.map((d) => '<circle cx="' + xf(d.dia) + '" cy="' + yf(d.consumo) + '" r="3.5" fill="' + color + '"/>').join("");
  const xlab = '<text x="' + pl + '" y="' + (H - 6) + '" font-size="9" fill="#7fa0b0" font-family="Space Mono">0</text>' +
    '<text x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end" font-size="9" fill="#7fa0b0" font-family="Space Mono">' + ciclo + "d</text>";
  return '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" style="display:block">' + grid + il + line + dots + xlab + "</svg>";
}

/* ================= reading form (shared) ================= */
function readingForm(prefix, defaultMed, submitAction, submitLabel) {
  return (
    '<div class="two">' +
      '<div class="field"><label class="flabel">Data da leitura</label>' +
        '<input class="input" type="date" id="' + prefix + '-date" max="' + todayStr() + '" value="' + todayStr() + '"></div>' +
      '<div class="field"><label class="flabel">Medidor (m³)</label>' +
        '<input class="input" inputmode="decimal" id="' + prefix + '-med" placeholder="ex: 1234,567" value="' + (defaultMed || "") + '"></div>' +
    "</div>" +
    '<div class="warn" id="' + prefix + '-warn" style="display:none"></div>' +
    '<button class="btn pri" data-action="' + submitAction + '">' + icon("check") + " " + submitLabel + "</button>"
  );
}
function readReading(prefix, minMed) {
  const date = document.getElementById(prefix + "-date").value;
  const raw = document.getElementById(prefix + "-med").value;
  const num = parseFloat(String(raw).replace(",", "."));
  const warn = document.getElementById(prefix + "-warn");
  if (!date || isNaN(num)) { warn.innerHTML = icon("alert", 14) + " Preencha a data e o valor do medidor."; warn.style.display = "flex"; return null; }
  if (minMed != null && num < minMed) { warn.innerHTML = icon("alert", 14) + " O hidrômetro só aumenta — deve ser ≥ " + fmt(minMed, 3) + " m³."; warn.style.display = "flex"; return null; }
  return { date, medidor: num };
}

/* ================= dashboard pieces ================= */
function heroCard(s) {
  const cfg = state.config, color = COLORS[s.level];
  return '<div class="card">' +
    '<div style="display:flex;justify-content:center;margin-bottom:14px">' +
      '<span class="status" style="background:' + color + '22;color:' + color + '">' +
      icon(s.level === "over" ? "alert" : s.level === "warn" ? "waves" : "check", 14) + " " + STATUS[s.level] + "</span></div>" +
    '<div class="meterlab">Leitura atual do hidrômetro</div>' + meterHTML(s.latest.medidor) +
    '<div class="tankrow" style="margin-top:18px">' + tankSVG(s.consumo / cfg.ideal, s.pacePct, color) +
      '<div class="tankfacts">' +
        '<div class="projlab">Consumo do ciclo</div>' +
        '<div class="big" style="color:' + color + '">' + fmt(s.consumo) + '<span class="bigunit">m³</span></div>' +
        '<div class="ofideal">de ' + fmt(cfg.ideal) + " m³ ideais</div>" +
        '<div class="projrow"><div class="projlab">Projeção do ciclo</div>' +
          '<div class="projval" style="color:' + color + '">' + (s.proj != null ? fmt(s.proj) + " m³" : "—") + "</div>" +
          '<div class="ofideal">' + (s.proj != null ? fmt((s.proj / cfg.ideal) * 100, 0) + "% da meta" : "adicione leitura em outro dia") + "</div>" +
        "</div></div></div></div>";
}

function statCard(ic, l, v) {
  return '<div class="stat"><div class="l">' + icon(ic, 12) + l + '</div><div class="v">' + v + "</div></div>";
}
function statsGrid(s) {
  const cfg = state.config;
  const col = (c, txt) => '<span style="color:' + c + '">' + txt + "</span>";
  return '<div class="grid">' +
    statCard("calendar", "Dias no ciclo", s.dias + "<small> / " + cfg.ciclo + "</small>") +
    statCard("gauge", "Média por dia", s.media != null ? fmt(s.media, 3) + "<small> m³</small>" : "—") +
    statCard("waves", "Ritmo ideal/dia", fmt(s.ritmo, 3) + "<small> m³</small>") +
    statCard("droplet", "Saldo restante", (s.saldo < 0 ? col("#ff6b7d", fmt(s.saldo)) : fmt(s.saldo)) + "<small> m³</small>") +
    statCard("calendar", "Dias restantes", s.diasRest) +
    statCard("gauge", "Pode gastar/dia", s.porDia != null ? (s.porDia < 0 ? col("#ff6b7d", "0,000") : fmt(s.porDia, 3)) + "<small> m³</small>" : "—") +
    "</div>";
}

function chartCard(s) {
  const cfg = state.config, color = COLORS[s.level];
  const data = s.sorted.map((r) => ({ dia: daysBetween(s.sorted[0].date, r.date), consumo: Math.max(0, r.medidor - s.sorted[0].medidor) }));
  if (data.length < 2) return "";
  return '<div class="card"><div class="secttl">' + icon("waves", 14) + " Trajetória do consumo</div>" +
    chartSVG(data, cfg.ideal, cfg.ciclo, color) +
    '<div class="hint">A linha azul tracejada é o ritmo ideal (chegar a ' + fmt(cfg.ideal) + " m³ no dia " + cfg.ciclo +
    "). Ficar <strong>abaixo</strong> dela significa consumo controlado.</div></div>";
}

function addSection(s) {
  if (!ui.addOpen) return '<button class="btn pri" data-action="add-toggle">' + icon("plus", 18) + " Registrar nova leitura</button>";
  return '<div class="card"><div class="secttl">' + icon("plus", 14) + " Nova leitura</div>" +
    '<p class="hint" style="margin-top:0;margin-bottom:14px">Última registrada: <strong>' + fmt(s.latest.medidor, 3) + " m³</strong> em " + fmtDate(s.latest.date) + ".</p>" +
    readingForm("add", "", "add-submit", "Adicionar leitura") +
    '<button class="btn ghost" style="margin-top:2px" data-action="add-cancel">Cancelar</button></div>';
}

function readingsCard(s) {
  let rows = "";
  s.sorted.forEach((r, i) => {
    const prev = i > 0 ? s.sorted[i - 1] : null;
    const delta = prev ? r.medidor - prev.medidor : 0;
    const dd = prev ? daysBetween(prev.date, r.date) : 0;
    rows += '<div class="read"><span class="rdate">' + fmtDate(r.date) + '</span><span class="rmed">' + fmt(r.medidor, 3) + " m³</span>" +
      (i === 0
        ? '<span class="anchor">LEITURA BASE</span>'
        : '<span class="rdelta">+' + fmt(delta) + " m³<small>" + dd + (dd === 1 ? " dia" : " dias") + "</small></span>") +
      '<button class="del" data-action="del" data-id="' + r.id + '">' + icon("trash", 15) + "</button></div>";
  });
  return '<div class="card"><div class="secttl">' + icon("droplet", 14) + " Leituras registradas</div>" + rows + "</div>";
}

/* ================= onboarding ================= */
function onboarding() {
  if (ui.obStep === 1) {
    return '<div class="card"><div class="empty"><div class="ic">' + icon("droplet", 30, true) + "</div>" +
      "<h2>Vamos começar</h2><p>Defina sua meta de consumo e a duração do ciclo de faturamento.</p></div>" +
      '<div class="two"><div class="field"><label class="flabel">Consumo ideal (m³)</label>' +
        '<input class="input" inputmode="decimal" id="ob-ideal" value="' + state.config.ideal + '" placeholder="11"></div>' +
      '<div class="field"><label class="flabel">Ciclo (dias)</label>' +
        '<input class="input" inputmode="numeric" id="ob-ciclo" value="' + state.config.ciclo + '" placeholder="30"></div></div>' +
      '<button class="btn pri" data-action="ob-next">Continuar</button></div>';
  }
  return '<div class="card"><div class="empty"><div class="ic">' + icon("droplet", 30, true) + "</div>" +
    "<h2>Leitura inicial</h2><p>Informe a data e o valor do hidrômetro na última leitura oficial da concessionária. É o ponto de partida do ciclo.</p></div>" +
    readingForm("ob", "", "ob-start", "Registrar leitura inicial") + "</div>";
}

/* ================= render ================= */
function render() {
  const app = document.getElementById("app");
  const cfg = state.config;
  const s = computeStats();

  let head = '<div class="head"><div class="logo">' + icon("droplet", 24, true) + "</div>" +
    '<div><div class="title">Aquametro</div><div class="sub">ciclo de ' + cfg.ciclo + ' dias</div></div>' +
    '<button class="icbtn first" data-action="open-modal" data-modal="history">' + icon("history", 18) + "</button>" +
    '<button class="icbtn" data-action="open-modal" data-modal="settings">' + icon("settings", 18) + "</button></div>";

  let body;
  if (s.sorted.length === 0) {
    body = onboarding();
  } else {
    body = heroCard(s) + statsGrid(s) + chartCard(s) + addSection(s) + readingsCard(s) +
      '<button class="btn ghost" data-action="open-modal" data-modal="newcycle">' + icon("rotate", 17) + " Nova leitura oficial (novo ciclo)</button>";
  }
  app.innerHTML = head + body;
  renderModal();
  renderInstall();
}

function renderModal() {
  const m = document.getElementById("modal");
  if (!ui.modal) { m.innerHTML = ""; return; }
  const s = computeStats();
  let title = "", inner = "";
  if (ui.modal === "settings") {
    title = "Ajustes";
    inner =
      '<div class="field"><label class="flabel">Consumo ideal por ciclo (m³)</label>' +
        '<input class="input" inputmode="decimal" id="set-ideal" value="' + state.config.ideal + '"></div>' +
      '<div class="field"><label class="flabel">Duração do ciclo (dias)</label>' +
        '<input class="input" inputmode="numeric" id="set-ciclo" value="' + state.config.ciclo + '"></div>' +
      '<p class="hint" style="margin-bottom:16px">As concessionárias costumam faturar em ciclos de ~30 dias. Ajuste conforme sua conta. Isso não apaga suas leituras.</p>' +
      '<button class="btn pri" data-action="set-save">' + icon("check", 17) + " Salvar ajustes</button>";
  } else if (ui.modal === "newcycle") {
    title = "Nova leitura oficial";
    inner =
      '<p class="hint" style="margin-bottom:16px">Use quando a concessionária fizer uma nova leitura. O ciclo atual será fechado e guardado no histórico, e esta passa a ser a leitura base do novo ciclo.</p>' +
      readingForm("nc", s.latest ? s.latest.medidor : "", "nc-submit", "Iniciar novo ciclo");
  } else if (ui.modal === "history") {
    title = "Histórico de ciclos";
    if (state.history.length === 0) {
      inner = '<p class="hint">Nenhum ciclo fechado ainda. Ao registrar uma nova leitura oficial, o ciclo atual aparece aqui.</p>';
    } else {
      inner = state.history.map((h) =>
        '<div class="histrow"><span style="color:#7fa0b0;font-family:Space Mono">' + fmtDate(h.start) + " – " + fmtDate(h.end) + "</span>" +
        '<span style="font-family:Space Grotesk;font-weight:600;color:' + (h.consumo > h.ideal ? "#ff6b7d" : "#37e0c8") + '">' +
        fmt(h.consumo) + " / " + fmt(h.ideal) + " m³</span></div>").join("");
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
    el.innerHTML = icon("download", 18) + "<span>Instale o app na tela inicial</span><button data-action='install'>Instalar</button>";
  } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    el.style.display = "flex";
    el.className = "install";
    el.innerHTML = icon("download", 18) + "<span>Para instalar: toque em Compartilhar → Adicionar à Tela de Início.</span>";
  } else {
    el.style.display = "none";
  }
}

/* ================= actions ================= */
function startCycle(date, medidor) {
  const s = computeStats();
  if (s.sorted && s.sorted.length >= 2) {
    state.history.unshift({
      id: uid(), start: s.sorted[0].date, end: s.sorted[s.sorted.length - 1].date,
      consumo: s.consumo, ideal: state.config.ideal, dias: s.dias,
    });
    state.history = state.history.slice(0, 12);
  }
  state.readings = [{ id: uid(), date, medidor }];
  save();
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const a = t.dataset.action;

  // Overlay carries close-modal; only close on a direct backdrop tap (not taps inside the sheet)
  if (a === "close-modal") {
    if (t.classList.contains("ov") && e.target !== t) return;
    ui.modal = null; render(); return;
  }

  if (a === "ob-next") {
    const i = parseFloat(String(document.getElementById("ob-ideal").value).replace(",", "."));
    const c = parseInt(document.getElementById("ob-ciclo").value, 10);
    state.config = { ideal: !isNaN(i) && i > 0 ? i : 11, ciclo: !isNaN(c) && c > 0 ? c : 30 };
    save(); ui.obStep = 2; render();
  } else if (a === "ob-start") {
    const r = readReading("ob", null); if (!r) return;
    state.readings = [{ id: uid(), date: r.date, medidor: r.medidor }]; save(); render();
  } else if (a === "add-toggle") { ui.addOpen = true; render(); }
  else if (a === "add-cancel") { ui.addOpen = false; render(); }
  else if (a === "add-submit") {
    const s = computeStats();
    const r = readReading("add", s.latest.medidor); if (!r) return;
    state.readings.push({ id: uid(), date: r.date, medidor: r.medidor }); save(); ui.addOpen = false; render();
  } else if (a === "del") {
    state.readings = state.readings.filter((x) => x.id !== t.dataset.id); save(); render();
  } else if (a === "open-modal") { ui.modal = t.dataset.modal; render(); }
  else if (a === "set-save") {
    const i = parseFloat(String(document.getElementById("set-ideal").value).replace(",", "."));
    const c = parseInt(document.getElementById("set-ciclo").value, 10);
    state.config = { ideal: !isNaN(i) && i > 0 ? i : state.config.ideal, ciclo: !isNaN(c) && c > 0 ? c : state.config.ciclo };
    save(); ui.modal = null; render();
  } else if (a === "nc-submit") {
    const r = readReading("nc", null); if (!r) return;
    startCycle(r.date, r.medidor); ui.modal = null; ui.addOpen = false; render();
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

render();
