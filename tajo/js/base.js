/* ============================================================================
   TAJO — lo de base. Lienzo liso a la resolución real, unidades lógicas de
   360 de ancho (S = píxeles reales por unidad), guardado y textos.
   ========================================================================== */

const W = 360;
let H = 640, S = 1;
const GRAV = 900;

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
  leer(k, def) { try { const v = localStorage.getItem('tajo.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  escribir(k, v) { try { localStorage.setItem('tajo.' + k, JSON.stringify(v)); } catch (e) { /* sin guardado */ } },
};
const DATOS = Object.assign({ rec: { clasico: 0, zen: 0, tormenta: 0 }, diaFecha: 0, diaRecord: 0, cortadas: 0, combosMax: 0, filo: 0, partidas: 0, ayuda: false }, Guardado.leer('datos', {}));
DATOS.rec = Object.assign({ clasico: 0, zen: 0, tormenta: 0 }, DATOS.rec);
const guardarDatos = () => Guardado.escribir('datos', DATOS);

let IDIOMA = Guardado.leer('idioma', null) || ((navigator.language || 'es').toLowerCase().startsWith('pt') ? 'pt' : (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'es');
const TXT = {
  es: {
    idioma: 'ELEGÍ TU IDIOMA', presenta: 'presenta', subtitulo: 'EL CAMINO DEL FILO',
    clasico: 'CLÁSICO', clasicoD: 'TRES VIDAS · OJO CON LAS BOMBAS', zen: 'ZEN', zenD: '90 SEGUNDOS SIN BOMBAS', tormenta: 'TORMENTA', tormentaD: '60 SEGUNDOS CON PODERES',
    diario: 'DESAFÍO DEL DÍA', dojo: 'DOJO', controles: 'CONTROLES', idiomaBtn: 'IDIOMA', record: 'RÉCORD', hoyRec: 'HOY {0}',
    combo: 'COMBO', fin: 'FIN DEL CAMINO', bomba: '¡BOMBA!', tiempo: '¡TIEMPO!', otra: 'OTRA', menu: 'MENÚ', pausa: 'PAUSA', seguir: 'SEGUIR',
    reiniciar: 'REINICIAR', musica: 'MÚSICA', sonido: 'SONIDO', si: 'SÍ', no: 'NO', nuevoRecord: '¡NUEVO RÉCORD!', volver: 'VOLVER',
    ayuda: 'DESLIZÁ EL DEDO PARA CORTAR LA FRUTA. NO TOQUES LAS BOMBAS.', cortadas: 'CORTADAS', mejorCombo: 'MEJOR COMBO',
    hielo: 'HIELO', frenesi: 'FRENESÍ', doble: 'DOBLE', filos: 'FILOS', usar: 'USAR', enUso: 'EN USO', faltan: 'CORTÁ {0} MÁS',
    grosor: 'GROSOR DEL TRAZO', sensib: 'SENSIBILIDAD', alcance: 'ALCANCE DEL CORTE', zurdo: 'ZURDO', vibrar: 'VIBRAR', proba: 'PROBÁ ACÁ',
    restablecer: 'RESTABLECER', listo: 'LISTO', baja: 'BAJA', media: 'MEDIA', alta: 'ALTA', tocar: 'TOCÁ PARA SEGUIR',
    nombresFilo: ['PINCEL', 'BERMELLÓN', 'JADE', 'AÑIL', 'HOJA DE ORO'],
  },
  en: {
    idioma: 'CHOOSE YOUR LANGUAGE', presenta: 'presents', subtitulo: 'THE WAY OF THE BLADE',
    clasico: 'CLASSIC', clasicoD: 'THREE LIVES · MIND THE BOMBS', zen: 'ZEN', zenD: '90 SECONDS, NO BOMBS', tormenta: 'STORM', tormentaD: '60 SECONDS WITH POWERS',
    diario: 'DAILY CHALLENGE', dojo: 'DOJO', controles: 'CONTROLS', idiomaBtn: 'LANGUAGE', record: 'BEST', hoyRec: 'TODAY {0}',
    combo: 'COMBO', fin: 'END OF THE PATH', bomba: 'BOMB!', tiempo: "TIME'S UP!", otra: 'AGAIN', menu: 'MENU', pausa: 'PAUSE', seguir: 'RESUME',
    reiniciar: 'RESTART', musica: 'MUSIC', sonido: 'SOUND', si: 'ON', no: 'OFF', nuevoRecord: 'NEW RECORD!', volver: 'BACK',
    ayuda: 'SWIPE TO SLICE THE FRUIT. DO NOT TOUCH THE BOMBS.', cortadas: 'SLICED', mejorCombo: 'BEST COMBO',
    hielo: 'FREEZE', frenesi: 'FRENZY', doble: 'DOUBLE', filos: 'BLADES', usar: 'USE', enUso: 'IN USE', faltan: 'SLICE {0} MORE',
    grosor: 'TRAIL WIDTH', sensib: 'SENSITIVITY', alcance: 'CUT REACH', zurdo: 'LEFT-HANDED', vibrar: 'VIBRATE', proba: 'TRY IT HERE',
    restablecer: 'RESET', listo: 'DONE', baja: 'LOW', media: 'MID', alta: 'HIGH', tocar: 'TAP TO CONTINUE',
    nombresFilo: ['BRUSH', 'VERMILION', 'JADE', 'INDIGO', 'GOLD LEAF'],
  },
  pt: {
    idioma: 'ESCOLHA SEU IDIOMA', presenta: 'apresenta', subtitulo: 'O CAMINHO DA LÂMINA',
    clasico: 'CLÁSSICO', clasicoD: 'TRÊS VIDAS · CUIDADO COM AS BOMBAS', zen: 'ZEN', zenD: '90 SEGUNDOS SEM BOMBAS', tormenta: 'TEMPESTADE', tormentaD: '60 SEGUNDOS COM PODERES',
    diario: 'DESAFIO DO DIA', dojo: 'DOJO', controles: 'CONTROLES', idiomaBtn: 'IDIOMA', record: 'RECORDE', hoyRec: 'HOJE {0}',
    combo: 'COMBO', fin: 'FIM DO CAMINHO', bomba: 'BOMBA!', tiempo: 'ACABOU O TEMPO!', otra: 'DE NOVO', menu: 'MENU', pausa: 'PAUSA', seguir: 'CONTINUAR',
    reiniciar: 'REINICIAR', musica: 'MÚSICA', sonido: 'SOM', si: 'SIM', no: 'NÃO', nuevoRecord: 'NOVO RECORDE!', volver: 'VOLTAR',
    ayuda: 'DESLIZE O DEDO PARA CORTAR A FRUTA. NÃO TOQUE NAS BOMBAS.', cortadas: 'CORTADAS', mejorCombo: 'MELHOR COMBO',
    hielo: 'GELO', frenesi: 'FRENESI', doble: 'DOBRO', filos: 'LÂMINAS', usar: 'USAR', enUso: 'EM USO', faltan: 'CORTE MAIS {0}',
    grosor: 'ESPESSURA DO TRAÇO', sensib: 'SENSIBILIDADE', alcance: 'ALCANCE DO CORTE', zurdo: 'CANHOTO', vibrar: 'VIBRAR', proba: 'TESTE AQUI',
    restablecer: 'REDEFINIR', listo: 'PRONTO', baja: 'BAIXA', media: 'MÉDIA', alta: 'ALTA', tocar: 'TOQUE PARA CONTINUAR',
    nombresFilo: ['PINCEL', 'VERMELHÃO', 'JADE', 'ANIL', 'FOLHA DE OURO'],
  },
};
function tr(k, ...a) {
  let s = (TXT[IDIOMA] && TXT[IDIOMA][k]) ?? TXT.es[k] ?? k;
  if (typeof s === 'string') a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
function lienzoHD(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.max(1, Math.ceil(h * S)); const g = c.getContext('2d'); g.scale(S, S); return [c, g]; }

/* letra: una serif gruesa, "entintada" (se pasa dos veces corrida apenas, como pincel) */
const SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif';
function texto(g, str, x, y, o) {
  o = o || {};
  const tam = o.tam || 14;
  g.font = (o.peso || 'bold') + ' ' + (o.cursiva ? 'italic ' : '') + tam + 'px ' + (o.fuente || SERIF);
  g.textAlign = o.alin || 'center'; g.textBaseline = 'middle';
  if (o.borde) { g.lineWidth = o.bordeAncho || 4; g.strokeStyle = o.borde; g.lineJoin = 'round'; g.strokeText(str, x, y); }
  g.fillStyle = o.col || '#151210';
  if (o.tinta) { g.globalAlpha *= 0.5; g.fillText(str, x + 0.7, y + 0.5); g.globalAlpha /= 0.5; }
  g.fillText(str, x, y);
}
