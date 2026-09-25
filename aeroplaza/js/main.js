/* ============================================================================
   aeroplaza/js/main.js — une todo: las pantallas, los reinos, el muñeco, la
   red, las misiones, el sonido y la calidad automática.
   Parámetros de la dirección (para probar): ?directo (salta los menús),
   ?reino=aqua, ?nombre=Pepa, ?broker=ws://127.0.0.1:1883, ?hora=0.5,
   ?calidad=baja, ?pausa (sin bucle: lo avanzan las pruebas), ?x=&z=&yaw=…
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Motor, TACTIL, ESTILOS } from './motor.js';
import { Cielo } from './cielo.js';
import { TEX, UNI, JUGADOR, ARBOLEDAS, aguaSigueCielo, materialBurbuja } from './naturaleza.js';
import { TEXTURAS_MOTIVO, Meeple, APARIENCIA_INICIAL, MATERIALES, MOTIVOS, SOMBREROS, ANTEOJOS, ESPALDAS, PEINADOS, PARTICULAS, OJOS } from './meeple.js';
import { crearPlaza } from './reinos/plaza.js';
import { crearAqua } from './reinos/aqua.js';
import { crearAurora } from './reinos/aurora.js';
import { crearJardin } from './reinos/jardin.js';
import { crearTienda } from './reinos/tienda.js';
import { crearCasa } from './reinos/casa.js';
import { crearParkour, NIVELES, formatoTiempo } from './reinos/parkour.js';
import { crearInterior } from './reinos/interior.js';
import { crearTiro, TIRO } from './reinos/tiro.js';
import { crearJuegos } from './reinos/juegos.js';
import { crearRunner, RUNNER } from './reinos/runner.js';
import { Delirio } from './delirio.js';
import { Detalle } from './detalle.js';
import { ORDEN_CALIDAD } from './motor.js';
import { Jugador } from './jugador.js';
import { Camara } from './camara.js';
import { Entrada } from './entrada.js';
import { Guardado, miId } from './guardar.js';
import { t, ponerIdioma } from './textos.js';
import { UI } from './ui.js';
import { Red, BROKER } from './red.js';
import { Remotos, RemotePlayer } from './remotos.js';
import { Efectos } from './efectos.js';
import { Estelario } from './estelario.js';
import { Misiones, NPCS } from './misiones.js';
import { FRUTAS, Chispas } from './objetos.js';
import { cargarDelfin } from './delfin.js';
import * as Modelos from './modelos.js';
import * as Construir from './construcciones.js';
import { Pantalla } from './pantalla.js';
import { Voz } from './voz.js';
import { ESTILOS_ANIM } from './animador.js';
import { CuerpoFP } from './primera.js';
import { timbre } from './timbres.js';
import { detectarAparato } from './aparato.js';
import { Estudio } from './probador.js';
import { regaloDelDia } from './joyas.js';
import { Sonido } from '../../brillo/js/sonido.js';
import '../../brillo/js/canciones.js';

const Q = new URLSearchParams(location.search);
const CREAR = { plaza: crearPlaza, aqua: crearAqua, aurora: crearAurora, jardin: crearJardin, tienda: crearTienda, casa: crearCasa, juegos: crearJuegos };
/* el tema de cada reino (las zonas de la isla y el parkour traen el suyo) */
const MUSICA_DE = { plaza: 'colina', aqua: 'arrecife', aurora: 'aurora', jardin: 'cielo', tienda: 'ciudad', casa: 'casa', juegos: 'juegos' };
/* Solo suenan las canciones que mandó quien pide (25/09: "eliminá todas las que no
   sean las que te pasé"): ni temas de Rezona ni sintetizados. Mientras no mande la
   de un tema, suena la suya que más se le parece; cuando la mande, la pisa sola.
   En la versión sin canciones (la del repo y el artefacto) no suena música. */
const EN_VEZ = { juegos: 'titulo', aurora: 'arrecife', cielo: 'bosque', ciudad: 'colina', casa: 'titulo', playa: 'arrecife', bosque: 'colina', arrecife: 'colina', titulo: 'colina', colina: 'titulo' };
Sonido.soloGrabadas = true;
const cancionDe = (k) => { for (let i = 0; k && i < 4; i++, k = EN_VEZ[k]) if (Sonido.grabadas[k]) return k; return null; };

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
    degrade: Math.max(0, Math.min(1, Number.isFinite(+A.degrade) ? +A.degrade : B.degrade)), ojos: de(A.ojos, OJOS, B.ojos), motivoCabeza: de(A.motivoCabeza, ['igual', ...MOTIVOS], 'igual'),
    motivo: de(A.motivo, MOTIVOS, B.motivo), material: de(A.material, MATERIALES, B.material), sombrero: de(A.sombrero, SOMBREROS, B.sombrero), anteojos: de(A.anteojos, ANTEOJOS, B.anteojos),
    espalda: de(A.espalda, ESPALDAS, B.espalda), peinado: de(A.peinado, PEINADOS, B.peinado), particulas: de(A.particulas, PARTICULAS, B.particulas) };
}

/* un cartel que tapa todo, para cuando no se puede seguir (sin WebGL, placa reiniciada) */
function fatal(texto, alTocar) {
  document.getElementById('precarga')?.remove();
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(0deg,#f4f6f8 0 3px,#e9ecef 3px 4px);font:700 20px/1.5 system-ui,sans-serif;color:#5b6168;text-align:center;padding:24px';
  const c = document.createElement('div');
  c.style.cssText = 'background:#fff;border:3px solid #d9dde1;border-radius:24px;padding:28px 30px;max-width:520px;box-shadow:0 6px 18px rgba(40,60,80,.12)';
  c.textContent = texto; d.appendChild(c);
  if (alTocar) d.addEventListener('pointerdown', alTocar);
  document.body.appendChild(d);
}

async function iniciar() {
  await cargarTexturas();
  await Promise.all([cargarDelfin(), Modelos.cargarModelos()]);
  const G = Guardado.cargar();
  /* con el celu parado se acuesta el juego entero (sin pantalla completa): ?giro= para las pruebas */
  Pantalla.giro = Q.get('giro') || G.opciones.giro || 'auto'; if (Pantalla.giro === 'auto') Pantalla.sensor();
  Pantalla.actualizar();
  const ID = miId();
  if (Q.has('nombre')) G.nombre = Q.get('nombre').slice(0, 16);
  if (G.idioma) ponerIdioma(G.idioma);
  Misiones.G = G;
  /* sin WebGL no hay juego: se dice por qué y qué hacer, en vez de quedar en blanco */
  let motor;
  try { motor = new Motor(document.getElementById('lienzo')); } catch (e) { console.error(e); fatal(t('sin_webgl')); return; }
  /* cualquier error se muestra en un cartel y el juego sigue (antes, uno solo congelaba todo) */
  const vistos = new Set();
  const mostrarError = (e) => {
    const m = String((e && (e.message || (e.reason && e.reason.message) || e.reason)) || e).slice(0, 180);
    console.error(e);
    if (vistos.has(m) || vistos.size > 4) return; vistos.add(m);
    try { UI.error(m, () => { J.ponerCalidad('baja'); G.opciones.calidad = 'baja'; Guardado.guardar(); }); } catch { /* la interfaz todavía no está */ }
  };
  addEventListener('error', (ev) => { if (ev.error) mostrarError(ev.error); });
  addEventListener('unhandledrejection', (ev) => mostrarError(ev.reason));
  /* si la placa se reinicia (pasa en celulares con poca memoria), se vuelve en calidad baja */
  motor.lienzo.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); G.opciones.calidad = 'minima'; Guardado.ya(); fatal(t('contexto_perdido'), () => location.reload()); });
  /* qué aparato es: de ahí sale la calidad con la que arranca la automática */
  const aparato = detectarAparato(motor.r);
  const cielo = new Cielo(motor, TEX.cielo || null);
  const ent = new Entrada(motor.lienzo, document.getElementById('dedos'));
  Pantalla.alCambiar.push(() => ent.ubicarDedos());
  if (G.controles) ent.ponerConfig(G.controles);
  const cam = new Camara(motor.camara);
  const red = new Red({ id: ID, nombre: G.nombre });
  const voz = new Voz(red); voz.volumen = G.opciones.volVoz ?? 1;
  const remotos = new Remotos(motor.escena);
  const efectos = new THREE.Group(); motor.escena.add(efectos);
  const chispas = new Chispas(efectos, '#ffffff', 160);
  const estelario = new Estelario(motor);   // el cielo del telescopio (estelario.js)
  const delirio = new Delirio(motor);       // lo extremo del runner (delirio.js)
  const detalle = new Detalle(motor);       // lo que no se dibuja de lejos (detalle.js)
  const efx = new Efectos(motor.escena);   // los efectos especiales (efectos.js)
  const cuerpoFP = new CuerpoFP(motor.escena);   // los brazos de la primera persona (primera.js)

  let tuto = null, estudio = null;
  let reino = null, yo = null, enJuego = false, pausado = false, enDialogo = false, probador = false, modoFoto = false, construyendo = null;
  let tHud = 0, tPresencia = 0, gestoN = 0, tDisparo = 0, tSinGolpe = 9, tMedir = 0, cuadros = 0, sumaDt = 0, midiendo = true;
  const cache = {};
  const disparos = [];
  const matDisparo = materialBurbuja(1);

  /* ---------------------------------------------------------------- el J que usa la interfaz */
  const J = {
    G, id: ID, red, remotos, voz, ent, misiones: Misiones, slot: 1, musicaElegida: null, aparato, motor,
    get yo() { return yo; }, get enJuego() { return enJuego; },
    /* el 'aviso' de siempre ahora es la campanita estilo Windows 7 (timbres.js) */
    sfx(n, o) { try { if (n === 'aviso' && Sonido.ctx?.state === 'running') { timbre('info'); return; } Sonido.sfx(n, o); } catch { /* sin audio */ } },
    musica(n) { try { J.sonando = cancionDe(n); Sonido.musica(J.sonando); } catch { /* nada */ } },
    /* callar la música, o volver a empezar una canción desde el principio (el runner) */
    callar() { try { Sonido.soltar(Sonido.actual, 0.3); Sonido.actual = null; J.sonando = null; } catch { /* nada */ } },
    musicaDeNuevo(n) { J.callar(); J.musica(n); },
    volumen() { try { Sonido.volumenes(G.opciones.musica, G.opciones.efectos); } catch { /* nada */ } },
    guardar() { Guardado.guardar(); },
    guardarControles() { G.controles = ent.config; Guardado.guardar(); },
    ponerCalidad(q) { if (q === 'auto') { midiendo = true; cuadros = 0; sumaDt = 0; tMedir = 0; q = aparato.calidad; J._subio = false; } else midiendo = false; motor.ponerCalidad(q); for (const k in cache) if (cache[k] !== reino) delete cache[k]; },
    ponerRetro() { G.opciones.estilo = 'libre'; motor.ponerRetro(G.opciones.retro); },
    ponerAnim(q) { Meeple.estiloAnim = q; },
    ponerEstilo(n) { G.opciones.estilo = n; G.opciones.retro = { ...ESTILOS[n] }; motor.ponerRetro(G.opciones.retro); Guardado.guardar(); },
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
    aplicarApariencia() { cuerpoFP.ponerApariencia(G.A); yo.m.ponerApariencia(G.A); if (yo.m.enPrimera) yo.m.primeraPersona(true); estudio?.ponerApariencia(G.A); G.av = hash(G.A); red.accion({ type: 'apariencia', A: G.A, av: G.av }); Guardado.guardar(); },
    /* lo que se prueba en el probador solo se ve en el estudio (ni el muñeco del mundo ni la red se enteran) */
    probarPuestos(P) { estudio?.ponerApariencia({ ...G.A, ...P }); estudio?.probando(Object.keys(P).length > 0); },
    festejarProbador() { estudio?.festejar(); },
    cambiarNombre() { red.nombre = G.nombre; yo.m.ponerNombre(G.nombre, true); Guardado.guardar(); },
    avisarPantalla(s) { UI.avisar(s, 'azul'); },
    gesto(g) {
      /* el poder: el TearDrop adelante del muñeco (con un rato de espera entre uno y otro) */
      if (g === 'poder') { if (performance.now() - (J._tPoder || -1e9) < 4500) return; J._tPoder = performance.now(); tirarPoder(yo.p, yo.rumbo); J.sfx('restaura'); setTimeout(() => { J.sfx('ola'); J.sfx('pop'); ent.vibrar(60); }, 1550); }
      yo.m.hacerGesto(g); gestoN++; J.gestoActual = g + '#' + gestoN; setTimeout(() => { if (J.gestoActual && J.gestoActual.endsWith('#' + gestoN)) J.gestoActual = null; }, g === 'sentarse' ? 60000 : 8000); },
    hayCancion(k) { return !!Sonido.grabadas[k]; },
    cancionDesbloqueada(k) { return !!Sonido.grabadas[k] && (k === 'titulo' || k === 'colina' || G.discos.some((d) => DISCO_CANCION[d] === k)); },
    elegirMusica(k) { J.musicaElegida = k; J.musica(k || musicaDelLugar()); },
  };
  const DISCO_CANCION = { 'disco-loma': 'colina', 'disco-lago': 'arrecife', 'disco-hotel': 'ciudad', 'disco-aurora': 'aurora', 'disco-jardin': 'cielo', 'disco-flor': 'titulo', 'disco-faro': 'playa', 'disco-arbol': 'bosque', 'disco-cumbre': 'cielo', 'disco-ciudad': 'ciudad', 'disco-juegos': 'juegos' };
  /* el TearDrop: a 2,2 m adelante, a la altura del pecho (lo ven todos: va con el gesto) */
  const tirarPoder = (p, rumbo) => efx.lagrima(new THREE.Vector3(p.x + Math.sin(rumbo) * 2.2, p.y + 1.35, p.z + Math.cos(rumbo) * 2.2), p.y);
  RemotePlayer.alGesto = (r, g) => { if (g === 'poder' && enJuego) tirarPoder(r.m.raiz.position, r.m.raiz.rotation.y); };
  J.festejo = () => efx.festejo(yo.p);
  J.festejoEn = (p) => efx.festejo(p);
  J.levantarse = () => { J.sentado = false; cam.sentado = false; J.gestoActual = null; yo.m.gesto = null; };
  /* la música del lugar: la de la zona de la isla donde está, o la del reino */
  let zona = null, tZona = 0;
  const musicaDelLugar = () => zona?.musica || MUSICA_DE[reino?.id] || reino?.musica || 'colina';
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
      case 'rtc': voz.recibir(a); break;
      /* la Zona de Juegos: las mesas, la pelota y los goles (juegos.js y mesas.js) */
      case 'mesa': case 'pelota': case 'gol': reino?.recibir?.(a); break;
    }
  };
  red.alCasa = (d) => {
    if (reino?.id !== 'casa' || !reino.dueño || d.id !== reino.dueño || !Array.isArray(d.plano)) return;
    reino.rehacer(d.plano.slice(0, 80).filter((m) => m && typeof m.k === 'string' && Number.isFinite(m.x) && Number.isFinite(m.z)).map((m) => ({ k: m.k, x: +m.x, z: +m.z, r: +m.r || 0 })));
  };
  red.conectar(Q.get('broker') || BROKER);

  /* ---------------------------------------------------------------- los reinos */
  function construirReino(id, o = {}) {
    if (id === 'parkour') return crearParkour({ calidad: motor.Q }, o.nivel || 0, o);
    if (id === 'tiro') return crearTiro({ calidad: motor.Q });
    if (id === 'runner') return crearRunner({ calidad: motor.Q });
    /* adentro de un edificio: se arma cada vez (son chicos) con su gente */
    if (id === 'interior') { const R = crearInterior({ calidad: motor.Q }, o.tipo || 'hotel', o); ponerGente(R); return R; }
    if (id === 'casa') return crearCasa({ calidad: motor.Q }, o.casaDe && o.casaDe !== ID ? { dueño: o.casaDe, plano: [] } : { plano: G.casa });
    if (!cache[id]) {
      const R = CREAR[id]({ calidad: motor.Q });
      ponerGente(R);
      cache[id] = R;
    }
    return cache[id];
  }
  /* la gente del lugar */
  function ponerGente(R) {
    R.npcMallas = (R.npcs || []).map((n) => {
      const m = new Meeple({ ...APARIENCIA_INICIAL(), ...NPCS[n.id].A }, t('npc_' + n.id));
      m.raiz.position.set(n.pos[0], n.y, n.pos[1]); m.raiz.rotation.y = n.rot; R.grupo.add(m.raiz);
      R.mundo.cilindro(n.pos[0], n.pos[1], 0.42, n.y - 1, n.y + 1.3);
      R.mundo.interactivo({ id: 'npc', npc: n.id, pos: m.raiz.position, radio: 2.4, accion: 'hablar', icono: '💬' });
      return { id: n.id, m, rot: n.rot };
    });
  }
  function limpiarArboledas() {
    const vivos = new Set([...Object.values(cache).map((R) => R.grupo), reino?.grupo].filter(Boolean));
    /* (se sube hasta encontrar el grupo de un reino: la raíz de todo es la escena) */
    for (const a of ARBOLEDAS) { let q = a; while (q && !vivos.has(q)) q = q.parent; if (!q) ARBOLEDAS.delete(a); }
  }
  function entrarReino(id, o = {}) {
    if (reino) motor.escena.remove(reino.grupo);
    remotos.vaciar();
    for (const d of disparos) efectos.remove(d.m); disparos.length = 0; efx.vaciar();
    reino = construirReino(id, o);
    motor.escena.add(reino.grupo);
    limpiarArboledas();
    motor.aplicarPS1(reino.grupo);
    motor.simplificar(); motor.ajustarShaders();   // (toda la escena: también el muñeco propio y los de los demás)
    detalle.preparar(reino);
    cielo.ponerModo(reino.cielo || {});
    if (Q.has('hora') && reino.cielo?.hora == null) cielo.ponerModo({ ...(reino.cielo || {}), hora: +Q.get('hora') });
    cielo.sol.intensity = 0;
    const p = o.en || reino.inicio;
    yo.ponerEn(p, o.rumbo ?? reino.rumboInicio ?? 0);
    yo.hp = 100;
    cam.detras(yo.rumbo); cam.inicial = true;
    /* adentro de los edificios, en primera persona: el muñeco propio no se ve y aparece el punto */
    const FP = !!reino.primeraPersona;
    cam.fp = FP; cam.sentado = false; J.sentado = false; J._tZoom = 0; reino.apuntables = null;
    if (FP) cam.pitch = 0.3;
    yo.m.raiz.visible = true; yo.m.primeraPersona(FP); cuerpoFP.ponerApariencia(G.A); cuerpoFP.mostrar(FP); cielo.tRefl = 99;
    UI.mira(FP && !!(reino.accionables || reino.tiro));
    UNI.uViento.value = 1;
    zona = null; tZona = 9; J.esperaTren = null; UI.estadoTren(null);
    if (reino.zonaEn) zona = reino.zonaEn(p.x, p.z);
    if (reino.alEntrar) reino.alEntrar(J);
    /* (el runner arranca callado: su canción empieza con el ¡YA!; al salir vuelve la que había) */
    if (reino.runner) { J.callar(); UI.avisar(t('rn_ayuda') + (G.opciones.sustos !== false ? ' · ' + t('dl_aviso') : ''), 'azul'); } else J.musica(J.musicaElegida || musicaDelLugar());
    /* (y la cámara más lejos y más baja, para ver lo que viene; al salir vuelve a la de antes) */
    if (reino.runner) { J._distAntes ??= cam.distObj; cam.distObj = 7.2; cam.pitch = 0.2; } else if (J._distAntes != null) { cam.distObj = J._distAntes; J._distAntes = null; }
    /* la sala pública: la casa es de su dueño; el resto, la que tenga gente y lugar */
    const sala = id === 'casa' ? 'casa-' + (o.casaDe || ID) : id === 'tienda' ? 'tienda-1' : id === 'parkour' ? 'parkour-' + reino.nivel : id === 'tiro' ? 'tiro-1' : id === 'runner' ? 'runner-1' : id === 'interior' ? 'interior-' + reino.tipo + reino.i : red.elegirSala(id);
    UI.parkourHud(null); UI.tiroHud(null); UI.runnerHud(null);
    red.casaAbierta = id === 'casa' && !o.casaDe;
    red.entrar(sala, id);
    red.mirarCasa(id === 'casa' && o.casaDe && o.casaDe !== ID ? o.casaDe : null);
    if (red.casaAbierta) { red.publicarCasa(G.casa); UI.avisar(t('casa_visitas'), 'azul'); }
    red.accion({ type: 'apariencia', A: G.A, av: G.av });
    UI.actualizarRed();
    G.ultimoReino = ['parkour', 'tiro', 'runner'].includes(id) ? 'juegos' : ['tienda', 'casa'].includes(id) || reino.interior ? 'plaza' : id; Guardado.guardar();
  }
  async function viajar(id, o = {}) {
    if (!reino) return;
    const nombre = o.nombre || (id === 'casa' && o.nombreCasa ? t('reino_casa_de', { n: o.nombreCasa }) : t('reino_' + id));
    const pant = UI.pantallaViaje(nombre);
    pausado = true; J.sfx('entra');
    await new Promise((r) => setTimeout(r, 380));
    entrarReino(id, o);
    /* (mientras está la pantalla del viaje se compilan los shaders nuevos, sin trabar) */
    await Promise.all([new Promise((r) => setTimeout(r, 900)), Q.has('pausa') ? null : motor.precompilar(6000)]);
    pausado = false; pant.cerrar();
  }

  /* ---------------------------------------------------------------- empezar y salir */
  function empezarJuego(id = 'plaza', o = {}) {
    UI.cargando();
    setTimeout(async () => {
     try {
      if (!yo) yo = new Jugador(motor.escena, G.A, G.nombre);
      yo.m.ponerApariencia(G.A); yo.m.ponerNombre(G.nombre, true);
      entrarReino(Q.get('reino') || id, { nivel: +Q.get('nivel') || 0 });
      if (Q.has('x')) yo.p.set(+Q.get('x'), Q.has('y') ? +Q.get('y') : reino.mundo.altura(+Q.get('x'), +Q.get('z')) + 0.1, +Q.get('z'));
      if (Q.has('yaw')) cam.yaw = +Q.get('yaw'); if (Q.has('pitch')) cam.pitch = +Q.get('pitch'); if (Q.has('dist')) cam.dist = cam.distObj = +Q.get('dist');
      /* los shaders se compilan con la pantalla de carga puesta (sin trabar la página: antes el
         primer cuadro compilaba 60 de golpe y en un celu flojo parecía colgado) */
      if (!Q.has('pausa')) { cam.actualizar(0, yo, reino.interior ? null : reino.mundo); await motor.precompilar(); }
      enJuego = true; pausado = false;
      UI.juego();
      regaloDelDia(J, UI);
      ent.mostrarDedos(true);
      if (o.probador) abrirProbador();
      else if (!G.visto.tuto) tuto = { paso: 0, t: 0, lejos: 0, giro: 0, desde: yo.p.clone() };
     } catch (e) {
      /* si armar el reino falla (poca memoria, placa rara), se reintenta una vez en calidad baja */
      console.error(e);
      if (!J._reintento) { J._reintento = true; motor.ponerCalidad('minima'); for (const k in cache) delete cache[k]; reino = null; empezarJuego(id, o); }
      else { mostrarError(e); UI.menu(); }
     }
    }, 60);
  }
  function salirAlMenu() {
    enJuego = false; ent.mostrarDedos(false); probador = false; construyendo = null; cam.fp = false; UI.mira(false); voz.apagar(); cuerpoFP.mostrar(false);
    if (reino) { motor.escena.remove(reino.grupo); reino = null; }
    red.entrar(null, null); remotos.vaciar();
    Guardado.ya();
    UI.menu();
  }

  /* ---------------------------------------------------------------- acciones del jugador */
  /* el probador es un estudio aparte (probador.js): mientras está abierto se dibuja ese en vez del mundo */
  function abrirProbador() {
    probador = true;
    estudio ||= new Estudio(motor);
    estudio.mostrar(G.A, G.nombre); estudio.giro = 0;
    motor.aplicarPS1(estudio.escena);
    motor.pRender.scene = estudio.escena; motor.pRender.camera = estudio.cam;
    ent.mostrarDedos(false);
    UI.hud && UI.hud.classList.add('oculto');
    UI.probador(() => {
      probador = false; motor.pRender.scene = motor.escena; motor.pRender.camera = motor.camara;
      ent.mostrarDedos(true); UI.hud && UI.hud.classList.remove('oculto'); J.aplicarApariencia(); UI.actualizarHud();
    }, (d) => { if (estudio) estudio.giro += d; });
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
    if (H.que === 'ofrece') botones = [[t('despues'), () => {}], [t('aceptar'), () => { Misiones.aceptar(id); UI.avisar(t('mis_nueva'), 'azul'); J.sfx('aviso'); UI.actualizarMisiones(); Guardado.guardar(); if (NPCS[id].mision?.tipo === 'lugar' && zona) contar('lugar', 1, zona.id); }, true]];
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
      case 'mi_casa': viajar('casa'); break;
      case 'salir_tienda': { const P = cache.plaza; viajar('plaza', { en: P ? P.tienda.userData.puerta.clone().setY(P.mundo.altura(P.tienda.userData.puerta.x, P.tienda.userData.puerta.z) + 0.1) : undefined, rumbo: 0.6 }); break; }
      case 'probador': case 'comprar': abrirProbador(); break;
      case 'burbuja': yo.p.copy(reino.fuenteBurbujas); yo.entrarBurbuja(); UI.avisar(t(ent.tactil ? 'dedo_burbuja' : 'burbuja_bajar')); break;
      case 'hablar': hablar(o.npc); break;
      case 'montar': if (!o.delfin.jinete) { yo.montar(o.delfin); J.sfx('agua'); } break;
      case 'sueno': if (G.estrellas > 0) { const n = G.estrellas; G.estrellas = 0; reino.sueno.total += n; red.accion({ type: 'sueno_suma', n }); chispas.soltar(yo.p.clone().setY(yo.p.y + 3), 30, 4); J.sfx('guino'); Guardado.guardar(); revisarSueno(true); } else UI.avisar(t('sueno_falta', { n: reino.sueno.total, t: Math.min(20, 5 + remotos.cuantos * 3) }), 'azul'); break;
      case 'construir': empezarConstruir(); break;
      case 'monorriel': { const M = reino.monorriel, tr = M.paradoEn(o.parada); if (tr) subirTren(tr); else { J.esperaTren = { k: o.parada, desde: yo.p.clone() }; J.sfx('aviso'); } break; }
      case 'molino': reino.soplar(o.molino); J.sfx('ola'); chispas.soltar(yo.p.clone().setY(yo.p.y + 1.5), 14, 3); UI.avisar(t('molino_sopla'), 'azul'); contar('molino', 1, o.clave); break;
      case 'botella': enDialogo = true; J.sfx('guino'); UI.dialogo('🍾', [t(o.texto)], [], () => {}); contar('botella', 1, o.clave); break;
      case 'mapa': UI.mapa(dibujarMapa); break;
      case 'minijuego': viajar('juegos'); break;
      /* la Zona de Juegos (juegos.js): las puertas, las mesas y lo demás */
      case 'portal': irPortal(o.destino); break;
      case 'mesa': reino.mesas.sentar(J, o.mesa, o.silla); break;
      case 'patear': reino.patear(yo, J); break;
      case 'encestar': reino.tirarAro(yo, J); break;
      case 'bolos': reino.tirarBolos(yo, J, o.pista); break;
      case 'hamaca': { const H = reino.hamacas[o.hamaca]; if (H && !H.jinete) { yo.montar(H); J.sfx('entra'); } break; }
      case 'baile': J._baile = ((J._baile || 0) % 3) + 1; J.gesto('bailar' + J._baile); break;
      /* los edificios con interior (interior.js) y lo que se usa adentro apuntando */
      case 'entrar': viajar('interior', { tipo: o.tipo, i: o.i, salida: o.salida, rumbo: o.rumbo, nombre: t('lugar_' + o.tipo, { n: t(o.i === 2 ? 'npc_vecino' : 'npc_vecina') }) }); break;
      case 'salir_edificio': viajar('plaza', reino.salida ? { en: reino.salida.clone(), rumbo: reino.rumboSalida } : {}); break;
      case 'accionar': o.a.alUsar(J); break;
    }
  }
  /* ---------------------------------------------------------------- el chat de voz (voz.js) */
  voz.alCambiar = (e) => { UI.estadoVoz(e); red.ultimo = null; };   // (el estado nuevo sale ya, sin esperar el latido)
  voz.alConectar = (id) => { const r = remotos.get(id); UI.avisar('🔊 ' + t('voz_cerca', { n: r ? r.name : '?' })); };
  J.alternarVoz = async () => {
    if (voz.activa) { voz.apagar(); UI.avisar('🎤 ' + t('voz_no')); return; }
    if (!voz.soporte) { UI.estadoVoz('denegada'); UI.avisar('🎤 ' + t('voz_sin'), 'error'); return; }
    UI.avisar('🎤 ' + t('voz_pide'), 'azul');
    const e = await voz.prender();
    if (e === 'activa') UI.avisar('🎤 ' + t('voz_si'), 'bien');
    else UI.avisar('🎤 ' + t(voz.error === 'NotFoundError' || voz.error === 'NotAllowedError' ? 'voz_denegada' : 'voz_sin'), 'error');
  };
  J.volumenVoz = (v) => { G.opciones.volVoz = v; voz.ponerVolumen(v); Guardado.guardar(); };

  /* ---------------------------------------------------------------- lo que usan los interiores */
  J.avisar = (x, k) => UI.avisar(x, k);
  J.hablarCon = (id) => { if (reino?.npcMallas?.some((n) => n.id === id)) hablar(id); };
  J.efecto = (ef) => { yo.ponerEfecto(ef); };
  J.zoom = (seg) => { J._tZoom = seg; };
  J.sentarseEn = (pos, rot) => { yo.ponerEn(pos, rot); yo.v.set(0, 0, 0); cam.yaw = rot + Math.PI; cam.pitch = 0.3; cam.sentado = true; J.sentado = true; J.gesto('sentarse'); J.sfx('aterriza'); };
  J.siguienteCancion = () => {
    const todas = [...new Set(['titulo', 'colina', ...Object.values(DISCO_CANCION)])].filter((k) => J.cancionDesbloqueada(k));
    if (!todas.length) { UI.avisar('🎵 ' + t('sin_canciones'), 'azul'); return; }
    const k = todas[(todas.indexOf(J.musicaElegida || J.sonando) + 1) % todas.length];
    J.elegirMusica(k); UI.avisar('🎵 ' + t('can_' + k), 'azul');
  };
  J.leer = (titulo, texto) => { enDialogo = true; UI.dialogo(titulo, [texto], [], () => {}); };
  /* lo que se apunta con el punto del medio: lo primero que corta el rayo, si es algo que se usa y está cerca */
  const rayo = new THREE.Raycaster(), CENTRO = new THREE.Vector2(0, 0);
  function apuntado() {
    if (!reino.apuntables) { reino.apuntables = []; reino.grupo.traverse((q) => { if (q.isMesh && !q.userData.sinApunte && (!q.isInstancedMesh || q.userData.acc)) reino.apuntables.push(q); }); }
    motor.camara.updateMatrixWorld(); rayo.setFromCamera(CENTRO, motor.camara); rayo.far = 6.5;
    const h = rayo.intersectObjects(reino.apuntables, false)[0], a = h?.object.userData.acc;
    return a && h.distance < a.dist ? a : null;
  }

  /* ---------------------------------------------------------------- el tiro de burbujas (tiro.js) */
  G.tiro ||= { mejor: 0, estrellas: 0 };
  J.tiroReiniciar = () => { if (reino?.tiro) { reino.reiniciar(yo); UI.cerrarVentana(); J.sfx('entra'); } };
  J.tiroSalir = () => J.volverAJuegos('tiro');
  /* el telescopio de la azotea: el Estelario (el cielo de verdad, estelario.js) */
  J.abrirEstelario = () => { pausado = true; ent.mostrarDedos(false); estelario.abrir({ alCerrar: () => { pausado = false; ent.mostrarDedos(true); J.sfx('pop'); } }); };
  function seguirTiro(dt) {
    const E = reino.tiro;
    if (E.fase === 'cuenta') UI.cuenta(String(Math.max(1, Math.ceil(E.cuenta - 0.4))));
    UI.tiroHud(E);
    for (const ev of E.eventos.splice(0)) {
      if (ev.tipo === 'ya') { UI.cuenta(t('pk_ya'), true); J.sfx('restaura'); }
      else if (ev.tipo === 'pop') { J.sfx('pop'); if (ev.oro) J.sfx('orbe'); if (ev.subeRacha) { J.sfx('gota', { k: ev.mult * 2 }); UI.pkDestello('control'); } ent.vibrar(12); }
      else if (ev.tipo === 'fin') {
        const P = G.tiro, est = ev.puntos >= TIRO.estrellas[2] ? 3 : ev.puntos >= TIRO.estrellas[1] ? 2 : ev.puntos >= TIRO.estrellas[0] ? 1 : 0;
        const record = ev.puntos > (P.mejor || 0), primera = !P.jugado;
        const premio = (primera ? 15 : 0) + Math.max(0, est - (P.estrellas || 0)) * 5;
        if (record) P.mejor = ev.puntos; P.estrellas = Math.max(P.estrellas || 0, est); P.jugado = true;
        G.orbes += premio; Guardado.guardar(); UI.actualizarHud(); J.sfx('restaura');
        setTimeout(() => UI.resultadoTiro({ puntos: ev.puntos, aciertos: ev.aciertos, tiros: ev.tiros, estrellas: est, record, premio }, () => J.tiroReiniciar(), () => J.tiroSalir()), 700);
      }
    }
  }

  /* ---------------------------------------------------------------- el runner (runner.js) */
  G.runner ||= { mejor: 0, estrellas: 0, pct: 0 };
  delirio.alSusto = () => { cam.sacudida = Math.max(cam.sacudida, 0.6); ent.vibrar(160); };
  J.runnerReiniciar = () => { if (reino?.runner) { reino.reiniciar(yo); UI.cerrarVentana(); J.callar(); cam.detras(0); cam.inicial = true; J.sfx('entra'); } };
  J.runnerSalir = () => volverAJuegos('runner');
  function seguirRunner(dt) {
    const E = reino.runner;
    if (E.fase === 'cuenta') UI.cuenta(String(Math.max(1, Math.ceil(E.cuenta - 0.4))));
    UI.runnerHud(E);
    if (reino.golpe === 2 && reino.corrupcion > 0.25) { cam.sacudida = Math.max(cam.sacudida, 0.22); ent.vibrar(12); }
    for (const ev of E.eventos.splice(0)) {
      if (ev.tipo === 'ya') { UI.cuenta(t('pk_ya'), true); J.sfx('restaura'); J.musicaDeNuevo('runner'); }
      else if (ev.tipo === 'golpe') { J.sfx('pop'); J.sfx('hongo'); cam.sacudida = Math.max(cam.sacudida, 0.35); efx.chispas(ev.p, { n: 46, vel: 6, vida: 0.55, tam: 0.3, color: '#ff00dc', color2: '#00ffe6', arrastre: 2 }); efx.destelloEn(ev.p, { tam: 3.5, dur: 0.25, color: '#ff4fe8' }); ent.vibrar(40); }
      else if (ev.tipo === 'aro') { J.sfx('orbe'); J.sfx('gota', { k: 4 }); UI.pkDestello('control'); ent.vibrar(15); }
      else if (ev.tipo === 'caida') { reino.reaparecer(yo); cam.detras(0); cam.inicial = true; J.sfx('pop'); break; }
      else if (ev.tipo === 'meta' || ev.tipo === 'tarde') {
        const P = G.runner, ok = ev.tipo === 'meta', sobra = ok ? E.limite - ev.tiempo : 0;
        const est = !ok ? 0 : sobra >= RUNNER.estrellas[0] ? 3 : sobra >= RUNNER.estrellas[1] ? 2 : 1;
        const record = ok && (!P.mejor || ev.tiempo < P.mejor), primera = ok && !P.mejor;
        const pct = Math.round((ok ? 1 : ev.prog) * 100);
        const premio = (primera ? 30 : 0) + Math.max(0, est - (P.estrellas || 0)) * 5;
        if (record) P.mejor = +ev.tiempo.toFixed(2);
        P.estrellas = Math.max(P.estrellas || 0, est); P.pct = Math.max(P.pct || 0, pct);
        G.orbes += premio; Guardado.guardar(); UI.actualizarHud();
        if (ok) { J.sfx('restaura'); efx.festejo(yo.p.clone()); efx.destello = 0.9; yo.m.hacerGesto('festejar'); } else { J.sfx('pop'); J.callar(); }
        setTimeout(() => UI.resultadoRunner({ ok, tiempo: ev.tiempo, sobra, pct, caidas: ev.caidas, golpes: ev.golpes, estrellas: est, record, premio }, () => J.runnerReiniciar(), () => J.runnerSalir()), ok ? 1400 : 700);
      }
    }
  }

  /* ---------------------------------------------------------------- el parkour */
  G.parkour ||= { mejor: {}, estrellas: {} };
  function abrirParkour() {
    pausado = true;
    UI.menuParkour(G.parkour, (n) => { pausado = false; irParkour(n); }, () => { pausado = false; }, () => { pausado = false; viajar('tiro'); });
  }
  /* el parkour se juega en tercera o en primera persona (el botón 👁 del menú) */
  const irParkour = (n) => viajar('parkour', { nivel: n, fp: !!G.parkour.fp, nombre: `${NIVELES[n].icono} ${t('pk_' + NIVELES[n].id)}` });
  J.parkourReiniciar = () => { if (reino?.parkour) { reino.reiniciar(yo); UI.cerrarVentana(); J.sfx('entra'); } };
  /* de los juegos se vuelve a la Zona de Juegos, delante de su puerta */
  const volverAJuegos = (destino) => {
    const Z = cache.juegos || construirReino('juegos'), P = Z?.portales.find((q) => q.destino === destino);
    if (!P) { viajar('juegos'); return; }
    const d = P.pos.clone().setY(0).normalize(), en = P.pos.clone().addScaledVector(d, -2.6); en.y = P.pos.y + 0.12;
    viajar('juegos', { en, rumbo: Math.atan2(-d.x, -d.z) });
  };
  J.parkourSalir = () => volverAJuegos('parkour');
  J.volverAJuegos = volverAJuegos;
  /* las puertas: a los juegos, a cada lugar del mapa (teletransporte, con su efecto) o a la isla */
  function irPortal(destino) {
    if (destino === 'parkour') { abrirParkour(); return; }
    if (destino === 'tiro') { viajar('tiro'); return; }
    if (destino === 'runner') { viajar('runner'); return; }
    if (destino === 'isla') { const P = cache.plaza?.puntos; viajar('plaza', P ? { en: new THREE.Vector3(P.puertaJuegos[0] + Math.sin(P.rumboJuegos) * 3, 0, P.puertaJuegos[1] + Math.cos(P.rumboJuegos) * 3).setY(cache.plaza.mundo.altura(P.puertaJuegos[0] + Math.sin(P.rumboJuegos) * 3, P.puertaJuegos[1] + Math.cos(P.rumboJuegos) * 3) + 0.1), rumbo: P.rumboJuegos } : {}); return; }
    const L = destino === 'centro' ? { p: reino.inicio.clone(), rumbo: reino.rumboInicio } : reino.llegadas?.[destino];
    if (!L) return;
    efx.portal(yo.p.clone()); J.sfx('entra'); ent.vibrar(25);
    yo.ponerEn(L.p.clone(), L.rumbo); cam.detras(L.rumbo); cam.inicial = true;
    efx.portal(L.p.clone());
  }
  function seguirParkour(dt) {
    const E = reino.parkour;
    if (E.fase === 'cuenta') UI.cuenta(String(Math.max(1, Math.ceil(E.cuenta - 0.4))));
    UI.parkourHud(E);
    for (const ev of E.eventos.splice(0)) {
      if (ev.tipo === 'ya') { UI.cuenta(t('pk_ya'), true); J.sfx('restaura'); }
      else if (ev.tipo === 'control') { UI.pkDestello('control'); J.sfx('orbe'); }
      else if (ev.tipo === 'golpe') { J.sfx('pop'); cam.sacudida = 0.25; ent.vibrar(30); }
      else if (ev.tipo === 'caida') { reino.reaparecer(yo); cam.inicial = true; J.sfx('pop'); break; }
      else if (ev.tipo === 'meta') {
        const n = E.nivel, P = G.parkour, N = NIVELES[n];
        const est = ev.tiempo < N.estrellas[0] ? 3 : ev.tiempo < N.estrellas[1] ? 2 : 1;
        const record = !P.mejor[n] || ev.tiempo < P.mejor[n], primera = !P.mejor[n];
        let premio = (primera ? 20 : 0) + Math.max(0, est - (P.estrellas[n] || 0)) * 5;
        if (record) P.mejor[n] = +ev.tiempo.toFixed(2);
        P.estrellas[n] = Math.max(P.estrellas[n] || 0, est);
        G.orbes += premio; Guardado.guardar(); UI.actualizarHud();
        J.sfx('restaura'); yo.m.hacerGesto('festejar');
        setTimeout(() => UI.resultadoParkour({ nivel: n, tiempo: ev.tiempo, caidas: ev.caidas, estrellas: est, record, premio, hay: n < NIVELES.length - 1 },
          () => irParkour(n + 1), () => J.parkourReiniciar(), () => J.parkourSalir()), 900);
      }
    }
  }
  /* el monorriel: subirse es montarlo, como al delfín (jugador.js); se baja solo cuando para */
  function subirTren(tr) {
    J.esperaTren = null;
    yo.montar(tr.montura); J.sfx('entra'); UI.avisar(t('tren_arriba'), 'bien'); ent.vibrar(20);
  }
  function seguirTren() {
    const M = reino.monorriel; if (!M) return;
    const tr = yo.modo === 'montado' ? yo.montura?.tren : null;
    if (tr) {
      const q = M.paradas[tr.parada >= 0 ? tr.parada : tr.prox];
      UI.estadoTren(t(tr.parada >= 0 ? 'tren_parado' : 'tren_proxima', { n: q.nombre }));
      return;
    }
    if (J.esperaTren) {
      const E = J.esperaTren, tr2 = M.paradoEn(E.k);
      if (yo.p.distanceTo(E.desde) > 9) { J.esperaTren = null; UI.estadoTren(null); return; }
      if (tr2) { subirTren(tr2); return; }
      UI.estadoTren(t('tren_llega', { n: Math.ceil(M.llega(E.k)) }));
      return;
    }
    UI.estadoTren(null);
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
    const g = cv.getContext('2d'), W = cv.width, M = reino.mundo, L = reino.mapa ? reino.mapa.L : reino.id === 'casa' ? 30 : reino.id === 'tienda' ? 14 : 130;
    if (reino.mapa) g.drawImage(reino.mapa.canvas, 0, 0, W, W);
    else if (!reino._mapa || reino._mapaL !== L) {
      const img = g.createImageData(W, W);
      for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
        const x = (i / W - 0.5) * 2 * L, z = (j / W - 0.5) * 2 * L, h = M.altura(x, z), k = (j * W + i) * 4;
        const agua = M.agua != null && h < M.agua;
        const c = agua ? [80 + h * 6, 190 + h * 4, 240] : h < 1.1 ? [245, 232, 190] : [110 + h * 8, 200 + h * 3, 90];
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
      reino._mapa = img; reino._mapaL = L;
    }
    if (!reino.mapa) g.putImageData(reino._mapa, 0, 0);
    const P = (x, z) => [(x / (2 * L) + 0.5) * W, (z / (2 * L) + 0.5) * W];
    const punto = (x, z, c, r = 6) => { const [a, b] = P(x, z); g.fillStyle = c; g.beginPath(); g.arc(a, b, r, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); };
    if (!reino.mapa) for (const o of M.interactivos) { const q = typeof o.pos === 'function' ? o.pos() : o.pos; if (o.accion === 'viajar') { g.font = '22px sans-serif'; const [a, b] = P(q.x, q.z); g.fillText('🚆', a - 11, b + 8); } }
    /* los trenes del monorriel, andando */
    if (reino.monorriel) for (const tr of reino.monorriel.trenes) if (tr.base) { const [a, b] = P(tr.base.x, tr.base.z); g.fillStyle = '#ffffff'; g.fillRect(a - 7, b - 7, 14, 14); g.fillStyle = '#27b9e8'; g.fillRect(a - 5, b - 5, 10, 10); }
    for (const n of reino.npcMallas || []) punto(n.m.raiz.position.x, n.m.raiz.position.z, '#ffd23f', 7);
    for (const r of remotos.m.values()) punto(r.x, r.z, '#ff6fb0', 6);
    const [a, b] = P(yo.p.x, yo.p.z);
    g.save(); g.translate(a, b); g.rotate(-yo.rumbo + Math.PI); g.fillStyle = '#34bef0'; g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 8); g.lineTo(-8, 8); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); g.restore();
  }

  /* ---------------------------------------------------------------- el cuadro */
  const antes = new THREE.Vector3(), oido = { pos: new THREE.Vector3(), adelante: new THREE.Vector3() };
  let accionCerca = null;
  function paso(dt, dibujar = true) {
    UNI.uT.value += dt;
    if (!enJuego || !reino) { return; }
    /* mirando por el telescopio: el juego queda quieto y se dibuja el cielo */
    if (estelario.abierto) { estelario.cuadro(dt, dibujar); return; }
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
    if (!probador) cam.girar(E.camX * O.sensCam, E.camY * O.sensCam * (O.invertirY ? -1 : 1));
    /* el runner: la cámara siempre atrás, mirando para donde se corre */
    if (reino.camYaw != null && !cam.fp) { let d = reino.camYaw - cam.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; cam.yaw += d * Math.min(1, dt * 10); }
    /* si hace un rato que no se toca la cámara y se camina, se acomoda sola atrás
       (despacio, y no cuando se viene hacia la cámara: ahí daría media vuelta) */
    if (Math.abs(E.camX) + Math.abs(E.camY) > 0.0005) J._tCam = 0; else J._tCam = (J._tCam || 0) + dt;
    if (O.camAuto !== false && reino.camYaw == null && !cam.fp && !quieto && !probador && J._tCam > 1.2 && yo && yo.modo !== 'burbuja') {
      const vel = Math.hypot(yo.v.x, yo.v.z), obj = (yo.modo === 'montado' ? yo.rumbo : Math.atan2(yo.v.x, yo.v.z)) + Math.PI;
      let d = obj - cam.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      if ((vel > 1.2 || yo.modo === 'montado') && Math.abs(d) < 2.3) cam.yaw += d * Math.min(1, dt * (yo.modo === 'montado' ? 0.9 : 0.55) * Math.min(1, (J._tCam - 1.2) * 2));
    }
    if (E.zoom !== 1) cam.acercar(E.zoom);
    /* el muñeco */
    antes.copy(yo.modo === 'montado' && yo.montura ? yo.montura.p : yo.p);
    const { adelante, derecha } = cam.ejes();
    const mx = derecha.x * E.x - adelante.x * E.z, mz = derecha.y * E.x - adelante.y * E.z;
    const Em = quieto || probador ? { x: 0, z: 0, corre: false, salta: false, sostiene: false, accion: false, baja: false } : { ...E, x: mx, z: mz };
    /* el E de usar lo toma primero la interacción (si no está en burbuja ni montado) */
    const usa = Em.accion && yo.modo !== 'burbuja' && yo.modo !== 'montado';
    if (usa) Em.accion = false;
    if (J.sentado && (Math.abs(Em.x) + Math.abs(Em.z) > 0.15 || Em.salta)) { J.sentado = false; cam.sentado = false; J.gestoActual = null; yo.m.gesto = null; }
    if (reino.antesDelJugador) reino.antesDelJugador(dt, yo, Em);
    yo.actualizar(dt, Em, reino.mundo); yo.paso(dt);
    /* en primera persona el cuerpo mira para donde mira la cámara */
    if (cam.fp) { yo.rumbo = cam.yaw + Math.PI; yo.sync(); }
    JUGADOR.copy(yo.p);
    for (const ev of yo.eventos) {
      if (ev === 'salto') J.sfx('salto'); else if (ev === 'doble') { J.sfx('burbuja'); chispas.soltar(yo.p, 8, 2); } else if (ev === 'aterriza') J.sfx('aterriza');
      else if (ev === 'chapuzon' || ev === 'monta') { J.sfx('agua'); chispas.soltar(yo.p.clone().setY(reino.mundo.agua ?? yo.p.y), 16, 3); } else if (ev === 'rebote') { J.sfx('hongo'); const c = yo.pisando?.clave; if (c && c.startsWith('hongo')) contar('hongo', 1, c); }
      else if (ev === 'impacto') { efx.impacto(yo.p.clone(), Math.min(1.6, (yo.golpe - 13) / 7)); J.sfx('pop'); ent.vibrar(45); }
      else if (ev === 'desliza') J.sfx('ola'); else if (ev === 'valla' || ev === 'subePared') J.sfx('salto'); else if (ev === 'corrPared') { J.sfx('ola'); efx.polvo(yo.p.clone().add(new THREE.Vector3(0, 0.3, 0)), new THREE.Vector3(Math.sin(yo.rumbo), 0, Math.cos(yo.rumbo))); } else if (ev === 'rueda') J.sfx('aterriza'); else if (ev === 'trepa') J.sfx('salto'); else if (ev === 'pared') { J.sfx('hongo'); chispas.soltar(yo.p.clone().setY(yo.p.y + 0.9), 10, 2.5); }
      else if (ev === 'noBaja') UI.avisar(t('tren_espera'), 'azul');
      else if (ev === 'bajaTren') { J.sfx('aterriza'); cam.inicial = true; UI.estadoTren(null); } else if (ev === 'brazada') J.sfx('brazada');
      else if (ev === 'geiser') { J.sfx('ola'); if (yo._enGeiser?.clave) contar('geiser', 1, yo._enGeiser.clave); } else if (ev === 'pop') { J.sfx('pop'); chispas.soltar(yo.p.clone().setY(yo.p.y + 0.8), 20, 3); } else if (ev === 'burbuja') J.sfx('burbuja');
      else if (ev === 'caida') { yo.ponerEn(reino.inicio, reino.rumboInicio); }
    }
    /* la espuma vuelve sola */
    tSinGolpe += dt; if (tSinGolpe > 4 && yo.hp < 100) yo.hp = Math.min(100, yo.hp + dt * 8);
    /* los disparos de burbuja */
    tDisparo -= dt;
    if (!quieto && !probador && E.dispara && tDisparo <= 0 && yo.modo !== 'montado' && (!reino.tiro || reino.tiro.fase === 'juega')) {
      if (reino.contarTiro) reino.contarTiro();
      tDisparo = reino.tiro ? 0.26 : 0.45;
      let dir, desde;
      if (cam.fp) {
        /* en primera persona sale de la mano derecha hacia donde se mira */
        const c = motor.camara, f = new THREE.Vector3(); c.getWorldDirection(f);
        const der = new THREE.Vector3().crossVectors(f, c.up).normalize();
        dir = f.clone().add(new THREE.Vector3(0, 0.03, 0)).normalize().multiplyScalar(reino.tiro ? 24 : 18);
        desde = c.position.clone().addScaledVector(der, 0.24).addScaledVector(f, 0.55).add(new THREE.Vector3(0, -0.14, 0));
        cuerpoFP.tirar();
      } else {
        dir = new THREE.Vector3(Math.sin(yo.rumbo), 0.12, Math.cos(yo.rumbo)).normalize().multiplyScalar(15);
        desde = yo.p.clone().add(new THREE.Vector3(Math.sin(yo.rumbo) * 0.6, 1.0 * yo.escala, Math.cos(yo.rumbo) * 0.6));
      }
      disparar(desde, dir, true);
      red.accion({ type: 'disparo', x: +desde.x.toFixed(2), y: +desde.y.toFixed(2), z: +desde.z.toFixed(2), dx: +dir.x.toFixed(2), dy: +dir.y.toFixed(2), dz: +dir.z.toFixed(2) });
      if (J.slot !== 1) { J.slot = 1; UI.actualizarHud(); }
    }
    for (let i = disparos.length - 1; i >= 0; i--) {
      const d = disparos[i];
      d.vida -= dt; d.v.y -= 3 * dt; d.m.position.addScaledVector(d.v, dt);
      d.m.scale.setScalar(1 + Math.sin(d.vida * 20) * 0.05);
      let fin = d.vida <= 0 || d.m.position.y < reino.mundo.altura(d.m.position.x, d.m.position.z);
      /* el tiro de burbujas: ¿le pegó a un blanco? (y si se perdió, se corta la racha) */
      if (d.mio && !fin && reino.golpe && reino.golpe(d.m.position)) { fin = true; d.pego = true; }
      if (fin && d.mio && !d.pego && reino.fallo) reino.fallo();
      if (d.mio && !fin) for (const r of remotos.m.values()) {
        if (Math.hypot(r.x - d.m.position.x, r.z - d.m.position.z) < 0.7 && d.m.position.y > r.y && d.m.position.y < r.y + 1.5) {
          red.accion({ type: 'hit_player', targetId: r.id, dmg: 10, byName: G.nombre }); fin = true; J.sfx('pop'); break;
        }
      }
      if (fin) { chispas.soltar(d.m.position, 10, 2.5); efectos.remove(d.m); disparos.splice(i, 1); }
    }
    chispas.actualizar(dt);
    /* polvo al deslizarse */
    if ((yo.estado === 'desliza' || yo.estado === 'corrPared') && Math.random() < dt * 30) efx.polvo(yo.p.clone().add(new THREE.Vector3(0, 0.1, 0)), new THREE.Vector3(Math.sin(yo.rumbo), 0, Math.cos(yo.rumbo)));
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
        UI.avisar(Sonido.grabadas[d.cancion] ? t('disco_nuevo', { n: t('can_' + d.cancion) }) : t('disco_vacio'), 'bien'); contar('disco'); Guardado.guardar();
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
    /* la zona de la isla: el cartel, la música y la misión de Brújula (con margen, para no titilar en el borde) */
    if (reino.zonaEn && (tZona += dt) > 0.5) {
      tZona = 0;
      const z = reino.zonaEn(yo.p.x, yo.p.z);
      const sigue = zona && Math.hypot(yo.p.x - zona.c[0], yo.p.z - zona.c[1]) < zona.r * 1.08;
      /* (se compara por id: un reino que arma la zona de nuevo en cada consulta avisaba dos veces por segundo) */
      if (z && z.id !== zona?.id && !(sigue && z.r > zona.r)) {
        zona = z; UI.lugar(t('zona_' + z.id), z.icono); J.sfx('aviso');
        if (!J.musicaElegida) J.musica(z.musica);
        contar('lugar', 1, z.id);
      }
    }
    seguirTren();
    if (reino.id === 'aurora') { const n = reino.actualizar(dt, yo.p, cielo); if (n) { G.estrellas += n; UI.avisar(t('estrella'), 'azul'); J.sfx('guino'); contar('estrella', n); } }
    else reino.actualizar(dt, yo.p, cielo);
    if (reino.parkour) seguirParkour(dt);
    if (reino.tiro) seguirTiro(dt);
    if (reino.runner) seguirRunner(dt);
    if (reino.ascensor) for (const ev of reino.ascensor.eventos.splice(0)) {
      if (ev.tipo === 'llega') { UI.avisar(t('asc_llega', { n: t(ev.n) }), 'bien'); J.sfx('guino'); }
      else { UI.avisar(t(ev.tipo === 'sube' ? 'asc_sube' : 'asc_baja'), 'azul'); J.sfx('entra'); }
    }
    /* la gente del lugar mira a quien se acerca */
    for (const n of reino.npcMallas || []) {
      const d = Math.hypot(yo.p.x - n.m.raiz.position.x, yo.p.z - n.m.raiz.position.z);
      /* de lejos no se ven (y no se animan): cada muñeco son muchas piezas */
      n.m.raiz.visible = d < 110; if (!n.m.raiz.visible) continue;
      n.m.detalle(d < 32);
      const obj = d < 5 ? Math.atan2(yo.p.x - n.m.raiz.position.x, yo.p.z - n.m.raiz.position.z) : n.rot;
      let dd = obj - n.m.raiz.rotation.y; while (dd > Math.PI) dd -= Math.PI * 2; while (dd < -Math.PI) dd += Math.PI * 2;
      n.m.raiz.rotation.y += dd * Math.min(1, dt * 3);
      n.m.animar(dt, 'quieto', 0);
    }
    /* lo que se puede usar cerca: el cartel y la tecla */
    let cerca = null;
    if (!quieto && !probador && yo.modo !== 'burbuja') {
      const a = cam.fp && reino.accionables ? apuntado() : null;
      cerca = yo.modo === 'montado' ? { accion: 'bajar' } : a ? { accion: 'accionar', a } : reino.mundo.cercano(yo.p);
      if (!cerca && reino.frutas) { const i = reino.frutas.cerca(yo.p); if (i >= 0) cerca = { accion: 'fruta', i }; }
      if (construyendo) cerca = construyendo.k ? { accion: 'poner' } : null;
    }
    accionCerca = cerca;
    if (cam.fp && (reino.accionables || reino.tiro)) UI.mira(true, cerca?.accion === 'accionar');
    UI.accion(cerca ? (cerca.textoFn ? cerca.textoFn() : cerca.accion === 'poner' ? t('casa_construir') : cerca.accion === 'hablar' ? `${t('accion_hablar')} · ${t('npc_' + cerca.npc)}` : cerca.accion === 'accionar' ? cerca.a.texto() : cerca.texto ? t(cerca.texto) : t('accion_' + cerca.accion)) : null);
    if (usa && cerca) {
      if (cam.fp) cuerpoFP.usar();
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
      gesto: J.gestoActual || null, esc: +yo.escala.toFixed(2), ef: yo.efecto, av: G.av, modo: yo.modo, voz: voz.marca, mesa: reino.mesas?.miAsiento() || null,
    });
    remotos.actualizar(dt);
    for (const r of remotos.m.values()) if (r.m?.detalle) r.m.detalle(Math.hypot(r.x - yo.p.x, r.z - yo.p.z) < 32);
    tPresencia += dt; if (tPresencia > 1) { tPresencia = 0; red.limpiar(); }
    /* el cielo, el agua, la cámara */
    cielo.actualizar(dt, yo.p);
    if (reino.interior) { cielo.sol.intensity *= 0.35; cielo.hemi.intensity = 1.1; }
    /* adentro de los edificios la luz de abajo no es la del pasto (el techo salía verde) */
    if (reino.primeraPersona) {
      cielo.hemi.groundColor.set('#f2eee8'); cielo.hemi.color.set('#ffffff'); cielo.hemi.intensity = 0.7;
      /* y los reflejos son los de una sala blanca (el mapa del cielo tiene el pasto abajo) */
      if (!J._envSala) { const pm = new THREE.PMREMGenerator(motor.r); J._envSala = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
      motor.escena.environment = J._envSala; motor.escena.environmentIntensity = 0.38;
    }
    if (reino.mar) aguaSigueCielo(reino.mar, cielo);
    cam.rollExtra = reino.camRoll || 0;   // (el runner: la cámara se ladea con los golpes)
    cam.actualizar(dt, yo, reino.interior ? null : reino.mundo);
    /* la voz: el oído va en la cabeza propia, mirando para donde mira la cámara */
    if (voz.activa) {
      oido.pos.set(yo.p.x, yo.p.y + 1.3 * yo.escala, yo.p.z); motor.camara.getWorldDirection(oido.adelante);
      voz.actualizar(dt, oido, remotos.m);
      const nv = Math.round(voz.nivel * 20) / 20; if (nv !== J._nivelVoz) { J._nivelVoz = nv; UI.estadoVoz(voz.estado, nv); }
    }
    cuerpoFP.actualizar(dt, motor.camara, yo);
    efx.actualizar(dt, motor.camara, motor.alto * (motor.dpr || 1));
    const UF = motor.pFinal.uniforms;
    UF.uDestello.value = efx.destello; UF.uOscuro.value = efx.oscuro;
    UF.uGlitch.value = reino.glitch || 0; UF.uVelocidad.value = reino.velFx || 0;   // (el runner: lo roto y la velocidad)
    if (efx.sacudida > 0) { cam.sacudida = Math.max(cam.sacudida, efx.sacudida); efx.sacudida = 0; }
    J._tZoom = Math.max(0, (J._tZoom || 0) - dt);
    const fov = J._tZoom > 0 ? 18 : (motor.alto > motor.ancho ? 72 : 58) + (cam.fp ? 12 : 0) + cam.kSprint * 7 + (reino.fovExtra || 0), fc = motor.camara;
    if (Math.abs(fc.fov - fov) > 0.05) { fc.fov += (fov - fc.fov) * Math.min(1, dt * 5); fc.updateProjectionMatrix(); }
    /* los árboles de cerca con detalle y los de lejos livianos (naturaleza.js) */
    for (const a of ARBOLEDAS) { let q = a; while (q.parent) q = q.parent; if (q === motor.escena) a.actualizar(dt, motor.camara.position); }
    /* adentro: la cámara no sale de las paredes */
    if (reino.caja) { const [x0, x1, z0, z1, y1] = reino.caja, c = motor.camara.position; c.x = Math.max(x0, Math.min(x1, c.x)); c.z = Math.max(z0, Math.min(z1, c.z)); c.y = Math.min(y1, c.y); }
    if (probador) estudio.actualizar(dt, E.camX, motor.ancho, motor.alto, UI.libreProbador());
    const bajo = !probador && reino.mundo.agua != null && motor.camara.position.y < reino.mundo.agua - 0.05;
    motor.pFinal.uniforms.uAgua.value += ((bajo ? 1 : 0) - motor.pFinal.uniforms.uAgua.value) * Math.min(1, dt * 6);
    cielo.bajoAgua = bajo;
    if (bajo !== J._bajo) { J._bajo = bajo; try { Sonido.agua(bajo); } catch { /* nada */ } motor.escena.fog.near = bajo ? 2 : 140; motor.escena.fog.far = bajo ? 45 : 950; }
    if (bajo) motor.escena.fog.color.set('#1a8fc0');
    detalle.actualizar(dt, motor.camara, motor.Q, bajo);
    /* la calidad automática: se miden 60 cuadros de verdad (no el dt recortado) y se sube o baja */
    if (midiendo && G.opciones.calidad === 'auto' && !Q.has('calidad')) {
      tMedir += dt; if (tMedir > 1.5 && J.dtReal) { cuadros++; sumaDt += Math.min(0.25, J.dtReal); }
      if (cuadros >= 60) {
        const ms = sumaDt / cuadros * 1000, q = motor.nombreCalidad; cuadros = 0; sumaDt = 0; tMedir = 0.5;
        /* (26/09: también de baja a mínima, que va sin posproceso ni brillos) */
        if (ms > 30 && q !== 'minima') { motor.ponerCalidad(ORDEN_CALIDAD[ORDEN_CALIDAD.indexOf(q) + 1] || 'minima'); UI.calidadBaja(); UI.avisar(t('subio_calidad', { n: t('cal_' + motor.nombreCalidad) })); }
        else if (ms > 45 && !G.opciones.retro.pix) { UI.avisar(t('lento_pixel'), 'azul'); midiendo = false; }
        /* si anda sobrado se sube un escalón (una sola vez; en el celu, solo de baja a media) */
        else if (ms < 13 && q !== 'alta' && !J._subio && aparato.motivo !== 'software' && (!TACTIL || q === 'baja' || q === 'minima')) { J._subio = true; motor.ponerCalidad(ORDEN_CALIDAD[ORDEN_CALIDAD.indexOf(q) - 1] || 'media'); UI.calidadBaja(); UI.avisar(t('subio_calidad', { n: t('cal_' + motor.nombreCalidad) })); }
        else midiendo = false;
      }
    }
    /* los materiales nuevos (gente que llega, ropa nueva) también tiemblan en PS1 */
    if (G.opciones.retro.ps1) { J._tPS1 = (J._tPS1 || 0) + dt; if (J._tPS1 > 1.5) { J._tPS1 = 0; motor.aplicarPS1(); } }
    /* (y en mínima, lo nuevo también va sin barniz) */
    if (motor.Q.simple) { J._tSim = (J._tSim || 0) + dt; if (J._tSim > 2.5) { J._tSim = 0; motor.simplificar(); motor.ajustarShaders(); } }
    if (tuto) seguirTuto(dt, E);
    tHud += dt; if (tHud > 0.25) { tHud = 0; UI.actualizarHud(); }
    /* el runner a veces congela un par de cuadros (no se dibuja: queda el anterior) y encima va delirio.js */
    const congela = reino.congela > 0;
    if (dibujar && !congela) motor.dibujar(dt);
    delirio.cuadro(dt, reino, motor.camara, dibujar, dibujar && !congela);
  }

  /* el tutorial de primeros pasos: un cartel por vez, que se va cuando se hizo */
  function seguirTuto(dt, E) {
    const pasos = ['mover', 'saltar', 'camara', 'hablar', 'listo'];
    const n = pasos[tuto.paso]; if (!n) { tuto = null; return; }
    const dedo = ent.tactil && !['camara', 'listo'].includes(n) ? '_dedo' : '';
    UI.tuto(t('tuto_' + n + dedo));
    tuto.t += dt;
    let hecho = false;
    if (n === 'mover') hecho = yo.p.distanceTo(tuto.desde) > 4;
    else if (n === 'saltar') hecho = yo.eventos.includes('salto') || yo.eventos.includes('doble');
    else if (n === 'camara') { tuto.giro += Math.abs(E.camX) + Math.abs(E.camY); hecho = tuto.giro > 1.2 || tuto.t > 8; }
    else if (n === 'hablar') hecho = Misiones.estado('brujula').e !== 'nueva' || Misiones.estado('nimbo').e !== 'nueva' || tuto.t > 40;
    else if (n === 'listo') hecho = tuto.t > 4;
    if (hecho) { tuto.paso++; tuto.t = 0; J.sfx('aviso'); if (tuto.paso >= pasos.length) { UI.tuto(null); tuto = null; G.visto.tuto = true; Guardado.guardar(); } }
  }

  window.__A = { get estudio() { return estudio; }, regalo: () => regaloDelDia(J, UI), efx, estelario, delirio, detalle, Sonido, Modelos, Construir, Pantalla, motor, cielo, get reino() { return reino; }, get yo() { return yo; }, get cerca() { return accionCerca; }, voz, timbre, cuerpoFP, cam, cache, red, remotos, G, J, UI, paso, THREE, empezarJuego, viajar: (id, o) => viajar(id, o), entrarReino, interactuar: (o) => interactuar(o) };
  let ult = performance.now();
  /* el próximo cuadro se pide ANTES de dibujar este: si algo falla, el juego no se congela */
  const bucle = (tt) => {
    requestAnimationFrame(bucle);
    const real = (tt - ult) / 1000; ult = tt; J.dtReal = real;
    if (window.__pausa) return;
    try { paso(Math.min(0.05, real)); } catch (e) { mostrarError(e); }
  };
  if (!Q.has('pausa')) requestAnimationFrame(bucle);
  if (G.opciones.calidad !== 'auto') { midiendo = false; motor.ponerCalidad(G.opciones.calidad); }
  else motor.ponerCalidad(aparato.calidad);
  if (Q.has('calidad')) motor.ponerCalidad(Q.get('calidad'));
  motor.ponerRetro(G.opciones.retro);
  /* cómo pasan las poses de las animaciones: suave, lineal o chop (Opciones › Imagen) */
  Meeple.estiloAnim = ESTILOS_ANIM.includes(G.opciones.animEstilo) ? G.opciones.animEstilo : 'suave';

  /* el camino de pantallas */
  const arrancarAudio = () => { try { Sonido.iniciar(); J.volumen(); } catch { /* sin audio */ } };
  addEventListener('pointerdown', arrancarAudio, { once: true, capture: true });
  addEventListener('keydown', arrancarAudio, { once: true, capture: true });
  if (Q.has('directo')) { if (!G.idioma) ponerIdioma(Q.get('idioma') || 'es'); empezarJuego(Q.get('reino') || 'plaza'); return; }
  const aMenu = () => UI.aviso(() => { arrancarAudio(); UI.menu(); });
  if (!G.idioma) UI.idioma((i) => { G.idioma = i; Guardado.guardar(); aMenu(); });
  else aMenu();
}
iniciar().catch((e) => { console.error(e); fatal(String(e && e.message || e)); });
