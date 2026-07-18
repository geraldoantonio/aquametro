# 💧 Controle de Água

App web (PWA) para acompanhar o consumo de água da sua casa ao longo do ciclo de faturamento da concessionária e não estourar a meta. Você registra as leituras do hidrômetro e o app calcula consumo, média diária, projeção do ciclo e quanto ainda pode gastar por dia.

Tudo roda **100% no navegador** — sem back-end, sem cadastro. Os dados ficam salvos localmente no seu dispositivo (`localStorage`).

## Funcionalidades

- **Registro de leituras** do hidrômetro (data + valor em m³), com validação de que o medidor só aumenta.
- **Painel de consumo** com hidrômetro visual, tanque animado e status (dentro da meta / perto do limite / acima da meta).
- **Estatísticas do ciclo**: dias decorridos, média por dia, ritmo ideal, saldo restante, dias restantes e quanto pode gastar por dia.
- **Gráfico de trajetória** comparando o consumo real com o ritmo ideal.
- **Ciclos de faturamento**: ao registrar uma nova leitura oficial da concessionária, o ciclo atual é fechado e guardado no histórico.
- **Ajustes** de consumo ideal e duração do ciclo (padrão: 11 m³ em 30 dias).
- **PWA instalável**: funciona offline e pode ser adicionado à tela inicial (iOS e Android).

## Como usar

Por ser um site estático, basta servir os arquivos por HTTP. Localmente:

```bash
# na raiz do projeto
python3 -m http.server 8000
# depois abra http://localhost:8000
```

> É recomendado servir via HTTP (não abrir o `index.html` direto com `file://`) para que o Service Worker e o modo PWA funcionem.

No primeiro acesso, o onboarding pede:
1. **Consumo ideal** (m³) e **duração do ciclo** (dias).
2. **Leitura inicial** — data e valor do hidrômetro na última leitura oficial da concessionária (ponto de partida do ciclo).

Depois é só registrar novas leituras conforme for consultando o medidor.

## Deploy

Qualquer hospedagem de arquivos estáticos serve (GitHub Pages, Netlify, Vercel, Cloudflare Pages etc.). Faça o upload da raiz do projeto — não há etapa de build.

## Estrutura

```
.
├── index.html            # App completo (HTML + CSS + JS, sem dependências)
├── manifest.webmanifest  # Manifesto do PWA
├── sw.js                 # Service Worker (cache offline)
├── icon-192.png          # Ícones do app
├── icon-512.png
└── apple-touch-icon.png
```

## Tecnologia

- HTML, CSS e JavaScript puros (vanilla), sem frameworks nem dependências externas.
- Persistência local via `localStorage`.
- PWA com Service Worker (cache-first) para uso offline.

## Privacidade

Nenhum dado sai do seu dispositivo. Não há servidor, telemetria ou coleta de informações — todas as leituras ficam apenas no navegador onde foram registradas.
