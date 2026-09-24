/* ============================================================================
   aeroplaza/js/main.js — une todo: las pantallas, los reinos, el muñeco, la
   red, las misiones, el sonido y la calidad automática.
   Parámetros de la dirección (para probar): ?directo (salta los menús),
   ?reino=aqua, ?nombre=Pepa, ?broker=ws://127.0.0.1:1883, ?hora=0.5,
   ?calidad=baja, ?pausa (sin bucle: lo avanzan las pruebas), ?x=&z=&yaw=…
   ========================================================================== */
import * as THREE from 'three';
import { Motor } from './motor.js';
import { Cielo } from './cielo.js';
import { TEX, UNI, JUGADOR, aguaSigueCielo, materialBurbuja } from './naturaleza.js';
import { TEXTURAS_MOTIVO, Meeple, APARIENCIA_INICIAL, MATERIALES, MOTIVOS, SOMBREROS, ANTEOJOS, ESPALDAS, PEINADOS, PARTICULAS } from './meeple.js';
import { crearPlaza } from './reinos/plaza.js';
import { crearAqua } from './reinos/aqua.js';
import { crearAurora } from './reinos/aurora.js';
import { crearJardin } from './reinos/jardin.js';
import { crearTienda } from './reinos/tienda.js';
import { crearCasa } from './reinos/casa.js';
import { Jugador } from './jugador.js';
import { Camara } from './camara.js';
import { Entrada } from './entrada.js';
import { Guardado, miId } from './guardar.js';
import { t, ponerIdioma } from './textos.js';
import { UI } from './ui.js';
import { Red, BROKER } from './red.js';
import { Remotos } from './remotos.js';
import { Misiones, NPCS } from './misiones.js';
import { FRUTAS, Chispas } from './objetos.js';
import { cargarDelfin } from './delfin.js';
import { Sonido } from '../../brillo/js/sonido.js';
import '../../brillo/js/canciones.js';

const Q = new URLSearchParams(location.search);
const CREAR = { plaza: crearPlaza, aqua: crearAqua, aurora: crearAurora, jardin: crearJardin, tienda: crearTienda, casa: crearCasa };
const MUSICA_DE = { plaza: 'colina', aqua: 'arrecife', aurora: 'aurora', jardin: 'cielo', tienda: 'ciudad', casa: 'titulo' };

async function cargarTexturas() {
  const L = new THREE.TextureLoader(), A = window.ARCHIVOS || {};
  await Promise.all(Object.entries(A).filter(([n]) => /\.(webp|png|jpg)$/.test(n)).map(([n, url]) => new Promise((ok) => L.load(url, (tx) => {
    const k = n.replace(/\.\w+$/, ''); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    if (/^(pasto|arena|motivo-)/.test(k)) tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    TEX[k] = tx; if (k.startsWith('motivo-')) TEXTURAS_MOTIVO[k.slice(7)] = tx; ok();
  }, undefined, () => ok()))));
}
/* un número corto que cambia cuando cambia la apariencia (para pedirla solo si hace falta) */
const hash = (o) => { const s = JSON.stringify(o); let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; };
/* lo que llega de la red se revisa antes de usarlo */
function apariencia(A) {
  const B = APARIENCIA_INICIAL(); if (!A || typeof A !== 'object') return B;
  const col = (c, d) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : d);
  const de = (v, l, d) => (l.includes(v) ? v : d);
  return { color: col(A.color, B.color), color2: col(A.color2, B.color2), colorPelo: col(A.colorPelo, B.colorPelo), cubre: Math.max(0, Math.min(1.3, +A.cubre || 0)),
    motivo: de(A.motivo, MOTIVOS, B.motivo), material: de(A.material, MATERIALES, B.material), sombrero: de(A.sombrero, SOMBREROS, B.sombrero), anteojos: de(A.anteojos, ANTEOJOS, B.anteojos),
    espalda: de(A.espalda, ESPALDAS, B.espalda), peinado: de(A.peinado, PEINADOS, B.peinado), particulas: de(A.particulas, PARTICULAS, B.particulas) };
}

async function iniciar() {
  await cargarTexturas();
  await cargarDelfin();
  const G = Guardado.cargar();
  const ID = miId();
  if (Q.has('nombre')) G.nombre = Q.get('nombre').slice(0, 16);
  if (G.idioma) ponerIdioma(G.idioma);
  Misiones.G = G;
  const motor = new Motor(document.getElementById('lienzo'));
  const nubes = ['nube-1', 'nube-2', 'nube-3'].map((k) => TEX[k]).filter(Boolean);
  const cielo = new Cielo(motor, nubes);
  const ent = new Entrada(motor.lienzo, document.getElementById('dedos'));
  if (G.controles) ent.ponerConfig(G.controles);
  const cam = new Camara(motor.camara);
  const red = new Red({ id: ID, nombre: G.nombre });
  const remotos = new Remotos(motor.escena);
  const efectos = new THREE.Group(); motor.escena.add(efectos);
  const chispas = new Chispas(efectos, '#ffffff', 160);

  let reino = null, yo = null, enJuego = false, pausado = false, enDialogo = false, probador = false, modoFoto = false, construyendo = null;
  let tHud = 0, tPresencia = 0, gestoN = 0, tDisparo = 0, tSinGolpe = 9, tMedir = 0, cuadros = 0, sumaDt = 0, midiendo = true;
  const cache = {};
  const disparos = [];
  const matDisparo = materialBurbuja(1);

  /* ---------------------------------------------------------------- el J que usa la interfaz */
  const J = {
    G, id: ID, red, remotos, ent, misiones: Misiones, slot: 1, musicaElegida: null,
    get yo() { return yo; }, get enJuego() { return enJuego; },
    sfx(n, o) { try { Sonido.sfx(n, o); } catch { /* sin audio */ } },
    musica(n) { try { Sonido.musica(n); } catch { /* nada */ } },
    volumen() { try { Sonido.volumenes(G.opciones.musica, G.opciones.efectos); } catch { /* nada */ } },
    guardar() { Guardado.guardar(); },
    guardarControles() { G.controles = ent.config; Guardado.guardar(); },
    ponerCalidad(q) { if (q === 'auto') { midiendo = true; cuadros = 0; sumaDt = 0; tMedir = 0; q = 'alta'; } else midiendo = false; motor.ponerCalidad(q); for (const k in cache) delete cache[k]; },
    ponerRetro() { motor.ponerRetro(G.opciones.retro); },
    mostrarNombres() { for (const r of remotos.m.values()) if (r.m.cartel) r.m.cartel.visible = G.opciones.nombres; },
    alCambiarIdioma() { if (reino) for (const n of reino.npcMallas || []) n.m.ponerNombre(t('npc_' + n.id)); },
    borrarTodo() { Guardado.borrar(); location.reload(); },
    empezar(id, o = {}) { empezarJuego(id, o); },
    pausar(si, sinMenu) { pausado = si; if (si && !sinMenu) UI.pausa(); },
    salirAlMenu() { salirAlMenu(); },
    hotbar(n) { usarHotbar(n); },
    decir(txt) { const x = red.chat(txt) || String(txt).trim().slice(0, 120); if (!x) return; UI.lineaChat(G.nombre, x); yo.m.decir(x); },
    finDialogo() { enDialogo = false; cam.ponerCine(null); },
    abrirProbador() { abrirProbador(); },
    aplicarApariencia() { yo.m.ponerApariencia(G.A); G.av = hash(G.A); red.accion({ type: 'apariencia', A: G.A, av: G.av }); Guardado.guardar(); },
    probarPuesto(ranura, valor) { yo.m.ponerApariencia({ ...G.A, [ranura]: valor }); },
    cambiarNombre() { red.nombre = G.nombre; yo.m.ponerNombre(G.nombre, true); Guardado.guardar(); },
    avisarPantalla(s) { UI.avisar(s, 'azul'); },
    gesto(g) { yo.m.hacerGesto(g); gestoN++; J.gestoActual = g + '#' + gestoN; setTimeout(() => { if (J.gestoActual && J.gestoActual.endsWith('#' + gestoN)) J.gestoActual = null; }, g === 'sentarse' ? 60000 : 8000); },
    cancionDesbloqueada(k) { return k === 'titulo' || k === 'colina' || G.discos.some((d) => DISCO_CANCION[d] === k); },
    elegirMusica(k) { J.musicaElegida = k; J.musica(k || MUSICA_DE[reino?.id] || 'colina'); },
  };
  const DISCO_CANCION = { 'disco-loma': 'colina', 'disco-lago': 'arrecife', 'disco-hotel': 'ciudad', 'disco-aurora': 'aurora', 'disco-jardin': 'cielo', 'disco-flor': 'titulo' };
  G.av = hash(G.A);
  UI.iniciar(J);

  /* ---------------------------------------------------------------- la red */
  red.alEstado = () => UI.actualizarRed();
  red.alVestibulo = () => {};
  red.alRemoto = (d) => {
    if (!enJuego) return;
    const r = remotos.recibir(d);
    if (r.av !== d.av && (!r.tPidio || performance.now() - r.tPidio > 3000)) { r.tPidio = performance.now(); red.accion({ type: 'pedir_ap', targetId: d.id }); }
    if (r.m.cartel) r.m.cartel.visible = G.opciones.nombres;
  };
  remotos.alLlegar = (r) => { UI.lineaChat('', t('se_unio', { n: r.name }), true); J.sfx('sesion'); UI.actualizarRed(); };
  remotos.alIrse = (r) => { UI.lineaChat('', t('se_fue', { n: r.name }), true); UI.actualizarRed(); };
  red.alChat = (c) => { if (!enJuego) return; UI.lineaChat(c.name, c.text); const r = remotos.get(c.id); if (r) r.m.decir(c.text); J.sfx('letra', { f: 1500 }); };
  red.alAccion = (a) => {
    if (!enJuego) return;
    const r = remotos.get(a.id);
    switch (a.type) {
      case 'apariencia': if (r) r.ponerApariencia(apariencia(a.A), a.av); else remotos.recibir({ id: a.id, name: '…' }).ponerApariencia(apariencia(a.A), a.av); break;
      case 'pedir_ap': if (a.targetId === ID) red.accion({ type: 'apariencia', A: G.A, av: G.av }); break;
      /* un golpe de burbuja: lo aplica solo a quien le toca */
      case 'hit_player': if (a.targetId === ID && yo) recibirGolpe(Math.max(0, Math.min(30, +a.dmg || 0)), String(a.byName || '?').slice(0, 20)); break;
      case 'disparo': if (r && [a.x, a.y, a.z, a.dx, a.dy, a.dz].every(Number.isFinite)) disparar(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(a.dx, a.dy, a.dz), false); break;
      case 'recoger': if (reino?.orbes && Number.isInteger(a.i)) reino.orbes.ocultar(a.i); break;
      case 'fruta': if (reino?.frutas && Number.isInteger(a.i) && reino.frutas.f[a.i]) reino.frutas.sacar(a.i); break;
      case 'sueno_suma': if (reino?.sueno) { reino.sueno.total += Math.max(0, Math.min(20, +a.n || 0)); revisarSueno(false); } break;
      case 'sueno': if (reino?.sueno && !reino.sueno.activo) { reino.empezarSueno(); UI.avisar(t('sueno_empieza'), 'bien'); J.sfx('restaura'); } break;
      case 'chau': if (r) { r.visto = 0; } break;
    }
  };
  red.alCasa = (d) => {
    if (reino?.id !== 'casa' || !reino.dueño || d.id !== reino.dueño || !Array.isArray(d.plano)) return;
    reino.rehacer(d.plano.slice(0, 80).filter((m) => m && typeof m.k === 'string' && Number.isFinite(m.x) && Number.isFinite(m.z)).map((m) => ({ k: m.k, x: +m.x, z: +m.z, r: +m.r || 0 })));
  };
  red.conectar(Q.get('broker') || BROKER);

  /* ---------------------------------------------------------------- los reinos */
  function construirReino(id, o = {}) {
    if (id === 'casa') return crearCasa({ calidad: motor.Q }, o.casaDe && o.casaDe !== ID ? { dueño: o.casaDe, plano: [] } : { plano: G.casa });
    if (!cache[id]) {
      const R = CREAR[id]({ calidad: motor.Q });
      /* la gente del lugar */
      R.npcMallas = (R.npcs || []).map((n) => {
        const m = new Meeple({ ...APARIENCIA_INICIAL(), ...NPCS[n.id].A }, t('npc_' + n.id));
        m.raiz.position.set(n.pos[0], n.y, n.pos[1]); m.raiz.rotation.y = n.rot; R.grupo.add(m.raiz);
        R.mundo.cilindro(n.pos[0], n.pos[1], 0.42, n.y - 1, n.y + 1.3);
        R.mundo.interactivo({ id: 'npc', npc: n.id, pos: m.raiz.position, radio: 2.4, accion: 'hablar', icono: '💬' });
        return { id: n.id, m, rot: n.rot };
      });
      cache[id] = R;
    }
    return cache[id];
  }
  function entrarReino(id, o = {}) {
    if (reino) motor.escena.remove(reino.grupo);
    remotos.vaciar();
    for (const d of disparos) efectos.remove(d.m); disparos.length = 0;
    reino = construirReino(id, o);
    motor.escena.add(reino.grupo);
    cielo.ponerModo(reino.cielo || {});
    if (Q.has('hora') && reino.cielo?.hora == null) cielo.ponerModo({ ...(reino.cielo || {}), hora: +Q.get('hora') });
    cielo.sol.intensity = 0;
    const p = o.en || reino.inicio;
    yo.ponerEn(p, o.rumbo ?? reino.rumboInicio ?? 0);
    yo.hp = 100;
    cam.detras(yo.rumbo); cam.inicial = true;
    UNI.uViento.value = 1;
    if (!J.musicaElegida) J.musica(MUSICA_DE[id] || 'colina');
    /* la sala pública: la casa es de su dueño; el resto, la que tenga gente y lugar */
    const sala = id === 'casa' ? 'casa-' + (o.casaDe || ID) : id === 'tienda' ? 'tienda-1' : red.elegirSala(id);
    red.casaAbierta = id === 'casa' && !o.casaDe;
    red.entrar(sala, id);
    red.mirarCasa(id === 'casa' && o.casaDe && o.casaDe !== ID ? o.casaDe : null);
    if (red.casaAbierta) { red.publicarCasa(G.casa); UI.avisar(t('casa_visitas'), 'azul'); }
    red.accion({ type: 'apariencia', A: G.A, av: G.av });
    UI.actualizarRed();
    G.ultimoReino = id === 'tienda' || id === 'casa' ? 'plaza' : id; Guardado.guardar();
  }
  async function viajar(id, o = {}) {
    if (!reino) return;
    const nombre = id === 'casa' && o.nombreCasa ? t('reino_casa_de', { n: o.nombreCasa }) : t('reino_' + id);
    const pant = UI.pantallaViaje(nombre);
    pausado = true; J.sfx('entra');
    await new Promise((r) => setTimeout(r, 380));
    entrarReino(id, o);
    await new Promise((r) => setTimeout(r, 900));
    pausado = false; pant.cerrar();
  }

  /* ---------------------------------------------------------------- empezar y salir */
  function empezarJuego(id = 'plaza', o = {}) {
    UI.cargando();
    setTimeout(() => {
      if (!yo) yo = new Jugador(motor.escena, G.A, G.nombre);
      yo.m.ponerApariencia(G.A); yo.m.ponerNombre(G.nombre, true);
      entrarReino(Q.get('reino') || id);
      if (Q.has('x')) yo.p.set(+Q.get('x'), Q.has('y') ? +Q.get('y') : reino.mundo.altura(+Q.get('x'), +Q.get('z')) + 0.1, +Q.get('z'));
      if (Q.has('yaw')) cam.yaw = +Q.get('yaw'); if (Q.has('pitch')) cam.pitch = +Q.get('pitch'); if (Q.has('dist')) cam.dist = cam.distObj = +Q.get('dist');
      enJuego = true; pausado = false;
      UI.juego();
      ent.mostrarDedos(true);
      if (o.probador) abrirProbador();
      else if (!G.visto.bienvenida) { G.visto.bienvenida = true; setTimeout(() => UI.avisar(t('plaza_desc').split('.')[0] + '.', 'azul'), 800); }
    }, 60);
  }
  function salirAlMenu() {
    enJuego = false; ent.mostrarDedos(false); probador = false; construyendo = null;
    if (reino) { motor.escena.remove(reino.grupo); reino = null; }
    red.entrar(null, null); remotos.vaciar();
    Guardado.ya();
    UI.menu();
  }

  /* ---------------------------------------------------------------- acciones del jugador */
  function abrirProbador() {
    probador = true; cam.giroProb = 0;
    ent.mostrarDedos(false);
    UI.hud && UI.hud.classList.add('oculto');
    UI.probador(() => { probador = false; ent.mostrarDedos(true); UI.hud && UI.hud.classList.remove('oculto'); J.aplicarApariencia(); UI.actualizarHud(); });
  }
  function usarHotbar(n) {
    if (n < 0) n = ((J.slot - 1 + (n === -1 ? -1 : 1) + 5) % 5) + 1;
    J.slot = n; UI.actualizarHud();
    if (n === 2) UI.gestos();
    else if (n === 3) UI.discos();
    else if (n === 4) foto();
    else if (n === 5) UI.mapa(dibujarMapa);
  }
  function foto() {
    if (!modoFoto) { modoFoto = true; UI.hud.classList.add('oculto'); ent.mostrarDedos(false); UI.avisar(t('foto_ayuda')); document.addEventListener('pointerdown', fotoToque, { once: true }); return; }
    motor.dibujar(0);
    const a = document.createElement('a'); a.download = 'aeroplaza-' + Date.now() + '.png'; a.href = motor.lienzo.toDataURL('image/png'); a.click();
    modoFoto = false; UI.hud.classList.remove('oculto'); ent.mostrarDedos(true); UI.avisar(t('foto_lista'), 'bien'); J.sfx('guino');
  }
  const fotoToque = (e) => { if (modoFoto && !e.target.closest('button')) foto(); };
  function disparar(desde, dir, mio) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), matDisparo); m.position.copy(desde); m.renderOrder = 3; efectos.add(m);
    disparos.push({ m, v: dir.clone(), vida: 2.2, mio });
    J.sfx('burbuja');
  }
  function recibirGolpe(dmg, quien) {
    yo.hp = Math.max(0, yo.hp - dmg); tSinGolpe = 0;
    UI.avisar(t('te_pego', { n: quien })); cam.sacudida = 0.3; J.sfx('pop'); ent.vibrar(40);
    yo.v.y = Math.max(yo.v.y, 4);
    if (yo.hp <= 0) { chispas.soltar(yo.p.clone().add(new THREE.Vector3(0, 1, 0)), 30, 5); UI.avisar(t('reventaste'), 'azul'); yo.ponerEn(reino.inicio, reino.rumboInicio); yo.hp = 100; }
  }
  function revisarSueno(yoDono) {
    const S = reino.sueno; if (!S || S.activo) return;
    const umbral = Math.min(20, 5 + remotos.cuantos * 3);
    if (S.total >= umbral) { reino.empezarSueno(); red.accion({ type: 'sueno' }); UI.avisar(t('sueno_empieza'), 'bien'); J.sfx('restaura'); }
    else if (yoDono) UI.avisar(t('sueno_falta', { n: S.total, t: umbral }), 'azul');
  }
  function hablar(id) {
    enDialogo = true;
    const n = reino.npcMallas.find((q) => q.id === id);
    if (n) { n.m.raiz.rotation.y = Math.atan2(yo.p.x - n.m.raiz.position.x, yo.p.z - n.m.raiz.position.z); yo.rumbo = Math.atan2(n.m.raiz.position.x - yo.p.x, n.m.raiz.position.z - yo.p.z); yo.sync(); n.m.hacerGesto('saludar'); cam.ponerCine(yo.p, n.m.raiz.position); }
    const H = Misiones.hablar(id), nombre = t('npc_' + id);
    let botones = [];
    if (H.que === 'ofrece') botones = [[t('despues'), () => {}], [t('aceptar'), () => { Misiones.aceptar(id); UI.avisar(t('mis_nueva'), 'azul'); J.sfx('aviso'); UI.actualizarMisiones(); Guardado.guardar(); }, true]];
    else if (H.que === 'tienda') botones = [[t('cerrar'), () => {}], [t('accion_comprar'), () => abrirProbador(), true]];
    UI.dialogo(nombre, H.lineas, botones, () => {
      if (H.que === 'premia') {
        const M = Misiones.premiar(id);
        if (M) { UI.avisar(t('mis_hecha'), 'bien'); UI.avisar(t('mas_orbes', { n: M.orbes }), 'bien'); J.sfx('orbe'); yo.m.hacerGesto('festejar'); UI.actualizarMisiones(); UI.actualizarHud(); Guardado.guardar(); }
      }
    });
  }
  function contar(tipo, k = 1, clave = null) {
    for (const a of Misiones.contar(tipo, k, clave)) {
      if (a.lista) { UI.avisar(t('mis_lista', { n: t('npc_' + a.id) }), 'bien'); J.sfx('restaura'); }
      else UI.avisar(`${t('npc_' + a.id)} · ${a.n}/${a.m}`);
    }
    UI.actualizarMisiones(); Guardado.guardar();
  }
  function interactuar(o) {
    switch (o.accion) {
      case 'viajar': pausado = true; UI.viaje(reino.id, (id, casaDe, nombreCasa) => { pausado = false; viajar(id, { casaDe, nombreCasa }); }); break;
      case 'entrar_tienda': viajar('tienda'); break;
      case 'salir_tienda': { const P = cache.plaza; viajar('plaza', { en: P ? P.tienda.userData.puerta.clone().setY(P.mundo.altura(P.tienda.userData.puerta.x, P.tienda.userData.puerta.z) + 0.1) : undefined, rumbo: 0.6 }); break; }
      case 'probador': case 'comprar': abrirProbador(); break;
      case 'burbuja': yo.p.copy(reino.fuenteBurbujas); yo.entrarBurbuja(); UI.avisar(t(ent.tactil ? 'dedo_burbuja' : 'burbuja_bajar')); break;
      case 'hablar': hablar(o.npc); break;
      case 'montar': if (!o.delfin.jinete) { yo.montar(o.delfin); J.sfx('agua'); } break;
      case 'sueno': if (G.estrellas > 0) { const n = G.estrellas; G.estrellas = 0; reino.sueno.total += n; red.accion({ type: 'sueno_suma', n }); chispas.soltar(yo.p.clone().setY(yo.p.y + 3), 30, 4); J.sfx('guino'); Guardado.guardar(); revisarSueno(true); } else UI.avisar(t('sueno_falta', { n: reino.sueno.total, t: Math.min(20, 5 + remotos.cuantos * 3) }), 'azul'); break;
      case 'construir': empezarConstruir(); break;
    }
  }
  function empezarConstruir() {
    if (construyendo) return;
    construyendo = { k: null, giro: 0 };
    UI.construir(
      (k) => { construyendo.k = k; reino.ponerFantasma(k); },
      () => { construyendo.giro += Math.PI / 4; },
      () => { const m = reino.cercano(yo.p); if (m) { G.casa = G.casa.filter((q) => q !== m); reino.rehacer(G.casa); red.publicarCasa(G.casa); Guardado.guardar(); J.sfx('pop'); } },
      () => { reino.ponerFantasma(null); construyendo = null; },
    );
  }
  function dibujarMapa(cv) {
    const g = cv.getContext('2d'), W = cv.width, M = reino.mundo, L = reino.id === 'casa' ? 30 : reino.id === 'tienda' ? 14 : 130;
    if (!reino._mapa || reino._mapaL !== L) {
      const img = g.createImageData(W, W);
      for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
        const x = (i / W - 0.5) * 2 * L, z = (j / W - 0.5) * 2 * L, h = M.altura(x, z), k = (j * W + i) * 4;
        const agua = M.agua != null && h < M.agua;
        const c = agua ? [80 + h * 6, 190 + h * 4, 240] : h < 1.1 ? [245, 232, 190] : [110 + h * 8, 200 + h * 3, 90];
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
      reino._mapa = img; reino._mapaL = L;
    }
    g.putImageData(reino._mapa, 0, 0);
    const P = (x, z) => [(x / (2 * L) + 0.5) * W, (z / (2 * L) + 0.5) * W];
    const punto = (x, z, c, r = 6) => { const [a, b] = P(x, z); g.fillStyle = c; g.beginPath(); g.arc(a, b, r, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); };
    for (const o of M.interactivos) { const q = typeof o.pos === 'function' ? o.pos() : o.pos; if (o.accion === 'viajar') { g.font = '22px sans-serif'; const [a, b] = P(q.x, q.z); g.fillText('🚆', a - 11, b + 8); } }
    for (const n of reino.npcMallas || []) punto(n.m.raiz.position.x, n.m.raiz.position.z, '#ffd23f', 7);
    for (const r of remotos.m.values()) punto(r.x, r.z, '#ff6fb0', 6);
    const [a, b] = P(yo.p.x, yo.p.z);
    g.save(); g.translate(a, b); g.rotate(-yo.rumbo + Math.PI); g.fillStyle = '#34bef0'; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 8); g.lineTo(-8, 8); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); g.restore();
  }

  /* ---------------------------------------------------------------- el cuadro */
  const antes = new THREE.Vector3();
  let accionCerca = null;
  function paso(dt, dibujar = true) {
    UNI.uT.value += dt;
    if (!enJuego || !reino) { return; }
    const E = ent.leer();
    if (E.pausa && !UI.ventanaAbierta && !probador && !enDialogo) { J.pausar(!pausado); }
    const quieto = pausado || enDialogo;
    if (!quieto) {
      if (E.chat) UI.abrirChat();
      if (E.hot) usarHotbar(E.hot);
      if (E.foto) foto();
    }
    /* la cámara */
    const O = G.opciones;
    if (probador) cam.giroProb = (cam.giroProb || 0) + E.camX;
    else cam.girar(E.camX * O.sensCam, E.camY * O.sensCam * (O.invertirY ? -1 : 1));
    if (E.zoom !== 1) cam.acercar(E.zoom);
    /* el muñeco */
    antes.copy(yo.modo === 'montado' && yo.montura ? yo.montura.p : yo.p);
    const { adelante, derecha } = cam.ejes();
    const mx = derecha.x * E.x - adelante.x * E.z, mz = derecha.y * E.x - adelante.y * E.z;
    const Em = quieto || probador ? { x: 0, z: 0, corre: false, salta: false, sostiene: false, accion: false, baja: false } : { ...E, x: mx, z: mz };
    /* el E de usar lo toma primero la interacción (si no está en burbuja ni montado) */
    const usa = Em.accion && yo.modo !== 'burbuja' && yo.modo !== 'montado';
    if (usa) Em.accion = false;
    yo.actualizar(dt, Em, reino.mundo); yo.paso(dt);
    if (probador) { yo.rumbo = cam.yaw + Math.PI + (cam.giroProb || 0) * 2; yo.sync(); }
    JUGADOR.copy(yo.p);
    for (const ev of yo.eventos) {
      if (ev === 'salto') J.sfx('salto'); else if (ev === 'doble') { J.sfx('burbuja'); chispas.soltar(yo.p, 8, 2); } else if (ev === 'aterriza') J.sfx('aterriza');
      else if (ev === 'chapuzon' || ev === 'monta') { J.sfx('agua'); chispas.soltar(yo.p.clone().setY(reino.mundo.agua ?? yo.p.y), 16, 3); } else if (ev === 'rebote') J.sfx('hongo'); else if (ev === 'brazada') J.sfx('brazada');
      else if (ev === 'geiser') { J.sfx('ola'); if (yo._enGeiser?.clave) contar('geiser', 1, yo._enGeiser.clave); } else if (ev === 'pop') { J.sfx('pop'); chispas.soltar(yo.p.clone().setY(yo.p.y + 0.8), 20, 3); } else if (ev === 'burbuja') J.sfx('burbuja');
      else if (ev === 'caida') { yo.ponerEn(reino.inicio, reino.rumboInicio); }
    }
    /* la espuma vuelve sola */
    tSinGolpe += dt; if (tSinGolpe > 4 && yo.hp < 100) yo.hp = Math.min(100, yo.hp + dt * 8);
    /* los disparos de burbuja */
    tDisparo -= dt;
    if (!quieto && !probador && E.dispara && tDisparo <= 0 && yo.modo !== 'montado') {
      tDisparo = 0.45;
      const dir = new THREE.Vector3(Math.sin(yo.rumbo), 0.12, Math.cos(yo.rumbo)).normalize().multiplyScalar(15);
      const desde = yo.p.clone().add(new THREE.Vector3(Math.sin(yo.rumbo) * 0.6, 1.0 * yo.escala, Math.cos(yo.rumbo) * 0.6));
      disparar(desde, dir, true);
      red.accion({ type: 'disparo', x: +desde.x.toFixed(2), y: +desde.y.toFixed(2), z: +desde.z.toFixed(2), dx: +dir.x.toFixed(2), dy: +dir.y.toFixed(2), dz: +dir.z.toFixed(2) });
      if (J.slot !== 1) { J.slot = 1; UI.actualizarHud(); }
    }
    for (let i = disparos.length - 1; i >= 0; i--) {
      const d = disparos[i];
      d.vida -= dt; d.v.y -= 3 * dt; d.m.position.addScaledVector(d.v, dt);
      d.m.scale.setScalar(1 + Math.sin(d.vida * 20) * 0.05);
      let fin = d.vida <= 0 || d.m.position.y < reino.mundo.altura(d.m.position.x, d.m.position.z);
      if (d.mio && !fin) for (const r of remotos.m.values()) {
        if (Math.hypot(r.x - d.m.position.x, r.z - d.m.position.z) < 0.7 && d.m.position.y > r.y && d.m.position.y < r.y + 1.5) {
          red.accion({ type: 'hit_player', targetId: r.id, dmg: 10, byName: G.nombre }); fin = true; J.sfx('pop'); break;
        }
      }
      if (fin) { chispas.soltar(d.m.position, 10, 2.5); efectos.remove(d.m); disparos.splice(i, 1); }
    }
    chispas.actualizar(dt);
    /* lo que hay para juntar */
    if (reino.orbes) for (const i of reino.orbes.actualizar(dt, yo.p)) {
      G.orbes++; J.sfx('gota', { k: (J._racha = ((J._racha || 0) + 1)) }); clearTimeout(J._tRacha); J._tRacha = setTimeout(() => { J._racha = 0; }, 900);
      red.accion({ type: 'recoger', i }); Guardado.guardar();
    }
    if (reino.mariposas) { const m = reino.mariposas.actualizar(dt, yo.p); if (m >= 0) { J.sfx('guino'); chispas.soltar(yo.p.clone().setY(yo.p.y + 1), 12, 2); contar('mariposa'); } }
    if (reino.burbujas) { const b = reino.burbujas.actualizar(dt, reino.id === 'plaza' || reino.id === 'jardin' ? yo.p : null); if (b) { J.sfx('pop'); contar('burbuja'); } }
    for (const d of reino.discos || []) {
      if (!d.malla.visible) continue;
      if (G.discos.includes(d.id)) { d.malla.visible = false; continue; }
      if (d.malla.position.distanceTo(yo.p.clone().setY(yo.p.y + 0.8)) < 1.4) {
        G.discos.push(d.id); d.malla.visible = false; chispas.soltar(d.malla.position, 30, 4); J.sfx('orbe');
        UI.avisar(t('disco_nuevo', { n: t('can_' + d.cancion) }), 'bien'); contar('disco'); Guardado.guardar();
      }
    }
    if (reino.id === 'aqua') {
      const p = yo.modo === 'montado' && yo.montura ? yo.montura.p : yo.p;
      for (const ev of reino.pasoPorAro(p, antes)) {
        if (ev.tipo === 'empieza') { UI.avisar(t('carrera_empieza'), 'azul'); J.sfx('aviso'); }
        else if (ev.tipo === 'aro') { UI.avisar(t('carrera_aro', { n: ev.n, t: reino.aros.length })); J.sfx('gota', { k: ev.n }); }
        else if (ev.tipo === 'fin') { const s = ev.s.toFixed(1); const rec = !G.mejorCarrera || ev.s < G.mejorCarrera; if (rec) G.mejorCarrera = ev.s; UI.avisar(t(rec ? 'carrera_record' : 'carrera_fin', { s }), 'bien'); J.sfx('restaura'); contar('carrera'); G.orbes += 10; }
        else if (ev.tipo === 'hundido') { G.orbes += 3; UI.avisar(t('mas_orbes', { n: 3 }), 'bien'); J.sfx('orbe'); }
      }
    }
    if (reino.id === 'aurora') { const n = reino.actualizar(dt, yo.p, cielo); if (n) { G.estrellas += n; UI.avisar(t('estrella'), 'azul'); J.sfx('guino'); contar('estrella', n); } }
    else reino.actualizar(dt, yo.p, cielo);
    /* la gente del lugar mira a quien se acerca */
    for (const n of reino.npcMallas || []) {
      const d = Math.hypot(yo.p.x - n.m.raiz.position.x, yo.p.z - n.m.raiz.position.z);
      const obj = d < 5 ? Math.atan2(yo.p.x - n.m.raiz.position.x, yo.p.z - n.m.raiz.position.z) : n.rot;
      let dd = obj - n.m.raiz.rotation.y; while (dd > Math.PI) dd -= Math.PI * 2; while (dd < -Math.PI) dd += Math.PI * 2;
      n.m.raiz.rotation.y += dd * Math.min(1, dt * 3);
      n.m.animar(dt, 'quieto', 0);
    }
    /* lo que se puede usar cerca: el cartel y la tecla */
    let cerca = null;
    if (!quieto && !probador && yo.modo !== 'burbuja') {
      cerca = yo.modo === 'montado' ? { accion: 'bajar' } : reino.mundo.cercano(yo.p);
      if (!cerca && reino.frutas) { const i = reino.frutas.cerca(yo.p); if (i >= 0) cerca = { accion: 'fruta', i }; }
      if (construyendo) cerca = construyendo.k ? { accion: 'poner' } : null;
    }
    UI.accion(cerca ? (cerca.accion === 'poner' ? t('casa_construir') : cerca.accion === 'hablar' ? `${t('accion_hablar')} · ${t('npc_' + cerca.npc)}` : t('accion_' + cerca.accion)) : null);
    if (usa && cerca) {
      if (cerca.accion === 'fruta') {
        const f = reino.frutas.f[cerca.i]; reino.frutas.sacar(cerca.i); red.accion({ type: 'fruta', i: cerca.i });
        const ef = FRUTAS[f.tipo].efecto; yo.ponerEfecto(ef); UI.avisar(t('fruta_' + ef), 'bien'); J.sfx('hongo'); contar('fruta');
        if (ef === 'azul') yo.m.ponerApariencia({ ...G.A, color: '#3d7bff', color2: '#9fd0ff' });
        if (ef === 'brillo') yo.m.ponerApariencia({ ...G.A, material: 'neon' });
        clearTimeout(J._tFruta); J._tFruta = setTimeout(() => { if (yo) yo.m.ponerApariencia(G.A); }, 45000);
      } else if (cerca.accion === 'poner') {
        const lugar = reino.moverFantasma(yo.p, yo.rumbo, construyendo.giro);
        if (lugar && G.casa.length < 60) { G.casa.push({ k: construyendo.k, x: lugar.x, z: lugar.z, r: construyendo.giro }); reino.rehacer(G.casa); red.publicarCasa(G.casa); Guardado.guardar(); J.sfx('elegir'); G.visto.construyo = true; }
      } else interactuar(cerca);
    }
    if (construyendo && construyendo.k) reino.moverFantasma(yo.p, yo.rumbo, construyendo.giro);
    /* la red */
    red.publicarEstado({
      x: +yo.p.x.toFixed(2), y: +yo.p.y.toFixed(2), z: +yo.p.z.toFixed(2), hp: Math.round(yo.hp), facingAngle: +yo.rumbo.toFixed(2),
      isMoving: yo.estado === 'camina' || yo.estado === 'corre' || yo.estado === 'nada', estado: yo.estado, vel: +Math.hypot(yo.v.x, yo.v.z).toFixed(1),
      gesto: J.gestoActual || null, esc: +yo.escala.toFixed(2), ef: yo.efecto, av: G.av, modo: yo.modo,
    });
    remotos.actualizar(dt);
    tPresencia += dt; if (tPresencia > 1) { tPresencia = 0; red.limpiar(); }
    /* el cielo, el agua, la cámara */
    cielo.actualizar(dt, yo.p);
    if (reino.interior) { cielo.sol.intensity *= 0.35; cielo.hemi.intensity = 1.1; }
    if (reino.mar) aguaSigueCielo(reino.mar, cielo);
    cam.actualizar(dt, yo, reino.interior ? null : reino.mundo);
    /* adentro: la cámara no sale de las paredes */
    if (reino.caja) { const [x0, x1, z0, z1, y1] = reino.caja, c = motor.camara.position; c.x = Math.max(x0, Math.min(x1, c.x)); c.z = Math.max(z0, Math.min(z1, c.z)); c.y = Math.min(y1, c.y); }
    if (probador) {
      /* el probador: la cámara de frente, el muñeco a un costado de la ventana */
      const vertical = innerWidth < innerHeight;
      const r = yo.rumbo, f = new THREE.Vector3(Math.sin(r), 0, Math.cos(r)), der = new THREE.Vector3(Math.cos(r), 0, -Math.sin(r));
      const k = yo.escala;
      /* der es la derecha de la cámara: correrse para ese lado deja al muñeco a la izquierda, libre del panel */
      const mira = yo.p.clone().add(new THREE.Vector3(0, vertical ? 0.1 * k : 0.8 * k, 0)).addScaledVector(der, vertical ? 0 : 0.95 * k);
      motor.camara.position.copy(yo.p).addScaledVector(f, (vertical ? 4.2 : 3.1) * k).add(new THREE.Vector3(0, 1.05 * k, 0)).addScaledVector(der, vertical ? 0 : 0.95 * k);
      motor.camara.lookAt(mira);
    }
    const bajo = reino.mundo.agua != null && motor.camara.position.y < reino.mundo.agua - 0.05;
    motor.pFinal.uniforms.uAgua.value += ((bajo ? 1 : 0) - motor.pFinal.uniforms.uAgua.value) * Math.min(1, dt * 6);
    if (bajo !== J._bajo) { J._bajo = bajo; try { Sonido.agua(bajo); } catch { /* nada */ } motor.escena.fog.near = bajo ? 2 : 140; motor.escena.fog.far = bajo ? 45 : 950; }
    if (bajo) motor.escena.fog.color.set('#1a8fc0');
    /* la calidad automática: los primeros segundos se mide y se baja si hace falta */
    if (midiendo && G.opciones.calidad === 'auto' && !Q.has('calidad')) {
      tMedir += dt; if (tMedir > 2) { cuadros++; sumaDt += dt; }
      if (cuadros > 150) {
        const ms = sumaDt / cuadros * 1000; cuadros = 0; sumaDt = 0;
        const q = motor.nombreCalidad;
        if (ms > 26 && q !== 'baja') motor.ponerCalidad(q === 'alta' ? 'media' : 'baja');
        else midiendo = false;
      }
    }
    tHud += dt; if (tHud > 0.25) { tHud = 0; UI.actualizarHud(); }
    if (dibujar) motor.dibujar(dt);
  }

  window.__A = { motor, cielo, get reino() { return reino; }, get yo() { return yo; }, cam, red, remotos, G, J, UI, paso, THREE, empezarJuego, viajar: (id, o) => viajar(id, o), entrarReino };
  let ult = performance.now();
  const bucle = (tt) => { const dt = Math.min(0.05, (tt - ult) / 1000); ult = tt; if (!window.__pausa) paso(dt); requestAnimationFrame(bucle); };
  if (!Q.has('pausa')) requestAnimationFrame(bucle);
  if (G.opciones.calidad !== 'auto') { midiendo = false; motor.ponerCalidad(G.opciones.calidad); }
  if (Q.has('calidad')) motor.ponerCalidad(Q.get('calidad'));
  motor.ponerRetro(G.opciones.retro);

  /* el camino de pantallas */
  const arrancarAudio = () => { try { Sonido.iniciar(); J.volumen(); } catch { /* sin audio */ } };
  addEventListener('pointerdown', arrancarAudio, { once: true, capture: true });
  addEventListener('keydown', arrancarAudio, { once: true, capture: true });
  if (Q.has('directo')) { if (!G.idioma) ponerIdioma(Q.get('idioma') || 'es'); empezarJuego(Q.get('reino') || 'plaza'); return; }
  const aMenu = () => UI.aviso(() => { arrancarAudio(); UI.menu(); });
  if (!G.idioma) UI.idioma((i) => { G.idioma = i; Guardado.guardar(); aMenu(); });
  else aMenu();
}
iniciar();
