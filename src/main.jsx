import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AppGuard } from './components/system/PageGuard.jsx'
import { startUpdates } from './appUpdate.js'
import './styles/tokens.css'
import './index.css'
import './styles/kit.css'

// The service worker, and new versions put in only at a quiet moment
// (src/appUpdate.js) — registered here, not by vite-plugin-pwa's script.
startUpdates()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppGuard>
      <App />
    </AppGuard>
  </React.StrictMode>
)
