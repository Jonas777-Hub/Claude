// Profil → Berechtigungen: sehen, was erlaubt ist, und alles mit einem Tipp freigeben
import { useState } from 'react'
import { ShieldCheck, Loader2, RefreshCw, Settings2, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import { useStore } from '../store.jsx'
import { STATIC } from '../static.js'
import { useAIStatus } from '../lib/ai.js'

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
  const { perms, requestPermissions, managePermissions, refreshPerms, notify, cloud } = useStore()
  const ai = useAIStatus()
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
        <>
          <p className="small text-2">{typeof window !== 'undefined' && window.claude
            ? <>Claude stellt Kalora in dieser Ansicht <b>nicht alle Funktionen</b> bereit – die Erlaubnis-Abfrage gibt es hier nicht. Was verfügbar ist, siehst du unten.</>
            : <>Diese Ansicht stellt Kalora <b>keine Verbindung zu Claude</b> bereit – deshalb kann die App hier nicht nach der Erlaubnis fragen.</>}</p>
          <div className="card tinted mt-s small">
            <div className="bold">Diagnose</div>
            <div className="kv mt-s">
              <span className="k">Claude-Verbindung</span><span className="v">{typeof window !== 'undefined' && window.claude ? 'vorhanden' : '❌ fehlt'}</span>
              <span className="k">KI (Claude)</span><span className="v">{ai == null ? '…' : ai.enabled ? '✅ verfügbar' : '❌ nicht verfügbar'}</span>
              <span className="k">Speichern am Konto</span><span className="v">{cloud === 'on' ? '✅ aktiv' : cloud === 'connecting' ? '…' : '❌ nur lokal'}</span>
            </div>
          </div>
          {ai && !ai.enabled && cloud === 'on' && <p className="small text-2 mt-s">Speichern klappt – die <b>KI</b> gibt Claude in dieser Ansicht aber nicht frei. Tippe oben auf <b>„ÖFFNEN"</b> (in der Claude-App öffnen) – dort ist die KI oft verfügbar.</p>}
          <p className="small text-2 mt-s"><b>So klappt es meistens:</b> 1) Claude-App im App Store aktualisieren. 2) Bei claude.ai angemeldet sein. 3) Den Link <b>in Safari</b> öffnen: <span style={{ userSelect: 'all' }}>claude.ai/artifact/MHYcTVG2BxAwoQ5F8UeMzg</span> – dort ist die Verbindung zu Claude am zuverlässigsten.</p>
        </>
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
