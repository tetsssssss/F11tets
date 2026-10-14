# F1 Universe 2029 | Execução efetiva das sprints e estado de entrega

Data: 08/10/2026. Projeto: F1 Universe 2029. Base: código-fonte corrigido com fotografias reais, incorporando também as implementações existentes na cópia de trabalho das sprints de F2, F3, academias, assentos e central da carreira.

## Critério de honestidade

Este documento não declara que *todas* as sprints numeradas até 1000 foram concluídas. As sprints 21–100, 101–600 e 601–1000 tiveram implementações parciais em outras etapas, como registrado em `docs/SPRINTS_21_100_F1.md`, `docs/SPRINTS_101_600_F1.md` e `docs/SPRINTS_601_1000_F1.md`. A base de trabalho continha recursos implementados, mas muitas metas e testes de release ainda estavam pendentes. As mudanças novas abaixo foram efetivamente aplicadas ao código desta entrega.

## Implementações novas nesta entrega

### Sprint P1: autosave estável e otimização de escrita

- Adicionado `src/domain/save-writer.ts`, um coordenador assíncrono de gravação.
- Durante corridas rápidas, estados consecutivos são coalescidos em uma gravação recente, com teto de frequência, sem gerar uma fila ilimitada de dumps do save completo.
- Finalizações e decisões fora de corrida exigem flush imediato; `switchSlot` e `createSlot` aguardam as gravações pendentes antes de mudar slots.
- Evento `visibilitychange`/`pagehide` tenta descarregar a versão mais recente, mas encerramento abrupto pode interromper IndexedDB; exportação manual continua recomendada.
- Erros de armazenamento são informados, e gravar novamente após falha não bloqueia a fila.
- A atualização dos metadados dos cards de slots é mantida após cada gravação bem-sucedida.
- O formato/schema do save **não foi alterado**. Não há exclusão automática de telemetria nem resultados históricos.

### Sprint P1: feed de corrida televisivo sem apagar incidentes

- Adicionado `src/presentation/race-feed.ts` e integrado em `src/features/live-race.tsx`.
- Modos MINIMAL / TV / TECHNICAL filtram a apresentação dos eventos já produzidos pelo motor.
- Eventos repetidos do mesmo piloto/ação/volta são agrupados, com indicação de quantidade.
- Incidentes e mudanças de posição de pilotos/oponentes diferentes continuam separados; nenhuma ação é inventada.
- O log técnico completo permanece na interface, inalterado.
- CPU de seleção do feed limitada aos últimos 240 eventos e 50 itens exibidos, para preservar fluidez ao longo de corridas extensas.

### Sprint P2: controle de telemetria, clareza e agenda

- `src/features/settings.tsx`: escolha explícita entre telemetria completa e resumida para corridas futuras, explicando a consequência sobre replays. Dados históricos já arquivados não são alterados pela configuração.
- Corrigida indicação antiga `Schema v3` para versão efetiva do save (`v4`).
- Contagem de corridas usa tamanho do calendário carregado, em vez de texto fixo.
- `src/domain/simulation.ts`: progresso de rodada usa o tamanho real do calendário carregado, eliminando constantes fixas 35/36 nesses fluxos.
- Modo 2D/3D, fotografia, F2, F3, mercado e carreira existentes foram preservados.

### Sprint P2: observabilidade estatística e testes de regressão

- `scripts/qa-montecarlo.ts`: simulação determinística parametrizável de corridas com seeds diferentes, verificações de grid, classificação, pontuação, status e replay.
- `scripts/qa-season-soak.ts`: percorre sessões reais e passagem de temporada com serialização/validação do save, quando executado.
- Novos testes: `tests/race-feed.test.ts`, `tests/save-writer.test.ts`, `tests/calendar-boundary.test.ts`.
- Testes existentes de fotos, etiquetas, câmeras, persistência e pulso de temporada continuam passando.

## Resultados efetivamente verificados

- **27/27 testes direcionados aprovados**: persistence (6), 3D tags (2), fotos (1), season pulse (4), camera (4), feed (4), writer (5), calendar (1).
- **143 arquivos `.ts`/`.tsx`/`.mjs` analisados**, sem erros de sintaxe de TypeScript; teste sintático não equivale a compilação semântica.
- **64/64 WebP reais dos 32 pilotos originais preservados byte a byte**, por SHA-256 contra o ZIP do usuário.
- **3 temporadas reais consecutivas, 840 sessões e 105 Grandes Prêmios**: de 2029 a 2031, com arquivamento, passagem de ano e validação de JSON após cada temporada. Save com telemetria resumida cresceu de 14.185.019 bytes (1 ano) para 26.892.982 (2 anos) e 39.364.833 bytes (3 anos), o que mantém a necessidade de otimização de histórico.
- **2.000 corridas GP sintéticas de oito voltas concluídas** com resultado estrutural válido e mesmo replay para a mesma seed. Não são 2.000 corridas de distância regulamentar completa nem uma validação de equilíbrio.
- Nessas 2.000 amostras, 5 vencedores distintos, 162 DNFs e 323.975 eventos classificados como ultrapassagem. Essa frequência de ultrapassagens exige auditoria física/estatística adicional; não foi ocultada nem alterada artificialmente.
- A dominância de um piloto em corridas curtas também é um sinal de ajuste de balanceamento, não uma prova de erro de algoritmo por si só.

## Pendências que NÃO estão implementadas / certificadas

1. **Build Next e Netlify novas:** `npm ci` falha ao buscar tarballs do registro npm (erro `EAI_AGAIN`); `npm run typecheck` falha porque os tipos `node`, `react`, `react-dom` não estão instalados. Não há build de produção atualizada nesta entrega.
2. **E2E visual no navegador:** ainda sem execução reproduzível desta cópia; atenção especial a mobile 390px, menus F2/F3, gestão de assentos e 3D.
3. **Realismo da pista e IA:** resultados de Monte Carlo indicam excesso de eventos de ultrapassagem e possível concentração de vitórias. Precisa de investigação do motor físico e nova calibração com cenários comparáveis e corridas completas. Corrigir sem testes alteraria resultados de saves.
4. **F2/F3 passo a passo de verdade:** a base tem campeonato F2/F3, classificação, resultados e replay ilustrativo, mas não uma engine física completa de pneus/boxe/SC equivalente à F1.
5. **Retratos de personagens fictícios:** não devem receber fotografias erradas de pilotos reais. As 32 fotografias dos titulares nunca foram removidas.
6. **Circuitos oficiais calibrados:** ainda existem traçados estilizados e sem geometrias profissionais oficiais.
7. **Validação obrigatória de dez temporadas e release candidata com 100% de testes de integração:** ainda não certificada.
8. **Licenças de distribuição de retratos:** preservadas as fotos originais e a origem; sem declaração inventada de autorização para divulgação pública.

## Comandos ao recuperar dependências

```bash
npm ci
npm run typecheck
npm test
npm run audit:photos
npm run build:netlify
npm run test:e2e
npm run qa:montecarlo
```

Teste adicional de temporada real, sem build:

```bash
npx tsx scripts/qa-season-soak.ts 3
```

O **ZIP desta entrega é o código-fonte**, não um build Netlify. Só distribua um ZIP Netlify atualizado quando `npm run build:netlify` conseguir gerar `dist-netlify` a partir deste código e os testes de navegação passarem.
