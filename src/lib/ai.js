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
    statusPromise = (async () => {
      if (STATIC) {
        const sample = await getSample()
        if (!sample) return { enabled: false, images: false, via: null }
        const limits = await sample.limits().catch(() => null)
        return { enabled: true, images: !!limits?.images, via: 'claude' }
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
const PHOTO_PROMPT = `Du bist ein erfahrener Ernährungswissenschaftler. Analysiere das Foto einer Mahlzeit:
erkenne jedes sichtbare Lebensmittel, schätze die Menge in Gramm anhand von Tellergröße, Besteck und typischen Portionen
und berechne die Nährwerte mit Referenzwerten (z. B. Bundeslebensmittelschlüssel). Berücksichtige Zubereitungsfett und Saucen.
Antworte NUR mit einem JSON-Objekt in genau dieser Form (alle Zahlen als Zahlen, alle Texte auf Deutsch):
{"is_food": true, "dish": "Hähnchen mit Reis und Brokkoli", "confidence": "hoch|mittel|niedrig",
 "items": [{"name": "Hähnchenbrust", "grams": 150, "kcal": 165, "protein": 35, "carbs": 0, "fat": 2.5, "sugar": 0, "fiber": 0}],
 "notes": "kurzer Hinweis zur Schätzung"}
Wenn kein Essen zu sehen ist: {"is_food": false, "dish": "", "confidence": "niedrig", "items": [], "notes": "..."}`

export async function analyzePhoto({ file, image, hint = '', signal }) {
  const st = await getAIStatus()
  if (st.via === 'claude') {
    const sample = await getSample()
    try {
      const r = await sample.json(`${PHOTO_PROMPT}${hint ? `\n\nHinweis des Nutzers: ${hint}` : ''}`, { images: [file], signal, cache: false })
      return normalizePhoto(r)
    } catch (e) { throw wrap(e) }
  }
  return normalizePhoto(await api('/api/ai/analyze-photo', { method: 'POST', body: { image: image.base64, mediaType: image.mediaType, hint } }))
}

function normalizePhoto(r) {
  const n = v => Math.max(0, Number(v) || 0)
  return {
    is_food: r?.is_food !== false,
    dish: String(r?.dish || 'Mahlzeit'),
    confidence: ['hoch', 'mittel', 'niedrig'].includes(r?.confidence) ? r.confidence : 'mittel',
    items: (Array.isArray(r?.items) ? r.items : []).map(i => ({ name: String(i.name || 'Lebensmittel'), grams: n(i.grams), kcal: n(i.kcal), protein: n(i.protein), carbs: n(i.carbs), fat: n(i.fat), sugar: n(i.sugar), fiber: n(i.fiber) })),
    notes: String(r?.notes || ''),
  }
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
