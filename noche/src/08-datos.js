// ─────────────────────────────────────────────────────────────────────────────
// LOS DATOS. Los números salen de la wiki oficial del género que homenajeamos
// (vampire.survivors.wiki, leída el 30/09/2026): daño, recarga, cantidad, área, velocidad, duración,
// perforación y empuje de cada arma y su tabla de niveles 2-8; pasivos por nivel; mejoras de la
// tienda con su fórmula de precio; oleadas del bosque minuto a minuto; vida/daño/velocidad/xp de
// cada enemigo. Los nombres y el arte son propios.
// Unidades: velocidad de enemigos "100 = normal" → ×VEL_U px/s; área 1 = el tamaño base de cada arma.
// ─────────────────────────────────────────────────────────────────────────────

const VEL_U = 0.3;                // 100 de la wiki → 30 px/s (un zombi); el jugador base anda a 62
const VEL_JUG = 62;

// ── armas: base + lo que suma cada nivel (2..8). "evo": el pasivo que pide y en qué se convierte ──
const ARMAS = {
  latigo: { n: { es: "Látigo", en: "Whip" }, d: { es: "Azota en horizontal. Atraviesa enemigos.", en: "Attacks horizontally, passes through enemies." },
    b: { dano: 10, cd: 1.35, cant: 1, area: 1, vel: 1, dur: 0, perf: 999, emp: 1, int: 0.1 },
    nv: [{ cant: 1 }, { dano: 5 }, { area: 0.1, dano: 5 }, { dano: 5 }, { area: 0.1, dano: 5 }, { dano: 5 }, { dano: 5 }], evo: ["corazon", "carmesi"], sfx: "latigo" },
  varita: { n: { es: "Varita Mágica", en: "Magic Wand" }, d: { es: "Dispara al enemigo más cercano.", en: "Fires at the nearest enemy." },
    b: { dano: 10, cd: 1.2, cant: 1, area: 1, vel: 1, dur: 0, perf: 1, emp: 1, int: 0.1 },
    nv: [{ cant: 1 }, { cd: -0.2 }, { cant: 1 }, { dano: 10 }, { cant: 1 }, { perf: 1 }, { dano: 10 }], evo: ["tomo", "sagrada"], sfx: "magia" },
  cuchillo: { n: { es: "Cuchillo", en: "Knife" }, d: { es: "Se lanza hacia donde mirás.", en: "Fires quickly in the faced direction." },
    b: { dano: 6.5, cd: 1, cant: 1, area: 1, vel: 1, dur: 0, perf: 1, emp: 0.5, int: 0.1 },
    nv: [{ cant: 1 }, { cant: 1, dano: 5 }, { cant: 1, int: -0.02 }, { perf: 1 }, { cant: 1, int: -0.02 }, { cant: 1, dano: 5 }, { perf: 1, int: -0.02 }], evo: ["brazal", "milfilos"], sfx: "cuchillo" },
  hacha: { n: { es: "Hacha", en: "Axe" }, d: { es: "Mucho daño y mucha área. Sube y cae.", en: "High damage, high area scaling." },
    b: { dano: 20, cd: 4, cant: 1, area: 1, vel: 1, dur: 0, perf: 3, emp: 1, int: 0.2 },
    nv: [{ cant: 1 }, { dano: 20 }, { perf: 2 }, { cant: 1 }, { dano: 20 }, { perf: 2 }, { dano: 20 }], evo: ["candelabro", "espiral"], sfx: "hacha" },
  cruz: { n: { es: "Cruz", en: "Cross" }, d: { es: "Apunta al más cercano y vuelve como un bumerán.", en: "Aims at nearest enemy, has boomerang effect." },
    b: { dano: 5, cd: 2, cant: 1, area: 1, vel: 1, dur: 0, perf: 999, emp: 1, int: 0.1 },
    nv: [{ dano: 10 }, { area: 0.1, vel: 0.25 }, { cant: 1 }, { dano: 10 }, { area: 0.1, vel: 0.25 }, { cant: 1 }, { dano: 10 }], evo: ["trebol", "celeste"], sfx: "cruz" },
  libro: { n: { es: "Biblia", en: "Bible" }, d: { es: "Gira a tu alrededor.", en: "Orbits around the character." },
    b: { dano: 10, cd: 3, cant: 1, area: 1, vel: 1, dur: 3, perf: 999, emp: 1, int: 0 },
    nv: [{ cant: 1 }, { area: 0.25, vel: 0.3 }, { dur: 0.5, dano: 10 }, { cant: 1 }, { area: 0.25, vel: 0.3 }, { dur: 0.5, dano: 10 }, { cant: 1 }], evo: ["hechizo", "visperas"], sfx: "cruz" },
  fuego: { n: { es: "Varita de Fuego", en: "Fire Wand" }, d: { es: "Dispara a un enemigo al azar. Mucho daño.", en: "Fires at a random enemy, deals heavy damage." },
    b: { dano: 20, cd: 3, cant: 3, area: 1, vel: 0.75, dur: 0, perf: 1, emp: 1, int: 0 },
    nv: [{ dano: 10 }, { dano: 10, vel: 0.2 }, { dano: 10 }, { dano: 10, vel: 0.2 }, { dano: 10 }, { dano: 10, vel: 0.2 }, { dano: 10 }], evo: ["espinaca", "averno"], sfx: "fuego" },
  ajo: { n: { es: "Ajo", en: "Garlic" }, d: { es: "Daña a los enemigos cercanos y les baja la resistencia.", en: "Damages nearby enemies. Reduces resistance to knockback and freeze." },
    b: { dano: 5, cd: 1.3, cant: 1, area: 1, vel: 1, dur: 0, perf: 999, emp: 0, int: 0 },
    nv: [{ area: 0.4, dano: 2 }, { cd: -0.1, dano: 1 }, { area: 0.2, dano: 1 }, { cd: -0.1, dano: 2 }, { area: 0.2, dano: 1 }, { cd: -0.1, dano: 1 }, { area: 0.2, dano: 2 }], evo: ["tomate", "devora"], sfx: null },
  agua: { n: { es: "Agua Bendita", en: "Holy Water" }, d: { es: "Genera charcos que dañan.", en: "Generates damaging zones." },
    b: { dano: 10, cd: 4.5, cant: 1, area: 1, vel: 1, dur: 2, perf: 999, emp: 0, int: 0.3 },
    nv: [{ cant: 1, area: 0.2 }, { dur: 0.5, dano: 10 }, { cant: 1, area: 0.2 }, { dur: 0.3, dano: 10 }, { cant: 1, area: 0.2 }, { dur: 0.3, dano: 5 }, { area: 0.2, dano: 5 }], evo: ["orbe", "marea"], sfx: "agua" },
  runa: { n: { es: "Runa Errante", en: "Wandering Rune" }, d: { es: "Atraviesa enemigos y rebota en los bordes.", en: "Passes through enemies, bounces around." },
    b: { dano: 10, cd: 3, cant: 1, area: 1, vel: 1, dur: 2.25, perf: 999, emp: 1, int: 0.3 },
    nv: [{ dano: 5, vel: 0.2 }, { dur: 0.25, dano: 5 }, { cant: 1 }, { dano: 5, vel: 0.2 }, { dur: 0.25, dano: 5 }, { cant: 1 }, { dur: 0.5 }], evo: ["armadura", "sinmanana"], sfx: "runa" },
  rayo: { n: { es: "Anillo del Rayo", en: "Lightning Ring" }, d: { es: "Parte a enemigos al azar con rayos.", en: "Strikes at random enemies." },
    b: { dano: 15, cd: 4.5, cant: 2, area: 1, vel: 1, dur: 0, perf: 999, emp: 1, int: 0.1 },
    nv: [{ cant: 1 }, { area: 1, dano: 10 }, { cant: 1 }, { area: 1, dano: 20 }, { cant: 1 }, { area: 1, dano: 20 }, { cant: 1 }], evo: ["duplicador", "tormenta"], sfx: "rayo" },
};
// las evoluciones: los valores finales de la wiki (el arma base queda reemplazada)
const EVOS = {
  carmesi: { de: "latigo", n: { es: "Látigo Carmesí", en: "Crimson Lash" }, d: { es: "Puede dar críticos y curar al hacerlos. Sin límite de daño.", en: "Can deal critical damage and absorb HP." },
    b: { dano: 40, cd: 1.35, cant: 2, area: 1.3, vel: 1, dur: 0, perf: 999, emp: 1, int: 0.1, crit: 0.1, xcrit: 2, curaCrit: 8 } },
  sagrada: { de: "varita", n: { es: "Varita Sagrada", en: "Sacred Wand" }, d: { es: "Dispara sin descanso.", en: "Fires with no delay." },
    b: { dano: 30, cd: 0.5, cant: 4, area: 1, vel: 2, dur: 0, perf: 2, emp: 1, int: 0.1 } },
  milfilos: { de: "cuchillo", n: { es: "Mil Filos", en: "Thousand Blades" }, d: { es: "Una lluvia de cuchillos sin fin.", en: "Fires with no delay." },
    b: { dano: 16.5, cd: 0.35, cant: 6, area: 1, vel: 1.5, dur: 0, perf: 3, emp: 0.5, int: 0.05 } },
  espiral: { de: "hacha", n: { es: "Espiral de la Muerte", en: "Death Spiral" }, d: { es: "Guadañas que salen en todas direcciones.", en: "Passes through enemies." },
    b: { dano: 60, cd: 4, cant: 9, area: 1.2, vel: 0.8, dur: 0, perf: 999, emp: 1, int: 0 } },
  celeste: { de: "cruz", n: { es: "Espada Celeste", en: "Sky Sword" }, d: { es: "Críticos devastadores.", en: "Can deal critical damage." },
    b: { dano: 77, cd: 3.3, cant: 1, area: 1, vel: 2, dur: 0, perf: 999, emp: 6, int: 0.1, crit: 0.1, xcrit: 2.5 } },
  visperas: { de: "libro", n: { es: "Vísperas Oscuras", en: "Dark Vespers" }, d: { es: "Nunca termina.", en: "Never ends." },
    b: { dano: 30, cd: 3, cant: 4, area: 1.75, vel: 1.6, dur: 3, perf: 999, emp: 1, int: 0, eterna: 1 } },
  averno: { de: "fuego", n: { es: "Fuego del Averno", en: "Infernal Fire" }, d: { es: "Meteoros que lo atraviesan todo.", en: "Passes through enemies." },
    b: { dano: 100, cd: 3, cant: 2, area: 2.2, vel: 0.5, dur: 0, perf: 999, emp: 1, int: 0.2 } },
  devora: { de: "ajo", n: { es: "Devoraalmas", en: "Soul Devourer" }, d: { es: "Se hace más fuerte al curarte. Los caídos sueltan corazoncitos.", en: "Power increases when recovering HP." },
    b: { dano: 20, cd: 1, cant: 1, area: 3, vel: 1, dur: 0, perf: 999, emp: 0, int: 0, corazones: 1 } },
  marea: { de: "agua", n: { es: "La Marea", en: "The Tide" }, d: { es: "Los charcos crecen y te siguen.", en: "Damaging zones follow you and grow." },
    b: { dano: 40, cd: 4, cant: 4, area: 2, vel: 1, dur: 4, perf: 999, emp: 0, int: 0.2, sigue: 1 } },
  sinmanana: { de: "runa", n: { es: "Sin Mañana", en: "No Tomorrow" }, d: { es: "Explota al rebotar. Estalla cuando te golpean.", en: "Explodes when bouncing and when you get hit." },
    b: { dano: 30, cd: 1, cant: 3, area: 1, vel: 2.8, dur: 3, perf: 999, emp: 1, int: 0.3, explota: 1 } },
  tormenta: { de: "rayo", n: { es: "Tormenta Eterna", en: "Endless Storm" }, d: { es: "Cada rayo cae dos veces.", en: "Projectiles strike twice." },
    b: { dano: 65, cd: 4.5, cant: 6, area: 4, vel: 1, dur: 0, perf: 999, emp: 1, int: 0.1, doble: 1 } },
};

// ── pasivos: st = lo que suma cada nivel ──
const PASIVOS = {
  espinaca: { n: { es: "Espinaca", en: "Spinach" }, d: { es: "Más daño: +10%.", en: "Raises inflicted damage by 10%." }, st: { poder: 0.1 }, max: 5 },
  armadura: { n: { es: "Armadura", en: "Armor" }, d: { es: "Menos daño recibido: +1 de armadura.", en: "Reduces incoming damage by 1." }, st: { armadura: 1 }, max: 5 },
  corazon: { n: { es: "Corazón Vacío", en: "Hollow Heart" }, d: { es: "Vida máxima +20%.", en: "Augments max health by 20%." }, st: { vidaMult: 0.2 }, max: 5 },
  tomate: { n: { es: "Tomate Encantado", en: "Charmed Tomato" }, d: { es: "Recuperás 0,2 de vida por segundo.", en: "Character recovers 0.2 HP per second." }, st: { recup: 0.2 }, max: 5 },
  tomo: { n: { es: "Tomo Vacío", en: "Empty Tome" }, d: { es: "Las armas recargan 8% más rápido.", en: "Reduces weapons cooldown by 8%." }, st: { cd: -0.08 }, max: 5 },
  candelabro: { n: { es: "Candelabro", en: "Candelabra" }, d: { es: "Área de las armas +10%.", en: "Augments area of attacks by 10%." }, st: { area: 0.1 }, max: 5 },
  brazal: { n: { es: "Brazal", en: "Bracer" }, d: { es: "Proyectiles 10% más rápidos.", en: "Increases projectiles speed by 10%." }, st: { vel: 0.1 }, max: 5 },
  hechizo: { n: { es: "Atahechizos", en: "Spellbinder" }, d: { es: "Los efectos de las armas duran 10% más.", en: "Increases duration of weapon effects by 10%." }, st: { dur: 0.1 }, max: 5 },
  duplicador: { n: { es: "Espejo Doble", en: "Twin Mirror" }, d: { es: "Las armas tiran un proyectil más.", en: "Weapons fire more projectiles." }, st: { cant: 1 }, max: 2, rareza: 40 },
  alas: { n: { es: "Alas", en: "Wings" }, d: { es: "Te movés 10% más rápido.", en: "Character moves 10% faster." }, st: { velMov: 0.1 }, max: 5 },
  orbe: { n: { es: "Orbe Atractor", en: "Attractor Orb" }, d: { es: "Atraés los objetos desde más lejos.", en: "Character pickups items from further away." }, st: { iman: 1 }, max: 5 },
  trebol: { n: { es: "Trébol", en: "Clover" }, d: { es: "Suerte +10%.", en: "Character gets 10% luckier." }, st: { suerte: 0.1 }, max: 5 },
  corona: { n: { es: "Corona", en: "Crown" }, d: { es: "Ganás 8% más de experiencia.", en: "Character gains 8% more experience." }, st: { crec: 0.08 }, max: 5, rareza: 80 },
  mascara: { n: { es: "Máscara de Piedra", en: "Stone Mask" }, d: { es: "Ganás 10% más de oro.", en: "Character earns 10% more coins." }, st: { codicia: 0.1 }, max: 5, rareza: 80 },
  calavera: { n: { es: "Calavera Maldita", en: "Cursed Skull" }, d: { es: "Los enemigos: +10% más rápidos, más vida y más cantidad.", en: "Enemies: +10% speed, health, quantity." }, st: { maldicion: 0.1 }, max: 5, rareza: 50 },
  tiramisu: { n: { es: "Tiramisú", en: "Tiramisu" }, d: { es: "Revivís una vez más.", en: "Character revives once more." }, st: { revivir: 1 }, max: 2, rareza: 40 },
};
// el imán del orbe no es lineal en la wiki: ×1,5 · ×2 · ×2,5 · ×3 · ×4
const IMAN_ORBE = [1, 1.5, 1.995, 2.494, 2.9925, 3.98];

// ── la tienda (base, rango máximo, qué da por rango). Precio = base × (1 + comprados) + recargo ──
const MEJORAS = [
  ["poder", { es: "Poder", en: "Might" }, 200, 5, { poder: 0.05 }, { es: "+5% de daño por rango.", en: "+5% damage per rank." }, "espinaca"],
  ["armadura", { es: "Armadura", en: "Armor" }, 600, 3, { armadura: 1 }, { es: "+1 de armadura por rango.", en: "+1 armor per rank." }, "armadura"],
  ["vida", { es: "Vida Máxima", en: "Max Health" }, 200, 3, { vidaMult: 0.1 }, { es: "+10% de vida máxima por rango.", en: "+10% max health per rank." }, "corazon"],
  ["recup", { es: "Recuperación", en: "Recovery" }, 200, 5, { recup: 0.1 }, { es: "+0,1 de vida por segundo.", en: "+0.1 HP per second." }, "tomate"],
  ["cd", { es: "Recarga", en: "Cooldown" }, 900, 2, { cd: -0.025 }, { es: "Las armas recargan 2,5% más rápido.", en: "-2.5% weapon cooldown." }, "tomo"],
  ["area", { es: "Área", en: "Area" }, 300, 2, { area: 0.05 }, { es: "+5% de área.", en: "+5% area." }, "candelabro"],
  ["vel", { es: "Velocidad", en: "Speed" }, 300, 2, { vel: 0.1 }, { es: "+10% de velocidad de proyectiles.", en: "+10% projectile speed." }, "brazal"],
  ["dur", { es: "Duración", en: "Duration" }, 300, 2, { dur: 0.15 }, { es: "+15% de duración.", en: "+15% duration." }, "hechizo"],
  ["cant", { es: "Cantidad", en: "Amount" }, 5000, 1, { cant: 1 }, { es: "Un proyectil más en cada arma.", en: "+1 projectile for every weapon." }, "duplicador"],
  ["mov", { es: "Movimiento", en: "Move Speed" }, 600, 2, { velMov: 0.05 }, { es: "Te movés 5% más rápido.", en: "+5% movement speed." }, "alas"],
  ["iman", { es: "Imán", en: "Magnet" }, 300, 2, { imanMult: 0.25 }, { es: "Atraés objetos 25% más lejos.", en: "+25% pickup range." }, "orbe"],
  ["suerte", { es: "Suerte", en: "Luck" }, 600, 3, { suerte: 0.1 }, { es: "+10% de suerte.", en: "+10% luck." }, "trebol"],
  ["crec", { es: "Crecimiento", en: "Growth" }, 900, 5, { crec: 0.03 }, { es: "+3% de experiencia.", en: "+3% experience." }, "corona"],
  ["codicia", { es: "Codicia", en: "Greed" }, 200, 5, { codicia: 0.1 }, { es: "+10% de oro.", en: "+10% gold." }, "mascara"],
  ["maldicion", { es: "Maldición", en: "Curse" }, 1666, 5, { maldicion: 0.1 }, { es: "Enemigos +10% más rápidos, fuertes y numerosos.", en: "+10% enemy speed, health and quantity." }, "calavera"],
  ["revivir", { es: "Revivir", en: "Revival" }, 10000, 1, { revivir: 1 }, { es: "Revivís una vez con media vida.", en: "Revive once with half health." }, "tiramisu"],
  ["rerolls", { es: "Volver a tirar", en: "Reroll" }, 1000, 5, { rerolls: 2 }, { es: "+2 para cambiar las opciones al subir de nivel.", en: "+2 rerolls on level up." }, "_reroll"],
  ["saltos", { es: "Saltear", en: "Skip" }, 100, 5, { saltos: 2 }, { es: "+2 para saltear una subida de nivel.", en: "+2 skips on level up." }, "_salto"],
  ["destierros", { es: "Desterrar", en: "Banish" }, 100, 5, { destierros: 2 }, { es: "+2 para sacar un objeto de la partida.", en: "+2 banishes on level up." }, "_destierro"],
];
function precioMejora(clave) {
  const m = MEJORAS.find((x) => x[0] === clave), ya = G.mejoras[clave] || 0;
  const total = Object.values(G.mejoras).reduce((s, v) => s + v, 0);
  return Math.floor(m[2] * (1 + ya) + (total > 0 ? Math.floor(20 * Math.pow(1.1, total)) : 0));
}

// ── personajes: un arma inicial cada uno, sus números y su bonus que crece con el nivel ──
const PERSONAJES = {
  antonia: { n: "Antonia", ap: "Belnotte", arma: "latigo", st: { vidaMax: 20, armadura: 1 }, bonus: { es: "+10% de daño cada 10 niveles (hasta +50%).", en: "+10% Might every 10 levels (max +50%)." }, crece: (l) => ({ poder: Math.min(0.5, Math.floor(l / 10) * 0.1) }), pal: ["#6a1a1a", "#c83030", "#3a2418", "#f0c8a0"], pelo: "#5a3018", costo: 0 },
  isolda: { n: "Isolda", ap: "Velaverde", arma: "varita", st: {}, bonus: { es: "+10% de experiencia cada 5 niveles (hasta +30%).", en: "+10% Growth every 5 levels (max +30%)." }, crece: (l) => ({ crec: Math.min(0.3, Math.floor(l / 5) * 0.1) }), pal: ["#1a2a6a", "#3a5ad0", "#241a3a", "#f4d4b8"], pelo: "#e8e0d0", costo: 10 },
  pascuala: { n: "Pascuala", ap: "Rinaldi", arma: "runa", st: { vel: 0.1 }, bonus: { es: "Proyectiles +10% más rápidos cada 5 niveles (hasta +30%).", en: "+10% projectile speed every 5 levels (max +30%)." }, crece: (l) => ({ vel: Math.min(0.3, Math.floor(l / 5) * 0.1) }), pal: ["#5a1a5a", "#b048b0", "#2a1a2a", "#f4d0c0"], pelo: "#f0b030", costo: 100 },
  gaspar: { n: "Gaspar", ap: "Fornari", arma: "cuchillo", st: { vidaMax: 20, cant: 1 }, bonus: { es: "Empieza con un proyectil más.", en: "Starts with +1 Amount." }, crece: () => ({}), pal: ["#2a3a1a", "#5a7a2a", "#3a2a1a", "#d8a880"], pelo: "#1a1410", costo: 500 },
  arcadio: { n: "Arcadio", ap: "Ladonna", arma: "fuego", st: { poder: 0.1 }, bonus: { es: "Recarga −5% cada 10 niveles (hasta −15%).", en: "-5% Cooldown every 10 levels (max -15%)." }, crece: (l) => ({ cd: -Math.min(0.15, Math.floor(l / 10) * 0.05) }), pal: ["#6a3a0a", "#d07a18", "#3a1a0a", "#e8b890"], pelo: "#b02010", costo: 500 },
  perla: { n: "Perla", ap: "Fulmini", arma: "rayo", st: { area: 0.3 }, bonus: { es: "Empieza con −90% de recarga, que se va en el primer minuto.", en: "Starts with -90% Cooldown that fades in the first minute." }, crece: () => ({}), temp: { cd: -0.9 }, pal: ["#1a4a5a", "#30a0c0", "#1a2a3a", "#f4dcc8"], pelo: "#f8f0a0", costo: 500 },
  lamia: { n: "Lamia", ap: "Ferrante", arma: "hacha", st: { vidaMax: 10, poder: 0.1, velMov: 0.1, maldicion: 0.1 }, bonus: { es: "+5% de daño, movimiento y maldición cada 10 niveles.", en: "+5% Might, Move Speed and Curse every 10 levels." }, crece: (l) => { const k = Math.min(0.2, Math.floor(l / 10) * 0.05); return { poder: k, velMov: k, maldicion: k }; }, pal: ["#3a3a3a", "#7a7a88", "#1a1a22", "#e0c0a8"], pelo: "#c8c8d8", costo: 500 },
  poli: { n: "Polidoro", ap: "Ajenjo", arma: "ajo", st: { vidaMax: -30, imanMult: 0.25 }, bonus: { es: "+25% de imán. Poca vida.", en: "+25% Magnet, low health." }, crece: () => ({}), pal: ["#4a4a2a", "#9a9a5a", "#2a2a1a", "#d8c0a0"], pelo: "#f0f0f0", costo: 500 },
  clementina: { n: "Clementina", ap: "Santori", arma: "agua", st: { vidaMax: 50, recup: 0.5 }, bonus: { es: "Empieza con +400% de área, que se va en el primer minuto.", en: "Starts with +400% Area that fades in the first minute." }, crece: () => ({}), temp: { area: 4 }, pal: ["#e8e8f0", "#ffffff", "#3a3a5a", "#f4dcc8"], pelo: "#7a4a2a", costo: 500 },
  domingo: { n: "Domingo", ap: "Salmi", arma: "libro", st: { dur: 0.4, vel: 0.4, velMov: -0.4 }, bonus: { es: "+40% de duración y velocidad; camina lento.", en: "+40% Duration and Speed, -40% Move Speed." }, crece: () => ({}), pal: ["#3a1a0a", "#6a3a1a", "#1a0a0a", "#e0b898"], pelo: "#3a2a1a", costo: 500 },
  kiro: { n: "Kiro", ap: "Tsukimi", arma: "cruz", st: { velMov: 0.3, revivir: 1 }, bonus: { es: "Rápida y revive una vez.", en: "+30% Move Speed and 1 Revival." }, crece: () => ({}), pal: ["#0a3a2a", "#20a070", "#0a1a14", "#f4dcc8"], pelo: "#20202a", costo: 500 },
};
function precioPersonaje(k) { const comprados = Object.keys(G.personajes).length - 1; return Math.floor(PERSONAJES[k].costo * Math.pow(1.1, Math.max(0, comprados))); }

// ── enemigos: vida, daño, velocidad (wiki), empuje recibido, xp, radio de choque ──
const ENEMIGOS = {
  murcielago: { vida: 5, dano: 5, vel: 140, emp: 1, xp: 1, r: 5, spr: "murcielago", vuela: 1 },
  murcielagoChico: { vida: 1, dano: 5, vel: 140, emp: 1, xp: 1, r: 4, spr: "murcielago", esc: 0.8, vuela: 1 },
  enjambre: { vida: 1, dano: 1, vel: 700, emp: 1, xp: 1, r: 4, spr: "murcielago", tinte: "#9060c0", vuela: 1, recto: 1 },
  zombi: { vida: 10, dano: 10, vel: 100, emp: 0.8, xp: 1, r: 6, spr: "zombi" },
  esqueleto: { vida: 15, dano: 10, vel: 100, emp: 1, xp: 2, r: 6, spr: "esqueleto" },
  fantasma: { vida: 10, dano: 5, vel: 200, emp: 0, xp: 1.5, r: 6, spr: "fantasma", vuela: 1 },
  fantasmaEnj: { vida: 10, dano: 5, vel: 700, emp: 0, xp: 1.5, r: 6, spr: "fantasma", vuela: 1, recto: 1 },
  barroGris: { vida: 70, dano: 10, vel: 100, emp: 0.3, xp: 2.5, r: 7, spr: "barro", tinte: "#8a8a8a" },
  barroVerde: { vida: 150, dano: 10, vel: 100, emp: 0.3, xp: 2.5, r: 7, spr: "barro" },
  lobizon: { vida: 180, dano: 14, vel: 130, emp: 0.8, xp: 2, r: 7, spr: "lobizon" },
  mantis: { vida: 500, dano: 20, vel: 80, emp: 0, xp: 3, r: 9, spr: "mantis" },
  murcielagoGig: { vida: 270, dano: 10, vel: 140, emp: 0.1, xp: 2.5, r: 9, spr: "murcielago", esc: 2, vuela: 1 },
  momia: { vida: 500, dano: 20, vel: 80, emp: 0, xp: 3, r: 8, spr: "momia" },
  flor: { vida: 30, dano: 1, vel: 20, emp: 1, xp: 2, r: 6, spr: "flor" },
  venus: { vida: 500, dano: 20, vel: 80, emp: 0, xp: 3, r: 9, spr: "flor", esc: 1.6, tinte: "#d03080" },
  // los jefes: sueltan cofre; "xnivel" = la vida se multiplica por tu nivel al aparecer
  brillante: { vida: 50, dano: 10, vel: 140, emp: 1, xp: 30, r: 8, spr: "murcielago", esc: 1.6, tinte: "#ffe060", jefe: 1 },
  plateado: { vida: 50, dano: 10, vel: 140, emp: 1, xp: 30, r: 8, spr: "murcielago", esc: 1.6, tinte: "#e0e8ff", jefe: 1 },
  mantisJefe: { vida: 150, xnivel: 1, dano: 20, vel: 160, emp: 0, xp: 50, r: 13, spr: "mantis", esc: 1.5, tinte: "#ff5040", jefe: 1 },
  murcielagoJefe: { vida: 500, dano: 20, vel: 140, emp: 0, xp: 25, r: 13, spr: "murcielago", esc: 3, tinte: "#ff4040", jefe: 1, vuela: 1 },
  lobizonJefe: { vida: 200, xnivel: 1, dano: 20, vel: 130, emp: 0.1, xp: 2, r: 12, spr: "lobizon", esc: 1.7, tinte: "#6080ff", jefe: 1 },
  momiaJefe: { vida: 250, xnivel: 1, dano: 20, vel: 80, emp: 0, xp: 25, r: 12, spr: "momia", esc: 1.6, tinte: "#ffd080", jefe: 1 },
  venusJefe: { vida: 150, xnivel: 1, dano: 30, vel: 160, emp: 0, xp: 50, r: 14, spr: "flor", esc: 2.2, tinte: "#4080ff", jefe: 1 },
  parca: { vida: 655350, xnivel: 1, dano: 65535, vel: 1200, emp: -0.5, xp: 0, r: 12, spr: "parca", esc: 1.6, jefe: 1, parca: 1, vuela: 1 },
};
// qué tan probable es cada cofre del jefe (5 / 3 / 1 objetos, antes de la suerte) y si puede evolucionar
const COFRES_JEFE = { brillante: [0, 5, 40], plateado: [3, 10, 50], mantisJefe: [3, 10, 100], murcielagoJefe: [3, 10, 100], lobizonJefe: [3, 10, 100], momiaJefe: [3, 10, 100], venusJefe: [3, 10, 100] };

// ── las oleadas del bosque (wiki, Mad Forest): minuto → enemigos, mínimo en pantalla, intervalo, jefes, evento ──
const OLEADAS_BOSQUE = [
  { e: ["murcielago"], min: 15, int: 1 },
  { e: ["zombi", "murcielagoChico"], min: 30, int: 1, jefes: ["brillante"] },
  { e: ["murcielago", "murcielagoChico", "zombi"], min: 50, int: 0.5, ev: ["enjambre", 1, 2] },
  { e: ["esqueleto"], min: 40, int: 0.25, jefes: ["brillante"], ev: ["enjambre", 0.1, 1] },
  { e: ["esqueleto", "fantasma"], min: 30, int: 1, ev: ["enjambre", 0.1, 1] },
  { e: ["barroVerde"], min: 10, int: 1, jefes: ["mantisJefe"], ev: ["flores", 1, 1] },
  { e: ["zombi", "barroVerde"], min: 20, int: 0.5, ev: ["enjambre", 0.1, 1] },
  { e: ["murcielago", "barroGris"], min: 80, int: 0.5, jefes: ["brillante"], ev: ["enjambre", 0.8, 5] },
  { e: ["zombi"], min: 100, int: 1.5, jefes: ["murcielagoJefe"], ev: ["enjambre", 0.8, 2] },
  { e: ["murcielagoGig", "zombi"], min: 30, int: 0.5, jefes: ["plateado"], ev: ["enjambre", 0.7, 1] },
  { e: ["barroGris", "barroVerde"], min: 10, int: 0.5, jefes: ["mantisJefe"], ev: ["flores", 1, 1] },
  { e: ["esqueleto"], min: 300, int: 0.1, jefes: ["brillante"] },
  { e: ["lobizon", "fantasma", "esqueleto"], min: 20, int: 0.25, jefes: ["brillante"] },
  { e: ["lobizon", "fantasma"], min: 150, int: 0.5, ev: ["fantasmas", 0.7, 2] },
  { e: ["murcielagoGig", "lobizon"], min: 20, int: 0.1, jefes: ["plateado"] },
  { e: ["lobizon", "murcielagoGig", "barroVerde"], min: 100, int: 0.1, jefes: ["lobizonJefe"], ev: ["flores", 0.8, 1] },
  { e: ["mantis", "barroGris", "barroVerde"], min: 100, int: 0.1, jefes: ["brillante"] },
  { e: ["momia"], min: 20, int: 1 },
  { e: ["momia", "barroGris"], min: 60, int: 0.5, jefes: ["plateado"] },
  { e: ["momia", "barroGris"], min: 100, int: 0.5 },
  { e: ["momia", "barroVerde", "murcielagoGig"], min: 100, int: 0.1, jefes: ["momiaJefe"], ev: ["enjambre", 1, 3] },
  { e: ["flor"], min: 300, int: 0.1, jefes: ["venus", "brillante"] },
  { e: ["flor", "momia"], min: 200, int: 0.1, jefes: ["brillante"] },
  { e: ["flor", "momia"], min: 300, int: 0.1, jefes: ["plateado"] },
  { e: ["flor", "momia"], min: 300, int: 0.1, jefes: ["venus"] },
  { e: ["venus"], min: 100, int: 0.1, jefes: ["venusJefe"], ev: ["flores", 1, 2] },
  { e: ["venus", "flor"], min: 150, int: 0.1 },
  { e: ["momia", "barroGris", "barroVerde"], min: 300, int: 0.1, jefes: ["brillante"], ev: ["fantasmas", 1, 3] },
  { e: ["murcielagoGig", "brillante"], min: 300, int: 0.1 },
  { e: ["brillante", "plateado"], min: 300, int: 0.1, jefes: ["brillante"], ev: ["enjambre", 1, 3] },
];
// el cementerio: la misma forma de noche, con otros vecinos y un poco más duros
const CAMBIO_CEMENTERIO = { murcielago: "fantasma", murcielagoChico: "murcielago", zombi: "esqueleto", barroVerde: "momia", barroGris: "zombi", flor: "esqueleto", enjambre: "fantasmaEnj" };
const ESCENARIOS = {
  bosque: { n: { es: "Bosque Maldito", en: "Cursed Forest" }, d: { es: "Donde empieza la noche.", en: "Where the night begins." }, tema: "bosque", oleadas: OLEADAS_BOSQUE, vida: 1, velJug: 1.1, velEne: 1.1, suelo: "pasto" },
  cementerio: { n: { es: "Cementerio Olvidado", en: "Forgotten Graveyard" }, d: { es: "Se abre al aguantar 15 minutos en el bosque.", en: "Unlocks by surviving 15 minutes in the forest." }, tema: "cementerio", oleadas: OLEADAS_BOSQUE.map((o) => ({ ...o, e: o.e.map((k) => CAMBIO_CEMENTERIO[k] || k) })), vida: 1.35, velJug: 1, velEne: 1.15, suelo: "tumbas", abre: ["bosque", 15 * 60] },
};

// ── lo que sueltan los braseros (peso, nivel mínimo) ──
const BOTIN_BRASERO = [["moneda", 50, 0], ["bolsa", 10, 0], ["bolsaRica", 1, 5], ["pollo", 12, 0], ["rosario", 1, 8], ["reloj", 2, 4], ["aspiradora", 2, 12], ["trebolito", 1, 0]];

// ── la experiencia para el próximo nivel: 5, después +10 por nivel hasta 20, +13 hasta 40, +16 después; +600 en el 20 y +2400 en el 40 ──
function xpPara(nivel) {
  let r = 5;
  for (let l = 2; l <= nivel; l++) r += l <= 20 ? 10 : l <= 40 ? 13 : 16;
  return r + (nivel === 20 ? 600 : 0) + (nivel === 40 ? 2400 : 0);
}

// ── textos sueltos ──
const TX = {
  empezar: { es: "EMPEZAR", en: "START" }, mejoras: { es: "MEJORAS", en: "POWER UP" }, opciones: { es: "OPCIONES", en: "OPTIONS" }, coleccion: { es: "COLECCIÓN", en: "COLLECTION" },
  tocar: { es: "TOCÁ PARA EMPEZAR", en: "TAP TO START" }, tocarPC: { es: "PULSÁ UNA TECLA", en: "PRESS ANY KEY" },
  elegirPj: { es: "Elegí a tu cazador", en: "Choose your hunter" }, elegirEsc: { es: "Elegí el escenario", en: "Choose the stage" },
  subiste: { es: "¡Subiste de nivel!", en: "Level Up!" }, nuevo: { es: "¡Nuevo!", en: "New!" }, nivel: { es: "Nivel", en: "Level" },
  reroll: { es: "Otra vez", en: "Reroll" }, saltar: { es: "Saltear", en: "Skip" }, desterrar: { es: "Desterrar", en: "Banish" },
  cofre: { es: "¡Encontraste un tesoro!", en: "Treasure found!" }, abrir: { es: "ABRIR", en: "OPEN" }, listo: { es: "LISTO", en: "DONE" },
  pausa: { es: "PAUSA", en: "PAUSED" }, seguir: { es: "SEGUIR", en: "RESUME" }, salir: { es: "RENDIRSE", en: "QUIT" },
  moriste: { es: "TE MORISTE", en: "GAME OVER" }, sobreviviste: { es: "¡SOBREVIVISTE!", en: "YOU SURVIVED!" },
  revivir: { es: "¡REVIVISTE!", en: "REVIVED!" }, resultados: { es: "Resultados", en: "Results" },
  tiempo: { es: "Tiempo", en: "Survived" }, oroGanado: { es: "Oro ganado", en: "Gold earned" }, nivelAlc: { es: "Nivel", en: "Level reached" }, muertos: { es: "Enemigos vencidos", en: "Enemies defeated" },
  arma: { es: "Arma", en: "Weapon" }, dano: { es: "Daño", en: "Damage" }, tiempoArma: { es: "Tiempo", en: "Time" }, dps: { es: "DPS", en: "DPS" },
  comprar: { es: "COMPRAR", en: "BUY" }, devolver: { es: "DEVOLVER", en: "REFUND" }, volver: { es: "VOLVER", en: "BACK" }, max: { es: "MÁX", en: "MAX" },
  musica: { es: "Música", en: "Music" }, efectos: { es: "Efectos", en: "Sounds" }, numeros: { es: "Números de daño", en: "Damage numbers" }, destellos: { es: "Destellos", en: "Flashing" },
  idioma: { es: "Idioma", en: "Language" }, duracion: { es: "Duración", en: "Run length" }, completa: { es: "Pantalla completa", en: "Fullscreen" },
  si: { es: "SÍ", en: "ON" }, no: { es: "NO", en: "OFF" }, bloqueado: { es: "BLOQUEADO", en: "LOCKED" }, oro: { es: "Oro", en: "Gold" },
  armas: { es: "Armas", en: "Weapons" }, pasivos: { es: "Pasivos", en: "Passives" }, stats: { es: "Estadísticas", en: "Stats" },
  evolucion: { es: "¡EVOLUCIÓN!", en: "EVOLUTION!" }, evoluciones: { es: "Evoluciones", en: "Evolutions" },
  parca: { es: "LLEGÓ LA PARCA", en: "THE REAPER HAS COME" }, jugar: { es: "¡A JUGAR!", en: "GO!" }, sinDinero: { es: "No te alcanza el oro", en: "Not enough gold" },
  oroPollo: { es: "Oro", en: "Gold" }, polloOp: { es: "Pollo", en: "Chicken" }, curarOp: { es: "Cura 30 de vida.", en: "Heals 30 HP." }, oroOp: { es: "Ganás 25 de oro.", en: "Gain 25 gold." },
  record: { es: "Récord", en: "Best" }, creditos: { es: "Un homenaje hecho a mano. Arte, música y código propios.", en: "A handmade homage. Original art, music and code." },
};
// los nombres de las estadísticas en la pausa
const NOMBRE_ST = {
  vidaMax: { es: "Vida máx.", en: "Max Health" }, recup: { es: "Recuperación", en: "Recovery" }, armadura: { es: "Armadura", en: "Armor" }, velMov: { es: "Movimiento", en: "Move Speed" },
  poder: { es: "Poder", en: "Might" }, area: { es: "Área", en: "Area" }, vel: { es: "Velocidad", en: "Speed" }, dur: { es: "Duración", en: "Duration" }, cant: { es: "Cantidad", en: "Amount" },
  cd: { es: "Recarga", en: "Cooldown" }, suerte: { es: "Suerte", en: "Luck" }, crec: { es: "Crecimiento", en: "Growth" }, codicia: { es: "Codicia", en: "Greed" }, maldicion: { es: "Maldición", en: "Curse" },
  iman: { es: "Imán", en: "Magnet" }, revivir: { es: "Revivir", en: "Revival" },
};
