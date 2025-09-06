import React from 'react'

export default function Neighbors({ neighbors }){
  return (
    <div className="card">
      <h3 style={{margin:"4px 0 8px"}}>Nearest Satellites</h3>
      <table className="table">
        <thead>
          <tr><th>Name</th><th>Δ Distance (km)</th><th>Alt (km)</th></tr>
        </thead>
        <tbody>
          {neighbors?.slice(0,10).map(n => (
            <tr key={n.name}>
              <td>{n.name}</td>
              <td>{n.distance_km.toFixed(0)}</td>
              <td>{(n.alt_km ?? 0).toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="small" style={{marginTop:6}}>We subsample the active catalog for performance and compute distances at the current epoch.</div>
    </div>
  )
}
