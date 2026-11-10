import { useState } from 'react'
import { Sparkles, Loader2, Save, RefreshCw } from 'lucide-react'
import { useStore } from '../store.jsx'
import { useUI } from '../App.jsx'
import { Sheet, NutritionTable } from '../components/ui.jsx'
import { api } from '../api.js'
import { useAIStatus } from './PhotoAnalysis.jsx'
import { generateLocal } from '../lib/localGenerator.js'
import { enrich } from '../data/recipes.js'
import { FOODS } from '../data/foods.js'
import { fmt, remaining, sumEntries, todayKey } from '../lib/nutrition.js'
import { newId } from '../lib/shopping.js'

const MEALS = [['F', 'Frühstück'], ['M', 'Mittagessen'], ['A', 'Abendessen'], ['S', 'Snack'], ['D', 'Dessert']]

export default function RecipeGenerator({ onClose, prefill = '' }) {
  const { state, targets, update, notify } = useStore()
  const { open, close } = useUI()
  const ai = useAIStatus()
  const rem = remaining(targets, sumEntries(state.log[todayKey()] || []))
  const [form, setForm] = useState({
    prompt: prefill ? `Etwas mit ${prefill}` : '',
    maxKcal: Math.round(Math.min(Math.max(rem.kcal, 300), 900) / 10) * 10,
    minProtein: Math.round(Math.min(Math.max(rem.p, 20), 70)),
    include: prefill, time: 30, diet: 'alles', meal: 'A',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const run = async (useAI = ai?.enabled) => {
    setLoading(true); setErr('')
    try {
      let raw
      if (useAI) {
        raw = await api('/api/ai/generate-recipe', { method: 'POST', body: { ...form, meal: MEALS.find(m => m[0] === form.meal)[1], dislikes: state.dislikes } })
        raw.meal = raw.meal || form.meal
      } else {
        raw = generateLocal({ ...form, dislikes: state.dislikes, seed: Date.now() })
      }
      const r = enrich({
        id: `custom-${newId()}`, mealId: null, custom: true, name: raw.title, desc: raw.description, meals: [raw.meal || form.meal],
        cuisine: 'international', time: raw.time, difficulty: raw.difficulty, steps: raw.steps,
        ingredients: raw.ingredients.filter(i => FOODS[i.key]).map(i => [i.key, Math.round(i.grams)]), tags: [],
        source: useAI ? 'KI (Claude)' : 'Kalora-Generator',
      })
      setResult(r)
    } catch (e) {
      setErr(e.message)
    } finally { setLoading(false) }
  }

  const save = () => {
    update(s => ({ ...s, customRecipes: [result, ...s.customRecipes] }))
    notify('Rezept gespeichert')
    close()
    open('recipe', { id: result.id })
  }

  const n = result?.nutrition
  const checks = result && [
    [n.kcal <= form.maxKcal * 1.05, `max. ${form.maxKcal} kcal`],
    [n.p >= form.minProtein * 0.95, `mind. ${form.minProtein} g Protein`],
    [result.time <= form.time + 5, `≤ ${form.time} Min.`],
  ]

  return (
    <Sheet title="Eigenes Rezept generieren" onClose={onClose} full>
      {!result && (
        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label>Was möchtest du? (optional)</label>
            <textarea className="input" rows={2} value={form.prompt} onChange={e => set('prompt', e.target.value)} placeholder="z. B. Erstelle ein Abendessen mit maximal 700 kcal und mindestens 60 g Protein." />
          </div>
          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field"><label>Maximale Kalorien</label><input className="input" type="number" value={form.maxKcal} onChange={e => set('maxKcal', +e.target.value)} /></div>
            <div className="field"><label>Protein mindestens (g)</label><input className="input" type="number" value={form.minProtein} onChange={e => set('minProtein', +e.target.value)} /></div>
          </div>
          <div className="field"><label>Gewünschte Zutaten</label><input className="input" value={form.include} onChange={e => set('include', e.target.value)} placeholder="z. B. Hähnchen, Reis, Brokkoli" /></div>
          <div className="field"><label>Kochzeit: {form.time} Min.</label><input type="range" min={5} max={90} step={5} value={form.time} onChange={e => set('time', +e.target.value)} style={{ accentColor: 'var(--green)' }} /></div>
          <div className="field"><label>Ernährungsform</label>
            <div className="chips wrap">{['alles', 'vegetarisch', 'vegan'].map(d => <button key={d} className={`chip green ${form.diet === d ? 'active' : ''}`} onClick={() => set('diet', d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}</div>
          </div>
          <div className="field"><label>Mahlzeit</label>
            <div className="chips wrap">{MEALS.map(([id, l]) => <button key={id} className={`chip green ${form.meal === id ? 'active' : ''}`} onClick={() => set('meal', id)}>{l}</button>)}</div>
          </div>
          {state.dislikes.length > 0 && <p className="small muted">Ohne: {state.dislikes.join(', ')}</p>}
          <p className="small muted">Noch offen heute: {fmt(rem.kcal)} kcal · {fmt(rem.p)} g Protein</p>
          {err && <p className="small red bold">{err}</p>}
          <button className="btn primary block" style={{ height: 54 }} onClick={() => run()} disabled={loading}>
            {loading ? <><Loader2 className="spin" size={18} /> Rezept wird erstellt …</> : <><Sparkles size={18} /> Rezept generieren</>}
          </button>
          {ai && !ai.enabled && <p className="tiny muted center">KI-Server nicht konfiguriert – Kalora nutzt den eingebauten Offline-Generator.</p>}
        </div>
      )}

      {result && (
        <div className="col" style={{ gap: 14 }}>
          <div className="card hero">
            <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>✨ {result.source}</span>
            <h2 className="mt-s" style={{ fontSize: 22 }}>{result.name}</h2>
            <p className="small mt-s" style={{ opacity: .9 }}>{result.desc}</p>
            <div className="row wrap mt-s">{checks.map(([okk, l]) => <span key={l} className="badge" style={{ background: okk ? 'rgba(255,255,255,.25)' : 'var(--red)', color: '#fff' }}>{okk ? '✓' : '✗'} {l}</span>)}</div>
          </div>
          <div className="card"><NutritionTable per={n} persons={1} /></div>
          <div className="card">
            <div className="card-title">Zutaten (1 Portion)</div>
            <div className="list">{result.ingredients.map(([k, g]) => <div key={k} className="list-item"><div className="thumb contain">{FOODS[k].image ? <img src={FOODS[k].image} alt="" /> : '🥄'}</div><span style={{ flex: 1 }}>{FOODS[k].name}</span><b>{g} g</b></div>)}</div>
          </div>
          <div className="card col" style={{ gap: 12 }}>
            <div className="card-title">Zubereitung · {result.time} Min.</div>
            {result.steps.map((s, i) => <div key={i} className="row" style={{ alignItems: 'flex-start' }}><span className="step-num">{i + 1}</span><p>{s}</p></div>)}
          </div>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} onClick={() => setResult(null)}>Anpassen</button>
            <button className="btn" style={{ flex: 1 }} onClick={() => run()} disabled={loading}>{loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} Neu</button>
          </div>
          <button className="btn primary block" onClick={save}><Save size={18} /> Rezept speichern</button>
        </div>
      )}
    </Sheet>
  )
}
