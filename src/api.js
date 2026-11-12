// Kleine API-Schicht für den KALORA-Server
const TOKEN_KEY = 'kalora:token'

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken = t => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } }

import { STATIC } from './static.js'
import { API_BASE } from './config.js'

export async function api(path, { method = 'GET', body, auth = true, signal } = {}) {
  // Ohne eigenen Server: nur die KI-Endpunkte über den Kalora-KI-Server (API_BASE)
  if (STATIC && !(API_BASE && path.startsWith('/api/ai/'))) throw Object.assign(new Error('In dieser Version nicht verfügbar – dafür wird der Kalora-Server benötigt.'), { static: true })
  const headers = { 'Content-Type': 'application/json' }
  const token = auth && getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw Object.assign(new Error(API_BASE ? 'Der KI-Server antwortet gerade nicht – beim ersten Aufruf kann das bis zu einer Minute dauern. Bitte nochmal versuchen.' : 'Keine Verbindung zum Server.'), { offline: true })
  }
  let data = null
  try { data = await res.json() } catch { /* leer */ }
  if (!res.ok) throw Object.assign(new Error(data?.error || `Fehler ${res.status}`), { status: res.status, data })
  return data
}

export function wsUrl(path) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}${path}`
}

// Bild verkleinern (spart Upload & Speicher): liefert { base64, mediaType, dataUrl }
export function resizeImage(file, max = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      const dataUrl = c.toDataURL('image/jpeg', quality)
      URL.revokeObjectURL(url)
      c.toBlob(blob => resolve({ dataUrl, blob, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' }), 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden.')) }
    img.src = url
  })
}
