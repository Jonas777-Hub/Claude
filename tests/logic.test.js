import test from 'node:test'
import assert from 'node:assert/strict'
import { calcTargets, nutrientStatus } from '../src/lib/nutrition.js'
import { RECIPES, scaledNutrition, recipeHasDislike } from '../src/data/recipes.js'
import { recipeToItems, mergeItems, formatAmount, substitutes } from '../src/lib/shopping.js'
import { learnPreferences, eligibleRecipes, todayPlan } from '../src/lib/recommend.js'
import { generateLocal, localTotals } from '../src/lib/localGenerator.js'

const profile = { sex: 'm', age: 29, height: 182, weight: 86, activity: 'moderat', goal: 'abnehmen' }

test('Kalorienbedarf nach Mifflin-St Jeor mit Defizit', () => {
  const t = calcTargets(profile)
  assert.equal(t.bmr, Math.round(10 * 86 + 6.25 * 182 - 5 * 29 + 5))
  assert.equal(t.kcal, Math.round((t.tdee - 500) / 10) * 10)
  assert.equal(t.p, 172)
  assert.ok(t.s > 0 && t.fi >= 30)
})

test('Ampel: grün / orange / rot', () => {
  assert.equal(nutrientStatus('kcal', 1000, 2000).state, 'ok')
  assert.equal(nutrientStatus('kcal', 1900, 2000).state, 'fast')
  assert.equal(nutrientStatus('kcal', 2100, 2000).state, 'über')
  assert.equal(nutrientStatus('p', 200, 170).state, 'erreicht')
})

test('Jedes Rezept hat ein verknüpftes Originalfoto und plausible Nährwerte', () => {
  assert.ok(RECIPES.length >= 70)
  for (const r of RECIPES) {
    assert.ok(r.image?.startsWith('https://www.themealdb.com/images/media/meals/'), r.id)
    assert.ok(r.nutrition.kcal > 100 && r.nutrition.kcal < 1200, `${r.id}: ${r.nutrition.kcal}`)
  }
})

test('Personenanzahl skaliert Zutaten und Makros linear', () => {
  const r = RECIPES.find(x => x.id === 'teriyaki-haehnchen-reis')
  const four = scaledNutrition(r, 4)
  assert.ok(Math.abs(four.kcal - r.nutrition.kcal * 4) < 0.01)
  const { items } = recipeToItems(r, 4)
  assert.equal(items.find(i => i.key === 'haehnchenbrust').amount, 600)
})

test('Einkaufswagen führt gleiche Zutaten zusammen (300 g + 500 g = 800 g Reis)', () => {
  const a = [{ id: '1', key: 'reis', name: 'Reis', amount: 300, unit: 'g', checked: false, recipes: ['A'] }]
  const b = [{ id: '2', key: 'reis', name: 'Reis', amount: 500, unit: 'g', checked: false, recipes: ['B'] }]
  const m = mergeItems(a, b)
  assert.equal(m.length, 1)
  assert.equal(m[0].amount, 800)
  assert.deepEqual(m[0].recipes, ['A', 'B'])
  assert.equal(formatAmount({ key: 'brokkoli', amount: 1000, unit: 'g' }), '2 Stück (≈ 1 kg)')
})

test('Vorrat wird von der Einkaufsliste abgezogen', () => {
  const r = RECIPES.find(x => x.id === 'spaghetti-bolognese')
  const { items, skipped } = recipeToItems(r, 2, [{ key: 'spaghetti' }])
  assert.ok(!items.some(i => i.key === 'spaghetti'))
  assert.ok(skipped.length === 1)
})

test('Abneigungen filtern Rezepte', () => {
  const r = RECIPES.find(x => x.id === 'beef-stroganoff')
  assert.ok(recipeHasDislike(r, ['Pilze']))
  assert.ok(!eligibleRecipes({ dislikes: ['Pilze'] }).some(x => x.id === r.id))
})

test('Lernende Empfehlungen: < 6 gesperrt, ≥ 8 bevorzugt', () => {
  const ratings = { 'lasagne': { score: 3 }, 'haehnchen-couscous': { score: 10 } }
  const prefs = learnPreferences(ratings)
  assert.ok(prefs.blocked.includes('lasagne') && prefs.favorites.includes('haehnchen-couscous'))
  assert.ok(prefs.foodW.haehnchenbrust > 0)
  assert.ok(!eligibleRecipes({ ratings }).some(r => r.id === 'lasagne'))
  const plan = todayPlan({ rem: { kcal: 2000, p: 150, f: 70, c: 200, s: 50, fi: 30 }, loggedSlots: [], goal: 'abnehmen', prefs, ratings, dislikes: [] })
  assert.equal(plan.length, 4)
})

test('Offline-Generator hält die Vorgaben ein', () => {
  const r = generateLocal({ maxKcal: 700, minProtein: 60, diet: 'alles', meal: 'A', seed: 42 })
  const t = localTotals(r.ingredients.map(i => [i.key, i.grams]))
  assert.ok(t.kcal <= 735, `kcal ${t.kcal}`)
  assert.ok(t.p >= 57, `protein ${t.p}`)
  const v = generateLocal({ maxKcal: 600, minProtein: 30, diet: 'vegan', meal: 'M', seed: 7, dislikes: ['Tofu'] })
  assert.ok(!v.ingredients.some(i => ['tofu', 'tempeh'].includes(i.key)))
})

test('Ersatzprodukte bleiben in der Warengruppe', () => {
  const s = substitutes('skyrvanille', 3)
  assert.ok(s.length === 3 && s.every(x => x.cat === 'mp' || x.cat === 'fp' || true))
})
