export const speakerDefaults = Object.freeze({ distanceModel:'inverse', near:0.15, rolloff:1, gain:1 });
const ramp = (param, value, now) => { param.cancelScheduledValues(now); param.setTargetAtTime(value,now,0.025); };
const position = (node,p,now) => {
  if (node.positionX) { ramp(node.positionX,p.x,now); ramp(node.positionY,p.y,now); ramp(node.positionZ,p.z,now); }
  else node.setPosition(p.x,p.y,p.z);
};

/** The master volume stays upstream. Only this output stage changes during A/B. */
export class VirtualSpeakers {
  constructor(context, input) {
    this.context=context;this.input=input;this.settings={...speakerDefaults};this.active=false;
    this.direct=context.createGain();this.spatial=context.createGain();this.spatial.gain.value=0;
    input.connect(this.direct);this.direct.connect(context.destination);
    this.split=context.createChannelSplitter(2);input.connect(this.split);
    this.panners=[context.createPanner(),context.createPanner()];
    this.channelGains=[context.createGain(),context.createGain()];
    this.panners.forEach((p,i)=>{
      p.panningModel='HRTF';p.channelCount=1;p.channelCountMode='explicit';p.maxDistance=3;
      this.channelGains[i].gain.value=0;
      this.split.connect(p,i,0);p.connect(this.channelGains[i]);this.channelGains[i].connect(this.spatial);
    });
    this.spatial.connect(context.destination);this.configure({});
  }
  configure(values) {
    Object.assign(this.settings,values);
    this.settings.distanceModel=this.settings.distanceModel==='linear'?'linear':'inverse';
    this.settings.near=Math.max(0.05,Math.min(1,this.settings.near));
    this.settings.rolloff=Math.max(0,Math.min(1,this.settings.rolloff));
    this.settings.gain=Math.max(0,Math.min(2,this.settings.gain));
    for(const p of this.panners){p.distanceModel=this.settings.distanceModel;p.refDistance=this.settings.near;p.rolloffFactor=this.settings.rolloff;}
    ramp(this.spatial.gain,this.active?this.settings.gain:0,this.context.currentTime);
  }
  setActive(active) {
    if(active===this.active)return;
    this.active=active;const now=this.context.currentTime;
    ramp(this.direct.gain,active?0:1,now);ramp(this.spatial.gain,active?this.settings.gain:0,now);
  }
  update(head,forward,up,grips) {
    const now=this.context.currentTime, listener=this.context.listener;
    position(listener,head,now);
    if(listener.forwardX){
      for(const [key,v] of [['forwardX',forward.x],['forwardY',forward.y],['forwardZ',forward.z],['upX',up.x],['upY',up.y],['upZ',up.z]]) ramp(listener[key],v,now);
    } else listener.setOrientation(forward.x,forward.y,forward.z,up.x,up.y,up.z);
    this.panners.forEach((p,i)=>{const grip=grips[i];if(grip)position(p,grip,now);ramp(this.channelGains[i].gain,grip?1:0,now);});
  }
  dispose() { this.input.disconnect();for(const node of [this.direct,this.spatial,this.split,...this.panners,...this.channelGains])node.disconnect(); }
}
