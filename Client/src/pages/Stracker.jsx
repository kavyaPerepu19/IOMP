import React, { useState } from 'react'
import * as sat from 'satellite.js'
import Tracker from '../components/Tracker'
import Globe3D from '../components/Globe3D'
import InfoCard from '../components/InfoCard'
import Neighbors from '../components/Neighbors'
import { fetchTLEByName, fetchActiveTLEs, fetchInfo } from '../api'

// -----------------------------
// Helpers
// -----------------------------

function parseActiveText(txt){
  const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  const out = []
  for (let i=0; i < lines.length-2; i+=3){
    const name = lines[i]
    const l1 = lines[i+1]
    const l2 = lines[i+2]
    if (l1.startsWith('1 ') && l2.startsWith('2 ')) {
      out.push({ name, l1, l2 })
    }
  }
  return out
}

// ECI -> ECEF (km)
function eciToEcefKm(eci, gmst){
  const ecf = sat.eciToEcf(eci, gmst)
  return { x: ecf.x, y: ecf.y, z: ecf.z }
}

// Just keep {x,y,z} shape consistent
function ecefToVec3(ecf){
  return { x: ecf.x, y: ecf.y, z: ecf.z }
}

// lat/lon/alt -> Earth-centered XYZ in km (ECEF-like coordinates)
// Earth radius ~6371 km, which matches Globe3D scale.
function latLonAltToECEF(latDeg, lonDeg, altKm){
  const R_EARTH = 6371
  const r = R_EARTH + altKm

  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180

  return {
    x: r * Math.cos(lat) * Math.cos(lon),
    y: r * Math.cos(lat) * Math.sin(lon),
    z: r * Math.sin(lat),
  }
}


function generateFakeNeighbors(centerECEF, count){
  const namePool = [
    'STARLINK-3015',
    'NAVIC-IRNSS-1G',
    'COSMOS-2251 DEB',
    'GSAT-30',
    'INSAT-4A',
    'HUBBLE SPACE TELESCOPE',
    'TIANGONG MODULE',
    'GPS BIIR-2',
    'WEATHER-METEOSAT',
    'RISAT-2B',
    'CARTOSAT-2F',
    'OCEANSAT-3',
    'YAOGAN-41',
    'GALILEO-27',
    'BEIDOU MEO-12',
    'TDRS-12',
    'THAICOM-7',
    'AEHF-6',
    'ASTRA 2F',
    'ANIK F2'
  ];

  const out = []
  for (let i = 0; i < count; i++){
   
    const satName = namePool[i % namePool.length]

    const dist = 200 + Math.random() * 1800
    const theta = Math.random() * 2 * Math.PI
    const phi = Math.acos(2*Math.random() - 1) 

    // offset in Cartesian
    const dx = dist * Math.sin(phi) * Math.cos(theta)
    const dy = dist * Math.sin(phi) * Math.sin(theta)
    const dz = dist * Math.cos(phi)

    const nx = centerECEF.x + dx
    const ny = centerECEF.y + dy
    const nz = centerECEF.z + dz

    // approximate altitude of neighbor:
    // radius from Earth's center minus Earth radius
    const R_EARTH = 6371
    const rr = Math.sqrt(nx*nx + ny*ny + nz*nz)
    const altGuess = rr - R_EARTH

    out.push({
      name: satName,
      distance_km: dist,
      alt_km: altGuess,
      x: nx,
      y: ny,
      z: nz
    })
  }

  // sort by distance_km ascending
  out.sort((a,b)=> a.distance_km - b.distance_km)
  return out
}


export default function Stracker(){
  const [loading, setLoading] = useState(false)

  const [orbitPoints, setOrbitPoints] = useState([])
  const [satPosition, setSatPosition] = useState(null)
  const [neighbors, setNeighbors] = useState([])

  const [satMeta, setSatMeta] = useState({})
  const [info, setInfo] = useState(null)

 
  const [maxNeighbors, setMaxNeighbors] = useState(10)

  
  async function handleTrack(targetOrObj, numFromUser){
    setLoading(true)
    setInfo(null)

    // sync neighbor cap from UI
    if (typeof numFromUser === 'number' && numFromUser > 0){
      setMaxNeighbors(numFromUser)
    }

    try {
      if (typeof targetOrObj === 'object' && targetOrObj?.special === 'kalpana') {
        const { name, lat, lon, alt } = targetOrObj
        const now = new Date()

        
        const ecef = latLonAltToECEF(lat, lon, alt)
        setSatPosition(ecef)

        
        setSatMeta({
          name,
          lat,
          lon,
          alt_km: alt,
          timestamp: now.toISOString()
        })

        // 3. No orbit line in mock mode
        setOrbitPoints([])

        // 4. Fake neighbors with realistic-ish names
        const fakeNeighbors = generateFakeNeighbors(
          ecef,
          maxNeighbors * 2 || 20
        )
        setNeighbors(fakeNeighbors)

        // 5. No info panel lookup in mock mode
        setInfo(null)

        setLoading(false)
        return
      }

    
      const name = targetOrObj  
      const tle = await fetchTLEByName(name)
      const { line1, line2, name: resolvedName } = tle
      const satrec = sat.twoline2satrec(line1, line2)

      
      const now = new Date()
      const pv = sat.propagate(satrec, now)
      if (!pv.position) {
        throw new Error('Propagation failed for satellite position.')
      }

      const positionEci = pv.position // {x,y,z} km in ECI
      const gmst = sat.gstime(now)

      // lat/lon/alt for side card
      const geodetic = sat.eciToGeodetic(positionEci, gmst)
      const lat = sat.degreesLat(geodetic.latitude)
      const lon = sat.degreesLong(geodetic.longitude)
      const alt_km = geodetic.height // km

      // ECEF position for rendering
      const ecfNow = eciToEcefKm(positionEci, gmst)

      setSatMeta({
        name: resolvedName,
        lat,
        lon,
        alt_km,
        timestamp: now.toISOString()
      })
      setSatPosition(ecefToVec3(ecfNow))

      // 3. Orbit line over ~1 orbital period
      const mm = satrec.no_kozai || satrec.no           // rad/min
      const rev_per_day = mm * (1440 / (2*Math.PI))      // revs/day
      const period_min = 1440 / rev_per_day              // minutes/rev

      const steps = 360
      const dt = (period_min * 60 * 1000) / steps        // ms per step

      const pts = []
      for (let i=0; i<=steps; i++){
        const t = new Date(now.getTime() + i*dt)
        const pv2 = sat.propagate(satrec, t)
        if (!pv2.position) continue
        const gmst2 = sat.gstime(t)
        const ecf = sat.eciToEcf(pv2.position, gmst2)
        pts.push(ecefToVec3(ecf))
      }
      setOrbitPoints(pts)

      // 4. Real neighbors using the catalog
      const activeTxt = await fetchActiveTLEs()
      const all = parseActiveText(activeTxt)

      // subsample for performance
      const SUBSAMPLE = 20
      const subset = all.filter((_,i)=> i % SUBSAMPLE === 0)

      const neighborsNow = []
      const p0 = ecfNow

      for (const sInfo of subset){
        try {
          const sr = sat.twoline2satrec(sInfo.l1, sInfo.l2)
          const pvN = sat.propagate(sr, now)
          if (!pvN.position) continue

          const ecfN = sat.eciToEcf(pvN.position, gmst)

          const dx = ecfN.x - p0.x
          const dy = ecfN.y - p0.y
          const dz = ecfN.z - p0.z
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)

          const gdN = sat.eciToGeodetic(pvN.position, gmst)
          const altN = gdN.height

          neighborsNow.push({
            name: sInfo.name,
            distance_km: dist,
            alt_km: altN,
            x: ecfN.x,
            y: ecfN.y,
            z: ecfN.z
          })
        } catch {
          // ignore broken TLEs
        }
      }

      neighborsNow.sort((a,b)=> a.distance_km - b.distance_km)
      setNeighbors(neighborsNow.slice(0, 200))

      // 5. Fetch wiki/info text for sidebar
      try {
        const ii = await fetchInfo(resolvedName)
        setInfo(ii)
      } catch {
        setInfo(null)
      }

    } catch (err){
      alert("Error: " + (err?.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h2>🛰️ Satellite Tracker</h2>
        <p className="small">
          • Type any real satellite name (ex: "ISS (ZARYA)") to see live data.
          
        </p>
      </div>

      <Tracker onTrack={handleTrack} loading={loading} />

      <div className="row">
        <Globe3D
          orbitPoints={orbitPoints}
          satPosition={satPosition}
          neighbors={neighbors}
          mainName={satMeta?.name}
          maxNeighbors={maxNeighbors}
        />

        <div className="list">
          <InfoCard satMeta={satMeta} info={info} />

          <Neighbors
            neighbors={neighbors}
            maxNeighbors={maxNeighbors}
          />
        </div>
      </div>
    </div>
  )
}
