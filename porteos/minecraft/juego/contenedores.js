// porteo: lo que guardan los bloques (las "tile entities" del juego): los cofres (27 lugares; dos
// juntos forman uno grande) y los hornos, que cocinan solos aunque nadie los mire, con la cuenta de
// TileEntityFurnace: el combustible arde de a un paso, cada cosa se cocina en 200 pasos, el horno se
// prende y se apaga, y lo cocinado guarda la experiencia hasta que se saca.
var Contenedores = (function () {
  'use strict';
  var C2 = {}, mapa = new Map();
  C2.mapa = mapa;
  function clave(x, y, z) { return x + ',' + y + ',' + z; }
  function vacios(n) { var l = []; for (var i = 0; i < n; i++) l.push(null); return l; }
  C2.limpiar = function () { mapa.clear(); };
  C2.de = function (x, y, z) { return mapa.get(clave(x, y, z)) || null; };
  C2.cofre = function (x, y, z) {
    var k = clave(x, y, z), c = mapa.get(k);
    if (!c || c.tipo !== 'cofre') { c = { tipo: 'cofre', x: x, y: y, z: z, cosas: vacios(27) }; mapa.set(k, c); }
    return c;
  };
  C2.horno = function (x, y, z) {
    var k = clave(x, y, z), c = mapa.get(k);
    if (!c || c.tipo !== 'horno') {
      c = { tipo: 'horno', x: x, y: y, z: z, entrada: [null], combustible: [null], salida: [null], quema: 0, quemaTotal: 0, coccion: 0, xp: 0 };
      mapa.set(k, c);
    }
    return c;
  };
  // al romper el bloque: lo que tenía (para tirarlo) y se olvida
  C2.quitar = function (x, y, z) {
    var k = clave(x, y, z), c = mapa.get(k), r = [];
    mapa.delete(k);
    if (!c) return r;
    (c.tipo === 'cofre' ? [c.cosas] : [c.entrada, c.combustible, c.salida]).forEach(function (l) { l.forEach(function (x) { if (x) r.push(x); }); });
    return r;
  };

  // ------------------------------------------------------------------------------------------
  // Los hornos, un paso (1/20 s): cambiar(h, prendido) cambia el bloque (horno ↔ horno prendido)
  // ------------------------------------------------------------------------------------------
  function puedeCocinar(h) {
    var e = h.entrada[0], r = e && Recetas.horno(e);
    if (!r) return false;
    var s = h.salida[0];
    if (!s) return true;
    if (s.id !== r.id || s.m !== r.m) return false;
    return s.n + 1 <= Inventario.pila(s);
  }
  function cocinar(h) {
    var e = h.entrada[0], r = Recetas.horno(e), s = h.salida[0];
    if (s) s.n++; else h.salida[0] = Inventario.cosa(r.id, r.m, 1);
    h.xp += r.xp;
    // la esponja mojada con un balde vacío en el combustible lo llena de agua
    if (e.id === 19 && e.m === 1 && h.combustible[0] && h.combustible[0].id === 325 && h.combustible[0].m === 0) h.combustible[0].m = 8;
    e.n--;
    if (e.n <= 0) h.entrada[0] = null;
  }
  function pasoHorno(h, cambiar) {
    var antes = h.quema > 0;
    if (h.quema > 0) h.quema--;
    var f = h.combustible[0];
    if (h.quema > 0 || (f && h.entrada[0])) {
      if (h.quema === 0 && puedeCocinar(h)) {
        h.quemaTotal = h.quema = Recetas.combustible(f);
        if (h.quema > 0 && f) {
          // el balde de lava deja el balde vacío
          if (f.id === 325 && f.m === 10) h.combustible[0] = Inventario.cosa(325, 0, 1);
          else { f.n--; if (f.n <= 0) h.combustible[0] = null; }
        }
      }
      if (h.quema > 0 && puedeCocinar(h)) {
        if (++h.coccion >= 200) { h.coccion = 0; cocinar(h); }
      } else h.coccion = 0;
    } else if (h.coccion > 0) h.coccion = Math.max(0, h.coccion - 2);
    if (antes !== h.quema > 0 && cambiar) cambiar(h, h.quema > 0);
  }
  C2.paso = function (cambiar) {
    mapa.forEach(function (c) { if (c.tipo === 'horno' && Mundo.cargado(c.x, c.z)) pasoHorno(c, cambiar); });
  };
  // sacar lo cocinado da la experiencia guardada (SlotFurnaceOutput: la parte con decimales, al azar)
  C2.experiencia = function (h) {
    var x = h.xp, n = Math.floor(x);
    if (Math.random() < x - n) n++;
    h.xp = 0;
    return n;
  };

  // ------------------------------------------------------------------------------------------
  // Guardar con el mundo
  // ------------------------------------------------------------------------------------------
  function comp(c) { return c ? [c.id, c.m, c.n, c.d || 0] : 0; }
  function descomp(a) { return Array.isArray(a) ? Inventario.cosa(a[0] | 0, a[1] | 0, a[2] | 0 || 1, a[3] | 0) : null; }
  C2.guardar = function () {
    var r = [];
    mapa.forEach(function (c) {
      if (c.tipo === 'cofre') {
        if (c.cosas.some(Boolean)) r.push({ t: 'c', p: [c.x, c.y, c.z], s: c.cosas.map(comp) });
      } else r.push({ t: 'h', p: [c.x, c.y, c.z], s: [comp(c.entrada[0]), comp(c.combustible[0]), comp(c.salida[0])],
        q: c.quema, qt: c.quemaTotal, k: c.coccion, x: +c.xp.toFixed(2) });
    });
    return r;
  };
  C2.cargar = function (g) {
    mapa.clear();
    if (!Array.isArray(g)) return;
    g.forEach(function (o) {
      if (!o || !Array.isArray(o.p)) return;
      if (o.t === 'c') { var c = C2.cofre(o.p[0], o.p[1], o.p[2]); (o.s || []).forEach(function (a, i) { if (i < 27) c.cosas[i] = descomp(a); }); }
      else if (o.t === 'h') {
        var h = C2.horno(o.p[0], o.p[1], o.p[2]), s = o.s || [];
        h.entrada[0] = descomp(s[0]); h.combustible[0] = descomp(s[1]); h.salida[0] = descomp(s[2]);
        h.quema = o.q | 0; h.quemaTotal = o.qt | 0; h.coccion = o.k | 0; h.xp = +o.x || 0;
      }
    });
  };
  return C2;
})();
