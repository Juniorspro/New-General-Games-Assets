// Los textos, en una sola tabla y tres idiomas.
//
// POR QUE UNA TABLA Y NO TRES HTML: copiar el index tres veces se desincroniza
// a la primera corrección. Acá el HTML tiene UN texto por lugar, marcado con
// `data-t`, y la tabla decide cuál se escribe.

import { ajustes, guardar } from "./guardado.js";

export const IDIOMAS = { en: "English", es: "Español", pt: "Português" };

const BICHO = {
  en: { mota: "Blob", pua: "Spike", caparazon: "Shell", zumbido: "Buzz", bulto: "Lump" },
  es: { mota: "Mota", pua: "Púa", caparazon: "Caparazón", zumbido: "Zumbido", bulto: "Bulto" },
  pt: { mota: "Mancha", pua: "Espinho", caparazon: "Casco", zumbido: "Zumbido", bulto: "Volume" },
};
const ARMA = {
  en: { chispa: ["Spark", "Fires on its own at whatever is closest."],
        orbita: ["Orbit", "Shards that circle you. They hit in every direction."],
        onda:   ["Wave", "A ring that damages and shoves. Gets you out of a hug."],
        hilo:   ["Lash", "A whip where you're heading. Rewards steering."],
        semilla:["Seed", "Drops mines behind you. Rewards running in circles."] },
  es: { chispa: ["Chispa", "Dispara sola a lo más cercano."],
        orbita: ["Órbita", "Trozos que giran. Pegan en todas las direcciones."],
        onda:   ["Onda", "Un anillo que daña y empuja. Te saca de un abrazo."],
        hilo:   ["Hilo", "Un latigazo para donde vas. Premia manejar fino."],
        semilla:["Semilla", "Deja minas atrás. Premia correr en círculos."] },
  pt: { chispa: ["Faísca", "Atira sozinha no mais perto."],
        orbita: ["Órbita", "Pedaços que giram. Batem em todas as direções."],
        onda:   ["Onda", "Um anel que fere e empurra. Tira você do aperto."],
        hilo:   ["Chicote", "Uma chicotada para onde você vai."],
        semilla:["Semente", "Deixa minas atrás. Premia correr em círculos."] },
};
const PASIVA = {
  en: { botas: ["Boots", "Move faster."], iman: ["Magnet", "Gems fly to you sooner and faster."],
        coraza: ["Plating", "More health."], filo: ["Edge", "More damage."], pulso: ["Pulse", "Everything fires more often."] },
  es: { botas: ["Botas", "Te movés más rápido."], iman: ["Imán", "Las gemas vienen antes y más rápido."],
        coraza: ["Coraza", "Más vida."], filo: ["Filo", "Más daño."], pulso: ["Pulso", "Todo dispara más seguido."] },
  pt: { botas: ["Botas", "Você anda mais rápido."], iman: ["Ímã", "As gemas vêm antes e mais rápido."],
        coraza: ["Couraça", "Mais vida."], filo: ["Fio", "Mais dano."], pulso: ["Pulso", "Tudo atira mais vezes."] },
};

const T = {
  en: {
    "doc.titulo": "Enjambre — survive six minutes",
    "doc.desc": "One thumb, no aiming. You move; the weapons fire themselves. What decides the run is what you level up.",
    "idioma.titulo": "Choose your language", "idioma.bajada": "You can change it later in Settings.",
    "menu.jugar": "Play", "menu.como": "How to play", "menu.ajustes": "Settings",
    "menu.bajada": "Six minutes. You only move — the weapons fire on their own.",
    "menu.mejor": "Best", "menu.nunca": "You haven't played yet",
    "como.titulo": "How to play",
    "como.1": "Drag anywhere to move. There is no aiming: your weapons fire by themselves.",
    "como.2": "Killing drops gems. Gems level you up, and every level you pick one of three upgrades.",
    "como.3": "What decides the run is WHICH upgrade, and in what order. That is the whole game.",
    "como.4": "You can carry four weapons. Choose them well: after the fourth, only upgrades.",
    "como.5": "Two bosses, at 2:40 and at 5:10. Survive six minutes and you win.",
    "aj.titulo": "Settings", "aj.sonido": "Sound", "aj.idioma": "Language",
    "aj.borrar": "Erase records", "aj.seguro": "Tap again to erase", "volver": "Back",
    "hud.salir": "Quit",
    "mej.titulo": "Level", "mej.nueva": "NEW", "mej.nivel": "Level",
    "fin.gano": "You made it", "fin.perdio": "They got you",
    "fin.tiempo": "Time", "fin.matados": "Killed", "fin.nivel": "Level", "fin.record": "New record",
    "fin.otra": "Again", "fin.menu": "Menu",
  },
  es: {
    "doc.titulo": "Enjambre — sobreviví seis minutos",
    "doc.desc": "Un pulgar y nada de apuntar. Vos te movés; las armas disparan solas. Lo que decide la partida es qué subís.",
    "idioma.titulo": "Elegí tu idioma", "idioma.bajada": "Se puede cambiar después en Ajustes.",
    "menu.jugar": "Jugar", "menu.como": "Cómo se juega", "menu.ajustes": "Ajustes",
    "menu.bajada": "Seis minutos. Sólo te movés: las armas disparan solas.",
    "menu.mejor": "Mejor", "menu.nunca": "Todavía no jugaste",
    "como.titulo": "Cómo se juega",
    "como.1": "Arrastrá donde quieras para moverte. No se apunta: las armas disparan solas.",
    "como.2": "Matar deja gemas. Las gemas te suben de nivel, y en cada nivel elegís una de tres mejoras.",
    "como.3": "Lo que decide la partida es CUÁL mejora y en qué orden. Ese es todo el juego.",
    "como.4": "Podés llevar cuatro armas. Elegilas bien: después de la cuarta, sólo mejoras.",
    "como.5": "Hay dos jefes, a los 2:40 y a los 5:10. Aguantá seis minutos y ganás.",
    "aj.titulo": "Ajustes", "aj.sonido": "Sonido", "aj.idioma": "Idioma",
    "aj.borrar": "Borrar récords", "aj.seguro": "Tocá otra vez para borrar", "volver": "Volver",
    "hud.salir": "Salir",
    "mej.titulo": "Nivel", "mej.nueva": "NUEVA", "mej.nivel": "Nivel",
    "fin.gano": "La contaste", "fin.perdio": "Te agarraron",
    "fin.tiempo": "Tiempo", "fin.matados": "Matados", "fin.nivel": "Nivel", "fin.record": "Récord nuevo",
    "fin.otra": "De nuevo", "fin.menu": "Menú",
  },
  pt: {
    "doc.titulo": "Enjambre — sobreviva seis minutos",
    "doc.desc": "Um polegar e nada de mirar. Você anda; as armas atiram sozinhas. O que decide a partida é o que você melhora.",
    "idioma.titulo": "Escolha seu idioma", "idioma.bajada": "Dá para mudar depois em Ajustes.",
    "menu.jugar": "Jogar", "menu.como": "Como se joga", "menu.ajustes": "Ajustes",
    "menu.bajada": "Seis minutos. Você só anda: as armas atiram sozinhas.",
    "menu.mejor": "Melhor", "menu.nunca": "Você ainda não jogou",
    "como.titulo": "Como se joga",
    "como.1": "Arraste onde quiser para andar. Não se mira: as armas atiram sozinhas.",
    "como.2": "Matar deixa gemas. As gemas sobem seu nível, e a cada nível você escolhe uma de três melhorias.",
    "como.3": "O que decide a partida é QUAL melhoria e em que ordem. É esse o jogo todo.",
    "como.4": "Você leva quatro armas. Escolha bem: depois da quarta, só melhorias.",
    "como.5": "Há dois chefes, aos 2:40 e aos 5:10. Aguente seis minutos e você ganha.",
    "aj.titulo": "Ajustes", "aj.sonido": "Som", "aj.idioma": "Idioma",
    "aj.borrar": "Apagar recordes", "aj.seguro": "Toque de novo para apagar", "volver": "Voltar",
    "hud.salir": "Sair",
    "mej.titulo": "Nível", "mej.nueva": "NOVA", "mej.nivel": "Nível",
    "fin.gano": "Você conseguiu", "fin.perdio": "Pegaram você",
    "fin.tiempo": "Tempo", "fin.matados": "Mortos", "fin.nivel": "Nível", "fin.record": "Novo recorde",
    "fin.otra": "De novo", "fin.menu": "Menu",
  },
};

export const idioma = () => ajustes().idioma || "en";
export const t = (k) => (T[idioma()] && T[idioma()][k]) || T.en[k] || k;
export const nombreBicho = (n) => (BICHO[idioma()] || BICHO.en)[n] || n;
export const arma = (n) => (ARMA[idioma()] || ARMA.en)[n] || [n, ""];
export const pasiva = (n) => (PASIVA[idioma()] || PASIVA.en)[n] || [n, ""];

export function elegir(l) { if (!IDIOMAS[l]) return; ajustes().idioma = l; guardar(); aplicar(); }

export function aplicar() {
  document.documentElement.lang = idioma();
  for (const e of document.querySelectorAll("[data-t]")) e.textContent = t(e.dataset.t);
  const tit = document.querySelector("title"); if (tit) tit.textContent = t("doc.titulo");
  const d = document.querySelector('meta[name="description"]'); if (d) d.setAttribute("content", t("doc.desc"));
}

/** Las tres tablas tienen que tener las mismas llaves, y todos los bichos y
 *  armas nombre en los tres idiomas. */
export function faltantes() {
  const fuera = [], base = Object.keys(T.en);
  for (const l of Object.keys(T)) {
    for (const k of base) if (!(k in T[l])) fuera.push(`${l} no tiene ${k}`);
    for (const k of Object.keys(T[l])) if (!base.includes(k)) fuera.push(`${l} tiene de más ${k}`);
  }
  for (const [nom, tabla] of [["bichos", BICHO], ["armas", ARMA], ["pasivas", PASIVA]]) {
    const n = Object.keys(tabla.en).length;
    for (const l of Object.keys(tabla))
      if (Object.keys(tabla[l]).length !== n) fuera.push(`${l} tiene ${Object.keys(tabla[l]).length} ${nom} y en tiene ${n}`);
  }
  return fuera;
}
