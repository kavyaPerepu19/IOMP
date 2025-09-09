import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Stracker from './pages/Stracker'
import CollisionPage from './pages/CollisionPage'
import SimulationPredictor from './components/SimulationPredictor'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/track" element={<Stracker />} />
        <Route path="/predict" element={<CollisionPage />} />
        <Route path='/simulate' element={<SimulationPredictor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
