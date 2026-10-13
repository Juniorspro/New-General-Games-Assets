// porteo: los objetos de la 1.2 que no son bloques (herramientas, armas, armaduras, comida,
// materiales, baldes, semillas...). El juego los tiene en libminecraftpe.so (Item::initItems): acá
// van sus números, el nombre con el que aparecen en los textos ("item.<nombre>.name"), su dibujo
// (la clave de textures/item_texture.json y cuál de su lista) y lo que tienen en código: cuántos se
// apilan, cuánto duran, qué rompen y qué tan rápido, cuánto pegan, cuánta armadura dan, qué bloque
// ponen, cuánto arden en el horno. La comida y las semillas salen de items.json del behavior pack.
var Items = (function () {
  'use strict';
  var IT = {};
  var def = IT.def = {};          // número → definición
  var tex = {}, comida = {};      // de los datos: clave → índices en objetos.png; items.json
  var COLS = 32;

  // los materiales de las herramientas: [nivel para romper, velocidad, durabilidad, lugar del dibujo]
  // (madera, piedra, hierro, diamante y oro, como ToolMaterial del juego)
  var MAT = {
    madera: [0, 2, 59, 0], piedra: [1, 4, 131, 1], hierro: [2, 6, 250, 2], diamante: [3, 8, 1561, 4], oro: [0, 12, 32, 3]
  };
  // cuánto pegan (con la mano, 1): espada, hacha, pico y pala de cada material, como la 1.2
  var DANO = {
    espada: { madera: 5, piedra: 6, hierro: 7, diamante: 8, oro: 5 },
    hacha: { madera: 4, piedra: 5, hierro: 6, diamante: 7, oro: 4 },
    pico: { madera: 3, piedra: 4, hierro: 5, diamante: 6, oro: 3 },
    pala: { madera: 2, piedra: 3, hierro: 4, diamante: 5, oro: 2 },
    azada: { madera: 1, piedra: 1, hierro: 1, diamante: 1, oro: 1 }
  };
  var TEX_HERR = { espada: 'sword', hacha: 'axe', pico: 'pickaxe', pala: 'shovel', azada: 'hoe' };
  function herramienta(id, n, tipo, mat) {
    var M = MAT[mat];
    def[id] = { id: id, n: n, tx: TEX_HERR[tipo], ti: M[3], st: 1, herr: tipo, nivel: M[0], vel: M[1], dur: M[2],
      dano: DANO[tipo][mat], comb: mat === 'madera' ? 200 : 0 };
  }
  // las armaduras: [lugar en el dibujo, durabilidad base] y los puntos de cada pieza
  var ARM = {
    cuero: [0, 5, [1, 3, 2, 1]], malla: [1, 15, [2, 5, 4, 1]], hierro: [2, 15, [2, 6, 5, 2]], oro: [3, 7, [2, 5, 3, 1]],
    diamante: [4, 33, [3, 8, 6, 3]]
  };
  var PIEZAS = ['helmet', 'chestplate', 'leggings', 'boots'], VIDA_PIEZA = [11, 16, 15, 13];
  function armadura(id, n, mat, pieza) {
    var A = ARM[mat];
    def[id] = { id: id, n: n, tx: PIEZAS[pieza], ti: A[0], st: 1, arm: pieza, pts: A[2][pieza], dur: VIDA_PIEZA[pieza] * A[1] };
  }
  // un objeto común: [número, nombre, textura, lugar, pila, extra]
  function obj(id, n, tx, ti, st, extra) {
    var d = { id: id, n: n, tx: tx, ti: ti || 0, st: st || 64 };
    if (extra) for (var k in extra) d[k] = extra[k];
    def[id] = d;
  }

  herramienta(256, 'iron_shovel', 'pala', 'hierro');
  herramienta(257, 'iron_pickaxe', 'pico', 'hierro');
  herramienta(258, 'iron_axe', 'hacha', 'hierro');
  obj(259, 'flint_and_steel', 'flint_and_steel', 0, 1, { dur: 64, uso: 'encendedor' });
  obj(260, 'apple', 'apple');
  obj(261, 'bow', 'bow_standby', 0, 1, { dur: 384, uso: 'arco', comb: 300 });
  obj(262, 'arrow', 'arrow');
  obj(263, 'coal', 'coal', 0, 64, { comb: 1600, var: { 1: ['charcoal', 'charcoal', 0] } });
  obj(264, 'diamond', 'diamond');
  obj(265, 'iron_ingot', 'iron_ingot');
  obj(266, 'gold_ingot', 'gold_ingot');
  herramienta(267, 'iron_sword', 'espada', 'hierro');
  herramienta(268, 'wooden_sword', 'espada', 'madera');
  herramienta(269, 'wooden_shovel', 'pala', 'madera');
  herramienta(270, 'wooden_pickaxe', 'pico', 'madera');
  herramienta(271, 'wooden_axe', 'hacha', 'madera');
  herramienta(272, 'stone_sword', 'espada', 'piedra');
  herramienta(273, 'stone_shovel', 'pala', 'piedra');
  herramienta(274, 'stone_pickaxe', 'pico', 'piedra');
  herramienta(275, 'stone_axe', 'hacha', 'piedra');
  herramienta(276, 'diamond_sword', 'espada', 'diamante');
  herramienta(277, 'diamond_shovel', 'pala', 'diamante');
  herramienta(278, 'diamond_pickaxe', 'pico', 'diamante');
  herramienta(279, 'diamond_axe', 'hacha', 'diamante');
  obj(280, 'stick', 'stick', 0, 64, { comb: 100 });
  obj(281, 'bowl', 'bowl', 0, 64, { comb: 200 });
  obj(282, 'mushroom_stew', 'mushroom_stew', 0, 1);
  herramienta(283, 'golden_sword', 'espada', 'oro');
  herramienta(284, 'golden_shovel', 'pala', 'oro');
  herramienta(285, 'golden_pickaxe', 'pico', 'oro');
  herramienta(286, 'golden_axe', 'hacha', 'oro');
  obj(287, 'string', 'string', 0, 64, { pone: 132 });
  obj(288, 'feather', 'feather');
  obj(289, 'gunpowder', 'gunpowder');
  herramienta(290, 'wooden_hoe', 'azada', 'madera');
  herramienta(291, 'stone_hoe', 'azada', 'piedra');
  herramienta(292, 'iron_hoe', 'azada', 'hierro');
  herramienta(293, 'diamond_hoe', 'azada', 'diamante');
  herramienta(294, 'golden_hoe', 'azada', 'oro');
  obj(295, 'wheat_seeds', 'seeds_wheat');
  obj(296, 'wheat', 'wheat');
  obj(297, 'bread', 'bread');
  ['cuero', 'malla', 'hierro', 'diamante', 'oro'].forEach(function (mat, i) {
    var pre = ['leather', 'chainmail', 'iron', 'diamond', 'golden'][i];
    for (var p = 0; p < 4; p++) armadura(298 + i * 4 + p, pre + '_' + PIEZAS[p], mat, p);
  });
  obj(318, 'flint', 'flint');
  obj(319, 'porkchop', 'porkchop_raw');
  obj(320, 'cooked_porkchop', 'porkchop_cooked');
  obj(321, 'painting', 'painting');
  obj(322, 'golden_apple', 'apple_golden');
  obj(323, 'sign', 'sign', 0, 16, { pone: 63, comb: 200 });
  obj(324, 'wooden_door', 'wooden_door', 0, 64, { pone: 64, comb: 200 });
  // el balde: vacío, leche, agua y lava (su "aux" es el número del líquido)
  obj(325, 'bucket', 'bucket', 0, 16, { uso: 'balde', var: { 1: ['milk', 'bucket', 1, 1], 8: ['bucketWater', 'bucket', 2, 1], 10: ['bucketLava', 'bucket', 3, 1] } });
  obj(328, 'minecart', 'minecart_normal', 0, 1);
  obj(329, 'saddle', 'saddle', 0, 1);
  obj(330, 'iron_door', 'iron_door', 0, 64, { pone: 71 });
  obj(331, 'redstone', 'redstone_dust', 0, 64, { pone: 55 });
  obj(332, 'snowball', 'snowball', 0, 16, { uso: 'tirar', tira: 'snowball' });
  obj(333, 'boat', 'boat', 0, 1, { comb: 1200, var: variantes(['oak', 'spruce', 'birch', 'jungle', 'acacia', 'big_oak'], 'boat.', 'boat', 1) });
  obj(334, 'leather', 'leather');
  obj(336, 'brick', 'brick');
  obj(337, 'clay_ball', 'clay_ball');
  obj(338, 'reeds', 'reeds', 0, 64, { pone: 83 });
  obj(339, 'paper', 'paper');
  obj(340, 'book', 'book_normal');
  obj(341, 'slime_ball', 'slimeball');
  obj(342, 'chest_minecart', 'minecart_chest', 0, 1);
  obj(344, 'egg', 'egg', 0, 16, { uso: 'tirar', tira: 'egg' });
  obj(345, 'compass', 'compass_item');
  obj(346, 'fishing_rod', 'fishing_rod', 0, 1, { dur: 64, comb: 300 });
  obj(347, 'clock', 'clock_item');
  obj(348, 'glowstone_dust', 'glowstone_dust');
  obj(349, 'fish', 'fish');
  obj(350, 'cooked_fish', 'cooked_fish');
  // el tinte: su "aux" es el color de la 1.2 (0 negro ... 15 blanco)
  var COLORES = ['black', 'red', 'green', 'brown', 'blue', 'purple', 'cyan', 'silver', 'gray', 'pink', 'lime', 'yellow', 'lightBlue',
    'magenta', 'orange', 'white'];
  obj(351, 'dye.black', 'dye_powder', 0, 64, { var: variantes(COLORES, 'dye.', 'dye_powder') });
  obj(352, 'bone', 'bone');
  obj(353, 'sugar', 'sugar');
  obj(354, 'cake', 'cake', 0, 1, { pone: 92 });
  // la cama de colores (la 1.2 las trajo): el color del 0 blanco al 15 negro
  var COLORES_LANA = ['white', 'orange', 'magenta', 'lightBlue', 'yellow', 'lime', 'pink', 'gray', 'silver', 'cyan', 'purple', 'blue',
    'brown', 'green', 'red', 'black'];
  obj(355, 'bed.white', 'bed', 0, 1, { pone: 26, var: variantes(COLORES_LANA, 'bed.', 'bed', 1) });
  obj(356, 'repeater', 'repeater', 0, 64, { pone: 93 });
  obj(357, 'cookie', 'cookie');
  obj(358, 'map', 'map_filled');
  obj(359, 'shears', 'shears', 0, 1, { dur: 238, herr: 'tijeras' });
  obj(360, 'melon', 'melon');
  obj(361, 'pumpkin_seeds', 'seeds_pumpkin');
  obj(362, 'melon_seeds', 'seeds_melon');
  obj(363, 'beef', 'beef_raw');
  obj(364, 'cooked_beef', 'beef_cooked');
  obj(365, 'chicken', 'chicken_raw');
  obj(366, 'cooked_chicken', 'chicken_cooked');
  obj(367, 'rotten_flesh', 'rotten_flesh');
  obj(368, 'ender_pearl', 'ender_pearl', 0, 16, { uso: 'tirar', tira: 'ender_pearl' });
  obj(369, 'blaze_rod', 'blaze_rod', 0, 64, { comb: 2400 });
  obj(370, 'ghast_tear', 'ghast_tear');
  obj(371, 'gold_nugget', 'gold_nugget');
  obj(372, 'nether_wart', 'nether_wart');
  // las pociones: el "aux" (0 a 36) es la poción de la 1.2; el dibujo, el de su efecto
  obj(373, 'potion', 'potion_bottle_drinkable', 0, 1, { pocion: 'potion' });
  obj(374, 'glass_bottle', 'potion_bottle_empty');
  obj(375, 'spider_eye', 'spider_eye');
  obj(376, 'fermented_spider_eye', 'spider_eye_fermented');
  obj(377, 'blaze_powder', 'blaze_powder');
  obj(378, 'magma_cream', 'magma_cream');
  obj(379, 'brewing_stand', 'brewing_stand', 0, 64, { pone: 117 });
  obj(380, 'cauldron', 'cauldron', 0, 64, { pone: 118 });
  obj(381, 'ender_eye', 'ender_eye');
  obj(382, 'speckled_melon', 'melon_speckled');
  obj(384, 'experience_bottle', 'experience_bottle', 0, 64, { uso: 'tirar', tira: 'xp_bottle' });
  obj(385, 'fireball', 'fireball');
  obj(386, 'writable_book', 'book_writable', 0, 1);
  obj(387, 'written_book', 'book_written', 0, 16);
  obj(388, 'emerald', 'emerald');
  obj(389, 'frame', 'item_frame', 0, 64, { pone: 199 });
  obj(390, 'flower_pot', 'flower_pot', 0, 64, { pone: 140 });
  obj(391, 'carrot', 'carrot');
  obj(392, 'potato', 'potato');
  obj(393, 'baked_potato', 'potato_baked');
  obj(394, 'poisonous_potato', 'potato_poisonous');
  obj(395, 'emptyMap', 'map_empty');
  obj(396, 'golden_carrot', 'carrot_golden');
  obj(397, 'skull.skeleton', 'skull_skeleton', 0, 64, { pone: 144, var: {
    1: ['skull.wither', 'skull_wither', 0], 2: ['skull.zombie', 'skull_zombie', 0], 3: ['skull.char', 'skull_steve', 0],
    4: ['skull.creeper', 'skull_creeper', 0], 5: ['skull.dragon', 'skull_dragon', 0] } });
  obj(398, 'carrotOnAStick', 'carrot_on_a_stick', 0, 1, { dur: 25 });
  obj(399, 'netherStar', 'nether_star');
  obj(400, 'pumpkin_pie', 'pumpkin_pie');
  obj(401, 'fireworks', 'fireworks');
  obj(402, 'fireworksCharge', 'fireworks_charge');
  obj(403, 'enchanted_book', 'book_enchanted', 0, 1);
  obj(404, 'comparator', 'comparator', 0, 64, { pone: 149 });
  obj(405, 'netherbrick', 'netherbrick');
  obj(406, 'quartz', 'quartz');
  obj(407, 'tnt_minecart', 'minecart_tnt', 0, 1);
  obj(408, 'hopper_minecart', 'minecart_hopper', 0, 1);
  obj(409, 'prismarine_shard', 'prismarine_shard');
  obj(410, 'hopper', 'hopper', 0, 64, { pone: 154 });
  obj(411, 'rabbit', 'rabbit');
  obj(412, 'cooked_rabbit', 'rabbit_cooked');
  obj(413, 'rabbit_stew', 'rabbit_stew', 0, 1);
  obj(414, 'rabbit_foot', 'rabbit_foot');
  obj(415, 'rabbit_hide', 'rabbit_hide');
  obj(416, 'horsearmorleather', 'leather_horse_armor', 0, 1);
  obj(417, 'horsearmoriron', 'iron_horse_armor', 0, 1);
  obj(418, 'horsearmorgold', 'gold_horse_armor', 0, 1);
  obj(419, 'horsearmordiamond', 'diamond_horse_armor', 0, 1);
  obj(420, 'lead', 'lead');
  obj(421, 'nameTag', 'name_tag');
  obj(422, 'prismarine_crystals', 'prismarine_crystals');
  obj(423, 'muttonRaw', 'mutton_raw');
  obj(424, 'muttonCooked', 'mutton_cooked');
  obj(426, 'end_crystal', 'end_crystal');
  obj(427, 'spruce_door', 'spruce_door', 0, 64, { pone: 193, comb: 200 });
  obj(428, 'birch_door', 'birch_door', 0, 64, { pone: 194, comb: 200 });
  obj(429, 'jungle_door', 'jungle_door', 0, 64, { pone: 195, comb: 200 });
  obj(430, 'acacia_door', 'acacia_door', 0, 64, { pone: 196, comb: 200 });
  obj(431, 'dark_oak_door', 'dark_oak_door', 0, 64, { pone: 197, comb: 200 });
  obj(432, 'chorus_fruit', 'chorus_fruit');
  obj(433, 'chorus_fruit_popped', 'chorus_fruit_popped');
  obj(437, 'dragon_breath', 'dragon_breath');
  obj(438, 'splash_potion', 'potion_bottle_splash', 0, 1, { pocion: 'splash', uso: 'tirar', tira: 'splash_potion' });
  obj(441, 'lingering_potion', 'potion_bottle_lingering', 0, 1, { pocion: 'linger', uso: 'tirar', tira: 'splash_potion' });
  obj(444, 'elytra', 'elytra', 0, 1, { dur: 432, arm: 1, pts: 0 });
  obj(445, 'shulker_shell', 'shulker_shell');
  obj(450, 'totem', 'totem', 0, 1);
  obj(452, 'iron_nugget', 'iron_nugget');
  obj(457, 'beetroot', 'beetroot');
  obj(458, 'beetroot_seeds', 'seeds_beetroot');
  obj(459, 'beetroot_soup', 'beetroot_soup', 0, 1);
  obj(460, 'salmon', 'salmon');
  obj(461, 'clownfish', 'clownfish');
  obj(462, 'pufferfish', 'pufferfish');
  obj(463, 'cooked_salmon', 'cooked_salmon');
  obj(466, 'appleEnchanted', 'apple_golden', 0, 64, { brillo: true });
  // los discos (para la rocola): el nombre es "Disco" y abajo de qué es
  ['13', 'cat', 'blocks', 'chirp', 'far', 'mall', 'mellohi', 'stal', 'strad', 'ward', '11', 'wait'].forEach(function (d, i) {
    obj(500 + i, 'record', 'record_' + d, 0, 1, { desc: 'item.record_' + d + '.desc' });
  });

  // los "aux" de un objeto con variantes: nombre, textura y lugar de cada una
  function variantes(lista, pre, tx, pila) {
    var v = {};
    lista.forEach(function (c, i) { v[i] = [pre + c, tx, i, pila]; });
    return v;
  }

  // ------------------------------------------------------------------------------------------
  // Las pociones de la 1.2: el aux → [efecto (el lugar de su dibujo), largo/fuerte]
  // ------------------------------------------------------------------------------------------
  var POCIONES = [[0, 'agua'], [0, 'mundane'], [0, 'mundane.extended'], [0, 'thick'], [0, 'awkward'],
    [16, ''], [16, 'largo'], [14, ''], [14, 'largo'], [8, ''], [8, 'largo'], [8, 'fuerte'], [12, ''], [12, 'largo'],
    [1, ''], [1, 'largo'], [1, 'fuerte'], [2, ''], [2, 'largo'], [13, ''], [13, 'largo'], [6, ''], [6, 'fuerte'],
    [7, ''], [7, 'fuerte'], [19, ''], [19, 'largo'], [19, 'fuerte'], [10, ''], [10, 'largo'], [10, 'fuerte'],
    [5, ''], [5, 'largo'], [5, 'fuerte'], [18, ''], [18, 'largo'], [20, 'fuerte']];
  var EFECTOS = ['', 'moveSpeed', 'moveSlowdown', 'digSpeed', 'digSlowDown', 'damageBoost', 'heal', 'harm', 'jump', 'confusion',
    'regeneration', 'resistance', 'fireResistance', 'waterBreathing', 'invisibility', 'blindness', 'nightVision', 'hunger',
    'weakness', 'poison', 'wither', 'healthBoost', 'absorption', 'saturation', 'levitation'];
  IT.cuantasPociones = POCIONES.length;

  // ------------------------------------------------------------------------------------------
  // Los datos del empaquetado: dónde está cada dibujo y lo de items.json
  // ------------------------------------------------------------------------------------------
  IT.preparar = function (datos) {
    tex = (datos && datos.texturas) || {};
    COLS = (datos && datos.columnas) || 32;
    comida = (datos && datos.items) || {};
  };
  IT.es = function (id) { return id >= 256 && !!def[id]; };
  function variante(id, m) {
    var d = def[id];
    return d && d.var && d.var[m] ? d.var[m] : null;
  }
  // el lugar del dibujo en objetos.png ([x, y] en celdas de 16) o null
  IT.dibujo = function (id, m) {
    var d = def[id];
    if (!d) return null;
    var tx = d.tx, ti = d.ti, v = variante(id, m);
    if (v) { tx = v[1]; ti = v[2]; }
    if (d.pocion) ti = (POCIONES[m] || POCIONES[0])[0];
    var l = tex[tx];
    if (!l || !l.length) return null;
    var i = l[ti < l.length ? ti : 0];
    if (i === undefined || i < 0) return null;
    return [i % COLS, Math.floor(i / COLS)];
  };
  IT.nombre = function (id, m, T) {
    var d = def[id];
    if (!d) return '';
    T = T || {};
    var v = variante(id, m), n = v ? v[0] : d.n;
    if (d.pocion) return nombrePocion(d.pocion, m, T);
    var t = T['item.' + n + '.name'];
    if (d.desc && T[d.desc]) t = (t || 'Music Disc') + ' (' + T[d.desc] + ')';
    return t || n.replace(/[._]/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  };
  function nombrePocion(tipo, m, T) {
    var p = POCIONES[m] || POCIONES[0], pre = tipo === 'splash' ? (T['potion.prefix.grenade'] || 'Splash') + ' ' :
      tipo === 'linger' ? (T['potion.prefix.linger'] || 'Lingering') + ' ' : '';
    if (p[1] === 'agua') return pre + (T['item.emptyPotion.name'] || 'Water Bottle');
    if (!p[0]) return pre + (T['potion.prefix.' + p[1]] || p[1]) + ' ' + (T['item.potion.name'] || 'Potion');
    var e = EFECTOS[p[0]], t = T['potion.' + e + '.postfix'] || ('Potion of ' + e);
    return pre + t + (p[1] === 'fuerte' ? ' ' + (T['potion.potency.1'] || 'II') : '');
  }
  IT.pila = function (id, m) {
    var d = def[id];
    if (!d) return 64;
    var v = variante(id, m);
    if (v && v[3]) return v[3];
    var j = comida[d.n];
    if (j && j.max_stack_size) return j.max_stack_size;
    return d.st;
  };
  // la comida (de items.json): { nutrition, saturation_modifier, using_converts_to, effects... } y
  // cuánto tarda (use_duration, en pasos)
  // lo que la 1.2 tiene en código y no en items.json: la fruta del coro (4 de comida, saturación
  // baja, siempre se come y teletransporta)
  var COMIDA_CODIGO = { chorus_fruit: { use_duration: 32, food: { nutrition: 4, saturation_modifier: 'low', can_always_eat: true } } };
  IT.comida = function (id) {
    var d = def[id], j = d && (comida[d.n] || COMIDA_CODIGO[d.n]);
    return j && j.food ? { f: j.food, t: j.use_duration || 32 } : null;
  };
  // la semilla: { crop_result, plant_at } (de items.json)
  IT.semilla = function (id) { var d = def[id], j = d && comida[d.n]; return j && j.seed ? j.seed : null; };
  IT.brillo = function (id) { var d = def[id], j = d && comida[d.n]; return !!(d && (d.brillo || (j && j.foil))); };
  return IT;
})();
