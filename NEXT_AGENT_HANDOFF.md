> **Atualização de 08/10/2026 · Marco 50.000:** código atualizado com calendário variável, persistência compatível, operação de temporada, painel de engenharia e execução offline. 238 testes de domínio aprovados; compilação estática alternativa disponível. O marco é uma meta nominal, não 50.000 sprints executadas. Consulte `docs/EVOLUCAO_MARCO_50000.md`.

# NEXT AGENT HANDOFF

06/10/2026. Trabalhar somente em `C:\Users\Tts\Documents\ChatGPT\tenis\f1-universe`. O repositório Tennis pai é separado e tem alterações próprias. Não recriar o projeto nem resetar o checkout.

## Estado e artefato
Branch `codex/f1-universe`; HEAD `9713d75` (docs: add validated screenshots, integration exports and runbook). Nenhum novo commit foi criado nesta execução. Há trabalho acumulado não commitado, incluindo a expansão anterior à interrupção. Inventário: `docs/files-changed-v04.txt`.

O pedido mais recente é um ZIP jogável no Netlify. `npm run build:netlify` cria `dist-netlify`; `scripts/package-netlify.ps1` empacota somente a saída pública e instruções. `netlify.toml` também permite build por Git. ZIP final: `releases/F1_UNIVERSE_2029_NETLIFY.zip`. Manifesto verificado: `docs/netlify-package.json`.

## Arquitetura preservada
Next.js continua sendo a aplicação original. A entrada `netlify/main.tsx` reutiliza o roteador de páginas, SaveProvider, Shell, telas e motor existentes. Shims de link/navigation/dynamic adaptam apenas APIs de navegação ao navegador; não há cópia do motor. Vite 8.3.3 compila HTML/CSS/JS estáticos. `_redirects` permite recarga direta de rotas. Não é preciso servidor Node para jogar o ZIP publicado. O painel `/dev/race-2d` não é exposto na build pública.

## Fotos
`src/data/photo-manifest.json`: IDs originais. `public/assets/people/drivers`: cards/masters. `assets/photos/PHOTO_SOURCES.json`: origem e direitos; cópia no bundle público. `resolvePersonPhoto` prioriza foto verificada e alternativa; personagem fictício explicitamente marcado recebe SVG original. `PersonPortrait` controla onError e evita imagem quebrada. Nunca substituir fotografia real por retrato gerado. As fotos de tenistas anexadas não foram usadas neste projeto F1.

## Corrida e 3D futuro
`src/domain/simulation/race.ts`: criação, passo de volta e resultado. `src/domain/gameplay/types.ts`: RaceState, carros, comandos, pitCalls, eventos, frames e batalhas. `tickLive` avança setores e chama o motor na volta; RNG fica serializado. `src/presentation/race-presentation.ts` é puro e não altera o save. `circuit-geometry.ts` fornece Track2DGeometry com 35 splines provisórias, centerline, setores, pit lane, zonas e interpolação por distância. Um futuro 3D deve consumir o mesmo estado/adaptador e jamais calcular pontos ou ultrapassagens no renderizador. O modo atual 3D leve é apenas projeção estilizada.

## Universo persistente
Schema do save é v4, com migração das versões anteriores. `domain/universe` contém pool fictício de 48 reservas iniciais, contratos/termos, negociações, transferências, academias, off-season em etapas, snapshots históricos, regulamentos, componentes, organização, CEO, inbox e configurações. Fotos e menu também atendem titulares fictícios promovidos. Não tratar regras provisórias nem atributos editoriais como dados esportivos reais.

## Correções importantes
- Restauração de substitutos acontece antes da IA negociar na troca de GP; a ordem anterior gerava engenheiros órfãos em 2033.
- `RacePlan` permite ausência de carros controlados (CEO demitido/espectador), sem acessar `own[0].id`.
- Persistência mantém a base IndexedDB e três slots, lê strings antigas e novos payloads `{encoding:'gzip-json-v1', data: Blob}`. Checkpoints são registros separados com índice; os leitores de testes também descomprimem. Exportação/importação externa continua JSON.
- Modo de telemetria `full` preserva frames históricos; `summary` pode descartá-los no arquivo anual, mantendo resultados e todos os eventos.
- Campo de regulação energética corrigido para `Velocidade de reta`; renovação de pneus redistribui excesso de quatro equipes somente no vencimento, preservando a exceção inicial de cinco Michelin.

## Verificação e pendências
Consultar `VISUAL_AND_2D_STATUS.md`, `F1_UNIVERSE_STATUS.md` e logs em docs. Quarenta e quatro testes de domínio, auditoria de fotos, build Next, build estática, cinco temporadas de soak e verificações de navegador. A primeira suíte E2E tinha dois failures; seus dois casos passaram após correção, registrados separadamente, sem apagar o log inicial.

Expansão é parcial: geometrias provisórias, categorias de base abstratas, sem licenças confirmadas para 29 fotos, sem Unreal, sem rede/multiplayer/cloud save, sem auditoria de todos os 409+254 itens. Não declarar a missão inteira concluída por haver um ZIP. O usuário deve importar manualmente um save exportado do localhost no domínio Netlify; não há migração entre origens do navegador.

## Comandos
`npm run typecheck`; `npm test`; `npm run audit:photos`; `npm run build:netlify`; `npm run preview:netlify` (3031); `F1_TEST_URL=http://127.0.0.1:3031` para Playwright. Build Next isolada: em PowerShell, definir `$env:F1_DIST_DIR='.next-visual'` e executar `npm run build`. Não parar um servidor do usuário para validar o pacote.
