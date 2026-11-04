import json
from pathlib import Path
root = Path(__file__).resolve().parents[1] / "www"
index = json.loads((root / "data/tile-index.json").read_text(encoding="utf-8-sig"))
required = ["data/" + name for name in ["land.geojson", "places.json", "stations.json", "transit.json", "labels.json", "manifest.json"]]
required += ["fonts/PretendardVariable.woff2", "vendor/leaflet.js", "vendor/leaflet.css"]
required += ["data/tiles/" + key + ".json" for key in index]
missing = [name for name in required if not (root / name).is_file()]
if missing:
    print("FAIL: Missing", len(missing), "assets:", *missing[:10], sep="\n")
    raise SystemExit(1)
print("PASS:", len(index), "map tiles and required offline assets present.")
