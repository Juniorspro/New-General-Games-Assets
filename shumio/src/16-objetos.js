// ─────────────────────────────────────────────────────────────────────────────
// LOS OBJETOS: más de cien, cada uno con su efecto real, pensados como los del original: cada
// uno DECLARA lo que suma (st), las banderas que trae (f) y sus etiquetas (tags) para las
// transformaciones; recalcular() (12-jugador) los combina solos. Así un rayo con tercer ojo son
// tres rayos, el jarabe con el feto hace bombas que explotan al tocar, el planetita con el
// cuchillo… Repartidos en las tandas del original (tesoro, jefe, tienda, pacto, secreta,
// cofre dorado, cofre rojo), sin repetirse, y los de calidad alta salen menos.
// ─────────────────────────────────────────────────────────────────────────────

const T_ = { tesoro: "tesoro", jefe: "jefe", tienda: "tienda", pacto: "pacto", secreta: "secreta", cofre: "cofre", rojo: "rojo" };
const OBJETOS = {
  // ── las cuentas ──
  sombreroRojo: { nombre: "SOMBRERO ROJO", lema: "DAÑO ARRIBA", calidad: 2, pools: ["tesoro", "jefe"], tags: ["hongo"], st: { dano: 1 } },
  setaPicante: { nombre: "SETA PICANTE", lema: "DAÑO ARRIBA", calidad: 1, pools: ["tesoro", "jefe"], tags: ["hongo"], st: { dano: 0.5, plano: 0.5 } },
  cafeRaiz: { nombre: "CAFÉ DE RAÍZ", lema: "LÁGRIMAS ARRIBA", calidad: 2, pools: ["tesoro", "jefe"], st: { lag: 0.7 } },
  cebolla: { nombre: "CEBOLLA TRISTE", lema: "LÁGRIMAS ARRIBA", calidad: 2, pools: ["tesoro"], st: { lag: 0.7 } },
  zapatillas: { nombre: "ZAPATILLAS", lema: "VELOCIDAD ARRIBA", calidad: 1, pools: ["tesoro", "jefe", "tienda"], st: { vel: 0.3 } },
  lupa: { nombre: "LUPA", lema: "LÁGRIMAS GRANDES", calidad: 1, pools: ["tesoro", "jefe"], st: { tam: 1.3, plano: 0.6 } },
  trebol: { nombre: "TRÉBOL", lema: "SUERTE ARRIBA", calidad: 1, pools: ["tesoro", "jefe", "tienda"], st: { suerte: 2 } },
  corazonPiedra: { nombre: "CORAZÓN DE PIEDRA", lema: "VIDA ARRIBA", calidad: 1, pools: ["tesoro", "jefe"], alTomar: (j) => { sumarContenedor(j, 1); curar(j, 2); } },
  raizVieja: { nombre: "RAÍZ VIEJA", lema: "VIDA ARRIBA", calidad: 1, pools: ["tesoro", "jefe"], alTomar: (j) => { sumarContenedor(j, 1); j.vida = j.cont; } },
  ojoVidrio: { nombre: "OJO DE VIDRIO", lema: "ALCANCE ARRIBA", calidad: 1, pools: ["tesoro", "jefe"], st: { alc: 1.5, velLag: 0.2 } },
  plomo: { nombre: "LÁGRIMA DE PLOMO", lema: "PESADA Y DOLOROSA", calidad: 2, pools: ["tesoro", "jefe"], st: { plano: 1.6, lag: -0.35, velLag: -0.15, tam: 1.15 } },
  lenteSangre: { nombre: "LENTE DE SANGRE", lema: "DAÑO Y ALCANCE", calidad: 2, pools: ["tesoro", "jefe", "pacto"], st: { dano: 1, alc: 1 }, f: ["sangre"] },
  caparazon: { nombre: "CAPARAZÓN", lema: "TODO UN POCO ARRIBA", calidad: 2, pools: ["tesoro", "jefe"], st: { dano: 0.3, lag: 0.2, vel: 0.1, alc: 0.5, suerte: 1, velLag: 0.1 } },
  mediaLuna: { nombre: "MEDIA LUNA", lema: "LÁGRIMAS Y SUERTE", calidad: 2, pools: ["tesoro", "jefe"], st: { lag: 0.5, suerte: 1 } },
  hongoGigante: { nombre: "HONGO GIGANTE", lema: "¡TODO ARRIBA!", calidad: 4, pools: ["tesoro", "secreta"], tags: ["hongo"], st: { dano: 0.3, alc: 2.5, vel: 0.3 }, f: ["x15"], alTomar: (j) => { sumarContenedor(j, 1); j.vida = j.cont; } },
  hongoAzul: { nombre: "HONGO AZUL", lema: "VIDA Y LÁGRIMAS", calidad: 2, pools: ["tesoro", "secreta"], tags: ["hongo"], st: { lag: 0.5, velLag: -0.16 }, alTomar: (j) => { sumarContenedor(j, 1); curar(j, 2); } },
  hongoChico: { nombre: "HONGUITO", lema: "CHIQUITO Y VELOZ", calidad: 1, pools: ["tesoro", "secreta"], tags: ["hongo"], st: { vel: 0.3, alc: -0.5, tam: 0.85 } },
  hongoRaro: { nombre: "HONGO RARO", lema: "LÁGRIMAS ARRIBA, DAÑO ABAJO", calidad: 1, pools: ["tesoro", "secreta"], tags: ["hongo"], st: { mult: 0.9, lag: 0.8, vel: 0.2 } },
  unaVidaMas: { nombre: "HONGO DE LA VIDA", lema: "UNA VIDA MÁS", calidad: 3, pools: ["tesoro", "secreta"], tags: ["hongo"], alTomar: (j) => { j.vidasExtra++; } },
  hormonas: { nombre: "HORMONAS", lema: "DAÑO Y VELOCIDAD", calidad: 2, pools: ["tesoro", "jefe"], tags: ["jeringa"], st: { dano: 1, vel: 0.2 } },
  bolaVeloz: { nombre: "BOLA VELOZ", lema: "VELOCIDAD ARRIBA", calidad: 1, pools: ["tesoro", "jefe"], tags: ["jeringa"], st: { vel: 0.3, velLag: 0.2 } },
  cabezaGrillo: { nombre: "CABEZA DE GRILLO", lema: "DAÑO POR UNO Y MEDIO", calidad: 4, pools: ["tesoro"], st: { dano: 0.5 }, f: ["x15"] },
  pactoSangre: { nombre: "PACTO DE SANGRE", lema: "DAÑO POR UNO Y MEDIO", calidad: 4, pools: ["pacto"], tags: ["demonio"], st: { mult: 1.5 }, f: ["sangre"] },
  cuerno: { nombre: "CUERNO", lema: "DAÑO MUCHO ARRIBA", calidad: 3, pools: ["pacto"], tags: ["demonio"], st: { dano: 2 } },
  pentagrama: { nombre: "PENTAGRAMA", lema: "DAÑO ARRIBA", calidad: 3, pools: ["pacto", "rojo"], tags: ["demonio"], st: { dano: 1 }, f: ["pentagrama"] },
  marca: { nombre: "LA MARCA", lema: "DAÑO Y VELOCIDAD", calidad: 2, pools: ["pacto", "rojo"], tags: ["demonio"], st: { dano: 1, vel: 0.2 }, alTomar: (j) => darNegras(j, 2) },
  elPacto: { nombre: "EL PACTO", lema: "DAÑO Y LÁGRIMAS", calidad: 3, pools: ["pacto", "rojo"], tags: ["demonio"], st: { dano: 0.5, lag: 0.7 }, alTomar: (j) => darNegras(j, 4) },
  sangreMartir: { nombre: "SANGRE DEL MÁRTIR", lema: "DAÑO ARRIBA", calidad: 2, pools: ["tesoro", "jefe"], st: { dano: 1 } },
  aureola: { nombre: "LA AUREOLA", lema: "TODO ARRIBA", calidad: 3, pools: ["tesoro", "secreta"], tags: ["angel"], st: { dano: 0.3, lag: 0.2, vel: 0.3, alc: 0.25 }, alTomar: (j) => { sumarContenedor(j, 1); curar(j, 2); } },
  rosario: { nombre: "ROSARIO", lema: "FE Y LÁGRIMAS", calidad: 2, pools: ["tesoro", "tienda"], tags: ["angel"], st: { lag: 0.5 }, alTomar: (j) => darEsporas(j, 6) },
  corazonSagrado: { nombre: "CORAZÓN SAGRADO", lema: "LÁGRIMAS BENDITAS QUE BUSCAN", calidad: 4, pools: ["secreta", "cofre"], tags: ["angel"], st: { plano: 1, lag: -0.4, velLag: -0.25 }, f: ["x23", "buscadora"], alTomar: (j) => { sumarContenedor(j, 1); j.vida = j.cont; } },
  // ── las armas (la de más prioridad manda) ──
  rayo: { nombre: "LLANTO DE AZUFRE", lema: "¡RAYO DE SANGRE!", calidad: 4, pools: ["pacto"], tags: ["demonio"], f: ["rayo"] },
  laser: { nombre: "OJO MECÁNICO", lema: "LÁGRIMAS LÁSER", calidad: 3, pools: ["tesoro", "tienda"], f: ["laser"] },
  anillo: { nombre: "ARO DE LUZ", lema: "ANILLOS LÁSER QUE SE CARGAN", calidad: 3, pools: ["tesoro"], f: ["anillo"] },
  feto: { nombre: "EMBRIÓN DE PÓLVORA", lema: "¡LLORÁS BOMBAS!", calidad: 3, pools: ["tesoro", "pacto"], f: ["feto"] },
  epico: { nombre: "FETO DEL CIELO", lema: "BOMBARDEO A DEMANDA", calidad: 4, pools: ["secreta"], f: ["epico"] },
  ludovico: { nombre: "LÁGRIMA MANSA", lema: "UNA LÁGRIMA QUE OBEDECE", calidad: 2, pools: ["tesoro"], f: ["ludovico"] },
  cuchillo: { nombre: "CUCHILLO DE LA ABUELA", lema: "FILOSO Y FIEL", calidad: 4, pools: ["pacto"], tags: ["madre"], f: ["cuchillo"] },
  // ── lo que cambia las lágrimas ──
  tercerOjo: { nombre: "TERCER OJO", lema: "TRES LÁGRIMAS", calidad: 2, pools: ["tesoro"], f: ["triple"] },
  cuadruple: { nombre: "ARAÑA MUTANTE", lema: "CUATRO LÁGRIMAS", calidad: 3, pools: ["tesoro"], tags: ["arana"], f: ["cuadruple"] },
  veinte: { nombre: "LENTES BIFOCALES", lema: "LLANTO DOBLE", calidad: 3, pools: ["tesoro"], f: ["veinte"] },
  polifemo: { nombre: "OJO DE CÍCLOPE", lema: "UNA LÁGRIMA ENORME", calidad: 3, pools: ["tesoro"], f: ["polifemo"] },
  soja: { nombre: "LECHE DE SOJA", lema: "LLANTO SIN FIN", calidad: 2, pools: ["tesoro"], f: ["soja"] },
  almendra: { nombre: "LECHE DE ALMENDRA", lema: "LLANTO SIN FIN, CON GUSANOS", calidad: 2, pools: ["tesoro", "secreta"], f: ["almendra"] },
  choco: { nombre: "LECHE CHOCOLATADA", lema: "LÁGRIMAS QUE SE CARGAN", calidad: 3, pools: ["tesoro"], f: ["choco"] },
  pulmon: { nombre: "PULMÓN DE BABOSA", lema: "RÁFAGA CARGADA", calidad: 2, pools: ["tesoro"], f: ["pulmon"] },
  ipecac: { nombre: "JARABE AMARGO", lema: "LÁGRIMAS QUE EXPLOTAN", calidad: 2, pools: ["tesoro"], tags: ["podrido"], f: ["ipecac"] },
  hemo: { nombre: "COÁGULO", lema: "REVIENTA EN PEDAZOS", calidad: 3, pools: ["tesoro", "pacto"], f: ["hemo"] },
  proptosis: { nombre: "OJOS SALTONES", lema: "DE CERCA DUELE MÁS", calidad: 3, pools: ["tesoro"], st: { plano: 0.5 }, f: ["proptosis"] },
  carbon: { nombre: "TROZO DE CARBÓN", lema: "DE LEJOS DUELE MÁS", calidad: 2, pools: ["tesoro", "secreta"], f: ["carbon"] },
  ojoMuerto: { nombre: "OJO MUERTO", lema: "CADA ACIERTO SUMA", calidad: 2, pools: ["tesoro"], f: ["ojoMuerto"] },
  ojoCazador: { nombre: "OJO CAZADOR", lema: "LÁGRIMAS QUE BUSCAN", calidad: 3, pools: ["tesoro", "pacto"], f: ["buscadora"] },
  velo: { nombre: "VELO", lema: "LÁGRIMAS FANTASMA", calidad: 2, pools: ["tesoro", "secreta"], f: ["espectral"] },
  aguja: { nombre: "FLECHA DE AMOR", lema: "ATRAVIESA TODO", calidad: 3, pools: ["tesoro", "secreta"], f: ["atraviesa"] },
  gomaElastica: { nombre: "GOMA ELÁSTICA", lema: "LÁGRIMAS QUE REBOTAN", calidad: 2, pools: ["tesoro"], st: { alc: 0.5 }, f: ["rebote"] },
  planeta: { nombre: "PLANETITA", lema: "LÁGRIMAS EN ÓRBITA", calidad: 1, pools: ["tesoro"], st: { alc: 6.5 }, f: ["orbita"] },
  espejo: { nombre: "MI REFLEJO", lema: "LÁGRIMAS QUE VUELVEN", calidad: 2, pools: ["tesoro"], st: { alc: 0.75, alcMult: 2, plano: 1.5, suerte: -1, velLagMult: 1.6 }, f: ["boomerang"] },
  bucle: { nombre: "BUCLE", lema: "LÁGRIMAS QUE DAN LA VUELTA", calidad: 2, pools: ["tesoro", "secreta"], st: { alc: 3 }, f: ["continuo"] },
  antigrav: { nombre: "ANTIGRAVEDAD", lema: "LÁGRIMAS QUE ESPERAN", calidad: 2, pools: ["tesoro"], st: { fr: 1 }, f: ["antigrav"] },
  grillo: { nombre: "CUERPO DE GRILLO", lema: "LÁGRIMAS QUE SE PARTEN", calidad: 3, pools: ["tesoro"], st: { fr: 0.5, tam: 1.1 }, f: ["grillo"] },
  parasito: { nombre: "PARÁSITO", lema: "LÁGRIMAS QUE SE DIVIDEN", calidad: 2, pools: ["tesoro"], f: ["parasito"] },
  fractura: { nombre: "FRACTURA EXPUESTA", lema: "LÁGRIMAS DE HUESO", calidad: 2, pools: ["tesoro"], st: { alc: 1.5 }, f: ["fractura"] },
  pegajosa: { nombre: "ESPORA PEGAJOSA", lema: "SE PEGA Y EXPLOTA", calidad: 2, pools: ["tesoro"], f: ["pegajosa"] },
  raizElectrica: { nombre: "RAÍZ ELÉCTRICA", lema: "LÁGRIMAS CON CHISPA", calidad: 3, pools: ["tesoro"], f: ["jacob"] },
  luzSanta: { nombre: "LUZ SANTA", lema: "RAYOS DEL CIELO", calidad: 3, pools: ["tesoro", "secreta"], tags: ["angel"], f: ["santa"] },
  amorDuro: { nombre: "AMOR DURO", lema: "LÁGRIMAS CON DIENTES", calidad: 3, pools: ["tesoro"], f: ["diente"] },
  eutanasia: { nombre: "EUTANASIA", lema: "AGUJAS MORTALES", calidad: 3, pools: ["pacto", "tesoro"], tags: ["jeringa"], f: ["aguja"] },
  esporasToxicas: { nombre: "ESPORAS TÓXICAS", lema: "LÁGRIMAS VENENOSAS", calidad: 2, pools: ["tesoro"], f: ["veneno"] },
  picadura: { nombre: "PICADURA DE ARAÑA", lema: "LÁGRIMAS QUE FRENAN", calidad: 1, pools: ["tesoro"], tags: ["arana"], f: ["lento"] },
  escarcha: { nombre: "ESCARCHA", lema: "LÁGRIMAS DE HIELO", calidad: 3, pools: ["tesoro", "secreta"], f: ["urano", "piedra"] },
  chispa: { nombre: "CHISPA", lema: "LÁGRIMAS QUE QUEMAN", calidad: 2, pools: ["tesoro"], f: ["fuego", "estalla"] },
  materiaOscura: { nombre: "MATERIA OSCURA", lema: "DAÑO Y MIEDO", calidad: 2, pools: ["pacto", "tesoro"], st: { dano: 1 }, f: ["miedo"] },
  lentesAbuela: { nombre: "LENTES DE LA ABUELA", lema: "MIRADA DE PIEDRA", calidad: 1, pools: ["tesoro"], tags: ["madre"], st: { alc: 1.5 }, f: ["piedra"] },
  perfumeAbuela: { nombre: "PERFUME DE LA ABUELA", lema: "LÁGRIMAS Y MIEDO", calidad: 1, pools: ["tesoro"], tags: ["madre"], st: { lag: 0.5 }, f: ["miedo", "perfume"] },
  labialAbuela: { nombre: "LABIAL DE LA ABUELA", lema: "ALCANCE Y AMOR", calidad: 1, pools: ["tesoro"], tags: ["madre"], st: { alc: 2 }, alTomar: (j) => soltarPremio(j.x, j.y + 12, "corazon") },
  tacosAbuela: { nombre: "TACOS DE LA ABUELA", lema: "PISOTONES", calidad: 1, pools: ["tesoro"], tags: ["madre"], f: ["tacos"] },
  liquido: { nombre: "LÍQUIDO MISTERIOSO", lema: "LÁGRIMAS QUE DEJAN BABA", calidad: 2, pools: ["tesoro"], f: ["liquido"] },
  cabezaTendero: { nombre: "CABEZA DEL TENDERO", lema: "LÁGRIMAS DE PLATA", calidad: 1, pools: ["tienda", "tesoro"], f: ["tendero"] },
  atractor: { nombre: "ATRACTOR EXTRAÑO", lema: "TODO VA A TUS LÁGRIMAS", calidad: 1, pools: ["tesoro"], f: ["atractor"] },
  piscis: { nombre: "PISCIS", lema: "LÁGRIMAS QUE EMPUJAN", calidad: 1, pools: ["tesoro"], st: { fr: 0.5, tam: 1.12 }, f: ["piscis"] },
  ojoBelial: { nombre: "OJO DE BELIAL", lema: "ATRAVIESA Y SE ENOJA", calidad: 3, pools: ["pacto", "tesoro"], st: { alc: 1.5 }, f: ["belial"] },
  cabezaDivina: { nombre: "CABEZA DIVINA", lema: "LÁGRIMAS DIVINAS", calidad: 4, pools: ["secreta", "cofre"], st: { plano: 0.5, lag: -0.3, velLag: -0.3 }, f: ["divino"] },
  virus: { nombre: "EL VIRUS", lema: "TOCAR ES ENVENENAR", calidad: 2, pools: ["pacto", "tesoro"], tags: ["jeringa"], st: { vel: 0.2 }, f: ["virus"] },
  // ── vuelo, bombas, llaves ──
  alasPolilla: { nombre: "ALAS DE POLILLA", lema: "¡A VOLAR!", calidad: 3, pools: ["tesoro", "pacto"], st: { vel: 0.1 }, f: ["vuela"] },
  palomaMuerta: { nombre: "PALOMA MUERTA", lema: "VUELO Y LÁGRIMAS FANTASMA", calidad: 3, pools: ["secreta", "cofre"], tags: ["angel"], f: ["vuela", "espectral"] },
  espirituNoche: { nombre: "ESPÍRITU NOCTURNO", lema: "VUELO Y LÁGRIMAS FANTASMA", calidad: 3, pools: ["pacto"], tags: ["demonio"], f: ["vuela", "espectral"] },
  iman: { nombre: "IMÁN", lema: "TODO VIENE A VOS", calidad: 1, pools: ["tesoro", "tienda"], f: ["iman"] },
  brujula: { nombre: "BRÚJULA", lema: "EL MAPA SE REVELA", calidad: 1, pools: ["tesoro", "tienda"], alTomar: (j) => { j.mapa = true; revelarMapa(); } },
  casco: { nombre: "CASCO DE ESPORAS", lema: "DOS CORAZONES DE ESPORA", calidad: 1, pools: ["tesoro", "jefe", "tienda"], alTomar: (j) => darEsporas(j, 4) },
  bombaGorda: { nombre: "BOMBA GORDA", lema: "CINCO BOMBAS GRANDES", calidad: 2, pools: ["tesoro", "tienda"], f: ["bombaGorda"], alTomar: (j) => { j.bombas = Math.min(99, j.bombas + 5); } },
  maldicionPodrida: { nombre: "MALDICIÓN PODRIDA", lema: "BOMBAS VENENOSAS", calidad: 2, pools: ["tesoro"], tags: ["podrido"], f: ["bombaPodrida"], alTomar: (j) => { j.bombas = Math.min(99, j.bombas + 5); } },
  bolsaMonedas: { nombre: "BOLSA DE MONEDAS", lema: "VEINTICINCO MONEDAS", calidad: 1, pools: ["tesoro", "secreta"], alTomar: (j) => { j.monedas = Math.min(99, j.monedas + 25); } },
  llavero: { nombre: "LLAVERO", lema: "CUATRO LLAVES", calidad: 1, pools: ["tesoro", "tienda"], alTomar: (j) => { j.llaves = Math.min(99, j.llaves + 4); } },
  colaGato: { nombre: "COLA DE GATO", lema: "MÁS COFRES", calidad: 2, pools: ["tesoro", "pacto"], tags: ["gato"], f: ["colaGato"] },
  gatoMuerto: { nombre: "GATO MUERTO", lema: "NUEVE VIDAS", calidad: 3, pools: ["pacto", "secreta"], tags: ["gato"], alTomar: (j) => { j.vidasExtra += 9; j.cont = 2; j.vida = 2; } },
  pajaroMuerto: { nombre: "PÁJARO MUERTO", lema: "VENGANZA ALADA", calidad: 1, pools: ["tesoro"], f: ["pajaro"] },
  bebeArana: { nombre: "BEBÉ ARAÑA", lema: "LA VENGANZA DE LAS ARAÑAS", calidad: 2, pools: ["tesoro"], tags: ["arana"], f: ["aranaHerido"] },
  // ── los familiares ──
  moscaAmiga: { nombre: "MOSCA AMIGA", lema: "TE CUIDA LAS ESPALDAS", calidad: 2, pools: ["tesoro", "tienda"], tags: ["mosca"], fam: "mosca" },
  admiradora: { nombre: "ADMIRADORA", lema: "UNA MOSCA QUE MUERDE", calidad: 2, pools: ["tesoro"], tags: ["mosca"], fam: "admiradora" },
  coronaMoscas: { nombre: "CORONA DE MOSCAS", lema: "ESCUDO ZUMBADOR", calidad: 2, pools: ["tesoro"], tags: ["mosca"], fam: "corona" },
  angelGuardian: { nombre: "ÁNGEL GUARDIÁN", lema: "TE PROTEGE", calidad: 3, pools: ["tesoro", "secreta"], tags: ["angel"], fam: "angel" },
  bolaPelos: { nombre: "BOLA DE PELOS", lema: "GIRA Y PEGA", calidad: 2, pools: ["tesoro"], tags: ["gato"], fam: "pelos" },
  hermanito: { nombre: "HERMANITO", lema: "UN AMIGUITO QUE LLORA", calidad: 2, pools: ["tesoro"], tags: ["bebe"], fam: "hermanito" },
  hermanita: { nombre: "HERMANITA", lema: "LLORA MÁS FUERTE", calidad: 2, pools: ["tesoro"], tags: ["bebe"], fam: "hermanita" },
  bebeDemonio: { nombre: "BEBÉ DEMONIO", lema: "DISPARA SOLO", calidad: 2, pools: ["pacto", "tesoro"], tags: ["bebe"], fam: "demonio" },
  roboBebe: { nombre: "ROBO-BEBÉ", lema: "UN AMIGUITO CON LÁSER", calidad: 2, pools: ["tesoro"], tags: ["bebe"], fam: "robo" },
  incubo: { nombre: "ÍNCUBO", lema: "COPIA TUS LÁGRIMAS", calidad: 4, pools: ["pacto"], tags: ["bebe"], fam: "incubo" },
  gordito: { nombre: "GORDITO", lema: "SE LANZA DE PANZA", calidad: 2, pools: ["tesoro"], tags: ["bebe"], fam: "gordito" },
  cerebroPodrido: { nombre: "CEREBRO PODRIDO", lema: "IDEAS EXPLOSIVAS", calidad: 1, pools: ["tesoro"], tags: ["podrido"], fam: "cerebro" },
  sanguijuela: { nombre: "SANGUIJUELA", lema: "CHUPA Y CURA", calidad: 2, pools: ["tesoro", "pacto"], fam: "sanguijuela" },
  bolsaCentavos: { nombre: "BOLSA DE CENTAVOS", lema: "MONEDAS DE REGALO", calidad: 1, pools: ["tesoro", "tienda"], fam: "bolsa" },
  // ── los activos: se cargan limpiando salas ──
  libroSetas: { nombre: "LIBRO DE SETAS", lema: "PODER PARA LA SALA", calidad: 2, pools: ["tesoro", "pacto"], tags: ["demonio", "libro"], activo: 3, usar: (j) => { j.danoSala += 2; if (j.objetos.includes("sangreMartir")) j.salaF.push("x15"); SFX.pacto(); J.destello = 4; } },
  dadoViejo: { nombre: "DADO VIEJO", lema: "REHACE EL DESTINO", calidad: 3, pools: ["tesoro", "tienda"], activo: 6, usar: () => rehacerPedestales() },
  frascoMosquines: { nombre: "FRASCO DE MOSQUINES", lema: "MOSCAS DE TU LADO", calidad: 2, pools: ["tesoro", "tienda"], tags: ["mosca"], activo: 3, usar: (j) => { for (let i = 0; i < 4; i++) J.familiares.push(moscaAzul(j.x, j.y)); SFX.zumbido(); } },
  linterna: { nombre: "LINTERNA", lema: "UNA LUZ QUE QUEMA", calidad: 2, pools: ["tesoro", "tienda"], activo: 4, usar: () => { J.destello = 8; temblar(6); for (const e of J.enemigos.slice()) danarEnemigo(e, 40); } },
  mechaEterna: { nombre: "MECHA ETERNA", lema: "UNA BOMBA GRATIS", calidad: 1, pools: ["tesoro", "tienda"], activo: 1, usar: (j) => { J.bombas.push(nuevaBomba(j, j.x, j.y + 2, 0, 0, 90)); SFX.mecha(); } },
  gotaRocio: { nombre: "GOTA DE ROCÍO", lema: "CURA UN CORAZÓN", calidad: 1, pools: ["tesoro", "tienda"], activo: 4, usar: (j) => { curar(j, 2); SFX.corazon(); } },
  necronomicon: { nombre: "NECRONOMICÓN", lema: "LA MUERTE PARA TODOS", calidad: 3, pools: ["tesoro", "pacto"], tags: ["libro"], activo: 3, usar: () => { J.destello = 8; temblar(10); for (const e of J.enemigos.slice()) danarEnemigo(e, 40); } },
  libroRevelacion: { nombre: "LIBRO DE LA REVELACIÓN", lema: "PROTECCIÓN REVELADA", calidad: 2, pools: ["tesoro"], tags: ["libro"], activo: 4, usar: (j) => { darEsporas(j, 2); SFX.corazon(); } },
  libroSombras: { nombre: "LIBRO DE LAS SOMBRAS", lema: "ESCUDO TEMPORAL", calidad: 3, pools: ["tesoro"], tags: ["libro"], activo: 3, usar: (j) => { j.escudo = 600; } },
  libroSanto: { nombre: "LIBRO SANTO", lema: "VUELO POR UN RATO", calidad: 2, pools: ["tesoro", "tienda"], tags: ["angel", "libro"], activo: 4, usar: (j) => { j.salaF.push("vuela"); } },
  telepatia: { nombre: "TELEPATÍA PARA TONTOS", lema: "LÁGRIMAS QUE PIENSAN", calidad: 1, pools: ["tesoro", "tienda"], tags: ["libro"], activo: 2, usar: (j) => { j.salaF.push("buscadora"); } },
  anarquista: { nombre: "MANUAL DEL ANARQUISTA", lema: "BOMBAS PARA TODOS", calidad: 1, pools: ["tesoro"], tags: ["libro"], activo: 3, usar: (j) => { for (let i = 0; i < 6; i++) { const [x, y] = lugarLibreCerca(cx(A.ent(1, 11)), cy(A.ent(0, 6))); J.bombas.push(nuevaBomba(j, x, y, 0, 0, 60 + i * 6)); } SFX.mecha(); } },
  shoop: { nombre: "¡AAAAAH!", lema: "GRITO DE AZUFRE", calidad: 2, pools: ["tesoro", "pacto"], activo: 2, usar: (j) => { rayo(j, j, Math.atan2(DIRS[j.mirar][1], DIRS[j.mirar][0]), 0, 2, 40); SFX.rayo(); } },
  remoto: { nombre: "CONTROL REMOTO", lema: "UN MISIL A PEDIDO", calidad: 2, pools: ["tesoro"], activo: 2, usar: (j) => { const e = J.enemigos.filter(blanco_).sort((a, b) => dist(a.x, a.y, j.x, j.y) - dist(b.x, b.y, j.x, j.y))[0]; J.misiles.push({ x: e ? e.x : j.x + DIRS[j.mirar][0] * 40, y: e ? e.y : j.y + DIRS[j.mirar][1] * 40, t: -12, dur: 24, dano: danoDe(j) * 20 }); } },
  kamikaze: { nombre: "¡KAMIKAZE!", lema: "BOOM (A VOS NO)", calidad: 1, pools: ["tesoro"], activo: 1, usar: (j) => explotar(j.x, j.y, true, false, { danoJug: 0, dano: 40 }) },
  relojArena: { nombre: "RELOJ DE ARENA", lema: "EL TIEMPO SE FRENA", calidad: 1, pools: ["tesoro", "tienda"], activo: 2, usar: () => { for (const e of J.enemigos) e.frio = 480; SFX.secreto(); } },
  unicornio: { nombre: "UNICORNIO CHIQUITO", lema: "¡INVENCIBLE!", calidad: 2, pools: ["tesoro"], activo: 6, usar: (j) => { j.escudo = 360; j.salaF.push("tacos"); } },
  tammy: { nombre: "CABEZA DE TAMMY", lema: "LLANTO EN REDONDO", calidad: 2, pools: ["tesoro"], activo: 1, usar: (j) => { if (j.arma === "rayo") { for (let k = 0; k < 8; k++) rayo(j, j, k * TAU / 8, 0, 1, 40); SFX.rayo(); } else { for (let k = 0; k < 10; k++) lagrima(j, j.x, j.y - 6, k * TAU / 10, 1, { danoFijo: danoDe(j) + 25 }); SFX.lagrima(); } } },
  cabezaGato: { nombre: "CABEZA DE GATO", lema: "MOSCAS AMIGAS", calidad: 2, pools: ["tesoro", "pacto"], tags: ["gato"], activo: 1, usar: (j) => { for (let i = 0; i < A.ent(2, 4); i++) J.familiares.push(moscaAzul(j.x, j.y)); SFX.zumbido(); } },
  patitaGato: { nombre: "PATITA DE GATO", lema: "CARNE POR ALMA", calidad: 2, pools: ["tesoro", "pacto"], tags: ["gato"], activo: 1, usar: (j) => { if (j.cont >= 2) { sumarContenedor(j, -1); darEsporas(j, 6); SFX.pacto(); } else SFX.malo(); } },
  cabezaPodrida: { nombre: "CABEZA PODRIDA", lema: "TIRALA", calidad: 1, pools: ["tesoro"], tags: ["podrido"], activo: 3, usar: (j) => { const [dx, dy] = DIRS[j.mirar]; J.bombas.push(Object.assign(nuevaBomba(j, j.x, j.y, dx * 5, dy * 5, 70, { contacto: true, danoJug: 1 }), { veneno: true, feto: true })); } },
  cajaAranas: { nombre: "CAJA DE ARAÑAS", lema: "ARAÑITAS AMIGAS", calidad: 1, pools: ["tesoro"], tags: ["arana"], activo: 3, usar: (j) => { for (let i = 0; i < A.ent(1, 4); i++) J.familiares.push(moscaAzul(j.x, j.y, "arana")); } },
};

/** Las baratijas: se llevan de a una (la nueva deja la vieja en el piso). */
const BARATIJAS = {
  gusanoOnda: { nombre: "GUSANO ONDULADO", lema: "LÁGRIMAS EN ONDA", st: { lag: 0.4 }, f: ["gusanoOnda"] },
  gusanoAnillo: { nombre: "GUSANO ANILLADO", lema: "LÁGRIMAS EN ESPIRAL", st: { lag: 0.4 }, f: ["gusanoAnillo"] },
  gusanoGancho: { nombre: "GUSANO GANCHO", lema: "LÁGRIMAS EN ZIGZAG", st: { lag: 0.4, alc: 1.5 }, f: ["gusanoGancho"] },
  gusanoPulso: { nombre: "GUSANO PULSO", lema: "LÁGRIMAS QUE LATEN", f: ["gusanoPulso"] },
  gusanoChato: { nombre: "GUSANO CHATO", lema: "LÁGRIMAS ANCHAS", f: ["gusanoChato"] },
  ojitoRosa: { nombre: "OJITO ROSA", lema: "LÁGRIMAS VENENOSAS", f: ["veneno"] },
  clip: { nombre: "CLIP", lema: "ABRE COFRES DORADOS", f: ["clip"] },
  dedoSuerte: { nombre: "DEDO DE LA SUERTE", lema: "MÁS PREMIOS", st: { suerte: 1 }, f: ["dedoSuerte"] },
  tenedor: { nombre: "TENEDOR", lema: "COMÉ ALGO", f: ["tenedor"] },
  garrapata: { nombre: "GARRAPATA", lema: "LOS JEFES, MÁS DÉBILES", f: ["garrapata"] },
  paginaPerdida: { nombre: "PÁGINA PERDIDA", lema: "EL DOLOR SE CONTAGIA", f: ["pagina"] },
  monedaTragada: { nombre: "MONEDA TRAGADA", lema: "DOLOR QUE PAGA", f: ["monedaTragada"] },
};

/** Las transformaciones: tres objetos con la misma etiqueta y Shumio cambia (como en el original). */
const TRANSFORMACIONES = {
  hongo: { nombre: "¡HONGAZO!", lema: "Más hongo que nunca", alTransformar: (j) => { sumarContenedor(j, 1); curar(j, 2); } },
  angel: { nombre: "¡SERAFÍN!", lema: "Alas y fe", f: ["vuela"], alTransformar: (j) => darEsporas(j, 6) },
  demonio: { nombre: "¡LEVIATÁN!", lema: "Alas oscuras", f: ["vuela"], alTransformar: (j) => darNegras(j, 4) },
  gato: { nombre: "¡MISHI!", lema: "Nueve vidas de moscas", f: ["vuela", "guppy"] },
  mosca: { nombre: "¡BELCEBÚ!", lema: "El señor de las moscas", f: ["vuela", "belcebu"] },
  podrido: { nombre: "¡PODRIDO!", lema: "Dejás baba venenosa", f: ["bob", "inmuneVeneno"] },
  jeringa: { nombre: "¡PINCHADO!", lema: "Daño y velocidad", st: { dano: 2, vel: 0.15 }, alTransformar: (j) => soltarPremio(j.x, j.y + 10, "capsula") },
  madre: { nombre: "¿SÍ, ABUELA?", lema: "Un cuchillo te sigue", f: ["cuchilloAtras"] },
  bebe: { nombre: "¡SIAMÉS!", lema: "Lágrimas en diagonal", st: { dano: -0.3, lag: -0.3 }, f: ["siames"] },
  libro: { nombre: "¡RATÓN DE BIBLIOTECA!", lema: "A veces, doble", f: ["ratonLibro"] },
  arana: { nombre: "¡BEBÉ ARAÑA!", lema: "Una araña amiga", f: ["aranaFam"] },
};
function revisarTransformaciones(j) {
  const cuenta = {};
  for (const id of j.vistos) for (const t of (OBJETOS[id] && OBJETOS[id].tags) || []) cuenta[t] = (cuenta[t] || 0) + 1;
  for (const t in TRANSFORMACIONES) {
    if ((cuenta[t] || 0) < 3 || j.transf.includes(t)) continue;
    j.transf.push(t);
    const tr = TRANSFORMACIONES[t];
    if (tr.alTransformar) tr.alTransformar(j);
    J.pendientes.push(() => { rotulo(tr.nombre, tr.lema); SFX.secreto(); J.destello = 6; });
  }
}

// ── las tandas: sin repetirse en la partida; la calidad alta sale menos ──
const PESO_CALIDAD = [1, 1, 1, 0.65, 0.3];
function armarTandas() {
  J.tandas = {};
  for (const [id, o] of Object.entries(OBJETOS)) for (const p of o.pools) (J.tandas[p] ||= []).push(id);
  J.tandas.cofre = [...new Set([...(J.tandas.cofre || []), ...J.tandas.tesoro.filter((id) => OBJETOS[id].calidad <= 2)])];
  J.tandas.rojo = [...new Set([...(J.tandas.rojo || []), ...J.tandas.pacto])];
  J.tandas.secreta = [...new Set([...(J.tandas.secreta || []), ...Object.keys(OBJETOS).filter((id) => OBJETOS[id].calidad >= 2 && !OBJETOS[id].pools.includes("pacto"))])];
  J.tomados = new Set();
}
function sacarObjeto(pool) {
  const libre = (id) => !J.tomados.has(id) && !J.enPedestal.has(id);
  let lista = (J.tandas[pool] || []).filter(libre);
  if (!lista.length) lista = Object.keys(OBJETOS).filter(libre);
  const id = lista.length ? A.pesos(lista.map((x) => [x, PESO_CALIDAD[OBJETOS[x].calidad] ?? 1])) : "caparazon";
  J.enPedestal.add(id);
  return id;
}
function sacarBaratija() {
  const ids = Object.keys(BARATIJAS).filter((id) => id !== (J.jug && J.jug.baratija) && !(J.baratijasVistas || new Set()).has(id));
  const id = ids.length ? A.uno(ids) : A.uno(Object.keys(BARATIJAS));
  (J.baratijasVistas ||= new Set()).add(id);
  return id;
}
function revelarMapa() { if (!J.piso) return; for (const s of J.piso.salas.values()) if (s.tipo !== "secreta") s.vista = true; }

function tomarObjeto(c) {
  const j = J.jug;
  if (!c.id || c.tocando) return false;
  c.tocando = true;
  const def = OBJETOS[c.id];
  if (c.pacto) {
    // el pacto: 1 o 2 contenedores; si no tenés, 3 corazones de espora (como en el original)
    const costo = c.pacto * 2;
    if (j.cont >= costo && vidaTotal(j) - costo > 0) sumarContenedor(j, -c.pacto);
    else if (j.cont === 0 && j.esporas > 6) j.esporas -= 6;
    else return false;
    SFX.pacto();
  } else if (c.precio) {
    if (j.monedas < c.precio) return false;
    j.monedas -= c.precio; SFX.moneda();
  }
  const id = c.id;
  J.tomados.add(id);
  const antes = fotoCuentas(j);
  if (def.activo) {
    if (j.activo) { c.id = j.activo.id; c.tocando = true; c.precio = 0; c.pacto = 0; } else c.id = null;
    j.activo = { id, carga: def.activo, max: def.activo };
  } else {
    c.id = null;
    j.objetos.push(id);
    if (def.alTomar) def.alTomar(j);
  }
  j.vistos.add(id);
  recalcular(j);
  revisarTransformaciones(j);
  recalcular(j);
  anotarCambios(antes);
  if (def.fam || j.f.cuchilloAtras || j.f.aranaFam) armarFamiliares();
  rotulo(def.nombre, def.lema);
  SFX.objeto();
  j.sostiene = iconoSpr(id); j.tSostiene = 50;
  // en la tienda y en el pacto, lo comprado se va con pedestal y todo
  return (c.precio || c.pacto) && !c.id ? true : false;
}

function rehacerPedestales() {
  let alguno = false;
  for (const c of J.sala.cosas) if (c.t === "objeto" && c.id) {
    J.enPedestal.delete(c.id);
    c.id = sacarObjeto(J.sala.tipo === "tienda" ? "tienda" : J.sala.tipo === "pacto" ? "pacto" : J.sala.tipo === "jefe" ? "jefe" : "tesoro");
    humo(c.x, c.y - 16); alguno = true;
  }
  SFX[alguno ? "secreto" : "malo"]();
}

// ── las cápsulas: el color de cada efecto se sortea por partida ──
const EFECTOS_CAPSULA = [
  { n: "¡LÁGRIMAS ARRIBA!", f: (j) => { j.extra.lag += 0.35; }, bueno: true }, { n: "LÁGRIMAS ABAJO", f: (j) => { j.extra.lag -= 0.28; } },
  { n: "¡VELOCIDAD ARRIBA!", f: (j) => { j.extra.vel += 0.15; }, bueno: true }, { n: "VELOCIDAD ABAJO", f: (j) => { j.extra.vel -= 0.1; } },
  { n: "¡ALCANCE ARRIBA!", f: (j) => { j.extra.alc += 0.75; }, bueno: true }, { n: "ALCANCE ABAJO", f: (j) => { j.extra.alc -= 0.5; } },
  { n: "¡SALUD TOTAL!", f: (j) => { j.vida = j.cont; }, bueno: true },
  { n: "MAL VIAJE", f: (j) => { if (vidaTotal(j) <= 2) { j.vida = j.cont; J.capsulaBien = true; } else { j.inv = 0; herirJugador(j, 1, "UNA CÁPSULA"); } } },
  { n: "¡SUERTE ARRIBA!", f: (j) => { j.extra.suerte += 1; }, bueno: true }, { n: "SUERTE ABAJO", f: (j) => { j.extra.suerte -= 1; } },
  { n: "BOMBAS POR LLAVES", f: (j) => { [j.bombas, j.llaves] = [j.llaves, j.bombas]; }, bueno: true },
  { n: "¡ESPORAS DE VIDA!", f: (j) => { darEsporas(j, 2); }, bueno: true },
  { n: "¡DAÑO ARRIBA!", f: (j) => { j.extra.plano += 0.4; }, bueno: true },
];
function sortearCapsulas() { J.capsulas = A.mezclar(EFECTOS_CAPSULA.slice()).slice(0, COLORES_CAPSULA.length); J.capsulasVistas = new Set(); }
function nombreCapsula(i) { return J.capsulasVistas.has(i) ? J.capsulas[i].n : "UNA CÁPSULA"; }
function tomarCapsula(j) {
  if (j.capsula == null) return;
  const i = j.capsula, e = J.capsulas[i];
  j.capsula = null; J.capsulasVistas.add(i); J.capsulaBien = false;
  const antes = fotoCuentas(j);
  e.f(j);
  recalcular(j);
  anotarCambios(antes);
  rotulo(J.capsulaBien ? "¡SALUD TOTAL!" : e.n, "");
  SFX[e.bueno || J.capsulaBien ? "capsula" : "malo"]();
}

// lo que cambió en las cuentas (el HUD lo muestra en verde o rojo al lado, como el original)
function fotoCuentas(j) { return { vel: velDe(j), lag: lagrimasPorSeg(j), dano: danoDe(j), alc: j.alcance, tiro: j.velLag, suerte: j.suerte }; }
function anotarCambios(antes) {
  const d = fotoCuentas(J.jug);
  J.cambios ||= {};
  for (const k in d) if (Math.abs(d[k] - antes[k]) > 0.005) J.cambios[k] = { d: d[k] - antes[k], t: 200 };
}

function usarActivo(j) {
  const a = j.activo;
  if (!a || j.muerto) return;
  if (a.carga < a.max) { SFX.clic(); return; }
  a.carga = 0;
  OBJETOS[a.id].usar(j);
  recalcular(j);
  SFX.activo();
}
function cargarActivo(n = 1) {
  const a = J.jug.activo;
  if (!a || a.carga >= a.max) return;
  a.carga = Math.min(a.max, a.carga + n);
  if (a.carga >= a.max) SFX.cargado();
}
