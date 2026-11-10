// KALORA Server: Konten, Cloud-Sync, geteilte Einkaufswagen (Echtzeit via WebSocket), KI-Endpunkte
import express from 'express'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { WebSocketServer } from 'ws'
import { db } from './db.js'
import { hashPassword, verifyPassword, signToken, requireAuth, optionalAuth } from './auth.js'
import { aiEnabled, analyzePhoto, coach, generateRecipe } from './ai.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '10mb' }))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => {
  console.error(err)
  res.status(err.status && err.status < 600 ? err.status : 500).json({ error: err.status ? err.message : 'Serverfehler – bitte später erneut versuchen.' })
})

// ---------- einfache Ratenbegrenzung ----------
const buckets = new Map()
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}:${req.user?.id || req.ip}`
    const now = Date.now()
    const b = buckets.get(key) || { n: 0, reset: now + windowMs }
    if (now > b.reset) { b.n = 0; b.reset = now + windowMs }
    b.n++
    buckets.set(key, b)
    if (b.n > max) return res.status(429).json({ error: 'Zu viele Anfragen – bitte kurz warten.' })
    next()
  }
}

// ---------- Konten ----------
app.post('/api/auth/register', rateLimit(10, 60_000), wrap(async (req, res) => {
  const { email, password, name } = req.body || {}
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) return res.status(400).json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' })
  if (!password || password.length < 8) return res.status(400).json({ error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' })
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Für diese E-Mail gibt es bereits ein Konto.' })
  const info = db.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(email.trim(), (name || email.split('@')[0]).trim().slice(0, 60), hashPassword(password), Date.now())
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(info.lastInsertRowid)
  res.json({ token: signToken(user.id), user })
}))

app.post('/api/auth/login', rateLimit(10, 60_000), wrap(async (req, res) => {
  const { email, password } = req.body || {}
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '')
  if (!row || !verifyPassword(password || '', row.password_hash)) return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch.' })
  res.json({ token: signToken(row.id), user: { id: row.id, email: row.email, name: row.name } })
}))

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }))

app.delete('/api/me', requireAuth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id)
  res.json({ ok: true })
})

// ---------- Cloud-Synchronisierung ----------
app.get('/api/state', requireAuth, (req, res) => {
  const row = db.prepare('SELECT data, updated_at FROM user_state WHERE user_id = ?').get(req.user.id)
  res.json(row ? { data: JSON.parse(row.data), updatedAt: row.updated_at } : { data: null, updatedAt: 0 })
})

app.put('/api/state', requireAuth, (req, res) => {
  const { data, updatedAt } = req.body || {}
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Ungültige Daten.' })
  const json = JSON.stringify(data)
  if (json.length > 8_000_000) return res.status(413).json({ error: 'Datenmenge zu groß.' })
  const ts = Number(updatedAt) || Date.now()
  const cur = db.prepare('SELECT updated_at FROM user_state WHERE user_id = ?').get(req.user.id)
  if (cur && cur.updated_at > ts) return res.status(409).json({ error: 'Neuere Daten auf dem Server.', updatedAt: cur.updated_at })
  db.prepare(`INSERT INTO user_state (user_id, data, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).run(req.user.id, json, ts)
  // Bewertungen zusätzlich normalisiert speichern
  const up = db.prepare(`INSERT INTO recipe_ratings (user_id, recipe_id, score, comment, suggestion, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, recipe_id) DO UPDATE SET score = excluded.score, comment = excluded.comment, suggestion = excluded.suggestion`)
  for (const [rid, r] of Object.entries(data.ratings || {})) {
    const score = Math.round(Number(r?.score))
    if (score >= 1 && score <= 10) up.run(req.user.id, rid, score, r.comment || null, r.suggestion || null, Date.now())
  }
  res.json({ ok: true, updatedAt: ts })
})

app.get('/api/ratings/summary', (_req, res) => {
  const rows = db.prepare('SELECT recipe_id, AVG(score) AS avg, COUNT(*) AS n FROM recipe_ratings GROUP BY recipe_id').all()
  res.json(Object.fromEntries(rows.map(r => [r.recipe_id, { avg: Math.round(r.avg * 10) / 10, n: r.n }])))
})

// ---------- Geteilte Einkaufswagen ----------
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newCode() {
  let c
  do { c = Array.from(crypto.randomBytes(8), b => ALPHABET[b % ALPHABET.length]).join('') }
  while (db.prepare('SELECT 1 FROM carts WHERE code = ?').get(c))
  return c
}

function loadCart(code) {
  const cart = db.prepare('SELECT code, name, created_at, updated_at FROM carts WHERE code = ?').get(code)
  if (!cart) return null
  const items = db.prepare('SELECT data FROM cart_items WHERE cart_code = ? ORDER BY updated_at').all(code).map(r => JSON.parse(r.data))
  const activity = db.prepare('SELECT ts, actor, text FROM cart_activity WHERE cart_code = ? ORDER BY ts DESC LIMIT 100').all(code)
  return { ...cart, items, activity, online: [...(rooms.get(code) || [])].map(ws => ws.member).filter(Boolean) }
}

const cleanItem = it => ({
  id: String(it.id).slice(0, 40), key: it.key ? String(it.key).slice(0, 40) : null, name: String(it.name || '').slice(0, 120),
  amount: Number(it.amount) || 0, unit: String(it.unit || 'Stück').slice(0, 12), cat: String(it.cat || 'so').slice(0, 4),
  checked: !!it.checked, assignee: it.assignee ? String(it.assignee).slice(0, 40) : null,
  recipes: Array.isArray(it.recipes) ? it.recipes.slice(0, 20).map(r => String(r).slice(0, 120)) : [],
  addedBy: String(it.addedBy || '').slice(0, 40), updatedAt: Date.now(),
})

function logActivity(code, actor, text) {
  db.prepare('INSERT INTO cart_activity (cart_code, ts, actor, text) VALUES (?, ?, ?, ?)').run(code, Date.now(), String(actor).slice(0, 40), text.slice(0, 200))
}

function applyOp(code, op, actor) {
  const getItem = id => {
    const row = db.prepare('SELECT data FROM cart_items WHERE cart_code = ? AND id = ?').get(code, id)
    return row ? JSON.parse(row.data) : null
  }
  const save = it => db.prepare(`INSERT INTO cart_items (id, cart_code, data, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(cart_code, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).run(it.id, code, JSON.stringify(it), Date.now())
  switch (op.type) {
    case 'add': {
      for (const raw of (op.items || [op.item]).filter(Boolean)) {
        const it = cleanItem({ ...raw, addedBy: actor })
        // gleiche Zutat zusammenführen (300 g Reis + 500 g Reis = 800 g Reis)
        const all = db.prepare('SELECT data FROM cart_items WHERE cart_code = ?').all(code).map(r => JSON.parse(r.data))
        const match = all.find(e => !e.checked && e.unit === it.unit && ((it.key && e.key === it.key) || (!it.key && e.name.toLowerCase() === it.name.toLowerCase())))
        if (match) {
          match.amount = Math.round(match.amount + it.amount)
          match.recipes = [...new Set([...(match.recipes || []), ...it.recipes])]
          match.updatedAt = Date.now()
          save(match)
        } else save(it)
        logActivity(code, actor, `hat ${it.name} hinzugefügt`)
      }
      break
    }
    case 'update': {
      const it = getItem(op.id)
      if (!it) return
      const patch = op.patch || {}
      const next = cleanItem({ ...it, ...patch })
      next.addedBy = it.addedBy
      save(next)
      if ('checked' in patch && patch.checked !== it.checked) logActivity(code, actor, patch.checked ? `hat ${it.name} gekauft` : `hat ${it.name} wieder geöffnet`)
      else if ('assignee' in patch) logActivity(code, actor, patch.assignee ? `hat ${it.name} ${patch.assignee} zugewiesen` : `hat die Zuweisung von ${it.name} entfernt`)
      else logActivity(code, actor, `hat ${it.name} geändert`)
      break
    }
    case 'remove': {
      const it = getItem(op.id)
      if (!it) return
      db.prepare('DELETE FROM cart_items WHERE cart_code = ? AND id = ?').run(code, op.id)
      logActivity(code, actor, `hat ${it.name} entfernt`)
      break
    }
    case 'clearChecked': {
      db.prepare("DELETE FROM cart_items WHERE cart_code = ? AND json_extract(data, '$.checked') = 1").run(code)
      logActivity(code, actor, 'hat gekaufte Artikel entfernt')
      break
    }
    case 'rename': {
      db.prepare('UPDATE carts SET name = ? WHERE code = ?').run(String(op.name || 'Einkaufsliste').slice(0, 60), code)
      break
    }
    default: throw Object.assign(new Error('Unbekannte Aktion.'), { status: 400 })
  }
  db.prepare('UPDATE carts SET updated_at = ? WHERE code = ?').run(Date.now(), code)
}

app.post('/api/carts', optionalAuth, rateLimit(20, 60_000), (req, res) => {
  const { items = [], name = 'Einkaufsliste', actor = 'Jemand' } = req.body || {}
  const code = newCode()
  db.prepare('INSERT INTO carts (code, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(code, String(name).slice(0, 60), req.user?.id || null, Date.now(), Date.now())
  const ins = db.prepare('INSERT INTO cart_items (id, cart_code, data, updated_at) VALUES (?, ?, ?, ?)')
  for (const raw of items.slice(0, 500)) { const it = cleanItem(raw); ins.run(it.id, code, JSON.stringify(it), Date.now()) }
  logActivity(code, actor, 'hat den Einkaufswagen geteilt')
  res.json(loadCart(code))
})

app.get('/api/carts/:code', (req, res) => {
  const cart = loadCart(String(req.params.code).toUpperCase())
  if (!cart) return res.status(404).json({ error: 'Einkaufswagen nicht gefunden.' })
  res.json(cart)
})

app.post('/api/carts/:code/ops', rateLimit(300, 60_000), wrap(async (req, res) => {
  const code = String(req.params.code).toUpperCase()
  if (!db.prepare('SELECT 1 FROM carts WHERE code = ?').get(code)) return res.status(404).json({ error: 'Einkaufswagen nicht gefunden.' })
  const { ops = [], actor = 'Jemand' } = req.body || {}
  for (const op of ops.slice(0, 200)) applyOp(code, op, actor)
  const cart = loadCart(code)
  broadcast(code, cart)
  res.json(cart)
}))

// ---------- KI ----------
app.get('/api/ai/status', (_req, res) => res.json({ enabled: aiEnabled(), model: aiEnabled() ? (process.env.KALORA_MODEL || 'claude-opus-5-5') : null }))

const requireAI = (_req, res, next) => aiEnabled() ? next() : res.status(503).json({ error: 'KI ist auf diesem Server nicht konfiguriert (ANTHROPIC_API_KEY fehlt).' })

app.post('/api/ai/analyze-photo', optionalAuth, requireAI, rateLimit(15, 60_000), wrap(async (req, res) => {
  const { image, mediaType, hint } = req.body || {}
  if (!image || image.length > 7_000_000) return res.status(400).json({ error: 'Bitte ein Foto (max. ca. 5 MB) senden.' })
  res.json(await analyzePhoto({ imageBase64: image, mediaType, hint: String(hint || '').slice(0, 300) }))
}))

app.post('/api/ai/coach', optionalAuth, requireAI, rateLimit(20, 60_000), wrap(async (req, res) => {
  const { question, history, context } = req.body || {}
  if (!question) return res.status(400).json({ error: 'Bitte stelle eine Frage.' })
  res.json({ answer: await coach({ question, history, context }) })
}))

app.post('/api/ai/generate-recipe', optionalAuth, requireAI, rateLimit(10, 60_000), wrap(async (req, res) => {
  res.json(await generateRecipe(req.body || {}))
}))

app.get('/api/health', (_req, res) => res.json({ ok: true, ai: aiEnabled() }))

// ---------- Frontend (Produktion) ----------
const dist = path.resolve('dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }))
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

// ---------- WebSocket: Echtzeit-Synchronisierung geteilter Einkaufswagen ----------
const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })
const rooms = new Map()

function broadcast(code, cart) {
  const msg = JSON.stringify({ type: 'cart', cart })
  for (const ws of rooms.get(code) || []) if (ws.readyState === 1) ws.send(msg)
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x')
  const code = String(url.searchParams.get('cart') || '').toUpperCase()
  ws.member = String(url.searchParams.get('name') || 'Gast').slice(0, 40)
  if (!db.prepare('SELECT 1 FROM carts WHERE code = ?').get(code)) { ws.close(4004, 'not found'); return }
  if (!rooms.has(code)) rooms.set(code, new Set())
  rooms.get(code).add(ws)
  ws.send(JSON.stringify({ type: 'cart', cart: loadCart(code) }))
  broadcast(code, loadCart(code))
  ws.isAlive = true
  ws.on('pong', () => { ws.isAlive = true })
  ws.on('close', () => {
    rooms.get(code)?.delete(ws)
    if (rooms.get(code)?.size === 0) rooms.delete(code)
    else broadcast(code, loadCart(code))
  })
})
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue }
    ws.isAlive = false
    ws.ping()
  }
}, 30_000).unref()

const PORT = Number(process.env.PORT) || 8787
server.listen(PORT, () => console.log(`KALORA Server läuft auf http://localhost:${PORT} (KI ${aiEnabled() ? 'aktiv' : 'nicht konfiguriert'})`))
