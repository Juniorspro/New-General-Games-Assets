/* ============================================================================
   SALAMANCA — lo de base: tamaños, azar con semilla, guardado y los textos.
   La pantalla mide 180 de ancho y el alto se acomoda al celu (320 o más), así
   cada píxel del juego es un número entero de píxeles reales y queda nítido.
   ========================================================================== */

const W = 180;
let H = 320;
const T = 12, COLS = 15, FILAS = 23;            // la sala: 15 × 23 baldosas de 12 = 180 × 276
const SALA_H = FILAS * T;
const HUD_H = 26;
let SY = HUD_H;                                 // dónde empieza la sala en la pantalla

/* mulberry32: el mismo número de semilla da la misma partida (el desafío del día) */
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
const elegir = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angulo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const hoy = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

const Guardado = {
  leer(k, def) {
    try { const v = localStorage.getItem('salamanca.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  },
  escribir(k, v) { try { localStorage.setItem('salamanca.' + k, JSON.stringify(v)); } catch (e) { /* sin guardado: se juega igual */ } },
};

/* lo que queda entre partidas */
const DATOS = Object.assign({
  almas: 0, partidas: 0, historia: false,
  meta: { vida: 0, danio: 0, cadencia: 0, suerte: 0, revivir: 0, yapa: 0 },
  record: 0, diaFecha: 0, diaRecord: 0, jefes: 0,
}, Guardado.leer('datos', {}));
DATOS.meta = Object.assign({ vida: 0, danio: 0, cadencia: 0, suerte: 0, revivir: 0, yapa: 0 }, DATOS.meta);
const guardarDatos = () => Guardado.escribir('datos', DATOS);

/* ---------------------------------------------------------------- textos */
let IDIOMA = Guardado.leer('idioma', null) || ((navigator.language || 'es').toLowerCase().startsWith('pt') ? 'pt' : (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'es');

const TXT = {
  es: {
    idioma: 'ELEGÍ TU IDIOMA', presenta: 'presenta', subtitulo: 'LA CUEVA DEL MANDINGA',
    jugar: 'JUGAR', diario: 'DESAFÍO DEL DÍA', altar: 'ALTAR', controles: 'CONTROLES', idiomaBtn: 'IDIOMA',
    record: 'RÉCORD {0}', hoyRec: 'HOY {0}', almas: 'ALMAS',
    historia: ['EL MANDINGA SE LLEVÓ LAS ALMAS DEL PUEBLO A SU SALAMANCA.', 'BAJÁ CON EL FAROL DE LA ABUELA Y TRAELAS DE VUELTA.'],
    ayuda: 'MOVETE PARA ESQUIVAR. QUEDATE QUIETO PARA DISPARAR.', ayudaPC: 'WASD O FLECHAS · ESPACIO: COPLA · ESC: PAUSA',
    pisos: ['LA BOCA', 'AGUAS NEGRAS', 'LAS BRASAS', 'EL SALÓN'], piso: 'PISO {0}',
    nivel: '¡SUBISTE DE NIVEL!', elegir: 'ELEGIR', tocaCarta: 'TOCÁ UNA CARTA', yapa: 'LA YAPA',
    fogon: 'EL FOGÓN', fogonTxt: 'EL POMBERO TE OFRECE UN TRATO.', descansar: 'DESCANSAR', descansarD: '+40% DE VIDA',
    trato: 'TRATO', tratoD: 'CARTA ÉPICA POR 15% DE VIDA MÁXIMA',
    pausa: 'PAUSA', seguir: 'SEGUIR', salir: 'SALIR AL MENÚ', musica: 'MÚSICA', sonido: 'SONIDO', si: 'SÍ', no: 'NO', tusCartas: 'TUS CARTAS',
    muerte: 'TE ATRAPÓ LA SALAMANCA', llegaste: 'LLEGASTE AL {0}', nuevoRecord: '¡NUEVO RÉCORD!', otraVez: 'OTRA VEZ', menu: 'MENÚ',
    victoria: '¡LIBERASTE LAS ALMAS!', victoriaTxt: 'EL MANDINGA HUYÓ MÁS ABAJO...', seguirBajando: 'SEGUIR BAJANDO',
    enemigos: 'ENEMIGOS', nv: 'NV', revivir: '¡OTRA VIDA!', copla: 'COPLA', limpio: '¡LIMPIO!',
    palanca: 'PALANCA', flotante: 'FLOTANTE', fija: 'FIJA', tamPal: 'TAMAÑO PALANCA', tamBtn: 'TAMAÑO BOTÓN', opac: 'TRANSPARENCIA',
    zurdo: 'ZURDO', vibrar: 'VIBRAR', arrastra: 'ARRASTRÁ LA PALANCA Y EL BOTÓN', restablecer: 'RESTABLECER', listo: 'LISTO',
    comprar: 'COMPRAR', max: 'MÁX', mejorar: 'MEJORAS PARA SIEMPRE', ganadas: '+{0} ALMAS', nivelAlcanzado: 'NIVEL {0}', muertos: '{0} ENEMIGOS',
    jefes: ['SAPO REY', 'LA VIUDA', 'LOBIZÓN', 'MANDINGA'], tocar: 'TOCÁ PARA SEGUIR', nuevo: 'NUEVO',
  },
  en: {
    idioma: 'CHOOSE YOUR LANGUAGE', presenta: 'presents', subtitulo: "THE DEVIL'S CAVE",
    jugar: 'PLAY', diario: 'DAILY CHALLENGE', altar: 'ALTAR', controles: 'CONTROLS', idiomaBtn: 'LANGUAGE',
    record: 'BEST {0}', hoyRec: 'TODAY {0}', almas: 'SOULS',
    historia: ["THE DEVIL TOOK THE TOWN'S SOULS DOWN TO HIS SALAMANCA.", "GO DOWN WITH GRANDMA'S LANTERN AND BRING THEM BACK."],
    ayuda: 'MOVE TO DODGE. STAND STILL TO SHOOT.', ayudaPC: 'WASD OR ARROWS · SPACE: COPLA · ESC: PAUSE',
    pisos: ['THE MOUTH', 'BLACK WATERS', 'THE EMBERS', 'THE HALL'], piso: 'FLOOR {0}',
    nivel: 'LEVEL UP!', elegir: 'CHOOSE', tocaCarta: 'PICK A CARD', yapa: 'HEAD START',
    fogon: 'THE CAMPFIRE', fogonTxt: 'THE POMBERO OFFERS YOU A DEAL.', descansar: 'REST', descansarD: '+40% HEALTH',
    trato: 'DEAL', tratoD: 'EPIC CARD FOR 15% MAX HEALTH',
    pausa: 'PAUSE', seguir: 'RESUME', salir: 'QUIT TO MENU', musica: 'MUSIC', sonido: 'SOUND', si: 'ON', no: 'OFF', tusCartas: 'YOUR CARDS',
    muerte: 'THE SALAMANCA GOT YOU', llegaste: 'YOU REACHED {0}', nuevoRecord: 'NEW RECORD!', otraVez: 'AGAIN', menu: 'MENU',
    victoria: 'YOU FREED THE SOULS!', victoriaTxt: 'THE DEVIL FLED DEEPER...', seguirBajando: 'KEEP GOING DOWN',
    enemigos: 'ENEMIES', nv: 'LV', revivir: 'SECOND LIFE!', copla: 'COPLA', limpio: 'CLEAR!',
    palanca: 'STICK', flotante: 'FLOATING', fija: 'FIXED', tamPal: 'STICK SIZE', tamBtn: 'BUTTON SIZE', opac: 'OPACITY',
    zurdo: 'LEFT-HANDED', vibrar: 'VIBRATE', arrastra: 'DRAG THE STICK AND THE BUTTON', restablecer: 'RESET', listo: 'DONE',
    comprar: 'BUY', max: 'MAX', mejorar: 'UPGRADES FOREVER', ganadas: '+{0} SOULS', nivelAlcanzado: 'LEVEL {0}', muertos: '{0} ENEMIES',
    jefes: ['TOAD KING', 'THE WIDOW', 'WEREWOLF', 'MANDINGA'], tocar: 'TAP TO CONTINUE', nuevo: 'NEW',
  },
  pt: {
    idioma: 'ESCOLHA SEU IDIOMA', presenta: 'apresenta', subtitulo: 'A CAVERNA DO MANDINGA',
    jugar: 'JOGAR', diario: 'DESAFIO DO DIA', altar: 'ALTAR', controles: 'CONTROLES', idiomaBtn: 'IDIOMA',
    record: 'RECORDE {0}', hoyRec: 'HOJE {0}', almas: 'ALMAS',
    historia: ['O MANDINGA LEVOU AS ALMAS DO POVOADO PARA A SUA SALAMANCA.', 'DESÇA COM A LANTERNA DA VOVÓ E TRAGA TODAS DE VOLTA.'],
    ayuda: 'MOVA-SE PARA DESVIAR. FIQUE PARADO PARA ATIRAR.', ayudaPC: 'WASD OU SETAS · ESPAÇO: COPLA · ESC: PAUSA',
    pisos: ['A BOCA', 'ÁGUAS NEGRAS', 'AS BRASAS', 'O SALÃO'], piso: 'ANDAR {0}',
    nivel: 'SUBIU DE NÍVEL!', elegir: 'ESCOLHER', tocaCarta: 'TOQUE UMA CARTA', yapa: 'BÔNUS',
    fogon: 'A FOGUEIRA', fogonTxt: 'O POMBERO TE OFERECE UM TRATO.', descansar: 'DESCANSAR', descansarD: '+40% DE VIDA',
    trato: 'TRATO', tratoD: 'CARTA ÉPICA POR 15% DA VIDA MÁXIMA',
    pausa: 'PAUSA', seguir: 'CONTINUAR', salir: 'SAIR PARA O MENU', musica: 'MÚSICA', sonido: 'SOM', si: 'SIM', no: 'NÃO', tusCartas: 'SUAS CARTAS',
    muerte: 'A SALAMANCA TE PEGOU', llegaste: 'VOCÊ CHEGOU AO {0}', nuevoRecord: 'NOVO RECORDE!', otraVez: 'DE NOVO', menu: 'MENU',
    victoria: 'VOCÊ LIBERTOU AS ALMAS!', victoriaTxt: 'O MANDINGA FUGIU MAIS FUNDO...', seguirBajando: 'CONTINUAR DESCENDO',
    enemigos: 'INIMIGOS', nv: 'NV', revivir: 'OUTRA VIDA!', copla: 'COPLA', limpio: 'LIMPO!',
    palanca: 'ALAVANCA', flotante: 'FLUTUANTE', fija: 'FIXA', tamPal: 'TAMANHO ALAVANCA', tamBtn: 'TAMANHO BOTÃO', opac: 'TRANSPARÊNCIA',
    zurdo: 'CANHOTO', vibrar: 'VIBRAR', arrastra: 'ARRASTE A ALAVANCA E O BOTÃO', restablecer: 'REDEFINIR', listo: 'PRONTO',
    comprar: 'COMPRAR', max: 'MÁX', mejorar: 'MELHORIAS PARA SEMPRE', ganadas: '+{0} ALMAS', nivelAlcanzado: 'NÍVEL {0}', muertos: '{0} INIMIGOS',
    jefes: ['SAPO REI', 'A VIÚVA', 'LOBISOMEM', 'MANDINGA'], tocar: 'TOQUE PARA CONTINUAR', nuevo: 'NOVO',
  },
};
function tr(k, ...a) {
  let s = (TXT[IDIOMA] && TXT[IDIOMA][k]) ?? TXT.es[k] ?? k;
  if (typeof s === 'string') a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
/* "2-5": piso y sala, como lo cuenta el récord */
const salaTexto = (v) => v <= 0 ? '-' : Math.floor((v - 1) / 8) + 1 + '-' + (((v - 1) % 8) + 1);
