/* Los textos del port en español, inglés y portugués. Los subtítulos y los textos 3D del juego van en
   datos/subtitulos.json (son del juego: no se guardan en el repo); sin ese archivo, en inglés. */
import { D } from './guardado.js';

const T = {
  es: {
    cargando: 'cargando…', jugar: 'JUGAR', seguir: 'SEGUIR', controles: 'CONTROLES', ajustes: 'AJUSTES', creditos: 'CRÉDITOS',
    volver: 'VOLVER', menu: 'MENÚ', pausa: 'PAUSA', reiniciar: 'EMPEZAR DE NUEVO', listo: 'LISTO', sub: 'Ficción interactiva · v0.2 · port',
    sens: 'Sensibilidad', invertir: 'Invertir vertical', brillo: 'Brillo', gamma: 'Gamma (más claro)', calidad: 'Calidad', baja: 'Baja', media: 'Media', alta: 'Alta',
    musica: 'Volumen', vibrar: 'Vibración', idioma: 'Idioma', si: 'Sí', no: 'No', subs: 'Subtítulos grandes',
    editor: 'Tocá un control y arrastralo. Abajo cambiás su tamaño.', tam: 'Tamaño', opacidad: 'Transparencia', zurdo: 'Zurdo', fabrica: 'Como venía',
    ayudaTacto: 'Izquierda: caminar · Derecha: mirar · Las cosas pasan al tocarlas',
    ayudaTeclas: 'WASD o flechas: caminar · Mouse: mirar · Las cosas pasan al tocarlas · Esc: pausa',
    advertencia: 'Juego de terror: oscuridad, sustos y ruidos fuertes. Mejor con auriculares.',
    creditosTxt: '<b>Pizza Delivery v0.2</b> (junio de 2013), ficción interactiva de <b>Shahabaz Khan</b> (Shahabaz Khan Productions), inspirada en la película tamil "Pizza".<br><br>Audio: freesound · Modelos: Trimble, Mixamo, Unity · Suicide note: 11linda (freesound) · "Night Break" de Kevin MacLeod (incompetech.com) · Gracias a AlucardsBride (freesound).<br><br>Este es un port para Android rearmado desde sus archivos: las escenas, los modelos, los sonidos y la historia son los del original. Todo el contenido es de sus autores.<br><br>Port: JXStudios.',
  },
  en: {
    cargando: 'loading…', jugar: 'PLAY', seguir: 'RESUME', controles: 'CONTROLS', ajustes: 'SETTINGS', creditos: 'CREDITS',
    volver: 'BACK', menu: 'MENU', pausa: 'PAUSED', reiniciar: 'START OVER', listo: 'DONE', sub: 'Interactive fiction · v0.2 · port',
    sens: 'Sensitivity', invertir: 'Invert vertical', brillo: 'Brightness', gamma: 'Gamma (brighter)', calidad: 'Quality', baja: 'Low', media: 'Medium', alta: 'High',
    musica: 'Volume', vibrar: 'Vibration', idioma: 'Language', si: 'Yes', no: 'No', subs: 'Big subtitles',
    editor: 'Touch a control and drag it. Change its size below.', tam: 'Size', opacidad: 'Transparency', zurdo: 'Left-handed', fabrica: 'Reset',
    ayudaTacto: 'Left: walk · Right: look · Interaction is automatic (touch things)',
    ayudaTeclas: 'WASD or arrows: walk · Mouse: look · Interaction is automatic · Esc: pause',
    advertencia: 'Horror game: darkness, jump scares and loud sounds. Best with headphones.',
    creditosTxt: '<b>Pizza Delivery v0.2</b> (June 2013), interactive fiction by <b>Shahabaz Khan</b> (Shahabaz Khan Productions), inspired by the Tamil movie "Pizza".<br><br>Audio: freesound · Models: Trimble, Mixamo, Unity · Suicide note: 11linda (freesound) · "Night Break" by Kevin MacLeod (incompetech.com) · Thanks to AlucardsBride (freesound).<br><br>This is an Android port rebuilt from its files: the scenes, models, sounds and story are the original ones. All content belongs to its authors.<br><br>Port: JXStudios.',
  },
  pt: {
    cargando: 'carregando…', jugar: 'JOGAR', seguir: 'CONTINUAR', controles: 'CONTROLES', ajustes: 'AJUSTES', creditos: 'CRÉDITOS',
    volver: 'VOLTAR', menu: 'MENU', pausa: 'PAUSA', reiniciar: 'COMEÇAR DE NOVO', listo: 'PRONTO', sub: 'Ficção interativa · v0.2 · port',
    sens: 'Sensibilidade', invertir: 'Inverter vertical', brillo: 'Brilho', gamma: 'Gama (mais claro)', calidad: 'Qualidade', baja: 'Baixa', media: 'Média', alta: 'Alta',
    musica: 'Volume', vibrar: 'Vibração', idioma: 'Idioma', si: 'Sim', no: 'Não', subs: 'Legendas grandes',
    editor: 'Toque um controle e arraste. Embaixo muda o tamanho.', tam: 'Tamanho', opacidad: 'Transparência', zurdo: 'Canhoto', fabrica: 'Padrão',
    ayudaTacto: 'Esquerda: andar · Direita: olhar · As coisas acontecem ao tocá-las',
    ayudaTeclas: 'WASD ou setas: andar · Mouse: olhar · As coisas acontecem ao tocá-las · Esc: pausa',
    advertencia: 'Jogo de terror: escuridão, sustos e sons altos. Melhor com fones.',
    creditosTxt: '<b>Pizza Delivery v0.2</b> (junho de 2013), ficção interativa de <b>Shahabaz Khan</b> (Shahabaz Khan Productions), inspirada no filme tâmil "Pizza".<br><br>Áudio: freesound · Modelos: Trimble, Mixamo, Unity · Suicide note: 11linda (freesound) · "Night Break" de Kevin MacLeod (incompetech.com) · Obrigado a AlucardsBride (freesound).<br><br>Este é um port para Android remontado a partir dos seus arquivos: as cenas, os modelos, os sons e a história são os originais. Todo o conteúdo é dos seus autores.<br><br>Port: JXStudios.',
  },
};
export const IDIOMAS = ['es', 'en', 'pt'];
export function t(k) { return (T[D.idioma] || T.es)[k] ?? T.es[k] ?? k; }
let SUBS = {};
export function ponerSubtitulos(s) { SUBS = s || {}; }
/* el texto del juego en el idioma elegido (las líneas que dicen otros empiezan con ">") */
export function traducir(txt) {
  if (!txt || D.idioma === 'en') return txt;
  const k = D.idioma === 'pt' ? 1 : 0;
  const s = SUBS[txt];
  return s ? s[k] : txt;
}
