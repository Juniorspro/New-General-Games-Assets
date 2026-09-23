/* ============================================================================
   remotion/src/chat.jsx — la ventana de chat del juego, dibujada de nuevo más
   grande. tomas.js la leyó del juego cuadro a cuadro (quién habla, qué va
   escrito, los avatares), así acá sale igual que en el juego y en el idioma
   de la versión.
   ========================================================================== */
import React from 'react';
import { SANS, MONO, suave } from './aero.jsx';

/* cuánto hace que está a la vista (para que entre y salga suave como en el juego) */
function presencia(chats, i) {
  let d = 0;
  while (d < 12 && i - d >= 0 && chats[i - d] && chats[i - d].ve && !chats[i - d].sale) d++;
  return d;
}

export function Chat({ chats, i, avatares, vertical, W, H }) {
  const ch = chats && chats[Math.min(i, chats.length - 1)];
  if (!ch || ch.sale || ch.ve === false) return null;
  const k = suave(presencia(chats, i) / 8);
  const Z = vertical ? 1.3 : 1.12;
  const ancho = vertical ? W - 64 : W * 0.4;
  const lineas = ch.lineas.slice(-3);
  const av = (clave) => (clave != null ? avatares[clave] : null);
  const pos = vertical ? { left: (W - ancho) / 2, bottom: 40 } : { right: 56, top: 70 };
  return (
    <div style={{ position: 'absolute', ...pos, width: ancho, borderRadius: 18 * Z, overflow: 'hidden', opacity: k, transform: `translateY(${(1 - k) * 18}px) scale(${0.96 + 0.04 * k})`,
      boxShadow: `0 ${12 * Z}px ${40 * Z}px rgba(0,40,100,0.45), 0 0 0 2px rgba(255,255,255,0.85)` }}>
      {/* la barra de título, azul Aero con el corte de brillo */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 * Z, height: 70 * Z, padding: `0 ${18 * Z}px`,
        background: 'linear-gradient(180deg, #9fe3ff, #52b6ee 48%, #1f86d6 50%, #3fa0e6)', color: '#fff', textShadow: '0 1px 2px rgba(0,40,100,0.8)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.12))' }} />
        {av(ch.avatar) && <img src={av(ch.avatar)} style={{ position: 'relative', width: 52 * Z, height: 52 * Z, imageRendering: 'pixelated', borderRadius: 8 * Z, background: 'linear-gradient(#fff,#d7f0ff)', boxShadow: '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgba(20,90,170,0.5)' }} />}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, lineHeight: 1.15 }}>
          <b style={{ font: `800 ${30 * Z}px ${SANS}` }}>{ch.nombre}</b>
          <small style={{ font: `600 ${20 * Z}px ${SANS}`, opacity: 0.92 }}>{ch.estado}</small>
        </div>
        <div style={{ position: 'relative', width: 42 * Z, height: 26 * Z, borderRadius: 6 * Z, background: 'linear-gradient(#f7b6a8,#e2553a 50%,#c2280f 51%,#e97c5c)', boxShadow: '0 0 0 1px #7a1a08, inset 0 0 0 1px rgba(255,255,255,0.4)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 * Z, padding: `${16 * Z}px ${20 * Z}px ${10 * Z}px`, background: 'linear-gradient(rgba(255,255,255,0.93), rgba(232,247,255,0.93))' }}>
        {lineas.map((l, n) => (
          <div key={n} style={{ display: 'flex', gap: 16 * Z, alignItems: 'flex-start', opacity: n < lineas.length - 1 ? 0.55 : 1 }}>
            {av(l.avatar) ? <img src={av(l.avatar)} style={{ width: 58 * Z, height: 58 * Z, imageRendering: 'pixelated', flex: 'none', filter: l.plana ? 'grayscale(1)' : 'none' }} /> : <div style={{ width: 58 * Z, flex: 'none' }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', font: `700 ${22 * Z}px ${SANS}`, color: l.mia ? '#1a79d6' : l.plana ? '#5b6168' : '#c2407e' }}>{l.quien}</b>
              <p style={{ margin: 0, minHeight: '1.3em', lineHeight: 1.3, color: l.plana ? '#4b5058' : '#1d2b3a',
                font: l.plana ? `700 ${27 * Z}px ${MONO}` : `600 ${30 * Z}px ${SANS}`, letterSpacing: l.plana ? '0.04em' : 0 }}>{l.texto}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ minHeight: 34 * Z, padding: `0 ${22 * Z}px ${8 * Z}px`, font: `italic 600 ${21 * Z}px ${SANS}`, color: '#6a7c94', background: 'rgba(232,247,255,0.93)' }}>{ch.escribe}</div>
    </div>
  );
}
