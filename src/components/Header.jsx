import { useState } from "react";
import RubberSegment from "./RubberSegment";

function MenuIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.8-4 4.5-6 8-6s6.2 2 8 6" />
    </svg>
  );
}

export default function Header({
  searchValue = "",
  onSearchChange = () => {},
}) {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const goTo = (id) => {
    setMenuOpen(false);

    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  return (
    <header className="site-header">
      {/* DESKTOP */}
      <div className="desktop-header">
        <button
          type="button"
          className="desktop-logo"
          onClick={() => goTo("home")}
        >
          <div className="logo-symbol">
            G
          </div>

          <div className="logo-text">
            <strong>
              GRIHINI APNA BAZAAR
            </strong>

            <span>
              EVERYDAY SHOPPING, SIMPLIFIED
            </span>
          </div>
        </button>

        <div className="desktop-nav">
          <RubberSegment />
        </div>

        <div className="desktop-actions">
          <div className="desktop-search">
            <SearchIcon />

            <input
              value={searchValue}
              onChange={(e) =>
                onSearchChange(
                  e.target.value
                )
              }
              placeholder="Search groceries..."
            />
          </div>

          <button
            type="button"
            className="header-cart-button"
          >
            <CartIcon />

            <span className="cart-count">
              0
            </span>
          </button>

          <button
            type="button"
            className="signup-button"
          >
            <UserIcon />
            Sign Up
          </button>
        </div>
      </div>

      {/* MOBILE */}
      <div className="mobile-header">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() =>
            setMenuOpen(!menuOpen)
          }
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>

        <button
          type="button"
          className="mobile-logo"
          onClick={() => goTo("home")}
        >
          <div className="logo-symbol mobile-logo-symbol">
            G
          </div>

          <div className="logo-text">
            <strong>
              GRIHINI APNA BAZAAR
            </strong>
          </div>
        </button>

        <button
          type="button"
          className="mobile-cart"
        >
          <CartIcon />

          <span>0</span>
        </button>
      </div>

      {/* MOBILE SEARCH — ONLY ONE */}
      <div className="mobile-search">
        <div className="mobile-search-box">
          <SearchIcon />

          <input
            type="text"
            value={searchValue}
            onChange={(e) =>
              onSearchChange(
                e.target.value
              )
            }
            placeholder="Search groceries, brands..."
          />

          {searchValue && (
            <button
              type="button"
              className="mobile-search-clear"
              onClick={() =>
                onSearchChange("")
              }
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* NAV */}
      <div className="mobile-rubber-wrapper">
        <RubberSegment />
      </div>

      {/* DRAWER */}
      {menuOpen && (
        <div className="mobile-drawer">
          <button
            type="button"
            onClick={() => goTo("home")}
          >
            Home
          </button>

          <button
            type="button"
            onClick={() => goTo("products")}
          >
            All Products
          </button>

          <button
            type="button"
            onClick={() => goTo("categories")}
          >
            Categories
          </button>

          <button
            type="button"
            onClick={() => goTo("offers")}
          >
            Offers
          </button>

          <button
            type="button"
            onClick={() => goTo("contact")}
          >
            Contact
          </button>

          <button
            type="button"
            onClick={() =>
              setMenuOpen(false)
            }
          >
            Login / Sign Up
          </button>
        </div>
      )}
    </header>
  );
}