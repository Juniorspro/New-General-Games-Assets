/* Textos en español, inglés y portugués. Los avisos del juego salen del original (en inglés).
   Los de las teles son del juego: van en datos/tv.json (no se guardan en el repo). */
import { D } from './guardado.js';

const T = {
  es: {
    cargando: 'cargando la escena…', jugar: 'JUGAR', seguir: 'SEGUIR', controles: 'CONTROLES', ajustes: 'AJUSTES', creditos: 'CRÉDITOS',
    volver: 'VOLVER', menu: 'MENÚ', pausa: 'PAUSA', reiniciar: 'REINICIAR', listo: 'LISTO',
    contador: 'Mallas glitcheadas del colectivo: {n}/10',
    juntar: 'Apretá E para juntar la malla glitcheada', sentarse: 'Sentate y apretá E',
    viene: 'Se escucha algo a lo lejos… el colectivo viene en camino.',
    muerte: 'ERROR: el jugador fue reiniciado', caida: 'te caíste del mundo',
    fin1: 'El colectivo arrancó.', fin2: 'Los objetos del juego fueron recuperados_',
    finBoton: 'Tocá para reiniciar (alias botón de prueba)',
    tiempo: 'Tiempo', muertes: 'Muertes', record: 'Récord',
    correr: 'CORRER', saltar: 'SALTAR', linterna: 'LINTERNA', usar: 'E',
    sens: 'Sensibilidad', invertir: 'Invertir vertical', brillo: 'Brillo', calidad: 'Calidad', baja: 'Baja', media: 'Media', alta: 'Alta',
    musica: 'Volumen', vibrar: 'Vibración', idioma: 'Idioma', correrFijo: 'Correr queda apretado', si: 'Sí', no: 'No',
    editor: 'Tocá un botón y arrastralo. Abajo cambiás su tamaño.', tam: 'Tamaño', opacidad: 'Transparencia', zurdo: 'Zurdo', fabrica: 'Como venía',
    ayudaTeclas: 'WASD o flechas: caminar · Shift: correr · Espacio: saltar · F: linterna · E: agarrar · Esc: pausa',
    ayudaTacto: 'Izquierda: caminar · Derecha: mirar · Juntá las 10 mallas glitcheadas del colectivo',
    creditosTxt: 'Bus Stop Simulator BETA 1.0.1, un juego de <b>Sixten Kastalje</b> (@SixtenKastalje) y <b>Magnus Jungersen</b> (@Sodakurt), de GameJolt. Nunca se terminó.<br><br>Este es un port para Android rearmado desde sus archivos: la escena, los modelos, las texturas, los sonidos y la lógica son los del original. Todo el contenido es de sus autores.<br><br>Port: JXStudios.',
  },
  en: {
    cargando: 'loading the scene…', jugar: 'PLAY', seguir: 'RESUME', controles: 'CONTROLS', ajustes: 'SETTINGS', creditos: 'CREDITS',
    volver: 'BACK', menu: 'MENU', pausa: 'PAUSED', reiniciar: 'RESTART', listo: 'DONE',
    contador: 'Collected glitched meshes of the bus: {n}/10',
    juntar: "Press 'E' to collect glitched mesh", sentarse: "Take a seat and press 'E'",
    viene: 'Something sounds far away… the bus is on its way.',
    muerte: 'ERROR: player has been reset', caida: 'you fell out of the world',
    fin1: 'The bus could drive.', fin2: 'The game objects were recovered_',
    finBoton: 'Click to restart AKA test button',
    tiempo: 'Time', muertes: 'Deaths', record: 'Best',
    correr: 'SPRINT', saltar: 'JUMP', linterna: 'LIGHT', usar: 'E',
    sens: 'Sensitivity', invertir: 'Invert vertical', brillo: 'Brightness', calidad: 'Quality', baja: 'Low', media: 'Medium', alta: 'High',
    musica: 'Volume', vibrar: 'Vibration', idioma: 'Language', correrFijo: 'Sprint stays on', si: 'Yes', no: 'No',
    editor: 'Touch a button and drag it. Change its size below.', tam: 'Size', opacidad: 'Transparency', zurdo: 'Left-handed', fabrica: 'Reset',
    ayudaTeclas: 'WASD or arrows: walk · Shift: sprint · Space: jump · F: flashlight · E: collect · Esc: pause',
    ayudaTacto: 'Left: walk · Right: look · Collect the 10 glitched meshes of the bus',
    creditosTxt: 'Bus Stop Simulator BETA 1.0.1, a game by <b>Sixten Kastalje</b> (@SixtenKastalje) and <b>Magnus Jungersen</b> (@Sodakurt), from GameJolt. It was never finished.<br><br>This is an Android port rebuilt from its files: the scene, models, textures, sounds and logic are the original ones. All content belongs to its authors.<br><br>Port: JXStudios.',
  },
  pt: {
    cargando: 'carregando a cena…', jugar: 'JOGAR', seguir: 'CONTINUAR', controles: 'CONTROLES', ajustes: 'AJUSTES', creditos: 'CRÉDITOS',
    volver: 'VOLTAR', menu: 'MENU', pausa: 'PAUSA', reiniciar: 'REINICIAR', listo: 'PRONTO',
    contador: 'Malhas bugadas do ônibus coletadas: {n}/10',
    juntar: 'Aperte E para coletar a malha bugada', sentarse: 'Sente-se e aperte E',
    viene: 'Algo soa ao longe… o ônibus está a caminho.',
    muerte: 'ERRO: o jogador foi reiniciado', caida: 'você caiu do mundo',
    fin1: 'O ônibus pôde partir.', fin2: 'Os objetos do jogo foram recuperados_',
    finBoton: 'Toque para reiniciar (vulgo botão de teste)',
    tiempo: 'Tempo', muertes: 'Mortes', record: 'Recorde',
    correr: 'CORRER', saltar: 'PULAR', linterna: 'LANTERNA', usar: 'E',
    sens: 'Sensibilidade', invertir: 'Inverter vertical', brillo: 'Brilho', calidad: 'Qualidade', baja: 'Baixa', media: 'Média', alta: 'Alta',
    musica: 'Volume', vibrar: 'Vibração', idioma: 'Idioma', correrFijo: 'Correr fica ligado', si: 'Sim', no: 'Não',
    editor: 'Toque um botão e arraste. Embaixo muda o tamanho.', tam: 'Tamanho', opacidad: 'Transparência', zurdo: 'Canhoto', fabrica: 'Padrão',
    ayudaTeclas: 'WASD ou setas: andar · Shift: correr · Espaço: pular · F: lanterna · E: coletar · Esc: pausa',
    ayudaTacto: 'Esquerda: andar · Direita: olhar · Colete as 10 malhas bugadas do ônibus',
    creditosTxt: 'Bus Stop Simulator BETA 1.0.1, um jogo de <b>Sixten Kastalje</b> (@SixtenKastalje) e <b>Magnus Jungersen</b> (@Sodakurt), do GameJolt. Nunca foi terminado.<br><br>Este é um port para Android remontado a partir dos seus arquivos: a cena, os modelos, as texturas, os sons e a lógica são os originais. Todo o conteúdo é dos seus autores.<br><br>Port: JXStudios.',
  },
};

export const IDIOMAS = ['es', 'en', 'pt'];
export function t(k, v) {
  const s = (T[D.idioma] || T.es)[k] ?? T.es[k] ?? k;
  return v && typeof s === 'string' ? s.replace(/\{(\w+)\}/g, (_, x) => v[x]) : s;
}
