export const quadVertex = `
attribute vec3 anchor;
attribute float instanceSeed;
uniform float mode, time, speed, trailLength, shape, rotationSpeed, frameDelta;
uniform vec2 viewportSize;
uniform mat4 previousMVP;
uniform float historyValid;
uniform sampler2D paletteMap;
uniform float hue;
varying vec2 vUv;
varying vec3 tint;
varying float fade, symbol, headFraction;
void main(){
  float seed=fract(sin(instanceSeed*12.9898+0.1)*43758.5453);
  vec4 view=modelViewMatrix*vec4(anchor,1.0), clip=projectionMatrix*view;
  float depth=max(0.1,-view.z);
  tint=texture2D(paletteMap,vec2(fract(hue+length(anchor.xy)*0.012+anchor.x*0.004),0.5)).rgb;
  fade=exp(-0.0025*view.z*view.z)*smoothstep(0.3,1.4,length(view.xyz))*(0.75+seed*0.4);
  vUv=uv; symbol=shape<0.0 ? floor(seed*(mode<1.5 ? 7.0 : 6.0)) : shape;
  // Glyph random mix includes triangle and excludes flower/spiral.
  if(mode>4.5 && shape<0.0 && symbol>4.5) symbol=7.0;
  float pixels=clamp(viewportSize.y*0.12/depth,1.3,12.0);
  if(mode>2.5 && mode<4.5){
    vec4 old=previousMVP*vec4(anchor,1.0);
    vec2 motion=(clip.xy/max(clip.w,0.05)-old.xy/max(old.w,0.05))*viewportSize*0.5;
    motion*=historyValid;
    // At rest or on the first frame, use projected travel/rotation as a fallback.
    vec3 velocity=vec3(-anchor.y*rotationSpeed,anchor.x*rotationSpeed,speed);
    vec4 ahead=projectionMatrix*(view+modelViewMatrix*vec4(velocity*0.02,0.0));
    vec2 fallback=(ahead.xy/max(ahead.w,0.05)-clip.xy/max(clip.w,0.05))*viewportSize;
    vec2 direction=length(motion)>0.01 ? normalize(motion) : (length(fallback)>0.001?normalize(fallback):vec2(0.0,1.0));
    float exposure=mode>3.5?0.075:0.12;
    float lengthPx=clamp((length(motion)/max(frameDelta,0.008)*exposure+speed*0.35)*trailLength*(0.6+seed*0.8),0.0,mode>3.5?100.0:140.0);
    float radius=mode>3.5?max(1.4,pixels*0.8):max(0.55,pixels*0.22);
    float total=lengthPx+radius*2.0;
    headFraction=radius/total;
    vec2 offset=direction*(uv.x*total-lengthPx-radius)+vec2(-direction.y,direction.x)*(uv.y-0.5)*radius*2.0;
    clip.xy+=offset*2.0/viewportSize*clip.w;
  } else {
    float size=mode<1.5?0.48:mode>4.5?0.38:0.14;
    size*=0.8+seed*0.45;
    if(mode<1.5) size*=1.0+0.14*sin(time*1.8+seed*6.283);
    float angle=(seed-0.5)*0.55;
    vec2 p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*position.xy;
    view.xy+=p*size;
    clip=projectionMatrix*view;
    headFraction=0.1;
  }
  gl_Position=clip;
}`;

export const quadFragment = `
uniform float mode;
uniform sampler2D shapeAtlas;
varying vec2 vUv;
varying vec3 tint;
varying float fade, symbol, headFraction;
void main(){
  vec2 p=vUv*2.0-1.0;
  float alpha;
  vec3 color=tint;
  if(mode<1.5 || mode>4.5){
    alpha=texture2D(shapeAtlas,vec2((symbol+vUv.x)/8.0,vUv.y)).a;
  } else if(mode<2.5){
    float r=length(p); alpha=exp(-3.5*r*r)*(1.0-smoothstep(0.75,1.0,r))*0.45;
  } else {
    float head=exp(-3.0*(pow((vUv.x-(1.0-headFraction))/max(headFraction,0.001),2.0)+p.y*p.y));
    float tail=pow(vUv.x,0.7)*(1.0-smoothstep(1.0-headFraction,1.0,vUv.x))*exp(-6.0*p.y*p.y);
    alpha=mode>3.5 ? head*1.6+tail*0.65 : (head*0.4+tail)*0.8;
    color=mix(tint,vec3(1.0),head*(mode>3.5?0.5:0.1));
  }
  if(alpha<0.008) discard;
  gl_FragColor=vec4(color,alpha*fade);
  #include <colorspace_fragment>
}`;

export const ribbonVertex = `
attribute vec3 start,end,normalA,normalB;
attribute float orbitIndex;
uniform float time,ribbonWidth,ribbonTwist,hue;
uniform sampler2D paletteMap;
varying vec2 vUv;
varying vec3 tint;
varying float fade;
void main(){
  float t=uv.x, phase=(orbitIndex+t)*0.7+time*0.65;
  vec3 center=mix(start,end,t);
  vec3 normal=normalize(mix(normalA,normalB,t)+vec3(0.0,0.0,0.001));
  float twist=sin(phase)*ribbonTwist;
  vec3 side=normal*cos(twist)+vec3(0.0,0.0,sin(twist));
  float width=ribbonWidth*(0.65+0.35*sin((orbitIndex+t)*0.31+1.0));
  vec3 p=center+side*(uv.y-0.5)*width;
  p.z+=sin(t*3.14159)*sin(phase)*ribbonWidth*ribbonTwist*0.25;
  vec4 view=modelViewMatrix*vec4(p,1.0);
  fade=exp(-0.0025*view.z*view.z)*smoothstep(0.4,1.4,length(view.xyz));
  tint=texture2D(paletteMap,vec2(fract(hue+length(center.xy)*0.012+center.x*0.004),0.5)).rgb;
  gl_Position=projectionMatrix*view; vUv=uv;
}`;
export const ribbonFragment = `
varying vec2 vUv; varying vec3 tint; varying float fade;
void main(){
  float edge=abs(vUv.y*2.0-1.0);
  float glow=exp(-3.0*edge*edge)*(1.0-smoothstep(0.8,1.0,edge));
  gl_FragColor=vec4(tint,glow*fade*0.42);
  #include <colorspace_fragment>
}`;
