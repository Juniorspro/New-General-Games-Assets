/* ============================================================================
   ruta40/js/pantalla.js — el tamaño del juego y el teléfono parado.
   El dibujo no es pixel art: el lienzo ocupa toda la pantalla en píxeles del
   dispositivo (con un tope según la calidad). Con el teléfono parado se juega
   vertical de verdad (clase .vertical: la cámara y la interfaz se arman para
   lo alto). Si el jugador lo pide en Ajustes, en cambio, todo #app se gira 90°
   y se juega acostado igual; para qué lado lo dice el acelerómetro o lo elige
   el jugador. La idea del giro viene de KUNTUR.
   ========================================================================== */
export const esTactil = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const TOPE_DPR = { alta: 2, media: 1.5, baja: 1 };

export const Pantalla = {
  W: 960, H: 540, dpr: 1, girado: false, vertical: false, invertido: false, giro: 'auto', parado: 'vertical', reves: false, calidad: 'alta',
  alCambiar: [],
  actualizar() {
    const vw = innerWidth, vh = innerHeight;
    /* parado = más alto que ancho. El giro es solo para teléfonos y solo si el jugador lo eligió */
    const esParado = vh > vw * 1.05;
    this.girado = esTactil() && esParado && this.parado === 'girar';
    this.vertical = esParado && !this.girado;
    this.W = this.girado ? vh : vw; this.H = this.girado ? vw : vh;
    this.dpr = Math.min(TOPE_DPR[this.calidad] || 2, Math.max(1, devicePixelRatio || 1));
    this.invertido = this.girado && (this.giro === 'reves' || (this.giro === 'auto' && this.reves));
    const raiz = document.documentElement, app = document.getElementById('app');
    raiz.classList.toggle('girado', this.girado);
    raiz.classList.toggle('vertical', this.vertical);
    raiz.classList.toggle('dedos', esTactil());
    raiz.classList.toggle('bajita', this.H < 430);
    /* la unidad de la interfaz: crece con el lado corto, así los carteles se ven igual en un teléfono y en un monitor.
       Parado el lado corto es el ancho (y en una ventana alta de monitor, que tampoco crezca de más con el alto) */
    const u = this.vertical ? Math.min(this.W / 500, this.H / 820) : this.H / 620;
    raiz.style.setProperty('--u', Math.max(0.62, Math.min(1.35, u)) + 'px');
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
  /* con el teléfono parado: 'vertical' (jugar parado) o 'girar' (acostado, como antes). El toque de la opción deja trabar la orientación */
  ponerParado(p) {
    this.parado = p;
    if (p === 'girar') this.acostar();
    else try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (_) {}
    this.actualizar();
  },
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
  /* pantalla completa, si el teléfono deja (tiene que venir de un toque). Se traba acostado solo si el jugador
     eligió girar: parado se juega vertical y se puede dar vuelta el teléfono cuando quiera */
  acostar() {
    if (!esTactil()) return;
    const d = document.documentElement, trabar = this.parado === 'girar';
    try {
      const p = document.fullscreenElement ? Promise.resolve() : d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : null;
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
