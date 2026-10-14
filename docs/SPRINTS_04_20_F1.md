# F1 Universe 2029 — Sprints 04 a 20

Data: 2026-10-08. Escopo **somente F1**. Código editado diretamente em `/mnt/data/projetos_ativos/F1_UNIVERSE_2029`.

## Resultado implementado nesta sessão

As sprints abaixo são **incrementos funcionais focados de análise, apresentação e QA**, não reescritas completas da carreira. O objetivo foi ligar sistemas *já persistidos* em um painel estratégico interativo, com zero alteração no motor e no esquema de saves. Dados ausentes resultam em ausência do alerta, nunca notícias ou resultados inventados.

| Sprint | Implementação | Comprovação |
|---|---|---|
| 04 | Núcleo puro de sinais do paddock, sem escrita no save | Criação sem fatos inventados |
| 05 | Disputa direta com concorrente real do campeonato | GP salvo + pontos |
| 06 | Contexto da próxima pista com referência climática corretamente rotulada | Teste do calendário; não chama climatologia de previsão |
| 07 | Risco de fadiga, lesão e suspensão dos titulares | Prioridade urgente para indisponíveis |
| 08 | Alerta de cota de componentes excedida por piloto/peça | Teste de alocação real |
| 09 | Alerta de desgaste da equipe de boxes | Teste do limiar de fadiga |
| 10 | Sinal de liquidez baseado no caixa existente | Teste de saldo persistido |
| 11 | Consumo do teto operacional vinculado à era vigente | Teste 85%/100% |
| 12 | Acompanhamento de projetos de P&D realmente ativos | Teste de filtro ativo/entregue |
| 13 | Contratos da equipe com término na temporada | Teste de separação por equipe |
| 14 | Meta primária e confiança da diretoria | Teste do estado de risco |
| 15 | Progresso real de sessões de novatos na academia | Teste de metas cumpridas/pendentes |
| 16 | Contrapropostas e negociações aceitas que exigem conclusão | Teste de estado e equipe |
| 17 | Último movimento de mercado registrado, com data e origem | Teste de ordem e exclusão de futuro |
| 18 | Triagem de mensagens não lidas e urgentes | Teste de leitura |
| 19 | Próxima era regulatória e líder de categorias de base, quando existem | Teste de fontes reais |
| 20 | Central de decisões com filtros interativos, prioridades, rotas e visual adaptativo | Teste de idempotência e não mutação |

### Arquivos

- `src/presentation/paddock-intelligence.ts` (novo): indicadores derivados do save, fila determinística de alertas e prevenção de eventos fictícios.
- `src/features/career-hub.tsx`: seção **Decisões do paddock** com filtros Visão geral, Prioridades, Pista, Equipe, Mercado e Mundo.
- `src/features/home.tsx`: acesso direto à central estratégica após iniciar carreira; contadores de calendário agora dinâmicos.
- `src/features/competition.tsx`: contadores de GP e título do calendário dinâmicos.
- `src/app/globals.css`: cards responsivos, estados hover/foco, tratamento de `prefers-reduced-motion`.
- `tests/paddock-intelligence.test.ts` (novo): 17 casos, um para cada incremento.

### Validação

- **17/17 testes novos aprovados**, via `node --experimental-loader ../ts-loader.mjs --test tests/paddock-intelligence.test.ts`.
- **38/38 testes direcionados aprovados**, incluindo novos, persistência, fotos, classificação, telemetria de apresentação e etiquetas 3D.
- Sintaxe de todos os arquivos TS/TSX alterados checada via `typescript.transpileModule`, sem erros de sintaxe; isto **não substitui** o typecheck completo.
- 64 arquivos `public/assets/people/drivers/*.webp` preservados. Nenhum catálogo de fotos nem motor de corrida foi alterado.
- Rotas de ações verificadas contra navegação existente: nenhuma rota inexistente.
- `npm run typecheck` permanece bloqueado nesta cópia por pacotes de tipos Node, React e React-DOM ausentes em `node_modules`.
- Compilação Next/Netlify, screenshots e E2E de navegador **não foram validados** nesta sessão.
- Suíte completa disponível na cópia: **100/100 testes aprovados** usando o loader local de TypeScript, com duração de ~64 segundos; esse loader transpila sem análise de tipos, e não substitui testes E2E/build.

### Limites e próximos critérios de aceitação

Estas sprints **não** implementam física inédita, IA estratégica nova, contratos autônomos inéditos ou avanço extra de temporadas. O novo painel expõe sistemas existentes com consequências persistidas e links de ação. Uma futura rodada de engenharia precisa restaurar o ambiente de dependências e rodar `typecheck`, `build:netlify`, teste real em 390/768/1366px e sessões longas com save/load. Não alegar que esses critérios estão aprovados sem execução.

**Regra de empacotamento:** nenhum ZIP gerado ou solicitado.
