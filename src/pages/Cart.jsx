import { useMemo, useState } from 'react'
import { Share2, Plus, ScanLine, Trash2, Store, Package, History, UserPlus, Users, Wifi, WifiOff, Star, Repeat, Truck, ScanSearch, X } from 'lucide-react'
import { useStore } from '../store.jsx'
import { Sheet, Empty, Segmented } from '../components/ui.jsx'
import { BarcodeScanner, lookupBarcode } from '../components/Scanner.jsx'
import { CATEGORIES, FOODS, FOOD_LIST, foodMatchesDislike } from '../data/foods.js'
import { UNITS, cartSummary, formatAmount, groupByCategory, guessCategory, newId, substitutes, suggestProducts } from '../lib/shopping.js'
import { StoresSheet, ShareSheet, AssistantSheet, OrderSheet } from './CartExtras.jsx'

const fmtEur = v => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

export default function Cart() {
  const { state, update, cartOp, actor, online, leaveCart, notify } = useStore()
  const cart = state.cart
  const [view, setView] = useState('alle')
  const [sheet, setSheet] = useState(null)
  const [assignFor, setAssignFor] = useState(null)
  const [subFor, setSubFor] = useState(null)
  const sum = cartSummary(cart.items)
  const mine = cart.items.filter(i => i.assignee === actor)
  const visible = view === 'meine' ? mine : view === 'offen' ? cart.items.filter(i => !i.checked) : cart.items
  const groups = groupByCategory(visible)
  const members = useMemo(() => [...new Set([actor, ...(cart.online || []), ...cart.items.map(i => i.assignee).filter(Boolean), ...cart.items.map(i => i.addedBy).filter(Boolean), ...(cart.activity || []).map(a => a.actor)])].filter(Boolean), [actor, cart])

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="sub row" style={{ gap: 6 }}>
            {cart.shared ? <>{online ? <Wifi size={13} color="var(--green)" /> : <WifiOff size={13} />} Geteilt · {cart.shared.code}</> : 'Nur auf diesem Gerät'}
          </div>
          <h1>Einkaufswagen</h1>
        </div>
        <button className="btn primary sm" onClick={() => setSheet('share')}><Share2 size={16} /> Teilen</button>
      </header>

      {cart.shared && (cart.online?.length || 0) > 0 && (
        <div className="row small muted" style={{ marginTop: -8, marginBottom: 12, gap: 6 }}>
          <Users size={14} /> Gerade aktiv: {cart.online.join(', ')}
        </div>
      )}

      <div className="card hero">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <div><div className="kcal-big" style={{ fontSize: 26 }}>{sum.open}</div><div className="small muted bold">Artikel offen</div></div>
          <div><div className="kcal-big" style={{ fontSize: 26 }}>{sum.recipes}</div><div className="small muted bold">Rezepte</div></div>
          <div><div className="kcal-big" style={{ fontSize: 26 }}>{fmtEur(sum.cost)}</div><div className="small muted bold">geschätzt</div></div>
        </div>
        <div className="row mt" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn white sm" onClick={() => setSheet('stores')}><Store size={16} /> Supermärkte finden</button>
          <button className="btn white sm" onClick={() => setSheet('assistant')}><ScanSearch size={16} /> Shopping Assistant</button>
          <button className="btn white sm" onClick={() => setSheet('order')}><Truck size={16} /> Online bestellen</button>
        </div>
      </div>

      <AddProduct />

      {state.favorites.length > 0 && (
        <>
          <h2 className="section-title"><span className="row" style={{ gap: 8 }}><Star size={18} color="var(--orange)" /> Meine Favoriten</span></h2>
          <div className="chips">
            {[...state.favorites].sort((a, b) => (b.pinned - a.pinned) || (b.count || 0) - (a.count || 0)).slice(0, 14).map(f => (
              <button key={f.name} className="chip" onClick={() => { cartOp({ type: 'add', item: { id: newId(), key: f.key, name: f.name, amount: f.amount || 1, unit: f.unit || 'Stück', cat: f.cat, checked: false, assignee: null, recipes: [], updatedAt: Date.now() } }); notify(`${f.name} hinzugefügt`) }}>
                <Plus size={14} /> {f.name}{f.count > 1 ? <span className="muted"> ×{f.count}</span> : null}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="row mt" style={{ gap: 8 }}>
        <div style={{ flex: 1 }}><Segmented value={view} onChange={setView} options={[{ id: 'alle', label: `Alle (${cart.items.length})` }, { id: 'offen', label: 'Offen' }, { id: 'meine', label: `Für mich (${mine.length})` }]} /></div>
      </div>

      {cart.items.length === 0 ? (
        <div className="card mt"><Empty emoji="🛒" title="Dein Einkaufswagen ist leer" text="Füge Rezepte hinzu oder trage Produkte manuell ein. Gleiche Zutaten werden automatisch zusammengeführt." /></div>
      ) : visible.length === 0 ? (
        <div className="card mt"><Empty emoji="🙌" title={view === 'meine' ? 'Dir ist nichts zugewiesen' : 'Alles erledigt!'} /></div>
      ) : (
        groups.map(g => (
          <section key={g.cat}>
            <h3 className="section-title" style={{ fontSize: 16, marginTop: 18 }}>{g.emoji} {g.name}<span className="small muted">{g.items.filter(i => !i.checked).length} offen</span></h3>
            <div className="card" style={{ padding: '4px 14px' }}>
              <div className="list">
                {g.items.map(it => (
                  <div key={it.id} className="list-item">
                    <button className={`check ${it.checked ? 'on' : ''}`} onClick={() => cartOp({ type: 'update', id: it.id, patch: { checked: !it.checked } })} aria-label={it.checked ? 'Als offen markieren' : 'Als gekauft markieren'}>{it.checked ? '✓' : ''}</button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={`bold ${it.checked ? 'struck' : ''}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name.split(' (')[0]}</div>
                      <div className="small text-2">{formatAmount(it)}</div>
                      <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.checked ? '✅ gekauft' : '⏳ offen'}{it.recipes?.length ? ` · ${it.recipes.length > 1 ? `${it.recipes.length} Rezepte` : it.recipes[0]}` : ''}</div>
                    </div>
                    {it.assignee
                      ? <button className="badge" onClick={() => setAssignFor(it)}>{it.assignee}</button>
                      : <button className="icon-btn sm plain" onClick={() => setAssignFor(it)} aria-label="Person zuweisen"><UserPlus size={15} /></button>}
                    {it.key && !it.checked && <button className="icon-btn sm plain" onClick={() => setSubFor(it)} aria-label="Ersatzprodukte"><Repeat size={15} /></button>}
                    <button className="icon-btn sm plain" onClick={() => cartOp({ type: 'remove', id: it.id })} aria-label="Entfernen"><Trash2 size={15} color="var(--red)" /></button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))
      )}

      {sum.done > 0 && <button className="btn block mt" onClick={() => cartOp({ type: 'clearChecked' })}><Trash2 size={16} /> Gekaufte Artikel entfernen ({sum.done})</button>}

      <Pantry />

      <h2 className="section-title"><span className="row" style={{ gap: 8 }}><History size={18} /> Wer hat was geändert?</span></h2>
      <div className="card">
        {(cart.activity || []).length === 0 ? <p className="small muted">Noch keine Aktivität.</p> : (
          <div className="list">
            {cart.activity.slice(0, 15).map((a, i) => (
              <div key={i} className="list-item" style={{ padding: '8px 2px' }}>
                <span className="small muted" style={{ width: 44 }}>{new Date(a.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="avatar sm">{a.actor[0]?.toUpperCase()}</span>
                <span className="small"><b>{a.actor}</b> {a.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.shared && <button className="btn ghost block mt" onClick={() => { leaveCart(); notify('Geteilten Einkaufswagen verlassen') }}>Geteilten Einkaufswagen verlassen</button>}
      {!cart.shared && cart.items.length > 0 && <button className="btn ghost block mt danger" onClick={() => { if (confirm('Einkaufswagen wirklich leeren?')) cartOp({ type: 'clearAll' }) }}>Einkaufswagen leeren</button>}

      {assignFor && (
        <Sheet title={`${assignFor.name} zuweisen`} onClose={() => setAssignFor(null)}>
          <p className="small muted">Jede Person sieht unter „Für mich" nur die Produkte, die sie kaufen soll.</p>
          <AssignPicker members={members} current={assignFor.assignee} onPick={name => { cartOp({ type: 'update', id: assignFor.id, patch: { assignee: name } }); setAssignFor(null) }} />
        </Sheet>
      )}
      {subFor && (
        <Sheet title="Ersatzprodukte" onClose={() => setSubFor(null)}>
          <p className="small muted">Falls <b>{subFor.name}</b> nicht verfügbar ist – Alternativen mit möglichst identischen Makros:</p>
          <div className="list mt">
            {substitutes(subFor.key, 4, o => !state.dislikes.some(d => foodMatchesDislike(o.key, d))).map(s => (
              <button key={s.key} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => { cartOp({ type: 'update', id: subFor.id, patch: { key: s.key, name: s.name } }); setSubFor(null); notify(`Ersetzt durch ${s.name}`) }}>
                <div className="thumb contain">{s.image ? <img src={s.image} alt="" /> : '🔁'}</div>
                <span style={{ flex: 1 }}><div className="bold">{s.name}</div><div className="tiny muted">{s.kcal} kcal · P {s.p} · KH {s.c} · F {s.f} je 100 g</div></span>
                <span className="badge">{s.similarity}% ähnlich</span>
              </button>
            ))}
          </div>
          <p className="tiny muted mt">Original: {FOODS[subFor.key]?.kcal} kcal · P {FOODS[subFor.key]?.p} · KH {FOODS[subFor.key]?.c} · F {FOODS[subFor.key]?.f} je 100 g</p>
        </Sheet>
      )}
      {sheet === 'share' && <ShareSheet onClose={() => setSheet(null)} />}
      {sheet === 'stores' && <StoresSheet onClose={() => setSheet(null)} />}
      {sheet === 'assistant' && <AssistantSheet onClose={() => setSheet(null)} />}
      {sheet === 'order' && <OrderSheet onClose={() => setSheet(null)} />}
    </div>
  )
}

function AssignPicker({ members, current, onPick }) {
  const [name, setName] = useState('')
  return (
    <div className="col mt" style={{ gap: 8 }}>
      {members.map(m => <button key={m} className={`choice ${current === m ? 'active' : ''}`} style={{ padding: 12 }} onClick={() => onPick(m)}><span className="avatar sm">{m[0].toUpperCase()}</span><span className="t" style={{ fontSize: 15 }}>{m}</span></button>)}
      <form className="row" onSubmit={e => { e.preventDefault(); if (name.trim()) onPick(name.trim()) }}>
        <input className="input" placeholder="Andere Person (Name)" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn primary" type="submit">OK</button>
      </form>
      {current && <button className="btn ghost" onClick={() => onPick(null)}>Zuweisung entfernen</button>}
    </div>
  )
}

function AddProduct() {
  const { state, cartOp, notify } = useStore()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(1)
  const [unit, setUnit] = useState('Stück')
  const [key, setKey] = useState(null)
  const [cat, setCat] = useState(null)
  const [scan, setScan] = useState(false)
  const [focus, setFocus] = useState(false)
  const sugg = focus ? suggestProducts(name, state.favorites) : []

  const add = (n = name, k = key, c = cat, a = amount, u = unit) => {
    if (!n.trim()) return
    cartOp({ type: 'add', item: { id: newId(), key: k, name: n.trim(), amount: Number(a) || 1, unit: u, cat: c || (k ? FOODS[k]?.cat : guessCategory(n)), checked: false, assignee: null, recipes: [], updatedAt: Date.now() } })
    notify(`${n.trim()} hinzugefügt`)
    setName(''); setAmount(1); setUnit('Stück'); setKey(null); setCat(null)
  }

  const onCode = async code => {
    setScan(false)
    try {
      const p = await lookupBarcode(code)
      if (!p) { notify('Produkt nicht gefunden – bitte Namen eingeben', 'err'); return }
      add(p.name, null, guessCategory(p.name), 1, 'Packung')
    } catch { notify('Open Food Facts nicht erreichbar', 'err') }
  }

  return (
    <div className="card mt">
      <div className="card-title">Produkt hinzufügen</div>
      <div style={{ position: 'relative' }}>
        <div className="row">
          <input className="input" placeholder="z. B. Milch, Bananen, Cola Zero …" value={name} onChange={e => { setName(e.target.value); setKey(null) }} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} onKeyDown={e => e.key === 'Enter' && add()} aria-label="Produktname" />
          <button className="icon-btn" style={{ height: 48, width: 48 }} onClick={() => setScan(true)} aria-label="Barcode scannen"><ScanLine size={20} /></button>
        </div>
        {sugg.length > 0 && (
          <div className="card" style={{ position: 'absolute', left: 0, right: 0, top: 54, zIndex: 5, padding: 6, boxShadow: 'var(--shadow-lg)' }}>
            {sugg.map(s => (
              <button key={s.name} className="list-item" style={{ width: '100%', textAlign: 'left', padding: '9px 8px' }} onMouseDown={e => e.preventDefault()} onClick={() => { setName(s.name); setKey(s.key); setCat(s.cat); setUnit(s.unit === 'g' ? 'g' : s.unit); setAmount(s.unit === 'g' ? 500 : 1); setFocus(false) }}>
                <span>{CATEGORIES[s.cat]?.emoji || '🛒'}</span><span style={{ flex: 1 }}>{s.name}</span><span className="tiny muted">{CATEGORIES[s.cat]?.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="row mt-s">
        <input className="input" type="number" inputMode="decimal" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: 90 }} aria-label="Menge" />
        <select className="input" value={unit} onChange={e => setUnit(e.target.value)} style={{ flex: 1 }} aria-label="Einheit">
          {UNITS.map(u => <option key={u} value={u}>{u === 'Packung' ? 'Packungen' : u === 'kg' ? 'Kilogramm' : u === 'g' ? 'Gramm' : u === 'l' ? 'Liter' : u}</option>)}
        </select>
        <button className="btn primary" onClick={() => add()}><Plus size={18} /></button>
      </div>
      {scan && <Sheet title="Barcode scannen" onClose={() => setScan(false)}><BarcodeScanner onCode={onCode} /></Sheet>}
    </div>
  )
}

function Pantry() {
  const { state, update } = useStore()
  const [q, setQ] = useState('')
  const quick = ['reis', 'spaghetti', 'ei', 'gewuerze', 'mehl', 'milch', 'olivenoel', 'zwiebel', 'knoblauch', 'sojasauce', 'haferflocken', 'zucker']
  const has = k => state.pantry.some(p => p.key === k)
  const toggle = (k, name) => update(s => ({ ...s, pantry: s.pantry.some(p => (k ? p.key === k : p.name === name)) ? s.pantry.filter(p => !(k ? p.key === k : p.name === name)) : [...s.pantry, { key: k, name: name || FOODS[k]?.name }] }))
  const matches = q ? FOOD_LIST.filter(f => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : []
  return (
    <>
      <h2 className="section-title"><span className="row" style={{ gap: 8 }}><Package size={18} /> Vorratskammer</span></h2>
      <div className="card">
        <p className="small muted">Was du zuhause hast, wird beim Hinzufügen von Rezepten automatisch von der Einkaufsliste abgezogen.</p>
        <div className="chips wrap mt">
          {state.pantry.map(p => <button key={p.key || p.name} className="chip green active" onClick={() => toggle(p.key, p.name)}>{p.name?.split(' (')[0]} <X size={13} className="x" /></button>)}
        </div>
        <div className="small bold text-2 mt">Schnell hinzufügen</div>
        <div className="chips wrap mt-s">
          {quick.filter(k => !has(k)).map(k => <button key={k} className="chip" onClick={() => toggle(k)}><Plus size={13} /> {FOODS[k].name.split(' (')[0]}</button>)}
        </div>
        <input className="input mt" placeholder="Weitere Vorräte suchen …" value={q} onChange={e => setQ(e.target.value)} />
        {matches.map(f => <button key={f.key} className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => { toggle(f.key); setQ('') }}><Plus size={14} /> {f.name}</button>)}
      </div>
    </>
  )
}
