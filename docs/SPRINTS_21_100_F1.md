# F1 Universe 2029: Sprints 21 a 100

**Data:** 08/10/2026. **Escopo:** exclusivamente F1. **Arquivo de trabalho:** `/mnt/data/projetos_ativos/F1_UNIVERSE_2029`. **Nenhum ZIP foi criado.**

## Critério de transparência

As 80 sprints foram tratadas como **80 incrementos verificáveis**, agrupados em subsistemas. Algumas são funcionalidades novas, outras são integrações e casos de regressão específicos. O rótulo *Sprint 100* não significa que todos os recursos desejáveis para F2, carreira e animações estejam completos: a F2 continua simplificada, sem corrida tridimensional piloto a piloto, e a build de distribuição permanece pendente.

## Implementações centrais

**Sprints 21–39: Campeonato F2.** Motor de resultados determinísticos com grid próprio de até 24 jovens, 12 etapas ligadas ao calendário do F1 Universe, classificação, Sprint com 10 primeiras posições invertidas no grid, corrida principal, condições climáticas, pontuação própria, estatísticas de pilotos, comparação entre academias, página `/f2`, arquivo da pós-temporada e superlicença. Resultados futuros são ocultos até concluir o GP correspondente na F1; não há pontos F2 misturados com F1.

**Sprints 40–50: Ecossistema de jovens.** Chegada de 16 talentos independentes aos 48 de academia dos novos saves, transição dos três melhores da F3 para F2 na temporada seguinte, progressão de observação dos melhores da F2, perfil dos pilotos de base e compatibilidade com saves antigos de 48 jovens. Os 32 pilotos titulares da F1 e suas fotografias permanecem originais.

**Sprints 51–60: Câmera e mercado.** Câmera isométrica F1 com presets alto/baixo e giro automático opcional, pausado ao ocultar a página, desativado com preferência de movimento reduzido. F2 permite solicitar observação de jovem por US$ 0,25 milhão; cobrança repetida por piloto já plenamente observado foi corrigida. Gestão, saldo e identidade do piloto são validados.

**Sprints 61–75: Mundo vivo factual.** F2 ganha anúncio e mensagem de campeão ao fim da temporada, galeria de títulos, fatos reais de grid e chegada, radar de talentos da equipe na central da carreira, barra de pontos do jovem e acompanhamento de superlicença. Não são criadas notícias fictícias de corridas que não ocorreram.

**Sprints 76–100: Rivalidades, acompanhamento e integridade.** Comparação piloto-piloto em Sprint/Principal, posições ganhas ou perdidas, resultados completos de 24 carros, filtro de independentes corrigido, shortlist calculada sobre os 24 jovens e contratos efetivamente existentes, rivais entre academias, curva de posição de campeonato com critério correto de desempate, controles acessíveis e tratamento `prefers-reduced-motion`.

## Contratos importantes preservados

- Save schema v4 preservado, sem campo obrigatório novo nem conversão forçada dos saves antigos.
- As corridas F2 são uma simulação auxiliar de resultados, não um novo modo carreira controlável volta a volta; não usar a comunicação visual para sugerir o contrário.
- Notícias da F2 só são registradas quando o campeonato é arquivado na pós-temporada, uma vez.
- F3→F2 não confere automaticamente licença ou vaga no grid de 32 da F1.
- Fotografias dos 32 titulares: 64 WebP idênticos aos do ZIP-fonte corrigido original, conferidos por hash SHA-256.
- Pilotos juvenis procedurais usam ilustração original de personagem fictício; não reutilizam a fotografia de outro piloto real.

## Arquivos mais relevantes

- `src/domain/universe/formula-two.ts`, `src/domain/universe/seasons.ts`, `src/domain/universe/world.ts` (F2, base e pós-temporada).
- `src/domain/universe/market.ts` (observação sem cobrança indevida).
- `src/features/formula-two.tsx` (classificação, filtros, scouting, corrida, comparação, história).
- `src/features/career-hub.tsx` (novos talentos no dashboard).
- `src/features/profiles.tsx` (dossiês de jovens).
- `src/features/race-scene-3d.tsx`, `src/presentation/cinematic-camera.ts` (presets/giro da câmera F1).
- `src/presentation/feeder-career.ts` e `src/presentation/feeder-rivalry.ts` (seletores puros sem mutação).
- `src/app/globals.css` (estilo responsivo e transições com movimento reduzido).
- `tests/formula-two.test.ts`, `tests/cinematic-camera.test.ts`, `tests/feeder-career.test.ts`, `tests/feeder-rivalry.test.ts` (80 testes novos de Sprint 21–100).

## Validação

- **122 testes direcionados aprovados, zero falhas**, incluindo 80 testes numerados 21–100 e regressões existentes de fotos, persistência, etiquetas 3D, competição e dashboard; execução com `node --experimental-loader ../ts-loader.mjs --test ...`.
- **15 arquivos TS/TSX** relevantes inspecionados com `typescript.transpileModule`, **zero diagnósticos de sintaxe**; esse verificador não efetua typecheck completo.
- **64 WebP presentes, 0 ausentes, 0 alterados, 0 extras**, comparando SHA-256 à fonte corrigida.
- `npm run typecheck`: **bloqueado** em TS2688, definições `node`, `react`, `react-dom` ausentes.
- `npm run build:netlify`: **bloqueado**, comando `vite` indisponível no ambiente.
- Uma tentativa da suíte inteira excedeu o limite de execução; não foi tratada como aprovação integral.
- Não houve Playwright, screenshots, distribuição Netlify nova nem teste completo de várias temporadas neste ciclo.

## Pontos que ainda demandam engenharia depois da Sprint 100

1. Restaurar dependências Node/React/Vite com lockfile íntegro, executar typecheck, build e E2E real desktop/mobile.
2. Criar engine F2 corrida-a-corrida/volta-a-volta com desgaste, pneus, estratégia, Safety Car e apresentação realmente integrada ao simulador de corrida, sem reutilizar resultados de outro motor de forma enganosa.
3. Persistir resultados por etapa da F2 em saves novos de forma versionada; atualmente o campeonato deriva deterministicamente do estado do save, o que pode mudar após atributos mudarem durante a temporada.
4. Adicionar negociação e equipes próprias da F2, calendário/pilotos oficiais apenas com base verificável e regras apropriadas.
5. Testar equilíbrio estatístico em 2.000+ corridas, progressão 10+ temporadas, transições F3→F2→F1, performance e crescimento do histórico.
6. Rodar QA visual das animações e do layout em 390, 768, 1366 e 1920 px; ajustar responsividade com evidência real.

## 80 critérios de aceitação implementados

| Sprint | Verificação automatizada | Teste |
|---:|---|---|
| 21 | F2 opens 12 unique rounds derived from the saved F1 calendar | `tests/formula-two.test.ts` |
| 22 | grid has up to 24 distinct eligible F2 drivers and no F1 starter | `tests/formula-two.test.ts` |
| 23 | F2 remains empty before the corresponding F1 race; future results are hidden | `tests/formula-two.test.ts` |
| 24 | opening a race on a future circuit does not change saved driver points | `tests/formula-two.test.ts` |
| 25 | qualifying, Sprint reverse grid and main race all have unique positions | `tests/formula-two.test.ts` |
| 26 | a completed F1 weekend reveals one F2 event without F1 score changes | `tests/formula-two.test.ts` |
| 27 | future weekends do not unlock F2 rounds and no GP grid leakage | `tests/formula-two.test.ts` |
| 28 | F2 ranking obeys points, wins, podiums and unique ids | `tests/formula-two.test.ts` |
| 29 | license awards are capped and ineligible ranks cannot earn points | `tests/formula-two.test.ts` |
| 30 | scouting and license selectors use real driver registry | `tests/formula-two.test.ts` |
| 31 | full F2 at offseason records real points once and updates license | `tests/formula-two.test.ts` |
| 32 | archived save stays valid and preserves original pilot images data | `tests/formula-two.test.ts` |
| 33 | increasing F2 pool does not overwrite original drivers or break capacity | `tests/formula-two.test.ts` |
| 34 | different seeds produce distinct F2 race results, same seed stays stable | `tests/formula-two.test.ts` |
| 35 | academy standings reconcile with championship points | `tests/formula-two.test.ts` |
| 36 | per-driver evolution totals agree with awarded feature + Sprint points | `tests/formula-two.test.ts` |
| 37 | direct rival has a real score difference and is never the selected driver | `tests/formula-two.test.ts` |
| 38 | new game includes 16 additional independent young drivers without changing academy seats | `tests/formula-two.test.ts` |
| 39 | changing F2 results does not change stored GP winners, points or career settings | `tests/formula-two.test.ts` |
| 40 | best F3 talents advance to F2 at the offseason without entering F1 | `tests/formula-two.test.ts` |
| 41 | F3 podium gets priority for the F2 grid in the following year | `tests/formula-two.test.ts` |
| 42 | scouting gains from championship are not applied twice | `tests/formula-two.test.ts` |
| 43 | F2 weather is seeded from the circuit, not copied from F1 race state | `tests/formula-two.test.ts` |
| 44 | rain ability affects performance only under seeded wet conditions | `tests/formula-two.test.ts` |
| 45 | podium comes from real classified finishers, independent of F1 results | `tests/formula-two.test.ts` |
| 46 | F2 page and young driver profiles never need a real driver photo for fictional talent | `tests/formula-two.test.ts` |
| 47 | a legacy 48-academy-driver save still validates after the initial roster expands | `tests/formula-two.test.ts` |
| 48 | F2 championship presentation never changes market valuation or contract status | `tests/formula-two.test.ts` |
| 49 | newly added independent drivers have proper contracts and eligible market identities | `tests/formula-two.test.ts` |
| 50 | F2 lineup and results stay deterministic after JSON save roundtrip | `tests/formula-two.test.ts` |
| 51 | the camera tour advances at a controlled degree-per-second rate | `tests/cinematic-camera.test.ts` |
| 52 | large time gaps are clamped to avoid motion jumps | `tests/cinematic-camera.test.ts` |
| 53 | negative elapsed intervals never reverse camera movement | `tests/cinematic-camera.test.ts` |
| 54 | yaw wraps smoothly at 180 degrees | `tests/cinematic-camera.test.ts` |
| 55 | nonfinite camera readings safely reset instead of poisoning the render | `tests/cinematic-camera.test.ts` |
| 56 | cinematic angle presets remain within visible camera limits | `tests/cinematic-camera.test.ts` |
| 57 | active constructor can scout a junior directly from F2 | `tests/formula-two.test.ts` |
| 58 | fully scouted prospects cannot charge more money | `tests/formula-two.test.ts` |
| 59 | F2 observation cannot circumvent management permission | `tests/formula-two.test.ts` |
| 60 | observation with an empty budget is rejected and the save is not mutated | `tests/formula-two.test.ts` |
| 61 | academy watch is read-only and contains no future F2 finishes | `tests/feeder-career.test.ts` |
| 62 | academy watch displays only its own enrolled F2 pilots | `tests/feeder-career.test.ts` |
| 63 | academy watch takes the next unfinished round from the current calendar | `tests/feeder-career.test.ts` |
| 64 | academy watch reads superlicence eligibility from saved driver record | `tests/feeder-career.test.ts` |
| 65 | academy watch trend totals derive exclusively from completed F2 events | `tests/feeder-career.test.ts` |
| 66 | F2 race facts do not exist for future/unavailable event | `tests/feeder-career.test.ts` |
| 67 | feature race news identifies real winner and pole | `tests/feeder-career.test.ts` |
| 68 | sprint race news uses Sprint grid rather than Feature grid | `tests/feeder-career.test.ts` |
| 69 | biggest climber is a positive measured gain from grid to finish | `tests/feeder-career.test.ts` |
| 70 | distributed points equal all registered finishers and exclude DNFs | `tests/feeder-career.test.ts` |
| 71 | world news announces the archived F2 champion once at postseason | `tests/feeder-career.test.ts` |
| 72 | off-season F2 news does not insert the junior champion in F1 grid | `tests/feeder-career.test.ts` |
| 73 | F2 hall of fame is empty in newly created save | `tests/feeder-career.test.ts` |
| 74 | F2 hall of fame resolves real archived champions without synthetic historic events | `tests/feeder-career.test.ts` |
| 75 | archived F2 hall of fame survives save JSON roundtrip | `tests/feeder-career.test.ts` |
| 76 | cannot compare a driver with themself | `tests/feeder-rivalry.test.ts` |
| 77 | cannot compare non-entered pilots in an F2 race | `tests/feeder-rivalry.test.ts` |
| 78 | fresh F2 rivalry does not claim future race outcomes | `tests/feeder-rivalry.test.ts` |
| 79 | two F2 weekends yield exactly four head-to-head session results | `tests/feeder-rivalry.test.ts` |
| 80 | all compared race outcomes reconcile incl. double DNF | `tests/feeder-rivalry.test.ts` |
| 81 | duplicate event computation never changes rivalry totals | `tests/feeder-rivalry.test.ts` |
| 82 | grid movement zero is represented as unchanged | `tests/feeder-rivalry.test.ts` |
| 83 | positive grid movement is derived exactly from grid and finish | `tests/feeder-rivalry.test.ts` |
| 84 | negative grid movement displays positions lost | `tests/feeder-rivalry.test.ts` |
| 85 | a DNF is never misleadingly described as overtaking | `tests/feeder-rivalry.test.ts` |
| 86 | talent shortlist uses only actually entered existing young drivers | `tests/feeder-rivalry.test.ts` |
| 87 | talent shortlist obeys requested maximum | `tests/feeder-rivalry.test.ts` |
| 88 | shortlist rejects invalid or unbounded negative requested limits | `tests/feeder-rivalry.test.ts` |
| 89 | shortlist licenses are grounded in saved records and current league threshold | `tests/feeder-rivalry.test.ts` |
| 90 | scouting shortlist never edits contracts, finances or save state | `tests/feeder-rivalry.test.ts` |
| 91 | academy duel requires at least one entered driver from given academy | `tests/feeder-rivalry.test.ts` |
| 92 | academy rival is one of the two nearest positions in team championship | `tests/feeder-rivalry.test.ts` |
| 93 | academy duel gap is signed and based on real total points | `tests/feeder-rivalry.test.ts` |
| 94 | a rookie with no completed F2 GP has no fake season evolution | `tests/feeder-rivalry.test.ts` |
| 95 | completed round graph has exactly one point per completed F2 race weekend | `tests/feeder-rivalry.test.ts` |
| 96 | championship cumulative points can never decrease | `tests/feeder-rivalry.test.ts` |
| 97 | points gap to current F2 championship leader never becomes negative | `tests/feeder-rivalry.test.ts` |
| 98 | final cumulative F2 chart agrees with standings exactly | `tests/feeder-rivalry.test.ts` |
| 99 | graph dates are ordered and never repeat the same round | `tests/feeder-rivalry.test.ts` |
| 100 | F2 shortlist, duels, and chart remain deterministic after a validated JSON save roundtrip | `tests/feeder-rivalry.test.ts` |
