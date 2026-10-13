// porteo: las recetas de la 1.2 (de la mesa y del inventario) y lo que hace el horno. El juego las
// tiene en código (Recipes, FurnaceRecipes): acá van escritas con sus números de bloques y objetos.
// Una receta con forma es un dibujo de hasta 3x3 (vale corrido y en espejo); una sin forma, una lista
// de cosas en cualquier lugar. La variante -1 es "cualquiera" (cualquier tabla, cualquier lana).
var Recetas = (function () {
  'use strict';
  var R = {}, lista = [];
  R.lista = lista;
  var CUALQUIERA = -1;
  // forma(['XXX', ' # ', ' # '], { X: [id, m], '#': [280] }, [id, m, n])
  function forma(filas, clave, salida) {
    var h = filas.length, w = 0, g = [];
    filas.forEach(function (f) { w = Math.max(w, f.length); });
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var ch = filas[y].charAt(x), k = ch && ch !== ' ' ? clave[ch] : null;
      g.push(k ? [k[0], k[1] === undefined ? 0 : k[1]] : null);
    }
    lista.push({ w: w, h: h, g: g, o: [salida[0], salida[1] || 0, salida[2] || 1] });
  }
  function sinForma(cosas, salida) {
    lista.push({ s: cosas.map(function (k) { return [k[0], k[1] === undefined ? 0 : k[1]]; }), o: [salida[0], salida[1] || 0, salida[2] || 1] });
  }
  var PALO = [280], TABLA = [5, CUALQUIERA], ADOQUIN = [4], HIERRO = [265], ORO = [266], DIAMANTE = [264], CUERDA = [287],
    REDSTONE = [331], LANA = [35, CUALQUIERA], VIDRIO = [20], CUARZO = [406], PAPEL = [339], CUERO = [334], OBSIDIANA = [49];
  var MADERAS = [0, 1, 2, 3, 4, 5];   // roble, abeto, abedul, jungla, acacia, roble oscuro

  // ------------------------------------------------------------------------------------------
  // Madera
  // ------------------------------------------------------------------------------------------
  [0, 1, 2, 3].forEach(function (t) { sinForma([[17, t]], [5, t, 4]); });
  sinForma([[162, 0]], [5, 4, 4]); sinForma([[162, 1]], [5, 5, 4]);
  forma(['#', '#'], { '#': TABLA }, [280, 0, 4]);
  forma(['##', '##'], { '#': TABLA }, [58]);
  forma(['###', '# #', '###'], { '#': TABLA }, [54]);
  forma(['| |', '|||', '| |'], { '|': PALO }, [65, 0, 3]);
  var ESCALERAS = [53, 134, 135, 136, 163, 164], PUERTAS = [324, 427, 428, 429, 430, 431], PORTONES = [107, 183, 184, 185, 187, 186];
  MADERAS.forEach(function (t) {
    forma(['#  ', '## ', '###'], { '#': [5, t] }, [ESCALERAS[t], 0, 4]);
    forma(['###'], { '#': [5, t] }, [158, t, 6]);
    forma(['##', '##', '##'], { '#': [5, t] }, [PUERTAS[t], 0, 3]);
    forma(['#|#', '#|#'], { '#': [5, t], '|': PALO }, [85, t, 3]);
    forma(['|#|', '|#|'], { '#': [5, t], '|': PALO }, [PORTONES[t]]);
    forma(['# #', '###'], { '#': [5, t] }, [333, t]);
  });
  forma(['###', '###'], { '#': TABLA }, [96, 0, 2]);
  forma(['###', '###', ' | '], { '#': TABLA, '|': PALO }, [323, 0, 3]);
  forma(['# #', ' # '], { '#': TABLA }, [281, 0, 4]);
  forma(['###', 'XXX', '###'], { '#': TABLA, X: [340] }, [47]);
  forma(['###', '#D#', '###'], { '#': TABLA, D: DIAMANTE }, [84]);
  forma(['###', '#R#', '###'], { '#': TABLA, R: REDSTONE }, [25]);
  forma(['##'], { '#': TABLA }, [72]);
  sinForma([TABLA], [143]);
  forma(['GGG', 'QQQ', 'SSS'], { G: VIDRIO, Q: CUARZO, S: [158, CUALQUIERA] }, [151]);
  // las camas: tres lanas del mismo color y tres tablas (la cama sale de ese color)
  for (var c = 0; c < 16; c++) forma(['LLL', '###'], { L: [35, c], '#': TABLA }, [355, c]);

  // ------------------------------------------------------------------------------------------
  // Piedra y bloques de construcción
  // ------------------------------------------------------------------------------------------
  forma(['###', '# #', '###'], { '#': ADOQUIN }, [61]);
  forma(['##', '##'], { '#': [1] }, [98, 0, 4]);
  forma(['###'], { '#': [1] }, [44, 0, 6]);
  forma(['###'], { '#': [24, CUALQUIERA] }, [44, 1, 6]);
  forma(['###'], { '#': ADOQUIN }, [44, 3, 6]);
  forma(['###'], { '#': [45] }, [44, 4, 6]);
  forma(['###'], { '#': [98, CUALQUIERA] }, [44, 5, 6]);
  forma(['###'], { '#': [155, CUALQUIERA] }, [44, 6, 6]);
  forma(['###'], { '#': [112] }, [44, 7, 6]);
  forma(['###'], { '#': [179, CUALQUIERA] }, [182, 0, 6]);
  forma(['###'], { '#': [201, CUALQUIERA] }, [182, 1, 6]);
  [[67, ADOQUIN], [108, [45]], [109, [98, CUALQUIERA]], [114, [112]], [128, [24, CUALQUIERA]], [180, [179, CUALQUIERA]],
    [156, [155, CUALQUIERA]], [203, [201, CUALQUIERA]]].forEach(function (e) {
    forma(['#  ', '## ', '###'], { '#': e[1] }, [e[0], 0, 4]);
  });
  forma(['###', '###'], { '#': ADOQUIN }, [139, 0, 6]);
  forma(['###', '###'], { '#': [48] }, [139, 1, 6]);
  forma(['###', '###'], { '#': [112] }, [113, 0, 6]);
  forma(['##', '##'], { '#': [336] }, [45]);
  forma(['##', '##'], { '#': [405] }, [112]);
  forma(['NW', 'WN'], { N: [405], W: [372] }, [215]);
  forma(['##', '##'], { '#': [12, 0] }, [24, 0]);
  forma(['##', '##'], { '#': [24, 0] }, [24, 2, 4]);
  forma(['#', '#'], { '#': [44, 1] }, [24, 1]);
  forma(['##', '##'], { '#': [12, 1] }, [179, 0]);
  forma(['##', '##'], { '#': [179, 0] }, [179, 2, 4]);
  forma(['#', '#'], { '#': [182, 0] }, [179, 1]);
  forma(['#', '#'], { '#': [44, 5] }, [98, 3]);
  sinForma([[98, 0], [106]], [98, 1]);
  sinForma([ADOQUIN, [106]], [48]);
  forma(['##', '##'], { '#': CUARZO }, [155, 0]);
  forma(['#', '#'], { '#': [44, 6] }, [155, 1]);
  forma(['#', '#'], { '#': [155, 0] }, [155, 2, 2]);
  forma(['##', '##'], { '#': [433] }, [201, 0, 4]);
  forma(['#', '#'], { '#': [182, 1] }, [201, 2]);
  forma(['##', '##'], { '#': [121] }, [206, 0, 4]);
  forma(['R', 'P'], { R: [369], P: [433] }, [208, 0, 4]);
  // granito, diorita, andesita y sus pulidos; tierra ordinaria
  sinForma([[1, 3], CUARZO], [1, 1]);
  forma(['CQ', 'QC'], { C: ADOQUIN, Q: CUARZO }, [1, 3, 2]);
  sinForma([[1, 3], ADOQUIN], [1, 5, 2]);
  forma(['##', '##'], { '#': [1, 1] }, [1, 2, 4]);
  forma(['##', '##'], { '#': [1, 3] }, [1, 4, 4]);
  forma(['##', '##'], { '#': [1, 5] }, [1, 6, 4]);
  forma(['DG', 'GD'], { D: [3, 0], G: [13] }, [3, 1, 4]);
  // prismarina, linterna de mar, bloques de magma y de verrugas
  forma(['##', '##'], { '#': [409] }, [168, 0]);
  forma(['###', '###', '###'], { '#': [409] }, [168, 2]);
  forma(['###', '#I#', '###'], { '#': [409], I: [351, 0] }, [168, 1]);
  forma(['SCS', 'CCC', 'SCS'], { S: [409], C: [422] }, [169]);
  forma(['##', '##'], { '#': [378] }, [213]);
  forma(['###', '###', '###'], { '#': [372] }, [214]);
  forma(['###', '###', '###'], { '#': [351, 15] }, [216]);
  sinForma([[216]], [351, 15, 9]);
  // vidrio, paneles, barras, nieve, arcilla, piedra luminosa
  forma(['###', '###'], { '#': VIDRIO }, [102, 0, 16]);
  forma(['###', '###'], { '#': HIERRO }, [101, 0, 16]);
  forma(['##', '##'], { '#': [332] }, [80]);
  forma(['###'], { '#': [80] }, [78, 0, 6]);
  forma(['##', '##'], { '#': [337] }, [82]);
  forma(['##', '##'], { '#': [348] }, [89]);
  forma(['##', '##'], { '#': CUERDA }, [35, 0]);
  forma(['###', '###', '###'], { '#': [296] }, [170]);
  sinForma([[170]], [296, 0, 9]);
  forma(['###', '###', '###'], { '#': [360] }, [103]);
  sinForma([[86], [50]], [91]);
  forma(['X#X', '#X#', 'X#X'], { X: [289], '#': [12, CUALQUIERA] }, [46]);
  // los bloques de minerales y al revés
  [[42, HIERRO], [41, ORO], [57, DIAMANTE], [133, [388]], [22, [351, 4]], [152, REDSTONE], [173, [263, 0]], [165, [341]]].forEach(function (e) {
    forma(['###', '###', '###'], { '#': e[1] }, [e[0]]);
    sinForma([[e[0]]], [e[1][0], e[1][1] || 0, 9]);
  });
  forma(['###', '###', '###'], { '#': [452] }, [265]);
  sinForma([HIERRO], [452, 0, 9]);
  forma(['###', '###', '###'], { '#': [371] }, [266]);
  sinForma([ORO], [371, 0, 9]);

  // ------------------------------------------------------------------------------------------
  // Colores: lana, alfombras, vidrio, terracota, concreto, cajas de shulker
  // (el color de la lana es 15 menos el del tinte)
  // ------------------------------------------------------------------------------------------
  for (c = 0; c < 16; c++) {
    var tinte = [351, 15 - c];
    if (c > 0) sinForma([tinte, [35, 0]], [35, c]);
    forma(['##'], { '#': [35, c] }, [171, c, 3]);
    forma(['###', '#T#', '###'], { '#': VIDRIO, T: tinte }, [241, c, 8]);
    forma(['###', '###'], { '#': [241, c] }, [160, c, 16]);
    forma(['###', '#T#', '###'], { '#': [172], T: tinte }, [159, c, 8]);
    sinForma([tinte, [12, CUALQUIERA], [12, CUALQUIERA], [12, CUALQUIERA], [12, CUALQUIERA], [13], [13], [13], [13]], [237, c, 8]);
    sinForma([[205], tinte], [218, c]);
  }
  // los tintes de las flores y las mezclas
  [[[38, 0], 1, 1], [[37], 11, 1], [[38, 1], 12, 1], [[38, 2], 13, 1], [[38, 3], 7, 1], [[38, 4], 1, 1], [[38, 5], 14, 1],
    [[38, 6], 7, 1], [[38, 7], 9, 1], [[38, 8], 7, 1], [[175, 0], 11, 2], [[175, 1], 13, 2], [[175, 4], 1, 2], [[175, 5], 9, 2],
    [[352], 15, 3]].forEach(function (e) { sinForma([e[0]], [351, e[1], e[2]]); });
  [[[1, 11], 14, 2], [[2, 15], 10, 2], [[1, 15], 9, 2], [[4, 15], 12, 2], [[5, 9], 13, 2], [[0, 15], 8, 2], [[8, 15], 7, 2],
    [[4, 2], 6, 2], [[1, 4], 5, 2]].forEach(function (e) { sinForma([[351, e[0][0]], [351, e[0][1]]], [351, e[1], e[2]]); });
  sinForma([[351, 4], [351, 1], [351, 1], [351, 15]], [351, 13, 4]);
  sinForma([[351, 0], [351, 15], [351, 15]], [351, 7, 3]);

  // ------------------------------------------------------------------------------------------
  // Herramientas, armas y armaduras
  // ------------------------------------------------------------------------------------------
  [[TABLA, 268, 269, 270, 271, 290], [ADOQUIN, 272, 273, 274, 275, 291], [HIERRO, 267, 256, 257, 258, 292],
    [DIAMANTE, 276, 277, 278, 279, 293], [ORO, 283, 284, 285, 286, 294]].forEach(function (e) {
    var m = e[0];
    forma(['X', 'X', '|'], { X: m, '|': PALO }, [e[1]]);
    forma(['X', '|', '|'], { X: m, '|': PALO }, [e[2]]);
    forma(['XXX', ' | ', ' | '], { X: m, '|': PALO }, [e[3]]);
    forma(['XX', 'X|', ' |'], { X: m, '|': PALO }, [e[4]]);
    forma(['XX', ' |', ' |'], { X: m, '|': PALO }, [e[5]]);
  });
  [[CUERO, 298], [HIERRO, 306], [DIAMANTE, 310], [ORO, 314]].forEach(function (e) {
    var m = e[0], b = e[1];
    forma(['XXX', 'X X'], { X: m }, [b]);
    forma(['X X', 'XXX', 'XXX'], { X: m }, [b + 1]);
    forma(['XXX', 'X X', 'X X'], { X: m }, [b + 2]);
    forma(['X X', 'X X'], { X: m }, [b + 3]);
  });
  forma([' |S', '| S', ' |S'], { '|': PALO, S: CUERDA }, [261]);
  forma(['F', '|', 'P'], { F: [318], '|': PALO, P: [288] }, [262, 0, 4]);
  forma(['  |', ' |S', '| S'], { '|': PALO, S: CUERDA }, [346]);
  forma(['R ', ' C'], { R: [346], C: [391] }, [398]);
  forma([' I', 'I '], { I: HIERRO }, [359]);
  sinForma([HIERRO, [318]], [259]);
  forma(['I I', ' I '], { I: HIERRO }, [325]);
  forma([' I ', 'IRI', ' I '], { I: HIERRO, R: REDSTONE }, [345]);
  forma([' G ', 'GRG', ' G '], { G: ORO, R: REDSTONE }, [347]);
  forma(['PPP', 'PCP', 'PPP'], { P: PAPEL, C: [345] }, [395]);
  forma(['SS ', 'SB ', '  S'], { S: CUERDA, B: [341] }, [420, 0, 2]);
  forma(['I I', 'III'], { I: HIERRO }, [328]);
  sinForma([[328], [54]], [342]);
  sinForma([[328], [410]], [408]);
  sinForma([[328], [46]], [407]);
  forma(['|||', '|L|', '|||'], { '|': PALO, L: LANA }, [321]);
  forma(['|||', '|C|', '|||'], { '|': PALO, C: CUERO }, [389]);
  forma(['B B', ' B '], { B: [336] }, [390]);
  forma(['G G', ' G '], { G: VIDRIO }, [374, 0, 3]);
  forma([' R ', 'CCC'], { R: [369], C: ADOQUIN }, [379]);
  forma(['I I', 'I I', 'III'], { I: HIERRO }, [380]);
  forma([' B ', 'DOD', 'OOO'], { B: [340], D: DIAMANTE, O: OBSIDIANA }, [116]);
  forma(['BBB', ' I ', 'III'], { B: [42], I: HIERRO }, [145]);
  forma(['GGG', 'GSG', 'OOO'], { G: VIDRIO, S: [399], O: OBSIDIANA }, [138]);
  forma(['OOO', 'OEO', 'OOO'], { O: OBSIDIANA, E: [381] }, [130]);
  forma(['GGG', 'GEG', 'GTG'], { G: VIDRIO, E: [381], T: [370] }, [426]);
  sinForma([[368], [377]], [381]);
  sinForma([[369]], [377, 0, 2]);
  sinForma([[341], [377]], [378]);
  sinForma([[375], [39], [353]], [376]);
  sinForma([[377], [263, CUALQUIERA], [289]], [385, 0, 3]);
  sinForma([[340], [351, 0], [288]], [386]);
  sinForma([PAPEL, PAPEL, PAPEL, CUERO], [340]);
  forma(['###'], { '#': [338] }, [339, 0, 3]);
  sinForma([[338]], [353]);
  forma(['S', 'C', 'S'], { S: [445], C: [54] }, [205]);
  sinForma([PAPEL, [289]], [401, 0, 3]);
  forma(['##', '##'], { '#': [415] }, [334]);

  // ------------------------------------------------------------------------------------------
  // Redstone y vías
  // ------------------------------------------------------------------------------------------
  forma(['C', '|'], { C: [263, CUALQUIERA], '|': PALO }, [50, 0, 4]);
  forma(['R', '|'], { R: REDSTONE, '|': PALO }, [76]);
  forma(['|', 'C'], { '|': PALO, C: ADOQUIN }, [69]);
  sinForma([[1]], [77]);
  forma(['##'], { '#': [1] }, [70]);
  forma(['##'], { '#': ORO }, [147]);
  forma(['##'], { '#': HIERRO }, [148]);
  forma(['I I', 'I|I', 'I I'], { I: HIERRO, '|': PALO }, [66, 0, 16]);
  forma(['G G', 'G|G', 'GRG'], { G: ORO, '|': PALO, R: REDSTONE }, [27, 0, 6]);
  forma(['I I', 'IPI', 'IRI'], { I: HIERRO, P: [70], R: REDSTONE }, [28, 0, 6]);
  forma(['I|I', 'ITI', 'I|I'], { I: HIERRO, '|': PALO, T: [76] }, [126, 0, 6]);
  forma(['CCC', 'CBC', 'CRC'], { C: ADOQUIN, B: [261], R: REDSTONE }, [23]);
  forma(['CCC', 'C C', 'CRC'], { C: ADOQUIN, R: REDSTONE }, [125]);
  forma(['CCC', 'RRQ', 'CCC'], { C: ADOQUIN, R: REDSTONE, Q: CUARZO }, [251]);
  forma(['TTT', 'CIC', 'CRC'], { T: TABLA, C: ADOQUIN, I: HIERRO, R: REDSTONE }, [33]);
  forma(['S', 'P'], { S: [341], P: [33] }, [29]);
  forma(['I I', 'ICI', ' I '], { I: HIERRO, C: [54] }, [410]);
  forma(['TRT', 'SSS'], { T: [76], R: REDSTONE, S: [1] }, [356]);
  forma([' T ', 'TQT', 'SSS'], { T: [76], Q: CUARZO, S: [1] }, [404]);
  forma([' R ', 'RGR', ' R '], { R: REDSTONE, G: [89] }, [123]);
  forma(['I', '|', '#'], { I: HIERRO, '|': PALO, '#': TABLA }, [131, 0, 2]);
  sinForma([[54], [131]], [146]);
  forma(['II', 'II'], { I: HIERRO }, [167]);

  // ------------------------------------------------------------------------------------------
  // Comida
  // ------------------------------------------------------------------------------------------
  forma(['###'], { '#': [296] }, [297]);
  forma(['MMM', 'SES', 'WWW'], { M: [325, 1], S: [353], E: [344], W: [296] }, [354]);
  forma(['WCW'], { W: [296], C: [351, 3] }, [357, 0, 8]);
  sinForma([[281], [39], [40]], [282]);
  sinForma([[281], [457], [457], [457], [457], [457], [457]], [459]);
  forma([' R ', 'CPM', ' B '], { R: [412], C: [391], P: [393], M: [39], B: [281] }, [413]);
  forma([' R ', 'CPM', ' B '], { R: [412], C: [391], P: [393], M: [40], B: [281] }, [413]);
  sinForma([[86], [353], [344]], [400]);
  forma(['GGG', 'GAG', 'GGG'], { G: ORO, A: [260] }, [322]);
  forma(['NNN', 'NCN', 'NNN'], { N: [371], C: [391] }, [396]);
  forma(['NNN', 'NMN', 'NNN'], { N: [371], M: [360] }, [382]);
  sinForma([[86]], [361, 0, 4]);
  sinForma([[360]], [362]);

  // ------------------------------------------------------------------------------------------
  // El horno: [entrada, variante (-1 cualquiera)] → [salida, variante, experiencia]
  // ------------------------------------------------------------------------------------------
  var HORNO = [
    [15, -1, 265, 0, 0.7], [14, -1, 266, 0, 1], [56, -1, 264, 0, 1], [21, -1, 351, 4, 0.2], [73, -1, 331, 0, 0.7],
    [16, -1, 263, 0, 0.1], [129, -1, 388, 0, 1], [153, -1, 406, 0, 0.2], [12, -1, 20, 0, 0.1], [4, -1, 1, 0, 0.1],
    [98, 0, 98, 2, 0.1], [337, -1, 336, 0, 0.3], [82, -1, 172, 0, 0.35], [87, -1, 405, 0, 0.1], [17, -1, 263, 1, 0.15],
    [162, -1, 263, 1, 0.15], [81, -1, 351, 2, 0.2], [19, 1, 19, 0, 0.15], [432, -1, 433, 0, 0.1], [319, -1, 320, 0, 0.35],
    [363, -1, 364, 0, 0.35], [365, -1, 366, 0, 0.35], [349, -1, 350, 0, 0.35], [460, -1, 463, 0, 0.35], [411, -1, 412, 0, 0.35],
    [423, -1, 424, 0, 0.35], [392, -1, 393, 0, 0.35]
  ];
  // la terracota de color se esmalta (cada color, su bloque)
  var ESMALTADA = [220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 219, 231, 232, 233, 234, 235];
  for (c = 0; c < 16; c++) HORNO.push([159, c, ESMALTADA[c], 0, 0.1]);
  // las herramientas y armaduras de hierro y de oro se funden en pepitas
  [256, 257, 258, 267, 292, 306, 307, 308, 309].forEach(function (i) { HORNO.push([i, -1, 452, 0, 0.1]); });
  [283, 284, 285, 286, 294, 314, 315, 316, 317].forEach(function (i) { HORNO.push([i, -1, 371, 0, 0.1]); });
  R.horno = function (c) {
    if (!c) return null;
    for (var i = 0; i < HORNO.length; i++) {
      var h = HORNO[i];
      if (h[0] === c.id && (h[1] < 0 || h[1] === c.m)) return { id: h[2], m: h[3], xp: h[4] };
    }
    return null;
  };
  // cuánto arde cada cosa en el horno (pasos; 200 cocinan una cosa)
  var COMBUSTIBLE = { 263: 1600, 173: 16000, 369: 2400, 280: 100, 6: 100, 5: 300, 17: 300, 162: 300, 158: 150, 85: 300, 107: 300,
    183: 300, 184: 300, 185: 300, 186: 300, 187: 300, 53: 300, 134: 300, 135: 300, 136: 300, 163: 300, 164: 300, 58: 300,
    54: 300, 146: 300, 47: 300, 84: 300, 25: 300, 96: 300, 72: 300, 151: 300, 65: 300, 143: 100, 261: 300, 346: 300,
    323: 200, 324: 200, 427: 200, 428: 200, 429: 200, 430: 200, 431: 200, 333: 1200, 281: 100, 35: 100, 171: 67, 446: 300,
    268: 200, 269: 200, 270: 200, 271: 200, 290: 200, 32: 100 };
  R.combustible = function (c) {
    if (!c) return 0;
    if (c.id === 325 && c.m === 10) return 20000;      // el balde de lava
    return COMBUSTIBLE[c.id] || 0;
  };

  // ------------------------------------------------------------------------------------------
  // Buscar la receta de una grilla (tam: 2 o 3 de lado; g: las cosas de izquierda a derecha y de
  // arriba abajo, null las vacías)
  // ------------------------------------------------------------------------------------------
  function igual(k, c) { return !!c && c.id === k[0] && (k[1] === CUALQUIERA || k[1] === c.m); }
  function conForma(r, g, lado) {
    // el rectángulo ocupado de la grilla
    var x0 = lado, y0 = lado, x1 = -1, y1 = -1, x, y;
    for (y = 0; y < lado; y++) for (x = 0; x < lado; x++) if (g[y * lado + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < 0 || x1 - x0 + 1 !== r.w || y1 - y0 + 1 !== r.h) return false;
    for (var espejo = 0; espejo < 2; espejo++) {
      var ok = true;
      for (y = 0; y < r.h && ok; y++) for (x = 0; x < r.w && ok; x++) {
        var k = r.g[y * r.w + (espejo ? r.w - 1 - x : x)], c = g[(y0 + y) * lado + x0 + x];
        if (k ? !igual(k, c) : !!c) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }
  function sinFormaVale(r, g) {
    var hay = g.filter(Boolean);
    if (hay.length !== r.s.length) return false;
    var usado = [];
    for (var i = 0; i < r.s.length; i++) {
      var k = r.s[i], j;
      for (j = 0; j < hay.length; j++) if (!usado[j] && igual(k, hay[j])) break;
      if (j === hay.length) return false;
      usado[j] = true;
    }
    return true;
  }
  R.buscar = function (g, lado) {
    for (var i = 0; i < lista.length; i++) {
      var r = lista[i];
      if (r.s ? sinFormaVale(r, g) : (r.w <= lado && r.h <= lado && conForma(r, g, lado))) return r;
    }
    return null;
  };
  // las cosas que pide una receta (para el libro: cuántas veces se puede hacer con lo que se tiene)
  R.ingredientes = function (r) {
    var l = r.s ? r.s : r.g.filter(Boolean), m = {};
    l.forEach(function (k) { var c = k[0] + ':' + k[1]; m[c] = (m[c] || 0) + 1; });
    return Object.keys(m).map(function (c) { var p = c.split(':'); return { id: +p[0], m: +p[1], n: m[c] }; });
  };
  // ¿entra en la grilla de este lado? (2 en el inventario, 3 en la mesa)
  R.entra = function (r, lado) { return r.s ? r.s.length <= lado * lado : r.w <= lado && r.h <= lado; };
  return R;
})();
