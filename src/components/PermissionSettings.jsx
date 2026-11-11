// Profil → Berechtigungen: sehen, was erlaubt ist, und alles mit einem Tipp freigeben
import { useState } from 'react'
import { ShieldCheck, Loader2, RefreshCw, Settings2, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import { useStore } from '../store.jsx'
import { STATIC } from '../static.js'

const ROWS = [
  ['sample', 'KI (Claude)', 'Fotoerkennung, Produkt-Scan per Foto, Spracheingabe, KI-Coach, Rezeptgenerator'],
  ['db', 'Daten speichern', 'Profil, Tagebuch & Co. an deinem Claude-Konto – auf allen Geräten gleich'],
  ['user', 'Konto erkennen', 'Damit Kalora weiß, dass du es bist – ohne extra Anmeldung'],
]
const LABEL = {
  granted: ['Erlaubt', CheckCircle2, 'var(--green)', ''],
  prompt: ['Noch nicht gefragt', HelpCircle, 'var(--orange)', 'orange'],
  denied: ['Abgelehnt', XCircle, 'var(--red)', 'red'],
  unavailable: ['Nicht verfügbar', AlertTriangle, 'var(--muted)', 'gray'],
}

export default function PermissionSettings() {
  const { perms, requestPermissions, managePermissions, refreshPerms, notify } = useStore()
  const [busy, setBusy] = useState('')
  if (!STATIC) return null

  const allGranted = perms && ROWS.every(([k]) => perms[k] === 'granted')
  const run = async (what, fn) => {
    setBusy(what)
    const ok = await fn()
    const st = await refreshPerms()
    setBusy('')
    const done = st && ROWS.every(([k]) => st[k] === 'granted')
    notify(done ? 'Alle Berechtigungen sind erlaubt ✓' : ok === false ? 'Das Menü ließ sich nicht öffnen – tippe oben rechts auf „…" → „Berechtigungen".' : 'Noch nicht alles erlaubt.', done ? 'ok' : 'err')
  }

  return (
    <section className="card mt">
      <div className="card-title"><ShieldCheck size={18} /> Berechtigungen</div>
      {perms?.noRuntime ? (
        <p className="small text-2">Berechtigungen gibt es nur, wenn Kalora über <b>claude.ai</b> geöffnet wird und du dort <b>angemeldet</b> bist. Öffne den Kalora-Link in der Claude-App oder in Safari (angemeldet bei claude.ai) – dann kannst du hier alles erlauben.</p>
      ) : (
        <>
          <div className="list">
            {ROWS.map(([key, title, desc]) => {
              const [label, Icon, color, badge] = LABEL[perms?.[key] || 'unavailable']
              return (
                <div key={key} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <Icon size={20} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}><div className="bold small">{title}</div><div className="tiny muted">{desc}</div></div>
                  <span className={`badge ${badge}`}>{perms ? label : '…'}</span>
                </div>
              )
            })}
          </div>
          {!allGranted && (
            <button className="btn primary block mt" onClick={() => run('req', requestPermissions)} disabled={!!busy}>
              {busy === 'req' ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />} Alle Berechtigungen erlauben
            </button>
          )}
          <div className="row mt-s">
            <button className="btn sm" style={{ flex: 1 }} onClick={() => run('manage', managePermissions)} disabled={!!busy}><Settings2 size={16} /> Verwalten</button>
            <button className="btn sm" style={{ flex: 1 }} onClick={() => run('refresh', async () => true)} disabled={!!busy}><RefreshCw size={16} /> Neu prüfen</button>
          </div>
          <p className="tiny muted mt-s">Alles läuft über dein eigenes Claude-Konto. Deine Daten sieht niemand sonst. Abgelehnt? „Verwalten" öffnet das Berechtigungs-Menü von Claude – dort einfach einschalten.</p>
        </>
      )}
    </section>
  )
}
