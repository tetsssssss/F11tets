> **Atualização de 08/10/2026 · Marco 50.000:** código atualizado com calendário variável, persistência compatível, operação de temporada, painel de engenharia e execução offline. 238 testes de domínio aprovados; compilação estática alternativa disponível. O marco é uma meta nominal, não 50.000 sprints executadas. Consulte `docs/EVOLUCAO_MARCO_50000.md`.

# F1 UNIVERSE — ESTADO COMPLETO DO APLICATIVO

Atualizado em 06/10/2026. Relatório de entrega do pacote Netlify e da expansão em andamento.

## CURRENT VERSION
Pacote npm 0.3.0 com alterações ainda não commitadas para a expansão; schema de save v4. Branch `codex/f1-universe`, commit-base `9713d75`. Artefato de distribuição datado de 06/10/2026. Nenhum commit novo foi criado.

## IMPLEMENTED
16 equipes, 32 pilotos titulares e 35 GPs do universo original preservados. Modos Piloto e Construtor, início de carreira, três slots locais, sessões TL/Q/Sprint/GP, pontos, grid invertido por blocos, decisões de pneus/energia/setup, rádio, cinco comandos, estratégia e resultados persistentes. Mercado, contratos, opções, salários, desenvolvimento, fornecedores, entrevistas, relações e reputação já conectados à simulação.

Expansão adiciona registro persistente de pessoas, 48 reservas iniciais procedurais, aposentadoria/promove/trocas, contratos futuros e contrapropostas, cláusulas, academias e TL1 de rookie, substituições temporárias, categorias de base anuais, estágios de off-season, mudanças regulatórias, pesquisa futura, componentes, fadiga, equipe de boxes, gestão de CEO e propostas de emprego, histórico e inbox. Todas essas regras são de um universo fictício e algumas são explicitamente provisórias.

Fotos: 32/32 titulares, resolver e componente central, proveniência, fallback, auditoria e originais preservados. 2D: 32 mini-carros, seleção, câmera, movimento interpolado, boxes, clima, SC/VSC, narração e highlights. Ver relatório visual para limites.

Distribuição: entrada estática Netlify reutiliza o mesmo código. HTML/JS/CSS, fontes e fotos incluídos; não há dependência de localhost na build publicada. `_redirects` suporta rotas profundas. Saves continuam locais ao navegador/domínio.

## PARTIAL
Categorias de base têm classificação anual abstrata; gestão organizacional e regulamentos não cobrem todas as decisões possíveis. Mapas dos 35 GPs são estilizados. Animação de boxes não mede cada milissegundo real da parada. Highlights textuais e replay de frames são mecanismos separados. Algumas listas/seletores ainda usam nomes sem miniatura. Não foi realizada conferência item a item da totalidade dos dois prompts extensos.

## MOCKED
Nomes/atributos de engenheiros e reservas procedurais; ratings, contratos iniciais, geometrias e parte dos parâmetros editoriais. Nenhuma identidade fictícia usa a fotografia de uma pessoa real.

## BROKEN
Nenhuma falha conhecida nos caminhos de entrega verificados. Foram corrigidos: persistência de snapshots grandes, substitutos após negociação da IA, acesso a plano de pista sem cargo/assento e atributo de regulação. Não interpretar esta frase como garantia de ausência de bugs em toda a expansão.

## TESTED
44 testes automatizados de domínio aprovados; auditoria de 32 fotos sem faltantes/duplicatas exatas; typecheck; build Next.js; build estática Netlify. Suíte E2E inicial: 28 aprovados, 2 falhas de plano de pista sem cargo. Após correção, os dois casos de temporada/importação/reload passaram em desktop e Android. Mais quatro testes de fotos/fallback/câmeras/16×/rotas passaram. Cinco temporadas IA, 2029–2033, com rollover para 2034, sem save inválido, caixa negativo, titulares duplicados ou engenheiros órfãos.

## NOT TESTED
Dez temporadas, Monte Carlo de 2.000 GPs, celulares físicos, publicação em uma conta Netlify, restauração de todos os possíveis saves antigos e rastreamento de heap em sessão longa. Testes de navegador usaram Chromium e emulação Pixel 7.

## TECH DEBT
Telemetria completa mantém muitos frames: cinco temporadas totalizam aproximadamente 243 MB em JSON descomprimido. IndexedDB usa gzip, mas o estado em memória precisa futuramente de carregamento sob demanda dos arquivos históricos. Vinte e nove fotografias têm licença desconhecida. A API de página Next é reaproveitada na build SPA através de adaptadores pequenos; mantê-los cobertos por E2E.

## NEXT PRIORITIES
Conferir requisitos restantes, reduzir memória de históricos preservando dados, substituir mapas provisórios, resolver direitos das fotos, ampliar testes da gestão de longo prazo e melhorar visualização de pelotão/boxes. Não refazer grid, banco, assets aprovados ou motor.

## FILES CHANGED
Inventário completo em `docs/files-changed-v04.txt`, incluindo trabalho preexistente. Principais módulos: `domain/universe/*`, `domain/save.ts`, `domain/persistence.ts`, `domain/simulation/*`, `features/universe.tsx`, `features/live-map.tsx`, `features/live-race.tsx`, `components/person-portrait.tsx`, `presentation/*`, `src/data/photo-manifest.json`, `public/assets/people/*`, scripts de fotos, `netlify/*`, `vite.netlify.config.ts`, `netlify.toml`, testes e relatórios. O projeto Tennis pai não foi modificado para este pacote.

## TEST RESULTS
Evidência: `docs/test-v04.log`, `docs/soak-v04.json`, `docs/e2e-netlify.log`, `docs/e2e-season-final.log`, `docs/e2e-netlify-visual.log`, `PHOTO_AUDIT_REPORT.md`. Screenshots desktop/Android em `docs/screenshots/netlify-*`.

## BUILD RESULT
Next.js: sucesso, `docs/build-v04.log`. Netlify/Vite: sucesso, `docs/build-netlify.log`. ZIP contém somente saída compilada e documentação; arquivo `docs/netlify-package.json` registra contagem, tamanho e SHA-256. Publicação cabe ao usuário conforme o pedido de entrega em ZIP; nenhum site remoto foi alterado.
