// Bild-Engine: wendet Bearbeitungs-Parameter auf ein Canvas an.
// Alles läuft lokal im Browser.
//
// Koordinaten: Alle Rechtecke (crop, regions, removals) sind relativ zum
// ORIGINALBILD angegeben (x, y, w, h jeweils 0..1).

export const FULL_CROP = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

export const RANGES = {
  exposure: [-3, 3],
  contrast: [-100, 100],
  highlights: [-100, 100],
  shadows: [-100, 100],
  whites: [-100, 100],
  blacks: [-100, 100],
  blackPoint: [0, 100],
  whitePoint: [0, 100],
  saturation: [-100, 100],
  vibrance: [-100, 100],
  temperature: [-100, 100],
  tint: [-100, 100],
  hue: [-180, 180],
  dehaze: [-100, 100],
  grayscale: [0, 100],
  sepia: [0, 100],
  fade: [0, 100],
  grain: [0, 100],
  sharpen: [0, 100],
  clarity: [-100, 100],
  softness: [0, 100],
  vignette: [-100, 100],
  splitShadowHue: [0, 360],
  splitShadowAmount: [0, 100],
  splitHighlightHue: [0, 360],
  splitHighlightAmount: [0, 100],
  rotate: [-45, 45],
};

export const HSL_BANDS = {
  red: 0, orange: 30, yellow: 60, green: 120, aqua: 180, blue: 225, purple: 270, magenta: 315,
};

const REGION_RANGES = {
  exposure: [-3, 3],
  contrast: [-100, 100],
  saturation: [-100, 100],
  temperature: [-100, 100],
  blur: [0, 100],
  feather: [0, 100],
};

const zeroHsl = () => Object.fromEntries(Object.keys(HSL_BANDS).map((b) => [b, { h: 0, s: 0, l: 0 }]));

export const DEFAULT_PARAMS = Object.freeze({
  ...Object.fromEntries(Object.keys(RANGES).map((k) => [k, 0])),
  flipH: false,
  flipV: false,
  hsl: zeroHsl(),
  regions: [],
  crop: FULL_CROP,
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const numOr = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function normalizeBox(box, minSize = 0.02) {
  if (!box) return { ...FULL_CROP };
  const w = clamp(numOr(box.w, 1), minSize, 1);
  const h = clamp(numOr(box.h, 1), minSize, 1);
  const x = clamp(numOr(box.x, 0), 0, 1 - w);
  const y = clamp(numOr(box.y, 0), 0, 1 - h);
  return { x, y, w, h };
}

export function normalizeParams(params = {}) {
  const out = {};
  for (const [key, [lo, hi]] of Object.entries(RANGES)) {
    out[key] = clamp(numOr(params[key], 0), lo, hi);
  }
  out.flipH = Boolean(params.flipH);
  out.flipV = Boolean(params.flipV);
  out.hsl = zeroHsl();
  if (params.hsl && typeof params.hsl === "object") {
    for (const band of Object.keys(HSL_BANDS)) {
      const b = params.hsl[band] || {};
      out.hsl[band] = {
        h: clamp(numOr(b.h, 0), -100, 100),
        s: clamp(numOr(b.s, 0), -100, 100),
        l: clamp(numOr(b.l, 0), -100, 100),
      };
    }
  }
  out.regions = (Array.isArray(params.regions) ? params.regions : []).slice(0, 8).map((r) => {
    const region = {
      ...normalizeBox(r, 0.01),
      shape: r.shape === "rect" ? "rect" : "ellipse",
      invert: Boolean(r.invert),
    };
    for (const [key, [lo, hi]] of Object.entries(REGION_RANGES)) {
      region[key] = clamp(numOr(r[key], key === "feather" ? 50 : 0), lo, hi);
    }
    return region;
  });
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

export function canvasToBlob(canvas, maxSize = 1024, quality = 0.85) {
  return new Promise((resolve) => scaledCanvas(canvas, maxSize).toBlob(resolve, "image/jpeg", quality));
}

// ---------- Farb-Hilfen ----------

const toLinear = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  toLinear[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const toLinearF = (c) => (c <= 0 ? 0 : c >= 1 ? 1 : toLinear[(c * 255) | 0]);
const GAMMA_STEPS = 4096;
const toGamma = new Float32Array(GAMMA_STEPS + 1);
for (let i = 0; i <= GAMMA_STEPS; i++) {
  const c = i / GAMMA_STEPS;
  toGamma[i] = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
const gamma = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : toGamma[(v * GAMMA_STEPS) | 0]);

function hueToRgb(hDeg) {
  const h = (((hDeg % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  return [r, g, b];
}

// ---------- Objekte entfernen (Auffüllen aus der Umgebung) ----------

function inpaint(imageData, boxNorm) {
  const { width: W, height: H, data } = imageData;
  const pad = 0.08;
  const x0 = clamp(Math.floor((boxNorm.x - boxNorm.w * pad) * W), 0, W - 1);
  const y0 = clamp(Math.floor((boxNorm.y - boxNorm.h * pad) * H), 0, H - 1);
  const x1 = clamp(Math.ceil((boxNorm.x + boxNorm.w * (1 + pad)) * W), x0 + 1, W);
  const y1 = clamp(Math.ceil((boxNorm.y + boxNorm.h * (1 + pad)) * H), y0 + 1, H);
  const bw = x1 - x0;
  const bh = y1 - y0;

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

  // Feine Körnung wie in der Umgebung, damit die Fläche nicht künstlich glatt wirkt.
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

// ---------- Unschärfe ----------

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

const gaussish = (src, w, h, r) => boxBlurChannel(boxBlurChannel(boxBlurChannel(src, w, h, r), w, h, r), w, h, r);

/** Unscharf maskieren auf einem RGBA-Float-Puffer. amount < 0 macht weicher. */
function unsharp(f, w, h, radius, amount, midtoneOnly) {
  if (!amount) return;
  const n = w * h;
  const lum = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    lum[p] = f[i] * 0.299 + f[i + 1] * 0.587 + f[i + 2] * 0.114;
  }
  const blurred = boxBlurChannel(boxBlurChannel(lum, w, h, radius), w, h, radius);
  for (let p = 0; p < n; p++) {
    let d = (lum[p] - blurred[p]) * amount;
    if (midtoneOnly) d *= Math.max(0, 1 - Math.abs(lum[p] / 255 - 0.5) * 1.6);
    const i = p * 4;
    f[i] += d;
    f[i + 1] += d;
    f[i + 2] += d;
  }
}

// ---------- Masken für lokale Bereiche ----------

function regionMask(region, W, H) {
  const mask = new Float32Array(W * H);
  const cx = (region.x + region.w / 2) * W;
  const cy = (region.y + region.h / 2) * H;
  const rx = Math.max(1, (region.w / 2) * W);
  const ry = Math.max(1, (region.h / 2) * H);
  const feather = 0.02 + (region.feather / 100) * 0.6; // Anteil der Größe
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      let d;
      if (region.shape === "rect") d = Math.max(Math.abs(dx), Math.abs(dy));
      else d = Math.hypot(dx, dy);
      let m = 1 - smoothstep(1 - feather, 1 + feather, d);
      if (region.invert) m = 1 - m;
      mask[y * W + x] = m;
    }
  }
  return mask;
}

// ---------- Haupt-Render ----------

/**
 * Rendert das Bild mit den Parametern.
 * @param {HTMLCanvasElement} base   unbearbeitetes Original (beliebige Größe)
 * @param {object} rawParams          Parameter (werden normalisiert)
 * @param {Array} removals            zu entfernende Bereiche relativ zum Original
 */
export function renderImage(base, rawParams, removals = []) {
  const p = normalizeParams(rawParams);
  const W = base.width;
  const H = base.height;

  const stage = document.createElement("canvas");
  stage.width = W;
  stage.height = H;
  const sctx = stage.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(base, 0, 0);
  const img = sctx.getImageData(0, 0, W, H);
  const data = img.data;

  // 1) Objekte entfernen
  for (const box of removals) inpaint(img, normalizeBox(box, 0.005));

  // 2) Farbe & Licht pro Pixel (im Original-Koordinatensystem)
  const f = new Float32Array(data.length);
  const regions = p.regions.map((r) => ({ ...r, mask: regionMask(r, W, H) }));
  const colorRegions = regions.filter((r) => r.exposure || r.contrast || r.saturation || r.temperature);

  const bp = (p.blackPoint / 100) * 0.4;
  const wp = 1 - (p.whitePoint / 100) * 0.4;
  const levelScale = 1 / Math.max(0.05, wp - bp);
  const t0 = p.temperature / 100;
  const tn = p.tint / 100;
  const hi = (p.highlights / 100) * 0.35;
  const sh = (p.shadows / 100) * 0.35;
  const wh = (p.whites / 100) * 0.25;
  const bl = (p.blacks / 100) * 0.2;
  const dz = p.dehaze / 100;
  const vib = p.vibrance / 100;
  const gray = p.grayscale / 100;
  const sepia = p.sepia / 100;
  const fade = p.fade / 100;

  const hslActive = Object.values(p.hsl).some((b) => b.h || b.s || b.l) || p.hue;
  const bands = Object.entries(HSL_BANDS).map(([name, center]) => ({ center, ...p.hsl[name] }));

  const splitS = p.splitShadowAmount / 100;
  const splitH = p.splitHighlightAmount / 100;
  const [ssr, ssg, ssb] = hueToRgb(p.splitShadowHue);
  const [shr, shg, shb] = hueToRgb(p.splitHighlightHue);

  for (let i = 0, px = 0; i < data.length; i += 4, px++) {
    // Lokale Werte aufsummieren
    let exp = p.exposure, con = p.contrast, sat = p.saturation, temp = t0;
    for (const r of colorRegions) {
      const m = r.mask[px];
      if (m < 0.002) continue;
      exp += r.exposure * m;
      con += r.contrast * m;
      sat += r.saturation * m;
      temp += (r.temperature / 100) * m;
    }

    // Tonwerte (Schwarz-/Weißpunkt)
    let r = (data[i] / 255 - bp) * levelScale;
    let g = (data[i + 1] / 255 - bp) * levelScale;
    let b = (data[i + 2] / 255 - bp) * levelScale;

    // Belichtung + Weißabgleich in linearem Licht
    const e = Math.pow(2, exp);
    r = gamma(toLinearF(r) * e * (1 + 0.2 * temp) * (1 + 0.07 * tn));
    g = gamma(toLinearF(g) * e * (1 - 0.12 * tn));
    b = gamma(toLinearF(b) * e * (1 - 0.2 * temp) * (1 + 0.07 * tn));

    // Dunst entfernen / hinzufügen
    if (dz) {
      const k = 1 + 0.4 * dz;
      r = (r - 0.5) * k + 0.5 - 0.06 * dz;
      g = (g - 0.5) * k + 0.5 - 0.06 * dz;
      b = (b - 0.5) * k + 0.5 - 0.06 * dz;
    }

    // Lichter, Tiefen, Weiß, Schwarz
    let L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (hi || sh || wh || bl) {
      const d =
        hi * smoothstep(0.45, 1, L) +
        sh * (1 - smoothstep(0, 0.55, L)) * (1 - L) +
        wh * smoothstep(0.7, 1, L) +
        bl * (1 - smoothstep(0, 0.3, L));
      r += d; g += d; b += d;
    }

    // Kontrast (sanfte S-Kurve)
    if (con) {
      const k = 1 + (con / 100) * 0.8;
      r = (r - 0.5) * k + 0.5;
      g = (g - 0.5) * k + 0.5;
      b = (b - 0.5) * k + 0.5;
    }

    // Einzelne Farbtöne (HSL)
    if (hslActive) {
      r = clamp01(r); g = clamp01(g); b = clamp01(b);
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let l = (max + min) / 2;
      let s = 0, h = 0;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
      }
      if (s > 0.02) {
        let dh = 0, ds = 0, dl = 0;
        for (const band of bands) {
          if (!band.h && !band.s && !band.l) continue;
          let diff = Math.abs(h - band.center);
          if (diff > 180) diff = 360 - diff;
          const w = Math.max(0, 1 - diff / 40) * Math.min(1, s * 3);
          if (!w) continue;
          dh += band.h * 0.3 * w;
          ds += (band.s / 100) * w;
          dl += (band.l / 100) * 0.25 * w;
        }
        h += dh + p.hue;
        s = clamp01(s * (1 + ds));
        l = clamp01(l + dl);
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const pp = 2 * l - q;
        const conv = (t) => {
          t = ((t % 360) + 360) % 360 / 360;
          if (t < 1 / 6) return pp + (q - pp) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
          return pp;
        };
        r = conv(h + 120); g = conv(h); b = conv(h - 120);
      }
    }

    // Sättigung und Dynamik
    L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let k = 1 + sat / 100 + 0.3 * dz;
    if (vib) {
      const s = Math.max(r, g, b) - Math.min(r, g, b);
      k *= 1 + vib * 1.2 * (1 - clamp01(s * 1.5));
    }
    if (k !== 1) {
      r = L + (r - L) * k;
      g = L + (g - L) * k;
      b = L + (b - L) * k;
    }

    // Color Grading (Schatten/Lichter einfärben)
    if (splitS || splitH) {
      const ws = splitS * 0.22 * (1 - L) * (1 - L);
      const wl = splitH * 0.22 * L * L;
      r += (ssr - 0.5) * ws + (shr - 0.5) * wl;
      g += (ssg - 0.5) * ws + (shg - 0.5) * wl;
      b += (ssb - 0.5) * ws + (shb - 0.5) * wl;
    }

    if (gray) {
      L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
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
      r = r * (1 - fade * 0.2) + fade * 0.11;
      g = g * (1 - fade * 0.2) + fade * 0.11;
      b = b * (1 - fade * 0.2) + fade * 0.12;
    }

    f[i] = r * 255;
    f[i + 1] = g * 255;
    f[i + 2] = b * 255;
    f[i + 3] = data[i + 3];
  }

  // 3) Weichzeichnen: ganzes Bild (softness) und lokale Bereiche (z. B. Hintergrund)
  const blurRegions = regions.filter((r) => r.blur > 0);
  if (p.softness > 0 || blurRegions.length) {
    const maxBlur = Math.max(p.softness, ...blurRegions.map((r) => r.blur));
    const radius = Math.max(1, Math.round((Math.max(W, H) / 100) * (maxBlur / 100) * 2.5));
    const chans = [0, 1, 2].map((c) => {
      const ch = new Float32Array(W * H);
      for (let px = 0; px < W * H; px++) ch[px] = f[px * 4 + c];
      return gaussish(ch, W, H, radius);
    });
    for (let px = 0; px < W * H; px++) {
      let m = (p.softness / 100) * 0.6;
      for (const r of blurRegions) m = Math.max(m, r.mask[px] * (r.blur / maxBlur));
      if (m < 0.002) continue;
      m = Math.min(1, m);
      for (let c = 0; c < 3; c++) f[px * 4 + c] += (chans[c][px] - f[px * 4 + c]) * m;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = f[i];
    data[i + 1] = f[i + 1];
    data[i + 2] = f[i + 2];
  }
  sctx.putImageData(img, 0, 0);

  // 4) Drehen / Spiegeln (füllt das Bild ohne schwarze Ecken)
  let framed = stage;
  if (p.rotate || p.flipH || p.flipV) {
    framed = document.createElement("canvas");
    framed.width = W;
    framed.height = H;
    const fctx = framed.getContext("2d");
    const a = (p.rotate * Math.PI) / 180;
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const scale = Math.max((W * c + H * s) / W, (W * s + H * c) / H);
    fctx.translate(W / 2, H / 2);
    fctx.rotate(a);
    fctx.scale(scale * (p.flipH ? -1 : 1), scale * (p.flipV ? -1 : 1));
    fctx.imageSmoothingQuality = "high";
    fctx.drawImage(stage, -W / 2, -H / 2);
  }

  // 5) Zuschneiden / Zoomen
  const cr = p.crop;
  const sx = Math.round(cr.x * W), sy = Math.round(cr.y * H);
  const sw = Math.max(1, Math.round(cr.w * W)), sh2 = Math.max(1, Math.round(cr.h * H));
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh2;
  const ctx = out.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(framed, sx, sy, sw, sh2, 0, 0, sw, sh2);

  // 6) Klarheit, Schärfe, Vignette, Körnung
  const needDetail = p.clarity || p.sharpen || p.vignette || p.grain;
  if (needDetail) {
    const od = ctx.getImageData(0, 0, sw, sh2);
    const d = od.data;
    const g = new Float32Array(d.length);
    for (let i = 0; i < d.length; i++) g[i] = d[i];
    if (p.clarity) {
      const radius = Math.max(2, Math.round(Math.max(sw, sh2) / 120));
      unsharp(g, sw, sh2, radius, (p.clarity / 100) * 1.0, true);
    }
    if (p.sharpen > 0) {
      const radius = Math.max(1, Math.round(Math.max(sw, sh2) / 1400));
      unsharp(g, sw, sh2, radius, (p.sharpen / 100) * 2.6, false);
    }
    const vig = p.vignette / 100;
    const grain = (p.grain / 100) * 38;
    const cx = sw / 2, cy = sh2 / 2;
    const maxD = Math.hypot(cx, cy);
    for (let y = 0; y < sh2; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        let m = 1;
        if (vig) {
          const v = smoothstep(0.4, 1.05, Math.hypot(x - cx, y - cy) / maxD);
          m = vig > 0 ? 1 - vig * 0.7 * v : 1 - vig * 0.5 * v; // negativ = helle Ränder
        }
        const n = grain ? (Math.random() - 0.5) * grain : 0;
        if (vig < 0) {
          const v = 1 - m; // Anteil zum Aufhellen
          d[i] = g[i] + (255 - g[i]) * -v + n;
          d[i + 1] = g[i + 1] + (255 - g[i + 1]) * -v + n;
          d[i + 2] = g[i + 2] + (255 - g[i + 2]) * -v + n;
        } else {
          d[i] = g[i] * m + n;
          d[i + 1] = g[i + 1] * m + n;
          d[i + 2] = g[i + 2] * m + n;
        }
      }
    }
    ctx.putImageData(od, 0, 0);
  }
  return out;
}

/** Bildstatistik für die lokalen Vorschläge. */
export function analyze(canvas) {
  const small = scaledCanvas(canvas, 240);
  const { data } = small.getContext("2d").getImageData(0, 0, small.width, small.height);
  const n = data.length / 4;
  const hist = new Uint32Array(256);
  let sumL = 0, sumL2 = 0, sumS = 0, sumR = 0, sumG = 0, sumB = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    hist[Math.min(255, Math.round(L * 255))]++;
    sumL += L; sumL2 += L * L;
    sumS += Math.max(r, g, b) - Math.min(r, g, b);
    sumR += r; sumG += g; sumB += b;
  }
  const pct = (q) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= q * n) return v / 255;
    }
    return 1;
  };
  const mean = sumL / n;
  return {
    brightness: mean,
    contrast: Math.sqrt(Math.max(0, sumL2 / n - mean * mean)),
    saturation: sumS / n,
    warmth: (sumR - sumB) / n,
    greenMagenta: (sumG - (sumR + sumB) / 2) / n,
    low: pct(0.005),
    high: pct(0.995),
  };
}
