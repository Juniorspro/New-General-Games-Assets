"use strict";
// ════════════════════════════════════════════════════════════════════════
// Base: utilidades, opciones guardadas, textos en tres idiomas y los datos
// del juego (rarezas, armas, curas, materiales, trajes).
// Todos los scripts comparten el ámbito global: lo que se declara acá lo ven
// los que vienen después.
// ════════════════════════════════════════════════════════════════════════
if (!window.THREE || !window.React || !window.ReactDOM) throw new Error("isla:sin-librerias"); // el aviso traducido lo arma index.html

function azar(semilla) { let s = semilla >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDif = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dirDe = (yaw, pitch) => ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
const pausa = () => new Promise((r) => setTimeout(r, 0));
function crearRuido(r) {
  const v = new Float32Array(65536); for (let i = 0; i < v.length; i++) v[i] = r();
  const en = (i, j) => v[((j & 255) << 8) | (i & 255)];
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = en(i, j), b = en(i + 1, j), c = en(i, j + 1), d = en(i + 1, j + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
function distSegmento(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
function elegir(r, pesos) { let s = 0; for (const p of pesos) s += p; let x = r() * s; for (let i = 0; i < pesos.length; i++) { x -= pesos[i]; if (x <= 0) return i; } return pesos.length - 1; }

// ── guardado local (puede no haber: ventana privada, visor sin permisos) ──
function leer(clave, porDefecto) { try { const v = localStorage.getItem("isla-royale:" + clave); return v ? Object.assign({}, porDefecto, JSON.parse(v)) : Object.assign({}, porDefecto); } catch (e) { return Object.assign({}, porDefecto); } }
function guardar(clave, valor) { try { localStorage.setItem("isla-royale:" + clave, JSON.stringify(valor)); } catch (e) { /* sin guardado: se juega igual */ } }
const TOCABLE = matchMedia("(pointer: coarse)").matches;

// ── giro: en el teléfono parado, el juego se acuesta solo ──
// Pedir pantalla completa y bloquear la orientación no anda en todos lados
// (Safari del iPhone no deja), y girar el teléfono a mano es justo lo que el
// jugador no quiere hacer. Así que, si el dedo es el puntero y la ventana está
// parada, #raiz se rota 90° por CSS y se juega acostado igual.
// Lo que el navegador resuelve solo (clic en un botón, foco) sigue andando;
// lo que calculamos con clientX/clientY o movementX/Y tiene que pasar por
// aLocal/delta, porque el navegador reporta la pantalla y no el contenedor.
const GIRO = (window.GIRO = (() => {
  const dedo = matchMedia("(pointer: coarse)"), avisar = [];
  const G = {
    activo: false, ancho: innerWidth, alto: innerHeight,
    // Girado: la x del juego corre hacia abajo de la pantalla y la y, hacia la izquierda.
    aLocal: (x, y) => (G.activo ? { x: y, y: innerWidth - x } : { x, y }),
    delta: (dx, dy) => (G.activo ? { x: dy, y: -dx } : { x: dx, y: dy }),
    // getBoundingClientRect de algo girado da la caja en la pantalla (ancho y alto cambiados).
    rectLocal(r) { return G.activo ? { left: r.top, top: innerWidth - r.right, width: r.height, height: r.width } : { left: r.left, top: r.top, width: r.width, height: r.height }; },
    alCambiar(fn) { avisar.push(fn); return () => { const i = avisar.indexOf(fn); if (i >= 0) avisar.splice(i, 1); }; },
    recalcular() {
      const W = innerWidth, H = innerHeight, raiz = document.getElementById("raiz"), html = document.documentElement;
      G.activo = dedo.matches && H > W;
      G.ancho = G.activo ? H : W; G.alto = G.activo ? W : H;
      html.classList.toggle("girado", G.activo);
      // Las media queries miran la ventana, no el contenedor: con el juego girado
      // mentirían. Estas clases y --vw/--vh las reemplazan con el tamaño lógico.
      html.classList.toggle("bajo", G.alto <= 520);
      html.classList.toggle("angosto", G.ancho <= 720);
      html.style.setProperty("--vw", G.ancho / 100 + "px"); html.style.setProperty("--vh", G.alto / 100 + "px");
      // En px y no en vh: la barra del navegador del teléfono cambia 100vh y el
      // contenedor quedaría corrido de la pantalla.
      if (raiz) Object.assign(raiz.style, G.activo ? { width: H + "px", height: W + "px", transform: `translateX(${W}px) rotate(90deg)` } : { width: "", height: "", transform: "" });
      for (const fn of avisar.slice()) fn();
    },
  };
  addEventListener("resize", G.recalcular);
  // Algunos teléfonos avisan el giro antes de tener las medidas nuevas.
  addEventListener("orientationchange", () => { G.recalcular(); setTimeout(G.recalcular, 250); });
  G.recalcular();
  return G;
})());
const idiomaInicial = (() => { const l = (navigator.language || "es").slice(0, 2); return l === "en" ? "en" : l === "pt" ? "pt" : "es"; })();
const OPCIONES_BASE = { idioma: idiomaInicial, modo: "solo", calidad: TOCABLE ? "media" : "alta", sens: 1, sensMira: 0.7, volumen: 0.8, autoDisparo: TOCABLE, asistencia: true, autoCorrer: true, botones: 1, fps: false, rivales: 14, traje: 0, nombre: "" };
// Los récords y el historial se guardan junto con los totales: leer() completa
// con estos valores lo que falte en un guardado viejo.
const STATS_BASE = { partidas: 0, victorias: 0, bajas: 0, xp: 0, dano: 0, tiempo: 0, mejorPuesto: 0, recBajas: 0, recDano: 0, recTiempo: 0, historial: [], diario: null };

// ════════════════════════════════════════════════════════════════════════
// Textos
// ════════════════════════════════════════════════════════════════════════
const TEXTOS = {
  es: {
    espacio: "Espacio", cargando: "Cargando", etapa_relieve: "Levantando la isla…", etapa_pueblos: "Construyendo los pueblos…", etapa_monte: "Plantando árboles…", etapa_botin: "Escondiendo cofres…", etapa_escena: "Pintando el mundo…", etapa_sombras: "Preparando la luz…", etapa_partida: "Cargando el autobús…", listo: "¡Listo!",
    jugar: "JUGAR", casillero: "CASILLERO", opciones: "OPCIONES", modo: "Battle Royale", solo: "Solo", rivalesN: "{n} rivales", buscando: "Buscando partida…", encontrados: "Jugadores encontrados: {n}", cancelar: "Cancelar",
    nivel: "Nivel {n}", victorias: "Victorias", bajas: "Bajas", partidas: "Partidas", girar: "Arrastrá para girar", equipado: "Equipado", equipar: "Equipar", tuNombre: "Tu nombre",
    idioma: "Idioma", calidad: "Gráficos", alta: "Alta", media: "Media", baja: "Baja", sens: "Sensibilidad", sensMira: "Sensibilidad al apuntar", volumen: "Volumen", autoDisparo: "Disparo automático (táctil)", asistencia: "Asistencia de apuntado", autoCorrer: "Correr automático (táctil)", botones: "Tamaño de los botones", fps: "Mostrar cuadros por segundo", rivales: "Rivales", si: "Sí", no: "No", cerrar: "Cerrar", juego: "Juego", video: "Video", audio: "Audio", controles: "Controles",
    escudo: "Escudo", vida: "Vida", vivos: "Vivos", tormentaEn: "La tormenta se forma en", tormentaCierra: "La tormenta se cierra", tormentaFin: "La tormenta cubre todo", ojoTormenta: "¡Se formó el ojo de la tormenta!",
    eliminaste: "Eliminaste a {n}", elimino: "{a} eliminó a {b}", laTormenta: "La tormenta", caida: "La caída", recoger: "Recoger", abrir: "Abrir", cambiarPor: "Cambiar por", usando: "Usando {n}", recargando: "Recargando", sinMunicion: "Sin munición", llena: "Ya está lleno",
    saltarBus: "Saltar del autobús", autobusSeVa: "El autobús te larga en {n} s", enAutobus: "Estás en el autobús", caidaLibre: "Caída libre", planeando: "Planeando", altura: "{n} m", abrirPlaneador: "Abrir planeador", mirarAbajo: "Mirá hacia abajo para bajar más rápido",
    construir: "Construir", muro: "Muro", piso: "Piso", escalera: "Escalera", techo: "Techo", material: "Material", madera: "Madera", piedra: "Piedra", metal: "Metal", pico: "Pico", sinMateriales: "No te alcanzan los materiales",
    mapa: "Mapa", marcar: "Tocá el mapa para marcar", pausa: "Pausa", continuar: "Continuar", salir: "Salir al vestíbulo", clicMouse: "Hacé clic para jugar con el mouse", nadando: "Nadando", saltar: "Saltar", agachar: "Agacharse", apuntar: "Apuntar", recargar: "Recargar", disparar: "Disparar", baile: "Baile", editar: "Editar",
    rifle: "Rifle de asalto", escopeta: "Escopeta de corredera", subfusil: "Subfusil", pistola: "Pistola", francotirador: "Francotirador de cerrojo",
    vendas: "Vendas", botiquin: "Botiquín", pocion: "Poción de escudo", miniescudo: "Mini escudo",
    ligera: "Munición ligera", mediana: "Munición mediana", pesada: "Munición pesada", cartuchos: "Cartuchos",
    r0: "Común", r1: "Poco común", r2: "Raro", r3: "Épico", r4: "Legendario",
    victoria: "VICTORY ROYALE", eliminado: "ELIMINADO", puesto: "Puesto", dano: "Daño hecho", precision: "Precisión", tiempo: "Tiempo", xp: "Experiencia", volver: "Volver al vestíbulo", otraVez: "Jugar otra vez", espectar: "Espectar", teElimino: "Te eliminó {n}", ganaste: "Quedaste último en pie. La isla es tuya.",
    traje0: "Explorador", traje1: "Comando", traje2: "Surfista", traje3: "Sombra", traje4: "Astronauta", traje5: "Granjera",
    tecla_mover: "Moverse", tecla_correr: "Correr", tecla_agachar: "Agacharse / deslizarse", tecla_saltar: "Saltar / trepar / planeador", tecla_disparar: "Disparar", tecla_apuntar: "Apuntar", tecla_recargar: "Recargar", tecla_usar: "Recoger / abrir", tecla_armas: "Armas", tecla_pico: "Pico", tecla_piezas: "Muro · Piso · Escalera · Techo", tecla_material: "Cambiar material", tecla_mapa: "Mapa", tecla_baile: "Baile", tecla_pausa: "Pausa",
    tactil_mover: "Mitad izquierda: palanca para moverte", tactil_mirar: "Mitad derecha: arrastrá para mirar", tactil_botones: "Botones: disparar, saltar, agacharse, apuntar, construir",
    elegiIdioma: "Elegí tu idioma", carrera: "CARRERA", pase: "PASE", modoJuego: "Modo de juego", jugando: "Vas a jugar",
    modo_solo: "Solo", modo_solo_d: "El clásico: saltás del autobús, juntás botín y sobrevivís a la tormenta.",
    modo_rapida: "Tormenta rápida", modo_rapida_d: "La tormenta espera y se cierra el doble de rápido: partidas de unos 8 minutos.",
    modo_arsenal: "Arsenal", modo_arsenal_d: "Todos caen con rifle, escopeta, escudo y materiales: se pelea desde el primer segundo.",
    novedades: "Novedades", nov1: "Dos modos nuevos", nov1_d: "Tormenta rápida para una partida corta y Arsenal para ir directo a los tiros.", nov2: "Pase de temporada", nov2_d: "Tres desafíos por día que dan experiencia, y trajes que se desbloquean por nivel.", nov3: "Tu carrera", nov3_d: "Cada partida queda anotada: récords, historial y precisión.",
    xpSig: "{n} XP para el nivel {m}", tasaVictorias: "% de victorias", bajasPartida: "Bajas por partida", danoTotal: "Daño total", tiempoJugado: "Tiempo jugado",
    records: "Récords", mejorPuesto: "Mejor puesto", recBajas: "Más bajas en una partida", recDano: "Más daño en una partida", recTiempo: "Partida más larga",
    historial: "Últimas partidas", sinPartidas: "Todavía no jugaste ninguna partida. ¡Saltá del autobús!", bajasN: "{n} bajas",
    desafiosHoy: "Desafíos de hoy", renuevan: "Se renuevan a la medianoche", reclamar: "Reclamar", reclamado: "Reclamado",
    des_partidas: "Jugá {n} partidas", des_bajas: "Eliminá a {n} rivales", des_dano: "Hacé {n} de daño", des_top: "Quedá entre los {n} mejores", des_cofres: "Abrí {n} cofres", des_victoria: "Ganá una partida",
    recompensas: "Trajes por nivel", desbloqueado: "Desbloqueado", bloqueado: "Nivel {n}", seDesbloquea: "Se desbloquea en el nivel {n}", bailePrevia: "Probar baile", xpN: "+{n} XP", creditos: "Créditos", sonidosTit: "Sonidos", credito: "{obra} de {autor}, {licencia}, {fuente}", restoCC0: "Los demás sonidos son de dominio público (CC0). Detalle en sonidos/CREDITOS.md del proyecto.", snd_trueno: "Trueno", snd_autobus: "Motor del autobús",
    clic: "Clic", clicDer: "Clic der.", clicDerConstr: "Clic der. (construyendo)", uy: "Uy", sinWebgl: "Este navegador no pudo arrancar los gráficos 3D (WebGL). Probá con Chrome o Safari actualizados.",
    consejos: [
      "En la caída libre, mirá hacia abajo para llegar primero al suelo.",
      "Los cofres dorados brillan y suenan: seguí el ruidito.",
      "Apenas te disparan, levantá un muro y después una escalera.",
      "La escopeta pega fuerte de cerca, y mucho más en la cabeza.",
      "Las vendas curan hasta 75 de vida; el botiquín, hasta 100.",
      "El mini escudo sube hasta 50; la poción de escudo, hasta 100.",
      "Agachado y quieto, el arma dispersa mucho menos.",
      "Corré y agachate para deslizarte: en bajada, más rápido.",
      "Con el pico juntás madera de los árboles, piedra de las rocas y metal de los autos.",
      "Una caída muy alta duele: bajá por la escalera o trepá.",
      "La tormenta pega más fuerte en cada fase: no te quedes afuera.",
      "El francotirador tira balas que caen con la distancia: apuntá un poco más arriba.",
      "La madera se levanta rápido; la piedra y el metal aguantan más.",
      "Escuchá los pasos: te dicen de dónde viene el rival.",
    ],
  },
  en: {
    espacio: "Space", cargando: "Loading", etapa_relieve: "Raising the island…", etapa_pueblos: "Building the towns…", etapa_monte: "Planting trees…", etapa_botin: "Hiding chests…", etapa_escena: "Painting the world…", etapa_sombras: "Setting up the light…", etapa_partida: "Boarding the bus…", listo: "Ready!",
    jugar: "PLAY", casillero: "LOCKER", opciones: "SETTINGS", modo: "Battle Royale", solo: "Solo", rivalesN: "{n} opponents", buscando: "Finding a match…", encontrados: "Players found: {n}", cancelar: "Cancel",
    nivel: "Level {n}", victorias: "Wins", bajas: "Eliminations", partidas: "Matches", girar: "Drag to rotate", equipado: "Equipped", equipar: "Equip", tuNombre: "Your name",
    idioma: "Language", calidad: "Graphics", alta: "High", media: "Medium", baja: "Low", sens: "Sensitivity", sensMira: "Aim sensitivity", volumen: "Volume", autoDisparo: "Auto fire (touch)", asistencia: "Aim assist", autoCorrer: "Auto sprint (touch)", botones: "Button size", fps: "Show frame rate", rivales: "Opponents", si: "On", no: "Off", cerrar: "Close", juego: "Game", video: "Video", audio: "Audio", controles: "Controls",
    escudo: "Shield", vida: "Health", vivos: "Alive", tormentaEn: "Storm forms in", tormentaCierra: "Storm is shrinking", tormentaFin: "The storm covers everything", ojoTormenta: "The storm eye has formed!",
    eliminaste: "You eliminated {n}", elimino: "{a} eliminated {b}", laTormenta: "The storm", caida: "The fall", recoger: "Pick up", abrir: "Open", cambiarPor: "Swap for", usando: "Using {n}", recargando: "Reloading", sinMunicion: "No ammo", llena: "Already full",
    saltarBus: "Jump from the bus", autobusSeVa: "Auto-drop in {n} s", enAutobus: "You're on the bus", caidaLibre: "Skydiving", planeando: "Gliding", altura: "{n} m", abrirPlaneador: "Deploy glider", mirarAbajo: "Look down to fall faster",
    construir: "Build", muro: "Wall", piso: "Floor", escalera: "Stairs", techo: "Cone", material: "Material", madera: "Wood", piedra: "Stone", metal: "Metal", pico: "Pickaxe", sinMateriales: "Not enough materials",
    mapa: "Map", marcar: "Tap the map to place a marker", pausa: "Paused", continuar: "Resume", salir: "Back to lobby", clicMouse: "Click to play with the mouse", nadando: "Swimming", saltar: "Jump", agachar: "Crouch", apuntar: "Aim", recargar: "Reload", disparar: "Fire", baile: "Dance", editar: "Edit",
    rifle: "Assault Rifle", escopeta: "Pump Shotgun", subfusil: "SMG", pistola: "Pistol", francotirador: "Bolt Sniper",
    vendas: "Bandages", botiquin: "Med Kit", pocion: "Shield Potion", miniescudo: "Mini Shield",
    ligera: "Light ammo", mediana: "Medium ammo", pesada: "Heavy ammo", cartuchos: "Shells",
    r0: "Common", r1: "Uncommon", r2: "Rare", r3: "Epic", r4: "Legendary",
    victoria: "VICTORY ROYALE", eliminado: "ELIMINATED", puesto: "Place", dano: "Damage dealt", precision: "Accuracy", tiempo: "Time", xp: "XP", volver: "Back to lobby", otraVez: "Play again", espectar: "Spectate", teElimino: "Eliminated by {n}", ganaste: "Last one standing. The island is yours.",
    traje0: "Explorer", traje1: "Commando", traje2: "Surfer", traje3: "Shadow", traje4: "Astronaut", traje5: "Farmer",
    tecla_mover: "Move", tecla_correr: "Sprint", tecla_agachar: "Crouch / slide", tecla_saltar: "Jump / mantle / glider", tecla_disparar: "Fire", tecla_apuntar: "Aim", tecla_recargar: "Reload", tecla_usar: "Pick up / open", tecla_armas: "Weapons", tecla_pico: "Pickaxe", tecla_piezas: "Wall · Floor · Stairs · Cone", tecla_material: "Change material", tecla_mapa: "Map", tecla_baile: "Dance", tecla_pausa: "Pause",
    tactil_mover: "Left half: stick to move", tactil_mirar: "Right half: drag to look", tactil_botones: "Buttons: fire, jump, crouch, aim, build",
    elegiIdioma: "Choose your language", carrera: "CAREER", pase: "PASS", modoJuego: "Game mode", jugando: "You'll play",
    modo_solo: "Solo", modo_solo_d: "The classic: jump from the bus, gather loot and outlast the storm.",
    modo_rapida: "Fast Storm", modo_rapida_d: "The storm waits and closes twice as fast: matches of about 8 minutes.",
    modo_arsenal: "Arsenal", modo_arsenal_d: "Everyone lands with a rifle, shotgun, shield and materials: the fight starts right away.",
    novedades: "What's new", nov1: "Two new modes", nov1_d: "Fast Storm for a short match and Arsenal to go straight to the action.", nov2: "Season pass", nov2_d: "Three daily challenges that give XP, and outfits that unlock by level.", nov3: "Your career", nov3_d: "Every match is recorded: records, history and accuracy.",
    xpSig: "{n} XP to level {m}", tasaVictorias: "Win rate", bajasPartida: "Eliminations per match", danoTotal: "Total damage", tiempoJugado: "Time played",
    records: "Records", mejorPuesto: "Best place", recBajas: "Most eliminations in a match", recDano: "Most damage in a match", recTiempo: "Longest match",
    historial: "Recent matches", sinPartidas: "You haven't played a match yet. Jump from the bus!", bajasN: "{n} elims",
    desafiosHoy: "Today's challenges", renuevan: "They refresh at midnight", reclamar: "Claim", reclamado: "Claimed",
    des_partidas: "Play {n} matches", des_bajas: "Eliminate {n} opponents", des_dano: "Deal {n} damage", des_top: "Finish in the top {n}", des_cofres: "Open {n} chests", des_victoria: "Win a match",
    recompensas: "Outfits by level", desbloqueado: "Unlocked", bloqueado: "Level {n}", seDesbloquea: "Unlocks at level {n}", bailePrevia: "Try dance", xpN: "+{n} XP", creditos: "Credits", sonidosTit: "Sounds", credito: "{obra} by {autor}, {licencia}, {fuente}", restoCC0: "All other sounds are public domain (CC0). Details in the project's sonidos/CREDITOS.md.", snd_trueno: "Thunder", snd_autobus: "Bus engine",
    clic: "Click", clicDer: "Right click", clicDerConstr: "Right click (building)", uy: "Oops", sinWebgl: "This browser couldn't start 3D graphics (WebGL). Try an up-to-date Chrome or Safari.",
    // Los lugares se buscan por su nombre en castellano (el de isla.js): en español t() devuelve la clave tal cual.
    "Pueblo Pintoresco": "Pleasant Village", "Loma Linda": "Lovely Hill", "Villa Verde": "Green Villa", "Granja Feliz": "Happy Farm", "Depósito Norte": "North Depot", "Estación Sur": "South Station", "Bahía Bonita": "Pretty Bay", "Muelle Viejo": "Old Pier",
    consejos: [
      "While skydiving, look down to reach the ground first.",
      "Golden chests glow and hum: follow the sound.",
      "As soon as you're shot, build a wall, then stairs.",
      "The shotgun hits hard up close, and much harder on the head.",
      "Bandages heal up to 75 health; the med kit, up to 100.",
      "Mini shields go up to 50; shield potions, up to 100.",
      "Crouched and still, your weapon spreads much less.",
      "Sprint and crouch to slide: faster downhill.",
      "Your pickaxe gets wood from trees, stone from rocks and metal from cars.",
      "Long falls hurt: take the stairs or mantle.",
      "The storm hits harder each phase: don't stay outside.",
      "Sniper bullets drop with distance: aim a little higher.",
      "Wood builds fast; stone and metal last longer.",
      "Listen for footsteps: they tell you where enemies are.",
    ],
  },
  pt: {
    espacio: "Espaço", cargando: "Carregando", etapa_relieve: "Erguendo a ilha…", etapa_pueblos: "Construindo as cidades…", etapa_monte: "Plantando árvores…", etapa_botin: "Escondendo baús…", etapa_escena: "Pintando o mundo…", etapa_sombras: "Preparando a luz…", etapa_partida: "Embarcando no ônibus…", listo: "Pronto!",
    jugar: "JOGAR", casillero: "ARMÁRIO", opciones: "CONFIGURAÇÕES", modo: "Battle Royale", solo: "Solo", rivalesN: "{n} adversários", buscando: "Procurando partida…", encontrados: "Jogadores encontrados: {n}", cancelar: "Cancelar",
    nivel: "Nível {n}", victorias: "Vitórias", bajas: "Eliminações", partidas: "Partidas", girar: "Arraste para girar", equipado: "Equipado", equipar: "Equipar", tuNombre: "Seu nome",
    idioma: "Idioma", calidad: "Gráficos", alta: "Alta", media: "Média", baja: "Baixa", sens: "Sensibilidade", sensMira: "Sensibilidade ao mirar", volumen: "Volume", autoDisparo: "Disparo automático (toque)", asistencia: "Assistência de mira", autoCorrer: "Corrida automática (toque)", botones: "Tamanho dos botões", fps: "Mostrar quadros por segundo", rivales: "Adversários", si: "Sim", no: "Não", cerrar: "Fechar", juego: "Jogo", video: "Vídeo", audio: "Áudio", controles: "Controles",
    escudo: "Escudo", vida: "Vida", vivos: "Vivos", tormentaEn: "A tempestade se forma em", tormentaCierra: "A tempestade está fechando", tormentaFin: "A tempestade cobre tudo", ojoTormenta: "O olho da tempestade se formou!",
    eliminaste: "Você eliminou {n}", elimino: "{a} eliminou {b}", laTormenta: "A tempestade", caida: "A queda", recoger: "Pegar", abrir: "Abrir", cambiarPor: "Trocar por", usando: "Usando {n}", recargando: "Recarregando", sinMunicion: "Sem munição", llena: "Já está cheio",
    saltarBus: "Pular do ônibus", autobusSeVa: "Salto automático em {n} s", enAutobus: "Você está no ônibus", caidaLibre: "Queda livre", planeando: "Planando", altura: "{n} m", abrirPlaneador: "Abrir planador", mirarAbajo: "Olhe para baixo para cair mais rápido",
    construir: "Construir", muro: "Parede", piso: "Piso", escalera: "Escada", techo: "Cone", material: "Material", madera: "Madeira", piedra: "Pedra", metal: "Metal", pico: "Picareta", sinMateriales: "Materiais insuficientes",
    mapa: "Mapa", marcar: "Toque o mapa para marcar", pausa: "Pausa", continuar: "Continuar", salir: "Voltar ao lobby", clicMouse: "Clique para jogar com o mouse", nadando: "Nadando", saltar: "Pular", agachar: "Agachar", apuntar: "Mirar", recargar: "Recarregar", disparar: "Atirar", baile: "Dança", editar: "Editar",
    rifle: "Rifle de assalto", escopeta: "Escopeta de bombeamento", subfusil: "Submetralhadora", pistola: "Pistola", francotirador: "Rifle de precisão",
    vendas: "Ataduras", botiquin: "Kit médico", pocion: "Poção de escudo", miniescudo: "Miniescudo",
    ligera: "Munição leve", mediana: "Munição média", pesada: "Munição pesada", cartuchos: "Cartuchos",
    r0: "Comum", r1: "Incomum", r2: "Raro", r3: "Épico", r4: "Lendário",
    victoria: "VICTORY ROYALE", eliminado: "ELIMINADO", puesto: "Posição", dano: "Dano causado", precision: "Precisão", tiempo: "Tempo", xp: "Experiência", volver: "Voltar ao lobby", otraVez: "Jogar de novo", espectar: "Assistir", teElimino: "Eliminado por {n}", ganaste: "Último de pé. A ilha é sua.",
    traje0: "Explorador", traje1: "Comando", traje2: "Surfista", traje3: "Sombra", traje4: "Astronauta", traje5: "Fazendeira",
    tecla_mover: "Mover", tecla_correr: "Correr", tecla_agachar: "Agachar / deslizar", tecla_saltar: "Pular / escalar / planador", tecla_disparar: "Atirar", tecla_apuntar: "Mirar", tecla_recargar: "Recarregar", tecla_usar: "Pegar / abrir", tecla_armas: "Armas", tecla_pico: "Picareta", tecla_piezas: "Parede · Piso · Escada · Cone", tecla_material: "Trocar material", tecla_mapa: "Mapa", tecla_baile: "Dança", tecla_pausa: "Pausa",
    tactil_mover: "Metade esquerda: alavanca para mover", tactil_mirar: "Metade direita: arraste para olhar", tactil_botones: "Botões: atirar, pular, agachar, mirar, construir",
    elegiIdioma: "Escolha seu idioma", carrera: "CARREIRA", pase: "PASSE", modoJuego: "Modo de jogo", jugando: "Você vai jogar",
    modo_solo: "Solo", modo_solo_d: "O clássico: pule do ônibus, junte itens e sobreviva à tempestade.",
    modo_rapida: "Tempestade rápida", modo_rapida_d: "A tempestade espera e fecha duas vezes mais rápido: partidas de uns 8 minutos.",
    modo_arsenal: "Arsenal", modo_arsenal_d: "Todos caem com rifle, escopeta, escudo e materiais: a luta começa na hora.",
    novedades: "Novidades", nov1: "Dois modos novos", nov1_d: "Tempestade rápida para uma partida curta e Arsenal para ir direto aos tiros.", nov2: "Passe de temporada", nov2_d: "Três desafios por dia que dão experiência, e trajes que se desbloqueiam por nível.", nov3: "Sua carreira", nov3_d: "Cada partida fica registrada: recordes, histórico e precisão.",
    xpSig: "{n} XP para o nível {m}", tasaVictorias: "% de vitórias", bajasPartida: "Eliminações por partida", danoTotal: "Dano total", tiempoJugado: "Tempo jogado",
    records: "Recordes", mejorPuesto: "Melhor posição", recBajas: "Mais eliminações numa partida", recDano: "Mais dano numa partida", recTiempo: "Partida mais longa",
    historial: "Últimas partidas", sinPartidas: "Você ainda não jogou nenhuma partida. Pule do ônibus!", bajasN: "{n} elim.",
    desafiosHoy: "Desafios de hoje", renuevan: "Renovam à meia-noite", reclamar: "Resgatar", reclamado: "Resgatado",
    des_partidas: "Jogue {n} partidas", des_bajas: "Elimine {n} adversários", des_dano: "Cause {n} de dano", des_top: "Fique entre os {n} melhores", des_cofres: "Abra {n} baús", des_victoria: "Vença uma partida",
    recompensas: "Trajes por nível", desbloqueado: "Desbloqueado", bloqueado: "Nível {n}", seDesbloquea: "Desbloqueia no nível {n}", bailePrevia: "Testar dança", xpN: "+{n} XP", creditos: "Créditos", sonidosTit: "Sons", credito: "{obra} de {autor}, {licencia}, {fuente}", restoCC0: "Os demais sons são de domínio público (CC0). Detalhes em sonidos/CREDITOS.md do projeto.", snd_trueno: "Trovão", snd_autobus: "Motor do ônibus",
    clic: "Clique", clicDer: "Clique dir.", clicDerConstr: "Clique dir. (construindo)", uy: "Ops", sinWebgl: "Este navegador não conseguiu iniciar os gráficos 3D (WebGL). Tente o Chrome ou o Safari atualizados.",
    "Pueblo Pintoresco": "Vila Pitoresca", "Loma Linda": "Colina Linda", "Villa Verde": "Vila Verde", "Granja Feliz": "Fazenda Feliz", "Depósito Norte": "Depósito Norte", "Estación Sur": "Estação Sul", "Bahía Bonita": "Baía Bonita", "Muelle Viejo": "Cais Velho",
    consejos: [
      "Na queda livre, olhe para baixo para chegar primeiro ao chão.",
      "Baús dourados brilham e fazem barulho: siga o som.",
      "Assim que levar tiro, construa uma parede e depois uma escada.",
      "A escopeta bate forte de perto, e muito mais na cabeça.",
      "Ataduras curam até 75 de vida; o kit médico, até 100.",
      "O miniescudo vai até 50; a poção de escudo, até 100.",
      "Agachado e parado, a arma espalha muito menos.",
      "Corra e agache para deslizar: na descida, mais rápido.",
      "A picareta pega madeira das árvores, pedra das rochas e metal dos carros.",
      "Quedas altas machucam: desça pela escada ou escale.",
      "A tempestade bate mais forte a cada fase: não fique fora.",
      "A bala do rifle de precisão cai com a distância: mire um pouco acima.",
      "Madeira constrói rápido; pedra e metal aguentam mais.",
      "Ouça os passos: eles mostram de onde vem o inimigo.",
    ],
  },
};
let IDIOMA = "es";
function t(clave, vars) {
  let s = (TEXTOS[IDIOMA] && TEXTOS[IDIOMA][clave]) ?? TEXTOS.es[clave] ?? clave;
  if (vars && typeof s === "string") for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
  return s;
}

// ════════════════════════════════════════════════════════════════════════
// Datos del juego
// ════════════════════════════════════════════════════════════════════════
// Los números salen de las guías del original (daño, cadencia, cargador,
// multiplicador de cabeza) y se escalan por rareza como allá.
const RAREZAS = [
  { color: "#b4b4b4", oscuro: "#5c5c5c", k: 1.0, recarga: 1.0 },
  { color: "#5bd13a", oscuro: "#256b17", k: 1.05, recarga: 0.95 },
  { color: "#3aa2ff", oscuro: "#14528f", k: 1.1, recarga: 0.9 },
  { color: "#b45cff", oscuro: "#5a2294", k: 1.16, recarga: 0.85 },
  { color: "#ffae2e", oscuro: "#9a5a00", k: 1.22, recarga: 0.8 },
];
const ARMAS = {
  // cadencia en tiros por segundo; disp en radianes (desde la cadera / apuntando).
  rifle:         { mun: "mediana", dano: 30, cabeza: 1.5, cadencia: 5.5, cargador: 30, recarga: 2.3, disp: 0.032, dispMira: 0.006, abre: 0.006, perdigones: 1, alcance: 220, cae: 70, zoom: 1.5, retro: 0.011, rarezas: [0, 1, 2, 3, 4] },
  escopeta:      { mun: "cartuchos", dano: 9.5, cabeza: 1.8, cadencia: 0.75, cargador: 5, recarga: 4.2, disp: 0.085, dispMira: 0.07, abre: 0, perdigones: 10, alcance: 45, cae: 12, zoom: 1.15, retro: 0.05, rarezas: [0, 1, 2, 3, 4] },
  subfusil:      { mun: "ligera", dano: 17, cabeza: 1.5, cadencia: 12, cargador: 30, recarga: 2.2, disp: 0.045, dispMira: 0.025, abre: 0.003, perdigones: 1, alcance: 110, cae: 25, zoom: 1.25, retro: 0.006, rarezas: [0, 1, 2, 3] },
  pistola:       { mun: "ligera", dano: 25, cabeza: 1.75, cadencia: 6.75, cargador: 16, recarga: 1.4, disp: 0.03, dispMira: 0.008, abre: 0.004, perdigones: 1, alcance: 120, cae: 35, zoom: 1.25, retro: 0.014, rarezas: [0, 1, 2, 3] },
  francotirador: { mun: "pesada", dano: 105, cabeza: 2.5, cadencia: 0.33, cargador: 1, recarga: 2.8, disp: 0.11, dispMira: 0, abre: 0, perdigones: 1, alcance: 600, cae: 999, zoom: 4, retro: 0.07, proyectil: 300, gravedad: 7, rarezas: [2, 3, 4] },
};
const TIPOS_ARMA = Object.keys(ARMAS);
const CONSUMIBLES = {
  vendas:     { vida: 15, tope: 75, tiempo: 3.5, pila: 15, cant: 5, color: "#f2efe6" },
  botiquin:   { vida: 100, tope: 100, tiempo: 10, pila: 3, cant: 1, color: "#e8413c" },
  pocion:     { escudo: 50, tope: 100, tiempo: 5, pila: 3, cant: 1, color: "#3aa2ff" },
  miniescudo: { escudo: 25, tope: 50, tiempo: 2, pila: 6, cant: 3, color: "#7fd3ff" },
};
const MUNICIONES = {
  ligera:    { caja: 36, tope: 999, color: "#9fd3ff" },
  mediana:   { caja: 30, tope: 999, color: "#5bd13a" },
  pesada:    { caja: 6, tope: 999, color: "#e0525a" },
  cartuchos: { caja: 10, tope: 999, color: "#ffb02e" },
};
// Materiales de construcción: vida máxima de cada pieza y cuánto tarda en llegar a ella.
const MATERIALES = {
  madera: { vida: 150, tiempo: 2, color: "#c98f55" },
  piedra: { vida: 300, tiempo: 4, color: "#a9a49a" },
  metal:  { vida: 500, tiempo: 6, color: "#8e9aa6" },
};
const LISTA_MAT = ["madera", "piedra", "metal"];
const COSTO = 10, TOPE_MAT = 500;
const PIEZAS = ["muro", "piso", "escalera", "techo"];
const TRAJES = [
  { ropa: "#ff7a3d", pantalon: "#2d3a5c", pelo: "#5a3218", piel: "#f1c29a", mochila: "#ffc62e", gorro: null },
  { ropa: "#56683f", pantalon: "#3b3a2a", pelo: "#1f1b17", piel: "#c98e62", mochila: "#2f3a24", gorro: "casco", gorroColor: "#4a5a36" },
  { ropa: "#20c4b4", pantalon: "#ffb627", pelo: "#ffd35c", piel: "#e8b48a", mochila: "#ff5a9a", gorro: "gorra", gorroColor: "#ff5a9a" },
  { ropa: "#22242c", pantalon: "#1a1b20", pelo: "#15161a", piel: "#f3c9a4", mochila: "#b33b3b", gorro: "capucha", gorroColor: "#22242c" },
  { ropa: "#f2f2f2", pantalon: "#d8dce2", pelo: "#666666", piel: "#f5d0b0", mochila: "#3a82ff", gorro: "escafandra", gorroColor: "#e8f2ff" },
  { ropa: "#c0463a", pantalon: "#3a5c9a", pelo: "#a13d2d", piel: "#f5d0b0", mochila: "#8a5a33", gorro: "sombrero", gorroColor: "#e2c275" },
];
const NOMBRES_BOTS = ["Kiwi", "Mango", "Lima", "Coco", "Uva", "Pomelo", "Tuna", "Chala", "Pampa", "Yerba", "Bruma", "Rayo", "Quique", "Nube", "Tero", "Puma", "Ceibo", "Lapacho", "Cóndor", "Mate", "Churro", "Alfajor", "Dulce", "Tango", "Gaucho", "Pehuén"];
const nivelDe = (xp) => 1 + Math.floor(Math.sqrt(xp / 120));

// ── modos, trajes por nivel y desafíos del día ──
// ritmo multiplica los tiempos de la tormenta; kit es lo que cada jugador trae al caer.
const MODOS = {
  solo: { icono: "🪂", ritmo: 1, kit: false },
  rapida: { icono: "🌀", ritmo: 0.5, kit: false },
  arsenal: { icono: "🎯", ritmo: 0.8, kit: true },
};
// Los tres primeros vienen de entrada; el resto se gana subiendo de nivel, que
// es lo que le da sentido al pase (sin esto la experiencia no servía para nada).
const TRAJE_NIVEL = [1, 1, 1, 2, 4, 6];
const RAREZA_TRAJE = [1, 1, 2, 3, 4, 2];
// Cada día salen tres de la lista, siempre los mismos para esa fecha.
const DESAFIOS = [
  { id: "partidas", meta: 3, xp: 150, valor: (d) => d.partidas },
  { id: "bajas", meta: 5, xp: 200, valor: (d) => d.bajas },
  { id: "dano", meta: 500, xp: 200, valor: (d) => Math.round(d.dano) },
  { id: "top", meta: 10, xp: 150, valor: (d) => (d.mejorPuesto && d.mejorPuesto <= 10 ? 10 : 0) },
  { id: "cofres", meta: 5, xp: 150, valor: (d) => d.cofres },
  { id: "victoria", meta: 1, xp: 400, valor: (d) => d.victorias },
];
const hoy = () => { const f = new Date(); return f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0"); };
const diarioVacio = () => ({ dia: hoy(), partidas: 0, bajas: 0, dano: 0, mejorPuesto: 0, cofres: 0, victorias: 0, reclamados: [] });
const diarioDe = (stats) => (stats.diario && stats.diario.dia === hoy() ? stats.diario : diarioVacio());
function desafiosDeHoy() {
  const r = azar(hoy().split("-").reduce((a, n) => a * 37 + +n, 7));
  return DESAFIOS.slice().sort(() => r() - 0.5).slice(0, 3);
}
