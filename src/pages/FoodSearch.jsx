import { useEffect, useMemo, useState } from 'react'
import { Search, ScanLine, Loader2, Globe, Check } from 'lucide-react'
import { useStore } from '../store.jsx'
import { Sheet, Segmented } from '../components/ui.jsx'
import { BarcodeScanner, lookupBarcode, searchOFF } from '../components/Scanner.jsx'
import { searchFoods, FOOD_LIST } from '../data/foods.js'
import { SLOTS, fmt, slotForTime } from '../lib/nutrition.js'

export default function FoodSearch({ onClose, slot: initialSlot }) {
  const { state, addEntries, notify } = useStore()
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('suche')
  const [off, setOff] = useState({ loading: false, list: [] })
  const [sel, setSel] = useState(null)
  const local = useMemo(() => searchFoods(q, 25), [q])

  // Open Food Facts: Markenprodukte ergänzen
  useEffect(() => {
    if (q.trim().length < 3) { setOff({ loading: false, list: [] }); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setOff(o => ({ ...o, loading: true }))
      searchOFF(q, ctrl.signal).then(list => setOff({ loading: false, list })).catch(() => setOff({ loading: false, list: [] }))
    }, 450)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  const recent = useMemo(() => {
    const seen = new Map()
    for (const day of Object.keys(state.log).sort().reverse().slice(0, 14))
      for (const e of state.log[day]) if (!seen.has(e.name) && e.source !== 'foto') seen.set(e.name, e)
    return [...seen.values()].slice(0, 8)
  }, [state.log])

  const onCode = async code => {
    try {
      const f = await lookupBarcode(code)
      if (!f) { notify('Produkt nicht gefunden', 'err'); return }
      setSel(f); setMode('suche')
    } catch { notify('Open Food Facts nicht erreichbar', 'err') }
  }

  if (sel) return <AmountSheet food={sel} initialSlot={initialSlot} onBack={() => setSel(null)} onClose={onClose} onAdd={(entry) => { addEntries([entry]); notify(`${entry.name} hinzugefügt`); onClose() }} />

  return (
    <Sheet title="Lebensmittel hinzufügen" onClose={onClose} full>
      <Segmented value={mode} onChange={setMode} options={[{ id: 'suche', label: 'Suchen' }, { id: 'scan', label: 'Barcode scannen' }]} />
      {mode === 'scan' ? <div className="mt"><BarcodeScanner onCode={onCode} /></div> : (
        <>
          <div className="search mt"><Search size={18} /><input autoFocus className="input" placeholder="z. B. Skyr, Banane, Haferflocken …" value={q} onChange={e => setQ(e.target.value)} /></div>
          {!q && recent.length > 0 && (
            <>
              <div className="small muted bold mt">Zuletzt gegessen</div>
              <div className="list">
                {recent.map(e => (
                  <button key={e.id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => { addEntries([{ ...e, id: undefined, time: undefined, slot: initialSlot || slotForTime() }]); notify(`${e.name} hinzugefügt`); onClose() }}>
                    <span style={{ flex: 1 }}><div className="bold">{e.name}</div><div className="small muted">{fmt(e.kcal)} kcal · P {fmt(e.p)} g</div></span>
                    <Check size={18} color="var(--green)" />
                  </button>
                ))}
              </div>
            </>
          )}
          {!q && <p className="small muted mt">Datenbank mit {FOOD_LIST.length} Grundnahrungsmitteln plus Millionen Markenprodukte über Open Food Facts.</p>}
          <div className="list mt-s">
            {local.map(f => <FoodRow key={f.key} f={f} onClick={() => setSel(f)} />)}
          </div>
          {q.length >= 3 && (
            <>
              <div className="row small muted bold mt" style={{ gap: 6 }}><Globe size={14} /> Markenprodukte (Open Food Facts) {off.loading && <Loader2 size={14} className="spin" />}</div>
              <div className="list">{off.list.map(f => <FoodRow key={f.off} f={f} onClick={() => setSel(f)} />)}</div>
              {!off.loading && !off.list.length && <p className="small muted">Keine Markenprodukte gefunden.</p>}
            </>
          )}
        </>
      )}
    </Sheet>
  )
}

function FoodRow({ f, onClick }) {
  return (
    <button className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={onClick}>
      <div className="thumb contain">{f.image ? <img src={f.image} alt="" loading="lazy" /> : '🍽️'}</div>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div className="bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
        <div className="small muted">{fmt(f.kcal)} kcal · P {fmt(f.p, 1)} · KH {fmt(f.c, 1)} · F {fmt(f.f, 1)} je 100 g</div>
      </span>
    </button>
  )
}

function AmountSheet({ food, initialSlot, onBack, onClose, onAdd }) {
  const [unit, setUnit] = useState(food.piece ? 'stk' : 'g')
  const [amount, setAmount] = useState(food.piece ? 1 : 100)
  const [slot, setSlot] = useState(initialSlot || slotForTime())
  const grams = unit === 'stk' ? amount * (food.piece || 100) : amount
  const k = grams / 100
  const n = { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k, s: food.s * k, fi: food.fi * k }
  return (
    <Sheet title={food.name} onClose={onClose} back={onBack}>
      {food.image && <img src={food.image} alt="" style={{ width: 96, height: 96, objectFit: 'contain', margin: '0 auto' }} />}
      <div className="card mt">
        <div className="row">
          <input className="input" type="number" inputMode="decimal" value={amount} onChange={e => setAmount(Math.max(0, +e.target.value))} style={{ flex: 1 }} aria-label="Menge" />
          {food.piece ? <Segmented value={unit} onChange={u => { setUnit(u); setAmount(u === 'stk' ? 1 : food.piece) }} options={[{ id: 'stk', label: 'Stück' }, { id: 'g', label: 'Gramm' }]} /> : <span className="bold">g / ml</span>}
        </div>
        <div className="chips mt-s">{(unit === 'g' ? [50, 100, 150, 200, 250] : [0.5, 1, 2, 3]).map(v => <button key={v} className={`chip ${amount === v ? 'active' : ''}`} onClick={() => setAmount(v)}>{String(v).replace('.', ',')}{unit === 'g' ? ' g' : ' Stk.'}</button>)}</div>
      </div>
      <div className="grid mt" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {[['kcal', 'kcal'], ['Protein', 'p'], ['Kohlenh.', 'c'], ['Fett', 'f'], ['Zucker', 's'], ['Ballastst.', 'fi']].map(([l, key]) => (
          <div key={key} className="open-item center" style={{ padding: 10 }}><div className="bold" style={{ fontSize: 18 }}>{fmt(n[key], key === 'kcal' ? 0 : 1)}</div><div className="tiny muted bold">{l}</div></div>
        ))}
      </div>
      <div className="chips wrap mt">{SLOTS.map(s => <button key={s.id} className={`chip green ${slot === s.id ? 'active' : ''}`} onClick={() => setSlot(s.id)}>{s.emoji} {s.label}</button>)}</div>
      <button className="btn primary block mt" disabled={!grams} onClick={() => onAdd({ slot, name: food.name, source: 'suche', grams, foodKey: food.key, ...n })}>Zum Tag hinzufügen</button>
    </Sheet>
  )
}
