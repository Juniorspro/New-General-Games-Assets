/* ============================================================================
   remotion/src/carteles.jsx — lo que va encima de cada toma, según el cartel
   de la escena en guion.js: la narración, el chat de la Actualización, el
   logo, la pastilla de cada mundo, los rasgos, la pregunta de PLANO, la
   respuesta de Nick y el cierre. t es el segundo de la escena y d lo que dura.
   ========================================================================== */
import React from 'react';
import { COMPAS } from '../../guion.js';
import { Banda, Burbuja, BurbujasSuben, DefsBurbuja, Destello, En, Pastilla, Vidrio, azar, clamp, rebote, sale, suave, SANS, REDONDA, TONOS } from './aero.jsx';
import { Chat } from './chat.jsx';

const lleno = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };
/* 'narra.colina' → TX.narra.colina */
const leer = (TX, clave) => clave.split('.').reduce((o, k) => (o ? o[k] : null), TX);
/* aparece en a (tarda ea) y se va en b (tarda eb) */
const ventana = (t, a, b, ea = 0.35, eb = 0.3) => suave((t - a) / ea) * (1 - suave((t - b) / eb));

const TONO_MUNDO = { colina: 'verde', arrecife: 'turquesa', ciudad: 'azul', cielo: 'cielo', aurora: 'violeta', plano: 'gris' };

export function Cartel({ E, t, frame, ctx }) {
  const C = E.cartel;
  if (!C) return null;
  const P = { E, t, d: E.largoS, frame, ...ctx };
  switch (C.tipo) {
    case 'narracion': return <Narracion {...P} />;
    case 'chat': return <ChatEscena {...P} />;
    case 'logo': return <Logo {...P} />;
    case 'mundo': return <Mundo {...P} />;
    case 'rasgo': return <Rasgo {...P} />;
    case 'pregunta': return <Pregunta {...P} />;
    case 'respuesta': return <Respuesta {...P} />;
    case 'cierre': return <Cierre {...P} />;
    default: return null;
  }
}

/* ------------------------------------------------------------ la narración del juego */
function Narracion({ E, t, TX, L, W }) {
  return E.cartel.partes.map(([clave, i, a, b], n) => (
    <En key={n} x={W / 2} y={L.abajo} a={suave((t - a) / 0.8) * (1 - suave((t - b) / 0.5))} k={0.97 + 0.03 * sale((t - a) / 0.8)}>
      <Banda texto={leer(TX, clave)[i]} tam={L.vertical ? 46 : 50} ancho={L.vertical ? W - 90 : W * 0.8} />
    </En>
  ));
}

/* ------------------------------------------------------------ la Actualización: el chat del juego */
function ChatEscena({ E, t, frame, TX, L, W, H, datos }) {
  const [clave, i, a, b] = E.cartel.narracion;
  return (
    <>
      <Chat chats={datos.chat[E.id]} i={frame} avatares={datos.avatares} vertical={L.vertical} W={W} H={H} />
      <En x={W / 2} y={L.vertical ? L.arriba - 40 : L.abajo} a={suave((t - a) / 0.4) * (1 - suave((t - b + 0.4) / 0.4))}>
        <Banda texto={leer(TX, clave)[i]} tam={L.vertical ? 46 : 50} ancho={L.vertical ? W - 90 : W * 0.8} />
      </En>
    </>
  );
}

/* ------------------------------------------------------------ el logo */
function Logo({ t, TT, L, W, H }) {
  const tam = L.vertical ? 220 : 250, y = H * (L.vertical ? 0.42 : 0.43), k = rebote(t / 0.7);
  return (
    <>
      <BurbujasSuben W={W} H={H} t={t + 3} a={0.8} />
      {/* un halo claro detrás, para que el logo se lea sobre el cielo */}
      <div style={{ position: 'absolute', left: W / 2 - tam * 3, top: y - tam * 1.6, width: tam * 6, height: tam * 3.2, borderRadius: '50%', opacity: clamp(t / 0.3) * 0.75,
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.7), rgba(200,240,255,0.25) 45%, rgba(200,240,255,0) 70%)' }} />
      <En x={W / 2} y={y} a={clamp(t / 0.25)} k={0.6 + 0.4 * k}><Vidrio texto="BRILLO" tam={tam} reflejo /></En>
      <Destello W={W} H={H} x={W * (0.2 + 0.6 * sale(t / 1.6))} y={y - tam * 0.36} s={1.1} a={1 - suave((t - 1.8) / 1.2)} />
      <En x={W / 2} y={y + tam * 1.12} a={suave((t - COMPAS) / 0.5)} k={0.94 + 0.06 * sale((t - COMPAS) / 0.5)}>
        <Banda texto={TT.lema} tam={52} ancho={W - 80} />
      </En>
    </>
  );
}

/* ------------------------------------------------------------ cada mundo: pastilla con el número y lo que se aprende */
function Mundo({ E, t, d, TX, TT, L, W }) {
  const { mundo, numero } = E.cartel;
  const a = ventana(t, 0, d - 0.35);
  const entra = (1 - sale(t / 0.5)) * 600;
  const pastilla = <Pastilla alto={L.vertical ? 84 : 92} texto={TX.mundos[mundo]} numero={numero} tono={TONO_MUNDO[mundo]} />;
  return (
    <>
      {L.vertical
        ? <En x={W / 2} y={L.arriba} a={a} dx={-entra}>{pastilla}</En>
        : <div style={{ position: 'absolute', left: 80 - entra, top: 64, opacity: a }}>{pastilla}</div>}
      <En x={W / 2} y={L.abajo} a={ventana(t, 0.5, d - 0.4, 0.4)} k={0.96 + 0.04 * sale((t - 0.5) / 0.4)}>
        <Banda texto={TT.aprende[mundo]} tam={44} ancho={L.vertical ? W - 90 : W * 0.8} />
      </En>
    </>
  );
}

/* ------------------------------------------------------------ lo que trae el juego */
function Rasgo({ E, t, d, frame, TT, L, W, H }) {
  const i = E.cartel.i, [titulo, sub] = TT.rasgos[i];
  const a = ventana(t, 0, d - 0.3, 0.3, 0.25);
  const y = L.vertical ? 170 : H * 0.2, k = rebote(t / 0.5);
  const abajo = L.vertical ? L.abajo : H - 170;
  return (
    <>
      {/* 16 bits: unas líneas de tele vieja sobre todo */}
      {i === 2 && <div style={{ ...lleno, opacity: a, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)' }} />}
      {/* el panel de vidrio detrás del título */}
      <div style={{ position: 'absolute', left: 0, top: y - 120, width: W, height: 240, opacity: a * 0.85,
        background: 'linear-gradient(180deg, rgba(255,255,255,0), rgba(230,248,255,0.55) 30%, rgba(210,240,255,0.5) 70%, rgba(255,255,255,0))' }} />
      {i === 3
        ? <Idiomas t={t} a={a} y={y} W={W} L={L} />
        : <En x={W / 2} y={y} a={a} k={k}><Vidrio texto={titulo} tam={(L.vertical ? 88 : 104) * (titulo.length > 20 ? 0.8 : 1)} tono={i === 2 ? 'verde' : 'azul'} /></En>}
      {sub && <En x={W / 2} y={y + (L.vertical ? 118 : 112)} a={a * suave((t - 0.25) / 0.3)}><Banda texto={sub} tam={L.vertical ? 34 : 38} ancho={W - 80} /></En>}
      {i === 0 && <Orbes t={t} a={a} y={abajo} W={W} L={L} />}
      {i === 1 && <Notas t={t} a={a} W={W} H={H} />}
      {i === 2 && <Chip t={t} a={a} y={abajo} W={W} frame={frame} />}
      {i === 4 && <Controles t={t} a={a} y={abajo} W={W} L={L} />}
    </>
  );
}
/* los seis mundos como orbes, uno detrás del otro */
const COLOR_MUNDO = [['#d9ffcf', '#5fcf4f', '#237d22'], ['#d6fffb', '#3fd6cc', '#0f8a88'], ['#e9f9ff', '#5cc4f5', '#1675c9'], ['#ffffff', '#9fd8ff', '#4a8fe0'], ['#f3e8ff', '#b384ff', '#5a2fb8'], ['#f4f5f6', '#a3abb4', '#5b636c']];
function Orbe({ tam, colores, children }) {
  const [c1, c2, c3] = colores;
  return (
    <div style={{ position: 'relative', width: tam, height: tam, borderRadius: '50%', background: `radial-gradient(circle at 50% 70%, ${c2}, ${c3} 75%)`,
      boxShadow: `0 ${tam * 0.08}px ${tam * 0.2}px rgba(0,40,100,0.45), inset 0 0 0 ${Math.max(2, tam * 0.025)}px rgba(255,255,255,0.8)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', left: '14%', top: '5%', width: '72%', height: '46%', borderRadius: '50%', background: `linear-gradient(180deg, rgba(255,255,255,0.95), ${c1}22)` }} />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}
function Orbes({ t, a, y, W, L }) {
  const tam = L.vertical ? 118 : 104, paso = tam * 1.28;
  return COLOR_MUNDO.map((c, n) => {
    const tn = t - 0.3 - n * 0.09;
    return (
      <En key={n} x={W / 2 + (n - 2.5) * paso} y={y} a={a * clamp(tn / 0.15)} k={rebote(tn / 0.45)}>
        <Orbe tam={tam} colores={c}><span style={{ font: `900 ${tam * 0.46}px ${REDONDA}`, color: '#fff', textShadow: '0 2px 3px rgba(0,40,90,0.6)' }}>{n + 1}</span></Orbe>
      </En>
    );
  });
}
/* la música: notas de vidrio que suben */
function Notas({ t, a, W, H }) {
  return Array.from({ length: 10 }, (_, n) => {
    const v = 0.16 + azar(n, 7) * 0.1, fase = azar(n, 8);
    const y = 1.1 - ((fase + t * v) % 1.25), x = 0.06 + azar(n, 9) * 0.88 + Math.sin(t * 1.3 + n) * 0.015;
    if (x > 0.3 && x < 0.7 && y < 0.35) return null;   // que no tapen el título
    return (
      <En key={n} x={x * W} y={y * H} a={a * 0.9 * suave((t - n * 0.05) / 0.3)} k={0.8 + azar(n, 10) * 0.6}>
        <div style={{ transform: `rotate(${Math.sin(t * 2 + n) * 12}deg)` }}><Vidrio texto={n % 3 ? '♪' : '♫'} tam={110} tono={n % 4 === 1 ? 'verde' : 'azul'} /></div>
      </En>
    );
  });
}
/* 16 bits: una pastilla de cuadraditos que parpadea */
function Chip({ t, a, y, W, frame }) {
  const on = Math.floor(frame / 8) % 2 === 0;
  return (
    <En x={W / 2} y={y} a={a * suave((t - 0.35) / 0.2)} k={rebote((t - 0.35) / 0.4)}>
      <div style={{ display: 'flex', gap: 10, padding: '16px 26px', borderRadius: 14, background: 'linear-gradient(180deg, #2b3b2b, #111a11)', boxShadow: '0 8px 26px rgba(0,0,0,0.5), inset 0 0 0 3px rgba(160,255,140,0.6)' }}>
        {Array.from({ length: 16 }, (_, n) => {
          const h = 10 + Math.round(((Math.sin(n * 1.7 + frame * 0.35) + 1) / 2) * 5) * 8;
          return <div key={n} style={{ width: 18, height: 60, display: 'flex', alignItems: 'flex-end' }}><div style={{ width: 18, height: h, background: on || n % 2 ? '#8dff72' : '#4fc43a', boxShadow: '0 0 8px rgba(140,255,110,0.7)' }} /></div>;
        })}
      </div>
    </En>
  );
}
/* los tres idiomas, cada uno en su pastilla */
function Idiomas({ t, a, y, W, L }) {
  const nombres = [['Español', 'azul'], ['English', 'verde'], ['Português', 'turquesa']];
  const alto = L.vertical ? 76 : 96;
  return (
    <En x={W / 2} y={y} a={a}>
      <div style={{ display: 'flex', gap: L.vertical ? 16 : 30 }}>
        {nombres.map(([n, tono], k) => {
          const tn = t - k * 0.12;
          return <div key={n} style={{ opacity: clamp(tn / 0.15), transform: `scale(${rebote(tn / 0.45)})` }}><Pastilla alto={alto} texto={n} tono={tono} /></div>;
        })}
      </div>
    </En>
  );
}
/* los controles: teclado, mando y el celular que se gira */
function Controles({ t, a, y, W, L }) {
  const tam = L.vertical ? 150 : 132, paso = tam * 1.45;
  const giro = 90 * suave((t - 0.9) / 0.5);
  const iconos = [
    <svg key="t" width={tam * 0.62} height={tam * 0.62} viewBox="0 0 60 60">
      {[[21, 6], [4, 30], [21, 30], [38, 30]].map(([x, yy], n) => <g key={n}><rect x={x} y={yy} width="18" height="18" rx="4" fill="#ffffff" stroke="#1a5ea8" strokeWidth="2" />
        <path d={['M30 10 L35 18 L25 18 Z', 'M8 39 L16 34 L16 44 Z', 'M30 44 L35 36 L25 36 Z', 'M52 39 L44 34 L44 44 Z'][n]} fill="#1a86de" /></g>)}
    </svg>,
    <svg key="m" width={tam * 0.7} height={tam * 0.7} viewBox="0 0 60 60">
      <path d="M14 18 H46 C54 18 58 30 57 40 C56 48 49 50 45 44 L40 37 H20 L15 44 C11 50 4 48 3 40 C2 30 6 18 14 18 Z" fill="#ffffff" stroke="#1a5ea8" strokeWidth="2" />
      <path d="M15 25 V35 M10 30 H20" stroke="#1a86de" strokeWidth="4" strokeLinecap="round" />
      <circle cx="42" cy="26" r="3.5" fill="#2c9d38" /><circle cx="48" cy="32" r="3.5" fill="#e2553a" /><circle cx="36" cy="32" r="3.5" fill="#1a86de" /><circle cx="42" cy="38" r="3.5" fill="#f2b705" />
    </svg>,
    <svg key="c" width={tam * 0.7} height={tam * 0.7} viewBox="0 0 60 60" style={{ transform: `rotate(${giro}deg)` }}>
      <rect x="18" y="4" width="24" height="52" rx="5" fill="#ffffff" stroke="#1a5ea8" strokeWidth="2" />
      <rect x="21" y="10" width="18" height="38" rx="2" fill="#9fe3ff" /><circle cx="30" cy="52" r="2" fill="#1a5ea8" />
      <circle cx="30" cy="29" r={5 + 4 * ((t * 1.5) % 1)} fill="none" stroke="#1a86de" strokeWidth="2" opacity={1 - ((t * 1.5) % 1)} />
    </svg>,
  ];
  return iconos.map((ic, n) => {
    const tn = t - 0.3 - n * 0.12;
    return <En key={n} x={W / 2 + (n - 1) * paso} y={y} a={a * clamp(tn / 0.15)} k={rebote(tn / 0.45)}><Orbe tam={tam} colores={['#ffffff', '#bfe9ff', '#3d9be8']}>{ic}</Orbe></En>;
  });
}

/* ------------------------------------------------------------ PLANO pregunta */
function Pregunta({ t, d, frame, TT, L, W }) {
  const glitch = Math.floor(t * 12) % 3 === 0;
  const dx = glitch ? (azar(frame, 3) - 0.5) * 16 : 0;
  return (
    <En x={W / 2} y={L.vertical ? L.arriba - 10 : 1080 * 0.24} a={ventana(t, 0, d - 0.3, 0.3)} dx={dx}>
      <Banda texto={TT.pregunta} tam={L.vertical ? 46 : 58} ancho={W * 0.86} mono glitch={glitch} color="#eef0f3" sombra="rgba(0,0,0,0.9)" peso={700} />
    </En>
  );
}

/* ------------------------------------------------------------ Nick contesta, como en el chat */
function Respuesta({ t, d, TT, L, W, nick }) {
  const a = ventana(t, 0, d - 0.3, 0.4), k = 0.9 + 0.1 * rebote(t / 0.5);
  const tam = L.vertical ? 42 : 48;
  return (
    <En x={W / 2} y={L.abajo - (L.vertical ? 0 : 30)} a={a} k={k}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, maxWidth: L.vertical ? W - 60 : W * 0.78 }}>
        {nick.avatar && <img src={nick.avatar} style={{ width: tam * 2.4, height: tam * 2.4, flex: 'none', imageRendering: 'pixelated', borderRadius: 16, background: 'linear-gradient(#fff,#d7f0ff)', boxShadow: '0 0 0 3px rgba(255,255,255,0.95), 0 0 0 6px rgba(20,90,170,0.5), 0 10px 26px rgba(0,40,100,0.45)' }} />}
        <div style={{ position: 'relative', padding: `${tam * 0.4}px ${tam * 0.7}px ${tam * 0.5}px`, borderRadius: tam * 0.7, borderBottomLeftRadius: 8, overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(222,242,255,0.94))', boxShadow: '0 12px 34px rgba(0,40,100,0.45), inset 0 0 0 2px rgba(255,255,255,0.9)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: '45%', background: 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0))' }} />
          <b style={{ position: 'relative', display: 'block', font: `800 ${tam * 0.62}px ${SANS}`, color: '#1a79d6' }}>{nick.nombre}</b>
          <div style={{ position: 'relative', font: `600 ${tam}px ${SANS}`, lineHeight: 1.3, color: '#1d2b3a' }}>{TT.respuesta}</div>
        </div>
      </div>
    </En>
  );
}

/* ------------------------------------------------------------ el cierre */
function Cierre({ t, TT, L, W, H }) {
  const tam = L.vertical ? 210 : 240, y = H * (L.vertical ? 0.38 : 0.34), k = rebote(t / 0.8);
  const z = y + (L.vertical ? 430 : 360);
  return (
    <>
      <BurbujasSuben W={W} H={H} t={t} a={0.9} />
      <div style={{ position: 'absolute', left: W / 2 - tam * 3, top: y - tam * 1.6, width: tam * 6, height: tam * 3.2, borderRadius: '50%', opacity: clamp(t / 0.4) * 0.6,
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.55), rgba(200,240,255,0.2) 45%, rgba(200,240,255,0) 70%)' }} />
      <En x={W / 2} y={y} a={clamp(t / 0.3)} k={0.7 + 0.3 * k}><Vidrio texto="BRILLO" tam={tam} reflejo /></En>
      <Destello W={W} H={H} x={W * 0.72} y={y - tam * 0.45} s={0.9} a={suave(t / 0.6) * 0.8} />
      <En x={W / 2} y={y + tam * 1.12} a={suave((t - 0.9) / 0.5)} k={0.94 + 0.06 * sale((t - 0.9) / 0.5)}><Banda texto={TT.lema} tam={56} peso={800} ancho={W - 80} /></En>
      <En x={W / 2} y={z} a={suave((t - 1.8) / 0.5)} k={0.9 + 0.1 * rebote((t - 1.8) / 0.5)}><Pastilla alto={L.vertical ? 76 : 84} texto={TT.fin1} tono="verde" /></En>
      <En x={W / 2} y={z + (L.vertical ? 170 : 110)} a={suave((t - 2.4) / 0.5)}>
        <div style={{ font: `700 ${L.vertical ? 32 : 34}px ${SANS}`, color: '#fff', textAlign: 'center', lineHeight: 1.5, textShadow: '0 0 16px rgba(0,50,110,0.9), 0 2px 4px rgba(0,30,80,0.8)', whiteSpace: 'nowrap' }}>
          {TT.fin2}{L.vertical ? <br /> : '  ·  '}Español · English · Português
        </div>
      </En>
    </>
  );
}

/* ------------------------------------------------------------ la transición de burbujas */
/* la escena nueva aparece adentro de siete burbujas que crecen desde el centro */
export function burbujasDeEntrada(u, W, H) {
  return Array.from({ length: 7 }, (_, i) => {
    const an = (i / 7) * Math.PI * 2 + 0.4, dd = i ? 0.28 : 0;
    return { x: W / 2 + Math.cos(an) * dd * W * 0.5, y: H / 2 + Math.sin(an) * dd * H * 0.5, r: Math.max(0, sale(u * 1.15 - i * 0.04)) * Math.hypot(W, H) * (i ? 0.45 : 0.62) };
  });
}
export function caminoBurbujas(u, W, H) {
  const c = burbujasDeEntrada(u, W, H).filter((b) => b.r > 0.5)
    .map(({ x, y, r }) => `M ${(x + r).toFixed(1)} ${y.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(x - r).toFixed(1)} ${y.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(x + r).toFixed(1)} ${y.toFixed(1)} Z`).join(' ');
  return c || 'M 0 0 Z';
}
export function BordesBurbujas({ u, W, H }) {
  return (
    <svg style={lleno} viewBox={`0 0 ${W} ${H}`}>
      <DefsBurbuja id="tr" />
      {burbujasDeEntrada(u, W, H).map((b, i) => <Burbuja key={i} id="tr" x={b.x} y={b.y} r={b.r} a={0.65 * (1 - u)} />)}
    </svg>
  );
}
export { TONOS };
