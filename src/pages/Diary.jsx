import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Camera, Pencil } from 'lucide-react'
import { useStore } from '../store.jsx'
import { useUI } from '../App.jsx'
import { Dialog, Stepper } from '../components/ui.jsx'
import { SLOTS, fmt, sumEntries, todayKey } from '../lib/nutrition.js'

export default function Diary() {
  const { state, targets, removeEntry, updateEntry } = useStore()
  const { open } = useUI()
  const [date, setDate] = useState(todayKey())
  const [edit, setEdit] = useState(null)
  const entries = state.log[date] || []
  const total = sumEntries(entries)
  const isToday = date === todayKey()
  const shift = d => {
    const x = new Date(date); x.setDate(x.getDate() + d)
    if (todayKey(x) <= todayKey()) setDate(todayKey(x))
  }
  const label = isToday ? 'Heute' : new Date(date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <header className="topbar">
        <div><div className="sub">Tagesübersicht</div><h1>Tagebuch</h1></div>
      </header>
      <div className="card row between" style={{ padding: 10 }}>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Vortag"><ChevronLeft size={18} /></button>
        <div className="center"><div className="bold" style={{ textTransform: 'capitalize' }}>{label}</div><div className="small muted">{fmt(total.kcal)} / {fmt(targets.kcal)} kcal</div></div>
        <button className="icon-btn" onClick={() => shift(1)} disabled={isToday} style={{ opacity: isToday ? 0.3 : 1 }} aria-label="Folgetag"><ChevronRight size={18} /></button>
      </div>

      <div className="card mt">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(6,1fr)', gap: 4, textAlign: 'center' }}>
          {[['kcal', 'kcal'], ['p', 'Protein'], ['c', 'KH'], ['f', 'Fett'], ['s', 'Zucker'], ['fi', 'Ballast.']].map(([k, l]) => (
            <div key={k}><div className="bold" style={{ fontSize: 15 }}>{fmt(total[k])}</div><div className="tiny muted bold">{l}</div><div className="tiny muted">/ {fmt(targets[k])}</div></div>
          ))}
        </div>
      </div>

      {SLOTS.map(slot => {
        const list = entries.filter(e => e.slot === slot.id)
        const t = sumEntries(list)
        return (
          <section key={slot.id}>
            <h2 className="section-title">
              <span>{slot.emoji} {slot.label}</span>
              <span className="small muted">{fmt(t.kcal)} kcal</span>
            </h2>
            <div className="card">
              {list.length === 0 && <div className="small muted" style={{ padding: '4px 2px 8px' }}>Noch nichts eingetragen.</div>}
              <div className="list">
                {list.map(e => (
                  <div key={e.id} className="list-item">
                    <div className="thumb">{e.photo ? <img src={e.photo} alt="" /> : e.source === 'rezept' ? '🍳' : '🍽️'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                      <div className="small muted">{fmt(e.kcal)} kcal · P {fmt(e.p)} g · KH {fmt(e.c)} g · F {fmt(e.f)} g</div>
                      <div className="tiny muted">Zucker {fmt(e.s)} g · Ballaststoffe {fmt(e.fi)} g{e.grams ? ` · ${fmt(e.grams)} g` : ''}</div>
                    </div>
                    <button className="icon-btn sm plain" onClick={() => setEdit(e)} aria-label="Bearbeiten"><Pencil size={16} /></button>
                    <button className="icon-btn sm plain" onClick={() => removeEntry(e.id, date)} aria-label="Löschen"><Trash2 size={16} color="var(--red)" /></button>
                  </div>
                ))}
              </div>
              {isToday && (
                <div className="row mt-s">
                  <button className="btn sm" style={{ flex: 1 }} onClick={() => open('photo', { slot: slot.id })}><Camera size={16} /> Foto</button>
                  <button className="btn sm" style={{ flex: 1 }} onClick={() => open('search', { slot: slot.id })}><Plus size={16} /> Hinzufügen</button>
                </div>
              )}
            </div>
          </section>
        )
      })}

      {edit && <EditEntry entry={edit} onClose={() => setEdit(null)} onSave={patch => { updateEntry(edit.id, patch, date); setEdit(null) }} />}
    </div>
  )
}

function EditEntry({ entry, onClose, onSave }) {
  const [factor, setFactor] = useState(1)
  const [name, setName] = useState(entry.name)
  const [slot, setSlot] = useState(entry.slot)
  const scaled = k => (Number(entry[k]) || 0) * factor
  return (
    <Dialog onClose={onClose}>
      <h3>Eintrag bearbeiten</h3>
      <div className="field mt"><label>Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="field mt"><label>Mahlzeit</label>
        <div className="chips wrap">{SLOTS.map(s => <button key={s.id} className={`chip ${slot === s.id ? 'active' : ''}`} onClick={() => setSlot(s.id)}>{s.label}</button>)}</div>
      </div>
      <div className="row between mt"><span className="bold">Portion</span><Stepper value={factor} onChange={setFactor} min={0.25} max={5} step={0.25} format={v => `${String(v).replace('.', ',')}×`} /></div>
      <p className="small muted mt-s">{fmt(scaled('kcal'))} kcal · P {fmt(scaled('p'))} g · KH {fmt(scaled('c'))} g · F {fmt(scaled('f'))} g</p>
      <div className="row mt">
        <button className="btn" style={{ flex: 1 }} onClick={onClose}>Abbrechen</button>
        <button className="btn primary" style={{ flex: 1 }} onClick={() => onSave({ name, slot, ...Object.fromEntries(['kcal', 'p', 'c', 'f', 's', 'fi'].map(k => [k, scaled(k)])), grams: entry.grams ? entry.grams * factor : entry.grams })}>Speichern</button>
      </div>
    </Dialog>
  )
}
