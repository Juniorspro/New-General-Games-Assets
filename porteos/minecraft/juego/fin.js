// porteo: el End (en el trabajador, el generador; en la página, la tabla de los pilares). Es el
// generador del juego (ChunkGeneratorEnd): una densidad de ruido 3D en una grilla de 8x4x8 bloques
// más la "altura de isla" (la isla principal, de unos 100 bloques de radio alrededor del 0,0, y las
// de afuera, pasando los 1000 bloques, donde un ruido simplex lo dice); piedra del End donde es
// positiva. Lo que se agrega: los 10 pilares de obsidiana en un círculo de radio 42 (WorldGenSpikes:
// alto y radio según un orden al azar de la semilla, dos enjaulados con barrotes, roca madre arriba
// donde va el cristal), el portal de salida apagado en el medio (WorldGenEndPodium), las islitas
// sueltas y las plantas de coro de las islas de afuera. Como el Nether, puro de la semilla y la
// posición: lo que cruza el borde de un trozo sale igual de los dos lados.
var GenFin = (function () {
  'use strict';
  var R = C.Ruido, ALTO = C.ALTO;
  var B = { aire: 0, piedra: 121, obsidiana: 49, roca: 7, barrotes: 101, antorcha: 50, coro: 240, flor: 200, portal: 119 };
  var BIOMA = 19;   // "fin" (Gen.BIOMAS)
  function lim(v, a, b) { return v < a ? a : v > b ? b : v; }
  var K_RUIDO = 0.45;

  function GenFin(semilla) {
    this.semilla = semilla | 0;
    this.rA = new R(semilla + 201); this.rB = new R(semilla + 202); this.rS = new R(semilla + 203); this.rIsla = new R(semilla + 204);
    this.pilares = GenFin.pilares(semilla);
    this.base = new Map(); this.orden = [];
  }
  // los 10 pilares (BiomeEndDecorator.SpikeCacheLoader): [x, z, radio, alto, enjaulado]
  GenFin.pilares = function (semilla) {
    var az = new C.Azar(C.hash(semilla | 0, 0, 0, 80)), l = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], r = [];
    for (var i = l.length - 1; i > 0; i--) { var j = az.ent(i + 1), t = l[i]; l[i] = l[j]; l[j] = t; }
    for (i = 0; i < 10; i++) {
      var a = 2 * (-Math.PI + Math.PI / 10 * i), n = l[i];
      r.push([Math.trunc(42 * Math.cos(a)), Math.trunc(42 * Math.sin(a)), 2 + Math.floor(n / 3), 76 + n * 3, n === 1 || n === 2]);
    }
    return r;
  };

  // la altura de isla en un punto de la grilla (getIslandHeightValue: cx, cz del trozo; l, m de 0 a
  // 2, cada 8 bloques): la isla principal baja con la distancia; las de afuera, donde el ruido simplex
  // es muy negativo (y con un radio que sale de su posición)
  GenFin.prototype.isla = function (cx, cz, l, m) {
    var f = cx * 2 + l, f1 = cz * 2 + m, f2 = lim(100 - Math.sqrt(f * f + f1 * f1) * 8, -100, 80);
    var ax = Math.abs(cx), az = Math.abs(cz);
    if ((ax + 12) * (ax + 12) + (az + 12) * (az + 12) <= 4096) return f2;
    for (var i = -12; i <= 12; i++) for (var j = -12; j <= 12; j++) {
      var k = cx + i, q = cz + j;
      if (k * k + q * q <= 4096 || this.rIsla.n2(k, q) >= -0.9) continue;
      var f3 = (Math.abs(k) * 3439 + Math.abs(q) * 147) % 13 + 9, a = l - i * 2, b = m - j * 2;
      var f4 = lim(100 - Math.sqrt(a * a + b * b) * f3, -100, 80);
      if (f4 > f2) f2 = f4;
    }
    return f2;
  };
  // la densidad (getHeights): los dos ruidos grandes que elige el tercero, menos 8, más la isla;
  // arriba de 56 baja de a poco y abajo de 32 también (la isla queda colgando)
  GenFin.prototype.densidad = function (gx, gy, gz, isla) {
    var a = 0, b = 0, s = 0, o, f, amp;
    for (o = 10; o <= 15; o++) {
      f = 1 / (1 << o); amp = (1 << o) / 512;
      a += this.rA.n3(gx * 1368.824 * f + o * 17.3, gy * 684.412 * f, gz * 1368.824 * f) * amp;
      b += this.rB.n3(gx * 1368.824 * f + o * 17.3, gy * 684.412 * f, gz * 1368.824 * f) * amp;
    }
    for (o = 0; o < 8; o++) {
      f = 1 / (1 << o);
      s += this.rS.n3(gx * 17.1103 * f + o * 13.1, gy * 4.27757 * f, gz * 17.1103 * f) * (1 << o);
    }
    var sel = (s / 10 + 1) / 2, d = sel < 0 ? a : sel > 1 ? b : a + (b - a) * sel;
    // (el simplex varía más que el Perlin del juego: sin achicarlo, la isla salía de la mitad)
    d = d * K_RUIDO - 8 + isla;
    if (gy > 14) { var t = lim((gy - 14) / 64, 0, 1); d = d * (1 - t) - 3000 * t; }
    if (gy < 8) { var t2 = (8 - gy) / 7; d = d * (1 - t2) - 30 * t2; }
    return d;
  };
  GenFin.prototype.terreno = function (cx, cz) {
    var k = (cx + 32768) * 65536 + (cz + 32768), t = this.base.get(k);
    if (t) return t;
    var ids = new Uint8Array(16 * 16 * ALTO), g = new Float64Array(3 * 33 * 3), n = 0, a, b, c;
    for (a = 0; a < 3; a++) for (c = 0; c < 3; c++) {
      var isla = this.isla(cx, cz, a, c);
      for (b = 0; b < 33; b++) g[n++] = this.densidad(cx * 2 + a, b, cz * 2 + c, isla);
    }
    function G(a, b, c) { return g[(a * 3 + c) * 33 + b]; }
    for (a = 0; a < 2; a++) for (c = 0; c < 2; c++) for (b = 0; b < 32; b++) {
      var d000 = G(a, b, c), d100 = G(a + 1, b, c), d001 = G(a, b, c + 1), d101 = G(a + 1, b, c + 1);
      var e000 = (G(a, b + 1, c) - d000) / 4, e100 = (G(a + 1, b + 1, c) - d100) / 4;
      var e001 = (G(a, b + 1, c + 1) - d001) / 4, e101 = (G(a + 1, b + 1, c + 1) - d101) / 4;
      for (var yy = 0; yy < 4; yy++) {
        var y = b * 4 + yy, z0 = d000, z1 = d100, dz0 = (d001 - d000) / 8, dz1 = (d101 - d100) / 8;
        for (var zz = 0; zz < 8; zz++) {
          var v = z0, dv = (z1 - z0) / 8;
          for (var xx = 0; xx < 8; xx++) {
            if (v > 0) ids[(y << 8) | ((c * 8 + zz) << 4) | (a * 8 + xx)] = B.piedra;
            v += dv;
          }
          z0 += dz0; z1 += dz1;
        }
        d000 += e000; d100 += e100; d001 += e001; d101 += e101;
      }
    }
    this.base.set(k, ids);
    this.orden.push(k);
    if (this.orden.length > 48) this.base.delete(this.orden.shift());
    return ids;
  };
  // lo más alto con piedra en una columna (o -1)
  GenFin.prototype.tope = function (x, z) {
    var t = this.terreno(x >> 4, z >> 4), col = ((z & 15) << 4) | (x & 15);
    for (var y = ALTO - 1; y >= 0; y--) if (t[(y << 8) | col] !== 0) return y;
    return -1;
  };
  // dónde va el portal de salida (y del piso en el 0,0)
  GenFin.prototype.podio = function () {
    if (this.yPodio === undefined) this.yPodio = Math.max(40, this.tope(0, 0));
    return this.yPodio;
  };

  GenFin.prototype.trozo = function (cx, cz, ids, meta, biomas) {
    ids.set(this.terreno(cx, cz));
    meta.fill(0);
    biomas.fill(BIOMA);
    var yo = this, x0 = cx * 16, z0 = cz * 16;
    function poner(x, y, z, id, m) {
      if (y < 0 || y >= ALTO || x < x0 || x >= x0 + 16 || z < z0 || z >= z0 + 16) return;
      var i = (y << 8) | ((z - z0) << 4) | (x - x0);
      ids[i] = id; meta[i] = m || 0;
    }
    function base(x, y, z) {
      if (y < 0 || y >= ALTO) return 0;
      return yo.terreno(x >> 4, z >> 4)[(y << 8) | ((z & 15) << 4) | (x & 15)];
    }
    // los pilares que tocan el trozo
    this.pilares.forEach(function (p) {
      var px = p[0], pz = p[1], r = p[2], alto = p[3];
      if (px + r < x0 || px - r > x0 + 15 || pz + r < z0 || pz - r > z0 + 15) return;
      for (var x = px - r; x <= px + r; x++) for (var z = pz - r; z <= pz + r; z++) for (var y = 0; y <= alto + 10 && y < ALTO; y++) {
        var dx = x - px, dz = z - pz;
        if (dx * dx + dz * dz <= r * r + 1 && y < alto) poner(x, y, z, B.obsidiana);
        else if (y > 65) poner(x, y, z, B.aire);
      }
      if (p[4]) for (var j = -2; j <= 2; j++) for (var k = -2; k <= 2; k++) {
        if (Math.abs(j) === 2 || Math.abs(k) === 2) for (var h = 0; h < 3; h++) poner(px + j, alto + h, pz + k, B.barrotes);
        poner(px + j, alto + 3, pz + k, B.barrotes);
      }
      poner(px, alto, pz, B.roca);
    });
    // el portal de salida, apagado (el dragón lo prende al morir)
    if (x0 <= 4 && x0 + 15 >= -4 && z0 <= 4 && z0 + 15 >= -4) this.podioEn(poner, false);
    // las islas de afuera: islitas sueltas y plantas de coro (los trozos de -x, -z también llegan)
    for (var sz = cz - 1; sz <= cz; sz++) for (var sx = cx - 1; sx <= cx; sx++) {
      if (sx * sx + sz * sz <= 4096) continue;
      var az = new C.Azar(C.hash(this.semilla, sx, sz, 81)), bx = sx * 16, bz = sz * 16, alt = this.isla(sx, sz, 1, 1);
      if (alt < -20 && az.ent(14) === 0) {
        this.islita(az, bx + az.ent(16) + 8, 55 + az.ent(16), bz + az.ent(16) + 8, poner);
        if (az.ent(4) === 0) this.islita(az, bx + az.ent(16) + 8, 55 + az.ent(16), bz + az.ent(16) + 8, poner);
      }
      if (alt > 40) {
        var nc = az.ent(5);
        for (var q = 0; q < nc; q++) {
          var lx = bx + az.ent(16) + 8, lz = bz + az.ent(16) + 8, ty = this.tope(lx, lz);
          if (ty > 0 && base(lx, ty, lz) === B.piedra) this.coro(az, lx, ty + 1, lz, base, poner);
        }
      }
    }
    return { lavas: [], extra: [], cajas: [] };
  };
  // WorldGenEndPodium: el círculo de roca madre con el portal (prendido o no), la columna del medio
  // con sus cuatro antorchas
  GenFin.prototype.podioEn = function (poner, prendido) {
    var y0 = this.podio();
    for (var x = -4; x <= 4; x++) for (var z = -4; z <= 4; z++) for (var y = y0 - 1; y <= y0 + 32; y++) {
      var d = Math.sqrt(x * x + z * z);
      if (d > 3.5) continue;
      if (y < y0) poner(x, y, z, d <= 2.5 ? B.roca : B.piedra);
      else if (y > y0) poner(x, y, z, B.aire);
      else if (d > 2.5) poner(x, y, z, B.roca);
      else poner(x, y, z, prendido ? B.portal : B.aire);
    }
    for (var i = 0; i < 4; i++) poner(0, y0 + i, 0, B.roca);
    poner(1, y0 + 2, 0, B.antorcha, 1); poner(-1, y0 + 2, 0, B.antorcha, 2); poner(0, y0 + 2, 1, B.antorcha, 3); poner(0, y0 + 2, -1, B.antorcha, 4);
  };
  // WorldGenEndIsland: discos de piedra que se achican hacia abajo
  GenFin.prototype.islita = function (az, x, y, z, poner) {
    var f = az.ent(3) + 4;
    for (var i = 0; f > 0.5; i--) {
      for (var j = Math.floor(-f); j <= Math.ceil(f); j++) for (var k = Math.floor(-f); k <= Math.ceil(f); k++)
        if (j * j + k * k <= (f + 1) * (f + 1)) poner(x + j, y + i, z + k, B.piedra);
      f -= az.ent(2) + 0.5;
    }
  };
  // BlockChorusFlower.generatePlant: un tallo que sube y se ramifica hasta 4 veces, con flores
  // (secas) en las puntas
  GenFin.prototype.coro = function (az, x, y, z, base, poner) {
    var suyos = new Map(), k = function (a, b, c) { return a + ',' + b + ',' + c; };
    function aire(a, b, c) { return !suyos.has(k(a, b, c)) && base(a, b, c) === 0; }
    function set(a, b, c, id, m) { suyos.set(k(a, b, c), id); poner(a, b, c, id, m); }
    var H = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    function vecinosLibres(a, b, c, salvo) {
      for (var h = 0; h < 4; h++) if (h !== salvo && !aire(a + H[h][0], b, c + H[h][1])) return false;
      return true;
    }
    function crecer(px, py, pz, prof) {
      var i = az.ent(4) + 1, j;
      if (prof === 0) i++;
      for (j = 0; j < i; j++) {
        if (!vecinosLibres(px, py + j + 1, pz, -1)) return;
        set(px, py + j + 1, pz, B.coro);
      }
      var rama = false;
      if (prof < 4) {
        var l = az.ent(4);
        if (prof === 0) l++;
        for (var q = 0; q < l; q++) {
          var h = az.ent(4), nx = px + H[h][0], ny = py + i, nz = pz + H[h][1];
          if (Math.abs(nx - x) < 8 && Math.abs(nz - z) < 8 && aire(nx, ny, nz) && aire(nx, ny - 1, nz) && vecinosLibres(nx, ny, nz, h ^ 1)) {
            rama = true;
            set(nx, ny, nz, B.coro);
            crecer(nx, ny, nz, prof + 1);
          }
        }
      }
      if (!rama) set(px, py + i, pz, B.flor, 5);
    }
    set(x, y, z, B.coro);
    crecer(x, y, z, 0);
  };
  GenFin.prototype.columna = function (x, z, sal) {
    sal.alt = Math.max(0, this.tope(x, z)); sal.bioma = BIOMA; sal.frio = false;
    return sal;
  };
  GenFin.B = B;
  return GenFin;
})();
