# F1 Universe 2029 | Marco 57.000: conexão dos GLBs ao Babylon e pistas 3D

## Resultado produzido

**Código-fonte realmente modificado** a partir da versão 55.000 disponível no projeto. As alterações concentram-se em `src/features/live-race-babylon.tsx` e `src/features/live-map.tsx`. O motor de corrida e os dados esportivos não foram alterados.

- Adicionado `teamIds` ao renderizador Babylon: o ID original de cada piloto é convertido para uma das 16 construtoras do cadastro, sem adivinhação por cor.
- As 16 construtoras passam a ter duas variantes GLB (`_mobile` e `_high`), importadas sob demanda com cache de AssetContainer por construtora/qualidade e instanciamento por carro. O carro geométrico original permanece como reserva em caso de falha.
- As 35 etapas do calendário passam a contar com arquivos GLB de circuito, gerados a partir dos pontos da geometria **procedural provisória** existente no jogo (`circuitGeometry`). Cada arquivo contém pista, pit lane, zebras, linha de largada, barreiras e cenário básico. Não são levantamentos cartográficos reais de cada autódromo.
- Largura renderizada da pista: **1,15 × a largura 3D anterior** (meia-largura 1,36 → 1,564 unidades, aproximadamente). Esta é uma diferença **exclusivamente visual**, sem alterar física, tempo de volta, regras ou resultados.
- O giro de tela vertical (`quarterTurn`) é aplicado também ao modelo de circuito, para acompanhar o mesmo mapa no celular.
- O GLB é carregado de `public/assets/f1-3d`, com retorno a geometria procedural caso falhe; bibliotecas Babylon são preferencialmente importadas do npm, com CDN como contingência somente na compilação offline.
- Incluído `tools/blender/GERAR_BLEND_CARROS_E_CIRCUITOS.py` para converter os 16 carros e 35 circuitos em projetos `.blend` editáveis **quando executado numa instalação Blender 4.x**. Este ambiente não tem `bpy`/Blender, então nenhum arquivo `.blend` foi executado/salvo aqui.
- Fontes do mapa em JSON, script de exportação do mapa TS e gerador de pistas em GLB foram incluídos para permitir reedição.

## Verificações efetivamente executadas

- `node scripts/verify-3d-assets.mjs`: **67 GLBs íntegros**, 16 construtoras, 35 circuitos, largura 1,15.
- Reimportação com trimesh dos **67 GLBs**: 67/67 lidos, sem erro na geometria, total de 275436 triângulos somando todos os modelos e pistas.
- `node scripts/verify-mobile.cjs`: **7 verificações estáticas aprovadas**.
- `QA_TIMEOUT=25000 node scripts/qa-offline.mjs race-render-adapter race-view-preference track-order`: **9 testes direcionados aprovados**.
- Build estático alternativo: `OFFLINE_BUILD_OK`, compilou **110 módulos**; `node --check` aprovou a sintaxe da aplicação compilada.
- Integridade comparada com ZIP 55.000: **64/64 fotos WebP idênticas**, arquivos em `src/domain` (36), `src/data` (10) e `src/audio` (1) idênticos.

## Limites e pendências

- A instalação npm (`npm ci --offline`) falhou porque `@babylonjs/core` não está em cache. Por isso, **a build oficial Vite/Next com Babylon empacotado não foi executada aqui**.
- O ZIP Netlify entregue utiliza o construtor estático alternativo do projeto, com Babylon.js e carregador glTF por CDN como alternativa. O código-fonte mantém as dependências declaradas para compilação oficial.
- A validação de cena WebGL 3D **não foi realizada**: o Chromium Playwright não está instalado no ambiente. O comportamento visual e o desempenho/FPS precisam ser verificados no navegador do usuário depois do deploy.
- A suíte completa de domínio excedeu o limite de execução nessa rodada; não é correto afirmar que passou inteira. Os 9 testes direcionados passaram.
- Como os mapas originais são procedurais e provisórios, a aparência de um circuito conhecido **não é uma réplica topográfica ou oficial**. Para fidelidade real, precisaremos substituir os pontos por dados vetoriais verificados/licenciados.

## Usar no Netlify

Publicar o conteúdo do ZIP Netlify, cujo `index.html` fica na raiz. No jogo, iniciar corrida rápida ou uma etapa do modo carreira e selecionar `3D BABYLON`. O carregamento baixa somente o circuito atual e os GLBs das equipes. Em aparelhos com desempenho menor selecionar qualidade **Baixa** ou **Média**, que usam os carros `_mobile.glb`.

Para build oficial a partir do fonte, em computador com rede:

```bash
npm ci
npm run test
npm run build:netlify
```

No Blender 4.x instalado:

```bash
blender --background --python tools/blender/GERAR_BLEND_CARROS_E_CIRCUITOS.py
```

Os projetos resultantes ficam em `tools/blender/blend_output/` (16 carros e 35 circuitos).

## Arquivos-base

- `src/features/live-race-babylon.tsx`
- `src/features/live-map.tsx`
- `public/assets/f1-3d/cars/*.glb`
- `public/assets/f1-3d/tracks/*.glb`
- `tools/circuit-maps/gp-*.json`
- `tools/blender/GERAR_BLEND_CARROS_E_CIRCUITOS.py`
- `scripts/verify-3d-assets.mjs`

**Backup:** `F1_UNIVERSE_2029_2_5D_APRIMORADO_55000_FONTE.zip` permanece intacto.
