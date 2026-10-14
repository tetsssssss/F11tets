# F1 Universe 2029 — lote evolutivo rumo ao marco 10.250

**Data:** 2026-10-08. **Base:** F1_UNIVERSE_2029_SPRINTS_CODIGO_ATUALIZADO.zip.

## Política de contagem

O marco **10.250 é uma meta**, não dez mil entregas verificadas. As mudanças deste lote correspondem a **12 tarefas técnicas com código/testes**; não afirmamos que as sprints 1.001–10.250 foram integralmente executadas. O número do marco é uma referência de continuidade, não uma contagem de funcionalidades concluídas.

## Lote de 12 entregas executadas

| Entrega | Alteração real | Arquivos |
|---|---|---|
| 1 | Reconhecimento de passes de pista usando posição prévia, mudança de ordem e proximidade | `simulation/overtaking.ts` |
| 2 | Exclusão de pit stops da contagem de passes, por **piloto**, não pela equipe inteira | `simulation/race.ts`, `simulation/overtaking.ts` |
| 3 | Exclusão de abandono e neutralização de passes confirmados | `simulation/overtaking.ts` |
| 4 | Restrição determinística de reordenação por tempos de volta sem tentativa de ataque bem-sucedida | `simulation/track-order.ts`, `simulation/race.ts` |
| 5 | Cobrança do tempo perdido no trânsito também na última/melhor volta | `simulation/track-order.ts`, `simulation/race.ts` |
| 6 | SaveWriter bloqueia `drain()` após falha persistente de armazenamento até sucesso posterior | `domain/save-writer.ts` |
| 7 | UI impede troca ou criação de slot após falha ao persistir o slot anterior | `components/save-provider.tsx` |
| 8 | Telemetria televisiva em tempo real derivada apenas do motor (pits, passes, DNFs, incidentes) | `presentation/race-pulse.ts`, `features/live-race.tsx` |
| 9 | Atalhos de teclado para pausa e Race Theater sem interferir em campos ou botões | `features/live-race.tsx` |
| 10 | Melhorias responsivas de microtipografia e cartões estatísticos | `app/globals.css` |
| 11 | Bateria automática determinística de testes sobre passes, tráfego, saves e telemetria | `tests/overtaking-integrity.test.ts`, `tests/track-order.test.ts`, `tests/race-pulse.test.ts`, `tests/save-writer.test.ts` |
| 12 | Teste de integração de duas rodadas e observabilidade de Monte Carlo com métricas sem campo fictício | `scripts/qa-weekend-integration.ts`, `scripts/qa-montecarlo.ts`, `package.json` |

## Evidências observadas

- **30/30 testes direcionados aprovados** (`/tmp/f1_targeted_10250_final.log` durante a execução).
- **85/85 testes adicionais aprovados**, incluindo categorias F2/F3, assentos, carreira de acesso, replay, apresentação e pulso de temporada.
- **2.000 corridas sintéticas de 8 voltas** realizadas. 4 vencedores diferentes, 165 abandonos, 131.691 eventos classificados como ultrapassagem após as alterações. Não equivale a 2.000 GPs de duração oficial.
- **60 corridas antes da alteração** registravam 9.217 ultrapassagens. Em 60 corridas comparáveis após as mudanças de trânsito, 3.724; redução expressiva, mas ainda não validada contra dados reais da F1.
- **2 fins de semana completos**: 16 sessões, 2 GPs, 32 pilotos em cada resultado e verificação de save após avanço de rodada.
- **64/64 arquivos WebP originais** preservados com hashes idênticos aos do pacote de trabalho anterior.
- Inspeção TS sintática possível por transpileModule; **não** equivale a `tsc --noEmit`.

## Limitações e decisões honestas

- O teste de temporada longa foi interrompido por limite de tempo. **Não foi aprovado nem concluído** nesta rodada.
- O comando `npm run build:netlify` falhou porque o pacote executável `vite` está ausente. **Nenhum Netlify ZIP novo** foi declarado pronto.
- Os 2.000 GPs encurtados indicam predominância de Max Verstappen nas seeds amostradas; o balanceamento esportivo ainda requer simulação de sessões e corridas completas, circuitos variados e métricas comparáveis.
- F2/F3 completos com motor físico separado, fotografias de novos pilotos reais, fidelidade de circuitos, E2E e 10 temporadas continuam pendentes.
- A classificação de ultrapassagens é conservadora, pois a engine opera no nível da volta; não existe observação real de cada troca de posição dentro de um setor. O efeito de tráfego muda o resultado esportivo e exige validação adicional antes de uma release pública.
- Não foram alteradas fotografias ou removidas fotos reais devido a licença desconhecida. Questões de redistribuição permanecem documentadas.

## Continuidade recomendada

1. Recuperar dependências do repositório e executar `npm ci`, `npm run typecheck`, `npm test`, `npm run build:netlify` e E2E.
2. Testar o modelo de tráfego/ultrapassagens em 10 temporadas e ajustar sem quebrar seeds ou saves.
3. Implementar modelo de classificação física F2/F3 (hoje parte é simulação de campeonato/replay representativo).
4. Melhorar memória e arquivos históricos após 10 temporadas.
5. Ampliar interações de carreira, contratos, academias, apresentações e circuitos por etapas testadas.

**Entrega:** somente código-fonte atualizado. Build Netlify e marcos 1.013–10.250 não são certificados como implementados.
