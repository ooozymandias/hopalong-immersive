export class SessionManager {
  constructor(renderer, root, status, startAudio, showUI) {
    this.renderer=renderer;this.status=status;this.startAudio=startAudio;this.showUI=showUI;
    this.mode=null;this.busy=false;this.disposed=false;this.support={};this.buttons={};
    for(const mode of ['immersive-vr','immersive-ar']){
      const button=document.createElement('button');button.type='button';button.disabled=true;
      button.textContent=mode==='immersive-vr'?'VR…':'Mixed Reality…';
      button.onclick=()=>void this.request(mode);root.append(button);this.buttons[mode]=button;
    }
    this.detect();
  }
  async detect() {
    for(const mode of Object.keys(this.buttons)){
      try{this.support[mode]=!!(await navigator.xr?.isSessionSupported(mode));}catch{this.support[mode]=false;}
      if(this.disposed)return;
      this.buttons[mode].disabled=!this.support[mode];
      this.buttons[mode].textContent=this.support[mode]?(mode==='immersive-ar'?'ENTER MR':'ENTER VR'):(mode==='immersive-ar'?'MR indisponible':'VR indisponible');
    }
  }
  async request(mode) {
    if(this.busy || !this.support[mode] || this.disposed)return;
    this.busy=true;this.startAudio();let next=null;
    try{
      const current=this.renderer.xr.getSession();
      const wasMode=this.mode;
      if(current){await current.end();if(wasMode===mode)return;}
      if(this.disposed)return;
      next=await navigator.xr.requestSession(mode,{requiredFeatures:['local-floor']});
      if(this.disposed){await next.end();return;}
      this.mode=mode;
      next.addEventListener('end',()=>{if(this.mode===mode)this.mode=null;},{once:true});
      await this.renderer.xr.setSession(next);
      this.status.textContent='XR : X gauche = menu · stick droit = vitesse.';
    }catch(error){
      if(next)await next.end().catch(()=>{});
      this.mode=null;this.showUI();
      this.status.textContent=error.name==='NotAllowedError'
        ? `Nouvelle interaction requise : choisissez ${mode==='immersive-ar'?'ENTER MR':'ENTER VR'} pour continuer.`
        : `Session impossible (${error.name}). Réessayez avec ENTER VR ou ENTER MR.`;
    }finally{this.busy=false;}
  }
  dispose(){this.disposed=true;void this.renderer.xr.getSession()?.end().catch(()=>{});for(const button of Object.values(this.buttons))button.remove();}
}
