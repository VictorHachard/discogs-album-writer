# Notes pour Claude

## Contexte projet

Petit projet perso : visualiser une collection vinyle Discogs (export CSV) sous forme de mini site web, avec une fiche descriptive ecrite a la main pour chaque album. Le proprietaire de la collection s'appelle **LunaticPan** sur Discogs.

L'utilisateur prefere :
- du **francais** dans les fiches, les commentaires et le UI
- **pas de framework** (vanilla HTML/CSS/JS) — Bootstrap toleré si vraiment utile, mais inutile ici
- du code **simple, lisible, sans abstraction premature**
- iterer par petites batchs (10 fiches a la fois) avant de generaliser

## Workflow d'ecriture de fiches

1. Ouvrir `collection.js` et reperer la cle de l'album (`albums[i].key`).
2. Ajouter / modifier une entree dans `fiches.js` (objet `window.FICHES`).
3. Cle = `artiste_normalise::titre_normalise` (tout minuscules, suffixe Discogs ` (N)` retire).
4. Fiche = mini-critique de 6-10 phrases en francais : place dans la discographie, genre/son, morceaux marquants, importance dans la Musique (mouvement, heritage). **Pas de notation, pas de superlatifs vides, ne JAMAIS inventer un titre/feat/chiffre.**

## Workflow nouveau CSV Discogs

Quand l'utilisateur dit « j'ai ajoute un nouveau fichier CSV » (ou equivalent), faire systematiquement :

1. `diff` entre l'ancien CSV (`LunaticPan-collection-YYYYMMDD-HHMM.csv` precedent) et le nouveau pour reperer les ajouts/modifications.
2. Mettre a jour `_parse_oneshot.mjs` pour pointer le nouveau CSV (`csvPath`).
3. `node _parse_oneshot.mjs` -> regenere `collection.js`.
4. Pour chaque NOUVELLE cle (`artiste::titre` absente de `fiches.js`), rediger une fiche selon le workflow ci-dessus. Une simple nouvelle edition (meme cle, autre pressage) ne necessite pas de nouvelle fiche — Discogs agrege les pressings sous la meme cle.
5. Si une ligne CSV existante a ete corrigee (typo dans le titre, double-espace -> simple, annee corrigee...), la cle change : il faut mettre a jour la cle de la fiche existante et reflechir si le contenu doit etre ajuste (ex: annee).
6. Verifier que toutes les nouvelles cles dans `fiches.js` matchent bien celles de `collection.js` regenere.
7. **Recuperer les covers manquantes** : `node fetch_covers.mjs`. Le script fait le diff `collection.js` vs `covers.js` et ne va chercher QUE les cles sans cover (pas de refetch en masse), via l'API Discogs (`release_id` -> image `primary`, fallback sur le `master` si la release n'a pas d'image). Il met a jour `covers.js`. Sans ca, les nouveaux albums s'affichent sans pochette.
8. Verifier qu'il ne reste aucun album sans cover (le script l'indique en fin de run).

## Architecture site

Trois globals charges par `index.html` via `<script src>` : `window.COLLECTION` (collection.js, auto-gen depuis le CSV), `window.FICHES` (fiches.js, redige), `window.COVERS` (covers.js, URLs Discogs des covers). `app.js` lit ces globals. Pas de backend, pas de fetch — ca marche en double-clic depuis `file://`.

Ne pas reintroduire de `fetch()` sur les .js/.json — l'utilisateur ouvre la page en `file://` (CORS bloque alors fetch). Les seules URLs distantes sont les `<img src>` vers `i.discogs.com`, qui passent (CORS bloque seulement fetch, pas les img).

## Encodage CSV

L'export Discogs est en **UTF-8 (avec BOM possible)**. Toujours ouvrir avec `utf-8-sig` cote Python pour ne pas avoir `﻿` dans la premiere colonne.

## Normalisation artiste

Discogs ajoute ` (N)` aux artistes homonymes : `Magma (6)`, `Tool (4)`... La regex `\s*\(\d+\)\s*$` retire ce suffixe. Faire de meme partout (parser, cle de fiche).

## Outils dispo

- **Python** : pas installe pour l'user courant (`Victor`) sur cette machine — installe sous `Administrator`. Lancer Python en dehors de Claude Code ou utiliser le fallback Node `_parse_oneshot.mjs`.
- **Node** : dispo (v24+).
- **Bash** : MSYS/Git Bash, pas de `python` ni `python3` dans le PATH.

## Ne pas

- Inventer des morceaux, classements, productions ou influences : si tu n'es pas sur, fiche courte basee sur les seules metadonnees (artiste, annee, label, format).
- Ajouter des libs (Bootstrap, jQuery, React) — l'utilisateur a explicitement demande du pur HTML/CSS/JS.
- **Refetch en masse** des covers : `fetch_covers.mjs` ne doit recuperer QUE les cles manquantes (son comportement par defaut). Ne pas lancer `--force` ni reecrire les covers existantes. Si une URL casse ponctuellement, la remplacer a la main plutot que tout refetch.
- Committer le token : `fetch_covers.mjs` lit le token Discogs depuis `.discogs_token` (gitignore) ou `$env:DISCOGS_TOKEN`. Ne jamais ecrire le token en dur dans un fichier suivi.
