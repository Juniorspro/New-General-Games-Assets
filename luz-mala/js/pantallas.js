/* ============================================================================
   luz-mala/js/pantallas.js — lo que no es la sala: la portada, la intro, los
   diálogos, el nombre de la zona al entrar, el cartel del jefe, los hallazgos,
   el mapa y el final. Todo dibujado en el lienzo del mundo, en píxeles.
   ========================================================================== */

/* ---------------- la portada: el monte de noche y el quebracho ---------------- */
const Portada = { bichos: [], estrellas: null, arbol: null };
function prepararPortada(W, H) {
  if (Portada.estrellas && Portada.estrellas.width === W && Portada.estrellas.height === H) return;
  const c = lienzoLM(W, H), g = c.getContext('2d');
  /* cielo del Chaco: violeta profundo arriba, casi negro abajo, en bandas tramadas */
  const cols = ['#0a0a1a', '#0e0c20', '#140e26', '#1a1028', '#1e1226'];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = lim(Math.floor((y / H) * 5 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5), 0, 4);
    g.fillStyle = cols[k]; g.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < W * H / 260; i++) {
    const x = Math.floor(ruidoLM(i, 1, 81) * W), y = Math.floor(ruidoLM(i, 2, 82) * H * 0.62);
    g.fillStyle = ruidoLM(i, 3, 83) > 0.85 ? '#ffffff' : '#8a88b8'; g.fillRect(x, y, 1, 1);
  }
  /* la luna, finita */
  const lx = Math.round(W * 0.78), ly = Math.round(H * 0.12);
  for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) {
    const d1 = Math.hypot(xx, yy), d2 = Math.hypot(xx - 3, yy - 2);
    if (d1 <= 7 && d2 > 6.2) { g.fillStyle = d1 > 6 ? '#c8c0a0' : '#fff6d8'; g.fillRect(lx + xx, ly + yy, 1, 1); }
  }
  Portada.estrellas = c;
  /* el quebracho: tronco ancho, copa de ramas quebradas, en silueta */
  const a = lienzoLM(W, H), q = a.getContext('2d');
  const piso = Math.round(H * (H > W ? 0.66 : 0.78)), cx = Math.round(W * 0.5);
  q.fillStyle = '#05040a';
  const tronco = Math.round(Math.min(W, H) * 0.15);
  for (let y = Math.round(piso - H * 0.36); y < piso + 2; y++) {
    const k = (y - (piso - H * 0.36)) / (H * 0.36), ancho = tronco * (0.8 + k * k * 0.9);
    q.fillRect(Math.round(cx - ancho / 2 + Math.sin(y * 0.05) * 2), y, Math.round(ancho), 1);
  }
  const copa = (x, y, r) => { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy * 1.6 <= r * r && ruidoLM(Math.round(x + xx) >> 1, Math.round(y + yy) >> 1, 96) > 0.12) q.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1); };
  const rama = (x, y, ang, largo, grosor) => {
    /* en la punta de cada rama, un manchón de hojas chiquitas, como la copa rala del quebracho */
    if (largo < 4 || grosor < 1) { copa(x, y, 3 + Math.round(ruidoLM(Math.round(x), Math.round(y), 97) * 4)); return; }
    const x2 = x + Math.cos(ang) * largo, y2 = y + Math.sin(ang) * largo;
    for (let i = 0; i <= largo; i++) { const t2 = i / largo; q.fillRect(Math.round(x + (x2 - x) * t2 - grosor / 2), Math.round(y + (y2 - y) * t2), Math.max(1, Math.round(grosor)), Math.max(1, Math.round(grosor))); }
    rama(x2, y2, ang - 0.45 + ruidoLM(Math.round(x2), Math.round(y2), 84) * 0.3, largo * 0.72, grosor * 0.66);
    rama(x2, y2, ang + 0.4 + ruidoLM(Math.round(y2), Math.round(x2), 85) * 0.3, largo * 0.66, grosor * 0.62);
  };
  const tope = piso - H * 0.36, L = Math.min(W, H) * 0.19;
  rama(cx, tope + 4, -Math.PI / 2 - 0.62, L, tronco * 0.42);
  rama(cx, tope + 4, -Math.PI / 2 + 0.55, L * 0.95, tronco * 0.4);
  rama(cx, tope + 2, -Math.PI / 2 - 0.1, L * 0.75, tronco * 0.32);
  rama(cx, tope + 12, -Math.PI + 0.35, L * 0.7, tronco * 0.26);
  rama(cx, tope + 12, -0.35, L * 0.7, tronco * 0.26);
  /* el monte bajo: algarrobos, pastos y un rancho lejos con la ventana prendida */
  for (let x = 0; x < W; x++) {
    const h = 6 + Math.round(Math.sin(x * 0.07) * 3 + Math.sin(x * 0.19) * 2 + ruidoLM(x >> 2, 0, 86) * 3);
    q.fillRect(x, piso - h, 1, H - piso + h);
  }
  q.fillStyle = '#0a0812'; q.fillRect(Math.round(W * 0.14), piso - 14, 14, 9); q.fillRect(Math.round(W * 0.14) - 2, piso - 16, 18, 3);
  q.fillStyle = '#ffcf80'; q.fillRect(Math.round(W * 0.14) + 4, piso - 11, 3, 3);
  /* adentro del tronco, las ventanitas del pueblo */
  q.fillStyle = '#6a3a1e';
  for (let i = 0; i < 5; i++) q.fillRect(Math.round(cx - tronco * 0.3 + ruidoLM(i, 5, 87) * tronco * 0.6), Math.round(piso - H * 0.05 - i * H * 0.055), 2, 2);
  Portada.arbol = a; Portada.piso = piso;
  Portada.bichos = Array.from({ length: 22 }, (_, i) => ({ x: ruidoLM(i, 7, 88) * W, y: piso - 20 - ruidoLM(i, 8, 89) * H * 0.4, f: ruidoLM(i, 9, 90) * 6, v: 4 + ruidoLM(i, 10, 91) * 6 }));
}
function dibujarPortadaLM(g, t, conTitulo) {
  const W = Pantalla.W, H = Pantalla.H;
  prepararPortada(W, H);
  g.drawImage(Portada.estrellas, 0, 0);
  /* estrellas que titilan */
  for (let i = 0; i < 8; i++) if (Math.sin(t * 2 + i * 1.7) > 0.8) { g.fillStyle = '#ffffff'; g.fillRect(Math.floor(ruidoLM(i, 11, 92) * W), Math.floor(ruidoLM(i, 12, 93) * H * 0.5), 1, 1); }
  g.drawImage(Portada.arbol, 0, 0);
  /* luciérnagas del monte */
  for (const b of Portada.bichos) {
    const x = b.x + Math.sin(t * 0.4 + b.f) * 14, y = b.y + Math.sin(t * 0.7 + b.f * 2) * 6, on = Math.sin(t * 1.6 + b.f * 3) > 0.2;
    if (!on) continue;
    halo(g, x, y, 4, '#c8ff70', 0.25);
    g.fillStyle = '#f6ffa8'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  /* la luz mala: va y viene, en un ocho, con estela */
  const cx = W * 0.5, cy = Portada.piso - H * 0.2;
  for (let i = 12; i >= 0; i--) {
    const tt = t - i * 0.05, x = cx + Math.sin(tt * 0.9) * W * 0.3, y = cy + Math.sin(tt * 1.8) * H * 0.06;
    if (i === 0) { halo(g, x, y, 16, '#f6ffa8', 0.45); halo(g, x, y, 7, '#ffffff', 0.5); }
    else { g.fillStyle = i < 5 ? '#f6ffa8' : '#8ab048'; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  }
  if (conTitulo === false) return;
  tituloLM(g, W, H, t);
}
function tituloLM(g, W, H, t) {
  const e = W >= 300 ? 4 : 3, y = Math.round(H * (H > W ? 0.13 : 0.12));
  const tit = 'LUZ MALA', ancho = anchoTexto(tit) * e;
  /* el título titila como una luz que no termina de prender */
  const parpa = Math.sin(t * 13) > 0.94 || (t % 7 > 6.7 && Math.sin(t * 40) > 0);
  halo(g, W / 2, y + 12, Math.round(ancho * 0.45), '#3a4a10', 0.5);
  if (!parpa) textoPx(g, tit, W / 2, y, { alin: 'centro', escala: e, grad: ['#ffffff', '#fbffd8', '#f6ffa8', '#e0f080', '#b4e858', '#8ab840', '#5a8a2a'] });
  else textoPx(g, tit, W / 2, y, { alin: 'centro', escala: e, grad: GRAD.gris });
  textoPx(g, 'UNA LUCIÉRNAGA, UN QUEBRACHO', W / 2, y + 12 * e, { alin: 'centro', grad: GRAD.ambar });
  textoPx(g, 'Y LO QUE SE APAGÓ', W / 2, y + 12 * e + 10, { alin: 'centro', grad: GRAD.ambar });
}

/* ---------------- la intro: carteles que se escriben solos ---------------- */
function dibujarIntro(g, J, t) {
  const W = Pantalla.W, H = Pantalla.H, I = J.intro;
  g.fillStyle = '#050308'; g.fillRect(0, 0, W, H);
  const txt = INTRO[I.i] || '', n = Math.floor(I.n);
  const lineas = envolver(txt, Math.min(W - 24, 220));
  let cuenta = 0;
  const y0 = Math.round(H * 0.42 - lineas.length * 6);
  lineas.forEach((l, k) => {
    const quedan = Math.max(0, n - cuenta);
    textoLetras(g, l, Math.round(W / 2 - anchoTexto(l) / 2), y0 + k * 12, { grad: I.i === INTRO.length - 1 ? GRAD.verde : GRAD.blanco }, Math.min(l.length, quedan));
    cuenta += l.length + 1;
  });
  /* la lucecita que acompaña */
  const x = W / 2 + Math.sin(t * 0.8) * W * 0.3, y = H * 0.7 + Math.sin(t * 1.6) * 10;
  halo(g, x, y, 12, '#f6ffa8', 0.4);
  g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
  if (n >= txt.length && Math.floor(t * 2) % 2) flechita(g, W / 2, Math.round(H * 0.84));
}

/* ---------------- el diálogo: arriba, con retrato ---------------- */
function dibujarDialogoLM(g, J, t) {
  const d = J.dialogo;
  if (!d) return;
  const W = Pantalla.W, l = d.lineas[d.i], bw = Math.min(W - 10, 300), bx = Math.round((W - bw) / 2), by = 6;
  const tx = bx + 34, ancho = bw - 42, renglones = envolver(l.t, ancho);
  const bh = Math.max(40, 18 + renglones.length * 10);
  g.fillStyle = '#0d0a14'; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  g.fillStyle = '#1a1426'; g.fillRect(bx, by, bw, bh);
  Trama.cubrir(g, 4, '#2a2238', bx, by, bw, bh);
  g.fillStyle = '#5a4a78'; g.fillRect(bx, by, bw, 1);
  g.fillStyle = '#07050a'; g.fillRect(bx, by + bh - 1, bw, 1);
  const r = SPR.retrato[l.q];
  if (r) g.drawImage(r, bx + 5, by + 6);
  textoPx(g, NOMBRES_LM[l.q] || '', tx, by + 7, { grad: l.q === 'chispa' ? GRAD.verde : GRAD.ambar });
  let quedan = Math.floor(d.n);
  renglones.forEach((ln, k) => { if (quedan > 0) textoLetras(g, ln, tx, by + 19 + k * 10, { grad: GRAD.blanco }, Math.min(ln.length, quedan)); quedan -= ln.length + 1; });
  if (d.n >= l.t.length && Math.floor(t * 3) % 2) { g.fillStyle = '#fff4c2'; g.fillRect(bx + bw - 9, by + bh - 7, 5, 1); g.fillRect(bx + bw - 8, by + bh - 6, 3, 1); g.fillRect(bx + bw - 7, by + bh - 5, 1, 1); }
}

/* el triangulito de "seguí" */
function flechita(g, x, y) {
  g.fillStyle = '#fff4c2';
  for (let i = 0; i < 3; i++) g.fillRect(Math.round(x) - 2 + i, Math.round(y) + i, 5 - i * 2, 1);
}

/* ---------------- carteles grandes ---------------- */
/* el nombre de la zona al entrar, con dos rayas que se abren, como en Hollow Knight */
function dibujarZonaNombre(g, J) {
  const z = J.cartelZona;
  if (!z) return;
  const W = Pantalla.W, a = z.t < 0.6 ? z.t / 0.6 : z.t > 2.6 ? Math.max(0, 1 - (z.t - 2.6) / 0.8) : 1;
  if (a <= 0) return;
  const y = Math.round(VistaLM.usable * 0.3);
  g.globalAlpha = a;
  textoPx(g, z.txt, W / 2, y, { alin: 'centro', escala: 2, grad: GRAD.blanco });
  const w = Math.round((anchoTexto(z.txt) * 2 + 20) * Math.min(1, z.t / 0.8) / 2);
  g.fillStyle = '#e8e0d0'; g.fillRect(Math.round(W / 2 - w), y + 17, w * 2, 1);
  g.fillStyle = '#e8e0d0'; g.fillRect(Math.round(W / 2) - 1, y + 16, 3, 3);
  g.globalAlpha = 1;
}
function dibujarCartelJefe(g, J) {
  const c = J.cartelJefe;
  if (!c) return;
  const W = Pantalla.W, a = c.t < 0.4 ? c.t / 0.4 : c.t > 2.4 ? Math.max(0, 1 - (c.t - 2.4) / 0.6) : 1;
  if (a <= 0) return;
  const txt = JEFES_TXT[c.tipo], y = Math.round(VistaLM.usable * 0.62);
  g.globalAlpha = a;
  textoPx(g, txt.sub, W / 2, y, { alin: 'centro', grad: GRAD.gris });
  textoPx(g, txt.nombre, W / 2, y + 12, { alin: 'centro', escala: anchoTexto(txt.nombre) * 2 < W - 20 ? 2 : 1, grad: GRAD.rojo });
  g.globalAlpha = 1;
}
function dibujarHallazgo(g, J, t) {
  const h = J.hallazgo;
  if (!h) return;
  const W = Pantalla.W, H = VistaLM.usable, def = HALLAZGOS[h.q];
  Trama.cubrir(g, Math.min(10, h.t * 30), '#050308');
  const bw = Math.min(W - 16, 240), lineas = envolver(def.txt, bw - 20), bh = 58 + lineas.length * 10;
  const bx = Math.round((W - bw) / 2), by = Math.round(H / 2 - bh / 2);
  g.fillStyle = '#0d0a14'; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  g.fillStyle = '#1a1426'; g.fillRect(bx, by, bw, bh);
  g.fillStyle = '#f6ffa8'; g.fillRect(bx, by, bw, 1); g.fillRect(bx, by + bh - 1, bw, 1);
  halo(g, W / 2, by + 16, 14, '#f6ffa8', 0.4 + Math.sin(t * 4) * 0.1);
  const ic = iconoPx(def.icono, '#f6ffa8');
  g.drawImage(ic, Math.round(W / 2 - 10), by + 6, 20, 20);
  textoPx(g, def.titulo, W / 2, by + 32, { alin: 'centro', grad: GRAD.verde });
  lineas.forEach((l, k) => textoPx(g, l, W / 2, by + 46 + k * 10, { alin: 'centro', grad: GRAD.blanco }));
  if (h.t > 0.8 && Math.floor(t * 2) % 2) flechita(g, W / 2, by + bh - 8);
}
function dibujarAvisoLM(g, J) {
  const a = J.aviso;
  if (!a) return;
  const k = a.t < 0.2 ? a.t / 0.2 : a.t > 1.8 ? Math.max(0, 1 - (a.t - 1.8) / 0.4) : 1;
  if (k <= 0) return;
  g.globalAlpha = k;
  textoPx(g, a.txt, Pantalla.W / 2, Math.round(VistaLM.usable * 0.2), { alin: 'centro', grad: a.grad || GRAD.ambar });
  g.globalAlpha = 1;
}
function dibujarMuerte(g, J) {
  const m = J.muerte;
  if (!m) return;
  const W = Pantalla.W, H = Pantalla.H;
  Trama.cubrir(g, Math.min(16, m.t * 12), '#050308');
  if (m.t > 0.9) {
    const a = Math.min(1, (m.t - 0.9) / 0.5);
    g.globalAlpha = a;
    textoPx(g, 'TE APAGASTE', W / 2, Math.round(H * 0.4), { alin: 'centro', escala: 2, grad: GRAD.gris });
    if (J.prog.sombra) textoPx(g, 'TU LUZ QUEDÓ DONDE CAÍSTE', W / 2, Math.round(H * 0.4) + 22, { alin: 'centro', grad: GRAD.celeste });
    g.globalAlpha = 1;
  }
}

/* ---------------- el mapa: las salas vistas, dibujadas donde están ---------------- */
function dibujarMapa(g, J, t) {
  const W = Pantalla.W, H = Pantalla.H;
  g.fillStyle = '#0c0a08'; g.fillRect(0, 0, W, H);
  Trama.cubrir(g, 3, '#2a2016');
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const s of SALAS_LM) { x0 = Math.min(x0, s.pos[0]); y0 = Math.min(y0, s.pos[1]); x1 = Math.max(x1, s.pos[0] + s.tam[0]); y1 = Math.max(y1, s.pos[1] + s.tam[1]); }
  const mandos = VistaLM.mandos, alto = H - mandos - 44, k = Math.min((W - 16) / (x1 - x0), alto / (y1 - y0));
  const ox = Math.round((W - (x1 - x0) * k) / 2), oy = 26 + Math.round((alto - (y1 - y0) * k) / 2);
  textoPx(g, 'EL QUEBRACHO', W / 2, 8, { alin: 'centro', grad: GRAD.ocre });
  const vistas = J.prog.vistas;
  for (const s of SALAS_LM) {
    if (!vistas[s.id]) continue;
    const X = ox + (s.pos[0] - x0) * k, Y = oy + (s.pos[1] - y0) * k;
    /* la forma de la sala, baldosa por baldosa, en chiquito */
    const Z = ZONA_ARTE[s.zona];
    for (let ty = 0; ty < s.tam[1]; ty++) for (let tx = 0; tx < s.tam[0]; tx++) {
      if (s.mapa[ty][tx] === '#') continue;
      g.fillStyle = s.id === J.mundo.sala.id ? '#e8d8b0' : Z.borde;
      g.fillRect(Math.floor(X + tx * k), Math.floor(Y + ty * k), Math.max(1, Math.ceil(k)), Math.max(1, Math.ceil(k)));
    }
    const cx = X + s.tam[0] * k / 2, cy = Y + s.tam[1] * k / 2;
    if (s.jefe && !J.prog.jefes[s.jefe]) { g.fillStyle = '#c42a3c'; g.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3); }
    for (let ty = 0; ty < s.tam[1]; ty++) { const tx = s.mapa[ty].indexOf('H'); if (tx >= 0) { g.fillStyle = '#4ad8c8'; g.fillRect(Math.round(X + tx * k) - 1, Math.round(Y + ty * k) - 1, 3, 2); } }
  }
  /* dónde está Chispa (y su sombra, si quedó alguna) */
  const s = J.mundo.sala, p = J.mundo.p;
  if (Math.floor(t * 3) % 2) { g.fillStyle = '#f6ffa8'; g.fillRect(Math.round(ox + (s.pos[0] - x0 + (p.x + 4) / 8) * k) - 1, Math.round(oy + (s.pos[1] - y0 + (p.y + 6) / 8) * k) - 1, 3, 3); }
  const so = J.prog.sombra;
  if (so && SALA_POR_ID[so.sala]) { const ss = SALA_POR_ID[so.sala]; g.fillStyle = '#9fb8ff'; g.fillRect(Math.round(ox + (ss.pos[0] - x0 + so.x / 8) * k) - 1, Math.round(oy + (ss.pos[1] - y0 + so.y / 8) * k) - 1, 2, 2); }
  const ly = H - mandos - 14;
  textoPx(g, s.nombre.toUpperCase() + ' · ' + ZONAS[s.zona].nombre.toUpperCase(), W / 2, ly - 10, { alin: 'centro', grad: GRAD.blanco });
  textoPx(g, 'CELESTE: HONGO · ROJO: JEFE', W / 2, ly, { alin: 'centro', grad: GRAD.gris });
}

/* ---------------- el final ---------------- */
function dibujarFinalLM(g, J, t) {
  const W = Pantalla.W, H = Pantalla.H, F = J.final;
  dibujarPortadaLM(g, t, false);
  /* el quebracho se prende por dentro: una ventanita por cada segundo */
  const cx = W / 2, piso = Portada.piso;
  for (let i = 0; i < Math.min(12, F.t * 1.5); i++) {
    const x = cx - 8 + ruidoLM(i, 21, 94) * 16, y = piso - 10 - ruidoLM(i, 22, 95) * H * 0.3;
    halo(g, x, y, 6, '#ffcf80', 0.35); g.fillStyle = '#ffe0a0'; g.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  Trama.cubrir(g, 6, '#050308');
  const i = Math.min(FINAL_LM.length - 1, Math.floor(F.t / 4.5));
  const k = (F.t % 4.5) / 4.5, a = F.t > FINAL_LM.length * 4.5 ? 1 : k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
  if (F.t < FINAL_LM.length * 4.5) {
    g.globalAlpha = a;
    envolver(FINAL_LM[i], Math.min(W - 24, 220)).forEach((l, n) => textoPx(g, l, W / 2, Math.round(H * 0.24) + n * 11, { alin: 'centro', grad: i === FINAL_LM.length - 1 ? GRAD.verde : GRAD.blanco }));
    g.globalAlpha = 1;
  } else {
    tituloLM(g, W, H, t);
    const y = Math.round(H * 0.42);
    textoPx(g, 'FIN', W / 2, y, { alin: 'centro', escala: 2, grad: GRAD.ambar });
    textoPx(g, 'TIEMPO ' + reloj(J.prog.tiempo) + ' · ÁMBAR ' + J.mundo.p.ambar, W / 2, y + 24, { alin: 'centro', grad: GRAD.gris });
    if (Math.floor(t * 2) % 2) textoPx(g, 'TOCÁ PARA VOLVER', W / 2, y + 40, { alin: 'centro', grad: GRAD.blanco });
  }
}
