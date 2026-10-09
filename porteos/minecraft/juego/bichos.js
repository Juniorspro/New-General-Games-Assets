// porteo: los bichos. Animales (cerdo, vaca, oveja, gallina) en el pasto, y de noche o en lo oscuro
// los monstruos (zombi, esqueleto, creeper, araña), como Minecraft: aparecen lejos del jugador
// donde hay poca luz, los zombis y esqueletos se queman al sol, caminan al azar, los animales
// huyen si se les pega, suenan (los sonidos de la 1.2) y se mueren dando vuelta. Con los huevos del
// inventario se hacen aparecer donde se toca. La física es la del jugador, simplificada (cajas).
//
// En un servidor cada jugador es dueño de los bichos que aparecieron cerca suyo: los mueve él y
// manda dónde están; los de los demás llegan por la red y sólo se dibujan (un golpe a uno ajeno se
// le avisa al dueño). Los monstruos persiguen al jugador más cercano, propio o ajeno.
var Bichos = (function () {
  'use strict';
  var B = {};
  var lista = [];             // los propios
  var remotos = new Map();    // "dueño/id" → bicho de otro jugador
  var proximoId = 1;
  B.activo = true;            // "Aparecen bichos" (opción del mundo)
  B.conVida = false;          // el jugador puede recibir daño (en los servidores)
  B.TIPOS = {
    pig: { vida: 10, ancho: 0.9, alto: 0.9, vel: 0.045, pasivo: true, decir: 'mob.pig.say', herido: 'mob.pig.say', muere: 'mob.pig.death', paso: 'mob.pig.step' },
    cow: { vida: 10, ancho: 0.9, alto: 1.4, vel: 0.04, pasivo: true, decir: 'mob.cow.say', herido: 'mob.cow.hurt', muere: 'mob.cow.hurt', paso: 'mob.cow.step' },
    sheep: { vida: 8, ancho: 0.9, alto: 1.3, vel: 0.045, pasivo: true, decir: 'mob.sheep.say', herido: 'mob.sheep.say', muere: 'mob.sheep.say', paso: 'mob.sheep.step' },
    chicken: { vida: 4, ancho: 0.4, alto: 0.7, vel: 0.045, pasivo: true, decir: 'mob.chicken.say', herido: 'mob.chicken.hurt', muere: 'mob.chicken.hurt', paso: 'mob.chicken.step', planea: true },
    zombie: { vida: 20, ancho: 0.6, alto: 1.95, vel: 0.06, hostil: true, quema: true, brazos: true, ataque: 3, decir: 'mob.zombie.say', herido: 'mob.zombie.hurt', muere: 'mob.zombie.death', paso: 'mob.zombie.step' },
    skeleton: { vida: 20, ancho: 0.6, alto: 1.99, vel: 0.06, hostil: true, quema: true, brazos: true, ataque: 2, alcance: 9, decir: 'mob.skeleton.say', herido: 'mob.skeleton.hurt', muere: 'mob.skeleton.death', paso: 'mob.skeleton.step' },
    creeper: { vida: 20, ancho: 0.6, alto: 1.7, vel: 0.055, hostil: true, explota: true, herido: 'mob.creeper.say', muere: 'mob.creeper.death' },
    spider: { vida: 16, ancho: 1.4, alto: 0.9, vel: 0.075, hostil: true, ataque: 2, decir: 'mob.spider.say', herido: 'mob.spider.say', muere: 'mob.spider.death', paso: 'mob.spider.step' }
  };
  var NOMBRES = Object.keys(B.TIPOS);
  var PASIVOS = ['pig', 'cow', 'sheep', 'chicken'], HOSTILES = ['zombie', 'zombie', 'skeleton', 'skeleton', 'creeper', 'spider', 'spider'];
  var LANA = [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [0.55, 0.55, 0.55], [0.35, 0.35, 0.35], [0.45, 0.32, 0.2], [0.95, 0.65, 0.75]];

  B.crear = function (tipo, x, y, z, extra) {
    var T = B.TIPOS[tipo];
    if (!T) return null;
    var e = {
      id: proximoId++, tipo: tipo, modelo: tipo, x: x, y: y, z: z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0,
      yaw: Math.random() * Math.PI * 2, cabezaYaw: 0, cabezaPitch: 0, vida: T.vida, dano: 0, golpeado: 0, paso: 0, amplitud: 0,
      enPiso: false, ia: 0, dir: null, huye: 0, muerte: 0, luz: 0xF0, tiempo: Math.random() * 100, proxSonido: 100 + Math.random() * 200,
      caminado: 0, mecha: 0, ataque: 0, quema: 0, brazosAdelante: !!T.brazos
    };
    if (tipo === 'sheep') e.tinte = Math.random() < 0.82 ? null : LANA[(Math.random() * LANA.length) | 0];
    if (extra) for (var k in extra) e[k] = extra[k];
    lista.push(e);
    return e;
  };
  B.cuantos = function () { return lista.length; };
  B.limpiar = function () { lista.length = 0; remotos.clear(); };

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
  function mover(e, T, dx, dy, dz) {
    var w = T.ancho / 2, h = T.alto, eps = 0.001;
    // y
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
    return chocoX || chocoZ;
  }
  function enAgua(e) { var b = Mundo.bloque(Math.floor(e.x), Math.floor(e.y + 0.3), Math.floor(e.z)); return b === 8 || b === 9; }
  function enLava(e) { var b = Mundo.bloque(Math.floor(e.x), Math.floor(e.y + 0.3), Math.floor(e.z)); return b === 10 || b === 11; }

  // ------------------------------------------------------------------------------------------
  // Un paso (1/20 s) de todos los propios. jug: [{ x, y, z, id (null el propio), vivo }]
  // ------------------------------------------------------------------------------------------
  var tick = 0;
  B.paso = function (jug, dia) {
    var ambiente = B.sonido;
    tick++;
    var yo = jug[0];
    for (var i = lista.length - 1; i >= 0; i--) {
      var e = lista[i], T = B.TIPOS[e.tipo];
      e.px = e.x; e.py = e.y; e.pz = e.z;
      e.tiempo++;
      if (e.dano > 0) e.dano = Math.max(0, e.dano - 0.1);
      if (e.golpeado > 0) e.golpeado--;
      // muriendo: se da vuelta en un segundo y se va en una nube
      if (e.muerte > 0) {
        e.muerte += 0.05;
        if (e.muerte >= 1) { lista.splice(i, 1); if (B.alMorir) B.alMorir(e); }
        e.vy -= 0.08; mover(e, T, 0, e.vy, 0);
        continue;
      }
      // lejos del jugador: se van (los monstruos antes)
      var dxj = e.x - yo.x, dzj = e.z - yo.z, d2 = dxj * dxj + dzj * dzj;
      if (d2 > (T.hostil ? 80 * 80 : 128 * 128) || (!Mundo.cargado(e.x, e.z))) { lista.splice(i, 1); continue; }
      if (T.hostil && d2 > 40 * 40 && Math.random() < 1 / 600) { lista.splice(i, 1); continue; }
      ia(e, T, jug, dia);
      // moverse
      var agua = enAgua(e), lava = enLava(e);
      if (agua || lava) {
        e.vx *= 0.8; e.vz *= 0.8; e.vy *= 0.8; e.vy -= 0.02;
        if (agua && Math.random() < 0.8) e.vy += 0.04;   // flotan (como el "float" de los bichos)
      } else {
        e.vy -= 0.08; e.vy *= 0.98;
        if (T.planea && e.vy < -0.05) e.vy = -0.05;      // la gallina planea
      }
      var choco = mover(e, T, e.vx, e.vy, e.vz);
      if (choco && e.enPiso && (Math.abs(e.vx) + Math.abs(e.vz) > 0.001 || e.dir)) e.vy = 0.42;   // saltar el escalón
      if (choco && (agua || lava)) e.vy = 0.3;
      var roce = e.enPiso ? 0.546 : 0.91;
      if (!agua && !lava) { e.vx *= roce; e.vz *= roce; }
      // el andar (las patas y los pasos)
      var andado = Math.sqrt((e.x - e.px) * (e.x - e.px) + (e.z - e.pz) * (e.z - e.pz));
      e.paso += andado * 2.4;
      e.amplitud += (Math.min(1, andado * 6) - e.amplitud) * 0.4;
      e.caminado += andado;
      if (e.enPiso && e.caminado > 1.6 && T.paso) { e.caminado = 0; if (ambiente) ambiente(T.paso, e, 0.15); }
      if (e.y < -20) { lista.splice(i, 1); continue; }
      // los zombis y esqueletos se queman al sol
      if (T.quema && dia > 0.5 && (e.luz >> 4) >= 15 && !agua) {
        e.quema = 20;
      }
      if (e.quema > 0) {
        e.quema--;
        if (tick % 20 === 0) herir(e, 1, 0, 0);
      }
      if (lava && tick % 10 === 0) herir(e, 4, 0, 0);
      // sonidos de a ratos
      if (--e.proxSonido <= 0) {
        e.proxSonido = 120 + Math.random() * 240;
        if (T.decir && ambiente && d2 < 24 * 24) ambiente(T.decir, e, 1);
      }
    }
  };

  // ------------------------------------------------------------------------------------------
  // Lo que hacen: los animales pasean, miran y huyen; los monstruos persiguen al jugador más
  // cercano que pueda recibir daño (en creativo ni lo miran, como el juego)
  // ------------------------------------------------------------------------------------------
  function ia(e, T, jug, dia) {
    var objetivo = null, mejor = 1e9;
    if (T.hostil && B.conVida) {
      for (var k = 0; k < jug.length; k++) {
        var j = jug[k];
        if (!j.vivo) continue;
        var dx = j.x - e.x, dz = j.z - e.z, dy = j.y - e.y, d = dx * dx + dy * dy + dz * dz;
        if (d < 16 * 16 && d < mejor) { mejor = d; objetivo = j; }
      }
    }
    var vel = T.vel;
    if (objetivo) {
      var ox = objetivo.x - e.x, oz = objetivo.z - e.z, dist = Math.sqrt(mejor);
      e.yaw = Math.atan2(ox, -oz);
      e.cabezaPitch = -Math.atan2(objetivo.y + 1.5 - (e.y + T.alto * 0.85), Math.sqrt(ox * ox + oz * oz)) * 0.5;
      if (T.explota) {
        // el creeper: cerca se infla y explota
        if (dist < 3) { e.mecha++; if (e.mecha === 1 && B.sonido) B.sonido('random.fuse', e, 1); }
        else e.mecha = Math.max(0, e.mecha - 1);
        e.dano = e.mecha > 0 ? 0.3 + 0.3 * Math.sin(e.mecha) : e.dano;
        if (e.mecha >= 30) { explotar(e, jug); return; }
        if (dist > 2.5) empujar(e, vel * 1.2, e.yaw);
        return;
      }
      if (T.alcance && dist < T.alcance) {
        // el esqueleto: desde lejos (una flecha que no se ve)
        if (--e.ataque <= 0) { e.ataque = 40; if (B.sonido) B.sonido('random.bow', e, 1); if (B.golpear) B.golpear(objetivo, T.ataque, e); }
        if (dist > 5) empujar(e, vel, e.yaw);
        return;
      }
      if (dist > 1.1) empujar(e, vel * 1.3, e.yaw);
      if (dist < 1.6 && Math.abs(objetivo.y - e.y) < 1.5 && --e.ataque <= 0) {
        e.ataque = 20;
        if (B.golpear) B.golpear(objetivo, T.ataque, e);
      }
      return;
    }
    e.mecha = 0;
    if (e.huye > 0) { e.huye--; girarHacia(e, e.dirHuida, 0.3); empujar(e, vel * 2, e.dirHuida); return; }
    if (--e.ia <= 0) {
      if (Math.random() < 0.45) { e.dir = Math.random() * Math.PI * 2; e.ia = 40 + Math.random() * 80; }
      else { e.dir = null; e.ia = 40 + Math.random() * 100; e.cabezaYawObj = (Math.random() - 0.5) * 1.6; }
    }
    if (e.dir !== null && e.dir !== undefined) {
      // no tirarse por un barranco: si adelante no hay piso en 3 bloques, da la vuelta
      var fx = Math.sin(e.dir), fz = -Math.cos(e.dir), ax = Math.floor(e.x + fx * 0.8), az = Math.floor(e.z + fz * 0.8), ay = Math.floor(e.y);
      var piso = false;
      for (var y = ay; y >= ay - 3; y--) { var b = Mundo.bloque(ax, y, az); if (b !== 0 && (b < 0 || C.SOLIDO[b] || b === 8 || b === 9)) { piso = true; break; } }
      if (!piso) { e.dir += Math.PI * (0.5 + Math.random()); e.ia = Math.min(e.ia, 30); }
      // girar el cuerpo de a poco hacia donde va
      girarHacia(e, e.dir, 0.3);
      empujar(e, vel, e.dir);
      e.cabezaYaw *= 0.8;
    } else {
      e.cabezaYaw += ((e.cabezaYawObj || 0) - e.cabezaYaw) * 0.1;
    }
    e.cabezaPitch *= 0.9;
    void dia;
  }
  function empujar(e, f, a) {
    var k = e.enPiso ? f : f * 0.2;
    e.vx += Math.sin(a) * k; e.vz -= Math.cos(a) * k;
  }
  function girarHacia(e, a, k) {
    var d = a - e.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    e.yaw += d * k;
  }
  function explotar(e, jug) {
    var i = lista.indexOf(e);
    if (i >= 0) lista.splice(i, 1);
    if (B.explosion) B.explosion(e.x, e.y + 0.5, e.z, 3, jug);
  }
  function herir(e, dano, kx, kz) {
    var T = B.TIPOS[e.tipo], ambiente = B.sonido;
    if (e.muerte > 0) return;
    e.vida -= dano; e.dano = 1;
    if (kx || kz) { e.vx += kx; e.vz += kz; e.vy = 0.36; }
    if (e.vida <= 0) { e.muerte = 0.01; if (ambiente && T.muere) ambiente(T.muere, e, 1); }
    else if (ambiente && T.herido) ambiente(T.herido, e, 1);
    if (T.pasivo) { e.huye = 60; e.dirHuida = Math.atan2(kx || Math.random() - 0.5, -(kz || Math.random() - 0.5)); }
  }
  // un golpe del jugador (propio o ajeno): con el tiempo de invulnerabilidad del juego (medio segundo)
  B.golpe = function (e, dano, kx, kz) {
    if (e.golpeado > 0 || e.muerte > 0) return false;
    e.golpeado = 10;
    herir(e, dano, kx, kz);
    return true;
  };

  // ------------------------------------------------------------------------------------------
  // Aparecer solos: animales en el pasto con luz (de a grupitos), monstruos donde está oscuro (de
  // noche afuera, o en las cuevas). Las posiciones candidatas se miden con la luz del trabajador
  // (luces: [x, y, z, ...] → valores), así que esto pide y después decide
  // ------------------------------------------------------------------------------------------
  var candidatos = [];
  B.candidatos = function (yo, dia, cuantosJug) {
    candidatos = [];
    if (!B.activo) return candidatos;
    var pas = 0, hos = 0;
    lista.forEach(function (e) { if (B.TIPOS[e.tipo].hostil) hos++; else pas++; });
    var tope = Math.max(2, Math.round(10 / Math.max(1, cuantosJug)));
    for (var n = 0; n < 4; n++) {
      var a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 22;
      var x = Math.floor(yo.x + Math.cos(a) * r), z = Math.floor(yo.z + Math.sin(a) * r);
      if (!Mundo.cargado(x, z)) continue;
      // el piso de arriba de todo (sin hojas: debajo de los árboles)
      var top = -1;
      for (var y = C.ALTO - 2; y > 1; y--) {
        var b = Mundo.bloque(x, y, z);
        if (b > 0 && C.SOLIDO[b] && b !== 18 && b !== 161) { top = y; break; }
        if (b === 8 || b === 9 || b === 10 || b === 11) break;
      }
      if (top < 0) continue;
      var suelo = Mundo.bloque(x, top, z);
      if (pas < tope * 0.8 && suelo === 2 && Math.random() < 0.3) candidatos.push({ x: x, y: top + 1, z: z, pasivo: true });
      else if (hos < tope) {
        // en la superficie, o en un hueco de cueva abajo
        var yy = top + 1;
        if (Math.random() < 0.5) {
          var hy = top - 4 - Math.floor(Math.random() * 40);
          for (; hy > 4; hy--) if (Mundo.bloque(x, hy, z) === 0 && Mundo.bloque(x, hy + 1, z) === 0 && C.SOLIDO[Mundo.bloque(x, hy - 1, z)] && Mundo.bloque(x, hy - 1, z) > 0) break;
          if (hy > 4) yy = hy;
        }
        candidatos.push({ x: x, y: yy, z: z, pasivo: false });
      }
    }
    return candidatos;
  };
  // con la luz de cada candidato (cielo << 4 | bloques) y qué tan de día es (0 a 1)
  B.aparecer = function (luces, dia) {
    for (var i = 0; i < candidatos.length && i < luces.length; i++) {
      var c = candidatos[i], l = luces[i];
      if (l < 0) continue;
      var cielo = l >> 4, bloque = l & 15, efectiva = Math.max(bloque, Math.round(cielo * dia));
      if (c.pasivo) {
        if (cielo < 9) continue;
        var tipo = PASIVOS[(Math.random() * PASIVOS.length) | 0], n = 2 + ((Math.random() * 3) | 0);
        for (var k = 0; k < n; k++) {
          var x = c.x + 0.5 + (Math.random() - 0.5) * 3, z = c.z + 0.5 + (Math.random() - 0.5) * 3;
          if (Mundo.bloque(Math.floor(x), c.y, Math.floor(z)) === 0) B.crear(tipo, x, c.y, z);
        }
      } else {
        if (efectiva > 7 || bloque > 7) continue;
        if (Mundo.bloque(c.x, c.y, c.z) !== 0 || Mundo.bloque(c.x, c.y + 1, c.z) !== 0) continue;
        B.crear(HOSTILES[(Math.random() * HOSTILES.length) | 0], c.x + 0.5, c.y, c.z + 0.5);
      }
    }
    candidatos = [];
  };

  // ------------------------------------------------------------------------------------------
  // Para dibujar (interpolados entre pasos), para pedir la luz y para la red
  // ------------------------------------------------------------------------------------------
  var dibujo = [];
  B.paraDibujar = function (alfa) {
    dibujo.length = 0;
    lista.forEach(function (e) {
      e.dx = e.px + (e.x - e.px) * alfa; e.dy = e.py + (e.y - e.py) * alfa; e.dz = e.pz + (e.z - e.pz) * alfa;
      dibujo.push({ modelo: e.modelo, x: e.dx, y: e.dy, z: e.dz, yaw: e.yaw, cabezaYaw: e.cabezaYaw, cabezaPitch: e.cabezaPitch,
        paso: e.paso, amplitud: e.amplitud, luz: e.luz, dano: e.dano, tiempo: e.tiempo, brazosAdelante: e.brazosAdelante,
        cayendo: !e.enPiso && e.vy < 0, muerte: e.muerte, tinte: e.tinte, quema: e.quema > 0, ref: e });
    });
    remotos.forEach(function (e) { dibujo.push(e); });
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
      var T = B.TIPOS[e.tipo];
      if (!T || e.muerte > 0) return;
      var w = T.ancho / 2 + 0.1, x = remoto ? e.x : e.x, y = remoto ? e.y : e.y, z = remoto ? e.z : e.z;
      var t = cajaRayo(ox, oy, oz, dx, dy, dz, x - w, y, z - w, x + w, y + T.alto + 0.1, z + w);
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

  // lo que se manda por la red: los propios, compactos ([id, tipo, x, y, z, yaw, cabeza, pitch, estado])
  B.paraRed = function () {
    return lista.map(function (e) {
      var est = (e.dano > 0.5 ? 1 : 0) | (e.muerte > 0 ? 2 : 0) | (e.quema > 0 ? 4 : 0) | (e.tinte ? 8 : 0);
      return [e.id, NOMBRES.indexOf(e.tipo), +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +e.yaw.toFixed(2),
        +e.cabezaYaw.toFixed(2), +e.cabezaPitch.toFixed(2), est];
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
          amplitud: 0, luz: 0xF0, dano: 0, tiempo: 0, brazosAdelante: !!B.TIPOS[tipo].brazos, cabezaYaw: 0, cabezaPitch: 0, muerte: 0 };
        remotos.set(k, e);
      }
      e.tx = r[2]; e.ty = r[3]; e.tz = r[4]; e.tyaw = r[5]; e.cabezaYaw = r[6]; e.cabezaPitch = r[7];
      e.dano = r[8] & 1 ? 1 : Math.max(0, e.dano - 0.2);
      if (r[8] & 2 && !e.muerte) e.muerte = 0.01;
      e.tinte = r[8] & 8 ? [0.55, 0.55, 0.55] : null;
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
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      e.yaw += d * k;
      var andado = Math.sqrt((e.x - ax) * (e.x - ax) + (e.z - az) * (e.z - az));
      e.paso += andado * 2.4; e.amplitud += (Math.min(1, andado * 120 * dt) - e.amplitud) * Math.min(1, dt * 8);
      e.tiempo += dt * 20;
      if (e.muerte > 0) e.muerte = Math.min(1, e.muerte + dt);
    });
  };
  B.quitarDe = function (dueno) { remotos.forEach(function (e, k) { if (e.dueno === dueno) remotos.delete(k); }); };
  B.propioPorId = function (id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i]; return null; };
  // los animales que quedan en un mundo guardado (los monstruos no se guardan, como al dormir)
  B.paraGuardar = function () {
    return lista.filter(function (e) { return B.TIPOS[e.tipo].pasivo && e.muerte === 0; })
      .map(function (e) { return [e.tipo, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), e.tinte ? 1 : 0]; });
  };
  B.cargar = function (l) {
    (l || []).forEach(function (r) { if (B.TIPOS[r[0]]) B.crear(r[0], r[1], r[2], r[3], r[4] ? { tinte: LANA[6] } : null); });
  };
  return B;
})();
