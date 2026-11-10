import { useMemo, useState } from 'react'
import { CalendarDays, RefreshCw, Shuffle, ShoppingCart, Check, ChevronLeft, Sparkles, Users } from 'lucide-react'
import { useStore } from '../store.jsx'
import { useUI } from '../App.jsx'
import { RecipeImage, FoodBackdrop, Stepper, ConfirmButton } from '../components/ui.jsx'
import { RECIPE_MAP, imageUrl } from '../data/recipes.js'
import { SLOTS, fmt, todayKey } from '../lib/nutrition.js'
import { learnPreferences } from '../lib/recommend.js'
import { buildWeekPlan, swapMeal } from '../lib/weekplan.js'
import { recipeToItems, cartSummary, mergeItems } from '../lib/shopping.js'

export default function WeekPlan() {
  const { state, update, targets, addEntries, cartOp, notify, actor } = useStore()
  const { open, go } = useUI()
  const [persons, setPersons] = useState(1)
  const prefs = useMemo(() => learnPreferences(state.ratings, state.cooked), [state.ratings, state.cooked])
  const plan = state.weekPlan
  const today = todayKey()
  const byId = id => RECIPE_MAP[id] || state.customRecipes.find(r => r.id === id)
  const ctx = { targets, goal: state.profile.goal, prefs, ratings: state.ratings, dislikes: state.dislikes, customRecipes: state.customRecipes }

  const create = () => {
    update(s => ({ ...s, weekPlan: buildWeekPlan({ ...ctx, start: today, seed: Date.now() }) }))
    notify('Neuer Wochenplan erstellt')
  }

  const stats = useMemo(() => {
    if (!plan) return null
    const days = plan.days.map(d => {
      const t = { kcal: 0, p: 0, f: 0, c: 0 }
      Object.values(d.meals).forEach(id => { const r = byId(id); if (r) for (const k in t) t[k] += r.nutrition[k] })
      return t
    })
    const avg = k => days.reduce((a, d) => a + d[k], 0) / days.length
    const allItems = plan.days.flatMap(d => Object.values(d.meals)).map(byId).filter(Boolean)
      .reduce((acc, r) => mergeItems(acc, recipeToItems(r, persons, state.pantry).items), [])
    return { days, kcal: avg('kcal'), p: avg('p'), f: avg('f'), cost: cartSummary(allItems, [], state.prices || {}).cost, items: allItems.length, recipes: new Set(plan.days.flatMap(d => Object.values(d.meals))).size }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, persons, state.pantry, state.customRecipes])

  const addWeekToCart = () => {
    const from = plan.days.filter(d => d.date >= today)
    const items = from.flatMap(d => Object.values(d.meals)).map(byId).filter(Boolean).flatMap(r => recipeToItems(r, persons, state.pantry, actor).items)
    cartOp({ type: 'add', items })
    notify(`${from.length} Tage im Einkaufswagen – gleiche Zutaten zusammengeführt`)
  }

  const eat = (day, slot, id) => {
    const r = byId(id)
    if (!r) return
    const n = r.nutrition
    addEntries([{ slot, name: r.name, recipeId: r.id, source: 'rezept', photo: r.image ? imageUrl(r, 'small') : null, kcal: n.kcal, p: n.p, c: n.c, f: n.f, s: n.s, fi: n.fi }], day.date)
    update(s => ({ ...s, cooked: { ...s.cooked, [r.id]: (s.cooked[r.id] || 0) + 1 } }))
    notify(`${r.name} eingetragen`)
  }
  const eaten = (date, id) => (state.log[date] || []).some(e => e.recipeId === id)

  return (
    <div className="page">
      <section className="banner-food">
        <FoodBackdrop ids={['chicken-fried-rice', 'salade-nicoise', 'hafer-pancakes', 'rindergulasch', 'garnelen-wok', 'vegane-lasagne']} />
        <span className="food-shade" />
        <div className="inner on-photo">
          <button className="badge dark" onClick={() => go('rezepte')} style={{ marginBottom: 8 }}><ChevronLeft size={12} /> Rezepte</button>
          <div className="small bold" style={{ opacity: .85 }}>7 Tage · Frühstück, Mittag, Abend, Snack</div>
          <h1>Wochenplan</h1>
        </div>
      </section>

      {!plan ? (
        <div className="card center" style={{ padding: 28 }}>
          <CalendarDays size={42} color="var(--green)" />
          <h3 className="mt-s">Deine Woche mit einem Fingertipp</h3>
          <p className="small muted mt-s">Kalora plant 7 Tage passend zu deinen {fmt(targets.kcal)} kcal und {fmt(targets.p)} g Protein, ohne Zutaten, die du nicht magst, mit Rezepten, die dir geschmeckt haben, und nutzt Zutaten mehrfach, damit weniger übrig bleibt.</p>
          <button className="btn primary mt" onClick={create}><Sparkles size={18} /> Wochenplan erstellen</button>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              <div className="open-item tint center" style={{ '--tint': '#22C55E', padding: 10 }}><div className="v" style={{ fontSize: 18 }}>{fmt(stats.kcal)}</div><div className="l">Ø kcal / Tag</div></div>
              <div className="open-item tint center" style={{ '--tint': '#3B82F6', padding: 10 }}><div className="v" style={{ fontSize: 18 }}>{fmt(stats.p)} g</div><div className="l">Ø Protein</div></div>
              <div className="open-item tint center" style={{ '--tint': '#F59E0B', padding: 10 }}><div className="v" style={{ fontSize: 18 }}>{stats.cost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</div><div className="l">Einkauf ca.</div></div>
            </div>
            <p className="tiny muted mt-s">Ziel: {fmt(targets.kcal)} kcal · {fmt(targets.p)} g Protein pro Tag · {stats.recipes} verschiedene Rezepte · {stats.items} Einkaufsposten</p>
            <div className="row between mt">
              <span className="row small bold" style={{ gap: 6 }}><Users size={15} /> Für wie viele Personen?</span>
              <Stepper value={persons} onChange={setPersons} min={1} max={8} />
            </div>
            <button className="btn primary block mt-s" onClick={addWeekToCart}><ShoppingCart size={16} /> Ganze Woche in den Einkaufswagen</button>
          </div>

          {plan.days.map((d, i) => {
            const dt = new Date(d.date)
            const past = d.date < today
            const t = stats.days[i]
            return (
              <section key={d.date} style={{ opacity: past ? 0.55 : 1 }}>
                <h3 className="section-title" style={{ fontSize: 17 }}>
                  <span>{d.date === today ? 'Heute' : dt.toLocaleDateString('de-DE', { weekday: 'long' })} <span className="small muted">{dt.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })}</span></span>
                  <span className="small" style={{ color: t.kcal > targets.kcal * 1.08 ? 'var(--red)' : t.kcal < targets.kcal * 0.85 ? 'var(--orange)' : 'var(--green-600)' }}>{fmt(t.kcal)} kcal · {fmt(t.p)} g P</span>
                </h3>
                <div className="card" style={{ padding: '4px 12px' }}>
                  <div className="list">
                    {SLOTS.map(s => {
                      const r = byId(d.meals[s.id])
                      if (!r) return null
                      const done = eaten(d.date, r.id)
                      return (
                        <div key={s.id} className="list-item">
                          <button className="thumb" onClick={() => open('recipe', { id: r.id })} aria-label={`${r.name} öffnen`}><RecipeImage recipe={r} size="small" /></button>
                          <button style={{ flex: 1, minWidth: 0, textAlign: 'left' }} onClick={() => open('recipe', { id: r.id })}>
                            <div className="tiny muted bold">{s.emoji} {s.label}</div>
                            <div className="bold small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                            <div className="tiny muted">{fmt(r.nutrition.kcal)} kcal · {fmt(r.nutrition.p)} g P · {r.time} Min.</div>
                          </button>
                          {!past && <button className="icon-btn sm plain" onClick={() => update(st => ({ ...st, weekPlan: swapMeal(st.weekPlan, d.date, s.id, ctx) }))} aria-label="Anderes Rezept"><Shuffle size={16} /></button>}
                          {d.date <= today && (
                            <button className={`check ${done ? 'on' : ''}`} onClick={() => !done && eat(d, s.id, r.id)} aria-label={done ? 'Eingetragen' : 'Als gegessen eintragen'}>{done ? <Check size={14} /> : ''}</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            )
          })}

          <div className="row mt-l">
            <button className="btn" style={{ flex: 1 }} onClick={() => {
              const keep = Object.fromEntries(plan.days.filter(d => d.date < today).map(d => [d.date, d.meals]))
              update(s => ({ ...s, weekPlan: buildWeekPlan({ ...ctx, start: plan.start, seed: Date.now(), keep }) }))
              notify('Restliche Woche neu geplant')
            }}><RefreshCw size={16} /> Neu planen</button>
            <ConfirmButton className="btn" style={{ flex: 1 }} onConfirm={create}>Ab heute neu starten</ConfirmButton>
          </div>
          <p className="tiny muted center mt">Tipp: Mit 🔀 tauschst du einzelne Mahlzeiten, mit dem Kreis trägst du sie als gegessen ein.</p>
        </>
      )}
    </div>
  )
}
