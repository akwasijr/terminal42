import ReactDOM from 'react-dom/client'
import { App } from './App'
import { Splash } from './components/Splash'
import { ErrorBoundary } from './components/ErrorBoundary'
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

function Boot(): JSX.Element {
  return (
    <ErrorBoundary>
      <App />
      <Splash />
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Boot />)
