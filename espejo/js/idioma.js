// Los textos, en los tres idiomas. El HTML lleva UN texto por lugar marcado con
// `data-t` y la tabla decide cuál se escribe: traducir copiando el index.html
// tres veces se desincroniza a la primera corrección.
//
// SE PREGUNTA EN CADA ARRANQUE, antes del menú, con la elección anterior
// marcada: buscar dónde se cambia el idioma en un idioma que no sabés leer es
// exactamente el problema, y al que ya eligió le cuesta un toque. Lo que falte
// en una tabla cae al inglés.

export const IDIOMAS = { en: "English", es: "Español", pt: "Português" };

const ES = {
  "doc.titulo": "Espejo — cuarenta puzzles de luz",
  "doc.desc": "Cuarenta puzzles de espejos y rayos. Ninguno se diseñó a ojo: los cuarenta los resolvió una máquina antes de dejártelos jugar.",
  "doc.lienzo": "El tablero",


  "menu.bajada": "Tocá un espejo y se da vuelta. Prendé <b>todos</b> los objetivos con los rayos que salen de cada emisor.",
  "menu.jugar": "JUGAR",
  "menu.jugar-aria": "Jugar",
  "menu.seguir": "Nivel {n}",
  "menu.luces": "{n} de {t} luces",
  "menu.niveles": "Niveles",
  "menu.como": "? Cómo se juega",
  "menu.idioma": "Idioma",

  "tab.jugar": "Jugar",
  "tab.records": "Récords",
  "tab.opciones": "Opciones",
  "tab.como": "Cómo",
  "tab.creditos": "Créditos",
  "tabs.aria": "Secciones del menú",
  "menu.progreso": "{n} de {t} niveles resueltos · {p} en el par",

  "rec.titulo": "Lo que llevás",
  "rec.luces": "Luces",
  "rec.resueltos": "Niveles resueltos",
  "rec.perfectos": "Resueltos en el par (tres luces)",
  "rec.ganados": "Victorias, contando repeticiones",
  "rec.empezados": "Niveles empezados",
  "rec.toques": "Espejos dados vuelta",
  "rec.pistas": "Pistas pedidas",
  "rec.de": "{n} de {t}",

  "op.titulo": "Opciones",
  "op.efectos": "Efectos",
  "op.musica": "Música",
  "op.idioma": "Idioma",
  "op.cambiar": "Cambiar",
  "op.borrar": "Borrar el progreso",
  "op.borrar-seguro": "¿Seguro? Tocá otra vez para borrar",
  "op.borrado": "Borrado. El idioma y el volumen quedan como estaban.",

  "cre.titulo": "Créditos",
  "cre.juego": "Juego, niveles y textos: hechos para este repositorio. Los cuarenta tableros los eligió un generador que los resuelve antes de dejarlos entrar.",
  "cre.arte": "El vestido de los menús (el título, el marco, las placas y la mesa) son imágenes generadas para este juego; el tema del menú es música generada.",
  "cre.sonidos": "Sonidos grabados",
  "cre.cc0": "De dominio público (CC0), sin obligación de citar, y igual se agradece: {lista}.",
  "cre.ccby": "Con licencia CC-BY, que pide nombrar al autor:",
  "cre.sinccby": "Ninguno de los sonidos de este juego es CC-BY: todos son CC0.",
  "cre.sintesis": "La música de las partidas se toca sola con osciladores, en el navegador.",
  "err.bucle": "Algo se rompió adentro del juego y se volvió al menú.",

  "niv.titulo": "Niveles",
  "niv.cerrado": "cerrado",

  "como.titulo": "Cómo se juega",
  "como.atras": "← Atrás",
  "como.destacado": "Cada emisor tira un rayo. Tocando un espejo lo <b>das vuelta</b> entre <b>/</b> y <b>\\</b>. Ganás cuando están prendidos <b>todos</b> los objetivos a la vez.",
  "como.h-hay": "Lo que hay",
  "como.dt-emisor": "Los emisores",
  "como.dd-emisor": "Están en el borde y no se mueven. La bolita marca para dónde disparan.",
  "como.dt-espejo": "Los espejos",
  "como.dd-espejo": "Los que tienen marco se tocan; los grises están clavados y no se mueven. Un espejo manda el rayo noventa grados para un lado o para el otro según cómo esté dado vuelta.",
  "como.dt-objetivo": "Los objetivos",
  "como.dd-objetivo": "Se prenden sólo con un rayo <b>del mismo color</b>. Uno del color equivocado se come el rayo igual, así que también son un obstáculo.",
  "como.dt-muro": "Los muros",
  "como.dd-muro": "Cortan el rayo y no se mueven.",
  "como.h-par": "El par",
  "como.par": "Es la <b>cantidad mínima</b> de toques con la que se puede ganar ese nivel, y no es una estimación: la calculó una máquina recorriendo todas las combinaciones posibles de espejos. Ganar en el par da tres luces; hasta dos toques de más, dos luces.",
  "como.h-hecho": "De qué está hecho",
  "como.hecho1": "Ningún nivel se diseñó a mano. Se tiran tableros al azar y entran sólo los que una búsqueda por anchura prueba que <b>se ganan</b>, que <b>no vienen ya ganados</b> y cuyo par cae en el rango que le toca a ese número de nivel. De cuarenta y cuatro mil tableros tirados sobrevivieron cuarenta.",
  "como.hecho2": "Ese trabajo lo hace el generador y también lo rehace una prueba, con el mismo trazador de rayos que usa el juego para dibujar. Si el generador y el juego trazaran el rayo con código distinto, el generador podría jurar que un nivel se resuelve y vos ver que no — y eso no se ve como un error, se ve como que sos tonto.",

  "hud.salir": "Volver a los niveles",
  "hud.nivel": "Nivel {n}",
  "hud.toques": "toques",
  "hud.toques1": "toque",
  "hud.par": "par {n}",
  "hud.reiniciar": "Reiniciar el nivel",
  "hud.pista": "Pista",

  "fin.titulo": "¡Listo!",
  "fin.toques": "Toques",
  "fin.par": "Par",
  "fin.perfecto": "En el par exacto",
  "fin.siguiente": "SIGUE",
  "fin.siguiente-aria": "Nivel siguiente",
  "fin.repetir": "Repetir",
  "fin.niveles": "A los niveles",
  "fin.ultimo": "Terminaste los cuarenta. No queda ninguno sin resolver.",
};

const EN = {
  "doc.titulo": "Mirror — forty puzzles of light",
  "doc.desc": "Forty mirror-and-beam puzzles. None of them was designed by eye: a machine solved all forty before letting you play them.",
  "doc.lienzo": "The board",


  "menu.bajada": "Tap a mirror to flip it. Light up <b>every</b> target with the beams coming out of the emitters.",
  "menu.jugar": "PLAY",
  "menu.jugar-aria": "Play",
  "menu.seguir": "Level {n}",
  "menu.luces": "{n} of {t} lights",
  "menu.niveles": "Levels",
  "menu.como": "? How to play",
  "menu.idioma": "Language",

  "tab.jugar": "Play",
  "tab.records": "Records",
  "tab.opciones": "Options",
  "tab.como": "How to",
  "tab.creditos": "Credits",
  "tabs.aria": "Menu sections",
  "menu.progreso": "{n} of {t} levels solved · {p} on par",

  "rec.titulo": "Your progress",
  "rec.luces": "Lights",
  "rec.resueltos": "Levels solved",
  "rec.perfectos": "Solved on par (three lights)",
  "rec.ganados": "Wins, counting replays",
  "rec.empezados": "Levels started",
  "rec.toques": "Mirrors flipped",
  "rec.pistas": "Hints used",
  "rec.de": "{n} of {t}",

  "op.titulo": "Options",
  "op.efectos": "Effects",
  "op.musica": "Music",
  "op.idioma": "Language",
  "op.cambiar": "Change",
  "op.borrar": "Erase progress",
  "op.borrar-seguro": "Sure? Tap again to erase",
  "op.borrado": "Erased. Language and volume stay as they were.",

  "cre.titulo": "Credits",
  "cre.juego": "Game, levels and writing: made for this repository. The forty boards were picked by a generator that solves them before letting them in.",
  "cre.arte": "The menu dressing (title, frame, plates and table) are images generated for this game; the menu theme is generated music.",
  "cre.sonidos": "Recorded sounds",
  "cre.cc0": "Public domain (CC0), no attribution required, thanks anyway: {lista}.",
  "cre.ccby": "Licensed CC-BY, which asks to name the author:",
  "cre.sinccby": "None of this game's sounds is CC-BY: they are all CC0.",
  "cre.sintesis": "The in-game music plays itself with oscillators, in the browser.",
  "err.bucle": "Something broke inside the game and you're back at the menu.",

  "niv.titulo": "Levels",
  "niv.cerrado": "locked",

  "como.titulo": "How to play",
  "como.atras": "← Back",
  "como.destacado": "Every emitter fires a beam. Tapping a mirror <b>flips</b> it between <b>/</b> and <b>\\</b>. You win when <b>all</b> the targets are lit at the same time.",
  "como.h-hay": "What's on the board",
  "como.dt-emisor": "The emitters",
  "como.dd-emisor": "They sit on the edge and never move. The dot shows which way they fire.",
  "como.dt-espejo": "The mirrors",
  "como.dd-espejo": "The framed ones can be tapped; the grey ones are bolted down. A mirror sends the beam ninety degrees one way or the other depending on which way it's flipped.",
  "como.dt-objetivo": "The targets",
  "como.dd-objetivo": "They only light up for a beam of the <b>same colour</b>. A beam of the wrong colour still gets eaten, so they're obstacles too.",
  "como.dt-muro": "The walls",
  "como.dd-muro": "They stop the beam and never move.",
  "como.h-par": "Par",
  "como.par": "It's the <b>smallest number</b> of taps that can win that level, and it isn't an estimate: a machine computed it by walking every possible combination of mirrors. Winning in par gives three lights; up to two taps over, two lights.",
  "como.h-hecho": "What it's made of",
  "como.hecho1": "No level was designed by hand. Boards are thrown at random and only the ones a breadth-first search proves <b>can be won</b>, are <b>not already won</b>, and whose par lands in the range for that level number get in. Out of forty-four thousand boards thrown, forty survived.",
  "como.hecho2": "The generator does that work and a test redoes it, with the same beam tracer the game uses to draw. If the generator and the game traced beams with different code, the generator could swear a level is solvable and you could see that it isn't — and that doesn't look like a bug, it looks like you're the problem.",

  "hud.salir": "Back to the levels",
  "hud.nivel": "Level {n}",
  "hud.toques": "taps",
  "hud.toques1": "tap",
  "hud.par": "par {n}",
  "hud.reiniciar": "Restart the level",
  "hud.pista": "Hint",

  "fin.titulo": "Solved!",
  "fin.toques": "Taps",
  "fin.par": "Par",
  "fin.perfecto": "Exactly on par",
  "fin.siguiente": "NEXT",
  "fin.siguiente-aria": "Next level",
  "fin.repetir": "Replay",
  "fin.niveles": "To the levels",
  "fin.ultimo": "You finished all forty. There isn't one left unsolved.",
};

const PT = {
  "doc.titulo": "Espelho — quarenta quebra-cabeças de luz",
  "doc.desc": "Quarenta quebra-cabeças de espelhos e raios. Nenhum foi desenhado no olho: uma máquina resolveu os quarenta antes de deixar você jogar.",
  "doc.lienzo": "O tabuleiro",


  "menu.bajada": "Toque num espelho para virá-lo. Acenda <b>todos</b> os alvos com os raios que saem dos emissores.",
  "menu.jugar": "JOGAR",
  "menu.jugar-aria": "Jogar",
  "menu.seguir": "Fase {n}",
  "menu.luces": "{n} de {t} luzes",
  "menu.niveles": "Fases",
  "menu.como": "? Como se joga",
  "menu.idioma": "Idioma",

  "tab.jugar": "Jogar",
  "tab.records": "Recordes",
  "tab.opciones": "Opções",
  "tab.como": "Como",
  "tab.creditos": "Créditos",
  "tabs.aria": "Seções do menu",
  "menu.progreso": "{n} de {t} fases resolvidas · {p} no par",

  "rec.titulo": "Seu progresso",
  "rec.luces": "Luzes",
  "rec.resueltos": "Fases resolvidas",
  "rec.perfectos": "Resolvidas no par (três luzes)",
  "rec.ganados": "Vitórias, contando repetições",
  "rec.empezados": "Fases começadas",
  "rec.toques": "Espelhos virados",
  "rec.pistas": "Dicas pedidas",
  "rec.de": "{n} de {t}",

  "op.titulo": "Opções",
  "op.efectos": "Efeitos",
  "op.musica": "Música",
  "op.idioma": "Idioma",
  "op.cambiar": "Trocar",
  "op.borrar": "Apagar o progresso",
  "op.borrar-seguro": "Certeza? Toque de novo para apagar",
  "op.borrado": "Apagado. O idioma e o volume continuam como estavam.",

  "cre.titulo": "Créditos",
  "cre.juego": "Jogo, fases e textos: feitos para este repositório. Os quarenta tabuleiros foram escolhidos por um gerador que os resolve antes de deixá-los entrar.",
  "cre.arte": "A roupa dos menus (o título, a moldura, as placas e a mesa) são imagens geradas para este jogo; o tema do menu é música gerada.",
  "cre.sonidos": "Sons gravados",
  "cre.cc0": "Domínio público (CC0), sem obrigação de citar, e mesmo assim obrigado: {lista}.",
  "cre.ccby": "Com licença CC-BY, que pede para nomear o autor:",
  "cre.sinccby": "Nenhum som deste jogo é CC-BY: todos são CC0.",
  "cre.sintesis": "A música das partidas toca sozinha com osciladores, no navegador.",
  "err.bucle": "Algo quebrou dentro do jogo e você voltou ao menu.",

  "niv.titulo": "Fases",
  "niv.cerrado": "trancada",

  "como.titulo": "Como se joga",
  "como.atras": "← Voltar",
  "como.destacado": "Cada emissor dispara um raio. Tocando num espelho você o <b>vira</b> entre <b>/</b> e <b>\\</b>. Você vence quando <b>todos</b> os alvos estiverem acesos ao mesmo tempo.",
  "como.h-hay": "O que tem no tabuleiro",
  "como.dt-emisor": "Os emissores",
  "como.dd-emisor": "Ficam na borda e não se mexem. A bolinha mostra para onde disparam.",
  "como.dt-espejo": "Os espelhos",
  "como.dd-espejo": "Os que têm moldura podem ser tocados; os cinzas estão parafusados. Um espelho manda o raio noventa graus para um lado ou para o outro conforme esteja virado.",
  "como.dt-objetivo": "Os alvos",
  "como.dd-objetivo": "Só acendem com um raio <b>da mesma cor</b>. Um da cor errada come o raio do mesmo jeito, então também são obstáculo.",
  "como.dt-muro": "Os muros",
  "como.dd-muro": "Cortam o raio e não se mexem.",
  "como.h-par": "O par",
  "como.par": "É a <b>menor quantidade</b> de toques com que dá para vencer aquela fase, e não é estimativa: uma máquina calculou percorrendo todas as combinações possíveis de espelhos. Vencer no par dá três luzes; até dois toques a mais, duas luzes.",
  "como.h-hecho": "Do que é feito",
  "como.hecho1": "Nenhuma fase foi desenhada à mão. Tabuleiros são jogados ao acaso e só entram os que uma busca em largura prova que <b>dá para vencer</b>, que <b>não vêm já vencidos</b> e cujo par cai na faixa daquele número de fase. De quarenta e quatro mil tabuleiros jogados sobraram quarenta.",
  "como.hecho2": "Esse trabalho é do gerador e um teste o refaz, com o mesmo traçador de raios que o jogo usa para desenhar. Se o gerador e o jogo traçassem o raio com código diferente, o gerador poderia jurar que uma fase tem solução e você ver que não — e isso não parece um erro, parece que o burro é você.",

  "hud.salir": "Voltar às fases",
  "hud.nivel": "Fase {n}",
  "hud.toques": "toques",
  "hud.toques1": "toque",
  "hud.par": "par {n}",
  "hud.reiniciar": "Reiniciar a fase",
  "hud.pista": "Dica",

  "fin.titulo": "Resolvido!",
  "fin.toques": "Toques",
  "fin.par": "Par",
  "fin.perfecto": "No par exato",
  "fin.siguiente": "SEGUE",
  "fin.siguiente-aria": "Próxima fase",
  "fin.repetir": "Repetir",
  "fin.niveles": "Às fases",
  "fin.ultimo": "Você terminou as quarenta. Não sobrou nenhuma sem resolver.",
};

export const TEXTOS = { es: ES, en: EN, pt: PT };
let actual = "en";

export const idioma = () => actual;

export function ponerIdioma(cod) {
  actual = TEXTOS[cod] ? cod : "en";
  document.documentElement.lang = { es: "es-AR", en: "en", pt: "pt-BR" }[actual];
  return actual;
}

/** Lo que falte cae al inglés; lo que falte también ahí devuelve la clave, que
 *  en pantalla se ve mal a propósito y así se encuentra sin leer tres tablas. */
export function t(clave, vars) {
  let s = TEXTOS[actual][clave] ?? EN[clave] ?? clave;
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
