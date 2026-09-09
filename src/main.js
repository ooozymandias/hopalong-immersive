import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { config } from './config.js';
import { createClassic } from './classic/createClassic.js';
import { DesktopLook } from './controls/DesktopLook.js';
import tracks from 'virtual:music-catalog';
import { MusicPlayer } from './audio/MusicPlayer.js';
import { ClassicMotion, classicSpeeds } from './classic/ClassicMotion.js';
import { visualPalettes } from './classic/visualPalettes.js';
import { DesktopStereo } from './rendering/DesktopStereo.js';
import { createAttractor } from './attractor/createAttractor.js';
import { defaults } from './rendering/defaults.js';
import { renderModes } from './rendering/renderModes.js';
import { AutoPerformance, GpuTimer } from './rendering/AutoPerformance.js';
import { demoAtlas } from './rendering/sprites/AnimatedSprites.js';
import { pulseShapes, glyphShapes } from './rendering/lab/shapeAtlas.js';
import './style.css';

const status = document.querySelector('#status');
try { start(); } catch (error) {
  console.error(error);
  status.textContent = 'Impossible de démarrer la 3D. Vérifiez que WebGL 2 est disponible, puis rechargez la page.';
}

function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.pixelRatioMax));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFramebufferScaleFactor(config.xrFramebufferScale);
  renderer.xr.setFoveation(config.xrFoveation);
  document.querySelector('#app').append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
  camera.position.y = config.eyeHeight;
  scene.add(camera);
  const density = document.querySelector('#density');
  const xrDensity = document.querySelector('#xr-density');
  const attractor = createClassic({ profile: density.value, initialComposition: defaults.composition });
  attractor.setPalette(defaults.palette); attractor.setRenderMode(defaults.render);
  const autoPerformance = new AutoPerformance();
  const gpuTimer = new GpuTimer(renderer);
  const autoToggle = document.querySelector('#auto-performance');
  const desktopStereo = new DesktopStereo(renderer);
  let volumetric = null;
  let mode = 'Classic Hopalong';
  scene.add(attractor.points);
  const look = new DesktopLook(camera, renderer.domElement);
  const music = new MusicPlayer(tracks, document.querySelector('#music'));
  const travel = new ClassicMotion();
  travel.target = defaults.speed;
  let resumeSpeed = defaults.speed;
  const speedSelect = document.querySelector('#speed');
  speedSelect.replaceChildren(...Object.keys(classicSpeeds).map((name) => new Option(name, name)), new Option('Custom', 'Custom'));
  const speedSlider = document.querySelector('#speed-range');
  const speedValue = document.querySelector('#speed-value');
  const rotation = document.querySelector('#rotation');
  const rotationRate = document.querySelector('#rotation-rate');
  const abort = new AbortController();
  const listen = (element, event, handler) => element.addEventListener(event, handler, { signal: abort.signal });
  const applyProfile = () => {
    attractor.setProfile(renderer.xr.isPresenting ? xrDensity.value : density.value);
    const capacity = { PC: 245000, 'Quest 3': 98000, Light: 49000 }[renderer.xr.isPresenting ? xrDensity.value : density.value];
    autoPerformance.reset(capacity, renderer.xr.getSession()?.frameRate || 72);
    attractor.setRenderBudget(capacity);
    document.querySelector('#particle-count').textContent = `${(mode === 'Classic Hopalong' ? attractor.particleCount : config.particleCount).toLocaleString('fr-FR')} particules`;
  };
  listen(density, 'change', applyProfile);
  listen(xrDensity, 'change', applyProfile);
  applyProfile();
  listen(autoToggle, 'change', applyProfile);
  const paletteSelect = document.querySelector('#palette');
  paletteSelect.replaceChildren(...[...Object.keys(visualPalettes), 'Random Playlist'].map((name) => new Option(name, name)));
  paletteSelect.value = defaults.palette;
  const renderSelect = document.querySelector('#render-mode');
  renderSelect.replaceChildren(...Object.keys(renderModes).filter(name => !renderModes[name].experimental).map((name) => new Option(name, name)));
  renderSelect.value = defaults.render;
  listen(paletteSelect, 'change', () => attractor.setPalette(paletteSelect.value));
  const experimentalRender = document.querySelector('#experimental-render');
  function selectRender() {
    const selected = experimentalRender.checked ? 'Animated Sprites' : renderSelect.value;
    attractor.setRenderMode(selected);
    for (const element of document.querySelectorAll('[data-render-modes]')) element.hidden = !element.dataset.renderModes.split(',').includes(selected);
  }
  listen(renderSelect, 'change', () => { experimentalRender.checked = false; selectRender(); });
  listen(experimentalRender, 'change', selectRender);
  for (const [id, names, setting, initial] of [['pulse-shape',pulseShapes,'pulseShape','Circle'],['glyph-shape',glyphShapes,'glyphShape','Random Mix']]) {
    const select=document.querySelector(`#${id}`);
    select.replaceChildren(...names.map(name => new Option(name,name))); select.value=initial;
    listen(select,'change',() => attractor.setLabSetting(setting,select.value));
  }
  const percent=v => `${Math.round(v*100)} %`;
  for (const [id,setting,output,format] of [
    ['trail-length','trailLength','trail-value',v=>`${v.toFixed(1)}×`],
    ['connection-density','connectionDensity','connection-value',percent],
    ['ribbon-width','ribbonWidth','ribbon-width-value',v=>`${v.toFixed(2)} m`],
    ['ribbon-density','ribbonDensity','ribbon-density-value',percent],
    ['ribbon-twist','ribbonTwist','ribbon-twist-value',v=>v.toFixed(1)],
    ['lab-density','labDensity','lab-density-value',percent],
  ]) {
    const input=document.querySelector(`#${id}`);
    listen(input,'input',() => { const value=Number(input.value); attractor.setLabSetting(setting,value); document.querySelector(`#${output}`).textContent=format(value); });
  }
  selectRender();
  listen(document.querySelector('#line-density'), 'input', (event) => {
    attractor.setLineDensity(Number(event.target.value));
    document.querySelector('#line-value').textContent = `${Math.round(event.target.value * 100)} %`;
  });
  listen(document.querySelector('#composition'), 'change', (event) => attractor.setComposition(event.target.value));
  listen(document.querySelector('#desktop-view'), 'change', (event) => { desktopStereo.mode = event.target.value; });
  listen(document.querySelector('#stereo-separation'), 'input', (event) => {
    desktopStereo.separation = Number(event.target.value);
    document.querySelector('#separation-value').textContent = `${Math.round(event.target.value * 1000)} mm`;
  });
  listen(document.querySelector('#stereo-quality'), 'change', (event) => { desktopStereo.quality = Number(event.target.value); });
  const framing = document.querySelector('#stereo-framing');
  const zoom = document.querySelector('#stereo-zoom');
  listen(framing, 'change', () => { desktopStereo.framing = framing.value; zoom.disabled = framing.value !== 'Custom'; });
  listen(zoom, 'input', () => {
    desktopStereo.zoom = Number(zoom.value);
    document.querySelector('#zoom-value').textContent = `${Number(zoom.value).toFixed(2)}×`;
  });
  listen(document.querySelector('#sprite-count'), 'change', (event) => attractor.setSpriteCount(Number(event.target.value)));
  let gifWorker = null, gifTimeout = null, gifRequest = 0;
  const gifStatus = document.querySelector('#gif-status');
  function cancelGif() { gifRequest++; gifWorker?.terminate(); gifWorker = null; clearTimeout(gifTimeout); }
  listen(document.querySelector('#sprite-demo'), 'click', () => {
    cancelGif(); attractor.setSpriteAtlas(demoAtlas()); gifStatus.textContent = 'Démo Pulse · animation partagée.';
  });
  listen(document.querySelector('#sprite-file'), 'change', async (event) => {
    const file = event.target.files[0]; if (!file) return;
    cancelGif(); const request = gifRequest;
    if (file.size > 8 * 1024 * 1024) { gifStatus.textContent = 'GIF limité à 8 Mo.'; return; }
    gifStatus.textContent = 'Décodage local du GIF…';
    try {
      const buffer = await file.arrayBuffer();
      if (request !== gifRequest) return;
      gifWorker = new Worker(new URL('./rendering/sprites/gif.worker.js', import.meta.url), { type: 'module' });
      gifWorker.onmessage = ({ data }) => {
        if (request !== gifRequest) return;
        if (data.error) gifStatus.textContent = data.error;
        else {
          attractor.setSpriteAtlas(data.atlas);
          gifStatus.textContent = `${file.name} · ${data.atlas.delays.length} frames · local uniquement`;
        }
        cancelGif();
      };
      gifWorker.onerror = () => { gifStatus.textContent = 'Décodage impossible. La précédente animation est conservée.'; cancelGif(); };
      gifTimeout = setTimeout(() => { gifStatus.textContent = 'GIF trop long à décoder. Essayez une animation plus petite.'; cancelGif(); }, 12000);
      gifWorker.postMessage(buffer, [buffer]);
    } catch (error) {
      if (request !== gifRequest) return;
      gifStatus.textContent = `Lecture impossible : ${error.message}`; cancelGif();
    }
  });
  listen(document.querySelector('#experience-mode'), 'change', (event) => {
    mode = event.target.value;
    if (mode !== 'Classic Hopalong' && !volumetric) {
      volumetric = createAttractor(config); scene.add(volumetric.points);
    }
    attractor.points.visible = mode === 'Classic Hopalong';
    if (volumetric) volumetric.points.visible = !attractor.points.visible;
    document.querySelector('#classic-options').disabled = !attractor.points.visible;
    applyProfile();
  });
  const drift = document.querySelector('#drift');
  function updateDriftButton() {
    drift.setAttribute('aria-pressed', String(travel.target > 0));
    drift.textContent = travel.target === 0 ? 'Reprendre le voyage' : 'Stop';
    speedSelect.value = Object.keys(classicSpeeds).find((name) => classicSpeeds[name] === travel.target) ?? 'Custom';
    speedSlider.value = String(travel.target);
    speedValue.textContent = `${travel.target.toFixed(1)} m/s`;
  }
  const setSpeed = (value) => {
    travel.target = Math.max(0, Math.min(24, value));
    if (travel.target > 0) resumeSpeed = travel.target;
    updateDriftButton();
  };
  listen(speedSelect, 'change', () => setSpeed(classicSpeeds[speedSelect.value] ?? travel.target));
  listen(speedSlider, 'input', () => setSpeed(Number(speedSlider.value)));
  const setRotation = () => {
    travel.rotationTarget = Number(rotation.value) * Number(rotationRate.value) * Math.PI / 180;
    document.querySelector('#rotation-value').textContent = `${rotationRate.value}°/s`;
  };
  listen(rotation, 'change', setRotation);
  listen(rotationRate, 'input', setRotation);
  setRotation();
  const toggleDrift = () => {
    setSpeed(travel.target === 0 ? resumeSpeed : 0);
  };
  drift.addEventListener('click', toggleDrift);
  updateDriftButton();
  let mouseX = 0, mouseY = 0;
  listen(renderer.domElement, 'pointermove', (event) => {
    mouseX = (event.clientX / innerWidth - 0.5) * 8;
    mouseY = -(event.clientY / innerHeight - 0.5) * 8;
  });
  const panel = document.querySelector('.controls');
  const hideCursor = document.querySelector('#hide-cursor');
  const syncUI = () => {
    document.body.classList.toggle('ui-hidden', panel.hidden);
    document.body.classList.toggle('cursor-hidden', panel.hidden && hideCursor.checked);
    document.querySelector('#toggle-controls').setAttribute('aria-expanded', String(!panel.hidden));
    if (panel.hidden && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };
  const togglePanel = () => { panel.hidden = !panel.hidden; syncUI(); };
  listen(hideCursor, 'change', syncUI);
  listen(document.querySelector('#toggle-controls'), 'click', togglePanel);
  listen(window, 'keydown', (event) => {
    if (event.key.toLowerCase() === 'h' && event.target.type !== 'text' && event.target.tagName !== 'TEXTAREA') {
      togglePanel(); event.preventDefault(); return;
    }
    if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(event.target.tagName)) return;
    if (event.key === 'ArrowUp') setSpeed(travel.target + 0.6);
    else if (event.key === 'ArrowDown') setSpeed(travel.target - 0.6);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      rotation.value = event.key === 'ArrowLeft' ? '1' : '-1'; setRotation();
    } else return;
    event.preventDefault();
  });
  // A controller trigger toggles travel while the HTML controls are outside VR.
  const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
  for (const controller of controllers) {
    controller.addEventListener('selectstart', toggleDrift);
    scene.add(controller);
  }
  const vrButton = VRButton.createButton(renderer);
  const startMusicInVR = (event) => {
    if (event.isTrusted && vrButton.onclick && !renderer.xr.isPresenting) music.startFromGesture();
  };
  // Capture preserves the user gesture before VRButton requests the XR session.
  vrButton.addEventListener('click', startMusicInVR, true);
  document.querySelector('#vr-entry').append(vrButton);
  const desktopStatus = window.isSecureContext
    ? 'En VR : gâchette pour mettre le voyage en pause.'
    : 'La VR nécessite HTTPS ou localhost. Le mode PC reste disponible.';
  status.textContent = desktopStatus;
  let lastTime = null;
  let statsTime = 0, statsFrames = 0;
  function sessionStart() {
    look.enabled = false;
    look.reset();
    camera.position.set(0, 0, 0);
    mouseX = 0; mouseY = 0;
    applyProfile();
    gpuTimer.clear();
    const session = renderer.xr.getSession();
    if (session?.supportedFrameRates && Array.from(session.supportedFrameRates).includes(72) && session.updateTargetFrameRate) {
      session.updateTargetFrameRate(72).then(() => {
        if (renderer.xr.getSession() === session) applyProfile();
      }).catch(() => {});
    }
    lastTime = null;
  }
  function sessionEnd() {
    gpuTimer.clear();
    look.enabled = true;
    look.reset();
    camera.position.set(0, config.eyeHeight, 0);
    camera.fov = 60;
    applyProfile();
    lastTime = null;
    resize();
  }
  renderer.xr.addEventListener('sessionstart', sessionStart);
  renderer.xr.addEventListener('sessionend', sessionEnd);
  function resize() {
    if (renderer.xr.isPresenting) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    status.textContent = 'Contexte graphique perdu. Rechargez la page pour reprendre.';
  });
  let wasMeasuring = false;
  renderer.setAnimationLoop((time) => {
    const elapsed = lastTime === null ? 0 : (time - lastTime) / 1000;
    const delta = Math.min(elapsed, 0.05);
    lastTime = time;
    // Music is deliberately not sampled: Classic has no audio-driven uniforms.
    travel.update(delta);
    if (!renderer.xr.isPresenting) {
      const blend = 1 - Math.exp(-delta / 0.32);
      camera.position.x += (mouseX - camera.position.x) * blend;
      camera.position.y += (config.eyeHeight + mouseY - camera.position.y) * blend;
    }
    if (mode === 'Classic Hopalong') attractor.update(delta, travel.speed, travel.rotation, camera.position.z, elapsed);
    else attractor.palette.update(elapsed);
    if (volumetric?.points.visible) {
      volumetric.update(delta, travel.speed);
      volumetric.points.rotation.z += travel.rotation * delta;
    }
    const inXR = renderer.xr.isPresenting;
    const measure = inXR && autoToggle.checked && mode === 'Classic Hopalong' && renderer.xr.getSession()?.visibilityState === 'visible';
    if (measure !== wasMeasuring) { gpuTimer.clear(); autoPerformance.warmup(); }
    wasMeasuring = measure;
    const gpuMs = measure ? gpuTimer.poll() : null;
    if (measure) gpuTimer.begin();
    const renderStart = performance.now();
    desktopStereo.render(scene, camera, delta);
    const cpuMs = performance.now() - renderStart;
    if (measure) {
      gpuTimer.end();
      autoPerformance.hz = renderer.xr.getSession()?.frameRate || 72;
      attractor.setRenderBudget(autoPerformance.sample(elapsed * 1000, cpuMs, gpuMs));
    }
    statsTime += elapsed; statsFrames++;
    if (statsTime >= 1) {
      if (!renderer.xr.isPresenting) document.querySelector('#render-stats').textContent = `${Math.round(statsFrames / statsTime)} FPS`;
      if (!renderer.xr.isPresenting) document.querySelector('#palette-current').textContent = attractor.palette.name;
      document.querySelector('#particle-count').textContent = `${(mode === 'Classic Hopalong' ? attractor.particleCount : config.particleCount).toLocaleString('fr-FR')} particules`;
      document.querySelector('#performance-status').textContent = measure
        ? `XR ${autoPerformance.hz} Hz · ${gpuMs === null ? 'cadence + CPU' : `GPU ${gpuMs.toFixed(1)} ms`} · cible ${autoPerformance.count.toLocaleString('fr-FR')}`
        : 'Auto Performance actif uniquement en WebXR Classic.';
      statsTime = 0; statsFrames = 0;
    }
  });
  if (import.meta.hot) import.meta.hot.dispose(() => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', resize);
    drift.removeEventListener('click', toggleDrift);
    abort.abort();
    cancelGif(); gpuTimer.clear();
    document.body.classList.remove('ui-hidden', 'cursor-hidden');
    renderer.xr.removeEventListener('sessionstart', sessionStart);
    renderer.xr.removeEventListener('sessionend', sessionEnd);
    for (const controller of controllers) controller.removeEventListener('selectstart', toggleDrift);
    look.dispose();
    vrButton.removeEventListener('click', startMusicInVR, true);
    music.dispose();
    attractor.dispose();
    volumetric?.dispose(); desktopStereo.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    document.querySelector('#vr-entry').replaceChildren();
  });
}
