// Service Worker: App-Shell offline verfügbar machen, Rezeptbilder cachen
const SHELL = 'kalora-shell-v1'
const IMG = 'kalora-img-v1'
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])))
  self.skipWaiting()
})
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return
  if (url.hostname === 'www.themealdb.com') {
    e.respondWith(caches.open(IMG).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r })))
    return
  }
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone()
      caches.open(SHELL).then(c => c.put(e.request.mode === 'navigate' ? '/' : e.request, copy))
      return r
    }).catch(async () => (await caches.match(e.request)) || caches.match('/')))
  }
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => list[0] ? list[0].focus() : self.clients.openWindow('/')))
})
