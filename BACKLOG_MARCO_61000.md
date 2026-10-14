# Backlog — Marco 61000

Rótulo **MARCO 61000** = marco visual estrutural sobre o baseline 60300. Não significa 61.000 tarefas concluídas.
Evidência de cada item: `QA_MARCO_61000.json` e `RELATORIO_VISUAL_MARCO_61000.md`.

## Concluído (COMPLETED)
| Sprint | Tarefa | Evidência |
|---|---|---|
| 01 | Cockpit de uma tela em retrato e paisagem; sem rolagem horizontal em 7 viewports; PIT dentro da tela; Race Control/TIMING recolhidos por padrão em telas curtas; menu lateral vira gaveta em paisagem de celular | `docs/qa-shots/after/*`, `tests/e2e/race-views.spec.ts` |
| 02 | Diretor de câmeras Babylon (Auto/TV/Disputa/Seguir/Estratégica/Box/Onboard), suavização exponencial independente de FPS em posição, alvo e FOV, enquadramento de 2–4 carros, antecipação de curva, cortes com fade, âncoras alternativas contra obstrução, câmera manual preservada até AUTO | `tests/broadcast-director.test.ts`, `scripts/qa-babylon-camera.mjs`, `docs/qa-shots/camera/*` |
| 03 | Carros legíveis sem alterar geometria: câmeras mais próximas, tags de piloto sem sobreposição (`layoutRaceTags`), retângulos projetados + `progress/elapsed/laneOffset` em `window.__f1Babylon` | relatório §Sprint 03 |
| 04 | Pivôs de roda nos GLB (giro pela distância percorrida, esterço ≤ 18° pela curvatura), sombra de contato, vibração só em poses WIDE/LOCKUP/incidente, animações essenciais desligadas em pausa/reduced-motion, reconstrução segura ao trocar perfil mobile↔high | `tests/broadcast-director.test.ts` |
| 05 | Cenário por perfil nos 35 circuitos: 11 looks, 16 adereços em *thin instances* (1/2/4 chunks), marcos estilizados nos reais (Fuji, Suzuka, Las Vegas, Mônaco, Spa, Red Bull Ring…), paisagens amplas (chão 2,3×) nos criados; fade real de arquibancadas/boxes | `tests/scenery-plan.test.ts`, `docs/qa-shots/scenery-all/*` |
| 06 | Chip de status do box (chamada real do motor + estágio de apresentação, sem duração inventada), mecânicos 4–12 por perfil, testes de now/next/cancel/compostos/duas chamadas | `tests/pit-workflow.test.ts` |
| 07 | Um único controlador DPR/perfil, AUTO-QUALIDADE opcional com consentimento e carência, perda de contexto WebGL → 2D, materiais memoizados, `dispose` revisado, cache do PWA 61000 | `tests/babylon-quality.test.ts`, `tests/pwa-update.test.ts` |
| 08 | Paridade de estado (hash) com e sem renderização, e2e de troca 2D→2.5D→3D→2D, rotação, reduced-motion, sem WebGL | `tests/visual-parity.test.ts`, `tests/e2e/race-views.spec.ts` |
| 09 | Pacotes Netlify PWA e código-fonte, relatório, guia Android, QA JSON | este diretório |

## Bloqueado / não feito (BLOCKED / PENDING)
| Item | Motivo |
|---|---|
| Benchmark de 2 min em Xiaomi real (FPS p50/p95, memória) | Sem aparelho Android no ambiente de execução. Os números do QA são de renderização por software e **não** comprovam 30 FPS em celular. |
| 13 specs E2E antigas falham (iguais ao baseline 60300) | Seletores desatualizados em testes anteriores a este marco (ex.: nomes de botões e contagem de links). Não foram alterados para não mascarar regressão; precisam de revisão própria. |
| Marcos posicionados por mapa real (traçado verificado) e arte detalhada por circuito | As geometrias são “provisional”; os marcos são estilizados e posicionados por progresso de volta. |
| Animação de troca de pneus/macaco em etapas | O motor não modela duração de parada; apenas movimento procedural dos mecânicos. |
| Cor do composto no pneu GLB | Os GLB não distinguem composto; o composto aparece no HUD e no chip. |
| LOD por distância no cenário | Culling por frustum em 4 chunks implementado; LOD fino não medido. |

## Próximos marcos sugeridos
1. Rodar `scripts/qa-babylon-camera.mjs` e um benchmark de 2 minutos em Xiaomi real e anexar os números ao `QA_MARCO_61000.json`.
2. Reescrever as 13 specs E2E antigas contra a UI atual.
3. Geometria verificada de circuitos + marcos visuais por circuito.
4. Clips de vídeo de 15–30 s das câmeras em aparelho real.
