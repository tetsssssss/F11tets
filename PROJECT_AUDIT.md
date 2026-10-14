# Auditoria inicial — 02/10/2026

Base auditada: `9713d75`. Auditoria concluída antes da implementação desta fase.

- Servidor de produção executado na porta 3029; **94 rotas** (14 principais + 80 fichas) abertas no Chromium, HTTP 200, sem erros JavaScript. Evidência: `docs/initial-route-audit.json`.
- TypeScript aprovado. 16 testes de domínio e 16 E2E aprovados; navegação, import/export, reset e responsividade desktop/Android emulado exercitados.
- 49 exports de componentes/features revisados. Sem duplicação de definições; há dependência repetida de fixtures estáticas e fórmulas de P&D/telemetria dentro das telas.

| Sistema                               | Estado inicial                    | Constatação                                                                                            |
| ------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Interface, rotas, filtros, showroom   | Funcional                         | Links, grupos, hotspots e gaveta móvel operantes                                                       |
| Grid / atributos                      | Parcial                           | Roster completo; atributos editoriais centralizados, porém quase todos ignorados pelo motor            |
| Estado global                         | Parcial                           | Context único para pontos/sessões; entidades permanecem importadas como fixtures imutáveis pelas telas |
| Save/load                             | Funcional na v1                   | Replay valida resultados; localStorage não suporta histórico detalhado de corridas longas              |
| Temporada GP1–35                      | Parcial                           | Oito sessões, pontos e avanço funcionam; não existe pós-temporada/2030                                 |
| Qualificação / Sprint                 | Parcial                           | Cortes e blocos corretos; sem pneus, tráfego, clima ou energia reais                                   |
| Performance                           | Mock                              | `overall piloto * .52 + overall equipe * .48 + RNG`                                                    |
| Pneus / bateria / clima / setups      | Mock                              | Campos fixos ou números ilustrativos da UI; não influenciam resultado                                  |
| Relações / progressão / engenheiros   | Mock                              | Ratings exibidos, sem evolução ou comportamento emergente                                              |
| Corrida 2D                            | Mock                              | Ordem final fixa; marcadores e telemetria decorativos                                                  |
| P&D                                   | Parcial                           | Reserva e progresso demonstrativos; portfólio compartilhado e upgrades sem efeito                      |
| Mercado / contratos                   | Inexistente                       | Catálogo de fornecedores sem transações                                                                |
| Finanças / IA / ATR                   | Inexistente                       | Orçamento fixo, sem ledger, prêmio P16 ou decisões independentes                                       |
| Incidentes / danos / penalidades / SC | Inexistente                       | Não modelados                                                                                          |
| Estatísticas                          | Parcial                           | Contagem básica de resultados; sem DNFs, ultrapassagens, médias ou arquivo anual                       |
| Notícias / entrevistas / reputação    | Mock / inexistente                | Notícias de pré-temporada fixas; sem consequências esportivas                                          |
| Quebrado                              | Nenhum erro de execução observado | A principal lacuna é semântica: dados decorativos apresentados como possibilidades futuras             |

## Decisão de implementação

Manter Next/React, design system, rotas e módulos existentes. Evoluir `domain` com núcleo modular, GameState versionado, migração v1 sem apagar resultados, persistência IndexedDB e telemetria produzida pela simulação. Fórmulas esportivas passam ao domínio. Fixtures continuam sendo apenas condições iniciais do universo fictício.

O anexo recebido termina no item 51, em “5 derrotas para”. Storylines usarão detecção de três vitórias consecutivas e cinco derrotas consecutivas para o companheiro, além de eventos de corrida. Não houve tabela anterior de premiação P1–15; será definida uma escala editável, preservando P16 = US$14M.
