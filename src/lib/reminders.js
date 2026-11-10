// Tägliche Erinnerungen (Mahlzeiten, Gewicht, Wasser) über die Notification-API.
// Läuft, solange Kalora geöffnet ist bzw. als installierte PWA im Hintergrund aktiv ist.
import { useEffect } from 'react'
import { useStore } from '../store.jsx'
import { todayKey } from './nutrition.js'

const FIRED_KEY = 'kalora:reminders'

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

async function show(title, body, notify) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker?.getRegistration?.()
      if (reg) await reg.showNotification(title, { body, icon: '/icon.svg', badge: '/icon.svg', tag: title })
      else new Notification(title, { body, icon: '/icon.svg' })
      return
    }
  } catch { /* Fallback unten */ }
  notify(`${title} – ${body}`)
}

export function useReminders() {
  const { state, notify } = useStore()
  const n = state.settings.notifications
  useEffect(() => {
    if (!n.meals && !n.weight && !n.water) return
    const tick = () => {
      const now = new Date()
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const day = todayKey()
      let fired
      try { fired = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}') } catch { fired = {} }
      if (fired.day !== day) fired = { day, keys: [] }
      const fire = (key, title, body) => {
        if (fired.keys.includes(key)) return
        fired.keys.push(key)
        show(title, body, notify)
      }
      if (n.meals) {
        const labels = ['Frühstück', 'Mittagessen', 'Abendessen']
        n.mealTimes.forEach((t, i) => { if (t === hm) fire(`meal${i}`, `${labels[i] || 'Mahlzeit'} eintragen 🍽️`, 'Fotografiere dein Essen – Kalora rechnet für dich.') })
      }
      if (n.weight && n.weightTime === hm && !state.weights.some(w => w.date === day)) fire('weight', 'Gewicht eintragen ⚖️', 'Am besten morgens nüchtern – für einen genauen Verlauf.')
      if (n.water && now.getHours() >= 8 && now.getHours() < 22) {
        const slot = Math.floor((now.getHours() * 60 + now.getMinutes()) / n.waterEvery)
        if ((now.getHours() * 60 + now.getMinutes()) % n.waterEvery === 0) fire(`water${slot}`, 'Wasser trinken 💧', 'Zeit für ein Glas Wasser!')
      }
      try { localStorage.setItem(FIRED_KEY, JSON.stringify(fired)) } catch { /* ignore */ }
    }
    tick()
    const id = setInterval(tick, 20_000)
    return () => clearInterval(id)
  }, [n, state.weights, notify])
}
