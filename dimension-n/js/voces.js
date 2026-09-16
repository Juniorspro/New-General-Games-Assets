// Dónde empieza y cuánto dura cada línea dentro de assets/voces.mp3.
//
// UN SOLO MP3 CON LAS VEINTITRÉS LÍNEAS PEGADAS. Sueltas serían veintitrés
// pedidos de red, veintitrés decodificaciones y —en el archivo único—
// veintitrés bloques de base64. Así es un pedido, un decode, y reproducir una
// línea es `start(0, desde, largo)`.
//
// LO ESCRIBE `python3 generar_voces.py armar`: no se edita a mano.
export const VOCES = {
  c0l0: [0.0, 3.11],
  c0l1: [3.29, 1.62],
  c0l2: [5.09, 1.01],
  c1l0: [6.28, 2.81],
  c1l1: [9.27, 4.18],
  c1l2: [13.63, 1.9],
  c2l0: [15.71, 1.82],
  c2l1: [17.71, 2.35],
  c2l2: [20.24, 2.19],
  c3l0: [22.61, 2.89],
  c3l1: [25.68, 1.91],
  c4l0: [27.77, 1.6],
  c4l1: [29.55, 1.86],
  c5l0: [31.59, 2.52],
  c5l1: [34.29, 2.91],
  c5l2: [37.38, 1.68],
  c6l0: [39.24, 0.91],
  c6l1: [40.33, 2.54],
  c6l2: [43.05, 0.83],
  f0: [44.06, 1.45],
  f1: [45.69, 3.08],
  f2: [48.95, 2.53],
  f3: [51.66, 2.88],
};
