/* ============================================================================
   videos/remotion/src/montajes.js — qué se ve mientras se dice cada línea del
   relato. Cada línea tiene su sticker (la cara del que cuenta), sus planos
   (pedazos de las tomas del juego, repartidos por peso en lo que dura la
   línea) y sus extras (carteles, memes, golpes). Los tiempos de la voz salen
   de medios/voz/<video>/lineas.json (los mide videos/tiempos.py).
   ========================================================================== */

/* cuánto dura cada toma grabada (s): para no pedirle a un plano más de lo que hay */
export const LARGO_TOMAS = {
  kuntur: { titulo: 8, prologo: 11, colores: 6, colores2: 5, salinas: 6, tren: 6, puna: 6, nevado: 6 },
  'luz-mala': { titulo: 9, intro: 6, pueblo: 7.5, charla: 4.7, tienda: 5, raices: 5, hongal: 4.2, hilos: 2.3, pique: 4.3, rio: 2.7, subida: 6.7, muerte: 4, torito: 11, viuda: 4, reina: 4, mapa: 4 },
};

export const MONTAJES = {
  'luz-mala': {
    tomas: 'tomas/luz-mala', voz: 'voz/luz-mala', musica: 'musica/luz-mala.wav',
    formato: 'completo',                   // el juego ya es vertical: a pantalla entera
    color: '#ffd35a', color2: '#ff9d2e', tinta: '#1b1206',
    particulas: 'luciernagas',
    gancho: { texto: 'Hice un juego\ndel CHACO 🔥', hasta: 3.2 },
    lineas: [
      { sticker: 'sorpresa', pausa: 1.5, planos: [['titulo', 0, 5], ['pueblo', 0.6, 5.4]],
        extras: [{ tipo: 'meme', meme: 'panik', palabra: 'vos.', mas: 0, dur: 2.6, ancho: 580, tamPanel: 42, paneles: [[0.02, 0, 0.47, 0.34, 'ves una luz en el monte a la noche'], [0.02, 0.34, 0.47, 0.67, 'es una luciérnaga nomás'], [0.02, 0.68, 0.47, 1, 'la luciérnaga sos vos']] }] },
      { sticker: 'tranqui', planos: [['intro', 1.2, 3.2], ['subida', 0.5, 3.4]], extras: [{ tipo: 'chip', en: 0.2, dur: 2.6, texto: '✨ CHISPA' }] },
      { sticker: 'guino', planos: [['charla', 0.4, 3.4], ['tienda', 0.1, 3.2]],
        extras: [{ tipo: 'meme', meme: 'drake', texto: 'la charla en el Chaco:', palabra: 'charla,', dur: 2.3, ancho: 620, paneles: [[0.5, 0, 1, 0.5, 'con mate caliente'], [0.5, 0.5, 1, 1, 'con tereré bien helado']] }] },
      { sticker: 'serio', pausa: 0.9, planos: [['raices', 0.4, 2.8], ['hongal', 0.6, 3.1]],
        extras: [{ tipo: 'golpe', palabra: 'Todo.', texto: 'TODO.' }, { tipo: 'meme', meme: 'esto-esta-bien', texto: 'yo a la siesta en el Chaco, en enero:', desdePalabra: 'Todo.', mas: 0.35, dur: 1.6 }] },
      { sticker: 'sorpresa', planos: [['muerte', 0.3, 3.6], ['pique', 0.2, 3.4]], extras: [{ tipo: 'chip', palabra: 'Hollow', dur: 1.8, texto: '🦋 como Hollow Knight' }] },
      { sticker: 'piensa', pausa: 0.6, planos: [['torito', 0.2, 5.6]], extras: [{ tipo: 'meme', meme: 'mono-de-costado', texto: 'el Torito cuando «avisa»:', desdePalabra: 'más', mas: 0, dur: 1.7 }] },
      { sticker: 'bien', planos: [['torito', 7.6, 3.3], ['hilos', 0.1, 2]], extras: [{ tipo: 'chip', palabra: 'aleteo', dur: 2.2, texto: '🪽 + ALETEO' }] },
      { sticker: 'lee', planos: [['viuda', 0.4, 2.3], ['rio', 0.1, 1.3], ['reina', 0.4, 2.7]],
        extras: [{ tipo: 'chip', palabra: 'Viuda,', dur: 1.8, texto: '🕷️ LA VIUDA' }, { tipo: 'chip', palabra: 'Reina', dur: 2.2, texto: '🐜 LA REINA' }] },
      { sticker: 'guino', planos: [['mapa', 0.1, 2.2], ['pueblo', 2.2, 3], ['titulo', 3.2, 1.7]],
        extras: [{ tipo: 'meme', meme: 'leo-brindis', texto: 'el tío en el asado cuando suena un chamamé:', palabra: 'chamamé', dur: 1.9 }, { tipo: 'golpe', palabra: '¡Sapucai!', texto: '¡SAPUCAI!', tam: 170 }] },
    ],
    cierre: { dur: 2.6, toma: ['titulo', 5.6], cta: ['Jugalo gratis 👾', 'link en la bio 👇'], nombre: 'LUZ MALA' },
  },
  kuntur: {
    tomas: 'tomas/kuntur', voz: 'voz/kuntur', musica: 'musica/kuntur.wav', volVoz: 0.3, volSola: 0.75,
    formato: 'franja',                     // el juego es acostado: va en una franja entre guardas
    franja: { y: 380, alto: 780 },
    yTexto: 1262, ySticker: 1300, tamSticker: 320, yChip: 236, yGancho: 250, yCierre: 1000,
    color: '#ffd23f', color2: '#e8364f', tinta: '#3a0f1a',
    particulas: 'papelitos',
    gancho: { texto: 'Hice un Paper Mario\nen Jujuy 🦙', hasta: 3.1 },
    /* los planos pueden acercarse a un punto: [toma, desde, peso, [x, y, zoom]] */
    lineas: [
      { sticker: 'sorpresa', planos: [['titulo', 2.2, 3, [0.36, 0.5, 1]], ['titulo', 5.2, 2.5, [0.3, 0.58, 1.6]]], extras: [{ tipo: 'chip', palabra: 'Killa.', dur: 1.2, texto: '👧 KILLA' }] },
      { sticker: 'lee', planos: [['prologo', 0, 2.6, [0.32, 0.5, 1.3]], ['colores', 0.2, 2.9, [0.42, 0.5, 1.25]]], extras: [{ tipo: 'chip', palabra: 'Purmamarca.', dur: 1.3, texto: '📍 Purmamarca, Jujuy' }] },
      { sticker: 'guino', pausa: 0.9, planos: [['colores', 2.2, 2.6, [0.38, 0.55, 1.35]], ['nevado', 0.3, 3.2, [0.3, 0.45, 1.35]]],
        extras: [{ tipo: 'meme', meme: 'pensalo', texto: 'no te pueden decir que no si no le preguntás a nadie', palabra: 'bueno,', dur: 2.2 }] },
      { sticker: 'bien', planos: [['colores2', 0, 2.2, [0.45, 0.5, 1.3]], ['salinas', 0.3, 3.2, [0.48, 0.48, 1.3]], ['puna', 0.3, 2.6, [0.45, 0.42, 1.2]]],
        extras: [{ tipo: 'chip', palabra: 'aletea,', dur: 1.5, texto: '🪽 ALETEA' }, { tipo: 'chip', palabra: 'planea.', dur: 1.2, texto: '🪂 PLANEA' }] },
      { sticker: 'piensa', pausa: 0.8, planos: [['colores2', 0.3, 3.4, [0.45, 0.45, 1.3]], ['tren', 0.4, 4.3, [0.4, 0.42, 1.2]]],
        extras: [{ tipo: 'meme', meme: 'esqueleto-esperando', texto: 'Killa esperando que Apu ayude:', palabra: 'Apu,', dur: 2.2, ancho: 470 }] },
      { sticker: 'sorpresa', planos: [['colores', 0, 1.4, [0.85, 0.52, 1.5]], ['tren', 2.8, 2.1, [0.45, 0.45, 1.2]], ['colores2', 2.6, 2.4, [0.5, 0.35, 1.1]]],
        extras: [{ tipo: 'chip', palabra: 'quince', dur: 1.8, texto: '🎵 15 COPLAS' }] },
      { sticker: 'lee', pausa: 0.9, planos: [['titulo', 0, 2.4], ['colores', 1.5, 4.2]],
        extras: [{ tipo: 'meme', meme: 'cine-absoluto', texto: 'los cerros de colores de fondo:', palabra: 'Mirá', dur: 1.8 }] },
      { sticker: 'guino', planos: [['puna', 3.0, 2.8, [0.45, 0.4, 1.2]], ['nevado', 3.2, 2.6, [0.28, 0.45, 1.5]], ['titulo', 2.4, 2.6]],
        extras: [{ tipo: 'chip', palabra: 'idiomas,', dur: 1.5, texto: '🌎 ES · EN · PT' }, { tipo: 'golpe', palabra: 'Dale,', texto: '¡DALE!', tam: 190 }] },
    ],
    cierre: { dur: 2.6, toma: ['titulo', 4.8], cta: ['Jugalo gratis 🦙', 'link en la bio 👇'], nombre: 'KUNTUR' },
  },
};
