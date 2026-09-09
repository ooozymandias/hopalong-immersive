import * as THREE from 'three';
import { SUBSETS } from './generateOrbit.js';
import { generateComposition } from './composition.js';
import { VisualPalette } from './visualPalettes.js';
import { recycleDepth } from './ClassicMotion.js';
import { renderModes } from '../rendering/renderModes.js';
import { AnimatedSprites } from '../rendering/sprites/AnimatedSprites.js';
import { LayerRender, labDefaults } from '../rendering/lab/LayerRender.js';
import { createShapeAtlas } from '../rendering/lab/shapeAtlas.js';

export const densityProfiles = Object.freeze({ PC: 5000, 'Quest 3': 2000, Light: 1000 });
const LEVELS = 7;
const SPACING = 12 / SUBSETS;
const LAYER_COUNT = SUBSETS * LEVELS;
const SPAN = LAYER_COUNT * SPACING;

export function createClassic({ profile = 'PC', seed = 42, worker = true, initialComposition = 'Tunnel' } = {}) {
  const group = new THREE.Group();
  const palette = new VisualPalette();
  let composition = initialComposition;
  let renderMode = 'Points';
  let lineDensity = 0.25;
  const labSettings = { ...labDefaults };
  let shapeAtlas = null;
  group.position.y = 1.6;
  let count = densityProfiles[profile];
  let budget = count * LAYER_COUNT, budgetTarget = budget;
  let sprites = null;
  let spriteCount = 100;
  let generation = seed;
  let queue = [];
  let incoming = 0;
  let active = null;
  let orbitTime = 3;
  let workerInstance = null;
  let disposed = false;
  const viewport = new THREE.Vector4();
  const layers = [];

  function createWorker() {
    if (!worker || typeof Worker === 'undefined') return;
    workerInstance = new Worker(new URL('./orbit.worker.js', import.meta.url), { type: 'module' });
    workerInstance.onmessage = ({ data }) => { incoming--; queue.push(data); prefetch(); };
    workerInstance.onerror = () => {
      workerInstance.terminate(); workerInstance = null; incoming = 0;
    };
  }
  function prefetch() {
    if (!workerInstance || disposed) return;
    while (queue.length + incoming < 3) {
      incoming++;
      workerInstance.postMessage({ seed: ++generation, count, composition });
    }
  }
  function nextOrbit() {
    const orbit = queue.shift() ?? generateComposition(++generation, count, composition);
    prefetch();
    return orbit;
  }
  function tint(material, hue) {
    material.uniforms.hue.value = hue;
  }
  function clearLayers() {
    for (const layer of layers) {
      layer.userData.lab?.dispose();
      layer.children[0].geometry.dispose(); layer.children[0].material.dispose();
      layer.geometry.dispose(); layer.material.dispose();
    }
    layers.length = 0;
    group.clear();
  }
  function build() {
    const orbit = generateComposition(generation, count, composition);
    active = orbit;
    for (let i = 0; i < LAYER_COUNT; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(orbit.arrays[i % SUBSETS].slice(), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('spriteMask', new THREE.BufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage));
      geometry.computeBoundingSphere();
      const material = new THREE.ShaderMaterial({
        uniforms: {
          paletteMap: { value: palette.texture }, hue: { value: 0 }, pointScale: { value: 600 }, pointAspect: { value: 1 },
          cometMode: { value: 0 }, animatedMode: { value: 0 }, speed: { value: 0 },
        },
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
        vertexShader: `
          uniform float pointScale;
          uniform float pointAspect;
          uniform sampler2D paletteMap;
          uniform float hue;
          uniform float cometMode;
          uniform float animatedMode;
          uniform float speed;
          attribute float spriteMask;
          varying vec2 cometDirection;
          varying float tailLength;
          varying vec3 vTint;
          varying float fade;
          void main() {
            vec4 view = modelViewMatrix * vec4(position, 1.0);
            float d = length(view.xyz);
            fade = exp(-0.0025 * view.z * view.z) * smoothstep(0.15, 0.8, d);
            fade *= 1.0 - spriteMask * animatedMode;
            gl_Position = projectionMatrix * view;
            float gradient = fract(hue + length(position.xy) * 0.012 + position.x * 0.004);
            vTint = texture2D(paletteMap, vec2(gradient, 0.5)).rgb;
            gl_PointSize = clamp(pointScale * 0.09 / max(0.1, -view.z), 1.5, 20.0);
            cometDirection=vec2(0.0,1.0); tailLength=0.0;
            if (cometMode > 0.5) {
              vec4 next = projectionMatrix * (view + modelViewMatrix * vec4(0.0,0.0,0.1,0.0));
              vec2 direction = next.xy / max(0.01, next.w) - gl_Position.xy / max(0.01,gl_Position.w);
              direction.x *= pointAspect;
              cometDirection = length(direction) > 0.000001 ? normalize(vec2(direction.x,-direction.y)) : vec2(0.0,1.0);
              tailLength = (0.65 + 0.25 * fract(sin(dot(position.xy,vec2(12.98,78.23)))*43758.54)) * (1.0+min(speed/24.0,1.0)*0.3);
              gl_PointSize = min(28.0,gl_PointSize*1.6);
            }
          }
        `,
        fragmentShader: `
          varying vec3 vTint;
          varying float fade;
          varying vec2 cometDirection;
          varying float tailLength;
          uniform float cometMode;
          void main() {
            #ifdef LINE_MODE
            gl_FragColor = vec4(vTint, fade * 0.85);
            #else
            vec2 p = (gl_PointCoord - 0.5) * 2.0;
            float r = length(p);
            if (r > 1.0) discard;
            float glow = exp(-3.5 * r * r) * (1.0 - smoothstep(0.75, 1.0, r));
            if (cometMode > 0.5) {
              float along = dot(p,cometDirection);
              float across = dot(p,vec2(-cometDirection.y,cometDirection.x));
              float head = exp(-55.0*(pow(along-0.3,2.0)+across*across));
              float tail = smoothstep(0.3-tailLength,0.3,along)*(1.0-smoothstep(0.25,0.4,along))*exp(-90.0*across*across);
              glow = head + tail*0.55;
            }
            gl_FragColor = vec4(vTint, glow * fade);
            #endif
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
      });
      tint(material, orbit.hues[i % SUBSETS]);
      const layer = new THREE.Points(geometry, material);
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute('position', geometry.attributes.position);
      lineGeometry.setAttribute('spriteMask', geometry.attributes.spriteMask);
      const indexBuffer = new Uint16Array(count * 2);
      indexBuffer.set(orbit.lines[i % SUBSETS]);
      lineGeometry.setIndex(new THREE.BufferAttribute(indexBuffer, 1).setUsage(THREE.DynamicDrawUsage));
      lineGeometry.userData.indexCount = orbit.lines[i % SUBSETS].length;
      lineGeometry.boundingSphere = geometry.boundingSphere;
      const lineMaterial = material.clone();
      lineMaterial.uniforms = material.uniforms;
      lineMaterial.defines = { LINE_MODE: 1 };
      layer.add(new THREE.LineSegments(lineGeometry, lineMaterial));
      layer.position.z = -(i + 1) * SPACING;
      layer.userData.seed = orbit.seed;
      layer.userData.subset = i % SUBSETS;
      layer.onBeforeRender = (renderer, scene, camera) => {
        const eyeViewport = camera.cameras?.[0]?.viewport ?? camera.viewport ?? renderer.getCurrentViewport(viewport);
        material.uniforms.pointScale.value = eyeViewport.w;
        material.uniforms.pointAspect.value = eyeViewport.z / Math.max(1, eyeViewport.w);
      };
      group.add(layer);
      layers.push(layer);
    }
    if (sprites) { group.add(sprites.mesh); sprites.bind(layers, spriteCount); }
    applyLines();
  }
  function applyLines() {
    const options = renderModes[renderMode];
    for (const layer of layers) {
      layer.material.visible = options.points;
      layer.material.uniforms.cometMode.value = options.comets ? 1 : 0;
      layer.material.uniforms.animatedMode.value = options.sprites ? 1 : 0;
      layer.geometry.setDrawRange(0, Math.floor(budget / LAYER_COUNT * (options.background ?? 1)));
      const lines = layer.children[0];
      const density = options.connections ? labSettings.connectionDensity : lineDensity;
      lines.visible = options.lines > 0 && density > 0;
      const fraction = density * options.lines * (budget / (count * LAYER_COUNT));
      lines.geometry.setDrawRange(0, Math.floor(lines.geometry.userData.indexCount / 2 * fraction) * 2);
      if (options.lab && !layer.userData.lab) {
        shapeAtlas ??= createShapeAtlas();
        layer.userData.lab = new LayerRender(layer, shapeAtlas);
      }
      layer.userData.lab?.configure(renderMode, labSettings, budget / (count * LAYER_COUNT));
    }
    if (sprites) sprites.mesh.visible = !!options.sprites;
  }
  function resetQueue() {
    workerInstance?.terminate(); workerInstance = null;
    queue = []; incoming = 0; orbitTime = 3;
    createWorker(); prefetch();
  }
  createWorker();
  build();
  prefetch();
  return {
    points: group,
    palette,
    setLabSetting(name, value) {
      const ranges={trailLength:[0,3],connectionDensity:[0,0.5],ribbonWidth:[0.02,0.6],ribbonDensity:[0,1],ribbonTwist:[0,2],labDensity:[0.1,1]};
      if (ranges[name] && Number.isFinite(value)) labSettings[name]=Math.max(ranges[name][0],Math.min(ranges[name][1],value));
      else if (name==='pulseShape' || name==='glyphShape') labSettings[name]=value;
      applyLines();
    },
    setPalette(name) { palette.set(name); },
    setRenderMode(mode) {
      if (!renderModes[mode]) return;
      renderMode = mode;
      if (mode === 'Animated Sprites' && !sprites) {
        sprites = new AnimatedSprites(); group.add(sprites.mesh); sprites.bind(layers, spriteCount);
      }
      applyLines();
    },
    setSpriteCount(value) {
      if (![25, 50, 100, 150, 250].includes(value)) return;
      spriteCount = value; sprites?.bind(layers, value);
    },
    setSpriteAtlas(atlas) {
      if (!sprites) { sprites = new AnimatedSprites(); group.add(sprites.mesh); sprites.bind(layers, spriteCount); }
      sprites.setAtlas(atlas); applyLines();
    },
    setLineDensity(value) { lineDensity = Math.max(0, Math.min(1, value)); applyLines(); },
    setComposition(mode) { composition = mode; resetQueue(); },
    get particleCount() { return Math.floor(budget / LAYER_COUNT) * LAYER_COUNT; },
    setRenderBudget(value) { budgetTarget = Math.min(count * LAYER_COUNT, Math.max(0, value)); },
    setProfile(name) {
      if (!(name in densityProfiles) || densityProfiles[name] === count) return;
      count = densityProfiles[name];
      budget = budgetTarget = count * LAYER_COUNT;
      workerInstance?.terminate();
      workerInstance = null;
      queue = []; incoming = 0; active = null; orbitTime = 3;
      clearLayers(); createWorker(); build(); prefetch();
    },
    update(delta, speed, rotation, cameraZ = 0, elapsed = delta) {
      palette.update(elapsed);
      if (Math.abs(budget - budgetTarget) > 1) {
        budget += (budgetTarget - budget) * (1 - Math.exp(-delta / 0.6)); applyLines();
      }
      orbitTime += delta;
      if (orbitTime >= 3 && (queue.length || !workerInstance)) { active = nextOrbit(); orbitTime %= 3; }
      for (const layer of layers) {
        layer.material.uniforms.speed.value = speed;
        const before = layer.position.z;
        layer.position.z = recycleDepth(before, speed * delta, cameraZ + 0.5, SPAN);
        layer.rotation.z = (layer.rotation.z + rotation * delta) % (Math.PI * 2);
        if (layer.position.z < before) {
          const subset = layer.userData.subset;
          const positions = layer.geometry.attributes.position;
          positions.array.set(active.arrays[subset]);
          positions.needsUpdate = true;
          layer.geometry.computeBoundingSphere();
          const lines = layer.children[0];
          lines.geometry.index.array.set(active.lines[subset]);
          lines.geometry.index.needsUpdate = true;
          lines.geometry.userData.indexCount = active.lines[subset].length;
          lines.geometry.boundingSphere = layer.geometry.boundingSphere;
          const options = renderModes[renderMode];
          const fraction = (options.connections ? labSettings.connectionDensity : lineDensity) * options.lines * (budget / (count * LAYER_COUNT));
          lines.geometry.setDrawRange(0, Math.floor(active.lines[subset].length / 2 * fraction) * 2);
          tint(layer.material, active.hues[subset]);
          layer.userData.seed = active.seed;
          layer.userData.lab?.recycle();
          layer.userData.lab?.configure(renderMode, labSettings, budget / (count * LAYER_COUNT));
        }
        layer.userData.lab?.update(delta, speed, rotation);
      }
      sprites?.update(layers, delta);
    },
    dispose() { disposed = true; workerInstance?.terminate(); clearLayers(); palette.dispose(); sprites?.dispose(); shapeAtlas?.dispose(); },
  };
}
