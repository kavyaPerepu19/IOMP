import React from 'react'

export default function InfoCard({ satMeta, info }){
  return (
    <div className="card">
      <h3 style={{margin:"4px 0 8px"}}>{satMeta?.name || 'Satellite'}</h3>
      <div className="list">
        <div><span className="badge">Lat</span> {satMeta?.lat?.toFixed?.(2)}°</div>
        <div><span className="badge">Lon</span> {satMeta?.lon?.toFixed?.(2)}°</div>
        <div><span className="badge">Alt</span> {satMeta?.alt_km?.toFixed?.(1)} km</div>
        {satMeta?.timestamp && <div className="small">Updated: {new Date(satMeta.timestamp).toLocaleString()}</div>}
      </div>
      <hr style={{borderColor:'#24305d', margin:'10px 0'}} />
      {info?.extract && <p className="small" style={{lineHeight:1.4}}>{info.extract}</p>}
      <div className="small" style={{display:'flex', gap:12}}>
        {info?.wikipedia_url && <a className="link" href={info.wikipedia_url} target="_blank">Wikipedia</a>}
        {info?.google_search_url && <a className="link" href={info.google_search_url} target="_blank">Google Search</a>}
      </div>
    </div>
  )
}
