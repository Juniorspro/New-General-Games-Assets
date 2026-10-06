/* ============================================================================
   barro/js/main.js — el arranque y el bucle: la carrera de fondo del menú,
   las mangas (campeonato, Jam del día y contrarreloj con fantasma), los
   efectos que dispara cada evento (polvo, golpes, avisos, vibración), la
   cámara en cámara lenta al cruzar la meta, y el HUD.
   ========================================================================== */
import { PASO, altoEn } from './fisica.js';
import { construir, PISTAS, MUNDOS, pistaJam, numeroJam, azar } from './pistas.js';
import { crearCarrera, pasoCarrera, cerrar, ordenar } from './carrera.js';
import { crearVista, medir, prepararPista, moverCamara, dibujar, sacudir, polvo, terrones, humo, soltarPiloto, levantarPiloto, aX, aY } from './dibujo.js';
import { EQUIPOS, dibujarMoto } from './moto.js';
import { cargarComun, cargarMundo } from './arte.js';
import { crearControles, entrada, ubicar, vibrar } from './controles.js';
import { iniciarSonido, motor, sfx, musica, volumen, pausarSonido } from './sonido.js';
import { D, guardar } from './guardado.js';
import { t, setIdioma } from './textos.js';
import { crearUI } from './ui.js';
import { crearPiloto, manejar } from './piloto.js';

const lienzo = document.getElementById('lienzo');
const V = crearVista(lienzo);
const K = crearControles(document.getElementById('controles'));
const NOMBRES = ['Nacho', 'Flor', 'Tincho', 'Lu', 'Bauti', 'Cami', 'Santi', 'Juli', 'Pato', 'Ro', 'Gonza', 'Mica', 'Fede', 'Vale', 'Tomi', 'Agus', 'Maite', 'Lauti'];
const PREMIOS = [400, 260, 180, 120, 80, 50];

const J = {
  modo: 'menu',          // menu | carrera
  C: null, P: null, def: null, tipo: null,   // tipo: campeonato | jam | reloj
  pausa: false, acum: 0, lento: 1, finTimer: 0, avisos: [], fantasma: null, grabacion: [], terminado: false,
  demo: null,
};
window.__barro = J;     // para las pruebas

/* ---------------- armar una manga ---------------- */
function rivalesPara(def, tipo) {
  const r = azar((def.semilla || 1) * 3 + 5);
  const n = def.n ?? 10;
  const base = tipo === 'jam' ? 0.8 : 0.32 + 0.62 * (n / 19);
  const mejNivel = tipo === 'jam' ? 3 : Math.min(5, Math.floor(n / 4));
  const usados = new Set([D.equipo]);
  const nombres = [...NOMBRES].sort(() => r() - 0.5);
  const carriles = [0, 1, 3, 4, 5];
  return [-0.16, -0.09, -0.03, 0.03, 0.08].map((d, i) => {
    let eq = Math.floor(r() * EQUIPOS.length); while (usados.has(eq)) eq = (eq + 1) % EQUIPOS.length; usados.add(eq);
    return { nombre: nombres[i], numero: 2 + Math.floor(r() * 97), colores: EQUIPOS[eq], ia: Math.max(0.15, Math.min(1, base + d)), carril: carriles[i], mejoras: { motor: mejNivel, susp: mejNivel, agarre: mejNivel, piloto: mejNivel } };
  });
}

async function empezar(def, tipo) {
  iniciarSonido();
  await cargarMundo(def.mundo);
  const P = construir(def);
  const yo = { jugador: true, nombre: D.nombre || ({ es: 'VOS', en: 'YOU', pt: 'VOCÊ' }[D.idioma] || 'VOS'), numero: D.numero, colores: EQUIPOS[D.equipo], mejoras: D.mejoras, carril: 2 };
  const lista = tipo === 'reloj' ? [yo] : [yo, ...rivalesPara(def, tipo)];
  J.C = crearCarrera(P, lista); J.P = P; J.def = def; J.tipo = tipo;
  J.modo = 'carrera'; J.pausa = false; J.acum = 0; J.lento = 1; J.finTimer = 0; J.terminado = false;
  J.grabacion = []; J.fantasma = tipo !== 'jam' ? (D.fantasmas[def.id] || null) : null;
  J.avisos.length = 0; J.ultimoBip = 4;
  J.bot = new URLSearchParams(location.search).has('bot') ? crearPiloto(1, 99) : null;
  prepararPista(V, P);
  moverCamara(V, J.C.corredores[0], 0.016, true);
  UI.carrera(def, tipo);
  musica('carrera');
  K.soltarTodo();
}

/* ---------------- la carrera de fondo del menú ---------------- */
function armarDemo() {
  const def = PISTAS[Math.floor(Math.random() * 5)];
  const P = construir(def);
  const lista = rivalesPara({ ...def, n: 12 }, 'campeonato').concat([{ nombre: 'JX', numero: 1, colores: EQUIPOS[0], ia: 0.95, carril: 2 }]);
  J.demo = { C: crearCarrera(P, lista), P, def };
  prepararPista(V, P);
  moverCamara(V, J.demo.C.corredores[0], 0.016, true);
}

/* ---------------- eventos → efectos ---------------- */
function efectos(C, esJuego) {
  const yo = C.corredores.find((c) => c.jugador);
  for (const e of C.eventos) {
    const c = C.corredores[e.c];
    const cerca = yo && c ? Math.abs(c.moto.x - yo.moto.x) < 25 : true;
    switch (e.tipo) {
      case 'porton':
        if (esJuego) { sfx('porton'); aviso(t('ya'), 'grande'); vibrar(30); }
        for (const k of C.corredores) polvo(V, k.moto.x - 0.6, altoEn(C.pista.suelo, k.moto.x), 4, 1);
        break;
      case 'aterrizaje': {
        const fuerte = Math.min(1, Math.max(0, (e.golpe - 2) / 10));
        polvo(V, e.x, altoEn(C.pista.suelo, e.x), 4 + Math.round(fuerte * 10), 0.8 + fuerte);
        if (esJuego && c?.jugador) {
          if (e.calidad === 'perfecto' && e.aire > 0.5) { aviso(t('perfecto'), 'perfecto'); sfx('perfecto'); }
          else if (e.calidad === 'duro') { aviso(t('duro'), 'malo'); vibrar(40); }
          sfx('cae', 0.4 + fuerte); sacudir(V, 2 + fuerte * 7);
        } else if (esJuego && cerca) sfx('cae', 0.15 + fuerte * 0.2);
        break;
      }
      case 'caida':
        soltarPiloto(V, c);
        if (esJuego && c.jugador) { aviso(t('caida'), 'malo'); sfx('caida'); sacudir(V, 10); vibrar([60, 40, 90]); }
        else if (esJuego && cerca) sfx('caida', 0.5);
        break;
      case 'levanta': levantarPiloto(V, c); break;
      case 'holeshot': if (esJuego && c?.jugador) { aviso(t('holeshot'), 'perfecto'); sfx('plata'); } break;
      case 'meta':
        if (esJuego && c?.jugador) terminar(C);
        break;
    }
  }
  C.eventos.length = 0;
}

/* polvo, terrones y humo que salen de cada moto en cada cuadro */
function rastro(C, dt) {
  for (const c of C.corredores) {
    const M = c.moto, R = M.ruedas[0];
    const v = Math.hypot(M.vx, M.vy);
    c.vistaIncl = (c.vistaIncl || 0) + (((c.jugador ? J.ultimaEntrada?.inclinar : c.piloto?.sal.inclinar) || 0) - (c.vistaIncl || 0)) * Math.min(1, dt * 10);
    if (M.caido || C.t < 0) continue;
    if (R.enSuelo) {
      const gas = c.jugador ? J.ultimaEntrada?.gas || 0 : c.piloto?.sal.gas || 0;
      const qx = R.cx - R.nx * 0.34, qy = R.cy - R.ny * 0.34;
      if ((R.gira > 0.05 || (gas > 0.5 && v < 14)) && Math.random() < dt * 30) terrones(V, qx - 0.2, qy + 0.05, -4 - v * 0.2, 2.5, 2);
      if (v > 6 && Math.random() < dt * (6 + v * 0.6)) polvo(V, qx - 0.4, qy, 1, 0.5);
    }
    if (Math.random() < dt * 4) humo(V, M.x - Math.cos(M.a) * 1.0, M.y + 0.2);
  }
}

/* ---------------- avisos en pantalla ---------------- */
const elAviso = document.getElementById('aviso');
function aviso(texto, clase = '') {
  const d = document.createElement('div');
  d.className = 'toast ' + clase; d.textContent = texto;
  elAviso.appendChild(d);
  setTimeout(() => d.remove(), 1300);
}

/* ---------------- la llegada ---------------- */
function terminar(C) {
  if (J.terminado) return;
  J.terminado = true; J.lento = 0.3; J.finTimer = 0;
  const yo = C.corredores.find((c) => c.jugador);
  sfx('meta'); sfx('ovacion'); vibrar([40, 30, 40, 30, 120]);
  aviso(yo.puesto === 1 ? t('ganaste') : yo.puesto <= 3 ? t('podio') : t('meta'), yo.puesto <= 3 ? 'oro grande' : 'grande');
}
function resultados() {
  const C = J.C, def = J.def;
  const L = cerrar(C);
  const yo = C.corredores.find((c) => c.jugador);
  const res = { puesto: yo.puesto, tiempo: yo.tiempo, lista: L, plata: 0, medalla: 0, record: false, caidas: yo.caidas, mejorAire: yo.mejorAire, perfectos: yo.perfectos };
  if (J.tipo === 'campeonato') {
    res.plata = Math.round(PREMIOS[yo.puesto - 1] * (1 + def.sede * 0.5));
    res.medalla = yo.puesto <= 3 ? yo.puesto : 0;
    const antes = D.medallas[def.id] || 0;
    if (res.medalla && (!antes || res.medalla < antes)) D.medallas[def.id] = res.medalla;
  } else if (J.tipo === 'jam') {
    res.plata = Math.round(PREMIOS[yo.puesto - 1] * 0.8);
    const n = def.jam;
    if (!D.jam[n] || yo.tiempo < D.jam[n]) { D.jam[n] = yo.tiempo; res.record = true; }
  }
  if (J.tipo !== 'jam' && (!D.tiempos[def.id] || yo.tiempo < D.tiempos[def.id])) {
    if (D.tiempos[def.id]) res.record = true;
    D.tiempos[def.id] = yo.tiempo;
    D.fantasmas[def.id] = { t: yo.tiempo, g: J.grabacion.map((v) => Math.round(v * 100) / 100), colores: D.equipo };
  }
  D.plata += res.plata;
  guardar();
  return res;
}

/* ---------------- el fantasma: se graba a 20 por segundo ---------------- */
function grabar(C) {
  const yo = C.corredores.find((c) => c.jugador);
  if (C.t < 0 || J.terminado) return;
  const k = Math.floor(C.t * 20);
  if (J.grabacion.length / 4 <= k) J.grabacion.push(yo.moto.x, yo.moto.y, yo.moto.a, yo.vistaIncl || 0);
}
function dibujarFantasma(C) {
  const F = J.fantasma;
  if (!F || C.t < 0) return;
  const g = F.g, k = C.t * 20, i = Math.floor(k), f = k - i;
  if ((i + 1) * 4 + 3 >= g.length) return;
  const L = (o) => g[i * 4 + o] * (1 - f) + g[(i + 1) * 4 + o] * f;
  const x = L(0), y = L(1), a = L(2), incl = L(3);
  const ctx = V.ctx, z = V.cam.z;
  ctx.save(); ctx.globalAlpha = 0.38;
  ctx.translate(aX(V, x), aY(V, y) - 0.35 * z); ctx.scale(z * 0.97, -z * 0.97); ctx.rotate(a);
  dibujarMoto(ctx, { rx: -0.72, ry: -0.42, fx: 0.74, fy: -0.42, giro0: x / 0.34, giro1: x / 0.34, colores: EQUIPOS[F.colores ?? 0], numero: '', pose: { incl } });
  ctx.restore();
}

/* ---------------- el HUD ---------------- */
const H = {
  puesto: document.getElementById('h-puesto'), tiempo: document.getElementById('h-tiempo'), barra: document.getElementById('h-barra'),
  cuenta: document.getElementById('cuenta'), puntos: [],
};
function armarHUD(C) {
  H.barra.innerHTML = '<div class="meta-bandera"></div>';
  H.puntos = C.corredores.map((c) => {
    const p = document.createElement('div');
    p.className = 'punto' + (c.jugador ? ' yo' : '');
    p.style.background = c.colores.casco; p.style.borderColor = c.colores.casco2;
    H.barra.appendChild(p);
    return p;
  });
  H.puesto.parentElement.style.display = J.tipo === 'reloj' ? 'none' : '';
}
function actualizarHUD(C) {
  const yo = C.corredores.find((c) => c.jugador);
  if (J.tipo !== 'reloj') H.puesto.innerHTML = `${t('puesto')(yo.lugar)}<small>/${C.corredores.length}</small>`;
  const tt = Math.max(0, C.t);
  H.tiempo.textContent = `${Math.floor(tt / 60)}:${(tt % 60).toFixed(1).padStart(4, '0')}`;
  const L = C.pista.xMeta - C.pista.xLargada;
  C.corredores.forEach((c, i) => { H.puntos[i].style.left = `${Math.max(0, Math.min(1, (c.moto.x - C.pista.xLargada) / L)) * 100}%`; });
  // cuenta regresiva
  if (C.t < 0) {
    const n = Math.ceil(-C.t);
    if (n <= 3 && n !== J.ultimoBip) { J.ultimoBip = n; H.cuenta.textContent = n; H.cuenta.className = 'cuenta ver'; void H.cuenta.offsetWidth; H.cuenta.classList.add('pulso'); sfx('bip'); }
  } else if (J.ultimoBip !== 0) { J.ultimoBip = 0; H.cuenta.className = 'cuenta'; sfx('ya'); }
}

/* ---------------- el bucle ---------------- */
let antes = performance.now();
function cuadro(ahora) {
  const dt = Math.min(0.05, (ahora - antes) / 1000); antes = ahora;
  if (J.modo === 'carrera' && J.C) {
    const C = J.C;
    if (!J.pausa) {
      // ?bot: el jugador lo maneja el piloto de los rivales (para probar y para grabar)
      const inp = J.bot ? { ...manejar(J.bot, C.corredores.find((c) => c.jugador).moto, C.pista, C.t) } : entrada(K);
      J.ultimaEntrada = inp;
      J.acum += dt * J.lento;
      let n = 0;
      while (J.acum >= PASO && n < 40) { pasoCarrera(C, inp); grabar(C); J.acum -= PASO; n++; }
      efectos(C, true);
      rastro(C, dt * J.lento);
      if (J.terminado) {
        J.finTimer += dt;
        if (J.finTimer > 1.3) J.lento += (1 - J.lento) * Math.min(1, dt * 2);
        if (J.finTimer > 3.2 && !J.mostroResultado) { J.mostroResultado = true; UI.resultado(resultados(), J.def, J.tipo); musica('menu'); }
      }
      const yo = C.corredores.find((c) => c.jugador);
      moverCamara(V, yo, dt);
      const vivos = C.corredores.filter((c) => !c.jugador);
      const cercania = vivos.reduce((s, c) => s + Math.max(0, 1 - Math.abs(c.moto.x - yo.moto.x) / 30), 0) / Math.max(1, vivos.length);
      const finPub = Math.max(0, 1 - Math.abs(yo.moto.x - C.pista.xMeta) / 60) + Math.max(0, 1 - Math.abs(yo.moto.x - C.pista.xLargada) / 50);
      motor({ v: Math.hypot(yo.moto.vx, yo.moto.vy), gas: J.terminado ? 0.2 : C.t < 0 ? inp.gas : inp.gas, aire: yo.moto.aire > 0.05, caido: yo.moto.caido, gira: yo.moto.ruedas[0].gira, rivales: Math.min(1, cercania * 2), publico: Math.min(1, finPub), activo: true });
    }
    dibujar(V, C, J.pausa ? 0 : dt * J.lento);
    dibujarFantasma(C);
    actualizarHUD(C);
  } else if (J.demo) {
    const C = J.demo.C;
    J.acum += dt;
    let n = 0;
    while (J.acum >= PASO && n < 40) { pasoCarrera(C, {}); J.acum -= PASO; n++; }
    efectos(C, false); rastro(C, dt);
    if (Math.round(C.t * 10) % 10 === 0) ordenar(C);
    const lider = C.orden[0] || C.corredores[0];
    moverCamara(V, lider, dt);
    V.etiquetas = false;
    dibujar(V, C, dt, { indicadores: false });
    V.etiquetas = true;
    if (lider.tiempo !== null && C.t - lider.tiempo > 3) armarDemo();
    motor({ activo: false, publico: 0 });
  }
  requestAnimationFrame(cuadro);
}

/* ---------------- la interfaz ---------------- */
const UI = crearUI({
  empezar, K, D, guardar,
  salirAlMenu() { J.modo = 'menu'; J.C = null; J.mostroResultado = false; armarDemo(); musica('menu'); },
  pausar(si) { J.pausa = si; pausarSonido(false); if (si) motor({ activo: false }); },
  reiniciar() { J.mostroResultado = false; empezar(J.def, J.tipo); },
  siguiente() {
    J.mostroResultado = false;
    const sig = PISTAS[(J.def.n ?? -1) + 1];
    if (J.tipo === 'campeonato' && sig) empezar(sig, 'campeonato'); else UI.salir();
  },
  armarHUD: () => armarHUD(J.C),
  volumen, iniciarSonido, sfx, musica,
  calidad(c) { D.ajustes.calidad = c; guardar(); medir(V, c); },
  jam() { const n = numeroJam(); return { ...pistaJam(n), n: 10 }; },
  reloj(def) { return def; },
});

function redimensionar() { medir(V, D.ajustes.calidad); ubicar(K); }
addEventListener('resize', redimensionar);
document.addEventListener('visibilitychange', () => { if (document.hidden && J.modo === 'carrera' && !J.pausa && !J.terminado) UI.pausa(); pausarSonido(document.hidden); });

(async function arrancar() {
  setIdioma(D.idioma || 'es');
  for (const [id, b] of Object.entries(K.botones)) b.querySelector('span').textContent = t(id);
  volumen('musica', D.ajustes.musica); volumen('efectos', D.ajustes.efectos);
  medir(V, D.ajustes.calidad);
  await cargarComun();
  armarDemo();
  document.getElementById('cargando').remove();
  requestAnimationFrame(cuadro);
  if (!D.idioma) UI.idioma(); else UI.menu();
  window.__barro.listo = true;
})();
