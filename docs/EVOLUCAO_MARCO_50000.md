# F1 UNIVERSE 2029: MARCO 50.000

**Data:** 2026-10-08  
**Natureza:** marco de evolução, não 50.000 sprints individuais realizadas.

## Alterações realmente implementadas neste ciclo

1. Saves v1: verificação de término do campeonato baseada no tamanho do calendário real, sem depender da posição fixa 35.
2. Validação dos saves v4: `round` permitido somente até o tamanho do calendário + 1; quantidade de fins de semana também limitada à própria temporada.
3. Arquivos históricos: temporadas de comprimento variável aceitas, com checagem de sequência de rodadas e GP final concluído.
4. Gestão financeira: salários por GP distribuídos pela quantidade de provas do calendário carregado (35 em saves padrão).
5. IA do mercado: marcos de avaliação de contratações adaptados aos terços do calendário, preservando 12/24/35 na temporada padrão.
6. Desenvolvimento: projetos pendentes transportados à temporada seguinte pelo tamanho real do calendário, não por 35 fixo.
7. Interface: página de fim de semana, encerramento de ano, tela de carreira, perfil de pilotos, hub de universo e menu Novo Jogo mostram a etapa correta em calendários menores.
8. Engenharia ao vivo: alertas sobre pneus incompatíveis com a pista, desgaste, bateria, pit planejado, neutralização e disputa próxima, calculados do estado real e sem influenciar a física ou o resultado.
9. Modo espectador: foco automático no líder, podendo selecionar qualquer piloto para acompanhar a engenharia.
10. Acessibilidade: linhas interativas da torre de timing recebem foco de teclado, Enter e espaço.
11. Desempenho da interface: log integral preservado, mas a renderização inicial apresenta somente os 250 eventos mais recentes; o jogador pode expandir todos.
12. Novo executor de testes de domínio offline via TypeScript global, independente do Vite; correção do staging dos retratos reais durante os testes.
13. Nova rotina de build alternativa estática offline, transpilando a versão atual e reutilizando recursos de execução da compilação anterior.
14. Smoke test visual isolado por Chromium, reexecutável quando HTTP local está bloqueado pelo ambiente.

## Testes de verificação

- **238 de 238 testes automatizados de domínio aprovados**, incluindo novos testes para calendário curto completo (duas etapas + saves), alertas da engenharia, integridade de fotos e regressões anteriores. Comando: `node scripts/qa-offline.mjs`.
- **103 módulos** JS/TS/JSON transpilados na build estática alternativa; sintaxe JS aprovada.
- **Seis rotas** renderizadas isoladamente em Chromium, sem erros `pageerror` na inspeção; Corrida Rápida aberta com 32 carros e painel de engenharia visível. Testes realizados com a rota simulada, pois navegação HTTP local foi bloqueada por política do ambiente.
- **Fotografias dos 32 pilotos:** nenhum arquivo alterado. Os 64 retratos WebP mantidos nos arquivos de código-fonte e distribuição estática.

## Ressalvas e trabalhos pendentes

- **Não foi possível executar `npm ci`** offline: o pacote Vite 8.3.3 não está no cache (`ENOTCACHED`). Não há homologação por build Vite/Next oficial, typecheck integral ou Playwright E2E usando hospedagem real nesta rodada.
- A compilação estática entregue usa o runtime React/CSS e os assets da versão compilada anterior, com todos os módulos de aplicação atualizados pela transpilação TypeScript. Não é uma build Vite oficial. O CSS atual é carregado por cima dos estilos básicos compilados.
- Browser isolado não testa armazenamento IndexedDB, refresh de rota, deploy no Netlify nem uma corrida completa. Não confundir esse smoke com homologação de produção.
- O comportamento de IA, economia e ten-year career precisa de novas baterias de calibração antes de alegar realismo definitivo.
- O marco 50.000 é o destino nominal do projeto. Não há 50 mil ciclos de desenvolvimento certificados.

## Como usar os pacotes

**Fonte:** extraia, use `npm ci` num ambiente com Internet e `npm run build:netlify`, `npm run typecheck` e `npm test` para homologação completa. Pode usar `npm run qa:offline` sem dependências npm quando houver TypeScript global.

**Netlify alternativo:** descompacte o ZIP e envie os arquivos da raiz ao Netlify Drop. Mantém `index.html`, `_redirects`, `assets/` e fotografias. Recomenda-se publicar primeiro numa URL de testes e verificar saves e rotas antes de substituir uma publicação em uso.

**Reproduzir build offline:** `F1_BASELINE_STATIC=/caminho/para/F1_UNIVERSE_2029_MARCO_13000_NETLIFY_COMPILADO.zip node scripts/build-offline.mjs /pasta/de/saida`.
