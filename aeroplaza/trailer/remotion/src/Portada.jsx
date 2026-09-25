/* la portada del tráiler: el muñeco adentro de una burbuja de jabón grande y otras cuatro burbujas con
   escenas del juego, el logo y el botón. Todo lo importante va en una caja de 1080×1440 (el 3:4 de la grilla
   de TikTok); en 9:16 la misma caja queda centrada y el fondo llena el resto, así el recorte no corta nada */
import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import { LETRA, C, lleno, Logo, Tarjeta, Boton, Burbujas } from './kit.jsx';

/* una escena adentro de una burbuja: el cuadro `cuadro` de la toma, con el punto (cx, cy) al centro */
function Bola({ toma, cuadro, x, y, d, escala, cx = 0.5, cy = 0.5 }) {
  const w = 1080 * escala, h = 1920 * escala;
  return (
    <div style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', boxShadow: `0 ${d * 0.04}px ${d * 0.1}px rgba(20,70,130,0.4)` }}>
        <OffthreadVideo src={staticFile(`tomas/${toma}.mp4`)} startFrom={cuadro} muted style={{ position: 'absolute', width: w, height: h, maxWidth: 'none', left: d / 2 - cx * w, top: d / 2 - cy * h }} />
        {/* el borde tornasolado y el reflejo de la ventana, como las burbujas del juego */}
        <div style={{ ...lleno, borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, transparent 64%, rgba(190,235,255,0.22) 77%, rgba(255,190,240,0.38) 89%, rgba(255,255,255,0.85) 100%)' }} />
        <div style={{ position: 'absolute', left: d * 0.13, top: d * 0.07, width: d * 0.42, height: d * 0.22, borderRadius: '50%', transform: 'rotate(-30deg)',
          background: 'radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.8), rgba(255,255,255,0.25) 45%, rgba(255,255,255,0) 72%)' }} />
        <div style={{ position: 'absolute', right: d * 0.16, bottom: d * 0.1, width: d * 0.1, height: d * 0.1, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.7), rgba(255,255,255,0) 70%)' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${Math.max(5, d * 0.012)}px solid rgba(255,255,255,0.92)` }} />
    </div>
  );
}

/* la etiqueta redonda de precio, rosa y torcida */
const Gratis = ({ x, y, d = 180 }) => (
  <div style={{ position: 'absolute', left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: '50%', transform: 'rotate(-12deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: `linear-gradient(180deg, #ffffff66 0%, #ffffff18 46%, transparent 50%), radial-gradient(circle at 40% 30%, #ff9fcb, ${C.rosa} 60%, #e2458e)`, border: '7px solid #fff',
    boxShadow: '0 10px 0 rgba(0,0,0,0.1), 0 18px 40px rgba(226,69,142,0.5)', fontFamily: LETRA, fontWeight: 900, fontSize: d * 0.21, color: '#fff', textShadow: '0 3px 0 rgba(0,0,0,0.18)', letterSpacing: '0.01em' }}>
    GRATIS
  </div>
);

export const Portada = () => {
  const { height } = useVideoConfig(), oy = (height - 1440) / 2;
  return (
    <AbsoluteFill style={{ background: '#bfe6ff', overflow: 'hidden' }}>
      {/* el fondo: la plaza desde el dron (arcoíris, pecera y torres), apenas desenfocada */}
      <OffthreadVideo src={staticFile('tomas/dron.mp4')} startFrom={200} muted style={{ position: 'absolute', left: -30, top: -30, width: 1140, height: height + 60, objectFit: 'cover', filter: 'blur(5px) saturate(1.15)' }} />
      <div style={{ ...lleno, background: 'linear-gradient(180deg, rgba(240,248,255,0.9) 0%, rgba(240,248,255,0.45) 26%, rgba(240,248,255,0.12) 55%, rgba(220,245,255,0.55) 100%)' }} />
      <Burbujas f={40} n={14} semilla={33} alfa={0.75} />
      <div style={{ position: 'absolute', left: 0, top: oy, width: 1080, height: 1440 }}>
        <div style={{ position: 'absolute', left: 0, width: 1080, top: 58, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <Tarjeta style={{ padding: '10px 34px', fontSize: 40, letterSpacing: '0.08em', color: C.azul2 }}>UN JUEGO FRUTIGER AERO</Tarjeta>
          <Logo f={40} tam={146} brillo={false} />
        </div>
        <Bola toma="hongos" cuadro={12} x={165} y={560} d={250} escala={0.3} cx={0.5} cy={0.53} />
        <Bola toma="aurora" cuadro={20} x={150} y={930} d={250} escala={0.25} cx={0.36} cy={0.64} />
        <Bola toma="muneco" cuadro={50} x={540} y={735} d={720} escala={0.69} cx={0.495} cy={0.49} />
        <Bola toma="aqua" cuadro={30} x={925} y={590} d={250} escala={0.32} cx={0.68} cy={0.6} />
        <Bola toma="runner" cuadro={290} x={935} y={960} d={250} escala={0.3} cx={0.5} cy={0.52} />
        <div style={{ position: 'absolute', left: 0, width: 1080, top: 1170, display: 'flex', justifyContent: 'center' }}>
          <Boton f={0} txt="¡Jugá con amigos!" />
        </div>
        <Gratis x={905} y={1160} />
      </div>
    </AbsoluteFill>
  );
};
