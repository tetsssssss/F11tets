# F1 Universe 2029 | Marco 54.000 Mobile Edition

Data: 2026-10-09. Base preservada: Marco 52.000.

## Código efetivamente modificado
- `src/features/live-race.tsx`: novos botões dedicados 2D, 2.5D e 3D Babylon, com seleção imediata no celular. Seletor de velocidade responsivo ligado a `pace()` sem afetar o motor da corrida.
- `src/features/live-map.tsx`: inicialização econômica do perfil gráfico de telas estreitas (baixa qualidade em 2D e Babylon.js, alterável pelo usuário).
- `src/components/shell.tsx`: barra de navegação rápida em smartphones (Início, GP, Corrida, Gráficos e Menu completo).
- `src/app/globals.css`: layout responsivo para a pista, HUD, botões de toque >=43px, timing lateral, comando dos pilotos, margens seguras, overflow local de tabelas, laboratório Babylon adaptado e navegação móvel que some durante a prova.
- `scripts/verify-mobile.cjs` e `package.json`: novo comando `npm run test:mobile` com sete verificações estáticas.
- `LEIA-ME-CELULAR-54000.md`: documentação das funções e instruções de publicação.

## Builds e testes executados aqui
- Build offline alternativa: **PASSOU**, 110 módulos. `node --check` aplicado pelo script à saída compilada. Arquivo: `BUILD_MOBILE_54000.log`.
- `npm run test:mobile`: **7/7 testes estáticos PASSARAM**.
- Integridade comparada com o ZIP do Marco 52.000: **64/64 WebP sem alterações; 36 arquivos src/domain sem alterações; 10 de src/data e 1 de src/audio idênticos**. Relatório `VERIFICACAO_54000.json`.
- Os 2 testes unitários de preferência de câmera foram executados e tiveram saída individual `ok`; o processo de testes não terminou de forma verificável no tempo limite do ambiente, portanto não certificamos a suíte completa para esta edição.
- Chromium para QA visual: **bloqueado por política administrativa** (`ERR_BLOCKED_BY_ADMINISTRATOR`) tanto para `localhost` quanto para `file://`. Não há captura móvel **nova** homologada. Teste em dispositivo real pendente.
- Não foi executado o build oficial Vite/Next nesta edição, pois `node_modules` está ausente neste ambiente. A entrega Netlify usa a rota alternativa offline do código-fonte.
- Babylon.js 3D: preservada a cena existente com carregamento externo por CDN nesta build offline; renderização WebGL 3D real ainda precisa de homologação.

## Teste no celular
1. Faça deploy da raiz de `F1_UNIVERSE_2029_MOBILE_54000_NETLIFY.zip` no Netlify.
2. Abra no navegador do smartphone. Use os atalhos de rodapé **Início / GP / Corrida / Gráficos / Menu**.
3. Inicie uma corrida rápida ou entre numa corrida da carreira. Os atalhos desaparecem durante o cockpit para liberar a pista.
4. Toque nos botões fixos **2D TÁTICO / 2.5D / 3D BABYLON** logo abaixo da volta, em seguida no seletor de velocidade.
5. Teste o timing, comandos de equipe, mudança de câmera e qualidade. Se o 3D falhar, o fallback existente volta ao 2D.
6. Teste tanto em retrato quanto em paisagem. O 3D depende de acesso à biblioteca Babylon no navegador.

## Proteção dos dados
O motor esportivo, as regras, saves, assets originais, 64 fotos e som foram deixados intactos. Uma cópia do ZIP Marco 52.000 permanece disponível como backup, com hash SHA-256 fornecido em `VERIFICACAO_54000.json`.

## Limitações de escopo
Este é um refinamento responsivo e de usabilidade para celular. Não é uma substituição dos modelos 3D nem revisão de sprites, e não afirma FPS medido em smartphone real. O motor F2/F3 foi preservado; a integração dos renderizadores na carreira segue a disponibilidade dos recursos do Marco 52.000.
