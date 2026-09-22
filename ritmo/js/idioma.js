// Los textos, en los tres idiomas y en una sola tabla.
//
// POR QUE UNA TABLA Y NO TRES HTML. Copiar el index tres veces se desincroniza
// a la primera corrección: se arregla un botón en uno y quedan dos con el texto
// viejo. Acá el HTML tiene UN texto por lugar, marcado con `data-t`, y la tabla
// decide cuál se escribe. Lo que falta traducir cae al inglés y se nota.

import { ajustes, guardar } from "./guardado.js";

export const IDIOMAS = { en: "English", es: "Español", pt: "Português" };

const NOMBRES = {
  es: ["Primer latido", "Luz baja", "Cable suelto", "Neón", "Tres pisos",
       "Corriente", "Nadie mira", "Vidrio roto", "Último tren"],
  en: ["First beat", "Low light", "Loose wire", "Neon", "Three floors",
       "Current", "Nobody's looking", "Broken glass", "Last train"],
  pt: ["Primeira batida", "Luz baixa", "Fio solto", "Neon", "Três andares",
       "Corrente", "Ninguém olha", "Vidro quebrado", "Último trem"],
};

const T = {
  en: {
    "doc.titulo": "Ritmo — a rhythm game with music written by code",
    "doc.desc": "Nine songs composed by code, and every chart checked by a machine before you can play it.",
    "idioma.titulo": "Choose your language",
    "idioma.bajada": "You can change it later in Settings.",
    "idioma.seguir": "Continue",
    "menu.jugar": "Play", "menu.ajustes": "Settings", "menu.como": "How to play",
    "menu.bajada": "Nine songs. Tap the lane when the note reaches the line.",
    "lista.titulo": "Songs", "lista.volver": "Back",
    "lista.cerrada": "Get one star on the previous song",
    "lista.mejor": "Best", "lista.limpia": "Full combo",
    "aj.titulo": "Settings", "aj.musica": "Music", "aj.efectos": "Hit sounds",
    "aj.anticipo": "Note speed", "aj.lento": "Slow", "aj.normal": "Normal", "aj.rapido": "Fast",
    "aj.desfase": "Sync offset", "aj.calibrar": "Calibrate",
    "aj.idioma": "Language", "aj.borrar": "Erase progress", "aj.seguro": "Tap again to erase",
    "cal.titulo": "Calibration", "cal.bajada": "Tap along with the beat. Twelve taps is enough.",
    "cal.faltan": "taps left", "cal.resultado": "Your offset", "cal.usar": "Use it", "cal.salir": "Cancel",
    "como.titulo": "How to play",
    "como.1": "Three lanes. A note falls; tap its lane exactly when it touches the line.",
    "como.2": "The closer to the line, the better the hit: PERFECT, GOOD, EDGE.",
    "como.3": "Long notes: tap and hold until the bar ends.",
    "como.4": "The lane follows the melody — low on the left, high on the right.",
    "como.5": "If it feels early or late on your headphones, calibrate in Settings.",
    "hud.salir": "Quit",
    "fin.titulo": "Song over", "fin.puntos": "Score", "fin.precision": "Accuracy",
    "fin.racha": "Best combo", "fin.limpia": "FULL COMBO", "fin.record": "New record",
    "fin.otra": "Again", "fin.lista": "Songs", "fin.siguiente": "Next song",
    "fin.perfecto": "Perfect", "fin.bien": "Good", "fin.rozo": "Edge", "fin.error": "Miss",
    "j.perfecto": "PERFECT", "j.bien": "GOOD", "j.rozo": "EDGE", "j.error": "MISS",
    "cuenta.listo": "Ready",
  },
  es: {
    "doc.titulo": "Ritmo — un juego de ritmo con música escrita por código",
    "doc.desc": "Nueve canciones compuestas por código, y cada carta revisada por una máquina antes de dejarte jugarla.",
    "idioma.titulo": "Elegí tu idioma",
    "idioma.bajada": "Se puede cambiar después en Ajustes.",
    "idioma.seguir": "Seguir",
    "menu.jugar": "Jugar", "menu.ajustes": "Ajustes", "menu.como": "Cómo se juega",
    "menu.bajada": "Nueve canciones. Tocá el carril cuando la nota llega a la línea.",
    "lista.titulo": "Canciones", "lista.volver": "Volver",
    "lista.cerrada": "Sacá una estrella en la anterior",
    "lista.mejor": "Mejor", "lista.limpia": "Sin fallar",
    "aj.titulo": "Ajustes", "aj.musica": "Música", "aj.efectos": "Sonido de los toques",
    "aj.anticipo": "Velocidad de las notas", "aj.lento": "Lenta", "aj.normal": "Normal", "aj.rapido": "Rápida",
    "aj.desfase": "Ajuste de sincronía", "aj.calibrar": "Calibrar",
    "aj.idioma": "Idioma", "aj.borrar": "Borrar progreso", "aj.seguro": "Tocá otra vez para borrar",
    "cal.titulo": "Calibración", "cal.bajada": "Tocá junto con el pulso. Con doce toques alcanza.",
    "cal.faltan": "toques", "cal.resultado": "Tu desfase", "cal.usar": "Usarlo", "cal.salir": "Cancelar",
    "como.titulo": "Cómo se juega",
    "como.1": "Tres carriles. Cae una nota: tocá su carril justo cuando toca la línea.",
    "como.2": "Cuanto más cerca de la línea, mejor sale: PERFECTO, BIEN, ROZÓ.",
    "como.3": "Las notas largas: tocá y mantené hasta que se termina la barra.",
    "como.4": "El carril sigue a la melodía: grave a la izquierda, agudo a la derecha.",
    "como.5": "Si con tus auriculares se siente adelantado o atrasado, calibrá en Ajustes.",
    "hud.salir": "Salir",
    "fin.titulo": "Se terminó", "fin.puntos": "Puntos", "fin.precision": "Precisión",
    "fin.racha": "Mejor racha", "fin.limpia": "SIN FALLAR NI UNA", "fin.record": "Récord nuevo",
    "fin.otra": "De nuevo", "fin.lista": "Canciones", "fin.siguiente": "La que sigue",
    "fin.perfecto": "Perfecto", "fin.bien": "Bien", "fin.rozo": "Rozó", "fin.error": "Error",
    "j.perfecto": "PERFECTO", "j.bien": "BIEN", "j.rozo": "ROZÓ", "j.error": "ERROR",
    "cuenta.listo": "Listo",
  },
  pt: {
    "doc.titulo": "Ritmo — um jogo de ritmo com música escrita por código",
    "doc.desc": "Nove músicas compostas por código, e cada mapa verificado por uma máquina antes de você jogar.",
    "idioma.titulo": "Escolha seu idioma",
    "idioma.bajada": "Dá para mudar depois em Ajustes.",
    "idioma.seguir": "Continuar",
    "menu.jugar": "Jogar", "menu.ajustes": "Ajustes", "menu.como": "Como se joga",
    "menu.bajada": "Nove músicas. Toque na pista quando a nota chegar à linha.",
    "lista.titulo": "Músicas", "lista.volver": "Voltar",
    "lista.cerrada": "Consiga uma estrela na anterior",
    "lista.mejor": "Melhor", "lista.limpia": "Sem errar",
    "aj.titulo": "Ajustes", "aj.musica": "Música", "aj.efectos": "Som dos toques",
    "aj.anticipo": "Velocidade das notas", "aj.lento": "Lenta", "aj.normal": "Normal", "aj.rapido": "Rápida",
    "aj.desfase": "Ajuste de sincronia", "aj.calibrar": "Calibrar",
    "aj.idioma": "Idioma", "aj.borrar": "Apagar progresso", "aj.seguro": "Toque de novo para apagar",
    "cal.titulo": "Calibração", "cal.bajada": "Toque junto com a batida. Doze toques bastam.",
    "cal.faltan": "toques", "cal.resultado": "Seu desvio", "cal.usar": "Usar", "cal.salir": "Cancelar",
    "como.titulo": "Como se joga",
    "como.1": "Três pistas. Cai uma nota: toque na pista dela bem quando encostar na linha.",
    "como.2": "Quanto mais perto da linha, melhor sai: PERFEITO, BOM, RASPOU.",
    "como.3": "Notas longas: toque e segure até a barra acabar.",
    "como.4": "A pista segue a melodia: grave à esquerda, agudo à direita.",
    "como.5": "Se no seu fone soar adiantado ou atrasado, calibre nos Ajustes.",
    "hud.salir": "Sair",
    "fin.titulo": "Acabou", "fin.puntos": "Pontos", "fin.precision": "Precisão",
    "fin.racha": "Melhor sequência", "fin.limpia": "SEM ERRAR NENHUMA", "fin.record": "Novo recorde",
    "fin.otra": "De novo", "fin.lista": "Músicas", "fin.siguiente": "A próxima",
    "fin.perfecto": "Perfeito", "fin.bien": "Bom", "fin.rozo": "Raspou", "fin.error": "Erro",
    "j.perfecto": "PERFEITO", "j.bien": "BOM", "j.rozo": "RASPOU", "j.error": "ERRO",
    "cuenta.listo": "Pronto",
  },
};

export function idioma() { return ajustes().idioma || "en"; }

export function t(llave) {
  const l = idioma();
  return (T[l] && T[l][llave]) || T.en[llave] || llave;
}

export function nombreCancion(id) {
  const l = idioma();
  return (NOMBRES[l] || NOMBRES.en)[id - 1] || `#${id}`;
}

export function elegir(l) {
  if (!IDIOMAS[l]) return;
  ajustes().idioma = l;
  guardar();
  aplicar();
}

/** Escribe todos los `data-t` del documento. */
export function aplicar() {
  document.documentElement.lang = idioma();
  for (const e of document.querySelectorAll("[data-t]")) e.textContent = t(e.dataset.t);
  for (const e of document.querySelectorAll("[data-t-aria]")) e.setAttribute("aria-label", t(e.dataset.tAria));
  const tit = document.querySelector("title");
  if (tit) tit.textContent = t("doc.titulo");
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", t("doc.desc"));
}

/** Las tres tablas tienen que tener exactamente las mismas llaves. */
export function faltantes() {
  const base = Object.keys(T.en);
  const fuera = [];
  for (const l of Object.keys(T)) {
    for (const k of base) if (!(k in T[l])) fuera.push(`${l} no tiene ${k}`);
    for (const k of Object.keys(T[l])) if (!base.includes(k)) fuera.push(`${l} tiene de más ${k}`);
  }
  for (const l of Object.keys(NOMBRES)) if (NOMBRES[l].length !== 9) fuera.push(`${l} tiene ${NOMBRES[l].length} nombres`);
  return fuera;
}
