/* ============================================================================
   brillo/trailer/tomas.js — graba las tomas del tráiler (TOMAS de guion.js),
   cada una en su WebM vertical de 1080×1920 (VP9, con WebCodecs). Después
   Remotion las corta en planos y las arma (carteles, transiciones, música).

   Todo lo que se ve es el juego de verdad:
   - brillo.html en iframes, con un reloj controlado (grabar.mjs le mete un
     requestAnimationFrame y un performance.now propios), así cada cuadro sale
     exacto aunque esta máquina tarde 400 ms en dibujarlo;
   - Nick juega solo repitiendo los recorridos que encontró el resolvedor
     (pruebas/recorridos/*.json) con la misma física;
   - la escena de la Actualización la actúa el director del juego. Su ventana
     de chat es HTML y no sale en el lienzo: se guarda cuadro a cuadro (textos
     y avatares) para que Remotion la dibuje.
   El recorte es vertical: 540×960 del lienzo del juego (que va a ×3) alrededor
   de Nick, agrandado ×2 sin suavizar: cada píxel del juego son 6×6 exactos.
   Cuadro a cuadro se guarda también dónde quedan Nick y Mora en el video, así
   Remotion puede hacer primeros planos y poner los brillos cerca de ellos.
   También se guarda lo que el juego hizo sonar en cada toma (saltos, gotitas,
   burbujas…) para la mezcla.
   ?idioma=es · ?solo=id,id (esas tomas) · ?muestra=t1,t2 (PNG en esos segundos, sin video) · ?rehacer
   ========================================================================== */
import { MuxerWebM } from './webm.js';
import { ACCIONES, K, entradaDe } from '../pruebas/resolver.mjs';
import { NIVELES } from '../js/niveles.js';
import { crearMundo } from '../js/fisica.js';
import { TEXTOS } from '../js/textos.js';
import { TOMAS, FPS, ANCHO, ALTO, largoDeTomas } from './guion.js';

const q = new URLSearchParams(location.search);
const IDI = TEXTOS[q.get('idioma')] ? q.get('idioma') : 'es';
const W = ANCHO, H = ALTO, DT = 1000 / FPS;
const TX = TEXTOS[IDI];
const log = (...a) => console.log('[tráiler]', ...a);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const salida = document.getElementById('salida');
salida.width = W; salida.height = H;
const g = salida.getContext('2d');
const JUEGOS = document.getElementById('juegos');

/* ============================================================== el juego en un iframe */
let ahoraToma = 0;                        // el segundo de la toma que se está grabando
let sonidos = [];                         // lo que pidió el juego en esta toma: { t, n, o }
const pedir = (n, o) => sonidos.push({ t: +ahoraToma.toFixed(3), n, ...(o && Object.keys(o).length ? { o } : {}) });
const FOCOS = { parejaColina: (t) => ({ x: (255 + 170 - 40 * t) * 3, y: 262 * 3 }) };

class Juego {
  constructor(params) { this.url = '/brillo-reloj.html?' + new URLSearchParams({ ...params, idioma: IDI }); }
  async cargar() {
    const f = this.f = document.createElement('iframe');
    f.src = this.url; JUEGOS.append(f);
    await new Promise((r) => { f.onload = r; });
    this.w = f.contentWindow; this.d = f.contentDocument;
    for (let i = 0; i < 800 && !(this.w.__listo || this.w.__brillo); i++) { this.cuadro(16); await dormir(10); }
    this.c = this.d.getElementById('c');
  }
  cuadro(ms = DT) { this.w.__reloj.cuadro(ms); }
  cerrar() { if (this.f) this.f.remove(); this.f = null; }
}

/* los recorridos del resolvedor, y dónde empieza cada tramo */
const RECORRIDOS = {};
async function recorrido(mundo) {
  if (!RECORRIDOS[mundo]) RECORRIDOS[mundo] = await (await fetch(`../pruebas/recorridos/${mundo}.json`)).json();
  return RECORRIDOS[mundo];
}
/* lo que el juego hace sonar con cada evento (lo mismo que director.evento) */
function oidoDeNivel(N) {
  let combo = 0, ult = -9;
  N.alEvento = (e) => {
    switch (e.t) {
      case 'salto': case 'burbuja': case 'aterriza': case 'hongo': case 'brazada': case 'entra': case 'restaura': case 'muere': case 'revive': case 'guino': case 'sesion': pedir(e.t); break;
      case 'agua': case 'saleAgua': pedir('agua'); break;
      case 'sale': pedir('pop'); break;
      case 'zumbido': pedir('zumbido'); if (e.rotos && e.rotos.length) sonidos.push({ t: +(ahoraToma + 0.09).toFixed(3), n: 'rompe' }); break;
      case 'gota': combo = ahoraToma - ult < 0.7 ? combo + 1 : 0; ult = ahoraToma; pedir('gota', { k: combo }); break;
    }
  };
}

/* ============================================================== las escenas */
/* Nick repite un tramo del resolvedor. desde/hasta en acciones (cada una son K = 6 pasos de física) */
class Recorrido {
  constructor(mundo, tramo, desde = 0) { this.mundo = mundo; this.tramo = tramo; this.desde = desde; }
  async preparar() {
    const sols = await recorrido(this.mundo), acc = sols[this.tramo];
    const m0 = crearMundo(NIVELES[this.mundo]), a = this.tramo.split('>')[0];
    const en = a === 'inicio' ? null : m0.sesiones.find((s) => s.id === a);
    this.J = new Juego({ prueba: 'nivel', nivel: this.mundo, ...(en ? { x: en.x, y: en.y } : {}) });
    await this.J.cargar();
    const N = this.N = this.J.w.__N;
    let paso = 0;
    N.entrada = () => {
      const i = Math.floor(paso / K), f = paso % K; paso++;
      if (i >= acc.length) return { x: 0, y: 0, salto: false, saltoE: false, accion: false, accionE: false };
      return entradaDe(ACCIONES[acc[i]], f, i ? ACCIONES[acc[i - 1]] : null);
    };
    /* hasta donde empieza la toma, sin dibujar; después unos cuadros para que la cámara llegue */
    if (this.desde) this.J.w.__paso(null, this.desde * K);
    N.camara(0, true);
    for (let i = 0; i < 6; i++) this.J.cuadro();
    oidoDeNivel(N);
  }
  cuadro() { this.J.cuadro(); return this.J.c; }
  foco() { const p = this.N.m.p; return seguir(this, focoDe(this.N, p.x, p.y - 14)); }
  actores() { const p = this.N.m.p; return { nick: focoDe(this.N, p.x, p.y - 12) }; }
  cerrar() { this.J.cerrar(); }
}

/* un paisaje del juego con la cámara paseando (el banco ?prueba=fondo) */
class Paisaje {
  constructor(mundo, x = 0, foco = null) { this.mundo = mundo; this.x = x; this.fo = foco; this.t = 0; }
  foco() { return this.fo ? this.fo(this.t) : null; }
  async preparar() { this.J = new Juego({ prueba: 'fondo', mundo: this.mundo, x: this.x, mover: 1 }); await this.J.cargar(); for (let i = 0; i < 3; i++) this.J.cuadro(); this.t = 3 * DT / 1000; }
  cuadro() { this.J.cuadro(); this.t += DT / 1000; return this.J.c; }
  cerrar() { this.J.cerrar(); }
}

/* la Actualización: la actúa el director del juego. Se saltea la narración y la charla del
   principio (ya las cuenta el tráiler) y se graba desde que baja el cuadrado gris hasta que
   Nick dice que va a buscarla. Las charlas se pasan solas cuando la línea está escrita. */
class Actualizacion {
  async preparar() {
    this.J = new Juego({});
    await this.J.cargar();
    const w = this.J.w, d = this.d = w.__brillo;
    /* el idioma: se toca la burbuja del idioma, como haría el jugador */
    for (let i = 0; i < 300 && !this.J.d.querySelector('.burbujaIdioma'); i++) { this.J.cuadro(); await dormir(10); }
    this.J.d.querySelectorAll('.burbujaIdioma')[['es', 'en', 'pt'].indexOf(IDI)].click();
    for (let i = 0; i < 900 && d.estado !== 'titulo'; i++) { this.J.cuadro(); await dormir(15); }
    /* lo que el director hace sonar, para la mezcla */
    const S = w.__Sonido;
    S.sfx = (n, o) => { if (this.grabando) pedir(n, o); };
    S.musica = () => {};
    d.partida = null; d.jugar('colina', null);
    for (let i = 0; i < 900 && !(d.estado === 'jugando' && d.N); i++) { this.J.cuadro(); await dormir(15); }
    /* pasar la narración y la charla del principio, rápido y sin grabar */
    for (let i = 0; i < 2400; i++) {
      this.J.cuadro(100);
      if (d.ui.narrando) d.ui.narrando();
      else if (d.charlaR && d.avanzar) {
        const lineas = this.J.d.querySelectorAll('.chat .linea p');
        const ultima = lineas.length ? lineas[lineas.length - 1].textContent : '';
        if (ultima.includes(TX.charlas.actualizacion[0][1].slice(0, 8))) break;   // llegó la Actualización
        if (d.charlaR.listo) d.avanzar();
      } else if (d.N.actores && d.N.actores.length) break;                      // el cuadrado gris ya bajó
      await dormir(0);
    }
    this.espera = 0; this.linea = '';
    this.grabando = true;
  }
  /* termina cuando Nick ya dijo que va a buscarla y se cerró la charla */
  get termino() { return this.dijo && !this.d.charlaR; }
  cuadro() {
    const d = this.d;
    if (d.charlaR && d.avanzar) {
      const ps = this.J.d.querySelectorAll('.chat .linea p'), p = ps.length ? ps[ps.length - 1].textContent : '';
      if (p !== this.linea) { this.linea = p; this.espera = 0; }
      if (d.charlaR.listo) { this.espera += DT / 1000; if (this.espera > 0.6 + p.length * 0.01) { d.avanzar(); this.espera = 0; } }
      if (p === TX.charlas.solo[0][1]) this.dijo = true;
    }
    if (d.ui.narrando) d.ui.narrando();
    this.J.cuadro();
    return this.J.c;
  }
  chat() { return leerChat(this.J.d); }
  foco() {
    const N = this.d.N; if (!N) return null;
    const p = N.m.p, mora = N.npcs.find((v) => v.id === 'mora' && v.visible !== false);
    const x = mora ? (p.x + mora.x) / 2 : p.x, y = p.y - 30;
    return seguir(this, focoDe(N, x, y));
  }
  actores() {
    const N = this.d.N; if (!N) return {};
    const p = N.m.p, mora = N.npcs.find((v) => v.id === 'mora' && v.visible !== false);
    return { nick: focoDe(N, p.x, p.y - 12), ...(mora ? { mora: focoDe(N, mora.x, mora.y - 12) } : {}) };
  }
  cerrar() { this.J.cerrar(); }
}
function leerChat(doc) {
  const c = doc.querySelector('.chat'); if (!c) return null;
  const barra = c.querySelector('.barra');
  return {
    arriba: c.classList.contains('arriba'), sale: c.classList.contains('sale'), ve: c.classList.contains('ve'),
    nombre: barra.querySelector('b')?.textContent || '', estado: barra.querySelector('small')?.textContent || '', avatar: barra.querySelector('img'),
    escribe: c.querySelector('.escribe')?.textContent || '',
    lineas: [...c.querySelectorAll('.lineas .linea')].map((l) => ({ mia: l.classList.contains('mia'), plana: l.classList.contains('plana'), img: l.querySelector('img'), quien: l.querySelector('b')?.textContent || '', texto: l.querySelector('p')?.textContent || '' })),
  };
}
/* el recorte vertical: 540×960 del lienzo del juego alrededor del foco, agrandado ×2 sin suavizar.
   Devuelve dónde quedó la esquina, para pasar posiciones del juego al video */
const RW = W / 2, RH = H / 2;
function ponerJuego(c, foco = null) {
  const fx = foco ? foco.x : c.width / 2, fy = foco ? foco.y : c.height / 2;
  const sx = Math.round(clamp(fx - RW / 2, 0, c.width - RW)), sy = Math.round(clamp(fy - RH / 2, 0, c.height - RH));
  g.imageSmoothingEnabled = false; g.drawImage(c, sx, sy, RW, RH, 0, 0, W, H);
  return { sx, sy };
}
/* dónde está Nick en el lienzo del juego (para seguirlo con el recorte) */
/* el juego está a escala 3 en un iframe de 1920x1080: un píxel del juego son 3 del lienzo */
function focoDe(N, x, y) { const q = N.aPantalla(x, y); return { x: q.x * 3, y: q.y * 3 }; }
/* el foco se mueve suave, así el recorte no tiembla */
function seguir(esc, f) {
  if (!f) return esc.fs || null;
  if (!esc.fs) esc.fs = { ...f }; else { esc.fs.x += (f.x - esc.fs.x) * 0.12; esc.fs.y += (f.y - esc.fs.y) * 0.12; }
  return esc.fs;
}
/* la viñeta y un velo de luz, igual para todo el tráiler */
/* ============================================================== grabar */
function crearToma(T) {
  if (T.tipo === 'recorrido') return new Recorrido(T.mundo, T.tramo, T.desde || 0);
  if (T.tipo === 'paisaje') return new Paisaje(T.mundo, T.x || 0, T.foco ? FOCOS[T.foco] : null);
  if (T.tipo === 'actualizacion') return new Actualizacion();
  throw new Error('toma desconocida ' + T.tipo);
}
const existe = async (u) => (await fetch(u, { method: 'HEAD' })).ok;
const leerJSON = async (u, si) => ((await existe(u)) ? (await fetch(u)).json() : si);

async function grabarTodo() {
  const solo = q.has('solo') ? q.get('solo').split(',') : null;
  const muestra = q.has('muestra') ? q.get('muestra').split(',').map(Number) : null;
  const rehacer = q.has('rehacer');
  const LARGO = largoDeTomas();
  const PUB = '/brillo/trailer/remotion/public/';
  /* lo de este idioma y lo común: si ya había (por ejemplo con ?solo), se completa */
  const datos = await leerJSON(`${PUB}tomas/${IDI}.json`, { idioma: IDI, medidas: {}, sonidos: {}, chat: {}, avatares: {}, pos: {} });
  const comun = await leerJSON(`${PUB}tomas/comun.json`, { sonidos: {}, pos: {} });
  /* los avatares del chat son data: URI del juego: se guardan una vez cada uno */
  const avIdx = new Map();
  for (const [k, src] of Object.entries(datos.avatares)) avIdx.set(src, k);
  const claveAvatar = (im) => { if (!im || !im.src) return null; let k = avIdx.get(im.src); if (k == null) { k = String(avIdx.size); avIdx.set(im.src, k); datos.avatares[k] = im.src; } return k; };
  for (const [id, T] of Object.entries(TOMAS)) {
    if (solo && !solo.includes(id)) continue;
    if (!LARGO[id]) continue;                                  // ningún plano la usa
    const porIdioma = !!T.porIdioma, carpeta = porIdioma ? IDI : 'comun';
    if (!muestra && !rehacer && !porIdioma && comun.sonidos[id] && await existe(`${PUB}tomas/${carpeta}/${id}.webm`)) { log(`toma ${id}: ya está`); continue; }
    const largo = LARGO[id];
    const esc = crearToma(T);
    await esc.preparar();
    sonidos = [];
    const chat = [], pos = [];
    let mux = null, enc = null;
    if (!muestra) {
      mux = new MuxerWebM({ ancho: W, alto: H }, null);
      enc = new VideoEncoder({ output: (ch) => { const b = new Uint8Array(ch.byteLength); ch.copyTo(b); mux.cuadro(ch.timestamp / 1000, ch.type === 'key', b); }, error: (e) => log('error de video', e.message) });
      enc.configure({ codec: 'vp09.00.40.08', width: W, height: H, bitrate: 14e6, framerate: FPS, latencyMode: 'quality' });
    }
    const t0 = performance.now();
    let n = 0;
    for (; ; n++) {
      const t = n / FPS;
      ahoraToma = t;
      if (t >= largo - 1e-6) break;
      const c = esc.cuadro();
      const r = ponerJuego(c, esc.foco ? esc.foco() : null);
      /* dónde quedaron Nick y Mora en el video (px de 1080×1920) */
      const A = esc.actores ? esc.actores() : {};
      const en = (p) => (p ? [Math.round((p.x - r.sx) * 2), Math.round((p.y - r.sy) * 2)] : null);
      pos.push(A.nick || A.mora ? { nick: en(A.nick), mora: en(A.mora) } : null);
      if (esc.chat) {
        const ch = esc.chat();
        chat.push(ch ? { nombre: ch.nombre, estado: ch.estado, sale: ch.sale, ve: ch.ve, escribe: ch.escribe, avatar: claveAvatar(ch.avatar),
          lineas: ch.lineas.map((l) => ({ mia: l.mia, plana: l.plana, quien: l.quien, texto: l.texto, avatar: claveAvatar(l.img) })) } : null);
      }
      if (muestra) {
        if (muestra.some((m) => Math.abs(m - t) < 0.5 / FPS)) { const b = await new Promise((r) => salida.toBlob(r, 'image/png')); await fetch(`/guardar?nombre=toma-${id}-${t.toFixed(1)}.png`, { method: 'POST', body: b }); }
        if (t > Math.max(...muestra) + 0.1) break;
      } else {
        const vf = new VideoFrame(salida, { timestamp: Math.round(n * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
        enc.encode(vf, { keyFrame: n % FPS === 0 }); vf.close();
        while (enc.encodeQueueSize > 3) await new Promise((r) => enc.addEventListener('dequeue', r, { once: true }));
      }
      if (n % 30 === 0) log(`${id}: cuadro ${n} de ${Math.ceil(largo * FPS)} · ${((performance.now() - t0) / (n + 1)).toFixed(0)} ms por cuadro`);
    }
    if (esc.termino !== undefined) datos.medidas[id] = +(n / FPS).toFixed(3);
    esc.cerrar();
    if (muestra) continue;
    await enc.flush();
    const blob = mux.armar(n * 1000 / FPS);
    await fetch(`/guardar?carpeta=tomas/${carpeta}&nombre=${id}.webm`, { method: 'POST', body: blob });
    if (porIdioma) { datos.sonidos[id] = sonidos; datos.pos[id] = pos; if (chat.length) datos.chat[id] = chat; }
    else { comun.sonidos[id] = sonidos; comun.pos[id] = pos; await fetch('/guardar?carpeta=tomas&nombre=comun.json', { method: 'POST', body: JSON.stringify(comun) }); }
    log(`toma ${id}: ${n} cuadros`);
  }
  if (!muestra) await fetch(`/guardar?carpeta=tomas&nombre=${IDI}.json`, { method: 'POST', body: JSON.stringify(datos) });
  return { ok: true, medidas: datos.medidas };
}

grabarTodo().then((r) => { window.__terminado = r; }).catch((e) => { log('FALLÓ', e && (e.stack || e.message || e)); window.__terminado = { error: String(e && e.message) }; });
