// La paleta: pocos colores y todos elegidos. El fondo casi negro con un tinte
// violeta (el negro puro se ve muerto en un celular), las paredes de cada
// mundo en cuatro tonos (borde que brilla, luz, relleno, sombra) y la
// heroína en verde lima: lo más luminoso de la pantalla es siempre ella.
export const P = {
  negro: '#05040b',
  fondo: '#0b0918',
  fondo2: '#131028',
  fondo3: '#1c1838',
  blanco: '#f6f3ff',
  gris: '#8d88ad',
  grisOsc: '#4a4668',
  // Lu, la luciérnaga
  lu: '#c9ff3b', luClaro: '#f3ffb4', luOsc: '#6f9a12', cabeza: '#3a2a58', cabezaLuz: '#6b56a8', ala: '#bfe9ff', mejilla: '#ff6fa8',
  // lo que se junta
  chispa: '#ffe66d', chispaLuz: '#fffbd6',
  moneda: '#ffc93c', monedaOsc: '#b86e0e', monedaLuz: '#fff4b8',
  estrella: '#ffe45c', estrellaOsc: '#d08a12',
  // lo que mata
  rojo: '#ff3b5c', rojoOsc: '#8e1530', rojoLuz: '#ffb3c1',
  lava: '#ff5a1f', lavaLuz: '#ffc043', lavaOsc: '#9a1f0c', lavaNegra: '#3a0d08',
  polilla: '#8a78c8', polillaOsc: '#3e3170', polillaOjo: '#ff4fd8',
  piedra: '#7c7390', piedraOsc: '#3f3950', piedraLuz: '#b3aac8',
  fuego: '#ff7a2f', fuegoLuz: '#ffe07a',
  erizo: '#3cd6a0', erizoOsc: '#136b55', erizoPua: '#e6fff5',
  // potenciadores
  iman: '#ff4f7b', escudo: '#61b5ff', hielo: '#a6f6ff', doble: '#ffb13b',
  portalA: '#35f2ff', portalB: '#ff5ce1',
};

// Cada mundo: borde (el neón), claro, relleno y sombra de sus paredes, más el
// color de su "luz" en el piso (la línea que sangra junto a la pared).
export const MUNDOS_COLOR = [
  { borde: '#39f3d9', claro: '#1bb3a4', relleno: '#0c3a41', sombra: '#071f26', luz: '#0f2e3a', detalle: '#1a5a60' },   // Catacumbas
  { borde: '#e66bff', claro: '#a33ae0', relleno: '#36134f', sombra: '#1f0a30', luz: '#2a1240', detalle: '#5a2280' },   // Jardín de hongos
  { borde: '#ffa347', claro: '#e5562a', relleno: '#48190f', sombra: '#270b08', luz: '#351309', detalle: '#6e2a18' },   // Horno
  { borde: '#8ff08a', claro: '#3fb94a', relleno: '#123a1d', sombra: '#0a2111', luz: '#10301a', detalle: '#1f5a2c' },   // la torre (infinito)
];
