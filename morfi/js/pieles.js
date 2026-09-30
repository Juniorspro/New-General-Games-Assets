// Lo que se compra en la tienda: cómo se ve Morfi (morfi.js › PIELES_MORFI)
// y el caramelo (dibujo.js › CARAMELOS), con su precio en monedas. Pasar las
// tres cajas con todas las estrellas da 900: alcanza para casi todo, y lo
// que falta se junta jugando de nuevo (cada nivel ganado otra vez da 2).
export const MORFIS = [
  { id: 'kraft', precio: 0 }, { id: 'regalo', precio: 50 }, { id: 'zapatos', precio: 70 }, { id: 'pizza', precio: 90 },
  { id: 'mudanza', precio: 110 }, { id: 'menta', precio: 140 }, { id: 'noche', precio: 170 }, { id: 'jx', precio: 240 },
];
export const DULCES = [
  { id: 'rojo', precio: 0 }, { id: 'frutilla', precio: 25 }, { id: 'menta', precio: 35 }, { id: 'uva', precio: 45 },
  { id: 'limon', precio: 60 }, { id: 'dulce', precio: 75 }, { id: 'arcoiris', precio: 120 },
];
// las monedas de un nivel ganado: la primera vez 10 y 5 por estrella; después, 5 por cada estrella nueva y 2 por ganar
export function premio(antes, estrellas) {
  if (antes < 0) return 10 + 5 * estrellas;
  return 2 + 5 * Math.max(0, estrellas - antes);
}
export const BONO_CAJA = 50;          // todas las estrellas de una caja
