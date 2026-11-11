// KI-Funktionen über die Claude API: Fotoerkennung, Ernährungscoach, Rezeptgenerator
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { FOOD_LIST, FOODS, nutrientsFor } from '../src/data/foods.js'

const MODEL = process.env.KALORA_MODEL || 'claude-opus-5-5'
// Server-seitiger Fallback, falls eine Anfrage von den Sicherheitsklassifikatoren abgelehnt wird
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }

let client = null
export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
}
function getClient() {
  if (!client) client = new Anthropic()
  return client
}

function assertNotRefused(msg) {
  if (msg.stop_reason === 'refusal') {
    const err = new Error('Die KI konnte diese Anfrage nicht bearbeiten.')
    err.status = 422
    throw err
  }
}

// ---------- Fotoerkennung ----------
const PhotoSchema = z.object({
  is_food: z.boolean().describe('false, wenn auf dem Bild kein Essen zu sehen ist'),
  dish: z.string().describe('Deutscher Name des erkannten Gerichts, z. B. "Hähnchen mit Reis und Brokkoli"'),
  confidence: z.enum(['hoch', 'mittel', 'niedrig']),
  items: z.array(z.object({
    name: z.string().describe('Deutscher Name des Lebensmittels'),
    grams: z.number().describe('Geschätzte Menge in Gramm (bzw. ml) auf dem Teller'),
    kcal: z.number(), protein: z.number(), carbs: z.number(), fat: z.number(), sugar: z.number(), fiber: z.number(),
  })),
  notes: z.string().describe('Kurzer Hinweis zur Schätzung, z. B. versteckte Fette oder Unsicherheiten'),
})

export async function analyzePhoto({ imageBase64, mediaType = 'image/jpeg', hint = '' }) {
  const msg = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: 'medium', format: betaZodOutputFormat(PhotoSchema) },
    system: 'Du bist ein erfahrener Ernährungswissenschaftler. Du analysierst Fotos von Mahlzeiten, erkennst jedes sichtbare Lebensmittel, schätzt die Portionsgröße anhand von Tellergröße, Besteck und typischen Portionen und berechnest die Nährwerte mit Referenzwerten (z. B. Bundeslebensmittelschlüssel). Berücksichtige Zubereitungsfett und Saucen. Antworte ausschließlich auf Deutsch.',
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: `Analysiere diese Mahlzeit: erkenne alle Lebensmittel, schätze die Mengen und berechne Kalorien, Protein, Kohlenhydrate, Fett, Zucker und Ballaststoffe pro Lebensmittel.${hint ? ` Hinweis des Nutzers: ${hint}` : ''}` },
      ],
    }],
  })
  assertNotRefused(msg)
  if (!msg.parsed_output) throw Object.assign(new Error('Die Analyse konnte nicht gelesen werden.'), { status: 502 })
  return msg.parsed_output
}

// ---------- Verpacktes Produkt ----------
const ProductSchema = z.object({
  is_product: z.boolean(), name: z.string(), brand: z.string().nullable(), ean: z.string().nullable(),
  source: z.enum(['etikett', 'bekannt', 'geschätzt']), confidence: z.enum(['hoch', 'mittel', 'niedrig']),
  per100: z.object({ kcal: z.number(), protein: z.number(), carbs: z.number(), sugar: z.number(), fat: z.number(), fiber: z.number() }),
  unit: z.enum(['g', 'ml']), portion: z.object({ label: z.string(), grams: z.number() }).nullable(), package_grams: z.number().nullable(), notes: z.string(),
})

export async function readProduct({ imageBase64, mediaType = 'image/jpeg' }) {
  const msg = await getClient().beta.messages.parse({
    model: MODEL, max_tokens: 8000, ...FALLBACK,
    output_config: { effort: 'low', format: betaZodOutputFormat(ProductSchema) },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
      { type: 'text', text: 'Erkenne dieses verpackte Lebensmittel (Marke, Name, Sorte). Ist eine Nährwerttabelle sichtbar, lies die Werte pro 100 g/ml exakt ab (source "etikett"), sonst nutze bekannte Herstellerangaben ("bekannt") oder schätze ("geschätzt"). Lies Portionsgröße, Packungsinhalt und EAN, wenn sichtbar. Texte auf Deutsch.' },
    ] }],
  })
  assertNotRefused(msg)
  if (!msg.parsed_output) throw Object.assign(new Error('Produkt konnte nicht erkannt werden.'), { status: 502 })
  return msg.parsed_output
}

// ---------- Kassenbon lesen ----------
const ReceiptSchema = z.object({
  store: z.string().nullable(),
  date: z.string().nullable(),
  items: z.array(z.object({ name: z.string(), key: z.string().nullable(), price: z.number(), amount: z.number(), unit: z.enum(['g', 'kg', 'ml', 'l', 'Stück', 'Packung']) })),
  total: z.number().nullable(),
})

export async function readReceipt({ imageBase64, mediaType = 'image/jpeg' }) {
  const keys = FOOD_LIST.map(f => `${f.key}=${f.name}`).join('; ')
  const msg = await getClient().beta.messages.parse({
    model: MODEL, max_tokens: 16000, ...FALLBACK,
    output_config: { effort: 'low', format: betaZodOutputFormat(ReceiptSchema) },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
      { type: 'text', text: `Lies diesen deutschen Kassenbon: jede Artikelzeile mit bezahltem Preis, geschätzter Menge (amount + unit) und – wenn möglich – Schlüssel aus dieser Datenbank (sonst null): ${keys}. store = Supermarktkette.` },
    ] }],
  })
  assertNotRefused(msg)
  if (!msg.parsed_output) throw Object.assign(new Error('Kassenbon konnte nicht gelesen werden.'), { status: 502 })
  return msg.parsed_output
}

// ---------- KI-Ernährungsberater ----------
export async function coach({ question, history = [], context }) {
  const system = `Du bist "Kalora Coach", ein freundlicher, kompetenter Ernährungsberater in der App KALORA.
Antworte auf Deutsch, persönlich (duzen), konkret und umsetzbar. Nutze die Daten des Nutzers unten und beziehe dich auf konkrete Zahlen.
Wenn du Gerichte vorschlägst, bevorzuge Rezepte aus der Kalora-Rezeptliste (nenne ihren Namen exakt) und berücksichtige Abneigungen strikt.
Halte Antworten kompakt (max. ca. 180 Wörter), nutze kurze Listen. Keine medizinischen Diagnosen; bei Erkrankungen, Essstörungen oder Schwangerschaft empfiehl ärztlichen Rat.

NUTZERDATEN (JSON):
${JSON.stringify(context)}`
  const messages = [
    ...history.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text).slice(0, 4000) })),
    { role: 'user', content: String(question).slice(0, 2000) },
  ]
  // Sicherstellen, dass die Unterhaltung mit "user" beginnt und sich Rollen abwechseln
  while (messages.length && messages[0].role !== 'user') messages.shift()
  const msg = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: 'low' },
    system,
    messages,
  })
  assertNotRefused(msg)
  return msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
}

// ---------- KI-Rezeptgenerator ----------
const FOOD_KEYS = FOOD_LIST.map(f => f.key)
const RecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  meal: z.enum(['F', 'M', 'A', 'S', 'D']).describe('F Frühstück, M Mittagessen, A Abendessen, S Snack, D Dessert'),
  time: z.number().describe('Zubereitungszeit in Minuten'),
  difficulty: z.enum(['Einfach', 'Mittel', 'Anspruchsvoll']),
  ingredients: z.array(z.object({ key: z.enum(FOOD_KEYS), grams: z.number().describe('Menge in Gramm für 1 Portion') })),
  steps: z.array(z.string()),
})

function totals(ingredients) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, s: 0, fi: 0 }
  for (const i of ingredients) {
    const n = nutrientsFor(i.key, i.grams)
    for (const k in t) t[k] += n[k]
  }
  return t
}

export async function generateRecipe(req) {
  const { prompt = '', maxKcal, minProtein, include = '', time, diet = 'alles', meal, dislikes = [] } = req
  const foodTable = FOOD_LIST.map(f => `${f.key}: ${f.name} (${f.kcal} kcal, P ${f.p}, KH ${f.c}, F ${f.f} /100 g)`).join('\n')
  const constraints = [
    maxKcal && `höchstens ${maxKcal} kcal pro Portion`,
    minProtein && `mindestens ${minProtein} g Protein pro Portion`,
    include && `soll diese Zutaten enthalten: ${include}`,
    time && `Zubereitungszeit höchstens ${time} Minuten`,
    diet !== 'alles' && `Ernährungsform: ${diet} (strikt)`,
    meal && `Mahlzeit: ${meal}`,
    dislikes.length && `NIEMALS verwenden (Abneigungen): ${dislikes.join(', ')}`,
  ].filter(Boolean)

  const base = {
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: 'medium', format: betaZodOutputFormat(RecipeSchema) },
    system: `Du bist Koch und Sporternährungsexperte der App KALORA. Erstelle realistische, alltagstaugliche Rezepte für 1 Portion auf Deutsch.
Verwende ausschließlich Zutaten aus dieser Datenbank (Feld "key") – die App berechnet die Nährwerte selbst daraus:
${foodTable}`,
  }
  const messages = [{ role: 'user', content: `Erstelle ein Rezept. Wunsch des Nutzers: "${prompt || 'ein ausgewogenes Gericht'}".\nVorgaben:\n- ${constraints.join('\n- ') || 'keine'}` }]

  let recipe = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await getClient().beta.messages.parse({ ...base, messages })
    assertNotRefused(msg)
    recipe = msg.parsed_output
    if (!recipe) break
    recipe.ingredients = recipe.ingredients.filter(i => FOODS[i.key] && i.grams > 0)
    const t = totals(recipe.ingredients)
    const tooMuch = maxKcal && t.kcal > maxKcal * 1.05
    const tooLittle = minProtein && t.p < minProtein * 0.95
    if (!tooMuch && !tooLittle) break
    // Ein Korrekturdurchgang mit den tatsächlich berechneten Werten
    messages.push({ role: 'assistant', content: JSON.stringify(recipe) })
    messages.push({ role: 'user', content: `Nachgerechnet hat dein Rezept ${Math.round(t.kcal)} kcal und ${Math.round(t.p)} g Protein. Passe die Mengen/Zutaten an, damit alle Vorgaben erfüllt sind.` })
  }
  if (!recipe) throw Object.assign(new Error('Rezept konnte nicht erstellt werden.'), { status: 502 })
  return recipe
}

// ---------- Bild-Konsistenzprüfung (für scripts/verify-images.js) ----------
const ImageCheckSchema = z.object({
  matches: z.boolean().describe('Zeigt das Bild genau dieses Gericht?'),
  visible_main_ingredients: z.array(z.string()),
  missing_main_ingredients: z.array(z.string()),
  portion_ok: z.boolean().describe('Wirkt die Portionsgröße realistisch für die Rezeptmenge?'),
  quality_ok: z.boolean().describe('Ausreichende Bildqualität: scharf, natürliche Farben, keine Artefakte'),
  comment: z.string(),
})

export async function checkRecipeImage({ imageUrl, title, ingredients }) {
  const msg = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: 'low', format: betaZodOutputFormat(ImageCheckSchema) },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: imageUrl } },
        { type: 'text', text: `Prüfe, ob dieses Foto zum Rezept passt.\nRezept: ${title}\nHauptzutaten: ${ingredients.join(', ')}\nAntworte auf Deutsch.` },
      ],
    }],
  })
  assertNotRefused(msg)
  return msg.parsed_output
}
