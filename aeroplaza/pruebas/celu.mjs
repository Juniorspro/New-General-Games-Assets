// EL CELU Y LOS AMIGOS (vuelta 46): tres jugadores contra el broker local (pruebas/broker.mjs).
// - la llave: el id es la huella de la llave pública, y el perfil queda retenido;
// - el celu se abre con 📱 y la M, tiene sus apps, y el muñeco lo tiene en la mano (el otro lo ve);
// - Ana le manda una solicitud a Beto por su código, Beto la acepta desde el celu, y los dos son amigos;
// - los mensajes llegan, se ven como texto, el broker solo ve lo cifrado, y el "visto" vuelve;
// - Unirse lleva a la misma sala del amigo (en otro reino); un mensaje llega aunque estaba desconectado;
// - Carla trata de hacerse pasar por Ana (otra llave, la llave de Ana sin la suya, una carta vieja repetida): nada pasa;
// - quitar, rechazar, bloquear y "que nadie me mande solicitudes";
// - en el VR el espejo lo lee (cada botón con su texto), y los textos están en los tres idiomas;
// - las fotos del celu parado (compu) y acostado (el celu del jugador).
//     node pruebas/celu.mjs
import fs from 'node:fs';
import path from 'node:path';
import { navegador, abrir, avanzar, SAL, AQUI, clienteMQTT } from './comun.mjs';
import { broker } from './broker.mjs';

const B = await broker(0);
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const NS = 'aeroplaza_v1_';
/* todos avanzan a la vez, sin dibujar, dejando que lleguen los mensajes */
async function juntos(pags, segundos, cada = 0.1) {
  for (let t = 0; t < segundos; t += cada) { await Promise.all(pags.map((p) => avanzar(p, Math.round(cada * 30), 1 / 30, false).catch(() => {}))); await esperar(25); }
}
const q = (n) => `directo&pausa&calidad=baja&nombre=${n}&broker=${encodeURIComponent(B.url)}`;
const listo = (p) => p.waitForFunction(() => window.__A && window.__A.yo && document.querySelector('.hud') && window.__A.red.estado === 'en_linea' && window.__A.amigos.listo, null, { timeout: 90000, polling: 200 });
/* volver a abrir la misma página en el mismo contexto (el mismo localStorage: la misma llave) */
async function reabrir(x, nombre) {
  const pag = await x.ctx.newPage();
  pag.on('pageerror', (e) => x.errores.push('pageerror: ' + e.message));
  await pag.route(/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//, (r) => r.fulfill({ body: fs.readFileSync(clienteMQTT()), contentType: 'text/javascript' }));
  await pag.goto('file://' + path.join(AQUI, '..', 'aeroplaza.html') + '?' + q(nombre));
  await listo(pag); await avanzar(pag, 1);
  return pag;
}

const A = await abrir(nav, q('Ana'), { red: 'local', ancho: 1280, alto: 720 });
const Bt = await abrir(nav, q('Beto'), { red: 'local', ancho: 844, alto: 390, movil: true });
const C = await abrir(nav, q('Carla'), { red: 'local', ancho: 640, alto: 360 });
for (const x of [A, Bt, C]) await listo(x.pag);
for (const x of [A, Bt, C]) await avanzar(x.pag, 1);
let pags = [A.pag, Bt.pag, C.pag];
/* (los avisos de Ana, todos: duran unos segundos y en la pantalla se reemplazan) */
await A.pag.evaluate(() => { const U = window.__A.UI, f = U.notificar.bind(U); window.__notis = []; U.notificar = (o) => { window.__notis.push((o.titulo || '') + ' · ' + (o.texto || '')); return f(o); }; });
await juntos(pags, 1.5);

/* ------------------------------------------------ 1) la llave */
const yo = (p) => p.evaluate(async () => {
  const { Llave, J } = window.__A, b = Uint8Array.from(atob(Llave.pub), (c) => c.charCodeAt(0));
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 12);
  return { id: J.id, huella: h, pub: Llave.pub, guardada: localStorage.getItem('aeroplaza_id') };
});
const [ya, yb, yc] = [await yo(A.pag), await yo(Bt.pag), await yo(C.pag)];
prueba('el id de cada uno es la huella de su llave (12 hex) y queda guardado', [ya, yb, yc].every((y) => /^[0-9a-f]{12}$/.test(y.id) && y.id === y.huella && y.guardada === y.id) && new Set([ya.id, yb.id, yc.id]).size === 3, [ya, yb, yc].map((y) => y.id).join(' / '));
const perfilA = JSON.parse(B.retenido(NS + 'perfil/' + ya.id)?.toString() || 'null');
prueba('el perfil de Ana queda retenido en el broker (su llave y su nombre)', perfilA && perfilA.pub === ya.pub && perfilA.name === 'Ana');

/* ------------------------------------------------ 2) el celu */
await A.pag.click('.hud [data-a=celu]');
await avanzar(A.pag, 2, 1 / 30, false);
const inicio = await A.pag.evaluate(() => { const v = document.querySelector('.velo-celu .ventana.celu'); return v ? { apps: v.querySelectorAll('.cel-app').length, abierto: window.__A.J.celu.abierto, bloq: window.__A.J.ent.bloqueado } : null; });
prueba('📱 abre el celu con sus 16 apps (y la entrada del juego queda quieta)', inicio && inicio.apps === 16 && inicio.abierto && inicio.bloq, JSON.stringify(inicio));
await juntos(pags, 0.8);
const enMano = await Bt.pag.evaluate((id) => { const r = window.__A.remotos.get(id); return r ? { con: r.m.conCelu, ve: !!r.m.celu?.visible } : null; }, ya.id);
prueba('Beto ve a Ana con el celu en la mano', enMano && enMano.con && enMano.ve, JSON.stringify(enMano));
await A.pag.evaluate(() => { const c = document.querySelector('.ventana.celu'); c.querySelector('[data-app=amigos]').click(); c.querySelector('[data-tab=agregar]').click(); });
const codB = yb.id.replace(/(.{4})(?=.)/g, '$1·');
await A.pag.fill('.cel-cod', codB.toUpperCase());
await juntos(pags, 1.2);
const vistaPrev = await A.pag.evaluate(() => document.querySelector('.cel-res')?.textContent || '');
prueba('al escribir el código (con puntos y en mayúscula) aparece quién es', /Beto/.test(vistaPrev), vistaPrev);
await A.pag.click('.cel-form button[type=submit]');
const res = await A.pag.evaluate(() => document.querySelector('.cel-res')?.textContent || '');
prueba('"Mandar": solicitud enviada', /enviada/i.test(res), res);
await juntos(pags, 1.5);
const sol = await Bt.pag.evaluate((id) => ({ e: window.__A.amigos.estado(id), noti: [...document.querySelectorAll('.notis .noti')].map((n) => n.textContent).join(' | '), insignia: document.querySelector('.hud [data-a=celu] .insignia')?.textContent }), ya.id);
prueba('a Beto le llega: aviso "Ana te quiere agregar" y el globito rojo del 📱', sol.e === 'recibida' && /Ana te quiere agregar/.test(sol.noti) && sol.insignia === '1', JSON.stringify(sol));
/* Beto la acepta desde su celu (con la M): se abre en Solicitudes */
await Bt.pag.keyboard.press('KeyM'); await avanzar(Bt.pag, 2, 1 / 30, false);
const tabB = await Bt.pag.evaluate(() => { const c = window.__A.J.celu; return c.abierto; });
await Bt.pag.evaluate(() => document.querySelector('.ventana.celu [data-app=amigos]').click());
const tabSol = await Bt.pag.evaluate(() => document.querySelector('.cel-tab.si')?.dataset.tab);
prueba('la M abre el celu, y Amigos entra en Solicitudes si hay alguna', tabB && tabSol === 'sol', tabSol);
await Bt.pag.evaluate((id) => document.querySelector(`[data-aceptar="${id}"]`).click(), ya.id);
await juntos(pags, 1.5);
const ea = await A.pag.evaluate((id) => ({ e: window.__A.amigos.estado(id), noti: [...document.querySelectorAll('.notis .noti')].map((n) => n.textContent).join(' | ') }), yb.id);
const eb = await Bt.pag.evaluate((id) => window.__A.amigos.estado(id), ya.id);
prueba('aceptada: los dos son amigos y Ana se entera ("aceptó tu solicitud")', ea.e === 'amigo' && eb === 'amigo' && /aceptó tu solicitud/.test(ea.noti), JSON.stringify({ ...ea, eb }));
await A.pag.evaluate(() => { const c = window.__A.J.celu; c.tab = 'lista'; c.ir('amigos'); c.pintar(); });
const fila = await A.pag.evaluate(() => document.querySelector('.cel-lista .cel-fila')?.textContent.replace(/\s+/g, ' ').trim());
prueba('en la lista de Ana: Beto, en línea y dónde está', /Beto/.test(fila || '') && /En Plaza/.test(fila || ''), fila);
/* guardo la carta de Ana a Beto de ahora (amigos): después Carla la repite */
const cartaVieja = B.retenido(NS + 'buzon/' + yb.id + '/' + ya.id)?.toString();

/* ------------------------------------------------ 3) los mensajes */
await A.pag.evaluate((id) => document.querySelector(`.cel-fila [data-chat="${id}"]`).click(), yb.id);
await A.pag.fill('.cel-texto', '¡hola Beto! <b>no es html</b>');
await A.pag.click('.cel-escribir button[type=submit]');
await juntos(pags, 1.5);
const sobre = B.retenido(NS + 'buzon/' + yb.id + '/' + ya.id)?.toString() || '';
const s = JSON.parse(sobre || '{}');
prueba('el broker solo ve lo cifrado (id, llave, iv y el cifrado; ni el mensaje ni el nombre)', sobre && !/hola|Beto|Ana|amigo/.test(sobre) && Object.keys(s).sort().join() === 'c,id,iv,pub', Object.keys(s).join());
const msgB = await Bt.pag.evaluate(() => ({ noti: [...document.querySelectorAll('.notis .noti')].map((n) => n.textContent).join(' | '), insignia: document.querySelector('.hud [data-a=celu] .insignia')?.textContent }));
const msgBabierto = await Bt.pag.evaluate(() => window.__A.J.celu.abierto);
if (msgBabierto) await Bt.pag.evaluate(() => window.__A.J.celu.cerrar());
prueba('a Beto le llega el mensaje (aviso con lo que dice)', /hola Beto/.test(msgB.noti), JSON.stringify(msgB));
await Bt.pag.evaluate((id) => window.__A.J.celu.abrir('chat:' + id), ya.id);
await juntos(pags, 1.2);
const globo = await Bt.pag.evaluate(() => { const g = [...document.querySelectorAll('.cel-globo.suyo')].at(-1); return g ? { txt: g.firstChild.textContent, html: !!g.querySelector('b') } : null; });
prueba('en la charla de Beto: el globito con el texto tal cual (no es HTML)', globo && globo.txt === '¡hola Beto! <b>no es html</b>' && !globo.html, JSON.stringify(globo));
const visto = await A.pag.evaluate(() => document.querySelector('.cel-visto')?.textContent || '');
prueba('y a Ana le vuelve el "visto"', /Visto/.test(visto), visto);
await Bt.pag.fill('.cel-texto', 'hola Ana 😀');
await Bt.pag.evaluate(() => document.querySelector('.cel-escribir button[type=submit]').click());
await juntos(pags, 1.2);
const globoA = await A.pag.evaluate(() => [...document.querySelectorAll('.cel-globo.suyo')].map((g) => g.firstChild.textContent));
prueba('la respuesta aparece sola en la charla abierta de Ana', globoA.includes('hola Ana 😀'), globoA.join(' | '));
await A.pag.evaluate(() => window.__A.J.celu.cerrar());
await juntos(pags, 0.8);
const sinMano = await Bt.pag.evaluate((id) => window.__A.remotos.get(id)?.m.conCelu, ya.id);
prueba('al cerrarlo, Ana guarda el celu', sinMano === false);

/* ------------------------------------------------ 4) unirse, y un mensaje sin conexión */
await Bt.pag.evaluate(() => { window.__A.J.celu.cerrar(); window.__A.viajar('aqua'); });
await juntos(pags, 3);
await A.pag.evaluate(() => window.__A.J.celu.abrir('amigos'));
const lugarB = await A.pag.evaluate(() => document.querySelector('.cel-lista .cel-fila')?.textContent || '');
prueba('Ana ve que Beto se fue a Aqua', /En Aqua/.test(lugarB), lugarB.replace(/\s+/g, ' ').trim());
await A.pag.evaluate((id) => document.querySelector(`[data-unirse="${id}"]`).click(), yb.id);
await juntos(pags, 3);
const salas = await Promise.all([A.pag, Bt.pag].map((p) => p.evaluate(() => ({ sala: window.__A.red.sala, reino: window.__A.reino?.id }))));
prueba('"Unirse" lleva a Ana a la misma sala que Beto', salas[0].sala === salas[1].sala && salas[0].reino === 'aqua', JSON.stringify(salas));
await Bt.pag.close();
pags = [A.pag, C.pag];
/* (13 s afuera: el vestíbulo borra al que no avisa en 12 s; volver antes es como recargar, no "conectarse") */
await esperar(12600); await juntos(pags, 1.5);   // (el vestíbulo cuenta con el reloj de verdad, no con el del juego)
const fuera = await A.pag.evaluate((id) => !window.__A.amigos.donde(id), yb.id);
await A.pag.evaluate((id) => window.__A.amigos.escribir(id, '¿estás?'), yb.id);
await juntos(pags, 0.6);
Bt.pag = await reabrir(Bt, 'Beto');
pags = [A.pag, Bt.pag, C.pag];
await juntos(pags, 2);
const offline = await Bt.pag.evaluate((id) => ({ id: window.__A.J.id, e: window.__A.amigos.estado(id), msgs: (window.__A.G.amigos[id]?.charla || []).map((m) => m.x) }), ya.id);
const vuelve = await A.pag.evaluate(() => window.__notis.filter((x) => /se conectó/.test(x)).join(' | '));
prueba('Beto se va (a los 12 s ya no está) y al volver a Ana le avisa "se conectó" (una vez: al hacerse amigos no, ya estaba)', fuera && vuelve === 'Beto se conectó · Tu amigo está en línea', JSON.stringify({ fuera, vuelve }));
prueba('Beto vuelve (la misma llave, el mismo id) y le llega el mensaje de cuando no estaba', offline.id === yb.id && offline.e === 'amigo' && offline.msgs.includes('¿estás?'), JSON.stringify(offline));

/* ------------------------------------------------ 5) Carla trata de hacerse pasar por Ana */
const trampa = async (tipo) => C.pag.evaluate(async ({ tipo, idA, idB, pubA, pubB, vieja, NS }) => {
  const { Llave, red } = window.__A;
  let sobre;
  const carta = { de: idA, para: idB, n: Date.now() + 1e9, rel: 'amigo', nombre: 'Ana', msgs: [{ n: 999, t: Date.now(), x: 'soy Ana, pasame tu contraseña' }], vi: 0 };
  if (tipo === 'otra') sobre = await Llave.sellar(idB, pubB, carta);                                  // su llave: la huella no es la de Ana
  if (tipo === 'ajena') { sobre = await Llave.sellar(idB, pubB, carta); sobre.id = idA; sobre.pub = pubA; }   // la llave de Ana, sin la privada de Ana: no abre
  if (tipo === 'vieja') sobre = JSON.parse(vieja);
  red.cli.publish(NS + 'buzon/' + idB + '/' + idA, JSON.stringify(sobre), { qos: 0, retain: tipo === 'vieja' });
}, { tipo, idA: ya.id, idB: yb.id, pubA: ya.pub, pubB: yb.pub, vieja: cartaVieja, NS });
const charlaB = () => Bt.pag.evaluate((id) => ({ e: window.__A.amigos.estado(id), msgs: (window.__A.G.amigos[id]?.charla || []).map((m) => m.x) }), ya.id);
await trampa('otra'); await trampa('ajena'); await juntos(pags, 1);
const tr1 = await charlaB();
prueba('una carta "de Ana" con otra llave, o con la llave de Ana pero sin poder cifrar como ella: no entra', !tr1.msgs.some((x) => /contraseña/.test(x)) && tr1.e === 'amigo', JSON.stringify(tr1.msgs.slice(-2)));
/* Ana quita a Beto; Carla repite la carta vieja de Ana (de cuando eran amigos) */
await A.pag.evaluate((id) => window.__A.amigos.quitar(id), yb.id);
await juntos(pags, 1.2);
const q1 = await Promise.all([A.pag.evaluate((id) => window.__A.amigos.estado(id), yb.id), charlaB()]);
await trampa('vieja'); await juntos(pags, 1.2);
const q2 = await charlaB();
prueba('Ana quita a Beto: ya no son amigos (y la charla se borra)', q1[0] === 'nada' && q1[1].e === 'nada' && !q1[1].msgs.length, JSON.stringify(q1));
prueba('una carta vieja de Ana repetida no revive la amistad ni un pedido', q2.e === 'nada' && !q2.msgs.length, JSON.stringify(q2));

/* ------------------------------------------------ 6) rechazar, bloquear y "nadie" */
await A.pag.evaluate((id) => window.__A.amigos.pedir(id), yb.id);
await juntos(pags, 1.2);
const r0 = await Bt.pag.evaluate((id) => window.__A.amigos.estado(id), ya.id);
await Bt.pag.evaluate((id) => window.__A.amigos.rechazar(id), ya.id);
await juntos(pags, 1.2);
const r1 = await Promise.all([A.pag.evaluate((id) => window.__A.amigos.estado(id), yb.id), Bt.pag.evaluate((id) => window.__A.amigos.estado(id), ya.id)]);
prueba('Ana le vuelve a pedir, Beto rechaza: a Ana se le va la enviada', r0 === 'recibida' && r1[0] === 'nada' && r1[1] === 'nada', JSON.stringify({ r0, r1 }));
await A.pag.evaluate((id) => window.__A.amigos.pedir(id), yb.id);
await juntos(pags, 1.2);
const r2 = await Bt.pag.evaluate((id) => window.__A.amigos.estado(id), ya.id);
prueba('un pedido nuevo después del rechazo sí vuelve a aparecer', r2 === 'recibida', r2);
await C.pag.evaluate((id) => window.__A.amigos.pedir(id), yb.id);
await juntos(pags, 1.2);
const c0 = await Bt.pag.evaluate((id) => window.__A.amigos.estado(id), yc.id);
await Bt.pag.evaluate((id) => window.__A.amigos.bloquear(id), yc.id);
await juntos(pags, 1.2);
await C.pag.evaluate((id) => { window.__A.G.amigos[id].mia = null; return window.__A.amigos.pedir(id); }, yb.id);
await juntos(pags, 1.2);
const c1 = await Promise.all([Bt.pag.evaluate((id) => ({ e: window.__A.amigos.estado(id), recibidas: window.__A.amigos.recibidas }), yc.id), C.pag.evaluate((id) => window.__A.amigos.estado(id), yb.id)]);
prueba('Beto bloquea a Carla: su pedido se va y los de después no llegan', c0 === 'recibida' && c1[0].e === 'bloqueado' && c1[0].recibidas === 1, JSON.stringify({ c0, c1 }));
await Bt.pag.evaluate((id) => { window.__A.amigos.desbloquear(id); window.__A.G.amigosOp.pedidos = 'nadie'; delete window.__A.G.amigos[id]; }, yc.id);
await C.pag.evaluate((id) => { window.__A.G.amigos[id].mia = null; return window.__A.amigos.pedir(id); }, yb.id);
await juntos(pags, 1.2);
const c2 = await Bt.pag.evaluate((id) => window.__A.amigos.estado(id), yc.id);
prueba('con "que nadie me mande solicitudes", no llegan', c2 === 'nada', c2);
await Bt.pag.evaluate(() => { window.__A.G.amigosOp.pedidos = 'todos'; });
/* Beto acepta a Ana otra vez (para las fotos) */
await Bt.pag.evaluate((id) => window.__A.amigos.aceptar(id), ya.id);
await juntos(pags, 1.2);

/* ------------------------------------------------ 7) el VR, los idiomas y las fotos */
const vr = await A.pag.evaluate(() => {
  const { J, UI, leerVentana } = window.__A; J.celu.abrir('inicio');
  const L = leerVentana(UI.ventanaAbierta);
  J.celu.ir('amigos'); J.celu.tab = 'lista'; J.celu.pintar();
  const L2 = leerVentana(UI.ventanaAbierta);
  return { titulo: L.titulo, n: L.botones.length, raros: L.botones.filter((b) => !b.texto || b.texto === '•').length, textos: L2.botones.map((b) => b.texto).slice(0, 6) };
});
prueba('en el VR el espejo lo lee: cada botón con su texto (apps, volver, inicio; "Unirse a…", "Mensaje a…")', vr.titulo.includes('Celu') && vr.n >= 12 && vr.raros === 0 && vr.textos.some((x) => /Mensaje a Beto/.test(x)), JSON.stringify(vr));
const fuente = fs.readFileSync(path.join(AQUI, '../js/celu.js'), 'utf8');
const bloque = (i) => { const m = fuente.match(new RegExp(`\\n  ${i}: \\{([\\s\\S]*?)\\n  \\},`)); return m ? new Set([...m[1].matchAll(/(?:^|[\s{,])([a-z][a-z0-9_]*): ['"]/g)].map((x) => x[1])) : new Set(); };
const [es, en, pt] = ['es', 'en', 'pt'].map(bloque);
const faltan = [...es].filter((k) => !en.has(k) || !pt.has(k));
prueba('los textos del celu están en español, inglés y portugués', es.size > 100 && !faltan.length && en.size === es.size && pt.size === es.size, `${es.size}/${en.size}/${pt.size} ${faltan.slice(0, 5).join(',')}`);
const avisos = [];
A.pag.on('console', (m) => { if (/falta el texto/.test(m.text())) avisos.push(m.text()); });
for (const i of ['en', 'pt', 'es']) {
  await A.pag.evaluate((i) => { const { J, textos } = window.__A; textos.ponerIdioma(i); for (const p of ['inicio', 'amigos', 'mensajes', 'juegos', 'casas', 'perfil']) { J.celu.pila = ['inicio', p]; J.celu.pintar(); } J.celu.tab = 'sol'; J.celu.ir('amigos'); J.celu.pintar(); J.celu.tab = 'agregar'; J.celu.pintar(); }, i);
}
prueba('y no falta ninguno al recorrer las pantallas', !avisos.length, avisos.slice(0, 3).join(' | '));
const hora = await A.pag.evaluate(() => { const { J } = window.__A; J.celu.pila = ['inicio']; J.celu.pintar(); J.celu.refrescar(); return document.querySelector('.cel-reloj')?.textContent || ''; });
prueba('el inicio vuelto a pintar (llegó algo) sigue con la hora', /^\d{1,2}:\d{2}/.test(hora), hora);
const fotos = [];
await A.pag.evaluate(() => { const { J } = window.__A; J.celu.pila = ['inicio']; J.celu.pintar(); });
await A.pag.waitForTimeout(600); await avanzar(A.pag, 1); await A.pag.screenshot({ path: path.join(SAL, 'celu-inicio.png') }); fotos.push('celu-inicio.png');
await A.pag.evaluate((id) => window.__A.J.celu.abrir('chat:' + id), yb.id); await A.pag.waitForTimeout(600); await avanzar(A.pag, 1); await A.pag.screenshot({ path: path.join(SAL, 'celu-charla.png') }); fotos.push('celu-charla.png');
await Bt.pag.evaluate(() => { const { J } = window.__A; J.celu.abrir('amigos'); }); await Bt.pag.waitForTimeout(600); await avanzar(Bt.pag, 1); await Bt.pag.screenshot({ path: path.join(SAL, 'celu-acostado.png') }); fotos.push('celu-acostado.png');
const cabe = await Bt.pag.evaluate(() => { const r = document.querySelector('.ventana.celu').getBoundingClientRect(); return { x: r.left, y: r.top, d: r.right, a: r.bottom, W: innerWidth, H: innerHeight }; });
prueba('acostado (844 × 390) entra entero en la pantalla', cabe.x >= 0 && cabe.y >= 0 && cabe.d <= cabe.W && cabe.a <= cabe.H, JSON.stringify(cabe));
/* Ana, de frente, con el celu en la mano (la cámara adelante del muñeco: yaw = rumbo) */
await Bt.pag.evaluate(() => window.__A.J.celu.cerrar());
await A.pag.evaluate(() => { const { yo, reino, cam, J } = window.__A; J.celu.cerrar(); const x = reino.inicio.x + 2, z = reino.inicio.z + 2; yo.p.set(x, reino.mundo.altura(x, z), z); yo.rumbo = 0.5; J.celu.abrir('inicio'); cam.yaw = yo.rumbo - 0.35; cam.pitch = 0.1; cam.dist = cam.distObj = 3; });
await avanzar(A.pag, 45, 1 / 30, false); await A.pag.waitForTimeout(600); await avanzar(A.pag, 1); await A.pag.screenshot({ path: path.join(SAL, 'celu-en-la-mano.png') }); fotos.push('celu-en-la-mano.png');
const errs = [A, Bt, C].flatMap((x) => x.errores).filter((e) => !/ERR_|net::|WebSocket|favicon/.test(e));
prueba('sin errores en las páginas', !errs.length, errs.slice(0, 3).join(' | '));
console.log('fotos:', fotos.map((f) => path.join('pruebas/salida', f)).join(' '));
await nav.close(); B.cerrar();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
