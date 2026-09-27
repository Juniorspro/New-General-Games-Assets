// RC6 modo 6A (el del control remoto multimedia de la Xbox 360 y de Media
// Center). Genera el patrón de microsegundos que le pasás a
// ConsumerIrManager.transmit, y también lo decodifica de vuelta, para poder
// probar sin una consola: si codificar y decodificar da el mismo número, la
// trama es una RC6 6A válida con los bits correctos.
//
// La misma lógica está copiada en la app (Rc6.java): esto es la referencia
// probada.

// Unidad de tiempo RC6: 16 ciclos de la portadora de 36 kHz ≈ 444 µs.
export const T = 444;
export const PORTADORA = 36000;

// Los 36 bits de cada botón, tal como los publican las bases de IR (MSB
// primero). El nibble de arranque 0xC lleva el bit de inicio (1) y el modo
// (6 = 110). El "bit de rastreo" (toggle) es el bit 16 contando desde el de
// menos peso (máscara 0x8000): se invierte en cada pulsación o el receptor
// ignora la repetición.
export const TOGGLE = 0x8000n;
export const BOTONES = {
  encender:  0xc800f740cn,
  guia:      0xc800f7464n,   // botón central de Xbox (guide)
  a:         0xc800f7466n,
  b:         0xc800ff425n,
  x:         0xc800ff468n,
  y:         0xc800f7426n,
  arriba:    0xc800ff41en,
  abajo:     0xc800f741fn,
  izquierda: 0xc800f7420n,
  derecha:   0xc800ff421n,
  ok:        0xc800ff422n,
  atras:     0xc800ff423n,
  reproducir:0xc800ff416n,
  pausa:     0xc800f7418n,
  detener:   0xc800ff419n,
  adelantar: 0xc800f7415n,
  retroceder:0xc800ff414n,
  info:      0xc800ff40fn,
};

const BITS = 36;
// La posición del bit de rastreo dentro de los 36 (contando desde el MSB) y
// su ancho doble.
const IDX_TOGGLE = BITS - 1 - 16;   // el bit de máscara 0x8000

// Un botón → patrón [mark, space, mark, space, …] en µs.
// RC6 es Manchester: un "1" es marca y después espacio; un "0" al revés. El
// bit de rastreo mide el doble. Se juntan tramos consecutivos del mismo nivel.
export function patron(valor36) {
  const medios = [];   // {nivel: 1=marca 0=espacio, u: unidades}
  // Cabecera (AGC): 6t marca + 2t espacio.
  medios.push({ nivel: 1, u: 6 }, { nivel: 0, u: 2 });
  for (let i = 0; i < BITS; i++) {
    const bit = Number((valor36 >> BigInt(BITS - 1 - i)) & 1n);
    const u = i === IDX_TOGGLE ? 2 : 1;
    if (bit) { medios.push({ nivel: 1, u }, { nivel: 0, u }); }
    else { medios.push({ nivel: 0, u }, { nivel: 1, u }); }
  }
  // Juntar niveles iguales seguidos y pasar a µs.
  const pat = [];
  let nivelActual = 1, acc = 0;
  const empujar = () => pat.push(Math.round(acc * T));
  for (const m of medios) {
    if (m.nivel === nivelActual) { acc += m.u; }
    else { empujar(); nivelActual = m.nivel; acc = m.u; }
  }
  empujar();
  // El patrón tiene que empezar en marca y terminar en marca (transmisión).
  if (pat.length % 2 === 0) pat.push(6 * T);   // espacio final de guarda
  return pat;
}

// Patrón de µs → valor de 36 bits (o null si no es una trama RC6 6A válida).
export function decodificar(pat) {
  // De µs a una tira de medios-bits por nivel, redondeando a unidades t.
  const medios = [];
  let nivel = 1;
  for (const dur of pat) {
    let u = Math.round(dur / T);
    while (u-- > 0) medios.push(nivel);
    nivel ^= 1;
  }
  // Cabecera: 6 marcas + 2 espacios.
  let p = 0;
  const tomar = (n, val) => { for (let k = 0; k < n; k++) if (medios[p++] !== val) return false; return true; };
  if (!tomar(6, 1) || !tomar(2, 0)) return null;
  let valor = 0n;
  for (let i = 0; i < BITS; i++) {
    const u = i === IDX_TOGGLE ? 2 : 1;
    const a = medios[p], b = medios[p + u];
    if (a === undefined || b === undefined) return null;
    // Comprobar que los dos medios son uniformes.
    for (let k = 0; k < u; k++) if (medios[p + k] !== a || medios[p + u + k] !== b) return null;
    p += 2 * u;
    let bit;
    if (a === 1 && b === 0) bit = 1n;
    else if (a === 0 && b === 1) bit = 0n;
    else return null;
    valor = (valor << 1n) | bit;
  }
  return valor;
}
