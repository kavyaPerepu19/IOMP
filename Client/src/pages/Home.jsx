
import React from 'react'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="container">
      <div className="card" style={{marginTop:12}}>
        <h2 style={{marginTop:0}}>Welcome 👋</h2>
        <p className="small" style={{lineHeight:1.5}}>
          Use the <strong>Track</strong> page to search a satellite (e.g., <em>ISS (ZARYA)</em>), visualize the orbit,
          see current position & altitude, and explore nearby satellites.
        </p>
        <p>
          <Link to="/track" className="link">Go to Tracker →</Link>
        </p>
      </div>
    </div>
  )
}
