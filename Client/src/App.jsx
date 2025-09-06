import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Stracker from './pages/Stracker'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/track" element={<Stracker />} />
        {/* redirect any unknown path to /track or home; choose one */}
        <Route path="*" element={<Navigate to="/track" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
