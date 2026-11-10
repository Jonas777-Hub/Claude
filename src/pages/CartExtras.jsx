import { useState } from 'react'
import { MapPin, Navigation, Loader2, Trophy, Copy, Mail, MessageSquare, Send, Link2, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Crown } from 'lucide-react'
import { useStore } from '../store.jsx'
import { Sheet } from '../components/ui.jsx'
import { BarcodeScanner, lookupBarcode } from '../components/Scanner.jsx'
import { CHAINS, rankStores, detectChain, haversine, cartToText, substitutes, formatAmount } from '../lib/shopping.js'
import { FOODS, FOOD_LIST } from '../data/foods.js'
import { RECIPES } from '../data/recipes.js'
import { remaining, sumEntries, todayKey, fmt } from '../lib/nutrition.js'

const fmtEur = v => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })

// ---------- Supermärkte finden & vergleichen ----------
export function StoresSheet({ onClose }) {
  const { state } = useStore()
  const [q, setQ] = useState('')
  const [st, setSt] = useState({ loading: false, err: '', stores: null, place: '' })
  const items = state.cart.items.filter(i => !i.checked)

  const search = async coords => {
    setSt({ loading: true, err: '', stores: null, place: '' })
    try {
      let pos = coords, place = 'Aktueller Standort'
      if (!pos) {
        const g = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(q)}`)).json()
        if (!g[0]) throw new Error('Adresse nicht gefunden.')
        pos = { lat: +g[0].lat, lon: +g[0].lon }
        place = g[0].display_name.split(',').slice(0, 3).join(',')
      }
      const query = `[out:json][timeout:25];(node["shop"="supermarket"](around:6000,${pos.lat},${pos.lon});way["shop"="supermarket"](around:6000,${pos.lat},${pos.lon}););out center 120;`
      const d = await (await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).json()
      const seen = new Set()
      const stores = d.elements.map(e => {
        const t = e.tags || {}
        const chain = detectChain(t.name, t.brand)
        const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon
        return chain && lat ? { id: e.id, chain, name: t.name || chain, street: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '), city: t['addr:city'] || '', lat, lon, distance: haversine(pos, { lat, lon }), hours: t.opening_hours } : null
      }).filter(Boolean).sort((a, b) => a.distance - b.distance)
        .filter(s => { const k = s.chain + Math.round(s.distance / 150); if (seen.has(k)) return false; seen.add(k); return true })
        .slice(0, 12)
      if (!stores.length) throw new Error('Keine Supermärkte der unterstützten Ketten im Umkreis von 6 km gefunden.')
      setSt({ loading: false, err: '', stores: rankStores(stores, items.length ? items : [{ name: 'Basis', key: 'milch', amount: 1000, unit: 'g' }]), place })
    } catch (e) {
      setSt({ loading: false, err: e.message || 'Suche fehlgeschlagen.', stores: null, place: '' })
    }
  }

  const locate = () => {
    if (!navigator.geolocation) { setSt(s => ({ ...s, err: 'Standort wird nicht unterstützt.' })); return }
    setSt(s => ({ ...s, loading: true }))
    navigator.geolocation.getCurrentPosition(p => search({ lat: p.coords.latitude, lon: p.coords.longitude }), () => setSt({ loading: false, err: 'Standortzugriff verweigert.', stores: null }))
  }

  const best = st.stores?.[0]
  return (
    <Sheet title="Supermärkte finden" onClose={onClose} full>
      <form className="row" onSubmit={e => { e.preventDefault(); if (q.trim()) search() }}>
        <div className="search" style={{ flex: 1 }}><MapPin size={18} /><input className="input" placeholder="Adresse, PLZ oder Ort" value={q} onChange={e => setQ(e.target.value)} /></div>
        <button className="btn primary" type="submit" disabled={!q.trim() || st.loading}>Suchen</button>
      </form>
      <button className="btn block mt-s" onClick={locate} disabled={st.loading}><Navigation size={16} /> Aktuellen Standort verwenden</button>
      <p className="tiny muted mt-s">Gesucht wird nach: {Object.keys(CHAINS).join(', ')} (Daten: OpenStreetMap).</p>

      {st.loading && <div className="center mt-l"><Loader2 className="spin" color="var(--green)" /><p className="small muted mt-s">Suche Supermärkte in deiner Nähe …</p></div>}
      {st.err && <p className="red bold small mt">{st.err}</p>}

      {best && (
        <>
          <div className="card hero mt">
            <div className="row" style={{ gap: 8 }}><Trophy size={18} /> <span className="bold">Empfohlener Supermarkt</span></div>
            <h2 className="mt-s">{best.name}</h2>
            <p className="small" style={{ opacity: .9 }}>{best.street} {best.city} · {(best.distance / 1000).toFixed(1).replace('.', ',')} km</p>
            <p className="small mt-s" style={{ opacity: .9 }}>Beste Kombination aus Verfügbarkeit ({best.availability} %), Preis ({fmtEur(best.price)}) und Entfernung.</p>
            <a className="btn white sm mt" href={`https://www.google.com/maps/dir/?api=1&destination=${best.lat},${best.lon}`} target="_blank" rel="noreferrer"><Navigation size={15} /> Route</a>
          </div>
          <h3 className="section-title">Vergleich {st.place && <span className="small muted">{st.place}</span>}</h3>
          <div className="col" style={{ gap: 10 }}>
            {st.stores.map((s, i) => (
              <div key={s.id} className={`store ${i === 0 ? 'best' : ''}`}>
                <div className="store-logo" style={{ background: CHAINS[s.chain].color, color: ['Netto', 'Edeka'].includes(s.chain) ? '#222' : '#fff' }}>{s.chain.slice(0, 4).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold">{s.name}</div>
                  <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.street || s.city || 'Adresse unbekannt'} · {(s.distance / 1000).toFixed(1).replace('.', ',')} km</div>
                  {s.missing.length > 0 && <div className="tiny orange">Evtl. nicht vorrätig: {s.missing.slice(0, 3).map(m => m.name.split(' (')[0]).join(', ')}{s.missing.length > 3 ? ' …' : ''}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="bold">{s.availability} %</div>
                  <div className="small">{fmtEur(s.price)}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="tiny muted mt">Verfügbarkeit und Preise sind Schätzungen auf Basis des typischen Sortiments und Preisniveaus der Ketten – Supermärkte stellen keine öffentlichen Live-Daten bereit.</p>
        </>
      )}
    </Sheet>
  )
}

// ---------- Einkaufswagen teilen ----------
export function ShareSheet({ onClose }) {
  const { state, shareCart, notify } = useStore()
  const [code, setCode] = useState(state.cart.shared?.code || null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const link = code ? `${location.origin}/cart/${code}` : ''
  const text = `🛒 Unsere gemeinsame Einkaufsliste in Kalora – alle Änderungen in Echtzeit:\n${link}`

  const create = async () => {
    setLoading(true); setErr('')
    try { setCode(await shareCart()) } catch (e) { setErr(e.offline ? 'Zum Teilen wird eine Internetverbindung zum Kalora-Server benötigt.' : e.message) } finally { setLoading(false) }
  }
  const enc = encodeURIComponent
  const targets = [
    { label: 'WhatsApp', icon: MessageSquare, href: `https://wa.me/?text=${enc(text)}`, color: '#25D366' },
    { label: 'Telegram', icon: Send, href: `https://t.me/share/url?url=${enc(link)}&text=${enc('🛒 Unsere gemeinsame Einkaufsliste in Kalora')}`, color: '#2AABEE' },
    { label: 'Signal', icon: MessageSquare, action: async () => { if (navigator.share) { try { await navigator.share({ text }) } catch { /* abgebrochen */ } } else { await navigator.clipboard?.writeText(text); notify('Link kopiert – in Signal einfügen') } }, color: '#3A76F0' },
    { label: 'E-Mail', icon: Mail, href: `mailto:?subject=${enc('Unsere Einkaufsliste (Kalora)')}&body=${enc(text)}`, color: '#6B7280' },
    { label: 'SMS', icon: MessageSquare, href: `sms:?&body=${enc(text)}`, color: '#22C55E' },
    { label: 'Link kopieren', icon: Link2, action: async () => { await navigator.clipboard?.writeText(link); notify('Link kopiert') }, color: '#0B1210' },
  ]
  return (
    <Sheet title="Einkaufswagen teilen" onClose={onClose}>
      {!code ? (
        <div className="col" style={{ gap: 12 }}>
          <p className="text-2">Teile deinen Einkaufswagen per Link. Alle Personen mit dem Link greifen auf dieselbe Liste zu – Hinzufügen, Abhaken und Zuweisen wird <b>in Echtzeit</b> synchronisiert.</p>
          {err && <p className="small red bold">{err}</p>}
          <button className="btn primary block" onClick={create} disabled={loading}>{loading ? <Loader2 className="spin" size={18} /> : <Link2 size={18} />} Freigabelink erstellen</button>
        </div>
      ) : (
        <div className="col" style={{ gap: 14 }}>
          <div className="card tinted center">
            <div className="small muted bold">Freigabelink</div>
            <div className="bold mt-s" style={{ wordBreak: 'break-all', fontSize: 17 }}>{link.replace(/^https?:\/\//, '')}</div>
            <div className="badge mt-s">Code: {code}</div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {targets.map(t => {
              const inner = <><span className="cam-icon" style={{ width: 46, height: 46, borderRadius: 14, background: t.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><t.icon size={20} /></span><span className="small bold">{t.label}</span></>
              return t.href
                ? <a key={t.label} href={t.href} target="_blank" rel="noreferrer" className="col card flat" style={{ alignItems: 'center', gap: 6, padding: 12, textDecoration: 'none', color: 'inherit' }}>{inner}</a>
                : <button key={t.label} onClick={t.action} className="col card flat" style={{ alignItems: 'center', gap: 6, padding: 12 }}>{inner}</button>
            })}
          </div>
          <p className="tiny muted">Offline-Änderungen werden gespeichert und synchronisiert, sobald wieder Internet verfügbar ist.</p>
        </div>
      )}
    </Sheet>
  )
}

// ---------- Shopping Assistant: Produkt im Laden scannen und prüfen ----------
export function AssistantSheet({ onClose }) {
  const { state, targets } = useStore()
  const [p, setP] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const rem = remaining(targets, sumEntries(state.log[todayKey()] || []))

  const onCode = async code => {
    setLoading(true); setErr('')
    try { const r = await lookupBarcode(code); if (!r) setErr('Produkt nicht in Open Food Facts gefunden.'); setP(r) } catch { setErr('Open Food Facts nicht erreichbar.') } finally { setLoading(false) }
  }

  let verdict = null
  if (p) {
    const words = p.name.toLowerCase().split(/[\s–-]+/).filter(w => w.length > 3)
    const cartMatch = state.cart.items.find(i => words.some(w => i.name.toLowerCase().includes(w)))
    const recipeMatch = RECIPES.filter(r => r.ingredients.some(([k]) => words.some(w => FOODS[k]?.name.toLowerCase().includes(w)))).slice(0, 3)
    const pDensity = p.kcal ? (p.p * 4) / p.kcal : 0
    const macroOk = p.s <= 10 && (state.profile.goal !== 'abnehmen' || p.kcal <= 250 || pDensity >= 0.25)
    const closest = FOOD_LIST.map(f => ({ f, d: Math.abs(f.kcal - p.kcal) / 50 + Math.abs(f.p - p.p) / 5 + Math.abs(f.c - p.c) / 10 })).sort((a, b) => a.d - b.d)[0]?.f
    const better = closest ? substitutes(closest.key, 6).filter(s => (s.p * 4) / Math.max(s.kcal, 1) > pDensity + 0.05 || s.s < p.s - 3).slice(0, 2) : []
    verdict = { cartMatch, recipeMatch, macroOk, pDensity, better }
  }

  return (
    <Sheet title="Shopping Assistant" onClose={onClose} full>
      {!p && <><p className="small muted" style={{ marginBottom: 12 }}>Scanne ein Produkt im Laden – Kalora prüft, ob es zu deinen Rezepten und Makros passt und ob es eine bessere Alternative gibt.</p><BarcodeScanner onCode={onCode} /></>}
      {loading && <div className="center mt"><Loader2 className="spin" color="var(--green)" /></div>}
      {err && <p className="red small bold mt">{err}</p>}
      {p && verdict && (
        <div className="col" style={{ gap: 12 }}>
          <div className="card row">
            {p.image && <img src={p.image} alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />}
            <div><div className="bold">{p.name}</div><div className="small muted">{fmt(p.kcal)} kcal · P {fmt(p.p, 1)} · KH {fmt(p.c, 1)} · F {fmt(p.f, 1)} · Zucker {fmt(p.s, 1)} je 100 g</div></div>
          </div>
          <Check ok={!!verdict.cartMatch || verdict.recipeMatch.length > 0} title="Passt zum Rezept?" text={verdict.cartMatch ? `Ja – steht auf deiner Liste: ${formatAmount(verdict.cartMatch)} ${verdict.cartMatch.name}` : verdict.recipeMatch.length ? `Passt zu: ${verdict.recipeMatch.map(r => r.name).join(', ')}` : 'Steht nicht auf deiner Einkaufsliste.'} />
          <Check ok={verdict.macroOk} warn={!verdict.macroOk} title="Passt zu meinen Makros?" text={`${verdict.macroOk ? 'Ja' : 'Eher nicht'} – Zucker ${fmt(p.s, 1)} g/100 g, Proteinanteil ${Math.round(verdict.pDensity * 100)} %. Heute noch offen: ${fmt(rem.kcal)} kcal, ${fmt(rem.s)} g Zucker.`} />
          <Check ok={!verdict.better.length} warn title="Gibt es eine bessere Alternative?" text={verdict.better.length ? `Ja: ${verdict.better.map(b => `${b.name} (P ${b.p} g, Zucker ${b.s} g)`).join(' · ')}` : 'Gute Wahl – keine deutlich bessere Alternative gefunden.'} />
          <button className="btn block" onClick={() => setP(null)}>Nächstes Produkt scannen</button>
        </div>
      )}
    </Sheet>
  )
}

function Check({ ok, warn, title, text }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle
  return (
    <div className="card row" style={{ alignItems: 'flex-start' }}>
      <Icon size={22} color={ok ? 'var(--green)' : warn ? 'var(--orange)' : 'var(--red)'} style={{ flexShrink: 0 }} />
      <div><div className="bold">{title}</div><p className="small text-2 mt-s">{text}</p></div>
    </div>
  )
}

// ---------- Online bestellen (Premium) ----------
export function OrderSheet({ onClose }) {
  const { state, update, notify } = useStore()
  const premium = !!state.settings.premium
  const text = cartToText(state.cart.items.filter(i => !i.checked))
  const partners = [
    { name: 'REWE Lieferservice', url: 'https://shop.rewe.de/', color: '#cc071e' },
    { name: 'Knuspr', url: 'https://www.knuspr.de/', color: '#00a651' },
    { name: 'Bringoo', url: 'https://www.bringoo.de/', color: '#ff5a00' },
  ]
  return (
    <Sheet title="Online bestellen" onClose={onClose}>
      <div className="row" style={{ gap: 8 }}><Crown size={18} color="var(--orange)" /><span className="bold">Kalora Premium</span></div>
      <p className="small text-2 mt-s">Übergib deinen kompletten Einkaufswagen an einen Lieferdienst und lass dir die Zutaten nach Hause bringen.</p>
      {!premium ? (
        <button className="btn primary block mt" onClick={() => { update(s => ({ ...s, settings: { ...s.settings, premium: true } })); notify('Premium-Vorschau aktiviert') }}><Crown size={18} /> Premium-Vorschau aktivieren</button>
      ) : (
        <div className="col mt" style={{ gap: 10 }}>
          {partners.map(p => (
            <a key={p.name} className="store" href={p.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} onClick={() => { navigator.clipboard?.writeText(text).then(() => notify('Einkaufsliste kopiert – im Shop einfügen')).catch(() => {}) }}>
              <div className="store-logo" style={{ background: p.color }}>{p.name[0]}</div>
              <span className="bold" style={{ flex: 1, textAlign: 'left' }}>{p.name}</span>
              <ExternalLink size={16} />
            </a>
          ))}
          <p className="tiny muted">Die Partner bieten derzeit keine öffentliche Warenkorb-Schnittstelle. Kalora kopiert deshalb deine Liste und öffnet den Shop – eine direkte Übergabe wird freigeschaltet, sobald eine Partner-API verfügbar ist.</p>
        </div>
      )}
      <button className="btn block mt" onClick={async () => { await navigator.clipboard?.writeText(text); notify('Liste kopiert') }}><Copy size={16} /> Liste als Text kopieren</button>
    </Sheet>
  )
}
