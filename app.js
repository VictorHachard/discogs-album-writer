// Donnees chargees via <script> dans index.html : window.COLLECTION, window.FICHES, window.COVERS.
// (Pas de fetch -> marche en double-clic sur index.html en file://.)
(function () {
  const collection = window.COLLECTION || [];
  const fiches = window.FICHES || {};
  const covers = window.COVERS || {};

  const state = {
    query: "",
    selectedArtist: null,
  };

  const $ = (id) => document.getElementById(id);
  const artistList = $("artist-list");
  const artistCount = $("artist-count");
  const counts = $("counts");
  const empty = $("empty");
  const panel = $("artist-panel");
  const artistName = $("artist-name");
  const artistMeta = $("artist-meta");
  const albumsEl = $("albums");

  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function matches(artistObj, q) {
    if (!q) return true;
    const nq = norm(q);
    if (norm(artistObj.artist).includes(nq)) return true;
    return artistObj.albums.some(a => norm(a.title).includes(nq));
  }

  function filteredArtists() {
    if (!state.query) return collection;
    return collection.filter(a => matches(a, state.query));
  }

  function highlight(text, q) {
    if (!q) return escapeHtml(text);
    const nText = norm(text);
    const nq = norm(q);
    const idx = nText.indexOf(nq);
    if (idx < 0) return escapeHtml(text);
    // pour rester aligne malgre NFD, on cherche avec une regex case-insensitive sur la version simple
    const safe = escapeHtml(text);
    const re = new RegExp(escapeRegex(q), "ig");
    return safe.replace(re, m => `<mark>${m}</mark>`);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }
  function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function renderSidebar() {
    const list = filteredArtists();
    artistList.innerHTML = "";
    for (const a of list) {
      const li = document.createElement("li");
      li.dataset.artist = a.artist;
      const name = document.createElement("span");
      name.innerHTML = highlight(a.artist, state.query);
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = a.albums.length;
      li.append(name, badge);
      if (state.selectedArtist === a.artist) li.classList.add("active");
      li.addEventListener("click", () => selectArtist(a.artist));
      artistList.appendChild(li);
    }
    artistCount.textContent = `(${list.length})`;

    let totalAlbums = 0, totalPressings = 0, withFiche = 0, withCover = 0;
    const years = [];
    for (const a of list) {
      for (const al of a.albums) {
        totalAlbums++;
        totalPressings += al.pressings.length;
        if (fiches[al.key]) withFiche++;
        if (covers[al.key]) withCover++;
        const y = parseInt(al.released, 10);
        if (y >= 1900 && y <= 2100) years.push(y);
      }
    }
    const yearStr = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—";
    counts.innerHTML =
      `<b>${list.length}</b> artistes · ` +
      `<b>${totalAlbums}</b> albums · ` +
      `<b>${totalPressings}</b> pressages · ` +
      `<b>${yearStr}</b> · ` +
      `<b>${withFiche}</b> fiches · ` +
      `<b>${withCover}</b> covers`;
  }

  function selectArtist(name) {
    state.selectedArtist = name;
    const artist = collection.find(a => a.artist === name);
    if (!artist) {
      empty.hidden = false;
      panel.hidden = true;
      return;
    }
    empty.hidden = true;
    panel.hidden = false;
    artistName.textContent = artist.artist;
    const totalPressings = artist.albums.reduce((s, a) => s + a.pressings.length, 0);
    const withFiche = artist.albums.filter(a => fiches[a.key]).length;
    artistMeta.textContent = `${artist.albums.length} album${artist.albums.length>1?"s":""} · ${totalPressings} pressage${totalPressings>1?"s":""} · ${withFiche} fiche${withFiche>1?"s":""} ecrite${withFiche>1?"s":""}`;

    albumsEl.innerHTML = "";
    for (const al of artist.albums) {
      albumsEl.appendChild(renderAlbum(al, artist.artist));
    }
    // mise en evidence dans la sidebar
    for (const li of artistList.children) {
      li.classList.toggle("active", li.dataset.artist === name);
    }
  }

  function renderAlbum(al, artistName) {
    const card = document.createElement("div");
    card.className = "album";

    const cover = document.createElement("div");
    cover.className = "album-cover";
    const c = covers[al.key];
    if (c && c.thumb) {
      cover.classList.add("has-img");
      const img = document.createElement("img");
      img.src = c.thumb;
      img.loading = "lazy";
      img.alt = `${artistName} — ${al.title}`;
      cover.appendChild(img);
      cover.addEventListener("click", () => openModal(c.full || c.thumb, `${artistName} — ${al.title}`));
    } else {
      cover.classList.add("empty");
      cover.textContent = "♪";
      cover.title = "Pas de cover disponible";
    }
    card.appendChild(cover);

    const body = document.createElement("div");
    body.className = "album-body";

    const head = document.createElement("div");
    head.className = "album-head";
    const title = document.createElement("h3");
    title.className = "album-title";
    title.innerHTML = highlight(al.title, state.query);
    const year = document.createElement("span");
    year.className = "album-year";
    year.textContent = al.released || "—";
    head.append(title, year);
    body.appendChild(head);

    const links = renderLinks(al, artistName);
    if (links) body.appendChild(links);

    const fiche = document.createElement("p");
    fiche.className = "album-fiche";
    if (fiches[al.key]) {
      fiche.textContent = fiches[al.key];
    } else {
      fiche.classList.add("placeholder");
      fiche.textContent = "Fiche a ecrire.";
    }
    body.appendChild(fiche);

    if (al.pressings.length) {
      const wrap = document.createElement("div");
      wrap.className = "pressings";
      for (const p of al.pressings) {
        const row = document.createElement("div");
        row.className = "pressing";
        const left = document.createElement("div");
        left.innerHTML = `<strong>${escapeHtml(p.format || "?")}</strong> · ${escapeHtml(p.label || "?")} · cat. ${escapeHtml(p.catalog || "?")}`;
        const right = document.createElement("div");
        right.className = "right";
        const cond = p.media_condition || "";
        const condCls = isBadCond(cond) ? "cond bad" : "cond";
        right.innerHTML = `${cond ? `<span class="${condCls}">${escapeHtml(cond)}</span><br>` : ""}<span>id ${escapeHtml(p.release_id)}</span>`;
        row.append(left, right);
        wrap.appendChild(row);
      }
      body.appendChild(wrap);
    }

    card.appendChild(body);
    return card;
  }

  function isBadCond(c) {
    return /Good \(G\)|Poor|Fair/.test(c) && !/Very Good/.test(c);
  }

  const DISCOGS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="8.5" x2="12" y2="4" stroke-width="1.2"/><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none"/></svg>';
  const GOOGLE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>';

  function renderLinks(al, artistName) {
    const rid = al.pressings.find(p => p.release_id)?.release_id;
    const q = encodeURIComponent(`${artistName} ${al.title}`);
    const wrap = document.createElement("div");
    wrap.className = "album-links";
    if (rid) {
      const a = document.createElement("a");
      a.className = "lnk lnk-discogs";
      a.href = `https://www.discogs.com/release/${encodeURIComponent(rid)}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Voir la fiche Discogs (nouvel onglet)";
      a.innerHTML = `${DISCOGS_SVG}<span>Discogs</span>`;
      wrap.appendChild(a);
    }
    const g = document.createElement("a");
    g.className = "lnk lnk-google";
    g.href = `https://www.google.com/search?q=${q}`;
    g.target = "_blank";
    g.rel = "noopener";
    g.title = "Chercher sur Google (nouvel onglet)";
    g.innerHTML = `${GOOGLE_SVG}<span>Google</span>`;
    wrap.appendChild(g);
    return wrap;
  }

  function openModal(src, caption) {
    document.getElementById("modal-img").src = src;
    document.getElementById("modal-caption").textContent = caption;
    document.getElementById("modal").hidden = false;
  }
  function closeModal() {
    document.getElementById("modal").hidden = true;
    document.getElementById("modal-img").src = "";
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("modal").hidden) closeModal();
  });

  document.getElementById("q").addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    renderSidebar();
    // auto-pick si une seule reponse
    const list = filteredArtists();
    if (list.length === 1) selectArtist(list[0].artist);
  });

  // ───────── Easter eggs ─────────

  // 1. Compteur secret : 5 clics rapides sur le titre = panneau stats cachees
  (function () {
    const title = document.querySelector(".brand h1");
    if (!title) return;
    let clicks = 0;
    let timer = null;
    title.addEventListener("click", () => {
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 2500);
      if (clicks >= 5) { clicks = 0; showSecretStats(); }
    });
  })();

  function topKey(obj) {
    let bestKey = null, bestN = -1;
    for (const k in obj) if (obj[k] > bestN) { bestN = obj[k]; bestKey = k; }
    return bestKey ? { key: bestKey, count: bestN } : null;
  }

  function showSecretStats() {
    if (document.getElementById("easter-stats")) return;

    const years = [];
    const decade = {}, label = {}, format = {};
    let totalPressings = 0, totalAlbums = 0;
    for (const a of collection) {
      for (const al of a.albums) {
        totalAlbums++;
        for (const p of al.pressings) {
          totalPressings++;
          const y = parseInt(p.released || al.released || "", 10);
          if (y >= 1900 && y <= 2100) {
            years.push(y);
            const d = Math.floor(y / 10) * 10;
            decade[d] = (decade[d] || 0) + 1;
          }
          if (p.label) label[p.label] = (label[p.label] || 0) + 1;
          if (p.format) {
            const f = p.format.split(",")[0].trim();
            if (f) format[f] = (format[f] || 0) + 1;
          }
        }
      }
    }
    const oldest = years.length ? Math.min(...years) : "—";
    const newest = years.length ? Math.max(...years) : "—";
    const dec = topKey(decade);
    const lab = topKey(label);
    const fmt = topKey(format);

    const panel = document.createElement("div");
    panel.id = "easter-stats";
    panel.className = "easter-stats";
    panel.innerHTML = `
      <div class="easter-stats-inner">
        <button class="easter-close" aria-label="Fermer">&times;</button>
        <div class="easter-title">✦ Stats secretes ✦</div>
        <ul>
          <li>Pressage le plus ancien : <b>${oldest}</b></li>
          <li>Pressage le plus recent : <b>${newest}</b></li>
          <li>Decennie dominante : <b>${dec ? dec.key + "s" : "—"}</b> ${dec ? `<span class="muted-i">(${dec.count} pressages)</span>` : ""}</li>
          <li>Label le plus represente : <b>${lab ? escapeHtml(lab.key) : "—"}</b> ${lab ? `<span class="muted-i">(${lab.count}×)</span>` : ""}</li>
          <li>Format dominant : <b>${fmt ? escapeHtml(fmt.key) : "—"}</b> ${fmt ? `<span class="muted-i">(${fmt.count}×)</span>` : ""}</li>
          <li>Total : <b>${totalAlbums}</b> albums, <b>${totalPressings}</b> pressages</li>
        </ul>
        <div class="easter-foot">tu connais le secret maintenant</div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector(".easter-close").addEventListener("click", () => panel.remove());
    panel.addEventListener("click", (e) => { if (e.target === panel) panel.remove(); });
    requestAnimationFrame(() => panel.classList.add("show"));
  }

  // 2. Date speciale : 21 juin (fete de la musique) -> bandeau discret.
  // Pour tester hors du 21 juin, ajouter "#fete" a l'URL.
  (function () {
    const d = new Date();
    const isFete = (d.getMonth() === 5 && d.getDate() === 21) || location.hash === "#fete";
    if (!isFete) return;
    const banner = document.createElement("div");
    banner.className = "fete-musique";
    banner.innerHTML = `<span class="fete-note">♪</span> Bonne fete de la musique ! <span class="fete-sub">le seul jour ou tout le monde nous comprend</span> <button class="fete-close" aria-label="Fermer">&times;</button>`;
    document.body.insertBefore(banner, document.querySelector(".topbar").nextSibling);
    banner.querySelector(".fete-close").addEventListener("click", () => banner.remove());
  })();

  renderSidebar();
})();
