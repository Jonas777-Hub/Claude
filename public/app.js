import {
  DEFAULT_PARAMS, FULL_CROP, normalizeParams, normalizeBox, loadImageFromFile,
  scaledCanvas, renderImage, analyze,
} from "./editor.js";
import { connectAI, editPrompt, suggestPrompt } from "./ai.js";
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
  ai: null,      // Verbindung zu Claude (oder null = lokaler Modus)
  aiTask: null,  // AbortController der laufenden Claude-Anfrage
  downloads: null,
  server: false, // false = läuft ohne eigenen Server (z. B. als geteilter Link)
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

async function handleFile(file, { sample = false } = {}) {
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
    els.originalMeta.textContent = `${sample ? "Beispielbild · " : ""}${img.naturalWidth} × ${img.naturalHeight} px`;
    els.input.disabled = false;
    updateModeChip();
    els.quick.hidden = false;

    if (!sample) prefs.countImage();
    renderStats();
    setBusy(false);
    await makeSuggestions({ askClaude: !sample });
  } catch (error) {
    toast(error.message, { error: true });
  } finally {
    setBusy(false);
  }
}

function toSuggestions(list) {
  return prefs.rank(
    list.slice(0, 5).map((sug, i) => ({
      id: `${state.imageId}-${i}`,
      name: String(sug.name || `Vorschlag ${i + 1}`),
      description: String(sug.description || ""),
      style: STYLE_LABELS[sug.style] ? sug.style : "natural",
      params: normalizeParams(sug.params),
      removals: [],
      history: [],
      instructions: [],
      edited: false,
    })),
  );
}

async function showSuggestions(list, source) {
  state.suggestions = toSuggestions(list);
  state.selectedId = state.suggestions[0].id;
  const favCount = state.suggestions.filter((x) => x.favorite).length;
  els.suggestMeta.textContent = `5 Vorschläge · ${source}${favCount ? " · nach deinem Geschmack sortiert" : ""}`;
  renderGrid();
  updateTargetHint();
  // Nacheinander rendern, damit die Seite flüssig bleibt.
  for (const sug of state.suggestions) {
    await nextFrame();
    renderCardImage(sug);
  }
}

async function makeSuggestions({ askClaude }) {
  showSkeletons();
  const imageId = state.imageId;
  await showSuggestions(pickFive(localSuggestions(analyze(state.preview)), prefs.styleScores()), "sofort berechnet");
  if (!askClaude || !state.ai) return;

  // Claude schaut sich das Bild an und macht eigene Vorschläge.
  els.suggestMeta.textContent = "Claude schaut sich dein Bild an … (dauert meist 20–60 s)";
  els.suggestMeta.classList.add("working");
  try {
    const data = await state.ai.ask(suggestPrompt(prefs.summary()), [state.preview]);
    if (state.imageId !== imageId) return; // inzwischen anderes Bild
    const list = Array.isArray(data?.suggestions) ? data.suggestions.filter((x) => x && x.params) : [];
    if (list.length < 3) throw new Error("Claude hat keine brauchbaren Vorschläge geliefert.");
    if (state.suggestions.some((x) => x.edited)) {
      toast("Claude hat neue Vorschläge – du bearbeitest aber schon. Ich lasse deine Bearbeitung stehen.");
      els.suggestMeta.textContent = "5 Vorschläge · sofort berechnet";
      return;
    }
    await showSuggestions(list, "von Claude");
    toast("Claude hat sich dein Bild angesehen und 5 eigene Vorschläge gemacht.");
  } catch (error) {
    if (state.imageId !== imageId) return;
    handleAIError(error);
    els.suggestMeta.textContent = "5 Vorschläge · sofort berechnet";
  } finally {
    els.suggestMeta.classList.remove("working");
  }
}

function handleAIError(error) {
  if (error?.permanent) {
    state.ai = null;
    updateModeChip();
    toast(`${error.message} Ich arbeite ab jetzt lokal weiter.`, { error: true, ms: 7000 });
  } else if (error?.message !== "Abgebrochen.") {
    toast(error?.message || "Claude ist gerade nicht erreichbar.", { error: true, ms: 6000 });
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

function setBusy(busy, { claude = false } = {}) {
  state.busy = busy;
  // Während Claude arbeitet, wird der Knopf zum Stopp-Knopf.
  els.promptBtn.disabled = !state.preview || (busy && !claude);
  els.promptBtn.textContent = busy && claude ? "Stopp" : "Anwenden";
  els.promptBtn.classList.toggle("stop", busy && claude);
  els.input.disabled = !state.preview || busy;
  els.newBtn.disabled = busy;
  const s = selected();
  els.undoBtn.disabled = busy || !s || !s.history.length;
}

// ---------- Wünsche aus der Textzeile ----------

async function applyInstruction(text) {
  const s = selected();
  if (!s || !text.trim() || state.busy) return;
  let result = null;

  if (state.ai) {
    const ctl = new AbortController();
    state.aiTask = ctl;
    setBusy(true, { claude: true });
    els.targetHint.textContent = `Claude bearbeitet „${s.name}“: ${text}`;
    els.targetHint.classList.add("working");
    try {
      const current = s.canvas || renderImage(state.preview, s.params, s.removals);
      const data = await state.ai.ask(
        editPrompt({ params: s.params, removals: s.removals, instruction: text, history: s.instructions }),
        [state.preview, current],
        ctl.signal,
      );
      if (!data || typeof data.params !== "object") throw new Error("Claude hat keine Parameter geliefert. Bitte noch einmal versuchen.");
      result = {
        params: normalizeParams(data.params),
        removals: (Array.isArray(data.removals) ? data.removals : []).map((b) => normalizeBox(b, 0.005)),
        message: String(data.message || "Erledigt."),
      };
    } catch (error) {
      if (ctl.signal.aborted) {
        toast("Abgebrochen.");
      } else {
        handleAIError(error);
      }
      if (state.ai || ctl.signal.aborted) return; // Wunsch bleibt im Feld stehen
    } finally {
      state.aiTask = null;
      els.targetHint.classList.remove("working");
      setBusy(false);
      updateTargetHint();
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
      toast("Das habe ich nicht verstanden. Ohne Claude verstehe ich Stichwörter wie „heller“, „schärfer“, „wärmer“, „schwarz-weiß“, „zoom rein“, „Hintergrund unscharf“ oder „kräftigere Farben“.", { error: true, ms: 8000 });
      return;
    }
    result = { params: local.params, removals: [], message: local.message };
  }

  commit(s, result.params, result.removals, text);
  toast(result.message, { ms: 7000 });
  els.input.value = "";
}

function commit(s, params, newRemovals, label) {
  s.history.push({
    params: s.params, removals: s.removals, name: s.name, edited: s.edited,
    description: s.description, instructions: s.instructions,
  });
  if (label) s.instructions = [...s.instructions, label];
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
  const before = renderImage(state.preview, { ...DEFAULT_PARAMS, crop: s.params.crop, rotate: s.params.rotate, flipH: s.params.flipH, flipV: s.params.flipV }, []);
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
  const blob = await new Promise((resolve) => out.toBlob(resolve, "image/jpeg", 0.92));
  const baseName = (state.file?.name || "bild").replace(/\.[^.]+$/, "");
  const filename = `${baseName}-${s.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-")}.jpg`;
  if (state.downloads) {
    try {
      await state.downloads.save({ filename, data: blob });
      toast("Gespeichert.");
    } catch (e) {
      if (e?.code === "declined") return;
      showSaveDialog(blob, s.name);
    }
    return;
  }
  if (!state.server) return showSaveDialog(blob, s.name);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function showSaveDialog(blob, name) {
  const dlg = $("#save-dialog");
  const img = dlg.querySelector("img");
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(blob);
  img.alt = name;
  dlg.querySelector("#save-title").textContent = name;
  if (!dlg.open) dlg.showModal();
}
$("#save-close").addEventListener("click", () => $("#save-dialog").close());

/** Malt ein Beispielfoto, damit die App sofort zeigt, was sie kann. */
function sampleFile() {
  const c = document.createElement("canvas");
  c.width = 1200; c.height = 800;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 520);
  sky.addColorStop(0, "#5a6f8c"); sky.addColorStop(1, "#c9a67d");
  g.fillStyle = sky; g.fillRect(0, 0, 1200, 800);
  g.fillStyle = "#e8c27a"; g.beginPath(); g.arc(880, 330, 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#4a5568";
  g.beginPath(); g.moveTo(0, 520); g.lineTo(260, 300); g.lineTo(470, 470); g.lineTo(720, 260); g.lineTo(1200, 520); g.lineTo(1200, 800); g.lineTo(0, 800); g.fill();
  const lake = g.createLinearGradient(0, 520, 0, 800);
  lake.addColorStop(0, "#7d8aa0"); lake.addColorStop(1, "#3a4658");
  g.fillStyle = lake; g.fillRect(0, 540, 1200, 260);
  g.fillStyle = "#2f3d2c";
  g.beginPath(); g.moveTo(0, 560); g.quadraticCurveTo(300, 500, 560, 580); g.lineTo(560, 800); g.lineTo(0, 800); g.fill();
  g.fillStyle = "#1f1a18"; g.fillRect(760, 560, 22, 120);
  g.fillStyle = "#b08a74"; g.beginPath(); g.arc(771, 548, 14, 0, Math.PI * 2); g.fill();
  // leicht flau und dunkel, damit die Vorschläge etwas zu tun haben
  g.globalCompositeOperation = "multiply"; g.fillStyle = "#b8b4b0"; g.fillRect(0, 0, 1200, 800);
  return new Promise((resolve) => c.toBlob((b) => resolve(new File([b], "beispiel.jpg", { type: "image/jpeg" })), "image/jpeg", 0.9));
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
  if (state.aiTask) return state.aiTask.abort();
  applyInstruction(els.input.value);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.aiTask) state.aiTask.abort();
});
els.undoBtn.addEventListener("click", undo);
els.quick.addEventListener("click", (e) => {
  const q = e.target.closest("button")?.dataset.q;
  if (q) applyInstruction(q);
});
let resetArmed = null;
$("#reset-prefs").addEventListener("click", (e) => {
  const btn = e.currentTarget;
  if (!resetArmed) {
    btn.textContent = "wirklich löschen?";
    resetArmed = setTimeout(() => { btn.textContent = "zurücksetzen"; resetArmed = null; }, 4000);
    return;
  }
  clearTimeout(resetArmed);
  resetArmed = null;
  btn.textContent = "zurücksetzen";
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

function updateModeChip(text) {
  const on = Boolean(state.ai);
  els.modeChip.textContent = text || (on ? "● Claude aktiv" : "● Lokaler Modus");
  els.modeChip.classList.toggle("on", on);
  els.modeChip.title = on
    ? "Claude schaut sich deine Bilder an und setzt deine Wünsche aus der Textzeile um."
    : "Ohne Claude: Vorschläge und Stichwörter werden lokal berechnet.";
  els.input.placeholder = !state.preview
    ? "Lade zuerst ein Bild hoch …"
    : on
      ? "Schreib genau, was ich machen soll – z. B. „Himmel dramatischer, Gesicht heller, Hintergrund unscharf und den Mann links rausschneiden“"
      : "Was soll ich ändern? z. B. „viel heller, wärmer und zoom rein“";
}

(async function init() {
  renderStats();
  updateModeChip("● Verbinde …");
  let server = null;
  try {
    const res = await fetch("api/status");
    server = await res.json();
    state.server = true;
  } catch {
    state.server = false;
  }
  // Beispielbild sofort zeigen, Claude im Hintergrund verbinden.
  const ready = handleFile(await sampleFile(), { sample: true });
  const [ai, downloads] = await Promise.all([
    connectAI({ server }),
    typeof window.claude?.use === "function" ? window.claude.use("downloads").catch(() => null) : null,
  ]);
  state.ai = ai;
  state.downloads = downloads;
  await ready;
  updateModeChip();
})();
