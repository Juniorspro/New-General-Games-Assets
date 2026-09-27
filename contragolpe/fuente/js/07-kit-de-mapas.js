
/* ====================== kit de mapas ======================
   Un mapa es una lista de cajas (bloques, muros con huecos, escalones, clips) + rampas + utilería + calcomanías + lámparas.
   Las caras visibles de las cajas se funden por material; cada cara tiene su rectángulo en el atlas de luz.
   La luz se hornea (sol con penumbra, cielo, rebote de un salto y lámparas) y queda en una textura RGBA:
   RGB = luz indirecta, A = cuánto sol le llega. El sol en vivo pinta lo directo (con mapas de normales) y la sombra de los personajes. */
const F_NOLUZ = 8;          /* no tapa rayos del horneado (los escalones invisibles de las rampas) */
const ESCALA_LM = 4;        /* el mapa de luz guarda E/4 en sRGB */
const TEXEL = 0.25;
const MATS = {
  /* planta nuclear */
  piso_ext:{tex:'hormigon_piso', gen:'hormigon', tono:0.86, color:'#96928a', metros:4, juntas:1, paso:'hormigon', spec:0.05, brillo:10, albedo:0.42},
  asfalto:{tex:'asfalto', gen:'asfalto', color:'#5a5a5e', metros:6, paso:'hormigon', albedo:0.16},
  chapa_blanca:{tex:'chapa_blanca', gen:'chapa', tono:0.78, color:'#e6e4dc', metros:3, ondas:14, bala:'chapa', paso:'metal', spec:0.15, brillo:20, albedo:0.62},
  chapa_azul:{tex:'chapa_azul', tono:0.78, gen:'chapa', color:'#5d93cc', metros:3, ondas:14, bala:'chapa', paso:'metal', spec:0.15, brillo:20, albedo:0.32},
  pared_verde:{tex:'pared_verde', gen:'pintado', color:'#4e8a57', metros:3, paneles:3, spec:0.1, brillo:18, albedo:0.26},
  piso_int:{tex:'piso_interior', gen:'hormigon', tono:0.84, color:'#a2a7aa', metros:4, juntas:2, spec:0.35, brillo:60, albedo:0.45},
  acero_naranja:{tex:'acero_naranja', gen:'pintado', color:'#e48b1d', metros:1.5, paneles:1, bala:'metal', paso:'metal', spec:0.2, brillo:25, albedo:0.4},
  semilla:{tex:'chapa_semilla', gen:'semilla', color:'#8f9398', metros:1.5, bala:'metal', paso:'metal', spec:0.35, brillo:40, albedo:0.3},
  hormigon_pared:{tex:'hormigon_pared', gen:'hormigon', color:'#b6b3ab', metros:3, albedo:0.45},
  grava:{tex:'grava', gen:'grava', color:'#8d887e', metros:3, paso:'tierra', albedo:0.3},
  pasto:{tex:'pasto', gen:'pasto', color:'#62823b', metros:4, paso:'tierra', albedo:0.2},
  caja_roja:{tex:'caja_roja_cara', gen:'caja_roja', color:'#cc281d', cara:true, bala:'metal', paso:'metal', spec:0.2, brillo:25, albedo:0.3},
  techo:{gen:'chapa', color:'#70747a', metros:3, ondas:10, bala:'chapa', paso:'metal', albedo:0.3},
  metal_gris:{gen:'pintado', color:'#7d8187', metros:2, paneles:2, bala:'metal', paso:'metal', spec:0.25, brillo:30, albedo:0.3},
  amarillo:{gen:'pintado', color:'#e7ba2b', metros:2, paneles:1, bala:'metal', paso:'metal', albedo:0.5},
  rojo:{gen:'pintado', color:'#c2261d', metros:2, paneles:1, bala:'metal', paso:'metal', albedo:0.25},
  /* pueblo del desierto */
  arenisca:{tex:'arenisca', gen:'bloques', color:'#caa97a', mortero:'#b39a75', metros:3, filas:6, cols:3, paso:'hormigon', albedo:0.5},
  revoque:{tex:'revoque', gen:'revoque', color:'#d8c39c', metros:3, albedo:0.55},
  tierra:{tex:'tierra_arena', gen:'tierra', color:'#c7aa7e', metros:4, paso:'tierra', albedo:0.45},
  adoquin:{tex:'adoquin', gen:'adoquin', color:'#aa997e', metros:3, paso:'hormigon', albedo:0.4},
  madera:{tex:'madera_tablas', gen:'tablas', color:'#8d6c46', metros:2, bala:'madera', paso:'madera', albedo:0.3},
  teja:{tex:'teja', gen:'teja', color:'#a55b39', metros:3, albedo:0.3},
  oxido:{tex:'metal_oxidado', gen:'oxido', color:'#5c6c74', metros:2, bala:'metal', paso:'metal', albedo:0.22},
  caja_madera:{tex:'caja_madera_cara', gen:'caja_madera', color:'#a6824f', cara:true, bala:'madera', paso:'madera', albedo:0.35},
  /* genéricos */
  negro:{gen:'liso', color:'#26272a', metros:2, albedo:0.05},
  blanco:{gen:'liso', color:'#e9e7e0', metros:2, albedo:0.7},
  gris:{gen:'liso', color:'#8e9196', metros:2, albedo:0.3},
  vidrio:{gen:'liso', color:'#8fb6c9', metros:2, bala:'vidrio', albedo:0.1},
};
/* ---------- obra: lo que se va declarando al construir un mapa ---------- */
let OBRA = null;
function nuevaObra(id){ OBRA = {id, cajas:[], rampas:[], props:[], decals:[], luces:[], zonas:[], spawns:{t:[], ct:[], dm:[]}, sitios:{}, guardias:[], tpuntos:[], bomba:{}, limites:null, rnd:mulberry(semilla32(id))}; return OBRA; }
function orden(a, b){ return a < b ? [a, b] : [b, a]; }
/* bloque sólido: caja de [x0,x1]×[y0,y1]×[z0,z1]. o: {flags, caras:{py:'mat',...}, sin:['ny',...], tinte, texel, invisible, pen} */
function bloque(x0, y0, z0, x1, y1, z1, mat, o){
  o = o || {}; [x0, x1] = orden(x0, x1); [y0, y1] = orden(y0, y1); [z0, z1] = orden(z0, z1);
  if(x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return null;
  const M = MATS[mat] || MATS.gris;
  const c = {mn:[x0, y0, z0], mx:[x1, y1, z1], mat, flags:o.flags === undefined ? F_TODO : o.flags, bala:M.bala || 'hormigon', pen:o.pen, caras:o.caras || null, sin:o.sin || null,
    tinte:o.tinte || null, texel:o.texel || 0, invisible:!!o.invisible, uvOff:o.uvOff || null, paso:M.paso || 'hormigon'};
  OBRA.cajas.push(c); return c;
}
function clip(x0, y0, z0, x1, y1, z1){ return bloque(x0, y0, z0, x1, y1, z1, 'gris', {flags:F_SOLIDA, invisible:true}); }
/* muro recto a lo largo de x (eje 'x', en z = p) o de z (eje 'z', en x = p), de a0 a a1, con huecos [{d0, d1, y0, y1}] */
function muro(eje, p, a0, a1, y0, y1, grosor, mat, huecos, o){
  [a0, a1] = orden(a0, a1); const g = grosor/2, cortes = (huecos||[]).map(h=> ({d0:Math.max(a0, h.d0), d1:Math.min(a1, h.d1), y0:h.y0 === undefined ? y0 : h.y0, y1:h.y1 === undefined ? y1 : h.y1})).sort((a, b)=> a.d0 - b.d0);
  const caja = (b0, b1, c0, c1)=> eje === 'x' ? bloque(b0, c0, p - g, b1, c1, p + g, mat, o) : bloque(p - g, c0, b0, p + g, c1, b1, mat, o);
  let x = a0;
  for(const h of cortes){ if(h.d0 > x) caja(x, h.d0, y0, y1); if(h.y0 > y0) caja(h.d0, h.d1, y0, h.y0); if(h.y1 < y1) caja(h.d0, h.d1, h.y1, y1); x = Math.max(x, h.d1); }
  if(x < a1) caja(x, a1, y0, y1);
}
/* piso (losa) y techo */
function piso(x0, z0, x1, z1, y, mat, o){ o = o || {}; return bloque(x0, y - (o.grosor || 0.3), z0, x1, y, z1, mat, Object.assign({sin:['ny']}, o)); }
function techo(x0, z0, x1, z1, y, mat, o){ o = o || {}; return bloque(x0, y, z0, x1, y + (o.grosor || 0.3), z1, mat, o); }
/* rampa: sube de y0 a y1 hacia 'dir' ('x+','x-','z+','z-'). La vista es una superficie inclinada; el choque, escalones finos invisibles */
function rampa(x0, z0, x1, z1, y0, y1, dir, mat, o){
  o = o || {}; [x0, x1] = orden(x0, x1); [z0, z1] = orden(z0, z1);
  const largo = dir[0] === 'x' ? x1 - x0 : z1 - z0, n = Math.max(2, Math.ceil(largo/0.2)), dy = y1 - y0;
  for(let k=0;k<n;k++){ const a = k/n, b = (k + 1)/n, yT = y0 + dy*b;   /* cada escalón con la altura del borde alto de su tramo */
    const s0 = dir[1] === '+' ? a : 1 - b, s1 = dir[1] === '+' ? b : 1 - a;
    if(dir[0] === 'x') bloque(x0 + (x1 - x0)*s0, y0 - 0.3, z0, x0 + (x1 - x0)*s1, yT, z1, mat, {flags:F_TODO | F_NOLUZ, invisible:true});
    else bloque(x0, y0 - 0.3, z0 + (z1 - z0)*s0, x1, yT, z0 + (z1 - z0)*s1, mat, {flags:F_TODO | F_NOLUZ, invisible:true}); }
  const r = {x0, z0, x1, z1, y0, y1, dir, mat, tinte:o.tinte || null, texel:o.texel || 0, lados:o.lados !== false, subeDy:dy/n}; OBRA.rampas.push(r); return r;
}
function escalera(x0, z0, x1, z1, y0, y1, dir, mat, o){
  o = o || {}; [x0, x1] = orden(x0, x1); [z0, z1] = orden(z0, z1);
  const n = Math.max(1, Math.round((y1 - y0)/0.19)), largo = dir[0] === 'x' ? x1 - x0 : z1 - z0;
  for(let k=0;k<n;k++){ const yT = y0 + (y1 - y0)*(k + 1)/n, a = k/n, b = 1;
    const s0 = dir[1] === '+' ? a : 0, s1 = dir[1] === '+' ? b : 1 - a;
    if(dir[0] === 'x') bloque(x0 + largo*s0, yT - (y1 - y0)/n - (k === 0 ? 0 : 0), z0, x0 + largo*s1, yT, z1, mat, {sin:['ny'], texel:o.texel || 0.2});
    else bloque(x0, yT - (y1 - y0)/n, z0 + largo*s0, x1, yT, z0 + largo*s1, mat, {sin:['ny'], texel:o.texel || 0.2}); }
}
function lampara(x, y, z, color, fuerza, radio, o){ o = o || {}; const l = {x, y, z, color:color || '#fff3e0', fuerza:fuerza || 12, radio:radio || 12, tubo:o.tubo !== false, largo:o.largo || 1.2, eje:o.eje || 'x', malla:o.malla !== false}; OBRA.luces.push(l); return l; }
function zona(nombre, x0, z0, x1, z1, y0, y1){ [x0, x1] = orden(x0, x1); [z0, z1] = orden(z0, z1); OBRA.zonas.push({nombre, x0, z0, x1, z1, y0:y0 === undefined ? -50 : y0, y1:y1 === undefined ? 50 : y1}); }
function sitio(letra, x0, z0, x1, z1, y){ [x0, x1] = orden(x0, x1); [z0, z1] = orden(z0, z1); OBRA.sitios[letra] = {letra, x0, z0, x1, z1, y:y || 0, cx:(x0 + x1)/2, cz:(z0 + z1)/2}; }
function spawn(bando, x, y, z, yaw){ OBRA.spawns[bando].push({x, y, z, yaw:yaw || 0}); }
/* lugares para sostener un ángulo: bando, sitio o zona que cubre, posición y adónde mira */
function guardia(bando, sitioL, x, y, z, mx, my, mz, o){ OBRA.guardias.push(Object.assign({bando, sitio:sitioL, x, y, z, mx, my, mz}, o || {})); }
/* utilería: geometría ya en coordenadas del mundo + cajas de choque aproximadas */
function prop(geo, mat, o){ o = o || {}; const p = {geo, mat, color:o.color || null, emisivo:o.emisivo || null, sombra:o.sombra !== false, luzPropia:o.luzPropia || 0, doble:!!o.doble, alfa:o.alfa || null};
  OBRA.props.push(p); for(const c of (o.choque||[])) bloque(c[0], c[1], c[2], c[3], c[4], c[5], mat in MATS ? mat : 'gris', {invisible:true, flags:c[6] === undefined ? F_TODO : c[6], pen:c[7]}); return p; }
function calco(x, y, z, nx, ny, nz, w, h, tex, o){ o = o || {}; OBRA.decals.push({p:V3(x, y, z), n:V3(nx, ny, nz).normalize(), w, h, tex, rot:o.rot || 0, color:o.color || null, alfa:o.alfa === undefined ? 1 : o.alfa}); }

/* ====================== caras, mallas y atlas de luz ====================== */
const CARAS = {lista:[], deCaja:null, atlasW:0, atlasH:0};
const CARA_EJES = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];   /* px nx py ny pz nz */
const NOMBRE_CARA = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
function dentroDeOtra(x, y, z, yo){
  const n = solapadas(x - 1e-3, y - 1e-3, z - 1e-3, x + 1e-3, y + 1e-3, z + 1e-3, F_TODO);
  for(let k=0;k<n;k++){ const i = SOLAP[k]; if(i === yo) continue; const c = OBRA.cajas[i]; if(!c || c.invisible) continue; return true; } return false;
}
function armarCaras(){
  const L = [], deCaja = new Int32Array(OBRA.cajas.length*6).fill(-1);
  OBRA.cajas.forEach((c, i)=>{
    if(c.invisible) return;
    for(let f=0;f<6;f++){ const nom = NOMBRE_CARA[f]; if(c.sin && c.sin.includes(nom)) continue;
      const [eje, s] = CARA_EJES[f], mn = c.mn, mx = c.mx;
      /* ejes de la cara: normal, u (a la derecha mirándola) y v (arriba) */
      const n = [0, 0, 0]; n[eje] = s; let u, v;
      if(eje === 1){ u = [1, 0, 0]; v = [0, 0, -s]; } else { v = [0, 1, 0]; u = eje === 0 ? [0, 0, -s] : [s, 0, 0]; }
      const plano = s > 0 ? mx[eje] : mn[eje];
      /* origen = la esquina con u y v mínimos */
      const o = [0, 0, 0]; for(let k=0;k<3;k++){ if(k === eje){ o[k] = plano; continue; } const du = u[k], dv = v[k]; const neg = (du < 0 || dv < 0); o[k] = neg ? mx[k] : mn[k]; }
      const su = Math.abs(u[0])*(mx[0] - mn[0]) + Math.abs(u[1])*(mx[1] - mn[1]) + Math.abs(u[2])*(mx[2] - mn[2]);
      const sv = Math.abs(v[0])*(mx[0] - mn[0]) + Math.abs(v[1])*(mx[1] - mn[1]) + Math.abs(v[2])*(mx[2] - mn[2]);
      /* ¿tapada? (cinco puntos de la cara, apenas afuera, adentro de otras cajas visibles) */
      let tapada = true; for(const [a, b] of [[0.5, 0.5], [0.04, 0.04], [0.96, 0.04], [0.04, 0.96], [0.96, 0.96]]){
        const px = o[0] + u[0]*su*a + v[0]*sv*b + n[0]*0.01, py = o[1] + u[1]*su*a + v[1]*sv*b + n[1]*0.01, pz = o[2] + u[2]*su*a + v[2]*sv*b + n[2]*0.01;
        if(!dentroDeOtra(px, py, pz, i)){ tapada = false; break; } }
      if(tapada) continue;
      const mat = (c.caras && c.caras[nom]) || c.mat;
      deCaja[i*6 + f] = L.length;
      L.push({caja:i, f, eje, s, o, u, v, n, su, sv, mat, tinte:c.tinte, texel:c.texel, uvOff:c.uvOff});
    }
  });
  /* rampas: la superficie inclinada y sus dos costados (triángulos, dentro de una cara rectangular: lo de afuera no se usa) */
  for(const r of OBRA.rampas){ const dy = r.y1 - r.y0;
    let o, u, v, su, sv, n;
    if(r.dir[0] === 'x'){ const L2 = r.x1 - r.x0, h = Math.hypot(L2, dy), sg = r.dir[1] === '+' ? 1 : -1;
      const dirU = [sg*L2/h, dy/h, 0]; n = [-sg*dy/h, L2/h, 0];
      o = sg > 0 ? [r.x0, r.y0, r.z1] : [r.x1, r.y0, r.z0]; u = dirU; v = [0, 0, -sg]; su = h; sv = r.z1 - r.z0;
      /* u a lo largo de la subida, v a lo ancho: se ordena para que u×v = n */
      const cr = [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]]; if(cr[1] < 0){ v = [0, 0, sg]; o = sg > 0 ? [r.x0, r.y0, r.z0] : [r.x1, r.y0, r.z1]; }
    } else { const L2 = r.z1 - r.z0, h = Math.hypot(L2, dy), sg = r.dir[1] === '+' ? 1 : -1;
      u = [0, dy/h, sg*L2/h]; n = [0, L2/h, -sg*dy/h]; v = [sg, 0, 0]; o = sg > 0 ? [r.x0, r.y0, r.z0] : [r.x1, r.y0, r.z1]; su = h; sv = r.x1 - r.x0;
      const cr = [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]]; if(cr[1] < 0){ v = [-sg, 0, 0]; o = sg > 0 ? [r.x1, r.y0, r.z0] : [r.x0, r.y0, r.z1]; } }
    L.push({caja:-1, rampa:r, eje:-1, s:0, o, u, v, n, su, sv, mat:r.mat, tinte:r.tinte, texel:r.texel, levantar:r.subeDy + 0.03}); }
  CARAS.lista = L; CARAS.deCaja = deCaja;
}
/* estantes: cada cara con su rectángulo de texeles y un borde de uno */
function empaquetarAtlas(){
  const L = CARAS.lista; let tex = TEXEL;
  for(let intento=0;intento<5;intento++){
    for(const c of L){ const t = c.texel || (c.su*c.sv > 900 ? tex*2 : tex); c.tw = Math.max(1, Math.min(480, Math.ceil(c.su/t))); c.th = Math.max(1, Math.min(480, Math.ceil(c.sv/t))); }
    const orden_ = L.map((c, i)=> i).sort((a, b)=> L[b].th - L[a].th || L[b].tw - L[a].tw);
    const W = 2048; let x = 0, y = 0, altoFila = 0;
    for(const i of orden_){ const c = L[i], w = c.tw + 2, h = c.th + 2; if(x + w > W){ x = 0; y += altoFila; altoFila = 0; } c.ax = x + 1; c.ay = y + 1; x += w; altoFila = Math.max(altoFila, h); }
    const H = y + altoFila; if(H <= 2048){ CARAS.atlasW = W; CARAS.atlasH = Math.pow(2, Math.ceil(Math.log2(Math.max(64, H)))); CARAS.texel = tex; return; }
    tex *= 1.3;
  }
  CARAS.atlasW = 2048; CARAS.atlasH = 2048;
}
/* el atlas va con la fila 0 abajo (texturas de datos, sin voltear): v = fila/alto */
function uvLuz(c, a, b){ return [(c.ax + a*c.tw)/CARAS.atlasW, (c.ay + b*c.th)/CARAS.atlasH]; }
/* punto del mundo → coordenadas de la cara (a, b en 0..1) */
function enCara(c, x, y, z){ const dx = x - c.o[0], dy = y - c.o[1], dz = z - c.o[2]; return [(dx*c.u[0] + dy*c.u[1] + dz*c.u[2])/c.su, (dx*c.v[0] + dy*c.v[1] + dz*c.v[2])/c.sv]; }
function metrosDe(mat){ const M = MATS[mat] || MATS.gris, m = M.tex && manDe('tex', M.tex); return (m && m.metros) || M.metros || 2; }
function mallasDeCaras(){
  const porMat = {};
  for(const c of CARAS.lista){ (porMat[c.mat] = porMat[c.mat] || []).push(c); }
  const mallas = [];
  for(const mat in porMat){ const lista = porMat[mat], M = MATS[mat] || MATS.gris, esCara = !!M.cara, met = metrosDe(mat);
    const n = lista.length, pos = new Float32Array(n*12), nor = new Float32Array(n*12), uv = new Float32Array(n*8), uv2 = new Float32Array(n*8), col = new Float32Array(n*12), idx = new Uint32Array(n*6);
    lista.forEach((c, k)=>{ const tn = c.tinte ? new THREE.Color(c.tinte) : null;
      const esq = [[0, 0], [1, 0], [1, 1], [0, 1]];
      esq.forEach(([a, b], j)=>{ const x = c.o[0] + c.u[0]*c.su*a + c.v[0]*c.sv*b, y = c.o[1] + c.u[1]*c.su*a + c.v[1]*c.sv*b, z = c.o[2] + c.u[2]*c.su*a + c.v[2]*c.sv*b, o = k*12 + j*3;
        pos[o] = x; pos[o+1] = y; pos[o+2] = z; nor[o] = c.n[0]; nor[o+1] = c.n[1]; nor[o+2] = c.n[2];
        let tu, tv; if(esCara){ tu = a; tv = b; } else { const wx = x*c.u[0] + y*c.u[1] + z*c.u[2], wy = x*c.v[0] + y*c.v[1] + z*c.v[2]; tu = wx/met + (c.uvOff ? c.uvOff[0] : 0); tv = wy/met + (c.uvOff ? c.uvOff[1] : 0); }
        uv[k*8 + j*2] = tu; uv[k*8 + j*2 + 1] = tv;
        const [lu, lv] = uvLuz(c, a, b); uv2[k*8 + j*2] = lu; uv2[k*8 + j*2 + 1] = lv;
        col[o] = tn ? tn.r : 1; col[o+1] = tn ? tn.g : 1; col[o+2] = tn ? tn.b : 1; });
      if(c.rampa){ /* la rampa: sólo el triángulo o el plano, como corresponde; acá es el plano entero */ }
      idx.set([k*4, k*4 + 1, k*4 + 2, k*4, k*4 + 2, k*4 + 3], k*6); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('uv2', new THREE.BufferAttribute(uv2, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere(); mallas.push({mat, geo:g}); }
  /* costados de las rampas: triángulos con la luz del piso (sin atlas propio: toman la esquina baja de la rampa) */
  return mallas;
}

/* ---------- materiales del mundo: Phong con mapa de luz; el alfa del mapa de luz apaga el sol donde hay sombra horneada ---------- */
const MAT_MUNDO = {};
const LUZ = {tex:null, texSol:null, datos:null, sol:null, w:0, h:0, lista:false};
const U_SOLMAP = {value:null}, U_AMB = {value:0.02};   /* piso de luz: ningún rincón queda negro del todo */
function parcheLuz(m){
  m.onBeforeCompile = sh=>{
    sh.uniforms.solMap = U_SOLMAP; sh.uniforms.ambMin = U_AMB;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D solMap; uniform float ambMin;').replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      #ifdef USE_LIGHTMAP
        float solLM = texture2D(solMap, vUv2).r;
        reflectedLight.directDiffuse *= solLM; reflectedLight.directSpecular *= solLM;
        reflectedLight.indirectDiffuse += diffuseColor.rgb*ambMin;
      #endif`);
  };
  m.customProgramCacheKey = ()=> 'mundoLM';
  return m;
}
function texMaterial(mat){
  const M = MATS[mat] || MATS.gris, man = M.tex && manDe('tex', M.tex);
  if(man && ARCH['tex/' + M.tex + '/albedo']){
    return {map:texAsset('tex/' + M.tex + '/albedo', {srgb:true, color:man.color_medio || M.color}), normal:ARCH['tex/' + M.tex + '/normal'] ? texAsset('tex/' + M.tex + '/normal', {normal:true}) : null, ns:man.normalScale || 1, generada:true};
  }
  const r = texRespaldo(mat, M); return {map:r.map, normal:r.normal, ns:1, generada:false};
}
function matMundo(mat){
  if(MAT_MUNDO[mat]) return MAT_MUNDO[mat];
  if(!MUNDO_PHONG) return MAT_MUNDO[mat] = matMundoLigero(mat);
  const M = MATS[mat] || MATS.gris, t = texMaterial(mat);
  /* tono: las fotos más claras que lo que se horneó (paredes blancas al sol) se bajan para que no se quemen */
  const m = new THREE.MeshPhongMaterial({map:t.map, color:new THREE.Color().setScalar(M.tono || 1), normalMap:t.normal, normalScale:new THREE.Vector2(t.ns*0.8, t.ns*0.8), vertexColors:true,
    specular:new THREE.Color(M.spec || 0.04, M.spec || 0.04, M.spec || 0.04), shininess:M.brillo || 12, lightMap:LUZ.tex, lightMapIntensity:ESCALA_LM});
  if(M.cara && t.map){ t.map.wrapS = t.map.wrapT = THREE.ClampToEdgeWrapping; }
  parcheLuz(m); return MAT_MUNDO[mat] = m;
}
/* el mismo mundo con un sombreador propio: la cuenta del Phong con la luz horneada, sin lo que no se usa. La sombra en vivo (sólo la de
   los personajes) va con 4 muestras y únicamente donde el mapa de sol dice que da el sol; el relieve se apaga en calidad baja. En un
   teléfono el mundo es casi todo lo que se pinta: el Phong con la sombra de 17 muestras costaba cuatro veces un material plano. */
const MUNDO_PHONG = /[?&]phong\b/.test(location.search);
const VERT_MUNDO = `attribute vec2 uv2; varying vec2 vUv, vUv2; varying vec3 vNormal, vViewPosition;
  #include <common>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <shadowmap_pars_vertex>
  void main(){ vUv = uv; vUv2 = uv2;
    #include <color_vertex>
    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    vNormal = normalize(transformedNormal);
    #include <begin_vertex>
    #include <project_vertex>
    vViewPosition = -mvPosition.xyz;
    #include <worldpos_vertex>
    #include <shadowmap_vertex>
    #include <fog_vertex>
  }`;
const FRAG_MUNDO = `uniform sampler2D map, lightMap, solMap, nMap; uniform float tono, lmK, ambMin, ns, spec, brillo; varying vec2 vUv, vUv2; varying vec3 vNormal, vViewPosition;
  #include <common>
  #include <color_pars_fragment>
  #include <packing>
  #include <fog_pars_fragment>
  #include <bsdfs>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  float sombraSol(){
  #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    vec4 sc = vDirectionalShadowCoord[0]; sc.xyz /= sc.w; sc.z += directionalLightShadows[0].shadowBias;
    if(sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
    vec2 t = 0.75/directionalLightShadows[0].shadowMapSize;
    return 0.25*(texture2DCompare(directionalShadowMap[0], sc.xy + vec2(-t.x, -t.y), sc.z) + texture2DCompare(directionalShadowMap[0], sc.xy + vec2(t.x, -t.y), sc.z)
      + texture2DCompare(directionalShadowMap[0], sc.xy + vec2(-t.x, t.y), sc.z) + texture2DCompare(directionalShadowMap[0], sc.xy + vec2(t.x, t.y), sc.z));
  #else
    return 1.0;
  #endif
  }
  void main(){
    vec3 alb = sRGBToLinear(texture2D(map, vUv)).rgb*tono;
    #ifdef USE_COLOR
      alb *= vColor;
    #endif
    vec3 n = normalize(vNormal); if(!gl_FrontFacing) n = -n;
    vec3 v = normalize(vViewPosition);
    #ifdef RELIEVE
      vec3 q0 = -vViewPosition, dx = dFdx(q0), dy = dFdy(q0); vec2 s0 = dFdx(vUv), s1 = dFdy(vUv);
      vec3 S = normalize(dx*s1.t - dy*s0.t), T = normalize(-dx*s1.s + dy*s0.s);
      vec3 mt = texture2D(nMap, vUv).xyz*2.0 - 1.0; mt.xy *= ns; n = normalize(mat3(S, T, n)*mt);
    #endif
    vec3 luz = sRGBToLinear(texture2D(lightMap, vUv2)).rgb*lmK + ambMin;
    vec3 col = alb*luz;
    #if NUM_DIR_LIGHTS > 0
      float solLM = texture2D(solMap, vUv2).r; vec3 L = directionalLights[0].direction; float nl = saturate(dot(n, L));
      if(solLM*nl > 0.002){
        float k = solLM*nl*sombraSol(); vec3 irr = directionalLights[0].color*k;
        vec3 h = normalize(L + v); float nh = saturate(dot(n, h)), lh = saturate(dot(L, h));
        float fr = exp2((-5.55473*lh - 6.98316)*lh), F = (1.0 - spec)*fr + spec;
        col += irr*(alb + F*0.25*(brillo*0.5 + 1.0)*pow(nh, brillo));
      }
    #endif
    #if NUM_POINT_LIGHTS > 0
      if(pointLights[0].color.r + pointLights[0].color.g > 0.0){ vec3 dl = pointLights[0].position + vViewPosition; float d = length(dl);
        col += alb*pointLights[0].color*saturate(dot(n, dl/d))*punctualLightIntensityToIrradianceFactor(d, pointLights[0].distance, pointLights[0].decay); }
    #endif
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
  }`;
function matMundoLigero(mat){
  const M = MATS[mat] || MATS.gris, t = texMaterial(mat);
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, {tono:{value:M.tono || 1}, lmK:{value:ESCALA_LM}, ns:{value:t.ns*0.8}, spec:{value:M.spec || 0.04}, brillo:{value:M.brillo || 12}}]);
  u.map = {value:t.map}; u.nMap = {value:t.normal}; u.lightMap = {value:LUZ.tex}; u.solMap = U_SOLMAP; u.ambMin = U_AMB;
  const m = new THREE.ShaderMaterial({uniforms:u, vertexShader:VERT_MUNDO, fragmentShader:FRAG_MUNDO, lights:true, fog:true, vertexColors:true, extensions:{derivatives:true}});
  m.defines = t.normal ? {RELIEVE:''} : {}; m.userData.nMap = t.normal;
  if(M.cara && t.map){ t.map.wrapS = t.map.wrapT = THREE.ClampToEdgeWrapping; }
  return m;
}
/* el relieve del mundo según la calidad: con poca, sin mapa de normales (una lectura y las derivadas menos por píxel) */
function relieveMundo(si){ for(const k in MAT_MUNDO){ const m = MAT_MUNDO[k]; if(!m.isShaderMaterial || !m.userData.nMap) continue; const tiene = 'RELIEVE' in m.defines;
  if(tiene === si) continue; m.defines = si ? {RELIEVE:''} : {}; m.needsUpdate = true; } }

/* ====================== horneado de luz ======================
   Por cada texel: sol (varios rayos dentro del disco solar: penumbra), cielo (rayos con peso coseno), lámparas con visibilidad
   y, en la segunda pasada, rebote: lo que ven esos rayos del cielo al pegar en otra cara, con su color medio. */
function colorMedioLineal(mat){ const M = MATS[mat] || MATS.gris, man = M.tex && manDe('tex', M.tex); const c = man && man.color_medio ? lin(man.color_medio) : lin(M.color); return [c.r, c.g, c.b]; }
function cieloRad(dx, dy, dz, out){
  const up = Math.max(0, dy), k = Math.pow(up, 0.5), h = CIELO.horiz, z = CIELO.cenit;
  let r = h.r + (z.r - h.r)*k, g = h.g + (z.g - h.g)*k, b = h.b + (z.b - h.b)*k;
  if(dy < 0){ const s = CIELO.suelo; const t = Math.min(1, -dy*6); r = r + (s.r*0.5 - r)*t; g = g + (s.g*0.5 - g)*t; b = b + (s.b*0.5 - b)*t; }
  const cs = Math.max(0, dx*SOLDIR.x + dy*SOLDIR.y + dz*SOLDIR.z), a = Math.pow(cs, 6)*0.35;
  out[0] = (r + CIELO.solCol.r*a)*CIELO_K; out[1] = (g + CIELO.solCol.g*a)*CIELO_K; out[2] = (b + CIELO.solCol.b*a)*CIELO_K;
}
let CIELO_K = 0.55, SOL_K = 2.2;
/* direcciones con peso coseno, estratificadas (fijas para que el horneado sea el mismo cada vez) */
function hemisferio(n, sem){ const r = mulberry(sem), out = []; const lado = Math.ceil(Math.sqrt(n));
  for(let i=0;i<n;i++){ const a = ((i % lado) + r())/lado, b = (Math.floor(i/lado) + r())/Math.ceil(n/lado); const phi = TAU*a, rr = Math.sqrt(b); out.push([rr*Math.cos(phi), rr*Math.sin(phi), Math.sqrt(Math.max(0, 1 - b))]); }
  return out; }
function baseDe(n){ const [nx, ny, nz] = n; let t = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = [ny*t[2] - nz*t[1], nz*t[0] - nx*t[2], nx*t[1] - ny*t[0]]; const lu = Math.hypot(u[0], u[1], u[2]); u = u.map(x=> x/lu);
  const v = [ny*u[2] - nz*u[1], nz*u[0] - nx*u[2], nx*u[1] - ny*u[0]]; return [u, v]; }
function hashTexel(k){ let h = (k*2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0)/4294967296; }
async function hornearLuz(op, avance){
  op = Object.assign({cielo:16, sol:3, rebote:true, reboteRayos:12, lamparas:true}, op || {});
  const L = CARAS.lista, W = CARAS.atlasW, H = CARAS.atlasH, N = W*H;
  const E = new Float32Array(N*3), S = new Float32Array(N), E1 = new Float32Array(N*3);
  const hemi = hemisferio(op.cielo, 77), hemiR = hemisferio(op.reboteRayos, 91), lamps = op.lamparas ? OBRA.luces.map(l=> ({...l, c:lin(l.color)})) : [];
  const solR = []; { const r = mulberry(5), ang = 0.5*GRAD; const [bu, bv] = baseDe([SOLDIR.x, SOLDIR.y, SOLDIR.z]);
    for(let i=0;i<op.sol;i++){ const a = r()*TAU, rr = Math.sqrt(r())*ang; const x = SOLDIR.x + (bu[0]*Math.cos(a) + bv[0]*Math.sin(a))*rr, y = SOLDIR.y + (bu[1]*Math.cos(a) + bv[1]*Math.sin(a))*rr, z = SOLDIR.z + (bu[2]*Math.cos(a) + bv[2]*Math.sin(a))*rr; const l = Math.hypot(x, y, z); solR.push([x/l, y/l, z/l]); } }
  const ALB = {}; const alb = mat=> ALB[mat] || (ALB[mat] = colorMedioLineal(mat).map(v=> v*((MATS[mat] && MATS[mat].albedo !== undefined) ? MATS[mat].albedo/Math.max(0.05, (colorMedioLineal(mat)[0]*0.3 + colorMedioLineal(mat)[1]*0.59 + colorMedioLineal(mat)[2]*0.11)) : 1)));
  const mascara = F_BALA | F_SOLIDA, cr = [0, 0, 0];
  const texelPos = (c, i, j, out)=>{ const a = (i + 0.5)/c.tw, b = (j + 0.5)/c.th; const lev = c.levantar || 0;
    out[0] = c.o[0] + c.u[0]*c.su*a + c.v[0]*c.sv*b + c.n[0]*0.03; out[1] = c.o[1] + c.u[1]*c.su*a + c.v[1]*c.sv*b + c.n[1]*0.03 + lev; out[2] = c.o[2] + c.u[2]*c.su*a + c.v[2]*c.sv*b + c.n[2]*0.03; };
  const P = [0, 0, 0];
  /* pasada 1: sol, cielo y lámparas */
  let hecho = 0, total = 0; for(const c of L) total += c.tw*c.th; total *= op.rebote ? 2 : 1;
  let tMarca = performance.now();
  const pausa = async ()=>{ if(performance.now() - tMarca > 40){ tMarca = performance.now(); if(avance) avance(hecho/total); await new Promise(r=> setTimeout(r, 0)); } };
  for(const c of L){ const [bu, bv] = baseDe(c.n), nx = c.n[0], ny = c.n[1], nz = c.n[2];
    for(let j=0;j<c.th;j++){ for(let i=0;i<c.tw;i++){ texelPos(c, i, j, P); const k = (c.ay + j)*W + (c.ax + i);
      let s = 0; for(const d of solR){ if(d[0]*nx + d[1]*ny + d[2]*nz <= 0) continue; if(rayo(P[0], P[1], P[2], d[0], d[1], d[2], 220, mascara, true, -1) < 0) s++; } s /= solR.length;
      let r = 0, g = 0, b = 0; const fi0 = hashTexel(k)*TAU, cg0 = Math.cos(fi0), sg0 = Math.sin(fi0);
      for(const h0 of hemi){ const h = [h0[0]*cg0 - h0[1]*sg0, h0[0]*sg0 + h0[1]*cg0, h0[2]]; const dx = bu[0]*h[0] + bv[0]*h[1] + nx*h[2], dy = bu[1]*h[0] + bv[1]*h[1] + ny*h[2], dz = bu[2]*h[0] + bv[2]*h[1] + nz*h[2];
        if(rayo(P[0], P[1], P[2], dx, dy, dz, 160, mascara, true, -1) < 0){ cieloRad(dx, dy, dz, cr); r += cr[0]; g += cr[1]; b += cr[2]; } }
      const kk = Math.PI/hemi.length; r *= kk; g *= kk; b *= kk;
      for(const l of lamps){ const lx = l.x - P[0], ly = l.y - P[1], lz = l.z - P[2], d2 = lx*lx + ly*ly + lz*lz; if(d2 > l.radio*l.radio) continue; const d = Math.sqrt(d2), cosn = (lx*nx + ly*ny + lz*nz)/d; if(cosn <= 0) continue;
        if(rayo(P[0], P[1], P[2], lx/d, ly/d, lz/d, d - 0.15, mascara, true, -1) >= 0) continue; const caida = Math.pow(Math.max(0, 1 - Math.pow(d/l.radio, 4)), 2)/(d2 + 1)*l.fuerza*cosn;
        r += l.c.r*caida; g += l.c.g*caida; b += l.c.b*caida; }
      S[k] = s; E[k*3] = r; E[k*3+1] = g; E[k*3+2] = b;
      const ns = Math.max(0, SOLDIR.x*nx + SOLDIR.y*ny + SOLDIR.z*nz)*SOL_K*s; E1[k*3] = r + CIELO.solCol.r*ns; E1[k*3+1] = g + CIELO.solCol.g*ns; E1[k*3+2] = b + CIELO.solCol.b*ns;
      hecho++; } await pausa(); } }
  /* pasada 2: un rebote */
  if(op.rebote){ const Q = [0, 0, 0];
    for(const c of L){ const [bu, bv] = baseDe(c.n), nx = c.n[0], ny = c.n[1], nz = c.n[2];
      for(let j=0;j<c.th;j++){ for(let i=0;i<c.tw;i++){ texelPos(c, i, j, P); const k = (c.ay + j)*W + (c.ax + i); let r = 0, g = 0, b = 0; const fi1 = hashTexel(k*7 + 3)*TAU, cg1 = Math.cos(fi1), sg1 = Math.sin(fi1);
        for(const h0 of hemiR){ const h = [h0[0]*cg1 - h0[1]*sg1, h0[0]*sg1 + h0[1]*cg1, h0[2]]; const dx = bu[0]*h[0] + bv[0]*h[1] + nx*h[2], dy = bu[1]*h[0] + bv[1]*h[1] + ny*h[2], dz = bu[2]*h[0] + bv[2]*h[1] + nz*h[2];
          const t = rayo(P[0], P[1], P[2], dx, dy, dz, 60, mascara, false, -1); if(t < 0) continue;
          const ci = RAYO.caja, f = (RAYO.eje*2) + ((RAYO.eje === 0 ? RAYO.nx : RAYO.eje === 1 ? RAYO.ny : RAYO.nz) > 0 ? 0 : 1), fi = CARAS.deCaja[ci*6 + f];
          Q[0] = P[0] + dx*t; Q[1] = P[1] + dy*t; Q[2] = P[2] + dz*t; let er, eg, eb, al;
          if(fi >= 0){ const cc = L[fi]; const [a, bb] = enCara(cc, Q[0], Q[1], Q[2]); const ti = Math.min(cc.tw - 1, Math.max(0, Math.floor(a*cc.tw))), tj = Math.min(cc.th - 1, Math.max(0, Math.floor(bb*cc.th))), kq = (cc.ay + tj)*W + (cc.ax + ti);
            er = E1[kq*3]; eg = E1[kq*3+1]; eb = E1[kq*3+2]; al = alb(cc.mat); }
          else { const m = OBRA.cajas[ci] ? OBRA.cajas[ci].mat : 'gris'; al = alb(m); er = eg = eb = 0.25; }
          r += al[0]*er; g += al[1]*eg; b += al[2]*eb; }
        const kk = 1/hemiR.length; E[k*3] += r*kk; E[k*3+1] += g*kk; E[k*3+2] += b*kk; hecho++; } await pausa(); } } }
  /* el ruido del giro al azar se limpia con un desenfoque de 3×3 dentro de cada cara (sin mezclar caras vecinas del atlas); el sol queda nítido */
  { const T = new Float32Array(E.length);
    for(const c of L){ for(let j=0;j<c.th;j++) for(let i=0;i<c.tw;i++){ let r = 0, g = 0, b = 0, w = 0;
        for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){ const ii = i + di, jj = j + dj; if(ii < 0 || jj < 0 || ii >= c.tw || jj >= c.th) continue; const q = ((c.ay + jj)*W + (c.ax + ii))*3, ww = (di || dj) ? (di && dj ? 0.5 : 0.75) : 1; r += E[q]*ww; g += E[q+1]*ww; b += E[q+2]*ww; w += ww; }
        const k = ((c.ay + j)*W + (c.ax + i))*3; T[k] = r/w; T[k+1] = g/w; T[k+2] = b/w; } }
    E.set(T); }
  /* a bytes: RGB = E/ESCALA en sRGB (sin alfa: el lienzo premultiplica y se perdía todo lo que no ve el sol) y el sol aparte */
  const px = new Uint8Array(N*4), ps = new Uint8Array(N*4); const aS = v=> { v = Math.max(0, v/ESCALA_LM); return Math.min(255, Math.round((v <= 0.0031308 ? v*12.92 : 1.055*Math.pow(v, 1/2.4) - 0.055)*255)); };
  for(let k=0;k<N;k++){ px[k*4] = aS(E[k*3]); px[k*4+1] = aS(E[k*3+1]); px[k*4+2] = aS(E[k*3+2]); px[k*4+3] = 255; const sv = Math.round(S[k]*255); ps[k*4] = ps[k*4+1] = ps[k*4+2] = sv; ps[k*4+3] = 255; }
  for(const arr of [px, ps]) for(const c of L){ const cp = (dx, dy, sx, sy)=>{ const d = (dy*W + dx)*4, s2 = (sy*W + sx)*4; arr[d] = arr[s2]; arr[d+1] = arr[s2+1]; arr[d+2] = arr[s2+2]; arr[d+3] = arr[s2+3]; };
    for(let i=-1;i<=c.tw;i++){ const sx = c.ax + Math.min(c.tw - 1, Math.max(0, i)); cp(c.ax + i, c.ay - 1, sx, c.ay); cp(c.ax + i, c.ay + c.th, sx, c.ay + c.th - 1); }
    for(let j=0;j<c.th;j++){ cp(c.ax - 1, c.ay + j, c.ax, c.ay + j); cp(c.ax + c.tw, c.ay + j, c.ax + c.tw - 1, c.ay + j); } }
  if(avance) avance(1);
  return {w:W, h:H, px, ps};
}
function huellaMapa(){ /* cambia si cambia la geometría o el atlas: para saber si el mapa de luz horneado sirve */
  let h = 2166136261 >>> 0; const mezcla = v=>{ h ^= Math.round(v*1000) & 0xffffffff; h = Math.imul(h, 16777619) >>> 0; };
  for(const c of CARAS.lista){ mezcla(c.o[0]); mezcla(c.o[1]); mezcla(c.o[2]); mezcla(c.su); mezcla(c.sv); mezcla(c.ax); mezcla(c.ay); mezcla(c.tw); mezcla(c.th); }
  for(const l of OBRA.luces){ mezcla(l.x); mezcla(l.y); mezcla(l.z); mezcla(l.fuerza); } mezcla(SOLDIR.x); mezcla(SOLDIR.y); mezcla(SOLDIR.z); mezcla(CARAS.atlasW); mezcla(CARAS.atlasH);
  return h.toString(36);
}
function texDatos(arr, w, h, srgb){ const t = new THREE.DataTexture(arr, w, h, THREE.RGBAFormat, THREE.UnsignedByteType); t.encoding = srgb ? THREE.sRGBEncoding : THREE.LinearEncoding;
  t.flipY = false; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t; }
function texDeLuz(res){ return ponerLuz(res.px, res.ps, res.w, res.h); }
function ponerLuz(px, ps, w, h){
  if(LUZ.tex) LUZ.tex.dispose(); if(LUZ.texSol) LUZ.texSol.dispose();
  LUZ.tex = texDatos(px, w, h, true); LUZ.texSol = texDatos(ps, w, h, false); LUZ.w = w; LUZ.h = h; LUZ.datos = px; LUZ.sol = ps; LUZ.lista = true; U_SOLMAP.value = LUZ.texSol;
  for(const k in MAT_MUNDO){ const m = MAT_MUNDO[k]; if(m.isShaderMaterial) m.uniforms.lightMap.value = LUZ.tex; else { m.lightMap = LUZ.tex; m.needsUpdate = true; } }
  return LUZ.tex;
}
/* los mapas de luz horneados vienen en dos PNG opacos (luz y sol): se leen con un lienzo, que con imágenes opacas no pierde nada */
async function luzDeImagenes(idLuz, idSol){
  const lee = async id=>{ const im = await decImagen(id, false); if(!im) return null; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return {w:c.width, h:c.height, d:new Uint8Array(g.getImageData(0, 0, c.width, c.height).data.buffer)}; };
  const a = await lee(idLuz), b = await lee(idSol); if(!a || !b) return false; ponerLuz(a.d, b.d, a.w, a.h); return true;
}
/* luz que llega a un punto del mundo (para personajes, armas y lo que cae): mira la cara del piso debajo */
/* ---------- utilería y calcomanías con la luz horneada ----------
   La utilería no tiene mapa de luz propio: cada vértice toma la luz indirecta del lugar (luzEn, cacheada cada 0,5 m) y un rayo
   al sol decide si le da; queda en el color del vértice y se dibuja sin luces dinámicas (MeshBasic: textura × vértice). Lo que no
   trae uv recibe uv por proyección de caja en metros según el material. Las calcomanías igual, con la luz de su punto. */
const MAT_PROP = {};
function matProp(mat, o){ const clave = mat + (o.doble ? '|d' : '') + (o.alfa ? '|a' + o.alfa : '') + (o.emisivo ? '|e' : '');
  if(MAT_PROP[clave]) return MAT_PROP[clave];
  const t = o.emisivo ? {map:null} : texMaterial(mat);
  const m = new THREE.MeshBasicMaterial({map:t.map || null, color:new THREE.Color().setScalar((MATS[mat] && MATS[mat].tono) || 1), vertexColors:true, side:o.doble ? THREE.DoubleSide : THREE.FrontSide, transparent:!!o.alfa, opacity:o.alfa || 1, depthWrite:!o.alfa});
  if(t.map && !(MATS[mat] && MATS[mat].cara)){ t.map.wrapS = t.map.wrapT = THREE.RepeatWrapping; }
  return MAT_PROP[clave] = m; }
function luzVertices(g, tinte, emisivo, fuerzaEm){
  const P = g.attributes.position, N = g.attributes.normal, n = P.count, col = new Float32Array(n*3), L = {r:0, g:0, b:0, sol:0}, cache = new Map();
  const sc = sol.color, si = sol.intensity, tr = tinte ? tinte.r : 1, tg = tinte ? tinte.g : 1, tb = tinte ? tinte.b : 1;
  for(let i=0;i<n;i++){ const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
    if(emisivo){ col[i*3] = emisivo.r*fuerzaEm; col[i*3+1] = emisivo.g*fuerzaEm; col[i*3+2] = emisivo.b*fuerzaEm; continue; }
    const k = Math.round(x*2) + ',' + Math.round(y*2) + ',' + Math.round(z*2); let ind = cache.get(k);
    if(!ind){ luzEn(x + nx*0.1, y + 0.25, z + nz*0.1, L); ind = [L.r, L.g, L.b]; cache.set(k, ind); }
    const nd = nx*SOLDIR.x + ny*SOLDIR.y + nz*SOLDIR.z; let s = 0;
    if(nd > 0 && rayo(x + nx*0.03, y + ny*0.03, z + nz*0.03, SOLDIR.x, SOLDIR.y, SOLDIR.z, 200, F_BALA, true, -1) < 0) s = nd*si;
    const cie = 0.62 + 0.38*ny;
    col[i*3] = (ind[0]*cie + s*sc.r)*tr; col[i*3+1] = (ind[1]*cie + s*sc.g)*tg; col[i*3+2] = (ind[2]*cie + s*sc.b)*tb; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
function mallasDeProps(){
  const grupos = {}, out = [];
  for(const p of OBRA.props){ let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); if(!g.attributes.normal) g.computeVertexNormals();
    if(!g.attributes.uv) uvCaja(g, metrosDe(p.mat));
    for(const k of Object.keys(g.attributes)) if(!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    luzVertices(g, p.color ? lin(p.color) : null, p.emisivo ? lin(p.emisivo) : null, p.luzPropia || 3);
    const o = {doble:p.doble, alfa:p.alfa, emisivo:!!p.emisivo}, clave = p.mat + JSON.stringify(o); (grupos[clave] = grupos[clave] || {mat:p.mat, o, geos:[]}).geos.push(g); }
  for(const k in grupos){ const G = grupos[k], geo = fundirConColor(G.geos), m = new THREE.Mesh(geo, matProp(G.mat, G.o)); m.matrixAutoUpdate = false; m.updateMatrix(); out.push(m); }
  return out; }
/* como fundir() pero conservando el color por vértice */
function fundirConColor(geos){ let n = 0; for(const g of geos) n += g.attributes.position.count;
  const P = new Float32Array(n*3), N = new Float32Array(n*3), UV = new Float32Array(n*2), C = new Float32Array(n*3); let o = 0;
  for(const g of geos){ const c = g.attributes.position.count; P.set(g.attributes.position.array.subarray(0, c*3), o*3); N.set(g.attributes.normal.array.subarray(0, c*3), o*3);
    if(g.attributes.uv) UV.set(g.attributes.uv.array.subarray(0, c*2), o*2); C.set(g.attributes.color.array.subarray(0, c*3), o*3); o += c; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.computeBoundingSphere(); return out; }
const MAT_CALCO = {};
function mallasDeCalcos(){
  const grupos = {}, out = [], L = {r:0, g:0, b:0, sol:0};
  for(const d of OBRA.decals){ if(!ARCH['decal/' + d.tex]) continue;
    const n = d.n, ref = Math.abs(n.y) > 0.9 ? V3(0, 0, 1) : V3(0, 1, 0), ex = ref.clone().cross(n).normalize(), ey = n.clone().cross(ex).normalize();
    if(d.rot){ const c = Math.cos(d.rot), s = Math.sin(d.rot), a = ex.clone(), b = ey.clone(); ex.copy(a).multiplyScalar(c).addScaledVector(b, s); ey.copy(b).multiplyScalar(c).addScaledVector(a, -s); }
    const p0 = d.p.clone().addScaledVector(n, 0.012);
    luzEn(p0.x + n.x*0.1, p0.y + 0.25, p0.z + n.z*0.1, L); const nd = n.dot(SOLDIR);
    const s = nd > 0 && rayo(p0.x + n.x*0.02, p0.y + n.y*0.02, p0.z + n.z*0.02, SOLDIR.x, SOLDIR.y, SOLDIR.z, 200, F_BALA, true, -1) < 0 ? nd*sol.intensity : 0;
    const tn = d.color ? lin(d.color) : new THREE.Color(1, 1, 1), cie = 0.62 + 0.38*n.y, cr = (L.r*cie + s*sol.color.r)*tn.r, cg = (L.g*cie + s*sol.color.g)*tn.g, cb = (L.b*cie + s*sol.color.b)*tn.b;
    const G = grupos[d.tex] = grupos[d.tex] || {P:[], UV:[], C:[], A:[]};
    const esq = [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]], b0 = G.P.length/3;
    for(const [u, v, tu, tv] of esq){ const q = p0.clone().addScaledVector(ex, u*d.w).addScaledVector(ey, v*d.h); G.P.push(q.x, q.y, q.z); G.UV.push(tu, tv); G.C.push(cr, cg, cb); G.A.push(d.alfa); }
    G.I = G.I || []; G.I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); }
  for(const tex in grupos){ const G = grupos[tex], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(G.P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.UV, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(G.C, 3)); g.setIndex(G.I);
    const m = MAT_CALCO[tex] || (MAT_CALCO[tex] = new THREE.MeshBasicMaterial({map:texAsset('decal/' + tex, {srgb:true, repetir:false}), vertexColors:true, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}));
    const me = new THREE.Mesh(g, m); me.renderOrder = 2; me.matrixAutoUpdate = false; out.push(me); }
  return out; }
function luzEn(x, y, z, out){
  out = out || {r:0.6, g:0.6, b:0.6, sol:1};
  const t = rayo(x, y + 0.05, z, 0, -1, 0, 6, F_SOLIDA | F_BALA, false, -1);
  if(t >= 0 && LUZ.datos && RAYO.eje === 1){ const f = 2 + (RAYO.ny > 0 ? 0 : 1), fi = CARAS.deCaja[RAYO.caja*6 + f];
    if(fi >= 0){ const c = CARAS.lista[fi], [a, b] = enCara(c, x, y - t + 0.05, z), i = Math.min(c.tw - 1, Math.max(0, Math.floor(a*c.tw))), j = Math.min(c.th - 1, Math.max(0, Math.floor(b*c.th))), k = ((c.ay + j)*LUZ.w + (c.ax + i))*4;
      const dS = v=>{ v /= 255; return (v <= 0.04045 ? v/12.92 : Math.pow((v + 0.055)/1.055, 2.4))*ESCALA_LM; };
      if(k >= 0 && k + 2 < LUZ.datos.length){ out.r = dS(LUZ.datos[k]); out.g = dS(LUZ.datos[k+1]); out.b = dS(LUZ.datos[k+2]); out.sol = LUZ.sol[k]/255; return out; } } }
  out.sol = rayo(x, y + 1.2, z, SOLDIR.x, SOLDIR.y, SOLDIR.z, 200, F_BALA, true, -1) < 0 ? 1 : 0; out.r = out.g = out.b = 0.45; return out;
}
