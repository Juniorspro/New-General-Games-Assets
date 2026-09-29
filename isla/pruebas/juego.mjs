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
  // sin capturar el puntero: en Chromium sin pantalla la captura llega o se
  // suelta fuera de turno y el juego se pausa solo en medio de una prueba
  const jugar = () => { J.entrada.pedirCaptura = () => {}; J.empezar(false); pasos(50, 1 / 20); };
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
  // en la arena abierta del comienzo: al lado de una roca las celdas cambian con cada isla
  const s = J.mundo.spawn, t = J.mundo.muelle.punta;
  J.jugador.ponerEn(s, Math.atan2(-(t.x - s.x), -(t.z - s.z))); pasos(2);
  tener('bloqueMadera', 10); tener('mesa'); elegir('bloqueMadera'); J.jugador.pitch = -0.8; pasos(10);
  const n0 = J.bloques.mapa.size;
  for (let k = 0; k < 4; k++) { J.jugador.yaw += 0.4; pasos(1); J.entrada.botonesRecien.der = true; pasos(2); }
  // un poco más lejos: la celda pegada a los pies no vale (no se construye adentro de uno)
  elegir('mesa'); J.jugador.yaw += 0.5; J.jugador.pitch = -0.55; pasos(8); J.entrada.botonesRecien.der = true; pasos(2);
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
  // lejos de los bloques recién puestos: seis metros playa abajo
  const P = J.menu.P, sp = J.mundo.spawn;
  J.jugador.ponerEn(V(sp.x - P.x * 6, 0, sp.z - P.z * 6), Math.atan2(P.x, P.z)); J.jugador.pitch = -0.6; pasos(3);
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

// ── pelear ─────────────────────────────────────────────────────────────────
// Más ayudas: apretar el clic unos cuadros, el clic derecho y una tecla.
const PELEA = `
  const E = J.entrada;
  const apretar = (n) => { for (let i = 0; i < n; i++) { E.botones.izq = true; if (i === 0) E.botonesRecien.izq = true; I.paso(1 / 30, false); } E.botones.izq = false; };
  const der = () => { E.botonesRecien.der = true; I.paso(1 / 30, false); };
  const tecla = (c) => { E.recien.add(c); I.paso(1 / 30, false); };
  const ir = (x, z, y) => { J.jugador.ponerEn(V(x, y ?? J.fisica.suelo(x, z, 60), z), J.jugador.yaw); J.jugador.v.set(0, 0, 0); };
  const adelante = (d) => { const p = J.jugador.p, a = J.jugador.yaw; return V(p.x - Math.sin(a) * d, J.fisica.suelo(p.x - Math.sin(a) * d, p.z - Math.cos(a) * d, p.y + 5), p.z - Math.cos(a) * d); };
  // Un lugar en tierra con 10 m despejados adelante (sin agua, rocas ni
  // troncos en el medio): recorre una grilla fija, así cada corrida es igual.
  const despejado = (largo = 10, desnivel = 1.5) => {
    const T = J.mundo.terreno;
    for (let gx = -60; gx <= 60; gx += 6) for (let gz = -60; gz <= 60; gz += 6) for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, h0 = T.altura(gx, gz);
      let libre = h0 > 0.5 && h0 < 6;
      for (let u = 0; u <= largo && libre; u += 0.5) {
        const x = gx - Math.sin(a) * u, z = gz - Math.cos(a) * u, h = T.altura(x, z);
        if (h < 0.5 || Math.abs(h - h0) > desnivel || J.mundo.dentroDePiso(x, z, 1)) libre = false;
        else if (J.mundo.obstaculos(x, z, 0.8).some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.8)) libre = false;
      }
      if (libre) { ir(gx, gz); J.jugador.yaw = a; J.jugador.pitch = 0; return true; }
    }
    return false;
  };
`;
const pelea = (pg, cuerpo) => correr(pg, PELEA + cuerpo);
console.log('── pelear');
pg = await abrir('nueva&idioma=es');
r = await pelea(pg, `
  jugar(); J.enemigos.limpiar(false); J.enemigos.tPoblar = 1e9;
  tener('espadaPiedra'); elegir('espadaPiedra'); pasos(12);
  const q = adelante(1.8), c = J.enemigos.crear('cangrejo', q.x, q.y, q.z);
  J.jugador.pitch = -0.35;
  let golpes = 0;
  while (c.estado !== 'muerto' && golpes < 6) { apretar(16); golpes++; }
  pasos(30);
  return { golpes, muerto: c.estado === 'muerto' || !J.enemigos.lista.includes(c), carne: J.objetos.lista.some((o) => o.id === 'carneCangrejo'), vencidos: J.stats.enemigos || 0, numeros: document.querySelectorAll('#numeros .numero').length };`);
ch('la espada mata a un cangrejo en dos golpes', r.muerto && r.golpes <= 3, `${r.golpes} espadazos (6 de daño contra 10 de vida)`);
ch('suelta su carne, suma a la cuenta y salta el número', r.carne && r.vencidos === 1 && r.numeros > 0);
r = await pelea(pg, `
  J.enemigos.limpiar(false); J.cielo.hora = 0.95; pasos(5);
  despejado(); pasos(2);
  J.jugador.vida = 100; J.combate.invulnerable = 0;
  const q = adelante(4), e = J.enemigos.crear('esqueleto', q.x, q.y, q.z);
  let t = 0; while (J.jugador.vida >= 100 && t < 240) { pasos(1); t++; }
  const vio = e.estado !== 'paseo';
  // el daño con y sin peto (sin invulnerabilidad entre uno y otro)
  J.jugador.vida = 100; J.combate.invulnerable = 0; J.armadura = null; J.combate.danarJugador(12, e.p); const sin = 100 - J.jugador.vida;
  J.jugador.vida = 100; J.combate.invulnerable = 0; J.armadura = 'petoHierro'; J.combate.danarJugador(12, e.p); const con = 100 - J.jugador.vida;
  J.armadura = null; J.jugador.vida = 100;
  // al amanecer se quema
  J.cielo.hora = 0.3; pasos(8);
  let q2 = 0; while (J.enemigos.lista.includes(e) && q2 < 150) { pasos(1); q2++; }
  return { vio, t: t / 30, sin, con, quemado: !J.enemigos.lista.includes(e), q2: q2 / 30 };`);
ch('de noche el esqueleto te ve, viene y te pega', r.vio && r.t < 8, `el primer golpe a los ${r.t.toFixed(1)} s`);
ch('el peto de hierro baja el daño', r.sin === 12 && r.con === 7, `${r.sin} sin peto, ${r.con} con`);
ch('al amanecer los esqueletos se queman', r.quemado, `${r.q2.toFixed(1)} s de sol`);
r = await pelea(pg, `
  J.enemigos.limpiar(false);
  // plano: una loma en el medio frena la flecha
  despejado(10, 0.4); pasos(2);
  tener('arco'); tener('flecha', 5); elegir('arco'); pasos(12);
  const q = adelante(9), c = J.enemigos.crear('cangrejo', q.x, q.y, q.z);
  c.T = { ...c.T, vel: 0 };
  mirar(c.p.x, c.p.y + 0.5, c.p.z); J.jugador.pitch += 0.05;
  for (let i = 0; i < 30; i++) { E.botones.izq = true; I.paso(1 / 30, false); }
  const carga = J.combate.carga;
  E.botones.izq = false; I.paso(1 / 30, false);
  pasos(40);
  return { carga, flechas: J.inv.contar('flecha'), muerto: c.estado === 'muerto' || !J.enemigos.lista.includes(c) };`);
ch('el arco se tensa y la flecha voltea a un cangrejo a 9 m', r.carga > 0.99 && r.muerto && r.flechas === 4, `tensado ${Math.round(r.carga * 100)} %, quedan ${r.flechas} flechas`);
r = await pelea(pg, `
  J.enemigos.limpiar(false); J.enemigos.tPoblar = 1e9;
  tener('fogata'); elegir('fogata'); pasos(12); J.jugador.pitch = -0.6; pasos(2); der(); pasos(2);
  const f = J.bloques.fogatas[0];
  if (!f) return { sin: true };
  J.cielo.hora = 0.95; pasos(5);
  // alrededor de la fogata: cien intentos de aparecer, ninguno a menos de 15 m
  let cercanos = 0;
  for (let i = 0; i < 100; i++) { J.enemigos.aparecerNoche(); J.enemigos.aparecerPlaya(); }
  for (const e of J.enemigos.lista) if (Math.hypot(e.p.x - f.x - 0.5, e.p.z - f.z - 0.5) < 15) cercanos++;
  const total = J.enemigos.lista.length;
  J.enemigos.limpiar(false);
  ir(f.x + 0.5 + 1.6, f.z + 0.5); mirar(f.x + 0.5, f.y + 0.3, f.z + 0.5);
  tener('carneCangrejo', 2); elegir('carneCangrejo'); pasos(12); der(); pasos(2);
  J.cielo.hora = 0.3;
  return { total, cercanos, asado: J.inv.contar('cangrejoAsado'), carne: J.inv.contar('carneCangrejo') };`);
ch('la fogata espanta: nada aparece a menos de 15 m', !r.sin && r.total > 5 && r.cercanos === 0, r.sin ? 'no se puso' : `${r.total} aparecieron, ${r.cercanos} cerca`);
ch('en la fogata se cocina (clic derecho)', r.asado === 1 && r.carne === 1);
await pg.close();

pg = await abrir('nueva&idioma=es');
r = await pelea(pg, `
  jugar();
  const S = J.mina.salaJefe;
  J.ponerBajo(true); ir(S.x, S.z, -60);
  J.enemigos.tPoblar = 0; pasos(3);
  const g = J.enemigos.jefe;
  if (!g) return { sinJefe: true };
  tener('espadaAmatista'); elegir('espadaAmatista'); pasos(12);
  ir(g.p.x + 2.6, g.p.z, g.p.y);
  let k = 0, enojo = null;
  while (g.estado !== 'muerto' && k < 120) { J.jugador.vida = 100; mirar(g.p.x, g.p.y + 1.6, g.p.z); apretar(12); k++; if (g.enojado && enojo === null && g.vida < g.T.vida * 0.5) enojo = Math.round(g.vida); }
  pasos(30);
  return { k, vencido: J.enemigos.jefeVencido, corazon: J.objetos.lista.some((o) => o.id === 'corazonCristal'), enojo, barra: J.hud.elJefe };`);
ch('el guardián espera en la sala más honda de la mina', !r.sinJefe);
ch('se lo vence y suelta el corazón de cristal', r.vencido && r.corazon, `${r.k} tandas de espadazos`);
await pg.close();

// ── la historia: botella, faro, barco, final ───────────────────────────────
console.log('── la historia');
pg = await abrir('nueva&idioma=es');
r = await pelea(pg, `
  jugar();
  const cap = J.historia.capitulo, cartel = document.getElementById('cartel').textContent;
  const botella = J.objetos.lista.find((o) => o.id === 'botella');
  const aBarco = botella ? botella.g.position.distanceTo(J.historia.posNaufragio) : 99;
  tener('botella'); elegir('botella'); pasos(12); der();
  const abierta = !document.getElementById('carta').classList.contains('oculto'), estado = J.estado;
  document.getElementById('carta').dispatchEvent(new PointerEvent('pointerdown'));
  return { cap, cartel, aBarco, abierta, estado, despues: J.estado, carta: J.historia.carta };`);
ch('se arranca en el capítulo 1 con su cartel', r.cap === 1 && r.cartel.startsWith('Capítulo 1'), r.cartel.slice(0, 30));
ch('la botella de la primera carta está junto al barco roto', r.aBarco < 7, `a ${r.aBarco.toFixed(1)} m`);
ch('clic derecho la lee; un toque la cierra', r.abierta && r.estado === 'ventana' && r.despues === 'jugando' && r.carta === 1);
r = await pelea(pg, `
  const H = J.historia, F = H.faro;
  ir(F.puerta.x, F.puerta.z); mirar(F.pos.x, F.pos.y + 2, F.pos.z); pasos(3);
  tener('madera', 20); tener('hierro', 4); tener('cuarzo', 3); tener('oro', 1); tener('corazonCristal', 1); tener('estrella', 1);
  J.cielo.hora = 0.5; pasos(2);
  tecla('KeyE');
  const tab = J.hud.abierta, boton = (i) => [...document.querySelectorAll('#vCuerpo .receta button')][i];
  boton(0).click(); boton(1).click(); boton(2).click();
  const deDia = F.etapa, trabado = boton(3).disabled;
  J.hud.cerrar(); J.cielo.hora = 0.9; pasos(5); tecla('KeyE'); boton(3).click(); J.hud.cerrar();
  return { tab, deDia, trabado, etapa: F.etapa, barco: H.estadoBarco, sobra: ['madera', 'hierro', 'cuarzo', 'oro', 'corazonCristal', 'estrella'].map((id) => J.inv.contar(id)).join('') };`);
ch('E en la puerta del faro abre sus arreglos', r.tab === 'faro');
ch('tres arreglos de día; la luz, solo de noche', r.deDia === 3 && r.trabado && r.etapa === 4, `etapa ${r.deDia} de día, ${r.etapa} de noche`);
ch('cada arreglo gasta lo que pide', r.sobra === '000000');
r = await pelea(pg, `
  const H = J.historia;
  J.cielo.hora = 0.3; pasos(3);
  const viene = H.estadoBarco;
  let s = 0; while (H.estadoBarco === 'viene' && s < 120) { pasos(10, 1 / 5); s++; }
  if (!H.barco) return { viene, sinBarco: true, hora: J.cielo.hora, estado: J.estado, bajo: J.bajo, etapa: H.faro.etapa };
  const b = H.barco.position;
  ir(J.mundo.muelle.punta.x, J.mundo.muelle.punta.z); mirar(b.x, b.y + 2, b.z); pasos(3);
  tecla('KeyE');
  const fin = !document.getElementById('final').classList.contains('oculto');
  document.getElementById('finalSeguir').click(); pasos(3);
  return { viene, llego: H.estadoBarco, segundos: s * 2, fin, rescatado: H.rescatado, estado: J.estado, cap: H.capitulo };`);
ch('al amanecer viene un barco y amarra en el muelle', r.viene === 'viene' && r.llego === 'llego', r.sinBarco ? JSON.stringify(r) : `${r.segundos} s de viaje`);
ch('subir al barco es el final; después se sigue jugando', r.fin && r.rescatado && r.estado === 'jugando' && r.cap === 6);
await pg.close();

// ── el resto: mercader, tesoro, plantar, mapa, tercera persona ─────────────
console.log('── mercader, tesoro, plantar, mapa, vistas');
pg = await abrir('nueva&idioma=es');
r = await pelea(pg, `
  jugar();
  const M = J.mercader;
  J.cielo.hora = 0.5; pasos(2);
  const dia1 = M.grupo.visible;
  J.dia = 2; pasos(2);
  let mejor = null;
  for (const q of J.mundo.pisos) for (let x = q.x0 + 0.3; x < q.x1; x += 0.4) for (let z = q.z0 + 0.3; z < q.z1; z += 0.4) { const d = Math.hypot(x - M.pos.x, z - M.pos.z); if (!mejor || d < mejor.d) mejor = { x, z, d, y: q.y }; }
  ir(mejor.x, mejor.z, mejor.y + 0.01); mirar(M.pos.x, 1.2, M.pos.z); pasos(3);
  tener('rubi', 2);
  tecla('KeyE');
  const tab = J.hud.abierta;
  J.mercader.vender(J.inv, J.inv.ranuras.findIndex((r) => r && r.id === 'rubi'), false);
  const plata = J.plata;
  J.plata = 5000; J.hud.render();
  const b = [...document.querySelectorAll('#vCuerpo .recetas .receta')].find((d) => d.textContent.includes('tesoro'));
  if (b) b.querySelector('button').click();
  J.hud.cerrar();
  return { dia1, dia2: M.grupo.visible, tab, plata, precio: Math.round(ITEMS_RUBI * 0.8), mapa: J.inv.contar('mapaTesoro'), resto: J.plata };`.replace('ITEMS_RUBI', '2800'));
ch('el mercader no viene el primer día; desde el segundo, sí', !r.dia1 && r.dia2);
ch('compra al 80 % y vende el mapa del tesoro', r.tab === 'tienda' && r.plata === r.precio && r.mapa === 1 && r.resto === 3800, `un rubí: ${r.plata}`);
r = await pelea(pg, `
  const T = J.mapa.tesoro;
  tener('pala'); tener('piedra', 20); elegir('pala'); pasos(12);
  ir(T.x + 3, T.z); J.acciones.pincel = 1;
  const cruz = J.mapa.cruz.visible;
  let k = 0; while (!T.encontrado && k < 40) { mirar(T.x, J.mundo.terreno.altura(T.x, T.z), T.z); apretar(10); k++; }
  pasos(20);
  return { cruz, encontrado: T.encontrado, oro: J.objetos.lista.filter((o) => o.id === 'oro').length, segundos: k / 3 };`);
ch('con el mapa, la X aparece y la pala saca el cofre', r.cruz && r.encontrado && r.oro >= 1, `${r.segundos.toFixed(1)} s de cavar`);
r = await pelea(pg, `
  const T = J.mundo.terreno, P = J.mundo.veg.palmeras.filter((q) => q.viva);
  let lugar = null;
  for (let i = 0; i < 4000 && !lugar; i++) {
    const x = (Math.random() * 2 - 1) * 80, z = (Math.random() * 2 - 1) * 80, h = T.altura(x, z);
    if (h < 1 || h > 6 || T.pasto(x, z) < 0.5 || P.some((q) => Math.hypot(q.x - x, q.z - z) < 6) || J.mundo.dentroDePiso(x, z, 3)) continue;
    lugar = { x, z };
  }
  ir(lugar.x, lugar.z + 3); mirar(lugar.x, T.altura(lugar.x, lugar.z), lugar.z);
  tener('coco', 2); elegir('coco'); pasos(12); der();
  const p = J.mundo.veg.palmeras.find((q) => q.reserva && q.viva);
  if (!p) return { sin: true };
  const chica = p.copa.y - p.y;
  for (let i = 0; i < 120; i++) J.mundo.veg.crecer(5);
  return { chica, grande: p.copa.y - p.y, cocos: p.cocosQuedan, coco: J.inv.contar('coco'), plantadas: J.mundo.veg.plantadas().length };`);
ch('un coco se planta y crece hasta ser palmera con cocos', !r.sin && r.grande > r.chica * 3 && r.cocos > 0 && r.coco === 1, r.sin ? 'no se plantó' : `${r.chica.toFixed(1)} m → ${r.grande.toFixed(1)} m`);
r = await pelea(pg, `
  tecla('KeyM');
  const mapa = !document.getElementById('mapa').classList.contains('oculto'), estado = J.estado;
  document.getElementById('mapa').dispatchEvent(new PointerEvent('pointerdown'));
  const cerrado = document.getElementById('mapa').classList.contains('oculto') && J.estado === 'jugando';
  tecla('KeyV'); pasos(3);
  const tercera = { on: J.terceraPersona, d: J.camara.position.distanceTo(J.ojos), visible: J.personaje.grupo.visible };
  tecla('KeyV'); pasos(3);
  return { mapa, estado, cerrado, tercera, primera: J.camara.position.distanceTo(J.ojos), visible: J.personaje.grupo.visible };`);
ch('M abre el mapa (suelta el puntero) y un toque lo cierra', r.mapa && r.estado === 'ventana' && r.cerrado);
ch('V pasa a tercera persona: la cámara atrás y el náufrago a la vista', r.tercera.on && r.tercera.d > 2 && r.tercera.visible && r.primera < 0.01 && !r.visible, `${r.tercera.d.toFixed(1)} m detrás`);
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
  // lo de la historia: plata, peto, faro, el guardián y una palmera plantada
  J.plata = 1234; J.armadura = 'petoCaparazon'; J.historia.faro.ponerEtapa(2); J.historia.carta = 2; J.enemigos.jefeVencido = true;
  J.mundo.veg.plantar(J.jugador.p.x + 6, J.mundo.terreno.altura(J.jugador.p.x + 6, J.jugador.p.z + 6), J.jugador.p.z + 6, 0.5);
  I.guardar();
  return { palmera: P.id, tam: localStorage.getItem('isla_v1').length };`);
const guardado = r;
// sin ?nueva: esta vez tiene que leer lo guardado
await pg.goto(URL + 'idioma=es');
await pg.waitForFunction(() => window.__isla && window.__isla.listo, null, { timeout: 90000 });
r = await correr(pg, `
  return { taladas: J.mundo.veg.palmeras.filter((p) => !p.viva).map((p) => p.id), rubi: [...J.bloques.cofres.values()].map((c) => c.contar('rubi'))[0],
    pico: J.inv.contar('picoHierro'), dia: J.dia, hora: J.cielo.hora, cambios: J.mundo.terreno.diferencias().a.length / 2,
    plata: J.plata, peto: J.armadura, etapa: J.historia.faro.etapa, carta: J.historia.carta, jefe: J.enemigos.jefeVencido,
    plantadas: J.mundo.veg.plantadas(),
    opciones: [...document.querySelectorAll('#opciones button')].map((b) => b.textContent) };`);
ch('se guarda poco', guardado.tam < 20000, `${(guardado.tam / 1024).toFixed(1)} KB`);
ch('vuelve la palmera talada', r.taladas.includes(guardado.palmera));
ch('vuelve el cofre con lo de adentro', r.rubi === 3);
ch('vuelven el inventario, el día y la hora', r.pico === 1 && r.dia === 4 && Math.abs(r.hora - 0.6) < 0.01);
ch('vuelve la forma del terreno', r.cambios > 5, `${r.cambios} vértices cambiados`);
ch('vuelven la plata, el peto, el faro, las cartas y el guardián vencido', r.plata === 1234 && r.peto === 'petoCaparazon' && r.etapa === 2 && r.carta === 2 && r.jefe);
ch('vuelve la palmera plantada, a medio crecer', r.plantadas.length === 1 && Math.abs(r.plantadas[0][2] - 0.5) < 0.01);
r = await correr(pg, `J.menu.abrir('jugar'); return [...document.querySelectorAll('#opciones button')].map((b) => b.textContent);`);
ch('con partida guardada, JUGAR ofrece continuar', r[0] === 'CONTINUAR', r.join(' · '));
await correr(pg, `I.borrar();`);
await pg.close();

// ── el teléfono parado: la app se juega acostada ──────────────────────────
console.log('── el teléfono parado');
{
  const ctxM = await nav.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const pm = await ctxM.newPage();
  pm.on('pageerror', (e) => errores.push(e.message));
  await pm.goto(URL + 'nueva&idioma=es');
  await pm.waitForFunction(() => window.__isla && window.__isla.listo, null, { timeout: 90000 });
  r = await pm.evaluate(`(async () => { ${AYUDAS}
    J.empezar(false); pasos(50, 1 / 20);
    const app = document.getElementById('app').getBoundingClientRect(), barra = document.getElementById('barra').getBoundingClientRect();
    const lienzo = J.renderer.getDrawingBufferSize(new THREE.Vector2());
    return { girada: document.documentElement.classList.contains('girada'), app: [app.width, app.height], ancho: lienzo.x > lienzo.y,
      // girada 90° (horario): la barra de abajo de la app queda contra el borde izquierdo del teléfono
      barraIzquierda: barra.right < innerWidth * 0.2, dedos: !document.getElementById('dedos').classList.contains('oculto') };
  })()`);
  ch('parado, la app se gira y se juega acostada', r.girada && r.app[0] === 412 && r.app[1] === 892 && r.ancho, `lienzo apaisado: ${r.ancho}`);
  ch('la barra y los dedos quedan del lado que corresponde', r.barraIzquierda && r.dedos, JSON.stringify({ izq: r.barraIzquierda, dedos: r.dedos }));
  await ctxM.close();
}

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
