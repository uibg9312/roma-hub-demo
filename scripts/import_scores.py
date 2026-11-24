from pathlib import Path
import json, urllib.request, os, sys
root = Path(__file__).resolve().parents[1]
failures=[]
for item in json.loads((root/'scripts/score-sources.json').read_text(encoding='utf-8')):
    target = root/'src'/item['pdfUrl'].lstrip('/')
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.read_bytes().startswith(b'%PDF-'): continue
    errors=[]
    for url in [item['url'], item.get('fallback')]:
        if not url: continue
        try:
            req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 RomaHubPortfolio/1.0 (public domain score)'})
            with urllib.request.urlopen(req, timeout=45) as res:
                data=res.read(25*1024*1024+1)
            if not data.startswith(b'%PDF-') or len(data)>25*1024*1024 or b'%%EOF' not in data[-4096:]:
                raise ValueError('Invalid PDF')
            temp=target.with_suffix('.tmp')
            temp.write_bytes(data); os.replace(temp,target)
            print('Imported',target.name,len(data),url)
            break
        except Exception as exc:
            errors.append(str(exc))
    if not target.exists():
        failures.append(target.name)
        print('Could not import',target.name,errors,file=sys.stderr)
if failures: sys.exit(1)
