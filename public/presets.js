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

/** Grundkorrektur passend zum Bild: Tonwerte spreizen, Belichtung, Farbstich. */
function baseCorrection(s) {
  // Schwarz- und Weißpunkt so setzen, dass das Bild den vollen Tonumfang nutzt.
  const blackPoint = round(Math.min(60, Math.max(0, (s.low - 0.01) / 0.4 * 100)));
  const whitePoint = round(Math.min(60, Math.max(0, (0.99 - s.high) / 0.4 * 100)));
  const stretched = (s.brightness - s.low) / Math.max(0.1, s.high - s.low);
  const exposure = round(Math.max(-1, Math.min(1.4, Math.log2(0.5 / Math.max(0.05, stretched)) * 0.8)), 2);
  const contrast = round(Math.max(-15, Math.min(35, (0.24 - s.contrast) * 140 + 8)));
  const temperature = round(Math.max(-35, Math.min(35, -s.warmth * 150)));
  const tint = round(Math.max(-25, Math.min(25, s.greenMagenta * 180)));
  return { blackPoint, whitePoint, exposure, contrast, temperature, tint, highlights: -30, shadows: 30 };
}

export function localSuggestions(stats) {
  const base = baseCorrection(stats);
  const p = (extra) => normalizeParams({ ...DEFAULT_PARAMS, ...base, ...extra, crop: FULL_CROP });
  const lowSat = stats.saturation < 0.18;
  const c = base.contrast;

  return [
    {
      name: "Natürlich optimiert",
      description: "Tonwerte gespreizt, Belichtung und Farbstich korrigiert, Dunst entfernt.",
      style: "natural",
      params: p({ vibrance: lowSat ? 35 : 20, dehaze: 15, clarity: 15, sharpen: 25 }),
    },
    {
      name: "Knackig scharf",
      description: "Viel Schärfe und Klarheit, mehr Kontrast und klare Konturen.",
      style: "crisp",
      params: p({ sharpen: 85, clarity: 60, dehaze: 25, contrast: c + 15, vibrance: 20, blacks: -15 }),
    },
    {
      name: "Schwarz-Weiß",
      description: "Kräftiges Schwarz-Weiß mit tiefen Schwarztönen und Vignette.",
      style: "bw",
      params: p({ grayscale: 100, contrast: c + 35, clarity: 35, sharpen: 30, blacks: -25, whites: 15, vignette: 30, temperature: 0, tint: 0 }),
    },
    {
      name: "Goldene Stunde",
      description: "Warmes, sonniges Licht, goldene Lichter und weiche Schatten.",
      style: "warm",
      params: p({
        temperature: base.temperature + 45, vibrance: 30, exposure: base.exposure + 0.15, highlights: -40,
        splitHighlightHue: 40, splitHighlightAmount: 45, splitShadowHue: 20, splitShadowAmount: 20, vignette: 20,
      }),
    },
    {
      name: "Kühl & klar",
      description: "Kühle Farben, frischer Look und klare Details.",
      style: "cool",
      params: p({
        temperature: base.temperature - 40, contrast: c + 12, clarity: 30, sharpen: 30, dehaze: 20,
        splitShadowHue: 210, splitShadowAmount: 35,
      }),
    },
    {
      name: "Lebendige Farben",
      description: "Deutlich mehr Farbkraft, blauerer Himmel und sattes Grün.",
      style: "vivid",
      params: p({
        vibrance: 60, saturation: 20, contrast: c + 12, dehaze: 20, sharpen: 25,
        hsl: { blue: { h: 0, s: 35, l: -15 }, aqua: { h: 0, s: 30, l: -10 }, green: { h: 0, s: 30, l: 0 }, orange: { h: 0, s: 10, l: 5 } },
      }),
    },
    {
      name: "Moody",
      description: "Dunkle, satte Stimmung mit gedämpften Farben und Vignette.",
      style: "moody",
      params: p({
        exposure: base.exposure - 0.45, contrast: c + 25, saturation: -30, shadows: -5, blacks: -20, vignette: 50,
        fade: 15, splitShadowHue: 200, splitShadowAmount: 40,
      }),
    },
    {
      name: "Hell & luftig",
      description: "Deutlich heller, weiche Kontraste und zarte Farben.",
      style: "bright",
      params: p({ exposure: base.exposure + 0.7, contrast: c - 25, shadows: 55, highlights: -20, saturation: -15, vibrance: 15, whites: 15 }),
    },
    {
      name: "Vintage",
      description: "Sepia-Ton, matte Schwarztöne, Körnung und Vignette.",
      style: "vintage",
      params: p({ sepia: 45, fade: 45, contrast: c - 10, saturation: -25, vignette: 40, grain: 35, splitHighlightHue: 45, splitHighlightAmount: 30 }),
    },
    {
      name: "Kino-Look",
      description: "Teal & Orange wie im Film: kühle Schatten, warme Lichter, viel Kontrast.",
      style: "cinematic",
      params: p({
        contrast: c + 28, saturation: -10, fade: 12, vignette: 35, clarity: 20,
        splitShadowHue: 190, splitShadowAmount: 60, splitHighlightHue: 32, splitHighlightAmount: 50,
      }),
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
  { re: /(hintergrund (unscharf|verschwommen|weich)|bokeh|freistellen)/, apply: (p, k) => { p.regions = [...(p.regions || []), { x: 0.25, y: 0.15, w: 0.5, h: 0.75, shape: "ellipse", feather: 60, invert: true, blur: Math.min(100, 60 * k) }]; }, msg: "Hintergrund weichgezeichnet" },
  { re: /(spiegeln|spiegel|horizontal drehen)/, apply: (p) => (p.flipH = !p.flipH), msg: "gespiegelt" },
  { re: /(gerade ?richten|nach rechts drehen|im uhrzeigersinn)/, apply: (p, k) => (p.rotate += 3 * k), msg: "gedreht" },
  { re: /(nach links drehen|gegen den uhrzeigersinn)/, apply: (p, k) => (p.rotate -= 3 * k), msg: "gedreht" },
  { re: /(körnung|körnig|grain|filmkorn)/, apply: (p, k) => (p.grain += 30 * k), msg: "Körnung" },
  { re: /(himmel blauer|blauer himmel|blauer)/, apply: (p, k) => { p.hsl = { ...p.hsl, blue: { h: 0, s: (p.hsl?.blue?.s || 0) + 30 * k, l: (p.hsl?.blue?.l || 0) - 10 * k } }; }, msg: "Blau kräftiger" },
  { re: /(grüner|sattes grün)/, apply: (p, k) => { p.hsl = { ...p.hsl, green: { h: 0, s: (p.hsl?.green?.s || 0) + 30 * k, l: 0 } }; }, msg: "Grün kräftiger" },
  { re: /(dunst|klarer|dehaze)/, apply: (p, k) => (p.dehaze += 25 * k), msg: "Dunst entfernt" },
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
  const p = structuredClone(current);
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
