// INTERIORES: los edificios que se entran en primera persona (interior.js).
// Desde la isla se llega caminando a las 8 puertas (5 hoteles, el café del
// pabellón y 2 casas del barrio); adentro: la cámara en los ojos, el punto que
// apunta, las cosas que se usan, el ascensor de vidrio (planta baja → suite →
// azotea → planta baja), la pileta que se sale caminando, sentarse, charlar
// con la gente de adentro, leer un libro, y salir de vuelta a la isla.
//     node pruebas/interiores.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=media&hora=0.3');
await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.reino.id === 'plaza' && window.__A.yo, null, { timeout: 120000, polling: 250 });
await avanzar(pag, 5);
const foto = async (n) => { await pag.addStyleTag({ content: '.tuto{display:none!important}' }); await avanzar(pag, 2); await pag.screenshot({ path: path.join(SAL, `interior-${n}.png`) }); };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* lo que usan todas: pasos, apretar usar, pararse en un lugar, apuntar a algo y caminar */
await pag.evaluate(() => {
  const A = window.__A, V = (x, y, z) => new A.THREE.Vector3(x, y, z);
  window.__T = {
    pasos(n) { for (let i = 0; i < n; i++) A.paso(1 / 30, false); },
    usar() { A.J.ent.dedo.accion = true; A.paso(1 / 30, false); },
    parar(x, y, z) { A.yo.ponerEn(V(x, y, z), 0); A.paso(1 / 30, false); },
    /* busca lo que se usa por su texto (el primero, o el n-ésimo) */
    buscar(txt, n = 0) { return A.reino.accionables.filter((a) => a.texto().includes(txt))[n]; },
    /* apunta el punto al medio de la cosa y dice si quedó apuntada */
    apuntar(a) {
      const c = new A.THREE.Box3().setFromObject(a.obj).getCenter(V(0, 0, 0)), ojo = A.yo.p.clone(); ojo.y += 1.5 * A.yo.escala;
      const dx = c.x - ojo.x, dz = c.z - ojo.z, dy = c.y - ojo.y;
      A.cam.yaw = Math.atan2(-dx, -dz); A.cam.pitch = 0.3 - Math.atan2(dy, Math.hypot(dx, dz));
      A.paso(1 / 30, false); A.paso(1 / 30, false);
      return A.cerca && A.cerca.accion === 'accionar' && A.cerca.a === a;
    },
    /* camina hacia (x, z) hasta s segundos o hasta que aparezca la acción pedida */
    caminar(x, z, s = 3, accion = null) {
      for (let i = 0; i < s * 30; i++) {
        const dx = x - A.yo.p.x, dz = z - A.yo.p.z; if (Math.hypot(dx, dz) < 0.3) break;
        A.cam.yaw = Math.atan2(-dx, -dz);
        A.paso(1 / 30, false);
        if (accion && A.cerca?.accion === accion) return true;
      }
      return accion ? A.cerca?.accion === accion : true;
    },
  };
});
/* caminar con la W apretada de verdad */
const caminar = async (x, z, s = 3, accion = null) => { await pag.keyboard.down('KeyW'); const r = await pag.evaluate(([x, z, s, a]) => window.__T.caminar(x, z, s, a), [x, z, s, accion]); await pag.keyboard.up('KeyW'); await pag.evaluate(() => window.__T.pasos(2)); return r; };

/* ---------------------------------------------------- las 8 puertas se alcanzan caminando */
const puertas = await pag.evaluate(() => window.__A.reino.mundo.interactivos.filter((o) => o.accion === 'entrar').map((o) => ({ id: o.id, x: o.pos.x, y: o.pos.y, z: o.pos.z, sx: o.salida.x, sy: o.salida.y, sz: o.salida.z })));
prueba('hay 8 puertas para entrar (5 hoteles, el café y 2 casas)', puertas.length === 8, puertas.map((p) => p.id).join(' '));
let alcanzadas = 0;
for (const P of puertas) {
  await pag.evaluate(([x, y, z]) => window.__T.parar(x, y, z), [P.sx, P.sy, P.sz]);
  const ok = await caminar(P.x, P.z, 4, 'entrar');
  const id = await pag.evaluate(() => window.__A.cerca?.id);
  if (ok && id === P.id) alcanzadas++; else console.log('   no se llega a', P.id, id);
}
prueba('se llega caminando a todas las puertas (desde donde se sale)', alcanzadas === puertas.length, `${alcanzadas}/${puertas.length}`);

/* ---------------------------------------------------- entrar al hotel apretando usar */
const hotel = puertas.find((p) => p.id === 'entrar-hotel0');
await pag.evaluate(([x, y, z]) => window.__T.parar(x, y, z), [hotel.sx, hotel.sy, hotel.sz]);
await caminar(hotel.x, hotel.z, 4, 'entrar');
await foto('0-puerta-hotel');
const etiqueta = await pag.evaluate(() => document.querySelector('.aviso-accion')?.textContent || '');
prueba('el cartel de la puerta dice qué es', /hotel/i.test(etiqueta), etiqueta.trim());
await pag.evaluate(() => window.__T.usar());
await esperar(2600);
await pag.evaluate(() => window.__T.pasos(10));
let r = await pag.evaluate(() => { const A = window.__A; return { id: A.reino.id, tipo: A.reino.tipo, fp: A.cam.fp, visible: !A.yo.m.enPrimera, mira: !!document.querySelector('.mira'), fov: A.motor.camara.fov, sala: A.red.sala || '' }; });
prueba('adentro del hotel, en primera persona, sin el muñeco propio y con el punto', r.id === 'interior' && r.tipo === 'hotel' && r.fp && !r.visible && r.mira, JSON.stringify(r));
await pag.evaluate(() => { window.__A.cam.yaw = 0; window.__A.cam.pitch = 0.32; });
await foto('1-lobby');
r = await pag.evaluate(() => { const A = window.__A, I = A.motor.r.info; I.autoReset = false; I.reset(); A.motor.dibujar(0); const q = { calls: I.render.calls, tri: I.render.triangles }; I.autoReset = true; return q; });
console.log('   lobby:', r.calls, 'dibujos,', (r.tri / 1e3).toFixed(0), 'mil triángulos');

/* el timbre llama a Perla (charla) */
r = await pag.evaluate(() => { const T = window.__T, A = window.__A; T.parar(-3.6, 0.02, -2.2); const a = T.buscar('timbre'); const ok = T.apuntar(a); const txt = document.querySelector('.aviso-accion')?.textContent; const apunta = document.querySelector('.mira')?.classList.contains('apunta'); T.usar(); return { ok, txt, apunta, dialogo: !!document.querySelector('.dialogo') }; });
prueba('apuntando al timbre se ve "Tocar el timbre", el punto brilla y sale Perla', r.ok && /timbre/i.test(r.txt) && r.apunta && r.dialogo, JSON.stringify(r));
await foto('2-perla');
for (let i = 0; i < 8; i++) { const d = await pag.$('.dialogo'); if (!d) break; await d.click(); await esperar(120); }
prueba('la charla se cierra', !(await pag.$('.dialogo')));

/* el piano suena, los peces cambian de rumbo, las noticias */
r = await pag.evaluate(() => {
  const T = window.__T, A = window.__A, R = {};
  T.parar(7.2, 0.02, -5.2); const p = T.buscar('piano'); R.piano = T.apuntar(p); T.usar();
  T.parar(0, 0.02, 4.3); const q = T.buscar('peces'); R.peces = T.apuntar(q); T.usar();
  T.parar(-9, 0.02, 3); const n = T.buscar('noticias'); R.noticias = T.apuntar(n);
  /* mirando al piso de lejos no hay nada: el punto queda chico */
  T.parar(-2, 0.02, 6); A.cam.yaw = Math.PI / 2; A.cam.pitch = 1.2; T.pasos(2); R.nada = A.cerca?.accion !== 'accionar' && !document.querySelector('.mira').classList.contains('apunta');
  return R;
});
prueba('se apunta al piano, a la columna de peces y a la pantalla de noticias', r.piano && r.peces && r.noticias, JSON.stringify(r));
prueba('mirando a la nada el punto no se prende', r.nada);

/* ---------------------------------------------------- el ascensor: planta baja → suite */
r = await pag.evaluate(() => {
  const T = window.__T, A = window.__A, S = A.reino.ascensor, R = {};
  R.piso0 = S.piso; R.abierta = S.fase;
  T.parar(-0.4, 0.02, -8.35);
  const b = T.buscar('⬆', 1); R.apunta = T.apuntar(b); T.usar();
  R.destino = S.destino;
  const ys = []; for (let i = 0; i < 260; i++) { A.paso(1 / 30, false); if (i % 20 === 0) ys.push(+A.yo.p.y.toFixed(1)); }
  R.ys = ys; R.piso = S.piso; R.y = +A.yo.p.y.toFixed(2); R.fase = S.fase;
  return R;
});
prueba('el botón del tablero pide el piso', r.apunta && r.destino === 1, JSON.stringify({ apunta: r.apunta, destino: r.destino }));
prueba('el ascensor sube con el jugador adentro hasta la suite', r.piso === 1 && Math.abs(r.y - 24) < 0.1 && r.fase === 'abierta', r.ys.join(' → '));
const avisos = await pag.evaluate(() => window.__A.UI.historial.slice(-4).join(' | '));
prueba('avisa que llegó', /Llegaste|Suite/i.test(avisos), avisos.slice(0, 120));
const sale1 = await caminar(0, -4.5, 2);
r = await pag.evaluate(() => ({ y: +window.__A.yo.p.y.toFixed(2), z: +window.__A.yo.p.z.toFixed(2) }));
prueba('se sale caminando del ascensor a la suite', sale1 && r.y > 23.9 && r.z > -6, JSON.stringify(r));
await pag.evaluate(() => { window.__A.cam.yaw = Math.PI * 0.25; window.__A.cam.pitch = 0.36; });
await foto('3-suite');

/* la suite: tele, lámpara, heladera (jugo liviano) y jacuzzi */
r = await pag.evaluate(() => {
  const T = window.__T, A = window.__A, R = {}, Y = 24.02;
  T.parar(-8, Y, 1.4); const tv = T.buscar('tele'); R.tele = T.apuntar(tv); const antes = tv.texto(); T.usar(); R.teleCambia = tv.texto() !== antes;
  T.parar(-9.6, Y, -7); R.lampara = T.apuntar(T.buscar('luz')); T.usar();
  T.parar(11.8, Y, -7.1); R.heladera = T.apuntar(T.buscar('heladera')); T.usar(); R.liviano = A.yo.efecto === 'liviano';
  T.parar(-6.8, Y, 6.8); R.jacuzzi = T.apuntar(T.buscar('burbujas')); T.usar();
  return R;
});
prueba('en la suite se usan la tele, la lámpara, la heladera y el jacuzzi', r.tele && r.teleCambia && r.lampara && r.heladera && r.jacuzzi, JSON.stringify(r));
prueba('el jugo de la heladera te pone liviano', r.liviano);
await pag.evaluate(() => { const A = window.__A; A.yo.ponerEfecto && (A.yo.efecto = null); window.__T.parar(-3.5, 24.02, 4.5); A.cam.yaw = -2.3; A.cam.pitch = 0.4; window.__T.pasos(30); });
await foto('4-jacuzzi');

/* suite → azotea */
r = await pag.evaluate(() => {
  const T = window.__T, A = window.__A, S = A.reino.ascensor;
  T.parar(-0.4, 24.02, -8.35); const ok = T.apuntar(T.buscar('⬆', 2)); T.usar();
  for (let i = 0; i < 300; i++) A.paso(1 / 30, false);
  return { ok, piso: S.piso, y: +A.yo.p.y.toFixed(2) };
});
prueba('de la suite a la azotea', r.ok && r.piso === 2 && Math.abs(r.y - 48) < 0.1, JSON.stringify(r));
await caminar(0, -4, 2);
await pag.evaluate(() => { window.__A.cam.yaw = Math.PI * 0.8; window.__A.cam.pitch = 0.42; });
await foto('5-azotea');
r = await pag.evaluate(() => {
  const T = window.__T, A = window.__A, R = {}, Y = 48.02;
  T.parar(9.4, Y, 0); R.telescopio = T.apuntar(T.buscar('telescopio')); T.usar(); T.pasos(30); R.fov = +A.motor.camara.fov.toFixed(1);
  T.pasos(200); R.fovDespues = +A.motor.camara.fov.toFixed(1);
  T.parar(-5.1, Y, -5); R.bar = T.apuntar(T.buscar('licuado'));
  /* la pileta: se baja 40 cm */
  T.parar(6, Y + 0.2, 2); T.pasos(20); R.enPileta = +A.yo.p.y.toFixed(2);
  return R;
});
prueba('el telescopio cierra la vista y después vuelve', r.telescopio && r.fov < 30 && r.fovDespues > 60, `${r.fov}° → ${r.fovDespues}°`);
prueba('el bar de licuados se apunta', r.bar);
prueba('adentro de la pileta se está 40 cm más abajo', Math.abs(r.enPileta - 47.6) < 0.05, String(r.enPileta));
await pag.evaluate(() => { const A = window.__A; A.cam.yaw = -Math.PI / 2; A.cam.pitch = 0.5; });
await foto('6-pileta');
await caminar(1.5, 2, 2);
r = await pag.evaluate(() => ({ y: +window.__A.yo.p.y.toFixed(2), x: +window.__A.yo.p.x.toFixed(2) }));
prueba('de la pileta se sale caminando', r.y > 47.95 && r.x < 3, JSON.stringify(r));

/* azotea → planta baja y salir a la isla */
r = await pag.evaluate(() => {
  const T = window.__T, A = window.__A, S = A.reino.ascensor;
  T.parar(0, 48.02, -5.4); const llama = T.apuntar(T.buscar('Llamar', 2));
  T.parar(-0.4, 48.02, -8.35); const ok = T.apuntar(T.buscar('⬆', 0)); T.usar();
  for (let i = 0; i < 330; i++) A.paso(1 / 30, false);
  return { llama, ok, piso: S.piso, y: +A.yo.p.y.toFixed(2) };
});
prueba('el botón de llamar está en cada piso y se baja a planta baja', r.ok && r.piso === 0 && Math.abs(r.y) < 0.1, JSON.stringify(r));
const salir = await caminar(0, 8.2, 8, 'salir_edificio');
prueba('en la puerta giratoria dice salir', salir);
await pag.evaluate(() => window.__T.usar());
await esperar(2600);
await pag.evaluate(() => window.__T.pasos(8));
r = await pag.evaluate(([hx, hz]) => { const A = window.__A; return { id: A.reino.id, fp: A.cam.fp, visible: !A.yo.m.enPrimera, mira: !!document.querySelector('.mira'), d: +Math.hypot(A.yo.p.x - hx, A.yo.p.z - hz).toFixed(1), fov: +A.motor.camara.fov.toFixed(0) }; }, [hotel.sx, hotel.sz]);
prueba('vuelve a la isla, delante del hotel y en tercera persona', r.id === 'plaza' && !r.fp && r.visible && !r.mira && r.d < 1.5, JSON.stringify(r));

/* ---------------------------------------------------- el café */
const cafe = puertas.find((p) => p.id === 'entrar-cafe0');
await pag.evaluate(([x, y, z]) => window.__T.parar(x, y, z), [cafe.sx, cafe.sy, cafe.sz]);
await caminar(cafe.x, cafe.z, 4, 'entrar');
await pag.evaluate(() => window.__T.usar()); await esperar(2600); await pag.evaluate(() => window.__T.pasos(10));
await pag.evaluate(() => { window.__A.cam.yaw = 0; window.__A.cam.pitch = 0.36; });
await foto('7-cafe');
r = await pag.evaluate(() => {
  const T = window.__T, A = window.__A, R = { tipo: A.reino.tipo };
  const tazas0 = A.reino.grupo.children.length;
  T.parar(-1.6, 0.02, -3.9); R.cafetera = T.apuntar(T.buscar('café')); T.usar(); R.taza = A.reino.grupo.children.length > tazas0;
  const sillas = A.reino.accionables.filter((a) => /Sentarse/.test(a.texto())); R.sillas = sillas.length;
  const s = sillas[0], c = s.obj.position; T.parar(c.x + 0.9, 0.02, c.z + 0.9); R.silla = T.apuntar(s); T.usar(); T.pasos(30);
  R.sentado = A.J.sentado && A.cam.bajaFP < -0.4 && A.yo.p.distanceTo(c) < 0.2;
  /* con canciones cambia de canción; sin canciones (esta versión) avisa que no hay */
  const m0 = A.J.sonando, hay = Object.keys(A.Sonido.grabadas).length > 0; T.parar(4.6, 0.02, -2.4); R.rocola = T.apuntar(T.buscar('canción')); T.usar();
  R.cancion = hay ? A.J.sonando !== m0 : [...document.querySelectorAll('.noti')].some((n) => n.textContent.includes('no trae canciones'));
  return R;
});
prueba('el café: la cafetera sirve una taza', r.tipo === 'cafe' && r.cafetera && r.taza, JSON.stringify(r));
prueba('hay 8 sillas y sentarse baja la vista', r.sillas === 8 && r.silla && r.sentado);
prueba('la rocola cambia la canción (o avisa que no hay)', r.rocola && r.cancion);
await pag.keyboard.down('KeyW'); await pag.evaluate(() => window.__T.pasos(20)); await pag.keyboard.up('KeyW');
r = await pag.evaluate(() => !window.__A.J.sentado);
prueba('al caminar se levanta', r);
r = await pag.evaluate(() => { const T = window.__T, A = window.__A; T.parar(0.8, 0.02, -4.3); A.cam.pitch = -1.3; T.pasos(2); return { accion: A.cerca?.accion, npc: A.cerca?.npc }; });
prueba('de cerca se charla con Moka', r.accion === 'hablar' && r.npc === 'barista', JSON.stringify(r));
await pag.evaluate(() => window.__T.usar()); await esperar(300);
prueba('Moka contesta', !!(await pag.$('.dialogo')));
for (let i = 0; i < 8; i++) { const d = await pag.$('.dialogo'); if (!d) break; await d.click(); await esperar(120); }
await caminar(0, 7.6, 8, 'salir_edificio');
await pag.evaluate(() => window.__T.usar()); await esperar(2600); await pag.evaluate(() => window.__T.pasos(8));
r = await pag.evaluate(() => window.__A.reino.id);
prueba('del café se sale a la isla', r === 'plaza');

/* ---------------------------------------------------- la casa del vecino */
const casa = puertas.find((p) => p.id === 'entrar-casa0');
await pag.evaluate(([x, y, z]) => window.__T.parar(x, y, z), [casa.sx, casa.sy, casa.sz]);
await caminar(casa.x, casa.z, 4, 'entrar');
await pag.evaluate(() => window.__T.usar()); await esperar(3400); await pag.evaluate(() => window.__T.pasos(10));
await pag.evaluate(() => { window.__A.cam.yaw = 0.3; window.__A.cam.pitch = 0.4; });
await foto('8-casa');
r = await pag.evaluate(() => {
  const T = window.__T, A = window.__A, R = { tipo: A.reino.tipo, npc: A.reino.npcMallas.map((n) => n.id).join() };
  T.parar(-3.2, 0.02, 2.2); R.libro = T.apuntar(T.buscar('libro')); T.usar(); R.dialogo = !!document.querySelector('.dialogo');
  return R;
});
prueba('la casa de Rulo: se lee un libro de la biblioteca', r.tipo === 'casa' && r.npc === 'vecina' && r.libro && r.dialogo, JSON.stringify(r));
for (let i = 0; i < 8; i++) { const d = await pag.$('.dialogo'); if (!d) break; await d.click(); await esperar(120); }
r = await pag.evaluate(() => { const T = window.__T, A = window.__A, R = {}; T.parar(1.6, 0.02, -4.2); R.disco = T.apuntar(T.buscar('disco')); T.parar(-4.4, 0.02, -3.2); R.heladera = T.apuntar(T.buscar('heladera')); return R; });
prueba('el tocadiscos y la heladera se apuntan', r.disco && r.heladera, JSON.stringify(r));
/* las paredes de la casa no dejan salir por los costados */
await pag.keyboard.down('KeyW');
r = await pag.evaluate(() => { const A = window.__A, fuera = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; A.yo.ponerEn(new A.THREE.Vector3(Math.sin(a) * 4.8, 0.02, Math.cos(a) * 4.8), 0); for (let i = 0; i < 45; i++) { A.cam.yaw = Math.atan2(-Math.sin(a), -Math.cos(a)); A.paso(1 / 30, false); } if (Math.hypot(A.yo.p.x, A.yo.p.z) > 6.1) fuera.push([k, +A.yo.p.x.toFixed(2), +A.yo.p.z.toFixed(2)]); } return fuera; });
await pag.keyboard.up('KeyW');
prueba('de la casa no se sale atravesando la pared', r.length === 0, JSON.stringify(r));

const e = errores.filter((x) => !x.includes('ERR_FAILED'));
if (e.length) { mal++; console.log('✗ errores:', [...new Set(e)].join(' | ')); }
await ctx.close(); await nav.close();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
