/* la portada del tráiler (la foto que TikTok muestra antes de darle play): la plaza y el logo */
import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';
import { LETRA, C, lleno, Logo, Tarjeta, Boton, Burbujas } from './kit.jsx';

export const Portada = () => (
  <AbsoluteFill style={{ background: '#bfe6ff' }}>
    <OffthreadVideo src={staticFile('tomas/dron.mp4')} startFrom={250} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    <div style={{ ...lleno, background: 'linear-gradient(180deg, rgba(236,239,242,0) 20%, rgba(236,239,242,0.75) 38%, rgba(236,239,242,0.75) 58%, rgba(236,239,242,0) 75%)' }} />
    <Burbujas f={60} n={12} semilla={21} alfa={0.8} />
    <div style={{ position: 'absolute', left: 0, width: 1080, top: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34 }}>
      <Logo f={40} tam={128} brillo={false} />
      <Tarjeta style={{ padding: '16px 34px', fontSize: 42 }}>la plaza Frutiger Aero para jugar con amigos</Tarjeta>
      <Boton f={0} txt="¡Jugá gratis!" />
    </div>
  </AbsoluteFill>
);
