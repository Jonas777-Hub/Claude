// Intelligente, lernende Rezeptempfehlungen
// - Makro-Fit: wie gut passt ein Rezept zu den noch offenen Kalorien/Makros
// - Ziel-Bonus: Abnehmen → Proteindichte, Muskelaufbau → Proteinmenge
// - Lernen aus Bewertungen: 8–10 häufiger, 6–7 normal, < 6 nicht mehr aktiv empfehlen
// - Ähnlichkeit: Lieblingszutaten, -kategorien und -küchen werden bevorzugt
import { RECIPES, recipeHasDislike } from '../data/recipes.js'
import { SLOTS } from './nutrition.js'

export function learnPreferences(ratings = {}, cooked = {}) {
  const foodW = {}, tagW = {}, cuisineW = {}
  const favorites = [], blocked = []
  const byId = Object.fromEntries(RECIPES.map(r => [r.id, r]))
  for (const [id, rating] of Object.entries(ratings)) {
    const r = byId[id]
    if (!r || !rating?.score) continue
    const w = (rating.score - 6.5) / 3.5
    if (rating.score >= 8) favorites.push(id)
    if (rating.score < 6) blocked.push(id)
    for (const k of r.mainFoods) foodW[k] = (foodW[k] || 0) + w
    for (const t of r.tags) tagW[t] = (tagW[t] || 0) + w * 0.5
    for (const m of r.meals) tagW['meal:' + m] = (tagW['meal:' + m] || 0) + w * 0.2
    cuisineW[r.cuisine] = (cuisineW[r.cuisine] || 0) + w * 0.6
  }
  for (const [id, n] of Object.entries(cooked)) {
    const r = byId[id]
    if (!r || ratings[id]) continue
    for (const k of r.mainFoods) foodW[k] = (foodW[k] || 0) + 0.15 * n
  }
  const top = (obj, n = 5) => Object.entries(obj).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k)
  return { foodW, tagW, cuisineW, favorites, blocked, topFoods: top(foodW), topTags: top(tagW).filter(t => !t.startsWith('meal:')), topCuisines: top(cuisineW, 3) }
}

function preferenceScore(r, prefs) {
  if (!prefs) return 0
  let s = 0
  for (const k of r.mainFoods) s += prefs.foodW[k] || 0
  for (const t of r.tags) s += prefs.tagW[t] || 0
  s += prefs.cuisineW[r.cuisine] || 0
  return Math.tanh(s / 3) // -1 … 1
}

export function macroFit(n, target) {
  if (!target || !target.kcal) return 0.5
  const kcalDiff = Math.abs(n.kcal - target.kcal) / Math.max(target.kcal, 250)
  const pDeficit = target.p ? Math.max(0, target.p - n.p) / Math.max(target.p, 15) : 0
  const fOver = target.f != null ? Math.max(0, n.f - target.f) / Math.max(target.f, 10) : 0
  const sOver = target.s != null ? Math.max(0, n.s - target.s) / Math.max(target.s, 8) : 0
  let fit = 1 - Math.min(1, 0.5 * kcalDiff + 0.3 * pDeficit + 0.12 * fOver + 0.08 * sOver)
  if (n.kcal > target.kcal * 1.25) fit *= 0.6
  return Math.max(0, fit)
}

export function scoreRecipe(r, ctx) {
  const { target, goal, prefs, ratings = {} } = ctx
  const n = r.nutrition
  const fit = macroFit(n, target)
  const pDensity = n.kcal ? (n.p * 4) / n.kcal : 0
  let goalBonus = 0
  if (goal === 'abnehmen') goalBonus = Math.min(1, pDensity / 0.35) * 0.7 + (n.fi >= 8 ? 0.3 : 0)
  else if (goal === 'aufbau') goalBonus = Math.min(1, n.p / 45)
  else goalBonus = 0.5 + (n.fi >= 8 ? 0.25 : 0) - (n.s > 25 ? 0.25 : 0)
  const pref = preferenceScore(r, prefs)
  const own = ratings[r.id]?.score
  const ratingBoost = own >= 8 ? 0.15 + (own - 8) * 0.05 : 0
  const score = fit * 0.6 + goalBonus * 0.15 + pref * 0.15 + ratingBoost
  const reasons = []
  if (target?.kcal && fit >= 0.8) reasons.push('Passt sehr gut zu deinen offenen Makros')
  else if (target?.kcal && fit >= 0.6) reasons.push('Passt gut zu deinen offenen Makros')
  if (target?.p && n.p >= target.p * 0.8) reasons.push(`Deckt ${Math.min(100, Math.round((n.p / target.p) * 100))} % deines offenen Proteins`)
  if (own >= 8) reasons.push(`Von dir mit ${own}/10 bewertet`)
  else if (pref > 0.25) reasons.push('Ähnlich zu Rezepten, die dir geschmeckt haben')
  if (goal === 'abnehmen' && pDensity >= 0.3) reasons.push('Hohe Proteindichte – ideal zum Abnehmen')
  if (goal === 'aufbau' && n.p >= 40) reasons.push('Viel Protein für den Muskelaufbau')
  return { score, fit, reasons }
}

// Liefert empfehlbare Rezepte (Abneigungen & schlecht bewertete Rezepte ausgeschlossen)
export function eligibleRecipes({ dislikes = [], ratings = {}, extra = [] } = {}) {
  return [...RECIPES, ...extra].filter(r => !recipeHasDislike(r, dislikes) && !(ratings[r.id]?.score < 6))
}

export function rankRecipes(recipes, ctx) {
  return recipes
    .map(r => ({ recipe: r, ...scoreRecipe(r, ctx) }))
    .sort((a, b) => b.score - a.score)
}

// Verteilt die offenen Makros auf die noch offenen Mahlzeiten des Tages
export function slotTargets(rem, loggedSlots = []) {
  const open = SLOTS.filter(s => !loggedSlots.includes(s.id))
  const total = open.reduce((a, s) => a + s.share, 0) || 1
  const out = {}
  for (const s of open) {
    const k = s.share / total
    out[s.id] = { kcal: rem.kcal * k, p: rem.p * k, f: rem.f * k, c: rem.c * k, s: rem.s * k, fi: rem.fi * k }
  }
  return out
}

// "Heute essen": je 1 Frühstück, Mittagessen, Abendessen, Snack passend zu den offenen Makros
export function todayPlan({ rem, loggedSlots, goal, prefs, ratings, dislikes, seed = 0 }) {
  const targets = slotTargets(rem, loggedSlots)
  const pool = eligibleRecipes({ dislikes, ratings })
  const used = new Set()
  const plan = []
  for (const slot of SLOTS) {
    const fitsSlot = r => (slot.id === 'S' ? r.meals.includes('S') || r.meals.includes('D') : r.meals.includes(slot.id))
    const ranked = rankRecipes(pool.filter(r => fitsSlot(r) && !used.has(r.id)), { target: targets[slot.id], goal, prefs, ratings })
    // leichte Variation (seed) unter den besten 3, damit "Neu vorschlagen" etwas ändert
    const pick = ranked[Math.min(ranked.length - 1, seed % Math.min(3, ranked.length))]
    if (pick) {
      used.add(pick.recipe.id)
      plan.push({ slot, ...pick, done: loggedSlots.includes(slot.id) })
    }
  }
  return plan
}
