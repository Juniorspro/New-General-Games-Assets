/* ============================================================================
   aeroplaza/js/pantalla.js — el tamaño del juego, y el celu parado (receta de
   KUNTUR, memoria/kuntur.md). Con el teléfono parado el juego se ve acostado
   igual, sin pantalla completa: todo (el lienzo, los dedos y la interfaz) va
   adentro de #app, que se gira 90°. El juego trabaja siempre con el tamaño
   "lógico" (w × h); el CSS usa --vw y --vh, que siguen a ese tamaño, y las
   clases de html (girado, angosta, a700, a560, b460) en vez de @media.
   Para qué lado: con giro 'auto' lo dice el acelerómetro (en Android no pide
   permiso); si no, se elige en las opciones: 'normal', 'reves' o 'no' (sin
   girar, el juego parado como antes).
   ========================================================================== */
export const Pantalla = {
  girado: false, invertido: false, w: innerWidth, h: innerHeight,
  giro: 'auto', reves: false,
  get tactil() { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; },
  actualizar() {
    const vw = innerWidth, vh = innerHeight;
    this.girado = this.giro !== 'no' && this.tactil && vh > vw * 1.05;
    this.w = this.girado ? vh : vw; this.h = this.girado ? vw : vh;
    const raiz = document.documentElement, app = document.getElementById('app');
    const C = raiz.classList;
    C.toggle('girado', this.girado); C.toggle('angosta', this.w / this.h < 1);
    C.toggle('a700', this.w <= 700); C.toggle('a560', this.w <= 560); C.toggle('b460', this.h <= 460);
    raiz.style.setProperty('--vw', this.w / 100 + 'px'); raiz.style.setProperty('--vh', this.h / 100 + 'px');
    if (app) {
      app.style.width = this.w + 'px'; app.style.height = this.h + 'px';
      /* desde la esquina de arriba a la izquierda, 90° para un lado y corrido al borde */
      this.invertido = this.girado && (this.giro === 'reves' || (this.giro === 'auto' && this.reves));
      app.style.transform = !this.girado ? '' : this.invertido ? `translateY(${vh}px) rotate(-90deg)` : `translateX(${vw}px) rotate(90deg)`;
    }
    for (const f of this.alCambiar) f(this);
  },
  alCambiar: [],
  /* de coordenadas de la pantalla (clientX, clientY) a las del juego */
  aJuego(cx, cy) {
    if (!this.girado) return { x: cx, y: cy };
    return this.invertido ? { x: innerHeight - cy, y: cx } : { x: cy, y: innerWidth - cx };
  },
  ponerGiro(g) { this.giro = g; if (g === 'auto') this.sensor(); this.actualizar(); },
  /* el acelerómetro: con el teléfono acostado la gravedad cae sobre x (+ si el
     borde derecho quedó arriba). Tiene que sostenerse un ratito. En iPhone los
     datos piden permiso: ahí no se usa y queda el manual */
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
  /* la caja de un elemento en coordenadas del juego (sin contar el giro) */
  caja(el) {
    if (!this.girado) return el.getBoundingClientRect();
    let x = 0, y = 0, e = el;
    while (e && e.id !== 'app') { x += e.offsetLeft || 0; y += e.offsetTop || 0; e = e.offsetParent; }
    const w = el.offsetWidth, h = el.offsetHeight;
    return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h };
  },
};
addEventListener('resize', () => Pantalla.actualizar());
addEventListener('orientationchange', () => setTimeout(() => Pantalla.actualizar(), 120));
