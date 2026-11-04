"""Build deterministic SHA-256/size inventory for all runtime web assets."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'www'
files=[]
for p in sorted(root.rglob('*')):
    if not p.is_file() or p.name in {'offline-manifest.json','.DS_Store'}: continue
    data=p.read_bytes()
    files.append({'path':p.relative_to(root).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
version='v'+hashlib.sha256(json.dumps(files,sort_keys=True).encode()).hexdigest()[:16]
m={'version':version,'totalBytes':sum(f['bytes'] for f in files),'files':files}
(root/'offline-manifest.json').write_text(json.dumps(m,separators=(',',':')),encoding='utf-8')
print(version,len(files),'files',m['totalBytes'],'bytes')
