/* ============================================================================
   ruta40/js/juego.js — un viaje (o una picada): el auto, los rivales, lo que
   se junta, los trucos, cómo termina y la cámara.

   La física corre a 240 pasos por segundo; el dibujo mezcla el paso de antes
   y el de ahora (así no tiembla en pantallas de 90, 120 o 144 Hz).
   Todo lo que pasa sale como un evento (para el sonido, la vibración y la
   interfaz): { tipo: 'moneda' | 'nafta' | 'mojon' | 'truco' | 'aterriza' |
   'golpe' | 'fin' | 'record' | 'naftaBaja' | 'rivalMeta' | 'meta', … }.
   ========================================================================== */
import { crearAuto, pasoAuto, PASO, altoEn, volcado } from './fisica.js';
import { VEHICULOS, aFisica } from './vehiculos.js';
import { generarTramo } from './ruta.js';
import { crearPiloto } from './piloto.js';
import { VISTA } from './vista.js';
import { t } from './textos.js';

const cache = {};
export const tramoDe = (id) => (cache[id] = cache[id] || generarTramo(id));

export const LARGO_PICADA = 1200;
const NOMBRES = ['El Turco', 'La Negra', 'Chiquito', 'Pocho', 'La Gringa', 'Cacho', 'El Rulo', 'Pirucha', 'Nené', 'Tucu', 'La Flaca', 'Bocha'];
/* la del barrio se tiene que poder ganar con la chata del principio: ahí no corre ningún Fitito */
const RIVALES_NIVEL = [['chata', 'colectivo', 'chata'], ['escarabajo', 'colectivo', 'cuatro'], ['cuatro', 'tractor', 'cuatro']];
/* las picadas de cada tramo: tres, cada una con rivales mejores */
export function picada(tramoId, nivel) {
  const i = ['puna', 'quebrada', 'salinas', 'valles', 'cuyo', 'patagonia', 'glaciar'].indexOf(tramoId);
  const mej = Math.min(10, i + nivel * 3 + (nivel ? 1 : 0)), duda = [0.55, 0.28, 0.08][nivel];
  return {
    nivel, premio: Math.round((600 + i * 350) * [1, 2.4, 5][nivel] / 50) * 50,
    rivales: RIVALES_NIVEL[nivel].map((v, k) => ({ vehiculo: v, mej, duda, nombre: NOMBRES[(i * 3 + nivel * 5 + k * 7) % NOMBRES.length], semilla: 11 + i * 31 + nivel * 7 + k })),
  };
}

/* cuánto se mueve para "aterrizar": se deja al auto quieto un ratito antes de largar */
function asentar(A, S, seg) { for (let t = 0; t < seg; t += PASO) pasoAuto(A, S, { gas: 0, freno: 0 }, PASO); A.nafta = A.tanque; }
const guardarPrev = (A) => { A.prev = { x: A.x, y: A.y, a: A.a, ruedas: A.ruedas.map((r) => ({ px: r.px, py: r.py, ang: r.ang })) }; };
const mezclarDib = (A, f) => {
  const p = A.prev; if (!p) { A.dib = A; return; }
  const l = (a, b) => a + (b - a) * f;
  A.dib = { x: l(p.x, A.x), y: l(p.y, A.y), a: l(p.a, A.a), ruedas: A.ruedas.map((r, i) => ({ px: l(p.ruedas[i].px, r.px), py: l(p.ruedas[i].py, r.py), ang: l(p.ruedas[i].ang, r.ang) })) };
};

export class Viaje {
  /* o: { tramo, vehiculo, niveles, modo: 'viaje' | 'picada', picada, record, alEvento } */
  constructor(o) {
    this.o = o; this.modo = o.modo || 'viaje';
    this.R = tramoDe(o.tramo);
    const R = this.R, def = VEHICULOS[o.vehiculo];
    const x0 = 4;
    this.yo = crearAuto(def, x0, R.alto(x0) + 1.2 + def.ruedas[0].r, aFisica(o.niveles));
    this.yo.nombre = 'yo';
    asentar(this.yo, R.S, 0.9);
    this.autos = [this.yo];
    this.rivales = [];
    if (this.modo === 'picada') {
      for (const [k, r] of o.picada.rivales.entries()) {
        const d = VEHICULOS[r.vehiculo];
        const A = crearAuto(d, x0 - 0.01 * (k + 1), R.alto(x0) + 1.2 + d.ruedas[0].r, aFisica({ motor: r.mej, llantas: r.mej, susp: r.mej, tanque: r.mej, aire: r.mej }));
        asentar(A, R.S, 0.9);
        A.nombre = r.nombre; A.piloto = crearPiloto({ tope: 0.5, mira: 0.3, tol: 0.1, duda: r.duda, gasAlAterrizar: 1 }, r.semilla);
        this.rivales.push(A); this.autos.push(A);
      }
    }
    this.meta = this.modo === 'picada' ? LARGO_PICADA : R.largo;
    this.record = this.modo === 'viaje' ? (o.record || 0) : 0;
    this.tomados = { monedas: new Uint8Array(R.monedas.length), nafta: new Uint8Array(R.nafta.length) };
    this.iMon = 0; this.mojon = 0;
    this.monedas = 0; this.deTrucos = 0; this.deMojones = 0; this.deMonedas = 0;
    this.t = 0; this.acum = 0; this.lento = 1;
    this.fin = null; this.finT = 0;
    this.aire = 0; this.giro = 0; this.willy = 0; this.ultTruco = -9; this.combo = 0; this.pendiente = null;
    this.parado = 0; this.volc = 0; this.avance = 0; this.tAvance = 0; this.pasoRecord = false; this.avisoNafta = false;
    this.puesto = null; this.llegados = [];
    this.cuenta = this.modo === 'picada' ? 3.6 : 0;   // la cuenta regresiva del semáforo
    this.cab = { x: 0, y: 0, g: 0, vx: 0, vy: 0 };
    this.vuelos = 0; this.maxAire = 0; this.vueltas = 0;
    this.cam = { x: this.yo.x + 3, y: this.yo.y + 1, esc: 0, alto: 13 };
    for (const A of this.autos) guardarPrev(A);
  }
  ev(e) { if (this.o.alEvento) this.o.alEvento(e); }
  /* llevar el auto a otro lugar del tramo (para las pruebas y las capturas) */
  mover(x) {
    const A = this.yo, d = A.def;
    Object.assign(A, crearAuto(d, x, this.R.alto(x) + 1.2 + d.ruedas[0].r, A.mej), { nombre: 'yo' });
    asentar(A, this.R.S, 0.6);
    this.iMon = 0; this.mojon = this.R.mojones.filter((m) => m.x < x).length; this.avance = x; this.tAvance = this.t;
    guardarPrev(A);
    this.cam.x = x + 3; this.cam.y = A.y + 1;
  }
  get estado() { return { autos: this.autos, yo: this.yo, tomados: this.tomados, record: this.record, meta: this.meta, textoMeta: this.modo === 'picada' ? t('pc_meta') : t('llegada').replace(/[¡!]/g, '') }; }
  get metros() { return Math.max(0, this.yo.x - 4); }

  /* ------------------------------------------------ avanzar dt segundos de reloj */
  avanzar(dt, inp, dib) {
    dt = Math.min(dt, 0.1);
    if (this.cuenta > 0) {
      const antes = Math.ceil(this.cuenta);
      this.cuenta -= dt;
      if (Math.ceil(this.cuenta) !== antes && this.cuenta > 0) this.ev({ tipo: 'semaforo', n: Math.ceil(this.cuenta) });
      if (this.cuenta <= 0) this.ev({ tipo: 'largada' });
      this.camara(dib, dt, true);
      return;
    }
    if (this.fin) { this.finT += dt; this.lento = Math.max(0.2, this.lento - dt * 2); }
    this.acum += dt * this.lento;
    let pasos = 0;
    while (this.acum >= PASO && pasos < 40) {
      this.acum -= PASO; pasos++;
      for (const A of this.autos) guardarPrev(A);
      this.paso(inp, dib);
    }
    const f = this.acum / PASO;
    for (const A of this.autos) mezclarDib(A, f);
    this.cabeza(dt);
    this.camara(dib, dt, false);
  }

  /* ------------------------------------------------ un paso de física y de reglas */
  paso(inp, dib) {
    const A = this.yo, R = this.R, S = R.S;
    this.t += PASO;
    const vx0 = A.vx, vy0 = A.vy, tocaba = A.tocaAlguna, ruedasAntes = A.ruedas.map((r) => r.toca);
    const entrada = this.fin ? { gas: 0, freno: this.fin === 'meta' || this.fin === 'llego' ? 0.3 : 0 } : inp;
    pasoAuto(A, S, entrada, PASO);
    for (const B of this.rivales) {
      if (B.llego) { pasoAuto(B, S, { gas: 0, freno: 0.4 }, PASO); continue; }
      pasoAuto(B, S, B.piloto(B, S, PASO), PASO);
      B.nafta = B.tanque;
      if (B.x >= this.meta) { B.llego = true; this.llegados.push(B.nombre); this.ev({ tipo: 'rivalMeta', nombre: B.nombre, n: this.llegados.length }); }
      /* un rival que se da la cabeza vuelve a arrancar un poco más atrás (como en el barrio) */
      if (B.choco || (volcado(B) && (B.volc = (B.volc || 0) + PASO) > 1.5)) {
        const nx = Math.max(4, B.x - 6), d = B.def;
        Object.assign(B, crearAuto(d, nx, R.alto(nx) + 1.2 + d.ruedas[0].r, { motor: 0.5, llantas: 0.5, susp: 0.5, tanque: 0.5, aire: 0.5 }), { piloto: B.piloto, nombre: B.nombre, volc: 0 });
        guardarPrev(B);
      }
    }
    if (this.modo === 'picada') A.nafta = A.tanque;
    const v = Math.hypot(A.vx, A.vy);

    /* ---- lo que se junta ---- */
    const M = R.monedas;
    while (this.iMon < M.length && M[this.iMon].x < A.x - 6) this.iMon++;
    for (let i = this.iMon; i < M.length && M[i].x < A.x + 6; i++) {
      if (this.tomados.monedas[i]) continue;
      const q = M[i];
      if (this.toca(A, q.x, q.y, 0.95)) {
        this.tomados.monedas[i] = 1; this.monedas += q.v; this.deMonedas += q.v;
        this.ev({ tipo: 'moneda', v: q.v, x: q.x, y: q.y });
      }
    }
    for (let i = 0; i < R.nafta.length; i++) {
      const q = R.nafta[i];
      if (this.tomados.nafta[i] || Math.abs(q.x - A.x) > 5) continue;
      if (this.toca(A, q.x, q.y, 1.25)) { this.tomados.nafta[i] = 1; A.nafta = A.tanque; this.avisoNafta = false; this.ev({ tipo: 'nafta', x: q.x, y: q.y }); }
    }
    if (this.modo === 'viaje') {
      while (this.mojon < R.mojones.length && A.x >= R.mojones[this.mojon].x) {
        const m = R.mojones[this.mojon++], bono = 100 * this.mojon;
        this.monedas += bono; this.deMojones += bono;
        this.ev({ tipo: 'mojon', n: m.x, bono, x: m.x, y: m.y + 2.5 });
      }
      if (!this.pasoRecord && this.record > 50 && this.metros > this.record) { this.pasoRecord = true; this.ev({ tipo: 'record', x: A.x, y: A.y + 3 }); }
      if (!this.avisoNafta && A.nafta < A.tanque * 0.22) { this.avisoNafta = true; this.ev({ tipo: 'naftaBaja' }); }
    }

    /* ---- los golpes y los aterrizajes (para el sonido, el sacudón y el polvo) ---- */
    const dv = Math.hypot(A.vx - vx0, A.vy - vy0);
    if (!tocaba && A.tocaAlguna && this.aire > 0.25) this.ev({ tipo: 'aterriza', fuerza: Math.min(1, (this.aire * 0.5 + Math.abs(vy0) * 0.06)), x: A.x, y: A.y });
    else if (A.golpe > 2.5 && dv > 1.2) this.ev({ tipo: 'golpe', fuerza: Math.min(1, A.golpe / 8), x: A.x, y: A.y });
    for (let i = 0; i < A.ruedas.length; i++) if (!ruedasAntes[i] && A.ruedas[i].toca && Math.abs(A.ruedas[i].vy) > 3) this.ev({ tipo: 'rebote', rueda: i, fuerza: Math.min(1, Math.abs(A.ruedas[i].vy) / 10) });

    /* ---- los trucos ---- */
    if (!this.fin) this.trucos(A, tocaba);

    /* ---- el polvo, el humo y la nieve ---- */
    if (dib) this.polvo(A, dib, v, entrada);

    /* ---- cómo termina ---- */
    if (this.fin) return;
    if (A.choco) return this.terminar('cabeza');
    this.volc = volcado(A) ? this.volc + PASO : 0;
    if (this.volc > 2.5) return this.terminar('volco');
    this.parado = v < 0.3 ? this.parado + PASO : 0;
    if (A.x > this.avance + 0.5) { this.avance = A.x; this.tAvance = this.t; }
    if (A.nafta <= 0 && (this.parado > 1.5 || this.t - this.tAvance > 3)) return this.terminar('nafta');
    if (A.x >= this.meta) {
      if (this.modo === 'picada') { this.puesto = this.llegados.length + 1; return this.terminar('meta'); }
      return this.terminar('llego');
    }
  }
  toca(A, x, y, r) {
    if (Math.hypot(A.x - x, A.y - y) < r + 0.8) return true;
    for (const w of A.ruedas) if (Math.hypot(w.px - x, w.py - y) < r) return true;
    const c = A.def.cabeza, cs = Math.cos(A.a), sn = Math.sin(A.a);
    return Math.hypot(A.x + c.x * cs - c.y * sn - x, A.y + c.x * sn + c.y * cs - y) < r;
  }
  terminar(causa) {
    this.fin = causa; this.finT = 0;
    if (this.pendiente && causa !== 'cabeza' && causa !== 'volco') this.cobrar();
    this.pendiente = null;
    this.ev({ tipo: 'fin', causa, puesto: this.puesto });
  }

  /* ------------------------------------------------ vuelos, vueltas, willy, aterrizajes */
  trucos(A, tocaba) {
    const enAire = !A.tocaAlguna;
    if (enAire) { this.aire += PASO; this.giro += A.w * PASO; }
    /* ¿casi se da la cabeza? (pasa a menos de 25 cm del piso y se salva) */
    const c = A.def.cabeza, cs = Math.cos(A.a), sn = Math.sin(A.a);
    const hx = A.x + c.x * cs - c.y * sn, hy = A.y + c.x * sn + c.y * cs;
    const dCab = hy - altoEn(this.R.S, hx) - c.r;
    if (dCab < 0.25 && dCab > 0 && Math.abs(A.a) > 1.2) this.casi = true;
    if (tocaba === false && A.tocaAlguna) {
      /* aterrizó: se arma el truco, y se cobra en un ratito si no se dio la cabeza */
      const vueltas = Math.floor((Math.abs(this.giro) + 0.5) / (Math.PI * 2));
      const partes = [];
      let plata = 0;
      if (this.aire > 1.1) { const s = this.aire.toFixed(1); plata += Math.round(this.aire * 30); partes.push(t('vuelo', { n: s })); this.vuelos++; this.maxAire = Math.max(this.maxAire, this.aire); }
      if (vueltas > 0) {
        const nom = this.giro > 0 ? t('vueltaAtras') : t('vueltaAdelante');
        plata += 300 * vueltas * vueltas; partes.push(vueltas > 1 ? `${nom} ${t('doble', { n: vueltas })}` : nom); this.vueltas += vueltas;
      }
      const ambas = A.ruedas.every((r) => r.toca);
      if (this.aire > 1.1 && ambas) { plata += 50; partes.push(t('limpio')); }
      if (this.casi && vueltas > 0) { plata += 150; partes.push(t('casi')); }
      if (plata > 0) {
        this.combo = this.t - this.ultTruco < 3.5 ? this.combo + 1 : 1;
        if (this.combo > 1) { plata = Math.round(plata * (1 + 0.5 * (this.combo - 1))); partes.push(t('combo', { n: this.combo })); }
        this.pendiente = { plata, partes, hasta: this.t + 0.45, x: A.x, y: A.y + 2.2, vueltas };
      }
      this.aire = 0; this.giro = 0; this.casi = false;
    }
    if (A.tocaAlguna && !enAire) { this.aire = 0; this.giro = 0; }
    if (this.pendiente && this.t > this.pendiente.hasta) this.cobrar();
    /* el willy: rueda de atrás en el piso, la de adelante en el aire, con velocidad */
    const [ra, rd] = A.ruedas;
    if (ra.toca && !rd.toca && A.vx > 3) this.willy += PASO;
    else {
      if (this.willy > 1.4) { const plata = Math.round(this.willy * 25); this.monedas += plata; this.deTrucos += plata; this.ev({ tipo: 'truco', texto: t('willy', { n: this.willy.toFixed(1) }), plata, x: A.x, y: A.y + 2.2 }); }
      this.willy = 0;
    }
  }
  cobrar() {
    const p = this.pendiente; this.pendiente = null;
    this.monedas += p.plata; this.deTrucos += p.plata; this.ultTruco = this.t;
    this.ev({ tipo: 'truco', texto: p.partes.join(' · '), plata: p.plata, x: p.x, y: p.y, vueltas: p.vueltas });
  }

  /* ------------------------------------------------ el polvo que levantan las ruedas */
  polvo(A, dib, v, inp) {
    const V = VISTA[this.R.id];
    if (Math.random() > 0.35) return;
    for (let i = 0; i < A.ruedas.length; i++) {
      const w = A.ruedas[i], D = A.def.ruedas[i];
      if (!w.toca) continue;
      const empuja = (A.def.traccion === 'ambas' || i === 0) && inp.gas > 0;
      const fuerza = Math.min(1, v / 18) * 0.6 + (empuja ? 0.3 : 0) + Math.min(1, A.patina / 4) * 0.8;
      if (Math.random() > fuerza) continue;
      const px = w.px - D.r * 0.3, py = w.py - D.r * 0.85;
      const tipo = V.pasto === 'nieve' || V.pasto === 'sal' ? 'nieve' : 'polvo';
      dib.echar(tipo, px, py, -A.vx * 0.15 - 1, 0.8 + Math.random(), 1, { color: V.polvo, tam: 0.22 * A.def.polvo, dura: 1.1, abre: 1.2 });
      if (A.patina > 2 && Math.random() < 0.4) dib.echar('piedra', px, py, -A.vx * 0.3 - 2, 3 + Math.random() * 2, 1, { color: [70, 55, 40], tam: 0.35, dura: 0.7, abre: 2 });
    }
    /* el humo del caño de escape, al acelerar */
    if (inp.gas > 0 && Math.random() < 0.25) {
      const D = A.def, cs = Math.cos(A.a), sn = Math.sin(A.a), bx = -D.largo * 0.48, by = -0.1;
      dib.echar('humo', A.x + bx * cs - by * sn, A.y + bx * sn + by * cs, A.vx * 0.6 - 1.2, 0.3, 1, { tam: 0.14, dura: 0.9, abre: 0.5 });
    }
    /* chispas si el casco raspa el piso rápido */
    if (A.golpe > 1 && v > 6) dib.echar('chispa', A.x, A.y - 0.4, -A.vx * 0.4, 3, 2, { dura: 0.4, abre: 4 });
  }

  /* ------------------------------------------------ la cabeza del conductor: un resorte que se hamaca */
  cabeza(dt) {
    const A = this.yo, c = this.cab;
    const ax = (A.vx - (this.vxAnt ?? A.vx)) / Math.max(dt, 1e-3), ay = (A.vy - (this.vyAnt ?? A.vy)) / Math.max(dt, 1e-3);
    this.vxAnt = A.vx; this.vyAnt = A.vy;
    /* al chasis: la aceleración empuja la cabeza para el otro lado */
    const cs = Math.cos(A.a), sn = Math.sin(A.a);
    const lx = ax * cs + ay * sn, ly = -ax * sn + ay * cs;
    const qx = Math.max(-0.12, Math.min(0.12, -lx * 0.006)), qy = Math.max(-0.08, Math.min(0.08, -ly * 0.004));
    const k = 90, amort = 12;
    c.vx += ((qx - c.x) * k - c.vx * amort) * dt; c.vy += ((qy - c.y) * k - c.vy * amort) * dt;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.g = c.x * 1.6 + (this.fin === 'cabeza' ? Math.min(0.6, this.finT * 2) : 0);
    A.cabezaDes = c;
  }

  /* ------------------------------------------------ la cámara */
  camara(dib, dt, quieta) {
    if (!dib) return;
    const A = this.yo, p = A.dib || A, c = this.cam;
    const v = Math.hypot(A.vx, A.vy);
    const alto = Math.max(0, p.y - this.R.alto(p.x));
    /* cuánto se ve de alto (m): más con velocidad y con altura */
    /* en un teléfono acostado (poco alto) se acerca un poco, para que el auto no quede chiquito */
    const base = dib.H / (dib.dprCss || 1) < 500 ? 11 : 12.5;
    const quiero = base + Math.min(7, v * 0.28) + Math.min(9, alto * 0.45);
    /* se aleja rápido y se acerca despacio (si no, marea) */
    const k = Math.min(1, dt * (quiero > c.alto ? 2.2 : 1.2));
    c.alto += (quiero - c.alto) * k;
    const mira = Math.max(-2, Math.min(6.5, A.vx * 0.42));
    const tx = p.x + mira + A.def.largo * 0.1, ty = p.y + 0.6 - Math.min(3, alto * 0.25);
    const kx = quieta ? 1 : Math.min(1, dt * 6), ky = quieta ? 1 : Math.min(1, dt * 4.5);
    c.x += (tx - c.x) * kx; c.y += (ty - c.y) * ky;
    dib.cam.x = c.x; dib.cam.y = c.y; dib.cam.esc = dib.H / c.alto;
  }
}
