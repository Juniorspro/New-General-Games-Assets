"use strict";
// ════════════════════════════════════════════════════════════════════════
// Las reglas: autobús y salto, movilidad, inventario, armas, curas, pico,
// construcción, botín, bots y tormenta. Todo cuelga de M (el motor).
// ════════════════════════════════════════════════════════════════════════
const RADIO_J = 0.42, ALTO_J = 1.8, ALTO_AGACHADO = 1.25;
const VEL = 5.6, VEL_CORRER = 7.3, VEL_AGACHADO = 2.8, VEL_MIRA = 3.4, VEL_NADO = 4.2, GRAVEDAD = 24, SALTO = 7.8;
const NIVEL_AGUA = -1.3, R0 = 330, CAIDA_SEGURA = 8.5;
// Fases de la tormenta (espera, cierre, radio relativo, daño por segundo): como el original, pega más cada vez.
const FASES_TORMENTA = [
  { espera: 80, cierre: 45, radio: 0.6, dano: 1 }, { espera: 50, cierre: 35, radio: 0.38, dano: 1 }, { espera: 40, cierre: 30, radio: 0.23, dano: 2 },
  { espera: 35, cierre: 25, radio: 0.12, dano: 5 }, { espera: 30, cierre: 20, radio: 0.055, dano: 8 }, { espera: 25, cierre: 20, radio: 0.02, dano: 10 }, { espera: 20, cierre: 25, radio: 0, dano: 10 },
];
const PROB_PISO = [40, 30, 20, 8, 2], PROB_COFRE = [12, 34, 32, 17, 5];

function instalarJuego(M) {
  const isla = M.isla, G = M.G, { terreno, grilla } = isla;
  let P = null, idBotin = 1;
  const alAire = (p) => p.estado === "cae" || p.estado === "planea";
  const altura = (p) => (p.agachado || p.deslizando > 0 ? ALTO_AGACHADO : ALTO_J);
  const enMano = (p) => { const it = p.inv[p.sel]; if (!it) return null; if (it.tipo === "pico") return { clave: "pico", rareza: 1 }; if (it.tipo === "arma") return { clave: it.arma, rareza: it.rareza }; return { clave: it.c, rareza: 0 }; };

  // ════════════════════════════════════════════════════════════════════
  // Superficies y choques
  // ════════════════════════════════════════════════════════════════════
  const alturaTejado = (o, x, z) => {
    if (x < o.min.x || x > o.max.x || z < o.min.z || z > o.max.z) return -Infinity;
    const off = o.eje === "x" ? Math.abs(z - o.z) / (o.d / 2) : Math.abs(x - o.x) / (o.w / 2);
    return o.y + o.alto * (1 - clamp(off, 0, 1));
  };
  function alturaPieza(s, x, z) {
    if (x < s.min.x - 0.01 || x > s.max.x + 0.01 || z < s.min.z - 0.01 || z > s.max.z + 0.01) return -Infinity;
    if (s.tipo2 === "muro" || s.tipo2 === "piso") return s.max.y;
    if (s.tipo2 === "escalera") return s.base + clamp(((x - s.cx) * s.dx + (z - s.cz) * s.dz) / CELDA + 0.5, 0, 1) * ALTO + 0.1;
    return s.base + 1.8 * clamp(1 - Math.max(Math.abs(x - s.cx), Math.abs(z - s.cz)) / (CELDA / 2), 0, 1);
  }
  // La superficie más alta en (x,z) a la que se llega desde la altura y subiendo hasta "subida".
  function sueloEn(x, z, y, subida = 0.6) {
    let s = terreno(x, z); if (s < NIVEL_AGUA - 0.2) s = NIVEL_AGUA - 0.2; // en lo hondo se nada
    const tope = y + subida;
    grilla.cerca(x - 0.3, z - 0.3, x + 0.3, z + 0.3, (o) => {
      let hh = -Infinity;
      if (o.tipo === "caja") { if (x >= o.min.x && x <= o.max.x && z >= o.min.z && z <= o.max.z) hh = o.max.y; }
      else if (o.tipo === "tejado") hh = alturaTejado(o, x, z);
      else if (o.tipo === "auto") { if (!o.roto) for (const q of o.puntos) if (Math.hypot(x - q.x, z - q.z) < 1.05) hh = o.y0 + 1.5; }
      else if (o.tipo === "roca") { if (!o.roto) { const d = Math.hypot(x - o.x, z - o.z) / o.radio; if (d < 0.8) hh = o.y0 + o.sy * 1.0 * (1 - d * d * 0.7); } }
      else if (o.tipo === "estructura") hh = alturaPieza(o, x, z);
      if (hh <= tope && hh > s) s = hh;
    });
    return s;
  }
  function empujarCaja(p, mn, mx, alto) {
    if (p.y > mx.y - 0.35 || p.y + alto < mn.y) return;
    const x0 = mn.x - RADIO_J, x1 = mx.x + RADIO_J, z0 = mn.z - RADIO_J, z1 = mx.z + RADIO_J;
    if (p.x <= x0 || p.x >= x1 || p.z <= z0 || p.z >= z1) return;
    // Cabezazo contra un techo al saltar.
    if (p.vy > 0 && p.y + alto - 0.35 < mn.y && p.x > mn.x && p.x < mx.x && p.z > mn.z && p.z < mx.z) { p.vy = 0; p.y = mn.y - alto; return; }
    const a = p.x - x0, b = x1 - p.x, c = p.z - z0, d = z1 - p.z, m = Math.min(a, b, c, d);
    if (m === a) p.x = x0; else if (m === b) p.x = x1; else if (m === c) p.z = z0; else p.z = z1;
    p.choco = true;
  }
  function empujarCirculo(p, cx, cz, r) { const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), m = r + RADIO_J; if (d < m && d > 1e-4) { p.x = cx + (dx / d) * m; p.z = cz + (dz / d) * m; p.choco = true; } }
  function empujarFuera(p) {
    const alto = altura(p); p.choco = false;
    grilla.cerca(p.x - 2.6, p.z - 2.6, p.x + 2.6, p.z + 2.6, (o) => {
      if (o.tipo === "caja") empujarCaja(p, o.min, o.max, alto);
      else if (o.tipo === "arbol") { if (!o.roto && p.y < o.y0 + o.alto) empujarCirculo(p, o.x, o.z, o.rt); }
      else if (o.tipo === "roca") { if (!o.roto && p.y < o.y0 + o.sy * 0.7) empujarCirculo(p, o.x, o.z, o.radio * 0.82); }
      else if (o.tipo === "auto") { if (!o.roto && p.y < o.y0 + 1.1) for (const q of o.puntos) empujarCirculo(p, q.x, q.z, 1.0); }
      else if (o.tipo === "estructura" && (o.tipo2 === "muro" || o.tipo2 === "piso")) empujarCaja(p, o.min, o.max, alto);
    });
    for (const o of P.jugadores) { if (o === p || !o.vivo || alAire(o) || o.estado === "bus" || Math.abs(o.y - p.y) > 1.5) continue; const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz); if (d < RADIO_J * 2 && d > 1e-4) { const k = (RADIO_J * 2 - d) / 2; p.x += (dx / d) * k; p.z += (dz / d) * k; } }
  }

  // ════════════════════════════════════════════════════════════════════
  // Rayos: lo primero que toca una bala (o la cámara, o una mirada)
  // ════════════════════════════════════════════════════════════════════
  function cajaRayo(o, d, mn, mx) {
    let t0 = 0, t1 = Infinity;
    for (const k of ["x", "y", "z"]) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) return Infinity; continue; }
      let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k]; if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return Infinity;
    }
    return t0 > 0 ? t0 : Infinity;
  }
  function esferaRayo(o, d, cx, cy, cz, r) { const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz, b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r, disc = b * b - c; if (disc < 0) return Infinity; const t = -b - Math.sqrt(disc); return t > 0 ? t : Infinity; }
  function cilindroRayo(o, d, cx, cz, r, y0, y1) {
    const ox = o.x - cx, oz = o.z - cz, a = d.x * d.x + d.z * d.z; if (a < 1e-8) return Infinity;
    const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r, disc = b * b - a * c; if (disc < 0) return Infinity;
    const t = (-b - Math.sqrt(disc)) / a; if (t <= 0) return Infinity; const y = o.y + d.y * t; return y >= y0 && y <= y1 ? t : Infinity;
  }
  function planoRampa(o, d, s) {
    const k = ALTO / CELDA, den = d.y - k * (d.x * s.dx + d.z * s.dz); if (Math.abs(den) < 1e-6) return Infinity;
    const t = (s.base + ALTO / 2 + k * ((o.x - s.cx) * s.dx + (o.z - s.cz) * s.dz) - o.y) / den; if (t <= 0) return Infinity;
    const x = o.x + d.x * t, z = o.z + d.z * t; return x < s.min.x || x > s.max.x || z < s.min.z || z > s.max.z ? Infinity : t;
  }
  // opciones: jugadores (se choca con gente), plantas (árboles y rocas), soloDuros (para la cámara).
  function rayo(o, d, max, ignorar, jugadores = true, plantas = true) {
    let que = null, ref = null, parte = null, mejorT = max;
    grilla.recorrer(o, d, max, (ob) => {
      let t = Infinity;
      if (ob.tipo === "caja") t = cajaRayo(o, d, ob.min, ob.max);
      else if (ob.tipo === "tejado") t = cajaRayo(o, d, ob.min, ob.max);
      else if (ob.tipo === "estructura") t = ob.tipo2 === "escalera" ? planoRampa(o, d, ob) : cajaRayo(o, d, ob.min, ob.tipo2 === "techo" ? { x: ob.max.x, y: ob.base + 1.2, z: ob.max.z } : ob.max);
      else if (!plantas || ob.roto) return Infinity;
      else if (ob.tipo === "arbol") t = Math.min(cilindroRayo(o, d, ob.x, ob.z, ob.rt, ob.y0, ob.y0 + ob.alto + 1), esferaRayo(o, d, ob.x, ob.copaY, ob.z, ob.copaR));
      else if (ob.tipo === "roca") t = esferaRayo(o, d, ob.x, ob.y0 + ob.sy * 0.3, ob.z, ob.radio * 0.9);
      else if (ob.tipo === "auto") t = Math.min(esferaRayo(o, d, ob.puntos[0].x, ob.y0 + 0.9, ob.puntos[0].z, 1.15), esferaRayo(o, d, ob.puntos[1].x, ob.y0 + 0.9, ob.puntos[1].z, 1.15));
      if (t < mejorT) { mejorT = t; que = ob.tipo; ref = ob; }
      return t;
    });
    let t = mejorT;
    if (jugadores && P) for (const p of P.jugadores) {
      if (!p.vivo || p.id === ignorar || p.estado === "bus") continue;
      const al = altura(p), tt = cilindroRayo(o, d, p.x, p.z, RADIO_J, p.y, p.y + al);
      if (tt < t) { t = tt; que = "jugador"; ref = p; parte = o.y + d.y * tt - p.y > al - 0.32 ? "cabeza" : "cuerpo"; }
    }
    for (let s = 0.4; s < t; s += 1) {
      const x = o.x + d.x * s, y = o.y + d.y * s, z = o.z + d.z * s;
      if (y < terreno(x, z)) { let a = Math.max(0, s - 1), b = s; for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (o.y + d.y * m < terreno(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; } t = b; que = "suelo"; ref = null; parte = null; break; }
    }
    return { t, que, ref, parte, x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
  }
  const ojo = (p) => ({ x: p.x, y: p.y + altura(p) - 0.2, z: p.z });
  const pecho = (p) => ({ x: p.x, y: p.y + altura(p) * 0.7, z: p.z });
  const boca = (p) => ({ x: p.x - Math.sin(p.yaw) * 0.55 + Math.cos(p.yaw) * 0.12, y: p.y + altura(p) - 0.4, z: p.z - Math.cos(p.yaw) * 0.55 - Math.sin(p.yaw) * 0.12 });
  function lineaLibre(a, b) { const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l = Math.hypot(dx, dy, dz); return rayo(a, { x: dx / l, y: dy / l, z: dz / l }, l - 0.3, -1, false).t >= l - 0.35; }
  function desviar(d, k) {
    if (k <= 0) return d;
    let x, y, z; do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const r = { x: d.x + x * k, y: d.y + y * k, z: d.z + z * k }, l = Math.hypot(r.x, r.y, r.z); r.x /= l; r.y /= l; r.z /= l; return r;
  }

  // ════════════════════════════════════════════════════════════════════
  // Partida nueva
  // ════════════════════════════════════════════════════════════════════
  function nuevoJugador(id, bot, nombre, traje, malla) {
    return {
      id, bot, nombre, traje, malla, x: 0, y: 200, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.2, estado: "bus", enSuelo: false,
      vida: 100, escudo: 0, inv: [{ tipo: "pico" }, null, null, null, null, null], sel: 0, mun: { ligera: 0, mediana: 0, pesada: 0, cartuchos: 0 }, mats: { madera: 0, piedra: 0, metal: 0 }, mat: "madera",
      construyendo: false, pieza: "muro", cd: 0, recargando: 0, bloom: 0, ultimoTiro: 0, curando: null, golpe: 0, golpeHit: 0,
      agachado: false, corriendo: false, deslizando: 0, nadando: false, trepando: 0, cimaY: 0, vivo: true, muerte: 0, bajas: 0, dano: 0, tiros: 0, aciertos: 0,
      fase: 0, patada: 0, golpeado: 0, tormentaAcum: 0, apuntando: false, baila: false, pasoT: 0, saltoT: 0, puesto: 0,
      ia: { destino: null, saltoEn: 0, enemigo: null, visto: 0, vista: 0, t: 0, muro: 0, lado: Math.random() < 0.5 ? 1 : -1, punteria: 0.35 + Math.random() * 0.55, chequeo: 1, px: 0, pz: 0, desvio: 0, atacante: null, calma: 0, objetivo: null, picando: 0 },
      enMano: null,
    };
  }
  function limpiar() {
    if (!P) return;
    for (const s of P.estructuras) { grilla.quitar(s); G.escena.remove(s.malla); s.mat.dispose(); }
    for (const b of P.botin) G.escena.remove(b.malla);
    for (const c of P.cofres) G.escena.remove(c.malla.grupo);
    for (const p of P.jugadores) G.escena.remove(p.malla.raiz);
    for (const o of isla.arboles.concat(isla.rocas, isla.autos)) if (o.roto) { o.roto = false; grilla.insertar(o, o.x - (o.radio || 2.5), o.z - (o.radio || 2.5), o.x + (o.radio || 2.5), o.z + (o.radio || 2.5)); }
    for (const a of isla.arboles) a.vida = 250 * a.s; for (const r of isla.rocas) r.vida = 300 * r.s; for (const a of isla.autos) a.vida = 400;
    G.restaurarInstancias();
  }
  function nuevaPartida(opc) {
    limpiar();
    const r = azar((Math.random() * 1e9) | 0);
    // La ruta del autobús cruza la isla.
    const ang = r() * Math.PI * 2, ax = Math.cos(ang) * 330, az = Math.sin(ang) * 330, off = (r() - 0.5) * 120;
    const bus = { ax: -ax - Math.sin(ang) * off, az: -az + Math.cos(ang) * off, bx: ax - Math.sin(ang) * off, bz: az + Math.cos(ang) * off, y: 175, vel: 26, t: 0 };
    bus.dur = Math.hypot(bus.bx - bus.ax, bus.bz - bus.az) / bus.vel;
    const cant = 1 + clamp(opc.rivales, 1, 30), jugadores = [];
    const nombres = NOMBRES_BOTS.slice().sort(() => r() - 0.5);
    for (let i = 0; i < cant; i++) {
      const traje = i === 0 ? TRAJES[opc.traje] : Object.assign({}, TRAJES[(r() * TRAJES.length) | 0], { ropa: `hsl(${(r() * 360) | 0},65%,55%)`, pantalon: `hsl(${(r() * 360) | 0},30%,30%)` });
      const malla = crearPersonaje(traje); G.escena.add(malla.raiz); malla.raiz.visible = false;
      const p = nuevoJugador(i, i > 0, i === 0 ? opc.nombre || t("solo") : nombres[(i - 1) % nombres.length], traje, malla);
      p.enMano = () => enMano(p);
      if (p.bot) {
        // Cada bot elige un lugar (o un cofre suelto) y salta cuando el autobús pasa más cerca.
        const destino = r() < 0.75 ? isla.lugares[(r() * isla.lugares.length) | 0] : isla.cofres[(r() * isla.cofres.length) | 0];
        p.ia.destino = { x: destino.x + (r() - 0.5) * 30, z: destino.z + (r() - 0.5) * 30 };
        const dx = bus.bx - bus.ax, dz = bus.bz - bus.az, tt = clamp(((p.ia.destino.x - bus.ax) * dx + (p.ia.destino.z - bus.az) * dz) / (dx * dx + dz * dz), 0.08, 0.95);
        p.ia.saltoEn = tt * bus.dur - 4 + r() * 3;
      }
      jugadores.push(p);
    }
    const cofres = [];
    const nuevoCofre = (c, tipo) => { const malla = G.mallaCofre(c, tipo); return { ...c, tipo, abierto: false, abre: 0, malla }; };
    for (const c of isla.cofres) cofres.push(nuevoCofre(c, "cofre"));
    for (const c of isla.cajasMun) cofres.push(nuevoCofre(c, "municion"));
    P = {
      jugadores, cofres, botin: [], estructuras: [], proyectiles: [], feed: [], numeros: [], t: 0, fin: null, finAvisado: false, aviso: null, eliminacion: null, danoFlash: 0, danoId: 0, danoDir: null, sacudida: 0, lugar: null,
      bus, tormenta: { x: 0, z: 0, r: R0, fase: 0, estado: "espera", t: FASES_TORMENTA[0].espera, desde: null, hacia: null, sig: null }, marca: null, espectando: null, confeti: [], orbita: 0,
    };
    elegirSiguienteCirculo();
    // Botín del piso.
    for (const pt of isla.puntosBotin) { if (r() > 0.72) continue; const k = r(); if (k < 0.55) { const it = armaAlAzar(r, PROB_PISO); soltar(it, pt.x, pt.y, pt.z, 0); soltar({ tipo: "municion", m: ARMAS[it.arma].mun, cant: MUNICIONES[ARMAS[it.arma].mun].caja }, pt.x + 0.7, pt.y, pt.z + 0.3, 0); } else if (k < 0.8) soltar(consumibleAlAzar(r), pt.x, pt.y, pt.z, 0); else { const m = Object.keys(MUNICIONES)[(r() * 4) | 0]; soltar({ tipo: "municion", m, cant: MUNICIONES[m].caja }, pt.x, pt.y, pt.z, 0); } }
    M.P = P;
    return P;
  }
  function armaAlAzar(r, tabla) {
    const tipo = TIPOS_ARMA[elegir(r, [30, 26, 18, 18, 8])], A = ARMAS[tipo];
    let rar = elegir(r, tabla); rar = clamp(rar, A.rarezas[0], A.rarezas[A.rarezas.length - 1]);
    return { tipo: "arma", arma: tipo, rareza: rar, mun: A.cargador };
  }
  function consumibleAlAzar(r) { const c = ["vendas", "botiquin", "pocion", "miniescudo"][elegir(r, [30, 12, 22, 36])]; return { tipo: "consumible", c, cant: CONSUMIBLES[c].cant }; }
  function elegirSiguienteCirculo() {
    const T = P.tormenta, F = FASES_TORMENTA[T.fase]; if (!F) return;
    const nr = R0 * F.radio; let nx = T.x, nz = T.z;
    for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, m = Math.random() * Math.max(0, T.r - nr) * 0.75, x = T.x + Math.cos(a) * m, z = T.z + Math.sin(a) * m; if (costa(x, z) > Math.min(50, nr * 0.6)) { nx = x; nz = z; break; } }
    T.sig = { x: nx, z: nz, r: nr };
  }

  // ── botín en el piso ──
  function soltar(item, x, y, z, fuerza = 2.5) {
    const malla = mallaBotin(item);
    const a = Math.random() * Math.PI * 2;
    const b = { id: idBotin++, item, x, y: y + (fuerza ? 0.8 : 0), z, vx: Math.cos(a) * fuerza, vz: Math.sin(a) * fuerza, vy: fuerza ? 4 : 0, t: 0, malla };
    malla.position.set(x, b.y, z); G.escena.add(malla); P.botin.push(b); return b;
  }
  function quitarBotin(b) { G.escena.remove(b.malla); P.botin.splice(P.botin.indexOf(b), 1); }
  function abrirCofre(c, p) {
    c.abierto = true; c.malla.aura.visible = false;
    const r = Math.random;
    if (c.tipo === "cofre") {
      const it = armaAlAzar(r, PROB_COFRE); soltar(it, c.x, c.y, c.z);
      soltar({ tipo: "municion", m: ARMAS[it.arma].mun, cant: MUNICIONES[ARMAS[it.arma].mun].caja }, c.x, c.y, c.z);
      if (r() < 0.7) soltar(consumibleAlAzar(r), c.x, c.y, c.z); else { const m = Object.keys(MUNICIONES)[(r() * 4) | 0]; soltar({ tipo: "municion", m, cant: MUNICIONES[m].caja }, c.x, c.y, c.z); }
      soltar({ tipo: "material", mat: LISTA_MAT[(r() * 3) | 0], cant: 30 }, c.x, c.y, c.z);
    } else for (let k = 0; k < 2; k++) { const m = Object.keys(MUNICIONES)[(r() * 4) | 0]; soltar({ tipo: "municion", m, cant: MUNICIONES[m].caja }, c.x, c.y, c.z); }
    M.chispas(c.x, c.y + 0.8, c.z, 30, c.tipo === "cofre" ? [0xffd54a, 0xfff3b0, 0xffffff] : [0x7fe07f, 0xffffff], 4, 0.9, 5);
    if (!p.bot) Sonido.cofre();
  }
  const nombreItem = (it) => it.tipo === "arma" ? t(it.arma) : it.tipo === "consumible" ? t(it.c) : it.tipo === "municion" ? t(it.m) : t(it.mat);
  // Agarrar: municiones y materiales, directo; armas y curas, a un lugar libre (o cambiando por lo que tiene en la mano).
  function agarrar(p, b, forzar) {
    const it = b.item;
    if (it.tipo === "municion") { p.mun[it.m] = Math.min(MUNICIONES[it.m].tope, p.mun[it.m] + it.cant); quitarBotin(b); if (!p.bot) Sonido.recoger(); return true; }
    if (it.tipo === "material") { const antes = p.mats[it.mat]; p.mats[it.mat] = Math.min(TOPE_MAT, antes + it.cant); it.cant -= p.mats[it.mat] - antes; if (it.cant <= 0) quitarBotin(b); if (!p.bot) Sonido.recoger(); return true; }
    if (it.tipo === "consumible") { const igual = p.inv.find((s) => s && s.tipo === "consumible" && s.c === it.c && s.cant < CONSUMIBLES[it.c].pila); if (igual) { const n = Math.min(it.cant, CONSUMIBLES[it.c].pila - igual.cant); igual.cant += n; it.cant -= n; if (it.cant <= 0) { quitarBotin(b); if (!p.bot) Sonido.recoger(); return true; } } }
    const libre = p.inv.findIndex((s, i) => i > 0 && !s);
    if (libre > 0) { p.inv[libre] = it; quitarBotin(b); if (!p.bot) Sonido.recoger(); if (p.sel === 0 && it.tipo === "arma") p.sel = libre; return true; }
    if (!forzar) return false;
    const slot = p.sel > 0 ? p.sel : 1, viejo = p.inv[slot];
    p.inv[slot] = it; quitarBotin(b); p.sel = slot; p.recargando = 0; p.curando = null;
    if (viejo) soltar(viejo, p.x, p.y, p.z, 1.5);
    if (!p.bot) Sonido.recoger();
    return true;
  }

  // ════════════════════════════════════════════════════════════════════
  // Construcción
  // ════════════════════════════════════════════════════════════════════
  function dir4(yaw) { const fx = -Math.sin(yaw), fz = -Math.cos(yaw); return Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz)]; }
  // Alinea con lo ya construido cerca; si no hay nada, con el piso.
  function nivelPara(p, x, z) {
    let ancla = null; grilla.cerca(x - CELDA, z - CELDA, x + CELDA, z + CELDA, (o) => { if (o.tipo === "estructura" && ancla === null) ancla = o.base; });
    const g = sueloEn(x, z, p.y + 0.5, 0.8);
    if (ancla === null) return g + Math.max(0, Math.round((p.y - g) / ALTO)) * ALTO;
    let base = ancla + Math.round((p.y - ancla) / ALTO) * ALTO;
    while (base < g - ALTO * 0.7) base += ALTO;
    return base;
  }
  function calcularPieza(p, tipo) {
    const [dx, dz] = dir4(p.yaw), cx = Math.floor(p.x / CELDA), cz = Math.floor(p.z / CELDA), up = p.pitch;
    let s;
    if (tipo === "muro") {
      if (dx) { const ex = (cx + (dx > 0 ? 1 : 0)) * CELDA, mz = (cz + 0.5) * CELDA, base = nivelPara(p, ex, mz) + (up > 0.6 ? ALTO : 0); s = { eje: "x", x: ex, z: mz, base, min: { x: ex - 0.13, y: base, z: cz * CELDA }, max: { x: ex + 0.13, y: base + ALTO, z: (cz + 1) * CELDA } }; }
      else { const ez = (cz + (dz > 0 ? 1 : 0)) * CELDA, mx = (cx + 0.5) * CELDA, base = nivelPara(p, mx, ez) + (up > 0.6 ? ALTO : 0); s = { eje: "z", x: mx, z: ez, base, min: { x: cx * CELDA, y: base, z: ez - 0.13 }, max: { x: (cx + 1) * CELDA, y: base + ALTO, z: ez + 0.13 } }; }
    } else {
      const propia = tipo === "techo" || (tipo === "piso" && (up < -0.45 || up > 0.45));
      const nx = propia ? cx : cx + dx, nz = propia ? cz : cz + dz, mx = (nx + 0.5) * CELDA, mz = (nz + 0.5) * CELDA;
      let base = nivelPara(p, tipo === "escalera" ? mx - (dx * CELDA) / 2 : mx, tipo === "escalera" ? mz - (dz * CELDA) / 2 : mz);
      if (tipo === "techo" || (tipo === "piso" && up > 0.45)) base += ALTO;
      s = { cx: mx, cz: mz, dx, dz, base, min: { x: nx * CELDA, y: base, z: nz * CELDA }, max: { x: (nx + 1) * CELDA, y: base + (tipo === "piso" ? 0.25 : tipo === "techo" ? 1.8 : ALTO), z: (nz + 1) * CELDA } };
      if (tipo === "piso") s.max.y = base + 0.25;
    }
    s.tipo = "estructura"; s.tipo2 = tipo;
    s.clave = `${tipo}:${s.min.x.toFixed(1)},${s.min.z.toFixed(1)},${s.base.toFixed(1)}` + (tipo === "escalera" ? `,${dx},${dz}` : "") + (tipo === "muro" ? s.eje : "");
    let valida = !P.estructuras.some((o) => o.clave === s.clave);
    if (valida) grilla.cerca(s.min.x + 0.2, s.min.z + 0.2, s.max.x - 0.2, s.max.z - 0.2, (o) => { if (o.tipo === "caja" && o.edificio && s.min.x < o.max.x - 0.1 && s.max.x > o.min.x + 0.1 && s.min.z < o.max.z - 0.1 && s.max.z > o.min.z + 0.1 && s.base + 0.5 < o.max.y && s.max.y > o.min.y + 0.5) valida = false; });
    s.valida = valida && p.mats[p.mat] >= COSTO;
    return s;
  }
  function construir(p, tipo) {
    if (!p.vivo || p.estado !== "tierra" || p.nadando) return false;
    const s = calcularPieza(p, tipo); if (!s.valida) { if (!p.bot && p.mats[p.mat] < COSTO && !P.avisoMat) { avisar(t("sinMateriales"), 1.2); P.avisoMat = 1; } return false; }
    const MAT = MATERIALES[p.mat];
    s.mat = G.matPieza[p.mat].clone(); s.material = p.mat; s.vidaMax = MAT.vida; s.vida = MAT.vida * 0.1; s.crece = 0; s.tiempo = MAT.tiempo; s.dueno = p.id;
    s.mat.transparent = true; s.mat.opacity = 0.6; s.mat.emissive = new THREE.Color("#3a7fff"); s.mat.emissiveIntensity = 0.5;
    const m = new THREE.Mesh(G.geoPieza[tipo], s.mat); m.castShadow = m.receiveShadow = true;
    if (tipo === "muro") { m.position.set(s.x, s.base, s.z); if (s.eje === "x") m.rotation.y = Math.PI / 2; }
    else { m.position.set(s.cx, s.base, s.cz); if (tipo === "escalera") m.rotation.y = Math.atan2(-s.dx, -s.dz); }
    m.scale.y = 0.3; s.malla = m; G.escena.add(m);
    p.mats[p.mat] -= COSTO; P.estructuras.push(s); grilla.insertar(s, s.min.x, s.min.z, s.max.x, s.max.z);
    const d = Math.hypot(p.x - M.camara.position.x, p.z - M.camara.position.z); if (d < 60) Sonido.construir(p.mat, (1 - d / 60) * (p.bot ? 0.7 : 1));
    return true;
  }
  function quitarEstructura(s) {
    grilla.quitar(s); G.escena.remove(s.malla); s.mat.dispose(); P.estructuras.splice(P.estructuras.indexOf(s), 1);
    const col = { madera: [0xc98f55, 0x8a5a33], piedra: [0xb8b3a8, 0x77736a], metal: [0xc0cad4, 0x6e7a86] }[s.material];
    M.chispas((s.min.x + s.max.x) / 2, s.base + 1.5, (s.min.z + s.max.z) / 2, 30, col, 5, 0.8, 12); Sonido.pico(s.material);
  }
  function danarEstructura(s, dano) {
    s.vida -= dano; if (s.vida <= 0) { quitarEstructura(s); return; }
    if (s.crece >= 1) s.mat.color.setRGB(1, 1, 1).lerp(new THREE.Color("#5a4a3a"), clamp(1 - s.vida / s.vidaMax, 0, 1) * 0.7);
  }

  // ════════════════════════════════════════════════════════════════════
  // Armas, pico y curas
  // ════════════════════════════════════════════════════════════════════
  function disparar(p, dirObjetivo) {
    const it = p.inv[p.sel];
    if (!it || !p.vivo || p.estado !== "tierra" || p.nadando || p.trepando > 0 || p.cd > 0) return;
    if (it.tipo === "pico") { p.cd = 0.45; p.golpe = 0.45; p.golpeHit = 0.18; p.corriendo = false; return; }
    if (it.tipo === "consumible") { usarConsumible(p); return; }
    const A = ARMAS[it.arma], R = RAREZAS[it.rareza];
    if (p.recargando > 0) return;
    if (it.mun <= 0) { recargar(p); if (!p.bot && p.mun[A.mun] <= 0 && P.t - (P.avisoMun || 0) > 1.5) { avisar(t("sinMunicion"), 1); P.avisoMun = P.t; } return; }
    p.curando = null; p.corriendo = false;
    p.cd = (1 / A.cadencia) * (p.bot ? 1.45 : 1); it.mun--; p.tiros++; p.patada = 1;
    const quieto = Math.hypot(p.vx, p.vz) < 0.6, primero = P.t - p.ultimoTiro > 0.4 && p.apuntando && quieto && A.perdigones === 1;
    let disp = (p.apuntando ? A.dispMira : A.disp) * (quieto ? 1 : 1.5) * (p.enSuelo ? 1 : 2.2) * (p.agachado ? 0.7 : 1) + p.bloom;
    if (primero) disp = 0;
    if (p.bot) disp = disp * (1.6 - p.ia.punteria * 0.6) + 0.004;
    p.bloom = Math.min(p.bloom + A.abre, A.disp * 1.5); p.ultimoTiro = P.t;
    const b = boca(p);
    let dir = dirObjetivo;
    if (!dir) { const d = dirDe(p.yaw, p.pitch); dir = d; }
    let desde = b;
    if (p.malla.raiz.visible && p.malla.mano) { p.malla.mano.updateWorldMatrix(true, false); const v = new THREE.Vector3(0, 0.02, it.arma === "francotirador" ? -1.2 : it.arma === "pistola" ? -0.25 : -0.75); p.malla.mano.localToWorld(v); desde = { x: v.x, y: v.y, z: v.z }; }
    for (let k = 0; k < A.perdigones; k++) {
      const d = desviar(dir, disp);
      if (A.proyectil) { P.proyectiles.push({ x: b.x, y: b.y, z: b.z, vx: d.x * A.proyectil, vy: d.y * A.proyectil, vz: d.z * A.proyectil, dueno: p.id, it, vida: 3, dist: 0 }); continue; }
      const r = rayo(b, d, A.alcance, p.id);
      impacto(p, r, A, it.rareza, r.t);
      M.trazo(desde, r);
    }
    M.fogonazo(desde, A.perdigones > 1 || it.arma === "francotirador" ? 1.2 : 0.7);
    if (!p.bot) { Sonido.disparo(it.arma, 1, 0); P.sacudida = Math.max(P.sacudida, A.perdigones > 1 ? 6 : it.arma === "francotirador" ? 8 : 1.5); p.pitch = Math.min(1.3, p.pitch + A.retro * (0.6 + Math.random() * 0.6)); p.yaw += (Math.random() - 0.5) * A.retro * 0.6; M.luzBoca(desde); }
    else M.sonidoLejos(p, (v, pan) => Sonido.disparo(it.arma, v, pan));
    if (it.mun === 0) recargar(p);
  }
  function danoArma(A, rareza, dist, cabeza) {
    const caida = dist <= A.cae ? 1 : Math.max(0.45, 1 - ((dist - A.cae) / A.cae) * 0.55);
    return A.dano * RAREZAS[rareza].k * (cabeza ? A.cabeza : 1) * caida;
  }
  function impacto(p, r, A, rareza, dist) {
    if (r.que === "jugador") { const cab = r.parte === "cabeza"; p.aciertos += 1 / A.perdigones; herir(r.ref, danoArma(A, rareza, dist, cab), p, cab, "bala"); M.chispas(r.x, r.y, r.z, 6, [0xffffff, 0x9fe6ff], 3, 0.3, 6); }
    else if (r.que === "estructura") { danarEstructura(r.ref, A.dano * RAREZAS[rareza].k * (A.perdigones > 1 ? 1 : 1)); M.chispas(r.x, r.y, r.z, 6, [0xc98f55, 0x8a5a33], 4, 0.5, 12); }
    else if (r.que === "arbol") { M.chispas(r.x, r.y, r.z, 6, [0x6fbf45, 0x8a5a33], 3, 0.6, 8); }
    else if (r.que === "roca" || r.que === "auto") M.chispas(r.x, r.y, r.z, 6, [0xcfd2cc, 0xfff3b0], 5, 0.35, 10);
    else if (r.que === "caja" || r.que === "tejado") M.chispas(r.x, r.y, r.z, 5, [0xf3e6c8, 0x999999], 4, 0.4, 10);
    else if (r.que === "suelo") M.chispas(r.x, r.y + 0.05, r.z, 6, [0xb8925c, 0x7a6a4a], 3, 0.5, 9);
  }
  function golpeDePico(p) {
    const o = ojo(p), d = p.bot ? dirDe(p.yaw, p.pitch) : M.dirCamara();
    const r = rayo(o, d, 2.8, p.id);
    if (!r.que) return;
    if (r.que === "jugador") { herir(r.ref, 20, p, false, "pico"); return; }
    if (r.que === "estructura") { danarEstructura(r.ref, 50); if (!p.bot) Sonido.pico(r.ref.material); return; }
    const ob = r.ref, mat = r.que === "arbol" ? "madera" : r.que === "roca" ? "piedra" : r.que === "auto" ? "metal" : null;
    if (!mat || !ob) { if (!p.bot) Sonido.pico(r.que === "caja" ? "piedra" : null); M.chispas(r.x, r.y, r.z, 5, [0xcccccc], 3, 0.3, 8); return; }
    const gana = mat === "madera" ? 10 : mat === "piedra" ? 8 : 12;
    p.mats[mat] = Math.min(TOPE_MAT, p.mats[mat] + gana); ob.vida -= 50; G.sacudir(ob);
    M.chispas(r.x, r.y, r.z, 10, mat === "madera" ? [0xc98f55, 0x6fbf45] : mat === "piedra" ? [0xb8b3a8, 0x77736a] : [0xc0cad4, 0xfff3b0], 4, 0.5, 10);
    if (!p.bot) { Sonido.pico(mat); P.numeros.push({ x: r.x, y: r.y + 0.5, z: r.z, texto: "+" + gana, color: MATERIALES[mat].color, t: 0.8, dx: 0 }); }
    if (ob.vida <= 0) { ob.roto = true; grilla.quitar(ob); G.quitarInstancia(ob); p.mats[mat] = Math.min(TOPE_MAT, p.mats[mat] + 15); M.chispas(ob.x, (ob.y0 || 0) + 2, ob.z, 40, mat === "madera" ? [0x6fbf45, 0x8a5a33] : [0xb8b3a8, 0xc0cad4], 6, 1, 10); }
  }
  function recargar(p) {
    const it = p.inv[p.sel]; if (!it || it.tipo !== "arma") return;
    const A = ARMAS[it.arma];
    if (p.recargando > 0 || it.mun >= A.cargador || p.mun[A.mun] <= 0) return;
    p.recargando = A.recarga * RAREZAS[it.rareza].recarga; p.corriendo = false; if (!p.bot) Sonido.recarga();
  }
  function usarConsumible(p) {
    const it = p.inv[p.sel]; if (!it || it.tipo !== "consumible" || p.curando) return;
    const C = CONSUMIBLES[it.c];
    if ((C.vida && p.vida >= C.tope) || (C.escudo && p.escudo >= C.tope)) { if (!p.bot && P.t - (P.avisoLleno || 0) > 1.5) { avisar(t("llena"), 1); P.avisoLleno = P.t; } return; }
    p.curando = { slot: p.sel, t: C.tiempo, total: C.tiempo, c: it.c }; p.corriendo = false;
  }
  function terminarCura(p) {
    const it = p.inv[p.curando.slot], C = CONSUMIBLES[p.curando.c]; p.curando = null;
    if (!it || it.tipo !== "consumible") return;
    if (C.vida) p.vida = Math.max(p.vida, Math.min(C.tope, p.vida + C.vida));
    if (C.escudo) p.escudo = Math.max(p.escudo, Math.min(C.tope, p.escudo + C.escudo));
    it.cant--; if (it.cant <= 0) p.inv[p.inv.indexOf(it)] = null;
    if (!p.bot) Sonido.cura();
  }

  // ════════════════════════════════════════════════════════════════════
  // Daño y bajas
  // ════════════════════════════════════════════════════════════════════
  function herir(v, dano, atacante, cabeza, tipo) {
    if (!v.vivo || (P.fin && P.fin.gano) || v.estado === "bus") return;
    const ignora = tipo === "tormenta" || tipo === "caida";
    const escudoAntes = v.escudo, aEscudo = ignora ? 0 : Math.min(v.escudo, dano); v.escudo -= aEscudo;
    const aVida = Math.min(v.vida, dano - aEscudo); v.vida -= aVida; v.golpeado = 0.6; v.curando = null;
    if (atacante) { v.ia.atacante = atacante.id; atacante.dano += aEscudo + aVida; }
    if (atacante && !atacante.bot) {
      P.numeros.push({ x: v.x, y: v.y + 2.1, z: v.z, texto: String(Math.round(dano)), color: cabeza ? "#ffd84a" : aEscudo > 0 ? "#8fd8ff" : "#ffffff", t: 0.9, dx: (Math.random() - 0.5) * 30, grande: cabeza });
      M.marcarAcierto(cabeza); Sonido.acierto(aEscudo > 0, cabeza); if (escudoAntes > 0 && v.escudo <= 0) Sonido.escudoRoto();
    }
    if (!v.bot) { P.danoFlash = 0.5; P.danoId++; Sonido.golpe(); if (atacante) P.danoDir = { x: atacante.x, z: atacante.z, t: 1.2 }; }
    if (v.vida <= 0) morir(v, atacante, tipo);
  }
  function morir(v, atacante, tipo) {
    v.vivo = false; v.muerte = 0; v.vx = v.vz = 0; v.curando = null; v.construyendo = false;
    v.puesto = P.jugadores.filter((q) => q.vivo).length + 1;
    const quien = atacante ? atacante.nombre : tipo === "caida" ? t("caida") : t("laTormenta");
    P.feed.push({ a: quien, b: v.nombre, yo: !v.bot || (atacante && !atacante.bot), t: 6, id: Math.random() }); if (P.feed.length > 5) P.feed.shift();
    if (atacante) atacante.bajas++;
    if (atacante && !atacante.bot) { Sonido.eliminado(); P.eliminacion = { texto: t("eliminaste", { n: v.nombre }), t: 2.5 }; }
    if (!v.bot) P.asesino = quien;
    // Todo lo que llevaba queda tirado alrededor.
    for (let i = 1; i < v.inv.length; i++) if (v.inv[i]) soltar(v.inv[i], v.x, v.y, v.z, 2.5);
    for (const m in v.mun) if (v.mun[m] > 0) soltar({ tipo: "municion", m, cant: v.mun[m] }, v.x, v.y, v.z, 2.5);
    for (const m in v.mats) if (v.mats[m] > 0) soltar({ tipo: "material", mat: m, cant: v.mats[m] }, v.x, v.y, v.z, 2.5);
    v.inv = [{ tipo: "pico" }, null, null, null, null, null];
  }
  function avisar(texto, tt = 1.8) { P.aviso = { texto, t: tt }; }

  // ════════════════════════════════════════════════════════════════════
  // Movimiento
  // ════════════════════════════════════════════════════════════════════
  function mover(p, c, dt) {
    if (p.estado === "bus") return;
    if (alAire(p)) {
      const s = sueloEn(p.x, p.z, p.y), alt = p.y - s, picada = clamp(-p.pitch - 0.2, 0, 1);
      if (p.estado === "cae") {
        const vh = lerp(20, 12, picada), vy = lerp(-20, -40, picada);
        p.vx = lerp(p.vx, c.wx * vh, Math.min(1, dt * 1.5)); p.vz = lerp(p.vz, c.wz * vh, Math.min(1, dt * 1.5)); p.vy = lerp(p.vy, vy, Math.min(1, dt * 1.2));
        if (alt < 42 || (c.abrir && alt < 120)) { p.estado = "planea"; if (!p.bot) Sonido.salto(); }
      } else {
        const vh = 14, vy = lerp(-6, -12, picada);
        p.vx = lerp(p.vx, c.wx * vh, Math.min(1, dt * 1.8)); p.vz = lerp(p.vz, c.wz * vh, Math.min(1, dt * 1.8)); p.vy = lerp(p.vy, vy, Math.min(1, dt * 3));
      }
      p.x = clamp(p.x + p.vx * dt, -300, 300); p.z = clamp(p.z + p.vz * dt, -300, 300); p.y += p.vy * dt;
      empujarFuera(p);
      if (p.y <= s + 0.05) { p.y = s; p.vy = 0; p.estado = "tierra"; p.enSuelo = true; p.cimaY = p.y; if (!p.bot) { Sonido.caida(); P.sacudida = 4; } }
      return;
    }
    // En el agua honda se nada: sin armas, más lento, flotando.
    const hondo = terreno(p.x, p.z) < NIVEL_AGUA - 0.2 && sueloEn(p.x, p.z, p.y, 0.6) <= NIVEL_AGUA - 0.19;
    if (hondo !== p.nadando) { p.nadando = hondo; if (hondo) { p.agachado = false; p.construyendo = false; p.curando = null; } }
    // Trepar: se completa solo.
    if (p.trepando > 0) {
      p.trepando -= dt; const k = 1 - Math.max(0, p.trepando) / 0.35;
      p.x = lerp(p.trepa.x0, p.trepa.x, k); p.z = lerp(p.trepa.z0, p.trepa.z, k); p.y = lerp(p.trepa.y0, p.trepa.y, Math.min(1, k * 1.4));
      if (p.trepando <= 0) { p.y = p.trepa.y; p.enSuelo = true; p.vy = 0; p.cimaY = p.y; }
      return;
    }
    if (c.agachar) { if (p.corriendo && p.enSuelo && !p.deslizando) { p.deslizando = 1.1; p.agachado = true; p.velDesliz = Math.max(VEL_CORRER + 1.8, Math.hypot(p.vx, p.vz) + 1.5); } else p.agachado = !p.agachado; }
    const mueve = Math.hypot(c.wx, c.wz) > 0.1;
    p.corriendo = !!c.corre && mueve && !p.apuntando && !p.agachado && !p.curando && p.recargando <= 0 && !p.nadando && !p.construyendo;
    if (p.corriendo && p.agachado) p.agachado = false;
    const agua = terreno(p.x, p.z) < -0.3 && !p.nadando ? 0.7 : 1;
    let v = p.nadando ? VEL_NADO : p.corriendo ? VEL_CORRER : p.agachado ? VEL_AGACHADO : VEL;
    if (p.apuntando && !p.corriendo) v = Math.min(v, VEL_MIRA); if (p.curando) v *= 0.75; v *= agua;
    let tx = c.wx * v, tz = c.wz * v;
    if (p.deslizando > 0) {
      // Deslizarse: conserva la velocidad, frena de a poco; en bajada acelera.
      const pend = (terreno(p.x + p.vx * 0.1, p.z + p.vz * 0.1) - terreno(p.x, p.z)) / (Math.hypot(p.vx, p.vz) * 0.1 || 1);
      p.velDesliz = clamp(p.velDesliz - (pend < -0.15 ? -6 : 5) * dt, 0, 13);
      if (pend >= -0.15) p.deslizando -= dt;
      const l = Math.hypot(p.vx, p.vz) || 1; tx = (p.vx / l) * p.velDesliz; tz = (p.vz / l) * p.velDesliz;
      if (p.deslizando <= 0 || p.velDesliz < VEL_AGACHADO) { p.deslizando = 0; }
    }
    const k = Math.min(1, dt * (p.enSuelo ? (p.deslizando > 0 ? 3 : 12) : 2.5));
    p.vx = lerp(p.vx, tx, k); p.vz = lerp(p.vz, tz, k);
    if (p.nadando) { p.vy = 0; p.y = lerp(p.y, NIVEL_AGUA, Math.min(1, dt * 5)); }
    else {
      p.vy -= GRAVEDAD * dt;
      if (c.saltar && p.enSuelo && !p.curando) {
        // ¿Hay un borde adelante para trepar?
        if (!intentarTrepar(p)) { p.vy = SALTO * (p.corriendo ? 1.06 : 1); p.enSuelo = false; p.agachado = false; p.deslizando = 0; if (!p.bot) Sonido.salto(); }
      } else if (c.saltar && !p.enSuelo && p.vy < 3) intentarTrepar(p);
    }
    p.x = clamp(p.x + p.vx * dt, -300, 300); p.z = clamp(p.z + p.vz * dt, -300, 300);
    if (costa(p.x, p.z) < -40) { p.x -= p.vx * dt; p.z -= p.vz * dt; }
    if (!p.nadando) p.y += p.vy * dt;
    empujarFuera(p);
    const s = sueloEn(p.x, p.z, p.y);
    const antes = p.enSuelo;
    if (p.nadando) { p.enSuelo = false; if (s > NIVEL_AGUA) { p.y = s; p.nadando = false; } }
    else if (p.y <= s) { p.y = s; p.vy = 0; p.enSuelo = true; }
    else if (p.enSuelo && p.vy <= 0 && p.y - s < 0.55) { p.y = s; p.vy = 0; }
    else p.enSuelo = false;
    // Caídas largas duelen.
    if (!p.enSuelo) p.cimaY = Math.max(p.cimaY, p.y);
    else { if (!antes && p.cimaY - p.y > CAIDA_SEGURA && !p.nadando) { herir(p, (p.cimaY - p.y - CAIDA_SEGURA) * 10, null, false, "caida"); if (!p.bot) Sonido.caida(); } p.cimaY = p.y; }
    if (p.nadando) p.cimaY = p.y;
    const vel = Math.hypot(p.vx, p.vz);
    if ((p.enSuelo || p.nadando) && vel > 1.5 && !p.agachado) { p.pasoT -= dt * vel; if (p.pasoT <= 0) { p.pasoT = p.corriendo ? 2.4 : 2.1; M.sonidoLejos(p, (vv, pan) => Sonido.paso(p.bot ? vv * 0.9 : 0.45, pan, p.nadando || agua < 1), 32); } }
  }
  function intentarTrepar(p) {
    const f = dirDe(p.yaw, 0), px = p.x + f.x * 0.75, pz = p.z + f.z * 0.75;
    const tope = sueloEn(px, pz, p.y, 2.7), sube = tope - p.y;
    if (sube < 0.9 || sube > 2.7) return false;
    // Lugar libre arriba: nada que tape a la altura del cuerpo.
    let libre = true; grilla.cerca(px - 0.4, pz - 0.4, px + 0.4, pz + 0.4, (o) => { if ((o.tipo === "caja" || (o.tipo === "estructura" && o.tipo2 === "muro")) && px > o.min.x - 0.3 && px < o.max.x + 0.3 && pz > o.min.z - 0.3 && pz < o.max.z + 0.3 && o.min.y < tope + 1.6 && o.max.y > tope + 0.2) libre = false; });
    if (!libre) return false;
    p.trepando = 0.35; p.trepa = { x0: p.x, z0: p.z, y0: p.y, x: px + f.x * 0.3, z: pz + f.z * 0.3, y: tope }; p.vy = 0; p.vx *= 0.3; p.vz *= 0.3; p.agachado = false; p.deslizando = 0;
    if (!p.bot) Sonido.salto();
    return true;
  }

  // ════════════════════════════════════════════════════════════════════
  // Bots
  // ════════════════════════════════════════════════════════════════════
  const edificioDe = (x, z) => isla.edificios.find((e) => x > e.min.x + 0.2 && x < e.max.x - 0.2 && z > e.min.z + 0.2 && z < e.max.z - 0.2);
  function puerta(e, afuera) {
    const d = afuera ? 2.6 : -1.4, f = e.frente;
    return f === "x+" ? { x: e.x + e.w / 2 + d, z: e.z } : f === "x-" ? { x: e.x - e.w / 2 - d, z: e.z } : f === "z+" ? { x: e.x, z: e.z + e.d / 2 + d } : { x: e.x, z: e.z - e.d / 2 - d };
  }
  // Para llegar a algo dentro de una casa hay que entrar por la puerta (y salir por ella).
  function puntoDePaso(b, tx, tz) {
    const eb = edificioDe(b.x, b.z), et = edificioDe(tx, tz);
    if (eb === et) return { x: tx, z: tz };
    if (eb) { const pi = puerta(eb, false), pa = puerta(eb, true); return Math.hypot(b.x - pi.x, b.z - pi.z) < 1.2 ? pa : pi; }
    const pa = puerta(et, true); return Math.hypot(b.x - pa.x, b.z - pa.z) < 1.5 ? puerta(et, false) : pa;
  }
  const puntajeArma = (it) => (it && it.tipo === "arma" ? 10 + it.rareza * 3 + { escopeta: 4, rifle: 4, subfusil: 3, francotirador: 2, pistola: 1 }[it.arma] : 0);
  function mejorArma(b, d) {
    let mejor = -1, idx = -1;
    b.inv.forEach((it, i) => {
      if (!it || it.tipo !== "arma") return; const A = ARMAS[it.arma]; if (it.mun <= 0 && b.mun[A.mun] <= 0) return;
      let s = it.rareza;
      if (it.arma === "escopeta") s += d < 10 ? 10 : d < 18 ? 3 : -5; else if (it.arma === "subfusil") s += d < 25 ? 7 : 1; else if (it.arma === "rifle") s += d < 90 ? 6 : 3; else if (it.arma === "francotirador") s += d > 60 ? 9 : -4; else s += 2;
      if (s > mejor) { mejor = s; idx = i; }
    });
    return idx;
  }
  function pensarBot(b, dt) {
    const ia = b.ia, T = P.tormenta;
    ia.t -= dt; ia.muro -= dt; ia.vista -= dt; ia.calma += dt; ia.picando -= dt;
    const c = { wx: 0, wz: 0 };
    if (b.estado === "bus") { if (P.bus.t >= ia.saltoEn) c.saltarBus = true; return c; }
    if (alAire(b)) {
      const dx = ia.destino.x - b.x, dz = ia.destino.z - b.z, d = Math.hypot(dx, dz);
      if (d > 2) b.yaw += angDif(Math.atan2(-dx, -dz) - b.yaw) * Math.min(1, dt * 3);
      b.pitch = d > 60 ? -0.2 : -1.0; // cerca del lugar, en picada
      if (d > 3) { c.wx = dx / d; c.wz = dz / d; } c.abrir = false; return c;
    }
    // Ver: el más cercano a menos de 90 m con línea libre (solo algunos por vez, para no gastar).
    if (ia.vista <= 0) {
      ia.vista = 0.3;
      let mejor = null, dm = 90;
      const cand = P.jugadores.filter((o) => o !== b && o.vivo && o.estado === "tierra").map((o) => [o, dist2(b, o)]).filter((q) => q[1] < 90).sort((a, b2) => a[1] - b2[1]).slice(0, 3);
      for (const [o, d] of cand) if (d < dm && lineaLibre(ojo(b), pecho(o))) { dm = d; mejor = o; }
      if (!mejor && ia.atacante !== null) { const a = P.jugadores[ia.atacante]; if (a && a.vivo && dist2(b, a) < 130) mejor = a; }
      ia.enemigo = mejor; if (mejor) ia.calma = 0;
    }
    let enemigo = ia.enemigo; if (enemigo && !enemigo.vivo) enemigo = ia.enemigo = null;
    ia.visto = enemigo ? ia.visto + dt : 0;
    const armada = b.inv.some((it) => it && it.tipo === "arma" && (it.mun > 0 || b.mun[ARMAS[it.arma].mun] > 0));
    const zona = T.estado === "cierra" && T.hacia ? T.hacia : T.sig || T;
    const fuera = Math.hypot(b.x - zona.x, b.z - zona.z) > zona.r - 6 && (T.estado === "cierra" || Math.hypot(b.x - T.x, b.z - T.z) > T.r - 10 || T.t < 25);
    let ir = null;
    b.apuntando = false;
    if (enemigo && armada && !(fuera && Math.hypot(b.x - T.x, b.z - T.z) > T.r)) {
      const dx = enemigo.x - b.x, dz = enemigo.z - b.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
      const idx = mejorArma(b, d); if (idx > 0 && idx !== b.sel && b.recargando <= 0) { b.sel = idx; b.cd = Math.max(b.cd, 0.3); }
      const it = b.inv[b.sel], tipo = it && it.arma;
      const ideal = tipo === "escopeta" ? 6 : tipo === "subfusil" ? 14 : tipo === "francotirador" ? 70 : 26, acerca = d > ideal + 6 ? 1 : d < ideal - 5 ? -1 : 0;
      if (ia.t <= 0) { ia.t = 0.9 + Math.random() * 1.4; ia.lado *= -1; if (Math.random() < 0.3) c.saltar = true; b.agachado = Math.random() < 0.2 && tipo !== "escopeta"; }
      c.wx = ux * acerca - uz * ia.lado * 0.75; c.wz = uz * acerca + ux * ia.lado * 0.75;
      const m = boca(b), al = altura(enemigo), ox = enemigo.x - m.x, oy = enemigo.y + al * (0.62 + ia.punteria * 0.2) - m.y, oz = enemigo.z - m.z;
      const yawObj = Math.atan2(-ox, -oz), pitchObj = Math.atan2(oy, Math.hypot(ox, oz)), tiembla = Math.sin(P.t * 2.3 + b.id * 1.7) * 0.035 * (1.6 - ia.punteria);
      b.yaw += angDif(yawObj + tiembla - b.yaw) * Math.min(1, dt * 6); b.pitch += (pitchObj + (tipo === "francotirador" ? d * 0.0004 : 0) - b.pitch) * Math.min(1, dt * 6);
      b.apuntando = d > 20;
      // Tardan un poco en reaccionar cuando te ven: si no, no hay cómo ganarles.
      if (it && it.tipo === "arma" && Math.abs(angDif(yawObj - b.yaw)) < 0.1 && ia.visto > 0.65 && d < ARMAS[tipo].alcance * 0.85) disparar(b);
      if (b.golpeado > 0 && ia.muro <= 0 && b.mats[b.mat] >= COSTO * 2 && b.vida + b.escudo < 150 && d > 6) {
        const y0 = b.yaw; b.yaw = yawObj; const p0 = b.pitch; b.pitch = 0; construir(b, "muro"); if (Math.random() < 0.6) construir(b, "escalera"); b.yaw = y0; b.pitch = p0; ia.muro = 2.2 + Math.random() * 2;
      }
    } else {
      b.agachado = false;
      if (fuera) ir = zona;
      else if (ia.calma > 2.5 && b.curando == null && (b.vida < 75 || b.escudo < 50)) {
        const i = b.inv.findIndex((it) => it && it.tipo === "consumible" && ((CONSUMIBLES[it.c].vida && b.vida < CONSUMIBLES[it.c].tope) || (CONSUMIBLES[it.c].escudo && b.escudo < CONSUMIBLES[it.c].tope)));
        if (i > 0) { b.sel = i; usarConsumible(b); }
      }
      if (!ir && !b.curando) {
        // Botín: cofre cerrado o algo que le sirva, lo más cerca posible.
        let obj = ia.objetivo;
        if (!obj || obj.abierto || (obj.item && !P.botin.includes(obj)) || Math.random() < 0.01) {
          obj = null; let dm = 70;
          for (const cf of P.cofres) { if (cf.abierto) continue; const d = dist2(b, cf); if (d < dm) { dm = d; obj = cf; } }
          for (const bt of P.botin) { const d = dist2(b, bt) + 4; if (d >= dm) continue; const it = bt.item; if ((it.tipo === "arma" && (b.inv.some((s, i) => i > 0 && !s) || puntajeArma(it) > Math.min(...b.inv.slice(1).map(puntajeArma)))) || it.tipo === "consumible" || it.tipo === "municion" || it.tipo === "material") { dm = d; obj = bt; } }
          ia.objetivo = obj;
        }
        if (obj) ir = obj;
        else if (b.mats.madera < 60 && ia.picando <= 0) {
          let arb = null, da = 25; grilla.cerca(b.x - 25, b.z - 25, b.x + 25, b.z + 25, (o) => { if (o.tipo === "arbol" && !o.roto) { const d = dist2(b, o); if (d < da) { da = d; arb = o; } } });
          if (arb) { if (da < 2.3) { b.sel = 0; b.yaw = Math.atan2(-(arb.x - b.x), -(arb.z - b.z)); b.pitch = 0; disparar(b); if (b.mats.madera >= 100) ia.picando = 20; } else ir = arb; }
          else ia.picando = 10;
        } else ir = { x: zona.x + Math.cos(b.id * 2.1 + P.t * 0.02) * zona.r * 0.35, z: zona.z + Math.sin(b.id * 2.1 + P.t * 0.02) * zona.r * 0.35 };
      }
      if (ir) {
        const pp = puntoDePaso(b, ir.x, ir.z), dx = pp.x - b.x, dz = pp.z - b.z, d = Math.hypot(dx, dz);
        if (d > 0.8) { c.wx = dx / d; c.wz = dz / d; }
        if (c.wx || c.wz) b.yaw += angDif(Math.atan2(-c.wx, -c.wz) - b.yaw) * Math.min(1, dt * 6);
        b.pitch *= 0.9;
        c.corre = d > 12 && !b.curando;
        if (ir.tipo && !ir.abierto && ir.malla && ir.malla.grupo && dist2(b, ir) < 1.9) { abrirCofre(ir, b); ia.objetivo = null; }
      }
      // Tener el mejor arma en la mano mientras camina.
      if (!b.curando && b.recargando <= 0 && ia.picando > -1) { const idx = mejorArma(b, 30); if (idx > 0 && ia.picando <= 0 && !(b.sel === 0 && b.golpe > 0)) b.sel = idx; }
    }
    // Esquivar lo que tiene adelante y destrabarse.
    grilla.cerca(b.x - 3, b.z - 3, b.x + 3, b.z + 3, (o) => {
      if (o.roto) return; let cx, cz, rr;
      if (o.tipo === "arbol") { cx = o.x; cz = o.z; rr = o.rt + 1.6; } else if (o.tipo === "roca") { cx = o.x; cz = o.z; rr = o.radio + 1.5; } else if (o.tipo === "auto") { cx = o.x; cz = o.z; rr = 2.8; } else return;
      const dx = b.x - cx, dz = b.z - cz, d = Math.hypot(dx, dz); if (d < rr && d > 1e-3) { c.wx += (dx / d) * (1 - d / rr) * 1.3; c.wz += (dz / d) * (1 - d / rr) * 1.3; }
    });
    ia.chequeo -= dt;
    if (ia.chequeo <= 0) { ia.chequeo = 1.1; if ((c.wx || c.wz) && Math.hypot(b.x - ia.px, b.z - ia.pz) < 0.8) { c.saltar = true; ia.lado *= -1; ia.desvio = 1.2; } ia.px = b.x; ia.pz = b.z; }
    if (ia.desvio > 0) { ia.desvio -= dt; const tt = c.wx; c.wx = -c.wz * ia.lado; c.wz = tt * ia.lado; }
    const l = Math.hypot(c.wx, c.wz); if (l > 1) { c.wx /= l; c.wz /= l; }
    const it = b.inv[b.sel]; if (it && it.tipo === "arma" && it.mun === 0) recargar(b);
    return c;
  }

  // ════════════════════════════════════════════════════════════════════
  // El paso de la simulación
  // ════════════════════════════════════════════════════════════════════
  function saltarDelBus(p) {
    const B = P.bus, k = clamp(B.t / B.dur, 0, 1);
    p.estado = "cae"; p.x = lerp(B.ax, B.bx, k) + (Math.random() - 0.5) * 2; p.z = lerp(B.az, B.bz, k) + (Math.random() - 0.5) * 2; p.y = B.y - 2;
    p.vx = ((B.bx - B.ax) / B.dur) * 0.4; p.vz = ((B.bz - B.az) / B.dur) * 0.4; p.vy = -5;
    if (!p.bot) { Sonido.salto(); p.pitch = -0.6; }
  }
  function paso(dt, control) {
    P.t += dt;
    const T = P.tormenta, yo = P.jugadores[0], B = P.bus;
    // El autobús.
    if (B.t < B.dur + 30) B.t += dt;
    if (!P.fin) {
      T.t -= dt;
      if (T.estado === "espera" && T.t <= 0 && FASES_TORMENTA[T.fase]) { T.estado = "cierra"; T.desde = { x: T.x, z: T.z, r: T.r }; T.hacia = T.sig; T.t = FASES_TORMENTA[T.fase].cierre; avisar(t("tormentaCierra"), 2.2); }
      else if (T.estado === "cierra") {
        const k = 1 - Math.max(0, T.t) / FASES_TORMENTA[T.fase].cierre;
        T.x = lerp(T.desde.x, T.hacia.x, k); T.z = lerp(T.desde.z, T.hacia.z, k); T.r = lerp(T.desde.r, T.hacia.r, k);
        if (T.t <= 0) { T.fase++; if (FASES_TORMENTA[T.fase]) { T.estado = "espera"; T.t = FASES_TORMENTA[T.fase].espera; elegirSiguienteCirculo(); avisar(t("ojoTormenta"), 2); } else { T.estado = "fin"; T.t = 0; } }
      }
    }
    const danoT = (FASES_TORMENTA[Math.min(T.fase, FASES_TORMENTA.length - 1)] || { dano: 10 }).dano;
    for (const p of P.jugadores) {
      p.cd = Math.max(0, p.cd - dt); p.golpeado = Math.max(0, p.golpeado - dt); p.patada = Math.max(0, p.patada - dt * 6); p.bloom = Math.max(0, p.bloom - dt * 0.12); p.golpe = Math.max(0, p.golpe - dt);
      if (p.golpeHit > 0 && (p.golpeHit -= dt) <= 0) golpeDePico(p);
      if (p.recargando > 0) { p.recargando -= dt; const it = p.inv[p.sel]; if (!it || it.tipo !== "arma") p.recargando = 0; else if (p.recargando <= 0) { const A = ARMAS[it.arma], n = Math.min(A.cargador - it.mun, p.mun[A.mun]); it.mun += n; p.mun[A.mun] -= n; } }
      if (p.curando) { if (p.sel !== p.curando.slot) p.curando = null; else if ((p.curando.t -= dt) <= 0) terminarCura(p); }
      if (!p.vivo) { p.muerte += dt; continue; }
      if (p.estado === "bus") { const k = clamp(B.t / B.dur, 0, 1); p.x = lerp(B.ax, B.bx, k); p.z = lerp(B.az, B.bz, k); p.y = B.y; }
      const c = p.bot ? pensarBot(p, dt) : control(p, dt);
      if (p.estado === "bus" && (c.saltarBus || B.t >= B.dur) && B.t > 2) saltarDelBus(p);
      mover(p, c, dt);
      if (p.estado === "tierra" && !p.bot && P.avisoMat) P.avisoMat = Math.max(0, P.avisoMat - dt);
      if (Math.hypot(p.x - T.x, p.z - T.z) > T.r && p.estado === "tierra") { p.tormentaAcum += dt; if (p.tormentaAcum >= 1) { p.tormentaAcum -= 1; herir(p, danoT, null, false, "tormenta"); } } else p.tormentaAcum = 0;
      if (p.vivo && p.estado === "tierra") {
        // Lo que se agarra solo: municiones, materiales y, si hay lugar, armas y curas.
        for (let i = P.botin.length - 1; i >= 0; i--) { const b = P.botin[i]; if (b.t < 0.6) continue; if (Math.abs(b.x - p.x) < 1.3 && Math.abs(b.z - p.z) < 1.3 && Math.abs(b.y - p.y) < 1.8) agarrar(p, b, p.bot && puntajeArma(b.item) > Math.min(...p.inv.slice(1).map(puntajeArma)) + 2); }
      }
    }
    // Balas que viajan (francotirador): caen con la distancia.
    for (let i = P.proyectiles.length - 1; i >= 0; i--) {
      const q = P.proyectiles[i], A = ARMAS[q.it.arma]; q.vida -= dt; q.vy -= A.gravedad * dt;
      const v = Math.hypot(q.vx, q.vy, q.vz), paso2 = v * dt, d = { x: q.vx / v, y: q.vy / v, z: q.vz / v };
      const r = rayo(q, d, paso2, q.dueno);
      if (r.que || q.vida <= 0) { const dueno = P.jugadores[q.dueno]; if (r.que) impacto(dueno, r, A, q.it.rareza, q.dist + r.t); P.proyectiles.splice(i, 1); continue; }
      q.x += d.x * paso2; q.y += d.y * paso2; q.z += d.z * paso2; q.dist += paso2;
    }
    // Estructuras que se levantan (la vida sube hasta el máximo).
    for (const s of P.estructuras) if (s.crece < 1) {
      s.crece = Math.min(1, s.crece + dt / s.tiempo); s.vida = Math.min(s.vidaMax, s.vida + (s.vidaMax * 0.9 * dt) / s.tiempo);
      s.malla.scale.y = Math.min(1, s.malla.scale.y + dt * 5);
      if (s.crece >= 1) { s.mat.transparent = false; s.mat.opacity = 1; s.mat.emissiveIntensity = 0; s.mat.needsUpdate = true; } else s.mat.opacity = 0.6 + s.crece * 0.35;
    }
    // Botín: cae al piso, gira y se ve solo cerca.
    const cam = M.camara.position;
    for (const b of P.botin) {
      b.t += dt;
      if (b.vy !== 0 || b.vx !== 0) { b.vy -= 18 * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt; b.vx *= 0.96; b.vz *= 0.96; const s = sueloEn(b.x, b.z, b.y + 0.3, 0.3); if (b.y <= s) { b.y = s; b.vy = 0; b.vx = 0; b.vz = 0; } }
      b.malla.position.set(b.x, b.y, b.z); b.malla.userData.giro.rotation.y += dt * 1.5; b.malla.userData.giro.position.y = (b.item.tipo === "arma" ? 0.45 : b.item.tipo === "consumible" ? 0.4 : 0.12) + Math.sin(P.t * 2 + b.id) * 0.06;
      b.malla.visible = Math.abs(b.x - cam.x) < 70 && Math.abs(b.z - cam.z) < 70;
    }
    for (const c of P.cofres) { if (c.abierto && c.abre < 1) { c.abre = Math.min(1, c.abre + dt * 3); c.malla.tapa.rotation.x = c.abre * 1.9; } if (!c.abierto) c.malla.aura.material.opacity = 0.5 + Math.sin(P.t * 3 + c.x) * 0.2; c.malla.grupo.visible = Math.abs(c.x - cam.x) < 110 && Math.abs(c.z - cam.z) < 110; }
    // Final.
    const vivos = P.jugadores.filter((p) => p.vivo);
    if (!P.fin) {
      if (!yo.vivo) { P.fin = { gano: false, puesto: yo.puesto, bajas: yo.bajas, tiempo: P.t, asesino: P.asesino, dano: yo.dano, precision: yo.tiros ? yo.aciertos / yo.tiros : 0 }; Sonido.derrota(); }
      else if (vivos.length === 1) { P.fin = { gano: true, puesto: 1, bajas: yo.bajas, tiempo: P.t, dano: yo.dano, precision: yo.tiros ? yo.aciertos / yo.tiros : 0 }; yo.baila = true; Sonido.victoria(); M.lanzarConfeti(); }
    }
    P.feed = P.feed.filter((f) => (f.t -= dt) > 0);
    if (P.aviso && (P.aviso.t -= dt) <= 0) P.aviso = null;
    if (P.eliminacion && (P.eliminacion.t -= dt) <= 0) P.eliminacion = null;
    if (P.danoDir && (P.danoDir.t -= dt) <= 0) P.danoDir = null;
    P.danoFlash = Math.max(0, P.danoFlash - dt); P.sacudida = Math.max(0, P.sacudida - dt * 25);
    // Entrar a un lugar: el nombre en grande.
    if (yo.vivo && yo.estado === "tierra") { const pu = isla.lugares.find((q) => Math.hypot(q.x - yo.x, q.z - yo.z) < q.radio + 8); if (pu && pu !== P.lugar) avisar(pu.nombre, 2.4); P.lugar = pu || null; }
  }

  Object.assign(M, { nuevaPartida, paso, rayo, sueloEn, lineaLibre, construir, calcularPieza, disparar, recargar, usarConsumible, agarrar, abrirCofre, herir, boca, ojo, pecho, altura, alAire, enMano, soltar, nombreItem, saltarDelBus, dir4 });
}
