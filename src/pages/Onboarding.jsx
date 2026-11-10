import { useState } from 'react'
import { ChevronLeft, LogIn } from 'lucide-react'
import { LOGO } from '../logo.js'
import { useStore } from '../store.jsx'
import { ACTIVITY_LEVELS, GOALS, SEXES, calcTargets, fmt, todayKey } from '../lib/nutrition.js'
import { AuthForm } from './Profile.jsx'
import { STATIC } from '../static.js'
import { FoodBackdrop } from '../components/ui.jsx'

export default function Onboarding() {
  const { update, user } = useStore()
  const [step, setStep] = useState(0)
  const [login, setLogin] = useState(false)
  const [p, setP] = useState({ name: '', sex: '', age: '', height: '', weight: '', activity: '', goal: '', targetWeight: '', targetDate: '' })
  const set = (k, v) => setP(s => ({ ...s, [k]: v }))
  const steps = 6
  const targets = calcTargets({ ...p, age: +p.age, height: +p.height, weight: +p.weight })

  const valid = [
    true,
    p.sex && +p.age >= 14 && +p.age <= 100 && +p.height >= 120 && +p.height <= 230 && +p.weight >= 35 && +p.weight <= 300,
    !!p.activity,
    !!p.goal,
    true,
    true,
  ][step]

  const finish = () => {
    const profile = { ...p, age: +p.age, height: +p.height, weight: +p.weight, targetWeight: p.targetWeight ? +p.targetWeight : null, createdAt: Date.now() }
    update(s => ({
      ...s,
      profile,
      weights: s.weights.length ? s.weights : [{ date: todayKey(), kg: profile.weight }],
      settings: { ...s.settings, displayName: p.name || s.settings.displayName || user?.name || '' },
    }))
  }

  if (login) {
    return (
      <div className="onb">
        <button className="icon-btn" onClick={() => setLogin(false)} aria-label="Zurück"><ChevronLeft /></button>
        <h1 className="mt-l">Willkommen zurück</h1>
        <p className="text-2 mt-s">Melde dich an, um deine Daten aus der Cloud zu laden.</p>
        <div className="mt-l"><AuthForm onDone={() => setLogin(false)} /></div>
      </div>
    )
  }

  return (
    <>
    {step === 0 && (
      <div className="onb-welcome" aria-hidden="true">
        <FoodBackdrop size="large" ids={['honig-balsamico-haehnchen', 'pancakes-beeren', 'lachs-avocado-salat', 'shakshuka', 'thai-green-curry', 'tofu-cashew-wok', 'spaghetti-bolognese', 'pad-thai', 'gefuellte-paprika-quinoa', 'erdbeeren-romanoff', 'haehnchen-shawarma', 'ofenlachs-fenchel']} />
        <span className="food-shade" />
      </div>
    )}
    <div className={`onb ${step === 0 ? 'welcome' : ''}`}>
      {step > 0 && <div className="progress"><div style={{ width: `${(step / (steps - 1)) * 100}%` }} /></div>}
      {step > 0 && <button className="icon-btn" style={{ marginBottom: 14 }} onClick={() => setStep(step - 1)} aria-label="Zurück"><ChevronLeft /></button>}

      {step === 0 && (
        <div className="col" style={{ flex: 1, justifyContent: 'center', gap: 18 }}>
          <div className="logo"><img src={LOGO} alt="" /> KALORA</div>
          <div className="tagline">Track. Analyse. Erfolg.</div>
          <h1 style={{ fontSize: 40 }}>Dein smarter <span className="grad-text">Ernährungs­assistent.</span></h1>
          <p className="text-2" style={{ fontSize: 17, lineHeight: 1.5 }}>Fotografiere dein Essen – die KI erkennt es und berechnet Kalorien und Makros. Dazu passende Rezepte, Einkaufslisten und ein persönlicher Coach.</p>
          <div className="grid mt" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[['📸', 'KI-Foto­erkennung'], ['🍳', '70 Rezepte mit Original­fotos'], ['🛒', 'Geteilte Einkaufs­listen']].map(([e, t]) => (
              <div key={t} className="card flat center small bold" style={{ padding: 12 }}><div style={{ fontSize: 26 }}>{e}</div>{t}</div>
            ))}
          </div>
          <div className="spacer" />
          <div className="field">
            <label htmlFor="name">Wie heißt du?</label>
            <input id="name" className="input" placeholder="Dein Vorname" value={p.name} onChange={e => set('name', e.target.value)} />
          </div>
          <button className="btn primary block" onClick={() => setStep(1)}>Los geht's</button>
          {!STATIC && <button className="btn ghost block" onClick={() => setLogin(true)}><LogIn size={18} /> Ich habe schon ein Konto</button>}
        </div>
      )}

      {step === 1 && (
        <div className="col" style={{ gap: 16 }}>
          <h1>Persönliche Daten</h1>
          <p className="text-2">Damit berechnen wir deinen exakten Kalorienbedarf.</p>
          <div className="field">
            <label>Geschlecht</label>
            <div className="row">{SEXES.map(s => <button key={s.id} className={`chip ${p.sex === s.id ? 'active' : ''}`} style={{ flex: 1, height: 46, justifyContent: 'center' }} onClick={() => set('sex', s.id)}>{s.label}</button>)}</div>
          </div>
          <NumField label="Alter" unit="Jahre" value={p.age} onChange={v => set('age', v)} placeholder="30" />
          <NumField label="Größe" unit="cm" value={p.height} onChange={v => set('height', v)} placeholder="178" />
          <NumField label="Gewicht" unit="kg" value={p.weight} onChange={v => set('weight', v)} placeholder="80" step="0.1" />
        </div>
      )}

      {step === 2 && (
        <div className="col" style={{ gap: 10 }}>
          <h1>Wie aktiv bist du?</h1>
          <p className="text-2" style={{ marginBottom: 8 }}>Gemeint ist dein durchschnittlicher Alltag inkl. Sport.</p>
          {ACTIVITY_LEVELS.map((a, i) => (
            <button key={a.id} className={`choice ${p.activity === a.id ? 'active' : ''}`} onClick={() => set('activity', a.id)}>
              <span className="em">{['🛋️', '🚶', '🏃', '🚴', '🏆'][i]}</span>
              <span><div className="t">{a.label}</div><div className="d">{a.desc}</div></span>
            </button>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="col" style={{ gap: 10 }}>
          <h1>Was ist dein Ziel?</h1>
          <p className="text-2" style={{ marginBottom: 8 }}>Kalora passt Kalorien und Makros daran an.</p>
          {GOALS.map(g => (
            <button key={g.id} className={`choice ${p.goal === g.id ? 'active' : ''}`} onClick={() => set('goal', g.id)}>
              <span className="em">{g.emoji}</span>
              <span><div className="t">{g.label}</div><div className="d">{g.desc}</div></span>
            </button>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="col" style={{ gap: 16 }}>
          <h1>Wunschgewicht <span className="muted" style={{ fontSize: 20 }}>(optional)</span></h1>
          <p className="text-2">Mit Zielgewicht und Termin berechnet Kalora dein ideales Tempo – sicher und nachhaltig.</p>
          <NumField label="Wunschgewicht" unit="kg" value={p.targetWeight} onChange={v => set('targetWeight', v)} placeholder={p.goal === 'aufbau' ? String(+p.weight + 5) : String(+p.weight - 5)} step="0.1" />
          <div className="field">
            <label htmlFor="td">Zieltermin</label>
            <input id="td" type="date" className="input" min={todayKey()} value={p.targetDate} onChange={e => set('targetDate', e.target.value)} />
          </div>
        </div>
      )}

      {step === 5 && targets && (
        <div className="col" style={{ gap: 14 }}>
          <h1>Dein persönlicher Plan{p.name ? `, ${p.name}` : ''} 🎯</h1>
          <div className="card hero">
            <div className="muted small bold">Täglicher Kalorienbedarf</div>
            <div className="kcal-big" style={{ fontSize: 48 }}>{fmt(targets.kcal)} <span style={{ fontSize: 20 }}>kcal</span></div>
            <p className="small mt-s" style={{ opacity: .9 }}>{targets.note}</p>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[['Protein', targets.p, 'var(--c-protein)'], ['Kohlenh.', targets.c, 'var(--c-carbs)'], ['Fett', targets.f, 'var(--c-fat)'], ['Zucker max.', targets.s, 'var(--c-sugar)'], ['Ballastst.', targets.fi, 'var(--c-fiber)'], ['Wasser', targets.water / 1000, 'var(--blue)']].map(([l, v, c]) => (
              <div key={l} className="card flat center" style={{ padding: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: c }}>{fmt(v, 1)}{l === 'Wasser' ? ' l' : ' g'}</div>
                <div className="small muted bold">{l}</div>
              </div>
            ))}
          </div>
          <div className="card flat kv small">
            <span className="k">Grundumsatz (BMR)</span><span className="v">{fmt(targets.bmr)} kcal</span>
            <span className="k">Gesamtumsatz (TDEE)</span><span className="v">{fmt(targets.tdee)} kcal</span>
            <span className="k">BMI</span><span className="v">{targets.bmi}</span>
            {targets.etaWeeks && <><span className="k">Ziel erreicht in ca.</span><span className="v">{targets.etaWeeks} Wochen</span></>}
          </div>
          <p className="tiny muted">Berechnung nach Mifflin-St Jeor. Proteinbedarf 1,6–2,0 g/kg, Fett ≈ 28 % der Energie, Zucker max. 10 % (WHO), Ballaststoffe 14 g je 1000 kcal. Kein Ersatz für ärztliche Beratung.</p>
        </div>
      )}

      <div className="spacer" style={{ minHeight: 24 }} />
      {step > 0 && (
        <button className="btn primary block" disabled={!valid} onClick={() => (step === steps - 1 ? finish() : setStep(step + 1))}>
          {step === steps - 1 ? 'Kalora starten' : step === 4 && !p.targetWeight ? 'Überspringen' : 'Weiter'}
        </button>
      )}
    </div>
    </>
  )
}

function NumField({ label, unit, value, onChange, placeholder, step = '1' }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input className="input" type="number" inputMode="decimal" step={step} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={{ paddingRight: 64 }} />
        <span className="muted bold" style={{ position: 'absolute', right: 14, top: 14 }}>{unit}</span>
      </div>
    </div>
  )
}
