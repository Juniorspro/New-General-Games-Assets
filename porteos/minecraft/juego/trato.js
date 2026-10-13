// porteo: tratar con los bichos, como la 1.2 con los componentes de su behavior pack: lo que se puede
// hacer con cada uno según lo que se tiene en la mano (es el texto del botón de interactuar del
// juego, "action.interact.*") y hacerlo. En orden: "minecraft:interact" (ordeñar, esquilar, el guiso
// de la vaca hongo, ensillar el cerdo, prender el creeper, el cofre del burro...), teñir
// (is_dyeable), curar (healable), hacer crecer a las crías (ageable), enamorar para criar
// (breedable), domesticar (tameable), el temple de los caballos (tamemount), sentar y parar
// (sittable), montar (rideable) y comerciar (trade_table).
var Trato = (function () {
  'use strict';
  var T = {};
  // lo que da la página: gastar(n), cambiar(id, m), desgastar(n), sonar(e, evento), chispas(e, tipo),
  // soltar(cosas, x, y, z), xp(x, y, z, n), montar(e), comerciar(e), nombre()
  var G = null;
  T.iniciar = function (g) { G = g; };
  function lista(v) { return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]; }
  function alguno(l, it) { return lista(l).some(function (x) { return Items.coincide(x, it); }); }
  function de(l, it) { var r = null; lista(l).forEach(function (x) { if (!r && Items.coincide(x, it)) r = x; }); return r; }

  // el jugador como "other" de los filtros: lo que tiene en la mano y si está en creativo
  function otro(it, jug) { return { esJugador: true, enMano: it, creativo: !!(jug && jug.creativo), x: jug ? jug.x : 0, y: jug ? jug.y : 0, z: jug ? jug.z : 0 }; }

  // ------------------------------------------------------------------------------------------
  // minecraft:interact: una o varias entradas { on_interact: { filters, event, target }, use_item,
  // hurt_item, transform_to_item, spawn_items, play_sounds, interact_text, cooldown } (la vaca hongo
  // las trae sin el "on_interact")
  // ------------------------------------------------------------------------------------------
  function interact(e, it, jug) {
    var c = e.c['minecraft:interact'];
    if (!c || (e.esperaInteract && e.tiempo < e.esperaInteract)) return null;
    var l = lista(c), o = otro(it, jug);
    for (var i = 0; i < l.length; i++) {
      var x = l[i], oi = x.on_interact || x;
      if (!oi.filters || !Conducta.filtro(e, oi.filters, o, null)) continue;
      return { texto: x.interact_text || 'action.interact.' + (x.play_sounds === 'shear' ? 'shear' : 'feed'), hacer: hacerInteract.bind(null, e, x, oi, o) };
    }
    return null;
  }
  function hacerInteract(e, x, oi, o) {
    if (x.cooldown) e.esperaInteract = e.tiempo + Math.round(x.cooldown * 20);
    if (x.spawn_items && x.spawn_items.table) {
      G.soltar(Botin.tirar(x.spawn_items.table, { jugador: true, color: e.colorLana || 0 }), e.x, e.y + e.alto * 0.8, e.z);
    }
    if (x.play_sounds) G.sonar(e, x.play_sounds);
    if (x.transform_to_item) {
      var p = String(x.transform_to_item).split(':'), id = Botin.numero(p[0]);
      if (id !== undefined) G.cambiar(id, +p[1] || 0);
    } else if (x.use_item) G.gastar(1);
    if (x.hurt_item) G.desgastar(x.hurt_item);
    if (oi.event) Conducta.disparar(e, { event: oi.event, target: oi.target === 'other' ? 'self' : (oi.target || 'self') }, o, null);
  }

  // ------------------------------------------------------------------------------------------
  // Lo demás
  // ------------------------------------------------------------------------------------------
  // la oveja (y el collar del lobo domesticado) con tinte: el tinte de la 1.2 va de 0 negro a 15
  // blanco y la lana al revés
  function tenir(e, it, jug) {
    if (!e.c['minecraft:is_dyeable'] || it.id !== 351) return null;
    var color = 15 - (it.m & 15);
    if (e.tipo === 'wolf' && (!e.domado || e.dueno !== G.nombre())) return null;
    if (e.tipo === 'sheep' && (e.esquilada || e.colorLana === color)) return null;
    return { texto: e.c['minecraft:is_dyeable'].interact_text || 'action.interact.dye', hacer: function () {
      if (e.tipo === 'wolf') e.collar = color;
      else { e.colorLana = color; e.colorFijo = color; }
      G.gastar(1);
    } };
  }
  // curar con comida (healable: los lobos con carne, los caballos con trigo...)
  function curar(e, it) {
    var h = e.c['minecraft:healable'];
    if (!h || !(e.vida < e.vidaMax || h.force_use)) return null;
    var x = de(h.items, it);
    if (!x) return null;
    if (e.c['minecraft:is_tamed'] === undefined && e.tipo === 'wolf') return null;
    return { texto: 'action.interact.feed', hacer: function () {
      e.vida = Math.min(e.vidaMax, e.vida + (x.heal_amount || 0));
      if (x.effects && x.effects.length && Bichos.darEfecto) x.effects.forEach(function (f) { Bichos.darEfecto(e, Efectos.id(f.name), (f.duration || 0) * 20, f.amplifier | 0); });
      G.sonar(e, 'eat');
      G.gastar(1);
    } };
  }
  // las crías comen y crecen más rápido: lo de "growth" del ítem o un décimo de lo que les falta
  function crecer(e, it) {
    var a = e.c['minecraft:ageable'];
    if (!e.bebe || !a || !a.feedItems) return null;
    var x = de(a.feedItems, it);
    if (!x) return null;
    return { texto: 'action.interact.feed', hacer: function () {
      var falta = Math.max(0, (e.creceEn || 0) - e.tiempo), dur = (a.duration || 1200) * 20;
      var menos = typeof x === 'object' && x.growth ? x.growth * dur : falta * 0.1;
      e.creceEn = (e.creceEn || e.tiempo) - Math.round(menos);
      G.chispas(e, 'verde');
      G.gastar(1);
    } };
  }
  // enamorar (breedable): los adultos sin espera, domesticados si hace falta
  function enamorar(e, it) {
    var b = e.c['minecraft:breedable'];
    if (!b || e.bebe || (e.amor > 0) || (e.esperaCria > 0) || !alguno(b.breedItems, it)) return null;
    if (b.requireTame && !e.domado) return null;
    if (e.sentado && !b.allowSitting) return null;
    return { texto: 'action.interact.feed', hacer: function () {
      e.amor = 600;
      G.chispas(e, 'corazon');
      G.sonar(e, 'eat');
      G.gastar(1);
    } };
  }
  // domesticar (tameable): un tercio de las veces (o lo que diga "probability"); si no, humo
  function domar(e, it) {
    var t = e.c['minecraft:tameable'];
    if (!t || e.domado || !alguno(t.tameItems, it)) return null;
    return { texto: 'action.interact.tame', hacer: function () {
      G.gastar(1);
      if (Math.random() < (t.probability || 0.33)) {
        Conducta.disparar(e, t.tame_event || 'minecraft:on_tame', null, null);
        e.dueno = G.nombre(); e.persiste = true; e.objetivo = null;
        // el lobo y el gato quedan sentados (EntityWolf.processInteract: aiSit.setSitting)
        if (e.c['minecraft:sittable']) e.sentado = true;
        G.chispas(e, 'corazon');
      } else G.chispas(e, 'humo');
    } };
  }
  // el temple del caballo (tamemount): la comida lo calma; montarlo sin domar: si tiene suerte, se
  // deja (rand(maxTemper) < temple); si no, tira al jugador y suma 5
  function templar(e, it) {
    var t = e.c['minecraft:tamemount'];
    if (!t || e.domado || e.bebe) return null;
    if (it) {
      if (alguno(t.autoRejectItems, it)) return null;
      var x = de(t.feedItems, it);
      if (!x) return null;
      return { texto: t.feed_text || 'action.interact.feed', hacer: function () {
        e.temple = Math.min(t.maxTemper || 100, (e.temple || 0) + (x.temperMod || 0));
        if (e.vida < e.vidaMax) e.vida = Math.min(e.vidaMax, e.vida + 2);
        G.sonar(e, 'eat');
        G.gastar(1);
      } };
    }
    return { texto: t.ride_text || 'action.interact.mount', hacer: function () { G.montar(e, t); } };
  }
  // equipar (equippable: la montura y la armadura del caballo, la alfombra de la llama) con lo que
  // corresponde en la mano; la montura dispara su evento (el caballo queda "ensillado": se maneja)
  function equipar(e, it) {
    var eq = e.c['minecraft:equippable'];
    if (!eq || !e.domado || e.bebe) return null;
    var slots = lista(eq.slots);
    for (var i = 0; i < slots.length; i++) {
      var sl = slots[i];
      if (!alguno(sl.accepted_items, it) || (e.equipo && e.equipo[sl.slot])) continue;
      return { texto: sl.slot === 0 ? 'action.interact.saddle' : 'action.interact.armorstand.equip', hacer: (function (sl) {
        return function () {
          e.equipo = e.equipo || {};
          e.equipo[sl.slot] = { id: it.id, m: it.m };
          if (sl.on_equip) Conducta.disparar(e, sl.on_equip, null, null);
          G.sonar(e, sl.slot === 0 ? 'saddle' : 'armor');
          G.gastar(1);
        };
      })(sl) };
    }
    return null;
  }
  // sentar y parar a los domesticados propios
  function sentar(e, it) {
    if (!e.c['minecraft:sittable'] || !e.domado || e.dueno !== G.nombre()) return null;
    return { texto: e.sentado ? 'action.interact.stand' : 'action.interact.sit', hacer: function () { e.sentado = !e.sentado; e.objetivo = null; e.destino = null; } };
  }
  // montar (rideable con la familia "player"): el cerdo ensillado, el caballo domado...
  function montar(e, it) {
    var r = e.c['minecraft:rideable'];
    if (!r || e.bebe || e.jinete) return null;
    var fam = lista(r.family_types);
    if (fam.length && fam.indexOf('player') < 0) return null;
    if (r.crouching_skip_interact && G.agachado && G.agachado()) return null;
    return { texto: r.interact_text || 'action.interact.mount', hacer: function () { G.montar(e, null); } };
  }
  // comerciar con los aldeanos adultos que tienen oficio
  function comerciar(e) {
    var t = e.c['minecraft:trade_table'];
    if (!t || e.bebe) return null;
    return { texto: 'action.interact.trade', hacer: function () { G.comerciar(e, t); } };
  }

  // lo que se puede hacer con un bicho (null: nada); jug: { x, y, z, creativo }
  T.opcion = function (e, it, jug) {
    if (!e || e.muerte > 0 || !e.c) return null;
    var r = interact(e, it, jug);
    // (el caballo sin domar: la comida le sube el temple, además de curarlo)
    if (!r && it && e.c['minecraft:tamemount'] && !e.domado) r = templar(e, it);
    if (!r && it) r = equipar(e, it) || tenir(e, it, jug) || curar(e, it) || crecer(e, it) || enamorar(e, it) || domar(e, it);
    if (!r) r = templar(e, it) || (!it || !esComida(e, it) ? sentar(e, it) : null) || (!it ? montar(e, it) : null) || comerciar(e);
    return r;
  };
  // (con comida de las suyas en la mano no se sienta: el lobo con carne y vida llena no hace nada)
  function esComida(e, it) {
    var b = e.c['minecraft:breedable'], h = e.c['minecraft:healable'];
    return !!((b && alguno(b.breedItems, it)) || (h && alguno(h.items.map(function (x) { return x.item; }), it)));
  }

  // ------------------------------------------------------------------------------------------
  // Criar: dos enamorados que se encuentran (la meta "breed" de conducta.js) tienen una cría
  // (breedsWith: con quién y qué sale; la cría nace con "minecraft:entity_born") y quedan 5 minutos
  // sin poder
  // ------------------------------------------------------------------------------------------
  T.pareja = function (e, o) {
    var b = e.c['minecraft:breedable'];
    if (!b || o === e || !(o.amor > 0) || o.bebe || o.muerte > 0) return null;
    var l = lista(b.breedsWith);
    for (var i = 0; i < l.length; i++) {
      var w = l[i], mate = String(w.mateType || '').replace('minecraft:', '');
      if (mate === o.tipo) return w;
    }
    return null;
  };
  T.criar = function (a, b) {
    var w = T.pareja(a, b);
    if (!w) return null;
    var tipo = String(w.babyType || a.tipo).replace('minecraft:', '');
    var bebe = Bichos.crear(tipo, (a.x + b.x) / 2, Math.max(a.y, b.y), (a.z + b.z) / 2, { bebe: true });
    a.amor = b.amor = 0; a.esperaCria = b.esperaCria = 6000;
    if (bebe) {
      bebe.persiste = true;
      // los perros y gatos nacen del dueño (inheritTamed, salvo los caballos)
      var br = a.c['minecraft:breedable'];
      if (br && br.requireTame && br.inheritTamed !== false && a.dueno) {
        var tm = bebe.c['minecraft:tameable'];
        Conducta.disparar(bebe, tm && tm.tame_event ? tm.tame_event : 'minecraft:on_tame', null, null);
        bebe.dueno = a.dueno;
      }
      // la oveja: el color de uno de los padres (o la mezcla de los tintes, simplificada)
      if (a.tipo === 'sheep') { bebe.colorLana = Math.random() < 0.5 ? a.colorLana : b.colorLana; bebe.colorFijo = bebe.colorLana; }
      G.chispas(bebe, 'corazon');
    }
    // de 1 a 7 de experiencia (EntityAIMate.spawnBaby)
    G.xp(a.x, a.y + 0.5, a.z, 1 + Math.floor(Math.random() * 7));
    return bebe;
  };
  return T;
})();
