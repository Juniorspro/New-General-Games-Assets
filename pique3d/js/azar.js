// Azar con semilla.
//
// Todo el juego se genera desde un numero. El nivel 3-2 es SIEMPRE el mismo
// nivel 3-2, en cualquier maquina y en cualquier corrida — pero nadie lo dibujo
// a mano. Sin esto, un jugador no podria aprenderse un nivel, que es justo lo
// que hace que valga la pena volver a intentarlo.
//
// mulberry32: 32 bits de estado, periodo 2^32, pasa las pruebas de gjrand.
// No es criptografico y no tiene por que serlo.

export function azar(semilla) {
  let a = semilla >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Azucar: casi todo el generador pide uno de estos cuatro.
  f.entre = (a, b) => a + f() * (b - a);
  f.entero = (a, b) => Math.floor(a + f() * (b - a + 1));
  f.uno = (lista) => lista[Math.floor(f() * lista.length)];
  f.chance = (p) => f() < p;
  // Elegir con pesos. Los pesos NO se normalizan a mano en cada llamada:
  // pasarlos sin normalizar es lo comodo y es donde se cuelan los errores.
  f.pesado = (pares) => {
    let total = 0;
    for (const p of pares) total += p[1];
    let r = f() * total;
    for (const p of pares) { r -= p[1]; if (r <= 0) return p[0]; }
    return pares[pares.length - 1][0];
  };
  f.mezclar = (lista) => {
    const l = lista.slice();
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(f() * (i + 1));
      [l[i], l[j]] = [l[j], l[i]];
    }
    return l;
  };
  return f;
}

// La semilla de un nivel sale de su numero, no de un contador global: asi
// generar el 4-2 no depende de haber generado antes el 4-1.
export function semillaDe(mundo, nivel, tanda) {
  return (Math.imul(mundo, 0x9E3779B1) ^ Math.imul(nivel, 0x85EBCA77)
          ^ Math.imul(tanda + 1, 0xC2B2AE3D)) >>> 0;
}
