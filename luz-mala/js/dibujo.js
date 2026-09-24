/* ============================================================================
   luz-mala/js/dibujo.js — cómo se ve el quebracho por dentro.
   Lo fijo de cada sala (las paredes, los tablones, las espinas, los adornos)
   se pinta UNA vez en un lienzo; por cuadro solo se copia. Las paredes se
   oscurecen cuanto más adentro de la madera: así los pasillos parecen
   tallados en la oscuridad, como en Hollow Knight.
   La luz va al final: una capa de oscuridad a media resolución, con trama, y
   agujeros donde hay algo que brilla. Chispa es la luz principal.
   ========================================================================== */

const VistaLM = { x: 0, y: 0, mira: 0, t: 0, usable: 0, mandos: 0, fija: false };
const lienzoLM = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function ruidoLM(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function c32LM(h, a) { const [r, g, b] = hexRGB(h); return ((a == null ? 255 : a) << 24) | (b << 16) | (g << 8) | r; }

/* ---------------- la cámara ---------------- */
function ubicarLM(m, snap) {
  const W = Pantalla.W, H = Pantalla.H, sw = m.w * 8, sh = m.h * 8, p = m.p;
  VistaLM.mandos = document.body.classList.contains('tactil') ? Math.round(232 / Pantalla.PX) : 0;
  const usable = VistaLM.usable = H - VistaLM.mandos;
  /* mira un poco hacia donde va: así se ve venir lo de adelante */
  const quiere = Math.abs(p.vx) > 20 ? sig(p.vx) * Math.min(34, W * 0.16) : VistaLM.mira * 0.985;
  VistaLM.mira = snap ? quiere : acercar(VistaLM.mira, quiere, 1.4);
  /* mientras el jefe se presenta, la cámara lo mira a él */
  const cine = typeof J !== 'undefined' && J.cine && m.jefe && J.cine.t < 1.5;
  const fx = cine ? m.jefe.x + m.jefe.w / 2 : p.x + 4 + VistaLM.mira, fy = cine ? m.jefe.y + m.jefe.h / 2 : p.y + 6;
  let mx, my;
  if (sw <= W) mx = -(W - sw) / 2;
  else mx = lim(fx - W / 2, 0, sw - W);
  if (sh <= usable) my = -(usable - sh) / 2;
  else my = lim(fy - usable * 0.56, 0, sh - usable);
  if (snap) { VistaLM.x = mx; VistaLM.y = my; }
  else { const k = cine ? 0.06 : 0.14; VistaLM.x += (mx - VistaLM.x) * k; VistaLM.y += (my - VistaLM.y) * (Math.abs(my - VistaLM.y) > 60 ? 0.3 : cine ? 0.06 : 0.12); }
}

/* ---------------- el fondo: dos capas que se mueven más lento que la sala ---------------- */
const cacheFondoLM = new Map();
function fondoLM(zona, capa) {
  const k = zona + capa;
  if (cacheFondoLM.has(k)) return cacheFondoLM.get(k);
  const Z = ZONA_ARTE[zona], T = capa === 0 ? 160 : 224, c = lienzoLM(T, T), g = c.getContext('2d');
  const id = g.createImageData(T, T), d = new Uint32Array(id.data.buffer);
  const cielo = Z.cielo.map((h) => c32LM(h)), lejos = c32LM(Z.lejos), medio = c32LM(Z.medio), nada = 0;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let v = nada;
    if (capa === 0) {
      /* lo más lejos: fibras verticales del tronco, onduladas, en trama */
      const f = Math.sin((x + Math.sin(y * 0.045) * 9) * 0.19) * 0.5 + 0.5;
      const n = ruidoLM(x >> 2, y >> 3, 7) * 0.35;
      const k2 = lim(Math.floor((f * 0.8 + n) * 4 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.3), 0, 3);
      v = cielo[k2];
    } else {
      /* raíces que cruzan: bandas gruesas, torcidas, con huecos */
      const r1 = Math.abs(((x + Math.sin(y * 0.03) * 22 + 400) % 74) - 37);
      const r2 = Math.abs(((y + Math.sin(x * 0.028) * 18 + 400) % 96) - 48);
      if (r1 < 7 + ruidoLM(x >> 3, y >> 3, 3) * 3) v = r1 < 5 ? medio : lejos;
      else if (r2 < 4 && ruidoLM(x >> 4, 1, 9) > 0.35) v = r2 < 2 ? medio : lejos;
    }
    d[y * T + x] = v;
  }
  g.putImageData(id, 0, 0);
  /* lo que da vida a cada zona, lejos: ventanitas, hongos, telas, túneles */
  const q = g;
  for (let i = 0; i < (capa === 0 ? 10 : 7); i++) {
    const x = Math.floor(ruidoLM(i, capa, 11) * (T - 12)) + 6, y = Math.floor(ruidoLM(i, capa, 13) * (T - 12)) + 6;
    if (zona === 'pueblo') { q.fillStyle = capa ? '#ffcf80' : '#8a5a3a'; q.fillRect(x, y, 2, 3); if (capa) { q.fillStyle = '#5a3222'; q.fillRect(x - 1, y - 1, 4, 1); } }
    else if (zona === 'raices') { q.fillStyle = capa ? '#4ad8c8' : '#1e4a48'; q.fillRect(x, y, 3, 1); q.fillRect(x + 1, y + 1, 1, 2); }
    else if (zona === 'tela') { q.strokeStyle = capa ? 'rgba(200,210,240,0.35)' : 'rgba(150,160,190,0.18)'; q.beginPath(); for (let a = 0; a < 6; a++) { q.moveTo(x, y); q.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); } q.stroke(); }
    else { q.fillStyle = capa ? '#3a140a' : '#1a0806'; q.beginPath(); q.ellipse(x, y, 7, 4, 0, 0, Math.PI * 2); q.fill(); if (capa) { q.fillStyle = '#ff9040'; q.fillRect(x - 1, y, 1, 1); } }
  }
  cacheFondoLM.set(k, c);
  return c;
}
function dibujarFondoLM(g, zona) {
  const W = Pantalla.W, H = Pantalla.H;
  g.fillStyle = ZONA_ARTE[zona].cielo[0]; g.fillRect(0, 0, W, H);
  for (const [capa, k] of [[0, 0.18], [1, 0.45]]) {
    const f = fondoLM(zona, capa), T = f.width;
    const ox = -Math.round((VistaLM.x * k) % T) - (VistaLM.x * k < 0 ? T : 0), oy = -Math.round((VistaLM.y * k) % T) - (VistaLM.y * k < 0 ? T : 0);
    for (let y = oy - T; y < H; y += T) for (let x = ox - T; x < W; x += T) g.drawImage(f, x, y);
  }
}

/* ---------------- la sala: paredes, tablones, espinas, adornos (una vez) ----------------
   La capa sale con MARGEN_LM baldosas de más por cada lado: afuera de la sala
   sigue la madera maciza del quebracho (con sus anillos), y las salidas siguen
   como túneles. Así, en un teléfono parado, la sala no flota en una franja negra */
const MARGEN_LM = 16;
const cacheCapaLM = new Map();
function mezclaHex(a, b, k) { const x = hexRGB(a), y = hexRGB(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
function capaLM(m) {
  const sala = m.sala, k = sala.id;
  if (cacheCapaLM.has(k)) return cacheCapaLM.get(k);
  const Z = ZONA_ARTE[sala.zona], w = m.w, h = m.h, M = MARGEN_LM, WW = w + 2 * M, HH = h + 2 * M, W = WW * 8, H = HH * 8, D = M * 8;
  const c = lienzoLM(W, H), g = c.getContext('2d');
  const id = g.createImageData(W, H), d = new Uint32Array(id.data.buffer);
  const mapa = sala.mapa, sol = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? (mapa[lim(y, 0, h - 1)][lim(x, 0, w - 1)] === '#') : mapa[y][x] === '#';
  const solM = (x, y) => sol(x - M, y - M);
  /* profundidad: a cuántas baldosas está cada pared del aire más cercano */
  const prof = new Uint8Array(WW * HH).fill(9), cola = [];
  for (let y = 0; y < HH; y++) for (let x = 0; x < WW; x++) if (!solM(x, y)) { prof[y * WW + x] = 0; cola.push(x, y); }
  for (let i = 0; i < cola.length; i += 2) {
    const x = cola[i], y = cola[i + 1], v = prof[y * WW + x] + 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < WW && ny < HH && prof[ny * WW + nx] > v) { prof[ny * WW + nx] = v; if (v < 4) cola.push(nx, ny); }
    }
  }
  const col = {
    madera: c32LM(Z.madera), osc: c32LM(Z.maderaOsc), clara: c32LM(Z.maderaClara), borde: c32LM(Z.borde), vetas: c32LM(Z.vetas),
    musgo: c32LM(Z.musgo), musgoClaro: c32LM(Z.musgoClaro), negro: c32LM('#060409'), negro2: c32LM('#0c0810'),
    hondo: c32LM(mezclaHex('#060409', Z.maderaOsc, 0.32)), anillo: c32LM(mezclaHex('#060409', Z.vetas, 0.55)),
  };
  /* los anillos del tronco: círculos alrededor de un centro lejano, un poco torcidos */
  const acx = w * 4 + D + (ruidoLM(k.length, 3, 7) - 0.5) * w * 6, acy = h * 4 + D + h * 14;
  for (let ty = 0; ty < HH; ty++) for (let tx = 0; tx < WW; tx++) {
    if (!solM(tx, ty)) continue;
    const pr = prof[ty * WW + tx];
    const arr = !solM(tx, ty - 1), aba = !solM(tx, ty + 1), izq = !solM(tx - 1, ty), der = !solM(tx + 1, ty);
    for (let ly = 0; ly < 8; ly++) for (let lx = 0; lx < 8; lx++) {
      const X = tx * 8 + lx, Y = ty * 8 + ly, b = BAYER[(Y & 3) * 4 + (X & 3)];
      /* esquinas redondeadas donde el aire toca dos lados */
      if ((arr && izq && lx + ly < 2) || (arr && der && (7 - lx) + ly < 2) || (aba && izq && lx + (7 - ly) < 2) || (aba && der && (7 - lx) + (7 - ly) < 2)) continue;
      let v;
      if (pr >= 3) {
        const dd = Math.hypot(X - acx, (Y - acy) * 1.15) + Math.sin(X * 0.05) * 3 + ruidoLM(X >> 3, Y >> 3, 9) * 2;
        const anillo = dd % 9;
        v = anillo < 1 ? (b < 10 ? col.anillo : col.hondo) : anillo < 3 ? (b < 5 ? col.hondo : col.negro2) : (b < 2 ? col.negro2 : col.negro);
      }
      else if (pr === 2) v = b < 5 ? col.osc : col.negro2;
      else {
        v = col.madera;
        const fibra = ruidoLM(X >> 1, Y >> 3, 5);
        if (fibra > 0.72) v = col.vetas;
        else if (fibra < 0.08) v = col.clara;
        if (izq && lx === 0) v = col.clara;
        if (der && lx === 7) v = col.osc;
        if (aba && ly >= 6) v = ly === 7 ? col.osc : (b < 8 ? col.osc : v);
        if (arr && ly <= 2) {
          v = ly === 0 ? col.borde : ly === 1 ? col.clara : (b < 6 ? col.clara : v);
          /* musgo arriba del piso, a manchas */
          const mm = ruidoLM(X >> 2, ty, 21);
          if (mm > 0.45 && ly <= 1) v = ly === 0 ? col.musgoClaro : col.musgo;
        }
      }
      d[Y * W + X] = v;
    }
  }
  g.putImageData(id, 0, 0);
  g.translate(D, D);
  /* segunda pasada: lo que cuelga y lo que crece, fuera de las baldosas */
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    if (!sol(tx, ty)) continue;
    const X = tx * 8, Y = ty * 8;
    if (!sol(tx, ty + 1) && ty + 1 < h && mapa[ty + 1][tx] === '.') {
      const r = ruidoLM(tx, ty, 31);
      if (r > 0.7) {
        /* raicitas o gotas colgando del techo */
        const largo = 2 + Math.floor(ruidoLM(tx, ty, 32) * 6), x0 = X + 1 + Math.floor(r * 6);
        g.fillStyle = sala.zona === 'tela' ? 'rgba(210,220,245,0.5)' : Z.maderaOsc;
        g.fillRect(x0, Y + 8, 1, largo);
        if (sala.zona === 'raices' || sala.zona === 'hormiguero') { g.fillStyle = Z.musgoClaro; g.fillRect(x0, Y + 8 + largo, 1, 1); }
      }
    }
    if (!sol(tx, ty - 1) && ty > 0 && mapa[ty - 1][tx] === '.') {
      const r = ruidoLM(tx, ty, 41);
      if (sala.zona === 'pueblo' || sala.zona === 'raices') {
        /* pastito */
        g.fillStyle = Z.musgoClaro;
        for (let i = 0; i < 3; i++) if (ruidoLM(tx * 3 + i, ty, 42) > 0.55) g.fillRect(X + 1 + i * 3, Y - 1 - Math.floor(ruidoLM(tx, i, 43) * 2), 1, 1 + Math.floor(ruidoLM(i, ty, 44) * 2));
      } else if (sala.zona === 'tela' && r > 0.6) {
        g.fillStyle = 'rgba(220,228,250,0.35)'; g.fillRect(X, Y - 1, 8, 1);
      } else if (sala.zona === 'hormiguero' && r > 0.75) {
        g.fillStyle = Z.musgoClaro; g.fillRect(X + 3, Y - 1, 2, 1);
      }
    }
  }
  /* tablones, espinas y adornos */
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const ch = mapa[ty][tx], X = tx * 8, Y = ty * 8;
    if (ch === '=') tablon(g, Z, sala.zona, X, Y, mapa[ty][tx - 1] !== '=', mapa[ty][tx + 1] !== '=');
    else if ('^v<>'.includes(ch)) espinas(g, X, Y, ch);
    else if (ch === 'r') { g.fillStyle = Z.maderaOsc; const l = 6 + Math.floor(ruidoLM(tx, ty, 51) * 14); for (let i = 0; i < l; i++) g.fillRect(X + 3 + Math.round(Math.sin(i * 0.5 + tx) * 1.2), Y + i, 1, 1); g.fillStyle = Z.musgo; g.fillRect(X + 3, Y + l, 1, 1); }
    else if (ch === 't') telarana(g, X + 4, Y, 10 + Math.floor(ruidoLM(tx, ty, 52) * 8));
    else if (ch === 's') dibujarSprite(g, SPR.cosa.semilla, X + 4, Y + 8, 1);
    else if (ch === 'y') casita(g, X + 4, Y + 8, tx);
    else if (ch === 'f') { g.fillStyle = '#3a2a1e'; g.fillRect(X + 3, Y, 1, 6); }
  }
  if (cacheCapaLM.size >= 10) cacheCapaLM.delete(cacheCapaLM.keys().next().value);
  cacheCapaLM.set(k, c);
  return c;
}
function tablon(g, Z, zona, X, Y, ini, fin) {
  if (zona === 'raices') {
    /* sombrero de hongo: tapa clara, borde de abajo oscuro y pintitas */
    g.fillStyle = '#0a2a2a'; g.fillRect(X, Y + 3, 8, 1);
    g.fillStyle = '#1e7a78'; g.fillRect(X + (ini ? 1 : 0), Y + 1, 8 - (ini ? 1 : 0) - (fin ? 1 : 0), 2);
    g.fillStyle = '#4ad8c8'; g.fillRect(X + (ini ? 1 : 0), Y, 8 - (ini ? 1 : 0) - (fin ? 1 : 0), 1);
    g.fillStyle = '#c8fff6'; if ((X >> 3) % 2) g.fillRect(X + 3, Y + 1, 1, 1);
    if (ini) { g.fillStyle = '#a8a090'; g.fillRect(X + 3, Y + 4, 2, 4); }
  } else if (zona === 'tela') {
    g.fillStyle = 'rgba(220,228,250,0.85)'; g.fillRect(X, Y, 8, 1);
    g.fillStyle = 'rgba(180,190,220,0.45)'; g.fillRect(X, Y + 1, 8, 1);
    g.fillStyle = 'rgba(200,210,240,0.3)'; if (ini || fin) g.fillRect(X + (ini ? 0 : 7), Y - 6, 1, 6);
  } else {
    const [c1, c2] = zona === 'hormiguero' ? ['#a8583a', '#5a2616'] : ['#9a6a44', '#4a2a1a'];
    g.fillStyle = c2; g.fillRect(X, Y + 3, 8, 1);
    g.fillStyle = c1; g.fillRect(X, Y, 8, 3);
    g.fillStyle = '#d8a878'; g.fillRect(X + (ini ? 1 : 0), Y, 7, 1);
    g.fillStyle = c2; if ((X >> 3) % 2 === 0) g.fillRect(X + 7, Y, 1, 3);
    if (ini || fin) { g.fillStyle = '#6a5a40'; g.fillRect(X + (ini ? 1 : 6), Y - 8, 1, 8); }
  }
}
/* espinas de vinal: tres púas finas, pálidas, con la base oscura */
function espinas(g, X, Y, ch) {
  const pal = ['#2a1c10', '#8a6a3a', '#e8d6a0', '#fff6d8'];
  const px = (x, y, c) => {
    let gx, gy;
    /* '<' cuelga de una pared a la derecha y apunta a la izquierda; '>' al revés */
    if (ch === '^') { gx = x; gy = y; } else if (ch === 'v') { gx = x; gy = 7 - y; } else if (ch === '<') { gx = y; gy = x; } else { gx = 7 - y; gy = x; }
    g.fillStyle = pal[c]; g.fillRect(X + gx, Y + gy, 1, 1);
  };
  for (const b of [1, 4, 6]) {
    const alto = b === 4 ? 5 : 4;
    for (let i = 0; i < alto; i++) { px(b, 7 - i, i === alto - 1 ? 3 : i < 2 ? 1 : 2); if (i < 2) px(b + 1, 7 - i, 1); }
  }
  for (let x = 0; x < 8; x++) px(x, 7, 0);
}
/* una puerta redonda tallada en el tronco, con la ventanita prendida */
function casita(g, x, y, n) {
  g.fillStyle = '#2a1410';
  for (let yy = 0; yy < 12; yy++) { const a = yy < 5 ? Math.round(Math.sqrt(25 - (5 - yy) * (5 - yy))) : 5; g.fillRect(x - a, y - 12 + yy, a * 2, 1); }
  g.fillStyle = '#5a3222';
  for (let yy = 1; yy < 12; yy++) { const a = yy < 5 ? Math.round(Math.sqrt(16 - Math.min(16, (5 - yy) * (5 - yy)))) : 4; g.fillRect(x - a, y - 12 + yy, 1, 1); g.fillRect(x + a - 1, y - 12 + yy, 1, 1); }
  g.fillStyle = '#7a4a30'; g.fillRect(x - 3, y - 7, 6, 7);
  g.fillStyle = '#4a2a1a'; g.fillRect(x, y - 7, 1, 7);
  g.fillStyle = '#ffd98a'; g.fillRect(x + 1, y - 4, 1, 1);
  /* la ventanita, a un costado */
  const vx = x + (n % 2 ? -9 : 7);
  g.fillStyle = '#2a1410'; g.fillRect(vx - 1, y - 11, 5, 5);
  g.fillStyle = '#ffcf80'; g.fillRect(vx, y - 10, 3, 3);
  g.fillStyle = '#ffeec0'; g.fillRect(vx, y - 10, 1, 1);
}
function telarana(g, x, y, r) {
  g.strokeStyle = 'rgba(210,220,245,0.28)'; g.lineWidth = 1;
  g.beginPath();
  for (let a = 0; a < 5; a++) { const an = Math.PI * (0.1 + a * 0.2); g.moveTo(x + 0.5, y + 0.5); g.lineTo(x + 0.5 + Math.cos(an) * r, y + 0.5 + Math.sin(an) * r); }
  for (let k = 1; k <= 3; k++) { const rr = r * k / 3.4; g.moveTo(x + 0.5 + rr, y + 0.5); for (let a = 1; a <= 10; a++) { const an = Math.PI * a / 10; g.lineTo(x + 0.5 + Math.cos(an) * rr, y + 0.5 + Math.sin(an) * rr); } }
  g.stroke();
}

/* ---------------- lo que se mueve o cambia ---------------- */
function dibujarResina(g, m, ox, oy, t) {
  for (const q of m.pinchos) {
    if (!q.liquido) continue;
    for (let x = 0; x < q.w; x++) {
      const X = q.x + x, ola = Math.round(Math.sin(t * 2.4 + X * 0.21) * 1.1 + Math.sin(t * 1.3 + X * 0.07));
      const top = q.y - 1 + ola;
      g.fillStyle = '#fff0a0'; g.fillRect(ox + X, oy + top, 1, 1);
      g.fillStyle = '#ffb040'; g.fillRect(ox + X, oy + top + 1, 1, 2);
      g.fillStyle = '#d0641c'; g.fillRect(ox + X, oy + top + 3, 1, 3);
      g.fillStyle = '#7a2a0e'; g.fillRect(ox + X, oy + top + 6, 1, q.y + q.h - top - 6);
    }
    /* burbujas */
    for (let i = 0; i < q.w / 24; i++) {
      const k = (t * 0.6 + i * 0.37) % 1, bx = q.x + Math.floor(ruidoLM(i, Math.floor(t * 0.6 + i * 0.37), 61) * q.w);
      if (k < 0.6) { g.fillStyle = k < 0.45 ? '#ffd070' : '#fff6c0'; g.fillRect(ox + bx, oy + q.y + 6 - Math.floor(k * 10), 1, 1); }
    }
  }
}
function dibujarRompibles(g, m, ox, oy, t) {
  const Z = ZONA_ARTE[m.sala.zona];
  for (const r of m.rompibles) {
    const x = ox + r.x, y = oy + r.y;
    if (r.compuerta) {
      /* barrotes de raíz; se abren y se cierran de a poco */
      const k = r.abre != null ? r.abre : 1;
      g.fillStyle = '#07050a'; g.fillRect(x, y, r.w, r.h);
      const vertical = r.h >= r.w;
      const n = vertical ? Math.max(1, r.w / 3) : Math.max(2, Math.floor(r.w / 3));
      for (let i = 0; i < (vertical ? Math.max(2, Math.floor(r.h / 4)) : n); i++) {
        g.fillStyle = i % 2 ? Z.maderaClara : Z.borde;
        if (vertical) g.fillRect(x, y + i * 4, r.w, Math.max(0, Math.round(3 * k)));
        else g.fillRect(x + i * 3, y, Math.max(0, Math.round(2 * k)), r.h);
      }
      continue;
    }
    const tiem = r.t > 0 ? Math.round(Math.sin(t * 90) * 1) : 0;
    g.fillStyle = Z.maderaClara; g.fillRect(x + tiem, y, r.w, r.h);
    g.fillStyle = Z.madera; g.fillRect(x + tiem + 1, y + 1, r.w - 2, r.h - 2);
    g.fillStyle = Z.maderaOsc;
    for (let yy = 4; yy < r.h; yy += 8) g.fillRect(x + tiem, y + yy, r.w, 1);
    /* grietas que crecen con cada golpe */
    g.fillStyle = '#07050a';
    const golpes = 3 - r.vida;
    for (let i = 0; i < golpes * 3; i++) {
      const gx = Math.floor(ruidoLM(i, r.x, 71) * (r.w - 2)) + 1, gy = Math.floor(ruidoLM(i, r.y, 72) * (r.h - 3)) + 1;
      g.fillRect(x + tiem + gx, y + gy, 1, 2 + (i % 3));
    }
    if (r.t > 0) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, y, r.w, r.h); r.t -= Reloj.d; }
  }
}
function dibujarCosasLM(g, m, ox, oy, t, J) {
  for (const c of m.cosas) {
    const x = ox + c.x, y = oy + c.y;
    switch (c.tipo) {
      case 'banco': dibujarSprite(g, SPR.cosa.banco, x + 8, y + 8, 1); break;
      case 'farol': {
        const prendido = farolPrendido(c, J);
        /* la cadena hasta el techo */
        let ty = Math.floor(c.y / 8) - 1; while (ty > 0 && m.sala.mapa[ty][Math.floor(c.x / 8)] !== '#') ty--;
        g.fillStyle = '#2a2420'; for (let yy = (ty + 1) * 8; yy < c.y; yy += 2) g.fillRect(ox + c.x + 3, oy + yy, 2, 1);
        const bal = Math.round(Math.sin(t * 1.3) * 0.8);
        dibujarSprite(g, prendido ? SPR.cosa.farolPrendido : SPR.cosa.farol, x + 4 + bal, y + 14, 1);
        break;
      }
      case 'terron': dibujarSprite(g, SPR.cosa.terron, x + 4, y + 8, 1, c.flash > 0 ? { blanco: true } : null); if (c.flash > 0) c.flash -= Reloj.d; break;
      case 'chispaExtra': {
        const yy = y + 4 + Math.sin(t * 2.6) * 2;
        g.globalCompositeOperation = 'lighter'; brillo(g, x + 4, yy, 11, '246,255,168', 0.5); g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#ffffff'; g.fillRect(Math.round(x + 3), Math.round(yy - 1), 2, 2);
        g.fillStyle = '#f6ffa8'; g.fillRect(Math.round(x + 4), Math.round(yy - 3), 1, 6); g.fillRect(Math.round(x + 1), Math.round(yy), 6, 1);
        break;
      }
      case 'npc': {
        const s = SPR.npc[c.quien], f = s[Math.floor(t * 1.6 + c.x) % s.length];
        const px = x + 8, py = y + 16;
        if (c.quien === 'canasto') {
          /* cuelga de un hilo */
          const cy = py - 14 + Math.sin(t * 1.1) * 1.5;
          g.fillStyle = 'rgba(210,200,180,0.5)'; g.fillRect(px, oy, 1, Math.max(0, cy - 16 - oy + 1));
          dibujarSprite(g, f, px, cy, 1);
        } else {
          const dir = J.mundo.p.x + 4 < c.x + 8 ? -1 : 1;
          dibujarSprite(g, f, px, py, c.quien === 'mamboreta' || c.quien === 'vaquita' || c.quien === 'bolita' ? dir : 1);
        }
        if (c.cerca && J.estado === 'jugando') globoAccion(g, px, py - (c.quien === 'mamboreta' ? 24 : c.quien === 'canasto' ? 34 : 14), 'HABLAR', t);
        break;
      }
      case 'ambar': {
        g.fillStyle = '#7a3a10'; g.fillRect(Math.round(x), Math.round(y), 3, 3);
        g.fillStyle = '#ffb040'; g.fillRect(Math.round(x), Math.round(y), 2, 2);
        if ((t * 8 + c.x) % 4 < 1) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
        break;
      }
    }
  }
  /* los bancos ofrecen descanso */
  for (const c of m.cosas) if (c.tipo === 'banco' && c.cerca && J.estado === 'jugando' && !J.sentada) globoAccion(g, ox + c.x + 8, oy + c.y - 6, 'DESCANSAR', t);
  /* la sombra: la luz que quedó donde Chispa se apagó */
  const s = J.prog.sombra;
  if (s && s.sala === m.sala.id) {
    const yy = oy + s.y + Math.sin(t * 2.2) * 2;
    g.globalCompositeOperation = 'lighter'; brillo(g, ox + s.x, yy, 12, '159,184,255', 0.45); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#1a1030'; g.fillRect(Math.round(ox + s.x - 2), Math.round(yy - 2), 5, 5);
    g.fillStyle = '#c8d8ff'; g.fillRect(Math.round(ox + s.x - 1), Math.round(yy - 1), 1, 1); g.fillRect(Math.round(ox + s.x + 1), Math.round(yy - 1), 1, 1);
  }
}
function globoAccion(g, x, y, clave, t) {
  const b = Math.round(Math.sin(t * 5) * 1);
  textoFino(g, tr(clave === 'HABLAR' ? 'hablar' : 'descansar'), Math.round(x), Math.round(y - 10 + b), { alin: 'centro', col: '#fff6d8', halo: '#f6ffa8' });
  g.fillStyle = '#f6ffa8';
  g.fillRect(Math.round(x) - 1, Math.round(y + b) - 1, 3, 1); g.fillRect(Math.round(x), Math.round(y + b) - 2, 1, 1);
}


/* ---------------- bichos, balas y jefes ---------------- */
/* dónde tiene los ojos cada bicho (el primer píxel 'e' de su dibujo): en lo
   oscuro, lo primero que se ve de un bicho son los ojos */
const OJOS_LM = {};
function ojosDe(tipo) {
  if (OJOS_LM[tipo] !== undefined) return OJOS_LM[tipo];
  const f = DIB_BICHO[tipo] && DIB_BICHO[tipo][0], col = PAL_BICHO[tipo] && PAL_BICHO[tipo].e;
  let r = null;
  if (f && col) for (let y = 0; y < f.length && !r; y++) { const x = f[y].indexOf('e'); if (x >= 0) r = { x, y, w: f[0].length, h: f.length, col: hexRGB(col).join(',') }; }
  return (OJOS_LM[tipo] = r);
}
function dibujarBichosLM(g, m, ox, oy, t) {
  for (const b of m.bichos) {
    if (b.muerto) continue;
    const s = SPR.bichos[b.tipo];
    let f = s[Math.floor(t * (b.vuela ? 12 : 6) + b.x0) % 2];
    if (b.tipo === 'grillo') f = !pisaLM(m, b) ? s[2] : b.espera < 0.2 ? s[1] : s[0];
    if (b.tipo === 'aranita' && b.est === 'cuelga') { g.fillStyle = 'rgba(210,220,245,0.5)'; g.fillRect(ox + Math.round(b.x + b.w / 2), oy, 1, Math.max(0, Math.round(b.y))); }
    const dir = b.tipo === 'polilla' ? 1 : b.dir;
    /* al recibir el golpe se aplasta y se pone blanco */
    dibujarSprite(g, f, ox + b.x + b.w / 2, oy + b.y + b.h + (b.tipo === 'mosquito' ? 1 : 0), dir, b.flash > 0 ? { blanco: true, sx: 1.25, sy: 0.8 } : null);
    if (b.tipo === 'hormiga' && b.est === 'carga') { g.fillStyle = '#ffcc60'; g.fillRect(ox + Math.round(b.x + (b.dir > 0 ? b.w + 1 : -2)), oy + Math.round(b.y + 2), 1, 1); }
  }
}
function dibujarBalasLM(g, m, ox, oy, t) {
  for (const b of m.balas) {
    const x = Math.round(ox + b.x), y = Math.round(oy + b.y);
    switch (b.tipo) {
      case 'onda':
        for (let i = -b.r; i <= b.r; i++) {
          const h = Math.round((1 - Math.abs(i) / (b.r + 1)) * (b.alto + 2) + Math.sin(t * 40 + i) * 1);
          g.fillStyle = Math.abs(i) < 2 ? '#fff0c8' : '#c8a070'; g.fillRect(x + i, y + b.alto - h, 1, h);
        }
        break;
      case 'roca':
        if (b.cae != null && b.cae > 0) {
          /* polvo que cae del techo: el aviso */
          g.fillStyle = '#b09070';
          for (let i = 0; i < 3; i++) g.fillRect(x - 2 + i * 2, Math.round(oy + 8 + ((t * 60 + i * 7) % 20)), 1, 1);
        } else { g.fillStyle = '#3a2a1a'; g.fillRect(x - 4, y - 4, 8, 8); g.fillStyle = '#7a5a3a'; g.fillRect(x - 3, y - 4, 6, 2); g.fillStyle = '#1a120a'; g.fillRect(x - 4, y + 3, 8, 1); }
        break;
      case 'baba': g.fillStyle = '#4a7a2a'; g.fillRect(x - 2, y - 2, 4, 4); g.fillStyle = '#b8e060'; g.fillRect(x - 1, y - 2, 2, 1); break;
      case 'tela': g.fillStyle = '#e8ecff'; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = '#9098b8'; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 2, 1, 1); break;
      case 'acido': g.fillStyle = '#c8e020'; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = '#f8ffa0'; g.fillRect(x - 1, y - 2, 2, 2); g.fillStyle = 'rgba(200,224,32,0.4)'; g.fillRect(x - Math.round(sig(b.vx) * 4), y - 1, 3, 3); break;
    }
  }
}
function dibujarJefeLM(g, m, ox, oy, t) {
  const j = m.jefe;
  if (!j) return;
  if (j.muerto && j.t > 1.4) return;
  const blanco = j.flash > 0 || (j.muerto && Math.floor(j.t * 20) % 2 === 0);
  const temb = (j.est.endsWith('Prep') || j.muerto) ? Math.round(Math.sin(t * 70) * 1) : 0;
  const x = ox + j.x + j.w / 2 + temb, y = oy + j.y + j.h;
  if (j.tipo === 'torito') {
    const S = SPR.torito;
    let s = S.a, sx = 1, sy = 1;
    if (j.est === 'carga') s = Math.floor(t * 14) % 2 ? S.a : S.b;
    else if (j.est === 'cargaPrep' || j.est === 'cornadaPrep') { s = S.enojado; sx = 1.06; sy = 0.92; }
    else if (j.est === 'salto') s = S.salta;
    else if (j.est === 'saltoPrep' || j.est === 'aterriza') { sx = 1.12; sy = 0.86; }
    else if (j.est === 'espera' || j.est === 'presenta') s = Math.floor(t * 3) % 2 ? S.a : S.b;
    const lunge = j.est === 'cornada' && j.t < 0.2 ? j.dir * 5 : 0;
    dibujarSprite(g, s, x + lunge, y + 2, j.dir, { blanco, sx, sy });
    if (j.est === 'mareado') for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; g.fillStyle = i % 2 ? '#ffe080' : '#ffffff'; g.fillRect(Math.round(x + j.dir * 10 + Math.cos(a) * 8), Math.round(y - j.h - 4 + Math.sin(a) * 3), 2, 2); }
  } else if (j.tipo === 'viuda') {
    g.fillStyle = 'rgba(220,228,250,0.55)'; g.fillRect(Math.round(x), oy, 1, Math.max(0, Math.round(oy + j.y) - oy + 1));
    const s = SPR.viuda[Math.floor(t * (j.est === 'arriba' ? 5 : 2)) % 2];
    dibujarSprite(g, s, x, oy + j.y - 1, 1, { blanco });
  } else {
    const pr = j.est.endsWith('Prep');
    dibujarSprite(g, SPR.reina, x, y + 1, j.dir, { blanco, sx: j.est === 'golpePrep' ? 1.06 : 1, sy: j.est === 'golpePrep' ? 0.94 : 1 });
    if (pr && Math.floor(t * 10) % 2) { g.fillStyle = '#ffd23a'; g.fillRect(Math.round(x + j.dir * 16), Math.round(y - j.h + 8), 2, 2); }
  }
}

/* ---------------- Chispa ---------------- */
function animLM() { return { sx: 1, sy: 1, parpadeo: 2, estela: [], flash: 0, corre: 0, cola: [], quieta: 0, alas: 0, paso: -1, dir: 0 }; }
function pasarAnimLM(A, m) {
  const p = m.p;
  A.sx = acercar(A.sx, 1, 4 * DT); A.sy = acercar(A.sy, 1, 4 * DT);
  A.parpadeo -= DT; if (A.parpadeo < -0.12) A.parpadeo = 2 + Math.random() * 3;
  if (A.flash > 0) A.flash--;
  A.corre += Math.abs(p.vx) * DT;
  if (p.dashT > 0) A.estela.push({ x: p.x, y: p.y, dir: p.dir, v: 1 });
  for (const e of A.estela) e.v -= 0.12;
  while (A.estela.length && A.estela[0].v <= 0) A.estela.shift();
  if (p.muerta) return;
  /* al darse vuelta en el piso se aplasta un toque */
  if (A.dir && A.dir !== p.dir && p.enSuelo) { A.sx = 0.72; A.sy = 1.12; }
  A.dir = p.dir;
  /* quieta un rato: cada tanto se sacude las alas */
  const quieta = p.enSuelo && Math.abs(p.vx) < 10 && !p.golpe && !p.curando;
  A.quieta = quieta ? A.quieta + DT : 0;
  if (A.alas > 0) A.alas -= DT;
  else if (A.quieta > 3 && Math.random() < DT * 0.3) A.alas = 0.55;
  /* las pisadas levantan polvito */
  const Z = ZONA_ARTE[m.sala.zona];
  if (p.enSuelo && Math.abs(p.vx) > 10) {
    const f = Math.floor(A.corre / 6) % 6;
    if (f !== A.paso && (f === 0 || f === 3)) FX.emitir(p.x + 4 - p.dir * 2, p.y + 12, 1, { cols: Z.polvo, vx: -p.dir * 14, vy: -8, disp: 6, vida: 12, arrastre: 0.9 });
    A.paso = f;
  } else A.paso = -1;
  /* resbalando por la resina de la pared: gotitas que caen */
  if (p.pared && Math.random() < 0.3) FX.emitir(p.x + 4 + p.pared * 5, p.y + 3, 1, { cols: ['#ffb040', '#ffe08a', Z.maderaClara], vy: 30, disp: 4, g: 200, vida: 16 });
  /* la luz de la cola deja estela cuando va rápido */
  if (Math.hypot(p.vx, p.vy) > 70) A.cola.push({ x: p.x + 4 - p.dir * 5, y: p.y + 9, v: 1 });
  for (const c of A.cola) c.v -= 0.08;
  while (A.cola.length && A.cola[0].v <= 0) A.cola.shift();
}
function spriteChispa(m, A, J) {
  const p = m.p, S = SPR.chispa, t = VistaLM.t;
  if (p.muerta) return S.apagada;
  if (J.sentada) return S.sentada;
  if (p.curando) return S.cura[Math.floor(t * 6) % 2];
  if (p.invulnT > LF.INVULN - 0.3) return S.duele;
  if (p.dashT > 0) return S.dash;
  if (p.golpe) {
    if (p.golpe.tipo === 'arr') return S.golpeArr;
    if (p.golpe.tipo === 'aba') return S.golpeAba;
    return p.golpe.t < 0.035 ? S.golpePrep : p.golpe.t < 0.13 ? S.golpe : S.golpeFin;
  }
  if (p.pared) return S.pared;
  if (!p.enSuelo) return p.vy < -40 ? S.sube : S.cae[Math.floor(t * 8) % 2];
  if (Math.abs(p.vx) > 10) return S.corre[Math.floor(A.corre / 6) % 6];
  if (A.alas > 0) return S.alas[Math.floor(t * 14) % 2];
  if (A.parpadeo < 0) return S.parpadea;
  return S.quieta[Math.floor(t * 2.6) % 4];
}
function dibujarChispa(g, m, A, ox, oy, J) {
  const p = m.p;
  for (const e of A.estela) dibujarSprite(g, SPR.chispa.dash, ox + e.x + 4, oy + e.y + 12, e.dir, { blanco: true, alfa: e.v * 0.35 });
  if (A.cola.length) {
    g.globalCompositeOperation = 'lighter';
    for (const c of A.cola) { g.fillStyle = `rgba(246,255,168,${c.v * 0.55})`; g.fillRect(Math.round(ox + c.x), Math.round(oy + c.y), 1, 1); }
    g.globalCompositeOperation = 'source-over';
  }
  /* titila mientras es invulnerable */
  if (p.invulnT > 0 && !p.muerta && Math.floor(p.invulnT * 16) % 2 === 0 && p.invulnT < LF.INVULN - 0.3) return;
  const s = spriteChispa(m, A, J);
  const dy = J.sentada ? -5 : 0;
  dibujarSprite(g, s, ox + p.x + 4, oy + p.y + 12 + dy, p.dir, { sx: A.sx, sy: A.sy, blanco: A.flash > 0 });
  /* la cola brilla sola, y late despacio */
  if (!p.muerta) { g.globalCompositeOperation = 'lighter'; brillo(g, ox + p.x + 4 - p.dir * 4, oy + p.y + 9 + dy, 6, '246,255,168', 0.22 + Math.sin(VistaLM.t * 3) * 0.08); g.globalCompositeOperation = 'source-over'; }
  /* el tajo de la espina */
  if (p.golpe && p.golpe.t < LF.GOLPE_T * 0.55) {
    const G = p.golpe, fr = Math.min(2, Math.floor(G.t / 0.035)), T = SPR.tajo[G.tipo][fr];
    const c = cajaGolpe(p);
    let x = ox + c.x, y = oy + c.y;
    if (G.tipo === 'lado') {
      if (G.dir < 0) { g.save(); g.translate(Math.round(x + c.w), Math.round(y - 1)); g.scale(-1, 1); g.drawImage(T, 0, 0); g.restore(); }
      else g.drawImage(T, Math.round(x - 2), Math.round(y - 1));
    } else g.drawImage(T, Math.round(x - 1), Math.round(G.tipo === 'arr' ? y - 2 : y));
  }
}

/* ---------------- la luz: oscuridad suave con agujeros de luz, y el brillo encima ----------------
   No es la trama de ZONDA: la oscuridad se pinta a media resolución en un
   lienzo aparte, las luces le cortan agujeros con degradés radiales y se
   agranda suavizada. Después, encima, cada luz suma su color. */
let lienzoOscLM = null;
function oscuridadLM(g, luces, fuerza) {
  const W = Pantalla.W, H = Pantalla.H, w = Math.ceil(W / 2), h = Math.ceil(H / 2);
  if (!lienzoOscLM || lienzoOscLM.width !== w || lienzoOscLM.height !== h) lienzoOscLM = lienzoLM(w, h);
  const q = lienzoOscLM.getContext('2d');
  q.globalCompositeOperation = 'source-over';
  q.clearRect(0, 0, w, h);
  q.fillStyle = `rgba(5,3,8,${lim(fuerza * 0.88, 0, 0.94)})`;
  q.fillRect(0, 0, w, h);
  /* la viñeta: los bordes, más oscuros */
  const v = q.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.35, w / 2, h * 0.42, Math.max(w, h) * 0.72);
  v.addColorStop(0, 'rgba(5,3,8,0)'); v.addColorStop(1, 'rgba(5,3,8,0.45)');
  q.fillStyle = v; q.fillRect(0, 0, w, h);
  q.globalCompositeOperation = 'destination-out';
  for (const l of luces) {
    if (l.solo) continue;
    const x = l.x / 2, y = l.y / 2, r = l.r / 2, k = l.k || 1;
    if (x + r < 0 || x - r > w || y + r < 0 || y - r > h || r <= 0) continue;
    const grd = q.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(0,0,0,${k})`); grd.addColorStop(0.5, `rgba(0,0,0,${k * 0.62})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = grd; q.fillRect(x - r, y - r, r * 2, r * 2);
  }
  q.globalCompositeOperation = 'source-over';
  g.save(); g.imageSmoothingEnabled = true; g.drawImage(lienzoOscLM, 0, 0, w * 2, h * 2); g.restore();
}
/* el farol del pueblo se prende con el primero que vuelva a tener luz */
function farolPrendido(c, J) { return c.zona === 'pueblo' ? Object.keys(J.prog.faroles).length > 0 : !!J.prog.faroles[c.zona]; }
/* cuánta oscuridad tiene la sala ahora: la zona, si su farol está prendido,
   y la Reina que apaga todo a mitad de la pelea */
function oscuroDe(m, J) {
  const zona = m.sala.zona;
  let f = ZONAS[zona].luz;
  if (zona === 'pueblo') f *= 1 - 0.18 * Object.keys(J.prog.faroles).length;
  else if (J.prog.faroles[zona]) f *= 0.55;
  if (m.oscuro) f = Math.max(f, 1);
  return f;
}
/* cada luz: dónde, qué tan grande, cuánto corta la oscuridad y de qué color brilla */
function lucesDe(m, J, ox, oy, t) {
  const p = m.p, luces = [];
  const r0 = 44 + p.luz * 0.2 + (p.curando ? 12 + Math.sin(t * 20) * 3 : 0);
  if (!p.muerta || p.tMuerta < 0.8) luces.push({ x: ox + p.x + 4, y: oy + p.y + 7, r: p.muerta ? r0 * (1 - p.tMuerta / 0.8) : r0, col: '200,255,120', a: 0.2 });
  for (const a of m.adornos) {
    if (a.c === 'h') luces.push({ x: ox + a.x + 4, y: oy + a.y + 5, r: 24, k: 0.8, col: '80,220,200', a: 0.16 });
    else if (a.c === 'y') luces.push({ x: ox + a.x + 4 + ((a.x >> 3) % 2 ? -8 : 8), y: oy + a.y - 1, r: 32, k: 0.85, col: '255,190,110', a: 0.18 });
    else if (a.c === 'f') luces.push({ x: ox + a.x + 4, y: oy + a.y + 8, r: 42 + Math.sin(t * 9 + a.x) * 2, k: 0.9, col: '255,200,120', a: 0.22 });
  }
  for (const c of m.cosas) {
    if (c.tipo === 'banco') luces.push({ x: ox + c.x + 8, y: oy + c.y + 2, r: 36, k: 0.9, col: '90,230,210', a: 0.2 });
    else if (c.tipo === 'farol' && farolPrendido(c, J)) luces.push({ x: ox + c.x + 4, y: oy + c.y + 8, r: 104, col: '255,200,110', a: 0.3 });
    else if (c.tipo === 'chispaExtra') luces.push({ x: ox + c.x + 4, y: oy + c.y + 4, r: 28, col: '246,255,168', a: 0.3 });
    else if (c.tipo === 'npc') luces.push({ x: ox + c.x + 8, y: oy + c.y + 8, r: 28, k: 0.7 });
    else if (c.tipo === 'ambar') luces.push({ x: ox + c.x + 1, y: oy + c.y + 1, r: 9, k: 0.8, col: '255,170,60', a: 0.3 });
  }
  for (const b of m.bichos) {
    const o = !b.muerto && ojosDe(b.tipo);
    if (!o) continue;
    const dir = b.tipo === 'polilla' ? 1 : b.dir, cx = ox + b.x + b.w / 2, by = oy + b.y + b.h + (b.tipo === 'mosquito' ? 1 : 0);
    const dx = Math.round(cx - (dir < 0 ? o.w - (o.w >> 1) : o.w >> 1));
    luces.push({ x: dx + (dir < 0 ? o.w - 1 - o.x : o.x) + 0.5, y: Math.round(by - o.h) + o.y + 0.5, r: 9, col: o.col, a: 0.5 + Math.sin(t * 5 + b.x0) * 0.12, solo: true });
  }
  for (const q of m.pinchos) if (q.liquido) for (let x = q.x + 8; x < q.x + q.w; x += 20) luces.push({ x: ox + x, y: oy + q.y, r: 28, k: 0.85, col: '255,150,60', a: 0.16 });
  for (const b of m.balas) if (b.tipo === 'acido') luces.push({ x: ox + b.x, y: oy + b.y, r: 12, k: 0.8, col: '220,255,60', a: 0.3 });
  const s = J.prog.sombra;
  if (s && s.sala === m.sala.id) luces.push({ x: ox + s.x, y: oy + s.y, r: 24, k: 0.8, col: '150,180,255', a: 0.25 });
  if (m.jefe && m.jefe.tipo === 'reina' && !m.jefe.muerto) luces.push({ x: ox + m.jefe.x + (m.jefe.dir < 0 ? 8 : m.jefe.w - 8), y: oy + m.jefe.y + 10, r: 22, k: 0.7, col: '255,210,60', a: 0.3 });
  if (J.orbeFarol) luces.push({ x: ox + J.orbeFarol.x, y: oy + J.orbeFarol.y, r: 40, col: '255,240,170', a: 0.5 });
  for (const a of J.ambiente) luces.push({ x: ox + a.x, y: oy + a.y, r: 10, k: 0.4 });
  return luces;
}
/* el brillo: cada luz suma su color encima de la oscuridad */
function brilloLuces(g, luces) {
  g.globalCompositeOperation = 'lighter';
  for (const l of luces) if (l.col) brillo(g, l.x, l.y, l.r * 0.62, l.col, l.a || 0.2);
  g.globalCompositeOperation = 'source-over';
}

/* ---------------- lo de adelante: siluetas que pasan más rápido que la sala ---------------- */
const cacheFrente = new Map();
function frenteDe(zona, arriba) {
  const k = zona + arriba;
  if (cacheFrente.has(k)) return cacheFrente.get(k);
  const W = 320, H = arriba ? 26 : 14, c = lienzoLM(W, H), g = c.getContext('2d');
  g.fillStyle = '#030206';
  for (let x = 0; x < W; x++) {
    const n = ruidoLM(x >> 3, arriba ? 1 : 2, 131), n2 = ruidoLM(x, 3, 132);
    if (arriba) {
      /* raíces colgando, telas o gotas, según la zona */
      if (zona === 'tela') { if (n2 > 0.985) { g.fillStyle = 'rgba(200,210,240,0.25)'; g.fillRect(x, 0, 1, 10 + n * 16); g.fillStyle = '#030206'; } }
      else if (n > 0.62) { const largo = 3 + Math.round((n - 0.62) * 50 + Math.sin(x * 0.7) * 2); g.fillRect(x, 0, 1, Math.min(H, largo)); }
      else if (n2 > 0.97) g.fillRect(x, 0, 1, 4 + n * 14);
      g.fillRect(x, 0, 1, 2 + Math.round(n * 3));
    } else {
      const alto = zona === 'pueblo' || zona === 'raices' ? Math.round(n * 6 + (n2 > 0.9 ? 5 : 0)) : Math.round(n * 3);
      g.fillRect(x, H - alto, 1, alto);
    }
  }
  cacheFrente.set(k, c);
  return c;
}
function dibujarFrente(g, zona) {
  const W = Pantalla.W, U = VistaLM.usable || Pantalla.H;
  for (const arriba of [true, false]) {
    const f = frenteDe(zona, arriba), T = f.width;
    const x0 = -Math.round((VistaLM.x * 1.35) % T) - (VistaLM.x < 0 ? T : 0);
    g.globalAlpha = 0.9;
    for (let x = x0 - T; x < W; x += T) g.drawImage(f, x, arriba ? 0 : U - f.height);
    g.globalAlpha = 1;
  }
}

/* ---------------- los efectos del mundo ---------------- */
function dibujarCadaveres(g, J, ox, oy) {
  for (const c of J.cadaveres) {
    const s = SPR.bichos[c.tipo];
    if (!s) continue;
    const a = 1 - c.t / 0.7;
    g.save(); g.globalAlpha = Math.max(0, a);
    g.translate(Math.round(ox + c.x), Math.round(oy + c.y)); g.scale(1, -1);
    dibujarSprite(g, s[0], 0, 0, c.dir, { blanco: c.t < 0.08 });
    g.restore();
  }
}
function dibujarEfectosLuz(g, J, ox, oy, t) {
  g.globalCompositeOperation = 'lighter';
  /* bichitos de luz que titilan en el aire */
  for (const a of J.ambiente) {
    const on = Math.sin(a.f * 3.1) * 0.5 + 0.5;
    if (on < 0.15) continue;
    const col = J.mundo.sala.zona === 'hormiguero' ? '255,170,80' : J.mundo.sala.zona === 'tela' ? '190,210,255' : '200,255,120';
    brillo(g, ox + a.x, oy + a.y, 5, col, 0.4 * on);
    g.fillStyle = `rgba(${col},${on})`; g.fillRect(Math.round(ox + a.x), Math.round(oy + a.y), 1, 1);
  }
  /* las ondas: al golpear, al rugir, al prenderse un farol */
  for (const o of J.ondas) {
    if (o.t < 0) continue;
    const k = o.t / o.dur, e = 1 - Math.pow(1 - k, 3);
    g.strokeStyle = `rgba(${o.col},${(1 - k) * 0.7})`; g.lineWidth = o.r > 40 ? 2 : 1;
    g.beginPath(); g.arc(Math.round(ox + o.x) + 0.5, Math.round(oy + o.y) + 0.5, Math.max(1, o.r * e), 0, Math.PI * 2); g.stroke();
  }
  /* los rayos del jefe vencido */
  if (J.rayos) {
    const r = J.rayos, k = r.t < 0.3 ? r.t / 0.3 : Math.max(0, 1 - (r.t - 1.2) / 1.4);
    g.save(); g.translate(ox + r.x, oy + r.y); g.rotate(r.t * 0.8);
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      const largo = 60 + (i % 3) * 30;
      const grd = g.createLinearGradient(0, 0, 0, -largo);
      grd.addColorStop(0, `rgba(255,250,220,${0.4 * k})`); grd.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = grd; g.beginPath(); g.moveTo(0, 0); g.lineTo(-4 - i % 2 * 3, -largo); g.lineTo(4 + i % 2 * 3, -largo); g.closePath(); g.fill();
    }
    g.restore();
    brillo(g, ox + r.x, oy + r.y, 40, '255,250,220', 0.5 * k);
  }
  /* la luz que viaja al farol */
  if (J.orbeFarol) { const f = J.orbeFarol; brillo(g, ox + f.x, oy + f.y, 16, '255,240,170', 0.8); brillo(g, ox + f.x, oy + f.y, 4, '255,255,255', 1); }
  /* curándose: un anillo de luz que se cierra sobre Chispa */
  const p = J.mundo.p;
  if (p.curando) {
    const dur = p.curaRapida ? LF.CURAR_T * 0.6 : LF.CURAR_T, k = (p.curarT % dur) / dur;
    g.strokeStyle = `rgba(246,255,168,${0.3 + k * 0.5})`; g.lineWidth = 1;
    g.beginPath(); g.arc(Math.round(ox + p.x + 4) + 0.5, Math.round(oy + p.y + 6) + 0.5, 18 * (1 - k) + 3, 0, Math.PI * 2); g.stroke();
    if (Math.random() < 0.5) { const a = Math.random() * Math.PI * 2; FX.emitir(p.x + 4 + Math.cos(a) * 18, p.y + 6 + Math.sin(a) * 18, 1, { col: '#f6ffa8', vx: -Math.cos(a) * 50, vy: -Math.sin(a) * 50, disp: 2, vida: 20, arrastre: 0.95 }); }
  }
  g.globalCompositeOperation = 'source-over';
}

/* ---------------- un cuadro de juego ---------------- */
function dibujarSalaLM(g, J, t) {
  const m = J.mundo;
  const ox = -Math.round(VistaLM.x) + FX.sx, oy = -Math.round(VistaLM.y) + FX.sy;
  dibujarFondoLM(g, m.sala.zona);
  FX.dibujar(g, -ox, -oy, true);
  const D = MARGEN_LM * 8;
  g.drawImage(capaLM(m), ox - D, oy - D);
  /* más allá del margen (pantallas enormes), negro */
  const W = Pantalla.W, H = Pantalla.H, sw = m.w * 8 + D, sh = m.h * 8 + D;
  g.fillStyle = '#060409';
  if (oy - D > 0) g.fillRect(0, 0, W, oy - D);
  if (oy + sh < H) g.fillRect(0, oy + sh, W, H - oy - sh);
  if (ox - D > 0) g.fillRect(0, 0, ox - D, H);
  if (ox + sw < W) g.fillRect(ox + sw, 0, W - ox - sw, H);
  dibujarResina(g, m, ox, oy, t);
  dibujarRompibles(g, m, ox, oy, t);
  for (const a of m.adornos) {
    if (a.c === 'h') dibujarSprite(g, SPR.cosa.hongo, ox + a.x + 4, oy + a.y + 8, 1);
    else if (a.c === 'f') {
      const x = ox + a.x + 2, y = oy + a.y + 6, on = Math.sin(t * 9 + a.x) > -0.8;
      g.fillStyle = '#1a120c'; g.fillRect(x, y, 4, 5);
      g.fillStyle = on ? '#ffcf80' : '#c89050'; g.fillRect(x + 1, y + 1, 2, 3);
      g.fillStyle = '#fff0c8'; if (on) g.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  dibujarCosasLM(g, m, ox, oy, t, J);
  dibujarBichosLM(g, m, ox, oy, t);
  dibujarCadaveres(g, J, ox, oy);
  dibujarJefeLM(g, m, ox, oy, t);
  dibujarChispa(g, m, J.anim, ox, oy, J);
  dibujarBalasLM(g, m, ox, oy, t);
  FX.dibujar(g, -ox, -oy, false);
  const luces = lucesDe(m, J, ox, oy, t);
  oscuridadLM(g, luces, oscuroDe(m, J));
  brilloLuces(g, luces);
  dibujarEfectosLuz(g, J, ox, oy, t);
  dibujarFrente(g, m.sala.zona);
  /* abajo, donde van los pulgares: un degradé oscuro para que los mandos se lean */
  if (VistaLM.mandos) {
    const y0 = VistaLM.usable, grd = g.createLinearGradient(0, y0 - 6, 0, y0 + 30);
    grd.addColorStop(0, 'rgba(5,3,8,0)'); grd.addColorStop(1, 'rgba(5,3,8,0.94)');
    g.fillStyle = grd; g.fillRect(0, y0 - 6, Pantalla.W, Pantalla.H - y0 + 6);
  }
}

/* ---------------- el HUD: la vasija de luz, las chispas de vida y el ámbar ---------------- */
function dibujarHUD(g, J, t) {
  const p = J.mundo.p, x0 = 6, y0 = 6;
  /* la vasija: se llena de abajo para arriba; late cuando alcanza para curarse */
  const R = 8, cx = x0 + R, cy = y0 + R, nivel = p.luz / LF.LUZ_MAX, alcanza = p.luz >= LF.CURAR_COSTO;
  if (J.vasija > 0 || alcanza) { g.globalCompositeOperation = 'lighter'; brillo(g, cx, cy, 14 + J.vasija * 8, '246,255,168', 0.12 + J.vasija * 0.35 + (alcanza ? Math.sin(t * 6) * 0.05 + 0.05 : 0)); g.globalCompositeOperation = 'source-over'; }
  for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
    const d = Math.hypot(xx + 0.5, yy + 0.5);
    if (d > R + 0.5) continue;
    let col = null;
    if (d > R - 1) col = '#0d0a14';
    else if (d > R - 2) col = J.vasija > 0.3 ? '#f6ffd0' : '#6a6080';
    else {
      const h = (R - 2 - yy) / (2 * (R - 2));
      const ola = Math.sin(t * 3 + xx * 0.6) * 0.03;
      col = h < nivel + ola ? (h > nivel - 0.08 ? '#ffffff' : (alcanza && Math.sin(t * 6) > 0.3 ? '#f6ffa8' : '#c8e870')) : '#1a1426';
    }
    g.fillStyle = col; g.fillRect(cx + xx, cy + yy, 1, 1);
  }
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(cx - 4, cy - 5, 2, 1);
  /* las chispas de vida */
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < p.vida; i++) brillo(g, x0 + 2 * R + 9 + i * 9, y0 + 6, 6, '246,255,168', 0.18);
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < p.vidaMax; i++) {
    const x = x0 + 2 * R + 6 + i * 9, y = y0 + 3, llena = i < p.vida;
    if (llena) {
      g.fillStyle = '#0d0a14'; g.fillRect(x, y + 1, 7, 5); g.fillRect(x + 1, y, 5, 7);
      g.fillStyle = '#b4e858'; g.fillRect(x + 1, y + 1, 5, 5);
      g.fillStyle = '#f6ffa8'; g.fillRect(x + 2, y + 1, 3, 4);
      g.fillStyle = '#ffffff'; g.fillRect(x + 2, y + 2, 1, 1);
    } else {
      g.fillStyle = '#0d0a14'; g.fillRect(x, y + 1, 7, 5); g.fillRect(x + 1, y, 5, 7);
      g.fillStyle = '#2a2238'; g.fillRect(x + 1, y + 1, 5, 5);
      g.fillStyle = '#141020'; g.fillRect(x + 2, y + 2, 3, 3);
    }
  }
  /* ámbar */
  const ax = x0 + 2 * R + 6, ay = y0 + 13;
  g.fillStyle = '#0d0a14'; g.fillRect(ax, ay, 5, 5);
  g.fillStyle = '#f0a03a'; g.fillRect(ax + 1, ay + 1, 3, 3); g.fillStyle = '#ffe08a'; g.fillRect(ax + 1, ay + 1, 1, 1);
  /* el contador se acerca de a pasos que no son enteros: se muestra redondeado */
  const ambar = String(Math.round(J.ambarVisto));
  textoFino(g, ambar, ax + 8, ay - 1, { col: '#ffd98a' });
  if (J.ambarMas > 0) textoFino(g, '+' + J.ambarMas, ax + 8 + anchoFino(ambar) + 4, ay - 1, { col: '#fff0a0', halo: '#ffb050' });
  /* la barra del jefe */
  const j = J.mundo.jefe;
  if (j && !j.muerto && j.est !== 'presenta') {
    const W = Pantalla.W, bw = Math.min(180, W - 40), bx = Math.round((W - bw) / 2), by = VistaLM.usable - 14;
    textoFino(g, TX().jefes[j.tipo].nombre, W / 2, by - 11, { alin: 'centro', col: '#ffd0c0', halo: '#ff6a5a' });
    g.fillStyle = '#0d0a14'; g.fillRect(bx - 1, by - 1, bw + 2, 6);
    g.fillStyle = '#2a1418'; g.fillRect(bx, by, bw, 4);
    const k = Math.max(0, j.vida / j.vidaMax);
    J.barraJefe = J.barraJefe == null ? k : acercar(J.barraJefe, k, 0.4 * Reloj.d);
    g.fillStyle = '#fff0c8'; g.fillRect(bx, by, Math.round(bw * J.barraJefe), 4);
    g.fillStyle = '#c42a3c'; g.fillRect(bx, by, Math.round(bw * k), 4);
    g.fillStyle = '#ff6a5a'; g.fillRect(bx, by, Math.round(bw * k), 1);
  }
}
