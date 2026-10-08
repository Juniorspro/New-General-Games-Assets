// porteo: controles para juegos de PC en primera persona (WASD + mouse), sin tocar el juego.
//   En el teléfono, mientras se juega (el juego trabó el puntero): un joystick a la izquierda que
//   aprieta W/A/S/D, arrastrar a la derecha para mirar (movimiento relativo del mouse, como con el
//   puntero trabado), tocar para hacer clic (usar, pasar los diálogos) y botones para correr, usar
//   y pausar. En los menús (puntero libre) los controles se esconden y los toques van a la UI.
//   En la computadora: clic en el juego para trabar el puntero (pointer lock) y mirar con el mouse.
// cfg: { botones: [{texto, tecla (KeyCode de Unity), mantener}], pausa: KeyCode, ganancia }
export function crearControlesPC(exp, lienzo, cfg = {}) {
  const KC = { W: 119, A: 97, S: 115, D: 100, E: 101, SHIFT: 304, ESC: 27 };
  const botones = cfg.botones || [
    { texto: 'Correr', tecla: KC.SHIFT, mantener: true },
    { texto: 'Usar', tecla: KC.E },
  ];
  const pausa = cfg.pausa ?? KC.ESC;
  const ganancia = cfg.ganancia || 3;
  const tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  // el escenario (escenario.js: 16:9, girado si el teléfono está en vertical): todo en sus coordenadas
  const local = (x, y) => {
    const esc = globalThis.Porteo && Porteo.escenario && Porteo.escenario.local;
    if (esc) return esc(x, y);
    const r = lienzo.getBoundingClientRect();
    return [x - r.left, y - r.top];
  };
  // de píxeles CSS del escenario a píxeles del lienzo (lo que mide el juego)
  const aLienzo = () => lienzo.width / Math.max(1, lienzo.clientWidth);

  const capa = document.createElement('div');
  capa.style.cssText = 'position:absolute;inset:0;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;display:none';
  document.body.appendChild(capa);

  function circulo(tam, alfa) {
    const e = document.createElement('div');
    e.style.cssText = `position:absolute;width:${tam}px;height:${tam}px;margin:${-tam / 2}px 0 0 ${-tam / 2}px;border-radius:50%;` +
      `border:2px solid rgba(255,255,255,${alfa});background:rgba(255,255,255,${alfa * 0.25});pointer-events:none;display:none`;
    capa.appendChild(e);
    return e;
  }
  // el tamaño del escenario (el <body>): la capa mide 0 mientras está escondida
  const ancho = () => document.body.clientWidth, alto = () => document.body.clientHeight;
  const lado = () => Math.min(ancho(), alto());
  const radio = () => Math.max(40, Math.min(80, lado() * 0.16));
  const base = circulo(160, 0.35), palanca = circulo(70, 0.55);

  // ── teclas ──
  const apretadas = new Map();   // KeyCode → cuántos la sostienen
  function bajar(k) { const n = apretadas.get(k) || 0; apretadas.set(k, n + 1); if (n === 0) exp.Tecla(k, true); }
  function subir(k) { const n = apretadas.get(k) || 0; if (n <= 1) { apretadas.delete(k); if (n === 1) exp.Tecla(k, false); } else apretadas.set(k, n - 1); }
  function soltarTodo() { for (const k of [...apretadas.keys()]) { apretadas.set(k, 1); subir(k); } }
  function clic() {
    exp.Raton(lienzo.width / 2, lienzo.height / 2);
    exp.BotonRaton(0, true);
    setTimeout(() => exp.BotonRaton(0, false), 60);
  }

  // ── joystick (mitad izquierda) ──
  let joy = null;   // { id, x0, y0, teclas: Set }
  function direccion(dx, dy) {
    const r = radio(), d = Math.hypot(dx, dy), s = new Set();
    if (d < r * 0.25) return s;
    const ang = Math.atan2(dy, dx);   // 8 direcciones
    const sec = Math.round(ang / (Math.PI / 4));
    const TAB = { 0: ['D'], 1: ['D', 'S'], 2: ['S'], 3: ['A', 'S'], 4: ['A'], '-4': ['A'], '-3': ['A', 'W'], '-2': ['W'], '-1': ['D', 'W'] };
    for (const t of TAB[sec] || []) s.add(KC[t]);
    return s;
  }
  function moverJoy(x, y) {
    const r = radio();
    let dx = x - joy.x0, dy = y - joy.y0;
    const d = Math.hypot(dx, dy);
    if (d > r) { dx *= r / d; dy *= r / d; }
    palanca.style.left = joy.x0 + dx + 'px'; palanca.style.top = joy.y0 + dy + 'px';
    const nuevas = direccion(dx, dy);
    for (const k of joy.teclas) if (!nuevas.has(k)) subir(k);
    for (const k of nuevas) if (!joy.teclas.has(k)) bajar(k);
    joy.teclas = nuevas;
  }

  // ── mirar (mitad derecha) ──
  const miradas = new Map();   // pointerId → { x, y, t0, x0, y0 }

  capa.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { capa.setPointerCapture(e.pointerId); } catch {}
    const [x, y] = local(e.clientX, e.clientY);
    if (x < ancho() * 0.45 && !joy) {
      joy = { id: e.pointerId, x0: x, y0: y, teclas: new Set() };
      const r = radio();
      base.style.width = base.style.height = r * 2 + 'px'; base.style.margin = `${-r}px 0 0 ${-r}px`;
      base.style.left = x + 'px'; base.style.top = y + 'px'; base.style.display = palanca.style.display = 'block';
      moverJoy(x, y);
      return;
    }
    miradas.set(e.pointerId, { x, y, x0: x, y0: y, t0: e.timeStamp });
  });
  capa.addEventListener('pointermove', (e) => {
    const [x, y] = local(e.clientX, e.clientY);
    if (joy && e.pointerId === joy.id) { moverJoy(x, y); return; }
    const m = miradas.get(e.pointerId);
    if (!m) return;
    const k = aLienzo() * ganancia;
    exp.Mirar((x - m.x) * k, -(y - m.y) * k);
    m.x = x; m.y = y;
  });
  function fin(e) {
    if (joy && e.pointerId === joy.id) {
      for (const k of joy.teclas) subir(k);
      joy = null;
      base.style.display = palanca.style.display = 'none';
      return;
    }
    const m = miradas.get(e.pointerId);
    if (!m) return;
    miradas.delete(e.pointerId);
    // un toque corto y quieto es un clic (usar lo que se mira, pasar el diálogo). Con la hora de
    // los eventos y no la de cuando se atienden: en un teléfono lento un cuadro largo los atrasa y
    // un toque normal parecía largo
    if (e.type === 'pointerup' && e.timeStamp - m.t0 < 800 && Math.hypot(m.x - m.x0, m.y - m.y0) < 14) clic();
  }
  capa.addEventListener('pointerup', fin);
  capa.addEventListener('pointercancel', fin);
  capa.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── botones ──
  function boton(b, pos) {
    const el = document.createElement('div');
    el.textContent = b.texto;
    el.style.cssText = 'position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'color:#fff;font:bold 14px sans-serif;background:rgba(0,0,0,0.35);border:2px solid rgba(255,255,255,0.45);touch-action:none';
    capa.appendChild(el);
    const on = (e) => {
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch {}
      el.style.background = 'rgba(255,255,255,0.35)';
      bajar(b.tecla);
      if (!b.mantener) setTimeout(() => subir(b.tecla), 80);
    };
    const off = (e) => {
      e.stopPropagation();
      el.style.background = 'rgba(0,0,0,0.35)';
      if (b.mantener) subir(b.tecla);
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    return () => {
      const t = Math.max(52, Math.min(84, lado() * 0.15)), [x, y] = pos(t);
      el.style.width = el.style.height = t + 'px'; el.style.fontSize = t * 0.22 + 'px';
      el.style.left = x - t / 2 + 'px'; el.style.top = y - t / 2 + 'px';
    };
  }
  const ubicar = [];
  botones.forEach((b, i) => ubicar.push(boton(b, (t) => [ancho() - t * (0.8 + i * 1.15) - 10, alto() - t * 0.8 - 14])));
  ubicar.push(boton({ texto: '❚❚', tecla: pausa }, (t) => [ancho() - t * 0.6 - 8, t * 0.6 + 8]));

  // ── volver de la pausa ──
  // La pausa de un juego de PC se cierra con la misma tecla (Esc) y muchas no tienen botón para
  // volver: con el puntero libre la capa se esconde, así que después de ❚❚ queda un ▶ en el mismo
  // lugar (fuera de la capa) hasta que el juego vuelve a trabar el puntero
  let enPausa = false, pausaDesde = 0;
  const volver = document.createElement('div');
  volver.textContent = '▶';
  volver.style.cssText = 'position:absolute;z-index:6;border-radius:50%;display:none;align-items:center;justify-content:center;' +
    'color:#fff;font:bold 14px sans-serif;background:rgba(0,0,0,0.35);border:2px solid rgba(255,255,255,0.45);touch-action:none;user-select:none';
  document.body.appendChild(volver);
  volver.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    bajar(pausa);
    setTimeout(() => subir(pausa), 80);
  });
  capa.addEventListener('pointerdown', (e) => { if (e.target.textContent === '❚❚') { enPausa = true; pausaDesde = performance.now(); } }, true);
  ubicar.push(() => {
    const t = Math.max(52, Math.min(84, lado() * 0.15));
    volver.style.width = volver.style.height = t + 'px'; volver.style.fontSize = t * 0.3 + 'px';
    volver.style.left = ancho() - t * 0.6 - 8 - t / 2 + 'px'; volver.style.top = t * 0.6 + 8 - t / 2 + 'px';
  });

  const reubicar = () => ubicar.forEach((f) => f());
  addEventListener('resize', reubicar);

  // ── computadora: trabar el puntero para mirar ──
  if (!tactil) {
    lienzo.addEventListener('click', () => { if (exp.CursorTrabado() && !document.pointerLockElement) lienzo.requestPointerLock?.(); });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== lienzo) return;
      exp.Mirar(e.movementX, -e.movementY);
    });
  }

  // jugando o en un menú (cada 1/4 s): con el puntero libre los toques van a la UI del juego
  let jugando = false;
  setInterval(() => {
    let j = false;
    try { j = !!exp.CursorTrabado(); } catch {}
    if (!j && document.pointerLockElement === lienzo) document.exitPointerLock?.();
    if (!tactil) return;
    // volvió al juego, o la pausa no se abrió en 3 s: sin ▶ (el juego puede tardar unos cuadros
    // en atender el Esc, y mientras tanto sigue "jugando")
    if (j && (!jugando || performance.now() - pausaDesde > 3000)) enPausa = false;
    volver.style.display = !j && enPausa ? 'flex' : 'none';
    if (j === jugando) return;
    jugando = j;
    capa.style.display = j ? 'block' : 'none';
    reubicar();
    if (!j) { soltarTodo(); joy = null; miradas.clear(); base.style.display = palanca.style.display = 'none'; }
  }, 250);
}
