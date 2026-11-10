import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Trash2, Plus, Sparkles, AlertTriangle, Check } from 'lucide-react'
import { useStore } from '../store.jsx'
import { useUI } from '../App.jsx'
import { Sheet, Stepper } from '../components/ui.jsx'
import { api, resizeImage } from '../api.js'
import { SLOTS, fmt, slotForTime } from '../lib/nutrition.js'
import { searchFoods, nutrientsFor } from '../data/foods.js'

let aiStatusCache = null
export async function getAIStatus() {
  if (aiStatusCache) return aiStatusCache
  try { aiStatusCache = await api('/api/ai/status', { auth: false }) } catch { aiStatusCache = { enabled: false, offline: true } }
  return aiStatusCache
}
export function useAIStatus() {
  const [s, setS] = useState(aiStatusCache)
  useEffect(() => { getAIStatus().then(setS) }, [])
  return s
}

export default function PhotoAnalysis({ onClose, slot: initialSlot }) {
  const { addEntries, notify } = useStore()
  const { open } = useUI()
  const ai = useAIStatus()
  const fileRef = useRef(null)
  const camRef = useRef(null)
  const [img, setImg] = useState(null)
  const [phase, setPhase] = useState('pick') // pick | analyzing | result | error
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [items, setItems] = useState([])
  const [portion, setPortion] = useState(1)
  const [slot, setSlot] = useState(initialSlot || slotForTime())
  const [dish, setDish] = useState('')
  const [hint, setHint] = useState('')
  const [adding, setAdding] = useState('')

  const onFile = async f => {
    if (!f) return
    try {
      const r = await resizeImage(f, 1024)
      setImg(r)
      if (ai?.enabled) analyze(r)
    } catch (e) { notify(e.message, 'err') }
  }

  const analyze = async (image = img) => {
    setPhase('analyzing'); setError('')
    try {
      const r = await api('/api/ai/analyze-photo', { method: 'POST', body: { image: image.base64, mediaType: image.mediaType, hint } })
      if (!r.is_food) { setError('Auf dem Foto wurde kein Essen erkannt. Versuche es mit einem anderen Bild.'); setPhase('error'); return }
      setResult(r)
      setDish(r.dish)
      setItems(r.items.map((it, i) => ({ ...it, id: i, base: it.grams })))
      setPhase('result')
    } catch (e) {
      setError(e.message); setPhase('error')
    }
  }

  // Menge eines Lebensmittels ändern → Nährwerte proportional anpassen
  const setGrams = (id, grams) => setItems(list => list.map(it => {
    if (it.id !== id) return it
    const k = it.grams > 0 ? grams / it.grams : 1
    return { ...it, grams, kcal: it.kcal * k, protein: it.protein * k, carbs: it.carbs * k, fat: it.fat * k, sugar: it.sugar * k, fiber: it.fiber * k }
  }))

  const addFood = food => {
    const g = food.piece || 100
    const n = nutrientsFor(food.key, g)
    setItems(list => [...list, { id: Date.now(), name: food.name, grams: g, kcal: n.kcal, protein: n.p, carbs: n.c, fat: n.f, sugar: n.s, fiber: n.fi }])
    setAdding('')
  }

  const tot = items.reduce((a, it) => ({ kcal: a.kcal + it.kcal, p: a.p + it.protein, c: a.c + it.carbs, f: a.f + it.fat, s: a.s + it.sugar, fi: a.fi + it.fiber, g: a.g + it.grams }), { kcal: 0, p: 0, c: 0, f: 0, s: 0, fi: 0, g: 0 })
  const final = Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, v * portion]))

  const confirm = async () => {
    let photo = null
    try {
      const blob = await (await fetch(img.dataUrl)).blob()
      photo = (await resizeImage(blob, 240, 0.7)).dataUrl
    } catch { /* ohne Foto speichern */ }
    addEntries([{ slot, name: dish || 'Mahlzeit', photo, source: 'foto', grams: final.g, kcal: final.kcal, p: final.p, c: final.c, f: final.f, s: final.s, fi: final.fi, items: items.map(i => ({ name: i.name, grams: i.grams * portion })) }])
    notify(`${fmt(final.kcal)} kcal zu ${SLOTS.find(s => s.id === slot).label} hinzugefügt`)
    onClose()
  }

  return (
    <Sheet title="KI-Fotoerkennung" onClose={onClose} full>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => onFile(e.target.files[0])} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onFile(e.target.files[0])} />

      {ai && !ai.enabled && (
        <div className="card tinted row" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
          <AlertTriangle size={20} color="var(--orange)" style={{ flexShrink: 0 }} />
          <div className="small">
            <b>KI-Fotoerkennung ist hier nicht aktiv.</b> Sie braucht den Kalora-Server mit Claude-Schlüssel (<code>ANTHROPIC_API_KEY</code>). Trag dein Essen solange über die Lebensmittelsuche ein.
            <div className="mt-s"><button className="btn sm" onClick={() => { onClose(); open('search', { slot }) }}>Zur Lebensmittelsuche</button></div>
          </div>
        </div>
      )}

      {!img && (
        <div className="col" style={{ gap: 12 }}>
          <div className="card center" style={{ padding: 30 }}>
            <div style={{ fontSize: 54 }}>📸</div>
            <h3 className="mt-s">Fotografiere dein Essen</h3>
            <p className="small muted mt-s">Am besten von schräg oben, bei gutem Licht, mit dem ganzen Teller im Bild. Die KI erkennt Lebensmittel, schätzt die Portion und berechnet alle Nährwerte.</p>
          </div>
          <button className="btn primary block" style={{ height: 56 }} onClick={() => camRef.current.click()}><Camera size={20} /> Kamera öffnen</button>
          <button className="btn block" onClick={() => fileRef.current.click()}><ImagePlus size={18} /> Foto aus Galerie wählen</button>
          <div className="field"><label>Optionaler Hinweis für die KI</label><input className="input" placeholder="z. B. mit Olivenöl gebraten, große Portion" value={hint} onChange={e => setHint(e.target.value)} /></div>
        </div>
      )}

      {img && (
        <div style={{ position: 'relative' }}>
          <img src={img.dataUrl} alt="Dein Essen" className="photo-preview" />
          {phase === 'analyzing' && <div style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', background: 'rgba(0,0,0,.25)' }}><div className="scan-line" /></div>}
        </div>
      )}

      {img && phase === 'pick' && ai?.enabled && <button className="btn primary block mt" onClick={() => analyze()}><Sparkles size={18} /> Analysieren</button>}
      {img && phase === 'pick' && ai && !ai.enabled && <button className="btn block mt" onClick={() => setImg(null)}>Anderes Foto</button>}

      {phase === 'analyzing' && (
        <div className="center mt-l">
          <Loader2 className="spin" size={30} color="var(--green)" />
          <p className="bold mt-s">KI analysiert dein Essen …</p>
          <p className="small muted">Lebensmittel erkennen · Portion schätzen · Nährwerte berechnen</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="card tinted mt center">
          <p className="bold red">{error}</p>
          <div className="row mt" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => { setImg(null); setPhase('pick') }}>Neues Foto</button>
            <button className="btn primary" onClick={() => analyze()}>Erneut versuchen</button>
          </div>
        </div>
      )}

      {phase === 'result' && result && (
        <div className="col mt" style={{ gap: 14 }}>
          <div className="card">
            <div className="row between"><span className="small muted bold">Erkanntes Gericht</span>
              <span className={`badge ${result.confidence === 'hoch' ? '' : result.confidence === 'mittel' ? 'orange' : 'red'}`}>Sicherheit: {result.confidence}</span>
            </div>
            <input className="input mt-s" style={{ fontWeight: 800, fontSize: 18 }} value={dish} onChange={e => setDish(e.target.value)} aria-label="Gerichtname" />
            <div className="grid mt" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[['Kalorien', final.kcal, 'kcal', 'var(--green-600)'], ['Protein', final.p, 'g', 'var(--c-protein)'], ['Kohlenhydrate', final.c, 'g', 'var(--c-carbs)'], ['Fett', final.f, 'g', 'var(--c-fat)'], ['Zucker', final.s, 'g', 'var(--c-sugar)'], ['Ballaststoffe', final.fi, 'g', 'var(--c-fiber)']].map(([l, v, u, c]) => (
                <div key={l} className="open-item center" style={{ padding: 10 }}><div className="bold" style={{ fontSize: 19, color: c }}>{fmt(v)} <span className="small">{u}</span></div><div className="tiny muted bold">{l}</div></div>
              ))}
            </div>
            {result.notes && <p className="small muted mt">💡 {result.notes}</p>}
          </div>

          <div className="card">
            <div className="row between"><span className="bold">Portion anpassen</span><Stepper value={portion} onChange={setPortion} min={0.25} max={4} step={0.25} format={v => `${String(v).replace('.', ',')}×`} /></div>
          </div>

          <div className="card">
            <div className="card-title">Lebensmittel bearbeiten</div>
            <div className="list">
              {items.map(it => (
                <div key={it.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <input className="input" style={{ height: 38, fontWeight: 700 }} value={it.name} onChange={e => setItems(l => l.map(x => x.id === it.id ? { ...x, name: e.target.value } : x))} aria-label="Lebensmittel" />
                    <div className="tiny muted mt-s">{fmt(it.kcal)} kcal · P {fmt(it.protein)} · KH {fmt(it.carbs)} · F {fmt(it.fat)}</div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <input className="input" type="number" inputMode="numeric" style={{ width: 84, height: 38 }} value={Math.round(it.grams)} onChange={e => setGrams(it.id, Math.max(0, +e.target.value))} aria-label="Gramm" />
                    <span className="small muted">g</span>
                    <button className="icon-btn sm plain" onClick={() => setItems(l => l.filter(x => x.id !== it.id))} aria-label="Entfernen"><Trash2 size={16} color="var(--red)" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="search mt-s">
              <Plus size={18} />
              <input className="input" placeholder="Lebensmittel hinzufügen …" value={adding} onChange={e => setAdding(e.target.value)} />
            </div>
            {adding && (
              <div className="list mt-s">
                {searchFoods(adding, 5).map(f => (
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

          <button className="btn primary block" style={{ height: 54 }} onClick={confirm} disabled={!items.length}><Check size={20} /> Bestätigen & hinzufügen</button>
          <button className="btn block" onClick={() => { setImg(null); setResult(null); setPhase('pick') }}>Neues Foto</button>
        </div>
      )}
    </Sheet>
  )
}
