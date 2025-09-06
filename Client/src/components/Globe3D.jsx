import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'

// ---------- helpers ----------
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

export default function Globe3D({ orbitPoints, satPosition, neighbors, mainName = 'Satellite' }) {
  const containerRef = useRef(null)
  const sceneRef = useRef()
  const rendererRef = useRef()
  const cameraRef = useRef()
  const satRef = useRef()
  const neighborGroupRef = useRef()
  const lineRef = useRef()
  const lineMatRef = useRef()

  // Raycast + tooltip
  const raycasterRef = useRef()
  const mouseRef = useRef(new THREE.Vector2())
  const tooltipRef = useRef()
  const hoverablesRef = useRef([]) // objects to test

  // Build bold orbit line (Line2)
  function buildBoldLine(points) {
    const positions = []
    for (let i = 0; i < points.length; i++) {
      positions.push(points[i].x, points[i].y, points[i].z)
    }
    const geometry = new LineGeometry()
    geometry.setPositions(positions)

    const material = new LineMaterial({
      color: 0xffff00,   // bright yellow
      linewidth: 4,      // px thickness (screen-space)
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

  useEffect(() => {
    const el = containerRef.current

    // Tooltip div
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
    controls.autoRotate = false

    // Lights
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2)
    sunLight.position.set(-30000, 10000, 20000)
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    scene.add(sunLight)

    // Earth
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
    earthGroup.rotation.z = -23.4 * Math.PI / 180

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

    // Main satellite — yellow + halo
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

    // Neighbors
    const neighborGroup = new THREE.Group()
    scene.add(neighborGroup)

    // Raycaster setup
    const raycaster = new THREE.Raycaster()
    raycasterRef.current = raycaster
    hoverablesRef.current = [sat] // neighbors will be added later

    const onPointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      mouseRef.current.set(x, y)

      raycaster.setFromCamera(mouseRef.current, camera)
      // test against current hoverables
      const hits = raycaster.intersectObjects(hoverablesRef.current, true)
      if (hits.length > 0) {
        let obj = hits[0].object
        // if sprite/child was hit, climb to the parent with userData.name if present
        while (obj && !obj.userData?.name && obj.parent) obj = obj.parent
        const name = obj?.userData?.name
        if (name) {
          tooltipRef.current.textContent = name
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

    // Save refs
    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera
    satRef.current = sat
    neighborGroupRef.current = neighborGroup

    // Resize + update line material resolution
    const onResize = () => {
      const w = el.clientWidth, h = el.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      if (lineMatRef.current) lineMatRef.current.resolution.set(w, h)
    }
    window.addEventListener('resize', onResize)

    // Render loop
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
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      tooltipRef.current && el.removeChild(tooltipRef.current)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      geometry.dispose()
      earthMat.dispose()
      lightsMat.dispose()
      cloudsMat.dispose()
      glowMesh.material.dispose()
      satGeom.dispose()
      satMat.dispose()
      haloMat.map?.dispose?.()
      if (lineRef.current) {
        lineRef.current.geometry.dispose()
        lineRef.current.material.dispose()
      }
    }
  }, [mainName])

  // Update orbit line
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
      const line = buildBoldLine(orbitPoints)
      lineRef.current = line
      scene.add(line)
    }
  }, [orbitPoints])

  // Update main satellite position
  useEffect(() => {
    if (satPosition && satRef.current) {
      satRef.current.position.set(satPosition.x, satPosition.y, satPosition.z)
    }
  }, [satPosition])

  // Update neighbors (bigger) + bind names for hover
  useEffect(() => {
    const ng = neighborGroupRef.current
    if (!ng) return
    // clear old
    while (ng.children.length) {
      const c = ng.children.pop()
      c.geometry?.dispose?.()
      c.material?.dispose?.()
    }

    const hoverables = hoverablesRef.current || []
    // Keep only the main sat in hoverables; we'll re-add neighbors
    hoverablesRef.current = hoverables.filter(o => o === satRef.current)

    if (!neighbors || !neighbors.length) return

    const mat = new THREE.MeshBasicMaterial({ color: 0xff5c5c })
    for (const n of neighbors.slice(0, 80)) {
      const g = new THREE.SphereGeometry(80, 12, 12) // larger neighbors
      const m = new THREE.Mesh(g, mat)
      m.position.set(n.x, n.y, n.z)
      m.userData = { name: n.name || 'Neighbor' }
      ng.add(m)
      hoverablesRef.current.push(m)
    }
  }, [neighbors])

  return <div id="globe-container" className="card" ref={containerRef}></div>
}
