// Las tomas de GLOBO LIBRE. El bot mueve el escudo como lo movería un dedo: busca lo que va a
// tocar el globo primero y lo empuja desde abajo y del lado de adentro, para afuera de la
// columna del globo; si no hay nada, espera arriba del globo. El globo va inmortal (el gancho
// de las pruebas) y cada cuadro anota si algo lo tocó: el montaje usa solo los tramos limpios.
export default {
  archivo: 'globo/globo.html',
  listo: () => !!(window.listo && window.__G),
  /* calidad alta: dpr 2,5, que es justo el de las capturas */
  comun: () => { const G = window.__G; G.datos.ajustes.calidad = 'alta'; G.datos.ajustes.idioma = 'es'; window.dispatchEvent(new Event('resize')); return true; },
  bot: () => {
    const ANCHO = 360, RE = 20;
    const cam = () => {
      const G = window.__G, p = G.partida, esc = Math.min(G.W / ANCHO, G.H / 560);
      return { esc, ox: (G.W - ANCHO * esc) / 2, arriba: p.arriba(), dpr: G.dpr };
    };
    const aCss = (c, x, y) => [+((c.ox + x * c.esc) / c.dpr).toFixed(1), +(((y - c.arriba) * c.esc) / c.dpr).toFixed(1)];
    function amenaza(p) {
      const g = p.globo, e = p.escudo;
      let mejor = null, mt = 1e9;
      for (const b of p.mundo.cuerpos) {
        if (b === e || !b.vivo || b.tipo === 0) continue;          // lo fijo nunca cruza la columna
        const dx = b.x - g.x, dy = b.y - g.y;
        if (dy > b.r + 12) continue;                               // ya quedó abajo
        if (Math.abs(dx) - b.r - g.r > 24) continue;               // pasa de largo
        const dist = -dy - b.r - g.r, vrel = p.vel + Math.max(0, b.vy || 0);
        const tt = Math.max(0, dist) / Math.max(30, vrel);
        if (tt < 2.4 && tt < mt) { mt = tt; mejor = b; }
      }
      return mejor;
    }
    window.__bot = {
      quieto: false,
      paso() {
        const p = window.__G.partida;
        if (!p || p.estado !== 'juego') return null;
        const g = p.globo, b = this.quieto ? null : amenaza(p);
        let tx, ty;
        if (b && b.pivote) {
          // un molinete (barra clavada por el centro) no se corre: se empuja para arriba la
          // punta que está sobre la columna del globo, así gira y deja pasar
          const hx = b.hx, c = Math.cos(b.a), s = Math.sin(b.a);
          const p1 = [b.x + c * hx, b.y + s * hx], p2 = [b.x - c * hx, b.y - s * hx];
          const pt = Math.abs(p1[0] - g.x) < Math.abs(p2[0] - g.x) ? p1 : p2;
          tx = pt[0] + Math.sign(pt[0] - b.x) * 6; ty = pt[1] + RE + 4;
        } else if (b) {
          let lado = Math.sign(b.x - g.x) || (g.x < ANCHO / 2 ? 1 : -1);
          if (b.x + lado * (b.r + 46) > ANCHO - 4 || b.x + lado * (b.r + 46) < 4) lado = -lado;
          const hx = b.forma === 'bola' ? b.r : Math.min(b.hx, 55), hy = b.forma === 'bola' ? b.r : Math.min(b.hy, 30);
          tx = b.x - lado * (hx + RE - 16);
          ty = b.y + hy * 0.45 + 4;
        } else { tx = g.x; ty = g.y - 78; }
        if (!this.quieto) {
          const rx = tx, ry = ty - g.y, dx = rx - p.relObj.x, dy = ry - p.relObj.y, d = Math.hypot(dx, dy);
          const k = Math.min(1, 0.55, 85 / Math.max(1e-6, d));
          p.mover(dx * k, dy * k);
        }
        return true;
      },
      /* lo que pasó en el cuadro: dónde quedaron el globo y el escudo (en CSS) y si algo tocó el globo */
      info() {
        const p = window.__G.partida;
        if (!p) return null;
        const c = cam(), g = p.globo, e = p.escudo;
        let toca = false;
        if (p.estado === 'juego') p.mundo.cerca(g.x, g.y, g.r * 0.95, (q) => { if (q !== e) toca = true; });
        return { g: aCss(c, g.x, g.y), e: aCss(c, e.x, e.y), toca, estado: p.estado, alto: Math.round(p.altura()) };
      },
    };
    return true;
  },
  tomas: {
    /* el menú: el cartel con los globos y el cielo que se mueve */
    menu: { q: '?idioma=es&sinintro', n: 240 },
    /* la grilla de niveles: día, atardecer y noche */
    niveles: { q: '?idioma=es&sinintro', n: 90, preparar: () => { const b = [...document.querySelectorAll('button')].find((x) => /niveles/i.test(x.textContent)); if (!b) return false; b.click(); window.__reloj.cuadro(400); return true; } },
    /* la tienda de globos */
    tienda: { q: '?idioma=es&sinintro', n: 120, preparar: () => { const G = window.__G; G.abrirTienda(); window.__reloj.cuadro(300); return true; }, cuadro: (k) => { if (k === 45 || k === 85) window.__G.moverTienda(1); return null; } },
    /* el primer nivel sin mover el escudo: la caja de arriba lo revienta */
    pum: { q: '?idioma=es&sinintro', n: 330, preparar: () => { const G = window.__G; G.jugar(0); window.__bot.quieto = true; return true; }, cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    /* de día (nivel 10: torre, bolas, péndulo, ladrillos y molinete) */
    dia: { q: '?idioma=es&sinintro', n: 600, preparar: () => { const G = window.__G; G.jugar(9); G.partida.inmortal = true; return true; }, cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    /* al atardecer (nivel 14: caja, péndulo, jaula, molinete) */
    tarde: { q: '?idioma=es&sinintro', n: 540, preparar: () => { const G = window.__G; G.jugar(13); G.partida.inmortal = true; return true; }, cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    /* de noche (nivel 22) */
    noche: { q: '?idioma=es&sinintro', n: 540, preparar: () => { const G = window.__G; G.jugar(21); G.partida.inmortal = true; return true; }, cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
    /* el infinito */
    infinito: { q: '?idioma=es&sinintro', n: 420, preparar: () => { const G = window.__G; G.infinito(); G.partida.inmortal = true; return true; }, cuadro: () => window.__bot.paso(), despues: () => window.__bot.info() },
  },
};
