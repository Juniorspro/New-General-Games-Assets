'use strict';
// Los canales de color: lo que dice el nivel, lo que cambian los triggers de color (fundidos),
// las copias de otro canal con HSV y los pulsos. Los colores van en 0..1.

GD.JUGADOR1 = [125 / 255, 1, 0];     // los del ícono por defecto: verde lima y celeste
GD.JUGADOR2 = [0, 1, 1];

GD.Colores = class {
  constructor(definiciones) {
    this.definiciones = definiciones;
    this.reiniciar();
  }

  reiniciar() {
    this.canales = new Map();
    for (const [id, d] of Object.entries(this.definiciones)) this.canales.set(+id, this.desdeDefinicion(d));
    this.fundidos = new Map();      // canal → {de, a, t, dur, ...}
    this.pulsos = [];               // {objetivo, grupo, t, entra, queda, sale, color|hsv, copia, base, detalle}
    this.memo = new Map();
    this.cuadro = 0;
  }

  desdeDefinicion(d) {
    return { rgb: [d.r / 255, d.g / 255, d.b / 255], a: d.a ?? 1, mezcla: !!d.mezcla, jugador: d.jugador || 0,
             copia: d.copia || 0, hsvCopia: d.hsvCopia || null, copiaOpacidad: !!d.copiaOpacidad };
  }

  canalBase(id) {
    let c = this.canales.get(id);
    if (!c) {
      c = { rgb: [1, 1, 1], a: 1, mezcla: false, jugador: 0, copia: 0, hsvCopia: null, copiaOpacidad: false };
      this.canales.set(id, c);
    }
    return c;
  }

  // Trigger de color: el canal va hacia el color pedido en `dur` segundos (lineal, como GD).
  cambiar(canal, destino, dur) {
    const c = this.canalBase(canal);
    const de = this.calcular(canal, true);
    const f = { de: [de[0], de[1], de[2], de[3]], t: 0, dur: Math.max(0, dur), ...destino };
    this.fundidos.set(canal, f);
    c.mezcla = !!destino.mezcla;
    if (f.dur === 0) this.terminarFundido(canal, f);
  }

  terminarFundido(canal, f) {
    const c = this.canalBase(canal);
    if (f.copia) {
      Object.assign(c, { copia: f.copia, hsvCopia: f.hsv || null, copiaOpacidad: !!f.copiaOpacidad, jugador: 0 });
      if (!f.copiaOpacidad) c.a = f.a;
    } else if (f.jugador) {
      Object.assign(c, { jugador: f.jugador, copia: 0, a: f.a });
    } else {
      Object.assign(c, { rgb: [f.rgb[0], f.rgb[1], f.rgb[2]], a: f.a, jugador: 0, copia: 0 });
    }
    this.fundidos.delete(canal);
  }

  pulso(p) {
    if (p.exclusivo) this.pulsos = this.pulsos.filter((q) => q.objetivo !== p.objetivo || q.grupo !== p.grupo);
    this.pulsos.push({ ...p, t: 0 });
  }

  actualizar(dt) {
    for (const [canal, f] of this.fundidos) {
      f.t += dt;
      if (f.t >= f.dur) this.terminarFundido(canal, f);
    }
    if (this.pulsos.length) {
      for (const p of this.pulsos) p.t += dt;
      this.pulsos = this.pulsos.filter((p) => p.t < p.entra + p.queda + p.sale);
    }
    this.memo.clear();
  }

  intensidad(p) {
    if (p.t < p.entra) return p.entra ? p.t / p.entra : 1;
    if (p.t < p.entra + p.queda) return 1;
    return p.sale ? GD.limitar(1 - (p.t - p.entra - p.queda) / p.sale, 0, 1) : 0;
  }

  // Color de un canal ya resuelto: [r, g, b, a] y si mezcla (aditivo).
  calcular(id, sinPulsos) {
    const clave = sinPulsos ? -id - 1 : id;
    const memo = this.memo.get(clave);
    if (memo) return memo;
    this.memo.set(clave, [1, 1, 1, 1]);          // corta las copias en círculo
    const c = this.canalBase(id);
    let rgb, a = c.a;
    if (id === 1005) rgb = GD.JUGADOR1;
    else if (id === 1006) rgb = GD.JUGADOR2;
    else if (id === 1010) rgb = [0, 0, 0];
    else if (id === 1011) rgb = [1, 1, 1];
    else if (id === 1007) {
      // LBG: el fondo, más claro y menos saturado (como el "light BG" del original)
      const f = this.calcular(1000, true);
      rgb = GD.aplicarHSV(f, { h: 0, s: -0.2, v: 0.2, sSuma: true, vSuma: true });
    } else if (c.jugador) rgb = c.jugador === 2 ? GD.JUGADOR2 : GD.JUGADOR1;
    else if (c.copia) {
      const o = this.calcular(c.copia, true);
      rgb = GD.aplicarHSV(o, c.hsvCopia);
      if (c.copiaOpacidad) a = o[3];
    } else rgb = c.rgb;
    let res = [rgb[0], rgb[1], rgb[2], a];
    const f = this.fundidos.get(id);
    if (f) {
      let destino;
      if (f.copia) { const o = this.calcular(f.copia, true); destino = GD.aplicarHSV(o, f.hsv); destino[3] = f.copiaOpacidad ? o[3] : f.a; }
      else if (f.jugador) destino = [...(f.jugador === 2 ? GD.JUGADOR2 : GD.JUGADOR1), f.a];
      else destino = [f.rgb[0], f.rgb[1], f.rgb[2], f.a];
      const t = f.dur ? GD.limitar(f.t / f.dur, 0, 1) : 1;
      res = [0, 1, 2, 3].map((i) => GD.mezclar(f.de[i], destino[i], t));
    }
    if (!sinPulsos) for (const p of this.pulsos) if (!p.grupo && p.objetivo === id) res = this.aplicarPulso(res, p);
    res.mezcla = c.mezcla;
    this.memo.set(clave, res);
    return res;
  }

  aplicarPulso(color, p, tipoColor) {
    const k = this.intensidad(p);
    if (k <= 0) return color;
    let objetivo;
    if (p.hsv) {
      const base = p.copia ? this.calcular(p.copia, true) : color;
      objetivo = GD.aplicarHSV(base, p.hsv);
    } else objetivo = p.rgb;
    const r = [GD.mezclar(color[0], objetivo[0], k), GD.mezclar(color[1], objetivo[1], k), GD.mezclar(color[2], objetivo[2], k), color[3]];
    r.mezcla = color.mezcla;
    return r;
  }

  // Pulsos de grupo para una parte de un objeto (tipo: 'Base' o 'Detail').
  pulsosDeGrupo(o, color, tipoColor) {
    if (!this.pulsos.length || !o.grupos.length) return color;
    for (const p of this.pulsos) {
      if (!p.grupo || !o.grupos.includes(p.objetivo)) continue;
      if (p.base && tipoColor === 'Detail') continue;
      if (p.detalle && tipoColor !== 'Detail') continue;
      color = this.aplicarPulso(color, p, tipoColor);
    }
    return color;
  }
};
