// Speichern am Claude-Konto (Web-App auf claude.ai): ohne eigene Anmeldung.
// Die Daten liegen im privaten Bereich des Nutzers (data/users/<id>/) – niemand sonst kann sie lesen,
// auch nicht der Ersteller der App. So sind Profil, Tagebuch & Co. in Browser und Claude-App gleich.
import { STATIC } from '../static.js'

// Aufteilung in mehrere Dokumente (max. 256 KB je Dokument)
const CORE = ['profile', 'settings', 'weights', 'dislikes', 'pantry', 'ratings', 'saved', 'cooked', 'water', 'version']
const EXTRA = ['favorites', 'prices', 'myProducts', 'photoMemory', 'customRecipes', 'weekPlan', 'cart', 'coachHistory']
const LOG_DAYS = 180
const MAX_DOC = 230_000

const pick = (s, keys) => Object.fromEntries(keys.filter(k => s[k] !== undefined).map(k => [k, s[k]]))
const size = o => new Blob([JSON.stringify(o)]).size

// Fotos im Tagebuch notfalls weglassen, damit ein Tag unter das Limit passt
function fitDay(entries) {
  let doc = { entries }
  if (size(doc) <= MAX_DOC) return doc
  doc = { entries: entries.map(e => ({ ...e, photo: e.photo && e.photo.startsWith('data:') ? null : e.photo })) }
  return doc
}

function fitExtra(data) {
  let d = { ...data, coachHistory: (data.coachHistory || []).slice(-20) }
  if (size(d) > MAX_DOC) d = { ...d, photoMemory: (d.photoMemory || []).slice(0, 10), coachHistory: (d.coachHistory || []).slice(-6) }
  if (size(d) > MAX_DOC) d = { ...d, customRecipes: (d.customRecipes || []).slice(0, 15) }
  return d
}

export async function connectCloud() {
  if (!STATIC || !window.claude?.use) return null
  const timeout = new Promise(r => setTimeout(() => r([null, null]), 8000))
  let db, user
  try { [db, user] = await Promise.race([Promise.all([window.claude.use('db'), window.claude.use('user')]), timeout]) } catch { return null }
  if (!db || !user) return null
  let id = null
  try { id = await user.id() } catch { /* kein Konto */ }
  if (!id) return null
  const coreRef = db.doc(`data/users/${id}/core`)
  const extraRef = db.doc(`data/users/${id}/extra`)
  const logCol = coreRef.collection('log')
  const written = {} // zuletzt geschriebener Stand je Dokument (nur Änderungen schreiben)
  const queue = new Map()
  let busy = false

  async function flush() {
    if (busy) return
    busy = true
    try {
      while (queue.size) {
        const [key, { ref, data }] = queue.entries().next().value
        queue.delete(key)
        const json = JSON.stringify(data)
        if (written[key] === json) continue
        try { await ref.set(data); written[key] = json } catch (e) {
          if (e?.code === 'unavailable') { await new Promise(r => setTimeout(r, 800 + Math.random() * 800)); try { await ref.set(data); written[key] = json } catch { /* nächster Versuch beim nächsten Speichern */ } }
        }
      }
    } finally { busy = false }
  }

  return {
    async load() {
      const since = new Date(); since.setDate(since.getDate() - LOG_DAYS)
      const sinceKey = since.toISOString().slice(0, 10)
      const [core, extra, logs] = await Promise.all([coreRef.get(), extraRef.get(), logCol.where('date', '>=', sinceKey).get().catch(() => null)])
      if (!core.exists) return null
      const log = {}
      for (const d of logs?.docs || []) { const v = d.data(); if (v?.date) log[v.date] = v.entries || [] }
      const c = core.data(), x = extra.exists ? extra.data() : {}
      written.core = JSON.stringify(c); if (extra.exists) written.extra = JSON.stringify(x)
      for (const [date, entries] of Object.entries(log)) written[`log:${date}`] = JSON.stringify({ date, ...fitDay(entries) })
      return { ...x, ...c, log, updatedAt: c.updatedAt || 0 }
    },
    // Speichert nur geänderte Teile; Tagebuch tageweise
    save(state) {
      const core = { ...pick(state, CORE), updatedAt: state.updatedAt || Date.now() }
      queue.set('core', { ref: coreRef, data: core })
      queue.set('extra', { ref: extraRef, data: fitExtra(pick(state, EXTRA)) })
      for (const [date, entries] of Object.entries(state.log || {})) {
        const data = { date, ...fitDay(entries) }
        const key = `log:${date}`
        if (written[key] !== JSON.stringify(data)) queue.set(key, { ref: logCol.doc(date), data })
      }
      return flush()
    },
  }
}
