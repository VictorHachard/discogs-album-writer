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
- Reintroduire un script qui appelle l'API Discogs : les covers sont deja figees dans `covers.js`. Si une URL casse, remplacer manuellement plutot que refetch en masse.
