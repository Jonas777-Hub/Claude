(function () {
  "use strict";
  const LIMIT = 3;
  const CRITERIA = [["beat", "Beat"], ["text", "Text"], ["stimme", "Stimme"], ["vibe", "Vibe"], ["prod", "Produktion"]];
  const TAGS_POS = ["Banger", "Ohrwurm", "Gänsehaut", "Auf Repeat", "Playlist-würdig", "Starker Text", "Geiler Beat", "Tolle Stimme", "Tanzbar", "Chillig", "Nostalgie", "Neu für mich", "Perfekt fürs Auto", "Hidden Gem"];
  const TAGS_NEG = ["Zu lang", "Langweilig", "Nicht mein Genre", "Kannte ich schon", "Zu ruhig", "Zu laut", "Skip-Kandidat", "Text nervt"];
  const QUICK = ["Direkt in meine Playlist.", "Hätte ich nie selbst gefunden.", "Der Refrain ist stark.", "Am Anfang zäh, dann gut.", "Nicht meins, aber okay.", "Mehr davon!", "Erinnert mich an früher."];
  const COVER = ["#FF4F7B,#FFC44D", "#7B4DFF,#FF4F7B", "#13B79A,#5B8CFF", "#FF8A3D,#FF3D6E", "#5B3DF5,#2EC5E0", "#FFC44D,#FF6B3D", "#E23DB5,#7B4DFF", "#2EC27E,#E8E04A"];
  const SPOTIFY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.6.6 0 0 1-.9.2c-2.4-1.5-5.4-1.8-9-1a.6.6 0 1 1-.3-1.2c3.9-.9 7.2-.5 9.9 1.1.3.2.4.6.3.9zm1.2-2.7a.8.8 0 0 1-1.1.3c-2.7-1.7-6.9-2.2-10.2-1.2a.8.8 0 1 1-.4-1.5c3.7-1.1 8.4-.6 11.5 1.3.4.2.5.7.2 1.1zm.1-2.8C14.7 9 9.4 8.8 6.3 9.7a.9.9 0 1 1-.5-1.8c3.5-1.1 9.4-.9 13.1 1.3a.9.9 0 0 1-1 1.7z"/></svg>';
  const CROWN = '<svg viewBox="0 0 24 24" aria-label="Platz 1"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/></svg>';

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dayStr = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const today = () => dayStr(new Date());
  const fmtDay = (s) => {
    if (s === today()) return "Heute";
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (s === dayStr(y)) return "Gestern";
    const [a, b, c] = s.split("-").map(Number);
    return new Date(a, b - 1, c).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  };
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const f1 = (n) => n == null ? "–" : n.toFixed(1).replace(".", ",");
  const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
  };
  const baseUrl = () => location.origin + location.pathname;

  /* ---------- State ---------- */
  let sb = null;
  let me = null;            // auth user id
  let myNick = null;        // profile nick, null = not loaded, "" = missing
  let groups = [];          // [{id,name,code}]
  let group = null;         // current group
  let screen = "loading";   // loading | setup | auth | reset | nick | start | app
  let authMode = "login";
  let view = store.get("dat-view") || "heute";
  const S = { players: {}, songs: {}, ratings: {}, names: {} };
  let channel = null;

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function setStatus(msg) { const s = $("#status"); s.textContent = msg || ""; s.hidden = !msg; }
  function name(uid) { return (S.players[uid] && S.players[uid].nick) || S.names[uid] || "Mitspieler"; }
  function errText(err) {
    const m = String((err && (err.message || err.error_description)) || err || "");
    if (m.includes("LIMIT_REACHED")) return "Du hast heute schon 3 Lieder geschickt.";
    if (m.includes("DUPLICATE_SONG")) return "Dieses Lied wurde in der Gruppe schon geschickt.";
    if (m.includes("CODE_NOT_FOUND")) return "Diesen Code gibt es nicht. Prüf die Schreibweise.";
    if (m.includes("OWN_SONG")) return "Eigene Lieder kannst du nicht bewerten.";
    if (m.includes("Invalid login credentials")) return "E-Mail oder Passwort stimmt nicht.";
    if (m.includes("Email not confirmed")) return "Bestätige zuerst deine E-Mail über den Link, den wir dir geschickt haben.";
    if (m.includes("User already registered")) return "Mit dieser E-Mail gibt es schon ein Konto. Melde dich an.";
    if (m.includes("Password should be")) return "Das Passwort braucht mindestens 6 Zeichen.";
    if (m.toLowerCase().includes("rate limit")) return "Zu viele Versuche. Warte kurz und probier es dann noch mal.";
    if (m.includes("Failed to fetch") || m.includes("NetworkError")) return "Keine Verbindung. Prüf dein Internet.";
    return "Das hat nicht geklappt: " + (m || "unbekannter Fehler");
  }

  /* ---------- Spotify ---------- */
  function parseSpotify(raw) {
    const s = String(raw || "").trim();
    const urlM = s.match(/https?:\/\/[^\s]+/);
    const u = urlM ? urlM[0] : s;
    const tr = u.match(/(?:open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-zA-Z]{2})?\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/);
    if (tr) return { trackId: tr[1], url: "https://open.spotify.com/track/" + tr[1] };
    if (/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(album|playlist|artist|episode|show)\//.test(u)) return { error: "Bitte den Link zu einem einzelnen Lied nehmen, nicht zu Album oder Playlist." };
    if (/^https:\/\/(spotify\.link|spoti\.fi)\/[A-Za-z0-9]+/.test(u)) return { trackId: null, url: u };
    return { error: "Das ist kein Spotify-Lied-Link. Er sieht so aus: open.spotify.com/track/…" };
  }

  /* ---------- Derived data ---------- */
  function allSongs() {
    const out = [];
    for (const uid of Object.keys(S.songs)) for (const s of S.songs[uid]) out.push(s);
    return out.sort((a, b) => b.at - a.at);
  }
  function allRatings() {
    const out = [];
    for (const uid of Object.keys(S.ratings)) for (const r of S.ratings[uid]) out.push(r);
    return out;
  }
  function ratingsFor(song) { return allRatings().filter((r) => r.songId === song.id && r.by !== song.by); }
  function myRatingFor(song) { return (S.ratings[me] || []).find((r) => r.songId === song.id); }
  function songsBy(uid, day) { return (S.songs[uid] || []).filter((s) => !day || s.day === day); }
  function todoForMe() { return allSongs().filter((s) => s.by !== me && !myRatingFor(s)).sort((a, b) => a.at - b.at); }
  function missedSlots(uid) {
    const p = S.players[uid]; if (!p || !p.joinedDay) return 0;
    const [a, b, c] = p.joinedDay.split("-").map(Number);
    const d = new Date(a, b - 1, c); const t = today(); let miss = 0, guard = 0;
    while (dayStr(d) < t && guard++ < 3650) { miss += Math.max(0, LIMIT - songsBy(uid, dayStr(d)).length); d.setDate(d.getDate() + 1); }
    return miss;
  }
  function openFor(uid) { return allSongs().filter((s) => s.by !== uid && !(S.ratings[uid] || []).some((r) => r.songId === s.id)).length; }

  /* ---------- Rendering ---------- */
  function cover(song) {
    const letter = (song.title || "?").trim().charAt(0).toUpperCase() || "?";
    return '<div class="cover" style="background:linear-gradient(135deg,' + COVER[hash(song.by + song.id) % COVER.length] + ')" aria-hidden="true">' + esc(letter) + "</div>";
  }
  function scorePill(n, count) {
    if (n == null) return '<span class="score-pill muted">–</span>';
    return '<span class="score-pill' + (n >= 8 ? " hot" : "") + '">' + f1(n) + (count != null ? " <small>(" + count + ")</small>" : "") + "</span>";
  }
  function songHead(s, extra) {
    return '<div class="song">' + cover(s) + '<div class="stack min0" style="gap:6px">' +
      '<div class="spread" style="align-items:flex-start"><div class="min0"><div class="title">' + esc(s.title || "Unbenanntes Lied") + "</div>" +
      '<div class="meta">' + esc(s.artist || "Unbekannt") + " · von " + esc(name(s.by)) + " · " + esc(fmtDay(s.day)) + "</div></div>" + (extra || "") + "</div>" +
      (s.note ? '<div class="note">„' + esc(s.note) + "“</div>" : "") + "</div></div>";
  }
  function reviewHtml(r) {
    const tags = (r.tags || []).map((t) => '<span class="tag">' + esc(t) + "</span>").join(" ");
    const crit = CRITERIA.filter(([k]) => r.crit && r.crit[k]).map(([k, l]) => l + " " + r.crit[k]).join(" · ");
    return '<div class="review"><div class="spread"><strong>' + esc(name(r.by)) + "</strong>" + scorePill(r.score) + "</div>" +
      (crit ? '<div class="small muted num">' + esc(crit) + "</div>" : "") +
      (tags ? '<div class="chips" style="gap:4px">' + tags + "</div>" : "") +
      (r.comment ? '<div class="c">' + esc(r.comment) + "</div>" : "") + "</div>";
  }

  function render() {
    const sections = { setup: "#setupView", auth: "#authView", reset: "#resetView", nick: "#nickView", start: "#startView" };
    for (const k of Object.keys(sections)) $(sections[k]).hidden = screen !== k;
    const inApp = screen === "app";
    $("#tabs").hidden = !inApp;
    $("#groupBtn").hidden = !(me && (inApp || (screen === "start" && groups.length)));
    $("#groupName").textContent = group ? group.name : "Gruppen";
    for (const v of ["heute", "bewerten", "rang", "verlauf"]) $("#v-" + v).hidden = !inApp || view !== v;
    document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === view)));
    if (screen === "auth") {
      document.querySelectorAll("[data-auth]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.auth === authMode)));
      $("#signupNickField").hidden = authMode !== "signup";
      $("#authBtn").textContent = authMode === "signup" ? "Konto erstellen" : "Anmelden";
      $("#pwInput").autocomplete = authMode === "signup" ? "new-password" : "current-password";
    }
    if (!inApp) return;
    const todo = todoForMe();
    const badge = $("#todoBadge"); badge.hidden = !todo.length; badge.textContent = todo.length;
    if (view === "heute") renderToday();
    if (view === "bewerten") renderRate(todo);
    if (view === "rang") renderStats();
    if (view === "verlauf") renderHistory();
  }

  function renderToday() {
    const mine = songsBy(me, today()).sort((a, b) => a.at - b.at);
    $("#todayCount").innerHTML = mine.length + "<small>/" + LIMIT + "</small>";
    let html = "";
    for (let i = 0; i < LIMIT; i++) {
      const s = mine[i];
      html += s ? '<div class="slot filled"><span class="n">#' + (i + 1) + '</span><span class="t">' + esc(s.title) + '</span><span class="a">' + esc(s.artist || "") + "</span></div>"
        : '<div class="slot"><span class="n">#' + (i + 1) + '</span><span class="small muted">noch frei</span></div>';
    }
    $("#mySlots").innerHTML = html;
    const full = mine.length >= LIMIT;
    $("#addBtn").disabled = full;
    if (full) { $("#addMsg").className = "ok"; $("#addMsg").textContent = "Fertig für heute. Morgen geht's weiter."; }

    const ids = Object.keys(S.players).sort((a, b) => name(a).localeCompare(name(b)));
    $("#groupToday").innerHTML = ids.map((uid) => {
      const n = songsBy(uid, today()).length;
      const open = openFor(uid);
      let dots = ""; for (let i = 0; i < LIMIT; i++) dots += '<span class="dot' + (i < n ? " on" : "") + '"></span>';
      return '<div class="panel spread"><div class="min0"><strong>' + esc(name(uid)) + (uid === me ? " (du)" : "") + "</strong>" +
        '<div class="small muted">' + (open ? open + " Lied" + (open === 1 ? "" : "er") + " noch nicht bewertet" : "Alles bewertet") + "</div></div>" +
        '<div class="row"><span class="dots" aria-label="' + n + ' von 3 geschickt">' + dots + '</span><span class="num small muted">' + n + "/" + LIMIT + "</span></div></div>";
    }).join("") + (ids.length < 2 ? '<div class="empty"><h3>Noch allein hier</h3><p>Lade deine Freunde ein: Tipp oben auf den Gruppennamen und teile den Einladungslink.</p></div>' : "");
  }

  function renderRate(todo) {
    $("#todoList").innerHTML = todo.length ? todo.map((s) =>
      '<div class="card stack">' + songHead(s) +
      '<div class="row"><a class="btn spotify" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + SPOTIFY_ICON + "Anhören</a>" +
      '<button class="btn primary" data-rate="' + esc(s.id) + '">Bewerten</button></div></div>').join("")
      : '<div class="empty"><h3>Alles bewertet</h3><p>Sobald jemand ein neues Lied schickt, taucht es hier auf.</p></div>';
    const done = allSongs().filter((s) => s.by !== me && myRatingFor(s)).slice(0, 30);
    $("#doneList").innerHTML = done.length ? done.map((s) => {
      const r = myRatingFor(s);
      return '<div class="card stack">' + songHead(s, scorePill(r.score)) +
        '<div class="row"><a class="btn sm spotify" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + SPOTIFY_ICON + 'Spotify</a><button class="btn sm ghost" data-rate="' + esc(s.id) + '">Bewertung ändern</button></div></div>';
    }).join("") : '<p class="muted small">Noch nichts bewertet.</p>';
  }

  function renderStats() {
    const ids = Object.keys(S.players);
    const rows = ids.map((uid) => {
      const recv = allRatings().filter((r) => r.owner === uid && r.by !== uid);
      return { uid, avg: avg(recv.map((r) => r.score)), n: recv.length, total: recv.reduce((a, r) => a + r.score, 0), songs: songsBy(uid).length };
    }).sort((a, b) => (b.avg == null ? -1 : b.avg) - (a.avg == null ? -1 : a.avg) || b.n - a.n);
    const lead = rows[0] && rows[0].avg != null ? rows[0].avg : null;
    $("#leaderboard").innerHTML = rows.map((r, i) =>
      '<div class="lb-row' + (i === 0 && lead != null ? " lead" : "") + '"><div class="lb-rank">' + (r.avg == null ? "–" : i === 0 ? CROWN : i + 1) + "</div>" +
      '<div class="min0"><strong>' + esc(name(r.uid)) + (r.uid === me ? " (du)" : "") + "</strong>" + (i === 0 && lead != null ? '<span class="lead-tag">führt</span>' : "") +
      '<div class="small muted">' + r.songs + " Lieder · " + r.n + " Bewertungen · " + r.total + " Punkte</div>" +
      '<div class="bar"><i style="width:' + (r.avg ? r.avg * 10 : 0) + '%"></i></div></div>' +
      '<div class="lb-avg">' + f1(r.avg) + "<small>von 10</small></div></div>").join("") ||
      '<div class="empty"><h3>Noch keine Bewertungen</h3><p>Die Rangliste füllt sich, sobald die ersten Lieder bewertet sind.</p></div>';

    const scored = allSongs().map((s) => { const rs = ratingsFor(s); return { s, a: avg(rs.map((r) => r.score)), n: rs.length, rs }; })
      .filter((x) => x.a != null).sort((a, b) => b.a - a.a || b.n - a.n).slice(0, 10);
    $("#topSongs").innerHTML = scored.length ? scored.map((x, i) => {
      const tags = {}; x.rs.forEach((r) => (r.tags || []).forEach((t) => tags[t] = (tags[t] || 0) + 1));
      const top = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => '<span class="tag">' + esc(t) + "</span>").join(" ");
      return '<div class="card stack" style="gap:8px"><div class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class="num muted" style="width:26px;flex:none;font-weight:700">' + (i + 1) + '.</span><div class="min0" style="flex:1">' +
        songHead(x.s, scorePill(x.a, x.n)) + "</div></div>" + (top ? '<div class="chips" style="gap:4px;padding-left:38px">' + top + "</div>" : "") +
        '<div style="padding-left:38px"><a class="btn sm spotify" href="' + esc(x.s.url) + '" target="_blank" rel="noopener">' + SPOTIFY_ICON + "Spotify</a></div></div>";
    }).join("") : '<p class="muted small">Noch keine bewerteten Lieder.</p>';

    let t = '<table><thead><tr><th>Person</th>' + CRITERIA.map(([, l]) => '<th class="n">' + l + "</th>").join("") + "</tr></thead><tbody>";
    for (const uid of ids) {
      const recv = allRatings().filter((r) => r.owner === uid && r.by !== uid);
      t += "<tr><td>" + esc(name(uid)) + "</td>" + CRITERIA.map(([k]) => '<td class="n">' + f1(avg(recv.map((r) => r.crit && r.crit[k]).filter(Boolean))) + "</td>").join("") + "</tr>";
    }
    $("#critTable").innerHTML = t + "</tbody></table>";

    $("#matrixBlock").hidden = ids.length < 2;
    let m = "<table><thead><tr><th>gibt ↓ / bekommt →</th>" + ids.map((u) => '<th class="n">' + esc(name(u)) + "</th>").join("") + "</tr></thead><tbody>";
    for (const a of ids) {
      m += "<tr><td>" + esc(name(a)) + "</td>" + ids.map((b) => a === b ? '<td class="n muted">·</td>' : '<td class="n">' + f1(avg((S.ratings[a] || []).filter((r) => r.owner === b).map((r) => r.score))) + "</td>").join("") + "</tr>";
    }
    $("#matrix").innerHTML = m + "</tbody></table>";

    $("#playerStats").innerHTML = ids.map((uid) => {
      const given = S.ratings[uid] || [];
      const tags = {}; allRatings().filter((r) => r.owner === uid).forEach((r) => (r.tags || []).forEach((x) => tags[x] = (tags[x] || 0) + 1));
      const topTag = Object.entries(tags).sort((a, b) => b[1] - a[1])[0];
      const miss = missedSlots(uid);
      return '<div class="stat stack" style="gap:6px"><strong>' + esc(name(uid)) + "</strong>" +
        '<div class="small muted">Gibt im Schnitt</div><div class="v">' + f1(avg(given.map((r) => r.score))) + "</div>" +
        '<div class="small">Bewertet: <span class="num">' + given.length + "</span></div>" +
        '<div class="small">Verpasste Lieder: <span class="num" style="color:' + (miss ? "var(--warn)" : "var(--good)") + '">' + miss + "</span></div>" +
        '<div class="small">Häufigstes Etikett: ' + (topTag ? esc(topTag[0]) : "–") + "</div></div>";
    }).join("");
  }

  function renderHistory() {
    const songs = allSongs(); const byDay = {};
    songs.forEach((s) => (byDay[s.day] = byDay[s.day] || []).push(s));
    const days = Object.keys(byDay).sort().reverse();
    $("#history").innerHTML = days.length ? days.map((d) => '<div class="stack"><div class="spread"><h2>' + esc(fmtDay(d)) + '</h2><span class="small muted">' + byDay[d].length + " Lieder</span></div>" +
      byDay[d].map((s) => { const rs = ratingsFor(s); const canDel = s.by === me && s.day === today() && !rs.length;
        return '<div class="card stack">' + songHead(s, scorePill(avg(rs.map((r) => r.score)), rs.length)) +
          '<div class="row"><a class="btn sm spotify" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + SPOTIFY_ICON + "Spotify</a>" + (canDel ? '<button class="btn sm ghost" data-del="' + esc(s.id) + '">Löschen</button>' : "") + "</div>" +
          rs.map(reviewHtml).join("") + "</div>"; }).join("") + "</div>").join("")
      : '<div class="empty"><h3>Noch keine Lieder</h3><p>Schick unter „Heute“ dein erstes Lied.</p></div>';
  }

  /* ---------- Sheets ---------- */
  let R = null;          // rating sheet state
  let sheetMode = null;  // "rate" | "groups"
  function showSheet(html, mode) {
    $("#sheet").innerHTML = html; sheetMode = mode;
    $("#scrim").hidden = false; document.body.style.overflow = "hidden";
  }
  function closeSheet() { $("#scrim").hidden = true; document.body.style.overflow = ""; R = null; sheetMode = null; }
  function findSong(id) { return allSongs().find((s) => s.id === id); }
  function chip(t) { return '<button type="button" data-tag="' + esc(t) + '" aria-pressed="' + R.tags.has(t) + '">' + esc(t) + "</button>"; }

  function openRateSheet(id) {
    const s = findSong(id); if (!s) return;
    const prev = myRatingFor(s);
    R = { song: s, score: prev ? prev.score : null, crit: Object.assign({}, prev && prev.crit), tags: new Set(prev ? prev.tags : []), comment: prev ? prev.comment || "" : "" };
    showSheet(
      '<div class="spread"><h2 id="sheetTitle">Bewerten</h2><button class="btn sm ghost" data-close>Schließen</button></div>' +
      songHead(s) +
      '<a class="btn spotify" href="' + esc(s.url) + '" target="_blank" rel="noopener">' + SPOTIFY_ICON + "Auf Spotify anhören</a>" +
      '<label class="check" for="listened"><input type="checkbox" id="listened"' + (prev ? " checked" : "") + '><span>Ich habe das Lied komplett gehört</span></label>' +
      '<div class="stack" style="gap:8px"><div class="spread"><div class="eyebrow">Gesamtnote</div><div class="big-score grad-text" id="bigScore">' + (R.score || "") + '</div></div><div class="scores" id="scoreBtns">' +
      Array.from({ length: 10 }, (_, i) => '<button type="button" data-score="' + (i + 1) + '" aria-pressed="' + (R.score === i + 1) + '">' + (i + 1) + "</button>").join("") + "</div></div>" +
      '<div class="stack" style="gap:8px"><div class="eyebrow">Kriterien (optional, 1–5)</div>' +
      CRITERIA.map(([k, l]) => '<div class="crit"><span class="lbl">' + l + '</span><div class="crit-btns">' +
        [1, 2, 3, 4, 5].map((v) => '<button type="button" data-crit="' + k + '" data-v="' + v + '" aria-pressed="' + (R.crit[k] === v) + '">' + v + "</button>").join("") + "</div></div>").join("") + "</div>" +
      '<div class="stack" style="gap:8px"><div class="eyebrow">Gefällt mir</div><div class="chips">' + TAGS_POS.map(chip).join("") + "</div></div>" +
      '<div class="stack" style="gap:8px"><div class="eyebrow">Eher nicht</div><div class="chips neg">' + TAGS_NEG.map(chip).join("") + "</div></div>" +
      '<div class="stack" style="gap:8px"><div class="eyebrow">Kommentar</div><div class="chips">' + QUICK.map((q) => '<button type="button" data-quick="' + esc(q) + '">' + esc(q) + "</button>").join("") + "</div>" +
      '<textarea id="commentInput" maxlength="600" placeholder="Was denkst du über das Lied?">' + esc(R.comment) + "</textarea></div>" +
      '<div class="spread"><span id="sheetMsg" class="small muted"></span><button class="btn primary" id="saveRating" type="button">Bewertung speichern</button></div>', "rate");
    sheetValidate();
  }
  function sheetValidate() {
    if (!R) return;
    const msg = $("#sheetMsg"), listened = $("#listened").checked;
    $("#saveRating").disabled = !(listened && R.score);
    msg.className = "small muted";
    msg.textContent = !listened ? "Erst komplett anhören und abhaken." : !R.score ? "Wähle eine Note von 1 bis 10." : "Note " + R.score + " von 10";
  }

  function openGroupSheet() {
    const g = group;
    const link = g ? baseUrl() + "?join=" + g.code : "";
    showSheet(
      '<div class="spread"><h2 id="sheetTitle">Gruppen</h2><button class="btn sm ghost" data-close>Schließen</button></div>' +
      (g ? '<div class="card stack"><div class="eyebrow">Freunde einladen zu „' + esc(g.name) + '“</div>' +
        '<div class="code">' + esc(g.code) + "</div>" +
        '<input type="text" id="inviteLink" readonly value="' + esc(link) + '">' +
        '<button class="btn primary" type="button" id="copyInvite">Einladungslink kopieren</button>' +
        '<p class="small muted">Wer den Link öffnet und sich anmeldet, ist sofort in der Gruppe.</p></div>' : "") +
      '<div class="stack"><div class="eyebrow">Deine Gruppen</div>' +
      groups.map((x) => '<button type="button" class="group-item" data-group="' + esc(x.id) + '" aria-current="' + (g && x.id === g.id) + '"><span>' + esc(x.name) + '</span><span class="num small muted">' + esc(x.code) + "</span></button>").join("") +
      '<button type="button" class="btn" id="newGroupBtn">Gruppe gründen oder beitreten</button></div>' +
      '<div class="spread" style="margin-top:8px"><span class="small muted">Angemeldet als ' + esc(myNick || "") + "</span>" +
      '<div class="row">' + (g ? '<button type="button" class="btn sm ghost" id="leaveBtn">Gruppe verlassen</button>' : "") +
      '<button type="button" class="btn sm" id="logoutBtn">Abmelden</button></div></div>', "groups");
  }

  $("#scrim").addEventListener("click", async (e) => {
    if (e.target === $("#scrim") || e.target.closest("[data-close]")) return closeSheet();
    if (sheetMode === "groups") return onGroupSheetClick(e);
    if (!R) return;
    const sc = e.target.closest("[data-score]");
    if (sc) { R.score = Number(sc.dataset.score); document.querySelectorAll("#scoreBtns button").forEach((b) => b.setAttribute("aria-pressed", String(b === sc))); $("#bigScore").textContent = R.score; return sheetValidate(); }
    const cr = e.target.closest("[data-crit]");
    if (cr) { const k = cr.dataset.crit, v = Number(cr.dataset.v); R.crit[k] = R.crit[k] === v ? undefined : v;
      document.querySelectorAll('[data-crit="' + k + '"]').forEach((b) => b.setAttribute("aria-pressed", String(R.crit[k] === Number(b.dataset.v)))); return; }
    const tg = e.target.closest("[data-tag]");
    if (tg) { const t = tg.dataset.tag; R.tags.has(t) ? R.tags.delete(t) : R.tags.add(t); tg.setAttribute("aria-pressed", String(R.tags.has(t))); return; }
    const q = e.target.closest("[data-quick]");
    if (q) { const ta = $("#commentInput"); ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + q.dataset.quick; return; }
    if (e.target.closest("#saveRating")) {
      const btn = $("#saveRating"); btn.disabled = true;
      const s = R.song;
      const crit = {}; for (const [k] of CRITERIA) if (R.crit[k]) crit[k] = R.crit[k];
      const row = { song_id: s.id, user_id: me, group_id: group.id, score: R.score, crit, tags: Array.from(R.tags), comment: $("#commentInput").value.trim().slice(0, 600) };
      const { error } = await sb.from("ratings").upsert(row, { onConflict: "song_id,user_id" });
      if (error) { $("#sheetMsg").className = "err"; $("#sheetMsg").textContent = errText(error); btn.disabled = false; return; }
      closeSheet(); toast("Bewertung gespeichert"); await loadGroup();
    }
  });
  $("#scrim").addEventListener("change", (e) => { if (e.target.id === "listened") sheetValidate(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sheetMode) closeSheet(); });

  async function onGroupSheetClick(e) {
    const gi = e.target.closest("[data-group]");
    if (gi) { const g = groups.find((x) => x.id === gi.dataset.group); closeSheet(); if (g) await selectGroup(g); return; }
    if (e.target.closest("#copyInvite")) {
      const inp = $("#inviteLink");
      try { await navigator.clipboard.writeText(inp.value); toast("Link kopiert"); }
      catch (err) { inp.select(); toast("Link markiert: jetzt kopieren"); }
      return;
    }
    if (e.target.closest("#newGroupBtn")) { closeSheet(); screen = "start"; render(); return; }
    const lv = e.target.closest("#leaveBtn");
    if (lv) {
      if (lv.dataset.confirm !== "1") { lv.dataset.confirm = "1"; lv.textContent = "Wirklich verlassen?"; return; }
      const { error } = await sb.from("members").delete().eq("group_id", group.id).eq("user_id", me);
      if (error) return toast(errText(error));
      closeSheet(); store.set("dat-group", null); group = null; await loadGroups(); toast("Gruppe verlassen"); return;
    }
    if (e.target.closest("#logoutBtn")) { closeSheet(); await sb.auth.signOut(); return; }
  }

  /* ---------- Actions ---------- */
  $("#groupBtn").addEventListener("click", openGroupSheet);
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-view]"); if (!b) return;
    view = b.dataset.view; store.set("dat-view", view);
    render(); window.scrollTo(0, 0);
  });
  document.addEventListener("click", async (e) => {
    if (e.target.closest("#scrim")) return;
    const r = e.target.closest("[data-rate]"); if (r) return openRateSheet(r.dataset.rate);
    const d = e.target.closest("[data-del]");
    if (d) {
      if (d.dataset.confirm !== "1") { d.dataset.confirm = "1"; d.textContent = "Wirklich löschen?"; return; }
      const { error } = await sb.from("songs").delete().eq("id", d.dataset.del);
      if (error) return toast(errText(error));
      toast("Lied gelöscht"); await loadGroup();
    }
  });

  // Auth
  document.querySelectorAll("[data-auth]").forEach((b) => b.addEventListener("click", () => {
    authMode = b.dataset.auth; $("#authMsg").className = "small muted"; $("#authMsg").textContent = "Dein Fortschritt ist mit deinem Konto auf jedem Gerät da."; render();
  }));
  $("#authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#emailInput").value.trim(), password = $("#pwInput").value;
    const msg = $("#authMsg"), btn = $("#authBtn");
    const fail = (t) => { msg.className = "err"; msg.textContent = t; btn.disabled = false; };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Bitte eine gültige E-Mail eingeben.");
    if (password.length < 6) return fail("Das Passwort braucht mindestens 6 Zeichen.");
    btn.disabled = true;
    if (authMode === "signup") {
      const nick = $("#signupNick").value.trim().slice(0, 24);
      if (!nick) return fail("Bitte einen Spielnamen eingeben.");
      store.set("dat-pending-nick", nick);
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nick }, emailRedirectTo: baseUrl() } });
      if (error) return fail(errText(error));
      if (!data.session) { msg.className = "ok"; msg.textContent = "Fast geschafft: Wir haben dir eine E-Mail geschickt. Klick auf den Link darin, danach kannst du dich anmelden."; btn.disabled = false; authMode = "login"; render(); }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return fail(errText(error));
    }
    btn.disabled = false;
  });
  $("#forgotBtn").addEventListener("click", async () => {
    const email = $("#emailInput").value.trim(), msg = $("#authMsg");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.className = "err"; msg.textContent = "Trag oben deine E-Mail ein, dann noch mal auf „Passwort vergessen?“ tippen."; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: baseUrl() });
    if (error) { msg.className = "err"; msg.textContent = errText(error); return; }
    msg.className = "ok"; msg.textContent = "Wir haben dir einen Link zum Zurücksetzen geschickt.";
  });
  $("#resetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: $("#newPw").value });
    if (error) { $("#resetMsg").className = "err"; $("#resetMsg").textContent = errText(error); return; }
    toast("Passwort gespeichert"); await afterLogin();
  });
  $("#nickForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nick = $("#nickInput").value.trim().slice(0, 24); if (!nick) return;
    const { error } = await sb.from("profiles").upsert({ id: me, nick });
    if (error) return setStatus(errText(error));
    myNick = nick; store.set("dat-pending-nick", null); await loadGroups();
  });

  // Groups
  $("#joinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = $("#joinCode").value.trim().toUpperCase();
    if (code.length !== 6) { $("#joinMsg").className = "err"; $("#joinMsg").textContent = "Der Code hat 6 Zeichen."; return; }
    await joinByCode(code, $("#joinMsg"));
  });
  async function joinByCode(code, msgEl) {
    const { data, error } = await sb.rpc("join_group", { p_code: code, p_day: today() });
    if (error) { if (msgEl) { msgEl.className = "err"; msgEl.textContent = errText(error); } else setStatus(errText(error)); return false; }
    toast("Willkommen in „" + data.name + "“");
    store.set("dat-group", data.id);
    await loadGroups();
    return true;
  }
  $("#createForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nm = $("#groupNameInput").value.trim().slice(0, 40) || "Musik-Crew";
    const { data, error } = await sb.rpc("create_group", { p_name: nm, p_day: today() });
    if (error) { $("#createMsg").className = "err"; $("#createMsg").textContent = errText(error); return; }
    store.set("dat-group", data.id);
    await loadGroups();
    openGroupSheet();
  });

  // Add song
  $("#linkInput").addEventListener("input", () => {
    const v = $("#linkInput").value; const m = $("#addMsg");
    if (!v.trim()) { m.className = "small muted"; m.textContent = "In Spotify: Teilen → Link kopieren, dann hier einfügen."; return; }
    const p = parseSpotify(v);
    if (p.error) { m.className = "err"; m.textContent = p.error; }
    else { m.className = "ok"; m.textContent = "Link erkannt. Trag noch Titel und Interpret ein."; }
    const pre = v.split(/https?:\/\//)[0].trim();
    if (pre && !$("#titleInput").value) { const parts = pre.replace(/[„“"]/g, "").split(/\s[·\-–]\s|\sby\s|\svon\s/); $("#titleInput").value = (parts[0] || "").trim().slice(0, 80); if (parts[1] && !$("#artistInput").value) $("#artistInput").value = parts[1].trim().slice(0, 80); }
  });
  $("#addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const m = $("#addMsg");
    const fail = (t) => { m.className = "err"; m.textContent = t; };
    if (songsBy(me, today()).length >= LIMIT) return fail("Du hast heute schon 3 Lieder geschickt.");
    const p = parseSpotify($("#linkInput").value);
    if (p.error) return fail(p.error);
    const title = $("#titleInput").value.trim();
    if (!title) return fail("Bitte den Songtitel eintragen.");
    if (p.trackId) { const dup = allSongs().find((s) => s.trackId === p.trackId); if (dup) return fail("Das Lied hat " + name(dup.by) + " schon am " + fmtDay(dup.day) + " geschickt."); }
    const btn = $("#addBtn"); btn.disabled = true;
    const { error } = await sb.from("songs").insert({ group_id: group.id, user_id: me, url: p.url, track_id: p.trackId, title, artist: $("#artistInput").value.trim(), note: $("#noteInput").value.trim(), day: today() });
    if (error) { fail(errText(error)); btn.disabled = false; return; }
    ["#linkInput", "#titleInput", "#artistInput", "#noteInput"].forEach((s) => $(s).value = "");
    m.className = "ok"; m.textContent = "Geschickt!"; toast("Lied geschickt");
    await loadGroup();
  });

  /* ---------- Data ---------- */
  async function afterLogin() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { me = null; screen = "auth"; render(); return; }
    me = user.id;
    const { data: prof, error } = await sb.from("profiles").select("nick").eq("id", me).maybeSingle();
    if (error) { setStatus(errText(error)); return; }
    myNick = prof ? prof.nick : "";
    if (!myNick) {
      const pending = (user.user_metadata && user.user_metadata.nick) || store.get("dat-pending-nick");
      if (pending) {
        const r = await sb.from("profiles").upsert({ id: me, nick: String(pending).slice(0, 24) });
        if (!r.error) { myNick = String(pending).slice(0, 24); store.set("dat-pending-nick", null); }
      }
    }
    if (!myNick) { screen = "nick"; render(); return; }
    const pendingJoin = store.get("dat-join");
    if (pendingJoin) { store.set("dat-join", null); if (await joinByCode(pendingJoin)) return; }
    await loadGroups();
  }

  async function loadGroups() {
    const { data, error } = await sb.from("members").select("group_id, groups(id, name, code)").eq("user_id", me);
    if (error) { setStatus(errText(error)); return; }
    groups = data.map((r) => r.groups).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    const want = store.get("dat-group");
    const g = groups.find((x) => x.id === want) || groups[0];
    if (!g) { group = null; unsubscribe(); screen = "start"; render(); return; }
    await selectGroup(g);
  }

  async function selectGroup(g) {
    group = g; store.set("dat-group", g.id);
    S.players = {}; S.songs = {}; S.ratings = {};
    screen = "app"; render();
    await loadGroup();
    subscribe();
  }

  let loading = false, again = false;
  async function loadGroup() {
    if (!group) return;
    if (loading) { again = true; return; }
    loading = true;
    try {
      const G = group.id;
      const [m, s, r] = await Promise.all([
        sb.from("members").select("user_id, joined_day").eq("group_id", G),
        sb.from("songs").select("*").eq("group_id", G),
        sb.from("ratings").select("*").eq("group_id", G),
      ]);
      const err = m.error || s.error || r.error;
      if (err) { setStatus(errText(err)); return; }
      const ids = new Set(m.data.map((x) => x.user_id));
      s.data.forEach((x) => ids.add(x.user_id));
      r.data.forEach((x) => ids.add(x.user_id));
      const p = ids.size ? await sb.from("profiles").select("id, nick").in("id", Array.from(ids)) : { data: [] };
      const nicks = {}; (p.data || []).forEach((x) => { nicks[x.id] = x.nick; });
      S.names = nicks;
      S.players = {}; m.data.forEach((x) => { S.players[x.user_id] = { nick: nicks[x.user_id], joinedDay: x.joined_day }; });
      S.songs = {}; const owner = {};
      s.data.forEach((x) => {
        owner[x.id] = x.user_id;
        (S.songs[x.user_id] = S.songs[x.user_id] || []).push({ id: x.id, by: x.user_id, url: x.url, trackId: x.track_id, title: x.title, artist: x.artist, note: x.note, day: x.day, at: Date.parse(x.created_at) });
      });
      S.ratings = {};
      r.data.forEach((x) => { (S.ratings[x.user_id] = S.ratings[x.user_id] || []).push({ by: x.user_id, owner: owner[x.song_id], songId: x.song_id, score: x.score, crit: x.crit || {}, tags: x.tags || [], comment: x.comment }); });
      setStatus("");
      render();
    } finally {
      loading = false;
      if (again) { again = false; loadGroup(); }
    }
  }

  let reloadT = null;
  const scheduleReload = () => { clearTimeout(reloadT); reloadT = setTimeout(loadGroup, 250); };
  function unsubscribe() { if (channel) { sb.removeChannel(channel); channel = null; } }
  function subscribe() {
    unsubscribe();
    const G = group.id;
    channel = sb.channel("g-" + G);
    for (const table of ["songs", "ratings", "members"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: "group_id=eq." + G }, scheduleReload);
    }
    channel.subscribe();
  }
  // Catch up after the phone wakes up or the tab comes back.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && screen === "app") loadGroup(); });

  /* ---------- Clock ---------- */
  let lastDay = today();
  function tick() {
    const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0);
    const mins = Math.max(0, Math.round((m - n) / 60000)), h = Math.floor(mins / 60);
    $("#countdown").textContent = "Neue Runde in " + (h ? h + " Std " : "") + (mins % 60) + " Min";
    if (today() !== lastDay) { lastDay = today(); render(); }
  }
  tick(); setInterval(tick, 30000);

  /* ---------- Boot ---------- */
  async function boot() {
    const params = new URLSearchParams(location.search);
    const join = params.get("join");
    if (join) {
      store.set("dat-join", join.toUpperCase().slice(0, 6));
      history.replaceState(null, "", baseUrl() + location.hash);
    }
    const cfg = window.DAT_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) { screen = "setup"; render(); return; }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    if (store.get("dat-join")) setStatus("Du wurdest eingeladen. Melde dich an oder registriere dich, dann bist du direkt in der Gruppe.");
    let handled = false;
    sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { handled = true; screen = "reset"; render(); return; }
      if (event === "SIGNED_OUT") { me = null; group = null; groups = []; unsubscribe(); screen = "auth"; render(); return; }
      if (event === "SIGNED_IN" && session && session.user.id !== me && screen !== "reset") { handled = true; setTimeout(afterLogin, 0); }
    });
    const { data } = await sb.auth.getSession();
    if (!data.session) { if (screen !== "reset") { screen = "auth"; render(); } return; }
    if (!handled && !me) await afterLogin();
  }
  boot();
})();
