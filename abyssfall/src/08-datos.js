// ─────────────────────────────────────────────────────────────────────────────
// LOS DATOS. Las reglas y los números salen de la wiki del género que homenajeamos (downwell
// fandom, leída por su API el 30/09/2026): 4 de vida, 8 cargas que se recargan al pisar suelo o
// un bicho, lo BLANCO se pisa y lo ROJO no, combos de 8/15/25, gema chica 2 y grande 10, "gem high"
// con 100 gemas seguidas, módulos de arma con su costo por disparo, 3 mejoras a elegir por nivel,
// tiendas con precios que suben 200 por zona. Las velocidades en píxeles no están en ninguna parte:
// van medidas a ojo contra el video (se ajustan acá). Los nombres y el arte son propios.
// Unidad de daño: 1 = un disparo de la ametralladora; la vida de los bichos va en esos disparos.
// ─────────────────────────────────────────────────────────────────────────────

const FIS = {
  corre: 96, acel: 1000, frena: 1400, acelAire: 760, grav: 1000, caidaMax: 330,
  salto: 318, rebote: 268, reboteAlto: 338, invul: 1.6, alcance: 112, velBala: 520,
};

// ── los módulos de arma: costo por disparo, balas, dispersión, daño, cadencia, si levantan como un salto ──
const ARMAS = {
  metra: { letra: "M", n: { en: "MACHINE GUN", es: "AMETRALLADORA" }, costo: 1, balas: 1, abre: 0, dano: 1, cad: 0.085, alza: 0, d: { en: "Steady stream of shots.", es: "Una lluvia de tiros." } },
  loca: { letra: "N", n: { en: "WILD GUN", es: "ARMA LOCA" }, costo: 1, balas: 1, abre: 0.5, dano: 0.9, cad: 0.07, alza: 0, sesgo: 1, d: { en: "Fast, angled toward where you move.", es: "Rápida, apunta hacia donde vas." } },
  puno: { letra: "P", n: { en: "PUNCHER", es: "PUÑETAZO" }, costo: 2, balas: 3, abre: 0, junto: 3, dano: 0.8, cad: 0.16, alza: 0, d: { en: "Three shots side by side.", es: "Tres tiros juntos, en fila." } },
  triple: { letra: "T", n: { en: "TRIPLE", es: "TRIPLE" }, costo: 2, balas: 3, abre: 0.32, dano: 0.6, cad: 0.14, alza: 0, d: { en: "A spread of three.", es: "Tres tiros abiertos." } },
  rafaga: { letra: "B", n: { en: "BURST", es: "RÁFAGA" }, costo: 3, balas: 3, abre: 0, dano: 0.8, cad: 0.3, rafaga: 0.05, alza: 0, d: { en: "Quick three-shot volley.", es: "Tres tiros al hilo." } },
  laser: { letra: "L", n: { en: "LASER", es: "LÁSER" }, costo: 4, balas: 1, abre: 0, dano: 2.8, cad: 0.36, alza: 1, rayo: 1, d: { en: "Long beam, pierces enemies and blocks. Lifts like a jump.", es: "Rayo largo que atraviesa. Levanta como un salto." } },
  escopeta: { letra: "S", n: { en: "SHOTGUN", es: "ESCOPETA" }, costo: 5, balas: 7, abre: 1.1, dano: 0.7, cad: 0.34, alza: 1, perfora: 1, corto: 0.6, d: { en: "Wide close blast that pierces. Lifts like a jump.", es: "Abanico corto que atraviesa. Levanta como un salto." } },
};

// ── las mejoras entre niveles (se elige 1 de 3) ──
const MEJORAS = {
  manzana: { n: { en: "RED APPLE", es: "MANZANA ROJA" }, d: { en: "Heal 4 HP.", es: "Curás 4 de vida." }, ico: "manzana", repite: 1 },
  juventud: { n: { en: "SPRING WATER", es: "AGUA DE VERTIENTE" }, d: { en: "+1 max HP and one more choice from now on.", es: "+1 de vida máxima y una opción más de ahora en más." }, ico: "agua" },
  estallido: { n: { en: "STOMP BLAST", es: "PISOTÓN BOMBA" }, d: { en: "Stomping makes a blast around you.", es: "Al pisar, una explosión alrededor." }, ico: "bomba" },
  cohete: { n: { en: "ROCKET HEELS", es: "TACOS COHETE" }, d: { en: "Higher jump from the ground, with a blast underfoot.", es: "Saltás más alto desde el piso, con una explosión abajo." }, ico: "cohete" },
  vela: { n: { en: "WAX CANDLE", es: "VELA DE CERA" }, d: { en: "Longer invincibility after a hit.", es: "Más tiempo invencible después de un golpe." }, ico: "vela" },
  dron: { n: { en: "BUDDY DRONE", es: "DRON AMIGO" }, d: { en: "A little drone fires with you.", es: "Un dron chiquito dispara con vos." }, ico: "dron" },
  iman: { n: { en: "GEM MAGNET", es: "IMÁN DE GEMAS" }, d: { en: "Pick up gems from further away.", es: "Juntás gemas desde más lejos." }, ico: "iman" },
  pila: { n: { en: "GEM BATTERY", es: "PILA DE GEMAS" }, d: { en: "Gems recharge your gunboots.", es: "Las gemas recargan las botas." }, ico: "pila" },
  fiebre: { n: { en: "GEM FEVER", es: "FIEBRE DE GEMAS" }, d: { en: "GEM HIGH lasts much longer.", es: "El GEM HIGH dura mucho más." }, ico: "fiebre" },
  pochoclo: { n: { en: "POPPING GEMS", es: "GEMAS POCHOCLO" }, d: { en: "Every gem you grab fires a shot upward.", es: "Cada gema que agarrás tira un tiro para arriba." }, ico: "pochoclo" },
  polvora: { n: { en: "POWDER BLOCKS", es: "BLOQUES DE PÓLVORA" }, d: { en: "Broken blocks break their neighbors.", es: "Los bloques rotos rompen a sus vecinos." }, ico: "polvora" },
  globo: { n: { en: "HEART BALLOON", es: "GLOBO CORAZÓN" }, d: { en: "You fall slower. Pops on a hit and blasts.", es: "Caés más lento. Si te pegan, revienta y explota." }, ico: "globo" },
  tenedor: { n: { en: "FORK AND KNIFE", es: "TENEDOR Y CUCHILLO" }, d: { en: "Eat what you stomp. 10 bites = +1 HP.", es: "Comés lo que pisás. 10 bocados = +1 de vida." }, ico: "tenedor" },
  mira: { n: { en: "LASER SIGHT", es: "MIRA LÁSER" }, d: { en: "Aim line and longer range.", es: "Línea de mira y más alcance." }, ico: "mira" },
  tarjeta: { n: { en: "VIP CARD", es: "TARJETA VIP" }, d: { en: "A shop in every level, 10% off.", es: "Una tienda en cada nivel, 10% menos." }, ico: "tarjeta" },
  mochila: { n: { en: "JETPACK", es: "MOCHILA COHETE" }, d: { en: "Out of charge? Hold fire to hover a while.", es: "¿Sin carga? Mantené disparo para flotar un rato." }, ico: "mochila" },
};

// ── la tienda: 3 cosas al azar; precio base + 200 por zona (wiki) ──
const TIENDA = {
  pan: { n: { en: "BREAD", es: "PAN" }, d: { en: "+1 HP", es: "+1 vida" }, precio: 300, vida: 1, ico: "pan" },
  guiso: { n: { en: "STEW", es: "GUISO" }, d: { en: "+2 HP", es: "+2 vida" }, precio: 500, vida: 2, ico: "guiso" },
  pila1: { n: { en: "CELL", es: "PILA" }, d: { en: "+1 charge", es: "+1 carga" }, precio: 150, carga: 1, ico: "pila" },
  pila2: { n: { en: "POWER CELL", es: "PILA DOBLE" }, d: { en: "+2 charge", es: "+2 carga" }, precio: 250, carga: 2, ico: "pila2" },
  soda: { n: { en: "FIZZY SODA", es: "GASEOSA" }, d: { en: "+1 HP +1 charge", es: "+1 vida +1 carga" }, precio: 400, vida: 1, carga: 1, ico: "soda" },
  aji: { n: { en: "HOT PEPPER", es: "AJÍ PICANTE" }, d: { en: "+1 max HP", es: "+1 vida máxima" }, precio: 1000, max: 1, ico: "aji" },
};

// ── los estilos (se desbloquean con las gemas de todas las partidas) ──
const ESTILOS = {
  normal: { n: { en: "STANDARD", es: "NORMAL" }, d: { en: "The usual way down.", es: "La bajada de siempre." }, precio: 0 },
  pesado: { n: { en: "BOULDER", es: "PIEDRA" }, d: { en: "6 HP, faster, weaker stomp bounce, one less upgrade choice.", es: "6 de vida, más rápido, rebota menos, una opción menos." }, precio: 3000, vida: 6, opciones: -1 },
  pluma: { n: { en: "FEATHER", es: "PLUMA" }, d: { en: "You always fall slowly.", es: "Siempre caés despacio." }, precio: 7000, flota: 1 },
  cazador: { n: { en: "SCAVENGER", es: "CARROÑERO" }, d: { en: "Side rooms only hold guns. Shops are rare.", es: "Las salas sólo tienen armas. Casi no hay tiendas." }, precio: 12000, soloArmas: 1 },
};

// ── las zonas: 3 niveles cada una, después el Abismo con el jefe ──
const ZONAS = [
  { k: "hueco", n: { en: "HOLLOW", es: "HUECO" }, bichos: ["burbuja", "murcielago", "rana", "gusano", "tortuga", "arana", "caracol", "ojo"], bloques: 0.9, plataformas: 0.35, pinches: 0, tema: "pozo", adorno: "hongo" },
  { k: "osario", n: { en: "OSSUARY", es: "OSARIO" }, bichos: ["fantasma", "calaveraS", "calaveraV", "esqueleto", "espectro", "murcielago", "gusano"], bloques: 0.7, plataformas: 0.5, pinches: 0.18, tema: "pozo", adorno: "vela" },
  { k: "hundido", n: { en: "SUNKEN", es: "HUNDIDO" }, bichos: ["medusa", "calamar", "piranha", "tortugaN", "burbuja"], bloques: 0.6, plataformas: 0.3, pinches: 0.1, tema: "profundo", adorno: "vasija" },
  { k: "limbo", n: { en: "LIMBO", es: "LIMBO" }, bichos: ["cosaV", "cosaO", "cosaD", "espectro", "ojo"], bloques: 0.08, plataformas: 0.15, pinches: 0.6, tema: "profundo", adorno: "farol" },
];

// ── los bichos: vida (en tiros de ametralladora), gemas, si se pisan (blanco) o no (rojo), comportamiento ──
const BICHOS_D = {
  burbuja: { vida: 3, gemas: 6, pisa: 1, spr: "gota", w: 8, h: 7, mueve: "persigueLento", vel: 22 },
  murcielago: { vida: 2, gemas: 12, pisa: 1, spr: "murcielago", w: 9, h: 7, mueve: "colgado", vel: 70 },
  rana: { vida: 4, gemas: 20, pisa: 1, spr: "rana", w: 9, h: 7, mueve: "salta", vel: 60 },
  gusano: { vida: 1, gemas: 6, pisa: 1, spr: "gusano", w: 10, h: 7, mueve: "patrulla", vel: 18, bajo: 1 },
  tortuga: { vida: 99, gemas: 14, pisa: 1, spr: "tortuga", w: 11, h: 7, mueve: "patrulla", vel: 14, blindado: 1 },
  arana: { vida: 1, gemas: 6, pisa: 0, spr: "aranaR", w: 9, h: 7, mueve: "patrulla", vel: 55 },
  caracol: { vida: 3, gemas: 24, pisa: 0, spr: "erizo", w: 10, h: 7, mueve: "patrulla", vel: 10 },
  ojo: { vida: 4, gemas: 20, pisa: 0, spr: "ojo", w: 9, h: 9, mueve: "circula", vel: 40 },
  fantasma: { vida: 4, gemas: 20, pisa: 1, spr: "fantasma", w: 9, h: 9, mueve: "persigue", vel: 34, atraviesa: 1, sube: 1 },
  calaveraS: { vida: 1, gemas: 4, pisa: 1, spr: "calaveraB", w: 8, h: 7, mueve: "rebota", vel: 50 },
  calaveraV: { vida: 2, gemas: 20, pisa: 1, spr: "calaveraB", w: 8, h: 7, mueve: "vaga", vel: 26, enoja: 1 },
  esqueleto: { vida: 5, gemas: 10, pisa: 1, spr: "esqueleto", w: 8, h: 11, mueve: "tira", vel: 0 },
  espectro: { vida: 2, gemas: 8, pisa: 0, spr: "espectro", w: 9, h: 7, mueve: "ondea", vel: 30, atraviesa: 1 },
  medusa: { vida: 3, gemas: 6, pisa: 0, spr: "medusaR", w: 8, h: 7, mueve: "zigzag", vel: 30, atraviesa: 1 },
  calamar: { vida: 1, gemas: 10, pisa: 1, spr: "calamar", w: 8, h: 8, mueve: "calamar", vel: 70, atraviesa: 1 },
  piranha: { vida: 2, gemas: 14, pisa: 0, spr: "pez", w: 10, h: 5, mueve: "persigue", vel: 62 },
  tortugaN: { vida: 99, gemas: 14, pisa: 1, spr: "tortuga", w: 11, h: 7, mueve: "nada", vel: 22, blindado: 1 },
  cosaV: { vida: 3, gemas: 10, pisa: 0, spr: "cosaV", w: 7, h: 9, mueve: "vertical", vel: 60, atraviesa: 1 },
  cosaO: { vida: 3, gemas: 10, pisa: 0, spr: "cosaO", w: 8, h: 8, mueve: "orbita", vel: 2.4, atraviesa: 1 },
  cosaD: { vida: 3, gemas: 10, pisa: 0, spr: "cosaD", w: 9, h: 9, mueve: "diagonal", vel: 50 },
  hueso: { vida: 1, gemas: 0, pisa: 0, spr: "hueso", w: 6, h: 6, mueve: "proyectil", vel: 0, sinCombo: 1 },
  bola: { vida: 1, gemas: 0, pisa: 0, spr: "bola", w: 5, h: 5, mueve: "proyectil", vel: 0, sinCombo: 1 },
  diente: { vida: 99, gemas: 0, pisa: 0, spr: "diente", w: 7, h: 9, mueve: "proyectil", vel: 0, sinCombo: 1, blindado: 1 },
};

// ── textos ──
const TX = {
  tocar: { en: "TAP TO START", es: "TOCÁ PARA EMPEZAR" }, tecla: { en: "PRESS JUMP", es: "APRETÁ SALTAR" },
  jugar: { en: "PLAY", es: "JUGAR" }, estilo: { en: "STYLE", es: "ESTILO" }, paleta: { en: "PALETTE", es: "PALETA" }, opciones: { en: "OPTIONS", es: "OPCIONES" },
  seguir: { en: "RESUME", es: "SEGUIR" }, reintentar: { en: "RETRY", es: "REINTENTAR" }, salir: { en: "QUIT", es: "SALIR" }, pausa: { en: "PAUSED", es: "PAUSA" },
  volver: { en: "BACK", es: "VOLVER" }, elegir: { en: "PICK ONE", es: "ELEGÍ UNA" }, bloqueado: { en: "LOCKED", es: "BLOQUEADO" },
  gemHigh: { en: "GEM HIGH", es: "GEM HIGH" }, gemFiebre: { en: "GEM FEVER", es: "GEM FEVER" }, combo: { en: "COMBO", es: "COMBO" }, premio: { en: "COMBO REWARD!", es: "¡PREMIO DE COMBO!" },
  pobre: { en: "TOO POOR!", es: "¡NO TE ALCANZA!" }, gracias: { en: "THANKS!", es: "¡GRACIAS!" }, tienda: { en: "SHOP", es: "TIENDA" }, veta: { en: "GEM VEIN", es: "VETA DE GEMAS" },
  modulo: { en: "GUN MODULE", es: "MÓDULO DE ARMA" }, muerto: { en: "YOU DIED", es: "TE MORISTE" }, ganaste: { en: "YOU REACHED THE BOTTOM", es: "LLEGASTE AL FONDO" },
  prof: { en: "DEPTH", es: "PROFUNDIDAD" }, gemas: { en: "GEMS", es: "GEMAS" }, bichos: { en: "KILLS", es: "BICHOS" }, maxCombo: { en: "MAX COMBO", es: "COMBO MÁX." }, tiempo: { en: "TIME", es: "TIEMPO" },
  totalGemas: { en: "TOTAL GEMS", es: "GEMAS TOTALES" }, nuevo: { en: "NEW!", es: "¡NUEVO!" }, desbloqueado: { en: "UNLOCKED", es: "DESBLOQUEADO" },
  musica: { en: "MUSIC", es: "MÚSICA" }, efectos: { en: "SOUNDS", es: "EFECTOS" }, temblor: { en: "SHAKE", es: "TEMBLOR" }, idioma: { en: "LANGUAGE: ENGLISH", es: "IDIOMA: ESPAÑOL" },
  completa: { en: "FULLSCREEN", es: "PANTALLA COMPLETA" }, si: { en: "ON", es: "SÍ" }, no: { en: "OFF", es: "NO" },
  abismo: { en: "ABYSS", es: "ABISMO" }, jefe: { en: "THE MAW", es: "LA FAUCE" }, otraVez: { en: "AGAIN", es: "OTRA VEZ" }, menu: { en: "MENU", es: "MENÚ" },
  ayuda1: { en: "LEFT THUMB: MOVE", es: "PULGAR IZQ.: MOVERSE" }, ayuda2: { en: "RIGHT THUMB: JUMP / SHOOT", es: "PULGAR DER.: SALTAR / DISPARAR" },
  ayudaPC: { en: "ARROWS: MOVE · SPACE: JUMP, AND SHOOT IN THE AIR", es: "FLECHAS: MOVERSE · ESPACIO: SALTAR, Y EN EL AIRE DISPARAR" },
  stompa: { en: "STOMP WHITE · SHOOT RED", es: "PISÁ LO BLANCO · TIRALE A LO ROJO" }, sin: { en: "EMPTY", es: "VACÍO" },
};
