import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Register PWA Service Worker with auto-refresh on new version
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Force apply the new service worker and reload the app
    updateSW()
  },
  onRegistered() {
    // No-op, but ensures registration happens early
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

