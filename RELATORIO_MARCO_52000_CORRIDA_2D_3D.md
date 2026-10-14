# F1 Universe 2029 — Marco 52.000 | Câmeras integradas às corridas
Data: 2026-10-09

## Implementado
- Botões **2D TÁTICO**, **2.5D** e **3D BABYLON** na barra de visualização da corrida **real** (componente `LiveRace`/`LiveMap`), incluindo GP rápido e corrida do modo carreira, que utilizam o mesmo componente.
- O 2D tático SVG original permanece funcional, com modos de marcadores, zoom e timing.
- O 2.5D preserva a projeção isométrica SVG (`RaceScene3D`) do jogo, agora selecionável por botão dedicado.
- A cena 3D WebGL (`LiveRaceBabylon`) utiliza os mesmos snapshots interpolados de `presentRace`, incluindo circuito e trajeto dos boxes, posições, equipes e pilotos reais da corrida. A cena não calcula resultados, não produz carros fictícios, não chama `tickLive`, não modifica `RaceState` e não grava saves.
- Câmeras TV, aérea e onboard; seleção de carro, clima real da corrida, rodas animadas e quatro perfis de qualidade.
- Preferência visual armazenada apenas em `localStorage`, sem mudar o formato ou conteúdo do save. Retorna ao 2D em caso de erro WebGL ou indisponibilidade da biblioteca, com aviso acessível. Clean View preservado.
- Descarte de motor e cena ao desmontar o WebGL.

## Backup e integridade
- Original 51.000: `F1_UNIVERSE_2029_BABYLON_51000_CODIGO_FONTE.zip`. Preservado sem alterações.
- Backup adicional de antes da migração 3D: `F1_UNIVERSE_2029_BACKUP_51000_ANTES_DA_CORRIDA_3D.zip` (cópia byte a byte do ZIP 51.000).
- **64 arquivos WebP idênticos** entre o código 51.000 e 52.000, por caminhos e SHA-256.
- Não foi alterado nenhum módulo do domínio esportivo, do motor de corrida, de carreira, áudio ou persistência; mudanças nos componentes de visualização e arquivo de preferência.

## Testes efetivamente executados
- Novos testes de preferência de câmera (2/2), além dos testes existentes do adaptador: PASSARAM; a execução completa é contabilizada abaixo.
- A suíte completa de testes foi concluída nesta execução: **251/251 testes passaram, 0 falhas** (`F1_UNIVERSE_52000_TODOS_TESTES.log`, duração de aproximadamente 60 s).
- Browser QA Chromium com testes nas dimensões **1366×850** e **390×850**: renderização de GP rápido em 2D e 2.5D, botões e seleção, preservação da volta e fallback 3D forçado: PASSOU, sem exceções de JavaScript.
- Build alternativa desconectada: `OFFLINE_BUILD_OK modules=110` e check de sintaxe JavaScript: PASSOU.
- Fallback: foi testado com requisição Babylon.js deliberadamente bloqueada. A janela retorna ao 2D sem interromper a corrida.

## Limitações transparentes
- Este ambiente não resolve `registry.npmjs.org`. Por isso não instalou os arquivos binários de `@babylonjs/core` / `@babylonjs/loaders` e não executou o build Vite/Next oficial. O `package.json` inclui as dependências, mas a instalação e atualização do lockfile precisam ser feitas com npm e internet.
- A entrega Netlify é a compilação alternativa offline, usando React/vendor comprovados da 51.000, mais 110 módulos da fonte atual. O Babylon.js usa CDN **apenas como fallback nesse build**; o 3D WebGL não foi homologado graficamente neste ambiente. Não afirmar 3D aprovado até testá-lo num navegador com biblioteca acessível.
- O 3D utiliza carros geométricos de protótipo. A geometria das pistas é a geometria de apresentação existente (provisória, não levantamento oficial de traçados).
- F2/F3 no laboratório continuam demonstrações; esta mudança integra o renderizador aos GPs reais que já usam `LiveRace`, sem inventar resultados oficiais das categorias.

## Arquivos alterados/criados
- `src/features/live-race.tsx`: preferência gráfica e aviso fallback, ligação com modo carreira.
- `src/features/live-map.tsx`: seletor e passagem de snapshots para renderizadores.
- `src/features/live-race-babylon.tsx`: cena Babylon WebGL read-only e descarte.
- `src/presentation/race-view-preference.ts`: preferência isolada.
- `src/app/globals.css`: UI 3D, seletor, fallback e adaptações celulares.
- `tests/race-view-preference.test.ts`: novos testes de preferência e acesso seguro sem armazenamento.
- `scripts/test-offline.cjs`: executor auxiliar de testes quando o projeto está sem dependências locais.

## Instalação e publicação
**Teste imediato no Netlify**: publicar a raiz do ZIP `F1_UNIVERSE_2029_BABYLON_52000_TESTE_NETLIFY.zip` sem precisar compilar, abrir `Corrida rápida` > `Iniciar corrida rápida` ou uma corrida do modo carreira, e selecionar `2D TÁTICO`, `2.5D` ou `3D BABYLON` na barra da pista.

**Build oficial a partir da fonte quando houver internet**:
`npm install @babylonjs/core @babylonjs/loaders`
`npm run test`
`npm run build:netlify`

Em aparelhos sem WebGL ou onde a biblioteca for bloqueada, usar a opção 2D/2.5D. Preferências são locais ao navegador e não participam dos slots de carreira.
