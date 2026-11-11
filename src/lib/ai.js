// Einheitliche KI-Schicht:
// - Web-Version (claude.ai): Claude direkt über die `sample`-Fähigkeit (inkl. Bilder), auf dem Konto des Nutzers
// - Server-Version: Kalora-Server mit ANTHROPIC_API_KEY
import { useEffect, useState } from 'react'
import { STATIC } from '../static.js'
import { api } from '../api.js'
import { FOOD_LIST } from '../data/foods.js'

let statusPromise = null

async function getSample() {
  try { return (await window.claude?.use?.('sample')) || null } catch { return null }
}

export function getAIStatus() {
  if (!statusPromise) {
    // Nicht verfügbar? Beim nächsten Öffnen erneut prüfen (z. B. Freigabe erst später erteilt)
    setTimeout(() => statusPromise?.then(s => { if (!s.enabled) statusPromise = null }), 0)
    statusPromise = (async () => {
      if (STATIC) {
        const sample = await getSample()
        if (!sample) return { enabled: false, images: false, via: null }
        const limits = await sample.limits().catch(() => null)
        // limits() fehlt in älteren Apps – dann trotzdem versuchen und den Fehler beim Aufruf melden
        return { enabled: true, images: limits ? !!limits.images : true, via: 'claude' }
      }
      try {
        const s = await api('/api/ai/status', { auth: false })
        return { enabled: !!s.enabled, images: !!s.enabled, via: 'server' }
      } catch { return { enabled: false, images: false, via: null } }
    })()
  }
  return statusPromise
}

export function useAIStatus() {
  const [s, setS] = useState(null)
  useEffect(() => { let on = true; getAIStatus().then(v => on && setS(v)); return () => { on = false } }, [])
  return s
}

const ERR = {
  not_granted: 'Du hast der App den Zugriff auf Claude nicht erlaubt.',
  sampling_disabled: 'Claude ist für dieses Konto hier nicht verfügbar.',
  rate_limited: 'Gerade zu viele Anfragen – bitte in einer Minute erneut versuchen.',
  image_rejected: 'Dieses Bild konnte nicht gelesen werden. Bitte ein anderes Foto (JPG/PNG) wählen.',
  images_unavailable: 'In dieser Ansicht können keine Bilder an Claude gesendet werden.',
  refused: 'Claude konnte diese Anfrage nicht bearbeiten. Versuche ein anderes Foto.',
  invalid_json: 'Die Antwort konnte nicht gelesen werden – bitte erneut versuchen.',
  session_expired: 'Bitte melde dich bei Claude erneut an.',
}
const wrap = e => Object.assign(new Error(ERR[e?.code] || e?.message || 'Die KI ist gerade nicht erreichbar – bitte erneut versuchen.'), { code: e?.code })

// ---------- Fotoerkennung ----------
const FOOD_KEYS_TEXT = FOOD_LIST.map(f => `${f.key}=${f.name}`).join('; ')

function photoPrompt({ count, plate, hint, memory }) {
  return `Du bist ein erfahrener Ernährungswissenschaftler. ${count > 1 ? `Du bekommst ${count} Fotos DERSELBEN Mahlzeit (z. B. von oben und von der Seite) – nutze beide für die Mengenschätzung, zähle nichts doppelt.` : 'Analysiere das Foto einer Mahlzeit.'}
Vorgehen: 1) jedes sichtbare Lebensmittel erkennen (auch Saucen, Öl, Dressing, Getränke). 2) Menge in Gramm schätzen – Referenz: ${plate}. Achte auf Höhe/Dicke der Speisen. 3) Nährwerte mit Referenzwerten (Bundeslebensmittelschlüssel) berechnen; Zubereitungsfett realistisch einrechnen.
Ordne jedes Lebensmittel, wenn möglich, einem Schlüssel aus dieser Kalora-Datenbank zu (Feld "key", sonst null): ${FOOD_KEYS_TEXT}
${memory?.length ? `Der Nutzer hat diese Gerichte früher korrigiert – nutze das, wenn das Foto dazu passt:\n${memory.map(m => `- ${m.dish}: ${m.items.map(i => `${Math.round(i.grams)} g ${i.name}`).join(', ')}`).join('\n')}\n` : ''}${hint ? `Hinweis des Nutzers: ${hint}\n` : ''}Antworte NUR mit JSON in genau dieser Form (Zahlen als Zahlen, Texte auf Deutsch):
{"is_food": true, "dish": "Hähnchen mit Reis und Brokkoli", "confidence": "hoch|mittel|niedrig",
 "items": [{"name": "Hähnchenbrust", "key": "haehnchenbrust", "grams": 150, "kcal": 165, "protein": 35, "carbs": 0, "fat": 2.5, "sugar": 0, "fiber": 0}],
 "notes": "kurzer Hinweis, was die Schätzung unsicher macht"}
Kein Essen zu sehen: {"is_food": false, "dish": "", "confidence": "niedrig", "items": [], "notes": "..."}
WICHTIG: Zeigt das Foto hauptsächlich ein VERPACKTES Markenprodukt (Riegel, Becher, Flasche, Tüte, Dose – noch in oder auf der Verpackung) statt einer angerichteten Mahlzeit,
antworte NUR mit: {"is_food": true, "packaged": true, "dish": "Marke + Produktname", "confidence": "hoch", "items": [], "notes": ""}`
}

// ---------- Verpacktes Produkt (z. B. Proteinriegel) ----------
const PRODUCT_PROMPT = n => `Du bekommst ${n > 1 ? `${n} Fotos EINES verpackten Lebensmittels` : 'ein Foto eines verpackten Lebensmittels, meist nur die VORDERSEITE'} – z. B. Proteinriegel, Joghurt, Skyr, Getränk, Chips, Müsliriegel, Fertiggericht.
Der Nutzer fotografiert normalerweise NICHT die Nährwerttabelle – erkenne das Produkt trotzdem:
1) Erkenne Marke, Produktname und genaue Sorte/Geschmack anhand von Logo, Schriftzug, Farben und Verpackungsdesign.
2) Nährwerte pro 100 g bzw. 100 ml:
   - Ist eine Nährwerttabelle sichtbar, lies sie EXAKT ab → source "etikett".
   - Sonst nutze die offiziellen Herstellerangaben genau dieser Sorte, wie sie in Deutschland verkauft wird → source "bekannt".
     Gleiche sie mit Angaben auf der Vorderseite ab (z. B. "20 g Protein", "nur 180 kcal", "ohne Zuckerzusatz", Füllmenge "45 g").
   - Nur wenn du das konkrete Produkt nicht kennst: realistische Werte vergleichbarer Produkte dieser Art → source "geschätzt".
3) Portion (z. B. "1 Riegel" = Riegelgewicht, "1 Becher", "1 Flasche") und Packungsinhalt in g/ml – von der Packung oder aus deinem Wissen. EAN nur, wenn lesbar.
Antworte NUR mit JSON:
{"is_product": true, "name": "Protein Bar Chocolate Brownie", "brand": "Marke", "ean": null,
 "source": "etikett|bekannt|geschätzt", "confidence": "hoch|mittel|niedrig",
 "per100": {"kcal": 380, "protein": 33, "carbs": 30, "sugar": 2.5, "fat": 13, "fiber": 12},
 "unit": "g|ml", "portion": {"label": "1 Riegel", "grams": 45}, "package_grams": 45, "notes": "kurzer Hinweis, z. B. woher die Werte stammen"}
Kein verpacktes Lebensmittel zu sehen: {"is_product": false, "name": "", "notes": "..."}`

// ---------- Spracheingabe: „Was hast du gegessen?" ----------
export async function analyzeText({ text, signal }) {
  const st = await getAIStatus()
  if (st.via !== 'claude') throw Object.assign(new Error('KI nicht verfügbar'), { code: 'no_ai' })
  const sample = await getSample()
  const prompt = `Der Nutzer beschreibt (per Sprache diktiert, evtl. mit Erkennungsfehlern), was er gegessen oder getrunken hat:
"""${String(text).slice(0, 2000)}"""
Erkenne jedes Lebensmittel und die Menge. Fehlt die Menge, nimm eine übliche Portion (z. B. 1 Ei = 60 g, 1 Apfel = 150 g, 1 Teller Nudeln = 350 g gekocht, 1 Scheibe Brot = 50 g).
Ordne jedes Lebensmittel wenn möglich einem Schlüssel aus dieser Kalora-Datenbank zu (sonst null): ${FOOD_KEYS_TEXT}
Achtung: rohe Datenbankwerte (Reis, Nudeln roh) – bei gekochten Mengen die Rohmenge eintragen (gekochter Reis ≈ 1/3 Rohgewicht, gekochte Nudeln ≈ 1/2,3).
Antworte NUR mit JSON: {"dish": "kurzer Name der Mahlzeit", "confidence": "hoch|mittel|niedrig",
 "items": [{"name": "Ei", "key": "ei", "grams": 120, "kcal": 186, "protein": 15.6, "carbs": 1.2, "fat": 13.2, "sugar": 1.2, "fiber": 0}], "notes": "kurzer Hinweis"}`
  try { return normalizePhoto(await sample.json(prompt, { signal, cache: false })) } catch (e) { throw wrap(e) }
}

export async function analyzeProduct({ files, images = [], signal }) {
  const st = await getAIStatus()
  let r
  if (st.via === 'claude') {
    const sample = await getSample()
    try { r = await sample.json(PRODUCT_PROMPT(files.length), { images: files, signal, cache: false }) } catch (e) { throw wrap(e) }
  } else {
    r = await api('/api/ai/analyze-product', { method: 'POST', body: { image: images[0].base64, mediaType: images[0].mediaType } })
  }
  const n = v => Math.max(0, Number(v) || 0)
  const p = r?.per100 || {}
  return {
    is_product: r?.is_product !== false && !!r?.name,
    name: String(r?.name || ''), brand: r?.brand ? String(r.brand) : '',
    ean: r?.ean && /^\d{8,14}$/.test(String(r.ean)) ? String(r.ean) : null,
    source: ['etikett', 'bekannt', 'geschätzt'].includes(r?.source) ? r.source : 'geschätzt',
    confidence: ['hoch', 'mittel', 'niedrig'].includes(r?.confidence) ? r.confidence : 'mittel',
    per100: { kcal: n(p.kcal), p: n(p.protein), c: n(p.carbs), s: n(p.sugar), f: n(p.fat), fi: n(p.fiber) },
    unit: r?.unit === 'ml' ? 'ml' : 'g',
    portion: r?.portion && n(r.portion.grams) ? { label: String(r.portion.label || '1 Portion'), grams: n(r.portion.grams) } : null,
    packageGrams: n(r?.package_grams) || null,
    notes: String(r?.notes || ''),
  }
}

export async function analyzePhoto({ files, images = [], hint = '', plate = 'normaler Teller, ca. 26 cm Durchmesser', memory = [], signal }) {
  const st = await getAIStatus()
  if (st.via === 'claude') {
    const sample = await getSample()
    try {
      const r = await sample.json(photoPrompt({ count: files.length, plate, hint, memory }), { images: files, signal, cache: false })
      return normalizePhoto(r)
    } catch (e) { throw wrap(e) }
  }
  const image = images[0]
  return normalizePhoto(await api('/api/ai/analyze-photo', { method: 'POST', body: { image: image.base64, mediaType: image.mediaType, hint: `${hint} (Referenz: ${plate})` } }))
}

function normalizePhoto(r) {
  const n = v => Math.max(0, Number(v) || 0)
  return {
    is_food: r?.is_food !== false,
    packaged: r?.packaged === true,
    dish: String(r?.dish || 'Mahlzeit'),
    confidence: ['hoch', 'mittel', 'niedrig'].includes(r?.confidence) ? r.confidence : 'mittel',
    items: (Array.isArray(r?.items) ? r.items : []).map(i => ({ name: String(i.name || 'Lebensmittel'), key: typeof i.key === 'string' ? i.key : null, grams: n(i.grams), kcal: n(i.kcal), protein: n(i.protein), carbs: n(i.carbs), fat: n(i.fat), sugar: n(i.sugar), fiber: n(i.fiber) })),
    notes: String(r?.notes || ''),
  }
}

// ---------- Kassenbon lesen (echte Preise) ----------
export async function scanReceipt({ file, image, signal }) {
  const st = await getAIStatus()
  const prompt = `Lies diesen Kassenbon eines deutschen Supermarkts. Erfasse JEDE Artikelzeile mit dem bezahlten Preis (bei Mengenrabatt den Endpreis der Zeile).
Ordne jeden Artikel, wenn möglich, einem Schlüssel aus dieser Kalora-Datenbank zu (sonst null): ${FOOD_KEYS_TEXT}
Schätze die gekaufte Menge: "amount" + "unit" (g, kg, ml, l, Stück oder Packung) – z. B. aus "500g", "1,5L", "x2" oder dem Produktnamen.
Antworte NUR mit JSON: {"store": "Kette (Aldi, Lidl, Rewe, Edeka, Kaufland, Netto, Penny, Norma, Globus oder null)", "date": "TT.MM.JJJJ oder null",
"items": [{"name": "Bio Vollmilch 3,5%", "key": "vollmilch", "price": 1.29, "amount": 1, "unit": "l"}], "total": 23.45}`
  if (st.via === 'claude') {
    const sample = await getSample()
    try { return await sample.json(prompt, { images: [file], signal, cache: false }) } catch (e) { throw wrap(e) }
  }
  return api('/api/ai/receipt', { method: 'POST', body: { image: image.base64, mediaType: image.mediaType } })
}

// ---------- KI-Coach ----------
export async function askCoach({ question, history, context, onText, signal }) {
  const st = await getAIStatus()
  if (st.via === 'claude') {
    const sample = await getSample()
    const rules = `Du bist "Kalora Coach", ein freundlicher, kompetenter Ernährungsberater in der App KALORA.
Antworte auf Deutsch, persönlich (duzen), konkret und umsetzbar, mit Bezug auf die Zahlen des Nutzers.
Wenn du Gerichte vorschlägst, nimm Rezepte aus "kalora_rezepte" und nenne ihren Namen exakt; Abneigungen strikt beachten.
Kompakt (max. ca. 180 Wörter), kurze Listen, kein Markdown-Fettdruck. Keine Diagnosen; bei Erkrankungen ärztlichen Rat empfehlen.
NUTZERDATEN (JSON): ${JSON.stringify(context)}`
    const turns = [{ role: 'user', content: rules }, ...history.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text })), { role: 'user', content: question }]
    try { return (await sample(turns, { cache: false, onText: onText ? ({ text }) => onText(text) : undefined, signal })).text } catch (e) { throw wrap(e) }
  }
  return (await api('/api/ai/coach', { method: 'POST', body: { question, history: history.slice(-10), context } })).answer
}

// ---------- KI-Rezeptgenerator ----------
export async function generateRecipeAI(form) {
  const st = await getAIStatus()
  if (st.via === 'claude') {
    const sample = await getSample()
    const foods = FOOD_LIST.map(f => `${f.key}: ${f.name} (${f.kcal} kcal, P ${f.p}, KH ${f.c}, F ${f.f} /100 g)`).join('\n')
    const prompt = `Du bist Koch und Sporternährungsexperte der App KALORA. Erstelle ein realistisches, alltagstaugliches Rezept für 1 Portion auf Deutsch.
Wunsch: "${form.prompt || 'ein ausgewogenes Gericht'}"
Vorgaben: höchstens ${form.maxKcal} kcal; mindestens ${form.minProtein} g Protein; Zubereitung höchstens ${form.time} Minuten; Ernährungsform: ${form.diet}; Mahlzeit: ${form.meal}${form.include ? `; soll enthalten: ${form.include}` : ''}${form.dislikes?.length ? `; NIEMALS verwenden: ${form.dislikes.join(', ')}` : ''}.
Verwende AUSSCHLIESSLICH Zutaten aus dieser Liste (Feld "key"); die App berechnet die Nährwerte selbst – rechne die Mengen so, dass die Vorgaben erfüllt sind:
${foods}
Antworte NUR mit JSON: {"title": "...", "description": "...", "meal": "F|M|A|S|D", "time": 25, "difficulty": "Einfach|Mittel|Anspruchsvoll", "ingredients": [{"key": "haehnchenbrust", "grams": 180}], "steps": ["...", "..."]}`
    try { return await sample.json(prompt, { cache: false }) } catch (e) { throw wrap(e) }
  }
  return api('/api/ai/generate-recipe', { method: 'POST', body: form })
}
