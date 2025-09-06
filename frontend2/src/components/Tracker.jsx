import React, { useState } from 'react'

export default function Tracker({ onTrack, loading }){
  const [query, setQuery] = useState('ISS (ZARYA)')

  const submit = (e)=>{
    e.preventDefault()
    if(!query.trim()) return
    onTrack(query.trim())
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="controls">
        <input type="text" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Enter satellite name (e.g., ISS (ZARYA))" />
        <button type="submit" disabled={loading}>{loading? 'Tracking…':'Track'}</button>
      </div>
      <div className="small" style={{marginTop:6}}>We search CelesTrak by name and propagate with satellite.js in your browser.</div>
    </form>
  )
}

