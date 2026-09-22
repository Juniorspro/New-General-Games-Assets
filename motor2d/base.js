/* ============================================================================
   motor2d/base.js — lo que usa todo lo demás.
   Los juegos de motor2d se arman concatenando archivos adentro de UNA función
   ('use strict'), así que todo lo de arriba del archivo es visible abajo.
   Este archivo no toca el DOM: lo carga también el resolvedor en Node.
   ========================================================================== */

const lim = (v, a, b) => v < a ? a : v > b ? b : v;
const sig = (v) => v > 0 ? 1 : v < 0 ? -1 : 0;
const mezclar = (a, b, t) => a + (b - a) * t;
/* acercar un valor a otro sin pasarse: el "Approach" de Celeste, que es lo que
   hace que acelerar y frenar se sientan iguales a cualquier velocidad */
const acercar = (v, meta, paso) => v < meta ? Math.min(v + paso, meta) : Math.max(v - paso, meta);
const cruza = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

/* azar con semilla: una semilla da siempre el mismo mundo. El azar VISUAL
   (chispas, polvo) va con Math.random para no correr esta secuencia: si las
   partículas la usaran, la misma semilla dejaría de dar la misma partida */
function mulberry(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function semilla32(txt) {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) h = Math.imul(h ^ txt.charCodeAt(i), 16777619);
  return h >>> 0;
}
const azar = (a, b) => a + Math.random() * (b - a);
const elegir = (lista) => lista[(Math.random() * lista.length) | 0];

const CUADRO = 1000 / 60;
const DT = 1 / 60;

/* guardar en el navegador: en una ventana privada o con los datos bloqueados
   localStorage tira al tocarlo, y el juego tiene que andar igual */
const Guardado = {
  leer(clave, porDefecto) {
    try { const v = localStorage.getItem(clave); return v == null ? porDefecto : JSON.parse(v); }
    catch (e) { return porDefecto; }
  },
  escribir(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch (e) { return false; }
  },
};

/* tiempo de juego como texto: 83.4 s → "1:23.4" */
function reloj(seg) {
  const m = Math.floor(seg / 60), s = seg - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}
