// Custom shader effects (Figma Config 2026 brought WebGPU shaders to the canvas).
// Here: a small, dependency-free WebGL runtime that paints a parameterized shader
// as a BACKGROUND layer behind an element's content. It is baked into the design
// file by the edit engine as a <script> block (no AI round-trip), so the effect is
// real, deterministic and exportable. Opt-in only, so it never fights the
// no-gradient default; shaders draw a single tint color (no gradients), respect
// prefers-reduced-motion, and pause when off-screen.

export type ShaderId = 'grain' | 'waves' | 'dots'
export type ShaderConfig = { selector: string; shader: ShaderId; color: string; intensity: number }

export const SHADER_PRESETS: { id: ShaderId; label: string }[] = [
  { id: 'grain', label: 'Film grain' },
  { id: 'waves', label: 'Flow lines' },
  { id: 'dots', label: 'Pulse dots' },
]

const FRAG: Record<ShaderId, string> = {
  grain: `precision mediump float;uniform float uTime;uniform vec2 uRes;uniform vec3 uColor;uniform float uInt;
float rand(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}
void main(){float n=rand(gl_FragCoord.xy+fract(uTime));gl_FragColor=vec4(uColor,n*uInt*0.45);}`,
  waves: `precision mediump float;uniform float uTime;uniform vec2 uRes;uniform vec3 uColor;uniform float uInt;
void main(){vec2 uv=gl_FragCoord.xy/uRes;float w=sin(uv.x*18.0+uTime*1.6)*0.5+0.5;
float line=smoothstep(0.46,0.5,abs(fract(uv.y*7.0+w*0.35)-0.5));gl_FragColor=vec4(uColor,(1.0-line)*uInt*0.4);}`,
  dots: `precision mediump float;uniform float uTime;uniform vec2 uRes;uniform vec3 uColor;uniform float uInt;
void main(){vec2 uv=gl_FragCoord.xy/uRes;vec2 g=fract(uv*22.0)-0.5;float d=length(g);
float pulse=sin(uTime*1.8+uv.x*9.0+uv.y*9.0)*0.5+0.5;float c=smoothstep(0.34,0.28,d)*(0.35+0.65*pulse);
gl_FragColor=vec4(uColor,c*uInt*0.5);}`,
}

const RUNTIME = `(function(){
var R=matchMedia('(prefers-reduced-motion:reduce)').matches;
function hex(h){h=(h||'#888').replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
return [parseInt(h.substr(0,2),16)/255,parseInt(h.substr(2,2),16)/255,parseInt(h.substr(4,2),16)/255];}
var VS='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
function mount(cfg){
 var el=document.querySelector(cfg.selector);if(!el)return;
 var cs=getComputedStyle(el);if(cs.position==='static')el.style.position='relative';el.style.isolation='isolate';
 var cv=document.createElement('canvas');cv.setAttribute('data-t42-shader','');
 cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block;';
 el.insertBefore(cv,el.firstChild);
 var gl=cv.getContext('webgl',{alpha:true,premultipliedAlpha:false});if(!gl)return;
 function sh(t,s){var o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o;}
 var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,cfg.frag));
 gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return;gl.useProgram(pr);
 var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 var lp=gl.getAttribLocation(pr,'p');gl.enableVertexAttribArray(lp);gl.vertexAttribPointer(lp,2,gl.FLOAT,false,0,0);
 var uT=gl.getUniformLocation(pr,'uTime'),uR=gl.getUniformLocation(pr,'uRes'),uC=gl.getUniformLocation(pr,'uColor'),uI=gl.getUniformLocation(pr,'uInt');
 var col=hex(cfg.color),dpr=Math.min(window.devicePixelRatio||1,2);
 function size(){var w=Math.max(1,Math.floor(cv.clientWidth*dpr)),h=Math.max(1,Math.floor(cv.clientHeight*dpr));
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}gl.viewport(0,0,cv.width,cv.height);}
 function draw(t){size();gl.uniform1f(uT,t);gl.uniform2f(uR,cv.width,cv.height);gl.uniform3f(uC,col[0],col[1],col[2]);
  gl.uniform1f(uI,cfg.intensity||0.6);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
 if(R){draw(0);return;}
 var raf=null,start=performance.now(),vis=true;
 function loop(now){draw((now-start)/1000);raf=vis?requestAnimationFrame(loop):null;}
 if('IntersectionObserver'in window){new IntersectionObserver(function(es){es.forEach(function(e){vis=e.isIntersecting;
  if(vis&&!raf)raf=requestAnimationFrame(loop);else if(!vis&&raf){cancelAnimationFrame(raf);raf=null;}});},{threshold:0}).observe(el);}
 else raf=requestAnimationFrame(loop);
}
function run(){(window.__t42Shaders||[]).forEach(mount);}
if(document.readyState!=='loading')run();else document.addEventListener('DOMContentLoaded',run);
})();`

/** Build the bake-able <script> body: the shader config + the runtime. */
export function buildShaderScript(configs: ShaderConfig[]): string {
  if (!configs.length) return ''
  const withFrag = configs.map((c) => ({ ...c, frag: FRAG[c.shader] ?? FRAG.grain }))
  return `window.__t42Shaders=${JSON.stringify(withFrag)};\n${RUNTIME}`
}
