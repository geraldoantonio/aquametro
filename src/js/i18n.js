/* ================= i18n =================
 * Screen texts live here as translation keys, never hardcoded in app.js.
 * t(key, vars) resolves a key against the active locale and interpolates
 * {placeholder} tokens. Values may contain HTML (interpolated into innerHTML),
 * so any user-provided vars must be escaped by the caller before being passed in.
 */
const LOCALE = "pt-BR";

const MESSAGES = {
  "pt-BR": {
    "app.name": "Aquametro",

    "status.ok": "Dentro da meta",
    "status.warn": "Perto do limite",
    "status.over": "Acima da meta",

    "tank.targetToday": "meta hoje",

    "form.dateLabel": "Data da leitura",
    "form.valueLabel": "Medidor (m³)",
    "form.valuePlaceholder": "ex: 1234,567",
    "form.errRequired": "Preencha a data e o valor do medidor.",
    "form.errIncreasing": "O hidrômetro só aumenta — deve ser ≥ {min} m³.",

    "hero.currentReading": "Leitura atual do hidrômetro",
    "hero.cycleUsage": "Consumo do ciclo",
    "hero.ofTarget": "de {target} m³ ideais",
    "hero.projection": "Projeção do ciclo",
    "hero.projectionPct": "{pct}% da meta",
    "hero.needMoreReadings": "adicione leitura em outro dia",

    "stats.daysInCycle": "Dias no ciclo",
    "stats.avgPerDay": "Média por dia",
    "stats.idealPerDay": "Ritmo ideal/dia",
    "stats.balance": "Saldo restante",
    "stats.daysLeft": "Dias restantes",
    "stats.canSpendPerDay": "Pode gastar/dia",

    "chart.title": "Trajetória do consumo",
    "chart.hint": "A linha azul tracejada é o ritmo ideal (chegar a {target} m³ no dia {cycle}). Ficar <strong>abaixo</strong> dela significa consumo controlado.",

    "add.open": "Registrar nova leitura",
    "add.title": "Nova leitura",
    "add.lastRecorded": "Última registrada: <strong>{value} m³</strong> em {date}.",
    "add.submit": "Adicionar leitura",

    "common.cancel": "Cancelar",

    "readings.title": "Leituras registradas",
    "readings.baseTag": "LEITURA BASE",
    "reading.day": "dia",
    "reading.days": "dias",

    "meters.new": "Novo",
    "meter.defaultName": "Medidor {n}",

    "onboarding.step1Title": "Vamos começar",
    "onboarding.step1Desc": "Dê um nome ao medidor, defina a meta de consumo e a duração do ciclo de faturamento.",
    "onboarding.nameLabel": "Nome do medidor",
    "onboarding.namePlaceholder": "ex: Casa, Chácara",
    "onboarding.targetLabel": "Consumo ideal (m³)",
    "onboarding.cycleLabel": "Ciclo (dias)",
    "onboarding.continue": "Continuar",
    "onboarding.step2Title": "Leitura inicial",
    "onboarding.step2Desc": "Informe a data e o valor do hidrômetro na última leitura oficial da concessionária. É o ponto de partida do ciclo.",
    "onboarding.step2Submit": "Registrar leitura inicial",

    "header.cycleSub": "ciclo de {cycle} dias",
    "header.newOfficial": "Nova leitura oficial (novo ciclo)",

    "settings.title": "Ajustes do medidor",
    "settings.nameLabel": "Nome do medidor",
    "settings.targetLabel": "Consumo ideal por ciclo (m³)",
    "settings.cycleLabel": "Duração do ciclo (dias)",
    "settings.hint": "As concessionárias costumam faturar em ciclos de ~30 dias. Ajuste conforme sua conta. Isso não apaga suas leituras.",
    "settings.save": "Salvar ajustes",
    "settings.deleteConfirm": "Remover \"{name}\" e todas as suas leituras? Não dá pra desfazer.",
    "settings.delete": "Remover",
    "settings.deleteMeter": "Remover este medidor",

    "newcycle.title": "Nova leitura oficial",
    "newcycle.desc": "Use quando a concessionária fizer uma nova leitura. O ciclo atual será fechado e guardado no histórico, e esta passa a ser a leitura base do novo ciclo.",
    "newcycle.submit": "Iniciar novo ciclo",

    "history.title": "Histórico de ciclos",
    "history.empty": "Nenhum ciclo fechado ainda. Ao registrar uma nova leitura oficial, o ciclo atual aparece aqui.",
    "history.legendTarget": "Objetivo",
    "history.legendUsage": "Consumo real",

    "install.prompt": "Instale o app na tela inicial",
    "install.button": "Instalar",
    "install.ios": "Para instalar: toque em Compartilhar → Adicionar à Tela de Início.",

    "footer.version": "v{version}",
  },
};

function t(key, vars) {
  const dict = MESSAGES[LOCALE] || MESSAGES["pt-BR"];
  let str = dict[key];
  if (str == null) return key;
  if (vars) str = str.replace(/\{(\w+)\}/g, (_, name) => (vars[name] != null ? vars[name] : "{" + name + "}"));
  return str;
}
