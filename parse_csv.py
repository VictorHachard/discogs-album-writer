"""Parse le CSV Discogs et genere collection.json (groupe par artiste / album)."""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path


def normalize_artist(name: str) -> str:
    # Discogs ajoute " (N)" aux artistes homonymes, ex: "Magma (6)"
    return re.sub(r"\s*\(\d+\)\s*$", "", name).strip()


def album_key(artist: str, title: str) -> str:
    a = normalize_artist(artist).lower().strip()
    t = title.lower().strip()
    return f"{a}::{t}"


def parse(csv_path: Path, out_path: Path) -> None:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    artists: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for r in rows:
        artist = normalize_artist(r["Artist"])
        title = r["Title"].strip()
        key = album_key(r["Artist"], title)
        artists[artist][key].append({
            "release_id": r.get("release_id", "").strip(),
            "catalog": r.get("Catalog#", "").strip(),
            "label": r.get("Label", "").strip(),
            "format": r.get("Format", "").strip(),
            "rating": r.get("Rating", "").strip(),
            "released": r.get("Released", "").strip(),
            "media_condition": r.get("Collection Media Condition", "").strip(),
            "sleeve_condition": r.get("Collection Sleeve Condition", "").strip(),
            "notes": r.get("Collection Notes", "").strip(),
            "date_added": r.get("Date Added", "").strip(),
            "title": title,
        })

    out = []
    for artist in sorted(artists.keys(), key=lambda s: s.lower()):
        albums = []
        for key, pressings in artists[artist].items():
            title = pressings[0]["title"]
            released = next((p["released"] for p in pressings if p["released"]), "")
            albums.append({
                "key": key,
                "title": title,
                "released": released,
                "pressings": pressings,
            })
        albums.sort(key=lambda a: (a["released"] or "0000", a["title"].lower()))
        out.append({"artist": artist, "albums": albums})

    # Genere un fichier JS pour pouvoir l'inclure via <script src> et eviter le probleme CORS en file://
    payload = json.dumps(out, ensure_ascii=False, indent=2)
    body = (
        "// Auto-genere par parse_csv.py / _parse_oneshot.mjs — ne pas editer a la main.\n"
        f"window.COLLECTION = {payload};\n"
    )
    out_path.write_text(body, encoding="utf-8")
    n_albums = sum(len(a["albums"]) for a in out)
    n_pressings = sum(len(al["pressings"]) for a in out for al in a["albums"])
    print(f"OK -> {out_path.name} | {len(out)} artistes, {n_albums} albums uniques, {n_pressings} pressages")


if __name__ == "__main__":
    root = Path(__file__).parent
    csv_path = root / "LunaticPan-collection-20260516-1553.csv"
    if len(sys.argv) > 1:
        csv_path = Path(sys.argv[1])
    parse(csv_path, root / "collection.js")
