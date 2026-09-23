/* kuntur/js/niveles.js — cada capítulo: su mapa, su lugar, quién aparece y
   qué pasa en cada disparo. Es puro (lo usan también las pruebas en Node). */
import { MAPAS } from './mapas.js';

/* las vigas y el túnel del Tren a las Nubes: pasan a la velocidad del tren */
const vigas = [];
for (const x of [34, 74, 118, 152, 268, 300]) vigas.push({ x, tipo: 'baja', y: 7.0 });
for (let x = 196; x <= 230; x += 1) vigas.push({ x, tipo: 'baja', y: 7.0, tunel: true });

export const NIVELES = [
  { id: 'prologo', bioma: 'prologo', mapa: MAPAS.prologo, npcs: ['abuela'], disparos: ['afuera', 'corral', 'pichon'], habil: {}, apu: 'nada' },
  { id: 'colores', bioma: 'colores', mapa: MAPAS.colores, npcs: ['rosa'], disparos: ['piedra', 'mirador', 'cuesta'], habil: {}, apu: 'bulto', edad: 0 },
  {
    id: 'salinas', bioma: 'salinas', mapa: MAPAS.salinas, npcs: ['ceferino'], disparos: ['aleteo', 'estacion'], habil: {}, apu: 'bulto', edad: 0.15, da: { aleteo: { aleteo: true } },
    vientos: [
      { x0: 26, x1: 70, y0: 0, y1: 12, dir: -1, fuerza: 55, periodo: 4.2, activa: 0.45, fase: 0 },
      { x0: 142, x1: 178, y0: 0, y1: 12, dir: 1, fuerza: 50, periodo: 3.6, activa: 0.5, fase: 1.2 },
    ],
  },
  { id: 'tren', bioma: 'tren', mapa: MAPAS.tren, npcs: ['tomas'], disparos: ['arranca', 'viaducto', 'tunel', 'tomas'], habil: { aleteo: true }, apu: 'sigue', edad: 0.4,
    tren: { vel: 8, largo: 320, desde: -60, vigas } },
  { id: 'puna', bioma: 'puna', mapa: MAPAS.puna, npcs: ['coquena'], disparos: ['planeo', 'llamar', 'puma', 'coquena'], habil: { aleteo: true }, apu: 'sigue', edad: 0.65, da: { planeo: { planeo: true }, llamar: { llamar: true } },
    persecuciones: [{ desde: 'puma', tipo: 'puma', vel: 4.5, ventaja: 9, hasta: 191 }] },
  { id: 'nevado', bioma: 'nevado', mapa: MAPAS.nevado, npcs: [], disparos: ['tormenta', 'cumbre'], habil: { aleteo: true, planeo: true, llamar: true }, apu: 'sigue', edad: 0.9,
    persecuciones: [{ desde: 'tormenta', tipo: 'tormenta', vel: 3.8, ventaja: 11, hasta: 99 }] },
  { id: 'epilogo', bioma: 'epilogo', mapa: MAPAS.epilogo, npcs: ['abuela'], disparos: ['casa'], habil: {}, apu: 'nada', edad: 1 },
  { id: 'portada', bioma: 'portada', mapa: MAPAS.portada, npcs: [], disparos: [], habil: {}, apu: 'nada', edad: 0.9 },
];
export const NIVEL = Object.fromEntries(NIVELES.map((n) => [n.id, n]));
