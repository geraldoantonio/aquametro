---
name: release
description: >-
  Publica uma nova versão do Aquametro seguindo o fluxo de release do projeto:
  bumpa o semver em src/js/version.js, valida no navegador, commita, cria a tag
  git vX.Y.Z, faz push e abre o GitHub release com notas em pt-BR. Dispare quando
  o Geraldo disser "faz o release", "lança a versão", "publica a v0.2.0", "bumpa
  pra minor/patch/major", "cria o release da próxima versão" ou similar.
  NÃO é read-only: edita arquivo, commita, cria tag, faz push e publica release.
---

# Fazer o release de uma nova versão

Objetivo: levar o Aquametro de uma versão à próxima de forma consistente — uma
única fonte da verdade (`APP_VERSION`), tag git e GitHub release, sem esquecer
nenhum passo nem dessincronizar cache do Service Worker e rodapé.

Esta skill **escreve estado** (edita arquivo, commita, tag, push, publica release)
e é **user-invoked** — o Geraldo a dispara explicitamente. Cada passo que publica
(push, GitHub release) só acontece depois de confirmação.

## Contexto fixo deste projeto

- Repo GitHub: **`geraldoantonio/aquametro`**. Commits em inglês (regra do AGENTS.md).
- **Fonte única da versão**: `src/js/version.js` → `const APP_VERSION = "X.Y.Z"`.
  É o **único** arquivo a editar no bump. O `src/sw.js` deriva o cache dela
  (`CACHE = "controle-agua-v" + APP_VERSION`) e o rodapé renderiza via a chave i18n
  `footer.version` — **não** edite `sw.js` nem o rodapé só por causa da versão.
- Versionamento **semver** `MAJOR.MINOR.PATCH`, ainda em fase `0.x` (pré-1.0):
  - **PATCH** (`0.1.1`) → bugfix, ajuste de texto/estilo.
  - **MINOR** (`0.2.0`) → funcionalidade nova compatível.
  - **MAJOR** (`1.0.0`) → primeiro estável ou mudança que quebra dados do `localStorage`.
- Notas de release em **pt-BR** (convenção do `README.md`, que é o único arquivo em pt).
- Validação é **no navegador** — não há suíte de testes (regra do AGENTS.md).

## Requisitos

Não vêm com a skill; precisam existir na sessão:

- **`gh` (GitHub CLI)** instalado e autenticado (`gh auth status` ok). Se não estiver
  no PATH, use `/opt/homebrew/bin/gh`.
- **`git`** com o repo limpo (sem mudanças não commitadas que não sejam do release).
- **Chrome MCP** (`mcp__claude-in-chrome__*`) disponível para a validação — se não
  estiver, avise e siga com uma validação mais fraca (curl), sem pular a etapa em silêncio.

## Como fazer perguntas

Toda pergunta ao Geraldo é de **múltipla escolha** (`AskUserQuestion`):
- Ofereça opções prontas; a 1ª é a recomendada e leva `(Recomendado)` no rótulo.
- Nunca crie opção "Outro" — o campo custom aparece sozinho.

## Preflight

Antes de tudo:

```bash
git -C /Users/geraldo-jr/Developer/aquametro status --short   # deve estar limpo
grep APP_VERSION /Users/geraldo-jr/Developer/aquametro/src/js/version.js
git -C /Users/geraldo-jr/Developer/aquametro describe --tags --abbrev=0   # última tag
gh auth status 2>&1 | head -3
```

Se o working tree tiver mudanças alheias ao release, **pare** e pergunte se deve
incluí-las, commitá-las à parte, ou abortar. Não commite às cegas.

## 1. Decidir a nova versão

A partir da versão atual (`version.js`) e da última tag, proponha a próxima.
Se o Geraldo não disse o tipo do bump, pergunte com `AskUserQuestion` oferecendo
PATCH / MINOR / MAJOR já com os números calculados (ex.: atual `0.1.0` → opções
`0.1.1`, `0.2.0`, `1.0.0`). Deixe a recomendação alinhada ao que os commits desde
a última tag sugerem (só fix → patch; feature nova → minor).

## 2. Bumpar a versão

Edite **somente** `src/js/version.js`, trocando o valor de `APP_VERSION`. Nada mais.

## 3. Validar no navegador

Sirva e confirme que rodapé e Service Worker refletem a nova versão:

```bash
cd /Users/geraldo-jr/Developer/aquametro && make dev PORT=8123 >/tmp/aqua-dev.log 2>&1 &
sleep 1.5
```

Com o Chrome MCP, navegue até `http://localhost:8123/` e cheque:
- `document.getElementById("version").textContent` → `vX.Y.Z` (a nova)
- `navigator.serviceWorker.controller.scriptURL` presente (SW registrou) e sem erros no console

Depois **encerre o server** (`pkill -f 8123`). Se algo não bater, **pare** e mostre
o problema antes de commitar.

## 4. Commit + tag

Mensagem de commit em **inglês**. Use o template abaixo (ajuste a 1ª linha ao conteúdo):

```bash
cd /Users/geraldo-jr/Developer/aquametro
git add -A
git commit -m "$(cat <<'EOF'
Release vX.Y.Z

<uma linha em inglês resumindo o que entra nesta versão>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git tag vX.Y.Z
```

## 5. Push

Confirme com o Geraldo antes (publicar é irreversível na prática). Depois:

```bash
git push && git push --tags
```

## 6. GitHub release

Gere as notas em **pt-BR** a partir dos commits desde a tag anterior:

```bash
git log --oneline <tag-anterior>..vX.Y.Z
```

Traduza/resuma em bullets de usuário (não cole o log cru). Estrutura sugerida:

```
<frase de contexto do que esta versão traz>

## Novidades
- <feature / correção em linguagem de usuário>
- ...

<nota final se for pré-1.0 ou tiver algo a avisar>
```

Publique (marque `--prerelease` enquanto for `0.x`, se o Geraldo preferir sinalizar
instabilidade — pergunte se não estiver claro):

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes "$(cat <<'EOF'
<notas em pt-BR>
EOF
)"
```

## Saída final

Reporte, conciso: nova versão, hash do commit, tag, e o **link do release**.
Se algum passo foi pulado (ex.: validação sem Chrome MCP), diga qual e por quê —
nunca reporte como concluído o que não rodou.
