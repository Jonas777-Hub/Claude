// Erzeugt src/data/mealImages.js aus TheMealDB (lookup.php?i=<id>) für alle Rezepte
// und prüft, dass jedes Bild erreichbar ist. Aufruf: node scripts/build-meal-images.js
import fs from 'node:fs'

const src = ['recipes.js', 'recipes2.js'].map(f => fs.readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8')).join('\n')
const ids = [...new Set([...src.matchAll(/R\('[^']+', '(\d+)'/g)].map(m => m[1]))]
const out = {}
let failed = 0
for (const id of ids) {
  const res = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`)
  const meal = (await res.json()).meals?.[0]
  if (!meal) { console.error('Kein Gericht für', id); failed++; continue }
  const head = await fetch(meal.strMealThumb, { method: 'HEAD' })
  if (!head.ok) { console.error('Bild nicht erreichbar', id, meal.strMealThumb); failed++; continue }
  out[id] = { name: meal.strMeal, url: meal.strMealThumb }
  console.log('✔', id, meal.strMeal)
}
const file = `// Automatisch erzeugt von scripts/build-meal-images.js – nicht von Hand bearbeiten.\n// Originalfotos der jeweiligen Gerichte von TheMealDB (https://www.themealdb.com).\nexport const MEAL_IMAGES = ${JSON.stringify(out, null, 2)}\n`
fs.writeFileSync(new URL('../src/data/mealImages.js', import.meta.url), file)
console.log(`${Object.keys(out).length} Bilder geschrieben, ${failed} Fehler`)
process.exit(failed ? 1 : 0)
