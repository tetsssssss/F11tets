# Guia Android / Xiaomi — F1 Universe 2029 · Marco 61000

## 1. Abrir no Chrome
1. Publique a pasta do ZIP `F1_UNIVERSE_2029_MARCO_61000_NETLIFY_PWA.zip` no Netlify (arrastar e soltar a pasta extraída em *Deploys*), ou hospede em qualquer servidor HTTPS estático.
2. Abra o endereço no **Chrome para Android** (recomendado; navegadores MIUI antigos podem não ter WebGL 2 estável).
3. Na primeira visita, deixe a página carregar com internet: o motor 3D e os modelos dos carros ficam guardados para uso offline.

## 2. Instalar na tela inicial (PWA)
Menu ⋮ do Chrome → **Instalar app** (ou *Adicionar à tela inicial*). O ícone abre o jogo em tela cheia, sem barra do navegador.
Seus saves ficam no armazenamento do navegador (nunca vão para a rede). **Exporte uma cópia antes de limpar dados do Chrome.**

## 3. A corrida em uma tela só
- **Retrato:** faixa superior compacta (volta, clima, TIMING), três botões de visão (2D TÁTICO · 2.5D · 3D BABYLON), PAUSAR/RETOMAR, +SETOR e velocidade; palco dominante no meio; **Race Control** recolhido embaixo e **comandos do piloto** (ATAQUE · DEFESA · FREADA · PIT · RÁDIO) sempre visíveis no rodapé.
- **Paisagem:** palco à esquerda; coluna da direita com controles e comandos; o menu lateral vira gaveta (botão ☰).
- No **Modo Construtor** os dois pilotos têm cartões separados; toque no cartão para escolher o piloto ativo.
- Race Control e TIMING abrem como gavetas: toque em *Ver dados da corrida*. A corrida continua visível acima.

## 4. Câmeras 3D (seletor “CÂMERA 3D”)
| Câmera | O que faz |
|---|---|
| **Auto (TV)** | Diretor automático: largada, líder, disputas, ultrapassagens, incidentes e pit stops. Troca com carência para não “piscar”. |
| TV | Segue seu piloto e enquadra de 2 a 3 carros próximos. |
| Disputa | Enquadra a melhor disputa da pista (2 carros). |
| Seguir piloto | Câmera de perseguição baixa, só no piloto escolhido. |
| Estratégica | Visão aérea do circuito inteiro. |
| Box | Fica ao lado do pit lane acompanhando entrada → parada → saída. Sem parada em curso, volta para TV. |
| Onboard | Câmera no carro. |

Uma câmera escolhida manualmente **permanece** até você voltar para *Auto (TV)*. Mudanças bruscas usam um corte rápido com escurecimento (desligado se o Android estiver com “remover animações”).

## 5. Qualidade gráfica e bateria
- Seletor **QUALIDADE 3D**: *Baixa* (padrão no celular), *Média*, *Alta*, *Ultra*. Mais qualidade = mais pixels, mais detalhe nos carros (GLB “high”), mais árvores/prédios e mais mecânicos no pit.
- **AUTO-QUALIDADE** (desligado por padrão): se marcar, o jogo reduz um nível sozinho quando a fluidez fica abaixo de ~24 FPS por vários segundos e avisa na tela. Nunca sobe sozinho.
- Para poupar bateria: use *Baixa*, velocidades 2×–4× e 2D TÁTICO quando não precisar do 3D.

## 6. Quando o 3D não está disponível
Se o aparelho não tiver WebGL ou o contexto for perdido (app em segundo plano por muito tempo), o jogo **volta ao 2D sem interromper a corrida**, mostra um aviso e mantém classificação, voltas e comandos. Tudo funciona offline depois da primeira visita.

## 7. Limites honestos
Os números de FPS medidos nesta entrega vieram de renderização por software em ambiente de teste (ver `QA_MARCO_61000.json`). **Não houve medição em um Xiaomi real** nesta etapa; use a seção 5 para ajustar no seu aparelho e consulte `BACKLOG_MARCO_61000.md` (item “benchmark em aparelho real”).
