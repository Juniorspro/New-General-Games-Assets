/* ============================================================================
   aeroplaza/js/manos.js — las manos del VR, como en un Meta Quest.
   - De dónde salen: la cámara del celu (manos-camara.js, MediaPipe), las
     manos del visor (WebXR, vr-xr.js) o las pruebas. Todas llegan igual: 21
     puntos por mano en metros, en el mundo.
   - Suaves y sin atraso: cada punto pasa por un filtro One Euro (quieto no
     tiembla, rápido no se arrastra) y se ADELANTA con su velocidad hasta el
     cuadro que se dibuja: la cámara saca 30 fotos por segundo y la red tarda,
     pero la mano se dibuja a 120, donde va a estar.
   - El dibujo: las 48 cápsulas de las dos manos en UNA malla instanciada (la
     forma de cada cápsula la arma el shader con los dos puntos y los dos
     radios), y otra pasada con la misma malla que solo escribe profundidad
     antes: así el vidrio no se ve doble donde se cruzan los dedos. Dos
     llamadas para las dos manos.
   - Lo que se hace con ellas, como en Quest:
     · el rayo sale del hombro y pasa entre el pulgar y el índice; el
       pellizco (pulgar con índice) es el clic: usa lo que se apunta;
     · apuntando al piso sale el arco: se pellizca, se suelta y se salta ahí
       (teletransporte, con un parpadeo);
     · la palma para la cara y un pellizco abre el menú de la muñeca
       (caminar, girar, cuadros por segundo, salir), que se toca con el
       dedo o con el rayo;
     · la yema del índice revienta las burbujas y junta los orbes;
     · los dos pellizcos a la vez: salto.
   ========================================================================== */
import * as THREE from 'three';
import { t, sumar } from './textos.js';

sumar({
  es: { mn_caminar: '🚶 Caminar', mn_parar: '✋ Parar', mn_izq: 'Girar ⟲', mn_der: 'Girar ⟳', mn_fps: 'FPS', mn_mando: '🎮 Control', mn_mando_visto: '🎮 Control en la mano: apuntá con el objeto y apretá con el índice o el pulgar', mn_salir: 'Salir del VR', mn_titulo: 'Menú', mn_manos_cargando: '✋ Cargando las manos…', mn_manos_listas: '✋ Manos listas: pellizcá para usar, la palma para el menú', mn_manos_error: 'No se pudieron prender las manos (cámara o red)', mn_saltar: 'Saltar', mn_ir: 'Ir', mn_ventanas: '🪟 Ventanas', mn_lentes: '👓 Lentes' },
  en: { mn_caminar: '🚶 Walk', mn_parar: '✋ Stop', mn_izq: 'Turn ⟲', mn_der: 'Turn ⟳', mn_fps: 'FPS', mn_mando: '🎮 Controller', mn_mando_visto: '🎮 Controller in your hand: point with the object and squeeze with your index or thumb', mn_salir: 'Exit VR', mn_titulo: 'Menu', mn_manos_cargando: '✋ Loading hands…', mn_manos_listas: '✋ Hands ready: pinch to use, palm for the menu', mn_manos_error: 'Couldn’t start hand tracking (camera or network)', mn_saltar: 'Jump', mn_ir: 'Go', mn_ventanas: '🪟 Windows', mn_lentes: '👓 Lenses' },
  pt: { mn_caminar: '🚶 Andar', mn_parar: '✋ Parar', mn_izq: 'Girar ⟲', mn_der: 'Girar ⟳', mn_fps: 'FPS', mn_mando: '🎮 Controle', mn_mando_visto: '🎮 Controle na mão: aponte com o objeto e aperte com o indicador ou o polegar', mn_salir: 'Sair do VR', mn_titulo: 'Menu', mn_manos_cargando: '✋ Carregando as mãos…', mn_manos_listas: '✋ Mãos prontas: pinça para usar, a palma para o menu', mn_manos_error: 'Não foi possível ligar as mãos (câmera ou rede)', mn_saltar: 'Pular', mn_ir: 'Ir', mn_ventanas: '🪟 Janelas', mn_lentes: '👓 Lentes' },
});

/* los huesos (pares de puntos de MediaPipe) y el grosor en cada punto, en metros */
export const HUESOS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
  /* (la palma: rellenos gruesos para que no queden agujeros entre los nudillos y la muñeca) */
  [0, 9], [0, 13], [1, 5]];
const PALMA = new Set([21, 22, 23]);
const RADIO = [0.02, 0.013, 0.0118, 0.0105, 0.0092, 0.0112, 0.0102, 0.0094, 0.0084, 0.0114, 0.0104, 0.0095, 0.0085, 0.0108, 0.0099, 0.009, 0.0081, 0.0096, 0.0088, 0.008, 0.0072];
const N = HUESOS.length;
const PUNTA = [4, 8, 12, 16, 20];

/* -------------------------------------------------- el filtro One Euro, para n números a la vez */
class Euro {
  /* (corte 1,2 Hz quieta y +10 Hz por cada m/s; la velocidad, suavizada a 1 Hz. Simulado con
     fotos a 30 por segundo: quieta tiembla el 29 % del ruido, a 1 m/s adelantada erra 7 mm y un
     toque a 30 cm/s no atrasa ni 2 mm) */
  constructor(n, { corte = 1.2, beta = 10, corteD = 1.0 } = {}) { this.x = new Float32Array(n); this.dx = new Float32Array(n); this.t = -1; this.corte = corte; this.beta = beta; this.corteD = corteD; }
  static a(corte, dt) { const tau = 1 / (2 * Math.PI * corte); return 1 / (1 + tau / dt); }
  reiniciar(v, t) { this.x.set(v); this.dx.fill(0); this.t = t; }
  filtrar(v, t) {
    if (this.t < 0 || t - this.t > 0.5) { this.reiniciar(v, t); return this.x; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    const ad = Euro.a(this.corteD, dt);
    for (let i = 0; i < v.length; i++) {
      const d = (v[i] - this.x[i]) / dt; this.dx[i] += ad * (d - this.dx[i]);
      this.x[i] += Euro.a(this.corte + this.beta * Math.abs(this.dx[i]), dt) * (v[i] - this.x[i]);
    }
    return this.x;
  }
}

/* -------------------------------------------------- el One Euro por ejes, para la cámara del celu.
   Lo que peor adivina una sola cámara es la PROFUNDIDAD (lo lejos que está la mano sale del tamaño
   con que se ve); de costado, en cambio, la foto es precisa. Cada punto se filtra en dos partes: de
   costado (el plano de la foto) y a lo largo del rayo que va de los ojos a la mano, más fuerte. Así
   la mano quieta no "respira" para adelante y para atrás, y de costado sigue igual de rápida */
class EuroEjes {
  constructor(n, lado, hondo) { this.n = n; this.x = new Float32Array(n * 3); this.dx = new Float32Array(n * 3); this.t = -1; this.lado = lado; this.hondo = hondo; this.r = [0, 0, -1]; }
  reiniciar(v, t) { this.x.set(v); this.dx.fill(0); this.t = t; }
  filtrar(v, t, r = this.r) {
    this.r = r;
    if (this.t < 0 || t - this.t > 0.5) { this.reiniciar(v, t); return this.x; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    const L = this.lado, H = this.hondo, [rx, ry, rz] = r, x = this.x, dx = this.dx;
    for (let j = 0; j < this.n; j++) {
      const i = j * 3, ex = v[i] - x[i], ey = v[i + 1] - x[i + 1], ez = v[i + 2] - x[i + 2];
      /* lo que se movió, partido: a lo largo del rayo (eh) y de costado (el) */
      const eh = ex * rx + ey * ry + ez * rz, elx = ex - eh * rx, ely = ey - eh * ry, elz = ez - eh * rz;
      let vh = dx[i] * rx + dx[i + 1] * ry + dx[i + 2] * rz, vx = dx[i] - vh * rx, vy = dx[i + 1] - vh * ry, vz = dx[i + 2] - vh * rz;
      /* (la velocidad también se abre (betaD, Hz por m/s): con lo que cambió contra la que traía. Con el
         corte fijo tardaba tres o cuatro fotos en creer que arrancó, y otras tantas en creer que frenó:
         en un manotazo arrancaba tarde y se pasaba 10 cm. Quieta, lo que cambia es ruido y no la abre) */
      const nL = Math.hypot(elx / dt - vx, ely / dt - vy, elz / dt - vz), nH = Math.abs(eh / dt - vh);
      const aL = Euro.a(L.corteD + (L.betaD || 0) * nL, dt), aH = Euro.a(H.corteD + (H.betaD || 0) * nH, dt);
      vh += aH * (eh / dt - vh); vx += aL * (elx / dt - vx); vy += aL * (ely / dt - vy); vz += aL * (elz / dt - vz);
      const sl = Math.hypot(vx, vy, vz), sh = Math.abs(vh);
      const kL = Euro.a(L.corte + L.beta * Math.max(0, sl - (L.piso || 0)), dt), kH = Euro.a(H.corte + H.beta * Math.max(0, Math.max(sh, sl * H.cruce) - (H.piso || 0)), dt);
      x[i] += kL * elx + kH * eh * rx; x[i + 1] += kL * ely + kH * eh * ry; x[i + 2] += kL * elz + kH * eh * rz;
      dx[i] = vx + vh * rx; dx[i + 1] = vy + vh * ry; dx[i + 2] = vz + vh * rz;
    }
    return this.x;
  }
}

/* -------------------------------------------------- una mano */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const _ve = new THREE.Vector3(), _vr = new THREE.Vector3(), _qg = new THREE.Quaternion();
/* el centro de la palma (muñeca y los cuatro nudillos) de 21 puntos */
const CENTRO = [0, 5, 9, 13, 17];
function centroPalma(P, v = [0, 0, 0]) {
  v[0] = v[1] = v[2] = 0;
  for (const i of CENTRO) { v[0] += P[i * 3] / 5; v[1] += P[i * 3 + 1] / 5; v[2] += P[i * 3 + 2] / 5; }
  return v;
}
/* (ajustado con el simulador de celu: pruebas/manos-celu.mjs y las notas aeroplaza-14 a 16) */
const HMAX = 0.05;     // hasta acá se sigue moviendo sola, pareja, desde la última foto (s)
const FRENO = 0.08;    // y después frena en esto (si la red no la ve, no se congela de golpe) (s)
const LMAX = 0.1089;   // lo más que se adelanta de costado por el atraso de la cámara (s) (con la cámara, lo dice cada nivel: SUAVIDAD)
const LMAX_H = 0.1;    // y en profundidad (s)
const AMORT = 0.8012;  // cuánto de la velocidad se usa para adelantar
/* (vuelta 21: con la cámara lenta, lo que tarda de más se adelanta un poco más, hasta AMORT + AMORT_MAS
   con 0,26 s. Con la foto a 0,19 s, medio iba 97 ms atrás de costado; ahora 24. Hasta 0,13 s, igual que
   antes. LAT_TOPE: lo más que se cree que tarda) */
/* (vuelta 28: LAT_REF 0,13 → 0,08 s. Con la foto a 0,15 s (manos-lento) se adelantaba el 84 % de lo que
   tarda, ahora el 93 %: de costado a 10 cm/s, 102 → 78 ms atrás; para arriba, 71 → 43. Con los videos,
   igual) */
/* (ADEL_MAX, vuelta 22: 10 → 6,5 cm, en Medio y Suaves; Rápidas sigue con 10 (SUAVIDAD › adelMax). En un
   manotazo a 1,2 m/s que frena en seco, lo mostrado se pasaba 9 cm: mientras ninguna foto muestra que
   frenó, el adelanto sigue. Ahora 6,6 cm. Con 5,5, manos-celu quieta con la cámara lenta daba 6,0 mm) */
const LAT_TOPE = 0.35, AMORT_MAS = 0.24, LAT_REF = 0.08, ADEL_MAX = 0.065;
const ASIENTA = 0.93;     // quieta, en cuánto se va el ancla hacia donde está la mano filtrada (s; 0: no se va) (Mano.estabilizar)
const TAU = 0.0321;    // en cuánto se reparte el salto de cada foto nueva: un resorte (s)
const RESORTE_V = 1;   // y cuánto del cambio de velocidad (Mano.suavizar)
/* (vuelta 28: y moviéndose, más corto. Con los videos de quien juega, lo dibujado estaba más lejos de la
   mano que lo que sale del filtro (33,1 contra 29,5 % de la palma a 30 fotos; 16,2 contra 13,4 a 60): lo
   ponía el resorte. TAU_RAPIDA desde TAU_VEL[1] m/s del centro (TAU hasta TAU_VEL[0]), y todo escalado
   por el intervalo de las fotos contra TAU_FOTO (s; más largo, igual). Con los dos videos: 57,8 → 56,5
   y 36,0 → 34,0 %; a 60 fotos, menos patadas (39,9 → 34,6 por minuto). aeroplaza-28) */
const TAU_RAPIDA = 0.02, TAU_VEL = [0.05, 0.3], TAU_FOTO = 0.0333;
/* (RESORTE_V, C_BETAD y CH_BETAD, vuelta 22: la búsqueda con los manotazos las movía, pero con esas
   manos-celu temblaba el doble (2,4 mm por cuadro): quedan como estaban. aeroplaza-22 § Los manotazos) */
const GAN_MEM = 0.95, GAN_MIN = 0.2, GAN_DESDE = 0;   // Mano.medirAdelanto: lo que queda de lo medido en cada foto (~0,7 s), lo menos que se adelanta y desde cuánto se mide (m)
const GAN_PREVIO = 4e-4;   // (m²) lo que pesa, contra lo medido, empezar creyendo que el adelanto acierta (1)
/* (y lo que se mueve sola entre foto y foto: con la ganancia hasta GAN_SOLA[0], nada (la mano va y viene
   a los tirones: seguir derecho entre fotos era lo que pateaba, 400 veces por minuto en el video); desde
   GAN_SOLA[1], todo (la que va pareja, en manos-lento, da 0,55-0,85; el video, 0,27)) */
const GAN_SOLA = [0.25, 0.55];
const DEDOS_PALMA = [0.3, 0.6, 1, 0.15];   // Mano.medirDedos: con la palma hasta [0] de lo que se mueve (palma + [2] × (puntas - [3] m/s, el ruido de los dedos quietos)), no se adelanta; desde [1], todo
const ESPERA = 3;      // la foto que sigue se espera hasta esto por lo que tardan en llegar (Mano.adelantar)
const SALIDA = 0.25;   // y si no llega con la mano en el borde de la imagen, salió: sigue de largo y frena en esto (s)
const GIRO_AD = 1;     // cuánto del giro se adelanta (del arcotangente de lo que giraría; Mano.adelantar)
const FANTASMA = 0.05;  // una mano nueva a menos de esto (de costado, m) del camino de otra es un fantasma de MediaPipe
const SNAP = 0.4;      // un salto más grande que esto no se reparte: se va derecho (m), más 2 m/s por lo que estuvo sin fotos
const RARA = 0.08;     // una foto que cae más lejos que esto de donde tenía que estar se espera (m)
const RAYO_GANA = [2.0, 2.6];   // con la cámara: cuánto se agranda el ángulo de la mano para el rayo (de costado, arriba/abajo)
/* el One Euro de los puntos en el visor y las pruebas: corte quieta (Hz), cuánto se abre por cada
   m/s, y el corte de la velocidad (Hz) */
const E_CORTE = 1.2, E_BETA = 10, E_CORTED = 2.0;
/* con la cámara (vuelta 16): liviano, casi no atrasa; lo quieto lo sostienen las anclas. De costado,
   y en profundidad (cruce: cuánto abre el de profundidad la velocidad de costado) */
const C_CORTE = 2.7586, C_BETA = 33.0921, C_CORTED = 2.9938, C_BETAD = 0, C_PISO = 0;
const CH_CORTE = 2.0, CH_BETA = 20, CH_CORTED = 1.1853, CH_CRUCE = 0.3034, CH_BETAD = 0, CH_PISO = 0;
/* la forma de la mano (Mano.enderezar): la palma, un molde; los dedos, hueso por hueso */
const PALMA6 = [0, 1, 5, 9, 13, 17], EN_PALMA = Array.from({ length: 21 }, (_, i) => PALMA6.includes(i));
const DEDOS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const TRAMOS_DEDO = DEDOS.flatMap((d) => d.slice(1).map((b, k) => [d[k], b]));
/* (las puntas que van como bisagra: cada una, con el nudillo de su dedo) */
const BISAGRA = { 7: 5, 8: 5, 11: 9, 12: 9, 15: 13, 16: 13, 19: 17, 20: 17 };
const DORSO = 0.26;   // (rad: lo más que se doblan para atrás las puntas, ~15°)
/* los ejes de la palma de 21 puntos: x de meñique a índice (por los nudillos), y de la muñeca al
   medio, z la normal; en e (9 números) */
function ejesPalma(P, e) {
  let x0 = P[15] - P[51], x1 = P[16] - P[52], x2 = P[17] - P[53];
  const lx = Math.hypot(x0, x1, x2) || 1; x0 /= lx; x1 /= lx; x2 /= lx;
  const v0 = P[27] - P[0], v1 = P[28] - P[1], v2 = P[29] - P[2];
  let z0 = x1 * v2 - x2 * v1, z1 = x2 * v0 - x0 * v2, z2 = x0 * v1 - x1 * v0;
  const lz = Math.hypot(z0, z1, z2) || 1; z0 /= lz; z1 /= lz; z2 /= lz;
  e[0] = x0; e[1] = x1; e[2] = x2; e[3] = z1 * x2 - z2 * x1; e[4] = z2 * x0 - z0 * x2; e[5] = z0 * x1 - z1 * x0; e[6] = z0; e[7] = z1; e[8] = z2;
  return e;
}
/* (la mano que se va por el borde de la imagen: cortada por él, o con la palma a menos de BORDE, y
   yendo hacia ese lado (A: el centro de la palma en la foto de antes). Si deja de verse, salió de la
   cámara) */
const BORDE = 0.1;
function saliendo(I, A) {
  if (!I || !A) return false;
  const c = centroPalma(I), dx = c[0] - A[0], dy = c[1] - A[1];
  let izq = c[0] < BORDE, der = c[0] > 1 - BORDE, arr = c[1] < BORDE, aba = c[1] > 1 - BORDE;
  for (let i = 0; i < 21; i++) { const x = I[i * 3], y = I[i * 3 + 1]; izq ||= x < 0; der ||= x > 1; arr ||= y < 0; aba ||= y > 1; }
  return (izq && dx < 0) || (der && dx > 0) || (arr && dy < 0) || (aba && dy > 0);
}
/* DE QUÉ MANO ES LA FORMA (vuelta 23): hacia dónde se doblan las puntas y el pulgar, contra la normal
   cruda de la palma, cross(5 - 0, 17 - 0). En la derecha esa normal sale por la palma y los dedos se
   doblan hacia ahí: positivo; en la izquierda, negativo. El espejo en profundidad lo da vuelta. Con
   MediaPipe de verdad (fotos de pruebas/manos y sus espejos) da 20-70 mm por dedo, y cuando la
   etiqueta es segura coinciden siempre; cuando duda (de canto, de dorso: 0,54-0,64), no (en m, la
   suma de las cinco puntas) */
function quiralidad(P) {
  const a0 = P[15] - P[0], a1 = P[16] - P[1], a2 = P[17] - P[2], b0 = P[51] - P[0], b1 = P[52] - P[1], b2 = P[53] - P[2];
  let n0 = a1 * b2 - a2 * b1, n1 = a2 * b0 - a0 * b2, n2 = a0 * b1 - a1 * b0; const ln = Math.hypot(n0, n1, n2) || 1; n0 /= ln; n1 /= ln; n2 /= ln;
  let q = 0; for (const i of [4, 8, 12, 16, 20]) q += (P[i * 3] - P[0]) * n0 + (P[i * 3 + 1] - P[1]) * n1 + (P[i * 3 + 2] - P[2]) * n2;
  return q;
}
const ALRAYO = [0.1, 0.5];   // Mano.alRayo: desde cuánto se arregla el largo de un hueso, y lo más que se corre en profundidad (del largo)
const PALMA_TAM = [[0, 5], [0, 17], [5, 17], [0, 9], [9, 13], [13, 17]];   // el tamaño de la palma: lo que no se dobla (Mano.escalar)
const QUIRAL = 0.1;    // con menos que esto (la mano plana), la forma no dice de qué mano es (m; con MediaPipe de verdad, 130-260 mm; de canto, 86)
const ETIQUETA = 0.8;  // lo que dice MediaPipe de qué mano es cuenta con esta confianza o más (segura: 0,93-0,98; dudosa: 0,54-0,64)
/* el giro R que lleva el molde T (la palma en sus ejes, en el orden de PALMA6) a lo que se ve, v
   (Kabsch: lo más parecido a Σ d·Tᵀ que es un giro; por el método iterativo de Müller y otros, 2016,
   arrancando de q, los ejes de esa foto: tres o cuatro vueltas alcanzan) */
const KABSCH = [0, 5, 9, 13, 17].map((i) => [PALMA6.indexOf(i), i]);
/* (una mano no gira más de 20 rad/s: más que eso es una foto mala) */
const W_MAX = 20;
function ajustarGiro(v, c, T, q) {
  let a0 = 0, a1 = 0, a2 = 0, b0 = 0, b1 = 0, b2 = 0, c0 = 0, c1 = 0, c2 = 0;
  for (const [k, i] of KABSCH) {
    const d0 = v[i * 3] - c[0], d1 = v[i * 3 + 1] - c[1], d2 = v[i * 3 + 2] - c[2], t0 = T[k * 3], t1 = T[k * 3 + 1], t2 = T[k * 3 + 2];
    a0 += d0 * t0; a1 += d1 * t0; a2 += d2 * t0; b0 += d0 * t1; b1 += d1 * t1; b2 += d2 * t1; c0 += d0 * t2; c1 += d1 * t2; c2 += d2 * t2;
  }
  for (let it = 0; it < 6; it++) {
    const R = _mp.makeRotationFromQuaternion(q).elements;
    const w0 = (R[1] * a2 - R[2] * a1) + (R[5] * b2 - R[6] * b1) + (R[9] * c2 - R[10] * c1);
    const w1 = (R[2] * a0 - R[0] * a2) + (R[6] * b0 - R[4] * b2) + (R[10] * c0 - R[8] * c2);
    const w2 = (R[0] * a1 - R[1] * a0) + (R[4] * b1 - R[5] * b0) + (R[8] * c1 - R[9] * c0);
    const dn = Math.abs(R[0] * a0 + R[1] * a1 + R[2] * a2 + R[4] * b0 + R[5] * b1 + R[6] * b2 + R[8] * c0 + R[9] * c1 + R[10] * c2) + 1e-12;
    _va.set(w0 / dn, w1 / dn, w2 / dn);
    if (_va.lengthSq() < 1e-14) break;
    q.premultiply(expQ(_va, _qb)).normalize();
  }
  return q;
}
/* los giros, como vectores (eje por ángulo) */
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _va = new THREE.Vector3(), _vw = new THREE.Vector3(), _mp = new THREE.Matrix4();
function logQ(q, out) {
  let x = q.x, y = q.y, z = q.z, w = q.w; if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const s = Math.hypot(x, y, z), k = s > 1e-9 ? 2 * Math.atan2(s, w) / s : 2;
  return out.set(x * k, y * k, z * k);
}
function expQ(v, out) {
  const a = v.length(); if (a < 1e-9) return out.set(v.x / 2, v.y / 2, v.z / 2, 1).normalize();
  const s = Math.sin(a / 2) / a; return out.set(v.x * s, v.y * s, v.z * s, Math.cos(a / 2));
}
/* -------------------------------------------------- la mano como un cuerpo, para la cámara (vuelta 19).
   Filtrar y adelantar cada uno de los 21 puntos por su cuenta deformaba la mano: la velocidad de cada
   punto tiene su ruido, y adelantada 0,1-0,2 s cada nudillo se iba unos milímetros para cualquier lado
   (los dedos se doblaban 16° de más; con el doble de ruido, 32°). Acá la mano es:
   - la PALMA, un cuerpo: su centro (con el filtro de costado y profundidad de siempre) y su giro (un
     One Euro de cuaterniones, con su velocidad de giro);
   - los DEDOS, en los ejes de la palma (EuroDedos), con la forma de quien juega (el largo de cada
     hueso y el molde de la palma, Mano.aprenderForma). Lo que se mueven en la palma se adelanta solo
     cuando el dedo entero se mueve de verdad.
   Tiene lo mismo que EuroEjes (x y dx de los 21 puntos): el resto (adelantar, el resorte, las anclas)
   anda igual, y la velocidad de cada punto es la de un cuerpo que se mueve y gira */
/* los dedos en los ejes de la palma: un One Euro por coordenada, pero lo que lo abre es la velocidad
   de todo el dedo (el promedio de sus tres puntos, sin el nudillo): el ruido de cada punto va por su
   lado y se cancela; el dedo que se dobla los mueve a todos para el mismo lado */
class EuroDedos {
  constructor({ corte = 1.2, beta = 10, corteD = 1, piso = 0 } = {}) { this.x = new Float32Array(63); this.dx = new Float32Array(63); this.s = new Float32Array(21); this.t = -1; this.corte = corte; this.beta = beta; this.corteD = corteD; this.piso = piso; }
  reiniciar(v, t) { this.x.set(v); this.dx.fill(0); this.t = t; }
  filtrar(v, t) {
    if (this.t < 0 || t - this.t > 0.5) { this.reiniciar(v, t); return this.x; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    const ad = Euro.a(this.corteD, dt), x = this.x, dx = this.dx, s = this.s;
    for (let i = 0; i < 63; i++) dx[i] += ad * ((v[i] - x[i]) / dt - dx[i]);
    for (let p = 0; p < 21; p++) s[p] = Math.hypot(dx[p * 3], dx[p * 3 + 1], dx[p * 3 + 2]);
    for (const d of DEDOS) {
      let a = 0, b = 0, c = 0;
      for (let k = 1; k < 4; k++) { const i = d[k] * 3; a += dx[i]; b += dx[i + 1]; c += dx[i + 2]; }
      const sd = Math.hypot(a, b, c) / 3;
      for (let k = 1; k < 4; k++) s[d[k]] = sd;
    }
    for (let p = 0; p < 21; p++) { const k = Euro.a(this.corte + this.beta * Math.max(0, s[p] - this.piso), dt); for (let i = p * 3; i < p * 3 + 3; i++) x[i] += k * (v[i] - x[i]); }
    return x;
  }
}
class PoseMano {
  constructor(lado, hondo, giro, dedos) {
    this.x = new Float32Array(63); this.dx = new Float32Array(63); this.t = -1; this.r = [0, 0, -1];
    this.centro = new EuroEjes(1, lado, hondo); this.giro = giro;
    this.dedos = new EuroDedos(dedos); this.dedosAd = dedos.adelanto || 0; this.dedosV = [dedos.v0 || 0, dedos.v1 || 0];
    this.q = new THREE.Quaternion(); this.qm = new THREE.Quaternion(); this.qAnt = new THREE.Quaternion(); this.w = new THREE.Vector3(); this.tm = -1;
    this.Lm = new Float32Array(63); this.Lc = new Float32Array(63); this.c = [0, 0, 0]; this.e = new Float32Array(9); this.forma = null;
    this.vE = new Float32Array(63); this.LE = new Float32Array(63); this.qE = new THREE.Quaternion(); this.cE = [0, 0, 0]; this.espejos = 0;
  }
  get Lf() { return this.dedos.x; }
  /* de 21 puntos: el centro, el giro (qm) y la forma en los ejes de la palma (Lm) */
  medir(v, qm = this.qm, Lm = this.Lm, c = this.c) {
    centroPalma(v, c); const e = ejesPalma(v, this.e);
    qm.setFromRotationMatrix(_mp.set(e[0], e[3], e[6], 0, e[1], e[4], e[7], 0, e[2], e[5], e[8], 0, 0, 0, 0, 1));
    /* (con la forma aprendida, el giro que mejor lleva el molde de la palma a lo que se ve: con cinco
       puntos y no con cuatro, tiembla menos. El nudillo del pulgar no: se mueve con el pulgar) */
    if (this.forma && this.forma.n >= 20) {
      ajustarGiro(v, c, this.forma.palma, qm);
      const R = _mp.makeRotationFromQuaternion(qm).elements;
      e[0] = R[0]; e[1] = R[1]; e[2] = R[2]; e[3] = R[4]; e[4] = R[5]; e[5] = R[6]; e[6] = R[8]; e[7] = R[9]; e[8] = R[10];
    }
    for (let i = 0; i < 21; i++) {
      const d0 = v[i * 3] - c[0], d1 = v[i * 3 + 1] - c[1], d2 = v[i * 3 + 2] - c[2];
      for (let q = 0; q < 3; q++) Lm[i * 3 + q] = d0 * e[q * 3] + d1 * e[q * 3 + 1] + d2 * e[q * 3 + 2];
    }
  }
  /* UNA SOLA CÁMARA NO SABE PARA QUÉ LADO ESTÁ GIRADA LA MANO (vuelta 20): la misma foto sale de la mano
     girada para un lado o su espejo en profundidad (lo cerca se va lejos y al revés), y de canto
     MediaPipe a veces da una y a veces la otra. Una sola foto así hacía girar la mano dibujada 90° y
     tardaba 300 ms en volver. Se arma el espejo (cada punto por su rayo desde la cámara, O, a la
     profundidad del otro lado del centro) y queda la que sigue lo que venía: el giro, contra lo que
     se esperaba con su velocidad, y los dedos, contra los filtrados */
  elegirEspejo(v, O, r, dtm, conGiro = true, quiral = 0) {
    const c = this.c, E = this.vE, dc = (c[0] - O[0]) * r[0] + (c[1] - O[1]) * r[1] + (c[2] - O[2]) * r[2];
    for (let i = 0; i < 63; i += 3) {
      const ux = v[i] - O[0], uy = v[i + 1] - O[1], uz = v[i + 2] - O[2], d = ux * r[0] + uy * r[1] + uz * r[2];
      const f = d > 1e-3 ? Math.max(0.2, (2 * dc - d) / d) : 1;
      E[i] = O[0] + ux * f; E[i + 1] = O[1] + uy * f; E[i + 2] = O[2] + uz * f;
    }
    /* (vuelta 23: si se sabe qué mano es y la forma lo dice claro, queda la que se dobla como esa mano.
       De dorso, MediaPipe a veces arma la otra mano de palma: la misma foto, con los dedos doblados
       para el lado de la cámara. Con la palma para abajo, la mano se veía y se tomaba como de palma) */
    if (quiral) {
      const qv = quiralidad(v);
      if (Math.abs(qv) > QUIRAL) {
        if (Math.sign(qv) === quiral) return;
        const qe = quiralidad(E);
        if (Math.sign(qe) === quiral) { this.medir(E, this.qE, this.LE, this.cE); this.qm.copy(this.qE); this.Lm.set(this.LE); this.espejos++; this.quirales = (this.quirales || 0) + 1; return; }
      }
    }
    this.medir(E, this.qE, this.LE, this.cE);
    _qa.copy(this.qAnt).premultiply(expQ(_va.copy(this.w).multiplyScalar(dtm), _qb));   // (lo que se esperaba)
    const ang = (q) => 2 * Math.acos(Math.min(1, Math.abs(q.dot(_qa))));
    const L = this.dedos.x; let a = 0, b = 0;
    for (let p = 0; p < 21; p++) {
      if (EN_PALMA[p]) continue;
      for (let i = p * 3; i < p * 3 + 3; i++) { a += (this.Lm[i] - L[i]) ** 2; b += (this.LE[i] - L[i]) ** 2; }
    }
    /* (1 cm de los dedos, como 0,2 rad de giro; la de MediaPipe gana los empates) */
    const cm = (conGiro ? ang(this.qm) ** 2 : 0) + 400 * a / 15, ce = (conGiro ? ang(this.qE) ** 2 : 0) + 400 * b / 15;
    if (ce < cm * 0.8) { this.qm.copy(this.qE); this.Lm.set(this.LE); this.espejos++; }
  }
  reiniciar(v, t, r = null, O = null, quiral = 0) {
    this.quiral = quiral;
    this.medir(v);
    /* (al volver a encontrarla, sin giro con qué comparar: la que tiene los dedos como los tenía. Si
       no, una mano de dorso que MediaPipe da como la otra se armaba con el molde al revés. Y si se sabe
       qué mano es, la que se dobla como esa, aunque sea la primera foto) */
    if (O && r && ((this.forma && this.dedos.t >= 0) || quiral)) this.elegirEspejo(v, O, r, 0, false, quiral);
    this.centro.reiniciar(this.c, t); this.q.copy(this.qm); this.qAnt.copy(this.qm); this.w.set(0, 0, 0);
    this.dedos.reiniciar(this.Lm, t); this.t = this.tm = t; this.componer();
  }
  desde(x, t) { this.reiniciar(x, t); }
  filtrar(v, t, r = this.r, O = null, quiral = 0) {
    this.r = r; this.quiral = quiral;
    if (this.t < 0 || t - this.t > 0.5) { this.reiniciar(v, t, r, O, quiral); return this.x; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    this.medir(v);
    if (O) this.elegirEspejo(v, O, r, Math.max(1e-3, t - this.tm), true, quiral);
    this.centro.filtrar(this.c, t, r);
    /* el giro: la velocidad, de una foto a la otra (filtrada); lo filtrado va hacia lo medido, más
       rápido cuanto más rápido gira */
    const G = this.giro, qm = this.qm;
    if (qm.dot(this.qAnt) < 0) qm.set(-qm.x, -qm.y, -qm.z, -qm.w);
    const dtm = Math.max(1e-3, t - this.tm);
    logQ(_qa.copy(qm).multiply(_qb.copy(this.qAnt).invert()), _va).multiplyScalar(1 / dtm);
    /* (con tope: una foto mala, de canto, daba 90 rad/s y se llevaba la mano lejos) */
    if (_va.lengthSq() > W_MAX * W_MAX) _va.setLength(W_MAX);
    this.w.lerp(_va, Euro.a(G.corteD, dt));
    logQ(_qa.copy(qm).multiply(_qb.copy(this.q).invert()), _va);
    _va.multiplyScalar(Euro.a(G.corte + G.beta * Math.max(0, this.w.length() - (G.piso || 0)), dt));
    this.q.premultiply(expQ(_va, _qa)).normalize();
    this.qAnt.copy(qm); this.tm = t;
    this.dedos.filtrar(this.Lm, t);
    this.componer();
    return this.x;
  }
  /* la forma de quien juega, en los ejes de la palma: la palma con su molde y cada dedo con el largo de
     sus huesos (la dirección, la de lo filtrado) */
  restringir() {
    const F = this.forma, L = this.dedos.x, O = this.Lc; O.set(L);
    if (!F || F.n < 5) return O;
    PALMA6.forEach((i, k) => { O[i * 3] = F.palma[k * 3]; O[i * 3 + 1] = F.palma[k * 3 + 1]; O[i * 3 + 2] = F.palma[k * 3 + 2]; });
    TRAMOS_DEDO.forEach(([a, b], k) => {
      let d0 = L[b * 3] - L[a * 3], d1 = L[b * 3 + 1] - L[a * 3 + 1], d2 = L[b * 3 + 2] - L[a * 3 + 2];
      /* (los dos huesos de la punta de los cuatro dedos se doblan solo hacia la palma, como una bisagra:
         se les saca lo que se van de costado del primero. El ruido los torcía para los lados) */
      const j = BISAGRA[b];
      if (j !== undefined) {
        const e0 = L[(j + 1) * 3] - L[j * 3], e1 = L[(j + 1) * 3 + 1] - L[j * 3 + 1];   // el primer hueso del dedo, en la palma (x, y)
        const le = Math.hypot(e0, e1) || 1, ax = e1 / le, ay = -e0 / le, lat = d0 * ax + d1 * ay;   // el costado: el primer hueso por la normal de la palma
        d0 -= ax * lat; d1 -= ay * lat;
        /* (y no se doblan para el dorso más de DORSO contra el primer hueso: con el ruido, MediaPipe
           las tiraba para atrás 25° o más en uno de cada diez cuadros, y ninguna mano llega. La palma
           es +z en la derecha y -z en la izquierda) */
        if (this.quiral) {
          const f0 = e0 / le, f1 = e1 / le, s = this.quiral, ez = L[(j + 1) * 3 + 2] - L[j * 3 + 2];
          const fw = d0 * f0 + d1 * f1, te = Math.atan2(ez, le);
          let b = Math.atan2(d2, fw) - te; b -= Math.round(b / (2 * Math.PI)) * 2 * Math.PI;
          if (s * b < -DORSO) { const a = te - s * DORSO, l = Math.hypot(fw, d2); d0 = f0 * l * Math.cos(a); d1 = f1 * l * Math.cos(a); d2 = l * Math.sin(a); }
        }
      }
      const f = F.largo[k] / (Math.hypot(d0, d1, d2) || 1);
      O[b * 3] = O[a * 3] + d0 * f; O[b * 3 + 1] = O[a * 3 + 1] + d1 * f; O[b * 3 + 2] = O[a * 3 + 2] + d2 * f;
    });
    return O;
  }
  /* los 21 puntos en el mundo, y su velocidad: la del centro más la del giro */
  componer() {
    const C = this.centro.x, V = this.centro.dx, R = _mp.makeRotationFromQuaternion(this.q).elements, L = this.restringir();
    /* (la velocidad del giro entra de a poco entre w0 y w1 (rad/s): quieta, es ruido, y las puntas de
       los dedos, lejos del centro, temblaban) */
    const G = this.giro, w0 = G.w0 || 0, w1 = G.w1 || 0, wl = this.w.length(), u = w1 > w0 ? Math.min(1, Math.max(0, (wl - w0) / (w1 - w0))) : 1;
    const w = _vw.copy(this.w).multiplyScalar(u * u * (3 - 2 * u));
    (this.wg ||= new THREE.Vector3()).copy(w);   // (el giro que se adelanta: Mano.adelantar)
    for (let i = 0; i < 63; i += 3) {
      const lx = L[i], ly = L[i + 1], lz = L[i + 2];
      const r0 = R[0] * lx + R[4] * ly + R[8] * lz, r1 = R[1] * lx + R[5] * ly + R[9] * lz, r2 = R[2] * lx + R[6] * ly + R[10] * lz;
      this.x[i] = C[0] + r0; this.x[i + 1] = C[1] + r1; this.x[i + 2] = C[2] + r2;
      this.dx[i] = V[0] + w.y * r2 - w.z * r1; this.dx[i + 1] = V[1] + w.z * r0 - w.x * r2; this.dx[i + 2] = V[2] + w.x * r1 - w.y * r0;
    }
    /* (y lo que se mueven los dedos en la palma, solo si el dedo entero se mueve de verdad (entre v0 y
       v1, m/s): quieto, esa velocidad es ruido, y adelantarla doblaba los dedos para cualquier lado.
       La palma no: es su molde) */
    const ad = this.dedosAd || 0, [v0, v1] = this.dedosV;
    if (ad > 0) {
      const D = this.dedos.dx, S = this.dedos.s;
      for (let p = 0; p < 21; p++) {
        if (EN_PALMA[p]) continue;
        const u = v1 > v0 ? Math.min(1, Math.max(0, (S[p] - v0) / (v1 - v0))) : S[p] >= v0 ? 1 : 0, g = ad * u * u * (3 - 2 * u), i = p * 3;
        if (!g) continue;
        const a = D[i] * g, b = D[i + 1] * g, c = D[i + 2] * g;
        this.dx[i] += R[0] * a + R[4] * b + R[8] * c; this.dx[i + 1] += R[1] * a + R[5] * b + R[9] * c; this.dx[i + 2] += R[2] * a + R[6] * b + R[10] * c;
      }
    }
  }
}
/* el giro y los dedos (PoseMano): corte quieta (Hz), cuánto se abre por cada rad/s o m/s, el corte
   de la velocidad (Hz) y entre qué velocidades entra su adelanto (w0-w1 rad/s, v0-v1 m/s); los dedos,
   cuánto de lo que se mueven en la palma se adelanta (adelanto: 1, todo lo que tarda la cámara) */
/* (de una búsqueda de 900 al azar y 240 alrededor de la mejor con herramientas/manos-lento.mjs, con las
   semillas 1-5, el ruido de siempre y el doble; comprobado con las 6-10 y con dedos que fallan) */
const P_GIRO = { corte: 2.885, beta: 4.62, corteD: 2.893, w0: 1.006, w1: 3.059, piso: 0 }, P_DEDOS = { corte: 0.707, beta: 2.534, corteD: 5.656, adelanto: 0.5, v0: 0.281, v1: 0.559, piso: 0 };
/* lo que elige cada uno en el menú del VR ("Manos"): lo más que se adelanta por el atraso de la
   cámara (s), de costado y en profundidad, y las anclas (Mano.estabilizar): la zona (m), cuánto
   tiene que quedarse adentro para anclarse (tq), cuánto tiene que empujar el borde para soltarse (te)
   y en cuánto se suelta (ts, s); de costado y en profundidad (…H).
   - Rápidas: sin anclas y adelantando todo lo que tarda la cámara: va pegada a la mano y tiembla un
     poco, como un Quest. El adelanto del centro, de a poco entre v0 y v1 (m/s): casi quieta, la
     velocidad es ruido.
   - Los topes (lmax, lmaxH) van a 0,35 s en los tres (vuelta 21): con la cámara lenta de un celu, el
     tope de antes (0,13-0,2 s) dejaba la mano 100-220 ms atrás.
   - Medio y suaves: de una búsqueda (vuelta 17, herramientas/manos-lento.mjs: 450 al azar, con las
     semillas 1-5; comprobado con las 6-10). Medio, otra vez en la vuelta 20 (300, contando cuánto
     tarda en arrancar y los movimientos chicos: "tarda en seguirme"), con vs: con el borde empujado y
     el centro a más de vs (m/s), el ancla de costado se suelta sin esperar te. Suaves, con vs desde la
     vuelta 28: sin eso, un paso de 6 mm quedaba justo en el borde de soltarse (en 1 de 5 semillas se
     quedaba 5 mm atrás hasta el movimiento siguiente, 8 s) */
/* - (vuelta 38, "más estabilidad") pose: el giro y los dedos de medio y suaves (rápidas, P_GIRO y P_DEDOS). El
     giro, sin lo que se abre con la velocidad (beta 0): con el ruido de MediaPipe la velocidad del giro es casi
     toda ruido y abría el filtro justo con la mano quieta; con el corte fijo y el adelanto (giroAd) sigue igual de
     cerca. Los dedos, menos beta y menos adelanto. Medido con sus tres videos (herramientas/manos-video.mjs): el
     bamboleo del giro con la mano quieta 4,97/6,65/3,08° → 2,47/3,64/2,01; el de los dedos 6,36/8,33/6,61 mm →
     4,23/6,65/5,08; las patadas 117/181/35 → 102/161/29 por minuto. Cuesta: el giro 1,7° más atrás girando
     (manos-lento) y el dedo que se dobla 26 ms */
export const SUAVIDAD = {
  rapida: { anclas: null, lmax: 0.35, lmaxH: 0.35, v0: 0.03, v1: 0.1, adelMax: 0.1 },
  media: { lmax: 0.35, lmaxH: 0.35, anclas: { rl: 0.0048, rh: 0.0106, tq: 0.2645, tqH: 0.1799, te: 0.0426, teH: 0.0172, ts: 0.038, tsH: 0.0491, vs: 0.0568 },
    pose: { giro: { beta: 0, corte: 3.5 }, giroAd: 1.2, dedos: { beta: 1.2, adelanto: 0.35 } } },
  suave: { lmax: 0.35, lmaxH: 0.35, anclas: { rl: 0.0051, rh: 0.0139, tq: 0.2248, tqH: 0.1921, te: 0.0258, teH: 0.0368, ts: 0.0424, tsH: 0.0514, vs: 0.05 },
    pose: { giro: { beta: 0, corte: 2.5 }, giroAd: 1.2, dedos: { beta: 1.2, adelanto: 0.25 } } },
};
class Mano {
  /* (vuelta 38) el giro y los dedos del nivel del menú (SUAVIDAD › pose; sin pose, los de siempre) */
  ponerPose(N) {
    if (this.poseNivel === N) return; this.poseNivel = N;
    const E = this.euroEjes, g = { ...P_GIRO, ...(N?.giro || {}) }, d = { ...P_DEDOS, ...(N?.dedos || {}) };
    E.giro = g; E.dedos.corte = d.corte; E.dedos.beta = d.beta; E.dedos.corteD = d.corteD; E.dedos.piso = d.piso || 0;
    E.dedosAd = d.adelanto || 0; E.dedosV = [d.v0 || 0, d.v1 || 0];
    this.giroAd = N?.giroAd ?? GIRO_AD;
  }
  constructor(derecha) {
    this.derecha = derecha; this.visible = false; this.t = -1; this.conf = 0; this.rastro = [];
    this.euroIso = new Euro(63, { corte: E_CORTE, beta: E_BETA, corteD: E_CORTED });
    this.euroEjes = new PoseMano({ corte: C_CORTE, beta: C_BETA, corteD: C_CORTED, betaD: C_BETAD, piso: C_PISO }, { corte: CH_CORTE, beta: CH_BETA, corteD: CH_CORTED, cruce: CH_CRUCE, betaD: CH_BETAD, piso: CH_PISO }, P_GIRO, P_DEDOS);
    this.euro = this.euroIso; this.rayo = null;   // (el de ejes, con la cámara: rayo es de los ojos a la mano)
    this.p = new Float32Array(63);        // lo que se dibuja (filtrado, adelantado y sin saltos)
    this.pellizca = false; this.fuerza = 0; this.tPellizco = -9; this.soltoEn = -9;
    this.rayoO = new THREE.Vector3(); this.rayoD = new THREE.Vector3(0, 0, -1);
    this.euroRayo = new Euro(3, { corte: 0.9, beta: 0.9 });
    this.palmaN = new THREE.Vector3(); this.palmaC = new THREE.Vector3(); this.aLaCara = 0;
    this.fijoHasta = 0;                   // (el rayo se queda quieto un ratito al pellizcar: el pellizco lo movía)
    /* que no titile ni salte:
       - alfa: se prende y se apaga suave (como en Quest), no de golpe;
       - tLlego: cuándo llegó la última foto (en el reloj del dibujo), para seguir moviéndola entre foto
         y foto; lat: cuánto tarda en llegar desde que se saca (la cámara del celu, 100-250 ms);
       - off: lo que saltaría con cada foto nueva, repartido en unos cuadros;
       - faltas: fotos seguidas en que la red no la vio; votos: lo que dice MediaPipe de qué mano es */
    this.alfa = 0; this.gen = 0; this.histH = []; this.tLlego = -1; this.lat = 0; this.faltas = 0; this.votos = 0; this.rara = 0;
    this.off = new Float32Array(63); this.offV = new Float32Array(63); this.pAnt = new Float32Array(63); this.vAnt = new Float32Array(63);
    this.nueva = false; this.seguida = false; this.vb = new Float32Array(63);
  }
  punto(i, v = new THREE.Vector3()) { return v.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]); }
  /* el punto sin el resorte (donde está de verdad, según las fotos) */
  puntoBase(i, v = new THREE.Vector3()) { const B = this.conResorte ? this.pAnt : this.p; return v.set(B[i * 3], B[i * 3 + 1], B[i * 3 + 2]); }
  /* dónde tendría que estar el centro de la palma en el momento t (s) */
  predecirCentro(t, v = [0, 0, 0]) {
    const E = this.euro, k = Math.min(0.2, Math.max(0, t - this.t));
    v[0] = v[1] = v[2] = 0;
    for (const i of CENTRO) for (let c = 0; c < 3; c++) v[c] += (E.x[i * 3 + c] + E.dx[i * 3 + c] * k) / 5;
    return v;
  }
  /* LA MANO TIENE UN SOLO TAMAÑO (vuelta 24): el que MediaPipe le da a la palma cambia ±40 % de una foto a
     la otra (con un video de verdad, de 3,8 a 9,4 cm), y como la profundidad sale de ahí, la mano iba y
     venía hasta 12 cm en una foto (y se veía de otro tamaño que la de verdad). Se aprende el tamaño (el
     promedio de lo que dice, sin las fotos muy raras) y cada foto se agranda o achica a ese tamaño desde
     la cámara, O: cada punto sigue por el rayo de su lugar en la imagen, y la profundidad sale del
     tamaño que se ve */
  escalar(W, O) {
    let m = 0; for (const [a, b] of PALMA_TAM) m += Math.hypot(W[a * 3] - W[b * 3], W[a * 3 + 1] - W[b * 3 + 1], W[a * 3 + 2] - W[b * 3 + 2]);
    if (!(m > 1e-4)) return;
    const E = this.tam ||= { n: 0, v: 0 };
    if (E.n < 30 || Math.abs(Math.log(m / E.v)) < 0.5) { E.v = E.n < 30 ? (E.v * E.n + m) / (E.n + 1) : E.v + (m - E.v) * 0.02; E.n++; }
    if (E.n < 10) return;
    const f = THREE.MathUtils.clamp(E.v / m, 0.5, 2);
    for (let i = 0; i < 63; i += 3) { W[i] = O[0] + (W[i] - O[0]) * f; W[i + 1] = O[1] + (W[i + 1] - O[1]) * f; W[i + 2] = O[2] + (W[i + 2] - O[2]) * f; }
  }
  /* LOS HUESOS SIN ESTIRARSE Y CADA PUNTO EN SU LUGAR DE LA IMAGEN (vuelta 24): lo que se deduce de
     MediaPipe tiene huesos que cambian de largo hasta un 58 % de una foto a la otra (con un video de
     verdad): la profundidad de cada punto es lo que peor adivina. Se arregla el largo de cada hueso, de la
     palma a la punta, moviendo el punto de la punta POR SU RAYO (desde la cámara, O): queda en su lugar de
     la imagen y a la distancia de siempre del anterior. De las dos profundidades que cumplen, la más cerca
     de lo que dijo MediaPipe; si el rayo no llega (el hueso es más corto que la distancia al rayo), queda */
  alRayo(W, O) {
    const F = this.forma; if (!F || F.n < 20) return;
    TRAMOS_DEDO.forEach(([a, b], k) => {
      const L = F.largo[k], ux = W[b * 3] - O[0], uy = W[b * 3 + 1] - O[1], uz = W[b * 3 + 2] - O[2], tm = Math.hypot(ux, uy, uz);
      if (!(tm > 1e-4) || !(L > 0)) return;
      const u0 = ux / tm, u1 = uy / tm, u2 = uz / tm, a0 = W[a * 3] - O[0], a1 = W[a * 3 + 1] - O[1], a2 = W[a * 3 + 2] - O[2];
      /* (prudente: si el hueso ya está a menos de ALRAYO[0] de su largo, queda; y el punto no se mueve
         en profundidad más que ALRAYO[1] del largo del hueso: con más, al dar vuelta la mano una
         profundidad elegida mal daba vuelta la forma, y el giro iba 60° atrás) */
      const lx = W[b * 3] - W[a * 3], ly = W[b * 3 + 1] - W[a * 3 + 1], lz = W[b * 3 + 2] - W[a * 3 + 2];
      if (Math.abs(Math.hypot(lx, ly, lz) / L - 1) < ALRAYO[0]) return;
      const bb = u0 * a0 + u1 * a1 + u2 * a2, cc = a0 * a0 + a1 * a1 + a2 * a2 - L * L, disc = bb * bb - cc;
      if (disc < 0) return;
      const r = Math.sqrt(disc), t1 = bb - r, t2 = bb + r, t0 = Math.abs(t1 - tm) < Math.abs(t2 - tm) ? t1 : t2;
      const t = tm + THREE.MathUtils.clamp(t0 - tm, -ALRAYO[1] * L, ALRAYO[1] * L);
      if (t > 0.02) { W[b * 3] = O[0] + u0 * t; W[b * 3 + 1] = O[1] + u1 * t; W[b * 3 + 2] = O[2] + u2 * t; }
    });
  }
  /* una lectura nueva: puntos en el mundo; t: cuándo se sacó; tLlego: cuándo llegó; pell: cuánto se
     abre el pellizco (0 = tocándose; la escala es el largo de la palma); crudo: sin filtro (el visor) */
  recibir(P, t, tLlego, pell, conf = 1, crudo = false, ojo = null, camara = null) {
    this.faltas = 0;
    /* (el filtro según de dónde viene: con la cámara, el de ejes; si cambia, sigue desde donde estaba) */
    const F = ojo && !crudo ? this.euroEjes : this.euroIso;
    if (F !== this.euro) { if (F.desde) F.desde(this.euro.x, this.euro.t); else { F.x.set(this.euro.x); F.dx.set(this.euro.dx); F.t = this.euro.t; } this.euro = F; }
    if (ojo && !crudo) { const c = centroPalma(P), rx = c[0] - ojo.x, ry = c[1] - ojo.y, rz = c[2] - ojo.z, rl = Math.hypot(rx, ry, rz) || 1; this.rayo = [rx / rl, ry / rl, rz / rl]; }
    else this.rayo = null;
    if (crudo) { this.euro.reiniciar(P, t); }
    else {
      /* si la mano estaba perdida o saltó más de 25 cm (imposible en una foto: es otra detección), el
         filtro arranca de cero; si no, mezclaba la pose vieja durante varios cuadros */
      const c = centroPalma(P), pr = this.predecirCentro(t), salto = Math.hypot(c[0] - pr[0], c[1] - pr[1], c[2] - pr[2]);
      /* una foto sola que cae lejos EN PROFUNDIDAD (lo que peor adivina una sola cámara: a veces
         pega un salto): se espera a la siguiente; si esa también, es de verdad. De costado la foto no
         se equivoca así: eso es la mano que se movió rápido */
      /* (se compara contra lo que predice el filtro Y contra la mediana de las últimas fotos, buenas o
         malas: si solo se miraba el filtro, dos malas seguidas lo corrían y después las buenas
         parecían malas; la mano se iba 13 cm para adelante) */
      if (ojo) {
        const rx = pr[0] - ojo.x, ry = pr[1] - ojo.y, rz = pr[2] - ojo.z, rl = Math.hypot(rx, ry, rz) || 1;
        const dep = ((c[0] - ojo.x) * rx + (c[1] - ojo.y) * ry + (c[2] - ojo.z) * rz) / rl, H = this.histH;
        const fueraPred = Math.abs(dep - rl) > RARA;
        const med = H.length >= 2 ? H.slice().sort((a, b) => a - b)[H.length >> 1] : null, fueraMed = med !== null && Math.abs(dep - med) > RARA;
        H.push(dep); if (H.length > 4) H.shift();
        if (this.visible && salto < 0.25 && fueraPred && fueraMed) { this.rara++; return; }
      }
      this.rara = 0;
      if (!this.visible || salto > 0.25 || t - this.t > 0.5) {
        this.euro.reiniciar(P, t, this.rayo, camara, this.derecha ? 1 : -1); this.euroRayo.t = -1; this.fijoHasta = 0;
        /* (si se estaba apagando cerca, llega deslizándose; si no, aparece donde está: se apaga la
           vieja de una y la nueva se prende suave) */
        this.seguida = this.seguida && this.alfa > 0.3 && salto < SNAP;
        if (!this.seguida) { this.alfa = 0; this.gen++; this.seguidaAncla = false; }
      } else this.euro.filtrar(P, t, this.rayo, camara, this.derecha ? 1 : -1);
      /* (la forma, de los dedos filtrados en los ejes de la palma: con el ruido de cada foto, el largo
         de los huesos salía más largo) */
      if (this.euro === this.euroEjes) { this.aprenderForma(this.euroEjes.Lf); this.euroEjes.forma = this.forma; }
    }
    /* el atraso de la cámara, promediado (así el adelanto no cambia de foto en foto) */
    const lat = THREE.MathUtils.clamp(tLlego - t, 0, 0.4);
    this.lat = this.lat > 0 ? this.lat + (lat - this.lat) * 0.1 : lat;
    this.hueco = this.t > 0 ? Math.max(0, t - this.t) : 0;   // (lo que estuvo sin fotos: el tope del resorte crece con eso)
    /* (cada cuánto llega una foto, promediado: si la que sigue no llega a tiempo, la mano sigue sola) */
    if (this.hueco > 0 && this.hueco < 0.15) this.dtFoto = this.dtFoto ? this.dtFoto + (this.hueco - this.dtFoto) * 0.1 : this.hueco;
    this.t = t; this.tLlego = tLlego; this.conf = conf; this.pell = pell; this.nueva = true;
    /* (por dónde pasó, con lo que midió la cámara: para reconocer los fantasmas de MediaPipe) */
    this.rastro.push({ t, c: centroPalma(P) }); while (this.rastro.length && t - this.rastro[0].t > 0.4) this.rastro.shift();
    if (!crudo && this.rayo) { this.medirAdelanto(t); this.medirDedos(); }
    if (!this.visible) { this.visible = true; this.pellizca = false; this.anulado = false; this.profAntes = undefined; }
  }
  /* CUÁNTO CONVIENE ADELANTAR (vuelta 24): con cada foto, lo que el adelanto habría dicho hace lo que
     tarda la foto (la velocidad de entonces por ese rato) contra lo que la mano se movió de verdad. La
     ganancia que mejor lo acierta (mínimos cuadrados, con memoria de ~0,7 s) multiplica el adelanto:
     con la mano que va pareja, 1; con la que va y viene rápido (un video de verdad: se pasaba en cada
     vuelta y el adelanto empeoraba todo), menos. Quieta no se mide (no hay nada que adelantar) */
  medirAdelanto(t) {
    const E = this.euro, H = this.hist ||= [], C = E.centro?.x || centroPalma(E.x), V = E.centro?.dx || [0, 0, 0];
    H.push({ t, c: [C[0], C[1], C[2]], v: [V[0], V[1], V[2]] }); while (H.length && t - H[0].t > 0.6) H.shift();
    const hz = Math.min(LAT_TOPE, this.lat || 0.12);
    let j = -1, mejor = 1e9; for (let i = 0; i < H.length - 1; i++) { const d = Math.abs(t - H[i].t - hz); if (d < mejor) { mejor = d; j = i; } }
    if (j < 0 || mejor > 0.035) return;
    const A = H[j], dt = t - A.t, p0 = A.v[0] * dt, p1 = A.v[1] * dt, p2 = A.v[2] * dt, G = this.ganancia ||= { num: 0, den: 0, g: 1, numH: 0, denH: 0, gh: 1 };
    const a0 = C[0] - A.c[0], a1 = C[1] - A.c[1], a2 = C[2] - A.c[2];
    /* (vuelta 25: de costado y en profundidad, cada uno con la suya. Juntas, el ruido de la profundidad de
       MediaPipe (que no se predice) entraba en lo que se adelantaba y no en lo que pasó: con la mano yendo
       pareja a 20 cm/s daba 0,3-0,5 y no 1, y de costado iba 90-170 ms atrás) */
    const r = this.rayo, ph = p0 * r[0] + p1 * r[1] + p2 * r[2], ah = a0 * r[0] + a1 * r[1] + a2 * r[2];
    const q0 = p0 - ph * r[0], q1 = p1 - ph * r[1], q2 = p2 - ph * r[2], qq = q0 * q0 + q1 * q1 + q2 * q2;
    /* (casi quieta, o lenta: lo que había que adelantar es del tamaño del ruido de la foto) */
    if (qq >= GAN_DESDE * GAN_DESDE) {
      G.num = G.num * GAN_MEM + ((a0 - ah * r[0]) * q0 + (a1 - ah * r[1]) * q1 + (a2 - ah * r[2]) * q2); G.den = G.den * GAN_MEM + qq;
      G.g = THREE.MathUtils.clamp((G.num + GAN_PREVIO) / (G.den + GAN_PREVIO), GAN_MIN, 1);
    }
    if (ph * ph >= GAN_DESDE * GAN_DESDE) {
      G.numH = G.numH * GAN_MEM + ah * ph; G.denH = G.denH * GAN_MEM + ph * ph;
      G.gh = THREE.MathUtils.clamp((G.numH + GAN_PREVIO) / (G.denH + GAN_PREVIO), GAN_MIN, 1);
    }
  }
  /* (vuelta 26: moviendo los dedos con la mano quieta, MediaPipe mueve también la palma, al compás
     (con un video de verdad: correlación 0,63). El adelanto tomaba ese vaivén como si la mano se fuera y
     lo agrandaba (en la imagen, 4,0 % de la palma contra 2,6 de MediaPipe; sin adelanto, 2,6). Si las
     puntas se mueven en la palma mucho más que la palma (DEDOS_PALMA), la palma casi no se adelanta:
     pesoDedos) */
  medirDedos() {
    const E = this.euro, Dd = E.dedos?.dx, V = E.centro?.dx; if (!Dd || !V) { this.pesoDedos = 1; return; }
    let af = 0; for (const i of PUNTA) af += Math.hypot(Dd[i * 3], Dd[i * 3 + 1], Dd[i * 3 + 2]) / 5;
    const vp = Math.hypot(V[0], V[1], V[2]);
    this.af = this.af === undefined ? af : this.af + (af - this.af) * 0.3; this.vp = this.vp === undefined ? vp : this.vp + (vp - this.vp) * 0.3;
    const r = this.vp / (this.vp + DEDOS_PALMA[2] * Math.max(0, this.af - DEDOS_PALMA[3]) + 1e-4);
    this.pesoDedos = THREE.MathUtils.smoothstep(r, DEDOS_PALMA[0], DEDOS_PALMA[1]);
  }
  /* al cuadro que se dibuja: lo filtrado más la velocidad por lo que pasó desde que LLEGÓ la foto
     (así se sigue moviendo parejo entre foto y foto) y por lo que tarda la cámara (hasta LAT_TOPE) */
  adelantar(tDibujo, adelanta) {
    const E = this.euro;
    const edad = Math.max(0, tDibujo - this.tLlego), sola = edad < HMAX ? edad : HMAX + FRENO * (1 - Math.exp(-(edad - HMAX) / FRENO));
    /* (pesoAd: con la cámara, 0 mientras la mano está anclada, quieta: ahí la velocidad del centro es
       ruido. Solo la del centro: girando en el lugar, o moviendo los dedos, el centro no se mueve y las
       anclas creían que estaba quieta; se apagaba todo el adelanto y el giro iba 20° atrás) */
    const pa = (this.pesoAd ?? 1) * (this.rayo ? this.pesoDedos ?? 1 : 1);
    const la = Math.min(LAT_TOPE, this.lat), am = AMORT + AMORT_MAS * Math.min(1, Math.max(0, (la - LAT_REF) / 0.13));
    const gan = this.rayo && this.ganancia ? this.ganancia.g : 1, ganH = this.rayo && this.ganancia ? this.ganancia.gh : 1;
    const solo = (g) => THREE.MathUtils.clamp((g - GAN_SOLA[0]) / (GAN_SOLA[1] - GAN_SOLA[0]), 0, 1), gs = solo(gan), gsH = solo(ganH);
    /* (vuelta 25: la mano que se iba por el borde de la imagen (saliendo) y cuya foto no llega en ESPERA
       intervalos salió de la cámara: además de lo de siempre, sigue con toda su velocidad y frena en
       SALIDA (ks). Antes se clavaba y se apagaba ahí. En el medio de la imagen, o sin irse hacia el
       borde, no: MediaPipe la pierde un par de fotos en los tirones, y seguir derecho con esa
       velocidad pateaba el triple) */
    const tf = (this.dtFoto || 0.034) * ESPERA, sale = adelanta && this.enBorde && edad > tf;
    const es = (g) => (sale ? (tf < HMAX ? tf : HMAX + FRENO * (1 - Math.exp(-(tf - HMAX) / FRENO))) : sola) * g;
    let k = adelanta ? (es(gs) + Math.min(this.lmax ?? LMAX, la) * gan) * am : 0;
    /* (lo que sigue de largo al salir: con su velocidad, frenando en SALIDA, y sin el tope del adelanto
       (ADEL_MAX), que a 40 cm/s la clavaba a los 50 ms) */
    const ks = sale ? SALIDA * (1 - Math.exp(-(edad - tf) / SALIDA)) * am : 0;
    /* (y a qué velocidad se mueve eso: la del filtro mientras sigue sola, frenando después) */
    const kv = adelanta ? (sale ? am * Math.exp(-(edad - tf) / SALIDA) : AMORT * pa * gs * (edad < HMAX ? 1 : Math.exp(-(edad - HMAX) / FRENO))) : 0;
    const r = this.rayo;
    if (!r) { for (let i = 0; i < 63; i++) { this.p[i] = E.x[i] + E.dx[i] * k * pa; this.vb[i] = E.dx[i] * kv; } return; }
    /* con la cámara: de costado y en profundidad, cada uno con su tope */
    let kh = adelanta ? (es(gsH) + Math.min(this.lmaxH ?? LMAX_H, la) * ganH) * am : 0;
    let c0 = 0, c1 = 0, c2 = 0; for (const i of CENTRO) { c0 += E.dx[i * 3] / 5; c1 += E.dx[i * 3 + 1] / 5; c2 += E.dx[i * 3 + 2] / 5; }
    const q = 1 - pa, vc = [c0 * q, c1 * q, c2 * q];
    /* (y lo que se corre el centro, con tope: con la foto a 0,19 s, en un manotazo a 1 m/s que va y
       vuelve el adelanto la pasaba 50 cm y después saltaba de golpe) */
    { const a0 = c0 * pa, a1 = c1 * pa, a2 = c2 * pa, ah = a0 * r[0] + a1 * r[1] + a2 * r[2];
      const d = Math.hypot((a0 - ah * r[0]) * k + ah * r[0] * kh, (a1 - ah * r[1]) * k + ah * r[1] * kh, (a2 - ah * r[2]) * k + ah * r[2] * kh);
      const am2 = this.adelMax ?? ADEL_MAX; if (d > am2) { k *= am2 / d; kh *= am2 / d; } }
    /* (vuelta 24: con la mano como cuerpo (PoseMano), el adelanto va sobre la pose: el centro se corre,
       la mano GIRA lo que va a girar (y no cada punto en línea recta por su velocidad, que con un giro
       rápido la estiraba y la doblaba: con un video de verdad, la forma al revés en el 11 % de los
       cuadros) y los dedos, lo suyo en la palma) */
    if (E.wg) {
      const C = E.centro.x, a0 = c0 * pa, a1 = c1 * pa, a2 = c2 * pa, ah = a0 * r[0] + a1 * r[1] + a2 * r[2];
      const d0 = (a0 - ah * r[0]) * k + ah * r[0] * kh + c0 * ks, d1 = (a1 - ah * r[1]) * k + ah * r[1] * kh + c1 * ks, d2 = (a2 - ah * r[2]) * k + ah * r[2] * kh + c2 * ks;
      /* (cuánto: el arcotangente de lo que giraría, como hacía ir en línea recta, que nunca pasa de 90°;
         girar todo lo que da la velocidad, a 20 rad/s por 0,16 s, eran 3 rad de más) */
      _ve.copy(E.wg).multiplyScalar(k * (this.pesoDedos ?? 1)); { const a = _ve.length(); if (a > 1e-6) _ve.multiplyScalar(Math.atan(a) * (this.giroAd ?? GIRO_AD) / a); }
      const Q = expQ(_ve, _qg), W = E.wg;
      for (let i = 0; i < 63; i += 3) {
        const x0 = E.x[i] - C[0], x1 = E.x[i + 1] - C[1], x2 = E.x[i + 2] - C[2];
        /* (lo de los dedos en la palma: lo que queda de la velocidad sin el centro ni el giro) */
        const l0 = E.dx[i] - c0 - (W.y * x2 - W.z * x1), l1 = E.dx[i + 1] - c1 - (W.z * x0 - W.x * x2), l2 = E.dx[i + 2] - c2 - (W.x * x1 - W.y * x0);
        _vr.set(x0, x1, x2).applyQuaternion(Q);
        this.p[i] = C[0] + d0 + _vr.x + l0 * k; this.p[i + 1] = C[1] + d1 + _vr.y + l1 * k; this.p[i + 2] = C[2] + d2 + _vr.z + l2 * k;
        this.vb[i] = E.dx[i] * kv; this.vb[i + 1] = E.dx[i + 1] * kv; this.vb[i + 2] = E.dx[i + 2] * kv;
      }
      return;
    }
    for (let i = 0; i < 63; i += 3) {
      const vx = E.dx[i] - vc[0], vy = E.dx[i + 1] - vc[1], vz = E.dx[i + 2] - vc[2], vh = vx * r[0] + vy * r[1] + vz * r[2];
      const w = [vx, vy, vz];
      for (let c = 0; c < 3; c++) { const v = w[c], h = vh * r[c]; this.p[i + c] = E.x[i + c] + (v - h) * k + h * kh + (c === 0 ? c0 : c === 1 ? c1 : c2) * ks; this.vb[i + c] = E.dx[i + c] * kv; }
    }
  }
  /* la velocidad del centro de la palma, del filtro (m/s) */
  velCentro() { const D = this.euro.dx; let a = 0, b = 0, c = 0; for (const i of CENTRO) { a += D[i * 3] / 5; b += D[i * 3 + 1] / 5; c += D[i * 3 + 2] / 5; } return Math.hypot(a, b, c); }
  /* quieta, no tiembla: dos anclas, una de costado y otra en profundidad (a lo largo del rayo de los
     ojos a la mano). Si el centro de la mano no sale de su zona durante un rato, lo que se muestra se
     queda quieto en ese eje: el temblor de la foto no la mueve. Si se sale, la arrastra (queda en el
     borde); si la arrastra un rato seguido, es que se mueve de verdad: se suelta y va sin freno (como
     un Quest). La de profundidad es más grande (ahí está casi todo el temblor de una sola cámara, y
     acercar y alejar la mano se nota menos); la de costado, chica (para apuntar no se pega). Es un
     corrimiento de toda la mano: los dedos siguen con lo suyo. z: las zonas (SUAVIDAD › anclas) */
  estabilizar(dt, z) {
    const p = this.p, c = centroPalma(p), r = this.rayo || [0, 0, -1], cf = centroPalma(this.euro.x);
    const hondo = (a, b) => (a[0] - b[0]) * r[0] + (a[1] - b[1]) * r[1] + (a[2] - b[2]) * r[2];
    const lado = (a, b) => { const h = hondo(a, b); return [a[0] - b[0] - h * r[0], a[1] - b[1] - h * r[1], a[2] - b[2] - h * r[2]]; };
    if (!this.seguidaAncla || this.zonas !== z) {
      this.anclas = [{ zona: z.rl, tq: z.tq, te: z.te, ts: z.ts, vs: z.vs }, { zona: z.rh, tq: z.tqH, te: z.teH, ts: z.tsH, vs: z.vsH }].map((a) => ({ ...a, quieta: false, ref: cf.slice(), A: c.slice(), tQ: 0, empuje: 0, o: [0, 0, 0] }));
      this.seguidaAncla = true; this.zonas = z; this.pesoAd = 1;
    }
    let quietas = 0;
    /* (la velocidad del centro, de costado y en profundidad: con el borde empujado y más rápido que vs
       (m/s), se suelta ya, sin esperar te: quieta, la velocidad no llega a tanto) */
    const V = this.euro.dx; let v0 = 0, v1 = 0, v2 = 0; for (const i of CENTRO) { v0 += V[i * 3] / 5; v1 += V[i * 3 + 1] / 5; v2 += V[i * 3 + 2] / 5; }
    const vh = v0 * r[0] + v1 * r[1] + v2 * r[2], vel = [Math.hypot(v0 - vh * r[0], v1 - vh * r[1], v2 - vh * r[2]), Math.abs(vh)];
    for (const [k, an] of this.anclas.entries()) {
      /* (lo que va de a hasta b en este eje: de costado, un vector en el plano de la foto; en profundidad, a lo largo del rayo) */
      const parte = (a, b) => { if (k === 0) return lado(a, b); const h = hondo(a, b); return [h * r[0], h * r[1], h * r[2]]; };
      const largo = (v) => Math.hypot(v[0], v[1], v[2]);
      if (largo(parte(cf, an.ref)) > an.zona) { an.ref = cf.slice(); an.tQ = 0; } else an.tQ += dt;
      const o = an.o;
      if (!an.quieta) {
        const e = Math.exp(-dt / an.ts); o[0] *= e; o[1] *= e; o[2] *= e;
        if (an.tQ > an.tq) { an.quieta = true; an.empuje = 0; an.A = [c[0] + o[0], c[1] + o[1], c[2] + o[2]]; }
      } else {
        /* (ASIENTA, vuelta 22: quieta, el ancla va de a poco hacia donde está la mano filtrada. Se
           anclaba donde se mostraba en ese momento, con lo que quedaba del adelanto: después de un
           manotazo quedaba corrida hasta el borde de la zona, 5 mm de costado y 11 en profundidad) */
        if (ASIENTA && k === 1) { const g = 1 - Math.exp(-dt / ASIENTA), w = parte(cf, an.A); for (let j = 0; j < 3; j++) an.A[j] += w[j] * g; }
        const d = parte(an.A, c), L = largo(d);
        if (L > an.zona) {
          const f = an.zona / L; o[0] = d[0] * f; o[1] = d[1] * f; o[2] = d[2] * f;
          /* (el ancla se corre con la mano, en este eje) */
          for (let j = 0; j < 3; j++) an.A[j] += d[j] * (f - 1);
          an.empuje += dt; if (an.empuje > an.te || (an.vs && vel[k] > an.vs)) { an.quieta = false; an.ref = cf.slice(); an.tQ = 0; }
        } else { o[0] = d[0]; o[1] = d[1]; o[2] = d[2]; an.empuje = Math.max(0, an.empuje - dt); }
      }
      if (an.quieta) quietas++;
    }
    /* el adelanto: nada con las dos anclas puestas; todo apenas se suelta una */
    this.pesoAd += ((quietas === 2 ? 0 : 1) - this.pesoAd) * (1 - Math.exp(-dt / (quietas === 2 ? 0.1 : 0.03)));
    this.quieta = quietas === 2;
    const [a, b] = this.anclas;
    for (let i = 0; i < 63; i += 3) { p[i] += a.o[0] + b.o[0]; p[i + 1] += a.o[1] + b.o[1]; p[i + 2] += a.o[2] + b.o[2]; }
  }
  /* la forma de la mano de quien juega, de los dedos filtrados en los ejes de la palma (L, 21 puntos con
     el centro de la palma en 0): el largo de cada hueso de los dedos y el molde de la palma. Promedio de
     las primeras 60 y después lento (1 %: con más rápido, el largo iba y venía con el ruido); una foto
     con un hueso mucho más largo o más corto no cuenta */
  aprenderForma(L) {
    const F = this.forma ||= { n: 0, largo: new Float32Array(TRAMOS_DEDO.length), palma: new Float32Array(18) };
    const a = F.n < 60 ? 1 / (F.n + 1) : 0.01;
    const largos = TRAMOS_DEDO.map(([i, j]) => Math.hypot(L[i * 3] - L[j * 3], L[i * 3 + 1] - L[j * 3 + 1], L[i * 3 + 2] - L[j * 3 + 2]));
    if (F.n >= 20 && largos.some((l, k) => l > F.largo[k] * 1.35 || l < F.largo[k] * 0.7)) return;
    largos.forEach((l, k) => { F.largo[k] += (l - F.largo[k]) * a; });
    PALMA6.forEach((i, k) => { for (let q = 0; q < 3; q++) F.palma[k * 3 + q] += (L[i * 3 + q] - F.palma[k * 3 + q]) * a; });
    F.n++;
  }
  /* que la mano dibujada tenga siempre la misma forma. Filtrar y adelantar cada punto por su cuenta la
     estiraba: al girar o ir rápido, la punta de un dedo va más rápido que la muñeca y se adelanta más
     (medido: en el 5 % de los cuadros, algún hueso un 45 % más largo o más corto). La palma va con su
     molde, en el centro y con los ejes de lo que se ve; cada dedo, hueso por hueso, con la dirección de
     lo que se ve y su largo de siempre */
  enderezar() {
    const F = this.forma; if (!F || F.n < 5) return;
    const p = this.p, o = this._o ||= new Float32Array(63), e = ejesPalma(p, this._e ||= new Float32Array(9)), c = centroPalma(p);
    o.set(p);
    PALMA6.forEach((i, k) => { for (let q = 0; q < 3; q++) p[i * 3 + q] = c[q] + F.palma[k * 3] * e[q] + F.palma[k * 3 + 1] * e[3 + q] + F.palma[k * 3 + 2] * e[6 + q]; });
    TRAMOS_DEDO.forEach(([a, b], k) => {
      const d0 = o[b * 3] - o[a * 3], d1 = o[b * 3 + 1] - o[a * 3 + 1], d2 = o[b * 3 + 2] - o[a * 3 + 2], l = Math.hypot(d0, d1, d2) || 1, f = F.largo[k] / l;
      p[b * 3] = p[a * 3] + d0 * f; p[b * 3 + 1] = p[a * 3 + 1] + d1 * f; p[b * 3 + 2] = p[a * 3 + 2] + d2 * f;
    });
  }
  /* sin saltos: con cada foto nueva, la diferencia entre lo que se venía mostrando y lo nuevo se
     reparte con un resorte crítico (ni la posición ni la velocidad pegan un salto: se ve como un
     movimiento, no como un tirón) */
  suavizar(dt) {
    const p = this.p, off = this.off, oV = this.offV, bA = this.pAnt, vbA = this.vAnt, vb = this.vb, h = Math.min(dt, 1 / 30);
    if (!this.seguida) { off.fill(0); oV.fill(0); }
    else if (this.nueva) {
      /* el resorte se queda con lo que saltó lo de abajo (contra dónde iba a estar sin la foto nueva, y
         a qué velocidad) y sigue con su propio movimiento. (No con la velocidad de lo que se veía: esa
         incluye al resorte, y con una foto por cuadro se pasaba de largo cuadro por medio) */
      /* (RESORTE_V: cuánto del cambio de velocidad se queda el resorte. Todo: la velocidad nunca salta,
         pero al frenar en seco la mano sigue de largo lo que tarda el resorte) */
      for (let i = 0; i < 63; i++) { off[i] -= p[i] - (bA[i] + vbA[i] * h); oV[i] -= (vb[i] - vbA[i]) * RESORTE_V; }
      /* (moviéndose rápido, tras un rato sin que la red la vea, el salto puede ser grande y es la misma mano: el
         tope crece con el hueco; si no, se iba de golpe 40 cm) */
      const c = centroPalma(off); if (Math.hypot(c[0], c[1], c[2]) > SNAP + 2 * Math.min(0.3, this.hueco || 0)) { off.fill(0); oV.fill(0); }
    }
    /* (después de un salto grande, la mano va de viaje hasta que llega: la yema no toca nada, así
       no aprieta el menú de pasada. El rayo sí: apunta desde donde está de verdad) */
    const oc = centroPalma(off), lejos = Math.hypot(oc[0], oc[1], oc[2]);
    this.viaja = this.nueva && lejos > 0.08 ? true : this.viaja && lejos > 0.015;
    this.nueva = false;
    /* (la cuenta exacta del resorte crítico: estable con cualquier paso) */
    /* (vuelta 28: el resorte crítico atrasa lo que no se adelantó unas 2 TAU (64 ms). Con la mano que va
       rápido, lo que salta de foto a foto es movimiento y no ruido: se reparte en TAU_RAPIDA. Y con la
       cámara a 60, en la mitad: las fotos vienen a la mitad de distancia) */
    const tau = (TAU + (TAU_RAPIDA - TAU) * THREE.MathUtils.smoothstep(this.velCentro(), TAU_VEL[0], TAU_VEL[1])) * Math.min(1, (this.dtFoto || TAU_FOTO) / TAU_FOTO);
    const w = 1 / tau, e = Math.exp(-w * h);
    for (let i = 0; i < 63; i++) {
      const x0 = off[i], v0 = oV[i], a = v0 + w * x0;
      off[i] = (x0 + a * h) * e; oV[i] = (v0 - w * a * h) * e;
      bA[i] = p[i]; vbA[i] = vb[i];
      p[i] += off[i];
    }
    this.seguida = true; this.conResorte = true;
  }
}

/* -------------------------------------------------- la cápsula que arma el shader */
function geoCapsula(seg = 10, anillos = 4) {
  const pos = [], nrm = [], lado = [], idx = [];
  /* media esfera de abajo (lado 0, en A) y de arriba (lado 1, en B): el ecuador está dos veces y
     entre las dos queda el tubo */
  const filas = [];
  for (let h = 0; h < 2; h++) for (let j = 0; j <= anillos; j++) {
    const lat = h === 0 ? -Math.PI / 2 + (j / anillos) * Math.PI / 2 : (j / anillos) * Math.PI / 2;
    const fila = [];
    for (let s = 0; s <= seg; s++) {
      const lon = s / seg * Math.PI * 2, x = Math.cos(lat) * Math.cos(lon), y = Math.cos(lat) * Math.sin(lon), z = Math.sin(lat);
      fila.push(pos.length / 3); pos.push(0, 0, 0); nrm.push(x, y, z); lado.push(h);
    }
    filas.push(fila);
  }
  for (let r = 0; r < filas.length - 1; r++) for (let s = 0; s < seg; s++) {
    const a = filas[r][s], b = filas[r][s + 1], c = filas[r + 1][s], d = filas[r + 1][s + 1];
    /* (de afuera, en contra del reloj: la cara que se ve es la de afuera. Estuvo al revés hasta la
       vuelta 14: se veía el lado de adentro de cada dedo, todo borde y blanco) */
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('nrm', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('lado', new THREE.Float32BufferAttribute(lado, 1));
  const n = N * 2;
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iR', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iBr', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}
const VERT_MANO = /* glsl */`
  attribute vec3 nrm, iA, iB; attribute float lado; attribute vec2 iR, iBr;
  uniform float uCorte;
  varying vec3 vN, vV; varying float vBr, vAlfa, vLado;
  void main() {
    /* (la pasada de profundidad no va para una mano que se está apagando: si no, tapaba lo de atrás
       mientras se desvanece) */
    if (iBr.y < uCorte) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
    vec3 d = iB - iA; float L = length(d); vec3 w = L > 1e-5 ? d / L : vec3(0.0, 1.0, 0.0);
    vec3 up = abs(w.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 u = normalize(cross(up, w)), v = cross(w, u);
    vec3 n = u * nrm.x + v * nrm.y + w * nrm.z;
    vec3 p = (lado < 0.5 ? iA : iB) + n * (lado < 0.5 ? iR.x : iR.y);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vN = normalize(mat3(viewMatrix) * n); vV = normalize(-mv.xyz); vBr = iBr.x; vAlfa = iBr.y; vLado = lado;
    gl_Position = projectionMatrix * mv;
  }`;
/* vidrio Aero: blanco celeste, el borde que brilla (fresnel), un reflejo arriba y el pellizco que se
   enciende. Sin luces de la escena: van por ojo y tienen que ser baratas */
const FRAG_MANO = /* glsl */`
  uniform vec3 uColor, uBorde; uniform float uOpacidad, uFantasma;
  varying vec3 vN, vV; varying float vBr, vAlfa, vLado;
  void main() {
    vec3 n = normalize(vN), v = normalize(vV);
    float f = pow(1.0 - max(0.0, dot(n, v)), 2.0);
    /* una luz de arriba a la izquierda (en la vista) y el cielo: los dedos se separan por la sombra */
    float luz = max(0.0, dot(n, normalize(vec3(-0.35, 0.85, 0.4)))), cielo = 0.5 + 0.5 * n.y;
    float brillo = pow(max(0.0, dot(reflect(-v, n), normalize(vec3(-0.3, 0.8, 0.5)))), 28.0);
    vec3 c = mix(vec3(0.34, 0.43, 0.55), uColor, 0.18 + 0.62 * luz + 0.2 * cielo);
    /* el borde claro recorta cada dedo contra el fondo (como las manos de Quest) */
    c = mix(c, uBorde, smoothstep(0.22, 0.88, f) * 0.88) + vec3(1.0) * brillo * 0.5;
    /* el pellizco se enciende en las puntas */
    c = mix(c, vec3(0.5, 1.0, 1.0), vBr * (0.4 + 0.6 * f));
    /* el borde, suave en un píxel (si no, el contorno claro de cada dedo titila al moverse) */
    float ndv = max(0.0, dot(n, v)), aa = clamp(ndv / max(fwidth(ndv) * 1.5, 1e-4), 0.0, 1.0);
    /* (fantasma, vuelta 34: como las manos de un Quest, casi solo el borde que brilla; en tu espacio, del todo,
       porque la mano de verdad se ve en la cámara) */
    float a = mix(uOpacidad * (0.72 + 0.28 * f), 0.05 + 0.7 * smoothstep(0.3, 0.95, f), uFantasma);
    c = mix(c, uBorde, uFantasma * 0.55);
    gl_FragColor = vec4(c, clamp((a + vBr * 0.25) * vAlfa * aa, 0.0, 1.0));
  }`;

/* -------------------------------------------------- el menú de la muñeca */
/* (vuelta 34) cuándo la palma abre el menú: cara, cuánto mira la palma a la cara (el coseno; sigue: ya mostrando
   el botón); mira: el ángulo entre la mirada y la palma (rad); t: cuánto tiempo seguido (s); abierta: las puntas
   de mayor, anular y meñique a más de tantas veces el largo de la palma de la muñeca (en un puño, ~1) */
const MENU_PALMA = { cara: 0.72, sigue: 0.55, mira: 0.5, miraSigue: 0.65, t: 0.25, abierta: 1.55 };
/* cuánto fantasma las manos en el juego (0: vidrio entero; 1: solo el borde) */
const FANTASMA_JUEGO = 0.35;
const BOTONES = ['mn_caminar', 'mn_izq', 'mn_der', 'mn_fps', 'mn_ventanas', 'mn_lentes', 'mn_salir', 'mn_mando'];
class Menu {
  constructor() {
    this.lienzo = document.createElement('canvas'); this.lienzo.width = 512; this.lienzo.height = 300;
    this.tex = new THREE.CanvasTexture(this.lienzo); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.malla.visible = false; this.malla.renderOrder = 5;
    this.sobre = -1; this.apretado = -1; this.abierto = false; this.fps = false; this.camina = false;
    /* los botones en la textura (x, y, ancho, alto), en píxeles del lienzo */
    /* (vuelta 29: con las ventanas de prueba, abajo son tres; vuelta 30, con las lentes, cuatro) */
    /* (vuelta 40: arriba a la derecha, el control en la mano, prendido o apagado) */
    this.cajas = [[20, 70, 230, 90], [262, 70, 110, 90], [382, 70, 110, 90], [20, 180, 86, 90], [114, 180, 136, 90], [258, 180, 116, 90], [382, 180, 110, 90], [292, 12, 200, 50]];
    this.mando = true;
    this.pintar();
  }
  pintar() {
    const c = this.lienzo.getContext('2d'), W = 512, H = 300;
    c.clearRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(235,250,255,0.92)'); g.addColorStop(1, 'rgba(160,220,255,0.88)');
    c.fillStyle = g; c.beginPath(); c.roundRect(4, 4, W - 8, H - 8, 34); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 5; c.stroke();
    c.fillStyle = '#12507a'; c.font = '800 34px system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('🥽 ' + t('mn_titulo'), 26, 48);
    this.cajas.forEach(([x, y, w, h], i) => {
      const s = i === this.sobre, a = i === this.apretado;
      const gb = c.createLinearGradient(0, y, 0, y + h);
      gb.addColorStop(0, a ? '#7fd8ff' : s ? '#ffffff' : '#e9f8ff'); gb.addColorStop(1, a ? '#2aa6e8' : s ? '#bfe9ff' : '#a9dcf7');
      c.fillStyle = gb; c.beginPath(); c.roundRect(x, y + (a ? 4 : 0), w, h - 4, 24); c.fill();
      c.strokeStyle = s ? '#2aa6e8' : 'rgba(255,255,255,0.9)'; c.lineWidth = s ? 6 : 3; c.stroke();
      c.fillStyle = i === 6 ? '#b3261e' : '#0f3f63'; c.font = `800 ${i >= 3 ? 21 : 28}px system-ui, sans-serif`; c.textAlign = 'center';
      c.fillText(i === 0 && this.camina ? t('mn_parar') : t(BOTONES[i]) + ((i === 3 && this.fps) || (i === 7 && this.mando) ? ' ✓' : ''), x + w / 2, y + h / 2 + 8 + (a ? 4 : 0));
    });
    this.tex.needsUpdate = true;
  }
  /* se abre delante de la cara, a la altura del pecho y mirándola */
  abrir(cabezaP, cabezaQ) {
    _a.set(0, 0, -1).applyQuaternion(cabezaQ); _a.y = 0; if (_a.lengthSq() < 1e-4) _a.set(0, 0, -1); _a.normalize();
    this.malla.position.copy(cabezaP).addScaledVector(_a, 0.42); this.malla.position.y -= 0.16;
    this.malla.lookAt(cabezaP.x, cabezaP.y - 0.05, cabezaP.z);
    this.malla.visible = this.abierto = true; this.malla.updateMatrixWorld(); this.pintar();
  }
  cerrar() { this.malla.visible = this.abierto = false; }
  /* un punto del mundo, al botón (o -1) y la distancia al plano (positiva adelante) */
  enPunto(p) {
    const inv = _m.copy(this.malla.matrixWorld).invert(); _b.copy(p).applyMatrix4(inv);
    const u = (_b.x / 0.34 + 0.5) * 512, v = (0.5 - _b.y / 0.2) * 300;
    const i = this.cajas.findIndex(([x, y, w, h]) => u >= x && u <= x + w && v >= y && v <= y + h);
    return { i, prof: _b.z };
  }
  /* el rayo contra el plano del menú */
  enRayo(o, d) {
    const n = _c.set(0, 0, 1).applyQuaternion(this.malla.quaternion), den = n.dot(d); if (Math.abs(den) < 1e-4) return null;
    const k = _d.copy(this.malla.position).sub(o).dot(n) / den; if (k < 0 || k > 3) return null;
    const p = o.clone().addScaledVector(d, k), r = this.enPunto(p); return r.i >= 0 ? { ...r, p, k } : { i: -1, p, k };
  }
}

/* -------------------------------------------------- el objeto en la mano (vuelta 40)
   "Detectar un objeto en la mano como un control": un palo, una linterna, un control remoto, una botella. Sin ver el
   objeto: por cómo se cierran los dedos alrededor.
   - AGARRA: al menos MANDO.dedos de los cuatro dedos (índice a meñique) doblados más de MANDO.curva (lo que se doblan
     el segundo y el tercer nudillo, rad) y con la punta a entre MANDO.hueco veces el largo de la palma del nudillo: un
     puño apretado queda más cerca (en la cuenta, 0,30) y la mano abierta o en garra, más lejos o casi derecha.
   - EL EJE del objeto: los dedos se doblan alrededor de él, así que es la normal del plano en que se dobla cada dedo;
     mezclada con la línea de los nudillos (del meñique al índice, un poco hacia los dedos), que no tiembla porque la
     palma es un molde. Va del lado del pulgar: se apunta como con una linterna.
   - EL CENTRO: el promedio de los dedos que lo rodean.
   - EL GATILLO (Manos.medirMando): el índice que se dobla más que su reposo (agarrado como una pistola: los otros tres
     alrededor y el índice en el gatillo) o el pulgar que baja hacia el índice (como en una linterna) */
export const MANDO = { curva: 1.9, hueco: [0.36, 0.82], dedos: 3, entra: 0.35, sale: 0.3, largo: 0.16, suave: 0.06, gatillo: [0.5, 0.3], pulgar: [0.22, 0.12], sube: 0.4 };
const DEDOS4 = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const _agarre = { n: 0, eje: [0, 0, 1], centro: [0, 0, 0], dobleIndice: 0, pulgar: 0 };
export function medirAgarre(P, o = { n: 0, eje: [0, 0, 1], centro: [0, 0, 0], dobleIndice: 0, pulgar: 0 }) {
  const v = (i, r = []) => { r[0] = P[i * 3]; r[1] = P[i * 3 + 1]; r[2] = P[i * 3 + 2]; return r; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a) => Math.hypot(a[0], a[1], a[2]) || 1e-9;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b)))));
  const w = v(0), L = len(sub(v(9), w)), lado = sub(v(5), v(17)), arriba = sub(v(9), w);
  let n = 0; const nor = [0, 0, 0], cen = [0, 0, 0];
  for (const [k, [a0, b0, c0, e0]] of DEDOS4.entries()) {
    const a = v(a0), b = v(b0), c = v(c0), e = v(e0), s1 = sub(b, a), s2 = sub(c, b), s3 = sub(e, c);
    const doble = ang(s1, s2) + ang(s2, s3), hueco = len(sub(e, a)) / L;
    if (k === 0) o.dobleIndice = doble;
    if (doble > MANDO.curva && hueco > MANDO.hueco[0] && hueco < MANDO.hueco[1]) {
      n++;
      const m = cruz(s1, s3), lm = len(m);
      if (lm > 1e-6) { const sg = dot(m, lado) < 0 ? -1 : 1; for (let q = 0; q < 3; q++) nor[q] += sg * m[q] / lm; }
      for (let q = 0; q < 3; q++) cen[q] += (a[q] + b[q] + c[q] + e[q]) / 4;
    }
  }
  const ll = len(lado), la = len(arriba), palma = [lado[0] / ll + 0.1 * arriba[0] / la, lado[1] / ll + 0.1 * arriba[1] / la, lado[2] / ll + 0.1 * arriba[2] / la];
  const lp = len(palma), ln = len(nor), e = [0, 0, 0];
  for (let q = 0; q < 3; q++) e[q] = palma[q] / lp * 0.5 + (ln > 1e-6 ? nor[q] / ln * 0.5 : palma[q] / lp * 0.5);
  const le = len(e); o.eje[0] = e[0] / le; o.eje[1] = e[1] / le; o.eje[2] = e[2] / le;
  if (n) { o.centro[0] = cen[0] / n; o.centro[1] = cen[1] / n; o.centro[2] = cen[2] / n; }
  else { const m9 = v(9); o.centro[0] = (w[0] + m9[0]) / 2; o.centro[1] = (w[1] + m9[1]) / 2; o.centro[2] = (w[2] + m9[2]) / 2; }
  o.pulgar = len(sub(v(4), v(6))) / L;
  o.n = n;
  return o;
}
/* el control que se dibuja: una cápsula de vidrio celeste (como las manos: brillo arriba, borde claro) con la punta
   que brilla, y más al apretar */
const VERT_MANDO = /* glsl */`
  varying vec3 vN, vV; varying float vY;
  void main() { vY = position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`;
const FRAG_MANDO = /* glsl */`
  uniform float uAlfa, uGat, uT; uniform float uLargo;
  varying vec3 vN, vV; varying float vY;
  void main() {
    vec3 n = normalize(vN), v = normalize(vV);
    float f = 1.0 - max(dot(n, v), 0.0), y = vY / uLargo + 0.5;
    /* (azul Aero: más hondo abajo, celeste arriba, una franja de brillo blanco a lo largo y el borde claro; la punta
       verde lima que late, dorada al apretar, y un anillo más oscuro que la separa del cuerpo) */
    vec3 c = mix(vec3(0.02, 0.36, 0.78), vec3(0.35, 0.82, 1.0), smoothstep(-0.2, 1.0, n.y * 0.5 + 0.5));
    c += vec3(1.0) * pow(max(dot(reflect(-v, n), normalize(vec3(0.3, 0.8, 0.5))), 0.0), 32.0) * 1.1;
    c += vec3(0.9, 0.98, 1.0) * smoothstep(0.55, 0.9, abs(n.x)) * 0.35;
    c = mix(c, vec3(0.8, 0.97, 1.0), pow(f, 2.5) * 0.6);
    float punta = smoothstep(0.84, 0.95, y), anillo = smoothstep(0.78, 0.8, y) - smoothstep(0.82, 0.84, y), ola = 0.5 + 0.5 * sin(uT * 6.0 - y * 18.0);
    c = mix(c, vec3(0.03, 0.2, 0.42), anillo * 0.8);
    c = mix(c, mix(vec3(0.55, 1.0, 0.35), vec3(1.0, 0.86, 0.3), uGat) * (1.15 + 0.35 * ola), punta);
    c += vec3(0.5, 0.95, 1.0) * uGat * 0.3 * (1.0 - y);
    gl_FragColor = vec4(c, uAlfa * (0.9 + 0.1 * f));
  }`;
function crearMando() {
  const U = { uAlfa: { value: 0 }, uGat: { value: 0 }, uT: { value: 0 }, uLargo: { value: MANDO.largo } };
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.019, MANDO.largo - 0.038, 6, 18), new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT_MANDO, fragmentShader: FRAG_MANDO, transparent: true, depthWrite: true }));
  m.renderOrder = 2; m.visible = false; m.frustumCulled = false; m.userData.U = U;
  return m;
}

/* -------------------------------------------------- todo junto */
const CLAVE_ESCALA = 'aeroplaza.escalaMano';
export class Manos {
  constructor() {
    this.escena = new THREE.Scene();
    this.manos = [new Mano(false), new Mano(true)];
    this.activa = false; this.fuente = null; this.adelanta = true;
    this.suavidad = 'media';   // con la cámara: 'rapida', 'media' o 'suave' (SUAVIDAD; lo elige el menú del VR)
    this.cabeza = [];   // la pose de la cabeza en cada cuadro (para poner en el mundo lo que vio la cámara)
    const g = this.geo = geoCapsula();
    const U = this.uManos = { uColor: { value: new THREE.Vector3(0.8, 0.88, 0.96) }, uBorde: { value: new THREE.Vector3(0.72, 0.97, 1.0) }, uOpacidad: { value: 0.88 }, uFantasma: { value: FANTASMA_JUEGO } };
    /* (cuánto fantasma: en el juego un poco, en tu espacio del todo; espacio.js lo pone) */
    this.fantasma = FANTASMA_JUEGO;
    /* primero solo la profundidad; después el vidrio encima, sin verse doble */
    this.prof = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { uCorte: { value: 0.6 } }, vertexShader: VERT_MANO, fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }', colorWrite: false }));
    U.uCorte = { value: -1 };
    this.vidrio = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT_MANO, fragmentShader: FRAG_MANO, transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth }));
    this.prof.frustumCulled = this.vidrio.frustumCulled = false; this.prof.renderOrder = 1; this.vidrio.renderOrder = 2;
    this.escena.add(this.prof, this.vidrio);
    /* el rayo (un tubito que se apaga), el cursor, el arco del salto y el aro donde cae */
    const matRayo = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uFuerza: { value: 0 } },
      vertexShader: 'varying float vY; void main() { vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uFuerza; varying float vY; void main() { gl_FragColor = vec4(mix(vec3(0.85, 0.97, 1.0), vec3(0.4, 0.9, 1.0), uFuerza), (1.0 - vY) * (0.55 + 0.4 * uFuerza)); }' });
    this.rayos = this.manos.map(() => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0035, 1, 6, 1, true), matRayo.clone()); r.visible = false; r.renderOrder = 3; this.escena.add(r); return r; });
    const matCursor = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthTest: false, toneMapped: false });
    this.cursores = this.manos.map(() => { const c = new THREE.Mesh(new THREE.RingGeometry(0.55, 1, 24), matCursor.clone()); c.visible = false; c.renderOrder = 6; this.escena.add(c); return c; });
    this.puntos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: '#bff4ff', transparent: true, opacity: 0.85, toneMapped: false }), 32);
    this.puntos.count = 0; this.puntos.frustumCulled = false; this.puntos.renderOrder = 3; this.escena.add(this.puntos);
    this.aro = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7dfcc0', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    this.aro.visible = false; this.aro.renderOrder = 3; this.escena.add(this.aro);
    /* el botoncito que aparece arriba de la palma cuando mira a la cara */
    this.boton = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshBasicMaterial({ color: '#9ff3ff', transparent: true, opacity: 0.9, toneMapped: false }));
    this.boton.visible = false; this.escena.add(this.boton);
    this.menu = new Menu(); this.escena.add(this.menu.malla);
    /* (vuelta 40) el objeto en la mano como control: si se busca, y el control que se dibuja en cada mano */
    this.conMando = true; this.mandoVisto = false;
    this.mandos = this.manos.map(() => { const m = crearMando(); this.escena.add(m); return m; });
    /* el cartel de lo que se apunta */
    this.cartelL = document.createElement('canvas'); this.cartelL.width = 512; this.cartelL.height = 96;
    this.cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(this.cartelL), depthTest: false, transparent: true, toneMapped: false }));
    this.cartel.material.map.colorSpace = THREE.SRGBColorSpace; this.cartel.visible = false; this.cartel.renderOrder = 7; this.escena.add(this.cartel);
    this.objetivo = null; this.salto = null; this.eventos = []; this.tAnt = -1; this.tCapUlt = -1e9; this.prueba = [];
    /* LA ESCALA DE LA MANO DE QUIEN JUEGA (vuelta 29, js/espacio.js: medida con las manos sobre la mesa).
       MediaPipe saca la distancia de la mano de su tamaño, suponiendo una mano promedio: una mano más chica
       queda más lejos de lo que está. Con la mesa medida por ARCore se sabe cuánto: todo lo de la cámara se
       agranda o achica eso desde la cámara (en la imagen no se mueve nada, solo la distancia) */
    this.escalaMano = 1; try { const e = +localStorage.getItem(CLAVE_ESCALA); if (e >= 0.6 && e <= 1.6) this.escalaMano = e; } catch { /* sin guardar */ }
    this.stats = { lecturas: 0, dibujos: 0, msActualizar: 0 };
  }
  ponerEscala(k) {
    this.escalaMano = k; try { localStorage.setItem(CLAVE_ESCALA, String(k)); } catch { /* sin guardar */ }
    /* (el tamaño aprendido era con la escala de antes: se vuelve a aprender) */
    for (const M of this.manos) M.tam = null;
  }
  /* ------------------------------------------ la cabeza en cada cuadro (t en ms, como performance.now) */
  registrarCabeza(t, q, p, giro = 0) {
    const c = this.cabeza.length >= 96 ? this.cabeza.shift() : { q: new THREE.Quaternion(), p: new THREE.Vector3() };
    c.t = t; c.q.copy(q); c.p.copy(p); c.giro = giro; this.cabeza.push(c);
  }
  /* la cabeza en el momento t (interpolando entre dos cuadros) */
  cabezaEn(t, q, p) {
    const C = this.cabeza; if (!C.length) return false;
    let i = C.length - 1; while (i > 0 && C[i].t > t) i--;
    const a = C[i], b = C[Math.min(C.length - 1, i + 1)], k = b.t > a.t ? THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    q.slerpQuaternions(a.q, b.q, k); p.lerpVectors(a.p, b.p, k);
    if (a.giro) q.multiply(_q.setFromAxisAngle(_d.set(0, 0, 1), a.giro));
    return true;
  }
  /* ------------------------------------------ lo que llega de la cámara (puntos en la cámara de three).
     tCaptura: cuándo se sacó la foto; tLlego: cuándo volvió de la red (ms, como performance.now) */
  recibirCamara(lista, tCaptura, tLlego = performance.now(), cupo = 2) {
    /* cupo: cuántas manos buscaba la red en esa foto (manos-camara.js: con una sola a la vista, busca
       una; que no esté la otra no quiere decir que se perdió).
       Con dos redes una foto puede llegar después que la siguiente: sirve para la mano que la nueva
       no traía (la que buscaba la otra red); para las demás es vieja (se fija mano por mano) */
    const q = new THREE.Quaternion(), p = new THREE.Vector3();
    if (!this.cabezaEn(tCaptura, q, p)) return;
    const vieja = tCaptura <= this.tCapUlt;
    if (!vieja) this.tCapUlt = tCaptura;
    const ts = tCaptura / 1000, tl = tLlego / 1000;
    /* (de dónde salen los rayos de la foto: la cámara, unos centímetros adelante de los ojos) */
    const camO = _e.set(0, 0, -0.06).applyQuaternion(q).add(p).toArray();
    const ke = this.escalaMano || 1;
    const dets = lista.map((m) => {
      const W = new Float32Array(63);
      for (let i = 0; i < 21; i++) {
        /* (la cámara queda unos centímetros adelante de los ojos en un visor; la escala de la mano, desde la cámara) */
        _a.set(m.puntos[i * 3] * ke, m.puntos[i * 3 + 1] * ke, m.puntos[i * 3 + 2] * ke - 0.06).applyQuaternion(q).add(p);
        W[i * 3] = _a.x; W[i * 3 + 1] = _a.y; W[i * 3 + 2] = _a.z;
      }
      /* el pellizco: en la imagen (lo más claro) y en metros; relativo al largo de la palma */
      /* (en metros, con la forma de MediaPipe tal cual: los puntos van por la imagen, y las dos puntas
         casi tocándose en la foto quedaban un poco más lejos) */
      const I = m.img, F = m.forma || m.puntos, e2 = Math.hypot(I[0] - I[27], I[1] - I[28]) || 1, e3 = Math.hypot(F[0] - F[27], F[1] - F[28], F[2] - F[29]) || 1;
      const p2 = Math.hypot(I[12] - I[24], I[13] - I[25]) / e2, p3 = Math.hypot(F[12] - F[24], F[13] - F[25], F[14] - F[26]) / e3;
      /* (qué mano es: lo que dice MediaPipe solo si está seguro; si duda, el lado de la foto donde está:
         de canto y de dorso da la otra con 0,54-0,64, y al votar se daba vuelta la mano) */
      const segura = m.derecha != null && (m.confianza ?? 1) >= ETIQUETA, qW = quiralidad(W);
      /* (al aparecer: la forma si lo dice claro; si no, la etiqueta segura; si no, el lado de la foto) */
      return { m, W, c: centroPalma(W), pell: Math.max(p2, p3 * 0.62), der: Math.abs(qW) > QUIRAL ? qW > 0 : segura ? m.derecha : m.puntos[0] > 0, segura, M: null };
    });
    const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    /* la misma mano dos veces (pasa de costado): queda la de más confianza */
    if (dets.length === 2 && dist(dets[0].c, dets[1].c) < 0.04) dets.splice(dets[0].m.confianza >= dets[1].m.confianza ? 1 : 0, 1);
    /* 1) por dónde estaba: cada mano que se viene siguiendo se queda con la detección más cerca de
       donde tenía que estar (MediaPipe a veces cambia de idea de cuál es cuál: si se le creía, la mano
       saltaba a la otra y quedaban dos, una congelada) */
    /* (contra donde estaba y contra donde iba: si dio la vuelta mientras la red no la veía, la
       velocidad vieja la mandaba lejos; y cuanto más vieja la última foto, más lejos puede estar) */
    const tomadas = new Set(), pares = [], ya = [0, 0, 0];
    /* (también la que se está apagando: si vuelve a aparecer ahí, es ella, aunque la red diga que es
       la otra; si no, se cruzaban una que se iba y otra que llegaba en el mismo lugar) */
    for (const M of this.manos) if (M.visible || M.alfa > 0.05) {
      const pr = M.predecirCentro(ts), aca = M.predecirCentro(M.t, ya), tope = 0.2 + 0.8 * Math.min(0.5, Math.max(0, ts - M.t));
      /* (con la foto de antes reciente, el orden va solo por donde tenía que estar: el fantasma de
         MediaPipe trae donde estaba, y contra eso le ganaba a la de verdad) */
      const reciente = ts - M.t < 0.12;
      for (const d of dets) { const dp = dist(pr, d.c), da = dist(aca, d.c); if (Math.min(dp, da) < tope) pares.push([reciente ? dp : Math.min(dp, da), M, d]); }
    }
    pares.sort((x, y) => x[0] - y[0]);
    for (const [, M, d] of pares) if (!tomadas.has(M) && !d.M) { d.M = M; tomadas.add(M); }
    /* 2) las que aparecen: por lo que dice MediaPipe (y si vienen dos iguales, por el lado de la imagen) */
    /* (el fantasma, vuelta 22: buscando dos manos, MediaPipe a veces trae también la que ya ve, de una
       foto atrasada: donde estaba hace un momento. Si se le creía, aparecía una segunda mano al lado, y
       con dos a la vista las redes buscaban dos y traían más: en el simulador, dos manos en el 37 % de
       los cuadros) */
    /* (de costado, visto desde la cámara: con las direcciones, contra cada tramo del camino) */
    const dir = (a) => { const x = a[0] - camO[0], y = a[1] - camO[1], z = a[2] - camO[2], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l, l]; };
    const deCostado = (P, A, B = A) => {
      const d = B.map((b, i) => b - A[i]), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
      const k = dd > 0 ? Math.min(1, Math.max(0, ((P[0] - A[0]) * d[0] + (P[1] - A[1]) * d[1] + (P[2] - A[2]) * d[2]) / dd)) : 0;
      return Math.hypot(P[0] - A[0] - k * d[0], P[1] - A[1] - k * d[1], P[2] - A[2] - k * d[2]) * P[3];
    };
    const sobre = (P, R) => { for (let i = 0; i < R.length; i++) if (deCostado(P, R[i], R[i + 1] || R[i]) < FANTASMA) return true; return false; };
    const camino = (O) => O.rastro.filter((r) => ts - r.t < 0.35).map((r) => dir(r.c));
    const hayOtra = this.manos.some((O) => (O.visible && O.alfa > 0.3) || tomadas.has(O));
    /* a) la que cae sobre otra de esta foto, o sobre el camino que hizo otra en los últimos 0,35 s, no
       es una mano nueva (si vienen dos nuevas una sobre la otra, queda la de más confianza) */
    const nuevas = [];
    for (const d of dets.filter((x) => !x.M).sort((x, y) => y.m.confianza - x.m.confianza)) {
      const P = dir(d.c);
      if (dets.some((e) => (e.M || nuevas.includes(e)) && deCostado(P, dir(e.c)) < FANTASMA)) continue;
      if (hayOtra && this.manos.some((O) => O.visible && sobre(P, camino(O)))) continue;
      nuevas.push(d);
    }
    /* b) con otra a la vista, la nueva queda a prueba (no se dibuja): cuando la mano arranca de golpe,
       el fantasma trae donde estaba y la de verdad aparece al lado, igual que otra mano que entra.
       Se sabe después:
       - si en otra foto la de a prueba viene y la que se ve no (o lo que viene para la que se ve cae
         sobre el camino que acaba de hacer la de a prueba: es su fantasma), era la misma: la que se
         ve la sigue;
       - si en dos fotos más viene cada una por su lado (o la de a prueba sola, lejos de donde tenía
         que estar la que se ve), es otra mano: aparece. Mientras hay una a prueba, las redes buscan
         dos (manos-camara.js › quiereDos) */
    if (hayOtra) for (const d of nuevas.splice(0)) {
      let C = null, mc = 0.25;
      for (const c of this.prueba) { const dd = dist(c.c, d.c); if (dd < mc && ts > c.t) { mc = dd; C = c; } }
      if (!C) { C = { c: d.c, t: ts, n: -1, R: [] }; this.prueba.push(C); }
      /* (hacia atrás de lo que hizo la de a prueba: por donde pasó, y su velocidad por 0,2 s) */
      const P = dir(d.c), R = C.R.map((r) => r.P).concat([P]);
      if (C.R.length) { const r0 = C.R[C.R.length - 1], k = 0.2 / Math.max(0.03, ts - r0.t); R.push(dir(d.c.map((x, i) => x - (x - r0.c[i]) * k))); }
      C.R.push({ t: ts, c: d.c, P }); while (C.R.length > 6) C.R.shift();
      C.c = d.c; C.t = ts; C.d = d;
      /* (la que se ve, O: la más cerca) */
      let O = null, mo = 1e9;
      for (const M of this.manos) if (M.visible || tomadas.has(M)) { const dd = dist(M.predecirCentro(ts), d.c); if (dd < mo) { mo = dd; O = M; } }
      const e = O && dets.find((x) => x.M === O);
      const deO = !e || sobre(dir(e.c), R);
      if (O && deO && (e || deCostado(P, dir(O.predecirCentro(ts))) < 0.15)) {
        if (e) e.M = null;
        d.M = O; tomadas.add(O); C.fin = true;
      } else if (++C.n >= 1) { nuevas.push(d); C.fin = true; }
    }
    this.prueba = this.prueba.filter((c) => !c.fin && ts - c.t < 0.25);
    if (nuevas.length === 2 && nuevas[0].der === nuevas[1].der) { const [x, y] = nuevas; x.der = x.m.puntos[0] > y.m.puntos[0]; y.der = !x.der; }
    for (const d of nuevas) {
      let M = this.manos[d.der ? 1 : 0];
      if (tomadas.has(M)) M = this.manos[d.der ? 0 : 1];
      if (tomadas.has(M)) continue;
      d.M = M; tomadas.add(M);
    }
    for (const d of dets) {
      if (!d.M || (d.M.visible && ts <= d.M.t)) continue;   // (esa mano ya tiene algo más nuevo)
      d.M.escalar(d.W, camO); d.M.alRayo(d.W, camO);
      d.M.recibir(d.W, ts, tl, d.pell, d.m.confianza, false, p, camO);
      d.M.enBorde = saliendo(d.m.img, d.M.cImg); d.M.cImg = d.m.img ? centroPalma(d.m.img) : null;
      /* (qué mano es, a votos: la forma si lo dice claro (con un video de verdad erró el 1,4 % de las
         fotos); si la mano está plana, la etiqueta si es segura (erró el 4 %: de dorso, hasta 4 seguidas)) */
      const qd = quiralidad(d.W), voto = Math.abs(qd) > QUIRAL ? qd > 0 : d.segura ? d.m.derecha : null;
      if (voto !== null) d.M.votos = THREE.MathUtils.clamp(d.M.votos + (voto === d.M.derecha ? 1 : -1), -6, 6);
      this.stats.lecturas++;
    }
    /* (una que no vino es una falta solo si la red tenía lugar para traerla, y si la foto no es vieja) */
    if (!vieja && dets.length < cupo) for (const M of this.manos) if (!tomadas.has(M)) M.faltas++;
    /* 3) si una mano viene seguido con la etiqueta del otro lado (y la otra no está, o también está
       al revés), se dan vuelta: así la palma y el hombro del rayo son los de esa mano */
    const [I, D] = this.manos;
    if ((I.votos <= -4 && D.votos <= -4) || (I.votos <= -4 && !D.visible) || (D.votos <= -4 && !I.visible)) this.darVuelta();
  }
  darVuelta() {
    const [I, D] = this.manos;
    I.derecha = true; D.derecha = false; I.votos = -I.votos; D.votos = -D.votos;
    this.manos = [D, I];
  }
  /* lo que llega ya en el mundo (el visor WebXR, las pruebas): pell en metros de punta a punta */
  recibirMundo(der, W, tSeg, pellMetros = null) {
    const M = this.manos[der ? 1 : 0];
    const e = Math.hypot(W[0] - W[27], W[1] - W[28], W[2] - W[29]) || 0.09;
    const pm = pellMetros ?? Math.hypot(W[12] - W[24], W[13] - W[25], W[14] - W[26]);
    /* (las del visor ya vienen suaves y a tiempo: sin filtro) */
    M.recibir(W, tSeg, tSeg, pm / e * 1.0, 1, this.fuente === 'xr');
    this.stats.lecturas++;
  }
  perder(der) { const M = this.manos[der ? 1 : 0]; M.visible = false; M.seguida = false; }
  /* lo que se muestra de una mano en este cuadro: el adelanto, el resorte, las anclas */
  mover(M, ts, h, xr) {
    /* (el nivel del menú, solo con la cámara: el visor y las pruebas van con lo de siempre) */
    const z = M.rayo ? SUAVIDAD[this.suavidad] || SUAVIDAD.media : null;
    M.lmax = z?.lmax; M.lmaxH = z?.lmaxH; M.adelMax = z?.adelMax;
    if (z) M.ponerPose(z.pose || null);
    M.adelantar(ts, this.adelanta && !xr);
    if (xr) { M.seguida = true; M.conResorte = false; return; }
    M.suavizar(h);
    /* (las anclas, si el nivel las tiene) */
    if (z?.anclas) M.estabilizar(h, z.anclas);
    else {
      M.seguidaAncla = false; M.quieta = false;
      /* (sin anclas: casi quieta, la velocidad del centro es ruido de la foto y adelantarla hacía
         pasear la mano 9 mm; se adelanta de a poco desde v0 hasta v1 m/s) */
      const vv = z?.v1 ? M.velCentro() : 1, g = z?.v1 ? THREE.MathUtils.smoothstep(vv, z.v0, z.v1) : 1;
      M.pesoAd = (M.pesoAd ?? 1) + (g - (M.pesoAd ?? 1)) * Math.min(1, h / 0.05);
    }
    if (M.rayo) M.enderezar();
  }
  /* todo apagado de golpe (al salir del VR) */
  limpiar() { for (const M of this.manos) { M.visible = false; M.alfa = 0; M.seguida = false; } this.menu.cerrar(); this.tCapUlt = -1e9; this.prueba = []; }
  /* ------------------------------------------ cada cuadro. ctx: lo del juego que hace falta
     { cabezaP, cabezaQ, interactivos: [{ o, pos, texto }], altura(x, z), sePuede(x, y, z), tocar(p) }
     devuelve los eventos: usar, ir, saltar, menú */
  actualizar(dt, tMs, ctx) {
    const t0 = performance.now(), ts = tMs / 1000, ev = this.eventos = [];
    const cabP = ctx.cabezaP, cabQ = ctx.cabezaQ;
    const cam = this.fuente === 'camara', xr = this.fuente === 'xr';
    /* (el tiempo de verdad entre cuadros, del reloj del dibujo: el dt del juego puede venir recortado
       o en cámara lenta, y el resorte y el fundido tienen que ir con el reloj de las fotos) */
    const h = this.tAnt >= 0 && ts > this.tAnt ? Math.min(0.1, ts - this.tAnt) : dt; this.tAnt = ts;
    for (const [k, M] of this.manos.entries()) {
      /* cuándo se pierde: con la cámara, cuando la red no la vio en 4 fotos seguidas (o no llega
         nada hace 0,6 s); NO por lo vieja que es la foto: en el celu la foto llega con 100-250 ms de
         atraso y la mano se prendía y se apagaba (titilaba). El visor da una por cuadro */
      const edad = ts - M.tLlego;
      if (M.visible && (cam ? M.faltas >= 4 || (M.faltas >= 2 && edad > 0.25) || edad > 0.6 : edad > (xr ? 0.12 : 0.25))) M.visible = false;
      /* y se prende y se apaga suave (80 ms y 200 ms). Con la cámara, mientras se apaga sigue lo que venía
         haciendo (vuelta 25: si salió de la cámara, se sigue yendo y frena; antes se clavaba donde la vio
         por última vez) */
      M.alfa = M.visible ? Math.min(1, M.alfa + h / 0.08) : Math.max(0, M.alfa - h / 0.2);
      if (!M.visible) { M.pellizca = false; M.fuerza = 0; M.seguida = M.seguida && M.alfa > 0; if (cam && M.seguida) this.mover(M, ts, h, false); continue; }
      this.mover(M, ts, h, xr);
      /* (vuelta 40) si agarra algo, es un control: su gatillo es el pellizco */
      const Mo = this.medirMando(M, h, ev);
      const pv = Mo ? (M.mando.gat ? 0 : 1) : M.pell;
      /* el pellizco, con histéresis (se prende más cerrado de lo que se apaga) */
      const antes = M.pellizca;
      if (!M.pellizca && pv < 0.3) M.pellizca = true; else if (M.pellizca && pv > 0.46) M.pellizca = false;
      M.fuerza = THREE.MathUtils.clamp(1 - (pv - 0.2) / 0.45, 0, 1);
      M.empezo = !antes && M.pellizca; M.solto = antes && !M.pellizca;
      if (M.empezo) { M.tPellizco = ts; M.fijoHasta = ts + 0.14; }
      if (M.solto) M.fijoHasta = 0;
      /* la palma: su normal y si mira a la cara */
      const w = M.punto(0, _a), i5 = M.punto(5, _b), i17 = M.punto(17, _c);
      M.palmaN.crossVectors(i5.sub(w), i17.sub(w)).normalize(); if (!M.derecha) M.palmaN.negate();
      M.palmaC.copy(M.punto(0)).add(M.punto(9)).multiplyScalar(0.5);
      M.aLaCara = M.palmaN.dot(_d.copy(cabP).sub(M.palmaC).normalize());
      /* el rayo: del hombro (bajo la cabeza, al costado de esta mano) entre el pulgar y el índice */
      _d.set(0, 0, -1).applyQuaternion(cabQ); const yaw = Math.atan2(-_d.x, -_d.z);
      const hombro = _c.set(cabP.x + Math.cos(yaw) * (M.derecha ? 0.17 : -0.17), cabP.y - 0.2, cabP.z - Math.sin(yaw) * (M.derecha ? 0.17 : -0.17));
      const mira = M.punto(2, _b).add(M.punto(5, _a)).multiplyScalar(0.5);
      M.rayoO.copy(mira);
      /* (la dirección, de la mano como se ve: quieta con el ancla. De viaje, deslizándose después de
         un salto, de donde está de verdad, sin el resorte: si no, al terminar de deslizarse apuntaba
         unos grados corrido y el filtro del rayo tardaba en enderezarse) */
      if (ts > M.fijoHasta) {
        const mv = M.viaja ? M.puntoBase(2, _d).add(M.puntoBase(5, _e)).multiplyScalar(0.5) : M.punto(2, _d).add(M.punto(5, _e)).multiplyScalar(0.5);
        let d;
        if (cam) {
          /* con la cámara del celu, la mano solo se ve delante de la cara (en lo que abarca la cámara):
             desde el hombro, el rayo siempre quedaba para arriba y no se podía apuntar al piso ni a nada
             de abajo. Va desde los ojos, y lo que la mano se corre del centro de la vista se agranda
             (RAYO_GANA): con la mano un poco abajo, el rayo baja mucho */
          _q.copy(cabQ).invert(); mv.sub(cabP).applyQuaternion(_q);
          const az = Math.atan2(mv.x, -mv.z) * RAYO_GANA[0], el = Math.atan2(mv.y, Math.hypot(mv.x, mv.z)) * RAYO_GANA[1];
          const a = THREE.MathUtils.clamp(az, -1.4, 1.4), b = THREE.MathUtils.clamp(el, -1.35, 1.0);
          d = mv.set(Math.sin(a) * Math.cos(b), Math.sin(b), -Math.cos(a) * Math.cos(b)).applyQuaternion(cabQ);
        } else d = mv.sub(hombro).normalize();
        /* (con el control, el rayo sale de su punta y va a lo largo del objeto: se apunta con él, como con una
           linterna, sin el agrandado de la cámara) */
        if (Mo) d = mv.copy(M.mando.eje);
        const f = M.euroRayo.filtrar([d.x, d.y, d.z], ts); M.rayoD.set(f[0], f[1], f[2]).normalize(); }
      if (Mo) M.rayoO.copy(M.mando.punta);
      /* la yema del índice toca (burbujas, orbes); con el control, su punta */
      if (!M.viaja) ctx.tocar?.(Mo ? M.mando.punta : M.punto(8, _a), k);
    }
    const [I, D] = this.manos;
    /* los dos pellizcos a la vez: salto (las dos con lectura fresca: una mano que se perdió hace un
       rato sigue "vista" 250 ms con su último pellizco, y con el pellizco de la palma parecía doble) */
    const fresca = (M) => M.visible && ts - M.t < 0.12;
    if (fresca(I) && fresca(D) && (I.empezo || D.empezo) && I.pellizca && D.pellizca && Math.abs(I.tPellizco - D.tPellizco) < 0.25) { ev.push({ tipo: 'saltar' }); this.salto = null; I.anulado = D.anulado = true; }
    /* el menú: la palma a la cara, mirándola, y un pellizco de esa mano; o se toca con la yema de la otra.
       (vuelta 34) Antes bastaba la palma a la cara: al cerrar la mano, o al pellizcar la barra de una ventana
       (MediaPipe a veces confunde cuál mano es, y la palma queda al revés), se abría solo y el pellizco no
       agarraba. Ahora, MENU_PALMA.t s seguidos: la palma bien a la cara, la mano abierta (mayor, anular y
       meñique estirados), la mirada en la palma y sin estar apuntando a una ventana */
    let palma = null;
    _d.set(0, 0, -1).applyQuaternion(cabQ);
    for (const [k, M] of this.manos.entries()) {
      const ya = M === this.palmaAntes, P = MENU_PALMA;
      let ok = M.visible && !M.viaja && M.aLaCara > (ya ? P.sigue : P.cara) && !(ctx.apuntar?.(M, k));
      if (ok) {
        const w = M.punto(0, _a), largo = w.distanceTo(M.punto(9, _b)) || 1;
        let puntas = 0; for (const i of [12, 16, 20]) puntas += M.punto(i, _b).distanceTo(w) / 3;
        const mira = _e.copy(M.palmaC).sub(cabP).normalize().dot(_d);
        ok = puntas / largo > P.abierta && mira > Math.cos(ya ? P.miraSigue : P.mira);
      }
      if (!ok) { M.palmaDesde = -1; continue; }
      if (!(M.palmaDesde >= 0)) M.palmaDesde = ts;
      if (ya || ts - M.palmaDesde >= P.t) palma = M;
    }
    this.palmaAntes = palma;
    this.boton.visible = !!palma && !this.menu.abierto;
    if (palma) { this.boton.position.copy(palma.palmaC).addScaledVector(palma.palmaN, 0.05); this.boton.scale.setScalar(1 + palma.fuerza * 0.8); }
    if (palma && palma.empezo) { palma.anulado = true; if (this.menu.abierto) this.menu.cerrar(); else this.menu.abrir(cabP, cabQ); ev.push({ tipo: 'sonido', s: 'aviso' }); }
    /* cada mano: menú (toque o rayo) > lo que se apunta > el piso (arco) */
    let objetivo = null, salto = null;
    for (const [k, M] of this.manos.entries()) {
      const R = this.rayos[k], C = this.cursores[k];
      R.visible = C.visible = false;
      if (!M.visible || M === palma) { if (M.solto) M.anulado = false; continue; }
      if (M.solto && M.anulado) { M.anulado = false; continue; }
      let fin = null;
      if (this.menu.abierto) {
        /* el dedo: se aprieta al cruzar el plano (de adelante hacia atrás) */
        const yema = M.punto(8, _a), pt = this.menu.enPunto(yema);
        if (M.viaja) pt.i = -1;
        if (pt.i >= 0 && Math.abs(pt.prof) < 0.05) {
          if (this.menu.sobre !== pt.i) { this.menu.sobre = pt.i; this.menu.pintar(); }
          if (M.profAntes > 0.004 && pt.prof <= 0.004) this.apretar(pt.i, ev);
          M.profAntes = pt.prof; continue;
        }
        M.profAntes = M.viaja ? undefined : pt.prof;
        const r = this.menu.enRayo(M.rayoO, M.rayoD);
        if (r) {
          fin = r.p;
          if (r.i !== this.menu.sobre) { this.menu.sobre = r.i; this.menu.pintar(); }
          if (M.empezo && !M.anulado && r.i >= 0) this.apretar(r.i, ev);
        }
      }
      /* (vuelta 29: lo que apunta otro (las ventanas, ventanas.js): el cursor va ahí y el pellizco es de ellas) */
      if (!fin && ctx.apuntar) { const q = ctx.apuntar(M, k); if (q) fin = q; }
      if (!fin) {
        /* lo interactivo más alineado con el rayo (hasta 14 m): cada cosa acepta 6° más lo que mide
           vista desde ahí, y gana la que queda más adentro de lo suyo (si no, una grande de al lado
           le ganaba a la chica que se apunta justo) */
        let mejor = null, ma = 1;
        for (const it of ctx.interactivos || []) {
          const v = _b.copy(it.pos).sub(M.rayoO); const dist = v.length(); if (dist > 14 || dist < 0.2) continue;
          /* (lo que ya se apuntaba se queda con un 25 % de ventaja: entre dos cosas pegadas, el cartel
             saltaba de una a la otra con el temblor del rayo) */
          const ang = Math.acos(THREE.MathUtils.clamp(v.dot(M.rayoD) / dist, -1, 1)), tol = (0.105 + Math.atan2(it.radio || 0.4, dist)) * (M.apunta === it.o ? 1.25 : 1);
          if (ang / tol < ma) { ma = ang / tol; mejor = it; }
        }
        M.apunta = mejor?.o ?? null;
        if (mejor) {
          fin = mejor.pos; objetivo = mejor;
          if (M.empezo && !M.anulado) ev.push({ tipo: 'usar', o: mejor.o });
        } else if (!salto && !ctx.sinArco) {
          /* el arco: tiro de 6,5 m/s desde la mano hasta que toca el piso */
          const arco = this.arco(M, ctx);
          if (arco) {
            salto = arco; fin = null;
            if (M.solto && !M.anulado && arco.valido) ev.push({ tipo: 'ir', p: arco.p.clone() });
          }
        }
      }
      if (M.solto) M.anulado = false;
      /* el rayo y el cursor */
      const largo = fin ? fin.distanceTo(M.rayoO) : 0.55;
      R.visible = true; R.material.uniforms.uFuerza.value = M.fuerza;
      R.position.copy(M.rayoO).addScaledVector(M.rayoD, largo / 2); R.quaternion.setFromUnitVectors(_c.set(0, 1, 0), M.rayoD); R.scale.set(1, largo, 1);
      /* (el cilindro de three va de -0,5 a 0,5 en y: con y hacia afuera, la punta de la mano es la opaca) */
      if (fin) { C.visible = true; C.position.copy(fin); C.lookAt(cabP); const s = 0.012 * (1 + fin.distanceTo(cabP) * 0.9) * (1 - M.fuerza * 0.45); C.scale.setScalar(s); }
    }
    /* el arco y el aro */
    this.salto = salto;
    if (salto) {
      const n = Math.min(this.puntos.instanceMatrix.count, salto.pts.length);
      for (let i = 0; i < n; i++) { _m.makeTranslation(salto.pts[i].x, salto.pts[i].y, salto.pts[i].z); this.puntos.setMatrixAt(i, _m); }
      this.puntos.count = n; this.puntos.instanceMatrix.needsUpdate = true;
      this.puntos.material.color.set(salto.valido ? '#bff4ff' : '#ffb3b3');
      this.aro.visible = true; this.aro.position.copy(salto.p).y += 0.03; this.aro.material.color.set(salto.valido ? '#7dfcc0' : '#ff7d7d');
      this.aro.scale.setScalar(1 + (salto.mano.fuerza) * 0.25);
    } else { this.puntos.count = 0; this.aro.visible = false; }
    /* el cartel de lo que se apunta */
    if (objetivo !== this.objetivo) {
      this.objetivo = objetivo;
      if (objetivo) {
        const c = this.cartelL.getContext('2d'); c.clearRect(0, 0, 512, 96);
        c.fillStyle = 'rgba(10,40,70,0.72)'; c.beginPath(); c.roundRect(8, 10, 496, 76, 38); c.fill();
        c.fillStyle = '#ffffff'; c.font = '800 38px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('✋ ' + (objetivo.texto || ''), 256, 62);
        this.cartel.material.map.needsUpdate = true;
      }
    }
    this.cartel.visible = !!objetivo;
    if (objetivo) { this.cartel.position.copy(objetivo.pos).y += 0.55; const d = objetivo.pos.distanceTo(cabP); this.cartel.scale.set(0.32 * (0.6 + d * 0.12), 0.06 * (0.6 + d * 0.12), 1); }
    this.ponerMandos(h);
    this.dibujarManos();
    this.stats.msActualizar = performance.now() - t0;
    return ev;
  }
  /* (vuelta 40) EL OBJETO EN LA MANO: si esta mano agarra algo (MANDO.entra s seguidos), es un control. Devuelve si lo
     es. El eje, suavizado; la punta, del lado del pulgar; el gatillo: el índice que se dobla más que su reposo, o el
     pulgar que baja hacia el índice (el reposo sigue a la mano cuando no aprieta, y se queda quieto mientras aprieta:
     sostener el gatillo sirve para arrastrar) */
  medirMando(M, h, ev) {
    const S = M.mando ||= { activo: false, s: 0, eje: new THREE.Vector3(), centro: new THREE.Vector3(), punta: new THREE.Vector3(), rI: 0, rP: 0, gat: false, alfa: 0 };
    if (!this.conMando || M.viaja || !M.visible) { S.activo = false; S.s = 0; S.gat = false; return false; }
    const A = medirAgarre(M.p, _agarre);
    S.s = THREE.MathUtils.clamp(S.s + (A.n >= MANDO.dedos ? h / MANDO.entra : -h / MANDO.sale), 0, 1);
    if (!S.activo && S.s >= 1) {
      S.activo = true; S.gat = false; S.rI = A.dobleIndice; S.rP = A.pulgar; S.eje.fromArray(A.eje);
      if (!this.mandoVisto) { this.mandoVisto = true; ev.push({ tipo: 'mando' }); }
      ev.push({ tipo: 'sonido', s: 'elegir' });
    } else if (S.activo && S.s <= 0) { S.activo = false; S.gat = false; }
    if (!S.activo) return false;
    _a.fromArray(A.eje); if (_a.dot(S.eje) < 0) _a.negate();
    S.eje.lerp(_a, 1 - Math.exp(-h / MANDO.suave)).normalize();
    S.centro.fromArray(A.centro);
    S.punta.copy(S.centro).addScaledVector(S.eje, MANDO.largo * 0.5);
    if (!S.gat) { S.rI = Math.min(A.dobleIndice, S.rI + h * MANDO.sube); S.rP = Math.max(A.pulgar, S.rP - h * MANDO.sube * 0.5); }
    const dI = A.dobleIndice - S.rI, dP = S.rP - A.pulgar;
    if (!S.gat && (dI > MANDO.gatillo[0] || dP > MANDO.pulgar[0])) S.gat = true;
    else if (S.gat && dI < MANDO.gatillo[1] && dP < MANDO.pulgar[1]) S.gat = false;
    return true;
  }
  /* el control dibujado en cada mano: aparece y se va suave, a lo largo del objeto; la punta brilla más al apretar */
  ponerMandos(h) {
    this.manos.forEach((M, k) => {
      const S = M.mando, G = this.mandos[k];
      const quiere = !!S?.activo && M.visible ? 1 : 0;
      if (S) S.alfa += (quiere - S.alfa) * (1 - Math.exp(-h / 0.08));
      const a = (S?.alfa || 0) * M.alfa;
      G.visible = a > 0.01;
      if (!G.visible) return;
      G.position.copy(S.centro); G.quaternion.setFromUnitVectors(_c.set(0, 1, 0), S.eje);
      G.scale.setScalar(0.6 + 0.4 * a);
      const U = G.userData.U; U.uAlfa.value = a; U.uGat.value += ((S.gat ? 1 : 0) - U.uGat.value) * (1 - Math.exp(-h / 0.04)); U.uT.value += h;
    });
  }
  apretar(i, ev) {
    this.menu.apretado = i; this.menu.pintar(); clearTimeout(this._tApr);
    this._tApr = setTimeout(() => { this.menu.apretado = -1; this.menu.pintar(); }, 180);
    const acc = ['caminar', 'izq', 'der', 'fps', 'ventanas', 'lentes', 'salir', 'mando'][i];
    if (acc === 'fps') { this.menu.fps = !this.menu.fps; this.menu.pintar(); }
    if (acc === 'mando') { this.conMando = this.menu.mando = !this.conMando; this.menu.pintar(); }
    ev.push({ tipo: 'menu', accion: acc, fps: this.menu.fps, mando: this.conMando }, { tipo: 'sonido', s: 'elegir' });
    if (acc === 'salir' || acc === 'caminar' || acc === 'ventanas' || acc === 'lentes') this.menu.cerrar();
  }
  /* la parábola del teletransporte: la mano tira una piedrita imaginaria */
  arco(M, ctx) {
    if (M.rayoD.y > 0.35) return null;   // (apuntando al cielo no hay arco)
    const pts = [], p = M.rayoO.clone(), v = M.rayoD.clone().multiplyScalar(6.5), g = -9.8, paso = 0.045;
    for (let i = 0; i < 60; i++) {
      const sig = p.clone().addScaledVector(v, paso); v.y += g * paso;
      const suelo = ctx.altura(sig.x, sig.z, p.y);
      if (sig.y <= suelo) {
        /* (el punto justo donde cruza el piso) */
        const h0 = ctx.altura(p.x, p.z, p.y), k = (p.y - h0) / Math.max(1e-4, p.y - h0 - (sig.y - suelo));
        const q = p.clone().lerp(sig, THREE.MathUtils.clamp(k, 0, 1)); q.y = ctx.altura(q.x, q.z, p.y);
        pts.push(q);
        const dist = Math.hypot(q.x - ctx.cabezaP.x, q.z - ctx.cabezaP.z);
        return { p: q, pts: pts.filter((_, j) => j % 2 === 0 || j === pts.length - 1).slice(0, 32), valido: dist > 0.8 && dist < 16 && ctx.sePuede(q.x, q.y, q.z), mano: M };
      }
      pts.push(sig); p.copy(sig);
    }
    return null;
  }
  /* las cápsulas de las dos manos al buffer de instancias */
  dibujarManos() {
    const uf = this.uManos.uFantasma; uf.value += (this.fantasma - uf.value) * 0.15;
    const g = this.geo, A = g.attributes.iA.array, B = g.attributes.iB.array, R = g.attributes.iR.array, Br = g.attributes.iBr.array;
    let n = 0;
    for (const M of this.manos) {
      if (M.alfa <= 0.01) continue;
      const P = M.p, glow = M.fuerza * M.fuerza;
      for (let h = 0; h < N; h++) {
        const [i, j] = HUESOS[h], k = PALMA.has(h) ? 1.35 : 1, a = n * 3;
        A[a] = P[i * 3]; A[a + 1] = P[i * 3 + 1]; A[a + 2] = P[i * 3 + 2];
        B[a] = P[j * 3]; B[a + 1] = P[j * 3 + 1]; B[a + 2] = P[j * 3 + 2];
        R[n * 2] = RADIO[i] * k; R[n * 2 + 1] = RADIO[j] * k;
        /* el brillo del pellizco, en las dos últimas falanges del pulgar y del índice */
        Br[n * 2] = (j === 4 || j === 8 || j === 3 || j === 7) ? glow : 0; Br[n * 2 + 1] = M.alfa;
        n++;
      }
    }
    g.instanceCount = n;
    for (const a of ['iA', 'iB', 'iR', 'iBr']) { g.attributes[a].needsUpdate = true; g.attributes[a].addUpdateRange?.(0, n * g.attributes[a].itemSize); }
    this.stats.dibujos++;
  }
  /* por ojo, encima de la reproyección (vr-dibujo.js › encima) o en la escena del visor */
  dibujarOjo(r, ojo) { r.render(this.escena, ojo); }
  /* las manos fantasma (tu espacio) o como en el juego */
  ponerFantasma(si) { this.fantasma = si ? 1 : FANTASMA_JUEGO; }
  /* hay algo que dibujar (si no, ni se llama) */
  get algo() { return this.manos.some((m) => m.alfa > 0.01) || this.menu.abierto || !!this.extra?.hayAlgo; }
}
