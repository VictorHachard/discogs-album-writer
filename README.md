# Discogs Album Writer

Parse une export CSV Discogs (collection vinyle / CD), genere un JSON propre groupe par artiste, et affiche le tout dans une petite page web avec recherche live et fiche par album.

Premiere passe : **10 fiches** ecrites a la main pour valider le rendu avant d'attaquer les ~510 restants.

## Structure

```
LunaticPan-collection-20260516-1553.csv  # export Discogs UTF-8
parse_csv.py                              # parseur CSV -> collection.js (Python)
_parse_oneshot.mjs                        # equivalent Node si Python indispo
collection.js                             # donnees auto-generees (window.COLLECTION)
fiches.js                                 # mini-critique de chaque album (window.FICHES)
covers.js                                 # URLs des covers Discogs (window.COVERS)
index.html / style.css / app.js           # mini site (pas de framework)
```

## Lancer

**Double-clic sur `index.html`**, c'est tout. Les donnees sont incluses via `<script src>` donc rien n'est `fetch()`, ca marche en `file://`.

## Regenerer `collection.js`

Apres avoir mis a jour l'export Discogs :

```sh
python parse_csv.py                            # ou : python parse_csv.py chemin/vers/autre.csv
# alternative si pas de Python :
node _parse_oneshot.mjs
```

## Ajouter des fiches

Editer `fiches.js` directement. C'est un objet JS indexe par cle d'album : `artiste_minuscules::titre_minuscules`. La cle exacte est stockee dans `collection.js` sous `albums[i].key` — copier-coller. Une fiche absente s'affiche en placeholder `Fiche a ecrire.`.

## Etat

- 276 artistes, 520 albums uniques, 570 pressages
- 10 fiches ecrites (Lomepal, Damso, Rick Wakeman, Humble Pie, Joan Baez x2, Supertramp, Magma, Styx, Joe Jackson)
