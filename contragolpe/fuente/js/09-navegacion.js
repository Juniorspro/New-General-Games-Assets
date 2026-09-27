
/* ====================== navegación de los bots ======================
   Grilla de piso caminable en capas (celdas de 0,5 m): en cada columna se buscan todos los pisos con rayos hacia abajo (un rayo
   que nace adentro de una caja la ignora, así se pasa de un piso al de abajo), y queda un nodo donde entra el cuerpo parado.
   Vecinos en 8 direcciones si el escalón es chico y el paso está libre (sin cortar esquinas); bajadas de hasta 3 m (una sola
   mano) y saltos de hasta 0,85 m (con agachado en el aire, como en CS). A* con montículo binario y suavizado por línea libre. */
const NAV = {cel:0.5, x0:0, z0:0, nx:0, nz:0, n:0, px:null, py:null, pz:null, col:null, colN:null, ady:null, adyI:null, costo:null, tipo:null, listo:false, ms:0};
const NAV_R = 0.34, NAV_ALTO = 1.78, NAV_ESC = 0.47, NAV_SALTO = 1.3, NAV_CAIDA = 3.2;
function armarNav(){
  const t0 = performance.now(), C = NAV.cel; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, yTop = -1e9;
  for(let i=0;i<MUNDO.n;i++){ if(!(MUNDO.flags[i] & F_SOLIDA)) continue; x0 = Math.min(x0, MUNDO.mn[i*3]); z0 = Math.min(z0, MUNDO.mn[i*3+2]); x1 = Math.max(x1, MUNDO.mx[i*3]); z1 = Math.max(z1, MUNDO.mx[i*3+2]); yTop = Math.max(yTop, MUNDO.mx[i*3+1]); }
  NAV.x0 = x0; NAV.z0 = z0; NAV.nx = Math.ceil((x1 - x0)/C); NAV.nz = Math.ceil((z1 - z0)/C);
  const px = [], py = [], pz = [], colInicio = new Int32Array(NAV.nx*NAV.nz + 1);
  /* pisos por columna */
  for(let j=0;j<NAV.nz;j++) for(let i=0;i<NAV.nx;i++){ colInicio[j*NAV.nx + i] = px.length;
    const x = x0 + (i + 0.5)*C, z = z0 + (j + 0.5)*C; let y = yTop + 1;
    for(let capa=0;capa<5;capa++){ const t = rayo(x, y, z, 0, -1, 0, y + 60, F_SOLIDA, false, -1); if(t < 0) break;
      /* altura libre desde un escalón para arriba: lo más bajo que eso lo sube el cuerpo solo */
      const yp = y - t; if(RAYO.eje === 1 && RAYO.ny > 0 && libre(x - NAV_R, yp + NAV_ESC, z - NAV_R, x + NAV_R, yp + NAV_ALTO, z + NAV_R)){ px.push(x); py.push(yp); pz.push(z); }
      y = yp - 0.02; } }
  colInicio[NAV.nx*NAV.nz] = px.length;
  const n = px.length; NAV.n = n; NAV.px = Float32Array.from(px); NAV.py = Float32Array.from(py); NAV.pz = Float32Array.from(pz); NAV.col = colInicio;
  NAV.colDe = new Int32Array(n); for(let c=0;c<NAV.nx*NAV.nz;c++) for(let k=colInicio[c];k<colInicio[c+1];k++) NAV.colDe[k] = c;
  /* vecinos */
  const ady = [], adyI = new Int32Array(n + 1), costo = [], tipo = [];
  const DIR = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const pasa = (a, b, yA, yB)=>{ const y = Math.max(yA, yB) + NAV_ESC, xm = (NAV.px[a] + NAV.px[b])/2, zm = (NAV.pz[a] + NAV.pz[b])/2; return libre(xm - NAV_R, y, zm - NAV_R, xm + NAV_R, Math.max(yA, yB) + NAV_ALTO, zm + NAV_R); };
  const enCol = (i, j, y, dmax)=>{ if(i < 0 || j < 0 || i >= NAV.nx || j >= NAV.nz) return -1; const c = j*NAV.nx + i; let mejor = -1, md = 1e9;
    for(let k=colInicio[c];k<colInicio[c+1];k++){ const d = NAV.py[k] - y; if(d > dmax || d < -NAV_CAIDA) continue; const ad = Math.abs(d); if(ad < md){ md = ad; mejor = k; } } return mejor; };
  for(let a=0;a<n;a++){ adyI[a] = ady.length; const c = NAV.colDe[a], i = c % NAV.nx, j = (c - i)/NAV.nx, ya = NAV.py[a];
    for(const [di, dj] of DIR){ const b = enCol(i + di, j + dj, ya, NAV_SALTO); if(b < 0) continue; const dy = NAV.py[b] - ya;
      if(di && dj){ /* diagonal: los dos lados rectos tienen que ser caminables a una altura parecida */ const s1 = enCol(i + di, j, ya, NAV_ESC), s2 = enCol(i, j + dj, ya, NAV_ESC); if(s1 < 0 || s2 < 0) continue; }
      if(dy > NAV_ESC){ if(!pasa(a, b, ya, NAV.py[b])) continue; ady.push(b); costo.push(C*(di && dj ? 1.414 : 1)*3.2 + 0.6); tipo.push(2); continue; }
      if(dy < -NAV_ESC){ /* bajada: el cuerpo tiene que poder asomarse al borde */ const xm = NAV.px[b], zm = NAV.pz[b]; if(!libre(xm - NAV_R, NAV.py[b] + 0.06, zm - NAV_R, xm + NAV_R, ya + NAV_ALTO, zm + NAV_R)) continue;
        ady.push(b); costo.push(C*(di && dj ? 1.414 : 1)*1.6 - dy*0.2); tipo.push(3); continue; }
      if(!pasa(a, b, ya, NAV.py[b])) continue; ady.push(b); costo.push(C*(di && dj ? 1.414 : 1)); tipo.push(0); } }
  adyI[n] = ady.length; NAV.ady = Int32Array.from(ady); NAV.adyI = adyI; NAV.costo = Float32Array.from(costo); NAV.tipo = Uint8Array.from(tipo);
  /* cerca de paredes cuesta un poco más (los bots no rozan las esquinas) */
  NAV.pen = new Float32Array(n); for(let a=0;a<n;a++){ const g = adyI[a+1] - adyI[a]; NAV.pen[a] = g < 8 ? 0.35*(8 - g)/8 : 0; }
  NAV.g = new Float32Array(n); NAV.f = new Float32Array(n); NAV.padre = new Int32Array(n); NAV.marca = new Uint32Array(n); NAV.cerrado = new Uint32Array(n); NAV.vuelta = 0;
  NAV.heap = new Int32Array(n + 8); NAV.listo = true; NAV.ms = Math.round(performance.now() - t0);
  return NAV;
}
/* el nodo más cercano a un punto (misma columna o vecinas, piso por debajo de los pies + 0,6 m) */
function navNodo(x, y, z){
  if(!NAV.listo) return -1; const C = NAV.cel, ci = Math.floor((x - NAV.x0)/C), cj = Math.floor((z - NAV.z0)/C); let mejor = -1, md = 1e9;
  for(let r=0;r<=3 && mejor < 0;r++) for(let dj=-r;dj<=r;dj++) for(let di=-r;di<=r;di++){ if(Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = ci + di, j = cj + dj; if(i < 0 || j < 0 || i >= NAV.nx || j >= NAV.nz) continue;
    const c = j*NAV.nx + i; for(let k=NAV.col[c];k<NAV.col[c+1];k++){ const dy = NAV.py[k] - y; if(dy > 0.6) continue; const d = Math.hypot(NAV.px[k] - x, NAV.pz[k] - z) + Math.max(0, -dy)*2.5; if(d < md){ md = d; mejor = k; } } }
  return mejor;
}
/* A*: lista de nodos desde a hasta b (o null) */
function navCamino(a, b, maxNodos){
  if(a < 0 || b < 0) return null; if(a === b) return [a];
  const V = ++NAV.vuelta, g = NAV.g, f = NAV.f, padre = NAV.padre, marca = NAV.marca, cerrado = NAV.cerrado, heap = NAV.heap, px = NAV.px, py = NAV.py, pz = NAV.pz;
  const bx = px[b], by = py[b], bz = pz[b], h = k=> Math.hypot(px[k] - bx, (py[k] - by)*1.5, pz[k] - bz);
  let hn = 0; const push = k=>{ let i = hn++; heap[i] = k; while(i > 0){ const p = (i - 1) >> 1; if(f[heap[p]] <= f[k]) break; heap[i] = heap[p]; i = p; } heap[i] = k; };
  const pop = ()=>{ const top = heap[0], last = heap[--hn]; let i = 0; while(true){ let l = i*2 + 1; if(l >= hn) break; const r = l + 1; if(r < hn && f[heap[r]] < f[heap[l]]) l = r; if(f[heap[l]] >= f[last]) break; heap[i] = heap[l]; i = l; } heap[i] = last; return top; };
  marca[a] = V; g[a] = 0; f[a] = h(a); padre[a] = -1; push(a); let exp = 0, lim2 = maxNodos || 60000;
  while(hn){ const k = pop(); if(cerrado[k] === V) continue; cerrado[k] = V; if(k === b) break; if(++exp > lim2) return null;
    for(let e=NAV.adyI[k];e<NAV.adyI[k+1];e++){ const m = NAV.ady[e]; if(cerrado[m] === V) continue; const ng = g[k] + NAV.costo[e] + NAV.pen[m];
      if(marca[m] !== V || ng < g[m]){ marca[m] = V; g[m] = ng; f[m] = ng + h(m); padre[m] = k; push(m); } } }
  if(cerrado[b] !== V) return null;
  const out = []; for(let k=b;k>=0;k=padre[k]) out.push(k); out.reverse(); return out;
}
/* ¿se puede ir derecho de p a q (mismo piso, sin saltos)? muestrea la grilla cada 0,4 m y exige línea libre a la altura de la rodilla */
function navDerecho(ax, ay, az, bx, by, bz){
  const L = Math.hypot(bx - ax, bz - az); if(L < 0.01) return true; const n = Math.ceil(L/0.4); let yPrev = ay;
  for(let s=1;s<=n;s++){ const t = s/n, x = ax + (bx - ax)*t, z = az + (bz - az)*t, k = navNodo(x, yPrev + 0.3, z); if(k < 0) return false;
    if(Math.abs(NAV.py[k] - yPrev) > NAV_ESC || Math.hypot(NAV.px[k] - x, NAV.pz[k] - z) > 0.45) return false; yPrev = NAV.py[k]; }
  return vistaLibre(ax, ay + 0.55, az, bx, by + 0.55, bz) && vistaLibre(ax, ay + 1.4, az, bx, by + 1.4, bz);
}
/* camino suavizado en puntos {x, y, z, salto} */
function navRuta(ax, ay, az, bx, by, bz){
  const a = navNodo(ax, ay, az), b = navNodo(bx, by, bz), c = navCamino(a, b); if(!c) return null;
  const P = c.map(k=> ({x:NAV.px[k], y:NAV.py[k], z:NAV.pz[k], k})), out = [P[0]];
  for(let i=1;i<P.length;i++){ const prev = P[i-1], cur = P[i]; cur.salto = cur.y - prev.y > NAV_ESC; }
  let i = 0; while(i < P.length - 1){ let j = Math.min(P.length - 1, i + 24);
    for(;j>i+1;j--){ let ok = true; for(let k=i+1;k<=j;k++) if(P[k].salto || Math.abs(P[k].y - P[k-1].y) > NAV_ESC){ ok = false; break; } if(ok && navDerecho(P[i].x, P[i].y, P[i].z, P[j].x, P[j].y, P[j].z)) break; }
    out.push(P[j]); i = j; }
  out.push({x:bx, y:by, z:bz, k:b}); return out;
}
/* un nodo al azar alcanzable cerca de un punto (para deambular) */
function navCercaAzar(x, y, z, radio, rnd){ const r = rnd || Math.random; for(let i=0;i<12;i++){ const a = r()*TAU, d = r()*radio, k = navNodo(x + Math.cos(a)*d, y + 1, z + Math.sin(a)*d); if(k >= 0) return k; } return navNodo(x, y, z); }
