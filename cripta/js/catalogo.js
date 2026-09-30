// Lo que se compra y cuánto cuesta. Una pasada por los 30 niveles deja unas
// 1200 monedas y una subida de 200 m, unas 60: la primera piel sale al rato
// y la reina pide ganas.
export const PIELES_TIENDA = [
  { id: 'lu', precio: 0 },
  { id: 'ambar', precio: 100 },
  { id: 'menta', precio: 180 },
  { id: 'rosa', precio: 240 },
  { id: 'hielo', precio: 320 },
  { id: 'fuego', precio: 400 },
  { id: 'noche', precio: 500 },
  { id: 'oro', precio: 650 },
];

export const MEJORAS = ['iman', 'hielo', 'doble', 'escudo'];
export const NIVEL_MAX = 4;
// lo que sale subir cada mejora de un nivel al siguiente
export const PRECIO_MEJORA = [80, 160, 280, 450];

// Revivir en la torre, una vez por subida.
export const REVIVIR = 50;

// Premios al terminar un nivel.
export const PREMIO = { base: 5, porEstrella: 3, limpio: 10 };
