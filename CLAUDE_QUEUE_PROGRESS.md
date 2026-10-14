QUEUE: 2D RACE (fila 2, iniciada 06/10/2026)
CURRENT_TASK: 1-6 (código escrito em conjunto; falta validar)
STATUS: CODE_WRITTEN_NOT_VERIFIED (sessão interrompida por limite de uso)

VERIFICADO ATÉ AGORA:
- typecheck ok
- testes unitários 62/62 ok

NÃO FEITO AINDA (retomar aqui):
- npm run build (next) e build:netlify: NÃO rodados
- Nenhuma checagem visual no navegador (desktop 1920/1366, tablet, mobile 390, tela cheia)
- E2E não rodado e ainda com seletores antigos. Atualizar:
  - 'AMPLIAR CORRIDA' -> botão "Tela cheia do mapa"
  - TIMING agora abre compacto; clicar "TODOS" antes de esperar 32 linhas
  - 'Próxima volta' -> 'NEXT LAP'; 'Como está a bateria?' -> categoria BATTERY + 'Quanto falta de bateria?'
  - 'Reset câmera' -> 'AJUSTAR'; scripts/qa-2d.mjs usa os mesmos seletores antigos
- Testes unitários novos para map-markers.ts, strategy.ts, coreografia de disputa e rádio
- prettier nos arquivos .ts/.tsx alterados
- Pacote Netlify (releases/) não regenerado

ESCRITO POR TAREFA (sem validação visual):
- 1 Mapa: botão TELA CHEIA DO MAPA, HUD em tela cheia (mesma árvore, sem portal), fit-to-track com margem 18,
  circuito girado 90° em telas altas, Zoom +/-/AJUSTAR/SEGUIR/FECHAR, pinch, largada em fileiras, câmera de abertura
- 2 Híbrido: CARROS / FOTOS / HÍBRIDO / COMPACTO / AUTO (padrão AUTO), níveis por zoom e densidade, mini painel no clique
- 3 HUD: topo compacto, timing TOP/TODOS/oculto, faixa do piloto + 5 comandos, piloto ativo, drawers, toasts, CLEAN VIEW
- 4 Estratégia: painel no PIT com BOX NOW / NEXT LAP / STAY OUT / CANCEL, duração por pneu, exato/estimado/intervalos
- 5 Ultrapassagens: coreografia lateral lida de eventos e batalhas do motor (presentRace), sem física
- 6 Rádio: 7 categorias, perguntas e ordens com dados reais do RaceState, foto, histórico de 5 mensagens

FILES_CHANGED:
- src/features/live-map.tsx, live-race.tsx, race-command-card.tsx
- src/presentation/map-markers.ts (novo), strategy.ts (novo), race-presentation.ts, race-camera.ts, circuit-geometry.ts
- src/domain/gameplay/commands.ts (só rádio: catálogo e textos; RaceEngine intocado)
- src/app/globals.css (CSS antigo da corrida removido, bloco "Race HUD v3" no fim)

REGRAS DA FILA:
- Não refazer o RaceEngine; não alterar grid, resultados, calendário, carreira, contratos.

FILA ANTERIOR (1-9): concluída em 06/10/2026.
