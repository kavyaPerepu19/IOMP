// // import React, { useState } from 'react'

// // export default function Tracker({ onTrack, loading }){
// //   const [query, setQuery] = useState('ISS (ZARYA)')
// //   const [num, setNum] = useState(10) // how many neighbors user wants

// //   // const submit = (e)=>{
// //   //   e.preventDefault()
// //   //   if(!query.trim()) return
// //   //   onTrack(query.trim(), num)
// //   // }

// //   const submit = (e) => {
// //     e.preventDefault();
// //     const q = query.trim();
// //     if (!q) return;
  
// //     // 🔸 special case: "kalpana" (case-insensitive)
// //     if (q.toLowerCase() === 'kalpana') {
// //       onTrack({
// //         special: 'kalpana',
// //         name: 'KALPANA',
// //         // approximate “above India”
// //         lat: 22.0,     // ~22° N
// //         lon: 80.0,     // ~80° E
// //         alt: 35786.0   // km (geo-ish height)
// //       });
// //       return;
// //     }
  
// //     // normal flow for other satellites
// //     onTrack(q);
// //   };

// //   return (
// //     <form onSubmit={submit} className="card">
// //       <div className="controls">
// //         <input
// //           type="text"
// //           value={query}
// //           onChange={e=>setQuery(e.target.value)}
// //           placeholder="Enter satellite name (e.g., ISS (ZARYA))"
// //         />
// //         <br />
// //         <input
// //           type="number"
// //           value={num}
// //           onChange={e=>setNum(Number(e.target.value))}
// //           min={1}
// //           max={500}
// //           style={{width:80}}
// //           placeholder='20'
// //         />
// //         <button type="submit" disabled={loading}>
// //           {loading? 'Tracking…':'Track'}
// //         </button>
// //       </div>
// //       <div className="small" style={{marginTop:6}}>
// //         We search CelesTrak by name and propagate with satellite.js in your browser.
// //       </div>
// //     </form>
// //   )
// // }


// import React, { useState } from 'react'

// export default function Tracker({ onTrack, loading }){
//   const [query, setQuery] = useState('ISS (ZARYA)')
//   const [num, setNum] = useState(10) // how many nearest neighbors to consider

//   const submit = (e) => {
//     e.preventDefault();
//     const q = query.trim();
//     if (!q) return;

//     // 🔸 Special branch for "kalpana" (case-insensitive)
//     if (q.toLowerCase() === 'kalpana') {
//       onTrack(
//         {
//           special: 'kalpana',
//           name: 'KALPANA',
//           // "above India" (roughly central India longitude, GEO-ish altitude)
//           lat: 22.0,     // degrees North
//           lon: 80.0,     // degrees East
//           alt: 35786.0   // km above Earth's surface
//         },
//         num // still pass neighbor cap so state stays in sync
//       );
//       return;
//     }

//     // 🔸 Normal satellites go through the usual flow
//     onTrack(q, num);
//   };

//   return (
//     <form onSubmit={submit} className="card">
//       <div className="controls" style={{display:'flex', flexWrap:'wrap', gap:'8px', alignItems:'center'}}>
//         {/* Target satellite input */}
//         <input
//           type="text"
//           value={query}
//           onChange={e=>setQuery(e.target.value)}
//           placeholder="Enter satellite name (e.g., ISS (ZARYA) or kalpana)"
//           style={{flex:'1 1 auto', minWidth:'220px'}}
//         />

//         {/* How many nearby sats to show */}
//         <label className="small" style={{display:'flex', alignItems:'center', gap:'4px'}}>
//           <span>Neighbors:</span>
//           <input
//             type="number"
//             value={num}
//             onChange={e=>setNum(parseInt(e.target.value || '0',10))}
//             min={1}
//             max={500}
//             style={{width:80}}
//             placeholder="20"
//           />
//         </label>

//         <button type="submit" disabled={loading}>
//           {loading ? 'Tracking…' : 'Track'}
//         </button>
//       </div>

//       <div className="small" style={{marginTop:6}}>
//         We search CelesTrak by name and propagate with satellite.js in your browser.
//         Typing "kalpana" will show a demo satellite fixed above India.
//       </div>
//     </form>
//   )
// }

//-----------------------------------------------------------------------------------------------

// import React, { useState } from 'react'

// export default function Tracker({ onTrack, loading }){
//   const [query, setQuery] = useState('ISS (ZARYA)')
//   const [num, setNum] = useState(10) // how many nearest neighbors to consider

//   const submit = (e) => {
//     e.preventDefault();
//     const q = query.trim();
//     if (!q) return;

//     // Special branch for "kalpana" (case-insensitive)
//     if (q.toLowerCase() === 'kalpana') {
//       onTrack(
//         {
//           special: 'kalpana',
//           name: 'KALPANA',
//           // We'll pin this above India. These values will be used
//           // directly, no API calls.
//           lat: -65.0,      // deg North (rough India-ish latitude)
//           lon: 50.0,      // deg East  (central India-ish longitude)
//           alt: 2000.0    // km above Earth's surface (GEO-ish altitude)
//         },
//         num // pass current neighbor cap
//       );
//       return;
//     }

//     // Normal satellites go through TLE flow
//     onTrack(q, num);
//   };

//   return (
//     <form onSubmit={submit} className="card">
//       <div
//         className="controls"
//         style={{
//           display:'flex',
//           flexWrap:'wrap',
//           gap:'8px',
//           alignItems:'center'
//         }}
//       >
//         {/* Satellite name input */}
//         <input
//           type="text"
//           value={query}
//           onChange={e=>setQuery(e.target.value)}
//           placeholder="Enter satellite name (e.g., ISS (ZARYA) or kalpana)"
//           style={{flex:'1 1 auto', minWidth:'220px'}}
//         />

//         {/* How many nearby sats to show */}
//         <label
//           className="small"
//           style={{
//             display:'flex',
//             alignItems:'center',
//             gap:'4px'
//           }}
//         >
//           <span>Neighbors:</span>
//           <input
//             type="number"
//             value={num}
//             onChange={e=>setNum(parseInt(e.target.value || '0',10))}
//             min={1}
//             max={500}
//             style={{width:80}}
//             placeholder="20"
//           />
//         </label>

//         <button type="submit" disabled={loading}>
//           {loading ? 'Tracking…' : 'Track'}
//         </button>
//       </div>

//       <div className="small" style={{marginTop:6}}>
//         We search CelesTrak by name and propagate with satellite.js in your browser.
//         Typing "kalpana" will show a demo satellite above India (no API calls).
//       </div>
//     </form>
//   )
// }
//-----------------------------------------------------------------------------------------------

import React, { useState } from 'react'

export default function Tracker({ onTrack, loading }){
  const [query, setQuery] = useState('ISS (ZARYA)')
  const [num, setNum] = useState(10) // how many nearest neighbors to consider

  const submit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    // Special branch for "kalpana" (case-insensitive)
    if (q.toLowerCase() === 'kalpana') {
      onTrack(
        {
          special: 'kalpana',
          name: 'KALPANA',
          // your fixed coordinates (NO API CALLS)
          lat: -65.0,
          lon: 50.0,
          alt: 2000.0
        },
        num // pass current neighbor cap
      );
      return;
    }

    // Normal satellites go through TLE flow
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
        {/* Satellite name input */}
        <input
          type="text"
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder='Enter satellite name (e.g., "ISS (ZARYA)" or "kalpana")'
          style={{flex:'1 1 auto', minWidth:'220px'}}
        />

        {/* How many nearby sats to show */}
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
        For real satellites, we fetch live orbit data.
        Typing "kalpana" shows a demo satellite at fixed coords (no API calls).
      </div>
    </form>
  )
}
