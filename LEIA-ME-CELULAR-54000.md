# F1 Universe 2029 | Marco 54.000 | Modo celular

Base: Marco 52.000. A simulação de F1, saves, carreira, dados e fotos não foram alterados.

## O que mudou
- Barra inferior de atalhos para Início, GP, Corrida, Gráficos e Menu no celular, oculta durante a corrida para aproveitar a tela.
- Na corrida rápida e na carreira, uma barra própria de toque oferece **2D Tático / 2.5D / 3D Babylon** sem rolagem horizontal para localizar o botão.
- Velocidade da corrida no celular com seletor 1x, 2x, 4x, 8x, 16x e AUTO.
- Controles de pausa e setor preservados, timing em painel sobreposto e HUD compacto.
- Tamanho mínimo dos botões de corrida de 43-44 px, com suporte a áreas seguras (safe-area).
- Ajuste do espaço disponível para pista, cabeçalho, dock dos pilotos e tabela com rolagem horizontal local.
- Laboratório Babylon com controles e canvas adaptados à largura do celular.
- Pré-configuração gráfica baixa em telas até 680 px, ajustável pelo usuário.
- Desktop mantém interface e botões de velocidade anteriores.

## Como testar
1. Faça deploy do conteúdo do ZIP Netlify, sem extrair para uma subpasta adicional no deploy.
2. Abra no celular em modo retrato. Entre em Corrida rápida e inicie uma prova ou continue uma corrida da Carreira.
3. Use os botões 2D TÁTICO, 2.5D e 3D BABYLON logo abaixo da volta.
4. Selecione a velocidade no controle compacto, TIMING, e toque nos comandos do piloto.
5. Se o Babylon não carregar na rede, use o retorno para 2D exibido pela aplicação.

## Limitações
A build Netlify pode ser a compilação estática offline alternativa (não `vite build`), mantendo as dependências de runtime do pacote base. O Babylon 3D depende de CDN nesse modo e não está homologado por renderização WebGL real neste ambiente. Testes de navegação/JS não garantem performance em hardware real.
