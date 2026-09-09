import * as THREE from 'three';
import { quadVertex, quadFragment, ribbonVertex, ribbonFragment } from './shaders.js';
import { createRibbonGeometry, updateRibbonGeometry } from './ribbonGeometry.js';
import { shapes } from './shapeAtlas.js';

export const labDefaults = Object.freeze({ pulseShape:'Circle', glyphShape:'Random Mix', trailLength:1,
  connectionDensity:0.12, ribbonWidth:0.18, ribbonDensity:0.35, ribbonTwist:0.6, labDensity:1 });
export const quadModes = { Pulse:1, 'Soft Orbs':2, Streaks:3, Comets:4, Glyphs:5 };

/** One lazy renderer per layer, independent of orbit generation. All objects are batched. */
export class LayerRender {
  constructor(layer, atlas) {
    this.layer=layer; this.atlas=atlas; this.quad=null; this.ribbon=null;
    this.time=0; this.speed=0; this.rotation=0; this.delta=0;
    this.histories=new WeakMap(); this.viewport=new THREE.Vector4(); this.mvp=new THREE.Matrix4();
  }
  material(vertexShader,fragmentShader) {
    return new THREE.ShaderMaterial({ vertexShader,fragmentShader,transparent:true,
      depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
      uniforms:{paletteMap:this.layer.material.uniforms.paletteMap,hue:this.layer.material.uniforms.hue,
        shapeAtlas:{value:this.atlas},mode:{value:1},time:{value:0},speed:{value:0},rotationSpeed:{value:0},
        frameDelta:{value:1/60},previousMVP:{value:new THREE.Matrix4()},historyValid:{value:0},
        viewportSize:{value:new THREE.Vector2()},trailLength:{value:1},shape:{value:0},
        ribbonWidth:{value:0.18},ribbonTwist:{value:0.6}} });
  }
  createQuad() {
    const plane=new THREE.PlaneGeometry(1,1), g=new THREE.InstancedBufferGeometry();
    g.index=plane.index; g.attributes.position=plane.attributes.position; g.attributes.uv=plane.attributes.uv;
    const source=this.layer.geometry.attributes.position;
    g.setAttribute('anchor',new THREE.InstancedBufferAttribute(source.array,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('instanceSeed',new THREE.InstancedBufferAttribute(Float32Array.from({length:source.count},(_,i)=>i),1));
    this.quad=new THREE.Mesh(g,this.material(quadVertex,quadFragment)); this.quad.frustumCulled=false;
    this.quad.onBeforeRender=(renderer,scene,camera) => {
      const u=this.quad.material.uniforms, v=camera.viewport ?? renderer.getCurrentViewport(this.viewport);
      u.viewportSize.value.set(v.z,v.w);
      this.mvp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(this.quad.matrixWorld);
      let history=this.histories.get(camera);
      if(!history){history={matrix:this.mvp.clone(),time:this.time};this.histories.set(camera,history);}
      const dt=this.time-history.time;
      u.previousMVP.value.copy(history.matrix); u.historyValid.value=dt>0 && dt<0.15?1:0;
      u.frameDelta.value=dt>0?dt:1/60;
      history.matrix.copy(this.mvp);history.time=this.time;
    };
    this.layer.add(this.quad);
  }
  createRibbon() {
    this.ribbon=new THREE.Mesh(createRibbonGeometry(),this.material(ribbonVertex,ribbonFragment));
    this.ribbon.frustumCulled=false; this.layer.add(this.ribbon);
    updateRibbonGeometry(this.ribbon.geometry,this.layer.geometry.attributes.position.array);
  }
  configure(mode,settings,budgetRatio) {
    if(quadModes[mode] && !this.quad) this.createQuad();
    if(mode==='Ribbons' && !this.ribbon) this.createRibbon();
    if(this.quad){
      this.quad.visible=!!quadModes[mode];
      const u=this.quad.material.uniforms;
      u.mode.value=quadModes[mode] || 1; u.trailLength.value=settings.trailLength;
      u.shape.value=shapes.indexOf(mode==='Glyphs'?settings.glyphShape:settings.pulseShape);
      const fraction=mode==='Pulse'?0.035:mode==='Glyphs'?0.025:mode==='Comets'?0.7:1;
      this.quad.geometry.instanceCount=Math.floor(this.layer.geometry.attributes.position.count*budgetRatio*fraction*settings.labDensity);
    }
    if(this.ribbon){
      this.ribbon.visible=mode==='Ribbons';
      this.ribbon.geometry.instanceCount=Math.floor(this.ribbon.geometry.userData.available*settings.ribbonDensity*budgetRatio*settings.labDensity);
      this.ribbon.material.uniforms.ribbonWidth.value=settings.ribbonWidth;
      this.ribbon.material.uniforms.ribbonTwist.value=settings.ribbonTwist;
    }
  }
  recycle() {
    this.histories=new WeakMap();
    if(this.quad) this.quad.geometry.attributes.anchor.needsUpdate=true;
    if(this.ribbon) updateRibbonGeometry(this.ribbon.geometry,this.layer.geometry.attributes.position.array);
  }
  update(delta,speed,rotation) {
    this.time+=delta;
    for(const mesh of [this.quad,this.ribbon]) if(mesh?.visible){
      const u=mesh.material.uniforms;u.time.value=this.time;u.speed.value=speed;u.rotationSpeed.value=rotation;
    }
  }
  dispose() {
    for(const mesh of [this.quad,this.ribbon]) if(mesh){this.layer.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}
  }
}
