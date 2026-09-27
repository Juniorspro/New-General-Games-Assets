/* ============================================================================
   aeroplaza/js/nativo.js — el puente con la APK de Android (aeroplaza/android)
   El juego es el mismo; en la APK, lo que la web no puede lo hace Android:
   - ARCORE: dónde está el celu en cada foto, en 6 ejes (posición y giro). Con
     el giroscopio solo, el VR sabe para dónde mirás pero no dónde estás: al
     asomarte, agacharte o dar un paso, el mundo se venía con vos. Con ARCore
     queda quieto en su lugar, como en un Quest (vr.js › orientacion).
   - LAS MANOS con MediaPipe de Android, en la GPU, sobre las fotos de ARCore
     (con ARCore la cámara es suya: la web no la puede abrir). Llegan como las
     de la web (manos-camara.js) y siguen por el mismo camino (manos.js). Sin
     ARCore, la APK abre la cámara ella misma (CamaraManos.java) y van igual.
   - TU ESPACIO (Espacio.java, js/espacio.js): los planos del cuarto, lo demás
     en cubitos (la profundidad) y la foto de la cámara para ver a través.
   Java → JS: window.__nativo.pose / .manos / .estado / .planos / .voxeles /
   .foto / .olvidado. JS → Java:
   window.AeroplazaNativo (MainActivity.java › Puente). Sin la APK, nada de
   esto existe y el juego va como siempre.
   ========================================================================== */
import * as THREE from 'three';
import { puntosMano } from './manos-camara.js';

const N = () => window.AeroplazaNativo;
/* (la pose vieja no sirve: si ARCore no manda nada en esto, vuelve el giroscopio) */
const VIEJA = 250;

export const Nativo = {
  get hay() { return !!N(); },
  estado: 'parada',          // corre · instalando · parada · sin-permiso · error: … (lo que dice ARCore)
  manosListas: '',           // 'GPU' · 'CPU' cuando MediaPipe de Android arrancó
  pose: null, poseAntes: null,
  fps: '?',
  alManos: null,
  esperas: [],
  /* tu espacio: 'profundidad' (Depth API) · 'puntos' (sin profundidad: la nube de puntos) · '' */
  espacio: '',
  camara: null,
  /* las manos sin ARCore (CamaraManos.java): corre · abriendo · parada · sin-permiso · error: …; y sus fotos por segundo */
  camaraManos: 'parada', camaraFps: 0,
  get tieneCamaraManos() { try { return typeof N()?.manosCamara === 'function'; } catch { return false; } },
  alPlanos: null, alVoxeles: null, alFoto: null, alOlvidado: null,
  /* 'si' · 'instalar' · 'espera' · 'no' */
  arEstado() { try { return N()?.arEstado() || 'no'; } catch { return 'no'; } },
  get puedeAR() { const e = this.arEstado(); return e === 'si' || e === 'instalar'; },
  arIniciar(conManos = false) { try { N()?.arIniciar(!!conManos); } catch { /* sin APK */ } },
  arParar() { try { N()?.arParar(); } catch { /* sin APK */ } this.pose = this.poseAntes = null; },
  arManos(si) { try { N()?.arManos(!!si); } catch { /* sin APK */ } },
  manosCamara(si) { try { N()?.manosCamara?.(!!si); } catch { /* sin APK */ } },
  manosDos(si) { try { N()?.manosDos?.(!!si); } catch { /* sin APK */ } },
  arEscanear(si) { try { N()?.arEscanear?.(!!si); } catch { /* sin APK */ } },
  arPasante(si) { try { N()?.arPasante?.(!!si); } catch { /* sin APK */ } },
  arOlvidar() { try { N()?.arOlvidar?.(); } catch { /* sin APK */ } },
  flash(si) { try { N()?.flash(!!si); } catch { /* sin APK */ } },
  vibrar(ms) { try { N()?.vibrar(ms | 0); } catch { /* sin APK */ } },
  /* ARCore siguiendo, con una pose reciente */
  get arVivo() { return !!this.pose && this.pose.estado === 1 && performance.now() - this.pose.llego < VIEJA; },
  /* espera a que ARCore (o la cámara de las manos, campo 'camaraManos') diga algo que cumpla f (o hasta ms) */
  esperar(f, ms = 8000, campo = 'estado') {
    if (f(this[campo])) return Promise.resolve(this[campo]);
    return new Promise((ok) => { const e = { f, ok, campo }; this.esperas.push(e); setTimeout(() => { this.esperas = this.esperas.filter((x) => x !== e); ok(this[campo]); }, ms); });
  }
};

/* ------------------------------------------ Java → JS */
window.__nativo = {
  /* edad: hace cuánto se sacó la foto (ms); la pose de la cámara orientada a la pantalla (x a la
     derecha, y arriba, mira a -z: como la cámara de three) en el mundo de ARCore (y para arriba) */
  pose(edad, px, py, pz, qx, qy, qz, qw, estado, fps) {
    const ahora = performance.now(), P = Nativo.poseAntes || { p: new THREE.Vector3(), q: new THREE.Quaternion() }, A = Nativo.pose;
    P.t = ahora - edad; P.llego = ahora; P.p.set(px, py, pz); P.q.set(qx, qy, qz, qw); P.estado = estado;
    /* (la velocidad de los ojos, suavizada: con la de las dos últimas fotos el ruido de ARCore, de milímetros,
       se multiplicaba hasta 4 veces al adelantar y la vista temblaba) */
    if (A) { const dt = (P.t - A.t) / 1000; if (dt > 0.004 && dt < 0.12) { _o1.set(0, 0, 0.06).applyQuaternion(P.q).add(P.p); _o2.set(0, 0, 0.06).applyQuaternion(A.q).add(A.p); VEL.lerp(_o1.sub(_o2).divideScalar(dt), 0.3); } else VEL.set(0, 0, 0); }
    Nativo.poseAntes = Nativo.pose; Nativo.pose = P; Nativo.fps = fps;
    if (Nativo.estado !== 'corre') { Nativo.estado = 'corre'; avisarEspera(); }
  },
  manos(d) { Nativo.alManos?.(d); },
  /* tu espacio: los planos (todos, cada 400 ms), los cubitos nuevos (índices de VOX m) y la foto */
  planos(l) { Nativo.alPlanos?.(l); },
  voxeles(v, vox) { Nativo.alVoxeles?.(v, vox); },
  foto(d) { Nativo.alFoto?.(d); },
  olvidado() { Nativo.alOlvidado?.(); },
  estado(e) {
    if (/^manos (GPU|CPU)$/.test(e)) Nativo.manosListas = e.slice(6);
    else if (/^manos-camara /.test(e)) { const x = e.slice(13); if (x.startsWith('corre')) { Nativo.camaraManos = 'corre'; Nativo.camaraFps = +x.split(' ')[1] || 30; } else Nativo.camaraManos = x; }
    else if (/^espacio /.test(e)) Nativo.espacio = e.slice(8);
    /* (la cámara que eligió ARCore: su campo y el más abierto del celu, en grados; Ar.java › elegirCamara) */
    else if (/^camara \d/.test(e)) { const [, a, b] = e.split(' '); Nativo.camara = { campo: +a, celu: +b }; }
    else Nativo.estado = e;
    avisarEspera();
  }
};
function avisarEspera() { for (const e of Nativo.esperas.slice()) if (e.f(Nativo[e.campo])) { Nativo.esperas = Nativo.esperas.filter((x) => x !== e); e.ok(Nativo[e.campo]); } }

/* ------------------------------------------ la pose, llevada a cuando se va a ver
   (la foto tiene 30-60 ms: se adelanta con la velocidad de las dos últimas. El giro, el de la cámara;
   el lugar, el de los OJOS (ojos detrás del celu): girando en el lugar el celu da la vuelta alrededor
   de ellos, y adelantar el del celu corría la cabeza. El lugar un poco menos que entero: el ruido de
   ARCore es de milímetros y adelantado se nota) */
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const VEL = new THREE.Vector3(), _o1 = new THREE.Vector3(), _o2 = new THREE.Vector3();
export function poseEn(tVer, q, ojo, ojos = 0.06) {
  const A = Nativo.pose, B = Nativo.poseAntes;
  q.copy(A.q); ojo.set(0, 0, ojos).applyQuaternion(A.q).add(A.p);
  if (!B || A.t - B.t < 4 || A.t - B.t > 120) return;
  const dt = Math.min(0.08, Math.max(0, (tVer - A.t) / 1000)), dtp = (A.t - B.t) / 1000;
  /* (el giro de B a A en los ejes de la cámara: B⁻¹·A, en ángulo y eje) */
  _qa.copy(B.q).invert().multiply(A.q); if (_qa.w < 0) _qa.set(-_qa.x, -_qa.y, -_qa.z, -_qa.w);
  const s = Math.sqrt(Math.max(0, 1 - _qa.w * _qa.w)), ang = 2 * Math.acos(Math.min(1, _qa.w));
  if (s > 1e-6 && ang > 1e-5) { _w.set(_qa.x / s, _qa.y / s, _qa.z / s); q.multiply(_qb.setFromAxisAngle(_w, Math.min(20, ang / dtp) * dt)); }
  /* (el lugar, con la velocidad suavizada y hasta 50 ms) */
  _v.copy(VEL).multiplyScalar(0.8 * Math.min(dt, 0.05)); if (_v.length() < 0.05) ojo.add(_v);
}

/* ------------------------------------------ las manos de Android, con la cara de ManosCamara
   (lo que usa main.js: prender, apagar, activa, linterna, datos). Con sinAR, sobre la cámara que abre
   la APK (CamaraManos.java) en vez de las fotos de ARCore */
export class ManosNativas {
  constructor({ alLlegar, quiereDos }) {
    this.alLlegar = alLlegar; this.quiereDos = quiereDos; this.dos = false; this.activa = false; this.estadoRed = 'apagada'; this.nativa = true; this.sinAR = false;
    this.stats = { cuadros: 0, ms: 0, latencia: 0, g: 1, delegado: '' }; this._d = null;
    Nativo.alManos = (d) => this.recibir(d);
  }
  async prender() {
    this.activa = true; this.dos = false;
    if (this.sinAR) {
      /* (la cámara es de uno solo: si ARCore quedó prendido, se apaga) */
      if (Nativo.estado === 'corre') Nativo.arParar();
      if (Nativo.camaraManos !== 'corre') {
        Nativo.camaraManos = 'abriendo'; Nativo.manosCamara(true);
        const e = await Nativo.esperar((x) => x === 'corre' || x.startsWith('error') || x === 'sin-permiso', 8000, 'camaraManos');
        if (e !== 'corre') { this.activa = false; throw new Error('cámara: ' + e); }
      }
    } else if (Nativo.estado !== 'corre') {
      Nativo.arIniciar(true);
      const e = await Nativo.esperar((x) => x === 'corre' || x.startsWith('error') || x === 'sin-permiso' || x === 'no');
      if (e !== 'corre') { this.activa = false; throw new Error('ARCore: ' + e); }
    } else Nativo.arManos(true);
    this.estadoRed = 'lista';
    return true;
  }
  apagar() {
    this.activa = false;
    if (this.sinAR) { Nativo.manosCamara(false); Nativo.camaraManos = 'parada'; } else Nativo.arManos(false);
  }
  /* (la linterna, de quien tenga la cámara: ARCore o CamaraManos) */
  async linterna(prender) { Nativo.flash(prender); return !!prender; }
  recibir(d) {
    if (!this.activa || !d) return;
    const ahora = performance.now(), t = ahora - d.e, S = this.stats;
    S.cuadros++; S.ms += ((d.ms || 0) - S.ms) * 0.1; S.latencia += (d.e - S.latencia) * 0.1; S.g = d.g; S.delegado = d.d;
    const manos = [];
    for (const m of d.m || []) {
      const b = new Float32Array(126); b.set(m.i, 0); b.set(m.w, 63);
      const P = puntosMano(b, b, d.tx, d.ty, 0, 63); if (!P) continue;
      manos.push({ derecha: m.d < 0 ? null : m.d > 0.5, puntos: P, confianza: m.c, img: b.slice(0, 63), forma: b.slice(63, 126) });
    }
    /* (d.n: cuántas buscaba MediaPipe en esa foto, ManosNativas.java › cupo; con una buscada, la otra no
       cuenta como perdida. Y si manos.js tiene una a prueba, que busque dos: si no, no se confirma nunca) */
    this.alLlegar?.(manos, t, ahora, d.n || 2);
    const dos = !!this.quiereDos?.(); if (dos !== this.dos) { this.dos = dos; Nativo.manosDos(dos); }
  }
  datos() {
    const S = this.stats, ahora = performance.now();
    if (!this._d || ahora - this._d.t > 1000) { const porSeg = this._d ? (S.cuadros - this._d.n) / ((ahora - this._d.t) / 1000) : 0; this._d = { t: ahora, n: S.cuadros, porSeg }; }
    return `✋ ${Math.round(this._d.porSeg)}/s · ${Math.round(S.latencia)} ms · ${Math.round(S.ms)} ms/red ${S.delegado} · 📷${this.sinAR ? `${Nativo.camaraFps} cam` : `${Nativo.fps} AR`}${S.g > 1.08 ? ` ☀×${S.g.toFixed(1)}` : ''}`;
  }
}
