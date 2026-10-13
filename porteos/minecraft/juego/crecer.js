// porteo: lo que el mundo hace solo (corre en el trabajador, que tiene los bloques). En cada paso
// (1/20 s), en los trozos a 4 o menos del jugador, 3 bloques al azar de cada sub-trozo de 16³ reciben
// su "paso al azar" (randomTick) con las cuentas del juego: los cultivos y los tallos crecen según la
// luz y la tierra de cultivo de alrededor (BlockCrops.getGrowthChance), los retoños se hacen árboles
// (los del generador), el pasto y el micelio se extienden o se mueren a la sombra, la tierra de
// cultivo se seca lejos del agua, los cactus y las cañas suben hasta 3, la verruga del Nether y el
// cacao maduran, la nieve y el hielo se derriten con luz fuerte. El fuego tiene sus propios pasos
// (BlockFire.updateTick: envejece, se apaga, quema lo inflamable y salta a lo que está cerca) y las
// hojas, cuando se rompe un tronco o una hoja, se fijan si les queda un tronco a 4 o menos y si no se
// caen.
var Crecer = (function () {
  'use strict';
  var K = {};
  var A = null;      // lo que da el trabajador: id, meta, luz, luzBloque, poner, soltar, opaco, solido, llueve, explotar
  K.iniciar = function (api) { A = api; };
  function rnd(n) { return Math.floor(Math.random() * n); }

  // ------------------------------------------------------------------------------------------
  // Los pasos al azar
  // ------------------------------------------------------------------------------------------
  var CULTIVO = { 59: 1, 141: 1, 142: 1, 244: 1 }, TALLO = { 104: 86, 105: 103 };
  // ¿hay agua a 4 bloques (a la misma altura o uno arriba)? (BlockFarmland.hasWater)
  function aguaCerca(x, y, z) {
    for (var dx = -4; dx <= 4; dx++) for (var dz = -4; dz <= 4; dz++) for (var dy = 0; dy <= 1; dy++) {
      var b = A.id(x + dx, y + dy, z + dz);
      if (b === 8 || b === 9) return true;
    }
    return false;
  }
  // BlockCrops.getGrowthChance: la tierra de cultivo de abajo (mojada vale 3, seca 1; las de los
  // costados un cuarto) y la mitad si hay del mismo cultivo en fila por los dos lados o en diagonal
  function chanceCrecer(x, y, z, id) {
    var f = 1;
    for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) {
      var f1 = 0;
      if (A.id(x + i, y - 1, z + j) === 60) { f1 = 1; if (A.meta(x + i, y - 1, z + j) > 0) f1 = 3; }
      if (i !== 0 || j !== 0) f1 /= 4;
      f += f1;
    }
    var o = A.id(x - 1, y, z) === id || A.id(x + 1, y, z) === id, n = A.id(x, y, z - 1) === id || A.id(x, y, z + 1) === id;
    if (o && n) f /= 2;
    else if (A.id(x - 1, y, z - 1) === id || A.id(x + 1, y, z - 1) === id || A.id(x + 1, y, z + 1) === id || A.id(x - 1, y, z + 1) === id) f /= 2;
    return f;
  }
  function crecerCultivo(x, y, z, id, m) {
    if (m >= 7 || A.luz(x, y + 1, z) < 9) return;
    if (rnd(Math.floor(25 / chanceCrecer(x, y, z, id)) + 1) === 0) A.poner(x, y, z, id, m + 1);
  }
  // los tallos: crecen igual y maduros ponen su calabaza o melón al costado (sobre tierra o pasto)
  var DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1];
  function crecerTallo(x, y, z, id, m) {
    if (A.luz(x, y + 1, z) < 9) return;
    if (rnd(Math.floor(25 / chanceCrecer(x, y, z, id)) + 1) !== 0) return;
    if (m < 7) { A.poner(x, y, z, id, m + 1); return; }
    var fruto = TALLO[id];
    for (var k = 0; k < 4; k++) if (A.id(x + DX[k], y, z + DZ[k]) === fruto) return;
    var d = rnd(4), bx = x + DX[d], bz = z + DZ[d], abajo = A.id(bx, y - 1, bz);
    if (A.id(bx, y, bz) === 0 && (abajo === 60 || abajo === 3 || abajo === 2)) A.poner(bx, y, bz, fruto, 0);
  }
  // los retoños: con luz, 1 en 7 pasos avanzan; la segunda vez, árbol (el roble oscuro necesita 4 en
  // cuadrado; los demás crecen solos)
  var TIPO_ARBOL = ['roble', 'abeto', 'abedul', 'jungla', 'acacia', 'oscuro'];
  K.arbol = function (x, y, z, m) {
    var tipo = TIPO_ARBOL[m & 7] || 'roble', bx = x, bz = z;
    if (tipo === 'oscuro') {
      // la esquina de un cuadrado de 2×2 de retoños de roble oscuro que incluya a éste
      var hallado = false;
      for (var ox = -1; ox <= 0 && !hallado; ox++) for (var oz = -1; oz <= 0 && !hallado; oz++) {
        var ok = true;
        for (var i = 0; i <= 1 && ok; i++) for (var j = 0; j <= 1 && ok; j++) ok = A.id(x + ox + i, y, z + oz + j) === 6 && (A.meta(x + ox + i, y, z + oz + j) & 7) === 5;
        if (ok) { hallado = true; bx = x + ox; bz = z + oz; }
      }
      if (!hallado) return false;
    }
    // lugar para el tronco (6 arriba sin nada firme)
    for (var k = 1; k <= 6; k++) { var b = A.id(bx, y + k, bz); if (b < 0 || (b !== 0 && b !== 18 && b !== 161 && b !== 31 && b !== 78 && b !== 106)) return false; }
    if (tipo === 'oscuro') for (i = 0; i <= 1; i++) for (j = 0; j <= 1; j++) A.poner(bx + i, y, bz + j, 0, 0);
    else A.poner(x, y, z, 0, 0);
    function poner(px, py, pz, id, pm, soloAire) {
      var a = A.id(px, py, pz);
      if (a < 0 || py < 1 || py >= C.ALTO) return;
      if (soloAire) { if (a !== 0 && a !== 31 && a !== 78 && a !== 37 && a !== 38 && a !== 106) return; }
      else if (a !== 0 && a !== 18 && a !== 161 && a !== 6 && a !== 31 && a !== 78 && a !== 2 && a !== 3 && a !== 37 && a !== 38 && a !== 243 && a !== 106) return;
      A.poner(px, py, pz, id, pm);
    }
    function hojas(px, py, pz, pm, id) { poner(px, py, pz, id || 18, pm, true); }
    Gen.trazarArbol({ x: bx, y: y, z: bz, tipo: tipo, s: (Math.random() * 2147483647) | 0 }, poner, hojas);
    return true;
  };
  function crecerRetono(x, y, z, m) {
    if (A.luz(x, y + 1, z) < 9 || rnd(7) !== 0) return;
    if (!(m & 8)) A.poner(x, y, z, 6, m | 8);
    else K.arbol(x, y, z, m);
  }
  // el pasto (y el micelio): a la sombra se vuelve tierra; con luz se pasa a la tierra de alrededor
  function crecerPasto(x, y, z, id) {
    var arriba = A.id(x, y + 1, z), luz = A.luz(x, y + 1, z);
    if (luz < 4 && A.frena(arriba) > 2) { A.poner(x, y, z, 3, 0); return; }
    if (luz < 9) return;
    for (var k = 0; k < 4; k++) {
      var bx = x + rnd(3) - 1, by = y + rnd(5) - 3, bz = z + rnd(3) - 1;
      if (A.id(bx, by, bz) !== 3 || A.meta(bx, by, bz) !== 0) continue;
      var a = A.id(bx, by + 1, bz);
      if (A.luz(bx, by + 1, bz) >= 4 && A.frena(a) <= 2 && !(a === 8 || a === 9 || a === 10 || a === 11)) A.poner(bx, by, bz, id, 0);
    }
  }
  // la tierra de cultivo: mojada cerca del agua (o con lluvia); seca y sin nada arriba, tierra
  function pasoCultivo(x, y, z, m) {
    if (aguaCerca(x, y, z) || A.llueve(x, y + 1, z)) { if (m < 7) A.poner(x, y, z, 60, 7); return; }
    if (m > 0) { A.poner(x, y, z, 60, m - 1); return; }
    var a = A.id(x, y + 1, z);
    if (!CULTIVO[a] && !TALLO[a]) A.poner(x, y, z, 3, 0);
  }
  // el cactus y la caña: hasta 3 de alto, un bloque cada 16 pasos al azar
  function crecerAlto(x, y, z, id, m) {
    if (A.id(x, y + 1, z) !== 0) return;
    var alto = 1;
    while (A.id(x, y - alto, z) === id) alto++;
    if (alto >= 3) return;
    if (m >= 15) { A.poner(x, y + 1, z, id, 0); A.poner(x, y, z, id, 0); }
    else A.poner(x, y, z, id, m + 1);
  }
  K.pasoAzar = function (x, y, z) {
    var id = A.id(x, y, z);
    if (id <= 0) return;
    var m;
    switch (id) {
      case 59: case 141: case 142: case 244: crecerCultivo(x, y, z, id, A.meta(x, y, z)); return;
      case 104: case 105: crecerTallo(x, y, z, id, A.meta(x, y, z)); return;
      case 6: crecerRetono(x, y, z, A.meta(x, y, z)); return;
      case 2: case 110: crecerPasto(x, y, z, id); return;
      case 60: pasoCultivo(x, y, z, A.meta(x, y, z)); return;
      case 81: case 83: crecerAlto(x, y, z, id, A.meta(x, y, z)); return;
      case 115: m = A.meta(x, y, z); if (m < 3 && rnd(10) === 0) A.poner(x, y, z, 115, m + 1); return;
      case 127: m = A.meta(x, y, z); if ((m >> 2) < 2 && rnd(5) === 0) A.poner(x, y, z, 127, m + 4); return;
      // la nieve fina y el hielo se derriten con luz de bloques fuerte (antorchas)
      case 78: if (A.luzBloque(x, y, z) > 11) { A.soltar(x, y, z, 78, A.meta(x, y, z)); A.poner(x, y, z, 0, 0); } return;
      case 79: if (A.luzBloque(x, y + 1, z) > 11) A.poner(x, y, z, 9, 0); return;
      case 51: if (!fuego.has(clave(x, y, z))) K.agendarFuego(x, y, z); return;
    }
  };

  // ------------------------------------------------------------------------------------------
  // El fuego
  // ------------------------------------------------------------------------------------------
  // [lo que anima al fuego a saltar al lado, lo que tarda en quemarse] (Blocks.FIRE.setFireInfo)
  var INFLAMABLE = {};
  function fi(ids, ani, que) { ids.forEach(function (i) { INFLAMABLE[i] = [ani, que]; }); }
  fi([5, 157, 158, 85, 107, 183, 184, 185, 186, 187, 53, 134, 135, 136, 163, 164], 5, 20);
  fi([17, 162], 5, 5); fi([18, 161], 30, 60); fi([47], 30, 20); fi([46], 15, 100);
  fi([31, 175, 37, 38, 32], 60, 100); fi([35], 30, 60); fi([106], 15, 100); fi([173], 5, 5); fi([170, 171], 60, 20);
  function animo(id) { return INFLAMABLE[id] ? INFLAMABLE[id][0] : 0; }
  function quema(id) { return INFLAMABLE[id] ? INFLAMABLE[id][1] : 0; }
  var fuego = new Map();     // clave → paso en que le toca
  var paso = 0;
  // (x y z hasta ±1 millón: entra justo en los 53 bits de un número; con más, alturas distintas
  // darían la misma clave)
  function clave(x, y, z) { return ((x + 1048576) * 2097152 + (z + 1048576)) * 128 + y; }
  K.agendarFuego = function (x, y, z, demora) { fuego.set(clave(x, y, z), { x: x, y: y, z: z, t: paso + (demora === undefined ? 30 + rnd(10) : demora) }); };
  var V6 = [[1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
  function vecinoInflamable(x, y, z) {
    for (var k = 0; k < 6; k++) if (animo(A.id(x + V6[k][0], y + V6[k][1], z + V6[k][2])) > 0) return true;
    return false;
  }
  function animoVecinos(x, y, z) {
    if (A.id(x, y, z) !== 0) return 0;
    var n = 0;
    for (var k = 0; k < 6; k++) n = Math.max(n, animo(A.id(x + V6[k][0], y + V6[k][1], z + V6[k][2])));
    return n;
  }
  function intentarQuemar(x, y, z, chance, edad) {
    var b = A.id(x, y, z);
    if (rnd(chance) >= quema(b)) return;
    if (rnd(edad + 10) < 5 && !A.llueve(x, y, z)) { A.poner(x, y, z, 51, Math.min(15, edad + (rnd(5) >> 2))); K.agendarFuego(x, y, z); }
    else A.poner(x, y, z, 0, 0);
    if (b === 46) A.explotar(x, y, z);
  }
  function pasoFuego(x, y, z) {
    if (A.id(x, y, z) !== 51) return;
    var abajo = A.id(x, y - 1, z), eterno = abajo === 87 || abajo === 213;
    if (!A.solido(abajo) && !vecinoInflamable(x, y, z)) { A.poner(x, y, z, 0, 0); return; }
    var edad = A.meta(x, y, z) & 15;
    if (!eterno && A.llueve(x, y, z) && Math.random() < 0.2 + edad * 0.03) { A.poner(x, y, z, 0, 0); return; }
    if (edad < 15) { var e2 = Math.min(15, edad + (rnd(3) >> 1)); if (e2 !== edad) A.poner(x, y, z, 51, e2); }
    K.agendarFuego(x, y, z);
    if (!eterno) {
      if (!vecinoInflamable(x, y, z)) { if (!A.solido(abajo) || edad > 3) A.poner(x, y, z, 0, 0); return; }
      if (!quema(abajo) && edad === 15 && rnd(4) === 0) { A.poner(x, y, z, 0, 0); return; }
    }
    intentarQuemar(x + 1, y, z, 300, edad); intentarQuemar(x - 1, y, z, 300, edad);
    intentarQuemar(x, y - 1, z, 250, edad); intentarQuemar(x, y + 1, z, 250, edad);
    intentarQuemar(x, y, z - 1, 300, edad); intentarQuemar(x, y, z + 1, 300, edad);
    for (var i = -1; i <= 1; i++) for (var k = -1; k <= 1; k++) for (var j = -1; j <= 4; j++) {
      if (!i && !j && !k) continue;
      var c = 100 + (j > 1 ? (j - 1) * 100 : 0), an = animoVecinos(x + i, y + j, z + k);
      if (an <= 0) continue;
      var l = Math.floor((an + 40 + A.dificultad() * 7) / (edad + 30));
      if (l > 0 && rnd(c) <= l && !A.llueve(x + i, y + j, z + k)) {
        A.poner(x + i, y + j, z + k, 51, Math.min(15, edad + (rnd(5) >> 2)));
        K.agendarFuego(x + i, y + j, z + k);
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  // Las hojas que se quedan sin tronco (BlockLeaves.updateTick: el tronco a 4 o menos, por hojas)
  // ------------------------------------------------------------------------------------------
  var hojas = new Map();
  function esHoja(b) { return b === 18 || b === 161; }
  function esTronco(b) { return b === 17 || b === 162; }
  K.revisarHojas = function (x, y, z) {
    for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) for (var dz = -4; dz <= 4; dz++) {
      var px = x + dx, py = y + dy, pz = z + dz;
      if (esHoja(A.id(px, py, pz))) hojas.set(clave(px, py, pz), { x: px, y: py, z: pz, t: paso + 4 + rnd(80) });
    }
  };
  function conTronco(x, y, z) {
    // una búsqueda a lo ancho por hojas, hasta 4 pasos
    var vistos = new Set([clave(x, y, z)]), frente = [[x, y, z]];
    for (var d = 0; d < 4 && frente.length; d++) {
      var sig = [];
      for (var q = 0; q < frente.length; q++) for (var k = 0; k < 6; k++) {
        var nx = frente[q][0] + V6[k][0], ny = frente[q][1] + V6[k][1], nz = frente[q][2] + V6[k][2], b = A.id(nx, ny, nz);
        if (b < 0 || esTronco(b)) return true;
        var c = clave(nx, ny, nz);
        if (vistos.has(c) || !esHoja(b)) continue;
        vistos.add(c); sig.push([nx, ny, nz]);
      }
      frente = sig;
    }
    return false;
  }
  function pasoHoja(x, y, z) {
    var b = A.id(x, y, z);
    if (!esHoja(b) || conTronco(x, y, z)) return;
    A.soltar(x, y, z, b, A.meta(x, y, z));
    A.poner(x, y, z, 0, 0);
  }

  // ------------------------------------------------------------------------------------------
  // Un paso: lo agendado (fuego, hojas) y los pasos al azar alrededor del jugador
  // ------------------------------------------------------------------------------------------
  K.paso = function (cx, cz, radio, trozoListo) {
    paso++;
    if (fuego.size) {
      var tocaF = [];
      fuego.forEach(function (f, k) { if (f.t <= paso) { tocaF.push(f); fuego.delete(k); } });
      for (var i = 0; i < tocaF.length; i++) pasoFuego(tocaF[i].x, tocaF[i].y, tocaF[i].z);
    }
    if (hojas.size) {
      var tocaH = [];
      hojas.forEach(function (h, k) { if (h.t <= paso && tocaH.length < 64) { tocaH.push(h); hojas.delete(k); } });
      for (var j = 0; j < tocaH.length; j++) pasoHoja(tocaH[j].x, tocaH[j].y, tocaH[j].z);
    }
    for (var tx = cx - radio; tx <= cx + radio; tx++) for (var tz = cz - radio; tz <= cz + radio; tz++) {
      if (!trozoListo(tx, tz)) continue;
      for (var sy = 0; sy < C.ALTO >> 4; sy++) for (var n = 0; n < 3; n++) {
        var r = (Math.random() * 4096) | 0;
        K.pasoAzar(tx * 16 + (r & 15), sy * 16 + (r >> 8), tz * 16 + ((r >> 4) & 15));
      }
    }
  };
  K.ocupado = function () { return fuego.size > 0 || hojas.size > 0; };
  return K;
})();
