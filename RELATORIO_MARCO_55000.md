# F1 Universe 2029 – Marco 55.000: 2.5D e velocidades reduzidas

Data: 2026-10-09
Base: Mobile 54.000, código-fonte original no ZIP F1_UNIVERSE_2029_MOBILE_54000_CODIGO_FONTE.zip
Backup: F1_UNIVERSE_2029_BACKUP_MOBILE_54000_PRE_55000.zip, SHA-256 **7b650b32efba1aec08650bc4241285db242a7a5aade7c2bc7c600505ed97f8ce** (idêntico ao original).

## Implementação

- 2.5D isométrico **dentro das corridas existentes**: carros SVG aprimorados com quatro pneus, rodas, asas dianteira e traseira, nariz, cockpit, halo, capacete e detalhes de carroceria. As peças respondem à orientação do carro na geometria da pista.
- Elevação e profundidade adicionais da pista, textura de asfalto por gradiente, sombra e faixa de barreira, árvores e quatro estruturas de arquibancada derivadas da pista do simulador. Sem mudanças na física esportiva.
- Controles isométricos continuam disponíveis e se reorganizam em telas móveis estreitas.
- Velocidades **0,50×** e **0,75×** nos seletores da corrida ao vivo e no menu de velocidade inicial da carreira, além das opções anteriores (1×, 2×, 4×, 8×, 16×, AUTO).
- Validação de estado da corrida e normalização das configurações passaram a aceitar 0,5 e 0,75. Cronometragem real da corrida e interpolação visual usam a mesma velocidade já existente, sem modificar resultados.
- Laboratório Babylon também passa a ciclar 0,5× / 0,75× / 1× / 2× / 4×.

## Código afetado

- `src/features/race-scene-3d.tsx`: desenhos 2.5D, cenário e profundidade. **Esta câmera é SVG isométrico, não o Babylon WebGL.**
- `src/features/live-race.tsx`: controles de velocidade da corrida.
- `src/features/career-hub.tsx`: velocidade inicial de carreira.
- `src/features/babylon-lab.tsx`: velocidade da demonstração.
- `src/domain/gameplay/types.ts`, `settings.ts`, `validation.ts`: velocidade e persistência.
- `src/app/globals.css`: responsividade.
- `tests/slow-motion-speed.test.ts`: novos testes.

## Validação executada

- `node scripts/qa-offline.mjs`: **254/254 testes aprovados** (inclusive os três novos testes de velocidades).
- `node scripts/verify-mobile.cjs`: **7/7 verificações estáticas de UI** aprovadas.
- `F1_BASELINE_STATIC=... node scripts/build-offline.mjs ...`: **110 módulos**, geração OK e sintaxe do JS aprovado via `node --check`.
- **64 WebP** preservados byte a byte com hashes; assets, dados, sons e código do motor `src/domain/simulation/` preservados.
- Chromium headless tentou abrir a página local, mas **não concluiu uma captura no tempo limite**. Portanto **sem homologação visual no navegador** nesta execução.
- O build para Netlify é **alternativo/offline**, apoiado no vendor do Marco 54.000; **não é build oficial Vite/Next**.
- Babylon.js 3D não foi alterado nem homologado visualmente nesta entrega. Continua com as limitações da versão 54.000, inclusive dependência de CDN na compilação offline.

## Teste no celular

Descompacte e publique o conteúdo de `F1_UNIVERSE_2029_2_5D_APRIMORADO_55000_NETLIFY.zip` no Netlify (pasta com `index.html` na raiz). Entre em **Corrida rápida** ou em corrida da carreira, selecione **2.5D** e escolha **0,50×** ou **0,75×** no seletor Velocidade. No desktop, os novos valores aparecem nos botões do HUD.

Para reverter, restaure o backup original: `F1_UNIVERSE_2029_BACKUP_MOBILE_54000_PRE_55000.zip`. Os novos estados com velocidade 0,5×/0,75× podem exigir ajuste de velocidade ao abrir em versões antigas, que só reconheciam velocidades >=1×.
