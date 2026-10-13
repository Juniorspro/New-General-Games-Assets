// porteo: los bichos de la 1.2, todos: los del behavior pack del APK (vida, tamaño, velocidad, ataque,
// qué hacen, qué pasa al aparecer: bebés, colores, profesiones) interpretados por conducta.js, con la
// física de cada uno (caminan, trepan, vuelan, nadan, saltan como el slime), sus sonidos
// (sounds.json), sus proyectiles (flechas, bolas de nieve y de fuego, pociones, escupitajos, balas del
// shulker), dónde aparecen solos (por bioma, de día o de noche, en la superficie, en las cuevas o en
// el agua) y sus modelos (modelos.js). Con los huevos del inventario se hacen aparecer donde se toca.
//
// En un servidor cada jugador es dueño de los bichos que aparecieron cerca suyo: los mueve él y
// manda dónde están; los de los demás llegan por la red y sólo se dibujan (un golpe a uno ajeno se
// le avisa al dueño). Los monstruos persiguen al jugador más cercano, propio o ajeno.
var Bichos = (function () {
  'use strict';
  var B = {};
  var lista = [];             // los propios
  B.lista = lista;
  var remotos = new Map();    // "dueño/id" → bicho de otro jugador
  var proyectiles = [];
  B.proyectiles = proyectiles;
  var proximoId = 1;
  var D = { entidades: {}, sonidos: { defaults: {}, entities: {} }, variantes: {}, huevos: [] };
  var NOMBRES = [];           // los tipos de bichos (el índice viaja por la red)
  var PI = Math.PI;
  B.activo = true;            // "Aparecen bichos" (opción del mundo)
  B.conVida = false;          // el jugador puede recibir daño (en los servidores)
  B.dificultad = 'normal';
  B.disparados = {};          // cuántos proyectiles de cada tipo (para las pruebas)
  B.TIPOS = {};               // tipo → { familias, hostil, pasivo, agua, vuela }

  // la lana de la oveja ("minecraft:color" de la 1.2: 0 blanco ... 15 negro)
  var LANA = [[1, 1, 1], [0.85, 0.5, 0.2], [0.7, 0.3, 0.85], [0.4, 0.6, 0.85], [0.9, 0.9, 0.2], [0.5, 0.8, 0.1], [0.95, 0.5, 0.65],
    [0.6, 0.6, 0.6], [0.3, 0.3, 0.3], [0.3, 0.5, 0.6], [0.5, 0.25, 0.7], [0.2, 0.3, 0.7], [0.4, 0.3, 0.2], [0.4, 0.5, 0.2],
    [0.6, 0.2, 0.2], [0.1, 0.1, 0.1]];
  // los proyectiles: el "def" del shooter → el modelo que se dibuja
  var PROYECTIL = { arrow: 'arrow', snowball: 'snowball', fireball: 'fireball', small_fireball: 'small_fireball',
    llama_spit: 'llama_spit', llamaspit: 'llama_spit', shulker_bullet: 'shulker_bullet', splash_potion: 'splash_potion',
    egg: 'egg', ender_pearl: 'ender_pearl', xp_bottle: 'xp_bottle', dragon_fireball: 'dragon_fireball',
    wither_skull: 'wither_skull', wither_skull_dangerous: 'wither_skull_dangerous' };

  // lo que los renderers del juego agrandan o achican en código (el modelo es el de siempre y la caja
  // de choque, la del behavior pack): RenderBat 0.35, RenderGhast 4.5, el guardián anciano 2.35...
  var ESCALA_DIBUJO = { bat: 0.35, ghast: 4.5, elder_guardian: 2.35, cave_spider: 0.7, wither: 2, vex: 0.4,
    horse: 1.1, donkey: 0.87, mule: 0.92, villager: 0.9375, witch: 0.9375, vindicator: 0.9375,
    evocation_illager: 0.9375, polar_bear: 1.2 };
  var TAM_SLIME = { slime: true, magma_cube: true };
  // 1, 2 o 4 como en el juego (el grupo de tamaño que tiene)
  function tamSlime(e) {
    var g = (e.grupos || []).join(' ');
    return /slime_large/.test(g) ? 4 : /slime_medium/.test(g) ? 2 : 1;
  }
  function escalaDibujo(tipo, esc, ancho, domado) {
    // el slime se dibuja del tamaño de su caja (el cubo de afuera mide medio bloque)
    if (TAM_SLIME[tipo]) return (ancho || 0.52) / 0.52;
    return esc * (ESCALA_DIBUJO[tipo] || 1) * (tipo === 'ocelot' && domado ? 0.8 : 1);
  }

  B.iniciar = function (datos) {
    D = datos || D;
    Conducta.iniciar(D.entidades);
    NOMBRES = [];
    for (var t in D.entidades) {
      if (!Modelos.existe(t) || PROYECTIL[t]) continue;
      var c = D.entidades[t].c, fam = c['minecraft:type_family'] ? c['minecraft:type_family'].family || [] : [];
      // la vida del slime y del cubo de magma está en los grupos de tamaño (minecraft:slime_large...)
      var g = D.entidades[t].g || {}, conVida = !!c['minecraft:health'];
      for (var k in g) if (g[k]['minecraft:health']) conVida = true;
      if (!conVida && t !== 'ender_dragon') continue;
      NOMBRES.push(t);
      B.TIPOS[t] = { familias: fam, hostil: fam.indexOf('monster') >= 0, pasivo: fam.indexOf('monster') < 0,
        agua: !!c['minecraft:navigation.swim'] || t === 'squid', vuela: !!c['minecraft:can_fly'] || !!c['minecraft:navigation.float'] };
    }
    NOMBRES.sort();
  };
  B.nombres = function () { return NOMBRES.slice(); };
  // los sonidos que puede hacer un bicho (para tenerlos listos cuando aparece)
  B.eventosDe = function (tipo) {
    var s = (D.sonidos.entities || {})[tipo], l = [];
    if (s && s.events) for (var k in s.events) { var v = s.events[k]; l.push(typeof v === 'string' ? v : v.sound); }
    return l.concat(EXTRA_SONIDOS[tipo] || []);
  };
  var EXTRA_SONIDOS = { enderman: ['mob.endermen.portal'], ghast: ['mob.ghast.fireball', 'mob.ghast.charge'], blaze: ['mob.blaze.shoot'],
    wither: ['random.explode'],
    evocation_illager: ['mob.evocation_illager.cast_spell', 'mob.evocation_fangs.attack'] };
  B.huevos = function () { return D.huevos || []; };

  // ------------------------------------------------------------------------------------------
  // Crear (de un huevo, al aparecer solo, por un comando o por otro bicho)
  // ------------------------------------------------------------------------------------------
  B.crear = function (tipo, x, y, z, extra) {
    if (!B.TIPOS[tipo]) return null;
    var e = {
      id: proximoId++, tipo: tipo, modelo: tipo, x: x, y: y, z: z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0,
      yaw: Math.random() * PI * 2, cabezaYaw: 0, cabezaPitch: 0, dano: 0, golpeado: 0, paso: 0, amplitud: 0,
      enPiso: false, enAgua: false, muerte: 0, luz: 0xF0, tiempo: Math.floor(Math.random() * 100), proxSonido: 100 + Math.random() * 200,
      caminado: 0, quema: 0, golpe: 0, esperaGolpe: 0, aire: 300, caida: 1, caidaDist: 0, objetivo: null
    };
    Conducta.nacer(e, ctx, extra && extra.bebe);
    if (tipo === 'horse' && !extra) e.variante = (Math.random() * 7) | 0;
    // el tamaño del slime y del cubo de magma lo elige el juego en código (EntitySlime: 1, 2 o 4,
    // más grandes cuanto más difícil): el behavior pack sólo trae los grupos de cada tamaño
    if (TAM_SLIME[tipo] && !(extra && extra.grupos) && !e.grupos.some(function (g) { return /slime_(large|medium|small)$/.test(g); })) {
      var i = (Math.random() * 3) | 0;
      if (i < 2 && Math.random() < 0.5 * ({ peaceful: 0, easy: 1, normal: 2, hard: 3 }[B.dificultad] || 2) / 3) i++;
      e.grupos.push(['minecraft:slime_small', 'minecraft:slime_medium', 'minecraft:slime_large'][i]);
      Conducta.armar(e);
      e.vida = e.vidaMax;
    }
    if (extra) for (var k in extra) if (k !== 'bebe') e[k] = extra[k];
    if (extra && extra.grupos) { e.grupos = extra.grupos.slice(); Conducta.armar(e); if (extra.vida) e.vida = extra.vida; }
    // los jefes no se van por estar lejos
    if (tipo === 'wither' || tipo === 'ender_dragon') e.persiste = true;
    // el wither recién hecho (EntityWither.ignite): 11 s azul y quieto, curándose desde un tercio
    // de la vida, y después explota y empieza a pelear
    if (tipo === 'wither' && !(extra && extra.grupos)) { e.invulnerable = 220; e.vida = Math.round(e.vidaMax / 3); }
    lista.push(e);
    if (B.alCrear) B.alCrear(e);
    return e;
  };
  B.cuantos = function () { return lista.length; };
  B.limpiar = function () { lista.length = 0; remotos.clear(); proyectiles.length = 0; colmillosEn.length = 0; agenda.length = 0; };

  // ------------------------------------------------------------------------------------------
  // Física (como la del jugador: gravedad, roce, choques eje por eje, subir escalones saltando)
  // ------------------------------------------------------------------------------------------
  function altoBloque(id, m) {
    var f = C.FORMA[id];
    if (f === C.F.losa) return (m & 8) ? [0.5, 1] : [0, 0.5];
    if (f === C.F.capa) return [0, (m & 7) / 8];
    if (f === C.F.bajo) return [0, 15 / 16];
    if (f === C.F.cerca || f === C.F.muro) return [0, 1.5];
    return [0, 1];
  }
  function choca(x0, y0, z0, x1, y1, z1) {
    for (var x = Math.floor(x0); x <= Math.floor(x1); x++)
      for (var y = Math.floor(y0) - 1; y <= Math.floor(y1); y++)
        for (var z = Math.floor(z0); z <= Math.floor(z1); z++) {
          var id = Mundo.bloque(x, y, z);
          if (id === 0) continue;
          if (id < 0) return true;
          if (!C.SOLIDO[id]) continue;
          var a = altoBloque(id, Mundo.meta(x, y, z));
          if (y + a[1] > y0 && y + a[0] < y1) return true;
        }
    return false;
  }
  B.choca = choca;
  function mover(e, dx, dy, dz) {
    var w = e.ancho / 2, h = e.alto, eps = 0.001;
    if (dy && choca(e.x - w + eps, e.y + dy, e.z - w + eps, e.x + w - eps, e.y + dy + h, e.z + w - eps)) {
      if (dy < 0) e.enPiso = true;
      e.vy = 0; dy = 0;
    } else if (dy) e.enPiso = false;
    e.y += dy;
    var chocoX = false, chocoZ = false;
    if (dx && choca(e.x + dx - w, e.y + eps, e.z - w + eps, e.x + dx + w, e.y + h - eps, e.z + w - eps)) { chocoX = true; e.vx = 0; dx = 0; }
    e.x += dx;
    if (dz && choca(e.x - w + eps, e.y + eps, e.z + dz - w, e.x + w - eps, e.y + h - eps, e.z + dz + w)) { chocoZ = true; e.vz = 0; dz = 0; }
    e.z += dz;
    e.chocoH = chocoX || chocoZ;
    return e.chocoH;
  }
  function bloqueEn(x, y, z) { return Mundo.bloque(Math.floor(x), Math.floor(y), Math.floor(z)); }
  function esAgua(b) { return b === 8 || b === 9; }
  function esLava(b) { return b === 10 || b === 11; }
  function liquidos(e) {
    var b = bloqueEn(e.x, e.y + 0.3, e.z), cab = bloqueEn(e.x, e.y + e.alto * 0.85, e.z);
    e.enAgua = esAgua(b); e.enLava = esLava(b); e.cabezaAgua = esAgua(cab);
  }

  // ------------------------------------------------------------------------------------------
  // El contexto que usa conducta.js para mover, mirar, pegar y disparar
  // ------------------------------------------------------------------------------------------
  var jugadores = [];         // [{ x, y, z, id, vivo, esJugador, atacable, ancho, alto, enMano }]
  var diaActual = 1;
  function dist2(a, b) { var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z; return dx * dx + dy * dy + dz * dz; }
  function girarHacia(e, a, k) {
    var d = a - e.yaw;
    while (d > PI) d -= PI * 2;
    while (d < -PI) d += PI * 2;
    e.yaw += d * k;
  }
  function empujar(e, f, a) {
    var k = e.enPiso ? f : (e.enAgua ? f * 0.4 : f * 0.2);
    e.vx += Math.sin(a) * k; e.vz -= Math.cos(a) * k;
  }
  function piso(x, y, z) {
    var ax = Math.floor(x), az = Math.floor(z), ay = Math.floor(y);
    for (var yy = ay; yy >= ay - 3; yy--) { var b = Mundo.bloque(ax, yy, az); if (b !== 0 && (b < 0 || C.SOLIDO[b] || esAgua(b))) return true; }
    return false;
  }
  var ctx = {
    dificultad: 'normal',
    get dia() { return diaActual; },
    brillo: function (e) {
      var l = e.luz === undefined ? 0xF0 : e.luz, cielo = l >> 4, bl = l & 15;
      return Math.max(bl, cielo * diaActual) / 15;
    },
    bioma: function (e) { return NOMBRE_BIOMA[Mundo.bioma ? Mundo.bioma(Math.floor(e.x), Math.floor(e.z)) : 1] || 'plains'; },
    nieve: function (e) { var b = Mundo.bioma ? Mundo.bioma(Math.floor(e.x), Math.floor(e.z)) : 1; return b === 12 || b === 15; },
    bajoTierra: function (e) { return ((e.luz >> 4) || 0) < 8; },
    cerca: function (e, r) {
      var l = [], r2 = r * r;
      for (var i = 0; i < lista.length; i++) if (dist2(e, lista[i]) < r2) l.push(lista[i]);
      for (var k = 0; k < jugadores.length; k++) if (dist2(e, jugadores[k]) < r2) l.push(jugadores[k]);
      return l;
    },
    jugadorCerca: function (e, r) {
      var mejor = null, md = r * r;
      for (var k = 0; k < jugadores.length; k++) { var d = dist2(e, jugadores[k]); if (d < md && jugadores[k].vivo) { md = d; mejor = jugadores[k]; } }
      return mejor;
    },
    // se ven si no hay bloques sólidos en la línea de los ojos (de a medio bloque)
    ve: function (e, o) {
      var x0 = e.x, y0 = e.y + e.alto * 0.85, z0 = e.z, x1 = o.x, y1 = o.y + (o.alto || 1.8) * 0.85, z1 = o.z;
      var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, d = Math.sqrt(dx * dx + dy * dy + dz * dz), n = Math.ceil(d * 2);
      for (var i = 1; i < n; i++) {
        var t = i / n, b = bloqueEn(x0 + dx * t, y0 + dy * t, z0 + dz * t);
        if (b > 0 && C.SOLIDO[b] && C.OPACO && C.OPACO[b]) return false;
        if (b < 0) return false;
      }
      return true;
    },
    mirarA: function (e, o, k) {
      var dx = o.x - e.x, dz = o.z - e.z;
      var a = Math.atan2(dx, -dz);
      // la cabeza mira primero y el cuerpo la sigue (como el "head rotation" del juego)
      girarHacia(e, a, Math.min(1, k * 0.6));
      var rel = a - e.yaw;
      while (rel > PI) rel -= PI * 2;
      while (rel < -PI) rel += PI * 2;
      e.cabezaYaw += (Math.max(-1.2, Math.min(1.2, rel)) - e.cabezaYaw) * k;
      var dy = (o.y + (o.alto || 1.8) * 0.85) - (e.y + e.alto * 0.85);
      e.cabezaPitch += (-Math.atan2(dy, Math.sqrt(dx * dx + dz * dz)) - e.cabezaPitch) * k;
    },
    puntoAlAzar: function (e, xz, yd) {
      for (var n = 0; n < 10; n++) {
        var x = e.x + (Math.random() * 2 - 1) * xz, z = e.z + (Math.random() * 2 - 1) * xz, y = Math.floor(e.y + (Math.random() * 2 - 1) * (yd || 3));
        if (!Mundo.cargado(x, z)) continue;
        // el piso más cercano en esa columna
        for (var yy = y + 3; yy > y - 6; yy--) {
          var b = Mundo.bloque(Math.floor(x), yy - 1, Math.floor(z)), a = Mundo.bloque(Math.floor(x), yy, Math.floor(z));
          if (b !== 0 && (b < 0 || C.SOLIDO[b]) && (a === 0 || !C.SOLIDO[a])) {
            if (esLava(a)) break;
            return { x: Math.floor(x) + 0.5, y: yy, z: Math.floor(z) + 0.5 };
          }
        }
      }
      return null;
    },
    puntoAlAireAzar: function (e, r) {
      for (var n = 0; n < 10; n++) {
        var x = e.x + (Math.random() * 2 - 1) * r, z = e.z + (Math.random() * 2 - 1) * r, y = e.y + (Math.random() * 2 - 1) * r * 0.5;
        if (!Mundo.cargado(x, z)) continue;
        if (e.tipo === 'ghast') y = Math.max(y, e.y - 2);
        var b = bloqueEn(x, y, z);
        if (b === 0) return { x: x, y: y, z: z };
      }
      return null;
    },
    llego: function (e, d, tol) { var dx = d.x - e.x, dz = d.z - e.z, dy = d.y - e.y, t = tol || 0.8; return dx * dx + dz * dz < t * t && Math.abs(dy) < 2; },
    trabado: function (e) { return e.chocoH && e.enPiso && e.saltosTrabado > 3; },
    irA: function (e, d, v) {
      var dx = d.x - e.x, dz = d.z - e.z;
      if (dx * dx + dz * dz < 0.04) return;
      var a = Math.atan2(dx, -dz);
      girarHacia(e, a, 0.35);
      // no tirarse por un barranco (salvo que persiga)
      if (!e.objetivo && e.enPiso && !piso(e.x + Math.sin(e.yaw) * 0.9, e.y, e.z - Math.cos(e.yaw) * 0.9)) { e.destino = null; return; }
      empujar(e, v * v, e.yaw);
      e.quiereSaltar = e.chocoH;
      if (e.enAgua && d.y > e.y) e.vy += 0.03;
    },
    volarA: function (e, d, v) {
      var dx = d.x - e.x, dy = d.y - e.y, dz = d.z - e.z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      e.vx += (dx / l * v - e.vx) * 0.1; e.vy += (dy / l * v - e.vy) * 0.1; e.vz += (dz / l * v - e.vz) * 0.1;
      if (!e.objetivo || e.tipo !== 'ghast') girarHacia(e, Math.atan2(dx, -dz), 0.2);
    },
    nadarA: function (e, d, v) {
      var dx = d.x - e.x, dy = d.y - e.y, dz = d.z - e.z, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      e.vx += dx / l * v * 0.2; e.vy += dy / l * v * 0.2; e.vz += dz / l * v * 0.2;
      girarHacia(e, Math.atan2(dx, -dz), 0.1);
    },
    frenar: function (e) { e.vx *= 0.5; e.vz *= 0.5; },
    pegar: function (e, o, mult) {
      var dn = e.ataqueBase;
      var dano = Array.isArray(dn) ? dn[0] + Math.floor(Math.random() * (dn[1] - dn[0] + 1)) : (typeof dn === 'number' ? dn : (dn && dn.range_min) || 2);
      dano = Math.max(0, Math.round(dano * (mult || 1)));
      // (la dificultad agranda o achica el golpe sólo contra el jugador: lo hace recibirDano)
      sonido(e, 'attack', 1);
      if (o.esJugador) { if (B.golpear) B.golpear(o, dano, e, 'mob'); }
      else herir(o, dano, 'entity_attack', e, (o.x - e.x) * 0.4, (o.z - e.z) * 0.4);
    },
    disparar: function (e, o) { disparar(e, o); },
    saltarSlime: function (e) {
      if (!e.enPiso) return;
      if (--e.esperaSalto > 0) { e.vx *= 0.5; e.vz *= 0.5; return; }
      var tam = tamSlime(e), mj = e.c['minecraft:movement.jump'], jd = mj && mj.jump_delay;
      // cada cuánto salta: "jump_delay" en segundos (calmo o enojado, según el grupo que tenga)
      e.esperaSalto = Array.isArray(jd) ? (jd[0] + Math.random() * (jd[1] - jd[0])) * 20 : (10 + ((Math.random() * 20) | 0)) / (e.objetivo ? 3 : 1);
      e.vy = e.tipo === 'magma_cube' ? 0.42 + tam * 0.1 : 0.42;
      empujar(e, 0.1 + tam * 0.05, e.yaw);
      e.saltando = true;
      sonido(e, 'jump', 0.6);
    },
    contar: function (e, tipo, r) { var n = 0; lista.forEach(function (o) { if (o.tipo === tipo && dist2(e, o) < r * r) n++; }); return n; },
    crear: function (tipo, x, y, z, padre) { var h = B.crear(tipo, x, y, z); if (h && padre && padre.objetivo) Conducta.tomarObjetivo(h, padre.objetivo, ctx); return h; },
    sonar: function (e, ev) { sonido(e, ev, 1); },
    // lo que aparece con un conjuro ("sequence" de summon_choices): colmillos en círculo alrededor o
    // en fila hasta el objetivo, o vexes, cada uno a su tiempo
    conjurar: function (e, seq) {
      var o = e.objetivo;
      seq.forEach(function (s) {
        var tipo = (s.entity_type || '').replace('minecraft:', ''), n = s.num_entities_spawned || 1, tam = s.size || 1;
        var t0 = Math.round((s.base_delay || 0) * 20), cada = (s.delay_per_summon || 0) * 20;
        if (tipo === 'vex' && ctx.contar(e, 'vex', s.summon_cap_radius || 16) >= (s.summon_cap || 8)) return;
        var dir = o ? Math.atan2(o.z - e.z, o.x - e.x) : 0;
        for (var k = 0; k < n; k++) {
          var x, z;
          if (s.shape === 'line') { var r = (k + 1) * tam / n; x = e.x + Math.cos(dir) * r; z = e.z + Math.sin(dir) * r; }
          else { var a = dir + k * PI * 2 / n; x = e.x + Math.cos(a) * tam; z = e.z + Math.sin(a) * tam; }
          var t = t0 + Math.round(k * cada);
          if (tipo === 'evocation_fang') colmillosEn.push({ x: x, y: pisoCerca(x, e.y, z), z: z, t: Math.max(1, t), dueno: e, yaw: dir });
          else agenda.push({ t: t, f: (function (x, z) { return function () { if (e.muerte === 0) ctx.crear(tipo, x, e.y + 1, z, e); }; })(x, z) });
        }
        if (s.sound_event) agenda.push({ t: t0, f: function () { sonido(e, s.sound_event, 1); } });
      });
    },
    // las tres cabezas del wither: la del medio arriba, las otras a los costados (getHeadX/Y/Z)
    calavera: function (e, o, i, peligrosa) {
      var lado = i === 0 ? 0 : (i === 1 ? -1.3 : 1.3), cy = Math.cos(e.yaw), sy = Math.sin(e.yaw);
      disparar(e, o, { tipo: peligrosa ? 'wither_skull_dangerous' : 'wither_skull', x: e.x + cy * lado, y: e.y + (i === 0 ? 3 : 2.2), z: e.z + sy * lado });
    },
    pastoDebajo: function (e) { var b = bloqueEn(e.x, e.y - 0.5, e.z); return b === 2 || bloqueEn(e.x, e.y + 0.2, e.z) === 31; },
    comerPasto: function (e) {
      var X = Math.floor(e.x), Y = Math.floor(e.y), Z = Math.floor(e.z);
      if (Mundo.bloque(X, Y, Z) === 31) { if (B.ponerBloque) B.ponerBloque(X, Y, Z, 0, 0); }
      else if (Mundo.bloque(X, Y - 1, Z) === 2) { if (B.ponerBloque) B.ponerBloque(X, Y - 1, Z, 3, 0); }
    },
    agarrarBloque: function (e) {
      var X = Math.floor(e.x + (Math.random() - 0.5) * 4), Y = Math.floor(e.y + Math.random() * 3), Z = Math.floor(e.z + (Math.random() - 0.5) * 4);
      var b = Mundo.bloque(X, Y, Z);
      // lo que el enderman puede llevarse (pasto, tierra, arena, grava, flores, hongos, calabaza, melón, TNT, arcilla, micelio)
      if ([2, 3, 12, 13, 37, 38, 39, 40, 46, 81, 82, 86, 103, 110].indexOf(b) < 0) return;
      e.bloqueLlevado = [b, Mundo.meta(X, Y, Z)];
      e.cargando = true;
      if (B.ponerBloque) B.ponerBloque(X, Y, Z, 0, 0);
    },
    dejarBloque: function (e) {
      var X = Math.floor(e.x + (Math.random() - 0.5) * 2), Y = Math.floor(e.y + Math.random() * 2), Z = Math.floor(e.z + (Math.random() - 0.5) * 2);
      var b = Mundo.bloque(X, Y, Z), d = Mundo.bloque(X, Y - 1, Z);
      if (b !== 0 || d <= 0 || !C.SOLIDO[d]) return;
      if (B.ponerBloque) B.ponerBloque(X, Y, Z, e.bloqueLlevado[0], e.bloqueLlevado[1]);
      e.bloqueLlevado = null; e.cargando = false;
    },
    tieneEnMano: function (j, items) {
      if (!j || !j.enMano) return false;
      var l = Array.isArray(items) ? items : [items];
      return l.some(function (it) { return Items.coincide(it, j.enMano); });
    },
    // criar: los dos enamorados juntos (trato.js hace la cría)
    criar: function (a, b) { Trato.criar(a, b); },
    // el dueño de un domesticado, si es el jugador de acá y está vivo
    dueno: function (e) { var j = jugadores[0]; return j && j.vivo && e.dueno && e.dueno === B.nombreLocal ? j : null; },
    // aparecer al lado del dueño (EntityAIFollowOwner: en un lugar con piso a 2 bloques)
    alLado: function (e, d) {
      for (var k = 0; k < 10; k++) {
        var x = Math.floor(d.x) + ((Math.random() * 5) | 0) - 2, z = Math.floor(d.z) + ((Math.random() * 5) | 0) - 2, y = Math.floor(d.y);
        if (Math.abs(x - d.x) < 1.5 && Math.abs(z - d.z) < 1.5) continue;
        var ab = Mundo.bloque(x, y - 1, z), a0 = Mundo.bloque(x, y, z), a1 = Mundo.bloque(x, y + 1, z);
        if (ab > 0 && C.SOLIDO[ab] && !(a0 > 0 && C.SOLIDO[a0]) && !(a1 > 0 && C.SOLIDO[a1])) { e.x = e.px = x + 0.5; e.y = e.py = y; e.z = e.pz = z + 0.5; e.vx = e.vy = e.vz = 0; return; }
      }
    },
    explotar: function (e, poder, fuego) { explotar(e, poder, fuego); }
  };
  // los nombres de los biomas del generador como los del juego (para los filtros "is_biome")
  var NOMBRE_BIOMA = ['ocean', 'plains', 'desert', 'extreme_hills', 'forest', 'taiga', 'swamp', 'river', 'beach', 'jungle',
    'birch_forest', 'roofed_forest', 'cold_taiga', 'savanna', 'mesa', 'ice_plains', 'deep_ocean', 'mega_taiga'];
  Conducta.alEvento = function (e, nombre) {
    // el creeper que se enciende suena
    if (nombre === 'minecraft:start_exploding') sonido(e, 'fuse', 1, 'random.fuse');
  };

  // ------------------------------------------------------------------------------------------
  // Sonidos (sounds.json: entity_sounds)
  // ------------------------------------------------------------------------------------------
  function sonido(e, ev, vol, directo) {
    if (!B.sonido) return;
    var s = (D.sonidos.entities || {})[e.tipo], dflt = D.sonidos.defaults || {};
    var def = (s && s.events && s.events[ev]) || (dflt.events && dflt.events[ev]);
    if (!def) { if (directo) B.sonido(directo, e, vol || 1, 1); return; }
    var nombre = typeof def === 'string' ? def : def.sound;
    if (!nombre) return;
    var v = (typeof def === 'object' && typeof def.volume === 'number' ? def.volume : (s && typeof s.volume === 'number' ? s.volume : 1)) * (vol || 1);
    var p = typeof def === 'object' && def.pitch !== undefined ? def.pitch : (s ? s.pitch : 1);
    var tono = Array.isArray(p) ? p[0] + Math.random() * (p[1] - p[0]) : (typeof p === 'number' ? p : 1);
    if (e.bebe) tono *= 1.4;
    B.sonido(nombre, e, v, tono);
  }

  // ------------------------------------------------------------------------------------------
  // Un paso (1/20 s) de todos los propios. jug: [{ x, y, z, id (null el propio), vivo, enMano }]
  // ------------------------------------------------------------------------------------------
  var tick = 0, colmillosEn = [], agenda = [];
  // el piso más cercano a una altura (donde salen los colmillos)
  function pisoCerca(x, y, z) {
    var X = Math.floor(x), Z = Math.floor(z), Y = Math.floor(y);
    for (var k = 0; k < 4; k++) {
      if (!C.SOLIDO[Mundo.bloque(X, Y, Z)] && C.SOLIDO[Mundo.bloque(X, Y - 1, Z)]) return Y;
      if (C.SOLIDO[Mundo.bloque(X, Y, Z)]) Y++; else Y--;
    }
    return Math.floor(y);
  }
  // el wither naciendo: azul y quieto, se cura de a 10 cada medio segundo y al final explota
  function nacerWither(e) {
    e.vx = e.vy = e.vz = 0;
    if (e.tiempo % 10 === 0) e.vida = Math.min(e.vidaMax, e.vida + 10);
    if (--e.invulnerable > 0) return;
    explosionEn(e.x, e.y + 2.5, e.z, 7, false, e);
    sonido(e, 'spawn', 1);
  }
  B.paso = function (jug, dia) {
    tick++;
    diaActual = dia;
    jugadores = jug.map(function (j) {
      return { x: j.x, y: j.y, z: j.z, id: j.id, vivo: j.vivo !== false, esJugador: true, atacable: B.conVida && j.vivo !== false,
        ancho: 0.6, alto: 1.8, enMano: j.enMano || null, ref: j, vis: j.vis || 1 };
    });
    ctx.dificultad = B.dificultad;
    var yo = jugadores[0];
    for (var i = lista.length - 1; i >= 0; i--) {
      var e = lista[i];
      e.px = e.x; e.py = e.y; e.pz = e.z;
      e.tiempo++;
      if (e.dano > 0) e.dano = Math.max(0, e.dano - 0.1);
      if (e.golpeado > 0) e.golpeado--;
      if (e.golpe > 0) { e.golpe += 0.15; if (e.golpe >= 1) e.golpe = 0; }
      // muriendo: se da vuelta en un segundo y se va en una nube
      if (e.muerte > 0) {
        if (e.atado) B.desatar(e, true);
        e.muerte += 0.05;
        if (e.muerte >= 1) { lista.splice(i, 1); morirDel_todo(e); continue; }
        e.vy -= 0.08; mover(e, 0, e.vy, 0);
        continue;
      }
      // lejos del jugador: se van (los monstruos antes, y no los domados ni los con nombre)
      var d2 = yo ? dist2(e, yo) : 0, T = B.TIPOS[e.tipo];
      if (!e.persiste && (d2 > (T.hostil ? 80 * 80 : 128 * 128) || !Mundo.cargado(e.x, e.z))) { lista.splice(i, 1); continue; }
      if (!e.persiste && T.hostil && d2 > 40 * 40 && Math.random() < 1 / 600) { lista.splice(i, 1); continue; }
      // en pacífico los monstruos se van (EntityMob.onUpdate; el dragón no es un EntityMob)
      if (B.dificultad === 'peaceful' && T.hostil && e.tipo !== 'ender_dragon') { lista.splice(i, 1); continue; }
      if (e.invulnerable > 0) { nacerWither(e); continue; }
      liquidos(e);
      e.quiereSaltar = false;
      // enamorado: corazones cada medio segundo y se le pasa a los 30 s; después de criar, 5 min
      if (e.amor > 0) { e.amor--; if (e.amor % 10 === 0 && B.corazones) B.corazones(e); }
      if (e.esperaCria > 0) e.esperaCria--;
      // la gallina pone un huevo cada 5 a 10 minutos (minecraft:spawn_entity)
      var se = e.c['minecraft:spawn_entity'];
      if (se && !e.bebe) {
        if (e.esperaHuevo === undefined) e.esperaHuevo = Math.round(((se.min_wait_time || 300) + Math.random() * ((se.max_wait_time || 600) - (se.min_wait_time || 300))) * 20);
        if (--e.esperaHuevo <= 0) {
          e.esperaHuevo = undefined;
          if (B.ponerHuevo) B.ponerHuevo(e, se.spawn_item || 'egg');
          sonido(e, se.spawn_sound || 'plop', 1, 'mob.chicken.plop');
        }
      }
      pasoEfectosBicho(e);
      if (e.muerte > 0) continue;
      if (e.control) conducir(e, e.control);
      else if (!(e.atado && correa(e))) Conducta.paso(e, ctx);
      if (!lista[i] || lista[i] !== e) continue;        // explotó
      fisica(e);
      danos(e);
      // sonidos de a ratos
      if (--e.proxSonido <= 0) {
        e.proxSonido = 80 + Math.random() * 160;
        if (d2 < 24 * 24) sonido(e, 'ambient', 1);
      }
    }
    pasoProyectiles();
    pasoColmillos();
    pasoAgenda();
  };
  // el bicho montado y manejado por el jugador: mira para donde mira él y anda con lo que aprieta
  // (c: { yaw, pitch, adelante, costado, vel (multiplicador), salto (velocidad hacia arriba) })
  function conducir(e, c) {
    var d = c.yaw - e.yaw;
    while (d > PI) d -= PI * 2;
    while (d < -PI) d += PI * 2;
    e.yaw += d * 0.5;
    e.cabezaYaw = 0; e.cabezaPitch = (c.pitch || 0) * 0.5;
    var len = Math.sqrt(c.adelante * c.adelante + c.costado * c.costado);
    if (len > 0.01) {
      var a = c.yaw + Math.atan2(c.costado, c.adelante), v = e.velBase * (c.vel || 1) * (e.multVel || 1);
      empujar(e, v * v * Math.min(1, len) * 2, a);
    }
    if (c.salto && e.enPiso) { e.vy = c.salto; e.saltando = true; if (c.impulso) { e.vx += Math.sin(e.yaw) * c.impulso; e.vz -= Math.cos(e.yaw) * c.impulso; } }
    c.salto = 0; c.impulso = 0;
    e.meta = null;
  }
  B.sonar = function (e, ev, vol, directo) { sonido(e, ev, vol || 1, directo); };
  function fisica(e) {
    var vuela = e.vuela && (e.tipo !== 'parrot' || (e.meta && e.meta.n === 'random_fly'));
    var nada = (e.nada || e.tipo === 'squid') && e.enAgua;
    if (vuela || nada) {
      // los que vuelan y los que nadan: sin gravedad, con roce
      if (e.tipo === 'blaze' && !e.objetivo) e.vy -= 0.01;
      if (nada) e.vy -= 0.003;
      mover(e, e.vx, e.vy, e.vz);
      var r = nada ? 0.9 : 0.91;
      e.vx *= r; e.vy *= r; e.vz *= r;
    } else {
      if (e.enAgua || e.enLava) {
        e.vx *= 0.8; e.vz *= 0.8; e.vy *= 0.8; e.vy -= 0.02;
        // flotan (behavior.float)
        if (e.c['minecraft:behavior.float'] && e.cabezaAgua !== false && Math.random() < 0.8) e.vy += 0.04;
      } else {
        e.vy -= 0.08; e.vy *= 0.98;
        if (e.tipo === 'chicken' && e.vy < -0.05) e.vy = -0.05;      // la gallina planea
      }
      // saltar sobre el objetivo (arañas, lobos)
      var lp = Conducta.leap(e);
      if (lp && e.objetivo && e.enPiso && Math.random() < 0.2) {
        var dd = dist2(e, e.objetivo);
        if (dd > 4 && dd < 16) { e.vy = lp.yd || 0.4; var a = Math.atan2(e.objetivo.x - e.x, -(e.objetivo.z - e.z)); e.vx += Math.sin(a) * 0.4; e.vz -= Math.cos(a) * 0.4; }
      }
      var yAntes = e.y, piso0 = e.enPiso;
      var choco = mover(e, e.vx, e.vy, e.vz);
      if (choco && e.enPiso && (Math.abs(e.vx) + Math.abs(e.vz) > 0.001 || e.quiereSaltar || e.destino)) { e.vy = 0.42; e.saltosTrabado = (e.saltosTrabado || 0) + 1; }
      else if (!choco) e.saltosTrabado = 0;
      if (choco && e.trepa) e.vy = 0.2;                                // las arañas trepan
      if (choco && (e.enAgua || e.enLava)) e.vy = 0.3;
      var roce = e.enPiso ? 0.546 : 0.91;
      if (!e.enAgua && !e.enLava) { e.vx *= roce; e.vz *= roce; }
      // las caídas
      if (!e.enPiso && e.y < yAntes) e.caidaDist += yAntes - e.y;
      if (e.enAgua || e.enLava) e.caidaDist = 0;
      if (e.enPiso && !piso0) {
        if (e.caidaDist > 3 && e.caida > 0) herir(e, Math.ceil((e.caidaDist - 3) * e.caida), 'fall', null);
        if (e.saltando) { e.aplastado = -0.5; e.saltando = false; sonido(e, 'land', 0.6); }
        e.caidaDist = 0;
      }
    }
    if (e.aplastado !== undefined) e.aplastado *= 0.6;
    if (e.saltando && !e.enPiso) e.aplastado = 1;
    // el andar (las patas y los pasos)
    var andado = Math.sqrt((e.x - e.px) * (e.x - e.px) + (e.z - e.pz) * (e.z - e.pz));
    e.paso += andado * 2.4;
    e.amplitud += (Math.min(1, andado * 6) - e.amplitud) * 0.4;
    e.caminado += andado;
    if (e.enPiso && e.caminado > 1.6) { e.caminado = 0; sonido(e, 'step', 1); }
    if (e.y < -20) herir(e, 100, 'void', null);
  }
  function danos(e) {
    // el sol a los muertos vivos, el agua a los endermans y blazes, la lava y el fuego a todos (menos
    // a los del Nether), el aire a los que no respiran agua
    if (e.quemaSol && diaActual > 0.5 && (e.luz >> 4) >= 15 && !e.enAgua && !e.bebe) e.quema = Math.max(e.quema, 20);
    if (e.enLava && !e.sinFuego) e.quema = Math.max(e.quema, 300);
    if (e.enAgua) e.quema = 0;
    if (e.quema > 0) {
      e.quema--;
      if (!e.sinFuego && tick % 20 === 0) herir(e, 1, 'fire', null);
    }
    if (e.enLava && !e.sinFuego && tick % 10 === 0) herir(e, 4, 'lava', null);
    if (e.mojado && (e.enAgua) && tick % 10 === 0) { herir(e, 1, 'drowning', null); if (e.c['minecraft:teleport']) teletransportar(e); }
    var resp = e.c['minecraft:breathable'];
    if (resp) {
      var bajoAgua = e.cabezaAgua;
      var respiraAgua = !!resp.breathesWater, respiraAire = resp.breathesAir !== false;
      var ahoga = (bajoAgua && !respiraAgua) || (!bajoAgua && !respiraAire && !e.enAgua);
      if (ahoga) { if (--e.aire <= -20) { e.aire = 0; herir(e, 2, 'drowning', null); } }
      else e.aire = Math.min(300, e.aire + 4);
    }
    // el enderman se teletransporta solo de a ratos (y siempre si le pega el agua)
    var tp = e.c['minecraft:teleport'];
    if (tp && tp.randomTeleports && Math.random() < 1 / ((tp.maxRandomTeleportTime || 30) * 20)) teletransportar(e);
  }
  function teletransportar(e) {
    for (var n = 0; n < 16; n++) {
      var x = e.x + (Math.random() - 0.5) * 32, z = e.z + (Math.random() - 0.5) * 32, y = Math.floor(e.y + (Math.random() - 0.5) * 16);
      if (!Mundo.cargado(x, z)) continue;
      for (var yy = y; yy > y - 10; yy--) {
        var b = Mundo.bloque(Math.floor(x), yy - 1, Math.floor(z));
        if (b > 0 && C.SOLIDO[b] && !choca(x - e.ancho / 2, yy, z - e.ancho / 2, x + e.ancho / 2, yy + e.alto, z + e.ancho / 2)) {
          if (esAgua(Mundo.bloque(Math.floor(x), yy, Math.floor(z)))) break;
          sonido(e, 'teleport', 1, 'mob.endermen.portal');
          e.x = e.px = x; e.y = e.py = yy; e.z = e.pz = z; e.vx = e.vy = e.vz = 0;
          sonido(e, 'teleport', 1, 'mob.endermen.portal');
          return true;
        }
      }
    }
    return false;
  }

  // ------------------------------------------------------------------------------------------
  // Daño, muerte
  // ------------------------------------------------------------------------------------------
  function herir(e, dano, causa, quien, kx, kz) {
    if (e.muerte > 0 || dano <= 0 || e.invulnerable > 0) return false;
    // el wither no se lastima con lo suyo (sus calaveras, su explosión)
    if (e.tipo === 'wither' && quien === e) return false;
    if (!Conducta.recibeDano(e, causa, quien, ctx)) { Conducta.herido(e, quien, ctx); return false; }
    if (causa === 'fire' || causa === 'lava' ? e.sinFuego : false) return false;
    e.vida -= dano; e.dano = 1;
    e.ultimoDano = causa;
    if (kx || kz) { var l = Math.sqrt(kx * kx + kz * kz) || 1, kr = e.c['minecraft:knockback_resistance'] ? 0.3 : 1; e.vx += kx / l * 0.4 * kr; e.vz += kz / l * 0.4 * kr; e.vy = 0.36 * kr; }
    if (e.vida <= 0) {
      e.muerte = 0.01;
      e.asesino = quien || null;
      sonido(e, 'death', 1);
      // el slime grande se parte en chicos
      if (TAM_SLIME[e.tipo] && tamSlime(e) > 1) partir(e);
    } else sonido(e, 'hurt', 1);
    Conducta.herido(e, quien, ctx);
    // al enderman le pegan con un proyectil: se va
    if (causa === 'projectile' && e.c['minecraft:teleport']) teletransportar(e);
    return true;
  }
  B.herir = herir;
  function partir(e) {
    var n = 2 + ((Math.random() * 3) | 0), nombreG = tamSlime(e) > 2 ? 'minecraft:slime_medium' : 'minecraft:slime_small';
    for (var i = 0; i < n; i++) {
      var h = B.crear(e.tipo, e.x + (Math.random() - 0.5) * e.ancho * 0.5, e.y + 0.5, e.z + (Math.random() - 0.5) * e.ancho * 0.5);
      if (!h) continue;
      h.grupos = h.grupos.filter(function (g) { return !/large|medium|small/.test(g); });
      h.grupos.push(nombreG);
      Conducta.armar(h);
      h.vida = h.vidaMax;
    }
  }
  function morirDel_todo(e) {
    if (B.alMorir) B.alMorir(e, e.golpeJugador !== undefined && tick - e.golpeJugador < 100);
  }
  B.tamSlime = tamSlime;
  // un golpe del jugador (propio o ajeno): con el tiempo de invulnerabilidad del juego (medio segundo)
  B.golpe = function (e, dano, kx, kz, quien) {
    if (e.golpeado > 0 || e.muerte > 0) return false;
    e.golpeado = 10;
    var j = quien || jugadores[0] || null;
    // para la experiencia: el juego la da si el jugador le pegó en los últimos 5 segundos
    if (!quien) e.golpeJugador = tick;
    herir(e, dano, 'entity_attack', j, kx, kz);
    return true;
  };

  // ------------------------------------------------------------------------------------------
  // Explosiones (creeper, bolas de fuego del ghast)
  // ------------------------------------------------------------------------------------------
  function explotar(e, poder, fuego) {
    var i = lista.indexOf(e);
    if (i >= 0) lista.splice(i, 1);
    explosionEn(e.x, e.y + (e.alto || 0.5) * 0.5, e.z, poder, fuego, e);
  }
  // una explosión en un lugar (la del creeper, las bolas de fuego, las calaveras, el wither al
  // nacer): los bichos de alrededor se lastiman como en Explosion.doExplosionB (el daño baja con la
  // distancia hasta el doble del poder) y salen volando
  function explosionEn(x, y, z, poder, fuego, quien) {
    lista.forEach(function (o) {
      var d = Math.sqrt(dist2(o, { x: x, y: y - (o.alto || 1) * 0.5, z: z })), imp = 1 - d / (poder * 2);
      if (imp > 0) herir(o, Math.floor((imp * imp + imp) / 2 * 7 * poder * 2 + 1), 'entity_explosion', quien, o.x - x, o.z - z);
    });
    if (B.explosion) B.explosion(x, y, z, Math.round(poder), jugadoresRef(), quien, fuego);
  }
  B.explosionEn = explosionEn;
  // los domesticados del jugador defienden al dueño: van contra el que lo lastimó y contra lo que él
  // ataca (salvo otros domesticados suyos)
  B.duenoHerido = function (quien) {
    if (!quien || !quien.tipo) return;
    lista.forEach(function (e) { if (e.dueno === B.nombreLocal && !e.sentado && e.c['minecraft:behavior.owner_hurt_by_target'] && e !== quien) Conducta.tomarObjetivo(e, quien, ctx); });
  };
  B.duenoAtaco = function (victima) {
    if (!victima || !victima.tipo || victima.dueno === B.nombreLocal) return;
    lista.forEach(function (e) { if (e.dueno === B.nombreLocal && !e.sentado && e.c['minecraft:behavior.owner_hurt_target'] && e !== victima) Conducta.tomarObjetivo(e, victima, ctx); });
  };

  // ------------------------------------------------------------------------------------------
  // La correa (minecraft:leashable): atado al jugador ('j') o a un poste ({ x, y, z } del cerco).
  // Más lejos que soft_distance camina hacia la otra punta, más que hard_distance además lo
  // arrastra y más que max_distance se corta y la correa queda en el piso
  // (EntityCreature.updateLeashedState, con las distancias del behavior pack)
  // ------------------------------------------------------------------------------------------
  B.puntaCorrea = null;      // (de la página) dónde está la otra punta de lo que dice e.atado: { x, y, z } o null
  B.alSoltarCorrea = null;   // (de la página) la correa que queda en el piso
  B.atar = function (e, a) {
    var l = e.c['minecraft:leashable'];
    if (!l || e.muerte > 0) return false;
    e.atado = a; e.persiste = true;
    if (l.on_leash) Conducta.disparar(e, l.on_leash, null, null);
    return true;
  };
  B.desatar = function (e, soltar) {
    if (!e.atado) return;
    var l = e.c['minecraft:leashable'];
    e.atado = null;
    if (l && l.on_unleash) Conducta.disparar(e, l.on_unleash, null, null);
    if (soltar && B.alSoltarCorrea) B.alSoltarCorrea(e);
  };
  // true: esta vez lo mueve la correa (no su conducta)
  function correa(e) {
    var l = e.c['minecraft:leashable'], p = l && B.puntaCorrea ? B.puntaCorrea(e.atado) : null;
    if (!p) { B.desatar(e, true); return false; }
    var dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z, f = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (f > (l.max_distance || 10)) { B.desatar(e, true); return false; }
    if (e.sentado || f <= (l.soft_distance || 4)) return false;
    if (f > (l.hard_distance || 6)) {
      var ux = dx / f, uy = dy / f, uz = dz / f;
      e.vx += ux * Math.abs(ux) * 0.4; e.vy += uy * Math.abs(uy) * 0.4; e.vz += uz * Math.abs(uz) * 0.4;
    }
    e.objetivo = null; e.destino = null;
    if (e.vuela) ctx.volarA(e, p, e.velBase * (e.multVel || 1)); else ctx.irA(e, p, e.velBase * (e.multVel || 1));
    return true;
  }
  B.atadosA = function (a) {
    return lista.filter(function (e) { return e.atado && (e.atado === a || (a !== 'j' && e.atado !== 'j' && e.atado.x === a.x && e.atado.y === a.y && e.atado.z === a.z)); });
  };

  // ------------------------------------------------------------------------------------------
  // Los efectos en los bichos (efectos.js): los muertos vivientes al revés con la curación y el
  // daño instantáneos y sin veneno ni regeneración; las arañas sin veneno
  // ------------------------------------------------------------------------------------------
  function familia(e, f) { var T = B.TIPOS[e.tipo]; return !!(T && T.familias.indexOf(f) >= 0); }
  function ganchosDe(e) {
    return {
      curar: function (n) { if (e.vida > 0 && !(e.muerte > 0)) e.vida = Math.min(e.vidaMax || e.vida, e.vida + n); },
      danar: function (n, causa) { herir(e, n, causa || 'magic', null); },
      cansar: function () {}, comer: function () {},
      vida: function () { return e.vida; }
    };
  }
  B.darEfecto = function (e, id, dur, amp) {
    if (!id || e.muerte > 0) return;
    var muerto = familia(e, 'undead');
    if ((id === 19 || id === 25 || id === 10) && (muerto || (id !== 10 && familia(e, 'spider')))) return;
    if (Efectos.INSTANTANEO[id]) {
      var real = muerto && (id === 6 || id === 7) ? (id === 6 ? 7 : 6) : id;
      Efectos.instantaneo(real, amp, ganchosDe(e), 1);
      return;
    }
    if (!e.efectos) e.efectos = Efectos.nuevo();
    Efectos.dar(e.efectos, id, dur, amp);
  };
  function pocionEnBicho(e, m, mult, tipo, quien) {
    var pc = Efectos.pocion(m);
    if (!pc) return;
    var muerto = familia(e, 'undead');
    if (Efectos.INSTANTANEO[pc[0]]) {
      var real = muerto && (pc[0] === 6 || pc[0] === 7) ? (pc[0] === 6 ? 7 : 6) : pc[0];
      if (real === 7) herir(e, Math.floor((6 << pc[2]) * mult), 'magic', quien);
      else if (real === 6) e.vida = Math.min(e.vidaMax || e.vida, e.vida + (4 << pc[2]) * mult);
      return;
    }
    var dur = pc[1] * (tipo === 'linger' ? 0.25 : 0.75) * mult;
    if (dur > 20) B.darEfecto(e, pc[0], dur, pc[2]);
  }
  function pasoEfectosBicho(e) {
    if (!e.efectos || !e.efectos.lista.length) { e.multVel = 1; return; }
    Efectos.paso(e.efectos, ganchosDe(e));
    e.multVel = Math.max(0, (1 + 0.2 * Efectos.nivel(e.efectos, 1)) * (1 - 0.15 * Efectos.nivel(e.efectos, 2)));
  }
  function jugadoresRef() { return jugadores.map(function (j) { return j.ref; }); }

  // ------------------------------------------------------------------------------------------
  // Proyectiles ("minecraft:projectile" de entities/*.json: power, gravity, inertia, onHit)
  // ------------------------------------------------------------------------------------------
  // op (si viene): { tipo, x, y, z } un proyectil y un lugar de salida que no son los de siempre
  // (las calaveras del wither salen de cada cabeza)
  function disparar(e, o, op) {
    var sh = e.c['minecraft:shooter'];
    var tipo = op && op.tipo ? op.tipo : sh && sh.def ? sh.def.replace('minecraft:', '') : (e.tipo === 'witch' ? 'splash_potion' : 'arrow');
    var def = Conducta.def(tipo) || Conducta.def(tipo.replace('_', ''));
    var pr = def && def.c['minecraft:projectile'] ? def.c['minecraft:projectile'] : { power: 1.5, gravity: 0.05 };
    var ox = op && op.x !== undefined ? op.x : e.x, oy = op && op.y !== undefined ? op.y : e.y + e.alto * 0.85 - 0.1, oz = op && op.z !== undefined ? op.z : e.z;
    var tx = o.x, ty = o.y + (o.alto || 1.8) * 0.6, tz = o.z;
    var dx = tx - ox, dy = ty - oy, dz = tz - oz, dh = Math.sqrt(dx * dx + dz * dz);
    // la flecha apunta un poco más arriba según la distancia (como el esqueleto del juego)
    if ((pr.gravity || 0) > 0) dy += dh * 0.2;
    var l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    var potencia = pr.power || 1.5, inc = ((pr.uncertaintyBase || 0) - (B.dificultad === 'hard' ? 2 : B.dificultad === 'easy' ? 0 : 1) * (pr.uncertaintyMultiplier || 0)) * 0.0075;
    var p = {
      tipo: PROYECTIL[tipo] || 'arrow', def: pr, dueno: e, objetivo: o, x: ox + dx / l * 0.6, y: oy, z: oz + dz / l * 0.6,
      vx: (dx / l + gauss() * inc) * potencia, vy: (dy / l + gauss() * inc) * potencia, vz: (dz / l + gauss() * inc) * potencia,
      vida: 0, luz: 0xF0, tiempo: 0
    };
    if (p.tipo === 'splash_potion' && e.tipo === 'witch') p.pocion = pocionBruja(e, o);
    proyectiles.push(p);
    B.disparados[p.tipo] = (B.disparados[p.tipo] || 0) + 1;
    sonido(e, 'shoot', 1, tipo === 'arrow' ? 'random.bow' : tipo === 'snowball' ? 'random.bow' : null);
    if (tipo === 'fireball' || tipo === 'small_fireball') sonido(e, 'shoot', 1, tipo === 'fireball' ? 'mob.ghast.fireball' : 'mob.blaze.shoot');
  }
  // lo que tira el jugador (EntityThrowable, EntityArrow): sale de los ojos hacia (dx, dy, dz) a
  // velocidad v, con el desvío del juego (0,0075 por un azar gaussiano). op: { critico, pocion,
  // persistente, recoger (la flecha se levanta del piso) }
  B.lanzar = function (tipo, x, y, z, dx, dy, dz, v, op) {
    var def = Conducta.def(tipo), pr = def && def.c['minecraft:projectile'] ? def.c['minecraft:projectile'] : { power: 1.5, gravity: 0.03 };
    if (tipo === 'arrow' && def && def.g && def.g['minecraft:player_arrow']) pr = def.g['minecraft:player_arrow']['minecraft:projectile'] || pr;
    op = op || {};
    var p = { tipo: PROYECTIL[tipo] || tipo, def: pr, dueno: jugadores[0] || null, deJugador: true, x: x, y: y, z: z,
      vx: (dx + gauss() * 0.0075) * v, vy: (dy + gauss() * 0.0075) * v, vz: (dz + gauss() * 0.0075) * v, vida: 0, luz: 0xF0, tiempo: 0,
      critico: !!op.critico, pocion: op.pocion, persistente: !!op.persistente, recoger: !!op.recoger };
    proyectiles.push(p);
    B.disparados[p.tipo] = (B.disparados[p.tipo] || 0) + 1;
    return p;
  };
  // la poción de la bruja (EntityWitch.attackEntityWithRangedAttack): lentitud de lejos, veneno si
  // tiene vida, debilidad de cerca a veces; si no, daño
  function pocionBruja(e, o) {
    var d = Math.sqrt(dist2(e, o)), ef = function (id) { return B.tieneEfecto ? B.tieneEfecto(o, id) : false; };
    if (d >= 8 && !ef(2)) return 17;
    if ((o.vida === undefined || o.vida >= 8) && !ef(19)) return 25;
    if (d <= 3 && !ef(18) && Math.random() < 0.25) return 34;
    return 23;
  }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.8; }
  function pasoProyectiles() {
    for (var i = proyectiles.length - 1; i >= 0; i--) {
      var p = proyectiles[i], d = p.def;
      p.tiempo++;
      if (p.clavado) {
        // la flecha del jugador clavada se levanta al pasar (EntityArrow.onCollideWithPlayer)
        var jj = jugadores[0];
        if (p.recoger && jj && jj.vivo && Math.abs(jj.x - p.x) < 1 && Math.abs(jj.z - p.z) < 1 && p.y > jj.y - 0.5 && p.y < jj.y + 2.3 &&
            B.alRecogerFlecha && B.alRecogerFlecha()) { proyectiles.splice(i, 1); continue; }
        if (++p.vida > 1200) proyectiles.splice(i, 1);
        continue;
      }
      if (++p.vida > 400) { proyectiles.splice(i, 1); continue; }
      // la bala del shulker sigue al objetivo
      if (d.homing && p.objetivo) {
        var hx = p.objetivo.x - p.x, hy = p.objetivo.y + 0.9 - p.y, hz = p.objetivo.z - p.z, hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
        p.vx += (hx / hl * 0.4 - p.vx) * 0.1; p.vy += (hy / hl * 0.4 - p.vy) * 0.1; p.vz += (hz / hl * 0.4 - p.vz) * 0.1;
      }
      // avanzar de a pedacitos: el primer bloque o bicho que toca
      var n = Math.max(1, Math.ceil(Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz) * 4)), choco = null;
      for (var k = 0; k < n && !choco; k++) {
        var nx = p.x + p.vx / n, ny = p.y + p.vy / n, nz = p.z + p.vz / n;
        var b = bloqueEn(nx, ny, nz);
        if (b < 0 || (b > 0 && C.SOLIDO[b])) { choco = { bloque: true }; break; }
        var quien = tocaEntidad(p, nx, ny, nz);
        if (quien) { choco = { entidad: quien }; break; }
        p.x = nx; p.y = ny; p.z = nz;
      }
      if (choco) { impacto(p, choco, i); continue; }
      var agua = esAgua(bloqueEn(p.x, p.y, p.z));
      var inercia = d.inertia !== undefined ? d.inertia : 0.99;
      if (agua) inercia = d.liquid_inertia !== undefined ? d.liquid_inertia : 0.6;
      p.vx *= inercia; p.vy *= inercia; p.vz *= inercia;
      p.vy -= d.gravity !== undefined ? d.gravity : 0.05;
    }
  }
  function tocaEntidad(p, x, y, z) {
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      if (e === p.dueno && p.vida < 5) continue;
      if (e.muerte > 0) continue;
      var w = e.ancho / 2 + 0.15;
      if (x > e.x - w && x < e.x + w && z > e.z - w && z < e.z + w && y > e.y - 0.1 && y < e.y + e.alto + 0.1) return e;
    }
    for (var k = 0; k < jugadores.length; k++) {
      var j = jugadores[k];
      if (!j.vivo || (p.deJugador && !j.id && p.vida < 5)) continue;
      if (x > j.x - 0.45 && x < j.x + 0.45 && z > j.z - 0.45 && z < j.z + 0.45 && y > j.y - 0.1 && y < j.y + 1.9) return j;
    }
    return null;
  }
  // con qué se murió el jugador (los mensajes death.attack.arrow, .fireball, .thrown)
  var CAUSA_PROYECTIL = { arrow: 'projectile', small_fireball: 'fireball', fireball: 'fireball', dragon_fireball: 'fireball',
    snowball: 'thrown', egg: 'thrown', thrown_trident: 'projectile' };
  function impacto(p, choco, i) {
    var hit = p.def.onHit || {};
    var o = choco.entidad;
    if (o && p.deJugador && !o.esJugador) o.golpeJugador = tick;
    if (o && hit.impact_damage) {
      var id = hit.impact_damage, dn = id.damage;
      var dano = Array.isArray(dn) ? dn[0] + Math.floor(Math.random() * (dn[1] - dn[0] + 1)) : (dn || 1);
      // la flecha del jugador lastima según su velocidad (EntityArrow: velocidad × 2, hacia arriba;
      // la crítica, con el arco tenso del todo, suma al azar hasta la mitad + 2)
      if (p.deJugador && p.tipo === 'arrow') {
        dano = Math.ceil(Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz) * 2);
        if (p.critico) dano += Math.floor(Math.random() * (dano / 2 + 2));
      }
      // la bola de nieve sólo lastima al blaze
      if (id.filter && !(o.tipo && o.tipo === id.filter)) dano = 0;
      if (dano > 0) {
        if (o.esJugador) { if (B.golpear && o.atacable) B.golpear(o, dano, p.dueno || p, CAUSA_PROYECTIL[p.tipo] || 'mob'); }
        else herir(o, dano, 'projectile', p.dueno, id.knockback ? p.vx : 0, id.knockback ? p.vz : 0);
        if (id.catchFire && !o.esJugador && !o.sinFuego) o.quema = 100;
      }
    }
    var calavera = p.tipo === 'wither_skull' || p.tipo === 'wither_skull_dangerous';
    if (o && calavera && o !== p.dueno) {
      // EntityWitherSkull.onImpact: 8 de daño (y el wither se cura 5)
      if (o.esJugador) { if (B.golpear && o.atacable) B.golpear(o, 8, p.dueno || p, 'mob'); }
      else herir(o, 8, 'projectile', p.dueno);
      if (p.dueno && p.dueno.vida > 0 && p.dueno.muerte === 0) p.dueno.vida = Math.min(p.dueno.vidaMax, p.dueno.vida + 5);
    }
    if (hit.definition_event || p.tipo === 'fireball' || p.tipo === 'dragon_fireball') {
      // la bola de fuego del ghast y las calaveras del wither explotan (las calaveras sin fuego)
      proyectiles.splice(i, 1);
      explosionEn(p.x, p.y, p.z, 1, !calavera, p.dueno);
      return;
    }
    if (p.tipo === 'splash_potion') {
      // la poción (EntityPotion.applySplash): a todos a menos de 4 bloques, más cuanto más cerca (al
      // que le pegó, entera); sin poción conocida, el daño de antes
      [].concat(lista, jugadores).forEach(function (x) {
        var d2 = dist2(x, p);
        if (d2 >= 16 || (x === p.dueno && !p.deJugador)) return;
        var mult = x === o ? 1 : 1 - Math.sqrt(d2) / 4;
        if (p.pocion === undefined) {
          if (x.esJugador) { if (B.golpear && x.atacable) B.golpear(x, 6, p.dueno || p, 'magic'); } else herir(x, 6, 'magic', p.dueno);
        } else if (x.esJugador) { if (!x.id && B.alPocion) B.alPocion(p.pocion, mult, p.persistente ? 'linger' : 'splash', p.dueno && p.dueno.tipo ? p.dueno : null); }
        else pocionEnBicho(x, p.pocion, mult, p.persistente ? 'linger' : 'splash', p.dueno);
      });
      if (B.sonido) B.sonido('random.glass', p, 1, 0.9 + Math.random() * 0.1);
      if (B.chispas) B.chispas(p.x, p.y, p.z, p.pocion);
      proyectiles.splice(i, 1);
      return;
    }
    // el huevo: 1 de 8 veces un pollito (y 1 de 32 de esas, cuatro)
    if (p.tipo === 'egg') {
      var sc = hit.spawn_chance || {};
      if (Math.random() < 1 / (sc.firstSpawnChance || 8)) {
        var nh = Math.random() < 1 / (sc.secondSpawnChance || 32) ? (sc.secondSpawnCount || 4) : (sc.firstSpawnCount || 1);
        for (var q = 0; q < nh; q++) B.crear('chicken', p.x, p.y, p.z, { bebe: true });
      }
      if (B.chispas) B.chispas(p.x, p.y, p.z, -1);
      proyectiles.splice(i, 1);
      return;
    }
    // la perla: lleva al dueño adonde cayó (y a veces sale un endermite)
    if (p.tipo === 'ender_pearl') {
      if (p.deJugador && B.alPerla) B.alPerla(p.x, p.y, p.z);
      if (Math.random() < 0.05) B.crear('endermite', p.x, p.y, p.z);
      proyectiles.splice(i, 1);
      return;
    }
    // la botella de experiencia: de 3 a 11 de experiencia en orbes
    if (p.tipo === 'xp_bottle') {
      var gx = hit.grant_xp || {}, mn = gx.minXP || 3, mx = gx.maxXP || 11;
      if (B.alExperiencia) B.alExperiencia(p.x, p.y, p.z, mn + Math.floor(Math.random() * (mx - mn + 1)));
      if (B.sonido) B.sonido('random.glass', p, 1, 0.9 + Math.random() * 0.1);
      if (B.chispas) B.chispas(p.x, p.y, p.z, 0);
      proyectiles.splice(i, 1);
      return;
    }
    if (p.tipo === 'snowball' && B.chispas) B.chispas(p.x, p.y, p.z, -2);
    if (choco.bloque && hit.stick_in_ground) {
      p.clavado = true; p.vida = 0;
      if (B.sonido) B.sonido('random.bowhit', p, 0.5, 1.2);
      return;
    }
    if (o && B.sonido && p.tipo === 'arrow') B.sonido('random.bowhit', p, 0.6, 1.1);
    proyectiles.splice(i, 1);
  }
  // los colmillos del evocador: muerden después de un rato donde salieron
  function pasoColmillos() {
    for (var i = colmillosEn.length - 1; i >= 0; i--) {
      var f = colmillosEn[i];
      // después de morder quedan 22 pasos para la animación (suben, se cierran y se hunden)
      if (f.mordio) { if (++f.mordio > 22) colmillosEn.splice(i, 1); continue; }
      if (--f.t > 0) continue;
      f.mordio = 1;
      [].concat(lista, jugadores).forEach(function (x) {
        // no muerden al evocador ni a los suyos (EntityEvokerFangs.damage: isOnSameTeam)
        if (x === f.dueno || x.tipo === 'vex' || x.tipo === 'vindicator' || x.tipo === 'evocation_illager') return;
        if (Math.abs(x.x - f.x) < 1 && Math.abs(x.z - f.z) < 1 && x.y + (x.alto || 1.8) > f.y && x.y < f.y + 1.5) {
          if (x.esJugador) { if (B.golpear && x.atacable) B.golpear(x, 6, f.dueno || f, 'magic'); } else herir(x, 6, 'magic', f.dueno);
        }
      });
      if (B.sonido) B.sonido('mob.evocation_fangs.attack', f, 1, 1);
    }
  }
  // lo que un bicho dejó para más tarde (lo que aparece con un conjuro)
  function pasoAgenda() {
    for (var i = agenda.length - 1; i >= 0; i--) if (--agenda[i].t <= 0) { var a = agenda[i]; agenda.splice(i, 1); a.f(); }
  }

  // ------------------------------------------------------------------------------------------
  // Aparecer solos: los animales en el pasto con luz (de a grupos), el calamar en el agua, los
  // murciélagos en las cuevas oscuras y los monstruos donde está oscuro (de noche afuera, o en las
  // cuevas), cada uno en sus biomas (como la 1.2). Las posiciones candidatas se miden con la luz del
  // trabajador (luces: [x, y, z, ...] → valores), así que esto pide y después decide
  // ------------------------------------------------------------------------------------------
  // biomas del generador: 0 océano, 1 llanura, 2 desierto, 3 colinas, 4 bosque, 5 taiga, 6 pantano,
  // 7 río, 8 playa, 9 jungla, 10 abedul, 11 bosque oscuro, 12 taiga fría, 13 sabana, 14 mesa,
  // 15 llanura helada, 16 océano profundo, 17 megataiga
  var ANIMALES = { sheep: 12, pig: 10, chicken: 10, cow: 8 };
  function animalesDe(b) {
    var t = {};
    if (b === 2 || b === 14) return { rabbit: 4 };
    if (b === 15) return { rabbit: 10, polar_bear: 1 };
    if (b === 0 || b === 16 || b === 7 || b === 8) return {};
    for (var k in ANIMALES) t[k] = ANIMALES[k];
    if (b === 1) { t.horse = 5; t.donkey = 1; }
    if (b === 13) { t.horse = 1; t.donkey = 1; t.llama = 2; }
    if (b === 3) t.llama = 5;
    if (b === 4 || b === 10) t.wolf = 5;
    if (b === 5 || b === 17 || b === 12) { t.wolf = 8; t.rabbit = 4; }
    if (b === 9) { t.ocelot = 2; t.parrot = 40; t.chicken = 10; }
    return t;
  }
  function monstruosDe(b) {
    var t = { spider: 100, zombie: 95, zombie_villager: 5, skeleton: 100, creeper: 100, enderman: 10, witch: 5 };
    if (b === 2 || b === 14) { t.zombie = 19; t.zombie_villager = 1; t.husk = 80; }
    if (b === 15 || b === 12) { t.skeleton = 20; t.stray = 80; }
    if (b === 6) t.slime = 100;
    return t;
  }
  function elegir(t) {
    var total = 0, k;
    for (k in t) if (B.TIPOS[k]) total += t[k];
    var x = Math.random() * total;
    for (k in t) { if (!B.TIPOS[k]) continue; x -= t[k]; if (x <= 0) return k; }
    return null;
  }
  var GRUPO = { sheep: [2, 4], pig: [2, 4], cow: [2, 4], chicken: [2, 4], horse: [2, 6], donkey: [1, 3], llama: [4, 6], wolf: [4, 4],
    rabbit: [2, 3], ocelot: [1, 3], parrot: [1, 2], polar_bear: [1, 2], squid: [2, 4], bat: [1, 2],
    zombie_pigman: [2, 4], magma_cube: [1, 4], enderman: [1, 4] };
  // el Nether (Biome.Hell): de a 4, a cualquier altura y sin mirar el sol (el ghast una vez cada 20 y
  // con lugar para él; el enderman, en lo oscuro)
  var INFIERNO = { ghast: 50, zombie_pigman: 100, magma_cube: 2, enderman: 1 };
  B.dimension = 0;
  function candidatoInfierno(yo) {
    var a = Math.random() * PI * 2, r = 16 + Math.random() * 28;
    var x = Math.floor(yo.x + Math.cos(a) * r), z = Math.floor(yo.z + Math.sin(a) * r), y = 6 + Math.floor(Math.random() * 116);
    if (!Mundo.cargado(x, z)) return;
    for (var k = 0; k < 24 && y > 4; k++, y--) {
      var b = Mundo.bloque(x, y, z), ab = Mundo.bloque(x, y - 1, z);
      if (b === 0 && Mundo.bloque(x, y + 1, z) === 0 && ab > 0 && C.SOLIDO[ab] && !esLava(ab)) { candidatos.push({ x: x, y: y, z: z, clase: 'infierno' }); return; }
    }
  }
  function libre(x0, y0, z0, w, h, d) {
    for (var x = x0; x < x0 + w; x++) for (var y = y0; y < y0 + h; y++) for (var z = z0; z < z0 + d; z++) if (Mundo.bloque(x, y, z) !== 0) return false;
    return true;
  }
  var candidatos = [];
  B.candidatos = function (yo, dia, cuantosJug) {
    candidatos = [];
    if (!B.activo) return candidatos;
    var pas = 0, hos = 0, agua = 0, aire = 0;
    lista.forEach(function (e) { var T = B.TIPOS[e.tipo]; if (T.agua) agua++; else if (e.tipo === 'bat') aire++; else if (T.hostil) hos++; else pas++; });
    var tope = Math.max(2, Math.round(10 / Math.max(1, cuantosJug)));
    if (B.dimension === 1) {
      for (var nn = 0; nn < 4 && hos < tope; nn++) candidatoInfierno(yo);
      return candidatos;
    }
    if (B.dimension) return candidatos;
    for (var n = 0; n < 4; n++) {
      var a = Math.random() * PI * 2, r = 22 + Math.random() * 22;
      var x = Math.floor(yo.x + Math.cos(a) * r), z = Math.floor(yo.z + Math.sin(a) * r);
      if (!Mundo.cargado(x, z)) continue;
      var bioma = Mundo.bioma ? Mundo.bioma(x, z) : 1;
      // el piso de arriba de todo (sin hojas: debajo de los árboles) o el agua
      var top = -1, enAguaTop = false;
      for (var y = C.ALTO - 2; y > 1; y--) {
        var b = Mundo.bloque(x, y, z);
        if (esAgua(b)) { top = y; enAguaTop = true; break; }
        if (b > 0 && C.SOLIDO[b] && b !== 18 && b !== 161) { top = y; break; }
        if (esLava(b)) break;
      }
      if (top < 0) continue;
      if (enAguaTop) {
        if (agua < 5 && (bioma === 0 || bioma === 16 || bioma === 7) && Math.random() < 0.3) candidatos.push({ x: x, y: top - 1 - ((Math.random() * 3) | 0), z: z, clase: 'agua' });
        continue;
      }
      var suelo = Mundo.bloque(x, top, z);
      var pastoso = suelo === 2 || ((bioma === 2 || bioma === 14) && (suelo === 12 || suelo === 24)) || (bioma === 15 && (suelo === 80 || suelo === 78 || suelo === 2));
      if (pas < tope * 0.8 && pastoso && Math.random() < 0.3) candidatos.push({ x: x, y: top + 1, z: z, clase: 'animal', bioma: bioma });
      else if (hos < tope || aire < 2) {
        // en la superficie, o en un hueco de cueva abajo
        var yy = top + 1, cueva = false;
        if (Math.random() < 0.5) {
          var hy = top - 4 - Math.floor(Math.random() * 40);
          for (; hy > 4; hy--) if (Mundo.bloque(x, hy, z) === 0 && Mundo.bloque(x, hy + 1, z) === 0 && C.SOLIDO[Mundo.bloque(x, hy - 1, z)] && Mundo.bloque(x, hy - 1, z) > 0) break;
          if (hy > 4) { yy = hy; cueva = true; }
        }
        candidatos.push({ x: x, y: yy, z: z, clase: cueva && aire < 2 && Math.random() < 0.3 ? 'murcielago' : (hos < tope ? 'monstruo' : null), bioma: bioma });
      }
    }
    return candidatos;
  };
  // con la luz de cada candidato (cielo << 4 | bloques) y qué tan de día es (0 a 1)
  B.aparecer = function (luces, dia) {
    for (var i = 0; i < candidatos.length && i < luces.length; i++) {
      var c = candidatos[i], l = luces[i];
      if (l < 0 || !c.clase) continue;
      var cielo = l >> 4, bloque = l & 15, efectiva = Math.max(bloque, Math.round(cielo * dia));
      if (c.clase === 'infierno') {
        if (B.dificultad === 'peaceful') continue;
        var tn = elegir(INFIERNO);
        if (tn === 'ghast') {
          if (Math.random() < 1 / 20 && libre(c.x - 2, c.y, c.z - 2, 4, 4, 4)) B.crear('ghast', c.x + 0.5, c.y, c.z + 0.5);
          continue;
        }
        if (tn === 'enderman' && bloque > 7) continue;
        grupo(tn, c);
      } else if (c.clase === 'animal') {
        if (cielo < 9) continue;
        grupo(elegir(animalesDe(c.bioma)), c);
      } else if (c.clase === 'agua') {
        grupo('squid', c, true);
      } else if (c.clase === 'murcielago') {
        if (efectiva > 3) continue;
        grupo('bat', c);
      } else {
        if (efectiva > 7 || bloque > 7 || B.dificultad === 'peaceful') continue;
        if (Mundo.bloque(c.x, c.y, c.z) !== 0 || Mundo.bloque(c.x, c.y + 1, c.z) !== 0) continue;
        var tipo = elegir(monstruosDe(c.bioma));
        // el slime del pantano: de noche y en la superficie
        if (tipo === 'slime' && c.y < 50) continue;
        if (tipo) B.crear(tipo, c.x + 0.5, c.y, c.z + 0.5);
      }
    }
    candidatos = [];
  };
  function grupo(tipo, c, agua) {
    if (!tipo) return;
    var g = GRUPO[tipo] || [1, 1], n = g[0] + ((Math.random() * (g[1] - g[0] + 1)) | 0);
    for (var k = 0; k < n; k++) {
      var x = c.x + 0.5 + (Math.random() - 0.5) * 3, z = c.z + 0.5 + (Math.random() - 0.5) * 3;
      var b = Mundo.bloque(Math.floor(x), c.y, Math.floor(z));
      if (agua ? esAgua(b) : b === 0) B.crear(tipo, x, c.y, z);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Para dibujar (interpolados entre pasos), para pedir la luz y para la red
  // ------------------------------------------------------------------------------------------
  function texturaDe(e) {
    var v = D.variantes[e.tipo];
    if (!v) return null;
    if (e.tipo === 'wolf') return v[e.enojado ? 2 : e.domado ? 1 : 0] || null;
    // el wither naciendo: azul, y en los últimos 4 s titila (RenderWither.getEntityTexture)
    if (e.tipo === 'wither') { var iv = e.invulnerable || 0; return v[iv > 0 && (iv > 80 || ((iv / 5) | 0) % 2 !== 1) ? 1 : 0] || null; }
    return v[e.variante] || null;
  }
  var dibujo = [];
  function paraDibujarUno(e, alfa) {
    var x = e.px + (e.x - e.px) * alfa, y = e.py + (e.y - e.py) * alfa, z = e.pz + (e.z - e.pz) * alfa;
    var sl = e.tipo === 'slime' || e.tipo === 'magma_cube';
    var esc = escalaDibujo(e.tipo, e.escala || 1, e.ancho, e.domado), escalas = null;
    // el wither crece mientras nace (de 1,5 a 2)
    if (e.invulnerable > 0) esc *= 1 - (e.invulnerable - alfa) / 220 * 0.25;
    if (sl) {
      // RenderSlime: se estira al saltar y se aplasta al caer
      var a = e.aplastado || 0, f2 = a / (tamSlime(e) * 0.5 + 1), f3 = 1 / (f2 + 1);
      escalas = [f3, 1 / f3, f3];
    }
    var mostrar = null;
    if (e.tipo === 'donkey' || e.tipo === 'mule') mostrar = { MuleEarL: true, MuleEarR: true };
    if (e.conCofre) { mostrar = mostrar || {}; mostrar.Bag1 = mostrar.Bag2 = mostrar.chest1 = mostrar.chest2 = true; }
    if (e.ensillado) { mostrar = mostrar || {}; ['Saddle', 'SaddleB', 'SaddleC', 'SaddleL', 'SaddleL2', 'SaddleR', 'SaddleR2', 'SaddleMouthL', 'SaddleMouthR', 'SaddleMouthLine', 'SaddleMouthLineR', 'HeadSaddle'].forEach(function (k) { mostrar[k] = true; }); }
    return {
      modelo: e.modelo, x: x, y: y, z: z, yaw: e.yaw, cabezaYaw: e.cabezaYaw, cabezaPitch: e.cabezaPitch,
      paso: e.paso, amplitud: e.amplitud, luz: e.luz, dano: e.dano, tiempo: e.tiempo + alfa, escala: esc, escalas: escalas,
      cayendo: !e.enPiso && e.vy < 0, muerte: e.muerte, quema: e.quema > 0, golpe: e.golpe, atacando: e.atacando,
      apuntando: e.apuntando, hechizo: e.hechizo, cargando: e.cargando, sentado: e.sentado, enojado: !!e.enojoHasta,
      domado: e.domado, vida: e.vida, bebe: e.bebe, vuela: e.vuela && !e.enPiso, colgado: false, come: e.come, comeY: e.comeY,
      salto: e.saltando ? Math.min(1, (e.tiempo % 10) / 10) : 0, aplastado: e.aplastado, peek: e.objetivo ? 1 : 0,
      textura: texturaDe(e), lana: e.esquilada ? null : LANA[e.colorLana] || null,
      ocultos: e.esquilada ? LANA_OCULTA : null, mostrar: mostrar, radio: e.ancho, alto: e.alto, ref: e
    };
  }
  var LANA_OCULTA = null;
  B.paraDibujar = function (alfa) {
    dibujo.length = 0;
    lista.forEach(function (e) { dibujo.push(paraDibujarUno(e, alfa)); });
    remotos.forEach(function (e) { dibujo.push(e); });
    // los colmillos del evocador mientras muerden (RenderEvokerFangs: el doble de grandes y al final
    // se achican)
    colmillosEn.forEach(function (f) {
      if (!f.mordio) return;
      var pr = Math.min(1, Math.max(0, (f.mordio - 2 + alfa) / 20)), esc = pr > 0.9 ? (1 - pr) / 0.1 : 1;
      dibujo.push({ modelo: 'evocation_fang', x: f.x, y: f.y, z: f.z, yaw: f.yaw || 0, cabezaYaw: 0, cabezaPitch: 0, paso: 0, amplitud: 0,
        luz: f.luz || 0xF0, tiempo: 0, escala: esc, progreso: pr, radio: 0.5, alto: 1 });
    });
    proyectiles.forEach(function (p) {
      var sp = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
      dibujo.push({ modelo: p.tipo, x: p.x, y: p.y - 0.15, z: p.z, yaw: Math.atan2(p.vx, -p.vz) + PI, pitch: p.clavado ? p.pitchFijo || 0 : (p.pitchFijo = -Math.atan2(p.vy, sp)),
        cabezaYaw: 0, cabezaPitch: 0, paso: 0, amplitud: 0, luz: p.luz, tiempo: p.tiempo + alfa, escala: 1, radio: 0.3, alto: 0.5 });
    });
    return dibujo;
  };
  B.todos = function () { return lista; };
  B.posiciones = function () {
    var p = [];
    lista.forEach(function (e) { p.push(Math.floor(e.x), Math.floor(e.y + 0.5), Math.floor(e.z)); });
    remotos.forEach(function (e) { p.push(Math.floor(e.x), Math.floor(e.y + 0.5), Math.floor(e.z)); });
    return p;
  };
  B.ponerLuces = function (v) {
    var i = 0;
    lista.forEach(function (e) { if (i < v.length && v[i] >= 0) e.luz = v[i]; i++; });
    remotos.forEach(function (e) { if (i < v.length && v[i] >= 0) e.luz = v[i]; i++; });
  };
  // el bicho que toca un rayo (desde o, dirección d, hasta máximo): { e, t, remoto }
  B.rayo = function (ox, oy, oz, dx, dy, dz, maximo) {
    var mejor = null;
    function probar(e, remoto) {
      if (e.muerte > 0) return;
      var w = (e.ancho || 0.6) / 2 + 0.1, h = e.alto || 1.8;
      var t = cajaRayo(ox, oy, oz, dx, dy, dz, e.x - w, e.y, e.z - w, e.x + w, e.y + h + 0.1, e.z + w);
      if (t !== null && t <= maximo && (!mejor || t < mejor.t)) mejor = { e: e, t: t, remoto: remoto };
    }
    lista.forEach(function (e) { probar(e, false); });
    remotos.forEach(function (e) { probar(e, true); });
    return mejor;
  };
  function cajaRayo(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    var tmin = 0, tmax = 1e9, o = [ox, oy, oz], d = [dx, dy, dz], a = [x0, y0, z0], b = [x1, y1, z1];
    for (var k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] < a[k] || o[k] > b[k]) return null; continue; }
      var t1 = (a[k] - o[k]) / d[k], t2 = (b[k] - o[k]) / d[k];
      if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin;
  }
  B.cajaRayo = cajaRayo;

  // lo que se manda por la red: los propios, compactos
  // [id, tipo, x, y, z, yaw, cabeza, pitch, estado, variante | color << 8, escala*100]
  B.paraRed = function () {
    return lista.map(function (e) {
      var est = (e.dano > 0.5 ? 1 : 0) | (e.muerte > 0 ? 2 : 0) | (e.quema > 0 ? 4 : 0) | (e.esquilada ? 8 : 0) | (e.atacando ? 16 : 0) |
        (e.domado ? 32 : 0) | (e.enojoHasta ? 64 : 0) | (e.vuela && !e.enPiso ? 128 : 0);
      return [e.id, NOMBRES.indexOf(e.tipo), +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +e.yaw.toFixed(2),
        +e.cabezaYaw.toFixed(2), +e.cabezaPitch.toFixed(2), est, (e.variante || 0) | ((e.colorLana || 0) << 8),
        Math.round((TAM_SLIME[e.tipo] ? e.ancho / 0.52 : e.escala || 1) * 100)];
    });
  };
  B.desdeRed = function (dueno, l) {
    var ahora = performance.now();
    if (!Array.isArray(l)) return;
    l.slice(0, 40).forEach(function (r) {
      if (!Array.isArray(r) || r.length < 9) return;
      var tipo = NOMBRES[r[1]];
      if (!tipo || typeof r[2] !== 'number' || typeof r[3] !== 'number' || typeof r[4] !== 'number') return;
      var k = dueno + '/' + r[0], e = remotos.get(k);
      if (!e) {
        e = { tipo: tipo, modelo: tipo, dueno: dueno, mid: r[0], x: r[2], y: r[3], z: r[4], tx: r[2], ty: r[3], tz: r[4], yaw: r[5], paso: 0,
          amplitud: 0, luz: 0xF0, dano: 0, tiempo: 0, cabezaYaw: 0, cabezaPitch: 0, muerte: 0, ancho: 0.6, alto: 1.8 };
        remotos.set(k, e);
      }
      e.tx = r[2]; e.ty = r[3]; e.tz = r[4]; e.tyaw = r[5]; e.cabezaYaw = r[6]; e.cabezaPitch = r[7];
      e.dano = r[8] & 1 ? 1 : Math.max(0, e.dano - 0.2);
      if (r[8] & 2 && !e.muerte) e.muerte = 0.01;
      e.quema = !!(r[8] & 4); e.atacando = !!(r[8] & 16); e.domado = !!(r[8] & 32); e.enojado = !!(r[8] & 64); e.vuela = !!(r[8] & 128);
      var vv = typeof r[9] === 'number' ? r[9] : 0;
      e.variante = vv & 255;
      e.lana = r[8] & 8 ? null : LANA[(vv >> 8) & 15];
      // lo que llega es la escala de la caja (la del behavior pack); se dibuja con la del renderer
      var er = typeof r[10] === 'number' ? Math.max(0.2, Math.min(4, r[10] / 100)) : 1;
      e.textura = texturaDe(e);
      var def = Conducta.def(tipo), cb = def && def.c['minecraft:collision_box'];
      if (cb) { e.ancho = (cb.width || 0.6) * er; e.alto = (cb.height || 1.8) * er; }
      // del slime llega su tamaño (la caja es la del grupo de tamaño, que acá no se sabe)
      if (TAM_SLIME[tipo]) e.ancho = e.alto = 0.52 * er;
      e.escala = escalaDibujo(tipo, er, e.ancho, e.domado);
      e.radio = e.ancho;
      e.visto = ahora;
    });
  };
  B.pasoRemotos = function (dt) {
    var ahora = performance.now(), k = Math.min(1, dt * 8);
    remotos.forEach(function (e, key) {
      if (ahora - e.visto > 3000) { remotos.delete(key); return; }
      var ax = e.x, az = e.z;
      e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.z += (e.tz - e.z) * k;
      var d = e.tyaw - e.yaw;
      while (d > PI) d -= PI * 2;
      while (d < -PI) d += PI * 2;
      e.yaw += d * k;
      var andado = Math.sqrt((e.x - ax) * (e.x - ax) + (e.z - az) * (e.z - az));
      e.paso += andado * 2.4; e.amplitud += (Math.min(1, andado * 120 * dt) - e.amplitud) * Math.min(1, dt * 8);
      e.tiempo += dt * 20;
      if (e.muerte > 0) e.muerte = Math.min(1, e.muerte + dt);
    });
  };
  B.quitarDe = function (dueno) { remotos.forEach(function (e, k) { if (e.dueno === dueno) remotos.delete(k); }); };
  B.propioPorId = function (id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i]; return null; };
  // los que quedan en un mundo guardado: los animales y los que no se van solos (los monstruos no
  // se guardan, como al dormir)
  B.paraGuardar = function () {
    return lista.filter(function (e) { return (B.TIPOS[e.tipo].pasivo || e.persiste) && e.muerte === 0; })
      .map(function (e) {
        var r = [e.tipo, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), e.grupos, Math.round(e.vida)], o = {};
        // lo que no sale de los grupos: el dueño, sentado, el temple, el color que le dieron, la
        // variante, los efectos, la espera para criar, lo que lleva (montura, cofre), lo que vende
        // un aldeano (su nivel y cuánto se usó cada oferta) y la correa
        if (e.dueno) o.d = e.dueno;
        if (e.sentado) o.s = 1;
        if (e.temple) o.t = e.temple;
        if (e.colorFijo !== undefined) o.c = e.colorFijo;
        if (e.collar !== undefined) o.k = e.collar;
        if (e.variante) o.v = e.variante;
        if (e.esperaCria > 0) o.e = e.esperaCria;
        if (e.efectos && e.efectos.lista.length) o.f = Efectos.guardar(e.efectos);
        if (e.equipo) o.q = e.equipo;
        if (e.comercio) o.m = e.comercio;
        if (e.atado) o.a = e.atado === 'j' ? 'j' : [e.atado.x, e.atado.y, e.atado.z];
        if (Object.keys(o).length) r.push(o);
        return r;
      });
  };
  B.cargar = function (l) {
    (l || []).forEach(function (r) {
      if (!B.TIPOS[r[0]]) return;
      // (los mundos de antes guardaban sólo si la oveja era gris)
      var extra = Array.isArray(r[4]) ? { grupos: r[4], vida: r[5] } : null;
      var e = B.crear(r[0], r[1], r[2], r[3], extra), o = r[6];
      if (!e || !o) return;
      if (o.d) { e.dueno = o.d; e.persiste = true; }
      if (o.s) e.sentado = true;
      if (o.t) e.temple = o.t;
      if (o.c !== undefined) { e.colorFijo = o.c; e.colorLana = o.c; }
      if (o.k !== undefined) e.collar = o.k;
      if (o.v) e.variante = o.v;
      if (o.e) e.esperaCria = o.e;
      if (o.f) e.efectos = Efectos.cargar(o.f);
      if (o.q) e.equipo = o.q;
      if (o.m) e.comercio = o.m;
      if (o.a) { e.atado = o.a === 'j' ? 'j' : { x: o.a[0], y: o.a[1], z: o.a[2] }; e.persiste = true; }
    });
  };
  return B;
})();
