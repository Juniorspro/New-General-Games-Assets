// Los textos en castellano, inglés y portugués. {n} se reemplaza.
// El nombre del juego, MORFI, es el mismo en los tres (es una marca).
const T = {
  jugar: ['JUGAR', 'PLAY', 'JOGAR'],
  subtitulo: ['Cortá el hilo', 'Snip the string', 'Corte o fio'],
  cajas: ['CAJAS', 'BOXES', 'CAIXAS'],
  tienda: ['TIENDA', 'SHOP', 'LOJA'],
  ajustes: ['AJUSTES', 'SETTINGS', 'AJUSTES'],
  volver: ['VOLVER', 'BACK', 'VOLTAR'],
  nivel: ['Nivel {n}', 'Level {n}', 'Nível {n}'],
  caja_carton: ['Caja de cartón', 'Cardboard box', 'Caixa de papelão'],
  caja_cuaderno: ['Cuaderno', 'Notebook', 'Caderno'],
  caja_regalo: ['Papel de regalo', 'Gift wrap', 'Papel de presente'],
  juntaEstrellas: ['Juntá {n} ★ para abrirla', 'Collect {n} ★ to open', 'Junte {n} ★ para abrir'],
  superado: ['¡Morfi comió!', 'Morfi ate it!', 'Morfi comeu!'],
  perfecto: ['¡Perfecto!', 'Perfect!', 'Perfeito!'],
  ganaste: ['+{n} monedas', '+{n} coins', '+{n} moedas'],
  siguiente: ['SIGUIENTE', 'NEXT', 'PRÓXIMO'],
  otraVez: ['OTRA VEZ', 'RETRY', 'DE NOVO'],
  menu: ['MENÚ', 'MENU', 'MENU'],
  pausa: ['PAUSA', 'PAUSED', 'PAUSA'],
  seguir: ['SEGUIR', 'RESUME', 'CONTINUAR'],
  todos: ['¡Pasaste las tres cajas!', 'You beat all three boxes!', 'Você passou as três caixas!'],
  cajaNueva: ['¡Caja nueva abierta!', 'New box unlocked!', 'Caixa nova aberta!'],
  perdido: ['¡Se cayó!', 'It fell!', 'Caiu!'],
  roto: ['¡Se rompió!', 'It broke!', 'Quebrou!'],
  consejoPc: ['Arrastrá con el mouse para cortar', 'Drag with the mouse to cut', 'Arraste com o mouse para cortar'],
  ayudaCortar: ['Deslizá el dedo por el hilo para cortarlo', 'Swipe across the string to cut it', 'Deslize o dedo no fio para cortá-lo'],
  ayudaHamaca: ['Cortá cuando la hamaca lo lleve hacia Morfi', 'Cut when the swing takes it towards Morfi', 'Corte quando o balanço levar até o Morfi'],
  ayudaClip: ['El alfiler azul le ata un hilo nuevo', 'The blue pin ties a new string on it', 'O alfinete azul amarra um fio novo'],
  ayudaGlobo: ['El globo lo sube: tocalo para reventarlo', 'The balloon lifts it: tap to pop it', 'O balão levanta: toque para estourar'],
  ayudaAbanico: ['Tocá el abanico y sopla', 'Tap the fan to blow', 'Toque o leque para soprar'],
  ayudaChinches: ['¡Ojo con las chinches!', 'Watch out for the tacks!', 'Cuidado com as tachinhas!'],
  ayudaSobre: ['Lo que entra en un sobre sale por el otro', 'In one envelope, out the other', 'Entra num envelope e sai no outro'],
  ayudaGomita: ['La gomita lo hace rebotar', 'The rubber band bounces it', 'O elástico faz quicar'],
  ayudaMueve: ['El alfiler violeta va y viene', 'The purple pin slides back and forth', 'O alfinete roxo vai e volta'],
  morfis: ['MORFIS', 'MORFIS', 'MORFIS'],
  caramelos: ['CARAMELOS', 'CANDIES', 'BALAS'],
  usar: ['USAR', 'USE', 'USAR'],
  enUso: ['EN USO', 'EQUIPPED', 'EM USO'],
  comprar: ['COMPRAR · {n}', 'BUY · {n}', 'COMPRAR · {n}'],
  faltan: ['Te faltan {n} monedas', 'You need {n} more coins', 'Faltam {n} moedas'],
  musica: ['Música', 'Music', 'Música'],
  sonido: ['Sonido', 'Sound', 'Som'],
  vibrar: ['Vibración', 'Vibration', 'Vibração'],
  calidad: ['Calidad', 'Quality', 'Qualidade'],
  idioma: ['Idioma', 'Language', 'Idioma'],
  si: ['Sí', 'On', 'Sim'],
  no: ['No', 'Off', 'Não'],
  auto: ['Auto', 'Auto', 'Auto'],
  alta: ['Alta', 'High', 'Alta'],
  baja: ['Baja', 'Low', 'Baixa'],
  borrar: ['Borrar progreso', 'Reset progress', 'Apagar progresso'],
  borrarSeguro: ['¿Seguro? Toca otra vez', 'Sure? Tap again', 'Certeza? Toque de novo'],
  presenta: ['presenta', 'presents', 'apresenta'],
  creditos: ['Un juego de JXSTUDIOS', 'A JXSTUDIOS game', 'Um jogo da JXSTUDIOS'],
  morfi_kraft: ['Cartón', 'Cardboard', 'Papelão'], morfi_regalo: ['De regalo', 'Gift', 'Presente'],
  morfi_zapatos: ['Caja de zapatos', 'Shoebox', 'Caixa de sapatos'], morfi_pizza: ['Pizza', 'Pizza', 'Pizza'],
  morfi_mudanza: ['Mudanza', 'Moving box', 'Mudança'], morfi_menta: ['Menta', 'Mint', 'Hortelã'],
  morfi_noche: ['De noche', 'Night', 'Noite'], morfi_jx: ['JXSTUDIOS', 'JXSTUDIOS', 'JXSTUDIOS'],
  caramelo_rojo: ['Clásico', 'Classic', 'Clássica'], caramelo_frutilla: ['Frutilla', 'Strawberry', 'Morango'],
  caramelo_menta: ['Menta', 'Mint', 'Hortelã'], caramelo_uva: ['Uva', 'Grape', 'Uva'],
  caramelo_dulce: ['Dulce de leche', 'Caramel', 'Doce de leite'], caramelo_limon: ['Limón', 'Lemon', 'Limão'],
  caramelo_arcoiris: ['Arcoíris', 'Rainbow', 'Arco-íris'],
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
