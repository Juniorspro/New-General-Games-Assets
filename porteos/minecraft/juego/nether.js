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
    return lavas;
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
  GenNether.B = B;
  return GenNether;
})();
