import React, { useState } from 'react'
import * as sat from 'satellite.js'
import { fetchTLEByName, fetchActiveTLEs } from '../api'

// Parse Celestrak active.txt into [{name,l1,l2}, ...]
function parseActiveText(txt){
  const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  const out = []
  for(let i=0;i<lines.length-2;i+=3){
    const name = lines[i]
    const l1 = lines[i+1]
    const l2 = lines[i+2]
    if(l1.startsWith('1 ') && l2.startsWith('2 ')) out.push({ name, l1, l2 })
  }
  return out
}

// Finite-difference relative velocity (km/s) over 10 seconds
function fdRelVel(satrecA, satrecB, epoch){
  const t2 = new Date(epoch.getTime() + 10*1000)
  const A1 = sat.propagate(satrecA, epoch)?.position
  const A2 = sat.propagate(satrecA, t2)?.position
  const B1 = sat.propagate(satrecB, epoch)?.position
  const B2 = sat.propagate(satrecB, t2)?.position
  if (!A1 || !A2 || !B1 || !B2) return 0
  const vAx = (A2.x - A1.x)/10, vAy = (A2.y - A1.y)/10, vAz = (A2.z - A1.z)/10
  const vBx = (B2.x - B1.x)/10, vBy = (B2.y - B1.y)/10, vBz = (B2.z - B1.z)/10
  const dvx = vAx - vBx, dvy = vAy - vBy, dvz = vAz - vBz
  return Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz)
}

export default function CollisionPredictor(){
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(false)
  const [preds, setPreds] = useState([])

  async function handlePredict(){
    setLoading(true)
    try{
      // Target satellite
      const tle = await fetchTLEByName(target)
      const satrec = sat.twoline2satrec(tle.line1, tle.line2)

      const now = new Date()
      const gmstNow = sat.gstime(now)
      const pvNow = sat.propagate(satrec, now)
      if(!pvNow.position) throw new Error('Could not propagate target')
      const ecfTargetNow = sat.eciToEcf(pvNow.position, gmstNow)

      // Active catalog — NO SUBSAMPLING: consider all entries
      const activeTxt = await fetchActiveTLEs()
      const all = parseActiveText(activeTxt)
      const subset = all // <- use all satellites

      // Find nearest @ now (in ECF)
      const neighbors = []
      for(const s of subset){
        try{
          const sr = sat.twoline2satrec(s.l1, s.l2)
          const pvN = sat.propagate(sr, now)
          if(!pvN.position) continue
          const ecfN = sat.eciToEcf(pvN.position, gmstNow)
          const dx = ecfN.x - ecfTargetNow.x
          const dy = ecfN.y - ecfTargetNow.y
          const dz = ecfN.z - ecfTargetNow.z
          const dist = Math.sqrt(dx*dx+dy*dy+dz*dz)
          neighbors.push({ ...s, dist, sr })
        }catch{
          // ignore bad TLEs
        }
      }
      neighbors.sort((a,b)=> a.dist - b.dist)
      const nearest = neighbors.slice(0,20)

      // Closest-approach search: 48h coarse (5 min), then refine ±30 min at 30 s
      const COARSE_SPAN_MIN = 48*60
      const COARSE_STEP_MIN = 5
      const REFINE_WINDOW_MIN = 30
      const REFINE_STEP_SEC = 30

      const predictions = []
      for (const n of nearest) {
        const srN = n.sr
        let best = { dMin: Number.POSITIVE_INFINITY, vAtMin: 0, tca: null }

        // Coarse pass
        for (let t = 0; t <= COARSE_SPAN_MIN; t += COARSE_STEP_MIN) {
          const epoch = new Date(now.getTime() + t*60*1000)
          const pvT = sat.propagate(satrec, epoch)
          const pvN = sat.propagate(srN, epoch)
          if (!pvT.position || !pvN.position) continue
          const gm = sat.gstime(epoch)
          const rT = sat.eciToEcf(pvT.position, gm)
          const rN = sat.eciToEcf(pvN.position, gm)
          const dx = rT.x - rN.x, dy = rT.y - rN.y, dz = rT.z - rN.z
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)

          // Relative velocity (prefer true vel, else finite diff)
          let vrel = 0
          if (pvT.velocity && pvN.velocity) {
            const dvx = pvT.velocity.x - pvN.velocity.x
            const dvy = pvT.velocity.y - pvN.velocity.y
            const dvz = pvT.velocity.z - pvN.velocity.z
            vrel = Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz)
          } else {
            vrel = fdRelVel(satrec, srN, epoch)
          }

          if (dist < best.dMin) best = { dMin: dist, vAtMin: vrel, tca: epoch }
        }

        // Refine around coarse min
        if (best.tca) {
          const center = best.tca.getTime()
          const start = center - REFINE_WINDOW_MIN*60*1000
          const end   = center + REFINE_WINDOW_MIN*60*1000
          for (let ts = start; ts <= end; ts += REFINE_STEP_SEC*1000) {
            const epoch = new Date(ts)
            const pvT = sat.propagate(satrec, epoch)
            const pvN = sat.propagate(srN, epoch)
            if (!pvT.position || !pvN.position) continue
            const gm = sat.gstime(epoch)
            const rT = sat.eciToEcf(pvT.position, gm)
            const rN = sat.eciToEcf(pvN.position, gm)
            const dx = rT.x - rN.x, dy = rT.y - rN.y, dz = rT.z - rN.z
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)

            let vrel = 0
            if (pvT.velocity && pvN.velocity) {
              const dvx = pvT.velocity.x - pvN.velocity.x
              const dvy = pvT.velocity.y - pvN.velocity.y
              const dvz = pvT.velocity.z - pvN.velocity.z
              vrel = Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz)
            } else {
              vrel = fdRelVel(satrec, srN, epoch)
            }

            if (dist < best.dMin) best = { dMin: dist, vAtMin: vrel, tca: epoch }
          }
        }

        // Softer scaling → fewer zeroes; cap velocity to keep 0..1 range sane
        const riskScore = Math.exp(-best.dMin/25) * (Math.min(best.vAtMin, 10)/7)

        predictions.push({
          name: n.name,
          minDist: (isFinite(best.dMin) ? best.dMin : 0).toFixed(2),
          relVel: (isFinite(best.vAtMin) ? best.vAtMin : 0).toFixed(2),
          tca: best.tca ? best.tca.toISOString() : 'n/a',
          risk: Math.min(1, Math.max(0, riskScore)).toFixed(2)
        })
      }

      // If input looks like Starlink → inject simulated "my-satellelite" collision row
      if (/starlink/i.test(target)) {
        const dSim = 0.15 + Math.random()*0.1    // 0.15–0.25 km
        const vSim = 7.4  + Math.random()*0.5    // 7.4–7.9 km/s
        const rSim = Math.exp(-dSim/25) * (Math.min(vSim, 10)/7)
        predictions.unshift({
          name: `my-satellelite (sim) vs ${target}`,
          minDist: dSim.toFixed(2),
          relVel:  vSim.toFixed(2),
          tca:     new Date(Date.now()+60*60*1000).toISOString(), // ~1h from now (sim)
          risk:    Math.min(1, Math.max(0, rSim)).toFixed(2)
        })
      }

      // Highest risk first
      predictions.sort((a,b)=> parseFloat(b.risk) - parseFloat(a.risk))
      setPreds(predictions)
    }catch(err){
      alert("Error: " + err.message)
    }finally{
      setLoading(false)
    }
  }

  function riskColor(r){
    const val = parseFloat(r)
    if(val > 0.7) return {color:'red', fontWeight:600}
    if(val > 0.4) return {color:'orange'}
    return {color:'limegreen'}
  }

  return (
    <div className="card" style={{marginTop:20}}>
      <h3>🚨 Collision Predictor (48h closest-approach · 20 nearest from full catalog)</h3>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
        <input
          value={target}
          onChange={e=>setTarget(e.target.value)}
          placeholder="Enter satellite name (e.g. ISS (ZARYA) or STARLINK-1234)"
        />
        <button onClick={handlePredict} disabled={loading}>
          {loading ? 'Predicting...' : 'Predict'}
        </button>
      </div>

      {preds.length>0 && (
        <table className="table" style={{marginTop:12}}>
          <thead>
            <tr>
              <th>Neighbor</th>
              <th>Min Dist (km)</th>
              <th>Rel Vel (km/s)</th>
              <th>TCA (UTC)</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {preds.map((p,i)=>(
              <tr key={i}>
                <td>{p.name}</td>
                <td>{p.minDist}</td>
                <td>{p.relVel}</td>
                <td>{p.tca}</td>
                <td style={riskColor(p.risk)}>{p.risk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
