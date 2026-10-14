# QA execution evidence, 08/10/2026

## Automated directed tests

All were executed with the Node.js 22 local TypeScript loader (strip/transpile), because `tsx` and React/Node typings are unavailable in this environment:

| Test file | Passed | Failed |
|---|---:|---:|
| `persistence.test.ts` | 6 | 0 |
| `race-tag-layout.test.ts` | 2 | 0 |
| `photos-original.test.ts` | 1 | 0 |
| `season-pulse.test.ts` | 4 | 0 |
| `camera.test.ts` | 4 | 0 |
| `race-feed.test.ts` | 4 | 0 |
| `save-writer.test.ts` | 5 | 0 |
| `calendar-boundary.test.ts` | 1 | 0 |
| **Total** | **27** | **0** |

143 TypeScript / TSX / mjs source and test files traversed and transpiled; 0 TypeScript syntax diagnostics. Transpilation is not full typechecking.

## 2,000 Monte Carlo synthetic runs

- Race type: Formula 1 GP engine, seeded sequential universes, 8 laps per race, not the full-distance Championship.
- Completed: **2000/2000**; runtime **26.69s**.
- Unique winners: **5**, Max Verstappen **1486**, Lando Norris **230**, Kimi Antonelli **149**, Oscar Piastri **134**, Alex Palou **1**.
- DNFs: **162**. Overtake event records: **323975**, unusually high and flagged for future physics/balance audit; this is not evidence of realistic racing.
- Same seed reproduced the same first GP result.

## Actual season soak test

Three consecutive years from the existing 2029 rules with the real `runNextSession` path, engine results, offseason and JSON save re-validation after each season. World settings used `telemetry=summary`:

| Completed year | Sessions | GPs | Archived seasons | JSON size (bytes) |
|---|---:|---:|---:|---:|
| 2029 | 280 | 35 | 1 | 14,185,019 |
| 2030 | 560 | 70 | 2 | 26,892,982 |
| 2031 | 840 | 105 | 3 | 39,364,833 |

All three years passed, runtime 115.35 seconds. This is not a ten-season soak; the remaining seven years need testing.

## Blockers

`npm ci --offline` failed `ENOTCACHED` for `vite-8.3.3`. Online `npm ci` failed package fetches `EAI_AGAIN`. `npm run typecheck` reports missing Node/React/React-DOM declaration libraries. A newly generated Next/Vite/Netlify build, E2E browser tests, real visual review and exhaustive suite are NOT validated. The output ZIP is source code, not a deployable new static build.

## Images

The 64 real WebP files of the original 32 F1 pilots were compared to `F1_UNIVERSE_2029_FONTE_CORRIGIDO_FOTOS_REAIS.zip` using SHA-256; all match byte-for-byte.
