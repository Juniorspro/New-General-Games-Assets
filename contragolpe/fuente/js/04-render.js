
/* ====================== render ======================
   El mundo va con luz horneada (mapa de luz: RGB = cielo, rebote y lámparas; A = cuánto sol le llega) y el sol en vivo sólo
   para lo que se mueve y para las sombras de los personajes. Todo se dibuja en coma flotante y la última pasada revela:
   contornos de tinta, trama en las sombras, resplandor, tono de cine y gradación. */
const cv3 = $('lienzo3d'), cvH = $('hud');
/* los huesos van en uniformes y no en una textura: con 14 entran de sobra, y la textura de cada muñeco se subía entera (texImage2D)
   en cada cuadro, 13 por cuadro: con el procesador de un teléfono flojo era el 18 % de lo que tardaba mandar el dibujo. three lo
   decide al crearse, por las texturas que puede leer el sombreador de vértices: el contexto se crea acá (con lo mismo que pediría
   three) y mientras nace el dibujante dice que no puede leer ninguna. Cambiarlo después no sirve: los programas ya quedan armados
   para la textura y los huesos se mandan como uniformes (la mano izquierda desaparecía y las sombras salían estiradas) */
const ren = (()=>{ const op = {canvas:cv3, antialias:false, powerPreference:'high-performance', stencil:false, alpha:false};
  const at = {alpha:false, depth:true, stencil:false, antialias:false, premultipliedAlpha:true, preserveDrawingBuffer:false, powerPreference:'high-performance', failIfMajorPerformanceCaveat:false};
  let gl = null; try{ gl = cv3.getContext('webgl2', at) || cv3.getContext('webgl', at); }catch(e){}
  if(!gl) return new THREE.WebGLRenderer(op);
  const gp = gl.getParameter; gl.getParameter = function(p){ return p === 0x8B4C ? 0 : gp.call(this, p); };   /* MAX_VERTEX_TEXTURE_IMAGE_UNITS */
  try{ return new THREE.WebGLRenderer({...op, context:gl}); } finally { delete gl.getParameter; } })();
ren.outputEncoding = THREE.sRGBEncoding;
/* si el teléfono le quita el contexto a la página (poca memoria, otra app pesada), no vuelve solo: se recarga en vez de quedar congelada */
cv3.addEventListener('webglcontextlost', e=>{ e.preventDefault(); setTimeout(()=> location.reload(), 400); });
ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFShadowMap; ren.shadowMap.autoUpdate = true;
const escena = new THREE.Scene();
const escVM = new THREE.Scene();                    /* el arma y las manos en primera persona */
const cam = new THREE.PerspectiveCamera(70, 2, 0.05, 600);
const camVM = new THREE.PerspectiveCamera(54, 2, 0.05, 600);   /* mismos cortes que la cámara del mundo: así la profundidad se compara */
escena.add(cam);
/* en un teléfono la pantalla tiene 2,5–3 píxeles por punto: el 3D se dibuja a 1,75 como mucho (con la tinta y el grano no se nota) y
   el HUD sigue nítido. Pintar píxeles es lo que cuesta: con 2,5 eran el doble por cuadro. */
const ES_TACTIL = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
const DPR0 = Math.min(window.devicePixelRatio || 1, 2.5);
let DPR = Math.min(DPR0, ES_TACTIL ? 1.75 : 2.5), CALIDAD = 0.8, RH = 1;
const hg = cvH.getContext('2d');
/* escala de la interfaz: 1 salvo en la «versión de escritorio» de un teléfono (vista achicada a menos de 0,8) */
const UI = {u:1};
function escalaUI(){ const vv = window.visualViewport, e = vv && vv.scale > 0 ? vv.scale : 1, u = e < 0.8 ? 1/e : 1;
  if(Math.abs(u - UI.u) < 0.01) return false; UI.u = u; const de = document.documentElement; de.style.setProperty('--u', u.toFixed(4)); de.classList.toggle('escala', u > 1); return true; }
escalaUI();
if(window.visualViewport) visualViewport.addEventListener('resize', ()=>{ if(escalaUI()) setTimeout(medir, 60); });
function medir(){
  const pa = $('pantalla'), de = document.documentElement; pa.classList.toggle('bajo', pa.clientHeight < 430); de.style.setProperty('--uw', pa.clientWidth/100 + 'px'); de.style.setProperty('--uh', pa.clientHeight/100 + 'px'); de.style.setProperty('--umin', Math.min(pa.clientWidth, pa.clientHeight)/100 + 'px');
  const w = Math.max(2, cv3.clientWidth || innerWidth), h = Math.max(2, cv3.clientHeight || innerHeight);
  const pr = Math.max(0.5, DPR*lim(CALIDAD, 0.35, 1)*0.85);
  ren.setPixelRatio(pr); ren.setSize(w, h, false);
  cam.aspect = camVM.aspect = w/h; cam.updateProjectionMatrix(); camVM.updateProjectionMatrix();
  RH = Math.min(DPR0, 2)*(CALIDAD >= 0.55 ? 1 : 0.8); cvH.width = Math.round(w*RH); cvH.height = Math.round(h*RH);
  if(typeof postMedir === 'function') postMedir();
  /* con poca calidad: sombra de 512 y el mundo sin relieve */
  const ts = CALIDAD >= 0.75 ? 1024 : 512; if(sol.shadow.mapSize.x !== ts){ sol.shadow.mapSize.set(ts, ts); if(sol.shadow.map){ sol.shadow.map.dispose(); sol.shadow.map = null; } }
  if(typeof relieveMundo === 'function') relieveMundo(CALIDAD >= 0.7);
}
addEventListener('resize', ()=>{ escalaUI(); setTimeout(medir, 60); });
/* calidad automática por el intervalo real entre cuadros (lo que cuesta es pintar píxeles, no el JS) */
const COSTO = {s:0, n:0, ult:0, desde:0};
const CALIDAD_FIJA = {altos:1, medios:0.7, bajos:0.45};
/* GRÁFICOS de AJUSTES: auto (lo aprendido) o un valor fijo; se aplica al arrancar y al tocar el botón */
function aplicarGraficos(){ const g = G.graficos || 'auto'; CALIDAD = g === 'auto' ? (G.calAuto || 0.8) : (CALIDAD_FIJA[g] || 0.8); COSTO.s = COSTO.n = 0; medir(); }
function fijarCalidad(c, aprendida){ CALIDAD = c; medir(); if(aprendida){ G.calAuto = +c.toFixed(2); guardar(); } }
function costoDeNuevo(){ COSTO.s = COSTO.n = 0; COSTO.ult = 0; COSTO.desde = performance.now() + 1200; }
function medirCosto(ts){
  if(ts < COSTO.desde){ COSTO.ult = ts; return; }
  if(COSTO.ult){ const d = ts - COSTO.ult; if(d < 1500){ COSTO.s += d; COSTO.n++; } } COSTO.ult = ts;
  const m = COSTO.n ? COSTO.s/COSTO.n : 0;
  if(COSTO.n >= 45 || (COSTO.n >= 8 && m > 50)){ COSTO.s = 0; COSTO.n = 0; if(G.graficos && G.graficos !== 'auto') return;
    if(m > 21 && CALIDAD > 0.4) fijarCalidad(Math.max(0.4, CALIDAD - (m > 60 ? 0.25 : m > 30 ? 0.15 : 0.08)), true);
    else if(m < 17.6 && CALIDAD < 1) fijarCalidad(Math.min(1, CALIDAD + 0.05), true); } }

/* ---------- luces: el sol en vivo (sombra sólo de lo que se mueve) y el cielo para personajes y armas ---------- */
const SOLDIR = V3(0.45, 0.78, 0.32).normalize();
const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024); sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.02;
const SC = sol.shadow.camera; SC.left = -22; SC.right = 22; SC.top = 22; SC.bottom = -22; SC.near = 1; SC.far = 140;
escena.add(sol); escena.add(sol.target);
/* el mundo no lleva luz de cielo en vivo (la tiene horneada): los personajes la reciben por su propio uniforme */
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5e4e, 0.9);
/* el arma en primera persona vive en su escena: su propio sol y cielo, con la luz del lugar donde está el jugador */
const solVM = new THREE.DirectionalLight(0xffffff, 2.2), hemiVM = new THREE.HemisphereLight(0xbfd8ff, 0x6b5e4e, 0.9);
escVM.add(solVM); escVM.add(solVM.target); escVM.add(hemiVM); escVM.add(camVM);
const lin = h=> new THREE.Color(h).convertSRGBToLinear();

/* ---------- cielo: panorama generado (si llegó) o degradé, con disco de sol ---------- */
const CIELO = {cenit:lin('#3f7fd4'), horiz:lin('#bcd6ec'), suelo:lin('#8a8070'), solCol:lin('#fff1d6'), tex:null, rot:0};
const U_CIELO = {tCielo:{value:null}, usaTex:{value:0}, rot:{value:0}, cenit:{value:new THREE.Color()}, horiz:{value:new THREE.Color()}, suelo:{value:new THREE.Color()}, solDir:{value:SOLDIR}, solCol:{value:new THREE.Color()}, expo:{value:1}};
const matCielo = new THREE.ShaderMaterial({uniforms:U_CIELO, side:THREE.BackSide, depthWrite:false, fog:false,
  vertexShader:`varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader:`uniform sampler2D tCielo; uniform float usaTex, rot, expo; uniform vec3 cenit, horiz, suelo, solDir, solCol; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); float y = d.y; vec3 c;
      if(usaTex > 0.5){ float u = atan(d.z, d.x)/6.2831853 + 0.5 + rot; float v = 0.5 - asin(clamp(y, -1.0, 1.0))/3.1415926;
        c = pow(texture2D(tCielo, vec2(u, clamp(v, 0.002, 0.998))).rgb, vec3(2.2))*1.25; }
      else { c = mix(horiz, cenit, pow(max(y, 0.0), 0.55)); c = mix(c, suelo, smoothstep(0.0, -0.12, y)); }
      float s = max(dot(d, solDir), 0.0);
      c += solCol*(pow(s, 900.0)*30.0 + pow(s, 60.0)*0.35 + pow(s, 6.0)*0.08);
      gl_FragColor = vec4(c*expo, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`});
const cieloMalla = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), matCielo); cieloMalla.frustumCulled = false; escena.add(cieloMalla);
/* el cielo, después de todo lo opaco: va al fondo (z = w) y la prueba de profundidad lo descarta donde ya hay mundo. Dibujado
   primero se pintaba la pantalla entera y el mundo encima (en SwiftShader, 6 de los 63 ms de la escena) */
cieloMalla.renderOrder = 1;
function ponerCielo(id, def){
  const m = manDe('cielo', id); def = def || {};
  CIELO.cenit.copy(lin(def.cenit || '#3f7fd4')); CIELO.horiz.copy(lin(def.horiz || '#bcd6ec')); CIELO.suelo.copy(lin(def.suelo || '#8a8070')); CIELO.solCol.copy(lin(def.sol || '#fff1d6'));
  let az = def.az === undefined ? 35 : def.az, el = def.elev === undefined ? 52 : def.elev;
  if(m){ if(m.cenit) CIELO.cenit.copy(lin(m.cenit)); if(m.horizonte){ const hz = typeof m.horizonte === 'string' ? m.horizonte : (m.horizonte.color || m.horizonte.color_opuesto); if(hz) CIELO.horiz.copy(lin(hz)); } }
  const a = az*GRAD, e = el*GRAD; SOLDIR.set(Math.sin(a)*Math.cos(e), Math.sin(e), -Math.cos(a)*Math.cos(e)).normalize();
  U_CIELO.cenit.value.copy(CIELO.cenit); U_CIELO.horiz.value.copy(CIELO.horiz); U_CIELO.suelo.value.copy(CIELO.suelo); U_CIELO.solCol.value.copy(CIELO.solCol);
  U_CIELO.usaTex.value = 0; CIELO.pedido = null;   /* si dos cielos se piden seguidos, gana el último pedido, no el último que decodifica */
  if(m && ARCH['cielo/' + id]){ const azP = m.sol && m.sol.az !== undefined ? m.sol.az : az; const uSol = Math.atan2(SOLDIR.z, SOLDIR.x)/TAU + 0.5; U_CIELO.rot.value = azP/360 - uSol;
    CIELO.pedido = id;
    const poner = t=>{ if(!t || CIELO.pedido !== id) return; if(CIELO.tex) CIELO.tex.dispose(); t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
      CIELO.tex = t; U_CIELO.tCielo.value = t; U_CIELO.usaTex.value = 1; };
    /* en la APK, en ETC2 (el nivel grande: el cielo va sin mips): 1 MB en la placa en vez de 8 */
    if(ETC2['cielo/' + id]) fetch(ETC2['cielo/' + id]).then(r=> r.arrayBuffer()).then(etc2Leer).then(E=>{ const m = E.mips[0];
      poner(etc2Placa() ? new THREE.CompressedTexture([m], m.width, m.height, THREE.RGB_ETC2_Format) : new THREE.Texture(new ImageData(new Uint8ClampedArray(etc2ARGBA(m.data, m.width, m.height).buffer), m.width, m.height))); }, ()=>{});
    else decImagen('cielo/' + id, false).then(im=> im && poner(new THREE.Texture(im))); }
  sol.color.copy(CIELO.solCol); solVM.color.copy(CIELO.solCol);
  hemi.color.copy(CIELO.cenit).lerp(new THREE.Color(1,1,1), 0.35); hemi.groundColor.copy(CIELO.suelo); hemiVM.color.copy(hemi.color); hemiVM.groundColor.copy(hemi.groundColor);
  escena.fog = new THREE.Fog(CIELO.horiz.clone().convertLinearToSRGB(), def.nieblaCerca || 70, def.nieblaLejos || 320);
}

/* ====================== revelado: HDR → tinta → resplandor → tono → pantalla ====================== */
const POST = {ok:false, rt:null, mips:[], w:0, h:0, t:0, danio:0, cegado:0, flashRes:0, muerto:0, vmRango:0.5,
  grado:{lift:[0,0,0], gamma:[1,1,1], gain:[1,1,1], sat:1.08, contraste:1.04, frio:[0.96,0.99,1.04], calido:[1.04,1,0.96], vineta:0.18, grano:0.012, expo:0.84, clave:0.26, autoK:0.6}};
const QUAD = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), QESC = new THREE.Scene(), QCAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
QUAD.frustumCulled = false; QESC.add(QUAD);
const VERT_Q = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const MAT_BAJA = new THREE.ShaderMaterial({uniforms:{t:{value:null}, px:{value:new THREE.Vector2()}, umbral:{value:1.4}, rodilla:{value:0.5}, primera:{value:0}},
  vertexShader:VERT_Q, depthTest:false, depthWrite:false,
  fragmentShader:`uniform sampler2D t; uniform vec2 px; uniform float umbral, rodilla, primera; varying vec2 vUv;
    float ok1(float x){ return (x > -1.0 && x < 60000.0) ? x : 0.0; }
    vec3 limpio(vec3 c){ return min(vec3(ok1(c.x), ok1(c.y), ok1(c.z)), vec3(60.0)); }
    float lg(vec3 c){ return log(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 0.002)); }
    float okA(float x){ return (x > -9.0 && x < 9.0) ? x : -2.0; }
    void main(){ vec4 s1 = texture2D(t, vUv + px*vec2(-1.0,-1.0)), s2 = texture2D(t, vUv + px*vec2(1.0,-1.0)), s3 = texture2D(t, vUv + px*vec2(-1.0,1.0)), s4 = texture2D(t, vUv + px*vec2(1.0,1.0));
      vec3 a = limpio(s1.rgb), b = limpio(s2.rgb), e = limpio(s3.rgb), d = limpio(s4.rgb); vec3 c = (a + b + e + d)*0.25; float la;
      if(primera > 0.5){ la = 0.25*(lg(a) + lg(b) + lg(e) + lg(d));
        float br = max(c.r, max(c.g, c.b)); float k = umbral*rodilla + 1e-4; float s = clamp(br - umbral + k, 0.0, 2.0*k); s = s*s/(4.0*k); c *= max(s, br - umbral)/max(br, 1e-4); c = min(c, vec3(30.0)); }
      else la = 0.25*(okA(s1.a) + okA(s2.a) + okA(s3.a) + okA(s4.a));
      gl_FragColor = vec4(c, la); }`});
/* exposición automática: la luminancia media (con más peso al centro, como el ojo) se funde con la de antes en un búfer de 1×1 */
const MAT_ADAPTA = new THREE.ShaderMaterial({uniforms:{t:{value:null}, k:{value:1}}, vertexShader:VERT_Q, depthTest:false, depthWrite:false, transparent:true,
  blending:THREE.CustomBlending, blendSrc:THREE.SrcAlphaFactor, blendDst:THREE.OneMinusSrcAlphaFactor, blendEquation:THREE.AddEquation,
  fragmentShader:`uniform sampler2D t; uniform float k; varying vec2 vUv;
    void main(){ float s = 0.0, w = 0.0;
      for(int j=0;j<4;j++) for(int i=0;i<6;i++){ vec2 uv = vec2((float(i) + 0.5)/6.0, (float(j) + 0.5)/4.0); float d = length((uv - 0.5)*vec2(1.0, 0.8));
        float ww = 1.0 - 0.65*smoothstep(0.08, 0.55, d); float a = texture2D(t, uv).a; if(a > -9.0 && a < 9.0){ s += a*ww; w += ww; } }
      float L = exp(s/max(w, 1e-3)); gl_FragColor = vec4(L, L, L, k); }`});
/* para medir desde el banco: la luminancia adaptada en logaritmo, a 8 bits */
const MAT_LEER = new THREE.ShaderMaterial({uniforms:{t:{value:null}}, vertexShader:VERT_Q, depthTest:false, depthWrite:false,
  fragmentShader:`uniform sampler2D t; varying vec2 vUv; void main(){ float v = clamp((log2(max(texture2D(t, vec2(0.5)).r, 1e-4)) + 10.0)/14.0, 0.0, 1.0); gl_FragColor = vec4(v, v, v, 1.0); }`});
const MAT_SUBE = new THREE.ShaderMaterial({uniforms:{t:{value:null}, px:{value:new THREE.Vector2()}}, vertexShader:VERT_Q, depthTest:false, depthWrite:false,
  blending:THREE.AdditiveBlending, transparent:true,
  fragmentShader:`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb*4.0;
      c += (texture2D(t, vUv + vec2(px.x,0.0)).rgb + texture2D(t, vUv - vec2(px.x,0.0)).rgb + texture2D(t, vUv + vec2(0.0,px.y)).rgb + texture2D(t, vUv - vec2(0.0,px.y)).rgb)*2.0;
      c += texture2D(t, vUv + px).rgb + texture2D(t, vUv - px).rgb + texture2D(t, vUv + vec2(px.x,-px.y)).rgb + texture2D(t, vUv + vec2(-px.x,px.y)).rgb;
      gl_FragColor = vec4(c/16.0, 1.0); }`});
/* la trama de las sombras: líneas a 45° dibujadas a mano una vez (con temblor), repetida en pantalla */
function texTrama(){ const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
  const r = mulberry(33); g.strokeStyle = '#000'; g.lineCap = 'round';
  /* líneas a 45° que empalman en los bordes (se dibujan corridas un lado para que la costura no se vea) */
  for(let k=-N;k<N*2;k+=8){ const ancho = 0.7 + r()*0.6, a = 0.45 + r()*0.5, tr = (r() - 0.5)*1.2;
    for(const dx of [-N, 0, N]){ g.lineWidth = ancho; g.globalAlpha = a; g.beginPath(); let x = k + dx, y = 0; g.moveTo(x, y); while(y < N){ y += 8; x += 8 + tr*0.3; g.lineTo(x, y); } g.stroke(); } }
  g.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; }
const MAT_FINAL = new THREE.ShaderMaterial({
  uniforms:{tHdr:{value:null}, tProf:{value:null}, tBloom:{value:null}, tTrama:{value:texTrama()}, qW:{value:3.05e-4}, qSim:{value:0}, viejo:{value:0}, escT:{value:1.2}, tAdapt:{value:null}, clave:{value:0.3}, autoK:{value:0.6}, usaAuto:{value:0}, bloomK:{value:0.35}, expo:{value:1}, tiempo:{value:0}, res:{value:new THREE.Vector2(1,1)},
    lift:{value:new THREE.Vector3()}, gam:{value:new THREE.Vector3(1,1,1)}, gain:{value:new THREE.Vector3(1,1,1)}, sat:{value:1}, contraste:{value:1},
    frio:{value:new THREE.Vector3(1,1,1)}, calido:{value:new THREE.Vector3(1,1,1)}, vineta:{value:0.3}, grano:{value:0.03},
    danio:{value:0}, cegado:{value:0}, muerto:{value:0}, usaBloom:{value:1}, tinta:{value:1}, grosor:{value:1}, cerca:{value:0.05}, lejos:{value:600}, vmRango:{value:0.5}, vmInv:{value:2}, iCerca:{value:20}, kProf:{value:20}},
  vertexShader:VERT_Q, depthTest:false, depthWrite:false,
  fragmentShader:`uniform sampler2D tHdr, tBloom, tTrama, tAdapt;
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      uniform highp sampler2D tProf;
    #else
      uniform mediump sampler2D tProf;
    #endif
    uniform float qW, qSim, viejo, escT, clave, autoK, usaAuto, bloomK, expo, tiempo, sat, contraste, vineta, grano, danio, cegado, muerto, usaBloom, tinta, grosor, cerca, lejos, vmRango, vmInv, iCerca, kProf; uniform vec2 res;
    uniform vec3 lift, gam, gain, frio, calido; varying vec2 vUv;
    vec3 aces(vec3 x){ const mat3 A = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
      const mat3 B = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
      vec3 v = A*x; vec3 a = v*(v + 0.0245786) - 0.000090537; vec3 b = v*(0.983729*v + 0.4329510) + 0.238081; return clamp(B*(a/b), 0.0, 1.0); }
    vec3 aSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
    float azar(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
    /* profundidad del búfer → 1/metros; el arma en primera persona está comprimida en [0, vmRango]. 1/z es lineal en la
       profundidad del búfer: 1/cerca − d·(lejos − cerca)/(cerca·lejos), la misma cuenta de antes sin sus dos divisiones (eran 18
       por píxel, de las nueve muestras) */
    float invMetros(float d){ float vm = step(d, vmRango - 1e-4); float dd = mix(d, d*vmInv, vm); return iCerca - dd*kProf; }
    float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    float prof(vec2 uv){ float d = texture2D(tProf, uv).r; return qSim > 0.0 ? floor(d/qSim + 0.5)*qSim : d; }
    float ok1(float x){ return (x > -1.0 && x < 60000.0) ? x : 0.0; }
    vec3 limpio(vec3 c){ return min(vec3(ok1(c.x), ok1(c.y), ok1(c.z)), vec3(60.0)); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 c = limpio(texture2D(tHdr, vUv).rgb);
      float w0 = invMetros(prof(vUv)), zc = 1.0/w0;
      /* más allá de 140 m la tinta y la trama valen cero (lejania): el cielo y lo muy lejano se saltean las ocho muestras de
         profundidad y las cuatro de color, con el mismo resultado */
      if(tinta > 0.5 && zc < 140.0){
        vec2 p = grosor/res;
        /* 1/z es lineal en pantalla sobre un plano: su segunda diferencia marca pliegues y el salto, siluetas */
        float wl = invMetros(prof(vUv - vec2(p.x, 0.0))), wr = invMetros(prof(vUv + vec2(p.x, 0.0)));
        float wd = invMetros(prof(vUv - vec2(0.0, p.y))), wu = invMetros(prof(vUv + vec2(0.0, p.y)));
        float wa = invMetros(prof(vUv + p)), wb = invMetros(prof(vUv - p));
        float wc = invMetros(prof(vUv + vec2(p.x, -p.y))), we = invMetros(prof(vUv + vec2(-p.x, p.y)));
        float pl = abs(wl + wr - 2.0*w0) + abs(wd + wu - 2.0*w0) + 0.5*(abs(wa + wb - 2.0*w0) + abs(wc + we - 2.0*w0));
        float sil = max(max(abs(wl - w0), abs(wr - w0)), max(abs(wu - w0), abs(wd - w0)))/w0;
        /* el escalón de la profundidad mete ruido en 1/z (qW por escalón; con 16 bits, 250 veces más que con 24): los umbrales nunca
           bajan del ruido, así un teléfono de 16 bits dibuja los pliegues fuertes y no rayas en cada escalón */
        float ruido = viejo > 0.5 ? 0.0 : qW*zc;
        float u0 = max(0.012, 8.0*ruido), u1 = max(0.09, 3.0*ruido);
        float borde = max(smoothstep(u0, u0*2.5, pl/w0), smoothstep(u1, u1*2.4, sil));
        /* detalle: bordes de color (paneles, carteles, costuras) con línea más fina; sólo cerca, que lejos el grano de la foto es ruido */
        float det = 0.0;
        if(zc < 35.0){   /* (desde 35 m el detalle vale cero: sin sus cuatro lecturas) */
          vec3 cl = limpio(texture2D(tHdr, vUv - vec2(p.x, 0.0)).rgb), cr = limpio(texture2D(tHdr, vUv + vec2(p.x, 0.0)).rgb), cd = limpio(texture2D(tHdr, vUv - vec2(0.0, p.y)).rgb), cu = limpio(texture2D(tHdr, vUv + vec2(0.0, p.y)).rgb);
          float gx = log(lum(cr) + 0.02) - log(lum(cl) + 0.02), gy = log(lum(cu) + 0.02) - log(lum(cd) + 0.02);
          det = smoothstep(0.65, 1.2, length(vec2(gx, gy)))*0.5*(1.0 - smoothstep(12.0, 35.0, zc)); }
        float lejania = 1.0 - smoothstep(45.0, 140.0, zc);
        float tin = clamp(max(borde, det)*lejania, 0.0, 1.0);
        /* trama cruzada en lo oscuro */
        float l = lum(c*expo);
        if(l < 0.1){   /* (la trama es sólo de lo oscuro: con más luz vale cero y no se lee) */
          float t1 = texture2D(tTrama, gl_FragCoord.xy/(96.0*escT)).r, t2 = texture2D(tTrama, vec2(gl_FragCoord.x, -gl_FragCoord.y)/(88.0*escT)).r;
          float tr = (1.0 - t1)*smoothstep(0.1, 0.02, l)*0.22 + (1.0 - t2)*smoothstep(0.035, 0.006, l)*0.2;
          c *= 1.0 - tr*lejania; }
        c = mix(c, vec3(0.012, 0.01, 0.012), tin*0.92);
      }
      if(usaBloom > 0.5) c += limpio(texture2D(tBloom, vUv).rgb)*bloomK;
      float ex = 1.0;
      if(usaAuto > 0.5){ float La = texture2D(tAdapt, vec2(0.5)).r; if(!(La > 1e-4 && La < 1e4)) La = clave; ex = clamp(pow(clave/La, autoK), 0.8, 2.1); }
      c *= expo/0.6*ex;
      c = aces(c);
      float l = lum(c);
      c *= mix(frio, calido, smoothstep(0.08, 0.7, l));
      c = pow(max(c*gain + lift*(1.0 - c), 0.0), 1.0/gam);
      c = (c - 0.5)*contraste + 0.5;
      l = lum(c); c = mix(vec3(l), c, sat*(1.0 - muerto*0.85));
      c = mix(c, vec3(0.55, 0.02, 0.01), clamp(danio*smoothstep(0.05, 0.42, r2*1.7), 0.0, 0.8));
      c *= 1.0 - vineta*smoothstep(0.1, 0.62, r2*1.6);
      c = mix(c, vec3(1.0), clamp(cegado, 0.0, 1.0));
      c = clamp(c, 0.0, 1.0);
      c = aSRGB(c);
      c += (azar(vUv*res + fract(tiempo)*vec2(71.0, 113.0)) - 0.5)*grano;
      gl_FragColor = vec4(c, 1.0); }`});
function rtNuevo(w, h, tipo, conProf){ const rt = new THREE.WebGLRenderTarget(w, h, {type:tipo, format:THREE.RGBAFormat, minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, depthBuffer:!!conProf, stencilBuffer:false, generateMipmaps:false});
  if(conProf){ rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.UnsignedIntType; rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter; }
  return rt; }
/* ¿el camino HDR anda de verdad? Que el búfer esté «completo» no alcanza: hay placas que no filtran la media precisión (se
   muestrea negro), que no compilan el revelado o que devuelven basura, y la pantalla queda negra con el HUD encima. Se pasa un
   color conocido por todo el camino (búfer HDR → resplandor → tono) a un búfer de 8 bits y se lee. Si no da, se dibuja directo
   con el ACES de three, que anda en cualquier placa. */
function probarHDR(){
  let rt = null, mip = null, sal = null, ok = false;
  try{
    const w2 = ren.capabilities.isWebGL2, gl = ren.getContext();
    if(w2 ? !ren.extensions.get('EXT_color_buffer_float') && !ren.extensions.get('EXT_color_buffer_half_float') : !(ren.extensions.get('OES_texture_half_float') && ren.extensions.get('EXT_color_buffer_half_float'))) return false;
    if(!w2 && !(ren.extensions.get('WEBGL_depth_texture') && ren.extensions.get('OES_texture_half_float_linear'))) return false;
    rt = rtNuevo(16, 16, THREE.HalfFloatType, true); mip = rtNuevo(8, 8, THREE.HalfFloatType, false);
    sal = new THREE.WebGLRenderTarget(16, 16, {type:THREE.UnsignedByteType, format:THREE.RGBAFormat, depthBuffer:false, stencilBuffer:false, generateMipmaps:false});
    ren.setRenderTarget(rt); if(gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw 0;
    const cc = ren.getClearColor(new THREE.Color()), ca = ren.getClearAlpha();
    ren.setClearColor(new THREE.Color(0.9, 0.5, 0.25), 1); ren.clear(true, true, false); ren.setClearColor(cc, ca);
    MAT_BAJA.uniforms.t.value = rt.texture; MAT_BAJA.uniforms.px.value.set(1/16, 1/16); MAT_BAJA.uniforms.primera.value = 1; pasadaQ(MAT_BAJA, mip);
    uniformesFinal(rt, mip.texture, 16, 16, true); pasadaQ(MAT_FINAL, sal);
    const px = new Uint8Array(4); ren.readRenderTargetPixels(sal, 8, 8, 1, 1, px);
    POST.prueba = Array.from(px.slice(0, 3));
    ok = px[0] > 120 && px[1] > 60 && px[0] > px[2] + 20 && px[0] < 255;
  }catch(e){ ok = false; }
  ren.setRenderTarget(null); for(const r of [rt, mip, sal]) if(r){ if(r.depthTexture) r.depthTexture.dispose(); r.dispose(); }
  return ok;
}
function uniformesFinal(rt, bloom, w, h, conBloom){
  const U = MAT_FINAL.uniforms, G2 = POST.grado;
  U.tHdr.value = rt.texture; U.tProf.value = rt.depthTexture; U.tBloom.value = bloom; U.usaBloom.value = conBloom ? 1 : 0; U.tiempo.value = (POST.t += 0.0173);
  U.res.value.set(w, h); U.expo.value = G2.expo; U.lift.value.fromArray(G2.lift); U.gam.value.fromArray(G2.gamma); U.gain.value.fromArray(G2.gain);
  U.sat.value = G2.sat; U.contraste.value = G2.contraste; U.frio.value.fromArray(G2.frio); U.calido.value.fromArray(G2.calido); U.vineta.value = G2.vineta; U.grano.value = G2.grano*(CALIDAD >= 0.55 ? 1 : 0);
  U.danio.value = POST.danio; U.cegado.value = POST.cegado; U.muerto.value = POST.muerto; U.tinta.value = (POST.tinta === null ? G.estilo !== 'normal' : POST.tinta) ? 1 : 0; U.qW.value = POST.qW; U.qSim.value = POST.qSim; U.viejo.value = POST.viejo ? 1 : 0; U.escT.value = Math.max(1.2, h/360);
  U.tAdapt.value = POST.adapt ? POST.adapt.texture : null; U.usaAuto.value = POST.adapt ? 1 : 0; U.clave.value = G2.clave; U.autoK.value = G2.autoK;
  U.grosor.value = Math.max(1.2, h/360); U.cerca.value = cam.near; U.lejos.value = cam.far; U.vmRango.value = POST.vmRango;
  U.vmInv.value = 1/POST.vmRango; U.iCerca.value = 1/cam.near; U.kProf.value = (cam.far - cam.near)/(cam.near*cam.far);
}
/* dibujar directo: ACES y sRGB de three en cada material (hay que recompilarlos) */
function sinRevelado(motivo){
  POST.ok = false; POST.motivo = motivo; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = POST.grado.expo;
  for(const e of [escena, escVM]) e.traverse(o=>{ if(o.material) for(const m of [].concat(o.material)) m.needsUpdate = true; });
  if(POST.rt){ POST.rt.dispose(); POST.rt.depthTexture.dispose(); POST.rt = null; } for(const m of POST.mips) m.dispose(); POST.mips = [];
}
/* tinta: la elige ESTILO en AJUSTES; ?tinta / ?sintinta la fuerzan. ?profbits=16 (u 11: lo que da un sampler de baja precisión) simula una profundidad peor y ?tintavieja usa los
   umbrales de antes (para ver las rayas en el banco) */
{ const q = location.search; POST.tinta = /[?&]sintinta/.test(q) ? false : /[?&]tinta\b/.test(q) ? true : null; const pb = q.match(/[?&]profbits=(\d+)/); POST.qSim = pb ? Math.pow(2, -(+pb[1])) : 0; POST.viejo = /[?&]tintavieja/.test(q); }
POST.adaptYa = true; POST.qW = Math.pow(2, -16)/cam.near;
function leerAdaptacion(){ if(!POST.adapt) return null; const sal = new THREE.WebGLRenderTarget(1, 1, {type:THREE.UnsignedByteType, format:THREE.RGBAFormat, depthBuffer:false});
  MAT_LEER.uniforms.t.value = POST.adapt.texture; pasadaQ(MAT_LEER, sal); const px = new Uint8Array(4); ren.readRenderTargetPixels(sal, 0, 0, 1, 1, px); ren.setRenderTarget(null); sal.dispose();
  const La = Math.pow(2, px[0]/255*14 - 10); return {La:+La.toFixed(4), ex:+Math.min(2.1, Math.max(0.8, Math.pow(POST.grado.clave/La, POST.grado.autoK))).toFixed(3)}; }
/* ¿con cuántos bits llega la profundidad al shader? (la del búfer: 16 o 24; y hay teléfonos que al leerla la bajan a ~11). Un plano que
   sube 2^-k a lo ancho de 256 píxeles y se lee con la misma declaración que el revelado: los valores distintos dicen el escalón.
   k = 16: 24 bits dan ~256 valores; k = 10: 16 bits dan 64 y 11 bits, 2. Si no se puede medir se asume lo peor (sin pliegues). */
function probarProfundidad(){
  let rt = null, sal = null, bits = 10;
  try{
    rt = rtNuevo(256, 4, THREE.HalfFloatType, true);
    sal = new THREE.WebGLRenderTarget(256, 1, {type:THREE.UnsignedByteType, format:THREE.RGBAFormat, depthBuffer:false, stencilBuffer:false, generateMipmaps:false});
    const cuenta = k=>{ const sube = Math.pow(2, 1 - k).toExponential(8);
      const mq = new THREE.ShaderMaterial({vertexShader:'void main(){ gl_Position = vec4(position.xy, (position.x*0.5 + 0.5)*' + sube + ', 1.0); }', fragmentShader:'void main(){ gl_FragColor = vec4(0.0); }'});
      QUAD.material = mq; ren.setRenderTarget(rt); ren.clear(true, true, false); ren.render(QESC, QCAM);
      const ml = new THREE.ShaderMaterial({uniforms:{t:{value:rt.depthTexture}}, vertexShader:VERT_Q, depthTest:false, depthWrite:false,
        fragmentShader:'#ifdef GL_FRAGMENT_PRECISION_HIGH\n uniform highp sampler2D t;\n#else\n uniform mediump sampler2D t;\n#endif\n varying vec2 vUv; void main(){ float v = clamp((texture2D(t, vec2(vUv.x, 0.5)).r - 0.5)*' + Math.pow(2, k).toFixed(1) + ', 0.0, 1.0); gl_FragColor = vec4(v, v, v, 1.0); }'});
      pasadaQ(ml, sal); const px = new Uint8Array(256*4); ren.readRenderTargetPixels(sal, 0, 0, 256, 1, px);
      const vistos = new Set(); for(let i=0;i<256;i++) vistos.add(px[i*4]); mq.dispose(); ml.dispose(); return vistos.size; };
    const nA = cuenta(16), nB = cuenta(10); POST.valoresProf = [nA, nB];
    bits = nA >= 24 ? 24 : nB >= 24 ? 16 : 10 + Math.log2(Math.max(1, nB));
  }catch(e){ bits = 10; }
  ren.setRenderTarget(null); for(const r of [rt, sal]) if(r){ if(r.depthTexture) r.depthTexture.dispose(); r.dispose(); }
  return bits;
}
POST.ok = !/[?&]sinpost/.test(location.search) && probarHDR();
if(POST.ok){ POST.bitsProf = probarProfundidad(); if(POST.qSim) POST.bitsProf = Math.min(POST.bitsProf, -Math.log2(POST.qSim)); POST.qW = Math.pow(2, -POST.bitsProf)/cam.near; }
if(!POST.ok){ POST.motivo = 'prueba'; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = POST.grado.expo; }
/* guardia: si la pantalla sale negra tres veces seguidas (cinco puntos; cada medio segundo al principio, después cada 2 s), se pasa a dibujar directo */
const GUARDIA = {n:0, negros:0, leidas:0, px:new Uint8Array(20), px1:new Uint8Array(4), pbo:null, sync:null, sinPbo:false};
const PUNTOS_GUARDIA = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]];
function juzgarNegro(px){ let negros = 0; for(let i=0;i<5;i++) if(px[i*4] + px[i*4 + 1] + px[i*4 + 2] < 8) negros++;
  GUARDIA.negros = negros === 5 ? GUARDIA.negros + 1 : 0;
  if(GUARDIA.negros >= 3){ console.warn('revelado: pantalla negra, dibujo directo'); sinRevelado('negro'); } }
/* leer la pantalla frena el teléfono hasta que la placa termina el cuadro (en un Mali, decenas de ms): con WebGL2 se lee a un búfer
   y se mira cuando la placa avisa que terminó, sin esperar */
function vigilarNegro(){
  const gl = ren.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, g2 = ren.capabilities.isWebGL2 && !GUARDIA.sinPbo;
  if(g2 && GUARDIA.sync){ const st = gl.clientWaitSync(GUARDIA.sync, 0, 0); if(st === gl.TIMEOUT_EXPIRED) return;
    gl.deleteSync(GUARDIA.sync); GUARDIA.sync = null; gl.bindBuffer(gl.PIXEL_PACK_BUFFER, GUARDIA.pbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, GUARDIA.px); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    GUARDIA.leidas++; juzgarNegro(GUARDIA.px); return; }
  if(++GUARDIA.n % (GUARDIA.n < 900 ? 30 : 120)) return;   /* al principio más seguido: que una pantalla negra dure poco */
  if(g2){ try{
      if(!GUARDIA.pbo){ GUARDIA.pbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, GUARDIA.pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, 20, gl.STREAM_READ); }
      else gl.bindBuffer(gl.PIXEL_PACK_BUFFER, GUARDIA.pbo);
      PUNTOS_GUARDIA.forEach(([fx, fy], i)=> gl.readPixels(Math.floor(w*fx), Math.floor(h*fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, i*4));
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); GUARDIA.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); return;
    } catch(e){ gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); GUARDIA.sinPbo = true; } }
  PUNTOS_GUARDIA.forEach(([fx, fy], i)=>{ gl.readPixels(Math.floor(w*fx), Math.floor(h*fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, GUARDIA.px1); GUARDIA.px.set(GUARDIA.px1, i*4); });
  GUARDIA.leidas++; juzgarNegro(GUARDIA.px);
}
function postMedir(){
  if(!POST.ok) return;
  const s = ren.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(2, s.x), h = Math.max(2, s.y);
  if(POST.rt && POST.w === w && POST.h === h) return;
  if(POST.rt){ POST.rt.dispose(); POST.rt.depthTexture.dispose(); } for(const m of POST.mips) m.dispose(); POST.mips = [];
  POST.rt = rtNuevo(w, h, THREE.HalfFloatType, true); POST.w = w; POST.h = h;
  if(!POST.adapt){ POST.adapt = rtNuevo(1, 1, THREE.HalfFloatType, false); POST.adaptT = 0; }
  let mw = w, mh = h; for(let i=0;i<5;i++){ mw = Math.max(2, mw >> 1); mh = Math.max(2, mh >> 1); POST.mips.push(rtNuevo(mw, mh, THREE.HalfFloatType, false)); }
}
function pasadaQ(mat, destino){ QUAD.material = mat; ren.setRenderTarget(destino); ren.render(QESC, QCAM); }
/* mundo, y encima el arma con la profundidad comprimida en [0, vmRango]: siempre adelante y con sus propios contornos */
function dibujarEscenas(conVM){
  ren.autoClear = true; ren.render(escena, cam);
  if(conVM){ const gl = ren.getContext(); ren.autoClear = false; gl.depthRange(0, POST.vmRango); ren.shadowMap.autoUpdate = false; ren.render(escVM, camVM); ren.shadowMap.autoUpdate = true; gl.depthRange(0, 1); ren.autoClear = true; }
}
function revelar(conVM){
  if(!POST.ok){ ren.setRenderTarget(null); dibujarEscenas(conVM); return; }
  postMedir();
  ren.setRenderTarget(POST.rt); dibujarEscenas(conVM);
  const nb = CALIDAD >= 0.5 ? (CALIDAD >= 0.8 ? 5 : 4) : 0;
  if(nb){
    let src = POST.rt.texture, w = POST.w, h = POST.h;
    for(let i=0;i<nb;i++){ const m = POST.mips[i]; MAT_BAJA.uniforms.t.value = src; MAT_BAJA.uniforms.px.value.set(1/w, 1/h); MAT_BAJA.uniforms.primera.value = i===0 ? 1 : 0;
      pasadaQ(MAT_BAJA, m); src = m.texture; w = m.width; h = m.height; }
    for(let i=nb-1;i>0;i--){ const m = POST.mips[i]; MAT_SUBE.uniforms.t.value = m.texture; MAT_SUBE.uniforms.px.value.set(1/m.width, 1/m.height);
      ren.autoClear = false; pasadaQ(MAT_SUBE, POST.mips[i-1]); ren.autoClear = true; }
  }
  if(nb){ const ahora = performance.now(), dt = POST.adaptT ? Math.min(0.25, (ahora - POST.adaptT)/1000) : 1; POST.adaptT = ahora;
    MAT_ADAPTA.uniforms.t.value = POST.mips[nb - 1].texture; MAT_ADAPTA.uniforms.k.value = POST.adaptYa ? 1 : 1 - Math.exp(-dt/0.55); POST.adaptYa = false;
    ren.autoClear = false; pasadaQ(MAT_ADAPTA, POST.adapt); ren.autoClear = true; }
  uniformesFinal(POST.rt, POST.mips[0].texture, POST.w, POST.h, nb > 0);
  pasadaQ(MAT_FINAL, null);
  if(POST.cegado < 0.5 && POST.muerto < 0.5) vigilarNegro();
}
