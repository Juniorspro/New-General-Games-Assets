/* ============================================================================
   FILETE — lo de base: tamaños, azar con semilla, guardado y los textos.
   La pantalla mide 216 de ancho (en un celu de 1080 es escala 5 justa) y el
   alto se acomoda al celu (384 o más).
   ========================================================================== */

const W = 216;
let H = 384;
const N = 8;                                    // el tablero: 8 × 8
const CEL = 24;                                 // lado de cada casilla
const TAB = N * CEL;                            // 192
const TX = (W - TAB) / 2;                       // 12
let TY = 84;                                    // dónde empieza el tablero (se acomoda al alto)
let BANDEJA_Y = 300;                            // el centro de la bandeja de piezas

function rngSemilla(s) {
  let a = s >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const azar = (a, b) => a + Math.random() * (b - a);
const hoy = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
const salida = (t) => 1 - Math.pow(1 - t, 3);
const rebote = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

const Guardado = {
  leer(k, def) { try { const v = localStorage.getItem('filete.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  escribir(k, v) { try { localStorage.setItem('filete.' + k, JSON.stringify(v)); } catch (e) { /* sin guardado: se juega igual */ } },
  borrar(k) { try { localStorage.removeItem('filete.' + k); } catch (e) { /* */ } },
};
const DATOS = Object.assign({ record: 0, diaFecha: 0, diaRecord: 0, estrellas: {}, ayuda: false, partidas: 0 }, Guardado.leer('datos', {}));
const guardarDatos = () => Guardado.escribir('datos', DATOS);

let IDIOMA = Guardado.leer('idioma', null) || ((navigator.language || 'es').toLowerCase().startsWith('pt') ? 'pt' : (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'es');
const TXT = {
  es: {
    idioma: 'ELEGÍ TU IDIOMA', presenta: 'presenta', subtitulo: 'EL ROMPECABEZAS PORTEÑO',
    clasico: 'CLÁSICO', clasicoD: 'HASTA DONDE LLEGUES', aventura: 'LOS BARRIOS', aventuraD: 'JUNTÁ LAS FLORES', diario: 'DESAFÍO DEL DÍA',
    controles: 'CONTROLES', idiomaBtn: 'IDIOMA', record: 'RÉCORD', hoyRec: 'HOY {0}', seguirPartida: 'SEGUIR LA PARTIDA',
    elogios: ['¡LINDO!', '¡GROSO!', '¡BÁRBARO!', '¡DE PELÍCULA!', '¡UNA OBRA DE ARTE!'], limpio: '¡TABLERO LIMPIO!', combo: 'COMBO',
    fin: 'FIN DE LA FUNCIÓN', sinLugar: 'NO HAY MÁS LUGAR', otra: 'OTRA', menu: 'MENÚ', pausa: 'PAUSA', seguir: 'SEGUIR', reiniciar: 'REINICIAR',
    musica: 'MÚSICA', sonido: 'SONIDO', si: 'SÍ', no: 'NO', cambio: 'CAMBIO', nivel: 'NIVEL {0}', flores: 'FLORES', puntos: 'PUNTOS',
    ganaste: '¡QUÉ ARTE!', nivelHecho: 'NIVEL COMPLETO', siguiente: 'SIGUIENTE', reintentar: 'REINTENTAR', bloqueado: 'JUNTÁ {0}',
    altura: 'ALTURA DE LA PIEZA', velocidad: 'VELOCIDAD DEL DEDO', bandeja: 'TAMAÑO DE BANDEJA', guia: 'GUÍA DE JUGADA', zurdo: 'ZURDO', vibrar: 'VIBRAR',
    proba: 'PROBÁ ACÁ', restablecer: 'RESTABLECER', listo: 'LISTO', nuevoRecord: '¡NUEVO RÉCORD!', volver: 'VOLVER',
    ayuda: 'ARRASTRÁ LAS PIEZAS AL TABLERO. LLENÁ FILAS O COLUMNAS PARA BORRARLAS.', ayudaFlores: 'BORRÁ LAS FILAS O COLUMNAS DONDE ESTÁN LAS FLORES PARA JUNTARLAS.',
    tocar: 'TOCÁ PARA SEGUIR', cambioD: 'CAMBIA LAS TRES PIEZAS',
  },
  en: {
    idioma: 'CHOOSE YOUR LANGUAGE', presenta: 'presents', subtitulo: 'THE BUENOS AIRES PUZZLE',
    clasico: 'CLASSIC', clasicoD: 'AS FAR AS YOU CAN', aventura: 'NEIGHBORHOODS', aventuraD: 'COLLECT THE FLOWERS', diario: 'DAILY CHALLENGE',
    controles: 'CONTROLS', idiomaBtn: 'LANGUAGE', record: 'BEST', hoyRec: 'TODAY {0}', seguirPartida: 'CONTINUE GAME',
    elogios: ['NICE!', 'GREAT!', 'AWESOME!', 'AMAZING!', 'A MASTERPIECE!'], limpio: 'CLEAN BOARD!', combo: 'COMBO',
    fin: 'THE SHOW IS OVER', sinLugar: 'NO ROOM LEFT', otra: 'AGAIN', menu: 'MENU', pausa: 'PAUSE', seguir: 'RESUME', reiniciar: 'RESTART',
    musica: 'MUSIC', sonido: 'SOUND', si: 'ON', no: 'OFF', cambio: 'SWAP', nivel: 'LEVEL {0}', flores: 'FLOWERS', puntos: 'POINTS',
    ganaste: 'WHAT ART!', nivelHecho: 'LEVEL COMPLETE', siguiente: 'NEXT', reintentar: 'RETRY', bloqueado: 'GET {0}',
    altura: 'PIECE HEIGHT', velocidad: 'FINGER SPEED', bandeja: 'TRAY SIZE', guia: 'PLACEMENT GUIDE', zurdo: 'LEFT-HANDED', vibrar: 'VIBRATE',
    proba: 'TRY IT HERE', restablecer: 'RESET', listo: 'DONE', nuevoRecord: 'NEW RECORD!', volver: 'BACK',
    ayuda: 'DRAG PIECES ONTO THE BOARD. FILL ROWS OR COLUMNS TO CLEAR THEM.', ayudaFlores: 'CLEAR THE ROWS OR COLUMNS WHERE THE FLOWERS ARE TO COLLECT THEM.',
    tocar: 'TAP TO CONTINUE', cambioD: 'SWAPS THE THREE PIECES',
  },
  pt: {
    idioma: 'ESCOLHA SEU IDIOMA', presenta: 'apresenta', subtitulo: 'O QUEBRA-CABEÇA PORTENHO',
    clasico: 'CLÁSSICO', clasicoD: 'ATÉ ONDE CHEGAR', aventura: 'OS BAIRROS', aventuraD: 'JUNTE AS FLORES', diario: 'DESAFIO DO DIA',
    controles: 'CONTROLES', idiomaBtn: 'IDIOMA', record: 'RECORDE', hoyRec: 'HOJE {0}', seguirPartida: 'CONTINUAR PARTIDA',
    elogios: ['LEGAL!', 'DEMAIS!', 'INCRÍVEL!', 'DE CINEMA!', 'UMA OBRA DE ARTE!'], limpio: 'TABULEIRO LIMPO!', combo: 'COMBO',
    fin: 'FIM DO ESPETÁCULO', sinLugar: 'SEM MAIS ESPAÇO', otra: 'DE NOVO', menu: 'MENU', pausa: 'PAUSA', seguir: 'CONTINUAR', reiniciar: 'REINICIAR',
    musica: 'MÚSICA', sonido: 'SOM', si: 'SIM', no: 'NÃO', cambio: 'TROCA', nivel: 'NÍVEL {0}', flores: 'FLORES', puntos: 'PONTOS',
    ganaste: 'QUE ARTE!', nivelHecho: 'NÍVEL COMPLETO', siguiente: 'PRÓXIMO', reintentar: 'TENTAR DE NOVO', bloqueado: 'JUNTE {0}',
    altura: 'ALTURA DA PEÇA', velocidad: 'VELOCIDADE DO DEDO', bandeja: 'TAMANHO DA BANDEJA', guia: 'GUIA DE JOGADA', zurdo: 'CANHOTO', vibrar: 'VIBRAR',
    proba: 'TESTE AQUI', restablecer: 'REDEFINIR', listo: 'PRONTO', nuevoRecord: 'NOVO RECORDE!', volver: 'VOLTAR',
    ayuda: 'ARRASTE AS PEÇAS PARA O TABULEIRO. COMPLETE LINHAS OU COLUNAS PARA LIMPÁ-LAS.', ayudaFlores: 'LIMPE AS LINHAS OU COLUNAS ONDE ESTÃO AS FLORES PARA JUNTÁ-LAS.',
    tocar: 'TOQUE PARA CONTINUAR', cambioD: 'TROCA AS TRÊS PEÇAS',
  },
};
function tr(k, ...a) {
  let s = (TXT[IDIOMA] && TXT[IDIOMA][k]) ?? TXT.es[k] ?? k;
  if (typeof s === 'string') a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
const BARRIOS = ['SAN TELMO', 'LA BOCA', 'ABASTO', 'BOEDO', 'PALERMO'];
const NIVELES = 30;
