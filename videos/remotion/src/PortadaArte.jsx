/* ============================================================================
   videos/remotion/src/PortadaArte.jsx — la miniatura con arte de Rezona
   (medios/rezona/<juego>-arte-g1.png, 768×1376, pintado sin letras y con el
   tercio de arriba libre). Acá va encima lo que el generador no sabe hacer:
   el título gordo de 3-5 palabras, legible en chiquito, y el nombre del juego.
   ========================================================================== */
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Grueso, LETRA } from './kit.jsx';

const P = {
  'luz-mala': { arte: 'luz-mala-arte-g1.png', arriba: 'HICE UN JUEGO', grande: 'DEL CHACO 🔥', color: '#ffd35a', borde: '#1b1206', brillo: '#ff9d2e',
    velo: 'rgba(10,6,18,0.75)', nombre: 'LUZ MALA', pie: 'gratis en el celu', pill: '#ffd35a', tinta: '#1b1206' },
  kuntur: { arte: 'kuntur-arte-g1.png', arriba: 'HICE UN', grande: 'PAPER MARIO', abajo: 'EN JUJUY 🦙', color: '#ffd23f', borde: '#3a0f1a', brillo: '#e8364f',
    velo: 'rgba(40,20,30,0.45)', nombre: 'KUNTUR', pie: 'gratis en el celu', pill: '#e8364f', tinta: '#fff' },
  brillo: { arte: 'brillo-arte-g1.png', arriba: 'HICE UN JUEGO', grande: 'FRUTIGER AERO', color: '#ffffff', borde: '#0a3d7a', brillo: '#3fd2ff',
    velo: 'rgba(8,60,120,0.35)', nombre: 'BRILLO', pie: 'gratis en el celu', pill: '#7ddc3a', tinta: '#0a3d1a' },
};

export function PortadaArte({ id }) {
  const M = P[id];
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Img src={staticFile(`rezona/${M.arte}`)} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1935, objectFit: 'cover' }} />
      {/* velo arriba (para el título) y abajo (para el nombre), sin tocar al personaje del medio */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${M.velo} 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 72%, rgba(0,0,0,0.55) 100%)` }} />

      <div style={{ position: 'absolute', left: 0, top: 150, width: 1080, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <Grueso texto={M.arriba} tam={98} color="#fff" borde={M.borde} style={{ transform: 'rotate(-2deg)' }} />
        <Grueso texto={M.grande} tam={M.grande.length >= 11 ? 116 : 150} color={M.color} borde={M.borde}
          style={{ transform: 'rotate(-2deg)', marginTop: 4, filter: `drop-shadow(0 0 26px ${M.brillo})` }} />
        {M.abajo && <Grueso texto={M.abajo} tam={112} color="#fff" borde={M.borde} style={{ transform: 'rotate(-2deg)', marginTop: 4 }} />}
        {M.emoji && <span style={{ font: `900 110px ${LETRA}`, marginTop: 4, filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.35))' }}>{M.emoji}</span>}
      </div>

      {/* el nombre del juego, abajo en el centro */}
      <div style={{ position: 'absolute', left: 540, top: 1745, transform: 'translate(-50%, -50%) rotate(-2deg)', display: 'flex', alignItems: 'center', gap: 18, padding: '14px 38px',
        borderRadius: 999, background: M.pill, border: `7px solid ${M.borde}`, boxShadow: `0 12px 0 ${M.borde}, 0 24px 40px rgba(0,0,0,0.45)`, whiteSpace: 'nowrap' }}>
        <span style={{ font: `900 66px ${LETRA}`, color: M.tinta, letterSpacing: 4 }}>{M.nombre}</span>
        <span style={{ font: `800 36px ${LETRA}`, color: M.tinta, opacity: 0.85 }}>· {M.pie}</span>
      </div>
    </AbsoluteFill>
  );
}
