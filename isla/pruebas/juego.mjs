// La isla entera, jugada por una máquina: talar, minar, construir, pescar,
// cavar, bajar a la mina, guardar y volver a cargar, los tres idiomas y el
// menú. Todo por la sonda window.__isla con ?pausa: el juego no corre solo y
// cada cuadro se avanza a mano, casi siempre SIN dibujar (paso(dt, false)):
// en SwiftShader un cuadro dibujado cuesta segundos y la lógica, milisegundos.
//
//   node pruebas/juego.mjs [puerto]      (con un servidor sirviendo la raíz del repo)
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const PUERTO = process.argv[2] || 8123;
const URL = `http://127.0.0.1:${PUERTO}/isla/index.html?pausa&`;
let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };

const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await nav.newContext({ viewport: { width: 960, height: 540 } });
const errores = [];
async function abrir(q) {
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errores.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errores.push('consola: ' + m.text().slice(0, 200)); });
  const t0 = Date.now();
  await pg.goto(URL + q);
  await pg.waitForFunction(() => window.__isla && window.__isla.listo, null, { timeout: 90000 });
  pg.carga = Date.now() - t0;
  return pg;
}
// ayudas que corren adentro de la página
const AYUDAS = `
  const I = window.__isla, J = I.J, THREE = I.THREE;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const pasos = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) I.paso(dt, false); };
  const mirar = (x, y, z) => { const o = J.jugador.ojos(V()); const dx = x - o.x, dy = y - o.y, dz = z - o.z; J.jugador.yaw = Math.atan2(-dx, -dz); J.jugador.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
  const tener = (id, n = 1) => J.inv.agregar(id, n);
  const elegir = (id) => { J.acciones.sel = J.inv.ranuras.findIndex((r) => r && r.id === id); };
  const cerca = (lista) => lista.slice().sort((a, b) => Math.hypot(a.x - J.jugador.p.x, a.z - J.jugador.p.z) - Math.hypot(b.x - J.jugador.p.x, b.z - J.jugador.p.z));
  const jugar = () => { J.empezar(false); pasos(50, 1 / 20); };
`;
const correr = (pg, cuerpo) => pg.evaluate(`(async () => { ${AYUDAS} ${cuerpo} })()`);

// ── el menú ────────────────────────────────────────────────────────────────
console.log('── el menú');
let pg = await abrir('nueva&idioma=es');
ch('carga sin errores', errores.length === 0, `${pg.carga} ms hasta la sonda`);
let r = await correr(pg, `
  const m = J.menu;
  m.mouse.set(0, 0); pasos(40);
  const antes = J.camara.quaternion.clone();
  m.mouse.set(0.9, -0.6); pasos(40);
  const giro = THREE.MathUtils.radToDeg(antes.angleTo(J.camara.quaternion));
  m.abrir('ajustes'); pasos(70);
  const dAj = J.camara.position.distanceTo(m.vistaAjustes.pos);
  m.abrir('creditos'); pasos(80);
  const dCr = J.camara.position.distanceTo(m.vistaCreditos.pos);
  m.abrir('principal'); pasos(60);
  return { giro, dAj, dCr, opciones: [...document.querySelectorAll('#opciones button')].map((b) => b.textContent) };`);
ch('la cámara se mece hacia el mouse', r.giro > 8 && r.giro < 25, `${r.giro.toFixed(1)}° (tope 18° + vaivén 1,5°)`);
ch('AJUSTES vuela al cartel de la arena', r.dAj < 0.3, `queda a ${r.dAj.toFixed(2)} m del punto`);
ch('CRÉDITOS vuela a la punta del muelle', r.dCr < 0.3, `queda a ${r.dCr.toFixed(2)} m del punto`);
ch('el menú principal tiene sus tres opciones', r.opciones.join('|') === 'JUGAR|AJUSTES|CRÉDITOS', r.opciones.join(' · '));
r = await correr(pg, `
  const c = J.menu.ajustes, antes = J.ajustes.musica;
  c.clic(170 + 14, 58 + 13);   // el "−" de la música, en coordenadas del lienzo
  const baja = J.ajustes.musica;
  c.clic(170 + 62 * 2 + 29, 58 + 34 * 4 + 13);   // CALIDAD → ALTA
  const calidad = J.ajustes.calidad;
  c.clic(170 + 62 + 29, 58 + 34 * 6 + 13);   // IDIOMA → EN
  const en = document.querySelector('#opciones button') ? document.querySelector('#opciones button').textContent : '';
  const nombre = document.title;
  c.clic(170 + 29, 58 + 34 * 6 + 13);   // y vuelta a ES
  return { antes, baja, calidad, en, nombre, sombra: J.cielo.sol.shadow.mapSize.x };`);
ch('el cartel de ajustes responde a los clics', r.baja < r.antes, `música ${r.antes} → ${r.baja}`);
ch('calidad alta agranda el mapa de sombras', r.calidad === 2 && r.sombra === 4096, `${r.sombra} px`);
ch('el idioma cambia en vivo', r.nombre === 'The Island' && r.en === 'PLAY', `${r.nombre} · ${r.en}`);
await pg.close();

// ── jugar ──────────────────────────────────────────────────────────────────
console.log('── jugar');
pg = await abrir('nueva&idioma=es');
r = await correr(pg, `
  jugar();
  const P = cerca(J.mundo.veg.palmeras.filter((p) => p.viva))[0];
  J.jugador.ponerEn(V(P.x + 1.6, 0, P.z), 0); mirar(P.x, P.y + 1.2, P.z);
  tener('hachaPiedra'); elegir('hachaPiedra'); pasos(12);
  J.entrada.botones.izq = true; let golpes = 0, t = 0;
  while (P.viva && t < 400) { pasos(1); t++; }
  J.entrada.botones.izq = false;
  const sueltos = J.objetos.lista.filter((o) => Math.hypot(o.g.position.x - P.x, o.g.position.z - P.z) < 6).map((o) => o.id);
  return { estado: J.estado, viva: P.viva, segundos: t / 30, madera: sueltos.filter((i) => i === 'madera').length };`);
ch('arranca el juego desde el menú', r.estado === 'jugando');
ch('el hacha de piedra tala una palmera', !r.viva, `${r.segundos.toFixed(1)} s de golpes (5 hachazos)`);
ch('la palmera suelta madera', r.madera >= 3, `${r.madera} maderas`);
r = await correr(pg, `
  const R = cerca(J.mundo.rocas.minables.filter((m) => m.vivo))[0];
  J.jugador.ponerEn(V(R.x + R.r + 1.2, 0, R.z), 0); mirar(R.x, R.y + R.r * 0.6, R.z);
  tener('picoPiedra'); elegir('picoPiedra'); pasos(12);
  const antes = J.objetos.lista.length, total = R.trozos.length;
  J.entrada.botones.izq = true; pasos(90); J.entrada.botones.izq = false; pasos(10);
  const quedan = R.trozos.filter((t) => t.vivo).length;
  const nuevos = J.objetos.lista.slice(antes).map((o) => o.id);
  return { total, quedan, piedras: nuevos.filter((i) => i === 'piedra').length, nuevos };`);
ch('el pico saca la roca de a pedazos', r.quedan < r.total && r.quedan > 0, `quedan ${r.quedan} de ${r.total} tras 3 s`);
ch('cada pedazo suelta piedra', r.piedras >= r.total - r.quedan, r.nuevos.join(' '));
r = await correr(pg, `
  tener('bloqueMadera', 10); tener('mesa'); elegir('bloqueMadera'); J.jugador.pitch = -0.8; pasos(10);
  const n0 = J.bloques.mapa.size;
  for (let k = 0; k < 4; k++) { J.jugador.yaw += 0.4; pasos(1); J.entrada.botonesRecien.der = true; pasos(2); }
  elegir('mesa'); J.jugador.yaw += 0.5; pasos(8); J.entrada.botonesRecien.der = true; pasos(2);
  const mesa = [...J.bloques.mapa.values()].find((b) => b.tipo === 'mesa');
  let rompe = null;
  if (mesa) { mirar(mesa.x + 0.5, mesa.y + 0.9, mesa.z + 0.5); pasos(2); J.entrada.botones.izq = true; let t = 0; while (J.bloques.hay(mesa.x, mesa.y, mesa.z) && t < 90) { pasos(1); t++; } J.entrada.botones.izq = false; rompe = t / 30; }
  return { puestos: J.bloques.mapa.size - n0 + (rompe !== null ? 1 : 0), mesa: !!mesa, rompe };`);
ch('se ponen bloques con clic derecho', r.puestos >= 4, `${r.puestos} bloques`);
ch('la mesa de trabajo se pone y se rompe', r.mesa && r.rompe !== null && r.rompe < 1.5, r.rompe !== null ? `${r.rompe.toFixed(2)} s para romperla` : 'no se puso');
r = await correr(pg, `
  const t = J.mundo.muelle.punta; J.jugador.ponerEn(V(t.x, t.y + 1, t.z), 0);
  const D = J.menu.D; J.jugador.yaw = Math.atan2(-D.x, -D.z); J.jugador.pitch = -0.15;
  tener('cana'); elegir('cana'); pasos(12);
  J.entrada.botonesRecien.izq = true; pasos(45);
  const tiro = J.pesca.estado; let pico = false;
  for (let i = 0; i < 500 && !pico; i++) { pasos(1); pico = J.pesca.estado === 'pica'; }
  const antes = J.objetos.lista.length;
  if (pico) { J.entrada.botonesRecien.izq = true; pasos(12); }
  const sale = J.objetos.lista.slice(antes).map((o) => o.id)[0];
  pasos(40);
  return { tiro, pico, sale, tengo: sale ? J.inv.contar(sale) : 0 };`);
ch('la caña tira la boya al agua', r.tiro === 'esperando', r.tiro);
ch('pica y sale algo', r.pico && !!r.sale, r.sale || 'nada');
ch('lo pescado vuela a la mochila', r.tengo >= 1);
r = await correr(pg, `
  J.jugador.ponerEn(J.mundo.spawn, 0); J.jugador.pitch = -0.6; pasos(3);
  tener('pala'); tener('piedra', 30); elegir('pala'); pasos(10);
  const T = J.mundo.terreno, ap = J.acciones.ap;
  if (!ap || ap.tipo !== 'terreno') return { tipo: ap && ap.tipo };
  const p = ap.punto.clone(), h0 = T.altura(p.x, p.z), piedra0 = J.inv.contar('piedra');
  J.acciones.pincel = 0; J.entrada.botones.izq = true; pasos(45); J.entrada.botones.izq = false; pasos(2);
  const h1 = T.altura(p.x, p.z), piedra1 = J.inv.contar('piedra');
  J.acciones.pincel = 1; J.entrada.botones.izq = true; pasos(45); J.entrada.botones.izq = false; pasos(2);
  return { tipo: 'terreno', h0, h1, h2: T.altura(p.x, p.z), gasto: piedra0 - piedra1, piedra1, piedra2: J.inv.contar('piedra') };`);
ch('la pala sube el terreno', r.h1 > r.h0 + 0.3, r.h1 !== undefined ? `${r.h0.toFixed(2)} → ${r.h1.toFixed(2)} m` : 'no apuntaba al terreno: ' + r.tipo);
ch('subir cuesta piedra y bajar la devuelve', r.gasto > 0 && r.piedra2 > r.piedra1 && r.h2 < r.h1, `subir gastó ${r.gasto}, bajar devolvió ${r.piedra2 - r.piedra1}`);
r = await correr(pg, `
  tener('farol'); elegir('farol'); pasos(5);
  J.acciones.bajarMina(); pasos(30);
  const abajo = { bajo: J.bajo, y: J.jugador.p.y, mundoVisible: J.mundo.terreno.grupo.visible, minaVisible: J.mina.grupo.visible };
  // la pared más cercana en los cuatro rumbos: caminar 2 s contra ella
  const p0 = J.jugador.p.clone();
  let rumbo = null;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let d = 0; while (d < 20 && J.mina.abiertoEn(p0.x + dx * d, p0.z + dz * d)) d += 0.1;
    if (d > 0.6 && (!rumbo || d < rumbo.d)) rumbo = { dx, dz, d };
  }
  J.jugador.yaw = Math.atan2(-rumbo.dx, -rumbo.dz); J.jugador.pitch = 0;
  J.entrada.abajo.add('KeyW'); pasos(60); J.entrada.abajo.delete('KeyW');
  const camino = Math.hypot(J.jugador.p.x - p0.x, J.jugador.p.z - p0.z), pared = rumbo.d;
  J.acciones.subirMina(); pasos(30);
  return { ...abajo, camino, pared, arriba: !J.bajo && J.jugador.p.y > -5 };`);
ch('se baja a la mina', r.bajo && r.y < -55 && !r.mundoVisible && r.minaVisible, `y = ${r.y.toFixed(1)}`);
ch('en la mina se camina y las paredes frenan', r.camino > 0.2 && r.camino < r.pared, `la pared a ${r.pared.toFixed(1)} m: avanzó ${r.camino.toFixed(1)} m de los 8,8 que da 2 s de caminar`);
ch('y se vuelve a subir', r.arriba);
r = await correr(pg, `
  J.cielo.hora = 0.93; J.acciones.tEstrella = 0.01; pasos(5);
  const cae = J.acciones.cayendo.length; pasos(120);
  return { cae, suelo: J.objetos.lista.some((o) => o.id === 'estrella' || o.id === 'cielo') };`);
ch('de noche cae una estrella y queda en el piso', r.cae === 1 && r.suelo);
await pg.close();

// ── guardar y cargar ───────────────────────────────────────────────────────
console.log('── guardar y cargar');
pg = await abrir('nueva&idioma=es');
r = await correr(pg, `
  I.borrar(); jugar();
  const P = J.mundo.veg.palmeras.filter((p) => p.viva)[5]; J.mundo.veg.quitarPalmera(P);
  const x = Math.floor(J.jugador.p.x) - 2, z = Math.floor(J.jugador.p.z) + 2;
  J.bloques.poner('cofre', x, 1, z); J.bloques.cofres.get(x + ',1,' + z).agregar('rubi', 3);
  J.mundo.terreno.pincel(J.jugador.p.x + 4, J.jugador.p.z, 2, 1.5, 'subir'); J.mundo.terreno.actualizar();
  tener('picoHierro'); J.dia = 4; J.cielo.hora = 0.6;
  I.guardar();
  return { palmera: P.id, tam: localStorage.getItem('isla_v1').length };`);
const guardado = r;
// sin ?nueva: esta vez tiene que leer lo guardado
await pg.goto(URL + 'idioma=es');
await pg.waitForFunction(() => window.__isla && window.__isla.listo, null, { timeout: 90000 });
r = await correr(pg, `
  return { taladas: J.mundo.veg.palmeras.filter((p) => !p.viva).map((p) => p.id), rubi: [...J.bloques.cofres.values()].map((c) => c.contar('rubi'))[0],
    pico: J.inv.contar('picoHierro'), dia: J.dia, hora: J.cielo.hora, cambios: J.mundo.terreno.diferencias().a.length / 2,
    opciones: [...document.querySelectorAll('#opciones button')].map((b) => b.textContent) };`);
ch('se guarda poco', guardado.tam < 20000, `${(guardado.tam / 1024).toFixed(1)} KB`);
ch('vuelve la palmera talada', r.taladas.includes(guardado.palmera));
ch('vuelve el cofre con lo de adentro', r.rubi === 3);
ch('vuelven el inventario, el día y la hora', r.pico === 1 && r.dia === 4 && Math.abs(r.hora - 0.6) < 0.01);
ch('vuelve la forma del terreno', r.cambios > 5, `${r.cambios} vértices cambiados`);
r = await correr(pg, `J.menu.abrir('jugar'); return [...document.querySelectorAll('#opciones button')].map((b) => b.textContent);`);
ch('con partida guardada, JUGAR ofrece continuar', r[0] === 'CONTINUAR', r.join(' · '));
await correr(pg, `I.borrar();`);
await pg.close();

// ── rendimiento (SwiftShader: lo dibujado no representa una placa de video) ──
console.log('── números');
pg = await abrir('nueva&idioma=es');
r = await correr(pg, `
  jugar();
  const t0 = performance.now(); pasos(120); const logica = (performance.now() - t0) / 120;
  const R = J.renderer; R.info.autoReset = false; R.info.reset(); I.paso(1 / 60); const info = { tri: R.info.render.triangles, llamadas: R.info.render.calls }; R.info.autoReset = true;
  return { logica, ...info };`);
ch('la lógica de un cuadro entra holgada en 16 ms', r.logica < 8, `${r.logica.toFixed(2)} ms por cuadro sin dibujar`);
console.log(`     ${r.tri.toLocaleString('es-AR')} triángulos y ${r.llamadas} llamadas de dibujo en la playa`);
await pg.close();

ch('sin errores de JavaScript en toda la corrida', errores.length === 0, errores.slice(0, 3).join(' | '));
console.log(`\n  ${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
