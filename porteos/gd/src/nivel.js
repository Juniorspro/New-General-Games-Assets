'use strict';
// Un nivel: la cabecera (ajustes y colores) y sus objetos, ya listos para jugar y dibujar.
// El formato es el de GD: "k,v,k,v;" con la cabecera primero y un objeto por bloque.

GD.SECCION = 100;           // los objetos se agrupan por x, como el original, para buscar rápido

// Canales de los colores viejos (kS29..kS37) y del color viejo de cada objeto (propiedad 19).
const CANAL_KS = { kS29: 1000, kS30: 1001, kS31: 1002, kS32: 1004, kS33: 1, kS34: 2, kS35: 3, kS36: 4, kS37: 1003 };
const COLOR_19 = { 1: 1005, 2: 1006, 3: 1, 4: 2, 5: 1007, 6: 3, 7: 4, 8: 1003 };
// Lo que GD pone si el nivel no dice nada.
const COLOR_DEFECTO = { 1000: [40, 125, 255], 1001: [0, 102, 255], 1002: [255, 255, 255], 1003: [255, 255, 255],
                        1004: [255, 255, 255], 1009: [0, 102, 255], 1010: [0, 0, 0], 1011: [255, 255, 255] };

GD.leerColorViejo = function (s) {
  const p = s.split('_'), c = {};
  for (let i = 0; i + 1 < p.length; i += 2) c[p[i]] = p[i + 1];
  return c;
};

GD.Nivel = class {
  constructor(texto, defs) {
    const bloques = texto.split(';');
    const cab = bloques[0].split(',');
    const k = {};
    for (let i = 0; i + 1 < cab.length; i += 2) k[cab[i]] = cab[i + 1];
    this.cabecera = k;
    const modos = ['cubo', 'nave', 'bola', 'ovni', 'onda', 'robot', 'arana', 'swing'];
    const velocidades = [0.9, 0.7, 1.1, 1.3, 1.6];
    this.ajustes = {
      modo: modos[+k.kA2 || 0] || 'cubo',
      mini: k.kA3 === '1',
      velocidad: velocidades[+k.kA4 || 0] || 0.9,
      dual: k.kA8 === '1',
      gravedadInvertida: k.kA11 === '1',
      fondo: Math.max(1, +k.kA6 || 0),
      piso: Math.max(1, +k.kA7 || 0),
      linea: +k.kA17 || 0,
      desfaseCancion: +k.kA13 || 0,
    };
    this.colores = this.leerColores(k);

    const objetos = [];
    for (let i = 1; i < bloques.length; i++) {
      if (!bloques[i]) continue;
      const o = this.leerObjeto(bloques[i], defs);
      if (o) { o.i = objetos.length; objetos.push(o); }
    }
    this.objetos = objetos;

    // grupos, secciones, triggers por x y el largo
    this.grupos = new Map();
    let maxX = 0;
    for (const o of objetos) {
      for (const g of o.grupos) {
        if (!this.grupos.has(g)) this.grupos.set(g, []);
        this.grupos.get(g).push(o);
      }
      if (o.tipo !== 'trigger' && o.tipo !== 'entrada') maxX = Math.max(maxX, o.x);
    }
    // GD: el final está 340 unidades después del objeto más lejano.
    this.largo = maxX + 340;
    this.armarSecciones();
    this.triggers = objetos.filter((o) => (o.tipo === 'trigger' || o.tipo === 'entrada') && !o.porToque && !o.porGenerar)
                           .sort((a, b) => a.x - b.x || a.i - b.i);
    // orden de dibujo fijo: capa, orden z y orden en el archivo (como gdclone)
    this.dibujables = objetos.filter((o) => o.partes.length);
  }

  leerColores(k) {
    const c = {};
    for (const [id, rgb] of Object.entries(COLOR_DEFECTO)) {
      c[id] = { r: rgb[0], g: rgb[1], b: rgb[2], a: 1, mezcla: id === '1002', jugador: 0 };
    }
    for (const [clave, canal] of Object.entries(CANAL_KS)) {
      if (!k[clave]) continue;
      const v = GD.leerColorViejo(k[clave]);
      c[canal] = { r: +v[1] || 0, g: +v[2] || 0, b: +v[3] || 0, a: v[7] !== undefined ? +v[7] : 1,
                   mezcla: v[5] === '1' || canal === 1002, jugador: +v[4] > 0 ? +v[4] : 0 };
    }
    if (k.kS38) {
      for (const s of k.kS38.split('|')) {
        if (!s) continue;
        const v = GD.leerColorViejo(s);
        const id = +v[6];
        if (!id) continue;
        c[id] = { r: +v[1] || 0, g: +v[2] || 0, b: +v[3] || 0, a: v[7] !== undefined ? +v[7] : 1,
                  mezcla: v[5] === '1', jugador: +v[4] > 0 ? +v[4] : 0,
                  copia: +v[9] || 0, hsvCopia: v[10] ? GD.leerHSV(v[10]) : null, copiaOpacidad: v[17] === '1' };
      }
    }
    return c;
  }

  leerObjeto(bloque, defs) {
    const p = bloque.split(',');
    const m = {};
    for (let i = 0; i + 1 < p.length; i += 2) m[p[i]] = p[i + 1];
    const id = +m[1];
    const def = defs[id];
    if (!def) return null;
    const o = {
      id, def, tipo: def.tipo, sub: def.sub, p: m,
      x: +m[2] || 0, y: +m[3] || 0, rot: +m[6] || 0,
      sx: (m[128] !== undefined ? +m[128] : m[32] !== undefined ? +m[32] : 1) * (m[4] === '1' ? -1 : 1),
      sy: (m[129] !== undefined ? +m[129] : m[32] !== undefined ? +m[32] : 1) * (m[5] === '1' ? -1 : 1),
      capa: m[24] !== undefined && m[24] !== '0' ? +m[24] : def.default_z_layer ?? 0,     // 0: la capa por defecto
      orden: m[25] !== undefined ? +m[25] : def.default_z_order ?? 0,
      grupos: m[57] ? m[57].split('.').map(Number).filter(Boolean) : m[33] ? [+m[33]] : [],
      sinFundido: m[64] === '1',
      porToque: m[11] === '1',
      porGenerar: m[62] === '1',
      multi: m[87] === '1',
      oculto: m[135] === '1',
    };
    o.x0 = o.x; o.y0 = o.y; o.rot0 = o.rot;
    let base = m[21] !== undefined ? +m[21] : def.default_base_color_channel ?? 0;
    let detalle = m[22] !== undefined ? +m[22] : def.default_detail_color_channel ?? 0;
    if (m[19] !== undefined && m[21] === undefined && COLOR_19[m[19]]) {
      if (def.color_type === 'Detail') detalle = COLOR_19[m[19]]; else base = COLOR_19[m[19]];
    }
    let hsvB = m[41] === '1' ? GD.leerHSV(m[43]) : null;
    let hsvD = m[42] === '1' ? GD.leerHSV(m[44]) : null;
    if (def.swap_base_detail) { [base, detalle] = [detalle, base]; [hsvB, hsvD] = [hsvD, hsvB]; }
    o.cBase = base; o.cDetalle = detalle; o.hsvBase = hsvB; o.hsvDetalle = hsvD;
    o.partes = this.armarPartes(o, def);
    return o;
  }

  // Las partes que se dibujan: el cuadro principal y los hijos de object.json, cada uno con su
  // posición, giro, escala, volteo, z relativo, tipo de color y opacidad.
  armarPartes(o, def) {
    const partes = [];
    if (o.tipo === 'trigger' || o.tipo === 'entrada' || o.oculto) return partes;
    const agregar = (tex, tipoColor, padre, hijo) => {
      partes.push({ tex, color: tipoColor || 'None', padre, ...hijo });
    };
    if (def.texture && def.texture !== 'emptyFrame.png') {
      agregar(def.texture, def.color_type, -1, { x: 0, y: 0, rot: 0, sx: 1, sy: 1, z: 0, ax: 0, ay: 0, op: def.opacity ?? 1 });
    }
    const hijos = (lista, padre, zPadre) => {
      for (const h of lista || []) {
        const idx = partes.length;
        agregar(h.texture, h.color_type, padre, {
          x: h.x, y: h.y, rot: h.rot, sx: h.scale_x * (h.flip_x ? -1 : 1), sy: h.scale_y * (h.flip_y ? -1 : 1),
          z: zPadre + h.z / 1000, ax: h.anchor_x * (h.flip_x ? -1 : 1), ay: h.anchor_y * (h.flip_y ? -1 : 1),
          op: h.opacity ?? 1,
        });
        if (h.children) hijos(h.children, idx, zPadre + h.z / 1000);
      }
    };
    hijos(def.children, -1, 0);
    return partes;
  }

  armarSecciones() {
    this.secciones = [];
    for (const o of this.objetos) {
      if (o.tipo === 'trigger' || o.tipo === 'entrada') continue;
      const s = Math.max(0, Math.floor(o.x / GD.SECCION));
      (this.secciones[s] || (this.secciones[s] = [])).push(o);
    }
    for (let i = 0; i < this.secciones.length; i++) this.secciones[i] = this.secciones[i] || [];
  }
};

// El texto del nivel: base64 (url) con gzip. DecompressionStream en el navegador; zlib en Node.
GD.decodificarNivel = async function (b64) {
  const limpio = b64.match(/^[A-Za-z0-9_=-]*/)[0].replace(/-/g, '+').replace(/_/g, '/');
  const bin = typeof atob === 'function' ? Uint8Array.from(atob(limpio + '='.repeat((4 - limpio.length % 4) % 4)), (c) => c.charCodeAt(0))
                                         : Buffer.from(limpio, 'base64');
  if (typeof DecompressionStream === 'function') {
    const s = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new TextDecoder().decode(await new Response(s).arrayBuffer());
  }
  return require('zlib').gunzipSync(bin).toString('utf8');
};
