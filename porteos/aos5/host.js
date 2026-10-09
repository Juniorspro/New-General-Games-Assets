// Las funciones que el juego (web.c) le pide a la página. El trabajo lo hace window.AOS_HOST (aos5.js).
addToLibrary({
  host_log: function (p) { AOS_HOST.log(UTF8ToString(p)); },
  host_trap: function (p) { AOS_HOST.trap(UTF8ToString(p)); },
  host_ahora: function () { return Date.now(); },
  host_hora_local: function (t, tm) {
    var d = new Date(t * 1000);
    var start = new Date(d.getFullYear(), 0, 1);
    var v = [d.getSeconds(), d.getMinutes(), d.getHours(), d.getDate(), d.getMonth(), d.getFullYear() - 1900,
      d.getDay(), Math.floor((d - start) / 86400000), 0];
    for (var i = 0; i < 9; i++) HEAP32[(tm >> 2) + i] = v[i];
  },
  host_sonido_tocar: function (r, bucle, vol) { return AOS_HOST.sonido(UTF8ToString(r), bucle, vol); },
  host_sonido_parar: function (id) { AOS_HOST.parar(id); },
  host_sonido_todo: function (q) { AOS_HOST.todo(q); },
  host_sonido_cargar: function (r) { AOS_HOST.cargar(UTF8ToString(r)); },
  host_guardado_leer__deps: ['malloc'],
  host_guardado_leer: function (n, pp) {
    var d = AOS_HOST.leer(UTF8ToString(n));
    if (!d) return -1;
    var p = _malloc(d.length + 1);
    HEAPU8.set(d, p);
    HEAPU8[p + d.length] = 0;
    HEAPU32[pp >> 2] = p;
    return d.length;
  },
  host_guardado_escribir: function (n, p, len) { AOS_HOST.escribir(UTF8ToString(n), HEAPU8.slice(p, p + len)); },
  host_dato__deps: ['$stringToNewUTF8'],
  host_dato: function (k) {
    var v = AOS_HOST.dato(UTF8ToString(k));
    return v == null ? 0 : stringToNewUTF8(v);
  },
  host_dato_poner: function (k, v) { AOS_HOST.datoPoner(UTF8ToString(k), UTF8ToString(v)); },
  host_vibrar: function (ms) { AOS_HOST.vibrar(ms); },
  host_glifo: function (f, cp, tam, out) {
    var g = AOS_HOST.glifo(f, cp, tam);
    if (!g) return 0;
    HEAPF32.set(g, out >> 2);
    return 1;
  },
});
