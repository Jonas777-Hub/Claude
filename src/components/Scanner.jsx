import { useEffect, useRef, useState } from 'react'
import { ScanLine, ImagePlus } from 'lucide-react'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
let zxingPromise = null
const zxing = () => (zxingPromise ||= Promise.all([import('@zxing/browser'), import('@zxing/library')]))

async function zxingReader() {
  const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await zxing()
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128])
  hints.set(DecodeHintType.TRY_HARDER, true)
  return new BrowserMultiFormatReader(hints)
}

// Strichcode aus einem Foto lesen (funktioniert auch in Safari auf dem iPhone)
export async function decodeBarcodeFromBlob(blob) {
  try {
    if ('BarcodeDetector' in window) {
      const codes = await new window.BarcodeDetector({ formats: FORMATS }).detect(await createImageBitmap(blob))
      if (codes[0]?.rawValue) return codes[0].rawValue
    }
  } catch { /* weiter mit zxing */ }
  const url = URL.createObjectURL(blob)
  try {
    const reader = await zxingReader()
    const res = await reader.decodeFromImageUrl(url)
    return res?.getText() || null
  } catch { return null } finally { URL.revokeObjectURL(url) }
}

// Live-Barcode-Scanner: BarcodeDetector (Chrome/Android) oder zxing (Safari/iPhone und alle anderen)
export function BarcodeScanner({ onCode }) {
  const video = useRef(null)
  const fileRef = useRef(null)
  const [err, setErr] = useState('')
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const done = useRef(false)
  const found = code => { if (done.current) return; done.current = true; navigator.vibrate?.(60); onCode(code) }

  useEffect(() => {
    let stream, raf, controls, stopped = false
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setErr('Die Kamera ist hier nicht verfügbar. Fotografiere den Strichcode oder gib die Nummer ein.'); return }
      try {
        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({ formats: FORMATS })
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          if (stopped || !video.current) return
          video.current.srcObject = stream
          await video.current.play()
          const loop = async () => {
            if (stopped) return
            try { const c = await detector.detect(video.current); if (c[0]?.rawValue) return found(c[0].rawValue) } catch { /* nächster Frame */ }
            raf = requestAnimationFrame(loop)
          }
          loop()
        } else {
          const reader = await zxingReader()
          if (stopped || !video.current) return
          controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current, res => { if (res) found(res.getText()) })
        }
      } catch { setErr('Kamera nicht verfügbar – erlaube den Kamerazugriff, fotografiere den Strichcode oder gib die Nummer ein.') }
    }
    start()
    return () => { stopped = true; cancelAnimationFrame(raf); controls?.stop(); stream?.getTracks().forEach(t => t.stop()) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fromPhoto = async f => {
    if (!f) return
    setBusy(true)
    const code = await decodeBarcodeFromBlob(f)
    setBusy(false)
    if (code) found(code); else setErr('Auf dem Foto wurde kein Strichcode erkannt. Halte den Strichcode groß, gerade und scharf ins Bild.')
  }

  return (
    <div className="scanner col">
      {!err ? (
        <div style={{ position: 'relative' }}>
          <video ref={video} playsInline muted autoPlay />
          <div className="scan-line" />
          <span className="badge dark" style={{ position: 'absolute', left: 10, bottom: 10 }}>Strichcode in den Rahmen halten</span>
        </div>
      ) : (
        <div className="card tinted small">{err}</div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={e => { fromPhoto(e.target.files[0]); e.target.value = '' }} />
      <button className="btn block" onClick={() => fileRef.current.click()} disabled={busy}><ImagePlus size={18} /> {busy ? 'Lese Strichcode …' : 'Strichcode fotografieren'}</button>
      <form className="row" onSubmit={e => { e.preventDefault(); if (manual.trim()) found(manual.trim()) }}>
        <input className="input" inputMode="numeric" placeholder="oder Nummer eingeben, z. B. 4000417025005" value={manual} onChange={e => setManual(e.target.value.replace(/\D/g, ''))} />
        <button className="btn primary" type="submit" aria-label="Nummer übernehmen"><ScanLine size={18} /></button>
      </form>
    </div>
  )
}

// Produktdaten von Open Food Facts (frei, offene Datenbank)
export async function lookupBarcode(code) {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_de,brands,nutriments,image_small_url,quantity,product_quantity,serving_quantity,serving_size,categories_tags`)
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
    servingGrams: Number(p.serving_quantity) || null,
    servingLabel: p.serving_size || null,
    packageGrams: Number(p.product_quantity) || null,
    categories: p.categories_tags || [],
  }
}
