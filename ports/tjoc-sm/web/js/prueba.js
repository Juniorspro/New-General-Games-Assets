/* Página de prueba: carga un nivel (?n=) con el motor completo y expone window.__tjoc para los tests. */
import { crearJuego } from './juego.js';
const q = new URLSearchParams(location.search);
const logs = [];
const J = await crearJuego({ opciones: { log: (...a) => { logs.push(a.map(String).join(' ').slice(0, 300)); console.warn('[vm]', ...a); } } });
window.__tjoc = { J, logs, listo: false };
if (q.get('i')) J.M.ui.umg.idioma = q.get('i');
await J.M.cargarNivel(q.get('n') || 'SM_Bedroom');
window.__tjoc.listo = true;
addEventListener('keydown', (e) => { const k = { ' ': 'SpaceBar', Escape: 'Escape', Backspace: 'BackSpace', Enter: 'Enter' }[e.key] || e.key.toUpperCase(); J.M.tecla(k, true); });
addEventListener('keyup', (e) => { const k = { ' ': 'SpaceBar', Escape: 'Escape', Backspace: 'BackSpace', Enter: 'Enter' }[e.key] || e.key.toUpperCase(); J.M.tecla(k, false); });
addEventListener('pointerdown', () => { J.M.audio.iniciar(); J.M.tecla('LeftMouseButton', true); });
addEventListener('pointerup', () => { J.M.tecla('LeftMouseButton', false); });
addEventListener('pointermove', (e) => { if (e.buttons) { J.M.ejes.MouseX = (J.M.ejes.MouseX || 0) + e.movementX * 0.07; J.M.ejes.MouseY = (J.M.ejes.MouseY || 0) - e.movementY * 0.07; } });
