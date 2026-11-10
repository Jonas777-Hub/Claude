import { useEffect, useRef, useState } from 'react'
import { ScanLine } from 'lucide-react'

// Barcode-Scanner: nutzt die BarcodeDetector-API (Chrome/Android, Edge) – sonst manuelle Eingabe der EAN
export function BarcodeScanner({ onCode }) {
  const video = useRef(null)
  const [supported] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window)
  const [err, setErr] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    if (!supported) return
    let stream, raf, stopped = false
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] })
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
      stream = s
      if (!video.current) return
      video.current.srcObject = s
      video.current.play()
      const loop = async () => {
        if (stopped) return
        try {
          const codes = await detector.detect(video.current)
          if (codes[0]?.rawValue) { stopped = true; onCode(codes[0].rawValue); return }
        } catch { /* nächster Frame */ }
        raf = requestAnimationFrame(loop)
      }
      loop()
    }).catch(() => setErr('Kamera nicht verfügbar – bitte Zugriff erlauben oder EAN manuell eingeben.'))
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()) }
  }, [supported, onCode])

  return (
    <div className="scanner col">
      {supported && !err ? (
        <div style={{ position: 'relative' }}>
          <video ref={video} playsInline muted />
          <div className="scan-line" />
        </div>
      ) : (
        <div className="card tinted small">{err || 'Dein Browser unterstützt keinen Live-Barcode-Scan (z. B. Safari auf iPhone). Gib die Nummer unter dem Strichcode ein:'}</div>
      )}
      <form className="row" onSubmit={e => { e.preventDefault(); if (manual.trim()) onCode(manual.trim()) }}>
        <input className="input" inputMode="numeric" placeholder="EAN, z. B. 4000417025005" value={manual} onChange={e => setManual(e.target.value.replace(/\D/g, ''))} />
        <button className="btn primary" type="submit"><ScanLine size={18} /></button>
      </form>
    </div>
  )
}

// Produktdaten von Open Food Facts (frei, offene Datenbank)
export async function lookupBarcode(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_de,brands,nutriments,image_small_url,quantity,categories_tags`)
  const d = await r.json()
  if (d.status !== 1 || !d.product) return null
  return offToFood(d.product, code)
}

export async function searchOFF(q, signal) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12&lc=de&cc=de&fields=code,product_name,product_name_de,brands,nutriments,image_small_url,quantity`
  const d = await (await fetch(url, { signal })).json()
  return (d.products || []).map(p => offToFood(p, p.code)).filter(f => f.name && f.kcal != null)
}

function offToFood(p, code) {
  const n = p.nutriments || {}
  const v = k => (n[`${k}_100g`] != null ? Number(n[`${k}_100g`]) : null)
  return {
    key: null,
    off: code,
    name: [p.product_name_de || p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(' – '),
    kcal: v('energy-kcal') ?? (v('energy') != null ? v('energy') / 4.184 : null),
    p: v('proteins') || 0, c: v('carbohydrates') || 0, f: v('fat') || 0, s: v('sugars') || 0, fi: v('fiber') || 0,
    image: p.image_small_url || null,
    quantity: p.quantity || '',
    categories: p.categories_tags || [],
  }
}
