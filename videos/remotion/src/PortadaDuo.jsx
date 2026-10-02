/* ============================================================================
   videos/remotion/src/PortadaDuo.jsx — la miniatura de cada video dúo
   (1080×1920). Lo importante va en el centro 3:4 (y 240…1680), que es lo que
   se ve en la grilla del perfil: "2 JUEGOS" con la frase del gancho, las dos
   capturas en tarjetas ladeadas con su número y su nombre, el sello "¿1 o 2?"
   y el narrador. Las capturas salen directo de las tomas (un cuadro).
   ========================================================================== */
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Grueso, LETRA } from './kit.jsx';
import { DUOS } from './duos.js';
import { PD, foto } from './portadasDuo.js';

/* un cuadro de una toma, recortado y acercado: sale de salida/publico/fotos/, que llena
   videos/portadas-duo.mjs con ffmpeg (OffthreadVideo en un Still salta al cuadro clave más
   cercano: el atún que salta del agua no salía nunca) */
const Cuadro = ({ toma, seg, pos = '50% 50%', zoom = 1, style }) => (
  <Img src={staticFile(`fotos/${foto(toma, seg)}`)}
    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, transform: `scale(${zoom})`, transformOrigin: pos, ...style }} />
);

export function PortadaDuo({ id }) {
  const M = DUOS[id], D = PD[id];
  const [K1, K2] = Object.keys(M.juegos), J1 = M.juegos[K1], J2 = M.juegos[K2];
  const carta = (c, J, num, x, y, giro) => (
    <div style={{ position: 'absolute', left: x, top: y, width: 470, height: 836, transform: `rotate(${giro}deg)` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 34, overflow: 'hidden', border: `14px solid ${J.color}`, boxShadow: `0 0 0 7px ${J.tinta}, 0 40px 80px rgba(0,0,0,0.7), 0 0 90px ${J.color}66`, background: '#000' }}>
        <Cuadro toma={c[0]} seg={c[1]} pos={c[2]} zoom={c[3]} />
      </div>
      {/* el número, en la esquina */}
      <div style={{ position: 'absolute', left: -34, top: -40, width: 170, height: 170, borderRadius: '50%', background: J.color, border: `9px solid ${J.tinta}`,
        boxShadow: `0 10px 0 ${J.tinta}, 0 20px 40px rgba(0,0,0,0.5)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ font: `900 118px ${LETRA}`, color: J.tinta, marginTop: -8 }}>{num}</span>
      </div>
      {/* el nombre, pisando el borde de abajo */}
      <div style={{ position: 'absolute', left: '50%', bottom: -46, transform: 'translateX(-50%)', padding: '14px 34px', borderRadius: 999, background: '#fff',
        border: `7px solid ${J.tinta}`, boxShadow: `0 10px 0 ${J.tinta}, 0 20px 36px rgba(0,0,0,0.5)`, whiteSpace: 'nowrap' }}>
        <span style={{ font: `900 ${J.nombre.length > 10 ? 48 : 58}px ${LETRA}`, color: J.tinta }}>{J.nombre}</span>
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {/* el fondo: un juego arriba y el otro abajo, borrosos, partidos en diagonal */}
      <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(0 0, 100% 0, 100% 44%, 0 56%)' }}>
        <Cuadro toma={D.fondo[0][0]} seg={D.fondo[0][1]} style={{ filter: 'blur(16px) brightness(0.5) saturate(1.4)', transform: 'scale(1.1)' }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(0 56%, 100% 44%, 100% 100%, 0 100%)' }}>
        <Cuadro toma={D.fondo[1][0]} seg={D.fondo[1][1]} style={{ filter: 'blur(16px) brightness(0.5) saturate(1.4)', transform: 'scale(1.1)' }} />
      </div>
      <div style={{ position: 'absolute', left: -100, top: 951, width: 1280, height: 18, background: '#fff', transform: 'rotate(-6.4deg)', boxShadow: `0 0 30px ${J1.color}, 0 0 70px ${J2.color}` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.7) 100%)' }} />

      {/* el título: 2 JUEGOS y la frase del gancho */}
      <div style={{ position: 'absolute', left: 0, top: 200, width: 1080, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Grueso texto={M.gancho[0]} tam={Math.min(176, Math.floor(1530 / [...M.gancho[0]].length))} color="#fff" style={{ transform: 'rotate(-3deg)', filter: `drop-shadow(0 0 30px ${J1.color}aa)` }} />
        <div style={{ marginTop: 6, padding: '14px 40px', borderRadius: 999, background: J1.color, border: `7px solid ${J1.tinta}`, transform: 'rotate(-3deg)',
          boxShadow: `0 10px 0 ${J1.tinta}, 0 20px 40px rgba(0,0,0,0.5)`, whiteSpace: 'nowrap' }}>
          <span style={{ font: `900 ${Math.min(76, Math.floor(1300 / [...M.gancho[1]].length))}px ${LETRA}`, color: J1.tinta }}>{M.gancho[1]}</span>
        </div>
      </div>

      {/* las dos capturas */}
      {carta(D.cartas[0], J1, '1', 62, 600, -6)}
      {carta(D.cartas[1], J2, '2', 548, 680, 5)}

      {/* el sello del medio */}
      <div style={{ position: 'absolute', left: 540, top: 1030, transform: 'translate(-50%, -50%) rotate(-12deg)', padding: '10px 36px 16px', borderRadius: 999, background: '#fff', border: `10px solid #111`,
        boxShadow: `0 12px 0 #111, 0 24px 50px rgba(0,0,0,0.6), 0 0 60px ${J2.color}88`, whiteSpace: 'nowrap' }}>
        <span style={{ font: `900 96px ${LETRA}`, color: '#111' }}>¿1 o 2?</span>
      </div>

      {/* la pregunta de abajo y el que cuenta */}
      <div style={{ position: 'absolute', left: 540, top: 1625, transform: 'translate(-50%, -50%) rotate(-2deg)' }}>
        <Grueso texto={D.pie} tam={70} color={J2.color} borde="#0b0b14" />
      </div>
      {/* el narrador se asoma por la esquina de la segunda tarjeta */}
      <Img src={staticFile(`stickers/${D.sticker}.png`)} style={{ position: 'absolute', left: 776, top: 500, width: 320, height: 320, objectFit: 'contain', transform: 'rotate(10deg)', filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.6))' }} />
    </AbsoluteFill>
  );
}
