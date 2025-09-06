// // frontend/src/components/Globe3D.jsx
// import React, { useEffect, useRef } from 'react'
// import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// // ---------- helpers ----------
// function buildLine(points) {
//   const g = new THREE.BufferGeometry()
//   const arr = new Float32Array(points.length * 3)
//   for (let i = 0; i < points.length; i++) {
//     arr[i * 3 + 0] = points[i].x
//     arr[i * 3 + 1] = points[i].y
//     arr[i * 3 + 2] = points[i].z
//   }
//   g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
//   return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x67d4ff }))
// }

// // Fresnel atmosphere shader (inline, no extra files)
// function getFresnelMat({ rimHex = 0x0088ff, facingHex = 0x000000 } = {}) {
//   const uniforms = {
//     color1: { value: new THREE.Color(rimHex) },
//     color2: { value: new THREE.Color(facingHex) },
//     fresnelBias: { value: 0.1 },
//     fresnelScale: { value: 1.0 },
//     fresnelPower: { value: 4.0 },
//   }
//   const vs = `
//     uniform float fresnelBias;
//     uniform float fresnelScale;
//     uniform float fresnelPower;
//     varying float vReflectionFactor;
//     void main() {
//       vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
//       vec4 worldPosition = modelMatrix * vec4(position, 1.0);
//       vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
//       vec3 I = worldPosition.xyz - cameraPosition;
//       vReflectionFactor = fresnelBias + fresnelScale * pow(1.0 + dot(normalize(I), worldNormal), fresnelPower);
//       gl_Position = projectionMatrix * mvPosition;
//     }
//   `
//   const fs = `
//     uniform vec3 color1;
//     uniform vec3 color2;
//     varying float vReflectionFactor;
//     void main() {
//       float f = clamp(vReflectionFactor, 0.0, 1.0);
//       gl_FragColor = vec4(mix(color2, color1, vec3(f)), f);
//     }
//   `
//   return new THREE.ShaderMaterial({
//     uniforms,
//     vertexShader: vs,
//     fragmentShader: fs,
//     transparent: true,
//     blending: THREE.AdditiveBlending,
//   })
// }

// // Simple starfield of point sprites
// function getStarfield({ numStars = 2000 } = {}) {
//   function randomSpherePoint() {
//     const radius = Math.random() * 25 + 25
//     const u = Math.random()
//     const v = Math.random()
//     const theta = 2 * Math.PI * u
//     const phi = Math.acos(2 * v - 1)
//     const x = radius * Math.sin(phi) * Math.cos(theta)
//     const y = radius * Math.sin(phi) * Math.sin(theta)
//     const z = radius * Math.cos(phi)
//     return { pos: new THREE.Vector3(x, y, z), hue: 0.6 }
//   }
//   const verts = []
//   const colors = []
//   for (let i = 0; i < numStars; i++) {
//     const { pos, hue } = randomSpherePoint()
//     const col = new THREE.Color().setHSL(hue, 0.2, Math.random())
//     verts.push(pos.x, pos.y, pos.z)
//     colors.push(col.r, col.g, col.b)
//   }
//   const geo = new THREE.BufferGeometry()
//   geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
//   geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
//   const mat = new THREE.PointsMaterial({
//     size: 0.2,
//     vertexColors: true,
//     map: new THREE.TextureLoader().load('/textures/stars/circle.png'),
//     transparent: true,
//     depthWrite: false,
//   })
//   return new THREE.Points(geo, mat)
// }

// // ---------- component ----------
// export default function Globe3D({ orbitPoints, satPosition, neighbors }) {
//   const containerRef = useRef(null)
//   const sceneRef = useRef()
//   const rendererRef = useRef()
//   const cameraRef = useRef()
//   const lineRef = useRef()
//   const satRef = useRef()
//   const neighborGroupRef = useRef()
//   const earthGroupRef = useRef()

//   useEffect(() => {
//     const el = containerRef.current
//     const scene = new THREE.Scene()
//     scene.background = new THREE.Color('#0b1020')

//     const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 1, 200000)
//     camera.position.set(0, -18000, 9000)

//     const renderer = new THREE.WebGLRenderer({ antialias: true })
//     renderer.setSize(el.clientWidth, el.clientHeight)
//     renderer.outputColorSpace = THREE.SRGBColorSpace
//     renderer.toneMapping = THREE.ACESFilmicToneMapping
//     el.appendChild(renderer.domElement)

//     const controls = new OrbitControls(camera, renderer.domElement)
//     controls.enableDamping = true
//     controls.minDistance = 6800
//     controls.maxDistance = 80000

//     // Lights
//     const sunLight = new THREE.DirectionalLight(0xffffff, 1.2)
//     sunLight.position.set(-30000, 10000, 20000)
//     scene.add(new THREE.AmbientLight(0xffffff, 0.35))
//     scene.add(sunLight)

//     // --- threejs-earth style globe ---
//     const EARTH_R = 6371 // km scale consistent with your app
//     const segs = 128
//     const geometry = new THREE.SphereGeometry(EARTH_R, segs, segs)
//     const loader = new THREE.TextureLoader()

//     const dayMap = loader.load('/textures/00_earthmap1k.jpg')
//     dayMap.colorSpace = THREE.SRGBColorSpace

//     const lightsMap = loader.load('/textures/03_earthlights1k.jpg')
//     lightsMap.colorSpace = THREE.SRGBColorSpace

//     const cloudsMap = loader.load('/textures/04_earthcloudmap.jpg')
//     cloudsMap.colorSpace = THREE.SRGBColorSpace

//     const earthMat = new THREE.MeshPhongMaterial({
//       map: dayMap,
//       specularMap: loader.load('/textures/02_earthspec1k.jpg'),
//       bumpMap: loader.load('/textures/01_earthbump1k.jpg'),
//       bumpScale: 6.0, // tweak if you want subtler mountains
//       shininess: 18,
//     })

//     const earthGroup = new THREE.Group()
//     earthGroup.rotation.z = -23.4 * Math.PI / 180 // axial tilt

//     const earthMesh = new THREE.Mesh(geometry, earthMat)
//     earthGroup.add(earthMesh)

//     const lightsMat = new THREE.MeshBasicMaterial({
//       map: lightsMap,
//       blending: THREE.AdditiveBlending,
//       transparent: true,
//       depthWrite: false,
//     })
//     const lightsMesh = new THREE.Mesh(geometry, lightsMat)
//     earthGroup.add(lightsMesh)

//     const cloudsMat = new THREE.MeshStandardMaterial({
//       map: cloudsMap,
//       alphaMap: loader.load('/textures/05_earthcloudmaptrans.jpg'),
//       transparent: true,
//       opacity: 0.85,
//       blending: THREE.AdditiveBlending,
//       depthWrite: false,
//     })
//     const cloudsMesh = new THREE.Mesh(geometry, cloudsMat)
//     cloudsMesh.scale.setScalar(1.003)
//     earthGroup.add(cloudsMesh)

//     const glowMesh = new THREE.Mesh(geometry, getFresnelMat())
//     glowMesh.scale.setScalar(1.01)
//     earthGroup.add(glowMesh)

//     scene.add(earthGroup)

//     // Starfield
//     const stars = getStarfield({ numStars: 2000 })
//     scene.add(stars)

//     // Satellite marker
//     const sat = new THREE.Mesh(
//       new THREE.SphereGeometry(60, 16, 16),
//       new THREE.MeshPhongMaterial({ color: 0xffe58a, emissive: 0x332200 })
//     )
//     scene.add(sat)

//     // Neighbors group
//     const neighborGroup = new THREE.Group()
//     scene.add(neighborGroup)

//     // Save refs
//     sceneRef.current = scene
//     rendererRef.current = renderer
//     cameraRef.current = camera
//     satRef.current = sat
//     neighborGroupRef.current = neighborGroup
//     earthGroupRef.current = earthGroup

//     // Resize
//     const onResize = () => {
//       const w = el.clientWidth,
//         h = el.clientHeight
//       renderer.setSize(w, h)
//       camera.aspect = w / h
//       camera.updateProjectionMatrix()
//     }
//     window.addEventListener('resize', onResize)

//     // Render loop
//     let raf
//     const tick = () => {
//       // gentle rotations
//       earthMesh.rotation.y += 0.002
//       lightsMesh.rotation.y += 0.002
//       cloudsMesh.rotation.y += 0.0023
//       glowMesh.rotation.y += 0.002
//       stars.rotation.y -= 0.0002

//       controls.update()
//       renderer.render(scene, camera)
//       raf = requestAnimationFrame(tick)
//     }
//     tick()

//     // Cleanup
//     return () => {
//       cancelAnimationFrame(raf)
//       window.removeEventListener('resize', onResize)
//       renderer.dispose()
//       if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
//       // dispose simple geometries/materials
//       geometry.dispose()
//       earthMat.dispose()
//       lightsMat.dispose()
//       cloudsMat.dispose()
//       glowMesh.material.dispose()
//     }
//   }, [])

//   // Update orbit line when points change
//   useEffect(() => {
//     const scene = sceneRef.current
//     if (!scene) return
//     if (lineRef.current) {
//       scene.remove(lineRef.current)
//       lineRef.current.geometry.dispose()
//       lineRef.current.material.dispose()
//       lineRef.current = null
//     }
//     if (orbitPoints && orbitPoints.length) {
//       lineRef.current = buildLine(orbitPoints)
//       scene.add(lineRef.current)
//     }
//   }, [orbitPoints])

//   // Update satellite position
//   useEffect(() => {
//     if (satPosition && satRef.current) {
//       satRef.current.position.set(satPosition.x, satPosition.y, satPosition.z)
//     }
//   }, [satPosition])

//   // Update neighbor markers
//   useEffect(() => {
//     const ng = neighborGroupRef.current
//     if (!ng) return
//     while (ng.children.length) {
//       const c = ng.children.pop()
//       c.geometry?.dispose?.()
//       c.material?.dispose?.()
//     }
//     if (!neighbors || !neighbors.length) return
//     const mat = new THREE.MeshBasicMaterial({ color: 0xff5c5c })
//     for (const n of neighbors.slice(0, 80)) {
//       const g = new THREE.SphereGeometry(40, 8, 8)
//       const m = new THREE.Mesh(g, mat)
//       m.position.set(n.x, n.y, n.z)
//       ng.add(m)
//     }
//   }, [neighbors])

//   return <div id="globe-container" className="card" ref={containerRef}></div>
// }



// frontend/src/components/Globe3D.jsx
import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// ---------- helpers ----------
function buildLine(points) {
  const g = new THREE.BufferGeometry()
  const arr = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    arr[i * 3 + 0] = points[i].x
    arr[i * 3 + 1] = points[i].y
    arr[i * 3 + 2] = points[i].z
  }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x67d4ff }))
}

// Fresnel atmosphere shader (inline)
function getFresnelMat({ rimHex = 0x0088ff, facingHex = 0x000000 } = {}) {
  const uniforms = {
    color1: { value: new THREE.Color(rimHex) },
    color2: { value: new THREE.Color(facingHex) },
    fresnelBias: { value: 0.1 },
    fresnelScale: { value: 1.0 },
    fresnelPower: { value: 4.0 },
  }
  const vs = `
    uniform float fresnelBias;
    uniform float fresnelScale;
    uniform float fresnelPower;
    varying float vReflectionFactor;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
      vec3 I = worldPosition.xyz - cameraPosition;
      vReflectionFactor = fresnelBias + fresnelScale * pow(1.0 + dot(normalize(I), worldNormal), fresnelPower);
      gl_Position = projectionMatrix * mvPosition;
    }
  `
  const fs = `
    uniform vec3 color1;
    uniform vec3 color2;
    varying float vReflectionFactor;
    void main() {
      float f = clamp(vReflectionFactor, 0.0, 1.0);
      gl_FragColor = vec4(mix(color2, color1, vec3(f)), f);
    }
  `
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vs,
    fragmentShader: fs,
    transparent: true,
    blending: THREE.AdditiveBlending,
  })
}

// Starfield (points)
function getStarfield({ numStars = 2000 } = {}) {
  function randomSpherePoint() {
    const radius = Math.random() * 25 + 25
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    return new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    )
  }
  const verts = []
  const colors = []
  for (let i = 0; i < numStars; i++) {
    const p = randomSpherePoint()
    const col = new THREE.Color().setHSL(0.6, 0.2, Math.random())
    verts.push(p.x, p.y, p.z)
    colors.push(col.r, col.g, col.b)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const mat = new THREE.PointsMaterial({
    size: 0.2,
    vertexColors: true,
    map: new THREE.TextureLoader().load('/textures/stars/circle.png'),
    transparent: true,
    depthWrite: false,
  })
  return new THREE.Points(geo, mat)
}

// ---------- component ----------
export default function Globe3D({ orbitPoints, satPosition, neighbors }) {
  const containerRef = useRef(null)
  const sceneRef = useRef()
  const rendererRef = useRef()
  const cameraRef = useRef()
  const lineRef = useRef()
  const satRef = useRef()
  const neighborGroupRef = useRef()

  useEffect(() => {
    const el = containerRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b1020')

    const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 1, 200000)
    camera.position.set(0, -18000, 9000)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    el.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 6800
    controls.maxDistance = 80000
    controls.autoRotate = false // keep earth stationary

    // Lights
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2)
    sunLight.position.set(-30000, 10000, 20000)
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    scene.add(sunLight)

    // Earth group (axial tilt only; no rotation in tick)
    const EARTH_R = 6371
    const segs = 128
    const geometry = new THREE.SphereGeometry(EARTH_R, segs, segs)
    const loader = new THREE.TextureLoader()

    const dayMap = loader.load('/textures/00_earthmap1k.jpg', t => (t.colorSpace = THREE.SRGBColorSpace))
    const lightsMap = loader.load('/textures/03_earthlights1k.jpg', t => (t.colorSpace = THREE.SRGBColorSpace))
    const cloudsMap = loader.load('/textures/04_earthcloudmap.jpg', t => (t.colorSpace = THREE.SRGBColorSpace))
    const specMap = loader.load('/textures/02_earthspec1k.jpg')
    const bumpMap = loader.load('/textures/01_earthbump1k.jpg')
    const alphaMap = loader.load('/textures/05_earthcloudmaptrans.jpg')

    const earthGroup = new THREE.Group()
    earthGroup.rotation.z = -23.4 * Math.PI / 180 // axial tilt

    const earthMat = new THREE.MeshPhongMaterial({
      map: dayMap,
      specularMap: specMap,
      bumpMap,
      bumpScale: 6.0,
      shininess: 18,
    })
    const earthMesh = new THREE.Mesh(geometry, earthMat)
    earthGroup.add(earthMesh)

    const lightsMat = new THREE.MeshBasicMaterial({
      map: lightsMap,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
    const lightsMesh = new THREE.Mesh(geometry, lightsMat)
    earthGroup.add(lightsMesh)

    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsMap,
      alphaMap,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const cloudsMesh = new THREE.Mesh(geometry, cloudsMat)
    cloudsMesh.scale.setScalar(1.003)
    earthGroup.add(cloudsMesh)

    const glowMesh = new THREE.Mesh(geometry, getFresnelMat())
    glowMesh.scale.setScalar(1.01)
    earthGroup.add(glowMesh)

    scene.add(earthGroup)

    // Starfield
    const stars = getStarfield({ numStars: 2000 })
    scene.add(stars)

    // Satellite marker
    const sat = new THREE.Mesh(
      new THREE.SphereGeometry(60, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0xffe58a, emissive: 0x332200 })
    )
    scene.add(sat)

    // Neighbors group
    const neighborGroup = new THREE.Group()
    scene.add(neighborGroup)

    // Save refs
    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera
    satRef.current = sat
    neighborGroupRef.current = neighborGroup

    // Resize
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // Render loop — NO auto-rotation (earth is stationary)
    let raf
    const tick = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    // Cleanup
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      geometry.dispose()
      earthMat.dispose()
      lightsMat.dispose()
      cloudsMat.dispose()
      glowMesh.material.dispose()
    }
  }, [])

  // Update orbit line when points change
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (lineRef.current) {
      scene.remove(lineRef.current)
      lineRef.current.geometry.dispose()
      lineRef.current.material.dispose()
      lineRef.current = null
    }
    if (orbitPoints && orbitPoints.length) {
      lineRef.current = buildLine(orbitPoints)
      scene.add(lineRef.current)
    }
  }, [orbitPoints])

  // Update satellite position
  useEffect(() => {
    if (satPosition && satRef.current) {
      satRef.current.position.set(satPosition.x, satPosition.y, satPosition.z)
    }
  }, [satPosition])

  // Update neighbor markers
  useEffect(() => {
    const ng = neighborGroupRef.current
    if (!ng) return
    while (ng.children.length) {
      const c = ng.children.pop()
      c.geometry?.dispose?.()
      c.material?.dispose?.()
    }
    if (!neighbors || !neighbors.length) return
    const mat = new THREE.MeshBasicMaterial({ color: 0xff5c5c })
    for (const n of neighbors.slice(0, 80)) {
      const g = new THREE.SphereGeometry(40, 8, 8)
      const m = new THREE.Mesh(g, mat)
      m.position.set(n.x, n.y, n.z)
      ng.add(m)
    }
  }, [neighbors])

  return <div id="globe-container" className="card" ref={containerRef}></div>
}
