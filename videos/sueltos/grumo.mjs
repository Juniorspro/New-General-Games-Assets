// Las tomas de GRUMO. Cada escena trae "la solución pensada, jugada como persona" (niveles.js ›
// guion: hasta x, salta, calma, borde, camina…). El juego no trae el intérprete (vive en sus
// pruebas), así que acá hay uno: "borde" camina hasta el borde de lo que pisa (mirando un poco
// adelante con partida.clonar()) y salta desde ahí, y antes de cada salto se suelta el botón
// (el salto es por flanco). Con eso ganan diez de las veinte escenas; esas se graban.
// Para la muerte a propósito, la primera toma camina derecho; el juego arranca solo la toma 2
// (claqueta) y el bot vuelve a enganchar la partida nueva con el guion.
export default {
  archivo: 'grumo/grumo.html',
  listo: () => !!(window.listo && window.__G),
  comun: () => { const G = window.__G; G.datos.ajustes.calidad = 'alta'; G.datos.ajustes.idioma = 'es'; window.dispatchEvent(new Event('resize')); return true; },
  bot: () => {
    window.__guion = function (guion, op = {}) {
      let i = 0, t0 = null;
      const tol = op.tol ?? 0.06;
      return (p) => {
        const j = p.j;
        while (i < guion.length) {
          const c = guion[i];
          if (c[0] === 'hasta') {
            const d = c[1] - j.x;
            if (Math.abs(d) < tol || (t0 !== null && Math.sign(d) !== t0)) { i++; t0 = null; continue; }
            t0 = Math.sign(d);
            p.control.dir = Math.sign(d); p.control.salto = false; return;
          }
          if (c[0] === 'salta') {
            if (t0 === null) { if (p.control.salto) { p.control.salto = false; p.control.dir = c[1]; return; } t0 = p.t; }
            const e = p.t - t0, d1 = c[1], t1 = c[2], d2 = c[3] ?? 0, t2 = c[4] ?? 0;
            if (e < t1) { p.control.dir = d1; p.control.salto = true; return; }
            if (e < t1 + t2) { p.control.dir = d2; p.control.salto = false; return; }
            i++; t0 = null; continue;
          }
          if (c[0] === 'calma') {
            if (t0 === null) t0 = p.t;
            p.control.dir = 0; p.control.salto = false;
            const quieta = !(p.manos || []).some((m) => m.fase !== 'fin' && m.fase !== 'listo') && !(p.agenda || []).length;
            if ((j.suelo && quieta && p.t - t0 > 0.2) || p.t - t0 > 4) { i++; t0 = null; continue; }
            return;
          }
          if (c[0] === 'borde') {
            // caminar hacia d hasta el borde de lo que pisa y saltar desde ahí (como 'salta')
            if (t0 === null) {
              if (j.suelo) {
                const q = p.clonar(); delete q.paso; q.control.dir = c[1]; q.control.salto = false;   // (la copia sin el paso enganchado por el bot: si no, se llama a sí misma)
                let sigue = true;
                for (let k = 0; k < (op.mira ?? 10) && q.estado === 'juego'; k++) { q.paso(); if (!q.j.suelo) { sigue = false; break; } }
                if (sigue && q.estado === 'juego') { p.control.dir = c[1]; p.control.salto = false; return; }
              } else if (!j.suelo && p.control.salto === false) { p.control.dir = c[1]; return; }
              if (p.control.salto) { p.control.salto = false; p.control.dir = c[1]; return; }
              t0 = p.t;
            }
            const e = p.t - t0, d1 = c[1], t1 = c[2] ?? 0.5, d2 = c[3] ?? 0, t2 = c[4] ?? 0;
            if (e < t1) { p.control.dir = d1; p.control.salto = true; return; }
            if (e < t1 + t2) { p.control.dir = d2; p.control.salto = false; return; }
            i++; t0 = null; continue;
          }
          if (c[0] === 'camina') {
            if (t0 === null) t0 = p.t;
            if (p.t - t0 < c[2]) { p.control.dir = c[1]; p.control.salto = false; return; }
            i++; t0 = null; continue;
          }
          if (c[0] === 'espera') {
            if (t0 === null) t0 = p.t;
            p.control.dir = 0; p.control.salto = false;
            if (p.t - t0 < c[1]) return;
            i++; t0 = null; continue;
          }
          i++; t0 = null;
        }
        p.control.dir = 0; p.control.salto = false;
      };
    };
    const G = window.__G;
    window.__bot = {
      p: null, planes: [],
      /* planes: uno por toma; el último se repite. null = el guion de la escena */
      jugar(n, planes = [null]) { this.planes = planes; this.k = 0; G.jugar(n); this.enganchar(); return true; },
      enganchar() {
        const p = G.partida;
        if (!p || p === this.p) return;
        this.p = p;
        const plan = this.planes[Math.min(this.k++, this.planes.length - 1)] || p.def.guion || [];
        const ctl = window.__guion(plan), paso = p.paso.bind(p);
        p.paso = function () { if (this.estado === 'juego') ctl(this); paso(); };
      },
      info() {
        this.enganchar();
        const p = G.partida, c = G.camJuego;
        if (!p || !c) return null;
        const aCss = (x, y) => [+((c.x + x * c.ts) / G.dpr).toFixed(1), +((c.y + y * c.ts) / G.dpr).toFixed(1)];
        const m = p.manos && p.manos[0];
        return { grumo: aCss(p.j.x, p.j.y - 0.4), estado: p.estado, toma: G.toma, mano: m ? aCss(m.punto[0], m.punto[1]) : null, puerta: aCss(p.puerta.x, p.puerta.y - 0.6) };
      },
    };
    return true;
  },
  tomas: {
    menu: { q: '?idioma=es&sinintro', n: 240 },
    camarin: { q: '?idioma=es&sinintro', n: 165, preparar: () => { window.__G.abrirCamarin(); window.__reloj.cuadro(300); return true; },
      cuadro: (k) => { if (k === 30) { const b = [...document.querySelectorAll('button')].find((x) => /sombreros/i.test(x.textContent)); b && b.click(); } if (k > 40 && k % 25 === 15) window.__G.moverCamarin(1); return null; } },
    /* 1-1: la mano del animador se lleva la puerta arriba y hay que subir */
    t11: { q: '?idioma=es&sinintro&todo', n: 255, preparar: () => window.__bot.jugar(0), cuadro: () => window.__bot.enganchar(), despues: () => window.__bot.info() },
    /* 1-2: la primera toma camina derecho y el piso se cae; en la toma 2, salta */
    t12: { q: '?idioma=es&sinintro&todo', n: 270, preparar: () => window.__bot.jugar(1, [[['hasta', 9.5]], null]), cuadro: () => window.__bot.enganchar(), despues: () => window.__bot.info() },
    /* 1-5 y 1-6: más plataformas */
    t15: { q: '?idioma=es&sinintro&todo', n: 255, preparar: () => window.__bot.jugar(4), cuadro: () => window.__bot.enganchar(), despues: () => window.__bot.info() },
    t16: { q: '?idioma=es&sinintro&todo', n: 165, preparar: () => window.__bot.jugar(5), cuadro: () => window.__bot.enganchar(), despues: () => window.__bot.info() },
    /* la cocina (el segundo set) */
    t21: { q: '?idioma=es&sinintro&todo', n: 150, preparar: () => window.__bot.jugar(10), cuadro: () => window.__bot.enganchar(), despues: () => window.__bot.info() },
    t24: { q: '?idioma=es&sinintro&todo', n: 150, preparar: () => window.__bot.jugar(13), cuadro: () => window.__bot.enganchar(), despues: () => window.__bot.info() },
    t26: { q: '?idioma=es&sinintro&todo', n: 180, preparar: () => window.__bot.jugar(15), cuadro: () => window.__bot.enganchar(), despues: () => window.__bot.info() },
  },
};
