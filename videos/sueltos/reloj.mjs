// El reloj propio que se mete en <head> de cada juego antes que nada: requestAnimationFrame,
// performance.now, Date.now, setTimeout y setInterval van con __reloj.cuadro(ms), así cada toma
// sale igual siempre, ande rápido o lento la máquina (ver memoria/brillo-trailer.md).
// Sin AudioContext: las tomas van mudas (la música se hace aparte, sueltos/musica.mjs).
export const RELOJ = `<script>(function(){
  var cola = [], t = 0, relojes = [], sigId = 1, base = Date.UTC(2026, 9, 2, 15, 0, 0);
  window.__esperaReal = window.setTimeout.bind(window);
  window.requestAnimationFrame = function (f) { cola.push(f); return cola.length; };
  window.cancelAnimationFrame = function () {};
  performance.now = function () { return t; };
  Date.now = function () { return base + t; };
  window.setTimeout = function (f, ms) { var a = [].slice.call(arguments, 2), id = sigId++; if (typeof f === 'function') relojes.push({ id: id, t: t + Math.max(0, +ms || 0), f: f, a: a }); return id; };
  window.clearTimeout = function (id) { relojes = relojes.filter(function (r) { return r.id !== id; }); };
  window.setInterval = function (f, ms) { var id = sigId++, d = Math.max(1, +ms || 1); var otra = function () { relojes.push({ id: id, t: t + d, f: vuelta, a: [] }); }; var vuelta = function () { otra(); f(); }; otra(); return id; };
  window.clearInterval = window.clearTimeout;
  function vencidos() { for (var n = 0; n < 4000; n++) { var k = -1; for (var i = 0; i < relojes.length; i++) if (relojes[i].t <= t && (k < 0 || relojes[i].t < relojes[k].t)) k = i; if (k < 0) return; var r = relojes.splice(k, 1)[0]; try { r.f.apply(null, r.a); } catch (e) { console.error(e); } } }
  window.__reloj = { cuadro: function (ms) { t += ms; vencidos(); var q = cola.splice(0, cola.length); for (var i = 0; i < q.length; i++) { try { q[i](t); } catch (e) { console.error(e); } } }, get t() { return t; } };
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  try { navigator.vibrate = function () { return true; }; } catch (e) {}
})();</script>`;
