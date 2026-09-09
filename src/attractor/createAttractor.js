import * as THREE from 'three';
import { generateHopalong } from './generateHopalong.js';
import { palettes } from './palettes.js';

export function createAttractor(config) {
  const paletteColors = Object.fromEntries(Object.entries(palettes).map(([name, colors]) =>
    [name, colors.map((hex) => new THREE.Color(hex))]));
  let paletteName = 'Spectrum';
  const { positions, colors } = generateHopalong(config);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      travel: { value: 0 }, depth: { value: config.depth }, pointScale: { value: 600 },
      bass: { value: 0 }, mid: { value: 0 }, treble: { value: 0 }, time: { value: 0 },
      beat: { value: 0 }, energy: { value: 0 },
      palette: { value: palettes.Spectrum.map((hex) => new THREE.Color(hex)) },
    },
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float travel;
      uniform float depth;
      uniform float pointScale;
      uniform float bass;
      uniform float mid;
      uniform float treble;
      uniform float time;
      uniform float beat;
      uniform float energy;
      uniform vec3 palette[6];
      varying vec3 vColor;
      varying float vFade;
      vec3 paletteColor(float phase) {
        float t = fract(phase) * 6.0;
        if (t < 1.0) return mix(palette[0], palette[1], t);
        if (t < 2.0) return mix(palette[1], palette[2], t - 1.0);
        if (t < 3.0) return mix(palette[2], palette[3], t - 2.0);
        if (t < 4.0) return mix(palette[3], palette[4], t - 3.0);
        if (t < 5.0) return mix(palette[4], palette[5], t - 4.0);
        return mix(palette[5], palette[0], t - 5.0);
      }
      void main() {
        vec3 p = position;
        p.z = mod(p.z + travel + depth * 0.5, depth) - depth * 0.5;
        // Small, bounded deformations of the cloud; never alter the XR pose.
        p.y -= 1.6;
        float proximity = smoothstep(1.0, 4.0, length(p));
        p.xy *= 1.0 + proximity * (bass * 0.16 + beat * 0.07);
        float twist = mid * 0.18 * sin(position.z * 0.12 + time * 0.25) * proximity;
        p.xy = mat2(cos(twist), sin(twist), -sin(twist), cos(twist)) * p.xy;
        p.y += 1.6;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        float distanceToEye = length(view.xyz);
        float phase = position.z / depth + atan(position.y - 1.6, position.x) / 6.283185
          + length(position.xy) * 0.035 + energy * 0.22;
        vColor = paletteColor(phase) * (1.0 + treble * (0.24 + 0.12 * sin(time * 3.0 + position.z * 2.0 + position.x)));
        vFade = smoothstep(0.35, 1.5, distanceToEye)
          * (1.0 - smoothstep(depth * 0.35, depth * 0.5, abs(p.z)))
          * (1.0 - smoothstep(18.0, 48.0, distanceToEye));
        gl_PointSize = clamp(pointScale * 0.038 / max(0.1, -view.z), 1.5, 7.0);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vFade;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float core = 1.0 - smoothstep(0.0, 0.42, r);
        float halo = 0.18 * (1.0 - smoothstep(0.15, 1.0, r));
        gl_FragColor = vec4(vColor, (core * 0.85 + halo) * vFade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  // The shader wraps Z; the original geometry bounds no longer describe it.
  points.frustumCulled = false;
  const viewport = new THREE.Vector4();
  points.onBeforeRender = (renderer, scene, camera) => {
    // XR uses a separate viewport for each eye.
    material.uniforms.pointScale.value = camera.cameras?.[0]?.viewport?.w ?? camera.viewport?.w
      ?? renderer.getCurrentViewport(viewport).w;
  };
  return {
    points,
    setPalette(name) {
      if (!palettes[name]) return;
      paletteName = name;
    },
    update(delta, speed, bands) {
      material.uniforms.bass.value = Math.min(1, Math.pow(bands?.bass ?? 0, 1.6) * 1.4);
      material.uniforms.mid.value = bands?.mid ?? 0;
      material.uniforms.treble.value = bands?.treble ?? 0;
      material.uniforms.beat.value = bands?.beat ?? 0;
      material.uniforms.energy.value = bands?.energy ?? 0;
      const blend = 1 - Math.exp(-delta / 0.6);
      for (let i = 0; i < 6; i++) material.uniforms.palette.value[i].lerp(paletteColors[paletteName][i], blend);
      material.uniforms.time.value += delta;
      material.uniforms.travel.value = (material.uniforms.travel.value + delta * speed) % config.depth;
    },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
