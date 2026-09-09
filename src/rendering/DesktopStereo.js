import { StereoCamera, PerspectiveCamera, Vector2, Vector4, WebGLRenderTarget, ShaderMaterial, Matrix3 } from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Column-major coefficients used by Three.js AnaglyphEffect (MIT), from
// Eric Dubois' red/cyan least-squares projection. Applied to linear RGB.
export const DUBOIS_LEFT = [0.456100, -0.0400822, -0.0152161, 0.500484, -0.0378246, -0.0205971, 0.176381, -0.0157589, -0.00546856];
export const DUBOIS_RIGHT = [-0.0434706, 0.378476, -0.0721527, -0.0879388, 0.73364, -0.112961, -0.00155529, -0.0184503, 1.2264];
export function eyeOrder(mode) { return mode === 'Cross-eye Stereo' ? ['right', 'left'] : ['left', 'right']; }
export function stereoZoom(framing, custom = 1) {
  // Half-width viewport: half the projection zoom preserves Mono horizontal FOV.
  return framing === 'Fit' ? 0.5 : framing === 'Custom' ? custom : 1;
}

export class DesktopStereo {
  constructor(renderer) {
    this.renderer = renderer;
    this.mode = 'Mono'; this.separation = 0.3; this.quality = 0.75;
    this.framing = 'Fit'; this.zoom = 0.5; this.framingCamera = new PerspectiveCamera();
    this.stereo = new StereoCamera();
    this.size = new Vector2(); this.viewport = new Vector4(); this.scissor = new Vector4();
    this.targets = null;
  }
  createTargets() {
    if (this.targets) return;
    this.targets = [new WebGLRenderTarget(1, 1), new WebGLRenderTarget(1, 1)];
    this.material = new ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        left: { value: this.targets[0].texture }, right: { value: this.targets[1].texture },
        matrixLeft: { value: new Matrix3().fromArray(DUBOIS_LEFT) },
        matrixRight: { value: new Matrix3().fromArray(DUBOIS_RIGHT) },
      },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D left;
        uniform sampler2D right;
        uniform mat3 matrixLeft;
        uniform mat3 matrixRight;
        void main() {
          vec3 rgb = matrixLeft * texture2D(left,vUv).rgb + matrixRight * texture2D(right,vUv).rgb;
          gl_FragColor=vec4(clamp(rgb,0.0,1.0),1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  render(scene, camera, delta) {
    const renderer = this.renderer;
    // This branch must precede any offscreen target, viewport or eye override.
    if (renderer.xr.isPresenting || this.mode === 'Mono') {
      if (this.targets) this.dispose();
      renderer.render(scene, camera); return;
    }
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    this.stereo.eyeSep += (this.separation - this.stereo.eyeSep) * (1 - Math.exp(-delta / 0.5));
    this.stereo.aspect = this.mode === 'Dubois Anaglyph' ? 1 : 0.5;
    const framed = this.framingCamera;
    framed.copy(camera, false);
    framed.matrixWorld.copy(camera.matrixWorld);
    if (this.mode !== 'Dubois Anaglyph') framed.zoom = camera.zoom * stereoZoom(this.framing, this.zoom);
    framed.updateProjectionMatrix();
    this.stereo.update(framed);
    const target = renderer.getRenderTarget();
    renderer.getViewport(this.viewport); renderer.getScissor(this.scissor);
    const scissorTest = renderer.getScissorTest();
    const autoClear = renderer.autoClear;
    renderer.getSize(this.size);
    try {
      if (this.mode === 'Dubois Anaglyph') {
        this.createTargets();
        const width = Math.max(1, Math.round(this.size.x * renderer.getPixelRatio() * this.quality));
        const height = Math.max(1, Math.round(this.size.y * renderer.getPixelRatio() * this.quality));
        renderer.setScissorTest(false);
        for (let i = 0; i < 2; i++) {
          this.targets[i].setSize(width, height);
          renderer.setRenderTarget(this.targets[i]);
          renderer.render(scene, i === 0 ? this.stereo.cameraL : this.stereo.cameraR);
        }
        renderer.setRenderTarget(target);
        renderer.setViewport(0, 0, this.size.x, this.size.y);
        this.quad.render(renderer);
      } else {
        renderer.autoClear = false;
        renderer.clear();
        renderer.setScissorTest(true);
        const eyes = eyeOrder(this.mode).map((eye) => eye === 'left' ? this.stereo.cameraL : this.stereo.cameraR);
        const half = Math.floor(this.size.x / 2);
        for (let i = 0; i < 2; i++) {
          const x = i * half, width = i === 0 ? half : this.size.x - half;
          renderer.setViewport(x, 0, width, this.size.y);
          renderer.setScissor(x, 0, width, this.size.y);
          renderer.render(scene, eyes[i]);
        }
      }
    } finally {
      renderer.setRenderTarget(target); renderer.setViewport(this.viewport);
      renderer.setScissor(this.scissor); renderer.setScissorTest(scissorTest); renderer.autoClear = autoClear;
    }
  }
  dispose() {
    this.targets?.forEach((target) => target.dispose()); this.material?.dispose(); this.quad?.dispose();
    this.targets = null; this.material = null; this.quad = null;
  }
}
