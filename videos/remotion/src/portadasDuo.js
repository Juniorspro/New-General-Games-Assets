/* las portadas de los dúos (PortadaDuo.jsx): de qué toma y en qué segundo sale cada captura,
   dónde se recorta y cuánto se acerca. Lo lee también videos/portadas-duo.mjs, que saca esos
   cuadros con ffmpeg antes de dibujar. */
export const PD = {
  'globo-vibora': { cartas: [['globo/dia', 5.0, '22% 62%', 1.3], ['vibora/juego', 40.5, '50% 42%', 1.3]], fondo: [['globo/tarde', 6.0], ['vibora/juego', 30.0]], pie: '¿CUÁL JUEGAS PRIMERO?', sticker: 'sorpresa' },
  'morfi-cripta': { cartas: [['morfi/hilos4', 2.75, '50% 82%', 1.45], ['cripta/lava21', 5.0, '50% 55%', 1.3]], fondo: [['morfi/globo', 1.0], ['cripta/n9', 4.0]], pie: '¿CON CUÁL TE QUEDAS?', sticker: 'piensa' },
  'isla-grumo': { cartas: [['isla/pescar', 3.77, '70% 80%', 1.3], ['grumo/t15', 2.0, '62% 52%', 1.45]], fondo: [['isla/menu', 1.0], ['grumo/t11', 2.0]], pie: '¿CUÁL JUEGAS PRIMERO?', sticker: 'sorpresa' },
};

/* el nombre del cuadro suelto de una toma */
export const foto = (toma, seg) => `${toma.replace('/', '-')}-${seg.toFixed(2)}.jpg`;
