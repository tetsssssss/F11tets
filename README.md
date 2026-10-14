> **Atualização 08/10/2026:** consulte [`EXECUCAO_SPRINTS_2026-10-08.md`](./EXECUCAO_SPRINTS_2026-10-08.md) para correções realmente aplicadas, fotos preservadas, testes e pendências de build.

# F1 Universe 2029 — vertical slice jogável v0.3

Simulador manager local com 16 equipes, 32 pilotos, 32 engenheiros e 35 GPs por temporada. Continuação do protótipo existente: identidade visual, rotas e stack preservadas. O ciclo agora vai do GP1 de 2029 ao título, premiação e início de 2030, mantendo o arquivo do ano anterior.

Repositório independente em C:\Users\Tts\Documents\ChatGPT\tenis\f1-universe. O Tennis Manager da pasta superior não foi alterado.

## Abrir

Node.js 20.9+; validação no Windows com Node 24.18.1.

```powershell
cd C:\Users\Tts\Documents\ChatGPT\tenis\f1-universe
npm install
npm run dev
```

Acesse [F1 Universe local](http://localhost:3029). Para produção: `npm run build` e `npm run start`. Use apenas um servidor nessa porta.

## Como jogar

1. Na Home, escolha **Grand Prix Piloto** ou **Grand Prix Construtor**. Selecione piloto/equipe e um dos três slots. A pré-temporada começa com zero pontos.
2. Em **Fim de semana**, configure cada piloto: pneus, mapa V8, energia, regeneração, aerodinâmica, asa, balanço, ritmo, volta do pit e ordens de equipe.
3. Execute TL1–TL3. Cada treino consome jogos de pneus, quilometragem e componentes, e melhora conhecimento e confiança. **Aplicar aprendizado dos treinos** ajusta asa e balanço à estimativa da engenharia.
4. Dispute Q1, Q2 e Q3. Analise o grid invertido da Sprint; o domingo preserva o grid da classificação, sujeito a punições de grid.
5. Inicie Sprint e GP e pressione **RETOMAR**. Use **ATAQUE**, **DEFESA**, **FREADA**, **PIT** e **RÁDIO**. A freada exige gap de até 1,5 s, setor 2/3 e bandeira verde. ATAQUE/DEFESA duram duas voltas; FREADA vale por uma. PIT permite agora (fim da volta corrente), próxima volta, composto e cancelamento. No Construtor, os dois painéis estão disponíveis simultaneamente.
6. Pause ou escolha 1×/2×/4×/8×/16×. Configure eventos críticos para reduzir, pausar ou manter velocidade. Para concluir rapidamente, escolha **Manter velocidade**, **16×** e **RETOMAR**. Ao terminar, use **Ver resultado e continuar**. Mapa, projeção 3D leve e tabela Estratégia compartilham o mesmo estado.
7. Em **Temporada**, responda entrevistas, acompanhe notícias, caixa e extrato. Em **P&D**, financie upgrades. Em **Mercado**, negocie pilotos/engenheiros e troque fornecedores de bateria/pneus.
8. Avance até o GP35. O painel de campeões permite **Preparar temporada 2030**. Pontos zeram; histórico, vínculos, relações, conhecimento e desenvolvimento do carro continuam.
9. Exporte backups em **Configurações**. O JSON pode ser importado no mesmo navegador ou em outro.

## Sistemas conectados

| Sistema       | Comportamento                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estado global | Entidades vivas, carros, contratos, decisões, conhecimento, finanças, relações, estatísticas, notícias e histórico no mesmo GameState                                                             |
| Performance   | 20 atributos e 12 dinâmicos de piloto/equipe, 10 atributos e 6 dinâmicos de engenheiro; pesos gerais e específicos, conhecimento do circuito, acerto, forma, pneus, motor, bateria, clima e danos |
| Circuitos     | 35 perfis editoriais de velocidade, curvas, abrasão, eixos, regeneração, potência, tração e ultrapassagem                                                                                         |
| Clima         | Evolução de chuva, água, aderência, temperaturas, vento e umidade; previsão imperfeita e transições entre pista seca e molhada                                                                    |
| Pneus         | H/M/S/I/W, quatro marcas; aquecimento, desgaste, graining, sobreaquecimento, vida útil e risco de furo                                                                                            |
| Energia e V8  | Cinco fornecedores de bateria, oito atributos, cinco modos de energia, regeneração 1–4, mapas Economy/Race/Quali, combustível, calor, quilometragem e desgaste                                    |
| Disputa       | Largada, defesa, ataques, ultrapassagens confirmadas por troca de posição, ar sujo, Follow Mode, ordens e relações entre pilotos                                                                  |
| Operação      | Pit planejado ou reativo, undercut, troca climática, double-stack, erro de box, unsafe release, dano, falha, SC/VSC e bandeira vermelha                                                           |
| Penalidades   | 5s/10s/15s, Drive Through, Stop-Go, grid e DSQ; pontos disciplinares e escalonamento                                                                                                              |
| P&D / ATR     | Oito projetos, caixa por equipe, prazo dependente de ATR/engenharia; ganho real oculto até entrega e possibilidade de falha de correlação; ATR 75–150%, recalculado após GP12/24                  |
| Finanças      | Salários, viagens, pessoal, fornecedores, manutenção, infraestrutura, contratos, bônus e premiações com extrato por temporada/etapa                                                               |
| Mercado / IA  | Ofertas determinísticas, transferências de pilotos e engenheiros, perda de adaptação, opções e cláusulas; rivais investem e contratam segundo suas filosofias                                     |
| Carreira      | Progressão anual probabilística, envelhecimento, experiências, picos e regressões; entrevistas e notícias geradas pelos eventos, três vitórias seguidas e cinco derrotas internas                 |
| Estatísticas  | Pontos, vitórias, pódios, poles, voltas rápidas, Sprint, DNFs/DSQ, ultrapassagens, médias GP/quali, títulos e arquivo anual                                                                       |

## Regras e decisões explícitas

- Q1: 32 → 20; Q2: 20 → 10; Q3 define a pole (+2).
- Sprint inverte os blocos P1–10, P11–20 e P21–32. Pontos: 12,10,8,7,6,5,4,3,2,1. Maior ganho positivo: +1 para cada empatado; sem ganho positivo, sem bônus.
- GP: 30,27,25,22,19,16,13,11,9,7,5,3,1. Volta rápida +1, inclusive fora do top 13. DNF/DSQ não pontuam nesta versão.
- A equipe com mais pontos no fim de semana recebe +2 **apenas nos construtores**. Empate desse bônus é resolvido pelo identificador estável da equipe.
- Construtores conservam os pontos conquistados por pilotos enquanto defendiam a equipe; transferências não movem resultados anteriores.
- Empates do campeonato usam quantidade de vitórias, depois P2, P3 e assim sucessivamente nos GPs; empate absoluto usa identificador estável.
- Premiação editável: P1 US$104M, redução de US$6M por posição, P16 US$14M. P1–15 eram indefinidos no material recebido.
- No modo Construtor, contratações são trocas imediatas entre duas equipes, mantendo 32 pilotos e 32 engenheiros. A multa e taxa saem do caixa; o salário entra nas despesas. Repetir os mesmos termos na mesma etapa não muda a aceitação.
- Opção contratual pode ser exercida no último ano por 20% do salário; cláusula de piloto paga 8% do salário ao atingir a meta de pontos. Vínculos vencidos renovam automaticamente para preservar o grid.

## Persistência e arquitetura

Next.js 16.3.8, React 19.3, TypeScript e o design system existente. Fontes, ícones, SVGs e dados são locais; sem contas ou serviços externos necessários para jogar.

```text
src/data → criação do universo
src/domain/simulation/
  world.ts          estado inicial e cópia imutável
  random.ts         seeds hierárquicas e RNG
  mechanics.ts      clima, pneus, energia, setup e performance
  race.ts           voltas, boxes, disputas, incidentes e telemetria
  consequences.ts   pontos, estatísticas, relações, notícias e títulos
  management.ts     finanças, P&D, contratos, IA e nova temporada
src/domain/simulation.ts → sequência de sessões e grids
src/domain/save.ts       → schema v3, validação e migração
src/domain/persistence.ts → IndexedDB
save-provider → seletores vivos → features/components
```

O save v3 usa IndexedDB, banco `f1-universe-career`, store `saves`, chaves `slot-1`, `slot-2`, `slot-3`, metadados e espelho `active`. RaceState inclui RNG, volta/setor, ordens, box, carros, clima, rádio e estado de pausa. Cada alteração é salva; ao recarregar, a corrida continua do estado gravado. Saves v2 são migrados para Construtor; saves v1 preservam resultados. Escritas são transacionais e enfileiradas. Saves v1 são validados pelo motor legado congelado e migrados, mantendo seus pontos/resultados; não recebem telemetria retroativa nem conversão dos antigos projetos demonstrativos. A chave antiga de localStorage permanece intacta. Conteúdo inválido do IndexedDB é preservado sob chave `recovery-<timestamp>`.

A importação v3 verifica estrutura, números finitos, grid, vínculos, sequência de sessões, somas de pontos e integridade básica das gravações. Não é uma assinatura criptográfica nem um replay integral de todas as decisões de carreira. Histórico e telemetria podem ocupar dezenas de MB; exportação e importação aceitam até 200 MB. A quota disponível depende do navegador. A corrida só avança com a página de corrida aberta; não roda em segundo plano em outras páginas.

O painel **/dev** força chuva, SC/VSC, DNF, carga/desgaste, batalha de freada e conclusão de sessão. Ele altera o save ativo e identifica a corrida como DEV FIXTURE.

`npm run export:universe` gera 11 contratos JSON iniciais em `exports/unreal/`. A exportação na interface inclui o estado corrente. Não há integração Unreal executada. O contrato de assets em `src/presentation/car-assets.ts` continua separado da lógica esportiva.

## Limites desta versão jogável

A simulação trabalha por volta, com fórmulas de jogo e parâmetros editoriais; não é física validada de automobilismo. O clima não vem de serviços meteorológicos. Os perfis são ficcionais, e campeões de 2026–28 pertencem ao universo do briefing.

Treinos e classificação usam a simulação integral. Sprint e GP avançam por setores de interface; a mecânica é resolvida a cada volta com as ordens recebidas. A aba de replay continua disponível para sessões concluídas. SC/VSC/vermelha são aproximações por volta; Drive Through e Stop-Go usam perdas temporais equivalentes. A investigação dos comissários é automatizada. Não há setores físicos, punições manuais ou mercado de agentes livres/subcategorias.

A corrida ao vivo usa geometria procedural distinta por circuito, não o traçado oficial. O espaçamento dos marcadores aproxima gaps; o modo 3D leve é uma projeção CSS funcional do mesmo mapa, sem motor 3D, física espacial ou modelos low-poly. O replay histórico ainda usa o traçado conceitual original. Carros, capacetes e marcas continuam sendo assets SVG conceituais. A tabela e os eventos mostram dados efetivos da simulação.

No Piloto, propostas pós-temporada permitem aceitar/recusar uma troca. No Construtor, metas e confiança do conselho definem SECURE, UNDER PRESSURE ou AT RISK, sem demissão automática. O rádio usa templates preenchidos com telemetria.

Balanceamento de longa duração, negociação multietapas, demissões sem troca, aposentadorias/reposição de pilotos e mercado de CEOs permanecem extensões futuras. A progressão de atributos não garante diversidade suficiente de campeões; requer calibração com mais temporadas.

## Verificar

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run format:check
```

Playwright usa contextos isolados, sem tocar no save do usuário. Auditoria inicial em [PROJECT_AUDIT.md](PROJECT_AUDIT.md); evidências e limites em [docs/VALIDATION.md](docs/VALIDATION.md).

## Evolução técnica para o marco 10.250 (08/10/2026)

Consulte [`docs/EVOLUCAO_10250_EXECUCAO_REAL.md`](docs/EVOLUCAO_10250_EXECUCAO_REAL.md). O lote introduz um modelo de tráfego e estatísticas de ultrapassagens mais conservador, bloqueio seguro de troca de slot após falha de save e nova telemetria da corrida. Inclui testes automatizados de integração. O marco 10.250 **não representa 10.250 sprints concluídas**. Uma build Netlify nova exige reinstalar as dependências, rodar o build e validar o navegador.

## Atualização rumo ao marco 13.000 (2026-10-08)

Este pacote conserva os 32 pilotos com fotografias reais e integra reforços de proteção dos três slots, restauração transacional de saves, controle de largada e validação de títulos com duração dinâmica de calendário. Consulte `docs/EVOLUCAO_MARCO_13000_EXECUCAO_REAL.md` e `CHANGELOG_13000.md`. **Marco 13.000 é alvo de evolução, não contagem certificada de sprints executadas.** A versão Netlify compilada ainda depende de instalação de pacotes e validação adicional.


## Marco 50.000
Alterações concretas e cobertura de testes em `docs/EVOLUCAO_MARCO_50000.md`.

### Marco 50.000: sonoplastia procedural

O HUD da corrida agora possui botão **ATIVAR SOM** e o mixer **ÁUDIO ⚙**. Motores, vento, chuva, pits, frenagens, rádio, colisões e bandeirada são gerados pela Web Audio API e sincronizados exclusivamente a estados e eventos já existentes no motor. Dois modos de audição (**TV** e **cockpit**) e cinco ajustes de volume ficam no navegador, sem alterar os saves. O navegador exige um clique para ativar. Documentação e limites: `docs/SONOPLASTIA_50000.md`.
