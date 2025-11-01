import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'

// ---------- Fresnel glow for Earth limb ----------
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
      vReflectionFactor =
        fresnelBias +
        fresnelScale *
        pow(1.0 + dot(normalize(I), worldNormal), fresnelPower);
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

// ---------- Starfield backdrop ----------
function getStarfield({ numStars = 2000 } = {}) {
  function randomSpherePoint() {
    // random shell between radius 25..50 (scene units)
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

// ---------- helper: lat/lon -> Earth-fixed xyz ----------
function latLonToECEF(latDeg, lonDeg, radiusKm) {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  return {
    x: radiusKm * Math.cos(lat) * Math.cos(lon),
    y: radiusKm * Math.cos(lat) * Math.sin(lon),
    z: radiusKm * Math.sin(lat),
  }
}

export default function Globe3D({
  orbitPoints,
  satPosition,
  neighbors,
  mainName = 'Satellite',
  maxNeighbors = 80,
  showInsat = false, // <--- only true if user searched INSAT
}) {
  const containerRef = useRef(null)
  const sceneRef = useRef()
  const rendererRef = useRef()
  const cameraRef = useRef()
  const satRef = useRef()
  const neighborGroupRef = useRef()
  const insatGroupRef = useRef()
  const lineRef = useRef()
  const lineMatRef = useRef()

  // interaction refs
  const raycasterRef = useRef()
  const mouseRef = useRef(new THREE.Vector2())
  const tooltipRef = useRef()
  const hoverablesRef = useRef([])

  // ---------- build orbit line with altitude clamp ----------
  function buildBoldLine(points) {
    const EARTH_R = 6371 // km
    const MAX_DISPLAY_ALT = 2000 // km cap for visualization

    if (!points || points.length < 2) return null

    // approximate orbit altitude from first point
    const { x: x0, y: y0, z: z0 } = points[0]
    const r0 = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0)
    const realAlt = r0 - EARTH_R

    const displayAlt = Math.min(realAlt, MAX_DISPLAY_ALT)
    const displayRadius = EARTH_R + displayAlt

    const positions = []
    for (let i = 0; i < points.length; i++) {
      const { x, y, z } = points[i]
      const r = Math.sqrt(x * x + y * y + z * z)
      if (r === 0) continue
      const scale = displayRadius / r
      positions.push(x * scale, y * scale, z * scale)
    }

    const geometry = new LineGeometry()
    geometry.setPositions(positions)

    const material = new LineMaterial({
      color: 0xffff00,
      linewidth: 4,
      transparent: true,
      opacity: 0.95,
      dashed: false,
    })

    const renderer = rendererRef.current
    if (renderer) {
      const size = renderer.getSize(new THREE.Vector2())
      material.resolution.set(size.x, size.y)
    } else {
      material.resolution.set(window.innerWidth, window.innerHeight)
    }

    const line = new Line2(geometry, material)
    line.computeLineDistances()
    lineMatRef.current = material
    return line
  }

  // ---------- init scene (runs once) ----------
  useEffect(() => {
    const el = containerRef.current

    // tooltip div overlay
    const tip = document.createElement('div')
    tip.style.position = 'absolute'
    tip.style.pointerEvents = 'none'
    tip.style.background = 'rgba(10,12,20,0.9)'
    tip.style.color = '#fff'
    tip.style.padding = '4px 8px'
    tip.style.border = '1px solid #2a335b'
    tip.style.borderRadius = '8px'
    tip.style.fontSize = '12px'
    tip.style.whiteSpace = 'nowrap'
    tip.style.transform = 'translate(8px, 8px)'
    tip.style.zIndex = '10'
    tip.style.display = 'none'
    el.style.position = 'relative'
    el.appendChild(tip)
    tooltipRef.current = tip

    // scene / camera / renderer
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b1020')

    const camera = new THREE.PerspectiveCamera(
      45,
      el.clientWidth / el.clientHeight,
      1,
      200000
    )
    camera.position.set(0, -18000, 9000)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    el.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 6800   // ~just above Earth radius
    controls.maxDistance = 80000
    controls.autoRotate = false

    // lighting
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2)
    sunLight.position.set(-30000, 10000, 20000)
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    scene.add(sunLight)

    // Earth + atmosphere layers
    const EARTH_R = 6371
    const segs = 128
    const earthGeo = new THREE.SphereGeometry(EARTH_R, segs, segs)
    const loader = new THREE.TextureLoader()

    const dayMap = loader.load(
      '/textures/00_earthmap1k.jpg',
      t => (t.colorSpace = THREE.SRGBColorSpace)
    )
    const lightsMap = loader.load(
      '/textures/03_earthlights1k.jpg',
      t => (t.colorSpace = THREE.SRGBColorSpace)
    )
    const cloudsMap = loader.load(
      '/textures/04_earthcloudmap.jpg',
      t => (t.colorSpace = THREE.SRGBColorSpace)
    )
    const specMap = loader.load('/textures/02_earthspec1k.jpg')
    const bumpMap = loader.load('/textures/01_earthbump1k.jpg')
    const alphaMap = loader.load('/textures/05_earthcloudmaptrans.jpg')

    const earthGroup = new THREE.Group()
    earthGroup.rotation.z = (-23.4 * Math.PI) / 180 // axial tilt

    const earthMat = new THREE.MeshPhongMaterial({
      map: dayMap,
      specularMap: specMap,
      bumpMap,
      bumpScale: 6.0,
      shininess: 18,
    })
    const earthMesh = new THREE.Mesh(earthGeo, earthMat)
    earthGroup.add(earthMesh)

    const lightsMat = new THREE.MeshBasicMaterial({
      map: lightsMap,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
    const lightsMesh = new THREE.Mesh(earthGeo, lightsMat)
    earthGroup.add(lightsMesh)

    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsMap,
      alphaMap,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const cloudsMesh = new THREE.Mesh(earthGeo, cloudsMat)
    cloudsMesh.scale.setScalar(1.003)
    earthGroup.add(cloudsMesh)

    const glowMesh = new THREE.Mesh(earthGeo, getFresnelMat())
    glowMesh.scale.setScalar(1.01)
    earthGroup.add(glowMesh)

    scene.add(earthGroup)

    // background stars
    const stars = getStarfield({ numStars: 2000 })
    scene.add(stars)

    // main tracked satellite marker (yellow)
    const satGeom = new THREE.SphereGeometry(120, 24, 24)
    const satMat = new THREE.MeshPhongMaterial({
      color: 0xffee00,
      emissive: 0x664400,
      emissiveIntensity: 1.2,
      shininess: 90,
    })
    const sat = new THREE.Mesh(satGeom, satMat)
    sat.userData = { name: mainName || 'Satellite' }

    const haloMat = new THREE.SpriteMaterial({
      map: new THREE.TextureLoader().load('/textures/stars/circle.png'),
      color: 0xfff066,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const halo = new THREE.Sprite(haloMat)
    halo.scale.set(850, 850, 1)
    sat.add(halo)

    scene.add(sat)

    // neighbor satellites container (red dots)
    const neighborGroup = new THREE.Group()
    scene.add(neighborGroup)

    // INSAT container (orange marker near India)
    const insatGroup = new THREE.Group()
    scene.add(insatGroup)

    // hover interaction
    const raycaster = new THREE.Raycaster()
    raycasterRef.current = raycaster
    hoverablesRef.current = [sat] // we'll add INSAT + neighbors later

    const onPointerMove = e => {
      const rect = renderer.domElement.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      mouseRef.current.set(x, y)

      raycaster.setFromCamera(mouseRef.current, camera)
      const hits = raycaster.intersectObjects(hoverablesRef.current, true)

      if (hits.length > 0) {
        let obj = hits[0].object
        // climb to parent with userData.name
        while (obj && !obj.userData?.name && obj.parent) obj = obj.parent
        const nm = obj?.userData?.name
        if (nm) {
          tooltipRef.current.textContent = nm
          tooltipRef.current.style.left = `${e.clientX - rect.left}px`
          tooltipRef.current.style.top = `${e.clientY - rect.top}px`
          tooltipRef.current.style.display = 'block'
          renderer.domElement.style.cursor = 'pointer'
          return
        }
      }

      tooltipRef.current.style.display = 'none'
      renderer.domElement.style.cursor = 'default'
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove)

    // save refs
    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera
    satRef.current = sat
    neighborGroupRef.current = neighborGroup
    insatGroupRef.current = insatGroup

    // INITIAL INSAT DRAW (only if showInsat prop true at mount)
    if (showInsat) {
      const EARTH_R_KM = 6371
      const INSAT_OFFSET_KM = 200 // just above Earth for visibility
      const insatLatDeg = 5      // a little north of equator so it "sits on India"
      const insatLonDeg = 83     // ~central India longitude

      const pos = latLonToECEF(
        insatLatDeg,
        insatLonDeg,
        EARTH_R_KM + INSAT_OFFSET_KM
      )

      const insatMat = new THREE.MeshBasicMaterial({ color: 0xff9900 })
      const insatGeom = new THREE.SphereGeometry(140, 16, 16)
      const insatMesh = new THREE.Mesh(insatGeom, insatMat)
      insatMesh.position.set(pos.x, pos.y, pos.z)
      insatMesh.userData = { name: 'INSAT (India GEO Slot)' }

      const insatHaloMat = new THREE.SpriteMaterial({
        map: new THREE.TextureLoader().load('/textures/stars/circle.png'),
        color: 0xffcc66,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const insatHalo = new THREE.Sprite(insatHaloMat)
      insatHalo.scale.set(700, 700, 1)
      insatMesh.add(insatHalo)

      insatGroup.add(insatMesh)
      hoverablesRef.current.push(insatMesh)
    }

    // resize handling
    const onResize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      if (lineMatRef.current) {
        lineMatRef.current.resolution.set(w, h)
      }
    }
    window.addEventListener('resize', onResize)

    // render loop
    let raf
    const tick = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    // cleanup
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)

      tooltipRef.current && el.removeChild(tooltipRef.current)

      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)

      earthGeo.dispose()
      earthMat.dispose()
      lightsMat.dispose()
      cloudsMat.dispose()
      glowMesh.material.dispose()
      satGeom.dispose()
      satMat.dispose()
      haloMat.map?.dispose?.()

      // cleanup insat children
      while (insatGroup.children.length) {
        const obj = insatGroup.children.pop()
        obj.geometry?.dispose?.()
        obj.material?.dispose?.()
      }

      if (lineRef.current) {
        lineRef.current.geometry.dispose()
        lineRef.current.material.dispose()
      }
    }
  }, [mainName, showInsat])

  // ---------- orbit line update when orbitPoints change ----------
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // remove old
    if (lineRef.current) {
      scene.remove(lineRef.current)
      lineRef.current.geometry.dispose()
      lineRef.current.material.dispose()
      lineRef.current = null
    }

    if (orbitPoints && orbitPoints.length) {
      const line = buildBoldLine(orbitPoints)
      if (line) {
        lineRef.current = line
        scene.add(line)
      }
    }
  }, [orbitPoints])

  // ---------- update main satellite position ----------
  useEffect(() => {
    if (satPosition && satRef.current) {
      satRef.current.position.set(satPosition.x, satPosition.y, satPosition.z)
    }
  }, [satPosition])

  // ---------- update neighbor dots whenever neighbor list or maxNeighbors changes ----------
  useEffect(() => {
    const ng = neighborGroupRef.current
    if (!ng) return

    // clear old neighbor meshes
    while (ng.children.length) {
      const c = ng.children.pop()
      c.geometry?.dispose?.()
      c.material?.dispose?.()
    }

    // rebuild hoverables list:
    // keep main sat and any INSAT meshes already in scene
    const hoverables = hoverablesRef.current || []
    hoverablesRef.current = hoverables.filter(o => {
      if (o === satRef.current) return true
      if (!insatGroupRef.current) return false
      return insatGroupRef.current.children.includes(o)
    })

    if (!neighbors || !neighbors.length) return

    const mat = new THREE.MeshBasicMaterial({ color: 0xff5c5c })
    const cap = (typeof maxNeighbors === 'number' ? maxNeighbors : 80)

    for (const n of neighbors.slice(0, cap)) {
      const g = new THREE.SphereGeometry(80, 12, 12)
      const m = new THREE.Mesh(g, mat)
      m.position.set(n.x, n.y, n.z)
      m.userData = { name: n.name || 'Neighbor' }
      ng.add(m)
      hoverablesRef.current.push(m)
    }
  }, [neighbors, maxNeighbors])

  return <div id="globe-container" className="card" ref={containerRef}></div>
}
