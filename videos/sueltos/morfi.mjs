// Las tomas de MORFI. Cada nivel trae su solución (niveles.js › sol: cortes, toques al globo y
// soplidos, en segundos desde que arranca): el bot la aplica en el paso exacto de la física,
// como la prueba del juego, así sale con las tres estrellas siempre. Anota dónde cae cada corte
// y cada toque en la pantalla (CSS), para que el montaje dibuje el dedo ahí.
export default {
  archivo: 'morfi/morfi.html',
  listo: () => !!(window.listo && window.__G),
  comun: () => { const G = window.__G; G.datos.ajustes.calidad = 'alta'; G.datos.ajustes.idioma = 'es'; window.dispatchEvent(new Event('resize')); return true; },
  bot: () => {
    const G = window.__G;
    const aCss = (x, y) => { const c = G.camJuego; return [+((c.ox + x * c.esc) / G.dpr).toFixed(1), +((c.oy + y * c.esc) / G.dpr).toFixed(1)]; };
    window.__bot = {
      toques: [],
      jugar(n, sol) {
        G.jugar(n);
        const p = G.partida, plan = sol || p.def.sol || [];
        let i = 0;
        const paso = p.paso.bind(p), bot = this;
        p.paso = function () {
          while (i < plan.length && this.t >= plan[i][0]) {
            const a = plan[i].slice(1);
            if (a[0] === 'c') {
              const h = this.mundo.hilos.find((h) => h.vivo && !h.suelto && h.ref === a[1] && h.p[h.p.length - 1] === this.c);
              this.accion(a);
              const ev = this.eventos.filter((e) => e.tipo === 'corte').pop();
              if (h && ev) bot.toques.push({ tipo: 'corte', en: aCss(ev.x, ev.y) });
            } else if (a[0] === 'g') { bot.toques.push({ tipo: 'toque', en: aCss(this.x, this.y) }); this.accion(a); }
            else if (a[0] === 'a') { const ab = this.abanicos[a[1]]; bot.toques.push({ tipo: 'toque', en: aCss(ab.x, ab.y) }); this.accion(a); }
            i++;
          }
          paso();
        };
        return true;
      },
      info() {
        const p = G.partida;
        if (!p) return null;
        const t = this.toques; this.toques = [];
        return { caramelo: aCss(p.x, p.y), boca: aCss(...p.boca()), estado: p.estado, estrellas: p.tomadas, toques: t };
      },
    };
    return true;
  },
  tomas: {
    menu: { q: '?idioma=es&sinintro', n: 240 },
    cajas: { q: '?idioma=es&sinintro', n: 90, preparar: () => { const b = [...document.querySelectorAll('button')].find((x) => /^cajas$/i.test(x.textContent.trim())); if (!b) return false; b.click(); window.__reloj.cuadro(300); return true; } },
    tienda: { q: '?idioma=es&sinintro', n: 150, preparar: () => { window.__G.abrirTienda(); window.__reloj.cuadro(300); return true; }, cuadro: (k) => { if (k % 35 === 25) window.__G.moverTienda(1); return null; } },
    /* 1-1: un hilo, se corta y cae por las tres estrellas a la boca */
    n1: { q: '?idioma=es&sinintro&todo', n: 210, preparar: () => window.__bot.jugar(0), despues: () => window.__bot.info() },
    /* tres hilos, en orden */
    hilos3: { q: '?idioma=es&sinintro&todo', n: 180, preparar: () => window.__bot.jugar(2), despues: () => window.__bot.info() },
    /* cuatro hilos */
    hilos4: { q: '?idioma=es&sinintro&todo', n: 300, preparar: () => window.__bot.jugar(8), despues: () => window.__bot.info() },
    /* el globo de papel: lo sube; un toque lo revienta */
    globo: { q: '?idioma=es&sinintro&todo', n: 240, preparar: () => window.__bot.jugar(10), despues: () => window.__bot.info() },
    /* el abanico: un toque y sopla */
    abanico: { q: '?idioma=es&sinintro&todo', n: 150, preparar: () => window.__bot.jugar(11), despues: () => window.__bot.info() },
    /* globo, abanico y dos filas de chinches */
    combo: { q: '?idioma=es&sinintro&todo', n: 240, preparar: () => window.__bot.jugar(18), despues: () => window.__bot.info() },
    /* sin soplar el abanico: el caramelo cae en las chinches y se rompe */
    roto: { q: '?idioma=es&sinintro&todo', n: 120, preparar: () => window.__bot.jugar(14, [[0.53, 'c', 0]]), despues: () => window.__bot.info() },
  },
};
