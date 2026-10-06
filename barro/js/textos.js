/* ============================================================================
   barro/js/textos.js — todo el juego en español, inglés y portugués.
   ========================================================================== */
const T = {
  es: {
    elegir: 'Elegí tu idioma', sub: 'MOTOCROSS',
    carrera: 'CAMPEONATO', jam: 'JAM DEL DÍA', reloj: 'CONTRARRELOJ', garage: 'GARAGE', ajustes: 'AJUSTES', jugar: 'CORRER',
    sedes: ['BOSQUE', 'CAÑÓN', 'SELVA', 'ESTADIO'], lugares: ['Patagonia', 'Talampaya', 'Misiones', 'Supercross nocturno'],
    pista: 'PISTA', final: 'FINAL', bloqueada: 'Terminá en el podio la anterior', sedeBloq: 'Ganá la final de la sede anterior',
    rivales: 'RIVALES', premio: 'PREMIO', record: 'TU MEJOR', aLaGrilla: '¡A LA GRILLA!', volver: 'VOLVER',
    ya: '¡YA!', holeshot: '¡HOLESHOT!', perfecto: '¡PERFECTO!', bien: 'BIEN', duro: 'DURO', caida: '¡AL PISO!', willy: 'WILLY',
    puesto: (n) => `${n}º`, de: 'de', meta: '¡META!', ganaste: '¡GANASTE!', podio: '¡PODIO!', terminaste: 'TERMINASTE',
    siguiente: 'SIGUIENTE', otraVez: 'OTRA VEZ', menu: 'MENÚ', seguir: 'SEGUIR', reiniciar: 'REINICIAR', salir: 'SALIR', pausa: 'PAUSA',
    mejoras: 'MEJORAS', colores: 'COLORES', numero: 'NÚMERO', nombre: 'NOMBRE', tuNombre: 'Tu nombre', nivel: 'NIVEL', maximo: 'AL MÁXIMO', comprar: 'MEJORAR', sinPlata: 'Te falta plata',
    mej: { motor: ['MOTOR', 'Más empuje y más punta'], susp: ['SUSPENSIÓN', 'Perdona los aterrizajes'], agarre: ['GOMAS', 'Más tracción, menos patinadas'], piloto: ['PILOTO', 'Gira más rápido en el aire'] },
    musica: 'Música', efectos: 'Efectos', vibrar: 'Vibrar', calidad: 'Calidad', baja: 'Baja', media: 'Media', alta: 'Alta', idioma: 'Idioma', controles: 'EDITAR CONTROLES', creditos: 'Un juego de JXSTUDIOS',
    gas: 'GAS', freno: 'FRENO', atras: 'ATRÁS', adelante: 'ADELANTE',
    editar: 'Arrastrá cada botón. Tocalo para cambiarle el tamaño.', tamano: 'Tamaño', opacidad: 'Transparencia', zurdo: 'Zurdo (espejar)', restablecer: 'RESTABLECER', listo: 'LISTO',
    jamTxt: (n) => `JAM #${n}`, jamSub: 'La misma pista para todos hoy. ¡Hacé tu mejor tiempo!', relojSub: 'Solo vos y tu fantasma.', fantasma: 'FANTASMA', nuevoRecord: '¡NUEVO RÉCORD!',
    ayuda: ['Gas para acelerar, freno para frenar.', 'En el aire: ATRÁS levanta la trompa, ADELANTE la baja.', 'Caé con las ruedas paralelas a la bajada: ¡PERFECTO! te da un empujón.', 'Acelerando sola levanta la trompa: echate ADELANTE.'],
    plata: 'PLATA', medallas: 'MEDALLAS', tiempo: 'TIEMPO', caidas: 'caídas', mejorSalto: 'mejor salto', tocar: 'Tocá para empezar', cargando: 'Cargando…',
  },
  en: {
    elegir: 'Choose your language', sub: 'MOTOCROSS',
    carrera: 'CHAMPIONSHIP', jam: 'DAILY JAM', reloj: 'TIME TRIAL', garage: 'GARAGE', ajustes: 'SETTINGS', jugar: 'RACE',
    sedes: ['FOREST', 'CANYON', 'JUNGLE', 'STADIUM'], lugares: ['Patagonia', 'Talampaya', 'Misiones', 'Night supercross'],
    pista: 'TRACK', final: 'FINAL', bloqueada: 'Finish the previous one on the podium', sedeBloq: 'Win the previous venue final',
    rivales: 'RIVALS', premio: 'PRIZE', record: 'YOUR BEST', aLaGrilla: 'TO THE GATE!', volver: 'BACK',
    ya: 'GO!', holeshot: 'HOLESHOT!', perfecto: 'PERFECT!', bien: 'GOOD', duro: 'HARD', caida: 'CRASH!', willy: 'WHEELIE',
    puesto: (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 10 < 4 && Math.floor(n / 10) !== 1 ? n % 10 : 0]}`, de: 'of', meta: 'FINISH!', ganaste: 'YOU WON!', podio: 'PODIUM!', terminaste: 'FINISHED',
    siguiente: 'NEXT', otraVez: 'RETRY', menu: 'MENU', seguir: 'RESUME', reiniciar: 'RESTART', salir: 'QUIT', pausa: 'PAUSED',
    mejoras: 'UPGRADES', colores: 'COLORS', numero: 'NUMBER', nombre: 'NAME', tuNombre: 'Your name', nivel: 'LEVEL', maximo: 'MAXED', comprar: 'UPGRADE', sinPlata: 'Not enough cash',
    mej: { motor: ['ENGINE', 'More power and top speed'], susp: ['SUSPENSION', 'Forgives bad landings'], agarre: ['TIRES', 'More grip, less wheelspin'], piloto: ['RIDER', 'Rotates faster in the air'] },
    musica: 'Music', efectos: 'Sound', vibrar: 'Vibration', calidad: 'Quality', baja: 'Low', media: 'Medium', alta: 'High', idioma: 'Language', controles: 'EDIT CONTROLS', creditos: 'A JXSTUDIOS game',
    gas: 'GAS', freno: 'BRAKE', atras: 'BACK', adelante: 'FORWARD',
    editar: 'Drag each button. Tap it to resize.', tamano: 'Size', opacidad: 'Opacity', zurdo: 'Left-handed (mirror)', restablecer: 'RESET', listo: 'DONE',
    jamTxt: (n) => `JAM #${n}`, jamSub: 'Same track for everyone today. Set your best time!', relojSub: 'Just you and your ghost.', fantasma: 'GHOST', nuevoRecord: 'NEW RECORD!',
    ayuda: ['Gas to speed up, brake to slow down.', 'In the air: BACK lifts the nose, FORWARD drops it.', 'Land parallel to the downslope: PERFECT! gives you a boost.', 'Full gas lifts the front wheel: lean FORWARD.'],
    plata: 'CASH', medallas: 'MEDALS', tiempo: 'TIME', caidas: 'crashes', mejorSalto: 'best jump', tocar: 'Tap to start', cargando: 'Loading…',
  },
  pt: {
    elegir: 'Escolha seu idioma', sub: 'MOTOCROSS',
    carrera: 'CAMPEONATO', jam: 'JAM DO DIA', reloj: 'CONTRA O RELÓGIO', garage: 'GARAGEM', ajustes: 'AJUSTES', jugar: 'CORRER',
    sedes: ['FLORESTA', 'CÂNION', 'SELVA', 'ESTÁDIO'], lugares: ['Patagônia', 'Talampaya', 'Misiones', 'Supercross noturno'],
    pista: 'PISTA', final: 'FINAL', bloqueada: 'Termine a anterior no pódio', sedeBloq: 'Vença a final da sede anterior',
    rivales: 'RIVAIS', premio: 'PRÊMIO', record: 'SEU MELHOR', aLaGrilla: 'PARA O GATE!', volver: 'VOLTAR',
    ya: 'JÁ!', holeshot: 'HOLESHOT!', perfecto: 'PERFEITO!', bien: 'BOM', duro: 'DURO', caida: 'QUEDA!', willy: 'GRAU',
    puesto: (n) => `${n}º`, de: 'de', meta: 'CHEGADA!', ganaste: 'VOCÊ VENCEU!', podio: 'PÓDIO!', terminaste: 'TERMINOU',
    siguiente: 'PRÓXIMA', otraVez: 'DE NOVO', menu: 'MENU', seguir: 'CONTINUAR', reiniciar: 'REINICIAR', salir: 'SAIR', pausa: 'PAUSA',
    mejoras: 'MELHORIAS', colores: 'CORES', numero: 'NÚMERO', nombre: 'NOME', tuNombre: 'Seu nome', nivel: 'NÍVEL', maximo: 'NO MÁXIMO', comprar: 'MELHORAR', sinPlata: 'Falta dinheiro',
    mej: { motor: ['MOTOR', 'Mais força e velocidade'], susp: ['SUSPENSÃO', 'Perdoa aterrissagens'], agarre: ['PNEUS', 'Mais tração, menos patinada'], piloto: ['PILOTO', 'Gira mais rápido no ar'] },
    musica: 'Música', efectos: 'Efeitos', vibrar: 'Vibrar', calidad: 'Qualidade', baja: 'Baixa', media: 'Média', alta: 'Alta', idioma: 'Idioma', controles: 'EDITAR CONTROLES', creditos: 'Um jogo da JXSTUDIOS',
    gas: 'GÁS', freno: 'FREIO', atras: 'TRÁS', adelante: 'FRENTE',
    editar: 'Arraste cada botão. Toque para mudar o tamanho.', tamano: 'Tamanho', opacidad: 'Transparência', zurdo: 'Canhoto (espelhar)', restablecer: 'RESTAURAR', listo: 'PRONTO',
    jamTxt: (n) => `JAM #${n}`, jamSub: 'A mesma pista para todos hoje. Faça seu melhor tempo!', relojSub: 'Só você e seu fantasma.', fantasma: 'FANTASMA', nuevoRecord: 'NOVO RECORDE!',
    ayuda: ['Gás para acelerar, freio para frear.', 'No ar: TRÁS levanta a frente, FRENTE abaixa.', 'Aterrisse paralelo à descida: PERFEITO! dá um impulso.', 'Acelerando, a frente sobe: incline para a FRENTE.'],
    plata: 'DINHEIRO', medallas: 'MEDALHAS', tiempo: 'TEMPO', caidas: 'quedas', mejorSalto: 'melhor salto', tocar: 'Toque para começar', cargando: 'Carregando…',
  },
};
let idioma = 'es';
export const setIdioma = (i) => { idioma = T[i] ? i : 'es'; };
export const getIdioma = () => idioma;
export const t = (k) => T[idioma][k] ?? T.es[k] ?? k;
export const IDIOMAS = [['es', 'ESPAÑOL'], ['en', 'ENGLISH'], ['pt', 'PORTUGUÊS']];
