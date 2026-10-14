# F1 Universe 2029 · Entrega Babylon Marco 51.000 · 09/10/2026

## Base protegida
- Código-fonte de partida: F1_UNIVERSE_2029_BABYLON_LAB_FONTE.zip, extraído previamente no diretório F1_UNIVERSE_BABYLON_INTEGRACAO/F1_UNIVERSE_MARCO_50000.
- Backup prévio preservado sem sobrescrever: F1_UNIVERSE_2029_BACKUP_PRE_BABYLON_2026-10-09.zip.
- SHA-256 do backup: `bc8cc2ec934d787f0af8ed8e66253a8eb54cc995047ac9beed18648fc57ad6bb`.
- GitHub: `tetsssssss/f1`, ramificação já criada anteriormente `backup/pre-babylon-2026-10-09`. O GitHub armazena pacote Netlify de versão anterior; os novos ZIPs desta entrega não foram publicados no GitHub.
- Todas as 64 fotografias `.webp` em `public` preservadas com hash SHA-256 idêntico ao código de partida.

## O que foi implementado nesta entrega
- `src/presentation/race-render-adapter.ts`: adaptador puro de quadros visuais; preserva classificação e estado autoritativo da corrida e suaviza deslocamentos/ângulos, sem escrever no save.
- `src/presentation/race-render-types.ts`: contrato de tipos dos snapshots do `presentRace`.
- `src/features/babylon-lab.tsx`: modo 2.5D isométrico adicional ao 2D Canvas e Babylon.js 3D; controles de qualidade Baixo/Médio/Alto/Ultra, FPS, reiniciar demo e chuva cosmética, câmera e seleção de pilotos; adapter compartilhado. No 3D existem carros geométricos, pneus animados, pit buildings, asfalto, zebras, câmeras TV/aérea/onboard, fog e linhas de chuva em condições suportadas.
- `package.json`: dependências declaradas `@babylonjs/core` e `@babylonjs/loaders`, versão `^8.0.0`, com import modular lazy para build oficial. O carregador remoto anterior permanece como fallback na distribuição compilada offline.
- `tests/race-render-adapter.test.ts`: quatro testes novos sobre interpolação, preservação de classificação/estado, F2/F3 e mapeamento do motor.
- Nenhuma mudança no motor esportivo, fotos, regras, saves, sonoplastia ou layouts de carreira.

## Resultados executados e evidências
- `node scripts/qa-offline.mjs`: **249 aprovados, 0 falhas** (245 existentes + 4 novos). Logs completos em `F1_BABYLON_51000_TESTES_FINAIS.log` na distribuição.
- `node scripts/build-offline.mjs`: **108 módulos transpilados**, JS sintaticamente validado. **Isto NÃO é um build Vite nem Next oficial**, é o compilador alternativo offline já incluído no repositório. Log de compilação separado.
- Chromium headless Playwright: 1366x850 e 390x850, Canvas 2D e pseudo-3D isométrico executados, 32 carros F1/24 F2/24 F3, controles e JSON exportado, 0 exceções JS. Capturas reais anexadas.
- Chromium: quando WebGL Babylon não pode carregar do CDN, retorna automaticamente ao Canvas 2D sem erro JS. Resultado anotado em `F1_BABYLON_51000_WEBGL_FALLBACK.log`.
- 64 `.webp` com SHA-256 idêntico.

## Limitações importantes
- Registro npm e CDN do Babylon indisponíveis neste ambiente isolado. `npm install` não concluiu e, portanto, **não foi possível executar o Vite/Next build oficial nem validar uma cena Babylon WebGL 3D real**. A prévia 3D existe em código, mas precisa ser testada em navegador com rede. Na compilação Netlify offline, o Babylon é carregado pelo CDN quando o usuário clicar em 3D, com retorno ao 2D em caso de falha.
- O package-lock preexistente não foi resolvido/regerado nesta sessão (sem registry). **No ambiente de desenvolvimento com internet, executar `npm install` antes de build e versionar o package-lock atualizado.** `npm ci` pode falhar antes disso.
- F2/F3 usam elencos do jogo, mas as animações ainda são demonstrativas, não sessões oficiais do motor de corrida.
- O modo 2.5D implementado é projeção de Canvas com profundidade/sombra, não outra cena tridimensional WebGL. Para 3D real, selecionar Babylon.js 3D.
- O 3D usa carros geométricos simplificados; modelos licenciados GLB, pit stop detalhado, spray físico e integração ao modo carreira ainda exigem etapas adicionais.
- Não houve teste real em aparelhos Android, publicação Netlify ou validação de performance WebGL.

## Como testar AGORA o ZIP Netlify
1. Descompactar o ZIP Netlify ou publicar diretamente por drag-and-drop no Netlify. O `index.html` deve estar na raiz publicada.
2. Abrir `https://<site>/laboratorio-babylon`, ou navegar pelo menu lateral **Laboratório Babylon 2D/3D**.
3. Testar 2D Canvas, 2.5D isométrico, F1/F2/F3, pausa, seleção de piloto, chuva e reinício.
4. Para 3D, usar navegador com WebGL e acesso a `https://cdn.babylonjs.com/babylon.js`; selecionar **Babylon.js 3D**. Caso falhe, verificar a mensagem de erro e fallback 2D.

## Como fazer build OFICIAL a partir do código-fonte
```bash
npm install
npm run typecheck
npm test
npm run build:netlify
```
A saída do Vite estará em `dist-netlify/`. Este procedimento exige internet para baixar dependências e ainda precisa de homologação real.

## Arquivos de código alterados/criados
- package.json
- src/features/babylon-lab.tsx
- src/presentation/race-render-adapter.ts (novo)
- src/presentation/race-render-types.ts (novo)
- tests/race-render-adapter.test.ts (novo)
- RELATORIO_BABYLON_MARCO_51000.md (novo)

## Reversão
Extrair o backup pré-Babylon preservado e substituir a instalação experimental, ou voltar ao ramo Git `backup/pre-babylon-2026-10-09` sabendo que este ramo do GitHub espelha a versão antiga publicada no repositório, não o backup local da fonte recente.
