// Kalorien- und Makroberechnung (Mifflin-St Jeor + Aktivitätsfaktor + Zielanpassung)

export const ACTIVITY_LEVELS = [
  { id: 'kaum', label: 'Kaum Bewegung', desc: 'Bürojob, kaum Sport', factor: 1.2 },
  { id: 'leicht', label: 'Leicht aktiv', desc: '1–2× Sport pro Woche', factor: 1.375 },
  { id: 'moderat', label: 'Moderat aktiv', desc: '3–4× Sport pro Woche', factor: 1.55 },
  { id: 'sehr', label: 'Sehr aktiv', desc: '5–6× Sport oder körperliche Arbeit', factor: 1.725 },
  { id: 'leistung', label: 'Leistungssportler', desc: 'Tägliches intensives Training', factor: 1.9 },
]

export const GOALS = [
  { id: 'abnehmen', label: 'Abnehmen', desc: 'Körperfett reduzieren', emoji: '📉' },
  { id: 'halten', label: 'Gewicht halten', desc: 'Form halten, gesund essen', emoji: '⚖️' },
  { id: 'aufbau', label: 'Muskelaufbau', desc: 'Kraft & Muskelmasse aufbauen', emoji: '💪' },
]

export const SEXES = [
  { id: 'm', label: 'Männlich' },
  { id: 'w', label: 'Weiblich' },
  { id: 'd', label: 'Divers' },
]

export const NUTRIENTS = [
  { key: 'kcal', label: 'Kalorien', short: 'kcal', unit: 'kcal', type: 'limit' },
  { key: 'p', label: 'Protein', short: 'Protein', unit: 'g', type: 'goal' },
  { key: 'c', label: 'Kohlenhydrate', short: 'Kohlenh.', unit: 'g', type: 'limit' },
  { key: 'f', label: 'Fett', short: 'Fett', unit: 'g', type: 'limit' },
  { key: 's', label: 'Zucker', short: 'Zucker', unit: 'g', type: 'limit' },
  { key: 'fi', label: 'Ballaststoffe', short: 'Ballastst.', unit: 'g', type: 'goal' },
]
export const NUTRIENT_MAP = Object.fromEntries(NUTRIENTS.map(n => [n.key, n]))

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = Math.round((new Date(dateStr) - new Date(todayKey())) / 86400000)
  return d > 0 ? d : null
}

export function calcTargets(profile) {
  if (!profile) return null
  const { sex, age, height, weight, activity, goal, targetWeight, targetDate } = profile
  const w = Number(weight) || 75
  const h = Number(height) || 175
  const a = Number(age) || 30
  const sexOffset = sex === 'm' ? 5 : sex === 'w' ? -161 : -78
  const bmr = 10 * w + 6.25 * h - 5 * a + sexOffset
  const factor = ACTIVITY_LEVELS.find(x => x.id === activity)?.factor ?? 1.375
  const tdee = bmr * factor
  const days = daysUntil(targetDate)
  const tw = Number(targetWeight) || null

  let adjust = 0
  let note = ''
  if (goal === 'abnehmen') {
    adjust = -500
    if (tw && tw < w && days) adjust = -Math.min(1000, Math.max(250, ((w - tw) * 7700) / days))
    note = `Defizit von ${Math.round(-adjust)} kcal/Tag ≈ ${((-adjust * 7) / 7700).toFixed(2)} kg pro Woche`
  } else if (goal === 'aufbau') {
    adjust = 300
    if (tw && tw > w && days) adjust = Math.min(500, Math.max(150, ((tw - w) * 7700) / days))
    note = `Überschuss von ${Math.round(adjust)} kcal/Tag für sauberen Muskelaufbau`
  } else {
    note = 'Kalorien auf Erhaltungsniveau'
  }
  const minKcal = sex === 'm' ? 1500 : 1200
  const kcal = Math.round(Math.max(minKcal, tdee + adjust) / 10) * 10

  // Proteinbezug: bei starkem Übergewicht Referenzgewicht (BMI 25) statt Ist-Gewicht
  const bmi = w / ((h / 100) ** 2)
  const refWeight = bmi > 30 ? 25 * (h / 100) ** 2 : w
  const proteinPerKg = goal === 'halten' ? 1.6 : goal === 'aufbau' ? 2.0 : 2.0
  const p = Math.round(refWeight * proteinPerKg)
  const f = Math.round(Math.max(refWeight * 0.8, (kcal * 0.28) / 9))
  const c = Math.max(50, Math.round((kcal - p * 4 - f * 9) / 4))
  const s = Math.round((kcal * 0.1) / 4) // WHO: max. 10 % der Energie aus freiem Zucker
  const fi = Math.round(Math.max(sex === 'm' ? 30 : 25, (kcal / 1000) * 14))
  const water = Math.round((w * 35) / 250) * 250

  let etaWeeks = null
  if (tw && adjust !== 0) {
    const diff = goal === 'abnehmen' ? w - tw : tw - w
    if (diff > 0) etaWeeks = Math.ceil((diff * 7700) / (Math.abs(adjust) * 7))
  }

  return { kcal, p, f, c, s, fi, water, bmr: Math.round(bmr), tdee: Math.round(tdee), adjust: Math.round(adjust), note, bmi: +bmi.toFixed(1), etaWeeks }
}

// Farblogik: Grün = im Zielbereich, Orange = fast erreicht, Rot = überschritten
export function nutrientStatus(key, consumed, target) {
  if (!target) return { color: 'var(--green)', state: 'ok', ratio: 0 }
  const ratio = consumed / target
  const type = NUTRIENT_MAP[key]?.type ?? 'limit'
  if (type === 'goal') {
    if (ratio >= 1) return { color: 'var(--green)', state: 'erreicht', ratio }
    if (ratio >= 0.85) return { color: 'var(--orange)', state: 'fast', ratio }
    return { color: 'var(--green)', state: 'ok', ratio }
  }
  if (ratio > 1) return { color: 'var(--red)', state: 'über', ratio }
  if (ratio >= 0.85) return { color: 'var(--orange)', state: 'fast', ratio }
  return { color: 'var(--green)', state: 'ok', ratio }
}

export function todayKey(d = new Date()) {
  const z = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export function sumEntries(entries = []) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, s: 0, fi: 0 }
  for (const e of entries) for (const k in t) t[k] += Number(e[k]) || 0
  return t
}

export function remaining(targets, consumed) {
  const r = {}
  for (const n of NUTRIENTS) r[n.key] = Math.max(0, (targets?.[n.key] || 0) - (consumed?.[n.key] || 0))
  return r
}

export function slotForTime(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60
  if (h < 10.5) return 'F'
  if (h < 15) return 'M'
  if (h < 17.5) return 'S'
  return 'A'
}

export const SLOTS = [
  { id: 'F', label: 'Frühstück', emoji: '🌅', share: 0.25 },
  { id: 'M', label: 'Mittagessen', emoji: '☀️', share: 0.35 },
  { id: 'A', label: 'Abendessen', emoji: '🌙', share: 0.3 },
  { id: 'S', label: 'Snacks', emoji: '🍎', share: 0.1 },
]

export const fmt = (n, d = 0) => (Number(n) || 0).toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: 0 })
