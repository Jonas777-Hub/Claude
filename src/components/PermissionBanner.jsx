// Hinweis + Knopf, wenn Kalora noch keine Erlaubnis für Claude hat (z. B. bei Personen, denen der Link geschickt wurde)
import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useStore } from '../store.jsx'

export function needsPermission(perms) {
  if (!perms) return false
  return ['sample', 'db', 'user'].some(n => perms[n] === 'prompt' || perms[n] === 'denied')
}

export default function PermissionBanner({ compact }) {
  const { perms, requestPermissions, notify } = useStore()
  const [busy, setBusy] = useState(false)
  if (!needsPermission(perms)) return null
  const denied = Object.values(perms).includes('denied')
  const ask = async () => {
    setBusy(true)
    const ok = await requestPermissions()
    setBusy(false)
    notify(ok ? 'Danke! KI-Funktionen sind jetzt aktiv.' : 'Noch nicht erlaubt – du kannst es jederzeit hier oder im Menü „Berechtigungen" der Seite einschalten.', ok ? 'ok' : 'err')
  }
  return (
    <div className="card" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, #22C55E 16%, var(--card)), color-mix(in srgb, #0EA5A4 12%, var(--card)))', borderColor: 'color-mix(in srgb, #22C55E 35%, transparent)', marginBottom: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span style={{ width: 42, height: 42, borderRadius: 14, background: 'var(--grad-green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Sparkles size={22} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bold">KI-Funktionen freischalten</div>
          {!compact && <p className="small text-2 mt-s">Kalora braucht einmalig deine Erlaubnis, um Claude zu nutzen – für Fotoerkennung, Spracheingabe, KI-Coach und damit deine Daten an deinem Claude-Konto gespeichert werden. Es läuft über dein eigenes Claude-Konto.</p>}
        </div>
      </div>
      <button className="btn primary block mt" onClick={ask} disabled={busy}>{busy ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />} {denied ? 'Berechtigungen öffnen' : 'Erlauben'}</button>
    </div>
  )
}
