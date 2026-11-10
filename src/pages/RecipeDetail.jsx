import { useMemo, useRef, useState } from 'react'
import { Clock, ChefHat, Heart, ShoppingCart, ListChecks, Plus, Camera, ShieldCheck, Users, Star, Copy, Share2, Trash2 } from 'lucide-react'
import { useStore } from '../store.jsx'
import { Sheet, Dialog, Gallery, NutritionTable, Stepper } from '../components/ui.jsx'
import { RECIPE_MAP, CUISINES, MEAL_TYPES, scaledNutrition } from '../data/recipes.js'
import { FOODS, foodMatchesDislike } from '../data/foods.js'
import { SLOTS, fmt, slotForTime } from '../lib/nutrition.js'
import { recipeToItems, formatAmount, cartToText, inPantry, substitutes } from '../lib/shopping.js'
import { resizeImage } from '../api.js'

const PERSONS = [1, 2, 3, 4, 5, 6]

export default function RecipeDetail({ id, onClose }) {
  const { state, update, addEntries, cartOp, notify, actor } = useStore()
  const recipe = RECIPE_MAP[id] || state.customRecipes.find(r => r.id === id)
  const [persons, setPersons] = useState(1)
  const [custom, setCustom] = useState(false)
  const [eat, setEat] = useState(false)
  const [rate, setRate] = useState(false)
  const [list, setList] = useState(false)
  const photoRef = useRef(null)
  const total = useMemo(() => recipe && scaledNutrition(recipe, persons), [recipe, persons])
  if (!recipe) return <Sheet title="Rezept" onClose={onClose}><p>Rezept nicht gefunden.</p></Sheet>

  const per = recipe.nutrition
  const saved = state.saved.includes(recipe.id)
  const rating = state.ratings[recipe.id]
  const userPhotos = state.userPhotos[recipe.id] || []
  const portionLabel = persons === 1 ? 'Kleine Portion (1 Person)' : persons <= 3 ? `Mittlere Portion (${persons} Personen)` : `Familienportion (${persons} Personen)`
  const images = [
    ...(recipe.image ? [{ src: `${recipe.image}/large`, full: recipe.image, caption: 'Originalfoto' }] : []),
    ...userPhotos.map(p => ({ src: p, caption: 'Dein Ergebnis' })),
  ]

  const toggleSave = () => {
    update(s => ({ ...s, saved: saved ? s.saved.filter(x => x !== recipe.id) : [...s.saved, recipe.id] }))
    if (!saved) { notify('Rezept gespeichert'); if (!rating) setRate(true) }
  }

  const addToCart = () => {
    const { items, skipped } = recipeToItems(recipe, persons, state.pantry, actor)
    if (items.length) cartOp({ type: 'add', items })
    notify(`${items.length} Zutaten im Einkaufswagen${skipped.length ? ` · ${skipped.length} aus Vorrat abgezogen` : ''}`)
  }

  const addPhoto = async f => {
    if (!f) return
    const { dataUrl } = await resizeImage(f, 900, 0.78)
    update(s => ({ ...s, userPhotos: { ...s.userPhotos, [recipe.id]: [...(s.userPhotos[recipe.id] || []), dataUrl].slice(-4) } }))
    notify('Foto zur Galerie hinzugefügt')
  }

  const removeCustom = () => {
    update(s => ({ ...s, customRecipes: s.customRecipes.filter(r => r.id !== recipe.id) }))
    onClose()
  }

  return (
    <Sheet title={recipe.name} onClose={onClose} full actions={
      <button className="icon-btn sm" onClick={toggleSave} aria-label={saved ? 'Gespeichert' : 'Speichern'}><Heart size={18} fill={saved ? 'var(--red)' : 'none'} color={saved ? 'var(--red)' : 'currentColor'} /></button>
    }>
      {images.length ? (
        <Gallery images={images} overlay={
          <div style={{ position: 'absolute', right: 10, bottom: 30 }}><span className="badge dark"><Users size={12} /> {portionLabel}</span></div>
        } />
      ) : (
        <div className="card tinted center" style={{ padding: 30 }}>
          <div style={{ fontSize: 44 }}>✨</div>
          <p className="small muted mt-s">KI-generiertes Rezept – es gibt noch kein echtes Foto. Koche es und füge dein eigenes Foto hinzu!</p>
        </div>
      )}
      {recipe.image && (
        <div className="row small muted mt-s" style={{ gap: 6 }}>
          <ShieldCheck size={15} color="var(--green)" />
          <span>Original-Foto genau dieses Gerichts („{recipe.imageTitle}“). Zutaten an das Foto angepasst – keine Stock- oder KI-Bilder.</span>
        </div>
      )}

      <div className="row wrap mt" style={{ gap: 8 }}>
        {recipe.meals.map(m => <span key={m} className="badge gray">{MEAL_TYPES[m]}</span>)}
        <span className="badge gray">{CUISINES[recipe.cuisine] || 'International'}</span>
        <span className="badge gray"><Clock size={12} /> {recipe.time} Min.</span>
        <span className="badge gray"><ChefHat size={12} /> {recipe.difficulty}</span>
        {rating && <span className="badge orange"><Star size={12} fill="currentColor" /> {rating.score}/10</span>}
        {recipe.diet !== 'alles' && <span className="badge">{recipe.diet === 'vegan' ? '🌱 Vegan' : '🥕 Vegetarisch'}</span>}
      </div>
      <p className="text-2 mt">{recipe.desc}</p>

      {/* Personenanzahl */}
      <div className="card mt">
        <div className="card-title"><Users size={18} /> Für wie viele Personen?</div>
        <div className="chips wrap">
          {PERSONS.map(p => <button key={p} className={`chip green ${!custom && persons === p ? 'active' : ''}`} onClick={() => { setCustom(false); setPersons(p) }}>{p} {p === 1 ? 'Person' : 'Personen'}</button>)}
          <button className={`chip green ${custom ? 'active' : ''}`} onClick={() => setCustom(true)}>Eigene Anzahl</button>
        </div>
        {custom && <div className="row mt-s"><span className="small bold">Personen:</span><Stepper value={persons} onChange={setPersons} min={1} max={50} /></div>}
      </div>

      {/* Makros pro Portion */}
      <div className="grid mt" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[['Kalorien', per.kcal, 'kcal', 'var(--green-600)'], ['Protein', per.p, 'g', 'var(--c-protein)'], ['Kohlenhydrate', per.c, 'g', 'var(--c-carbs)'], ['Fett', per.f, 'g', 'var(--c-fat)'], ['Zucker', per.s, 'g', 'var(--c-sugar)'], ['Ballaststoffe', per.fi, 'g', 'var(--c-fiber)']].map(([l, v, u, c]) => (
          <div key={l} className="open-item center" style={{ padding: 10 }}><div className="bold" style={{ fontSize: 19, color: c }}>{fmt(v)} <span className="small">{u}</span></div><div className="tiny muted bold">{l} / Portion</div></div>
        ))}
      </div>

      <div className="col mt" style={{ gap: 10 }}>
        <button className="btn primary block" style={{ height: 52 }} onClick={() => setEat(true)}><Plus size={20} /> Zu meinem Tag hinzufügen</button>
        <div className="row">
          <button className="btn" style={{ flex: 1 }} onClick={addToCart}><ShoppingCart size={18} /> Zum Einkaufswagen</button>
          <button className="btn" style={{ flex: 1 }} onClick={() => setList(true)}><ListChecks size={18} /> Einkaufsliste erstellen</button>
        </div>
      </div>

      {/* Zutaten */}
      <h3 className="section-title">Zutaten <span className="small muted">für {persons} {persons === 1 ? 'Person' : 'Personen'}</span></h3>
      <div className="card">
        <div className="list">
          {recipe.ingredients.map(([k, g]) => {
            const food = FOODS[k]
            if (!food) return null
            const disliked = state.dislikes.some(d => foodMatchesDislike(k, d))
            const pantry = inPantry(state.pantry, k)
            return (
              <div key={k} className="list-item">
                <div className="thumb contain">{food.image ? <img src={food.image} alt="" loading="lazy" /> : '🥄'}</div>
                <div style={{ flex: 1 }}>
                  <div className="bold">{food.name}</div>
                  <div className="tiny muted">
                    {pantry && <span className="green">✓ im Vorrat · </span>}
                    {disliked && <span className="red">Magst du nicht – Ersatz: {substitutes(k, 2).map(x => x.name).join(', ') || '–'}</span>}
                  </div>
                </div>
                <div className="bold small" style={{ textAlign: 'right' }}>{formatAmount({ key: k, amount: g * persons, unit: 'g' })}</div>
              </div>
            )
          })}
        </div>
      </div>

      <h3 className="section-title">Nährwerte</h3>
      <div className="card"><NutritionTable per={per} total={total} persons={persons} /></div>

      <h3 className="section-title">Zubereitung</h3>
      <div className="card col" style={{ gap: 14 }}>
        {recipe.steps.map((s, i) => <div key={i} className="row" style={{ alignItems: 'flex-start' }}><span className="step-num">{i + 1}</span><p style={{ lineHeight: 1.5 }}>{s}</p></div>)}
      </div>

      <div className="row mt">
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={e => addPhoto(e.target.files[0])} />
        <button className="btn" style={{ flex: 1 }} onClick={() => photoRef.current.click()}><Camera size={18} /> Mein Ergebnis fotografieren</button>
        <button className="btn" style={{ flex: 1 }} onClick={() => setRate(true)}><Star size={18} /> {rating ? 'Bewertung ändern' : 'Bewerten'}</button>
      </div>
      {recipe.custom && <button className="btn danger block mt" onClick={removeCustom}><Trash2 size={16} /> Eigenes Rezept löschen</button>}

      {eat && <EatDialog recipe={recipe} onClose={() => setEat(false)} onConfirm={(slot, portions) => {
        const n = recipe.nutrition
        addEntries([{ slot, name: recipe.name, recipeId: recipe.id, source: 'rezept', photo: recipe.image ? `${recipe.image}/small` : null, kcal: n.kcal * portions, p: n.p * portions, c: n.c * portions, f: n.f * portions, s: n.s * portions, fi: n.fi * portions }])
        update(s => ({ ...s, cooked: { ...s.cooked, [recipe.id]: (s.cooked[recipe.id] || 0) + 1 } }))
        notify(`${fmt(n.kcal * portions)} kcal zu deinem Tag hinzugefügt`)
        setEat(false)
        setRate(true)
      }} />}
      {rate && <RatingDialog recipe={recipe} onClose={() => setRate(false)} />}
      {list && <ShoppingListSheet recipe={recipe} persons={persons} onClose={() => setList(false)} onAdd={() => { addToCart(); setList(false) }} />}
    </Sheet>
  )
}

function EatDialog({ recipe, onClose, onConfirm }) {
  const def = recipe.meals.includes(slotForTime()) ? slotForTime() : recipe.meals.find(m => ['F', 'M', 'A'].includes(m)) || 'S'
  const [slot, setSlot] = useState(def)
  const [portions, setPortions] = useState(1)
  return (
    <Dialog onClose={onClose}>
      <h3>Zu meinem Tag hinzufügen</h3>
      <p className="small muted mt-s">Die Makros werden automatisch in dein Tageskonto übernommen.</p>
      <div className="chips wrap mt">{SLOTS.map(s => <button key={s.id} className={`chip green ${slot === s.id ? 'active' : ''}`} onClick={() => setSlot(s.id)}>{s.emoji} {s.label}</button>)}</div>
      <div className="row between mt"><span className="bold">Gegessene Portionen</span><Stepper value={portions} onChange={setPortions} min={0.25} max={6} step={0.25} format={v => String(v).replace('.', ',')} /></div>
      <p className="small mt-s"><b>{fmt(recipe.nutrition.kcal * portions)} kcal</b> · P {fmt(recipe.nutrition.p * portions)} g · KH {fmt(recipe.nutrition.c * portions)} g · F {fmt(recipe.nutrition.f * portions)} g</p>
      <div className="row mt">
        <button className="btn" style={{ flex: 1 }} onClick={onClose}>Abbrechen</button>
        <button className="btn primary" style={{ flex: 1 }} onClick={() => onConfirm(slot, portions)}>Gegessen ✓</button>
      </div>
    </Dialog>
  )
}

export function RatingDialog({ recipe, onClose }) {
  const { state, update, notify } = useStore()
  const prev = state.ratings[recipe.id]
  const [score, setScore] = useState(prev?.score || 0)
  const [comment, setComment] = useState(prev?.comment || '')
  const [suggestion, setSuggestion] = useState(prev?.suggestion || '')
  const save = () => {
    update(s => ({ ...s, ratings: { ...s.ratings, [recipe.id]: { score, comment, suggestion, date: Date.now() } } }))
    notify(score >= 8 ? 'Danke! Kalora schlägt dir Ähnliches häufiger vor.' : score >= 6 ? 'Danke für deine Bewertung!' : 'Verstanden – wird nicht mehr aktiv empfohlen.')
    onClose()
  }
  const hint = !score ? '' : score >= 8 ? '😍 Wird häufiger vorgeschlagen' : score >= 6 ? '🙂 Wird normal vorgeschlagen' : '🙅 Wird nicht mehr aktiv empfohlen'
  return (
    <Dialog onClose={onClose}>
      <h3>Wie hat dir das Rezept gefallen?</h3>
      <p className="small muted mt-s">{recipe.name}</p>
      <div className="stars mt">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button key={n} className={`${n <= score ? 'on' : ''} ${score < 6 ? 'low' : score < 8 ? 'mid' : ''}`} onClick={() => setScore(n)} aria-label={`${n} von 10`}>{n}</button>
        ))}
      </div>
      <p className="small bold center mt-s" style={{ minHeight: 18 }}>{hint}</p>
      <div className="field mt-s"><label>Kommentar (optional)</label><textarea className="input" rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Was war besonders gut?" /></div>
      <div className="field mt-s"><label>Verbesserungsvorschläge (optional)</label><textarea className="input" rows={2} value={suggestion} onChange={e => setSuggestion(e.target.value)} placeholder="z. B. weniger scharf, mehr Gemüse" /></div>
      <div className="row mt">
        <button className="btn" style={{ flex: 1 }} onClick={onClose}>Später</button>
        <button className="btn primary" style={{ flex: 1 }} disabled={!score} onClick={save}>Bewerten</button>
      </div>
    </Dialog>
  )
}

function ShoppingListSheet({ recipe, persons, onClose, onAdd }) {
  const { state, notify } = useStore()
  const { items, skipped } = recipeToItems(recipe, persons, state.pantry)
  const [checked, setChecked] = useState({})
  const text = cartToText(items.map(i => ({ ...i, checked: !!checked[i.id] })), `${recipe.name} (${persons} P.)`)
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ title: 'Einkaufsliste', text }); return } } catch { return }
    await navigator.clipboard?.writeText(text); notify('Liste kopiert')
  }
  return (
    <Sheet title="Einkaufsliste" onClose={onClose}>
      <p className="small muted">{recipe.name} · für {persons} {persons === 1 ? 'Person' : 'Personen'}</p>
      <div className="card mt">
        <div className="list">
          {items.map(i => (
            <button key={i.id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => setChecked(c => ({ ...c, [i.id]: !c[i.id] }))}>
              <span className={`check ${checked[i.id] ? 'on' : ''}`}>{checked[i.id] ? '✓' : ''}</span>
              <span style={{ flex: 1 }} className={checked[i.id] ? 'struck' : ''}><b>{formatAmount(i)}</b> {i.name}</span>
            </button>
          ))}
        </div>
      </div>
      {skipped.length > 0 && <p className="small muted mt-s">Aus deinem Vorrat abgezogen: {skipped.join(', ')}</p>}
      <div className="row mt">
        <button className="btn" style={{ flex: 1 }} onClick={() => { navigator.clipboard?.writeText(text); notify('Liste kopiert') }}><Copy size={16} /> Kopieren</button>
        <button className="btn" style={{ flex: 1 }} onClick={share}><Share2 size={16} /> Teilen</button>
      </div>
      <button className="btn primary block mt" onClick={onAdd}><ShoppingCart size={18} /> In den Einkaufswagen</button>
    </Sheet>
  )
}
