// Los textos, en los tres idiomas. Mismo mecanismo que en los otros juegos: el
// HTML lleva UN texto por lugar marcado con `data-t` y la tabla decide cuál se
// escribe. Traducir copiando el index.html tres veces se desincroniza a la
// primera corrección.
//
// EL IDIOMA POR DEFECTO ES INGLES, no el del navegador, y se pregunta antes del
// menú: buscar dónde se cambia el idioma en un idioma que no sabés leer es
// exactamente el problema que el selector viene a resolver.

export const IDIOMAS = { en: "English", es: "Español", pt: "Português" };

const ES = {
  "doc.titulo": "Garfio — una torre sin techo",
  "doc.desc": "Una torre sin techo y un gancho. Apoyás el dedo y te colgás; arrastrás y te hamacás; soltás y salís disparado.",
  "doc.lienzo": "La torre",

  "idioma.titulo": "Elegí tu idioma",
  "idioma.bajada": "Se puede cambiar después desde el menú.",

  "menu.bajada": "<b>Apoyá</b> en una argolla y el gancho se clava. <b>Arrastrá</b> para hamacarte. <b>Soltá</b> y salís por la tangente.",
  "menu.jugar": "SUBIR",
  "menu.jugar-aria": "Subir",
  "menu.mejor": "Mejor altura",
  "menu.partidas": "{n} intentos",
  "menu.partidas1": "1 intento",
  "menu.como": "? Cómo se juega",
  "menu.sonido": "Sonido",
  "menu.musica": "Música",
  "menu.borrar": "Borrar",
  "menu.borrar-confirmar": "¿Borrar el récord?",
  "menu.idioma": "Idioma",

  "como.titulo": "Cómo se juega",
  "como.atras": "← Atrás",
  "como.destacado": "Un dedo hace todo. <b>Tocá una argolla</b> y el gancho se clava en ella. <b>Arrastrá el dedo</b> para hamacarte, igual que estirando las piernas en una hamaca. <b>Soltá</b> y salís disparado por donde ibas.",
  "como.h-truco": "El truco",
  "como.truco": "Salís <b>por la tangente</b>, no hacia donde mirás. Soltando abajo del todo salís rápido pero de costado; soltando arriba salís lento pero para arriba. No hay un momento correcto: hay uno distinto para cada argolla que quieras alcanzar.",
  "como.h-hay": "Lo que hay",
  "como.dt-argollas": "Las argollas",
  "como.dd-argollas": "Se enganchan tocándolas si están a menos de <b>168 píxeles</b>. La soga queda del largo que había: enganchar nunca te da un tirón.",
  "como.dt-oxidadas": "Las oxidadas",
  "como.dd-oxidadas": "Naranjas. Aguantan <b>ocho décimas de segundo</b> y se rompen, con un reloj alrededor mientras estás colgado. Soltá vos antes de que te suelte ella: así elegís la dirección.",
  "como.dt-tuercas": "Las tuercas",
  "como.dd-tuercas": "Están fuera de la línea buena a propósito. Agarrarlas cuesta soltar más tarde de lo que conviene.",
  "como.dt-paredes": "Las paredes",
  "como.dd-paredes": "Rebotan y te comen más de la mitad del envión de costado. No matan, pero cuestan una argolla.",
  "como.dt-marea": "El piso que sube",
  "como.dd-marea": "A partir de los cuarenta metros el borde de abajo empieza a subir solo, cada vez más rápido. Se pone rojo cuando arranca.",
  "como.h-puntaje": "El puntaje",
  "como.puntaje": "Son los <b>metros</b>, y la única forma de ganarlos es soltar. Quedarse colgado es gratis y seguro hasta que el piso te alcanza; el juego te ofrece todo el tiempo el mismo trato y vos decidís cuánto lo aceptás.",
  "como.h-hecho": "De qué está hecho",
  "como.hecho1": "La torre se genera para siempre, y <b>cada argolla se pone dentro de lo que se puede saltar desde la anterior</b>. Ese número no salió de lo que quedaba lindo: está medido jugando, y hay una prueba que lo vuelve a medir con la física de verdad y falla si alguien toca la gravedad y se olvida de esto.",
  "como.hecho2": "Todo es vectorial menos el bicho, el fondo de la torre y el vestido de los menús. El sonido son osciladores y la música del juego también: se toca sola, con una progresión de acordes cuya densidad sube con la altura y la velocidad. El único archivo de audio es el tema del menú.",

  "hud.salir": "Volver al menú",

  "fin.record": "¡RÉCORD!",
  "fin.rotulo": "Te caíste",
  "fin.otra": "OTRA",
  "fin.otra-aria": "Otra vez",
  "fin.menu": "Al menú",
  "fin.tuercas": "Tuercas",
  "fin.puntaje": "Puntaje",
  "fin.mejor": "Mejor altura",

  "piso.sotano": "El sótano",
  "piso.oficinas": "Las oficinas",
  "piso.taller": "El taller",
  "piso.antenas": "Las antenas",
  "piso.nubes": "Arriba de las nubes",
};

const EN = {
  "doc.titulo": "Hook — a tower with no top",
  "doc.desc": "A tower with no top and a grappling hook. Touch to latch on, drag to swing, let go to fly.",
  "doc.lienzo": "The tower",

  "idioma.titulo": "Choose your language",
  "idioma.bajada": "You can change it later from the menu.",

  "menu.bajada": "<b>Touch</b> a ring and the hook bites. <b>Drag</b> to pump the swing. <b>Let go</b> and you fly off along the tangent.",
  "menu.jugar": "CLIMB",
  "menu.jugar-aria": "Climb",
  "menu.mejor": "Best height",
  "menu.partidas": "{n} runs",
  "menu.partidas1": "1 run",
  "menu.como": "? How to play",
  "menu.sonido": "Sound",
  "menu.musica": "Music",
  "menu.borrar": "Erase",
  "menu.borrar-confirmar": "Erase your best height?",
  "menu.idioma": "Language",

  "como.titulo": "How to play",
  "como.atras": "← Back",
  "como.destacado": "One finger does everything. <b>Touch a ring</b> and the hook bites into it. <b>Drag your finger</b> to pump the swing, the same way you kick your legs on a playground swing. <b>Let go</b> and you fly off the way you were already going.",
  "como.h-truco": "The trick",
  "como.truco": "You leave <b>along the tangent</b>, not toward where you're looking. Let go at the bottom of the arc and you go fast but sideways; let go at the top and you go slow but upward. There is no correct moment — there's a different one for every ring you want to reach.",
  "como.h-hay": "What's up there",
  "como.dt-argollas": "The rings",
  "como.dd-argollas": "Touch one within <b>168 pixels</b> and the hook bites. The rope keeps whatever length it already had: latching on never yanks you.",
  "como.dt-oxidadas": "The rusted ones",
  "como.dd-oxidadas": "Orange. They hold for <b>eight tenths of a second</b> and snap, with a clock drawn around them while you hang. Let go before they let go of you — that way you pick the direction.",
  "como.dt-tuercas": "The nuts",
  "como.dd-tuercas": "They sit off the good line on purpose. Grabbing one costs you a later release than you wanted.",
  "como.dt-paredes": "The walls",
  "como.dd-paredes": "They bounce you and eat more than half your sideways speed. They don't kill, but they cost you a ring.",
  "como.dt-marea": "The rising floor",
  "como.dd-marea": "Past forty metres the bottom edge starts creeping up, faster and faster. It turns red when it starts.",
  "como.h-puntaje": "Scoring",
  "como.puntaje": "It's the <b>metres</b>, and the only way to earn them is to let go. Hanging on is free and safe until the floor catches you; the game offers you the same deal the whole time, and you decide how much of it to take.",
  "como.h-hecho": "What it's made of",
  "como.hecho1": "The tower is generated forever, and <b>every ring is placed within jumping range of the one before it</b>. That number didn't come from what looked nice: it is measured by playing, and a test re-measures it with the real physics and fails if somebody changes gravity and forgets about this.",
  "como.hecho2": "Everything is vector art except the character, the tower backdrop and the menu trim. The sound is oscillators and so is the in-game music: it plays itself, from a chord progression whose density rises with your height and speed. The only audio file is the menu theme.",

  "hud.salir": "Back to menu",

  "fin.record": "NEW BEST!",
  "fin.rotulo": "You fell",
  "fin.otra": "AGAIN",
  "fin.otra-aria": "Again",
  "fin.menu": "To menu",
  "fin.tuercas": "Nuts",
  "fin.puntaje": "Score",
  "fin.mejor": "Best height",

  "piso.sotano": "The basement",
  "piso.oficinas": "The offices",
  "piso.taller": "The workshop",
  "piso.antenas": "The antennas",
  "piso.nubes": "Above the clouds",
};

const PT = {
  "doc.titulo": "Gancho — uma torre sem teto",
  "doc.desc": "Uma torre sem teto e um gancho. Toque para se prender, arraste para balançar, solte para voar.",
  "doc.lienzo": "A torre",

  "idioma.titulo": "Escolha seu idioma",
  "idioma.bajada": "Dá para mudar depois pelo menu.",

  "menu.bajada": "<b>Toque</b> numa argola e o gancho crava. <b>Arraste</b> para balançar. <b>Solte</b> e você sai pela tangente.",
  "menu.jugar": "SUBIR",
  "menu.jugar-aria": "Subir",
  "menu.mejor": "Melhor altura",
  "menu.partidas": "{n} tentativas",
  "menu.partidas1": "1 tentativa",
  "menu.como": "? Como se joga",
  "menu.sonido": "Som",
  "menu.musica": "Música",
  "menu.borrar": "Apagar",
  "menu.borrar-confirmar": "Apagar o recorde?",
  "menu.idioma": "Idioma",

  "como.titulo": "Como se joga",
  "como.atras": "← Voltar",
  "como.destacado": "Um dedo faz tudo. <b>Toque numa argola</b> e o gancho crava nela. <b>Arraste o dedo</b> para balançar, igual a esticar as pernas num balanço. <b>Solte</b> e você sai voando por onde já ia.",
  "como.h-truco": "O truque",
  "como.truco": "Você sai <b>pela tangente</b>, não para onde está olhando. Soltando embaixo você sai rápido mas de lado; soltando em cima você sai devagar mas para cima. Não existe um momento certo: existe um diferente para cada argola que você quer alcançar.",
  "como.h-hay": "O que tem lá em cima",
  "como.dt-argollas": "As argolas",
  "como.dd-argollas": "Prendem ao toque se estiverem a menos de <b>168 pixels</b>. A corda fica do tamanho que já tinha: prender nunca dá tranco.",
  "como.dt-oxidadas": "As enferrujadas",
  "como.dd-oxidadas": "Laranjas. Aguentam <b>oito décimos de segundo</b> e arrebentam, com um relógio em volta enquanto você está pendurado. Solte antes que ela solte você: assim quem escolhe a direção é você.",
  "como.dt-tuercas": "As porcas",
  "como.dd-tuercas": "Ficam fora da linha boa de propósito. Pegar uma custa soltar mais tarde do que convém.",
  "como.dt-paredes": "As paredes",
  "como.dd-paredes": "Ricocheteiam e comem mais da metade do embalo lateral. Não matam, mas custam uma argola.",
  "como.dt-marea": "O chão que sobe",
  "como.dd-marea": "A partir dos quarenta metros a borda de baixo começa a subir sozinha, cada vez mais rápido. Fica vermelha quando começa.",
  "como.h-puntaje": "A pontuação",
  "como.puntaje": "São os <b>metros</b>, e o único jeito de ganhá-los é soltar. Ficar pendurado é de graça e seguro até o chão te alcançar; o jogo te oferece o mesmo trato o tempo todo, e você decide o quanto aceita.",
  "como.h-hecho": "Do que é feito",
  "como.hecho1": "A torre é gerada para sempre, e <b>cada argola é posta dentro do que dá para saltar da anterior</b>. Esse número não saiu do que ficava bonito: está medido jogando, e tem um teste que remede com a física de verdade e falha se alguém mexer na gravidade e esquecer disto.",
  "como.hecho2": "Tudo é vetorial menos o bicho, o fundo da torre e o enfeite dos menus. O som são osciladores e a música do jogo também: ela se toca sozinha, com uma progressão de acordes cuja densidade sobe com a altura e a velocidade. O único arquivo de áudio é o tema do menu.",

  "hud.salir": "Voltar ao menu",

  "fin.record": "RECORDE!",
  "fin.rotulo": "Você caiu",
  "fin.otra": "DE NOVO",
  "fin.otra-aria": "De novo",
  "fin.menu": "Ao menu",
  "fin.tuercas": "Porcas",
  "fin.puntaje": "Pontos",
  "fin.mejor": "Melhor altura",

  "piso.sotano": "O porão",
  "piso.oficinas": "Os escritórios",
  "piso.taller": "A oficina",
  "piso.antenas": "As antenas",
  "piso.nubes": "Acima das nuvens",
};

const TABLA = { es: ES, en: EN, pt: PT };
let actual = "en";

export const idioma = () => actual;

export function ponerIdioma(cod) {
  actual = TABLA[cod] ? cod : "en";
  document.documentElement.lang = { es: "es-AR", en: "en", pt: "pt-BR" }[actual];
  return actual;
}

/** Lo que falte cae al inglés; lo que falte también ahí devuelve la clave, que
 *  en pantalla se ve mal a propósito y así se encuentra sin leer tres tablas. */
export function t(clave, vars) {
  let s = TABLA[actual][clave] ?? EN[clave] ?? clave;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

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
