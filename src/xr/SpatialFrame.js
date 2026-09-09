import { Vector3 } from 'three';

/** Camera Space follows head translation only; World Space retains a stable origin.
 * Both keep orientation in the reference space and preserve native head tracking. */
export class SpatialFrame {
  constructor() { this.mode='Camera Space'; this.origin=new Vector3(); this.offset=new Vector3(); this.target=new Vector3(); this.initialized=false; }
  reset() { this.initialized=false; this.offset.set(0,0,0); }
  update(head, delta, active) {
    if (!active) { this.reset(); return 0; }
    if (!this.initialized) { this.origin.copy(head); this.initialized=true; }
    const target = this.mode==='Camera Space' ? head : this.origin;
    const blend=1-Math.exp(-delta/0.15);
    this.offset.lerp(this.target.copy(target).sub(this.origin),blend);
    // Camera Z relative to the layer group, not a fixed desktop camera at the origin.
    return head.z-this.offset.z;
  }
  apply(group, baseY=1.6) { group.position.set(this.offset.x,baseY+this.offset.y,this.offset.z); }
}
