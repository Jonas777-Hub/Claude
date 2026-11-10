import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, Sparkles, X, EyeOff } from 'lucide-react'
import { useStore } from '../store.jsx'
import { useUI } from '../App.jsx'
import { RecipeCard, Sheet } from '../components/ui.jsx'
import { RECIPES, RECIPE_CATEGORIES, recipeHasDislike } from '../data/recipes.js'
import { FOODS } from '../data/foods.js'
import { remaining, sumEntries, todayKey, fmt } from '../lib/nutrition.js'
import { learnPreferences, rankRecipes, scoreRecipe } from '../lib/recommend.js'

// "Bauteile": Hauptzutaten, nach denen man Gerichte auswählen kann (mit echten Zutatenfotos)
export const INGREDIENT_PICKER = [
  { id: 'haehnchen', label: 'Hähnchen', img: 'haehnchenbrust', keys: ['haehnchenbrust', 'haehnchenschenkel', 'haehnchenkeule', 'haehnchen'] },
  { id: 'rind', label: 'Rind', img: 'rindersteak', keys: ['rinderhack', 'rindersteak', 'rinderfilet', 'rindergulasch', 'tafelspitz'] },
  { id: 'schwein', label: 'Schwein', img: 'schweinekotelett', keys: ['schweinehack', 'schweinenacken', 'schweinekotelett', 'bacon', 'chorizo', 'bratwurst'] },
  { id: 'lachs', label: 'Lachs & Fisch', img: 'lachs', keys: ['lachs', 'raeucherlachs', 'thunfisch', 'thunfischsteak', 'weisserfisch'] },
  { id: 'garnelen', label: 'Garnelen', img: 'garnelen', keys: ['garnelen'] },
  { id: 'eier', label: 'Eier', img: 'ei', keys: ['ei'] },
  { id: 'tofu', label: 'Tofu & Tempeh', img: 'tofu', keys: ['tofu', 'tempeh'] },
  { id: 'reis', label: 'Reis', img: 'reis', keys: ['reis', 'vollkornreis', 'jasminreis'] },
  { id: 'nudeln', label: 'Nudeln', img: 'spaghetti', keys: ['spaghetti', 'penne', 'farfalle', 'bandnudeln', 'lasagneplatten', 'reisnudeln', 'udon'] },
  { id: 'kartoffeln', label: 'Kartoffeln', img: 'kartoffel', keys: ['kartoffel', 'drillinge', 'suesskartoffel'] },
  { id: 'huelsen', label: 'Hülsenfrüchte', img: 'kichererbsen', keys: ['kichererbsen', 'kidneybohnen', 'schwarzebohnen', 'borlottibohnen', 'linsenrot', 'linsenbraun', 'toordal', 'edamame'] },
  { id: 'brokkoli', label: 'Brokkoli', img: 'brokkoli', keys: ['brokkoli', 'gailan'] },
  { id: 'avocado', label: 'Avocado', img: 'avocado', keys: ['avocado'] },
  { id: 'kaese', label: 'Käse', img: 'feta', keys: ['feta', 'mozzarella', 'parmesan', 'cheddar', 'bergkaese', 'huettenkaese', 'paneer', 'reibekaese'] },
  { id: 'quark', label: 'Quark & Joghurt', img: 'griechjoghurt', keys: ['magerquark', 'skyr', 'griechjoghurt', 'mascarpone'] },
  { id: 'beeren', label: 'Obst & Beeren', img: 'himbeeren', keys: ['himbeeren', 'heidelbeeren', 'erdbeeren', 'brombeeren', 'banane', 'mango', 'apfel'] },
]

const SYNONYMS = {
  hähnchen: ['haehnchen'], huhn: ['haehnchen'], chicken: ['haehnchen'], hühnchen: ['haehnchen'], pute: ['haehnchen'],
  rind: ['rind'], beef: ['rind'], steak: ['rind'], hack: ['rind', 'schwein'], fleisch: ['rind', 'schwein', 'haehnchen'],
  fisch: ['lachs'], lachs: ['lachs'], thunfisch: ['lachs'], garnelen: ['garnelen'], shrimps: ['garnelen'], ei: ['eier'], eier: ['eier'],
  reis: ['reis'], nudeln: ['nudeln'], pasta: ['nudeln'], spaghetti: ['nudeln'], kartoffeln: ['kartoffeln'], kartoffel: ['kartoffeln'],
  tofu: ['tofu'], linsen: ['huelsen'], bohnen: ['huelsen'], käse: ['kaese'], quark: ['quark'], joghurt: ['quark'], obst: ['beeren'],
}
const EXAMPLES = ['Hähnchen', 'Reis', 'Nudeln', 'Kartoffeln', 'Pizza', 'Protein']

const KCAL = [{ id: 'lt300', label: 'unter 300 kcal', f: k => k < 300 }, { id: '300-500', label: '300–500 kcal', f: k => k >= 300 && k <= 500 }, { id: '500-700', label: '500–700 kcal', f: k => k > 500 && k <= 700 }, { id: 'gt700', label: 'über 700 kcal', f: k => k > 700 }]
const PROTEIN = [{ id: 20, label: 'über 20 g' }, { id: 40, label: 'über 40 g' }, { id: 60, label: 'über 60 g' }]
const TIME = [{ id: 'lt15', label: 'unter 15 Min.', f: t => t < 15 }, { id: '15-30', label: '15–30 Min.', f: t => t >= 15 && t <= 30 }, { id: 'gt30', label: 'über 30 Min.', f: t => t > 30 }]
const DIET = [{ id: 'alles', label: 'Alles' }, { id: 'vegetarisch', label: 'Vegetarisch' }, { id: 'vegan', label: 'Vegan' }]
const SORT = [{ id: 'empfohlen', label: 'Für meine Ziele empfohlen' }, { id: 'protein', label: 'Höchster Proteinanteil' }, { id: 'kcal', label: 'Niedrigste Kalorien' }, { id: 'rating', label: 'Beste Bewertung' }, { id: 'zeit', label: 'Schnellste Zubereitung' }]
const MEALS = [{ id: null, label: 'Alle' }, { id: 'F', label: 'Frühstück' }, { id: 'M', label: 'Mittagessen' }, { id: 'A', label: 'Abendessen' }, { id: 'D', label: 'Dessert' }, { id: 'S', label: 'Snack' }]

export default function Recipes() {
  const { state, targets } = useStore()
  const { open } = useUI()
  const [q, setQ] = useState('')
  const [meal, setMeal] = useState(null)
  const [ingredient, setIngredient] = useState(null)
  const [cat, setCat] = useState(null)
  const [f, setF] = useState({ kcal: null, protein: null, time: null, diet: 'alles', sort: 'empfohlen' })
  const [showFilters, setShowFilters] = useState(false)
  const [showHidden, setShowHidden] = useState(false)

  const consumed = sumEntries(state.log[todayKey()] || [])
  const rem = remaining(targets, consumed)
  const prefs = useMemo(() => learnPreferences(state.ratings, state.cooked), [state.ratings, state.cooked])
  // Ziel einer Mahlzeit: offene Makros, aber höchstens ~45 % des Tagesziels (sonst "alles auf einmal")
  const mealTarget = useMemo(() => ({
    kcal: Math.max(250, Math.min(rem.kcal, targets.kcal * 0.45)), p: Math.max(15, Math.min(rem.p, targets.p * 0.5)),
    f: Math.min(rem.f, targets.f * 0.45), s: rem.s,
  }), [rem.kcal, rem.p, rem.f, rem.s, targets])

  const all = useMemo(() => [...RECIPES, ...state.customRecipes], [state.customRecipes])
  const ctx = { target: mealTarget, goal: state.profile.goal, prefs, ratings: state.ratings }

  const { list, hidden } = useMemo(() => {
    const s = q.trim().toLowerCase()
    const synGroups = Object.entries(SYNONYMS).filter(([k]) => s && (k.startsWith(s) || s.startsWith(k))).flatMap(([, v]) => v)
    const synKeys = INGREDIENT_PICKER.filter(g => synGroups.includes(g.id)).flatMap(g => g.keys)
    const ingKeys = ingredient ? INGREDIENT_PICKER.find(g => g.id === ingredient).keys : null
    let hiddenCount = 0
    const out = all.filter(r => {
      if (meal && !r.meals.includes(meal)) return false
      if (cat && !(r.meals.includes(cat) || r.tags.includes(cat) || r.cuisine === cat)) return false
      if (ingKeys && !r.ingredients.some(([k]) => ingKeys.includes(k))) return false
      if (f.kcal && !KCAL.find(x => x.id === f.kcal).f(r.nutrition.kcal)) return false
      if (f.protein && r.nutrition.p <= f.protein) return false
      if (f.time && !TIME.find(x => x.id === f.time).f(r.time)) return false
      if (f.diet === 'vegan' && r.diet !== 'vegan') return false
      if (f.diet === 'vegetarisch' && r.diet === 'alles') return false
      if (s) {
        const hay = `${r.name} ${r.desc} ${r.tags.join(' ')} ${r.ingredients.map(([k]) => FOODS[k]?.name).join(' ')}`.toLowerCase()
        const proteinQuery = s.startsWith('protein') && r.tags.includes('highprotein')
        if (!hay.includes(s) && !proteinQuery && !r.ingredients.some(([k]) => synKeys.includes(k))) return false
      }
      const blocked = recipeHasDislike(r, state.dislikes) || state.ratings[r.id]?.score < 6
      if (blocked && !showHidden) { hiddenCount++; return false }
      return true
    })
    const scored = out.map(r => ({ recipe: r, ...scoreRecipe(r, ctx) }))
    const by = {
      empfohlen: (a, b) => b.score - a.score,
      protein: (a, b) => (b.recipe.nutrition.p * 4) / b.recipe.nutrition.kcal - (a.recipe.nutrition.p * 4) / a.recipe.nutrition.kcal,
      kcal: (a, b) => a.recipe.nutrition.kcal - b.recipe.nutrition.kcal,
      rating: (a, b) => (state.ratings[b.recipe.id]?.score || 0) - (state.ratings[a.recipe.id]?.score || 0) || b.score - a.score,
      zeit: (a, b) => a.recipe.time - b.recipe.time,
    }[f.sort]
    return { list: scored.sort(by), hidden: hiddenCount }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, q, meal, cat, ingredient, f, state.dislikes, state.ratings, showHidden, mealTarget, prefs])

  const recommended = useMemo(() => rankRecipes(all.filter(r => !recipeHasDislike(r, state.dislikes) && !(state.ratings[r.id]?.score < 6) && !r.meals.every(m => m === 'D')), ctx).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, state.dislikes, state.ratings, mealTarget, prefs])

  const activeFilters = [f.kcal, f.protein, f.time, f.diet !== 'alles' && f.diet].filter(Boolean).length
  const filtering = q || meal || ingredient || cat || activeFilters

  return (
    <div className="page">
      <header className="topbar">
        <div><div className="sub">{all.length} Rezepte · echte Fotos</div><h1>Rezepte</h1></div>
        <button className="btn primary sm" onClick={() => open('generator')}><Sparkles size={16} /> Eigenes Rezept</button>
      </header>

      <div className="search"><Search size={18} /><input className="input" placeholder="Worauf hast du Lust?" value={q} onChange={e => setQ(e.target.value)} aria-label="Rezepte suchen" />
        {q && <button className="icon-btn sm plain" style={{ position: 'absolute', right: 6, top: 9 }} onClick={() => setQ('')} aria-label="Suche leeren"><X size={16} /></button>}
      </div>
      {!q && <div className="chips mt-s">{EXAMPLES.map(e => <button key={e} className="chip" style={{ height: 30, fontSize: 13 }} onClick={() => setQ(e)}>{e}</button>)}</div>}

      {/* Oberes Filtermenü */}
      <div className="row mt" style={{ gap: 8 }}>
        <div className="chips" style={{ flex: 1 }}>
          {MEALS.map(m => <button key={String(m.id)} className={`chip ${meal === m.id ? 'active' : ''}`} onClick={() => setMeal(m.id)}>{m.label}</button>)}
        </div>
        <button className="icon-btn" onClick={() => setShowFilters(true)} aria-label="Filter & Sortierung" style={{ position: 'relative' }}>
          <SlidersHorizontal size={18} />
          {activeFilters > 0 && <span className="badge" style={{ position: 'absolute', top: -6, right: -6, background: 'var(--green)', color: '#fff', padding: '1px 6px' }}>{activeFilters}</span>}
        </button>
      </div>

      {/* Zutat wählen */}
      <h2 className="section-title" style={{ marginTop: 18 }}>Was möchtest du essen?
        {ingredient && <button className="link" onClick={() => setIngredient(null)}>Zurücksetzen</button>}
      </h2>
      <div className="ingredient-grid">
        {INGREDIENT_PICKER.map(g => (
          <button key={g.id} className={`ingredient ${ingredient === g.id ? 'active' : ''}`} onClick={() => setIngredient(ingredient === g.id ? null : g.id)} aria-pressed={ingredient === g.id}>
            <img src={FOODS[g.img].image} alt="" loading="lazy" />
            {g.label}
          </button>
        ))}
      </div>

      <div className="chips mt">
        {RECIPE_CATEGORIES.filter(c => !['F', 'M', 'A', 'S', 'D'].includes(c.id)).map(c => (
          <button key={c.id} className={`chip ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.emoji} {c.label}</button>
        ))}
      </div>

      {!filtering && (
        <>
          <h2 className="section-title"><span className="row" style={{ gap: 8 }}><Sparkles size={20} color="var(--green)" /> Passt zu deinen offenen Makros</span></h2>
          <p className="small muted" style={{ margin: '-6px 2px 12px' }}>Noch offen: <b>{fmt(rem.kcal)} kcal</b> · <b>{fmt(rem.p)} g Protein</b> · <b>{fmt(rem.f)} g Fett</b>{prefs.topFoods.length ? ` · Kalora lernt: du magst ${prefs.topFoods.slice(0, 2).map(k => FOODS[k]?.name.split(' ')[0]).join(' & ')}` : ''}</p>
          <div className="h-scroll">
            {recommended.map(({ recipe, fit }) => <RecipeCard key={recipe.id} recipe={recipe} match={fit} rating={state.ratings[recipe.id]?.score} saved={state.saved.includes(recipe.id)} onClick={() => open('recipe', { id: recipe.id })} />)}
          </div>
        </>
      )}

      <h2 className="section-title">
        {filtering ? `${list.length} passende Rezepte` : 'Alle Rezepte'}
        <span className="small muted">{SORT.find(s => s.id === f.sort).label}</span>
      </h2>
      {hidden > 0 && (
        <button className="row small muted" style={{ gap: 6, margin: '-4px 2px 12px' }} onClick={() => setShowHidden(true)}>
          <EyeOff size={14} /> {hidden} Rezept{hidden > 1 ? 'e' : ''} ausgeblendet (Abneigungen oder Bewertung unter 6) – anzeigen
        </button>
      )}
      {list.length === 0 ? (
        <div className="empty"><div className="em">🔍</div><div className="bold" style={{ color: 'var(--text)' }}>Keine passenden Rezepte</div>
          <p className="small mt-s">Lockere die Filter oder lass dir eins generieren.</p>
          <button className="btn primary mt" onClick={() => open('generator', { prefill: q })}><Sparkles size={16} /> Rezept mit KI erstellen</button>
        </div>
      ) : (
        <div className="recipe-grid">
          {list.map(({ recipe, fit }) => <RecipeCard key={recipe.id} recipe={recipe} match={f.sort === 'empfohlen' ? fit : null} rating={state.ratings[recipe.id]?.score} saved={state.saved.includes(recipe.id)} onClick={() => open('recipe', { id: recipe.id })} />)}
        </div>
      )}
      <p className="tiny muted center mt-l">Rezeptfotos: Originalfotos der jeweiligen Gerichte von TheMealDB.com</p>

      {showFilters && (
        <Sheet title="Filter & Sortierung" onClose={() => setShowFilters(false)}>
          <FilterGroup title="Kalorien pro Portion" options={KCAL} value={f.kcal} onChange={v => setF({ ...f, kcal: v })} />
          <FilterGroup title="Protein pro Portion" options={PROTEIN} value={f.protein} onChange={v => setF({ ...f, protein: v })} />
          <FilterGroup title="Kochzeit" options={TIME} value={f.time} onChange={v => setF({ ...f, time: v })} />
          <FilterGroup title="Ernährungsform" options={DIET} value={f.diet} onChange={v => setF({ ...f, diet: v || 'alles' })} />
          <div className="small bold text-2 mt">Sortieren nach</div>
          <div className="col mt-s" style={{ gap: 8 }}>
            {SORT.map(s => <button key={s.id} className={`choice ${f.sort === s.id ? 'active' : ''}`} style={{ padding: 12 }} onClick={() => setF({ ...f, sort: s.id })}><span className="t" style={{ fontSize: 15 }}>{s.label}</span></button>)}
          </div>
          <div className="row mt">
            <button className="btn" style={{ flex: 1 }} onClick={() => setF({ kcal: null, protein: null, time: null, diet: 'alles', sort: 'empfohlen' })}>Zurücksetzen</button>
            <button className="btn primary" style={{ flex: 1 }} onClick={() => setShowFilters(false)}>{list.length} Rezepte anzeigen</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function FilterGroup({ title, options, value, onChange }) {
  return (
    <div className="mt">
      <div className="small bold text-2">{title}</div>
      <div className="chips wrap mt-s">
        {options.map(o => <button key={o.id} className={`chip green ${value === o.id ? 'active' : ''}`} onClick={() => onChange(value === o.id ? null : o.id)}>{o.label}</button>)}
      </div>
    </div>
  )
}
