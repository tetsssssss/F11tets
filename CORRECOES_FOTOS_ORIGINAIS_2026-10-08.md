# F1 Universe 2029: correções e fotografias originais

Versão de correção sobre `F1_UNIVERSE_2029_SOURCE_2D3D.zip`, 08/10/2026.

## Fotografias

- PRESERVADAS as 32 fotos reais originais dos pilotos titulares, com cards 512×512 e masters, sem trocar retratos por desenhos.
- PRESERVADOS os arquivos `src/data/photo-manifest.json`, `public/assets/people/drivers/*`, `assets/photos/*` e a relação original `PHOTO_SOURCES.json`.
- Verificação automática adicionada em `tests/photos-original.test.ts` para proteger existência, status e distinção dos retratos.
- Engenheiros e pilotos procedurais fictícios continuam com retratos ficcionais para não associar a eles rostos de pessoas reais.
- As restrições de distribuição de 29 fotografias continuam não verificadas. Este pacote preserva o projeto para uso pessoal, sem declarar licenças inexistentes.

## Mudanças técnicas

- `src/presentation/race-tag-layout.ts`: layout determinístico de identificação dos carros isométricos, com prioridade para carro selecionado, carro do usuário, líderes e batalhas; evita etiquetas sobrepostas sem alterar posições reais.
- `src/features/race-scene-3d.tsx`: integração do layout e conectores visuais, preservando clique e acesso por teclado.
- `src/features/live-map.tsx`: botão com texto claro "3D ISOMÉTRICO".
- `src/features/live-race.tsx` e `src/features/quick-race.tsx`: rótulos e CTAs da Corrida Rápida não sugerem pontuação na carreira, nem abrem o campeonato; preserva o save efêmero.
- `tests/race-tag-layout.test.ts`: cenários de grid de 32 carros, mobile, determinismo e preservação do estado esportivo.

## Limitações e continuação

- Não foram feitas alterações no schema de saves, cálculos físicos, resultados, contratos, IA ou calendário.
- Testes integrais do Next.js / Vite e E2E exigem instalação das dependências. Caso `npm ci` esteja disponível: rodar `npm run typecheck`, `npm test`, `npm run build:netlify`, `npm run test:e2e` e `npm run audit:photos`.
- O pacote Netlify restaurado é a versão compilada do hotfix de interface com fotografias originais reintegradas, não uma build recompilada destes arquivos TSX, pois não foi possível instalar o Vite 8.3.3 no ambiente atual.
