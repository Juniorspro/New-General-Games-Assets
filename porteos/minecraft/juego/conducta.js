// porteo: lo que en la 1.2 hace el código del juego con los JSON del behavior pack (entities/*.json):
// los componentes de cada bicho ("minecraft:health", "minecraft:movement", "minecraft:attack"...), los
// grupos de componentes que se suman y se sacan con eventos ("minecraft:zombie_baby",
// "minecraft:spider_hostile"...), los eventos con sus filtros, azar y secuencias
// ("minecraft:entity_spawned"), los sensores (de luz, de distancia), el enojo, crecer, la mecha del
// creeper y los comportamientos ("minecraft:behavior.*": pasear, mirar, huir, perseguir, pegar,
// disparar, saltar sobre el objetivo, inflarse, volar, nadar, saltar como slime...). Los JSON vienen
// tal cual del APK; esto es el intérprete. La física y el resto del bicho están en bichos.js.
var Conducta = (function () {
  'use strict';
  var K = {};
  var ENT = {};               // tipo → { c: componentes, g: grupos, e: eventos }
  var PI = Math.PI;

  K.iniciar = function (entidades) { ENT = entidades || {}; };
  K.existe = function (tipo) { return !!ENT[tipo]; };
  K.def = function (tipo) { return ENT[tipo] || null; };

  // ------------------------------------------------------------------------------------------
  // Componentes: los de siempre más los de los grupos activos, en el orden en que se sumaron
  // ------------------------------------------------------------------------------------------
  function armar(e) {
    var d = ENT[e.tipo];
    var c = {};
    if (d) {
      var k;
      for (k in d.c) c[k] = d.c[k];
      for (var i = 0; i < e.grupos.length; i++) {
        var g = d.g[e.grupos[i]];
        if (g) for (k in g) c[k] = g[k];
      }
    }
    e.c = c;
    e.cambio = (e.cambio || 0) + 1;
    alCambiar(e);
  }
  K.armar = armar;
  function sumarGrupos(e, l) {
    l.forEach(function (n) { if (e.grupos.indexOf(n) < 0) e.grupos.push(n); });
  }
  function sacarGrupos(e, l) {
    e.grupos = e.grupos.filter(function (n) { return l.indexOf(n) < 0; });
  }
  // lo que sale de los componentes y se usa a cada rato (vida, tamaño, velocidad...)
  function alCambiar(e) {
    var c = e.c, sc = c['minecraft:scale'] ? c['minecraft:scale'].value || 1 : 1;
    var cb = c['minecraft:collision_box'] || { width: 0.6, height: 1.8 };
    e.escala = sc;
    e.ancho = (cb.width || 0.6) * sc; e.alto = (cb.height || 1.8) * sc;
    e.bebe = !!c['minecraft:is_baby'];
    var mv = c['minecraft:movement'];
    e.velBase = mv ? (typeof mv.value === 'number' ? mv.value : (mv.value && mv.value.range_min) || 0.25) : 0.25;
    var h = c['minecraft:health'];
    if (h) {
      var max = typeof h.max === 'number' ? h.max : (typeof h.value === 'number' ? h.value : (h.value && h.value.range_max) || 10);
      if (e.vidaMax !== max) {
        var nueva = typeof h.value === 'number' ? h.value : (h.value && h.value.range_min !== undefined
          ? h.value.range_min + Math.floor(Math.random() * ((h.value.range_max || h.value.range_min) - h.value.range_min + 1)) : max);
        if (e.vida === undefined || e.vida > max || e.recienCreado) e.vida = nueva;
        e.vidaMax = max;
      }
    }
    e.variante = c['minecraft:variant'] ? c['minecraft:variant'].value || 0 : 0;
    // (el color que le dio un tinte queda aunque cambien sus grupos)
    e.colorLana = e.colorFijo !== undefined ? e.colorFijo : c['minecraft:color'] ? c['minecraft:color'].value || 0 : 0;
    e.esquilada = !!c['minecraft:is_sheared'];
    e.domado = !!c['minecraft:is_tamed'];
    e.ensillado = !!c['minecraft:is_saddled'];
    e.conCofre = !!c['minecraft:is_chested'];
    e.vuela = !!c['minecraft:can_fly'] || !!c['minecraft:navigation.float'];
    e.trepa = !!c['minecraft:can_climb'] || !!c['minecraft:navigation.climb'];
    e.nada = !!c['minecraft:navigation.swim'];
    e.sinFuego = !!c['minecraft:fire_immune'];
    e.quemaSol = !!c['minecraft:burns_in_daylight'];
    e.mojado = !!c['minecraft:hurt_when_wet'];
    var fd = c['minecraft:fall_damage'];
    e.caida = fd ? (typeof fd.value === 'number' ? fd.value : 1) : 1;
    var at = c['minecraft:attack'];
    e.ataqueBase = at ? at.damage : 0;
    // (la araña de cueva en fácil tiene "effect_duration": 0: no envenena)
    e.efectoAtaque = at && at.effect_name ? { nombre: at.effect_name, dur: typeof at.effect_duration === 'number' ? at.effect_duration : 5 } : null;
    e.enojo = c['minecraft:angry'] || null;
    if (e.enojo && !e.enojoHasta) e.enojoHasta = e.tiempo + (e.enojo.duration || 25) * 20;
    if (!e.enojo) e.enojoHasta = 0;
    var ex = c['minecraft:explode'];
    if (ex && ex.fuseLit && e.mecha === undefined) e.mecha = Math.round((ex.fuseLength || 0) * 20);
    if (!ex) e.mecha = undefined;
    var ag = c['minecraft:ageable'];
    if (ag && e.bebe && !e.creceEn) e.creceEn = e.tiempo + (ag.duration || 1200) * 20;
    // los comportamientos, ordenados por prioridad (menor número primero, como el juego)
    var metas = [];
    for (var k in c) {
      if (k.indexOf('minecraft:behavior.') !== 0) continue;
      var n = k.slice(19), p = c[k] || {};
      if (!META[n]) continue;
      metas.push({ n: n, p: p, pr: typeof p.priority === 'number' ? p.priority : 5 });
    }
    metas.sort(function (a, b) { return a.pr - b.pr; });
    e.metas = metas;
    // si la meta actual ya no está, se suelta
    if (e.meta && !metas.some(function (m) { return m.n === e.meta.n; })) e.meta = null;
  }

  // ------------------------------------------------------------------------------------------
  // Eventos: { filters, sequence, randomize [{weight, ...}], add {component_groups}, remove {...} }
  // ------------------------------------------------------------------------------------------
  function correr(e, ev, otro, ctx) {
    if (!ev || typeof ev !== 'object') return;
    if (ev.filters && !filtro(e, ev.filters, otro, ctx)) return;
    if (Array.isArray(ev.sequence)) ev.sequence.forEach(function (s) { correr(e, s, otro, ctx); });
    if (Array.isArray(ev.randomize)) {
      var total = 0;
      ev.randomize.forEach(function (r) { total += typeof r.weight === 'number' ? r.weight : 1; });
      var x = Math.random() * total;
      for (var i = 0; i < ev.randomize.length; i++) {
        x -= typeof ev.randomize[i].weight === 'number' ? ev.randomize[i].weight : 1;
        if (x <= 0) { correr(e, ev.randomize[i], otro, ctx); break; }
      }
    }
    var cambio = false;
    if (ev.remove && ev.remove.component_groups) { sacarGrupos(e, ev.remove.component_groups); cambio = true; }
    if (ev.add && ev.add.component_groups) { sumarGrupos(e, ev.add.component_groups); cambio = true; }
    if (cambio) armar(e);
    if (ev.trigger) K.evento(e, typeof ev.trigger === 'string' ? ev.trigger : ev.trigger.event, otro, ctx);
  }
  K.evento = function (e, nombre, otro, ctx) {
    var d = ENT[e.tipo];
    if (!d || !nombre) return false;
    var ev = d.e[nombre];
    if (!ev) return false;
    correr(e, ev, otro, ctx);
    if (K.alEvento) K.alEvento(e, nombre);
    return true;
  };
  // un "event" de un componente: { event, target: "self" | "other" }
  function disparar(e, ref, otro, ctx) {
    if (!ref) return;
    var nombre = typeof ref === 'string' ? ref : ref.event;
    var quien = ref.target === 'other' && otro && otro.tipo ? otro : e;
    K.evento(quien, nombre, quien === e ? otro : e, ctx);
  }
  K.disparar = disparar;

  // ------------------------------------------------------------------------------------------
  // Filtros: { test, subject, operator, value } y all_of / any_of / none_of
  // ------------------------------------------------------------------------------------------
  function comparar(a, op, b) {
    switch (op || 'equals') {
      case '!=': case 'not': case '<>': return a !== b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '>=': return a >= b;
      default: return a === b;
    }
  }
  function familias(x) {
    if (!x) return [];
    if (x.esJugador) return ['player', 'mob'];
    var t = x.c && x.c['minecraft:type_family'];
    return t && t.family ? t.family : [];
  }
  K.familias = familias;
  function filtro(e, f, otro, ctx) {
    if (!f) return true;
    if (Array.isArray(f)) return f.every(function (x) { return filtro(e, x, otro, ctx); });
    if (f.all_of) return f.all_of.every(function (x) { return filtro(e, x, otro, ctx); });
    if (f.any_of) return f.any_of.some(function (x) { return filtro(e, x, otro, ctx); });
    if (f.none_of) return !f.none_of.some(function (x) { return filtro(e, x, otro, ctx); });
    // la forma vieja: { "other_with_families": "lightning" }
    if (f.other_with_families) return familias(otro).indexOf(f.other_with_families) >= 0;
    var sujeto = f.subject === 'other' || f.subject === 'target' ? (f.subject === 'target' ? e.objetivo : otro) : e;
    var v = f.value, op = f.operator;
    switch (f.test) {
      case 'is_family': return comparar(familias(sujeto).indexOf(v) >= 0, op === '!=' ? '!=' : '==', true) ;
      case 'has_component': {
        // "minecraft:effect.weakness": un efecto (el aldeano zombi se cura con debilidad)
        var hay = String(v).indexOf('minecraft:effect.') === 0 ? !!(sujeto && sujeto.efectos && Efectos.de(sujeto.efectos, Efectos.id(String(v).slice(17)))) :
          !!(sujeto && sujeto.c && sujeto.c[v]);
        return comparar(hay, op === '!=' ? '!=' : '==', true);
      }
      case 'is_daytime': return comparar(ctx ? ctx.dia > 0.5 : true, op, v !== false);
      case 'is_brightness': return comparar(ctx ? ctx.brillo(e) : 1, op, v);
      case 'is_biome': return comparar(ctx ? ctx.bioma(e) === v : false, op === '!=' ? '!=' : '==', true);
      case 'is_snow_covered': return comparar(ctx ? ctx.nieve(e) : false, op === '!=' ? '!=' : '==', v !== false);
      case 'is_underground': return comparar(ctx ? ctx.bajoTierra(e) : false, op === '!=' ? '!=' : '==', v !== false);
      case 'is_difficulty': return comparar(ctx ? ctx.dificultad : 'normal', op, v);
      // lo que tiene en la mano (el jugador: { enMano: { id, m } })
      case 'has_equipment': {
        var eq = sujeto && sujeto.enMano;
        var tiene = !!(eq && (typeof eq === 'object' ? Items.coincide(v, eq) : eq === String(v).split(':')[0]));
        return op === '!=' || op === 'not' ? !tiene : tiene;
      }
      case 'has_ability': return comparar(!!(sujeto && v === 'instabuild' && sujeto.creativo), op === '!=' ? '!=' : '==', true);
      case 'is_game_rule': return true;
      case 'in_caravan': return false;
      case 'has_damage': return comparar(e.ultimoDano || 'none', op, v);
    }
    return true;
  }
  K.filtro = filtro;
  // los "entity_types" de un comportamiento: [{ filters, max_dist, ... }] (o uno solo)
  function tipos(p) {
    var l = p.entity_types;
    if (!l) return null;
    return Array.isArray(l) ? l : [l];
  }

  // ------------------------------------------------------------------------------------------
  // Aparecer y cada paso
  // ------------------------------------------------------------------------------------------
  K.nacer = function (e, ctx, comoBebe) {
    e.grupos = [];
    e.recienCreado = true;
    armar(e);
    if (comoBebe && K.evento(e, 'minecraft:entity_born', null, ctx)) { /* nacido de huevo o de cría */ }
    else K.evento(e, 'minecraft:entity_spawned', null, ctx);
    e.recienCreado = false;
    if (e.vida === undefined) e.vida = e.vidaMax || 10;
  };

  // el objetivo sigue siendo atacable: vivo, cerca, no en creativo (los jugadores)
  function vivo(x) { return x && (x.esJugador ? x.vivo : !(x.muerte > 0)); }
  function dist2(a, b) { var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return dx * dx + dy * dy + dz * dz; }
  K.dist2 = dist2;

  K.paso = function (e, ctx) {
    var c = e.c;
    // crecer
    if (e.bebe && e.creceEn && e.tiempo >= e.creceEn) {
      var ag = c['minecraft:ageable'];
      e.creceEn = 0;
      disparar(e, ag && ag.grow_up ? ag.grow_up : 'minecraft:ageable_grow_up', null, ctx);
    }
    // el enojo se pasa
    if (e.enojo && e.tiempo >= e.enojoHasta) {
      var calma = e.enojo.calm_event;
      e.enojoHasta = 0;
      if (calma) disparar(e, calma, null, ctx);
      else e.objetivo = null;
    }
    // sensores: luz (cada segundo), distancia al objetivo
    if (e.tiempo % 20 === (e.id % 20)) {
      var es = c['minecraft:environment_sensor'];
      if (es && es.on_environment) {
        var l = Array.isArray(es.on_environment) ? es.on_environment : [es.on_environment];
        l.forEach(function (o) { if (filtro(e, o.filters, null, ctx)) disparar(e, o.event ? o : o.event, null, ctx); });
      }
    }
    var tn = c['minecraft:target_nearby_sensor'];
    if (tn) {
      var cerca = e.objetivo && vivo(e.objetivo) ? Math.sqrt(dist2(e, e.objetivo)) : 1e9;
      if (cerca <= (tn.inside_range || 1) && !e.dentroSensor) { e.dentroSensor = true; disparar(e, tn.on_inside_range, e.objetivo, ctx); }
      else if (cerca > (tn.outside_range || 5) && e.dentroSensor) { e.dentroSensor = false; disparar(e, tn.on_outside_range, e.objetivo, ctx); }
    }
    // la mecha (creeper, bolas de fuego)
    if (e.mecha !== undefined && c['minecraft:explode']) {
      if (--e.mecha <= 0) {
        var ex = c['minecraft:explode'];
        ctx.explotar(e, ex.power || 3, !!ex.causesFire);
        return;
      }
    }
    // los objetivos (cada tanto, como el juego, que no busca en cada paso)
    if (e.objetivo && (!vivo(e.objetivo) || dist2(e, e.objetivo) > 48 * 48 || (e.objetivo.esJugador && !e.objetivo.atacable))) soltarObjetivo(e, ctx);
    if (e.tiempo % 10 === (e.id % 10)) buscarObjetivo(e, ctx);
    // las que no mueven pero hacen algo solas (el enderman que se lleva bloques, el lobo que pide)
    var metas0 = e.metas || [];
    for (var s0 = 0; s0 < metas0.length; s0++) { var M0 = META[metas0[s0].n]; if (M0.siempre) M0.puede(e, metas0[s0].p, ctx); }
    // la meta de movimiento: la de más prioridad que puede, o seguir con la que está
    var actual = e.meta, metas = e.metas || [];
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      if (actual && m.n === actual.n) break;          // nada más importante quiere empezar
      var M = META[m.n];
      if (M.mueve && M.puede(e, m.p, ctx)) {
        if (actual && META[actual.n].fin) META[actual.n].fin(e, actual.p, ctx);
        actual = e.meta = { n: m.n, p: m.p, t: 0 };
        if (M.inicio) M.inicio(e, m.p, ctx);
        break;
      }
    }
    if (actual) {
      var MA = META[actual.n];
      actual.t++;
      if (MA.sigue && !MA.sigue(e, actual.p, ctx, actual)) {
        if (MA.fin) MA.fin(e, actual.p, ctx);
        e.meta = null;
      } else MA.paso(e, actual.p, ctx, actual);
    }
    // mirar: si la meta no maneja la cabeza
    if (!e.meta || !META[e.meta.n].mira) mirarAlrededor(e, ctx);
  };

  function soltarObjetivo(e, ctx) {
    var tenia = e.objetivo;
    e.objetivo = null;
    var oe = e.c['minecraft:on_target_escape'];
    if (tenia && oe) disparar(e, oe, tenia, ctx);
  }
  function tomarObjetivo(e, x, ctx) {
    if (e.objetivo === x) return;
    e.objetivo = x;
    var oa = e.c['minecraft:on_target_acquired'];
    if (oa) disparar(e, oa, x, ctx);
  }
  K.tomarObjetivo = tomarObjetivo;
  // nearest_attackable_target: el más cercano de los que pasan los filtros (jugadores y bichos)
  function buscarObjetivo(e, ctx) {
    var p = e.c['minecraft:behavior.nearest_attackable_target'];
    if (!p) return;
    if (e.objetivo && p.reselect_targets !== true) return;
    var ts = tipos(p);
    if (!ts) return;
    var radio = p.within_radius || 0, mejor = null, md = 1e9;
    var candidatos = ctx.cerca(e, 64);
    for (var i = 0; i < candidatos.length; i++) {
      var x = candidatos[i];
      if (x === e || !vivo(x) || (x.esJugador && !x.atacable)) continue;
      for (var k = 0; k < ts.length; k++) {
        var t = ts[k], max = (t.max_dist || radio || 16) * (x.vis || 1);
        var d = dist2(e, x);
        if (d > max * max || d >= md) continue;
        if (!filtro(e, t.filters, x, ctx)) continue;
        if ((p.must_see || t.must_see) && !ctx.ve(e, x)) continue;
        mejor = x; md = d;
      }
    }
    if (mejor) tomarObjetivo(e, mejor, ctx);
  }
  // hurt_by_target: al que le pegó (y con "alert_same_type", a los de su tipo cerca también)
  K.herido = function (e, quien, ctx) {
    var c = e.c;
    e.ultimoGolpe = e.tiempo;
    e.atacante = quien || null;
    if (!quien) return;
    var hb = c['minecraft:behavior.hurt_by_target'];
    if (hb) {
      if (!hb.entity_types || tipos(hb).some(function (t) { return filtro(e, t.filters, quien, ctx); })) tomarObjetivo(e, quien, ctx);
      if (hb.alert_same_type) ctx.cerca(e, 16).forEach(function (o) { if (o !== e && o.tipo === e.tipo && !o.objetivo) tomarObjetivo(o, quien, ctx); });
    }
    // los neutrales que se enojan (lobos, osos, endermans, porquero zombis de alrededor)
    if (c['minecraft:angry'] || hb) {
      var en = c['minecraft:angry'];
      if (en) e.enojoHasta = e.tiempo + (en.duration || 25) * 20;
      if (en && en.broadcastAnger) {
        ctx.cerca(e, en.broadcastRange || 20).forEach(function (o) {
          if (o !== e && o.tipo === e.tipo) { tomarObjetivo(o, quien, ctx); if (o.c['minecraft:angry']) o.enojoHasta = o.tiempo + (en.duration || 25) * 20; }
        });
      }
    }
    // el sensor de daño (el creeper con un rayo, el cerdo que se vuelve porquero zombi)
    var ds = c['minecraft:damage_sensor'];
    if (ds) (Array.isArray(ds) ? ds : (ds.triggers ? [].concat(ds.triggers) : [ds])).forEach(function (s) {
      if (s.on_damage && filtro(e, s.on_damage.filters, quien, ctx)) disparar(e, s.on_damage, quien, ctx);
    });
  };
  // ¿le hace daño esto? (el sensor de daño puede decir que no: el creeper no muere por el rayo)
  K.recibeDano = function (e, causa, quien, ctx) {
    var ds = e.c['minecraft:damage_sensor'];
    if (!ds) return true;
    var l = Array.isArray(ds) ? ds : (ds.triggers ? [].concat(ds.triggers) : [ds]);
    for (var i = 0; i < l.length; i++) {
      var s = l[i];
      if (s.deals_damage === false && (!s.cause || s.cause === causa) && (!s.on_damage || filtro(e, s.on_damage.filters, quien, ctx))) return false;
    }
    return true;
  };

  // ------------------------------------------------------------------------------------------
  // Mirar: al jugador cerca (look_at_player) o para cualquier lado (random_look_around)
  // ------------------------------------------------------------------------------------------
  function mirarAlrededor(e, ctx) {
    var c = e.c, lp = c['minecraft:behavior.look_at_player'] || c['minecraft:behavior.look_at_entity'];
    if (e.mirando && e.mirando.hasta > e.tiempo) {
      if (e.mirando.a) ctx.mirarA(e, e.mirando.a, 0.15);
      else { e.cabezaYaw += (e.mirando.yaw - e.cabezaYaw) * 0.1; e.cabezaPitch *= 0.9; }
      return;
    }
    e.mirando = null;
    if (lp && Math.random() < (lp.probability !== undefined ? lp.probability : 0.02)) {
      var j = ctx.jugadorCerca(e, lp.look_distance || 8);
      if (j) { e.mirando = { a: j, hasta: e.tiempo + 40 + Math.random() * 40 }; return; }
    }
    if (c['minecraft:behavior.random_look_around'] && Math.random() < 0.02) {
      e.mirando = { yaw: (Math.random() - 0.5) * 1.6, hasta: e.tiempo + 20 + Math.random() * 20 };
      return;
    }
    e.cabezaYaw *= 0.9; e.cabezaPitch *= 0.9;
  }

  // ------------------------------------------------------------------------------------------
  // Las metas de movimiento: puede (empezar), sigue (continuar), paso, inicio, fin. "mira": la
  // meta maneja la cabeza
  // ------------------------------------------------------------------------------------------
  function vel(e, mult) { return e.velBase * (mult || 1) * (e.multVel || 1); }
  function lejosDeJugadores(e, ctx) { return !ctx.jugadorCerca(e, 32); }
  var META = {};
  K.META = META;
  // flotar en el agua (behavior.float): saltar hacia arriba
  META.float = {
    mueve: false, puede: function () { return false; }, paso: function () {}
  };
  // huir cuando le pegan
  META.panic = {
    mueve: true, puede: function (e) { return e.ultimoGolpe !== undefined && e.tiempo - e.ultimoGolpe < 5 && !e.objetivo; },
    inicio: function (e, p, ctx) { e.destino = ctx.puntoAlAzar(e, 5, 4); },
    sigue: function (e, p, ctx, m) { return m.t < 60 && e.destino; },
    paso: function (e, p, ctx, m) {
      if (!e.destino || ctx.llego(e, e.destino) || m.t % 20 === 0) e.destino = ctx.puntoAlAzar(e, 5, 4);
      if (e.destino) ctx.irA(e, e.destino, vel(e, p.speed_multiplier || 1.25));
    }
  };
  // escaparse de ciertos bichos (el creeper del ocelote, el esqueleto del lobo, el aldeano del zombi)
  META.avoid_mob_type = {
    mueve: true,
    puede: function (e, p, ctx) {
      var ts = tipos(p);
      if (!ts) return false;
      var l = ctx.cerca(e, 10);
      for (var i = 0; i < l.length; i++) {
        var x = l[i];
        if (x === e || !vivo(x)) continue;
        for (var k = 0; k < ts.length; k++) {
          var t = ts[k], md = t.max_dist || 6;
          if (dist2(e, x) < md * md && filtro(e, t.filters, x, ctx)) { e.temido = x; e.temidoT = t; return true; }
        }
      }
      return false;
    },
    sigue: function (e, p, ctx, m) { return m.t < 80 && e.temido && vivo(e.temido) && dist2(e, e.temido) < 12 * 12; },
    paso: function (e, p, ctx) {
      var x = e.temido, t = e.temidoT || {};
      var dx = e.x - x.x, dz = e.z - x.z, l = Math.sqrt(dx * dx + dz * dz) || 1;
      var d = Math.sqrt(dist2(e, x));
      ctx.irA(e, { x: e.x + dx / l * 6, y: e.y, z: e.z + dz / l * 6 }, vel(e, d < 4 ? (t.sprint_speed_multiplier || 1.2) : (t.walk_speed_multiplier || 0.8)));
    }
  };
  // pegar cuerpo a cuerpo: ir hasta el objetivo y pegarle cuando está al alcance
  // con "max_dist" (el blaze) pega sólo de cerca: más lejos le toca a la meta siguiente (disparar)
  function aMano(e, p, extra) { return !p.max_dist || dist2(e, e.objetivo) <= (p.max_dist + extra) * (p.max_dist + extra); }
  META.melee_attack = {
    mueve: true, mira: true,
    puede: function (e, p) { return !!(e.objetivo && vivo(e.objetivo)) && aMano(e, p, 0); },
    sigue: function (e, p) { return !!(e.objetivo && vivo(e.objetivo)) && aMano(e, p, 1); },
    inicio: function (e) { e.atacando = true; e.esperaGolpe = 0; },
    fin: function (e) { e.atacando = false; },
    paso: function (e, p, ctx) {
      var o = e.objetivo;
      ctx.mirarA(e, o, 0.4);
      var d2 = dist2(e, o);
      // el alcance como el juego: el doble del ancho al cuadrado más el ancho del otro
      var alcance = (e.ancho * 2) * (e.ancho * 2) * (p.reach_multiplier || 1) + (o.ancho || 0.6);
      if (d2 > alcance * 0.8 || Math.abs(o.y - e.y) > 1.5) ctx.irA(e, o, vel(e, p.speed_multiplier || 1));
      if (--e.esperaGolpe <= 0 && d2 <= alcance + 0.5 && Math.abs(o.y - e.y) < 1.8) {
        e.esperaGolpe = 20;
        e.golpe = 0.01;
        ctx.pegar(e, o);
      }
    }
  };
  META.stomp_attack = META.melee_attack;
  META.ocelotattack = {
    mueve: true, mira: true,
    puede: function (e) { return !!(e.objetivo && vivo(e.objetivo)); },
    sigue: function (e) { return !!(e.objetivo && vivo(e.objetivo)); },
    paso: function (e, p, ctx) { META.melee_attack.paso(e, { speed_multiplier: p.sprint_speed_multiplier || 1.33 }, ctx); }
  };
  // disparar (esqueletos, blazes, ghasts, brujas, shulkers, gólems de nieve, llamas)
  META.ranged_attack = {
    mueve: true, mira: true,
    puede: function (e) { return !!(e.objetivo && vivo(e.objetivo)); },
    sigue: function (e) { return !!(e.objetivo && vivo(e.objetivo)); },
    inicio: function (e, p) {
      e.atacando = true;
      e.esperaDisparo = Math.round(((p.attack_interval_min || 1) + Math.random() * ((p.attack_interval_max || p.attack_interval_min || 3) - (p.attack_interval_min || 1))) * 20);
      e.rafaga = 0;
    },
    fin: function (e) { e.atacando = false; e.apuntando = false; },
    paso: function (e, p, ctx) {
      var o = e.objetivo, radio = p.attack_radius || 15;
      ctx.mirarA(e, o, 0.5);
      var d = Math.sqrt(dist2(e, o)), ve = ctx.ve(e, o);
      // se acerca hasta tenerlo a tiro (los que vuelan y los que no se mueven, no)
      if ((d > radio * 0.75 || !ve) && !e.c['minecraft:behavior.float_wander'] && e.tipo !== 'shulker') ctx.irA(e, o, vel(e, p.speed_multiplier || 1));
      e.apuntando = d < radio;
      if (d > radio || !ve) return;
      if (e.rafaga > 0) {
        // la ráfaga del blaze: tres bolas de fuego seguidas
        if (--e.esperaRafaga <= 0) { e.rafaga--; e.esperaRafaga = Math.round((p.burst_interval || 0.3) * 20); ctx.disparar(e, o); }
        return;
      }
      if (--e.esperaDisparo <= 0) {
        var min = p.attack_interval_min || 1, max = p.attack_interval_max || min || 3;
        e.esperaDisparo = Math.round((min + Math.random() * (max - min)) * 20) || 40;
        // el ghast se carga un segundo (la cara de disparar) y después tira
        if (p.charge_shoot_trigger && !e.cargandoTiro) { e.cargandoTiro = Math.round(p.charge_shoot_trigger * 10); e.esperaDisparo = e.cargandoTiro; return; }
        e.cargandoTiro = 0;
        if (p.burst_shots > 1) { e.rafaga = p.burst_shots - 1; e.esperaRafaga = Math.round((p.burst_interval || 0.3) * 20); }
        ctx.disparar(e, o);
      }
    }
  };
  // la mecha del creeper (la prende un evento: target_nearby_sensor → minecraft:start_exploding)
  META.swell = {
    mueve: true, mira: true,
    puede: function (e) { return e.mecha !== undefined; },
    sigue: function (e) { return e.mecha !== undefined; },
    paso: function (e, p, ctx) { if (e.objetivo) ctx.mirarA(e, e.objetivo, 0.4); ctx.frenar(e); }
  };
  // saltar sobre el objetivo (arañas, lobos, ocelotes)
  META.leap_at_target = {
    mueve: false, puede: function () { return false; }, paso: function () {}
  };
  // las crías siguen a un adulto de su tipo
  META.follow_parent = {
    mueve: true,
    puede: function (e, p, ctx) {
      if (!e.bebe || Math.random() > 0.05) return false;
      var l = ctx.cerca(e, 8), mejor = null, md = 1e9;
      l.forEach(function (o) { if (o !== e && o.tipo === e.tipo && !o.bebe && vivo(o)) { var d = dist2(e, o); if (d < md) { md = d; mejor = o; } } });
      if (!mejor || md < 9) return false;
      e.padre = mejor;
      return true;
    },
    sigue: function (e, p, ctx, m) { return m.t < 200 && e.padre && vivo(e.padre) && dist2(e, e.padre) > 9; },
    paso: function (e, p, ctx) { ctx.irA(e, e.padre, vel(e, p.speed_multiplier || 1.1)); }
  };
  // criar (EntityAIMate): el enamorado busca a otro enamorado que le sirva (breedsWith) a 8 bloques,
  // va hasta él y, juntos 3 segundos, nace la cría
  META.breed = {
    mueve: true, mira: true,
    puede: function (e, p, ctx) {
      if (!(e.amor > 0)) return false;
      var l = ctx.cerca(e, 8), mejor = null, md = 1e9;
      l.forEach(function (o) { if (o.tipo && Trato.pareja(e, o)) { var d = dist2(e, o); if (d < md) { md = d; mejor = o; } } });
      e.pareja = mejor; e.cria = 0;
      return !!mejor;
    },
    sigue: function (e) { return e.amor > 0 && e.pareja && e.pareja.amor > 0 && !(e.pareja.muerte > 0) && e.cria < 60; },
    paso: function (e, p, ctx) {
      var o = e.pareja;
      ctx.mirarA(e, o, 0.3);
      ctx.irA(e, o, vel(e, p.speed_multiplier || 1));
      if (dist2(e, o) < 9 && ++e.cria >= 60 && e.id < o.id) ctx.criar(e, o);
    }
  };
  // seguir al dueño (EntityAIFollowOwner): lejos de "start_distance" va hasta "stop_distance"; a más
  // de 12 bloques aparece al lado
  META.follow_owner = {
    mueve: true,
    puede: function (e, p, ctx) {
      if (!e.dueno || e.sentado) return false;
      var d = ctx.dueno(e);
      if (!d) return false;
      var a = p.start_distance || 10;
      e.duenoRef = d;
      return dist2(e, d) > a * a;
    },
    sigue: function (e, p) { var d = e.duenoRef, b = p.stop_distance || 2; return !e.sentado && !!d && dist2(e, d) > b * b; },
    paso: function (e, p, ctx) {
      var d = e.duenoRef;
      ctx.mirarA(e, d, 0.3);
      if (dist2(e, d) > 144) { ctx.alLado(e, d); return; }
      ctx.irA(e, d, vel(e, p.speed_multiplier || 1));
    }
  };
  // sentado: quieto (EntityAISit)
  META.stay_while_sitting = {
    mueve: true,
    puede: function (e) { return !!e.sentado; },
    sigue: function (e) { return !!e.sentado; },
    paso: function (e, p, ctx) { ctx.frenar(e); e.objetivo = null; }
  };
  // comerciando: quieto y mirando al que comercia (EntityAITradePlayer y EntityAILookAtTradePlayer)
  META.trade_with_player = {
    mueve: true,
    puede: function (e) { return !!e.comerciando; },
    sigue: function (e) { return !!e.comerciando; },
    paso: function (e, p, ctx) { ctx.frenar(e); e.objetivo = null; var j = ctx.jugadorCerca(e, 8); if (j) ctx.mirarA(e, j, 0.3); }
  };
  // el lobo mira al que tiene un hueso (EntityAIBeg)
  META.beg = {
    mueve: false, siempre: true,
    puede: function (e, p, ctx) {
      var j = ctx.jugadorCerca(e, p.look_distance || 8);
      if (j && p.items && ctx.tieneEnMano(j, p.items)) { ctx.mirarA(e, j, 0.3); e.pidiendo = true; } else e.pidiendo = false;
      return false;
    },
    paso: function () {}
  };
  // seguir al jugador que tiene en la mano lo que le gusta (trigo a las vacas, zanahorias a los cerdos)
  META.tempt = {
    mueve: true,
    puede: function (e, p, ctx) {
      var j = ctx.jugadorCerca(e, 10);
      if (!j || !p.items || !ctx.tieneEnMano(j, p.items)) return false;
      e.tentador = j;
      return true;
    },
    sigue: function (e, p, ctx) { return !!(e.tentador && ctx.tieneEnMano(e.tentador, p.items) && dist2(e, e.tentador) < 12 * 12); },
    paso: function (e, p, ctx) {
      ctx.mirarA(e, e.tentador, 0.3);
      if (dist2(e, e.tentador) > 6.25) ctx.irA(e, e.tentador, vel(e, p.speed_multiplier || 1)); else ctx.frenar(e);
    },
    mira: true
  };
  // pasear: cada tanto, un punto al azar cerca
  META.random_stroll = {
    mueve: true,
    puede: function (e, p, ctx) {
      if (e.enAgua && e.nada) return false;
      var cada = p.interval || 120;
      if (Math.random() * cada >= 1) return false;
      e.destino = ctx.puntoAlAzar(e, p.xz_dist || 10, p.y_dist || 7);
      return !!e.destino;
    },
    sigue: function (e, p, ctx, m) { return m.t < 200 && e.destino && !ctx.llego(e, e.destino) && !ctx.trabado(e); },
    paso: function (e, p, ctx) { ctx.irA(e, e.destino, vel(e, p.speed_multiplier || 1)); }
  };
  META.move_towards_restriction = { mueve: false, puede: function () { return false; }, paso: function () {} };
  // volar al azar (murciélagos, ghasts, loros)
  META.float_wander = {
    mueve: true,
    puede: function () { return true; },
    sigue: function () { return true; },
    paso: function (e, p, ctx, m) {
      if (!e.destino || ctx.llego(e, e.destino, 1.5) || m.t % 120 === 0) e.destino = ctx.puntoAlAireAzar(e, e.tipo === 'ghast' ? 16 : 6);
      if (e.destino) ctx.volarA(e, e.destino, e.tipo === 'ghast' ? 0.03 : 0.08);
    }
  };
  META.random_fly = {
    mueve: true,
    puede: function () { return Math.random() < 0.02; },
    sigue: function (e, p, ctx, m) { return m.t < 120 && e.destino && !ctx.llego(e, e.destino, 1); },
    inicio: function (e, p, ctx) { e.destino = ctx.puntoAlAireAzar(e, p.xz_dist || 8); },
    paso: function (e, p, ctx) { if (e.destino) ctx.volarA(e, e.destino, vel(e, p.speed_multiplier || 1) * 0.5); }
  };
  // el calamar: nada para cualquier lado dentro del agua
  META.squid_idle = {
    mueve: true,
    puede: function (e) { return e.enAgua; },
    sigue: function (e) { return e.enAgua; },
    paso: function (e, p, ctx, m) {
      if (!e.destino || m.t % 60 === 0) e.destino = { x: e.x + (Math.random() - 0.5) * 10, y: e.y + (Math.random() - 0.5) * 4, z: e.z + (Math.random() - 0.5) * 10 };
      ctx.nadarA(e, e.destino, 0.04);
    }
  };
  META.squid_move_away_from_ground = META.squid_idle;
  META.squid_flee = META.squid_idle;
  META.squid_dive = META.squid_idle;
  META.squid_out_of_water = { mueve: false, puede: function () { return false; }, paso: function () {} };
  // el slime: salta en una dirección, hacia el objetivo si tiene
  META.slime_random_direction = {
    mueve: true, puede: function () { return true; }, sigue: function () { return true; },
    paso: function (e, p, ctx, m) {
      if (e.objetivo && vivo(e.objetivo)) ctx.mirarA(e, e.objetivo, 1);
      else if (m.t % 60 === 0 || e.dirSlime === undefined) e.dirSlime = Math.random() * PI * 2;
      if (!e.objetivo) e.yaw = e.dirSlime;
      ctx.saltarSlime(e);
    }
  };
  META.slime_keep_on_jumping = META.slime_random_direction;
  META.slime_float = { mueve: false, puede: function () { return false; }, paso: function () {} };
  META.slime_attack = {
    mueve: true, mira: true,
    puede: function (e) { return !!(e.objetivo && vivo(e.objetivo)); },
    sigue: function (e) { return !!(e.objetivo && vivo(e.objetivo)); },
    paso: function (e, p, ctx) {
      ctx.mirarA(e, e.objetivo, 1);
      ctx.saltarSlime(e);
      if (--e.esperaGolpe <= 0 && dist2(e, e.objetivo) < (e.ancho * 0.6 + 0.6) * (e.ancho * 0.6 + 0.6) + 0.5) {
        e.esperaGolpe = 20;
        if (e.ataqueBase) ctx.pegar(e, e.objetivo);
      }
    }
  };
  // el guardián: carga el rayo y después lastima
  META.guardian_attack = {
    mueve: true, mira: true,
    puede: function (e, p, ctx) { return !!(e.objetivo && vivo(e.objetivo) && ctx.ve(e, e.objetivo)); },
    sigue: function (e, p, ctx) { return !!(e.objetivo && vivo(e.objetivo) && ctx.ve(e, e.objetivo) && dist2(e, e.objetivo) < 16 * 16); },
    inicio: function (e) { e.rayo = 0; },
    fin: function (e) { e.rayo = 0; },
    paso: function (e, p, ctx) {
      ctx.mirarA(e, e.objetivo, 0.5);
      ctx.frenar(e);
      e.rayo++;
      if (e.rayo >= 80) { e.rayo = 0; ctx.pegar(e, e.objetivo, 1); }
    }
  };
  // el vex: vuela derecho al objetivo
  META.charge_attack = {
    mueve: true, mira: true,
    puede: function (e) { return !!(e.objetivo && vivo(e.objetivo) && Math.random() < 0.15); },
    sigue: function (e, p, ctx, m) { return m.t < 60 && !!(e.objetivo && vivo(e.objetivo)); },
    inicio: function (e) { e.atacando = true; },
    fin: function (e) { e.atacando = false; },
    paso: function (e, p, ctx) {
      var o = e.objetivo;
      ctx.mirarA(e, o, 0.5);
      ctx.volarA(e, { x: o.x, y: o.y + 0.5, z: o.z }, 0.12);
      if (dist2(e, o) < 1.6 && --e.esperaGolpe <= 0) { e.esperaGolpe = 20; ctx.pegar(e, o); }
    }
  };
  // el evocador: las "summon_choices" de su behavior pack (colmillos en dos rondas alrededor si el
  // objetivo está cerca, una fila hasta él si está lejos, vexes cada tanto), cada una con su tiempo
  // de conjuro y su espera
  META.summon_entity = {
    mueve: true, mira: true,
    puede: function (e, p) {
      if (!(e.objetivo && vivo(e.objetivo))) return false;
      var d = Math.sqrt(dist2(e, e.objetivo)), l = [], total = 0, cs = p.summon_choices || [];
      cs.forEach(function (c, i) {
        if (d < (c.min_activation_range || 0) || (c.max_activation_range !== undefined && d >= c.max_activation_range)) return;
        if (e.esperaConjuro && e.esperaConjuro[i] > e.tiempo) return;
        l.push(i); total += c.weight || 1;
      });
      if (!l.length) return false;
      var x = Math.random() * total, k;
      for (k = 0; k < l.length - 1; k++) { x -= cs[l[k]].weight || 1; if (x <= 0) break; }
      e.conjuro = l[k];
      return true;
    },
    sigue: function (e, p, ctx, m) { var c = p.summon_choices[e.conjuro]; return m.t < (c.cast_duration || 2) * 20; },
    inicio: function (e, p, ctx) {
      var c = p.summon_choices[e.conjuro];
      e.hechizo = true;
      if (c.start_sound_event) ctx.sonar(e, c.start_sound_event);
      e.esperaConjuro = e.esperaConjuro || [];
      e.esperaConjuro[e.conjuro] = e.tiempo + (c.cooldown_time || 5) * 20;
      ctx.conjurar(e, c.sequence || []);
    },
    fin: function (e) { e.hechizo = false; },
    paso: function (e, p, ctx) { if (e.objetivo) ctx.mirarA(e, e.objetivo, 0.5); ctx.frenar(e); }
  };
  // el wither (lo que la 1.2 tiene en código: wither_random_attack_pos_goal): vuela alrededor del
  // objetivo unos bloques más arriba y le tira calaveras con las tres cabezas (la del medio cada 2 s,
  // las de los costados cada 2 a 3 s), como EntityWither
  META.wither_random_attack_pos_goal = {
    mueve: true, mira: true,
    puede: function () { return true; },
    sigue: function () { return true; },
    paso: function (e, p, ctx, m) {
      var o = e.objetivo && vivo(e.objetivo) ? e.objetivo : null;
      if (!o) {
        if (!e.destino || ctx.llego(e, e.destino, 2) || m.t % 100 === 0) e.destino = ctx.puntoAlAireAzar(e, 10);
        if (e.destino) ctx.volarA(e, e.destino, 0.15);
        return;
      }
      // 5 bloques arriba del objetivo (con la armadura, a su altura) y acercándose si está lejos
      var alto = e.vida > e.vidaMax / 2 ? 5 : 0, dx = o.x - e.x, dz = o.z - e.z, cerca = dx * dx + dz * dz <= 9;
      ctx.volarA(e, { x: cerca ? e.x : o.x, y: o.y + alto, z: cerca ? e.z : o.z }, 0.25);
      ctx.mirarA(e, o, 0.5);
      if (!e.cabezas) e.cabezas = [40, 15, 25];
      for (var i = 0; i < 3; i++) {
        if (--e.cabezas[i] > 0) continue;
        if (dist2(e, o) < (i === 0 ? 400 : 900) && ctx.ve(e, o)) {
          ctx.calavera(e, o, i, Math.random() < 0.001);
          e.cabezas[i] = i === 0 ? 40 : 40 + ((Math.random() * 20) | 0);
        } else e.cabezas[i] = 10 + ((Math.random() * 10) | 0);
      }
    }
  };
  // la oveja come pasto (y le vuelve a crecer la lana)
  META.eat_block = {
    mueve: true,
    puede: function (e, p, ctx) { return Math.random() < (e.bebe ? 0.02 : 0.001) && ctx.pastoDebajo(e); },
    sigue: function (e, p, ctx, m) { return m.t < 40; },
    inicio: function (e) { e.come = 0; },
    paso: function (e, p, ctx, m) {
      ctx.frenar(e);
      e.come = m.t < 4 ? m.t / 4 * 0.6 : m.t > 36 ? (40 - m.t) / 4 * 0.6 : 0.6 + Math.sin(m.t * 0.6) * 0.1;
      e.comeY = e.come * 9;
      if (m.t === 30) { ctx.comerPasto(e); disparar(e, p.on_eat || 'minecraft:on_eat_block', null, ctx); }
    },
    fin: function (e) { e.come = 0; e.comeY = 0; }
  };
  // el enderman se lleva y deja bloques
  META.enderman_take_block = {
    mueve: false, siempre: true, puede: function (e, p, ctx) { if (!e.bloqueLlevado && Math.random() < 0.0025) ctx.agarrarBloque(e); return false; }, paso: function () {}
  };
  META.enderman_leave_block = {
    mueve: false, siempre: true, puede: function (e, p, ctx) { if (e.bloqueLlevado && Math.random() < 0.0015) ctx.dejarBloque(e); return false; }, paso: function () {}
  };
  // lo que se lee pero no hace falta mover (o que llega con los objetos y las aldeas)
  ['nearest_attackable_target', 'hurt_by_target', 'look_at_player', 'random_look_around', 'look_at_entity', 'look_at_target',
    'break_door', 'mount_pathing', 'flee_sun', 'restrict_sun', 'owner_hurt_by_target',
    'owner_hurt_target', 'player_ride_tamed', 'run_around_like_crazy', 'find_mount', 'move_through_village', 'move_indoors',
    'restrict_open_door', 'open_door', 'look_at_trading_player', 'trade_with_player', 'make_love', 'receive_love', 'play',
    'pickup_items', 'harvest_farm_block', 'share_items', 'take_flower', 'offer_flower', 'defend_village_target', 'move_towards_target',
    'follow_caravan', 'follow_mob', 'raid_garden', 'send_event', 'silverfish_merge_with_stone', 'silverfish_wake_up_friends',
    'skeleton_horse_trap', 'ocelot_sit_on_block', 'controlled_by_player', 'execute_command',
    'dragonchargeplayer', 'dragondeath', 'dragonflaming', 'dragonholdingpattern', 'dragonlanding', 'dragonscanning',
    'dragonstrafeplayer', 'dragontakeoff'].forEach(function (n) {
    if (!META[n]) META[n] = { mueve: false, puede: function () { return false; }, paso: function () {} };
  });

  // saltar sobre el objetivo: lo maneja bichos.js en el paso (es un salto, no un rumbo)
  K.leap = function (e) { return e.c['minecraft:behavior.leap_at_target'] || null; };

  return K;
})();
