// Verpacktes Produkt fotografieren (z. B. Proteinriegel): Produkt erkennen, Nährwerte vom Etikett lesen,
// Menge wählen und alle Makros eintragen. Erkannte Produkte landen in „Meine Produkte".
import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Sparkles, Check, X, AlertTriangle, RotateCcw, ScanLine, Package } from 'lucide-react'
import { useStore } from '../store.jsx'
import { Stepper } from '../components/ui.jsx'
import { resizeImage } from '../api.js'
import { analyzeProduct } from '../lib/ai.js'
import { lookupBarcode, decodeBarcodeFromBlob as detectBarcode, BarcodeScanner } from '../components/Scanner.jsx'
import { SLOTS, fmt } from '../lib/nutrition.js'
import { newId } from '../lib/shopping.js'

const SOURCE = {
  etikett: ['✓ Vom Etikett abgelesen', ''],
  bekannt: ['✓ Herstellerangaben dieses Produkts', ''],
  geschätzt: ['Geschätzt – Produkt nicht eindeutig erkannt, bitte prüfen', 'orange'],
  openfoodfacts: ['✓ Open Food Facts (per Barcode)', ''],
}

export default function ProductPhoto({ ai, slot, setSlot, onDone, initialPhotos }) {
  const { state, update, addEntries, notify } = useStore()
  const camRef = useRef(null)
  const fileRef = useRef(null)
  const ctl = useRef(null)
  const [photos, setPhotos] = useState(initialPhotos || [])
  const [phase, setPhase] = useState('pick')
  const [err, setErr] = useState('')
  const [prod, setProd] = useState(null)
  const [mode, setMode] = useState('portion') // portion | packung | gramm
  const [count, setCount] = useState(1)
  const [grams, setGrams] = useState(100)
  const [save, setSave] = useState(true)
  const [scan, setScan] = useState(false)

  const onFile = async f => {
    if (!f) return
    try {
      const r = await resizeImage(f, 1600, 0.9)
      const next = [...photos, r].slice(0, 2)
      setPhotos(next); setPhase('pick')
      if (ai) analyze(next) // sofort erkennen – mit KI ein Foto von vorne, ohne KI über den Strichcode
    } catch (e) { notify(e.message, 'err') }
  }

  // Foto aus dem Mahlzeiten-Modus übernommen → direkt erkennen
  useEffect(() => { if (initialPhotos?.length && ai) analyze(initialPhotos) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showProduct = r => {
    setProd(r)
    setMode(r.portion ? 'portion' : r.packageGrams ? 'packung' : 'gramm')
    setGrams(r.portion?.grams || r.packageGrams || 100)
    setCount(1)
    setPhase('result')
  }

  // Ohne KI: Strichcode → Open Food Facts (freie Produktdatenbank)
  const fromBarcode = async code => {
    setScan(false); setPhase('analyzing'); setErr('')
    const off = await lookupBarcode(code).catch(() => null)
    if (!off || off.kcal == null) {
      setErr(`Das Produkt mit der Nummer ${code} ist nicht in der Produktdatenbank. Trag es über „Lebensmittel suchen" ein oder probier einen anderen Strichcode.`)
      setPhase('pick'); return
    }
    showProduct({
      is_product: true, name: off.name, brand: '', ean: code, source: 'openfoodfacts', confidence: 'hoch',
      per100: { kcal: off.kcal, p: off.p, c: off.c, s: off.s, f: off.f, fi: off.fi }, unit: 'g',
      portion: off.servingGrams ? { label: off.servingLabel ? off.servingLabel.replace(/\s*\([^)]*\)\s*$/, '') || '1 Portion' : '1 Portion', grams: off.servingGrams } : null,
      packageGrams: off.packageGrams, notes: off.quantity ? `Packungsinhalt: ${off.quantity}` : '',
    })
  }

  const analyze = async (list = photos) => {
    const photos = list
    if (!photos.length) return
    if (!ai?.enabled) {
      setPhase('analyzing'); setErr('')
      const code = await detectBarcode(photos[0].blob)
      if (code) return fromBarcode(code)
      setErr('Auf dem Foto wurde kein Strichcode gefunden. Fotografiere die Seite mit dem Strichcode (groß und scharf) – oder tippe auf „Strichcode live scannen".')
      setPhase('pick'); return
    }
    setPhase('analyzing'); setErr('')
    ctl.current = new AbortController()
    try {
      const [r, code] = await Promise.all([
        analyzeProduct({ files: photos.map(p => p.blob), images: photos, signal: ctl.current.signal }),
        detectBarcode(photos[0].blob),
      ])
      if (!r.is_product) { setErr('Kein verpacktes Produkt erkannt. Fotografiere die Vorderseite gut lesbar – oder wechsle zu „Mahlzeit".'); setPhase('pick'); return }
      // Exakte Werte über den Barcode (Open Food Facts), wenn das Etikett nicht lesbar war
      const ean = code || r.ean
      if (ean && r.source !== 'etikett') {
        const off = await lookupBarcode(ean).catch(() => null)
        if (off?.kcal) { r.per100 = { kcal: off.kcal, p: off.p, c: off.c, s: off.s, f: off.f, fi: off.fi }; r.source = 'openfoodfacts'; if (!r.name) r.name = off.name }
      }
      r.ean = ean || null
      showProduct(r)
    } catch (e) {
      if (e.code === 'cancelled') { setPhase('pick'); return }
      setErr(e.message); setPhase('pick')
    }
  }

  const amount = !prod ? 0 : mode === 'portion' && prod.portion ? prod.portion.grams * count : mode === 'packung' && prod.packageGrams ? prod.packageGrams * count : grams
  const k = amount / 100
  const m = prod ? Object.fromEntries(Object.entries(prod.per100).map(([key, v]) => [key, v * k])) : {}
  const setPer100 = (key, v) => setProd(p => ({ ...p, per100: { ...p.per100, [key]: Math.max(0, +v || 0) }, edited: true }))

  const confirm = async () => {
    let thumb = null
    try { if (photos[0]) thumb = (await resizeImage(photos[0].blob, 240, 0.7)).dataUrl } catch { /* ohne Foto */ }
    const title = [prod.brand, prod.name].filter(Boolean).join(' ')
    const amountLabel = mode === 'portion' && prod.portion ? `${count === 1 ? '' : `${String(count).replace('.', ',')}× `}${prod.portion.label}` : mode === 'packung' ? `${count === 1 ? '' : `${String(count).replace('.', ',')}× `}ganze Packung` : `${fmt(amount)} ${prod.unit}`
    addEntries([{ slot, name: `${title} (${amountLabel})`, photo: thumb, source: 'produkt', grams: amount, kcal: m.kcal, p: m.p, c: m.c, f: m.f, s: m.s, fi: m.fi }])
    if (save) {
      update(s => {
        const list = s.myProducts || []
        const same = list.find(x => (prod.ean && x.ean === prod.ean) || x.name.toLowerCase() === title.toLowerCase())
        const entry = { id: same?.id || newId(), name: title, ean: prod.ean, per100: prod.per100, unit: prod.unit, portion: prod.portion, packageGrams: prod.packageGrams, source: prod.source, count: (same?.count || 0) + 1, lastUsed: Date.now() }
        return { ...s, myProducts: [entry, ...list.filter(x => x !== same)].slice(0, 100) }
      })
    }
    notify(`${fmt(m.kcal)} kcal · ${fmt(m.p)} g Protein eingetragen`)
    onDone()
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { onFile(e.target.files[0]); e.target.value = '' }} />

      {phase === 'pick' && (
        <>
          {photos.length === 0 ? (
            <div className="card center" style={{ padding: 22 }}>
              <div style={{ fontSize: 46 }}>🍫</div>
              <h3 className="mt-s">Verpacktes Produkt fotografieren</h3>
              <p className="small muted mt-s">{ai?.enabled ? <>Proteinriegel, Joghurt, Getränk, Chips … Einfach die <b>Vorderseite</b> fotografieren – Kalora erkennt Marke und Sorte und trägt die Nährwerte ein.</> : <>Proteinriegel, Joghurt, Getränk, Chips … Fotografiere den <b>Strichcode</b> – Kalora holt alle Nährwerte automatisch.</>}</p>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: photos.length > 1 ? '1fr 1fr' : '1fr', gap: 8 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={p.dataUrl} alt={`Foto ${i + 1}`} className="photo-preview" style={{ objectFit: 'contain', background: '#111' }} />
                  <span className="badge dark" style={{ position: 'absolute', left: 8, top: 8 }}>{i === 0 ? 'Vorderseite' : 'Nährwerte'}</span>
                  <button className="icon-btn sm" style={{ position: 'absolute', right: 8, top: 8, background: 'rgba(0,0,0,.55)', color: '#fff', border: 0 }} onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))} aria-label="Foto entfernen"><X size={16} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="row">
            <button className="btn primary" style={{ flex: 1, height: 52 }} onClick={() => camRef.current.click()} disabled={photos.length >= 2}><Camera size={20} /> {photos.length ? 'Rückseite (optional)' : 'Kamera'}</button>
            <button className="btn" style={{ flex: 1, height: 52 }} onClick={() => fileRef.current.click()} disabled={photos.length >= 2}><ImagePlus size={18} /> Galerie</button>
          </div>
          {err && <div className="card tinted row" style={{ alignItems: 'flex-start' }}><AlertTriangle size={20} color="var(--red)" style={{ flexShrink: 0 }} /><p className="small">{err}</p></div>}
          {ai && !ai.enabled && !photos.length && <p className="small muted">In dieser Version erkennt Kalora Produkte über den <b>Strichcode</b>: einfach die Seite mit dem Strichcode fotografieren oder live scannen – alle Nährwerte kommen aus der Produktdatenbank Open Food Facts.</p>}
          {photos.length > 0 && <button className="btn primary block" style={{ height: 56 }} onClick={() => analyze()}>{err ? <><RotateCcw size={18} /> Erneut versuchen</> : ai?.enabled ? <><Sparkles size={18} /> Produkt erkennen</> : <><ScanLine size={18} /> Strichcode lesen</>}</button>}
          <button className="btn block" onClick={() => setScan(true)}><ScanLine size={18} /> Strichcode live scannen</button>
          {scan && <div className="card"><BarcodeScanner onCode={fromBarcode} /><button className="btn ghost block mt-s" onClick={() => setScan(false)}>Schließen</button></div>}
          {(state.myProducts || []).length > 0 && (
            <div className="card">
              <div className="card-title"><Package size={16} /> Meine Produkte – mit einem Tipp eintragen</div>
              <div className="list">
                {[...state.myProducts].sort((a, b) => b.count - a.count).slice(0, 6).map(p => {
                  const g = p.portion?.grams || p.packageGrams || 100
                  const kk = g / 100
                  return (
                    <button key={p.id} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => {
                      addEntries([{ slot, name: `${p.name} (${p.portion?.label || `${g} ${p.unit}`})`, source: 'produkt', grams: g, kcal: p.per100.kcal * kk, p: p.per100.p * kk, c: p.per100.c * kk, f: p.per100.f * kk, s: p.per100.s * kk, fi: p.per100.fi * kk }])
                      update(s => ({ ...s, myProducts: s.myProducts.map(x => (x.id === p.id ? { ...x, count: x.count + 1, lastUsed: Date.now() } : x)) }))
                      notify(`${p.name} eingetragen`); onDone()
                    }}>
                      <span style={{ flex: 1, minWidth: 0 }}><div className="bold small">{p.name}</div><div className="tiny muted">{p.portion?.label || `${g} ${p.unit}`} · {fmt(p.per100.kcal * kk)} kcal · {fmt(p.per100.p * kk)} g P</div></span>
                      <span className="badge">+ Eintragen</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {phase === 'analyzing' && (
        <div className="center">
          {photos[0] && <img src={photos[0].dataUrl} alt="Produkt" className="photo-preview" style={{ objectFit: 'contain', background: '#111' }} />}
          <Loader2 className="spin mt" size={28} color="var(--green)" />
          <p className="bold mt-s">{ai?.enabled ? 'Claude liest das Produkt …' : 'Strichcode wird gelesen …'}</p>
          <p className="small muted">{ai?.enabled ? 'Marke erkennen · Nährwerte finden · Portionsgröße bestimmen' : 'Produkt in Open Food Facts suchen'}</p>
          <button className="btn block mt" onClick={() => ctl.current?.abort()}>Abbrechen</button>
        </div>
      )}

      {phase === 'result' && prod && (
        <>
          <div className="card">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              {photos[0] && <img src={photos[0].dataUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 14 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <input className="input" style={{ height: 36, fontSize: 13 }} value={prod.brand} placeholder="Marke" onChange={e => setProd({ ...prod, brand: e.target.value })} aria-label="Marke" />
                <input className="input mt-s" style={{ height: 40, fontWeight: 800 }} value={prod.name} onChange={e => setProd({ ...prod, name: e.target.value })} aria-label="Produktname" />
              </div>
            </div>
            <div className="row wrap mt-s" style={{ gap: 6 }}>
              <span className={`badge ${SOURCE[prod.source][1]}`}>{prod.edited ? 'Von dir angepasst' : SOURCE[prod.source][0]}</span>
              {prod.ean && <span className="badge gray"><ScanLine size={12} /> {prod.ean}</span>}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Wie viel hast du gegessen?</div>
            <div className="chips wrap">
              {prod.portion && <button className={`chip green ${mode === 'portion' ? 'active' : ''}`} onClick={() => { setMode('portion'); setCount(1) }}>{prod.portion.label} · {fmt(prod.portion.grams)} {prod.unit}</button>}
              {prod.packageGrams && prod.packageGrams !== prod.portion?.grams && <button className={`chip green ${mode === 'packung' ? 'active' : ''}`} onClick={() => { setMode('packung'); setCount(1) }}>Ganze Packung · {fmt(prod.packageGrams)} {prod.unit}</button>}
              <button className={`chip green ${mode === 'gramm' ? 'active' : ''}`} onClick={() => setMode('gramm')}>Eigene Menge</button>
            </div>
            {mode === 'gramm'
              ? <div className="row mt"><input className="input" type="number" inputMode="decimal" value={grams} onChange={e => setGrams(Math.max(0, +e.target.value))} aria-label="Menge" /><span className="bold">{prod.unit}</span></div>
              : <div className="row between mt"><span className="small bold">Anzahl</span><Stepper value={count} onChange={setCount} min={0.5} max={10} step={0.5} format={v => `${String(v).replace('.', ',')}×`} /></div>}
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[['Kalorien', 'kcal', 'kcal', '#22C55E'], ['Protein', 'p', 'g', '#3B82F6'], ['Kohlenh.', 'c', 'g', '#F59E0B'], ['Fett', 'f', 'g', '#EC4899'], ['Zucker', 's', 'g', '#8B5CF6'], ['Ballastst.', 'fi', 'g', '#14B8A6']].map(([l, key, u, c]) => (
              <div key={key} className="open-item tint center" style={{ padding: 10, '--tint': c }}><div className="v" style={{ fontSize: 19 }}>{fmt(m[key], key === 'kcal' ? 0 : 1)} <span className="small">{u}</span></div><div className="l">{l}</div></div>
            ))}
          </div>

          <details className="card">
            <summary className="bold small" style={{ cursor: 'pointer' }}>Nährwerte pro 100 {prod.unit} prüfen / korrigieren</summary>
            <div className="grid mt" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {[['kcal', 'Kalorien (kcal)'], ['p', 'Protein (g)'], ['c', 'Kohlenhydrate (g)'], ['s', 'davon Zucker (g)'], ['f', 'Fett (g)'], ['fi', 'Ballaststoffe (g)']].map(([key, l]) => (
                <div key={key} className="field"><label>{l}</label><input className="input" type="number" inputMode="decimal" step="0.1" value={prod.per100[key]} onChange={e => setPer100(key, e.target.value)} /></div>
              ))}
            </div>
          </details>
          {prod.notes && <p className="small muted">💡 {prod.notes}</p>}

          <div className="card">
            <div className="card-title">Mahlzeit</div>
            <div className="chips wrap">{SLOTS.map(s => <button key={s.id} className={`chip green ${slot === s.id ? 'active' : ''}`} onClick={() => setSlot(s.id)}>{s.emoji} {s.label}</button>)}</div>
            <label className="row between mt" style={{ cursor: 'pointer' }}>
              <span className="small">In <b>Meine Produkte</b> speichern (nächstes Mal mit einem Tipp)</span>
              <input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--green)' }} />
            </label>
          </div>
          <button className="btn primary block" style={{ height: 56 }} onClick={confirm} disabled={!amount}><Check size={20} /> {fmt(m.kcal)} kcal eintragen</button>
          <button className="btn block" onClick={() => { setPhotos([]); setProd(null); setPhase('pick') }}>Anderes Produkt</button>
        </>
      )}
    </div>
  )
}
