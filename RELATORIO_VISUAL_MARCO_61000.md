# Relatório visual — F1 Universe 2029 · Marco 61000

Base: **Marco 60300 (incidentes)**, sem retrocesso a 59000/57000. Todo o trabalho é de apresentação: `RaceState` e `tickLive` continuam sendo a única simulação; 2D, 2.5D e 3D leem o mesmo `presentRace()`.

> **Honestidade de medição.** Nenhum Xiaomi/Android real estava disponível. Capturas e números abaixo vêm de Chromium com WebGL por **software (SwiftShader)**; FPS de software (2–10 FPS com 32 carros) não representa um celular e **não comprova 30 FPS**. O benchmark em aparelho real está no backlog.

## 1. Como a corrida era antes (baseline 60300, 390×844)
- O HUD ocupava ~1,5 tela (`min-height:555px` + cabeçalho da página + 3 faixas de controles): o palco começava em y≈372 e o rodapé (**PIT/comandos**) ficava abaixo da dobra (`docs/qa-shots/before/390x844-*.png`).
- A câmera TV em Babylon usava `Lerp(…, .09)` fixo (dependente de FPS) e `setTarget` com salto; nenhuma câmera enquadrava disputas de forma automática; roda de GLB girava em torno da origem do carro, não do centro do pneu; havia duas fórmulas de `setHardwareScalingLevel`; o fade de arquibancadas/boxes não funcionava em materiais glTF opacos.

## 2. O que foi implementado (arquivo a arquivo)
| Arquivo | Mudança |
|---|---|
| `src/app/globals.css` | Bloco “MARCO 61000”: cockpit de 1 tela em retrato (`100dvh`, sem `min-height`), layout de paisagem com coluna de comandos à direita, sidebar em gaveta em paisagem de celular, Race Control expandido sem esmagar o palco, tags/corte/AUTO‑QUALIDADE. |
| `src/features/live-race.tsx` | Rola o HUD ao topo no celular; timing/Race Control recolhidos em telas curtas. |
| `src/features/race-control.tsx` | Abre recolhido a menos que a janela tenha ≥800 px de altura. |
| `src/presentation/broadcast-director.ts` (novo) | Diretor Babylon puro: `smoothingAlpha = 1-exp(-dt/τ)` (posição τ 0,26–0,55 s, alvo 0,16–0,35 s, FOV), enquadramento de 2–4 carros, antecipação de curva, cortes com fade (`CutFade`), âncoras alternativas, mapeamento `pickShot` → câmera, rodas/esterço (±18°). |
| `src/presentation/babylon-camera.ts` | `sceneryVisibility` aceita câmera `pit`. |
| `src/presentation/babylon-quality.ts` (novo) | Fórmula única DPR/perfil, `lowerQuality`, `FpsGovernor` (queda sustentada <24 FPS por 6 s, carência 15 s). |
| `src/presentation/scenery-plan.ts` (novo) | Planejador determinístico do kit de cenário (PRNG próprio por circuito; nunca toca o RNG da corrida). |
| `src/features/live-race-babylon.tsx` | Rig de câmera (posição/alvo/FOV exponenciais, corte, anti‑obstrução por raycast a 3 Hz), pivôs de roda, sombra de contato, vibração só em WIDE/LOCKUP/incidente, kit de cenário com *thin instances* em 4 chunks, tags de piloto sem sobreposição, mecânicos 4–12 por perfil, materiais memoizados, `dispose`, perda de contexto WebGL, fade real de estruturas (material alpha clonado), diagnósticos em `window.__f1Babylon`. |
| `src/features/live-map.tsx` | Seletor Auto/TV/Disputa/Seguir/Estratégica/Box/Onboard (câmera manual permanece até AUTO), AUTO‑QUALIDADE com consentimento, chip de status do box (chamada real do motor + estágio, **sem duração inventada**). |
| `public/sw.js` | Cache `f1-universe-static-61000-v1`. |
| `netlify/index.html` | `<link rel="icon">` (removeu o 404 de `favicon.ico`). |
| `playwright.config.ts` | `F1_CHROME` opcional para apontar o Chromium disponível. |
| `scripts/qa-*.mjs`, `scripts/build-qa-report.mjs` | Capturas por viewport, corrida real com ciclo de câmeras, agregador de QA. |
| `package.json`/lock, `shell.tsx` | Versão `0.61.0` e rótulo “MARCO 61000”. |

## 3. Evidência por sprint
**Sprint 01 — layout mobile.** Matriz 360×800, 390×844, 412×915, 430×932, 800×360, 915×412 e 1366×900, 2D e 3D, motorista: **0 px de rolagem horizontal em todos**; HUD ocupa exatamente a janela nos celulares (y=0, h=viewport); palco 383–543 px em retrato; PIT visível (teste e2e). Antes/depois: `docs/qa-shots/before` × `docs/qa-shots/after`; números em `docs/qa-shots/after/metrics.json`.

**Sprint 02 — diretor TV.** Teste unitário prova independência de FPS (30/60/144 FPS convergem ao mesmo valor), cortes só em saltos grandes, reduced‑motion sem fade, âncora livre escolhida quando bloqueada. Corrida real de 32 carros em `scripts/qa-babylon-camera.mjs`: AUTO escolheu *Disputa* (lap 3, ANT×NOR) e as câmeras TV/Disputa/Seguir/Estratégica/Onboard mudam como pedido; câmera manual persiste (e2e). Capturas em `docs/qa-shots/camera*`. **Não** foram gravados clipes de 15–30 s.

**Sprint 03 — carros legíveis.** Sem alterar a geometria. Em 390×844 os carros em foco medem (retângulo projetado, maior lado): TV ≈ 89–90 px, Disputa ≈ 74–76 px, Seguir ≈ 73 px — dentro das faixas-alvo (TV 50–110, disputa 65–140). Tags “P2 ANT / P1 NOR” só para os carros em foco/selecionado/próprio. Diagnósticos `progress/elapsed/laneOffset` por carro em `window.__f1Babylon.diag`.

**Sprint 04 — GLB.** As rodas ganharam pivô no centro do pneu (raio do bounding box); giro = distância/raio; esterço = `atan(curvatura·entre‑eixos)` limitado a ±18°. Pausa e reduced‑motion param as micro‑animações; 0,50× escala naturalmente (deriva do deslocamento exibido). Trocar mobile↔high reconstrói os carros dos containers em cache sem perder o estado da corrida.

**Sprint 05 — cenário.** Cada um dos 35 circuitos tem um **perfil próprio** (`CIRCUIT_PROFILE` em `src/presentation/scenery-plan.ts`): 11 looks (parque, urbano, deserto, dunas, porto, pinheiral, tropical, alpino, planície, neon, costa), 16 tipos de adereço (árvore, pinheiro, palmeira, prédio, torre, casa com telhado, hangar, poste, mastro de refletor, duna, colina, pico, água, iate, painel neon, roda-gigante) como *thin instances*, e **marcos estilizados** nos circuitos reais, todos em formas originais de baixo polígono (sem ativos de terceiros): Suzuka (roda-gigante + pinheiral), Fuji (montanha com topo nevado), Las Vegas (torres neon + roda-gigante, noite), Mônaco (casario denso, porto com iates, colinas), Spa (floresta densa de pinheiros), Monza (parque arborizado), Red Bull Ring (picos alpinos), México (cordilheira ao fundo), Zandvoort/Bahrein/Lusail (dunas), Marina Bay/Xangai/Baku/Yas/Jedá (torres, água, palmeiras), COTA (torre mirante), Silverstone (hangares de aeródromo) etc. Os circuitos **criados/fictícios** (Coreia, Algarve, Buddh, Chang, Kyalami, Oscar Gálvez) usam paisagens **amplas**: chão 2,3× maior e adereços espalhados por uma faixa 35 % mais larga; os demais usam chão 1,5× (antes ~1×). Orçamento por perfil de qualidade (×0,35 / 0,65 / 1 / 1,4) e 1/2/4 chunks para frustum culling. Testes (`tests/scenery-plan.test.ts`): 35 planos determinísticos e dentro do chão; nada a menos de `clearance + footprint` da pista ou do pit; ≥ 9 looks e ≥ 20 composições distintas; marcos presentes (Fuji tem pico, Suzuka/Las Vegas têm roda-gigante, Mônaco tem casas + água + iates, Spa é pinheiral…); circuitos amplos têm chão maior; ≤ 700 itens no Ultra. Evidência visual: vistas gerais oblíquas dos **35 circuitos** em `docs/qa-shots/scenery-all/` (muitas aparecem enevoadas porque a corrida sorteou chuva). Pilotos medidos antes (software, 390×844): gp‑1 e gp‑29; os perfis novos têm 24–34 meshes e ~480–640 draw calls na vista geral em software, **sem medição em aparelho real**. Também corrigido: clones de chunk compartilhavam geometria e desenhavam um fiapo de instância corrompida em Alto/Ultra (cada chunk agora tem geometria própria).

**Sprint 06 — pit.** O HUD já tinha composto, BOX NOW/NEXT LAP/CANCEL e confirmação; agora há chip no palco com a chamada real e o estágio ENTRADA/PARADA/SAÍDA. Testes: duas chamadas da mesma equipe (substitui), cancelamento, composto trocado e `pits+1` após a parada real, ordem pós‑parada vinda do motor, apresentação/câmera não alteram o estado (hash).

**Sprint 07 — qualidade e fallback.** Uma só fórmula DPR/perfil; AUTO‑QUALIDADE opcional; `webglcontextlost` → 2D; teste e2e sem WebGL mantém classificação; `importBabylon` continua usando o pacote local primeiro (CDN só se o import falhar); cache do PWA 61000 e teste de GLB offline.

**Benchmark de sessão (software, 390×844, perfil baixo, 120 s, AUTO + troca 2D↔3D + chamada de PIT):** p50 ≈ 259 ms, p95 ≈ 488 ms (≈ 4,6 FPS), heap máx. ≈ 99 MB, 0 erros (`docs/qa-bench-software-390x844.json`). Reflete o custo de rasterizar por CPU, **não** o de um Xiaomi com GPU.

**Sprint 08 — QA.** Paridade: hash do estado da corrida idêntico com/sem renderização por 24 ticks, com todas as câmeras; 2D→2.5D→3D→2D com classificação idêntica; rotação do celular; reduced‑motion; sem WebGL. Detalhes de contagem em `QA_MARCO_61000.json`.

## 4. Riscos e limites conhecidos
1. Sem medição em Xiaomi real (FPS p50/p95, memória, 2 min). Perfis Baixa/Média *visam* 30 FPS, mas não foi provado.
2. 13 specs E2E antigas falham em desktop e 13 em Android **exatamente como no baseline 60300** (UI mudou em marcos anteriores); não foram mascaradas. Na rodada completa em paralelo (software GL, carga alta) alguns specs novos estouraram tempo; sequenciais (`--workers=1`) os 12 specs novos (6 desktop + 6 Android) passaram duas vezes seguidas.
3. Cenário estilizado por perfil (marcos reconhecíveis, não réplicas); a geometria das pistas segue “provisional”, então os marcos são posicionados por progresso de volta e não por mapa verificado.
4. O motor não modela duração de parada: nenhuma duração é exibida; mecânicos são só movimento procedural.
5. O fade de estruturas depende de clonar o material de ~24 meshes por circuito (custo pequeno, medido apenas em software).
6. Barreiras são o único obstáculo testado por raycast (a 3 Hz); árvores/prédios ficam ≥9,5 unidades da pista por construção.
