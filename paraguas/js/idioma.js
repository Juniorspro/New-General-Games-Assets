// Los textos, en los tres idiomas.
//
// POR QUE UNA TABLA Y NO TRES HTML. Un juego traducido copiando el index.html
// tres veces se desincroniza a la primera corrección: se arregla un botón en
// uno y quedan dos con el texto viejo. Acá el HTML tiene UN texto por lugar
// —marcado con `data-t`— y la tabla decide cuál se escribe.
//
// EL IDIOMA POR DEFECTO ES INGLES, no el del navegador. La primera vez el juego
// pregunta, y esa elección se guarda. Adivinar por `navigator.language` suena
// más prolijo pero le pone el idioma del sistema operativo a alguien que quizás
// quiere jugar en otro, y después hay que buscar dónde cambiarlo.
//
// El texto que queda escrito en el HTML es el castellano: si este módulo no
// carga, el juego se lee igual. Un respaldo vacío sería peor que uno en un
// idioma equivocado.

export const IDIOMAS = { en: "English", es: "Español", pt: "Português" };

const ES = {
  "doc.titulo": "Paraguas — un pozo sin fondo",
  "doc.desc": "Un pozo sin fondo y un paraguas. El dedo quieto lo cierra y caés rápido; arrastrando lo abrís y maniobrás.",
  "doc.lienzo": "El pozo",

  "idioma.titulo": "Elegí tu idioma",
  "idioma.bajada": "Se puede cambiar después desde el menú.",

  "menu.bajada": "Dedo <b>quieto</b>: se cierra, caés rápido y pasás por cualquier lado. <b>Arrastrá</b>: se abre, caés lento y maniobrás.",
  "menu.jugar": "CAER",
  "menu.jugar-aria": "Caer",
  "menu.mejor": "Mejor caída",
  "menu.caidas": "{n} caídas",
  "menu.caidas1": "1 caída",
  "menu.como": "? Cómo se juega",
  "menu.sonido": "Sonido",
  "menu.musica": "Música",
  "menu.borrar": "Borrar",
  "menu.borrar-confirmar": "¿Borrar el récord?",
  "menu.idioma": "Idioma",

  "como.titulo": "Cómo se juega",
  "como.atras": "← Atrás",
  "como.destacado": "Un dedo hace todo, y hace <b>dos cosas distintas</b>. Arrastrando, el paraguas queda <b>abierto</b>: caés lento y maniobrás con precisión. Frenando el dedo —sin soltarlo— se <b>cierra</b>: caés al triple y pasás por cualquier hueco.",
  "como.h-truco": "El truco",
  "como.truco": "Arrastrar y caer rápido son <b>dos gestos, no uno</b>. Ponés el dedo donde querés ir, parás la mano y el paraguas se cierra ocho cuadros después. Si te tenés que corregir, movés otra vez y se vuelve a abrir. Apuntar cuesta altura y caer cuesta precisión: eso es el juego entero.",
  "como.h-hay": "Lo que hay",
  "como.dt-anchos": "Los huecos anchos",
  "como.dd-anchos": "Pasan con el paraguas abierto. Tomate tu tiempo.",
  "como.dt-angostos": "Los huecos angostos",
  "como.dd-angostos": "Marcados en naranja y con dos flechas. Ahí <b>no entrás abierto</b>: hay que llegar con la mano quieta. Apuntá antes, no cuando llegaste.",
  "como.dt-varillas": "Las varillas",
  "como.dd-varillas": "Arriba a la derecha. Cada viga que te comés rompe una. Sin varillas, se terminó.",
  "como.dt-puas": "Las púas",
  "como.dd-puas": "Rojas. No perdonan ninguna.",
  "como.dt-chatarra": "La chatarra",
  "como.dd-chatarra": "Marca por dónde conviene pasar y suma puntos.",
  "como.dt-ras": "Al ras",
  "como.dd-ras": "Pasar a menos de siete píxeles del borde paga diez. El pozo premia al que pasa justo, no al que pasa lejos.",
  "como.h-puntaje": "El puntaje",
  "como.puntaje": "Son los <b>metros</b>, y los metros los ganás cayendo. Cerrar el paraguas no es sólo para pasar por los huecos angostos: es la única forma de bajar rápido. El juego te ofrece todo el tiempo el mismo trato, y vos decidís cuánto lo aceptás.",
  "como.h-hecho": "De qué está hecho",
  "como.hecho1": "El pozo se genera para siempre, y <b>cada hueco se pone dentro de lo que se puede alcanzar desde el anterior</b> a la velocidad a la que vas a llegar. No es un detalle: un generador infinito falla poniendo dos huecos que no se alcanzan, y eso no se ve como un error — se ve como que perdiste otra vez.",
  "como.hecho2": "Todo es vectorial menos el paraguas, el personaje, el fondo del pozo y el vestido de los menús. El sonido son osciladores: el viento es ruido blanco pasado por un filtro que se abre con la velocidad de caída, y la música del juego se toca sola —el arpegio se densifica cuanto más rápido caés—. El único archivo de audio es el tema del menú.",

  "hud.salir": "Volver al menú",

  "fin.record": "¡RÉCORD!",
  "fin.rotulo": "Caíste",
  "fin.otra": "OTRA",
  "fin.otra-aria": "Otra vez",
  "fin.menu": "Al menú",
  "fin.chatarra": "Chatarra",
  "fin.roces": "Pasadas al ras",
  "fin.puntaje": "Puntaje",
  "fin.mejor": "Mejor caída",

  "tramo.garaje": "El garaje",
  "tramo.canerias": "Las cañerías",
  "tramo.fabrica": "La fábrica",
  "tramo.vacio": "El vacío",
  "tramo.panza": "La panza",
  "tramo.basural": "El basural",
  "tramo.heladera": "La heladera",

  "menu.tienda": "Skins",
  "tienda.titulo": "Skins",
  "tienda.monedas": "{n} de chatarra",
  "tienda.comprar": "Comprar",
  "tienda.poner": "Ponerse",
  "tienda.puesta": "Puesta",
  "tienda.falta": "Te faltan {n}",
  "tienda.paga": "Con dinero real",
  "tienda.sin-tienda": "No disponible todavía",
  "tienda.restaurar": "Restaurar compras",
  "tienda.nota": "Las tres de abajo se cobran por la tienda del teléfono. Todavía no hay ninguna conectada, así que no se puede comprar nada.",
  "tienda.ganadas": "Juntadas: {n}",
  "rango.comun": "Común",
  "rango.rara": "Rara",
  "rango.epica": "Épica",
  "rango.legendaria": "Legendaria",
  "rango.paga": "Exclusiva",
  "fin.ganaste": "Chatarra ganada",

  // Los nombres de las 34 skins. Cortos a propósito: entran en un botón de
  // setenta píxeles y en los tres idiomas.
  "skin.base": "Rilo",
  "skin.lab": "Laboratorio",
  "skin.obrero": "Obrero",
  "skin.menta": "Menta",
  "skin.ladrillo": "Ladrillo",
  "skin.tinta": "Tinta",
  "skin.durazno": "Durazno",
  "skin.pizarra": "Pizarra",
  "skin.limon": "Limón",
  "skin.neon": "Neón",
  "skin.rosa": "Chicle",
  "skin.selva": "Selva",
  "skin.oxido": "Óxido",
  "skin.abismo": "Abismo",
  "skin.cereza": "Cereza",
  "skin.arena": "Arena",
  "skin.acero": "Acero",
  "skin.veneno": "Veneno",
  "skin.hielo": "Hielo",
  "skin.brasa": "Brasa",
  "skin.tormenta": "Tormenta",
  "skin.jade": "Jade",
  "skin.obsidiana": "Obsidiana",
  "skin.aurora": "Aurora",
  "skin.coral": "Coral",
  "skin.plomo": "Plomo",
  "skin.oro": "Oro",
  "skin.espectro": "Espectro",
  "skin.prisma": "Prisma",
  "skin.titan": "Titán",
  "skin.fenix": "Fénix",
  "skin.cromo": "Cromo",
  "skin.magma": "Magma",
  "skin.vacio": "Vacío",
};

const EN = {
  "doc.titulo": "Umbrella — a bottomless pit",
  "doc.desc": "A bottomless pit and an umbrella. Hold your finger still and it shuts, so you drop fast; drag and it opens, so you steer.",
  "doc.lienzo": "The pit",

  "idioma.titulo": "Choose your language",
  "idioma.bajada": "You can change it later from the menu.",

  "menu.bajada": "Finger <b>still</b>: it shuts, you drop fast and fit through anything. <b>Drag</b>: it opens, you fall slow and steer.",
  "menu.jugar": "FALL",
  "menu.jugar-aria": "Fall",
  "menu.mejor": "Best drop",
  "menu.caidas": "{n} drops",
  "menu.caidas1": "1 drop",
  "menu.como": "? How to play",
  "menu.sonido": "Sound",
  "menu.musica": "Music",
  "menu.borrar": "Erase",
  "menu.borrar-confirmar": "Erase your best drop?",
  "menu.idioma": "Language",

  "como.titulo": "How to play",
  "como.atras": "← Back",
  "como.destacado": "One finger does everything, and it does <b>two different things</b>. While you drag, the umbrella stays <b>open</b>: you fall slowly and steer precisely. Stop your finger —without lifting it— and it <b>shuts</b>: you fall three times faster and fit through any gap.",
  "como.h-truco": "The trick",
  "como.truco": "Steering and dropping are <b>two gestures, not one</b>. You put your finger where you want to go, hold your hand still, and the umbrella shuts eight frames later. Need to correct? Move again and it opens back up. Aiming costs height and dropping costs precision: that is the whole game.",
  "como.h-hay": "What's down there",
  "como.dt-anchos": "Wide gaps",
  "como.dd-anchos": "You fit through them open. Take your time.",
  "como.dt-angostos": "Narrow gaps",
  "como.dd-angostos": "Marked orange with two arrows. You <b>will not fit open</b>: arrive with your hand already still. Aim early, not on arrival.",
  "como.dt-varillas": "The ribs",
  "como.dd-varillas": "Top right. Every beam you hit snaps one. Out of ribs, you're done.",
  "como.dt-puas": "The spikes",
  "como.dd-puas": "Red. They forgive nothing.",
  "como.dt-chatarra": "The scrap",
  "como.dd-chatarra": "It marks the good line through and it scores.",
  "como.dt-ras": "Grazing",
  "como.dd-ras": "Passing within seven pixels of an edge pays ten. The pit rewards the one who squeezes through, not the one who plays it safe.",
  "como.h-puntaje": "Scoring",
  "como.puntaje": "It's the <b>metres</b>, and metres come from falling. Shutting the umbrella isn't just for narrow gaps: it is the only way down fast. The game offers you the same deal the whole time, and you decide how much of it to take.",
  "como.h-hecho": "What it's made of",
  "como.hecho1": "The pit is generated forever, and <b>every gap is placed within reach of the one before it</b> at the speed you'll actually be going. That's not a detail: an endless generator fails by placing two gaps you can't get between, and that doesn't look like a bug — it looks like you lost again.",
  "como.hecho2": "Everything is vector art except the umbrella, the character, the pit backdrop and the menu trim. The sound is oscillators: the wind is white noise through a filter that opens with your falling speed, and the in-game music plays itself — the arpeggio thickens the faster you fall. The only audio file is the menu theme.",

  "hud.salir": "Back to menu",

  "fin.record": "NEW BEST!",
  "fin.rotulo": "You fell",
  "fin.otra": "AGAIN",
  "fin.otra-aria": "Again",
  "fin.menu": "To menu",
  "fin.chatarra": "Scrap",
  "fin.roces": "Grazes",
  "fin.puntaje": "Score",
  "fin.mejor": "Best drop",

  "tramo.garaje": "The garage",
  "tramo.canerias": "The pipes",
  "tramo.fabrica": "The factory",
  "tramo.vacio": "The void",
  "tramo.panza": "The belly",
  "tramo.basural": "The dump",
  "tramo.heladera": "The freezer",

  "menu.tienda": "Skins",
  "tienda.titulo": "Skins",
  "tienda.monedas": "{n} scrap",
  "tienda.comprar": "Buy",
  "tienda.poner": "Equip",
  "tienda.puesta": "Equipped",
  "tienda.falta": "{n} short",
  "tienda.paga": "Real money",
  "tienda.sin-tienda": "Not available yet",
  "tienda.restaurar": "Restore purchases",
  "tienda.nota": "The three below are billed through the phone's app store. None is connected yet, so nothing can be bought.",
  "tienda.ganadas": "Collected: {n}",
  "rango.comun": "Common",
  "rango.rara": "Rare",
  "rango.epica": "Epic",
  "rango.legendaria": "Legendary",
  "rango.paga": "Exclusive",
  "fin.ganaste": "Scrap earned",

  // Los nombres de las 34 skins. Cortos a propósito: entran en un botón de
  // setenta píxeles y en los tres idiomas.
  "skin.base": "Rilo",
  "skin.lab": "Lab coat",
  "skin.obrero": "Hard hat",
  "skin.menta": "Mint",
  "skin.ladrillo": "Brick",
  "skin.tinta": "Ink",
  "skin.durazno": "Peach",
  "skin.pizarra": "Slate",
  "skin.limon": "Lemon",
  "skin.neon": "Neon",
  "skin.rosa": "Bubblegum",
  "skin.selva": "Jungle",
  "skin.oxido": "Rust",
  "skin.abismo": "Abyss",
  "skin.cereza": "Cherry",
  "skin.arena": "Dune",
  "skin.acero": "Steel",
  "skin.veneno": "Venom",
  "skin.hielo": "Frost",
  "skin.brasa": "Ember",
  "skin.tormenta": "Storm",
  "skin.jade": "Jade",
  "skin.obsidiana": "Obsidian",
  "skin.aurora": "Aurora",
  "skin.coral": "Coral",
  "skin.plomo": "Lead",
  "skin.oro": "Gold",
  "skin.espectro": "Wraith",
  "skin.prisma": "Prism",
  "skin.titan": "Titan",
  "skin.fenix": "Phoenix",
  "skin.cromo": "Chrome",
  "skin.magma": "Magma",
  "skin.vacio": "Void",
};

const PT = {
  "doc.titulo": "Guarda-chuva — um poço sem fundo",
  "doc.desc": "Um poço sem fundo e um guarda-chuva. Dedo parado fecha e você cai rápido; arrastando abre e você manobra.",
  "doc.lienzo": "O poço",

  "idioma.titulo": "Escolha seu idioma",
  "idioma.bajada": "Dá para mudar depois pelo menu.",

  "menu.bajada": "Dedo <b>parado</b>: fecha, você cai rápido e passa por qualquer lugar. <b>Arraste</b>: abre, você cai devagar e manobra.",
  "menu.jugar": "CAIR",
  "menu.jugar-aria": "Cair",
  "menu.mejor": "Melhor queda",
  "menu.caidas": "{n} quedas",
  "menu.caidas1": "1 queda",
  "menu.como": "? Como se joga",
  "menu.sonido": "Som",
  "menu.musica": "Música",
  "menu.borrar": "Apagar",
  "menu.borrar-confirmar": "Apagar o recorde?",
  "menu.idioma": "Idioma",

  "como.titulo": "Como se joga",
  "como.atras": "← Voltar",
  "como.destacado": "Um dedo faz tudo, e faz <b>duas coisas diferentes</b>. Arrastando, o guarda-chuva fica <b>aberto</b>: você cai devagar e manobra com precisão. Parando o dedo —sem soltar— ele <b>fecha</b>: você cai três vezes mais rápido e passa por qualquer vão.",
  "como.h-truco": "O truque",
  "como.truco": "Manobrar e cair rápido são <b>dois gestos, não um</b>. Você põe o dedo onde quer ir, para a mão, e o guarda-chuva fecha oito quadros depois. Precisa corrigir? Move de novo e ele reabre. Mirar custa altura e cair custa precisão: é o jogo inteiro.",
  "como.h-hay": "O que tem lá embaixo",
  "como.dt-anchos": "Os vãos largos",
  "como.dd-anchos": "Passam com o guarda-chuva aberto. Sem pressa.",
  "como.dt-angostos": "Os vãos estreitos",
  "como.dd-angostos": "Marcados em laranja e com duas setas. Ali <b>você não passa aberto</b>: chegue com a mão já parada. Mire antes, não na hora.",
  "como.dt-varillas": "As varetas",
  "como.dd-varillas": "Canto superior direito. Cada viga que você pega quebra uma. Sem varetas, acabou.",
  "como.dt-puas": "Os espinhos",
  "como.dd-puas": "Vermelhos. Não perdoam nenhum.",
  "como.dt-chatarra": "A sucata",
  "como.dd-chatarra": "Marca por onde convém passar e dá pontos.",
  "como.dt-ras": "De raspão",
  "como.dd-ras": "Passar a menos de sete pixels da borda paga dez. O poço premia quem passa justo, não quem passa longe.",
  "como.h-puntaje": "A pontuação",
  "como.puntaje": "São os <b>metros</b>, e os metros vêm de cair. Fechar o guarda-chuva não é só para os vãos estreitos: é o único jeito de descer rápido. O jogo te oferece o mesmo trato o tempo todo, e você decide o quanto aceita.",
  "como.h-hecho": "Do que é feito",
  "como.hecho1": "O poço é gerado para sempre, e <b>cada vão é posto dentro do alcance do anterior</b> na velocidade em que você vai chegar. Não é detalhe: um gerador infinito falha pondo dois vãos que não se alcançam, e isso não parece um erro — parece que você perdeu de novo.",
  "como.hecho2": "Tudo é vetorial menos o guarda-chuva, o personagem, o fundo do poço e o enfeite dos menus. O som são osciladores: o vento é ruído branco por um filtro que abre com a velocidade da queda, e a música do jogo se toca sozinha — o arpejo fica mais denso quanto mais rápido você cai. O único arquivo de áudio é o tema do menu.",

  "hud.salir": "Voltar ao menu",

  "fin.record": "RECORDE!",
  "fin.rotulo": "Você caiu",
  "fin.otra": "DE NOVO",
  "fin.otra-aria": "De novo",
  "fin.menu": "Ao menu",
  "fin.chatarra": "Sucata",
  "fin.roces": "Raspões",
  "fin.puntaje": "Pontos",
  "fin.mejor": "Melhor queda",

  "tramo.garaje": "A garagem",
  "tramo.canerias": "Os canos",
  "tramo.fabrica": "A fábrica",
  "tramo.vacio": "O vazio",
  "tramo.panza": "A barriga",
  "tramo.basural": "O lixão",
  "tramo.heladera": "O congelador",

  "menu.tienda": "Skins",
  "tienda.titulo": "Skins",
  "tienda.monedas": "{n} de sucata",
  "tienda.comprar": "Comprar",
  "tienda.poner": "Equipar",
  "tienda.puesta": "Equipada",
  "tienda.falta": "Faltam {n}",
  "tienda.paga": "Com dinheiro real",
  "tienda.sin-tienda": "Ainda não disponível",
  "tienda.restaurar": "Restaurar compras",
  "tienda.nota": "As três de baixo são cobradas pela loja do celular. Nenhuma está conectada ainda, então não dá para comprar nada.",
  "tienda.ganadas": "Coletadas: {n}",
  "rango.comun": "Comum",
  "rango.rara": "Rara",
  "rango.epica": "Épica",
  "rango.legendaria": "Lendária",
  "rango.paga": "Exclusiva",
  "fin.ganaste": "Sucata ganha",

  // Los nombres de las 34 skins. Cortos a propósito: entran en un botón de
  // setenta píxeles y en los tres idiomas.
  "skin.base": "Rilo",
  "skin.lab": "Jaleco",
  "skin.obrero": "Operário",
  "skin.menta": "Menta",
  "skin.ladrillo": "Tijolo",
  "skin.tinta": "Tinta",
  "skin.durazno": "Pêssego",
  "skin.pizarra": "Ardósia",
  "skin.limon": "Limão",
  "skin.neon": "Néon",
  "skin.rosa": "Chiclete",
  "skin.selva": "Selva",
  "skin.oxido": "Ferrugem",
  "skin.abismo": "Abismo",
  "skin.cereza": "Cereja",
  "skin.arena": "Areia",
  "skin.acero": "Aço",
  "skin.veneno": "Veneno",
  "skin.hielo": "Gelo",
  "skin.brasa": "Brasa",
  "skin.tormenta": "Tempestade",
  "skin.jade": "Jade",
  "skin.obsidiana": "Obsidiana",
  "skin.aurora": "Aurora",
  "skin.coral": "Coral",
  "skin.plomo": "Chumbo",
  "skin.oro": "Ouro",
  "skin.espectro": "Espectro",
  "skin.prisma": "Prisma",
  "skin.titan": "Titã",
  "skin.fenix": "Fênix",
  "skin.cromo": "Cromo",
  "skin.magma": "Magma",
  "skin.vacio": "Vazio",
};

const TABLA = { es: ES, en: EN, pt: PT };
let actual = "en";

export const idioma = () => actual;

export function ponerIdioma(cod) {
  actual = TABLA[cod] ? cod : "en";
  document.documentElement.lang = { es: "es-AR", en: "en", pt: "pt-BR" }[actual];
  return actual;
}

/**
 * El texto de una clave.
 *
 * Lo que falte en el idioma elegido cae al inglés, y lo que falte también ahí
 * devuelve la clave: un `fin.puntaje` crudo en pantalla se ve mal a propósito,
 * y así se encuentra sin tener que leer los tres diccionarios al lado.
 */
export function t(clave, vars) {
  let s = TABLA[actual][clave] ?? EN[clave] ?? clave;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

/**
 * Escribe todos los textos marcados del documento.
 *
 * `data-t` pone texto plano; `data-t-html` pone HTML —los párrafos que llevan
 * <b> adentro—; `data-t-attr` pone atributos con la forma "aria-label:clave".
 *
 * El HTML de la tabla es NUESTRO: no entra nada que haya escrito el jugador,
 * así que no hay superficie de inyección. Si algún día un texto viniera de
 * afuera, esto tiene que pasar a textContent.
 */
export function aplicar(raiz = document) {
  for (const e of raiz.querySelectorAll("[data-t]")) e.textContent = t(e.dataset.t);
  for (const e of raiz.querySelectorAll("[data-t-html]")) e.innerHTML = t(e.dataset.tHtml);
  for (const e of raiz.querySelectorAll("[data-t-attr]"))
    for (const par of e.dataset.tAttr.split(",")) {
      const [at, clave] = par.split(":").map((x) => x.trim());
      if (at && clave) e.setAttribute(at, t(clave));
    }
  const tit = document.querySelector("title");
  if (tit) tit.textContent = t("doc.titulo");
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", t("doc.desc"));
}
