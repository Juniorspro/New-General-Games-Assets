// Los enemigos y las cosas que se mueven.
//
// Los nombres son PROPIOS, no los del genero: bolo, caracol, aleta, erizo,
// fauces, osario, vela, perno, brasa. El rol de juego —camina, se pisa, no se
// puede pisar— es un clasico y no se puede registrar; el personaje si. Cada
// nombre tiene su hoja de sprites con el mismo nombre, asi que renombrar uno
// aca sin renombrar la hoja deja al bicho como un rectangulo naranja: es el
// respaldo, y aparecio en pantalla por copiar este archivo de la version vieja
// sin traer el renombre.
//
// Trece tipos con una interfaz sola: cada uno sabe moverse y decir si se puede
// pisar. La regla dura es que el enemigo NO decide si mata: eso lo resuelve
// `chocar()` mirando de donde viene el jugador. Si cada enemigo decidiera por
// su cuenta, "pisar" y "chocar" se contradirian en los bordes — y en los
// bordes es donde el jugador mira.

import { T, V, F, ALTO_TILES } from "./mundo.js";
import { tileXY } from "./fisica.js";

const solido = (nv, tx, ty) => {
  const v = tileXY(nv, tx, ty);
  return v === V.SOLIDO || v === V.LADRILLO || v === V.PREGUNTA || v === V.TUBO ||
         v === V.USADO || v === V.PAUSA || v === V.TIEMPO || v === V.PLATAFORMA ||
         v === V.LARGO || v === V.VOLTERETA;
};

// Camina, se da vuelta contra una pared y —lo importante— NO se tira al vacio.
// Un goomba que se suicida en el primer pozo deja el nivel vacio a la mitad.
function caminar(e, nv, vel) {
  const py = Math.floor((e.y + 1) / T);
  const proa = Math.floor((e.x + e.dir * (e.w / 2 + 2)) / T);
  if (solido(nv, proa, py - 1) || !solido(nv, proa, py)) e.dir *= -1;
  e.x += e.dir * vel;
}

function caer(e, nv) {
  e.vy = Math.min(e.vy + 0.42, 8);
  const ny = e.y + e.vy;
  const ty = Math.floor(ny / T);
  const x0 = Math.floor((e.x - e.w / 2) / T), x1 = Math.floor((e.x + e.w / 2 - 0.01) / T);
  let choca = false;
  for (let tx = x0; tx <= x1; tx++) if (solido(nv, tx, ty)) choca = true;
  if (choca && e.vy > 0) { e.y = ty * T; e.vy = 0; e.suelo = true; }
  else { e.y = ny; e.suelo = false; }
}

const BASE = { vivo: true, vy: 0, dir: -1, suelo: false, t: 0, pisable: true, letal: true };

export function crear(tipo, tx, ty) {
  const e = { ...BASE, tipo, x: tx * T + T / 2, y: ty * T + T, w: 13, h: 14, ini: { tx, ty } };
  switch (tipo) {
    case "bolo":  e.vel = 0.45; break;
    case "coraza":   e.vel = 0.62; break;
    case "caracol":   e.vel = 0.50; e.h = 18; e.caparazon = false; break;
    case "aleta": e.vel = 0.55; e.h = 18; e.alas = true; e.baseY = e.y; break;
    case "osario":  e.vel = 0.55; e.h = 17; e.roto = 0; break;
    case "erizo":   e.vel = 0.60; e.pisable = false; break;
    case "fauces":  e.pisable = false; e.w = 12; e.h = 18; e.baseY = e.y; e.fase = (tx * 37) % 120; break;
    case "perno":    e.vel = 1.9; e.w = 14; e.h = 12; e.gravedad = false; break;
    case "mortero":  e.vel = 0; e.w = 16; e.h = 16; e.pisable = false; e.letal = false;
                    e.recarga = 90 + (tx * 17) % 60; e.reloj = e.recarga; break;
    case "vigia":  e.vel = 0.8; e.w = 16; e.h = 16; e.pisable = false; e.gravedad = false;
                    e.reloj = 100; break;
    case "vela":     e.w = 15; e.h = 15; e.pisable = false; e.gravedad = false; e.vel = 0.55; break;
    case "torrepua":   e.vel = 0.35; e.w = 13; e.h = 46; e.segmentos = 3; break;
    case "brasa":  e.pisable = false; e.gravedad = false; e.w = 13; e.h = 15;
                    e.baseY = e.y + 5 * T; e.fase = (tx * 29) % 150; break;
    case "rueda":   e.pisable = false; e.gravedad = false; e.w = 10; e.h = 10;
                    e.largo = 3 + ((tx * 13) % 3); e.pivote = { x: e.x, y: e.y - T }; break;
    default:        e.vel = 0.45;
  }
  return e;
}

export function actualizar(e, nv, j, ev, nuevos) {
  e.t++;
  if (!e.vivo) return;
  switch (e.tipo) {
    case "bolo": case "coraza": case "erizo":
      caer(e, nv); if (e.suelo) caminar(e, nv, e.vel); break;

    case "caracol":
      caer(e, nv);
      if (e.caparazon) {
        // El caparazon empujado mata todo lo que toca, incluidos otros
        // enemigos. Es el unico objeto del juego que pelea del lado del
        // jugador, y por eso vale una cadena entera de combo.
        if (e.empujado) { e.x += e.dir * 3.4; if (chocaPared(e, nv)) e.dir *= -1; }
      } else if (e.suelo) caminar(e, nv, e.vel);
      break;

    case "aleta":
      // Rebota en el lugar. Pisarlo le saca las alas y queda un koopa comun.
      if (e.alas) { e.y = e.baseY + Math.sin(e.t / 26) * 34; }
      else { caer(e, nv); if (e.suelo) caminar(e, nv, e.vel); }
      break;

    case "osario":
      if (e.roto > 0) { if (--e.roto === 0) e.pisable = true; break; }
      caer(e, nv); if (e.suelo) caminar(e, nv, e.vel); break;

    case "fauces": {
      // Sale y se esconde. Y se queda escondida si el jugador esta encima del
      // tubo: salir justo abajo del jugador es una muerte que no se puede ver
      // venir, y esas no van.
      const ciclo = (e.t + e.fase) % 150;
      const cerca = Math.abs(j.x - e.x) < 22;
      const fuera = ciclo < 70 && !cerca;
      e.salida = fuera ? Math.min(1, (70 - ciclo) / 22) : Math.max(0, (e.salida ?? 0) - 0.08);
      e.y = e.baseY - e.salida * 20;
      e.activa = e.salida > 0.3;
      break;
    }

    case "perno": e.x += e.dir * e.vel; if (e.x < -40 || e.x > nv.ancho * T + 40) e.vivo = false; break;

    case "mortero":
      if (--e.reloj <= 0) {
        e.reloj = e.recarga;
        if (Math.abs(j.x - e.x) < 300) {
          const b = crear("perno", 0, 0);
          b.x = e.x; b.y = e.y; b.dir = j.x < e.x ? -1 : 1;
          nuevos.push(b); ev.disparo = true;
        }
      }
      break;

    case "vigia": {
      // Persigue por arriba y tira spinies. Se mantiene adelante del jugador,
      // nunca encima: tirar algo sobre la cabeza sin aviso es lo mismo que la
      // planta, y tampoco va.
      const objetivo = j.x + 70;
      e.x += Math.sign(objetivo - e.x) * Math.min(e.vel, Math.abs(objetivo - e.x) * 0.05);
      e.y = Math.max(3 * T, j.y - 5 * T) + Math.sin(e.t / 30) * 6;
      if (--e.reloj <= 0) {
        e.reloj = 150;
        const s = crear("erizo", 0, 0); s.x = e.x; s.y = e.y + 10; nuevos.push(s);
      }
      break;
    }

    case "vela": {
      // Se acerca despacio. Si el jugador lo mira de frente se tapa y frena:
      // es lo que lo hace un obstaculo de ritmo y no una persecucion perdida.
      const dx = j.x - e.x, dy = (j.y - 8) - e.y;
      e.tapado = (j.dir > 0 && dx < 0) || (j.dir < 0 && dx > 0);
      if (!e.tapado) {
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * e.vel; e.y += (dy / d) * e.vel;
      }
      break;
    }

    case "torrepua":
      caer(e, nv);
      if (e.suelo) caminar(e, nv, e.vel);
      e.h = 16 * e.segmentos;
      break;

    case "brasa": {
      const ciclo = (e.t + e.fase) % 150;
      if (ciclo < 75) { const u = ciclo / 75; e.y = e.baseY - Math.sin(u * Math.PI) * 130; e.activa = true; }
      else e.activa = false;
      break;
    }

    case "rueda":
      e.ang = e.t * 0.032;
      break;
  }
}

function chocaPared(e, nv) {
  const py = Math.floor((e.y - 4) / T);
  return solido(nv, Math.floor((e.x + e.dir * 9) / T), py);
}

// Cajas de colision. La barra de fuego no tiene una: son varias.
export function cajas(e) {
  if (e.tipo === "rueda") {
    const c = [];
    for (let i = 1; i <= e.largo; i++)
      c.push({ x: e.pivote.x + Math.cos(e.ang) * i * 14,
               y: e.pivote.y + Math.sin(e.ang) * i * 14, w: 11, h: 11 });
    return c;
  }
  if (e.tipo === "fauces" && !e.activa) return [];
  if (e.tipo === "brasa" && !e.activa) return [];
  if (e.tipo === "osario" && e.roto > 0) return [];
  return [{ x: e.x, y: e.y - e.h / 2, w: e.w, h: e.h }];
}

/**
 * Resuelve el choque entre el jugador y un enemigo.
 * Devuelve "pisar", "morir" o null. Quien decide es esta funcion y nadie mas.
 */
export function chocar(j, e) {
  for (const c of cajas(e)) {
    if (Math.abs(j.x - c.x) > (F.ANCHO + c.w) / 2) continue;
    const jCy = j.y - F.ALTO / 2;
    if (Math.abs(jCy - c.y) > (F.ALTO + c.h) / 2) continue;
    // Pisa si viene cayendo Y sus pies estan arriba del centro del bicho.
    // Las dos condiciones: solo la primera deja "pisar" a un enemigo que te
    // toco de costado mientras bajabas, que es el reclamo numero uno de
    // cualquier plataformero.
    const cayendo = j.vy > 0.5;
    const arriba = (j.y - c.h * 0.35) < c.y;
    if (e.pisable && cayendo && arriba) return "pisar";
    return "morir";
  }
  return null;
}

// Que pasa cuando lo pisan. Devuelve cuantas monedas suelta.
export function pisado(e, j, nuevos) {
  switch (e.tipo) {
    case "caracol":
      if (!e.caparazon) { e.caparazon = true; e.h = 13; e.empujado = false; }
      else { e.empujado = true; e.dir = j.x < e.x ? 1 : -1; }
      return 1;
    case "aleta":
      if (e.alas) { e.alas = false; e.tipo = "caracol"; e.vel = 0.5; e.caparazon = false; return 1; }
      e.vivo = false; return 1;
    case "osario":
      // No muere: se desarma y se rearma. Es la broma del original y sirve
      // como obstaculo que vuelve.
      e.roto = 220; e.pisable = false; return 1;
    case "torrepua":
      if (--e.segmentos <= 0) e.vivo = false;
      return 1;
    default:
      e.vivo = false; return 1;
  }
}

// El caparazon empujado contra otro enemigo.
export function barrer(shell, lista) {
  let cuenta = 0;
  for (const o of lista) {
    if (o === shell || !o.vivo || !o.letal) continue;
    if (Math.abs(o.x - shell.x) < 14 && Math.abs(o.y - shell.y) < 18) {
      if (o.tipo === "torrepua") { o.segmentos = 0; o.vivo = false; }
      else o.vivo = false;
      cuenta++;
    }
  }
  return cuenta;
}
