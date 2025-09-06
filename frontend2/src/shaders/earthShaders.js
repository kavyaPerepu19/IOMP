// frontend/src/shaders/earthShaders.js
export const earthVertex = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const earthFragment = /* glsl */`
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uSpec;
  uniform sampler2D uNormalMap;

  uniform vec3 uLightDir;   // normalized, world space (direction FROM sun to earth surface)
  uniform vec3 uCameraPos;  // world space
  uniform float uGloss;     // spec power
  uniform float uSpecBoost; // spec intensity

  // Simple normal mapping in tangent-less space using world-space perturbation
  // (cheap and not physically perfect, but handsome)
  vec3 perturbNormal(vec3 N, vec3 pos) {
    // build an arbitrary TBN from world position
    vec3 dp1 = dFdx(pos);
    vec3 dp2 = dFdy(pos);
    vec3 S = normalize(dp1);
    vec3 T = normalize(dp2);
    vec3 B = normalize(cross(N, S));
    S = cross(B, N);

    // normal map in tangent space
    vec3 n = texture2D(uNormalMap, vec2(
      atan(pos.z, pos.x) / (2.0*3.1415926) + 0.5,
      asin(pos.y / length(pos)) / 3.1415926 + 0.5
    )).xyz * 2.0 - 1.0;

    // dampen strength (reduce seams)
    n.xy *= 0.5; 
    vec3 Np = normalize(n.x * S + n.y * T + n.z * N);
    return Np;
  }

  // Spherical UVs from world position (avoids seams moving with camera)
  vec2 sphUV(vec3 p) {
    float lon = atan(p.z, p.x); // [-PI, PI]
    float lat = asin(clamp(p.y / length(p), -1.0, 1.0));
    return vec2(lon / (2.0*3.1415926) + 0.5, lat / 3.1415926 + 0.5);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(-uLightDir); // light TO surface
    vec3 V = normalize(uCameraPos - vWorldPos);

    // UV from world-space position (stable)
    vec2 uv = sphUV(vWorldPos);

    // Textures
    vec3 day   = texture2D(uDay,   uv).rgb;
    vec3 night = texture2D(uNight, uv).rgb;
    float specMask = texture2D(uSpec, uv).r;

    // Simple normal perturb
    vec3 Np = perturbNormal(N, vWorldPos);

    float ndl = max(dot(Np, L), 0.0);

    // Day-night mix with smooth terminator
    float k = smoothstep(-0.15, 0.15, ndl);        // soften edge
    vec3 baseColor = mix(night, day, k);

    // Diffuse
    vec3 diffuse = baseColor * ndl;

    // Specular (ocean) — only on lit side
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(Np, H), 0.0), uGloss) * specMask * ndl;
    vec3 specCol = vec3(spec) * uSpecBoost;

    // Ambient (space) fill to avoid pure black
    vec3 ambient = baseColor * 0.08;

    vec3 color = ambient + diffuse + specCol;

    // Output (approx sRGB)
    color = pow(color, vec3(1.0/2.2));
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const atmosphereVertex = /* glsl */`
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmosphereFragment = /* glsl */`
  precision highp float;
  varying vec3 vNormal;
  uniform vec3 uColor;
  void main() {
    // rim glow based on view-facing backface
    float a = pow(1.0 - max(vNormal.z, 0.0), 2.0);
    gl_FragColor = vec4(uColor, a * 0.45);
  }
`;
