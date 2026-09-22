/* ============================================================================
   zonda/js/fisica.js — cómo se mueve Ayelén y cómo le responde el cerro.
   Código puro: no toca el DOM ni el audio. Lo corre el juego y lo corre el
   resolvedor en Node (pruebas/resolver.mjs), así que lo que el resolvedor
   demuestra que se puede pasar es exactamente lo que se juega.
   Las constantes son las de Celeste (en píxeles por segundo, a 60 cuadros).
   ========================================================================== */

const F = {
  CORRE: 90, ACEL: 1000, FRENO: 400, AIRE: 0.65, AGACHA_FRENO: 500,
  GRAV: 900, MEDIA_GRAV: 40, CAIDA: 160, CAIDA_RAPIDA: 240, ACEL_CAIDA: 300,
  SALTO: -105, SALTO_H: 40, SALTO_VAR: 0.2,
  PARED_H: 130, PARED_FUERZA: 0.16, PARED_DIST: 3,
  DESLIZ: 20, DESLIZ_T: 1.2,
  AGUANTE: 110, CUESTA_SUBIR: 45.45, CUESTA_QUIETA: 10, CUESTA_SALTO: 27.5,
  TREPA_SUBE: -45, TREPA_BAJA: 80, RESBALA: 30, TREPA_ACEL: 900, CANSADA: 20,
  DASH: 240, DASH_FIN: 160, DASH_FIN_ARRIBA: 0.75, DASH_T: 0.15, DASH_ESPERA: 0.2, DASH_RECARGA: 0.1,
  COYOTE: 0.1, BUFFER: 0.08,
  SUPER_H: 260, HIPER_H: 325, REBOTE_V: -160, REBOTE_H: 170,
  RESORTE: -185, ESQUINA: 4,
  CRISTAL_T: 2.5, DERRUMBE_T: 0.4, DERRUMBE_VUELVE: 2.5,
  ANCHO: 8, ALTO: 11,
};
const TILE = 8;
const T = { VACIO: 0, SOLIDO: 1, PLAT: 2, HIELO: 3 };

/* ---------------------------------------------------------------------------
   El mundo de una sala. Leyenda del mapa (una letra por baldosa de 8x8):
   #  piso/roca          I  hielo (sólido, no se agarra)   =  tablón (se sube de abajo)
   ^ v < >  púas (hacia donde apuntan)                      P  donde aparece Ayelén
   *  piedra de viento (recarga el dash)    S  resorte      C  piso que se derrumba
   B  tablas que se rompen con el dash      M  vagoneta (su recorrido en sala.movil)
   Y  carámbano que cae                     L  carta        A  apacheta   E  la cumbre
   minúsculas: adornos sin choque (c cactus, f farol, r roca, h pasto, k cristal, t tronco)
   --------------------------------------------------------------------------- */
function crearMundo(sala, o) {
  o = o || {};
  const w = sala.mapa[0].length, h = sala.mapa.length;
  const m = {
    sala, w, h, t: new Uint8Array(w * h), solidos: [], pinches: [], cosas: [], adornos: [],
    eventos: [], tiempo: 0, spawn: { x: 0, y: 0 }, salio: false, congelar: 0,
    asist: o.asist || {}, cartasTomadas: o.cartasTomadas || {}, dashesMax: o.dashesMax || 1,
    historia: [], vientoX: 0, vientoY: 0,
  };
  const visto = new Uint8Array(w * h);
  const ch = (x, y) => (y >= 0 && y < h && x >= 0 && x < w) ? sala.mapa[y][x] : '#';
  /* las letras que forman bloques (C, B, M) se juntan en rectángulos */
  const bloque = (x0, y0, letra) => {
    let x1 = x0; while (ch(x1 + 1, y0) === letra && !visto[y0 * w + x1 + 1]) x1++;
    let y1 = y0;
    for (;;) {
      let fila = true;
      for (let x = x0; x <= x1; x++) if (ch(x, y1 + 1) !== letra || visto[(y1 + 1) * w + x]) { fila = false; break; }
      if (!fila) break; y1++;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) visto[y * w + x] = 1;
    return { x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE };
  };
  let nMovil = 0, nCarta = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = ch(x, y), i = y * w + x, px = x * TILE, py = y * TILE;
    if (visto[i]) continue;
    switch (c) {
      case '#': m.t[i] = T.SOLIDO; break;
      case 'I': m.t[i] = T.HIELO; break;
      case '=': m.t[i] = T.PLAT; break;
      case '^': m.pinches.push({ x: px, y: py + 5, w: 8, h: 3, d: 'arr' }); break;
      case 'v': m.pinches.push({ x: px, y: py, w: 8, h: 3, d: 'aba' }); break;
      case '<': m.pinches.push({ x: px + 5, y: py, w: 3, h: 8, d: 'izq' }); break;
      case '>': m.pinches.push({ x: px, y: py, w: 3, h: 8, d: 'der' }); break;
      case 'P': m.spawn = { x: px, y: py + TILE - F.ALTO }; break;
      case '*': m.cosas.push({ tipo: 'cristal', x: px, y: py, w: 8, h: 8, espera: 0 }); break;
      case 'S': m.cosas.push({ tipo: 'resorte', x: px, y: py + 4, w: 8, h: 4, anim: 0 }); break;
      case 'Y': m.cosas.push({ tipo: 'caramb', x: px + 1, y: py, w: 6, h: 7, x0: px + 1, y0: py, est: 'cuelga', t: 0, vy: 0 }); break;
      case 'L': {
        const id = sala.id + ':' + (nCarta++);
        if (!m.cartasTomadas[id]) m.cosas.push({ tipo: 'carta', id, x: px, y: py, w: 8, h: 8, x0: px, y0: py, est: 'libre', t: 0, suelo: 0 });
        break;
      }
      case 'A': m.cosas.push({ tipo: 'apacheta', x: px - 4, y: py - 8, w: 16, h: 16, tocada: false }); m.adornos.push({ c: 'A', x: px, y: py }); break;
      case 'E': m.cosas.push({ tipo: 'cumbre', x: px, y: py - 16, w: 8, h: 24 }); break;
      case 'C': { const r = bloque(x, y, 'C'); m.solidos.push(Object.assign(r, { tipo: 'derrumbe', activo: true, est: 'firme', t: 0, x0: r.x, y0: r.y })); break; }
      case 'B': { const r = bloque(x, y, 'B'); m.solidos.push(Object.assign(r, { tipo: 'rompible', activo: true })); break; }
      case 'M': {
        const r = bloque(x, y, 'M'), mv = (sala.movil || [])[nMovil++] || { dx: 0, dy: -4 };
        m.solidos.push(Object.assign(r, { tipo: 'vagoneta', activo: true, x0: r.x, y0: r.y, x1: r.x + mv.dx * TILE, y1: r.y + mv.dy * TILE,
          est: 'quieta', t: 0, k: 0, rx: 0, ry: 0, vx: 0, vy: 0 }));
        break;
      }
      default:
        if (c >= 'a' && c <= 'z') m.adornos.push({ c, x: px, y: py });
    }
  }
  m.p = nuevaJugadora(m);
  return m;
}

function nuevaJugadora(m) {
  const s = m.spawn;
  return {
    x: s.x, y: m.h * TILE + 4, rx: 0, ry: 0, w: F.ANCHO, h: F.ALTO, vx: 0, vy: 0, dir: 1,
    estado: 'entra', enSuelo: false, antesSuelo: false, coyote: 0, buffer: 0, varT: 0, varV: 0, autoSalto: false,
    forzT: 0, forzDir: 0, deslizT: 0, maxCaida: F.CAIDA,
    dashes: m.dashesMax, dashT: 0, dashEspera: 0, dashListo: true, dashDx: 0, dashDy: 0, dashEnSuelo: false,
    aguante: F.AGUANTE, agachada: false, liftX: 0, liftY: 0, sobre: null,
    muerta: false, tMuerta: 0, tAire: 0, tPared: 0, rastro: 0, cayoDesde: 0,
  };
}

/* ---------------- choques ---------------- */
function solidoTile(m, tx, ty) {
  if (tx < 0 || tx >= m.w) return true;         // los costados de la sala son pared
  if (ty < 0 || ty >= m.h) return false;        // arriba se sale, abajo se cae
  const t = m.t[ty * m.w + tx];
  return t === T.SOLIDO || t === T.HIELO;
}
function chocaSolido(m, x, y, w, h, ignorar) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solidoTile(m, tx, ty)) return true;
  for (const s of m.solidos) if (s.activo && s !== ignorar && cruza(x, y, w, h, s.x, s.y, s.w, s.h)) return s;
  return false;
}
/* ¿hay un tablón justo abajo de los pies? Solo frena de arriba hacia abajo */
function sobrePlataforma(m, x, y, w, h) {
  const b = y + h;
  if (b % TILE !== 0) return false;
  const ty = b / TILE;
  if (ty < 0 || ty >= m.h) return false;
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE);
  for (let tx = x0; tx <= x1; tx++) if (tx >= 0 && tx < m.w && m.t[ty * m.w + tx] === T.PLAT) return true;
  return false;
}
/* ¿se puede agarrar la pared de ese lado? El hielo no se agarra */
function paredAgarrable(m, p, d) {
  const x = d > 0 ? p.x + p.w : p.x - 1;
  const tx = Math.floor(x / TILE);
  for (let yy = p.y + 2; yy <= p.y + p.h - 3; yy += 3) {
    const ty = Math.floor(yy / TILE);
    if (tx < 0 || tx >= m.w) return false;      // el borde de la sala no es roca: no se trepa
    if (ty >= 0 && ty < m.h && m.t[ty * m.w + tx] === T.SOLIDO) return true;
  }
  for (const s of m.solidos) if (s.activo && s.tipo !== 'hielo' && cruza(x, p.y + 2, 1, p.h - 4, s.x, s.y, s.w, s.h)) return s;
  return false;
}
function paredParaSaltar(m, p, d) {
  const x = d > 0 ? p.x + p.w : p.x - F.PARED_DIST;
  const tx0 = Math.floor(x / TILE), tx1 = Math.floor((x + F.PARED_DIST - 1) / TILE);
  const ty0 = Math.floor(p.y / TILE), ty1 = Math.floor((p.y + p.h - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (tx < 0 || tx >= m.w || ty < 0 || ty >= m.h) continue;
    if (m.t[ty * m.w + tx] === T.SOLIDO) return true;
  }
  for (const s of m.solidos) if (s.activo && cruza(x, p.y, F.PARED_DIST, p.h, s.x, s.y, s.w, s.h)) return true;
  return false;
}

/* moverse de a un píxel con el resto acumulado, como los Actor de Celeste: así
   nunca se atraviesa nada y la posición es siempre entera */
function moverX(m, p, dx, alChocar) {
  p.rx += dx;
  let n = Math.round(p.rx);
  if (!n) return false;
  p.rx -= n;
  const s = sig(n);
  while (n) {
    let c = chocaSolido(m, p.x + s, p.y, p.w, p.h);
    if (c && c.tipo === 'rompible' && p.estado === 'dash') { romper(m, c); c = chocaSolido(m, p.x + s, p.y, p.w, p.h); }
    if (c) { p.rx = 0; if (alChocar) alChocar(c, s); return c; }
    p.x += s; n -= s;
  }
  return false;
}
function moverY(m, p, dy, alChocar) {
  p.ry += dy;
  let n = Math.round(p.ry);
  if (!n) return false;
  p.ry -= n;
  const s = sig(n);
  while (n) {
    let c = chocaSolido(m, p.x, p.y + s, p.w, p.h);
    if (c && c.tipo === 'rompible' && p.estado === 'dash') { romper(m, c); c = chocaSolido(m, p.x, p.y + s, p.w, p.h); }
    if (!c && s > 0 && sobrePlataforma(m, p.x, p.y, p.w, p.h)) c = true;
    if (c) { p.ry = 0; if (alChocar) alChocar(c, s); return c; }
    p.y += s; n -= s;
  }
  return false;
}
function enSuelo(m, p) {
  return !!(chocaSolido(m, p.x, p.y + 1, p.w, p.h) || sobrePlataforma(m, p.x, p.y, p.w, p.h));
}
function queHayAbajo(m, p) {
  for (const s of m.solidos) if (s.activo && cruza(p.x, p.y + 1, p.w, p.h, s.x, s.y, s.w, s.h)) return s;
  return null;
}
function evento(m, t, o) { m.eventos.push(Object.assign({ t, x: m.p.x + 4, y: m.p.y + 6 }, o)); }
function romper(m, s) { s.activo = false; evento(m, 'romper', { x: s.x + s.w / 2, y: s.y + s.h / 2, bw: s.w, bh: s.h }); }
function matar(m) {
  const p = m.p;
  if (p.muerta || p.estado === 'entra') return;
  if (m.asist.invencible) return;
  p.muerta = true; p.estado = 'muerta'; p.tMuerta = 0; p.vx = p.vy = 0;
  evento(m, 'muerte');
}

/* ---------------- entrada por paso ----------------
   inp = { x, y, salto, saltoE, dashE, agarre } — x, y en -1/0/1 */

function saltar(m, p, ix) {
  p.buffer = 0; p.coyote = 0; p.varT = F.SALTO_VAR; p.autoSalto = false;
  p.vx += F.SALTO_H * (ix || 0) + p.liftX;
  p.vy = F.SALTO + Math.min(0, p.liftY);
  p.varV = p.vy;
  p.liftX = p.liftY = 0;
  evento(m, 'salto');
}
function saltoPared(m, p, d) {          // d: hacia dónde sale (lejos de la pared)
  p.buffer = 0; p.varT = F.SALTO_VAR; p.autoSalto = false;
  p.forzT = F.PARED_FUERZA; p.forzDir = d;
  p.vx = F.PARED_H * d; p.vy = F.SALTO; p.varV = p.vy; p.dir = d;
  evento(m, 'saltoPared', { d });
}
function saltoTrepando(m, p) {
  p.buffer = 0; p.varT = F.SALTO_VAR; p.autoSalto = false;
  if (!m.asist.aguanteInfinito) p.aguante -= F.CUESTA_SALTO;
  p.vy = F.SALTO; p.varV = p.vy; p.vx = 0;
  p.estado = 'normal';
  evento(m, 'salto');
}
function empezarDash(m, p) {
  if (!m.asist.dashInfinito) p.dashes--;
  p.estado = 'dash'; p.dashT = F.DASH_T; p.dashEspera = F.DASH_ESPERA; p.dashListo = false;
  p.vx = p.vy = 0; p.forzT = 0; p.varT = 0; p.agachada = false;
  m.congelar = 3;
}

function pasarJugadora(m, inp) {
  const p = m.p;
  m.tiempo += DT;
  if (p.estado === 'muerta') { p.tMuerta += DT; return; }
  if (p.estado === 'entra') { pasarEntrada(m, p); return; }

  /* viento: se suma al movimiento en todos los estados menos en el dash */
  vientoAhora(m);

  const antes = p.enSuelo;
  p.enSuelo = enSuelo(m, p);
  p.sobre = p.enSuelo ? queHayAbajo(m, p) : null;
  if (p.enSuelo) {
    p.coyote = F.COYOTE;
    p.aguante = F.AGUANTE;
    /* como en Celeste, el dash vuelve pisando el suelo 0,1 s después de
       empezarlo, aunque se siga en el dash: eso hace que el super salto por
       el piso conserve el dash */
    if (p.dashEspera < F.DASH_ESPERA - F.DASH_RECARGA && p.dashes < m.dashesMax) { p.dashes = m.dashesMax; evento(m, 'recarga', { suave: true }); }
    if (!antes) evento(m, 'aterriza', { fuerza: p.cayoDesde });
    p.tAire = 0;
  } else { p.coyote -= DT; p.tAire += DT; if (p.vy > p.cayoDesde) p.cayoDesde = p.vy; }
  if (p.enSuelo) p.cayoDesde = 0;

  if (inp.saltoE) p.buffer = F.BUFFER; else p.buffer -= DT;
  if (p.dashEspera > 0) p.dashEspera -= DT;
  if (p.forzT > 0) p.forzT -= DT;
  if (p.varT > 0) p.varT -= DT;
  if (!p.sobre || p.sobre.tipo !== 'vagoneta') { if (p.enSuelo) p.liftX = p.liftY = 0; }

  if (p.estado === 'normal') pasarNormal(m, p, inp);
  else if (p.estado === 'trepa') pasarTrepa(m, p, inp);
  else if (p.estado === 'dash') pasarDash(m, p, inp);

  if (p.estado !== 'dash' && (m.vientoX || m.vientoY)) {
    /* agarrada de la pared, el viento no la despega */
    if (p.estado !== 'trepa') moverX(m, p, m.vientoX * DT);
    /* se mira el piso de nuevo: si acaba de aterrizar, la corriente no la vuelve a levantar */
    if (m.vientoY && !enSuelo(m, p)) moverY(m, p, m.vientoY * DT);
  }

  tocarCosas(m, p, inp);
  if (p.y > m.h * TILE + 6) {
    if (m.asist.invencible) { reponer(m); return; }
    matar(m);
  }
  if (p.y + p.h < 0 && !p.muerta) { m.salio = true; evento(m, 'salida'); }
  /* el rastro de posiciones: las cartas siguen a Ayelén por acá */
  m.historia.push(p.x + 4, p.y + 4);
  if (m.historia.length > 120) m.historia.splice(0, 2);
}

function pasarNormal(m, p, inp) {
  /* agacharse: solo en el piso y apretando abajo */
  p.agachada = p.enSuelo && inp.y > 0 && inp.x === 0;
  /* horizontal */
  const mult = p.enSuelo ? 1 : F.AIRE;
  if (p.agachada) p.vx = acercar(p.vx, 0, F.AGACHA_FRENO * DT);
  else {
    /* después de un salto de pared, unos cuadros se empuja solo hacia afuera */
    const mx = p.forzT > 0 ? p.forzDir : inp.x, meta = mx * F.CORRE;
    /* por encima de la velocidad máxima y hacia el mismo lado, se frena despacio:
       así se conserva el envión de un dash o de una vagoneta */
    if (Math.abs(p.vx) > F.CORRE && sig(p.vx) === mx) p.vx = acercar(p.vx, meta, F.FRENO * mult * DT);
    else p.vx = acercar(p.vx, meta, F.ACEL * mult * DT);
  }
  if (inp.x && p.forzT <= 0) p.dir = inp.x;

  /* vertical */
  if (!p.enSuelo) {
    let max = F.CAIDA;
    if (inp.y > 0 && p.vy >= F.CAIDA) { p.maxCaida = acercar(p.maxCaida, F.CAIDA_RAPIDA, F.ACEL_CAIDA * DT); max = p.maxCaida; }
    else p.maxCaida = acercar(p.maxCaida, F.CAIDA, F.ACEL_CAIDA * DT);
    /* deslizarse por la pared: empujando contra ella y cayendo, se cae más lento
       (el primer segundo), y cada vez menos lento */
    if (inp.x && p.vy >= 0 && paredAgarrable(m, p, inp.x) && !inp.agarre) {
      p.deslizT = Math.min(F.DESLIZ_T, p.deslizT + DT);
      max = mezclar(F.DESLIZ, F.CAIDA, p.deslizT / F.DESLIZ_T);
      p.tPared += DT;
    } else p.tPared = 0;
    const alto = Math.abs(p.vy) < F.MEDIA_GRAV && (inp.salto || p.autoSalto);
    p.vy = acercar(p.vy, max, F.GRAV * (alto ? 0.5 : 1) * DT);
  } else { p.deslizT = 0; p.tPared = 0; p.maxCaida = F.CAIDA; }

  /* salto variable: mientras se mantiene, la subida no baja de la inicial */
  if (p.varT > 0) {
    if (inp.salto || p.autoSalto) p.vy = Math.min(p.vy, p.varV);
    else p.varT = 0;
  }
  if (p.vy >= 0) p.autoSalto = false;

  /* saltar: del piso (o recién salida), o de una pared cerca */
  if (p.buffer > 0) {
    if (p.coyote > 0) saltar(m, p, inp.x);
    else if (paredParaSaltar(m, p, 1)) saltoPared(m, p, -1);
    else if (paredParaSaltar(m, p, -1)) saltoPared(m, p, 1);
  }
  /* dash */
  if (inp.dashE && p.dashes > 0 && p.dashEspera <= 0) { empezarDash(m, p); return; }
  /* agarrarse */
  if (inp.agarre && !p.agachada && p.aguante > 0 && p.vy >= 0 && sig(p.vx) !== -p.dir) {
    if (paredAgarrable(m, p, p.dir)) { p.estado = 'trepa'; p.vx = 0; p.vy *= 0.2; p.forzT = 0; evento(m, 'agarra'); return; }
  }
  moverX(m, p, p.vx * DT, () => { p.vx = 0; });
  moverY(m, p, p.vy * DT, (c, s) => chocaV(m, p, s));
}

/* chocar arriba o abajo. Arriba, si el choque es contra una esquina, se la
   esquiva corriendo hasta 4 px (la corrección de esquinas de Celeste): sin
   eso, rozar un borde con la cabeza corta el salto en seco */
function chocaV(m, p, s) {
  if (s < 0 && p.estado !== 'trepa') {
    const orden = p.vx > 0 ? [1, -1] : p.vx < 0 ? [-1, 1] : [1, -1];
    for (let i = 1; i <= F.ESQUINA; i++) for (const d of orden) {
      if (!chocaSolido(m, p.x + d * i, p.y - 1, p.w, p.h) && !chocaSolido(m, p.x + d * i, p.y, p.w, p.h)) { p.x += d * i; return; }
    }
  }
  if (p.estado === 'dash' && s > 0) { p.dashEnSuelo = true; }
  p.vy = 0; p.varT = 0;
}

function pasarTrepa(m, p, inp) {
  const pared = paredAgarrable(m, p, p.dir);
  if (!inp.agarre || !pared) {
    /* se terminó la pared SUBIENDO: un saltito para pasar el borde (bajando o
       resbalando no, que si no salta sola al llegar al pie de la pared) */
    if (inp.agarre && !pared && p.vy < 0 && p.aguante > 0) {
      p.vy = -120; p.vx = p.dir * 60; p.forzT = 0.12; p.forzDir = p.dir;
      evento(m, 'trepaFin');
    }
    p.estado = 'normal';
    moverY(m, p, p.vy * DT, (c, s) => chocaV(m, p, s));
    return;
  }
  if (pared && pared.tipo) { p.liftX = pared.vx || 0; p.liftY = pared.vy || 0; pared.tocada = true; }
  /* saltar desde la pared: alejándose es salto de pared; si no, salto trepando */
  if (p.buffer > 0) {
    if (inp.x === -p.dir) { p.estado = 'normal'; saltoPared(m, p, -p.dir); }
    else if (p.aguante > 0 || m.asist.aguanteInfinito) saltoTrepando(m, p);
    moverY(m, p, p.vy * DT, (c, s) => chocaV(m, p, s));
    return;
  }
  if (inp.dashE && p.dashes > 0 && p.dashEspera <= 0) { empezarDash(m, p); return; }
  let meta = 0;
  if (p.aguante <= 0) meta = F.RESBALA;
  else if (inp.y < 0) { meta = F.TREPA_SUBE; if (!m.asist.aguanteInfinito) p.aguante -= F.CUESTA_SUBIR * DT; }
  else if (inp.y > 0) meta = F.TREPA_BAJA;
  else if (!m.asist.aguanteInfinito) p.aguante -= F.CUESTA_QUIETA * DT;
  p.vy = acercar(p.vy, meta, F.TREPA_ACEL * DT);
  p.vx = 0;
  moverY(m, p, p.vy * DT, (c, s) => { p.vy = 0; });
  if (p.enSuelo && inp.y > 0) p.estado = 'normal';
}

function pasarDash(m, p, inp) {
  if (!p.dashListo) {
    /* la dirección se lee un paso después de apretar: da un respiro para
       apuntar la diagonal (y en el juego cae después del congelado) */
    let dx = inp.x, dy = inp.y;
    if (!dx && !dy) dx = p.dir;
    const k = dx && dy ? Math.SQRT1_2 : 1;
    p.dashDx = dx * k; p.dashDy = dy * k;
    p.vx = p.dashDx * F.DASH; p.vy = p.dashDy * F.DASH;
    if (dx) p.dir = dx;
    p.dashListo = true; p.dashEnSuelo = p.enSuelo;
    evento(m, 'dash', { dx: p.dashDx, dy: p.dashDy });
  }
  p.dashT -= DT;
  p.rastro++;
  /* super salto: saltar durante un dash horizontal por el piso */
  if (p.buffer > 0 && p.coyote > 0 && p.dashDy >= 0 && p.dashDx) {
    p.estado = 'normal';
    p.buffer = 0; p.coyote = 0; p.varT = F.SALTO_VAR;
    const hiper = p.dashDy > 0;
    p.vx = (hiper ? F.HIPER_H : F.SUPER_H) * sig(p.dashDx);
    p.vy = hiper ? F.SALTO * 0.5 : F.SALTO; p.varV = p.vy;
    evento(m, hiper ? 'hiper' : 'super');
    moverX(m, p, p.vx * DT, () => { p.vx = 0; });
    moverY(m, p, p.vy * DT, (c, s) => chocaV(m, p, s));
    return;
  }
  /* rebote de pared: dash para arriba pegado a una pared + saltar */
  if (p.buffer > 0 && p.dashDy < 0 && !p.dashDx) {
    const d = paredParaSaltar(m, p, 1) ? -1 : paredParaSaltar(m, p, -1) ? 1 : 0;
    if (d) {
      p.estado = 'normal'; p.buffer = 0; p.varT = 0.25; p.forzT = 0.16; p.forzDir = d;
      p.vx = F.REBOTE_H * d; p.vy = F.REBOTE_V; p.varV = p.vy; p.dir = d;
      evento(m, 'rebote', { d });
      return;
    }
  }
  moverX(m, p, p.vx * DT, (c, s) => {
    /* dash contra un escalón: si subiendo hasta 4 px se pasa, se pasa */
    if (p.dashDy <= 0) for (let i = 1; i <= F.ESQUINA; i++) {
      if (!chocaSolido(m, p.x, p.y - i, p.w, p.h) && !chocaSolido(m, p.x + s, p.y - i, p.w, p.h)) { p.y -= i; return; }
    }
    p.vx = 0;
  });
  moverY(m, p, p.vy * DT, (c, s) => chocaV(m, p, s));
  if (p.dashT <= 0) {
    p.estado = 'normal';
    if (p.dashDy <= 0) {
      p.vx = p.dashDx * F.DASH_FIN; p.vy = p.dashDy * F.DASH_FIN;
      if (p.vy < 0) p.vy *= F.DASH_FIN_ARRIBA;
    }
  }
}

function pasarEntrada(m, p) {
  /* aparecer como en el Celeste de PICO-8: sube desde abajo y frena en su lugar */
  const d = p.y - m.spawn.y;
  p.x = m.spawn.x;
  if (d <= 1) {
    p.y = m.spawn.y; p.estado = 'normal'; p.vx = p.vy = 0; p.rx = p.ry = 0;
    p.dashes = m.dashesMax; p.aguante = F.AGUANTE;
    evento(m, 'aparece');
    return;
  }
  p.y -= Math.max(1, Math.ceil(d * 0.16));
}

/* reaparecer sin morir (asistencia invencible) */
function reponer(m) {
  const p = m.p;
  p.x = m.spawn.x; p.y = m.spawn.y; p.vx = p.vy = 0; p.estado = 'normal'; p.rx = p.ry = 0;
}

/* ---------------- viento ---------------- */
function vientoAhora(m) {
  const v = m.sala.viento;
  if (!v) { m.vientoX = m.vientoY = 0; return; }
  if (v.rafagas) {
    /* ráfagas: se anuncian medio segundo antes (el juego dibuja las líneas) */
    const ciclo = v.on + v.off, t = (m.tiempo + (v.fase || 0)) % ciclo;
    const k = t < v.on ? Math.min(1, t / 0.35, (v.on - t) / 0.35) : 0;
    m.vientoX = (v.x || 0) * k; m.vientoY = (v.y || 0) * k;
    m.avisoViento = t > ciclo - 0.6;
  } else { m.vientoX = v.x || 0; m.vientoY = v.y || 0; m.avisoViento = false; }
}

/* ---------------- las cosas del cerro ---------------- */
function tocarCosas(m, p, inp) {
  if (p.muerta) return;
  /* el viento también cuenta: si empuja contra la púa, no alcanza con ir para el otro lado */
  const vx = p.vx + (p.estado !== 'dash' && p.estado !== 'trepa' ? m.vientoX : 0);
  const vy = p.vy + (p.estado !== 'dash' && !p.enSuelo ? m.vientoY : 0);
  for (const q of m.pinches) {
    if (!cruza(p.x, p.y, p.w, p.h, q.x, q.y, q.w, q.h)) continue;
    /* una púa mata si uno se mueve CONTRA ella: se puede pasar rozándola */
    if ((q.d === 'arr' && vy >= 0) || (q.d === 'aba' && vy <= 0) ||
        (q.d === 'izq' && vx >= 0) || (q.d === 'der' && vx <= 0)) { matar(m); return; }
  }
  for (const c of m.cosas) {
    switch (c.tipo) {
      case 'cristal':
        if (c.espera > 0) { c.espera -= DT; if (c.espera <= 0) evento(m, 'cristalVuelve', { x: c.x + 4, y: c.y + 4 }); break; }
        if (cruza(p.x, p.y, p.w, p.h, c.x + 1, c.y + 1, 6, 6) && (p.dashes < m.dashesMax || p.aguante < F.AGUANTE * 0.7)) {
          p.dashes = m.dashesMax; p.aguante = F.AGUANTE; c.espera = F.CRISTAL_T;
          m.congelar = 3; evento(m, 'cristal', { x: c.x + 4, y: c.y + 4 });
        }
        break;
      case 'resorte':
        if (c.anim > 0) c.anim -= DT;
        if (p.vy >= 0 && cruza(p.x, p.y, p.w, p.h, c.x, c.y, c.w, c.h)) {
          p.estado = 'normal'; p.vy = F.RESORTE; p.varT = F.SALTO_VAR; p.varV = p.vy; p.autoSalto = true;
          p.dashes = m.dashesMax; p.aguante = F.AGUANTE; p.y = c.y - p.h; p.ry = 0; p.buffer = 0;
          c.anim = 0.25; evento(m, 'resorte', { x: c.x + 4, y: c.y });
        }
        break;
      case 'caramb':
        pasarCaramb(m, c, p);
        break;
      case 'carta':
        pasarCarta(m, c, p);
        break;
      case 'apacheta':
        if (!c.tocada && cruza(p.x, p.y, p.w, p.h, c.x, c.y, c.w, c.h)) { c.tocada = true; evento(m, 'apacheta', { x: c.x + 8, y: c.y + 8 }); }
        break;
      case 'cumbre':
        if (cruza(p.x, p.y, p.w, p.h, c.x, c.y, c.w, c.h) && !m.cumbre) { m.cumbre = true; evento(m, 'cumbre'); }
        break;
    }
  }
  for (const s of m.solidos) {
    if (s.tipo === 'derrumbe') pasarDerrumbe(m, s, p);
    else if (s.tipo === 'vagoneta') pasarVagoneta(m, s, p);
  }
}

function pasarCaramb(m, c, p) {
  if (c.est === 'roto') return;
  if (c.est === 'cuelga') {
    if (p.y > c.y && p.x + p.w > c.x - 10 && p.x < c.x + c.w + 10) { c.est = 'tiembla'; c.t = 0; evento(m, 'crujeHielo', { x: c.x + 3, y: c.y }); }
  } else if (c.est === 'tiembla') {
    c.t += DT; if (c.t > 0.3) { c.est = 'cae'; c.vy = 0; }
  } else if (c.est === 'cae') {
    c.vy = Math.min(c.vy + 900 * DT, 220);
    const ny = c.y + c.vy * DT;
    if (chocaSolido(m, c.x, ny, c.w, c.h) || ny > m.h * TILE) { c.est = 'roto'; evento(m, 'rompeHielo', { x: c.x + 3, y: c.y + 6 }); return; }
    c.y = ny;
  }
  if (cruza(p.x, p.y, p.w, p.h, c.x + 1, c.y, c.w - 2, c.h)) matar(m);
}

function pasarCarta(m, c, p) {
  c.t += DT;
  if (c.est === 'libre') {
    if (cruza(p.x, p.y, p.w, p.h, c.x - 1, c.y - 1, 10, 10)) { c.est = 'sigue'; c.suelo = 0; evento(m, 'cartaSigue', { x: c.x + 4, y: c.y + 4 }); }
    return;
  }
  if (c.est === 'sigue') {
    /* sigue a Ayelén con retraso, por el camino que ella hizo */
    const hs = m.historia, i = Math.max(0, hs.length - 24);
    if (hs.length >= 2) { c.x += (hs[i] - 4 - c.x) * 0.2; c.y += (hs[i + 1] - 10 - c.y) * 0.2; }
    /* se asegura cuando ella pisa firme un momento, como las frutillas de Celeste */
    if (p.enSuelo && p.estado !== 'dash') c.suelo += DT; else c.suelo = 0;
    if (c.suelo > 0.12) { c.est = 'tomada'; m.cartasTomadas[c.id] = true; evento(m, 'carta', { id: c.id, x: c.x + 4, y: c.y + 4 }); }
  }
}

function pasarDerrumbe(m, s, p) {
  if (s.est === 'firme') {
    const pisa = p.enSuelo && p.sobre === s;
    const agarra = p.estado === 'trepa' && cruza(p.x - 1, p.y, p.w + 2, p.h, s.x, s.y, s.w, s.h);
    if (pisa || agarra) { s.est = 'tiembla'; s.t = 0; evento(m, 'cruje', { x: s.x + s.w / 2, y: s.y }); }
  } else if (s.est === 'tiembla') {
    s.t += DT;
    if (s.t >= F.DERRUMBE_T) { s.est = 'caido'; s.t = 0; s.activo = false; evento(m, 'derrumbe', { x: s.x + s.w / 2, y: s.y + s.h / 2, bw: s.w }); }
  } else if (s.est === 'caido') {
    s.t += DT;
    if (s.t >= F.DERRUMBE_VUELVE && !cruza(p.x, p.y, p.w, p.h, s.x, s.y, s.w, s.h)) { s.est = 'firme'; s.activo = true; evento(m, 'vuelve', { x: s.x + s.w / 2, y: s.y + s.h / 2 }); }
  }
}

/* la vagoneta arranca cuando se la pisa o se la agarra, va rápido hasta su
   punto, espera y vuelve despacio. Lleva a quien esté encima o colgado */
function pasarVagoneta(m, s, p) {
  const monta = (p.enSuelo && p.sobre === s) || (p.estado === 'trepa' && cruza(p.x - 1, p.y, p.w + 2, p.h, s.x, s.y, s.w, s.h));
  let nx = s.x, ny = s.y;
  if (s.est === 'quieta') {
    if (monta || s.tocada) { s.est = 'va'; s.k = 0; s.t = 0; evento(m, 'vagoneta', { x: s.x + s.w / 2, y: s.y + s.h / 2 }); }
    s.tocada = false;
  } else if (s.est === 'va') {
    s.t += DT;
    s.k = Math.min(1, s.k + (0.2 + s.t * 5.5) * DT);           // acelera
    nx = mezclar(s.x0, s.x1, s.k); ny = mezclar(s.y0, s.y1, s.k);
    if (s.k >= 1) { s.est = 'pausa'; s.t = 0; evento(m, 'vagonetaFrena', { x: s.x + s.w / 2, y: s.y + s.h / 2 }); m.congelar = 2; }
  } else if (s.est === 'pausa') {
    s.t += DT; if (s.t > 0.5) { s.est = 'vuelve'; s.t = 0; }
  } else if (s.est === 'vuelve') {
    s.k = Math.max(0, s.k - 0.9 * DT);
    nx = mezclar(s.x0, s.x1, s.k); ny = mezclar(s.y0, s.y1, s.k);
    if (s.k <= 0) { s.est = 'quieta'; }
  }
  moverSolido(m, s, nx - s.x, ny - s.y, monta);
}
function moverSolido(m, s, dx, dy, monta) {
  const p = m.p;
  s.rx += dx; s.ry += dy;
  const mx = Math.round(s.rx), my = Math.round(s.ry);
  s.rx -= mx; s.ry -= my;
  s.vx = dx / DT; s.vy = dy / DT;
  if (monta) { p.liftX = s.vx; p.liftY = s.vy; }
  if (!mx && !my) return;
  /* primero se mueve el sólido, después se lleva o se empuja a Ayelén */
  s.activo = false;
  if (mx) {
    s.x += mx;
    if (!p.muerta && p.estado !== 'entra') {
      if (cruza(p.x, p.y, p.w, p.h, s.x, s.y, s.w, s.h)) { if (moverX(m, p, mx > 0 ? s.x + s.w - p.x : s.x - (p.x + p.w))) matar(m); }
      else if (monta) moverX(m, p, mx);
    }
  }
  if (my) {
    s.y += my;
    if (!p.muerta && p.estado !== 'entra') {
      if (cruza(p.x, p.y, p.w, p.h, s.x, s.y, s.w, s.h)) { if (moverY(m, p, my > 0 ? s.y + s.h - p.y : s.y - (p.y + p.h))) matar(m); }
      else if (monta) moverY(m, p, my);
    }
  }
  s.activo = true;
}

/* después de morir, la sala vuelve a como estaba (menos las cartas aseguradas) */
function reiniciarSala(m) {
  const n = crearMundo(m.sala, { asist: m.asist, cartasTomadas: m.cartasTomadas, dashesMax: m.dashesMax });
  n.tiempo = m.tiempo;
  return n;
}

/* la entrada de un paso a partir de las acciones apretadas */
function entradaDe(E) {
  return {
    x: (E.IN.der ? 1 : 0) - (E.IN.izq ? 1 : 0),
    y: (E.IN.aba ? 1 : 0) - (E.IN.arr ? 1 : 0),
    salto: !!E.IN.salto, saltoE: !!E.EDGE.salto,
    dashE: !!E.EDGE.dash, agarre: !!E.IN.agarre,
  };
}
