'use strict';
// Piezas de interfaz dibujadas con los cuadros del juego: botones, barras y el fondo de los menús.
// Todo en las unidades del juego (320 de alto, el ancho según la pantalla), igual que los menús
// de GD, que se arman en puntos de una pantalla de 320 de alto.

// Botones como los de GD (CCMenuItemSpriteExtra): al apretarlos crecen un 26 % y vuelven al
// soltar; la acción corre al soltar adentro. Cada pantalla los pone en cada cuadro (la posición
// depende del ancho) y la botonera recuerda cuál está apretado.
GD.Botonera = class {
  constructor() {
    this.botones = new Map();      // id → botón
    this.vivos = new Set();        // los que se dibujaron en el último cuadro: los que se pueden tocar
    this.nuevos = new Set();       // los que se van poniendo en este cuadro
    this.apretado = null;          // { id, puntero, adentro }
  }

  // o: { escala, alfa, color, voltearX, minimo (lado mínimo para tocar), habilitado }
  poner(id, cuadro, x, y, accion, o = {}) {
    let b = this.botones.get(id);
    if (!b) { b = { id, k: 1 }; this.botones.set(id, b); }
    Object.assign(b, { cuadro, x, y, accion, escala: o.escala ?? 1, alfa: o.alfa ?? 1, color: o.color || null,
                       voltearX: !!o.voltearX, minimo: o.minimo ?? 34, habilitado: o.habilitado !== false });
    this.nuevos.add(id);
    return b;
  }

  contiene(r, b, x, y) {
    const [w, h] = r.tamCuadro(b.cuadro);
    const mw = Math.max(w * b.escala, b.minimo) / 2, mh = Math.max(h * b.escala, b.minimo) / 2;
    return Math.abs(x - b.x) <= mw && Math.abs(y - b.y) <= mh;
  }

  // ¿Qué botón hay en (x, y)? El último puesto queda arriba.
  buscar(r, x, y) {
    let res = null;
    for (const id of this.vivos) {
      const b = this.botones.get(id);
      if (b.habilitado && this.contiene(r, b, x, y)) res = b;
    }
    return res;
  }

  abajo(r, x, y, puntero) {
    if (this.apretado) return false;
    const b = this.buscar(r, x, y);
    if (!b) return false;
    this.apretado = { id: b.id, puntero, adentro: true };
    return true;
  }

  mover(r, x, y, puntero) {
    const a = this.apretado;
    if (!a || a.puntero !== puntero) return false;
    const b = this.botones.get(a.id);
    a.adentro = !!b && this.contiene(r, b, x, y);
    return true;
  }

  arriba(r, x, y, puntero) {
    const a = this.apretado;
    if (!a || a.puntero !== puntero) return false;
    this.apretado = null;
    const b = this.botones.get(a.id);
    if (b && b.habilitado && this.vivos.has(b.id) && this.contiene(r, b, x, y)) b.accion();
    return true;
  }

  cancelar() { this.apretado = null; }

  dibujar(r, dt) {
    r.modo(false);
    for (const id of this.nuevos) {
      const b = this.botones.get(id);
      const meta = this.apretado && this.apretado.id === id && this.apretado.adentro ? 1.26 : 1;
      b.k += (meta - b.k) * Math.min(1, dt * 16);
      const c = b.color || [1, 1, 1, 1];
      const a = b.alfa * (b.habilitado ? 1 : 0.4);
      r.sprite(b.cuadro, b.x, b.y, b.escala * b.k, 0, [c[0], c[1], c[2], (c[3] ?? 1) * a], b.voltearX ? -1 : 1, 1);
    }
    // los que no se pusieron en este cuadro dejan de existir para el toque
    this.vivos = this.nuevos;
    this.nuevos = new Set();
  }
};

// Barra de progreso de GD: el cuadro GJ_progressBar_001 de fondo, negro y transparente, y encima
// el mismo cuadro un poco más chico, recortado hasta el porcentaje.
GD.barraProgreso = function (r, cx, cy, ancho, fraccion, color, alfaFondo = 0.45) {
  const [w, h] = r.tamCuadro('GJ_progressBar_001.png');
  const alto = ancho * h / w;
  r.modo(false);
  r.recorte('GJ_progressBar_001.png', cx - ancho / 2, cy - alto / 2, cx + ancho / 2, cy + alto / 2, 1, [0, 0, 0, alfaFondo]);
  const aw = ancho * 0.992, ah = alto * 0.86;
  r.recorte('GJ_progressBar_001.png', cx - aw / 2, cy - ah / 2, cx + aw / 2, cy + ah / 2, fraccion, color);
  return alto;
};

// Texto que no pasa de un ancho: achica la escala si hace falta.
GD.textoAjustado = function (r, fuente, s, x, y, escala, anchoMax, color, alinear = 0.5) {
  const w = r.medirTexto(fuente, s, escala);
  const e = w > anchoMax ? escala * anchoMax / w : escala;
  return r.texto(fuente, s, x, y, e, color, alinear);
};

// Fondo de los menús: el fondo 1 y el piso 1 del juego corriendo, teñidos.
GD.FondoMenu = class {
  constructor(texFondo, texPiso) {
    this.texFondo = texFondo;
    this.texPiso = texPiso;
    this.x = 0;
  }

  dibujar(r, dt, color, velocidad = 200, sueloY = 70, conFondo = true) {
    this.x += dt * velocidad;
    r.modo(false);
    if (conFondo) r.mosaico(this.texFondo, 0, 0, r.VW, r.VH, 512, -this.x * 0.1, -40, [color[0], color[1], color[2], 1]);
    const piso = [color[0] * 0.65, color[1] * 0.65, color[2] * 0.65, 1];
    r.mosaico(this.texPiso, 0, -200, r.VW, sueloY, 128, -this.x, sueloY - 128, piso);
    r.modo(true);
    const [lw] = r.tamCuadro('floorLine_001.png');
    r.sprite('floorLine_001.png', r.VW / 2, sueloY, 1, 0, [1, 1, 1, 1], lw ? Math.max(1, r.VW / lw) : 1, 1);
    r.modo(false);
  }
};

// Colores: de HSV (h en grados) a RGB 0..1, para el fondo del menú que va cambiando de color.
GD.hsv = function (h, s, v) {
  h = ((h % 360) + 360) % 360 / 60;
  const i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
};
