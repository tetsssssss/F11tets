# F1 Universe 2029 | Evolução rumo ao marco 13.000

Data: 8 de outubro de 2026. Base: `F1_UNIVERSE_2029_EVOLUCAO_10250_CODIGO_REAL.zip`.

## Contagem e escopo

O marco **13.000 é uma meta de continuidade**, não uma declaração de 13.000 sprints implementadas. Este lote contém **7 frentes concretas** de alterações e verificações. Tudo que consta como implementado abaixo corresponde a código modificado. Não foi produzida uma nova versão Netlify compilada.

## Alterações integradas

1. **Bootstrap seguro dos três slots**. O novo módulo `src/domain/startup-slots.ts` ordena os slots, privilegia o ativo quando existe e pode recuperar outro slot válido sem confundir o espelho global `active` com o slot selecionado. O dado legado global só pode servir à migração quando não existe nenhum slot moderno.
2. **Recuperação assistida de carreiras danificadas**. A inicialização preserva dados inválidos quando possível, tenta snapshots válidos no slot afetado e bloqueia sobrescritas automáticas se havia uma carreira recuperável. Notifica quando precisa carregar outro slot.
3. **Importação e restauração duráveis**. `restoreSave()` aguarda a gravação da carreira anterior, persiste a carreira importada ou o snapshot no slot atual e só então retorna sucesso. Configurações e Recuperação usam esse fluxo. Se a escrita falhar, a restauração não é declarada concluída.
4. **Trânsito na largada**. A contenção de mudanças de posição por ritmo de volta agora também atua na primeira volta de GP/Sprint, permitindo mudanças apenas com ações de ultrapassagem reconhecidas, pit stop ou abandono. Preserva o RNG e o fluxo de resultado original.
5. **Campeonato com fim de calendário dinâmico**. O título é decidido no GP final real (`game.circuits.length`) em vez de exigir especificamente o GP 35. Os saves verificam a etapa final pelo número de rodada, não por índice fixo 34.
6. **Validação conservadora do calendário reduzido**. Um calendário prefixo com 1 a 35 eventos (mantendo IDs/ordem original e contagem coerente no mundo) pode concluir a temporada e fazer roundtrip de save. O calendário padrão continua com 35 GPs; não foi criado editor visual de calendário.
7. **Novos testes de regressão**. Arquivos `tests/startup-slots.test.ts`, `tests/starting-grid.test.ts`, `tests/dynamic-championship.test.ts` cobrindo seleção de slots, migração, largada e encerramento de temporada curta.

## Testes executados

| Evidência | Resultado | Escopo e limitação |
|---|---|---|
| Testes direcionados de domínio e apresentação | 102/102 aprovados | Dois grupos separados, executados com transpile TS→CommonJS pelo TypeScript global e `node --test` |
| Simulação Monte Carlo | 1.000/1.000 corridas concluídas | Corridas **sintéticas com 8 voltas**, não provas de distância oficial. Seed reproduzível na amostra |
| Monte Carlo: ultrapassagens | 35.190 eventos, média 35,19/corrida | Classificação de eventos do motor, não comparação calibrada com dados oficiais de F1 |
| Monte Carlo: vencedores | 3 vencedores distintos; líder com 53,6% | Concentração ainda exige balanceamento, sem alteração de rating de pilotos reais |
| Monte Carlo: abandonos | 83/1.000 | Corridas encurtadas não representam taxa de abandono de GPs completos |
| Integração de temporada | 2 fins de semana, 16 sessões, 2 GPs | Pontuação, progressão, roundtrip de save e 32 pilotos por GP |
| Calendário encurtado | 2 GPs e validação de save na pós-temporada | Não representa dez temporadas completas |
| Sintaxe TS/TSX | 155 arquivos analisados, nenhum erro sintático | Não equivale a typecheck sem dependências |
| Fotos originais | 64/64 WebP com SHA-256 idêntico | Os 32 titulares mantêm fotografias reais em dois tamanhos |

## Tentativas com limitações

- Uma tentativa da suíte completa excedeu o limite do ambiente e terminou após 16 testes aprovados; **não significa suíte completa aprovada**.
- `npm ci --offline` falhou: `vite@8.3.3` não consta no cache local do npm.
- `npm run build:netlify` falhou: `vite: not found`.
- `npm run typecheck` falhou com módulos React/tipos ausentes no ambiente. A validação de sintaxe separada passou, mas não comprova tipagem integral.
- Não houve validação Playwright E2E ou build Netlify atualizada.
- Não foi concluído teste de dez temporadas; nem motor físico separado de F2/F3, circuitos geograficamente fiéis ou nova IA de estratégia de longo prazo.

## Recomendações antes de publicar

1. Instalar dependências em ambiente com registry disponível (`npm ci`), executar `npm run typecheck`, `npm test`, `npm run build:netlify` e `npm run test:e2e`.
2. Executar migração real de três slots IndexedDB no navegador, alternando carreira ativa, restaurando snapshot e simulando falha de quota.
3. Realizar testes completos de temporadas múltiplas, observando integridade e crescimento dos saves.
4. Balancear ultrapassagens, domínio das equipes e taxas de falha usando distribuição por circuito/distância real, mantendo seeds reproduzíveis.
5. Preservar as fotografias reais e documentar direitos de redistribuição quando houver publicação pública.

**Entregável desta rodada:** código-fonte alterado com testes, dados e fotos preservados. **Não** há certificação de 13.000 tarefas individuais nem ZIP Netlify compilado desta versão.
