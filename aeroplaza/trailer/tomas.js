/* ============================================================================
   aeroplaza/trailer/tomas.js — lo que se graba del juego (grabar.mjs › tomas).
   Cada toma es el juego de verdad (aeroplaza.html?directo&pausa) en un lugar y
   a una hora, avanzado cuadro por cuadro con un reloj propio (1/30 s). Las
   funciones corren ADENTRO de la página (se mandan como texto), así que no
   pueden usar nada de afuera: reciben A (window.__A) y T (las ayudas de
   grabar.mjs):
     T.E = { x, z, corre, salta, sostiene, baja, dispara }   los "dedos" de este cuadro
     T.camara([x,y,z], [x,y,z], fov)   la cámara de cine (si no, la del juego)
     T.ir(x, z, correr)                 caminar (o correr) hacia un punto
     T.ruta(puntos, u), T.suave(u), T.mezcla(a, b, u)
     T.falso(id, datos, apariencia)     un jugador de mentira (con nombre)
     T.apariencia({ … })                la ropa del muñeco propio
     T.saltear(n)                       avanzar n cuadros sin dibujar
   preparar(A, T) corre una vez; cuadro(A, T, f) antes de cada cuadro (f desde 0).
   ========================================================================== */
export const TOMAS = {
  /* ------------------------------------------------------------ A · bosque */
  /* desde arriba del mar, la isla entera; después baja hasta la espalda del muñeco que corre a la fuente */
  dron: {
    reino: 'plaza', hora: 0.40,
    preparar: (A, T) => { T.ponerEn(-27, 9, 1.75); },
    cuadro: (A, T, f) => {
      const u = f / 265, p = A.yo.p;
      if (f > 120 && p.x < -10) T.ir(-6, 7.2, f > 150);
      /* (viene del sur, por arriba de la pradera: del oeste se metía en el techo de la terminal) */
      const pts = [[-30, 115, 235], [-26, 78, 160], [-34, 40, 82], [-36, 14, 30], [p.x - 7.5, p.y + 3.2, p.z + 3.2]];
      const mira = T.mezcla([0, 8, -10], [p.x + 6, p.y + 1.4, p.z - 1.2], T.suave(Math.max(0, (u - 0.45) / 0.55)));
      T.camara(T.ruta(pts, T.suave(u)), mira, 50 + u * 8);
    },
  },
  /* la ropa: cambia en cada golpe (8 golpes de 0,5216 s) mientras la cámara lo rodea */
  muneco: {
    reino: 'plaza', hora: 0.42,
    preparar: (A, T) => { T.ponerEn(-14, 24, 0.4); },
    cuadro: (A, T, f) => {
      const LOOKS = [
        { color: '#2f9bff', color2: '#b8f0ff', motivo: 'agua', material: 'gelatina' },
        { color: '#ff5fb0', color2: '#ffe0f0', motivo: 'flores', material: 'perla', sombrero: 'corona', anteojos: 'sol' },
        { color: '#39e07a', color2: '#e9ffd0', motivo: 'hojas', material: 'gelatina', sombrero: 'auriculares', espalda: 'alas', peinado: 'pinches' },
        { color: '#6a4bff', color2: '#ffb8f8', motivo: 'galaxia', material: 'perla', sombrero: 'galera', anteojos: 'redondos', particulas: 'estrellas' },
        { color: '#ffd23f', color2: '#fff6c2', motivo: 'burbujas', material: 'gelatina', sombrero: 'flor', espalda: 'mochila', peinado: 'rulos', colorPelo: '#ff7a3d' },
        { color: '#9fe8ff', color2: '#ffffff', motivo: 'nubes', material: 'vidrio', sombrero: 'casco', espalda: 'aleta' },
        { color: '#ff8a3d', color2: '#ffe3a8', motivo: 'tierra', material: 'mate', sombrero: 'explorador', espalda: 'molinete', anteojos: 'visor' },
        { color: '#43d8cd', color2: '#c9a8ff', motivo: 'aurora', material: 'gelatina', sombrero: 'aureola', espalda: 'alas', particulas: 'burbujas', peinado: 'nube' },
      ];
      const k = Math.min(7, Math.floor((f + 2) / 15.65));
      if (k !== T.k) { T.k = k; T.apariencia(LOOKS[k]); if (k > 0) A.J.gesto(k % 2 ? 'saltito' : 'saludar'); }
      /* de frente (el muñeco mira a rumbo 0,4) y rodeándolo despacio */
      const p = A.yo.p, a = -0.25 + f * 0.009, r = 5 - f * 0.004;
      T.camara([p.x + Math.sin(a) * r, p.y + 1.3, p.z + Math.cos(a) * r], [p.x, p.y + 0.8, p.z], 38);
    },
  },
  /* montado en un delfín, por el agua */
  aqua: {
    reino: 'aqua', hora: 0.47,
    preparar: (A, T) => {
      const it = A.reino.mundo.interactivos.find((q) => q.id === 'delfin');
      A.yo.ponerEn(it.pos().clone().setY(it.pos().y + 0.5), 0); A.interactuar(it); T.saltear(8);
    },
    cuadro: (A, T, f) => {
      T.E.z = -1; T.E.corre = true; if (f === 14) T.E.salta = true;
      const p = A.yo.p, r = A.yo.rumbo;
      T.camara([p.x - Math.sin(r) * 5.5 + Math.cos(r) * 2.2, p.y + 1.9, p.z - Math.cos(r) * 5.5 - Math.sin(r) * 2.2], [p.x + Math.sin(r) * 3, p.y + 0.6, p.z + Math.cos(r) * 3], 55);
    },
  },
  /* la aurora: detrás del muñeco, que camina hacia el cristal del sueño */
  aurora: {
    reino: 'aurora',
    preparar: (A, T) => { T.ponerEn(0, 30, Math.PI); },
    cuadro: (A, T, f) => {
      const p = A.yo.p, u = f / 40; T.ir(0, 0, false);
      T.camara([p.x + 1.4 - u * 0.6, p.y + 1.1 + u * 0.4, p.z + 4.6 - u * 0.5], [p.x - 0.4, p.y + 3.4, p.z - 24], 60);
    },
  },
  /* el géiser que sopla (cada 7 s, 2,5 soplando), visto de costado con el muñeco al lado */
  jardin: {
    reino: 'jardin', hora: 0.5,
    preparar: (A, T) => {
      const G = A.reino.geiseres[0]; T.ponerEn(G.x - 2.6, G.z + 2.2, 2.3);
      for (let i = 0; i < 400 && !G.s.activo; i++) T.saltear(1);
    },
    cuadro: (A, T, f) => {
      const G = A.reino.geiseres[0], u = f / 40;
      T.camara([G.x - 7.5 + u * 1.5, G.y + 1.6 + u * 1.2, G.z + 8.5], [G.x, G.y + 4.2 + u * 1.5, G.z], 58);
    },
  },
  /* las torres de vidrio desde la vereda, subiendo la mirada */
  ciudad: {
    reino: 'plaza', hora: 0.55,
    preparar: (A, T) => { T.ponerEn(112, -12, -1.2); },
    cuadro: (A, T, f) => {
      const u = f / 40;
      T.camara([108 - u * 2, 3.5 + u * 3, -2 - u * 1.5], [132, 18 + u * 16, -30], 58);
      T.ir(125, -22, false);
    },
  },
  /* adentro del hotel: el lobby con la columna-acuario */
  hotel: {
    reino: 'interior', params: '&tipo=hotel',
    preparar: (A, T) => { },
    cuadro: (A, T, f) => {
      const u = f / 40;
      T.camara([-3.5 + u * 3, 1.7, 4.8 - u * 0.8], [1.5, 2.2, -3], 62);
    },
  },
  tienda: {
    reino: 'tienda',
    preparar: (A, T) => { },
    cuadro: (A, T, f) => {
      const p = A.yo.p, u = f / 40;
      T.camara([p.x - 3 + u * 2.5, p.y + 2.1, p.z + 3.5], [p.x + 1, p.y + 1.2, p.z - 5], 60);
      T.ir(p.x + 0.3, p.z - 5, false);
    },
  },
  /* el Bosque de Hongos: cae sobre el hongo más alto (al borde del bosque) y sale volando */
  hongos: {
    reino: 'plaza', hora: 0.5,
    preparar: (A, T) => { A.yo.ponerEn(new A.THREE.Vector3(-88, 17.5, -126), 0.6); A.yo.v.set(0, -2, 0); A.cam.detras(0.6); },
    cuadro: (A, T, f) => {
      const p = A.yo.p;
      T.camara([p.x + 4.6, Math.max(12, p.y - 0.6), p.z + 4.6], [p.x, p.y + 0.4, p.z], 62);
    },
  },
  /* la bahía del faro al atardecer: corre por la orilla (de 116,98 a 97,122); la cámara va detrás, por la orilla */
  bahia: {
    reino: 'plaza', hora: 0.71,
    preparar: (A, T) => { T.ponerEn(116, 98.5, -0.7); },
    cuadro: (A, T, f) => {
      const p = A.yo.p; T.ir(97, 122, true);
      T.camara([p.x + 5.2, p.y + 2.6, p.z - 4.2], [p.x - 1.5, p.y + 1.2, p.z + 5], 60);
    },
  },
  /* deslizándose por debajo de una compuerta del runner (todavía sano: antes del drop) */
  desliza: {
    reino: 'runner',
    preparar: (A, T) => { const R = A.reino, P = R.obst.find((O) => O.tipo === 'puerta'), Tr = R.tramos.find((q) => P.z >= q.z0 && P.z <= q.z1); T.bot(A, 6, Math.max(Tr.z0 + 1.5, P.z - 17)); },
    cuadro: (A, T, f) => {
      const p = A.yo.p;
      /* (en vertical el campo horizontal es de ~35°: la cámara mira al muñeco, no adelante) */
      T.camara([p.x + 4, p.y + 0.8, p.z + 1.4], [p.x, p.y + 0.55, p.z + 0.6], 58);
    },
  },
  /* el ✦ Poder (TearDrop): carga, estrella y onda, de frente */
  poder: {
    reino: 'plaza', hora: 0.46,
    preparar: (A, T) => { T.ponerEn(-14, 24, 1.6); T.saltear(4); A.J.gesto('poder'); T.saltear(22); },
    cuadro: (A, T, f) => {
      const p = A.yo.p, r = A.yo.rumbo;
      T.camara([p.x + Math.sin(r + 0.55) * 5, p.y + 1.5, p.z + Math.cos(r + 0.55) * 5], [p.x + Math.sin(r) * 1.8, p.y + 1.1, p.z + Math.cos(r) * 1.8], 62);
    },
  },
  /* el parkour: después de la cuenta, corre y salta entre plataformas */
  parkour: {
    reino: 'parkour', params: '&nivel=0',
    preparar: (A, T) => { T.saltear(108); },
    cuadro: (A, T, f) => {
      T.E.z = -1; T.E.corre = true; if (f === 8 || f === 22) T.E.salta = true; T.E.sostiene = f > 8 && f < 32;
      const p = A.yo.p, r = A.yo.rumbo;
      T.camara([p.x - Math.sin(r) * 6 + Math.cos(r) * 3, p.y + 2.6, p.z - Math.cos(r) * 6 - Math.sin(r) * 3], [p.x + Math.sin(r) * 4, p.y + 0.8, p.z + Math.cos(r) * 4], 60);
    },
  },
  /* el Tiro de Burbujas en primera persona: después de la cuenta, tirando y girando despacio */
  tiro: {
    reino: 'tiro',
    preparar: (A, T) => { T.saltear(190); },
    cuadro: (A, T, f) => {
      /* apunta al blanco vivo más cerca de la mira (yaw y pitch como camara.js › actualizarFP) y tira */
      const c = A.motor.camara.position, vivos = A.reino.blancos.filter((B) => B.vivo && B.esc > 0.5);
      const dir = (B) => { const d = B.G0.position.clone().sub(c); return { yaw: Math.atan2(-d.x, -d.z), pitch: 0.3 - Math.atan2(d.y, Math.hypot(d.x, d.z)) }; };
      if (!T.blanco || !T.blanco.vivo) T.blanco = vivos.sort((a, b) => Math.abs(dir(a).yaw - A.cam.yaw) - Math.abs(dir(b).yaw - A.cam.yaw))[0];
      if (T.blanco) { const o = dir(T.blanco); let dy = o.yaw - A.cam.yaw; while (dy > Math.PI) dy -= 6.2832; while (dy < -Math.PI) dy += 6.2832; A.cam.yaw += dy * 0.35; A.cam.pitch += (o.pitch - A.cam.pitch) * 0.35; if (Math.abs(dy) < 0.04 && f % 3 === 0) T.E.dispara = true; }
    },
  },
  /* ------------------------------------------------------------ B · juegos */
  /* la ronda de puertas de la Zona de Juegos, girando */
  portales: {
    reino: 'juegos', hora: 0.45,
    preparar: (A, T) => { T.ponerEn(0, 3, Math.PI); },
    cuadro: (A, T, f) => {
      /* (de afuera de la ronda y alto: más cerca atravesaba los carteles de las puertas) */
      const a = -0.4 + f * 0.008, r = 21 - f * 0.025;
      T.camara([Math.sin(a) * r, 9.5 - f * 0.02, Math.cos(a) * r], [0, 1.2, -1], 58);
      T.ir(-5.8, -8, false);
    },
  },
  damas: {
    reino: 'juegos', hora: 0.45,
    preparar: (A, T) => {
      const M = A.reino.mesas.lista[0], S = M.sillas[0];
      A.yo.ponerEn(S.it.pos.clone(), S.rumbo); A.interactuar(S.it); T.saltear(40);
    },
    cuadro: (A, T, f) => {
      const M = A.reino.mesas.lista[0], a = M.rot + 0.7 + f * 0.01;
      T.camara([M.x + Math.sin(a) * 1.9, M.y + 1.7, M.z + Math.cos(a) * 1.9], [M.x, M.y + 0.8, M.z], 46);
    },
  },
  futbol: {
    reino: 'juegos', hora: 0.45,
    preparar: (A, T) => {
      const C = A.reino.CANCHA, pel = A.reino.pelota;
      T.ponerEn(C.cx - 4, C.cz, Math.PI / 2); pel.p.set(C.cx - 3, 1.3, C.cz); pel.v.set(0, 0, 0); T.saltear(4);
    },
    cuadro: (A, T, f) => {
      const C = A.reino.CANCHA, pel = A.reino.pelota;
      if (f < 5) T.ir(C.cx + 10, C.cz, true);
      if (f === 5) A.reino.patear(A.yo, A.J);
      T.camara([C.cx - 7 + f * 0.1, 2.4, C.cz + 5.5], [pel.p.x, 1.4, pel.p.z], 55);
    },
  },
  trampolin: {
    reino: 'juegos', hora: 0.45,
    preparar: (A, T) => { const R = A.reino.tramp[0]; A.yo.ponerEn(new A.THREE.Vector3(R.x, 7, R.z), 0.4); T.saltear(10); },
    cuadro: (A, T, f) => {
      const R = A.reino.tramp[0], p = A.yo.p;
      T.camara([R.x + 5.5, 1.8, R.z + 5.5], [p.x, p.y + 1, p.z], 58);
    },
  },
  tobogan: {
    reino: 'juegos', hora: 0.45,
    preparar: (A, T) => { const R = A.reino.RAMPA; A.yo.ponerEn(new A.THREE.Vector3(R.x0 + 0.4, R.y0 + 0.2, R.z), -Math.PI / 2); T.saltear(3); },
    cuadro: (A, T, f) => {
      const R = A.reino.RAMPA, p = A.yo.p;
      T.camara([R.x1 + 2.5, 2.4, R.z + 4.5], [p.x, p.y + 0.6, p.z], 55);
    },
  },
  /* la gente: amigos con nombre, charlando y bailando alrededor de la fuente */
  social: {
    reino: 'plaza', hora: 0.47,
    preparar: (A, T) => { T.ponerEn(-14, 24, -2.2); },
    cuadro: (A, T, f) => {
      const p0 = [-14, 24];
      const AMIGOS = [
        ['Luli', 1.6, 0.8, { color: '#ff5fb0', motivo: 'flores', sombrero: 'flor' }, 'holaaa 🫧', 6, 'saludar'],
        ['Tomi', -1.5, 1.0, { color: '#39e07a', motivo: 'hojas', sombrero: 'gorra', material: 'mate' }, 'vamos al runner?', 26, 'bailar1'],
        ['Mica', 0.4, -1.7, { color: '#6a4bff', motivo: 'galaxia', material: 'perla', espalda: 'alas' }, 'qué lindo el cielo', 46, 'aplaudir'],
        ['Santi', 2.2, -1.2, { color: '#ffd23f', motivo: 'burbujas', sombrero: 'auriculares' }, '', 0, 'bailar2'],
        ['Pili', -2.3, -0.8, { color: '#43d8cd', motivo: 'aurora', sombrero: 'corona' }, 'jajaja', 64, 'festejar'],
      ];
      for (const [nombre, dx, dz, ap, dice, cuando, gesto] of AMIGOS) {
        const x = p0[0] + dx, z = p0[1] + dz, y = A.reino.mundo.altura(x, z);
        const r = T.falso(nombre, { x, y, z, facingAngle: Math.atan2(p0[0] - x, p0[1] - z), estado: 'quieto', gesto: f >= cuando ? gesto + '#1' : null }, ap);
        if (dice && f === cuando) r.m.decir(dice);
      }
      if (f === 10) A.J.gesto('saludar');
      const a = 0.9 + f * 0.008, y0 = A.reino.mundo.altura(p0[0], p0[1]);
      T.camara([p0[0] + Math.sin(a) * 5.2, y0 + 2.4, p0[1] + Math.cos(a) * 5.2], [p0[0], y0 + 0.9, p0[1]], 50);
    },
  },
  /* el Estelario del telescopio: el cielo de Buenos Aires de noche */
  estelario: {
    reino: 'plaza', hora: 0.45,
    preparar: (A, T) => {
      A.J.abrirEstelario(); const S = A.estelario;
      S.ms = Date.UTC(2026, 8, 26, 2, 30); S.vel = 60; S.az = 175; S.alt = 42; S.fov = 78;
      T.saltear(3);
    },
    cuadro: (A, T, f) => { const S = A.estelario, u = f / 97; S.az = 175 + u * 32; S.alt = 42 - u * 6; S.fov = 78 - u * 22; },
  },
  /* ------------------------------------------------------------ C · el breakcore */
  /* el runner con el bot, desde 2 compases antes del drop (el tiempo del juego = el de la canción) */
  runner: {
    reino: 'runner', desdeCancion: 16.543,
    preparar: (A, T) => { T.bot(A, 16.543); },
    cuadro: (A, T, f) => { },
  },
  runnerFin: {
    reino: 'runner', desdeCancion: 55.0,
    /* (a los 55 s el que corre bien ya llegó: se lo pone por los tramos de las figuras, con lo roto al máximo) */
    preparar: (A, T) => { T.bot(A, 55.0, 600); A.delirio.decir = () => {}; },
    cuadro: (A, T, f) => { },
  },
  /* ------------------------------------------------------------ D · Wii Party */
  /* todo vuelve a brillar: los amigos saludan a cámara y la cámara se aleja subiendo */
  final: {
    reino: 'plaza', hora: 0.66,
    preparar: (A, T) => { T.ponerEn(-14, 24, 0.3); A.J.gesto('festejar'); },
    cuadro: (A, T, f) => {
      const p0 = [-14, 24], y0 = A.reino.mundo.altura(p0[0], p0[1]);
      const AMIGOS = [['Luli', 1.5, -0.4, { color: '#ff5fb0', motivo: 'flores', sombrero: 'flor' }], ['Tomi', -1.5, -0.3, { color: '#39e07a', motivo: 'hojas', sombrero: 'gorra', material: 'mate' }], ['Mica', 0.8, -1.8, { color: '#6a4bff', motivo: 'galaxia', material: 'perla', espalda: 'alas' }], ['Pili', -0.9, -1.8, { color: '#43d8cd', motivo: 'aurora', sombrero: 'corona' }]];
      for (const [nombre, dx, dz, ap] of AMIGOS) { const x = p0[0] + dx, z = p0[1] + dz; T.falso(nombre, { x, y: A.reino.mundo.altura(x, z), z, facingAngle: 0.3, estado: 'quieto', gesto: 'saludar#' + (1 + Math.floor(f / 50)) }, ap); }
      const u = T.suave(f / 125);
      /* (sube casi derecho: yendo para atrás se metía en un árbol) */
      T.camara([p0[0] + 1.5 + u * 1.5, y0 + 1.9 + u * 11, p0[1] + 5 + u * 2.5], [p0[0], y0 + 0.9 - u * 0.6, p0[1] - 0.5], 48 + u * 12);
    },
  },
  /* el fondo del cartel final: la plaza al atardecer desde arriba, girando despacio */
  cierre: {
    reino: 'plaza', hora: 0.74,
    preparar: (A, T) => { T.ponerEn(-2, 12, 0); },
    cuadro: (A, T, f) => {
      const a = 2.2 + f * 0.0035;
      T.camara([Math.sin(a) * 60, 34 - f * 0.03, 6 + Math.cos(a) * 60], [0, 6, 0], 55);
    },
  },
};
