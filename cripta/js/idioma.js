// Los textos, en castellano, inglés y portugués. Todo en mayúsculas porque la
// letra del juego no tiene minúsculas; las tildes, la Ñ, la Ç y los ¡¿ sí.
// '{n}' se reemplaza por el número que toque.
const T = {
  titulo1: ['CRIPTA', 'NEON', 'CRIPTA'],
  titulo2: ['NEÓN', 'CRYPT', 'NEON'],
  jugar: ['JUGAR', 'PLAY', 'JOGAR'],
  torre: ['TORRE', 'TOWER', 'TORRE'],
  tienda: ['TIENDA', 'SHOP', 'LOJA'],
  ajustes: ['AJUSTES', 'SETTINGS', 'AJUSTES'],
  volver: ['VOLVER', 'BACK', 'VOLTAR'],
  mundo: ['MUNDO {n}', 'WORLD {n}', 'MUNDO {n}'],
  mundo_0: ['CATACUMBAS', 'CATACOMBS', 'CATACUMBAS'],
  mundo_1: ['JARDÍN DE HONGOS', 'MUSHROOM GARDEN', 'JARDIM DE COGUMELOS'],
  mundo_2: ['EL HORNO', 'THE FURNACE', 'A FORNALHA'],
  mundo_3: ['LA TORRE', 'THE TOWER', 'A TORRE'],
  cerrado: ['TERMINÁ EL MUNDO {n}', 'FINISH WORLD {n}', 'TERMINE O MUNDO {n}'],
  pausa: ['PAUSA', 'PAUSED', 'PAUSA'],
  seguir: ['SEGUIR', 'RESUME', 'CONTINUAR'],
  reintentar: ['DE NUEVO', 'RETRY', 'DE NOVO'],
  mapa: ['MAPA', 'MAP', 'MAPA'],
  menu: ['MENÚ', 'MENU', 'MENU'],
  superado: ['¡SUPERADO!', 'CLEARED!', 'CONCLUÍDO!'],
  siguiente: ['SIGUIENTE', 'NEXT', 'PRÓXIMA'],
  chispas: ['CHISPAS', 'SPARKS', 'FAÍSCAS'],
  monedas: ['MONEDAS', 'COINS', 'MOEDAS'],
  limpio: ['¡TODO LIMPIO!', 'ALL CLEAR!', 'TUDO LIMPO!'],
  premio: ['PREMIO', 'BONUS', 'BÔNUS'],
  record: ['RÉCORD', 'BEST', 'RECORDE'],
  nuevoRecord: ['¡NUEVO RÉCORD!', 'NEW BEST!', 'NOVO RECORDE!'],
  altura: ['ALTURA', 'HEIGHT', 'ALTURA'],
  metros: ['{n} M', '{n} M', '{n} M'],
  finTorre: ['FIN DE LA SUBIDA', 'RUN OVER', 'FIM DA SUBIDA'],
  revivir: ['REVIVIR', 'REVIVE', 'REVIVER'],
  revivirUna: ['UNA VEZ POR SUBIDA', 'ONCE PER RUN', 'UMA VEZ POR SUBIDA'],
  causa_lava: ['TE ALCANZÓ LA LAVA', 'THE LAVA GOT YOU', 'A LAVA TE PEGOU'],
  causa_pinchos: ['TE PINCHASTE', 'SPIKED!', 'ESPETADA!'],
  causa_polilla: ['TE AGARRÓ UNA POLILLA', 'A MOTH GOT YOU', 'UMA MARIPOSA TE PEGOU'],
  causa_fuego: ['TE QUEMASTE', 'BURNED!', 'QUEIMADA!'],
  causa_erizo: ['TE PINCHÓ UN ERIZO', 'URCHIN ATTACK!', 'UM OURIÇO TE PEGOU'],
  pieles: ['PIELES', 'SKINS', 'VISUAIS'],
  mejoras: ['MEJORAS', 'UPGRADES', 'MELHORIAS'],
  usar: ['USAR', 'USE', 'USAR'],
  puesta: ['PUESTA', 'ON', 'EM USO'],
  maximo: ['MÁXIMO', 'MAX', 'MÁXIMO'],
  faltan: ['TE FALTAN MONEDAS', 'NOT ENOUGH COINS', 'FALTAM MOEDAS'],
  segundos: ['{n} S', '{n} S', '{n} S'],
  poder_iman: ['IMÁN', 'MAGNET', 'ÍMÃ'],
  poder_hielo: ['HIELO', 'FREEZE', 'GELO'],
  poder_doble: ['DOBLE', 'DOUBLE', 'DOBRO'],
  poder_escudo: ['ESCUDO', 'SHIELD', 'ESCUDO'],
  desc_iman: ['TRAE CHISPAS Y MONEDAS', 'PULLS SPARKS AND COINS', 'PUXA FAÍSCAS E MOEDAS'],
  desc_hielo: ['CONGELA BICHOS Y LAVA', 'FREEZES FOES AND LAVA', 'CONGELA BICHOS E LAVA'],
  desc_doble: ['MONEDAS POR DOS', 'COINS COUNT TWICE', 'MOEDAS EM DOBRO'],
  desc_escudo: ['AGUANTA UN GOLPE', 'BLOCKS ONE HIT', 'AGUENTA UM GOLPE'],
  musica: ['MÚSICA', 'MUSIC', 'MÚSICA'],
  sonido: ['SONIDO', 'SOUND', 'SOM'],
  vibrar: ['VIBRACIÓN', 'VIBRATION', 'VIBRAÇÃO'],
  idioma: ['IDIOMA', 'LANGUAGE', 'IDIOMA'],
  borrar: ['BORRAR TODO', 'RESET ALL', 'APAGAR TUDO'],
  borrarSeguro: ['¿SEGURO? TOCÁ OTRA VEZ', 'SURE? TAP AGAIN', 'CERTEZA? TOQUE DE NOVO'],
  borrado: ['EMPEZÁS DE CERO', 'FRESH START', 'COMEÇOU DO ZERO'],
  si: ['SÍ', 'ON', 'SIM'],
  no: ['NO', 'OFF', 'NÃO'],
  creditos: ['UN JUEGO ORIGINAL HECHO CON CÓDIGO', 'AN ORIGINAL GAME MADE WITH CODE', 'UM JOGO ORIGINAL FEITO COM CÓDIGO'],
  tocaAudio: ['TOCÁ PARA EMPEZAR', 'TAP TO START', 'TOQUE PARA COMEÇAR'],
  nivel: ['NIVEL {n}', 'LEVEL {n}', 'FASE {n}'],
  mejorAltura: ['MEJOR: {n} M', 'BEST: {n} M', 'MELHOR: {n} M'],
  nuevoMundo: ['¡MUNDO NUEVO!', 'NEW WORLD!', 'MUNDO NOVO!'],
  comprado: ['¡LISTO!', 'DONE!', 'PRONTO!'],
  total: ['TOTAL', 'TOTAL', 'TOTAL'],
  // los carteles del principio de cada nivel que trae algo nuevo
  aviso_deslizar: ['DESLIZÁ PARA VOLAR\nLU FRENA EN LA PARED', 'SWIPE TO FLY\nLU STOPS AT WALLS', 'DESLIZE PARA VOAR\nLU PARA NA PAREDE'],
  aviso_estrellas: ['BUSCÁ LAS 3 ESTRELLAS\nEN LOS RINCONES', 'FIND THE 3 STARS\nIN THE CORNERS', 'ACHE AS 3 ESTRELAS\nNOS CANTOS'],
  aviso_puas: ['¡CUIDADO CON LAS PÚAS!', 'WATCH OUT FOR SPIKES!', 'CUIDADO COM OS ESPINHOS!'],
  aviso_polillas: ['LAS POLILLAS VAN Y VIENEN\nPASÁ CUANDO NO ESTÉN', 'MOTHS FLY BACK AND FORTH\nPASS WHEN THEY ARE AWAY', 'AS MARIPOSAS VÃO E VOLTAM\nPASSE QUANDO SAÍREM'],
  aviso_fragil: ['LAS PAREDES RAJADAS\nSE CAEN DE UN GOLPE', 'CRACKED WALLS\nBREAK IN ONE HIT', 'PAREDES RACHADAS\nCAEM COM UM GOLPE'],
  aviso_escudo: ['LA BURBUJA AZUL\nAGUANTA UN GOLPE', 'THE BLUE BUBBLE\nBLOCKS ONE HIT', 'A BOLHA AZUL\nAGUENTA UM GOLPE'],
  aviso_erizos: ['LOS ERIZOS SE INFLAN\nPASÁ CUANDO SE ACHIQUEN', 'URCHINS PUFF UP\nPASS WHEN THEY SHRINK', 'OS OURIÇOS INCHAM\nPASSE QUANDO MURCHAREM'],
  aviso_pinchos: ['ESTOS PINCHOS\nSUBEN Y BAJAN', 'THESE SPIKES\nGO UP AND DOWN', 'ESTES ESPINHOS\nSOBEM E DESCEM'],
  aviso_portales: ['UN PORTAL TE MANDA\nAL OTRO DEL MISMO COLOR', 'A PORTAL SENDS YOU TO\nITS TWIN OF THE SAME COLOR', 'UM PORTAL TE LEVA\nAO OUTRO DA MESMA COR'],
  aviso_flechas: ['LAS FLECHAS\nTE HACEN DOBLAR', 'ARROWS\nMAKE YOU TURN', 'AS SETAS\nTE FAZEM VIRAR'],
  aviso_cabezas: ['LAS CABEZAS DE PIEDRA\nESCUPEN FUEGO', 'STONE HEADS\nSPIT FIRE', 'AS CABEÇAS DE PEDRA\nCOSPEM FOGO'],
  aviso_lava: ['¡LA LAVA SUBE!\n¡NO TE QUEDES!', 'THE LAVA IS RISING!\nKEEP MOVING!', 'A LAVA ESTÁ SUBINDO!\nNÃO PARE!'],
  aviso_hielo: ['EL HIELO CONGELA\nBICHOS Y LAVA', 'FREEZE STOPS\nFOES AND LAVA', 'O GELO CONGELA\nBICHOS E LAVA'],
  aviso_iman: ['EL IMÁN TE TRAE\nLAS CHISPAS', 'THE MAGNET PULLS\nIN THE SPARKS', 'O ÍMÃ TE TRAZ\nAS FAÍSCAS'],
  aviso_torre: ['SUBÍ TODO LO QUE PUEDAS', 'CLIMB AS HIGH AS YOU CAN', 'SUBA O MÁXIMO QUE PUDER'],
  // las pieles
  piel_lu: ['LU', 'LU', 'LU'],
  piel_ambar: ['ÁMBAR', 'AMBER', 'ÂMBAR'],
  piel_menta: ['MENTA', 'MINT', 'HORTELÃ'],
  piel_rosa: ['ROSITA', 'PINKY', 'ROSINHA'],
  piel_hielo: ['ESCARCHA', 'FROST', 'GEADA'],
  piel_fuego: ['BRASA', 'EMBER', 'BRASA'],
  piel_noche: ['NOCHE', 'NIGHT', 'NOITE'],
  piel_oro: ['REINA', 'QUEEN', 'RAINHA'],
};

export const IDIOMAS = ['es', 'en', 'pt'];

export function idiomaDelNavegador() {
  const l = (navigator.language || 'es').slice(0, 2).toLowerCase();
  return IDIOMAS.includes(l) ? l : l === 'gl' ? 'es' : 'en';
}

export function crearIdioma(inicial) {
  let actual = IDIOMAS.includes(inicial) ? inicial : idiomaDelNavegador();
  const tr = (clave, n) => {
    const fila = T[clave];
    if (!fila) return clave;
    const s = fila[IDIOMAS.indexOf(actual)] ?? fila[0];
    return n === undefined ? s : s.replace('{n}', n);
  };
  tr.poner = (l) => { if (IDIOMAS.includes(l)) actual = l; };
  tr.actual = () => actual;
  tr.hay = (clave) => !!T[clave];
  return tr;
}

// Todas las claves (para la prueba: que no falte ninguna traducción ni una letra).
export const CLAVES = Object.keys(T);
export const TABLA = T;
