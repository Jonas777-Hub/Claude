import { useState } from 'react'
import { Dumbbell, Flame, Timer, Trash2, Plus, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { useStore } from '../store.jsx'
import { Segmented, Stepper } from '../components/ui.jsx'
import { fmt, todayKey } from '../lib/nutrition.js'
import { SPORTS, SPORT_MAP, INTENSITIES, CREDIT_OPTIONS, DEFAULT_CREDIT, burnedKcal, sumWorkouts, sportBonus, lastDays, streak } from '../lib/sport.js'

export default function Sport() {
  const { state, update, addWorkout, removeWorkout, notify } = useStore()
  const [date, setDate] = useState(todayKey())
  const [sport, setSport] = useState('laufen')
  const [minutes, setMinutes] = useState(30)
  const [intensity, setIntensity] = useState('mittel')
  const [note, setNote] = useState('')

  const all = state.sport || {}
  const list = all[date] || []
  const day = sumWorkouts(list)
  const credit = state.settings.sportCredit ?? DEFAULT_CREDIT
  const bonus = sportBonus(list, credit)
  const week = lastDays(all, 7)
  const weekSum = week.reduce((t, d) => ({ minutes: t.minutes + d.minutes, kcal: t.kcal + d.kcal, days: t.days + (d.count ? 1 : 0) }), { minutes: 0, kcal: 0, days: 0 })
  const maxMin = Math.max(30, ...week.map(d => d.minutes))
  const series = streak(all)
  const preview = burnedKcal({ sport, minutes, intensity }, state.profile.weight)

  const isToday = date === todayKey()
  const shift = d => {
    const x = new Date(date); x.setDate(x.getDate() + d)
    if (todayKey(x) <= todayKey()) setDate(todayKey(x))
  }
  const label = isToday ? 'Heute' : new Date(date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  const save = () => {
    if (!minutes) return
    addWorkout({ sport, minutes, intensity, kcal: preview, note: note.trim() || undefined }, date)
    setNote('')
    notify(`${SPORT_MAP[sport].emoji} ${SPORT_MAP[sport].label} eingetragen · ${fmt(preview)} kcal`)
  }

  return (
    <div className="page">
      <header className="topbar">
        <div><div className="sub">Bewegung & Training</div><h1>Sporti</h1></div>
        {series > 0 && <span className="badge" style={{ background: 'var(--grad-warm)', color: '#fff', height: 30, padding: '0 12px' }}><Flame size={14} /> {series} {series === 1 ? 'Tag' : 'Tage'} in Folge</span>}
      </header>

      <div className="card row between" style={{ padding: 10 }}>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Vortag"><ChevronLeft size={18} /></button>
        <div className="center"><div className="bold" style={{ textTransform: 'capitalize' }}>{label}</div><div className="small muted">{fmt(day.minutes)} Min. · {fmt(day.kcal)} kcal verbrannt</div></div>
        <button className="icon-btn" onClick={() => shift(1)} disabled={isToday} style={{ opacity: isToday ? 0.3 : 1 }} aria-label="Folgetag"><ChevronRight size={18} /></button>
      </div>

      <div className="grid-2 mt">
        {/* Training eintragen */}
        <section className="card">
          <div className="card-title"><Dumbbell size={18} color="var(--green)" /> Training eintragen</div>
          <div className="chips wrap">
            {SPORTS.map(s => (
              <button key={s.id} className={`chip green ${sport === s.id ? 'active' : ''}`} onClick={() => setSport(s.id)} aria-pressed={sport === s.id}>{s.emoji} {s.label}</button>
            ))}
          </div>
          <div className="row between mt" style={{ gap: 12, flexWrap: 'wrap' }}>
            <span className="bold row" style={{ gap: 6 }}><Timer size={16} /> Dauer</span>
            <Stepper value={minutes} onChange={setMinutes} min={5} max={600} step={5} format={v => `${v} Min.`} />
          </div>
          <div className="mt-s"><Segmented value={intensity} onChange={setIntensity} options={INTENSITIES} /></div>
          <input className="input mt-s" placeholder="Notiz (optional), z. B. 5 km Stadtpark" value={note} onChange={e => setNote(e.target.value)} maxLength={80} />
          <button className="btn primary block mt" onClick={save}><Plus size={18} /> Eintragen · ca. {fmt(preview)} kcal</button>
          <p className="tiny muted mt-s">Schätzung nach MET-Werten mit deinem Gewicht ({fmt(state.profile.weight)} kg), nur der Mehrverbrauch gegenüber Ruhe.</p>
        </section>

        {/* Tagesbilanz */}
        <section className="card">
          <div className="card-title"><Zap size={18} color="var(--orange)" /> Auswirkung aufs Tagesziel</div>
          <div className="row" style={{ gap: 18 }}>
            <div><div className="kcal-big" style={{ fontSize: 30 }}>+{fmt(bonus)}</div><div className="tiny muted bold">kcal extra {isToday ? 'heute' : 'an diesem Tag'}</div></div>
            <div><div className="kcal-big" style={{ fontSize: 30 }}>{fmt(day.kcal)}</div><div className="tiny muted bold">kcal verbrannt</div></div>
          </div>
          <div className="small bold mt">Wie viel davon gutschreiben?</div>
          <div className="mt-s"><Segmented value={credit} onChange={v => update(s => ({ ...s, settings: { ...s.settings, sportCredit: v } }))} options={CREDIT_OPTIONS} /></div>
          <p className="tiny muted mt-s">Dein Aktivitätslevel enthält schon deinen üblichen Sport. „Hälfte" verhindert, dass Training doppelt gezählt wird.</p>

          <div className="small bold mt">Letzte 7 Tage · {fmt(weekSum.minutes)} Min. · {fmt(weekSum.kcal)} kcal · {weekSum.days}/7 Tage aktiv</div>
          <div className="row mt-s" style={{ gap: 6, alignItems: 'flex-end', height: 90 }} role="img" aria-label={`Trainingsminuten der letzten 7 Tage: ${week.map(d => d.minutes).join(', ')}`}>
            {week.map(d => (
              <div key={d.date} className="col" style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }} title={`${d.minutes} Min. · ${d.kcal} kcal`}>
                <div style={{ width: '100%', maxWidth: 28, borderRadius: 6, background: d.date === date ? 'var(--green)' : 'var(--green-soft)', height: `${Math.max(4, (d.minutes / maxMin) * 70)}px` }} />
                <span className="tiny muted bold">{new Date(d.date).toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <h2 className="section-title">{isToday ? 'Heute trainiert' : 'Trainings'}</h2>
      <div className="card">
        {list.length === 0 ? (
          <div className="empty" style={{ padding: 14 }}>Noch kein Training eingetragen. Los geht's! 💪</div>
        ) : (
          <div className="list">
            {list.slice().reverse().map(w => {
              const s = SPORT_MAP[w.sport] || SPORT_MAP.andere
              return (
                <div key={w.id} className="list-item">
                  <div className="thumb">{s.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bold">{s.label}</div>
                    <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.minutes} Min. · {INTENSITIES.find(i => i.id === w.intensity)?.label}{w.note ? ` · ${w.note}` : ''}</div>
                  </div>
                  <div className="bold">{fmt(w.kcal)} kcal</div>
                  <button className="icon-btn" onClick={() => removeWorkout(w.id, date)} aria-label={`${s.label} löschen`}><Trash2 size={16} /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
