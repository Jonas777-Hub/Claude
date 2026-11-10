// Offline-Rezeptgenerator (ohne KI-Server): baut aus Bausteinen ein Gericht, das die Vorgaben trifft.
import { FOODS, nutrientsFor, foodMatchesDislike } from '../data/foods.js'

const PROTEINS = {
  alles: ['haehnchenbrust', 'putenbrust', 'rindersteak', 'lachs', 'garnelen', 'rinderhack', 'thunfisch', 'tofu', 'ei'],
  vegetarisch: ['tofu', 'tempeh', 'ei', 'huettenkaese', 'paneer', 'kichererbsen', 'feta'],
  vegan: ['tofu', 'tempeh', 'kichererbsen', 'linsenrot', 'edamame', 'schwarzebohnen'],
}
const CARBS = ['reis', 'vollkornreis', 'kartoffel', 'suesskartoffel', 'spaghetti', 'couscous', 'quinoa', 'reisnudeln', 'vollkornbrot']
const VEG = ['brokkoli', 'paprika', 'zucchini', 'spinat', 'kirschtomate', 'pakchoi', 'karotte', 'gruenebohnen', 'champignons', 'erbsen']
const BREAKFAST_BASE = { alles: ['skyr', 'magerquark'], vegetarisch: ['skyr', 'magerquark'], vegan: ['sojamilch'] }

const STYLES = [
  { name: 'Pfanne', sauce: ['sojasauce', 'knoblauch', 'ingwer'], fat: 'rapsoel', steps: (p, c, v) => [`${c} nach Packungsangabe garen.`, `${p} in mundgerechte Stücke schneiden, würzen und in Öl scharf anbraten.`, `${v} zugeben und 4–5 Minuten mitbraten, mit Knoblauch, Ingwer und Sojasauce ablöschen.`, `Alles zusammen anrichten und sofort servieren.`] },
  { name: 'Bowl', sauce: ['zitrone', 'petersilie'], fat: 'olivenoel', steps: (p, c, v) => [`${c} garen und etwas abkühlen lassen.`, `${p} würzen und in Olivenöl braten oder backen.`, `${v} waschen, schneiden und kurz dünsten oder roh verwenden.`, `Alles in einer Schüssel anrichten, mit Zitronensaft und Kräutern verfeinern.`] },
  { name: 'Ofengericht', sauce: ['knoblauch', 'gewuerze'], fat: 'olivenoel', steps: (p, c, v) => [`Ofen auf 200 °C vorheizen.`, `${c} (falls Kartoffeln: in Spalten) und ${v} mit Öl und Gewürzen auf einem Blech verteilen.`, `${p} würzen und nach 10 Minuten dazulegen.`, `Weitere 15–20 Minuten backen, bis alles gar und leicht gebräunt ist.`] },
]

const ok = (key, diet, dislikes) => {
  const f = FOODS[key]
  if (!f) return false
  if (diet === 'vegan' && !f.vegan) return false
  if (diet === 'vegetarisch' && !f.vegetarian) return false
  return !dislikes.some(d => foodMatchesDislike(key, d))
}

function pick(list, include, rnd) {
  const inc = include.map(s => s.toLowerCase()).filter(Boolean)
  const wanted = list.filter(k => inc.some(i => FOODS[k].name.toLowerCase().includes(i)))
  const pool = wanted.length ? wanted : list
  return pool[Math.floor(rnd() * pool.length) % pool.length]
}

function totals(ings) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, s: 0, fi: 0 }
  for (const [k, g] of ings) { const n = nutrientsFor(k, g); for (const x in t) t[x] += n[x] }
  return t
}

export function generateLocal({ maxKcal = 650, minProtein = 35, include = '', time = 30, diet = 'alles', meal = 'A', dislikes = [], seed = Date.now() }) {
  let s = seed % 2147483647
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
  const inc = include.split(/[,;]+/).map(x => x.trim()).filter(Boolean)
  maxKcal = Number(maxKcal) || 650
  minProtein = Number(minProtein) || 0

  if (meal === 'F' || meal === 'S' || meal === 'D') {
    const base = pick(BREAKFAST_BASE[diet].filter(k => ok(k, diet, dislikes)), inc, rnd) || 'skyr'
    const fruit = pick(['himbeeren', 'heidelbeeren', 'erdbeeren', 'banane', 'mango'].filter(k => ok(k, diet, dislikes)), inc, rnd) || 'banane'
    const ings = [[base, 250], ['haferflocken', 40], [fruit, 100], ['mandeln', 10]]
    if (diet === 'vegan') ings.push(['veganprotein', 25])
    else if (minProtein > 30) ings.push(['proteinpulver', 20])
    scaleTo(ings, maxKcal, minProtein, [0, 1])
    return finish({
      title: `${FOODS[base].name.split(' ')[0]}-Bowl mit ${FOODS[fruit].name} & Hafer`,
      description: 'Cremige Protein-Bowl – in 5 Minuten fertig, ideal als Frühstück oder Snack.',
      meal, time: 5, difficulty: 'Einfach', ingredients: ings,
      steps: [`${FOODS[base].name} in eine Schüssel geben${ings.some(i => i[0].includes('protein')) ? ' und das Proteinpulver glatt einrühren' : ''}.`, 'Haferflocken unterheben.', `${FOODS[fruit].name} waschen bzw. schneiden und darauf verteilen.`, 'Mit gehackten Mandeln bestreuen.'],
    })
  }

  const protein = pick(PROTEINS[diet].filter(k => ok(k, diet, dislikes)), inc, rnd)
  const carb = pick(CARBS.filter(k => ok(k, diet, dislikes) && (time >= 25 || !['vollkornreis', 'kartoffel', 'suesskartoffel'].includes(k))), inc, rnd)
  const vegs = VEG.filter(k => ok(k, diet, dislikes))
  const veg1 = pick(vegs, inc, rnd)
  const veg2 = pick(vegs.filter(v => v !== veg1), [], rnd)
  const style = STYLES[(time < 25 ? 0 : Math.floor(rnd() * STYLES.length)) % STYLES.length]
  const ings = [[protein, 150], [carb, 70], [veg1, 150], [veg2, 100], [style.fat, 8], ...style.sauce.filter(k => ok(k, diet, dislikes)).map(k => [k, k === 'sojasauce' ? 15 : k === 'zitrone' ? 15 : 4])]
  scaleTo(ings, maxKcal, minProtein, [0, 1])
  const n = k => FOODS[k].name.split(' (')[0]
  return finish({
    title: `${n(protein)}-${style.name} mit ${n(carb)} & ${n(veg1)}`,
    description: `Ausgewogenes ${style.name.toLowerCase()} – genau auf deine Vorgaben berechnet.`,
    meal, time: Math.min(time || 30, style.name === 'Ofengericht' ? 40 : 25), difficulty: 'Einfach', ingredients: ings,
    steps: style.steps(n(protein), n(carb), `${n(veg1)} und ${n(veg2)}`),
  })
}

// Protein-Menge (Index pi) und Sättigungsbeilage (ci) so skalieren, dass Protein ≥ min und kcal ≤ max
function scaleTo(ings, maxKcal, minProtein, [pi, ci]) {
  for (let i = 0; i < 40; i++) {
    const t = totals(ings)
    if (minProtein && t.p < minProtein) ings[pi][1] += 10
    else if (t.kcal > maxKcal && ings[ci][1] > 20) ings[ci][1] -= 5
    else if (t.kcal > maxKcal) ings[pi][1] = Math.max(60, ings[pi][1] - 10)
    else if (t.kcal < maxKcal * 0.85) ings[ci][1] += 5
    else break
  }
  for (const i of ings) i[1] = Math.round(i[1])
}

function finish(r) {
  return { ...r, ingredients: r.ingredients.map(([key, grams]) => ({ key, grams })) }
}

export { totals as localTotals }
