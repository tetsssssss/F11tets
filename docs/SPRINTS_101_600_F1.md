# F1 Universe 2029 | Horizonte das Sprints 101–600

Data: 2026-10-08. Escopo: somente F1 Universe 2029. **Este é um registro técnico da execução atual, não uma declaração de que todas as 500 sprints foram concluídas.** As melhorias estão na cópia de trabalho; nenhum ZIP foi gerado.

## Entregas implementadas nesta sessão (primeiro marco das Sprints 101+)

1. **F3 de verdade no universo fictício**: `src/domain/universe/formula-three.ts`, com até 30 participantes da base existente, dez etapas ligadas ao calendário do save, duas provas por fim de semana, classificação por pontos, abandono, desempate, determinismo independente da F2, evolução de pontuação e validação de acesso por GPs concluídos.
2. **F3 na interface**: `src/features/formula-three.tsx`, rota `/f3`, calendário, tabela, perfis, atributos técnicos do piloto em cinco grupos, pódio animado (somente revelação de resultado final), seleção Sprint/prova principal, curvas de forma e histórico anual. Links integrados aos painéis existentes. Não há corrida F3 volta a volta, física 3D ou simulação de trajetória contínua.
3. **Progressão F3 → F2**: processamento pós-temporada em `src/domain/universe/seasons.ts`, arquivo anual de classificação F3, pontos de superlicença, notícia do campeão e prioridade de F2 aos três melhores. Os pontos de F3 **não** são adicionados à classificação da F1.
4. **Renovação de talentos**: nova geração anual de candidatos fictícios F3 na pós-temporada, mantendo uma pirâmide esportiva ativa e sem reusar IDs de pilotos antigos. Os novos pilotos possuem 20 atributos técnicos coerentes com o rating e potencial; personagens são marcados como procedurais.
5. **Mercado de assentos F1**: `src/domain/universe/driver-seats.ts`, `src/features/driver-seats.tsx`, rota `/substituicoes`. Avaliação dos cinco últimos GPs compartilhados por uma dupla; risco de demissão por diferença de pontos e posições médias; substituição definitiva por reserva da mesma equipe com superlicença, disponibilidade e recursos financeiros. Mantém resultados/pontos antigos de quem sai, contabiliza contratação e registra notícia/transferência.
6. **AI das equipes**: avaliação controlada a partir da oitava prova e a cada quatro rodadas, com variação de decisão reprodutível e limites para impedir trocas em massa. A IA não interfere no construtor do jogador nem demite o personagem principal da carreira de piloto. Avaliação de rendimento grave pode influenciar negociações também na intertemporada.
7. **Preservação de sistemas existentes**: proteção contra troca durante sessão ativa, durante fins de semana com treinos/classificação já iniciados ou durante substituição temporária por lesão/TL1; o formato do save permanece `version: 4`, sem novos campos obrigatórios.
8. **História e fotografias reais**: galeria de campeões históricos da FIA F3 de 2020, 2023, 2025 e 2026, separada da F3 procedimental do save 2029. Os três primeiros utilizam retratos reais correspondentes já presentes no projeto; o retrato oficial de Ugo Ugochukwu (2026) é externo e requer conectividade. Fontes: FIA Formula 3 Hall of Fame e classificação oficial de 2026. Nenhuma identidade fictícia foi falsamente associada à foto de um piloto real.
9. **Visual**: gradação de riscos de assento, barras animadas de atributos, cards de pódio com animação de entrada e layout adaptativo. Respeita `prefers-reduced-motion`.
10. **Idempotência no encerramento do ano**: registro de F2, F3 e categorias anuais é verificado individualmente, impedindo duplicações e permitindo completar categorias faltantes em arquivos parciais.

## Testes e limitações

- Bateria focada final com F2, F3, assentos, persistência, academias e fotografias: **71 testes aprovados, 0 falhas** (`/mnt/data/f1_sprint600_milestone_test.log`).
- Suite ampliada com sete arquivos: **70 aprovações, 2 erros de execução** devidos a resolução de imports como diretórios pelo loader de testes local, sem falha comprovada do motor. Ao corrigir o loader, a tentativa da suíte pesada ultrapassou o limite de tempo, portanto permanece **não validada**.
- Testes novos de F3, assentos, IA, pós-temporada, superlicença, determinismo, persistência e novos pilotos: incluídos na bateria final.
- Teste estrutural sintético de **dez temporadas**: aprovado; revisa manutenção do grid da F3, categorias de acesso e histórico anual. Não equivale a dez temporadas de GPs completos no motor F1.
- Transpilação sintática com TypeScript para 13 arquivos modificados: 13 aprovados, 0 erros sintáticos.
- As 64 imagens originais de F1 foram comparadas com o ZIP-fonte fornecido e são idênticas byte a byte.
- Typecheck completo, build Netlify, Playwright, teste de UX real e simulação de dez anos não concluídos por falta de dependências completas ou tempo de execução.

## Requisito ainda NÃO atendido: todas as fotos dos jovens fictícios

A base de 2029 utiliza pilotos procedurais, que não são pessoas históricas reais. Esses jovens continuam com retratos estilizados. Não foram atribuídas fotografias de pilotos reais a identidades falsas. O arquivo histórico da FIA F3 apresenta pessoas reais com retratos correspondentes, mas a cobertura fotográfica de todos os juniors de 2029 **continua pendente**. É necessária uma coleção de retratos fotográficos ficcionais originais, associada de forma única aos IDs, ou uma base de pilotos reais com identidade/documentação corretamente relacionadas.

## Caminho das Sprints 101–600 (ainda não concluído)

| Horizonte | Prioridade e critério de aceite |
|---|---|
| 101–150 | F3 operacional, manutenção e revisão de assentos, atributos e histórico. Completar testes, build e revisão de interface. |
| 151–200 | Retratos fotográficos consistentes de todos os jovens; registro fotográfico com hash/licença, rostos correspondentes e troca correta de equipe. |
| 201–250 | Motor de corrida F3 volta a volta, clima, pneus, boxes, abandonos, Safety Car, IA e replays derivados de eventos reais. |
| 251–300 | Motor F2 detalhado, treino/classificação, estratégias, punições, telemetria e interface da transmissão; comportamento reproduzível. |
| 301–350 | Contratos profundos e mercado F1/F2/F3, reservas, avaliações de pressão, cláusulas, patrocínio, consequências financeiras e carreira de piloto. |
| 351–400 | Scouting internacional, desenvolvimento jovem, academias independentes, formação de engenheiros e evolução multicategoria sustentável. |
| 401–450 | Animações 2D/3D mais precisas, reconhecimento de pit stops, câmera suave, HUD adaptativo, mobile e acessibilidade. |
| 451–500 | História esportiva multianual, recordes, hall da fama, notícias verificáveis e rivalidades com memória persistente. |
| 501–550 | Bateria de balanceamento Monte Carlo, várias temporadas, testes de save/load e contenção de crescimento de memória. |
| 551–600 | Build Netlify compilada do fonte, testes Playwright, compatibilidade com saves antigos, auditoria regressiva e release estável. |

## Regra de execução

Não rotular novas sprints como concluídas sem alteração rastreável e critérios de aceite executados. Não compactar nem gerar ZIP sem solicitação. Preservar integralmente fotos dos 32 titulares (64 WebP), saves, resultados e regras existentes. Implementar de forma incremental.
