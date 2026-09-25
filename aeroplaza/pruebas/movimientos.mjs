// LOS MOVIMIENTOS DE PARKOUR (jugador.js) con las teclas de verdad, en un piso
// plano de prueba (se vacía el mundo de la plaza y se ponen obstáculos):
// deslizarse corriendo (más rápido y bajito: pasa por debajo de una barra que
// parado no se pasa), deslizarse también caminando o quieto, saltar
// deslizándose sin perder velocidad, rodar si se aprieta en el aire, rodar solo
// al caer de alto corriendo, trepar un cajón a la altura
// del pecho saltando contra él, y rebotar en una pared. Y que el muñeco anime
// cada uno (estado y poses sin NaN) en los tres estilos.
//     node pruebas/movimientos.mjs
import { navegador, abrir } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja');
await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.reino.id === 'plaza' && window.__A.yo, null, { timeout: 120000, polling: 250 });
/* el arenero: piso plano en 0, sin nada, y cámara mirando a +z (W va para +z) */
await pag.evaluate(() => {
  const A = window.__A, W = A.reino.mundo;
  W.solidos.length = 0; W.interactivos.length = 0; W.altura = () => 0; W.agua = null; W.sinRejilla = true; W.limite = 1e4;
  A.reino.orbes = null; A.reino.discos = []; A.reino.zonaEn = null; A.reino.npcMallas = []; A.reino.monorriel = null;
  A.G.opciones.camAuto = false;
  window.__P = {
    en(x, z, y = 0) { A.yo.ponerEn(new A.THREE.Vector3(x, y, z), 0); A.cam.yaw = Math.PI; A.paso(1 / 30, false); },
    pasos(n, mirar) { const S = []; for (let i = 0; i < n; i++) { A.cam.yaw = Math.PI; A.paso(1 / 30, false); if (mirar) S.push(mirar()); } return S; },
    estado: () => A.yo.estado, vel: () => Math.hypot(A.yo.v.x, A.yo.v.z), p: () => A.yo.p.clone(),
  };
});
const teclas = async (abajo, fn) => { for (const k of abajo) await pag.keyboard.down(k); const r = await pag.evaluate(fn); for (const k of abajo) await pag.keyboard.up(k); await pag.evaluate(() => window.__P.pasos(1)); return r; };
const pulsar = async (k, n = 1) => { await pag.keyboard.down(k); await pag.evaluate((n) => window.__P.pasos(n), n); await pag.keyboard.up(k); };

/* 1. deslizarse corriendo: más rápido y bajito */
await pag.evaluate(() => window.__P.en(0, 0));
await pag.keyboard.down('KeyW'); await pag.keyboard.down('ShiftLeft');
let r = await pag.evaluate(() => { window.__P.pasos(40); return window.__P.vel(); });
await pulsar('KeyC', 2);
const desl = await pag.evaluate(() => { const P = window.__P, S = P.pasos(6, () => ({ e: P.estado(), v: P.vel(), m: window.__A.yo.m.estado })); return { antes: 0, S }; });
prueba('corriendo, C desliza (más rápido que corriendo)', desl.S.every((q) => q.e === 'desliza' && q.m === 'desliza') && desl.S[0].v > r + 0.5, `corriendo ${r.toFixed(1)} m/s → ${desl.S[0].v.toFixed(1)} m/s`);
r = await pag.evaluate(() => { const P = window.__P; P.pasos(30); return { e: P.estado(), v: P.vel() }; });
prueba('el deslizamiento se frena y termina', r.e !== 'desliza', JSON.stringify(r));
await pag.keyboard.up('KeyW'); await pag.keyboard.up('ShiftLeft');

/* 2. la barra baja: parado no se pasa, deslizándose sí */
await pag.evaluate(() => { const W = window.__A.reino.mundo; W.caja(0, 14, 3, 0.2, 0.85, 1.45); });
await pag.evaluate(() => window.__P.en(0, 2));
await pag.keyboard.down('KeyW'); await pag.keyboard.down('ShiftLeft');
r = await pag.evaluate(() => { window.__P.pasos(75); return window.__P.p().z; });
prueba('corriendo parado la barra baja frena', r < 14, `z ${r.toFixed(1)}`);
await pag.evaluate(() => window.__P.en(0, 2));
await pag.evaluate(() => window.__P.pasos(40));
await pulsar('KeyC', 2);
r = await pag.evaluate(() => { const P = window.__P, S = P.pasos(40, () => [P.p().z, P.estado()]); return { z: P.p().z, debajo: S.filter(([z]) => Math.abs(z - 14) < 0.4).map(([, e]) => e) }; });
prueba('deslizándose se pasa por debajo', r.z > 15 && r.debajo.every((e) => e === 'desliza'), `z ${r.z.toFixed(1)} · debajo: ${[...new Set(r.debajo)].join()}`);
await pag.keyboard.up('KeyW'); await pag.keyboard.up('ShiftLeft');
await pag.evaluate(() => { window.__A.reino.mundo.solidos.length = 0; });

/* 3. saltar deslizándose: sale con la velocidad del deslizamiento */
await pag.evaluate(() => window.__P.en(0, 0));
await pag.keyboard.down('KeyW'); await pag.keyboard.down('ShiftLeft');
await pag.evaluate(() => window.__P.pasos(40));
await pulsar('KeyC', 2);
await pulsar('Space', 2);
r = await pag.evaluate(() => ({ e: window.__P.estado(), v: window.__P.vel(), vy: window.__A.yo.v.y }));
prueba('saltar en el medio del deslizamiento sale rápido', r.e === 'salta' && r.v > 7.4 && r.vy > 3, JSON.stringify(r));
await pag.keyboard.up('KeyW'); await pag.keyboard.up('ShiftLeft');
await pag.evaluate(() => window.__P.pasos(40));

/* 4. caminando (sin correr) C también desliza: antes rodaba, y en el celu (sin » prendido) parecía que no andaba */
await pag.evaluate(() => window.__P.en(0, 0));
await pag.keyboard.down('KeyW');
await pag.evaluate(() => window.__P.pasos(10));
await pulsar('KeyC', 1);
r = await pag.evaluate(() => { const P = window.__P; return P.pasos(8, () => [P.estado(), P.vel()]); });
prueba('caminando, C desliza (siempre, no solo corriendo)', r.filter(([e]) => e === 'desliza').length >= 7 && r[0][1] > 6, r.map(([e, v]) => e + ' ' + v.toFixed(1)).slice(0, 3).join(' · '));
await pag.keyboard.up('KeyW');
await pag.evaluate(() => window.__P.pasos(30));
await pag.evaluate(() => window.__P.en(0, 0));
await pulsar('KeyC', 1);
r = await pag.evaluate(() => { const P = window.__P; return P.pasos(6, () => P.estado()); });
prueba('quieto, C también desliza (para donde mira)', r.filter((e) => e === 'desliza').length >= 5, r.join(','));
await pag.evaluate(() => window.__P.pasos(30));
/* 4b. C apretado en el aire con tiempo: rueda al caer (y da la vuelta); justo antes de tocar el piso: desliza */
await pag.evaluate(() => { window.__P.en(0, 0, 3.2); window.__A.yo.v.set(0, 0, 4); });
await pag.keyboard.down('KeyW');
await pulsar('KeyC', 1);
r = await pag.evaluate(() => { const P = window.__P, S = P.pasos(34, () => [P.estado(), window.__A.yo.m.cadera.rotation.x]); return { S: S.map(([e]) => e), giro: Math.max(...S.map(([, x]) => x)) }; });
prueba('C en el aire (con tiempo): rueda al caer y da la vuelta', r.S.includes('rueda') && r.giro > 4, [...new Set(r.S)].join(' → ') + ` · giro ${r.giro.toFixed(1)}`);
await pag.evaluate(() => window.__P.pasos(20));
await pag.evaluate(() => { window.__P.en(0, 0, 3.2); window.__A.yo.v.set(0, 0, 4); });
r = await pag.evaluate(() => { const P = window.__P; let k = 0; while (P.estado() !== 'cae' || window.__A.yo.p.y > 0.35) { P.pasos(1); if (++k > 90) break; } return k; });
await pulsar('KeyC', 1);
r = await pag.evaluate(() => { const P = window.__P; return P.pasos(10, () => P.estado()); });
prueba('C justo antes de tocar el piso: desliza al caer', r.includes('desliza') && !r.includes('rueda'), [...new Set(r)].join(' → '));
await pag.keyboard.up('KeyW');
await pag.evaluate(() => window.__P.pasos(30));
r = await pag.evaluate(() => ({ e: window.__P.estado(), x: window.__A.yo.m.cadera.rotation.x }));
prueba('y después queda derecho', r.e !== 'rueda' && r.e !== 'desliza' && Math.abs(r.x) < 0.5, JSON.stringify(r));

/* 5. caer de alto corriendo: rueda solo */
await pag.evaluate(() => { window.__P.en(0, 0, 9); window.__A.yo.v.set(0, 0, 6); });
await pag.keyboard.down('KeyW'); await pag.keyboard.down('ShiftLeft');
r = await pag.evaluate(() => { const P = window.__P; const S = P.pasos(40, () => P.estado()); return S; });
prueba('cayendo de 9 m corriendo, al tocar el piso rueda solo', r.includes('cae') && r.includes('rueda'), [...new Set(r)].join(' → '));
await pag.keyboard.up('KeyW'); await pag.keyboard.up('ShiftLeft');
await pag.evaluate(() => window.__P.pasos(20));

/* 6. trepar un cajón de 1,4 m saltando contra él */
await pag.evaluate(() => { const W = window.__A.reino.mundo; W.solidos.length = 0; W.caja(0, 6, 2, 1, -1, 1.4); window.__P.en(0, 2.5); });
await pag.keyboard.down('KeyW');
await pag.evaluate(() => window.__P.pasos(8));
await pulsar('Space', 2);
r = await pag.evaluate(() => { const P = window.__P, S = P.pasos(30, () => [P.estado(), P.p().y, P.p().z]); const i = S.findIndex(([e], k) => k > 0 && S[k - 1][0] === 'trepa' && e !== 'trepa'); return { S: [...new Set(S.map(([e]) => e))], y: i > 0 ? S[i][1] : null, z: i > 0 ? S[i][2] : null }; });
prueba('saltando contra un borde a la altura del pecho, lo trepa', r.S.includes('trepa') && Math.abs(r.y - 1.4) < 0.05 && r.z > 5, `${r.S.join(' → ')} · arriba en y ${r.y?.toFixed(2)}`);
await pag.keyboard.up('KeyW');

/* 7. rebote en la pared */
await pag.evaluate(() => { const W = window.__A.reino.mundo; W.solidos.length = 0; W.caja(0, 5, 3, 0.3, -1, 12); window.__P.en(0, 3.4); });
await pag.keyboard.down('KeyW');
await pag.evaluate(() => window.__P.pasos(4));
await pulsar('Space', 2);
await pag.evaluate(() => window.__P.pasos(6));
await pag.keyboard.up('KeyW');
await pulsar('Space', 2);
r = await pag.evaluate(() => ({ e: window.__P.estado(), vz: window.__A.yo.v.z, vy: window.__A.yo.v.y, ev: window.__A.yo.eventos.slice() }));
prueba('en el aire contra la pared, saltar rebota para atrás y arriba', r.e === 'pared' && r.vz < -3 && r.vy > 3, JSON.stringify(r));
await pag.evaluate(() => window.__P.pasos(40));

/* 7b. los del video de movimiento: la valla, subirse de un salto, subir la pared corriendo y correr por la pared */
const corrida = async (armar, desde, teclas, n, saltarEn = -1) => {
  await pag.evaluate(([armar, desde]) => { const W = window.__A.reino.mundo; W.solidos.length = 0; for (const c of armar) W.caja(...c); window.__P.en(...desde); }, [armar, desde]);
  for (const k of teclas) await pag.keyboard.down(k);
  const S = [];
  for (let i = 0; i < n; i++) { if (i === saltarEn) await pag.keyboard.down('Space'); if (i === saltarEn + 2) await pag.keyboard.up('Space'); S.push(await pag.evaluate(() => { const P = window.__P; P.pasos(1); const p = P.p(); return [P.estado(), +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]; })); }
  for (const k of teclas) await pag.keyboard.up(k);
  await pag.evaluate(() => window.__P.pasos(30));
  return S;
};
let S = await corrida([[0, 8, 3, 0.2, -1, 0.9]], [0, 3], ['KeyW', 'ShiftLeft'], 40);
prueba('corriendo contra una valla a la cintura, la salta', S.some(([e]) => e === 'valla') && S[S.length - 1][3] > 9.5, [...new Set(S.map(([e]) => e))].join(' → ') + ' · z ' + S[S.length - 1][3]);
S = await corrida([[0, 12, 3, 4, -1, 1.0]], [0, 3], ['KeyW', 'ShiftLeft'], 50);
prueba('contra una plataforma a la cintura, se sube de un salto', S.some(([e]) => e === 'valla') && Math.abs(S[S.length - 1][2] - 1.0) < 0.05, [...new Set(S.map(([e]) => e))].join(' → ') + ' · y ' + S[S.length - 1][2]);
S = await corrida([[0, 12, 4, 4, -1, 3.2]], [0, 4.4], ['KeyW', 'ShiftLeft'], 50, 8);
prueba('saltando contra una pared de 3,2 m, la sube corriendo y trepa', S.some(([e]) => e === 'subePared') && S.some(([e]) => e === 'trepa') && Math.abs(S[S.length - 1][2] - 3.2) < 0.05, [...new Set(S.map(([e]) => e))].join(' → ') + ' · y ' + S[S.length - 1][2]);
/* para qué lado va D (según la cámara del arenero) */
await pag.evaluate(() => { window.__A.reino.mundo.solidos.length = 0; window.__P.en(0, 0); });
await pag.keyboard.down('KeyD'); const lado = await pag.evaluate(() => { window.__P.pasos(6); return Math.sign(window.__A.yo.v.x); }); await pag.keyboard.up('KeyD'); await pag.evaluate(() => window.__P.pasos(20));
S = await corrida([[lado * 1.6, 14, 0.3, 14, -1, 6]], [lado * 0.9, 0], ['KeyW', 'ShiftLeft', 'KeyD'], 50, 12);
const enPared = S.filter(([e]) => e === 'corrPared');
const bajo = enPared.length ? enPared[0][2] - Math.min(...enPared.map(([, , y]) => y)) : 9, anduvo = enPared.length ? enPared[enPared.length - 1][3] - enPared[0][3] : 0;
prueba('saltando pegado a una pared, corre por ella (casi sin caer)', enPared.length >= 12 && bajo < 1.5 && anduvo > 5, `${enPared.length} cuadros · anduvo ${anduvo.toFixed(1)} m · bajó ${bajo.toFixed(2)} m`);
await pag.evaluate(() => { window.__A.reino.mundo.solidos.length = 0; });

/* 8. las poses en los tres estilos: sin NaN, y chop va a saltos */
r = await pag.evaluate(() => {
  const A = window.__A, m = A.yo.m, S = {};
  for (const estilo of ['suave', 'lineal', 'chop']) {
    A.J.ponerAnim(estilo);
    let nan = false; const xs = [];
    for (const e of ['corre', 'salta', 'cae', 'desliza', 'rueda', 'trepa', 'pared', 'valla', 'subePared', 'corrPared', 'camina', 'quieto']) for (let i = 0; i < 20; i++) { m.animar(1 / 60, e, 6); const q = [m.cadera.rotation.x, m.cadera.position.y, ...m.brazos.map((b) => b.rotation.x), ...m.piernas.map((b) => b.rotation.x)]; if (q.some((v) => !Number.isFinite(v))) nan = true; if (e === 'corre') xs.push(m.piernas[0].rotation.x); }
    const distintos = new Set(xs.map((v) => v.toFixed(4))).size;
    S[estilo] = { nan, distintos };
  }
  A.J.ponerAnim('suave');
  return S;
});
prueba('las poses no dan NaN en ningún estilo', !r.suave.nan && !r.lineal.nan && !r.chop.nan, JSON.stringify(r));
prueba('chop va a saltos (menos poses distintas que suave)', r.chop.distintos < r.suave.distintos * 0.75, `suave ${r.suave.distintos} · lineal ${r.lineal.distintos} · chop ${r.chop.distintos}`);
/* 9. deslizar cuando uno quiere: mantener C sigue, soltar y volver a apretar desliza de nuevo, y el botón del dedo se suelta */
await pag.evaluate(() => { window.__A.reino.mundo.solidos.length = 0; window.__P.en(0, 0); });
await pag.keyboard.down('KeyW'); await pag.keyboard.down('ShiftLeft');
await pag.evaluate(() => window.__P.pasos(40));
await pag.keyboard.down('KeyC');
r = await pag.evaluate(() => { const P = window.__P; return P.pasos(40, () => P.estado()); });
await pag.keyboard.up('KeyC');
const largo = r.findIndex((e) => e !== 'desliza');
prueba('manteniendo C sigue deslizando más de 1 s', r.slice(0, 34).every((e) => e === 'desliza'), `${largo < 0 ? r.length : largo} cuadros deslizando`);
await pag.evaluate(() => window.__P.pasos(20));
r = await pag.evaluate(() => window.__P.estado());
await pulsar('KeyC', 2);
const otra = await pag.evaluate(() => { const P = window.__P; return P.pasos(4, () => P.estado()); });
prueba('soltar y volver a apretar C desliza de nuevo', r !== 'desliza' && otra.every((e) => e === 'desliza'), `${r} → ${otra.join()}`);
await pag.evaluate(() => window.__P.pasos(40));
const dedoBaja = async (tipo) => pag.evaluate((tipo) => { const b = document.querySelector('#dedos [data-b=baja]'); if (!b) return 'sin botón'; b.dispatchEvent(new PointerEvent(tipo, { pointerType: 'touch', pointerId: 7, bubbles: true, cancelable: true, clientX: 50, clientY: 400 })); return b.classList.contains('apretado'); }, tipo);
const toques = [];
for (let i = 0; i < 3; i++) {
  const ap = await dedoBaja('pointerdown');
  const S = await pag.evaluate(() => { const P = window.__P; return P.pasos(4, () => P.estado()); });
  const su = await dedoBaja('pointerup');
  await pag.evaluate(() => window.__P.pasos(45));
  toques.push({ ap, su, e: S[S.length - 1], despues: await pag.evaluate(() => window.__P.estado()) });
}
prueba('el botón ⤓ del dedo desliza cada vez y se suelta', toques.every((t) => t.ap === true && t.su === false && t.e === 'desliza' && t.despues !== 'desliza'), JSON.stringify(toques));
await pag.keyboard.up('KeyW'); await pag.keyboard.up('ShiftLeft');
const e = errores.filter((x) => !x.includes('ERR_FAILED'));
if (e.length) { mal++; console.log('✗ errores:', [...new Set(e)].join(' | ')); }
await ctx.close(); await nav.close();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
