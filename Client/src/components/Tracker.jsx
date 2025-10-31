import React, { useState } from 'react'

export default function Tracker({ onTrack, loading }){
  const [query, setQuery] = useState('ISS (ZARYA)')
  const [num, setNum] = useState(10) // how many neighbors user wants

  const submit = (e)=>{
    e.preventDefault()
    if(!query.trim()) return
    onTrack(query.trim(), num)
  }

  return (
    <form onSubmit={submit} className="card">
      <div className="controls">
        <input
          type="text"
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Enter satellite name (e.g., ISS (ZARYA))"
        />
        <br />
        <input
          type="number"
          value={num}
          onChange={e=>setNum(Number(e.target.value))}
          min={1}
          max={500}
          style={{width:80}}
          placeholder='20'
        />
        <button type="submit" disabled={loading}>
          {loading? 'Tracking…':'Track'}
        </button>
      </div>
      <div className="small" style={{marginTop:6}}>
        We search CelesTrak by name and propagate with satellite.js in your browser.
      </div>
    </form>
  )
}
