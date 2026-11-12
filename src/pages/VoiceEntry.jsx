// Spracheingabe: „Was hast du gegessen?" sagen → Kalora erkennt Lebensmittel & Mengen und rechnet die Kalorien
import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2, Sparkles, Trash2, Plus, Check, AlertTriangle } from 'lucide-react'
import { useStore } from '../store.jsx'
import { analyzeText } from '../lib/ai.js'
import { parseSpokenMeal } from '../lib/voiceParse.js'
import { FOODS, nutrientsFor, searchFoods } from '../data/foods.js'
import { SLOTS, fmt } from '../lib/nutrition.js'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
// Innerhalb von claude.ai sperrt Claude das Mikrofon für die Seite (außer über die eigene Diktierfunktion)
const IN_CLAUDE = typeof window !== 'undefined' && !!window.claude
const IS_IOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const fromDb = (key, grams, name) => {
  const n = nutrientsFor(key, grams)
  return { name: name || FOODS[key].name, key, grams, kcal: n.kcal, protein: n.p, carbs: n.c, fat: n.f, sugar: n.s, fiber: n.fi }
}
const EXAMPLES = ['Zwei Eier, eine Scheibe Vollkornbrot mit Butter und ein Kaffee mit Milch', 'Ein Teller Nudeln mit Hackfleisch-Tomatensauce', '250 g Skyr mit Himbeeren und einer Banane']

export default function VoiceEntry({ ai, slot, setSlot, onDone }) {
  const { addEntries, notify } = useStore()
  const [text, setText] = useState('')
  const [rec, setRec] = useState(false)
  const [micErr, setMicErr] = useState('')
  const [phase, setPhase] = useState('input') // input | thinking | result
  const [items, setItems] = useState([])
  const [dish, setDish] = useState('')
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState('')
  const recRef = useRef(null)
  const baseText = useRef('')

  const taRef = useRef(null)
  const dictRef = useRef(null)
  const watchdog = useRef(null)
  // Claude-eigene Diktierfunktion (claude.ai im Computer-Browser / Android-Chrome) – vorab laden,
  // weil start() direkt im Tipp aufgerufen werden muss
  useEffect(() => {
    let alive = true, offs = []
    window.claude?.use?.('dictation').then(d => {
      if (!alive || !d) return
      dictRef.current = d
      offs = [
        d.onPartial(({ text: t }) => setText(baseText.current + t)),
        d.onFinal(({ text: t }) => { baseText.current = (baseText.current + t).replace(/^\s+/, ''); setText(baseText.current) }),
        d.onState(({ state, reason }) => {
          setRec(state === 'starting' || state === 'listening' || state === 'finishing')
          if (state === 'idle' && ['not_granted', 'unavailable', 'upstream_error'].includes(reason)) keyboardMode()
        }),
      ]
    }).catch(() => {})
    return () => { alive = false; offs.forEach(f => f?.()); recRef.current?.abort?.(); clearTimeout(watchdog.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback, der immer geht: Textfeld öffnen → Mikrofon der Tastatur
  const keyboardMode = () => {
    setRec(false)
    setMicErr('keyboard')
    const el = taRef.current
    if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length) }
  }

  const start = () => {
    setMicErr('')
    baseText.current = text ? text.trim() + ' ' : ''
    // 1) Claude-Diktat (muss synchron im Tipp starten)
    if (dictRef.current) {
      dictRef.current.start({ language: 'de' }).catch(e => { if (e?.code !== 'stopped' && e?.code !== 'dismissed') keyboardMode() })
      return
    }
    // 2) In claude.ai ohne Diktat (z. B. iPhone-App) oder ohne Spracherkennung: Tastatur-Mikrofon
    if (IN_CLAUDE || !SR) { keyboardMode(); return }
    // 3) Spracherkennung des Browsers (Safari, Chrome) – mit Absicherung, falls sie stumm bleibt
    try {
      const r = new SR()
      r.lang = 'de-DE'; r.interimResults = true; r.continuous = true
      baseText.current = text ? text.trim() + ' ' : ''
      r.onresult = ev => {
        let s = ''
        for (let i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript
        setText(baseText.current + s)
      }
      let heard = false
      r.onstart = r.onaudiostart = () => { heard = true }
      r.onresult = (orig => ev => { heard = true; orig(ev) })(r.onresult)
      r.onerror = ev => { clearTimeout(watchdog.current); if (ev.error === 'no-speech' || ev.error === 'aborted') { setRec(false); return } keyboardMode() }
      r.onend = () => { clearTimeout(watchdog.current); setRec(false) }
      r.start()
      watchdog.current = setTimeout(() => { if (!heard) { try { r.abort() } catch { /* egal */ } keyboardMode() } }, 4000)
      recRef.current = r
      setRec(true)
    } catch { setMicErr('keyboard') }
  }
  const stop = () => { clearTimeout(watchdog.current); if (dictRef.current?.active()) dictRef.current.stop(); recRef.current?.stop(); setRec(false) }

  const calculate = async () => {
    if (rec) stop()
    if (!text.trim()) return
    setPhase('thinking')
    let result = null
    if (ai?.enabled) {
      try {
        const r = await analyzeText({ text })
        result = { dish: r.dish, note: r.notes, items: r.items.map((it, i) => ({ ...(it.key && FOODS[it.key] ? fromDb(it.key, it.grams, it.name) : it), id: i })) }
      } catch { /* weiter mit Offline-Auswertung */ }
    }
    if (!result || !result.items.length) {
      const { items: found, unknown } = parseSpokenMeal(text)
      result = { dish: found.map(i => i.name.split(' (')[0]).join(', '), note: unknown.length ? `Nicht erkannt: ${unknown.join(', ')} – unten über „Lebensmittel hinzufügen" ergänzen.` : '', items: found.map((it, i) => ({ ...fromDb(it.key, it.grams, it.name), id: i })) }
    }
    if (!result.items.length) { setPhase('input'); setMicErr('Ich habe kein Lebensmittel erkannt. Sag z. B. „zwei Eier und eine Banane".'); return }
    setItems(result.items); setDish(result.dish || 'Mahlzeit'); setNote(result.note || ''); setPhase('result')
  }

  const setGrams = (id, g) => setItems(l => l.map(it => {
    if (it.id !== id) return it
    if (it.key && FOODS[it.key]) return { ...fromDb(it.key, g, it.name), id }
    const k = it.grams ? g / it.grams : 1
    return { ...it, grams: g, kcal: it.kcal * k, protein: it.protein * k, carbs: it.carbs * k, fat: it.fat * k, sugar: it.sugar * k, fiber: it.fiber * k }
  }))
  const tot = items.reduce((a, it) => ({ kcal: a.kcal + it.kcal, p: a.p + it.protein, c: a.c + it.carbs, f: a.f + it.fat, s: a.s + it.sugar, fi: a.fi + it.fiber, g: a.g + it.grams }), { kcal: 0, p: 0, c: 0, f: 0, s: 0, fi: 0, g: 0 })

  const save = () => {
    addEntries([{ slot, name: dish, source: 'sprache', grams: tot.g, kcal: tot.kcal, p: tot.p, c: tot.c, f: tot.f, s: tot.s, fi: tot.fi, items: items.map(i => ({ name: i.name, grams: i.grams })) }])
    notify(`${fmt(tot.kcal)} kcal zu ${SLOTS.find(s => s.id === slot).label} hinzugefügt`)
    onDone()
  }

  if (phase === 'thinking') return (
    <div className="center mt-l">
      <Loader2 className="spin" size={30} color="var(--green)" />
      <p className="bold mt-s">Kalora rechnet die Kalorien aus …</p>
      <p className="small muted">„{text.slice(0, 120)}{text.length > 120 ? '…' : ''}"</p>
    </div>
  )

  if (phase === 'result') return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card">
        <div className="small muted bold">Das hast du gegessen</div>
        <input className="input mt-s" style={{ fontWeight: 800, fontSize: 17 }} value={dish} onChange={e => setDish(e.target.value)} aria-label="Name der Mahlzeit" />
        <div className="grid mt" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[['Kalorien', tot.kcal, 'kcal', '#22C55E'], ['Protein', tot.p, 'g', '#3B82F6'], ['Kohlenh.', tot.c, 'g', '#F59E0B'], ['Fett', tot.f, 'g', '#EC4899'], ['Zucker', tot.s, 'g', '#8B5CF6'], ['Ballastst.', tot.fi, 'g', '#14B8A6']].map(([l, v, u, c]) => (
            <div key={l} className="open-item tint center" style={{ padding: 10, '--tint': c }}><div className="v" style={{ fontSize: 19 }}>{fmt(v)} <span className="small">{u}</span></div><div className="l">{l}</div></div>
          ))}
        </div>
        {note && <p className="small muted mt">💡 {note}</p>}
      </div>
      <div className="card">
        <div className="card-title">Lebensmittel & Mengen prüfen</div>
        <div className="list">
          {items.map(it => (
            <div key={it.id} className="list-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bold small">{it.name}</div>
                <div className="tiny muted">{fmt(it.kcal)} kcal · P {fmt(it.protein)} · KH {fmt(it.carbs)} · F {fmt(it.fat)}</div>
              </div>
              <input className="input" type="number" inputMode="numeric" style={{ width: 80, height: 38 }} value={Math.round(it.grams)} onChange={e => setGrams(it.id, Math.max(0, +e.target.value))} aria-label="Gramm" />
              <span className="small muted">g</span>
              <button className="icon-btn sm plain" onClick={() => setItems(l => l.filter(x => x.id !== it.id))} aria-label="Entfernen"><Trash2 size={16} color="var(--red)" /></button>
            </div>
          ))}
        </div>
        <div className="search mt-s"><Plus size={18} /><input className="input" placeholder="Lebensmittel hinzufügen …" value={adding} onChange={e => setAdding(e.target.value)} /></div>
        {adding && <div className="list mt-s">{searchFoods(adding, 6).map(f => (
          <button key={f.key} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => { setItems(l => [...l, { ...fromDb(f.key, f.piece || 100), id: Date.now() }]); setAdding('') }}>
            <span style={{ flex: 1 }}>{f.name}</span><span className="small muted">{f.kcal} kcal/100 g</span>
          </button>))}</div>}
      </div>
      <div className="card">
        <div className="card-title">Mahlzeit</div>
        <div className="chips wrap">{SLOTS.map(s => <button key={s.id} className={`chip green ${slot === s.id ? 'active' : ''}`} onClick={() => setSlot(s.id)}>{s.emoji} {s.label}</button>)}</div>
      </div>
      <button className="btn primary block" style={{ height: 56 }} onClick={save} disabled={!items.length}><Check size={20} /> {fmt(tot.kcal)} kcal eintragen</button>
      <button className="btn block" onClick={() => setPhase('input')}>Nochmal sprechen</button>
    </div>
  )

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card center" style={{ padding: 22 }}>
        <button onClick={rec ? stop : start} aria-label={rec ? 'Aufnahme beenden' : 'Sprachaufnahme starten'}
          style={{ width: 96, height: 96, borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: rec ? 'var(--red)' : 'var(--grad-green)', boxShadow: rec ? '0 0 0 12px rgba(239,68,68,.18)' : '0 12px 30px rgba(34,197,94,.4)', transition: 'all .2s' }}>
          {rec ? <Square size={34} fill="#fff" /> : <Mic size={40} />}
        </button>
        <h3 className="mt">{rec ? 'Ich höre zu … tippe zum Beenden' : 'Tippe und sag, was du gegessen hast'}</h3>
        <p className="small muted mt-s">z. B. „{EXAMPLES[0]}"</p>
      </div>

      {micErr === 'keyboard' ? (
        <div className="card" style={{ background: 'color-mix(in srgb, #22C55E 12%, var(--card))', borderColor: 'color-mix(in srgb, #22C55E 35%, transparent)' }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span style={{ fontSize: 30, lineHeight: 1 }}>🎤</span>
            <div className="small">
              <b style={{ fontSize: 15 }}>Jetzt auf der Tastatur auf das Mikrofon tippen</b>
              <div className="mt-s">{IS_IOS ? <>Unten <b>rechts neben der Leertaste</b> (oder unten rechts unter der Tastatur) ist das 🎤. Antippen, sprechen, dann nochmal antippen – der Text erscheint im Feld.</> : <>Auf der Tastatur das 🎤 antippen und sprechen – der Text erscheint im Feld.</>}</div>
              <div className="tiny muted mt-s">Kein 🎤 zu sehen? {IS_IOS ? 'Einstellungen → Allgemein → Tastatur → „Diktierfunktion" einschalten.' : 'In den Tastatur-Einstellungen die Spracheingabe einschalten.'}</div>
            </div>
          </div>
        </div>
      ) : micErr && (
        <div className="card tinted row" style={{ alignItems: 'flex-start' }}><AlertTriangle size={20} color="var(--orange)" style={{ flexShrink: 0 }} /><p className="small">{micErr}</p></div>
      )}

      <div className="field">
        <label htmlFor="voice-text">Was hast du gegessen?</label>
        <textarea ref={taRef} id="voice-text" className="input" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Sprich oder schreib: z. B. zwei Eier, 150 g Reis und ein Apfel" />
      </div>
      {!text && <div className="chips wrap">{EXAMPLES.slice(1).map(e => <button key={e} className="chip" style={{ height: 'auto', padding: '6px 12px', fontSize: 13 }} onClick={() => setText(e)}>{e}</button>)}</div>}
      <button className="btn primary block" style={{ height: 56 }} onClick={calculate} disabled={!text.trim()}><Sparkles size={18} /> Kalorien berechnen</button>
      {!ai?.enabled && <p className="tiny muted center">Erkennt Mengen wie „2 Eier", „150 g Reis", „eine Scheibe Brot", „ein Glas Milch".</p>}
    </div>
  )
}
