
/* ====================== utilería procedural ======================
   Lo que no es caja: barriles, pallets, caños, barandas, alambrados, puertas, equipos de aire, carteles, tanques y silos, cables,
   rejillas, escaleras marineras, montacargas, estanterías, luminarias, toldos, arcos, autos, bolsas de arena, barreras...
   Cada pieza se modela en su marco (pies en y = 0, frente hacia −z, +x a la derecha), se gira (un múltiplo de 90° si choca) y va a
   prop() fundida por material: todas las piezas de un mapa con el mismo material terminan en una sola malla.
   Lo que frena balas o cuerpos va además como caja invisible con el material que corresponde (bala y pasos); lo que de verdad
   es una caja (contenedores, cajones, tarimas) va como bloque, que tiene luz horneada propia.
   Rejas y barandas: su choque son las barras (cajas finas) y no el paño entero, así la sombra horneada es la de las barras y
   nadie pasa por los huecos: entre barra y barra nunca queda más de 1,1 m (agachado se miden 1,37 m).
   Los toldos y los rellenos de los arcos llevan cajas que sólo frenan balas (F_BALA): no traban el paso y dan sombra al hornear. */

Object.assign(MATS, {
  asfalto_b:{tex:'asfalto_b', gen:'asfalto', color:'#64645f', metros:6, paso:'hormigon', albedo:0.17},
  barril_azul:{gen:'oxido', color:'#2f5f9a', metros:1.1, bala:'metal', paso:'metal', albedo:0.2},
  barril_rojo:{gen:'oxido', color:'#a83a2c', metros:1.1, bala:'metal', paso:'metal', albedo:0.22},
  barril_amarillo:{gen:'oxido', color:'#d6a42a', metros:1.1, bala:'metal', paso:'metal', albedo:0.42},
  barril_verde:{gen:'oxido', color:'#4f6d3c', metros:1.1, bala:'metal', paso:'metal', albedo:0.18},
  barril_negro:{gen:'oxido', color:'#34373c', metros:1.1, bala:'metal', paso:'metal', albedo:0.08},
  pino:{gen:'tablas', color:'#c39a64', tablas:3, metros:1.2, bala:'madera', paso:'madera', albedo:0.42},
  madera_vieja:{gen:'tablas', color:'#6d4e32', tablas:5, metros:1.6, bala:'madera', paso:'madera', albedo:0.24},
  puerta_verde:{gen:'tablas', color:'#4a6a4c', tablas:6, metros:1.4, bala:'madera', paso:'madera', albedo:0.22},
  puerta_azul:{gen:'tablas', color:'#3a5d80', tablas:6, metros:1.4, bala:'madera', paso:'madera', albedo:0.22},
  carton:{gen:'liso', color:'#b48d5c', metros:1, bala:'tela', paso:'madera', albedo:0.4},
  goma:{gen:'liso', color:'#222325', metros:1, albedo:0.05},
  metal_azul:{gen:'pintado', color:'#3a67a3', metros:2, paneles:2, bala:'metal', paso:'metal', albedo:0.2},
  metal_blanco:{gen:'pintado', color:'#d6d6ce', metros:2, paneles:2, bala:'metal', paso:'metal', albedo:0.55},
  metal_verde:{gen:'pintado', color:'#56744c', metros:2, paneles:2, bala:'metal', paso:'metal', albedo:0.2},
  naranja:{gen:'liso', color:'#e2621f', metros:1, bala:'tela', albedo:0.4},
  reja:{gen:'liso', color:'#a3a8ac', metros:1, bala:'metal', paso:'metal', albedo:0.3},
  franjas:{gen:'franjas', color:'#e8b62a', color2:'#202022', franjas:4, metros:0.8, bala:'metal', paso:'metal', albedo:0.35},
  contenedor_rojo:{gen:'chapa', color:'#9c3a2a', metros:2.4, ondas:9, bala:'chapa', paso:'metal', spec:0.12, brillo:18, albedo:0.2},
  contenedor_azul:{gen:'chapa', color:'#30608f', metros:2.4, ondas:9, bala:'chapa', paso:'metal', spec:0.12, brillo:18, albedo:0.18},
  contenedor_verde:{gen:'chapa', color:'#3f6b4b', metros:2.4, ondas:9, bala:'chapa', paso:'metal', spec:0.12, brillo:18, albedo:0.18},
  contenedor_naranja:{gen:'chapa', color:'#c7682c', metros:2.4, ondas:9, bala:'chapa', paso:'metal', spec:0.12, brillo:18, albedo:0.3},
  contenedor_gris:{gen:'chapa', color:'#8d9296', metros:2.4, ondas:9, bala:'chapa', paso:'metal', spec:0.12, brillo:18, albedo:0.3},
  lona_roja:{gen:'rayas', color:'#b5402d', color2:'#e6dac0', rayas:6, metros:2.4, bala:'tela', albedo:0.35},
  lona_azul:{gen:'rayas', color:'#2e5f8e', color2:'#ded8c6', rayas:6, metros:2.4, bala:'tela', albedo:0.3},
  lona_verde:{gen:'rayas', color:'#4d7a45', color2:'#e0d8bf', rayas:6, metros:2.4, bala:'tela', albedo:0.3},
  lona_cruda:{gen:'revoque', color:'#c7b28a', metros:2, bala:'tela', albedo:0.45},
  sacos:{gen:'revoque', color:'#a99270', metros:0.8, bala:'tierra', paso:'tierra', albedo:0.35},
  piedra:{gen:'tierra', color:'#a3927a', metros:1.5, paso:'hormigon', albedo:0.35},
  hormigon_barrera:{tex:'hormigon_pared', gen:'hormigon', color:'#b3b0a8', metros:2, albedo:0.45},
  vidrio_osc:{gen:'liso', color:'#34454f', metros:1, bala:'vidrio', albedo:0.06},
  letreros:{gen:'letreros', color:'#f0ece0', cara:true, N:512, bala:'metal', albedo:0.5},
  cromado:{gen:'liso', color:'#c9ccd0', metros:1, bala:'metal', albedo:0.5},
});

Object.assign(PINTOR, {
  /* franjas de peligro a 45° que empalman en los cuatro bordes */
  franjas(N, o){ const a = hexRGB(o.color), b = hexRGB(o.color2 || '#202022'), f = fbmRep(N, o.sem, 4, 5), m = fbmRep(N, o.sem + 3, 8, 3), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), n = o.franjas || 4;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x, t = ((x + y)/N*n) % 1, en = t < 0.5, c = en ? a : b;
      let v = 0.9 + (f[i] - 0.5)*0.22; if(m[i] > 0.7){ v *= 0.72; }
      col[i*3] = lim(c[0]*v, 0, 255); col[i*3+1] = lim(c[1]*v, 0, 255); col[i*3+2] = lim(c[2]*v, 0, 255); alt[i] = (en ? 0.55 : 0.5) - (m[i] > 0.7 ? 0.08 : 0); }
    return [col, alt]; },
  /* lona a rayas (toldos): rayas verticales con pliegue en cada costura y mugre abajo */
  rayas(N, o){ const a = hexRGB(o.color), b = hexRGB(o.color2 || '#e6dac0'), f = fbmRep(N, o.sem, 4, 5), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), n = o.rayas || 6;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x, t = (x/N*n) % 1, c = t < 0.5 ? a : b, borde = Math.min(t % 0.5, 0.5 - t % 0.5);
      let v = (0.9 + (f[i] - 0.5)*0.2)*(borde < 0.02 ? 0.82 : 1); const tv = y/N; v *= 1 - Math.max(0, tv - 0.8)*0.6;
      col[i*3] = lim(c[0]*v, 0, 255); col[i*3+1] = lim(c[1]*v, 0, 255); col[i*3+2] = lim(c[2]*v, 0, 255); alt[i] = 0.5 + Math.sin(t*TAU*2)*0.08 + f[i]*0.1; }
    return [col, alt]; },
  /* carteles pintados: cuatro cuadros en una textura (A, B, A con flecha, B con flecha); la flecha al revés sale del uv espejado */
  letreros(N, o){ const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), h = N/2;
    const cuadro = (cx, cy, letra, flecha, fondo, tinta)=>{ g.save(); g.translate(cx*h, cy*h); g.fillStyle = fondo; g.fillRect(0, 0, h, h);
      g.fillStyle = tinta; g.fillRect(h*0.04, h*0.04, h*0.92, h*0.03); g.fillRect(h*0.04, h*0.93, h*0.92, h*0.03); g.fillRect(h*0.04, h*0.04, h*0.03, h*0.92); g.fillRect(h*0.93, h*0.04, h*0.03, h*0.92);
      g.font = 'bold ' + Math.round(h*(flecha ? 0.62 : 0.78)) + 'px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(letra, flecha ? h*0.33 : h*0.5, h*0.54);
      if(flecha){ g.beginPath(); g.moveTo(h*0.6, h*0.4); g.lineTo(h*0.74, h*0.4); g.lineTo(h*0.74, h*0.28); g.lineTo(h*0.92, h*0.5); g.lineTo(h*0.74, h*0.72); g.lineTo(h*0.74, h*0.6); g.lineTo(h*0.6, h*0.6); g.closePath(); g.fill(); }
      g.restore(); };
    cuadro(0, 0, 'A', false, '#f2eee2', '#1d1d20'); cuadro(1, 0, 'B', false, '#f2eee2', '#1d1d20');
    cuadro(0, 1, 'A', true, '#e9c23a', '#1d1d20'); cuadro(1, 1, 'B', true, '#e9c23a', '#1d1d20');
    const d = g.getImageData(0, 0, N, N).data, f = fbmRep(N, o.sem, 8, 4), m = fbmRep(N, o.sem + 5, 4, 3), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N);
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x, k = i*4;   /* el lienzo de arriba queda en v = 1 (flipY de three) */
      const desgaste = m[i] > 0.68 ? 0.78 : 1, v = (0.92 + (f[i] - 0.5)*0.16)*desgaste;
      col[i*3] = lim(d[k]*v, 0, 255); col[i*3+1] = lim(d[k+1]*v, 0, 255); col[i*3+2] = lim(d[k+2]*v, 0, 255); alt[i] = (d[k] + d[k+1] + d[k+2])/765*0.3 + f[i]*0.1; }
    return [col, alt]; },
});

const UTIL = (()=>{
  const V = (x, y, z)=> new THREE.Vector3(x, y, z);
  const rnd = ()=> OBRA.rnd();
  /* ---------- geometrías sueltas (en metros, con uv en metros: se dividen por los metros del material al colocar) ---------- */
  const sinIndice = g=> g.index ? g.toNonIndexed() : g;
  const uvM = g=> uvCaja(g, 1);
  /* caja con base en y */
  function gCaja(w, h, d, x, y, z){ const g = sinIndice(new THREE.BoxGeometry(w, h, d)); g.translate(x || 0, (y || 0) + h/2, z || 0); return uvM(g); }
  /* caja con las aristas biseladas (26 caras: se lee bien con la tinta y agarra brillo en los cantos) */
  function gCajaB(w, h, d, b, x, y, z){
    const H = [w/2, h/2, d/2]; b = Math.max(0.002, Math.min(b, H[0]*0.8, H[1]*0.8, H[2]*0.8)); const I = [H[0] - b, H[1] - b, H[2] - b], P = [];
    const vt = (s, k)=>{ const p = [s[0]*I[0], s[1]*I[1], s[2]*I[2]]; p[k] = s[k]*H[k]; return p; };
    const tri = (a, c, e)=>{ const ux = c[0]-a[0], uy = c[1]-a[1], uz = c[2]-a[2], vx = e[0]-a[0], vy = e[1]-a[1], vz = e[2]-a[2];
      const nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx; if(nx*(a[0]+c[0]+e[0]) + ny*(a[1]+c[1]+e[1]) + nz*(a[2]+c[2]+e[2]) < 0) P.push(...a, ...e, ...c); else P.push(...a, ...c, ...e); };
    const quad = (a, c, e, f)=>{ tri(a, c, e); tri(a, e, f); };
    for(let k=0;k<3;k++) for(const s of [1, -1]){ const j = (k + 1) % 3, l = (k + 2) % 3, sg = (a, bb)=>{ const q = [0, 0, 0]; q[k] = s; q[j] = a; q[l] = bb; return q; };
      quad(vt(sg(1, 1), k), vt(sg(1, -1), k), vt(sg(-1, -1), k), vt(sg(-1, 1), k)); }
    for(let k=0;k<3;k++){ const j = (k + 1) % 3, l = (k + 2) % 3;
      for(const sk of [1, -1]) for(const sj of [1, -1]){ const sg = t=>{ const q = [0, 0, 0]; q[k] = sk; q[j] = sj; q[l] = t; return q; };
        quad(vt(sg(1), k), vt(sg(-1), k), vt(sg(-1), j), vt(sg(1), j)); } }
    for(const sx of [1, -1]) for(const sy of [1, -1]) for(const sz of [1, -1]){ const s = [sx, sy, sz]; tri(vt(s, 0), vt(s, 1), vt(s, 2)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
    g.translate(x || 0, (y || 0) + H[1], z || 0); return uvM(g); }
  /* cilindro vertical con base en y; uv del costado en metros (vuelta × alto) y tapas planas */
  function uvCil(g, r, h){ const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for(let i=0;i<p.count;i++){ if(Math.abs(n.getY(i)) > 0.9) uv.setXY(i, p.getX(i), p.getZ(i)); else uv.setXY(i, uv.getX(i)*TAU*r, uv.getY(i)*h); } return g; }
  function gCil(r, h, lados, x, y, z, o){ o = o || {}; const g = sinIndice(new THREE.CylinderGeometry(o.r2 !== undefined ? o.r2 : r, r, h, lados || 12, o.segs || 1, !!o.abierto)); uvCil(g, r, h); g.translate(x || 0, (y || 0) + h/2, z || 0); return g; }
  /* torno alrededor de y: perfil [[radio, y], ...] de abajo hacia arriba */
  function gTorno(perfil, lados, x, y, z){ const pts = perfil.map(([r, yy])=> new THREE.Vector2(Math.max(0, r), yy)); const g = sinIndice(new THREE.LatheGeometry(pts, lados || 12));
    let rm = 0; for(const [r] of perfil) rm = Math.max(rm, r); const p = g.attributes.position, uv = g.attributes.uv; for(let i=0;i<p.count;i++) uv.setXY(i, uv.getX(i)*TAU*rm, p.getY(i));
    g.computeVertexNormals(); g.translate(x || 0, y || 0, z || 0); return g; }
  /* tubo recto entre dos puntos */
  function gTubo(a, b, r, lados, o){ o = o || {}; const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); if(L < 1e-4) return null;
    const g = sinIndice(new THREE.CylinderGeometry(r, r, L, lados || 8, 1, !!o.abierto)); uvCil(g, r, L); g.translate(0, L/2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); g.translate(a[0], a[1], a[2]); return g; }
  /* barra de sección cuadrada entre dos puntos */
  function gBarra(a, b, s, o){ const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); if(L < 1e-4) return null;
    const g = sinIndice(new THREE.BoxGeometry(s, L, (o && o.s2) || s)); g.translate(0, L/2, 0); uvM(g);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); g.translate(a[0], a[1], a[2]); return g; }
  /* losa vertical que sigue un segmento horizontal p0→p1 (en x, z), de grosor e, de y0 a y1 (hojas de puerta, tablas) */
  function gLosa(p0, p1, e, y0, y1, b){ const dx = p1[0] - p0[0], dz = p1[1] - p0[1], L = Math.hypot(dx, dz); if(L < 1e-3) return null;
    const g = b ? gCajaB(L, y1 - y0, e, b, 0, 0, 0) : gCaja(L, y1 - y0, e, 0, 0, 0); g.rotateY(-Math.atan2(dz, dx)); g.translate((p0[0] + p1[0])/2, y0, (p0[1] + p1[1])/2); return g; }
  /* perfil 2D (en x, y) extrudido a lo largo de z, centrado */
  function gExtr(pts, prof, o){ o = o || {}; const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for(let i=1;i<pts.length;i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
    const b = o.bisel || 0; const g = sinIndice(new THREE.ExtrudeGeometry(s, {depth:Math.max(1e-3, prof - 2*b), bevelEnabled:b > 0, bevelThickness:b, bevelSize:b, bevelOffset:-b, bevelSegments:1, curveSegments:o.curvas || 6}));
    g.translate(0, 0, -prof/2 + b); g.computeVertexNormals(); return uvM(g); }
  function gForma(s, prof, o){ o = o || {}; const g = sinIndice(new THREE.ExtrudeGeometry(s, {depth:prof, bevelEnabled:false, curveSegments:o.curvas || 10})); g.translate(0, 0, -prof/2); g.computeVertexNormals(); return uvM(g); }
  /* cuadrilátero (dos caras si se pide al material) con uv 0..1: carteles */
  function gCuadro(p0, p1, p2, p3, uv){ uv = uv || [0, 0, 1, 0, 1, 1, 0, 1]; const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p0, ...p2, ...p3], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([uv[0], uv[1], uv[2], uv[3], uv[4], uv[5], uv[0], uv[1], uv[4], uv[5], uv[6], uv[7]], 2)); g.computeVertexNormals(); return g; }
  /* curva de un cable colgado (parábola) como tubo fino */
  function gCable(a, b, comba, r){ const pts = []; for(let i=0;i<=12;i++){ const t = i/12; pts.push(V(lerp(a[0], b[0], t), lerp(a[1], b[1], t) - comba*4*t*(1 - t), lerp(a[2], b[2], t))); }
    const g = sinIndice(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r || 0.012, 4, false)); return uvM(g); }

  /* ---------- pieza: geometrías por material, choques, y colocación en el mundo ---------- */
  function Pieza(){ return {partes:{}, choques:[]}; }
  function pone(P, mat, geo, o){ if(!geo) return; const k = mat + '|' + (o ? JSON.stringify(o) : ''); (P.partes[k] = P.partes[k] || {mat, o:o || {}, geos:[]}).geos.push(geo); }
  /* choque en el marco de la pieza: [x0,y0,z0,x1,y1,z1], flags, material (bala y pasos), penetración */
  function choca(P, c, flags, mat, pen){ P.choques.push({c, flags:flags === undefined ? F_TODO : flags, mat, pen}); }
  function juntar(geos){ let n = 0; for(const g of geos) n += g.attributes.position.count;
    const Pp = new Float32Array(n*3), N = new Float32Array(n*3), UV = new Float32Array(n*2); let o = 0;
    for(const g of geos){ const c = g.attributes.position.count; Pp.set(g.attributes.position.array.subarray(0, c*3), o*3); N.set(g.attributes.normal.array.subarray(0, c*3), o*3); UV.set(g.attributes.uv.array.subarray(0, c*2), o*2); o += c; }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(Pp, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); return out; }
  /* giro: cuartos de vuelta (0..3) si la pieza choca (las cajas de choque se giran con ella); o.ang en radianes si no choca */
  function coloca(P, x, y, z, giro, o){ o = o || {};
    const ang = o.ang !== undefined ? o.ang : (giro || 0)*Math.PI/2, cs = Math.cos(ang), sn = Math.sin(ang), m = new THREE.Matrix4().makeRotationY(ang).setPosition(x, y, z);
    for(const k in P.partes){ const E = P.partes[k], M = MATS[E.mat] || MATS.gris, met = M.cara ? 1 : metrosDe(E.mat), geos = [];
      for(const g0 of E.geos){ const g = g0.clone(); if(!g.attributes.normal) g.computeVertexNormals(); if(!g.attributes.uv) uvM(g); g.applyMatrix4(m);
        if(met !== 1){ const uv = g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)/met, uv.getY(i)/met); }
        geos.push(g); }
      prop(juntar(geos), E.mat, E.o); }
    const q = Math.round(ang/(Math.PI/2)), exacto = Math.abs(ang - q*Math.PI/2) < 1e-3;
    for(const ch of P.choques){ const [a0, b0, c0, a1, b1, c1] = ch.c; let xs = [], zs = [];
      for(const [px, pz] of [[a0, c0], [a1, c0], [a1, c1], [a0, c1]]){ xs.push(x + px*cs + pz*sn); zs.push(z - px*sn + pz*cs); }
      if(!exacto && !o.chocaGirado) continue;
      bloque(Math.min(...xs), y + b0, Math.min(...zs), Math.max(...xs), y + b1, Math.max(...zs), ch.mat || 'gris', {invisible:true, flags:ch.flags, pen:ch.pen}); }
    return P; }

  /* ====================== piezas ====================== */
  /* barril de 200 l (0,58 × 0,88 m) con aros de rodadura, tapa hundida y tapón; o.tumbado: acostado a lo largo de x */
  const PERFIL_BARRIL = [[0, 0.004], [0.27, 0.004], [0.286, 0.02], [0.286, 0.27], [0.298, 0.28], [0.298, 0.3], [0.286, 0.31], [0.286, 0.57], [0.298, 0.58], [0.298, 0.6], [0.286, 0.61],
    [0.286, 0.855], [0.296, 0.866], [0.296, 0.882], [0.272, 0.882], [0.266, 0.868], [0, 0.868]];
  function barril(x, y, z, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'barril_azul', g = gTorno(PERFIL_BARRIL, 14), tap = gCil(0.03, 0.02, 8, 0.15, 0.868, 0.08);
    if(o.tumbado){ for(const gg of [g, tap]){ gg.translate(0, -0.44, 0); gg.rotateZ(Math.PI/2); gg.translate(0, 0.298, 0); } }
    pone(P, mat, g); pone(P, 'metal_gris', tap);
    if(o.choque !== false) choca(P, o.tumbado ? [-0.44, 0, -0.3, 0.44, 0.6, 0.3] : [-0.29, 0, -0.29, 0.29, 0.88, 0.29], F_TODO, mat);
    return coloca(P, x, y, z, o.giro || 0); }
  /* grupito de barriles apretados (los colores salen de la lista) */
  function barriles(x, y, z, n, o){ o = o || {}; const cols = o.mats || ['barril_azul'], pos = [[0, 0], [0.62, 0.05], [0.3, 0.56], [-0.34, 0.55], [0.95, 0.6], [-0.1, 1.1]];
    for(let i=0;i<Math.min(n, pos.length);i++){ const [dx, dz] = pos[i]; const jx = (rnd() - 0.5)*0.06, jz = (rnd() - 0.5)*0.06;
      barril(x + dx + jx, y, z + dz + jz, {mat:cols[i % cols.length], giro:0}); } }
  /* pallet de 1,2 × 1,0 × 0,144 (a lo largo de x; giro 1 lo pone a lo largo de z) */
  function gPallet(P, y0){ const mat = 'pino';
    for(let i=0;i<7;i++) pone(P, mat, gCaja(1.2, 0.022, 0.1, 0, y0 + 0.122, -0.45 + i*0.15));
    for(const zz of [-0.45, 0, 0.45]) pone(P, mat, gCaja(1.2, 0.078, 0.1, 0, y0 + 0.044, zz));
    for(const xx of [-0.55, 0, 0.55]) pone(P, mat, gCaja(0.1, 0.022, 1.0, xx, y0 + 0.022, 0)); }
  function pallet(x, y, z, o){ o = o || {}; const P = Pieza(), n = o.n || 1;
    for(let k=0;k<n;k++) gPallet(P, k*0.144);
    let alto = n*0.144;
    if(o.carga === 'cajas'){ const hh = 0.32; for(let f=0;f<(o.pisos || 2);f++) for(const [cx, cz] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]]){ if(rnd() < 0.08 && f) continue;
        pone(P, 'carton', gCajaB(0.56, hh - 0.01, 0.46, 0.015, cx, alto + f*hh, cz)); }
      alto += (o.pisos || 2)*0.32; pone(P, 'negro', gCaja(1.19, 0.01, 0.03, 0, alto - 0.18, -0.48)); }
    else if(o.carga === 'sacos'){ for(let f=0;f<3;f++) for(const [cx, cz] of [[-0.3, -0.24], [0.3, -0.24], [-0.3, 0.24], [0.3, 0.24]]) pone(P, 'sacos', gCajaB(0.58, 0.14, 0.46, 0.05, cx + (f % 2)*0.02, alto + f*0.14, cz)); alto += 0.42; }
    if(o.choque !== false) choca(P, [-0.6, 0, -0.5, 0.6, alto, 0.5], F_TODO, o.carga === 'cajas' ? 'carton' : 'pino');
    return coloca(P, x, y, z, o.giro || 0); }
  /* caño por una poligonal (codos redondos y bridas); o.choque agrega cajas por tramo (sólo tramos alineados a los ejes) */
  function cano(pts, r, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'metal_gris', lados = o.lados || 10;
    for(let i=0;i<pts.length - 1;i++){ pone(P, mat, gTubo(pts[i], pts[i+1], r, lados));
      if(o.bridas !== false){ const a = V(...pts[i]), b = V(...pts[i+1]), d = b.clone().sub(a), L = d.length(); d.normalize();
        for(const t of [0.12, L - 0.12]) if(L > 0.5){ const c = a.clone().addScaledVector(d, t), e = c.clone().addScaledVector(d, 0.05); pone(P, mat, gTubo(c.toArray(), e.toArray(), r*1.35, lados)); } }
      if(o.choque){ const a = pts[i], b = pts[i+1]; choca(P, [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r], F_TODO, 'metal_gris'); } }
    for(let i=1;i<pts.length - 1;i++){ const s = sinIndice(new THREE.SphereGeometry(r*1.08, lados, 6)); s.translate(...pts[i]); pone(P, mat, uvM(s)); }
    if(o.soportes){ for(let i=0;i<pts.length - 1;i++){ const a = V(...pts[i]), b = V(...pts[i+1]), L = a.distanceTo(b), n = Math.floor(L/(o.soportes)); for(let k=1;k<=n;k++){ const c = a.clone().lerp(b, k/(n + 1));
        pone(P, 'metal_gris', gCaja(0.06, r*2 + 0.12, 0.06, c.x, c.y - r - 0.06, c.z)); } } }
    return coloca(P, 0, 0, 0, 0); }
  /* baranda recta (alineada a un eje) desde (x0,z0) a (x1,z1) a la altura y; postes cada ≤ 1,5 m, pasamanos, travesaño y zócalo */
  function baranda(x0, z0, x1, z1, y, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'amarillo', alto = o.alto || 1.05, L = Math.hypot(x1 - x0, z1 - z0); if(L < 0.05) return;
    const dx = (x1 - x0)/L, dz = (z1 - z0)/L, n = Math.max(1, Math.ceil(L/(o.paso || 1.5)));
    for(let i=0;i<=n;i++){ if((i === 0 && o.sinPrimero) || (i === n && o.sinUltimo)) continue; const t = i/n*L; pone(P, mat, gBarra([x0 + dx*t, y, z0 + dz*t], [x0 + dx*t, y + alto, z0 + dz*t], 0.05)); }
    pone(P, mat, gTubo([x0, y + alto, z0], [x1, y + alto, z1], 0.026, 8)); pone(P, mat, gTubo([x0, y + alto*0.52, z0], [x1, y + alto*0.52, z1], 0.018, 6));
    if(o.zocalo !== false){ const g = gBarra([x0, y + 0.01, z0], [x1, y + 0.01, z1], 0.1, {s2:0.008}); g.translate(0, 0.04, 0); pone(P, o.matZocalo || mat, g); }
    /* choque: pasamanos, travesaño y zócalo (con huecos de menos de 0,5 m) */
    const ex = Math.abs(dx) > 0.5 ? 0 : 0.035, ez = Math.abs(dx) > 0.5 ? 0.035 : 0;
    for(const [a, b] of [[alto - 0.06, alto + 0.03], [alto*0.52 - 0.04, alto*0.52 + 0.04], [0, 0.13]])
      bloque(Math.min(x0, x1) - ex, y + a, Math.min(z0, z1) - ez, Math.max(x0, x1) + ex, y + b, Math.max(z0, z1) + ez, 'metal_gris', {invisible:true, flags:F_SOLIDA});
    return coloca(P, 0, 0, 0, 0); }
  /* baranda de escalera (inclinada) de (x0,y0,z0) a (x1,y1,z1) */
  function barandaInclinada(a, b, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'amarillo', alto = o.alto || 0.95, L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.ceil(L/1.4));
    for(let i=0;i<=n;i++){ const t = i/n, x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), z = lerp(a[2], b[2], t); pone(P, mat, gBarra([x, y, z], [x, y + alto, z], 0.045)); }
    pone(P, mat, gTubo([a[0], a[1] + alto, a[2]], [b[0], b[1] + alto, b[2]], 0.025, 8)); pone(P, mat, gTubo([a[0], a[1] + alto*0.5, a[2]], [b[0], b[1] + alto*0.5, b[2]], 0.018, 6));
    /* choque en escalones finos (sólo lo que frena al cuerpo) */
    const k = Math.max(2, Math.ceil(L/0.6)), ex = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]) ? 0 : 0.035, ez = ex ? 0 : 0.035;
    for(let i=0;i<k;i++){ const t0 = i/k, t1 = (i + 1)/k, xa = lerp(a[0], b[0], t0), xb = lerp(a[0], b[0], t1), za = lerp(a[2], b[2], t0), zb = lerp(a[2], b[2], t1), ym = lerp(a[1], b[1], (t0 + t1)/2);
      bloque(Math.min(xa, xb) - ex, ym + alto*0.35, Math.min(za, zb) - ez, Math.max(xa, xb) + ex, ym + alto + 0.03, Math.max(za, zb) + ez, 'metal_gris', {invisible:true, flags:F_SOLIDA}); }
    return coloca(P, 0, 0, 0, 0); }
  /* alambrado romboidal: postes cada 2,5 m, caños horizontales cada ≤ 1,05 m (son el choque) y paño translúcido; o.puas: alambre de púas arriba */
  function alambrado(x0, z0, x1, z1, y, o){ o = o || {}; const P = Pieza(), alto = o.alto || 2.6, L = Math.hypot(x1 - x0, z1 - z0); if(L < 0.1) return;
    const dx = (x1 - x0)/L, dz = (z1 - z0)/L, n = Math.max(1, Math.ceil(L/2.5)), nx = -dz, nz = dx;
    for(let i=0;i<=n;i++){ const t = i/n*L; pone(P, 'reja', gTubo([x0 + dx*t, y, z0 + dz*t], [x0 + dx*t, y + alto + (o.puas ? 0.1 : 0.05), z0 + dz*t], 0.032, 8)); }
    const rieles = [0.12]; for(let h = 0.12 + 1.02; h < alto - 0.2; h += 1.02) rieles.push(h); rieles.push(alto);
    for(const h of rieles) pone(P, 'reja', gTubo([x0, y + h, z0], [x1, y + h, z1], 0.02, 6));
    pone(P, 'reja', gCuadro([x0, y + 0.05, z0], [x1, y + 0.05, z1], [x1, y + alto, z1], [x0, y + alto, z0], [0, 0, L, 0, L, alto, 0, alto]), {alfa:0.34, doble:true});
    if(o.puas){ for(let i=0;i<=n;i++){ const t = i/n*L, bx = x0 + dx*t, bz = z0 + dz*t; pone(P, 'reja', gTubo([bx, y + alto, bz], [bx + nx*0.35*o.puas, y + alto + 0.35, bz + nz*0.35*o.puas], 0.012, 4)); }
      for(const k of [0.12, 0.24, 0.35]) pone(P, 'reja', gTubo([x0 + nx*k*o.puas, y + alto + k, z0 + nz*k*o.puas], [x1 + nx*k*o.puas, y + alto + k, z1 + nz*k*o.puas], 0.008, 4)); }
    const ex = Math.abs(dx) > 0.5 ? 0 : 0.04, ez = ex ? 0 : 0.04;
    for(const h of rieles) bloque(Math.min(x0, x1) - ex, y + Math.max(0, h - 0.05), Math.min(z0, z1) - ez, Math.max(x0, x1) + ex, y + h + 0.05, Math.max(z0, z1) + ez, 'reja', {invisible:true, flags:F_SOLIDA});
    return coloca(P, 0, 0, 0, 0); }
  /* marco de puerta (jambas y dintel) en un hueco de muro: eje del muro ('x' o 'z'), posición del muro, de a0 a a1, alto, grosor;
     o.hojas: 1 o 2 hojas, o.abre: fracción de 90° (1 = contra la pared), o.lado: +1/−1 hacia dónde abren, o.mat de las hojas */
  function puerta(eje, p, a0, a1, y, alto, grosor, o){ o = o || {}; const P = Pieza(), matM = o.marco || 'metal_gris', matH = o.mat || 'madera', t = grosor/2 + 0.03, w = 0.09;
    for(const a of [a0 - w/2, a1 + w/2]){ const g = eje === 'x' ? gCaja(w, alto + w, grosor + 0.06, a, y, p) : gCaja(grosor + 0.06, alto + w, w, p, y, a); pone(P, matM, g); }
    pone(P, matM, eje === 'x' ? gCaja(a1 - a0 + 2*w, w, grosor + 0.06, (a0 + a1)/2, y + alto, p) : gCaja(grosor + 0.06, w, a1 - a0 + 2*w, p, y + alto, (a0 + a1)/2));
    const nh = o.hojas || 0;
    if(nh){ const ancho = (a1 - a0)/nh, lado = o.lado || 1, esp = 0.05;
      /* en el plano del muro: u a lo largo del muro, v hacia 'lado'; la hoja gira sobre la bisagra */
      const W = (u, v)=> eje === 'x' ? [u, p + v] : [p + v, u];
      for(let h=0;h<nh;h++){ const bis = h === 0 ? a0 : a1, sg = h === 0 ? 1 : -1, ab = (o.abre !== undefined ? (Array.isArray(o.abre) ? o.abre[h] : o.abre) : 1)*Math.PI/2;
        const ca = Math.cos(ab), sa = Math.sin(ab), h0 = [bis + sg*0.01*ca, lado*(t + 0.01*sa)], h1 = [bis + sg*(ancho - 0.02)*ca, lado*(t + (ancho - 0.02)*sa)];
        pone(P, matH, gLosa(W(h0[0], h0[1] + lado*esp/2), W(h1[0], h1[1] + lado*esp/2), esp, y + 0.02, y + alto - 0.02, 0.012));
        pone(P, 'cromado', gLosa(W(lerp(h0[0], h1[0], 0.88), lerp(h0[1], h1[1], 0.88) + lado*(esp + 0.02)), W(lerp(h0[0], h1[0], 0.92), lerp(h0[1], h1[1], 0.92) + lado*(esp + 0.02)), 0.03, y + 1.0, y + 1.08));
        /* choque de la hoja en tramos (si está en diagonal) */
        const k = Math.abs(ab - Math.PI/2) < 0.05 || ab < 0.05 ? 1 : 4;
        for(let i=0;i<k;i++){ const s0 = i/k*ancho, s1 = (i + 1)/k*ancho; const a_ = bis + sg*s0*ca, b_ = bis + sg*s1*ca, c_ = lado*(t + s0*sa), d_ = lado*(t + s1*sa);
          const u0 = Math.min(a_, b_) - 0.03, u1 = Math.max(a_, b_) + 0.03, v0 = Math.min(c_, d_, c_ + lado*esp) - 0.02, v1 = Math.max(c_, d_, d_ + lado*esp) + 0.02;
          if(eje === 'x') bloque(u0, y, p + v0, u1, y + alto - 0.04, p + v1, matH, {invisible:true, flags:F_TODO});
          else bloque(p + v0, y, u0, p + v1, y + alto - 0.04, u1, matH, {invisible:true, flags:F_TODO}); } } }
    return coloca(P, 0, 0, 0, 0); }
  /* equipo de aire acondicionado (condensadora) con ventilador arriba */
  function equipoAire(x, y, z, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'metal_blanco';
    pone(P, mat, gCajaB(1.1, 0.9, 0.8, 0.03, 0, 0.1, 0));
    for(const [xx, zz] of [[-0.5, -0.33], [0.5, -0.33], [-0.5, 0.33], [0.5, 0.33]]) pone(P, 'metal_gris', gCaja(0.08, 0.1, 0.08, xx, 0, zz));
    pone(P, 'negro', gCil(0.3, 0.02, 16, 0, 1.0, 0)); const aro = sinIndice(new THREE.TorusGeometry(0.31, 0.02, 4, 16)); aro.rotateX(Math.PI/2); aro.translate(0, 1.02, 0); pone(P, 'metal_gris', uvM(aro));
    pone(P, 'metal_gris', gCaja(0.6, 0.02, 0.03, 0, 1.02, 0)); pone(P, 'metal_gris', gCaja(0.03, 0.02, 0.6, 0, 1.02, 0));
    for(let i=0;i<7;i++) pone(P, 'metal_gris', gCaja(0.9, 0.012, 0.02, 0, 0.25 + i*0.09, -0.41));
    if(o.cano) pone(P, 'cromado', gTubo([0.45, 0.35, 0.4], [0.45, 0.35, 0.9], 0.025, 6));
    if(o.choque !== false) choca(P, [-0.55, 0, -0.4, 0.55, 1.03, 0.4], F_TODO, mat);
    return coloca(P, x, y, z, o.giro || 0); }
  /* cartel de sitio en una pared: letra 'A'/'B', o.flecha: 1 derecha, −1 izquierda; dir = hacia dónde mira ('x+','x-','z+','z-') */
  function cartel(letra, x, y, z, dir, tam, o){ o = o || {}; const P = Pieza(), s = tam || 1.2, col = letra === 'B' ? 1 : 0, fila = o.flecha ? 1 : 0;
    let u0 = col*0.5, u1 = u0 + 0.5, v0 = fila ? 0 : 0.5, v1 = v0 + 0.5; if(o.flecha === -1){ const t = u0; u0 = u1; u1 = t; }
    /* cara mirando a +z en el marco local; después se gira */
    const w = s*(o.flecha ? 1.6 : 1), h = s;
    const g = gCuadro([-w/2, 0, 0.012], [w/2, 0, 0.012], [w/2, h, 0.012], [-w/2, h, 0.012], [u0, v0, u1, v0, u1, v1, u0, v1]);
    pone(P, 'letreros', g); pone(P, 'metal_gris', gCaja(w + 0.06, h + 0.06, 0.01, 0, -0.03, 0.002));
    const ang = {'z+':0, 'x+':Math.PI/2, 'z-':Math.PI, 'x-':-Math.PI/2}[dir] || 0;
    return coloca(P, x, y, z, 0, {ang}); }
  /* contenedor marítimo: el cuerpo es un bloque (luz horneada) y la utilería pone esquineros, rieles, trabas y manijas.
     o.largo 6,06 (20') o 12,19 (40'), o.eje 'x'|'z', o.mat, o.puertas: +1/−1 (extremo con puertas) */
  function contenedor(x, y, z, o){ o = o || {}; const L = o.largo || 6.06, W = 2.44, H = 2.59, mat = o.mat || 'contenedor_rojo', ex = o.eje === 'z';
    const hx = ex ? W/2 : L/2, hz = ex ? L/2 : W/2;
    bloque(x - hx + 0.06, y, z - hz + 0.06, x + hx - 0.06, y + H - 0.02, z + hz - 0.06, mat);
    const P = Pieza();
    /* marco: esquineros y rieles (en el marco local: largo en x) */
    for(const sx of [-1, 1]) for(const sz of [-1, 1]) pone(P, mat, gCaja(0.16, H, 0.16, sx*(L/2 - 0.08), 0, sz*(W/2 - 0.08)));
    for(const yy of [0, H - 0.14]) for(const sz of [-1, 1]) pone(P, mat, gCaja(L - 0.2, 0.14, 0.1, 0, yy, sz*(W/2 - 0.05)));
    for(const yy of [0, H - 0.14]) for(const sx of [-1, 1]) pone(P, mat, gCaja(0.1, 0.14, W - 0.2, sx*(L/2 - 0.05), yy, 0));
    const pu = o.puertas || 1;
    for(const zz of [-0.72, -0.42, 0.42, 0.72]){ pone(P, 'metal_gris', gTubo([pu*(L/2 + 0.02), 0.1, zz], [pu*(L/2 + 0.02), H - 0.1, zz], 0.022, 6));
      pone(P, 'metal_gris', gCaja(0.05, 0.05, 0.16, pu*(L/2 + 0.035), 1.2, zz + 0.07)); }
    pone(P, 'negro', gCaja(0.012, H - 0.3, 0.02, pu*(L/2 + 0.004), 0.15, 0));
    coloca(P, x, y, z, ex ? 1 : 0);
    return {x0:x - hx, x1:x + hx, z0:z - hz, z1:z + hz, y1:y + H}; }
  /* tanque vertical (o silo con techo cónico): cuerpo con anillos, techo, escalera marinera y baranda arriba; choque = tres cajas inscriptas */
  function tanque(x, y, z, r, alto, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'metal_blanco', lados = o.lados || 20, patas = o.patas || 0;
    const y0 = patas; pone(P, mat, gCil(r, alto, lados, 0, y0, 0, {segs:Math.max(1, Math.round(alto/2)), abierto:true}));
    for(let yy = y0 + 1.5; yy < y0 + alto - 0.5; yy += o.anillos || 2.5) pone(P, mat, gCil(r + 0.04, 0.08, lados, 0, yy, 0, {abierto:true}));
    const techo = o.techo || 'cono', hT = techo === 'cono' ? r*0.35 : techo === 'domo' ? r*0.5 : 0.05;
    if(techo === 'domo'){ const pr = []; for(let i=0;i<=6;i++){ const a = i/6*Math.PI/2; pr.push([r*Math.cos(a), y0 + alto + Math.sin(a)*hT]); } pone(P, mat, gTorno(pr, lados)); }
    else pone(P, mat, gTorno([[r + 0.05, y0 + alto], [r + 0.05, y0 + alto + 0.1], [r*0.12, y0 + alto + 0.1 + hT], [0, y0 + alto + 0.12 + hT]], lados));
    pone(P, mat, gTorno([[0, y0], [r, y0]], lados));
    if(patas){ for(let i=0;i<4;i++){ const a = i*Math.PI/2 + Math.PI/4; pone(P, 'metal_gris', gBarra([Math.cos(a)*r*0.85, 0, Math.sin(a)*r*0.85], [Math.cos(a)*r*0.85, patas + 0.3, Math.sin(a)*r*0.85], 0.16)); } }
    if(o.escalera !== false){ const a = o.angEscalera !== undefined ? o.angEscalera : 0, cx = Math.sin(a)*(r + 0.2), cz = -Math.cos(a)*(r + 0.2), px = Math.cos(a)*0.22, pz = Math.sin(a)*0.22, top = y0 + alto + 0.1;
      for(const s of [-1, 1]) pone(P, 'metal_gris', gTubo([cx + px*s, Math.max(0, y0 - 0.2) + 0.3, cz + pz*s], [cx + px*s, top + 1.0, cz + pz*s], 0.022, 6));
      for(let yy = Math.max(0, y0 - 0.2) + 0.6; yy < top; yy += 0.3) pone(P, 'metal_gris', gTubo([cx - px, yy, cz - pz], [cx + px, yy, cz + pz], 0.014, 4));
      if(alto > 4) for(let yy = Math.max(2.4, y0 + 2.4); yy < top; yy += 1.1){ const aro = sinIndice(new THREE.TorusGeometry(0.4, 0.015, 3, 10, Math.PI)); aro.rotateX(Math.PI/2); aro.rotateY(-a); aro.translate(cx - Math.sin(a)*0.02, yy, cz + Math.cos(a)*0.02); pone(P, 'metal_gris', uvM(aro)); } }
    if(o.baranda){ const n = 16, yb = y0 + alto + 0.1 + hT*0.2; for(let i=0;i<n;i++){ const a0 = i/n*TAU, a1 = (i + 1)/n*TAU, rr = r*0.92;
        pone(P, 'amarillo', gTubo([Math.cos(a0)*rr, yb + 1, Math.sin(a0)*rr], [Math.cos(a1)*rr, yb + 1, Math.sin(a1)*rr], 0.022, 5)); pone(P, 'amarillo', gTubo([Math.cos(a0)*rr, yb, Math.sin(a0)*rr], [Math.cos(a0)*rr, yb + 1, Math.sin(a0)*rr], 0.02, 4)); } }
    if(o.choque !== false){ const hC = y0 + alto + hT*0.5, k = [[0.924, 0.383], [0.707, 0.707], [0.383, 0.924]];
      for(const [a, b] of k) choca(P, [-r*a, patas ? y0 : 0, -r*b, r*a, hC, r*b], F_TODO, mat);
      if(patas) for(let i=0;i<4;i++){ const a = i*Math.PI/2 + Math.PI/4, px = Math.cos(a)*r*0.85, pz = Math.sin(a)*r*0.85; choca(P, [px - 0.1, 0, pz - 0.1, px + 0.1, y0, pz + 0.1], F_TODO, 'metal_gris'); } }
    return coloca(P, x, y, z, 0); }
  /* tanque horizontal (gas) sobre dos cunas, a lo largo de x (giro 1: a lo largo de z) */
  function tanqueH(x, y, z, r, largo, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'metal_blanco', yc = r + 0.45;
    const cuerpo = gCil(r, largo, 18, 0, 0, 0, {abierto:true, segs:3}); cuerpo.translate(0, -largo/2, 0); cuerpo.rotateZ(Math.PI/2); cuerpo.translate(0, yc, 0); pone(P, mat, cuerpo);
    for(const s of [-1, 1]){ const pr = []; for(let i=0;i<=5;i++){ const a = i/5*Math.PI/2; pr.push([r*Math.cos(a), Math.sin(a)*r*0.45]); } const t = gTorno(pr, 18); t.rotateZ(-s*Math.PI/2); t.translate(s*largo/2, yc, 0); pone(P, mat, t); }
    for(const s of [-0.3, 0.3]){ pone(P, 'hormigon_barrera', gCajaB(0.35, 0.5, r*1.6, 0.03, s*largo, 0, 0)); }
    pone(P, 'metal_gris', gCil(0.08, 0.3, 8, largo*0.1, yc + r - 0.05, 0)); pone(P, 'rojo', gCil(0.12, 0.05, 10, largo*0.1, yc + r + 0.25, 0));
    if(o.choque !== false){ const k = [[0.924, 0.383], [0.707, 0.707], [0.383, 0.924]]; for(const [a, b] of k) choca(P, [-largo/2 - r*0.3, yc - r*b, -r*a, largo/2 + r*0.3, yc + r*b, r*a], F_TODO, mat);
      choca(P, [-largo*0.3 - 0.18, 0, -r*0.8, largo*0.3 + 0.18, yc - r*0.3, r*0.8], F_TODO, 'hormigon_barrera'); }
    return coloca(P, x, y, z, o.giro || 0); }
  /* cable colgado entre dos puntos */
  function cable(a, b, comba, o){ o = o || {}; const P = Pieza(); pone(P, o.mat || 'negro', gCable(a, b, comba || 0.4, o.r || 0.012)); return coloca(P, 0, 0, 0, 0); }
  /* rejilla de ventilación en una pared: marco y persianas; dir hacia dónde mira */
  function rejilla(x, y, z, dir, w, h, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'metal_gris';
    pone(P, mat, gCaja(w, 0.05, 0.06, 0, 0, 0.03)); pone(P, mat, gCaja(w, 0.05, 0.06, 0, h - 0.05, 0.03)); pone(P, mat, gCaja(0.05, h, 0.06, -w/2 + 0.025, 0, 0.03)); pone(P, mat, gCaja(0.05, h, 0.06, w/2 - 0.025, 0, 0.03));
    pone(P, 'negro', gCaja(w - 0.1, h - 0.1, 0.01, 0, 0.05, 0.005));
    const n = Math.max(2, Math.round(h/0.09)); for(let i=0;i<n;i++){ const g = gCaja(w - 0.1, 0.012, 0.07, 0, 0, 0); g.rotateX(-0.6); g.translate(0, 0.08 + i*(h - 0.14)/(n - 1), 0.04); pone(P, mat, g); }
    const ang = {'z+':0, 'x+':Math.PI/2, 'z-':Math.PI, 'x-':-Math.PI/2}[dir] || 0; return coloca(P, x, y, z, 0, {ang}); }
  /* escalera marinera (decorado) pegada a una pared que mira hacia dir */
  function escaleraMarinera(x, y, z, dir, alto, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'metal_gris';
    for(const s of [-0.22, 0.22]){ pone(P, mat, gTubo([s, 0, 0.18], [s, alto + 1, 0.18], 0.022, 6)); pone(P, mat, gBarra([s, alto - 0.3, 0], [s, alto - 0.3, 0.2], 0.04)); pone(P, mat, gBarra([s, 0.6, 0], [s, 0.6, 0.2], 0.04)); }
    for(let yy = 0.3; yy < alto; yy += 0.3) pone(P, mat, gTubo([-0.22, yy, 0.18], [0.22, yy, 0.18], 0.014, 4));
    if(o.jaula && alto > 3) for(let yy = 2.3; yy < alto + 0.8; yy += 1){ const aro = sinIndice(new THREE.TorusGeometry(0.36, 0.014, 3, 10, Math.PI)); aro.rotateX(Math.PI/2); aro.translate(0, yy, 0.18); pone(P, mat, uvM(aro)); }
    const ang = {'z+':0, 'x+':Math.PI/2, 'z-':Math.PI, 'x-':-Math.PI/2}[dir] || 0; return coloca(P, x, y, z, 0, {ang}); }
  /* autoelevador amarillo: las uñas hacia −x (giro para orientarlo) */
  function montacargas(x, y, z, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'amarillo';
    pone(P, mat, gExtr([[-0.95, 0.25], [0.75, 0.25], [0.85, 0.5], [0.9, 1.05], [0.35, 1.1], [0.15, 0.62], [-0.8, 0.62], [-0.95, 0.4]], 1.1, {bisel:0.03}));
    pone(P, 'negro', gCajaB(1.0, 0.55, 1.12, 0.05, 0.62, 0.35, 0)); pone(P, 'negro', gCajaB(0.45, 0.5, 0.5, 0.06, 0.2, 0.62, 0));
    for(const sz of [-0.5, 0.5]) for(const sx of [-0.55, 0.5]){ pone(P, 'negro', gBarra([sx, 1.05, sz], [sx, 2.1, sz], 0.06)); }
    pone(P, 'negro', gCaja(1.2, 0.05, 1.08, -0.02, 2.1, 0)); for(let i=0;i<5;i++) pone(P, 'negro', gCaja(0.04, 0.04, 1.0, -0.5 + i*0.25, 2.06, 0));
    for(const sz of [-0.36, 0.36]) pone(P, 'metal_gris', gCaja(0.08, 2.4, 0.12, -1.05, 0.08, sz));
    pone(P, 'metal_gris', gCaja(0.08, 0.5, 0.95, -1.12, 0.2, 0)); for(const sz of [-0.28, 0.28]) pone(P, 'metal_gris', gCaja(1.1, 0.05, 0.12, -1.7, 0.08, sz));
    for(const [sx, rr] of [[-0.6, 0.3], [0.62, 0.26]]) for(const sz of [-0.55, 0.55]){ const w = gCil(rr, 0.22, 12, 0, 0, 0); w.translate(0, -0.11, 0); w.rotateX(Math.PI/2); w.translate(sx, rr, sz); pone(P, 'goma', w); }
    pone(P, 'negro', gTubo([-0.2, 1.0, 0], [-0.35, 1.25, 0], 0.02, 5)); const vol = sinIndice(new THREE.TorusGeometry(0.15, 0.015, 4, 10)); vol.rotateZ(Math.PI/2 - 0.5); vol.translate(-0.37, 1.27, 0); pone(P, 'negro', uvM(vol));
    if(o.choque !== false){ choca(P, [-1.15, 0, -0.62, 0.95, 2.15, 0.62], F_TODO, mat); choca(P, [-2.25, 0, -0.36, -1.15, 0.14, 0.36], F_TODO, 'metal_gris'); }
    return coloca(P, x, y, z, o.giro || 0); }
  /* estantería de tarimas a lo largo de x (giro 1: a lo largo de z) desde el centro: bahías de 2,7 m, niveles a 0, 1,8 y 3,6 m;
     la mercadería (tarimas con cajas o cajones) va como bloques para que tenga luz propia y frene balas */
  function estanteria(x, y, z, bahias, o){ o = o || {}; const P = Pieza(), prof = 1.1, bw = 2.7, L = bahias*bw, niveles = o.niveles || [0, 1.8, 3.6], alto = o.alto || (niveles[niveles.length - 1] + 1.4);
    const giro = o.giro || 0, loc = (lx, lz)=> giro % 2 ? [x + lz, z - lx] : [x + lx, z + lz];
    for(let i=0;i<=bahias;i++){ const lx = -L/2 + i*bw; for(const lz of [-prof/2, prof/2]){ pone(P, o.matMarco || 'metal_azul', gCaja(0.08, alto, 0.08, lx, 0, lz)); }
      for(let yy = 0.3; yy < alto - 0.2; yy += 0.9) pone(P, o.matMarco || 'metal_azul', gBarra([lx, yy, -prof/2], [lx, yy + 0.8, prof/2], 0.03));
      choca(P, [lx - 0.05, 0, -prof/2 - 0.05, lx + 0.05, alto, prof/2 + 0.05], F_TODO, 'metal_azul'); }
    for(const ny of niveles){ if(!ny) continue; for(const lz of [-prof/2, prof/2]) pone(P, 'acero_naranja', gCaja(L + 0.08, 0.12, 0.05, 0, ny - 0.12, lz));
      pone(P, 'reja', gCaja(L, 0.02, prof, 0, ny - 0.02, 0));
      choca(P, [-L/2, ny - 0.14, -prof/2, L/2, ny, prof/2], F_TODO, 'reja'); }
    coloca(P, x, y, z, giro);
    /* mercadería */
    const r = OBRA.rnd;
    for(let i=0;i<bahias;i++) for(const ny of niveles){ for(const k of [0, 1]){ if(r() < (o.huecos || 0.2)) continue; const lx = -L/2 + i*bw + 0.1 + k*1.3 + 0.6, tipo = r();
        const [cx, cz] = loc(lx, 0), hC = ny ? Math.min(1.1, (niveles[niveles.indexOf(ny) + 1] || alto) - ny - 0.35) : 1.2;
        if(tipo < 0.45){ pallet(cx, y + ny, cz, {carga:'cajas', pisos:Math.max(1, Math.floor((hC - 0.15)/0.32)), giro:giro % 2 ? 1 : 0, choque:true}); }
        else { const s = Math.min(1.1, hC); const hx = giro % 2 ? 0.5 : 0.55, hz = giro % 2 ? 0.55 : 0.5; bloque(cx - hx, y + ny, cz - hz, cx + hx, y + ny + s, cz + hz, tipo < 0.8 ? 'caja_madera' : 'caja_roja'); } } }
    return P; }
  /* luminarias: además de la pieza, pone la lámpara del horneado (sin la malla genérica del kit) */
  function luminaria(tipo, x, y, z, o){ o = o || {}; const P = Pieza(), eje = o.eje || 'x', col = o.color || (tipo === 'campana' || tipo === 'aplique' ? '#ffe9c8' : '#eef3ff');
    const em = o.emisivo || (tipo === 'emergencia' ? '#ff3a24' : tipo === 'campana' || tipo === 'aplique' ? '#fff0d0' : '#f4f8ff');
    if(tipo === 'tubo'){ pone(P, 'metal_blanco', gCajaB(1.32, 0.08, 0.2, 0.015, 0, 0.02, 0)); pone(P, 'blanco', gCaja(1.24, 0.02, 0.13, 0, 0.0, 0), {emisivo:em, luzPropia:o.brillo || 3.2});
      if(o.colgar) for(const s of [-0.5, 0.5]) pone(P, 'metal_gris', gTubo([s, 0.1, 0], [s, o.colgar, 0], 0.008, 4)); }
    else if(tipo === 'campana'){ pone(P, 'metal_gris', gTorno([[0.05, 0.42], [0.1, 0.36], [0.26, 0.14], [0.3, 0.0], [0.28, 0.0], [0.24, 0.12], [0.08, 0.34], [0, 0.36]], 12)); pone(P, 'blanco', gCil(0.2, 0.02, 12, 0, 0.04, 0), {emisivo:em, luzPropia:o.brillo || 3.5});
      if(o.colgar) pone(P, 'metal_gris', gTubo([0, 0.42, 0], [0, o.colgar, 0], 0.012, 4)); }
    else if(tipo === 'aplique'){ pone(P, 'metal_gris', gCajaB(0.22, 0.3, 0.1, 0.02, 0, -0.15, 0.05)); pone(P, 'blanco', gCil(0.08, 0.16, 10, 0, -0.08, 0.14), {emisivo:em, luzPropia:o.brillo || 3});
      for(const a of [0, 1, 2]) pone(P, 'metal_gris', gTubo([Math.cos(a*2.1)*0.1, -0.1, 0.14 + Math.sin(a*2.1)*0.1], [Math.cos(a*2.1)*0.1, 0.1, 0.14 + Math.sin(a*2.1)*0.1], 0.008, 3)); }
    else if(tipo === 'emergencia'){ pone(P, 'metal_gris', gCil(0.09, 0.05, 10, 0, 0, 0)); pone(P, 'rojo', gCil(0.07, 0.12, 10, 0, 0.05, 0, {r2:0.05}), {emisivo:em, luzPropia:o.brillo || 2.5}); }
    else if(tipo === 'reflector'){ pone(P, 'metal_gris', gCajaB(0.45, 0.35, 0.22, 0.03, 0, -0.17, 0)); pone(P, 'blanco', gCaja(0.36, 0.26, 0.01, 0, -0.13, -0.115), {emisivo:em, luzPropia:o.brillo || 1.6}); }
    const ang = o.ang !== undefined ? o.ang : (eje === 'z' ? Math.PI/2 : 0);
    coloca(P, x, y, z, 0, {ang});
    const adel = tipo === 'aplique' ? 0.3 : 0, ly = tipo === 'aplique' ? -0.05 : tipo === 'reflector' ? -0.2 : -0.12;
    if(o.fuerza !== 0) lampara(x + Math.sin(ang)*adel, y + ly, z + Math.cos(ang)*adel, col, o.fuerza || (tipo === 'campana' ? 34 : tipo === 'emergencia' ? 5 : 22), o.radio || (tipo === 'campana' ? 14 : tipo === 'emergencia' ? 5 : 10), {malla:false, tubo:tipo === 'tubo', largo:1.2, eje});
    return P; }
  /* toldo inclinado: de la pared (alto y1) al borde de afuera (y0); dir = hacia dónde sale de la pared; con faldón festoneado y postes opcionales.
     Debajo lleva escalones finos de choque que sólo frenan balas: dan la sombra al hornear. */
  function toldo(x0, z0, x1, z1, y0, y1, dir, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'lona_roja';
    [x0, x1] = orden(x0, x1); [z0, z1] = orden(z0, z1);
    const aLo = dir[0] === 'z', sg = dir[1] === '+' ? 1 : -1, largo = aLo ? x1 - x0 : z1 - z0, sale = aLo ? z1 - z0 : x1 - x0;
    /* en el marco local: largo en x, sale hacia +z, pared en z = 0 */
    const n = 6, pts = [];
    for(let i=0;i<=n;i++){ const t = i/n; pts.push([t*sale, y1 + (y0 - y1)*t - Math.sin(t*Math.PI)*0.05]); }
    for(let i=0;i<n;i++){ const [za, ya] = pts[i], [zb, yb] = pts[i+1]; pone(P, mat, gCuadro([-largo/2, ya, za], [largo/2, ya, za], [largo/2, yb, zb], [-largo/2, yb, zb], [0, za, largo, za, largo, zb, 0, zb]), {doble:true}); }
    const nf = Math.max(2, Math.round(largo/0.4)); for(let i=0;i<nf;i++){ const a = -largo/2 + i*largo/nf, b = a + largo/nf, m = (a + b)/2;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([a, y0, sale, b, y0, sale, m, y0 - 0.22, sale, a, y0, sale, m, y0 - 0.22, sale, a, y0 - 0.14, sale, b, y0, sale, b, y0 - 0.14, sale, m, y0 - 0.22, sale], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([a, 0, b, 0, m, 0.22, a, 0, m, 0.22, a, 0.14, b, 0, b, 0.14, m, 0.22], 2)); g.computeVertexNormals(); pone(P, mat, g, {doble:true}); }
    pone(P, 'metal_gris', gTubo([-largo/2, y0, sale], [largo/2, y0, sale], 0.025, 6)); pone(P, 'metal_gris', gTubo([-largo/2, y1, 0.02], [largo/2, y1, 0.02], 0.03, 6));
    for(const s of [-1, 1]) pone(P, 'metal_gris', gTubo([s*largo/2, y1, 0.02], [s*largo/2, y0, sale], 0.02, 5));
    if(o.postes) for(const s of [-1, 1]){ pone(P, 'metal_gris', gTubo([s*(largo/2 - 0.05), 0, sale - 0.05], [s*(largo/2 - 0.05), y0, sale - 0.05], 0.035, 6)); }
    const ang = aLo ? (sg > 0 ? 0 : Math.PI) : (sg > 0 ? Math.PI/2 : -Math.PI/2);
    const cx = aLo ? (x0 + x1)/2 : (sg > 0 ? x0 : x1), cz = aLo ? (sg > 0 ? z0 : z1) : (z0 + z1)/2;
    coloca(P, cx, 0, cz, 0, {ang});
    /* sombra: tres escalones finos por debajo de la lona (sólo frenan balas) */
    for(let i=0;i<3;i++){ const t0 = i/3, t1 = (i + 1)/3, yy = Math.min(y1 + (y0 - y1)*t1, y1 + (y0 - y1)*t0) - 0.06;
      const a0 = t0*sale, a1 = t1*sale, lo = [aLo ? x0 : (sg > 0 ? x0 + a0 : x1 - a1), aLo ? (sg > 0 ? z0 + a0 : z1 - a1) : z0], hi = [aLo ? x1 : (sg > 0 ? x0 + a1 : x1 - a0), aLo ? (sg > 0 ? z0 + a1 : z1 - a0) : z1];
      bloque(lo[0], yy - 0.03, lo[1], hi[0], yy, hi[1], mat, {invisible:true, flags:F_BALA}); }
    if(o.postes) for(const s of [-1, 1]){ const lx = s*(largo/2 - 0.05), lz = sale - 0.05, px = aLo ? cx + lx*(sg > 0 ? 1 : -1) : cx + lz*(sg > 0 ? 1 : -1), pz = aLo ? cz + lz*(sg > 0 ? 1 : -1) : cz - lx*(sg > 0 ? 1 : -1);
      bloque(px - 0.05, 0, pz - 0.05, px + 0.05, y0, pz + 0.05, 'metal_gris', {invisible:true, flags:F_TODO}); }
    return P; }
  /* relleno de un arco de medio punto en un hueco de muro: la parte de arriba entre el rectángulo y la curva, del material del muro.
     eje/p/grosor como el muro; a0..a1 el hueco; yArr = arranque del arco; el hueco del muro tiene que llegar a yArr + (a1 − a0)/2 */
  function arco(eje, p, a0, a1, yArr, grosor, mat, o){ o = o || {}; const P = Pieza(), w = a1 - a0, r = w/2, cx = (a0 + a1)/2, top = yArr + r + (o.extra || 0.02);
    for(const lado of [-1, 1]){ const s = new THREE.Shape(); if(lado < 0){ s.moveTo(-r - 0.001, yArr); s.lineTo(-r - 0.001, top); s.lineTo(0.001, top); s.lineTo(0.001, yArr + r); s.absarc(0, yArr, r, Math.PI/2, Math.PI, false); }
      else { s.moveTo(r + 0.001, yArr); s.absarc(0, yArr, r, 0, Math.PI/2, false); s.lineTo(-0.001, top); s.lineTo(r + 0.001, top); }
      const g = gForma(s, grosor, {curvas:10}); if(eje === 'z'){ g.rotateY(Math.PI/2); g.translate(p, 0, cx); } else g.translate(cx, 0, p); pone(P, mat, g); }
    if(o.dovelas){ const pr = []; for(let i=0;i<=16;i++){ const a = Math.PI - i/16*Math.PI; pr.push([Math.cos(a)*(r + 0.12), Math.sin(a)*(r + 0.12)]); } for(let i=16;i>=0;i--){ const a = Math.PI - i/16*Math.PI; pr.push([Math.cos(a)*r, Math.sin(a)*r]); }
      for(const s of [-1, 1]){ const g = gExtr(pr.map(([u, v])=> [u, v + yArr]), 0.05); if(eje === 'z'){ g.rotateY(Math.PI/2); g.translate(p + s*(grosor/2 + 0.02), 0, cx); } else g.translate(cx, 0, p + s*(grosor/2 + 0.02)); pone(P, o.dovelas, g); } }
    coloca(P, 0, 0, 0, 0);
    /* choque (balas) en escalones */
    for(let i=1;i<4;i++){ const ya = yArr + i/4*r, ext = r - Math.sqrt(Math.max(0, r*r - Math.pow(ya - yArr, 2)));
      for(const s of [-1, 1]){ const u0 = s < 0 ? a0 : a1 - ext, u1 = s < 0 ? a0 + ext : a1; if(u1 - u0 < 0.02) continue;
        if(eje === 'x') bloque(u0, ya, p - grosor/2, u1, top, p + grosor/2, mat, {invisible:true, flags:F_BALA}); else bloque(p - grosor/2, ya, u0, p + grosor/2, top, u1, mat, {invisible:true, flags:F_BALA}); } }
    return P; }
  /* auto chico (tres puertas), frente hacia −z */
  function auto(x, y, z, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'metal_blanco';
    pone(P, mat, gExtr([[-0.85, 0.3], [0.85, 0.3], [0.88, 0.75], [0.78, 0.85], [-0.78, 0.85], [-0.88, 0.75]], 3.7, {bisel:0.04}));
    const cab = gExtr([[-0.75, 0.84], [0.75, 0.84], [0.62, 1.38], [-0.62, 1.38]], 2.1, {bisel:0.03}); cab.translate(0, 0, 0.35); pone(P, mat, cab);
    for(const s of [-1, 1]) pone(P, 'vidrio_osc', gCuadro([s*0.765, 0.9, -0.5], [s*0.765, 0.9, 1.3], [s*0.64, 1.33, 1.28], [s*0.64, 1.33, -0.46]), {doble:true});
    pone(P, 'vidrio_osc', gCuadro([0.7, 0.88, -0.72], [-0.7, 0.88, -0.72], [-0.6, 1.33, -0.52], [0.6, 1.33, -0.52]), {doble:true});
    pone(P, 'vidrio_osc', gCuadro([-0.7, 0.9, 1.42], [0.7, 0.9, 1.42], [0.6, 1.34, 1.36], [-0.6, 1.34, 1.36]), {doble:true});
    pone(P, 'negro', gCajaB(1.8, 0.2, 0.18, 0.04, 0, 0.28, -1.84)); pone(P, 'negro', gCajaB(1.8, 0.2, 0.18, 0.04, 0, 0.28, 1.84));
    for(const sz of [-1.2, 1.15]) for(const sx of [-0.8, 0.8]){ const w = gCil(0.3, 0.2, 12, 0, 0, 0); w.translate(0, -0.1, 0); w.rotateZ(Math.PI/2); w.translate(sx, 0.3, sz); pone(P, 'goma', w); }
    for(const s of [-0.6, 0.6]) pone(P, 'blanco', gCaja(0.3, 0.1, 0.02, s, 0.62, -1.86), {emisivo:'#fff6dc', luzPropia:0.9});
    if(o.choque !== false){ choca(P, [-0.9, 0, -1.9, 0.9, 0.86, 1.9], F_TODO, mat); choca(P, [-0.76, 0.86, -0.7, 0.76, 1.38, 1.42], F_TODO, mat); }
    return coloca(P, x, y, z, o.giro || 0); }
  /* pared de bolsas de arena a lo largo de x (giro 1: z), de 'largo' y 'filas' */
  function sacos(x, y, z, largo, filas, o){ o = o || {}; const P = Pieza(), bw = 0.6, bh = 0.15, n = Math.max(1, Math.round(largo/bw));
    for(let f=0;f<filas;f++){ const des = (f % 2)*bw/2; for(let i=0;i<n;i++){ const bx = -largo/2 + bw/2 + i*bw + des; if(bx > largo/2 - bw*0.3) continue; pone(P, 'sacos', gCajaB(bw*0.98, bh, 0.36, 0.055, bx, f*bh*0.95, (rnd() - 0.5)*0.03)); } }
    if(o.choque !== false) choca(P, [-largo/2, 0, -0.2, largo/2, filas*bh*0.95 + 0.02, 0.2], F_TODO, 'sacos');
    return coloca(P, x, y, z, o.giro || 0); }
  /* pila de cubiertas */
  function neumaticos(x, y, z, n, o){ o = o || {}; const P = Pieza(); for(let i=0;i<n;i++){ const t = sinIndice(new THREE.TorusGeometry(0.28, 0.1, 6, 12)); t.rotateX(Math.PI/2); t.translate((rnd() - 0.5)*0.05, 0.1 + i*0.2, (rnd() - 0.5)*0.05); pone(P, 'goma', uvM(t)); }
    if(o.choque !== false) choca(P, [-0.38, 0, -0.38, 0.38, n*0.2, 0.38], F_TODO, 'goma'); return coloca(P, x, y, z, 0); }
  /* barrera de hormigón tipo New Jersey a lo largo de x */
  function barrera(x, y, z, largo, o){ o = o || {}; const P = Pieza();
    const g = gExtr([[-0.3, 0], [0.3, 0], [0.3, 0.08], [0.18, 0.3], [0.08, 0.81], [-0.08, 0.81], [-0.18, 0.3], [-0.3, 0.08]], largo - 0.02, {bisel:0.01}); g.rotateY(Math.PI/2); pone(P, 'hormigon_barrera', g);
    if(o.franjas) for(const s of [-1, 1]){ const f = gCaja(largo*0.96, 0.12, 0.01, 0, 0.55, s*0.14); pone(P, 'franjas', f); }
    if(o.choque !== false) choca(P, [-largo/2, 0, -0.3, largo/2, 0.81, 0.3], F_TODO, 'hormigon_barrera');
    return coloca(P, x, y, z, o.giro || 0); }
  function cono(x, y, z){ const P = Pieza(); pone(P, 'naranja', gTorno([[0.2, 0], [0.2, 0.03], [0.14, 0.03], [0.03, 0.72], [0, 0.72]], 10)); pone(P, 'blanco', gCil(0.1, 0.1, 10, 0, 0.35, 0, {r2:0.075, abierto:true}));
    choca(P, [-0.12, 0, -0.12, 0.12, 0.7, 0.12], F_SOLIDA, 'naranja'); return coloca(P, x, y, z, 0); }
  /* viga doble T entre dos puntos alineados a un eje (alto h, ala b) */
  function viga(a, b, o){ o = o || {}; const P = Pieza(), h = o.alto || 0.3, w = o.ala || 0.16, e = o.espesor || 0.018, mat = o.mat || 'acero_naranja';
    const I = [[-w/2, -h/2], [w/2, -h/2], [w/2, -h/2 + e], [e/2, -h/2 + e], [e/2, h/2 - e], [w/2, h/2 - e], [w/2, h/2], [-w/2, h/2], [-w/2, h/2 - e], [-e/2, h/2 - e], [-e/2, -h/2 + e], [-w/2, -h/2 + e]];
    const d = V(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(); if(L < 0.01) return P;
    const g = gExtr(I, L); /* a lo largo de z */ g.translate(0, 0, L/2);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d.clone().normalize()); if(Math.abs(d.y) > 0.99*L){ g.rotateZ(o.giroAlma || 0); }
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); g.translate(a[0], a[1], a[2]); pone(P, mat, g);
    if(o.choque){ const mn = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], mx = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
      const r = Math.max(w, h)/2; bloque(mn[0] - (Math.abs(d.x) > 0.5*L ? 0 : r), mn[1] - (Math.abs(d.y) > 0.5*L ? 0 : r), mn[2] - (Math.abs(d.z) > 0.5*L ? 0 : r), mx[0] + (Math.abs(d.x) > 0.5*L ? 0 : r), mx[1] + (Math.abs(d.y) > 0.5*L ? 0 : r), mx[2] + (Math.abs(d.z) > 0.5*L ? 0 : r), 'metal_gris', {invisible:true, flags:F_TODO}); }
    return coloca(P, 0, 0, 0, 0); }
  /* escombros: piedras y cascotes sueltos (sin choque) */
  function escombros(x, y, z, radio, n, o){ o = o || {}; const P = Pieza();
    for(let i=0;i<n;i++){ const a = rnd()*TAU, d = Math.sqrt(rnd())*radio, s = 0.08 + rnd()*0.22; const g = sinIndice(new THREE.DodecahedronGeometry(s, 0)); g.scale(1, 0.55 + rnd()*0.3, 1); g.rotateY(rnd()*3); g.translate(Math.cos(a)*d, s*0.35, Math.sin(a)*d); pone(P, o.mat || 'piedra', uvM(g)); }
    return coloca(P, x, y, z, 0); }
  /* planta seca en maceta o suelta (sin choque): matas de hojas en abanico */
  function mata(x, y, z, o){ o = o || {}; const P = Pieza(), n = o.hojas || 9, alto = o.alto || 0.8;
    for(let i=0;i<n;i++){ const a = i/n*TAU + rnd()*0.4, inc = 0.35 + rnd()*0.5, l = alto*(0.7 + rnd()*0.5); const tip = [Math.cos(a)*Math.sin(inc)*l, Math.cos(inc)*l, Math.sin(a)*Math.sin(inc)*l], ld = [-Math.sin(a)*0.05, 0, Math.cos(a)*0.05];
      pone(P, o.mat || 'pasto', gCuadro([-ld[0], 0.05, -ld[2]], [ld[0], 0.05, ld[2]], [tip[0] + ld[0]*0.2, tip[1], tip[2] + ld[2]*0.2], [tip[0] - ld[0]*0.2, tip[1], tip[2] - ld[2]*0.2]), {doble:true}); }
    if(o.maceta) pone(P, 'teja', gTorno([[0.2, 0], [0.26, 0.35], [0.28, 0.38], [0, 0.38]], 10));
    return coloca(P, x, y, z, 0); }
  /* poste de luz / servicio con travesaño (cables se cuelgan aparte) */
  function poste(x, y, z, alto, o){ o = o || {}; const P = Pieza(); pone(P, o.mat || 'madera_vieja', gCil(0.12, alto, 8, 0, 0, 0, {r2:0.09}));
    pone(P, o.mat || 'madera_vieja', gCaja(1.4, 0.1, 0.1, 0, alto - 0.6, 0)); for(const s of [-0.55, 0, 0.55]) pone(P, 'blanco', gCil(0.04, 0.1, 6, s, alto - 0.5, 0));
    choca(P, [-0.12, 0, -0.12, 0.12, alto, 0.12], F_TODO, 'madera'); return coloca(P, x, y, z, o.giro || 0); }
  /* ventana: marco, travesaños y vidrio translúcido en un hueco de muro */
  function ventana(eje, p, a0, a1, y0, y1, grosor, o){ o = o || {}; const P = Pieza(), mat = o.marco || 'metal_gris', w = 0.06;
    const B = (a, b, c, d)=> eje === 'x' ? gCaja(b - a, d - c, grosor*0.6, (a + b)/2, c, p) : gCaja(grosor*0.6, d - c, b - a, p, c, (a + b)/2);
    pone(P, mat, B(a0, a1, y0, y0 + w)); pone(P, mat, B(a0, a1, y1 - w, y1)); pone(P, mat, B(a0, a0 + w, y0, y1)); pone(P, mat, B(a1 - w, a1, y0, y1));
    const div = o.divisiones || Math.max(1, Math.round((a1 - a0)/1.2)); for(let i=1;i<div;i++){ const a = a0 + (a1 - a0)*i/div; pone(P, mat, B(a - w/2, a + w/2, y0, y1)); }
    if(o.vidrio !== false){ const q = eje === 'x' ? gCuadro([a0, y0, p], [a1, y0, p], [a1, y1, p], [a0, y1, p], [a0, y0, a1, y0, a1, y1, a0, y1]) : gCuadro([p, y0, a0], [p, y0, a1], [p, y1, a1], [p, y1, a0], [a0, y0, a1, y0, a1, y1, a0, y1]);
      pone(P, o.vidrioMat || 'vidrio', q, {alfa:o.alfaVidrio || 0.28, doble:true}); }
    if(o.choque) { if(eje === 'x') bloque(a0, y0, p - 0.02, a1, y1, p + 0.02, 'vidrio', {invisible:true, flags:F_SOLIDA}); else bloque(p - 0.02, y0, a0, p + 0.02, y1, a1, 'vidrio', {invisible:true, flags:F_SOLIDA}); }
    return coloca(P, 0, 0, 0, 0); }
  /* reja de piso (tapa de ventilación) sobre un hueco: barras cada 5 cm y marco */
  function rejaPiso(x0, z0, x1, z1, y, o){ o = o || {}; const P = Pieza(), mat = o.mat || 'metal_gris'; [x0, x1] = orden(x0, x1); [z0, z1] = orden(z0, z1);
    pone(P, mat, gCaja(x1 - x0, 0.05, 0.05, (x0 + x1)/2, y - 0.05, z0 + 0.025)); pone(P, mat, gCaja(x1 - x0, 0.05, 0.05, (x0 + x1)/2, y - 0.05, z1 - 0.025));
    pone(P, mat, gCaja(0.05, 0.05, z1 - z0, x0 + 0.025, y - 0.05, (z0 + z1)/2)); pone(P, mat, gCaja(0.05, 0.05, z1 - z0, x1 - 0.025, y - 0.05, (z0 + z1)/2));
    for(let xx = x0 + 0.1; xx < x1 - 0.05; xx += 0.08) pone(P, mat, gCaja(0.012, 0.04, z1 - z0 - 0.1, xx, y - 0.045, (z0 + z1)/2));
    if(o.choque) bloque(x0, y - 0.05, z0, x1, y, z1, mat, {invisible:true, flags:F_SOLIDA});
    return coloca(P, 0, 0, 0, 0); }
  /* banco de trabajo con herramientas y cajones */
  function banco(x, y, z, o){ o = o || {}; const P = Pieza(); pone(P, 'madera_vieja', gCajaB(1.8, 0.06, 0.7, 0.01, 0, 0.86, 0));
    for(const [sx, sz] of [[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.3], [0.85, 0.3]]) pone(P, 'metal_gris', gCaja(0.06, 0.86, 0.06, sx, 0, sz)); pone(P, 'metal_gris', gCaja(1.7, 0.03, 0.62, 0, 0.18, 0));
    pone(P, 'metal_azul', gCajaB(0.5, 0.5, 0.6, 0.02, 0.55, 0.3, 0)); pone(P, 'rojo', gCajaB(0.45, 0.2, 0.22, 0.02, -0.4, 0.92, 0.05)); pone(P, 'metal_gris', gCil(0.12, 0.3, 10, 0.1, 0.92, -0.1));
    if(o.choque !== false) choca(P, [-0.92, 0, -0.36, 0.92, 0.92, 0.36], F_TODO, 'madera'); return coloca(P, x, y, z, o.giro || 0); }
  /* armario metálico / tablero eléctrico contra la pared */
  function tablero(x, y, z, o){ o = o || {}; const P = Pieza(), w = o.ancho || 1.2, h = o.alto || 2.0; pone(P, o.mat || 'metal_gris', gCajaB(w, h, 0.5, 0.02, 0, 0, 0));
    pone(P, 'negro', gCaja(0.01, h - 0.2, 0.01, 0, 0.1, 0.251)); for(const s of [-0.1, 0.1]) pone(P, 'cromado', gCaja(0.03, 0.18, 0.03, s, h*0.5, 0.26));
    pone(P, 'amarillo', gCaja(0.3, 0.2, 0.005, -w*0.25, h*0.72, 0.252));
    if(o.luz) pone(P, 'blanco', gCil(0.025, 0.02, 8, w*0.3, h*0.85, 0.25), {emisivo:o.luz, luzPropia:2});
    if(o.choque !== false) choca(P, [-w/2, 0, -0.25, w/2, h, 0.25], F_TODO, 'metal_gris'); return coloca(P, x, y, z, o.giro || 0); }
  return {gCaja, gCajaB, gLosa, gCil, gTorno, gTubo, gBarra, gExtr, gForma, gCuadro, gCable, Pieza, pone, choca, coloca,
    barril, barriles, pallet, cano, baranda, barandaInclinada, alambrado, puerta, equipoAire, cartel, contenedor, tanque, tanqueH, cable, rejilla,
    escaleraMarinera, montacargas, estanteria, luminaria, toldo, arco, auto, sacos, neumaticos, barrera, cono, viga, escombros, mata, poste, ventana, rejaPiso, banco, tablero};
})();
