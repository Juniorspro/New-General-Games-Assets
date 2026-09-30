// Las pieles: una lista de colores que se repite a lo largo del cuerpo, de a
// `franja` bolitas por color. Las primeras están abiertas; las demás se abren
// con el mejor largo alcanzado (le da un porqué a la partida siguiente).
// Todas son nuestras: colores, franjas y banderas, nada copiado.
export const PIELES = [
  { id: 'lima', colores: ['#8cff3a', '#58c91c'], franja: 3 },
  { id: 'coral', colores: ['#ff6b6b', '#ffb0a8'], franja: 3 },
  { id: 'uva', colores: ['#a36bff', '#6e33d6'], franja: 3 },
  { id: 'cielo', colores: ['#4fc3ff', '#1d8fe0'], franja: 3 },
  { id: 'menta', colores: ['#2effb0', '#b6ffe6'], franja: 2 },
  { id: 'rosa', colores: ['#ff5fb3', '#ffc6e6'], franja: 2 },
  { id: 'fuego', colores: ['#ff3d00', '#ff9100', '#ffe600'], franja: 2 },
  { id: 'hielo', colores: ['#eafaff', '#95dcff', '#46b6ff'], franja: 2 },
  { id: 'argentina', colores: ['#74acdf', '#74acdf', '#ffffff', '#f6b40e', '#ffffff', '#74acdf'], franja: 2 },
  { id: 'uruguay', colores: ['#ffffff', '#1f5fbf'], franja: 2 },
  { id: 'brasil', colores: ['#009c3b', '#ffdf00', '#002776', '#ffdf00'], franja: 2 },
  { id: 'mexico', colores: ['#006847', '#ffffff', '#ce1126'], franja: 3 },
  { id: 'jx', colores: ['#17181b', '#26282d', '#c9ccd4', '#26282d'], franja: 2, mejor: 150 },
  { id: 'abeja', colores: ['#ffd000', '#ffd000', '#1b1b1f'], franja: 2, mejor: 250 },
  { id: 'tigre', colores: ['#ff8a00', '#ff8a00', '#ff8a00', '#1b1b1f'], franja: 2, mejor: 350 },
  { id: 'cebra', colores: ['#f5f5f5', '#1b1b1f'], franja: 2, mejor: 450 },
  { id: 'caramelo', colores: ['#ffffff', '#ff2d55'], franja: 2, mejor: 600 },
  { id: 'sandia', colores: ['#ff3b5c', '#ff3b5c', '#ff3b5c', '#ffffff', '#1fb34a'], franja: 2, mejor: 750 },
  { id: 'oceano', colores: ['#00608a', '#00a6ed', '#7fdbff', '#00a6ed'], franja: 2, mejor: 900 },
  { id: 'bosque', colores: ['#1e5631', '#4c9a2a', '#a4de02', '#4c9a2a'], franja: 2, mejor: 1100 },
  { id: 'lava', colores: ['#ff3d00', '#ff7a1a', '#3a0d08'], franja: 2, mejor: 1300 },
  { id: 'chicle', colores: ['#ff9ff3', '#feca57', '#48dbfb'], franja: 3, mejor: 1600 },
  { id: 'robot', colores: ['#9aa0aa', '#9aa0aa', '#5b5f68', '#ff3b30'], franja: 2, mejor: 2000 },
  { id: 'galaxia', colores: ['#2b0f5a', '#5a2bd6', '#e0a0ff', '#1c0a3a'], franja: 2, mejor: 2500 },
  { id: 'oro', colores: ['#ffd23f', '#ffb000', '#fff3b0', '#ffb000'], franja: 2, mejor: 3000 },
  { id: 'neon', colores: ['#39ff14', '#00e5ff', '#ff00e5'], franja: 3, mejor: 4000 },
  { id: 'arcoiris', colores: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de'], franja: 2, mejor: 5000 },
];

export const pielPorId = (id) => PIELES.find((p) => p.id === id) || PIELES[0];
export const abierta = (p, mejor) => !p.mejor || mejor >= p.mejor;

// El color de la bolita k (0 = la cabeza) de una piel.
export const colorDe = (piel, k) => piel.colores[Math.floor(k / piel.franja) % piel.colores.length];

// Nombres para los bots: inventados, cortos, de varios idiomas (como la gente real).
export const NOMBRES = [
  'Tito', 'Lucha', 'Mxxa', 'Pipo', 'Nube', 'Chispa', 'Rulo', 'Kiki', 'Toto', 'Fer', 'Maru', 'Juli', 'Nacho', 'Coqui',
  'Rayo', 'Tobi', 'Luz', 'Bruno', 'Chule', 'Pato', 'Mora', 'Gaspi', 'Yanina', 'Lolo', 'Santi', 'Vale', 'Nico', 'Cami',
  'Bolt', 'Ziggy', 'Moxie', 'Ninja', 'Pixel', 'Rex', 'Zora', 'Echo', 'Luna', 'Nova', 'Kai', 'Milo', 'Juno', 'Axel',
  'Tatu', 'Bia', 'Caio', 'Dudu', 'Leka', 'Vini', 'Gabi', 'Rafa', 'Tati', 'Zeca', 'Lipe', 'Duda',
  'serpenteo', 'la_ñata', 'sin nombre', 'xX_viper_Xx', 'el_gusano', 'fideo', 'manguera', 'churro', 'spaghetti', 'caracol?',
  'no me comas', 'soy chiquito', 'mamba', 'cobra_ar', 'boa', 'anaconda', 'coral', 'yarará', 'culebrita', 'viborón',
];
