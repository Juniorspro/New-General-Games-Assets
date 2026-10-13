// porteo: el generador del Nether (corre en el trabajador). Es el algoritmo del juego
// (NetherGenerator de la 1.2, el mismo que ChunkGeneratorHell de Java): una densidad de ruido 3D en
// una grilla de 4x8x4 bloques (dos ruidos grandes que se eligen con un tercero, menos un perfil por
// altura que cierra el piso y el techo y hace las "repisas"), infiedra donde es positiva y lava
// donde no, debajo de 32; arriba y abajo roca madre despareja; la arena de almas y la grava en la
// franja de 60 a 65. Después, lo que se agrega (populate): cascadas de lava, fuego, racimos de piedra
// luminosa colgando del techo, hongos, cuarzo, magma y lava escondida.
// Como el resto del generador, todo es una función pura de la semilla y la posición: un trozo se
// arma sin depender de sus vecinos. Lo que se agrega desde un trozo (empieza en +8, como el juego)
// puede caer en el de al lado; cada agregado mira sólo el terreno de base (y lo suyo), así que sale
// igual desde los dos lados.
var GenNether = (function () {
  'use strict';
  var R = C.Ruido;
  var B = {
    aire: 0, roca: 7, lavaCorre: 10, lava: 11, grava: 13, hongoM: 39, hongoR: 40, fuego: 51,
    infiedra: 87, almas: 88, luminosa: 89, cuarzo: 153, magma: 213
  };
  var ALTO = C.ALTO, MAR = 32, ARENA = 64;
  var BIOMA = 18;   // "infierno" (Gen.BIOMAS)

  // el perfil por altura de la grilla (17 puntos, cada 8 bloques): ondas que hacen repisas y el piso y
  // el techo cerrados (getHeights: cos(j·6π/17)·2 y lo que se resta cerca de las puntas)
  var PERFIL = [];
  for (var j = 0; j < 17; j++) {
    var v = Math.cos(j * Math.PI * 6 / 17) * 2, d = j > 8 ? 16 - j : j;
    if (d < 4) { d = 4 - d; v -= d * d * d * 10; }
    PERFIL[j] = v;
  }

  function GenNether(semilla) {
    this.semilla = semilla | 0;
    this.rA = new R(semilla + 101); this.rB = new R(semilla + 102); this.rS = new R(semilla + 103);
    this.rAlmas = new R(semilla + 104); this.rGrava = new R(semilla + 105); this.rHondo = new R(semilla + 106);
    this.base = new Map();        // terreno de base de los trozos recientes (para lo que cruza el borde)
    this.orden = [];
  }

  // la densidad en un punto de la grilla (gx, gz cada 4 bloques; gy cada 8): las octavas grandes de
  // los dos ruidos (las chicas cambian ±1, nada) y el que elige entre ellos (casi siempre 0 o 1)
  GenNether.prototype.densidad = function (gx, gy, gz) {
    var a = 0, b = 0, s = 0, o, f, amp;
    for (o = 10; o <= 15; o++) {
      f = 1 / (1 << o); amp = (1 << o) / 512;
      a += this.rA.n3(gx * 684.412 * f + o * 17.3, gy * 2053.236 * f, gz * 684.412 * f) * amp;
      b += this.rB.n3(gx * 684.412 * f + o * 17.3, gy * 2053.236 * f, gz * 684.412 * f) * amp;
    }
    for (o = 0; o < 8; o++) {
      f = 1 / (1 << o);
      s += this.rS.n3(gx * 8.55515 * f + o * 13.1, gy * 34.2206 * f, gz * 8.55515 * f) * (1 << o);
    }
    var sel = (s / 10 + 1) / 2;
    var dd = sel < 0 ? a : sel > 1 ? b : a + (b - a) * sel;
    dd -= PERFIL[gy];
    if (gy > 13) { var t = (gy - 13) / 3; dd = dd * (1 - t) - 10 * t; }
    return dd;
  };

  // el terreno de base de un trozo: infiedra, lava, la roca madre y la superficie (buildSurfaces)
  GenNether.prototype.terreno = function (cx, cz) {
    var k = (cx + 32768) * 65536 + (cz + 32768), t = this.base.get(k);
    if (t) return t;
    var ids = new Uint8Array(16 * 16 * ALTO), g = new Float64Array(5 * 17 * 5), n = 0, a, b, c;
    for (a = 0; a < 5; a++) for (c = 0; c < 5; c++) for (b = 0; b < 17; b++) g[n++] = this.densidad(cx * 4 + a, b, cz * 4 + c);
    function G(a, b, c) { return g[(a * 5 + c) * 17 + b]; }
    for (a = 0; a < 4; a++) for (c = 0; c < 4; c++) for (b = 0; b < 16; b++) {
      var d000 = G(a, b, c), d100 = G(a + 1, b, c), d001 = G(a, b, c + 1), d101 = G(a + 1, b, c + 1);
      var e000 = (G(a, b + 1, c) - d000) / 8, e100 = (G(a + 1, b + 1, c) - d100) / 8;
      var e001 = (G(a, b + 1, c + 1) - d001) / 8, e101 = (G(a + 1, b + 1, c + 1) - d101) / 8;
      for (var yy = 0; yy < 8; yy++) {
        var y = b * 8 + yy;
        var z0 = d000, z1 = d100, dz0 = (d001 - d000) / 4, dz1 = (d101 - d100) / 4;
        for (var zz = 0; zz < 4; zz++) {
          var v = z0, dv = (z1 - z0) / 4;
          for (var xx = 0; xx < 4; xx++) {
            var i = (y << 8) | ((c * 4 + zz) << 4) | (a * 4 + xx);
            ids[i] = v > 0 ? B.infiedra : y < MAR ? B.lava : B.aire;
            v += dv;
          }
          z0 += dz0; z1 += dz1;
        }
        d000 += e000; d100 += e100; d001 += e001; d101 += e101;
      }
    }
    this.superficie(cx, cz, ids);
    this.base.set(k, ids);
    this.orden.push(k);
    if (this.orden.length > 48) this.base.delete(this.orden.shift());
    return ids;
  };

  // la arena de almas y la grava cerca de 64, la roca madre despareja arriba y abajo
  GenNether.prototype.superficie = function (cx, cz, ids) {
    var az = new C.Azar(C.hash(this.semilla, cx, cz, 61));
    for (var z = 0; z < 16; z++) for (var x = 0; x < 16; x++) {
      var wx = cx * 16 + x, wz = cz * 16 + z;
      // (los ruidos del juego: 4 octavas donde pesa más la más lenta, de ±2 más o menos)
      var almas = this.rAlmas.oct2(wx / 256, wz / 256, 4, 0.5) * 9 + az.sig() * 0.2 > 0;
      var grava = this.rGrava.oct2(wx / 256, wz / 256, 4, 0.5) * 9 + az.sig() * 0.2 > 0;
      var hondo = Math.floor(this.rHondo.oct2(wx / 128, wz / 128, 4, 0.5) * 3 + 3 + az.sig() * 0.25);
      var resto = -1, arriba = B.infiedra, abajo = B.infiedra, col = (z << 4) | x;
      for (var y = ALTO - 1; y >= 0; y--) {
        var i = (y << 8) | col;
        if (!(y < ALTO - 1 - az.ent(5) && y > az.ent(5))) { ids[i] = B.roca; continue; }
        var id = ids[i];
        if (id === B.aire) { resto = -1; continue; }
        if (id !== B.infiedra) continue;
        if (resto === -1) {
          if (hondo <= 0) { arriba = B.aire; abajo = B.infiedra; }
          else if (y >= ARENA - 4 && y <= ARENA + 1) {
            arriba = B.infiedra; abajo = B.infiedra;
            if (grava) { arriba = B.grava; abajo = B.infiedra; }
            if (almas) { arriba = B.almas; abajo = B.almas; }
          }
          if (y < ARENA && arriba === B.aire) arriba = B.lava;
          resto = hondo;
          ids[i] = y >= ARENA - 1 ? arriba : abajo;
        } else if (resto > 0) { resto--; ids[i] = abajo; }
      }
    }
  };

  // ------------------------------------------------------------------------------------------
  // Un trozo: el terreno y lo que agregan los 4 trozos que pueden llegar hasta acá (el mismo y los de
  // -x, -z: cada uno agrega desde su +8 y no se va más de 8 bloques)
  // ------------------------------------------------------------------------------------------
  GenNether.prototype.trozo = function (cx, cz, ids, meta, biomas) {
    ids.set(this.terreno(cx, cz));
    meta.fill(0);
    biomas.fill(BIOMA);
    var yo = this, x0 = cx * 16, z0 = cz * 16, lavas = [];
    // el terreno de base en cualquier lado (de los trozos que hagan falta)
    function base(x, y, z) {
      if (y < 0 || y >= ALTO) return B.aire;
      var tx = x >> 4, tz = z >> 4;
      return yo.terreno(tx, tz)[(y << 8) | ((z & 15) << 4) | (x & 15)];
    }
    // lo que cae en este trozo se escribe; lo de afuera se descarta (lo pone el trozo vecino)
    function poner(x, y, z, id) {
      if (y < 0 || y >= ALTO || x < x0 || x >= x0 + 16 || z < z0 || z >= z0 + 16) return;
      ids[(y << 8) | ((z - z0) << 4) | (x - x0)] = id;
    }
    for (var sz = cz - 1; sz <= cz; sz++) for (var sx = cx - 1; sx <= cx; sx++) {
      var az = new C.Azar(C.hash(this.semilla, sx, sz, 62)), bx = sx * 16 + 8, bz = sz * 16 + 8;
      this.agregados(az, bx, bz, base, poner, lavas, x0, z0);
    }
    // vetas de cuarzo y de magma (adentro del trozo, como los minerales del mundo de arriba)
    this.vetas(cx, cz, ids);
    // las fortalezas: sus piezas, los cofres con botín y los generadores
    var extra = [], piezas = this.fortalezasEn(cx, cz, ids, meta, extra);
    return { lavas: lavas, extra: extra, cajas: piezas.map(function (p) { return p.b; }) };
  };

  GenNether.prototype.agregados = function (az, bx, bz, base, poner, lavas, x0, z0) {
    var k, x, y, z;
    // las cascadas: lava en una pared (infiedra arriba y alrededor menos un lado)
    for (k = 0; k < 8; k++) {
      x = bx + az.ent(16); y = 4 + az.ent(120); z = bz + az.ent(16);
      if (base(x, y + 1, z) !== B.infiedra) continue;
      var aca = base(x, y, z);
      if (aca !== B.aire && aca !== B.infiedra) continue;
      var nr = 0, na = 0, vec = [[-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, -1, 0]];
      for (var v = 0; v < 5; v++) { var b = base(x + vec[v][0], y + vec[v][1], z + vec[v][2]); if (b === B.infiedra) nr++; else if (b === B.aire) na++; }
      if ((nr === 4 && na === 1) || nr === 5) {
        poner(x, y, z, B.lavaCorre);
        if (x >= x0 && x < x0 + 16 && z >= z0 && z < z0 + 16) lavas.push(x, y, z);
      }
    }
    // fuego sobre la infiedra
    var nf = az.ent(az.ent(10) + 1) + 1;
    for (k = 0; k < nf; k++) {
      var fx = bx + az.ent(16), fy = 4 + az.ent(120), fz = bz + az.ent(16);
      for (var q = 0; q < 64; q++) {
        x = fx + az.ent(8) - az.ent(8); y = fy + az.ent(4) - az.ent(4); z = fz + az.ent(8) - az.ent(8);
        if (base(x, y, z) === B.aire && base(x, y - 1, z) === B.infiedra) poner(x, y, z, B.fuego);
      }
    }
    // la piedra luminosa: racimos que cuelgan del techo (los dos tipos del juego: unos pocos y diez
    // más, que empiezan en cualquier altura)
    var nl = az.ent(az.ent(10) + 1);
    for (k = 0; k < nl + 10; k++) {
      var gx = bx + az.ent(16), gy = k < nl ? 4 + az.ent(120) : az.ent(128), gz = bz + az.ent(16);
      this.racimo(az, gx, gy, gz, base, poner);
    }
    // hongos (cada uno la mitad de las veces)
    for (var h = 0; h < 2; h++) {
      if (az.sig() >= 0.5) continue;
      var hx = bx + az.ent(16), hy = az.ent(128), hz = bz + az.ent(16), id = h === 0 ? B.hongoM : B.hongoR;
      for (q = 0; q < 64; q++) {
        x = hx + az.ent(8) - az.ent(8); y = hy + az.ent(4) - az.ent(4); z = hz + az.ent(8) - az.ent(8);
        var deb = base(x, y - 1, z);
        if (base(x, y, z) === B.aire && (deb === B.infiedra || deb === B.almas || deb === B.grava)) poner(x, y, z, id);
      }
    }
    // lava escondida adentro de la infiedra (rodeada de todos lados)
    for (k = 0; k < 16; k++) {
      x = bx - 8 + az.ent(16); y = 10 + az.ent(108); z = bz - 8 + az.ent(16);
      if (base(x, y + 1, z) !== B.infiedra || base(x, y, z) !== B.infiedra) continue;
      if (base(x - 1, y, z) === B.infiedra && base(x + 1, y, z) === B.infiedra && base(x, y, z - 1) === B.infiedra &&
        base(x, y, z + 1) === B.infiedra && base(x, y - 1, z) === B.infiedra) poner(x, y, z, B.lavaCorre);
    }
  };

  // un racimo de piedra luminosa (WorldGenGlowStone1): empieza en un hueco con infiedra arriba y
  // crece hacia abajo a los huecos que tocan exactamente uno de los suyos
  GenNether.prototype.racimo = function (az, x, y, z, base, poner) {
    if (base(x, y, z) !== B.aire || base(x, y + 1, z) !== B.infiedra) return;
    var suyos = new Set(), cl = function (a, b, c) { return ((a - x + 64) * 256 + (b + 64)) * 256 + (c - z + 64); };
    suyos.add(cl(x, y, z)); poner(x, y, z, B.luminosa);
    var V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (var n = 0; n < 1500; n++) {
      var px = x + az.ent(8) - az.ent(8), py = y - az.ent(12), pz = z + az.ent(8) - az.ent(8);
      if (base(px, py, pz) !== B.aire || suyos.has(cl(px, py, pz))) continue;
      var t = 0;
      for (var v = 0; v < 6 && t < 2; v++) if (suyos.has(cl(px + V[v][0], py + V[v][1], pz + V[v][2]))) t++;
      if (t === 1) { suyos.add(cl(px, py, pz)); poner(px, py, pz, B.luminosa); }
    }
  };

  // el cuarzo (16 vetas de 14 entre 10 y 117) y el magma (4 de 33 alrededor del mar de lava), en la
  // infiedra
  GenNether.prototype.vetas = function (cx, cz, ids) {
    var az = new C.Azar(C.hash(this.semilla, cx, cz, 63));
    var tipos = [[B.cuarzo, 16, 14, 10, 117], [B.magma, 4, 33, MAR - 5, MAR + 4]];
    for (var t = 0; t < tipos.length; t++) {
      var T = tipos[t];
      for (var v = 0; v < T[1]; v++) {
        var x = az.sig() * 16, z = az.sig() * 16, y = T[3] + az.sig() * (T[4] - T[3]);
        var tam = T[2], ang = az.sig() * Math.PI;
        var dx = Math.sin(ang) * tam / 8, dz = Math.cos(ang) * tam / 8, dy = (az.sig() - 0.5) * 2;
        for (var s = 0; s < tam; s++) {
          var f = s / tam, px = x + dx * (f - 0.5) * 2, py = y + dy * (f - 0.5) * 2, pz = z + dz * (f - 0.5) * 2;
          var r = (Math.sin(f * Math.PI) + 1) * (tam / 16) * 0.6 + 0.25, r2 = r * r;
          for (var ix = Math.floor(px - r); ix <= Math.floor(px + r); ix++) {
            if (ix < 0 || ix > 15) continue;
            for (var iz = Math.floor(pz - r); iz <= Math.floor(pz + r); iz++) {
              if (iz < 0 || iz > 15) continue;
              for (var iy = Math.floor(py - r); iy <= Math.floor(py + r); iy++) {
                if (iy < 1 || iy > 126) continue;
                var ddx = ix + 0.5 - px, ddy = iy + 0.5 - py, ddz = iz + 0.5 - pz;
                if (ddx * ddx + ddy * ddy + ddz * ddz > r2) continue;
                var i = (iy << 8) | (iz << 4) | ix;
                if (ids[i] === B.infiedra) ids[i] = T[0];
              }
            }
          }
        }
      }
    }
  };

  // la "altura" de una columna (el piso más alto con aire arriba, debajo del techo): para ubicar
  GenNether.prototype.columna = function (x, z, sal) {
    var t = this.terreno(x >> 4, z >> 4), col = ((z & 15) << 4) | (x & 15);
    sal.alt = 70; sal.bioma = BIOMA; sal.frio = false;
    for (var y = 100; y > MAR; y--) {
      if (t[(y << 8) | col] === B.infiedra && t[((y + 1) << 8) | col] === B.aire && t[((y + 2) << 8) | col] === B.aire) { sal.alt = y; break; }
    }
    return sal;
  };
  // ------------------------------------------------------------------------------------------
  // Las fortalezas (MapGenNetherBridge y StructureNetherBridgePieces): una cada tanto en regiones de
  // 16x16 trozos (una de cada tres regiones, en un trozo al azar del medio); empieza con un cruce de
  // puentes y se arma pieza por pieza desde las salidas de las que ya están (los puentes y salas, y
  // adentro del castillo los pasillos, escaleras, la sala de verrugas...), sin pisarse y hasta 112
  // bloques del comienzo; después se sube o se baja entera a una altura entre 48 y 70. Cada pieza se
  // dibuja en los trozos que toca, con sus pilares que bajan hasta el piso.
  // ------------------------------------------------------------------------------------------
  // la caja de cada pieza (corrimiento y tamaño, como getComponentToAddBoundingBox) y sus salidas:
  // [tipo de salida ('n' derecho, 'x' a la izquierda, 'z' a la derecha), corrimientos, secundaria]
  var PIEZA = {
    puente: { o: [-1, -3, 0], t: [5, 10, 19], s: [['n', 1, 3, 0]] },
    cruce: { o: [-8, -3, 0], t: [19, 10, 19], s: [['n', 8, 3, 0], ['x', 3, 8, 0], ['z', 3, 8, 0]] },
    fin: { o: [-1, -3, 0], t: [5, 10, 8], s: [] },
    sala: { o: [-2, 0, 0], t: [7, 9, 7], s: [['n', 2, 0, 0], ['x', 0, 2, 0], ['z', 0, 2, 0]] },
    escalera: { o: [-2, 0, 0], t: [7, 11, 7], s: [['z', 6, 2, 0]] },
    trono: { o: [-2, 0, 0], t: [7, 8, 9], s: [] },
    entrada: { o: [-5, -3, 0], t: [13, 14, 13], s: [['n', 5, 3, 1]] },
    pasillo: { o: [-1, 0, 0], t: [5, 7, 5], s: [['n', 1, 0, 1]] },
    cruceP: { o: [-1, 0, 0], t: [5, 7, 5], s: [['n', 1, 0, 1], ['x', 0, 1, 1], ['z', 0, 1, 1]] },
    derecha: { o: [-1, 0, 0], t: [5, 7, 5], s: [['z', 0, 1, 1]] },
    izquierda: { o: [-1, 0, 0], t: [5, 7, 5], s: [['x', 0, 1, 1]] },
    bajada: { o: [-1, -7, 0], t: [5, 14, 10], s: [['n', 1, 0, 1]] },
    balcon: { o: [-3, 0, 0], t: [9, 7, 9], s: [] },
    verrugas: { o: [-5, -3, 0], t: [13, 14, 13], s: [['n', 5, 3, 1], ['n', 5, 11, 1]] }
  };
  // [pieza, peso, cuántas como mucho (0: sin límite), puede repetirse seguida]
  var PRIMARIAS = [['puente', 30, 0, 1], ['cruce', 10, 4], ['sala', 10, 4], ['escalera', 10, 3], ['trono', 5, 2], ['entrada', 5, 1]];
  var SECUNDARIAS = [['pasillo', 25, 0, 1], ['cruceP', 15, 5], ['derecha', 5, 10], ['izquierda', 5, 10], ['bajada', 10, 3, 1], ['balcon', 7, 2], ['verrugas', 5, 2]];
  var N = 0, S = 1, O = 2, E = 3;   // hacia dónde mira la pieza (norte, sur, oeste, este)

  function cajaDe(x, y, z, o, t, f) {
    var a = o[0], b = o[1], c = o[2], w = t[0], h = t[1], d = t[2];
    if (f === N) return [x + a, y + b, z - d + 1 + c, x + w - 1 + a, y + h - 1 + b, z + c];
    if (f === S) return [x + a, y + b, z + c, x + w - 1 + a, y + h - 1 + b, z + d - 1 + c];
    if (f === O) return [x - d + 1 + c, y + b, z + a, x + c, y + h - 1 + b, z + w - 1 + a];
    return [x + c, y + b, z + a, x + d - 1 + c, y + h - 1 + b, z + w - 1 + a];
  }
  function cruzan(a, b) { return a[3] >= b[0] && a[0] <= b[3] && a[5] >= b[2] && a[2] <= b[5] && a[4] >= b[1] && a[1] <= b[4]; }

  GenNether.prototype.fortaleza = function (rx, rz) {
    var k = (rx + 32768) * 65536 + (rz + 32768);
    if (!this.fortalezas) this.fortalezas = new Map();
    if (this.fortalezas.has(k)) return this.fortalezas.get(k);
    var az = new C.Azar(C.hash(this.semilla, rx, rz, 70)), f = null;
    if (az.ent(3) === 0) {
      var tx = (rx << 4) + 4 + az.ent(8), tz = (rz << 4) + 4 + az.ent(8);
      f = armarFortaleza(az, tx * 16 + 2, tz * 16 + 2);
    }
    this.fortalezas.set(k, f);
    return f;
  };
  function armarFortaleza(az, x0, z0) {
    var piezas = [], pend = [], pesos = [PRIMARIAS.map(copia), SECUNDARIAS.map(copia)], ultimo = null;
    function copia(p) { return { n: p[0], w: p[1], max: p[2], fila: !!p[3], usadas: 0 }; }
    var dir = az.ent(4), inicio = { t: 'cruce', f: dir, b: [x0, 64, z0, x0 + 18, 73, z0 + 18], s: az.ent(1 << 30), prof: 0 };
    piezas.push(inicio);
    function nueva(tipo, x, y, z, f, prof) {
      var P = PIEZA[tipo], b = cajaDe(x, y, z, P.o, P.t, f);
      if (b[1] <= 10) return null;
      for (var i = 0; i < piezas.length; i++) if (cruzan(piezas[i].b, b)) return null;
      return { t: tipo, f: f, b: b, s: az.ent(1 << 30), prof: prof, cofre: (tipo === 'derecha' || tipo === 'izquierda') && az.ent(3) === 0 };
    }
    function agregar(x, y, z, f, prof, sec) {
      if (Math.abs(x - x0) > 112 || Math.abs(z - z0) > 112) { var e = nueva('fin', x, y, z, f, prof); if (e) piezas.push(e); return; }
      var l = pesos[sec ? 1 : 0], total = 0, hay = false, i;
      // (como getTotalWeight: sólo cuentan las que tienen límite y les queda; si no, se termina)
      for (i = 0; i < l.length; i++) { if (l[i].max > 0 && l[i].usadas < l[i].max) hay = true; total += l[i].w; }
      if (hay && prof + 1 <= 30) {
        for (var intento = 0; intento < 5; intento++) {
          var r = az.ent(total);
          for (i = 0; i < l.length; i++) {
            r -= l[i].w;
            if (r >= 0) continue;
            var pw = l[i];
            if ((pw.max && pw.usadas >= pw.max) || (pw === ultimo && !pw.fila)) break;
            var p = nueva(pw.n, x, y, z, f, prof + 1);
            if (p) {
              pw.usadas++; ultimo = pw;
              if (pw.max && pw.usadas >= pw.max) { l.splice(i, 1); }
              piezas.push(p); pend.push(p);
              return;
            }
          }
          total = 0; for (i = 0; i < l.length; i++) total += l[i].w;
          if (!total) break;
        }
      }
      var fin = nueva('fin', x, y, z, f, prof);
      if (fin) piezas.push(fin);
    }
    function salidas(p) {
      var b = p.b, f = p.f;
      var sal = PIEZA[p.t].s;
      if (p.t === 'balcon') {
        var i5 = f === O || f === N ? 5 : 1;
        sal = [['x', 0, i5, az.ent(8) > 0], ['z', 0, i5, az.ent(8) > 0]];
      }
      sal.forEach(function (q) {
        var t = q[0], a = q[1], c = q[2], sec = !!q[3];
        if (t === 'n') {
          if (f === N) agregar(b[0] + a, b[1] + c, b[2] - 1, f, p.prof, sec);
          else if (f === S) agregar(b[0] + a, b[1] + c, b[5] + 1, f, p.prof, sec);
          else if (f === O) agregar(b[0] - 1, b[1] + c, b[2] + a, f, p.prof, sec);
          else agregar(b[3] + 1, b[1] + c, b[2] + a, f, p.prof, sec);
        } else if (t === 'x') {
          // getNextComponentX: (alto a, lado c)
          if (f === N || f === S) agregar(b[0] - 1, b[1] + a, b[2] + c, O, p.prof, sec);
          else agregar(b[0] + c, b[1] + a, b[2] - 1, N, p.prof, sec);
        } else {
          if (f === N || f === S) agregar(b[3] + 1, b[1] + a, b[2] + c, E, p.prof, sec);
          else agregar(b[0] + c, b[1] + a, b[5] + 1, S, p.prof, sec);
        }
      });
    }
    salidas(inicio);
    while (pend.length && piezas.length < 400) salidas(pend.splice(az.ent(pend.length), 1)[0]);
    // la caja de todo y la altura: entre 48 y 70
    var caja = piezas[0].b.slice();
    piezas.forEach(function (p) { for (var i = 0; i < 3; i++) { caja[i] = Math.min(caja[i], p.b[i]); caja[i + 3] = Math.max(caja[i + 3], p.b[i + 3]); } });
    var libre = 70 - 48 + 1 - (caja[4] - caja[1] + 1), y = libre > 1 ? 48 + az.ent(libre) : 48, dy = y - caja[1];
    piezas.forEach(function (p) { p.b[1] += dy; p.b[4] += dy; });
    caja[1] += dy; caja[4] += dy;
    return { piezas: piezas, caja: caja };
  }

  // las fortalezas que tocan un trozo: sus piezas que caen en él
  GenNether.prototype.piezasEn = function (cx, cz) {
    var x0 = cx * 16, z0 = cz * 16, rx = cx >> 4, rz = cz >> 4, r = [];
    for (var a = rx - 1; a <= rx + 1; a++) for (var b = rz - 1; b <= rz + 1; b++) {
      var f = this.fortaleza(a, b);
      if (!f || f.caja[3] < x0 || f.caja[0] > x0 + 15 || f.caja[5] < z0 || f.caja[2] > z0 + 15) continue;
      f.piezas.forEach(function (p) { if (p.b[3] >= x0 && p.b[0] <= x0 + 15 && p.b[5] >= z0 && p.b[2] <= z0 + 15) r.push(p); });
    }
    return r;
  };

  // ------------------------------------------------------------------------------------------
  // Dibujar una pieza en un trozo (addComponentParts). Las coordenadas son las de la pieza: x a lo
  // ancho, y arriba, z hacia adelante (getXWithOffset/getZWithOffset); lo que cae fuera del trozo no
  // se pone
  // ------------------------------------------------------------------------------------------
  var LADRILLO = 112, CERCA = 113, ESCALON = 114, VERRUGA = 115, ALMAS = 88, GENERADOR = 52, COFRE = 54;
  GenNether.GENERADOR_BLAZE = 1;   // el bicho del generador va en su valor: 1 blaze
  function Dibujo(p, ids, meta, cx, cz, extra) {
    this.p = p; this.ids = ids; this.meta = meta; this.x0 = cx * 16; this.z0 = cz * 16; this.extra = extra;
  }
  Dibujo.prototype.X = function (x, z) { var b = this.p.b, f = this.p.f; return f === N || f === S ? b[0] + x : f === O ? b[3] - z : b[0] + z; };
  Dibujo.prototype.Z = function (x, z) { var b = this.p.b, f = this.p.f; return f === N ? b[5] - z : f === S ? b[2] + z : b[2] + x; };
  Dibujo.prototype.poner = function (x, y, z, id, m) {
    var wx = this.X(x, z), wy = this.p.b[1] + y, wz = this.Z(x, z);
    if (wy < 0 || wy >= ALTO || wx < this.x0 || wx > this.x0 + 15 || wz < this.z0 || wz > this.z0 + 15) return;
    var i = (wy << 8) | ((wz - this.z0) << 4) | (wx - this.x0);
    this.ids[i] = id; this.meta[i] = m || 0;
  };
  Dibujo.prototype.llenar = function (x0, y0, z0, x1, y1, z1, id, m) {
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) for (var z = z0; z <= z1; z++) this.poner(x, y, z, id, m);
  };
  // el pilar debajo de (x, z): ladrillo hasta tocar algo que no sea aire ni líquido
  Dibujo.prototype.pilar = function (x, z) {
    var wx = this.X(x, z), wz = this.Z(x, z);
    if (wx < this.x0 || wx > this.x0 + 15 || wz < this.z0 || wz > this.z0 + 15) return;
    for (var y = this.p.b[1] - 1; y > 1; y--) {
      var i = (y << 8) | ((wz - this.z0) << 4) | (wx - this.x0), id = this.ids[i];
      if (id !== 0 && (id < 8 || id > 11)) break;
      this.ids[i] = LADRILLO; this.meta[i] = 0;
    }
  };
  Dibujo.prototype.pilares = function (x0, z0, x1, z1) { for (var x = x0; x <= x1; x++) for (var z = z0; z <= z1; z++) this.pilar(x, z); };
  // un escalón que sube hacia el lado (dx, dz) de la pieza (el "facing" del juego con el z al revés)
  Dibujo.prototype.escalon = function (x, y, z, dx, dz) {
    var wx = this.X(x + dx, z - dz) - this.X(x, z), wz = this.Z(x + dx, z - dz) - this.Z(x, z);
    this.poner(x, y, z, ESCALON, wx > 0 ? 0 : wx < 0 ? 1 : wz > 0 ? 2 : 3);
  };
  // lo que el trabajador avisa a la página: dónde quedó un cofre con botín o un generador
  Dibujo.prototype.especial = function (x, y, z, que) {
    var wx = this.X(x, z), wy = this.p.b[1] + y, wz = this.Z(x, z);
    if (wx < this.x0 || wx > this.x0 + 15 || wz < this.z0 || wz > this.z0 + 15) return false;
    if (this.extra) this.extra.push([wx, wy, wz, que]);
    return true;
  };

  var DIBUJAR = {
    puente: function (d) {
      d.llenar(0, 3, 0, 4, 4, 18, LADRILLO); d.llenar(1, 5, 0, 3, 7, 18, 0);
      d.llenar(0, 5, 0, 0, 5, 18, LADRILLO); d.llenar(4, 5, 0, 4, 5, 18, LADRILLO);
      d.llenar(0, 2, 0, 4, 2, 5, LADRILLO); d.llenar(0, 2, 13, 4, 2, 18, LADRILLO);
      d.llenar(0, 0, 0, 4, 1, 3, LADRILLO); d.llenar(0, 0, 15, 4, 1, 18, LADRILLO);
      d.pilares(0, 0, 4, 2); d.pilares(0, 16, 4, 18);
      d.llenar(0, 1, 1, 0, 4, 1, CERCA); d.llenar(0, 3, 4, 0, 4, 4, CERCA); d.llenar(0, 3, 14, 0, 4, 14, CERCA); d.llenar(0, 1, 17, 0, 4, 17, CERCA);
      d.llenar(4, 1, 1, 4, 4, 1, CERCA); d.llenar(4, 3, 4, 4, 4, 4, CERCA); d.llenar(4, 3, 14, 4, 4, 14, CERCA); d.llenar(4, 1, 17, 4, 4, 17, CERCA);
    },
    cruce: function (d) {
      d.llenar(7, 3, 0, 11, 4, 18, LADRILLO); d.llenar(0, 3, 7, 18, 4, 11, LADRILLO);
      d.llenar(8, 5, 0, 10, 7, 18, 0); d.llenar(0, 5, 8, 18, 7, 10, 0);
      d.llenar(7, 5, 0, 7, 5, 7, LADRILLO); d.llenar(7, 5, 11, 7, 5, 18, LADRILLO);
      d.llenar(11, 5, 0, 11, 5, 7, LADRILLO); d.llenar(11, 5, 11, 11, 5, 18, LADRILLO);
      d.llenar(0, 5, 7, 7, 5, 7, LADRILLO); d.llenar(11, 5, 7, 18, 5, 7, LADRILLO);
      d.llenar(0, 5, 11, 7, 5, 11, LADRILLO); d.llenar(11, 5, 11, 18, 5, 11, LADRILLO);
      d.llenar(7, 2, 0, 11, 2, 5, LADRILLO); d.llenar(7, 2, 13, 11, 2, 18, LADRILLO);
      d.llenar(7, 0, 0, 11, 1, 3, LADRILLO); d.llenar(7, 0, 15, 11, 1, 18, LADRILLO);
      d.pilares(7, 0, 11, 2); d.pilares(7, 16, 11, 18);
      d.llenar(0, 2, 7, 5, 2, 11, LADRILLO); d.llenar(13, 2, 7, 18, 2, 11, LADRILLO);
      d.llenar(0, 0, 7, 3, 1, 11, LADRILLO); d.llenar(15, 0, 7, 18, 1, 11, LADRILLO);
      d.pilares(0, 7, 2, 11); d.pilares(16, 7, 18, 11);
    },
    fin: function (d) {
      // el puente que se corta: cada fila hasta un largo al azar
      var az = new C.Azar(d.p.s), i, j;
      for (i = 0; i <= 4; i++) for (j = 3; j <= 4; j++) d.llenar(i, j, 0, i, j, az.ent(8), LADRILLO);
      d.llenar(0, 5, 0, 0, 5, az.ent(8), LADRILLO); d.llenar(4, 5, 0, 4, 5, az.ent(8), LADRILLO);
      for (i = 0; i <= 4; i++) d.llenar(i, 2, 0, i, 2, az.ent(5), LADRILLO);
      for (i = 0; i <= 4; i++) for (j = 0; j <= 1; j++) d.llenar(i, j, 0, i, j, az.ent(3), LADRILLO);
    },
    sala: function (d) {
      d.llenar(0, 0, 0, 6, 1, 6, LADRILLO); d.llenar(0, 2, 0, 6, 7, 6, 0);
      d.llenar(0, 2, 0, 1, 6, 0, LADRILLO); d.llenar(0, 2, 6, 1, 6, 6, LADRILLO); d.llenar(5, 2, 0, 6, 6, 0, LADRILLO); d.llenar(5, 2, 6, 6, 6, 6, LADRILLO);
      d.llenar(0, 2, 0, 0, 6, 1, LADRILLO); d.llenar(0, 2, 5, 0, 6, 6, LADRILLO); d.llenar(6, 2, 0, 6, 6, 1, LADRILLO); d.llenar(6, 2, 5, 6, 6, 6, LADRILLO);
      d.llenar(2, 6, 0, 4, 6, 0, LADRILLO); d.llenar(2, 5, 0, 4, 5, 0, CERCA); d.llenar(2, 6, 6, 4, 6, 6, LADRILLO); d.llenar(2, 5, 6, 4, 5, 6, CERCA);
      d.llenar(0, 6, 2, 0, 6, 4, LADRILLO); d.llenar(0, 5, 2, 0, 5, 4, CERCA); d.llenar(6, 6, 2, 6, 6, 4, LADRILLO); d.llenar(6, 5, 2, 6, 5, 4, CERCA);
      d.pilares(0, 0, 6, 6);
    },
    escalera: function (d) {
      d.llenar(0, 0, 0, 6, 1, 6, LADRILLO); d.llenar(0, 2, 0, 6, 10, 6, 0);
      d.llenar(0, 2, 0, 1, 8, 0, LADRILLO); d.llenar(5, 2, 0, 6, 8, 0, LADRILLO); d.llenar(0, 2, 1, 0, 8, 6, LADRILLO);
      d.llenar(6, 2, 1, 6, 8, 6, LADRILLO); d.llenar(1, 2, 6, 5, 8, 6, LADRILLO);
      d.llenar(0, 3, 2, 0, 5, 4, CERCA); d.llenar(6, 3, 2, 6, 5, 2, CERCA); d.llenar(6, 3, 4, 6, 5, 4, CERCA);
      d.poner(5, 2, 5, LADRILLO); d.llenar(4, 2, 5, 4, 3, 5, LADRILLO); d.llenar(3, 2, 5, 3, 4, 5, LADRILLO);
      d.llenar(2, 2, 5, 2, 5, 5, LADRILLO); d.llenar(1, 2, 5, 1, 6, 5, LADRILLO); d.llenar(1, 7, 1, 5, 7, 4, LADRILLO);
      d.llenar(6, 8, 2, 6, 8, 4, 0); d.llenar(2, 6, 0, 4, 8, 0, LADRILLO); d.llenar(2, 5, 0, 4, 5, 0, CERCA);
      d.pilares(0, 0, 6, 6);
    },
    trono: function (d) {
      d.llenar(0, 2, 0, 6, 7, 7, 0); d.llenar(1, 0, 0, 5, 1, 7, LADRILLO); d.llenar(1, 2, 1, 5, 2, 7, LADRILLO);
      d.llenar(1, 3, 2, 5, 3, 7, LADRILLO); d.llenar(1, 4, 3, 5, 4, 7, LADRILLO);
      d.llenar(1, 2, 0, 1, 4, 2, LADRILLO); d.llenar(5, 2, 0, 5, 4, 2, LADRILLO);
      d.llenar(1, 5, 2, 1, 5, 3, LADRILLO); d.llenar(5, 5, 2, 5, 5, 3, LADRILLO);
      d.llenar(0, 5, 3, 0, 5, 8, LADRILLO); d.llenar(6, 5, 3, 6, 5, 8, LADRILLO); d.llenar(1, 5, 8, 5, 5, 8, LADRILLO);
      d.poner(1, 6, 3, CERCA); d.poner(5, 6, 3, CERCA);
      d.llenar(0, 6, 3, 0, 6, 8, CERCA); d.llenar(6, 6, 3, 6, 6, 8, CERCA); d.llenar(1, 6, 8, 5, 7, 8, CERCA);
      // el generador de blazes
      if (d.especial(3, 5, 5, 'generador')) d.poner(3, 5, 5, GENERADOR, GenNether.GENERADOR_BLAZE);
      d.pilares(0, 0, 6, 6);
    },
    entrada: function (d) {
      d.llenar(0, 3, 0, 12, 4, 12, LADRILLO); d.llenar(0, 5, 0, 12, 13, 12, 0);
      d.llenar(0, 5, 0, 1, 12, 12, LADRILLO); d.llenar(11, 5, 0, 12, 12, 12, LADRILLO);
      d.llenar(2, 5, 11, 4, 12, 12, LADRILLO); d.llenar(8, 5, 11, 10, 12, 12, LADRILLO); d.llenar(5, 9, 11, 7, 12, 12, LADRILLO);
      d.llenar(2, 5, 0, 4, 12, 1, LADRILLO); d.llenar(8, 5, 0, 10, 12, 1, LADRILLO); d.llenar(5, 9, 0, 7, 12, 1, LADRILLO);
      d.llenar(2, 11, 2, 10, 12, 10, LADRILLO); d.llenar(5, 8, 0, 7, 8, 0, CERCA);
      for (var i = 1; i <= 11; i += 2) {
        d.llenar(i, 10, 0, i, 11, 0, CERCA); d.llenar(i, 10, 12, i, 11, 12, CERCA);
        d.llenar(0, 10, i, 0, 11, i, CERCA); d.llenar(12, 10, i, 12, 11, i, CERCA);
        d.poner(i, 13, 0, LADRILLO); d.poner(i, 13, 12, LADRILLO); d.poner(0, 13, i, LADRILLO); d.poner(12, 13, i, LADRILLO);
        if (i !== 11) { d.poner(i + 1, 13, 0, CERCA); d.poner(i + 1, 13, 12, CERCA); d.poner(0, 13, i + 1, CERCA); d.poner(12, 13, i + 1, CERCA); }
      }
      d.poner(0, 13, 0, CERCA); d.poner(0, 13, 12, CERCA); d.poner(12, 13, 12, CERCA); d.poner(12, 13, 0, CERCA);
      for (var k = 3; k <= 9; k += 2) { d.llenar(1, 7, k, 1, 8, k, CERCA); d.llenar(11, 7, k, 11, 8, k, CERCA); }
      d.llenar(4, 2, 0, 8, 2, 12, LADRILLO); d.llenar(0, 2, 4, 12, 2, 8, LADRILLO);
      d.llenar(4, 0, 0, 8, 1, 3, LADRILLO); d.llenar(4, 0, 9, 8, 1, 12, LADRILLO); d.llenar(0, 0, 4, 3, 1, 8, LADRILLO); d.llenar(9, 0, 4, 12, 1, 8, LADRILLO);
      d.pilares(4, 0, 8, 2); d.pilares(4, 10, 8, 12); d.pilares(0, 4, 2, 8); d.pilares(10, 4, 12, 8);
      // el pozo de lava del medio
      d.llenar(5, 5, 5, 7, 5, 7, LADRILLO); d.llenar(6, 1, 6, 6, 4, 6, 0); d.poner(6, 0, 6, LADRILLO); d.poner(6, 5, 6, 10, 0);
      d.especial(6, 5, 6, 'lava');
    },
    pasillo: function (d) {
      d.llenar(0, 0, 0, 4, 1, 4, LADRILLO); d.llenar(0, 2, 0, 4, 5, 4, 0);
      d.llenar(0, 2, 0, 0, 5, 4, LADRILLO); d.llenar(4, 2, 0, 4, 5, 4, LADRILLO);
      d.llenar(0, 3, 1, 0, 4, 1, CERCA); d.llenar(0, 3, 3, 0, 4, 3, CERCA); d.llenar(4, 3, 1, 4, 4, 1, CERCA); d.llenar(4, 3, 3, 4, 4, 3, CERCA);
      d.llenar(0, 6, 0, 4, 6, 4, LADRILLO);
      d.pilares(0, 0, 4, 4);
    },
    cruceP: function (d) {
      d.llenar(0, 0, 0, 4, 1, 4, LADRILLO); d.llenar(0, 2, 0, 4, 5, 4, 0);
      d.llenar(0, 2, 0, 0, 5, 0, LADRILLO); d.llenar(4, 2, 0, 4, 5, 0, LADRILLO); d.llenar(0, 2, 4, 0, 5, 4, LADRILLO); d.llenar(4, 2, 4, 4, 5, 4, LADRILLO);
      d.llenar(0, 6, 0, 4, 6, 4, LADRILLO);
      d.pilares(0, 0, 4, 4);
    },
    derecha: function (d) {
      d.llenar(0, 0, 0, 4, 1, 4, LADRILLO); d.llenar(0, 2, 0, 4, 5, 4, 0);
      d.llenar(0, 2, 0, 0, 5, 4, LADRILLO); d.llenar(1, 2, 4, 4, 5, 4, LADRILLO);
      d.llenar(0, 3, 1, 0, 4, 1, CERCA); d.llenar(0, 3, 3, 0, 4, 3, CERCA); d.llenar(1, 3, 4, 1, 4, 4, CERCA); d.llenar(3, 3, 4, 3, 4, 4, CERCA);
      if (d.p.cofre && d.especial(1, 2, 3, 'cofre')) d.poner(1, 2, 3, COFRE, 2);
      d.llenar(0, 6, 0, 4, 6, 4, LADRILLO);
      d.pilares(0, 0, 4, 4);
    },
    izquierda: function (d) {
      d.llenar(0, 0, 0, 4, 1, 4, LADRILLO); d.llenar(0, 2, 0, 4, 5, 4, 0);
      d.llenar(4, 2, 0, 4, 5, 4, LADRILLO); d.llenar(0, 2, 4, 3, 5, 4, LADRILLO);
      d.llenar(4, 3, 1, 4, 4, 1, CERCA); d.llenar(4, 3, 3, 4, 4, 3, CERCA); d.llenar(1, 3, 4, 1, 4, 4, CERCA); d.llenar(3, 3, 4, 3, 4, 4, CERCA);
      if (d.p.cofre && d.especial(3, 2, 3, 'cofre')) d.poner(3, 2, 3, COFRE, 2);
      d.llenar(0, 6, 0, 4, 6, 4, LADRILLO);
      d.pilares(0, 0, 4, 4);
    },
    bajada: function (d) {
      for (var i = 0; i <= 9; i++) {
        var j = Math.max(1, 7 - i), k = Math.min(Math.max(j + 5, 14 - i), 13);
        d.llenar(0, 0, i, 4, j, i, LADRILLO); d.llenar(1, j + 1, i, 3, k - 1, i, 0);
        if (i <= 6) { d.escalon(1, j + 1, i, 0, 1); d.escalon(2, j + 1, i, 0, 1); d.escalon(3, j + 1, i, 0, 1); }
        d.llenar(0, k, i, 4, k, i, LADRILLO); d.llenar(0, j + 1, i, 0, k - 1, i, LADRILLO); d.llenar(4, j + 1, i, 4, k - 1, i, LADRILLO);
        if ((i & 1) === 0) { d.llenar(0, j + 2, i, 0, j + 3, i, CERCA); d.llenar(4, j + 2, i, 4, j + 3, i, CERCA); }
        d.pilares(0, i, 4, i);
      }
    },
    balcon: function (d) {
      d.llenar(0, 0, 0, 8, 1, 8, LADRILLO); d.llenar(0, 2, 0, 8, 5, 8, 0); d.llenar(0, 6, 0, 8, 6, 5, LADRILLO);
      d.llenar(0, 2, 0, 2, 5, 0, LADRILLO); d.llenar(6, 2, 0, 8, 5, 0, LADRILLO);
      d.llenar(1, 3, 0, 1, 4, 0, CERCA); d.llenar(7, 3, 0, 7, 4, 0, CERCA);
      d.llenar(0, 2, 4, 8, 2, 8, LADRILLO); d.llenar(1, 1, 4, 2, 2, 4, 0); d.llenar(6, 1, 4, 7, 2, 4, 0);
      d.llenar(0, 3, 8, 8, 3, 8, CERCA); d.llenar(0, 3, 6, 0, 3, 7, CERCA); d.llenar(8, 3, 6, 8, 3, 7, CERCA);
      d.llenar(0, 3, 4, 0, 5, 5, LADRILLO); d.llenar(8, 3, 4, 8, 5, 5, LADRILLO);
      d.llenar(1, 3, 5, 2, 5, 5, LADRILLO); d.llenar(6, 3, 5, 7, 5, 5, LADRILLO);
      d.llenar(1, 4, 5, 1, 5, 5, CERCA); d.llenar(7, 4, 5, 7, 5, 5, CERCA);
      d.pilares(0, 0, 8, 5);
    },
    verrugas: function (d) {
      d.llenar(0, 3, 0, 12, 4, 12, LADRILLO); d.llenar(0, 5, 0, 12, 13, 12, 0);
      d.llenar(0, 5, 0, 1, 12, 12, LADRILLO); d.llenar(11, 5, 0, 12, 12, 12, LADRILLO);
      d.llenar(2, 5, 11, 4, 12, 12, LADRILLO); d.llenar(8, 5, 11, 10, 12, 12, LADRILLO); d.llenar(5, 9, 11, 7, 12, 12, LADRILLO);
      d.llenar(2, 5, 0, 4, 12, 1, LADRILLO); d.llenar(8, 5, 0, 10, 12, 1, LADRILLO); d.llenar(5, 9, 0, 7, 12, 1, LADRILLO);
      d.llenar(2, 11, 2, 10, 12, 10, LADRILLO);
      for (var i = 1; i <= 11; i += 2) {
        d.llenar(i, 10, 0, i, 11, 0, CERCA); d.llenar(i, 10, 12, i, 11, 12, CERCA);
        d.llenar(0, 10, i, 0, 11, i, CERCA); d.llenar(12, 10, i, 12, 11, i, CERCA);
        d.poner(i, 13, 0, LADRILLO); d.poner(i, 13, 12, LADRILLO); d.poner(0, 13, i, LADRILLO); d.poner(12, 13, i, LADRILLO);
        if (i !== 11) { d.poner(i + 1, 13, 0, CERCA); d.poner(i + 1, 13, 12, CERCA); d.poner(0, 13, i + 1, CERCA); d.poner(12, 13, i + 1, CERCA); }
      }
      d.poner(0, 13, 0, CERCA); d.poner(0, 13, 12, CERCA); d.poner(12, 13, 12, CERCA); d.poner(12, 13, 0, CERCA);
      for (var j = 3; j <= 9; j += 2) { d.llenar(1, 7, j, 1, 8, j, CERCA); d.llenar(11, 7, j, 11, 8, j, CERCA); }
      // la escalera que sube a la salida de arriba y las dos pasarelas
      for (var k = 0; k <= 6; k++) {
        var z = k + 4;
        for (var x = 5; x <= 7; x++) d.escalon(x, 5 + k, z, 0, -1);
        if (z >= 5 && z <= 8) d.llenar(5, 5, z, 7, k + 4, z, LADRILLO);
        else if (z >= 9 && z <= 10) d.llenar(5, 8, z, 7, k + 4, z, LADRILLO);
        if (k >= 1) d.llenar(5, 6 + k, z, 7, 9 + k, z, 0);
      }
      for (x = 5; x <= 7; x++) d.escalon(x, 12, 11, 0, -1);
      d.llenar(5, 6, 7, 5, 7, 7, CERCA); d.llenar(7, 6, 7, 7, 7, 7, CERCA); d.llenar(5, 13, 12, 7, 13, 12, 0);
      d.llenar(2, 5, 2, 3, 5, 3, LADRILLO); d.llenar(2, 5, 9, 3, 5, 10, LADRILLO); d.llenar(2, 5, 4, 2, 5, 8, LADRILLO);
      d.llenar(9, 5, 2, 10, 5, 3, LADRILLO); d.llenar(9, 5, 9, 10, 5, 10, LADRILLO); d.llenar(10, 5, 4, 10, 5, 8, LADRILLO);
      d.escalon(4, 5, 2, 1, 0); d.escalon(4, 5, 3, 1, 0); d.escalon(4, 5, 9, 1, 0); d.escalon(4, 5, 10, 1, 0);
      d.escalon(8, 5, 2, -1, 0); d.escalon(8, 5, 3, -1, 0); d.escalon(8, 5, 9, -1, 0); d.escalon(8, 5, 10, -1, 0);
      // los canteros: arena de almas con verrugas
      d.llenar(3, 4, 4, 4, 4, 8, ALMAS); d.llenar(8, 4, 4, 9, 4, 8, ALMAS); d.llenar(3, 5, 4, 4, 5, 8, VERRUGA); d.llenar(8, 5, 4, 9, 5, 8, VERRUGA);
      d.llenar(4, 2, 0, 8, 2, 12, LADRILLO); d.llenar(0, 2, 4, 12, 2, 8, LADRILLO);
      d.llenar(4, 0, 0, 8, 1, 3, LADRILLO); d.llenar(4, 0, 9, 8, 1, 12, LADRILLO); d.llenar(0, 0, 4, 3, 1, 8, LADRILLO); d.llenar(9, 0, 4, 12, 1, 8, LADRILLO);
      d.pilares(4, 0, 8, 2); d.pilares(4, 10, 8, 12); d.pilares(0, 4, 2, 8); d.pilares(10, 4, 12, 8);
    }
  };
  // las piezas de las fortalezas que tocan el trozo, dibujadas; extra: [x, y, z, 'cofre'|'generador'|'lava']
  GenNether.prototype.fortalezasEn = function (cx, cz, ids, meta, extra) {
    var l = this.piezasEn(cx, cz);
    for (var i = 0; i < l.length; i++) DIBUJAR[l[i].t](new Dibujo(l[i], ids, meta, cx, cz, extra));
    return l;
  };

  GenNether.B = B;
  return GenNether;
})();
