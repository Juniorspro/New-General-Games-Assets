/* ============================================================================
   TAJO — lo de base. Lienzo liso a la resolución real del celu, unidades
   lógicas de 360 de ancho (S = píxeles reales por unidad), guardado y textos.
   ========================================================================== */

const W = 360;
let H = 640, S = 1;

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
const DATOS = Object.assign({ rec: {}, diaFecha: 0, diaRecord: 0, cortadas: 0, comboMax: 0, filo: 0, partidas: 0, ayuda: false }, Guardado.leer('datos', {}));
DATOS.rec = Object.assign({ clasico: 0, zen: 0, tormenta: 0 }, DATOS.rec);
const guardarDatos = () => Guardado.escribir('datos', DATOS);

// el del celular al arrancar; después, el que se elija en el menú (motor2d/idiomas.js)
let IDIOMA = idiomaInicial(Guardado.leer('idioma', null));
const TXT = {
  es: {
    idioma: 'ELEGÍ TU IDIOMA', presenta: 'presenta', subtitulo: 'EL CAMINO DEL FILO', elegir: 'CORTÁ UNA FRUTA PARA EMPEZAR',
    clasico: 'CLÁSICO', clasicoD: 'TRES FALLAS · OJO CON LAS BOMBAS', zen: 'ZEN', zenD: '90 SEGUNDOS SIN BOMBAS', tormenta: 'TORMENTA', tormentaD: '60 SEGUNDOS CON PODERES',
    diario: 'DEL DÍA', diarioD: 'LAS MISMAS FRUTAS PARA TODOS', dojo: 'DOJO', controles: 'CONTROLES', idiomaBtn: 'IDIOMA', record: 'RÉCORD', hoyRec: 'HOY {0}',
    combo: 'COMBO ×{0}', fin: 'FIN DEL CAMINO', bomba: '¡BOMBA!', tiempo: '¡TIEMPO!', otra: 'OTRA', menu: 'MENÚ', pausa: 'PAUSA', seguir: 'SEGUIR',
    reiniciar: 'REINICIAR', musica: 'MÚSICA', sonido: 'SONIDO', si: 'SÍ', no: 'NO', nuevoRecord: '¡NUEVO RÉCORD!', volver: 'VOLVER',
    ayuda: 'DESLIZÁ EL DEDO PARA CORTAR LA FRUTA. NO TOQUES LAS BOMBAS.', ayudaFalla: 'SI UNA FRUTA SE CAE SIN CORTAR, ES UNA FALLA.', cortadas: 'CORTADAS', mejorCombo: 'MEJOR COMBO',
    hielo: 'HIELO', frenesi: 'FRENESÍ', doble: 'DOBLE', filos: 'FILOS', usar: 'USAR', enUso: 'EN USO', faltan: 'CORTÁ {0} MÁS', nuevoFilo: '¡NUEVO FILO: {0}!',
    grosor: 'GROSOR DEL TRAZO', sensib: 'SENSIBILIDAD', alcance: 'ALCANCE DEL CORTE', tamPausa: 'BOTÓN DE PAUSA', zurdo: 'ZURDO', vibrar: 'VIBRAR', proba: 'PROBÁ ACÁ',
    restablecer: 'RESTABLECER', listo: 'LISTO', baja: 'BAJA', media: 'MEDIA', alta: 'ALTA', fino: 'FINO', medio: 'MEDIO', grueso: 'GRUESO', chico: 'CHICO', grande: 'GRANDE',
    tocar: 'TOCÁ PARA SEGUIR', menos10: '−10', puntos: 'PUNTOS', todas: 'TODOS LOS FILOS',
    nombresFilo: ['PINCEL', 'BERMELLÓN', 'JADE', 'AÑIL', 'HOJA DE ORO'],
  },
  en: {
    idioma: 'CHOOSE YOUR LANGUAGE', presenta: 'presents', subtitulo: 'THE WAY OF THE BLADE', elegir: 'SLICE A FRUIT TO START',
    clasico: 'CLASSIC', clasicoD: 'THREE MISSES · MIND THE BOMBS', zen: 'ZEN', zenD: '90 SECONDS, NO BOMBS', tormenta: 'STORM', tormentaD: '60 SECONDS WITH POWERS',
    diario: 'DAILY', diarioD: 'THE SAME FRUIT FOR EVERYONE', dojo: 'DOJO', controles: 'CONTROLS', idiomaBtn: 'LANGUAGE', record: 'BEST', hoyRec: 'TODAY {0}',
    combo: 'COMBO ×{0}', fin: 'END OF THE PATH', bomba: 'BOMB!', tiempo: "TIME'S UP!", otra: 'AGAIN', menu: 'MENU', pausa: 'PAUSE', seguir: 'RESUME',
    reiniciar: 'RESTART', musica: 'MUSIC', sonido: 'SOUND', si: 'ON', no: 'OFF', nuevoRecord: 'NEW RECORD!', volver: 'BACK',
    ayuda: 'SWIPE TO SLICE THE FRUIT. DO NOT TOUCH THE BOMBS.', ayudaFalla: 'IF A FRUIT FALLS UNSLICED, IT IS A MISS.', cortadas: 'SLICED', mejorCombo: 'BEST COMBO',
    hielo: 'FREEZE', frenesi: 'FRENZY', doble: 'DOUBLE', filos: 'BLADES', usar: 'USE', enUso: 'IN USE', faltan: 'SLICE {0} MORE', nuevoFilo: 'NEW BLADE: {0}!',
    grosor: 'TRAIL WIDTH', sensib: 'SENSITIVITY', alcance: 'CUT REACH', tamPausa: 'PAUSE BUTTON', zurdo: 'LEFT-HANDED', vibrar: 'VIBRATE', proba: 'TRY IT HERE',
    restablecer: 'RESET', listo: 'DONE', baja: 'LOW', media: 'MID', alta: 'HIGH', fino: 'THIN', medio: 'MID', grueso: 'THICK', chico: 'SMALL', grande: 'BIG',
    tocar: 'TAP TO CONTINUE', menos10: '−10', puntos: 'POINTS', todas: 'ALL BLADES',
    nombresFilo: ['BRUSH', 'VERMILION', 'JADE', 'INDIGO', 'GOLD LEAF'],
  },
  pt: {
    idioma: 'ESCOLHA SEU IDIOMA', presenta: 'apresenta', subtitulo: 'O CAMINHO DA LÂMINA', elegir: 'CORTE UMA FRUTA PARA COMEÇAR',
    clasico: 'CLÁSSICO', clasicoD: 'TRÊS ERROS · CUIDADO COM AS BOMBAS', zen: 'ZEN', zenD: '90 SEGUNDOS SEM BOMBAS', tormenta: 'TEMPESTADE', tormentaD: '60 SEGUNDOS COM PODERES',
    diario: 'DO DIA', diarioD: 'AS MESMAS FRUTAS PARA TODOS', dojo: 'DOJO', controles: 'CONTROLES', idiomaBtn: 'IDIOMA', record: 'RECORDE', hoyRec: 'HOJE {0}',
    combo: 'COMBO ×{0}', fin: 'FIM DO CAMINHO', bomba: 'BOMBA!', tiempo: 'ACABOU O TEMPO!', otra: 'DE NOVO', menu: 'MENU', pausa: 'PAUSA', seguir: 'CONTINUAR',
    reiniciar: 'REINICIAR', musica: 'MÚSICA', sonido: 'SOM', si: 'SIM', no: 'NÃO', nuevoRecord: 'NOVO RECORDE!', volver: 'VOLTAR',
    ayuda: 'DESLIZE O DEDO PARA CORTAR A FRUTA. NÃO TOQUE NAS BOMBAS.', ayudaFalla: 'SE UMA FRUTA CAIR SEM CORTAR, É UM ERRO.', cortadas: 'CORTADAS', mejorCombo: 'MELHOR COMBO',
    hielo: 'GELO', frenesi: 'FRENESI', doble: 'DOBRO', filos: 'LÂMINAS', usar: 'USAR', enUso: 'EM USO', faltan: 'CORTE MAIS {0}', nuevoFilo: 'NOVA LÂMINA: {0}!',
    grosor: 'ESPESSURA DO TRAÇO', sensib: 'SENSIBILIDADE', alcance: 'ALCANCE DO CORTE', tamPausa: 'BOTÃO DE PAUSA', zurdo: 'CANHOTO', vibrar: 'VIBRAR', proba: 'TESTE AQUI',
    restablecer: 'REDEFINIR', listo: 'PRONTO', baja: 'BAIXA', media: 'MÉDIA', alta: 'ALTA', fino: 'FINO', medio: 'MÉDIO', grueso: 'GROSSO', chico: 'PEQUENO', grande: 'GRANDE',
    tocar: 'TOQUE PARA CONTINUAR', menos10: '−10', puntos: 'PONTOS', todas: 'TODAS AS LÂMINAS',
    nombresFilo: ['PINCEL', 'VERMELHÃO', 'JADE', 'ANIL', 'FOLHA DE OURO'],
  },
};
function tr(k, ...a) {
  let s = (TXT[IDIOMA] && TXT[IDIOMA][k]) ?? TXT.en[k] ?? TXT.es[k] ?? k;
  if (typeof s === 'string') a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
// un lienzo en caché pintado a la resolución real: se dibuja en unidades lógicas
// y se estampa con su tamaño lógico (al cambiar S hay que rehacerlo)
function lienzoHD(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.max(1, Math.ceil(h * S)); const g = c.getContext('2d'); g.scale(S, S); return [c, g]; }

/* la letra: una serif gruesa "entintada" (una pasada corrida y más clara, como el
   pincel que se corre en el papel) */
const SERIF = 'Georgia, "Times New Roman", "Noto Serif", serif';
const TINTA = '#16110d', PAPEL = '#efe5cf', BERMELLON = '#c8321e';
/* el árabe y el urdu van de derecha a izquierda; cada escritura usa su letra del sistema (con serifa) */
function fuenteTexto(str, tam, peso, cursiva) {
  const esc = escrituraDe(str);
  return { css: (peso || 'bold') + ' ' + (cursiva && esc === 'latn' ? 'italic ' : '') + tam * escalaEscritura(esc) + 'px ' + (fuenteEscritura(esc, 'serif') || SERIF), rtl: esc === 'arab' };
}
function texto(g, str, x, y, o) {
  o = o || {}; str = String(str);
  const tam = o.tam || 14, f = fuenteTexto(str, tam, o.peso, o.cursiva);
  g.font = f.css; g.direction = f.rtl ? 'rtl' : 'ltr';
  g.textAlign = o.alin || 'center'; g.textBaseline = 'middle';
  if (o.borde) { g.lineWidth = o.bordeAncho || 4; g.strokeStyle = o.borde; g.lineJoin = 'round'; g.strokeText(str, x, y); }
  g.fillStyle = o.col || TINTA;
  if (o.tinta !== false) { const a = g.globalAlpha; g.globalAlpha = a * 0.28; g.fillText(str, x + tam * 0.05, y + tam * 0.04); g.globalAlpha = a; }
  g.fillText(str, x, y);
  g.direction = 'ltr';
}
function medir(g, str, tam, peso) { str = String(str); const f = fuenteTexto(str, tam, peso); g.font = f.css; g.direction = f.rtl ? 'rtl' : 'ltr'; const w = g.measureText(str).width; g.direction = 'ltr'; return w; }
// achica la letra hasta que el renglón entre en el ancho
function tamQueEntra(g, str, tam, ancho, peso) { while (tam > 8 && medir(g, str, tam, peso) > ancho) tam -= 1; return tam; }
