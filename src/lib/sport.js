// Sporti – Trainings erfassen und verbrannte Kalorien schätzen (MET-Methode)
// kcal = MET × Körpergewicht (kg) × Dauer (h). Gutgeschrieben wird nur der Mehrverbrauch
// gegenüber Ruhe (MET − 1), weil der Grundumsatz schon im Tagesziel steckt.
import { todayKey } from './nutrition.js'

export const SPORTS = [
  { id: 'laufen', label: 'Laufen', emoji: '🏃', met: 9.8 },
  { id: 'gehen', label: 'Spazieren', emoji: '🚶', met: 3.5 },
  { id: 'wandern', label: 'Wandern', emoji: '🥾', met: 6.0 },
  { id: 'rad', label: 'Radfahren', emoji: '🚴', met: 7.5 },
  { id: 'schwimmen', label: 'Schwimmen', emoji: '🏊', met: 7.0 },
  { id: 'kraft', label: 'Krafttraining', emoji: '🏋️', met: 5.0 },
  { id: 'hiit', label: 'HIIT', emoji: '🔥', met: 8.0 },
  { id: 'fussball', label: 'Fußball', emoji: '⚽', met: 7.0 },
  { id: 'tennis', label: 'Tennis', emoji: '🎾', met: 7.3 },
  { id: 'yoga', label: 'Yoga', emoji: '🧘', met: 2.8 },
  { id: 'tanzen', label: 'Tanzen', emoji: '💃', met: 5.0 },
  { id: 'andere', label: 'Sonstiges', emoji: '⭐', met: 5.0 },
]
export const SPORT_MAP = Object.fromEntries(SPORTS.map(s => [s.id, s]))

export const INTENSITIES = [
  { id: 'leicht', label: 'Locker', factor: 0.8 },
  { id: 'mittel', label: 'Mittel', factor: 1 },
  { id: 'hart', label: 'Intensiv', factor: 1.25 },
]

// Anteil der Sportkalorien, der zum Tagesziel addiert wird. Das Aktivitätslevel enthält schon
// „durchschnittlichen" Sport, deshalb standardmäßig nur die Hälfte (vermeidet Doppelzählung).
export const CREDIT_OPTIONS = [
  { id: 0, label: 'Nichts' },
  { id: 0.5, label: 'Hälfte' },
  { id: 1, label: 'Alles' },
]
export const DEFAULT_CREDIT = 0.5

export function burnedKcal({ sport, minutes, intensity = 'mittel' }, weightKg) {
  const met = (SPORT_MAP[sport]?.met ?? 5) * (INTENSITIES.find(i => i.id === intensity)?.factor ?? 1)
  const kg = Number(weightKg) || 75
  const h = Math.max(0, Number(minutes) || 0) / 60
  return Math.round(Math.max(0, met - 1) * kg * h)
}

export function sumWorkouts(list = []) {
  return list.reduce((t, w) => ({ minutes: t.minutes + (Number(w.minutes) || 0), kcal: t.kcal + (Number(w.kcal) || 0), count: t.count + 1 }), { minutes: 0, kcal: 0, count: 0 })
}

export function sportBonus(list, credit = DEFAULT_CREDIT) {
  return Math.round((sumWorkouts(list).kcal * credit) / 10) * 10
}

// Letzte n Tage (inkl. heute), älteste zuerst
export function lastDays(sport = {}, n = 7, from = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from); d.setDate(d.getDate() - i)
    const key = todayKey(d)
    out.push({ date: key, ...sumWorkouts(sport[key]) })
  }
  return out
}

// Aufeinanderfolgende Tage mit Training; heute zählt mit, ein noch offener heutiger Tag bricht die Serie nicht
export function streak(sport = {}, from = new Date()) {
  let n = 0
  const d = new Date(from)
  if (!sport[todayKey(d)]?.length) d.setDate(d.getDate() - 1)
  while (sport[todayKey(d)]?.length) { n++; d.setDate(d.getDate() - 1) }
  return n
}
