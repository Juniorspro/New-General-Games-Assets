// porteo: las tablas de botín de la 1.2 (behavior_packs/vanilla/loot_tables/*.json): lo que sueltan
// los bichos al morir (y lo que traen los cofres de las estructuras). Cada tabla tiene "pools" que se
// tiran "rolls" veces; cada vez sale una entrada según su "weight", si se cumplen sus "conditions", y
// las "functions" le ponen la cantidad, la variante, la cocinan si el bicho se quemaba...
var Botin = (function () {
  'use strict';
  var Bo = {}, tablas = {}, porNombre = null;
  Bo.preparar = function (t) { tablas = t || {}; porNombre = null; };
  // "minecraft:rotten_flesh" → su número (objetos y bloques)
  function numero(nombre) {
    if (!porNombre) {
      porNombre = {};
      C.bloques.forEach(function (b) { if (b && b.existe) porNombre[b.nombre] = b.id; });
      for (var id in Items.def) porNombre[Items.def[id].n] = +id;
    }
    var n = String(nombre || '').replace(/^minecraft:/, '');
    return porNombre[n];
  }
  Bo.numero = numero;
  function rango(v) {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') { var a = v.min || 0, b = v.max === undefined ? a : v.max; return a + Math.floor(Math.random() * (b - a + 1)); }
    return 1;
  }
  // lo que pasa la comida al cocinarse (furnace_smelt)
  var COCIDO = { 319: 320, 363: 364, 365: 366, 423: 424, 411: 412, 349: 350 };
  var DIF = { peaceful: 0, easy: 1, normal: 2, hard: 3 };
  // ctx: { jugador (lo mató el jugador), fuego (se quemaba), dificultad, color (la oveja), saqueo }
  function vale(conds, ctx) {
    if (!Array.isArray(conds)) return true;
    for (var i = 0; i < conds.length; i++) {
      var c = conds[i], n = String(c.condition || '').replace(/^minecraft:/, '');
      if (n === 'killed_by_player' || n === 'killed_by_player_or_pets') { if (!ctx.jugador) return false; }
      else if (n === 'random_chance') { if (Math.random() >= (c.chance || 0)) return false; }
      else if (n === 'random_chance_with_looting') { if (Math.random() >= (c.chance || 0) + (c.looting_multiplier || 0) * (ctx.saqueo || 0)) return false; }
      else if (n === 'random_difficulty_chance') {
        var d = ctx.dificultad || 'normal', p = c[d] !== undefined ? c[d] : c.default_chance || 0;
        if (Math.random() >= p) return false;
      } else if (n === 'random_regional_difficulty_chance') {
        // la dificultad regional del juego (de 0 a 1 según la dificultad y el tiempo): la mitad
        if (Math.random() >= (c.max_chance || 0) * (DIF[ctx.dificultad || 'normal'] || 0) / 3 * 0.5) return false;
      } else if (n === 'entity_properties') {
        var pr = c.properties || {};
        if (pr.on_fire !== undefined && !!pr.on_fire !== !!ctx.fuego) return false;
      } else return false;
    }
    return true;
  }
  function aplicar(fs, c, ctx) {
    if (!Array.isArray(fs)) return;
    fs.forEach(function (f) {
      if (!vale(f.conditions, ctx)) return;
      var n = String(f.function || '').replace(/^minecraft:/, '');
      if (n === 'set_count') c.n = rango(f.count);
      else if (n === 'set_data') c.m = rango(f.data);
      else if (n === 'furnace_smelt') { if (COCIDO[c.id]) c.id = COCIDO[c.id]; }
      else if (n === 'looting_enchant') c.n += rango(f.count) * (ctx.saqueo || 0);
      else if (n === 'set_damage') {
        var d = Items.def[c.id], fr = typeof f.damage === 'number' ? f.damage : f.damage ? f.damage.min + Math.random() * (f.damage.max - f.damage.min) : 1;
        if (d && d.dur) c.d = Math.round((1 - fr) * d.dur);
      } else if (n === 'set_data_from_color_index') c.m = ctx.color || 0;
    });
  }
  // las cosas de una tabla: [{ id, m, n, d }]
  Bo.tirar = function (ruta, ctx, prof) {
    var t = tablas[ruta] || tablas[String(ruta || '').replace(/^\//, '')], r = [];
    ctx = ctx || {};
    if (!t || !Array.isArray(t.pools) || (prof || 0) > 4) return r;
    t.pools.forEach(function (p) {
      if (!vale(p.conditions, ctx)) return;
      var veces = rango(p.rolls === undefined ? 1 : p.rolls), es = Array.isArray(p.entries) ? p.entries : [];
      for (var k = 0; k < veces; k++) {
        var total = 0, ok = [];
        es.forEach(function (e) { if (vale(e.conditions, ctx)) { ok.push(e); total += e.weight === undefined ? 1 : e.weight; } });
        if (!ok.length) break;
        var x = Math.random() * total, e = ok[0];
        for (var i = 0; i < ok.length; i++) { x -= ok[i].weight === undefined ? 1 : ok[i].weight; if (x < 0) { e = ok[i]; break; } }
        if (e.type === 'loot_table') { r = r.concat(Bo.tirar(e.name, ctx, (prof || 0) + 1)); continue; }
        if (e.type !== 'item') continue;
        var id = numero(e.name);
        if (id === undefined) continue;
        var c = { id: id, m: 0, n: 1, d: 0 };
        aplicar(e.functions, c, ctx);
        if (c.n > 0) r.push(c);
      }
    });
    return r;
  };
  // la experiencia que da un bicho al morir a manos del jugador (experienceValue del juego)
  var XP = { blaze: 10, guardian: 10, elder_guardian: 10, evocation_illager: 10, wither: 50, ender_dragon: 12000, endermite: 3,
    vex: 3 };
  Bo.experiencia = function (tipo, hostil, bebe, tamano) {
    if (bebe) return tipo === 'zombie' || tipo === 'husk' || tipo === 'zombie_villager' || tipo === 'zombie_pigman' ? 12 : 0;
    if (tipo === 'slime' || tipo === 'magma_cube') return tamano || 1;
    if (XP[tipo] !== undefined) return XP[tipo];
    if (tipo === 'villager' || tipo === 'iron_golem' || tipo === 'snow_golem' || tipo === 'bat') return 0;
    return hostil ? 5 : 1 + Math.floor(Math.random() * 3);
  };
  return Bo;
})();
