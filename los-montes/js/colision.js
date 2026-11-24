"use strict";
// ════════════════════════════════════════════════════════════════════════
// Choques en el plano (x, z): círculos (árboles, rocas) y cajas giradas
// (cabañas, camionetas, paredes). Cada cosa tiene una zona: "ext" es el
// valle; cada interior (cabaña, mina, cueva) es otra, y solo choca con lo suyo.
// Una grilla de 16 m evita revisar los 8 mil pinos en cada paso.
// ════════════════════════════════════════════════════════════════════════
const Colision = (() => {
  const CELDA = 16, grilla = new Map(), todos = [];
  const clave = (i, j) => i * 100003 + j;
  function celdas(o, x0, z0, x1, z1) {
    o.celdas = [];
    for (let i = Math.floor(x0 / CELDA); i <= Math.floor(x1 / CELDA); i++)
      for (let j = Math.floor(z0 / CELDA); j <= Math.floor(z1 / CELDA); j++) {
        const k = clave(i, j); if (!grilla.has(k)) grilla.set(k, []); grilla.get(k).push(o); o.celdas.push(k);
      }
  }
  function meter(o, x0, z0, x1, z1) { celdas(o, x0, z0, x1, z1); todos.push(o); return o; }
  // Lo que se mueve (la camioneta, un tronco colgado de la grúa) cambia de celdas.
  function mover(o, x, z, rumbo) {
    for (const k of o.celdas) { const l = grilla.get(k); const i = l.indexOf(o); if (i >= 0) l.splice(i, 1); }
    o.x = x; o.z = z; if (rumbo !== undefined && !o.c) { o.cos = Math.cos(rumbo); o.sin = Math.sin(rumbo); }
    const R = o.c ? o.r : Math.hypot(o.hx, o.hz); celdas(o, x - R, z - R, x + R, z + R);
  }
  function circulo(x, z, r, tipo = "", zona = "ext") { return meter({ c: true, x, z, r, tipo, zona, activo: true }, x - r, z - r, x + r, z + r); }
  // Caja: centro, medio ancho (x local), medio largo (z local), rumbo (giro sobre y).
  function caja(x, z, ancho, largo, rumbo = 0, extra = {}) {
    const hx = ancho / 2, hz = largo / 2, R = Math.hypot(hx, hz);
    return meter({ c: false, x, z, hx, hz, cos: Math.cos(rumbo), sin: Math.sin(rumbo), tipo: extra.tipo || "", zona: extra.zona || "ext", alto: extra.alto ?? 99, piso: extra.piso ?? -99, activo: true, dueno: extra.dueno }, x - R, z - R, x + R, z + R);
  }
  function cerca(x, z, r) {
    const out = new Set();
    for (let i = Math.floor((x - r) / CELDA); i <= Math.floor((x + r) / CELDA); i++)
      for (let j = Math.floor((z - r) / CELDA); j <= Math.floor((z + r) / CELDA); j++) { const l = grilla.get(clave(i, j)); if (l) for (const o of l) out.add(o); }
    return out;
  }
  // Empuja p (x, z) fuera de todo lo que toca. y: la altura de los pies (para
  // pasar por arriba de lo bajo, como la caja de la camioneta si uno se sube).
  function resolver(p, radio, zona = "ext", y = 0) {
    let choco = null;
    for (let vuelta = 0; vuelta < 2; vuelta++) for (const o of cerca(p.x, p.z, radio + 2)) {
      if (!o.activo || o.zona !== zona) continue;
      if (o.c) {
        const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = radio + o.r;
        if (d < m && d > 1e-6) { p.x = o.x + (dx / d) * m; p.z = o.z + (dz / d) * m; choco = o; }
      } else {
        if (y > o.alto - 0.4 || y < o.piso) continue;
        // A coordenadas de la caja.
        const dx = p.x - o.x, dz = p.z - o.z, lx = dx * o.cos - dz * o.sin, lz = dx * o.sin + dz * o.cos;
        const cx = clamp(lx, -o.hx, o.hx), cz = clamp(lz, -o.hz, o.hz), ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
        let nx, nz;
        if (d > 1e-6) { if (d >= radio) continue; nx = cx + (ex / d) * radio; nz = cz + (ez / d) * radio; }
        else { // Adentro: sale por el lado más cercano.
          const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
          if (px < pz) { nx = Math.sign(lx || 1) * (o.hx + radio); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (o.hz + radio); }
        }
        p.x = o.x + nx * o.cos + nz * o.sin; p.z = o.z - nx * o.sin + nz * o.cos; choco = o;
      }
    }
    return choco;
  }
  // ¿Una pared o una caja corta la línea entre a y b? (Para que no te vean a través de una cabaña.)
  function tapa(ax, az, bx, bz, zona = "ext", solo = null) {
    const L = Math.hypot(bx - ax, bz - az), pasos = Math.ceil(L / 1.5);
    const vistos = cerca((ax + bx) / 2, (az + bz) / 2, L / 2 + 2);
    for (const o of vistos) {
      if (!o.activo || o.zona !== zona || (solo && !solo.includes(o.tipo))) continue;
      for (let k = 1; k < pasos; k++) {
        const t = k / pasos, x = lerp(ax, bx, t), z = lerp(az, bz, t);
        if (o.c) { if (Math.hypot(x - o.x, z - o.z) < o.r * 0.8) return o; }
        else { const dx = x - o.x, dz = z - o.z, lx = dx * o.cos - dz * o.sin, lz = dx * o.sin + dz * o.cos; if (Math.abs(lx) < o.hx && Math.abs(lz) < o.hz) return o; }
      }
    }
    return null;
  }
  // Cuántos troncos hay cerca: tapan la vista en el bosque.
  function espesura(x, z, r = 8) { let n = 0; for (const o of cerca(x, z, r)) if (o.c && o.tipo === "arbol" && Math.hypot(o.x - x, o.z - z) < r) n++; return n; }
  return { circulo, caja, mover, resolver, tapa, cerca, espesura, todos };
})();
