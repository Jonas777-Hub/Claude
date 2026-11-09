// Merkt sich, welche Vorschläge dir gefallen, und sortiert danach.
// Gespeichert wird im Browser (localStorage) – nur auf deinem Gerät.

import { RANGES } from "./editor.js";

const KEY = "lichtwerk.prefs.v1";

function empty() {
  return { images: 0, ratings: {} };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    return { ...empty(), ...parsed, ratings: parsed.ratings || {} };
  } catch {
    return empty();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Speichern nicht möglich (z. B. privates Fenster) – App läuft trotzdem.
  }
}

/** Herz = +3, Sterne: 1★ = -2 … 5★ = +2 */
function scoreOf(r) {
  return (r.liked ? 3 : 0) + (r.stars ? r.stars - 3 : 0);
}

export function countImage() {
  state.images += 1;
  save();
}

export function getRating(id) {
  return state.ratings[id] || { liked: false, stars: 0 };
}

export function rate(id, suggestion, change) {
  const prev = state.ratings[id] || { liked: false, stars: 0 };
  const next = { ...prev, ...change, style: suggestion.style, params: suggestion.params, at: Date.now() };
  if (!next.liked && !next.stars) delete state.ratings[id];
  else state.ratings[id] = next;
  save();
}

export function styleScores() {
  const scores = {};
  for (const r of Object.values(state.ratings)) {
    scores[r.style] = (scores[r.style] || 0) + scoreOf(r);
  }
  return scores;
}

/** Gewichteter Durchschnitt der Parameter aller Bilder, die gefallen haben. */
export function averageLiked() {
  const liked = Object.values(state.ratings).filter((r) => scoreOf(r) > 0 && r.params);
  if (!liked.length) return null;
  const avg = {};
  let total = 0;
  for (const r of liked) {
    const w = scoreOf(r);
    total += w;
    for (const key of Object.keys(RANGES)) avg[key] = (avg[key] || 0) + (r.params[key] || 0) * w;
  }
  for (const key of Object.keys(avg)) avg[key] = Math.round((avg[key] / total) * 100) / 100;
  return avg;
}

function similarity(params, avg) {
  if (!avg) return 0;
  let dist = 0;
  const keys = Object.keys(RANGES);
  for (const key of keys) {
    const [lo, hi] = RANGES[key];
    dist += Math.abs((params[key] || 0) - avg[key]) / (hi - lo);
  }
  return 1 - Math.min(1, (dist / keys.length) * 4); // 1 = sehr ähnlich
}

/**
 * Sortiert Vorschläge nach deinem Geschmack und markiert die Favoriten.
 * Alle Vorschläge bleiben erhalten – deine Lieblingsstile kommen nach oben.
 */
export function rank(suggestions) {
  const scores = styleScores();
  const avg = averageLiked();
  const scored = suggestions.map((s, index) => ({
    ...s,
    score: (scores[s.style] || 0) + similarity(s.params, avg) * 2,
    index,
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const anyPrefs = Object.keys(state.ratings).length > 0;
  return scored.map((s, i) => ({
    ...s,
    favorite: anyPrefs && i < 2 && (scores[s.style] || 0) > 0,
  }));
}

/** Zusammenfassung für Claude und das Dashboard. */
export function summary() {
  const scores = styleScores();
  const topStyles = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([style, score]) => ({ style, score }));
  const ratings = Object.values(state.ratings);
  return {
    images: state.images,
    ratings: ratings.length,
    likes: ratings.filter((r) => r.liked).length,
    topStyles,
    allScores: scores,
    averageLiked: averageLiked(),
  };
}

export function reset() {
  state = empty();
  save();
}
