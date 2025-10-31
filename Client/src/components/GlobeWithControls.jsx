import React, { useState } from 'react'
import Globe3D from './Globe3D'

export default function GlobeWithControls({
  orbitPoints,
  satPosition,
  neighbors,
  mainName,
}) {
  // start with 80 like before
  const [maxNeighbors, setMaxNeighbors] = useState(80)

  function handleChange(e) {
    // parseInt so it becomes a number, clamp to sane range
    const val = parseInt(e.target.value, 10)
    if (!Number.isNaN(val) && val >= 0) {
      setMaxNeighbors(val)
    } else if (e.target.value === '') {
      // allow user to temporarily clear the box without breaking
      setMaxNeighbors(0)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {/* left: controls panel */}
      <div
        className="card"
        style={{
          width: '220px',
          minWidth: '220px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: '14px',
        }}
      >
        <label style={{ fontWeight: 600 }}>
          Neighbor count
          <input
            type="number"
            min={0}
            step={1}
            value={maxNeighbors}
            onChange={handleChange}
            style={{
              width: '100%',
              marginTop: '4px',
              background: '#0b1020',
              color: 'white',
              border: '1px solid #2a335b',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: '14px',
            }}
          />
        </label>
        <div className="small" style={{ lineHeight: 1.4, color: '#9ba3c7' }}>
          This controls how many nearby satellites (red dots) we render in 3D.
        </div>
      </div>

      {/* right: globe */}
      <div style={{ flex: 1, minHeight: '500px' }}>
        <Globe3D
          orbitPoints={orbitPoints}
          satPosition={satPosition}
          neighbors={neighbors}
          mainName={mainName}
          maxNeighbors={maxNeighbors}
        />
      </div>
    </div>
  )
}
