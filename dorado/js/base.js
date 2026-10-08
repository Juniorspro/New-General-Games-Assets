/* ============================================================================
   DORADO — lo de base. Lienzo liso a la resolución real, unidades lógicas de
   360 de ancho. La mesa mide 360 × 600 y va abajo; lo que sobra arriba es la
   marquesina. Guardado, textos en tres idiomas y las dos letras: la déco
   (Limelight, en trazos) para lo grande y una sans espaciada para lo chico.
   ========================================================================== */

const W = 360, MESA_H = 600;
let H = 680, S = 1, Y0 = 80;        // Y0 = dónde empieza la mesa (alto de la marquesina)

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
const miles = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const Guardado = {
  leer(k, def) { try { const v = localStorage.getItem('dorado.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  escribir(k, v) { try { localStorage.setItem('dorado.' + k, JSON.stringify(v)); } catch (e) { /* sin guardado */ } },
};
const DATOS = Object.assign({ rec: {}, diaFecha: 0, diaRecord: 0, partidas: 0, rangoMax: 0, jackpotMax: 0, ayuda: false }, Guardado.leer('datos', {}));
DATOS.rec = Object.assign({ clasico: 0, reloj: 0 }, DATOS.rec);
const guardarDatos = () => Guardado.escribir('datos', DATOS);

// el del celular al arrancar; después, el que se elija en el menú (motor2d/idiomas.js)
let IDIOMA = idiomaInicial(Guardado.leer('idioma', null));
const TXT = {
  es: {
    idioma: 'ELEGÍ TU IDIOMA', presenta: 'presenta', subtitulo: 'PINBALL DEL GRAN HOTEL',
    clasico: 'CLÁSICO', clasicoD: 'TRES BOLAS · SUBÍ DE BOTONES A DUEÑO', reloj: 'A RELOJ', relojD: 'DOS MINUTOS Y MEDIO · BOLAS SIN FIN',
    diario: 'DESAFÍO DEL DÍA', diarioD: 'LAS MISIONES DE HOY, IGUALES PARA TODOS', controles: 'CONTROLES', idiomaBtn: 'IDIOMA',
    record: 'RÉCORD', hoyRec: 'HOY {0}', bola: 'BOLA {0}/{1}', pausa: 'PAUSA', seguir: 'SEGUIR', reiniciar: 'REINICIAR', menu: 'MENÚ',
    musica: 'MÚSICA', sonido: 'SONIDO', si: 'SÍ', no: 'NO', otra: 'OTRA', fin: 'FIN DEL JUEGO', tiempo: '¡TIEMPO!', nuevoRecord: '¡NUEVO RÉCORD!',
    volver: 'VOLVER', listo: 'LISTO', restablecer: 'RESTABLECER',
    tirar: 'TIRÁ DEL RESORTE', tocarLanzar: 'TOCÁ PARA LANZAR', teSalvo: '¡TE SALVÉ!', jackpot: '¡JACKPOT!', multibola: '¡MULTIBOLA!',
    multiLista: 'MULTIBOLA LISTA', bolaExtra: '¡BOLA EXTRA!', tiroMaestro: '¡TIRO MAESTRO!', mult: 'MULTIPLICADOR ×{0}', orbita: '¡ÓRBITA!',
    cumplida: '¡MISIÓN CUMPLIDA!', ascenso: 'AHORA SOS {0}', bonus: 'BONUS', total: 'TOTAL', perdida: 'BOLA PERDIDA',
    m_hongos: 'GOLPEÁ {0} HONGOS', m_blancos: 'BAJÁ {0} BLANCOS', m_carriles: 'COMPLETÁ J·A·Z·Z', m_copa: 'EMBOCÁ LA COPA {0} VECES',
    m_orbitas: 'HACÉ {0} ÓRBITAS', m_molinete: 'GIRÁ EL MOLINETE {0} VECES',
    rangos: ['BOTONES', 'MOZO', 'BARMAN', 'CONSERJE', 'GERENTE', 'DUEÑO'],
    hongos: 'HONGOS', carriles: 'CARRILES', blancos: 'BLANCOS', orbitas: 'ÓRBITAS', copas: 'COPAS', misiones: 'MISIONES', rango: 'RANGO', mejorJackpot: 'MEJOR JACKPOT',
    modo: 'FLIPPERS', mitades: 'MITADES', botones: 'BOTONES', tamano: 'TAMAÑO', chico: 'CHICO', medio: 'MEDIO', grande: 'GRANDE',
    transp: 'TRANSPARENCIA', baja: 'BAJA', media: 'MEDIA', alta: 'ALTA', resorte: 'RESORTE', tirarOp: 'TIRAR', tocarOp: 'TOCAR', vibrar: 'VIBRAR',
    acomodar: 'ACOMODAR BOTONES', arrastra: 'ARRASTRÁ CADA BOTÓN A DONDE TE QUEDE CÓMODO', proba: 'PROBÁ ACÁ',
    ayuda1: 'TOCÁ LA MITAD IZQUIERDA O LA DERECHA DE LA PANTALLA PARA MOVER CADA FLIPPER.', ayuda1b: 'TOCÁ LOS BOTONES DE ABAJO PARA MOVER CADA FLIPPER.',
    ayuda2: 'PARA LANZAR, TIRÁ DEL RESORTE HACIA ABAJO Y SOLTALO.', ayuda2b: 'PARA LANZAR, TOCÁ EL RESORTE.', ayuda3: 'CUMPLÍ LAS MISIONES PARA SUBIR DE RANGO EN EL HOTEL.', tocar: 'TOCÁ PARA SEGUIR',
  },
  en: {
    idioma: 'CHOOSE YOUR LANGUAGE', presenta: 'presents', subtitulo: 'THE GRAND HOTEL PINBALL',
    clasico: 'CLASSIC', clasicoD: 'THREE BALLS · RISE FROM BELLHOP TO OWNER', reloj: 'TIME ATTACK', relojD: 'TWO AND A HALF MINUTES · ENDLESS BALLS',
    diario: 'DAILY CHALLENGE', diarioD: "TODAY'S MISSIONS, THE SAME FOR EVERYONE", controles: 'CONTROLS', idiomaBtn: 'LANGUAGE',
    record: 'BEST', hoyRec: 'TODAY {0}', bola: 'BALL {0}/{1}', pausa: 'PAUSE', seguir: 'RESUME', reiniciar: 'RESTART', menu: 'MENU',
    musica: 'MUSIC', sonido: 'SOUND', si: 'ON', no: 'OFF', otra: 'AGAIN', fin: 'GAME OVER', tiempo: "TIME'S UP!", nuevoRecord: 'NEW RECORD!',
    volver: 'BACK', listo: 'DONE', restablecer: 'RESET',
    tirar: 'PULL THE PLUNGER', tocarLanzar: 'TAP TO LAUNCH', teSalvo: 'BALL SAVED!', jackpot: 'JACKPOT!', multibola: 'MULTIBALL!',
    multiLista: 'MULTIBALL READY', bolaExtra: 'EXTRA BALL!', tiroMaestro: 'SKILL SHOT!', mult: 'MULTIPLIER ×{0}', orbita: 'ORBIT!',
    cumplida: 'MISSION COMPLETE!', ascenso: 'NOW YOU ARE {0}', bonus: 'BONUS', total: 'TOTAL', perdida: 'BALL LOST',
    m_hongos: 'HIT {0} BUMPERS', m_blancos: 'DROP {0} TARGETS', m_carriles: 'COMPLETE J·A·Z·Z', m_copa: 'SINK THE CUP {0} TIMES',
    m_orbitas: 'MAKE {0} ORBITS', m_molinete: 'SPIN THE SPINNER {0} TIMES',
    rangos: ['BELLHOP', 'WAITER', 'BARTENDER', 'CONCIERGE', 'MANAGER', 'OWNER'],
    hongos: 'BUMPERS', carriles: 'LANES', blancos: 'TARGETS', orbitas: 'ORBITS', copas: 'CUPS', misiones: 'MISSIONS', rango: 'RANK', mejorJackpot: 'BEST JACKPOT',
    modo: 'FLIPPERS', mitades: 'HALVES', botones: 'BUTTONS', tamano: 'SIZE', chico: 'SMALL', medio: 'MID', grande: 'BIG',
    transp: 'OPACITY', baja: 'LOW', media: 'MID', alta: 'HIGH', resorte: 'PLUNGER', tirarOp: 'PULL', tocarOp: 'TAP', vibrar: 'VIBRATE',
    acomodar: 'MOVE BUTTONS', arrastra: 'DRAG EACH BUTTON WHERE IT FEELS COMFORTABLE', proba: 'TRY IT HERE',
    ayuda1: 'TAP THE LEFT OR RIGHT HALF OF THE SCREEN TO MOVE EACH FLIPPER.', ayuda1b: 'TAP THE BUTTONS BELOW TO MOVE EACH FLIPPER.',
    ayuda2: 'TO LAUNCH, PULL THE PLUNGER DOWN AND LET GO.', ayuda2b: 'TO LAUNCH, TAP THE PLUNGER.', ayuda3: 'COMPLETE MISSIONS TO RISE THROUGH THE HOTEL RANKS.', tocar: 'TAP TO CONTINUE',
  },
  pt: {
    idioma: 'ESCOLHA SEU IDIOMA', presenta: 'apresenta', subtitulo: 'O PINBALL DO GRANDE HOTEL',
    clasico: 'CLÁSSICO', clasicoD: 'TRÊS BOLAS · DE MENSAGEIRO A DONO', reloj: 'CONTRA O RELÓGIO', relojD: 'DOIS MINUTOS E MEIO · BOLAS SEM FIM',
    diario: 'DESAFIO DO DIA', diarioD: 'AS MISSÕES DE HOJE, IGUAIS PARA TODOS', controles: 'CONTROLES', idiomaBtn: 'IDIOMA',
    record: 'RECORDE', hoyRec: 'HOJE {0}', bola: 'BOLA {0}/{1}', pausa: 'PAUSA', seguir: 'CONTINUAR', reiniciar: 'REINICIAR', menu: 'MENU',
    musica: 'MÚSICA', sonido: 'SOM', si: 'SIM', no: 'NÃO', otra: 'DE NOVO', fin: 'FIM DE JOGO', tiempo: 'ACABOU O TEMPO!', nuevoRecord: 'NOVO RECORDE!',
    volver: 'VOLTAR', listo: 'PRONTO', restablecer: 'REDEFINIR',
    tirar: 'PUXE A MOLA', tocarLanzar: 'TOQUE PARA LANÇAR', teSalvo: 'BOLA SALVA!', jackpot: 'JACKPOT!', multibola: 'MULTIBOLA!',
    multiLista: 'MULTIBOLA PRONTA', bolaExtra: 'BOLA EXTRA!', tiroMaestro: 'TIRO DE MESTRE!', mult: 'MULTIPLICADOR ×{0}', orbita: 'ÓRBITA!',
    cumplida: 'MISSÃO CUMPRIDA!', ascenso: 'AGORA VOCÊ É {0}', bonus: 'BÔNUS', total: 'TOTAL', perdida: 'BOLA PERDIDA',
    m_hongos: 'ACERTE {0} BUMPERS', m_blancos: 'DERRUBE {0} ALVOS', m_carriles: 'COMPLETE J·A·Z·Z', m_copa: 'ACERTE A TAÇA {0} VEZES',
    m_orbitas: 'FAÇA {0} ÓRBITAS', m_molinete: 'GIRE O MOLINETE {0} VEZES',
    rangos: ['MENSAGEIRO', 'GARÇOM', 'BARMAN', 'CONCIERGE', 'GERENTE', 'DONO'],
    hongos: 'BUMPERS', carriles: 'PISTAS', blancos: 'ALVOS', orbitas: 'ÓRBITAS', copas: 'TAÇAS', misiones: 'MISSÕES', rango: 'CARGO', mejorJackpot: 'MELHOR JACKPOT',
    modo: 'FLIPPERS', mitades: 'METADES', botones: 'BOTÕES', tamano: 'TAMANHO', chico: 'PEQUENO', medio: 'MÉDIO', grande: 'GRANDE',
    transp: 'OPACIDADE', baja: 'BAIXA', media: 'MÉDIA', alta: 'ALTA', resorte: 'MOLA', tirarOp: 'PUXAR', tocarOp: 'TOCAR', vibrar: 'VIBRAR',
    acomodar: 'AJUSTAR BOTÕES', arrastra: 'ARRASTE CADA BOTÃO PARA ONDE FICAR CONFORTÁVEL', proba: 'TESTE AQUI',
    ayuda1: 'TOQUE A METADE ESQUERDA OU DIREITA DA TELA PARA MOVER CADA FLIPPER.', ayuda1b: 'TOQUE OS BOTÕES DE BAIXO PARA MOVER CADA FLIPPER.',
    ayuda2: 'PARA LANÇAR, PUXE A MOLA PARA BAIXO E SOLTE.', ayuda2b: 'PARA LANÇAR, TOQUE A MOLA.', ayuda3: 'CUMPRA AS MISSÕES PARA SUBIR DE CARGO NO HOTEL.', tocar: 'TOQUE PARA CONTINUAR',
  },
};
function tr(k, ...a) {
  let s = (TXT[IDIOMA] && TXT[IDIOMA][k]) ?? TXT.en[k] ?? TXT.es[k] ?? k;
  if (typeof s === 'string') a.forEach((v, i) => { s = s.replace('{' + i + '}', v); });
  return s;
}
function lienzoHD(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * S)); c.height = Math.max(1, Math.ceil(h * S)); const g = c.getContext('2d'); g.scale(S, S); return [c, g]; }

/* los colores: laca negra, verde esmeralda, marfil, oro (con su sombra) y rubí */
const NEGRO = '#07080a', ESMERALDA = '#1f8a6a', ESM_CLARO = '#5fe0b4', MARFIL = '#f4ead2', ORO = '#e8b850', ORO_CLARO = '#fff1c2', ORO_OSCURO = '#8a5e16', RUBI = '#d23a4a';

/* ----------------------------------------------------- la letra déco */
const cacheGlifo = new Map();
function glifo(ch) {
  let p = cacheGlifo.get(ch);
  if (p === undefined) { const d = LETRA.g[ch]; p = d && d[1] ? new Path2D(d[1]) : null; cacheGlifo.set(ch, p); }
  return p;
}
const avanceGlifo = (ch) => (LETRA.g[ch] ? LETRA.g[ch][0] : 300);
/* lo que Limelight no tiene se escribe con la letra del sistema (con serifa), igual de oro */
const cubreDeco = (str) => { for (const ch of str) if (ch !== ' ' && !LETRA.g[ch]) return false; return true; };
const medidorDeco = document.createElement('canvas').getContext('2d');
function fuenteDecoSis(str, tam) { const esc = escrituraDe(str); return { css: '700 ' + tam * escalaEscritura(esc) * 0.95 + 'px ' + (fuenteEscritura(esc, 'serif') || 'Georgia,serif'), rtl: esc === 'arab' }; }
function textoDecoSis(g, str, x, y, tam, o) {
  const f = fuenteDecoSis(str, tam), w = anchoDeco(str, tam);
  g.save(); g.font = f.css; g.direction = f.rtl ? 'rtl' : 'ltr'; g.textBaseline = 'middle';
  g.textAlign = o.alin === 'left' ? 'left' : o.alin === 'right' ? 'right' : 'center';
  if (o.sombra) { g.fillStyle = o.sombraCol || 'rgba(0,0,0,0.6)'; g.fillText(str, x + o.sombra[0], y + o.sombra[1]); }
  if (o.borde) { g.lineJoin = 'round'; g.lineWidth = o.bordeAncho || 3; g.strokeStyle = o.borde; g.strokeText(str, x, y); }
  if (o.oro) {
    const gr = g.createLinearGradient(0, y - tam * 0.55, 0, y + tam * 0.5);
    gr.addColorStop(0, ORO_CLARO); gr.addColorStop(0.42, '#f3cc68'); gr.addColorStop(0.5, '#a8741c'); gr.addColorStop(0.62, '#e2aa3e'); gr.addColorStop(1, '#fbe3a0');
    g.fillStyle = gr;
  } else g.fillStyle = o.col || MARFIL;
  g.fillText(str, x, y);
  g.restore();
  return w;
}
function anchoDeco(str, tam, esp) {
  str = String(str).toUpperCase();
  if (!cubreDeco(str)) { const f = fuenteDecoSis(str, tam); medidorDeco.font = f.css; medidorDeco.direction = f.rtl ? 'rtl' : 'ltr'; return medidorDeco.measureText(str).width; }
  let w = 0; for (const ch of str) w += avanceGlifo(ch); return w * tam / 1000 + (esp || 0) * tam * Math.max(0, str.length - 1); }
/* y es el centro de las mayúsculas (alto de 722 en la letra) */
function textoDeco(g, str, x, y, tam, o) {
  o = o || {};
  str = String(str).toUpperCase();
  if (!cubreDeco(str)) return textoDecoSis(g, str, x, y, tam, o);
  const esp = o.esp || 0, w = anchoDeco(str, tam, esp), k = tam / 1000;
  let cx = o.alin === 'left' ? x : o.alin === 'right' ? x - w : x - w / 2;
  const base = y + 0.361 * tam;
  for (const ch of str) {
    const p = glifo(ch);
    if (p) {
      g.save(); g.translate(cx, base); g.scale(k, k);
      if (o.sombra) { g.save(); g.translate(o.sombra[0] / k, o.sombra[1] / k); g.fillStyle = o.sombraCol || 'rgba(0,0,0,0.6)'; g.fill(p); g.restore(); }
      if (o.borde) { g.lineJoin = 'round'; g.lineWidth = (o.bordeAncho || 3) / k; g.strokeStyle = o.borde; g.stroke(p); }
      if (o.oro) {
        const gr = g.createLinearGradient(0, -760, 0, 20);
        gr.addColorStop(0, ORO_CLARO); gr.addColorStop(0.42, '#f3cc68'); gr.addColorStop(0.5, '#a8741c'); gr.addColorStop(0.62, '#e2aa3e'); gr.addColorStop(1, '#fbe3a0');
        g.fillStyle = gr;
      } else g.fillStyle = o.col || MARFIL;
      g.fill(p);
      g.restore();
    }
    cx += avanceGlifo(ch) * k + esp * tam;
  }
  return w;
}
function tamDecoQueEntra(str, tam, ancho, esp) { while (tam > 8 && anchoDeco(str, tam, esp) > ancho) tam -= 1; return tam; }

/* la sans espaciada para lo chico (en celus sin Futura cae en la del sistema) */
const SANS = '"Futura","Century Gothic","Avenir Next","Trebuchet MS","Segoe UI",Roboto,Arial,sans-serif';
/* el espaciado de letras rompería el árabe y desarma el tailandés y el birmano: solo para lo latino */
function fuenteSans(g, str, tam, peso, esp) {
  const esc = escrituraDe(str);
  g.font = (peso || '600') + ' ' + tam * escalaEscritura(esc) + 'px ' + (fuenteEscritura(esc, 'sans') || SANS);
  g.direction = esc === 'arab' ? 'rtl' : 'ltr';
  if ('letterSpacing' in g) g.letterSpacing = esc === 'latn' ? (esp == null ? tam * 0.12 : esp) + 'px' : '0px';
}
function texto(g, str, x, y, o) {
  o = o || {}; str = String(str);
  fuenteSans(g, str, o.tam || 12, o.peso, o.esp);
  g.textAlign = o.alin || 'center'; g.textBaseline = 'middle';
  if (o.borde) { g.lineWidth = o.bordeAncho || 3; g.strokeStyle = o.borde; g.lineJoin = 'round'; g.strokeText(str, x, y); }
  g.fillStyle = o.col || MARFIL; g.fillText(str, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.direction = 'ltr';
}
function medir(g, str, tam, peso, esp) {
  str = String(str);
  fuenteSans(g, str, tam, peso, esp);
  const w = g.measureText(str).width;
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.direction = 'ltr';
  return w;
}
function tamQueEntra(g, str, tam, ancho, peso) { while (tam > 7 && medir(g, str, tam, peso) > ancho) tam -= 0.5; return tam; }
