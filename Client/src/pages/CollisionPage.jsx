import React from 'react'
import CollisionPredictor from '../components/CollisionPredictor'

export default function CollisionPage() {
  return (
    <div className="container">
      <div className="header">
        <h2> Collision Predictor</h2>
        <p className="small">
          Enter a satellite name to check potential conjunctions with its 5 nearest satellites.
        </p>
      </div>
      <CollisionPredictor />
    </div>
  )
}
