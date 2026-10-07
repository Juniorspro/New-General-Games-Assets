/* ============================================================================
   Las cartas (mejoras de la partida) y el altar (mejoras para siempre).
   Cada carta es un naipe: el palo dice qué toca —bastos los disparos, espadas
   el daño, copas la vida y oros lo demás— y el color del borde, qué tan rara es.
   ========================================================================== */

const RAREZA = { comun: { peso: 60, col: '#d8d0c0', nombre: 0 }, rara: { peso: 30, col: '#5ac8ff' }, epica: { peso: 10, col: '#ffcf4a' } };

/* nombre y descripción en [es, en, pt] */
const CARTAS = {
  frontal:   { palo: 'bastos', rar: 'rara', max: 3, n: ['TIRO DOBLE', 'DOUBLE SHOT', 'TIRO DUPLO'], d: ['+1 DISPARO HACIA ADELANTE.', '+1 FORWARD SHOT.', '+1 DISPARO PARA A FRENTE.'] },
  seguido:   { palo: 'bastos', rar: 'rara', max: 2, n: ['RÁFAGA', 'BURST', 'RAJADA'], d: ['DISPARÁS OTRA VEZ AL INSTANTE.', 'FIRE AGAIN RIGHT AWAY.', 'ATIRA DE NOVO NA HORA.'] },
  diagonal:  { palo: 'bastos', rar: 'comun', max: 3, n: ['ABANICO', 'FAN', 'LEQUE'], d: ['+2 DISPAROS EN DIAGONAL.', '+2 DIAGONAL SHOTS.', '+2 DISPAROS NA DIAGONAL.'] },
  lateral:   { palo: 'bastos', rar: 'comun', max: 1, n: ['COSTADOS', 'SIDES', 'LATERAIS'], d: ['+2 DISPAROS A LOS COSTADOS.', '+2 SIDE SHOTS.', '+2 DISPAROS PARA OS LADOS.'] },
  trasero:   { palo: 'bastos', rar: 'comun', max: 2, n: ['ESPALDA', 'BACK', 'COSTAS'], d: ['+1 DISPARO HACIA ATRÁS.', '+1 BACKWARD SHOT.', '+1 DISPARO PARA TRÁS.'] },
  rebote:    { palo: 'bastos', rar: 'comun', max: 1, n: ['REBOTE', 'BOUNCE', 'RICOCHETE'], d: ['LOS DISPAROS REBOTAN EN LAS PAREDES.', 'SHOTS BOUNCE OFF WALLS.', 'OS DISPAROS QUICAM NAS PAREDES.'] },
  atraviesa: { palo: 'bastos', rar: 'rara', max: 1, n: ['ATRAVIESA', 'PIERCE', 'ATRAVESSA'], d: ['LOS DISPAROS ATRAVIESAN ENEMIGOS.', 'SHOTS PIERCE THROUGH ENEMIES.', 'OS DISPAROS ATRAVESSAM INIMIGOS.'] },
  salto:     { palo: 'bastos', rar: 'rara', max: 1, n: ['SALTITO', 'RICOCHET', 'SALTINHO'], d: ['EL DISPARO SALTA A OTRO ENEMIGO.', 'SHOTS JUMP TO ANOTHER ENEMY.', 'O DISPARO PULA PARA OUTRO INIMIGO.'] },
  danio:     { palo: 'espadas', rar: 'comun', max: 5, n: ['FILO', 'EDGE', 'FIO'], d: ['+25% DE DAÑO.', '+25% DAMAGE.', '+25% DE DANO.'] },
  cadencia:  { palo: 'espadas', rar: 'comun', max: 5, n: ['PULSO', 'PULSE', 'PULSO'], d: ['+18% DE VELOCIDAD DE DISPARO.', '+18% FIRE RATE.', '+18% DE CADÊNCIA.'] },
  critico:   { palo: 'espadas', rar: 'comun', max: 4, n: ['OJO MALO', 'EVIL EYE', 'OLHO GORDO'], d: ['+12% DE CRÍTICO Y CRÍTICOS MÁS FUERTES.', '+12% CRIT CHANCE AND STRONGER CRITS.', '+12% DE CRÍTICO E CRÍTICOS MAIS FORTES.'] },
  fuego:     { palo: 'espadas', rar: 'rara', max: 1, n: ['BRASA', 'EMBER', 'BRASA'], d: ['LOS DISPAROS QUEMAN.', 'SHOTS SET ENEMIES ON FIRE.', 'OS DISPAROS QUEIMAM.'] },
  hielo:     { palo: 'espadas', rar: 'rara', max: 1, n: ['ESCARCHA', 'FROST', 'GEADA'], d: ['FRENAN Y A VECES CONGELAN.', 'SLOW AND SOMETIMES FREEZE.', 'FREIAM E ÀS VEZES CONGELAM.'] },
  rayo:      { palo: 'espadas', rar: 'rara', max: 1, n: ['RAYO', 'LIGHTNING', 'RAIO'], d: ['CADA GOLPE TIRA UN RAYO A DOS CERCANOS.', 'EACH HIT ARCS TO TWO NEARBY FOES.', 'CADA GOLPE SOLTA UM RAIO EM DOIS PERTO.'] },
  veneno:    { palo: 'espadas', rar: 'comun', max: 1, n: ['PONZOÑA', 'VENOM', 'PEÇONHA'], d: ['ENVENENA. EL VENENO SE ACUMULA.', 'POISONS. POISON STACKS UP.', 'ENVENENA. O VENENO ACUMULA.'] },
  vida:      { palo: 'copas', rar: 'comun', max: 5, n: ['CORAZÓN', 'HEART', 'CORAÇÃO'], d: ['+25% DE VIDA MÁXIMA.', '+25% MAX HEALTH.', '+25% DE VIDA MÁXIMA.'] },
  robo:      { palo: 'copas', rar: 'comun', max: 3, n: ['SED', 'THIRST', 'SEDE'], d: ['CADA ENEMIGO QUE CAE TE CURA UN POCO.', 'EVERY ENEMY YOU DROP HEALS YOU A BIT.', 'CADA INIMIGO QUE CAI TE CURA UM POUCO.'] },
  curar:     { palo: 'copas', rar: 'comun', max: 99, n: ['MATE', 'MATE TEA', 'CHIMARRÃO'], d: ['TE CURA LA MITAD DE LA VIDA.', 'HEALS HALF YOUR HEALTH.', 'CURA METADE DA VIDA.'] },
  escudo:    { palo: 'oros', rar: 'epica', max: 2, n: ['LUZ MALA', 'WISPS', 'LUZ MÁ'], d: ['LUCES QUE GIRAN, QUEMAN Y FRENAN BALAS.', 'ORBITING LIGHTS BURN FOES AND BLOCK SHOTS.', 'LUZES QUE GIRAM, QUEIMAM E PARAM BALAS.'] },
  compa:     { palo: 'oros', rar: 'epica', max: 2, n: ['ÁNIMA', 'SPIRIT', 'ESPÍRITO'], d: ['UN ESPÍRITU DISPARA CON VOS, AUNQUE CORRAS.', 'A SPIRIT SHOOTS WITH YOU, EVEN WHILE MOVING.', 'UM ESPÍRITO ATIRA COM VOCÊ, MESMO CORRENDO.'] },
  velocidad: { palo: 'oros', rar: 'comun', max: 3, n: ['ALPARGATAS', 'SANDALS', 'ALPARCATAS'], d: ['+12% DE VELOCIDAD.', '+12% MOVE SPEED.', '+12% DE VELOCIDADE.'] },
  iman:      { palo: 'oros', rar: 'comun', max: 1, n: ['IMÁN', 'MAGNET', 'ÍMÃ'], d: ['JUNTÁS TODO DE MÁS LEJOS.', 'PICK UP THINGS FROM FAR AWAY.', 'PEGA TUDO DE MAIS LONGE.'] },
  explosion: { palo: 'oros', rar: 'rara', max: 1, n: ['ESTALLIDO', 'BLAST', 'ESTOURO'], d: ['LOS ENEMIGOS EXPLOTAN AL CAER.', 'ENEMIES EXPLODE WHEN THEY DIE.', 'OS INIMIGOS EXPLODEM AO CAIR.'] },
  esquive:   { palo: 'oros', rar: 'rara', max: 3, n: ['SOMBRA', 'SHADOW', 'SOMBRA'], d: ['+10% DE ESQUIVAR GOLPES.', '+10% CHANCE TO DODGE HITS.', '+10% DE CHANCE DE ESQUIVAR.'] },
  copla:     { palo: 'oros', rar: 'comun', max: 2, n: ['GUITARRA', 'GUITAR', 'VIOLÃO'], d: ['LA COPLA SE CARGA MÁS RÁPIDO.', 'COPLA CHARGES FASTER.', 'A COPLA CARREGA MAIS RÁPIDO.'] },
};
const iIdioma = () => (IDIOMA === 'en' ? 1 : IDIOMA === 'pt' ? 2 : 0);
const nombreCarta = (id) => CARTAS[id].n[iIdioma()];
const descCarta = (id) => CARTAS[id].d[iIdioma()];

/* tres cartas distintas para elegir. "solo" fuerza una rareza (el trato del Pombero da épicas) */
function ofrecerCartas(j, rnd, solo) {
  const suerte = DATOS.meta.suerte;
  const pesos = { comun: 60 - suerte * 10, rara: 30 + suerte * 6, epica: 10 + suerte * 4 };
  const libres = Object.keys(CARTAS).filter((id) => (j.cartas[id] || 0) < CARTAS[id].max && !(id === 'curar' && j.vida > j.vidaMax * 0.7));
  const salen = [];
  for (let n = 0; n < 3 && libres.length; n++) {
    let pool = libres.filter((id) => !salen.includes(id) && (!solo || CARTAS[id].rar === solo));
    if (!pool.length) pool = libres.filter((id) => !salen.includes(id));
    if (!pool.length) break;
    let total = 0;
    for (const id of pool) total += pesos[CARTAS[id].rar];
    let x = rnd() * total, elegida = pool[0];
    for (const id of pool) { x -= pesos[CARTAS[id].rar]; if (x <= 0) { elegida = id; break; } }
    salen.push(elegida);
  }
  return salen;
}

/* ------------------------------------------------------------ el altar */
const ALTAR = [
  { id: 'vida', max: 5, costo: [40, 80, 140, 220, 320], n: ['VIDA', 'HEALTH', 'VIDA'], d: ['+10% DE VIDA', '+10% HEALTH', '+10% DE VIDA'] },
  { id: 'danio', max: 5, costo: [40, 80, 140, 220, 320], n: ['FUERZA', 'POWER', 'FORÇA'], d: ['+8% DE DAÑO', '+8% DAMAGE', '+8% DE DANO'] },
  { id: 'cadencia', max: 5, costo: [50, 100, 160, 240, 340], n: ['MANO', 'HAND', 'MÃO'], d: ['+6% DE CADENCIA', '+6% FIRE RATE', '+6% DE CADÊNCIA'] },
  { id: 'suerte', max: 3, costo: [120, 260, 450], n: ['SUERTE', 'LUCK', 'SORTE'], d: ['CARTAS MÁS RARAS', 'RARER CARDS', 'CARTAS MELHORES'] },
  { id: 'yapa', max: 1, costo: [200], n: ['YAPA', 'HEAD START', 'BÔNUS'], d: ['CARTA AL EMPEZAR', 'STARTING CARD', 'CARTA AO COMEÇAR'] },
  { id: 'revivir', max: 1, costo: [400], n: ['OTRA VIDA', 'EXTRA LIFE', 'OUTRA VIDA'], d: ['REVIVÍS UNA VEZ', 'REVIVE ONCE', 'REVIVE UMA VEZ'] },
];
