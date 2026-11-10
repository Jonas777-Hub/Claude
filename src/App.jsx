import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Home, BookOpen, ChefHat, ShoppingCart, TrendingUp, User, Camera, MessageCircle, CalendarDays, Dumbbell } from 'lucide-react'
import { useStore } from './store.jsx'
import { LOGO } from './logo.js'
import { Toast } from './components/ui.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Diary from './pages/Diary.jsx'
import Recipes from './pages/Recipes.jsx'
import WeekPlan from './pages/WeekPlan.jsx'
import Cart from './pages/Cart.jsx'
import Progress from './pages/Progress.jsx'
import Coach from './pages/Coach.jsx'
import Sport from './pages/Sport.jsx'
import Profile from './pages/Profile.jsx'
import RecipeDetail from './pages/RecipeDetail.jsx'
import PhotoAnalysis from './pages/PhotoAnalysis.jsx'
import FoodSearch from './pages/FoodSearch.jsx'
import RecipeGenerator from './pages/RecipeGenerator.jsx'
import { useReminders } from './lib/reminders.js'

const UICtx = createContext(null)
export const useUI = () => useContext(UICtx)

const TABS = [
  { id: 'start', label: 'Start', icon: Home },
  { id: 'tagebuch', label: 'Tagebuch', icon: BookOpen },
  { id: 'rezepte', label: 'Rezepte', icon: ChefHat },
  { id: 'wochenplan', label: 'Wochenplan', icon: CalendarDays, desktopOnly: true },
  { id: 'einkauf', label: 'Einkauf', icon: ShoppingCart },
  { id: 'sport', label: 'Sporti', icon: Dumbbell, desktopOnly: true },
  { id: 'verlauf', label: 'Verlauf', icon: TrendingUp },
  { id: 'coach', label: 'KI-Coach', icon: MessageCircle, desktopOnly: true },
  { id: 'profil', label: 'Profil', icon: User, desktopOnly: true },
]

export default function App() {
  const { state, toast, setToast, joinCart, notify } = useStore()
  const [tab, setTab] = useState(() => (location.pathname.startsWith('/cart/') ? 'einkauf' : 'start'))
  const [sheets, setSheets] = useState([])

  // Theme
  useEffect(() => {
    const t = state.settings.theme
    const root = document.documentElement
    // Nur ein selbst gesetztes Theme wieder entfernen (der Host kann data-theme ebenfalls setzen)
    if (t === 'system') { if (root.dataset.kaloraTheme) { root.removeAttribute('data-theme'); delete root.dataset.kaloraTheme } }
    else { root.setAttribute('data-theme', t); root.dataset.kaloraTheme = '1' }
  }, [state.settings.theme])

  // Geteilten Einkaufswagen über Link öffnen: /cart/ABCD1234
  useEffect(() => {
    const m = location.pathname.match(/^\/cart\/([A-Za-z0-9]{4,16})/)
    if (!m) return
    joinCart(m[1]).then(() => { notify('Geteilter Einkaufswagen geöffnet'); setTab('einkauf') })
      .catch(e => notify(e.message, 'err'))
      .finally(() => history.replaceState(null, '', '/'))
  }, [joinCart, notify])

  useReminders()

  const open = useCallback((type, props = {}) => setSheets(s => [...s, { type, props, key: Date.now() + Math.random() }]), [])
  const close = useCallback(() => setSheets(s => s.slice(0, -1)), [])
  const closeAll = useCallback(() => setSheets([]), [])
  const go = useCallback(t => { setTab(t); setSheets([]); window.scrollTo({ top: 0 }) }, [])

  const ui = { open, close, closeAll, go, tab }

  if (!state.profile) {
    return (
      <UICtx.Provider value={ui}>
        <Onboarding />
        <Toast toast={toast} onDone={() => setToast(null)} />
      </UICtx.Provider>
    )
  }

  const cartCount = state.cart.items.filter(i => !i.checked).length
  const Page = { start: Dashboard, tagebuch: Diary, rezepte: Recipes, wochenplan: WeekPlan, einkauf: Cart, verlauf: Progress, sport: Sport, coach: Coach, profil: Profile }[tab] || Dashboard

  return (
    <UICtx.Provider value={ui}>
      <div className="app">
        <nav className="sidebar" aria-label="Hauptmenü">
          <div className="logo" style={{ padding: '4px 10px 22px' }}><img src={LOGO} alt="" /> KALORA</div>
          {TABS.map(t => (
            <button key={t.id} className={`side-link ${tab === t.id ? 'active' : ''}`} onClick={() => go(t.id)}>
              <t.icon size={20} /> {t.label}
              {t.id === 'einkauf' && cartCount > 0 && <span className="badge" style={{ marginLeft: 'auto' }}>{cartCount}</span>}
            </button>
          ))}
          <div className="spacer" />
          <button className="btn primary block" onClick={() => open('photo')}><Camera size={18} /> Essen fotografieren</button>
          <p className="tagline center mt">Track. Analyse. Erfolg.</p>
        </nav>
        <main className="main">
          <Page />
        </main>
      </div>

      <nav className="tabbar" aria-label="Navigation">
        {[TABS[0], TABS[1]].map(t => <TabBtn key={t.id} t={t} active={tab === t.id} onClick={() => go(t.id)} />)}
        <button className="tab" onClick={() => open('photo')} aria-label="Essen fotografieren"><span className="tab-fab"><Camera size={26} /></span></button>
        <TabBtn t={TABS[2]} active={tab === 'rezepte' || tab === 'wochenplan'} onClick={() => go('rezepte')} />
        <TabBtn t={TABS.find(t => t.id === 'einkauf')} active={tab === 'einkauf'} onClick={() => go('einkauf')} count={cartCount} />
      </nav>

      {sheets.map((s, i) => {
        const C = { recipe: RecipeDetail, photo: PhotoAnalysis, search: FoodSearch, generator: RecipeGenerator }[s.type]
        return C ? <C key={s.key} {...s.props} onClose={close} depth={i} /> : null
      })}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </UICtx.Provider>
  )
}

function TabBtn({ t, active, onClick, count }) {
  return (
    <button className={`tab ${active ? 'active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <t.icon size={23} strokeWidth={active ? 2.4 : 2} />
      {t.label}
      {count > 0 && <span className="cnt">{count}</span>}
    </button>
  )
}
