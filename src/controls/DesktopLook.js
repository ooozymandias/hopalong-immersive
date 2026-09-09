// Drag-to-look, without moving the viewer or interfering with head tracking.
export class DesktopLook {
  constructor(camera, canvas) {
    this.enabled = true;
    let pointer = null;
    let yaw = 0;
    let pitch = 0;
    const abort = new AbortController();
    const options = { signal: abort.signal };
    canvas.addEventListener('pointerdown', (event) => {
      if (!this.enabled || event.button !== 0) return;
      pointer = event.pointerId;
      canvas.setPointerCapture(pointer);
    }, options);
    canvas.addEventListener('pointermove', (event) => {
      if (!this.enabled || pointer !== event.pointerId) return;
      yaw -= event.movementX * 0.003;
      pitch = Math.max(-Math.PI * 0.49, Math.min(Math.PI * 0.49, pitch - event.movementY * 0.003));
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }, options);
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(event, () => { pointer = null; }, options);
    }
    this.reset = () => { pointer = null; yaw = 0; pitch = 0; camera.rotation.set(0, 0, 0); };
    this.dispose = () => abort.abort();
  }
}
