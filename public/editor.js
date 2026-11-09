// Bild-Engine: wendet Bearbeitungs-Parameter auf ein Canvas an.
// Alles läuft lokal im Browser, das Bild verlässt den Rechner dafür nicht.

export const FULL_CROP = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

export const DEFAULT_PARAMS = Object.freeze({
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  grayscale: 0,
  sepia: 0,
  fade: 0,
  sharpen: 0,
  clarity: 0,
  vignette: 0,
  crop: FULL_CROP,
});

export const RANGES = {
  exposure: [-2, 2],
  contrast: [-100, 100],
  highlights: [-100, 100],
  shadows: [-100, 100],
  saturation: [-100, 100],
  vibrance: [-100, 100],
  temperature: [-100, 100],
  tint: [-100, 100],
  grayscale: [0, 100],
  sepia: [0, 100],
  fade: [0, 100],
  sharpen: [0, 100],
  clarity: [0, 100],
  vignette: [0, 100],
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function normalizeBox(box, minSize = 0.02) {
  if (!box) return { ...FULL_CROP };
  let w = clamp(Number(box.w) || 0, minSize, 1);
  let h = clamp(Number(box.h) || 0, minSize, 1);
  const x = clamp(Number(box.x) || 0, 0, 1 - w);
  const y = clamp(Number(box.y) || 0, 0, 1 - h);
  return { x, y, w, h };
}

export function normalizeParams(params = {}) {
  const out = {};
  for (const [key, [lo, hi]] of Object.entries(RANGES)) {
    const v = Number(params[key]);
    out[key] = Number.isFinite(v) ? clamp(v, lo, hi) : DEFAULT_PARAMS[key];
  }
  out.crop = normalizeBox(params.crop || FULL_CROP, 0.1);
  return out;
}

export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Das Bild konnte nicht gelesen werden."));
    };
    img.src = url;
  });
}

/** Zeichnet ein Bild verkleinert (längste Kante maxSize) auf ein neues Canvas. */
export function scaledCanvas(source, maxSize) {
  const sw = source.naturalWidth || source.width;
  const sh = source.naturalHeight || source.height;
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToDataUrl(canvas, maxSize = 1024, quality = 0.85) {
  return scaledCanvas(canvas, maxSize).toDataURL("image/jpeg", quality);
}

// ---------- Farb-Lookup-Tabellen ----------

const toLinear = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  toLinear[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const GAMMA_STEPS = 4096;
const toGamma = new Float32Array(GAMMA_STEPS + 1);
for (let i = 0; i <= GAMMA_STEPS; i++) {
  const c = i / GAMMA_STEPS;
  toGamma[i] = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
const gamma = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : toGamma[(v * GAMMA_STEPS) | 0]);

// ---------- Objekte entfernen (Auffüllen aus der Umgebung) ----------

function inpaint(imageData, boxNorm) {
  const { width: W, height: H, data } = imageData;
  const pad = 0.08;
  const bx = boxNorm.x - boxNorm.w * pad;
  const by = boxNorm.y - boxNorm.h * pad;
  const x0 = clamp(Math.floor(bx * W), 0, W - 1);
  const y0 = clamp(Math.floor(by * H), 0, H - 1);
  const x1 = clamp(Math.ceil((boxNorm.x + boxNorm.w * (1 + pad)) * W), x0 + 1, W);
  const y1 = clamp(Math.ceil((boxNorm.y + boxNorm.h * (1 + pad)) * H), y0 + 1, H);
  const bw = x1 - x0;
  const bh = y1 - y0;

  // Arbeitsfenster mit Rand, damit genug Umgebung zum Auffüllen da ist.
  const m = 3;
  const wx0 = Math.max(0, x0 - m), wy0 = Math.max(0, y0 - m);
  const wx1 = Math.min(W, x1 + m), wy1 = Math.min(H, y1 + m);
  const ww = wx1 - wx0, wh = wy1 - wy0;
  const known = new Uint8Array(ww * wh);
  const buf = new Float32Array(ww * wh * 3);
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const gx = x + wx0, gy = y + wy0;
      const i = (gy * W + gx) * 4;
      const j = y * ww + x;
      buf[j * 3] = data[i];
      buf[j * 3 + 1] = data[i + 1];
      buf[j * 3 + 2] = data[i + 2];
      known[j] = gx >= x0 && gx < x1 && gy >= y0 && gy < y1 ? 0 : 1;
    }
  }
  const inMask = Uint8Array.from(known, (k) => 1 - k);

  // Von außen nach innen auffüllen ("Zwiebelschalen").
  let remaining = bw * bh;
  const next = [];
  while (remaining > 0) {
    next.length = 0;
    for (let y = 0; y < wh; y++) {
      for (let x = 0; x < ww; x++) {
        const j = y * ww + x;
        if (known[j]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= wh) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= ww || (dx === 0 && dy === 0)) continue;
            const k = yy * ww + xx;
            if (!known[k]) continue;
            r += buf[k * 3]; g += buf[k * 3 + 1]; b += buf[k * 3 + 2]; n++;
          }
        }
        if (n) next.push(j, r / n, g / n, b / n);
      }
    }
    if (next.length === 0) break;
    for (let t = 0; t < next.length; t += 4) {
      const j = next[t];
      buf[j * 3] = next[t + 1]; buf[j * 3 + 1] = next[t + 2]; buf[j * 3 + 2] = next[t + 3];
      known[j] = 1;
      remaining--;
    }
  }

  // Innen glätten, damit keine Streifen bleiben.
  const passes = Math.min(12, Math.ceil(Math.max(bw, bh) / 12));
  const tmp = new Float32Array(buf.length);
  for (let p = 0; p < passes; p++) {
    tmp.set(buf);
    for (let y = 1; y < wh - 1; y++) {
      for (let x = 1; x < ww - 1; x++) {
        const j = y * ww + x;
        if (!inMask[j]) continue;
        for (let c = 0; c < 3; c++) {
          tmp[j * 3 + c] =
            (buf[(j - 1) * 3 + c] + buf[(j + 1) * 3 + c] +
              buf[(j - ww) * 3 + c] + buf[(j + ww) * 3 + c] + buf[j * 3 + c]) / 5;
        }
      }
    }
    buf.set(tmp);
  }

  // Etwas Körnung wie in der Umgebung, damit die Fläche nicht künstlich glatt wirkt.
  // Gemessen wird nur das feine Rauschen (Unterschied zum Nachbarpixel), nicht Verläufe.
  let diff = 0, cnt = 0;
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww - 1; x++) {
      const j = y * ww + x;
      if (inMask[j] || inMask[j + 1]) continue;
      diff += Math.abs(buf[j * 3 + 1] - buf[(j + 1) * 3 + 1]);
      cnt++;
    }
  }
  const noise = cnt ? Math.min(6, (diff / cnt) * 0.7) : 0;

  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const j = y * ww + x;
      if (!inMask[j]) continue;
      const i = ((y + wy0) * W + (x + wx0)) * 4;
      const n = (Math.random() - 0.5) * 2 * noise;
      data[i] = buf[j * 3] + n;
      data[i + 1] = buf[j * 3 + 1] + n;
      data[i + 2] = buf[j * 3 + 2] + n;
    }
  }
}

// ---------- Unschärfe für Schärfen/Klarheit ----------

function boxBlurChannel(src, w, h, r) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const size = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / size;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / size;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

function unsharp(data, w, h, radius, amount, midtoneOnly) {
  if (amount <= 0) return;
  const n = w * h;
  const lum = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    lum[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  // Zweimal Box-Blur ≈ Gauß-Unschärfe
  const blurred = boxBlurChannel(boxBlurChannel(lum, w, h, radius), w, h, radius);
  for (let p = 0; p < n; p++) {
    let d = (lum[p] - blurred[p]) * amount;
    if (midtoneOnly) {
      const l = lum[p] / 255;
      d *= 1 - Math.abs(l - 0.5) * 1.6;
    }
    const i = p * 4;
    data[i] += d;
    data[i + 1] += d;
    data[i + 2] += d;
  }
}

// ---------- Haupt-Render ----------

/**
 * Rendert das Bild mit den Parametern.
 * @param {HTMLCanvasElement} base   unbearbeitetes Original (beliebige Größe)
 * @param {object} rawParams          Parameter (werden normalisiert)
 * @param {Array} removals            zu entfernende Bereiche relativ zum Original
 */
export function renderImage(base, rawParams, removals = []) {
  const params = normalizeParams(rawParams);
  const W = base.width;
  const H = base.height;

  // 1) Objekte entfernen (auf dem Original)
  let source = base;
  if (removals.length) {
    source = document.createElement("canvas");
    source.width = W;
    source.height = H;
    const sctx = source.getContext("2d");
    sctx.drawImage(base, 0, 0);
    const img = sctx.getImageData(0, 0, W, H);
    for (const box of removals) inpaint(img, normalizeBox(box));
    sctx.putImageData(img, 0, 0);
  }

  // 2) Zuschneiden / Zoomen
  const c = params.crop;
  const sx = Math.round(c.x * W), sy = Math.round(c.y * H);
  const sw = Math.max(1, Math.round(c.w * W)), sh = Math.max(1, Math.round(c.h * H));
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

  const imageData = ctx.getImageData(0, 0, sw, sh);
  const data = imageData.data;
  const f = new Float32Array(data.length); // Arbeitspuffer 0..255 ohne Abschneiden

  // 3) Farbe & Licht pro Pixel
  const exp = Math.pow(2, params.exposure);
  const t = params.temperature / 100;
  const tn = params.tint / 100;
  const gainR = exp * (1 + 0.18 * t) * (1 + 0.06 * tn);
  const gainG = exp * (1 - 0.1 * tn);
  const gainB = exp * (1 - 0.18 * t) * (1 + 0.06 * tn);
  const contrast = 1 + (params.contrast / 100) * 0.7;
  const hi = (params.highlights / 100) * 0.3;
  const sh2 = (params.shadows / 100) * 0.3;
  const sat = 1 + params.saturation / 100;
  const vib = params.vibrance / 100;
  const gray = params.grayscale / 100;
  const sepia = params.sepia / 100;
  const fade = params.fade / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = gamma(toLinear[data[i]] * gainR);
    let g = gamma(toLinear[data[i + 1]] * gainG);
    let b = gamma(toLinear[data[i + 2]] * gainB);

    let L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (hi || sh2) {
      const d = hi * smoothstep(0.45, 1, L) + sh2 * (1 - smoothstep(0, 0.55, L)) * (1 - L);
      r += d; g += d; b += d;
    }

    if (contrast !== 1) {
      r = (r - 0.5) * contrast + 0.5;
      g = (g - 0.5) * contrast + 0.5;
      b = (b - 0.5) * contrast + 0.5;
    }

    L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let k = sat;
    if (vib) {
      const s = Math.max(r, g, b) - Math.min(r, g, b);
      k *= 1 + vib * (1 - clamp01(s * 1.5));
    }
    if (k !== 1) {
      r = L + (r - L) * k;
      g = L + (g - L) * k;
      b = L + (b - L) * k;
    }

    if (gray) {
      r += (L - r) * gray;
      g += (L - g) * gray;
      b += (L - b) * gray;
    }

    if (sepia) {
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      r += (sr - r) * sepia;
      g += (sg - g) * sepia;
      b += (sb - b) * sepia;
    }

    if (fade) {
      r = r * (1 - fade * 0.18) + fade * 0.1;
      g = g * (1 - fade * 0.18) + fade * 0.1;
      b = b * (1 - fade * 0.18) + fade * 0.11;
    }

    f[i] = r * 255;
    f[i + 1] = g * 255;
    f[i + 2] = b * 255;
    f[i + 3] = data[i + 3];
  }

  // 4) Klarheit (großer Radius) und Schärfe (kleiner Radius)
  if (params.clarity > 0) {
    const radius = Math.max(2, Math.round(Math.max(sw, sh) / 120));
    unsharp(f, sw, sh, radius, (params.clarity / 100) * 0.8, true);
  }
  if (params.sharpen > 0) {
    const radius = Math.max(1, Math.round(Math.max(sw, sh) / 1400));
    unsharp(f, sw, sh, radius, (params.sharpen / 100) * 2.2, false);
  }

  // 5) Vignette und zurückschreiben
  const vig = params.vignette / 100;
  const cx = sw / 2, cy = sh / 2;
  const maxD = Math.hypot(cx, cy);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      let m = 1;
      if (vig) m = 1 - vig * 0.65 * smoothstep(0.45, 1.05, Math.hypot(x - cx, y - cy) / maxD);
      data[i] = f[i] * m;
      data[i + 1] = f[i + 1] * m;
      data[i + 2] = f[i + 2] * m;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

/** Einfache Bildstatistik für die lokalen Vorschläge. */
export function analyze(canvas) {
  const small = scaledCanvas(canvas, 200);
  const { data } = small.getContext("2d").getImageData(0, 0, small.width, small.height);
  let sumL = 0, sumL2 = 0, sumS = 0, sumR = 0, sumG = 0, sumB = 0, dark = 0, bright = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sumL += L; sumL2 += L * L;
    sumS += Math.max(r, g, b) - Math.min(r, g, b);
    sumR += r; sumG += g; sumB += b;
    if (L < 0.08) dark++;
    if (L > 0.94) bright++;
  }
  const mean = sumL / n;
  return {
    brightness: mean,
    contrast: Math.sqrt(Math.max(0, sumL2 / n - mean * mean)),
    saturation: sumS / n,
    warmth: (sumR - sumB) / n, // >0 warm, <0 kühl
    greenMagenta: (sumG - (sumR + sumB) / 2) / n,
    clippedShadows: dark / n,
    clippedHighlights: bright / n,
  };
}
