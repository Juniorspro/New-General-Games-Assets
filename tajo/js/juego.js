/* ============================================================================
   El juego de TAJO: menú, modos (clásico, zen, tormenta), diario, dojo,
   controles, idioma. Escenas: intro, idioma, menu, juego, pausa, fin, controles, dojo.
   ========================================================================== */

const G = {
  escena: 'intro', escenaAnterior: 'menu', introTiempo: 0,
  modo: 'clasico', modos: ['clasico', 'zen', 'tormenta'],
  frutas: [], mitades: [], puntos: 0, cortadas: 0, combosMax: 0, combo: 0, tiempo: 0, tiempoMax: 180,
  vidas: 3, vidasMax: 3, peligro: 0, bomba: false, gameOver: false,
  velocidadTirada: 1,
  x1: 0, y1: 0, x2: 0, y2: 0, trazando: false,
  defenseOn: false, defenseY: H - 150,
  poderes: { hielo: 0, frenesi: 0, doble: 0 },
  poderActivo: null, poderTiempo: 0,
};

function iniciarJuego(modo) {
  G.modo = modo;
  G.frutas = [];
  G.mitades = [];
  G.puntos = 0;
  G.cortadas = 0;
  G.combo = 0;
  G.vidas = G.vidasMax;
  G.tiempo = 0;
  G.bomba = false;
  G.gameOver = false;
  G.poderActivo = null;
  G.poderTiempo = 0;

  if (modo === 'clasico') { G.tiempoMax = 999; G.vidasMax = 3; }
  else if (modo === 'zen') { G.tiempoMax = 90; G.vidasMax = 999; }
  else if (modo === 'tormenta') { G.tiempoMax = 60; G.vidasMax = 999; }

  Sonido.musica(TEMAS.juego);
  G.escena = 'juego';
  lastThrow = 0;
}

let lastThrow = 0;
function tirarFruta() {
  const ahora = Date.now();
  if (ahora - lastThrow < 300) return;
  lastThrow = ahora;

  let tipo = 'sandia';
  if (Math.random() < 0.15) tipo = 'bomba';
  else if (Math.random() < 0.3) tipo = 'frutilla';
  else if (Math.random() < 0.3) tipo = 'platano';

  const x = azar(50, W - 50), vx = azar(-100, 100), vy = azar(-500, -300);
  G.frutas.push(nuevoFruta(tipo, x, -20, vx, vy));
  Sonido.sfx('boton');
}

function actualizar(dt) {
  if (G.escena !== 'juego') return;

  G.tiempo += dt;
  if (G.tiempoMax < 999 && G.tiempo >= G.tiempoMax) { G.gameOver = true; G.escena = 'fin'; }

  if (Math.random() < 0.3 * dt) tirarFruta();

  pasoFisica(G.frutas, dt);

  for (let i = G.frutas.length - 1; i >= 0; i--) {
    const f = G.frutas[i];
    if (f.muerto) G.frutas.splice(i, 1);
    else if (f.cortada) {
      let allDead = true;
      for (const m of G.mitades) if (m.fruta === f && !m.muerto) { allDead = false; break; }
      if (allDead) G.frutas.splice(i, 1);
    }
  }

  for (let i = G.mitades.length - 1; i >= 0; i--) {
    const m = G.mitades[i];
    if (!m.muerto) {
      m.vy += GRAV * dt;
      m.vx *= DRAG;
      m.vy *= DRAG;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.ang += (m.vx / m.r) * dt;
      if (m.y - m.r > H) m.muerto = true;
      if (m.x - m.r < 0) { m.x = m.r; if (m.vx < 0) m.vx *= -0.2; }
      if (m.x + m.r > W) { m.x = W - m.r; if (m.vx > 0) m.vx *= -0.2; }
      if (m.y + m.r > H) { m.y = H - m.r; if (m.vy > 0) m.vy *= -REBOTE; m.vx *= 0.985; }
    } else G.mitades.splice(i, 1);
  }

  if (G.trazando && G.x2 !== G.x1 && G.y2 !== G.y1) {
    const cortadas = cortarFruta(G.x1, G.y1, G.x2, G.y2, G.frutas, G);
    for (const c of cortadas) G.mitades.push(c);
  }
}

function dibujar(g, dt) {
  g.fillStyle = ESTILO_SUMI.negro;
  g.fillRect(0, 0, W, H);

  if (G.escena === 'intro') return;
  if (G.escena === 'idioma') { dibujarIdioma(g); return; }
  if (G.escena === 'menu') { dibujarMenu(g); return; }
  if (G.escena === 'juego') { dibujarJuego(g); return; }
  if (G.escena === 'pausa') { dibujarPausa(g); return; }
  if (G.escena === 'fin') { dibujarFin(g); return; }
  if (G.escena === 'controles') { dibujarControles(g); return; }
  if (G.escena === 'dojo') { dibujarDojo(g); return; }
}

function dibujarJuego(g) {
  for (const f of G.frutas) {
    dibujarFruta(g, f.tipo, f.x, f.y, f.ang, f.cortada, 1);
  }
  for (const m of G.mitades) {
    dibujarFruta(g, m.tipo, m.x, m.y, m.ang, true, 1);
  }

  if (G.trazando) {
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = ANCHO_CORTE;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(G.x1, G.y1);
    g.lineTo(G.x2, G.y2);
    g.stroke();
  }

  texto(g, G.puntos, W / 2, 30, { tam: 32, col: '#151210', peso: 'bold' });
  texto(g, tr('cortadas') + ': ' + G.cortadas, 30, 30, { tam: 14, col: '#7a6f68' });
  texto(g, tr('combo') + ': ' + G.combo, W - 30, 30, { tam: 14, col: '#7a6f68', alin: 'right' });

  if (G.modo !== 'zen') {
    texto(g, tr('tiempo') + ': ' + Math.ceil(G.tiempoMax - G.tiempo), 30, H - 30, { tam: 14, col: '#7a6f68' });
  }

  texto(g, '❤ ' + G.vidas + '/' + G.vidasMax, W - 30, H - 30, { tam: 14, col: '#c41e3a', alin: 'right' });
}

function dibujarMenu(g) {
  g.fillStyle = ESTILO_SUMI.negro;
  g.fillRect(0, 0, W, H);

  texto(g, 'TAJO', W / 2, 80, { tam: 48, peso: 'bold', col: '#151210' });
  texto(g, tr('presenta'), W / 2, 130, { tam: 14, col: '#7a6f68' });

  const y0 = 200;
  for (let i = 0; i < 3; i++) {
    const modo = G.modos[i];
    const titulo = tr(modo);
    const desc = tr(modo + 'D');
    const y = y0 + i * 100;

    g.fillStyle = 'rgba(21,18,16,0.1)';
    g.fillRect(20, y, W - 40, 80);

    texto(g, titulo, W / 2, y + 25, { tam: 18, peso: 'bold', col: '#151210' });
    texto(g, desc, W / 2, y + 55, { tam: 11, col: '#7a6f68' });
  }

  texto(g, tr('dojo'), 30, H - 40, { tam: 12, col: '#7a6f68', alin: 'left' });
  texto(g, tr('controles'), W - 30, H - 40, { tam: 12, col: '#7a6f68', alin: 'right' });
  texto(g, tr('idioma'), W / 2, H - 40, { tam: 12, col: '#7a6f68' });
}

function dibujarIdioma(g) {
  g.fillStyle = ESTILO_SUMI.negro;
  g.fillRect(0, 0, W, H);
  texto(g, tr('idioma'), W / 2, 100, { tam: 28, peso: 'bold', col: '#151210' });

  const idiomas = ['es', 'en', 'pt'];
  const nombres = ['ESPAÑOL', 'ENGLISH', 'PORTUGUÊS'];
  const y0 = 220;
  for (let i = 0; i < 3; i++) {
    const y = y0 + i * 90;
    g.fillStyle = 'rgba(21,18,16,' + (IDIOMA === idiomas[i] ? '0.3' : '0.1') + ')';
    g.fillRect(20, y, W - 40, 70);
    texto(g, nombres[i], W / 2, y + 35, { tam: 20, peso: 'bold', col: '#151210' });
  }
}

function dibujarPausa(g) {
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(0, 0, W, H);
  texto(g, tr('pausa'), W / 2, H / 2 - 60, { tam: 40, peso: 'bold', col: '#ffffff' });
  texto(g, tr('seguir'), W / 2, H / 2 + 60, { tam: 20, col: '#ffffff' });
}

function dibujarFin(g) {
  g.fillStyle = ESTILO_SUMI.negro;
  g.fillRect(0, 0, W, H);

  const record = DATOS.rec[G.modo] || 0;
  const nuevoRec = G.puntos > record;

  if (nuevoRec) {
    g.fillStyle = '#c41e3a';
    texto(g, tr('nuevoRecord'), W / 2, 100, { tam: 32, peso: 'bold', col: '#c41e3a' });
  }

  texto(g, tr('fin'), W / 2, 200, { tam: 40, peso: 'bold', col: '#151210' });
  texto(g, G.puntos, W / 2, 280, { tam: 48, peso: 'bold', col: '#151210' });
  texto(g, tr('record') + ': ' + Math.max(record, G.puntos), W / 2, 360, { tam: 18, col: '#7a6f68' });
  texto(g, tr('menu'), W / 2, H - 60, { tam: 20, col: '#7a6f68' });
}

function dibujarControles(g) {
  g.fillStyle = ESTILO_SUMI.negro;
  g.fillRect(0, 0, W, H);
  texto(g, tr('controles'), W / 2, 60, { tam: 32, peso: 'bold', col: '#151210' });

  const y0 = 140;
  const lineas = [
    tr('ayuda'),
    tr('tocar') + ' ' + tr('pausa'),
  ];
  for (let i = 0; i < lineas.length; i++) {
    texto(g, lineas[i], W / 2, y0 + i * 80, { tam: 14, col: '#7a6f68' });
  }

  texto(g, tr('volver'), W / 2, H - 40, { tam: 16, col: '#7a6f68' });
}

function dibujarDojo(g) {
  g.fillStyle = ESTILO_SUMI.negro;
  g.fillRect(0, 0, W, H);
  texto(g, tr('dojo'), W / 2, 60, { tam: 32, peso: 'bold', col: '#151210' });

  texto(g, tr('proba') + ':', W / 2, 150, { tam: 16, col: '#7a6f68' });

  if (lastThrow > 0 && Math.random() < 0.01) tirarFruta();

  for (const f of G.frutas) {
    dibujarFruta(g, f.tipo, f.x, f.y, f.ang, false, 1);
  }

  if (G.trazando) {
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = ANCHO_CORTE;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(G.x1, G.y1);
    g.lineTo(G.x2, G.y2);
    g.stroke();
  }

  texto(g, tr('volver'), W / 2, H - 40, { tam: 16, col: '#7a6f68' });
}

document.addEventListener('pointermove', (e) => {
  if (G.escena !== 'juego' && G.escena !== 'dojo') return;
  if (!G.trazando) return;
  const canvas = document.querySelector('canvas');
  const rect = canvas.getBoundingClientRect();
  const pixelsPerUnit = canvas.width / W;
  G.x2 = (e.clientX - rect.left) / pixelsPerUnit;
  G.y2 = (e.clientY - rect.top) / pixelsPerUnit;
});

document.addEventListener('pointerdown', (e) => {
  const canvas = document.querySelector('canvas');
  const rect = canvas.getBoundingClientRect();
  const pixelsPerUnit = canvas.width / W;
  const y = (e.clientY - rect.top) / pixelsPerUnit;
  const x = (e.clientX - rect.left) / pixelsPerUnit;

  if (G.escena === 'menu') {
    const idx = Math.floor((y - 200) / 100);
    if (idx >= 0 && idx < 3) { iniciarJuego(G.modos[idx]); }
    if (y > H - 50 && y < H - 30) {
      if (x < W / 3) G.escena = 'dojo';
      else if (x > 2 * W / 3) G.escena = 'controles';
      else G.escena = 'idioma';
    }
  } else if (G.escena === 'idioma') {
    const idx = Math.floor((y - 220) / 90);
    if (idx >= 0 && idx < 3) { IDIOMA = ['es', 'en', 'pt'][idx]; Guardado.escribir('idioma', IDIOMA); G.escena = 'menu'; }
  } else if (G.escena === 'juego') {
    if (y < 60) { G.escena = 'pausa'; return; }
    G.x1 = x;
    G.y1 = y;
    G.x2 = x;
    G.y2 = y;
    G.trazando = true;
  } else if (G.escena === 'pausa') {
    G.escena = 'juego';
  } else if (G.escena === 'fin') {
    G.escena = 'menu';
  } else if (G.escena === 'controles' || G.escena === 'dojo') {
    G.escena = 'menu';
  }
});

document.addEventListener('pointerup', () => {
  G.trazando = false;
});

let frameTime = 0, intro = null, musicaIntro = null;
function loop(now) {
  const dt = Math.min(0.05, (now - frameTime) / 1000);
  frameTime = now;

  if (G.escena === 'intro') {
    if (intro) intro.pasar(dt);
    if (intro && intro.listo) { G.escena = 'menu'; Sonido.musica(TEMAS.menu); if (musicaIntro) musicaIntro.cortar(); }
  }

  actualizar(dt);

  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = ESTILO_SUMI.negro;
  ctx.fillRect(0, 0, W, H);

  if (G.escena === 'intro' && intro) {
    intro.dibujar(ctx);
  } else {
    dibujar(ctx, dt);
  }

  requestAnimationFrame(loop);
}

window.addEventListener('load', () => {
  const canvas = document.querySelector('canvas');
  const ww = window.innerWidth, hh = window.innerHeight;
  const escala = Math.min(ww / (W * S), hh / (H * S));
  canvas.width = W * S * escala;
  canvas.height = H * S * escala;
  const ctx = canvas.getContext('2d');
  ctx.scale(escala, escala);

  Sonido.iniciar();
  intro = crearIntroJXS({ W, H, presenta: tr('presenta'), vibrar: true, estilo: ESTILO_SUMI });
  if (Sonido.ctx && Sonido.ctx.state === 'running') musicaIntro = jingleJXS(Sonido.ctx, Sonido.total, ESTILO_SUMI);

  requestAnimationFrame(loop);

  document.addEventListener('click', () => { if (intro && !intro.listo) intro.saltar(); });
});
