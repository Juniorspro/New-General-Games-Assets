/* ============================================================================
   videos/remotion/src/Portada.jsx — la miniatura de cada video (1080×1920).
   Lo importante va en el centro 3:4 (y 240…1680), que es lo que se ve en la
   grilla del perfil. Fondo del juego, una captura grande en tarjeta, el
   título gordo, el sticker y los adornos de cada juego. Los cuadros salen de
   las tomas con ffmpeg a medios/portadas/ (ver memoria/videos.md).
   ========================================================================== */
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Grueso, Guardas, LETRA, Luciernagas, Papelitos } from './kit.jsx';

const P = {
  'luz-mala': {
    fondo: 'lm-pueblo.png', fondoPos: '50% 45%', fondoFiltro: 'blur(3px) brightness(0.5) saturate(1.3)', stickerIzq: true,
    tarjeta: 'lm-torito.png', tarjetaPos: '50% 60%', tarjetaZoom: 1.55, tarjetaOrigen: '88% 50%', borde: '#ffd35a',
    color: '#ffd35a', color2: '#ff9d2e', tinta: '#1b1206',
    arriba: 'HICE UN JUEGO', grande: 'DEL CHACO', emoji: '🔥',
    chip: 'la luz mala sos vos', sello: ['PIXEL', 'ART'], pie: '🪕 con chamamé de fondo',
    sticker: 'sorpresa',
  },
  kuntur: {
    fondo: 'ku-colores.png', fondoPos: '55% 50%', fondoFiltro: 'blur(10px) brightness(0.6) saturate(1.3)',
    tarjeta: 'ku-puna.png', tarjetaPos: '46% 42%', tarjetaZoom: 1.85, tarjetaOrigen: '44% 40%', borde: '#fff5e0',
    color: '#ffd23f', color2: '#e8364f', tinta: '#3a0f1a',
    arriba: 'HICE UN', grande: 'PAPER MARIO', abajo: 'EN JUJUY', emoji: '🦙',
    chip: 'un pichón de cóndor y una nena', sello: ['GRA', 'TIS'], pie: '📍 Purmamarca → Nevado de Chañi',
    sticker: 'sorpresa',
  },
};

export function Portada({ id }) {
  const M = P[id];
  const ku = id === 'kuntur';
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {/* el fondo del juego, oscuro, y un viñeteado que lleva la vista al centro */}
      <Img src={staticFile(`portadas/${M.fondo}`)} style={{ position: 'absolute', inset: -40, width: 1160, height: 2000, objectFit: 'cover', objectPosition: M.fondoPos, filter: M.fondoFiltro }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 100%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 62%, ${M.color2}55 0%, rgba(0,0,0,0) 45%)`, mixBlendMode: 'screen' }} />
      {ku ? <Papelitos t={3.3} cuantos={44} /> : <Luciernagas t={4.2} cuantas={40} />}

      {/* la captura chica de atrás (KUNTUR: Purmamarca) */}
      {M.chica && (
        <div style={{ position: 'absolute', left: 40, top: 1210, width: 440, height: 250, transform: 'rotate(-6deg)', border: '12px solid #fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 26px 50px rgba(0,0,0,0.6)' }}>
          <Img src={staticFile(`portadas/${M.chica}`)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: M.chicaPos, transform: 'scale(1.5)' }} />
        </div>
      )}

      {/* la captura grande, en tarjeta ladeada */}
      <div style={{ position: 'absolute', left: 60, top: ku ? 800 : 780, width: 960, height: ku ? 560 : 640, transform: 'rotate(-3deg)', borderRadius: 22, overflow: 'hidden',
        border: `14px solid ${M.borde}`, boxShadow: `0 0 0 6px ${M.tinta}, 0 34px 70px rgba(0,0,0,0.7), 0 0 90px ${M.color2}88` }}>
        <Img src={staticFile(`portadas/${M.tarjeta}`)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: M.tarjetaPos, transform: `scale(${M.tarjetaZoom})`, transformOrigin: M.tarjetaOrigen || M.tarjetaPos, imageRendering: ku ? 'auto' : 'pixelated' }} />
      </div>

      {/* el sello redondo */}
      <div style={{ position: 'absolute', left: M.stickerIzq ? 846 : 24, top: ku ? 700 : 680, width: 210, height: 210, borderRadius: '50%', background: M.color2, border: `8px solid ${M.tinta}`, transform: 'rotate(-14deg)',
        boxShadow: `0 12px 0 ${M.tinta}, 0 20px 40px rgba(0,0,0,0.5)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 0.95 }}>
        {M.sello.map((s, i) => <span key={i} style={{ font: `900 64px ${LETRA}`, color: '#fff', textShadow: `0 4px 0 ${M.tinta}` }}>{s}</span>)}
      </div>

      {/* el título */}
      <div style={{ position: 'absolute', left: 0, top: ku ? 215 : 250, width: 1080, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Grueso texto={M.arriba} tam={ku ? 100 : 104} color="#fff" style={{ transform: 'rotate(-3deg)' }} />
        <Grueso texto={M.grande} tam={ku ? 128 : 150} color={M.color} style={{ transform: 'rotate(-3deg)', filter: `drop-shadow(0 0 30px ${M.color2})` }} />
        {M.abajo && <Grueso texto={`${M.abajo} ${M.emoji}`} tam={116} color="#fff" style={{ transform: 'rotate(-3deg)' }} />}
        {!M.abajo && <span style={{ font: `900 150px ${LETRA}`, transform: 'rotate(-3deg)', marginTop: -10 }}>{M.emoji}</span>}
      </div>

      {/* la frase en píldora, pisando la tarjeta */}
      <div style={{ position: 'absolute', left: 540, top: ku ? 1500 : 1520, transform: 'translate(-50%, -50%) rotate(-2deg)', padding: '20px 44px', borderRadius: 999, background: '#fff',
        border: `7px solid ${M.tinta}`, boxShadow: `0 12px 0 ${M.tinta}, 0 22px 40px rgba(0,0,0,0.5)`, whiteSpace: 'nowrap' }}>
        <span style={{ font: `900 ${ku ? 58 : 70}px ${LETRA}`, color: M.tinta }}>{M.chip}</span>
      </div>
      <div style={{ position: 'absolute', left: 540, top: ku ? 1625 : 1640, transform: 'translate(-50%, -50%)' }}>
        <Grueso texto={M.pie} tam={ku ? 50 : 58} color="#fff" />
      </div>

      {/* el que cuenta */}
      <Img src={staticFile(`stickers/${M.sticker}.png`)} style={{ position: 'absolute', left: M.stickerIzq ? -10 : 690, top: ku ? 1010 : 1040, width: 400, height: 400, objectFit: 'contain', transform: `rotate(${M.stickerIzq ? -8 : 8}deg)`, filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.6))' }} />
      {ku && <Guardas F={{ y: 170, alto: 1560 }} />}
    </AbsoluteFill>
  );
}
