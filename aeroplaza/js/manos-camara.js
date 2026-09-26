/* ============================================================================
   aeroplaza/js/manos-camara.js — las manos por la cámara de atrás del celu
   (la que queda mirando para adelante cuando el celu está en el visor).
   - MediaPipe Hand Landmarker (Google, Apache 2.0) corre en un worker, fuera
     del hilo del juego: el dibujo a 120 no espera a la red neuronal. Se baja
     la primera vez que se prenden las manos (~20 MB, después queda en caché);
     de dónde, lo dice window.AEROPLAZA_MANOS = { base, modelo } si hace falta
     servirlo desde otro lado (TikTok).
   - A la red va una imagen chica (320 de ancho: la mano, en primera persona,
     ocupa un tercio del cuadro) y nunca más de un cuadro a la vez: si está
     ocupada, el cuadro nuevo se saltea. Así no se acumula atraso.
   - Las fotos no pasan por el hilo del juego (que está dibujando a 120): un
     worker lector las toma directo de la cámara (MediaStreamTrackProcessor) y
     se las da a la red que esté libre. Donde no hay, como antes
     (requestVideoFrameCallback + createImageBitmap en el hilo del juego:
     7-23 ms más por foto).
   - Cada red busca UNA mano mientras se ve una sola: con dos, MediaPipe busca
     palmas en cada foto por si aparece la segunda (74 ms por foto contra 38 en
     el contenedor). Cada tanto una red se fija si apareció la otra.
   - De cada mano llegan 21 puntos en la imagen y 21 en metros (la forma, con
     el centro en la mano). La posición en metros se resuelve con los dos: la
     traslación que hace que la forma caiga justo sobre la imagen (mínimos
     cuadrados, 3 incógnitas). Después, al mundo con la cabeza de CUANDO se
     sacó la foto (no la de ahora): así la mano no se arrastra al girar.
   - De cada mano también llega si es la derecha o la izquierda.
   ========================================================================== */
import * as THREE from 'three';

export const MANOS_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1';
export const MANOS_MODELO = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const ANCHO_RED = 320;

/* el worker: se arma como texto (el juego es un solo archivo) */
/* (clásico y con import() adentro: un worker de módulo armado desde un blob no arranca si el juego
   se abre como archivo, porque el origen es "null"; y MediaPipe, en un worker clásico, carga su
   parte de WebAssembly con importScripts) */
const WORKER = () => `
let lm = null, ultimo = -1, cupo = 2, cambio = null, recien = false;
/* d: el mensaje; via: el puerto del lector si vino de ahí (se le avisa cuando queda libre) */
const atender = async (d, via) => {
  if (d.tipo === 'iniciar') {
    try {
      const { FilesetResolver, HandLandmarker } = await import(d.base + '/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks(d.base + '/wasm');
      cupo = d.cupo || 2;
      const op = (delegate) => ({ baseOptions: { modelAssetPath: d.modelo, delegate }, runningMode: 'VIDEO', numHands: cupo,
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4 });
      /* (presencia y seguimiento un poco más tolerantes que lo de fábrica: con 0,5 soltaba la mano
         en cuanto se movía rápido o se ponía de costado, y volver a encontrarla cuesta una foto entera
         de detección de palmas) */
      let delegado = d.delegado;
      try { lm = await HandLandmarker.createFromOptions(fs, delegado === 'GPU' ? { ...op('GPU'), canvas: new OffscreenCanvas(1, 1) } : op('CPU')); }
      catch (err) { delegado = 'CPU'; lm = await HandLandmarker.createFromOptions(fs, op('CPU')); }
      self.postMessage({ tipo: 'listo', delegado });
    } catch (err) { self.postMessage({ tipo: 'error', error: String((err && err.message) || err) }); }
    return;
  }
  /* las fotos que manda el lector llegan por este puerto */
  if (d.tipo === 'puerto') { d.puerto.onmessage = (e) => atender(e.data, d.puerto); return; }
  /* cuántas manos busca: cambiarlo cuesta ~12 ms (y la foto siguiente vuelve a buscar palmas) */
  if (d.tipo === 'cupo') {
    if (!lm || d.n === cupo) return;
    cupo = d.n; recien = true; const n = cupo;
    cambio = (cambio || Promise.resolve()).then(() => lm.setOptions({ numHands: n })).catch(() => {});
    return;
  }
  if (d.tipo === 'cuadro') {
    const libre = () => { if (via) via.postMessage({ tipo: 'libre' }); };
    if (cambio) { const c = cambio; await c; if (cambio === c) cambio = null; }
    if (!lm) { d.imagen.close(); self.postMessage({ tipo: 'manos', n: 0, buf: new Float32Array(0), t: d.t, ms: 0, cupo, lector: !!via, a: d.aspecto }); libre(); return; }
    /* (primera: la primera foto después de cambiar el cupo, que vuelve a buscar palmas: no cuenta para
       medir cuánto tarda la red) */
    const t0 = performance.now(), ts = Math.max(ultimo + 1, Math.round(d.ts)), usado = cupo, primera = recien; ultimo = ts; recien = false;
    let r;
    try { r = lm.detectForVideo(d.imagen, ts); } catch (err) { d.imagen.close(); self.postMessage({ tipo: 'fallo', error: String(err), t: d.t, lector: !!via }); libre(); return; }
    d.imagen.close();
    const n = r.landmarks.length, buf = new Float32Array(n * 128);
    for (let h = 0; h < n; h++) {
      const o = h * 128, L = r.landmarks[h], W = r.worldLandmarks[h], H = r.handedness[h] && r.handedness[h][0];
      for (let i = 0; i < 21; i++) {
        buf[o + i * 3] = L[i].x; buf[o + i * 3 + 1] = L[i].y; buf[o + i * 3 + 2] = L[i].z;
        buf[o + 63 + i * 3] = W[i].x; buf[o + 63 + i * 3 + 1] = W[i].y; buf[o + 63 + i * 3 + 2] = W[i].z;
      }
      buf[o + 126] = H ? (H.categoryName === 'Right' ? 1 : 0) : -1; buf[o + 127] = H ? H.score : 0;
    }
    self.postMessage({ tipo: 'manos', n, buf, t: d.t, ms: performance.now() - t0, cupo: usado, primera, lector: !!via, a: d.aspecto }, [buf.buffer]);
    libre();
  }
};
self.onmessage = (e) => atender(e.data, null);`;

/* el lector: toma las fotos de la cámara (sin el hilo del juego) y se las da a la red libre.
   - La hora de cada foto viene en otro reloj (el de la cámara): se pasa al del juego con lo que dice
     el juego (offset, calibrado con captureTime) o, mientras tanto, con cuándo llegó la más rápida.
   - Sin manos a la vista hace un segundo (quieta), una foto sí y una no, y solo a la primera red */
const LECTOR = () => `
let redes = [], offset = null, origen = 0, quieta = false, n = 0, offMin = Infinity, primero = 0;
const ultimos = [], S = { leidos: 0, saltados: 0, ahorrados: 0 };
self.onmessage = (e) => {
  const d = e.data;
  if (d.tipo === 'iniciar') { origen = d.origen; leer(d.readable.getReader(), d.ancho); }
  else if (d.tipo === 'red') { const r = { puerto: d.puerto, ocupado: false, apagada: false }; d.puerto.onmessage = (ev) => { if (ev.data.tipo === 'libre') r.ocupado = false; }; redes[d.i] = r; }
  else if (d.tipo === 'reloj') offset = d.offset;
  else if (d.tipo === 'estado') { quieta = d.quieta; primero = d.primero || 0; (d.apagadas || []).forEach((a, i) => { if (redes[i]) redes[i].apagada = a; }); }
};
async function leer(rd, ancho) {
  for (;;) {
    let f;
    try { const r = await rd.read(); if (r.done) break; f = r.value; } catch (err) { break; }
    const ts = f.timestamp / 1000, llega = performance.timeOrigin + performance.now() - origen;
    S.leidos++; offMin = Math.min(offMin, llega - ts);
    ultimos.push(ts); if (ultimos.length > 12) ultimos.shift();
    const w = f.displayWidth, h = f.displayHeight;
    if (S.leidos % 15 === 1) self.postMessage({ tipo: 'ts', ts: ultimos.slice(), offMin, leidos: S.leidos, saltados: S.saltados, ahorrados: S.ahorrados, ancho: w, alto: h });
    if (quieta && (n++ & 1)) { S.ahorrados++; f.close(); continue; }
    /* (primero: la red que está buscando la segunda mano, si está libre; si no, la primera libre) */
    const puede = (x, k) => x && !x.ocupado && !x.apagada && (k === 0 || !quieta);
    const i = puede(redes[primero], primero) ? primero : redes.findIndex(puede);
    if (i < 0) { S.saltados++; f.close(); continue; }
    const r = redes[i], t = ts + (offset ?? offMin); r.ocupado = true;
    try {
      const imagen = await createImageBitmap(f, { resizeWidth: ancho, resizeHeight: Math.round(ancho * h / w), resizeQuality: 'low' });
      r.puerto.postMessage({ tipo: 'cuadro', imagen, ts: t, t, aspecto: w / h }, [imagen]);
    } catch (err) { r.ocupado = false; }
    f.close();
  }
  self.postMessage({ tipo: 'fin' });
}`;

/* la traslación T (metros, cámara con x a la derecha, y abajo, z adelante) que hace que la forma W
   (21 puntos alrededor del centro de la mano) caiga sobre la imagen: x/z = a, y/z = b.
   Cada punto da dos ecuaciones lineales: Tx − a·Tz = a·Wz − Wx y Ty − b·Tz = b·Wz − Wy */
export function trasladar(img, mundo, tanX, tanY, o = 0, oW = 63) {
  let n = 0, sa = 0, sb = 0, s2 = 0, r1 = 0, r2 = 0, r3 = 0;
  for (let i = 0; i < 21; i++) {
    const a = (img[o + i * 3] - 0.5) * 2 * tanX, b = (img[o + i * 3 + 1] - 0.5) * 2 * tanY;
    const wx = mundo[oW + i * 3], wy = mundo[oW + i * 3 + 1], wz = mundo[oW + i * 3 + 2];
    const e1 = a * wz - wx, e2 = b * wz - wy;
    n++; sa += a; sb += b; s2 += a * a + b * b; r1 += e1; r2 += e2; r3 -= a * e1 + b * e2;
  }
  /* A^T·A = [[n,0,-sa],[0,n,-sb],[-sa,-sb,s2]]; se resuelve con Cramer (3x3) */
  const m = [n, 0, -sa, 0, n, -sb, -sa, -sb, s2];
  const det = (M) => M[0] * (M[4] * M[8] - M[5] * M[7]) - M[1] * (M[3] * M[8] - M[5] * M[6]) + M[2] * (M[3] * M[7] - M[4] * M[6]);
  const D = det(m); if (Math.abs(D) < 1e-9) return null;
  const col = (k, v) => { const M = m.slice(); M[k] = v[0]; M[k + 3] = v[1]; M[k + 6] = v[2]; return M; };
  const R = [r1, r2, r3];
  return [det(col(0, R)) / D, det(col(1, R)) / D, det(col(2, R)) / D];
}

/* cuándo se sacó la foto: captureTime si lo da y tiene sentido (en algunos navegadores falta o viene
   en otro reloj); si no, cuándo se mostró; si no, ahora */
function horaFoto(meta) {
  const ahora = performance.now(), ok = (x) => typeof x === 'number' && ahora - x >= 0 && ahora - x < 600;
  return ok(meta?.captureTime) ? meta.captureTime : ok(meta?.presentationTime) ? meta.presentationTime : ahora;
}

export class ManosCamara {
  /* alLlegar(manos, t): cada vez que la red devuelve. manos: [{ derecha, puntos: Float32Array(63) en
     metros y en la cámara de three (x derecha, y arriba, z atrás), confianza }] */
  constructor({ alLlegar, avisar, hfov = 66 } = {}) {
    this.alLlegar = alLlegar; this.avisar = avisar;
    this.hfov = hfov;            // el campo de la cámara de atrás, del lado largo (se puede ajustar)
    this.estado = 'apagada';     // apagada · cargando · lista · error
    this.stats = { cuadros: 0, ms: 0, saltados: 0, latencia: 0, ahorrados: 0, tarde: 0 };
    this.ultimaT = -1e9; this.redes = null; this.listo = null;
    this.lector = null; this.directo = false;   // (las fotos directo de la cámara al worker lector)
    this.vistas = { una: -1e9, dos: -1e9, prueba: -1e9, desde: -1e9 };   // cuándo se vio una mano, dos, y la última vez que se buscó la segunda
    this.tMano = -1e9; this.nCuadro = 0; this.flash = false; this.activa = false;
    this.cfg = { base: MANOS_BASE, modelo: MANOS_MODELO, ...(window.AEROPLAZA_MANOS || {}) };
  }
  /* los workers con MediaPipe (se pueden usar sin cámara: probar() le pasa imágenes)
     (en CPU: en el worker va en otro núcleo y no le saca tiempo a la placa, que está dibujando a
     120; con la GPU la red era más rápida pero se peleaba con el dibujo)
     DOS redes a la par si el celu tiene 6 núcleos o más: una lee una foto y la otra la siguiente. Una
     sola lee 14-20 por segundo (tarda más que lo que tarda la cámara en dar la próxima); dos, casi
     todas. Simulado (pruebas/manos-celu.mjs): el atraso baja un 18 %, tiembla menos y no titila. Sin
     manos a la vista trabaja una sola */
  async iniciarRed({ delegado = 'CPU', tope = 60000, dos = null } = {}) {
    if (this.listo) return this.listo;
    this.estado = 'cargando'; this.redes = [];
    this.url ||= URL.createObjectURL(new Blob([WORKER()], { type: 'text/javascript' }));
    this.listo = this.nuevaRed(delegado, tope).then((r) => {
      this.worker = r.w; this.estado = 'lista'; this.delegado = r.delegado;
      /* (la segunda después, con los archivos ya en la caché; si no arranca, queda una) */
      if (dos ?? (navigator.hardwareConcurrency || 4) >= 6) this.nuevaRed(r.delegado, tope).catch(() => {});
      return r.delegado;
    }).catch((e) => { this.estado = 'error'; this.error = e.message; throw e; });
    return this.listo;
  }
  nuevaRed(delegado, tope) {
    const w = new Worker(this.url), red = { w, ocupado: false };
    return new Promise((ok, mal) => {
      const t = setTimeout(() => { w.terminate(); mal(new Error('la red de las manos tardó demasiado')); }, tope);
      w.onerror = (e) => { clearTimeout(t); w.terminate(); mal(new Error(e.message || 'worker')); };
      w.onmessage = (e) => {
        const d = e.data;
        if (d.tipo === 'listo') { clearTimeout(t); if (!this.redes) { w.terminate(); return; } red.cupo = 2; this.redes.push(red); w.onmessage = (e2) => this.recibir(e2.data, red); if (this.lector) this.conectar(red); ok({ w, delegado: d.delegado }); }
        else if (d.tipo === 'error') { clearTimeout(t); w.terminate(); mal(new Error(d.error)); }
      };
      w.postMessage({ tipo: 'iniciar', base: this.cfg.base, modelo: this.cfg.modelo, delegado, cupo: 2 });
    });
  }
  /* un canal directo entre el lector y una red (las fotos no pasan por el hilo del juego) */
  conectar(red) {
    const ch = new MessageChannel(), i = this.redes.indexOf(red);
    this.lector.postMessage({ tipo: 'red', i, puerto: ch.port1 }, [ch.port1]);
    red.w.postMessage({ tipo: 'puerto', puerto: ch.port2 }, [ch.port2]);
    this.avisarLector();
  }
  /* el lector: si el navegador deja pasar la cámara a un worker (Chrome, Edge, Samsung Internet) */
  abrirLector() {
    if (typeof MediaStreamTrackProcessor !== 'function' || this.cfg.sinLector) return false;
    try {
      const tr = this.stream.getVideoTracks()[0], p = new MediaStreamTrackProcessor({ track: tr });
      this.urlLector ||= URL.createObjectURL(new Blob([LECTOR()], { type: 'text/javascript' }));
      const L = this.lector = new Worker(this.urlLector);
      L.onmessage = (e) => this.delLector(e.data);
      L.postMessage({ tipo: 'iniciar', readable: p.readable, origen: performance.timeOrigin, ancho: ANCHO_RED }, [p.readable]);
      this.directo = true; this.reloj = null; this.caps = [];
      for (const r of this.redes || []) this.conectar(r);
      this.medirReloj();
      return true;
    } catch (err) { this.lector?.terminate(); this.lector = null; this.directo = false; return false; }
  }
  /* el reloj de las fotos del lector es el de la cámara: se calibra contra captureTime, que da el
     video en el reloj del juego. La misma foto tiene la misma diferencia entre los dos (medido: 39
     de 40 fotos, ±0,2 ms); se busca esa diferencia repetida entre todos los pares */
  medirReloj() {
    const v = this.video;
    if (!v?.requestVideoFrameCallback) return;
    const f = (ahora, meta) => {
      if (!this.directo || this.video !== v) return;
      if (typeof meta?.captureTime === 'number') { this.caps.push(meta.captureTime); if (this.caps.length > 20) this.caps.shift(); }
      if (!this.reloj) v.requestVideoFrameCallback(f);
    };
    v.requestVideoFrameCallback(f);
  }
  delLector(d) {
    if (d.tipo === 'fin') { this.lector?.terminate(); this.lector = null; this.directo = false; return; }
    if (d.tipo !== 'ts') return;
    this.aspecto = d.ancho / d.alto;
    Object.assign(this.stats, { leidos: d.leidos, saltadosLector: d.saltados, ahorradosLector: d.ahorrados });
    this.stats.offMin = d.offMin;   // (ya en el reloj del juego: el lector le resta el origen)
    if (this.reloj || this.caps.length < 6) return;
    const difs = [];
    for (const c of this.caps) for (const t of d.ts) difs.push(c - t);
    difs.sort((x, y) => x - y);
    /* (la misma foto da la misma diferencia, al microsegundo; de fotos distintas, parecida pero con el
       temblor del intervalo: ventana de 0,05 ms. Si hay dos iguales de buenas, la más cerca de la
       llegada: una foto corrida da 33 ms de error) */
    const grupos = [];
    for (let i = 0, j = 0; i < difs.length; i++) { while (j + 1 < difs.length && difs[j + 1] - difs[i] < 0.05) j++; grupos.push({ n: j - i + 1, v: difs[(i + j) >> 1] }); }
    const max = Math.max(0, ...grupos.map((g) => g.n)), lim = this.stats.offMin + 1;
    const buenos = grupos.filter((g) => g.n >= Math.max(8, max - 1) && g.v <= lim).sort((a, b) => Math.abs(a.v - lim) - Math.abs(b.v - lim));
    if (buenos.length) { this.reloj = buenos[0].v; this.lector.postMessage({ tipo: 'reloj', offset: this.reloj }); }
  }
  /* lo que el lector tiene que saber: si no hay manos a la vista, y qué redes están apagadas */
  avisarLector() { this.lector?.postMessage({ tipo: 'estado', quieta: this.quieta, primero: this.primero || 0, apagadas: (this.redes || []).map((r) => !!r.apagada) }); }
  /* la cámara de atrás, chica y rápida */
  async prender() {
    await this.iniciarRed();
    await this.abrirCamara();
    this.activa = true;
    if (!this.lector && !this.abrirLector()) this.pedir();
    return true;
  }
  async abrirCamara() {
    if (this.stream) return this.stream;
    if (this._abriendo) return this._abriendo;
    this._abriendo = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60, max: 60 } } });
      const v = this.video = document.createElement('video');
      v.playsInline = true; v.muted = true; v.srcObject = stream;
      /* en la página, chiquito y casi transparente: un video suelto (fuera del documento) en algunos
         celus deja de dar cuadros o los da de a saltos, y la mano se cortaba */
      v.setAttribute('aria-hidden', 'true');
      Object.assign(v.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
      document.body.appendChild(v);
      await v.play();
      this.stream = stream; this.fpsCamara = stream.getVideoTracks()[0]?.getSettings?.().frameRate || 30;
      return stream;
    })();
    try { return await this._abriendo; } finally { this._abriendo = null; }
  }
  cerrarCamara() {
    this.lector?.terminate(); this.lector = null; this.directo = false;
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; this.flash = false;
    if (this.video) { this.video.srcObject = null; this.video.remove(); this.video = null; }
  }
  /* sin manos; la cámara queda si el flash está prendido. todo: también el flash (al salir del VR) */
  apagar({ todo = false } = {}) {
    this.activa = false;
    if (todo || !this.flash) this.cerrarCamara();
    /* (con el flash la cámara sigue abierta: el lector deja de mandar fotos) */
    else { this.lector?.terminate(); this.lector = null; this.directo = false; }
  }
  /* el flash de la cámara de atrás (la linterna): alumbra las manos en un lugar oscuro, donde la red
     casi no las ve. Anda con las manos o sin ellas (abre la cámara solo para eso). Devuelve si quedó
     prendido; 'no' si el celu no deja (iOS, y los que no dicen torch en sus capacidades) */
  async linterna(prender) {
    if (!prender) {
      const tr = this.stream?.getVideoTracks()[0];
      try { if (tr && this.flash) await tr.applyConstraints({ advanced: [{ torch: false }] }); } catch { /* ya está */ }
      this.flash = false;
      if (!this.activa) this.cerrarCamara();
      return false;
    }
    await this.abrirCamara();
    const tr = this.stream.getVideoTracks()[0], caps = tr.getCapabilities?.() || {};
    if (!caps.torch) { if (!this.activa) this.cerrarCamara(); return 'no'; }
    await tr.applyConstraints({ advanced: [{ torch: true }] });
    this.flash = tr.getSettings?.().torch !== false;
    if (!this.flash && !this.activa) this.cerrarCamara();
    return this.flash || 'no';
  }
  soltar() { this.apagar({ todo: true }); for (const r of this.redes || []) r.w.terminate(); this.redes = null; this.worker = null; this.listo = null; this.estado = 'apagada'; }
  /* cada cuadro nuevo de la cámara (requestVideoFrameCallback: sale justo cuando llega, con la hora
     en que se sacó; si no está, cada 16 ms) */
  pedir() {
    if (!this.activa) return;
    const v = this.video;
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback((ahora, meta) => { this.nuevo(horaFoto(meta)); this.pedir(); });
    else setTimeout(() => { this.nuevo(performance.now()); this.pedir(); }, 16);
  }
  /* un cuadro nuevo de la cámara. Sin manos a la vista hace más de un segundo, va a la red uno sí y
     uno no: buscar palmas es lo más caro, y así el celu no se calienta (y no baja de 120) */
  nuevo(t) {
    if (performance.now() - this.tMano > 1000 && (this.nCuadro++ & 1)) { this.stats.ahorrados++; return; }
    this.cuadro(t);
  }
  async cuadro(t, fuente = this.video, soloPrimera = false) {
    if (this.estado !== 'lista' || !this.redes?.length) return;
    /* la primera red libre (sin manos a la vista, solo la primera) */
    const quieta = soloPrimera || performance.now() - this.tMano > 1000;
    const red = this.redes.find((r, i) => !r.ocupado && !r.apagada && (i === 0 || !quieta));
    if (!red) { this.stats.saltados++; return; }
    const w = fuente.videoWidth || fuente.width, h = fuente.videoHeight || fuente.height; if (!w || !h) return;
    red.ocupado = true; this.aspecto = w / h;
    try {
      const imagen = await createImageBitmap(fuente, { resizeWidth: ANCHO_RED, resizeHeight: Math.round(ANCHO_RED * h / w), resizeQuality: 'low' });
      red.w.postMessage({ tipo: 'cuadro', imagen, ts: t, t }, [imagen]);
    } catch { red.ocupado = false; }
  }
  /* ¿las dos redes le convienen a este celu? Cada red lleva lo que tarda por foto (aparte buscando
     una mano y dos: una tarda la mitad). Si con las dos la primera se pone mucho más lenta que cuando
     estaba sola (se pelean por los núcleos buenos), o si la segunda tarda mucho más que la primera
     (le tocó un núcleo lento), la segunda se apaga: cada foto llegaría más vieja y la mano se vería
     más atrasada */
  medirRedes(red, ms, cupo = 2, manos = 0) {
    if (!red || !(ms > 0)) return;
    /* (siempre con el mismo trabajo: cuántas manos buscaba y cuántas encontró. Sin manos, solo busca
       palmas; con una, palmas y dedos: comparar una cosa con la otra apagaba la segunda sin razón) */
    const k = cupo + ':' + Math.min(2, manos), M = red.med ||= {}, x = M[k] ||= { n: 0, ms: 0 };
    x.n++; x.ms = x.n > 1 ? x.ms + (ms - x.ms) * 0.1 : ms;
    red[cupo > 1 ? 'ms2' : 'ms1'] = x.ms;
    const [a, b] = this.redes || [];
    if (red === a && !b) { const so = (a.sola ||= {})[k] ||= { n: 0, ms: 0 }; so.n++; so.ms = so.n > 1 ? so.ms + (ms - so.ms) * 0.1 : ms; }
    if (!a || !b || b.apagada) return;
    const A = a.med?.[k], B = b.med?.[k], S = a.sola?.[k];
    if (!A || !B || A.n < 15 || B.n < 15) return;
    if ((S && S.n >= 10 && A.ms > S.ms * 1.35) || B.ms > A.ms * 1.5) { b.apagada = true; this.stats.segundaApagada = k; this.avisarLector(); }
  }
  /* cuántas manos busca cada red. Con una sola a la vista, la primera busca una (la mitad de tiempo
     por foto). Por si aparece la otra:
     - con dos redes, si la primera sola alcanza a leer todas las fotos de la cámara, la segunda queda
       buscando dos (sin cambiar, que cuesta una foto lenta) y cada 350 ms recibe una foto antes que
       la primera; si no alcanza, las dos siguen la mano a la par (el doble de fotos) y cada 700 ms
       la segunda busca dos en una foto;
     - con una sola red, cada 1,2 s busca dos en una foto y vuelve.
     Con dos a la vista, o con ninguna, todas buscan dos */
  elegirCupos(d, red, llego) {
    if (this.cfg.siempreDos) return;   // (como antes: para comparar en las pruebas)
    const V = this.vistas, redes = (this.redes || []).filter((r) => !r.apagada);
    if (d.n >= 1) V.una = llego;
    if (d.n >= 2) V.dos = llego;
    const hay = llego - V.dos < 500 ? 2 : llego - V.una < 800 ? 1 : 0;
    if (hay !== this.hay) V.desde = llego;
    this.hay = hay;
    /* (recién aparecida una mano, un rato más buscando dos: la otra suele aparecer junto, y si en la
       primera foto no salió, sin esto quedaba esperando a que alguna red la buscara) */
    const una = hay === 1 && llego - V.desde > 400, dos = redes.length > 1, busca = redes[dos ? 1 : 0];
    const m1 = redes[0]?.med?.['1:1'], fps = this.fpsCamara || 30;
    const sobra = dos && !!m1 && m1.n >= 10 && m1.ms < 850 / fps;
    if (!una) { for (const r of redes) r.probando = false; }
    else if (busca) {
      if (busca.probando && red === busca && (sobra || d.cupo === 2)) { busca.probando = false; V.prueba = llego; }
      else if (!busca.probando && llego - V.prueba > (sobra ? 350 : dos ? 700 : 1200)) busca.probando = true;
    }
    for (const r of redes) {
      const c = !una ? 2 : r !== busca ? 1 : sobra || r.probando ? 2 : 1;
      if (r.cupo !== c) { r.cupo = c; r.w.postMessage({ tipo: 'cupo', n: c }); }
    }
    /* (la que busca, primera en recibir foto: si no, con la otra rápida no le llegaba ninguna) */
    const primero = una && busca?.probando ? this.redes.indexOf(busca) : 0;
    if (primero !== (this.primero || 0)) { this.primero = primero; this.avisarLector(); }
  }
  /* lo que se muestra con los cuadros por segundo: fotos por segundo y atraso de las manos */
  datos() {
    const S = this.stats, ahora = performance.now();
    if (!this._d || ahora - this._d.t > 1000) { const porSeg = this._d ? (S.cuadros - this._d.n) / ((ahora - this._d.t) / 1000) : 0; this._d = { t: ahora, n: S.cuadros, porSeg }; }
    const redes = (this.redes || []).filter((r) => !r.apagada), r0 = redes[0], ms = r0?.ms1 && this.hay === 1 ? r0.ms1 : S.ms;
    const fps = this.stream?.getVideoTracks()[0]?.getSettings?.().frameRate;
    return `✋ ${Math.round(this._d.porSeg)}/s · ${Math.round(S.latencia)} ms · ${Math.round(ms)} ms/red ×${redes.length}${fps ? ` · 📷${Math.round(fps)}` : ''}${this.directo ? '⚡' : ''}`;
  }
  /* para las pruebas (y para ver si anda sin cámara): una imagen suelta, a la primera red */
  probar(imagen, t = performance.now()) { if (this.redes?.[0]) this.redes[0].ocupado = false; return this.cuadro(t, imagen, true); }
  recibir(d, red) {
    if (red && !d.lector) red.ocupado = false;
    if (d.tipo !== 'manos') return;
    if (!d.primera) this.medirRedes(red, d.ms, d.cupo, d.n);
    if (d.a) this.aspecto = d.a;
    /* (con dos redes, una foto puede volver después que la siguiente: sirve para la mano que la otra
       no buscaba; manos.js se fija mano por mano) */
    if (d.t < this.ultimaT) this.stats.tarde++;
    this.ultimaT = Math.max(this.ultimaT, d.t);
    const llego = performance.now();
    const S = this.stats; S.cuadros++; if (!d.primera) S.ms += (d.ms - S.ms) * 0.1; S.latencia += (llego - d.t - S.latencia) * 0.1;
    if (d.n) this.tMano = llego;
    if (this.activa) this.elegirCupos(d, red, llego);
    const quieta = llego - this.tMano > 1000;
    if (quieta !== this.quieta) { this.quieta = quieta; this.avisarLector(); }
    /* el campo es el del lado largo del cuadro (con el juego girado, el video llega parado) */
    const asp = this.aspecto || 4 / 3, largo = Math.tan(THREE.MathUtils.degToRad(this.hfov) / 2);
    const manos = [], tanX = asp >= 1 ? largo : largo * asp, tanY = asp >= 1 ? largo / asp : largo;
    for (let k = 0; k < d.n; k++) {
      const o = k * 128, T = trasladar(d.buf, d.buf, tanX, tanY, o, o + 63); if (!T) continue;
      const P = new Float32Array(63);
      /* de la cámara (x derecha, y abajo, z adelante) a la de three (y arriba, z atrás) */
      for (let i = 0; i < 21; i++) {
        P[i * 3] = d.buf[o + 63 + i * 3] + T[0];
        P[i * 3 + 1] = -(d.buf[o + 63 + i * 3 + 1] + T[1]);
        P[i * 3 + 2] = -(d.buf[o + 63 + i * 3 + 2] + T[2]);
      }
      /* (MediaPipe dice que nombra las manos como en un espejo, pero en primera persona, con la
         cámara de atrás, acierta tal cual: medido con las tres fotos de pruebas/manos, de dorso y de
         palma) */
      const et = d.buf[o + 126];
      manos.push({ derecha: et < 0 ? null : et > 0.5, puntos: P, confianza: d.buf[o + 127], img: d.buf.slice(o, o + 63) });
    }
    this.alLlegar?.(manos, d.t, llego, d.cupo ?? 2);
  }
}
