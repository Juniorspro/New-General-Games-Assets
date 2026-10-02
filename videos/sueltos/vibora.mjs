// Las tomas de VÍBORA.IO. La víbora propia la maneja el mismo cerebro que a los bots
// (mundo.js › pensar): se la marca bot y se le da una personalidad prudente y con hambre.
// El turbo se aprieta desde afuera (entrada.turbo), como el botón del rayo.
export default {
  archivo: 'vibora/vibora.html',
  listo: () => !!(window.listo && window.__V),
  comun: () => { const V = window.__V; V.datos.ajustes.calidad = 'alta'; V.datos.ajustes.idioma = 'es'; window.dispatchEvent(new Event('resize')); return true; },
  bot: () => {
    const V = window.__V;
    V.entrada.turbo = () => !!window.__turbo;
    window.__bot = {
      empezar({ bots = 1, agresion = 0.7 } = {}) {
        V.datos.nivelBots = bots;
        document.getElementById('apodo').value = 'JXStudios';
        V.jugar();
        const m = V.mia;
        m.bot = true;
        m.ia = { proxima: 0, codicia: 1.3, agresion, prudencia: 1.6, deambula: 0 };
        // inmortal para grabar: si choca, no se muere (se anota y esos cuadros no se usan)
        const mundo = V.mundo, morir = mundo.morir.bind(mundo), bot = this;
        mundo.morir = (v, asesino) => { if (v === V.mia) { bot.salvada = true; return; } return morir(v, asesino); };
        return true;
      },
      info() {
        const m = V.mia, c = V.cam;
        if (!m) return null;
        const aCss = (x, y) => [+(((x - c.x) * c.zoom + V.W / 2) / V.dpr).toFixed(1), +(((y - c.y) * c.zoom + V.H / 2) / V.dpr).toFixed(1)];
        const salvada = !!this.salvada; this.salvada = false;
        return { salvada, cab: aCss(m.x, m.y), masa: Math.round(m.masa), bajas: m.bajas, viva: m.viva, estado: V.estado, vivas: V.mundo.viboras.filter((v) => v.viva).length, turbo: !!m.turbo };
      },
    };
    return true;
  },
  tomas: {
    /* el menú: el logo de neón y víboras de fondo */
    menu: { q: '?idioma=es&sinintro', n: 240 },
    /* los bots: se toca PICANTE en el menú */
    bots: { q: '?idioma=es&sinintro', n: 150, cuadro: (k) => {
      const b = (t) => [...document.querySelectorAll('button')].find((x) => x.textContent.trim().toLowerCase() === t);
      if (k === 25) b('tranqui')?.click();
      if (k === 50) b('normal')?.click();
      if (k === 75) b('picante')?.click();
      return null;
    } },
    /* la piel: el elegidor, pasando de a una */
    piel: { q: '?idioma=es&sinintro', n: 150, preparar: () => { const b = [...document.querySelectorAll('button')].find((x) => /^piel$/i.test(x.textContent.trim())); if (!b) return false; b.click(); window.__reloj.cuadro(300); return true; },
      cuadro: (k) => { if (k % 30 === 20) document.querySelector('[aria-label="siguiente"]')?.click(); return null; } },
    /* jugando: come, crece y se cruza con los bots (picantes: se matan entre ellos y con ella) */
    juego: { q: '?idioma=es&sinintro', n: 1350, preparar: () => window.__bot.empezar({ bots: 2, agresion: 0.9 }), despues: () => window.__bot.info() },
    /* con turbo a ratos (el rayo), ya más larga */
    turbo: { q: '?idioma=es&sinintro', n: 600, preparar: () => { window.__bot.empezar({ bots: 1, agresion: 0.9 }); const m = window.__V.mia; m.masa = 90; return true; },
      cuadro: (k) => { window.__turbo = (k > 60 && k < 140) || (k > 300 && k < 380); return null; }, despues: () => window.__bot.info() },
  },
};
