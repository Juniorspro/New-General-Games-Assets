// Los tres cielos de Globo Libre (diez niveles cada uno) y sus colores.
// Todo plano: cada cosa es un color lleno con su sombra en un tono más oscuro
// (util.js › tono), sin degradés por cuerpo. El cielo sí va degradé, pero se
// arma una vez por tema y altura, no por cuadro.
export const TEMAS = [
  {
    id: 'dia',
    cielo: [['#5fb8ff', '#bfe6ff'], ['#4aa3f5', '#a9dcff']],   // abajo del nivel → arriba
    nube: '#ffffff', nubeSombra: '#d9efff',
    piso: '#7bd35a', pisoSombra: '#56a83d', flor: ['#ff6b8b', '#ffd23f', '#ffffff'],
    cuerpos: ['#ff6b6b', '#ffd23f', '#2ecc9a', '#4d8dff', '#a770ff', '#ff9f43'],
    fijo: '#3d4466', fijoRaya: '#4b5480', tinta: '#1d2440', meta: '#ffd23f',
    estrellas: 0,
  },
  {
    id: 'tarde',
    cielo: [['#ff9a6b', '#ffd49a'], ['#b85cc9', '#ff8fa3']],
    nube: '#ffe3ec', nubeSombra: '#f7b7cc',
    piso: '#e38b4f', pisoSombra: '#b86a38', flor: ['#fff1c1', '#ff5d8f', '#7b2cbf'],
    cuerpos: ['#7b2cbf', '#2ec4b6', '#ff9f1c', '#ff5d8f', '#3a86ff', '#ffbe0b'],
    fijo: '#4a2c5e', fijoRaya: '#5c3873', tinta: '#2a1433', meta: '#fff1c1',
    estrellas: 0.25,
  },
  {
    id: 'noche',
    cielo: [['#18265c', '#2e4a8f'], ['#0a0f2e', '#1b2660']],
    nube: '#3a4a86', nubeSombra: '#2a3870',
    piso: '#2c3e7a', pisoSombra: '#1f2c5c', flor: ['#3de7ff', '#ff4fd8', '#b8ff3d'],
    cuerpos: ['#3de7ff', '#ff4fd8', '#b8ff3d', '#ffd23f', '#8f7bff', '#ff7a59'],
    fijo: '#c9d2ff', fijoRaya: '#aab6f5', tinta: '#060a22', meta: '#3de7ff',
    estrellas: 1,
  },
];

export const temaDeNivel = (n) => TEMAS[Math.min(TEMAS.length - 1, Math.floor(n / 10))];
