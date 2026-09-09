import { InstancedBufferGeometry, InstancedBufferAttribute, PlaneGeometry, DynamicDrawUsage } from 'three';

export const MAX_RIBBON_LENGTH = 12;
export const MAX_RIBBON_SEGMENTS = 600;

// Keep consecutive mathematical steps only, in short runs. Never nearest-neighbor substitutes.
export function ribbonSegments(points) {
  const result = [];
  for (let i=0;i<points.length/3-1;i++) {
    const length=Math.hypot(points[(i+1)*3]-points[i*3],points[(i+1)*3+1]-points[i*3+1]);
    if (i%12<8 && length>0.025 && length<=MAX_RIBBON_LENGTH) result.push(i);
  }
  // Shuffle runs, not individual vertices: density remains distributed across the orbit.
  result.sort((a,b) => ((Math.floor(a/12)*2654435761)>>>0)-((Math.floor(b/12)*2654435761)>>>0) || a-b);
  return result.slice(0,MAX_RIBBON_SEGMENTS);
}

export function createRibbonGeometry() {
  const plane=new PlaneGeometry(1,1,6,1), geometry=new InstancedBufferGeometry();
  geometry.index=plane.index; geometry.attributes.position=plane.attributes.position; geometry.attributes.uv=plane.attributes.uv;
  for (const key of ['start','end','normalA','normalB']) geometry.setAttribute(key,new InstancedBufferAttribute(new Float32Array(MAX_RIBBON_SEGMENTS*3),3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('orbitIndex',new InstancedBufferAttribute(new Float32Array(MAX_RIBBON_SEGMENTS),1).setUsage(DynamicDrawUsage));
  geometry.instanceCount=0;
  return geometry;
}

export function updateRibbonGeometry(geometry, points) {
  const indices=ribbonSegments(points), n=points.length/3;
  const normal=(i, fallbackA, fallbackB) => {
    let a=Math.max(0,i-1),b=Math.min(n-1,i+1);
    if (Math.hypot(points[a*3]-points[i*3],points[a*3+1]-points[i*3+1])>MAX_RIBBON_LENGTH) a=i;
    if (Math.hypot(points[b*3]-points[i*3],points[b*3+1]-points[i*3+1])>MAX_RIBBON_LENGTH) b=i;
    if(a===b){a=fallbackA;b=fallbackB;}
    const dx=points[b*3]-points[a*3],dy=points[b*3+1]-points[a*3+1],d=Math.hypot(dx,dy)||1;
    return [-dy/d,dx/d,0];
  };
  indices.forEach((i,k) => {
    geometry.attributes.start.array.set(points.subarray(i*3,i*3+3),k*3);
    geometry.attributes.end.array.set(points.subarray((i+1)*3,(i+1)*3+3),k*3);
    geometry.attributes.normalA.array.set(normal(i,i,i+1),k*3);
    geometry.attributes.normalB.array.set(normal(i+1,i,i+1),k*3);
    geometry.attributes.orbitIndex.array[k]=i;
  });
  for(const attribute of Object.values(geometry.attributes)) if(attribute.isInstancedBufferAttribute) attribute.needsUpdate=true;
  geometry.userData.available=indices.length;
}
