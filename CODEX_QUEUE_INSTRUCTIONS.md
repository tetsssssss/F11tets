# INSTRUÇÕES PARA O CODEX — FILA 2D RACE (07/10/2026)

Leia primeiro `CLAUDE_QUEUE_PROGRESS.md` (estado da fila) e `NEXT_AGENT_HANDOFF.md` (arquitetura).
Este ZIP é o código-fonte, sem `node_modules`. Rode `npm install` antes de tudo.

## Estado

As seis tarefas da fila estão **escritas, mas não validadas**:

1. Mapa 2D em tela cheia, fit-to-track, largada com 32 carros
2. Modo híbrido de leitura (CARROS / FOTOS / HÍBRIDO / COMPACTO / AUTO)
3. Redesign da HUD de corrida
4. Painel de estratégia
5. Ultrapassagens 2D (representação)
6. Rádio de corrida

Verificado: `npm run typecheck` ok, `npm test` 62/62.
Não verificado: build, navegador, E2E. O layout foi reescrito sem checagem visual; espere ajustes de CSS.

## Regras (não quebrar)

- NÃO refazer o RaceEngine (`src/domain/simulation/race.ts`).
- NÃO alterar grid, resultados, calendário, carreira, contratos.
- Só apresentação, câmera, escala, legibilidade, HUD, rádio por templates (sem IA externa).
- Não recriar o projeto nem resetar o checkout. Não iniciar funcionalidades novas.
- Ao fim de cada etapa: typecheck + build e atualizar `CLAUDE_QUEUE_PROGRESS.md`.

## O que fazer, em ordem

1. `npm install`, `npm run typecheck`, `npm test`, `npm run build`. Corrigir o que quebrar.
2. Abrir a corrida e conferir visualmente. Atalho: `F1_ENABLE_DEV=1 npm run start` e `/dev/race-2d`
   (cenários: 32-car-start, close-battle, rain, safety-car, double-stack, crash, last-lap).
   Telas: 1920x1080, 1366x768, tablet, mobile 390px; inline e tela cheia; timing aberto e fechado;
   cada modo de marcador; zoom mínimo e máximo; CLEAN VIEW; modo construtor (dois carros).
3. Critérios: a pista é a primeira coisa na tela; mapa ~85–90% da área em tela cheia; largada legível;
   batalha identificável; os cinco comandos sempre acessíveis; nenhum overflow horizontal.
4. Atualizar os E2E (`tests/e2e/*.spec.ts`) e `scripts/qa-2d.mjs` para a UI nova:
   - `AMPLIAR CORRIDA` -> botão com aria-label `Tela cheia do mapa`
   - TIMING abre compacto: clicar `TODOS` antes de esperar 32 linhas em `.theater-timing li`
   - `Próxima volta` -> `NEXT LAP` (painel aberto pelo botão PIT)
   - `Como está a bateria?` -> abrir RÁDIO, categoria `BATTERY`, botão `Quanto falta de bateria?`
   - `Reset câmera` -> `AJUSTAR`
   - abas `MAPA 2D / ESTRATÉGIA` não existem mais; `3D LEVE` é um botão da barra do mapa
   - modo padrão do mapa agora é AUTO (antes CARROS)
5. Escrever testes unitários para `map-markers.ts` (planMarkers, fanOut), `strategy.ts`
   (exato / estimado / intervalos), coreografia de disputa em `presentRace` (campo `duel`) e o rádio novo.
   Todos devem provar que RaceState não é mutado.
6. `npx prettier --write` nos arquivos alterados, `npm run build`, `npm run build:netlify`,
   regenerar o ZIP do Netlify (`scripts/package-netlify.ps1`).
7. Listar só: arquivos alterados, mudanças de layout, regressões corrigidas.

## Onde está cada coisa

- `src/features/live-race.tsx` — HUD: topo, palco, timing tower, dock, tela cheia (classe `is-full`,
  mesma árvore, sem portal), CLEAN VIEW.
- `src/features/live-map.tsx` — canvas SVG, barra de visualização, marcadores (CarMarker, TileMarker,
  PhotoMarker), câmera, pinch/zoom, toasts, cartão de batalha, mini painel do piloto.
- `src/features/race-command-card.tsx` — faixa do piloto, cinco comandos, drawer
  (ESTRATÉGIA / RÁDIO / TELEMETRIA / INCIDENTES / CLIMA).
- `src/presentation/map-markers.ts` — níveis por zoom e densidade, layout em fileiras.
- `src/presentation/strategy.ts` — leitura de estratégia (somente leitura).
- `src/presentation/race-presentation.ts` — `presentRace` com coreografia de disputa (`duel`).
- `src/presentation/race-camera.ts` — câmera de largada enquadrando o pelotão.
- `src/presentation/circuit-geometry.ts` — `quarterTurn` (circuito girado em telas altas), `trackLength`.
- `src/domain/gameplay/commands.ts` — `radioCatalog`, `RADIO_CATEGORIES`, respostas contextuais.
- `src/app/globals.css` — bloco "Race HUD v3" no fim; o CSS antigo da corrida foi removido.

## Ambiente (Windows)

- Sem Python; usar Node para scripts.
- E2E usa `next start` na porta 3029 com `reuseExistingServer`: após `npm run build`, matar o servidor antigo.
- Rodar o E2E reescreve PNGs em `docs/screenshots/`.
