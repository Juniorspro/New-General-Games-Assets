/* ============================================================================
   ruta40/js/pantalla.js — el tamaño del juego y el giro en el teléfono parado.
   El dibujo no es pixel art: el lienzo ocupa toda la pantalla en píxeles del
   dispositivo (con un tope según la calidad). Con el teléfono parado, todo
   #app se gira 90° y se juega acostado igual; para qué lado lo dice el
   acelerómetro o lo elige el jugador. La idea del giro viene de KUNTUR.
   ========================================================================== */
export const esTactil = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const TOPE_DPR = { alta: 2, media: 1.5, baja: 1 };

export const Pantalla = {
  W: 960, H: 540, dpr: 1, girado: false, invertido: false, giro: 'auto', reves: false, calidad: 'alta',
  alCambiar: [],
  actualizar() {
    const vw = innerWidth, vh = innerHeight;
    this.girado = esTactil() && vh > vw * 1.05;
    this.W = this.girado ? vh : vw; this.H = this.girado ? vw : vh;
    this.dpr = Math.min(TOPE_DPR[this.calidad] || 2, Math.max(1, devicePixelRatio || 1));
    this.invertido = this.girado && (this.giro === 'reves' || (this.giro === 'auto' && this.reves));
    const raiz = document.documentElement, app = document.getElementById('app');
    raiz.classList.toggle('girado', this.girado);
    raiz.classList.toggle('dedos', esTactil());
    raiz.classList.toggle('bajita', this.H < 430);
    /* la unidad de la interfaz: crece con el lado corto, así los carteles se ven igual en un teléfono y en un monitor */
    raiz.style.setProperty('--u', Math.max(0.62, Math.min(1.35, this.H / 620)) + 'px');
    if (app) {
      app.style.width = this.W + 'px'; app.style.height = this.H + 'px';
      app.style.transform = !this.girado ? '' : this.invertido ? `translateY(${vh}px) rotate(-90deg)` : `translateX(${vw}px) rotate(90deg)`;
    }
    for (const f of this.alCambiar) f();
  },
  /* de la pantalla (clientX, clientY) a la caja de #app, sin el giro */
  aCaja(cx, cy) {
    if (!this.girado) return { x: cx, y: cy };
    return this.invertido ? { x: innerHeight - cy, y: cx } : { x: cy, y: innerWidth - cx };
  },
  ponerGiro(g) { this.giro = g; this.actualizar(); },
  ponerCalidad(c) { this.calidad = c; this.actualizar(); },
  sensor() {
    if (this.conSensor || typeof DeviceMotionEvent === 'undefined' || typeof DeviceMotionEvent.requestPermission === 'function') return;
    this.conSensor = true;
    let lado = 0, desde = 0;
    addEventListener('devicemotion', (e) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null) return;
      const q = Math.abs(g.x) > 6.5 && Math.abs(g.x) > Math.abs(g.y || 0) + 2.5 ? Math.sign(g.x) : 0;
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
