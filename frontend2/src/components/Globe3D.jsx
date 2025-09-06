// import React, { useEffect, useRef } from 'react'
// import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// // Helper to build a line from an array of {x,y,z}
// function buildLine(points){
//   const geometry = new THREE.BufferGeometry()
//   const arr = new Float32Array(points.length * 3)
//   for(let i=0;i<points.length;i++){
//     arr[i*3+0] = points[i].x
//     arr[i*3+1] = points[i].y
//     arr[i*3+2] = points[i].z
//   }
//   geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3))
//   const material = new THREE.LineBasicMaterial({ linewidth: 1 })
//   const line = new THREE.Line(geometry, material)
//   return { line, geometry }
// }

// export default function Globe3D({ orbitPoints, satPosition, neighbors }){
//   const containerRef = useRef(null)
//   const sceneRef = useRef()
//   const lineRef = useRef()
//   const satMeshRef = useRef()
//   const neighborGroupRef = useRef()
//   const rendererRef = useRef()
//   const cameraRef = useRef()
//   const earthRef = useRef()

//   useEffect(()=>{
//     const el = containerRef.current
//     const scene = new THREE.Scene()
//     scene.background = new THREE.Color('#0b1020')

//     const camera = new THREE.PerspectiveCamera(45, el.clientWidth/el.clientHeight, 1, 100000)
//     camera.position.set(0, -16000, 8000)

//     const renderer = new THREE.WebGLRenderer({ antialias: true })
//     renderer.setSize(el.clientWidth, el.clientHeight)
//     el.appendChild(renderer.domElement)

//     const controls = new OrbitControls(camera, renderer.domElement)
//     controls.enableDamping = true

//     // Lights
//     scene.add(new THREE.AmbientLight(0xffffff, 0.6))
//     const dir = new THREE.DirectionalLight(0xffffff, 0.8)
//     dir.position.set(-10000, 0, 5000)
//     scene.add(dir)

//     // Earth
//     const EARTH_RADIUS = 6371 // km
//     const geom = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64)
//     const tex = new THREE.TextureLoader().load('https://raw.githubusercontent.com/treverix/threejs-earth-textures/master/2_no_clouds_4k.jpg')
//     tex.anisotropy = 4
//     const mat = new THREE.MeshPhongMaterial({ map: tex })
//     const earth = new THREE.Mesh(geom, mat)
//     scene.add(earth)

//     // Satellite mesh
//     const satGeom = new THREE.SphereGeometry(60, 16, 16) // ~60 km radius for visibility
//     const satMat = new THREE.MeshPhongMaterial({ color: 0xffee88, emissive: 0x222200 })
//     const sat = new THREE.Mesh(satGeom, satMat)
//     scene.add(sat)

//     // Neighbor group
//     const ng = new THREE.Group()
//     scene.add(ng)

//     sceneRef.current = scene
//     rendererRef.current = renderer
//     cameraRef.current = camera
//     earthRef.current = earth
//     satMeshRef.current = sat
//     neighborGroupRef.current = ng

//     const onResize = ()=>{
//       const w = el.clientWidth, h = el.clientHeight
//       renderer.setSize(w, h)
//       camera.aspect = w / h
//       camera.updateProjectionMatrix()
//     }
//     window.addEventListener('resize', onResize)

//     let raf
//     const tick = ()=>{
//       controls.update()
//       renderer.render(scene, camera)
//       raf = requestAnimationFrame(tick)
//     }
//     tick()

//     return ()=>{
//       cancelAnimationFrame(raf)
//       window.removeEventListener('resize', onResize)
//       renderer.dispose()
//       el.removeChild(renderer.domElement)
//     }
//   }, [])

//   // Update orbit line
//   useEffect(()=>{
//     const scene = sceneRef.current
//     if(!scene) return

//     if(lineRef.current){
//       scene.remove(lineRef.current)
//       lineRef.current.geometry.dispose()
//       // material auto disposed with GC
//       lineRef.current = null
//     }
//     if(orbitPoints && orbitPoints.length){
//       const { line } = buildLine(orbitPoints)
//       line.material.color = new THREE.Color('#67d4ff')
//       lineRef.current = line
//       scene.add(line)
//     }
//   }, [orbitPoints])

//   // Update satellite + neighbors
//   useEffect(()=>{
//     if(satPosition && satMeshRef.current){
//       satMeshRef.current.position.set(satPosition.x, satPosition.y, satPosition.z)
//     }
//   }, [satPosition])

//   useEffect(()=>{
//     const ng = neighborGroupRef.current
//     if(!ng) return
//     // Clear old
//     while(ng.children.length){
//       const child = ng.children.pop()
//       if(child.geometry) child.geometry.dispose()
//       if(child.material) child.material.dispose()
//     }
//     if(!neighbors || !neighbors.length) return

//     const mat = new THREE.MeshBasicMaterial({ color: 0xff5c5c })
//     for(const n of neighbors.slice(0,50)){
//       const g = new THREE.SphereGeometry(40, 8, 8)
//       const m = new THREE.Mesh(g, mat)
//       m.position.set(n.x, n.y, n.z)
//       ng.add(m)
//     }
//   }, [neighbors])

//   return <div id="globe-container" className="card" ref={containerRef}></div>
// }



import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// Helper to build a line from an array of {x,y,z}
function buildLine(points){
  const geometry = new THREE.BufferGeometry()
  const arr = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++){
    arr[i*3+0] = points[i].x
    arr[i*3+1] = points[i].y
    arr[i*3+2] = points[i].z
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  const material = new THREE.LineBasicMaterial({ linewidth: 1, color: 0x67d4ff })
  return new THREE.Line(geometry, material)
}

export default function Globe3D({ orbitPoints, satPosition, neighbors }){
  const containerRef = useRef(null)
  const sceneRef = useRef()
  const lineRef = useRef()
  const satMeshRef = useRef()
  const neighborGroupRef = useRef()
  const rendererRef = useRef()
  const cameraRef = useRef()
  const earthGroupRef = useRef()

  useEffect(() => {
    const el = containerRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0000FF')

    const camera = new THREE.PerspectiveCamera(45, el.clientWidth/el.clientHeight, 1, 200000)
    camera.position.set(0, -18000, 9000)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(el.clientWidth, el.clientHeight)
    // color management for realistic textures
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 6800
    controls.maxDistance = 60000

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(-30000, 10000, 20000)
    scene.add(sun)

    // ---- Realistic Earth ----
    const EARTH_RADIUS = 6371 // km

    const loader = new THREE.TextureLoader()
    // Use local /public textures (recommended) or replace with URLs
    const dayTex     = loader.load('/textures/earth_day.jpg');     dayTex.colorSpace = THREE.SRGBColorSpace
    const specTex    = loader.load('/textures/earth_spec.jpg')
    const normalTex  = loader.load('/textures/earth_normal.jpg')   // or bump map
    const cloudsTex  = loader.load('/textures/earth_clouds.png');  cloudsTex.colorSpace = THREE.SRGBColorSpace
    const starsTex   = loader.load('/textures/stars_2048.jpg');    starsTex.colorSpace = THREE.SRGBColorSpace

    // Earth surface (Phong for specular highlights on oceans)
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 96, 96)
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTex,
      specularMap: specTex,
      specular: new THREE.Color(0x333333),
      shininess: 18,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(1.0, 1.0)
      // If you only have a bump map, use: bumpMap: bumpTex, bumpScale: 6
    })
    const earthMesh = new THREE.Mesh(earthGeo, earthMat)

    // Cloud layer (slightly bigger radius, transparent)
    const cloudsGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.004, 96, 96)
    const cloudsMat = new THREE.MeshLambertMaterial({
      map: cloudsTex,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat)

    // Atmosphere glow (subtle)
    const atmGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.02, 64, 64)
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x3aa7ff,
      transparent: true,
      opacity: 0.07,
      side: THREE.BackSide
    })
    const atmMesh = new THREE.Mesh(atmGeo, atmMat)

    // Group the earth components so we can rotate them together
    const earthGroup = new THREE.Group()
    earthGroup.add(earthMesh)
    earthGroup.add(cloudsMesh)
    earthGroup.add(atmMesh)
    scene.add(earthGroup)

    // Starfield (big inside-out sphere)
    const starsGeo = new THREE.SphereGeometry(120000, 32, 32)
    const starsMat = new THREE.MeshBasicMaterial({ map: starsTex, side: THREE.BackSide })
    const starfield = new THREE.Mesh(starsGeo, starsMat)
    scene.add(starfield)

    // Satellite marker
    const satGeom = new THREE.SphereGeometry(60, 16, 16)
    const satMat  = new THREE.MeshPhongMaterial({ color: 0xffe58a, emissive: 0x332200 })
    const sat = new THREE.Mesh(satGeom, satMat)
    scene.add(sat)

    // Neighbor markers (red)
    const neighborGroup = new THREE.Group()
    scene.add(neighborGroup)

    // Save refs
    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera
    satMeshRef.current = sat
    neighborGroupRef.current = neighborGroup
    earthGroupRef.current = earthGroup

    // Resize
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    let raf
    const tick = () => {
      // Slow rotation for day/night feel
      earthGroup.rotation.y += 0.00015
      cloudsMesh.rotation.y += 0.00022

      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [])

  // Update orbit line
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (lineRef.current){
      scene.remove(lineRef.current)
      lineRef.current.geometry.dispose()
      lineRef.current.material.dispose()
      lineRef.current = null
    }
    if (orbitPoints?.length){
      const line = buildLine(orbitPoints)
      lineRef.current = line
      scene.add(line)
    }
  }, [orbitPoints])

  // Update satellite position
  useEffect(() => {
    if (satPosition && satMeshRef.current){
      satMeshRef.current.position.set(satPosition.x, satPosition.y, satPosition.z)
    }
  }, [satPosition])

  // Update neighbors
  useEffect(() => {
    const ng = neighborGroupRef.current
    if (!ng) return
    while (ng.children.length){
      const child = ng.children.pop()
      child.geometry?.dispose?.()
      child.material?.dispose?.()
    }
    if (!neighbors?.length) return
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5c5c })
    for (const n of neighbors.slice(0, 80)){
      const g = new THREE.SphereGeometry(40, 8, 8)
      const m = new THREE.Mesh(g, mat)
      m.position.set(n.x, n.y, n.z)
      ng.add(m)
    }
  }, [neighbors])

  return <div id="globe-container" className="card" ref={containerRef}></div>
}
