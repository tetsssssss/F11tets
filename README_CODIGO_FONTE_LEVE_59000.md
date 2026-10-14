# F1 Universe 2029 — código-fonte 59.000, edição leve para Codex

Este ZIP foi extraído SEM MODIFICAR o código-fonte do pacote original
`F1_UNIVERSE_2029_MARCO_59000_CODIGO_FONTE.zip`.

## Conteúdo principal
- `src/`: motor esportivo, UI, dados, renderizadores, estilos e Race Control.
- `tests/`: testes originais.
- `scripts/`: scripts originais e restaurador de imagens Netlify.
- `netlify/`, `tools/` e demais fontes/configurações.
- `package.json`, `package-lock.json`, TypeScript, Vite, Next, Playwright etc.
- `public/assets/f1-3d/`: modelos GLB originais de carros e circuitos.

**Importante:** Os 67 arquivos GLB NÃO foram excluídos porque suas versões no
ZIP Netlify NÃO são idênticas byte a byte às deste código-fonte.

## Como restaurar as fotos de pilotos e ícones compartilhados
Você precisa do pacote `F1_UNIVERSE_2029_MARCO_59000_NETLIFY_PWA.zip`,
distribuído separadamente. Na raiz deste projeto execute:

```bash
python3 scripts/restaurar_imagens_netlify_59000.py /caminho/para/F1_UNIVERSE_2029_MARCO_59000_NETLIFY_PWA.zip
```

O script restaura SOMENTE os arquivos de imagem originalmente presentes
em `public/`, verificando SHA-256 contra o inventário. NÃO sobrescreve
modelos GLB ou outros arquivos. Sem esses arquivos, algumas fotos e ícones
poderão faltar ao executar o código localmente.

## Materiais complementares opcionais
Os pacotes `ASSETS_ORIGINAIS_PARTE_1.zip` e `ASSETS_ORIGINAIS_PARTE_2.zip`
guardam as fotos de preparação, imagens originais, prévias, caches de pesquisa
e capturas de documentação que NÃO são necessárias para editar a maior parte
do código nem para o build habitual com imagens restauradas do Netlify.
Extraia os dois arquivos na mesma pasta raiz caso precise desses materiais.

## Compilação e testes
```bash
npm ci
npm run typecheck
npm test
npm run build:netlify
```

Se as dependências não estiverem disponíveis, não trate um build alternativo
offline como substituto de validação completa. O ZIP leve foi conferido
quanto à integridade e inventário, mas NÃO está homologado no Xiaomi.

Nenhum destes arquivos é um APK. Para jogar, utilize o ZIP Netlify/PWA.
