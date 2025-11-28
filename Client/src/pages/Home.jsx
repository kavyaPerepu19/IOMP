
// import React from 'react'
// import { Link } from 'react-router-dom'

// export default function Home() {
//   return (
//     <div className="container">
//       <div className="card" style={{marginTop:12}}>
//         <h2 style={{marginTop:0}}>Welcome 👋</h2>
//         <p className="small" style={{lineHeight:1.5}}>
//           Use the <strong>Track</strong> page to search a satellite (e.g., <em>ISS (ZARYA)</em>), visualize the orbit,
//           see current position & altitude, and explore nearby satellites.
//         </p>
//         <p>
//           <Link to="/track" className="link">Go to Tracker →</Link>
//         </p>
//       </div>
//     </div>
//   )
// }


import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div
      style={{
        padding: "40px 20px",
        maxWidth: "900px",
        margin: "0 auto",
        textAlign: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Hero Section */}
      <div
        style={{
          background: "linear-gradient(135deg, #0d1b3d, #1a2a6c)",
          padding: "40px 30px",
          borderRadius: "14px",
          color: "white",
          boxShadow: "0px 6px 20px rgba(0,0,0,0.2)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "2.2rem" }}>
          🛰 Satellite Tracking & Collision Prediction
        </h1>
        <p style={{ marginTop: "15px", fontSize: "1.1rem", opacity: 0.9 }}>
          Visualize real‑time satellite orbits, run SGP4 predictions, explore
          nearby satellites, and estimate potential collision risks — all in one
          simple, interactive platform.
        </p>

        {/* Hero Image */}
        <img
          src="https://www.aac-clyde.space/wp-content/uploads/2021/10/GettyImages-181075945.jpg"
          alt="satellite orbit"
          style={{
            marginTop: "25px",
            width: "85%",
            borderRadius: "12px",
            boxShadow: "0px 4px 14px rgba(0,0,0,0.3)",
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ marginTop: "35px" }}>
        <h2>Get Started</h2>

        <p style={{ fontSize: "1rem", marginBottom: "20px" }}>
          Choose one of the tools below to begin your exploration.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/track"
            style={{
              padding: "12px 20px",
              background: "#1a2a6c",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
              boxShadow: "0px 4px 14px rgba(0,0,0,0.2)",
            }}
          >
            🚀 Track a Satellite
          </Link>

          <Link
            to="/predict"
            style={{
              padding: "12px 20px",
              background: "#4c669f",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
              boxShadow: "0px 4px 14px rgba(0,0,0,0.2)",
            }}
          >
            ⚠️ Predict Collision Risk
          </Link>
        </div>
      </div>

      {/* Footer Section */}
      <div style={{ marginTop: "40px", opacity: 0.6 }}>
        <p style={{ fontSize: "0.9rem" }}>
          Built with React • SGP4 • CelesTrak API • 3D Globe Visualization
        </p>
      </div>
    </div>
  );
}