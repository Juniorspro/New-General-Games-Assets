/* ============================================================================
   remotion/src/dialogo.jsx — los diálogos de la historia como globos de chat
   grandes. El texto sale del chat del juego, leído cuadro a cuadro por
   tomas.js (se escribe letra por letra como en el juego), con los avatares
   del juego. PLANO habla en gris, con letra de máquina y temblando.
   ========================================================================== */
import React from 'react';
import { SANS, MONO, azar, clamp, rebote, sale } from './aero.jsx';
import { PX, Puntitos } from './pixel.jsx';

const ESTILO = {
  plano: { fondo: 'linear-gradient(180deg, rgba(88,92,99,0.95), rgba(52,55,61,0.96))', nombre: '#cfd3d8', texto: '#f1f2f4', borde: 'rgba(255,255,255,0.35)', letra: MONO },
  nick: { fondo: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(222,242,255,0.96))', nombre: '#1a79d6', texto: '#14263a', borde: 'rgba(255,255,255,0.95)', letra: SANS },
  otro: { fondo: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(255,232,244,0.96))', nombre: '#c2407e', texto: '#2a1624', borde: 'rgba(255,255,255,0.95)', letra: SANS },
};

/* un globo: avatar, nombre y texto. k es la escala de entrada, t el segundo (para temblar y los puntitos) */
export function Globo({ quien, texto, avatar, tipo, k = 1, t = 0, cuadro = 0, escribiendo = false, ancho = 900 }) {
  const E = ESTILO[tipo];
  const tam = tipo === 'plano' ? 44 : 50;
  const tiembla = tipo === 'plano' ? Math.round((azar(Math.floor(cuadro / 2), 4) - 0.5) * 2) * PX : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, width: ancho, transform: `translateX(${tiembla}px) scale(${k})`, transformOrigin: '12% 100%' }}>
      {avatar ? <img src={avatar} style={{ width: 132, height: 132, flex: 'none', imageRendering: 'pixelated', borderRadius: 22, filter: tipo === 'plano' ? 'grayscale(1)' : 'none',
        background: tipo === 'plano' ? 'linear-gradient(#b9bec4,#80868d)' : 'linear-gradient(#ffffff,#d7f0ff)', boxShadow: '0 0 0 4px rgba(255,255,255,0.95), 0 0 0 8px rgba(20,90,170,0.45), 0 12px 30px rgba(0,30,80,0.45)' }} /> : <div style={{ width: 132, flex: 'none' }} />}
      <div style={{ position: 'relative', flex: 1, padding: '22px 32px 28px', borderRadius: 34, borderBottomLeftRadius: 8, background: E.fondo, overflow: 'hidden',
        boxShadow: `0 16px 40px rgba(0,30,80,0.45), inset 0 0 0 3px ${E.borde}` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0))' }} />
        <b style={{ position: 'relative', display: 'block', font: `800 30px ${SANS}`, color: E.nombre, marginBottom: 4 }}>{quien}</b>
        {escribiendo && !texto
          ? <div style={{ position: 'relative', padding: '14px 0 6px' }}><Puntitos t={t} color={E.nombre} /></div>
          : <div style={{ position: 'relative', font: `${tipo === 'plano' ? 700 : 700} ${tam}px ${E.letra}`, lineHeight: 1.22, color: E.texto, minHeight: '1.22em', letterSpacing: tipo === 'plano' ? '0.03em' : 0 }}>{texto}</div>}
      </div>
    </div>
  );
}

/* el chat del juego en este cuadro → el globo de quien está hablando ahora */
export function Dialogo({ chats, i, avatares, t, cuadro, W, y }) {
  const ch = chats && chats[clamp(i, 0, chats.length - 1)];
  if (!ch || ch.sale || ch.ve === false || !ch.lineas.length) return null;
  const l = ch.lineas[ch.lineas.length - 1];
  /* cuándo empezó esta línea (la anterior era la misma si el texto de ahora la continúa): para que el globo entre saltando */
  const misma = (a) => { if (!a || !a.lineas.length) return false; const p = a.lineas[a.lineas.length - 1]; return p.quien === l.quien && l.texto.startsWith(p.texto); };
  let d = 0;
  while (d < 20 && i - d - 1 >= 0 && misma(chats[i - d - 1])) d++;
  const k = 0.7 + 0.3 * rebote(d / 9);
  const tipo = l.plana ? 'plano' : l.mia ? 'nick' : 'otro';
  const quien = l.quien.replace(/\s*(dice|says|diz):?\s*$/i, '');
  return (
    <div style={{ position: 'absolute', left: 50, top: y, transform: 'translateY(-100%)', opacity: sale(d / 4) }}>
      <Globo quien={quien} texto={l.texto} avatar={l.avatar != null ? avatares[l.avatar] : null} tipo={tipo} k={k} t={t} cuadro={cuadro} escribiendo={!!ch.escribe} ancho={W - 150} />
    </div>
  );
}
