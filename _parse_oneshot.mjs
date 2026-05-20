// One-shot equivalent JS du parse_csv.py — genere collection.json depuis le CSV.
// Utile parce que python n'est pas dispo dans le shell utilise pendant le dev.
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ""));
const csvPath = path.join(root, "LunaticPan-collection-20260520-2038.csv");
const outPath = path.join(root, "collection.js");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { inQuotes = false; }
      } else { cell += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const text = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const rows = parseCsv(text).filter(r => r.some(c => c !== ""));
const headers = rows.shift();
const idx = (k) => headers.indexOf(k);

const normalizeArtist = (n) => n.replace(/\s*\(\d+\)\s*$/, "").trim();
const albumKey = (a, t) => `${normalizeArtist(a).toLowerCase().trim()}::${t.toLowerCase().trim()}`;

const artists = new Map();
for (const r of rows) {
  const artist = normalizeArtist(r[idx("Artist")]);
  const title = (r[idx("Title")] || "").trim();
  const key = albumKey(r[idx("Artist")], title);
  if (!artists.has(artist)) artists.set(artist, new Map());
  const albums = artists.get(artist);
  if (!albums.has(key)) albums.set(key, []);
  albums.get(key).push({
    release_id: (r[idx("release_id")] || "").trim(),
    catalog: (r[idx("Catalog#")] || "").trim(),
    label: (r[idx("Label")] || "").trim(),
    format: (r[idx("Format")] || "").trim(),
    rating: (r[idx("Rating")] || "").trim(),
    released: (r[idx("Released")] || "").trim(),
    media_condition: (r[idx("Collection Media Condition")] || "").trim(),
    sleeve_condition: (r[idx("Collection Sleeve Condition")] || "").trim(),
    notes: (r[idx("Collection Notes")] || "").trim(),
    date_added: (r[idx("Date Added")] || "").trim(),
    title,
  });
}

const out = [];
const sortedArtists = [...artists.keys()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
for (const artist of sortedArtists) {
  const albums = [];
  for (const [key, pressings] of artists.get(artist)) {
    const title = pressings[0].title;
    const released = pressings.find(p => p.released)?.released || "";
    albums.push({ key, title, released, pressings });
  }
  albums.sort((a, b) => (a.released || "0000").localeCompare(b.released || "0000") || a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  out.push({ artist, albums });
}

// Genere un script charge par <script src> dans la page (pas de fetch -> marche en file://)
const body = `// Auto-genere par _parse_oneshot.mjs / parse_csv.py — ne pas editer a la main.\nwindow.COLLECTION = ${JSON.stringify(out, null, 2)};\n`;
fs.writeFileSync(outPath, body, "utf8");
const nAlbums = out.reduce((s, a) => s + a.albums.length, 0);
const nPressings = out.reduce((s, a) => s + a.albums.reduce((p, al) => p + al.pressings.length, 0), 0);
console.log(`OK -> collection.js | ${out.length} artistes, ${nAlbums} albums uniques, ${nPressings} pressages`);
