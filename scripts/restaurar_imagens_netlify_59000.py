#!/usr/bin/env python3
"""Restaura apenas imagens public/ que também existem no ZIP Netlify 59.000.
Uso: python3 scripts/restaurar_imagens_netlify_59000.py arquivo_netlify.zip
"""
from pathlib import Path
from zipfile import ZipFile
import hashlib, json, sys
ROOT=Path(__file__).resolve().parent.parent
if len(sys.argv)!=2:
    raise SystemExit('Uso: python3 scripts/restaurar_imagens_netlify_59000.py caminho/NETLIFY_PWA.zip')
manifest=json.loads((ROOT/'MANIFEST_CODIGO_FONTE_LEVE_59000.json').read_text(encoding='utf8'))
targets=manifest['omitted_duplicate_images']
restored=0
with ZipFile(sys.argv[1]) as z:
    for target, info in targets.items():
        name=info['netlify_path']
        if name not in z.namelist():
            raise RuntimeError(f'Falta no Netlify: {name}')
        data=z.read(name)
        got=hashlib.sha256(data).hexdigest()
        if got!=info['sha256']:
            raise RuntimeError(f'Hash diferente de {name}; arquivo Netlify não corresponde à versão 59000.')
        dst=ROOT/target
        if dst.exists():
            if hashlib.sha256(dst.read_bytes()).hexdigest()!=got:
                raise RuntimeError(f'Arquivo já existe e é diferente: {target} (não sobrescrito).')
            continue
        dst.parent.mkdir(parents=True,exist_ok=True)
        dst.write_bytes(data)
        restored+=1
print(f'OK: {restored} imagens restauradas; {len(targets)} no manifesto. Sem sobrescrever os GLB.')
