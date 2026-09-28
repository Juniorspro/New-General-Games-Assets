// EL VR JUGABLE (vuelta 43: "que en VR todo el juego sea funcional"), con manos de mentira (las de
// comun.mjs › MANO) o con la mirada:
// - de entrada 3DoF con el cuello (mirar abajo corre los ojos lo que da el giro del cuello, 11 cm de largo) y el menú de la palma con
//   10 botones: el de 3DoF/6DoF lo cambia;
// - el espejo: una ventana de la interfaz se ve adentro del VR (título, texto y mosaicos) y el rayo con
//   un pellizco aprieta el botón de verdad; la ✕ la cierra;
// - sin manos: un toque mirando un mosaico lo aprieta (y no camina); quedarse mirando 1,4 s también;
// - una charla (el libro) con "▶ Seguir"; el mapa de viajes con sus destinos, y viajar sigue en el VR,
//   en primera persona y con el fundido;
// - entrar a un edificio apuntando la puerta y usar lo de adentro con el rayo;
// - el tiro: el pellizco dispara por el rayo de la mano, sin arco; sin manos, el toque dispara;
// - el parkour: sin arco, el pellizco sostenido camina;
// - la pelotita, de punta a punta por el broker: el del VR se ve como una bola con sus dos manos donde
//   están; sin la opción vuelve el muñeco; lo que llega mal se ignora.
//     node pruebas/vr-juego.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL, MANO } from './comun.mjs';
import { broker } from './broker.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const giro = (pag, a, b, g) => pag.evaluate(([a, b, g]) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g })), [a, b, g]);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/* lo que usan todas, en la página: dónde cae un mosaico del espejo, apretarlo con el rayo y un pellizco, y apuntar a
   algo del mundo y pellizcar */
const AYUDAS = () => {
  const A = window.__A, THREE = A.THREE;
  window.__T = {
    /* el centro de un botón de un tablero (en el mundo) */
    centro(P, b) { P.malla.updateMatrixWorld(true); return new THREE.Vector3((b.x + b.w / 2) / P.W * P.ancho - P.ancho / 2, P.alto / 2 - (b.y + b.h / 2) / P.H * P.alto, 0).applyMatrix4(P.malla.matrixWorld); },
    boton(f) { const P = A.espejo.panel; return P && P.botones.find(f); },
    /* el rayo de la mano derecha a 'donde' (un Vector3 o una función que lo da) y un pellizco */
    pellizcar(donde, largo = 0.45) {
      const w = () => (typeof donde === 'function' ? donde() : donde);
      for (let i = 0; i < 6; i++) window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, w(), largo))]]);
      const antes = { apunta: A.ventanasMundo.apunta[1]?.clone() || null, objetivo: A.manos.objetivo?.o || null };
      for (let i = 0; i < 4; i++) window.__cuadro([[true, window.__mano(true, 'pellizco', window.__apuntar(true, w(), largo))]]);
      for (let i = 0; i < 4; i++) window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, w(), largo))]]);
      return antes;
    },
    /* un mosaico del espejo, con la mano */
    /* (si el panel se cierra con el pellizco, la mano sigue apuntando donde estaba) */
    mosaico(f) { const b = this.boton(f); if (!b) return false; let w = this.centro(A.espejo.panel, b); this.pellizcar(() => { const P = A.espejo.panel; if (P) w = this.centro(P, this.boton(f) || b); return w; }); return true; },
    pasos(n, dt = 1 / 30) { for (let i = 0; i < n; i++) A.paso(dt, false); },
    /* donde apuntan las manos a lo interactivo (como main.js › apuntablesVR) */
    alto(o) { const q = typeof o.pos === 'function' ? o.pos() : o.pos, W = A.reino.mundo; return new THREE.Vector3(q.x, (q.y ?? W.altura(q.x, q.z)) + (q.y == null ? 1 : 0.4), q.z); },
  };
};

const { pag, errores } = await abrir(nav, 'directo&pausa&hora=0.42&calidad=baja', { ancho: 844, alto: 390, movil: true });
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await pag.evaluate(MANO); await pag.evaluate(AYUDAS);
await avanzar(pag, 5, 1 / 30, false);
await pag.evaluate(() => window.__A.J.entrarVR(true, false)); await pag.waitForTimeout(300);
await giro(pag, 0, 0, -90);
await avanzar(pag, 3, 1 / 30, false);
await pag.evaluate(() => { const A = window.__A; A.manos.activa = true; A.manos.fuente = 'prueba'; });

/* 1) 3DoF de entrada, con el cuello; el menú de la palma con 10 botones, y el de 3DoF/6DoF */
{
  const r0 = await pag.evaluate(() => { const A = window.__A, Mn = A.manos.menu; return { seis: A.vr.seis, cajas: Mn.cajas.length, menuSeis: Mn.seis, menuPel: Mn.pelotita, cuello0: +A.vr.desplazo.length().toFixed(4) }; });
  await giro(pag, 0, 0, -60); await avanzar(pag, 3, 1 / 30, false);
  r0.cuelloAbajo = await pag.evaluate(() => +window.__A.vr.desplazo.length().toFixed(4));
  /* (lo que tiene que dar: los ojos 11 cm del giro del cuello, 2·|v|·sen(ángulo / 2)) */
  r0.inclina = await pag.evaluate(() => { const A = window.__A, e = new A.THREE.Euler().setFromQuaternion(A.vr.q, 'YXZ'); return +(e.x * 180 / Math.PI).toFixed(1); });
  r0.espera = +(2 * Math.hypot(0.075, 0.08) * Math.sin(Math.abs(r0.inclina) * Math.PI / 360)).toFixed(4);
  await giro(pag, 0, 0, -90); await avanzar(pag, 3, 1 / 30, false);
  prueba('de entrada 3DoF: mirando derecho los ojos no se corren; mirando abajo, el cuello los corre lo justo', !r0.seis && r0.cuello0 < 0.005 && r0.inclina < -20 && Math.abs(r0.cuelloAbajo - r0.espera) < 0.004, JSON.stringify(r0));
  const r1 = await pag.evaluate(() => {
    const A = window.__A, T = window.__T, Mn = A.manos.menu, { p, q } = window.__cab();
    Mn.abierto || Mn.abrir(p, q);
    const [x, y, w, h] = Mn.cajas[8], b = new A.THREE.Vector3((x + w / 2) / Mn.px[0] * Mn.ancho - Mn.ancho / 2, Mn.alto / 2 - (y + h / 2) / Mn.px[1] * Mn.alto, 0).applyMatrix4(Mn.malla.matrixWorld);
    T.pellizcar(b, 0.1);
    const uno = { seis: A.vr.seis, opcion: A.G.opciones.vr6dof, menu: Mn.seis };
    Mn.abierto || Mn.abrir(p, q); T.pellizcar(b, 0.1);
    return { uno, dos: { seis: A.vr.seis, opcion: A.G.opciones.vr6dof } };
  });
  prueba('el menú de la palma tiene 10 botones (con 3DoF/6DoF y la pelotita); el de 3DoF pasa a 6DoF y vuelve', r0.cajas === 10 && !r0.menuSeis && r0.menuPel && r1.uno.seis && r1.uno.opcion === true && r1.uno.menu && !r1.dos.seis && r1.dos.opcion === false, JSON.stringify({ ...r1, cajas: r0.cajas }));
}

/* 2) el espejo: una ventana de la interfaz, adentro del VR; el rayo y el pellizco aprietan el botón de verdad */
{
  const r = await pag.evaluate(() => {
    const A = window.__A, T = window.__T; window.__apretados = [];
    const c = document.createElement('div');
    c.innerHTML = '<p>Elegí uno de los tres.</p><div><button class="boton" id="b1">Uno</button><button class="boton" id="b2">Dos</button><button class="boton primario" id="b3">Tres</button></div>';
    c.querySelectorAll('button').forEach((b) => { b.onclick = () => window.__apretados.push(b.id); });
    A.UI.ventana('Prueba del espejo', c);
    T.pasos(12);
    const P = A.espejo.panel, cam = A.motor.camara;
    const o = { abierto: A.espejo.abierto, vr: A.vr.activo, titulo: P?.titulo, texto: P?.texto, botones: P?.botones.map((b) => b.texto).join('|'), lejos: P ? +P.malla.position.distanceTo(cam.position).toFixed(2) : null };
    /* (la copia plana, con su velo borroso, no tapa la vista del VR) */
    const velo = getComputedStyle(document.querySelector('.velo')); o.plana = velo.opacity === '0' && velo.pointerEvents === 'none';
    const antes = T.pellizcar(() => T.centro(A.espejo.panel, T.boton((b) => b.texto === 'Dos')));
    o.cursor = !!antes.apunta; o.usoAlgo = !!antes.objetivo;
    T.pasos(3);
    o.apretados = window.__apretados.join(',');
    o.sigue = A.espejo.abierto && !!A.UI.ventanaAbierta;
    return o;
  });
  prueba('una ventana de la interfaz se ve en el VR (título, texto, los 3 botones y la ✕), a 1,5 m, y la plana no tapa la vista', r.abierto && r.vr && r.plana && r.titulo === 'Prueba del espejo' && r.texto === 'Elegí uno de los tres.' && r.botones === 'Uno|Dos|Tres|✕' && Math.abs(r.lejos - 1.5) < 0.2, JSON.stringify(r));
  prueba('el rayo con un pellizco aprieta el botón de verdad (y no usa lo del mundo de atrás)', r.cursor && !r.usoAlgo && r.apretados === 'b2' && r.sigue, JSON.stringify({ apretados: r.apretados, cursor: r.cursor, usoAlgo: r.usoAlgo, sigue: r.sigue }));
  await avanzar(pag, 1); await pag.screenshot({ path: path.join(SAL, 'vr-juego-espejo.png') });
  /* 3) sin manos: el toque mirando un mosaico lo aprieta, y quedarse mirando 1,4 s también */
  const r3 = await pag.evaluate(() => {
    const A = window.__A, T = window.__T, THREE = A.THREE, cam = A.motor.camara;
    A.manos.activa = false;
    const qM = new THREE.Quaternion(), m4 = new THREE.Matrix4(), ARR = new THREE.Vector3(0, 1, 0);
    A.vr.orientacion = () => qM;
    const mirar = (texto, n) => { for (let i = 0; i < n; i++) { const b = T.boton((x) => x.texto === texto); m4.lookAt(cam.position, T.centro(A.espejo.panel, b), ARR); qM.setFromRotationMatrix(m4); A.paso(1 / 30, false); } };
    window.__apretados = [];
    mirar('Uno', 8);
    const camina0 = A.vr.camina;
    A.vr.toque = true; mirar('Uno', 3);
    const toque = { apretados: window.__apretados.join(','), camina: A.vr.camina, camina0 };
    mirar('Tres', 30); const aMedias = window.__apretados.join(',');
    mirar('Tres', 22);
    const quieta = { aMedias, apretados: window.__apretados.join(',') };
    delete A.vr.orientacion;
    /* la ✕ con la mirada y un toque */
    const bx = T.boton((b) => b.id === 'esp:x');
    A.vr.orientacion = () => qM; for (let i = 0; i < 4; i++) { m4.lookAt(cam.position, T.centro(A.espejo.panel, bx), ARR); qM.setFromRotationMatrix(m4); if (i === 2) A.vr.toque = true; A.paso(1 / 30, false); }
    delete A.vr.orientacion;
    T.pasos(3);
    return { toque, quieta, cerro: !A.UI.ventanaAbierta && !A.espejo.abierto && !A.ventanasMundo.hayAlgo };
  });
  prueba('sin manos: un toque mirando "Uno" lo aprieta y no se pone a caminar', r3.toque.apretados === 'b1' && !r3.toque.camina && !r3.toque.camina0, JSON.stringify(r3.toque));
  prueba('sin manos: quedarse mirando "Tres" 1,4 s lo aprieta (a 1 s todavía no)', r3.quieta.aMedias === 'b1' && r3.quieta.apretados === 'b1,b3', JSON.stringify(r3.quieta));
  prueba('la ✕ del panel cierra la ventana de verdad', r3.cerro, JSON.stringify(r3));
  await pag.evaluate(() => { window.__A.manos.activa = true; });
}

/* 4) una charla (el libro): "▶ Seguir" la cierra */
{
  await pag.evaluate(() => window.__A.J.leer('📖', 'Había una vez una burbuja.'));
  await esperar(900);
  const r = await pag.evaluate(() => {
    const A = window.__A, T = window.__T; T.pasos(6);
    const P = A.espejo.panel, o = { abierto: A.espejo.abierto, titulo: P?.titulo, texto: P?.texto, botones: P?.botones.map((b) => b.texto).join('|') };
    T.mosaico((b) => b.texto === A.textos.t('esp_seguir')); T.pasos(4);
    o.cerro = !document.querySelector('.dialogo') && !A.espejo.abierto;
    return o;
  });
  prueba('una charla se ve en el VR con "▶ Seguir", y apretarlo la cierra', r.abierto && r.titulo === '💬 📖' && r.texto === 'Había una vez una burbuja.' && r.botones === '▶ Seguir' && r.cerro, JSON.stringify(r));
}

/* 5) el mapa de viajes en el VR; viajar sigue en el VR, en primera persona, con el fundido */
{
  const r = await pag.evaluate(() => {
    const A = window.__A, T = window.__T, W = A.reino.mundo;
    const mapa = W.interactivos.find((o) => o.accion === 'viajar'), q0 = typeof mapa.pos === 'function' ? mapa.pos() : mapa.pos;
    A.yo.ponerEn(new A.THREE.Vector3(q0.x + 5, W.altura(q0.x + 5, q0.z) + 0.05, q0.z), 0); T.pasos(4);
    T.pellizcar(T.alto(mapa)); T.pasos(8);
    const P = A.espejo.panel, juegos = A.textos.t('reino_juegos');
    const o = { abierto: A.espejo.abierto, vr: A.vr.activo, titulo: P?.titulo, n: P?.botones.length, juegos: !!T.boton((b) => b.el?.querySelector?.('b')?.textContent === juegos) };
    o.apreto = T.mosaico((b) => b.el?.querySelector?.('b')?.textContent === juegos);
    return o;
  });
  await esperar(600);
  const medio = await pag.evaluate(() => { const A = window.__A, v = document.querySelector('.viaje'); A.paso(1 / 30, false); return { fundido: +A.motor.pFinal.uniforms.uFundido.value.toFixed(2), plana: !!v && getComputedStyle(v).opacity === '0' }; });
  await esperar(1200);
  const fin = await pag.evaluate(() => { const A = window.__A; window.__T.pasos(10); return { id: A.reino.id, vr: A.vr.activo, fp: A.cam.fp, enPrimera: A.yo.m.enPrimera, fundido: +A.motor.pFinal.uniforms.uFundido.value.toFixed(2) }; });
  prueba('el mapa de viajes se abre con el rayo y se ve en el VR, con sus 6 destinos', r.abierto && r.vr && r.n === 7 && r.juegos, JSON.stringify(r));
  prueba('elegir la Zona de Juegos viaja sin salir del VR (en los ojos, fundido a azul en el medio, sin la pantalla plana)', r.apreto && fin.id === 'juegos' && fin.vr && fin.fp && fin.enPrimera && medio.fundido === 1 && medio.plana && fin.fundido === 0, JSON.stringify({ medio, ...fin }));
}

/* 6) entrar a un edificio apuntando la puerta, y usar lo de adentro con el rayo */
{
  await pag.evaluate(() => window.__A.viajar('plaza')); await esperar(1600);
  const r = await pag.evaluate(() => {
    const A = window.__A, T = window.__T, W = A.reino.mundo; T.pasos(4);
    const P = W.interactivos.find((o) => o.id === 'entrar-hotel0');
    A.yo.ponerEn(new A.THREE.Vector3(P.salida.x, P.salida.y, P.salida.z), 0); T.pasos(4);
    const antes = T.pellizcar(T.alto(P));
    return { reino: A.reino.id, apunto: antes.objetivo?.id || null };
  });
  await esperar(1600);
  const r2 = await pag.evaluate(() => {
    const A = window.__A, T = window.__T; T.pasos(6);
    const o = { id: A.reino.id, tipo: A.reino.tipo, vr: A.vr.activo, fp: A.cam.fp };
    /* lo que se usa más cerca, a la vista */
    const ojo = A.motor.camara.position, lista = (A.reino.accionables || []).map((a) => ({ a, c: new A.THREE.Box3().setFromObject(a.obj).getCenter(new A.THREE.Vector3()) })).filter((x) => x.c.distanceTo(ojo) < 7).sort((x, y) => x.c.distanceTo(ojo) - y.c.distanceTo(ojo));
    o.cerca = lista.length;
    if (!lista.length) return o;
    const { a, c } = lista[0], orig = a.alUsar; let usado = false; a.alUsar = (J) => { usado = true; return orig(J); };
    const antes = T.pellizcar(c);
    o.apunto = antes.objetivo?.accion === 'accionar' && antes.objetivo.a === a; o.usado = usado; o.que = a.texto(); o.vrDespues = A.vr.activo;
    a.alUsar = orig;
    return o;
  });
  prueba('el rayo apunta la puerta del hotel y el pellizco entra, sin salir del VR, en primera persona', r.apunto === 'entrar-hotel0' && r2.id === 'interior' && r2.tipo === 'hotel' && r2.vr && r2.fp, JSON.stringify({ ...r, ...r2 }));
  prueba('adentro, el rayo apunta lo que se usa y el pellizco lo usa', r2.cerca > 0 && r2.apunto && r2.usado, JSON.stringify(r2));
  await pag.evaluate(() => { window.__A.UI.cerrarVentana(); document.querySelector('.dialogo')?.click(); });
}

/* 7) el tiro: el pellizco dispara por el rayo de la mano (sin arco); sin manos, el toque dispara */
{
  await pag.evaluate(() => window.__A.viajar('tiro')); await esperar(1600);
  const r = await pag.evaluate(() => {
    const A = window.__A, T = window.__T, THREE = A.THREE, E = A.reino.tiro; T.pasos(4);
    E.fase = 'juega'; E.cuenta = 0;
    const tiros = []; const acc0 = A.red.accion.bind(A.red); A.red.accion = (o) => { if (o.type === 'disparo') tiros.push(new THREE.Vector3(o.dx, o.dy, o.dz).normalize()); return acc0(o); };
    const cam = A.motor.camara, fr = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); fr.y = 0; fr.normalize();
    /* 25° a la derecha y un poco arriba, a 12 m */
    const d = fr.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -25 * Math.PI / 180); d.y = 0.18; d.normalize();
    const blanco = cam.position.clone().addScaledVector(d, 12);
    for (let i = 0; i < 6; i++) window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, blanco))]]);
    const rayo = A.manos.manos[1].rayoD.clone();
    for (let i = 0; i < 4; i++) window.__cuadro([[true, window.__mano(true, 'pellizco', window.__apuntar(true, blanco))]]);
    for (let i = 0; i < 3; i++) window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, blanco))]]);
    /* apuntando al piso: sin arco */
    const piso = cam.position.clone().addScaledVector(fr, 3); piso.y -= 1.4;
    let aro = false; for (let i = 0; i < 6; i++) { window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, piso))]]); aro ||= A.manos.aro.visible; }
    const conMano = tiros.slice();
    /* sin manos: el toque dispara para donde se mira */
    A.manos.activa = false; T.pasos(10);
    const mira = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    A.vr.toque = true; T.pasos(2);
    A.manos.activa = true; A.red.accion = acc0;
    const ang = (a, b) => +(Math.acos(Math.min(1, a.dot(b))) * 180 / Math.PI).toFixed(1);
    return { n: conMano.length, conRayo: conMano[0] ? ang(conMano[0], rayo) : null, conMirada: conMano[0] ? ang(conMano[0], mira) : null, aro, tiros: E.tiros, toque: tiros.length - conMano.length, toqueMira: tiros[conMano.length] ? ang(tiros[conMano.length], mira) : null, camina: A.vr.camina };
  });
  prueba('en el tiro el pellizco dispara por el rayo de la mano (no para donde se mira), y no sale el arco', r.n === 1 && r.conRayo < 4 && r.conMirada > 15 && !r.aro, JSON.stringify(r));
  prueba('sin manos, el toque dispara para donde se mira (y no camina)', r.toque === 1 && r.toqueMira < 6 && !r.camina && r.tiros === 2, JSON.stringify(r));
}

/* 8) el parkour: sin arco, el pellizco sostenido camina */
{
  await pag.evaluate(() => window.__A.viajar('parkour', { nivel: 0 })); await esperar(1600);
  const r = await pag.evaluate(() => {
    const A = window.__A, T = window.__T, THREE = A.THREE; T.pasos(4);
    /* (sin esperar la cuenta de 3: ya corre) */
    A.reino.parkour.fase = 'corre'; A.reino.parkour.cuenta = 0; T.pasos(4);
    const cam = A.motor.camara, fr = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); fr.y = 0; fr.normalize();
    const lejos = () => cam.position.clone().addScaledVector(fr, 6).add(new THREE.Vector3(0, -1.2, 0));
    const p0 = A.yo.p.clone();
    let aro = false, camina = 0;
    for (let i = 0; i < 6; i++) { window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, lejos()))]]); aro ||= A.manos.aro.visible; }
    const quieto = +Math.hypot(A.yo.p.x - p0.x, A.yo.p.z - p0.z).toFixed(2);
    for (let i = 0; i < 30; i++) { window.__cuadro([[true, window.__mano(true, 'pellizco', window.__apuntar(true, lejos()))]], false, 1 / 30); aro ||= A.manos.aro.visible; if (A.vr.caminaMano) camina++; }
    const p1 = A.yo.p.clone(), anduvo = new THREE.Vector3(p1.x - p0.x, 0, p1.z - p0.z);
    for (let i = 0; i < 12; i++) window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, lejos()))]], false, 1 / 30);
    const suelta = +Math.hypot(A.yo.p.x - p1.x, A.yo.p.z - p1.z).toFixed(2);
    return { id: A.reino.id, vr: A.vr.activo, aro, quieto, camina, anduvo: +anduvo.length().toFixed(2), adelante: +(anduvo.length() ? anduvo.normalize().dot(fr) : 0).toFixed(2), suelta, sigue: A.vr.caminaMano };
  });
  prueba('en el parkour no hay arco y el pellizco sostenido camina para adelante; al soltar, frena', r.id === 'parkour' && r.vr && !r.aro && r.quieto < 0.05 && r.camina > 20 && r.anduvo > 1 && r.adelante > 0.8 && r.suelta < 0.6 && !r.sigue, JSON.stringify(r));
}
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));

/* 9) la pelotita, de punta a punta: Ana sin VR, Beto con el VR y sus manos */
{
  const B = await broker(0);
  const q = (n) => `directo&pausa&calidad=baja&nombre=${n}&broker=${encodeURIComponent(B.url)}`;
  const Ana = await abrir(nav, q('Ana'), { red: 'local', ancho: 640, alto: 360 });
  const Beto = await abrir(nav, q('Beto'), { red: 'local', ancho: 640, alto: 360, movil: true });
  for (const x of [Ana, Beto]) await x.pag.waitForFunction(() => window.__A && window.__A.yo && window.__A.red.estado === 'en_linea', null, { timeout: 60000, polling: 200 });
  for (const x of [Ana, Beto]) await avanzar(x.pag, 1);
  await Beto.pag.evaluate(MANO);
  await Beto.pag.evaluate(() => window.__A.J.entrarVR(true, false)); await Beto.pag.waitForTimeout(300);
  await giro(Beto.pag, 0, 0, -90);
  await Beto.pag.evaluate(() => { const A = window.__A; A.manos.activa = true; A.manos.fuente = 'prueba'; A.yo.p.set(-10, A.reino.mundo.altura(-10, 5) + 0.05, 5); A.yo.v.set(0, 0, 0); });
  await Ana.pag.evaluate(() => { const A = window.__A; A.yo.p.set(-10, A.reino.mundo.altura(-10, 1), 1); });
  const idB = await Beto.pag.evaluate(() => window.__A.J.id);
  /* Beto con las dos manos adelante (30 fotos por segundo) mientras Ana avanza */
  const manosBeto = (n) => Beto.pag.evaluate((n) => {
    const A = window.__A, THREE = A.THREE;
    for (let i = 0; i < n; i++) {
      const { p, q } = window.__cab(), fr = new THREE.Vector3(0, 0, -1).applyQuaternion(q), de = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      const mD = p.clone().addScaledVector(fr, 0.35).addScaledVector(de, 0.12).add(new THREE.Vector3(0, -0.1, 0)), mI = p.clone().addScaledVector(fr, 0.35).addScaledVector(de, -0.12).add(new THREE.Vector3(0, -0.1, 0));
      window.__cuadro([[true, window.__mano(true, 'abierta', { mira: mD })], [false, window.__mano(false, 'abierta', { mira: mI })]], false, 1 / 30);
    }
  }, n);
  const juntos = async (seg, conManos = true) => { for (let t = 0; t < seg; t += 0.2) { await Promise.all([conManos ? manosBeto(6) : avanzar(Beto.pag, 6, 1 / 30, false), avanzar(Ana.pag, 6, 1 / 30, false)]); await esperar(20); } };
  await juntos(3);
  const b = await Beto.pag.evaluate(() => { const A = window.__A; return { cab: A.motor.camara.position.toArray(), yema: A.manos.manos[1].punto(8, new A.THREE.Vector3()).toArray(), vis: A.manos.manos.filter((M) => M.visible && M.alfa > 0.5).length }; });
  const a = await Ana.pag.evaluate((id) => {
    const A = window.__A, r = A.remotos.get(id); if (!r) return { hay: false };
    const P = r.pelotita; if (!P) return { hay: true, pelotita: false, enVR: r.enVR };
    const c = P.cabeza.position, M = P.manos[1];
    return { hay: true, pelotita: true, munieco: r.m.raiz.visible, cab: c.toArray(), manos: P.manos.filter((m) => m.juntas.visible).length, yema: [c.x + M.p[24], c.y + M.p[25], c.z + M.p[26]], escena: !!P.grupo.parent };
  }, idB);
  const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
  prueba('Ana ve a Beto (en el VR) como una pelotita flotante, sin el muñeco, donde está su cabeza', a.pelotita && !a.munieco && a.escena && dist(a.cab, b.cab) < 0.3, JSON.stringify({ ...a, beto: b.cab.map((v) => +v.toFixed(2)), a: a.cab?.map((v) => +v.toFixed(2)), dist: a.cab ? +dist(a.cab, b.cab).toFixed(3) : null }));
  prueba('y con sus dos manos, donde las tiene (la yema del índice a menos de 8 cm)', a.manos === 2 && b.vis === 2 && dist(a.yema, b.yema) < 0.08, `yema a ${a.yema ? (dist(a.yema, b.yema) * 100).toFixed(1) : '?'} cm`);
  await Ana.pag.screenshot({ path: path.join(SAL, 'vr-juego-pelotita.png') });
  /* sin la opción, Beto vuelve a ser el muñeco */
  await Beto.pag.evaluate(() => { window.__A.G.opciones.vrPelotita = false; });
  await juntos(2.4);
  const a2 = await Ana.pag.evaluate((id) => { const r = window.__A.remotos.get(id); return { pelotita: !!r?.pelotita, munieco: !!r?.m.raiz.visible, enVR: !!r?.enVR }; }, idB);
  prueba('con la pelotita apagada, a los 1,5 s vuelve el muñeco', a2.munieco && !a2.pelotita && !a2.enVR, JSON.stringify(a2));
  /* lo que llega mal se ignora */
  const malos = await Ana.pag.evaluate(() => {
    const A = window.__A, h = [0, 1.5, 0, 0, 0, 0, 1], M63 = (v) => Array.from({ length: 63 }, () => v);
    const casos = { lejos: { h: [0, 9, 0, 0, 0, 0, 1] }, giroCero: { h: [0, 1.5, 0, 0, 0, 0, 0] }, texto: { h: ['a', 1.5, 0, 0, 0, 0, 1] }, corto: { h: [0, 1.5, 0] }, noEsObjeto: 'hola' };
    const r = {};
    for (const [k, vr] of Object.entries(casos)) r[k] = A.remotos.recibir({ id: 'falso-' + k, name: 'X', x: -12, y: 5, z: 3, vr }).enVR;
    const b = A.remotos.recibir({ id: 'falso-manos', name: 'X', x: -12, y: 5, z: 3, vr: { h, m: [M63(999), M63(10.5)] } });
    const bien = A.remotos.recibir({ id: 'falso-bien', name: 'X', x: -12, y: 5, z: 3, vr: { h, m: [M63(12), 0] } });
    return { ...r, manosMalas: b.enVR && !b.vrUlt.m[0] && !b.vrUlt.m[1], bien: bien.enVR && !!bien.vrUlt.m[0] && Math.abs(bien.vrUlt.m[0][0] - 0.12) < 1e-6 && !bien.vrUlt.m[1] };
  });
  prueba('lo que llega mal se ignora (cabeza lejos, giro en cero, textos, cortos) y las manos fuera de rango no se dibujan', !malos.lejos && !malos.giroCero && !malos.texto && !malos.corto && !malos.noEsObjeto && malos.manosMalas && malos.bien, JSON.stringify(malos));
  const errs = [...Ana.errores, ...Beto.errores].filter((e) => !/ERR_FAILED/.test(e));
  prueba('sin errores en las dos páginas', !errs.length, errs.slice(0, 3).join(' | '));
  B.cerrar();
}
await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
