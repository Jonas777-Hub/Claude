// Kleine API-Schicht für den KALORA-Server
const TOKEN_KEY = 'kalora:token'

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken = t => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } }

export async function api(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = auth && getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw Object.assign(new Error('Keine Verbindung zum Server.'), { offline: true })
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
      resolve({ dataUrl, base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden.')) }
    img.src = url
  })
}
