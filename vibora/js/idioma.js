// Los textos en castellano, inglés y portugués. {n} y {de} se reemplazan.
const T = {
  jugar: ['JUGAR', 'PLAY', 'JOGAR'],
  apodo: ['Tu apodo', 'Your nickname', 'Seu apelido'],
  piel: ['PIEL', 'SKIN', 'PELE'],
  fondo: ['FONDO', 'ARENA', 'FUNDO'],
  ajustes: ['AJUSTES', 'SETTINGS', 'AJUSTES'],
  bots: ['BOTS', 'BOTS', 'BOTS'],
  nivel_0: ['TRANQUI', 'CHILL', 'CALMO'],
  nivel_1: ['NORMAL', 'NORMAL', 'NORMAL'],
  nivel_2: ['PICANTE', 'SPICY', 'PICANTE'],
  mejor: ['Tu mejor largo: {n}', 'Your best length: {n}', 'Seu melhor tamanho: {n}'],
  tabla: ['Clasificación', 'Leaderboard', 'Classificação'],
  largo: ['Tu largo', 'Your length', 'Seu tamanho'],
  puesto: ['Puesto {n} de {de}', 'Rank {n} of {de}', 'Posição {n} de {de}'],
  comiste: ['¡Te comiste a {n}!', 'You ate {n}!', 'Você comeu {n}!'],
  teComio: ['Te comió {n}', '{n} got you', '{n} te pegou'],
  borde: ['Chocaste con el borde', 'You hit the border', 'Você bateu na borda'],
  final: ['Largo final', 'Final length', 'Tamanho final'],
  nuevoRecord: ['¡Nuevo récord!', 'New best!', 'Novo recorde!'],
  bajas: ['Te comiste {n}', 'You ate {n}', 'Você comeu {n}'],
  otraVez: ['OTRA VEZ', 'PLAY AGAIN', 'DE NOVO'],
  menu: ['MENÚ', 'MENU', 'MENU'],
  pausa: ['PAUSA', 'PAUSED', 'PAUSA'],
  seguir: ['SEGUIR', 'RESUME', 'CONTINUAR'],
  listo: ['LISTO', 'DONE', 'PRONTO'],
  bloqueada: ['Se abre con largo {n}', 'Unlocks at length {n}', 'Abre com tamanho {n}'],
  musica: ['Música', 'Music', 'Música'],
  sonido: ['Sonido', 'Sound', 'Som'],
  vibrar: ['Vibración', 'Vibration', 'Vibração'],
  control: ['Control', 'Controls', 'Controle'],
  flecha: ['Seguir el dedo', 'Follow finger', 'Seguir o dedo'],
  joystick: ['Joystick', 'Joystick', 'Joystick'],
  calidad: ['Calidad', 'Quality', 'Qualidade'],
  auto: ['Auto', 'Auto', 'Auto'],
  alta: ['Alta', 'High', 'Alta'],
  baja: ['Baja', 'Low', 'Baixa'],
  idioma: ['Idioma', 'Language', 'Idioma'],
  nombres: ['Nombres', 'Names', 'Nomes'],
  si: ['Sí', 'On', 'Sim'],
  no: ['No', 'Off', 'Não'],
  consejo: ['Arrastrá el dedo para doblar · el rayo o un segundo dedo es turbo', 'Drag to turn · the bolt or a second finger boosts', 'Arraste para virar · o raio ou um segundo dedo é turbo'],
  consejoPc: ['El mouse apunta · clic o espacio es turbo · P pausa', 'Aim with the mouse · click or space to boost · P pauses', 'O mouse aponta · clique ou espaço é turbo · P pausa'],
  hito: ['¡Largo {n}!', 'Length {n}!', 'Tamanho {n}!'],
  tocaEntrar: ['Tocá para entrar', 'Tap to enter', 'Toque para entrar'],
  presenta: ['presenta', 'presents', 'apresenta'],
  creditos: ['Un juego de JXSTUDIOS', 'A JXSTUDIOS game', 'Um jogo da JXSTUDIOS'],
  piel_lima: ['Lima', 'Lime', 'Limão'], piel_coral: ['Coral', 'Coral', 'Coral'], piel_uva: ['Uva', 'Grape', 'Uva'],
  piel_cielo: ['Cielo', 'Sky', 'Céu'], piel_menta: ['Menta', 'Mint', 'Hortelã'], piel_rosa: ['Rosa', 'Pink', 'Rosa'],
  piel_fuego: ['Fuego', 'Fire', 'Fogo'], piel_hielo: ['Hielo', 'Ice', 'Gelo'], piel_argentina: ['Argentina', 'Argentina', 'Argentina'],
  piel_uruguay: ['Uruguay', 'Uruguay', 'Uruguai'], piel_brasil: ['Brasil', 'Brazil', 'Brasil'], piel_mexico: ['México', 'Mexico', 'México'],
  piel_jx: ['Carbono JX', 'JX Carbon', 'Carbono JX'], piel_abeja: ['Abeja', 'Bee', 'Abelha'], piel_tigre: ['Tigre', 'Tiger', 'Tigre'],
  piel_cebra: ['Cebra', 'Zebra', 'Zebra'], piel_caramelo: ['Caramelo', 'Candy', 'Bala'], piel_sandia: ['Sandía', 'Watermelon', 'Melancia'],
  piel_oceano: ['Océano', 'Ocean', 'Oceano'], piel_bosque: ['Bosque', 'Forest', 'Floresta'], piel_lava: ['Lava', 'Lava', 'Lava'],
  piel_chicle: ['Chicle', 'Bubblegum', 'Chiclete'], piel_robot: ['Robot', 'Robot', 'Robô'], piel_galaxia: ['Galaxia', 'Galaxy', 'Galáxia'],
  piel_oro: ['Oro', 'Gold', 'Ouro'], piel_neon: ['Neón', 'Neon', 'Neon'], piel_arcoiris: ['Arcoíris', 'Rainbow', 'Arco-íris'],
  fondo_colmena: ['Colmena', 'Honeycomb', 'Colmeia'], fondo_carbono: ['Carbono JX', 'JX Carbon', 'Carbono JX'],
  fondo_circuito: ['Circuito', 'Circuit', 'Circuito'], fondo_galaxia: ['Galaxia', 'Galaxy', 'Galáxia'], fondo_magma: ['Magma', 'Magma', 'Magma'],
};

export const IDIOMAS = ['es', 'en', 'pt'];
export const TABLA = T;

export function crearIdioma(inicial) {
  const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
  let actual = IDIOMAS.includes(inicial) ? inicial : IDIOMAS.includes(nav) ? nav : 'en';
  const tr = (clave, datos) => {
    const fila = T[clave];
    if (!fila) return clave;
    let s = fila[IDIOMAS.indexOf(actual)] ?? fila[0];
    if (datos !== undefined) {
      if (typeof datos === 'object') for (const [k, v] of Object.entries(datos)) s = s.replace(`{${k}}`, v);
      else s = s.replace('{n}', datos);
    }
    return s;
  };
  tr.poner = (l) => { if (IDIOMAS.includes(l)) actual = l; };
  tr.actual = () => actual;
  return tr;
}
