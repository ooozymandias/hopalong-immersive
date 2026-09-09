import * as THREE from 'three';
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
import { SessionManager } from './xr/SessionManager.js';
import { XRInput, INITIAL_SPEED } from './xr/input.js';
import { SpatialFrame } from './xr/SpatialFrame.js';
import { FloatingMenu, addRay } from './xr/FloatingMenu.js';
import './style.css';

const status = document.querySelector('#status');
try { start(); } catch (error) {
  console.error(error);
  status.textContent = 'Impossible de démarrer la 3D. Vérifiez que WebGL 2 est disponible, puis rechargez la page.';
}

function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000,1);
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
  const space = new SpatialFrame(), xrInput = new XRInput();
  const head = new THREE.Vector3(), headQuaternion = new THREE.Quaternion();
  const forward = new THREE.Vector3(), up = new THREE.Vector3();
  const gripVectors = [new THREE.Vector3(),new THREE.Vector3()], gripPositions=[null,null];
  const speakerIcons=[0x70dfff,0xffa964].map(color=>{
    const icon=new THREE.Mesh(new THREE.IcosahedronGeometry(0.035,1),new THREE.MeshBasicMaterial({color}));
    icon.visible=false;scene.add(icon);return icon;
  });
  const spaceSelect=document.querySelector('#space-mode'), speakerMode=document.querySelector('#speaker-mode');
  listen(spaceSelect,'change',()=>{space.mode=spaceSelect.value;});
  const configureSpeakers=()=>{
    const near=Number(document.querySelector('#speaker-near').value),rolloff=Number(document.querySelector('#speaker-rolloff').value),gain=Number(document.querySelector('#speaker-gain').value);
    music.audio.configureSpeakers({distanceModel:document.querySelector('#speaker-model').value,near,rolloff,gain});
    document.querySelector('#speaker-near-value').textContent=`${near.toFixed(2)} m`;
    document.querySelector('#speaker-rolloff-value').textContent=rolloff.toFixed(2);
    document.querySelector('#speaker-gain-value').textContent=`${gain.toFixed(2)}×`;
  };
  for(const id of ['speaker-model','speaker-near','speaker-rolloff','speaker-gain'])listen(document.querySelector(`#${id}`),'input',configureSpeakers);
  const sessions=new SessionManager(renderer,document.querySelector('#vr-entry'),status,()=>music.startFromGesture(),()=>{panel.hidden=false;syncUI();});
  const cycle=(id,direction)=>{
    const element=document.querySelector(`#${id}`),n=element.options.length;
    element.selectedIndex=(element.selectedIndex+direction+n)%n;element.dispatchEvent(new Event('change'));
    if(id==='speaker-model')configureSpeakers();
  };
  const adjust=(id,step,direction)=>{
    const element=document.querySelector(`#${id}`);
    element.value=String(Math.max(Number(element.min),Math.min(Number(element.max),Number(element.value)+step*direction)));
    element.dispatchEvent(new Event('input'));
  };
  const selectRow=(label,id)=>({label,value:()=>document.querySelector(`#${id}`).selectedOptions[0]?.textContent,change:d=>cycle(id,d)});
  let menuPage='main', xrMenu;
  const rows=()=>menuPage==='audio'?[
    selectRow('Audio A/B','speaker-mode'),selectRow('Speaker Distance Model','speaker-model'),
    {label:'Near Distance',value:()=>`${document.querySelector('#speaker-near').value} m`,change:d=>adjust('speaker-near',0.05,d)},
    {label:'Rolloff',value:()=>document.querySelector('#speaker-rolloff').value,change:d=>adjust('speaker-rolloff',0.05,d)},
    {label:'Virtual Speaker Gain',value:()=>`${document.querySelector('#speaker-gain').value}×`,change:d=>adjust('speaker-gain',0.05,d)},
    {label:'Musique',value:()=>music.wantPlaying?'Pause':'Play',change:()=>music.wantPlaying?music.pause():void music.play()},
    {label:'Retour',value:()=> 'XR Controls',change:()=>{menuPage='main';}},
  ]:[
    selectRow('Palette','palette'),selectRow('Render Mode','render-mode'),selectRow('Composition','composition'),
    {label:'Speed',value:()=>`${travel.target.toFixed(1)} m/s`,change:d=>setSpeed(travel.target+d*1.2)},
    {label:'Rotation',value:()=>`${rotation.selectedOptions[0].textContent} · ${rotationRate.value}°/s`,change:d=>{
      const rates=[-30,-15,-5,0,5,15,30],current=Number(rotation.value)*Number(rotationRate.value);
      const index=rates.indexOf(current),next=rates[(Math.max(0,index)+d+rates.length)%rates.length];
      rotation.value=String(Math.sign(next));rotationRate.value=String(Math.abs(next));setRotation();
    }},
    selectRow('VR Density','xr-density'),
    {label:'Auto Performance',value:()=>autoToggle.checked?'On':'Off',change:()=>{autoToggle.checked=!autoToggle.checked;applyProfile();}},
    {label:'Mixed Reality',value:()=>!sessions.support['immersive-ar']?'Indisponible':sessions.mode==='immersive-ar'?'On · passer en VR':'Off · passer en MR',change:()=>{
      if(sessions.support['immersive-ar'])void sessions.request(sessions.mode==='immersive-ar'?'immersive-vr':'immersive-ar');
    }},
    selectRow('Virtual Speakers · A/B','speaker-mode'),selectRow('Space · World experimental','space-mode'),
    {label:'Audio settings',value:()=> 'Distance / Rolloff / Gain / Play',change:()=>{menuPage='audio';}},
    {label:'Fermer',value:()=> 'X gauche',change:()=>xrMenu.hide()},
  ];
  xrMenu=new FloatingMenu(scene,rows,toggleDrift);
  const controllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
  const selectHandlers=[];
  for (const controller of controllers) {
    const handler=()=>xrMenu.select(controller);selectHandlers.push(handler);
    controller.addEventListener('selectstart',handler);addRay(controller);
    scene.add(controller);
  }
  const desktopStatus = window.isSecureContext
    ? 'XR : X gauche = menu · stick droit = vitesse · gâchette = pause hors menu.'
    : 'La VR nécessite HTTPS ou localhost. Le mode PC reste disponible.';
  status.textContent = desktopStatus;
  let lastTime = null;
  let statsTime = 0, statsFrames = 0;
  function sessionStart() {
    setSpeed(INITIAL_SPEED);travel.speed=0;
    space.reset();xrInput.reset();xrMenu.hide();
    scene.background=sessions.mode==='immersive-ar'?null:new THREE.Color(0x000000);
    renderer.setClearColor(0x000000,sessions.mode==='immersive-ar'?0:1);
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
    xrMenu.hide();xrInput.reset();space.reset();space.apply(attractor.points);
    if(volumetric)space.apply(volumetric.points,0);
    music.audio.updateSpeakers(false);
    for(const icon of speakerIcons)icon.visible=false;
    for(const controller of controllers)controller.userData.menuRay.visible=false;
    scene.background=new THREE.Color(0x000000);renderer.setClearColor(0x000000,1);
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
  renderer.setAnimationLoop((time,frame) => {
    const elapsed = lastTime === null ? 0 : (time - lastTime) / 1000;
    const delta = Math.min(elapsed, 0.05);
    lastTime = time;
    const inXR=renderer.xr.isPresenting;
    let cameraZ=camera.position.z;
    let spatialAudio=false;
    if(inXR && frame){
      const reference=renderer.xr.getReferenceSpace(),session=renderer.xr.getSession();
      const pose=frame.getViewerPose(reference);
      if(pose && session.visibilityState==='visible'){
        head.copy(pose.transform.position);headQuaternion.copy(pose.transform.orientation);
        forward.set(0,0,-1).applyQuaternion(headQuaternion);up.set(0,1,0).applyQuaternion(headQuaternion);
        const next=xrInput.update(session.inputSources,travel.target,delta,()=>xrMenu.toggle(head,headQuaternion));
        if(next!==travel.target)setSpeed(next);
        cameraZ=space.update(head,delta,true);space.apply(attractor.points);if(volumetric)space.apply(volumetric.points,0);
        gripPositions.fill(null);
        for(const source of session.inputSources){
          const index=source.handedness==='left'?0:source.handedness==='right'?1:-1;
          if(index<0 || !source.gripSpace)continue;
          const grip=frame.getPose(source.gripSpace,reference);
          if(grip){gripVectors[index].copy(grip.transform.position);gripPositions[index]=gripVectors[index];}
        }
        spatialAudio=speakerMode.value==='Virtual Speakers';
        music.audio.updateSpeakers(spatialAudio,head,forward,up,gripPositions);
        speakerIcons.forEach((icon,i)=>{icon.visible=spatialAudio && !!gripPositions[i];if(icon.visible)icon.position.copy(gripPositions[i]);});
        xrMenu.update(delta,controllers);
      }else{xrInput.reset();xrMenu.hide();for(const controller of controllers)controller.userData.menuRay.visible=false;}
    }
    if(!spatialAudio){music.audio.updateSpeakers(false);for(const icon of speakerIcons)icon.visible=false;}
    // Music is deliberately not sampled: Classic has no audio-driven uniforms.
    travel.update(delta);
    if (!renderer.xr.isPresenting) {
      const blend = 1 - Math.exp(-delta / 0.32);
      camera.position.x += (mouseX - camera.position.x) * blend;
      camera.position.y += (config.eyeHeight + mouseY - camera.position.y) * blend;
    }
    if (mode === 'Classic Hopalong') attractor.update(delta, travel.speed, travel.rotation, cameraZ, elapsed);
    else attractor.palette.update(elapsed);
    if (volumetric?.points.visible) {
      volumetric.update(delta, travel.speed);
      volumetric.points.rotation.z += travel.rotation * delta;
    }
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
    controllers.forEach((controller,i)=>{
      controller.removeEventListener('selectstart',selectHandlers[i]);const ray=controller.userData.menuRay;
      ray.removeFromParent();ray.geometry.dispose();ray.material.dispose();controller.removeFromParent();
    });
    xrMenu.dispose();sessions.dispose();
    speakerIcons.forEach(icon=>{icon.removeFromParent();icon.geometry.dispose();icon.material.dispose();});
    look.dispose();
    music.dispose();
    attractor.dispose();
    volumetric?.dispose(); desktopStereo.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    document.querySelector('#vr-entry').replaceChildren();
  });
}
