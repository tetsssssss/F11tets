# VISUAL AND 2D STATUS

Atualizado em 06/10/2026. Projeto existente preservado; pacote estático para Netlify gerado a partir do mesmo motor e componentes. A expansão dos dois prompts é parcial, com os limites abaixo explícitos.

## PHOTO SYSTEM
`src/presentation/person-photo.ts` centraliza `resolvePersonPhoto`. `PersonPortrait` mantém dimensões fixas, lazy loading, alternativa master e placeholder sem ícone quebrado. Fotos reais verificadas precedem ilustrações fictícias. Originais e componente anterior preservados em `assets/photos` e `assets/_photo_backup`.

## PHOTO COVERAGE
32/32 titulares com fotografias reais, associadas pelo perfil nominal do publicador. Cards 512×512 WebP; 30 masters de pelo menos 1024px e 2 menores na resolução nativa. Fichas, cards, classificação, mercado, contratos, notícias ligadas a pilotos, rádio/HUD, seleção no mapa e pódio usam o componente central. Seletores nativos de texto ainda não mostram miniaturas.

## PHOTO SOURCES
`assets/photos/PHOTO_SOURCES.json` e sua cópia pública registram origem, URL, autoria, licença, data e recorte. 29 imagens `unknown-license`; duas CC BY-SA 4.0 com atribuição/adaptação; uma identificada como domínio público. Não foi assumida licença livre para material de equipes/categorias. Uniformes de fotografias históricas não redefinem o grid de 2029.

## MISSING PHOTOS
Nenhum titular faltante. `FOTOS_FALTANTES.txt` e `PHOTO_AUDIT_REPORT.md` incluem os 32. Os 32 engenheiros e 48 reservas iniciais são personagens fictícios, com ilustrações SVG originais. A lista nominal de reservas reais não foi fornecida. Zhou usa óculos escuros; uma alternativa frontal é desejável.

## 2D ENGINE
RaceState/Event Stream → adaptador de apresentação puro → SVG. Mini-carros orientados pela tangente, cores de equipe, siglas, seleção, câmeras Full/Player/Leader/Battle/Auto, zoom, pan, reset, aposentados imóveis, destaques de batalhas e offsets vinculados a eventos reais. Gap visual aproximado por tempo de volta de referência. Pit lane com entrada, pausa e saída derivadas do evento confirmado pelo motor. SC, VSC, bandeira vermelha, chuva, setores e última volta visíveis. Resultado continua decidido exclusivamente pelo motor.

## TRACKS READY
Contrato `Track2DGeometry` disponível para todos os 35 GPs; 35 paths distintos auditados. Nenhum traçado homologado/medido.

## TRACKS PROVISIONAL
Todos os 35 mapas são splines estilizadas com `geometryStatus: provisional`. Zonas de freada/ultrapassagem e pit lane são referências visuais provisórias. Não há DRS. Ver `TRACK_2D_AUDIT.md`.

## COMMAND INTEGRATION
Mantidos ATAQUE, DEFESA, FREADA, PIT e RÁDIO. Um piloto no modo Piloto, dois no Construtor. Disponibilidade de freada depende do motor; duração e respostas aparecem no HUD. Timing alterna líder/intervalo. Narração Minimal/TV/Technical utiliza somente eventos registrados. Highlights textuais 1×/2×/4× e replay anterior de telemetria preservados.

## PERFORMANCE
RAF separado dos ticks, 20/30/60 fps solicitados por qualidade, cancelamento ao pausar/desmontar, respeito a movimento reduzido. 32 carros a 16× exercitados em Chromium desktop e emulação Pixel 7; sem erro de página ou overflow horizontal nos testes. Isso não equivale a benchmark de GPU nem a prova formal de ausência de vazamento em todos os dispositivos. Saves grandes usam gzip e checkpoints separados no IndexedDB; JSON externo continua compatível. Telemetria completa de cinco temporadas alcançou ~243 MB sem compressão: memória de carreiras longas ainda requer atenção.

## TESTS
- `npm run audit:photos`: 32 válidas, 0 ausentes, 0 duplicatas exatas, 0 erros.
- `npm test`: 44 testes aprovados; inclui determinismo com/sem apresentação, geometria, pit e aposentadoria.
- Typecheck e build Next.js com diretório isolado aprovados.
- `npm run build:netlify`: aprovado, saída estática em `dist-netlify`.
- Suíte de navegador: 28/30 aprovados inicialmente. Dois casos revelaram crash no plano de pista de CEO demitido; corrigido. Reexecução dos dois casos passou em desktop e Android (`docs/e2e-season-final.log`).
- Quatro testes visuais adicionais aprovados em desktop/Android: 32 imagens, fallback forçado, seleção/câmeras, 16× e rotas profundas (`docs/e2e-netlify-visual.log`).
- Soak IA: cinco temporadas, 2029–2033, com passagem para 2034, 32 titulares/16 equipes, sem órfãos, duplicatas, caixa negativo ou save inválido (`docs/soak-v04.json`).

## KNOWN ISSUES
Traçados provisórios; labels podem se sobrepor em pelotões compactos; animação de pit usa a fase visual do evento, não telemetria física subsegundo; largada usa luzes simples; replay de highlights é textual. Licenças de 29 fotografias não confirmadas. Categorias de base e parte da gestão organizacional são simulações abstratas. Testes não incluem dez temporadas, benchmark Monte Carlo de 2.000 GPs, dispositivo móvel físico nem publicação efetiva numa conta Netlify.

## NEXT WORK
Licenciar/substituir imagens de licença desconhecida; mapas medidos; telemetria subvolta para boxes/batalhas; lazy loading dos arquivos históricos; auditoria completa dos requisitos restantes dos dois prompts. Publicação na conta do usuário não foi executada; o ZIP é o artefato solicitado.
