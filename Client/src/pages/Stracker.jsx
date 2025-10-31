import React, { useState } from 'react'
import * as sat from 'satellite.js'
import Tracker from '../components/Tracker'
import Globe3D from '../components/Globe3D'
import InfoCard from '../components/InfoCard'
import Neighbors from '../components/Neighbors'
import { fetchTLEByName, fetchActiveTLEs, fetchInfo } from '../api'

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

function eciToEcefKm(eci, gmst){
  const ecf = sat.eciToEcf(eci, gmst)
  return { x: ecf.x, y: ecf.y, z: ecf.z }
}

function ecefToVec3(ecf){
  return { x: ecf.x, y: ecf.y, z: ecf.z }
}

export default function Stracker(){
  const [loading, setLoading] = useState(false)
  const [orbitPoints, setOrbitPoints] = useState([])
  const [satPosition, setSatPosition] = useState(null)
  const [neighbors, setNeighbors] = useState([])
  const [satMeta, setSatMeta] = useState({})
  const [info, setInfo] = useState(null)

  // NEW: how many neighbors the user wants to display
  const [maxNeighbors, setMaxNeighbors] = useState(10)

  async function handleTrack(name, numFromUser){
    setLoading(true)
    setInfo(null)

    // save the chosen neighbor cap
    if (typeof numFromUser === 'number' && numFromUser > 0) {
      setMaxNeighbors(numFromUser)
    }

    try{
      // 1. Fetch TLE for the requested sat
      const tle = await fetchTLEByName(name)
      const { line1, line2, name: resolvedName } = tle
      const satrec = sat.twoline2satrec(line1, line2)

      // 2. Current position
      const now = new Date()
      const pv = sat.propagate(satrec, now)
      const positionEci = pv.position // km
      const gmst = sat.gstime(now)
      const geodetic = sat.eciToGeodetic(positionEci, gmst)
      const lat = sat.degreesLat(geodetic.latitude)
      const lon = sat.degreesLong(geodetic.longitude)
      const alt_km = geodetic.height // km
      const ecfNow = eciToEcefKm(positionEci, gmst)

      setSatMeta({
        name: resolvedName,
        lat,
        lon,
        alt_km,
        timestamp: now.toISOString()
      })
      setSatPosition(ecefToVec3(ecfNow))

      // 3. Build orbit path ~1 period
      const mm = satrec.no_kozai || satrec.no // rad/min
      const rev_per_day = mm * (1440/(2*Math.PI))
      const period_min = 1440 / rev_per_day
      const steps = 360
      const dt = (period_min*60*1000) / steps

      const pts = []
      for(let i=0;i<=steps;i++){
        const t = new Date(now.getTime() + i*dt)
        const pv2 = sat.propagate(satrec, t)
        const gmst2 = sat.gstime(t)
        const ecf = sat.eciToEcf(pv2.position, gmst2)
        pts.push(ecefToVec3(ecf))
      }
      setOrbitPoints(pts)

      // 4. Compute nearby sats
      const activeTxt = await fetchActiveTLEs()
      const all = parseActiveText(activeTxt)

      // Subsample for perf
      const SUBSAMPLE = 20
      const subset = all.filter((_,i)=> i % SUBSAMPLE === 0)

      const neighborsNow = []
      const p0 = ecfNow
      for(const s of subset){
        try{
          const sr = sat.twoline2satrec(s.l1, s.l2)
          const pvN = sat.propagate(sr, now)
          if(!pvN.position) continue
          const ecfN = sat.eciToEcf(pvN.position, gmst)

          const dx = ecfN.x - p0.x
          const dy = ecfN.y - p0.y
          const dz = ecfN.z - p0.z
          const dist = Math.sqrt(dx*dx+dy*dy+dz*dz)

          const gd = sat.eciToGeodetic(pvN.position, gmst)
          const altN = gd.height

          neighborsNow.push({
            name: s.name,
            distance_km: dist,
            alt_km: altN,
            x: ecfN.x,
            y: ecfN.y,
            z: ecfN.z
          })
        }catch{
          // ignore bad TLEs
        }
      }

      neighborsNow.sort((a,b)=> a.distance_km - b.distance_km)

      // store a generous chunk (so we can slice later in render)
      setNeighbors(neighborsNow.slice(0, 200))

      // 5. Optional info card data
      const ii = await fetchInfo(resolvedName)
      setInfo(ii)

    }catch(err){
      alert("Error: " + (err?.response?.data?.error || err.message))
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h2>🛰️ Satellite Tracker</h2>
      </div>

      <Tracker onTrack={handleTrack} loading={loading} />

      <div className="row">
        <Globe3D
          orbitPoints={orbitPoints}
          satPosition={satPosition}
          neighbors={neighbors}
          mainName={satMeta?.name}
          maxNeighbors={maxNeighbors}    // << pass cap to globe
        />

        <div className="list">
          <InfoCard satMeta={satMeta} info={info} />

          <Neighbors
            neighbors={neighbors}
            maxNeighbors={maxNeighbors}   // << pass cap to table
          />
        </div>
      </div>
    </div>
  )
}
