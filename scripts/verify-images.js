// KI-Konsistenzprüfung der Rezeptbilder mit Claude (Vision):
// Stimmen Bild und Rezept überein? Sind Hauptzutaten sichtbar? Passt die Portion? Ist die Qualität ausreichend?
// Aufruf: ANTHROPIC_API_KEY=... npm run verify-images   → schreibt data/image-check.json
import fs from 'node:fs'
import { RECIPES } from '../src/data/recipes.js'
import { FOODS } from '../src/data/foods.js'
import { aiEnabled, checkRecipeImage } from '../server/ai.js'

if (!aiEnabled()) { console.error('ANTHROPIC_API_KEY fehlt.'); process.exit(1) }
const results = {}
let problems = 0
for (const r of RECIPES) {
  const main = r.mainFoods.map(k => FOODS[k].name)
  try {
    const res = await checkRecipeImage({ imageUrl: r.image, title: r.name, ingredients: main })
    results[r.id] = res
    const ok = res.matches && res.quality_ok && res.portion_ok
    if (!ok) problems++
    console.log(`${ok ? '✔' : '✗'} ${r.name}${ok ? '' : ` – ${res.comment}`}`)
  } catch (e) {
    console.log(`? ${r.name} – ${e.message}`)
  }
}
fs.mkdirSync('data', { recursive: true })
fs.writeFileSync('data/image-check.json', JSON.stringify(results, null, 2))
console.log(`\n${RECIPES.length - problems}/${RECIPES.length} Bilder bestanden. Bericht: data/image-check.json`)
