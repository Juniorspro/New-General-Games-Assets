/* ============================================================================
   nevada/js/textos.js — todo lo que se lee, en los tres idiomas. Antes del
   menú se elige el idioma (es lo que el dueño pide en todo lo que se hace acá).
   ========================================================================== */
export const IDIOMAS = ['es', 'en', 'pt'];

const T = {
  es: {
    elegir: 'Elegí el idioma',
    titulo: 'NEVADA',
    bajada: 'Un superdeportivo y un tigre blanco en el bosque nevado. Todo en three.js, en vivo.',
    ver: 'Ver la cinemática',
    cargando: 'Preparando la nieve…',
    otraVez: 'Otra vez',
    libre: 'Cámara libre',
    arcilla: 'Modo arcilla',
    render: 'Modo render',
    sonido: 'Sonido',
    ayudaLibre: 'Arrastrá para girar · rueda o dos dedos para acercar',
    credito: 'Inspirado en un video de @m4jor3d × @W-SE',
    desglose: 'desglose',
    fin: 'hecho en three.js · nieve, luz y cámara en tiempo real',
  },
  en: {
    elegir: 'Choose your language',
    titulo: 'NEVADA',
    bajada: 'A supercar and a white tiger in the snowy woods. All three.js, running live.',
    ver: 'Play the cinematic',
    cargando: 'Getting the snow ready…',
    otraVez: 'Play again',
    libre: 'Free camera',
    arcilla: 'Clay mode',
    render: 'Render mode',
    sonido: 'Sound',
    ayudaLibre: 'Drag to orbit · wheel or pinch to zoom',
    credito: 'Inspired by a video by @m4jor3d × @W-SE',
    desglose: 'breakdown',
    fin: 'made with three.js · real-time snow, light and camera',
  },
  pt: {
    elegir: 'Escolha o idioma',
    titulo: 'NEVADA',
    bajada: 'Um superesportivo e um tigre branco na floresta nevada. Tudo em three.js, ao vivo.',
    ver: 'Ver a cinemática',
    cargando: 'Preparando a neve…',
    otraVez: 'De novo',
    libre: 'Câmera livre',
    arcilla: 'Modo argila',
    render: 'Modo render',
    sonido: 'Som',
    ayudaLibre: 'Arraste para girar · roda ou pinça para aproximar',
    credito: 'Inspirado num vídeo de @m4jor3d × @W-SE',
    desglose: 'breakdown',
    fin: 'feito em three.js · neve, luz e câmera em tempo real',
  },
};

let idioma = 'es';
export const ponerIdioma = (i) => { if (T[i]) idioma = i; };
export const tr = (k) => T[idioma][k] ?? T.es[k] ?? k;
