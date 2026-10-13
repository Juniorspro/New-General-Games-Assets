// porteo: los efectos de la 1.2 (MobEffect): los 25 con sus números, sus nombres en los JSON del
// behavior pack ("effects" de la comida, "add_effects", el "effect_name" de los ataques), su texto
// (potion.<clave>) y su dibujo del HUD (textures/ui/<nombre>_effect). Cada uno dura de a pasos y
// algunos hacen algo cada tantos pasos, con las cuentas del juego (PotionEffect/Potion.performEffect):
// la regeneración cura 1 cada 50 >> nivel pasos, el veneno lastima cada 25 >> nivel (sin bajar de
// medio corazón; el "fatal" sí mata), el wither cada 40 >> nivel, el hambre cansa 0,005 por nivel en
// cada paso. Los instantáneos (curación, daño, saturación) pasan de una.
var Efectos = (function () {
  'use strict';
  var EF = {};
  // [nombre en los JSON, clave del texto, dibujo del HUD (null: no se muestra), color (para las
  // partículas y las pociones), malo]
  var L = EF.lista = [null,
    ['speed', 'moveSpeed', 'speed', 0x7CAFC6, 0], ['slowness', 'moveSlowdown', 'slowness', 0x5A6C81, 1],
    ['haste', 'digSpeed', 'haste', 0xD9C043, 0], ['mining_fatigue', 'digSlowDown', 'mining_fatigue', 0x4A4217, 1],
    ['strength', 'damageBoost', 'strength', 0x932423, 0], ['instant_health', 'heal', null, 0xF82423, 0],
    ['instant_damage', 'harm', null, 0x430A09, 1], ['jump_boost', 'jump', 'jump_boost', 0x22FF4C, 0],
    ['nausea', 'confusion', 'nausea', 0x551D4A, 1], ['regeneration', 'regeneration', 'regeneration', 0xCD5CAB, 0],
    ['resistance', 'resistance', 'resistance', 0x99453A, 0], ['fire_resistance', 'fireResistance', 'fire_resistance', 0xE49A3A, 0],
    ['water_breathing', 'waterBreathing', 'water_breathing', 0x2E5299, 0], ['invisibility', 'invisibility', 'invisibility', 0x7F8392, 0],
    ['blindness', 'blindness', 'blindness', 0x1F1F23, 1], ['night_vision', 'nightVision', 'night_vision', 0x1F1FA1, 0],
    ['hunger', 'hunger', 'hunger', 0x587653, 1], ['weakness', 'weakness', 'weakness', 0x484D48, 1],
    ['poison', 'poison', 'poison', 0x4E9331, 1], ['wither', 'wither', 'wither', 0x352A27, 1],
    ['health_boost', 'healthBoost', 'health_boost', 0xF87D23, 0], ['absorption', 'absorption', 'absorption', 0x2552A5, 0],
    ['saturation', 'saturation', null, 0xF82423, 0], ['levitation', 'levitation', 'levitation', 0xCEFFFF, 1],
    ['fatal_poison', 'poison', 'poison', 0x4E9331, 1]];
  var POR_NOMBRE = {};
  for (var i = 1; i < L.length; i++) POR_NOMBRE[L[i][0]] = i;
  // los nombres viejos que también aparecen en los datos (los de las claves de texto)
  ['moveSpeed', 'moveSlowdown', 'digSpeed', 'digSlowDown', 'damageBoost', 'heal', 'harm', 'jump', 'confusion'].forEach(function (n, k) {
    POR_NOMBRE[n] = [1, 2, 3, 4, 5, 6, 7, 8, 9][k];
  });
  EF.id = function (nombre) { return POR_NOMBRE[String(nombre || '').replace('minecraft:', '')] || 0; };
  EF.INSTANTANEO = { 6: 1, 7: 1, 23: 1 };

  // el estado de alguien: { lista: [{ id, amp, dur, max }] } (max: lo que duraba al empezar)
  EF.nuevo = function () { return { lista: [] }; };
  EF.de = function (s, id) {
    for (var k = 0; k < s.lista.length; k++) if (s.lista[k].id === id) return s.lista[k];
    return null;
  };
  EF.nivel = function (s, id) { var e = EF.de(s, id); return e ? e.amp + 1 : 0; };
  // dar un efecto (PotionEffect.combine): uno más fuerte reemplaza al que había; uno igual alarga si
  // dura más. Los instantáneos no se guardan: los aplica quien llama (ver instantaneo)
  EF.dar = function (s, id, dur, amp) {
    if (!id || EF.INSTANTANEO[id]) return null;
    amp = amp | 0; dur = Math.max(1, Math.round(dur));
    var e = EF.de(s, id);
    if (!e) { e = { id: id, amp: amp, dur: dur, max: dur }; s.lista.push(e); return e; }
    if (amp > e.amp) { e.amp = amp; e.dur = dur; e.max = dur; }
    else if (amp === e.amp && dur > e.dur) { e.dur = dur; e.max = Math.max(e.max, dur); }
    return e;
  };
  EF.quitar = function (s, id) { s.lista = s.lista.filter(function (e) { return e.id !== id; }); };
  EF.limpiar = function (s) { var habia = s.lista.length > 0; s.lista.length = 0; return habia; };

  // un paso (1/20 s): g = { curar(n), danar(n, causa), cansar(x), comer(n, sat), vida(), alTerminar(e) }
  EF.paso = function (s, g) {
    for (var k = s.lista.length - 1; k >= 0; k--) {
      var e = s.lista[k];
      var cada;
      switch (e.id) {
        case 10: cada = 50 >> e.amp; if (cada <= 0 || e.dur % cada === 0) g.curar(1); break;
        case 19: cada = 25 >> e.amp; if ((cada <= 0 || e.dur % cada === 0) && g.vida() > 1) g.danar(1, 'magic'); break;
        case 25: cada = 25 >> e.amp; if (cada <= 0 || e.dur % cada === 0) g.danar(1, 'magic'); break;
        case 20: cada = 40 >> e.amp; if (cada <= 0 || e.dur % cada === 0) g.danar(1, 'wither'); break;
        case 17: g.cansar(0.005 * (e.amp + 1)); break;
      }
      if (--e.dur <= 0) { s.lista.splice(k, 1); if (g.alTerminar) g.alTerminar(e); }
    }
  };
  // los instantáneos (curación 4 << nivel, daño 6 << nivel, saturación nivel+1 de comida y el doble
  // de saturación); "mult" es lo que llega de una poción arrojadiza según la distancia
  EF.instantaneo = function (id, amp, g, mult) {
    mult = mult === undefined ? 1 : mult;
    if (id === 6) g.curar(Math.max(4 << amp, 0) * mult);
    else if (id === 7) g.danar(Math.floor((6 << amp) * mult), 'magic');
    else if (id === 23) g.comer(amp + 1, (amp + 1) * 2);
  };

  // lo de la comida (items.json): [{ name, chance, duration (s), amplifier }]
  EF.deComida = function (s, lista, g) {
    (lista || []).forEach(function (x) {
      if (typeof x.chance === 'number' && Math.random() >= x.chance) return;
      var id = EF.id(x.name);
      if (!id) return;
      if (EF.INSTANTANEO[id]) EF.instantaneo(id, x.amplifier | 0, g);
      else if (g.dar) g.dar(id, (x.duration || 0) * 20, x.amplifier | 0);
      else EF.dar(s, id, (x.duration || 0) * 20, x.amplifier | 0);
    });
  };

  // ------------------------------------------------------------------------------------------
  // Las pociones de la 1.2 (el "aux" de 0 a 36): [efecto, pasos, nivel]. Las arrojadizas duran 3/4
  // y las persistentes 1/4 (como la 1.2)
  // ------------------------------------------------------------------------------------------
  var M = 60 * 20;
  var POCIONES = [null, null, null, null, null,
    [16, 3 * M, 0], [16, 8 * M, 0], [14, 3 * M, 0], [14, 8 * M, 0], [8, 3 * M, 0], [8, 8 * M, 0], [8, 1.5 * M, 1],
    [12, 3 * M, 0], [12, 8 * M, 0], [1, 3 * M, 0], [1, 8 * M, 0], [1, 1.5 * M, 1], [2, 1.5 * M, 0], [2, 4 * M, 0],
    [13, 3 * M, 0], [13, 8 * M, 0], [6, 1, 0], [6, 1, 1], [7, 1, 0], [7, 1, 1], [19, 45 * 20, 0], [19, 2 * M, 0],
    [19, 22 * 20, 1], [10, 45 * 20, 0], [10, 2 * M, 0], [10, 22 * 20, 1], [5, 3 * M, 0], [5, 8 * M, 0], [5, 1.5 * M, 1],
    [18, 1.5 * M, 0], [18, 4 * M, 0], [20, 40 * 20, 1]];
  EF.pocion = function (m) { return POCIONES[m] || null; };
  // tomar o recibir una poción (tipo: 'potion', 'splash' o 'linger'; mult: según la distancia)
  EF.dePocion = function (s, m, tipo, g, mult) {
    var p = POCIONES[m];
    if (!p) return false;
    mult = mult === undefined ? 1 : mult;
    if (EF.INSTANTANEO[p[0]]) { EF.instantaneo(p[0], p[2], g, mult); return true; }
    var dur = p[1] * (tipo === 'splash' ? 0.75 : tipo === 'linger' ? 0.25 : 1) * mult;
    if (dur > 20) { if (g.dar) g.dar(p[0], dur, p[2]); else EF.dar(s, p[0], dur, p[2]); }
    return true;
  };
  // el color de una poción (la mezcla de sus efectos, como PotionUtils.getPotionColor)
  EF.colorPocion = function (m) {
    var p = POCIONES[m];
    return p ? L[p[0]][3] : 0x385DC6;
  };
  // el tiempo como lo muestra el juego (m:ss; "**:**" si es eterno)
  EF.tiempo = function (pasos) {
    if (pasos > 32767 * 20) return '**:**';
    var s = Math.ceil(pasos / 20), mm = Math.floor(s / 60), ss = s % 60;
    return mm + ':' + (ss < 10 ? '0' : '') + ss;
  };

  EF.guardar = function (s) { return s.lista.map(function (e) { return [e.id, e.amp, e.dur, e.max]; }); };
  EF.cargar = function (g) {
    var s = EF.nuevo();
    if (Array.isArray(g)) g.forEach(function (a) { if (Array.isArray(a) && a[0] > 0 && a[2] > 0) s.lista.push({ id: a[0] | 0, amp: a[1] | 0, dur: a[2] | 0, max: a[3] | 0 || a[2] | 0 }); });
    return s;
  };
  return EF;
})();
