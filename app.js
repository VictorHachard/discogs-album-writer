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
    if (e.key === "Escape") {
      if (!document.getElementById("modal").hidden) closeModal();
      const stats = document.getElementById("easter-stats");
      if (stats) stats.remove();
      if (document.getElementById("sidebar").classList.contains("open")) closeSidebar();
    }
  });

  document.getElementById("q").addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    renderSidebar();
    // auto-pick si une seule reponse
    const list = filteredArtists();
    if (list.length === 1) {
      selectArtist(list[0].artist);
      closeSidebar();
    }
  });

  // ───────── Drawer mobile (liste artistes) ─────────
  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  function openSidebar() {
    sidebar.classList.add("open");
    sidebarBackdrop.hidden = false;
    sidebarBackdrop.classList.add("show");
  }
  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("show");
    sidebarBackdrop.hidden = true;
  }
  document.getElementById("list-btn").addEventListener("click", openSidebar);
  document.getElementById("sidebar-close").addEventListener("click", closeSidebar);
  sidebarBackdrop.addEventListener("click", closeSidebar);
  // fermer auto au clic sur un artiste (mobile)
  document.getElementById("artist-list").addEventListener("click", (e) => {
    if (e.target.closest("li") && window.matchMedia("(max-width: 760px)").matches) closeSidebar();
  });

  // ───────── Installation PWA ─────────
  (function () {
    const installBtn = document.getElementById("install-btn");
    const installModal = document.getElementById("install-modal");
    const stepsIos = document.getElementById("install-steps-ios");
    const stepsAndroid = document.getElementById("install-steps-android");
    if (!installBtn || !installModal) return;

    const ua = navigator.userAgent || "";
    // iPadOS recent renvoie un UA "MacIntel" -> on detecte aussi via touch.
    const isIos = /iphone|ipad|ipod/i.test(ua)
              || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
                      || window.navigator.standalone === true;

    // Deja installe -> bouton masque
    if (isStandalone) return;

    let deferredPrompt = null;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.hidden = false;
    });

    // iOS Safari ne supporte pas beforeinstallprompt -> on affiche quand meme le bouton
    if (isIos) installBtn.hidden = false;

    function openInstallModal() {
      if (stepsIos && stepsAndroid) {
        stepsIos.hidden = !isIos;
        stepsAndroid.hidden = isIos;
      }
      installModal.hidden = false;
      requestAnimationFrame(() => installModal.classList.add("show"));
    }
    function closeInstallModal() {
      installModal.classList.remove("show");
      // attendre la fin du fondu pour repasser en hidden
      setTimeout(() => { installModal.hidden = true; }, 260);
    }

    installBtn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === "accepted") installBtn.hidden = true;
        return;
      }
      // Pas de prompt natif -> instructions (iOS, ou desktop sans event)
      openInstallModal();
    });

    window.addEventListener("appinstalled", () => {
      installBtn.hidden = true;
      deferredPrompt = null;
    });

    installModal.addEventListener("click", (e) => {
      if (e.target === installModal || e.target.closest("[data-close-install]")) {
        closeInstallModal();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !installModal.hidden) closeInstallModal();
    });
  })();

  // ───────── Positions aleatoires des blobs (figees au load) ─────────
  (function () {
    const b1 = document.querySelector(".blob-1");
    const b2 = document.querySelector(".blob-2");
    if (!b1 || !b2) return;
    // blob-1 ancre par top/left, blob-2 par bottom/right -> les valeurs sont
    // "decalages depuis ce coin" ; negatif = blob deborde hors ecran.
    const arrangements = [
      { p1: { top: "-25%", left: "-20%" }, p2: { bottom: "-25%", right: "-20%" } }, // diag NO -> SE
      { p1: { top: "-25%", left: "55%"  }, p2: { bottom: "-25%", right: "55%"  } }, // diag NE -> SO
      { p1: { top: "-30%", left: "15%"  }, p2: { bottom: "-30%", right: "15%"  } }, // axe vertical
      { p1: { top: "15%",  left: "-30%" }, p2: { bottom: "15%",  right: "-30%" } }, // axe horizontal
      { p1: { top: "0%",   left: "-10%" }, p2: { bottom: "0%",   right: "-10%" } }, // diag interieure
      { p1: { top: "10%",  left: "45%"  }, p2: { bottom: "10%",  right: "45%"  } }, // diag inverse interieure
    ];
    const a = arrangements[Math.floor(Math.random() * arrangements.length)];
    Object.assign(b1.style, a.p1);
    Object.assign(b2.style, a.p2);
  })();

  // ───────── Panneau stats ─────────

  document.getElementById("stats-btn").addEventListener("click", showStats);

  function topN(obj, n) {
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }

  function bar(value, max, width = 18) {
    const n = Math.max(1, Math.round((value / max) * width));
    return "█".repeat(n) + "░".repeat(width - n);
  }

  function showStats() {
    if (document.getElementById("easter-stats")) return;

    // Collecte des stats sur toute la collection (pas filtree)
    const years = [];
    const decade = {}, label = {}, format = {};
    const condition = {}, sleeve = {}, ratings = [];
    const albumsByArtist = {};
    const pressingsByAlbum = {};
    const addedDates = [];
    let totalPressings = 0, totalAlbums = 0;
    let mostPressedAlbum = null;
    let longestFiche = null, longestFicheLen = 0;
    let totalFicheChars = 0;
    let coversCount = 0;

    for (const a of collection) {
      albumsByArtist[a.artist] = a.albums.length;
      for (const al of a.albums) {
        totalAlbums++;
        if (covers[al.key]) coversCount++;
        if (fiches[al.key]) {
          totalFicheChars += fiches[al.key].length;
          if (fiches[al.key].length > longestFicheLen) {
            longestFicheLen = fiches[al.key].length;
            longestFiche = `${a.artist} — ${al.title}`;
          }
        }
        pressingsByAlbum[`${a.artist} — ${al.title}`] = al.pressings.length;
        if (al.pressings.length > 1 && (!mostPressedAlbum || al.pressings.length > mostPressedAlbum.n)) {
          mostPressedAlbum = { name: `${a.artist} — ${al.title}`, n: al.pressings.length };
        }
        for (const p of al.pressings) {
          totalPressings++;
          const y = parseInt(p.released || al.released || "", 10);
          if (y >= 1900 && y <= 2100) {
            years.push(y);
            const d = Math.floor(y / 10) * 10;
            decade[d] = (decade[d] || 0) + 1;
          }
          if (p.label) {
            for (const lbl of p.label.split(",")) {
              const cleaned = lbl.trim();
              if (cleaned) label[cleaned] = (label[cleaned] || 0) + 1;
            }
          }
          if (p.format) {
            const f = p.format.split(",")[0].trim();
            if (f) format[f] = (format[f] || 0) + 1;
          }
          if (p.media_condition) condition[p.media_condition] = (condition[p.media_condition] || 0) + 1;
          if (p.sleeve_condition) sleeve[p.sleeve_condition] = (sleeve[p.sleeve_condition] || 0) + 1;
          const r = parseInt(p.rating, 10);
          if (r >= 1 && r <= 5) ratings.push(r);
          if (p.date_added) addedDates.push(p.date_added);
        }
      }
    }

    const oldest = years.length ? Math.min(...years) : "—";
    const newest = years.length ? Math.max(...years) : "—";
    const avgRating = ratings.length ? (ratings.reduce((s, n) => s + n, 0) / ratings.length).toFixed(2) : "—";
    const mintCount = Object.entries(condition).filter(([k]) => /Mint/i.test(k)).reduce((s, [, n]) => s + n, 0);
    const badCount = Object.entries(condition).filter(([k]) => /Good \(G\)|Poor|Fair/i.test(k) && !/Very Good/i.test(k)).reduce((s, [, n]) => s + n, 0);
    addedDates.sort();
    const firstAdded = addedDates[0] ? addedDates[0].split(" ")[0] : "—";
    const lastAdded = addedDates[addedDates.length - 1] ? addedDates[addedDates.length - 1].split(" ")[0] : "—";

    const topArtists = topN(albumsByArtist, 5);
    const topLabels = topN(label, 5);
    const topFormats = topN(format, 4);

    // Histogramme decennies
    const decKeys = Object.keys(decade).map(Number).sort((a, b) => a - b);
    const decMax = Math.max(...Object.values(decade));
    const decadesHtml = decKeys.map(d => {
      const n = decade[d];
      return `<div class="es-row"><span class="es-decade-label">${d}s</span><span class="es-bar">${bar(n, decMax)}</span><span class="es-bar-n">${n}</span></div>`;
    }).join("");

    const renderList = (entries) => entries.map(([k, v]) =>
      `<div class="es-row"><span class="es-row-key">${escapeHtml(k)}</span><span class="es-row-val">${v}</span></div>`
    ).join("");

    const uniqueLabels = Object.keys(label).length;
    const uniqueFormats = Object.keys(format).length;
    const avgFicheChars = totalAlbums ? Math.round(totalFicheChars / totalAlbums) : 0;

    const panel = document.createElement("div");
    panel.id = "easter-stats";
    panel.className = "easter-stats";
    panel.innerHTML = `
      <div class="easter-stats-inner">
        <button class="easter-close" aria-label="Fermer">&times;</button>
        <div class="easter-title">✦ Stats de la collection ✦</div>

        <div class="es-grid">
          <section class="es-section">
            <h4>Apercu</h4>
            <div class="es-row"><span>Artistes</span><b>${collection.length}</b></div>
            <div class="es-row"><span>Albums uniques</span><b>${totalAlbums}</b></div>
            <div class="es-row"><span>Pressages</span><b>${totalPressings}</b></div>
            <div class="es-row"><span>Labels distincts</span><b>${uniqueLabels}</b></div>
            <div class="es-row"><span>Formats distincts</span><b>${uniqueFormats}</b></div>
            <div class="es-row"><span>Annees couvertes</span><b>${oldest} – ${newest}</b></div>
            <div class="es-row"><span>Note moyenne (notes)</span><b>${avgRating}${ratings.length ? ` <span class="muted-i">/5 sur ${ratings.length}</span>` : ""}</b></div>
          </section>

          <section class="es-section">
            <h4>Records</h4>
            <div class="es-row"><span>Pressage + ancien</span><b>${oldest}</b></div>
            <div class="es-row"><span>Pressage + recent</span><b>${newest}</b></div>
            <div class="es-row"><span>Album le + represse</span><b>${mostPressedAlbum ? escapeHtml(mostPressedAlbum.name) + ` <span class="muted-i">(${mostPressedAlbum.n}×)</span>` : "—"}</b></div>
            <div class="es-row"><span>Mint / Near Mint</span><b>${mintCount} <span class="muted-i">pressages</span></b></div>
            <div class="es-row"><span>Etat &lt; VG</span><b>${badCount} <span class="muted-i">pressages</span></b></div>
            <div class="es-row"><span>Fiches ecrites</span><b>${Object.keys(fiches).length} / ${totalAlbums}</b></div>
            <div class="es-row"><span>Covers recuperees</span><b>${coversCount} / ${totalAlbums}</b></div>
            <div class="es-row"><span>Premier ajout</span><b>${firstAdded}</b></div>
            <div class="es-row"><span>Dernier ajout</span><b>${lastAdded}</b></div>
          </section>

          <section class="es-section es-section-wide">
            <h4>Top 5 artistes <span class="muted-i">par nb albums</span></h4>
            ${renderList(topArtists)}
          </section>

          <section class="es-section es-section-wide">
            <h4>Top 5 labels <span class="muted-i">par nb pressages</span></h4>
            ${renderList(topLabels)}
          </section>

          <section class="es-section es-section-wide">
            <h4>Formats principaux</h4>
            ${renderList(topFormats)}
          </section>

          <section class="es-section es-section-wide">
            <h4>Decennies</h4>
            ${decadesHtml || '<div class="es-row"><span class="muted-i">aucune annee renseignee</span></div>'}
          </section>

          <section class="es-section es-section-wide">
            <h4>Ecriture</h4>
            <div class="es-row"><span>Total caracteres ecrits</span><b>${totalFicheChars.toLocaleString("fr-FR")}</b></div>
            <div class="es-row"><span>Moyenne / album</span><b>${avgFicheChars} car.</b></div>
            <div class="es-row"><span>Fiche la + longue</span><b>${longestFiche ? escapeHtml(longestFiche) + ` <span class="muted-i">(${longestFicheLen} car.)</span>` : "—"}</b></div>
          </section>
        </div>

        <div class="easter-foot">echappe / clic exterieur pour fermer</div>
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
