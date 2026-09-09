import { DataTexture, RGBAFormat, LinearFilter } from 'three';

export const shapes = ['Circle', 'Heart', 'Smiley', 'Star', 'Diamond', 'Flower', 'Spiral', 'Triangle'];
export const pulseShapes = [...shapes.slice(0, 7), 'Random Mix'];
export const glyphShapes = ['Star', 'Heart', 'Smiley', 'Circle', 'Triangle', 'Diamond', 'Random Mix'];

// Original vector outlines rasterized once. All instances share this 128 KiB atlas.
export function createShapeAtlas() {
  const size = 64, data = new Uint8Array(size * size * 8 * 4);
  const polar = (n, fn) => Array.from({ length: n + 1 }, (_, i) => {
    const a = i / n * Math.PI * 2, r = fn(a, i); return [Math.cos(a)*r, Math.sin(a)*r];
  });
  const circle = polar(80, () => 0.7);
  const paths = [
    [circle],
    [Array.from({ length: 121 }, (_, i) => {
      const t = i / 120 * Math.PI * 2;
      return [16*Math.sin(t)**3/21, (13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))/21];
    })],
    [circle, ...[-0.25,0.25].map(x => polar(20, () => 0.075).map(p => [p[0]+x,p[1]+0.2])),
      Array.from({ length: 31 }, (_, i) => { const a = Math.PI * (1.15 + i / 30 * 0.7); return [Math.cos(a)*0.4,Math.sin(a)*0.4]; })],
    [polar(10, (_, i) => i%2 ? 0.32 : 0.78).map(([x,y]) => [-y,x])],
    [[[0,0.8],[0.65,0],[0,-0.8],[-0.65,0],[0,0.8]]],
    [polar(120, a => 0.54+0.2*Math.cos(5*a))],
    [Array.from({ length: 151 }, (_, i) => { const a=i/150*Math.PI*5,r=0.08+i/150*0.68; return [Math.cos(a)*r,Math.sin(a)*r]; })],
    [[[0,0.8],[-0.72,-0.55],[0.72,-0.55],[0,0.8]]],
  ];
  for (let shape=0; shape<8; shape++) for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const px=(x+0.5)/size*2-1, py=(y+0.5)/size*2-1;
    let distance=Infinity;
    for (const path of paths[shape]) for(let i=1;i<path.length;i++) {
      const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/(dx*dx+dy*dy || 1)));
      distance=Math.min(distance,Math.hypot(px-a[0]-t*dx,py-a[1]-t*dy));
    }
    const k=(y*size*8+shape*size+x)*4;
    data[k]=data[k+1]=data[k+2]=255;
    data[k+3]=Math.round(Math.exp(-Math.pow(distance/0.045,2))*255);
  }
  const texture=new DataTexture(data,size*8,size,RGBAFormat);
  texture.minFilter=texture.magFilter=LinearFilter; texture.needsUpdate=true;
  return texture;
}
