import React, { useMemo, useState } from 'react'
import * as sat from 'satellite.js'
import { fetchActiveTLEs } from '../api'

const LAUNCH_SITES = [
  { id: 'ccafs', name: 'Cape Canaveral (USA)', lat: 28.5, lon: -80.6 },
  { id: 'ksc', name: 'Kennedy (USA)', lat: 28.6, lon: -80.6 },
  { id: 'vafb', name: 'Vandenberg (USA)', lat: 34.7, lon: -120.6 },
  { id: 'baikonur', name: 'Baikonur (KAZ)', lat: 45.6, lon: 63.3 },
  { id: 'tanegashima', name: 'Tanegashima (JPN)', lat: 30.4, lon: 130.97 },
  { id: 'shri', name: 'Sriharikota (IND)', lat: 13.7, lon: 80.2 },
  { id: 'korou', name: 'Kourou (FRA-GF)', lat: 5.2, lon: -52.8 },
]

const SIZE_CLASSES = [
  { id: '3u',   name: 'CubeSat 3U',    refArea: 0.03 },
  { id: '6u',   name: 'CubeSat 6U',    refArea: 0.06 },
  { id: '12u',  name: 'CubeSat 12U',   refArea: 0.12 },
  { id: 'smallsat', name: 'SmallSat',  refArea: 0.5 },
  { id: 'microsat', name: 'MicroSat',  refArea: 1.0 },
  { id: 'smallsat-bus', name: 'Small bus', refArea: 2.5 },
]

// ---------- helpers ----------
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)) }
function parseActiveText(txt){
  const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  const out = []
  for(let i=0;i<lines.length-2;i+=3){
    const name = lines[i], l1 = lines[i+1], l2 = lines[i+2]
    if(l1.startsWith('1 ') && l2.startsWith('2 ')) out.push({ name, l1, l2 })
  }
  return out
}
function estimateCrossSection(sizeId, massKg) {
  const base = SIZE_CLASSES.find(s=>s.id===sizeId)?.refArea || 0.3
  const scale = clamp(0.7 + Math.log10(Math.max(1, massKg))/3, 0.7, 1.6)
  return base * scale
}
function poissonRisk(densityRel, area_m2, durationDays, vRel = 7.5) {
  const CAL_K = 1.2e-10 // demo scaling
  const T = durationDays * 86400
  const lambda = densityRel * vRel * CAL_K * area_m2 * T
  const P = 1 - Math.exp(-lambda)
  return { lambda, P }
}
function monteCarloRisk(densityRel, area_m2, durationDays, vRel = 7.5, N=4000) {
  const { lambda } = poissonRisk(densityRel, area_m2, durationDays, vRel)
  let hits = 0
  for (let i=0;i<N;i++){
    const L = lambda * (0.8 + Math.random()*0.4) // ±20%
    if (Math.random() < (1 - Math.exp(-L))) hits++
  }
  return hits / N
}
async function computeLiveDensity(altKm, incDeg, bandAltKm = 50, bandIncDeg = 10) {
  const txt = await fetchActiveTLEs()
  const items = parseActiveText(txt)
  const now = new Date()
  const gmst = sat.gstime(now)
  let count = 0, total = 0
  for (const it of items) {
    try {
      const sr = sat.twoline2satrec(it.l1, it.l2)
      const pv = sat.propagate(sr, now)
      if (!pv.position) continue
      const gd = sat.eciToGeodetic(pv.position, gmst)
      const alt = gd.height
      const incThis = (sr.inclo ?? 0) * (180/Math.PI)
      total++
      if (Math.abs(alt - altKm) <= bandAltKm && Math.abs(incThis - incDeg) <= bandIncDeg) count++
    } catch {}
  }
  const rel = clamp(0.1 + (count / 120), 0.1, 1.5)
  return { relDensity: rel, count, total, bandAltKm, bandIncDeg }
}
function heuristicDensity(altKm, incDeg) {
  let fAlt = 0
  if (altKm < 300) fAlt = 0.2
  else if (altKm < 450) fAlt = 0.4
  else if (altKm < 550) fAlt = 1.0
  else if (altKm < 650) fAlt = 0.9
  else if (altKm < 800) fAlt = 0.6
  else if (altKm < 1000) fAlt = 0.4
  else fAlt = 0.2
  const inc = Math.abs(incDeg)
  let fInc = 0.4
  if (inc > 70) fInc = 0.9
  else if (inc > 50) fInc = 0.7
  else if (inc > 30) fInc = 0.5
  else fInc = 0.4
  const dens = clamp(0.1 + 1.2*(0.6*fAlt + 0.4*fInc), 0.1, 1.2)
  return { relDensity: dens, count: null, total: null, bandAltKm: 50, bandIncDeg: 10 }
}
// ---------- /helpers ----------

export default function SimulationPredictor(){
  const [form, setForm] = useState({
    launchSite: 'ccafs',
    massKg: '200',
    sizeId: 'smallsat',
    altitudeKm: '550',
    inclinationDeg: '53',
    durationDays: '365',
  })
  const [useLive, setUseLive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [liveMeta, setLiveMeta] = useState(null)

  const site = useMemo(() => LAUNCH_SITES.find(s=>s.id===form.launchSite), [form.launchSite])
  const onChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  function badgeColor(p){
    if (p >= 0.5) return '#ff4d4f'
    if (p >= 0.2) return '#faad14'
    return '#52c41a'
  }

  async function compute() {
    setBusy(true)
    try {
      const mass = parseFloat(form.massKg)
      const alt = parseFloat(form.altitudeKm)
      const inc = parseFloat(form.inclinationDeg)
      const days = parseFloat(form.durationDays)
      const area = estimateCrossSection(form.sizeId, mass)
      const vRel = 7.5

      let densRes = useLive
        ? await computeLiveDensity(alt, inc, 50, 10)
        : heuristicDensity(alt, inc)
      setLiveMeta(densRes)

      const { lambda, P } = poissonRisk(densRes.relDensity, area, days, vRel)
      const Pmc = monteCarloRisk(densRes.relDensity, area, days, vRel, 4000)

      setResult({
        inputs: {
          site: site?.name, area: area.toFixed(2), mass, alt, inc, days, vRel,
          densityRel: densRes.relDensity.toFixed(2),
          liveCount: densRes.count, liveTotal: densRes.total,
          bandAltKm: densRes.bandAltKm, bandIncDeg: densRes.bandIncDeg,
          mode: useLive ? 'Live density (catalog)' : 'Heuristic density'
        },
        analytic: { lambda: lambda.toExponential(3), prob: P },
        simulated: { prob: Pmc },
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 className="form-title">🧪 Launch Collision Risk Simulator</h3>

      <div className="form-toolbar">
        <label className="switch-row">
          <input type="checkbox" checked={useLive} onChange={e=>setUseLive(e.target.checked)} />
          <span>Use <strong>live catalog density</strong> (propagate all active sats to “now”)</span>
        </label>
      </div>

      <div className="form-grid">
        <div className="form-row">
          <label>Launch site</label>
          <select name="launchSite" value={form.launchSite} onChange={onChange}>
            {LAUNCH_SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>Spacecraft size</label>
          <select name="sizeId" value={form.sizeId} onChange={onChange}>
            {SIZE_CLASSES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label>Mass (kg)</label>
          <input name="massKg" value={form.massKg} onChange={onChange} inputMode="numeric" />
        </div>

        <div className="form-row">
          <label>Orbit altitude (km)</label>
          <input name="altitudeKm" value={form.altitudeKm} onChange={onChange} inputMode="numeric" />
        </div>

        <div className="form-row">
          <label>Inclination (deg)</label>
          <input name="inclinationDeg" value={form.inclinationDeg} onChange={onChange} inputMode="numeric" />
        </div>

        <div className="form-row">
          <label>Mission duration (days)</label>
          <input name="durationDays" value={form.durationDays} onChange={onChange} inputMode="numeric" />
        </div>
      </div>

      <div className="form-actions">
        <button onClick={compute} disabled={busy}>
          {busy ? 'Computing… (can take a bit)' : 'Run Simulation'}
        </button>
      </div>

      {result && (
        <div className="card result-card">
          <h4>Result</h4>

          <div className="result-grid">
            <div className="result-box">
              <div className="muted">Inputs</div>
              <div>Mode: <strong>{result.inputs.mode}</strong></div>
              <div>Area (m²): <strong>{result.inputs.area}</strong></div>
              <div>Altitude: <strong>{result.inputs.alt} km</strong></div>
              <div>Inclination: <strong>{result.inputs.inc}°</strong></div>
              <div>Mass: <strong>{result.inputs.mass} kg</strong></div>
              <div>Duration: <strong>{result.inputs.days} days</strong></div>
              <div>v<sub>rel</sub>: <strong>{result.inputs.vRel} km/s</strong></div>
            </div>

            <div className="result-box">
              <div className="muted">Density</div>
              <div>Relative density: <strong>{result.inputs.densityRel}</strong></div>
              {useLive && (
                <>
                  <div>Live count in band: <strong>{result.inputs.liveCount}</strong></div>
                  <div>Catalog size: <strong>{result.inputs.liveTotal}</strong></div>
                  <div>Band: ±{result.inputs.bandAltKm} km, ±{result.inputs.bandIncDeg}°</div>
                </>
              )}
            </div>

            <div className="result-box">
              <div className="muted">Analytic (Poisson)</div>
              <div>λ (expected collisions): <strong>{result.analytic.lambda}</strong></div>
              <div>
                Probability:{' '}
                <strong
                  style={{
                    color:
                      (result.analytic.prob >= 0.5) ? '#ff4d4f' :
                      (result.analytic.prob >= 0.2) ? '#faad14' : '#52c41a'
                  }}
                >
                  {(result.analytic.prob*100).toFixed(2)}%
                </strong>
              </div>
            </div>

            <div className="result-box">
              <div className="muted">Monte Carlo (4k)</div>
              <div>
                Probability:{' '}
                <strong
                  style={{
                    color:
                      (result.simulated.prob >= 0.5) ? '#ff4d4f' :
                      (result.simulated.prob >= 0.2) ? '#faad14' : '#52c41a'
                  }}
                >
                  {(result.simulated.prob*100).toFixed(2)}%
                </strong>
              </div>
            </div>
          </div>

          <p className="tiny muted" style={{marginTop:8}}>
            Demo-only estimator. For operational use, incorporate covariance, hard-body radii,
            fragmentation flux models, and vetted catalogs.
          </p>
        </div>
      )}
    </div>
  )
}
