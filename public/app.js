import {
  DEFAULT_PARAMS, FULL_CROP, normalizeParams, normalizeBox, loadImageFromFile,
  scaledCanvas, canvasToDataUrl, renderImage, analyze,
} from "./editor.js";
import { localSuggestions, pickFive, parseInstruction, STYLE_LABELS } from "./presets.js";
import * as prefs from "./prefs.js";

const PREVIEW_SIZE = 1400;
const EXPORT_SIZE = 4096;

const $ = (sel) => document.querySelector(sel);
const els = {
  fileInput: $("#file-input"),
  dropzone: $("#dropzone"),
  originalView: $("#original-view"),
  originalMeta: $("#original-meta"),
  grid: $("#grid"),
  suggestMeta: $("#suggest-meta"),
  form: $("#prompt-form"),
  input: $("#prompt-input"),
  promptBtn: $("#prompt-btn"),
  undoBtn: $("#undo-btn"),
  newBtn: $("#new-btn"),
  modeChip: $("#mode-chip"),
  targetHint: $("#target-hint"),
  quick: $("#quick"),
  toast: $("#toast"),
  viewer: $("#viewer"),
  viewerTitle: $("#viewer-title"),
  compare: $("#compare"),
  compareAfter: $("#compare-after"),
  compareBefore: $("#compare-before"),
  compareHandle: $("#compare-handle"),
  selection: $("#selection"),
  removeTool: $("#remove-tool"),
  viewerDownload: $("#viewer-download"),
  viewerClose: $("#viewer-close"),
  viewerHint: $("#viewer-hint"),
};

const state = {
  claude: false,
  file: null,
  imageId: null,
  original: null, // HTMLImageElement in voller Größe
  preview: null,  // verkleinertes Original-Canvas
  suggestions: [],
  selectedId: null,
  busy: false,
};

// ---------- Kleine Helfer ----------

let toastTimer;
function toast(message, { error = false, ms = 4500 } = {}) {
  els.toast.textContent = message;
  els.toast.classList.toggle("error", error);
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), ms);
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

const selected = () => state.suggestions.find((s) => s.id === state.selectedId) || state.suggestions[0];

// ---------- Dashboard ----------

function renderStats() {
  const s = prefs.summary();
  $("#stat-images").textContent = s.images;
  $("#stat-ratings").textContent = s.ratings;
  $("#stat-likes").textContent = s.likes;
  const bars = $("#style-bars");
  const entries = Object.entries(s.allScores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!entries.length) {
    bars.innerHTML = '<span class="muted">Bewerte Vorschläge mit ♥ oder Sternen – ich lerne, was dir gefällt.</span>';
    return;
  }
  const max = entries[0][1];
  bars.innerHTML = "";
  for (const [style, score] of entries) {
    const row = document.createElement("div");
    row.className = "style-bar";
    row.innerHTML = `<span></span><div class="track"><div class="fill"></div></div><span class="num"></span>`;
    row.children[0].textContent = STYLE_LABELS[style] || style;
    row.querySelector(".fill").style.width = `${Math.max(6, (score / max) * 100)}%`;
    row.children[2].textContent = Math.round(score);
    bars.append(row);
  }
}

// ---------- Bild laden ----------

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    toast("Bitte wähle eine Bilddatei aus.", { error: true });
    return;
  }
  if (state.busy) return;
  setBusy(true);
  try {
    const img = await loadImageFromFile(file);
    state.file = file;
    state.original = img;
    state.preview = scaledCanvas(img, PREVIEW_SIZE);
    state.imageId = `img${Date.now()}`;
    state.suggestions = [];
    state.selectedId = null;

    els.dropzone.hidden = true;
    els.originalView.hidden = false;
    els.originalView.replaceChildren(state.preview);
    els.originalMeta.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
    els.input.disabled = false;
    els.input.placeholder = "Was soll ich ändern? z. B. „Gefällt mir, aber schneid den Mann im Hintergrund raus und mach es wärmer“";
    els.quick.hidden = false;

    prefs.countImage();
    renderStats();
    await makeSuggestions();
  } catch (error) {
    toast(error.message, { error: true });
  } finally {
    setBusy(false);
  }
}

async function makeSuggestions() {
  showSkeletons();
  let list = null;
  let source = "lokal";
  if (state.claude) {
    els.suggestMeta.textContent = "Claude schaut sich dein Bild an …";
    try {
      const data = await postJson("/api/suggest", {
        image: canvasToDataUrl(state.preview),
        preferences: prefs.summary(),
      });
      if (Array.isArray(data.suggestions) && data.suggestions.length) {
        list = data.suggestions.slice(0, 5);
        source = "Claude";
      }
    } catch (error) {
      toast(`Claude nicht erreichbar (${error.message}) – ich nutze die lokalen Vorschläge.`, { error: true });
    }
  }
  if (!list) {
    list = pickFive(localSuggestions(analyze(state.preview)), prefs.styleScores());
  }

  const ranked = prefs.rank(
    list.map((s, i) => ({
      id: `${state.imageId}-${i}`,
      name: s.name,
      description: s.description,
      style: STYLE_LABELS[s.style] ? s.style : "natural",
      params: normalizeParams(s.params),
      removals: [],
      history: [],
      edited: false,
    })),
  );
  state.suggestions = ranked;
  state.selectedId = ranked[0].id;
  const favCount = ranked.filter((s) => s.favorite).length;
  els.suggestMeta.textContent = `5 Vorschläge · ${source}${favCount ? " · nach deinem Geschmack sortiert" : ""}`;
  renderGrid();
  updateTargetHint();

  // Nacheinander rendern, damit die Seite flüssig bleibt.
  for (const s of state.suggestions) {
    await nextFrame();
    renderCardImage(s);
  }
}

// ---------- Vorschlags-Karten ----------

function showSkeletons() {
  els.grid.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const card = document.createElement("div");
    card.className = `card${i === 0 ? " top" : ""}`;
    card.innerHTML = `<div class="thumb loading" style="aspect-ratio:${state.preview.width}/${state.preview.height}"></div>`;
    els.grid.append(card);
  }
}

function renderGrid() {
  els.grid.innerHTML = "";
  state.suggestions.forEach((s, i) => els.grid.append(buildCard(s, i)));
}

function buildCard(s, index) {
  const rating = prefs.getRating(s.id);
  const card = document.createElement("article");
  card.className = `card${index === 0 ? " top" : ""}${s.id === state.selectedId ? " selected" : ""}`;
  card.dataset.id = s.id;
  card.innerHTML = `
    <div class="thumb loading">
      <div class="badges"></div>
      <button class="zoom-btn" title="Groß ansehen & vergleichen">⤢</button>
    </div>
    <div class="card-body">
      <div><div class="card-title"></div><div class="card-desc"></div></div>
      <div class="card-actions">
        <button class="icon-btn heart" title="Gefällt mir"></button>
        <button class="icon-btn dl" title="Speichern">⬇</button>
      </div>
    </div>
    <div class="stars" role="group" aria-label="Bewertung"></div>`;

  card.querySelector(".card-title").textContent = s.name;
  card.querySelector(".card-desc").textContent = s.description;
  const badges = card.querySelector(".badges");
  if (s.favorite) badges.insertAdjacentHTML("beforeend", '<span class="badge fav">★ Dein Stil</span>');
  badges.insertAdjacentHTML("beforeend", `<span class="badge"></span>`);
  badges.lastElementChild.textContent = STYLE_LABELS[s.style];
  if (s.edited) badges.insertAdjacentHTML("beforeend", '<span class="badge edited">bearbeitet</span>');

  const heart = card.querySelector(".heart");
  heart.textContent = rating.liked ? "♥" : "♡";
  heart.classList.toggle("liked", rating.liked);
  heart.addEventListener("click", (e) => {
    e.stopPropagation();
    const now = !prefs.getRating(s.id).liked;
    prefs.rate(s.id, s, { liked: now });
    heart.textContent = now ? "♥" : "♡";
    heart.classList.toggle("liked", now);
    renderStats();
    if (now) toast(`Gemerkt: Du magst „${STYLE_LABELS[s.style]}“. Beim nächsten Bild kommt der Stil nach oben.`);
  });

  const stars = card.querySelector(".stars");
  for (let n = 1; n <= 5; n++) {
    const star = document.createElement("button");
    star.className = `star${n <= rating.stars ? " on" : ""}`;
    star.textContent = "★";
    star.title = `${n} von 5 Sternen`;
    star.addEventListener("click", (e) => {
      e.stopPropagation();
      const current = prefs.getRating(s.id).stars;
      const value = current === n ? 0 : n;
      prefs.rate(s.id, s, { stars: value });
      [...stars.children].forEach((el, i) => el.classList.toggle("on", i < value));
      renderStats();
    });
    stars.append(star);
  }

  card.querySelector(".dl").addEventListener("click", (e) => {
    e.stopPropagation();
    download(s);
  });
  card.querySelector(".zoom-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    openViewer(s);
  });
  card.addEventListener("click", () => select(s.id));
  card.addEventListener("dblclick", () => openViewer(s));

  if (s.canvas) placeCanvas(card, s.canvas);
  return card;
}

function placeCanvas(card, canvas) {
  const thumb = card.querySelector(".thumb");
  thumb.classList.remove("loading");
  thumb.querySelector("canvas")?.remove();
  thumb.prepend(canvas);
}

function renderCardImage(s) {
  s.canvas = renderImage(state.preview, s.params, s.removals);
  const card = els.grid.querySelector(`[data-id="${s.id}"]`);
  if (card) placeCanvas(card, s.canvas);
}

function refreshCard(s) {
  const old = els.grid.querySelector(`[data-id="${s.id}"]`);
  const index = state.suggestions.indexOf(s);
  if (old) old.replaceWith(buildCard(s, index));
}

function select(id) {
  state.selectedId = id;
  for (const card of els.grid.querySelectorAll(".card")) {
    card.classList.toggle("selected", card.dataset.id === id);
  }
  updateTargetHint();
}

function updateTargetHint() {
  const s = selected();
  if (!s) return;
  els.targetHint.innerHTML = "Deine Wünsche oben gelten für: <b></b> · Klick auf einen anderen Vorschlag, um ihn zu bearbeiten.";
  els.targetHint.querySelector("b").textContent = s.name;
  els.undoBtn.disabled = !s.history.length || state.busy;
}

function setBusy(busy) {
  state.busy = busy;
  els.promptBtn.disabled = busy || !state.preview;
  els.promptBtn.classList.toggle("busy", busy && !!state.preview);
  els.newBtn.disabled = busy;
  const s = selected();
  els.undoBtn.disabled = busy || !s || !s.history.length;
}

// ---------- Wünsche aus der Textzeile ----------

async function applyInstruction(text) {
  const s = selected();
  if (!s || !text.trim() || state.busy) return;
  setBusy(true);
  try {
    let result = null;
    if (state.claude) {
      try {
        const data = await postJson("/api/edit", {
          image: canvasToDataUrl(state.preview),
          params: s.params,
          removals: s.removals,
          instruction: text,
        });
        result = {
          params: normalizeParams(data.params),
          removals: (data.removals || []).map((b) => normalizeBox(b)),
          message: data.message || "Erledigt.",
        };
      } catch (error) {
        toast(`Claude nicht erreichbar (${error.message}) – ich versuche es lokal.`, { error: true });
      }
    }

    if (!result) {
      const local = parseInstruction(text, s.params);
      if (local.wantsRemoval) {
        if (local.understood) commit(s, local.params, [], text);
        toast("Zum Entfernen: Zieh in der Großansicht einen Rahmen um das Objekt.", { ms: 6000 });
        openViewer(selected(), { removeMode: true });
        return;
      }
      if (!local.understood) {
        toast("Das habe ich nicht verstanden. Probier z. B. „heller“, „schärfer“, „wärmer“, „schwarz-weiß“, „zoom rein“ oder „kräftigere Farben“.", { error: true, ms: 7000 });
        return;
      }
      result = { params: local.params, removals: [], message: local.message };
    }

    commit(s, result.params, result.removals, text);
    toast(result.message);
    els.input.value = "";
  } finally {
    setBusy(false);
    updateTargetHint();
  }
}

function commit(s, params, newRemovals, label) {
  s.history.push({ params: s.params, removals: s.removals, name: s.name, edited: s.edited });
  s.params = params;
  s.removals = [...s.removals, ...newRemovals];
  s.edited = true;
  if (label) s.description = `Dein Wunsch: „${label}“`;
  renderCardImage(s);
  refreshCard(s);
  // Bewertungen sollen den aktuellen Stand lernen.
  const r = prefs.getRating(s.id);
  if (r.liked || r.stars) prefs.rate(s.id, s, {});
  updateTargetHint();
}

function undo() {
  const s = selected();
  const prev = s?.history.pop();
  if (!prev) return;
  Object.assign(s, prev);
  renderCardImage(s);
  refreshCard(s);
  updateTargetHint();
  toast("Rückgängig gemacht.");
}

// ---------- Großansicht ----------

let viewerItem = null;

function openViewer(s, { removeMode = false } = {}) {
  viewerItem = s;
  select(s.id);
  els.viewerTitle.textContent = s.name;
  const after = s.canvas || renderImage(state.preview, s.params, s.removals);
  const before = renderImage(state.preview, { ...DEFAULT_PARAMS, crop: s.params.crop }, []);
  els.compareAfter.replaceChildren(after);
  els.compareBefore.replaceChildren(before);
  setCompare(50);
  setRemoveMode(removeMode);
  if (!els.viewer.open) els.viewer.showModal();
}

function setCompare(percent) {
  els.compareBefore.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
  els.compareHandle.style.left = `${percent}%`;
}

function setRemoveMode(on) {
  els.removeTool.setAttribute("aria-pressed", String(on));
  els.compare.classList.toggle("removing", on);
  els.viewerHint.textContent = on
    ? "Zieh einen Rahmen um das Objekt, das weg soll. Klappt am besten bei ruhigem Hintergrund."
    : "Ziehe den Regler, um Vorher und Nachher zu vergleichen.";
}

function relPos(e) {
  const rect = els.compare.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  };
}

let drag = null;
els.compare.addEventListener("pointerdown", (e) => {
  els.compare.setPointerCapture(e.pointerId);
  const p = relPos(e);
  if (els.compare.classList.contains("removing")) {
    drag = { mode: "select", start: p };
    Object.assign(els.selection.style, { left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: "0", height: "0" });
    els.selection.hidden = false;
  } else {
    drag = { mode: "compare" };
    setCompare(p.x * 100);
  }
});
els.compare.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = relPos(e);
  if (drag.mode === "compare") return setCompare(p.x * 100);
  const x = Math.min(p.x, drag.start.x), y = Math.min(p.y, drag.start.y);
  Object.assign(els.selection.style, {
    left: `${x * 100}%`, top: `${y * 100}%`,
    width: `${Math.abs(p.x - drag.start.x) * 100}%`, height: `${Math.abs(p.y - drag.start.y) * 100}%`,
  });
  drag.box = { x, y, w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) };
});
els.compare.addEventListener("pointerup", () => {
  const d = drag;
  drag = null;
  if (!d || d.mode !== "select") return;
  els.selection.hidden = true;
  if (!d.box || d.box.w < 0.01 || d.box.h < 0.01 || !viewerItem) return;
  // Auswahl gilt im (zugeschnittenen) Bild → in Original-Koordinaten umrechnen.
  const c = viewerItem.params.crop;
  const box = { x: c.x + d.box.x * c.w, y: c.y + d.box.y * c.h, w: d.box.w * c.w, h: d.box.h * c.h };
  commit(viewerItem, viewerItem.params, [normalizeBox(box, 0.005)], null);
  openViewer(viewerItem, { removeMode: true });
  toast("Entfernt. Noch etwas? Einfach weiter Rahmen ziehen – oder ↶ zum Rückgängigmachen.");
});

els.removeTool.addEventListener("click", () => setRemoveMode(els.removeTool.getAttribute("aria-pressed") !== "true"));
els.viewerClose.addEventListener("click", () => els.viewer.close());
els.viewerDownload.addEventListener("click", () => viewerItem && download(viewerItem));
els.viewer.addEventListener("click", (e) => { if (e.target === els.viewer) els.viewer.close(); });

// ---------- Speichern in voller Auflösung ----------

async function download(s) {
  toast("Bild wird in voller Größe berechnet …", { ms: 2000 });
  await nextFrame();
  const full = scaledCanvas(state.original, EXPORT_SIZE);
  const out = renderImage(full, s.params, s.removals);
  out.toBlob((blob) => {
    const a = document.createElement("a");
    const baseName = (state.file?.name || "bild").replace(/\.[^.]+$/, "");
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}-${s.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-")}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/jpeg", 0.92);
}

// ---------- Ereignisse ----------

els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files[0];
  els.fileInput.value = ""; // damit dieselbe Datei erneut gewählt werden kann
  handleFile(file);
});
els.newBtn.addEventListener("click", () => els.fileInput.click());
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  applyInstruction(els.input.value);
});
els.undoBtn.addEventListener("click", undo);
els.quick.addEventListener("click", (e) => {
  const q = e.target.closest("button")?.dataset.q;
  if (q) applyInstruction(q);
});
$("#reset-prefs").addEventListener("click", () => {
  if (!confirm("Alle gelernten Vorlieben löschen?")) return;
  prefs.reset();
  renderStats();
  if (state.suggestions.length) renderGrid();
  toast("Vorlieben zurückgesetzt.");
});

for (const type of ["dragenter", "dragover"]) {
  document.addEventListener(type, (e) => {
    e.preventDefault();
    els.dropzone.classList.add("drag");
  });
}
for (const type of ["dragleave", "drop"]) {
  document.addEventListener(type, () => els.dropzone.classList.remove("drag"));
}
document.addEventListener("drop", (e) => {
  e.preventDefault();
  handleFile(e.dataTransfer?.files?.[0]);
});
document.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
  if (item) handleFile(item.getAsFile());
});

// ---------- Start ----------

(async function init() {
  renderStats();
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    state.claude = Boolean(data.claude);
  } catch {
    state.claude = false;
  }
  els.modeChip.textContent = state.claude ? "● Claude aktiv" : "● Lokaler Modus";
  els.modeChip.classList.toggle("on", state.claude);
  els.modeChip.title = state.claude
    ? "Claude analysiert deine Bilder und versteht freie Wünsche."
    : "Ohne API-Schlüssel: Vorschläge und Wünsche werden lokal berechnet.";
})();
