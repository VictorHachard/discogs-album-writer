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

    const totalAlbums = list.reduce((s, a) => s + a.albums.length, 0);
    counts.textContent = `${list.length} artistes · ${totalAlbums} albums`;
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

  renderSidebar();
})();
