
import React, { useState, useRef } from 'react'
import * as sat from 'satellite.js'
import { fetchTLEByName, fetchActiveTLEs } from '../api'

// ----------------- helpers -----------------
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



function clamp(x, a, b){ return Math.max(a, Math.min(b, x)) }

function riskFrom(distKm, vrel, densityFactor){
  const severity = 1 / (1 + Math.pow((Math.max(1e-6, distKm)) / 80, 1.7))
  const speedFactor = clamp((vrel || 7.5) / 8, 0.6, 1.3)
  const GLOBAL = 0.45
  return clamp(severity * speedFactor * densityFactor * GLOBAL, 0, 0.98)
}

function makePath(points, w, h, pad=8){
  if(points.length===0) return ''
  const xs = points.map(p=>p.t)
  const ys = points.map(p=>p.r)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = 0, maxY = Math.max(0.001, Math.max(...ys))
  const sx = (x)=> pad + (w-2*pad) * ((x-minX)/(maxX-minX || 1))
  const sy = (y)=> h-pad - (h-2*pad) * ((y-minY)/(maxY-minY || 1))
  let d = `M ${sx(points[0].t)} ${sy(points[0].r)}`
  for(let i=1;i<points.length;i++){
    d += ` L ${sx(points[i].t)} ${sy(points[i].r)}`
  }
  return d
}

function fmtTime(dt){
  try{ return dt.toISOString().slice(11,16) + 'Z' }catch{ return '' }
}
// ----------------- /helpers -----------------

export default function CollisionPredictor(){
  const [target, setTarget] = useState('')
  const [loading, setLoading] = useState(false)
  const [preds, setPreds] = useState([])

  // Chart state
  const [chartOpen, setChartOpen] = useState(false)
  const [chartTitle, setChartTitle] = useState('')
  const [chartSeries, setChartSeries] = useState([]) // [{t: ms, r: risk}]
  const [chartMeta, setChartMeta] = useState(null)   // {start, end, stepMin}
  const chartRef = useRef(null) // <-- for smooth scrolling

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

      // Target shell params (for density band)
      const gdTarget = sat.eciToGeodetic(pvNow.position, gmstNow)
      const targetAltKm = gdTarget.height
      const targetIncDeg = (satrec.inclo ?? 0) * (180/Math.PI)
      const BAND_ALT_KM = 50
      const BAND_INC_DEG = 10

      // Active catalog — NO SUBSAMPLING
      const activeTxt = await fetchActiveTLEs()
      const all = parseActiveText(activeTxt)

      // Neighbors @ now + live density count
      const neighbors = []
      let liveCountInBand = 0

      for(const s of all){
        try{
          const sr = sat.twoline2satrec(s.l1, s.l2)
          const pvN = sat.propagate(sr, now)
          if(!pvN.position) continue

          // density band check
          const incThis = (sr.inclo ?? 0) * (180/Math.PI)
          const gdN = sat.eciToGeodetic(pvN.position, gmstNow)
          const altN = gdN.height
          if (Math.abs(altN - targetAltKm) <= BAND_ALT_KM &&
              Math.abs(incThis - targetIncDeg) <= BAND_INC_DEG) {
            liveCountInBand++
          }

          // distance now (ECF)
          const ecfN = sat.eciToEcf(pvN.position, gmstNow)
          const dx = ecfN.x - ecfTargetNow.x
          const dy = ecfN.y - ecfTargetNow.y
          const dz = ecfN.z - ecfTargetNow.z
          const dist = Math.sqrt(dx*dx+dy*dy+dz*dz)

          neighbors.push({ ...s, dist, sr })
        }catch{}
      }

      neighbors.sort((a,b)=> a.dist - b.dist)
      const nearest = neighbors.slice(1,20)

      // Live density factor: faster ramp so it influences risk
      const densityFactor = clamp(0.2 + (liveCountInBand / 80), 0.2, 2.0)

      // Closest-approach search: 48h coarse (5 min) + refine ±30 min @ 30 s
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

          let vrel = 0
          if (pvT.velocity && pvN.velocity) {
            const dvx = pvT.velocity.x - pvN.velocity.x
            const dvy = pvT.velocity.y - pvN.velocity.y
            const dvz = pvT.velocity.z - pvN.velocity.z
            vrel = Math.sqrt(dvx*dvx + dvy*dvy + dvz*dvz)
          } else {
            vrel = fdRelVel(satrec, srN, epoch)
          }

          if (dist < best.dMin) best = { dMin: dist, vAtMin: vrel || best.vAtMin, tca: epoch }
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

            if (dist < best.dMin) best = { dMin: dist, vAtMin: vrel || best.vAtMin, tca: epoch }
          }
        }

        const risk = riskFrom(best.dMin || 1e-3, best.vAtMin || 7.5, densityFactor)

        predictions.push({
          name: n.name,
          minDist: (isFinite(best.dMin) ? best.dMin : 0).toFixed(2),
          relVel: (isFinite(best.vAtMin) ? best.vAtMin : 0).toFixed(2),
          tca: best.tca ? best.tca.toISOString() : 'n/a',
          risk: risk.toFixed(2),

          _srNeighbor: n.sr,
          _satrecTarget: satrec,
          _densityFactor: densityFactor,
          _tca: best.tca ? best.tca.getTime() : null,
        })
      }

      if (/starlink/i.test(target)) {
        const dSim = 0.2
        const vSim = 7.6
        const riskSim = riskFrom(dSim, vSim, clamp(0.2 + (1/80), 0.2, 2.0))
        predictions.unshift({
          name: `my-satellelite (sim) vs ${target}`,
          minDist: dSim.toFixed(2),
          relVel:  vSim.toFixed(2),
          tca:     new Date(Date.now()+60*60*1000).toISOString(),
          risk:    riskSim.toFixed(2),
          _srNeighbor: null,
          _satrecTarget: null,
          _densityFactor: clamp(0.2 + (1/80), 0.2, 2.0),
          _tca: Date.now()+60*60*1000
        })
      }

      predictions.sort((a,b)=> parseFloat(b.risk) - parseFloat(a.risk))
      setPreds(predictions)
      setChartOpen(false) // collapse old chart if any
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

  async function openSeriesFor(row){
    try{
      const densityFactor = row._densityFactor ?? 1
      const satrecT = row._satrecTarget
      const srN = row._srNeighbor

      // Simulated row curve
      if (!satrecT || !srN){
        const start = (row._tca ?? Date.now()) - 6*60*60*1000
        const end   = (row._tca ?? Date.now()) + 6*60*60*1000
        const step  = 5 * 60 * 1000
        const pts = []
        for(let t=start;t<=end;t+=step){
          const d = Math.abs(t - (row._tca ?? Date.now()))/ (60*1000) // minutes
          const dist = 0.2 + (d/30) * 10 // km grows away from tca
          const vrel = 7.6
          pts.push({ t, r: riskFrom(dist, vrel, densityFactor) })
        }
        setChartTitle(row.name)
        setChartSeries(pts)
        setChartMeta({ start, end, stepMin: 5 })
        setChartOpen(true)

        // --- Smooth scroll into view ---
        requestAnimationFrame(() => {
          chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        return
      }

      // Real neighbor: compute series around TCA (±6h), 5-min steps
      const tcaMs = row._tca ?? Date.now()
      const start = tcaMs - 6*60*60*1000
      const end   = tcaMs + 6*60*60*1000
      const stepMin = 5

      const pts = []
      for(let ts=start; ts<=end; ts += stepMin*60*1000){
        const epoch = new Date(ts)
        const pvT = sat.propagate(satrecT, epoch)
        const pvN = sat.propagate(srN, epoch)
        if(!pvT.position || !pvN.position) continue
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
          vrel = fdRelVel(satrecT, srN, epoch)
        }

        pts.push({ t: ts, r: riskFrom(dist, vrel, densityFactor) })
      }

      setChartTitle(row.name)
      setChartSeries(pts)
      setChartMeta({ start, end, stepMin })
      setChartOpen(true)

      // --- Smooth scroll into view ---
      requestAnimationFrame(() => {
        chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }catch(e){
      alert('Unable to compute time series: ' + e.message)
    }
  }

  function Chart({ series, meta, title }){
    const width = 760, height = 260
    const path = makePath(series, width, height, 10)

    const minT = series.length ? Math.min(...series.map(p=>p.t)) : 0
    const maxT = series.length ? Math.max(...series.map(p=>p.t)) : 1
    const ticks = 6
    const labelTimes = []
    for(let i=0;i<=ticks;i++){
      const tt = minT + (i*(maxT-minT))/ticks
      labelTimes.push(new Date(tt))
    }

    return (
      <div className="card" style={{marginTop:12}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <h4 style={{margin:0}}>Risk vs Time — {title}</h4>
          <button onClick={()=>setChartOpen(false)}>Close</button>
        </div>
        <svg width={width} height={height} style={{background:'#0b1020', border:'1px solid #1f2747', borderRadius:8}}>
          <line x1="40" y1={height-30} x2={width-10} y2={height-30} stroke="#334" strokeWidth="1"/>
          <line x1="40" y1="10" x2="40" y2={height-30} stroke="#334" strokeWidth="1"/>
          <path d={path} fill="none" stroke="#5eb2ff" strokeWidth="2.2" />
          {labelTimes.map((dt,i)=>(
            <text key={i} x={40 + (i*(width-50))/ticks} y={height-10} fill="#aab3d1" fontSize="10" textAnchor="middle">
              {fmtTime(dt)}
            </text>
          ))}
          {[0,0.25,0.5,0.75,1].map((v,i)=>{
            const y = (height-30) - (height-40)*v
            return (
              <g key={i}>
                <line x1="38" x2="42" y1={y} y2={y} stroke="#334" />
                <text x="28" y={y+3} fill="#aab3d1" fontSize="10" textAnchor="end">{v.toFixed(2)}</text>
              </g>
            )
          })}
        </svg>
        <div className="small" style={{opacity:.8, marginTop:8}}>
          12-hour window centered on TCA, sampled every {meta?.stepMin ?? 5} minutes. Risk uses the same heuristic as the table.
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{marginTop:20}}>
      <h3>🚨 Collision Predictor (48h closest-approach · realistic heuristic)</h3>
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
        <>
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

          
          {chartOpen && (
            <div ref={chartRef}>
              <Chart series={chartSeries} meta={chartMeta} title={chartTitle} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
