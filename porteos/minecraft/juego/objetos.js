// porteo: los bloques (y los huevos de los bichos) como cosas que se eligen, se ponen y suenan: el
// nombre (de los textos del juego, en el idioma elegido), el material (qué sonido hace al pisarlo,
// romperlo o ponerlo: el "sound" de blocks.json de la 1.2), lo que hay en el inventario creativo por
// pestaña y el meta con el que queda al ponerlo (hacia dónde mira el jugador y qué cara tocó). Lo que
// no está en los datos del juego (está en libminecraftpe.so) va como lo hace Minecraft.
var Objetos = (function () {
  'use strict';
  var O = {};
  var COLORES = ['white', 'orange', 'magenta', 'lightBlue', 'yellow', 'lime', 'pink', 'gray', 'silver', 'cyan', 'purple',
    'blue', 'brown', 'green', 'red', 'black'];
  // el vidrio teñido de la 1.2 escribe "light_blue"
  var COLORES2 = COLORES.map(function (c) { return c === 'lightBlue' ? 'light_blue' : c; });
  var MADERAS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'big_oak'];
  var LOSAS = ['stone', 'sand', 'wood', 'cobble', 'brick', 'smoothStoneBrick', 'quartz', 'nether_brick'];
  // las variantes por meta (las claves de los textos: tile.<nombre>.<variante>.name)
  var VARIANTES = {
    1: ['stone', 'granite', 'graniteSmooth', 'diorite', 'dioriteSmooth', 'andesite', 'andesiteSmooth'],
    3: ['default', 'coarse'], 5: MADERAS, 6: MADERAS, 12: ['default', 'red'], 17: MADERAS.slice(0, 4),
    18: MADERAS.slice(0, 4), 24: ['default', 'chiseled', 'smooth'], 31: ['shrub', 'grass', 'fern'], 35: COLORES,
    37: ['dandelion'], 38: ['poppy', 'blueOrchid', 'allium', 'houstonia', 'tulipRed', 'tulipOrange', 'tulipWhite',
      'tulipPink', 'oxeyeDaisy'], 43: LOSAS, 44: LOSAS,
    97: ['stone', 'cobble', 'brick', 'mossybrick', 'crackedbrick', 'chiseledbrick'],
    98: ['default', 'mossy', 'cracked', 'chiseled'], 139: ['normal', 'mossy'], 155: ['default', 'chiseled', 'lines'],
    157: MADERAS, 158: MADERAS, 159: COLORES, 161: ['acacia', 'big_oak'], 162: ['acacia', 'big_oak'], 171: COLORES,
    175: ['sunflower', 'syringa', 'grass', 'fern', 'rose', 'paeonia'], 179: ['default', 'chiseled', 'smooth'],
    181: ['red_sandstone', 'purpur'], 182: ['red_sandstone', 'purpur'], 236: COLORES, 241: COLORES2, 160: COLORES,
    168: ['rough', 'dark', 'bricks'], 201: ['default', 'chiseled', 'lines']
  };

  O.nombre = function (id, m) {
    var T = Interfaz.textos;
    var hv = HUEVOS[m];
    if (id === HUEVO && hv) return T['item.spawn_egg.entity.' + hv[0] + '.name'] || hv[0];
    var b = C.bloques[id];
    if (!b) return '';
    var n = b.nombre, v = VARIANTES[id] && VARIANTES[id][m];
    var g = /^(.*)_glazed_terracotta$/.exec(n);
    if (g) return T['tile.glazedTerracotta.' + g[1] + '.name'] || n;
    var t = (v && T['tile.' + n + '.' + v + '.name']) || T['tile.' + n + '.name'];
    if (t) return t;
    return n.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  };

  // ------------------------------------------------------------------------------------------
  // Los huevos de los bichos (en el inventario creativo, como la 1.2): tocar un bloque con uno hace
  // aparecer al bicho. El número del huevo es el del objeto en el juego; el meta, el del bicho, y
  // sus dos colores (fondo y manchas) los de cada huevo del juego
  // ------------------------------------------------------------------------------------------
  var HUEVO = O.HUEVO = 383;
  var HUEVOS = O.HUEVOS = {
    12: ['pig', 0xf0a5a2, 0xdb635f], 11: ['cow', 0x443626, 0xa1a1a1], 13: ['sheep', 0xe7e7e7, 0xffb5b5],
    10: ['chicken', 0xa1a1a1, 0xff0000], 32: ['zombie', 0x00afaf, 0x799c65], 34: ['skeleton', 0xc1c1c1, 0x494949],
    33: ['creeper', 0x0da70b, 0x000000], 35: ['spider', 0x342d27, 0xa80e0e]
  };
  O.esHuevo = function (it) { return !!it && it.id === HUEVO; };
  O.bichoDe = function (it) { return it && it.id === HUEVO && HUEVOS[it.m] ? HUEVOS[it.m][0] : null; };

  // ------------------------------------------------------------------------------------------
  // Materiales (el "sound type" de cada bloque): dig.<x> al romper y poner, step.<x> al pisar
  // ------------------------------------------------------------------------------------------
  // el "sound" de blocks.json de la 1.2 (los que no lo traen, como Minecraft)
  var MATERIAL = new Array(256).fill('stone'), SONIDO_JSON = { anvil: 'metal', itemframe: 'wood' };
  function mat(nombre, ids) { ids.forEach(function (i) { MATERIAL[i] = nombre; }); }
  mat('grass', [6, 31, 32, 37, 38, 39, 40, 59, 83, 106, 111, 175, 141, 142, 244, 115, 104, 105, 30]);
  mat('liquid', [8, 9, 10, 11]);
  O.prepararMateriales = function () {
    for (var i = 0; i < 256; i++) {
      var s = C.bloques[i] && C.bloques[i].sonido;
      if (s) MATERIAL[i] = SONIDO_JSON[s] || s;
    }
  };
  O.material = function (id) { return MATERIAL[id] || 'stone'; };
  // qué suena: [evento, volumen, tono]
  O.sonidoRomper = function (id) {
    var m = MATERIAL[id];
    if (m === 'glass') return ['random.glass', 1, 1];
    if (m === 'metal') return ['dig.stone', 1, 1.5];
    if (m === 'ladder') return ['dig.wood', 1, 1];
    if (m === 'slime') return ['dig.grass', 1, 1];
    if (m === 'liquid') return null;
    return ['dig.' + m, 1, 0.8];
  };
  O.sonidoPoner = function (id) {
    var m = MATERIAL[id];
    if (m === 'glass') return ['dig.stone', 1, 0.8];
    if (m === 'metal') return ['dig.stone', 1, 1.2];
    if (m === 'ladder') return ['dig.wood', 1, 0.8];
    if (m === 'slime') return ['dig.grass', 1, 0.8];
    if (m === 'liquid') return id === 10 || id === 11 ? ['liquid.lavapop', 0.6, 1] : ['random.splash', 0.3, 1.2];
    return ['dig.' + m, 1, 0.8];
  };
  O.sonidoPaso = function (id) {
    var m = MATERIAL[id];
    if (m === 'glass' || m === 'metal') return ['step.stone', 0.15, m === 'metal' ? 1.5 : 1];
    if (m === 'liquid') return null;
    return ['step.' + m, 0.15, 1];
  };

  // ------------------------------------------------------------------------------------------
  // El inventario creativo, en cuatro pestañas como el juego de bolsillo
  // ------------------------------------------------------------------------------------------
  function rango(id, n, desde) { var l = []; for (var i = desde || 0; i < n; i++) l.push([id, i]); return l; }
  var PESTANAS = [
    // construcción
    [[4], [48]].concat(rango(1, 7), rango(5, 6), [[45]], rango(98, 4), rango(24, 3), rango(179, 3), rango(155, 3),
      rango(168, 3), [[169]], rango(201, 3), [[206], [215], [214], [216], [213], [170]],
      [[112], [121], [87], [49]], [[44, 0], [44, 1], [44, 3], [44, 4], [44, 5], [44, 6], [44, 7]], rango(158, 6), [[182, 0], [182, 1]],
      [[67], [53], [134], [135], [136], [163], [164], [108], [109], [114], [128], [180], [156], [203]],
      rango(139, 2), rango(85, 6), [[113], [107], [183], [184], [185], [186], [187]],
      [[41], [42], [57], [133], [22], [173], [152]], [[172]], rango(159, 16), rango(236, 16), rango(35, 16),
      [[220], [221], [222], [223], [224], [225], [226], [227], [228], [229], [219], [231], [232], [233], [234], [235]],
      [[20], [102]], rango(241, 16), rango(160, 16), [[101], [89], [174], [79]]),
    // naturaleza
    [[2], [3, 0], [3, 1], [243], [110], [198], [12, 0], [12, 1], [13], [82]].concat(rango(17, 4), rango(162, 2),
      rango(18, 4), rango(161, 2), rango(6, 6), [[31, 1], [31, 2], [32], [37]], rango(38, 9), rango(175, 6),
      [[39], [40], [99], [100], [81], [83], [86], [103], [106], [111], [30]],
      [[80], [78], [16], [15], [14], [56], [21], [73], [129], [153], [88], [9], [11], [7]]),
    // objetos: decoración, mecanismos y los huevos de los bichos
    [[50], [76], [208], [65], [64], [193], [194], [195], [196], [197], [71], [96], [167]].concat(rango(171, 16),
      [[47], [58], [61], [54], [146], [116], [145], [123], [91], [26], [46], [66], [27], [28], [126], [25], [23], [125],
      [52], [19], [165], [246], [247], [245], [92]],
      [[HUEVO, 12], [HUEVO, 11], [HUEVO, 13], [HUEVO, 10], [HUEVO, 32], [HUEVO, 34], [HUEVO, 33], [HUEVO, 35]])
  ];
  // lo que el motor sabe dibujar y existe en el juego
  O.creativo = function () {
    var lista = [];
    PESTANAS.forEach(function (p, tab) {
      p.forEach(function (e) {
        var id = e[0], m = e[1] || 0;
        if (id === HUEVO) { var h = HUEVOS[m]; if (h && Modelos.existe(h[0])) lista.push({ id: id, m: m, tab: tab, huevo: [h[1], h[2]] }); return; }
        var b = C.bloques[id];
        if (!b || !b.existe || b.forma === C.F.nada) return;
        lista.push({ id: id, m: m, tab: tab });
      });
    });
    return lista;
  };
  // la barra rápida de un mundo nuevo (como la de MCPE en creativo)
  O.barraInicial = function () {
    return [{ id: 4, m: 0 }, { id: 5, m: 0 }, { id: 3, m: 0 }, { id: 2, m: 0 }, { id: 17, m: 0 }, { id: 20, m: 0 },
      { id: 50, m: 0 }, { id: 98, m: 0 }, { id: 45, m: 0 }];
  };

  // ------------------------------------------------------------------------------------------
  // Poner: el meta según la cara tocada (nx, ny, nz), la altura del toque en esa cara (fy, 0 a 1) y
  // hacia dónde mira el jugador. Devuelve [[dx, dy, dz, id, meta], ...] (las celdas que ocupa, la
  // primera es la tocada + la normal) o null si ahí no va
  // ------------------------------------------------------------------------------------------
  function rumbo(yaw) {
    // 0 este, 1 sur, 2 oeste, 3 norte (como las puertas del juego)
    var fx = Math.sin(yaw), fz = -Math.cos(yaw);
    if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 0 : 2;
    return fz > 0 ? 1 : 3;
  }
  O.rumbo = rumbo;
  O.alPoner = function (id, m, nx, ny, nz, fy, yaw) {
    var F = C.F, f = C.FORMA[id], r = rumbo(yaw), arriba = ny === -1 || (ny === 0 && fy > 0.5);
    if (id === 17 || id === 162) return [[0, 0, 0, id, (m & 3) | (ny ? 0 : nx ? 4 : 8)]];
    if (f === F.escalera) return [[0, 0, 0, id, [0, 2, 1, 3][r] | (arriba ? 4 : 0)]];
    if (id === 44 || id === 158 || id === 182) return [[0, 0, 0, id, (m & 7) | (arriba ? 8 : 0)]];
    if (f === F.antorcha) {
      if (ny === -1) return null;
      return [[0, 0, 0, id, ny === 1 ? 5 : nx === 1 ? 1 : nx === -1 ? 2 : nz === 1 ? 3 : 4]];
    }
    if (id === 65) {
      if (ny) return null;
      return [[0, 0, 0, id, nz === -1 ? 2 : nz === 1 ? 3 : nx === -1 ? 4 : 5]];
    }
    if (id === 106) {
      if (ny) return null;
      return [[0, 0, 0, id, nz === 1 ? 4 : nz === -1 ? 1 : nx === 1 ? 2 : 8]];
    }
    if (f === F.trampilla) {
      var d = nz === -1 ? 0 : nz === 1 ? 1 : nx === -1 ? 2 : nx === 1 ? 3 : [2, 0, 3, 1][r];
      return [[0, 0, 0, id, d | (arriba ? 8 : 0)]];
    }
    if (f === F.puerta) {
      if (ny !== 1) return null;
      return [[0, 0, 0, id, r], [0, 1, 0, id, 8]];
    }
    if (id === 175) return [[0, 0, 0, id, m & 7], [0, 1, 0, id, 8]];
    if (id === 26) return [[0, 0, 0, id, r]];
    if (f === F.riel) return [[0, 0, 0, id, r === 0 || r === 2 ? 1 : 0]];
    return [[0, 0, 0, id, m]];
  };
  // ¿se puede poner algo en esta celda? (aire, líquido, pasto alto, fuego, capa de nieve)
  O.reemplazable = function (id) {
    return id === 0 || id === 8 || id === 9 || id === 10 || id === 11 || id === 31 || id === 51 || id === 78 || id === 32;
  };
  // las plantas necesitan tierra (o arena) debajo
  O.necesitaSuelo = function (id) {
    var f = C.FORMA[id], F = C.F;
    if (f === F.cruz || f === F.planta2 || f === F.tallo || f === F.surcos) return true;
    return id === 81 || id === 83;
  };
  O.sueloBueno = function (id, abajo) {
    if (id === 81 || id === 32) return abajo === 12 || abajo === 81 && id === 81;
    if (id === 83) return abajo === 2 || abajo === 3 || abajo === 12 || abajo === 83 || abajo === 243;
    if (id === 39 || id === 40) return C.OPACO[abajo] === 1;
    if (C.FORMA[id] === C.F.surcos) return abajo === 60 || abajo === 88;
    return abajo === 2 || abajo === 3 || abajo === 60 || abajo === 243 || abajo === 110;
  };
  // la losa doble que forman dos losas iguales
  O.losaDoble = { 44: 43, 158: 157, 182: 181 };
  return O;
})();
