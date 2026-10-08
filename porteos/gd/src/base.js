'use strict';
// Geometry Dash en el navegador: base común. Unidades del juego: un bloque son 30; la
// pantalla mide 320 de alto (la resolución de diseño del original) y lo que dé de ancho.
const GD = (typeof window !== 'undefined' ? window : globalThis).GD = {};

GD.ALTO = 320;
GD.ESCALA_HD = 2;          // las hojas son -hd: 2 píxeles de textura por unidad
GD.PASOS = 240;            // pasos de física por segundo, como el original (GJBaseGameLayer::update)

GD.limitar = (v, a, b) => (v < a ? a : v > b ? b : v);
GD.mezclar = (a, b, t) => a + (b - a) * t;

// Las curvas de los triggers (propiedad 30) son las de Cocos2d, con la tasa de la 85.
GD.curva = function (tipo, t, tasa) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const r = tasa || 2;
  const rebote = (u) => {
    if (u < 1 / 2.75) return 7.5625 * u * u;
    if (u < 2 / 2.75) { u -= 1.5 / 2.75; return 7.5625 * u * u + 0.75; }
    if (u < 2.5 / 2.75) { u -= 2.25 / 2.75; return 7.5625 * u * u + 0.9375; }
    u -= 2.625 / 2.75; return 7.5625 * u * u + 0.984375;
  };
  const p = tasa && tasa < 1.5 ? tasa : 0.3;           // período del elástico
  const o = 1.70158;
  switch (tipo | 0) {
    case 1: t *= 2; return t < 1 ? 0.5 * Math.pow(t, r) : 1 - 0.5 * Math.pow(2 - t, r);
    case 2: return Math.pow(t, r);
    case 3: return Math.pow(t, 1 / r);
    case 4: {
      const pp = p * 1.5, s = pp / 4; t = t * 2 - 1;
      return t < 0 ? -0.5 * Math.pow(2, 10 * t) * Math.sin((t - s) * 2 * Math.PI / pp)
                   : Math.pow(2, -10 * t) * Math.sin((t - s) * 2 * Math.PI / pp) * 0.5 + 1;
    }
    case 5: { const s = p / 4; t -= 1; return -Math.pow(2, 10 * t) * Math.sin((t - s) * 2 * Math.PI / p); }
    case 6: { const s = p / 4; return Math.pow(2, -10 * t) * Math.sin((t - s) * 2 * Math.PI / p) + 1; }
    case 7: return t < 0.5 ? (1 - rebote(1 - t * 2)) * 0.5 : rebote(t * 2 - 1) * 0.5 + 0.5;
    case 8: return 1 - rebote(1 - t);
    case 9: return rebote(t);
    case 10: return t < 0.5 ? 0.5 * Math.pow(2, 10 * (t * 2 - 1)) : 0.5 * (2 - Math.pow(2, -10 * (t * 2 - 1)));
    case 11: return Math.pow(2, 10 * (t - 1)) - 0.001;
    case 12: return 1 - Math.pow(2, -10 * t);
    case 13: return -0.5 * (Math.cos(Math.PI * t) - 1);
    case 14: return 1 - Math.cos(t * Math.PI / 2);
    case 15: return Math.sin(t * Math.PI / 2);
    case 16: {
      const q = o * 1.525; t *= 2;
      if (t < 1) return (t * t * ((q + 1) * t - q)) / 2;
      t -= 2; return (t * t * ((q + 1) * t + q)) / 2 + 1;
    }
    case 17: return t * t * ((o + 1) * t - o);
    case 18: t -= 1; return t * t * ((o + 1) * t + o) + 1;
    default: return t;
  }
};

// HSV de GD: "h a s a v a sChecked a vChecked" (sChecked/vChecked: la saturación y el valor
// se suman en vez de multiplicar).
GD.leerHSV = function (s) {
  if (!s) return null;
  const p = String(s).split('a');
  return { h: +p[0] || 0, s: p[1] === undefined ? 1 : +p[1], v: p[2] === undefined ? 1 : +p[2],
           sSuma: p[3] === '1', vSuma: p[4] === '1' };
};

GD.aplicarHSV = function (c, hsv) {
  if (!hsv) return c;
  let r = c[0], g = c[1], b = c[2];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  let s = max ? d / max : 0, v = max;
  h = ((h + hsv.h) % 360 + 360) % 360;
  s = GD.limitar(hsv.sSuma ? s + hsv.s : s * hsv.s, 0, 1);
  v = GD.limitar(hsv.vSuma ? v + hsv.v : v * hsv.v, 0, 1);
  const cc = v * s, x = cc * (1 - Math.abs((h / 60) % 2 - 1)), m = v - cc;
  const [rr, gg, bb] = h < 60 ? [cc, x, 0] : h < 120 ? [x, cc, 0] : h < 180 ? [0, cc, x]
                     : h < 240 ? [0, x, cc] : h < 300 ? [x, 0, cc] : [cc, 0, x];
  return [rr + m, gg + m, bb + m, c[3]];
};
