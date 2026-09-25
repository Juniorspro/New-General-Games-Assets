// LA ZONA DE JUEGOS (reinos/juegos.js): que estén las puertas (más de 10) y
// lleven a cada lugar, que se pueda jugar a cada juego de mesa contra la compu
// hasta el final, y que anden la pelota (gol), el aro, los bolos, los
// trampolines, las hamacas, el tobogán y la pista de baile. Sin errores.
//     node pruebas/juegos.mjs
import { navegador, abrir, avanzar } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, errores } = await abrir(nav, 'directo&pausa&calidad=baja&reino=juegos', { ancho: 800, alto: 450 });
await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.reino.id === 'juegos' && window.__A.yo, null, { timeout: 120000, polling: 250 });
await avanzar(pag, 10);
await pag.evaluate(() => {
  const A = window.__A;
  window.__P = {
    pasos(n) { for (let i = 0; i < n; i++) A.paso(1 / 30, false); },
    en(x, z, rumbo = 0) { const R = A.reino; A.yo.ponerEn(new A.THREE.Vector3(x, R.mundo.altura(x, z) + 0.05, z), rumbo); A.yo.v.set(0, 0, 0); A.paso(1 / 30, false); },
  };
});

/* 1. las puertas */
let r = await pag.evaluate(() => {
  const R = window.__A.reino, its = R.mundo.interactivos.filter((o) => o.accion === 'portal');
  return { n: R.portales.length, its: its.length, destinos: [...new Set(its.map((o) => o.destino))] };
});
prueba('hay más de 10 puertas en la plaza de las puertas', r.its >= 11, `${r.its} puertas · ${r.destinos.join(', ')}`);
prueba('hay puertas al parkour, al tiro, al runner y a la isla', ['parkour', 'tiro', 'runner', 'isla'].every((d) => r.destinos.includes(d)));
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, out = [];
  for (const [k, L] of Object.entries(R.llegadas)) {
    A.yo.ponerEn(R.inicio.clone(), 0); window.__P.pasos(2);
    A.interactuar({ accion: 'portal', destino: k }); window.__P.pasos(3);
    const d = Math.hypot(A.yo.p.x - L.p.x, A.yo.p.z - L.p.z), z = R.zonaEn(A.yo.p.x, A.yo.p.z);
    out.push({ k, d: +d.toFixed(2), zona: z && z.id });
    A.interactuar({ accion: 'portal', destino: 'centro' }); window.__P.pasos(3);
    out[out.length - 1].vuelve = +Math.hypot(A.yo.p.x - R.inicio.x, A.yo.p.z - R.inicio.z).toFixed(2);
  }
  return out;
});
prueba('cada puerta lleva a su lugar (y a su zona)', r.length >= 7 && r.every((q) => q.d < 2 && q.zona && q.zona !== 'jc'), r.map((q) => `${q.k}:${q.zona}`).join(' '));
prueba('la puerta "al centro" vuelve a la plaza de las puertas', r.every((q) => q.vuelve < 2));
/* la vuelta tiene su puerta al lado, no en la cara */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, out = [];
  const vueltas = R.mundo.interactivos.filter((o) => o.accion === 'portal' && o.destino === 'centro');
  for (const L of Object.values(R.llegadas)) {
    const f = [Math.sin(L.rumbo), Math.cos(L.rumbo)];
    const tapa = vueltas.some((o) => { const dx = o.pos.x - L.p.x, dz = o.pos.z - L.p.z, adelante = dx * f[0] + dz * f[1], costado = Math.abs(dx * f[1] - dz * f[0]); return adelante > -1 && adelante < 6 && costado < 2.2 || Math.hypot(dx, dz) < o.radio; });
    out.push(tapa);
  }
  return out;
});
prueba('al llegar no se tiene una puerta delante ni encima', r.every((x) => !x), `${r.filter(Boolean).length} tapadas`);

/* quedarse en una zona no manda avisos (spameaba "Nueva zona" dos veces por segundo) */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, U = A.UI, L = R.llegadas.mesas; let n = 0;
  const orig = U.notificar.bind(U); U.notificar = (o) => { n++; return orig(o); };
  A.yo.ponerEn(L.p.clone(), L.rumbo); window.__P.pasos(30); const n0 = n;
  for (let i = 0; i < 300; i++) A.paso(1 / 30, false);
  U.notificar = orig; return { entrar: n0, quieto: n - n0 };
});
prueba('quedarse 10 s en una zona no manda avisos', r.quieto === 0 && r.entrar <= 1, JSON.stringify(r));

/* 2. las mesas: sentarse y jugar contra la compu hasta que alguien gane (o empate) */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, Ms = R.mesas, out = {};
  for (const M of Ms.lista) {
    if (out[M.juego]) continue;
    A.interactuar({ accion: 'mesa', mesa: M.i, silla: 0 });
    const panel = !!document.querySelector('.panel-mesa');
    const Rg = Ms.reglas[M.juego];
    let n = 0, fin = null;
    while (n++ < 9000 && !(fin = Rg.ganador(M.S))) {
      /* si me toca, juego la primera jugada que haya */
      const toca = M.juego === 'ppt' ? M.S.e[0] == null : M.S.turno === 0 && !(M.juego === 'memo' && M.S.abiertas.length === 2);
      if (toca) {
        const js = M.juego === 'ppt' ? [{ q: 0, e: n % 3 }] : Rg.jugadas(M.S);
        if (js.length) Ms.jugarMia(M, js[0]);
      }
      A.paso(1 / 30, false);
    }
    out[M.juego] = { panel, sentado: A.J.sentado, fin: fin && fin.g, jugadas: M.S.n, cuadros: n };
    Ms.levantar(A.J); A.J.levantarse();
  }
  out.cerrado = !document.querySelector('.panel-mesa');
  return out;
});
for (const k of ['damas', 'tateti', 'cuatro', 'memo', 'ppt']) {
  const q = r[k];
  prueba(`mesa de ${k}: sentarse abre el tablero y se juega hasta el final`, q && q.panel && q.sentado && q.fin != null, q ? `ganó ${q.fin} en ${q.jugadas} jugadas` : 'no está');
}
prueba('levantarse cierra el tablero', r.cerrado);
/* las reglas: partidas al azar sin romperse (y siempre terminan) */
r = await pag.evaluate(() => {
  const Ms = window.__A.reino.mesas, out = {};
  let s = 7; const az = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const [k, Rg] of Object.entries(Ms.reglas)) {
    let ok = 0;
    for (let p = 0; p < 30; p++) {
      let S = Rg.nuevo(p + 1), n = 0;
      while (!Rg.ganador(S) && n++ < 600) {
        if (k === 'ppt') { S = Rg.jugar(S, { q: 0, e: Math.floor(az() * 3) }); S = Rg.jugar(S, { q: 1, e: Rg.compu(S, az) }); continue; }
        if (k === 'memo' && S.abiertas.length === 2) { S = Rg.resolver(S); continue; }
        const js = Rg.jugadas(S); if (!js.length) break;
        S = Rg.jugar(S, js[Math.floor(az() * js.length)]);
      }
      if (Rg.ganador(S)) ok++;
    }
    out[k] = ok;
  }
  return out;
});
prueba('las reglas de los cinco juegos terminan siempre (30 partidas al azar c/u)', Object.values(r).every((n) => n === 30), JSON.stringify(r));

/* 3. la canchita: patear la pelota al arco es gol */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, P = R.pelota, antes = P.marcador.slice();
  /* la pelota a 4 m del arco de +x, y el muñeco detrás mirando al arco */
  const { cx, cz, LX } = R.CANCHA;
  P.tGol = 0; P.p.set(cx + LX - 4, R.PISO + 0.3, cz); P.v.set(0, 0, 0);
  A.yo.ponerEn(new A.THREE.Vector3(cx + LX - 4.8, R.PISO + 0.05, cz), Math.PI / 2); window.__P.pasos(1);
  R.patear(A.yo, A.J);
  let gol = false; for (let i = 0; i < 90 && !gol; i++) { window.__P.pasos(1); gol = P.marcador[0] + P.marcador[1] > antes[0] + antes[1]; }
  return { gol, marcador: P.marcador.join('-') };
});
prueba('patear la pelota al arco es gol (y suma al marcador)', r.gol, r.marcador);
/* correr contra la pelota la empuja */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, P = R.pelota;
  window.__P.pasos(60);
  const x = P.p.x, z = P.p.z;
  P.v.set(0, 0, 0); P.tToque = 0;
  A.yo.ponerEn(new A.THREE.Vector3(x - 0.6, R.PISO + 0.05, z), Math.PI / 2); A.yo.v.set(6, 0, 0);
  window.__P.pasos(2);
  return { v: +Math.hypot(P.v.x, P.v.z).toFixed(1) };
});
prueba('correr contra la pelota la empuja', r.v > 2, `${r.v} m/s`);

/* 4. básquet: de cerca, mirando al aro, alguna entra */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, B = R.basquet, ARO = R.ARO;
  let metidas = 0;
  for (let i = 0; i < 12; i++) {
    A.yo.ponerEn(new A.THREE.Vector3(ARO.x - 2, R.PISO + 0.05, ARO.z), Math.PI / 2); window.__P.pasos(1);
    const antes = B.racha;
    R.tirarAro(A.yo, A.J);
    for (let k = 0; k < 110 && B.vuela; k++) window.__P.pasos(1);
    if (B.racha > antes) metidas++;
  }
  return { metidas };
});
prueba('básquet: tirando de cerca, entran', r.metidas >= 3, `${r.metidas}/12`);

/* 5. bolos: la bola voltea pinos y se cuentan */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, B = R.bolos[0];
  A.yo.ponerEn(new A.THREE.Vector3(B.x0 + 1.2, R.PISO + 0.05, B.z), -Math.PI / 2); window.__P.pasos(1);
  R.tirarBolos(A.yo, A.J, 0);
  const salio = !!B.tira;
  let caidos = 0;
  for (let k = 0; k < 150 && B.tira; k++) { window.__P.pasos(1); caidos = Math.max(caidos, B.pinos.filter((q) => q.caida > 0 || q.fuera).length); }
  return { salio, caidos, termino: !B.tira, tiro: B.tiro };
});
prueba('bolos: la bola rueda, voltea pinos y el tiro termina', r.salio && r.caidos > 0 && r.termino, `${r.caidos} pinos · tiro ${r.tiro}`);

/* 6. trampolines: caer encima rebota alto y cuenta los rebotes */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, T = R.tramp[0];
  A.yo.ponerEn(new A.THREE.Vector3(T.x, R.PISO + 3, T.z), 0); R.saltosTramp = 0;
  let alto = 0; for (let k = 0; k < 150; k++) { window.__P.pasos(1); alto = Math.max(alto, A.yo.p.y - R.PISO); }
  return { alto: +alto.toFixed(1), n: R.saltosTramp };
});
prueba('el trampolín gigante rebota alto y cuenta los rebotes', r.alto > 8 && r.n >= 2, `${r.alto} m · ${r.n} rebotes`);

/* 7. hamacas: subirse, que se hamaque y bajarse */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, H = R.hamacas[0];
  A.yo.ponerEn(new A.THREE.Vector3(H.px, R.PISO + 0.05, H.pz + 1), Math.PI); window.__P.pasos(1);
  A.interactuar({ accion: 'hamaca', hamaca: 0 });
  const subido = A.yo.modo !== 'pie' && H.jinete != null;
  let amp = 0; for (let k = 0; k < 240; k++) { window.__P.pasos(1); amp = Math.max(amp, Math.abs(H.ang)); }
  const pose = A.yo.m.estado;
  return { subido, amp: +amp.toFixed(2), pose, modo: A.yo.modo };
});
prueba('hamaca: te subís y se hamaca sola un poco', r.subido && r.amp > 0.1, `${r.amp} rad · muñeco "${r.pose}"`);
await pag.keyboard.down('KeyW');
r = await pag.evaluate(() => { const A = window.__A, H = A.reino.hamacas[0], a0 = []; for (let k = 0; k < 240; k++) { window.__P.pasos(1); a0.push(Math.abs(H.ang)); } return { amp: +Math.max(...a0.slice(120)).toFixed(2) }; });
await pag.keyboard.up('KeyW');
prueba('hamaca: moviendo el palito se hamaca más alto', r.amp > 0.35, `${r.amp} rad`);
await pag.keyboard.down('KeyE');
r = await pag.evaluate(() => { window.__P.pasos(2); return 0; });
await pag.keyboard.up('KeyE');
r = await pag.evaluate(() => { window.__P.pasos(30); const A = window.__A; return { modo: A.yo.modo, jinete: A.reino.hamacas[0].jinete != null }; });
prueba('hamaca: con E te bajás', r.modo === 'pie' && !r.jinete, r.modo);

/* 8. el tobogán: arriba de la rampa se baja solo, deslizándose */
r = await pag.evaluate(() => {
  const A = window.__A, R = A.reino, M = R.RAMPA;
  A.yo.ponerEn(new A.THREE.Vector3(M.x0 + 0.4, M.y0 + 0.05, M.z), Math.PI / 2); window.__P.pasos(2);
  const S = []; for (let k = 0; k < 60; k++) { window.__P.pasos(1); S.push({ x: A.yo.p.x, e: A.yo.estado }); }
  return { baja: +(S[S.length - 1].x - (M.x0 + 0.4)).toFixed(1), desliza: S.filter((q) => q.e === 'desliza').length };
});
prueba('el tobogán te baja deslizando', r.baja > 5 && r.desliza > 10, `${r.baja} m · ${r.desliza} cuadros deslizando`);

/* 9. la pista de baile: E baila (y cambia de baile) */
r = await pag.evaluate(() => {
  const A = window.__A, g = [];
  for (let i = 0; i < 3; i++) { A.interactuar({ accion: 'baile' }); window.__P.pasos(2); g.push(A.yo.m.gesto?.nombre || A.J.gestoActual || A.yo.m.gesto); }
  return g.map((x) => typeof x === 'string' ? x : JSON.stringify(x));
});
prueba('en la pista de baile, E baila', r.every((x) => /bailar/.test(x)) && new Set(r).size === 3, r.join(', '));

/* 10. la puerta del runner lleva al runner (y su ✕ vuelve delante de la puerta) */
await pag.evaluate(() => window.__A.interactuar({ accion: 'portal', destino: 'runner' }));
await pag.waitForFunction(() => window.__A.reino.id === 'runner', null, { timeout: 20000, polling: 100 });
await pag.waitForTimeout(1400); await avanzar(pag, 3);
r = await pag.evaluate(() => ({ id: window.__A.reino.id, hud: !!document.querySelector('.pk-hud.runner') }));
prueba('la puerta del runner lleva al runner', r.id === 'runner' && r.hud);
await pag.evaluate(() => window.__A.J.runnerSalir());
await pag.waitForFunction(() => window.__A.reino.id === 'juegos', null, { timeout: 20000, polling: 100 });
await pag.waitForTimeout(1400); await avanzar(pag, 3);
r = await pag.evaluate(() => { const A = window.__A, P = A.reino.portales.find((q) => q.destino === 'runner'); return +Math.hypot(A.yo.p.x - P.pos.x, A.yo.p.z - P.pos.z).toFixed(1); });
prueba('y al salir volvés delante de esa puerta', r < 4, `${r} m`);

/* 11. se dibuja todo y no hay errores */
await avanzar(pag, 4);
const errs = errores.filter((e) => !e.includes('ERR_FAILED') && !e.includes('net::'));
prueba('sin errores en la consola', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(`\n${bien} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
