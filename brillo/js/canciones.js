/* ============================================================================
   brillo/js/canciones.js — registra en el sonido las canciones grabadas que
   eligió quien pide (24/09). Vienen de 'canciones-datos', un módulo que arma
   herramientas/armar.mjs con musica/canciones.json y los MP3 que haya: en el
   brillo.html del repo no hay ninguna (son de otros y el repo es público), en
   brillo-con-canciones.html están todas.
   Para sumar una alcanza con herramientas/canciones.py: el tema es el nombre
   que ya usa el juego ('titulo' = el menú, 'colina' = el mundo 1, 'arrecife'…).
   ========================================================================== */
import { Sonido } from './sonido.js';
import CANCIONES from 'canciones-datos';

for (const [tema, c] of Object.entries(CANCIONES)) Sonido.registrar(tema, c);
