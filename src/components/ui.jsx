import { useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Clock, Star, ZoomIn, ZoomOut, Flame, Heart } from 'lucide-react'
import { fmt, nutrientStatus } from '../lib/nutrition.js'
import { imageUrl } from '../data/recipes.js'

export function Ring({ value = 0, max = 1, size = 120, stroke = 12, color, children, track }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-track" style={track ? { stroke: track } : undefined} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="ring-bar"
          stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  )
}

export function NutrientRing({ k, label, consumed, target, unit = 'g', size = 74 }) {
  const st = nutrientStatus(k, consumed, target)
  return (
    <div className="mini-ring card flat">
      <Ring value={consumed} max={target} size={size} stroke={8} color={st.color}>
        <span className="val" style={{ fontSize: 14 }}>{Math.round(st.ratio * 100)}%</span>
      </Ring>
      <div className="lbl">{label}</div>
      <div className="small bold">{fmt(consumed)}<span className="muted"> / {fmt(target)} {unit}</span></div>
    </div>
  )
}

export function Sheet({ title, onClose, children, full, actions, back }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={`sheet ${full ? 'full' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          {back ? <button className="icon-btn sm" onClick={back} aria-label="Zurück"><ChevronLeft size={18} /></button> : null}
          <h2>{title}</h2>
          {actions}
          <button className="icon-btn sm" onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Dialog({ children, onClose }) {
  return (
    <div className="overlay" style={{ alignItems: 'center' }} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="dialog" role="dialog" aria-modal="true">{children}</div>
    </div>
  )
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(o => (
        <button key={o.id} role="tab" aria-selected={value === o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, min = 1, max = 99, step = 1, format = v => v }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))} aria-label="Weniger">−</button>
      <span>{format(value)}</span>
      <button onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))} aria-label="Mehr">+</button>
    </div>
  )
}

export function Empty({ emoji = '🍽️', title, text, children }) {
  return (
    <div className="empty">
      <div className="em">{emoji}</div>
      {title && <div className="bold" style={{ color: 'var(--text)' }}>{title}</div>}
      {text && <p className="small mt-s">{text}</p>}
      {children && <div className="mt">{children}</div>}
    </div>
  )
}

export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [toast, onDone])
  if (!toast) return null
  return <div className="toast" role="status">{toast.kind === 'err' ? '⚠️' : '✓'} {toast.text}</div>
}

export function MacroLine({ n, compact }) {
  return (
    <div className="macro-row">
      <span><span className="dot" style={{ background: 'var(--c-protein)' }} /><b>{fmt(n.p)}g</b> P</span>
      <span><span className="dot" style={{ background: 'var(--c-carbs)' }} /><b>{fmt(n.c)}g</b> KH</span>
      <span><span className="dot" style={{ background: 'var(--c-fat)' }} /><b>{fmt(n.f)}g</b> F</span>
      {!compact && <span><span className="dot" style={{ background: 'var(--c-fiber)' }} /><b>{fmt(n.fi)}g</b> Ballastst.</span>}
    </div>
  )
}

export function RecipeImage({ recipe, size = 'medium', alt, style, className }) {
  const [err, setErr] = useState(false)
  const src = recipe.image ? imageUrl(recipe, size) : recipe.photo
  if (!src || err) {
    return (
      <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--green-soft), var(--card-2))', fontSize: 40 }}>
        {recipe.custom ? '✨' : '🍽️'}
      </div>
    )
  }
  return <img src={src} alt={alt || recipe.name} loading="lazy" onError={() => setErr(true)} style={style} className={className} />
}

export function RecipeCard({ recipe, onClick, match, rating, saved }) {
  const n = recipe.nutrition
  return (
    <button className="recipe-card" onClick={onClick}>
      <div className="img">
        <RecipeImage recipe={recipe} />
        <div className="tl">
          {match != null && <span className="badge" style={{ background: 'rgba(34,197,94,.92)', color: '#fff' }}>{Math.round(match * 100)}% Match</span>}
          {recipe.custom && <span className="badge dark">✨ KI-Rezept</span>}
        </div>
        {saved && <div className="tr"><span className="badge dark"><Heart size={12} fill="#fff" /></span></div>}
        <div className="bl"><span className="badge dark"><Flame size={12} /> {fmt(n.kcal)} kcal</span></div>
      </div>
      <div className="body">
        <div className="name">{recipe.name}</div>
        <MacroLine n={n} />
        <div className="row small muted" style={{ gap: 12, marginTop: 'auto' }}>
          <span className="row" style={{ gap: 4 }}><Clock size={13} /> {recipe.time} Min.</span>
          {rating ? <span className="row" style={{ gap: 4, color: 'var(--orange)', fontWeight: 700 }}><Star size={13} fill="currentColor" /> {rating}/10</span> : <span className="row" style={{ gap: 4 }}><Star size={13} /> –</span>}
        </div>
      </div>
    </button>
  )
}

// Bildergalerie mit Wischen, Vollbild und Zoom
export function Gallery({ images, overlay }) {
  const [idx, setIdx] = useState(0)
  const [full, setFull] = useState(null)
  const track = useRef(null)
  const onScroll = () => {
    const el = track.current
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth))
  }
  const go = i => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: 'smooth' })
  if (!images.length) return null
  return (
    <>
      <div className="gallery">
        <div className="gallery-track" ref={track} onScroll={onScroll}>
          {images.map((im, i) => (
            <button key={i} onClick={() => setFull(i)} aria-label="Bild im Vollbild öffnen">
              <img src={im.src} alt={im.caption || ''} loading={i ? 'lazy' : 'eager'} />
              {im.caption && <span className="badge dark" style={{ position: 'absolute', left: 10, top: 10 }}>{im.caption}</span>}
            </button>
          ))}
        </div>
        {overlay}
        {images.length > 1 && (
          <>
            <div className="gallery-dots">{images.map((_, i) => <span key={i} className={i === idx ? 'on' : ''} />)}</div>
            {idx > 0 && <button className="icon-btn sm" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,.4)', color: '#fff', border: 0 }} onClick={() => go(idx - 1)} aria-label="Vorheriges Bild"><ChevronLeft size={18} /></button>}
            {idx < images.length - 1 && <button className="icon-btn sm" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,.4)', color: '#fff', border: 0 }} onClick={() => go(idx + 1)} aria-label="Nächstes Bild"><ChevronRight size={18} /></button>}
          </>
        )}
      </div>
      {full != null && <Lightbox images={images} start={full} onClose={() => setFull(null)} />}
    </>
  )
}

function Lightbox({ images, start, onClose }) {
  const [i, setI] = useState(start)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef(null)
  const pinch = useRef(null)
  const set = n => { setI((n + images.length) % images.length); setZoom(1); setPos({ x: 0, y: 0 }) }
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') set(i + 1); if (e.key === 'ArrowLeft') set(i - 1) }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  })
  const onTouchStart = e => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches
      pinch.current = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom }
    } else drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pos.x, py: pos.y, t: Date.now() }
  }
  const onTouchMove = e => {
    if (e.touches.length === 2 && pinch.current) {
      const [a, b] = e.touches
      setZoom(Math.min(5, Math.max(1, pinch.current.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.current.d)))
    } else if (drag.current && zoom > 1) {
      setPos({ x: drag.current.px + e.touches[0].clientX - drag.current.x, y: drag.current.py + e.touches[0].clientY - drag.current.y })
    }
  }
  const onTouchEnd = e => {
    if (drag.current && zoom === 1 && e.changedTouches[0]) {
      const dx = e.changedTouches[0].clientX - drag.current.x
      if (Math.abs(dx) > 50) set(i + (dx < 0 ? 1 : -1))
    }
    drag.current = null; pinch.current = null
  }
  return (
    <div className="lightbox">
      <div className="row between" style={{ padding: 'calc(10px + env(safe-area-inset-top)) 12px 10px', color: '#fff' }}>
        <span className="small">{i + 1} / {images.length}{images[i].caption ? ` · ${images[i].caption}` : ''}</span>
        <div className="row">
          <button className="icon-btn" style={{ background: '#222', color: '#fff', border: 0 }} onClick={() => setZoom(z => Math.max(1, z - 0.5))} aria-label="Verkleinern"><ZoomOut size={18} /></button>
          <button className="icon-btn" style={{ background: '#222', color: '#fff', border: 0 }} onClick={() => setZoom(z => Math.min(5, z + 0.5))} aria-label="Vergrößern"><ZoomIn size={18} /></button>
          <button className="icon-btn" style={{ background: '#222', color: '#fff', border: 0 }} onClick={onClose} aria-label="Schließen"><X size={18} /></button>
        </div>
      </div>
      <div className="stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onWheel={e => setZoom(z => Math.min(5, Math.max(1, z - e.deltaY * 0.002)))}
        onDoubleClick={() => { setZoom(z => z > 1 ? 1 : 2.5); setPos({ x: 0, y: 0 }) }}>
        <img src={images[i].full || images[i].src} alt="" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }} />
      </div>
      {images.length > 1 && (
        <div className="row between" style={{ padding: '10px 12px calc(14px + env(safe-area-inset-bottom))' }}>
          <button className="btn" onClick={() => set(i - 1)}><ChevronLeft size={18} /> Zurück</button>
          <button className="btn" onClick={() => set(i + 1)}>Weiter <ChevronRight size={18} /></button>
        </div>
      )}
    </div>
  )
}

export function NutritionTable({ per, total, persons }) {
  const rows = [['Kalorien', 'kcal', 'kcal'], ['Protein', 'p', 'g'], ['Kohlenhydrate', 'c', 'g'], ['Fett', 'f', 'g'], ['Zucker', 's', 'g'], ['Ballaststoffe', 'fi', 'g']]
  return (
    <table className="table">
      <thead><tr><th>Nährwert</th><th>Pro Portion</th>{persons > 1 && <th>Gesamt ({persons} P.)</th>}</tr></thead>
      <tbody>
        {rows.map(([l, k, u]) => (
          <tr key={k}><td>{l}</td><td className="bold">{fmt(per[k], k === 'kcal' ? 0 : 1)} {u}</td>{persons > 1 && <td>{fmt(total[k], k === 'kcal' ? 0 : 1)} {u}</td>}</tr>
        ))}
      </tbody>
    </table>
  )
}
