
/* ====================== manos y brazos en primera persona ======================
   Mano derecha en su marco: la muñeca en el origen, +y hacia el dedo medio, +z sale por el dorso, el pulgar hacia −x.
   La izquierda es la misma espejada en x. Cada mano es una malla con piel sobre 16 huesos (muñeca + 5 dedos × 3); los dedos
   son tubos continuos que se doblan suave en cada nudillo. El brazo (manga) es otra malla con dos huesos y se resuelve con IK. */
const DEDOS = [ /* base (x, y, z) en el dorso de la palma, largos de las tres falanges, radio base y punta, abertura (grados) */
  {n:'indice', b:[-0.029, 0.094, 0.002], L:[0.046, 0.027, 0.022], r:[0.0112, 0.0088], abre:-5},
  {n:'medio', b:[-0.009, 0.098, 0.002], L:[0.051, 0.031, 0.023], r:[0.0117, 0.0091], abre:0},
  {n:'anular', b:[0.011, 0.094, 0.001], L:[0.048, 0.03, 0.022], r:[0.0109, 0.0086], abre:5},
  {n:'menique', b:[0.029, 0.085, 0.0], L:[0.038, 0.022, 0.02], r:[0.0098, 0.0076], abre:12},
];
const PULGAR = {b:[-0.026, 0.024, -0.006], L:[0.046, 0.034, 0.029], r:[0.0135, 0.0098]};
/* poses de los dedos: curvatura 0..1 de cada dedo (índice, medio, anular, meñique) y el pulgar [abrir, oponer, doblar] */
const POSE_MANO = {
  relajada:{d:[0.22, 0.3, 0.36, 0.42], p:[0.35, 0.25, 0.2]},
  abierta:{d:[0.04, 0.04, 0.07, 0.1], p:[0.7, 0.0, 0.0]},
  puno:{d:[0.95, 0.97, 0.98, 0.98], p:[0.2, 0.75, 0.75]},
  pistola:{d:[0.3, 0.84, 0.88, 0.9], p:[0.15, 0.55, 0.3]},       /* índice en el gatillo, el resto envuelve la empuñadura */
  pistola_ext:{d:[0.02, 0.84, 0.88, 0.9], p:[0.15, 0.55, 0.3]},   /* dedo fuera del gatillo, estirado sobre el armazón */
  apoyo:{d:[0.62, 0.7, 0.76, 0.82], p:[0.08, 0.15, 0.08]},       /* la otra mano envolviendo: pulgar hacia adelante */
  guardamano:{d:[0.5, 0.58, 0.64, 0.7], p:[0.45, 0.45, 0.25]},
  cargador:{d:[0.52, 0.58, 0.64, 0.7], p:[0.45, 0.62, 0.35]},
  pinza:{d:[0.55, 0.86, 0.92, 0.94], p:[0.25, 0.85, 0.5]},
  cuchillo:{d:[0.72, 0.84, 0.9, 0.94], p:[0.18, 0.8, 0.55]},
  granada:{d:[0.52, 0.58, 0.62, 0.66], p:[0.45, 0.62, 0.35]},
  anilla:{d:[0.62, 0.9, 0.95, 0.96], p:[0.25, 0.85, 0.55]},
  senalar:{d:[0.04, 0.9, 0.95, 0.96], p:[0.3, 0.8, 0.6]},
  plana:{d:[0.12, 0.14, 0.16, 0.2], p:[0.5, 0.1, 0.1]},
};
function poseMezcla(a, b, t){ const A = typeof a === 'string' ? POSE_MANO[a] : a, B = typeof b === 'string' ? POSE_MANO[b] : b;
  return {d:A.d.map((v, i)=> lerp(v, B.d[i], t)), p:A.p.map((v, i)=> lerp(v, B.p[i], t))}; }
/* ---------- geometría ---------- */
/* tubo continuo por una cadena de huesos: anillos elípticos con pesos que se mezclan cerca de cada articulación */
function tuboCadena(puntos, radios, huesos, lados, rel, datos, color, opt){
  opt = opt || {}; const P = datos.P, N = datos.N, UV = datos.UV, SI = datos.SI, SW = datos.SW, C = datos.C, I = datos.I;
  const anillos = [];
  /* muestreo a lo largo: 5 anillos por tramo */
  for(let s=0;s<puntos.length - 1;s++){ const a = puntos[s], b = puntos[s+1], ns = s === puntos.length - 2 ? 6 : 5;
    for(let k=0;k<ns;k++){ const t = k/5; anillos.push({p:a.clone().lerp(b, Math.min(1, t)), seg:s, t:Math.min(1, t), r:lerp(radios[s], radios[s+1], Math.min(1, t))}); } }
  const base0 = P.length/3;
  anillos.forEach((an, i)=>{ const s = an.seg, a = puntos[s], b = puntos[s+1], dir = b.clone().sub(a).normalize();
    let ref = Math.abs(dir.z) < 0.9 ? V3(0, 0, 1) : V3(1, 0, 0); const ex = ref.clone().cross(dir).normalize(), ez = dir.clone().cross(ex).normalize();
    /* nudillo: un poco más grueso justo en la articulación */
    const nud = (an.t < 0.08 && s > 0) || (an.t > 0.92) ? 1.07 : 1;
    /* peso: cerca del comienzo del tramo se reparte con el hueso anterior */
    const hb = huesos[s], hp = s > 0 ? huesos[s-1] : huesos[0];
    const mezcla = s > 0 ? suave(lim(an.t/0.35, 0, 1))*0.5 + 0.5 : 1;
    for(let j=0;j<lados;j++){ const ang = j/lados*TAU, cx = Math.cos(ang), cz = Math.sin(ang);
      const rx = an.r*(rel ? rel[0] : 1.08)*nud, rz = an.r*(rel ? rel[1] : 0.9)*nud*(opt.aplana && cz < 0 ? opt.aplana : 1);
      const off = ex.clone().multiplyScalar(cx*rx).add(ez.clone().multiplyScalar(cz*rz));
      if(opt.ruido){ const k = 1 + opt.ruido(an.p.y, ang, an); off.multiplyScalar(k); }
      const p = an.p.clone().add(off); P.push(p.x, p.y, p.z); const n = off.clone().normalize(); N.push(n.x, n.y, n.z);
      UV.push(j/lados, (an.p.y)*(opt.uvK || 20));
      SI.push(hb, hp, 0, 0); SW.push(mezcla, 1 - mezcla, 0, 0);
      const cc = typeof color === 'function' ? color(an, j) : color; C.push(cc[0], cc[1], cc[2]); } });
  for(let i=0;i<anillos.length - 1;i++) for(let j=0;j<lados;j++){ const a = base0 + i*lados + j, b = base0 + i*lados + (j + 1)%lados, c = base0 + (i + 1)*lados + j, d = base0 + (i + 1)*lados + (j + 1)%lados; I.push(a, c, b, b, c, d); }
  /* punta cerrada */
  if(opt.punta !== false){ const ult = anillos[anillos.length - 1], pa = puntos[puntos.length - 2], pb = puntos[puntos.length - 1], dir = pb.clone().sub(pa).normalize();
    const tip = pb.clone().addScaledVector(dir, ult.r*0.85); const it = P.length/3; P.push(tip.x, tip.y, tip.z); N.push(dir.x, dir.y, dir.z); UV.push(0.5, tip.y*(opt.uvK || 20));
    const hb = huesos[huesos.length - 1]; SI.push(hb, 0, 0, 0); SW.push(1, 0, 0, 0); const cc = typeof color === 'function' ? color(ult, 0) : color; C.push(cc[0], cc[1], cc[2]);
    const last = base0 + (anillos.length - 1)*lados; for(let j=0;j<lados;j++) I.push(last + j, it, last + (j + 1)%lados); }
  if(opt.base){ const pa = puntos[0], it = P.length/3, dir = puntos[1].clone().sub(pa).normalize(); P.push(pa.x - dir.x*0.002, pa.y - dir.y*0.002, pa.z - dir.z*0.002); N.push(-dir.x, -dir.y, -dir.z); UV.push(0.5, 0); SI.push(huesos[0], 0, 0, 0); SW.push(1, 0, 0, 0); const cc = typeof color === 'function' ? color(anillos[0], 0) : color; C.push(cc[0], cc[1], cc[2]);
    for(let j=0;j<lados;j++) I.push(base0 + (j + 1)%lados, it, base0 + j); }
}
/* sólido rígido de un hueso (palma, protecciones): geometría de three ya ubicada, pegada al hueso h */
function rigido(geo, h, datos, color){ const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); const p = g.attributes.position, n = g.attributes.normal, b0 = datos.P.length/3;
  for(let i=0;i<p.count;i++){ datos.P.push(p.getX(i), p.getY(i), p.getZ(i)); datos.N.push(n.getX(i), n.getY(i), n.getZ(i)); datos.UV.push(p.getX(i)*20, p.getY(i)*20); datos.SI.push(h, 0, 0, 0); datos.SW.push(1, 0, 0, 0); datos.C.push(color[0], color[1], color[2]); }
  for(let i=0;i<p.count;i++) datos.I.push(b0 + i); }
/* palma continua desde el puño del guante hasta los nudillos: sección redondeada que cambia con la altura, eminencia del pulgar
   del lado de la palma y, en el guante CT, la protección de nudillos moldeada en el dorso (un relieve, no una pieza pegada).
   Devuelve también un color por vértice (la protección más oscura y brillante, el puño en otro tono). */
function palmaGeo(estilo, cols){
  const pasos = 16, lados = 26, pos = [], col = [], idx = [], ct = estilo !== 't';
  const secc = [ /* y, ancho, grueso */ [-0.035, 0.062, 0.043], [-0.024, 0.062, 0.043], [-0.012, 0.06, 0.041], [0.0, 0.06, 0.04], [0.02, 0.066, 0.034], [0.045, 0.08, 0.031], [0.07, 0.087, 0.029], [0.092, 0.088, 0.027], [0.104, 0.08, 0.024] ];
  const enY = t=>{ const y = lerp(-0.035, 0.104, t); let i = 0; while(i < secc.length - 2 && secc[i+1][0] < y) i++; const a = secc[i], b = secc[i+1], k = suave(lim((y - a[0])/(b[0] - a[0]), 0, 1)); return [y, lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; };
  for(let k=0;k<=pasos;k++){ const [y, ancho, grueso] = enY(k/pasos);
    for(let j=0;j<lados;j++){ const a = j/lados*TAU, c = Math.cos(a), s2 = Math.sin(a);
      const e = y < 0.005 ? 2.1 : 2.7, sx = Math.sign(c)*Math.pow(Math.abs(c), 2/e), sz = Math.sign(s2)*Math.pow(Math.abs(s2), 2/e);
      let x = sx*ancho/2, z = sz*grueso/2, tono = y < 0.002 ? cols.puno : cols.guante;
      if(x < 0 && z < 0){ const k2 = Math.exp(-Math.pow((y - 0.035)/0.03, 2))*Math.max(0, -sx)*Math.max(0, -sz); z -= 0.01*k2; x -= 0.007*k2; }
      if(z > 0) z += 0.003*Math.cos(x/ancho*Math.PI);
      if(ct && z > 0){ const kn = Math.exp(-Math.pow((y - 0.086)/0.013, 2))*Math.pow(Math.max(0, sz), 0.6)*(Math.abs(x) < ancho*0.47 ? 1 : 0.3);
        z += 0.0075*kn; if(kn > 0.35) tono = cols.casco; }
      /* abrojo: una banda levantada en el puño */
      if(y > -0.03 && y < -0.018 && z > 0){ z += 0.002; tono = cols.abrojo; }
      pos.push(x, y, z); col.push(tono[0], tono[1], tono[2]); } }
  for(let k=0;k<pasos;k++) for(let j=0;j<lados;j++){ const a = k*lados + j, b = k*lados + (j + 1)%lados, c = (k + 1)*lados + j, d = (k + 1)*lados + (j + 1)%lados; idx.push(a, c, b, b, c, d); }
  /* tapa de abajo (la manga la tapa, pero se cierra igual) */
  const cen = pos.length/3; pos.push(0, -0.035, 0); col.push(cols.puno[0], cols.puno[1], cols.puno[2]); for(let j=0;j<lados;j++) idx.push(cen, j, (j + 1)%lados);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/* ---------- construir una mano ---------- */
const PIEL = [0.62, 0.42, 0.31];
function mallaMano(lado, estilo){
  const esp = lado === 'i' ? -1 : 1, datos = {P:[], N:[], UV:[], SI:[], SW:[], C:[], I:[]};
  const huesos = []; const raiz = new THREE.Bone(); raiz.name = 'mano'; huesos.push(raiz);
  const cols = estilo === 't' ? {guante:[0.16, 0.12, 0.075], puno:[0.1, 0.08, 0.05], casco:[0.12, 0.09, 0.06], abrojo:[0.18, 0.15, 0.1]}
                                : {guante:[0.018, 0.018, 0.02], puno:[0.012, 0.012, 0.014], casco:[0.006, 0.006, 0.007], abrojo:[0.03, 0.03, 0.033]};
  const guante = cols.guante;
  /* dedos */
  const cadenas = [];
  const armaCadena = (base, dirBase, largos, radios, nombre, colorF)=>{
    const ids = []; let padre = raiz, pos = base.clone(), dir = dirBase.clone(); const pts = [pos.clone()];
    for(let i=0;i<3;i++){ const b = new THREE.Bone(); b.name = nombre + i; b.position.copy(i === 0 ? pos : V3(0, largos[i-1], 0)); if(i === 0){ b.quaternion.setFromUnitVectors(V3(0, 1, 0), dir); } padre.add(b); huesos.push(b); ids.push(huesos.length - 1); padre = b;
      pos = pos.clone().addScaledVector(dir, largos[i]); pts.push(pos.clone()); }
    cadenas.push({ids, pts}); const rs = [radios[0]*1.05, radios[0], lerp(radios[0], radios[1], 0.5), radios[1]];
    tuboCadena(pts, rs, ids, 10, [1.08, 0.9], datos, colorF, {uvK:30, aplana:0.9, ruido:estilo !== 't' ? (y, a, an)=> (an && an.seg === 0 && an.t > 0.25 && an.t < 0.8 && Math.sin(a) > 0.2 ? 0.16*Math.sin(a) : 0) : null});
    return ids; };
  const colDedo = (idxDedo)=> (an)=>{ if(estilo === 't' && an.seg >= 1) return PIEL; return guante; };
  const idsDedos = DEDOS.map((d, k)=>{ const ab = d.abre*GRAD*esp; const dir = V3(Math.sin(ab), Math.cos(ab), 0); return armaCadena(V3(d.b[0]*esp, d.b[1], d.b[2]), dir, d.L, d.r, d.n, colDedo(k)); });
  /* pulgar: sale del costado de la palma, hacia adelante-afuera y hacia la palma */
  const dp = V3(-0.62*esp, 0.72, -0.3).normalize();
  const idsPulgar = armaCadena(V3(PULGAR.b[0]*esp, PULGAR.b[1], PULGAR.b[2]), dp, PULGAR.L, PULGAR.r, 'pulgar', (an)=> (estilo === 't' && an.seg >= 2) ? PIEL : guante);
  /* palma con el puño y la protección de nudillos (un solo tubo moldeado) */
  const pal = palmaGeo(estilo, cols); if(esp < 0){ pal.scale(-1, 1, 1); const ix = pal.index.array; for(let i=0;i<ix.length;i+=3){ const t = ix[i+1]; ix[i+1] = ix[i+2]; ix[i+2] = t; } pal.computeVertexNormals(); }
  /* puntos de la cara de la palma (para apoyarla contra lo que agarra) */
  const palma = []; { const pp = pal.attributes.position; for(let i=0;i<pp.count;i+=2){ const y = pp.getY(i), z = pp.getZ(i); if(z < -0.006 && y > -0.015 && y < 0.1) palma.push([pp.getX(i), y, z]); } }
  { const g2 = pal.toNonIndexed(); g2.computeVertexNormals(); const p = g2.attributes.position, n = g2.attributes.normal, c = g2.attributes.color, b0 = datos.P.length/3;
    for(let i=0;i<p.count;i++){ datos.P.push(p.getX(i), p.getY(i), p.getZ(i)); datos.N.push(n.getX(i), n.getY(i), n.getZ(i)); datos.UV.push(p.getX(i)*30, p.getY(i)*30); datos.SI.push(0, 0, 0, 0); datos.SW.push(1, 0, 0, 0); datos.C.push(c.getX(i), c.getY(i), c.getZ(i)); datos.I.push(b0 + i); } }
  /* malla con piel */
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(datos.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(datos.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(datos.UV, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(datos.SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(datos.SW, 4)); g.setAttribute('color', new THREE.Float32BufferAttribute(datos.C, 3));
  g.setIndex(datos.I); g.computeVertexNormals();
  const man = manDe('tex', 'cuero_guante'), tex = man && ARCH['tex/cuero_guante/albedo'] ? texAsset('tex/cuero_guante/normal', {normal:true}) : null;
  const mat = new THREE.MeshStandardMaterial({vertexColors:true, roughness:estilo === 't' ? 0.74 : 0.5, metalness:0.0, skinning:true, envMap:entornoArmas(), envMapIntensity:estilo === 't' ? 0.5 : 0.7, normalMap:tex || null, normalScale:new THREE.Vector2(0.5, 0.5)});
  const malla = new THREE.SkinnedMesh(g, mat); malla.frustumCulled = false;
  const esq = new THREE.Skeleton(huesos); malla.add(raiz); malla.updateMatrixWorld(true); malla.bind(esq);
  return {malla, raiz, huesos, dedos:idsDedos.map(ids=> ids.map(i=> huesos[i])), pulgar:idsPulgar.map(i=> huesos[i]), esp, reposo:huesos.map(h=> h.quaternion.clone()), palma, caps:[]};
}
/* aplicar una pose de dedos: cada dedo se cierra hacia la palma (rotación en x local; el pulgar gira aparte) */
function aplicarPoseMano(M, pose){
  const Q = new THREE.Quaternion(), E = new THREE.Euler();
  M.dedos.forEach((cad, k)=>{ const c = pose.d[k], rs = [c*1.48, c*1.66, c*1.12];   /* 85°, 95°, 64° a curvatura 1 */
    cad.forEach((h, i)=>{ const q0 = i === 0 ? M.reposo[M.huesos.indexOf(h)] : null; E.set(-rs[i], 0, 0); Q.setFromEuler(E); if(q0) h.quaternion.copy(q0).multiply(Q); else h.quaternion.copy(Q); }); });
  const [ab, op, fl] = pose.p, h0 = M.pulgar[0], q0 = M.reposo[M.huesos.indexOf(h0)];
  /* el metacarpiano del pulgar: se abre (z) y se opone girando hacia la palma (x y y) */
  E.set(-op*0.9 - fl*0.2, op*0.55*M.esp, (ab - 0.3)*0.9*M.esp, 'YXZ'); Q.setFromEuler(E); h0.quaternion.copy(q0).multiply(Q);
  E.set(-fl*0.95, 0, 0); M.pulgar[1].quaternion.setFromEuler(E);
  E.set(-fl*1.1, 0, 0); M.pulgar[2].quaternion.setFromEuler(E);
}
/* ---------- agarre: cada falange se cierra hasta tocar lo que agarra ----------
   Los volúmenes (vol() en c4a.js) se evalúan como distancia firmada en su propio marco; una matriz por volumen y por cuadro
   lleva los puntos del marco de la mano al del volumen. Cada falange gira (desde la pose pedida como tope) hasta quedar a
   HOLG de la superficie: así los dedos envuelven la empuñadura, el guardamano o el cargador que la animación les acerque. */
const HOLG = 0.0007;
function sdPoli(u, v, P){ let d = Infinity, s = 1;
  for(let i=0, j=P.length - 1; i<P.length; j=i++){ const pi = P[i], pj = P[j], ex = pj[0] - pi[0], ey = pj[1] - pi[1], wx = u - pi[0], wy = v - pi[1];
    const t = lim((wx*ex + wy*ey)/(ex*ex + ey*ey || 1e-12), 0, 1), bx = wx - ex*t, by = wy - ey*t, dd = bx*bx + by*by; if(dd < d) d = dd;
    const c1 = v >= pi[1], c2 = v < pj[1], c3 = ex*wy > ey*wx; if((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s; }
  return s*Math.sqrt(d); }
function sdVol(o, x, y, z){
  if(o.t === 'perfil'){ let d2 = sdPoli(-z, y, o.P); if(o.H) for(const h of o.H) d2 = Math.max(d2, -sdPoli(-z, y, h)); const dx = Math.abs(x - (o.x0 || 0)) - o.hw;
    return Math.min(Math.max(d2, dx), 0) + Math.hypot(Math.max(d2, 0), Math.max(dx, 0)); }
  if(o.t === 'caja'){ const qx = Math.abs(x - o.c[0]) - o.h[0] + o.r, qy = Math.abs(y - o.c[1]) - o.h[1] + o.r, qz = Math.abs(z - o.c[2]) - o.h[2] + o.r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - o.r; }
  const ax = o.a[0], ay = o.a[1], az = o.a[2], bx = o.b[0] - ax, by = o.b[1] - ay, bz = o.b[2] - az, px = x - ax, py = y - ay, pz = z - az;
  const t = lim((px*bx + py*by + pz*bz)/(bx*bx + by*by + bz*bz || 1e-12), 0, 1); return Math.hypot(px - bx*t, py - by*t, pz - bz*t) - o.r;
}
/* esfera que envuelve el volumen (para saltearlo cuando está lejos) */
function cotaVol(o){
  if(o.t === 'perfil'){ let u0 = 1, u1 = -1, v0 = 1, v1 = -1; for(const p of o.P){ u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
    o.bc = [o.x0 || 0, (v0 + v1)/2, -(u0 + u1)/2]; o.br = Math.hypot(o.hw, (u1 - u0)/2, (v1 - v0)/2); }
  else if(o.t === 'caja'){ o.bc = o.c; o.br = Math.hypot(o.h[0], o.h[1], o.h[2]); }
  else { o.bc = [(o.a[0] + o.b[0])/2, (o.a[1] + o.b[1])/2, (o.a[2] + o.b[2])/2]; o.br = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1], o.b[2] - o.a[2])/2 + o.r; }
}
function prepVols(vols, malla){ for(const v of vols){ if(v.br === undefined) cotaVol(v); if(!v._m) v._m = new THREE.Matrix4(); v._m.copy(v.obj.matrixWorld).invert().multiply(malla.matrixWorld); } }
function sdMano(vols, x, y, z){ let d = 1;
  for(let k=0;k<vols.length;k++){ const v = vols[k], e = v._m.elements, X = e[0]*x + e[4]*y + e[8]*z + e[12], Y = e[1]*x + e[5]*y + e[9]*z + e[13], Z = e[2]*x + e[6]*y + e[10]*z + e[14];
    const c = v.bc, lb = Math.hypot(X - c[0], Y - c[1], Z - c[2]) - v.br; if(lb >= d) continue; const dv = sdVol(v, X, Y, Z); if(dv < d) d = dv; }
  return d; }
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _EJE_X = V3(1, 0, 0), _dirF = V3();
/* holgura de una falange que sale de J con orientación R (su +y), largo L y radios r0→r1 */
function holgura(vols, J, R, L, r0, r1, punta){ _dirF.set(0, 1, 0).applyQuaternion(R); let m = 1;
  for(let s=1;s<=4;s++){ const t = s/4, d = sdMano(vols, J.x + _dirF.x*L*t, J.y + _dirF.y*L*t, J.z + _dirF.z*L*t) - lerp(r0, r1, t); if(d < m) m = d; }
  if(punta){ const d = sdMano(vols, J.x + _dirF.x*(L + r1*0.5), J.y + _dirF.y*(L + r1*0.5), J.z + _dirF.z*(L + r1*0.5)) - r1*0.5; if(d < m) m = d; }
  return m; }
/* cierra una cadena de tres falanges: cada una gira hasta 'maxs[i]' o hasta tocar; devuelve los ángulos y deja las cápsulas */
function cerrarCadena(vols, base, q0, L, R, maxs, out, caps){
  const J = base.clone(), Rq = q0.clone();
  for(let i=0;i<3;i++){ const r0 = R[i]*0.9, r1 = R[i+1]*0.9, mx = maxs[i];
    const prueba = th=> holgura(vols, J, _qa.copy(Rq).multiply(_qb.setFromAxisAngle(_EJE_X, -th)), L[i], r0, r1, i === 2);
    let th = mx;
    if(mx > 0 && prueba(mx) < HOLG){
      if(prueba(0) < HOLG) th = 0;
      else { let lo = 0, hi = mx; for(let s=1;s<=6;s++){ const t = mx*s/6; if(prueba(t) < HOLG){ hi = t; break; } lo = t; }
        for(let b=0;b<5;b++){ const m = (lo + hi)/2; if(prueba(m) < HOLG) hi = m; else lo = m; } th = lo; } }
    out[i] = th; Rq.multiply(_qb.setFromAxisAngle(_EJE_X, -th));
    const J2 = J.clone().addScaledVector(V3(0, 1, 0).applyQuaternion(Rq), L[i]); caps.push({a:[J.x, J.y, J.z], b:[J2.x, J2.y, J2.z], r:(R[i] + R[i+1])/2}); J.copy(J2); }
}
/* pose de dedos con contacto: 'vols' vacío = la pose tal cual */
function ponerDedos(M, pose, vols){
  if(!vols || !vols.length){ aplicarPoseMano(M, pose); M.caps.length = 0; return; }
  M.malla.updateMatrixWorld(true); prepVols(vols, M.malla); M.caps.length = 0;
  const out = [0, 0, 0], Q = new THREE.Quaternion(), E = new THREE.Euler();
  M.dedos.forEach((cad, k)=>{ const d = DEDOS[k], c = pose.d[k], h0 = cad[0], q0 = M.reposo[M.huesos.indexOf(h0)];
    const R = [d.r[0]*1.05, d.r[0], lerp(d.r[0], d.r[1], 0.5), d.r[1]];
    cerrarCadena(vols, h0.position, q0, d.L, R, [c*1.48, c*1.66, c*1.12], out, M.caps);
    (M.curl || (M.curl = []))[k] = out.map(v=> +(v/GRAD).toFixed(0));
    cad.forEach((h, i)=>{ Q.setFromAxisAngle(_EJE_X, -out[i]); if(i === 0) h.quaternion.copy(q0).multiply(Q); else h.quaternion.copy(Q); }); });
  /* pulgar: el metacarpiano sale de la pose; las dos falanges se cierran con contacto */
  const [ab, op, fl] = pose.p, h0 = M.pulgar[0], q0 = M.reposo[M.huesos.indexOf(h0)];
  E.set(-op*0.9 - fl*0.2, op*0.55*M.esp, (ab - 0.3)*0.9*M.esp, 'YXZ'); Q.setFromEuler(E); h0.quaternion.copy(q0).multiply(Q);
  const q1 = h0.quaternion.clone(), b1 = h0.position.clone().addScaledVector(V3(0, 1, 0).applyQuaternion(q1), PULGAR.L[0]);
  const Rp = [PULGAR.r[0], PULGAR.r[0], lerp(PULGAR.r[0], PULGAR.r[1], 0.5), PULGAR.r[1]];
  /* se usa la cadena de tres con la primera falange fija (tope 0) y las otras dos con tope de la pose */
  const outP = [0, 0, 0]; cerrarCadena(vols, b1, q1, [PULGAR.L[1], PULGAR.L[2], 0.0001], [Rp[1], Rp[2], Rp[3], Rp[3]], [fl*0.95, fl*1.1, 0], outP, M.caps); M.caps.pop();
  M.pulgar[1].quaternion.setFromAxisAngle(_EJE_X, -outP[0]); M.pulgar[2].quaternion.setFromAxisAngle(_EJE_X, -outP[1]);
}
/* apoya la palma: corre la mano por su −z (hacia la palma) hasta que toque, con tope de 1,5 cm */
function apoyarPalma(M, vols){ let mov = 0;
  for(let it=0;it<2;it++){ M.malla.updateMatrixWorld(true); prepVols(vols, M.malla); let d = 1; for(const p of M.palma){ const e = sdMano(vols, p[0], p[1], p[2]); if(e < d) d = e; }
    if(d > 0.03) break; const paso = lim(d - 0.0012, -0.015 - mov, 0.015 - mov); mov += paso; M.malla.position.addScaledVector(V3(0, 0, -1).applyQuaternion(M.malla.quaternion), paso); }
  M.malla.updateMatrixWorld(true); return mov; }
/* la mano como volumen para la otra (la de apoyo envuelve los dedos de la que empuña): falanges y palma */
function volsDeMano(M){ const out = M._vols || (M._vols = []); out.length = 0;
  for(const c of M.caps) out.push({t:'cap', a:c.a, b:c.b, r:c.r, obj:M.malla});
  out.push({t:'caja', c:[0, 0.045, 0.0], h:[0.04, 0.052, 0.016], r:0.012, obj:M.malla}); return out; }
/* ---------- manga: tubo con pliegues sobre dos huesos (hombro → codo → muñeca, en reposo a lo largo de +y) ---------- */
const BRAZO = {a:0.31, b:0.285};
function mallaBrazo(lado, estilo){
  const esp = lado === 'i' ? -1 : 1, datos = {P:[], N:[], UV:[], SI:[], SW:[], C:[], I:[]};
  /* hombro → codo → puño (el puño gira a 3,5 cm de la muñeca para seguir a la mano) */
  const P2 = BRAZO.b - 0.045;
  const h0 = new THREE.Bone(), h1 = new THREE.Bone(), h2 = new THREE.Bone(); h0.name = 'brazo'; h1.name = 'antebrazo'; h2.name = 'puno';
  h1.position.set(0, BRAZO.a, 0); h2.position.set(0, P2, 0); h0.add(h1); h1.add(h2);
  const tela = estilo === 't' ? [0.26, 0.24, 0.15] : [0.1, 0.13, 0.24];
  const pts = [V3(0, -0.12, 0), V3(0, BRAZO.a, 0), V3(0, BRAZO.a + P2, 0), V3(0, BRAZO.a + BRAZO.b + 0.02, 0)];
  const pliegue = (y, a)=> 0.06*Math.sin(y*38 + a*3)*Math.exp(-Math.pow((y - BRAZO.a)/0.07, 2)) + 0.025*Math.sin(y*61 + a*5 + 1.3)*Math.sin(a*2 + y*9) + (y > BRAZO.a + BRAZO.b - 0.025 ? 0.1 : 0);
  tuboCadena(pts, [0.062, 0.05, 0.043, 0.041], [0, 1, 2], 16, [1.0, 0.92], datos, tela, {ruido:pliegue, uvK:6, punta:false, base:true});
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(datos.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(datos.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(datos.UV, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(datos.SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(datos.SW, 4)); g.setAttribute('color', new THREE.Float32BufferAttribute(datos.C, 3));
  g.setIndex(datos.I); g.computeVertexNormals();
  const id = estilo === 't' ? 'tela_t' : 'tela_ct', man = manDe('tex', id);
  const mapa = man && ARCH['tex/' + id + '/albedo'] ? texAsset('tex/' + id + '/albedo', {srgb:true, color:man.color_medio}) : null, nor = man && ARCH['tex/' + id + '/normal'] ? texAsset('tex/' + id + '/normal', {normal:true}) : null;
  const mat = new THREE.MeshStandardMaterial({vertexColors:!mapa, map:mapa, color:mapa ? (estilo === 't' ? lin('#a39c7a') : lin('#7f8fb8')) : 0xffffff, normalMap:nor, roughness:0.88, metalness:0, skinning:true, envMap:entornoArmas(), envMapIntensity:0.5});
  if(mapa) mapa.repeat.set(3, 3);
  const malla = new THREE.SkinnedMesh(g, mat); malla.frustumCulled = false; malla.add(h0); malla.updateMatrixWorld(true); malla.bind(new THREE.Skeleton([h0, h1, h2]));
  return {malla, h0, h1, h2, esp};
}
/* IK de dos huesos: hombro S, muñeca W, codo hacia 'polo'; devuelve el codo */
function ik2(S, W, a, b, polo, out){
  const d = W.clone().sub(S); let L = d.length(); const Lc = lim(L, Math.abs(a - b) + 1e-3, a + b - 1e-3); const dir = d.normalize();
  const ca = (a*a + Lc*Lc - b*b)/(2*a*Lc), sa = Math.sqrt(Math.max(0, 1 - ca*ca));
  const p = polo.clone().sub(S); p.addScaledVector(dir, -p.dot(dir)); if(p.lengthSq() < 1e-8) p.set(0, -1, 0); p.normalize();
  return (out || V3()).copy(S).addScaledVector(dir, a*ca).addScaledVector(p, a*sa);
}
/* orientar un hueso: su +y hacia 'hacia', su +z lo más parecido a 'ref' */
function baseHueso(desde, hacia, ref, q){
  const y = hacia.clone().sub(desde).normalize(), x = ref.clone().cross(y); if(x.lengthSq() < 1e-8) x.set(1, 0, 0); x.normalize(); const z = x.clone().cross(y).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z); return (q || new THREE.Quaternion()).setFromRotationMatrix(m);
}
