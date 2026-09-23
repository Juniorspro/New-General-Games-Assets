/* ============================================================================
   remotion/src/carteles.jsx — lo que va encima de cada plano (el cartel de
   guion.js): la historia, el logo, cada mundo, los rasgos, la pregunta de
   PLANO, la respuesta de Nick y el cierre. t es el segundo del plano y d lo
   que dura. Todo va dentro de la zona segura de TikTok: ni arriba de 220 px,
   ni abajo de 1500, ni en los 120 px de la derecha (los botones).
   ========================================================================== */
import React from 'react';
import { Banda, BurbujasSuben, Destello, En, Pastilla, Vidrio, azar, clamp, rebote, sale, suave, SANS, REDONDA } from './aero.jsx';
import { Chispas, Cuadraditos, PX, Palabras, Titilan, Titular } from './pixel.jsx';
import { Dialogo, Globo } from './dialogo.jsx';

const lleno = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };
const leer = (TX, clave) => clave.split('.').reduce((o, k) => (o ? o[k] : null), TX);
export const ZONA = { x: 490, arriba: 330, abajo: 1480 };     // el centro de lo que se lee (corrido a la izquierda por los botones)
const TONO_MUNDO = { colina: 'verde', arrecife: 'turquesa', ciudad: 'azul', cielo: 'cielo', aurora: 'violeta', plano: 'gris' };

export function Cartel({ P, t, cuadro, ctx }) {
  const C = P.cartel;
  if (!C) return null;
  const A = { P, t, d: P.largoS, cuadro, ...ctx };
  switch (C.tipo) {
    case 'historia': return <Historia {...A} />;
    case 'logo': return <Logo {...A} />;
    case 'mundo': return <Mundo {...A} />;
    case 'rasgo': return <Rasgo {...A} />;
    case 'pregunta': return <Pregunta {...A} />;
    case 'respuesta': return <Respuesta {...A} />;
    case 'cierre': return <Cierre {...A} />;
    default: return null;
  }
}

/* ------------------------------------------------------------ el gancho: "Todo brillaba." sobre los cuatro golpes */
export function Gancho({ t, TT, W, H }) {
  const [a, b] = TT.gancho, C = 4 * 60 / 138;
  return (
    <>
      <En x={ZONA.x} y={760}><Palabras texto={a} t={t - 0.05} tam={170} ancho={900} /></En>
      <En x={ZONA.x} y={960}><Palabras texto={b} t={t - C} tam={170} ancho={900} color="#fff6b0" /></En>
      <Chispas W={W} H={H} x={ZONA.x} y={780} t={t - 0.05} radio={320} cuantas={12} semilla={3} />
      <Chispas W={W} H={H} x={ZONA.x} y={960} t={t - C} radio={360} cuantas={14} semilla={29} color="#fff6b0" borde="#ffb74a" />
    </>
  );
}

/* ------------------------------------------------------------ la historia: el diálogo del juego y la narración */
function Historia({ P, t, cuadro, TX, W, H, datos }) {
  const i = Math.round(P.desde * 30) + cuadro;
  const n = P.cartel.narra;
  return (
    <>
      {n && <En x={ZONA.x} y={520} a={suave((t - n[2]) / 0.25) * (1 - suave((t - n[3]) / 0.3))}>
        <Palabras texto={leer(TX, n[0])[n[1]]} t={t - n[2]} paso={0.07} tam={84} ancho={880} />
      </En>}
      <Dialogo chats={datos.chat.actualizacion} i={i} avatares={datos.avatares} t={t} cuadro={cuadro} W={W} y={ZONA.abajo} />
    </>
  );
}

/* ------------------------------------------------------------ el logo */
function Logo({ t, TT, W, H }) {
  const y = 700, tam = 230, k = rebote(t / 0.6);
  return (
    <>
      <BurbujasSuben W={W} H={H} t={t + 3} a={0.85} escala={1.4} />
      <div style={{ position: 'absolute', left: ZONA.x - tam * 2.6, top: y - tam * 1.4, width: tam * 5.2, height: tam * 2.8, borderRadius: '50%', opacity: clamp(t / 0.3) * 0.8,
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.75), rgba(200,240,255,0.3) 45%, rgba(200,240,255,0) 70%)' }} />
      <En x={ZONA.x} y={y} a={clamp(t / 0.2)} k={0.55 + 0.45 * k}><Vidrio texto="BRILLO" tam={tam} reflejo /></En>
      <Destello W={W} H={H} x={ZONA.x - 420 + 900 * sale(t / 1.4)} y={y - tam * 0.38} s={1.2} a={1 - suave((t - 1.6) / 1)} />
      <Chispas W={W} H={H} x={ZONA.x} y={y} t={t - 0.15} radio={480} cuantas={18} semilla={11} />
      <Titilan W={W} H={H} t={t} zona={{ x: 80, y: y - 200, w: 820, h: 360 }} />
      <En x={ZONA.x} y={y + tam * 1.18} a={suave((t - 0.9) / 0.4)} k={0.94 + 0.06 * sale((t - 0.9) / 0.4)}><Banda texto={TT.lema} tam={58} peso={800} ancho={900} /></En>
    </>
  );
}

/* ------------------------------------------------------------ cada mundo: número, nombre y lo que se aprende */
function Mundo({ P, t, TX, TT }) {
  const { mundo, numero } = P.cartel;
  const entra = (1 - sale(t / 0.4)) * 700;
  return (
    <>
      <div style={{ position: 'absolute', left: 50 - entra, top: ZONA.arriba - 60, transform: `scale(${0.8 + 0.2 * rebote(t / 0.45)})`, transformOrigin: '0 50%' }}>
        <Pastilla alto={104} texto={TX.mundos[mundo]} numero={numero} tono={TONO_MUNDO[mundo]} />
      </div>
      <En x={ZONA.x} y={ZONA.abajo - 60} a={suave((t - 0.3) / 0.25)} k={0.9 + 0.1 * rebote((t - 0.3) / 0.35)}><Banda texto={TT.aprende[mundo]} tam={52} ancho={900} /></En>
    </>
  );
}

/* ------------------------------------------------------------ lo que trae */
const COLOR_ORBE = [['#d9ffcf', '#5fcf4f', '#237d22'], ['#d6fffb', '#3fd6cc', '#0f8a88'], ['#e9f9ff', '#5cc4f5', '#1675c9'], ['#ffffff', '#9fd8ff', '#4a8fe0'], ['#f3e8ff', '#b384ff', '#5a2fb8']];
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
function Rasgo({ P, t, cuadro, TT, W, H }) {
  const i = P.cartel.i;
  if (i === 0) {
    const [a, b] = TT.orbes;
    return (
      <>
        <En x={ZONA.x} y={ZONA.arriba + 80}><Palabras texto={a} t={t} tam={112} ancho={900} /></En>
        <En x={ZONA.x} y={ZONA.arriba + 290} a={suave((t - 0.35) / 0.25)}><Banda texto={b} tam={48} ancho={900} /></En>
        {COLOR_ORBE.map((c, n) => {
          const tn = t - 0.3 - n * 0.08;
          return <En key={n} x={ZONA.x + (n - 2) * 170} y={ZONA.abajo - 80} a={clamp(tn / 0.12)} k={rebote(tn / 0.4)}><Orbe tam={132} colores={c} /></En>;
        })}
        <Chispas W={W} H={H} x={ZONA.x} y={ZONA.abajo - 80} t={t - 0.5} radio={420} cuantas={14} semilla={41} />
      </>
    );
  }
  if (i === 1) {
    const [a, b] = TT.chip, on = Math.floor(cuadro / 6) % 2 === 0;
    return (
      <>
        {/* líneas de tele vieja sobre todo */}
        <div style={{ ...lleno, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 6px, rgba(0,0,0,0) 6px, rgba(0,0,0,0) 12px)' }} />
        <En x={ZONA.x} y={ZONA.arriba + 40} a={clamp(t / 0.1)}><Titular texto={a} tam={70} /></En>
        <En x={ZONA.x} y={ZONA.arriba + 200}><Palabras texto={b} t={t - 0.2} tam={100} ancho={900} color="#b8ff9a" borde="#15501c" sombra="#0a2e0e" mono /></En>
        <En x={ZONA.x} y={ZONA.abajo - 70} a={suave((t - 0.3) / 0.2)} k={rebote((t - 0.3) / 0.4)}>
          <div style={{ display: 'flex', gap: 12, padding: '20px 30px', background: '#101a10', boxShadow: `0 0 0 ${PX}px #8dff72, 0 0 0 ${PX * 2}px #0a2e0e, 0 14px 30px rgba(0,0,0,0.5)` }}>
            {Array.from({ length: 16 }, (_, n) => {
              const h = PX * (2 + Math.round(((Math.sin(n * 1.7 + cuadro * 0.45) + 1) / 2) * 10));
              return <div key={n} style={{ width: PX * 3, height: PX * 12, display: 'flex', alignItems: 'flex-end' }}><div style={{ width: PX * 3, height: h, background: on || n % 2 ? '#8dff72' : '#4fc43a' }} /></div>;
            })}
          </div>
        </En>
      </>
    );
  }
  /* los tres idiomas */
  const nombres = [['Español', 'azul'], ['English', 'verde'], ['Português', 'turquesa']];
  return (
    <>
      {nombres.map(([n, tono], k) => {
        const tn = t - k * 0.14;
        return <En key={n} x={ZONA.x} y={ZONA.arriba + 30 + k * 150} a={clamp(tn / 0.1)} k={rebote(tn / 0.4)} dx={(1 - sale(tn / 0.35)) * (k % 2 ? 500 : -500)}><Pastilla alto={118} texto={n} tono={tono} /></En>;
      })}
      <En x={ZONA.x} y={ZONA.abajo - 60} a={suave((t - 0.5) / 0.25)}><Banda texto={TT.idiomas} tam={48} ancho={900} /></En>
    </>
  );
}

/* ------------------------------------------------------------ PLANO pregunta */
function Pregunta({ t, cuadro, TT, W, H }) {
  return (
    <>
      <div style={{ ...lleno, background: 'rgba(40,42,46,0.25)' }} />
      <En x={ZONA.x} y={700} dx={Math.floor(cuadro / 3) % 4 === 0 ? (azar(cuadro, 3) - 0.5) * 4 * PX : 0}>
        <Palabras texto={TT.pregunta} t={t} paso={0.06} tam={78} ancho={900} color="#eef0f3" borde="#2a2d31" sombra="#101113" mono />
      </En>
    </>
  );
}

/* ------------------------------------------------------------ Nick contesta, como en el chat, letra por letra */
function Respuesta({ t, TT, W, nick }) {
  const txt = TT.respuesta, n = Math.floor(clamp((t - 0.35) / 1.5) * txt.length);
  return (
    <div style={{ position: 'absolute', left: 50, top: ZONA.abajo, transform: 'translateY(-100%)', opacity: clamp(t / 0.15) }}>
      <Globo quien={nick.nombre} texto={txt.slice(0, n)} avatar={nick.avatar} tipo="nick" k={0.7 + 0.3 * rebote(t / 0.3)} t={t} escribiendo={n === 0} ancho={W - 150} />
    </div>
  );
}

/* ------------------------------------------------------------ el cierre */
function Cierre({ t, d, TT, W, H }) {
  const y = 640, tam = 220, k = rebote(t / 0.7);
  const flecha = Math.round(Math.abs(Math.sin(t * 4)) * 3) * PX;
  return (
    <>
      <BurbujasSuben W={W} H={H} t={t} a={0.9} escala={1.4} />
      <div style={{ position: 'absolute', left: ZONA.x - tam * 2.6, top: y - tam * 1.4, width: tam * 5.2, height: tam * 2.8, borderRadius: '50%', opacity: clamp(t / 0.4) * 0.6,
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.6), rgba(200,240,255,0.2) 45%, rgba(200,240,255,0) 70%)' }} />
      <En x={ZONA.x} y={y} a={clamp(t / 0.25)} k={0.6 + 0.4 * k}><Vidrio texto="BRILLO" tam={tam} reflejo /></En>
      <Destello W={W} H={H} x={ZONA.x + 330} y={y - tam * 0.45} s={1} a={suave(t / 0.5) * 0.85} />
      <Chispas W={W} H={H} x={ZONA.x} y={y} t={t - 0.1} radio={460} cuantas={16} semilla={57} />
      <Titilan W={W} H={H} t={t} zona={{ x: 60, y: y - 260, w: 860, h: 420 }} semilla={77} />
      <En x={ZONA.x} y={y + tam * 1.2} a={suave((t - 0.6) / 0.4)} k={0.94 + 0.06 * sale((t - 0.6) / 0.4)}><Banda texto={TT.lema} tam={58} peso={800} ancho={900} /></En>
      <En x={ZONA.x} y={1150} a={suave((t - 1.3) / 0.3)} k={0.85 + 0.15 * rebote((t - 1.3) / 0.45)}><Pastilla alto={128} texto={TT.jugalo} tono="verde" /></En>
      <En x={ZONA.x} y={1290} a={suave((t - 1.8) / 0.4)}>
        <div style={{ font: `700 40px ${SANS}`, color: '#fff', textAlign: 'center', textShadow: '0 0 18px rgba(0,50,110,0.95), 0 3px 4px rgba(0,30,80,0.9)' }}>{TT.donde}</div>
      </En>
      <En x={ZONA.x} y={1400 + flecha} a={suave((t - 2.3) / 0.4)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Titular texto={TT.bio} tam={54} />
          <svg width={PX * 7} height={PX * 7} viewBox="0 0 7 7" shapeRendering="crispEdges">
            {[[3, 0], [3, 1], [3, 2], [3, 3], [1, 3], [2, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [3, 5]].map(([x, y2], i) => <rect key={i} x={x} y={y2} width={1} height={1} fill="#ffffff" />)}
          </svg>
        </div>
      </En>
      {/* al negro al final */}
      <div style={{ ...lleno, background: '#000', opacity: suave((t - d + 0.7) / 0.6) }} />
    </>
  );
}

export { Cuadraditos };
