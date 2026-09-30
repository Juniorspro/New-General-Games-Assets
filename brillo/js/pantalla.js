/* brillo/js/pantalla.js — el tamaño del juego.
   El dibujo es pixel art de 288 de alto (desde el 24/09: "más pocket", la
   cámara un 20 % más cerca que con los 360 de antes) y de 448 a 704 de ancho,
   según la forma de la pantalla. Llena la pantalla con la escala que haga
   falta, aunque no sea entera: la última pasada del post ("sharp bilinear")
   deja cada píxel del juego como un cuadrado parejo. Lo que sobra en
   pantallas muy anchas o muy altas queda como un marco con el cielo del mundo.
   ?alto=360 vuelve al tamaño de antes (el tráiler graba así).
   CON EL TELÉFONO PARADO (30/09) se juega en vertical de verdad: arriba el
   juego a lo ancho, de 416 de alto (el alto del nivel más bajo: la Colina y
   el Plano entran enteros) y de 288 a 416 de ancho, y abajo la consola, un
   panel de vidrio donde van los dedos, así no tapan nada. El juego ocupa
   alrededor del 60 % del alto; más no conviene, porque con el alto fijo cada
   punto de más para el juego le saca ancho (lo que se ve adelante).
   El giro de antes sigue como opción ('auto' / 'normal' / 'reves'): todo lo
   que hay adentro de #app se gira 90° (como en KUNTUR) y se juega acostado.
   Para qué lado lo dice el acelerómetro, o lo elige el jugador. */
const Q = new URLSearchParams(location.search);
export const ALTO = Math.max(200, Math.min(400, +Q.get('alto') || 288));
export const ANCHO_MIN = Math.round(ALTO * 14 / 9), ANCHO_MAX = Math.round(ALTO * 22 / 9);
/* parado: el alto del juego, el ancho que puede tener y cuánto del alto de la pantalla se queda la consola */
export const ALTO_V = 416, ANCHO_V_MIN = 288, ANCHO_V_MAX = 416;
const CONSOLA = 0.4, CONSOLA_MIN = 250;

const esTactil = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
/* lo que tapan la muesca y la barrita de abajo (viewport-fit=cover): se lee de un div con env() */
let sonda = null;
function margenes() {
  if (!sonda && document.body) { sonda = document.createElement('div'); sonda.style.cssText = 'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.appendChild(sonda); }
  if (!sonda) return { arriba: 0, abajo: 0 };
  const c = getComputedStyle(sonda);
  return { arriba: parseFloat(c.paddingTop) || 0, abajo: parseFloat(c.paddingBottom) || 0 };
}

export const Pantalla = {
  w: 640, h: ALTO, escala: 1, girado: false, vertical: false, invertido: false, giro: 'vertical', reves: false,
  cajaW: 0, cajaH: 0, lienzo: { x: 0, y: 0, w: 640, h: 360 }, controles: null, dpr: 1, version: 0,
  alCambiar: null,
  actualizar() {
    const vw = innerWidth, vh = innerHeight, tactil = esTactil();
    const parado = tactil && vh > vw * 1.05;
    this.vertical = parado && this.giro === 'vertical';
    this.girado = parado && !this.vertical;
    const W = this.girado ? vh : vw, H = this.girado ? vw : vh;
    const dpr = this.dpr = Math.min(3, Math.max(1, devicePixelRatio || 1));
    let w, h, k, arriba = 0, abajo = 0;
    if (this.vertical) {
      /* parado: el juego arriba y la consola abajo. El ancho sale de lo que queda
         para el juego; la escala, de lo que entre sin salirse de ese pedazo */
      ({ arriba, abajo } = margenes());
      const vista = H - arriba - Math.max(CONSOLA_MIN, H * CONSOLA);
      h = ALTO_V;
      w = Math.round(ALTO_V * W / Math.max(1, vista));
      w = Math.max(ANCHO_V_MIN, Math.min(ANCHO_V_MAX, w)); w -= w % 2;
      k = Math.min(W / w, Math.max(1, vista) / ALTO_V);
    } else {
      /* el ancho del juego sale de la forma de la pantalla; la caja, tan grande como entre */
      h = ALTO;
      w = Math.round(ALTO * W / H);
      w = Math.max(ANCHO_MIN, Math.min(ANCHO_MAX, w)); w -= w % 2;
      k = Math.min(W / w, H / ALTO);
    }
    const lw = w * k, lh = h * k;
    this.w = w; this.h = h; this.escala = k * dpr;
    this.version++;
    this.cajaW = W; this.cajaH = H;
    this.lienzo = this.vertical ? { x: Math.round((W - lw) / 2), y: arriba, w: lw, h: lh } : { x: Math.round((W - lw) / 2), y: Math.round((H - lh) / 2), w: lw, h: lh };
    /* la consola: de abajo del juego hasta abajo de todo, sin la barrita del sistema */
    const cy = this.lienzo.y + lh;
    this.controles = this.vertical ? { x: 0, y: cy, w: W, h: Math.max(1, H - cy - abajo) } : null;
    const raiz = document.documentElement, app = document.getElementById('app');
    raiz.classList.toggle('girado', this.girado);
    raiz.classList.toggle('vertical', this.vertical);
    raiz.classList.toggle('bajita', H < 520);
    raiz.classList.toggle('dedos', tactil);
    raiz.style.setProperty('--vw', W / 100 + 'px'); raiz.style.setProperty('--vh', H / 100 + 'px');
    /* un píxel del juego en píxeles CSS: la interfaz se mide con esto y crece junto con el dibujo */
    raiz.style.setProperty('--px', lh / h + 'px');
    raiz.style.setProperty('--lx', this.lienzo.x + 'px'); raiz.style.setProperty('--ly', this.lienzo.y + 'px');
    raiz.style.setProperty('--lw', lw + 'px'); raiz.style.setProperty('--lh', lh + 'px');
    if (this.vertical) {
      const C = this.controles;
      raiz.style.setProperty('--cy', C.y + 'px'); raiz.style.setProperty('--cw', C.w + 'px'); raiz.style.setProperty('--ch', C.h + 'px'); raiz.style.setProperty('--abajo', abajo + 'px');
    }
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
  /* 'vertical' (parado se juega parado) o uno de los giros de antes. Si ya
     está en pantalla completa, se suelta o se traba de costado según toque */
  ponerGiro(g) {
    this.giro = g;
    try { if (document.fullscreenElement && screen.orientation) { if (g === 'vertical') screen.orientation.unlock(); else screen.orientation.lock('landscape').catch(() => {}); } } catch (_) {}
    this.actualizar();
  },
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
  /* pantalla completa y acostado, si el teléfono deja (tiene que venir de un
     toque). En vertical no se traba: si lo acuestan, se juega acostado */
  acostar() {
    if (!esTactil()) return;
    const d = document.documentElement, trabar = this.giro !== 'vertical';
    try {
      const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p && p.then) p.then(() => trabar && screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    } catch (_) {}
  },
  iniciar() {
    this.actualizar();
    addEventListener('resize', () => this.actualizar());
    addEventListener('orientationchange', () => setTimeout(() => this.actualizar(), 250));
    this.sensor();
  },
};
