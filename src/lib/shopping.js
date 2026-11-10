// Einkaufswagen-Logik: Zusammenführen, Mengen, Kosten, Vorrat, Ersatzprodukte, Supermarktvergleich
import { FOODS, FOOD_LIST, CATEGORIES } from '../data/foods.js'

export const UNITS = ['Stück', 'g', 'kg', 'ml', 'l', 'Packung']
const SKIP = new Set(['salz', 'eiswuerfel', 'wasser'])

// Nicht-Lebensmittel und häufige Produkte für Autovervollständigung
export const EXTRA_PRODUCTS = [
  ['Toilettenpapier', 'hh', 'Packung', 3.95], ['Waschmittel', 'hh', 'Packung', 6.95], ['Spülmittel', 'hh', 'Stück', 1.45],
  ['Küchenrolle', 'hh', 'Packung', 2.75], ['Müllbeutel', 'hh', 'Packung', 2.25], ['Zahnpasta', 'hh', 'Stück', 1.95],
  ['Duschgel', 'hh', 'Stück', 1.75], ['Spülmaschinentabs', 'hh', 'Packung', 5.95], ['Alufolie', 'hh', 'Packung', 2.29],
  ['Backpapier', 'hh', 'Packung', 1.49], ['Taschentücher', 'hh', 'Packung', 2.19], ['Batterien', 'hh', 'Packung', 4.99],
  ['Kaffee', 'gt', 'Packung', 6.99], ['Tee', 'gt', 'Packung', 2.29], ['Cola Zero', 'gt', 'l', 1.1], ['Sprudelwasser', 'gt', 'l', 0.39],
  ['Apfelschorle', 'gt', 'l', 1.29], ['Energy Drink zuckerfrei', 'gt', 'Stück', 1.19], ['Kreatin', 'fp', 'Packung', 19.9],
  ['Proteinpulver', 'fp', 'Packung', 29.9], ['Proteinriegel', 'fp', 'Stück', 1.99], ['Protein-Pudding', 'fp', 'Stück', 1.29],
  ['Eier (10er)', 'mp', 'Packung', 2.99], ['Bananen', 'og', 'kg', 1.79], ['Milch', 'mp', 'l', 1.15],
]

export function guessCategory(name) {
  const n = name.toLowerCase()
  const extra = EXTRA_PRODUCTS.find(([p]) => p.toLowerCase() === n)
  if (extra) return extra[1]
  const food = FOOD_LIST.find(f => f.name.toLowerCase().startsWith(n) || n.startsWith(f.name.toLowerCase().split(' ')[0]))
  if (food) return food.cat
  if (/(papier|wasch|spül|reinig|seife|shampoo|deo|müll|folie|tabs|schwamm)/.test(n)) return 'hh'
  if (/(saft|cola|wasser|bier|wein|limo|tee|kaffee|drink|schorle)/.test(n)) return 'gt'
  if (/(protein|whey|kreatin|riegel|shake|bcaa)/.test(n)) return 'fp'
  if (/(milch|joghurt|quark|käse|butter|sahne|skyr|ei)/.test(n)) return 'mp'
  if (/(apfel|banane|salat|tomate|gurke|zwiebel|obst|gemüse|beere|zitrone|kartoffel)/.test(n)) return 'og'
  if (/(fleisch|hähnchen|rind|schwein|fisch|lachs|wurst|hack|thunfisch)/.test(n)) return 'ff'
  return 'so'
}

export function suggestProducts(q, favorites = [], limit = 8) {
  const s = q.trim().toLowerCase()
  if (!s) return []
  const seen = new Set()
  const out = []
  const push = (name, cat, unit, key = null) => {
    const id = name.toLowerCase()
    if (seen.has(id)) return
    seen.add(id)
    out.push({ name, cat, unit, key })
  }
  for (const f of favorites) if (f.name.toLowerCase().includes(s)) push(f.name, f.cat, f.unit, f.key)
  for (const [name, cat, unit] of EXTRA_PRODUCTS) if (name.toLowerCase().includes(s)) push(name, cat, unit)
  for (const f of FOOD_LIST) if (f.name.toLowerCase().includes(s)) push(f.name, f.cat, f.piece ? 'Stück' : 'g', f.key)
  return out.slice(0, limit)
}

let idc = 0
export const newId = () => `${Date.now().toString(36)}${(idc++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function inPantry(pantry = [], key, name) {
  return pantry.some(p => (key && p.key === key) || p.name?.toLowerCase() === (name || FOODS[key]?.name || '').toLowerCase())
}

// Fügt alle Zutaten eines Rezepts dem Einkaufswagen hinzu und führt gleiche Zutaten zusammen
// (300 g Reis + 500 g Reis = 800 g Reis). Vorräte werden automatisch abgezogen.
export function recipeToItems(recipe, persons, pantry = [], actor = 'Ich') {
  const items = []
  const skipped = []
  for (const [key, g] of recipe.ingredients) {
    if (SKIP.has(key)) continue
    const food = FOODS[key]
    if (!food) continue
    if (inPantry(pantry, key)) { skipped.push(food.name); continue }
    items.push({ id: newId(), key, name: food.name, amount: Math.round(g * persons), unit: 'g', cat: food.cat, checked: false, assignee: null, recipes: [recipe.name], addedBy: actor, updatedAt: Date.now() })
  }
  return { items, skipped }
}

export function mergeItems(existing, incoming) {
  const out = existing.map(i => ({ ...i }))
  for (const it of incoming) {
    const match = out.find(e => !e.checked && e.unit === it.unit && ((it.key && e.key === it.key) || (!it.key && !e.key && e.name.toLowerCase() === it.name.toLowerCase())))
    if (match) {
      match.amount = Math.round((Number(match.amount) || 0) + (Number(it.amount) || 0))
      match.recipes = [...new Set([...(match.recipes || []), ...(it.recipes || [])])]
      match.updatedAt = Date.now()
    } else out.push(it)
  }
  return out
}

export function formatAmount(item) {
  const food = item.key ? FOODS[item.key] : null
  const a = Number(item.amount) || 0
  if (item.unit === 'g' || item.unit === 'ml') {
    const big = item.unit === 'g' ? 'kg' : 'l'
    const base = a >= 1000 ? `${(a / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${big}` : `${Math.round(a)} ${item.unit}`
    if (food?.piece && food.piece >= 40) {
      const pcs = Math.max(1, Math.ceil(a / food.piece - 0.15))
      return `${pcs} Stück (≈ ${base})`
    }
    return base
  }
  return `${a.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${item.unit}`
}

// ---- Echte Preise (vom Kassenbon oder selbst eingetragen) ----
// prices: { [priceKey]: { perKg?: €/kg, perUnit?: €/Stück|Packung|l, store?, date, name } }
export const priceKey = item => (item.key ? `k:${item.key}` : `n:${item.name.trim().toLowerCase()}`)

const massG = item => {
  const a = Number(item.amount) || 0
  const food = item.key ? FOODS[item.key] : null
  if (item.unit === 'g' || item.unit === 'ml') return a
  if (item.unit === 'kg' || item.unit === 'l') return a * 1000
  if (item.unit === 'Stück' && food?.piece) return a * food.piece
  return null
}

export function realCost(item, prices = {}, store = null) {
  const p = prices[priceKey(item)]
  if (!p) return null
  const entry = store && p.byStore?.[store] ? p.byStore[store] : p
  const g = massG(item)
  if (entry.perKg != null && g != null) return (g / 1000) * entry.perKg
  if (entry.perUnit != null) return (item.unit === 'g' || item.unit === 'ml' ? 1 : Number(item.amount) || 1) * entry.perUnit
  if (entry.perKg != null) return (Number(item.amount) || 1) * entry.perKg * 0.5
  return null
}

// Preis, den der Nutzer für genau diese Menge eingibt → als €/kg bzw. €/Einheit speichern
export function priceFromInput(item, euro, store = null) {
  const g = massG(item)
  const base = g ? { perKg: euro / (g / 1000) } : { perUnit: euro / (Number(item.amount) || 1) }
  return { ...base, store, date: Date.now(), name: item.name }
}

export function mergePrice(prices, key, entry) {
  const prev = prices[key] || {}
  const byStore = { ...(prev.byStore || {}) }
  if (entry.store) byStore[entry.store] = { perKg: entry.perKg, perUnit: entry.perUnit, date: entry.date }
  return { ...prices, [key]: { ...prev, ...entry, byStore } }
}

export function itemCost(item, prices) {
  const real = prices ? realCost(item, prices) : null
  if (real != null) return real
  const food = item.key ? FOODS[item.key] : null
  const a = Number(item.amount) || 0
  if (food) {
    if (item.unit === 'g' || item.unit === 'ml') return (a / 1000) * food.price
    if (item.unit === 'kg' || item.unit === 'l') return a * food.price
    if (item.unit === 'Stück') return ((food.piece || 100) * a / 1000) * food.price
    return a * food.price * 0.5
  }
  const extra = EXTRA_PRODUCTS.find(([p]) => p.toLowerCase() === item.name.toLowerCase())
  if (extra) return a * extra[3]
  return a * (item.unit === 'g' ? 0.008 : item.unit === 'kg' ? 4 : 2)
}

export function cartSummary(items, pantry = [], prices = {}) {
  const open = items.filter(i => !i.checked)
  const recipes = new Set(items.flatMap(i => i.recipes || []))
  const cost = open.reduce((a, i) => a + itemCost(i, prices), 0)
  const real = open.filter(i => realCost(i, prices) != null).length
  return { total: items.length, open: open.length, done: items.length - open.length, recipes: recipes.size, cost, real }
}

export function groupByCategory(items) {
  const groups = {}
  for (const it of items) (groups[it.cat || 'so'] ||= []).push(it)
  return Object.entries(groups)
    .sort((a, b) => Object.keys(CATEGORIES).indexOf(a[0]) - Object.keys(CATEGORIES).indexOf(b[0]))
    .map(([cat, list]) => ({ cat, ...CATEGORIES[cat] || CATEGORIES.so, items: list.sort((x, y) => x.checked - y.checked || x.name.localeCompare(y.name)) }))
}

// Ersatzprodukte mit möglichst identischen Makros (gleiche Warengruppe, nächstgelegener Nährwertvektor)
export function substitutes(key, n = 3, dislikesFilter = () => true) {
  const f = FOODS[key]
  if (!f) return []
  const vec = x => [x.kcal / 100, x.p / 10, x.c / 10, x.f / 10, x.s / 10]
  const v = vec(f)
  return FOOD_LIST
    .filter(o => o.key !== key && o.cat === f.cat && (f.vegan ? o.vegan : f.vegetarian ? o.vegetarian : true) && dislikesFilter(o))
    .map(o => ({ food: o, d: Math.hypot(...vec(o).map((x, i) => x - v[i])) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(({ food, d }) => ({ ...food, similarity: Math.max(0, Math.round(100 - d * 12)) }))
}

// ---- Supermarktvergleich (Schätzung) ----
// Preisniveau relativ zum Durchschnitt und Sortimentsbreite. Echte Live-Preise und -Bestände stellen die
// Händler nicht öffentlich bereit – Kalora schätzt daher transparent auf Basis von Preisindex & Sortiment.
export const CHAINS = {
  Aldi: { priceIndex: 0.9, range: 0.55, color: '#00005f' },
  Lidl: { priceIndex: 0.91, range: 0.6, color: '#0050aa' },
  Netto: { priceIndex: 0.93, range: 0.55, color: '#ffd400' },
  Penny: { priceIndex: 0.93, range: 0.5, color: '#cd1414' },
  Norma: { priceIndex: 0.92, range: 0.45, color: '#c8102e' },
  Kaufland: { priceIndex: 0.97, range: 0.97, color: '#e10915' },
  Globus: { priceIndex: 1.0, range: 0.99, color: '#004b93' },
  Rewe: { priceIndex: 1.08, range: 0.92, color: '#cc071e' },
  Edeka: { priceIndex: 1.12, range: 0.9, color: '#ffd200' },
}

const SPECIALTY = new Set(['sake', 'mirin', 'gailan', 'paneer', 'tempeh', 'shiitake', 'toordal', 'wasserkastanien', 'currypaste', 'tahini', 'paratha', 'hoisin', 'fischsauce', 'austernsauce', 'udon', 'grandmarnier', 'pakchoi', 'edamame', 'sushireis', 'pecorino', 'tafelspitz', 'rinderfilet', 'thunfischsteak', 'veganprotein', 'harissa', 'pastinake', 'knollensellerie', 'pekannuesse', 'ghee', 'sprossen', 'kondensmilch'])

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}

export function chainAvailability(chain, items) {
  const c = CHAINS[chain]
  if (!c || !items.length) return { pct: 100, missing: [] }
  const missing = []
  for (const it of items) {
    const special = it.key ? SPECIALTY.has(it.key) : it.cat === 'fp'
    const p = special ? c.range * 0.9 : Math.min(1, 0.9 + c.range * 0.12)
    if (hash(chain + (it.key || it.name)) > p) missing.push(it)
  }
  return { pct: Math.round(((items.length - missing.length) / items.length) * 100), missing }
}

export function chainPrice(chain, items, prices = {}) {
  const c = CHAINS[chain]
  let realCount = 0
  const total = items.reduce((a, it) => {
    const own = realCost(it, prices, chain)
    const atStore = prices[priceKey(it)]?.byStore?.[chain]
    if (own != null && atStore) { realCount++; return a + own }
    if (own != null) { realCount++; const p = prices[priceKey(it)]; const k = p.store && CHAINS[p.store] ? (c?.priceIndex ?? 1) / CHAINS[p.store].priceIndex : 1; return a + own * k }
    return a + itemCost(it) * (c?.priceIndex ?? 1) * (0.96 + hash(chain + it.name + 'p') * 0.08)
  }, 0)
  return { total, realCount }
}

export function detectChain(name = '', brand = '') {
  const s = `${brand} ${name}`.toLowerCase()
  return Object.keys(CHAINS).find(c => s.includes(c.toLowerCase())) || null
}

export function rankStores(stores, items, prices = {}) {
  const open = items.filter(i => !i.checked)
  const enriched = stores.map(s => {
    const avail = chainAvailability(s.chain, open)
    const pr = chainPrice(s.chain, open, prices)
    return { ...s, availability: avail.pct, missing: avail.missing, price: pr.total, realCount: pr.realCount }
  })
  const maxD = Math.max(...enriched.map(s => s.distance), 1)
  const ps = enriched.map(s => s.price)
  const minP = Math.min(...ps), maxP = Math.max(...ps)
  for (const s of enriched) {
    const pNorm = maxP > minP ? (s.price - minP) / (maxP - minP) : 0
    s.score = (s.availability / 100) * 0.5 + (1 - pNorm) * 0.3 + (1 - s.distance / maxD) * 0.2
  }
  return enriched.sort((a, b) => b.score - a.score)
}

export function haversine(a, b) {
  const R = 6371e3, toRad = x => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function cartToText(items, title = 'Einkaufsliste') {
  const lines = [`🛒 ${title} (Kalora)`]
  for (const g of groupByCategory(items)) {
    lines.push('', `${g.emoji} ${g.name}`)
    for (const it of g.items) lines.push(`${it.checked ? '✅' : '⬜'} ${formatAmount(it)} ${it.name}${it.assignee ? ` (${it.assignee})` : ''}`)
  }
  return lines.join('\n')
}
