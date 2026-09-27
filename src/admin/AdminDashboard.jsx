import { useState } from 'react'
import AdminProducts from './AdminProducts'
import './admin.css'

export default function AdminDashboard() {
  const [activePage, setActivePage] = useState('products')

  const pageTitles = {
    products: 'Products',
    analytics: 'Analytics',
    orders: 'Orders',
    customers: 'Customers',
    categories: 'Categories',
    media: 'Product Media',
    history: 'Change History',
    settings: 'Settings',
  }

  const menuItems = [
    { id: 'products', icon: '📦', label: 'Products' },
    { id: 'analytics', icon: '📊', label: 'Analytics' },
    { id: 'orders', icon: '🛒', label: 'Orders' },
    { id: 'customers', icon: '👥', label: 'Customers' },
    { id: 'categories', icon: '🗂️', label: 'Categories' },
    { id: 'media', icon: '🖼️', label: 'Product Media' },
    { id: 'history', icon: '↶', label: 'Change History' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ]

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-icon">G</div>

          <div>
            <strong>Grihini Apna Bazaar</strong>
            <span>Admin Control Panel</span>
          </div>
        </div>

        <nav className="admin-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activePage === item.id ? 'active' : ''}
              onClick={() => setActivePage(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <span>Admin Panel</span>
          <small>Grihini Apna Bazaar</small>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-page-label">CONTROL PANEL</span>
            <h1>{pageTitles[activePage]}</h1>
          </div>

          <div className="admin-top-actions">
            <button type="button" className="admin-undo-button">
              ↶ Undo
            </button>

            <button type="button" className="admin-redo-button">
              Redo ↷
            </button>

            <div className="admin-user">
              <div className="admin-user-avatar">A</div>

              <div>
                <strong>Admin</strong>
                <span>Control Panel</span>
              </div>
            </div>
          </div>
        </header>

        <section className="admin-content">
          {activePage === 'products' && <AdminProducts />}

          {activePage === 'analytics' && (
            <div className="admin-coming-soon">
              <div className="admin-coming-icon">📊</div>
              <h2>Analytics</h2>
              <p>
                Sales, orders, revenue, stock and product analytics will appear
                here.
              </p>
            </div>
          )}

          {activePage !== 'products' && activePage !== 'analytics' && (
            <div className="admin-coming-soon">
              <div className="admin-coming-icon">🚧</div>
              <h2>{pageTitles[activePage]}</h2>
              <p>
                This section will be connected after the Product Management
                module.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}