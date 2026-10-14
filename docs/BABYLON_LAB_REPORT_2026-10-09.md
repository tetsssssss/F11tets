# F1 Universe 2029 · Laboratório Babylon 2D/3D (09/10/2026)

## Objetivo e limites
Implementação experimental em uma rota separada (`/laboratorio-babylon`), preservando a aplicação anterior. O modo 2D usa Canvas; o modo 3D é código real da API de Babylon.js, carregado **sob demanda** de `https://cdn.babylonjs.com/babylon.js` e requer rede, navegador com WebGL e acesso ao CDN. Neste ambiente isolado o arquivo externo não pôde ser obtido: **3D não foi executado nem validado visualmente**. Se o CDN falhar, o laboratório retorna ao modo 2D. Não declarar o 3D homologado ou comparar FPS não medidos.

## Base do código e backup
- Base: `F1_UNIVERSE_2029_SONOPLASTIA_FONTE.zip`.
- Backup local com os mesmos bytes: `F1_UNIVERSE_2029_BACKUP_PRE_BABYLON_2026-10-09.zip`.
- SHA-256 dos dois arquivos: `bc8cc2ec934d787f0af8ed8e66253a8eb54cc995047ac9beed18648fc57ad6bb`.
- GitHub: backup `tetsssssss/f1`, ramo `backup/pre-babylon-2026-10-09`, originado de `main`. O GitHub continha apenas um pacote Netlify antigo; o backup GitHub e o backup ZIP são de versões distintas.
- A ramificação `main` não foi alterada. O save original da carreira não é modificado pelo laboratório, que usa estado isolado em memória.

## Implementações
- Novo componente `src/features/babylon-lab.tsx`.
- Página `/laboratorio-babylon`, link no menu lateral.
- Canvas 2D com 32 monopostos F1, modelo visual de chassis, rodas, aerofólios e cores das equipes, com chuva cosmética e clique para acompanhar piloto.
- F1 lê dados do **RaceEngine real**, via `createSave`, `createRaceState`, `tickLive`, `presentRace` e `circuitGeometry`.
- F2 e F3 usam seus elencos reais `feederEntrants` / `formulaThreeEntrants` (24 carros encontrados em cada um, na fixture 2029) e animações **demonstrativas**, sem resultado oficial, tática ou física de corrida dessas categorias.
- 3D Babylon.js WebGL: cena de pista Ribbon, zebras, paddock simples, carros 3D procedurais com rodas girando, materiais básicos, câmera TV, aérea e onboard. Usa a mesma posição/calibração geométrica do 2D e não altera o motor esportivo.
- `Exportar estado` gera JSON somente desta demonstração. **Não é backup de save nem do código**.
- Controles: categoria, 2D/3D, pausa, velocidade de apresentação, piloto, câmera e chuva visual. Ritmos visuais +10/−10% servem apenas para o feed demonstrativo F2/F3, não para alterar estratégias F1.

## Validação realmente executada
- `node scripts/qa-offline.mjs`: **245 testes de domínio aprovados**, nenhum falhou (antes da adição do laboratório, sem novos testes unitários do Babylon).
- `node scripts/build-offline.mjs`: compilação **alternativa**, 106 módulos, sintaxe JavaScript validada. **Não é Vite nem Next build oficial**.
- Chromium em execução isolada: página do laboratório em 1366×850 e 390×850, animação 2D desenhada no canvas, F1 com 32 carros, F2 com 24, F3 com 24, controles de categoria, chuva, ritmo e exportação JSON; sem exceções de JavaScript.
- Chromium: falha simulada no carregamento do CDN Babylon.js, retorno automático ao Canvas 2D sem exceções.
- Teste da navegação já existente: seis rotas padrão e abertura de Corrida Rápida, conforme script isolado existente.
- 64 arquivos `.webp` das fotos dos pilotos na fonte e na distribuição estática, SHA-256 idênticos por arquivo.
- Não foram testados: renderização 3D WebGL real, publicação Netlify, performance FPS real em Android/PC, áudio físico ou gráficos F2/F3 conectados às suas simulações esportivas.

## Uso
1. Netlify: descompactar o ZIP Netlify e publicar a **pasta contendo `index.html`**.
2. Abrir `/laboratorio-babylon` pelo menu lateral.
3. Comparar `Canvas 2D` e `Babylon.js 3D` em um dispositivo conectado à internet com WebGL.
4. Se o Babylon não carregar, o erro aparecerá no status e o modo Canvas 2D continuará disponível.
5. Para compilar pelo fluxo oficial, usar o ZIP de código-fonte, instalar dependências e executar `npm run build:netlify`. Isso não pôde ser concluído no ambiente isolado sem acesso ao registro npm.

## Próximo passo para produção
Integrar o renderizador Babylon diretamente ao `LiveMap` em corrida real, com modelos GLB/GLTF, pipeline de assets, materiais por equipe, efeitos climáticos e testes em WebGL real. Manter 2D como fallback. Não usar o protótipo F2/F3 como resultado esportivo.
