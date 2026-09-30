// Los textos en castellano, inglés y portugués. {n} se reemplaza.
// El nombre del juego, GLOBO LIBRE, es el mismo en los tres (es una marca).
const T = {
  jugar: ['JUGAR', 'PLAY', 'JOGAR'],
  niveles: ['NIVELES', 'LEVELS', 'NÍVEIS'],
  infinito: ['INFINITO', 'ENDLESS', 'INFINITO'],
  tienda: ['TIENDA', 'SHOP', 'LOJA'],
  ajustes: ['AJUSTES', 'SETTINGS', 'AJUSTES'],
  volver: ['VOLVER', 'BACK', 'VOLTAR'],
  nivel: ['Nivel {n}', 'Level {n}', 'Nível {n}'],
  meta: ['META', 'FINISH', 'CHEGADA'],
  pum: ['¡PUM!', 'POP!', 'POF!'],
  reventado: ['Se reventó el globo', 'Your balloon popped', 'O balão estourou'],
  superado: ['¡Nivel superado!', 'Level complete!', 'Nível concluído!'],
  ganaste: ['+{n} monedas', '+{n} coins', '+{n} moedas'],
  juntaste: ['Juntaste {n}', 'You got {n}', 'Você pegou {n}'],
  siguiente: ['SIGUIENTE', 'NEXT', 'PRÓXIMO'],
  otraVez: ['OTRA VEZ', 'RETRY', 'DE NOVO'],
  menu: ['MENÚ', 'MENU', 'MENU'],
  pausa: ['PAUSA', 'PAUSED', 'PAUSA'],
  seguir: ['SEGUIR', 'RESUME', 'CONTINUAR'],
  metros: ['{n} m', '{n} m', '{n} m'],
  record: ['Récord: {n} m', 'Best: {n} m', 'Recorde: {n} m'],
  nuevoRecord: ['¡Nuevo récord!', 'New best!', 'Novo recorde!'],
  llegaste: ['Llegaste a {n} m', 'You reached {n} m', 'Você chegou a {n} m'],
  todos: ['¡Pasaste los 30 niveles!', 'You beat all 30 levels!', 'Você passou os 30 níveis!'],
  consejo: ['Arrastrá en cualquier lado para mover el escudo', 'Drag anywhere to move the shield', 'Arraste em qualquer lugar para mover o escudo'],
  consejoPc: ['Arrastrá con el mouse o usá las flechas', 'Drag with the mouse or use the arrow keys', 'Arraste com o mouse ou use as setas'],
  cuidalo: ['¡Cuidá el globo!', 'Protect the balloon!', 'Proteja o balão!'],
  globos: ['GLOBOS', 'BALLOONS', 'BALÕES'],
  escudos: ['ESCUDOS', 'SHIELDS', 'ESCUDOS'],
  usar: ['USAR', 'USE', 'USAR'],
  enUso: ['EN USO', 'EQUIPPED', 'EM USO'],
  comprar: ['COMPRAR · {n}', 'BUY · {n}', 'COMPRAR · {n}'],
  faltan: ['Te faltan {n} monedas', 'You need {n} more coins', 'Faltam {n} moedas'],
  bloqueado: ['Pasá el nivel {n}', 'Beat level {n}', 'Passe o nível {n}'],
  musica: ['Música', 'Music', 'Música'],
  sonido: ['Sonido', 'Sound', 'Som'],
  vibrar: ['Vibración', 'Vibration', 'Vibração'],
  sensibilidad: ['Sensibilidad', 'Sensitivity', 'Sensibilidade'],
  calidad: ['Calidad', 'Quality', 'Qualidade'],
  idioma: ['Idioma', 'Language', 'Idioma'],
  si: ['Sí', 'On', 'Sim'],
  no: ['No', 'Off', 'Não'],
  auto: ['Auto', 'Auto', 'Auto'],
  alta: ['Alta', 'High', 'Alta'],
  media: ['Media', 'Medium', 'Média'],
  baja: ['Baja', 'Low', 'Baixa'],
  borrar: ['Borrar progreso', 'Reset progress', 'Apagar progresso'],
  borrarSeguro: ['¿Seguro? Toca otra vez', 'Sure? Tap again', 'Certeza? Toque de novo'],
  presenta: ['presenta', 'presents', 'apresenta'],
  creditos: ['Un juego de JXSTUDIOS', 'A JXSTUDIOS game', 'Um jogo da JXSTUDIOS'],
  cielo_dia: ['Día', 'Day', 'Dia'], cielo_tarde: ['Atardecer', 'Sunset', 'Pôr do sol'], cielo_noche: ['Noche', 'Night', 'Noite'],
  globo_rojo: ['Rojo', 'Red', 'Vermelho'], globo_azul: ['Azul', 'Blue', 'Azul'], globo_verde: ['Verde', 'Green', 'Verde'],
  globo_amarillo: ['Amarillo', 'Yellow', 'Amarelo'], globo_rosa: ['Rosa', 'Pink', 'Rosa'], globo_violeta: ['Violeta', 'Violet', 'Violeta'],
  globo_rayas: ['Rayado', 'Striped', 'Listrado'], globo_lunares: ['Lunares', 'Polka dots', 'Bolinhas'], globo_sandia: ['Sandía', 'Watermelon', 'Melancia'],
  globo_arcoiris: ['Arcoíris', 'Rainbow', 'Arco-íris'], globo_planeta: ['Planeta', 'Planet', 'Planeta'], globo_oro: ['Oro', 'Gold', 'Ouro'],
  globo_jx: ['JXSTUDIOS', 'JXSTUDIOS', 'JXSTUDIOS'],
  escudo_blanco: ['Blanco', 'White', 'Branco'], escudo_burbuja: ['Burbuja', 'Bubble', 'Bolha'], escudo_menta: ['Menta', 'Mint', 'Hortelã'],
  escudo_fuego: ['Fuego', 'Fire', 'Fogo'], escudo_hielo: ['Hielo', 'Ice', 'Gelo'], escudo_galleta: ['Galletita', 'Cookie', 'Biscoito'],
  escudo_rueda: ['Rueda', 'Wheel', 'Roda'], escudo_arcoiris: ['Arcoíris', 'Rainbow', 'Arco-íris'],
};

export const IDIOMAS = ['es', 'en', 'pt'];
export const TABLA = T;

export function crearIdioma(inicial) {
  const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
  let actual = IDIOMAS.includes(inicial) ? inicial : IDIOMAS.includes(nav) ? nav : 'en';
  const tr = (clave, n) => {
    const fila = T[clave];
    if (!fila) return clave;
    const s = fila[IDIOMAS.indexOf(actual)] ?? fila[0];
    return n === undefined ? s : s.replace('{n}', n);
  };
  tr.poner = (l) => { if (IDIOMAS.includes(l)) actual = l; };
  tr.actual = () => actual;
  return tr;
}
