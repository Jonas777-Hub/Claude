// Lokale Vorschläge und Texteingabe – funktionieren auch ohne Claude.

import { DEFAULT_PARAMS, FULL_CROP, normalizeParams } from "./editor.js";

export const STYLE_LABELS = {
  natural: "Natürlich",
  crisp: "Scharf",
  bw: "Schwarz-Weiß",
  warm: "Warm",
  cool: "Kühl",
  vivid: "Lebendig",
  moody: "Moody",
  bright: "Hell & luftig",
  vintage: "Vintage",
  cinematic: "Kino-Look",
};

const round = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

/** Grundkorrektur passend zum Bild: Belichtung, Kontrast, Farbstich. */
function baseCorrection(s) {
  const exposure = round(Math.max(-0.8, Math.min(1.2, Math.log2(0.48 / Math.max(0.05, s.brightness)) * 0.6)), 2);
  const contrast = round(Math.max(-20, Math.min(30, (0.22 - s.contrast) * 120)));
  const temperature = round(Math.max(-25, Math.min(25, -s.warmth * 120)));
  const tint = round(Math.max(-20, Math.min(20, s.greenMagenta * 150)));
  const highlights = s.clippedHighlights > 0.02 ? -35 : -10;
  const shadows = s.clippedShadows > 0.05 ? 35 : 10;
  return { exposure, contrast, temperature, tint, highlights, shadows };
}

export function localSuggestions(stats) {
  const base = baseCorrection(stats);
  const p = (extra) => normalizeParams({ ...DEFAULT_PARAMS, ...base, ...extra, crop: FULL_CROP });
  const lowSat = stats.saturation < 0.18;

  return [
    {
      name: "Natürlich optimiert",
      description: "Belichtung und Farbstich ausgeglichen, Schatten leicht aufgehellt.",
      style: "natural",
      params: p({ vibrance: lowSat ? 20 : 8, sharpen: 15, clarity: 8 }),
    },
    {
      name: "Knackig scharf",
      description: "Deutlich mehr Schärfe und Klarheit, etwas mehr Kontrast.",
      style: "crisp",
      params: p({ sharpen: 70, clarity: 40, contrast: base.contrast + 10, vibrance: 10 }),
    },
    {
      name: "Schwarz-Weiß",
      description: "Klassisches Schwarz-Weiß mit kräftigem Kontrast.",
      style: "bw",
      params: p({ grayscale: 100, contrast: base.contrast + 22, clarity: 20, sharpen: 25, vignette: 20, temperature: 0, tint: 0 }),
    },
    {
      name: "Goldene Stunde",
      description: "Wärmere Farben und ein sanftes, sonniges Licht.",
      style: "warm",
      params: p({ temperature: base.temperature + 30, vibrance: 18, exposure: base.exposure + 0.1, highlights: -20, vignette: 12 }),
    },
    {
      name: "Kühl & klar",
      description: "Kühlere Farbtemperatur, frischer und klarer Look.",
      style: "cool",
      params: p({ temperature: base.temperature - 28, contrast: base.contrast + 8, clarity: 20, sharpen: 20 }),
    },
    {
      name: "Lebendige Farben",
      description: "Mehr Farbkraft, ohne Hauttöne zu übertreiben.",
      style: "vivid",
      params: p({ vibrance: 45, saturation: 12, contrast: base.contrast + 8, sharpen: 15 }),
    },
    {
      name: "Moody",
      description: "Dunkler, satte Schatten und gedämpfte Farben.",
      style: "moody",
      params: p({ exposure: base.exposure - 0.3, contrast: base.contrast + 15, saturation: -20, shadows: -10, vignette: 35, fade: 10 }),
    },
    {
      name: "Hell & luftig",
      description: "Heller, weicher Kontrast, zarte Farben.",
      style: "bright",
      params: p({ exposure: base.exposure + 0.45, contrast: base.contrast - 15, shadows: 40, saturation: -10, vibrance: 10 }),
    },
    {
      name: "Vintage",
      description: "Leichter Sepia-Ton, matte Schwarztöne und Vignette.",
      style: "vintage",
      params: p({ sepia: 35, fade: 35, contrast: base.contrast - 5, saturation: -15, vignette: 30 }),
    },
    {
      name: "Kino-Look",
      description: "Mehr Kontrast, warme Lichter und kühle Schatten wie im Film.",
      style: "cinematic",
      params: p({ contrast: base.contrast + 18, temperature: base.temperature + 10, tint: -8, saturation: -10, fade: 12, vignette: 25, clarity: 15 }),
    },
  ];
}

/**
 * Wählt 5 Vorschläge: Natürlich, Scharf und Schwarz-Weiß sind immer dabei,
 * dazu die Stile, die dem Nutzer am besten gefallen.
 */
export function pickFive(pool, styleScores) {
  const mandatory = ["natural", "crisp", "bw"];
  const byScore = (a, b) => (styleScores[b.style] || 0) - (styleScores[a.style] || 0);
  const rest = pool.filter((s) => !mandatory.includes(s.style)).sort(byScore);
  const defaults = ["vivid", "warm"];
  const hasPrefs = rest.some((s) => (styleScores[s.style] || 0) > 0);
  const extra = hasPrefs
    ? rest.slice(0, 2)
    : defaults.map((st) => rest.find((s) => s.style === st));
  return [...pool.filter((s) => mandatory.includes(s.style)), ...extra];
}

// ---------- Texteingabe ohne Claude ----------

const RULES = [
  { re: /(heller|aufhellen|mehr licht|zu dunkel|brighter)/, apply: (p, k) => (p.exposure += 0.35 * k), msg: "heller" },
  { re: /(dunkler|abdunkeln|zu hell|darker)/, apply: (p, k) => (p.exposure -= 0.35 * k), msg: "dunkler" },
  { re: /(mehr kontrast|kontrastreicher|kräftiger)/, apply: (p, k) => (p.contrast += 18 * k), msg: "mehr Kontrast" },
  { re: /(weniger kontrast|weicher|flacher)/, apply: (p, k) => (p.contrast -= 18 * k), msg: "weniger Kontrast" },
  { re: /((?<!un)(?<!weniger )schärfer|(?<!weniger )schärfen|(?<!un)(?<!weniger )scharf|sharper|sharpen)/, apply: (p, k) => { p.sharpen += 30 * k; p.clarity += 15 * k; }, msg: "schärfer" },
  { re: /(unscharf|weichzeichnen|weniger scharf)/, apply: (p, k) => { p.sharpen = Math.max(0, p.sharpen - 40 * k); p.clarity = Math.max(0, p.clarity - 20 * k); }, msg: "weniger scharf" },
  { re: /(wärmer|warm|goldener|sonniger)/, apply: (p, k) => (p.temperature += 22 * k), msg: "wärmer" },
  { re: /(kälter|kühler|kühl|kalt|bläulich)/, apply: (p, k) => (p.temperature -= 22 * k), msg: "kühler" },
  { re: /(schwarz.?weiß|schwarzweiss|schwarz weiss|s\/w|graustufen|black.?and.?white)/, apply: (p) => (p.grayscale = 100), msg: "Schwarz-Weiß" },
  { re: /(wieder farbig|in farbe|farbe zurück|kein schwarz)/, apply: (p) => { p.grayscale = 0; p.sepia = 0; }, msg: "wieder in Farbe" },
  { re: /(bunter|farbiger|mehr farbe|kräftigere farben|satter)/, apply: (p, k) => { p.vibrance += 20 * k; p.saturation += 8 * k; }, msg: "kräftigere Farben" },
  { re: /(blasser|weniger farbe|entsättigen|gedämpft)/, apply: (p, k) => (p.saturation -= 20 * k), msg: "gedämpftere Farben" },
  { re: /(andere farben|farben ändern|anders färben)/, apply: (p, k) => { p.temperature = -p.temperature + (p.temperature >= 0 ? -20 : 20) * k; p.tint += 10 * k; }, msg: "andere Farbstimmung" },
  { re: /(vintage|retro|alt aussehen|analog)/, apply: (p, k) => { p.sepia += 30 * k; p.fade += 25 * k; p.vignette += 20 * k; }, msg: "Vintage-Look" },
  { re: /(sepia)/, apply: (p, k) => (p.sepia += 40 * k), msg: "Sepia" },
  { re: /(vignette|ränder dunkler)/, apply: (p, k) => (p.vignette += 30 * k), msg: "Vignette" },
  { re: /(schatten aufhellen|tiefen aufhellen)/, apply: (p, k) => (p.shadows += 30 * k), msg: "Schatten aufgehellt" },
  { re: /(himmel|lichter retten|überbelichtet)/, apply: (p, k) => (p.highlights -= 30 * k), msg: "Lichter zurückgeholt" },
  { re: /(matt|fade|verblasst)/, apply: (p, k) => (p.fade += 25 * k), msg: "matter Look" },
];

function zoomCrop(crop, factor, dir) {
  const w = Math.max(0.15, crop.w * factor);
  const h = Math.max(0.15, crop.h * factor);
  let cx = crop.x + crop.w / 2;
  let cy = crop.y + crop.h / 2;
  if (dir.includes("links")) cx = crop.x + w / 2;
  if (dir.includes("rechts")) cx = crop.x + crop.w - w / 2;
  if (dir.includes("oben")) cy = crop.y + h / 2;
  if (dir.includes("unten")) cy = crop.y + crop.h - h / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Übersetzt einen Wunsch in Parameter (einfache Schlüsselwörter).
 * @returns {{params, message, understood: boolean, wantsRemoval: boolean}}
 */
export function parseInstruction(text, current) {
  const t = text.toLowerCase();
  const p = { ...current, crop: { ...current.crop } };
  const done = [];
  const k = /(viel|deutlich|stark|sehr)/.test(t) ? 1.8 : /(bisschen|etwas|leicht|wenig)/.test(t) ? 0.5 : 1;

  for (const rule of RULES) {
    if (rule.re.test(t)) {
      rule.apply(p, k);
      done.push(rule.msg);
    }
  }

  const dirMatch = t.match(/(links|rechts|oben|unten|mitte)/g) || [];
  if (/(zoom|heran|näher|ranzoomen|reinzoomen|ausschnitt|vergrößer)/.test(t) && !/(raus ?zoomen|herauszoomen|weniger zoom)/.test(t)) {
    p.crop = zoomCrop(p.crop, k > 1 ? 0.65 : k < 1 ? 0.9 : 0.8, dirMatch.join(" "));
    done.push("herangezoomt");
  }
  if (/(raus ?zoomen|herauszoomen|weniger zoom|ganzes bild|ohne zuschnitt)/.test(t)) {
    p.crop = { ...FULL_CROP };
    done.push("ganzes Bild");
  }

  const wantsRemoval = /(entfern|wegmach|weg mach|retusch|lösch|raus ?schneid|weg ?schneid|(schneid|nimm|mach|hol)\S*\s.*\b(raus|weg)\b)/.test(t);

  return {
    params: normalizeParams(p),
    message: done.length ? `Erledigt: ${done.join(", ")}.` : "",
    understood: done.length > 0,
    wantsRemoval,
  };
}
