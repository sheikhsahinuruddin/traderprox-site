import * as THREE from 'three';
// ---------- Configuration (override with window.EARTHVISION_CONFIG before this script) ----------
const CFG=Object.assign({
  texBase:'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/',
  neBase:'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/',
  tileUrl:'https://tile.openstreetmap.org/{z}/{x}/{y}.png', tileAttr:'Map © OpenStreetMap contributors',
  tileMaxZoom:17, tileConcurrency:4, tileCacheMax:260,
  overpass:'https://overpass-api.de/api/interpreter', nominatim:'https://nominatim.openstreetmap.org/search'
},window.EARTHVISION_CONFIG||{});
const $=s=>document.querySelector(s), R=Math.PI/180, TAU=Math.PI*2, clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const wrapPi=a=>{a%=TAU;if(a>Math.PI)a-=TAU;if(a<-Math.PI)a+=TAU;return a};
const L=k=>$('#l-'+k).checked, mobile=matchMedia('(pointer:coarse)').matches;
const vec=(lat,lon,r=1)=>new THREE.Vector3(r*Math.cos(lat)*Math.cos(lon),r*Math.sin(lat),-r*Math.cos(lat)*Math.sin(lon));
function toast(m,ms=3500){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',ms)}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

let renderer,ctxLost=false;
try{renderer=new THREE.WebGLRenderer({canvas:$('#gl'),antialias:!mobile,powerPreference:'high-performance'})}
catch(e){$('#nogl').style.display='flex';$('#loader').remove();throw e}
const cv=$('#gl');
cv.addEventListener('webglcontextlost',e=>{e.preventDefault();ctxLost=true;toast('Graphics context lost – restoring…',8000)});
cv.addEventListener('webglcontextrestored',()=>location.reload());
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,300);
const mgr=new THREE.LoadingManager(),tl=new THREE.TextureLoader(mgr);tl.setCrossOrigin('anonymous');
const aniso=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const tex=(f,srgb=true)=>{const t=tl.load(CFG.texBase+f);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=aniso;return t};
let loaded=false;const hideLoader=()=>{if(loaded)return;loaded=true;const l=$('#loader');if(!l)return;l.style.opacity=0;setTimeout(()=>l.remove(),900)};
mgr.onLoad=hideLoader;mgr.onError=()=>toast('Could not load a texture – check your connection.');setTimeout(hideLoader,15000);

// ---------- Astronomy (live calculations) ----------
function sunAt(ms){
  const d=ms/864e5-10957.5,Ls=((280.460+0.9856474*d)%360+360)%360,g=(357.528+0.9856003*d)*R;
  const lam=(Ls+1.915*Math.sin(g)+0.02*Math.sin(2*g))*R,eps=(23.439-4e-7*d)*R;
  const dec=Math.asin(Math.sin(eps)*Math.sin(lam)),ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam));
  const gmst=((280.46061837+360.98564736629*d)%360+360)%360;
  return{dec,sub:wrapPi(ra-gmst*R),eot:4*wrapPi(Ls*R-ra)/R,v:vec(dec,wrapPi(ra-gmst*R))};
}
function sunTimes(ms,lat,lon){
  const s=sunAt(ms),la=lat*R,c=(Math.sin(-.833*R)-Math.sin(la)*Math.sin(s.dec))/(Math.cos(la)*Math.cos(s.dec));
  if(c>1)return'Polar night';if(c<-1)return'Polar day';
  const H=Math.acos(c)/R/15,noon=12-lon/15-s.eot/60,d0=Math.floor(ms/864e5)*864e5;return[d0+(noon-H)*36e5,d0+(noon+H)*36e5];
}
const tzOf=(lat,lon)=>{try{return typeof tzlookup==='function'?tzlookup(lat,lon):null}catch{return null}};
function fmt(ms,lat,lon,o){const tz=tzOf(lat,lon);try{return tz?new Intl.DateTimeFormat('en-GB',{...o,timeZone:tz}).format(ms):new Intl.DateTimeFormat('en-GB',{...o,timeZone:'UTC'}).format(ms+lon*240000)}catch{return'–'}}
const FULL={weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'},HM={hour:'2-digit',minute:'2-digit'};

// ---------- Deep-space sky: deterministic stars + procedural nebula (follows camera = at infinity) ----------
const sky=new THREE.Group();scene.add(sky);
{
  const GN='normalize(vec3(.35,.8,.45))';
  const neb=new THREE.Mesh(new THREE.SphereGeometry(120,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,
    defines:{OCT:mobile?3:4},
    vertexShader:`varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vD;
    float h(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<OCT;i++){s+=a*n(p);p=p*2.03+7.1;a*=.5;}return s;}
    void main(){vec3 d=normalize(vD);float band=exp(-pow(dot(d,${GN})*3.2,2.));
      float c1=fbm(d*2.2+3.),c2=fbm(d*5.+11.);
      float nb=smoothstep(.5,.92,c1)*.45+band*smoothstep(.38,.88,c2)*.7;
      vec3 col=vec3(.003,.006,.016)+vec3(.006,.011,.028)*band+nb*mix(vec3(.04,.075,.2),vec3(.15,.06,.19),c2)*.5+band*.02;
      gl_FragColor=vec4(col,1.);}`}));
  neb.renderOrder=-20;sky.add(neb);
  const rnd=mulberry32(20260617),N=mobile?3500:7500,pos=new Float32Array(N*3),col=new Float32Array(N*3),siz=new Float32Array(N),gn=new THREE.Vector3(.35,.8,.45).normalize(),v=new THREE.Vector3();
  for(let i=0;i<N;i++){
    v.set(rnd()*2-1,rnd()*2-1,rnd()*2-1);while(v.lengthSq()>1||v.lengthSq()<.01)v.set(rnd()*2-1,rnd()*2-1,rnd()*2-1);v.normalize();
    if(rnd()<.45){v.addScaledVector(gn,-v.dot(gn)+(rnd()-.5)*.35).normalize()}      // denser along a galactic band
    pos.set([v.x*100,v.y*100,v.z*100],i*3);
    const b=rnd(),tp=rnd(),br=.3+.7*b*b,c=tp<.22?[.7,.82,1]:tp<.8?[.96,.97,1]:[1,.86,.68];
    col.set([c[0]*br,c[1]*br,c[2]*br],i*3);siz[i]=.9+Math.pow(b,12)*5.5+b*.8;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aCol',new THREE.BufferAttribute(col,3));g.setAttribute('aSize',new THREE.BufferAttribute(siz,1));
  const sm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{pr:{value:renderer.getPixelRatio()}},
    vertexShader:`attribute vec3 aCol;attribute float aSize;uniform float pr;varying vec3 vC;void main(){vC=aCol;gl_PointSize=aSize*pr;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vC;void main(){float d=length(gl_PointCoord-.5)*2.;float k=clamp(1.-d,0.,1.);float a=k*k*k+.25*k*k*k*k*k*k;gl_FragColor=vec4(vC*a,a);}`});
  const st=new THREE.Points(g,sm);st.frustumCulled=false;st.renderOrder=-10;sky.add(st);sky.userData.sm=sm;
}

// ---------- Earth ----------
const earthMat=new THREE.ShaderMaterial({
  uniforms:{day:{value:tex('earth_atmos_2048.jpg')},night:{value:tex('earth_lights_2048.png')},spec:{value:tex('earth_specular_2048.jpg',false)},sun:{value:new THREE.Vector3(1,0,0)},cam:{value:new THREE.Vector3()},lights:{value:1},shade:{value:1}},
  vertexShader:`varying vec3 vN,vP;varying vec2 vUv;void main(){vUv=uv;vN=normalize(position);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D day,night,spec;uniform vec3 sun,cam;uniform float lights,shade;varying vec3 vN,vP;varying vec2 vUv;
  void main(){float ndl=dot(vN,sun);if(shade<.5)ndl=1.;float dm=smoothstep(-.12,.18,ndl);
    vec3 d=texture2D(day,vUv).rgb,V=normalize(cam-vP),H=normalize(sun+V);
    vec3 c=d*(.03+dm*(.3+.85*clamp(ndl,0.,1.)));c+=vec3(1.,.45,.2)*exp(-pow(ndl*6.,2.))*.10*d;
    c+=vec3(.85,.93,1.)*pow(max(dot(vN,H),0.),70.)*texture2D(spec,vUv).r*dm*.55;
    vec3 n=texture2D(night,vUv).rgb;c+=n*vec3(1.,.72,.34)*1.9*(1.-dm)*lights;
    c+=vec3(.25,.5,1.)*pow(1.-max(dot(vN,V),0.),3.)*dm*.35;gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
  }`});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1,256,128),earthMat));
const atmoMat=new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{sun:earthMat.uniforms.sun,fade:{value:1}},
  vertexShader:`varying vec3 vN,vW;void main(){vN=normalize(normalMatrix*normal);vW=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform vec3 sun;uniform float fade;varying vec3 vN,vW;void main(){float i=pow(max(.64-dot(vN,vec3(0,0,1)),0.),3.2)*2.2;float s=smoothstep(-.35,.4,dot(vW,sun));gl_FragColor=vec4(vec3(.3,.58,1.)*i*(.2+s)*fade,1.);}`});
const atmo=new THREE.Mesh(new THREE.SphereGeometry(1.07,96,64),atmoMat);scene.add(atmo);
const cloudMat=new THREE.MeshLambertMaterial({map:tex('earth_clouds_1024.png'),transparent:true,depthWrite:false,opacity:.85});
const clouds=new THREE.Mesh(new THREE.SphereGeometry(1.007,96,64),cloudMat);scene.add(clouds);
const sunLight=new THREE.DirectionalLight(0xffffff,3);scene.add(sunLight,new THREE.AmbientLight(0x8fa6d6,.7));

// ---------- Borders (Natural Earth, lazy) ----------
const borders=new THREE.Group();scene.add(borders);
function geoLines(gj,r,color,op){
  const pos=[];const ring=c=>{for(let i=1;i<c.length;i++){const a=c[i-1],b=c[i],dl=b[0]-a[0];if(Math.abs(dl)>180)continue;const n=Math.max(1,Math.ceil(Math.hypot(dl,b[1]-a[1])/1.5));let p=a;for(let k=1;k<=n;k++){const q=[a[0]+dl*k/n,a[1]+(b[1]-a[1])*k/n],u=vec(p[1]*R,p[0]*R,r),w=vec(q[1]*R,q[0]*R,r);pos.push(u.x,u.y,u.z,w.x,w.y,w.z);p=q}}};
  for(const f of gj.features){const g=f.geometry;if(!g)continue;
    if(g.type==='Polygon')g.coordinates.forEach(ring);else if(g.type==='MultiPolygon')g.coordinates.forEach(p=>p.forEach(ring));
    else if(g.type==='LineString')ring(g.coordinates);else if(g.type==='MultiLineString')g.coordinates.forEach(ring)}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  return new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:op,depthWrite:false}));
}
fetch(CFG.neBase+'ne_110m_admin_0_countries.geojson').then(r=>r.json()).then(j=>borders.add(geoLines(j,1.0004,0x7fb6ff,.55))).catch(()=>toast('Country borders unavailable.'));
let states=null,statesBusy=false;
function loadStates(){if(states||statesBusy)return;statesBusy=true;toast('Loading state/province boundaries (large file)…');
  fetch(CFG.neBase+'ne_50m_admin_1_states_provinces.geojson').then(r=>r.json()).then(j=>{states=geoLines(j,1.0004,0x5f8fd0,.4);borders.add(states)}).catch(()=>{statesBusy=false;toast('State boundaries unavailable.')})}

// ---------- Places: Natural Earth base list + progressive OpenStreetMap (Overpass) towns/villages ----------
let places=[];
fetch(CFG.neBase+'ne_10m_populated_places_simple.geojson').then(r=>r.json()).then(j=>{
  places=j.features.map(f=>{const p=f.properties,[lo,la]=f.geometry.coordinates,cap=/Admin-0 capital/i.test(p.featurecla||'');
    return{n:p.name,sub:p.adm0name+(p.pop_max?' · pop. '+p.pop_max.toLocaleString('en'):''),pop:p.pop_max||0,cap,lat:la,lon:lo,p:vec(la*R,lo*R),rank:(p.pop_max||0)+(cap?3e6:0)}}).sort((a,b)=>b.rank-a.rank)
}).catch(()=>toast('Place labels unavailable – search still works.'));
const KIND={city:5e5,town:3e4,suburb:1.2e4,village:3e3,hamlet:4e2,neighbourhood:1e3},KDIST={city:.012,town:.007,suburb:.003,village:.0028,hamlet:.002,neighbourhood:.0022};
const dyn={cells:new Map(),active:[],sorted:[],queue:[],busy:false,sig:'',last:0,fails:0,wait:0,told:false};
const dynTiers=()=>{const h=dist-1,o=[];if(h<.15)o.push({id:'T',cell:3,types:'city|town',lim:800});if(h<.02)o.push({id:'V',cell:.5,types:'village|hamlet|suburb',lim:1200});return o};
function rebuildDyn(){dyn.sorted=[].concat(...dyn.active.map(x=>(dyn.cells.get(x.k)||{arr:[]}).arr)).sort((a,b)=>b.rank-a.rank)}
function updateDyn(){
  const la=lat/R,lo=lon/R,keys=[];
  for(const t of dynTiers()){const M=Math.round(360/t.cell),ci=Math.floor((la+90)/t.cell),cj=Math.floor((lo+180)/t.cell);
    for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){const i=ci+di;if(i<0||i>=Math.round(180/t.cell))continue;const j=((cj+dj)%M+M)%M;keys.push({k:t.id+':'+i+':'+j,t,i,j,o:Math.abs(di)+Math.abs(dj)})}}
  keys.sort((a,b)=>a.o-b.o);const sig=keys.map(x=>x.k).join();
  if(sig===dyn.sig)return;dyn.sig=sig;dyn.active=keys;dyn.queue=keys.filter(x=>!dyn.cells.has(x.k));rebuildDyn();pumpDyn();
}
async function pumpDyn(){
  if(dyn.busy||!dyn.queue.length||dyn.fails>=3)return;
  const wait=Math.max(1000-(Date.now()-dyn.last),dyn.wait-Date.now(),0);if(wait>0){clearTimeout(pumpDyn.h);pumpDyn.h=setTimeout(pumpDyn,wait);return}
  const c=dyn.queue.shift();if(dyn.cells.has(c.k)||!dyn.active.some(x=>x.k===c.k)){pumpDyn();return}
  dyn.busy=true;const{t,i,j}=c,s=i*t.cell-90,w=j*t.cell-180,n=s+t.cell,e=w+t.cell;
  try{
    const q=`[out:json][timeout:25];node["place"~"^(${t.types})$"]["name"](${s},${w},${n},${e});out ${t.lim};`;
    const r=await fetch(CFG.overpass,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q)});
    if(!r.ok)throw new Error(r.status);const jn=await r.json();
    const arr=jn.elements.filter(x=>x.tags&&x.lat!=null).map(x=>{const g=x.tags,k=g.place,pop=parseInt(g.population)||0;
      return{n:g['name:en']||g.name,kind:k,sub:k+(g['is_in:state']||g['addr:state']?' · '+(g['is_in:state']||g['addr:state']):'')+(pop?' · pop. '+pop.toLocaleString('en'):''),pop,cap:false,lat:x.lat,lon:x.lon,p:vec(x.lat*R,x.lon*R),rank:pop||KIND[k]||300}}).sort((a,b)=>b.rank-a.rank);
    dyn.cells.set(c.k,{arr});dyn.fails=0;
    if(dyn.cells.size>300)for(const k of dyn.cells.keys()){if(!dyn.active.some(x=>x.k===k)){dyn.cells.delete(k);if(dyn.cells.size<=240)break}}
    rebuildDyn();
  }catch(err){dyn.fails++;dyn.queue.unshift(c);dyn.wait=Date.now()+20000*dyn.fails;
    if(!dyn.told){dyn.told=true;toast('Detailed town/village data service is busy or unavailable. Base labels and search still work.',5000)}}
  dyn.busy=false;dyn.last=Date.now();pumpDyn();
}

// ---------- Labels ----------
const labBox=$('#labels'),pool=[],tv=new THREE.Vector3(),camDir=new THREE.Vector3();
for(let i=0;i<(mobile?60:110);i++){const d=document.createElement('div');d.className='lb';labBox.appendChild(d);pool.push(d)}
labBox.addEventListener('click',e=>{const el=e.target.closest('.lb'),p=el&&el._p;if(!p)return;
  const d=KDIST[p.kind]||(p.pop>5e6?.02:p.pop>1e6?.012:p.pop>2e5?.008:.005);select({name:p.n,sub:p.sub,lat:p.lat,lon:p.lon,dist:1+d})});
function updateLabels(){
  if(!L('labels')||dist<1.004||!places.length){pool.forEach(d=>d.style.display='none');return}
  const minPop=dist>3?4e6:dist>2.2?1.2e6:dist>1.6?3e5:dist>1.2?6e4:dist>1.05?8e3:0,lim=1/dist+.012,W=innerWidth,H=innerHeight,rects=[];let n=0;
  camDir.copy(camera.position).normalize();
  const tryP=p=>{
    if(p.p.dot(camDir)<lim)return;tv.copy(p.p).project(camera);const x=(tv.x+1)/2*W,y=(1-tv.y)/2*H;if(x<0||x>W-20||y<70||y>H-60)return;
    const w=p.n.length*7+16,h=18;for(const r of rects)if(x<r[0]+r[2]&&x+w>r[0]&&y-9<r[1]+r[3]&&y+9>r[1])return;
    rects.push([x,y-9,w,h]);const d=pool[n++];if(d._p!==p){d._p=p;d.textContent=p.n;d.className='lb'+(p.cap?' c':'')+(p.kind==='village'||p.kind==='hamlet'||p.kind==='suburb'?' sm':'')}
    d.style.display='block';d.style.transform=`translate(${x|0}px,${(y-10)|0}px)`};
  for(const p of places){if(n>=pool.length)break;if(p.pop<minPop&&!(p.cap&&dist>1.35&&p.pop>=minPop*.2))continue;tryP(p)}
  for(const p of dyn.sorted){if(n>=pool.length)break;tryP(p)}
  for(let i=n;i<pool.length;i++)pool[i].style.display='none';
}

// ---------- OSM tiles: geographic accuracy, cache, LRU, fallbacks, no z-fighting ----------
const tileGroup=new THREE.Group();scene.add(tileGroup);
const tiles=new Map(),tq=[];let inflight=0,curZ=0;
const mercLat=(y,z)=>Math.atan(Math.sinh(Math.PI*(1-2*y/2**z)));
const tileSrc=(z,x,y)=>{const n=2**z;return CFG.tileUrl.replace('{z}',z).replace('{x}',((x%n)+n)%n).replace('{y}',y)};
function makeTile(z,x,y){
  const n=2**z,a=TAU/n,seg=clamp(Math.ceil(a/(.6*R)),2,24),sag=1-Math.cos(a/seg/2),rad=1+1.5*sag+1.5e-5; // above the faceted Earth sphere, below borders/clouds
  const pos=[],nor=[],uv=[],idx=[];
  for(let j=0;j<=seg;j++){const la=mercLat(y+j/seg,z);for(let i=0;i<=seg;i++){const lo=((x+i/seg)/n*2-1)*Math.PI,u=vec(la,lo,1),p=u.clone().multiplyScalar(rad);pos.push(p.x,p.y,p.z);nor.push(u.x,u.y,u.z);uv.push(i/seg,1-j/seg)}}
  for(let j=0;j<seg;j++)for(let i=0;i<seg;i++){const p=j*(seg+1)+i,q=p+1,r=p+seg+1,s=r+1;idx.push(p,r,q,q,r,s)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
  const mat=new THREE.MeshLambertMaterial({depthWrite:false,transparent:true,opacity:0}),mesh=new THREE.Mesh(g,mat);mesh.renderOrder=z;mesh.visible=false;tileGroup.add(mesh);
  return{z,x,y,mesh,mat,state:'idle',last:0,fade:0,want:false,vis:false};
}
function pumpTiles(){
  while(inflight<CFG.tileConcurrency&&tq.length){
    const t=tq.shift();if(!t.want||t.state!=='queued'){if(t.state==='queued')t.state='idle';continue}
    t.state='loading';inflight++;const img=new Image();img.crossOrigin='anonymous';
    img.onload=()=>{inflight--;if(t.dead){pumpTiles();return}
      const tx=new THREE.Texture(img);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=aniso;tx.minFilter=THREE.LinearMipmapLinearFilter;tx.wrapS=tx.wrapT=THREE.ClampToEdgeWrapping;tx.needsUpdate=true;
      t.mat.map=tx;t.mat.needsUpdate=true;t.state='ok';pumpTiles()};
    img.onerror=()=>{inflight--;t.state='err';pumpTiles()};
    img.src=tileSrc(t.z,t.x,t.y);
  }
}
function disposeTile(k,t){t.dead=true;tileGroup.remove(t.mesh);t.mesh.geometry.dispose();if(t.mat.map)t.mat.map.dispose();t.mat.dispose();tiles.delete(k)}
function updateTiles(now){
  const on=L('tiles')&&dist<1.55;tileGroup.visible=on;if(!on){$('#busy').hidden=!dyn.busy;return}
  const zf=Math.log2(TAU*Math.max(.2,Math.cos(lat))/((dist-1)*.35));
  if(!curZ||Math.abs(zf-curZ)>.7)curZ=clamp(Math.round(zf),4,CFG.tileMaxZoom);          // hysteresis: no z thrash while zooming
  const z=curZ,n=2**z,cx=Math.floor((lon+Math.PI)/TAU*n),cy=Math.floor((1-Math.asinh(Math.tan(lat))/Math.PI)/2*n),r=z<=7?2:1;
  for(const t of tiles.values())t.want=false;
  let pending=0;
  for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){const y=cy+dy;if(y<0||y>=n)continue;const k=z+'/'+(cx+dx)+'/'+y;
    let t=tiles.get(k);if(!t){t=makeTile(z,cx+dx,y);tiles.set(k,t)}
    t.want=true;t.last=now;if(t.state==='idle'){t.state='queued';tq.push(t)}if(t.state==='queued'||t.state==='loading')pending++}
  for(const t of tiles.values()){t.vis=t.state==='ok'&&(t.want||(pending>0&&now-t.last<5000));t.mesh.visible=t.vis}   // keep previous imagery until replacements arrive
  tq.sort((a,b)=>Math.abs(a.x-cx)+Math.abs(a.y-cy)-Math.abs(b.x-cx)-Math.abs(b.y-cy));pumpTiles();
  if(tiles.size>CFG.tileCacheMax){const old=[...tiles].filter(([,t])=>!t.want&&!t.vis&&t.state!=='loading').sort((a,b)=>a[1].last-b[1].last);
    for(const[k,t]of old){if(tiles.size<=CFG.tileCacheMax*.8)break;disposeTile(k,t)}}
  const b=$('#busy');b.hidden=!(pending||inflight||dyn.busy);b.textContent=pending||inflight?'Loading map…':'Loading places…';
}

// ---------- Earthquakes (USGS live feed, lazy) ----------
let quakes=null;
async function loadQuakes(){
  const qi=$('#qinfo');qi.textContent='Loading USGS feed…';
  try{const j=await(await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson')).json(),p=[];
    j.features.forEach(f=>{const[lo,la]=f.geometry.coordinates,v=vec(la*R,lo*R,1.003);p.push(v.x,v.y,v.z)});
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    quakes=new THREE.Points(g,new THREE.PointsMaterial({size:8,sizeAttenuation:false,color:0xff5a4a,transparent:true,opacity:.9,depthWrite:false}));scene.add(quakes);
    qi.textContent=`USGS M2.5+ past 24 h: ${j.features.length} events. Feed generated ${new Date(j.metadata.generated).toUTCString()}.`;
  }catch(e){qi.textContent='USGS feed unavailable right now.';$('#l-quakes').checked=false}
}
$('#l-quakes').onchange=e=>{if(e.target.checked){quakes?quakes.visible=true:loadQuakes()}else if(quakes)quakes.visible=false};

// ---------- Camera state, rotation, flights ----------
const MIN=1.0003,MAX=14;let lat=20*R,lon=78*R,dist=innerWidth<innerHeight?4.6:3.6,latT=lat,lonT=lon,distT=dist,paused=false,rotCur=0,dragging=false,flight=null;
const home=()=>innerWidth<innerHeight?4.6:3.5,ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function setPaused(v){paused=v;if(v)rotCur=0;const b=$('#b-rot');b.textContent=v?'▶':'⏸';b.title=v?'Resume rotation':'Pause rotation'}
const userTook=()=>{flight=null;latT=lat;lonT=lon;distT=dist;setPaused(true)};      // any interaction: stop spin + cancel flights, stay paused until Resume
function flyTo(la,lo,d){
  setPaused(true);const tla=clamp(la*R,-1.45,1.45),tlo=lon+wrapPi(lo*R-lon),td=clamp(d,MIN,MAX),ang=Math.hypot(tla-lat,(tlo-lon)*Math.cos((tla+lat)/2));
  flight={t:0,dur:clamp(1.1+ang*1.6+Math.abs(Math.log((td-1)/(dist-1)))*.18,1.2,3.6),la0:lat,lo0:lon,h0:Math.log(dist-1),la1:tla,lo1:tlo,h1:Math.log(td-1),bump:Math.min(1.4,ang*1.1)};
}
const ptrs=new Map();let pinch0=0,pd0=1,down=null,moved=false;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,e);userTook();dragging=true;
  if(ptrs.size===1){down={x:e.clientX,y:e.clientY};moved=false}
  else if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch0=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);pd0=dist-1;moved=true}});
cv.addEventListener('pointermove',e=>{const o=ptrs.get(e.pointerId);if(!o)return;ptrs.set(e.pointerId,e);
  if(ptrs.size===1){
    if(!moved&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<4)return;moved=true;                 // small slop: taps never nudge the globe
    const s=2*Math.tan(camera.fov*R/2)*(dist-1)/innerHeight*.55;                                   // ≈55 % of 1:1 finger tracking
    lon-=(e.clientX-o.clientX)*s/Math.max(.35,Math.cos(lat));lat=clamp(lat+(e.clientY-o.clientY)*s,-1.45,1.45);lon=wrapPi(lon);latT=lat;lonT=lon;
  }else if(ptrs.size===2&&pinch0>10){const[a,b]=[...ptrs.values()],h=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);distT=dist=clamp(1+pd0*Math.pow(pinch0/h,.85),MIN,MAX)}});
const up=e=>{if(!ptrs.delete(e.pointerId))return;if(!ptrs.size){dragging=false;down=null}else if(ptrs.size===1){moved=true;pinch0=0}latT=lat;lonT=lon;distT=dist};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);cv.addEventListener('lostpointercapture',up);
cv.addEventListener('wheel',e=>{e.preventDefault();userTook();const dy=clamp(e.deltaY*(e.deltaMode===1?20:1),-120,120);distT=clamp(1+(distT-1)*Math.exp(dy*(mobile?.0009:.0011)),MIN,MAX)},{passive:false});
['gesturestart','gesturechange'].forEach(g=>cv.addEventListener(g,e=>e.preventDefault()));
$('#b-in').onclick=()=>{userTook();distT=clamp(1+(distT-1)*.6,MIN,MAX)};$('#b-out').onclick=()=>{userTook();distT=clamp(1+(distT-1)*1.65,MIN,MAX)};
const globalView=()=>{sel=null;pin=null;$('#pin').style.display='none';$('#info').hidden=true;flyTo(20,lon/R,home())};
$('#b-reset').onclick=globalView;$('#b-global').onclick=globalView;
$('#b-rot').onclick=()=>setPaused(!paused);
$('#b-fs').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.().catch(()=>toast('Fullscreen not supported here.'));
$('#b-menu').onclick=()=>$('#menu').hidden=!$('#menu').hidden;
$('#speed').oninput=e=>$('#spv').textContent=(+e.target.value).toFixed(2);
$('#hq').onchange=resize;

// ---------- Selection / search ----------
let sel=null,pin=null;
function select(s){sel=s;pin=vec(s.lat*R,s.lon*R,1.002);$('#i-name').textContent=s.name;$('#i-sub').textContent=s.sub||'';
  $('#i-ll').textContent=`${s.lat.toFixed(4)}°, ${s.lon.toFixed(4)}°`;$('#info').hidden=false;$('#res').hidden=true;$('#menu').hidden=true;flyTo(s.lat,s.lon,s.dist);updateInfo()}
function updateInfo(){if(!sel)return;const ms=simMs,tz=tzOf(sel.lat,sel.lon);$('#i-t').textContent=fmt(ms,sel.lat,sel.lon,FULL)+(tz?' ('+tz+')':' · solar time, approx.');
  const u=vec(sel.lat*R,sel.lon*R).dot(sunAt(ms).v);$('#i-sun').textContent=u>0.0145?'☀ Daytime':u>-.105?'🌅 Twilight':'🌙 Night';
  const t=sunTimes(ms,sel.lat,sel.lon);$('#i-rs').textContent=typeof t==='string'?t:fmt(t[0],sel.lat,sel.lon,HM)+' / '+fmt(t[1],sel.lat,sel.lon,HM)}
$('#b-x').onclick=()=>{sel=null;pin=null;$('#info').hidden=true;$('#pin').style.display='none'};
$('#b-loc').onclick=()=>{if(!navigator.geolocation)return toast('Geolocation is not supported by this browser.');toast('Requesting location permission…');
  navigator.geolocation.getCurrentPosition(p=>select({name:'My location',sub:`Accuracy ≈ ${Math.round(p.coords.accuracy)} m · stays on your device`,lat:p.coords.latitude,lon:p.coords.longitude,dist:1.004}),
  e=>toast(e.code===1?'Location permission denied.':e.code===2?'Location unavailable.':'Location request timed out.'),{enableHighAccuracy:false,timeout:12000,maximumAge:60000})};
const q=$('#q'),res=$('#res'),cache=new Map();let st,ctl,last=[];
q.addEventListener('input',()=>{clearTimeout(st);const v=q.value.trim();if(v.length<3){res.hidden=true;return}st=setTimeout(()=>search(v),700)});
q.addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(st);const v=q.value.trim();if(last.length&&!res.hidden)pick(last[0]);else if(v.length>=3)search(v,true)}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search'))res.hidden=true});
async function search(v,go){
  const la=lat/R,lo=lon/R,near=dist<2,ck=v.toLowerCase()+(near?'@'+Math.round(la/4)+','+Math.round(lo/5):'');let r=cache.get(ck);
  if(!r){ctl&&ctl.abort();ctl=new AbortController();
    const vb=near?`&viewbox=${lo-5},${la+4},${lo+5},${la-4}`:'';      // prefers (not restricts to) the region you're looking at
    try{r=await(await fetch(`${CFG.nominatim}?format=jsonv2&limit=8&dedupe=1&addressdetails=1&accept-language=en${vb}&q=`+encodeURIComponent(v),{signal:ctl.signal})).json();cache.set(ck,r)}
    catch(e){if(e.name!=='AbortError'){res.hidden=false;res.textContent='Search service unavailable. Try again shortly.'}return}}
  last=r;res.replaceChildren();res.hidden=false;
  if(!r.length){res.textContent='No matches found.';return}
  r.forEach(x=>{const d=document.createElement('div'),parts=x.display_name.split(', '),s=document.createElement('small');d.textContent=x.name||parts[0];s.textContent=(x.addresstype||x.type||'')+' · '+parts.slice(1).join(', ');d.appendChild(s);d.onclick=()=>pick(x);res.appendChild(d)});
  if(go)pick(r[0]);
}
function pick(x){const la=+x.lat,lo=+x.lon,b=x.boundingbox?x.boundingbox.map(Number):null;let span=.0004;
  if(b)span=Math.max((b[1]-b[0])*R,(b[3]-b[2])*R*Math.cos(la*R));const parts=x.display_name.split(', ');
  select({name:x.name||parts[0],sub:parts.slice(1,4).join(', ')+(x.addresstype?' · '+x.addresstype:''),lat:la,lon:lo,dist:1+clamp(span*1.7,.0008,2.4)});q.value=x.name||parts[0];q.blur()}

// ---------- Time ----------
let off=0,simMs=Date.now();
$('#t').oninput=e=>{off=+e.target.value};$('#b-live').onclick=()=>{off=0;$('#t').value=0};

// ---------- Loop ----------
function resize(){const dpr=Math.min(devicePixelRatio||1,$('#hq').checked?2:mobile?1.5:1.5);renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(sky.userData.sm)sky.userData.sm.uniforms.pr.value=dpr}
addEventListener('resize',resize);resize();
let lastT=performance.now(),frameN=0,lastTile=0,lastInfo=0;
document.addEventListener('visibilitychange',()=>{lastT=performance.now()});
function frame(t){
  requestAnimationFrame(frame);if(document.hidden||ctxLost){lastT=t;return}
  const dt=Math.min((t-lastT)/1e3,.1);lastT=t;frameN++;
  simMs=Date.now()+off*6e4;const s=sunAt(simMs);
  earthMat.uniforms.sun.value.copy(s.v);sunLight.position.copy(s.v).multiplyScalar(10);
  earthMat.uniforms.lights.value=L('lights')?1:0;earthMat.uniforms.shade.value=L('shade')?1:0;
  if(flight){
    flight.t+=dt/flight.dur;const k=Math.min(1,flight.t),e=ease(k);
    lat=flight.la0+(flight.la1-flight.la0)*e;lon=flight.lo0+(flight.lo1-flight.lo0)*e;
    dist=1+Math.exp(Math.max(Math.log(MIN-1),flight.h0+(flight.h1-flight.h0)*e+flight.bump*Math.sin(Math.PI*e)));
    latT=lat;lonT=lon;distT=dist;if(k>=1){lon=wrapPi(lon);lonT=lon;flight=null}
  }else if(!dragging){
    const target=paused?0:+$('#speed').value*R*Math.min(1,(dist-1)/1.2);                        // deg/s → rad/s, slower when zoomed in
    rotCur+=(target-rotCur)*(1-Math.exp(-dt*1.5));lon-=rotCur*dt;lonT-=rotCur*dt;                 // eased start, frame-rate independent
    const k=1-Math.exp(-dt*5);lon+=wrapPi(lonT-lon)*k;lat+=(latT-lat)*k;
    dist=1+Math.exp(Math.log(dist-1)+(Math.log(distT-1)-Math.log(dist-1))*k);
  }
  lon=wrapPi(lon);lonT=lon+wrapPi(lonT-lon);
  camera.position.copy(vec(lat,lon,dist));camera.up.set(0,1,0);camera.near=Math.max(1e-5,(dist-1)*.2);camera.far=300;camera.updateProjectionMatrix();camera.lookAt(0,0,0);
  sky.position.copy(camera.position);earthMat.uniforms.cam.value.copy(camera.position);
  atmoMat.uniforms.fade.value=clamp((dist-1.01)/.25,0,1);atmo.visible=atmoMat.uniforms.fade.value>.01;
  clouds.rotation.y+=dt*.0015;const co=clamp((dist-1.03)/.25,0,1)*.85;cloudMat.opacity=co;clouds.visible=L('clouds')&&co>.01;
  borders.visible=L('borders');if(L('borders')&&dist<1.6)loadStates();if(states)states.visible=dist<1.6;
  const to=clamp((1.55-dist)/.3,0,1);
  for(const x of tiles.values())if(x.vis){x.fade=Math.min(1,x.fade+dt*3.5);x.mat.opacity=Math.min(to,x.fade);x.mat.transparent=x.mat.opacity<.999}
  if(t-lastTile>250){lastTile=t;updateTiles(t);updateDyn();$('#attr').textContent=(to>.05&&L('tiles')?CFG.tileAttr+' · ':'')+'Places: Natural Earth + OpenStreetMap (Overpass) · Textures: NASA-derived (three.js examples) · Search: Nominatim'}
  if(frameN%4===0)updateLabels();
  if(pin){tv.copy(pin).project(camera);const el=$('#pin'),vis=pin.dot(camDir.copy(camera.position).normalize())>1/dist+.005;el.style.display=vis?'block':'none';el.style.transform=`translate(${(tv.x+1)/2*innerWidth}px,${(1-tv.y)/2*innerHeight}px)`}
  if(t-lastInfo>500){lastInfo=t;const d=new Date(simMs);$('#utc').textContent=d.toISOString().slice(11,19);$('#utcd').textContent=d.toISOString().slice(0,10);
    const live=off===0;$('#live').textContent=live?'LIVE':'SIM';$('#live').classList.toggle('sim',!live);
    $('#t-lab').textContent=live?'LIVE':(off>0?'+':'−')+Math.floor(Math.abs(off)/60)+'h '+String(Math.abs(off)%60).padStart(2,'0')+'m';updateInfo()}
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
