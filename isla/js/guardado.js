// Guardar y cargar la isla en localStorage. La isla sale de la semilla, así
// que se guarda solo lo que cambió: la diferencia del terreno contra lo
// generado, qué palmeras y matas ya no están (y las que plantaste), cuántos
// pedazos le quedan a cada roca, los bloques (con lo que hay en los cofres), lo
// tirado en el piso, el inventario, la plata, el peto, cómo va la historia y el
// jugador. Todo lo que viene de afuera se valida: una partida rota no puede
// romper el juego.
import { ITEMS } from './items.js';
import * as THREE from '../vendor/three.module.min.js';

const CLAVE = 'isla_v1', CLAVE_AJUSTES = 'isla_ajustes';
const CERO = new THREE.Matrix4().makeScale(0, 0, 0);

function leer(clave) {
  try { const s = localStorage.getItem(clave); return s ? JSON.parse(s) : null; } catch { return null; }
}
function escribir(clave, dato) {
  try { localStorage.setItem(clave, JSON.stringify(dato)); return true; } catch { return false; }
}
const num = (v, def = 0) => (Number.isFinite(v) ? v : def);

export function hayPartida() { const d = leer(CLAVE); return !!(d && d.v === 1); }
export function leerPartida() { const d = leer(CLAVE); return d && d.v === 1 ? d : null; }
export function borrarPartida() { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } }

export function guardarPartida(J) {
  const M = J.mundo, jp = J.jugador;
  const cocos = {};
  for (const p of M.veg.palmeras) if (p.viva && !p.reserva && p.cocosQuedan !== undefined && p.cocosQuedan < p.cocos) cocos[p.id] = p.cocosQuedan;
  const d = {
    v: 1,
    semilla: M.semilla,
    guardado: Date.now(),
    hora: +J.cielo.hora.toFixed(4),
    dia: J.dia,
    jugador: { p: [jp.p.x, jp.p.y, jp.p.z].map((v) => +v.toFixed(2)), yaw: +jp.yaw.toFixed(3), pitch: +jp.pitch.toFixed(3), vida: Math.round(jp.vida), hambre: Math.round(jp.hambre) },
    sel: J.acciones.sel,
    inv: J.inv.serializar(),
    terreno: M.terreno.diferencias(),
    rocas: M.rocas.estado(),
    rocasMina: J.mina.rocas.estado(),
    palmeras: M.veg.palmeras.filter((p) => !p.viva && !p.reserva).map((p) => p.id),
    plantadas: M.veg.plantadas(),
    cocos,
    arbustos: M.veg.arbustos.filter((a) => !a.viva).map((a) => a.i),
    bloques: J.bloques.serializar(),
    objetos: J.objetos.serializar(),
    descubiertos: [...J.descubiertos],
    stats: J.stats,
    objetivo: J.objetivoI,
    plata: Math.round(J.plata),
    armadura: J.armadura,
    historia: J.historia.serializar(),
    enemigos: J.enemigos.serializar(),
    mercader: J.mercader.serializar(),
    mapa: J.mapa.serializar(),
  };
  return escribir(CLAVE, d);
}

export function aplicarPartida(J, d) {
  if (!d || d.v !== 1) return false;
  const M = J.mundo, V = M.veg;
  if (d.terreno && typeof d.terreno === 'object') M.terreno.aplicarDiferencias(d.terreno);
  if (d.rocas && typeof d.rocas === 'object') M.rocas.aplicarEstado(d.rocas);
  if (d.rocasMina && typeof d.rocasMina === 'object') J.mina.rocas.aplicarEstado(d.rocasMina);
  if (Array.isArray(d.palmeras)) for (const id of d.palmeras) { const p = V.palmeras[id]; if (p && p.viva) V.quitarPalmera(p); }
  if (d.cocos && typeof d.cocos === 'object') {
    for (const [id, q] of Object.entries(d.cocos)) {
      const p = V.palmeras[+id];
      if (!p || !p.viva || !Number.isInteger(q)) continue;
      p.cocosQuedan = Math.max(0, Math.min(p.cocos, q));
      for (let k = p.cocosQuedan; k < p.cocos; k++) V.cocos.setMatrixAt(p.c0 + k, CERO);
    }
    V.cocos.instanceMatrix.needsUpdate = true;
  }
  if (Array.isArray(d.arbustos)) for (const i of d.arbustos) { const a = V.arbustos[i]; if (a && a.viva) V.quitarArbusto(a); }
  // las plantadas, después del terreno: se paran a la altura que quedó
  if (Array.isArray(d.plantadas)) for (const q of d.plantadas) {
    if (!Array.isArray(q) || !q.slice(0, 3).every(Number.isFinite) || Math.abs(q[0]) > 128 || Math.abs(q[1]) > 128) continue;
    V.plantar(q[0], M.terreno.altura(q[0], q[1]), q[1], q[2]);
  }
  J.bloques.cargar(d.bloques);
  J.objetos.cargar(d.objetos);
  J.inv.cargar(d.inv);
  const j = d.jugador || {};
  if (Array.isArray(j.p) && j.p.length === 3 && j.p.every(Number.isFinite)) {
    J.jugador.p.set(...j.p);
    J.jugador.yaw = num(j.yaw); J.jugador.pitch = Math.max(-1.5, Math.min(1.5, num(j.pitch)));
  }
  J.jugador.vida = Math.max(10, Math.min(100, num(j.vida, 100)));
  J.jugador.hambre = Math.max(0, Math.min(100, num(j.hambre, 100)));
  J.acciones.sel = Number.isInteger(d.sel) ? ((d.sel % 9) + 9) % 9 : 0;
  J.cielo.hora = ((num(d.hora, 0.34) % 1) + 1) % 1;
  J.dia = Math.max(1, Math.floor(num(d.dia, 1)));
  if (Array.isArray(d.descubiertos)) for (const id of d.descubiertos) if (ITEMS[id]) J.descubiertos.add(id);
  if (d.stats && typeof d.stats === 'object') for (const [k, v] of Object.entries(d.stats)) if (Number.isFinite(v)) J.stats[k] = v;
  // una partida de antes de la historia: los objetivos se revisan desde el principio
  J.objetivoI = d.historia && Number.isInteger(d.objetivo) ? Math.max(0, d.objetivo) : 0;
  J.plata = Math.max(0, num(d.plata));
  J.armadura = typeof d.armadura === 'string' && ITEMS[d.armadura] && ITEMS[d.armadura].defensa ? d.armadura : null;
  J.historia.cargar(d.historia);
  J.enemigos.cargar(d.enemigos);
  J.mercader.cargar(d.mercader);
  J.mapa.cargar(d.mapa);
  M.pasto.todo();
  return true;
}

// ── ajustes: aparte de la partida (borrar la isla no borra el volumen) ─────
export const AJUSTES_BASE = { musica: 0.5, efectos: 0.8, ambiente: 0.6, sens: 1, calidad: 1, pixel: 0, idioma: '' };

// El segundo valor dice si ya había ajustes guardados (si no, el juego elige
// según el aparato: en un teléfono arranca en calidad baja).
export function leerAjustes() {
  const a = { ...AJUSTES_BASE };
  const d = leer(CLAVE_AJUSTES);
  if (d && typeof d === 'object') for (const k of Object.keys(a)) if (Number.isFinite(d[k]) && typeof a[k] === 'number') a[k] = d[k];
  if (d && typeof d.idioma === 'string' && /^(es|en|pt)$/.test(d.idioma)) a.idioma = d.idioma;
  a.calidad = Math.max(0, Math.min(2, Math.round(a.calidad)));
  a.pixel = Math.max(0, Math.min(6, Math.round(a.pixel)));
  return [a, !!d];
}
export function guardarAjustes(a) {
  const d = {};
  for (const k of Object.keys(AJUSTES_BASE)) d[k] = a[k];
  return escribir(CLAVE_AJUSTES, d);
}
