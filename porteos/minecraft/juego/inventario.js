// porteo: lo que lleva el jugador (como el PlayerInventory del juego): la barra rápida (9), la
// mochila (27), la armadura (4), la otra mano (1), la grilla de fabricar (2x2 en el inventario, 3x3
// en la mesa y en creativo) y lo que tiene agarrado con el dedo mientras el inventario está abierto.
// Una cosa es { id, m, n (cuántas), d (cuánto se gastó) }. Las operaciones son las de los casilleros
// de la 1.2: tocar agarra o deja todo (o cambia), mantener agarra la mitad o deja una, tocar dos
// veces junta las iguales.
var Inventario = (function () {
  'use strict';
  var V = {};
  function vacios(n) { var l = []; for (var i = 0; i < n; i++) l.push(null); return l; }
  V.nuevo = function (barra) {
    var b = vacios(9);
    if (barra) for (var i = 0; i < 9; i++) b[i] = barra[i] ? V.cosa(barra[i].id, barra[i].m, barra[i].n, barra[i].d) : null;
    return { barra: b, mochila: vacios(27), armadura: vacios(4), mano2: vacios(1), fabricar: vacios(9), mano: null };
  };
  V.cosa = function (id, m, n, d) { return { id: id, m: m || 0, n: n || 1, d: d || 0 }; };
  V.copia = function (c, n) { return c ? { id: c.id, m: c.m, n: n === undefined ? c.n : n, d: c.d || 0 } : null; };
  // cuántas se apilan: los objetos según el juego; los bloques 64 (los que se ponen de a uno, 1)
  V.pila = function (c) {
    if (!c) return 64;
    if (c.id >= 256) return Items.es(c.id) ? Items.pila(c.id, c.m) : (c.id === Objetos.HUEVO ? 64 : 64);
    return 64;
  };
  V.iguales = function (a, b) { return !!a && !!b && a.id === b.id && a.m === b.m && !(a.d || b.d); };

  // ------------------------------------------------------------------------------------------
  // Tocar un casillero (lista, i): lo de la 1.2 con el dedo
  // ------------------------------------------------------------------------------------------
  // ¿puede ir esta cosa en este casillero? (la armadura en su lugar; la otra mano, sólo algunas)
  V.entra = function (inv, lista, i, c) {
    if (!c) return true;
    if (lista === inv.armadura) {
      var d = Items.def[c.id];
      if (d && d.arm === i) return true;
      return i === 0 && (c.id === 86 || c.id === 397);       // la calabaza y las cabezas, en la cabeza
    }
    if (lista === inv.mano2) return c.id === 450 || c.id === 262 || c.id === 358 || c.id === 395 || c.id === 401;
    return true;
  };
  // tocar: con la mano vacía agarra todo; con algo, lo deja (o junta si es igual, o cambia)
  V.tocar = function (inv, lista, i) {
    var s = lista[i], h = inv.mano;
    if (!h) { if (s) { inv.mano = s; lista[i] = null; } return; }
    if (!V.entra(inv, lista, i, h)) return;
    if (!s) {
      var pone = Math.min(h.n, lista === inv.armadura ? 1 : V.pila(h));
      lista[i] = V.copia(h, pone); h.n -= pone;
      if (h.n <= 0) inv.mano = null;
      return;
    }
    if (V.iguales(s, h)) {
      var pasa = Math.min(V.pila(s) - s.n, h.n);
      s.n += pasa; h.n -= pasa;
      if (h.n <= 0) inv.mano = null;
      return;
    }
    lista[i] = h; inv.mano = s;
  };
  // mantener: con la mano vacía agarra la mitad; con algo, deja una
  V.mitad = function (inv, lista, i) {
    var s = lista[i], h = inv.mano;
    if (!h) {
      if (!s) return;
      var mitad = Math.ceil(s.n / 2);
      inv.mano = V.copia(s, mitad); s.n -= mitad;
      if (s.n <= 0) lista[i] = null;
      return;
    }
    if (!V.entra(inv, lista, i, h)) return;
    if (!s) { lista[i] = V.copia(h, 1); h.n--; }
    else if (V.iguales(s, h) && s.n < V.pila(s)) { s.n++; h.n--; }
    else return;
    if (h.n <= 0) inv.mano = null;
  };
  // tocar dos veces: lo agarrado junta las iguales de la mochila y la barra
  V.juntar = function (inv) {
    var h = inv.mano;
    if (!h) return;
    [inv.mochila, inv.barra].forEach(function (l) {
      for (var i = 0; i < l.length && h.n < V.pila(h); i++) {
        if (!V.iguales(l[i], h)) continue;
        var pasa = Math.min(V.pila(h) - h.n, l[i].n);
        h.n += pasa; l[i].n -= pasa;
        if (l[i].n <= 0) l[i] = null;
      }
    });
  };
  // ------------------------------------------------------------------------------------------
  // Guardar algo (lo que se levanta del piso, lo fabricado): primero donde ya hay iguales, después en
  // el primer lugar libre de la barra y la mochila. Devuelve cuántas no entraron
  // ------------------------------------------------------------------------------------------
  V.agregar = function (inv, c) {
    if (!c || c.n <= 0) return 0;
    var n = c.n, listas = [inv.barra, inv.mochila], i, l;
    for (var k = 0; k < listas.length && n > 0; k++) {
      l = listas[k];
      for (i = 0; i < l.length && n > 0; i++) {
        if (!V.iguales(l[i], c)) continue;
        var pasa = Math.min(V.pila(c) - l[i].n, n);
        l[i].n += pasa; n -= pasa;
      }
    }
    for (k = 0; k < listas.length && n > 0; k++) {
      l = listas[k];
      for (i = 0; i < l.length && n > 0; i++) {
        if (l[i]) continue;
        var pone = Math.min(V.pila(c), n);
        l[i] = V.copia(c, pone); n -= pone;
      }
    }
    return n;
  };
  // ¿entra algo? (para no levantar lo que no cabe)
  V.cabe = function (inv, c) {
    var listas = [inv.barra, inv.mochila];
    for (var k = 0; k < listas.length; k++) for (var i = 0; i < listas[k].length; i++) {
      var s = listas[k][i];
      if (!s || (V.iguales(s, c) && s.n < V.pila(s))) return true;
    }
    return false;
  };
  // gastar una del casillero elegido de la barra (al poner un bloque, comer, tirar)
  V.gastar = function (inv, i, n) {
    var s = inv.barra[i];
    if (!s) return;
    s.n -= n || 1;
    if (s.n <= 0) inv.barra[i] = null;
  };
  // gastar durabilidad de lo que está en la mano (las herramientas): true si se rompió
  V.desgastar = function (inv, i, cuanto) {
    var s = inv.barra[i], d = s && Items.def[s.id];
    if (!d || !d.dur) return false;
    s.d = (s.d || 0) + (cuanto || 1);
    if (s.d > d.dur) { inv.barra[i] = null; return true; }
    return false;
  };
  // al cerrar: lo agarrado y lo de la grilla de fabricar vuelve al inventario (lo que no entra se tira)
  V.devolver = function (inv, tirar) {
    var resto = [];
    if (inv.mano) { resto.push(inv.mano); inv.mano = null; }
    for (var i = 0; i < inv.fabricar.length; i++) if (inv.fabricar[i]) { resto.push(inv.fabricar[i]); inv.fabricar[i] = null; }
    resto.forEach(function (c) {
      var sobra = V.agregar(inv, c);
      if (sobra > 0 && tirar) tirar(V.copia(c, sobra));
    });
  };

  // ------------------------------------------------------------------------------------------
  // Para guardar en el mundo (compacto: [id, m, n, d] o 0)
  // ------------------------------------------------------------------------------------------
  function comp(c) { return c ? [c.id, c.m, c.n, c.d || 0] : 0; }
  function descomp(a) { return Array.isArray(a) ? V.cosa(a[0] | 0, a[1] | 0, a[2] | 0 || 1, a[3] | 0) : null; }
  V.guardar = function (inv) {
    return { b: inv.barra.map(comp), mo: inv.mochila.map(comp), ar: inv.armadura.map(comp), m2: inv.mano2.map(comp) };
  };
  V.cargar = function (inv, g) {
    if (!g) return;
    function poner(l, a) { if (Array.isArray(a)) for (var i = 0; i < l.length && i < a.length; i++) l[i] = descomp(a[i]); }
    poner(inv.barra, g.b); poner(inv.mochila, g.mo); poner(inv.armadura, g.ar); poner(inv.mano2, g.m2);
  };
  // los puntos de armadura que se llevan puestos (para la barra de armadura y el daño)
  V.puntosArmadura = function (inv) {
    var p = 0;
    inv.armadura.forEach(function (c) { var d = c && Items.def[c.id]; if (d && d.pts) p += d.pts; });
    return p;
  };
  return V;
})();
