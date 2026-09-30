/* kuntur/js/pantalla.js — el tamaño del juego, y el teléfono parado.
   Con el teléfono parado hay dos maneras (Opciones › Teléfono parado):
   - 'vertical', la de fábrica: se juega parado. Arriba va la vista del diorama (un 64 % del
     alto) y abajo la bandeja de cartón con los controles de dedo, así los dedos no tapan el
     juego. Pantalla.vista y Pantalla.bandeja dicen dónde va cada una (en px de la pantalla).
   - girado ('auto', 'normal' o 'reves'): el juego se ve acostado igual. Todo (el dibujo y la
     interfaz) va adentro de #app, que se gira 90°; el juego trabaja con el tamaño "lógico"
     (w x h, más ancho que alto) y las unidades de la hoja de estilos usan --vw y --vh, que
     siguen a ese tamaño y no al de la pantalla. Para qué lado se gira: con 'auto' lo dice el
     acelerómetro (en Android no pide permiso); si no, lo elige el jugador ('normal' o 'reves').
   Acostado o en la compu, la vista es la pantalla entera y no hay bandeja. */
export const Pantalla = {
  girado: false, invertido: false, vertical: false, w: innerWidth, h: innerHeight,
  vista: { x: 0, y: 0, w: innerWidth, h: innerHeight }, bandeja: null, seguro: { arr: 0, aba: 0 },
  giro: 'vertical', reves: false,
  actualizar() {
    const tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const vw = innerWidth, vh = innerHeight;
    const parado = tactil && vh > vw * 1.05;
    this.girado = parado && this.giro !== 'vertical';
    this.vertical = parado && this.giro === 'vertical';
    this.w = this.girado ? vh : vw; this.h = this.girado ? vw : vh;
    if (this.vertical) {
      /* la bandeja: algo más de un tercio (entre 230 y 340 px), más lo que tapa la rayita de
         inicio del sistema, que queda de cartón liso */
      this.seguro = this.margenes();
      const hb = Math.round(Math.max(230, Math.min(340, this.h * 0.36))) + this.seguro.aba;
      this.vista = { x: 0, y: 0, w: this.w, h: this.h - hb };
      this.bandeja = { x: 0, y: this.h - hb, w: this.w, h: hb };
    } else {
      this.vista = { x: 0, y: 0, w: this.w, h: this.h };
      this.bandeja = null;
    }
    const raiz = document.documentElement, app = document.getElementById('app');
    raiz.classList.toggle('girado', this.girado);
    raiz.classList.toggle('vertical', this.vertical);
    raiz.classList.toggle('angosta', this.w / this.h < 1);
    raiz.classList.toggle('bajita', this.h < 520);
    raiz.style.setProperty('--vw', this.w / 100 + 'px'); raiz.style.setProperty('--vh', this.h / 100 + 'px');
    raiz.style.setProperty('--vista', this.vista.h + 'px'); raiz.style.setProperty('--bandeja', (this.bandeja ? this.bandeja.h : 0) + 'px');
    raiz.style.setProperty('--seguroArr', this.seguro.arr + 'px'); raiz.style.setProperty('--seguroAba', this.seguro.aba + 'px');
    if (app) {
      app.style.width = this.w + 'px'; app.style.height = this.h + 'px';
      /* de la esquina de arriba a la izquierda, 90° para un lado, y corrido al borde:
         normal, el techo del juego queda del lado derecho del teléfono parado; al revés, del izquierdo */
      this.invertido = this.girado && (this.giro === 'reves' || (this.giro === 'auto' && this.reves));
      app.style.transform = !this.girado ? '' : this.invertido ? `translateY(${vh}px) rotate(-90deg)` : `translateX(${vw}px) rotate(90deg)`;
    }
  },
  /* lo que tapan la muesca y la rayita de inicio (viewport-fit=cover): se lee de un elemento de prueba */
  margenes() {
    let s = this.sonda;
    if (!s) {
      s = this.sonda = document.createElement('div');
      s.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(s);
    }
    const c = getComputedStyle(s);
    return { arr: parseFloat(c.paddingTop) || 0, aba: parseFloat(c.paddingBottom) || 0 };
  },
  /* de coordenadas de la pantalla (clientX, clientY) a las del juego */
  aJuego(cx, cy) {
    if (!this.girado) return { x: cx, y: cy };
    return this.invertido ? { x: innerHeight - cy, y: cx } : { x: cy, y: innerWidth - cx };
  },
  /* cambiar de manera rearma todo (el dibujo, la cámara y los controles escuchan el resize) */
  ponerGiro(g) { this.giro = g; this.actualizar(); dispatchEvent(new Event('resize')); },
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
  /* pantalla completa (con un toque) y, si se juega girado, acostado si el teléfono deja.
     Parado no se traba la orientación: si lo acuesta, se juega acostado */
  acostar() {
    if (!(matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)) return;
    const d = document.documentElement, trabar = this.giro !== 'vertical';
    try {
      const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p && p.then) p.then(() => trabar && screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
    } catch (_) {}
  },
};
