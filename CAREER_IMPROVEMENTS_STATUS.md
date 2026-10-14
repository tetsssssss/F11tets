# CAREER IMPROVEMENTS STATUS

2026-10-06. A carreira existente foi melhorada; nenhum modo novo foi criado e o RaceEngine é o mesmo.

## MENU IMPROVEMENTS

- `/temporada` abre com a **Central da Carreira** (`src/features/career-hub.tsx`): foto do piloto (ou dos dois pilotos no modo Construtor), temporada, equipe, posição no campeonato, pontos, round e forma (últimos 5 GPs).
- Bloco **Próximo evento** com mapa do circuito na cor da equipe, round, sessão seguinte, como ela será jogada e a ação principal (`INICIAR / CONTINUAR FIM DE SEMANA`, `VOLTAR À CORRIDA`, `FECHAR FIM DE SEMANA`).
- Menu de 9 destinos: Próximo evento, Calendário, Campeonato, Meu piloto/Perfil, Equipe, Mercado, Estatísticas, Histórico, Configurações da carreira.
- Storylines: as 3 notícias mais recentes do save.
- Card de save (Seus três saves): foto, nome, equipe, ano, round, posição, pontos, último GP, próximo GP, preset e botão `CONTINUAR`. Tempo de jogo não é registrado pelo save, então não aparece.
- Estatísticas da carreira em `/carreira`: largadas, vitórias, pódios, poles, voltas mais rápidas, pontos, abandonos, melhor chegada, melhor campeonato. Lidas de dados que o save já tinha.

## SLIDERS

Onze sliders em `/carreira` (0–100; desgaste de pneus 50–150%). Cada um vira um fator limitado em `raceModifiers` (`src/domain/gameplay/settings.ts`); nenhum altera nota de piloto, carro ou equipe.

| Slider | Efeito no motor | Faixa do fator |
| --- | --- | --- |
| Competitividade da IA | IA deixa de dar o comando certo (baixo) ou poupa pneu/bateria mais cedo (alto) | até 50% de hesitação / +6 pontos de limiar |
| Agressividade da IA | distância a partir da qual a IA ataca e chance de tentativa | 0,70–1,35 |
| Erros dos pilotos | risco de travada, rodada e saída de pista | 0,60–1,50 |
| Falhas mecânicas | probabilidade de falha | 0,50–1,60 |
| Desgaste dos pneus | desgaste por volta | 0,50–1,50 |
| Variação climática | amplitude da previsão | 0,50–1,60 |
| Incidentes | risco de contato | 0,60–1,50 |
| Severidade dos danos | dano por contato/erro | 0,60–1,40 |
| Safety Car | peso do SC **depois** de um incidente real | 0,50–1,50 |
| Gestão de energia | custo de tempo com bateria abaixo de 22% | 0,60–1,50 |
| Estratégia da IA | leitura de pit, undercut, SC e chuva da IA | −8 a +8 pontos |

## DIFFICULTY

Presets CASUAL, NORMAL, PRO, SIMULAÇÃO e CUSTOM. NORMAL produz fator 1 em tudo: resultados idênticos aos de antes. Os valores de CASUAL seguem o pedido (35/40/35/35/80…), com Variação climática e Safety Car em 50. Mudar qualquer slider ou assistência à mão vira CUSTOM e marca `custom: true` no save de forma permanente.

Informação disponível: CASUAL/NORMAL/PRO mostram números exatos; SIMULAÇÃO mostra intervalos (ex.: `48–57%`) para pneu e bateria no cartão de comandos.

## SIMULATION OPTIONS

Participação por sessão: Treinos (Assistir / Simular / Simular automaticamente), Classificação (Jogar / Simular), Sprint (Jogar / Simular), GP (Jogar / Simular / Highlights / Resultado instantâneo). Três perfis iniciais apenas pré-preenchem essas opções.

Velocidade: 1×–16× e **AUTO** (botão ao lado das velocidades, também no Race Theater). AUTO: 1× na largada, na última volta e quando o jogador está em disputa; 2× em disputa pela liderança; 4× em SC/VSC; 8× sozinho.

## ASSISTS

Pausar em eventos importantes; reduzir velocidade em batalha, pit, chuva e Safety Car (cada um desligável); câmera automática; recomendações do engenheiro (uma linha no cartão de comandos, nunca executa comando); pit stop automático (espelha a opção que já existia); assistente de estratégia (estimativa de perda e janela no painel de PIT); detalhe do rádio.

## RACE LENGTH

25 / 50 / 75 / 100%. O número de voltas de GP e Sprint é reduzido (mínimo 5) e o desgaste é multiplicado por `(1/distância)^0,9`, então stints e janelas de pit mantêm a forma; combustível já dependia das voltas. Treinos e classificação não mudam. A distância não muda no meio de uma sessão em andamento.

## HIGHLIGHTS

GP em Highlights é a corrida real, com ritmo automático de cruzeiro 16×, que cai para 1×/2×/4× na largada, disputas, incidentes, SC e voltas finais. Testado: o resultado é idêntico ao do resultado instantâneo.

## INSTANT SIMULATION

Usa `simulateSession` do mesmo RaceEngine (já existia). Testado em NORMAL 100%, CASUAL 50%, SIMULAÇÃO 100% e CUSTOM 25%: corrida ao vivo tick a tick e resultado instantâneo dão o mesmo resultado, e o mesmo seed repete o resultado.

## SAVE MIGRATION

`career.settings` foi adicionado sem mudar a versão do save (continua 4). Ao carregar, `parseSave` preenche saves antigos com NORMAL e corrige valores fora de faixa em vez de rejeitar o save. Testado: save sem `settings` carrega e corre igual a uma carreira NORMAL.

## TESTS

- `tests/career-settings.test.ts`: 11 testes (neutralidade do NORMAL, presets não tocam ratings, distância, 4 carreiras completas com save/load, mudança no meio da carreira e migração, participação, AUTO, informação).
- `tests/e2e/career-settings.spec.ts`: nova carreira CASUAL 50%, Central, configurações persistem após recarregar, treinos automáticos, GP em Highlights até o resultado.
- Resultado da última execução: ver `CLAUDE_QUEUE_PROGRESS.md`.

## KNOWN ISSUES

- Rewind não foi implementado (pedido como não prioritário).
- Tempo de jogo não existe no save; o card não mostra.
- O balanceamento dos presets foi verificado por limites e por corridas completas, não por estatística de muitas temporadas.
- `pitLap` planejado pelo jogador no Plano de corrida não é reescalado automaticamente quando a distância é reduzida.
- O teste e2e de Highlights leva cerca de 2 minutos por projeto.
- Saves gravados antes desta rodada só ganham os dados novos do card (foto, posição) depois de serem carregados e salvos uma vez.
