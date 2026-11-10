// Globaler App-Zustand: lokal gespeichert (offline-fähig) und bei Anmeldung in die Cloud synchronisiert
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, getToken, setToken, wsUrl } from './api.js'
import { calcTargets, todayKey } from './lib/nutrition.js'
import { mergeItems, newId } from './lib/shopping.js'

const KEY = 'kalora:v1'
const QUEUE_KEY = 'kalora:cartQueue'

export const DEFAULT_STATE = {
  version: 1,
  profile: null,
  log: {},
  weights: [],
  water: {},
  ratings: {},
  saved: [],
  cooked: {},
  customRecipes: [],
  userPhotos: {},
  dislikes: [],
  pantry: [],
  favorites: [],
  cart: { items: [], shared: null, activity: [], name: 'Einkaufsliste' },
  coachHistory: [],
  settings: {
    theme: 'system',
    displayName: '',
    notifications: { meals: false, mealTimes: ['08:00', '12:30', '19:00'], weight: false, weightTime: '07:30', water: false, waterEvery: 120 },
  },
  updatedAt: 0,
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw)
      return { ...DEFAULT_STATE, ...s, settings: { ...DEFAULT_STATE.settings, ...s.settings, notifications: { ...DEFAULT_STATE.settings.notifications, ...s.settings?.notifications } }, cart: { ...DEFAULT_STATE.cart, ...s.cart } }
    }
  } catch { /* privater Modus o. Ä. */ }
  return DEFAULT_STATE
}

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

export function StoreProvider({ children }) {
  const [state, setState] = useState(load)
  const [user, setUser] = useState(null)
  const [sync, setSync] = useState({ status: 'local', at: null })
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [toast, setToast] = useState(null)
  const skipPush = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const notify = useCallback((text, kind = 'ok') => {
    setToast({ text, kind, id: Date.now() })
  }, [])

  // ---------- Persistenz ----------
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* Speicher voll */ }
  }, [state])

  const update = useCallback(fn => {
    setState(s => ({ ...fn(s), updatedAt: Date.now() }))
  }, [])

  // ---------- Online/Offline ----------
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // ---------- Konto & Cloud-Sync ----------
  const pull = useCallback(async () => {
    const remote = await api('/api/state')
    const local = stateRef.current
    if (remote.data && remote.updatedAt > (local.updatedAt || 0)) {
      skipPush.current = true
      setState({ ...DEFAULT_STATE, ...remote.data, cart: local.cart.shared ? local.cart : (remote.data.cart || local.cart), updatedAt: remote.updatedAt })
    } else if (local.updatedAt) {
      await api('/api/state', { method: 'PUT', body: { data: local, updatedAt: local.updatedAt } })
    }
    setSync({ status: 'synced', at: Date.now() })
  }, [])

  useEffect(() => {
    if (!getToken()) return
    api('/api/me').then(r => { setUser(r.user); return pull() }).catch(e => {
      if (e.status === 401) setToken(null)
      setSync({ status: e.offline ? 'offline' : 'local', at: null })
    })
  }, [pull])

  useEffect(() => {
    if (!user) return
    if (skipPush.current) { skipPush.current = false; return }
    if (!state.updatedAt) return
    setSync(s => ({ ...s, status: 'pending' }))
    const t = setTimeout(async () => {
      try {
        await api('/api/state', { method: 'PUT', body: { data: stateRef.current, updatedAt: stateRef.current.updatedAt } })
        setSync({ status: 'synced', at: Date.now() })
      } catch (e) {
        if (e.status === 409) pull().catch(() => {})
        else setSync({ status: e.offline ? 'offline' : 'error', at: null })
      }
    }, 1200)
    return () => clearTimeout(t)
  }, [state, user, pull, online])

  const login = useCallback(async (email, password, register = false, name) => {
    const r = await api(register ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body: { email, password, name }, auth: false })
    setToken(r.token)
    setUser(r.user)
    if (!stateRef.current.settings.displayName) update(s => ({ ...s, settings: { ...s.settings, displayName: r.user.name } }))
    await pull()
    return r.user
  }, [pull, update])

  const logout = useCallback(() => { setToken(null); setUser(null); setSync({ status: 'local', at: null }) }, [])

  // ---------- Tagebuch ----------
  const addEntries = useCallback((entries, date = todayKey()) => {
    update(s => ({ ...s, log: { ...s.log, [date]: [...(s.log[date] || []), ...entries.map(e => ({ id: newId(), time: Date.now(), ...e }))] } }))
  }, [update])

  const removeEntry = useCallback((id, date = todayKey()) => {
    update(s => ({ ...s, log: { ...s.log, [date]: (s.log[date] || []).filter(e => e.id !== id) } }))
  }, [update])

  const updateEntry = useCallback((id, patch, date = todayKey()) => {
    update(s => ({ ...s, log: { ...s.log, [date]: (s.log[date] || []).map(e => e.id === id ? { ...e, ...patch } : e) } }))
  }, [update])

  const addWeight = useCallback((kg, date = todayKey()) => {
    update(s => {
      const weights = [...s.weights.filter(w => w.date !== date), { date, kg: Number(kg) }].sort((a, b) => a.date.localeCompare(b.date))
      return { ...s, weights, profile: s.profile ? { ...s.profile, weight: Number(kg) } : s.profile }
    })
  }, [update])

  const addWater = useCallback((ml, date = todayKey()) => {
    update(s => ({ ...s, water: { ...s.water, [date]: Math.max(0, (s.water[date] || 0) + ml) } }))
  }, [update])

  // ---------- Einkaufswagen (lokal oder geteilt in Echtzeit) ----------
  const actor = state.settings.displayName || user?.name || 'Ich'
  const wsRef = useRef(null)
  const sharedCode = state.cart.shared?.code

  const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] } }
  const writeQueue = q => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)) } catch { /* ignore */ } }

  const applyRemoteCart = useCallback(cart => {
    skipPush.current = false
    setState(s => s.cart.shared?.code === cart.code
      ? { ...s, cart: { ...s.cart, items: cart.items, activity: cart.activity, name: cart.name, online: cart.online } }
      : s)
  }, [])

  const flushQueue = useCallback(async () => {
    const code = stateRef.current.cart.shared?.code
    const q = readQueue().filter(x => x.code === code)
    if (!code || !q.length) return
    try {
      const cart = await api(`/api/carts/${code}/ops`, { method: 'POST', body: { ops: q.map(x => x.op), actor }, auth: false })
      writeQueue(readQueue().filter(x => x.code !== code))
      applyRemoteCart(cart)
    } catch { /* bleibt in der Warteschlange */ }
  }, [actor, applyRemoteCart])

  useEffect(() => {
    if (!sharedCode || !online) return
    let closed = false, retry
    const connect = () => {
      const ws = new WebSocket(wsUrl(`/ws?cart=${sharedCode}&name=${encodeURIComponent(actor)}`))
      wsRef.current = ws
      ws.onopen = () => flushQueue()
      ws.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m.type === 'cart') applyRemoteCart(m.cart) } catch { /* ignore */ } }
      ws.onclose = ev => { if (!closed && ev.code !== 4004) retry = setTimeout(connect, 3000) }
    }
    connect()
    return () => { closed = true; clearTimeout(retry); wsRef.current?.close() }
  }, [sharedCode, online, actor, flushQueue, applyRemoteCart])

  // Lokale Operation sofort anwenden (optimistisch) und – falls geteilt – an den Server senden
  const cartOp = useCallback(op => {
    update(s => {
      let items = s.cart.items
      if (op.type === 'add') items = mergeItems(items, (op.items || [op.item]).map(i => ({ ...i, addedBy: actor })))
      if (op.type === 'update') items = items.map(i => i.id === op.id ? { ...i, ...op.patch, updatedAt: Date.now() } : i)
      if (op.type === 'remove') items = items.filter(i => i.id !== op.id)
      if (op.type === 'clearChecked') items = items.filter(i => !i.checked)
      if (op.type === 'clearAll') items = []
      let favorites = s.favorites
      if (op.type === 'update' && op.patch?.checked) {
        const it = s.cart.items.find(i => i.id === op.id)
        if (it) {
          const ex = favorites.find(f => f.name.toLowerCase() === it.name.toLowerCase())
          favorites = ex ? favorites.map(f => f === ex ? { ...f, count: (f.count || 1) + 1 } : f)
            : [...favorites, { name: it.name, key: it.key, cat: it.cat, unit: it.unit, amount: it.unit === 'g' ? Math.min(it.amount, 500) : 1, count: 1, pinned: false }]
        }
      }
      const activity = s.cart.shared ? s.cart.activity : [{ ts: Date.now(), actor, text: describeOp(op, s.cart.items) }, ...(s.cart.activity || [])].slice(0, 100)
      return { ...s, favorites, cart: { ...s.cart, items, activity } }
    })
    const code = stateRef.current.cart.shared?.code
    if (code && op.type !== 'clearAll') {
      const q = [...readQueue(), { code, op }]
      writeQueue(q)
      if (navigator.onLine) flushQueue()
    }
  }, [update, actor, flushQueue])

  const shareCart = useCallback(async () => {
    const s = stateRef.current
    if (s.cart.shared) return s.cart.shared.code
    const cart = await api('/api/carts', { method: 'POST', body: { items: s.cart.items, name: s.cart.name, actor } })
    update(st => ({ ...st, cart: { ...st.cart, shared: { code: cart.code, joinedAt: Date.now() }, items: cart.items, activity: cart.activity } }))
    return cart.code
  }, [actor, update])

  const joinCart = useCallback(async code => {
    const cart = await api(`/api/carts/${code.toUpperCase()}`, { auth: false })
    update(s => ({ ...s, cart: { ...s.cart, shared: { code: cart.code, joinedAt: Date.now() }, items: cart.items, activity: cart.activity, name: cart.name } }))
    return cart
  }, [update])

  const leaveCart = useCallback(() => {
    update(s => ({ ...s, cart: { ...s.cart, shared: null } }))
  }, [update])

  const targets = useMemo(() => calcTargets(state.profile), [state.profile])

  const value = {
    state, update, user, sync, online, login, logout, targets, toast, notify, setToast,
    addEntries, removeEntry, updateEntry, addWeight, addWater,
    cartOp, shareCart, joinCart, leaveCart, actor,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function describeOp(op, items) {
  const name = id => items.find(i => i.id === id)?.name || 'Artikel'
  if (op.type === 'add') { const list = op.items || [op.item]; return list.length > 1 ? `hat ${list.length} Zutaten hinzugefügt` : `hat ${list[0].name} hinzugefügt` }
  if (op.type === 'update' && 'checked' in (op.patch || {})) return op.patch.checked ? `hat ${name(op.id)} gekauft` : `hat ${name(op.id)} wieder geöffnet`
  if (op.type === 'update' && 'assignee' in (op.patch || {})) return op.patch.assignee ? `hat ${name(op.id)} ${op.patch.assignee} zugewiesen` : `hat Zuweisung von ${name(op.id)} entfernt`
  if (op.type === 'update') return `hat ${name(op.id)} geändert`
  if (op.type === 'remove') return `hat ${name(op.id)} entfernt`
  if (op.type === 'clearChecked') return 'hat gekaufte Artikel entfernt'
  return 'hat die Liste geleert'
}
