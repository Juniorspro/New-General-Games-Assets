// TU ESPACIO (js/espacio.js, android/…/Espacio.java), sin celu: Android de mentira que manda lo que
// mandaría ARCore en un cuarto: la pose (caminando), los planos (piso, dos paredes, una mesa), los
// cubitos de una caja (la profundidad), la foto de la cámara (passthrough) y una mano apoyada en la mesa
// que MediaPipe ve un 20 % más chica de lo que es (una mano grande: la cree más cerca).
// - el menú del VR pregunta por ARCore (tu espacio, directo al juego o sin);
// - tu espacio prende el escaneo y la cámara, clasifica piso, paredes y mesa, junta los cubitos y pone la foto;
// - con la mano sobre la mesa mide la escala (1/0,8 = 1,25) y la guarda;
// - la pantalla aparece arriba de la mesa; con la mirada y un toque se abre una ventana;
// - la ventana se agarra por la barra (pellizco), se mueve, se pega a la pared y se cierra con la yema;
// - (vuelta 34) las ventanas nuevas no se tapan entre ellas ni con la pantalla; se agarran pellizcando la manija
//   con la mano y la siguen; el escaneo se va al terminar (y "Ver el escaneo" lo vuelve a mostrar); las manos,
//   fantasma en tu espacio;
// - "Jugar" pasa al juego en VR con ARCore y las manos; sin ARCore, las ventanas van en el mundo del juego.
//     node pruebas/espacio.mjs [SBS=1: con visor, la pantalla partida]
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

const SBS = process.env.SBS === '1', FIN = SBS ? '-sbs' : '';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
await pag.addInitScript(() => {
  window.__llamadas = [];
  const anota = (n) => (...a) => { window.__llamadas.push([n, ...a]); };
  window.AeroplazaNativo = {
    version: () => '1', arEstado: () => 'si',
    arIniciar: (m) => { window.__llamadas.push(['arIniciar', m]); setTimeout(() => window.__nativo?.estado('corre'), 30); },
    arParar: anota('arParar'), arManos: anota('arManos'), manosDos: anota('manosDos'), flash: anota('flash'), vibrar: anota('vibrar'),
    arEscanear: (si) => { window.__llamadas.push(['arEscanear', si]); if (si) setTimeout(() => window.__nativo?.estado('espacio profundidad'), 10); },
    arPasante: anota('arPasante'), arOlvidar: anota('arOlvidar'),
  };
});
/* la foto de la cámara: un JPEG hecho en la página (un cuarto dibujado), servido donde lo pide el juego */
let jpeg = null;
await ctx.route(/^https:\/\/appassets\.androidplatform\.net\/camara\//, (r) => r.fulfill({ body: jpeg, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' } }));
await pag.reload();
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
jpeg = Buffer.from((await pag.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d');
  const d = g.createLinearGradient(0, 0, 0, 240); d.addColorStop(0, '#d9cbb0'); d.addColorStop(0.55, '#c8b894'); d.addColorStop(0.56, '#7b5b3a'); d.addColorStop(1, '#5a4029'); g.fillStyle = d; g.fillRect(0, 0, 320, 240);
  g.fillStyle = '#6d4a2c'; g.fillRect(90, 120, 150, 18); g.fillStyle = '#3c6e8f'; g.fillRect(20, 40, 60, 80); return c.toDataURL('image/jpeg', 0.8).split(',')[1]; })), 'base64');
await avanzar(pag, 5, 1 / 30, false);

/* 1) el menú del VR pregunta por ARCore */
const pregunta = await pag.evaluate(async (sbs) => {
  const { UI } = window.__A; UI.menuVR(); await new Promise((r) => setTimeout(r, 50));
  document.querySelector(`.menu-vr [data-sbs="${sbs}"]`).click(); await new Promise((r) => setTimeout(r, 50));
  return { ops: Array.from(document.querySelectorAll('.vr-ar [data-ar]')).map((b) => b.dataset.ar), texto: document.querySelector('.vr-ar p')?.textContent || '' };
}, SBS ? '1' : '0');
prueba('el VR pregunta si se usa ARCore (tu espacio, directo al juego o sin)', pregunta.ops.join() === 'espacio,juego,no', pregunta.ops.join());

/* la pose de ARCore: la cámara del celu (x derecha, y arriba, mira a -z) con rumbo y cabeceo */
await pag.evaluate(() => {
  const { THREE } = window.__A;
  window.__poner = (x, y, z, rumbo, cabeceo) => { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(cabeceo, rumbo, 0, 'YXZ')); window.__pose = { p: [x, y, z], q: [q.x, q.y, q.z, q.w] }; };
  window.__poner(0, 1.45, 0.4, 0, -0.35);
  window.__manda = (n = 1, f = null) => { for (let i = 0; i < n; i++) { const P = window.__pose; window.__nativo.pose(18, ...P.p, ...P.q, 1, '60'); f?.(i); window.__A.paso(1 / 60, false); } };
});
await pag.evaluate(() => document.querySelector('.vr-ar [data-ar="espacio"]').click());
await pag.waitForTimeout(150);
await pag.evaluate(() => window.__manda(40));
const e1 = await pag.evaluate(() => ({ activo: window.__A.espacio.activo, fase: window.__A.espacio.fase, vr: window.__A.vr.activo, ll: window.__llamadas.map((x) => x[0] + (x[1] === undefined ? '' : ':' + x[1])) }));
prueba('tu espacio prende ARCore con las manos, el escaneo y la cámara', e1.activo && e1.vr && e1.ll.includes('arEscanear:true') && e1.ll.includes('arPasante:true') && e1.ll.some((x) => x.startsWith('arIniciar') || x.startsWith('arManos')), e1.ll.join(' '));
prueba('con la pose de ARCore pasa a escanear', e1.fase === 'escaneo', e1.fase);

/* 2) el cuarto: planos, cubitos y la foto */
await pag.evaluate(() => {
  const s = Math.SQRT1_2, poli = (a, b) => [-a, -b, a, -b, a, b, -a, b];
  window.__planos = [
    { i: 1, t: 0, p: [0, 0, -1, 0, 0, 0, 1], x: 3, z: 3, v: poli(1.5, 1.5) },                  // el piso
    { i: 2, t: 2, p: [0, 1.2, -2.5, s, 0, 0, s], x: 3, z: 2.4, v: poli(1.5, 1.2) },            // pared de enfrente (normal +z)
    { i: 3, t: 2, p: [-1.5, 1.2, -1, 0, 0, -s, s], x: 3, z: 2.4, v: poli(1.5, 1.2) },          // pared de la izquierda (normal +x)
    { i: 4, t: 0, p: [0, 0.74, -0.6, 0, 0, 0, 1], x: 1.0, z: 0.8, v: poli(0.5, 0.4) },           // la mesa
  ];
  window.__nativo.planos(window.__planos);
  /* una caja de 40 × 50 × 40 cm (la cáscara), en cubitos de 5 cm */
  const v = [];
  for (let x = -24; x < -16; x++) for (let y = 0; y < 10; y++) for (let z = -32; z < -24; z++) if (x === -24 || x === -17 || y === 9 || z === -32 || z === -25) v.push(x, y, z);
  window.__nativo.voxeles(v, 0.05);
  window.__nativo.foto({ n: 1, url: 'https://appassets.androidplatform.net/camara/1.jpg', e: 40, tx: 0.62, ty: 0.46, w: 320, h: 240, p: [...window.__pose.p, ...window.__pose.q] });
});
await pag.waitForTimeout(300);
/* mirar alrededor: una vuelta entera */
await pag.evaluate(() => window.__manda(360, (i) => { window.__poner(0, 1.45, 0.4, i / 360 * Math.PI * 2, -0.3); if (i % 20 === 0) window.__nativo.planos(window.__planos); }));
await pag.evaluate(() => { window.__poner(0, 1.45, 0.4, 0, -0.35); window.__manda(10); });
const e2 = await pag.evaluate(() => { const E = window.__A.espacio, c = {}; for (const P of E.planos.values()) c[P.clase] = (c[P.clase] || 0) + 1; return { ...E.datos, clases: c, vistos: Array.from(E.sectores).filter((x) => x >= 1).length, foto: E.foto.visible, sx: E.foto.scale.x.toFixed(2) }; });
prueba('los planos quedan clasificados: piso, dos paredes y una mesa', e2.clases.piso === 1 && e2.clases.pared === 2 && e2.clases.mesa === 1 && Math.abs(e2.piso) < 0.01, JSON.stringify(e2.clases) + ` · piso a ${e2.piso}`);
prueba('los cubitos de la caja se juntan', e2.vox > 200, `${e2.vox} cubitos`);
/* (el plano es 7 veces lo que ve la cámara: afuera de la foto sigue su borde, borroso; vuelta 33) */
prueba('la foto de la cámara llega y se pone en el mundo (a 9 m, del tamaño de lo que ve la cámara, y su borde)', e2.fotos >= 1 && e2.foto && e2.sx === (2 * 9 * 0.62 * 7).toFixed(2), `${e2.fotos} fotos · ${e2.sx} m`);
prueba('mirar alrededor llena la vuelta', e2.vistos >= 11, `${e2.vistos}/12`);
await avanzar(pag, 1, 1 / 60, true);
await pag.screenshot({ path: path.join(SAL, `espacio-escaneo${FIN}.png`) });
/* la cámara llena la vista: sin visor, como una app de realidad aumentada; con visor, de entrada el tamaño real (el
   campo de la lente) y con aumento, el de la cámara (vuelta 33). Y qué cámara quedó (el 0.5x si ARCore lo deja) */
const rl = await pag.evaluate((sbs) => {
  const E = window.__A.espacio, g = (x) => +x.toFixed(1), cam = g(2 * Math.atan(0.46) * 180 / Math.PI);
  const real = g(E.campo()); E.accion('llenar'); const lleno = g(E.campo()); E.accion('llenar');
  window.__nativo.estado('camara 67 112'); const t1 = E.textoCamara(); window.__nativo.estado('camara 108 110'); const t2 = E.textoCamara();
  return { sbs, cam, lleno, real, t1, t2, llenar: E.llenar };
}, SBS);
prueba(SBS ? 'con visor, de entrada tamaño real (el campo de la lente); con aumento, el de la cámara' : 'sin visor la cámara llena la pantalla', SBS ? rl.lleno === rl.cam && rl.real > rl.cam + 20 && !rl.llenar : rl.lleno < rl.cam && rl.lleno === rl.real, JSON.stringify(rl));
prueba('dice qué cámara quedó (si ARCore no deja el 0,5x, lo dice)', /112/.test(rl.t1) && /0[,.]5x/.test(rl.t2), `${rl.t1} · ${rl.t2}`);

/* 3) listo → las manos sobre la mesa. Un toque en la pantalla aprieta el botón principal */
await pag.evaluate(() => { window.__A.vr.toque = true; window.__manda(3); });
const f3 = await pag.evaluate(() => window.__A.espacio.fase);
prueba('un toque en la pantalla aprieta "Listo" (con visor no se ve el dedo)', f3 === 'manos', f3);
const rm = await pag.evaluate(async () => {
  const A = window.__A, { THREE } = A;
  /* el celu mirando la mesa (60° abajo); la mano apoyada, justo donde mira: la palma a 2 cm de la mesa */
  window.__poner(0, 1.4, 0, 0, -Math.PI / 3); window.__manda(10);
  const q = new THREE.Quaternion(...window.__pose.q), cam = new THREE.Vector3(...window.__pose.p), d = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  const D = (0.76 - cam.y) / d.y;
  const ABIERTA = [[0, 0, 0], [-0.025, 0.025, -0.01], [-0.045, 0.045, -0.015], [-0.06, 0.063, -0.02], [-0.07, 0.082, -0.025], [-0.022, 0.085, 0], [-0.025, 0.12, 0], [-0.026, 0.143, 0], [-0.027, 0.162, 0], [0, 0.088, 0], [0, 0.128, 0], [0, 0.153, 0], [0, 0.175, 0], [0.02, 0.083, 0], [0.022, 0.118, 0], [0.023, 0.14, 0], [0.024, 0.16, 0], [0.038, 0.075, 0], [0.042, 0.1, 0], [0.044, 0.118, 0], [0.045, 0.134, 0]];
  const cen = [0, 5, 9, 13, 17].reduce((a, i) => a.map((v, k) => v + ABIERTA[i][k] / 5), [0, 0, 0]);
  const TX = 0.62, TY = 0.46, ESCALA_MP = 0.8;
  /* (en la cámara de three: la palma en (0, 0, -D); lo de MediaPipe es la forma 0,8 veces más chica) */
  const mano = () => {
    const I = [], W = [];
    for (const p of ABIERTA) { const x = cen[0] - p[0], y = -cen[1] + p[1], z = -D + cen[2] - p[2]; I.push(0.5 + x / -z / (2 * TX), 0.5 - y / -z / (2 * TY), 0); W.push(ESCALA_MP * (x - 0), -ESCALA_MP * (y - 0), -ESCALA_MP * (z + D)); }
    return { e: 25, tx: TX, ty: TY, ms: 12, w: 640, h: 480, g: 1, luz: 0.4, d: 'GPU', n: 1, m: [{ d: 1, c: 0.95, i: I, w: W }] };
  };
  window.__manoFalsa = mano;   // (vuelta 42: la usan las pruebas de la mira)
  const antes = A.manos.escalaMano;
  for (let i = 0; i < 220 && !A.espacio.medida.der?.hecha; i++) { window.__manda(1); if (i % 2 === 0) window.__nativo.manos(mano()); await new Promise((r) => setTimeout(r, 4)); }
  let guardada = null; try { guardada = +localStorage.getItem('aeroplaza.escalaMano'); } catch { /* nada */ }
  return { antes, k: A.manos.escalaMano, hecha: !!A.espacio.medida.der?.hecha, cm: A.espacio.medida.der?.cm, guardada };
});
prueba('la mano sobre la mesa se mide: la escala sale 1/0,8 = 1,25 (±6 %)', rm.hecha && Math.abs(rm.k - 1.25) < 0.075, `${rm.antes} → ${rm.k?.toFixed(3)} · la mano mide ${rm.cm} cm`);
prueba('la escala queda guardada', Math.abs(rm.guardada - rm.k) < 1e-6, String(rm.guardada));
await avanzar(pag, 1, 1 / 60, true);
await pag.screenshot({ path: path.join(SAL, `espacio-manos${FIN}.png`) });

/* 4) seguir → la pantalla arriba de la mesa; con la mirada en un botón y un toque, una ventana */
await pag.evaluate(() => { window.__poner(0, 1.45, 0.4, 0, -0.3); window.__A.vr.toque = true; window.__manda(3); });
const rp = await pag.evaluate(() => {
  const E = window.__A.espacio, P = E.ventanas.pantalla; if (!P) return { fase: E.fase };
  window.__manda(30);   // (que termine de aparecer)
  const w = P.malla.getWorldPosition(new window.__A.THREE.Vector3()), c = E.cabezaP;
  /* (vuelta 42: adelante, a 1,9 m, un poco abajo de los ojos, y más grande: antes, arriba de la mesa a menos de 1 m) */
  return { fase: E.fase, pos: w.toArray().map((x) => +x.toFixed(2)), lejos: +Math.hypot(w.x - c.x, w.z - c.z).toFixed(2), baja: +(c.y - w.y).toFixed(2), ancho: +(P.ancho * P.malla.scale.x).toFixed(2), adelante: w.z < c.z - 1 };
});
prueba('"Seguir" abre la pantalla adelante y lejos, como en un Quest (1,9 m, un poco abajo, más grande)', rp.fase === 'pantalla' && rp.adelante && Math.abs(rp.lejos - 1.9) < 0.05 && rp.baja > 0.1 && rp.baja < 0.3 && rp.ancho > 1.5, JSON.stringify(rp));
/* mirar el botón "Dónde estoy" y tocar */
const mirarBoton = async (id) => pag.evaluate((id) => {
  const A = window.__A, { THREE } = A, E = A.espacio, P = E.ventanas.pantalla, b = P.botones.find((x) => x.id === id);
  window.__manda(30);   // (que termine de aparecer: crece con un rebote)
  const loc = new THREE.Vector3(((b.x + b.w / 2) / P.W - 0.5) * P.ancho, (0.5 - (b.y + b.h / 2) / P.H) * P.alto, 0), w = P.malla.localToWorld(loc);
  const ojo = new THREE.Vector3(0, 1.45, 0.4), d = w.clone().sub(ojo).normalize();
  /* (la pose es la del celu: los ojos 6 cm detrás, así que el celu va 6 cm adelante por la mirada) */
  const cel = ojo.clone().addScaledVector(d, 0.06);
  window.__poner(cel.x, cel.y, cel.z, Math.atan2(-d.x, -d.z), Math.asin(d.y)); window.__manda(4);
  A.vr.toque = true; window.__manda(3);
  return E.ventanas.lista.length;
}, id);
const nV = await mirarBoton('lugar');
prueba('con la mirada en "Dónde estoy" y un toque, se abre la ventana', nV === 1, `${nV} ventanas`);
/* agarrarla por la barra con un pellizco (un puntero de mentira), llevarla cerca de la pared de la izquierda y soltar */
const rv = await pag.evaluate(() => {
  window.__manda(30);   // (que termine de aparecer)
  const A = window.__A, { THREE } = A, E = A.espacio, V = E.ventanas.lista[0], cab = E.cabezaP.clone(), q = E.cabezaQ.clone();
  const barra = V.malla.localToWorld(new THREE.Vector3(0, V.alto / 2 - 0.02, 0)), o = cab.clone().add(new THREE.Vector3(0.15, -0.3, 0));
  const dir = (p) => p.clone().sub(o).normalize();
  const P = (extra) => [{ id: 1, o, d: dir(barra), yema: null, pellizca: true, empezo: false, solto: false, ...extra }];
  E.ventanas.actualizar(1 / 60, cab, q, P({ empezo: true }));
  const agarrada = E.ventanas.agarres.has(1);
  const destino = new THREE.Vector3(-1.38, 1.2, -0.9);
  for (let i = 0; i < 60; i++) E.ventanas.actualizar(1 / 60, cab, q, [{ id: 1, o, d: dir(destino), yema: null, pellizca: true, empezo: false, solto: false }]);
  E.ventanas.actualizar(1 / 60, cab, q, [{ id: 1, o, d: dir(destino), yema: null, pellizca: false, empezo: false, solto: true }]);
  const p = V.malla.position, n = new THREE.Vector3(0, 0, 1).applyQuaternion(V.malla.quaternion);
  return { agarrada, pegada: V.pegada, x: +p.x.toFixed(3), nx: +n.x.toFixed(2) };
});
prueba('la ventana se agarra por la barra con un pellizco y se mueve', rv.agarrada, JSON.stringify(rv));
prueba('cerca de la pared se pega (a 1 cm, mirando para afuera)', rv.pegada && Math.abs(rv.x + 1.488) < 0.01 && rv.nx > 0.95, `x ${rv.x} · normal x ${rv.nx}`);
/* cerrarla con la yema: la punta del dedo cruza el vidrio sobre la X */
const rc = await pag.evaluate(() => {
  const A = window.__A, { THREE } = A, E = A.espacio, V = E.ventanas.lista[0], cab = E.cabezaP.clone(), q = E.cabezaQ.clone();
  const c = V.cerrar, x = ((c.x + c.w / 2) / V.W - 0.5) * V.ancho, y = (0.5 - (c.y + c.h / 2) / V.H) * V.alto;
  for (const z of [0.03, 0.015, 0.008, 0.0]) E.ventanas.actualizar(1 / 60, cab, q, [{ id: 0, o: cab, d: new THREE.Vector3(0, 0, -1), yema: V.malla.localToWorld(new THREE.Vector3(x, y, z)), pellizca: false, empezo: false, solto: false }]);
  return E.ventanas.lista.length;
});
prueba('con la yema sobre la X, la ventana se cierra', rc === 0, `${rc} ventanas`);
/* abrir la pizarra y dibujar con la yema */
await mirarBoton('pizarra');
const rz = await pag.evaluate(() => {
  const A = window.__A, { THREE } = A, E = A.espacio, V = E.ventanas.lista[0], cab = E.cabezaP.clone(), q = E.cabezaQ.clone();
  for (let i = 0; i <= 20; i++) { const z = i === 0 ? 0.02 : -0.003; E.ventanas.actualizar(1 / 60, cab, q, [{ id: 0, o: cab, d: new THREE.Vector3(0, 0, -1), yema: V.malla.localToWorld(new THREE.Vector3(-0.12 + i * 0.012, -0.02 + Math.sin(i / 3) * 0.02, z)), pellizca: false, empezo: false, solto: false }]); }
  const g = V.tinta.getContext('2d').getImageData(0, 0, V.tinta.width, V.tinta.height).data; let n = 0; for (let i = 3; i < g.length; i += 4) if (g[i] > 0) n++;
  return { tipo: V.tipo, pintados: n };
});
prueba('en la pizarra se dibuja con la yema', rz.tipo === 'pizarra' && rz.pintados > 2000, `${rz.pintados} píxeles`);
/* caminar: la ventana se queda en su lugar del cuarto */
const rw = await pag.evaluate(() => { const E = window.__A.espacio, V = E.ventanas.lista[0], a = V.malla.position.clone(); window.__poner(0.8, 1.45, -0.2, 0.6, -0.2); window.__manda(30); return +V.malla.position.distanceTo(a).toFixed(4); });
prueba('caminando, la ventana se queda en su lugar (6DoF)', rw < 1e-3, `se movió ${rw} m`);
await pag.evaluate(() => { window.__poner(0, 1.45, 0.4, 0, -0.3); window.__manda(10); });
await avanzar(pag, 1, 1 / 60, true);
await pag.screenshot({ path: path.join(SAL, `espacio-pantalla${FIN}.png`) });

/* (vuelta 34) cuatro ventanas nuevas, cada una en su lugar: ninguna tapa a otra (ni a la pantalla) */
const ra = await pag.evaluate(() => {
  const A = window.__A, { THREE } = A, E = A.espacio, W = E.ventanas; W.cerrarTodas();
  for (const tipo of ['reloj', 'pizarra', 'burbujas', 'lugar']) W.abrir(tipo, E.cabezaP, E.cabezaQ);
  window.__manda(30);
  const cab = E.cabezaP, T = W.tableros, pos = T.map((x) => x.malla.getWorldPosition(new THREE.Vector3()));
  const radio = (x, p) => Math.atan2(Math.hypot(x.ancho, x.alto) * 0.42 * (x.escala || 1), p.distanceTo(cab));
  let peor = Infinity;
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const a = pos[i].clone().sub(cab).normalize(), b = pos[j].clone().sub(cab).normalize();
    peor = Math.min(peor, Math.acos(Math.min(1, a.dot(b))) - radio(T[i], pos[i]) - radio(T[j], pos[j]));
  }
  /* (dónde quedó cada una: el rumbo y la altura vistos desde la cabeza, en grados; la primera es la pantalla) */
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(E.cabezaQ), r0 = Math.atan2(-f.x, -f.z);
  const donde = pos.map((p) => { const v = p.clone().sub(cab); return [Math.round(((Math.atan2(-v.x, -v.z) - r0) * 180 / Math.PI + 540) % 360 - 180), Math.round(Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180 / Math.PI)]; });
  return { n: T.length, peor: +(peor * 180 / Math.PI).toFixed(1), donde, lejos: Math.max(...donde.slice(1).map((d) => Math.abs(d[0]))) };
});
prueba('cuatro ventanas nuevas no se tapan entre ellas ni con la pantalla, y quedan a la vista (a menos de 75° de costado)', ra.n === 5 && ra.peor > 0 && ra.lejos < 75, `${ra.n} tableros · el par más junto, ${ra.peor}° de sobra · ${ra.donde.map((d) => d.join('/')).join(' ')}`);
/* agarrarla pellizcando la manija con la mano (sin el rayo) y moverla: la sigue */
const rh = await pag.evaluate(() => {
  const A = window.__A, { THREE } = A, E = A.espacio, W = E.ventanas, V = W.lista[0], cab = E.cabezaP.clone(), q = E.cabezaQ.clone();
  const lejos = new THREE.Vector3(0, -1, 0);
  const pinza = V.malla.localToWorld(new THREE.Vector3(0.02, -V.alto / 2 - 0.035, 0.02)), antes = V.malla.position.clone();
  const P = (pz, extra) => [{ id: 0, o: cab, d: lejos, yema: null, pinza: pz, pellizca: true, empezo: false, solto: false, ...extra }];
  W.actualizar(1 / 60, cab, q, P(pinza, { empezo: true }));
  const agarrada = W.agarres.get(0)?.mano === true, luz = V.luzManija === 0 && V.manija.material.opacity > 0.5;
  const mueve = new THREE.Vector3(0.18, 0.1, 0.05);
  for (let i = 1; i <= 30; i++) W.actualizar(1 / 60, cab, q, P(pinza.clone().addScaledVector(mueve, Math.min(1, i / 15))));
  W.actualizar(1 / 60, cab, q, [{ id: 0, o: cab, d: lejos, yema: null, pinza: pinza.clone().add(mueve), pellizca: false, empezo: false, solto: true }]);
  return { agarrada, luz, err: +V.malla.position.clone().sub(antes).sub(mueve).length().toFixed(4), suelta: !W.agarres.has(0) };
});
prueba('pellizcando la manija con la mano, la ventana se agarra y sigue a la mano', rh.agarrada && rh.err < 0.01 && rh.suelta, JSON.stringify(rh));
/* (vuelta 42) COMO EN UN QUEST: las ventanas nacen lejos y más grandes, frenan antes de una pared, el rayo y el
   pellizco las alcanzan, y la mira no aprieta nada */
const rq = await pag.evaluate(() => {
  const A = window.__A, { THREE } = A, E = A.espacio, W = E.ventanas; W.cerrarTodas();
  window.__poner(0, 1.45, 0.4, 0, 0); window.__manda(5);
  let cab = E.cabezaP.clone(), q = E.cabezaQ.clone();
  const V = W.abrir('reloj', cab, q); window.__manda(30);
  const lejos = +V.malla.getWorldPosition(new THREE.Vector3()).distanceTo(cab).toFixed(2), escala = +V.malla.scale.x.toFixed(2);
  /* el rayo a la X de la ventana, lejos, y un pellizco: se cierra */
  const X = V.malla.localToWorld(new THREE.Vector3(((V.cerrar.x + V.cerrar.w / 2) / V.W - 0.5) * V.ancho, (0.5 - (V.cerrar.y + V.cerrar.h / 2) / V.H) * V.alto, 0));
  const o = cab.clone().add(new THREE.Vector3(0.2, -0.35, -0.1)), d = X.clone().sub(o).normalize();
  W.actualizar(1 / 60, cab, q, [{ id: 0, o, d, yema: null, pinza: null, pellizca: true, empezo: true, solto: false }]);
  const cerroConRayo = W.lista.length === 0;
  /* mirando la pared de la izquierda (a 1,5 m): la ventana queda 15 cm antes, no adentro */
  window.__poner(0, 1.45, 0.4, Math.PI / 2, 0); window.__manda(5); cab = E.cabezaP.clone(); q = E.cabezaQ.clone();
  const V2 = W.abrir('reloj', cab, q); window.__manda(30);
  const xPared = +V2.malla.getWorldPosition(new THREE.Vector3()).x.toFixed(2);
  W.cerrarTodas();
  return { lejos, escala, cerroConRayo, xPared };
});
prueba('las ventanas nacen lejos (1,45 m) y 1,7 veces más grandes; el rayo y el pellizco las alcanzan', Math.abs(rq.lejos - 1.45) < 0.03 && Math.abs(rq.escala - 1.7) < 0.01 && rq.cerroConRayo, JSON.stringify(rq));
prueba('frente a una pared más cerca, la ventana queda 15 cm antes (no adentro)', Math.abs(rq.xPared - (-1.5 + 0.15)) < 0.03, `x ${rq.xPared} (la pared en -1,5)`);
/* la mira: quedarse 3 s mirando un botón de la pantalla no aprieta nada; con una mano a la vista, el punto se va */
const rmi = await pag.evaluate(() => {
  const A = window.__A, { THREE } = A, E = A.espacio, W = E.ventanas; W.cerrarTodas();
  window.__poner(0, 1.45, 0.4, 0, -0.3); window.__manda(5); E.abrirPantalla(); window.__manda(30);
  const P = W.pantalla, b = P.botones.find((x) => x.id === 'reloj');
  const w = P.malla.localToWorld(new THREE.Vector3(((b.x + b.w / 2) / P.W - 0.5) * P.ancho, (0.5 - (b.y + b.h / 2) / P.H) * P.alto, 0));
  const ojo = E.cabezaP.clone(), d = w.clone().sub(ojo).normalize(), cel = ojo.clone().addScaledVector(d, 0.06);
  window.__poner(cel.x, cel.y, cel.z, Math.atan2(-d.x, -d.z), Math.asin(d.y));
  window.__manda(180);   // (3 s mirándolo)
  const sinApretar = W.lista.length === 0, sobre = P.sobre?.id || null, carga = P.carga, puntoSolo = E.punto.visible;
  /* una mano a la vista (de MediaPipe de mentira): el punto se apaga */
  for (let i = 0; i < 90; i++) { if (i % 2 === 0) window.__nativo.manos(window.__manoFalsa()); window.__manda(1); }
  const conMano = !!E.conMano, puntoConMano = E.punto.visible, op = +E.punto.material.opacity.toFixed(2);
  return { sinApretar, sobre, carga, puntoSolo, conMano, puntoConMano, op };
});
prueba('mirar 3 s un botón no lo aprieta (ni se va llenando): la mira no aprieta', rmi.sinApretar && rmi.carga === 0 && rmi.sobre === 'reloj', JSON.stringify(rmi));
prueba('con una mano a la vista la mira se apaga (apunta la mano, como en un Quest)', rmi.puntoSolo && rmi.conMano && !rmi.puntoConMano, JSON.stringify(rmi));
/* el escaneo: se fue al terminar; "Ver el escaneo" lo muestra y lo vuelve a esconder */
const re = await pag.evaluate(() => {
  const A = window.__A, E = A.espacio; E.ventanas.cerrarTodas();
  const antes = { u: +E.uVer.value.toFixed(2), vox: E.vox.visible, planos: E.grupoPlanos.visible };
  E.accion('escaneo'); window.__manda(30); const ver = { u: +E.uVer.value.toFixed(2), vox: E.vox.visible };
  E.accion('escaneo'); window.__manda(60); const otra = { u: +E.uVer.value.toFixed(2), vox: E.vox.visible };
  return { antes, ver, otra, fantasma: A.manos.fantasma };
});
prueba('el escaneo se va al terminar; "Ver el escaneo" lo vuelve a mostrar', !re.antes.vox && !re.antes.planos && re.ver.u === 1 && re.ver.vox && !re.otra.vox, JSON.stringify(re));
prueba('en tu espacio las manos son fantasma (casi solo el borde)', re.fantasma === 1, String(re.fantasma));

/* 5) jugar: al juego en VR, con ARCore y las manos; el escaneo y la cámara se apagan */
await pag.evaluate(() => window.__A.espacio.ventanas.cerrarTodas());
await mirarBoton('jugar');
const rj = await pag.evaluate(() => { const A = window.__A; window.__manda(10); return { espacio: A.espacio.activo, vr: A.vr.activo, manos: A.manos.activa, fantasma: A.manos.fantasma, ll: window.__llamadas.slice(-6).map((x) => x[0] + ':' + x[1]) }; });
prueba('"Jugar" pasa al juego en VR (con las manos, ya no fantasma), y apaga el escaneo y la cámara', !rj.espacio && rj.vr && rj.manos && rj.fantasma < 1 && rj.ll.includes('arEscanear:false') && rj.ll.includes('arPasante:false'), rj.ll.join(' '));
await pag.evaluate(() => window.__A.J.salirVR());

/* 6) sin ARCore: no se prende; las ventanas, en el mundo del juego (desde el menú de la palma) */
await pag.evaluate(async () => { window.__llamadas.length = 0; const { UI } = window.__A; UI.menuVR(); await new Promise((r) => setTimeout(r, 50)); document.querySelector('.menu-vr [data-sbs="0"]').click(); await new Promise((r) => setTimeout(r, 50)); document.querySelector('.vr-ar [data-ar="no"]').click(); await new Promise((r) => setTimeout(r, 100)); });
await avanzar(pag, 5, 1 / 30, false);
const rn = await pag.evaluate(() => { const A = window.__A; A.J.abrirVentanasMundo(); const W = A.ventanasMundo; W.alAccion('reloj'); return { vr: A.vr.activo, ar: window.__llamadas.some((x) => x[0] === 'arIniciar'), pantalla: !!W.pantalla, ventanas: W.lista.length, enManos: W.grupo.parent === A.manos.escena, algo: A.manos.algo, seis: W.lista[0]?.conSeis }; });
prueba('sin ARCore, el VR no lo prende', rn.vr && !rn.ar, JSON.stringify(rn));
prueba('sin ARCore, la pantalla y las ventanas van en el mundo del juego (sin 6DoF)', rn.pantalla && rn.ventanas === 1 && rn.enManos && rn.algo && rn.seis === false);
await pag.evaluate(() => window.__A.J.salirVR());
prueba('al salir del VR se cierran las ventanas del mundo', await pag.evaluate(() => !window.__A.ventanasMundo.hayAlgo));
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));
await ctx.close(); await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
