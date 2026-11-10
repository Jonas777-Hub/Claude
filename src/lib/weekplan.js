// Wochenplan: 7 Tage × Frühstück, Mittag, Abend, Snack – passend zu Zielen, Vorlieben und Abneigungen.
// Nutzt Zutaten mehrfach (weniger Reste) und vermeidet Wiederholungen in kurzen Abständen.
import { SLOTS, todayKey } from './nutrition.js'
import { eligibleRecipes, scoreRecipe } from './recommend.js'

const fits = (r, slot) => (slot === 'S' ? r.meals.includes('S') || r.meals.includes('D') : r.meals.includes(slot))

function rng(seed) { let s = (seed % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647 }

export function slotTarget(targets, slot) {
  const share = SLOTS.find(s => s.id === slot).share
  return { kcal: targets.kcal * share, p: targets.p * share, f: targets.f * share, c: targets.c * share, s: targets.s * share, fi: targets.fi * share }
}

export function buildWeekPlan({ targets, goal, prefs, ratings, dislikes, customRecipes = [], start = todayKey(), seed = Date.now(), keep = {} }) {
  const rand = rng(seed)
  const pool = eligibleRecipes({ dislikes, ratings, extra: customRecipes })
  const usage = {}, lastDay = {}
  const pantry = new Set()
  const days = []
  for (let d = 0; d < 7; d++) {
    const date = new Date(start); date.setDate(date.getDate() + d)
    const key = todayKey(date)
    const meals = {}
    for (const { id: slot } of SLOTS) {
      if (keep[key]?.[slot]) { meals[slot] = keep[key][slot]; continue }
      const target = slotTarget(targets, slot)
      let best = null
      for (const r of pool.filter(r => fits(r, slot))) {
        let sc = scoreRecipe(r, { target, goal, prefs, ratings }).score
        if (lastDay[r.id] != null && d - lastDay[r.id] < 3) sc -= 0.6
        sc -= (usage[r.id] || 0) * 0.35
        // unter der Woche keine aufwendigen Gerichte (Mo–Fr max. ~45 Min., Frühstück max. ~25 Min.)
        const weekday = date.getDay() >= 1 && date.getDay() <= 5
        if (weekday && r.time > (slot === 'F' ? 25 : 45)) sc -= 0.5
        if (!weekday && r.time > 120) sc -= 0.2
        const overlap = r.mainFoods.filter(k => pantry.has(k)).length / r.mainFoods.length
        sc += overlap * 0.12 + rand() * 0.08
        if (!best || sc > best.sc) best = { r, sc }
      }
      if (best) {
        meals[slot] = best.r.id
        usage[best.r.id] = (usage[best.r.id] || 0) + 1
        lastDay[best.r.id] = d
        best.r.mainFoods.forEach(k => pantry.add(k))
      }
    }
    days.push({ date: key, meals })
  }
  return { start, created: Date.now(), days }
}

// Eine Mahlzeit austauschen: nächstbestes Rezept, das in dieser Woche noch selten vorkommt
export function swapMeal(plan, date, slot, ctx) {
  const pool = eligibleRecipes({ dislikes: ctx.dislikes, ratings: ctx.ratings, extra: ctx.customRecipes }).filter(r => fits(r, slot))
  const counts = {}
  plan.days.forEach(d => Object.values(d.meals).forEach(id => { counts[id] = (counts[id] || 0) + 1 }))
  const current = plan.days.find(d => d.date === date)?.meals[slot]
  const target = slotTarget(ctx.targets, slot)
  const ranked = pool.filter(r => r.id !== current)
    .map(r => ({ r, sc: scoreRecipe(r, { target, goal: ctx.goal, prefs: ctx.prefs, ratings: ctx.ratings }).score - (counts[r.id] || 0) * 0.4 + Math.random() * 0.15 }))
    .sort((a, b) => b.sc - a.sc)
  const pick = ranked[0]?.r
  if (!pick) return plan
  return { ...plan, days: plan.days.map(d => (d.date === date ? { ...d, meals: { ...d.meals, [slot]: pick.id } } : d)) }
}
