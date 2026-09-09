import * as THREE from 'three';

export class FloatingMenu {
  constructor(scene, rows, onFallback) {
    this.rows=rows;this.onFallback=onFallback;this.hover=-1;this.elapsed=0;this.signature='';
    this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=1280;
    this.ctx=this.canvas.getContext('2d');this.texture=new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.minFilter=THREE.LinearFilter;this.texture.generateMipmaps=false;
    this.panel=new THREE.Mesh(new THREE.PlaneGeometry(1.12,1.4),new THREE.MeshBasicMaterial({map:this.texture,depthTest:false,depthWrite:false,toneMapped:false}));
    this.panel.renderOrder=10000;this.panel.visible=false;scene.add(this.panel);
    this.raycaster=new THREE.Raycaster();this.rotation=new THREE.Matrix4();this.origin=new THREE.Vector3();this.direction=new THREE.Vector3();
    this.forward=new THREE.Vector3();this.eye=new THREE.Vector3();this.hits=[];
    this.redraw();
  }
  get visible(){return this.panel.visible;}
  hide(){this.panel.visible=false;this.hover=-1;}
  toggle(head,quaternion) {
    if(this.visible){this.hide();return;}
    this.eye.copy(head);this.forward.set(0,0,-1).applyQuaternion(quaternion);this.forward.y=0;
    if(this.forward.lengthSq()<0.01)this.forward.set(0,0,-1);
    this.forward.normalize();this.panel.position.copy(head).addScaledVector(this.forward,1.7);this.panel.position.y-=0.12;
    this.panel.lookAt(head.x,this.panel.position.y,head.z);this.panel.visible=true;this.panel.updateMatrixWorld(true);this.redraw();
  }
  pick(controller) {
    if(!this.visible || !controller.visible)return null;
    controller.updateWorldMatrix(true,false);
    this.origin.setFromMatrixPosition(controller.matrixWorld);this.rotation.extractRotation(controller.matrixWorld);
    this.direction.set(0,0,-1).transformDirection(this.rotation);
    this.raycaster.set(this.origin,this.direction);this.hits.length=0;
    this.raycaster.intersectObject(this.panel,false,this.hits);
    const hit=this.hits[0];if(!hit)return null;
    const y=(1-hit.uv.y)*1280,index=Math.floor((y-130)/88);
    if(index<0 || index>=this.rows().length)return null;
    return {index,direction:hit.uv.x<0.5?-1:1,distance:hit.distance};
  }
  select(controller) {
    if(!this.visible){this.onFallback();return;}
    const hit=this.pick(controller);if(hit){this.rows()[hit.index].change(hit.direction);this.redraw();}
  }
  update(delta,controllers) {
    this.elapsed+=delta;let hover=-1;
    for(const controller of controllers){
      const hit=this.pick(controller);if(hit)hover=hit.index;
      const ray=controller.userData.menuRay;ray.visible=this.visible && controller.visible;
      if(ray.visible)ray.scale.z=hit?.distance ?? 3;
    }
    if(this.visible && (hover!==this.hover || this.elapsed>0.15)){
      this.hover=hover;this.elapsed=0;const signature=JSON.stringify(this.rows().map(r=>[r.label,r.value()]))+hover;
      if(signature!==this.signature){this.signature=signature;this.redraw();}
    }
  }
  redraw() {
    const c=this.ctx;c.fillStyle='#07121e';c.fillRect(0,0,1024,1280);
    c.fillStyle='#ffffff';c.font='bold 40px sans-serif';c.fillText('Hopalong · XR Controls',46,62);
    c.fillStyle='#b9ccdf';c.font='25px sans-serif';c.fillText('X : fermer   ·   Ray + trigger : choisir   ·   < / >',46,105);
    this.rows().forEach((row,i)=>{
      const y=130+i*88;c.fillStyle=this.hover===i?'#26465b':'#132638';c.fillRect(24,y,976,80);
      c.fillStyle='#a6c4d5';c.font='23px sans-serif';c.fillText(row.label,76,y+28);
      c.fillStyle='#ffffff';c.font='28px sans-serif';c.fillText(String(row.value()),76,y+63,865);
      c.fillStyle='#f8d481';c.fillText('‹',36,y+52);c.fillText('›',964,y+52);
    });
    this.texture.needsUpdate=true;
  }
  dispose(){this.panel.removeFromParent();this.panel.geometry.dispose();this.panel.material.dispose();this.texture.dispose();}
}

export function addRay(controller) {
  const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]);
  const ray=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x86e5ff,depthTest:false,transparent:true,opacity:0.85}));
  ray.renderOrder=10001;ray.visible=false;controller.add(ray);controller.userData.menuRay=ray;return ray;
}
