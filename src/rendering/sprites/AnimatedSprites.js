import * as THREE from 'three';

export function demoAtlas() {
  const tile = 32, columns = 4, rows = 4, width = tile * columns, height = tile * rows;
  const data = new Uint8Array(width * height * 4);
  for (let frame = 0; frame < 16; frame++) for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
    const r = Math.hypot(x - 15.5, y - 15.5);
    const radius = 6 + 3 * Math.sin(frame / 16 * Math.PI * 2);
    const alpha = Math.exp(-Math.pow((r - radius) / 1.5, 2));
    const k = ((Math.floor(frame / columns) * tile + y) * width + frame % columns * tile + x) * 4;
    data[k] = 150; data[k + 1] = 230; data[k + 2] = 255; data[k + 3] = Math.round(alpha * 255);
  }
  return { data, width, height, columns, rows, delays: Array(16).fill(80) };
}

export class AnimatedSprites {
  constructor() {
    this.count = 100; this.anchors = []; this.time = 0;
    const plane = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = plane.index;
    this.geometry.attributes.position = plane.attributes.position;
    this.geometry.attributes.uv = plane.attributes.uv;
    this.offsets = new Float32Array(250 * 3);
    this.geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(this.offsets, 3).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { atlas: { value: null }, grid: { value: new THREE.Vector2() }, frame: { value: 0 } },
      vertexShader: `
        attribute vec3 offset;
        varying vec2 vUv; varying float fade;
        void main() {
          vec4 center = modelViewMatrix * vec4(offset,1.0);
          fade = exp(-0.0025*center.z*center.z) * smoothstep(0.4,1.4,length(center.xyz));
          center.xy += position.xy * 0.75;
          gl_Position=projectionMatrix*center; vUv=uv;
        }`,
      fragmentShader: `
        uniform sampler2D atlas; uniform vec2 grid; uniform float frame;
        varying vec2 vUv; varying float fade;
        void main(){
          vec2 cell=vec2(mod(frame,grid.x),floor(frame/grid.x));
          vec2 uv=(cell+vec2(vUv.x,1.0-vUv.y))/grid;
          vec4 c=texture2D(atlas,uv); if(c.a<0.02)discard;
          gl_FragColor=vec4(c.rgb,c.a*fade);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false; this.mesh.visible = false;
    this.setAtlas(demoAtlas());
  }
  setAtlas(atlas) {
    const texture = new THREE.DataTexture(atlas.data, atlas.width, atlas.height, THREE.RGBAFormat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    this.material.uniforms.atlas.value?.dispose();
    this.material.uniforms.atlas.value = texture;
    this.material.uniforms.grid.value.set(atlas.columns, atlas.rows);
    this.delays = atlas.delays; this.duration = atlas.delays.reduce((a,b) => a+b,0); this.time = 0;
  }
  bind(layers, count = this.count) {
    this.count = count; this.anchors = [];
    for (const layer of layers) layer.geometry.attributes.spriteMask.array.fill(0);
    for (let i = 0; i < count; i++) {
      const layerIndex = i % layers.length;
      const layer = layers[layerIndex];
      const capacity = layer.geometry.attributes.position.count;
      const index = (Math.floor(i / layers.length) * 977 + layerIndex * 37) % capacity;
      layer.geometry.attributes.spriteMask.array[index] = 1;
      this.anchors.push({ layerIndex, index });
    }
    for (const layer of layers) layer.geometry.attributes.spriteMask.needsUpdate = true;
    this.geometry.instanceCount = count;
  }
  update(layers, delta) {
    if (!this.mesh.visible) return;
    this.time = (this.time + delta * 1000) % this.duration;
    let t = this.time, frame = 0;
    while (frame < this.delays.length - 1 && t >= this.delays[frame]) t -= this.delays[frame++];
    this.material.uniforms.frame.value = frame;
    for (let i = 0; i < this.anchors.length; i++) {
      const { layerIndex, index } = this.anchors[i], layer = layers[layerIndex];
      const positions = layer.geometry.attributes.position.array;
      const x = positions[index * 3], y = positions[index * 3 + 1];
      const c = Math.cos(layer.rotation.z), s = Math.sin(layer.rotation.z);
      this.offsets[i * 3] = x*c-y*s; this.offsets[i*3+1] = x*s+y*c; this.offsets[i*3+2] = layer.position.z;
    }
    this.geometry.attributes.offset.needsUpdate = true;
  }
  dispose() { this.material.uniforms.atlas.value.dispose(); this.material.dispose(); this.geometry.dispose(); }
}
