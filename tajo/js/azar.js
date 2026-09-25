// Azar con semilla: la misma semilla, el mismo escenario y el mismo mapa.
//
// POR QUÉ DOS AZARES. Lo que ocupa lugar (rocas, notas) sale de acá, con
// semilla. Lo que sólo se ve (chispas, destellos) usa Math.random: si las
// chispas gastaran números de este generador, cortar un bloque un cuadro
// antes cambiaría el mapa que viene.

export function crearAzar(semilla) {
  let a = (typeof semilla === "string" ? semillaDeTexto(semilla) : semilla) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function semillaDeTexto(s) {
  // FNV-1a: con Math.imul, nunca con *, que redondea los bits bajos y hace que
  // dos textos distintos den la misma semilla.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function elegir(rng, lista) { return lista[Math.floor(rng() * lista.length) % lista.length]; }
export function entre(rng, a, b) { return a + (b - a) * rng(); }
