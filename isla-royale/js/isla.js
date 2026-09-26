"use strict";
// ════════════════════════════════════════════════════════════════════════
// La isla (solo datos): relieve, lugares con nombre, rutas, edificios con
// interior, autos, monte, puntos de botín y una grilla espacial para que los
// choques y los disparos no tengan que mirar todo.
// ════════════════════════════════════════════════════════════════════════
const T0 = -320, RES = 2.5, NG = 257;       // relieve: 640 m a 2,5 m
const G0 = -320, GC = 8, GN = 80;           // grilla espacial de 8 m
const ALTO_PISO = 3.6, ESPESOR = 0.3;       // casas
const radioIsla = (a) => 232 + 16 * Math.sin(a * 3 + 1) + 11 * Math.sin(a * 5 + 2) + 6 * Math.sin(a * 9 + 0.5);
// Metros hasta la orilla (positivo adentro de la isla).
const costa = (x, z) => radioIsla(Math.atan2(z, x)) - Math.hypot(x, z);

// ── grilla espacial ──
function crearGrilla() {
  const celdas = Array.from({ length: GN * GN }, () => []);
  let consulta = 1;
  const rango = (a, b) => [clamp(Math.floor((a - G0) / GC), 0, GN - 1), clamp(Math.floor((b - G0) / GC), 0, GN - 1)];
  return {
    celdas,
    insertar(o, mnx, mnz, mxx, mxz) {
      const [i0, i1] = rango(mnx, mxx), [j0, j1] = rango(mnz, mxz); o._celdas = [];
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { celdas[j * GN + i].push(o); o._celdas.push(j * GN + i); }
    },
    quitar(o) { for (const k of o._celdas || []) { const l = celdas[k], i = l.indexOf(o); if (i >= 0) l.splice(i, 1); } o._celdas = []; },
    // Todo lo que toca un rectángulo, sin repetir.
    cerca(mnx, mnz, mxx, mxz, fn) {
      const q = ++consulta, [i0, i1] = rango(mnx, mxx), [j0, j1] = rango(mnz, mxz);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const o of celdas[j * GN + i]) if (o._q !== q) { o._q = q; fn(o); }
    },
    // Recorre las celdas que cruza un rayo (DDA en el plano); fn(objeto) devuelve la distancia del choque o Infinity.
    recorrer(o, d, max, fn) {
      const q = ++consulta;
      let cx = Math.floor((o.x - G0) / GC), cz = Math.floor((o.z - G0) / GC);
      const px = d.x > 0 ? 1 : -1, pz = d.z > 0 ? 1 : -1;
      const dX = Math.abs(d.x) < 1e-9 ? Infinity : GC / Math.abs(d.x), dZ = Math.abs(d.z) < 1e-9 ? Infinity : GC / Math.abs(d.z);
      let tX = Math.abs(d.x) < 1e-9 ? Infinity : ((cx + (px > 0 ? 1 : 0)) * GC + G0 - o.x) / d.x;
      let tZ = Math.abs(d.z) < 1e-9 ? Infinity : ((cz + (pz > 0 ? 1 : 0)) * GC + G0 - o.z) / d.z;
      let t = 0, mejor = max;
      while (t <= mejor) {
        if (cx >= 0 && cz >= 0 && cx < GN && cz < GN) for (const ob of celdas[cz * GN + cx]) if (ob._q !== q) { ob._q = q; const tt = fn(ob); if (tt < mejor) mejor = tt; }
        if (tX < tZ) { t = tX; tX += dX; cx += px; } else { t = tZ; tZ += dZ; cz += pz; }
        if (t > 1500) break;
      }
      return mejor;
    },
  };
}

async function crearIsla(semilla, progreso) {
  const r = azar(semilla), ruido = crearRuido(r), ruido2 = crearRuido(r), ruido3 = crearRuido(r);
  const fbm = (x, z) => ruido(x, z) * 0.55 + ruido(x * 2.13, z * 2.13) * 0.28 + ruido(x * 4.37, z * 4.37) * 0.17;
  progreso(0.03, "etapa_relieve"); await pausa();
  const altoNatural = (x, z) => {
    const c = costa(x, z);
    if (c < 0) return Math.max(-8, -0.4 + c * 0.09);
    const m = suave(16, 70, c);
    return -0.4 + Math.min(c, 18) * 0.1 + m * Math.max(-1, fbm(x / 90 + 3, z / 90 + 7) * 30 - 11) + ruido2(x / 12, z / 12) * 0.8 * m;
  };

  // ── lugares con nombre ──
  const LUGARES = [
    ["Pueblo Pintoresco", "pueblo", 70, 999, 0], ["Loma Linda", "pueblo", 70, 999, 0], ["Villa Verde", "pueblo", 60, 999, 0],
    ["Granja Feliz", "granja", 55, 999, 0], ["Depósito Norte", "deposito", 50, 999, -1], ["Estación Sur", "estacion", 50, 999, 1],
    ["Bahía Bonita", "bahia", 30, 46, 0], ["Muelle Viejo", "muelle", 22, 30, 0],
  ];
  const lugares = [];
  for (const [nombre, tipo, cmin, cmax, lado] of LUGARES) {
    let mejor = null;
    for (let k = 0; k < 900; k++) {
      const x = (r() - 0.5) * 460, z = (r() - 0.5) * 460, c = costa(x, z);
      if (c < cmin || c > cmax || (lado && Math.sign(z) !== lado) || lugares.some((p) => Math.hypot(p.x - x, p.z - z) < 110)) continue;
      const y = altoNatural(x, z);
      // Loma Linda, arriba de una loma; el resto, en lo más llano que se encuentre.
      const puntaje = nombre === "Loma Linda" ? y : -Math.abs(altoNatural(x + 12, z) - altoNatural(x - 12, z)) - Math.abs(altoNatural(x, z + 12) - altoNatural(x, z - 12));
      if (!mejor || puntaje > mejor.puntaje) mejor = { nombre, tipo, x, z, y: Math.max(1.4, y), puntaje, radio: tipo === "deposito" ? 34 : tipo === "muelle" ? 18 : 30 };
      if (k > 250 && mejor) break;
    }
    if (mejor) lugares.push(mejor);
  }
  // ── rutas: una vuelta que une los lugares, ordenados por ángulo ──
  const orden = lugares.slice().sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const rutas = [];
  for (let i = 0; i < orden.length; i++) {
    const a = orden[i], b = orden[(i + 1) % orden.length];
    let ok = true; for (let k = 1; k < 10; k++) if (costa(lerp(a.x, b.x, k / 10), lerp(a.z, b.z, k / 10)) < 14) ok = false;
    if (ok) rutas.push({ ax: a.x, az: a.z, ay: a.y, bx: b.x, bz: b.z, by: b.y });
  }
  const cercaRuta = (x, z) => {
    let d = 1e9, y = 0;
    for (const s of rutas) { const dd = distSegmento(x, z, s.ax, s.az, s.bx, s.bz); if (dd < d) { d = dd; const dx = s.bx - s.ax, dz = s.bz - s.az, tt = clamp(((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz), 0, 1); y = lerp(s.ay, s.by, tt); } }
    return [d, y];
  };
  const alto = (x, z) => {
    let y = altoNatural(x, z);
    // Las rutas van en pendiente pareja entre pueblos: cortan lomas y rellenan bajos.
    const [dr, yr] = cercaRuta(x, z); const wr = suave(10, 3.5, dr) * 0.9; if (wr > 0 && costa(x, z) > 4) y = lerp(y, yr, wr);
    for (const p of lugares) { const w = suave(p.radio + 16, p.radio - 2, Math.hypot(x - p.x, z - p.z)); if (w > 0) y = lerp(y, p.y, w); }
    return y;
  };
  const alturas = new Float32Array(NG * NG);
  for (let j = 0; j < NG; j++) {
    for (let i = 0; i < NG; i++) alturas[j * NG + i] = alto(T0 + i * RES, T0 + j * RES);
    if (j % 32 === 0) { progreso(0.05 + (j / NG) * 0.25, "etapa_relieve"); await pausa(); }
  }
  const terreno = (x, z) => {
    const fx = (x - T0) / RES, fz = (z - T0) / RES;
    if (fx < 0 || fz < 0 || fx >= NG - 1 || fz >= NG - 1) return -8;
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * NG + i;
    const a = alturas[k], b = alturas[k + 1], c = alturas[k + NG], d = alturas[k + NG + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  // ── edificios ──
  progreso(0.32, "etapa_pueblos"); await pausa();
  const grilla = crearGrilla();
  const edificios = [], cajas = [], tejados = [], autos = [], puntosBotin = [], cofres = [], cajasMun = [];
  const PAREDES = ["#f3e6c8", "#cfe6f2", "#f5c6b0", "#d6efd0", "#f7f1e3", "#e9d3f0", "#f2d98a"], TECHOS = ["#c0463a", "#6b4a3a", "#4a6a8a", "#a8553a", "#3f5e3a"];
  const nuevaCaja = (mn, mx, extra) => { const c = Object.assign({ tipo: "caja", min: mn, max: mx }, extra); cajas.push(c); grilla.insertar(c, mn.x, mn.z, mx.x, mx.z); return c; };
  const ocupado = (mnx, mnz, mxx, mxz, m) => edificios.some((e) => mnx < e.max.x + m && mxx > e.min.x - m && mnz < e.max.z + m && mxz > e.min.z - m);
  // Una pared con huecos (puerta, ventanas) se arma con cajas: tramos enteros y, en cada hueco, lo de abajo y lo de arriba.
  function pared(e, lado, huecos, color) {
    const { x, z, w, d, y0 } = e, alto = e.alto, piso = y0 + 0.25;
    const largo = lado === "x+" || lado === "x-" ? d : w;
    const hs = huecos.slice().sort((a, b) => a.c - b.c);
    let desde = -largo / 2;
    const tramo = (a, b, ya, yb) => {
      if (b - a < 0.05 || yb - ya < 0.05) return;
      let mn, mx;
      if (lado === "x+" || lado === "x-") { const px = lado === "x+" ? x + w / 2 - ESPESOR : x - w / 2; mn = { x: px, y: piso + ya, z: z + a }; mx = { x: px + ESPESOR, y: piso + yb, z: z + b }; }
      else { const pz = lado === "z+" ? z + d / 2 - ESPESOR : z - d / 2; mn = { x: x + a, y: piso + ya, z: pz }; mx = { x: x + b, y: piso + yb, z: pz + ESPESOR }; }
      e.partes.push(nuevaCaja(mn, mx, { color, edificio: e }));
    };
    for (const hq of hs) e.huecos.push({ lado, ...hq });
    for (const hq of hs) { tramo(desde, hq.c - hq.w / 2, 0, alto); tramo(hq.c - hq.w / 2, hq.c + hq.w / 2, 0, hq.y0); tramo(hq.c - hq.w / 2, hq.c + hq.w / 2, hq.y1, alto); desde = hq.c + hq.w / 2; }
    tramo(desde, largo / 2, 0, alto);
  }
  // tipo: casa | galpon | granero | tienda. frente: hacia dónde da la puerta.
  function edificio(tipo, x, z, w, d, frente, opciones = {}) {
    const y0 = Math.max(terreno(x - w / 2, z - d / 2), terreno(x + w / 2, z - d / 2), terreno(x - w / 2, z + d / 2), terreno(x + w / 2, z + d / 2), terreno(x, z)) + 0.05;
    const alto = opciones.alto || (tipo === "galpon" ? 6 : tipo === "granero" ? 5 : ALTO_PISO);
    const e = { tipo, x, z, w, d, y0, alto, frente, partes: [], huecos: [], pared: opciones.pared || PAREDES[(r() * PAREDES.length) | 0], techo: opciones.techo || TECHOS[(r() * TECHOS.length) | 0], plano: !!opciones.plano,
      min: { x: x - w / 2, y: y0 - 2, z: z - d / 2 }, max: { x: x + w / 2, y: y0 + 0.25 + alto + 1.6, z: z + d / 2 } };
    edificios.push(e);
    // Piso: una losa que también tapa el terreno de abajo.
    e.partes.push(nuevaCaja({ x: x - w / 2, y: y0 - 2, z: z - d / 2 }, { x: x + w / 2, y: y0 + 0.25, z: z + d / 2 }, { color: tipo === "galpon" ? "#8b8b86" : "#9a7a58", edificio: e, piso: true }));
    const puerta = tipo === "galpon" ? { w: 4, y0: 0, y1: 4 } : tipo === "granero" ? { w: 3.4, y0: 0, y1: 3.6 } : { w: 1.6, y0: 0, y1: 2.5 };
    const ventana = (c) => ({ c, w: 1.3, y0: 1.0, y1: 2.2 });
    for (const lado of ["x+", "x-", "z+", "z-"]) {
      const largo = lado[0] === "x" ? d : w, huecos = [];
      if (lado === frente || (tipo === "galpon" && lado === ({ "x+": "x-", "x-": "x+", "z+": "z-", "z-": "z+" })[frente])) huecos.push({ c: 0, ...puerta });
      else if (tipo !== "galpon" && tipo !== "granero") { if (largo > 8) huecos.push(ventana(-largo * 0.25), ventana(largo * 0.25)); else huecos.push(ventana(0)); }
      pared(e, lado, huecos, e.pared);
    }
    // Techo: losa (se puede caminar arriba) y, si es a dos aguas, el tejado encima.
    const tope = y0 + 0.25 + alto;
    e.partes.push(nuevaCaja({ x: x - w / 2 - 0.2, y: tope, z: z - d / 2 - 0.2 }, { x: x + w / 2 + 0.2, y: tope + 0.3, z: z + d / 2 + 0.2 }, { color: e.techo, edificio: e, techoLosa: true }));
    if (!e.plano) {
      const cumbre = Math.min(w, d) * (tipo === "granero" ? 0.45 : 0.28), eje = w >= d ? "x" : "z";
      const tj = { tipo: "tejado", x, z, w: w + 0.6, d: d + 0.6, y: tope + 0.3, alto: cumbre, eje, color: e.techo, edificio: e,
        min: { x: x - w / 2 - 0.3, y: tope + 0.3, z: z - d / 2 - 0.3 }, max: { x: x + w / 2 + 0.3, y: tope + 0.3 + cumbre * 0.6, z: z + d / 2 + 0.3 } };
      tejados.push(tj); grilla.insertar(tj, tj.min.x, tj.min.z, tj.max.x, tj.max.z); e.tejado = tj;
    }
    // Lugares para el botín: adentro, lejos de las paredes.
    const cant = tipo === "galpon" ? 4 : tipo === "granero" ? 3 : 2;
    for (let k = 0; k < cant; k++) puntosBotin.push({ x: x + (r() - 0.5) * (w - 2.4), z: z + (r() - 0.5) * (d - 2.4), y: y0 + 0.25, dentro: true });
    if (r() < (tipo === "casa" ? 0.5 : 0.9)) {
      // Un cofre contra la pared del fondo.
      const fondo = { "x+": "x-", "x-": "x+", "z+": "z-", "z-": "z+" }[frente];
      const cx = fondo === "x+" ? x + w / 2 - 1 : fondo === "x-" ? x - w / 2 + 1 : x + (r() - 0.5) * (w - 3);
      const cz = fondo === "z+" ? z + d / 2 - 1 : fondo === "z-" ? z - d / 2 + 1 : z + (r() - 0.5) * (d - 3);
      cofres.push({ x: cx, z: cz, y: y0 + 0.25, rot: fondo === "x+" ? -Math.PI / 2 : fondo === "x-" ? Math.PI / 2 : fondo === "z+" ? Math.PI : 0 });
    }
    return e;
  }
  const frenteHacia = (x, z, tx, tz) => Math.abs(tx - x) > Math.abs(tz - z) ? (tx > x ? "x+" : "x-") : (tz > z ? "z+" : "z-");
  const lejosDeRuta = (x, z, m) => cercaRuta(x, z)[0] > m;
  function colocar(p, cant, fn, dmin = 8, dmax = 24) {
    for (let k = 0, hechas = 0; k < 120 && hechas < cant; k++) {
      const a = r() * Math.PI * 2, dd = dmin + r() * (dmax - dmin), x = p.x + Math.cos(a) * dd, z = p.z + Math.sin(a) * dd;
      if (fn(x, z)) hechas++;
    }
  }
  const intentar = (tipo, x, z, w, d, frente, opciones) => {
    if (costa(x, z) < 10 || ocupado(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 3.5) || !lejosDeRuta(x, z, Math.hypot(w, d) / 2 + 3)) return false;
    edificio(tipo, x, z, w, d, frente, opciones); return true;
  };
  const casa = (p) => (x, z) => { const w = 7 + r() * 3, d = 7 + r() * 2.5; return intentar("casa", x, z, w, d, frenteHacia(x, z, p.x, p.z), { plano: r() < 0.25 }); };
  const contenedores = [];
  for (const p of lugares) {
    if (p.tipo === "pueblo") colocar(p, 6, casa(p));
    else if (p.tipo === "bahia") colocar(p, 4, casa(p), 7, 20);
    else if (p.tipo === "granja") { colocar(p, 1, (x, z) => intentar("granero", x, z, 12, 10, frenteHacia(x, z, p.x, p.z), { pared: "#b8302a", techo: "#5a5a5a" }), 6, 14); colocar(p, 2, casa(p)); }
    else if (p.tipo === "deposito") {
      colocar(p, 2, (x, z) => intentar("galpon", x, z, 18, 12, frenteHacia(x, z, p.x, p.z), { pared: "#8e9aa6", techo: "#5f6b78", plano: true }), 8, 20);
      for (let k = 0; k < 8; k++) {
        const x = p.x + (r() - 0.5) * 50, z = p.z + (r() - 0.5) * 50, largo = r() < 0.5, w = largo ? 6 : 2.5, d = largo ? 2.5 : 6;
        if (ocupado(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 2) || !lejosDeRuta(x, z, 5) || contenedores.some((c) => Math.hypot(c.x - x, c.z - z) < 7)) continue;
        const y0 = terreno(x, z) - 0.2, col = ["#c0463a", "#2f6fe0", "#3f8a4a", "#e0a02e"][(r() * 4) | 0];
        contenedores.push({ x, z, w, d, y0, color: col });
        nuevaCaja({ x: x - w / 2, y: y0, z: z - d / 2 }, { x: x + w / 2, y: y0 + 2.6, z: z + d / 2 }, { color: col, contenedor: true });
      }
    } else if (p.tipo === "estacion") {
      colocar(p, 1, (x, z) => intentar("tienda", x, z, 10, 8, frenteHacia(x, z, p.x, p.z), { plano: true, pared: "#f7f1e3", techo: "#e0413c" }), 10, 18);
      colocar(p, 2, casa(p), 16, 26);
      // El techito de los surtidores: cuatro postes y una losa donde se puede subir.
      const y0 = terreno(p.x, p.z);
      p.surtidor = { x: p.x, z: p.z, y0 };
      for (const [dx, dz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) nuevaCaja({ x: p.x + dx - 0.2, y: y0, z: p.z + dz - 0.2 }, { x: p.x + dx + 0.2, y: y0 + 4.2, z: p.z + dz + 0.2 }, { color: "#dddddd" });
      nuevaCaja({ x: p.x - 5, y: y0 + 4.2, z: p.z - 3.8 }, { x: p.x + 5, y: y0 + 4.6, z: p.z + 3.8 }, { color: "#e0413c" });
      for (const dx of [-1.8, 1.8]) nuevaCaja({ x: p.x + dx - 0.4, y: y0, z: p.z - 0.6 }, { x: p.x + dx + 0.4, y: y0 + 1.6, z: p.z + 0.6 }, { color: "#f7f1e3" });
    } else if (p.tipo === "muelle") {
      colocar(p, 2, (x, z) => intentar("casa", x, z, 6, 6, frenteHacia(x, z, p.x, p.z), { plano: false }), 5, 12);
    }
    // Afuera también hay algo tirado.
    for (let k = 0; k < 3; k++) { const a = r() * 6.3, dd = 6 + r() * 16, x = p.x + Math.cos(a) * dd, z = p.z + Math.sin(a) * dd; if (!ocupado(x, z, x, z, 1.5)) puntosBotin.push({ x, z, y: terreno(x, z), dentro: false }); }
    { const a = r() * 6.3, x = p.x + Math.cos(a) * 12, z = p.z + Math.sin(a) * 12; if (!ocupado(x, z, x, z, 1.5)) cajasMun.push({ x, z, y: terreno(x, z), rot: r() * 6 }); }
  }
  // El muelle: tablones que salen derecho hacia el mar.
  const plataformas = [];
  for (const p of lugares.filter((q) => q.tipo === "muelle")) {
    const ax = Math.abs(p.x) > Math.abs(p.z), sx = Math.sign(p.x), sz = Math.sign(p.z), largo = 40;
    const mn = ax ? { x: Math.min(p.x, p.x + sx * largo), z: p.z - 1.8 } : { x: p.x - 1.8, z: Math.min(p.z, p.z + sz * largo) };
    const mx = ax ? { x: Math.max(p.x, p.x + sx * largo), z: p.z + 1.8 } : { x: p.x + 1.8, z: Math.max(p.z, p.z + sz * largo) };
    const pl = nuevaCaja({ x: mn.x, y: 0.8, z: mn.z }, { x: mx.x, y: 1.05, z: mx.z }, { color: "#9a6a3c", muelle: true });
    plataformas.push(pl);
    puntosBotin.push({ x: (mn.x + mx.x) / 2 + (ax ? sx * 15 : 0), z: (mn.z + mx.z) / 2 + (ax ? 0 : sz * 15), y: 1.05, dentro: false });
  }
  // Autos abandonados al costado de las rutas (se les saca metal con el pico).
  for (const s of rutas) {
    const n = 2 + ((r() * 3) | 0), ang = Math.atan2(s.bx - s.ax, s.bz - s.az);
    for (let k = 0; k < n; k++) {
      const tt = 0.15 + r() * 0.7, lado = r() < 0.5 ? -1 : 1, nx = Math.cos(ang) * lado * 4.2, nz = -Math.sin(ang) * lado * 4.2;
      const x = lerp(s.ax, s.bx, tt) + nx, z = lerp(s.az, s.bz, tt) + nz;
      if (ocupado(x, z, x, z, 3) || autos.some((a) => Math.hypot(a.x - x, a.z - z) < 8)) continue;
      const a = { tipo: "auto", x, z, y0: terreno(x, z), ang: ang + (r() - 0.5) * 0.4, color: ["#d8433c", "#2f6fe0", "#f2f2f2", "#3a3a3a", "#e0a02e", "#3f8a4a"][(r() * 6) | 0], vida: 400, idx: autos.length };
      a.puntos = [{ x: x + Math.sin(a.ang) * 1.1, z: z + Math.cos(a.ang) * 1.1 }, { x: x - Math.sin(a.ang) * 1.1, z: z - Math.cos(a.ang) * 1.1 }];
      autos.push(a); grilla.insertar(a, x - 2.5, z - 2.5, x + 2.5, z + 2.5);
    }
  }
  const enEdificio = (x, z, m) => ocupado(x, z, x, z, m) || contenedores.some((c) => Math.abs(c.x - x) < c.w / 2 + m && Math.abs(c.z - z) < c.d / 2 + m);

  // ── monte ──
  progreso(0.5, "etapa_monte"); await pausa();
  const arboles = [], rocas = [], matas = [], pasto = [];
  const lejosDe = (lista, x, z, d) => !lista.some((o) => Math.abs(o.x - x) < d && Math.abs(o.z - z) < d && Math.hypot(o.x - x, o.z - z) < d);
  const libreMonte = (x, z, m) => !enEdificio(x, z, m) && cercaRuta(x, z)[0] > m + 3 && lejosDe(autos, x, z, 4) && lugares.every((p) => Math.hypot(p.x - x, p.z - z) > p.radio * 0.55);
  for (let k = 0; k < 5000 && arboles.length < 430; k++) {
    const x = (r() - 0.5) * 500, z = (r() - 0.5) * 500, c = costa(x, z);
    if (c < 18 || !libreMonte(x, z, 3.5) || !lejosDe(arboles, x, z, 5.5)) continue;
    if (r() > (ruido3(x / 50, z / 50) > 0.5 ? 1 : 0.15)) continue;
    const y0 = terreno(x, z), s = 0.85 + r() * 0.55, pino = (y0 > 8 && r() < 0.7) || r() < 0.22;
    const a = { tipo: "arbol", x, z, y0, s, pino, rot: r() * 6.3, tono: r(), rt: 0.38 * s, alto: (pino ? 3 : 3.6) * s, copaY: y0 + (pino ? 4.6 : 5.0) * s, copaR: (pino ? 2.1 : 2.5) * s, vida: 250 * s, idx: arboles.length };
    arboles.push(a); grilla.insertar(a, x - 1, z - 1, x + 1, z + 1);
  }
  for (let k = 0; k < 2500 && rocas.length < 110; k++) {
    const x = (r() - 0.5) * 500, z = (r() - 0.5) * 500;
    if (costa(x, z) < 6 || !libreMonte(x, z, 3) || !lejosDe(arboles, x, z, 4.5) || !lejosDe(rocas, x, z, 9)) continue;
    const s = 0.9 + r() * 2.2, ro = { tipo: "roca", x, z, y0: terreno(x, z), s, sy: s * (0.55 + r() * 0.4), rot: r() * 6.3, tono: r(), radio: s * 0.95, vida: 300 * s, idx: rocas.length };
    rocas.push(ro); grilla.insertar(ro, x - ro.radio, z - ro.radio, x + ro.radio, z + ro.radio);
  }
  progreso(0.58, "etapa_monte"); await pausa();
  for (let k = 0; k < 3000 && matas.length < 320; k++) {
    const x = (r() - 0.5) * 500, z = (r() - 0.5) * 500;
    if (costa(x, z) < 12 || enEdificio(x, z, 1.5) || cercaRuta(x, z)[0] < 4) continue;
    matas.push({ x, z, y0: terreno(x, z), s: 0.7 + r() * 0.7, rot: r() * 6.3, tono: r() });
  }
  for (let k = 0; k < 40000 && pasto.length < 9000; k++) {
    const x = (r() - 0.5) * 500, z = (r() - 0.5) * 500;
    if (costa(x, z) < 12 || r() > ruido2(x / 20, z / 20) * 1.4 || enEdificio(x, z, 0.6) || cercaRuta(x, z)[0] < 4.5) continue;
    pasto.push({ x, z, y0: terreno(x, z), s: 0.6 + r() * 0.8, rot: r() * 6.3, tono: r() });
  }

  // ── botín suelto por el campo ──
  progreso(0.66, "etapa_botin"); await pausa();
  for (let k = 0; k < 2000 && cofres.length < 48; k++) {
    const x = (r() - 0.5) * 440, z = (r() - 0.5) * 440;
    if (costa(x, z) < 16 || enEdificio(x, z, 3) || !lejosDe(arboles, x, z, 2.5) || !lejosDe(rocas, x, z, 4) || !lejosDe(cofres, x, z, 35)) continue;
    cofres.push({ x, z, y: terreno(x, z), rot: r() * 6.3 });
  }
  for (let k = 0; k < 1500 && cajasMun.length < 26; k++) {
    const x = (r() - 0.5) * 440, z = (r() - 0.5) * 440;
    if (costa(x, z) < 12 || enEdificio(x, z, 2) || !lejosDe(arboles, x, z, 2) || !lejosDe(cajasMun, x, z, 40)) continue;
    cajasMun.push({ x, z, y: terreno(x, z), rot: r() * 6.3 });
  }
  for (let k = 0; k < 1500 && puntosBotin.length < 150; k++) {
    const x = (r() - 0.5) * 440, z = (r() - 0.5) * 440;
    if (costa(x, z) < 12 || enEdificio(x, z, 2) || !lejosDe(arboles, x, z, 2) || !lejosDe(puntosBotin, x, z, 25)) continue;
    puntosBotin.push({ x, z, y: terreno(x, z), dentro: false });
  }
  return { lugares, rutas, cercaRuta, alturas, terreno, fbm, ruido2, grilla, edificios, cajas, tejados, contenedores, autos, plataformas, arboles, rocas, matas, pasto, puntosBotin, cofres, cajasMun };
}
