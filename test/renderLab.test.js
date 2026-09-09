import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector4 } from 'three';
import { createClassic } from '../src/classic/createClassic.js';
import { renderModes } from '../src/rendering/renderModes.js';
import { ribbonSegments, MAX_RIBBON_LENGTH } from '../src/rendering/lab/ribbonGeometry.js';
import { createShapeAtlas, shapes } from '../src/rendering/lab/shapeAtlas.js';
import { generateOrbit } from '../src/classic/generateOrbit.js';
import { DesktopStereo } from '../src/rendering/DesktopStereo.js';

test('ten stable render modes, GIF experimental, and artistic separation stays desktop only', () => {
  assert.deepEqual(Object.keys(renderModes).filter(k=>!renderModes[k].experimental),
    ['Points','Lines','Mixed','Pulse','Soft Orbs','Streaks','Comets','Constellations','Ribbons','Glyphs']);
  const stereo=new DesktopStereo({xr:{isPresenting:true},render(){}});
  assert.equal(stereo.separation,0.3);
  stereo.mode='Parallel Stereo';stereo.separation=0.5;
  stereo.render({}, {}, 0.01); assert.equal(stereo.targets,null);
});

test('ribbons preserve consecutive mathematical endpoints, break long jumps and reuse allocations', () => {
  const classic=createClassic({worker:false,initialComposition:'Through Forms'});
  classic.setRenderMode('Ribbons');
  const layer=classic.points.children[0], g=layer.userData.lab.ribbon.geometry;
  assert.ok(g.userData.available>0);
  const positions=layer.geometry.attributes.position.array;
  const selected=ribbonSegments(positions);
  for(let k=0;k<selected.length;k++) {
    const i=selected[k];
    assert.deepEqual(g.attributes.start.array.slice(k*3,k*3+3),positions.slice(i*3,i*3+3));
    assert.deepEqual(g.attributes.end.array.slice(k*3,k*3+3),positions.slice((i+1)*3,(i+1)*3+3));
    assert.ok(Math.hypot(positions[i*3]-positions[(i+1)*3],positions[i*3+1]-positions[(i+1)*3+1])<=MAX_RIBBON_LENGTH);
  }
  const buffer=g.attributes.start.array, full=g.instanceCount;
  classic.setLabSetting('ribbonDensity',0.1);assert.ok(g.instanceCount<full);
  for(let i=0;i<240;i++)classic.update(1/60,24,0.2);
  assert.equal(g.attributes.start.array,buffer);
  classic.setProfile('Light');classic.update(0.01,0,0);classic.dispose();
});

test('atlas has eight distinct nonempty shapes, one shared texture and varied deterministic instances', () => {
  const atlas=createShapeAtlas(), {data,width}=atlas.image;
  const cells=shapes.map((_,i)=>{
    const alpha=[];
    for(let y=0;y<64;y++)for(let x=0;x<64;x++)alpha.push(data[(y*width+i*64+x)*4+3]);
    assert.ok(alpha.some(a=>a>200));return alpha.join(',');
  });
  assert.equal(new Set(cells).size,8);atlas.dispose();
  const classic=createClassic({profile:'Light',worker:false});classic.setRenderMode('Pulse');
  const a=classic.points.children[0].userData.lab.quad,b=classic.points.children[1].userData.lab.quad;
  assert.equal(a.material.uniforms.shapeAtlas.value,b.material.uniforms.shapeAtlas.value);
  classic.setLabSetting('pulseShape','Random Mix');assert.equal(a.material.uniforms.shape.value,-1);
  const count=a.geometry.instanceCount;
  classic.setLabSetting('labDensity',0.5);assert.ok(a.geometry.instanceCount<count);
  classic.setRenderMode('Glyphs');assert.equal(a.material.uniforms.mode.value,5);
  classic.setRenderMode('Points');assert.equal(a.visible,false);classic.dispose();
});

test('motion histories are per eye, follow camera movement and reset across layer recycling', () => {
  const classic=createClassic({profile:'Light',worker:false});classic.setRenderMode('Comets');
  const layer=classic.points.children[0], lab=layer.userData.lab, q=lab.quad;
  const camera=new PerspectiveCamera(), other=new PerspectiveCamera();
  const renderer={getCurrentViewport:v=>v.copy(new Vector4(0,0,1280,720))};
  classic.points.updateMatrixWorld();camera.updateMatrixWorld();
  q.onBeforeRender(renderer,{},camera);lab.update(1/60,16,0);
  camera.position.x=0.1;camera.updateMatrixWorld();q.onBeforeRender(renderer,{},camera);
  assert.equal(q.material.uniforms.historyValid.value,1);
  q.onBeforeRender(renderer,{},other);assert.equal(q.material.uniforms.historyValid.value,0);
  lab.recycle();q.onBeforeRender(renderer,{},camera);assert.equal(q.material.uniforms.historyValid.value,0);
  classic.setRenderMode('Streaks');assert.equal(q.material.uniforms.mode.value,3);
  classic.dispose();
});

test('constellations use the existing bounded neighbor edges and independent density', () => {
  const classic=createClassic({profile:'Light',worker:false});classic.setRenderMode('Constellations');
  const lines=classic.points.children[0].children[0]; const count=lines.geometry.drawRange.count;
  classic.setLineDensity(0);assert.equal(lines.geometry.drawRange.count,count);
  classic.setLabSetting('connectionDensity',0);assert.equal(lines.visible,false);
  classic.setLabSetting('connectionDensity',0.5);assert.ok(lines.geometry.drawRange.count>count);
  classic.dispose();
});
