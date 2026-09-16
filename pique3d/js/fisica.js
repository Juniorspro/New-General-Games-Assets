// La fisica del jugador. Funcion pura sobre un estado y un nivel.
//
// Pura a proposito: el validador de niveles (generador.js) corre ESTE mismo
// codigo miles de veces por nivel para comprobar que se puede terminar. Si
// fueran dos fisicas distintas, "nivel completable" seria una opinion y no un
// hecho, y el jugador se comeria un nivel imposible sin que nada avisara.

import { T, V, SOLIDOS, SEMI, MATAN, RAMPAS, F } from "./mundo.js";

export function nuevoJugador(x, y) {
  return {
    x, y, vx: 0, vy: 0, dir: 1,
    suelo: false, pared: 0,        // pared: -1 izquierda, 1 derecha, 0 ninguna
    sosten: 0, saltando: false,
    vault: 0, giro: 0, giroUsado: false, largo: 0,
    coyote: 0, buffer: 0, impulso: 0,
    frenado: false,                // parado sobre un bloque de pausa
    rampa: 0,                      // -1 bajando, 1 subiendo, 0 llano
    combo: 0, comboTimer: 0,
    vivo: true, cuadros: 0,
  };
}

export function clonar(j) { return { ...j }; }

// --- ayudas de grilla ----------------------------------------------------
const tileEn = (nv, px, py) => {
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  if (tx < 0 || ty < 0 || tx >= nv.ancho || ty >= nv.alto) return tx < 0 ? V.SOLIDO : V.NADA;
  return nv.grilla[ty * nv.ancho + tx];
};
export const tileXY = (nv, tx, ty) =>
  (tx < 0 || ty < 0 || tx >= nv.ancho || ty >= nv.alto) ? V.NADA : nv.grilla[ty * nv.ancho + tx];

const esSolido = (v) => SOLIDOS.has(v);

// Altura de la superficie de una rampa dentro de su propio tile, en pixeles
// desde arriba del tile. "/" sube hacia la derecha, "\" baja.
function alturaRampa(v, frac) {
  if (v === V.RAMPA_SUBE) return T - frac * T;
  if (v === V.RAMPA_BAJA) return frac * T;
  return null;
}

// Y de la superficie pisable en una X, o null si ahi no hay rampa.
function superficieRampa(nv, px, py) {
  const tx = Math.floor(px / T), ty = Math.floor(py / T);
  const v = tileXY(nv, tx, ty);
  if (!RAMPAS.has(v)) return null;
  const h = alturaRampa(v, (px - tx * T) / T);
  return ty * T + h;
}

// Choca la caja del jugador con algo solido?
function chocaCaja(nv, x, y) {
  const x0 = Math.floor((x - F.ANCHO / 2) / T), x1 = Math.floor((x + F.ANCHO / 2 - 0.01) / T);
  const y0 = Math.floor((y - F.ALTO) / T), y1 = Math.floor((y - 0.01) / T);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (esSolido(tileXY(nv, tx, ty))) return true;
  return false;
}

// Cuanto hay que subir para que la caja deje de chocar, hasta un tope.
// Devuelve null si no alcanza: ahi es una pared de verdad, no un escalon.
function alturaEscalon(nv, x, y, tope) {
  for (let d = 1; d <= tope; d++) if (!chocaCaja(nv, x, y - d)) return d;
  return null;
}

/**
 * Un cuadro de fisica.
 * @param j       estado del jugador (se modifica)
 * @param nv      {grilla, ancho, alto}
 * @param ent     {toque, toqueNuevo} — toque = dedo/tecla apoyado ahora
 * @param ev      objeto donde se anotan los eventos del cuadro
 */
export function paso(j, nv, ent, ev = {}) {
  j.cuadros++;
  if (j.comboTimer > 0 && --j.comboTimer === 0) j.combo = 0;

  // --- bloque de pausa: frena al jugador Y al reloj -----------------------
  // Se comprueba ANTES que nada: parado sobre uno, el cuadro entero no corre.
  if (j.frenado) {
    j.vx = 0; j.vy = 0;
    if (ent.toqueNuevo) { j.frenado = false; ev.despausa = true; }
    else return ev;
  }

  if (ent.toqueNuevo) j.buffer = F.BUFFER;
  if (j.buffer > 0) j.buffer--;
  if (j.coyote > 0) j.coyote--;
  if (j.impulso > 0) j.impulso--;
  if (j.vault > 0) j.vault--;
  if (j.largo > 0 && j.suelo) j.largo = 0;   // tocar piso corta el impulso
  else if (j.largo > 0) j.largo--;

  // --- salto -------------------------------------------------------------
  const quiereSaltar = j.buffer > 0;
  if (quiereSaltar) {
    if (j.vault > 0) {
      // Tocar JUSTO mientras vaultea: salto alto y, si habia un enemigo
      // abajo, se lo lleva puesto. Es la maniobra que mas paga del juego.
      j.vy = F.VAULT_SALTO; j.sosten = F.SOSTEN_MAX; j.saltando = true;
      j.buffer = 0; j.vault = 0; j.giroUsado = false;
      ev.vaultSalto = true;
    } else if (j.suelo || j.coyote > 0) {
      j.vy = F.SALTO; j.sosten = F.SOSTEN_MAX; j.saltando = true;
      j.suelo = false; j.coyote = 0; j.buffer = 0; j.giroUsado = false;
      ev.salto = true;
    } else if (j.pared !== 0) {
      // Salto de pared: rebota Y DA VUELTA la carrera. Asi funcionan los
      // niveles de torre: se sube haciendo zigzag entre las dos paredes.
      j.vy = F.SALTO_PARED_Y; j.sosten = F.SOSTEN_MAX; j.saltando = true;
      j.dir = -j.pared; j.vx = j.dir * F.SALTO_PARED_X;
      j.impulso = F.IMPULSO_PARED; j.pared = 0; j.buffer = 0; j.giroUsado = false;
      ev.saltoPared = true;
    } else if (!j.giroUsado) {
      // Giro en el aire: no sube, pero frena la caida. Sirve para llegar a
      // un borde que quedo a medio tile.
      j.giro = F.GIRO_CUADROS; j.giroUsado = true; j.buffer = 0;
      if (j.vy < 0) j.vy *= 0.5;
      ev.giro = true;
    }
  }

  // --- gravedad ----------------------------------------------------------
  if (!ent.toque || j.vy >= 0) j.sosten = 0;
  let g = F.GRAV;
  if (j.sosten > 0 && j.vy < 0) { g = F.GRAV_SOSTEN; j.sosten--; }
  if (j.giro > 0) { g = F.GIRO_CAIDA; j.giro--; }
  j.vy = Math.min(j.vy + g, F.CAIDA_MAX);

  // Pegado a una pared se cae mas lento: da tiempo a encadenar el rebote.
  if (j.pared !== 0 && j.vy > F.DESLIZ_PARED && !j.suelo) j.vy = F.DESLIZ_PARED;

  // --- velocidad horizontal ----------------------------------------------
  // El jugador nunca elige esto: corre solo. Lo unico que lo cambia es el
  // rebote de una pared, y solo por unos cuadros.
  if (j.impulso > 0) j.vx += (j.dir * F.VEL - j.vx) * 0.12;
  else j.vx = j.dir * F.VEL;
  // En bajada se acelera: la pendiente se siente como pendiente.
  if (j.rampa === -1 && j.suelo) j.vx *= 1.35;
  if (j.largo > 0 && !j.suelo) j.vx *= F.LARGO_BOOST;

  // --- mover en X --------------------------------------------------------
  const nx = j.x + j.vx;
  j.pared = 0;
  if (chocaCaja(nv, nx, j.y)) {
    // Escalon de hasta un tile: se sube solo. Es el "vault" y el "edge
    // climbing" del original, que son la misma cosa vistos de afuera.
    const sube = alturaEscalon(nv, nx, j.y, T + 2);
    if (sube !== null && j.suelo) {
      j.x = nx; j.y -= sube;
      if (sube > 3) { j.vy = F.VAULT; j.vault = 9; j.suelo = false; ev.vault = true; }
    } else if (sube !== null && !j.suelo && j.vy >= 0 && sube <= 7) {
      // Cayendo justo sobre el filo: se trepa en vez de rebotar contra el
      // costado. Sin esto, un salto bien calculado se siente robado.
      j.x = nx; j.y -= sube; j.vy = 0; ev.trepada = true;
    } else {
      j.pared = Math.sign(j.vx) || j.dir;
      if (j.suelo) { j.dir = -j.dir; ev.giroPared = true; }   // se da vuelta
      j.vx = 0;
    }
  } else {
    j.x = nx;
  }

  // --- vault sobre un hueco ----------------------------------------------
  // Huecos de 1 o 2 tiles se cruzan solos, sin tocar. De 3 para arriba hay
  // que saltar. Es exactamente el limite del juego original y es lo que hace
  // que un nivel se sienta "con ritmo" en vez de "con trampas".
  if (j.suelo && j.vault === 0 && j.vy >= 0) {
    const pieX = j.x + j.dir * (F.ANCHO / 2 + 1);
    const ty = Math.floor((j.y + 2) / T);
    if (!pisable(nv, pieX, j.y + 2)) {
      let ancho = 0;
      for (let d = 1; d <= 3; d++) {
        if (pisable(nv, pieX + j.dir * d * T, j.y + 2)) break;
        ancho = d;
      }
      if (ancho >= 1 && ancho <= 2) {
        j.vy = F.VAULT; j.vault = 10; j.suelo = false; ev.vaultHueco = true;
      }
    }
  }

  // --- mover en Y --------------------------------------------------------
  const ny = j.y + j.vy;
  j.suelo = false; j.rampa = 0;

  // Rampas primero: son superficie continua, no tiles enteros.
  const sr = superficieRampa(nv, j.x, ny) ?? superficieRampa(nv, j.x, ny - 1);
  if (sr !== null && j.vy >= 0 && ny >= sr - 1) {
    j.y = sr; j.vy = 0; j.suelo = true; j.coyote = F.COYOTE;
    const v = tileEn(nv, j.x, j.y + 1) || tileEn(nv, j.x, j.y - 1);
    j.rampa = tileEn(nv, j.x, j.y - 1) === V.RAMPA_BAJA ||
              tileEn(nv, j.x, j.y + 1) === V.RAMPA_BAJA ? -1 : 1;
    if (j.rampa === -1) ev.tobogan = true;
  } else if (j.vy >= 0) {
    // Cayendo: frena contra solidos y contra plataformas de solo-arriba.
    if (chocaCaja(nv, j.x, ny) || pisaSemi(nv, j.x, j.y, ny)) {
      j.y = Math.floor((ny - 0.01) / T) * T;
      // Reacomodar: el pie queda justo arriba del tile que lo freno.
      while (chocaCaja(nv, j.x, j.y) || pisaSemi(nv, j.x, j.y - 0.5, j.y)) j.y -= 1;
      j.vy = 0; j.suelo = true; j.coyote = F.COYOTE; j.saltando = false;
      if (tileEn(nv, j.x, j.y + 1) === V.PAUSA) { j.frenado = true; ev.pausa = true; }
      const abajo = tileEn(nv, j.x, j.y + 1);
      if (abajo === V.RESORTE) {
        j.vy = F.RESORTE_V; j.suelo = false; j.sosten = F.SOSTEN_MAX; ev.resorte = true;
      }
      // Salto largo: arco BAJO y LEJOS. No sube casi nada pero multiplica el
      // avance mientras dura, que es lo unico que cruza un hueco de nueve
      // tiles — el salto mas alto del juego llega a seis.
      if (abajo === V.LARGO) {
        j.vy = F.LARGO_V; j.suelo = false; j.sosten = F.SOSTEN_MAX;
        j.largo = F.LARGO_CUADROS; ev.saltoLargo = true;
      }
      // Voltereta: sube mucho mas que un salto normal. Sirve para monedas
      // que quedaron arriba de todo.
      if (abajo === V.VOLTERETA) {
        j.vy = F.VOLT_V; j.suelo = false; j.sosten = F.SOSTEN_MAX; ev.voltereta = true;
      }
    } else j.y = ny;
  } else {
    // Subiendo: cabezazo.
    if (chocaCaja(nv, j.x, ny)) {
      j.y = Math.ceil((ny - F.ALTO) / T) * T + F.ALTO + 0.01;
      j.vy = 0; j.sosten = 0;
      ev.cabezazo = { tx: Math.floor(j.x / T), ty: Math.floor((j.y - F.ALTO - 1) / T) };
    } else j.y = ny;
  }

  // --- morir -------------------------------------------------------------
  if (MATAN.has(tileEn(nv, j.x, j.y - 1)) || MATAN.has(tileEn(nv, j.x, j.y - F.ALTO + 2))) {
    j.vivo = false; ev.muerte = "pinche";
  }
  if (j.y > (nv.alto + 2) * T) { j.vivo = false; ev.muerte = "pozo"; }
  if (j.x < F.ANCHO / 2) { j.x = F.ANCHO / 2; j.dir = 1; }

  return ev;
}

function pisable(nv, px, py) {
  const v = tileEn(nv, px, py);
  return esSolido(v) || SEMI.has(v) || RAMPAS.has(v);
}

// Las plataformas de solo-arriba frenan unicamente si el pie venia por encima
// del borde. Si no, se atraviesan de abajo hacia arriba, que es todo el punto.
function pisaSemi(nv, x, yViejo, yNuevo) {
  const x0 = Math.floor((x - F.ANCHO / 2) / T), x1 = Math.floor((x + F.ANCHO / 2 - 0.01) / T);
  const ty = Math.floor((yNuevo - 0.01) / T);
  if (Math.floor((yViejo - 0.01) / T) >= ty) return false;
  for (let tx = x0; tx <= x1; tx++) if (SEMI.has(tileXY(nv, tx, ty))) return true;
  return false;
}

export function sumarCombo(j) {
  j.combo = Math.min(j.combo + 1, 8);
  j.comboTimer = 45;
  // 1, 2, 4, 8... igual que las pisadas encadenadas del original.
  return Math.min(1 << (j.combo - 1), 16);
}
