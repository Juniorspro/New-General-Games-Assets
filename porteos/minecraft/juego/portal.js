// porteo: el portal del Nether como el juego (BlockPortal y Teleporter): el marco de obsidiana de 2 a
// 21 de ancho y de 3 a 21 de alto por dentro (las esquinas no hacen falta) se prende con fuego
// adentro; si se rompe una parte del marco, el portal se apaga entero; del otro lado se busca un
// portal cerca y si no hay se hace uno (con piso de obsidiana si queda en el aire).
// W: el mundo como lo ve el portal: bloque(x, y, z), meta(x, y, z), poner(x, y, z, id, m)
var Portal = (function () {
  'use strict';
  var P = {}, OBS = 49, POR = 90, FUEGO = 51;
  P.ID = POR;
  function vacio(id) { return id === 0 || id === FUEGO || id === POR; }
  // en cada eje, hacia dónde queda "la izquierda" y "la derecha" (EAST/WEST en x, NORTH/SOUTH en z) y
  // el valor del bloque de portal (1 a lo largo de x, 2 a lo largo de z)
  var EJES = { x: { iz: [1, 0], de: [-1, 0], m: 1 }, z: { iz: [0, -1], de: [0, 1], m: 2 } };

  // BlockPortal.Size: el marco alrededor de (x, y, z) en un eje: abajo a la izquierda, ancho, alto y
  // cuántos portales tiene adentro; null si no hay
  P.marco = function (W, x, y, z, eje) {
    var E = EJES[eje], y0 = y, i, k;
    while (y > y0 - 21 && y > 0 && vacio(W.bloque(x, y - 1, z))) y--;
    function hastaBorde(px, pz, d) {
      for (var n = 0; n < 22; n++) {
        var qx = px + d[0] * n, qz = pz + d[1] * n;
        if (!vacio(W.bloque(qx, y, qz)) || W.bloque(qx, y - 1, qz) !== OBS) break;
      }
      return W.bloque(px + d[0] * n, y, pz + d[1] * n) === OBS ? n : 0;
    }
    i = hastaBorde(x, z, E.iz) - 1;
    if (i < 0) return null;
    var bx = x + E.iz[0] * i, bz = z + E.iz[1] * i, ancho = hastaBorde(bx, bz, E.de);
    if (ancho < 2 || ancho > 21) return null;
    var alto, portales = 0;
    fuera:
    for (alto = 0; alto < 21; alto++) {
      for (k = 0; k < ancho; k++) {
        var cx = bx + E.de[0] * k, cz = bz + E.de[1] * k, b = W.bloque(cx, y + alto, cz);
        if (!vacio(b)) break fuera;
        if (b === POR) portales++;
        if (k === 0 && W.bloque(cx + E.iz[0], y + alto, cz + E.iz[1]) !== OBS) break fuera;
        if (k === ancho - 1 && W.bloque(cx + E.de[0], y + alto, cz + E.de[1]) !== OBS) break fuera;
      }
    }
    for (k = 0; k < ancho; k++) if (W.bloque(bx + E.de[0] * k, y + alto, bz + E.de[1] * k) !== OBS) return null;
    if (alto < 3 || alto > 21) return null;
    return { x: bx, y: y, z: bz, ancho: ancho, alto: alto, eje: eje, de: E.de, m: E.m, portales: portales };
  };

  // el fuego adentro de un marco lo prende (BlockPortal.trySpawnPortal: primero a lo largo de x)
  P.prender = function (W, x, y, z) {
    var s = P.marco(W, x, y, z, 'x');
    if (!s || s.portales) s = P.marco(W, x, y, z, 'z');
    if (!s || s.portales) return null;
    for (var k = 0; k < s.ancho; k++) for (var j = 0; j < s.alto; j++) W.poner(s.x + s.de[0] * k, s.y + j, s.z + s.de[1] * k, POR, s.m);
    return s;
  };
  // el marco del portal que tiene a este bloque de portal
  P.deBloque = function (W, x, y, z) {
    var eje = (W.meta(x, y, z) & 3) === 2 ? 'z' : 'x', s = P.marco(W, x, y, z, eje);
    return s && s.portales >= s.ancho * s.alto ? s : null;
  };

  // cambió (x, y, z): los portales de al lado siguen sólo si su marco está entero y lleno
  // (neighborChanged); si no, se apagan todos los que están juntos
  var V6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  P.revisar = function (W, x, y, z) {
    for (var v = 0; v < 6; v++) {
      var px = x + V6[v][0], py = y + V6[v][1], pz = z + V6[v][2];
      if (W.bloque(px, py, pz) !== POR) continue;
      if (!P.deBloque(W, px, py, pz)) P.apagar(W, px, py, pz);
    }
  };
  P.apagar = function (W, x, y, z) {
    var pila = [[x, y, z]], vistos = new Set();
    while (pila.length && vistos.size < 2000) {
      var p = pila.pop(), k = p[0] + ',' + p[1] + ',' + p[2];
      if (vistos.has(k) || W.bloque(p[0], p[1], p[2]) !== POR) continue;
      vistos.add(k);
      W.poner(p[0], p[1], p[2], 0, 0);
      for (var v = 0; v < 6; v++) pila.push([p[0] + V6[v][0], p[1] + V6[v][1], p[2] + V6[v][2]]);
    }
  };

  // dónde se para el que llega a un portal: en el medio de la fila de abajo
  P.lugar = function (s) {
    var c = (s.ancho - 1) / 2;
    return [s.x + s.de[0] * c + 0.5, s.y, s.z + s.de[1] * c + 0.5];
  };

  // Teleporter.makePortal: el mejor lugar a menos de 16 (piso firme y aire para un portal de 4x5 con
  // espacio a los costados; si no, uno más angosto) y si no hay, uno en el aire con piso de obsidiana.
  // alto: el alto del mundo; minimo: hasta dónde baja el que se hace en el aire
  P.crear = function (W, solido, x, y, z, alto, azar) {
    var bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    var mejor = -1, mx = bx, my = by, mz = bz, mo = 0, i2 = Math.floor(azar() * 4), j2, l2, j3, k3, j4, k4, l4;
    for (var pasada = 0; pasada < 2 && mejor < 0; pasada++) {
      for (j2 = bx - 16; j2 <= bx + 16; j2++) {
        var d1 = j2 + 0.5 - x;
        for (l2 = bz - 16; l2 <= bz + 16; l2++) {
          var d2 = l2 + 0.5 - z;
          sigue:
          for (j3 = alto - 1; j3 >= 0; j3--) {
            if (W.bloque(j2, j3, l2) !== 0) continue;
            while (j3 > 0 && W.bloque(j2, j3 - 1, l2) === 0) j3--;
            for (k3 = i2; k3 < i2 + (pasada ? 2 : 4); k3++) {
              var l3 = k3 % 2, i4 = 1 - l3;
              if (!pasada && k3 % 4 >= 2) { l3 = -l3; i4 = -i4; }
              for (j4 = 0; j4 < (pasada ? 1 : 3); j4++) for (k4 = 0; k4 < 4; k4++) for (l4 = -1; l4 < 4; l4++) {
                var i5 = j2 + (k4 - 1) * l3 + j4 * i4, j5 = j3 + l4, k5 = l2 + (k4 - 1) * i4 - j4 * l3, b = W.bloque(i5, j5, k5);
                if (b < 0 || (l4 < 0 && !solido(b)) || (l4 >= 0 && b !== 0)) continue sigue;
              }
              var d5 = j3 + 0.5 - y, d7 = d1 * d1 + d5 * d5 + d2 * d2;
              if (mejor < 0 || d7 < mejor) { mejor = d7; mx = j2; my = j3; mz = l2; mo = k3 % (pasada ? 2 : 4); }
            }
          }
        }
      }
    }
    var l6 = mo % 2, i3 = 1 - l6;
    if (mo % 4 >= 2) { l6 = -l6; i3 = -i3; }
    if (mejor < 0) {
      // en el aire: un piso de 3x2 de obsidiana y lugar libre arriba
      my = Math.max(70, Math.min(alto - 10, my));
      for (var j7 = -1; j7 <= 1; j7++) for (var l7 = 1; l7 < 3; l7++) for (var k8 = -1; k8 < 3; k8++)
        W.poner(mx + (l7 - 1) * l6 + j7 * i3, my + k8, mz + (l7 - 1) * i3 - j7 * l6, k8 < 0 ? OBS : 0, 0);
    }
    // el marco de 4x5 con los portales adentro (a lo largo de x si l6 no es 0)
    var mPor = l6 === 0 ? 2 : 1;
    for (var l8 = 0; l8 < 4; l8++) for (var l9 = -1; l9 < 4; l9++) {
      var borde = l8 === 0 || l8 === 3 || l9 === -1 || l9 === 3;
      W.poner(mx + (l8 - 1) * l6, my + l9, mz + (l8 - 1) * i3, borde ? OBS : POR, borde ? 0 : mPor);
    }
    return P.marco(W, mx, my, mz, mPor === 1 ? 'x' : 'z');
  };
  return P;
})();
