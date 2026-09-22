/* ============================================================================
   motor2d/bucle.js — la simulación corre a 60 Hz fijos; el dibujo, a lo que dé
   la pantalla. Así un teléfono de 120 Hz y uno trabado juegan el mismo juego.
   ========================================================================== */

const Bucle = {
  acum: 0, ultimo: 0, velocidad: 1, congelado: 0, corriendo: false,
  pasar: null, dibujar: null, antes: null,
  pasos: 0,                 // pasos de simulación desde que arrancó
  msDibujo: 0,              // cuánto tarda dibujar un cuadro (promedio móvil)
  fijo: false,              // ?fijo en la dirección: sin ajustes automáticos (pruebas)

  iniciar(pasar, dibujar, antes) {
    this.pasar = pasar; this.dibujar = dibujar; this.antes = antes;
    this.corriendo = true;
    document.addEventListener('visibilitychange', () => { this.ultimo = 0; });
    requestAnimationFrame((ts) => this.tick(ts));
  },
  /* congelar la simulación unos cuadros (el golpe que se siente). Mientras
     tanto la entrada NO se consume: el salto apretado en el congelado sale igual */
  congelar(n) { if (n > this.congelado) this.congelado = n; },

  tick(ts) {
    requestAnimationFrame((t) => this.tick(t));
    Pantalla.revisar();
    /* el primer cuadro puede traer una marca ANTERIOR a la última: sin el
       Math.max el dt da negativo y la partida arranca rota */
    const real = this.ultimo ? Math.max(0, Math.min(100, ts - this.ultimo)) : CUADRO;
    this.ultimo = ts;
    if (this.antes) this.antes();
    this.acum += real * this.velocidad;
    let n = 0;
    while (this.acum >= CUADRO && n < 4) {
      this.acum -= CUADRO; n++;
      if (this.congelado > 0) { this.congelado--; continue; }
      this.pasos++;
      this.pasar();
      Entrada.fin();
    }
    if (this.acum > CUADRO * 4) this.acum = 0;
    const t0 = performance.now();
    this.dibujar();
    Pantalla.presentar();
    this.msDibujo = this.msDibujo * 0.95 + (performance.now() - t0) * 0.05;
  },

  /* para las pruebas: avanzar n pasos YA, con todos los relojes */
  adelantar(n) {
    for (let i = 0; i < n; i++) {
      if (this.congelado > 0) { this.congelado--; continue; }
      this.pasos++;
      this.pasar();
      Entrada.fin();
    }
  },
};
