# F1 Universe 2029 — Sonoplastia de corrida (Marco 50.000)

## Entregas implementadas

- Motor procedural em Web Audio: camada de motor e harmônicos, oscilação de carga, turbo e ruído de vento.
- Ambiência de chuva e vento reagindo à água na pista, setor, flags e estado do carro de referência.
- Eventos sonoros estritamente vinculados às ocorrências registradas: contatos/colisões, travadas de pneu, ultrapassagem, falha/abandono, pit stop, comandos de rádio e bandeirada.
- Sequências curtas diferenciadas para roda/pneumático (pistola), rádio e bandeirada; transientes de ruído filtrado para impacto, pneus e boxes.
- Sonoridade em dois presets: transmissão de TV e cockpit (mais motor, menos ambiente).
- Mixer independente: volume geral, motores, incidentes, vento/chuva e rádio.
- Botão de ativar/silenciar, teste de rádio e painel de mixagem no HUD do Race Theater e na Corrida Rápida.
- Preferências sonoras locais por navegador, sem alterar o schema nem os saves existentes.
- Bloqueio contra excesso de efeitos em velocidade 8×/16×; sons prioritários, máximo de um evento de corrida por atualização, limitação temporal e graph de áudio reutilizado.
- O áudio somente é iniciado após interação explícita do usuário e é desligado/encerrado ao sair da corrida. Aba escondida é silenciada.

## Vínculo técnico com a simulação

Arquivos:

- `src/audio/race-sound.ts`: sintetizador, mixer, categorização de eventos e derivação puramente visual do som.
- `src/features/race-sound-controls.tsx`: integração com React, ciclo de vida e controles do jogador.
- `src/features/live-race.tsx`: montagem no HUD, seguindo piloto selecionado ou líder.
- `src/app/globals.css`: estilo e layout responsivo.
- `tests/race-sound.test.ts`: proteção de eventos, ajustes, save e estado de corrida.

O ruído de motor representa **carga estimada visualmente**, não RPM medido. O áudio é **sintetizado**, sem amostras de motores gravados nem voz real dos pilotos. A comunicação por rádio usa alerta sonoro e mantém o texto já existente; não há dublagem TTS nesta entrega. Os eventos nunca são inventados ou adicionados ao motor esportivo para produzir som.

## Verificações concluídas

- Testes de domínio completos antes dos últimos ajustes sonoros: 245/245 aprovados.
- Testes de domínio focados da sonoplastia após os últimos ajustes: 7/7 aprovados.
- Build estática offline gerada com 105 módulos de fonte, sintaxe validada, sem Vite neste ambiente.
- Seis rotas isoladas do Chromium sem exceções JavaScript.
- Corrida Rápida carregada; mixer ativado, volume ajustado, rádio testado e áudio silenciado sem erro JS no Chromium.
- Fotografias reais originais: 64 WebP presentes tanto na fonte quanto na publicação.

## Pendências e limites de validação

- Compilação oficial Vite/Next, navegação HTTP de hospedagem real e teste auditivo subjetivo em aparelhos físicos não foram realizados.
- O áudio depende da API Web Audio e das políticas de reprodução do navegador: é preciso clicar em **ATIVAR SOM**.
- A síntese atual é ilustrativa: gravações oficiais e vozes originais não foram incorporadas.
