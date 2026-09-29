/* ============================================================================
   aeroplaza/js/celu.js — (vuelta 46) EL CELU: "algo así como Roblox", con
   amigos y solicitudes de amistad. Un teléfono Aero de vidrio blanco que se
   saca con 📱 (o la M, o Select en el mando) y que el muñeco sostiene en la
   mano mientras está abierto (los demás lo ven: meeple.js › celuEnMano).
   - El inicio: la hora, cuántos amigos hay en línea y las apps: Amigos,
     Mensajes, Juegos (los lugares con su gente y tus amigos, como la portada
     de Roblox), Casas (las que están abiertas), Perfil (tu código de amigo),
     y atajos a lo que ya había: cámara, probador, tienda, misiones y ajustes.
   - Amigos: la lista (los conectados primero, con dónde están y "Unirse", que
     te lleva a su misma sala), las solicitudes (aceptar, rechazar, cancelar) y
     agregar (por código, o a los que están cerca). Mensajes: charlas de a dos,
     cifradas (amigos.js), con "visto". El perfil de cada uno: unirse, mensaje,
     quitar y bloquear (con su "¿seguro?" adentro del celu).
   - Es una UI.ventana (.velo › .ventana.celu): en el VR la lee el espejo
     (espejo.js) y cada botón es un mosaico. Por eso los botones de solo ícono
     llevan aria-label, y el "¿seguro?" no es una ventana aparte.
   - Parado en pantallas altas; acostado (más ancho que alto) en el celu con el
     juego acostado (html.b460). El juego no se pausa: es en línea.
   Lo que escribe la gente (nombres, mensajes) va siempre con textContent.
   ========================================================================== */
import { t, sumar, idioma } from './textos.js';
import { Teclado } from './teclado.js';
import { codigoLindo, leerCodigo, ID_RE, MAX_AMIGOS, MAX_TXT } from './amigos.js';
import { tiendaJoyas } from './joyas.js';
import { REINOS, HUD_INICIAL } from './ui.js';

sumar({
  es: {
    app_construir: 'Construir', app_gestos: 'Gestos', app_musica: 'Música', app_mapa: 'Mapa', app_voz: 'Voz', app_estilo: 'Estilo', ap_prendida: 'prendida', app_ajustes_juego: 'Opciones del juego', aj_botones: 'Botones en la pantalla', aj_botones_d: 'Los que están apagados quedan guardados acá en el celu: se usan desde sus apps.', aj_chat: 'Chat', aj_voz: 'Voz', aj_misiones: 'Misiones', aj_estilo: 'Estilo', aj_barra: 'Barra 1-5', aj_en_pantalla: 'en pantalla', aj_en_celu: 'en el celu', aj_juego: 'El juego',
    celu: 'Celu', celu_tecla: 'Celu (M)', celu_inicio: 'Inicio', celu_atras: 'Volver',
    app_amigos: 'Amigos', app_mensajes: 'Mensajes', app_juegos: 'Juegos', app_casas: 'Casas', app_perfil: 'Perfil', app_camara: 'Cámara', app_probador: 'Probador', app_tienda: 'Tienda', app_misiones: 'Misiones', app_ajustes: 'Ajustes',
    am_n_linea: '{n} amigos en línea', am_1_linea: '1 amigo en línea', am_0_linea: 'Ningún amigo en línea',
    am_t_lista: 'Amigos', am_t_sol: 'Solicitudes', am_t_agregar: 'Agregar',
    am_vacio: 'Todavía no tenés amigos. Pasale tu código a alguien, o agregá a los que están cerca.',
    am_desconectado: 'Desconectado', am_visto: 'Desconectado · {n}',
    am_en: 'En {n}', am_en_menu: 'En el menú', am_en_su_casa: 'En su casa', am_en_tu_casa: 'En tu casa',
    am_unirse: 'Unirse', am_unirse_a: 'Unirse a {n}', am_mensaje: 'Mensaje', am_mensaje_a: 'Mensaje a {n}', am_ver: 'Ver a {n}',
    am_recibidas: 'Te quieren agregar', am_enviadas: 'Enviadas', am_ninguna_sol: 'No hay solicitudes por ahora.',
    am_aceptar: 'Aceptar', am_aceptar_a: 'Aceptar a {n}', am_rechazar: 'Rechazar', am_rechazar_a: 'Rechazar a {n}', am_cancelar: 'Cancelar', am_cancelar_a: 'Cancelar la solicitud a {n}',
    am_esperando: 'Esperando respuesta', am_esperando_red: 'Le llega cuando se conecte',
    am_tu_codigo: 'Tu código de amigo', am_copiar: 'Copiar', am_copiado: 'Código copiado', am_compartir: 'Compartir', am_compartir_txt: '¡Agregame de amigo en AEROPLAZA! Mi código: {n}',
    am_codigo_de: 'El código de tu amigo', am_mandar: 'Mandar', am_mandar_sol: 'Mandar solicitud', am_cerca: 'Cerca de vos', am_nadie_cerca: 'No hay nadie más en esta sala.', am_agregar: 'Agregar', am_agregar_a: 'Agregar a {n}',
    am_ya: 'Amigos', am_enviada: 'Enviada', am_encontrado: 'Es {n}',
    am_r_mal: 'Ese código no sirve: son 12 letras y números', am_r_vos: 'Ese es tu propio código 🙂', am_r_ya: 'Ya son amigos', am_r_lleno: 'Llegaste al máximo de {n} amigos', am_r_bloqueado: 'Lo tenés bloqueado: desbloquealo en Perfil',
    am_r_enviada: 'Solicitud enviada', am_r_buscando: 'Solicitud lista: le llega cuando se conecte', am_r_aceptada: '¡Ahora son amigos!', am_r_sin_llave: 'Los amigos no andan en esta página',
    n_solicitud: 'Solicitud de amistad', n_solicitud_txt: '{n} te quiere agregar', n_acepto: '¡Nuevo amigo!', n_acepto_txt: '{n} aceptó tu solicitud', n_amigos_txt: 'Ahora sos amigo de {n}', n_conecto: '{n} se conectó', n_conecto_txt: 'Tu amigo está en línea',
    pf_codigo: 'Código {n}', pf_desde: 'Amigos desde el {n}', pf_quitar: 'Quitar de amigos', pf_quitar_seguro: '¿Quitar a {n} de tus amigos?', pf_bloquear: 'Bloquear', pf_bloquear_seguro: '¿Bloquear a {n}? No te va a poder mandar solicitudes ni mensajes.',
    pf_editar: 'Editar mi muñeco', pf_amigos: '{n} amigos', pf_op_pedidos: 'Me pueden mandar solicitudes', pf_todos: 'Todos', pf_nadie: 'Nadie', pf_op_avisos: 'Avisar cuando se conecta un amigo', pf_bloqueados: 'Bloqueados', pf_desbloquear: 'Desbloquear', pf_desbloquear_a: 'Desbloquear a {n}', pf_ninguno_bloq: 'No bloqueaste a nadie.',
    msg_vacio: 'Todavía no hay mensajes. Escribile a un amigo desde Amigos.', msg_poner: 'Escribí un mensaje…', msg_enviar: 'Enviar', msg_visto: 'Visto', msg_enviado: 'Enviado', msg_no_amigos: 'Ya no son amigos: no se pueden mandar mensajes.', msg_empieza: 'Acá empieza tu charla con {n}. Va cifrada: solo la leen ustedes dos.', msg_vos: 'Vos: {n}', msg_escribir_a: 'Escribirle a {n}',
    jg_jugando: '{n} jugando', jg_amigos: '{n} amigos acá', jg_1_amigo: '1 amigo acá', jg_ir: 'Ir a {n}', jg_estas: 'Estás acá',
    cs_vacio: 'No hay casas abiertas: una casa se abre cuando su dueño está adentro.', cs_mia: 'Ir a mi casa', cs_amigo: 'de tu amigo',
    celu_sin_llave: 'Los amigos necesitan una página segura (https) y esta no lo es. Todo lo demás anda igual.', celu_sin_red: 'Sin conexión: los amigos y los mensajes llegan cuando vuelva internet.',
    am_sala_llena: 'La sala de {n} está llena: vas a otra del mismo lugar', am_ya_estas: 'Ya estás con {n}', am_no_se_puede: '{n} está en el menú: no hay sala para unirse',
    cel_ahora: 'recién', cel_min: 'hace {n} min', cel_h: 'hace {n} h', cel_d: 'hace {n} d', seguro_si: 'Sí', seguro_no: 'No',
  },
  en: {
    app_construir: 'Build', app_gestos: 'Emotes', app_musica: 'Music', app_mapa: 'Map', app_voz: 'Voice', app_estilo: 'Style', ap_prendida: 'on', app_ajustes_juego: 'Game options', aj_botones: 'Buttons on screen', aj_botones_d: 'The ones turned off stay stored here in the phone: use them from their apps.', aj_chat: 'Chat', aj_voz: 'Voice', aj_misiones: 'Quests', aj_estilo: 'Style', aj_barra: 'Hotbar 1-5', aj_en_pantalla: 'on screen', aj_en_celu: 'in the phone', aj_juego: 'The game',
    celu: 'Phone', celu_tecla: 'Phone (M)', celu_inicio: 'Home', celu_atras: 'Back',
    app_amigos: 'Friends', app_mensajes: 'Messages', app_juegos: 'Games', app_casas: 'Houses', app_perfil: 'Profile', app_camara: 'Camera', app_probador: 'Wardrobe', app_tienda: 'Shop', app_misiones: 'Quests', app_ajustes: 'Settings',
    am_n_linea: '{n} friends online', am_1_linea: '1 friend online', am_0_linea: 'No friends online',
    am_t_lista: 'Friends', am_t_sol: 'Requests', am_t_agregar: 'Add',
    am_vacio: 'No friends yet. Give someone your code, or add the people nearby.',
    am_desconectado: 'Offline', am_visto: 'Offline · {n}',
    am_en: 'In {n}', am_en_menu: 'In the menu', am_en_su_casa: 'At their house', am_en_tu_casa: 'At your house',
    am_unirse: 'Join', am_unirse_a: 'Join {n}', am_mensaje: 'Message', am_mensaje_a: 'Message {n}', am_ver: 'See {n}',
    am_recibidas: 'Want to add you', am_enviadas: 'Sent', am_ninguna_sol: 'No requests for now.',
    am_aceptar: 'Accept', am_aceptar_a: 'Accept {n}', am_rechazar: 'Decline', am_rechazar_a: 'Decline {n}', am_cancelar: 'Cancel', am_cancelar_a: 'Cancel the request to {n}',
    am_esperando: 'Waiting for an answer', am_esperando_red: 'They get it when they connect',
    am_tu_codigo: 'Your friend code', am_copiar: 'Copy', am_copiado: 'Code copied', am_compartir: 'Share', am_compartir_txt: 'Add me as a friend in AEROPLAZA! My code: {n}',
    am_codigo_de: "Your friend's code", am_mandar: 'Send', am_mandar_sol: 'Send request', am_cerca: 'Near you', am_nadie_cerca: 'Nobody else in this room.', am_agregar: 'Add', am_agregar_a: 'Add {n}',
    am_ya: 'Friends', am_enviada: 'Sent', am_encontrado: "It's {n}",
    am_r_mal: "That code doesn't work: it's 12 letters and numbers", am_r_vos: "That's your own code 🙂", am_r_ya: 'You are already friends', am_r_lleno: 'You reached the maximum of {n} friends', am_r_bloqueado: 'You blocked them: unblock them in Profile',
    am_r_enviada: 'Request sent', am_r_buscando: 'Request ready: they get it when they connect', am_r_aceptada: 'You are friends now!', am_r_sin_llave: "Friends don't work on this page",
    n_solicitud: 'Friend request', n_solicitud_txt: '{n} wants to add you', n_acepto: 'New friend!', n_acepto_txt: '{n} accepted your request', n_amigos_txt: 'You are now friends with {n}', n_conecto: '{n} is online', n_conecto_txt: 'Your friend just connected',
    pf_codigo: 'Code {n}', pf_desde: 'Friends since {n}', pf_quitar: 'Unfriend', pf_quitar_seguro: 'Remove {n} from your friends?', pf_bloquear: 'Block', pf_bloquear_seguro: "Block {n}? They won't be able to send you requests or messages.",
    pf_editar: 'Edit my avatar', pf_amigos: '{n} friends', pf_op_pedidos: 'Who can send me requests', pf_todos: 'Everyone', pf_nadie: 'Nobody', pf_op_avisos: 'Tell me when a friend connects', pf_bloqueados: 'Blocked', pf_desbloquear: 'Unblock', pf_desbloquear_a: 'Unblock {n}', pf_ninguno_bloq: "You haven't blocked anyone.",
    msg_vacio: 'No messages yet. Write to a friend from Friends.', msg_poner: 'Write a message…', msg_enviar: 'Send', msg_visto: 'Seen', msg_enviado: 'Sent', msg_no_amigos: "You aren't friends anymore: messages can't be sent.", msg_empieza: 'This is the start of your chat with {n}. It is encrypted: only you two can read it.', msg_vos: 'You: {n}', msg_escribir_a: 'Write to {n}',
    jg_jugando: '{n} playing', jg_amigos: '{n} friends here', jg_1_amigo: '1 friend here', jg_ir: 'Go to {n}', jg_estas: "You're here",
    cs_vacio: 'No open houses: a house opens when its owner is inside.', cs_mia: 'Go to my house', cs_amigo: "your friend's",
    celu_sin_llave: "Friends need a secure page (https) and this one isn't. Everything else works the same.", celu_sin_red: 'Offline: friends and messages arrive when the internet is back.',
    am_sala_llena: "{n}'s room is full: you go to another one in the same place", am_ya_estas: "You're already with {n}", am_no_se_puede: "{n} is in the menu: there's no room to join",
    cel_ahora: 'just now', cel_min: '{n} min ago', cel_h: '{n} h ago', cel_d: '{n} d ago', seguro_si: 'Yes', seguro_no: 'No',
  },
  pt: {
    app_construir: 'Construir', app_gestos: 'Gestos', app_musica: 'Música', app_mapa: 'Mapa', app_voz: 'Voz', app_estilo: 'Estilo', ap_prendida: 'ligada', app_ajustes_juego: 'Opções do jogo', aj_botones: 'Botões na tela', aj_botones_d: 'Os desligados ficam guardados aqui no celular: use pelos apps.', aj_chat: 'Chat', aj_voz: 'Voz', aj_misiones: 'Missões', aj_estilo: 'Estilo', aj_barra: 'Barra 1-5', aj_en_pantalla: 'na tela', aj_en_celu: 'no celular', aj_juego: 'O jogo',
    celu: 'Celular', celu_tecla: 'Celular (M)', celu_inicio: 'Início', celu_atras: 'Voltar',
    app_amigos: 'Amigos', app_mensajes: 'Mensagens', app_juegos: 'Jogos', app_casas: 'Casas', app_perfil: 'Perfil', app_camara: 'Câmera', app_probador: 'Provador', app_tienda: 'Loja', app_misiones: 'Missões', app_ajustes: 'Ajustes',
    am_n_linea: '{n} amigos online', am_1_linea: '1 amigo online', am_0_linea: 'Nenhum amigo online',
    am_t_lista: 'Amigos', am_t_sol: 'Pedidos', am_t_agregar: 'Adicionar',
    am_vacio: 'Você ainda não tem amigos. Passe seu código para alguém, ou adicione quem está perto.',
    am_desconectado: 'Offline', am_visto: 'Offline · {n}',
    am_en: 'Em {n}', am_en_menu: 'No menu', am_en_su_casa: 'Na casa dele', am_en_tu_casa: 'Na sua casa',
    am_unirse: 'Entrar', am_unirse_a: 'Entrar com {n}', am_mensaje: 'Mensagem', am_mensaje_a: 'Mensagem para {n}', am_ver: 'Ver {n}',
    am_recibidas: 'Querem te adicionar', am_enviadas: 'Enviados', am_ninguna_sol: 'Nenhum pedido por enquanto.',
    am_aceptar: 'Aceitar', am_aceptar_a: 'Aceitar {n}', am_rechazar: 'Recusar', am_rechazar_a: 'Recusar {n}', am_cancelar: 'Cancelar', am_cancelar_a: 'Cancelar o pedido para {n}',
    am_esperando: 'Esperando resposta', am_esperando_red: 'Chega quando ele se conectar',
    am_tu_codigo: 'Seu código de amigo', am_copiar: 'Copiar', am_copiado: 'Código copiado', am_compartir: 'Compartilhar', am_compartir_txt: 'Me adicione como amigo no AEROPLAZA! Meu código: {n}',
    am_codigo_de: 'O código do seu amigo', am_mandar: 'Enviar', am_mandar_sol: 'Enviar pedido', am_cerca: 'Perto de você', am_nadie_cerca: 'Não tem mais ninguém nesta sala.', am_agregar: 'Adicionar', am_agregar_a: 'Adicionar {n}',
    am_ya: 'Amigos', am_enviada: 'Enviado', am_encontrado: 'É {n}',
    am_r_mal: 'Esse código não serve: são 12 letras e números', am_r_vos: 'Esse é o seu próprio código 🙂', am_r_ya: 'Vocês já são amigos', am_r_lleno: 'Você chegou ao máximo de {n} amigos', am_r_bloqueado: 'Você o bloqueou: desbloqueie em Perfil',
    am_r_enviada: 'Pedido enviado', am_r_buscando: 'Pedido pronto: chega quando ele se conectar', am_r_aceptada: 'Agora vocês são amigos!', am_r_sin_llave: 'Os amigos não funcionam nesta página',
    n_solicitud: 'Pedido de amizade', n_solicitud_txt: '{n} quer te adicionar', n_acepto: 'Novo amigo!', n_acepto_txt: '{n} aceitou seu pedido', n_amigos_txt: 'Agora você é amigo de {n}', n_conecto: '{n} está online', n_conecto_txt: 'Seu amigo se conectou',
    pf_codigo: 'Código {n}', pf_desde: 'Amigos desde {n}', pf_quitar: 'Desfazer amizade', pf_quitar_seguro: 'Tirar {n} dos seus amigos?', pf_bloquear: 'Bloquear', pf_bloquear_seguro: 'Bloquear {n}? Ele não vai poder te mandar pedidos nem mensagens.',
    pf_editar: 'Editar meu boneco', pf_amigos: '{n} amigos', pf_op_pedidos: 'Quem pode me mandar pedidos', pf_todos: 'Todos', pf_nadie: 'Ninguém', pf_op_avisos: 'Avisar quando um amigo se conectar', pf_bloqueados: 'Bloqueados', pf_desbloquear: 'Desbloquear', pf_desbloquear_a: 'Desbloquear {n}', pf_ninguno_bloq: 'Você não bloqueou ninguém.',
    msg_vacio: 'Ainda não há mensagens. Escreva para um amigo em Amigos.', msg_poner: 'Escreva uma mensagem…', msg_enviar: 'Enviar', msg_visto: 'Visto', msg_enviado: 'Enviado', msg_no_amigos: 'Vocês não são mais amigos: não dá para mandar mensagens.', msg_empieza: 'Aqui começa sua conversa com {n}. É criptografada: só vocês dois leem.', msg_vos: 'Você: {n}', msg_escribir_a: 'Escrever para {n}',
    jg_jugando: '{n} jogando', jg_amigos: '{n} amigos aqui', jg_1_amigo: '1 amigo aqui', jg_ir: 'Ir para {n}', jg_estas: 'Você está aqui',
    cs_vacio: 'Não há casas abertas: uma casa abre quando o dono está dentro.', cs_mia: 'Ir para minha casa', cs_amigo: 'do seu amigo',
    celu_sin_llave: 'Os amigos precisam de uma página segura (https) e esta não é. O resto funciona igual.', celu_sin_red: 'Sem conexão: os amigos e as mensagens chegam quando a internet voltar.',
    am_sala_llena: 'A sala de {n} está cheia: você vai para outra do mesmo lugar', am_ya_estas: 'Você já está com {n}', am_no_se_puede: '{n} está no menu: não há sala para entrar',
    cel_ahora: 'agora', cel_min: 'há {n} min', cel_h: 'há {n} h', cel_d: 'há {n} d', seguro_si: 'Sim', seguro_no: 'Não',
  },
});

/* los lugares públicos (se puede ir a la misma sala de un amigo) */
export const PUBLICOS = ['plaza', 'aqua', 'aurora', 'jardin', 'juegos'];
/* (vuelta 48: también los botones que antes estaban siempre en la pantalla: voz, misiones, estilo, gestos, música,
   mapa; y construir la casa) */
const APPS = [
  ['amigos', '👥', '#8fe6ff', '#1aa0d8'], ['mensajes', '💬', '#a8f59a', '#35b845'], ['juegos', '🎮', '#ffe08a', '#ff9f1a'], ['casas', '🏠', '#ffc2da', '#ff5f9a'],
  ['construir', '🔨', '#ffdcb0', '#ff8a2d'], ['perfil', '🙂', '#d6c8ff', '#7b5cff'], ['camara', '📷', '#eef2f5', '#8a9aa8'], ['gestos', '👋', '#fff0c2', '#f0ae00'],
  ['musica', '💿', '#e6dcff', '#8f6bff'], ['mapa', '🗺️', '#c9f7e0', '#1fae78'], ['voz', '🎤', '#ffd3de', '#ff4f7a'], ['misiones', '📜', '#fff0b8', '#e0a526'],
  ['probador', '👕', '#ffd0bf', '#ff7a59'], ['tienda', '💎', '#b8f6ff', '#15b8cc'], ['estilo', '👾', '#d6efff', '#3b8fe0'], ['ajustes', '⚙️', '#e6ebef', '#98a4ae'],
];
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
/* un botón con su texto y lo que lee el espejo del VR (aria-label) puestos a mano: nunca con innerHTML */
function boton(clase, ico, texto, dato, etiqueta) {
  const b = document.createElement('button'); b.type = 'button'; b.className = clase;
  if (ico) { const i = document.createElement('i'); i.textContent = ico; b.appendChild(i); }
  if (texto) { const s = document.createElement('span'); s.textContent = texto; b.appendChild(s); }
  for (const [k, v] of Object.entries(dato || {})) b.dataset[k] = v;
  if (etiqueta) b.setAttribute('aria-label', etiqueta);
  return b;
}
const txt = (tag, clase, s) => { const e = document.createElement(tag); if (clase) e.className = clase; e.textContent = s; return e; };
const COLOR = /^#[0-9a-f]{6}$/i;
let nAv = 0;
/* la cara de cada uno: el muñeco de gelatina chiquito, con sus colores (los colores ya vienen limpios: #rrggbb) */
export function avatar(A, tam = 40, enLinea = null) {
  const c = COLOR.test(A?.color || '') ? A.color : '#9aa4ad', c2 = COLOR.test(A?.color2 || '') ? A.color2 : '#e6f6ff', id = 'celav' + (++nAv);
  const s = el(`<span class="cel-av" style="width:${tam}px;height:${tam}px"><svg viewBox="0 0 40 40" aria-hidden="true"><defs><radialGradient id="${id}" cx=".35" cy=".28" r=".9"><stop offset="0" stop-color="#fff"/><stop offset=".38" stop-color="${c2}"/><stop offset="1" stop-color="${c}"/></radialGradient><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fbff"/><stop offset="1" stop-color="#cfeefc"/></linearGradient></defs><circle cx="20" cy="20" r="19.5" fill="url(#${id}f)"/><path d="M6.5 41 Q7 27 20 27 Q33 27 33.5 41Z" fill="url(#${id})"/><circle cx="20" cy="16" r="9.2" fill="url(#${id})"/><ellipse cx="16.6" cy="16.6" rx="1.35" ry="2.1" fill="#16222e"/><ellipse cx="23.4" cy="16.6" rx="1.35" ry="2.1" fill="#16222e"/><ellipse cx="16.8" cy="11.6" rx="3.2" ry="1.6" fill="#fff" opacity=".75"/></svg></span>`);
  if (enLinea != null) s.appendChild(el(`<i class="cel-punto ${enLinea ? 'si' : ''}"></i>`));
  return s;
}

export class Celu {
  /* J, UI (ui.js) y amigos (amigos.js); main.js le pasa unirseA(id) y viajar(id, o) */
  constructor({ J, UI, amigos, unirseA, viajar, abrirProbador, foto, construir }) {
    this.J = J; this.UI = UI; this.am = amigos; this.unirseA = unirseA; this.viajar = viajar; this.abrirProbador = abrirProbador; this.foto = foto; this.construir = construir;
    this.v = null; this.pila = ['inicio']; this.tab = 'lista'; this.seguro = null; this.resultado = null; this.codigo = '';
    this.alCambiar = () => {};
    setInterval(() => { if (this.abierto) this.relojito(); }, 15000);
  }
  get abierto() { return !!this.v && this.v.isConnected; }
  get aca() { return this.pila[this.pila.length - 1]; }

  /* ------------------------------------------------------------ abrir y cerrar */
  abrir(p = null) {
    const UI = this.UI, J = this.J;
    if (p) this.pila = p === 'inicio' ? ['inicio'] : ['inicio', p];
    this.seguro = null;
    const pie = `<div class="cel-nav"></div>`;
    const v = this.v = UI.ventana('📱 ' + t('celu'), document.createElement('div'), { pie, alCerrar: () => this.alCerrarse() });
    v.classList.add('velo-celu');
    const ven = v.querySelector('.ventana'); ven.classList.add('celu');
    ven.prepend(el('<div class="cel-estado"><b class="cel-hora"></b><span class="cel-senal"><i></i><i></i><i></i><i></i></span><span class="cel-bat"><i></i></span></div>'));
    ven.appendChild(el('<i class="cel-brillo" aria-hidden="true"></i>'));
    const nav = v.querySelector('.cel-nav');
    nav.append(boton('cel-nav-b', '◀', '', { c: 'atras' }, '◀ ' + t('celu_atras')), boton('cel-nav-b casita', '', '', { c: 'inicio' }, '⌂ ' + t('celu_inicio')), boton('cel-nav-b', '▾', '', { c: 'guardar' }, '✕ ' + t('cerrar')));
    this.caja = v.querySelector('.cuerpo'); this.caja.classList.add('cel-pantalla');
    /* todos los toques, de una (así el mosaico del espejo, que hace click(), anda igual) */
    ven.addEventListener('click', (e) => this.toque(e));
    ven.addEventListener('submit', (e) => { e.preventDefault(); this.enviarForm(e.target); });
    this.caja.addEventListener('input', (e) => { if (e.target.matches('.cel-cod')) this.escribiendoCodigo(e.target); });
    this.engancharTeclado();
    this.pintar();
    J.celuAbierto = true; J.ent.bloqueado = true; J.ent.mostrarDedos(false);
    this.alCambiar(true);
    J.sfx('entra');
  }
  alCerrarse() {
    Teclado.cerrar(true);
    this.v = null; const J = this.J; J.celuAbierto = false; J.ent.bloqueado = false;
    if (J.enJuego && !J.enVR) J.ent.mostrarDedos(true);
    this.alCambiar(false);
  }
  cerrar() { if (this.abierto) this.v.cerrar(); }
  alternar() { if (this.abierto) this.cerrar(); else this.abrir(); }
  ir(p) { this.seguro = null; this.resultado = null; if (p !== this.aca) this.pila.push(p); if (this.pila.length > 8) this.pila.splice(1, 1); this.pintar(); }
  atras() { if (this.seguro) { this.seguro = null; this.pintar(); return; } if (this.pila.length <= 1) { this.cerrar(); return; } this.pila.pop(); this.resultado = null; this.pintar(); }

  /* ------------------------------------------------------------ pintar */
  titulo() {
    const p = this.aca, [app, id] = p.split(':');
    if (app === 'inicio') return '📱 ' + t('celu');
    if (app === 'chat' || app === 'ver') return this.am.nombre(id);
    const a = APPS.find((q) => q[0] === app);
    return a ? a[1] + ' ' + t('app_' + app) : t('celu');
  }
  pintar() {
    if (!this.abierto) return;
    const c = this.caja, [app, id] = this.aca.split(':');
    this.v.querySelector('.cabeza h2').textContent = this.titulo();
    this.v.querySelector('.ventana').dataset.app = app;
    Teclado.cerrar(true);
    c.innerHTML = ''; c.scrollTop = 0;
    if (!this.am.listo && ['amigos', 'mensajes', 'chat', 'ver'].includes(app)) c.appendChild(txt('p', 'cel-nota', t('celu_sin_llave')));
    else if (app === 'inicio') this.inicio(c);
    else if (app === 'amigos') this.amigos(c);
    else if (app === 'mensajes') this.mensajes(c);
    else if (app === 'chat') this.charla(c, id);
    else if (app === 'ver') this.perfilDe(c, id);
    else if (app === 'juegos') this.juegos(c);
    else if (app === 'casas') this.casas(c);
    else if (app === 'perfil') this.perfil(c);
    else if (app === 'ajustes') this.ajustes(c);
    if (this.seguro) this.pintarSeguro(c);
    this.relojito();
    c.animate([{ opacity: 0, transform: 'translateY(8px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  }
  /* lo que cambió afuera (llegó una carta, alguien se conectó): se vuelve a pintar sin perder lo que se está escribiendo */
  refrescar() {
    this.insignia();
    if (!this.abierto || this.seguro) return;
    const [app, id] = this.aca.split(':');
    if (app === 'chat') { this.pintarMensajes(id); this.am.leer(id); return; }
    const inp = this.caja.querySelector('input'), valor = inp?.value, foco = document.activeElement === inp, scroll = this.caja.scrollTop;
    if (Teclado.abierto) return;   // (con el teclado propio abierto, se espera: si no, se cerraría)
    this.caja.innerHTML = '';
    ({ inicio: () => this.inicio(this.caja), amigos: () => this.amigos(this.caja), mensajes: () => this.mensajes(this.caja), ver: () => this.perfilDe(this.caja, id), juegos: () => this.juegos(this.caja), casas: () => this.casas(this.caja), perfil: () => this.perfil(this.caja), ajustes: () => this.ajustes(this.caja) })[app]?.();
    const n = this.caja.querySelector('input');
    if (n && valor != null) { n.value = valor; if (foco) n.focus(); }
    this.caja.scrollTop = scroll;
    this.v.querySelector('.cabeza h2').textContent = this.titulo();
    this.relojito();
  }
  /* (lo que cambia seguido, cuánta gente hay en cada lugar: como mucho cada 1,5 s y solo donde se ve) */
  refrescarPronto() {
    if (!this.abierto || this._tr) return;
    this._tr = setTimeout(() => { this._tr = null; const app = this.aca.split(':')[0]; if (['juegos', 'casas', 'inicio'].includes(app) || (app === 'amigos' && this.tab === 'agregar')) this.refrescar(); }, 1500);
  }
  relojito() {
    if (!this.abierto) return;
    const d = new Date(), h = d.toLocaleTimeString(idioma(), { hour: '2-digit', minute: '2-digit', hour12: this.J.G.opciones.reloj24 === false });
    this.v.querySelector('.cel-hora').textContent = h;
    const r = this.J.red.estado; this.v.querySelector('.cel-senal').dataset.r = r;
    const w = this.caja.querySelector('.cel-reloj'); if (w) w.textContent = h;
  }
  /* el globito rojo del 📱 del HUD y de las apps: solicitudes y mensajes sin leer */
  insignia() {
    /* (con el 📜 guardado en el celu, las misiones listas también suman acá) */
    const H = { ...HUD_INICIAL, ...(this.J.G.opciones.hud || {}) }, listas = H.misiones ? 0 : this.J.misiones.activas().filter((m) => m.e === 'lista').length;
    const n = (this.am.listo ? this.am.recibidas + this.am.sinLeer : 0) + listas, b = this.UI.hud?.querySelector('[data-a=celu]');
    if (b) { const i = b.querySelector('.insignia'); i.textContent = n > 99 ? '99+' : n || ''; b.classList.toggle('con', n > 0); }
  }

  /* ------------------------------------------------------------ las pantallas */
  inicio(c) {
    const f = document.createElement('div'); f.className = 'cel-inicio';
    const w = el('<div class="cel-widget"><b class="cel-reloj"></b><small class="cel-fecha"></small><span class="cel-linea"></span></div>');
    w.querySelector('.cel-fecha').textContent = new Date().toLocaleDateString(idioma(), { weekday: 'long', day: 'numeric', month: 'long' });
    const n = this.am.listo ? this.am.lista('amigo').filter((q) => this.am.donde(q.id)).length : 0;
    const sinRed = this.J.red.estado !== 'en_linea';
    w.querySelector('.cel-linea').textContent = sinRed ? '⚪ ' + t('sin_red') : (n ? '🟢 ' : '⚪ ') + (n === 1 ? t('am_1_linea') : n ? t('am_n_linea', { n }) : t('am_0_linea'));
    f.appendChild(w);
    const g = document.createElement('div'); g.className = 'cel-apps';
    for (const [id, ico, c1, c2] of APPS) {
      const b = boton('cel-app', '', t('app_' + id), { app: id }, ico + ' ' + t('app_' + id));
      const i = document.createElement('i'); i.className = 'cel-ico'; i.style.setProperty('--c1', c1); i.style.setProperty('--c2', c2); i.textContent = ico;
      const nb = id === 'amigos' ? this.am.recibidas : id === 'mensajes' ? this.am.sinLeer : id === 'misiones' ? this.J.misiones.activas().filter((m) => m.e === 'lista').length : 0;
      if (nb && (this.am.listo || id === 'misiones')) i.appendChild(txt('em', 'cel-badge', nb > 99 ? '99+' : String(nb)));
      /* (la voz prendida: un puntito rojo, como un micrófono que graba) */
      if (id === 'voz' && this.J.voz?.activa) { i.appendChild(txt('em', 'cel-badge vivo', '●')); b.setAttribute('aria-label', ico + ' ' + t('app_voz') + ' · ' + t('ap_prendida')); }
      b.prepend(i); g.appendChild(b);
    }
    f.appendChild(g);
    if (this.J.red.estado !== 'en_linea') w.appendChild(txt('p', 'cel-nota chica', t('celu_sin_red')));
    c.appendChild(f);
  }
  /* dónde está un amigo, dicho lindo (null: desconectado) */
  lugar(id) {
    const v = this.am.donde(id); if (!v) return null;
    if (!v.sala) return t('am_en_menu');
    if (v.reino === 'casa') { const d = v.sala.slice(5); return d === id ? t('am_en_su_casa') : d === this.J.id ? t('am_en_tu_casa') : t('am_en', { n: t('reino_casa_de', { n: this.am.nombre(d) }) }); }
    const r = ['parkour', 'tiro', 'runner'].includes(v.reino) ? 'juegos' : v.reino === 'interior' ? 'plaza' : v.reino;
    return t('am_en', { n: t('reino_' + r) });
  }
  hace(ms) {
    if (!ms) return t('am_desconectado');
    const s = (Date.now() - ms) / 1000;
    const x = s < 90 ? t('cel_ahora') : s < 3600 ? t('cel_min', { n: Math.round(s / 60) }) : s < 86400 ? t('cel_h', { n: Math.round(s / 3600) }) : t('cel_d', { n: Math.round(s / 86400) });
    return t('am_visto', { n: x });
  }
  /* una fila con la cara y el nombre (tocarla abre su perfil) y sus botones a la derecha */
  fila(id, a, linea, botones = [], { enLinea = null, ver = true } = {}) {
    const f = document.createElement('div'); f.className = 'cel-fila';
    const nombre = a?.nombre || this.am.nombre(id);
    const q = boton('cel-quien', '', '', ver ? { ver: id } : {}, t('am_ver', { n: nombre }) + (linea ? ' · ' + linea : ''));
    if (!ver) q.disabled = true;
    q.appendChild(avatar(a?.A, 38, enLinea));
    const tx = document.createElement('span'); tx.className = 'cel-txt'; tx.append(txt('b', '', nombre), txt('small', '', linea || ''));
    q.appendChild(tx); f.appendChild(q);
    for (const b of botones) f.appendChild(b);
    return f;
  }
  amigos(c) {
    const am = this.am, rec = am.recibidas;
    const tabs = document.createElement('div'); tabs.className = 'cel-tabs';
    /* (en el celu angosto queda el ícono con el número: el nombre sigue en el aria-label) */
    for (const [k, ico, n, cuenta] of [['lista', '👥', t('am_t_lista'), am.cuantos], ['sol', '📨', t('am_t_sol'), rec], ['agregar', '➕', t('am_t_agregar'), null]]) {
      const b = boton('cel-tab' + (this.tab === k ? ' si' : '') + (k === 'sol' && rec ? ' alerta' : ''), ico, n, { tab: k }, n + (cuenta ? ' ' + cuenta : ''));
      if (cuenta != null && (cuenta || k === 'lista')) b.appendChild(txt('b', 'cel-tab-n', String(cuenta)));
      tabs.appendChild(b);
    }
    c.appendChild(tabs);
    const L = document.createElement('div'); L.className = 'cel-lista'; c.appendChild(L);
    if (this.tab === 'lista') {
      const l = am.lista('amigo').map((q) => ({ ...q, v: am.donde(q.id) })).sort((x, y) => (!!y.v - !!x.v) || (y.a.visto || 0) - (x.a.visto || 0) || x.a.nombre.localeCompare(y.a.nombre));
      if (!l.length) { L.appendChild(txt('p', 'cel-nota', t('am_vacio'))); L.appendChild(boton('cel-b primario ancho', '+', t('am_t_agregar'), { tab: 'agregar' })); }
      for (const q of l) {
        const lug = this.lugar(q.id), bs = [];
        if (q.v && q.v.sala) bs.push(boton('cel-b primario', '▶', t('am_unirse'), { unirse: q.id }, '▶ ' + t('am_unirse_a', { n: q.a.nombre })));
        const nl = am.noLeidos(q.id), bm = boton('cel-b redondito', '💬', '', { chat: q.id }, '💬 ' + t('am_mensaje_a', { n: q.a.nombre }));
        if (nl) bm.appendChild(txt('em', 'cel-badge', String(nl)));
        bs.push(bm);
        L.appendChild(this.fila(q.id, q.a, lug ? '🟢 ' + lug : this.hace(q.a.visto), bs, { enLinea: !!q.v }));
      }
    } else if (this.tab === 'sol') {
      const r = am.lista('recibida'), e = am.lista('enviada');
      if (!r.length && !e.length) L.appendChild(txt('p', 'cel-nota', t('am_ninguna_sol')));
      if (r.length) L.appendChild(txt('h3', '', t('am_recibidas') + ' · ' + r.length));
      for (const q of r) L.appendChild(this.fila(q.id, q.a, t('pf_codigo', { n: codigoLindo(q.id) }), [boton('cel-b primario', '✓', t('am_aceptar'), { aceptar: q.id }, '✓ ' + t('am_aceptar_a', { n: q.a.nombre })), boton('cel-b redondito', '✕', '', { rechazar: q.id }, '✕ ' + t('am_rechazar_a', { n: q.a.nombre }))]));
      if (e.length) L.appendChild(txt('h3', '', t('am_enviadas') + ' · ' + e.length));
      for (const q of e) L.appendChild(this.fila(q.id, q.a, q.a.pub ? t('am_esperando') : t('am_esperando_red'), [boton('cel-b', '', t('am_cancelar'), { cancelar: q.id }, t('am_cancelar_a', { n: q.a.nombre || q.id }))]));
    } else this.agregar(L);
  }
  agregar(L) {
    const am = this.am;
    const cod = el(`<div class="cel-codigo"><small></small><b></b><div class="cel-fila-b"></div></div>`);
    cod.querySelector('small').textContent = t('am_tu_codigo'); cod.querySelector('b').textContent = codigoLindo(this.J.id);
    cod.querySelector('.cel-fila-b').append(boton('cel-b', '📋', t('am_copiar'), { c: 'copiar' }), ...(navigator.share ? [boton('cel-b', '📤', t('am_compartir'), { c: 'compartir' })] : []));
    L.appendChild(cod);
    const f = el(`<form class="cel-form"><input class="cel-cod" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send"></form>`);
    const i = f.querySelector('input'); i.placeholder = t('am_codigo_de'); i.value = this.codigo;
    f.appendChild(boton('cel-b primario', '➤', t('am_mandar'), { c: 'pedir' }, '➤ ' + t('am_mandar_sol')));
    f.lastElementChild.type = 'submit';
    L.appendChild(f);
    L.appendChild(txt('p', 'cel-res', '')); this.pintarRes();
    L.appendChild(txt('h3', '', t('am_cerca')));
    const cerca = [...this.J.remotos.m.values()].filter((r) => ID_RE.test(r.id));
    if (!cerca.length) L.appendChild(txt('p', 'cel-nota chica', t('am_nadie_cerca')));
    for (const r of cerca) {
      const e = am.estado(r.id), a = am.A[r.id] || { nombre: r.name, A: r.A };
      /* (solo se le puede pedir al que tiene llave: su perfil tiene que estar en el broker. Uno con un juego de antes
         de los amigos no lo tiene, y su id va a cambiar cuando se actualice) */
      const conPerfil = e !== 'nada' || am.buscar(r.id)?.encontrado;
      const b = e === 'amigo' ? txt('span', 'cel-etq', '✓ ' + t('am_ya')) : e === 'enviada' ? txt('span', 'cel-etq', t('am_enviada')) : e === 'recibida' ? boton('cel-b primario', '✓', t('am_aceptar'), { aceptar: r.id }, '✓ ' + t('am_aceptar_a', { n: r.name }))
        : e === 'bloqueado' ? txt('span', 'cel-etq', '⛔') : !conPerfil ? txt('span', 'cel-etq', '…') : boton('cel-b primario', '+', t('am_agregar'), { pedir: r.id, nombre: r.name }, '+ ' + t('am_agregar_a', { n: r.name }));
      L.appendChild(this.fila(r.id, { ...a, nombre: a.nombre || r.name, A: a.A || r.A }, '', [b], { ver: e !== 'nada' && e !== 'bloqueado' }));
    }
  }
  escribiendoCodigo(i) {
    this.codigo = i.value; this.resultado = null;
    const k = leerCodigo(i.value);
    if (ID_RE.test(k) && k !== this.J.id) this.am.buscar(k);
    this.pintarRes();
  }
  /* abajo del código: lo que pasó con la última, o quién es el del código (su perfil, si ya llegó) */
  pintarRes() {
    const res = this.caja?.querySelector('.cel-res'); if (!res) return;
    const k = leerCodigo(this.codigo), b = ID_RE.test(k) ? this.am.buscando.get(k) : null;
    res.textContent = ''; res.className = 'cel-res';
    if (this.resultado) { res.textContent = this.resultado.texto; res.classList.add(this.resultado.bien ? 'bien' : 'mal'); }
    else if (b?.encontrado) { res.append(avatar(b.A, 26), document.createTextNode(' ' + t('am_encontrado', { n: b.nombre || k }))); res.classList.add('bien'); }
  }
  mensajes(c) {
    const am = this.am, l = am.lista('amigo').filter((q) => q.a.charla?.length).sort((x, y) => (y.a.charla.at(-1).t) - (x.a.charla.at(-1).t));
    if (!l.length) { c.appendChild(txt('p', 'cel-nota', t('msg_vacio'))); c.appendChild(boton('cel-b primario ancho', '👥', t('app_amigos'), { app: 'amigos' })); return; }
    const L = document.createElement('div'); L.className = 'cel-lista'; c.appendChild(L);
    for (const q of l) {
      const u = q.a.charla.at(-1), nl = am.noLeidos(q.id);
      const f = this.fila(q.id, q.a, u.yo ? t('msg_vos', { n: u.x }) : u.x, [], { enLinea: !!am.donde(q.id) });
      const b = f.querySelector('.cel-quien'); b.dataset.chat = q.id; delete b.dataset.ver; b.setAttribute('aria-label', '💬 ' + q.a.nombre + (nl ? ` (${nl})` : ''));
      f.appendChild(txt('small', 'cel-cuando', this.hora(u.t)));
      if (nl) { f.classList.add('nuevo'); f.appendChild(txt('em', 'cel-badge', String(nl))); }
      L.appendChild(f);
    }
  }
  hora(ms) {
    const d = new Date(ms), hoy = new Date();
    return d.toDateString() === hoy.toDateString() ? d.toLocaleTimeString(idioma(), { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(idioma(), { day: 'numeric', month: 'short' });
  }
  charla(c, id) {
    const a = this.am.A[id];
    const cab = el('<div class="cel-charla-cab"></div>');
    cab.appendChild(boton('cel-quien chico', '', '', { ver: id }, t('am_ver', { n: this.am.nombre(id) })));
    cab.firstChild.append(avatar(a?.A, 30, !!this.am.donde(id)), txt('span', '', this.lugar(id) ? '🟢 ' + this.lugar(id) : this.hace(a?.visto)));
    c.appendChild(cab);
    c.appendChild(el('<div class="cel-msgs" role="log"></div>'));
    if (this.am.estado(id) === 'amigo') {
      const f = el(`<form class="cel-escribir"><input class="cel-texto" maxlength="${MAX_TXT}" autocomplete="off" enterkeyhint="send"></form>`);
      f.querySelector('input').placeholder = t('msg_poner');
      const b = boton('cel-b primario redondito', '➤', '', { c: 'enviar' }, '➤ ' + t('msg_enviar')); b.type = 'submit'; f.appendChild(b);
      c.appendChild(f);
    } else c.appendChild(txt('p', 'cel-nota chica', t('msg_no_amigos')));
    this.pintarMensajes(id);
    this.am.leer(id);
  }
  pintarMensajes(id) {
    const L = this.caja.querySelector('.cel-msgs'); if (!L) return;
    const a = this.am.A[id], ch = a?.charla || [];
    L.innerHTML = '';
    L.appendChild(txt('p', 'cel-nota chica', t('msg_empieza', { n: this.am.nombre(id) })));
    let dia = '';
    for (const m of ch) {
      const d = new Date(m.t).toLocaleDateString(idioma(), { day: 'numeric', month: 'long' });
      if (d !== dia) { dia = d; L.appendChild(txt('small', 'cel-dia', d)); }
      const g = txt('div', 'cel-globo ' + (m.yo ? 'mio' : 'suyo'), m.x);
      g.appendChild(txt('small', '', new Date(m.t).toLocaleTimeString(idioma(), { hour: '2-digit', minute: '2-digit' })));
      L.appendChild(g);
    }
    const ult = [...ch].reverse().find((m) => m.yo);
    if (ult && ch.at(-1) === ult) L.appendChild(txt('small', 'cel-visto', (a.vio || 0) >= ult.n ? '✓✓ ' + t('msg_visto') : '✓ ' + t('msg_enviado')));
    L.scrollTop = L.scrollHeight;
  }
  perfilDe(c, id) {
    const am = this.am, a = am.A[id] || { nombre: am.nombre(id), A: am.buscando.get(id)?.A }, e = am.estado(id), v = am.donde(id);
    const p = el('<div class="cel-perfil"></div>');
    p.appendChild(avatar(a.A, 86, e === 'amigo' ? !!v : null));
    p.append(txt('b', 'cel-nombre', a.nombre || id), txt('small', 'cel-codigo-chico', t('pf_codigo', { n: codigoLindo(id) })));
    if (e === 'amigo') {
      const lug = this.lugar(id); p.appendChild(txt('span', 'cel-donde' + (lug ? ' si' : ''), lug ? '🟢 ' + lug : this.hace(a.visto)));
      if (a.desde) p.appendChild(txt('small', '', t('pf_desde', { n: new Date(a.desde).toLocaleDateString(idioma(), { day: 'numeric', month: 'long', year: 'numeric' }) })));
    }
    const dos = el('<div class="cel-dos"><div class="cel-col"></div><div class="cel-col"></div></div>'), [izq, der] = dos.children;
    c.appendChild(dos); izq.appendChild(p); c = der;
    const acc = el('<div class="cel-acciones"></div>');
    if (e === 'amigo') {
      if (v && v.sala) acc.appendChild(boton('cel-b primario', '▶', t('am_unirse'), { unirse: id }, '▶ ' + t('am_unirse_a', { n: a.nombre })));
      acc.appendChild(boton('cel-b primario', '💬', t('am_mensaje'), { chat: id }, '💬 ' + t('am_mensaje_a', { n: a.nombre })));
    } else if (e === 'recibida') acc.append(boton('cel-b primario', '✓', t('am_aceptar'), { aceptar: id }, '✓ ' + t('am_aceptar_a', { n: a.nombre })), boton('cel-b', '✕', t('am_rechazar'), { rechazar: id }, '✕ ' + t('am_rechazar_a', { n: a.nombre })));
    else if (e === 'enviada') acc.appendChild(boton('cel-b', '', t('am_cancelar'), { cancelar: id }, t('am_cancelar_a', { n: a.nombre })));
    else if (e === 'bloqueado') acc.appendChild(boton('cel-b', '', t('pf_desbloquear'), { desbloquear: id }, t('pf_desbloquear_a', { n: a.nombre || id })));
    else acc.appendChild(boton('cel-b primario', '+', t('am_agregar'), { pedir: id, nombre: a.nombre || '' }, '+ ' + t('am_agregar_a', { n: a.nombre || id })));
    c.appendChild(acc);
    if (e !== 'bloqueado') {
      const pel = el('<div class="cel-acciones peligro"></div>');
      if (e === 'amigo') pel.appendChild(boton('cel-b peligro', '', t('pf_quitar'), { quitar: id }));
      pel.appendChild(boton('cel-b peligro', '⛔', t('pf_bloquear'), { bloquear: id }));
      c.appendChild(pel);
    }
  }
  /* (como la portada de Roblox: cada lugar con cuánta gente hay y cuáles de tus amigos) */
  juegos(c) {
    const R = this.J.red, am = this.am, g = document.createElement('div'); g.className = 'cel-juegos';
    const amigosEn = (r) => am.listo ? am.lista('amigo').filter((q) => { const v = am.donde(q.id); return v && (v.reino === r || (r === 'juegos' && ['parkour', 'tiro', 'runner'].includes(v.reino)) || (r === 'plaza' && v.reino === 'interior')); }) : [];
    for (const [id, emo, fondo] of REINOS) {
      if (id === 'casa') continue;
      const n = R.cuantosEn(id) + (id === 'juegos' ? R.cuantosEn('parkour') + R.cuantosEn('tiro') + R.cuantosEn('runner') : 0), af = amigosEn(id), aca = this.J.reinoId === id;
      const b = boton('cel-juego' + (aca ? ' aca' : ''), '', '', { ir: id }, emo + ' ' + t('jg_ir', { n: t('reino_' + id) }) + (af.length ? ' · ' + (af.length === 1 ? t('jg_1_amigo') : t('jg_amigos', { n: af.length })) : ''));
      b.style.background = fondo;
      b.append(txt('i', 'cel-juego-emo', emo), txt('b', '', t('reino_' + id)), txt('small', '', aca ? t('jg_estas') : R.estado === 'en_linea' ? '👤 ' + t('jg_jugando', { n }) : ''));
      if (af.length) { const caras = document.createElement('span'); caras.className = 'cel-caras'; for (const q of af.slice(0, 4)) caras.appendChild(avatar(q.a.A, 22)); b.appendChild(caras); }
      g.appendChild(b);
    }
    c.appendChild(g);
  }
  casas(c) {
    const R = this.J.red, am = this.am;
    c.appendChild(boton('cel-b primario ancho', '🏡', t('cs_mia'), { ir: 'casa' }));
    const l = R.casasAbiertas().filter((q) => q.id !== this.J.id).sort((x, y) => ((am.estado(y.id) === 'amigo') - (am.estado(x.id) === 'amigo')) || y.gente - x.gente);
    if (!l.length) { c.appendChild(txt('p', 'cel-nota', t('cs_vacio'))); return; }
    const L = document.createElement('div'); L.className = 'cel-lista'; c.appendChild(L);
    for (const q of l) {
      const amigo = am.estado(q.id) === 'amigo', nombre = t('reino_casa_de', { n: q.nombre });
      const f = this.fila(q.id, am.A[q.id] || { nombre: q.nombre }, '👤 ' + t('jugadores', { n: q.gente }) + (amigo ? ' · ⭐ ' + t('cs_amigo') : ''), [boton('cel-b primario', '▶', '', { casa: q.id, nombre: q.nombre }, '🏠 ' + nombre)], { ver: amigo });
      f.querySelector('.cel-txt b').textContent = nombre;
      L.appendChild(f);
    }
  }
  perfil(c) {
    const G = this.J.G, am = this.am;
    const p = el('<div class="cel-perfil yo"></div>');
    p.appendChild(avatar(G.A, 86));
    p.append(txt('b', 'cel-nombre', G.nombre));
    if (am.listo) p.appendChild(txt('small', 'cel-codigo-chico', t('pf_codigo', { n: codigoLindo(this.J.id) })));
    p.appendChild(txt('span', 'cel-cifras', `👥 ${t('pf_amigos', { n: am.cuantos })} · 🫧 ${G.orbes} · 💎 ${G.joyas || 0}`));
    const dos = el('<div class="cel-dos"><div class="cel-col"></div><div class="cel-col"></div></div>'), [izq, der] = dos.children;
    c.appendChild(dos); izq.appendChild(p); c = der;
    const acc = el('<div class="cel-acciones"></div>');
    acc.appendChild(boton('cel-b primario', '👕', t('pf_editar'), { app: 'probador' }));
    if (am.listo) acc.appendChild(boton('cel-b', '📋', t('am_copiar'), { c: 'copiar' }));
    izq.appendChild(acc);
    if (!am.listo) return;
    const op = (etq, opciones, actual, dato) => {
      const f = el('<div class="cel-op"><span></span><div class="cel-seg"></div></div>'); f.firstChild.textContent = etq;
      for (const [v, x] of opciones) f.lastChild.appendChild(boton(actual === v ? 'si' : '', '', x, { [dato]: v }, etq + ': ' + x));
      return f;
    };
    c.appendChild(op(t('pf_op_pedidos'), [['todos', t('pf_todos')], ['nadie', t('pf_nadie')]], G.amigosOp.pedidos, 'pedidos'));
    c.appendChild(op(t('pf_op_avisos'), [['si', t('seguro_si')], ['no', t('seguro_no')]], G.amigosOp.avisos ? 'si' : 'no', 'avisos'));
    c.appendChild(txt('h3', '', t('pf_bloqueados')));
    if (!G.bloqueados.length) c.appendChild(txt('p', 'cel-nota chica', t('pf_ninguno_bloq')));
    for (const id of G.bloqueados) {
      const n = am.A[id]?.nombre || id;
      c.appendChild(this.fila(id, am.A[id] || { nombre: n }, t('pf_codigo', { n: codigoLindo(id) }), [boton('cel-b', '', t('pf_desbloquear'), { desbloquear: id }, t('pf_desbloquear_a', { n }))], { ver: false }));
    }
  }
  /* (vuelta 48) los ajustes del celu: qué botones quedan en la pantalla (los demás, acá) y las opciones del juego */
  ajustes(c) {
    const G = this.J.G, H = { ...HUD_INICIAL, ...(G.opciones.hud || {}) };
    c.appendChild(txt('h3', '', t('aj_botones')));
    c.appendChild(txt('p', 'cel-nota chica izq', t('aj_botones_d')));
    const L = document.createElement('div'); L.className = 'cel-botones';
    for (const [k, ico] of [['chat', '💬'], ['voz', '🎤'], ['misiones', '📜'], ['estilo', '👾'], ['barra', '🎒']]) {
      const b = boton('cel-chip' + (H[k] ? ' si' : ''), ico, t('aj_' + k), { hud: k }, ico + ' ' + t('aj_' + k) + ': ' + (H[k] ? t('aj_en_pantalla') : t('aj_en_celu')));
      b.appendChild(txt('small', '', H[k] ? t('aj_en_pantalla') : t('aj_en_celu')));
      L.appendChild(b);
    }
    c.appendChild(L);
    c.appendChild(txt('h3', '', t('aj_juego')));
    const acc = el('<div class="cel-acciones"></div>');
    acc.append(boton('cel-b primario', '⚙️', t('app_ajustes_juego'), { app: 'opciones' }), boton('cel-b', '🎮', t('canal_controles'), { app: 'controles' }));
    c.appendChild(acc);
  }
  /* el "¿seguro?" adentro del celu (una ventana aparte no se vería en el VR) */
  pintarSeguro(c) {
    const s = el('<div class="cel-seguro"><div><p></p><div class="cel-fila-b"></div></div></div>');
    s.querySelector('p').textContent = this.seguro.texto;
    s.querySelector('.cel-fila-b').append(boton('cel-b', '', t('seguro_no'), { c: 'no' }), boton('cel-b peligro fuerte', '', t('seguro_si'), { c: 'si' }));
    c.appendChild(s);
  }

  /* ------------------------------------------------------------ los toques */
  toque(e) {
    const b = e.target.closest('button'); if (!b || b.disabled || !this.abierto) return;
    const d = b.dataset, am = this.am, J = this.J;
    if (b.type === 'submit') return;   // (lo hace el submit del form)
    if (d.c === 'atras') return this.atras();
    if (d.c === 'inicio') { this.pila = ['inicio']; this.seguro = null; return this.pintar(); }
    if (d.c === 'guardar') return this.cerrar();
    if (d.c === 'no') { this.seguro = null; return this.pintar(); }
    if (d.c === 'si') { const f = this.seguro?.si; this.seguro = null; f && f(); return this.pintar(); }
    if (d.c === 'copiar') { this.copiar(); return; }
    if (d.c === 'compartir') { navigator.share?.({ text: t('am_compartir_txt', { n: codigoLindo(J.id) }) }).catch(() => {}); return; }
    if (d.app) return this.abrirApp(d.app);
    if (d.tab) { this.tab = d.tab; this.resultado = null; if (this.aca !== 'amigos') this.ir('amigos'); else this.pintar(); return; }
    if (d.ver) return this.ir('ver:' + d.ver);
    if (d.chat) return this.ir('chat:' + d.chat);
    if (d.unirse) { const r = this.unirseA(d.unirse); if (r !== false) this.cerrar(); return; }
    if (d.ir) { const aca = J.reinoId; this.cerrar(); if (d.ir !== aca || d.ir === 'casa') this.viajar(d.ir); return; }
    if (d.casa) { this.cerrar(); this.viajar('casa', { casaDe: d.casa, nombreCasa: d.nombre }); return; }
    if (d.pedir) return this.pedir(d.pedir, d.nombre);
    if (d.aceptar) { am.aceptar(d.aceptar); J.sfx('guino'); this.UI.avisar('🤝 ' + t('n_amigos_txt', { n: am.nombre(d.aceptar) }), 'bien'); return this.pintar(); }
    if (d.rechazar) { am.rechazar(d.rechazar); return this.pintar(); }
    if (d.cancelar) { am.cancelar(d.cancelar); return this.pintar(); }
    if (d.desbloquear) { am.desbloquear(d.desbloquear); return this.pintar(); }
    if (d.quitar) { const id = d.quitar; this.seguro = { texto: t('pf_quitar_seguro', { n: am.nombre(id) }), si: () => { am.quitar(id); this.pila = ['inicio', 'amigos']; this.tab = 'lista'; } }; return this.pintar(); }
    if (d.bloquear) { const id = d.bloquear; this.seguro = { texto: t('pf_bloquear_seguro', { n: am.nombre(id) }), si: () => { am.bloquear(id); this.pila = ['inicio', 'amigos']; } }; return this.pintar(); }
    if (d.pedidos) { J.G.amigosOp.pedidos = d.pedidos; J.guardar(); return this.pintar(); }
    if (d.avisos) { J.G.amigosOp.avisos = d.avisos === 'si'; J.guardar(); return this.pintar(); }
    if (d.hud) { const H = J.G.opciones.hud = { ...HUD_INICIAL, ...(J.G.opciones.hud || {}) }; H[d.hud] = !H[d.hud]; J.guardar(); this.UI.aplicarHud(); this.insignia(); return this.refrescar(); }
  }
  /* las apps que son lo de antes: se cierra el celu, se abre eso y al terminar se vuelve al celu */
  abrirApp(app) {
    /* (al volver, solo si no se abrió otra ventana en el medio: las opciones se rearman al cambiar el idioma) */
    const J = this.J, UI = this.UI, volver = () => setTimeout(() => { if (UI.ventanaAbierta) return; J.pausar(false, true); if (J.enJuego) this.abrir('inicio'); }, 0);
    if (['amigos', 'mensajes', 'juegos', 'casas', 'perfil', 'ajustes'].includes(app)) { if (app === 'amigos' && this.aca === 'inicio') this.tab = this.am.recibidas ? 'sol' : 'lista'; return this.ir(app); }
    /* (la voz se prende y se apaga sin cerrar el celu) */
    if (app === 'voz') { J.alternarVoz?.(); setTimeout(() => this.refrescar(), 400); return; }
    this.cerrar();
    if (app === 'camara') this.foto();
    else if (app === 'probador') this.abrirProbador();
    else if (app === 'tienda') { J.pausar(true, true); tiendaJoyas(J, UI, { alCerrar: volver }); }
    else if (app === 'misiones') { if (!UI.hud?.querySelector('.panel-misiones')) UI.panelMisiones(); }
    else if (app === 'gestos') J.hotbar(2);
    else if (app === 'musica') J.hotbar(3);
    else if (app === 'mapa') J.hotbar(5);
    else if (app === 'construir') this.construir();
    else if (app === 'estilo') { J.pausar(true, true); UI.estilo(volver); }
    else if (app === 'opciones') { J.pausar(true, true); UI.opciones(volver); }
    else if (app === 'controles') { J.pausar(true, true); UI.controles(volver); }
  }
  enviarForm(f) {
    const i = f.querySelector('input'); if (!i) return;
    if (i.classList.contains('cel-cod')) { this.pedir(i.value); return; }
    if (i.classList.contains('cel-texto')) this.enviarMensaje(i);
  }
  enviarMensaje(i) {
    const id = this.aca.split(':')[1];
    if (!i.value.trim()) return;
    const m = this.am.escribir(id, i.value);
    if (m) { i.value = ''; Teclado.abierto?.pintarTexto?.(); this.J.sfx('pop'); this.pintarMensajes(id); }
  }
  pedir(cod, nombre = '') {
    const am = this.am, r = am.pedir(cod, nombre);
    const bien = ['enviada', 'buscando', 'aceptada'].includes(r);
    this.resultado = { bien, texto: t('am_r_' + (r === 'sin_llave' ? 'sin_llave' : r), { n: MAX_AMIGOS }) };
    if (bien) { this.codigo = ''; this.J.sfx(r === 'aceptada' ? 'guino' : 'pop'); if (!this.caja.querySelector('.cel-cod')) this.UI.avisar((r === 'aceptada' ? '🤝 ' : '📨 ') + this.resultado.texto, 'bien'); }
    this.pintar();
  }
  async copiar() {
    const x = codigoLindo(this.J.id);
    try { await navigator.clipboard.writeText(x); this.UI.avisar('📋 ' + t('am_copiado') + ': ' + x, 'bien'); }
    catch { this.UI.avisar(t('am_tu_codigo') + ': ' + x, 'azul'); }
  }
  /* el teclado propio (en el celu del jugador: el del sistema sale parado con el juego acostado) */
  engancharTeclado() {
    if (!this.J.ent.tactil) return;
    this.caja.addEventListener('pointerdown', (e) => {
      const i = e.target.closest('input'); if (!i || Teclado.abierto?.input === i) return;
      e.preventDefault();
      Teclado.abrir(i, {
        alEnviar: () => { if (i.classList.contains('cel-texto')) this.enviarMensaje(i); else { Teclado.cerrar(true); this.pedir(i.value); } },
        alCerrar: () => {},
        sonido: () => this.J.sfx('letra', { f: 1200 + Math.random() * 400 }),
      });
      /* (el teclado no manda 'input': el código se mira al escribir) */
      const E = Teclado.abierto; if (E && i.classList.contains('cel-cod')) { const p = E.pintarTexto; E.pintarTexto = () => { p(); this.escribiendoCodigo(i); }; }
    });
  }

  /* ------------------------------------------------------------ los avisos (de amigos.js) */
  aviso(tipo, a, id, nuevos) {
    const UI = this.UI, J = this.J, n = a?.nombre || id;
    const enEsa = this.abierto && this.aca === 'chat:' + id;
    if (tipo === 'solicitud') { UI.notificar({ titulo: t('n_solicitud'), texto: t('n_solicitud_txt', { n }), icono: '👋', tipo: 'info' }); J.ent.vibrar(40); }
    else if (tipo === 'acepto') { UI.notificar({ titulo: t('n_acepto'), texto: t('n_acepto_txt', { n }), icono: '🤝', tipo: 'bien' }); J.sfx('guino'); }
    else if (tipo === 'amigos') UI.notificar({ titulo: t('n_acepto'), texto: t('n_amigos_txt', { n }), icono: '🤝', tipo: 'bien' });
    else if (tipo === 'conecto') { UI.notificar({ titulo: t('n_conecto', { n }), texto: t('n_conecto_txt'), icono: '🟢', tipo: 'info', sonido: false }); J.sfx('sesion'); }
    else if (tipo === 'mensaje' && !enEsa) { const u = nuevos.at(-1); UI.notificar({ titulo: '💬 ' + n, texto: u.x.length > 70 ? u.x.slice(0, 68) + '…' : u.x, icono: '📱', tipo: 'info' }); J.ent.vibrar(25); }
    else if (tipo === 'mensaje') J.sfx('letra', { f: 1700 });
  }
}
