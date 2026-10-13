// porteo: romper bloques en supervivencia, como el juego. La 1.2 tiene esto en código
// (BlockLegacy: setDestroyTime, el material y lo que suelta cada uno), así que acá va escrito: la
// dureza de cada bloque, con qué herramienta se rompe rápido, cuál hace falta para que suelte algo
// (y de qué nivel: madera 0, piedra 1, hierro 2, diamante 3), y lo que suelta (con la experiencia de
// los minerales). El tiempo es la cuenta del juego: velocidad / dureza / (30 si se puede cosechar,
// 100 si no) por paso; con eso >= 1 se rompe al instante.
var Minar = (function () {
  'use strict';
  var M = {};
  // material: p piedra (pico, hace falta), h metal (pico, hace falta), m madera (hacha), t tierra y
  // arena (pala), n nieve (pala, hace falta), o hojas (tijeras, espada), l lana (tijeras), w telaraña
  // (espada o tijeras, hacen falta), v plantas (hacha, espada), c calabaza y melón (hacha, espada),
  // x lo demás (nada la acelera)
  // nombre: [dureza, material, nivel de pico]
  var DATOS = {
    stone: [1.5, 'p'], grass: [0.6, 't'], dirt: [0.5, 't'], cobblestone: [2, 'p'], planks: [2, 'm'], sapling: [0, 'v'],
    bedrock: [-1, 'x'], flowing_water: [-1, 'x'], water: [-1, 'x'], flowing_lava: [-1, 'x'], lava: [-1, 'x'],
    sand: [0.5, 't'], gravel: [0.6, 't'], gold_ore: [3, 'p', 2], iron_ore: [3, 'p', 1], coal_ore: [3, 'p'], log: [2, 'm'],
    leaves: [0.2, 'o'], sponge: [0.6, 'x'], glass: [0.3, 'x'], lapis_ore: [3, 'p', 1], lapis_block: [3, 'h', 1],
    dispenser: [3.5, 'p'], sandstone: [0.8, 'p'], noteblock: [0.8, 'm'], bed: [0.2, 'x'], golden_rail: [0.7, 'r'],
    detector_rail: [0.7, 'r'], sticky_piston: [0.5, 'x'], web: [4, 'w'], tallgrass: [0, 'v'], deadbush: [0, 'v'],
    piston: [0.5, 'x'], pistonArmCollision: [0.5, 'x'], wool: [0.8, 'l'], yellow_flower: [0, 'v'], red_flower: [0, 'v'],
    brown_mushroom: [0, 'v'], red_mushroom: [0, 'v'], gold_block: [3, 'h', 2], iron_block: [5, 'h', 1],
    double_stone_slab: [2, 'p'], stone_slab: [2, 'p'], brick_block: [2, 'p'], tnt: [0, 'x'], bookshelf: [1.5, 'm'],
    mossy_cobblestone: [2, 'p'], obsidian: [50, 'p', 3], torch: [0, 'x'], fire: [0, 'x'], mob_spawner: [5, 'p'],
    oak_stairs: [2, 'm'], chest: [2.5, 'm'], redstone_wire: [0, 'x'], diamond_ore: [3, 'p', 2], diamond_block: [5, 'h', 2],
    crafting_table: [2.5, 'm'], wheat: [0, 'v'], farmland: [0.6, 't'], furnace: [3.5, 'p'], lit_furnace: [3.5, 'p'],
    standing_sign: [1, 'm'], wooden_door: [3, 'm'], ladder: [0.4, 'm'], rail: [0.7, 'r'], stone_stairs: [2, 'p'],
    wall_sign: [1, 'm'], lever: [0.5, 'x'], stone_pressure_plate: [0.5, 'p'], iron_door: [5, 'h'],
    wooden_pressure_plate: [0.5, 'm'], redstone_ore: [3, 'p', 2], lit_redstone_ore: [3, 'p', 2],
    unlit_redstone_torch: [0, 'x'], redstone_torch: [0, 'x'], stone_button: [0.5, 'r'], snow_layer: [0.1, 'n'],
    ice: [0.5, 'r'], snow: [0.2, 'n'], cactus: [0.4, 'x'], clay: [0.6, 't'], reeds: [0, 'v'], jukebox: [2, 'm'],
    fence: [2, 'm'], pumpkin: [1, 'c'], netherrack: [0.4, 'p'], soul_sand: [0.5, 't'], glowstone: [0.3, 'x'],
    portal: [-1, 'x'], lit_pumpkin: [1, 'c'], cake: [0.5, 'x'], unpowered_repeater: [0, 'x'], powered_repeater: [0, 'x'],
    invisibleBedrock: [-1, 'x'], trapdoor: [3, 'm'], monster_egg: [0.75, 'x'], stonebrick: [1.5, 'p'],
    brown_mushroom_block: [0.2, 'm'], red_mushroom_block: [0.2, 'm'], iron_bars: [5, 'h'], glass_pane: [0.3, 'x'],
    melon_block: [1, 'c'], pumpkin_stem: [0, 'v'], melon_stem: [0, 'v'], vine: [0.2, 'v'], fence_gate: [2, 'm'],
    brick_stairs: [2, 'p'], stone_brick_stairs: [1.5, 'p'], mycelium: [0.6, 't'], waterlily: [0, 'v'],
    nether_brick: [2, 'p'], nether_brick_fence: [2, 'p'], nether_brick_stairs: [2, 'p'], nether_wart: [0, 'v'],
    enchanting_table: [5, 'p'], brewing_stand: [0.5, 'h'], cauldron: [2, 'h'], end_portal: [-1, 'x'],
    end_portal_frame: [-1, 'x'], end_stone: [3, 'p'], dragon_egg: [3, 'x'], redstone_lamp: [0.3, 'x'],
    lit_redstone_lamp: [0.3, 'x'], dropper: [3.5, 'p'], activator_rail: [0.7, 'r'], cocoa: [0.2, 'v'],
    sandstone_stairs: [0.8, 'p'], emerald_ore: [3, 'p', 2], ender_chest: [22.5, 'p'], tripwire_hook: [0, 'x'],
    tripWire: [0, 'x'], emerald_block: [5, 'h', 2], spruce_stairs: [2, 'm'], birch_stairs: [2, 'm'], jungle_stairs: [2, 'm'],
    command_block: [-1, 'x'], beacon: [3, 'x'], cobblestone_wall: [2, 'p'], flower_pot: [0, 'x'], carrots: [0, 'v'],
    potatoes: [0, 'v'], wooden_button: [0.5, 'm'], skull: [1, 'x'], anvil: [5, 'h'], trapped_chest: [2.5, 'm'],
    light_weighted_pressure_plate: [0.5, 'h'], heavy_weighted_pressure_plate: [0.5, 'h'], unpowered_comparator: [0, 'x'],
    powered_comparator: [0, 'x'], daylight_detector: [0.2, 'm'], redstone_block: [5, 'h'], quartz_ore: [3, 'p'],
    hopper: [3, 'h'], quartz_block: [0.8, 'p'], quartz_stairs: [0.8, 'p'], double_wooden_slab: [2, 'm'],
    wooden_slab: [2, 'm'], stained_hardened_clay: [1.25, 'p'], stained_glass_pane: [0.3, 'x'], leaves2: [0.2, 'o'],
    log2: [2, 'm'], acacia_stairs: [2, 'm'], dark_oak_stairs: [2, 'm'], slime: [0, 'x'], iron_trapdoor: [5, 'h'],
    prismarine: [1.5, 'p'], seaLantern: [0.3, 'x'], hay_block: [0.5, 'x'], carpet: [0.1, 'x'], hardened_clay: [1.25, 'p'],
    coal_block: [5, 'p'], packed_ice: [0.5, 'r'], double_plant: [0, 'v'], standing_banner: [1, 'm'], wall_banner: [1, 'm'],
    daylight_detector_inverted: [0.2, 'm'], red_sandstone: [0.8, 'p'], red_sandstone_stairs: [0.8, 'p'],
    double_stone_slab2: [2, 'p'], stone_slab2: [2, 'p'], spruce_fence_gate: [2, 'm'], birch_fence_gate: [2, 'm'],
    jungle_fence_gate: [2, 'm'], dark_oak_fence_gate: [2, 'm'], acacia_fence_gate: [2, 'm'],
    repeating_command_block: [-1, 'x'], chain_command_block: [-1, 'x'], spruce_door: [3, 'm'], birch_door: [3, 'm'],
    jungle_door: [3, 'm'], acacia_door: [3, 'm'], dark_oak_door: [3, 'm'], grass_path: [0.65, 't'], frame: [0, 'x'],
    chorus_flower: [0.4, 'v'], purpur_block: [1.5, 'p'], purpur_stairs: [1.5, 'p'], undyed_shulker_box: [2, 'x'],
    end_bricks: [0.8, 'p'], frosted_ice: [0.5, 'r'], end_rod: [0, 'x'], end_gateway: [-1, 'x'], magma: [0.5, 'p'],
    nether_wart_block: [1, 'x'], red_nether_brick: [2, 'p'], bone_block: [2, 'p'], structure_void: [0, 'x'],
    shulker_box: [2, 'x'], concrete: [1.8, 'p'], concretePowder: [0.5, 't'], chorus_plant: [0.4, 'v'],
    stained_glass: [0.3, 'x'], podzol: [0.5, 't'], beetroot: [0, 'v'], stonecutter: [3.5, 'p'], glowingobsidian: [35, 'p', 3],
    netherreactor: [3, 'h'], info_update: [0, 'x'], info_update2: [0, 'x'], movingBlock: [-1, 'x'], observer: [3.5, 'p'],
    structure_block: [-1, 'x'], reserved6: [0, 'x']
  };
  // las terracotas esmaltadas (16 nombres)
  ['purple', 'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'silver', 'cyan', 'blue', 'brown',
    'green', 'red', 'black'].forEach(function (c) { DATOS[c + '_glazed_terracotta'] = [1.4, 'p']; });
  // qué parte del "meta" del bloque es la variante que se lleva (el resto es hacia dónde mira, la mitad
  // de arriba, la edad...); lo que no está, 0
  var VARIANTE = {
    stone: 15, dirt: 15, planks: 15, sapling: 7, sand: 15, log: 3, log2: 3, leaves: 3, leaves2: 3, sponge: 15, sandstone: 15,
    wool: 15, red_flower: 15, double_stone_slab: 7, stone_slab: 7, double_stone_slab2: 7, stone_slab2: 7, wooden_slab: 7,
    double_wooden_slab: 7, stonebrick: 15, cobblestone_wall: 15, quartz_block: 3, stained_hardened_clay: 15, carpet: 15,
    stained_glass: 15, stained_glass_pane: 15, prismarine: 15, red_sandstone: 15, double_plant: 7, concrete: 15,
    concretePowder: 15, shulker_box: 15, anvil: 12, fence: 15, purpur_block: 3, monster_egg: 15, tallgrass: 3
  };

  var dureza = new Float32Array(256), material = [], nivel = new Uint8Array(256), nombres = [];
  M.preparar = function () {
    for (var id = 0; id < 256; id++) {
      var b = C.bloques[id], d = b && DATOS[b.nombre];
      nombres[id] = b ? b.nombre : '';
      dureza[id] = d ? d[0] : (b && b.existe ? 1 : 0);
      material[id] = d ? d[1] : 'x';
      nivel[id] = d && d[2] ? d[2] : 0;
    }
  };
  M.dureza = function (id) { return dureza[id]; };

  // ------------------------------------------------------------------------------------------
  // La herramienta (ItemTool.getStrVsBlock, ItemSword, ItemShears)
  // ------------------------------------------------------------------------------------------
  // cuánto acelera lo que se tiene en la mano a este bloque (1 si nada)
  function velocidad(id, item) {
    var d = item && Items.def[item.id], mat = material[id];
    if (!d) return 1;
    if (d.herr === 'pico' && (mat === 'p' || mat === 'h' || mat === 'r')) return d.vel;
    if (d.herr === 'hacha' && (mat === 'm' || mat === 'v' || mat === 'c')) return d.vel;
    if (d.herr === 'pala' && (mat === 't' || mat === 'n')) return d.vel;
    if (d.herr === 'espada') return mat === 'w' ? 15 : (mat === 'v' || mat === 'o' || mat === 'c') ? 1.5 : 1;
    if (item.id === 359) return mat === 'w' || mat === 'o' ? 15 : mat === 'l' ? 5 : 1;      // las tijeras
    return 1;
  }
  // ¿suelta algo con esto en la mano? (lo de piedra y metal pide un pico del nivel; la nieve, una pala;
  // la telaraña, espada o tijeras)
  function puedeCosechar(id, item) {
    var mat = material[id], d = item && Items.def[item.id];
    if (mat === 'p' || mat === 'h') return !!d && d.herr === 'pico' && d.nivel >= nivel[id];
    if (mat === 'n') return !!d && d.herr === 'pala';
    if (mat === 'w') return !!d && (d.herr === 'espada' || item.id === 359);
    return true;
  }
  M.puedeCosechar = puedeCosechar;
  // lo que avanza el romper en un paso (1 = se rompe); 0 si no se puede romper.
  // o: { bajoAgua, enAire } (debajo del agua y saltando, cinco veces más lento)
  M.avance = function (id, item, o) {
    var h = dureza[id];
    if (h < 0) return 0;
    if (h === 0) return 1;
    var v = velocidad(id, item);
    if (o && o.bajoAgua) v /= 5;
    if (o && o.enAire) v /= 5;
    return v / h / (puedeCosechar(id, item) ? 30 : 100);
  };
  // ¿gasta la herramienta? (las espadas el doble; romper algo sin dureza no gasta)
  M.desgaste = function (id, item) {
    var d = item && Items.def[item.id];
    if (!d || !d.dur || dureza[id] === 0) return 0;
    if (d.herr === 'espada') return 2;
    if (d.herr === 'azada') return 0;
    return 1;
  };

  // ------------------------------------------------------------------------------------------
  // Lo que suelta (Block.getItemDropped, quantityDropped) y la experiencia de los minerales
  // ------------------------------------------------------------------------------------------
  function entre(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  // los cultivos maduros dan semillas extra: 3 intentos de 8/15 (BlockCrops.getDrops)
  function extra() { var n = 0; for (var i = 0; i < 3; i++) if (Math.random() < 8 / 15) n++; return n; }
  var COLOR_CAMA = 14;
  // devuelve { cosas: [[id, meta, cantidad]], xp } (nada: cosas vacía)
  M.suelta = function (id, m, item) {
    var n = nombres[id], r = [], xp = 0;
    function da(i, mm, c) { if (c === undefined) c = 1; if (c > 0) r.push([i, mm || 0, c]); }
    if (!puedeCosechar(id, item)) return { cosas: r, xp: 0 };
    var tijeras = item && item.id === 359;
    switch (n) {
      case 'stone': if (m === 0) da(4); else da(1, m); break;
      case 'grass': case 'mycelium': case 'podzol': case 'farmland': case 'grass_path': da(3); break;
      case 'gravel': if (Math.random() < 0.1) da(318); else da(13); break;
      case 'coal_ore': da(263); xp = entre(0, 2); break;
      case 'diamond_ore': da(264); xp = entre(3, 7); break;
      case 'emerald_ore': da(388); xp = entre(3, 7); break;
      case 'lapis_ore': da(351, 4, entre(4, 8)); xp = entre(2, 5); break;
      case 'redstone_ore': case 'lit_redstone_ore': da(331, 0, entre(4, 5)); xp = entre(1, 5); break;
      case 'quartz_ore': da(406); xp = entre(2, 5); break;
      case 'mob_spawner': xp = entre(15, 43); break;
      case 'leaves': case 'leaves2': {
        var tipo = (m & 3) + (n === 'leaves2' ? 4 : 0);
        if (tijeras) { da(id, m & 3); break; }
        if (Math.random() < (tipo === 3 ? 1 / 40 : 1 / 20)) da(6, tipo);
        if ((tipo === 0 || tipo === 5) && Math.random() < 1 / 200) da(260);
        break;
      }
      case 'glass': case 'glass_pane': case 'stained_glass': case 'stained_glass_pane': case 'ice': case 'packed_ice':
      case 'frosted_ice': case 'fire': case 'cake': case 'monster_egg': case 'pistonArmCollision': case 'portal':
      case 'structure_void': case 'end_gateway': break;
      case 'web': da(287); break;
      case 'tallgrass': if (tijeras) da(31, m & 3); else if (Math.random() < 1 / 8) da(295); break;
      case 'deadbush': if (tijeras) da(32); else da(280, 0, entre(0, 2)); break;
      case 'vine': if (tijeras) da(106); break;
      case 'double_plant': {
        // la mitad de arriba no suelta nada: lo suelta la de abajo
        if (m & 8) break;
        var t2 = m & 7;
        if (t2 === 2 || t2 === 3) { if (tijeras) da(31, t2 === 2 ? 1 : 2, 2); else if (Math.random() < 1 / 8) da(295); }
        else da(175, t2);
        break;
      }
      case 'double_stone_slab': da(44, m & 7, 2); break;
      case 'double_stone_slab2': da(182, m & 7, 2); break;
      case 'double_wooden_slab': da(158, m & 7, 2); break;
      case 'bookshelf': da(340, 0, 3); break;
      case 'clay': da(337, 0, 4); break;
      case 'snow': da(332, 0, 4); break;
      case 'snow_layer': da(332, 0, (m & 7) + 1); break;
      case 'glowstone': da(348, 0, entre(2, 4)); break;
      case 'seaLantern': da(422, 0, entre(2, 3)); break;
      case 'melon_block': da(360, 0, entre(3, 7)); break;
      case 'brown_mushroom_block': da(39, 0, Math.max(0, entre(0, 9) - 7)); break;
      case 'red_mushroom_block': da(40, 0, Math.max(0, entre(0, 9) - 7)); break;
      case 'redstone_wire': da(331); break;
      case 'unlit_redstone_torch': case 'redstone_torch': da(76); break;
      case 'lit_redstone_lamp': da(123); break;
      case 'lit_furnace': da(61); break;
      case 'standing_sign': case 'wall_sign': da(323); break;
      case 'wooden_door': if (!(m & 8)) da(324); break;
      case 'iron_door': if (!(m & 8)) da(330); break;
      case 'spruce_door': if (!(m & 8)) da(427); break;
      case 'birch_door': if (!(m & 8)) da(428); break;
      case 'jungle_door': if (!(m & 8)) da(429); break;
      case 'acacia_door': if (!(m & 8)) da(430); break;
      case 'dark_oak_door': if (!(m & 8)) da(431); break;
      case 'bed': if (!(m & 8)) da(355, COLOR_CAMA); break;
      case 'reeds': da(338); break;
      case 'unpowered_repeater': case 'powered_repeater': da(356); break;
      case 'unpowered_comparator': case 'powered_comparator': da(404); break;
      case 'daylight_detector_inverted': da(151); break;
      case 'brewing_stand': da(379); break;
      case 'cauldron': da(380); break;
      case 'flower_pot': da(390); break;
      case 'hopper': da(410); break;
      case 'frame': da(389); break;
      case 'skull': da(397); break;
      case 'standing_banner': case 'wall_banner': da(446); break;
      case 'tripWire': da(287); break;
      case 'ender_chest': da(49, 0, 8); break;
      case 'pumpkin_stem': if (Math.random() < 0.3) da(361); break;
      case 'melon_stem': if (Math.random() < 0.3) da(362); break;
      case 'wheat': if ((m & 7) >= 7) { da(296); da(295, 0, 1 + extra()); } else da(295); break;
      case 'beetroot': if ((m & 7) >= 7) { da(457); da(458, 0, 1 + extra()); } else da(458); break;
      case 'carrots': da(391, 0, (m & 7) >= 7 ? entre(1, 4) : 1); break;
      case 'potatoes':
        da(392, 0, (m & 7) >= 7 ? entre(1, 4) : 1);
        if ((m & 7) >= 7 && Math.random() < 0.02) da(394);
        break;
      case 'nether_wart': da(372, 0, (m & 3) >= 3 ? entre(2, 4) : 1); break;
      case 'cocoa': da(351, 3, (m >> 2) >= 2 ? entre(2, 3) : 1); break;
      case 'chorus_plant': if (Math.random() < 0.5) da(432); break;
      case 'glowingobsidian': da(49); break;
      case 'invisibleBedrock': case 'bedrock': case 'end_portal_frame': case 'command_block': case 'structure_block':
      case 'movingBlock': case 'flowing_water': case 'water': case 'flowing_lava': case 'lava': break;
      default:
        if (id > 0 && C.bloques[id] && C.bloques[id].existe) da(id, m & (VARIANTE[n] || 0));
    }
    return { cosas: r, xp: xp };
  };
  // el hielo roto sin herramienta de seda deja agua si abajo hay algo (BlockIce.harvestBlock)
  M.dejaAgua = function (id) { return nombres[id] === 'ice'; };
  return M;
})();
