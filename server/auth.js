// Sichere Benutzerkonten: scrypt-Passwort-Hashes + HMAC-signierte Tokens (ohne externe Abhängigkeiten)
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { db } from './db.js'

function loadSecret() {
  if (process.env.KALORA_SECRET) return process.env.KALORA_SECRET
  const file = path.resolve(process.env.KALORA_DATA_DIR || 'data', 'secret.key')
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  const s = crypto.randomBytes(48).toString('hex')
  fs.writeFileSync(file, s, { mode: 0o600 })
  return s
}
const SECRET = loadSecret()
const TOKEN_TTL = 1000 * 60 * 60 * 24 * 30 // 30 Tage

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(pw, stored) {
  const [, saltB64, hashB64] = stored.split('$')
  const expected = Buffer.from(hashB64, 'base64')
  const actual = crypto.scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 })
  return crypto.timingSafeEqual(expected, actual)
}

const b64u = buf => Buffer.from(buf).toString('base64url')

export function signToken(userId) {
  const payload = b64u(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL }))
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (data.exp < Date.now()) return null
    return data.uid
  } catch { return null }
}

export function optionalAuth(req, _res, next) {
  const h = req.headers.authorization || ''
  const uid = verifyToken(h.startsWith('Bearer ') ? h.slice(7) : null)
  if (uid) req.user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(uid) || null
  next()
}

export function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) return res.status(401).json({ error: 'Bitte melde dich an.' })
    next()
  })
}
