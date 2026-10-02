// Las tomas de CRIPTA NEÓN. En los niveles, el bot sigue el camino del resolvedor
// (__C.camino): cuando Lu frena, espera un toque y desliza al siguiente lado, como un dedo
// (deslizar va con el signo: −1, 0 o 1). El resolvedor no mira lo que se mueve con el reloj
// (polillas, fuego, pinchos que suben): por eso se graban los niveles que así se ganan, y
// alguno donde la mata un bicho. En la torre sigue los tramos que talló la torre misma
// (como la demo de la portada). Cada cuadro anota los deslizamientos, para dibujar el dedo.
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export default {
  archivo: 'cripta/cripta.html',
  listo: () => !!(window.listo && window.__C),
  bot: () => {
    const C = window.__C, D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    window.__bot = {
      plan: null, j: 0, espera: 0, hecho: [], pausa: 4,
      nivel(i, pausa = 4) { this.plan = C.camino(i); this.j = 0; this.pausa = pausa; return !!this.plan; },
      paso() {
        const p = C.partida;
        if (!p || p.fin || p.estado !== 'jugando') return;
        if (p.lu.mueve) { this.espera = 0; return; }
        if (++this.espera < this.pausa) return;
        let d = null;
        if (this.plan) { if (this.j < this.plan.length) d = D[this.plan[this.j++]]; }
        else if (p.torre) { const s = [...p.torre.segmentos].reverse().find((s) => s.x === p.lu.x && s.y === p.lu.y); if (s) d = [s.dx, s.dy]; }
        if (d) { C.deslizar(d[0], d[1]); this.hecho.push(d); }
        this.espera = 0;
      },
      info() {
        const p = C.partida, h = this.hecho; this.hecho = [];
        return { escena: C.escena, estado: p && p.estado, fin: p && p.fin, desliza: h, lu: p ? [p.lu.x, p.lu.y] : null, monedas: p && p.recogido.monedas };
      },
    };
    return true;
  },
  tomas: {
    portada: { q: '?idioma=es&sinintro', n: 270 },
    mapa: { q: '?idioma=es&directo=mapa', n: 105 },
    tienda: { q: '?idioma=es&directo=tienda', n: 105 },
    /* 1-1: la primera, con las tres estrellas en las puntas */
    n1: { q: '?idioma=es&directo=nivel:0', n: 165, preparar: () => window.__bot.nivel(0), cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    n3: { q: '?idioma=es&directo=nivel:2', n: 225, preparar: () => window.__bot.nivel(2), cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    n9: { q: '?idioma=es&directo=nivel:8', n: 300, preparar: () => window.__bot.nivel(8), cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    /* el jardín de hongos */
    hongos: { q: '?idioma=es&directo=nivel:13', n: 165, preparar: () => window.__bot.nivel(13), cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    /* el tercer mundo, con la lava que sube */
    lava21: { q: '?idioma=es&directo=nivel:20', n: 255, preparar: () => window.__bot.nivel(20), cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    lava22: { q: '?idioma=es&directo=nivel:21', n: 240, preparar: () => window.__bot.nivel(21), cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    lava24: { q: '?idioma=es&directo=nivel:23', n: 270, preparar: () => window.__bot.nivel(23), cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    /* sin esperar el momento: los pinchos que suben la agarran */
    pinchos: { q: '?idioma=es&directo=nivel:11', n: 150, preparar: () => window.__bot.nivel(11), cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    polilla: { q: '?idioma=es&directo=nivel:9', n: 105, preparar: () => window.__bot.nivel(9, 12), cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    /* la torre infinita: sube por sus tramos mientras la lava viene atrás */
    torre: { q: '?idioma=es&directo=torre', n: 480, preparar: () => { window.__bot.plan = null; window.__bot.pausa = 5; return true; }, cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
  },
};
export { DIRS };
