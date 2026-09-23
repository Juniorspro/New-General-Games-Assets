/* ============================================================================
   remotion/src/Portada.jsx — la tapa del tráiler: miniatura de YouTube
   (1280×720) y portada de TikTok/Reels (1080×1920). Un cuadro del juego de
   fondo, el logo de vidrio, el lema y "gratis". Se saca como PNG con
   `remotion still` (grabar.mjs video lo hace solo).
   ========================================================================== */
import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { TRAILER } from '../../textos.js';
import { Banda, BurbujasSuben, Destello, En, Pastilla, Velo, Vidrio } from './aero.jsx';

/* de qué toma y en qué cuadro sale el fondo */
export const FONDO_PORTADA = { toma: 'rasgo0', cuadro: 40 };

export function Portada({ idioma }) {
  const { width: W, height: H } = useVideoConfig();
  const vertical = H > W, TT = TRAILER[idioma];
  const u = Math.min(W, H) / 1080;
  const src = staticFile(`tomas/comun/${FONDO_PORTADA.toma}.webm`);
  /* la toma sigue a Nick (queda en el medio del cuadro): se agranda y se corre para que Nick salga
     grande. Horizontal: Nick a la derecha y el logo a la izquierda; vertical: Nick debajo del lema */
  const s = vertical ? 3 : 2 * (W / 1920);
  const nx = vertical ? 0.5 : 0.75, ny = vertical ? 0.8 : 0.58;   // dónde caen los pies de Nick
  const left = W * nx - 960 * s, top = H * ny - 540 * s;
  const x = vertical ? W / 2 : W * 0.36, y = H * (vertical ? 0.2 : 0.3), tam = (vertical ? 230 : 210) * u;
  return (
    <AbsoluteFill style={{ background: '#1a86de', overflow: 'hidden' }}>
      <Sequence from={-FONDO_PORTADA.cuadro} layout="none">
        <div style={{ position: 'absolute', left, top, width: 1920 * s, height: 1080 * s }}>
          <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
        </div>
      </Sequence>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(120,200,255,0.55), rgba(120,200,255,0.1) 45%, rgba(0,40,110,0.35))' }} />
      <Velo W={W} H={H} />
      <BurbujasSuben W={W} H={H} t={4.2} a={0.9} escala={u * 1.2} />
      <div style={{ position: 'absolute', left: x - tam * 3, top: y - tam * 1.6, width: tam * 6, height: tam * 3.2, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.75), rgba(200,240,255,0.3) 45%, rgba(200,240,255,0) 70%)' }} />
      <En x={x} y={y}><Vidrio texto="BRILLO" tam={tam} reflejo /></En>
      <Destello W={W} H={H} x={x + tam * 1.2} y={y - tam * 0.42} s={u} a={0.9} />
      <En x={x} y={y + tam * 1.12}><Banda texto={TT.lema} tam={(vertical ? 60 : 50) * u} peso={800} ancho={vertical ? W - 60 * u : W * 0.62} /></En>
      <En x={x} y={vertical ? H * 0.86 : H * 0.8}><Pastilla alto={(vertical ? 96 : 84) * u} texto={TT.fin1.split('·')[0].trim()} tono="verde" /></En>
    </AbsoluteFill>
  );
}
