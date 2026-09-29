"use strict";
// ════════════════════════════════════════════════════════════════════════
// Relieve del valle. Una sola función de altura que usan la malla, el
// jugador, los enemigos, los árboles y las camionetas: si algo pisa el suelo,
// pregunta acá. Todo sale de MAPA (base.js): lago, río, rutas y lugares.
// ════════════════════════════════════════════════════════════════════════
const Terreno = (() => {
  const L = MAPA.lugares, LAGO = MAPA.lago;
  // Distancia de un punto a una polilínea (y en qué tramo cae), para río y rutas.
  function aLinea(x, z, pts) {
    let mejor = 1e9, s = 0, sMejor = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, l = Math.sqrt(l2);
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
      if (d < mejor) { mejor = d; sMejor = s + t * l; }
      s += l;
    }
    return { d: mejor, s: sMejor };
  }
  const RUTAS = [MAPA.ruta, ...MAPA.ramales];
  // Base del valle, sin el detalle chico: sirve para aplanar rutas y lugares.
  function baseValle(x, z) {
    const d = Math.hypot(x / 860, (z - 40) / 820);
    let anillo = suave(0.6, 1.02, d);
    // Paso del sur: la ruta y el río salen del valle por una quebrada.
    if (z > 250) anillo *= suave(15, 110, Math.min(Math.abs(x - lerp(0, 60, suave(250, 850, z))), 1e9));
    let h = 8 + 7 * Ruido.fbm(x / 420, z / 420, 3) + 3.5 * Ruido.fbm(x / 150 + 7, z / 150, 3);
    // Montañas del borde: crestas grandes, más altas al norte (como la referencia).
    const norte = suave(200, -700, z);
    h += anillo * (150 + 230 * Ruido.crestas(x / 300 + 3, z / 300 - 2, 5)) * (0.75 + 0.6 * norte);
    // El pico grande del fondo y dos hermanos.
    h += 700 * Math.exp(-((x - 40) ** 2 + (z + 800) ** 2) / (2 * 240 ** 2));
    h += 430 * Math.exp(-((x + 470) ** 2 + (z + 640) ** 2) / (2 * 200 ** 2));
    h += 400 * Math.exp(-((x - 560) ** 2 + (z + 560) ** 2) / (2 * 190 ** 2));
    // El acantilado del norte del lago, de donde caen las cascadas.
    const esc = suave(-262, -300, z) * suave(420, 250, Math.abs(x));
    h += esc * (58 + 18 * Ruido.fbm(x / 60, z / 60, 3));
    // La ladera de la mina, al oeste.
    h += 90 * suave(-400, -470, x) * suave(260, 60, Math.abs(z + 50));
    return Math.max(h, 2.2);
  }
  const alturaLugar = {};
  for (const k in L) alturaLugar[k] = null;
  function altura(x, z) {
    let h = baseValle(x, z);
    // Detalle chico: lomas, piedras, raíces.
    h += 1.6 * Ruido.fbm(x / 22, z / 22, 3) + 0.5 * Ruido.valor(x / 5.3, z / 5.3);
    // Rutas: se aplanan a la base, con cunetas suaves.
    let rd = 1e9; for (const r of RUTAS) rd = Math.min(rd, aLinea(x, z, r).d);
    if (rd < 14) h = lerp(h, baseValle(x, z) + 0.15, suave(14, 3.5, rd));
    // Lugares: planos, para que las cabañas y los campamentos se apoyen bien.
    for (const k in L) {
      const l = L[k], d = Math.hypot(x - l.x, z - l.z);
      if (d > l.r + 20) continue;
      if (alturaLugar[k] === null) alturaLugar[k] = baseValle(l.x, l.z);
      h = lerp(h, alturaLugar[k] + 0.2, suave(l.r + 20, l.r, d));
    }
    // Lago: una hoya de hasta 9 m; el agua está a y = 0.
    const e = ((x - LAGO.x) / LAGO.rx) ** 2 + ((z - LAGO.z) / LAGO.rz) ** 2;
    if (e < 2.2) { const fondo = -9 * (1 - Math.min(1, e)) - 0.8; h = lerp(h, Math.min(h, fondo), suave(2.2, 1.0, e)); }
    // Río: cauce de 2 m de hondo bajo el agua (y = 0,25).
    const rr = aLinea(x, z, MAPA.rio), w = MAPA.anchoRio / 2;
    if (rr.d < w + 10) { const fondo = -1.9 + 0.5 * (rr.d / w) ** 2; h = lerp(h, Math.min(h, fondo), suave(w + 10, w * 0.7, rr.d)); }
    // Vado del ramal al aserradero: ahí el río es bajo y lo cruzan las camionetas.
    if (Math.hypot(x - 74, z - 272) < 16) h = Math.max(h, -0.35);
    return h;
  }
  function normal(x, z, e = 1.2) {
    const hx = altura(x + e, z) - altura(x - e, z), hz = altura(x, z + e) - altura(x, z - e);
    const n = new THREE.Vector3(-hx, 2 * e, -hz); return n.normalize();
  }
  function enAgua(x, z) {
    const e = ((x - LAGO.x) / LAGO.rx) ** 2 + ((z - LAGO.z) / LAGO.rz) ** 2;
    if (e < 1.05) return "lago";
    if (aLinea(x, z, MAPA.rio).d < MAPA.anchoRio / 2) return Math.hypot(x - 74, z - 272) < 14 ? "vado" : "rio";
    return null;
  }
  const distRuta = (x, z) => { let d = 1e9; for (const r of RUTAS) d = Math.min(d, aLinea(x, z, r).d); return d; };
  const distRio = (x, z) => aLinea(x, z, MAPA.rio).d;
  return { altura, baseValle, normal, enAgua, aLinea, distRuta, distRio, RUTAS };
})();
