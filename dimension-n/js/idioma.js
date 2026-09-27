// Los textos, en castellano, inglés y portugués de Brasil.
//
// EL HTML LLEVA UNA CLAVE POR LUGAR (`data-t`, `data-t-html`, `data-t-attr`) y
// la tabla decide qué se escribe: tres copias del index.html se desincronizan a
// la primera corrección.
//
// LO QUE DICEN RILO Y TITO EN CASTELLANO SALE DE nivel.js Y mapas.js, no se
// copia acá: generar_voces.py lee esas mismas líneas para grabar las voces, y
// una segunda copia en esta tabla sería una frase que se corrige en un lado y
// en el otro no — el subtítulo diría una cosa y la voz otra.

import { CAPITULOS, FINAL } from "./nivel.js";
import { NIVELES_P } from "./mapas.js";

export const IDIOMAS = { es: "Español", en: "English", pt: "Português" };

const ES = {
  "doc.titulo": "Dimensión Ñ",
  "doc.desc": "Un juego de caída con ragdoll de verdad: dos cuerpos articulados atados por una soga, física de Verlet y un modo de portales.",
  "doc.lienzo": "El pozo",

  "menu.bajada": "Un viejo, su nieto, una soga y dos juegos con la misma física. Lo único que hacés es <b>empujar</b>.",
  "tab.jugar": "Jugar", "tab.records": "Récords", "tab.opciones": "Opciones", "tab.como": "Cómo", "tab.creditos": "Créditos",
  "tabs.aria": "Secciones del menú",

  "pozo.titulo": "El pozo",
  "pozo.sub": "104 metros en siete capítulos, sin frenos. La pregunta es ¿llego?",
  "pozo.progreso": "Capítulo más hondo: {cap}",
  "pozo.nada": "Todavía no bajaste.",
  "pozo.seguir": "▼ Seguir: {cap}",
  "pozo.empezar": "▼ Desde arriba",
  "pozo.caps": "{n} de {t} capítulos",
  "portales.titulo": "Portales",
  "portales.sub": "Quince niveles de pantalla fija. Sin reloj: la pregunta es ¿por dónde?",
  "portales.cuenta": "{n} de {t} resueltos",
  "portales.elegir": "◉ Elegir nivel",
  "portales.seguir": "◉ Seguir: nivel {n}",
  "portales.todos": "◉ Los quince, resueltos",

  "rec.titulo": "Lo que llevás",
  "rec.caida": "Mejor caída",
  "rec.chatarra": "Chatarra en una bajada",
  "rec.cap": "Capítulo más hondo",
  "rec.partidas": "Bajadas empezadas",
  "rec.llegadas": "Veces que llegaron al fondo",
  "rec.desarmes": "Veces que Rilo se desarmó",
  "rec.portales": "Niveles de portales resueltos",
  "rec.chatarraP": "Chatarra juntada en portales",
  "rec.tiros": "Portales disparados",
  "rec.m": "{n} m",
  "rec.de": "{n} de {t}",
  "rec.ninguno": "—",

  "op.titulo": "Opciones",
  "op.sonido": "Sonido",
  "op.efectos": "Efectos",
  "op.musica": "Música (el zumbido del pozo)",
  "op.voces": "Voces",
  "op.voces-nota": "",
  "op.idioma": "Idioma",
  "op.cambiar": "Cambiar",
  "op.borrar": "Borrar progreso y récords",
  "op.borrar-seguro": "¿Seguro? Tocá otra vez para borrar",
  "op.borrado": "Borrado.",

  "cre.titulo": "Créditos",
  "cre.juego": "Juego, física, dibujo y textos: hechos para este repositorio. Rilo y Tito son personajes propios, generados a partir de una descripción escrita para este juego; la idea es un homenaje declarado.",
  "cre.voces": "Las voces son sintetizadas diciendo las líneas del juego. No hay grabaciones de ninguna persona.",
  "cre.sonidos": "Sonidos grabados",
  "cre.cc0": "De dominio público (CC0), sin obligación de citar, y igual se agradece: {lista}.",
  "cre.ccby": "Con licencia CC-BY, que pide nombrar al autor:",
  "cre.sinccby": "Ninguno de los sonidos de este juego es CC-BY: todos son CC0.",
  "cre.sintesis": "El zumbido del pozo y los respaldos, sintetizados en el navegador.",

  "niv.titulo": "Portales",
  "niv.cerrado": "cerrado",
  "atras": "← Atrás",

  "hud.salir": "Volver al menú",
  "hud.bolita": "Hacerse bolita",
  "hud.reintentar": "Reintentar el nivel",
  "hud.m": "{n} m",
  "hud.tiros": "{n} tiros",
  "hud.tiros1": "1 tiro",
  "hud.nivel": "{n}. {nombre}",

  "fin.titulo": "Llegaron",
  "fin.prof": "Profundidad",
  "fin.chatarra": "Chatarra",
  "fin.de": "{n} de {t}",
  "fin.integridad": "Integridad final",
  "fin.otra": "Otra vez",
  "fin.menu": "Al menú",

  "err.bucle": "Algo se rompió adentro del juego y se volvió al menú.",

  "como.pozo": "El pozo",
  "como.destacado": "Tocá la pantalla <b>donde sea</b>: el reactor de Rilo empuja hacia tu dedo. Cuanto más lejos el dedo, más fuerte el empujón. Soltá y caés derecho. En la compu, las flechas.",
  "como.h-dos": "Los dos",
  "como.dt-rilo": "Rilo", "como.dd-rilo": "El abuelo. Es el que manejás. Si se desarma, se acabó.",
  "como.dt-tito": "Tito", "como.dd-tito": "El nieto. Cuelga de una soga de tu mano izquierda y <b>pesa</b>: te arrastra en las curvas y se lleva puesto lo que vos esquivaste.",
  "como.h-hay": "Lo que hay",
  "como.dt-int": "Integridad", "como.dd-int": "La barra de arriba. Cada golpe fuerte te come un pedazo. Los golpes flojos no cuestan nada: se puede bajar entero.",
  "como.dt-bolita": "Bolita", "como.dd-bolita": "El botón de abajo a la derecha, un segundo dedo, o la barra espaciadora. El cuerpo se hace un ovillo y el golpe se reparte entre once puntos en vez de clavar la cabeza: <b>descuenta dos tercios del daño</b>.",
  "como.dt-portal": "Portales", "como.dd-portal": "Uno al final de cada capítulo. Es punto de guardado y te devuelve 26 de integridad. Si te desarmás, volvés al último.",
  "como.dt-puas": "Púas", "como.dd-puas": "Duelen sin necesidad de que vengas rápido. Esquivalas.",
  "como.dt-resortes": "Resortes", "como.dd-resortes": "Te devuelven para arriba. A veces conviene.",
  "como.dt-gel": "Gelatina", "como.dd-gel": "Adentro se cae en cámara lenta. Es el único lugar donde podés acomodarte.",
  "como.dt-chat": "Chatarra", "como.dd-chat": "17 pedazos escondidos en los siete capítulos. No sirven para nada y por eso están.",
  "como.h-portales": "El otro modo: portales",
  "como.destacado2": "Quince niveles de pantalla fija. No hay reloj y no hay prisa: todo lo que necesitás para resolverlo lo estás viendo.",
  "como.dt-tocar": "Tocar", "como.dd-tocar": "Un toque corto <b>dispara un portal</b> hacia donde tocaste. El color del próximo está abajo a la izquierda, y va alternando: hacen falta los dos para que sirvan.",
  "como.dt-arrastrar": "Arrastrar", "como.dd-arrastrar": "Mantener el dedo y moverlo es el reactor, igual que en el pozo. Lo que distingue un disparo de un empujón es el gesto, no en qué mitad de la pantalla lo hiciste.",
  "como.dt-azul": "Pared azul", "como.dd-azul": "Ahí se puede clavar un portal.",
  "como.dt-negra": "Pared negra", "como.dd-negra": "Ahí rebota el tiro. Buscá otra cara.",
  "como.dt-techo": "Techo y piso", "como.dd-techo": "Siempre se puede disparar. Es la salida cuando un tabique te tapa todo lo demás: se tira arriba y se sale cayendo del otro lado.",
  "como.dt-placas": "Las placas", "como.dd-placas": "Se aprietan con <b>peso</b>, y vos tenés uno colgando de una soga. Hay puertas que no se abren si no dejás a Tito parado encima mientras vos vas a otro lado.",
  "como.dt-rapido": "Caer rápido", "como.dd-rapido": "Entrar a un portal cayendo de muy alto y salir por uno de costado te dispara lejos. Es la mitad de los niveles.",
  "como.h-hecho": "De qué está hecho",
  "como.hecho1": "Los dos modos comparten la misma física. Los cuerpos son <b>ragdolls de verdad</b>: once puntos cada uno, unidos por huesos que no se estiran, resueltos con integración de Verlet. No hay animaciones: cada pose que ves es la física resolviéndose.",
  "como.hecho2": "Con el teléfono acostado el juego no se acuesta: se queda vertical, pegado al teléfono, y se juega de costado usando la pantalla entera.",
};

const EN = {
  "doc.titulo": "Dimension Ñ",
  "doc.desc": "A falling game with real ragdolls: two jointed bodies tied by a rope, Verlet physics and a portal mode.",
  "doc.lienzo": "The pit",

  "menu.bajada": "An old man, his grandson, a rope and two games with the same physics. All you do is <b>push</b>.",
  "tab.jugar": "Play", "tab.records": "Records", "tab.opciones": "Options", "tab.como": "How to", "tab.creditos": "Credits",
  "tabs.aria": "Menu sections",

  "pozo.titulo": "The pit",
  "pozo.sub": "104 metres in seven chapters, no brakes. The question is: will I make it?",
  "pozo.progreso": "Deepest chapter: {cap}",
  "pozo.nada": "You haven't gone down yet.",
  "pozo.seguir": "▼ Continue: {cap}",
  "pozo.empezar": "▼ From the top",
  "pozo.caps": "{n} of {t} chapters",
  "portales.titulo": "Portals",
  "portales.sub": "Fifteen single-screen levels. No clock: the question is which way?",
  "portales.cuenta": "{n} of {t} solved",
  "portales.elegir": "◉ Choose a level",
  "portales.seguir": "◉ Continue: level {n}",
  "portales.todos": "◉ All fifteen solved",

  "rec.titulo": "Your progress",
  "rec.caida": "Best fall",
  "rec.chatarra": "Scrap in one run",
  "rec.cap": "Deepest chapter",
  "rec.partidas": "Runs started",
  "rec.llegadas": "Times you reached the bottom",
  "rec.desarmes": "Times Rilo fell apart",
  "rec.portales": "Portal levels solved",
  "rec.chatarraP": "Scrap collected in portals",
  "rec.tiros": "Portals fired",
  "rec.m": "{n} m",
  "rec.de": "{n} of {t}",
  "rec.ninguno": "—",

  "op.titulo": "Options",
  "op.sonido": "Sound",
  "op.efectos": "Effects",
  "op.musica": "Music (the pit's hum)",
  "op.voces": "Voices",
  "op.voces-nota": "The voices are recorded in Spanish; the subtitles are in English.",
  "op.idioma": "Language",
  "op.cambiar": "Change",
  "op.borrar": "Erase progress and records",
  "op.borrar-seguro": "Sure? Tap again to erase",
  "op.borrado": "Erased.",

  "cre.titulo": "Credits",
  "cre.juego": "Game, physics, art and writing: made for this repository. Rilo and Tito are original characters, generated from a description written for this game; the idea is an open homage.",
  "cre.voces": "The voices are synthesized reading the game's lines. There are no recordings of any real person.",
  "cre.sonidos": "Recorded sounds",
  "cre.cc0": "Public domain (CC0), no attribution required, thanks anyway: {lista}.",
  "cre.ccby": "Licensed CC-BY, which asks to name the author:",
  "cre.sinccby": "None of this game's sounds is CC-BY: they are all CC0.",
  "cre.sintesis": "The pit's hum and the fallbacks are synthesized in the browser.",

  "niv.titulo": "Portals",
  "niv.cerrado": "locked",
  "atras": "← Back",

  "hud.salir": "Back to the menu",
  "hud.bolita": "Curl into a ball",
  "hud.reintentar": "Retry the level",
  "hud.m": "{n} m",
  "hud.tiros": "{n} shots",
  "hud.tiros1": "1 shot",
  "hud.nivel": "{n}. {nombre}",

  "fin.titulo": "They made it",
  "fin.prof": "Depth",
  "fin.chatarra": "Scrap",
  "fin.de": "{n} of {t}",
  "fin.integridad": "Final integrity",
  "fin.otra": "Again",
  "fin.menu": "To the menu",

  "err.bucle": "Something broke inside the game and you're back at the menu.",

  "como.pozo": "The pit",
  "como.destacado": "Touch the screen <b>anywhere</b>: Rilo's jetpack pushes toward your finger. The farther the finger, the harder the push. Let go and you fall straight. On a computer, the arrow keys.",
  "como.h-dos": "The two of them",
  "como.dt-rilo": "Rilo", "como.dd-rilo": "The grandfather. He's the one you control. If he falls apart, it's over.",
  "como.dt-tito": "Tito", "como.dd-tito": "The grandson. He hangs from a rope in your left hand and he <b>weighs</b>: he drags you around the bends and runs into whatever you dodged.",
  "como.h-hay": "What's down there",
  "como.dt-int": "Integrity", "como.dd-int": "The bar at the top. Every hard hit takes a chunk. Soft bumps cost nothing: you can make it down in one piece.",
  "como.dt-bolita": "Ball", "como.dd-bolita": "The button at the bottom right, a second finger, or the space bar. The body curls up and the hit is spread over eleven points instead of landing on the head: <b>it takes off two thirds of the damage</b>.",
  "como.dt-portal": "Portals", "como.dd-portal": "One at the end of each chapter. It's a checkpoint and gives you back 26 integrity. If you fall apart, you go back to the last one.",
  "como.dt-puas": "Spikes", "como.dd-puas": "They hurt even if you arrive slowly. Dodge them.",
  "como.dt-resortes": "Springs", "como.dd-resortes": "They send you back up. Sometimes that helps.",
  "como.dt-gel": "Jelly", "como.dd-gel": "Inside it you fall in slow motion. It's the only place where you can get your bearings.",
  "como.dt-chat": "Scrap", "como.dd-chat": "17 pieces hidden across the seven chapters. They're useless, and that's why they're there.",
  "como.h-portales": "The other mode: portals",
  "como.destacado2": "Fifteen single-screen levels. No clock and no rush: everything you need to solve it is right in front of you.",
  "como.dt-tocar": "Tap", "como.dd-tocar": "A short tap <b>fires a portal</b> toward where you tapped. The colour of the next one is at the bottom left, and it alternates: you need both for them to work.",
  "como.dt-arrastrar": "Drag", "como.dd-arrastrar": "Holding the finger and moving it is the jetpack, just like in the pit. What tells a shot from a push is the gesture, not which half of the screen you used.",
  "como.dt-azul": "Blue wall", "como.dd-azul": "You can stick a portal there.",
  "como.dt-negra": "Black wall", "como.dd-negra": "Shots bounce off it. Find another face.",
  "como.dt-techo": "Ceiling and floor", "como.dd-techo": "You can always shoot them. It's the way out when a partition blocks everything else: shoot up and come out falling on the other side.",
  "como.dt-placas": "Plates", "como.dd-placas": "They're pressed by <b>weight</b>, and you have some hanging from a rope. Some doors only open if you leave Tito standing on the plate while you go somewhere else.",
  "como.dt-rapido": "Falling fast", "como.dd-rapido": "Entering a portal after a long fall and coming out of a sideways one launches you far. That's half the levels.",
  "como.h-hecho": "What it's made of",
  "como.hecho1": "Both modes share the same physics. The bodies are <b>real ragdolls</b>: eleven points each, joined by bones that don't stretch, solved with Verlet integration. There are no animations: every pose you see is the physics working itself out.",
  "como.hecho2": "With the phone lying sideways the game doesn't lie down with it: it stays upright, stuck to the phone, and you play it sideways using the whole screen.",
};

const PT = {
  "doc.titulo": "Dimensão Ñ",
  "doc.desc": "Um jogo de queda com ragdoll de verdade: dois corpos articulados amarrados por uma corda, física de Verlet e um modo de portais.",
  "doc.lienzo": "O poço",

  "menu.bajada": "Um velho, o neto, uma corda e dois jogos com a mesma física. Tudo o que você faz é <b>empurrar</b>.",
  "tab.jugar": "Jogar", "tab.records": "Recordes", "tab.opciones": "Opções", "tab.como": "Como", "tab.creditos": "Créditos",
  "tabs.aria": "Seções do menu",

  "pozo.titulo": "O poço",
  "pozo.sub": "104 metros em sete capítulos, sem freio. A pergunta é: será que eu chego?",
  "pozo.progreso": "Capítulo mais fundo: {cap}",
  "pozo.nada": "Você ainda não desceu.",
  "pozo.seguir": "▼ Continuar: {cap}",
  "pozo.empezar": "▼ Do começo",
  "pozo.caps": "{n} de {t} capítulos",
  "portales.titulo": "Portais",
  "portales.sub": "Quinze fases de tela fixa. Sem relógio: a pergunta é por onde?",
  "portales.cuenta": "{n} de {t} resolvidas",
  "portales.elegir": "◉ Escolher fase",
  "portales.seguir": "◉ Continuar: fase {n}",
  "portales.todos": "◉ As quinze resolvidas",

  "rec.titulo": "Seu progresso",
  "rec.caida": "Melhor queda",
  "rec.chatarra": "Sucata numa descida",
  "rec.cap": "Capítulo mais fundo",
  "rec.partidas": "Descidas começadas",
  "rec.llegadas": "Vezes que chegaram ao fundo",
  "rec.desarmes": "Vezes que o Rilo se desmontou",
  "rec.portales": "Fases de portais resolvidas",
  "rec.chatarraP": "Sucata juntada nos portais",
  "rec.tiros": "Portais disparados",
  "rec.m": "{n} m",
  "rec.de": "{n} de {t}",
  "rec.ninguno": "—",

  "op.titulo": "Opções",
  "op.sonido": "Som",
  "op.efectos": "Efeitos",
  "op.musica": "Música (o zumbido do poço)",
  "op.voces": "Vozes",
  "op.voces-nota": "As vozes estão gravadas em espanhol; as legendas estão em português.",
  "op.idioma": "Idioma",
  "op.cambiar": "Trocar",
  "op.borrar": "Apagar progresso e recordes",
  "op.borrar-seguro": "Certeza? Toque de novo para apagar",
  "op.borrado": "Apagado.",

  "cre.titulo": "Créditos",
  "cre.juego": "Jogo, física, desenho e textos: feitos para este repositório. Rilo e Tito são personagens próprios, gerados a partir de uma descrição escrita para este jogo; a ideia é uma homenagem declarada.",
  "cre.voces": "As vozes são sintetizadas lendo as falas do jogo. Não há gravações de nenhuma pessoa real.",
  "cre.sonidos": "Sons gravados",
  "cre.cc0": "Domínio público (CC0), sem obrigação de citar, e mesmo assim obrigado: {lista}.",
  "cre.ccby": "Com licença CC-BY, que pede para nomear o autor:",
  "cre.sinccby": "Nenhum som deste jogo é CC-BY: todos são CC0.",
  "cre.sintesis": "O zumbido do poço e os sons de reserva são sintetizados no navegador.",

  "niv.titulo": "Portais",
  "niv.cerrado": "trancada",
  "atras": "← Voltar",

  "hud.salir": "Voltar ao menu",
  "hud.bolita": "Virar bolinha",
  "hud.reintentar": "Tentar a fase de novo",
  "hud.m": "{n} m",
  "hud.tiros": "{n} tiros",
  "hud.tiros1": "1 tiro",
  "hud.nivel": "{n}. {nombre}",

  "fin.titulo": "Chegaram",
  "fin.prof": "Profundidade",
  "fin.chatarra": "Sucata",
  "fin.de": "{n} de {t}",
  "fin.integridad": "Integridade final",
  "fin.otra": "De novo",
  "fin.menu": "Ao menu",

  "err.bucle": "Algo quebrou dentro do jogo e você voltou ao menu.",

  "como.pozo": "O poço",
  "como.destacado": "Toque na tela <b>em qualquer lugar</b>: o propulsor do Rilo empurra na direção do seu dedo. Quanto mais longe o dedo, mais forte o empurrão. Solte e você cai reto. No computador, as setas.",
  "como.h-dos": "Os dois",
  "como.dt-rilo": "Rilo", "como.dd-rilo": "O avô. É quem você controla. Se ele se desmontar, acabou.",
  "como.dt-tito": "Tito", "como.dd-tito": "O neto. Fica pendurado numa corda na sua mão esquerda e <b>pesa</b>: te arrasta nas curvas e leva junto o que você desviou.",
  "como.h-hay": "O que tem lá",
  "como.dt-int": "Integridade", "como.dd-int": "A barra de cima. Cada pancada forte come um pedaço. Batidinhas não custam nada: dá para descer inteiro.",
  "como.dt-bolita": "Bolinha", "como.dd-bolita": "O botão de baixo à direita, um segundo dedo ou a barra de espaço. O corpo se encolhe e a pancada se divide entre onze pontos em vez de ir toda na cabeça: <b>tira dois terços do dano</b>.",
  "como.dt-portal": "Portais", "como.dd-portal": "Um no fim de cada capítulo. É ponto de salvamento e devolve 26 de integridade. Se você se desmontar, volta para o último.",
  "como.dt-puas": "Espinhos", "como.dd-puas": "Machucam mesmo se você chegar devagar. Desvie.",
  "como.dt-resortes": "Molas", "como.dd-resortes": "Te jogam de volta pra cima. Às vezes ajuda.",
  "como.dt-gel": "Gelatina", "como.dd-gel": "Lá dentro se cai em câmera lenta. É o único lugar onde dá para se ajeitar.",
  "como.dt-chat": "Sucata", "como.dd-chat": "17 pedaços escondidos nos sete capítulos. Não servem para nada e é por isso que estão lá.",
  "como.h-portales": "O outro modo: portais",
  "como.destacado2": "Quinze fases de tela fixa. Sem relógio e sem pressa: tudo o que você precisa para resolver está na sua frente.",
  "como.dt-tocar": "Tocar", "como.dd-tocar": "Um toque curto <b>dispara um portal</b> na direção em que você tocou. A cor do próximo fica embaixo à esquerda e vai alternando: precisa dos dois para funcionar.",
  "como.dt-arrastrar": "Arrastar", "como.dd-arrastrar": "Segurar o dedo e mexer é o propulsor, igual no poço. O que diferencia um tiro de um empurrão é o gesto, não em que metade da tela você fez.",
  "como.dt-azul": "Parede azul", "como.dd-azul": "Ali dá para cravar um portal.",
  "como.dt-negra": "Parede preta", "como.dd-negra": "Ali o tiro ricocheteia. Procure outra face.",
  "como.dt-techo": "Teto e chão", "como.dd-techo": "Sempre dá para atirar. É a saída quando uma divisória tapa todo o resto: atire pra cima e saia caindo do outro lado.",
  "como.dt-placas": "As placas", "como.dd-placas": "Afundam com <b>peso</b>, e você tem um pendurado numa corda. Tem portas que só abrem se você deixar o Tito parado em cima enquanto vai para outro lugar.",
  "como.dt-rapido": "Cair rápido", "como.dd-rapido": "Entrar num portal caindo de muito alto e sair por um de lado te lança longe. É metade das fases.",
  "como.h-hecho": "Do que é feito",
  "como.hecho1": "Os dois modos usam a mesma física. Os corpos são <b>ragdolls de verdade</b>: onze pontos cada um, ligados por ossos que não esticam, resolvidos com integração de Verlet. Não há animações: cada pose que você vê é a física se resolvendo.",
  "como.hecho2": "Com o celular deitado o jogo não deita junto: fica em pé, grudado no celular, e se joga de lado usando a tela inteira.",
};

// Lo que dicen, los capítulos y los niveles, en inglés y en portugués. El
// orden es el de nivel.js y mapas.js; la prueba de idiomas compara las
// cantidades para que un capítulo nuevo no quede mudo en dos idiomas.
const CAP = {
  en: ["The garage", "The pipes", "The syrup factory", "The void", "The belly", "The dimension dump", "The fridge"],
  pt: ["A garagem", "Os encanamentos", "A fábrica de xarope", "O vazio", "A barriga", "O lixão de dimensões", "A geladeira"],
};
const DICE = {
  en: [
    ["Okay Tito, the portal ended up on the floor. Jump.", "And what's down there, Grandpa?", "Yes."],
    ["These are pipes! Pipes of what?!", "From dimension Ñ. Here water flows upward.", "That doesn't answer anything."],
    ["Don't touch the blades.", "And what if they touch me?", "Then that's your problem."],
    ["There are no walls. There are no walls!", "Aim well, then."],
    ["Grandpa… this thing is beating.", "It's a belly, Tito. Sooner or later it passes."],
    ["This is where they dump the realities that didn't work.", "There are like forty of you lying there.", "Thirty-eight. Keep going."],
    ["We made it.", "All this for a fridge?", "For what's inside. Open it."],
  ],
  pt: [
    ["Bom, Tito, o portal ficou no chão. Pula.", "E o que tem lá embaixo, vô?", "Sim."],
    ["Isso são canos! Canos de quê?!", "Da dimensão Ñ. Aqui a água corre pra cima.", "Isso não responde nada."],
    ["Não encosta nas pás.", "E se elas encostarem em mim?", "Aí o problema é seu."],
    ["Não tem paredes. Não tem paredes!", "Então mira direito."],
    ["Vô… isso aqui está pulsando.", "É uma barriga, Tito. Mais cedo ou mais tarde passa."],
    ["Aqui jogam fora as realidades que não deram certo.", "Tem uns quarenta de você jogados ali.", "Trinta e oito. Continua."],
    ["Chegamos.", "Tudo isso por uma geladeira?", "Pelo que tem dentro. Abre."],
  ],
};
const FIN = {
  en: ["…it's a sandwich.", "It's THE sandwich, Tito. In ninety realities it doesn't exist.",
       "And why did you bring me?", "Because we're splitting it in half. I'm not a monster."],
  pt: ["…é um sanduíche.", "É O sanduíche, Tito. Em noventa realidades ele não existe.",
       "E por que você me trouxe?", "Porque a gente vai dividir no meio. Eu não sou um monstro."],
};
const NIV = {
  en: [
    ["The other side", "Tap to shoot. You need both portals."],
    ["The pit", "Spikes hurt even if you arrive slowly."],
    ["Momentum", "Falling through a portal keeps your speed."],
    ["Ceiling", "Shoot the ceiling over there and you fall from over there."],
    ["Tito's weight", "The plate needs weight. You have one hanging."],
    ["Jelly", "Inside the green everything goes in slow motion."],
    ["Black wall", "Shots bounce off black. Find another face."],
    ["Two plates", "Both at once, and there's only one of you."],
    ["The spring", "The green stuff throws you back up."],
    ["Tower", "Going up works too."],
    ["Back and forth", "In through one face, out through the next one."],
    ["Two spikes", "There's no clean floor in the middle."],
    ["The detour", "The plate is in a pit. Someone has to fall in there."],
    ["Long drop", "The higher you go in, the farther you come out."],
    ["The last bridge", "Everything at once. Good luck."],
  ],
  pt: [
    ["Do outro lado", "Toque para disparar. Precisa dos dois portais."],
    ["O poço", "Os espinhos machucam mesmo se você chegar devagar."],
    ["Impulso", "Cair por um portal conserva a velocidade."],
    ["Teto", "Se atirar no teto de lá, você cai de lá."],
    ["O peso do Tito", "A placa afunda com peso. Você tem um pendurado."],
    ["Gelatina", "Dentro do verde tudo fica em câmera lenta."],
    ["Parede preta", "No preto o tiro ricocheteia. Procure outra face."],
    ["Duas placas", "As duas ao mesmo tempo, e você é um só."],
    ["A mola", "O verde te joga de volta pra cima."],
    ["Torre", "Pra cima também dá."],
    ["Vaivém", "Você entra por uma face e sai pela do lado."],
    ["Os dois espinhos", "Não tem chão limpo no meio."],
    ["O desvio", "A placa está num poço. Alguém tem que cair lá."],
    ["Queda longa", "Quanto mais alto você entra, mais longe você sai."],
    ["A última ponte", "Tudo junto. Boa sorte."],
  ],
};

CAPITULOS.forEach((c, i) => {
  ES[`cap.${i}`] = c.nombre;
  c.dice.forEach(([, txt], j) => { ES[`dlg.c${i}l${j}`] = txt; });
});
FINAL.forEach(([, txt], j) => { ES[`dlg.f${j}`] = txt; });
NIVELES_P.forEach((n, i) => { ES[`niv.${i}.nombre`] = n.nombre; ES[`niv.${i}.pista`] = n.pista; });
for (const [cod, tabla] of [["en", EN], ["pt", PT]]) {
  CAP[cod].forEach((n, i) => { tabla[`cap.${i}`] = n; });
  DICE[cod].forEach((ls, i) => ls.forEach((txt, j) => { tabla[`dlg.c${i}l${j}`] = txt; }));
  FIN[cod].forEach((txt, j) => { tabla[`dlg.f${j}`] = txt; });
  NIV[cod].forEach(([nom, pis], i) => { tabla[`niv.${i}.nombre`] = nom; tabla[`niv.${i}.pista`] = pis; });
}

export const TEXTOS = { es: ES, en: EN, pt: PT };
let actual = "es";

export const idioma = () => actual;

export function ponerIdioma(cod) {
  actual = TEXTOS[cod] ? cod : "es";
  if (typeof document !== "undefined")
    document.documentElement.lang = { es: "es-AR", en: "en", pt: "pt-BR" }[actual];
  return actual;
}

/** Lo que falte cae al castellano; lo que falte también ahí devuelve la clave,
 *  que en pantalla se ve mal a propósito y así se encuentra sin leer tablas. */
export function t(clave, vars) {
  let s = TEXTOS[actual][clave] ?? ES[clave] ?? clave;
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
  document.title = t("doc.titulo");
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", t("doc.desc"));
}
