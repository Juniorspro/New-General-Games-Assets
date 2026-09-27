
/* ====================== personajes ======================
   Un cuerpo de una sola malla con piel (SkinnedMesh, 14 huesos): cadera, rodillas, codos y hombros se doblan mezclando dos huesos,
   así no hay tubos sueltos que se abren o se meten uno en otro. Encima va el equipo, modelado sobre el de CS2: CT con casco, máscara
   antigás o antiparras, portaplacas con cargadores, rodilleras y borceguíes; T con pasamontañas, pañuelo o gorro, chaleco de pecho,
   campera y zapatillas. Cada pieza se arma en el marco de su hueso (+y a lo largo del hueso).
   Las piernas, la cadera y la inclinación del tronco salen de mocap: clips sacados con MediaPipe de videos (el propio CS2 en tercera
   persona para correr, caminar agachado y saltar; actores de captura para caminar, caminar hacia atrás y estar quieto). Se reubican
   al largo de pierna del personaje, se giran hacia donde camina y la zancada se estira con la velocidad. Los brazos van al arma por IK. */
const PERS_PALETA = {
  ct:[{uni:'#4b5467', pan:'#3e4452', ch:'#2b2f37', cas:'#2c3036', piel:'#c89272', bota:'#17181b', suela:'#0d0d0f', gua:'#1a1b1e', ex:'#3a4150', pad:'#1f2126', cara:'mascara', parche:'#2b4a9a'},
      {uni:'#1f2a3d', pan:'#26324a', ch:'#161b24', cas:'#1b2029', piel:'#a8795a', bota:'#111215', suela:'#0a0a0b', gua:'#121316', ex:'#2c3850', pad:'#15181e', cara:'antiparras', parche:'#c9c9c9'},
      {uni:'#5b5f45', pan:'#66684b', ch:'#3f4230', cas:'#50543d', piel:'#e0b090', bota:'#2b2419', suela:'#15120e', gua:'#2a2a24', ex:'#6f7255', pad:'#2d2f24', cara:'cara', parche:'#8a2a22'}],
  t:[{uni:'#5c4a37', pan:'#34363a', ch:'#2f2a22', cas:'#1b1b1b', piel:'#b98463', bota:'#2a2019', suela:'#141010', gua:'#1c1a17', ex:'#6b5a40', pad:'#2a2622', cara:'pasamontanas', parche:'#1b1b1b'},
     {uni:'#6d6a4f', pan:'#4a4636', ch:'#3a3829', cas:'#b5a585', piel:'#8f6346', bota:'#3a2d20', suela:'#1a140e', gua:'#2a261f', ex:'#8a8360', pad:'#3a3629', cara:'panuelo', parche:'#9a2f25'},
     {uni:'#565b60', pan:'#2f3b52', ch:'#2b2e31', cas:'#232323', piel:'#caa07c', bota:'#d8d6cf', suela:'#8a8780', gua:'#262626', ex:'#6a6f74', pad:'#2a2d30', cara:'bandana', parche:'#7a1f1a'}]};
const DIM = {cadera:0.93, torso:0.46, cuello:0.08, cabeza:0.24, brazo:0.29, ante:0.27, muslo:0.44, pierna:0.43, pie:0.19, hombroX:0.19, caderaX:0.095};
const HUESOS_P = ['pelvis', 'torso', 'cabeza', 'brazo_i', 'ante_i', 'brazo_d', 'ante_d', 'muslo_i', 'pierna_i', 'pie_i', 'muslo_d', 'pierna_d', 'pie_d'];
const REF_P = {pelvis:V3(0, 0, -1), torso:V3(0, 0, -1), cabeza:V3(0, 0, -1), brazo_i:V3(-1, 0, 0), ante_i:V3(-1, 0, 0), brazo_d:V3(1, 0, 0), ante_d:V3(1, 0, 0),
  muslo_i:V3(0, 0, 1), pierna_i:V3(0, 0, 1), pie_i:V3(0, 1, 0), muslo_d:V3(0, 0, 1), pierna_d:V3(0, 0, 1), pie_d:V3(0, 1, 0)};
/* ---------- formas (en el marco del hueso) ---------- */
/* tubo de sección elíptica a lo largo de +y: perfil [[t, rx, rz, ox, oz], …] con t de 0 a 1 sobre el largo L */
function tuboP(perfil, L, lados){ lados = lados || 8; const pos = [], idx = [], R = perfil.length;
  for(let r=0;r<R;r++){ const [t, rx, rz, ox, oz] = perfil[r]; for(let k=0;k<lados;k++){ const a = k/lados*TAU; pos.push((ox || 0) + Math.cos(a)*rx, t*L, (oz || 0) + Math.sin(a)*rz); } }
  for(let r=0;r<R-1;r++) for(let k=0;k<lados;k++){ const a = r*lados + k, b = r*lados + (k + 1) % lados, c = a + lados, d = b + lados; idx.push(a, c, b, b, c, d); }
  const p0 = perfil[0], p1 = perfil[R - 1], ci = pos.length/3; pos.push(p0[3] || 0, p0[0]*L, p0[4] || 0); for(let k=0;k<lados;k++) idx.push(ci, k, (k + 1) % lados);
  const cf = pos.length/3, b0 = (R - 1)*lados; pos.push(p1[3] || 0, p1[0]*L, p1[4] || 0); for(let k=0;k<lados;k++) idx.push(cf, b0 + (k + 1) % lados, b0 + k);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g; }
const fB = (w, h, d, x, y, z)=>{ const g = new THREE.BoxGeometry(w, h, d); g.translate(x || 0, y || 0, z || 0); return g; };
const fE = (r, x, y, z, sx, sy, sz, det)=>{ const g = new THREE.IcosahedronGeometry(r, det === undefined ? 1 : det); g.scale(sx || 1, sy || 1, sz || 1); g.translate(x || 0, y || 0, z || 0); return g; };
const fCil = (r, h, x, y, z, rx, lados)=>{ const g = new THREE.CylinderGeometry(r, r, h, lados || 10); if(rx) g.rotateX(rx); g.translate(x || 0, y || 0, z || 0); return g; };
const fCasq = (r, x, y, z, sx, sy, sz, alto)=>{ const g = new THREE.SphereGeometry(r, 10, 5, 0, TAU, 0, Math.PI*(alto || 0.5)); g.scale(sx || 1, sy || 1, sz || 1); g.translate(x || 0, y || 0, z || 0); return g; };
/* ---------- el cuerpo y el equipo: [{g, col, h (hueso), mz:{p:[hueso, hasta], c:[hueso, desde]}}] ---------- */
function piezasPersonaje(bando, v){
  const C = PERS_PALETA[bando][v % 3], ct = bando === 'ct', L = [];
  const pz = (g, col, h, mz)=> L.push({g, col, h, mz});
  /* pelvis (x derecha, y arriba, z atrás): caderas, cinturón, funda y bolsillo */
  pz(tuboP([[0, 0.15, 0.1], [0.35, 0.168, 0.112], [0.75, 0.165, 0.108], [1, 0.152, 0.1]], 0.22).translate(0, -0.13, 0), C.pan, 'pelvis');
  pz(tuboP([[0, 0.172, 0.117], [1, 0.172, 0.117]], 0.045, 10).translate(0, 0.045, 0), '#141416', 'pelvis');
  pz(fB(0.035, 0.03, 0.02, 0, 0.068, -0.118), '#6b6b66', 'pelvis');
  if(ct){ pz(fB(0.05, 0.15, 0.08, 0.2, -0.05, 0.0), C.ch, 'pelvis'); pz(fB(0.03, 0.06, 0.05, 0.2, -0.12, 0.0), '#0e0e10', 'pelvis'); }
  else pz(fB(0.1, 0.09, 0.05, -0.12, -0.02, 0.12), C.ex, 'pelvis');
  pz(fB(0.1, 0.08, 0.04, -0.15, 0.0, 0.1), C.ch, 'pelvis');
  /* torso (x derecha, y arriba, z atrás): tronco con hombros, y el chaleco */
  pz(tuboP([[0, 0.148, 0.103], [0.2, 0.155, 0.107], [0.5, 0.18, 0.118], [0.78, 0.2, 0.12], [0.9, 0.205, 0.11], [0.97, 0.13, 0.085], [1, 0.07, 0.06]], DIM.torso, 10), C.uni, 'torso', {p:['pelvis', 0.16]});
  if(ct){
    pz(fB(0.3, 0.3, 0.055, 0, 0.27, -0.125), C.ch, 'torso'); pz(fB(0.3, 0.31, 0.05, 0, 0.27, 0.118), C.ch, 'torso');
    pz(tuboP([[0, 0.172, 0.123], [1, 0.172, 0.123]], 0.13, 10).translate(0, 0.13, 0), C.ch, 'torso');
    for(const x of [-0.085, 0, 0.085]){ pz(fB(0.075, 0.12, 0.05, x, 0.19, -0.17), C.ex, 'torso'); pz(fB(0.07, 0.025, 0.052, x, 0.255, -0.172), C.ch, 'torso'); }
    pz(fB(0.06, 0.13, 0.045, -0.12, 0.35, -0.16), '#111214', 'torso'); pz(fCil(0.006, 0.12, -0.13, 0.47, -0.15), '#0b0b0b', 'torso');
    for(const x of [-0.11, 0.11]) pz(fB(0.06, 0.03, 0.26, x, 0.43, 0), C.ch, 'torso');
    pz(fB(0.07, 0.045, 0.01, 0.1, 0.36, -0.153), C.parche, 'torso'); pz(fB(0.07, 0.008, 0.012, 0.1, 0.36, -0.155), '#b8322a', 'torso'); pz(fB(0.008, 0.045, 0.012, 0.1, 0.36, -0.155), '#b8322a', 'torso');
    pz(tuboP([[0, 0.1, 0.075], [1, 0.085, 0.065]], 0.05).translate(0, 0.43, 0), C.uni, 'torso');
  } else {
    pz(fB(0.28, 0.16, 0.05, 0, 0.2, -0.13), C.ch, 'torso');
    for(const x of [-0.07, 0.07]){ pz(fB(0.075, 0.13, 0.045, x, 0.2, -0.165), C.ex, 'torso'); pz(fCil(0.012, 0.03, x, 0.28, -0.165), '#1a1a1a', 'torso'); }
    for(const x of [-0.11, 0.11]) pz(fB(0.045, 0.3, 0.02, x, 0.33, -0.12), C.ch, 'torso');
    pz(fB(0.3, 0.035, 0.24, 0, 0.12, 0), C.ch, 'torso');
    pz(fB(0.02, 0.26, 0.012, 0, 0.26, -0.122), '#1f1f1f', 'torso');
    pz(tuboP([[0, 0.11, 0.085], [1, 0.1, 0.075]], 0.06).translate(0, 0.42, 0), v % 3 === 2 ? C.uni : C.ex, 'torso');
    if(v % 3 === 2){ pz(fB(0.22, 0.12, 0.08, 0, 0.36, 0.13), C.uni, 'torso'); pz(fB(0.24, 0.05, 0.04, 0, 0.1, -0.12), C.uni, 'torso'); }
  }
  /* cabeza (x derecha, y arriba, z atrás) */
  pz(tuboP([[0, 0.056, 0.052], [1, 0.05, 0.048]], 0.09), ct ? C.cara === 'cara' ? C.piel : '#1d1e22' : C.cas, 'cabeza');
  const craneo = C.cara === 'cara' || C.cara === 'antiparras' ? C.piel : (C.cara === 'panuelo' ? C.cas : '#1b1b1d');
  pz(fE(0.108, 0, 0.17, 0.005, 0.9, 1.08, 1.02), C.cara === 'antiparras' ? '#1d1e22' : craneo, 'cabeza');
  pz(fE(0.04, 0, 0.14, -0.1, 0.9, 1.1, 0.7, 0), C.cara === 'antiparras' ? '#1d1e22' : craneo, 'cabeza');
  if(ct){
    pz(fCasq(0.128, 0, 0.18, 0.008, 1, 0.92, 1.1, 0.55), C.cas, 'cabeza');
    pz(fB(0.26, 0.012, 0.22, 0, 0.19, 0.01), C.cas, 'cabeza');
    for(const x of [-0.12, 0.12]){ pz(fB(0.02, 0.03, 0.14, x, 0.215, 0.0), '#1a1c20', 'cabeza'); pz(fCil(0.045, 0.035, x*1.02, 0.14, 0.0, 0), '#141518', 'cabeza'); }
    pz(fB(0.05, 0.04, 0.03, 0, 0.27, -0.11), '#141518', 'cabeza');
    if(C.cara === 'mascara'){
      pz(fE(0.07, 0, 0.12, -0.085, 1.25, 0.9, 0.75), '#16171a', 'cabeza');
      for(const x of [-0.042, 0.042]){ pz(fCil(0.03, 0.02, x, 0.175, -0.1, Math.PI/2), '#101113', 'cabeza'); pz(fCil(0.024, 0.021, x, 0.175, -0.104, Math.PI/2), '#6d8a92', 'cabeza'); }
      pz(fCil(0.035, 0.05, 0, 0.09, -0.14, Math.PI/2 + 0.4), '#1f2124', 'cabeza'); pz(fCil(0.028, 0.052, 0, 0.09, -0.142, Math.PI/2 + 0.4), '#3a3d42', 'cabeza');
    } else if(C.cara === 'antiparras'){
      pz(fB(0.19, 0.05, 0.05, 0, 0.175, -0.1), '#101113', 'cabeza'); pz(fB(0.17, 0.035, 0.02, 0, 0.175, -0.124), '#2d4250', 'cabeza');
      pz(fE(0.06, 0, 0.1, -0.08, 1.2, 0.8, 0.7), '#1d1e22', 'cabeza');
    } else {
      pz(fB(0.16, 0.045, 0.02, 0, 0.175, -0.11), '#15161a', 'cabeza');
      pz(fE(0.058, 0, 0.085, -0.055, 1.3, 0.75, 0.9), '#2e261e', 'cabeza'); pz(fB(0.2, 0.03, 0.03, 0, 0.215, -0.11), '#15161a', 'cabeza');
      pz(fB(0.02, 0.1, 0.02, -0.11, 0.11, -0.06), '#111', 'cabeza');
    }
  } else if(C.cara === 'pasamontanas'){
    pz(fB(0.13, 0.03, 0.015, 0, 0.175, -0.108), C.piel, 'cabeza'); for(const x of [-0.03, 0.03]) pz(fB(0.035, 0.018, 0.012, x, 0.177, -0.116), '#0a0a0a', 'cabeza');
    pz(fB(0.15, 0.03, 0.02, 0, 0.183, -0.118), '#0d0d0d', 'cabeza');
  } else if(C.cara === 'panuelo'){
    pz(fE(0.118, 0, 0.19, 0.01, 0.95, 0.95, 1.05), C.cas, 'cabeza'); pz(fE(0.075, 0, 0.1, -0.075, 1.25, 0.8, 0.8), C.cas, 'cabeza');
    for(let k=0;k<4;k++) pz(tuboP([[0, 0.121, 0.127], [1, 0.121, 0.127]], 0.012, 12).translate(0, 0.14 + k*0.035, 0.01), C.parche, 'cabeza');
    pz(fB(0.13, 0.032, 0.02, 0, 0.17, -0.105), C.piel, 'cabeza'); pz(fB(0.1, 0.03, 0.12, 0, 0.1, 0.1), C.cas, 'cabeza');
  } else {
    pz(fCasq(0.118, 0, 0.2, 0.01, 1, 0.8, 1.05, 0.5), C.cas, 'cabeza'); pz(fB(0.2, 0.02, 0.1, 0, 0.2, -0.1), C.cas, 'cabeza');
    pz(fE(0.075, 0, 0.1, -0.075, 1.25, 0.8, 0.8), C.parche, 'cabeza'); pz(fB(0.13, 0.03, 0.015, 0, 0.165, -0.105), C.piel, 'cabeza');
  }
  /* brazos: manga con hombro, codo, puño del guante y mano (redondos: el giro del hueso no importa) */
  for(const s of ['i', 'd']){
    pz(tuboP([[0, 0.062, 0.062], [0.12, 0.066, 0.064], [0.5, 0.056, 0.054], [0.88, 0.05, 0.048], [1, 0.047, 0.046]], DIM.brazo, 8), C.uni, 'brazo_' + s, {p:['torso', 0.12], c:['ante_' + s, 0.86]});
    pz(fE(0.074, 0, 0.03, 0, 1, 0.85, 1), ct ? C.ch : C.uni, 'brazo_' + s);
    if(ct) pz(fB(0.02, 0.06, 0.06, s === 'd' ? 0.062 : -0.062, 0.1, 0), C.parche, 'brazo_' + s);
    pz(tuboP([[0, 0.047, 0.046], [0.15, 0.05, 0.048], [0.55, 0.043, 0.04], [0.85, 0.036, 0.034], [1, 0.034, 0.032]], DIM.ante, 8), C.uni, 'ante_' + s, {p:['brazo_' + s, 0.14]});
    pz(tuboP([[0, 0.041, 0.039], [1, 0.039, 0.037]], 0.05).translate(0, DIM.ante - 0.05, 0), C.gua, 'ante_' + s);
    pz(fE(0.042, 0, DIM.ante + 0.045, 0, 0.8, 1.15, 0.6), C.gua, 'ante_' + s); pz(fE(0.018, 0, DIM.ante + 0.03, s === 'd' ? -0.03 : 0.03, 1, 1.6, 1), C.gua, 'ante_' + s);
  }
  /* piernas (x derecha, y del hueso hacia abajo, z adelante): muslo con bolsillo, rodillera, canilla con pantorrilla, borceguí */
  for(const s of ['i', 'd']){ const sx = s === 'd' ? 1 : -1;
    pz(tuboP([[0, 0.09, 0.094], [0.14, 0.09, 0.093], [0.5, 0.077, 0.082], [0.8, 0.064, 0.068], [1, 0.056, 0.06]], DIM.muslo, 8), C.pan, 'muslo_' + s, {p:['pelvis', 0.14], c:['pierna_' + s, 0.86]});
    pz(fB(0.03, 0.12, 0.1, sx*0.082, 0.24, 0.005), C.pan, 'muslo_' + s); pz(fB(0.032, 0.025, 0.1, sx*0.084, 0.18, 0.005), C.ex, 'muslo_' + s);
    if(!ct && v % 3 === 0) pz(tuboP([[0, 0.093, 0.097], [1, 0.093, 0.097]], 0.03).translate(0, 0.1, 0), '#1a1a1a', 'muslo_' + s);
    pz(tuboP([[0, 0.056, 0.06], [0.14, 0.058, 0.064, 0, -0.004], [0.32, 0.061, 0.068, 0, -0.012], [0.6, 0.05, 0.054, 0, -0.006], [0.85, 0.043, 0.046], [1, 0.04, 0.043]], DIM.pierna, 8), C.pan, 'pierna_' + s, {p:['muslo_' + s, 0.14]});
    if(ct || v % 3 !== 2){ pz(fE(0.06, 0, 0.03, 0.05, 0.95, 1.2, 0.55), C.pad, 'pierna_' + s); pz(fB(0.1, 0.018, 0.1, 0, 0.1, 0.0), C.pad, 'pierna_' + s); pz(fB(0.1, 0.018, 0.1, 0, -0.03, 0.0), C.pad, 'pierna_' + s); }
    pz(tuboP([[0, 0.05, 0.053], [0.5, 0.048, 0.051], [1, 0.053, 0.056]], 0.13).translate(0, DIM.pierna - 0.13, 0), C.bota, 'pierna_' + s);
    if(ct || v % 3 === 0) for(let k=0;k<3;k++) pz(fB(0.03, 0.006, 0.02, 0, DIM.pierna - 0.1 + k*0.035, 0.052), '#2b2b2e', 'pierna_' + s);
    /* pie (x izquierda, y adelante, z abajo): capellada, puntera, taco y suela */
    pz(fB(0.1, 0.2, 0.075, 0, 0.05, 0.035), C.bota, 'pie_' + s); pz(fE(0.052, 0, 0.15, 0.045, 0.95, 1.1, 0.65), C.bota, 'pie_' + s);
    pz(fB(0.108, 0.29, 0.022, 0, 0.055, 0.082), C.suela, 'pie_' + s); pz(fB(0.1, 0.07, 0.02, 0, -0.065, 0.094), C.suela, 'pie_' + s);
  }
  return L;
}
/* material: estándar con color por vértice, facetado y con piel; la luz del lugar entra por dos uniformes (ambiente y cuánto sol) */
function matPersonaje(){ const u = {amb:{value:new THREE.Color(0.4, 0.4, 0.42)}, solK:{value:1}};
  const m = new THREE.MeshStandardMaterial({vertexColors:true, flatShading:true, roughness:0.8, metalness:0, skinning:true});
  m.onBeforeCompile = sh=>{ sh.uniforms.ambPers = u.amb; sh.uniforms.solPers = u.solK;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 ambPers; uniform float solPers;').replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      reflectedLight.directDiffuse *= solPers; reflectedLight.directSpecular *= solPers; reflectedLight.indirectDiffuse += ambPers*diffuseColor.rgb;`); };
  m.customProgramCacheKey = ()=> 'persPiel'; m.userData.u = u; return m; }
const _pj = {}, _pv = V3(), _pw = V3();
function ponerHueso(me, a, b, ref){ me.position.copy(a); me.quaternion.copy(baseHueso(a, b, ref || V3(0, 0, -1), me.quaternion)); }
/* la pose de enlace: parado derecho, brazos colgando un poco adelante */
function juntasReposo(){ const J = {}, cad = V3(0, DIM.cadera, 0), cue = V3(0, DIM.cadera + DIM.torso, 0);
  J.pelvis = [cad, V3(0, DIM.cadera + 0.1, 0)]; J.torso = [cad, cue]; J.cabeza = [cue, cue.clone().add(V3(0, 0.25, 0))];
  for(const [s, sx] of [['i', -1], ['d', 1]]){ const hom = cue.clone().add(V3(sx*DIM.hombroX, -0.05, 0)), codo = hom.clone().add(V3(sx*0.05, -DIM.brazo*0.99, 0.03)), mano = codo.clone().add(V3(sx*0.02, -DIM.ante*0.97, -0.06));
    J['brazo_' + s] = [hom, codo]; J['ante_' + s] = [codo, mano];
    const cadL = cad.clone().add(V3(sx*DIM.caderaX, -0.05, 0)), rod = cadL.clone().add(V3(0, -DIM.muslo, -0.01)), tob = rod.clone().add(V3(0, -DIM.pierna, 0.0));
    J['muslo_' + s] = [cadL, rod]; J['pierna_' + s] = [rod, tob]; J['pie_' + s] = [tob, tob.clone().add(V3(0, -0.07, -DIM.pie*0.95))]; }
  return J; }
function personajeNuevo(bando, variante){
  const g = new THREE.Group(), mat = matPersonaje(), H = {}, lista = [];
  for(const n of HUESOS_P){ const b = new THREE.Bone(); b.name = n; g.add(b); H[n] = b; lista.push(b); }
  const J0 = juntasReposo(); for(const n of HUESOS_P) ponerHueso(H[n], J0[n][0], J0[n][1], REF_P[n]); g.updateMatrixWorld(true);
  /* las piezas, del marco de su hueso a la pose de enlace, con los pesos de la piel */
  const P_ = [], C_ = [], SI = [], SW = [], iH = {}; HUESOS_P.forEach((n, i)=> iH[n] = i);
  const largo = n=> J0[n][0].distanceTo(J0[n][1]), _v = V3();
  for(const pz of piezasPersonaje(bando, variante || 0)){ const gg = pz.g.index ? pz.g.toNonIndexed() : pz.g, p = gg.attributes.position, col = lin(pz.col), M = H[pz.h].matrix, Lh = largo(pz.h);
    for(let i=0;i<p.count;i++){ const y = p.getY(i); _v.set(p.getX(i), y, p.getZ(i)).applyMatrix4(M); P_.push(_v.x, _v.y, _v.z); C_.push(col.r, col.g, col.b);
      let wp = 0, wc = 0; if(pz.mz && pz.mz.p){ const h0 = pz.mz.p[1]*Lh; if(y < h0) wp = 0.5*lim(1 - y/h0, 0, 1); }
      if(pz.mz && pz.mz.c){ const h1 = pz.mz.c[1]*Lh; if(y > h1) wc = 0.5*lim((y - h1)/Math.max(1e-3, Lh - h1), 0, 1); }
      SI.push(iH[pz.h], pz.mz && pz.mz.p ? iH[pz.mz.p[0]] : 0, pz.mz && pz.mz.c ? iH[pz.mz.c[0]] : 0, 0); SW.push(1 - wp - wc, wp, wc, 0); } }
  /* los vértices compartidos: el facetado sale de las derivadas del sombreador (la normal de cada vértice no se usa), así que las
     esquinas en el mismo lugar, del mismo color y con los mismos huesos son un solo vértice. Sin índice eran tres por triángulo
     (8.766 por muñeco), y cada uno se pasa por la piel dos veces por cuadro: la escena y la sombra */
  const ix = new Map(), P2 = [], C2 = [], SI2 = [], SW2 = [], IX = [];
  for(let i=0, n=P_.length/3;i<n;i++){
    const k = Math.round(P_[i*3]*1e5) + ',' + Math.round(P_[i*3+1]*1e5) + ',' + Math.round(P_[i*3+2]*1e5) + '|' + C_[i*3] + ',' + C_[i*3+1] + ',' + C_[i*3+2] + '|' + SI.slice(i*4, i*4 + 4) + '|' + SW.slice(i*4, i*4 + 4).map(w=> w.toFixed(4));
    let j = ix.get(k); if(j === undefined){ j = P2.length/3; ix.set(k, j); P2.push(P_[i*3], P_[i*3+1], P_[i*3+2]); C2.push(C_[i*3], C_[i*3+1], C_[i*3+2]); SI2.push(SI[i*4], SI[i*4+1], SI[i*4+2], SI[i*4+3]); SW2.push(SW[i*4], SW[i*4+1], SW[i*4+2], SW[i*4+3]); }
    IX.push(j); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C2, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI2, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW2, 4)); geo.setIndex(IX); geo.computeVertexNormals(); geo.computeBoundingSphere();
  const malla = new THREE.SkinnedMesh(geo, mat); malla.castShadow = true; g.add(malla);
  /* recortado por la vista con una esfera que tiene al cuerpo en cualquier pose (agachado, con los brazos arriba, caído: la esfera gira con
     el grupo); sin recorte se dibujaban los diez, también los que quedan atrás de la cámara */
  geo.boundingSphere = new THREE.Sphere(V3(0, 0.95, 0), 1.35); malla.bind(new THREE.Skeleton(lista));
  const P = {g, mat, H, malla, bando, fase:0, u:0, arma:null, armaId:null, muerte:null, luz:{r:0.5, g:0.5, b:0.5, sol:1}, luzT:0, amb:new THREE.Color(0.4, 0.4, 0.42), sol:1, agach:0, pitch:0, retro:0, t:0,
    pesos:{quieto:1}, aire:0, tris:P_.length/9};
  return P;
}
function personajeRevivir(P){ P.muerte = null; P.g.rotation.set(0, 0, 0); P.g.quaternion.identity(); if(P.arma && !P.arma.g.parent) P.g.add(P.arma.g); }
/* ---------- mocap: muestreo de un clip y reubicación al cuerpo del personaje ---------- */
/* al cargar: MediaPipe a veces cambia izquierda y derecha (en agachado la cadera izquierda quedó del lado derecho) y la carrera tiene
   las piernas corridas 21 cm de costado; se cambian los nombres y se centran rodillas y tobillos respecto de la pelvis */
const MOCAP = {}; for(const c of (MAN.mocap || [])){ c.T = c.cuadros.length; c.dur = c.T/(c.fps || 30); c.ix = {}; c.juntas.forEach((n, i)=> c.ix[n] = i); c.V = +c.velocidad_mps || 0; c.zancada = c.V*c.dur;
  const media = n=>{ let s = 0; for(const q of c.cuadros) s += q[c.ix[n]][0] - q[c.ix.pelvis][0]; return s/c.T; };
  c.cambia = media('cadera_i') > 0; if(c.cambia){ for(const n of ['cadera', 'rodilla', 'tobillo']){ const a = c.ix[n + '_i']; c.ix[n + '_i'] = c.ix[n + '_d']; c.ix[n + '_d'] = a; } }
  c.offR = (media('rodilla_i') + media('rodilla_d'))/2; c.offT = (media('tobillo_i') + media('tobillo_d'))/2; MOCAP[c.id] = c; }
const PIERNA_MOCAP = 0.86, ESC_MOCAP = (DIM.muslo + DIM.pierna)/PIERNA_MOCAP;
/* la pose de un clip en u (vueltas): posiciones relativas a la pelvis (escaladas) y la altura de la pelvis */
function muestraClip(c, u, out){ const f = c.bucle ? ((u % 1) + 1) % 1*c.T : lim(u, 0, 0.999)*(c.T - 1), i0 = Math.floor(f), i1 = c.bucle ? (i0 + 1) % c.T : Math.min(c.T - 1, i0 + 1), k = f - i0;
  const A = c.cuadros[i0], B = c.cuadros[i1], pv = c.ix.pelvis, px = lerp(A[pv][0], B[pv][0], k), py = lerp(A[pv][1], B[pv][1], k), pzz = lerp(A[pv][2], B[pv][2], k);
  const rel = (a, b)=> [(lerp(a[0], b[0], k) - px)*ESC_MOCAP, (lerp(a[1], b[1], k) - py)*ESC_MOCAP, (lerp(a[2], b[2], k) - pzz)*ESC_MOCAP];
  for(const n of ['cadera_i', 'rodilla_i', 'tobillo_i', 'cadera_d', 'rodilla_d', 'tobillo_d', 'pecho', 'cabeza']){ const j = c.ix[n]; out[n] = rel(A[j], B[j]); }
  const TA = c.puntas_pie[i0], TB = c.puntas_pie[i1], pi = c.cambia ? 1 : 0; out.punta_i = rel(TA[pi], TB[pi]); out.punta_d = rel(TA[1 - pi], TB[1 - pi]);
  for(const n of ['rodilla_i', 'rodilla_d']) out[n][0] -= c.offR*ESC_MOCAP; for(const n of ['tobillo_i', 'tobillo_d', 'punta_i', 'punta_d']) out[n][0] -= c.offT*ESC_MOCAP;
  out.alto = py*ESC_MOCAP; return out; }
/* mezcla ponderada de varios clips (cada uno con su u), girada ang alrededor de y, con la zancada estirada kz adelante/atrás */
const _mcZ = {}, _mcA = {};
function poseMocap(P, pesos, ang, kz, out){
  const nombres = ['cadera_i', 'rodilla_i', 'tobillo_i', 'cadera_d', 'rodilla_d', 'tobillo_d', 'pecho', 'cabeza', 'punta_i', 'punta_d']; for(const n of nombres) out[n] = [0, 0, 0]; out.alto = 0;
  let W = 0; for(const id in pesos){ const w = pesos[id], c = MOCAP[id]; if(!c || w < 1e-3) continue; W += w; muestraClip(c, P.uClip[id] || 0, _mcA);
    for(const n of nombres){ const q = _mcA[n], z = n === 'pecho' || n === 'cabeza' ? q[2] : q[2]*(c.V > 0.3 ? kz : 1); out[n][0] += q[0]*w; out[n][1] += q[1]*w; out[n][2] += z*w; } out.alto += _mcA.alto*w; }
  if(W > 0) for(const n of nombres){ out[n][0] /= W; out[n][1] /= W; out[n][2] /= W; } out.alto = W > 0 ? out.alto/W : DIM.cadera;
  const ca = Math.cos(ang), sa = Math.sin(ang); for(const n of nombres){ if(n === 'pecho' || n === 'cabeza') continue; const [x, y, z] = out[n]; out[n] = [x*ca + z*sa, y, -x*sa + z*ca]; }
  return W > 0; }
/* ---------- la pose de cada cuadro ---------- */
function personajePose(P, est, dt){
  if(!P.g.parent) return; P.t += dt;
  if((P.luzT -= dt) <= 0){ P.luzT = 0.2; luzEn(est.pos.x, est.pos.y + 1, est.pos.z, P.luz); }
  const k = 1 - Math.exp(-dt*5); P.amb.r = lerp(P.amb.r, 0.35 + P.luz.r*1.4, k); P.amb.g = lerp(P.amb.g, 0.35 + P.luz.g*1.4, k); P.amb.b = lerp(P.amb.b, 0.37 + P.luz.b*1.4, k); P.sol = lerp(P.sol, P.luz.sol, k);
  P.mat.userData.u.amb.value.copy(P.amb); P.mat.userData.u.solK.value = P.sol;
  if(est.arma !== P.armaId){ if(P.arma && P.arma.g.parent) P.g.remove(P.arma.g); P.armaId = est.arma; const f = FABRICA3[est.arma === 'cuchillo' ? (P.bando === 't' ? 'cuchillo_t' : 'cuchillo') : est.arma]; P.arma = f ? f() : null;
    if(P.arma){ P.arma.g.traverse(o=>{ if(o.isMesh){ o.castShadow = true; } }); P.g.add(P.arma.g); } }
  P.g.position.copy(est.pos);
  if(P.muerte){ caerMuerto(P, dt); return; }
  P.g.rotation.set(0, est.yaw, 0);
  /* marco local: +x derecha, +y arriba, −z adelante */
  const vl = V3(est.vel.x, 0, est.vel.z).applyAxisAngle(V3(0, 1, 0), -est.yaw), vel = vl.length(), ag = est.agachado || 0;
  P.agach = lerp(P.agach, ag, 1 - Math.exp(-dt*10)); P.pitch = lerp(P.pitch, est.apuntePitch || 0, 1 - Math.exp(-dt*12)); P.retro = Math.max(0, P.retro - dt*6); if(est.disparo) P.retro = 1;
  P.aire = lerp(P.aire, est.suelo ? 0 : 1, 1 - Math.exp(-dt*(est.suelo ? 14 : 8)));
  /* qué clips y con cuánto peso: quieto, caminar/correr (adelante o de costado), atrás, agachado; en el aire, el salto */
  const angMov = vel > 0.25 ? Math.atan2(-vl.x, -vl.z) : (P.angMov || 0); P.angMov = angMov;
  const atras = Math.abs(angMov) > 1.95, mueve = lim((vel - 0.15)/0.6, 0, 1), corre = lim((vel - 2.7)/1.6, 0, 1), agach = P.agach;
  const obj = {}; obj.quieto = (1 - mueve)*(1 - agach); obj.agachado = agach;
  if(atras) obj.atras = mueve*(1 - agach); else { obj.caminar = mueve*(1 - corre)*(1 - agach); obj.correr = mueve*corre*(1 - agach); }
  if(!P.pesos) P.pesos = {}; const kp = 1 - Math.exp(-dt*9); for(const id of ['quieto', 'caminar', 'correr', 'atras', 'agachado']) P.pesos[id] = lerp(P.pesos[id] || 0, obj[id] || 0, kp);
  /* avance de cada clip: la cadencia sube con la raíz de la velocidad y la zancada se estira lo que falte */
  if(!P.uClip) P.uClip = {}; let kz = 1;
  for(const id of ['quieto', 'caminar', 'correr', 'atras', 'agachado']){ const c = MOCAP[id]; if(!c) continue; let r = 1/c.dur;
    if(c.V > 0.3){ const v = Math.max(vel, 0.3); r *= lim(Math.sqrt(v/c.V), 0.7, id === 'correr' ? 2.3 : 1.8); if(P.pesos[id] > 0.3) kz = lim(v/(r*c.zancada), 0.7, id === 'correr' ? 1.55 : 1.7); if(agach > 0.5 && vel < 0.25 && id === 'agachado') r = 0; }
    P.uClip[id] = ((P.uClip[id] || 0) + r*dt) % 1; }
  const M = _mcZ, hayMocap = poseMocap(P, P.pesos, atras ? angMov - Math.sign(angMov)*Math.PI : angMov, kz, M);
  /* en el aire: el cuadro de vuelo del salto (piernas recogidas) */
  if(P.aire > 0.02 && MOCAP.salto){ muestraClip(MOCAP.salto, 0.52, _mcA); for(const n in M){ if(n === 'alto'){ M.alto = lerp(M.alto, DIM.cadera, P.aire); continue; } M[n] = [lerp(M[n][0], _mcA[n][0], P.aire), lerp(M[n][1], _mcA[n][1], P.aire), lerp(M[n][2], _mcA[n][2], P.aire)]; } }
  /* columna: la del clip (pelvis → pecho) mezclada con la inclinación del apunte */
  const yC = hayMocap ? M.alto : DIM.cadera - agach*0.36, cad = V3(0, yC, 0);
  const dClip = hayMocap ? V3(M.pecho[0], M.pecho[1], M.pecho[2]).normalize() : V3(0, 1, 0), incl = agach*0.2;
  const dT = dClip.lerp(V3(0, Math.cos(incl), -Math.sin(incl)), 0.45).normalize(), cue = cad.clone().addScaledVector(dT, DIM.torso);
  ponerHueso(P.H.pelvis, cad, cad.clone().add(V3(0, 0.1, 0)), REF_P.pelvis); ponerHueso(P.H.torso, cad, cue, REF_P.torso);
  const dirCab = V3(0, Math.cos(P.pitch*0.6), -Math.sin(P.pitch*0.6)); ponerHueso(P.H.cabeza, cue, cue.clone().add(dirCab), REF_P.cabeza);
  /* arma delante del pecho, girada con el apunte; retroceso hacia atrás */
  const pecho = cad.clone().addScaledVector(dT, DIM.torso*0.82), p = P.pitch, apunta = V3(0, Math.sin(p), -Math.cos(p));
  const esPist = P.arma && P.arma.d.clase === 'pistola';
  const agarre = pecho.clone().add(V3(0.1, -0.08, 0)).addScaledVector(apunta, esPist ? 0.4 : 0.2 - P.retro*0.03);
  if(P.arma){ const A = P.arma; A.g.position.copy(agarre); A.g.quaternion.setFromEuler(new THREE.Euler(p, 0, 0)); A.g.updateMatrixWorld(true);
    const ea = A.e.agarre ? A.e.agarre.position.clone().applyQuaternion(A.g.quaternion) : V3(); A.g.position.copy(agarre).sub(ea); A.g.updateMatrix(); }
  const manoD = agarre.clone(), manoI = P.arma && A_apoyo(P) ? A_apoyo(P) : agarre.clone().add(V3(-0.05, 0.01, -0.05));
  for(const [s, mano, sx] of [['d', manoD, 1], ['i', manoI, -1]]){ const hom = cue.clone().add(V3(sx*DIM.hombroX, -0.05, 0)), polo = hom.clone().add(V3(sx*0.6, -0.6, 0.3));
    const codo = ik2(hom, mano, DIM.brazo, DIM.ante, polo); ponerHueso(P.H['brazo_' + s], hom, codo, REF_P['brazo_' + s]); ponerHueso(P.H['ante_' + s], codo, mano, REF_P['ante_' + s]); }
  /* piernas: cadera, tobillo y punta del clip; la rodilla por IK con el largo del personaje y el polo que marca el clip */
  for(const [s, sx] of [['i', -1], ['d', 1]]){
    const cadL = cad.clone().add(V3(sx*DIM.caderaX, -0.05, 0)); let tob, punta, polo;
    if(hayMocap){ const t = M['tobillo_' + s], r = M['rodilla_' + s], pt = M['punta_' + s];
      /* los pies no se cruzan (con la zancada girada de costado, el que va hacia el otro lado se frena en el medio) */
      tob = V3(sx*Math.max(sx*t[0], 0.035), yC + t[1], t[2]); punta = V3(sx*Math.max(sx*pt[0], 0.035), yC + pt[1], pt[2]); polo = V3(r[0], yC + r[1], r[2]).addScaledVector(V3(0, 0, -1), 0.3);
      if(punta.distanceTo(tob) < 0.08) punta.copy(tob).add(V3(0, -0.07, -0.17)); }
    else { tob = V3(sx*(DIM.caderaX + 0.02), 0.09, 0); punta = tob.clone().add(V3(0, -0.07, -0.18)); polo = cadL.clone().add(V3(0, -0.3, -0.8)); }
    if(tob.y < 0.08) tob.y = 0.08; if(punta.y < 0.015) punta.y = 0.015;
    const rod = ik2(cadL, tob, DIM.muslo, DIM.pierna, polo); const d = tob.clone().sub(rod); if(d.length() > DIM.pierna) tob.copy(rod).addScaledVector(d.normalize(), DIM.pierna);
    ponerHueso(P.H['muslo_' + s], cadL, rod, REF_P['muslo_' + s]); ponerHueso(P.H['pierna_' + s], rod, tob, REF_P['pierna_' + s]);
    const dp = punta.clone().sub(tob).normalize(); ponerHueso(P.H['pie_' + s], tob, tob.clone().addScaledVector(dp, DIM.pie), REF_P['pie_' + s]); }
}
function A_apoyo(P){ const A = P.arma; if(!A || !A.e.apoyo) return null; A.g.updateMatrix(); return A.e.apoyo.position.clone().applyMatrix4(A.g.matrix); }
/* ---------- morir: cae hacia el empuje; si hay pared, para el otro lado; los brazos se sueltan ---------- */
function personajeMorir(P, imp, pto){
  const dir = V3(imp ? imp.x : 0, 0, imp ? imp.z : 0); if(dir.lengthSq() < 1e-4) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5); dir.normalize();
  const o = P.g.position; if(rayo(o.x, o.y + 1, o.z, dir.x, 0, dir.z, 1.7, F_SOLIDA, true, -1) >= 0) dir.negate();
  if(rayo(o.x, o.y + 1, o.z, dir.x, 0, dir.z, 1.7, F_SOLIDA, true, -1) >= 0) P.muerte = {dir, t:0, ang:0, vel:0, sentado:true};
  else P.muerte = {dir, t:0, ang:0, vel:1.2 + (imp ? Math.min(3, imp.length()*0.3) : 0), sentado:false};
  P.muerte.yaw0 = P.g.rotation.y; P.muerte.eje = V3(dir.z, 0, -dir.x);
}
function caerMuerto(P, dt){ const m = P.muerte; m.t += dt; const top = m.sentado ? 0.5 : Math.PI/2*0.98;
  if(m.ang < top){ m.vel += 9*Math.sin(Math.max(0.15, m.ang))*dt*1.6; m.ang = Math.min(top, m.ang + m.vel*dt); if(m.ang >= top && m.vel > 1.5){ m.vel *= -0.25; m.ang = top - 0.02; } }
  const q = new THREE.Quaternion().setFromAxisAngle(m.eje, m.ang)   /* +ang: la cabeza va hacia donde empujó el tiro (con −ang caía hacia el que disparaba) */, q0 = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), m.yaw0); P.g.quaternion.copy(q).multiply(q0);
  if(m.sentado){ P.g.position.y -= Math.min(0.4, m.t*0.8)*0.02; } else P.g.position.y += 0.13*Math.sin(m.ang);   /* acostado: el grosor de la espalda, que no se hunda */
  /* brazos sueltos y piernas un poco dobladas */
  const k = Math.min(1, m.t*2); for(const s of ['i', 'd']){ const b = P.H['brazo_' + s], a = P.H['ante_' + s]; b.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.4, 0, s === 'd' ? 2.6 : -2.6)), k*0.08); a.quaternion.slerp(b.quaternion, k*0.1); }
  if(P.arma && !m.soltada){ m.soltada = true; P.g.remove(P.arma.g); }
}
window.vitrina_personajes = async function(){
  const L = []; let i = 0; for(const b of ['ct', 't']) for(let v=0;v<3;v++){ const P = personajeNuevo(b, v); escena.add(P.g); const x = -5 + i*2; i++; L.push({P, est:{pos:V3(x, 0, -8), yaw:0, vel:V3(0, 0, i % 2 ? -2.5 : 0), suelo:true, agachado:v === 2 ? 1 : 0, apuntePitch:0, arma:i % 3 ? 'ak47' : 'glock'}}); }
  window.__P = {L, pose(t){ for(const x of L){ for(let k=0;k<Math.round(t*60);k++) personajePose(x.P, x.est, DT); } } };
  for(const x of L) personajePose(x.P, x.est, DT);
};
