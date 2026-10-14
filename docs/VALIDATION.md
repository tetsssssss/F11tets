# Validação — F1 Universe v0.3

Executada em 04/10/2026 no Windows, no repositório independente f1-universe.

## Verificações executadas

| Verificação       | Resultado                                                                     |
| ----------------- | ----------------------------------------------------------------------------- |
| npm install       | Concluído, dependências atualizadas; auditoria retornou zero vulnerabilidades |
| npm run typecheck | Sem erros                                                                     |
| npm test          | 40 testes passaram                                                            |
| npm run build     | Build de produção concluído                                                   |
| npm run test:e2e  | 30 testes passaram: 15 desktop + 15 Pixel 7                                   |
| export:universe   | 11 JSONs regenerados, schema v3                                               |

Após ajustes finais de rótulos do mapa, autosave e relações do conselho, typecheck, 40 testes de domínio e build foram repetidos com sucesso. Os seis testes de gameplay foram repetidos sobre o build final: 6/6 passaram. A auditoria encontrou 96 rotas respondendo HTTP 200, sem erros JavaScript. As quatro resoluções de Home passaram sem overflow. As capturas finais de corrida em desktop e Android foram inspecionadas visualmente.

## Cobertura que sustenta a entrega

- Paridade da corrida incremental com o caminho integral do motor, sem comandos adicionais.
- Serializar no meio da corrida e retomar produz exatamente o mesmo estado final, incluindo RNG, ordens e chamadas de pit.
- Ataque e conservação têm efeitos diferentes em energia/desgaste; ordens expiram; freada requer oportunidade; pit muda composto e registra parada.
- Piloto não comanda o companheiro nem contrata talentos; Construtor mantém dois comandos independentes. Relação baixa pode causar recusa real.
- Rádio usa carga e desgaste reais do save. Eventos forçados do painel /dev têm cobertura.
- Pontos não duplicam ao recarregar/concluir; grids, bônus, ATR, premiações e 35 GPs mantêm testes existentes.
- Campanha do Piloto completa 35 etapas, recebe proposta, transfere assento e aceita restauração do save. Campanha do Construtor mantém teste até início jogável de 2030.
- No navegador: novo save → seleção do modo → TL1–3 → Q1–3 → Sprint → GP → classificação → reload → troca de slot sem perda dos pontos. Executado em ambos os modos e tamanhos de tela.
- Freada ativada em batalha controlada por /dev; bloqueada sob SC. Visualização leve compartilha os 32 carros.
- Mercado, P&D, entrevistas, importação/exportação, recuperação e navegação existentes continuam testados.

## Evidências visuais

- screenshots/live-piloto-desktop.png e screenshots/live-construtor-desktop.png
- screenshots/live-piloto-android.png e screenshots/live-construtor-android.png
- Capturas de Home em 1920×1080, 1366×768, 768×1024 e 390×844.
- Evidências adicionais: final-route-audit.json e visual-qa.json.

Contextos de navegador isolados foram usados nos testes; eles não alteram o save pessoal do usuário. Testes em emulação móvel não substituem medição em telefone físico. Os testes comprovam fluxos e integridade do estado, não balanceamento esportivo real ou física validada.
