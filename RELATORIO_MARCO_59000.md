# F1 Universe 2029 — Marco 59.000: Race Control + PWA Android

Data de preparação: 12/10/2026.

## 1. Bases usadas e limites de proveniência
- Fonte editável mais recente disponível: `F1_UNIVERSE_2029_BABYLON_57000_CODIGO_FONTE.zip` (TypeScript/React/Next/Vite).
- Base de mídia/vendor e build para Netlify: `F1_UNIVERSE_2029_MARCO_58300_NETLIFY.zip` (contém 149 entradas, **somente arquivos compilados**, não contém TS/TSX editáveis).
- O artefato 59.000 inclui **novos módulos de código** sobre a fonte 57.000 e mantém os assets do Netlify 58.300. Não é possível demonstrar equivalência de mudanças de código desconhecidas que só existiram no build 58.300.
- Backup da versão 58.300 preservado em arquivo ZIP separado. O original não foi alterado.

## 2. Implementado nesta rodada
- `src/features/race-control.tsx`: painel **real** na tela de corrida do modo carreira / corrida rápida com abas Momento, GAP, Pneus, Voltas, Posições, Estratégia, Clima e Telemetria. Lê `race.cars`, `race.events`, `race.pitCalls`, `race.commands`, `race.weather`, `race.frames` e bateria da carreira. Sem dados fictícios, não altera o motor de simulação.
- `src/features/live-race.tsx`: incorpora RaceControl à corrida, sem duplicar motor e sem reiniciar a simulação ao trocar abas. Mantém modo 2D, 2.5D, 3D e controle de velocidade existentes.
- `src/app/globals.css`: abas roláveis, tabelas legíveis e painel de dados recolhível, layout responsivo para viewport estreita. No celular inicia recolhido para não roubar espaço da pista; quando expandido, a pista permanece em seção separada.
- `public/manifest.webmanifest`, `public/sw.js`, ícones PNG 192/512, `public/assets/pwa-install.js` e `pwa-style.css`: PWA instalável em Chrome Android, após servir o app via HTTPS (Netlify). O service worker armazena somente assets estáticos. Saves continuam no armazenamento já usado pelo aplicativo.
- `netlify/index.html` adaptado ao PWA e `INSTALAR_NO_XIAOMI_59000.md` com orientações.

## 3. Pré-existentes preservados
- Modos 2D, 2.5D e Babylon.js 3D; fallback 2D; controle de velocidades 0,50× e 0,75×; 16 construtoras / 32 GLBs de carros; 35 GLBs de pistas.
- 64 fotos WebP: hashes SHA-256 iguais ao ZIP 57.000 e ao build 58.300.
- Arquivos de domínio esportivo, dados e áudio **não foram editados** nesta rodada.

## 4. Verificações realizadas
- `node scripts/build-offline.mjs` com `F1_BASELINE_STATIC=...58300_NETLIFY.zip`: **concluído**, 111 módulos de origem. Esta compilação é alternativa, **não** é `vite build` nem `next build` oficial.
- `node --check` no bundle produzido, bootstrap, script PWA e service worker: **aprovado**.
- `node scripts/verify-mobile.cjs`: **7/7 verificações estáticas aprovadas**.
- `node scripts/qa-marco-59000.cjs`: **10/10 verificações estáticas aprovadas**.
- Integridade: **64/64 WebP idênticos**; **67 GLB** presentes e cabeçalho `glTF` confirmado.
- `npm ci --offline`: **bloqueado**, pacote `@babylonjs/core` não está no cache do npm.
- Browser: Chromium local / Playwright não iniciou corretamente (timeout de Chromium / ausência de browser headless instalado), logo **não foi possível homologar interface renderizada, navegabilidade, execução WebGL, FPS, Android real ou instalabilidade PWA**.
- Suite completa `npm test` e `npm run typecheck`: **não executadas** por ausência das dependências e da instalação npm concluída. Os 17 checks acima são estáticos, não equivalem a testes end-to-end.

## 5. Limitações pendentes antes de produção
1. Testar o Race Control em corrida rápida e carreira, troca de 8 abas, telas 393×873 e 1366×768, com console JS limpo.
2. Validar WebGL real Babylon.js e 32 carros em dispositivo compatível; instalar dependências locais e executar build oficial.
3. Testar instalação real do PWA em Xiaomi (Android Chrome / HyperOS) e persistência dos saves após reabrir; APK nativo **não** foi gerado.
4. Melhorias adicionais de malhas GLB, suspensão, animações, câmeras e 2.5D (tarefas do Linear TET-13 a TET-15) continuam pendentes. Esta rodada priorizou HUD real, mobile e entrega instalável.
5. Recuperar a fonte exata do Marco 58.300 para evitar diferenças entre builds e fonte.

## 6. Publicação
1. Extraia `F1_UNIVERSE_2029_MARCO_59000_NETLIFY_PWA.zip` e publique a pasta com `index.html` na raiz em **Netlify**.
2. Abra o endereço HTTPS gerado, entre em corrida rápida ou corrida da carreira e abra **Race Control** abaixo da pista.
3. No Xiaomi, use Chrome > menu ⋮ > **Adicionar à tela inicial / Instalar aplicativo**, ou botão de instalação quando oferecido.
4. Não limpe dados do site sem exportar saves; o PWA não é um backup em nuvem.

## 7. Reversão
Publique novamente o ZIP de backup original `F1_UNIVERSE_2029_BACKUP_PRE_59000_NETLIFY.zip`. Não misture diretórios de duas compilações. Saves devem ser exportados antes de mudanças de domínio/origem.
