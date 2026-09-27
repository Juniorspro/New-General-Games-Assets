
/* ====================== texturas de respaldo, dibujadas por código ======================
   Mientras no llegan las de Rezona (o si alguna falla), cada material tiene su textura pintada con ruido repetible:
   el borde de la derecha empalma con el de la izquierda. De la misma altura sale el mapa de normales. */
function ruidoRep(N, sem, celdas){
  const r = mulberry(sem), g = new Float32Array(celdas*celdas); for(let i=0;i<g.length;i++) g[i] = r();
  const out = new Float32Array(N*N);
  for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const fx = x/N*celdas, fy = y/N*celdas, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = suave(fx - x0), ty = suave(fy - y0);
    const a = g[(y0%celdas)*celdas + x0%celdas], b = g[(y0%celdas)*celdas + (x0+1)%celdas], c = g[((y0+1)%celdas)*celdas + x0%celdas], d = g[((y0+1)%celdas)*celdas + (x0+1)%celdas];
    out[y*N+x] = lerp(lerp(a, b, tx), lerp(c, d, tx), ty); }
  return out;
}
function fbmRep(N, sem, base, oct){ const out = new Float32Array(N*N); let amp = 0.5, tot = 0;
  for(let o=0;o<oct;o++){ const c = base << o; if(c > N) break; const r = ruidoRep(N, sem + o*101, c); for(let i=0;i<out.length;i++) out[i] += r[i]*amp; tot += amp; amp *= 0.5; }
  for(let i=0;i<out.length;i++) out[i] /= tot; return out; }
function hexRGB(h){ const c = new THREE.Color(h); return [c.r*255, c.g*255, c.b*255]; }
/* lienzo + altura → texturas de three (color en sRGB y normales en lineal) */
function texDeArreglos(N, col, alt, fuerza){
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), im = g.createImageData(N, N);
  for(let i=0;i<N*N;i++){ im.data[i*4] = col[i*3]; im.data[i*4+1] = col[i*3+1]; im.data[i*4+2] = col[i*3+2]; im.data[i*4+3] = 255; }
  g.putImageData(im, 0, 0);
  const tc = new THREE.CanvasTexture(c); tc.encoding = THREE.sRGBEncoding; tc.wrapS = tc.wrapT = THREE.RepeatWrapping; tc.anisotropy = Math.min(4, ren.capabilities.getMaxAnisotropy());
  let tn = null;
  if(alt){ const c2 = document.createElement('canvas'); c2.width = c2.height = N; const g2 = c2.getContext('2d'), in2 = g2.createImageData(N, N), k = fuerza || 2;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const dx = alt[y*N + (x+1)%N] - alt[y*N + (x+N-1)%N], dy = alt[((y+1)%N)*N + x] - alt[((y+N-1)%N)*N + x];
      let nx = -dx*k, ny = dy*k, nz = 1; const l = Math.hypot(nx, ny, nz); const o = (y*N + x)*4; in2.data[o] = (nx/l*0.5+0.5)*255; in2.data[o+1] = (ny/l*0.5+0.5)*255; in2.data[o+2] = (nz/l*0.5+0.5)*255; in2.data[o+3] = 255; }
    g2.putImageData(in2, 0, 0); tn = new THREE.CanvasTexture(c2); tn.wrapS = tn.wrapT = THREE.RepeatWrapping; }
  return {map:tc, normal:tn, lienzo:c};
}
/* pintores: devuelven color (Uint8 RGB) y altura (0..1) de N×N */
const PINTOR = {
  hormigon(N, o, r){ const f = fbmRep(N, o.sem, 4, 6), m = fbmRep(N, o.sem + 7, 2, 3), p = ruidoRep(N, o.sem + 3, 64), base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N);
    const junta = o.juntas || 0;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x; let v = 0.78 + f[i]*0.34 + (m[i] - 0.5)*0.25, h = f[i]*0.4;
      if(p[i] > 0.83){ v *= 0.8; h -= 0.3; }
      if(junta){ const jx = Math.min(x % (N/junta), N/junta - x % (N/junta)), jy = Math.min(y % (N/junta), N/junta - y % (N/junta)); if(Math.min(jx, jy) < 1.6){ v *= 0.55; h -= 0.8; } }
      col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v*0.98, 0, 255); alt[i] = h; }
    return [col, alt]; },
  asfalto(N, o){ const f = fbmRep(N, o.sem, 8, 6), p = ruidoRep(N, o.sem + 5, 128), m = fbmRep(N, o.sem + 9, 2, 3), base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N);
    for(let i=0;i<N*N;i++){ let v = 0.7 + f[i]*0.45 + (p[i] > 0.7 ? 0.25 : 0) + (m[i] - 0.5)*0.3; col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = f[i]*0.5 + (p[i] > 0.7 ? 0.3 : 0); }
    return [col, alt]; },
  chapa(N, o){ const f = fbmRep(N, o.sem, 4, 5), vet = ruidoRep(N, o.sem + 2, 32), base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), ondas = o.ondas || 16;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x, fase = (x/N*ondas) % 1, perfil = fase < 0.3 ? 1 : fase < 0.5 ? 1 - (fase - 0.3)/0.2 : fase < 0.8 ? 0 : (fase - 0.8)/0.2;
      /* mugre que chorrea de arriba */
      const chorreo = Math.pow(vet[(x % N)] , 3)*0.25*(1 - y/N) + (f[i] - 0.5)*0.18;
      const v = (0.92 + perfil*0.1 - chorreo)*(1 - (y > N*0.9 ? (y - N*0.9)/(N*0.1)*0.18 : 0));
      col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = perfil*0.8 + f[i]*0.05; }
    return [col, alt]; },
  pintado(N, o){ const f = fbmRep(N, o.sem, 4, 5), m = fbmRep(N, o.sem + 4, 2, 3), base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), pan = o.paneles || 3;
    const t = N/pan;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x; let v = 0.93 + (f[i] - 0.5)*0.12 + (m[i] - 0.5)*0.1, h = 0.5;
      const px = x % t, py = y % t, dj = Math.min(px, t - px, py, t - py);
      if(dj < 1.5){ v *= 0.62; h = 0.1; } else if(dj < 3){ v *= 1.05; h = 0.62; }
      /* remaches en las esquinas de cada panel */
      const rx = Math.min(px, t - px), ry = Math.min(py, t - py); if(Math.hypot(rx - 7, ry - 7) < 2.2){ v *= 1.12; h = 0.85; }
      if(y > N - 24){ v *= 0.9 - (m[i] > 0.6 ? 0.1 : 0); }
      col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = h; }
    return [col, alt]; },
  bloques(N, o){ const f = fbmRep(N, o.sem, 8, 5), base = hexRGB(o.color), mort = hexRGB(o.mortero || '#b9a88a'), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), filas = o.filas || 6, cols = o.cols || 3, r = mulberry(o.sem);
    const hF = N/filas, var_ = []; for(let k=0;k<filas*cols*2;k++) var_.push(0.85 + r()*0.25);
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x, fila = Math.floor(y/hF), desf = (fila % 2)*0.5, wB = N/cols, xx = (x + desf*wB) % N, cb = Math.floor(xx/wB);
      const bx = xx % wB, by = y % hF, borde = Math.min(bx, wB - bx, by, hF - by); let v, h;
      if(borde < 2.2){ v = 0.9 + f[i]*0.15; col[i*3] = mort[0]*v; col[i*3+1] = mort[1]*v; col[i*3+2] = mort[2]*v; alt[i] = 0.1; continue; }
      v = var_[(fila*cols + cb) % var_.length]*(0.82 + f[i]*0.3)*(borde < 5 ? 0.93 : 1); h = 0.6 + f[i]*0.3 - (borde < 5 ? 0.15 : 0);
      col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = h; }
    return [col, alt]; },
  revoque(N, o){ const f = fbmRep(N, o.sem, 4, 6), m = fbmRep(N, o.sem + 5, 2, 4), g = ruidoRep(N, o.sem + 9, 16), base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N);
    for(let i=0;i<N*N;i++){ let v = 0.86 + f[i]*0.22 + (m[i] - 0.5)*0.22; const grieta = Math.abs(g[i] - 0.5) < 0.008 ? 0.6 : 1; v *= grieta;
      col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = f[i]*0.6 - (grieta < 1 ? 0.4 : 0); }
    return [col, alt]; },
  tierra(N, o){ const f = fbmRep(N, o.sem, 4, 6), p = ruidoRep(N, o.sem + 1, 64), base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N);
    for(let i=0;i<N*N;i++){ const piedra = p[i] > 0.78; let v = 0.8 + f[i]*0.35 + (piedra ? -0.12 : 0); col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v*0.96, 0, 255); alt[i] = f[i]*0.5 + (piedra ? 0.5 : 0); }
    return [col, alt]; },
  tablas(N, o){ const f = fbmRep(N, o.sem, 4, 5), vet = fbmRep(N, o.sem + 3, 16, 3), base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), n = o.tablas || 6, r = mulberry(o.sem), tono = [];
    for(let k=0;k<n;k++) tono.push(0.85 + r()*0.28);
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x, w = N/n, k = Math.floor(x/w), bx = x % w, borde = Math.min(bx, w - bx);
      let v = tono[k]*(0.8 + vet[((y*3) % N)*N + ((x*1) % N)]*0.35) + (f[i] - 0.5)*0.1, h = 0.6 + vet[i]*0.2;
      if(borde < 1.5){ v *= 0.35; h = 0; } else if(borde < 3) v *= 0.85;
      if(Math.abs(y - N*0.12) < 2.5 && Math.abs(bx - w/2) < 2.5){ v *= 0.4; h = 0.9; } if(Math.abs(y - N*0.88) < 2.5 && Math.abs(bx - w/2) < 2.5){ v *= 0.4; h = 0.9; }
      col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = h; }
    return [col, alt]; },
  adoquin(N, o){ const base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), f = fbmRep(N, o.sem, 8, 4), r = mulberry(o.sem), pts = [];
    const n = o.piedras || 7; for(let j=0;j<n;j++) for(let i=0;i<n;i++) pts.push([(i + 0.5 + (r() - 0.5)*0.6)/n*N, (j + 0.5 + (r() - 0.5)*0.6)/n*N, 0.8 + r()*0.3]);
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ let d1 = 1e9, d2 = 1e9, tn = 1; for(const [px, py, t] of pts){ let dx = Math.abs(x - px), dy = Math.abs(y - py); dx = Math.min(dx, N - dx); dy = Math.min(dy, N - dy); const d = dx*dx + dy*dy; if(d < d1){ d2 = d1; d1 = d; tn = t; } else if(d < d2) d2 = d; }
      const e = Math.sqrt(d2) - Math.sqrt(d1), i = y*N + x; let v = tn*(0.85 + f[i]*0.25), h = Math.min(1, e/6);
      if(e < 2.5){ v *= 0.55; } col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = h; }
    return [col, alt]; },
  teja(N, o){ const base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), f = fbmRep(N, o.sem, 8, 4), filas = 8, cols = 8;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x, fy = (y/N*filas) % 1, fila = Math.floor(y/N*filas), fx = ((x/N*cols) + (fila % 2)*0.5) % 1;
      const perfil = Math.sin(fx*Math.PI), h = perfil*0.7 + (1 - fy)*0.3; let v = (0.7 + perfil*0.3)*(0.85 + f[i]*0.3)*(fy > 0.9 ? 0.6 : 1);
      col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = h; }
    return [col, alt]; },
  oxido(N, o){ const f = fbmRep(N, o.sem, 4, 6), m = fbmRep(N, o.sem + 2, 4, 5), base = hexRGB(o.color), ox = hexRGB('#7a3f1e'), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N);
    for(let i=0;i<N*N;i++){ const k = lim((m[i] - 0.55)*4, 0, 1); const v = 0.85 + f[i]*0.25; for(let c=0;c<3;c++) col[i*3+c] = lim(lerp(base[c], ox[c]*(0.7 + f[i]*0.6), k)*v, 0, 255); alt[i] = k*0.3 + f[i]*0.3; }
    return [col, alt]; },
  grava(N, o){ const base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), a = ruidoRep(N, o.sem, 64), b = ruidoRep(N, o.sem + 1, 128), f = fbmRep(N, o.sem + 2, 4, 3);
    for(let i=0;i<N*N;i++){ const h = Math.max(a[i], b[i]*0.9); const v = 0.6 + h*0.6 + (f[i] - 0.5)*0.2; col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = h; }
    return [col, alt]; },
  pasto(N, o){ const base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), a = ruidoRep(N, o.sem, 128), f = fbmRep(N, o.sem + 2, 4, 5);
    for(let i=0;i<N*N;i++){ const v = 0.65 + a[i]*0.5 + (f[i] - 0.5)*0.35; col[i*3] = lim(base[0]*v*(0.9 + f[i]*0.2), 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = a[i]; }
    return [col, alt]; },
  semilla(N, o){ const base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), f = fbmRep(N, o.sem, 4, 5), n = 10;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x, cx = (x/N*n) % 1, cy = (y/N*n) % 1, fila = Math.floor(y/N*n) % 2;
      const ux = (cx - 0.5), uy = (cy - 0.5); const a = fila ? (ux*0.7 + uy*0.7) : (ux*0.7 - uy*0.7), b = fila ? (-ux*0.7 + uy*0.7) : (ux*0.7 + uy*0.7);
      const enDiamante = Math.abs(a) < 0.34 && Math.abs(b) < 0.07; const h = enDiamante ? 1 : 0.2 + f[i]*0.1; const v = (enDiamante ? 1.12 : 0.9)*(0.85 + f[i]*0.25);
      col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = h; }
    return [col, alt]; },
  /* caras enteras (no se repiten): caja de madera tipo Dust y caja metálica roja */
  caja_madera(N, o){ const base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), vet = fbmRep(N, o.sem, 8, 4), f = fbmRep(N, o.sem + 3, 4, 4), m = N*0.13;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x; const enMarco = x < m || x > N - m || y < m || y > N - m; const diag = Math.abs((x - y)) < m*0.8 || Math.abs((x + y) - N) < m*0.8;
      let v, h; if(enMarco){ v = 0.9 + vet[((x*4) % N)*N + y]*0.25; h = 1; } else if(diag){ v = 0.95 + vet[i]*0.25; h = 0.8; } else { const tb = Math.floor(y/(N/5)); v = (0.72 + (tb % 2)*0.08)*(0.85 + vet[((y*5) % N)*N + x]*0.3); h = 0.4; }
      const borde = Math.min(Math.abs(x - m), Math.abs(x - (N - m)), Math.abs(y - m), Math.abs(y - (N - m))); if(borde < 1.5 && !(x < m*0.2 || x > N - m*0.2 || y < m*0.2 || y > N - m*0.2)) { v *= 0.5; }
      v *= 0.9 + (f[i] - 0.5)*0.2; col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = h; }
    return [col, alt]; },
  caja_roja(N, o){ const base = hexRGB(o.color), col = new Uint8Array(N*N*3), alt = new Float32Array(N*N), f = fbmRep(N, o.sem, 4, 5), m = N*0.07;
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){ const i = y*N + x; const enMarco = x < m || x > N - m || y < m || y > N - m, med = Math.abs(x - N/2) < m*0.5;
      let v = 0.92 + (f[i] - 0.5)*0.16, h = 0.4; if(enMarco || med){ v *= 1.06; h = 0.9; }
      const bb = Math.min(Math.abs(x - m), Math.abs(x - (N - m)), Math.abs(y - m), Math.abs(y - (N - m)), Math.abs(Math.abs(x - N/2) - m*0.5)); if(bb < 1.3){ v *= 0.55; h = 0.1; }
      if((Math.hypot(x - m*0.5, y - N*0.25) < 3) || (Math.hypot(x - m*0.5, y - N*0.75) < 3)){ v *= 0.6; h = 1; }
      if(f[i] > 0.72){ v *= 0.8; }
      col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); alt[i] = h; }
    return [col, alt]; },
  liso(N, o){ const base = hexRGB(o.color), col = new Uint8Array(N*N*3), f = fbmRep(N, o.sem, 4, 4); for(let i=0;i<N*N;i++){ const v = 0.94 + (f[i] - 0.5)*0.12; col[i*3] = lim(base[0]*v, 0, 255); col[i*3+1] = lim(base[1]*v, 0, 255); col[i*3+2] = lim(base[2]*v, 0, 255); } return [col, null]; },
};
const TEX_RESPALDO = {};
function texRespaldo(id, def){
  if(TEX_RESPALDO[id]) return TEX_RESPALDO[id];
  const N = def.N || 256, [col, alt] = PINTOR[def.gen || 'liso'](N, Object.assign({sem:semilla32(id)}, def));
  return TEX_RESPALDO[id] = texDeArreglos(N, col, alt, def.relieve || 2.2);
}
