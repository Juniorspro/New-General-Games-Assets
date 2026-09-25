/* ============================================================================
   aeroplaza/js/timbres.js — los sonidos de los avisos, a la manera de los de
   Windows 7 (hechos acá con osciladores: no se usa ningún archivo de Windows).
   Son campanitas de vidrio: una nota senoidal con un parcial inarmónico
   (×2,76, como una campana chica) y un eco corto que hace de sala.
   - 'info'  → "Notify": dos notas que suben (si5 → mi6).
   - 'bien'  → tres notas que suben (do6, mi6, sol6), más brillante.
   - 'zona'  → "Balloon": un blip que sube y un acorde que queda flotando.
   - 'error' → "Critical stop": dos notas graves que bajan.
   Van por el bus de efectos de BRILLO (respetan su volumen) y a lo sumo uno
   cada 0,35 s: si un aviso llega junto a su sonido de juego, no se duplica.
   ========================================================================== */
import { Sonido } from '../../brillo/js/sonido.js';

let ult = 0, sala = null;
/* el eco: un retardo con realimentación y un filtro que le saca el brillo */
function eco(c) {
  if (sala && sala.c === c) return sala.entrada;
  const entrada = c.createGain(), seco = c.createGain(), ret = c.createDelay(0.5), fb = c.createGain(), pb = c.createBiquadFilter(), mojado = c.createGain();
  ret.delayTime.value = 0.11; fb.gain.value = 0.32; pb.type = 'lowpass'; pb.frequency.value = 3200; mojado.gain.value = 0.3; seco.gain.value = 1;
  entrada.connect(seco); entrada.connect(ret); ret.connect(pb); pb.connect(fb); fb.connect(ret); pb.connect(mojado);
  const salida = Sonido.bEfectos || c.destination;
  seco.connect(salida); mojado.connect(salida);
  sala = { c, entrada };
  return entrada;
}
/* una campanita: f en Hz, t en segundos del contexto */
function nota(c, dest, f, t, dur, vol, forma = 'sine') {
  const g = c.createGain(); g.connect(dest);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const a = c.createOscillator(); a.type = forma; a.frequency.value = f; a.connect(g); a.start(t); a.stop(t + dur + 0.05);
  const gb = c.createGain(); gb.gain.setValueAtTime(vol * 0.22, t); gb.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.35); gb.connect(dest);
  const b = c.createOscillator(); b.frequency.value = f * 2.76; b.connect(gb); b.start(t); b.stop(t + dur);
}
export function timbre(tipo = 'info') {
  const c = Sonido.ctx; if (!c || c.state !== 'running') return false;
  const ahora = performance.now(); if (ahora - ult < 350) return false; ult = ahora;
  const d = eco(c), t = c.currentTime + 0.01;
  if (tipo === 'bien') { nota(c, d, 1046.5, t, 0.5, 0.11); nota(c, d, 1318.5, t + 0.085, 0.5, 0.1); nota(c, d, 1568, t + 0.17, 0.95, 0.11); }
  else if (tipo === 'zona') {
    const g = c.createGain(), o = c.createOscillator(); g.connect(d);
    o.frequency.setValueAtTime(480, t); o.frequency.exponentialRampToValueAtTime(1150, t + 0.07);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); o.start(t); o.stop(t + 0.14);
    nota(c, d, 1318.5, t + 0.08, 1.1, 0.07); nota(c, d, 1975.5, t + 0.1, 1.0, 0.045); nota(c, d, 987.8, t + 0.12, 0.9, 0.05);
  } else if (tipo === 'error') { nota(c, d, 698.5, t, 0.32, 0.12, 'triangle'); nota(c, d, 523.3, t + 0.13, 0.55, 0.12, 'triangle'); }
  else { nota(c, d, 987.8, t, 0.55, 0.1); nota(c, d, 1318.5, t + 0.1, 0.9, 0.1); }
  return true;
}
