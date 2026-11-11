import { useState } from 'react'
import { LogOut, Cloud, Bell, Moon, Sun, Monitor, Ban, User, Target, Activity, Scale, Database, Download, Trash2, X, Plus, Loader2 } from 'lucide-react'
import { useStore, DEFAULT_STATE } from '../store.jsx'
import { Segmented, ConfirmButton } from '../components/ui.jsx'
import { ACTIVITY_LEVELS, GOALS, SEXES, fmt, todayKey } from '../lib/nutrition.js'
import { DISLIKE_GROUPS } from '../data/foods.js'
import { RECIPES, recipeHasDislike, imageUrl } from '../data/recipes.js'
import { requestNotificationPermission } from '../lib/reminders.js'
import { SyncDot } from './Dashboard.jsx'
import { api } from '../api.js'
import { STATIC } from '../static.js'
import PermissionSettings from '../components/PermissionSettings.jsx'

export function AuthForm({ onDone }) {
  const { login } = useStore()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email: '', password: '', name: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await login(f.email, f.password, mode === 'register', f.name); onDone?.() } catch (x) { setErr(x.offline ? 'Server nicht erreichbar – Kalora funktioniert weiter lokal.' : x.message) } finally { setBusy(false) }
  }
  return (
    <form className="col" style={{ gap: 12 }} onSubmit={submit}>
      <Segmented value={mode} onChange={setMode} options={[{ id: 'login', label: 'Anmelden' }, { id: 'register', label: 'Konto erstellen' }]} />
      {mode === 'register' && <input className="input" placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="name" />}
      <input className="input" type="email" placeholder="E-Mail" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoComplete="email" required />
      <input className="input" type="password" placeholder={mode === 'register' ? 'Passwort (mind. 8 Zeichen)' : 'Passwort'} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 8 : 1} />
      {err && <p className="small red bold">{err}</p>}
      <button className="btn primary block" type="submit" disabled={busy}>{busy && <Loader2 size={16} className="spin" />}{mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</button>
      <p className="tiny muted center">Passwörter werden mit scrypt gehasht. Deine Daten werden zwischen allen Geräten synchronisiert.</p>
    </form>
  )
}

function CloudInfo() {
  const { cloud } = useStore()
  return cloud === 'on'
    ? <p className="small text-2">✅ <b>Automatisch gespeichert</b> – deine Daten liegen privat an deinem Claude-Konto. Du musst dich nicht anmelden: Öffne Kalora im Browser oder in der Claude-App, alles ist überall gleich. Niemand sonst kann deine Daten sehen.</p>
    : <p className="small text-2">Deine Daten werden in diesem Browser gespeichert. Öffne Kalora über claude.ai (angemeldet), dann werden sie automatisch an deinem Claude-Konto gespeichert und sind auf allen Geräten gleich.</p>
}

export default function Profile() {
  const { state, update, targets, user, logout, addWeight, notify } = useStore()
  const p = state.profile
  const setP = patch => update(s => ({ ...s, profile: { ...s.profile, ...patch } }))
  const setSettings = patch => update(s => ({ ...s, settings: { ...s.settings, ...patch } }))
  const setNotif = patch => setSettings({ notifications: { ...state.settings.notifications, ...patch } })
  const [dislike, setDislike] = useState('')
  const [w, setW] = useState('')

  const addDislike = d => {
    const v = d.trim()
    if (!v || state.dislikes.some(x => x.toLowerCase() === v.toLowerCase())) return
    update(s => ({ ...s, dislikes: [...s.dislikes, v] }))
    setDislike('')
  }

  const enableNotif = async (key, val) => {
    if (val) {
      const perm = await requestNotificationPermission()
      if (perm === 'denied') notify('Benachrichtigungen im Browser blockiert – Kalora zeigt Hinweise in der App', 'err')
    }
    setNotif({ [key]: val })
  }

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <header className="topbar">
        <div className="row">
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>{(state.settings.displayName || p.name || 'K')[0]?.toUpperCase()}</div>
          <div><h1 style={{ fontSize: 26 }}>{state.settings.displayName || p.name || 'Mein Profil'}</h1><SyncDot /></div>
        </div>
      </header>

      {/* Konto */}
      <Section icon={Cloud} title="Konto & Cloud-Synchronisierung">
        {STATIC ? (
          <CloudInfo />
        ) : user ? (
          <div className="row between">
            <div><div className="bold">{user.name}</div><div className="small muted">{user.email}</div></div>
            <button className="btn sm" onClick={logout}><LogOut size={16} /> Abmelden</button>
          </div>
        ) : (
          <>
            <p className="small muted" style={{ marginBottom: 12 }}>Du nutzt Kalora gerade nur auf diesem Gerät. Mit einem Konto werden deine Daten sicher in der Cloud gespeichert und auf allen Geräten synchronisiert.</p>
            <AuthForm />
          </>
        )}
      </Section>

      <PermissionSettings />

      {/* Persönliche Daten */}
      <Section icon={User} title="Persönliche Daten">
        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Name"><input className="input" value={state.settings.displayName || p.name || ''} onChange={e => setSettings({ displayName: e.target.value })} /></Field>
          <Field label="Geschlecht"><select className="input" value={p.sex} onChange={e => setP({ sex: e.target.value })}>{SEXES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="Alter"><input className="input" type="number" value={p.age} onChange={e => setP({ age: +e.target.value })} /></Field>
          <Field label="Größe (cm)"><input className="input" type="number" value={p.height} onChange={e => setP({ height: +e.target.value })} /></Field>
        </div>
      </Section>

      <Section icon={Target} title="Ziel bearbeiten">
        <div className="chips wrap">{GOALS.map(g => <button key={g.id} className={`chip green ${p.goal === g.id ? 'active' : ''}`} onClick={() => setP({ goal: g.id })}>{g.emoji} {g.label}</button>)}</div>
        <div className="grid-2 mt" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Wunschgewicht (kg)"><input className="input" type="number" step="0.1" value={p.targetWeight || ''} onChange={e => setP({ targetWeight: e.target.value ? +e.target.value : null })} /></Field>
          <Field label="Zieltermin"><input className="input" type="date" min={todayKey()} value={p.targetDate || ''} onChange={e => setP({ targetDate: e.target.value })} /></Field>
        </div>
      </Section>

      <Section icon={Activity} title="Aktivitätslevel bearbeiten">
        <div className="col" style={{ gap: 8 }}>
          {ACTIVITY_LEVELS.map(a => <button key={a.id} className={`choice ${p.activity === a.id ? 'active' : ''}`} style={{ padding: 12 }} onClick={() => setP({ activity: a.id })}><span><div className="t" style={{ fontSize: 15 }}>{a.label}</div><div className="d">{a.desc}</div></span></button>)}
        </div>
      </Section>

      <Section icon={Scale} title="Gewicht aktualisieren">
        <form className="row" onSubmit={e => { e.preventDefault(); if (+w > 30) { addWeight(+w); setW(''); notify('Gewicht gespeichert – Ziele neu berechnet') } }}>
          <input className="input" type="number" step="0.1" placeholder={`Aktuell ${fmt(p.weight, 1)} kg`} value={w} onChange={e => setW(e.target.value)} />
          <button className="btn primary" type="submit">Speichern</button>
        </form>
      </Section>

      <div className="card hero mt">
        <div className="small bold" style={{ opacity: .85 }}>Deine Ziele – in Echtzeit berechnet</div>
        <div className="grid mt-s" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {[['kcal', targets.kcal, ''], ['Protein', targets.p, ' g'], ['Kohlenh.', targets.c, ' g'], ['Fett', targets.f, ' g'], ['Zucker max.', targets.s, ' g'], ['Ballastst.', targets.fi, ' g']].map(([l, v, u]) => (
            <div key={l}><div className="bold" style={{ fontSize: 20 }}>{fmt(v)}{u}</div><div className="tiny" style={{ opacity: .85 }}>{l}</div></div>
          ))}
        </div>
        <p className="tiny mt-s" style={{ opacity: .85 }}>Grundumsatz {fmt(targets.bmr)} kcal · Gesamtumsatz {fmt(targets.tdee)} kcal · BMI {targets.bmi} · {targets.note}</p>
      </div>

      {/* Lebensmittel, die ich nicht mag */}
      <Section icon={Ban} title="Lebensmittel, die ich nicht mag">
        <p className="small muted">Rezepte mit diesen Zutaten werden automatisch ausgefiltert und nicht mehr vorgeschlagen.</p>
        <div className="chips wrap mt">
          {state.dislikes.length === 0 && <span className="small muted">Noch keine Einträge.</span>}
          {state.dislikes.map(d => <button key={d} className="chip active" onClick={() => update(s => ({ ...s, dislikes: s.dislikes.filter(x => x !== d) }))}>{d} <X size={13} className="x" /></button>)}
        </div>
        <form className="row mt" onSubmit={e => { e.preventDefault(); addDislike(dislike) }}>
          <input className="input" placeholder="z. B. Pilze, Fisch, Koriander …" value={dislike} onChange={e => setDislike(e.target.value)} />
          <button className="btn primary" type="submit"><Plus size={18} /></button>
        </form>
        <div className="small bold text-2 mt">Vorschläge</div>
        <div className="chips wrap mt-s">
          {Object.keys(DISLIKE_GROUPS).filter(g => !state.dislikes.includes(g)).map(g => <button key={g} className="chip" onClick={() => addDislike(g)}><Plus size={13} /> {g}</button>)}
        </div>
        <p className="tiny muted mt">{RECIPES.filter(r => recipeHasDislike(r, state.dislikes)).length} Rezepte sind aktuell ausgefiltert.</p>
      </Section>

      {/* Benachrichtigungen */}
      <Section icon={Bell} title="Benachrichtigungen">
        <Toggle label="Mahlzeiten eintragen" value={state.settings.notifications.meals} onChange={v => enableNotif('meals', v)} />
        {state.settings.notifications.meals && (
          <div className="row mt-s" style={{ gap: 8 }}>
            {['Frühstück', 'Mittag', 'Abend'].map((l, i) => (
              <div key={l} className="field" style={{ flex: 1 }}><label>{l}</label><input className="input" type="time" value={state.settings.notifications.mealTimes[i]} onChange={e => { const t = [...state.settings.notifications.mealTimes]; t[i] = e.target.value; setNotif({ mealTimes: t }) }} /></div>
            ))}
          </div>
        )}
        <hr className="sep" />
        <Toggle label="Gewicht eintragen" value={state.settings.notifications.weight} onChange={v => enableNotif('weight', v)} />
        {state.settings.notifications.weight && <input className="input mt-s" type="time" value={state.settings.notifications.weightTime} onChange={e => setNotif({ weightTime: e.target.value })} />}
        <hr className="sep" />
        <Toggle label="Wasser trinken" value={state.settings.notifications.water} onChange={v => enableNotif('water', v)} />
        {state.settings.notifications.water && (
          <select className="input mt-s" value={state.settings.notifications.waterEvery} onChange={e => setNotif({ waterEvery: +e.target.value })}>
            {[60, 90, 120, 180].map(m => <option key={m} value={m}>alle {m / 60 >= 1 && m % 60 === 0 ? `${m / 60} Std.` : `${m} Min.`} (8–22 Uhr)</option>)}
          </select>
        )}
        <p className="tiny muted mt">Erinnerungen werden angezeigt, solange Kalora geöffnet oder als App installiert ist.</p>
      </Section>

      {/* Darstellung */}
      <Section icon={Moon} title="Einstellungen">
        <div className="small bold text-2">Erscheinungsbild</div>
        <div className="mt-s"><Segmented value={state.settings.theme} onChange={t => setSettings({ theme: t })} options={[{ id: 'system', label: '⚙︎ System' }, { id: 'light', label: '☀︎ Hell' }, { id: 'dark', label: '☾ Dunkel' }]} /></div>
      </Section>

      {/* Daten */}
      <Section icon={Database} title="Daten">
        <div className="col" style={{ gap: 8 }}>
          <button className="btn" onClick={() => { update(s => loadDemo(s)); notify('Demo-Daten der letzten 30 Tage geladen') }}><Database size={16} /> Demo-Daten laden (30 Tage)</button>
          {!STATIC && <button className="btn" onClick={() => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kalora-export-${todayKey()}.json`; a.click()
          }}><Download size={16} /> Daten exportieren (JSON)</button>}
          <ConfirmButton onConfirm={() => { update(() => ({ ...DEFAULT_STATE })); notify('Zurückgesetzt') }}><Trash2 size={16} /> App zurücksetzen</ConfirmButton>
          {user && <ConfirmButton onConfirm={async () => { await api('/api/me', { method: 'DELETE' }); logout(); notify('Konto gelöscht') }}><Trash2 size={16} /> Konto löschen</ConfirmButton>}
        </div>
      </Section>
      <p className="tagline center mt-l">KALORA · Track. Analyse. Erfolg.</p>
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="card mt">
      <div className="card-title"><Icon size={18} /> {title}</div>
      {children}
    </section>
  )
}
function Field({ label, children }) { return <div className="field"><label>{label}</label>{children}</div> }
function Toggle({ label, value, onChange }) {
  return (
    <label className="row between" style={{ cursor: 'pointer' }}>
      <span className="bold">{label}</span>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} style={{ width: 46, height: 26, accentColor: 'var(--green)' }} />
    </label>
  )
}

// Realistische Beispieldaten: 30 Tage Mahlzeiten aus der Rezeptdatenbank + Gewichtsverlauf
function loadDemo(s) {
  const log = { ...s.log }
  const weights = []
  const start = (s.profile?.weight || 80) + (s.profile?.goal === 'aufbau' ? -1.5 : 2.4)
  const bySlot = { F: RECIPES.filter(r => r.meals.includes('F')), M: RECIPES.filter(r => r.meals.includes('M')), A: RECIPES.filter(r => r.meals.includes('A')), S: RECIPES.filter(r => r.meals.includes('S') || r.meals.includes('D')) }
  let seed = 7
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  for (let i = 30; i >= 1; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = todayKey(d)
    if (!log[key]?.length) {
      log[key] = ['F', 'M', 'A', 'S'].filter(sl => sl !== 'S' || rnd() > 0.4).map(sl => {
        const r = bySlot[sl][Math.floor(rnd() * bySlot[sl].length)]
        const k = 0.8 + rnd() * 0.4
        const n = r.nutrition
        return { id: `demo-${key}-${sl}`, slot: sl, name: r.name, recipeId: r.id, source: 'rezept', photo: imageUrl(r, 'small'), time: d.getTime(), kcal: n.kcal * k, p: n.p * k, c: n.c * k, f: n.f * k, s: n.s * k, fi: n.fi * k }
      })
    }
    if (i % 2 === 0) weights.push({ date: key, kg: +(start + ((s.profile?.goal === 'aufbau' ? 1 : -1) * (30 - i) * 0.08) + (rnd() - 0.5) * 0.6).toFixed(1) })
  }
  const merged = [...weights, ...s.weights.filter(w => !weights.some(x => x.date === w.date))].sort((a, b) => a.date.localeCompare(b.date))
  return { ...s, log, weights: merged }
}
