
/* ====================== física del mundo ======================
   El mapa entero son cajas alineadas a los ejes (las rampas se chocan como escalones finos, como los «clips» de Source).
   Un BVH en arreglos planos contesta rayos (balas, vista de los bots, horneado de luz) y solapamientos (movimiento).
   Cada caja lleva banderas: 1 = sólida para cuerpos, 2 = frena balas, 4 = tapa la vista; y su material y resistencia. */
const F_SOLIDA = 1, F_BALA = 2, F_VISTA = 4, F_TODO = 7;
const MUNDO = {n:0, mn:new Float32Array(0), mx:new Float32Array(0), flags:new Uint8Array(0), mat:[], pen:new Float32Array(0), bvh:null};
/* resistencia a las balas por metro de material (CS: la madera se atraviesa, el hormigón grueso no) */
const MATERIAL_BALA = {hormigon:1, piedra:1, metal:0.62, chapa:0.34, madera:0.28, vidrio:0.08, tierra:1.2, tela:0.1, caja:0.3};
function mundoDesde(cajas){
  const n = cajas.length; MUNDO.n = n; MUNDO.mn = new Float32Array(n*3); MUNDO.mx = new Float32Array(n*3); MUNDO.flags = new Uint8Array(n); MUNDO.pen = new Float32Array(n); MUNDO.mat = new Array(n);
  for(let i=0;i<n;i++){ const c = cajas[i]; for(let k=0;k<3;k++){ MUNDO.mn[i*3+k] = c.mn[k]; MUNDO.mx[i*3+k] = c.mx[k]; }
    MUNDO.flags[i] = c.flags === undefined ? F_TODO : c.flags; MUNDO.mat[i] = c.mat || 'hormigon'; MUNDO.pen[i] = c.pen !== undefined ? c.pen : (MATERIAL_BALA[c.bala || c.mat] || 1); }
  MUNDO.bvh = armarBVH(MUNDO.mn, MUNDO.mx, n);
}
/* BVH: nodos con caja [mn(3), mx(3)] y (izq, der) o (primero, cuántos) en las hojas; división por la mediana del eje más largo */
function armarBVH(mn, mx, n){
  const idx = new Uint32Array(n); for(let i=0;i<n;i++) idx[i] = i;
  const cen = new Float32Array(n*3); for(let i=0;i<n*3;i++) cen[i] = (mn[i] + mx[i])*0.5;
  const maxNodos = Math.max(1, 2*n), nb = new Float32Array(maxNodos*6), ni = new Int32Array(maxNodos*3); let cant = 0;
  const pila = [[0, n, -1, 0]];
  function nodo(a, b){ const k = cant++; let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;
    for(let i=a;i<b;i++){ const j = idx[i]*3; if(mn[j]<x0)x0=mn[j]; if(mn[j+1]<y0)y0=mn[j+1]; if(mn[j+2]<z0)z0=mn[j+2]; if(mx[j]>x1)x1=mx[j]; if(mx[j+1]>y1)y1=mx[j+1]; if(mx[j+2]>z1)z1=mx[j+2]; }
    nb[k*6]=x0; nb[k*6+1]=y0; nb[k*6+2]=z0; nb[k*6+3]=x1; nb[k*6+4]=y1; nb[k*6+5]=z1; return k; }
  const raiz = nodo(0, n);
  const trabajo = [[raiz, 0, n]];
  while(trabajo.length){ const [k, a, b] = trabajo.pop();
    if(b - a <= 4){ ni[k*3] = -1; ni[k*3+1] = a; ni[k*3+2] = b - a; continue; }
    let c0=[1e9,1e9,1e9], c1=[-1e9,-1e9,-1e9]; for(let i=a;i<b;i++){ const j = idx[i]*3; for(let e=0;e<3;e++){ const v = cen[j+e]; if(v<c0[e]) c0[e]=v; if(v>c1[e]) c1[e]=v; } }
    let eje = 0; if(c1[1]-c0[1] > c1[eje]-c0[eje]) eje = 1; if(c1[2]-c0[2] > c1[eje]-c0[eje]) eje = 2;
    const m = (a + b) >> 1;
    /* selección de la mediana (nth_element) */
    let lo = a, hi = b - 1; while(lo < hi){ const piv = cen[idx[(lo + hi) >> 1]*3 + eje]; let i = lo, j = hi;
      while(i <= j){ while(cen[idx[i]*3 + eje] < piv) i++; while(cen[idx[j]*3 + eje] > piv) j--; if(i <= j){ const t = idx[i]; idx[i] = idx[j]; idx[j] = t; i++; j--; } }
      if(m <= j) hi = j; else if(m >= i) lo = i; else break; }
    const iz = nodo(a, m), de = nodo(m, b); ni[k*3] = 0; ni[k*3+1] = iz; ni[k*3+2] = de;
    trabajo.push([iz, a, m], [de, m, b]); }
  return {nb, ni, idx, cant};
}
const PILA = new Int32Array(256);
/* rayo más cercano (o sólo si hay algo, con 'cualquiera'): devuelve t o -1; RAYO.caja, RAYO.nx/ny/nz, RAYO.eje */
const RAYO = {t:0, caja:-1, nx:0, ny:0, nz:0, eje:0};
function rayo(ox, oy, oz, dx, dy, dz, tMax, mascara, cualquiera, ignorar){
  const B = MUNDO.bvh; if(!B || !MUNDO.n) return -1;
  const ix = 1/(dx || 1e-12), iy = 1/(dy || 1e-12), iz = 1/(dz || 1e-12), nb = B.nb, ni = B.ni, idx = B.idx, mn = MUNDO.mn, mx = MUNDO.mx, fl = MUNDO.flags;
  let mejor = tMax, caja = -1, eje = 0, sp = 0; PILA[sp++] = 0;
  while(sp){ const k = PILA[--sp], o = k*6;
    let t0 = (nb[o] - ox)*ix, t1 = (nb[o+3] - ox)*ix; let tmin = t0 < t1 ? t0 : t1, tmax = t0 < t1 ? t1 : t0;
    t0 = (nb[o+1] - oy)*iy; t1 = (nb[o+4] - oy)*iy; let a = t0 < t1 ? t0 : t1, b = t0 < t1 ? t1 : t0; if(a > tmin) tmin = a; if(b < tmax) tmax = b;
    t0 = (nb[o+2] - oz)*iz; t1 = (nb[o+5] - oz)*iz; a = t0 < t1 ? t0 : t1; b = t0 < t1 ? t1 : t0; if(a > tmin) tmin = a; if(b < tmax) tmax = b;
    if(tmax < 0 || tmin > tmax || tmin > mejor) continue;
    if(ni[k*3] === -1){ const p = ni[k*3+1], q = p + ni[k*3+2];
      for(let s=p;s<q;s++){ const i = idx[s]; if(!(fl[i] & mascara) || i === ignorar) continue; const j = i*3;
        let e = 0; t0 = (mn[j] - ox)*ix; t1 = (mx[j] - ox)*ix; let cmin = t0 < t1 ? t0 : t1, cmax = t0 < t1 ? t1 : t0;
        t0 = (mn[j+1] - oy)*iy; t1 = (mx[j+1] - oy)*iy; a = t0 < t1 ? t0 : t1; b = t0 < t1 ? t1 : t0; if(a > cmin){ cmin = a; e = 1; } if(b < cmax) cmax = b;
        t0 = (mn[j+2] - oz)*iz; t1 = (mx[j+2] - oz)*iz; a = t0 < t1 ? t0 : t1; b = t0 < t1 ? t1 : t0; if(a > cmin){ cmin = a; e = 2; } if(b < cmax) cmax = b;
        if(cmax >= Math.max(cmin, 0) && cmin < mejor){ if(cmin < 0) continue; mejor = cmin; caja = i; eje = e; if(cualquiera){ RAYO.t = mejor; RAYO.caja = caja; return mejor; } } } }
    else { PILA[sp++] = ni[k*3+1]; PILA[sp++] = ni[k*3+2]; } }
  if(caja < 0) return -1;
  RAYO.t = mejor; RAYO.caja = caja; RAYO.eje = eje; RAYO.nx = RAYO.ny = RAYO.nz = 0;
  const dd = eje === 0 ? dx : eje === 1 ? dy : dz, nv = dd > 0 ? -1 : 1; if(eje === 0) RAYO.nx = nv; else if(eje === 1) RAYO.ny = nv; else RAYO.nz = nv;
  return mejor;
}
/* todas las cajas que corta el rayo, con entrada y salida (para la penetración de balas), ordenadas */
function rayoTodas(ox, oy, oz, dx, dy, dz, tMax, mascara){
  const B = MUNDO.bvh, out = []; if(!B) return out;
  const ix = 1/(dx || 1e-12), iy = 1/(dy || 1e-12), iz = 1/(dz || 1e-12), nb = B.nb, ni = B.ni, idx = B.idx, mn = MUNDO.mn, mx = MUNDO.mx, fl = MUNDO.flags;
  let sp = 0; PILA[sp++] = 0;
  while(sp){ const k = PILA[--sp], o = k*6;
    let t0 = (nb[o] - ox)*ix, t1 = (nb[o+3] - ox)*ix; let tmin = Math.min(t0, t1), tmax = Math.max(t0, t1);
    t0 = (nb[o+1] - oy)*iy; t1 = (nb[o+4] - oy)*iy; tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
    t0 = (nb[o+2] - oz)*iz; t1 = (nb[o+5] - oz)*iz; tmin = Math.max(tmin, Math.min(t0, t1)); tmax = Math.min(tmax, Math.max(t0, t1));
    if(tmax < 0 || tmin > tmax || tmin > tMax) continue;
    if(ni[k*3] === -1){ const p = ni[k*3+1], q = p + ni[k*3+2];
      for(let s=p;s<q;s++){ const i = idx[s]; if(!(fl[i] & mascara)) continue; const j = i*3; let e = 0;
        t0 = (mn[j] - ox)*ix; t1 = (mx[j] - ox)*ix; let cmin = Math.min(t0, t1), cmax = Math.max(t0, t1);
        t0 = (mn[j+1] - oy)*iy; t1 = (mx[j+1] - oy)*iy; let a = Math.min(t0, t1); if(a > cmin){ cmin = a; e = 1; } cmax = Math.min(cmax, Math.max(t0, t1));
        t0 = (mn[j+2] - oz)*iz; t1 = (mx[j+2] - oz)*iz; a = Math.min(t0, t1); if(a > cmin){ cmin = a; e = 2; } cmax = Math.min(cmax, Math.max(t0, t1));
        if(cmax >= cmin && cmax > 0 && cmin < tMax) out.push({t0:Math.max(0, cmin), t1:Math.min(tMax, cmax), caja:i, eje:e}); } }
    else { PILA[sp++] = ni[k*3+1]; PILA[sp++] = ni[k*3+2]; } }
  out.sort((a, b)=> a.t0 - b.t0); return out;
}
/* cajas que se solapan con [x0..x1]×[y0..y1]×[z0..z1] (sólo las de la máscara) */
const SOLAP = new Int32Array(512); let nSolap = 0;
function solapadas(x0, y0, z0, x1, y1, z1, mascara){
  nSolap = 0; const B = MUNDO.bvh; if(!B) return 0; const nb = B.nb, ni = B.ni, idx = B.idx, mn = MUNDO.mn, mx = MUNDO.mx, fl = MUNDO.flags;
  let sp = 0; PILA[sp++] = 0;
  while(sp){ const k = PILA[--sp], o = k*6;
    if(nb[o] > x1 || nb[o+3] < x0 || nb[o+1] > y1 || nb[o+4] < y0 || nb[o+2] > z1 || nb[o+5] < z0) continue;
    if(ni[k*3] === -1){ const p = ni[k*3+1], q = p + ni[k*3+2];
      for(let s=p;s<q;s++){ const i = idx[s]; if(!(fl[i] & mascara)) continue; const j = i*3;
        if(mn[j] < x1 && mx[j] > x0 && mn[j+1] < y1 && mx[j+1] > y0 && mn[j+2] < z1 && mx[j+2] > z0 && nSolap < SOLAP.length) SOLAP[nSolap++] = i; } }
    else { PILA[sp++] = ni[k*3+1]; PILA[sp++] = ni[k*3+2]; } }
  return nSolap;
}
function libre(x0, y0, z0, x1, y1, z1, extras){
  if(solapadas(x0, y0, z0, x1, y1, z1, F_SOLIDA)) return false;
  if(extras) for(const e of extras) if(e.mn[0] < x1 && e.mx[0] > x0 && e.mn[1] < y1 && e.mx[1] > y0 && e.mn[2] < z1 && e.mx[2] > z0) return false;
  return true;
}
/* ---------- mover un cuerpo (caja de ancho a×a y alto h con los pies en pos) eje por eje, con subida de escalón ----------
   extras: cajas de otros cuerpos (los jugadores se chocan). Devuelve en c: enSuelo, chocoX, chocoZ, subio. */
function moverCuerpo(c, dx, dy, dz, extras){
  const r = c.ancho*0.5, h = c.alto, EPS = 1e-4; c.chocoX = c.chocoZ = false; c.subio = 0; const antesY = c.pos.y;
  const intentaEje = (eje, d)=>{
    if(!d) return;
    const p = c.pos; let x0 = p.x - r, x1 = p.x + r, z0 = p.z - r, z1 = p.z + r; const y0 = p.y + EPS, y1 = p.y + h;
    if(eje === 0){ if(d > 0) x1 += d; else x0 += d; } else { if(d > 0) z1 += d; else z0 += d; }
    let n = solapadas(x0, y0, z0, x1, y1, z1, F_SOLIDA); let lista = []; for(let i=0;i<n;i++) lista.push(SOLAP[i]);
    let dd = d, alto = false, techoEscalon = -1e9;
    const aplica = (bmn, bmx, esExtra)=>{
      /* ¿se puede subir? (sólo en el piso y si el tope está a menos de un escalón) */
      if(!esExtra && c.enSuelo && bmx[1] - p.y <= MOV.escalon + 1e-3 && bmx[1] > p.y){ techoEscalon = Math.max(techoEscalon, bmx[1]); return; }
      if(eje === 0){ if(d > 0) dd = Math.min(dd, bmn[0] - (p.x + r) - EPS); else dd = Math.max(dd, bmx[0] - (p.x - r) + EPS); }
      else { if(d > 0) dd = Math.min(dd, bmn[2] - (p.z + r) - EPS); else dd = Math.max(dd, bmx[2] - (p.z - r) + EPS); }
      alto = true; };
    const mn = MUNDO.mn, mx = MUNDO.mx;
    for(const i of lista){ const j = i*3; aplica([mn[j], mn[j+1], mn[j+2]], [mx[j], mx[j+1], mx[j+2]], false); }
    if(extras) for(const e of extras){ if(e.mn[0] < x1 && e.mx[0] > x0 && e.mn[1] < y1 && e.mx[1] > y0 && e.mn[2] < z1 && e.mx[2] > z0) aplica(e.mn, e.mx, true); }
    if(techoEscalon > -1e8){
      /* subir: se prueba el cuerpo entero arriba del escalón en la posición de destino */
      const ny = techoEscalon + EPS*2, nx = eje === 0 ? p.x + d : p.x, nz = eje === 2 ? p.z + d : p.z;
      if(libre(nx - r, ny, nz - r, nx + r, ny + h, nz + r, extras) && !alto){ c.subio = Math.max(c.subio, ny - p.y); p.y = ny; if(eje === 0) p.x = nx; else p.z = nz; return; }
      /* no entra arriba: frena contra el escalón como una pared */
      for(const i of lista){ const j = i*3; if(mx[j+1] === techoEscalon || mx[j+1] - p.y <= MOV.escalon + 1e-3){
        if(eje === 0){ if(d > 0) dd = Math.min(dd, mn[j] - (p.x + r) - EPS); else dd = Math.max(dd, mx[j] - (p.x - r) + EPS); }
        else { if(d > 0) dd = Math.min(dd, mn[j+2] - (p.z + r) - EPS); else dd = Math.max(dd, mx[j+2] - (p.z - r) + EPS); } alto = true; } }
    }
    if(d > 0) dd = Math.max(0, dd); else dd = Math.min(0, dd);
    if(eje === 0){ p.x += dd; if(alto) c.chocoX = true; } else { p.z += dd; if(alto) c.chocoZ = true; }
  };
  /* los pasos grandes se parten para no atravesar cajas finas */
  const pasos = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz))/(r*0.9)));
  for(let s=0;s<pasos;s++){ intentaEje(0, dx/pasos); intentaEje(2, dz/pasos); }
  /* vertical */
  const p = c.pos; c.enSuelo = false;
  if(dy){ let y0 = p.y + (dy < 0 ? dy : 0), y1 = p.y + h + (dy > 0 ? dy : 0);
    const n = solapadas(p.x - r + EPS, y0, p.z - r + EPS, p.x + r - EPS, y1, p.z + r - EPS, F_SOLIDA); let d = dy; const mn = MUNDO.mn, mx = MUNDO.mx;
    for(let k=0;k<n;k++){ const j = SOLAP[k]*3; if(dy < 0){ if(mx[j+1] <= p.y + 1e-3) d = Math.max(d, mx[j+1] - p.y); } else { if(mn[j+1] >= p.y + h - 1e-3) d = Math.min(d, mn[j+1] - (p.y + h)); } }
    if(extras) for(const e of extras){ if(e.mn[0] < p.x + r && e.mx[0] > p.x - r && e.mn[2] < p.z + r && e.mx[2] > p.z - r){
      if(dy < 0 && e.mx[1] <= p.y + 1e-3 && e.mx[1] > p.y + dy) d = Math.max(d, e.mx[1] - p.y);
      if(dy > 0 && e.mn[1] >= p.y + h - 1e-3 && e.mn[1] < p.y + h + dy) d = Math.min(d, e.mn[1] - (p.y + h)); } }
    if(dy < 0 && d > dy){ c.enSuelo = true; c.techo = false; } else if(dy > 0 && d < dy){ c.techo = true; } else c.techo = false;
    p.y += d; }
  if(!c.enSuelo){ /* ¿hay piso justo abajo? (parado quieto sobre algo) */
    if(solapadas(p.x - r + EPS, p.y - 0.01, p.z - r + EPS, p.x + r - EPS, p.y + 0.001, p.z + r - EPS, F_SOLIDA)) c.enSuelo = true; }
  return c;
}
/* altura del piso bajo un punto (para dejar cosas apoyadas y para la navegación) */
function pisoBajo(x, y, z, bajar){ const t = rayo(x, y, z, 0, -1, 0, bajar || 50, F_SOLIDA); return t < 0 ? -1e9 : y - t; }
function vistaLibre(ax, ay, az, bx, by, bz){ const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz) || 1e-6; return rayo(ax, ay, az, dx/L, dy/L, dz/L, L, F_VISTA, true) < 0; }
