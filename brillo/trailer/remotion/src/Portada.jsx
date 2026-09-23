/* ============================================================================
   remotion/src/Portada.jsx — la tapa del tráiler en TikTok (1080×1920): un
   cuadro del juego con Nick grande (×2 sin suavizar, 12 px por píxel del
   juego), el logo de vidrio, el lema y "jugalo gratis". Se saca como PNG con
   `remotion still` (grabar.mjs video lo hace solo).
   ========================================================================== */
import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { TRAILER } from '../../textos.js';
import { Banda, BurbujasSuben, Destello, En, Pastilla, Velo, Vidrio, clamp } from './aero.jsx';
import { Titilan } from './pixel.jsx';
import { ZONA } from './carteles.jsx';

/* de qué toma y en qué cuadro sale el fondo */
export const FONDO_PORTADA = { toma: 'colina', cuadro: 40 };

export function Portada({ idioma, comun }) {
  const { width: W, height: H } = useVideoConfig();
  const TT = TRAILER[idioma];
  const src = staticFile(`tomas/comun/${FONDO_PORTADA.toma}.webm`);
  /* Nick al doble, con los pies cerca de 1350 */
  const p = (comun.pos[FONDO_PORTADA.toma] || [])[FONDO_PORTADA.cuadro]?.nick || [W / 2, H / 2];
  const z = 2, tx = clamp(ZONA.x - p[0] * z, W - W * z, 0), ty = clamp(1300 - p[1] * z, H - H * z, 0);
  const y = 520, tam = 230;
  return (
    <AbsoluteFill style={{ background: '#1a86de', overflow: 'hidden' }}>
      <Sequence from={-FONDO_PORTADA.cuadro} layout="none">
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
          <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
        </div>
      </Sequence>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(120,200,255,0.55), rgba(120,200,255,0.05) 45%, rgba(0,40,110,0.3))' }} />
      <Velo W={W} H={H} />
      <BurbujasSuben W={W} H={H} t={4.2} a={0.9} escala={1.3} />
      <div style={{ position: 'absolute', left: ZONA.x - tam * 2.6, top: y - tam * 1.4, width: tam * 5.2, height: tam * 2.8, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.75), rgba(200,240,255,0.3) 45%, rgba(200,240,255,0) 70%)' }} />
      <En x={ZONA.x} y={y}><Vidrio texto="BRILLO" tam={tam} reflejo /></En>
      <Destello W={W} H={H} x={ZONA.x + 320} y={y - tam * 0.42} s={1} a={0.9} />
      <Titilan W={W} H={H} t={1.3} zona={{ x: 60, y: y - 240, w: 860, h: 400 }} />
      <En x={ZONA.x} y={y + tam * 1.2}><Banda texto={TT.lema} tam={60} peso={800} ancho={900} /></En>
      <En x={ZONA.x} y={1480}><Pastilla alto={120} texto={TT.jugalo} tono="verde" /></En>
    </AbsoluteFill>
  );
}
