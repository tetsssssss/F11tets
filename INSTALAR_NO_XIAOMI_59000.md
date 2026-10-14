# Jogar no Xiaomi (Android) — F1 Universe 2029 Marco 59.000

## Opção 1 — Chrome pelo navegador
1. No PC, publique o ZIP **F1_UNIVERSE_2029_MARCO_59000_NETLIFY.zip** no Netlify (Deploys > arrastar ZIP ou pasta descompactada conforme modalidade disponível no painel). Confirme que `index.html` está na raiz.
2. Abra a URL `https://...netlify.app` no Chrome do Xiaomi.
3. Em uma corrida, escolha 2D, 2.5D ou 3D, abra Race Control > Momento / GAP / Pneus / Voltas, e use 0,50× / 0,75×.

## Opção 2 — instalar como aplicativo PWA
1. Com a URL do Netlify aberta no Chrome Android, toque **Instalar** se o aviso do F1 Universe aparecer.
2. Se não aparecer: menu ⋮ do Chrome > **Adicionar à tela inicial** ou **Instalar aplicativo** (a opção depende da versão do Chrome/MIUI/HyperOS).
3. Abra o ícone F1 Universe na tela inicial. É uma instalação Web App, **não um APK Android nativo**.
4. O PWA exige HTTPS (Netlify fornece isso). O modo 3D poderá precisar de conexão, hardware compatível com WebGL e carregamento externo do Babylon. Em caso de falha use 2D/2.5D.

## Cuidados com saves
- Os saves da carreira ficam no armazenamento do navegador. **Não limpe dados do site, não use incógnito e não desinstale antes de exportar seus saves.**
- Antes de trocar de celular, utilize a exportação de save existente no jogo.
- O service worker apenas guarda assets estáticos; não sincroniza saves nem os envia para servidor.

## Limitações desta entrega
- Nenhum APK foi compilado nem testado num Xiaomi real.
- A versão fonte disponível para edição é 57.000; assets compilados usados como base são do Netlify 58.300. Não foi possível auditar alterações de código-fonte feitas exclusivamente entre esses marcos.
- Instalação PWA e desempenho 3D em Xiaomi exigem validação no aparelho real.
