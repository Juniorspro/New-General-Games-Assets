// Los textos del juego, en los tres idiomas.
//
// POR QUE UNA TABLA Y NO TRES HTML. Un juego traducido copiando el index.html
// tres veces se desincroniza a la primera correccion: se arregla un boton en
// uno y quedan dos con el texto viejo. Aca el HTML tiene UN texto por lugar
// —marcado con `data-t`— y la tabla decide cual se escribe. Lo que no esta
// traducido se nota al instante porque cae al ingles, que es el idioma base.
//
// EL IDIOMA POR DEFECTO ES INGLES, no el del navegador. La primera vez el
// juego pregunta, y esa eleccion se guarda; adivinar por `navigator.language`
// suena mejor pero le pone el idioma del sistema operativo a alguien que
// quizas quiere jugar en otro, y despues hay que buscar donde cambiarlo.
//
// El texto del HTML queda en castellano igual: si el modulo no carga, el
// juego se lee. Un fallback vacio seria peor que uno en un idioma equivocado.

import { AYUDA } from "./ayuda.js";

export const IDIOMAS = { en: "English", es: "Español", pt: "Português" };

// Los titulos de los 24 niveles. Viven aca y no en mundo.js porque mundo.js
// lo comparte el validador, que corre sin DOM y sin idioma.
const NIV = {
  es: ["Primeros pasos", "Abajo de todo", "Entre las nubes", "El primer portón",
       "Campo abierto", "No mires atrás", "Saltos de altura", "A bordo",
       "Arena caliente", "Lluvia de balas", "Caparazones", "Barras de fuego",
       "Para arriba", "Cuesta abajo", "Alto y bajo", "Los cañones",
       "Sin piso", "Cactus en fila", "Bajo llave", "Anillos de fuego",
       "Tierra de púas", "El interruptor", "Por la borda", "El último puente"],
  en: ["First steps", "Way down below", "Among the clouds", "The first gate",
       "Open field", "Don't look back", "High jumps", "On board",
       "Hot sand", "Bullet rain", "Shells", "Fire bars",
       "Straight up", "Downhill", "High and low", "The cannons",
       "No floor", "Cactus row", "Under lock", "Rings of fire",
       "Land of spikes", "The switch", "Overboard", "The last bridge"],
  pt: ["Primeiros passos", "Lá embaixo", "Entre as nuvens", "O primeiro portão",
       "Campo aberto", "Não olhe para trás", "Saltos de altura", "A bordo",
       "Areia quente", "Chuva de balas", "Cascos", "Barras de fogo",
       "Para cima", "Ladeira abaixo", "Alto e baixo", "Os canhões",
       "Sem chão", "Cactos em fila", "A sete chaves", "Anéis de fogo",
       "Terra de espinhos", "O interruptor", "Ao mar", "A última ponte"],
};

const TEMA = {
  es: { llano: "Llanura", subte: "Subterráneo", cielo: "Cielo", castillo: "Castillo",
        fantasma: "Casa fantasma", desierto: "Desierto", nave: "Nave", torre: "Torre" },
  en: { llano: "Plains", subte: "Underground", cielo: "Sky", castillo: "Castle",
        fantasma: "Ghost house", desierto: "Desert", nave: "Airship", torre: "Tower" },
  pt: { llano: "Planície", subte: "Subterrâneo", cielo: "Céu", castillo: "Castelo",
        fantasma: "Casa mal-assombrada", desierto: "Deserto", nave: "Nave", torre: "Torre" },
};

const ES = {
  "doc.titulo": "Pique — un corredor pixel art",
  "doc.desc": "Un corredor 2D con niveles generados por código y comprobados uno por uno antes de dejarte jugarlos.",

  "idioma.titulo": "Elegí tu idioma",
  "idioma.bajada": "Se puede cambiar después en Ajustes.",
  "idioma.seguir": "Seguir",

  "carga.arrancando": "Arrancando…",
  "carga.sprites": "Cargando sprites…",
  "carga.fondos": "Cargando fondos…",

  "inicio.bajada": "Corrés solo. Lo único que hacés es saltar — pero <em>cuándo</em> y <em>cuánto</em> es todo el juego.",
  "inicio.monedas": "monedas",
  "inicio.niveles": "niveles",
  "inicio.color": "de color",
  "inicio.jugar": "Jugar",
  "inicio.seguir": "Seguir",
  "inicio.btn-niveles": "Niveles",
  "inicio.btn-ayuda": "Cómo se juega",
  "inicio.btn-ajustes": "Ajustes",
  "inicio.pie": "24 niveles · generados por código · ninguno dibujado a mano",

  "comun.atras": "← Atrás",
  "comun.mundo": "Mundo",
  "comun.jefe": "jefe",
  "comun.terminado": "terminado",
  "comun.cerrado": "cerrado",
  "comun.aqui": "estás acá",

  "mapa.t-monedas": "monedas juntadas",
  "mapa.t-niveles": "niveles terminados",
  "mapa.t-color": "monedas de color: rosa · violeta · negra",

  "gen.armando": "Armando y comprobando que se pueda terminar…",
  "gen.sinvalidar": "sin validar",
  "gen.validado1": "validado en 1 intento",
  "gen.validadoN": "validado en {n} intentos",

  "hud.nivel": "Nivel",
  "hud.pausa": "Pausa / volver al mapa",
  "hud.pantalla": "Pantalla completa",
  "hud.izq": "Ir a la izquierda",
  "hud.der": "Ir a la derecha",
  "hud.saltar": "Saltar",

  "res.gano": "¡Llegaste!",
  "res.perdio": "Se acabó",
  "res.roto": "Se rompió algo",
  "res.causa.tiempo": "Se terminó el tiempo",
  "res.causa.pozo": "Al vacío",
  "res.causa.pinche": "Las púas",
  "res.causa.jefe": "El jefe te ganó",
  "res.causa.otro": "Un enemigo te ganó",
  "res.monedas": "Monedas",
  "res.bonus": "Bonus del mástil",
  "res.color": "Monedas de color",
  "res.burbujas": "Burbujas que quedaron",
  "res.tiempo": "Tiempo",
  "res.tiempoDe": "{a}s de {b}",
  "res.abierto": "Desbloqueado",
  "tier.rosa": "rosa",
  "tier.violeta": "violeta",
  "tier.negra": "negra",
  "res.abre.violeta": "monedas violetas",
  "res.abre.negra": "monedas negras",
  "res.abre.todo": "todo hecho",
  "res.seguir": "Siguiente",
  "res.repetir": "De nuevo",
  "res.mapa": "Al mapa",
  "res.perfecto": "¡Todas las de color!",
  "res.record": "Nuevo récord",
  "res.total": "Total juntado",

  "ayuda.titulo": "Cómo se juega",

  "aj.titulo": "Ajustes",
  "aj.sonido": "Efectos de sonido",
  "aj.musica": "Música",
  "aj.sacudida": "Sacudida de pantalla",
  "aj.mandos": "Botones en pantalla",
  "aj.idioma": "Idioma",
  "aj.movimiento": "Movimiento",
  "aj.libre": "Libre",
  "aj.corredor": "Corredor",
  "aj.nota-mov": "En <b>libre</b> el personaje se queda quieto hasta que le decís para dónde ir con la cruceta. En <b>corredor</b> corre solo y la cruceta nada más lo corrige, como en las primeras versiones.",
  "aj.graficos": "Gráficos",
  "aj.auto": "Automático",
  "aj.nitido": "Nítido",
  "aj.rapido": "Rápido",
  "aj.nota-graf": "En automático el juego mide cómo va en tu teléfono y baja la resolución solo si no llega a 60 cuadros por segundo.",
  "aj.nota-datos": "Nada de esto sale de tu navegador: el progreso se guarda en este aparato y no hay servidor ni cuenta.",
  "aj.borrar": "Borrar todo el progreso",
  "aj.confirmar": "¿Borrar todo el progreso? No se puede deshacer.",
};

const EN = {
  "doc.titulo": "Pique — a pixel art runner",
  "doc.desc": "A 2D runner with levels generated by code and checked one by one before you get to play them.",

  "idioma.titulo": "Choose your language",
  "idioma.bajada": "You can change it later in Settings.",
  "idioma.seguir": "Continue",

  "carga.arrancando": "Starting up…",
  "carga.sprites": "Loading sprites…",
  "carga.fondos": "Loading backgrounds…",

  "inicio.bajada": "You run on your own. All you do is jump — but <em>when</em> and <em>how long</em> is the whole game.",
  "inicio.monedas": "coins",
  "inicio.niveles": "levels",
  "inicio.color": "coloured",
  "inicio.jugar": "Play",
  "inicio.seguir": "Continue",
  "inicio.btn-niveles": "Levels",
  "inicio.btn-ayuda": "How to play",
  "inicio.btn-ajustes": "Settings",
  "inicio.pie": "24 levels · generated by code · none drawn by hand",

  "comun.atras": "← Back",
  "comun.mundo": "World",
  "comun.jefe": "boss",
  "comun.terminado": "finished",
  "comun.cerrado": "locked",
  "comun.aqui": "you are here",

  "mapa.t-monedas": "coins collected",
  "mapa.t-niveles": "levels finished",
  "mapa.t-color": "coloured coins: pink · purple · black",

  "gen.armando": "Building it and checking that it can be finished…",
  "gen.sinvalidar": "unvalidated",
  "gen.validado1": "validated in 1 try",
  "gen.validadoN": "validated in {n} tries",

  "hud.nivel": "Level",
  "hud.pausa": "Pause / back to the map",
  "hud.pantalla": "Fullscreen",
  "hud.izq": "Go left",
  "hud.der": "Go right",
  "hud.saltar": "Jump",

  "res.gano": "You made it!",
  "res.perdio": "Game over",
  "res.roto": "Something broke",
  "res.causa.tiempo": "Time ran out",
  "res.causa.pozo": "Into the void",
  "res.causa.pinche": "The spikes",
  "res.causa.jefe": "The boss got you",
  "res.causa.otro": "An enemy got you",
  "res.monedas": "Coins",
  "res.bonus": "Flagpole bonus",
  "res.color": "Coloured coins",
  "res.burbujas": "Bubbles left",
  "res.tiempo": "Time",
  "res.tiempoDe": "{a}s out of {b}",
  "res.abierto": "Unlocked",
  "tier.rosa": "pink",
  "tier.violeta": "purple",
  "tier.negra": "black",
  "res.abre.violeta": "purple coins",
  "res.abre.negra": "black coins",
  "res.abre.todo": "all done",
  "res.seguir": "Next",
  "res.repetir": "Again",
  "res.mapa": "To the map",
  "res.perfecto": "Every coloured coin!",
  "res.record": "New record",
  "res.total": "Total collected",

  "ayuda.titulo": "How to play",

  "aj.titulo": "Settings",
  "aj.sonido": "Sound effects",
  "aj.musica": "Music",
  "aj.sacudida": "Screen shake",
  "aj.mandos": "On-screen buttons",
  "aj.idioma": "Language",
  "aj.movimiento": "Movement",
  "aj.libre": "Free",
  "aj.corredor": "Runner",
  "aj.nota-mov": "In <b>free</b> the character stands still until you tell it where to go with the pad. In <b>runner</b> it runs on its own and the pad only steers it, like the earliest versions.",
  "aj.graficos": "Graphics",
  "aj.auto": "Automatic",
  "aj.nitido": "Sharp",
  "aj.rapido": "Fast",
  "aj.nota-graf": "On automatic the game measures how it runs on your phone and only lowers the resolution if it can't hold 60 frames per second.",
  "aj.nota-datos": "None of this leaves your browser: progress is saved on this device and there is no server and no account.",
  "aj.borrar": "Erase all progress",
  "aj.confirmar": "Erase all progress? This cannot be undone.",
};

const PT = {
  "doc.titulo": "Pique — um corredor em pixel art",
  "doc.desc": "Um corredor 2D com fases geradas por código e testadas uma por uma antes de deixar você jogar.",

  "idioma.titulo": "Escolha o seu idioma",
  "idioma.bajada": "Dá para mudar depois em Ajustes.",
  "idioma.seguir": "Continuar",

  "carga.arrancando": "Iniciando…",
  "carga.sprites": "Carregando sprites…",
  "carga.fondos": "Carregando fundos…",

  "inicio.bajada": "Você corre sozinho. Tudo o que faz é pular — mas <em>quando</em> e <em>por quanto tempo</em> é o jogo inteiro.",
  "inicio.monedas": "moedas",
  "inicio.niveles": "fases",
  "inicio.color": "coloridas",
  "inicio.jugar": "Jogar",
  "inicio.seguir": "Continuar",
  "inicio.btn-niveles": "Fases",
  "inicio.btn-ayuda": "Como se joga",
  "inicio.btn-ajustes": "Ajustes",
  "inicio.pie": "24 fases · geradas por código · nenhuma desenhada à mão",

  "comun.atras": "← Voltar",
  "comun.mundo": "Mundo",
  "comun.jefe": "chefe",
  "comun.terminado": "concluída",
  "comun.cerrado": "trancada",
  "comun.aqui": "você está aqui",

  "mapa.t-monedas": "moedas juntadas",
  "mapa.t-niveles": "fases concluídas",
  "mapa.t-color": "moedas coloridas: rosa · roxa · preta",

  "gen.armando": "Montando e conferindo que dá para terminar…",
  "gen.sinvalidar": "sem validar",
  "gen.validado1": "validada em 1 tentativa",
  "gen.validadoN": "validada em {n} tentativas",

  "hud.nivel": "Fase",
  "hud.pausa": "Pausa / voltar ao mapa",
  "hud.pantalla": "Tela cheia",
  "hud.izq": "Ir para a esquerda",
  "hud.der": "Ir para a direita",
  "hud.saltar": "Pular",

  "res.gano": "Você chegou!",
  "res.perdio": "Acabou",
  "res.roto": "Alguma coisa quebrou",
  "res.causa.tiempo": "O tempo acabou",
  "res.causa.pozo": "No vazio",
  "res.causa.pinche": "Os espinhos",
  "res.causa.jefe": "O chefe te venceu",
  "res.causa.otro": "Um inimigo te venceu",
  "res.monedas": "Moedas",
  "res.bonus": "Bônus do mastro",
  "res.color": "Moedas coloridas",
  "res.burbujas": "Bolhas que sobraram",
  "res.tiempo": "Tempo",
  "res.tiempoDe": "{a}s de {b}",
  "res.abierto": "Desbloqueado",
  "tier.rosa": "rosa",
  "tier.violeta": "roxa",
  "tier.negra": "preta",
  "res.abre.violeta": "moedas roxas",
  "res.abre.negra": "moedas pretas",
  "res.abre.todo": "tudo feito",
  "res.seguir": "Próxima",
  "res.repetir": "De novo",
  "res.mapa": "Ao mapa",
  "res.perfecto": "Todas as coloridas!",
  "res.record": "Novo recorde",
  "res.total": "Total juntado",

  "ayuda.titulo": "Como se joga",

  "aj.titulo": "Ajustes",
  "aj.sonido": "Efeitos sonoros",
  "aj.musica": "Música",
  "aj.sacudida": "Tremor de tela",
  "aj.mandos": "Botões na tela",
  "aj.idioma": "Idioma",
  "aj.movimiento": "Movimento",
  "aj.libre": "Livre",
  "aj.corredor": "Corredor",
  "aj.nota-mov": "No <b>livre</b> o personagem fica parado até você dizer para onde ir com o direcional. No <b>corredor</b> ele corre sozinho e o direcional só corrige, como nas primeiras versões.",
  "aj.graficos": "Gráficos",
  "aj.auto": "Automático",
  "aj.nitido": "Nítido",
  "aj.rapido": "Rápido",
  "aj.nota-graf": "No automático o jogo mede como está indo no seu celular e só baixa a resolução se não alcançar 60 quadros por segundo.",
  "aj.nota-datos": "Nada disso sai do seu navegador: o progresso fica guardado neste aparelho e não há servidor nem conta.",
  "aj.borrar": "Apagar todo o progresso",
  "aj.confirmar": "Apagar todo o progresso? Não dá para desfazer.",
};

// El texto largo de la ayuda se pega aca y no se escribe en cada diccionario:
// es un solo bloque por idioma y asi ayuda.js queda como el unico lugar donde
// se lo edita.
for (const [cod, tab] of [["es", ES], ["en", EN], ["pt", PT]])
  tab["ayuda.cuerpo"] = AYUDA[cod];

const TABLA = { es: ES, en: EN, pt: PT };

let actual = "en";

export const idioma = () => actual;

export function ponerIdioma(cod) {
  actual = TABLA[cod] ? cod : "en";
  document.documentElement.lang = { es: "es-AR", en: "en", pt: "pt-BR" }[actual];
  return actual;
}

/**
 * El texto de una clave. Lo que falte en el idioma elegido cae al ingles, y
 * lo que falte tambien ahi devuelve la clave: un `res.gano` en pantalla se ve
 * mal a proposito, y asi se encuentra sin tener que leer los tres diccionarios.
 */
export function t(clave, vars) {
  let s = TABLA[actual][clave] ?? EN[clave] ?? clave;
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

export const tituloNivel = (cfg) => NIV[actual]?.[(cfg.m - 1) * 4 + cfg.n - 1] ?? cfg.titulo;
export const nombreTema = (tema, porDefecto) => TEMA[actual]?.[tema] ?? porDefecto ?? tema;

/**
 * Escribe todos los textos marcados del documento.
 *
 * `data-t` pone texto plano; `data-t-html` pone HTML —lo usan los parrafos
 * con <b> y <em> adentro, y el texto largo de la ayuda—; `data-t-attr` pone
 * atributos con la forma "aria-label:hud.saltar, title:mapa.t-monedas".
 *
 * El HTML de la tabla es NUESTRO, no entra nada del jugador: no hay superficie
 * de inyeccion. Si algun dia un texto viniera de afuera, esto tiene que pasar
 * a textContent.
 */
export function aplicar(raiz = document) {
  for (const e of raiz.querySelectorAll("[data-t]")) e.textContent = t(e.dataset.t);
  for (const e of raiz.querySelectorAll("[data-t-html]")) e.innerHTML = t(e.dataset.tHtml);
  for (const e of raiz.querySelectorAll("[data-t-attr]"))
    for (const par of e.dataset.tAttr.split(",")) {
      const [at, clave] = par.split(":").map((s) => s.trim());
      if (at && clave) e.setAttribute(at, t(clave));
    }
  const tit = document.querySelector("title");
  if (tit) tit.textContent = t("doc.titulo");
}
