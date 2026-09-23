/* kuntur/js/main.js — la entrada: el juego, o las pruebas si se piden. */
import { Director } from './director.js';
import { probarEscena } from './prueba-escena.js';
import { probarSprites } from './prueba-sprites.js';
import { NIVEL } from './niveles.js';

const q = new URLSearchParams(location.search);
if (q.get('prueba') === 'sprites') probarSprites();
else if (q.get('prueba') === 'escena') { const n = NIVEL[q.get('nivel') || 'colores']; probarEscena(n, q.get('bio') || n.bioma); }
else new Director();
