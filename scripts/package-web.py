from pathlib import Path
import shutil, html, zipfile
root=Path(__file__).resolve().parents[1]
source=root/'dist-next'; target=root/'dist'
if not (source/'index.html').exists(): raise RuntimeError('Run Expo web export to dist-next first')
shutil.rmtree(target); shutil.copytree(source,target)
for route in ['split','card','activity','profile','new-group']:
    (target/route).mkdir(exist_ok=True)
    shutil.copy(target/'index.html',target/route/'index.html')
for name in ['PROJECT.md','ASYNC_PLAN.md','FEASIBILITY.md','WALLET_PLAN.md','DESIGN.md']: shutil.copy(root/'docs'/name,target/name)
body=''
for name in ['PROJECT.md','ASYNC_PLAN.md','FEASIBILITY.md','WALLET_PLAN.md','DESIGN.md']:
    body+='<section><pre>'+html.escape((root/'docs'/name).read_text())+'</pre></section>'
(target/'plan.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Split Bill — Project progress</title><style>body{background:#f5f7f2;color:#173226;font:16px system-ui;margin:0;padding:28px}main{max-width:900px;margin:auto}a{color:#245d35}pre{white-space:pre-wrap;font:inherit;line-height:1.65}section{background:white;border-radius:20px;padding:25px;margin:25px 0}</style><main><a href="/">← Open Split Bill</a><h1>Project & progress</h1><p><a href="/native-source.zip">Download native app source</a> · <a href="/PROJECT.md">Project plan</a> · <a href="/WALLET_PLAN.md">Wallet plan</a></p>'+body+'</main></html>')
with zipfile.ZipFile(target/'native-source.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in (root/'mobile').rglob('*'):
        if p.is_file() and not any(part in ['node_modules','.expo','dist-native','.git'] for part in p.parts) and not p.name.startswith('.env'):
            z.write(p,p.relative_to(root))
    for p in (root/'docs').glob('*.md'):z.write(p,p.relative_to(root))
print('Packaged native-source.zip, web review and project documentation.')
