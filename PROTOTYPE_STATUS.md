# F1 Universe 2029 — vertical slice v0.3

Data da entrega: 04/10/2026. Projeto: f1-universe, separado do Tennis Manager.

## Auditoria inicial

A base v0.2 já continha Next.js/React/TypeScript, 16 equipes, 32 pilotos e engenheiros, 35 GPs, atributos, regras, clima, pneus, energia, incidentes, contratos, P&D, finanças, progressão anual e replay. O loop calculava uma sessão inteira ao clicar em iniciar; não havia decisões durante Sprint/GP, modos explícitos, três slots nem RaceState persistente.

As alterações locais anteriores foram preservadas. O grid corresponde ao briefing recebido. Não foi identificado um documento separado V1.2 nem um valor explícito de peso mínimo; os dados e regras existentes foram mantidos. Nenhum valor regulamentar adicional foi inventado.

## DONE

- Home com Grand Prix Piloto, Grand Prix Construtor, novo jogo e continuar.
- Escolha de piloto/equipe, seed, três slots e confirmação de substituição de slot ocupado.
- Piloto controla um carro; Construtor controla dois painéis simultâneos. Troca livre de equipe fica bloqueada após iniciar carreira.
- Treinos e Q1/Q2/Q3 preservados. Sprint inverte blocos 1–10, 11–20 e 21–32; GP mantém o grid normal da classificação.
- Sprint/GP incrementais, pausa e 1×/2×/4×/8×/16×; autoeventos configuráveis. Mecânica por volta, setores como pontos de entrada de comando.
- ATAQUE, DEFESA, FREADA, PIT e RÁDIO alteram o estado usado pelo motor. Ordens de 1–3 voltas, custos de energia/pneu/temperatura, chance de recusa do piloto no modo Construtor e resultados probabilísticos.
- Freada condicionada a gap até 1,5 s, setor 2/3 e bandeira verde; oportunidade bloqueada tem explicação. Erros podem gerar travamento e perda de tempo.
- Pit agora, próxima volta, cancelar e composto; troca efetiva, tempo perdido, desgaste reiniciado, double-stack e incidentes do motor preservados. Janela e tráfego estimados.
- Rádio baseado em telemetria atual, conservação/energia/ritmo, ordens entre companheiros e permanência em pista. Destinatário piloto/engenheiro no Construtor.
- Mapa com 32 carros, cores de equipe, setores, frenagens, pit lane e largada. Geometrias determinísticas distintas por circuito.
- Estratégia com posição, gap, composto/idade/desgaste, bateria, última volta e pit.
- Relação CEO–piloto: Confiança, Respeito, Lealdade, Satisfação e Obediência. Conselho com metas, confiança e SECURE / UNDER PRESSURE / AT RISK.
- Propostas pós-temporada no modo Piloto, aceitar/recusar e transferência com preservação de duas vagas por equipe e pontos históricos.
- Save v3 serializável incluindo RNG, ordens, pit, rádio, volta/setor e carros; IndexedDB transacional, autosave, três slots, importação/exportação, migração v1/v2 e recovery de saves inválidos.
- /dev: chuva/seco, SC/VSC, DNF, bateria, desgaste, batalha de freada, resultado e salto de sessão.
- Setup de suspensão/freios adicionado aos controles existentes; conservação de pneus e risco de travamento usam essas escolhas.
- Pontuação, bônus de construtores, ATR, premiações e continuidade para 2030 preservados.

## PARTIAL

- 3D leve: projeção CSS funcional do mapa e carros do mesmo RaceState. Não há Three.js, modelos low-poly, câmera livre ou física espacial.
- Circuitos: geometria procedural conceitual, não reprodução licenciada dos traçados reais. Posições visuais interpolam os gaps; resolução esportiva é por volta.
- Treinos/quali continuam sendo calculados integralmente; corrida ao vivo é Sprint/GP.
- Conselho acompanha desempenho e problemas de operação; demissão e mercado de CEOs não implementados.
- Propostas de piloto usam até três candidatos e troca de assentos; não há agente, negociação multietapas ou vagas livres.
- A corrida avança apenas na página de pista. Ao navegar para outras telas, o estado fica preservado.
- Autosave persiste o estado por alteração; aguarde o indicador Salvo antes de fechar. Quota depende do navegador, especialmente após várias temporadas.

## MOCKED

- Ratings e perfis editoriais, calendário/clima conceituais, engenheiros e história ficcional conforme proveniência já existente.
- Carros/avatares conceituais; nenhuma nova busca de fotos ou alegação de dados oficiais.
- Rádio por templates preenchidos com estado atual. Fórmulas de jogo, sem física validada de automobilismo.
- Ações /dev são fixtures e marcam a corrida. Não confundir testes forçados com resultados competitivos normais.

## NEXT

1. Calibrar efeitos de comandos, recusa e incidentes com campanhas longas e sessões de jogadores.
2. Substituir geometria procedural e projeção leve por assets/câmera 3D, preservando o contrato de RaceState.
3. Para futura integração Unreal, consumir os contratos JSON v3 e os IDs existentes; não portar UI nem iniciar Unreal nesta entrega.

## Validação

Resultados e evidências em docs/VALIDATION.md. Guia de execução e jogabilidade em README.md.
