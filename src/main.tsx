import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Stop Chrome from auto-showing its install banner/mini-infobar on load. The app stays
// installable from the browser's own menu ("Install app" / omnibox icon) — we just don't nag.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
