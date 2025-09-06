import React from 'react'
import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="nav">
      <div className="nav__inner">
        <div className="nav__brand">
          <span>🛰 SatTracker</span>
        </div>
        <nav className="nav__links">
  <NavLink to="/" end className="nav__link">
    Home
  </NavLink>
  <NavLink to="/track" className="nav__link">
    Track
  </NavLink>
  <NavLink to="/predict" className="nav__link">
    Predict
  </NavLink>
</nav>

      </div>
    </header>
  )
}