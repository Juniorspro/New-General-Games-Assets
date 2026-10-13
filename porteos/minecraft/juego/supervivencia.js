// porteo: la vida, el hambre, el aire y la experiencia del jugador en supervivencia, como el juego
// (la FoodStats y el Player de la versión de PC, que la 1.2 calca): la comida baja con el cansancio
// (caminar, correr, saltar, pegar, minar, curarse), con la comida llena la vida sube sola y con el
// hambre a cero baja; bajo el agua se gasta el aire; la armadura achica los golpes; la experiencia
// sube de nivel con la cuenta del juego.
var Supervivencia = (function () {
  'use strict';
  var S = {};
  S.nuevo = function () {
    return { vida: 20, max: 20, comida: 20, saturacion: 5, cansancio: 0, aire: 300, nivel: 0, progreso: 0, totalXp: 0,
      quemando: 0, invulnerable: 0, pasoComida: 0, ultimoDano: 0, ultimaCausa: '' };
  };
  S.guardar = function (s) {
    return { v: s.vida, c: s.comida, s: +s.saturacion.toFixed(2), k: +s.cansancio.toFixed(3), a: s.aire, n: s.nivel, p: +s.progreso.toFixed(4), t: s.totalXp };
  };
  S.cargar = function (g) {
    var s = S.nuevo();
    if (!g) return s;
    if (typeof g.v === 'number') s.vida = g.v;
    if (typeof g.c === 'number') s.comida = g.c;
    if (typeof g.s === 'number') s.saturacion = g.s;
    if (typeof g.k === 'number') s.cansancio = g.k;
    if (typeof g.a === 'number') s.aire = g.a;
    if (typeof g.n === 'number') s.nivel = g.n;
    if (typeof g.p === 'number') s.progreso = g.p;
    if (typeof g.t === 'number') s.totalXp = g.t;
    return s;
  };

  // ------------------------------------------------------------------------------------------
  // El cansancio: con 4 se pierde un punto de saturación o, si no hay, uno de comida
  // (sprint 0,1 por bloque, saltar 0,05, saltar corriendo 0,2, pegar 0,1, recibir daño 0,1, romper
  // un bloque 0,005, curarse 3)
  // ------------------------------------------------------------------------------------------
  S.cansar = function (s, n) { s.cansancio = Math.min(40, s.cansancio + n); };
  // ------------------------------------------------------------------------------------------
  // Un paso (1/20 s). m: lo que pasa alrededor { tick, cabezaEnAgua, enAgua, enLava, enFuego, asfixia,
  // vacio, dificultad, regenerar, respiraBajoAgua }. dificultad 'sinHambre' (los servidores): la
  // comida siempre llena. Devuelve los daños de este paso como [cantidad, causa] o null
  // ------------------------------------------------------------------------------------------
  S.paso = function (s, m) {
    var danos = null, dif = m.dificultad, regen = m.regenerar !== false;
    function danar(n, causa) { (danos || (danos = [])).push([n, causa]); }
    if (s.invulnerable > 0) s.invulnerable--;
    if (dif === 'sinHambre') { s.comida = 20; s.cansancio = 0; }
    // pacífico: un corazón por segundo y la comida se llena sola (EntityPlayer.onLivingUpdate)
    if (dif === 'peaceful' && regen) {
      if (s.vida > 0 && s.vida < s.max && m.tick % 20 === 0) s.vida = Math.min(s.max, s.vida + 1);
      if (s.comida < 20 && m.tick % 10 === 0) s.comida++;
    }
    // la comida (FoodStats.onUpdate): en pacífico el cansancio sólo gasta la saturación
    while (s.cansancio > 4) {
      s.cansancio -= 4;
      if (s.saturacion > 0) s.saturacion = Math.max(0, s.saturacion - 1);
      else if (dif !== 'peaceful') s.comida = Math.max(0, s.comida - 1);
    }
    if (regen && s.comida >= 18 && s.vida > 0 && s.vida < s.max) {
      if (++s.pasoComida >= 80) { s.vida = Math.min(s.max, s.vida + 1); S.cansar(s, 3); s.pasoComida = 0; }
    } else if (s.comida <= 0) {
      // el hambre lastima hasta 10 en fácil, hasta 1 en normal, hasta morir en difícil
      if (++s.pasoComida >= 80) {
        if (s.vida > 10 || dif === 'hard' || (s.vida > 1 && dif === 'normal')) danar(1, 'starve');
        s.pasoComida = 0;
      }
    } else s.pasoComida = 0;
    // el aire: 15 segundos bajo el agua, después 2 de daño por segundo
    if (m.cabezaEnAgua && !m.respiraBajoAgua) {
      s.aire--;
      if (s.aire <= -20) { s.aire = 0; danar(2, 'drown'); }
    } else if (s.aire < 300) s.aire = Math.min(300, s.aire + 5);
    // la lava (4 cada medio segundo y prende fuego), el fuego, el vacío, quedar dentro de un bloque
    if (m.enLava) { if (m.tick % 10 === 0) danar(4, 'lava'); s.quemando = Math.max(s.quemando, 300); }
    else if (m.enFuego) { if (m.tick % 10 === 0) danar(1, 'inFire'); s.quemando = Math.max(s.quemando, 160); }
    if (m.enAgua) s.quemando = 0;
    if (s.quemando > 0) { s.quemando--; if (s.quemando % 20 === 0 && !m.enLava) danar(1, 'onFire'); }
    if (m.vacio && m.tick % 10 === 0) danar(4, 'outOfWorld');
    if (m.asfixia && m.tick % 10 === 0) danar(1, 'inWall');
    return danos;
  };

  // ------------------------------------------------------------------------------------------
  // Un golpe: la armadura achica lo que no la atraviesa (CombatRules: cada punto, 4 %), con medio
  // segundo de invulnerabilidad salvo que el golpe nuevo sea más fuerte. Devuelve lo que se perdió
  // ------------------------------------------------------------------------------------------
  var SIN_ARMADURA = { starve: 1, drown: 1, outOfWorld: 1, inWall: 1, onFire: 1, magic: 1, wither: 1, fall: 1 };
  S.danar = function (s, n, causa, armadura) {
    if (n <= 0 || s.vida <= 0) return 0;
    if (s.invulnerable > 10 && n <= s.ultimoDano) return 0;
    var real = n;
    if (s.invulnerable > 10) real = n - s.ultimoDano;
    if (!SIN_ARMADURA[causa] && armadura > 0) real = real * (1 - Math.min(20, armadura) / 25);
    real = Math.max(0, real);
    s.ultimoDano = n; s.ultimaCausa = causa || '';
    if (s.invulnerable <= 10) s.invulnerable = 20;
    // la vida va en medios corazones: el juego guarda los decimales; acá se redondea al medio
    s.vida = Math.max(0, Math.round((s.vida - real) * 2) / 2);
    S.cansar(s, 0.1);
    return real;
  };
  S.curar = function (s, n) { s.vida = Math.min(s.max, s.vida + n); };
  // comer: la comida y la saturación de items.json ("saturation_modifier": poor 0,1, low 0,3, normal
  // 0,6, good 0,8, max 1, supernatural 1,2; saturación = comida × modificador × 2)
  var MOD = { poor: 0.1, low: 0.3, normal: 0.6, good: 0.8, max: 1, supernatural: 1.2 };
  S.comer = function (s, f) {
    var n = f.nutrition || 0, mod = MOD[f.saturation_modifier] !== undefined ? MOD[f.saturation_modifier] : 0.6;
    s.comida = Math.min(20, s.comida + n);
    s.saturacion = Math.min(s.comida, s.saturacion + n * mod * 2);
  };
  S.puedeComer = function (s) { return s.comida < 20; };

  // ------------------------------------------------------------------------------------------
  // La experiencia (EntityPlayer.xpBarCap)
  // ------------------------------------------------------------------------------------------
  function porNivel(n) { return n >= 30 ? 112 + (n - 30) * 9 : n >= 15 ? 37 + (n - 15) * 5 : 7 + n * 2; }
  S.sumarXp = function (s, n) {
    s.totalXp += n;
    s.progreso += n / porNivel(s.nivel);
    var subio = false;
    while (s.progreso >= 1) { s.progreso = (s.progreso - 1) * porNivel(s.nivel); s.nivel++; s.progreso /= porNivel(s.nivel); subio = true; }
    return subio;
  };
  // lo que se suelta al morir (7 por nivel, hasta 100)
  S.xpAlMorir = function (s) { return Math.min(100, s.nivel * 7); };
  S.morir = function (s) { s.nivel = 0; s.progreso = 0; s.totalXp = 0; };
  S.reaparecer = function (s) {
    s.vida = s.max; s.comida = 20; s.saturacion = 5; s.cansancio = 0; s.aire = 300; s.quemando = 0; s.invulnerable = 0;
  };
  return S;
})();
