// porteo: el mundo del lado de la página: una copia de los bloques de cada trozo (la manda el
// trabajador) para chocar, apuntar y guardar, y los cambios del jugador (van al trabajador, que
// rehace la luz y las mallas).
var Mundo = (function () {
  'use strict';
  var M = {};
  var trozos = new Map();
  var trab = null;
  // los trozos que tocó el jugador (lo que se guarda): siguen acá aunque se alejen y se descarguen, y
  // los que cambiaron desde la última vez que se guardó
  M.modificados = new Map();
  M.sucios = new Set();

  M.iniciar = function (trabajador) { trab = trabajador; trozos.clear(); M.modificados.clear(); M.sucios.clear(); };
  M.recibir = function (d) {
    var k = d.cx + ',' + d.cz, t = { cx: d.cx, cz: d.cz, ids: d.ids, meta: d.meta, biomas: d.biomas };
    trozos.set(k, t);
    // volvió uno tocado (el trabajador le aplicó los cambios): el de acá pasa a ser éste
    if (M.modificados.has(k)) M.modificados.set(k, t);
  };
  M.quitar = function (cx, cz) { trozos.delete(cx + ',' + cz); };
  M.trozo = function (cx, cz) { return trozos.get(cx + ',' + cz); };
  M.cargado = function (x, z) { return trozos.has((Math.floor(x) >> 4) + ',' + (Math.floor(z) >> 4)); };

  // -1 si el trozo no llegó todavía (para la física cuenta como sólido: no caerse al vacío)
  M.bloque = function (x, y, z) {
    if (y < 0) return 7;
    if (y >= C.ALTO) return 0;
    var t = trozos.get((x >> 4) + ',' + (z >> 4));
    if (!t) return -1;
    return t.ids[(y << 8) | ((z & 15) << 4) | (x & 15)];
  };
  M.meta = function (x, y, z) {
    if (y < 0 || y >= C.ALTO) return 0;
    var t = trozos.get((x >> 4) + ',' + (z >> 4));
    return t ? t.meta[(y << 8) | ((z & 15) << 4) | (x & 15)] : 0;
  };
  M.bioma = function (x, z) {
    var t = trozos.get((x >> 4) + ',' + (z >> 4));
    return t ? t.biomas[((z & 15) << 4) | (x & 15)] : 1;
  };

  M.poner = function (x, y, z, id, m) {
    if (y < 0 || y >= C.ALTO) return false;
    var t = trozos.get((x >> 4) + ',' + (z >> 4));
    if (!t) return false;
    var i = (y << 8) | ((z & 15) << 4) | (x & 15);
    t.ids[i] = id; t.meta[i] = m | 0;
    var k = t.cx + ',' + t.cz;
    M.modificados.set(k, t); M.sucios.add(k);
    trab.postMessage({ t: 'poner', x: x, y: y, z: z, id: id, m: m | 0 });
    return true;
  };

  // lo que cambió el trabajador (el agua y la lava que corren): [x, y, z, id, meta, ...]
  M.aplicar = function (l) {
    for (var j = 0; j < l.length; j += 5) {
      var x = l[j], y = l[j + 1], z = l[j + 2], k = (x >> 4) + ',' + (z >> 4), t = trozos.get(k);
      if (!t) continue;
      var i = (y << 8) | ((z & 15) << 4) | (x & 15);
      t.ids[i] = l[j + 3]; t.meta[i] = l[j + 4];
      M.modificados.set(k, t); M.sucios.add(k);
    }
  };

  // el primer bloque que toca un rayo (recorrido de celdas de Amanatides y Woo). Devuelve el bloque
  // y la cara por la que entró (la normal), o null
  M.rayo = function (ox, oy, oz, dx, dy, dz, maximo, conLiquidos) {
    var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    var px = dx > 0 ? 1 : -1, py = dy > 0 ? 1 : -1, pz = dz > 0 ? 1 : -1;
    var tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    var tx = dx > 0 ? (x + 1 - ox) * tdx : (ox - x) * tdx;
    var ty = dy > 0 ? (y + 1 - oy) * tdy : (oy - y) * tdy;
    var tz = dz > 0 ? (z + 1 - oz) * tdz : (oz - z) * tdz;
    var nx = 0, ny = 0, nz = 0, t = 0;
    for (var i = 0; i < 64 && t <= maximo; i++) {
      var id = M.bloque(x, y, z);
      if (id > 0) {
        var f = C.FORMA[id];
        if (f !== C.F.nada && (f !== C.F.liquido || conLiquidos)) return { x: x, y: y, z: z, nx: nx, ny: ny, nz: nz, id: id, t: t };
      }
      if (tx < ty && tx < tz) { x += px; t = tx; tx += tdx; nx = -px; ny = 0; nz = 0; }
      else if (ty < tz) { y += py; t = ty; ty += tdy; nx = 0; ny = -py; nz = 0; }
      else { z += pz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -pz; }
    }
    return null;
  };

  M.cuantos = function () { return trozos.size; };
  M.todos = function () { return trozos; };
  return M;
})();
