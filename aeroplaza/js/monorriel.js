/* ============================================================================
   aeroplaza/js/monorriel.js — el monorriel que da la vuelta a la isla: la viga
   blanca sobre pilares, las paradas con ascensor y dos trenes de dos vagones.
   La vía es una curva cerrada que pasa por la terminal (ahí baja al andén) y
   por cada región. Los trenes no se simulan: dónde está cada uno sale del
   reloj (Date.now), así todos los jugadores ven el mismo tren en el mismo
   lugar sin mandarse nada. Arranca, va a 17 m/s, frena y espera en cada
   parada. Se sube en cualquier parada (o en el andén de la terminal) y se
   baja cuando para: el tren es una "montura", como el delfín.
   ========================================================================== */
import * as THREE from 'three';
import { brilloso } from './naturaleza.js';
import { instancias } from './modelos.js';
import { paradasMonorriel } from './construcciones.js';
import { letrero } from './edificios.js';

const VMAX = 17, ACEL = 1.5, ESPERA = 11, ESPERA_TERMINAL = 16, PASO = 1;   // m/s, m/s², s, s, m entre muestras
const LARGO_VAGON = 8.2, SEP = 0.5;

export class Monorriel {
  /* puntos: la vuelta [[x, z]] (cerrada, pasa dos veces por la terminal en línea
     recta). terminal: { x, z0, z1, y } el tramo que va al ras del andén.
     paradas: [{ id, en: [x, z] }] (la primera, la terminal): cada una se pone en
     el punto de la vía más cercano, del lado donde está "en" */
  constructor(mundo, altura, puntos, paradas, terminal) {
    this.g = new THREE.Group();
    const curva = new THREE.CatmullRomCurve3(puntos.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    const L = this.L = curva.getLength(), N = this.N = Math.round(L / PASO);
    const P = this.P = curva.getSpacedPoints(N).slice(0, N), T = this.T = [];
    for (let i = 0; i < N; i++) { const t = P[(i + 1) % N].clone().sub(P[(i + N - 1) % N]); t.y = 0; T.push(t.normalize()); }
    this.ds = L / N;
    /* la altura: 5,8 m sobre lo más alto de alrededor (y nunca menos de 7,5), suavizada;
       en la terminal, al ras, con rampas de 55 m */
    const bruta = P.map((p, i) => { let h = -99; const n = T[i]; for (const k of [-2.5, 0, 2.5]) h = Math.max(h, altura(p.x - n.z * k, p.z + n.x * k)); return Math.max(7.5, h + 5.8); });
    let y = bruta.slice();
    for (let pasada = 0; pasada < 4; pasada++) {
      const s = y.slice(), V = 24;
      for (let i = 0; i < N; i++) { let m = 0; for (let k = -V; k <= V; k++) m += s[(i + k + N) % N]; y[i] = Math.max(bruta[i], m / (2 * V + 1)); }
    }
    const { x: tx, z0, z1, y: ty } = terminal;
    const enTerminal = (p) => Math.hypot(p.x - tx, p.z - Math.max(z0, Math.min(z1, p.z)));
    this.alto = y.map((v, i) => { const d = enTerminal(P[i]); return d < 1 ? ty : ty + (v - ty) * THREE.MathUtils.smoothstep(d, 0, 55); });
    for (let i = 0; i < N; i++) P[i].y = this.alto[i];

    this.viga(mundo, altura, enTerminal);
    this.armarParadas(mundo, altura, paradas);
    this.armarTrenes();
    this.jinete = null;
  }

  /* --------------------------------------------------------- la viga y los pilares */
  viga(mundo, altura, enTerminal) {
    const { P, T, N } = this;
    /* el corte: redondeado, blanco con una franja aqua a los costados */
    const B = [1, 1, 1], A = [0.26, 0.85, 0.8];
    const corte = [[-0.45, -0.12, B], [-0.33, 0, B], [0.33, 0, B], [0.45, -0.12, B], [0.45, -0.4, B], [0.45, -0.4, A], [0.45, -0.54, A], [0.45, -0.54, B], [0.45, -0.8, B], [0.33, -0.92, B],
      [-0.33, -0.92, B], [-0.45, -0.8, B], [-0.45, -0.54, B], [-0.45, -0.54, A], [-0.45, -0.4, A], [-0.45, -0.4, B]];
    const C = corte.length, pos = new Float32Array(N * C * 3), col = new Float32Array(N * C * 3), idx = [];
    for (let i = 0; i < N; i++) {
      const p = P[i], n = T[i];
      corte.forEach(([u, v, c], j) => { const k = (i * C + j) * 3; pos[k] = p.x - n.z * u; pos[k + 1] = p.y + v; pos[k + 2] = p.z + n.x * u; col.set(c, k); });
      const i2 = (i + 1) % N;
      for (let j = 0; j < C; j++) { const a = i * C + j, b = i * C + (j + 1) % C, c = i2 * C + j, d = i2 * C + (j + 1) % C; idx.push(a, c, b, b, c, d); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, brilloso('#ffffff', { vertexColors: true, roughness: 0.2, borde: 0.3 })); m.castShadow = true; m.receiveShadow = true;
    this.g.add(m);
    /* los pilares: cada 18 m donde la viga va alta, con capitel. Chocan */
    const pil = [], cap = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), V = new THREE.Vector3();
    for (let i = 0; i < N; i += Math.round(18 / this.ds)) {
      const p = P[i], suelo = altura(p.x, p.z), h = p.y - 0.9 - suelo;
      if (h < 2.2 || enTerminal(p) < 26) continue;
      const rot = Math.atan2(T[i].x, T[i].z);
      pil.push(M.compose(V.set(p.x, suelo - 0.6, p.z), Q.setFromEuler(E.set(0, rot, 0)), S.set(1, h + 0.6, 1)).clone());
      cap.push(M.compose(V.set(p.x, p.y - 0.9, p.z), Q, S.set(1, 1, 1)).clone());
      mundo.cilindro(p.x, p.z, 0.6, suelo - 1, p.y - 0.9);
    }
    const gp = new THREE.CylinderGeometry(0.4, 0.55, 1, 14); gp.translate(0, 0.5, 0);
    const gc = new THREE.CylinderGeometry(0.75, 0.45, 0.5, 14); gc.scale(1.5, 1, 1); gc.translate(0, -0.25, 0);
    const mat = brilloso('#f4f8fb', { roughness: 0.2, borde: 0.25 });
    for (const [geo, lista] of [[gp, pil], [gc, cap]]) {
      const im = new THREE.InstancedMesh(geo, mat, lista.length); lista.forEach((q, i) => im.setMatrixAt(i, q));
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); this.g.add(im);
    }
    /* donde la viga pasa baja (las rampas de la terminal) choca y se puede caminar arriba */
    for (let i = 0; i < N; i += 2) {
      const p = P[i], suelo = altura(p.x, p.z);
      if (p.y - suelo > 4.2 || enTerminal(p) < 22) continue;
      mundo.caja(p.x, p.z, 0.45, PASO * 1.1, suelo - 1, p.y, Math.atan2(T[i].x, T[i].z));
    }
  }

  /* ----------------------------------------------------------------- las paradas */
  armarParadas(mundo, altura, paradas) {
    const { P, T, N } = this;
    this.paradas = paradas.map((q, k) => {
      let mejor = 0, md = Infinity;
      for (let i = 0; i < N; i++) { const d = Math.hypot(P[i].x - q.en[0], P[i].z - q.en[1]); if (d < md) { md = d; mejor = i; } }
      const p = P[mejor], n = T[mejor], lado = Math.sign((q.en[0] - p.x) * -n.z + (q.en[1] - p.z) * n.x) || 1;
      return { ...q, i: mejor, s: mejor * this.ds, p, lado, giro: Math.atan2(n.x, n.z), terminal: k === 0 };
    }).sort((a, b) => a.s - b.s);
    /* que la terminal sea la primera (la cuenta del horario arranca ahí) */
    while (!this.paradas[0].terminal) this.paradas.push(this.paradas.shift());
    const afuera = this.paradas.filter((q) => !q.terminal);
    /* (en la obra el +x local es el costado derecho de la vía: el lado va al revés) */
    const obra = paradasMonorriel(afuera.map((q) => { const y = altura(q.p.x - T[q.i].z * q.lado * 5.4, q.p.z + T[q.i].x * q.lado * 5.4); return { x: q.p.x, y, z: q.p.z, giro: q.giro, lado: -q.lado, alto: q.p.y - y }; }));
    this.g.add(obra);
    afuera.forEach((q, k) => {
      const S = obra.userData.sitios[k];
      Object.assign(q, S);
      q.puerta.y = altura(q.puerta.x, q.puerta.z);
      /* el cartel con el nombre de la parada, arriba de la torre */
      const c = letrero(q.nombre, { ancho: 3.4, alto: 0.8, tinta: '#1a78c2', borde: '#7fd3ff', tam: 120 });
      c.position.copy(q.cartel); c.rotation.y = q.giroCartel; c.material.side = THREE.DoubleSide; this.g.add(c);
      /* los sólidos: la torre y el andén de arriba */
      const [tx, tz] = [q.p.x - T[q.i].z * q.lado * 5.4, q.p.z + T[q.i].x * q.lado * 5.4];
      mundo.cilindro(tx, tz, 1.3, q.puerta.y - 1, q.piso + 2.9, { tipo: 'piedra' });
      mundo.caja(q.anden.x, q.anden.z, 1.55, 6, q.piso - 0.4, q.piso, q.giro);
    });
  }

  /* ------------------------------------------------------------------ los trenes */
  armarTrenes() {
    /* el horario: por tramo, lo que tarda (arranca, va, frena) y la espera */
    const Q = this.paradas, L = this.L;
    this.tramos = Q.map((q, k) => {
      const d = ((Q[(k + 1) % Q.length].s - q.s) + L) % L || L;
      const dA = VMAX * VMAX / ACEL;   // arrancar y frenar
      const tarda = d >= dA ? d / VMAX + VMAX / ACEL : 2 * Math.sqrt(d / ACEL);
      return { desde: k, d, tarda, espera: q.terminal ? ESPERA_TERMINAL : ESPERA };
    });
    this.periodo = this.tramos.reduce((s, t) => s + t.tarda + t.espera, 0);
    /* dos trenes, a medio período uno del otro; cada uno, dos vagones (el de atrás, al revés) */
    this.trenes = [0, 0.5].map((f) => ({ f, s: 0, v: 0, parada: 0, resta: 0, prox: 1, montura: null }));
    const lugares = []; for (let i = 0; i < 4; i++) lugares.push([0, -50, 0, 1, 0]);
    this.vagones = instancias('vagon', lugares, { alto: 3.1 });
    for (const im of this.vagones.children) im.frustumCulled = false;
    this.g.add(this.vagones);
    this.trenes.forEach((tr) => { tr.montura = this.montura(tr); });
  }
  reloj() { return Date.now() / 1000; }
  /* dónde anda el tren en el segundo t del período */
  estado(tr, ahora = this.reloj()) {
    let t = ((ahora / this.periodo + tr.f) % 1) * this.periodo;
    for (const T of this.tramos) {
      const q = this.paradas[T.desde];
      if (t < T.espera) { tr.s = q.s; tr.v = 0; tr.parada = T.desde; tr.resta = T.espera - t; tr.prox = T.desde; return tr; }
      t -= T.espera;
      if (t < T.tarda) {
        const dA = Math.min(T.d / 2, VMAX * VMAX / (2 * ACEL)), tA = Math.sqrt(2 * dA / ACEL), vM = ACEL * tA, tC = T.tarda - 2 * tA;
        let x;
        if (t < tA) { x = ACEL * t * t / 2; tr.v = ACEL * t; }
        else if (t < tA + tC) { x = dA + vM * (t - tA); tr.v = vM; }
        else { const u = T.tarda - t; x = T.d - ACEL * u * u / 2; tr.v = ACEL * u; }
        tr.s = (q.s + x) % this.L; tr.parada = -1; tr.prox = (T.desde + 1) % this.paradas.length; tr.resta = 0;
        return tr;
      }
      t -= T.tarda;
    }
    return tr;
  }
  /* cuánto falta (s) para que algún tren pare en la parada k (0: ya está) */
  llega(k, ahora = this.reloj()) {
    let ini = 0; for (let j = 0; j < k; j++) ini += this.tramos[j].espera + this.tramos[j].tarda;
    let mejor = Infinity;
    for (const tr of this.trenes) {
      const t = ((ahora / this.periodo + tr.f) % 1) * this.periodo;
      mejor = Math.min(mejor, t >= ini && t < ini + this.tramos[k].espera ? 0 : (ini - t + this.periodo) % this.periodo);
    }
    return mejor;
  }
  /* un punto de la vía a s metros (interpolado) */
  en(s, out = new THREE.Vector3()) {
    const u = (((s % this.L) + this.L) % this.L) / this.ds, i = Math.floor(u) % this.N, f = u - Math.floor(u);
    return out.copy(this.P[i]).lerp(this.P[(i + 1) % this.N], f);
  }
  /* la pose de un vagón con su centro a s metros: posición de la base y cuaternión (sigue la subida) */
  pose(s, P, Q) {
    const a = this.en(s + LARGO_VAGON * 0.4, _a), b = this.en(s - LARGO_VAGON * 0.4, _b);
    P.copy(a).add(b).multiplyScalar(0.5);
    _d.copy(a).sub(b).normalize();
    Q.setFromUnitVectors(_z, _d);
    /* setFromUnitVectors puede rolar: se rehace con rumbo y cabeceo */
    const rumbo = Math.atan2(_d.x, _d.z), cab = -Math.asin(THREE.MathUtils.clamp(_d.y, -1, 1));
    Q.setFromEuler(_e.set(cab, rumbo, 0, 'YXZ'));
    return rumbo;
  }
  actualizar() {
    const ahora = this.reloj();
    this.trenes.forEach((tr, k) => {
      this.estado(tr, ahora);
      for (let j = 0; j < 2; j++) {
        const s = tr.s - j * (LARGO_VAGON + SEP);
        const rumbo = this.pose(s, _p, _q);
        /* la pollera del vagón abraza la viga: la base va 20 cm abajo de lo de arriba de la viga */
        _p.y -= 0.2;
        if (j === 0) { tr.rumbo = rumbo; tr.base = tr.base || new THREE.Vector3(); tr.base.copy(_p); tr.q = tr.q || new THREE.Quaternion(); tr.q.copy(_q); }
        if (j === 1) _q.multiply(_giro);
        _m.compose(_p, _q, _s.setScalar(1));
        for (const im of this.vagones.children) im.setMatrixAt(k * 2 + j, _m);
      }
    });
    for (const im of this.vagones.children) im.instanceMatrix.needsUpdate = true;
  }

  /* ------------------------------------------------------------------ viajar */
  /* el tren como montura: el asiento, para dónde mira, dónde se baja */
  montura(tr) {
    const R = this;
    return {
      tren: tr, jinete: null, camDist: 2.1, bajoAgua: false, rumbo: 0, p: new THREE.Vector3(),
      manejar() { this.rumbo = tr.rumbo; },
      asiento() { return this.p.set(0.55, 0.62, 1.2).applyQuaternion(tr.q).add(tr.base); },
      puedeBajar() { return tr.parada >= 0; },
      salida() {
        const q = R.paradas[tr.parada];
        if (!q) return null;
        if (q.terminal) return q.bajada ? q.bajada.clone() : null;
        return q.puerta.clone().setY(q.puerta.y + 0.1);
      },
    };
  }
  /* el tren parado en la parada k, si hay */
  paradoEn(k) { return this.trenes.find((tr) => tr.parada === k) || null; }
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _e = new THREE.Euler(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const _giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
