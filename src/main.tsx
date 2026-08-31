import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/shantell-sans'
import App from './App'
import FableAlive from './FableAlive'
import './styles.css'

const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
const isFableAlive = normalizedPath === '/fable-alive'
if (isFableAlive) {
  document.documentElement.classList.add('fable-alive-document')
  document.body.classList.add('fable-alive-page')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isFableAlive ? <FableAlive /> : <App />}
  </StrictMode>,
)
