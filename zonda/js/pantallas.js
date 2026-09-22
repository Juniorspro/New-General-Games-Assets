/* ============================================================================
   zonda/js/pantallas.js — lo que se dibuja encima del juego: la portada, la
   tarjeta de cada capítulo, el cartel de la sala, los diálogos y el final.
   Todo en el lienzo del mundo, en píxeles: el título no es un <h1>.
   ========================================================================== */

/* ---------------- portada: una fogata al pie del cerro, de noche ---------------- */
const Portada = { t: 0, chispas: [] };
function dibujarPortada(g, t) {
  const W = Pantalla.W, H = Pantalla.H;
  g.drawImage(fondoDe('quebrada', W, H), 0, -40);
  dibujarNubes(g, 'quebrada');
  /* el piso y el fuego: a media pantalla, porque en un teléfono parado los
     botones ocupan la mitad de abajo */
  const piso = Math.round(H * (H > W ? 0.47 : 0.6));
  const T = TEMAS.quebrada;
  g.fillStyle = T.rocaOsc; g.fillRect(0, piso, W, H - piso);
  g.fillStyle = T.roca; g.fillRect(0, piso, W, 3);
  g.fillStyle = T.tapa; g.fillRect(0, piso, W, 1);
  for (let x = 0; x < W; x += 3) if (hash2(x, 9, 1) < 0.4) g.fillRect(x, piso - 1, 1, 1);
  const fx = Math.round(W * 0.5) + 14, fy = piso;
  halo(g, fx, fy - 6, 30, '#ffb050', 0.3 + 0.05 * Math.sin(t * 9));
  g.fillStyle = '#4a2e1c'; g.fillRect(fx - 6, fy - 2, 12, 2);
  for (let i = 0; i < 7; i++) {
    const h = 4 + ((Math.sin(t * 11 + i * 1.7) + 1) * 3) | 0, x = fx - 4 + i;
    g.fillStyle = i % 2 ? '#ff8a2a' : '#ffd24a'; g.fillRect(x, fy - 2 - h, 1, h);
  }
  g.fillStyle = '#fff4c0'; g.fillRect(fx - 1, fy - 5, 2, 3);
  if (Math.random() < 0.3) Portada.chispas.push({ x: fx + azar(-3, 3), y: fy - 8, vy: azar(-30, -14), vida: 50 });
  for (let i = Portada.chispas.length - 1; i >= 0; i--) {
    const c = Portada.chispas[i];
    c.y += c.vy * DT; c.x += Math.sin(t * 3 + i) * 0.3;
    if (--c.vida <= 0) { Portada.chispas.splice(i, 1); continue; }
    g.fillStyle = c.vida > 25 ? '#ffd24a' : '#ff7a2a'; g.fillRect(Math.round(c.x), Math.round(c.y), 1, 1);
  }
  /* Ayelén sentada, con la bufanda al viento */
  const ax = fx - 20, ay = fy;
  const A = Portada.anim || (Portada.anim = { bufanda: Array.from({ length: 6 }, () => ({ x: ax, y: ay - 8 })) });
  const b = A.bufanda; b[0].x = ax - 1; b[0].y = ay - 8;
  for (let i = 1; i < b.length; i++) {
    const tx = b[i - 1].x - 1.8 + Math.sin(t * 4 + i) * 0.4, ty = b[i - 1].y + 0.3 + Math.sin(t * 6 + i * 0.7) * 0.5;
    b[i].x += (tx - b[i].x) * 0.4; b[i].y += (ty - b[i].y) * 0.4;
  }
  for (let i = b.length - 1; i >= 1; i--) { g.fillStyle = BUFANDA[1][i & 1]; const s = i < 4 ? 2 : 1; g.fillRect(Math.round(b[i].x), Math.round(b[i].y), s, s); }
  dibujarSprite(g, SPR.agacha, ax, ay, 1);
  /* el Zonda pasa de vez en cuando */
  const ciclo = t % 14;
  if (ciclo < 5) dibujarZonda(g, -20 + ciclo / 5 * (W + 40), piso - 30 + Math.sin(t * 2) * 4, t, 1.2, Math.min(1, ciclo, 5 - ciclo));
  /* el título; con un submenú abierto se apaga el fondo y el título se va,
     para que no se encime con el panel */
  if (!UI.actual || UI.actual === 'capaTitulo') tituloZonda(g, W, H, t);
  else Trama.cubrir(g, 9, '#07060c');
}
function tituloZonda(g, W, H, t) {
  const txt = 'ZONDA', e = Math.max(3, Math.floor(W / 52)), { pts, w } = puntosTexto(txt);
  const x0 = Math.round((W - w * e) / 2), y0 = Math.round(H * 0.16);
  const col = GRAD.ocre, borde = '#1b1426';
  const letraDe = (x) => Math.floor(x / 6);
  const caida = (i) => Math.max(0, 1 - Math.max(0, t - 0.2 - i * 0.12) * 2.2);
  const pos = (x, y) => {
    const i = letraDe(x), c = caida(i);
    return [x0 + x * e, y0 + y * e + Math.round(Math.sin(t * 2.4 + i * 0.9) * e * 0.7) - Math.round(c * c * H * 0.4)];
  };
  g.fillStyle = 'rgba(10,6,16,0.7)';
  for (const [x, y] of pts) { const [px, py] = pos(x, y); g.fillRect(px + e, py + e, e, e); }
  g.fillStyle = borde;
  for (const [x, y] of pts) { const [px, py] = pos(x, y); g.fillRect(px - 1, py - 1, e + 2, e + 2); }
  const barrido = ((t * 60) % 400) - 60;
  for (const [x, y, r] of pts) {
    const [px, py] = pos(x, y), i = letraDe(x);
    let c = col[(r + Math.floor(t * 4) + i) % 7];
    if (Math.abs((px - x0) + (py - y0) - barrido) < 6) c = '#fffbe8';
    g.fillStyle = c; g.fillRect(px, py, e, e);
  }
  if (t > 1.1) textoPx(g, 'UNA CHICA, UN CERRO Y EL VIENTO', W / 2, y0 + 8 * e + 8, { alin: 'centro', grad: GRAD.gris });
}

/* ---------------- la tarjeta de cada capítulo ---------------- */
function dibujarTarjeta(g, J) {
  const W = Pantalla.W, H = Pantalla.H, k = J.tarjeta.t;
  const cap = CAPITULOS[J.capIdx];
  const a = k < 0.4 ? k / 0.4 : k > 2.6 ? Math.max(0, (3.1 - k) / 0.5) : 1;
  Trama.cubrir(g, 16 * a * 0.85, '#07060c');
  if (a <= 0.05) return;
  const y = Math.round(H * 0.34);
  g.globalAlpha = a;
  textoPx(g, 'CAPÍTULO ' + cap.id, W / 2, y, { alin: 'centro', grad: GRAD.gris });
  textoPx(g, cap.nombre.toUpperCase(), W / 2, y + 16, { alin: 'centro', grad: GRAD.ocre, escala: 2 });
  textoPx(g, CAP_SUB[cap.id].toUpperCase(), W / 2, y + 44, { alin: 'centro', grad: GRAD.blanco });
  g.globalAlpha = 1;
}

/* ---------------- el cartel de la sala y los avisos ---------------- */
function dibujarCartel(g, J) {
  const b = J.banner;
  if (!b || J.dialogo) return;
  const d = b.t, dur = 2.6;
  if (d > dur) return;
  const entra = Math.min(1, d / 0.25), sale = d > dur - 0.3 ? (dur - d) / 0.3 : 1;
  const x = Math.round(-120 + 126 * entra * entra) - Math.round((1 - sale) * 60), y = 8;
  g.fillStyle = 'rgba(8,6,16,0.72)'; g.fillRect(x - 4, y - 5, anchoTexto(b.nombre) + anchoTexto(b.id) + 22, 17);
  textoPx(g, b.id, x, y, { grad: GRAD.ocre });
  textoPx(g, b.nombre, x + anchoTexto(b.id) + 8, y, { grad: GRAD.blanco });
}
function dibujarAviso(g, J) {
  const a = J.aviso;
  if (!a || a.t > 2.2) return;
  const W = Pantalla.W, y = 8 + (J.banner && J.banner.t < 2.6 ? 18 : 0);
  const txt = a.txt, w = anchoTexto(txt) + 16;
  const x = W - w - 6;
  g.fillStyle = 'rgba(8,6,16,0.72)'; g.fillRect(x - 2, y - 5, w + 4, 17);
  g.drawImage(iconoPx(a.icono || 'carta', a.col || '#f4ead2'), x, y - 2);
  textoPx(g, txt, x + 14, y, { grad: a.grad || GRAD.blanco });
}
function dibujarReloj(g, J) {
  if (!Opc.reloj) return;
  const txt = reloj(J.tCap);
  textoPx(g, txt, 6, Pantalla.H - (document.body.classList.contains('tactil') ? Math.round(240 / Pantalla.PX) : 12), { grad: GRAD.gris });
}

/* ---------------- diálogos ---------------- */
const NOMBRES = { ayelen: 'AYELÉN', zonda: 'EL ZONDA', rosa: 'ROSA' };
function dibujarDialogo(g, J) {
  const d = J.dialogo;
  if (!d) return;
  const l = d.lineas[d.i], W = Pantalla.W;
  const x = 5, y = 5, w = W - 10, h = 64;
  g.fillStyle = '#141018'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = '#1e1a2c'; g.fillRect(x, y, w, h);
  g.fillStyle = '#3a3454'; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
  g.fillStyle = '#0c0a14'; g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
  /* el retrato */
  const rx = x + 5, ry = y + 12;
  g.fillStyle = '#2a2440'; g.fillRect(rx - 1, ry - 1, 24, 24);
  if (l.q === 'zonda') {
    g.save(); g.beginPath(); g.rect(rx, ry, 22, 22); g.clip();
    dibujarZonda(g, rx + 11, ry + 13, Vista.t, 0.8, 1); g.restore();
  } else {
    const r = l.q === 'rosa' ? SPR.retratos.rosa : SPR.retratos[l.c || 'normal'];
    g.drawImage(r.der, rx, ry);
  }
  textoPx(g, NOMBRES[l.q], rx, y + 4, { grad: l.q === 'zonda' ? GRAD.ocre : l.q === 'rosa' ? GRAD.violeta : GRAD.celeste });
  /* el texto, de a poco; lo del Zonda tiembla un poco, como el viento */
  const tx = rx + 30, ancho = w - (tx - x) - 6, lineas = envolver(l.t.toUpperCase(), ancho);
  let resto = Math.floor(d.n);
  for (let i = 0; i < lineas.length && i < 5; i++) {
    const s = lineas[i];
    const tiembla = l.q === 'zonda' ? (k) => [0, Math.round(Math.sin(Vista.t * 8 + k * 0.7 + i) * 0.6)] : null;
    textoLetras(g, s, tx, y + 14 + i * 10, { grad: GRAD.blanco }, Math.max(0, resto), tiembla);
    resto -= s.length + 1;
  }
  if (d.n >= l.t.length && Math.floor(Vista.t * 3) % 2 === 0) textoPx(g, '>', x + w - 10, y + h - 11, { grad: GRAD.oro });
}

/* ---------------- el final: amanece y las cartas se van con el viento ---------------- */
const Final = { cartas: [], t: 0 };
function dibujarFinal(g, J) {
  const W = Pantalla.W, H = Pantalla.H, t = Final.t;
  g.drawImage(fondoDe('amanecer', W, H), 0, -20 - Math.min(40, t * 4));
  dibujarNubes(g, 'amanecer');
  const piso = Math.round(H * 0.7);
  g.fillStyle = TEMAS.amanecer.rocaOsc; g.fillRect(0, piso, W, H - piso);
  g.fillStyle = TEMAS.amanecer.tapa; g.fillRect(0, piso, W, 2);
  const ax = Math.round(W * 0.42), bx = ax + 22;
  g.drawImage(SPR.apacheta.der, bx - 10, piso - 32, SPR.apacheta.w * 2, SPR.apacheta.h * 2);
  bandera(g, bx, piso - 50, t);
  dibujarSprite(g, SPR.quieta[Math.floor(t * 1.6) & 1], ax, piso, 1);
  if (t > 1 && Final.cartas.length < 40 && Math.random() < 0.25) Final.cartas.push({ x: bx, y: piso - 20, vx: azar(20, 60), vy: azar(-40, -15), f: azar(0, 6) });
  for (const c of Final.cartas) {
    c.x += c.vx * DT; c.y += c.vy * DT; c.vy += Math.sin(t * 2 + c.f) * 0.6; c.f += DT * 3;
    const s = SPR.carta[Math.floor(c.f) % 4];
    g.drawImage(s.der, Math.round(c.x), Math.round(c.y));
  }
  dibujarZonda(g, bx + 30 + Math.sin(t) * 10, piso - 40 + Math.cos(t * 0.8) * 6, t, 1.3, 0.8);
  if (Final.creditos) {
    let y = Math.round(H * 0.12);
    for (let i = 0; i < CREDITOS.length; i++) {
      const a = lim((t - 2 - i * 1.2) / 1, 0, 1);
      if (a <= 0) break;
      g.globalAlpha = a;
      const lineas = envolver(CREDITOS[i].toUpperCase(), W - 24);
      for (const l of lineas) { textoPx(g, l, W / 2, y, { alin: 'centro', grad: i === 0 ? GRAD.ocre : GRAD.blanco, escala: i === 0 ? 2 : 1 }); y += i === 0 ? 18 : 10; }
      y += 6;
      g.globalAlpha = 1;
    }
  }
}
