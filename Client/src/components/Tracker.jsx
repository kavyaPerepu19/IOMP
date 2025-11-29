import React, { useState } from 'react'

export default function Tracker({ onTrack, loading }){
  const [query, setQuery] = useState('ISS (ZARYA)')
  const [num, setNum] = useState(10) 

  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    
    if (q.toLowerCase() === 'kalpana') {
      onTrack(
        {
          special: 'kalpana',
          name: 'KALPANA',
     
          lat: -65.0,
          lon: 50.0,
          alt: 2000.0
        },
        num 
      );
      return;
    }

   
    onTrack(q, num);
  };

  return (
    <form onSubmit={submit} className="card">
      <div
        className="controls"
        style={{
          display:'flex',
          flexWrap:'wrap',
          gap:'8px',
          alignItems:'center'
        }}
      >
        
        <input
          type="text"
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder='Enter satellite name (e.g., "ISS (ZARYA)" or "kalpana")'
          style={{flex:'1 1 auto', minWidth:'220px'}}
        />

       
        <label
          className="small"
          style={{
            display:'flex',
            alignItems:'center',
            gap:'4px'
          }}
        >
          <span>Neighbors:</span>
          <input
            type="number"
            value={num}
            onChange={e=>setNum(parseInt(e.target.value || '0',10))}
            min={1}
            max={500}
            style={{width:80}}
            placeholder="20"
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Tracking…' : 'Track'}
        </button>
      </div>

      <div className="small" style={{marginTop:6}}>
        
      </div>
    </form>
  )
}
