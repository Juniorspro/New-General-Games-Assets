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
  es: { mn_caminar: '🚶 Caminar', mn_parar: '✋ Parar', mn_izq: 'Girar ⟲', mn_der: 'Girar ⟳', mn_fps: 'FPS', mn_salir: 'Salir del VR', mn_titulo: 'Menú', mn_manos_cargando: '✋ Cargando las manos…', mn_manos_listas: '✋ Manos listas: pellizcá para usar, la palma para el menú', mn_manos_error: 'No se pudieron prender las manos (cámara o red)', mn_saltar: 'Saltar', mn_ir: 'Ir' },
  en: { mn_caminar: '🚶 Walk', mn_parar: '✋ Stop', mn_izq: 'Turn ⟲', mn_der: 'Turn ⟳', mn_fps: 'FPS', mn_salir: 'Exit VR', mn_titulo: 'Menu', mn_manos_cargando: '✋ Loading hands…', mn_manos_listas: '✋ Hands ready: pinch to use, palm for the menu', mn_manos_error: 'Couldn’t start hand tracking (camera or network)', mn_saltar: 'Jump', mn_ir: 'Go' },
  pt: { mn_caminar: '🚶 Andar', mn_parar: '✋ Parar', mn_izq: 'Girar ⟲', mn_der: 'Girar ⟳', mn_fps: 'FPS', mn_salir: 'Sair do VR', mn_titulo: 'Menu', mn_manos_cargando: '✋ Carregando as mãos…', mn_manos_listas: '✋ Mãos prontas: pinça para usar, a palma para o menu', mn_manos_error: 'Não foi possível ligar as mãos (câmera ou rede)', mn_saltar: 'Pular', mn_ir: 'Ir' },
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
    const L = this.lado, H = this.hondo, aL = Euro.a(L.corteD, dt), aH = Euro.a(H.corteD, dt), [rx, ry, rz] = r, x = this.x, dx = this.dx;
    for (let j = 0; j < this.n; j++) {
      const i = j * 3, ex = v[i] - x[i], ey = v[i + 1] - x[i + 1], ez = v[i + 2] - x[i + 2];
      /* lo que se movió, partido: a lo largo del rayo (eh) y de costado (el) */
      const eh = ex * rx + ey * ry + ez * rz, elx = ex - eh * rx, ely = ey - eh * ry, elz = ez - eh * rz;
      let vh = dx[i] * rx + dx[i + 1] * ry + dx[i + 2] * rz, vx = dx[i] - vh * rx, vy = dx[i + 1] - vh * ry, vz = dx[i + 2] - vh * rz;
      vh += aH * (eh / dt - vh); vx += aL * (elx / dt - vx); vy += aL * (ely / dt - vy); vz += aL * (elz / dt - vz);
      const sl = Math.hypot(vx, vy, vz), sh = Math.abs(vh);
      const kL = Euro.a(L.corte + L.beta * sl, dt), kH = Euro.a(H.corte + H.beta * Math.max(sh, sl * H.cruce), dt);
      x[i] += kL * elx + kH * eh * rx; x[i + 1] += kL * ely + kH * eh * ry; x[i + 2] += kL * elz + kH * eh * rz;
      dx[i] = vx + vh * rx; dx[i + 1] = vy + vh * ry; dx[i + 2] = vz + vh * rz;
    }
    return this.x;
  }
}

/* -------------------------------------------------- una mano */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
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
const TAU = 0.0321;    // en cuánto se reparte el salto de cada foto nueva: un resorte (s)
const SNAP = 0.4;      // un salto más grande que esto no se reparte: se va derecho (m), más 2 m/s por lo que estuvo sin fotos
const RARA = 0.08;     // una foto que cae más lejos que esto de donde tenía que estar se espera (m)
const RAYO_GANA = [2.0, 2.6];   // con la cámara: cuánto se agranda el ángulo de la mano para el rayo (de costado, arriba/abajo)
/* el One Euro de los puntos en el visor y las pruebas: corte quieta (Hz), cuánto se abre por cada
   m/s, y el corte de la velocidad (Hz) */
const E_CORTE = 1.2, E_BETA = 10, E_CORTED = 2.0;
/* con la cámara (vuelta 16): liviano, casi no atrasa; lo quieto lo sostienen las anclas. De costado,
   y en profundidad (cruce: cuánto abre el de profundidad la velocidad de costado) */
const C_CORTE = 2.7586, C_BETA = 33.0921, C_CORTED = 2.9938;
const CH_CORTE = 2.0, CH_BETA = 20, CH_CORTED = 1.1853, CH_CRUCE = 0.3034;
/* lo que elige cada uno en el menú del VR ("Manos"): lo más que se adelanta por el atraso de la
   cámara (s), de costado y en profundidad, y las anclas (Mano.estabilizar): la zona (m), cuánto
   tiene que quedarse adentro para anclarse (tq), cuánto tiene que empujar el borde para soltarse (te)
   y en cuánto se suelta (ts, s); de costado y en profundidad (…H).
   - Rápidas: sin anclas y adelantando todo lo que tarda la cámara: va pegada a la mano y tiembla un
     poco, como un Quest.
   - Medio y suaves: de una búsqueda (vuelta 17, herramientas/manos-lento.mjs: 450 al azar, con las
     semillas 1-5; comprobado con las 6-10) */
export const SUAVIDAD = {
  rapida: { anclas: null, lmax: 0.2, lmaxH: 0.15 },
  media: { lmax: 0.1371, lmaxH: 0.1491, anclas: { rl: 0.0043, rh: 0.0101, tq: 0.2444, tqH: 0.1778, te: 0.0495, teH: 0.0184, ts: 0.0282, tsH: 0.0536 } },
  suave: { lmax: 0.135, lmaxH: 0.1945, anclas: { rl: 0.0051, rh: 0.0139, tq: 0.2248, tqH: 0.1921, te: 0.0258, teH: 0.0368, ts: 0.0424, tsH: 0.0514 } },
};
class Mano {
  constructor(derecha) {
    this.derecha = derecha; this.visible = false; this.t = -1; this.conf = 0;
    this.euroIso = new Euro(63, { corte: E_CORTE, beta: E_BETA, corteD: E_CORTED });
    this.euroEjes = new EuroEjes(21, { corte: C_CORTE, beta: C_BETA, corteD: C_CORTED }, { corte: CH_CORTE, beta: CH_BETA, corteD: CH_CORTED, cruce: CH_CRUCE });
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
  /* una lectura nueva: puntos en el mundo; t: cuándo se sacó; tLlego: cuándo llegó; pell: cuánto se
     abre el pellizco (0 = tocándose; la escala es el largo de la palma); crudo: sin filtro (el visor) */
  recibir(P, t, tLlego, pell, conf = 1, crudo = false, ojo = null) {
    this.faltas = 0;
    /* (el filtro según de dónde viene: con la cámara, el de ejes; si cambia, sigue desde donde estaba) */
    const F = ojo && !crudo ? this.euroEjes : this.euroIso;
    if (F !== this.euro) { F.x.set(this.euro.x); F.dx.set(this.euro.dx); F.t = this.euro.t; this.euro = F; }
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
        this.euro.reiniciar(P, t); this.euroRayo.t = -1; this.fijoHasta = 0;
        /* (si se estaba apagando cerca, llega deslizándose; si no, aparece donde está: se apaga la
           vieja de una y la nueva se prende suave) */
        this.seguida = this.seguida && this.alfa > 0.3 && salto < SNAP;
        if (!this.seguida) { this.alfa = 0; this.gen++; this.seguidaAncla = false; }
      } else this.euro.filtrar(P, t, this.rayo);
    }
    /* el atraso de la cámara, promediado (así el adelanto no cambia de foto en foto) */
    const lat = THREE.MathUtils.clamp(tLlego - t, 0, 0.4);
    this.lat = this.lat > 0 ? this.lat + (lat - this.lat) * 0.1 : lat;
    this.hueco = this.t > 0 ? Math.max(0, t - this.t) : 0;   // (lo que estuvo sin fotos: el tope del resorte crece con eso)
    this.t = t; this.tLlego = tLlego; this.conf = conf; this.pell = pell; this.nueva = true;
    if (!this.visible) { this.visible = true; this.pellizca = false; this.anulado = false; this.profAntes = undefined; }
  }
  /* al cuadro que se dibuja: lo filtrado más la velocidad por lo que pasó desde que LLEGÓ la foto
     (así se sigue moviendo parejo entre foto y foto) y por lo que tarda la cámara (hasta 100 ms) */
  adelantar(tDibujo, adelanta) {
    const E = this.euro;
    const edad = Math.max(0, tDibujo - this.tLlego), sola = edad < HMAX ? edad : HMAX + FRENO * (1 - Math.exp(-(edad - HMAX) / FRENO));
    /* (pesoAd: con la cámara, 0 mientras la mano está anclada, quieta: ahí la velocidad es ruido) */
    const pa = this.pesoAd ?? 1;
    const k = adelanta ? (sola + Math.min(this.lmax ?? LMAX, this.lat)) * AMORT * pa : 0;
    /* (y a qué velocidad se mueve eso: la del filtro mientras sigue sola, frenando después) */
    const kv = adelanta ? AMORT * pa * (edad < HMAX ? 1 : Math.exp(-(edad - HMAX) / FRENO)) : 0;
    const r = this.rayo;
    if (!r) { for (let i = 0; i < 63; i++) { this.p[i] = E.x[i] + E.dx[i] * k; this.vb[i] = E.dx[i] * kv; } return; }
    /* con la cámara: de costado se adelanta por el atraso; en profundidad casi no (ahí la velocidad
       es más que nada ruido de la foto) */
    const kh = adelanta ? (sola + Math.min(this.lmaxH ?? LMAX_H, this.lat)) * AMORT * pa : 0;
    for (let i = 0; i < 63; i += 3) {
      const vx = E.dx[i], vy = E.dx[i + 1], vz = E.dx[i + 2], vh = vx * r[0] + vy * r[1] + vz * r[2];
      for (let c = 0; c < 3; c++) { const v = E.dx[i + c], h = vh * r[c]; this.p[i + c] = E.x[i + c] + (v - h) * k + h * kh; this.vb[i + c] = v * kv; }
    }
  }
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
      this.anclas = [{ zona: z.rl, tq: z.tq, te: z.te, ts: z.ts }, { zona: z.rh, tq: z.tqH, te: z.teH, ts: z.tsH }].map((a) => ({ ...a, quieta: false, ref: cf.slice(), A: c.slice(), tQ: 0, empuje: 0, o: [0, 0, 0] }));
      this.seguidaAncla = true; this.zonas = z; this.pesoAd = 1;
    }
    let quietas = 0;
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
        const d = parte(an.A, c), L = largo(d);
        if (L > an.zona) {
          const f = an.zona / L; o[0] = d[0] * f; o[1] = d[1] * f; o[2] = d[2] * f;
          /* (el ancla se corre con la mano, en este eje) */
          for (let j = 0; j < 3; j++) an.A[j] += d[j] * (f - 1);
          an.empuje += dt; if (an.empuje > an.te) { an.quieta = false; an.ref = cf.slice(); an.tQ = 0; }
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
      for (let i = 0; i < 63; i++) { off[i] -= p[i] - (bA[i] + vbA[i] * h); oV[i] -= vb[i] - vbA[i]; }
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
    const w = 1 / TAU, e = Math.exp(-w * h);
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
  uniform vec3 uColor, uBorde; uniform float uOpacidad;
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
    gl_FragColor = vec4(c, clamp((uOpacidad * (0.72 + 0.28 * f) + vBr * 0.25) * vAlfa * aa, 0.0, 1.0));
  }`;

/* -------------------------------------------------- el menú de la muñeca */
const BOTONES = ['mn_caminar', 'mn_izq', 'mn_der', 'mn_fps', 'mn_salir'];
class Menu {
  constructor() {
    this.lienzo = document.createElement('canvas'); this.lienzo.width = 512; this.lienzo.height = 300;
    this.tex = new THREE.CanvasTexture(this.lienzo); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.malla.visible = false; this.malla.renderOrder = 5;
    this.sobre = -1; this.apretado = -1; this.abierto = false; this.fps = false; this.camina = false;
    /* los botones en la textura (x, y, ancho, alto), en píxeles del lienzo */
    this.cajas = [[20, 70, 230, 90], [262, 70, 110, 90], [382, 70, 110, 90], [20, 180, 150, 90], [182, 180, 310, 90]];
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
      c.fillStyle = i === 4 ? '#b3261e' : '#0f3f63'; c.font = '800 28px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText(i === 0 && this.camina ? t('mn_parar') : t(BOTONES[i]) + (i === 3 && this.fps ? ' ✓' : ''), x + w / 2, y + h / 2 + 8 + (a ? 4 : 0));
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

/* -------------------------------------------------- todo junto */
export class Manos {
  constructor() {
    this.escena = new THREE.Scene();
    this.manos = [new Mano(false), new Mano(true)];
    this.activa = false; this.fuente = null; this.adelanta = true;
    this.suavidad = 'media';   // con la cámara: 'rapida', 'media' o 'suave' (SUAVIDAD; lo elige el menú del VR)
    this.cabeza = [];   // la pose de la cabeza en cada cuadro (para poner en el mundo lo que vio la cámara)
    const g = this.geo = geoCapsula();
    const U = { uColor: { value: new THREE.Vector3(0.8, 0.88, 0.96) }, uBorde: { value: new THREE.Vector3(0.72, 0.97, 1.0) }, uOpacidad: { value: 0.88 } };
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
    /* el cartel de lo que se apunta */
    this.cartelL = document.createElement('canvas'); this.cartelL.width = 512; this.cartelL.height = 96;
    this.cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(this.cartelL), depthTest: false, transparent: true, toneMapped: false }));
    this.cartel.material.map.colorSpace = THREE.SRGBColorSpace; this.cartel.visible = false; this.cartel.renderOrder = 7; this.escena.add(this.cartel);
    this.objetivo = null; this.salto = null; this.eventos = []; this.tAnt = -1; this.tCapUlt = -1e9;
    this.stats = { lecturas: 0, dibujos: 0, msActualizar: 0 };
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
    const dets = lista.map((m) => {
      const W = new Float32Array(63);
      for (let i = 0; i < 21; i++) {
        /* (la cámara queda unos centímetros adelante de los ojos en un visor) */
        _a.set(m.puntos[i * 3], m.puntos[i * 3 + 1], m.puntos[i * 3 + 2] - 0.06).applyQuaternion(q).add(p);
        W[i * 3] = _a.x; W[i * 3 + 1] = _a.y; W[i * 3 + 2] = _a.z;
      }
      /* el pellizco: en la imagen (lo más claro) y en metros; relativo al largo de la palma */
      const I = m.img, e2 = Math.hypot(I[0] - I[27], I[1] - I[28]) || 1, e3 = Math.hypot(m.puntos[0] - m.puntos[27], m.puntos[1] - m.puntos[28], m.puntos[2] - m.puntos[29]) || 1;
      const p2 = Math.hypot(I[12] - I[24], I[13] - I[25]) / e2, p3 = Math.hypot(m.puntos[12] - m.puntos[24], m.puntos[13] - m.puntos[25], m.puntos[14] - m.puntos[26]) / e3;
      return { m, W, c: centroPalma(W), pell: Math.max(p2, p3 * 0.62), der: m.derecha ?? (m.puntos[0] > 0), M: null };
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
      for (const d of dets) { const dd = Math.min(dist(pr, d.c), dist(aca, d.c)); if (dd < tope) pares.push([dd, M, d]); }
    }
    pares.sort((x, y) => x[0] - y[0]);
    for (const [, M, d] of pares) if (!tomadas.has(M) && !d.M) { d.M = M; tomadas.add(M); }
    /* 2) las que aparecen: por lo que dice MediaPipe (y si vienen dos iguales, por el lado de la imagen) */
    const nuevas = dets.filter((d) => !d.M);
    if (nuevas.length === 2 && nuevas[0].der === nuevas[1].der) { const [x, y] = nuevas; x.der = x.m.puntos[0] > y.m.puntos[0]; y.der = !x.der; }
    for (const d of nuevas) {
      let M = this.manos[d.der ? 1 : 0];
      if (tomadas.has(M)) M = this.manos[d.der ? 0 : 1];
      if (tomadas.has(M)) continue;
      d.M = M; tomadas.add(M);
    }
    for (const d of dets) {
      if (!d.M || (d.M.visible && ts <= d.M.t)) continue;   // (esa mano ya tiene algo más nuevo)
      d.M.recibir(d.W, ts, tl, d.pell, d.m.confianza, false, p);
      if (d.m.derecha != null) d.M.votos = THREE.MathUtils.clamp(d.M.votos + (d.m.derecha === d.M.derecha ? 1 : -1), -6, 6);
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
  /* todo apagado de golpe (al salir del VR) */
  limpiar() { for (const M of this.manos) { M.visible = false; M.alfa = 0; M.seguida = false; } this.menu.cerrar(); this.tCapUlt = -1e9; }
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
      /* y se prende y se apaga suave (80 ms y 200 ms), quieta mientras se apaga */
      M.alfa = M.visible ? Math.min(1, M.alfa + h / 0.08) : Math.max(0, M.alfa - h / 0.2);
      if (!M.visible) { M.pellizca = false; M.fuerza = 0; M.seguida = M.seguida && M.alfa > 0; continue; }
      /* (el nivel del menú, solo con la cámara: el visor y las pruebas van con lo de siempre) */
      const z = M.rayo ? SUAVIDAD[this.suavidad] || SUAVIDAD.media : null;
      M.lmax = z?.lmax; M.lmaxH = z?.lmaxH;
      M.adelantar(ts, this.adelanta && !xr);
      if (!xr) {
        M.suavizar(h);
        /* (las anclas, si el nivel las tiene) */
        if (z?.anclas) M.estabilizar(h, z.anclas); else { M.pesoAd = 1; M.seguidaAncla = false; M.quieta = false; }
      } else { M.seguida = true; M.conResorte = false; }
      /* el pellizco, con histéresis (se prende más cerrado de lo que se apaga) */
      const antes = M.pellizca;
      if (!M.pellizca && M.pell < 0.3) M.pellizca = true; else if (M.pellizca && M.pell > 0.46) M.pellizca = false;
      M.fuerza = THREE.MathUtils.clamp(1 - (M.pell - 0.2) / 0.45, 0, 1);
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
        } else d = mv.sub(hombro).normalize(); const f = M.euroRayo.filtrar([d.x, d.y, d.z], ts); M.rayoD.set(f[0], f[1], f[2]).normalize(); }
      /* la yema del índice toca (burbujas, orbes) */
      if (!M.viaja) ctx.tocar?.(M.punto(8, _a), k);
    }
    const [I, D] = this.manos;
    /* los dos pellizcos a la vez: salto (las dos con lectura fresca: una mano que se perdió hace un
       rato sigue "vista" 250 ms con su último pellizco, y con el pellizco de la palma parecía doble) */
    const fresca = (M) => M.visible && ts - M.t < 0.12;
    if (fresca(I) && fresca(D) && (I.empezo || D.empezo) && I.pellizca && D.pellizca && Math.abs(I.tPellizco - D.tPellizco) < 0.25) { ev.push({ tipo: 'saltar' }); this.salto = null; I.anulado = D.anulado = true; }
    /* el menú: la palma a la cara y un pellizco de esa mano; o se toca con la yema de la otra */
    let palma = null;
    for (const M of this.manos) if (M.visible && M.aLaCara > (M === this.palmaAntes ? 0.5 : 0.62)) palma = M;
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
        } else if (!salto) {
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
    this.dibujarManos();
    this.stats.msActualizar = performance.now() - t0;
    return ev;
  }
  apretar(i, ev) {
    this.menu.apretado = i; this.menu.pintar(); clearTimeout(this._tApr);
    this._tApr = setTimeout(() => { this.menu.apretado = -1; this.menu.pintar(); }, 180);
    const acc = ['caminar', 'izq', 'der', 'fps', 'salir'][i];
    if (acc === 'fps') { this.menu.fps = !this.menu.fps; this.menu.pintar(); }
    ev.push({ tipo: 'menu', accion: acc, fps: this.menu.fps }, { tipo: 'sonido', s: 'elegir' });
    if (acc === 'salir' || acc === 'caminar') this.menu.cerrar();
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
  /* hay algo que dibujar (si no, ni se llama) */
  get algo() { return this.manos.some((m) => m.alfa > 0.01) || this.menu.abierto; }
}
