// EL RUNNER (reinos/runner.js): que se pueda ganar antes de que termine la
// canción (un bot lo corre entero: salta los huecos, hace el doble salto si no
// llega, se desliza por las compuertas, salta las vallas, esquiva las paredes y
// los cubos), que se corra solo y rápido, que la cámara quede atrás, que
// deslizarse pase por debajo de la compuerta y parado no, que caerse te
// devuelva al último tramo, que se rompa todo con la canción y vuelva a ser
// Frutiger al llegar, que el tiempo se acabe, el HUD y el resultado.
//     node pruebas/runner.mjs
import { navegador, abrir, avanzar } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, errores } = await abrir(nav, 'directo&pausa&calidad=baja&reino=runner', { ancho: 800, alto: 450 });
await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.reino.id === 'runner' && window.__A.yo, null, { timeout: 120000, polling: 250 });
await avanzar(pag, 4);

/* el bot: se mete antes del runner y le pone los "dedos" (Em) */
await pag.evaluate(() => {
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
});

/* 1. la cuenta: quieto en la salida; después se corre solo, rápido, y la cámara atrás */
let r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, E = R.runner, P = () => A.yo.p.clone();
  const p0 = P(); for (let i = 0; i < 40; i++) A.paso(1 / 30, false);
  const quieto = P().distanceTo(p0) < 0.2 && E.fase === 'cuenta';
  let n = 0; while (E.fase === 'cuenta' && n++ < 200) A.paso(1 / 30, false);
  const z0 = A.yo.p.z; for (let i = 0; i < 45; i++) A.paso(1 / 30, false);
  const vel = Math.hypot(A.yo.v.x, A.yo.v.z), dz = A.yo.p.z - z0;
  let dyaw = A.cam.yaw - Math.PI; while (dyaw > Math.PI) dyaw -= 6.283; while (dyaw < -Math.PI) dyaw += 6.283;
  return { quieto, fase: E.fase, vel: +vel.toFixed(1), dz: +dz.toFixed(1), yaw: +dyaw.toFixed(2), fov: +A.motor.camara.fov.toFixed(1), musica: A.J.sonando };
});
prueba('en la cuenta 3-2-1 se queda en la salida', r.quieto);
prueba('después corre solo para adelante, rápido', r.fase === 'corre' && r.vel > 15 && r.dz > 20, `${r.vel} m/s`);
prueba('la cámara va atrás, mirando para donde se corre', Math.abs(r.yaw) < 0.05, `desvío ${r.yaw}`);
prueba('el campo de visión se abre', r.fov > 70, `${r.fov}°`);
prueba('con el ¡YA! suena la canción del runner', /runner/.test(r.musica || '') || r.musica == null, String(r.musica));

/* 2. el palito solo va de costado */
await pag.keyboard.down('KeyA');
r = await pag.evaluate(() => { const A = window.__A, x0 = A.yo.p.x; for (let i = 0; i < 8; i++) A.paso(1 / 30, false); return { dx: +(A.yo.p.x - x0).toFixed(2), vz: +A.yo.v.z.toFixed(1) }; });
await pag.keyboard.up('KeyA');
prueba('A va de costado sin frenar', Math.abs(r.dx) > 0.6 && r.vz > 15, `${r.dx} m de costado · ${r.vz} m/s adelante`);

/* 3. la compuerta: parado te frena, deslizándote pasás */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, E = R.runner, O = R.obst.find((q) => q.tipo === 'puerta');
  const T = R.tramos.find((q) => O.z >= q.z0 && O.z <= q.z1);
  const probar = (desliza) => {
    O.tGhost = 0; E.aturdido = 0; E.golpes = 0;
    A.yo.ponerEn(new A.THREE.Vector3(T.x, T.y + 0.05, O.z - 9), 0); A.yo.v.set(0, 0, 17);
    if (desliza) { A.paso(1 / 30, false); A.yo.enPiso = true; A.yo.deslizar(17, new A.THREE.Vector2(0, 1), 1); }
    for (let i = 0; i < 24; i++) A.paso(1 / 30, false);
    return { golpes: E.golpes, z: +(A.yo.p.z - O.z).toFixed(1) };
  };
  return { parado: probar(false), desliza: probar(true) };
});
prueba('la compuerta, corriendo parado: te choca', r.parado.golpes === 1, JSON.stringify(r.parado));
prueba('la compuerta, deslizándote: pasás por abajo', r.desliza.golpes === 0 && r.desliza.z > 1, JSON.stringify(r.desliza));
/* la tecla de bajar de verdad desliza siempre (corriendo en el runner) */
r = await pag.evaluate(() => { const A = window.__A, R = A.reino, T = R.tramos[1]; A.yo.ponerEn(new A.THREE.Vector3(T.x, T.y + 0.05, T.z0 + 2), 0); A.yo.v.set(0, 0, 17); for (let i = 0; i < 4; i++) A.paso(1 / 30, false); return 0; });
await pag.keyboard.down('KeyC');
r = await pag.evaluate(() => { const A = window.__A; A.paso(1 / 30, false); A.paso(1 / 30, false); return { mov: A.yo.mov?.tipo, v: +A.yo.v.z.toFixed(1) }; });
await pag.keyboard.up('KeyC');
prueba('bajar (C) desliza siempre, sin perder velocidad', r.mov === 'desliza' && r.v > 15, JSON.stringify(r));

/* 4. caerse te devuelve al principio del último tramo pisado */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, E = R.runner, T = R.tramos[3];
  A.yo.ponerEn(new A.THREE.Vector3(T.x, T.y + 0.05, T.z0 + 8), 0); for (let i = 0; i < 3; i++) A.paso(1 / 30, false);
  const c0 = E.caidas; A.yo.ponerEn(new A.THREE.Vector3(T.x + T.w, T.y - 2, T.z0 + 12), 0);
  for (let i = 0; i < 60; i++) A.paso(1 / 30, false);
  return { caidas: E.caidas - c0, dz: +(A.yo.p.z - T.z0).toFixed(1), dy: +(A.yo.p.y - T.y).toFixed(2) };
});
prueba('caerse te devuelve al tramo donde ibas', r.caidas === 1 && r.dz > 0 && r.dz < 30 && Math.abs(r.dy) < 0.6, JSON.stringify(r));

/* 5. lo roto sigue a la canción: sano al principio, roto al final */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, E = R.runner, U = A.motor.pFinal.uniforms, out = {};
  for (const s of [5, 14, 25, 40, 55, 62]) { E.tiempo = s; A.paso(1 / 30, false); out[s] = +R.glitch.toFixed(2); }
  return out;
});
prueba('antes del drop todo es Frutiger (sin glitch)', r[5] === 0 && r[14] === 0, JSON.stringify(r));
prueba('después se va rompiendo cada vez más', r[25] > 0 && r[55] > r[25] && r[62] > 0.15, JSON.stringify(r));

/* 6. el bot corre el nivel entero */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, E = R.runner, B = window.__B;
  R.reiniciar(A.yo); B.log.length = 0; B.activo = true; A.delirio.reiniciar();
  let n = 0, maxGl = 0, maxCajas = 0, maxRoll = 0, congelas = 0; const ev = [];
  const E0 = E.eventos;
  while (n++ < 30 * 75 && E.fase !== 'fin') { A.paso(1 / 30, false); maxGl = Math.max(maxGl, R.glitch); maxCajas = Math.max(maxCajas, A.delirio.stats.cajas); maxRoll = Math.max(maxRoll, Math.abs(R.camRoll)); if (R.congela > 0) congelas++; }
  B.activo = false;
  window.__D = { ...A.delirio.stats, maxCajas, maxRoll: +maxRoll.toFixed(3), congelas, figuras: R.figuras.filter((F) => F.ido).length };
  return { fase: E.fase, ok: !!E.fin?.ok, tiempo: +E.tiempo.toFixed(2), prog: +E.prog.toFixed(3), caidas: E.caidas, golpes: E.golpes, maxGl: +maxGl.toFixed(2), saltos: B.log.filter((q) => q[0] === 'salta').length, dobles: B.log.filter((q) => q[0] === 'doble').length, desliza: B.log.filter((q) => q[0] === 'desliza').length, z: +A.yo.p.z.toFixed(0) };
});
prueba('el bot llega al portal antes de que termine la canción', r.ok && r.tiempo < 63.5, `${r.tiempo} s de 63,5 · ${r.caidas} caídas · ${r.golpes} golpes · z ${r.z} · ${Math.round(r.prog * 100)}%`);
prueba('…sin caerse, y usando saltos, dobles y deslizadas', r.caidas === 0 && r.saltos > 10 && r.dobles >= 1 && r.desliza >= 5, `${r.saltos} saltos · ${r.dobles} dobles · ${r.desliza} deslizadas`);
prueba('…con margen para las tres estrellas (≥ 8 s)', 63.5 - r.tiempo >= 8, `sobran ${(63.5 - r.tiempo).toFixed(1)} s`);
/* lo extremo (delirio.js), en la misma corrida del bot */
const D = await pag.evaluate(() => window.__D);
prueba('lo extremo: los tres sustos, cada uno a su hora', D.sustos === 3, JSON.stringify(D));
prueba('…palabras gigantes en los golpes (DESPIERTA, WAKE UP…) y alguna de un cuadro', D.palabras >= 10 && D.sublim >= 1, `${D.palabras} palabras · ${D.sublim} subliminales · la última: ${D.ultima}`);
prueba('…el rastreo sigue las cosas de la pista, y las figuras se deshacen al acercarse', D.maxCajas >= 3 && D.figuras >= 3, `hasta ${D.maxCajas} cajas · ${D.figuras} figuras`);
prueba('…la cámara pega con los golpes y a veces se congela un cuadro', D.maxRoll > 0.05 && D.congelas >= 2, `ladeo ${D.maxRoll} · ${D.congelas} cuadros congelados`);
r = await pag.evaluate(() => { const A = window.__A; for (let i = 0; i < 60; i++) A.paso(1 / 30, false); return { gl: A.reino.glitch, hud: !!document.querySelector('.pk-hud.runner') }; });
prueba('al llegar todo vuelve a ser Frutiger', r.gl < 0.02, `glitch ${r.gl.toFixed(3)}`);
await pag.waitForTimeout(1800);
r = await pag.evaluate(() => { const v = document.querySelector('.ventana'); return { v: !!v, txt: v ? v.textContent.slice(0, 120) : '' }; });
prueba('sale el resultado con las estrellas', r.v && /★/.test(r.txt), r.txt.replace(/\s+/g, ' '));

/* 7. si no llegás, se termina con la canción */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, E = R.runner;
  A.J.runnerReiniciar(); let n = 0; while (E.fase === 'cuenta' && n++ < 200) A.paso(1 / 30, false);
  E.tiempo = 63.3; for (let i = 0; i < 12; i++) A.paso(1 / 30, false);
  return { fase: E.fase, ok: E.fin?.ok };
});
prueba('si la canción termina antes, se acaba (y no ganás)', r.fase === 'fin' && r.ok === false);
await pag.waitForTimeout(1200);
r = await pag.evaluate(() => { const v = document.querySelector('.ventana'); return v ? v.textContent.replace(/\s+/g, ' ').slice(0, 100) : ''; });
prueba('…con su resultado (hasta dónde llegaste)', /%/.test(r), r);

/* 7b. el susto se dibuja (la cara, encima del juego) y con los sustos apagados no hay */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, E = R.runner, D = A.delirio, out = {};
  A.J.runnerReiniciar(); let n = 0; while (E.fase === 'cuenta' && n++ < 200) A.paso(1 / 30, false);
  E.tiempo = 47.3; for (let i = 0; i < 10; i++) A.paso(1 / 30, true);
  const c = document.querySelector('canvas.delirio.on'), g = c && c.getContext('2d'), px = g ? g.getImageData(c.width / 2 | 0, c.height / 2 | 0, 1, 1).data : [0, 0, 0, 0];
  out.si = { sustos: D.stats.sustos, activo: !!D.susto, alfa: px[3], lienzo: !!c };
  A.G.opciones.sustos = false; A.J.runnerReiniciar(); n = 0; while (E.fase === 'cuenta' && n++ < 200) A.paso(1 / 30, false);
  E.tiempo = 20.0; for (let i = 0; i < 10; i++) A.paso(1 / 30, true);
  out.no = { sustos: D.stats.sustos, activo: !!D.susto };
  A.G.opciones.sustos = true;
  return out;
});
prueba('el susto se dibuja encima del juego, y apagado en Opciones no aparece', r.si.sustos === 1 && r.si.activo && r.si.alfa > 200 && r.no.sustos === 0 && !r.no.activo, JSON.stringify(r));

/* 8. salir vuelve a la Zona de Juegos, delante de la puerta del runner */
await pag.evaluate(() => window.__A.J.runnerSalir());
await pag.waitForFunction(() => window.__A.reino.id === 'juegos', null, { timeout: 20000, polling: 100 });
await pag.waitForTimeout(1400);
await avanzar(pag, 3);
r = await pag.evaluate(() => { const A = window.__A, P = A.reino.portales.find((q) => q.destino === 'runner'); return { d: +Math.hypot(A.yo.p.x - P.pos.x, A.yo.p.z - P.pos.z).toFixed(1), gl: A.motor.pFinal.uniforms.uGlitch.value, hud: !!document.querySelector('.pk-hud.runner'), delirio: !!document.querySelector('canvas.delirio.on') }; });
prueba('salir te deja en la Zona de Juegos, frente a la puerta (y sin lo extremo)', r.d < 4 && r.gl === 0 && !r.hud && !r.delirio, JSON.stringify(r));

const errs = errores.filter((e) => !e.includes('ERR_FAILED') && !e.includes('net::'));
prueba('sin errores en la consola', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(`\n${bien} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
