/* ============================================================================
   aeroplaza/js/voz.js — el chat de voz por cercanía, con WebRTC.
   - El botón 🎤 lo prende: ahí el navegador pide el micrófono (getUserMedia,
     con cancelación de eco y de ruido). Si no dan permiso (o la vista no lo
     deja, como el visor de artefactos), igual se escucha a los de cerca.
   - Cada jugador avisa en su estado si está en la voz (voz: 1 con micrófono,
     2 solo escuchando). Con quien está en la voz y a menos de 12 m se abre una
     conexión directa; a más de 18 m se corta (el margen evita que titile).
   - No hay servidor: la oferta y la respuesta viajan por la sala MQTT como
     una acción más ({ type: 'rtc', targetId, k, sdp }). Se manda la
     descripción entera, con los candidatos ya juntados (sin goteo), así son
     dos mensajes por pareja. Abre siempre el de id más chico: nunca los dos a
     la vez. Para cruzar redes se usan los STUN públicos de Google; sin TURN,
     algunas redes muy cerradas no llegan a conectar.
   - El sonido de cada uno pasa por un PannerNode (HRTF) puesto donde está su
     muñeco: se oye de su lado y baja con la distancia (entero a 2 m, nada a
     14 m). El oído es la cabeza propia, mirando para donde mira la cámara.
   - Chrome no deja pasar a Web Audio un audio de WebRTC si no está también en
     un <audio> (silenciado): por eso cada pareja tiene uno.
   ========================================================================== */
import * as THREE from 'three';
import { sumar } from './textos.js';
import { Sonido } from '../../brillo/js/sonido.js';

sumar({
  es: { voz_pide: 'Pedí permiso para el micrófono…', voz_si: 'Chat de voz prendido: te escuchan los que están cerca', voz_no: 'Chat de voz apagado', voz_denegada: 'Sin permiso para el micrófono: igual escuchás a los de cerca', voz_sin: 'Acá no se puede usar el micrófono (probá con el HTML suelto)', voz_cerca: '{n} está en la voz, cerca tuyo', op_voz: 'Voces' },
  en: { voz_pide: 'Asking for the microphone…', voz_si: 'Voice chat on: people nearby can hear you', voz_no: 'Voice chat off', voz_denegada: 'No microphone permission: you can still hear people nearby', voz_sin: 'The microphone is not available here (try the standalone HTML)', voz_cerca: '{n} is on voice, near you', op_voz: 'Voices' },
  pt: { voz_pide: 'Pedindo o microfone…', voz_si: 'Chat de voz ligado: quem está perto te escuta', voz_no: 'Chat de voz desligado', voz_denegada: 'Sem permissão para o microfone: você ainda escuta quem está perto', voz_sin: 'Aqui não dá para usar o microfone (tente o HTML avulso)', voz_cerca: '{n} está na voz, perto de você', op_voz: 'Vozes' },
});

export const CONECTA = 12, CORTA = 18, CERCA = 2, LEJOS = 14;
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
/* se manda la descripción cuando ya juntó los candidatos (o a los 2 s, con lo que haya) */
const juntarIce = (pc, ms = 2000) => new Promise((ok) => {
  if (pc.iceGatheringState === 'complete') { ok(); return; }
  const f = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', f); ok(); } };
  pc.addEventListener('icegatheringstatechange', f); setTimeout(ok, ms);
});
const ponerPos = (n, x, y, z) => { if (n.positionX) { n.positionX.value = x; n.positionY.value = y; n.positionZ.value = z; } else n.setPosition(x, y, z); };
/* el cartelito 🔊 arriba de la cabeza de quien habla */
let texParlante = null;
function parlante() {
  if (!texParlante) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(52, 44, 6, 64, 64, 60); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#c8f4ff'); gr.addColorStop(1, '#39b8f0');
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
    g.font = '64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🔊', 64, 70);
    texParlante = new THREE.CanvasTexture(c); texParlante.colorSpace = THREE.SRGBColorSpace;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texParlante, depthTest: false, transparent: true }));
  s.scale.setScalar(0.42); s.renderOrder = 9; s.visible = false; return s;
}

export class Voz {
  constructor(red) {
    this.red = red; this.activa = false; this.mic = null; this.estado = 'apagada';
    this.pares = new Map(); this.espera = new Map();   // id → cuándo se puede volver a intentar
    this.volumen = 1; this.nivel = 0; this.bus = null;
    this.alCambiar = () => {}; this.alConectar = () => {};
  }
  get soporte() { return typeof window.RTCPeerConnection === 'function'; }
  /* 1 con micrófono, 2 solo escuchando, 0 afuera (va en el estado de la red) */
  get marca() { return !this.activa ? 0 : this.mic ? 1 : 2; }
  cambiar(e) { this.estado = e; this.alCambiar(e); }
  async prender() {
    if (this.activa) return this.estado;
    if (!this.soporte) { this.cambiar('sin'); return 'sin'; }
    try { Sonido.iniciar(); } catch { /* sin audio */ }
    this.cambiar('pidiendo');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('sin getUserMedia'), { name: 'NotSupportedError' });
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.medirMic();
      this.activa = true; this.cambiar('activa');
    } catch (e) {
      this.mic = null; this.error = e?.name || String(e);
      this.activa = true; this.cambiar('escucha');
    }
    return this.estado;
  }
  apagar() {
    for (const id of [...this.pares.keys()]) this.cerrar(id, true);
    if (this.mic) for (const tr of this.mic.getTracks()) tr.stop();
    this.mic = null; this.anMic = null; this.activa = false; this.espera.clear(); this.cambiar('apagada');
  }
  ponerVolumen(v) { this.volumen = v; if (this.bus) this.bus.gain.value = v; }
  /* el nivel del micrófono propio (para que el botón muestre que se te escucha) */
  medirMic() {
    const c = Sonido.ctx; if (!c || !this.mic) return;
    this.anMic = c.createAnalyser(); this.anMic.fftSize = 512; this.bufMic = new Float32Array(512);
    c.createMediaStreamSource(this.mic).connect(this.anMic);
  }
  salida(c) { if (!this.bus) { this.bus = c.createGain(); this.bus.gain.value = this.volumen; this.bus.connect(c.destination); } return this.bus; }

  /* ------------------------------------------------------------ las parejas */
  crearPar(id) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    if (this.mic) for (const tr of this.mic.getAudioTracks()) pc.addTrack(tr, this.mic);
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    const P = { id, pc, t0: performance.now(), nivel: 0, conectada: false };
    pc.ontrack = (ev) => this.conectarAudio(P, ev.streams[0] || new MediaStream([ev.track]));
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && !P.conectada) { P.conectada = true; this.alConectar(id); }
      if (pc.connectionState === 'failed') { this.cerrar(id, true); this.espera.set(id, performance.now() + 8000); }
    };
    this.pares.set(id, P);
    return P;
  }
  conectarAudio(P, stream) {
    const c = Sonido.ctx;
    P.el = new Audio(); P.el.srcObject = stream; P.el.muted = !!c; P.el.play().catch(() => {});
    if (!c) return;   // sin Web Audio: suena por el <audio>, sin ubicar
    P.fuente = c.createMediaStreamSource(stream);
    P.g = c.createGain(); P.g.gain.value = 0;
    P.pan = c.createPanner(); P.pan.panningModel = 'HRTF'; P.pan.distanceModel = 'linear'; P.pan.refDistance = CERCA; P.pan.maxDistance = LEJOS; P.pan.rolloffFactor = 1;
    P.an = c.createAnalyser(); P.an.fftSize = 512; P.buf = new Float32Array(512);
    P.fuente.connect(P.an); P.fuente.connect(P.g); P.g.connect(P.pan); P.pan.connect(this.salida(c));
  }
  async llamar(id) {
    const P = this.crearPar(id);
    try {
      await P.pc.setLocalDescription(await P.pc.createOffer());
      await juntarIce(P.pc);
      if (this.pares.get(id) === P) this.enviar(id, 'oferta', P.pc.localDescription.sdp);
    } catch (e) { console.warn('voz: oferta', e); this.cerrar(id, false); }
  }
  enviar(id, k, sdp = '') { this.red.accion({ type: 'rtc', targetId: id, k, sdp }); }
  cerrar(id, avisar) {
    const P = this.pares.get(id); if (!P) return;
    this.pares.delete(id);
    try { P.pc.close(); } catch { /* ya cerrada */ }
    if (P.el) { P.el.srcObject = null; }
    try { P.fuente?.disconnect(); P.pan?.disconnect(); } catch { /* nada */ }
    if (P.icono) P.icono.removeFromParent();
    if (avisar) this.enviar(id, 'chau');
  }
  /* lo que llega por la sala (ya validado que es para mí en main.js) */
  async recibir(a) {
    if (!this.activa || a.targetId !== this.red.id || typeof a.id !== 'string') return;
    const sdp = typeof a.sdp === 'string' && a.sdp.length < 40000 ? a.sdp : '';
    try {
      if (a.k === 'oferta' && sdp) {
        if (this.pares.has(a.id)) this.cerrar(a.id, false);
        const P = this.crearPar(a.id);
        await P.pc.setRemoteDescription({ type: 'offer', sdp });
        await P.pc.setLocalDescription(await P.pc.createAnswer());
        await juntarIce(P.pc);
        if (this.pares.get(a.id) === P) this.enviar(a.id, 'respuesta', P.pc.localDescription.sdp);
      } else if (a.k === 'respuesta' && sdp) {
        const P = this.pares.get(a.id);
        if (P && P.pc.signalingState === 'have-local-offer') await P.pc.setRemoteDescription({ type: 'answer', sdp });
      } else if (a.k === 'chau') this.cerrar(a.id, false);
    } catch (e) { console.warn('voz: señal', e); this.cerrar(a.id, false); }
  }

  /* ------------------------------------------------------------ cada cuadro */
  /* oido: { pos, adelante } (Vector3). remotos: el Map de remotos.js */
  actualizar(dt, oido, remotos) {
    if (!this.activa) return;
    const c = Sonido.ctx, ahora = performance.now();
    if (c) {
      const L = c.listener, { pos, adelante } = oido;
      ponerPos(L, pos.x, pos.y, pos.z);
      if (L.forwardX) { L.forwardX.value = adelante.x; L.forwardY.value = adelante.y; L.forwardZ.value = adelante.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
      else L.setOrientation(adelante.x, adelante.y, adelante.z, 0, 1, 0);
    }
    for (const r of remotos.values()) {
      const d = Math.hypot(r.x - oido.pos.x, r.z - oido.pos.z), P = this.pares.get(r.id);
      const puede = r.voz > 0 && (this.mic || r.voz === 1);
      if (!P) {
        if (puede && d < CONECTA && this.red.id < r.id && !(this.espera.get(r.id) > ahora)) { this.espera.set(r.id, ahora + 15000); this.llamar(r.id); }
        continue;
      }
      if (!puede || d > CORTA) { this.cerrar(r.id, true); this.espera.set(r.id, ahora + 3000); continue; }
      /* la que no conectó en 15 s se deja y se reintenta */
      if (!P.conectada && ahora - P.t0 > 15000) { this.cerrar(r.id, true); continue; }
      if (P.pan) { ponerPos(P.pan, r.x, r.y + 1.2, r.z); P.g.gain.setTargetAtTime(1, c.currentTime, 0.08); }
      if (P.an) {
        P.an.getFloatTimeDomainData(P.buf); let s = 0; for (let i = 0; i < P.buf.length; i++) s += P.buf[i] * P.buf[i];
        P.nivel += (Math.sqrt(s / P.buf.length) - P.nivel) * Math.min(1, dt * 12);
      }
      if (!P.icono) { P.icono = parlante(); P.icono.position.y = 2.45; r.m.raiz.add(P.icono); }
      const habla = P.nivel > 0.015 && d < LEJOS;
      P.icono.visible = habla; if (habla) P.icono.scale.setScalar(0.38 + Math.min(0.14, P.nivel * 1.5));
    }
    /* los que se fueron de la sala */
    for (const id of [...this.pares.keys()]) if (!remotos.has(id)) this.cerrar(id, true);
    if (this.anMic) { this.anMic.getFloatTimeDomainData(this.bufMic); let s = 0; for (let i = 0; i < this.bufMic.length; i++) s += this.bufMic[i] * this.bufMic[i]; this.nivel += (Math.sqrt(s / this.bufMic.length) * 6 - this.nivel) * Math.min(1, dt * 10); }
  }
  /* para las pruebas y el cartel: cuántos te escuchan ahora */
  get conectados() { let n = 0; for (const P of this.pares.values()) if (P.conectada) n++; return n; }
}
