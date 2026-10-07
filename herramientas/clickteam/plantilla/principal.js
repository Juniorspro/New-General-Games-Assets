/* principal.js — la carcasa web de un juego de Clickteam: carga datos/,
 * traduce el dedo y el teclado, toca el sonido y lleva el bucle.
 *
 * Configuración opcional, antes de este script:
 *   window.CLICKTEAM_CFG = { clave: 'fnaf4', titulo: '...' }
 */
(async function () {
  'use strict';
  const C = window.Clickteam;
  const cfg = window.CLICKTEAM_CFG || {};
  const $ = (s) => document.querySelector(s);
  const lienzo = $('#juego');
  const cx = lienzo.getContext('2d', { alpha: false });
  const carga = $('#carga');
  const barra = carga.querySelector('i');

  let J;
  try {
    J = await (await fetch('datos/juego.json')).json();
  } catch (e) {
    carga.querySelector('span').textContent = 'No se pudo cargar el juego: ' + e.message;
    return;
  }
  lienzo.width = J.app.w;
  lienzo.height = J.app.h;

  // ── imágenes ──
  // Se pide el archivo al entrar a la pantalla y el navegador lo decodifica la
  // primera vez que se dibuja. Forzar decode() de todo costaría 270 MB sólo en
  // la pantalla del nivel de FNaF 4: un teléfono de 3 GB cierra la pestaña.
  const imgs = new Map();
  function pedir(h) {
    let i = imgs.get(h);
    if (!i) { i = new Image(); i.decoding = 'async'; i.src = 'datos/img/' + h + '.webp'; imgs.set(h, i); }
    return i;
  }
  const imagen = (h) => { const i = pedir(h); return i.complete && i.naturalWidth ? i : null; };
  const lista = (oi) => {
    const o = J.objetos[oi];
    if (!o) return [];
    if (o.t === 1) return [o.img];
    const r = [];
    if (o.anims) for (const a of Object.values(o.anims)) for (const d of Object.values(a)) r.push(...d.cuadros);
    if (o.imgs) r.push(...o.imgs);
    return r;
  };
  const primeras = (oi) => {
    const o = J.objetos[oi];
    if (!o) return [];
    if (o.t === 1) return [o.img];
    if (o.imgs) return o.imgs;
    const a = o.anims && (o.anims[0] || Object.values(o.anims)[0]), d = a && Object.values(a)[0];
    return d ? d.cuadros.slice(0, 1) : [];
  };

  const sonido = new C.Sonido((h) => 'datos/snd/' + h + '.ogg');
  // El contexto de audio se crea YA, aunque el navegador lo deje suspendido
  // hasta el primer toque: lo que el juego pide antes (la música del título
  // suena en "al empezar la pantalla") queda en cola y arranca con el toque.
  // Creado recién en el toque, esos pedidos se perdían y el título era mudo.
  sonido.iniciar();
  const ini = new C.Ini((cfg.clave || J.app.titulo) + '.ini');

  const motor = new C.Motor(J, {
    imagen, sonido, ini,
    alFrame: async (idx, f) => {
      carga.hidden = false;
      const objetos = new Set(f.inst.map((d) => d.oi));
      for (const ev of f.eventos || []) for (const a of ev.a) if (a[0] === -5) for (const p of a.slice(6)) if (p[1]?.oi != null) objetos.add(p[1].oi);
      const sons = new Set();
      for (const ev of f.eventos || []) for (const a of ev.a) if (a[0] === -2) for (const p of a.slice(6)) if (p[0] === 6) sons.add(p[1].h);
      // Lo que se ve al empezar, decodificado; el resto, sólo pedido.
      const ya = [];
      for (const d of f.inst) for (const h of primeras(d.oi)) ya.push(pedir(h).decode().catch(() => {}));
      let n = 0;
      const total = ya.length + sons.size || 1;
      const avance = (p) => p.then(() => { barra.style.width = Math.round((++n / total) * 100) + '%'; });
      await Promise.race([
        Promise.all([...ya.map(avance), ...[...sons].map((h) => avance(sonido.cargar(h)))]),
        new Promise((r) => setTimeout(r, 10000)),
      ]);
      for (const oi of objetos) for (const h of lista(oi)) pedir(h);
      carga.hidden = true;
    },
  });

  // ── pantalla ──
  const caja = { x: 0, y: 0, w: 1, h: 1 };
  function ubicar() {
    const k = Math.min(innerWidth / J.app.w, innerHeight / J.app.h);
    caja.w = Math.round(J.app.w * k); caja.h = Math.round(J.app.h * k);
    caja.x = Math.round((innerWidth - caja.w) / 2); caja.y = Math.round((innerHeight - caja.h) / 2);
    Object.assign(lienzo.style, { left: caja.x + 'px', top: caja.y + 'px', width: caja.w + 'px', height: caja.h + 'px' });
  }
  addEventListener('resize', ubicar);
  ubicar();

  // ── dedo y mouse ──
  // En el runtime de Android de Clickteam el primer dedo ES el mouse, y al
  // levantarlo el puntero queda donde estaba: los juegos hechos para
  // Android (FNaF 4) ya traen sus eventos de "soltar".
  const aJuego = (e) => [((e.clientX - caja.x) / caja.w) * J.app.w, ((e.clientY - caja.y) / caja.h) * J.app.h];
  let dedo = null;
  const btn = (e) => (e.button === 2 ? 'd' : e.button === 1 ? 'm' : 'i');
  lienzo.addEventListener('pointerdown', (e) => {
    sonido.iniciar();
    if (e.pointerType !== 'mouse') { if (dedo !== null) return; dedo = e.pointerId; }
    const [x, y] = aJuego(e);
    motor.puntero(x, y);
    motor.boton(btn(e), true);
    try { lienzo.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerId !== dedo) return;
    const [x, y] = aJuego(e);
    motor.puntero(x, y);
  });
  const soltar = (e) => {
    if (e.pointerType !== 'mouse') { if (e.pointerId !== dedo) return; dedo = null; }
    motor.boton(btn(e), false);
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── teclado (y el atrás de Android, que llega como Escape) ──
  const COD = { Escape: 27, Enter: 13, NumpadEnter: 13, Space: 32, Backspace: 8, Tab: 9, Delete: 46,
    ShiftLeft: 16, ShiftRight: 16, ControlLeft: 17, ControlRight: 17, AltLeft: 18, AltRight: 18,
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, NumpadAdd: 107, NumpadSubtract: 109 };
  const codigo = (e) => COD[e.code] ?? (/^Key[A-Z]$/.test(e.code) ? e.code.charCodeAt(3)
    : /^Digit\d$/.test(e.code) ? e.code.charCodeAt(5) : /^Numpad\d$/.test(e.code) ? 96 + +e.code[6] : (e.keyCode || null));
  addEventListener('keydown', (e) => {
    sonido.iniciar();
    if (e.repeat) return;
    const k = codigo(e);
    if (k == null) return;
    motor.tecla(k, true);
    if (k === 17 || k === 32 || (k >= 37 && k <= 40)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { const k = codigo(e); if (k != null) motor.tecla(k, false); });

  // ── pausa al salir de la app ──
  let oculto = false;
  document.addEventListener('visibilitychange', () => { oculto = document.hidden; sonido.pausar(oculto); });

  // ── el bucle: pasos fijos a los fps del juego, dibujo a lo que dé la pantalla ──
  const paso = 1000 / motor.fps;
  let antes = 0, acum = 0;
  window.__ct = { motor, J, listo: false, acelerar: 1, congelar: false };
  function cuadro(t) {
    requestAnimationFrame(cuadro);
    const d = Math.min(250, t - (antes || t));
    antes = t;
    if (!oculto && !window.__ct.congelar) {
      acum += d;
      const k = window.__ct.acelerar || 1;
      let n = 0;
      while (acum >= paso && n < 8) { for (let r = 0; r < k; r++) motor.paso(); acum -= paso; n++; }
      if (n >= 8) acum = 0; // un teléfono que no da abasto: se pierde tiempo, no se acumula
    }
    if (motor.cargando) { cx.fillStyle = '#000'; cx.fillRect(0, 0, J.app.w, J.app.h); return; }
    motor.dibujar(cx);
  }
  await motor.ir(0);
  window.__ct.listo = true;
  requestAnimationFrame(cuadro);
})();
