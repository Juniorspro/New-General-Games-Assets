/* brillo/js/main.js — la entrada: el juego, o un banco de prueba si se pide. */
import { probarSprites } from './prueba-sprites.js';
import { probarFondo } from './prueba-fondo.js';
import { probarNivel } from './prueba-nivel.js';

const q = new URLSearchParams(location.search);
if (q.get('prueba') === 'sprites') probarSprites();
else if (q.get('prueba') === 'fondo') probarFondo();
else if (q.get('prueba') === 'nivel') probarNivel();
