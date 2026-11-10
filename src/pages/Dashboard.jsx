import { useMemo, useState } from 'react'
import { Camera, Search, TrendingUp, MessageCircle, RefreshCw, Droplets, Plus, Minus, Sparkles, CheckCircle2 } from 'lucide-react'
import { useStore } from '../store.jsx'
import { useUI } from '../App.jsx'
import { Ring, NutrientRing, RecipeImage, MacroLine, FoodBackdrop, TINT } from '../components/ui.jsx'
import { NUTRIENTS, fmt, nutrientStatus, remaining, sumEntries, todayKey } from '../lib/nutrition.js'
import { learnPreferences, todayPlan } from '../lib/recommend.js'

export function SyncDot({ light }) {
  const { sync, online, user } = useStore()
  const map = { synced: ['var(--green)', 'Synchronisiert'], pending: ['var(--orange)', 'Speichert …'], offline: ['var(--muted)', 'Offline'], error: ['var(--red)', 'Sync-Fehler'], local: ['var(--muted)', 'Nur lokal'] }
  const [c, l] = !online ? map.offline : map[user ? sync.status : 'local'] || map.local
  return <span className={`row tiny ${light ? '' : 'muted'}`} style={{ gap: 5, opacity: light ? .85 : 1 }} title={l}><span className="sync-dot" style={{ background: c }} />{l}</span>
}

export default function Dashboard() {
  const { state, targets, addWater, user } = useStore()
  const { open, go } = useUI()
  const [seed, setSeed] = useState(0)
  const today = todayKey()
  const entries = state.log[today] || []
  const consumed = sumEntries(entries)
  const rem = remaining(targets, consumed)
  const prefs = useMemo(() => learnPreferences(state.ratings, state.cooked), [state.ratings, state.cooked])
  const loggedSlots = [...new Set(entries.map(e => e.slot))]
  // Vorschläge orientieren sich an den noch offenen Kalorien & Makros, verteilt auf die offenen Mahlzeiten
  const remKey = `${Math.round(rem.kcal / 50)}-${Math.round(rem.p / 5)}`
  const plan = useMemo(() => todayPlan({ rem, loggedSlots, goal: state.profile.goal, prefs, ratings: state.ratings, dislikes: state.dislikes, seed }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [remKey, state.profile.goal, prefs, state.ratings, state.dislikes, seed, loggedSlots.join()])
  const kcalSt = nutrientStatus('kcal', consumed.kcal, targets.kcal)
  const water = state.water[today] || 0
  const name = state.settings.displayName || state.profile.name || user?.name
  const hour = new Date().getHours()
  const greet = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend'
  const dateStr = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <section className="hero-food">
        <FoodBackdrop ids={['honig-balsamico-haehnchen', 'lachs-avocado-salat', 'shakshuka', 'pad-thai', 'tofu-cashew-wok', 'pancakes-beeren']} blur />
        <span className="food-shade" />
        <div className="inner on-photo">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="sub small bold" style={{ textTransform: 'capitalize' }}>{dateStr}</div>
              <h1>{greet}{name ? `, ${name}` : ''} 👋</h1>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="icon-btn" onClick={() => go('verlauf')} aria-label="Verlauf"><TrendingUp size={19} /></button>
              <button className="icon-btn" onClick={() => go('coach')} aria-label="KI-Coach"><MessageCircle size={19} /></button>
              <button className="avatar" onClick={() => go('profil')} aria-label="Profil">{(name || 'K')[0].toUpperCase()}</button>
            </div>
          </div>
          <div className="row mt" style={{ gap: 16 }}>
            <Ring value={consumed.kcal} max={targets.kcal} size={128} stroke={13} color={kcalSt.state === 'ok' ? '#ffffff' : kcalSt.color}>
              <div className="kcal-big" style={{ fontSize: 28 }}>{fmt(Math.abs(targets.kcal - consumed.kcal))}</div>
              <div className="tiny bold" style={{ opacity: .85 }}>{consumed.kcal > targets.kcal ? 'kcal zu viel' : 'kcal offen'}</div>
            </Ring>
            <div className="col" style={{ gap: 6, flex: 1, minWidth: 0 }}>
              <div className="tiny bold" style={{ opacity: .85, textTransform: 'uppercase', letterSpacing: '.08em' }}>Kalorien heute</div>
              <div className="kcal-big" style={{ fontSize: 34 }}>{fmt(consumed.kcal)}<span style={{ fontSize: 16, opacity: .8 }}> / {fmt(targets.kcal)}</span></div>
              <div className="bar" style={{ background: 'rgba(255,255,255,.2)', height: 8 }}><div style={{ width: `${Math.min(100, (consumed.kcal / targets.kcal) * 100)}%`, background: kcalSt.state === 'ok' ? '#fff' : kcalSt.color }} /></div>
              <SyncDot light />
            </div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><div className="v">{fmt(consumed.kcal)}</div><div className="l">Verbraucht</div></div>
            <div className="hero-stat"><div className="v">{fmt(rem.kcal)}</div><div className="l">Verfügbar</div></div>
            <div className="hero-stat"><div className="v">{fmt(targets.kcal)}</div><div className="l">Tagesziel</div></div>
          </div>
        </div>
      </section>

      <div>
        {/* Heute noch verfügbar */}
        <section className="card">
          <div className="card-title">Heute noch verfügbar</div>
          <div className="open-list">
            {NUTRIENTS.filter(n => n.key !== 'c').map(n => {
              const st = nutrientStatus(n.key, consumed[n.key], targets[n.key])
              const over = consumed[n.key] - targets[n.key]
              return (
                <div key={n.key} className="open-item tint" style={{ '--tint': TINT[n.key] }}>
                  <div className="v" style={{ color: st.state === 'über' ? 'var(--red)' : undefined }}>
                    {over > 0 && n.type === 'limit' ? `+${fmt(over)}` : fmt(rem[n.key])} <span style={{ fontSize: 13 }}>{n.unit}</span>
                  </div>
                  <div className="l">{n.label} {over > 0 && n.type === 'limit' ? 'zu viel' : st.state === 'erreicht' ? '✓ erreicht' : 'offen'}</div>
                  <div className="bar"><div style={{ width: `${Math.min(100, st.ratio * 100)}%`, background: st.color }} /></div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Kamera */}
      <div className="grid-2 mt">
        <button className="camera-btn" onClick={() => open('photo')}>
          <FoodBackdrop ids={['haehnchen-shawarma', 'ofenlachs-fenchel', 'gefuellte-paprika-quinoa']} />
          <span className="food-shade" />
          <span className="cam-icon"><Camera size={32} /></span>
          <span><h3>Essen fotografieren</h3><p>KI erkennt Gericht, Portion & Nährwerte</p></span>
        </button>
        <button className="card row" style={{ gap: 14, textAlign: 'left' }} onClick={() => open('search')}>
          <span className="cam-icon" style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--green-soft)', color: 'var(--green-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Search size={24} /></span>
          <span><div className="bold">Lebensmittel suchen</div><div className="small muted">Datenbank, Barcode & Open Food Facts</div></span>
        </button>
      </div>

      {/* Ringe */}
      <h2 className="section-title">Makros heute</h2>
      <div className="rings-grid">
        {['kcal', 'p', 'f', 's', 'fi'].map(k => {
          const n = NUTRIENTS.find(x => x.key === k)
          return <NutrientRing key={k} k={k} label={n.label} consumed={consumed[k]} target={targets[k]} unit={n.unit} />
        })}
        <NutrientRing k="c" label="Kohlenhydrate" consumed={consumed.c} target={targets.c} />
      </div>
      <div className="row small muted mt-s" style={{ gap: 14, justifyContent: 'center' }}>
        <span><span className="dot" style={{ background: 'var(--green)' }} />im Zielbereich</span>
        <span><span className="dot" style={{ background: 'var(--orange)' }} />fast erreicht</span>
        <span><span className="dot" style={{ background: 'var(--red)' }} />überschritten</span>
      </div>

      {/* Heute essen */}
      <h2 className="section-title">
        <span className="row" style={{ gap: 8 }}><Sparkles size={20} color="var(--green)" /> Heute essen</span>
        <button className="link row" style={{ gap: 4 }} onClick={() => setSeed(s => s + 1)}><RefreshCw size={14} /> Neu vorschlagen</button>
      </h2>
      <p className="small muted" style={{ margin: '-6px 2px 12px' }}>Passend zu deinem Tagesziel, deinen Vorlieben und ohne Zutaten, die du nicht magst.</p>
      <div className="h-scroll">
        {plan.map(({ slot, recipe, fit, done }) => (
          <button key={slot.id} className="recipe-card" onClick={() => open('recipe', { id: recipe.id })} style={{ opacity: done ? 0.6 : 1 }}>
            <div className="img" style={{ aspectRatio: '16/11' }}>
              <RecipeImage recipe={recipe} />
              <div className="tl"><span className="badge dark">{slot.emoji} {slot.label}</span></div>
              {done ? <div className="tr"><span className="badge" style={{ background: 'var(--green)', color: '#fff' }}><CheckCircle2 size={12} /> eingetragen</span></div>
                : <div className="tr"><span className="badge" style={{ background: 'rgba(34,197,94,.92)', color: '#fff' }}>{Math.round(fit * 100)}%</span></div>}
            </div>
            <div className="body">
              <div className="name">{recipe.name}</div>
              <div className="small bold">{fmt(recipe.nutrition.kcal)} kcal · {recipe.time} Min.</div>
              <MacroLine n={recipe.nutrition} compact />
            </div>
          </button>
        ))}
      </div>

      <div className="grid-2 mt">
        {/* Wasser */}
        <section className="card">
          <div className="row between">
            <div className="card-title" style={{ margin: 0 }}><Droplets size={18} color="var(--blue)" /> Wasser</div>
            <span className="bold">{fmt(water / 1000, 2)} / {fmt(targets.water / 1000, 1)} l</span>
          </div>
          <div className="bar" style={{ height: 10 }}><div style={{ width: `${Math.min(100, (water / targets.water) * 100)}%`, background: 'var(--blue)' }} /></div>
          <div className="row mt">
            <button className="btn sm" onClick={() => addWater(-250)} aria-label="250 ml entfernen"><Minus size={16} /></button>
            <button className="btn sm" style={{ flex: 1 }} onClick={() => addWater(250)}><Plus size={16} /> Glas (250 ml)</button>
            <button className="btn sm" style={{ flex: 1 }} onClick={() => addWater(500)}><Plus size={16} /> Flasche (500 ml)</button>
          </div>
        </section>

        {/* Coach */}
        <button className="card" style={{ textAlign: 'left' }} onClick={() => go('coach')}>
          <div className="card-title"><MessageCircle size={18} color="var(--green)" /> KI-Ernährungsberater</div>
          <p className="text-2 small">„Was soll ich heute noch essen, um mein Proteinziel zu erreichen?"</p>
          <div className="chips mt-s">
            {['Wie nehme ich ab?', 'Proteinziel erreichen', 'Zucker reduzieren'].map(q => <span key={q} className="chip" style={{ height: 30, fontSize: 12 }}>{q}</span>)}
          </div>
        </button>
      </div>

      {/* Heute gegessen */}
      <h2 className="section-title">Heute gegessen <button className="link" onClick={() => go('tagebuch')}>Alle anzeigen</button></h2>
      <div className="card">
        {entries.length === 0 ? (
          <div className="empty" style={{ padding: 14 }}>Noch nichts eingetragen. Fotografiere deine erste Mahlzeit! 📸</div>
        ) : (
          <div className="list">
            {entries.slice(-4).reverse().map(e => (
              <div key={e.id} className="list-item">
                <div className="thumb">{e.photo ? <img src={e.photo} alt="" /> : '🍽️'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                  <div className="small muted">P {fmt(e.p)} g · KH {fmt(e.c)} g · F {fmt(e.f)} g</div>
                </div>
                <div className="bold">{fmt(e.kcal)} kcal</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
