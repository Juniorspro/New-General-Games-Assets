/* brillo/js/pantalla.js — el tamaño del juego.
   El dibujo es pixel art de 360 de alto y de 560 a 880 de ancho, según la
   forma de la pantalla. La escala es siempre entera y en píxeles del
   dispositivo, así cada píxel del juego es un cuadrado parejo. Lo que sobra
   queda como un marco con el cielo del mundo.
   Con el teléfono parado, todo lo que hay adentro de #app se gira 90° (como
   en KUNTUR): el juego se juega acostado igual. Para qué lado se gira lo dice el
   acelerómetro, o lo elige el jugador ('normal' / 'reves'). */
export const ALTO = 360, ANCHO_MIN = 560, ANCHO_MAX = 880;

const esTactil = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export const Pantalla = {
  w: 640, h: ALTO, escala: 1, girado: false, invertido: false, giro: 'auto', reves: false,
  cajaW: 0, cajaH: 0, lienzo: { x: 0, y: 0, w: 640, h: 360 }, dpr: 1,
  alCambiar: null,
  actualizar() {
    const vw = innerWidth, vh = innerHeight;
    this.girado = esTactil() && vh > vw * 1.05;
    const W = this.girado ? vh : vw, H = this.girado ? vw : vh;
    const dpr = this.dpr = Math.min(3, Math.max(1, devicePixelRatio || 1));
    const dW = Math.round(W * dpr), dH = Math.round(H * dpr);
    let s = Math.max(1, Math.floor(dH / ALTO));
    while (s > 1 && Math.floor(dW / s) < ANCHO_MIN) s--;
    let w = Math.min(ANCHO_MAX, Math.floor(dW / s));
    if (w < ANCHO_MIN) w = ANCHO_MIN;
    w -= w % 2;
    this.w = w; this.h = ALTO; this.escala = s;
    /* el lienzo en píxeles CSS, centrado; si ni con escala 1 entra (pantallas muy chicas), se achica */
    let lw = w * s / dpr, lh = ALTO * s / dpr;
    const k = Math.min(1, W / lw, H / lh);
    lw *= k; lh *= k;
    this.cajaW = W; this.cajaH = H;
    this.lienzo = { x: Math.round((W - lw) / 2), y: Math.round((H - lh) / 2), w: lw, h: lh };
    const raiz = document.documentElement, app = document.getElementById('app');
    raiz.classList.toggle('girado', this.girado);
    raiz.classList.toggle('bajita', H < 520);
    raiz.classList.toggle('tactil', esTactil());
    raiz.style.setProperty('--vw', W / 100 + 'px'); raiz.style.setProperty('--vh', H / 100 + 'px');
    /* un píxel del juego en píxeles CSS: la interfaz se mide con esto y crece junto con el dibujo */
    raiz.style.setProperty('--px', lh / ALTO + 'px');
    raiz.style.setProperty('--lx', this.lienzo.x + 'px'); raiz.style.setProperty('--ly', this.lienzo.y + 'px');
    raiz.style.setProperty('--lw', lw + 'px'); raiz.style.setProperty('--lh', lh + 'px');
    this.invertido = this.girado && (this.giro === 'reves' || (this.giro === 'auto' && this.reves));
    if (app) {
      app.style.width = W + 'px'; app.style.height = H + 'px';
      /* normal: el techo del juego queda del lado derecho del teléfono parado; al revés, del izquierdo */
      app.style.transform = !this.girado ? '' : this.invertido ? `translateY(${vh}px) rotate(-90deg)` : `translateX(${vw}px) rotate(90deg)`;
    }
    if (this.alCambiar) this.alCambiar();
  },
  /* de la pantalla (clientX, clientY) a la caja de #app en píxeles CSS, sin el giro */
  aCaja(cx, cy) {
    if (!this.girado) return { x: cx, y: cy };
    return this.invertido ? { x: innerHeight - cy, y: cx } : { x: cy, y: innerWidth - cx };
  },
  /* de la pantalla a píxeles del juego */
  aJuego(cx, cy) {
    const q = this.aCaja(cx, cy), L = this.lienzo;
    return { x: (q.x - L.x) * this.w / L.w, y: (q.y - L.y) * this.h / L.h };
  },
  /* la caja de un elemento en coordenadas de #app (sin contar el giro) */
  caja(el) {
    if (!this.girado) return el.getBoundingClientRect();
    let x = 0, y = 0, e = el;
    while (e && e.id !== 'app') { x += e.offsetLeft || 0; y += e.offsetTop || 0; e = e.offsetParent; }
    return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
  },
  ponerGiro(g) { this.giro = g; this.actualizar(); },
  /* el acelerómetro: con el teléfono acostado la gravedad cae sobre x (+ si el borde derecho
     quedó arriba). Tiene que sostenerse un ratito. En iPhone pide permiso: ahí no se usa. */
  sensor() {
    if (this.conSensor || typeof DeviceMotionEvent === 'undefined' || typeof DeviceMotionEvent.requestPermission === 'function') return;
    this.conSensor = true;
    let lado = 0, desde = 0;
    addEventListener('devicemotion', (e) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null) return;
      const x = g.x, y = g.y || 0;
      const q = Math.abs(x) > 6.5 && Math.abs(x) > Math.abs(y) + 2.5 ? Math.sign(x) : 0;
      if (!q) { lado = 0; return; }
      if (q !== lado) { lado = q; desde = performance.now(); return; }
      const r = q < 0;
      if (performance.now() - desde > 350 && r !== this.reves) { this.reves = r; if (this.girado && this.giro === 'auto') this.actualizar(); }
    });
  },
  /* pantalla completa y acostado, si el teléfono deja (tiene que venir de un toque) */
  acostar() {
    if (!esTactil()) return;
    const d = document.documentElement;
    try {
      const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    } catch (_) {}
  },
  iniciar() {
    this.actualizar();
    addEventListener('resize', () => this.actualizar());
    addEventListener('orientationchange', () => setTimeout(() => this.actualizar(), 250));
    this.sensor();
  },
};
