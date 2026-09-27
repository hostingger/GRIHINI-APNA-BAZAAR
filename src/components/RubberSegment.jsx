import { useState } from 'react'
import { motion } from 'framer-motion'

const menuItems = [
  'Home',
  'Products',
  'Categories',
  'Offers',
  'Contact',
]

export default function RubberSegment() {
  const [active, setActive] = useState('Home')

  const handleClick = (item) => {
    setActive(item)

    const id = item.toLowerCase()
    const section = document.getElementById(id)

    if (section) {
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  }

  return (
    <nav className="rubber-segment" aria-label="Main navigation">

      {menuItems.map((item) => (
        <button
          key={item}
          type="button"
          className={`rubber-item ${
            active === item ? 'active' : ''
          }`}
          onClick={() => handleClick(item)}
        >

          {active === item && (
            <motion.span
              layoutId="rubber-active"
              className="rubber-active"
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
              }}
            />
          )}

          <span className="rubber-item-text">
            {item}
          </span>

        </button>
      ))}

    </nav>
  )
}