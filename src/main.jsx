import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App.jsx'
import AdminDashboard from './admin/AdminDashboard.jsx'

import './index.css'

function Root() {
  const path = window.location.pathname.toLowerCase()

  // Admin Control Panel
  if (path === '/admin' || path.startsWith('/admin/')) {
    return <AdminDashboard />
  }

  // Customer Shopping Website
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)