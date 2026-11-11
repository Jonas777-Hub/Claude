import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Trash2, Plus, Sparkles, AlertTriangle, Check, RotateCcw, Database, X, ChefHat } from 'lucide-react'
import { useStore } from '../store.jsx'
import { useUI } from '../App.jsx'
import { Sheet, Stepper, RecipeImage } from '../components/ui.jsx'
import { resizeImage } from '../api.js'
import { useAIStatus, analyzePhoto } from '../lib/ai.js'
import { SLOTS, fmt, slotForTime } from '../lib/nutrition.js'
import { FOODS, searchFoods, nutrientsFor } from '../data/foods.js'
import { RECIPES } from '../data/recipes.js'
import ProductPhoto from './ProductPhoto.jsx'
import VoiceEntry from './VoiceEntry.jsx'
import { Segmented } from '../components/ui.jsx'

export { useAIStatus }

const PLATES = [
  { id: 'klein', label: 'Kleiner Teller', ref: 'kleiner Teller/Frühstücksteller, ca. 20 cm Durchmesser' },
  { id: 'normal', label: 'Normaler Teller', ref: 'normaler flacher Speiseteller, ca. 26 cm Durchmesser' },
  { id: 'gross', label: 'Großer Teller', ref: 'großer Teller, ca. 30 cm Durchmesser' },
  { id: 'schuessel', label: 'Schüssel / Bowl', ref: 'Schüssel bzw. Bowl, ca. 16 cm Durchmesser, ca. 600 ml' },
  { id: 'box', label: 'Box / to go', ref: 'Meal-Prep- oder To-go-Box, ca. 1 Liter' },
]

// Gramm einer Zutat ändern → Nährwerte proportional anpassen
const scaleItem = (it, grams) => {
  const k = it.grams > 0 ? grams / it.grams : 1
  return { ...it, grams, kcal: it.kcal * k, protein: it.protein * k, carbs: it.carbs * k, fat: it.fat * k, sugar: it.sugar * k, fiber: it.fiber * k }
}
// Mit Kalora-Datenbank abgleichen: gleiche Werte wie im Rest der App (pro Gramm exakt)
const fromDb = (key, grams, name) => {
  const n = nutrientsFor(key, grams)
  return { name: name || FOODS[key].name, key, grams, kcal: n.kcal, protein: n.p, carbs: n.c, fat: n.f, sugar: n.s, fiber: n.fi, db: true }
}

export default function PhotoAnalysis({ onClose, slot: initialSlot, kind: initialKind }) {
  const { state, update, addEntries, notify } = useStore()
  const { open } = useUI()
  const ai = useAIStatus()
  const fileRef = useRef(null)
  const camRef = useRef(null)
  const ctl = useRef(null)
  const [photos, setPhotos] = useState([]) // bis zu 2 Fotos derselben Mahlzeit
  const [phase, setPhase] = useState('pick') // pick | analyzing | result | error | manual
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [items, setItems] = useState([])
  const [edited, setEdited] = useState(false)
  const [portion, setPortion] = useState(1)
  const [slot, setSlot] = useState(initialSlot || slotForTime())
  const [dish, setDish] = useState('')
  const [hint, setHint] = useState('')
  const [plate, setPlate] = useState(state.settings.plate || 'normal')
  const [adding, setAdding] = useState('')
  const [useDb, setUseDb] = useState(true)
  const [recipeQ, setRecipeQ] = useState('')
  const [kind, setKind] = useState(initialKind || 'mahlzeit')
  const [handoff, setHandoff] = useState(null)
  // Ohne KI (z. B. eigene Web-Adresse): direkt mit dem Produkt-/Strichcode-Modus starten
  useEffect(() => { if (ai && !ai.enabled && !initialKind) setKind('produkt') }, [ai]) // eslint-disable-line react-hooks/exhaustive-deps

  const memory = state.photoMemory || []

  const onFile = async f => {
    if (!f) return
    try {
      const r = await resizeImage(f, 1400, 0.86)
      const next = [...photos, r].slice(0, 2)
      setPhotos(next)
      setPhase('pick')
      // Erstes Foto: sofort erkennen (Mahlzeit ODER verpacktes Produkt) – kein extra Tippen nötig
      if (next.length === 1 && ai?.images) analyze(next)
    } catch (e) { notify(e.message, 'err') }
  }

  const analyze = async (list = photos) => {
    const photos = list
    if (!photos.length) return
    setPhase('analyzing'); setError('')
    ctl.current = new AbortController()
    try {
      const plateRef = PLATES.find(p => p.id === plate).ref
      const r = await analyzePhoto({ files: photos.map(p => p.blob), images: photos, hint, plate: plateRef, memory: memory.slice(0, 12), signal: ctl.current.signal })
      // Verpacktes Produkt erkannt → automatisch in den Produkt-Modus mit demselben Foto
      if (r.packaged) { setHandoff(photos); setKind('produkt'); setPhase('pick'); return }
      if (!r.is_food || !r.items.length) { setError('Auf dem Foto wurde kein Essen erkannt. Fotografiere den Teller von schräg oben bei gutem Licht.'); setPhase('error'); return }
      setResult(r)
      setDish(r.dish)
      setItems(r.items.map((it, i) => ({ ...it, id: i, ai: it })))
      setEdited(false)
      setPhase('result')
    } catch (e) {
      if (e.code === 'cancelled') { setPhase('pick'); return }
      setError(e.message); setPhase('error')
    }
  }

  // Werte je nach Schalter aus Datenbank (wenn zugeordnet) oder direkt aus der KI-Schätzung
  const shown = useMemo(() => items.map(it => (useDb && it.key && FOODS[it.key] ? { ...fromDb(it.key, it.grams, it.name), id: it.id } : it)), [items, useDb])
  const dbCount = items.filter(it => it.key && FOODS[it.key]).length

  const setGrams = (id, grams) => { setEdited(true); setItems(list => list.map(it => (it.id === id ? scaleItem(it, grams) : it))) }
  const addFood = food => {
    const g = food.piece || 100
    setEdited(true)
    setItems(list => [...list, { ...fromDb(food.key, g), id: Date.now() }])
    setAdding('')
  }

  const tot = shown.reduce((a, it) => ({ kcal: a.kcal + it.kcal, p: a.p + it.protein, c: a.c + it.carbs, f: a.f + it.fat, s: a.s + it.sugar, fi: a.fi + it.fiber, g: a.g + it.grams }), { kcal: 0, p: 0, c: 0, f: 0, s: 0, fi: 0, g: 0 })
  const final = Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, v * portion]))

  const save = async () => {
    let photo = null
    try { if (photos[0]) photo = (await resizeImage(photos[0].blob, 240, 0.7)).dataUrl } catch { /* ohne Foto speichern */ }
    addEntries([{ slot, name: dish || 'Mahlzeit', photo, source: 'foto', grams: final.g, kcal: final.kcal, p: final.p, c: final.c, f: final.f, s: final.s, fi: final.fi, items: shown.map(i => ({ name: i.name, grams: i.grams * portion })) }])
    // Lernen aus Korrekturen: korrigierte Gerichte merkt sich Kalora für die nächsten Fotos
    if (edited || portion !== 1 || (result && dish !== result.dish)) {
      const entry = { dish: dish || 'Mahlzeit', items: shown.map(i => ({ name: i.name, grams: Math.round(i.grams * portion) })), at: Date.now() }
      update(s => ({ ...s, photoMemory: [entry, ...(s.photoMemory || []).filter(m => m.dish.toLowerCase() !== entry.dish.toLowerCase())].slice(0, 30), settings: { ...s.settings, plate } }))
    } else update(s => ({ ...s, settings: { ...s.settings, plate } }))
    notify(`${fmt(final.kcal)} kcal zu ${SLOTS.find(s => s.id === slot).label} hinzugefügt`)
    onClose()
  }

  // Ohne KI: ähnliches Rezept wählen und Portion schätzen
  const pickRecipe = r => {
    setDish(r.name)
    setItems(r.ingredients.map(([k, g], i) => ({ ...fromDb(k, g), id: i })))
    setResult({ dish: r.name, confidence: 'mittel', notes: 'Werte aus dem Kalora-Rezept – passe Portion und Zutaten an dein Foto an.' })
    setEdited(true)
    setPhase('result')
  }
  const recipeMatches = useMemo(() => {
    const q = recipeQ.trim().toLowerCase()
    return (q ? RECIPES.filter(r => r.name.toLowerCase().includes(q) || r.ingredients.some(([k]) => FOODS[k]?.name.toLowerCase().includes(q))) : RECIPES).slice(0, 12)
  }, [recipeQ])

  return (
    <Sheet title="Essen erfassen" onClose={() => { ctl.current?.abort(); onClose() }} full>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />

      {(phase === 'pick' || phase === 'error') && (
        <div style={{ marginBottom: 12 }}>
          <Segmented value={kind} onChange={setKind} options={[{ id: 'mahlzeit', label: '🍽️ Teller' }, { id: 'produkt', label: '🍫 Produkt' }, { id: 'sprache', label: '🎤 Sprechen' }]} />
        </div>
      )}
      {kind === 'sprache' ? <VoiceEntry ai={ai} slot={slot} setSlot={setSlot} onDone={onClose} /> : kind === 'produkt' ? <ProductPhoto ai={ai} slot={slot} setSlot={setSlot} onDone={onClose} initialPhotos={handoff} /> : <>

      {/* ---------- Fotos aufnehmen ---------- */}
      {(phase === 'pick' || phase === 'error') && (
        <div className="col" style={{ gap: 12 }}>
          {photos.length === 0 ? (
            <div className="card center" style={{ padding: 26 }}>
              <div style={{ fontSize: 50 }}>📸</div>
              <h3 className="mt-s">Fotografiere dein Essen</h3>
              <p className="small muted mt-s">Von schräg oben, bei gutem Licht, der ganze Teller im Bild. Für eine genauere Portion kannst du ein zweites Foto von der Seite hinzufügen.</p>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: photos.length > 1 ? '1fr 1fr' : '1fr', gap: 8 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={p.dataUrl} alt={`Foto ${i + 1}`} className="photo-preview" />
                  <span className="badge dark" style={{ position: 'absolute', left: 8, top: 8 }}>{i === 0 ? 'Foto 1' : 'Seitenansicht'}</span>
                  <button className="icon-btn sm" style={{ position: 'absolute', right: 8, top: 8, background: 'rgba(0,0,0,.55)', color: '#fff', border: 0 }} onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))} aria-label="Foto entfernen"><X size={16} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="row">
            <button className="btn primary" style={{ flex: 1, height: 52 }} onClick={() => camRef.current.click()} disabled={photos.length >= 2}><Camera size={20} /> {photos.length ? '2. Foto (Seite)' : 'Kamera'}</button>
            <button className="btn" style={{ flex: 1, height: 52 }} onClick={() => fileRef.current.click()} disabled={photos.length >= 2}><ImagePlus size={18} /> Galerie</button>
          </div>

          <div className="card">
            <div className="card-title">Worauf liegt das Essen?</div>
            <div className="chips wrap">{PLATES.map(p => <button key={p.id} className={`chip green ${plate === p.id ? 'active' : ''}`} onClick={() => setPlate(p.id)}>{p.label}</button>)}</div>
            <p className="tiny muted mt-s">Hilft der KI, die Portionsgröße richtig zu schätzen.</p>
            <div className="field mt"><label htmlFor="hint">Hinweis (optional)</label><input id="hint" className="input" placeholder="z. B. in Butter gebraten, mit Sahnesauce, Vollkornreis" value={hint} onChange={e => setHint(e.target.value)} /></div>
          </div>

          {phase === 'error' && (
            <div className="card tinted row" style={{ alignItems: 'flex-start' }}>
              <AlertTriangle size={20} color="var(--red)" style={{ flexShrink: 0 }} />
              <p className="small"><b>Das hat nicht geklappt.</b> {error}</p>
            </div>
          )}

          {ai === null && <div className="center small muted"><Loader2 size={16} className="spin" /> Verbinde mit Claude …</div>}
          {ai?.enabled && (
            <button className="btn primary block" style={{ height: 56 }} onClick={() => analyze()} disabled={!photos.length}>
              {phase === 'error' ? <><RotateCcw size={18} /> Erneut analysieren</> : <><Sparkles size={18} /> Kalorien berechnen</>}
            </button>
          )}
          {ai && !ai.enabled && (
            <div className="card tinted small">
              <b>Claude ist hier gerade nicht erreichbar.</b> Öffne Kalora in der Claude-App oder auf claude.ai und tippe auf „Erlauben", wenn nach dem Zugriff gefragt wird. Bis dahin kannst du ein ähnliches Gericht wählen:
            </div>
          )}
          <button className="btn block" onClick={() => setPhase('manual')}><ChefHat size={18} /> Ohne KI: ähnliches Gericht wählen</button>
          <button className="btn ghost block" onClick={() => { onClose(); open('search', { slot }) }}>Lebensmittel einzeln suchen</button>
          {memory.length > 0 && <p className="tiny muted center">Kalora hat sich {memory.length} deiner Korrekturen gemerkt und nutzt sie bei neuen Fotos.</p>}
        </div>
      )}

      {/* ---------- Analyse läuft ---------- */}
      {phase === 'analyzing' && (
        <div className="col" style={{ gap: 14 }}>
          <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden' }}>
            <img src={photos[0].dataUrl} alt="Dein Essen" className="photo-preview" />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.25)' }}><div className="scan-line" /></div>
          </div>
          <div className="center">
            <Loader2 className="spin" size={30} color="var(--green)" />
            <p className="bold mt-s">Claude analysiert dein Essen …</p>
            <p className="small muted">Lebensmittel erkennen · Portion schätzen · Nährwerte berechnen. Das dauert meist 10–40 Sekunden.</p>
          </div>
          <button className="btn block" onClick={() => ctl.current?.abort()}>Abbrechen</button>
        </div>
      )}

      {/* ---------- Ohne KI: Rezept wählen ---------- */}
      {phase === 'manual' && (
        <div className="col" style={{ gap: 12 }}>
          <input className="input" placeholder="Was hast du gegessen? z. B. Bolognese, Curry, Pancakes" value={recipeQ} onChange={e => setRecipeQ(e.target.value)} />
          <div className="list">
            {recipeMatches.map(r => (
              <button key={r.id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => pickRecipe(r)}>
                <div className="thumb"><RecipeImage recipe={r} size="small" /></div>
                <span style={{ flex: 1, minWidth: 0 }}><div className="bold">{r.name}</div><div className="small muted">{fmt(r.nutrition.kcal)} kcal pro Portion</div></span>
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => setPhase('pick')}>Zurück</button>
        </div>
      )}

      {/* ---------- Ergebnis ---------- */}
      {phase === 'result' && result && (
        <div className="col" style={{ gap: 14 }}>
          {photos[0] && <img src={photos[0].dataUrl} alt="Dein Essen" className="photo-preview" style={{ aspectRatio: '16/9' }} />}
          <div className="card">
            <div className="row between"><span className="small muted bold">Erkanntes Gericht</span>
              <span className={`badge ${result.confidence === 'hoch' ? '' : result.confidence === 'mittel' ? 'orange' : 'red'}`}>Sicherheit: {result.confidence}</span>
            </div>
            <input className="input mt-s" style={{ fontWeight: 800, fontSize: 18 }} value={dish} onChange={e => { setDish(e.target.value); setEdited(true) }} aria-label="Gerichtname" />
            <div className="grid mt" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[['Kalorien', final.kcal, 'kcal', '#22C55E'], ['Protein', final.p, 'g', '#3B82F6'], ['Kohlenh.', final.c, 'g', '#F59E0B'], ['Fett', final.f, 'g', '#EC4899'], ['Zucker', final.s, 'g', '#8B5CF6'], ['Ballastst.', final.fi, 'g', '#14B8A6']].map(([l, v, u, c]) => (
                <div key={l} className="open-item tint center" style={{ padding: 10, '--tint': c }}><div className="v" style={{ fontSize: 19 }}>{fmt(v)} <span className="small">{u}</span></div><div className="l">{l}</div></div>
              ))}
            </div>
            {result.notes && <p className="small muted mt">💡 {result.notes}</p>}
          </div>

          <div className="card">
            <div className="row between"><span className="bold">Portion anpassen</span><Stepper value={portion} onChange={v => { setPortion(v); setEdited(true) }} min={0.25} max={4} step={0.25} format={v => `${String(v).replace('.', ',')}×`} /></div>
            {dbCount > 0 && (
              <label className="row between mt" style={{ cursor: 'pointer' }}>
                <span className="small"><Database size={14} style={{ verticalAlign: -2 }} /> <b>{dbCount} von {items.length}</b> Zutaten mit Kalora-Datenbank abgleichen</span>
                <input type="checkbox" checked={useDb} onChange={e => setUseDb(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--green)' }} />
              </label>
            )}
          </div>

          <div className="card">
            <div className="card-title">Lebensmittel bearbeiten</div>
            <div className="list">
              {shown.map(it => (
                <div key={it.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <input className="input" style={{ height: 38, fontWeight: 700 }} value={it.name} onChange={e => { setEdited(true); setItems(l => l.map(x => (x.id === it.id ? { ...x, name: e.target.value } : x))) }} aria-label="Lebensmittel" />
                    <div className="tiny muted mt-s">{fmt(it.kcal)} kcal · P {fmt(it.protein)} · KH {fmt(it.carbs)} · F {fmt(it.fat)}{it.db ? ' · ✓ Datenbank' : ''}</div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <input className="input" type="number" inputMode="numeric" style={{ width: 82, height: 38 }} value={Math.round(it.grams)} onChange={e => setGrams(it.id, Math.max(0, +e.target.value))} aria-label="Gramm" />
                    <span className="small muted">g</span>
                    <button className="icon-btn sm plain" onClick={() => { setEdited(true); setItems(l => l.filter(x => x.id !== it.id)) }} aria-label="Entfernen"><Trash2 size={16} color="var(--red)" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="search mt-s"><Plus size={18} /><input className="input" placeholder="Fehlt etwas? Lebensmittel hinzufügen …" value={adding} onChange={e => setAdding(e.target.value)} /></div>
            {adding && (
              <div className="list mt-s">
                {searchFoods(adding, 6).map(f => (
                  <button key={f.key} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => addFood(f)}>
                    <span style={{ flex: 1 }}>{f.name}</span><span className="small muted">{f.kcal} kcal/100 g</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Mahlzeit</div>
            <div className="chips wrap">{SLOTS.map(s => <button key={s.id} className={`chip green ${slot === s.id ? 'active' : ''}`} onClick={() => setSlot(s.id)}>{s.emoji} {s.label}</button>)}</div>
          </div>

          <button className="btn primary block" style={{ height: 56 }} onClick={save} disabled={!items.length}><Check size={20} /> Bestätigen & hinzufügen</button>
          {edited && <p className="tiny muted center">Kalora merkt sich deine Korrekturen für die nächsten Fotos dieses Gerichts.</p>}
          <button className="btn block" onClick={() => { setPhotos([]); setResult(null); setItems([]); setPhase('pick') }}>Neues Foto</button>
        </div>
      )}
      </>}
    </Sheet>
  )
}
