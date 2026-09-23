/* ============================================================================
   remotion/src/aero.jsx — el kit Frutiger Aero del tráiler, en HTML y SVG:
   burbujas, destellos de lente, la pastilla brillante de Vista, el texto de
   vidrio con reflejo y la banda de vidrio para las frases. Todo depende solo
   del cuadro (nada de animaciones de CSS), así Remotion puede dibujar cualquier
   cuadro suelto y sale igual.
   ========================================================================== */
import React from 'react';

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const suave = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const sale = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const rebote = (x) => { x = clamp(x); const c = 1.70158 * 1.3; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
/* un número al azar pero siempre el mismo para (i, k) */
export const azar = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

export const SANS = '"Open Sans", sans-serif';
export const REDONDA = 'Nunito, "Open Sans", sans-serif';
export const MONO = '"Liberation Mono", "Courier New", monospace';

const lleno = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };

/* ------------------------------------------------------------ burbujas */
/* las definiciones de color de las burbujas: van una vez en cada SVG */
export function DefsBurbuja({ id }) {
  return (
    <defs>
      <radialGradient id={`${id}f`} cx="50%" cy="50%" r="50%">
        <stop offset="0.2" stopColor="rgb(255,255,255)" stopOpacity="0.02" />
        <stop offset="0.75" stopColor="rgb(190,235,255)" stopOpacity="0.12" />
        <stop offset="1" stopColor="rgb(220,245,255)" stopOpacity="0.55" />
      </radialGradient>
      <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="rgb(255,150,220)" stopOpacity="0.55" />
        <stop offset="0.3" stopColor="rgb(150,220,255)" stopOpacity="0.55" />
        <stop offset="0.6" stopColor="rgb(170,255,190)" stopOpacity="0.5" />
        <stop offset="1" stopColor="rgb(255,240,150)" stopOpacity="0.5" />
      </linearGradient>
    </defs>
  );
}
/* una burbuja: borde claro con arcoíris y el reflejo arriba a la izquierda */
export function Burbuja({ id, x, y, r, a = 1 }) {
  if (r <= 0.5 || a <= 0) return null;
  return (
    <g opacity={a}>
      <circle cx={x} cy={y} r={r} fill={`url(#${id}f)`} />
      <circle cx={x} cy={y} r={r * 0.97} fill="none" stroke={`url(#${id}b)`} strokeWidth={Math.max(1.2, r * 0.06)} />
      <ellipse cx={x - r * 0.38} cy={y - r * 0.42} rx={r * 0.22} ry={r * 0.12} fill="rgba(255,255,255,0.85)" transform={`rotate(-40 ${x - r * 0.38} ${y - r * 0.42})`} />
      <circle cx={x + r * 0.45} cy={y + r * 0.4} r={r * 0.06} fill="rgba(255,255,255,0.5)" />
    </g>
  );
}
/* burbujas que suben por toda la pantalla, siempre las mismas */
const SUBEN = Array.from({ length: 34 }, (_, i) => ({ x: azar(i, 1), v: 0.05 + azar(i, 2) * 0.12, tam: 10 + azar(i, 3) * 46, fase: azar(i, 4), bam: azar(i, 5) }));
export function BurbujasSuben({ W, H, t, a = 1, cuantas = 34, escala = 1 }) {
  return (
    <svg style={lleno} viewBox={`0 0 ${W} ${H}`}>
      <DefsBurbuja id="su" />
      {SUBEN.slice(0, cuantas).map((b, i) => {
        const y = 1.15 - ((b.fase + t * b.v) % 1.3);
        return <Burbuja key={i} id="su" x={(b.x + Math.sin(t * 0.8 + b.bam * 6) * 0.02) * W} y={y * H} r={b.tam * escala} a={a * 0.9} />;
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ destello de lente */
/* brillo, raya y los fantasmas en la diagonal que pasa por el centro */
export function Destello({ W, H, x, y, s = 1, a = 1 }) {
  if (a <= 0.001) return null;
  const cx = W / 2, cy = H / 2;
  const fantasmas = [[0.5, 30, 'rgba(160,255,200,0.2)'], [-0.3, 60, 'rgba(160,210,255,0.16)'], [-0.8, 22, 'rgba(255,190,240,0.22)'], [-1.2, 90, 'rgba(140,200,255,0.1)']];
  const R = 260 * s;
  return (
    <div style={{ ...lleno, opacity: a, mixBlendMode: 'screen', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: x - R, top: y - R, width: R * 2, height: R * 2, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(190,240,255,0.55) 15%, rgba(120,200,255,0) 70%)' }} />
      <div style={{ position: 'absolute', left: x - 900 * s, top: y - 3 * s, width: 1800 * s, height: 6 * s, background: 'linear-gradient(90deg, rgba(120,210,255,0), rgba(230,250,255,0.95) 50%, rgba(120,210,255,0))', borderRadius: 6 * s }} />
      <div style={{ position: 'absolute', left: x - 3 * s, top: y - 240 * s, width: 6 * s, height: 480 * s, background: 'linear-gradient(180deg, rgba(120,210,255,0), rgba(230,250,255,0.6) 50%, rgba(120,210,255,0))', borderRadius: 6 * s }} />
      {fantasmas.map(([k, rr, c], i) => {
        const r = rr * s * 2, gx = cx + (cx - x) * k, gy = cy + (cy - y) * k;
        return <div key={i} style={{ position: 'absolute', left: gx - r, top: gy - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `radial-gradient(circle, ${c} 60%, rgba(255,255,255,0) 72%)` }} />;
      })}
    </div>
  );
}

/* ------------------------------------------------------------ la pastilla de Vista */
export const TONOS = { azul: ['#f2fdff', '#6fd3ff', '#1a86de'], verde: ['#effff0', '#7ee06a', '#2c9d38'], gris: ['#fafafa', '#b8c2cc', '#6c7985'],
  turquesa: ['#effffd', '#5fe3d4', '#119c9a'], violeta: ['#fbf2ff', '#c9a0ff', '#7a48d6'], cielo: ['#ffffff', '#a8e4ff', '#3d9be8'] };
export function Pastilla({ alto = 92, texto, numero, tono = 'azul', style }) {
  const [c1, c2, c3] = TONOS[tono];
  const tam = alto * 0.46;
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', height: alto, borderRadius: alto / 2, padding: `0 ${alto * 0.6}px`, gap: alto * 0.22,
      background: `linear-gradient(180deg, ${c1}, ${c2} 50%, ${c3})`, boxShadow: `0 ${alto * 0.07}px ${alto * 0.24}px rgba(0,60,130,0.45)`, overflow: 'hidden', whiteSpace: 'nowrap', ...style }}>
      {/* el brillo de arriba */}
      <div style={{ position: 'absolute', left: '-2%', width: '104%', top: -alto * 0.3, height: alto * 0.84, borderRadius: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0.08))' }} />
      {numero != null && (
        <div style={{ position: 'relative', width: alto * 0.72, height: alto * 0.72, borderRadius: '50%', marginLeft: -alto * 0.22, flex: 'none',
          background: 'radial-gradient(circle at 35% 30%, #ffffff, #bfe9ff 70%)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.9), 0 2px 6px rgba(0,50,110,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', font: `900 ${alto * 0.45}px ${REDONDA}`, color: tono === 'verde' ? '#1c7a2a' : '#1466b8' }}>{numero}</div>
      )}
      <span style={{ position: 'relative', font: `800 ${tam}px ${SANS}`, color: '#fff', textShadow: `0 ${alto * 0.025}px 0 rgba(0,50,110,0.45), 0 0 ${alto * 0.12}px rgba(0,60,140,0.35)` }}>{texto}</span>
      <div style={{ position: 'absolute', inset: 1, borderRadius: alto / 2, border: `${Math.max(2, alto * 0.028)}px solid rgba(255,255,255,0.95)`, boxSizing: 'border-box' }} />
    </div>
  );
}

/* ------------------------------------------------------------ texto de vidrio */
/* degradé con el corte de brillo en el medio, borde oscuro, filo blanco y reflejo abajo.
   Con Nunito y alto de línea 1, las mayúsculas van de 0,124 a 0,829 de la caja. */
const VIDRIOS = {
  azul: { borde: '#083f86', fondo: 'linear-gradient(180deg, #ffffff 12%, #bdf1ff 44%, #49c0ff 51%, #0f74d4 84%)' },
  verde: { borde: '#0d4d18', fondo: 'linear-gradient(180deg, #ffffff 12%, #c8ffb8 44%, #5fd35a 51%, #1e8e2c 84%)' },
  gris: { borde: '#2a2e33', fondo: 'linear-gradient(180deg, #ffffff 12%, #e4e7ea 44%, #9aa3ad 51%, #5d6670 84%)' },
};
export function Vidrio({ texto, tam, tono = 'azul', reflejo = false, style }) {
  const V = VIDRIOS[tono];
  const base = { font: `900 ${tam}px ${REDONDA}`, lineHeight: 1, whiteSpace: 'nowrap', letterSpacing: tam * 0.01 };
  const capa = { ...base, position: 'absolute', left: 0, top: 0 };
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div style={{ ...base, color: V.borde, WebkitTextStroke: `${tam * 0.09}px ${V.borde}`, filter: `drop-shadow(0 ${tam * 0.04}px ${tam * 0.07}px rgba(0,40,110,0.55))` }}>{texto}</div>
      <div style={{ ...capa, background: V.fondo, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{texto}</div>
      <div style={{ ...capa, color: 'transparent', WebkitTextStroke: `${Math.max(1.5, tam * 0.018)}px rgba(255,255,255,0.9)` }}>{texto}</div>
      {reflejo && (
        <div style={{ ...capa, top: tam * 0.7, transform: 'scaleY(-1)', background: 'linear-gradient(180deg, rgba(170,230,255,0) 30%, rgba(170,230,255,0.55) 83%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{texto}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ banda de vidrio para frases */
export function Banda({ texto, tam = 50, ancho = 1500, peso = 700, mono = false, glitch = false, color = '#ffffff', sombra = 'rgba(0,50,110,0.8)', style }) {
  const fondo = mono ? 'linear-gradient(180deg, rgba(70,74,80,0.8), rgba(40,43,48,0.88))' : 'linear-gradient(180deg, rgba(40,140,230,0.74), rgba(10,72,160,0.8) 55%, rgba(6,52,125,0.84))';
  const letra = { font: `${peso} ${tam}px ${mono ? MONO : SANS}`, lineHeight: 1.3, letterSpacing: mono ? tam * 0.04 : 0 };
  return (
    <div style={{ position: 'relative', maxWidth: ancho, padding: `${tam * 0.42}px ${tam * 1.05}px`, borderRadius: tam * 1.1, background: fondo, overflow: 'hidden', textAlign: 'center',
      boxShadow: `0 ${tam * 0.12}px ${tam * 0.5}px rgba(0,30,80,0.35)`, ...style }}>
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,0.36), rgba(255,255,255,0))' }} />
      <div style={{ position: 'relative' }}>
        {glitch && <div style={{ ...letra, position: 'absolute', left: -4, top: 0, width: '100%', color: 'rgba(255,40,80,0.6)' }}>{texto}</div>}
        {glitch && <div style={{ ...letra, position: 'absolute', left: 4, top: 0, width: '100%', color: 'rgba(40,220,255,0.6)' }}>{texto}</div>}
        <div style={{ ...letra, position: 'relative', color, textShadow: `0 0 ${tam * 0.45}px ${sombra}, 0 ${tam * 0.04}px ${tam * 0.08}px ${sombra}` }}>{texto}</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: tam * 1.1, border: '2px solid rgba(255,255,255,0.6)', boxSizing: 'border-box' }} />
    </div>
  );
}

/* centra lo de adentro en (x, y); a es la opacidad, k la escala */
export function En({ x, y, a = 1, k = 1, dx = 0, children, origen = 'center' }) {
  if (a <= 0.001) return null;
  return (
    <div style={{ position: 'absolute', left: x + dx, top: y, width: 'max-content', transform: `translate(-50%, -50%) scale(${k})`, transformOrigin: origen, opacity: a }}>
      {children}
    </div>
  );
}

/* la viñeta y un velo de luz arriba, igual para todo el tráiler */
export function Velo({ W, H }) {
  return (
    <>
      <div style={{ ...lleno, background: `radial-gradient(ellipse ${W * 0.75}px ${H * 0.75}px at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,20,50,0.38) 100%)` }} />
      <div style={{ ...lleno, background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 22%)' }} />
    </>
  );
}
