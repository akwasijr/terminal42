// Engine assets: the StudioArk best-practice engineering as real, ready code that
// every generated web design inherits, so motion, tokens, spacing, focus and
// reduced-motion are provided rather than re-derived (and cannot be botched).
//
// The base is inlined into the generated HTML once, inside a <style id="engine-base">
// and a <script id="engine-motion">. On iterations the model preserves these blocks
// byte-for-byte, so the engineering survives editing. The linter checks the markers
// are present.

export const ENGINE_BASE_ID = 'engine-base'
export const ENGINE_MOTION_ID = 'engine-motion'

/** Structural tokens, reset, type/space scale, focus, reduced-motion, and the
 *  motion classes that pair with MOTION_JS. Color and font tokens are deliberately
 *  NOT set here: the design defines its own --color-* / --font-* per its palette. */
export const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
*{margin:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{min-height:100dvh;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow-x:clip;line-height:1.6}
img,picture,video,canvas,svg{display:block;max-width:100%}
input,button,textarea,select{font:inherit;color:inherit}
button{cursor:pointer;background:none;border:0}
a{color:inherit;text-decoration:none}
h1,h2,h3,h4{line-height:1.08;text-wrap:balance}
p{text-wrap:pretty}
:where(:root){
--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-5:24px;--space-6:32px;--space-8:48px;--space-10:64px;--space-12:96px;
--radius-sm:6px;--radius-md:12px;--radius-lg:20px;--radius-pill:999px;
--ease:cubic-bezier(.22,1,.36,1);--dur:.6s}
:focus-visible{outline:2px solid currentColor;outline-offset:3px;border-radius:2px}
[data-reveal]{opacity:0;transform:translate3d(0,14px,0);transition:opacity var(--dur) var(--ease),transform var(--dur) var(--ease);will-change:opacity,transform}
[data-reveal].is-visible{opacity:1;transform:none}
[data-stagger]>*{opacity:0;transform:translate3d(0,14px,0);transition:opacity .56s var(--ease),transform .56s var(--ease);transition-delay:calc(var(--i,0)*80ms)}
[data-stagger].is-visible>*{opacity:1;transform:none}
[data-split] .w{display:inline-block;overflow:hidden;vertical-align:top}
[data-split] .w-in{display:inline-block;transform:translate3d(0,110%,0);transition:transform .7s var(--ease);transition-delay:var(--d,0ms)}
[data-split].words-in .w-in{transform:none}
[data-parallax]{transform:translate3d(0,var(--sy,0px),0);will-change:transform}
[data-scroll-progress]{transform:scaleX(var(--p,0));transform-origin:0 50%}
[data-tilt]{transform:perspective(800px) rotateX(var(--rx,0)) rotateY(var(--ry,0));transition:transform .2s var(--ease)}
[data-mouse-depth]{transform:translate3d(var(--mx,0),var(--my,0),0)}
[data-magnet]{transition:transform .2s var(--ease)}
@media (prefers-reduced-motion:reduce){
[data-reveal],[data-stagger]>*,[data-split] .w-in{opacity:1!important;transform:none!important;transition:none!important}
[data-parallax],[data-tilt],[data-mouse-depth]{transform:none!important}
html{scroll-behavior:auto}}`

/** Dependency-free motion engine: scroll reveals, word-rise, parallax, count-up,
 *  scroll progress, sticky nav, and the mouse-based interactions (tilt, magnet,
 *  cursor-depth). Self-initializing, reduced-motion aware, fine-pointer gated. */
export const MOTION_JS = `(function(){
var R=matchMedia('(prefers-reduced-motion:reduce)').matches,FINE=matchMedia('(pointer:fine)').matches;
function ready(f){document.readyState!='loading'?f():document.addEventListener('DOMContentLoaded',f)}
ready(function(){
var rev=document.querySelectorAll('[data-reveal],[data-stagger]');
document.querySelectorAll('[data-stagger]').forEach(function(g){[].forEach.call(g.children,function(c,i){c.style.setProperty('--i',i)})});
if(R||!('IntersectionObserver'in window)){rev.forEach(function(e){e.classList.add('is-visible')})}
else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}})},{threshold:.12,rootMargin:'0px 0px -8% 0px'});rev.forEach(function(e){io.observe(e)})}
var sp=document.querySelectorAll('[data-split]');
if(!R){var k=0;function sn(node){[].slice.call(node.childNodes).forEach(function(ch){if(ch.nodeType===3){var t=ch.textContent;if(!t.trim())return;var f=document.createDocumentFragment();t.split(/(\\s+)/).forEach(function(p){if(p==='')return;if(/^\\s+$/.test(p)){f.appendChild(document.createTextNode(p));return}var w=document.createElement('span');w.className='w';var i=document.createElement('span');i.className='w-in';i.textContent=p;i.style.setProperty('--d',(k*55)+'ms');w.appendChild(i);f.appendChild(w);k++});node.replaceChild(f,ch)}else if(ch.nodeType===1){sn(ch)}})}
sp.forEach(function(e){k=0;sn(e)});
if('IntersectionObserver'in window){var w2=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('words-in');w2.unobserve(e.target)}})},{threshold:.2,rootMargin:'0px 0px -6% 0px'});sp.forEach(function(e){w2.observe(e)})}else sp.forEach(function(e){e.classList.add('words-in')})}
else sp.forEach(function(e){e.classList.add('words-in')});
document.querySelectorAll('[data-count]').forEach(function(el){var tg=parseFloat(el.getAttribute('data-count'))||0,dec=((el.getAttribute('data-count')||'').split('.')[1]||'').length,tpl=el.textContent.indexOf('{n}')>=0?el.textContent:'{n}';function run(){if(R){el.textContent=tpl.replace('{n}',tg.toFixed(dec));return}var s=performance.now();function tk(n){var p=Math.min(1,(n-s)/1400),e=1-Math.pow(1-p,3);el.textContent=tpl.replace('{n}',(tg*e).toFixed(dec));if(p<1)requestAnimationFrame(tk)}requestAnimationFrame(tk)}if('IntersectionObserver'in window){var c=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){run();c.unobserve(e.target)}})},{threshold:.4});c.observe(el)}else run()});
var bar=document.querySelector('[data-scroll-progress]'),nav=document.querySelector('[data-sticky-nav]');
var par=R?[]:[].map.call(document.querySelectorAll('[data-parallax]'),function(el){return{el:el,host:el.closest('[data-parallax-area]')||el,sp:parseFloat(el.getAttribute('data-parallax-speed')||el.getAttribute('data-parallax')||'0')||0}});
var on=!R&&innerWidth>=768,tick=false;
function frame(){tick=false;var vh=innerHeight;if(bar){var mx=document.documentElement.scrollHeight-vh;bar.style.setProperty('--p',mx>0?(scrollY/mx).toFixed(4):0)}if(nav){nav.classList.toggle('is-scrolled',scrollY>8)}if(on){par.forEach(function(p){var r=p.host.getBoundingClientRect();if(r.bottom<-200||r.top>vh+200)return;p.el.style.setProperty('--sy',((r.top+r.height/2-vh/2)*p.sp).toFixed(1)+'px')})}}
function os(){if(!tick){tick=true;requestAnimationFrame(frame)}}
addEventListener('scroll',os,{passive:true});addEventListener('resize',function(){on=!R&&innerWidth>=768;if(!on)par.forEach(function(p){p.el.style.setProperty('--sy','0px')});os()},{passive:true});os();
if(!R&&FINE){var dep=[].map.call(document.querySelectorAll('[data-mouse-depth]'),function(el){return{el:el,d:parseFloat(el.getAttribute('data-mouse-depth'))||0}});if(dep.length){var tx=0,ty=0,cx=0,cy=0,rn=false;function lp(){tx+=(cx-tx)*.08;ty+=(cy-ty)*.08;dep.forEach(function(o){o.el.style.setProperty('--mx',(tx*o.d).toFixed(2)+'px');o.el.style.setProperty('--my',(ty*o.d).toFixed(2)+'px')});if(Math.abs(cx-tx)>5e-4||Math.abs(cy-ty)>5e-4)requestAnimationFrame(lp);else rn=false}addEventListener('mousemove',function(e){cx=e.clientX/innerWidth-.5;cy=e.clientY/innerHeight-.5;if(!rn){rn=true;requestAnimationFrame(lp)}},{passive:true})}
document.querySelectorAll('[data-tilt]').forEach(function(h){h.addEventListener('pointermove',function(e){var r=h.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;h.style.setProperty('--ry',(px*4).toFixed(2)+'deg');h.style.setProperty('--rx',(-py*4).toFixed(2)+'deg')});h.addEventListener('pointerleave',function(){h.style.setProperty('--rx','0deg');h.style.setProperty('--ry','0deg')})});
document.querySelectorAll('[data-magnet]').forEach(function(b){b.addEventListener('mousemove',function(e){var r=b.getBoundingClientRect(),mx=(e.clientX-(r.left+r.width/2))/(r.width/2),my=(e.clientY-(r.top+r.height/2))/(r.height/2);b.style.transform='translate('+(mx*6).toFixed(1)+'px,'+(my*6).toFixed(1)+'px)'});b.addEventListener('mouseleave',function(){b.style.transform=''})})}
})})()`

/** Documentation of the base layer's API, injected so the model knows how to use it. */
export const ENGINE_USAGE = `The base layer above already ships these. Do NOT re-implement them; just add the attributes:
- Scroll reveal: add data-reveal to fade+rise an element in; data-stagger on a container cascades its children.
- Word rise: add data-split to a heading so its words rise in.
- Parallax (desktop): data-parallax="0.06" on a layer plus data-parallax-area on its section.
- Count up: data-count="1200" on a number (include {n} in the text for a prefix/suffix).
- Sticky nav: data-sticky-nav on the header (gets .is-scrolled past 8px so you can style a solid, non-blurred background).
- Mouse, fine pointers only: data-tilt (leans to cursor), data-magnet (drifts to cursor), data-mouse-depth="0.3" (layer drifts toward cursor).
- Spacing: var(--space-1..12). Radii: var(--radius-sm|md|lg|pill). Easing: var(--ease).
Define your own --color-* and --font-* in your page <style> and apply them. Use motion sparingly and only where it adds meaning.`

/** The inline base block to drop into the generated HTML once. */
export function buildEngineBaseBlock(): string {
  return `<style id="${ENGINE_BASE_ID}">\n${BASE_CSS}\n</style>\n<script id="${ENGINE_MOTION_ID}" defer>\n${MOTION_JS}\n</script>`
}
