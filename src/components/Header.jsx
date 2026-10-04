import { useState } from 'react'

function Icon({ children }) {
  return <span className="header-icon">{children}</span>
}

export default function Header({
  searchValue = '',
  onSearchChange = () => {},
  cartCount = 0,
  onCart = () => {},
  onAccount = () => {},
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const go = (id) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand-button" type="button" onClick={() => go('home')}>
          <span className="brand-mark">G</span>
          <span><strong>GRIHINI APNA BAZAAR</strong><small>EVERYDAY SHOPPING, SIMPLIFIED</small></span>
        </button>

        <nav className="desktop-nav">
          <button type="button" onClick={() => go('home')}>Home</button>
          <button type="button" onClick={() => go('products')}>Products</button>
          <button type="button" onClick={() => go('categories')}>Categories</button>
          <button type="button" onClick={() => go('offers')}>Offers</button>
          <button type="button" onClick={() => go('contact')}>Contact</button>
        </nav>

        <div className="header-actions">
          <div className="header-search">
            <Icon>⌕</Icon>
            <input value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search groceries..." />
            {searchValue && <button type="button" onClick={() => onSearchChange('')}>×</button>}
          </div>
          <button className="header-cart" type="button" onClick={onCart}><Icon>🛒</Icon><b>{cartCount}</b></button>
          <button className="header-account" type="button" onClick={onAccount}>Sign In</button>
          <button className="mobile-menu" type="button" onClick={() => setMenuOpen((v) => !v)}>☰</button>
        </div>
      </div>

      <div className="mobile-search">
        <span>⌕</span><input value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search groceries, brands..." />
      </div>

      {menuOpen && (
        <div className="mobile-menu-panel">
          <button type="button" onClick={() => go('home')}>Home</button>
          <button type="button" onClick={() => go('categories')}>Categories</button>
          <button type="button" onClick={() => go('products')}>Products</button>
          <button type="button" onClick={() => go('offers')}>Offers</button>
          <button type="button" onClick={() => go('account')}>My Account</button>
          <button type="button" onClick={onCart}>Cart ({cartCount})</button>
        </div>
      )}
    </header>
  )
}
