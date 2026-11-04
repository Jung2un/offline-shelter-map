"""Export/restore the offline tile bundle without third-party packages."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('action', choices=['pack', 'restore'])
p.add_argument('archive', nargs='?', default=str(ROOT / 'artifacts/korea-tiles.zip'))
a = p.parse_args()
archive = Path(a.archive).resolve()
index = json.loads((ROOT / 'www/data/tile-index.json').read_text(encoding='utf-8-sig'))
expected = {'tiles/' + key + '.json' for key in index}
checksum = archive.with_suffix(archive.suffix + '.sha256')
def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()
if a.action == 'pack':
    missing = [n for n in expected if not (ROOT / 'www/data' / n).is_file()]
    if missing:
        raise SystemExit('Missing tile files; run scripts/check_assets.py.')
    archive.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=5) as z:
        for name in sorted(expected):
            z.write(ROOT / 'www/data' / name, name)
    checksum.write_text(digest(archive) + '  ' + archive.name + '\n', encoding='utf-8')
else:
    if not checksum.is_file() or digest(archive) != checksum.read_text().split()[0]:
        raise SystemExit('Missing or mismatched .sha256 file.')
    with ZipFile(archive) as z:
        if set(z.namelist()) != expected or len(z.namelist()) != len(expected):
            raise SystemExit('Archive does not match the checked-in tile index.')
        # Exact allowlist prevents directory traversal and unrelated file writes.
        for name in sorted(expected):
            target = ROOT / 'www/data' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(z.read(name))
print(a.action.upper(), len(expected), 'tiles:', archive)
