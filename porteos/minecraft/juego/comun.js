// porteo: lo que comparten la página y el trabajador (bloques, ruido, utilidades). Va primero en los
// dos. Los bloques salen de blocks.json de la 1.2 (forma, texturas y sonido); acá va lo que el juego
// tiene en su código (libminecraftpe.so) y no en datos: qué es opaco, cuánta luz da o frena, de qué
// capa es.

var C = {};
(function () {
  'use strict';
  // la 1.2 tiene 256 de alto; acá 128 (como MCPE antes de la 1.0): el doble de alto es el doble de
  // memoria por trozo (~200 KB) y en un teléfono de 1 GB no entra a distancia 6
  C.ALTO = 128;
  C.MAR = 62;              // nivel del mar

  // formas
  var F = C.F = {
    nada: 0, cubo: 1, cruz: 2, liquido: 3, losa: 4, escalera: 5, antorcha: 6, cerca: 7, panel: 8,
    pared: 9, capa: 10, cactus: 11, surcos: 12, puerta: 13, trampilla: 14, alfombra: 15, riel: 16,
    nenufar: 17, planta2: 18, tronco: 19, bajo: 20, muro: 21, portal: 22, fuego: 23, tallo: 24
  };
  var FORMA_JSON = {
    invisible: F.nada, cubo: F.cubo, cross_texture_poly: F.cruz, cross_texture: F.cruz, water: F.liquido,
    tree: F.tronco, block_half: F.losa, stairs: F.escalera, torch: F.antorcha, fence: F.cerca,
    iron_fence: F.panel, ladder: F.pared, vine: F.pared, top_snow: F.capa, cactus: F.cactus, rows: F.surcos,
    door: F.puerta, rail: F.riel, lilypad: F.nenufar, double_plant_poly: F.planta2, wall: F.muro,
    fence_gate: F.cerca, stem: F.tallo, fire: F.fuego,
    // los nombres de la 1.2
    double_side_fence: F.panel, terracotta: F.cubo, slime_block: F.cubo, chest: F.cubo, facing_block: F.cubo,
    end_rod: F.antorcha, chorus_flower: F.cubo, chorus_plant: F.cubo, command_block: F.cubo, piston: F.cubo,
    portal_frame: F.bajo, bed: F.losa
  };

  // capas de dibujo (materiales del juego): 0 opaco (terrain_opaque), 1 recorte (terrain_alpha:
  // hojas, plantas, vidrio), 2 agua (terrain_water: el agua con reflejos del shader), 3 mezcla
  // (terrain_blend: hielo, portal)
  C.CAPAS = 4;

  // cada número: [forma (si no es la de blocks.json), opaco, capa, luz que da, luz que frena, tinte]
  // tinte: 0 nada, 1 pasto, 2 follaje, 3 agua, 4 abeto, 5 abedul
  var PROPIAS = {
    0: [F.nada, 0, 0, 0, 0],
    8: [F.liquido, 0, 2, 0, 2, 3], 9: [F.liquido, 0, 2, 0, 2, 3],
    10: [F.liquido, 0, 0, 15, 15], 11: [F.liquido, 0, 0, 15, 15],
    18: [F.cubo, 0, 1, 0, 1, 2], 161: [F.cubo, 0, 1, 0, 1, 2],
    20: [F.cubo, 0, 1, 0, 0], 102: [F.panel, 0, 1, 0, 0], 101: [F.panel, 0, 1, 0, 0],
    79: [F.cubo, 0, 3, 0, 2], 174: [F.cubo, 1, 0, 0, 15],
    6: [F.cruz, 0, 1, 0, 0], 31: [F.cruz, 0, 1, 0, 0, 1], 32: [F.cruz, 0, 1, 0, 0], 37: [F.cruz, 0, 1, 0, 0],
    38: [F.cruz, 0, 1, 0, 0], 39: [F.cruz, 0, 1, 1, 0], 40: [F.cruz, 0, 1, 0, 0], 83: [F.cruz, 0, 1, 0, 0, 1],
    30: [F.cruz, 0, 1, 0, 1], 175: [F.planta2, 0, 1, 0, 0, 1], 106: [F.pared, 0, 1, 0, 0, 2],
    65: [F.pared, 0, 1, 0, 0], 111: [F.nenufar, 0, 1, 0, 0, 2], 59: [F.surcos, 0, 1, 0, 0],
    141: [F.surcos, 0, 1, 0, 0], 142: [F.surcos, 0, 1, 0, 0], 244: [F.surcos, 0, 1, 0, 0],
    115: [F.surcos, 0, 1, 0, 0], 104: [F.tallo, 0, 1, 0, 0, 2], 105: [F.tallo, 0, 1, 0, 0, 2],
    50: [F.antorcha, 0, 1, 14, 0], 76: [F.antorcha, 0, 1, 7, 0], 75: [F.antorcha, 0, 1, 0, 0],
    51: [F.fuego, 0, 1, 15, 0], 90: [F.cubo, 0, 3, 11, 0],
    89: [F.cubo, 1, 0, 15, 15], 91: [F.cubo, 1, 0, 15, 15], 124: [F.cubo, 1, 0, 15, 15],
    246: [F.cubo, 1, 0, 12, 15], 74: [F.cubo, 1, 0, 9, 15], 62: [F.cubo, 1, 0, 13, 15],
    138: [F.cubo, 1, 0, 15, 15],
    44: [F.losa, 0, 0, 0, 15], 158: [F.losa, 0, 0, 0, 15], 182: [F.losa, 0, 0, 0, 15],
    78: [F.capa, 0, 0, 0, 0], 171: [F.alfombra, 0, 0, 0, 0], 60: [F.bajo, 0, 0, 0, 15], 198: [F.bajo, 0, 0, 0, 15],
    81: [F.cactus, 0, 1, 0, 0], 26: [F.losa, 0, 0, 0, 0], 92: [F.losa, 0, 0, 0, 0],
    96: [F.trampilla, 0, 1, 0, 0], 167: [F.trampilla, 0, 1, 0, 0],
    85: [F.cerca, 0, 0, 0, 0], 113: [F.cerca, 0, 0, 0, 0], 139: [F.muro, 0, 0, 0, 0],
    107: [F.cerca, 0, 0, 0, 0], 183: [F.cerca, 0, 0, 0, 0], 184: [F.cerca, 0, 0, 0, 0], 185: [F.cerca, 0, 0, 0, 0],
    186: [F.cerca, 0, 0, 0, 0], 187: [F.cerca, 0, 0, 0, 0],
    64: [F.puerta, 0, 1, 0, 0], 71: [F.puerta, 0, 1, 0, 0], 193: [F.puerta, 0, 1, 0, 0], 194: [F.puerta, 0, 1, 0, 0],
    195: [F.puerta, 0, 1, 0, 0], 196: [F.puerta, 0, 1, 0, 0], 197: [F.puerta, 0, 1, 0, 0],
    66: [F.riel, 0, 1, 0, 0], 27: [F.riel, 0, 1, 0, 0], 28: [F.riel, 0, 1, 0, 0], 126: [F.riel, 0, 1, 0, 0],
    2: [F.cubo, 1, 0, 0, 15, 1], 54: [F.cubo, 0, 0, 0, 0], 146: [F.cubo, 0, 0, 0, 0], 52: [F.cubo, 0, 1, 0, 0],
    // los de la 1.2: vidrios teñidos y el bloque de slime (transparentes, como el hielo), la linterna
    // del mar, el magma, la vara del End, el hielo escarchado
    241: [F.cubo, 0, 3, 0, 0], 160: [F.panel, 0, 3, 0, 0], 165: [F.cubo, 0, 3, 0, 1], 169: [F.cubo, 1, 0, 15, 15],
    213: [F.cubo, 1, 0, 3, 15], 208: [F.antorcha, 0, 1, 14, 0], 207: [F.cubo, 0, 3, 0, 2], 120: [F.bajo, 0, 0, 1, 15],
    130: [F.cubo, 0, 0, 7, 0], 205: [F.cubo, 1, 0, 0, 15], 218: [F.cubo, 1, 0, 0, 15]
  };
  // escaleras: todas las que trae blocks.json (forma "stairs") frenan la luz como un cubo
  C.bloques = [];
  C.armarBloques = function (json) {
    for (var id = 0; id < 256; id++) {
      var j = json[id];
      var b = {
        id: id, nombre: j ? j.n : 'b' + id, forma: j ? (FORMA_JSON[j.f] !== undefined ? FORMA_JSON[j.f] : F.cubo) : F.nada,
        opaco: 1, capa: 0, luz: 0, frena: 15, tinte: 0, tex: j ? j.t : null, texMano: j ? j.c : null, existe: !!j,
        sonido: j ? j.s : null
      };
      if (!j) { b.opaco = 0; b.frena = 0; }
      var p = PROPIAS[id];
      if (p) {
        b.forma = p[0]; b.opaco = p[1]; b.capa = p[2]; b.luz = p[3]; b.frena = p[4]; b.tinte = p[5] || 0;
      } else if (b.forma !== F.cubo && b.forma !== F.tronco) {
        // lo que no es un cubo entero no tapa a los vecinos; frena la luz si es macizo (escaleras)
        b.opaco = 0;
        b.frena = b.forma === F.escalera ? 15 : 0;
        if (b.forma === F.cruz || b.forma === F.riel || b.forma === F.pared) b.capa = 1;
      }
      if (b.forma === F.nada) { b.opaco = 0; b.frena = 0; }
      C.bloques[id] = b;
    }
    // tablas planas para los bucles calientes
    C.OPACO = new Uint8Array(256); C.FRENA = new Uint8Array(256); C.LUZ = new Uint8Array(256);
    C.FORMA = new Uint8Array(256); C.CAPA = new Uint8Array(256); C.SOLIDO = new Uint8Array(256);
    for (var i = 0; i < 256; i++) {
      var q = C.bloques[i];
      C.OPACO[i] = q.opaco; C.FRENA[i] = q.frena; C.LUZ[i] = q.luz; C.FORMA[i] = q.forma; C.CAPA[i] = q.capa;
      // con qué se choca el jugador
      C.SOLIDO[i] = (q.forma === F.nada || q.forma === F.cruz || q.forma === F.liquido || q.forma === F.antorcha ||
        q.forma === F.surcos || q.forma === F.riel || q.forma === F.pared || q.forma === F.fuego ||
        q.forma === F.planta2 || q.forma === F.tallo || i === 90 || i === 30) ? 0 : 1;
    }
  };

  // ------------------------------------------------------------------------------------------
  // Ruido simplex (Stefan Gustavson, dominio público), con semilla
  // ------------------------------------------------------------------------------------------
  var G3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
  function Ruido(semilla) {
    var p = new Uint8Array(256), i;
    for (i = 0; i < 256; i++) p[i] = i;
    var s = semilla >>> 0 || 1;
    for (i = 255; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      var j = s % (i + 1), t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    this.mod12 = new Uint8Array(512);
    for (i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.mod12[i] = this.perm[i] % 12; }
  }
  var F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1 / 3, G3c = 1 / 6;
  Ruido.prototype.n2 = function (xin, yin) {
    var perm = this.perm, m12 = this.mod12;
    var s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s);
    var t = (i + j) * G2, x0 = xin - (i - t), y0 = yin - (j - t);
    var i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    var ii = i & 255, jj = j & 255, n = 0, t0, g;
    t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { g = m12[ii + perm[jj]] * 3; t0 *= t0; n += t0 * t0 * (G3[g] * x0 + G3[g + 1] * y0); }
    t0 = 0.5 - x1 * x1 - y1 * y1;
    if (t0 > 0) { g = m12[ii + i1 + perm[jj + j1]] * 3; t0 *= t0; n += t0 * t0 * (G3[g] * x1 + G3[g + 1] * y1); }
    t0 = 0.5 - x2 * x2 - y2 * y2;
    if (t0 > 0) { g = m12[ii + 1 + perm[jj + 1]] * 3; t0 *= t0; n += t0 * t0 * (G3[g] * x2 + G3[g + 1] * y2); }
    return 70 * n;
  };
  Ruido.prototype.n3 = function (xin, yin, zin) {
    var perm = this.perm, m12 = this.mod12;
    var s = (xin + yin + zin) * F3, i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    var t = (i + j + k) * G3c, x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    var i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    var x1 = x0 - i1 + G3c, y1 = y0 - j1 + G3c, z1 = z0 - k1 + G3c;
    var x2 = x0 - i2 + 2 * G3c, y2 = y0 - j2 + 2 * G3c, z2 = z0 - k2 + 2 * G3c;
    var x3 = x0 - 1 + 3 * G3c, y3 = y0 - 1 + 3 * G3c, z3 = z0 - 1 + 3 * G3c;
    var ii = i & 255, jj = j & 255, kk = k & 255, n = 0, t0, g;
    t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) { g = m12[ii + perm[jj + perm[kk]]] * 3; t0 *= t0; n += t0 * t0 * (G3[g] * x0 + G3[g + 1] * y0 + G3[g + 2] * z0); }
    t0 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t0 > 0) { g = m12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; t0 *= t0; n += t0 * t0 * (G3[g] * x1 + G3[g + 1] * y1 + G3[g + 2] * z1); }
    t0 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t0 > 0) { g = m12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; t0 *= t0; n += t0 * t0 * (G3[g] * x2 + G3[g + 1] * y2 + G3[g + 2] * z2); }
    t0 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t0 > 0) { g = m12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; t0 *= t0; n += t0 * t0 * (G3[g] * x3 + G3[g + 1] * y3 + G3[g + 2] * z3); }
    return 32 * n;
  };
  // varias octavas
  Ruido.prototype.oct2 = function (x, y, oct, pers) {
    var s = 0, a = 1, f = 1, m = 0;
    for (var o = 0; o < oct; o++) { s += a * this.n2(x * f, y * f); m += a; a *= pers; f *= 2; }
    return s / m;
  };
  C.Ruido = Ruido;

  // azar determinista para una posición (mezcla de enteros)
  C.hash = function (semilla, x, z, k) {
    var h = (semilla ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1) ^ Math.imul(k | 0, 0x9e3779b9)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
    return (h ^ (h >>> 15)) >>> 0;
  };
  // generador de números (mulberry32) con estado propio
  C.Azar = function (s) { this.s = s >>> 0; };
  C.Azar.prototype.sig = function () {
    var t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  C.Azar.prototype.ent = function (n) { return Math.floor(this.sig() * n); };

  C.clave = function (cx, cz) { return cx + ',' + cz; };
})();
