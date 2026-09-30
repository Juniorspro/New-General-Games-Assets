// Los textos en castellano, inglés y portugués. {n} se reemplaza.
// El nombre del juego, GRUMO, es el mismo en los tres (es una marca).
const T = {
  jugar: ['JUGAR', 'PLAY', 'JOGAR'],
  subtitulo: ['El animador hace trampa', 'The animator cheats', 'O animador trapaceia'],
  niveles: ['ESCENAS', 'SCENES', 'CENAS'],
  tienda: ['CAMARÍN', 'DRESSING ROOM', 'CAMARIM'],
  ajustes: ['AJUSTES', 'SETTINGS', 'AJUSTES'],
  volver: ['VOLVER', 'BACK', 'VOLTAR'],
  escena: ['ESCENA {n}', 'SCENE {n}', 'CENA {n}'],
  toma: ['TOMA {n}', 'TAKE {n}', 'TOMADA {n}'],
  tomas: ['{n} tomas', '{n} takes', '{n} tomadas'],
  unaToma: ['1 toma', '1 take', '1 tomada'],
  mejor: ['Mejor: {n}', 'Best: {n}', 'Melhor: {n}'],
  set_taller: ['El taller', 'The workshop', 'A oficina'],
  set_cocina: ['La cocina', 'The kitchen', 'A cozinha'],
  set_noche: ['El jardín de noche', 'The night garden', 'O jardim à noite'],
  cerrado: ['Terminá el anterior', 'Finish the one before', 'Termine o anterior'],
  setCerrado: ['Terminá {n} para abrirlo', 'Finish {n} to open it', 'Termine {n} para abrir'],
  buenaToma: ['¡Buena toma!', 'Good take!', 'Boa tomada!'],
  tomaUnica: ['¡Toma única!', 'One take!', 'Tomada única!'],
  ganaste: ['+{n} bolitas', '+{n} clay balls', '+{n} bolinhas'],
  enTomas: ['Salió en {n} tomas', 'Done in {n} takes', 'Saiu em {n} tomadas'],
  enUnaToma: ['Salió de una', 'Nailed it first try', 'Saiu de primeira'],
  siguiente: ['SIGUIENTE', 'NEXT', 'PRÓXIMA'],
  otraVez: ['OTRA VEZ', 'RETRY', 'DE NOVO'],
  menu: ['MENÚ', 'MENU', 'MENU'],
  pausa: ['PAUSA', 'PAUSED', 'PAUSA'],
  seguir: ['SEGUIR', 'RESUME', 'CONTINUAR'],
  reiniciar: ['DE NUEVO', 'RESTART', 'REINICIAR'],
  todos: ['¡Rodaste la película entera!', 'You shot the whole movie!', 'Você filmou o filme todo!'],
  setNuevo: ['¡Set nuevo abierto!', 'New set unlocked!', 'Set novo aberto!'],
  corten: ['¡CORTEN!', 'CUT!', 'CORTA!'],
  accion: ['¡ACCIÓN!', 'ACTION!', 'AÇÃO!'],
  // el camarín (la tienda)
  pieles: ['COLORES', 'COLORS', 'CORES'],
  sombreros: ['SOMBREROS', 'HATS', 'CHAPÉUS'],
  usar: ['USAR', 'WEAR', 'USAR'],
  enUso: ['PUESTO', 'WEARING', 'EM USO'],
  comprar: ['COMPRAR · {n}', 'BUY · {n}', 'COMPRAR · {n}'],
  faltan: ['Te faltan {n} bolitas', 'You need {n} more', 'Faltam {n} bolinhas'],
  piel_naranja: ['Naranja', 'Orange', 'Laranja'], piel_limon: ['Limón', 'Lemon', 'Limão'], piel_menta: ['Menta', 'Mint', 'Hortelã'],
  piel_cielo: ['Celeste', 'Sky', 'Céu'], piel_chicle: ['Chicle', 'Bubblegum', 'Chiclete'], piel_uva: ['Uva', 'Grape', 'Uva'],
  piel_carbon: ['Carbón', 'Charcoal', 'Carvão'], piel_marmol: ['Marmolado', 'Marbled', 'Marmorizado'], piel_oro: ['Dorado', 'Golden', 'Dourado'],
  sombrero_nada: ['Sin sombrero', 'No hat', 'Sem chapéu'], sombrero_fiesta: ['De cumpleaños', 'Party hat', 'De aniversário'],
  sombrero_boina: ['Boina', 'Beret', 'Boina'], sombrero_galera: ['Galera', 'Top hat', 'Cartola'],
  sombrero_helice: ['Con hélice', 'Propeller cap', 'Com hélice'], sombrero_chef: ['De cocinero', 'Chef hat', 'De chef'],
  sombrero_corona: ['Corona', 'Crown', 'Coroa'],
  // los ajustes
  musica: ['Música', 'Music', 'Música'],
  sonido: ['Sonido', 'Sound', 'Som'],
  vibrar: ['Vibración', 'Vibration', 'Vibração'],
  calidad: ['Calidad', 'Quality', 'Qualidade'],
  idioma: ['Idioma', 'Language', 'Idioma'],
  si: ['Sí', 'On', 'Sim'], no: ['No', 'Off', 'Não'],
  auto: ['Auto', 'Auto', 'Auto'], alta: ['Alta', 'High', 'Alta'], baja: ['Baja', 'Low', 'Baixa'],
  borrar: ['Borrar progreso', 'Reset progress', 'Apagar progresso'],
  borrarSeguro: ['¿Seguro? Tocá otra vez', 'Sure? Tap again', 'Certeza? Toque de novo'],
  presenta: ['presenta', 'presents', 'apresenta'],
  creditos: ['Un juego de JXSTUDIOS', 'A JXSTUDIOS game', 'Um jogo da JXSTUDIOS'],
  tocar: ['Tocá para seguir', 'Tap to continue', 'Toque para continuar'],
  // las ayudas de las primeras escenas
  ayudaMover: ['Mové a Grumo con las flechas y saltá con el botón grande', 'Move Grumo with the arrows and jump with the big button', 'Mova o Grumo com as setas e pule com o botão grande'],
  ayudaTeclas: ['Flechas o A/D para moverte · Espacio para saltar', 'Arrows or A/D to move · Space to jump', 'Setas ou A/D para mover · Espaço para pular'],
  ayudaPuerta: ['Llegá a la puerta', 'Reach the door', 'Chegue à porta'],
  ayudaSalto: ['Mantené apretado para saltar más alto', 'Hold to jump higher', 'Segure para pular mais alto'],
  ayudaMuerte: ['Cada vez que te caés es una toma nueva: ahora ya sabés', 'Every fall is a new take: now you know', 'Cada queda é uma tomada nova: agora você sabe'],
  // las notas que deja el animador (papelitos en el set)
  nota_confia: ['Confiá en mí', 'Trust me', 'Confie em mim'],
  nota_casi: ['¡Casi!', 'Almost!', 'Quase!'],
  nota_nopiso: ['No mires el piso', "Don't look down", 'Não olhe para baixo'],
  nota_perdon: ['Perdón, se me cayó', 'Oops, I dropped it', 'Desculpa, caiu'],
  nota_quieto: ['Quedate quieto un ratito', 'Hold still a second', 'Fica paradinho'],
  nota_rapido: ['¡Rápido!', 'Hurry!', 'Rápido!'],
  nota_esta: ['Esta sí es', 'This one is real', 'Esta é de verdade'],
  nota_luz: ['Se cortó la luz', 'Power cut', 'Acabou a luz'],
  nota_fin: ['¿Y ahora?', 'Now what?', 'E agora?'],
  nota_pintada: ['Está pintada', "It's painted on", 'É pintada'],
  nota_ultima: ['Última toma', 'Last take', 'Última tomada'],
  nota_porahi: ['¡Por ahí no!', 'Not that way!', 'Por aí não!'],
  // el final
  finTitulo: ['¡Se terminó el rodaje!', "That's a wrap!", 'Fim das filmagens!'],
  finTexto: ['Grumo llegó a la última puerta', 'Grumo made it to the last door', 'Grumo chegou à última porta'],
  finTomas: ['Tomas en total: {n}', 'Total takes: {n}', 'Tomadas no total: {n}'],
};

export const IDIOMAS = ['es', 'en', 'pt'];
export const TABLA = T;

export function crearIdioma(inicial) {
  const nav = (typeof navigator !== 'undefined' && navigator.language || 'es').slice(0, 2).toLowerCase();
  let actual = IDIOMAS.includes(inicial) ? inicial : IDIOMAS.includes(nav) ? nav : 'en';
  const tr = (clave, n) => {
    if (Array.isArray(clave)) return clave[IDIOMAS.indexOf(actual)] ?? clave[0];
    const fila = T[clave];
    if (!fila) return clave;
    const s = fila[IDIOMAS.indexOf(actual)] ?? fila[0];
    return n === undefined ? s : s.replace('{n}', n);
  };
  tr.poner = (l) => { if (IDIOMAS.includes(l)) actual = l; };
  tr.actual = () => actual;
  return tr;
}
