/* ============================================================================
   videos/remotion/src/duos.js — qué se ve en cada video "dúo" (dos juegos de
   un archivo por video). Cada línea del relato tiene su juego, su sticker y
   sus planos: [toma, desde (s de la toma), { en: palabra, peso, enfoque, yTexto }];
   el primero arranca con la línea, los que dicen `en` arrancan con esa
   palabra y los otros se reparten por peso. Los extras se enganchan a una
   palabra (`palabra`, `mas`): chip, golpe, salta (palabras de una lista),
   marco (una zona de la pantalla), sigue (un círculo a lo que se mueve,
   con el `campo` que anotó el bot en <toma>.datos.json) y arrastre (el dedo
   de GLOBO). La forma 'partida' es la pantalla partida del gancho y del
   final: arriba/abajo = [toma, desde, de dónde se recorta (0 arriba, 1 abajo)].
   Cada juego puede llevar yTexto (la altura de los subtítulos) e yChip (la de los chips).
   Las voces: medios/voz/<video>/ (videos/tiempos.py da las palabras; videos/revisar-duo.mjs
   muestra la línea de tiempo y avisa si un plano pide más toma de la que hay).
   ========================================================================== */

const JUEGOS = {
  globo: { yTexto: 640, nombre: 'GLOBO LIBRE', tag: 'ARCADE · UN DEDO', color: '#ffc93c', color2: '#7cc8ff', tinta: '#1d2440', musica: 'musica/globo-juego.wav' },
  vibora: { nombre: 'VÍBORA.IO', tag: 'ARENA · UN DEDO', color: '#8cff3a', color2: '#c58bff', tinta: '#0f1426', musica: 'musica/vibora-juego.wav' },
  morfi: { yTexto: 330, yChip: 140, nombre: 'MORFI', tag: 'PUZLE · CORTA EL HILO', color: '#ff5a4f', color2: '#ffd84a', tinta: '#3b2410', musica: 'musica/morfi-juego.wav' },
  cripta: { nombre: 'CRIPTA NEÓN', tag: 'LABERINTO · DESLIZA', color: '#2ef2d0', color2: '#ff6ae0', tinta: '#140a24', musica: 'musica/cripta-mundo0.wav' },
  isla: { nombre: 'LA ISLA', tag: 'SUPERVIVENCIA 3D', color: '#ffe27a', color2: '#7dff8f', tinta: '#10366e', musica: 'musica/isla-juego.wav' },
  grumo: { yTexto: 330, yChip: 165, nombre: 'GRUMO', tag: 'PLATAFORMAS · STOP MOTION', color: '#ff8a3d', color2: '#ffe066', tinta: '#4a2a12', musica: 'musica/grumo-taller.wav' },
};
const par = (a, b) => ({ [a]: JUEGOS[a], [b]: JUEGOS[b] });

export const DUOS = {
  'globo-vibora': {
    voz: 'voz/globo-vibora', juegos: par('globo', 'vibora'),
    gancho: ['2 JUEGOS', 'CON UN SOLO DEDO ☝️'],
    lineas: [
      { forma: 'partida', juego: 'globo', sticker: null, pausa: 0.3, junta: true, yTexto: 1195, arriba: ['globo/menu', 0.2, 0.22], abajo: ['vibora/menu', 0.6, 0.18] },
      { juego: 'globo', titulo: true, sticker: 'lee', pausa: 0.9,
        planos: [['globo/menu', 1.4], ['globo/dia', 0.6, { en: 'Tu' }], ['globo/pum', 3.5, { en: 'todo', quieto: true }]],
        extras: [{ tipo: 'golpe', texto: '¡PUM!', palabra: 'reventar.', mas: 0.5, tam: 230 }] },
      { juego: 'globo', sticker: 'guino', pausa: 0.25,
        planos: [['globo/dia', 5.4], ['globo/tarde', 0.4, { en: 'cajas,' }], ['globo/dia', 13.3, { en: 'ladrillos' }], ['globo/dia', 11.0, { en: 'péndulos.' }]],
        extras: [
          { tipo: 'arrastre', toma: 'globo/dia', palabra: 'Tú', dur: 2.6 },
          { tipo: 'sigue', toma: 'globo/dia', campo: 'e', texto: 'TU ESCUDO', palabra: 'escudo', dur: 1.5, r: 70 },
          { tipo: 'salta', texto: 'CAJAS', palabra: 'cajas,', x: 320, y: 900, giro: -8, tam: 120 },
          { tipo: 'salta', texto: 'LADRILLOS', palabra: 'ladrillos', x: 640, y: 980, giro: 6, tam: 120 },
          { tipo: 'salta', texto: 'PÉNDULOS', palabra: 'péndulos.', x: 520, y: 900, giro: -5, tam: 120 },
        ] },
      { juego: 'globo', sticker: 'bien', pausa: 0.4,
        planos: [['globo/niveles', 0.1], ['globo/dia', 16.2, { en: 'de' }], ['globo/tarde', 2.2, { en: 'al' }], ['globo/noche', 8.2, { en: 'noche,', antes: 0.3 }], ['globo/infinito', 4.0, { en: 'un' }]],
        extras: [
          { tipo: 'chip', texto: '🎈 30 NIVELES', palabra: 'treinta', dur: 1.3 },
          { tipo: 'salta', texto: '☀️ DÍA', palabra: 'día,', x: 540, y: 900, giro: -5, tam: 110, dur: 0.8 },
          { tipo: 'salta', texto: '🌅 ATARDECER', palabra: 'atardecer', x: 540, y: 900, giro: 4, tam: 110, dur: 0.85 },
          { tipo: 'salta', texto: '🌙 NOCHE', palabra: 'noche,', x: 540, y: 900, giro: -4, tam: 110, dur: 0.8 },
          { tipo: 'chip', texto: '♾️ MODO INFINITO', palabra: 'infinito', dur: 2.4 },
        ] },
      { juego: 'vibora', cortina: true, titulo: true, tituloMas: 0.3, sticker: 'sorpresa', pausa: 0.6,
        planos: [['vibora/menu', 0.8]] },
      { juego: 'vibora', sticker: 'guino', pausa: 0.4,
        planos: [['vibora/juego', 1.2], ['vibora/juego', 18.4, { en: 'creces,' }], ['vibora/juego', 25.9, { en: 'si' }]],
        extras: [
          { tipo: 'sigue', toma: 'vibora/juego', campo: 'cab', texto: 'TÚ', palabra: 'comes', mas: -0.6, dur: 1.5, r: 64 },
          { tipo: 'golpe', texto: '¡ÑAM!', palabra: 'deshace', tam: 210 },
        ] },
      { juego: 'vibora', sticker: null, pausa: 0.2,
        planos: [['vibora/turbo', 1.5], ['vibora/turbo', 9.7, { en: 'turbo', antes: 0.2 }]],
        extras: [
          { tipo: 'marco', rect: [58, 1572, 156, 156], texto: '⚡ EL RAYO', arriba: true, palabra: 'rayo,', dur: 1.7 },
          { tipo: 'chip', texto: '⚡ TURBO', palabra: 'turbo', dur: 1.6 },
        ] },
      { juego: 'vibora', sticker: 'bien', pausa: 0.35,
        planos: [['vibora/bots', 0.05, { yTexto: 330 }], ['vibora/turbo', 12.6, { en: 'una' }]],
        extras: [{ tipo: 'marco', rect: [560, 40, 512, 545], texto: '🏆 LOS MÁS LARGOS', palabra: 'tabla', dur: 2.0 }] },
      { forma: 'partida', juego: 'vibora', sticker: 'guino', pausa: 0.3, yTexto: 1285, arriba: ['globo/infinito', 5.5, 1.0], abajo: ['vibora/juego', 36.8, 0.35] },
    ],
    cierre: { dur: 3.0 },
  },

  'morfi-cripta': {
    voz: 'voz/morfi-cripta', juegos: par('morfi', 'cripta'),
    gancho: ['2 JUEGOS', 'PARA PENSAR RÁPIDO 🧠'],
    lineas: [
      { forma: 'partida', juego: 'morfi', sticker: null, pausa: 0.3, junta: true, yTexto: 1195, arriba: ['morfi/menu', 0.4, 0.15], abajo: ['cripta/portada', 1.2, 0.0] },
      { juego: 'morfi', titulo: true, sticker: 'lee', pausa: 0.6,
        planos: [['morfi/menu', 1.0], ['morfi/n1', 0.1, { en: 'muchísima', enfoque: [0.5, 0.62, 1.25] }]],
        extras: [
          { tipo: 'sigue', toma: 'morfi/n1', campo: 'boca', texto: 'MORFI', palabra: 'muchísima', mas: 0.1, dur: 1.0, r: 95 },
          { tipo: 'golpe', texto: '¡ÑAM!', palabra: 'hambre.', mas: 0.15, tam: 210 },
        ] },
      { juego: 'morfi', sticker: 'guino', pausa: 0.3,
        planos: [['morfi/hilos3', 0.4], ['morfi/hilos4', 0.6, { en: 'y' }]],
        extras: [{ tipo: 'chip', texto: '✂️ CORTA EL HILO', palabra: 'Cortas', dur: 1.6 }] },
      { juego: 'morfi', sticker: 'sorpresa', pausa: 0.3,
        planos: [['morfi/globo', 0.9], ['morfi/abanico', 0.3, { en: 'abanicos' }], ['morfi/roto', 0.0, { en: 'y' }]],
        extras: [
          { tipo: 'salta', texto: 'GLOBOS 🎈', palabra: 'globos', x: 540, y: 560, giro: -6, tam: 110 },
          { tipo: 'salta', texto: 'ABANICOS 💨', palabra: 'abanicos', x: 540, y: 560, giro: 5, tam: 110 },
          { tipo: 'salta', texto: 'CHINCHES 📌', palabra: 'chinches', x: 540, y: 560, giro: -4, tam: 110 },
        ] },
      { juego: 'morfi', sticker: 'bien', pausa: 0.5,
        planos: [['morfi/cajas', 0.1], ['morfi/n1', 1.0, { en: 'estrellas', antes: 0.35 }]],
        extras: [
          { tipo: 'chip', texto: '📦 30 NIVELES', palabra: 'Treinta', dur: 1.6 },
          { tipo: 'salta', texto: '⭐⭐⭐', palabra: 'estrellas', x: 540, y: 1480, giro: -3, tam: 120 },
        ] },
      { juego: 'cripta', cortina: true, titulo: true, tituloMas: 0.3, sticker: 'sorpresa', pausa: 0.3,
        planos: [['cripta/portada', 1.5], ['cripta/n1', 0.0, { en: 'Deslizas,' }], ['cripta/n9', 2.0, { en: 'sale', antes: 0.15 }]],
        extras: [{ tipo: 'chip', texto: '👆 DESLIZA', palabra: 'Deslizas,', dur: 1.5 }] },
      { juego: 'cripta', sticker: 'piensa', pausa: 0.3,
        planos: [['cripta/n3', 0.4], ['cripta/pinchos', 1.9, { en: 'pinchos,' }], ['cripta/polilla', 0.0, { en: 'polillas' }], ['cripta/lava21', 1.8, { en: 'fuego.' }]],
        extras: [
          { tipo: 'salta', texto: 'PINCHOS', palabra: 'pinchos,', x: 540, y: 560, giro: -6, tam: 120 },
          { tipo: 'salta', texto: 'POLILLAS', palabra: 'polillas', x: 540, y: 560, giro: 5, tam: 120 },
          { tipo: 'salta', texto: 'FUEGO 🔥', palabra: 'fuego.', x: 540, y: 560, giro: -4, tam: 120 },
        ] },
      { juego: 'cripta', sticker: 'bien', pausa: 0.4,
        planos: [['cripta/mapa', 0.2], ['cripta/hongos', 0.3, { en: 'tres' }], ['cripta/torre', 2.6, { en: 'una' }]],
        extras: [
          { tipo: 'chip', texto: '🌍 3 MUNDOS', palabra: 'tres', dur: 1.4 },
          { tipo: 'chip', texto: '🌋 TORRE INFINITA', palabra: 'torre', dur: 2.3 },
        ] },
      { forma: 'partida', juego: 'cripta', sticker: 'guino', pausa: 0.3, yTexto: 1285, arriba: ['morfi/combo', 0.0, 0.7], abajo: ['cripta/lava24', 0.2, 0.4] },
    ],
    cierre: { dur: 3.0 },
  },

  'isla-grumo': {
    voz: 'voz/isla-grumo', juegos: par('isla', 'grumo'),
    gancho: ['2 AVENTURAS', 'PARA EL CELULAR 📱'],
    lineas: [
      { forma: 'partida', juego: 'isla', sticker: null, pausa: 0.3, junta: true, yTexto: 1195, arriba: ['isla/menu', 0.4, 0.3], abajo: ['grumo/menu', 0.6, 0.0] },
      { juego: 'isla', titulo: true, sticker: 'lee', pausa: 0.5,
        planos: [['isla/menu', 3.4], ['isla/naufragio', 1.2, { en: 'y', antes: 0.3 }]] },
      { juego: 'isla', sticker: 'guino', pausa: 0.3,
        planos: [['isla/talar', 1.85], ['isla/picar', 2.3, { en: 'picas', antes: 0.2 }], ['isla/pescar', 2.85, { en: 'pescas,', antes: 0.4 }],
          ['isla/cocinar', 2.2, { en: 'cocinas', antes: -0.2, enfoque: [0.5, 0.6, 1.2] }], ['isla/fabricar', 1.6, { en: 'armas', antes: 0.1, enfoque: [0.56, 0.58, 1.35] }]],
        extras: [{ tipo: 'chip', texto: '🪓 ⛏️ 🎣 🔥', palabra: 'Talas', dur: 2.2 }] },
      { juego: 'isla', sticker: 'serio', pausa: 0.3,
        planos: [['isla/cangrejos', 0.6], ['isla/noche', 4.0, { en: 'pero', enfoque: [0.5, 0.5, 1.35] }]],
        extras: [
          { tipo: 'chip', texto: '🦀 DE DÍA', palabra: 'día', dur: 1.8 },
          { tipo: 'chip', texto: '💀 DE NOCHE', palabra: 'noche', dur: 1.9 },
        ] },
      { juego: 'isla', sticker: 'sorpresa', pausa: 0.5,
        planos: [['isla/golem', 0.4], ['isla/golem', 3.0, { en: 'gólem', enfoque: [0.5, 0.42, 1.4] }]],
        extras: [{ tipo: 'golpe', texto: '¡EL JEFE!', palabra: 'gólem', tam: 190 }] },
      { juego: 'grumo', cortina: true, titulo: true, tituloMas: 0.3, sticker: 'sorpresa', pausa: 0.3,
        planos: [['grumo/menu', 1.0], ['grumo/t16', 0.7, { en: 'un' }], ['grumo/t26', 0.7, { en: 'animado' }]],
        extras: [
          { tipo: 'sigue', toma: 'grumo/t16', campo: 'grumo', texto: 'GRUMO', palabra: 'muñequito', dur: 1.5, r: 80 },
          { tipo: 'chip', texto: '🎞️ CUADRO POR CUADRO', palabra: 'cuadro', dur: 2.0 },
        ] },
      { juego: 'grumo', sticker: 'piensa', pausa: 0.4,
        planos: [['grumo/t11', 0.4]],
        extras: [
          { tipo: 'sigue', toma: 'grumo/t11', campo: 'puerta', texto: 'LA PUERTA', palabra: 'puerta...', dur: 1.1, r: 90, lado: -1 },
          /* la mano se lleva la puerta: el círculo va con la puerta (el bot anota la mano solo donde agarra) */
          { tipo: 'sigue', toma: 'grumo/t11', campo: 'puerta', texto: '✋ EL ANIMADOR', palabra: 'mano', dur: 1.6, r: 120, lado: -1 },
        ] },
      { juego: 'grumo', sticker: 'guino', pausa: 0.3,
        planos: [['grumo/t12', 0.2], ['grumo/t21', 0.3, { en: 'Son' }], ['grumo/camarin', 1.4, { en: 'camarín', antes: 0.3 }]],
        extras: [
          { tipo: 'golpe', texto: '¡TOMA 2!', palabra: 'toma.', tam: 190 },
          { tipo: 'chip', texto: '🎬 20 ESCENAS', palabra: 'veinte', dur: 1.5 },
          { tipo: 'chip', texto: '🎩 SOMBREROS', palabra: 'sombreros.', mas: -0.4, dur: 1.4 },
        ] },
      { forma: 'partida', juego: 'grumo', sticker: 'guino', pausa: 0.3, yTexto: 1285, arriba: [['isla/cangrejos', 3.2, 0.45, 3.3], ['isla/noche', 0.3, 0.45]], abajo: [['grumo/t15', 0.9, 0.45, 7.5], ['grumo/t24', 3.2, 0.45]] },
    ],
    cierre: { dur: 3.0 },
  },
};
