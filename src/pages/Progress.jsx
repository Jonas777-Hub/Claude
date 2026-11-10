import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts'
import { Scale, Plus, Trash2, Table2, BarChart3, Target } from 'lucide-react'
import { useStore } from '../store.jsx'
import { Segmented } from '../components/ui.jsx'
import { SLOTS, fmt, sumEntries, todayKey } from '../lib/nutrition.js'

const RANGES = [{ id: 'tag', label: 'Tag' }, { id: 'woche', label: 'Woche' }, { id: 'monat', label: 'Monat' }, { id: 'jahr', label: 'Jahr' }]
const METRICS = [
  { key: 'kcal', label: 'Kalorienverlauf', unit: 'kcal', color: 'var(--green)' },
  { key: 'p', label: 'Proteinverlauf', unit: 'g', color: 'var(--c-protein)' },
  { key: 'f', label: 'Fettverlauf', unit: 'g', color: 'var(--c-fat)' },
  { key: 's', label: 'Zuckerverlauf', unit: 'g', color: 'var(--c-sugar)' },
]

function daysBack(n) {
  const out = []
  for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(todayKey(d)) }
  return out
}

export default function Progress() {
  const { state, targets, addWeight, update } = useStore()
  const [range, setRange] = useState('woche')
  const [table, setTable] = useState(false)
  const [w, setW] = useState('')

  const data = useMemo(() => {
    if (range === 'tag') {
      const e = state.log[todayKey()] || []
      return SLOTS.map(s => ({ label: s.label, ...sumEntries(e.filter(x => x.slot === s.id)) }))
    }
    if (range === 'jahr') {
      const months = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
        const prefix = todayKey(d).slice(0, 7)
        const days = Object.keys(state.log).filter(k => k.startsWith(prefix) && state.log[k].length)
        const tot = sumEntries(days.flatMap(k => state.log[k]))
        const n = days.length || 1
        const ws = state.weights.filter(x => x.date.startsWith(prefix))
        months.push({ label: d.toLocaleDateString('de-DE', { month: 'short' }), kcal: tot.kcal / n, p: tot.p / n, f: tot.f / n, s: tot.s / n, weight: ws.length ? ws[ws.length - 1].kg : null, days: days.length })
      }
      return months
    }
    const n = range === 'woche' ? 7 : 30
    let lastW = null
    return daysBack(n).map(k => {
      const t = sumEntries(state.log[k] || [])
      const wEntry = state.weights.find(x => x.date === k)
      if (wEntry) lastW = wEntry.kg
      const d = new Date(k)
      return { label: range === 'woche' ? d.toLocaleDateString('de-DE', { weekday: 'short' }) : `${d.getDate()}.${d.getMonth() + 1}.`, ...t, weight: wEntry ? wEntry.kg : null, carry: lastW }
    })
  }, [range, state.log, state.weights])

  const logged = data.filter(d => d.kcal > 0)
  const avg = k => logged.length ? logged.reduce((a, d) => a + d[k], 0) / logged.length : 0
  const onTarget = range === 'tag' ? null : logged.filter(d => d.kcal <= targets.kcal * 1.05 && d.kcal >= targets.kcal * 0.8).length

  // Gewicht
  const weights = state.weights
  const start = weights[0]?.kg ?? state.profile.weight
  const current = weights[weights.length - 1]?.kg ?? state.profile.weight
  const goalW = state.profile.targetWeight
  const progress = goalW && start !== goalW ? Math.max(0, Math.min(1, (start - current) / (start - goalW))) : null
  const weightData = (range === 'jahr' ? data.filter(d => d.weight) : weights.slice(range === 'woche' ? -7 : range === 'monat' ? -30 : -2).map(x => ({ label: new Date(x.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' }), weight: x.kg })))
  const wVals = weightData.map(d => d.weight).concat(goalW ? [goalW] : [])
  const wDomain = wVals.length ? [Math.floor(Math.min(...wVals) - 1), Math.ceil(Math.max(...wVals) + 1)] : ['auto', 'auto']

  return (
    <div className="page">
      <header className="topbar">
        <div><div className="sub">Statistiken</div><h1>Verlauf</h1></div>
        <button className="icon-btn" onClick={() => setTable(t => !t)} aria-label={table ? 'Diagramme anzeigen' : 'Tabellenansicht'}>{table ? <BarChart3 size={18} /> : <Table2 size={18} />}</button>
      </header>
      <Segmented options={RANGES} value={range} onChange={setRange} />

      <div className="grid mt" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <div className="card flat center"><div className="bold" style={{ fontSize: 20 }}>{fmt(avg('kcal'))}</div><div className="tiny muted bold">Ø kcal{range === 'tag' ? ' / Mahlzeit' : ' / Tag'}</div></div>
        <div className="card flat center"><div className="bold" style={{ fontSize: 20 }}>{fmt(avg('p'))} g</div><div className="tiny muted bold">Ø Protein</div></div>
        <div className="card flat center"><div className="bold" style={{ fontSize: 20 }}>{onTarget ?? fmt(sumEntries(state.log[todayKey()] || []).kcal)}</div><div className="tiny muted bold">{onTarget != null ? 'Tage im Ziel' : 'kcal heute'}</div></div>
      </div>

      {/* Gewichtstracker */}
      <h2 className="section-title"><span className="row" style={{ gap: 8 }}><Scale size={20} /> Gewichtstracker</span></h2>
      <div className="card">
        <div className="row between">
          <div><div className="kcal-big" style={{ fontSize: 30 }}>{fmt(current, 1)} kg</div>
            <div className="small muted">Start {fmt(start, 1)} kg · {current - start <= 0 ? '' : '+'}{fmt(current - start, 1)} kg</div></div>
          {goalW && <div style={{ textAlign: 'right' }}><div className="small muted bold row" style={{ gap: 4, justifyContent: 'flex-end' }}><Target size={14} /> Ziel</div><div className="bold" style={{ fontSize: 20 }}>{fmt(goalW, 1)} kg</div></div>}
        </div>
        {progress != null && (
          <>
            <div className="bar" style={{ height: 10 }}><div style={{ width: `${progress * 100}%`, background: 'var(--green)' }} /></div>
            <div className="small muted mt-s">{Math.round(progress * 100)} % geschafft · noch {fmt(Math.abs(current - goalW), 1)} kg{targets.etaWeeks ? ` · ca. ${targets.etaWeeks} Wochen` : ''}</div>
          </>
        )}
        <form className="row mt" onSubmit={e => { e.preventDefault(); if (+w > 30) { addWeight(+w); setW('') } }}>
          <input className="input" type="number" inputMode="decimal" step="0.1" placeholder="Gewicht heute (kg)" value={w} onChange={e => setW(e.target.value)} aria-label="Gewicht in kg" />
          <button className="btn primary" type="submit"><Plus size={18} /> Eintragen</button>
        </form>
        {!table && weightData.length > 1 && (
          <div className="chart-box mt">
            <ResponsiveContainer>
              <LineChart data={weightData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis domain={wDomain} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip unit="kg" name="Gewicht" />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
                {goalW && <ReferenceLine y={goalW} stroke="var(--green-600)" strokeDasharray="5 4" label={{ value: `Ziel ${goalW} kg`, position: 'insideTopRight', fill: 'var(--text-2)', fontSize: 11 }} />}
                <Line type="monotone" dataKey="weight" stroke="var(--text)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }} activeDot={{ r: 6 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {(table || weightData.length <= 1) && weights.length > 0 && (
          <table className="table mt">
            <thead><tr><th>Datum</th><th>Gewicht</th><th /></tr></thead>
            <tbody>{[...weights].reverse().slice(0, 10).map(x => (
              <tr key={x.date}><td>{new Date(x.date).toLocaleDateString('de-DE')}</td><td className="bold">{fmt(x.kg, 1)} kg</td>
                <td><button className="icon-btn sm plain" onClick={() => update(s => ({ ...s, weights: s.weights.filter(y => y.date !== x.date) }))} aria-label="Löschen"><Trash2 size={14} color="var(--red)" /></button></td></tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* Nährwert-Verläufe: je eine Größe pro Diagramm (keine doppelte Achse) */}
      {METRICS.map(m => (
        <section key={m.key}>
          <h2 className="section-title">{m.label}<span className="small muted">Ziel {m.key === 's' ? 'max. ' : ''}{fmt(targets[m.key])} {m.unit}{range === 'tag' ? ' / Tag' : ''}</span></h2>
          <div className="card">
            {table ? (
              <table className="table">
                <thead><tr><th>{range === 'tag' ? 'Mahlzeit' : range === 'jahr' ? 'Monat (Ø)' : 'Tag'}</th><th>{m.label.replace('verlauf', '')}</th></tr></thead>
                <tbody>{data.map(d => <tr key={d.label}><td>{d.label}</td><td className="bold">{fmt(d[m.key])} {m.unit}</td></tr>)}</tbody>
              </table>
            ) : logged.length === 0 ? <p className="small muted center" style={{ padding: 20 }}>Noch keine Daten in diesem Zeitraum. Trage Mahlzeiten ein oder lade Demo-Daten im Profil.</p> : (
              <div className="chart-box">
                <ResponsiveContainer>
                  <BarChart data={data} margin={{ top: 10, right: 6, left: -14, bottom: 0 }} barCategoryGap={range === 'monat' ? 2 : '25%'}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} interval={range === 'monat' ? 4 : 0} />
                    <YAxis domain={[0, max => Math.ceil(Math.max(max, range === 'tag' ? 0 : targets[m.key] * 1.1))]} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Tip unit={m.unit} name={m.label.replace('verlauf', '')} />} cursor={{ fill: 'var(--card-2)' }} />
                    {range !== 'tag' && <ReferenceLine y={targets[m.key]} stroke="var(--text-2)" strokeDasharray="5 4" label={{ value: 'Ziel', position: 'insideTopRight', fill: 'var(--text-2)', fontSize: 11 }} />}
                    <Bar dataKey={m.key} fill={m.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

function Tip({ active, payload, unit, name }) {
  if (!active || !payload?.length) return null
  const v = payload[0].value
  return (
    <div className="card" style={{ padding: '8px 12px', boxShadow: 'var(--shadow-lg)' }}>
      <div className="tiny muted bold">{payload[0].payload.label}</div>
      <div className="bold">{v == null ? '–' : `${fmt(v, unit === 'kg' ? 1 : 0)} ${unit}`}</div>
      <div className="tiny muted">{name}</div>
    </div>
  )
}
