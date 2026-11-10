import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import { useStore } from '../store.jsx'
import { useUI } from '../App.jsx'
import { useAIStatus, askCoach } from '../lib/ai.js'
import { RECIPES } from '../data/recipes.js'
import { FOODS } from '../data/foods.js'
import { lastDays } from '../lib/sport.js'
import { GOALS, fmt, remaining, sumEntries, todayKey } from '../lib/nutrition.js'
import { eligibleRecipes, learnPreferences, rankRecipes } from '../lib/recommend.js'

const QUICK = ['Wie nehme ich ab?', 'Was soll ich heute essen?', 'Wie erreiche ich mein Proteinziel?', 'Wie reduziere ich Zucker?']

export default function Coach() {
  const { state, targets, update } = useStore()
  const { open } = useUI()
  const ai = useAIStatus()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const end = useRef(null)
  const history = state.coachHistory || []
  const consumed = sumEntries(state.log[todayKey()] || [])
  const rem = remaining(targets, consumed)
  const prefs = useMemo(() => learnPreferences(state.ratings, state.cooked), [state.ratings, state.cooked])

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [history.length, busy])

  const context = () => {
    const last7 = Object.keys(state.log).sort().slice(-7).map(d => ({ datum: d, ...round(sumEntries(state.log[d])) }))
    return {
      name: state.settings.displayName || state.profile.name,
      profil: { geschlecht: state.profile.sex, alter: state.profile.age, groesse_cm: state.profile.height, gewicht_kg: state.profile.weight, aktivitaet: state.profile.activity, ziel: GOALS.find(g => g.id === state.profile.goal)?.label, wunschgewicht: state.profile.targetWeight, zieltermin: state.profile.targetDate },
      tagesziele: { kcal: targets.kcal, protein_g: targets.p, kohlenhydrate_g: targets.c, fett_g: targets.f, zucker_max_g: targets.s, ballaststoffe_g: targets.fi },
      heute_gegessen: round(consumed),
      sport_heute: (state.sport?.[todayKey()] || []).map(w => `${w.sport}: ${w.minutes} Min. (${w.intensity}), ca. ${w.kcal} kcal`),
      sport_letzte_7_tage: lastDays(state.sport, 7).filter(d => d.count).map(d => ({ datum: d.date, minuten: d.minutes, kcal: d.kcal })),
      heute_noch_offen: round(rem),
      heutige_mahlzeiten: (state.log[todayKey()] || []).map(e => `${e.name} (${Math.round(e.kcal)} kcal)`),
      letzte_7_tage: last7,
      gewichtsverlauf: state.weights.slice(-8),
      abneigungen: state.dislikes,
      lieblingsrezepte: prefs.favorites.map(id => RECIPES.find(r => r.id === id)?.name).filter(Boolean),
      lieblingszutaten: prefs.topFoods.map(k => FOODS[k]?.name),
      schlecht_bewertet: prefs.blocked.map(id => RECIPES.find(r => r.id === id)?.name).filter(Boolean),
      kalora_rezepte: eligibleRecipes({ dislikes: state.dislikes, ratings: state.ratings }).map(r => `${r.name}: ${Math.round(r.nutrition.kcal)} kcal, ${Math.round(r.nutrition.p)} g P, ${Math.round(r.nutrition.f)} g F, ${Math.round(r.nutrition.s)} g Zucker`),
    }
  }

  const ask = async question => {
    const text = (question ?? q).trim()
    if (!text || busy) return
    setQ('')
    const next = [...history, { role: 'user', text, ts: Date.now() }]
    update(s => ({ ...s, coachHistory: next.slice(-40) }))
    setBusy(true)
    let answer
    try {
      if (ai?.enabled) answer = await askCoach({ question: text, history, context: context(), onText: t => setLive(t) })
      else answer = localCoach(text, { state, targets, consumed, rem, prefs })
    } catch (e) {
      answer = `${localCoach(text, { state, targets, consumed, rem, prefs })}\n\n(Hinweis: Claude war nicht erreichbar – ${e.message})`
    }
    update(s => ({ ...s, coachHistory: [...next, { role: 'assistant', text: answer, ts: Date.now() }].slice(-40) }))
    setBusy(false)
    setLive('')
  }

  // Rezeptnamen in Antworten antippbar machen
  const renderText = text => {
    const names = RECIPES.filter(r => text.includes(r.name))
    if (!names.length) return text
    const parts = []
    let rest = text
    while (rest) {
      const hit = names.map(r => ({ r, i: rest.indexOf(r.name) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i)[0]
      if (!hit) { parts.push(rest); break }
      parts.push(rest.slice(0, hit.i))
      parts.push(<button key={parts.length} style={{ color: 'var(--green-600)', fontWeight: 700, textDecoration: 'underline' }} onClick={() => open('recipe', { id: hit.r.id })}>{hit.r.name}</button>)
      rest = rest.slice(hit.i + hit.r.name.length)
    }
    return parts
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <header className="topbar">
        <div><div className="sub">{ai?.enabled ? 'Mit Claude' : 'Offline-Coach'}</div><h1>KI-Ernährungsberater</h1></div>
        {history.length > 0 && <button className="icon-btn" onClick={() => update(s => ({ ...s, coachHistory: [] }))} aria-label="Verlauf löschen"><Trash2 size={18} /></button>}
      </header>
      <div className="card tinted small">Heute noch offen: <b>{fmt(rem.kcal)} kcal</b> · <b>{fmt(rem.p)} g Protein</b> · <b>{fmt(rem.f)} g Fett</b> · <b>{fmt(rem.s)} g Zucker</b></div>

      <div className="chat mt">
        {history.length === 0 && (
          <div className="bubble ai">Hi{state.profile.name ? ` ${state.profile.name}` : ''}! 👋 Ich bin dein Kalora Coach. Ich kenne deine Ziele, was du heute gegessen hast und welche Rezepte dir schmecken. Frag mich alles rund um Ernährung!</div>
        )}
        {history.map((m, i) => <div key={i} className={`bubble ${m.role === 'user' ? 'me' : 'ai'}`}>{m.role === 'user' ? m.text : renderText(m.text)}</div>)}
        {busy && (live ? <div className="bubble ai">{live}</div> : <div className="bubble ai typing"><span /><span /><span /></div>)}
        <div ref={end} />
      </div>

      <div className="chips mt">{QUICK.map(x => <button key={x} className="chip" onClick={() => ask(x)} disabled={busy}><Sparkles size={13} /> {x}</button>)}</div>
      <form className="row mt-s" onSubmit={e => { e.preventDefault(); ask() }} style={{ position: 'sticky', bottom: 'calc(90px + env(safe-area-inset-bottom))' }}>
        <input className="input" placeholder="Frag deinen Coach …" value={q} onChange={e => setQ(e.target.value)} aria-label="Frage" />
        <button className="btn primary" type="submit" disabled={busy || !q.trim()} aria-label="Senden"><Send size={18} /></button>
      </form>
      <p className="tiny muted mt-s center">Allgemeine Ernährungstipps – kein Ersatz für ärztliche Beratung.</p>
    </div>
  )
}

const round = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]))

// Regelbasierter Coach (wenn kein KI-Server konfiguriert ist) – nutzt trotzdem alle persönlichen Daten
function localCoach(text, { state, targets, consumed, rem, prefs }) {
  const t = text.toLowerCase()
  const goal = state.profile.goal
  const top = (target, n = 3, filter = () => true) => rankRecipes(eligibleRecipes({ dislikes: state.dislikes, ratings: state.ratings }).filter(filter), { target, goal, prefs, ratings: state.ratings }).slice(0, n).map(x => x.recipe)
  const list = rs => rs.map(r => `• ${r.name} – ${fmt(r.nutrition.kcal)} kcal, ${fmt(r.nutrition.p)} g Protein`).join('\n')

  if (/protein|eiweiß/.test(t)) {
    const rs = top({ kcal: Math.max(300, rem.kcal * 0.6), p: rem.p, f: rem.f }, 3, r => r.nutrition.p >= 30)
    return `Dein Proteinziel liegt bei ${targets.p} g – heute hast du ${fmt(consumed.p)} g, also fehlen noch ${fmt(rem.p)} g.\n\nSo schaffst du es:\n• Verteile Protein auf 3–4 Mahlzeiten à 30–40 g\n• Schnelle Quellen: Skyr/Magerquark (11–12 g/100 g), Hüttenkäse, Eier, Hähnchen, Thunfisch, Tofu\n• Snack-Idee: 250 g Skyr + Beeren ≈ 28 g Protein\n\nPassende Rezepte für den Rest des Tages:\n${list(rs)}`
  }
  if (/zucker|süß/.test(t)) {
    return `Dein Zuckerlimit liegt bei ${targets.s} g pro Tag (10 % deiner Energie, WHO-Empfehlung). Heute: ${fmt(consumed.s)} g – noch ${fmt(rem.s)} g Spielraum.\n\nTipps:\n• Softdrinks & Säfte durch Wasser, Tee oder Zero-Getränke ersetzen\n• Naturjoghurt/Skyr statt Fruchtjoghurt, selbst mit Beeren süßen\n• Auf Etiketten achten: Sirup, Dextrose, Maltodextrin = Zucker\n• Süßhunger nach dem Essen? Ein Stück Zartbitterschokolade (85 %) oder ${top({ kcal: 250, p: 10, s: 10 }, 1, r => r.meals.includes('D') || r.meals.includes('S'))[0]?.name || 'Obst'}`
  }
  if (/abnehm|gewicht verlier|fett verbrenn|diät/.test(t)) {
    const rs = top({ kcal: targets.kcal * 0.35, p: targets.p * 0.4, f: targets.f * 0.35 }, 3, r => r.tags.includes('abnehmen'))
    return `Für dich gilt: ${targets.kcal} kcal pro Tag (${targets.adjust < 0 ? `${Math.abs(targets.adjust)} kcal unter deinem Bedarf von ${targets.tdee} kcal` : `dein Bedarf liegt bei ${targets.tdee} kcal`}).\n\nDie wichtigsten Hebel:\n1. Kaloriendefizit konstant halten – jeden Tag tracken, auch am Wochenende\n2. Viel Protein (${targets.p} g) – schützt Muskeln und sättigt\n3. Ballaststoffe (${targets.fi} g) & Gemüse für Volumen\n4. Krafttraining 2–3× pro Woche + 8.000–10.000 Schritte\n5. Wöchentlich wiegen und den Durchschnitt beobachten\n\nRezepte mit hoher Proteindichte:\n${list(rs)}`
  }
  if (/heute|essen|hunger|abendessen|mittag|frühstück|vorschlag/.test(t)) {
    const rs = top({ kcal: Math.max(250, rem.kcal * 0.6), p: rem.p * 0.7, f: rem.f * 0.7, s: rem.s }, 3)
    return `Heute sind noch ${fmt(rem.kcal)} kcal, ${fmt(rem.p)} g Protein und ${fmt(rem.f)} g Fett offen.${state.dislikes.length ? ` (ohne ${state.dislikes.join(', ')})` : ''}\n\nDas passt am besten:\n${list(rs)}\n\nTippe auf ein Rezept für Zutaten & Zubereitung.`
  }
  if (/muskel|aufbau|masse/.test(t)) {
    return `Für Muskelaufbau: ${targets.kcal} kcal (leichter Überschuss), ${targets.p} g Protein (≈ 2 g/kg) und genug Kohlenhydrate (${targets.c} g) fürs Training. Trainiere progressiv, schlafe 7–9 h und verteile Protein über den Tag.\n\nTop-Rezepte:\n${list(top({ kcal: 700, p: 50, f: 25 }, 3, r => r.nutrition.p >= 40))}`
  }
  return `Gute Frage! Deine Eckdaten: ${targets.kcal} kcal, ${targets.p} g Protein, ${targets.f} g Fett, ${targets.c} g Kohlenhydrate pro Tag. Heute noch offen: ${fmt(rem.kcal)} kcal.\n\nIch kann dir helfen bei: Abnehmen, Proteinziel, Zucker reduzieren, Muskelaufbau und konkreten Essensvorschlägen. Für frei formulierte Fragen muss der Betreiber die KI (Claude) auf dem Server aktivieren.`
}
