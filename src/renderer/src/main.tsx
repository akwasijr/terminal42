import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initModelCatalog } from './components/ModelDropdown'
import './styles/globals.css'

const stored = localStorage.getItem('t42-theme')
const initial = stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
if (initial === 'dark') document.documentElement.classList.add('dark')

window.addEventListener('error', (e) => {
  console.error('[Terminal42] window error:', e.error || e.message, e)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Terminal42] unhandled promise rejection:', e.reason)
})

// Dismiss the boot splash imperatively, decoupled from the React tree. Doing
// this inside a component is unsafe: if <App /> throws during render, the
// ErrorBoundary unmounts the whole subtree (splash included) before the
// removal effect can run, leaving the opaque boot splash on top of the error
// UI forever — the classic "stuck at the loader screen" hang. A plain timer
// runs regardless of whether App mounts, and index.html carries a longer
// safety-net timeout for the case where this module never evaluates at all.
function dismissBootSplash(minDurationMs = 2600): void {
  const node = document.getElementById('t42-boot-splash')
  if (!node) return
  window.setTimeout(() => {
    node.classList.add('t42-fade')
    window.setTimeout(() => node.parentNode?.removeChild(node), 360)
  }, minDurationMs)
}

function Boot(): JSX.Element {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Boot />)
dismissBootSplash()
initModelCatalog()
