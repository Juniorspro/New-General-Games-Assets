/* ============================================================================
   motor2d/pantalla.js — el mundo se dibuja chico y se agranda entero.
   Dos lienzos: el del mundo (W x H píxeles de juego, escala 1) y el visible.
   Por cuadro se dibuja todo en el chico y se copia UNA vez agrandado.
   ========================================================================== */

const Pantalla = {
  lienzo: null, cx: null,        // el que se ve
  cv: null, g: null,             // el del mundo: acá dibuja el juego
  PX: 2,                         // píxeles CSS por píxel de juego (entero)
  S: 2,                          // píxeles del lienzo visible por píxel de juego (entero)
  W: 0, H: 0,                    // tamaño del mundo visible, en píxeles de juego
  base: 200,                     // cuántos píxeles de juego tiene el lado corto
  alCambiar: null,
  pedirMedida: true,
  cuenta: 0,

  iniciar(lienzo, base) {
    this.lienzo = lienzo;
    this.base = base || 200;
    this.cx = lienzo.getContext('2d', { alpha: false });
    this.cv = document.createElement('canvas');
    this.g = this.cv.getContext('2d', { alpha: false });
    const pedir = () => { this.pedirMedida = true; };
    if (window.ResizeObserver) new ResizeObserver(pedir).observe(lienzo.parentNode);
    window.addEventListener('resize', pedir);
    window.addEventListener('orientationchange', pedir);
    this.medir();
  },

  /* PX sale del lado corto: en un teléfono parado (412 de ancho) da 2 y el
     mundo mide 206 de ancho; en una compu de 1280x720 da 4 y el mundo mide
     320x180. Con escala no entera (1,94) los píxeles salen de distinto
     tamaño y todo tiembla al moverse */
  medir() {
    const cont = this.lienzo.parentNode;
    const ancho = Math.max(1, cont.clientWidth || innerWidth);
    const alto = Math.max(1, cont.clientHeight || innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const PX = Math.max(1, Math.round(Math.min(ancho, alto) / this.base));
    const W = Math.ceil(ancho / PX), H = Math.ceil(alto / PX);
    const S = Math.min(4, Math.max(1, Math.round(PX * dpr)));
    this.pedirMedida = false;
    if (W === this.W && H === this.H && PX === this.PX && S === this.S) return false;
    this.PX = PX; this.W = W; this.H = H; this.S = S;
    this.cv.width = W; this.cv.height = H;
    this.g.imageSmoothingEnabled = false;
    this.lienzo.width = W * S; this.lienzo.height = H * S;
    this.lienzo.style.width = (W * PX) + 'px';
    this.lienzo.style.height = (H * PX) + 'px';
    this.cx.imageSmoothingEnabled = false;
    if (this.alCambiar) this.alCambiar(W, H);
    return true;
  },

  /* se llama al EMPEZAR el cuadro: cambiar el tamaño de un lienzo lo borra, y
     si pasa después de dibujar el navegador muestra un cuadro negro */
  revisar() {
    this.cuenta++;
    if (this.pedirMedida || this.cuenta % 15 === 0) this.medir();
  },

  presentar() {
    this.cx.drawImage(this.cv, 0, 0, this.W * this.S, this.H * this.S);
  },

  /* de coordenadas de la ventana a píxeles de juego */
  aMundo(clientX, clientY) {
    const r = this.lienzo.getBoundingClientRect();
    return { x: (clientX - r.left) / this.PX, y: (clientY - r.top) / this.PX };
  },
};
