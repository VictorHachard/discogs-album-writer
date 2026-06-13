// Recupere les covers manquantes depuis l'API Discogs et met a jour covers.js.
//
// Pourquoi ce script existe (derogation a la regle "pas de refetch en masse") :
// quand on ajoute de nouveaux vinyles via un CSV, collection.js gagne des cles
// qui n'ont aucune entree dans covers.js -> pas d'image dans la page. Ce script
// ne va chercher QUE les cles manquantes (diff collection.js vs covers.js), pas
// toute la collection. Les anciennes covers ne sont jamais retouchees.
//
// L'API images de Discogs exige un token. Fournir le token de l'une de ces facons :
//   - variable d'env DISCOGS_TOKEN  (ex PowerShell : $env:DISCOGS_TOKEN="xxxx")
//   - fichier .discogs_token a la racine (une ligne, le token) -- gitignore
// Token perso a generer ici : https://www.discogs.com/settings/developers
//
// Usage :
//   node fetch_covers.mjs            -> recupere uniquement les cles manquantes
//   node fetch_covers.mjs --force    -> re-recupere tout (a eviter, refetch en masse)

import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ""));
const collectionPath = path.join(root, "collection.js");
const coversPath = path.join(root, "covers.js");
const FORCE = process.argv.includes("--force");

// --- token ----------------------------------------------------------------
function readToken() {
  if (process.env.DISCOGS_TOKEN) return process.env.DISCOGS_TOKEN.trim();
  const f = path.join(root, ".discogs_token");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  return "";
}
const TOKEN = readToken();
if (!TOKEN) {
  console.error(
    "Token Discogs manquant.\n" +
    "  PowerShell : $env:DISCOGS_TOKEN=\"ton_token\"  puis  node fetch_covers.mjs\n" +
    "  ou cree un fichier .discogs_token (une ligne) a la racine.\n" +
    "  Generer un token : https://www.discogs.com/settings/developers"
  );
  process.exit(1);
}

// --- charge un global window.X depuis un .js auto-genere -------------------
function loadGlobal(file, name) {
  const txt = fs.readFileSync(file, "utf8");
  const window = {};
  new Function("window", txt)(window);
  return window[name];
}

const COLLECTION = loadGlobal(collectionPath, "COLLECTION");
const COVERS = fs.existsSync(coversPath) ? loadGlobal(coversPath, "COVERS") : {};

// --- liste { key, release_id } a traiter -----------------------------------
const wanted = [];
for (const a of COLLECTION) {
  for (const al of a.albums) {
    if (!FORCE && COVERS[al.key]) continue;            // deja une cover -> on saute
    const rid = al.pressings.map(p => p.release_id).find(Boolean);
    if (!rid) { console.warn(`  (skip) pas de release_id : ${al.key}`); continue; }
    wanted.push({ key: al.key, release_id: rid });
  }
}

if (wanted.length === 0) {
  console.log("Rien a faire : toutes les cles de collection.js ont deja une cover.");
  process.exit(0);
}
console.log(`${wanted.length} cover(s) a recuperer${FORCE ? " (--force)" : ""}...`);

// --- helpers ---------------------------------------------------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const HEADERS = {
  "User-Agent": "LunaticPanCollection/1.0 +https://github.com/VictorHachard",
  "Authorization": `Discogs token=${TOKEN}`,
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429) {                            // rate limit -> attendre et reessayer
    const wait = Number(res.headers.get("Retry-After") || 60) * 1000;
    console.warn(`  429 rate-limit, pause ${wait / 1000}s...`);
    await sleep(wait);
    return fetchJson(url);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
const fetchRelease = (rid) => fetchJson(`https://api.discogs.com/releases/${rid}`);
const fetchMaster = (mid) => fetchJson(`https://api.discogs.com/masters/${mid}`);

function pickImage(json) {
  const imgs = json.images || [];
  if (imgs.length === 0) return null;
  const primary = imgs.find(i => i.type === "primary") || imgs[0];
  return { thumb: primary.uri150 || primary.uri, full: primary.uri };
}

// --- boucle (rate limit : 60 req/min authentifie -> ~1.1s entre requetes) --
let ok = 0, miss = 0, fail = 0;
for (let i = 0; i < wanted.length; i++) {
  const { key, release_id } = wanted[i];
  try {
    const json = await fetchRelease(release_id);
    let cover = pickImage(json);
    if (!cover && json.master_id) {            // release sans image -> on tente le master
      await sleep(1100);
      cover = pickImage(await fetchMaster(json.master_id));
    }
    if (!cover) { console.warn(`  [${i + 1}/${wanted.length}] (aucune image) ${key}`); miss++; }
    else { COVERS[key] = cover; ok++; console.log(`  [${i + 1}/${wanted.length}] OK ${key}`); }
  } catch (e) {
    console.error(`  [${i + 1}/${wanted.length}] ECHEC ${key} (release ${release_id}) : ${e.message}`);
    fail++;
  }
  if (i < wanted.length - 1) await sleep(1100);
}

// --- ecrit covers.js (cles triees pour un diff git stable) -----------------
const sorted = {};
for (const k of Object.keys(COVERS).sort()) sorted[k] = COVERS[k];
const body =
  "// Auto-genere par fetch_covers.mjs -- ne pas editer a la main.\n" +
  `window.COVERS = ${JSON.stringify(sorted, null, 2)};\n`;
fs.writeFileSync(coversPath, body, "utf8");

console.log(`\nTermine -> covers.js | ${ok} ajoutees, ${miss} sans image, ${fail} echecs, ${Object.keys(sorted).length} covers au total.`);
