/* Textos del port (intro, carga y ajustes) en el idioma del dispositivo. El juego queda en inglés, como el
   original (así lo pidió). */
const T = {
  es: {
    cargando: 'Cargando…', presenta: 'presenta',
    aviso: 'Port no oficial, para uso personal, de «Five Nights at Freddy\'s 2» de Scott Cawthon (versión subida por SuperMiGamer003). El juego, sus personajes, imágenes y sonidos son de su autor.',
    linterna: 'LINTERNA', ajustes: 'Ajustes', volumen: 'Volumen', tamano: 'Tamaño de los botones', opacidad: 'Opacidad de los botones',
    mover: 'Mover los botones', listo: 'Listo', restablecer: 'Botones como al principio', menu: 'Volver al menú', cerrar: 'Cerrar',
  },
  en: {
    cargando: 'Loading…', presenta: 'presents',
    aviso: 'Unofficial personal-use port of "Five Nights at Freddy\'s 2" by Scott Cawthon (version uploaded by SuperMiGamer003). The game, its characters, images and sounds belong to their author.',
    linterna: 'FLASHLIGHT', ajustes: 'Settings', volumen: 'Volume', tamano: 'Button size', opacidad: 'Button opacity',
    mover: 'Move buttons', listo: 'Done', restablecer: 'Reset buttons', menu: 'Back to menu', cerrar: 'Close',
  },
  pt: {
    cargando: 'Carregando…', presenta: 'apresenta',
    aviso: 'Port não oficial, para uso pessoal, de "Five Nights at Freddy\'s 2" de Scott Cawthon (versão enviada por SuperMiGamer003). O jogo, seus personagens, imagens e sons pertencem ao seu autor.',
    linterna: 'LANTERNA', ajustes: 'Ajustes', volumen: 'Volume', tamano: 'Tamanho dos botões', opacidad: 'Opacidade dos botões',
    mover: 'Mover os botões', listo: 'Pronto', restablecer: 'Botões como no início', menu: 'Voltar ao menu', cerrar: 'Fechar',
  },
};
let actual = 'es';
export const idioma = () => { const l = (navigator.language || 'es').toLowerCase(); return l.startsWith('pt') ? 'pt' : l.startsWith('en') ? 'en' : 'es'; };
export function ponerIdioma(k) { actual = T[k] ? k : 'es'; document.documentElement.lang = actual; }
export const t = (k) => T[actual][k] ?? T.es[k] ?? k;
