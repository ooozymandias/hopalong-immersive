import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion, Group, Scene } from 'three';
import { XRInput, stickSpeed, INITIAL_SPEED, MAX_SPEED } from '../src/xr/input.js';
import { SpatialFrame } from '../src/xr/SpatialFrame.js';
import { VirtualSpeakers } from '../src/audio/VirtualSpeakers.js';
import { FloatingMenu, addRay } from '../src/xr/FloatingMenu.js';
import { SessionManager } from '../src/xr/SessionManager.js';
import { createClassic } from '../src/classic/createClassic.js';
function installGlobal(t,name,value){
  const previous=Object.getOwnPropertyDescriptor(globalThis,name);
  Object.defineProperty(globalThis,name,{value,configurable:true});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,name,previous);else delete globalThis[name];});
}

test('Quest input uses handedness, X rising edge and dead zone; release retains speed',()=>{
  assert.equal(INITIAL_SPEED,MAX_SPEED/4);
  const left={handedness:'left',gamepad:{mapping:'xr-standard',buttons:Array.from({length:5},()=>({pressed:false})),axes:[0,0,0,0]}};
  const right={handedness:'right',gamepad:{mapping:'xr-standard',buttons:[],axes:[0,0,0,-1]}};
  const input=new XRInput();let toggles=0,speed=INITIAL_SPEED;
  left.gamepad.buttons[4].pressed=true;
  for(let i=0;i<72;i++)speed=input.update([right,left],speed,1/72,()=>toggles++);
  assert.equal(toggles,1);assert.ok(Math.abs(speed-14)<1e-10);
  right.gamepad.axes[3]=0.19;assert.equal(input.update([left,right],speed,0.05,()=>toggles++),speed);
  left.gamepad.buttons[4].pressed=false;input.update([left],speed,0.01,()=>toggles++);
  left.gamepad.buttons[4].pressed=true;input.update([left],speed,0.01,()=>toggles++);assert.equal(toggles,2);
  input.update([],speed,0.01,()=>{});assert.equal(input.buttons.size,0);
  assert.equal(stickSpeed(0,1,0.05),0);assert.equal(stickSpeed(24,-1,0.05),24);
  assert.equal(stickSpeed(6,NaN,0.05),6);
});

test('world frame stays fixed while viewer moves and recycling remains finite',()=>{
  const frame=new SpatialFrame(),head=new Vector3(0,1.6,0),group=new Group();
  frame.update(head,0.01,true);head.set(1,1.8,-3);
  for(let i=0;i<120;i++)frame.update(head,1/60,true);
  frame.apply(group);assert.ok(Math.abs(group.position.x-1)<0.001);
  frame.mode='World Space';
  for(let i=0;i<120;i++)frame.update(head,1/60,true);
  frame.apply(group);assert.ok(Math.abs(group.position.x)<0.001);
  const classic=createClassic({profile:'Light',worker:false});
  for(let i=0;i<500;i++){
    head.z=-i*0.02;const cameraZ=frame.update(head,1/72,true);frame.apply(classic.points);
    classic.update(1/72,6,0,cameraZ);
    for(const layer of classic.points.children)assert.ok(Number.isFinite(layer.position.z) && layer.position.z<=cameraZ+0.5001);
  }
  frame.reset();frame.apply(group);assert.equal(group.position.x,0);classic.dispose();
});

function param(){return {value:0,target:0,cancelScheduledValues(){},setTargetAtTime(v){this.target=v;}};}
function node(){return {gain:param(),connections:[],connect(...args){this.connections.push(args);},disconnect(){this.connections=[];},
  positionX:param(),positionY:param(),positionZ:param()};}
test('virtual audio splits stereo to independent mono panners, tracks head/grips, crossfades and mutes lost grips',()=>{
  const listener={...node(),forwardX:param(),forwardY:param(),forwardZ:param(),upX:param(),upY:param(),upZ:param()};
  const context={currentTime:0,listener,destination:{},createGain:node,createPanner:node,createChannelSplitter:n=>{assert.equal(n,2);return node();}};
  const input=node(),speakers=new VirtualSpeakers(context,input);
  assert.deepEqual(speakers.split.connections.map(c=>c.slice(1)),[[0,0],[1,0]]);
  assert.notEqual(speakers.panners[0],speakers.panners[1]);
  for(const p of speakers.panners){assert.equal(p.channelCount,1);assert.equal(p.panningModel,'HRTF');}
  speakers.setActive(true);assert.equal(speakers.direct.gain.target,0);assert.equal(speakers.spatial.gain.target,1);
  speakers.configure({distanceModel:'linear',near:0.2,rolloff:0.7,gain:0.8});
  assert.equal(speakers.panners[1].refDistance,0.2);assert.equal(speakers.panners[0].distanceModel,'linear');
  const head={x:1,y:1.7,z:2},forward={x:0,y:0,z:-1},up={x:0,y:1,z:0};
  speakers.update(head,forward,up,[{x:0.8,y:1.6,z:2},{x:1.2,y:1.6,z:2}]);
  assert.equal(listener.positionY.target,1.7);assert.equal(listener.forwardZ.target,-1);
  assert.equal(speakers.panners[0].positionX.target,0.8);assert.equal(speakers.panners[1].positionX.target,1.2);
  speakers.update(head,forward,up,[null,{x:1.2,y:1.6,z:2}]);
  assert.equal(speakers.channelGains[0].gain.target,0);assert.equal(speakers.channelGains[1].gain.target,1);
  speakers.setActive(false);assert.equal(speakers.direct.gain.target,1);assert.equal(speakers.spatial.gain.target,0);
  speakers.dispose();assert.equal(input.connections.length,0);
});

test('XR panel ray activates a row once without triggering travel; hidden menu falls back',t=>{
  installGlobal(t,'document',{createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})});
  let actions=0,stops=0;
  const menu=new FloatingMenu(new Scene(),()=>[{label:'Palette',value:()=> 'Cosmic',change:d=>actions+=d}],()=>stops++);
  const controller=new Group();addRay(controller);
  menu.select(controller);assert.equal(stops,1);
  menu.toggle(new Vector3(0,1.6,0),new Quaternion());
  controller.position.set(0.2,menu.panel.position.y+0.7-(174/1280)*1.4,0);
  controller.updateMatrixWorld();menu.select(controller);assert.equal(actions,1);assert.equal(stops,1);
  menu.hide();assert.equal(menu.pick(controller),null);menu.dispose();
  controller.userData.menuRay.geometry.dispose();controller.userData.menuRay.material.dispose();
});

test('XR sessions detect support, serialize VR→AR, and expose a re-entry action when activation expires',async t=>{
  installGlobal(t,'document',{createElement:()=>({remove(){}})});
  let current=null,fail=false,shown=0,audio=0;const requested=[];
  class Session extends EventTarget {async end(){current=null;this.dispatchEvent(new Event('end'));}}
  const xr={isSessionSupported:async()=>true,requestSession:async(mode,options)=>{
    requested.push(mode);assert.deepEqual(options.requiredFeatures,['local-floor']);
    if(fail)throw Object.assign(new Error(),{name:'NotAllowedError'});return new Session();
  }};
  installGlobal(t,'navigator',{xr});
  const renderer={xr:{getSession:()=>current,setSession:async s=>{current=s;}}}, status={};
  const manager=new SessionManager(renderer,{append(){}},status,()=>audio++,()=>shown++);
  await manager.detect();await manager.request('immersive-vr');assert.equal(manager.mode,'immersive-vr');
  await manager.request('immersive-ar');assert.equal(manager.mode,'immersive-ar');assert.equal(requested.length,2);
  fail=true;await manager.request('immersive-vr');assert.equal(current,null);assert.equal(shown,1);
  assert.match(status.textContent,/ENTER VR/);assert.equal(manager.mode,null);assert.equal(audio,3);manager.dispose();
});
