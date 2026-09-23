/* kuntur/js/pantalla.js — el tamaño del juego, y el teléfono parado.
   Con el teléfono parado el juego se ve acostado igual: todo (el dibujo y la
   interfaz) va adentro de #app, que se gira 90°. El juego trabaja siempre con
   el tamaño "lógico" (w x h, más ancho que alto); las unidades de la hoja de
   estilos usan --vw y --vh, que siguen a ese tamaño y no al de la pantalla.
   Para qué lado se gira: el teléfono puede acostarse hacia la izquierda o hacia
   la derecha. Con giro 'auto' lo dice el acelerómetro (en Android no pide
   permiso); si no, lo elige el jugador en las opciones ('normal' o 'reves'). */
export const Pantalla = {
  girado: false, invertido: false, w: innerWidth, h: innerHeight,
  giro: 'auto', reves: false,
  actualizar() {
    const tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const vw = innerWidth, vh = innerHeight;
    this.girado = tactil && vh > vw * 1.05;
    this.w = this.girado ? vh : vw; this.h = this.girado ? vw : vh;
    const raiz = document.documentElement, app = document.getElementById('app');
    raiz.classList.toggle('girado', this.girado);
    raiz.classList.toggle('angosta', this.w / this.h < 1);
    raiz.classList.toggle('bajita', this.h < 520);
    raiz.style.setProperty('--vw', this.w / 100 + 'px'); raiz.style.setProperty('--vh', this.h / 100 + 'px');
    if (app) {
      app.style.width = this.w + 'px'; app.style.height = this.h + 'px';
      /* de la esquina de arriba a la izquierda, 90° para un lado, y corrido al borde:
         normal, el techo del juego queda del lado derecho del teléfono parado; al revés, del izquierdo */
      this.invertido = this.girado && (this.giro === 'reves' || (this.giro === 'auto' && this.reves));
      app.style.transform = !this.girado ? '' : this.invertido ? `translateY(${vh}px) rotate(-90deg)` : `translateX(${vw}px) rotate(90deg)`;
    }
  },
  /* de coordenadas de la pantalla (clientX, clientY) a las del juego */
  aJuego(cx, cy) {
    if (!this.girado) return { x: cx, y: cy };
    return this.invertido ? { x: innerHeight - cy, y: cx } : { x: cy, y: innerWidth - cx };
  },
  ponerGiro(g) { this.giro = g; this.actualizar(); },
  /* el acelerómetro: con el teléfono acostado, la gravedad cae sobre x (+ si el borde
     derecho quedó arriba). Tiene que sostenerse un ratito para no dar vueltas de más.
     En iPhone los datos piden permiso (y vienen con otro signo): ahí no se usa. */
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
    return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
  },
  /* pantalla completa y acostado, si el teléfono deja (con un toque) */
  acostar() {
    if (!(matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)) return;
    const d = document.documentElement;
    try {
      const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    } catch (_) {}
  },
};
