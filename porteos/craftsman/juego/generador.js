// porteo: el generador del mundo (corre en el trabajador). No es el de MCPE (que está en el binario
// ARM): es uno propio con la misma pinta (mundo infinito de 128 de alto, mar a 62, biomas, cuevas,
// minerales, árboles por bioma, nieve, ríos), hecho con funciones puras de la semilla y la posición:
// así un trozo se puede generar sin sus vecinos y los árboles que cruzan el borde salen iguales de los
// dos lados.
var Gen = (function () {
  'use strict';
  var R = C.Ruido;
  var B = {
    aire: 0, piedra: 1, pasto: 2, tierra: 3, adoquin: 4, tablas: 5, roca: 7, agua: 9, lava: 11, arena: 12,
    grava: 13, oro: 14, hierro: 15, carbon: 16, tronco: 17, hojas: 18, lapis: 21, arenisca: 24, hierba: 31,
    arbusto: 32, flor: 37, rosa: 38, hongoM: 39, hongoR: 40, diamante: 56, redstone: 73, capaNieve: 78,
    hielo: 79, nieve: 80, cactus: 81, arcilla: 82, cana: 83, calabaza: 86, nenufar: 111, esmeralda: 129,
    hojas2: 161, tronco2: 162, arcillaTenida: 159, arcillaDura: 172, planta2: 175, arenaRoja: 12,
    podzol: 243, enredadera: 106, melon: 103
  };
  Gen.B = B;

  // biomas: [nombre, color del pasto, del follaje, índice del costado del pasto (terrain_texture),
  //          árboles por trozo, pasto alto por trozo, flores por trozo]
  var BIOMAS = [
    ['oceano', 0x8eb971, 0x71a74d, 13, 0, 0, 0],
    ['llanura', 0x91bd59, 0x77ab2f, 11, 0.4, 24, 4],
    ['desierto', 0xbfb755, 0xaea42a, 2, 0, 0, 0],
    ['colinas', 0x8ab689, 0x6da36b, 1, 2, 6, 1],
    ['bosque', 0x79c05a, 0x59ae30, 0, 9, 4, 3],
    ['taiga', 0x86b783, 0x68a464, 8, 8, 4, 0],
    ['pantano', 0x6a7039, 0x6a7039, 14, 2, 6, 1],
    ['rio', 0x8eb971, 0x71a74d, 13, 0, 2, 0],
    ['playa', 0x91bd59, 0x77ab2f, 11, 0, 0, 0],
    ['jungla', 0x59c93c, 0x30bb0b, 3, 25, 30, 2],
    ['abedul', 0x88bb67, 0x6ba941, 5, 9, 4, 3],
    ['bosqueOscuro', 0x507a32, 0x59ae30, 15, 14, 2, 1],
    ['taigaFria', 0x80b497, 0x60a17b, 10, 6, 2, 0],
    ['sabana', 0xbfb755, 0xaea42a, 2, 1, 20, 1],
    ['mesa', 0x90814d, 0x9e814d, 12, 0, 1, 0],
    ['llanuraHelada', 0x80b497, 0x60a17b, 10, 0.2, 1, 0],
    ['oceanoProfundo', 0x8eb971, 0x71a74d, 13, 0, 0, 0],
    ['megaTaiga', 0x86b87f, 0x68a464, 6, 10, 6, 0]
  ];
  var BI = {};
  BIOMAS.forEach(function (b, i) { BI[b[0]] = i; });
  Gen.BIOMAS = BIOMAS;
  Gen.BI = BI;

  // tipo: 'infinito' (el de siempre) o 'plano' (el "Tipo de mundo: Plano" del juego: piedra base,
  // dos de tierra y pasto, en llanura)
  function Gen(semilla, tipo) {
    this.semilla = semilla | 0;
    this.plano = tipo === 'plano';
    this.rCont = new R(semilla + 11);
    this.rEro = new R(semilla + 12);
    this.rPico = new R(semilla + 13);
    this.rTemp = new R(semilla + 14);
    this.rHum = new R(semilla + 15);
    this.rDet = new R(semilla + 16);
    this.rRio = new R(semilla + 17);
    this.rC1 = new R(semilla + 21);
    this.rC2 = new R(semilla + 22);
    this.rC3 = new R(semilla + 23);
    this.rArc = new R(semilla + 24);
  }

  function smooth(a, b, x) { x = (x - a) / (b - a); x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }

  // la altura del terreno y el bioma de una columna (funciones puras de la posición)
  Gen.prototype.columna = function (x, z, sal) {
    if (this.plano) { sal.alt = 3; sal.bioma = 1; sal.frio = false; return sal; }
    var c = this.rCont.oct2(x / 700, z / 700, 3, 0.5) * 1.3 + 0.12;
    var e = this.rEro.oct2(x / 450, z / 450, 2, 0.5);
    var pico = 1 - Math.abs(this.rPico.oct2(x / 260, z / 260, 3, 0.5));
    var t = this.rTemp.oct2(x / 900, z / 900, 2, 0.5) * 1.4 + this.rDet.n2(x / 40, z / 40) * 0.03;
    var h = this.rHum.oct2(x / 800, z / 800, 2, 0.5) * 1.4;
    var det = this.rDet.oct2(x / 32, z / 32, 3, 0.5);
    var alt, m = 0;
    if (c < -0.18) {
      alt = 61 + (c + 0.18) * 70;                  // fondo del mar: más hondo lejos de la costa
      alt = Math.max(alt, 34) + det * 3;
    } else {
      var tierra = smooth(-0.18, 0.15, c);
      alt = 61 + tierra * 6 + (c - 0.15 > 0 ? (c - 0.15) * 14 : 0);
      m = smooth(0.15, 0.55, -e) * smooth(-0.1, 0.25, c);   // montañas tierra adentro
      alt += m * pico * pico * 52;
      alt += det * (3 + m * 6) + (1 - m) * this.rDet.n2(x / 90, z / 90) * 4;
    }
    // ríos: un valle angosto donde el ruido cruza el cero
    var r = Math.abs(this.rRio.oct2(x / 520, z / 520, 2, 0.5));
    var rio = 0;
    if (c > -0.12 && r < 0.045 && m < 0.7) {
      var k = smooth(0.045, 0.012, r);
      alt = alt + (57.5 - alt) * k;
      rio = k;
    }
    var bioma;
    if (alt < 60.5 && c < -0.18) bioma = alt < 46 ? BI.oceanoProfundo : BI.oceano;
    else if (rio > 0.5 && alt < 61.5) bioma = BI.rio;
    else if (c < -0.1 && alt < 65 && m < 0.3 && t > -0.45) bioma = BI.playa;
    else if (m > 0.55) bioma = BI.colinas;
    else if (t > 0.45) bioma = h < -0.15 ? (this.rArc.n2(x / 300, z / 300) > 0.35 ? BI.mesa : BI.desierto) : h < 0.25 ? BI.sabana : BI.jungla;
    else if (t > -0.05) bioma = h < -0.3 ? BI.llanura : h < 0.05 ? BI.bosque : h < 0.3 ? (t > 0.2 ? BI.bosqueOscuro : BI.abedul) : BI.pantano;
    else if (t > -0.45) bioma = h < -0.25 ? BI.llanura : h < 0.3 ? BI.taiga : BI.megaTaiga;
    else bioma = h < 0 ? BI.llanuraHelada : BI.taigaFria;
    if (bioma === BI.pantano) alt = Math.min(alt, 62.4 + det * 1.2);
    if (bioma === BI.mesa) alt += smooth(64, 72, alt) * 8;
    sal.alt = Math.max(4, Math.min(124, Math.floor(alt)));
    sal.bioma = bioma;
    sal.frio = t < -0.45 || (m > 0.55 && sal.alt > 98);
    return sal;
  };

  // ------------------------------------------------------------------------------------------
  // Un trozo: 16x16x128. ids y meta por bloque, índice (y<<8)|(z<<4)|x
  // ------------------------------------------------------------------------------------------
  Gen.prototype.trozo = function (cx, cz, ids, meta, biomas) {
    if (this.plano) {
      ids.fill(0); meta.fill(0); biomas.fill(1);
      for (var k = 0; k < 256; k++) { ids[k] = 7; ids[256 + k] = 3; ids[512 + k] = 3; ids[768 + k] = 2; }
      return;
    }
    var x0 = cx * 16, z0 = cz * 16, col = {}, alts = new Int16Array(256), frios = new Uint8Array(256);
    var x, z, y, i;
    for (z = 0; z < 16; z++) {
      for (x = 0; x < 16; x++) {
        this.columna(x0 + x, z0 + z, col);
        alts[(z << 4) | x] = col.alt;
        biomas[(z << 4) | x] = col.bioma;
        frios[(z << 4) | x] = col.frio ? 1 : 0;
      }
    }
    var az = new C.Azar(C.hash(this.semilla, cx, cz, 1));
    // piedra, agua y la superficie de cada bioma
    for (z = 0; z < 16; z++) {
      for (x = 0; x < 16; x++) {
        var k = (z << 4) | x, alt = alts[k], bio = biomas[k], frio = frios[k];
        var arriba = B.pasto, abajo = B.tierra, hondo = 3 + (az.sig() * 2 | 0);
        if (bio === BI.desierto || bio === BI.playa) { arriba = B.arena; abajo = B.arena; }
        else if (bio === BI.oceano || bio === BI.oceanoProfundo || bio === BI.rio) {
          arriba = alt < 56 ? B.grava : (alt < 60 && az.sig() < 0.4 ? B.arcilla : B.arena);
          abajo = arriba === B.arcilla ? B.arcilla : B.arena;
          if (bio === BI.oceanoProfundo) { arriba = B.grava; abajo = B.grava; }
        } else if (bio === BI.mesa) { arriba = B.arena; abajo = B.arcillaDura; hondo = 12; }
        else if (bio === BI.megaTaiga && az.sig() < 0.6) arriba = B.podzol;
        else if (bio === BI.colinas && alt > 92 && az.sig() < 0.7) { arriba = B.piedra; abajo = B.piedra; }
        if (alt < C.MAR && arriba === B.pasto) arriba = B.tierra;
        for (y = 0; y <= alt; y++) {
          i = (y << 8) | k;
          if (y === 0 || (y < 5 && az.sig() < (5 - y) / 5)) ids[i] = B.roca;
          else if (y === alt) ids[i] = arriba;
          else if (y > alt - hondo) ids[i] = abajo;
          else ids[i] = B.piedra;
          if (bio === BI.mesa && y > alt - hondo && y < alt) {
            // las franjas de arcilla teñida de la mesa
            var franja = (y + Math.floor(this.rArc.n2((x0 + x) / 60, (z0 + z) / 60) * 3)) % 9;
            if (franja < 5) { ids[i] = B.arcillaTenida; meta[i] = [1, 4, 0, 12, 14][franja]; }
          }
          if ((bio === BI.desierto) && y < alt - 3 && y >= alt - 6) ids[i] = B.arenisca;
        }
        for (y = alt + 1; y <= C.MAR; y++) {
          i = (y << 8) | k;
          ids[i] = B.agua;
        }
        // hielo arriba del agua y nieve arriba de todo en lo frío
        if (frio) {
          if (alt < C.MAR) ids[(C.MAR << 8) | k] = B.hielo;
          else if (alt + 1 < C.ALTO && arriba !== B.piedra) ids[((alt + 1) << 8) | k] = B.capaNieve;
          else if (arriba === B.piedra && alt + 1 < C.ALTO) ids[((alt + 1) << 8) | k] = B.capaNieve;
        }
      }
    }
    this.cuevas(cx, cz, ids, alts);
    this.minerales(cx, cz, ids, meta, az);
    this.plantas(cx, cz, ids, meta, biomas, alts, frios);
    this.arboles(cx, cz, ids, meta);
    return alts;
  };

  // cuevas: dos campos de ruido 3D que se cruzan (túneles) y uno grande (cavernas), en una grilla
  // gruesa (4 de lado, 8 de alto) con interpolación, como el generador del juego
  Gen.prototype.cuevas = function (cx, cz, ids, alts) {
    var x0 = cx * 16, z0 = cz * 16;
    var NX = 5, NY = 17, NZ = 5;   // puntos de la grilla (cada 4 en x/z, cada 8 en y)
    var g1 = new Float32Array(NX * NY * NZ), g2 = new Float32Array(NX * NY * NZ), g3 = new Float32Array(NX * NY * NZ);
    var a, b, c, n = 0;
    for (a = 0; a < NX; a++) for (c = 0; c < NZ; c++) for (b = 0; b < NY; b++) {
      var wx = x0 + a * 4, wy = b * 8, wz = z0 + c * 4;
      g1[n] = this.rC1.n3(wx / 48, wy / 32, wz / 48);
      g2[n] = this.rC2.n3(wx / 48, wy / 32, wz / 48);
      g3[n] = this.rC3.n3(wx / 90, wy / 40, wz / 90);
      n++;
    }
    function idx(a, b, c) { return (a * NZ + c) * NY + b; }
    for (var x = 0; x < 16; x++) {
      var ax = x >> 2, fx = (x & 3) / 4;
      for (var z = 0; z < 16; z++) {
        var az = z >> 2, fz = (z & 3) / 4, k = (z << 4) | x, alt = alts[k];
        var techo = Math.min(alt - 1, 120);
        for (var y = 6; y <= techo; y++) {
          var by = y >> 3, fy = (y & 7) / 8;
          var i000 = idx(ax, by, az), i100 = idx(ax + 1, by, az), i001 = idx(ax, by, az + 1), i101 = idx(ax + 1, by, az + 1);
          var v1 = tri(g1, i000, i100, i001, i101, fx, fy, fz);
          var v2 = tri(g2, i000, i100, i001, i101, fx, fy, fz);
          var t = 0.055 + (y < 20 ? 0.01 : 0);
          var hueco = (v1 * v1 < t * t && v2 * v2 < t * t);
          if (!hueco && y < 50) hueco = tri(g3, i000, i100, i001, i101, fx, fy, fz) > 0.62 - (50 - y) * 0.002;
          if (!hueco) continue;
          // que no se abran al mar ni dejen agua flotando
          var i = (y << 8) | k;
          var id = ids[i];
          if (id === B.agua || id === B.roca) continue;
          if (y >= alt - 1 && alt < C.MAR + 1) continue;
          var arriba = ids[((y + 1) << 8) | k];
          if (arriba === B.agua || arriba === B.hielo) continue;
          ids[i] = y < 11 ? B.lava : B.aire;
          // el pasto que queda arriba de una cueva sigue siendo pasto; la tierra de abajo, también
        }
      }
    }
    function tri(g, i000, i100, i001, i101, fx, fy, fz) {
      // trilineal: el +1 en y es el punto siguiente de la misma columna
      var c00 = g[i000] + (g[i000 + 1] - g[i000]) * fy, c10 = g[i100] + (g[i100 + 1] - g[i100]) * fy;
      var c01 = g[i001] + (g[i001 + 1] - g[i001]) * fy, c11 = g[i101] + (g[i101 + 1] - g[i101]) * fy;
      var c0 = c00 + (c10 - c00) * fx, c1 = c01 + (c11 - c01) * fx;
      return c0 + (c1 - c0) * fz;
    }
  };

  // vetas de minerales (elipsoides en una caminata corta, como WorldGenMinable), dentro del trozo
  Gen.prototype.minerales = function (cx, cz, ids, meta, az) {
    var tipos = [
      // bloque, meta, vetas, tamaño, y mín, y máx, reemplaza (1 piedra)
      [B.carbon, 0, 20, 14, 5, 127], [B.hierro, 0, 20, 8, 5, 64], [B.oro, 0, 2, 8, 5, 32],
      [B.redstone, 0, 8, 7, 5, 16], [B.diamante, 0, 1, 7, 5, 16], [B.lapis, 0, 1, 6, 8, 30],
      [B.tierra, 0, 10, 28, 5, 127], [B.grava, 0, 8, 28, 5, 127],
      [B.piedra, 1, 10, 28, 5, 80], [B.piedra, 3, 10, 28, 5, 80], [B.piedra, 5, 10, 28, 5, 80]
    ];
    for (var t = 0; t < tipos.length; t++) {
      var T = tipos[t];
      for (var v = 0; v < T[2]; v++) {
        var x = az.sig() * 16, z = az.sig() * 16, y = T[4] + az.sig() * (T[5] - T[4]);
        var tam = T[3], ang = az.sig() * Math.PI;
        var dx = Math.sin(ang) * tam / 8, dz = Math.cos(ang) * tam / 8, dy = (az.sig() - 0.5) * 2;
        for (var s = 0; s < tam; s++) {
          var f = s / tam;
          var px = x + dx * (f - 0.5) * 2, py = y + dy * (f - 0.5) * 2, pz = z + dz * (f - 0.5) * 2;
          var r = (Math.sin(f * Math.PI) + 1) * (tam / 16) * 0.6 + 0.25;
          var r2 = r * r;
          for (var ix = Math.floor(px - r); ix <= Math.floor(px + r); ix++) {
            if (ix < 0 || ix > 15) continue;
            for (var iz = Math.floor(pz - r); iz <= Math.floor(pz + r); iz++) {
              if (iz < 0 || iz > 15) continue;
              for (var iy = Math.floor(py - r); iy <= Math.floor(py + r); iy++) {
                if (iy < 1 || iy > 126) continue;
                var ddx = ix + 0.5 - px, ddy = iy + 0.5 - py, ddz = iz + 0.5 - pz;
                if (ddx * ddx + ddy * ddy + ddz * ddz > r2) continue;
                var i = (iy << 8) | (iz << 4) | ix;
                if (ids[i] === B.piedra && meta[i] === 0) { ids[i] = T[0]; meta[i] = T[1]; }
              }
            }
          }
        }
      }
    }
  };

  // pasto alto, flores, cañas, cactus, hongos, calabazas, nenúfares
  Gen.prototype.plantas = function (cx, cz, ids, meta, biomas, alts, frios) {
    var az = new C.Azar(C.hash(this.semilla, cx, cz, 2));
    var bio = biomas[(8 << 4) | 8], def = BIOMAS[bio];
    var i, k, x, z, y, n;
    function sobre(x, z) { var kk = (z << 4) | x; return { k: kk, y: alts[kk] + 1 }; }
    for (n = 0; n < def[5]; n++) {
      x = az.ent(16); z = az.ent(16); var s = sobre(x, z);
      if (s.y >= C.ALTO - 2) continue;
      i = (s.y << 8) | s.k;
      if (ids[i] !== B.aire || ids[i - 256] !== B.pasto) continue;
      var r = az.sig();
      if (bio === BI.jungla && r < 0.25) { ids[i] = B.hierba; meta[i] = 2; }           // helecho
      else if ((bio === BI.taiga || bio === BI.megaTaiga) && r < 0.4) { ids[i] = B.hierba; meta[i] = 2; }
      else if (bio === BI.llanura && r < 0.06 && s.y + 1 < C.ALTO) {                    // pasto alto doble
        ids[i] = B.planta2; meta[i] = 2; ids[i + 256] = B.planta2; meta[i + 256] = 10;
      } else { ids[i] = B.hierba; meta[i] = 1; }
    }
    for (n = 0; n < def[6]; n++) {
      x = az.ent(16); z = az.ent(16); s = sobre(x, z);
      i = (s.y << 8) | s.k;
      if (s.y >= C.ALTO - 2 || ids[i] !== B.aire || ids[i - 256] !== B.pasto) continue;
      if (az.sig() < 0.5) { ids[i] = B.flor; meta[i] = 0; }
      else { ids[i] = B.rosa; meta[i] = bio === BI.llanura ? [0, 3, 4, 5, 6, 7, 8][az.ent(7)] : bio === BI.pantano ? 1 : 0; }
    }
    if (bio === BI.desierto || bio === BI.mesa) {
      for (n = 0; n < 4; n++) {
        x = 1 + az.ent(14); z = 1 + az.ent(14); s = sobre(x, z); i = (s.y << 8) | s.k;
        if (ids[i - 256] !== B.arena || ids[i] !== B.aire) continue;
        if (az.sig() < 0.5 && bio === BI.desierto) {
          var altura = 1 + az.ent(3);
          for (var h = 0; h < altura && s.y + h < C.ALTO - 1; h++) ids[i + h * 256] = B.cactus;
        } else ids[i] = B.arbusto;
      }
    }
    // cañas al lado del agua
    for (n = 0; n < 10; n++) {
      x = 1 + az.ent(14); z = 1 + az.ent(14); s = sobre(x, z); i = (s.y << 8) | s.k;
      var suelo = ids[i - 256];
      if (ids[i] !== B.aire || (suelo !== B.pasto && suelo !== B.arena && suelo !== B.tierra)) continue;
      var y1 = s.y - 1;
      if (ids[(y1 << 8) | s.k + 1] === B.agua || ids[(y1 << 8) | s.k - 1] === B.agua ||
          ids[(y1 << 8) | s.k + 16] === B.agua || ids[(y1 << 8) | s.k - 16] === B.agua) {
        var hh = 2 + az.ent(2);
        for (h = 0; h < hh && s.y + h < C.ALTO - 1; h++) ids[i + h * 256] = B.cana;
      }
    }
    if (bio === BI.pantano) {
      for (n = 0; n < 4; n++) {
        x = az.ent(16); z = az.ent(16); k = (z << 4) | x;
        for (y = C.MAR + 1; y > 50; y--) {
          i = (y << 8) | k;
          if (ids[i - 256] === B.agua && ids[i] === B.aire) { ids[i] = B.nenufar; break; }
          if (ids[i] !== B.aire) break;
        }
      }
    }
    if (az.sig() < 0.03) {
      x = az.ent(16); z = az.ent(16); s = sobre(x, z); i = (s.y << 8) | s.k;
      if (ids[i] === B.aire && ids[i - 256] === B.pasto) { ids[i] = B.calabaza; meta[i] = az.ent(4); }
    }
    if (az.sig() < 0.08) {
      x = az.ent(16); z = az.ent(16); s = sobre(x, z); i = (s.y << 8) | s.k;
      if (ids[i] === B.aire && (ids[i - 256] === B.pasto || ids[i - 256] === B.podzol)) ids[i] = az.sig() < 0.5 ? B.hongoM : B.hongoR;
    }
  };

  // ------------------------------------------------------------------------------------------
  // Árboles. Cada trozo decide los suyos con su propio azar; al generar un trozo se dibujan los
  // árboles de él y de sus 8 vecinos, recortados a lo que cae adentro: sale igual de los dos lados
  // ------------------------------------------------------------------------------------------
  Gen.prototype.arbolesDe = function (cx, cz) {
    var az = new C.Azar(C.hash(this.semilla, cx, cz, 3)), col = {};
    this.columna(cx * 16 + 8, cz * 16 + 8, col);
    var def = BIOMAS[col.bioma], n = def[4];
    var cant = Math.floor(n) + (az.sig() < n - Math.floor(n) ? 1 : 0);
    var lista = [];
    for (var a = 0; a < cant; a++) {
      var x = cx * 16 + az.ent(16), z = cz * 16 + az.ent(16);
      this.columna(x, z, col);
      if (col.alt < C.MAR || col.alt > 118) continue;
      var b = col.bioma, tipo;
      if (b === BI.desierto || b === BI.playa || b === BI.mesa || b === BI.oceano || b === BI.rio) continue;
      var r = az.sig();
      if (b === BI.taiga || b === BI.taigaFria || b === BI.megaTaiga) tipo = 'abeto';
      else if (b === BI.abedul) tipo = r < 0.8 ? 'abedul' : 'roble';
      else if (b === BI.bosque) tipo = r < 0.2 ? 'abedul' : 'roble';
      else if (b === BI.jungla) tipo = r < 0.3 ? 'arbusto' : 'jungla';
      else if (b === BI.sabana) tipo = 'acacia';
      else if (b === BI.bosqueOscuro) tipo = r < 0.7 ? 'oscuro' : 'roble';
      else if (b === BI.colinas) tipo = r < 0.5 ? 'abeto' : 'roble';
      else if (b === BI.pantano) tipo = 'pantano';
      else tipo = 'roble';
      lista.push({ x: x, y: col.alt + 1, z: z, tipo: tipo, s: C.hash(this.semilla, x, z, 4), suelo: col.bioma });
    }
    return lista;
  };

  Gen.prototype.arboles = function (cx, cz, ids, meta) {
    var x0 = cx * 16, z0 = cz * 16;
    function poner(x, y, z, id, m, soloAire) {
      x -= x0; z -= z0;
      if (x < 0 || x > 15 || z < 0 || z > 15 || y < 1 || y >= C.ALTO) return;
      var i = (y << 8) | (z << 4) | x, ant = ids[i];
      if (soloAire && ant !== 0 && ant !== B.hierba && ant !== B.capaNieve && ant !== B.flor && ant !== B.rosa) return;
      if (!soloAire && ant !== 0 && ant !== B.hojas && ant !== B.hojas2 && ant !== B.hierba && ant !== B.capaNieve &&
          ant !== B.pasto && ant !== B.tierra && ant !== B.flor && ant !== B.rosa && ant !== B.podzol) return;
      ids[i] = id; meta[i] = m;
    }
    function hojas(x, y, z, m, id) { poner(x, y, z, id || B.hojas, m, true); }
    for (var dx = -1; dx <= 1; dx++) {
      for (var dz = -1; dz <= 1; dz++) {
        var lista = this.arbolesDe(cx + dx, cz + dz);
        for (var a = 0; a < lista.length; a++) {
          var t = lista[a], az = new C.Azar(t.s), x = t.x, y = t.y, z = t.z, h, i, j, k, r;
          if (t.tipo === 'roble' || t.tipo === 'abedul' || t.tipo === 'pantano') {
            var mt = t.tipo === 'abedul' ? 2 : 0;
            h = (t.tipo === 'abedul' ? 5 : 4) + az.ent(3);
            for (k = y + h - 3; k <= y + h; k++) {
              r = k >= y + h - 1 ? 1 : 2;
              if (t.tipo === 'pantano') r += 1;
              for (i = -r; i <= r; i++) for (j = -r; j <= r; j++) {
                if (Math.abs(i) === r && Math.abs(j) === r && (k === y + h || az.sig() < 0.5)) continue;
                hojas(x + i, k, z + j, mt);
              }
            }
            for (k = 0; k < h; k++) poner(x, y + k, z, B.tronco, mt);
            poner(x, y - 1, z, B.tierra, 0);
            if (t.tipo === 'pantano') {
              for (i = 0; i < 6; i++) {
                var vx = x + az.ent(7) - 3, vz = z + az.ent(7) - 3;
                for (k = 0; k < 3; k++) poner(vx, y + h - 3 - k, vz, B.enredadera, 1 << az.ent(4), true);
              }
            }
          } else if (t.tipo === 'abeto') {
            h = 6 + az.ent(4);
            var radio = 0, maxr = 2 + az.ent(2);
            for (k = y + h; k >= y + 2; k--) {
              for (i = -radio; i <= radio; i++) for (j = -radio; j <= radio; j++) {
                if (radio > 0 && Math.abs(i) === radio && Math.abs(j) === radio) continue;
                hojas(x + i, k, z + j, 1);
              }
              radio = radio >= maxr || (radio > 0 && az.sig() < 0.35) ? (radio > 1 ? 0 : radio + 1) : radio + 1;
              if (radio > maxr) radio = 1;
            }
            hojas(x, y + h + 1, z, 1);
            for (k = 0; k < h; k++) poner(x, y + k, z, B.tronco, 1);
          } else if (t.tipo === 'jungla') {
            h = 8 + az.ent(8);
            for (k = y + h - 3; k <= y + h + 1; k++) {
              r = k >= y + h ? 2 : 3;
              for (i = -r; i <= r; i++) for (j = -r; j <= r; j++) {
                if (i * i + j * j > r * r + 1) continue;
                hojas(x + i, k, z + j, 3);
              }
            }
            for (k = 0; k < h; k++) {
              poner(x, y + k, z, B.tronco, 3);
              if (az.sig() < 0.3) poner(x + 1, y + k, z, B.enredadera, 8, true);
              if (az.sig() < 0.3) poner(x - 1, y + k, z, B.enredadera, 2, true);
            }
          } else if (t.tipo === 'arbusto') {
            poner(x, y, z, B.tronco, 3);
            for (k = y; k <= y + 2; k++) {
              r = 2 - (k - y);
              for (i = -r; i <= r; i++) for (j = -r; j <= r; j++) {
                if (Math.abs(i) === r && Math.abs(j) === r && az.sig() < 0.5) continue;
                hojas(x + i, k, z + j, 0);
              }
            }
          } else if (t.tipo === 'acacia') {
            h = 5 + az.ent(3);
            var dir = az.ent(4), ddx = [1, -1, 0, 0][dir], ddz = [0, 0, 1, -1][dir], bx = x, bz = z;
            for (k = 0; k < h; k++) {
              if (k >= h - 2) { bx += ddx; bz += ddz; }
              poner(bx, y + k, bz, B.tronco2, 0);
            }
            for (i = -3; i <= 3; i++) for (j = -3; j <= 3; j++) {
              if (Math.abs(i) + Math.abs(j) > 4) continue;
              hojas(bx + i, y + h - 1, bz + j, 0, B.hojas2);
              if (Math.abs(i) + Math.abs(j) <= 2) hojas(bx + i, y + h, bz + j, 0, B.hojas2);
            }
          } else if (t.tipo === 'oscuro') {
            h = 6 + az.ent(3);
            for (k = y + h - 2; k <= y + h + 1; k++) {
              r = k === y + h + 1 ? 2 : 3;
              for (i = -r; i <= r + 1; i++) for (j = -r; j <= r + 1; j++) {
                if ((i === -r || i === r + 1) && (j === -r || j === r + 1)) continue;
                hojas(x + i, k, z + j, 1, B.hojas2);
              }
            }
            for (k = 0; k < h; k++) {
              poner(x, y + k, z, B.tronco2, 1); poner(x + 1, y + k, z, B.tronco2, 1);
              poner(x, y + k, z + 1, B.tronco2, 1); poner(x + 1, y + k, z + 1, B.tronco2, 1);
            }
          }
        }
      }
    }
  };

  return Gen;
})();
