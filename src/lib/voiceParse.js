// Offline-Auswertung gesprochener Mahlzeiten (ohne KI):
// „zwei Eier, 150 Gramm Reis und ein Apfel" → [{key: 'ei', grams: 120}, {key: 'reis', grams: 150}, {key: 'apfel', grams: 150}]
import { FOODS, FOOD_LIST, searchFoods } from '../data/foods.js'

const NUMWORDS = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, halb: 0.5, halbe: 0.5, halben: 0.5, halbes: 0.5, paar: 2, anderthalb: 1.5, eineinhalb: 1.5 }
const UNITS = [
  [/^(g|gr|gramm)$/, 'g', 1], [/^(kg|kilo|kilogramm)$/, 'g', 1000], [/^(ml|milliliter)$/, 'g', 1], [/^(l|liter)$/, 'g', 1000],
  [/^(el|esslöffel)$/, 'g', 15], [/^(tl|teelöffel)$/, 'g', 5], [/^(scheibe|scheiben)$/, 'scheibe', 1], [/^(glas|gläser)$/, 'g', 250],
  [/^(tasse|tassen)$/, 'g', 200], [/^(becher)$/, 'becher', 1], [/^(schüssel|schale|bowl)$/, 'g', 300], [/^(teller|portion|portionen)$/, 'portion', 1],
  [/^(stück|stk|stücke)$/, 'stück', 1], [/^(handvoll)$/, 'g', 30], [/^(dose|dosen)$/, 'g', 400], [/^(packung|packungen|tüte)$/, 'packung', 1],
]
const SYN = {
  eier: 'ei', ei: 'ei', spiegelei: 'ei', rührei: 'ei', äpfel: 'apfel', apfel: 'apfel', banane: 'banane', bananen: 'banane',
  nudeln: 'spaghetti', pasta: 'spaghetti', spaghetti: 'spaghetti', reis: 'reis', kartoffel: 'kartoffel', kartoffeln: 'kartoffel', pommes: 'kartoffel',
  hähnchen: 'haehnchenbrust', hühnchen: 'haehnchenbrust', huhn: 'haehnchenbrust', chicken: 'haehnchenbrust', hähnchenbrust: 'haehnchenbrust', pute: 'putenbrust',
  brot: 'vollkornbrot', vollkornbrot: 'vollkornbrot', brötchen: 'broetchen', semmel: 'broetchen', toast: 'toastbrot', müsli: 'haferflocken', haferflocken: 'haferflocken',
  milch: 'milch', joghurt: 'naturjoghurt', quark: 'magerquark', skyr: 'skyr', käse: 'bergkaese', butter: 'butter', lachs: 'lachs', thunfisch: 'thunfisch',
  steak: 'rindersteak', hack: 'rinderhack', hackfleisch: 'rinderhack', tomate: 'tomate', tomaten: 'tomate', gurke: 'gurke', salat: 'salat', brokkoli: 'brokkoli',
  avocado: 'avocado', nüsse: 'mandeln', mandeln: 'mandeln', erdnüsse: 'erdnuesse', erdnussbutter: 'erdnussbutter', proteinshake: 'proteinpulver', shake: 'proteinpulver',
  proteinriegel: 'proteinriegel', riegel: 'proteinriegel', cola: 'colazero', wasser: 'wasser', saft: 'orangensaft', orangensaft: 'orangensaft', beeren: 'beerenmix',
  erdbeeren: 'erdbeeren', himbeeren: 'himbeeren', heidelbeeren: 'heidelbeeren', honig: 'honig', schokolade: 'dunkleschokolade', tofu: 'tofu', linsen: 'linsenrot',
}
// Was eine „Portion"/ein „Teller" ungefähr wiegt (roh bei Reis/Nudeln)
const PORTION = { spaghetti: 100, reis: 80, kartoffel: 250, haehnchenbrust: 170, rinderhack: 150, lachs: 150, salat: 150 }
// Übliche Mengen, wenn nichts gesagt wird (Aufstrich, Topping …)
const DEFAULT_G = { butter: 10, bergkaese: 30, cheddar: 30, honig: 20, olivenoel: 10, mayonnaise: 15, ketchup: 20, erdnussbutter: 20, himbeeren: 80, heidelbeeren: 80, beerenmix: 80, mandeln: 25, erdnuesse: 25, cashews: 25, frischkaese: 30, kochschinken: 40, milch: 200 }
// Gesagte Mengen bei Reis/Nudeln sind meist gekocht – Datenbank rechnet mit Rohgewicht
const COOKED = { reis: 2.8, vollkornreis: 2.8, jasminreis: 2.8, spaghetti: 2.3, penne: 2.3, farfalle: 2.3, bandnudeln: 2.3, reisnudeln: 2.5, couscous: 2.5, quinoa: 2.7 }

const STOP = new Set(['und', 'mit', 'dazu', 'noch', 'etwas', 'ein', 'bisschen', 'ich', 'habe', 'hab', 'gegessen', 'getrunken', 'heute', 'zum', 'frühstück', 'mittag', 'mittagessen', 'abendessen', 'snack', 'als', 'von', 'vom', 'der', 'die', 'das', 'den', 'dem', 'gekocht', 'gekochte', 'gekochten', 'gebraten', 'gebratene', 'gebratenen', 'frisch', 'frische', 'große', 'großen', 'kleine', 'kleinen'])

const norm = w => w.toLowerCase().replace(/[^a-zäöüß0-9.,/]/g, '')

function findFood(words) {
  for (const w of words) if (SYN[w]) return FOODS[SYN[w]]
  const phrase = words.join(' ')
  const hit = searchFoods(phrase, 1)[0] || words.map(w => searchFoods(w, 1)[0]).find(Boolean)
  if (hit) return hit
  for (const w of words) { const stem = w.replace(/(en|n|er|e|s)$/, ''); if (stem.length > 2) { const h = searchFoods(stem, 1)[0]; if (h) return h } }
  return null
}

export function parseSpokenMeal(text) {
  const parts = String(text).toLowerCase().replace(/(\d),(\d)/g, '$1.$2').split(/,|;|\bund\b|\bsowie\b|\bplus\b|\bdazu\b|\bmit\b/).map(s => s.trim()).filter(Boolean)
  const items = [], unknown = []
  for (const part of parts) {
    const tokens = part.split(/\s+/).map(norm).filter(Boolean)
    let qty = null, unit = null, factor = 1
    const rest = []
    for (const t of tokens) {
      const num = t.match(/^(\d+(?:\.\d+)?)(g|kg|ml|l)?$/)
      if (num && qty == null) { qty = parseFloat(num[1]); if (num[2]) { const u = UNITS.find(([re]) => re.test(num[2])); unit = u[1]; factor = u[2] } continue }
      if (NUMWORDS[t] != null && qty == null) { qty = NUMWORDS[t]; continue }
      const u = UNITS.find(([re]) => re.test(t))
      if (u && !unit) { unit = u[1]; factor = u[2]; continue }
      if (!STOP.has(t)) rest.push(t)
    }
    if (!rest.length) continue
    const food = findFood(rest)
    if (!food) { unknown.push(rest.join(' ')); continue }
    const n = qty ?? 1
    let grams
    let note = ''
    if (unit === 'g') {
      grams = n * factor
      if (COOKED[food.key]) { note = ` (${Math.round(grams)} g gekocht)`; grams = grams / COOKED[food.key] }
    }
    else if (unit === 'scheibe') grams = n * (food.piece && food.piece <= 60 ? food.piece : 30)
    else if (unit === 'portion') grams = n * (PORTION[food.key] || food.piece || 200)
    else if (unit === 'becher') grams = n * 150
    else if (unit === 'packung') grams = n * (food.piece || 200)
    else if (qty == null && DEFAULT_G[food.key]) grams = DEFAULT_G[food.key]
    else grams = n * (food.piece || (qty == null ? (PORTION[food.key] || 100) : 100))
    items.push({ key: food.key, name: food.name + note, grams: Math.round(grams) })
  }
  return { items, unknown }
}

export const KNOWN_FOOD_COUNT = FOOD_LIST.length
