/* ============================================================================
   NEBULOSA — lo de base. Este no es de píxeles: el lienzo va a la resolución
   real del celu y se dibuja en unidades lógicas de 360 de ancho (S = cuántos
   píxeles reales por unidad), así el neón se ve liso y con brillo.
   ========================================================================== */

const W = 360;
let H = 640, S = 1;
let JT = 120, JF = 520;                  // arriba y piso del frasco
const JL = 26, JR = 334;                 // paredes del frasco (adentro)
let LINEA = 166;                         // la línea de peligro

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
const salida = (t) => 1 - Math.pow(1 - t, 3);
const rebote = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const hoy = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

const Guardado = {
  leer(k, def) { try { const v = localStorage.getItem('nebulosa.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  escribir(k, v) { try { localStorage.setItem('nebulosa.' + k, JSON.stringify(v)); } catch (e) { /* sin guardado */ } },
  borrar(k) { try { localStorage.removeItem('nebulosa.' + k); } catch (e) { /* */ } },
};
const DATOS = Object.assign({ record: 0, recordRayo: 0, diaFecha: 0, diaRecord: 0, visto: 0, partidas: 0, ayuda: false, supernovas: 0 }, Guardado.leer('datos', {}));
const guardarDatos = () => Guardado.escribir('datos', DATOS);

let IDIOMA = Guardado.leer('idioma', null) || ((navigator.language || 'es').toLowerCase().startsWith('pt') ? 'pt' : (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'es');
const TXT = {
  es: {
    idioma: 'ELEGÍ TU IDIOMA', presenta: 'presenta', subtitulo: 'FUSIONÁ EL UNIVERSO',
    clasico: 'CLÁSICO', relampago: 'RELÁMPAGO', relampagoD: '2 MINUTOS A TODO', diario: 'DESAFÍO DEL DÍA', catalogo: 'CATÁLOGO',
    controles: 'CONTROLES', idiomaBtn: 'IDIOMA', record: 'RÉCORD', hoyRec: 'HOY {0}', seguirPartida: 'SEGUIR LA PARTIDA',
    siguiente: 'SIGUE', peligro: '¡PELIGRO!', fin: 'SE LLENÓ EL FRASCO', tiempo: '¡TIEMPO!', otra: 'OTRA', menu: 'MENÚ',
    pausa: 'PAUSA', seguir: 'SEGUIR', reiniciar: 'REINICIAR', musica: 'MÚSICA', sonido: 'SONIDO', si: 'SÍ', no: 'NO',
    sacudon: 'SACUDÓN', rayo: 'RAYO', rayoAyuda: 'TOCÁ UN CUERPO PARA BORRARLO', nuevoRecord: '¡NUEVO RÉCORD!', descubriste: '¡DESCUBRISTE {0}!',
    supernova: '¡SUPERNOVA!', combo: 'CADENA', ayuda: 'MOVÉ EL DEDO PARA APUNTAR Y SOLTALO PARA TIRAR. DOS IGUALES SE FUSIONAN.',
    apuntar: 'APUNTAR', dedo: 'AL DEDO', arrastre: 'ARRASTRE', sensib: 'SENSIBILIDAD', soltar: 'SOLTAR', alLevantar: 'AL LEVANTAR', conBoton: 'CON BOTÓN',
    guia: 'LÍNEA GUÍA', zurdo: 'ZURDO', vibrar: 'VIBRAR', tamBotones: 'TAMAÑO BOTONES', proba: 'PROBÁ ACÁ', restablecer: 'RESTABLECER', listo: 'LISTO', volver: 'VOLVER',
    tirar: 'TIRAR', puntos: 'PUNTOS', descubiertos: '{0} DE 11',
    nombres: ['POLVO ESTELAR', 'COMETA', 'LUNA', 'MARTE', 'TIERRA', 'SATURNO', 'JÚPITER', 'ENANA ROJA', 'SOL', 'GIGANTE AZUL', 'AGUJERO NEGRO'],
  },
  en: {
    idioma: 'CHOOSE YOUR LANGUAGE', presenta: 'presents', subtitulo: 'MERGE THE UNIVERSE',
    clasico: 'CLASSIC', relampago: 'BLITZ', relampagoD: '2 MINUTES FLAT OUT', diario: 'DAILY CHALLENGE', catalogo: 'CATALOG',
    controles: 'CONTROLS', idiomaBtn: 'LANGUAGE', record: 'BEST', hoyRec: 'TODAY {0}', seguirPartida: 'CONTINUE GAME',
    siguiente: 'NEXT', peligro: 'DANGER!', fin: 'THE JAR IS FULL', tiempo: "TIME'S UP!", otra: 'AGAIN', menu: 'MENU',
    pausa: 'PAUSE', seguir: 'RESUME', reiniciar: 'RESTART', musica: 'MUSIC', sonido: 'SOUND', si: 'ON', no: 'OFF',
    sacudon: 'SHAKE', rayo: 'ZAP', rayoAyuda: 'TAP A BODY TO ERASE IT', nuevoRecord: 'NEW RECORD!', descubriste: 'YOU FOUND {0}!',
    supernova: 'SUPERNOVA!', combo: 'CHAIN', ayuda: 'MOVE YOUR FINGER TO AIM AND LIFT IT TO DROP. TWO ALIKE MERGE.',
    apuntar: 'AIM', dedo: 'FOLLOW FINGER', arrastre: 'DRAG', sensib: 'SENSITIVITY', soltar: 'DROP', alLevantar: 'ON RELEASE', conBoton: 'WITH BUTTON',
    guia: 'GUIDE LINE', zurdo: 'LEFT-HANDED', vibrar: 'VIBRATE', tamBotones: 'BUTTON SIZE', proba: 'TRY IT HERE', restablecer: 'RESET', listo: 'DONE', volver: 'BACK',
    tirar: 'DROP', puntos: 'POINTS', descubiertos: '{0} OF 11',
    nombres: ['STARDUST', 'COMET', 'MOON', 'MARS', 'EARTH', 'SATURN', 'JUPITER', 'RED DWARF', 'SUN', 'BLUE GIANT', 'BLACK HOLE'],
  },
  pt: {
    idioma: 'ESCOLHA SEU IDIOMA', presenta: 'apresenta', subtitulo: 'FUNDA O UNIVERSO',
    clasico: 'CLÁSSICO', relampago: 'RELÂMPAGO', relampagoD: '2 MINUTOS A MIL', diario: 'DESAFIO DO DIA', catalogo: 'CATÁLOGO',
    controles: 'CONTROLES', idiomaBtn: 'IDIOMA', record: 'RECORDE', hoyRec: 'HOJE {0}', seguirPartida: 'CONTINUAR PARTIDA',
    siguiente: 'PRÓXIMO', peligro: 'PERIGO!', fin: 'O POTE ENCHEU', tiempo: 'ACABOU O TEMPO!', otra: 'DE NOVO', menu: 'MENU',
    pausa: 'PAUSA', seguir: 'CONTINUAR', reiniciar: 'REINICIAR', musica: 'MÚSICA', sonido: 'SOM', si: 'SIM', no: 'NÃO',
    sacudon: 'CHACOALHÃO', rayo: 'RAIO', rayoAyuda: 'TOQUE UM CORPO PARA APAGÁ-LO', nuevoRecord: 'NOVO RECORDE!', descubriste: 'VOCÊ DESCOBRIU {0}!',
    supernova: 'SUPERNOVA!', combo: 'CADEIA', ayuda: 'MOVA O DEDO PARA MIRAR E SOLTE PARA JOGAR. DOIS IGUAIS SE FUNDEM.',
    apuntar: 'MIRAR', dedo: 'NO DEDO', arrastre: 'ARRASTAR', sensib: 'SENSIBILIDADE', soltar: 'SOLTAR', alLevantar: 'AO LEVANTAR', conBoton: 'COM BOTÃO',
    guia: 'LINHA GUIA', zurdo: 'CANHOTO', vibrar: 'VIBRAR', tamBotones: 'TAMANHO BOTÕES', proba: 'TESTE AQUI', restablecer: 'REDEFINIR', listo: 'PRONTO', volver: 'VOLTAR',
    tirar: 'SOLTAR', puntos: 'PONTOS', descubiertos: '{0} DE 11',
    nombres: ['POEIRA ESTELAR', 'COMETA', 'LUA', 'MARTE', 'TERRA', 'SATURNO', 'JÚPITER', 'ANÃ VERMELHA', 'SOL', 'GIGANTE AZUL', 'BURACO NEGRO'],
  },
};
function tr(k, ...a) {
  let s = (TXT[IDIOMA] && TXT[IDIOMA][k]) ?? TXT.es[k] ?? k;
  if (typeof s === 'string') a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}

/* texto con letra de sistema gruesa y en cursiva (el synthwave), con brillo de neón */
const FUENTE = '"Arial Black", "Segoe UI Black", "Helvetica Neue", Roboto, Arial, sans-serif';
function texto(g, str, x, y, o) {
  o = o || {};
  const tam = o.tam || 14;
  g.font = (o.peso || '900') + ' ' + (o.cursiva === false ? '' : 'italic ') + tam + 'px ' + FUENTE;
  g.textAlign = o.alin || 'center'; g.textBaseline = 'middle';
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = (o.blur || 10); }
  if (o.borde) { g.lineWidth = o.bordeAncho || 3; g.strokeStyle = o.borde; g.lineJoin = 'round'; g.strokeText(str, x, y); }
  g.fillStyle = o.col || '#fff';
  g.fillText(str, x, y);
  g.shadowBlur = 0; g.shadowColor = 'transparent';
}
function medir(g, str, tam, peso) { g.font = (peso || '900') + ' italic ' + tam + 'px ' + FUENTE; return g.measureText(str).width; }
