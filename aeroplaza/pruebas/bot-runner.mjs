// EL BOT DEL RUNNER: juega el nivel solo (salta los huecos, hace el doble salto si no llega,
// se desliza por las compuertas, salta las vallas, esquiva las paredes y los cubos). Corre
// ADENTRO de la página: se le pasa a pag.evaluate. Lo usan pruebas/runner.mjs y el tráiler
// (trailer/grabar.mjs). Queda en window.__B (activo, log).
export const botRunner = () => {
  const A = window.__A, R = A.reino, VEL = 17, beat = 60 / 175;
  const orig = R.antesDelJugador.bind(R);
  const B = window.__B = { activo: false, log: [], bajaT: 0, saltoT: 0 };
  const carriles = (C) => [-1, 0, 1].map((l) => C.cx + l * (C.w / 2 - 1.6));
  const xCubo = (C, tt) => { const paso = Math.floor(tt / (beat * 4)), obj = ((paso + C.k) % 3) - 1; return C.cx + obj * (C.w / 2 - 1.6); };
  R.antesDelJugador = (dt, yo, Em) => {
    if (B.activo && R.runner.fase === 'corre') {
      const p = yo.p, v = yo.v;
      Em.x = 0; Em.z = 0; Em.salta = false; Em.sostiene = true; Em.baja = false;
      const T = R.tramos.find((q) => p.z >= q.z0 - 0.3 && p.z <= q.z1 + 0.3);
      const N = R.tramos.find((q) => q.z0 > p.z + 0.3);
      const base = T || N; let tx = base.x;
      /* lo que viene en el camino (en los próximos 24 m) */
      const cerca = R.obst.filter((O) => O.z + O.dz > p.z - 0.4 && O.z - p.z < 24 && O.tGhost <= 0).sort((a, b) => a.z - b.z);
      const muro = cerca.find((O) => O.tipo === 'muro'), cubos = cerca.filter((O) => O.tipo === 'cubo');
      if (muro && (!cubos.length || muro.z < cubos[0].z)) {
        const Tm = R.tramos.find((q) => muro.z >= q.z0 && muro.z <= q.z1), a = Tm.x - Tm.w / 2 + 1, b = Tm.x + Tm.w / 2 - 1;
        const libres = [[a, muro.x0 - 0.9], [muro.x1 + 0.9, b]].filter(([u, w]) => w - u > 0.4);
        libres.sort((q, r) => Math.abs((q[0] + q[1]) / 2 - p.x) - Math.abs((r[0] + r[1]) / 2 - p.x));
        if (libres.length) tx = (libres[0][0] + libres[0][1]) / 2;
      } else if (cubos.length) {
        /* los cubos: el carril que va a estar libre cuando lleguemos */
        const fila = cubos.filter((O) => Math.abs(O.z - cubos[0].z) < 0.1), ta = R.reloj + (fila[0].z - p.z) / VEL;
        const ocupa = (x) => fila.some((C) => [-0.25, -0.1, 0, 0.12].some((d) => Math.abs(xCubo(C, ta + d) - x) < 2.6) || (fila[0].z - p.z < 7 && Math.abs(C.xAct - x) < 2.6));
        const opciones = carriles(fila[0]).filter((x) => !ocupa(x)).sort((q, r) => Math.abs(q - p.x) - Math.abs(r - p.x));
        if (opciones.length) tx = opciones[0];
      }
      Em.x = Math.max(-1, Math.min(1, (tx - p.x) * 0.7 - v.x * (yo.enPiso ? 0.12 : 0.3)));   // (con freno: en el aire se dobla despacio)
      /* saltar: al borde (si no hay trampolín), las vallas, y el doble si no llega */
      const valla = cerca.find((O) => O.tipo === 'valla' && O.z - p.z < Math.max(3.4, v.z * 0.24) && O.z > p.z);
      const puerta = cerca.find((O) => O.tipo === 'puerta' && O.z - p.z < 7 && O.z > p.z);
      const hayTramp = T && R.mundo.solidos.some((s) => s.rebote && Math.abs(s.z - (T.z1 - 2.5)) < 0.1);
      B.saltoT -= dt; B.bajaT -= dt;
      if (yo.enPiso && T && B.saltoT <= 0) {
        if ((T.z1 - p.z < 1.3 && !hayTramp) || valla) { Em.salta = true; B.saltoT = 0.25; B.log.push(['salta', +p.z.toFixed(1)]); }
      }
      if (puerta && B.bajaT <= 0 && !(yo.mov && yo.mov.tipo === 'desliza')) { Em.baja = true; B.bajaT = 0.3; B.log.push(['desliza', +p.z.toFixed(1)]); }
      if (!yo.enPiso && !T && N && yo.saltos < 2 && v.y < 1.5 && B.saltoT <= 0) {
        /* ¿dónde cae? (sin el doble) */
        const g = R.mundo.gravedad, dy = p.y - N.y, disc = v.y * v.y + 2 * g * dy;
        const tc = disc > 0 ? (v.y + Math.sqrt(disc)) / g : 0, zc = p.z + v.z * tc;
        if (zc < N.z0 + 1.2 && p.z < N.z0) { Em.salta = true; B.saltoT = 0.3; B.log.push(['doble', +p.z.toFixed(1)]); }
      }
    }
    orig(dt, yo, Em);
  };
};
