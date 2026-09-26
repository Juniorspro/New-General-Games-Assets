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
let lm = null, ultimo = -1;
self.onmessage = async (e) => {
  const d = e.data;
  if (d.tipo === 'iniciar') {
    try {
      const { FilesetResolver, HandLandmarker } = await import(d.base + '/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks(d.base + '/wasm');
      const op = (delegate) => ({ baseOptions: { modelAssetPath: d.modelo, delegate }, runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
      let delegado = d.delegado;
      try { lm = await HandLandmarker.createFromOptions(fs, delegado === 'GPU' ? { ...op('GPU'), canvas: new OffscreenCanvas(1, 1) } : op('CPU')); }
      catch (err) { delegado = 'CPU'; lm = await HandLandmarker.createFromOptions(fs, op('CPU')); }
      self.postMessage({ tipo: 'listo', delegado });
    } catch (err) { self.postMessage({ tipo: 'error', error: String((err && err.message) || err) }); }
    return;
  }
  if (d.tipo === 'cuadro') {
    if (!lm) { d.imagen.close(); self.postMessage({ tipo: 'manos', n: 0, buf: new Float32Array(0), t: d.t, ms: 0 }); return; }
    const t0 = performance.now(), ts = Math.max(ultimo + 1, Math.round(d.ts)); ultimo = ts;
    let r;
    try { r = lm.detectForVideo(d.imagen, ts); } catch (err) { d.imagen.close(); self.postMessage({ tipo: 'fallo', error: String(err), t: d.t }); return; }
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
    self.postMessage({ tipo: 'manos', n, buf, t: d.t, ms: performance.now() - t0 }, [buf.buffer]);
  }
};`;

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

export class ManosCamara {
  /* alLlegar(manos, t): cada vez que la red devuelve. manos: [{ derecha, puntos: Float32Array(63) en
     metros y en la cámara de three (x derecha, y arriba, z atrás), confianza }] */
  constructor({ alLlegar, avisar, hfov = 66 } = {}) {
    this.alLlegar = alLlegar; this.avisar = avisar;
    this.hfov = hfov;            // el campo de la cámara de atrás, del lado largo (se puede ajustar)
    this.estado = 'apagada';     // apagada · cargando · lista · error
    this.ocupado = false; this.stats = { cuadros: 0, ms: 0, saltados: 0, latencia: 0 };
    this.cfg = { base: MANOS_BASE, modelo: MANOS_MODELO, ...(window.AEROPLAZA_MANOS || {}) };
  }
  /* el worker con MediaPipe (se puede usar sin cámara: probar() le pasa imágenes) */
  async iniciarRed({ delegado = 'GPU', tope = 60000 } = {}) {
    if (this.worker) return this.listo;
    this.estado = 'cargando';
    const url = URL.createObjectURL(new Blob([WORKER()], { type: 'text/javascript' }));
    this.worker = new Worker(url);
    this.listo = new Promise((ok, mal) => {
      const t = setTimeout(() => mal(new Error('la red de las manos tardó demasiado')), tope);
      this.worker.onerror = (e) => { clearTimeout(t); mal(new Error(e.message || 'worker')); };
      this.worker.onmessage = (e) => {
        const d = e.data;
        if (d.tipo === 'listo') { clearTimeout(t); this.estado = 'lista'; this.delegado = d.delegado; this.worker.onmessage = (e2) => this.recibir(e2.data); ok(d.delegado); }
        else if (d.tipo === 'error') { clearTimeout(t); mal(new Error(d.error)); }
      };
    }).catch((e) => { this.estado = 'error'; this.error = e.message; throw e; });
    this.worker.postMessage({ tipo: 'iniciar', base: this.cfg.base, modelo: this.cfg.modelo, delegado });
    return this.listo;
  }
  /* la cámara de atrás, chica y rápida */
  async prender() {
    await this.iniciarRed();
    const stream = this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60, max: 60 } } });
    const v = this.video = document.createElement('video');
    v.playsInline = true; v.muted = true; v.srcObject = stream;
    await v.play();
    this.activa = true; this.pedir();
    return true;
  }
  apagar() {
    this.activa = false;
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null;
    if (this.video) { this.video.srcObject = null; this.video = null; }
  }
  soltar() { this.apagar(); this.worker?.terminate(); this.worker = null; this.estado = 'apagada'; }
  /* cada cuadro nuevo de la cámara (requestVideoFrameCallback: sale justo cuando llega, con la hora
     en que se sacó; si no está, cada 16 ms) */
  pedir() {
    if (!this.activa) return;
    const v = this.video;
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback((ahora, meta) => { this.cuadro(meta?.captureTime ?? meta?.expectedDisplayTime ?? ahora); this.pedir(); });
    else setTimeout(() => { this.cuadro(performance.now()); this.pedir(); }, 16);
  }
  async cuadro(t, fuente = this.video) {
    if (!this.worker || this.estado !== 'lista') return;
    if (this.ocupado) { this.stats.saltados++; return; }
    const w = fuente.videoWidth || fuente.width, h = fuente.videoHeight || fuente.height; if (!w || !h) return;
    this.ocupado = true; this.aspecto = w / h;
    try {
      const imagen = await createImageBitmap(fuente, { resizeWidth: ANCHO_RED, resizeHeight: Math.round(ANCHO_RED * h / w), resizeQuality: 'low' });
      this.worker.postMessage({ tipo: 'cuadro', imagen, ts: t, t }, [imagen]);
    } catch { this.ocupado = false; }
  }
  /* para las pruebas (y para ver si anda sin cámara): una imagen suelta */
  probar(imagen, t = performance.now()) { this.ocupado = false; return this.cuadro(t, imagen); }
  recibir(d) {
    if (d.tipo === 'fallo') { this.ocupado = false; return; }
    if (d.tipo !== 'manos') return;
    this.ocupado = false;
    const S = this.stats; S.cuadros++; S.ms += (d.ms - S.ms) * 0.1; S.latencia += (performance.now() - d.t - S.latencia) * 0.1;
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
    this.alLlegar?.(manos, d.t);
  }
}
