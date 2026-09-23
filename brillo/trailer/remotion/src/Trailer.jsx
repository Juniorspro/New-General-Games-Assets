/* ============================================================================
   remotion/src/Trailer.jsx — el tráiler armado para TikTok (1080×1920). Cada
   plano del guion es una Sequence con su pedazo de toma (public/tomas/…webm),
   su cámara (zoom, primer plano de Nick o de Mora siguiendo dónde están en
   cada cuadro, sacudón, golpecito en cada compás) y su cartel. Encima van las
   transiciones, centradas en el corte: cuadraditos, mosaico (la imagen se
   pixela de verdad), glitch del Plano, destello y blanco. La música es
   public/audio/<idioma>.wav, hecha con el sintetizador de BRILLO.
   ========================================================================== */
import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS, TOMAS, TRANSICION, tiempos } from '../../guion.js';
import { TRAILER } from '../../textos.js';
import { TEXTOS } from '../../../js/textos.js';
import { Velo, clamp, sale, suave } from './aero.jsx';
import { Cuadraditos, Rayas, bandasGlitch } from './pixel.jsx';
import { Cartel, Gancho } from './carteles.jsx';

/* quién es Nick en el chat (su nombre y su avatar), para la respuesta */
function buscarNick(datos) {
  for (const c of datos.chat.actualizacion || []) for (const l of (c && c.lineas) || []) if (l.mia && l.avatar != null) return { nombre: l.quien.replace(/\s*(dice|says|diz):?\s*$/i, ''), avatar: datos.avatares[l.avatar] };
  return { nombre: 'Nick', avatar: null };
}
const cuadrosDe = (s) => Math.round(s * FPS);

export function Trailer({ idioma, datos, comun, sinMusica = false }) {
  const { width: W, height: H } = useVideoConfig();
  const { planos } = useMemo(() => tiempos(), []);
  const ctx = useMemo(() => ({ idioma, datos, comun, W, H, TX: TEXTOS[idioma], TT: TRAILER[idioma], nick: buscarNick(datos) }), [idioma, datos, comun, W, H]);
  const tanda = (pre) => { const ps = planos.filter((p) => p.id.startsWith(pre)); return [ps[0].inicio, ps[ps.length - 1].inicio + ps[ps.length - 1].cuadros]; };
  const [g0, g1] = tanda('g'), [h0, h1] = tanda('h');
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {planos.map((P) => (
        <Sequence key={P.id} from={P.inicio} durationInFrames={P.cuadros} name={P.id}>
          <Plano P={P} ctx={ctx} />
        </Sequence>
      ))}
      <Sequence from={g0} durationInFrames={g1 - g0} name="gancho"><CapaGancho ctx={ctx} /></Sequence>
      <Sequence from={h0} durationInFrames={h1 - h0} name="franjas"><Franjas largo={h1 - h0} W={W} H={H} /></Sequence>
      {planos.slice(1).filter((P) => TRANSICION[P.entra] > 0).map((P) => {
        const L = Math.max(2, cuadrosDe(TRANSICION[P.entra]));
        return (
          <Sequence key={'t' + P.id} from={P.inicio - Math.floor(L / 2)} durationInFrames={L} name={`${P.entra} → ${P.id}`}>
            <Transicion tipo={P.entra} L={L} W={W} H={H} />
          </Sequence>
        );
      })}
      {!sinMusica && <Audio src={staticFile(`audio/${idioma}.wav`)} />}
    </AbsoluteFill>
  );
}

function CapaGancho({ ctx }) {
  const t = useCurrentFrame() / FPS;
  return <Gancho t={t} {...ctx} />;
}
/* las franjas negras de cine durante la historia */
function Franjas({ largo, W, H }) {
  const c = useCurrentFrame(), k = suave(c / 12) * (1 - suave((c - largo + 10) / 10)), a = Math.round(150 * k);
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: a, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: W, height: a, background: '#000' }} />
    </>
  );
}

/* las transiciones que van encima del corte (el mosaico y el glitch los hace cada plano con su imagen) */
function Transicion({ tipo, L, W, H }) {
  const c = useCurrentFrame(), u = (c + 0.5) / L;
  if (tipo === 'pixeles') return <Cuadraditos W={W} H={H} u={u} />;
  if (tipo === 'blanco') return <AbsoluteFill style={{ background: '#fff', opacity: u < 0.5 ? suave(u * 2) : 1 - suave((u - 0.5) * 2) }} />;
  if (tipo === 'destello') return <AbsoluteFill style={{ background: '#fff', opacity: 0.85 * (1 - Math.abs(u * 2 - 1)) }} />;
  if (tipo === 'glitch') return <Rayas g={1 - Math.abs(u * 2 - 1)} cuadro={c} W={W} H={H} />;
  return null;
}

/* ------------------------------------------------------------ un plano */
function Plano({ P, ctx }) {
  const cuadro = useCurrentFrame(), t = cuadro / FPS;
  const { W, H } = ctx;
  const T = TOMAS[P.toma];
  const src = staticFile(`tomas/${T.porIdioma ? ctx.idioma : 'comun'}/${P.toma}.webm`);
  const pos = ((T.porIdioma ? ctx.datos.pos : ctx.comun.pos) || {})[P.toma] || [];
  const i0 = cuadrosDe(P.desde), i = i0 + cuadro;

  /* la cámara: zoom de z0 a z1, centrada en Nick o Mora (promediando unos cuadros para que no tiemble) */
  const cam = P.cam || {};
  const [z0, z1] = cam.zoom || [1, 1];
  let z = z0 + (z1 - z0) * suave(t / P.largoS);
  if (P.compas) z *= 1 + 0.045 * (1 - sale(t / 0.35));
  let fx = W / 2, fy = H / 2;
  if (cam.foco) {
    let sx = 0, sy = 0, n = 0;
    for (let k = i - 6; k <= i + 6; k++) { const p = pos[clamp(k, 0, pos.length - 1)]; const q = p && p[cam.foco]; if (q) { sx += q[0]; sy += q[1]; n++; } }
    /* si en este rato no se ve (a Mora el juego la esconde cuando la simplifica), la última vez que se vio */
    for (let k = clamp(i, 0, pos.length - 1); !n && k >= 0; k--) { const q = pos[k] && pos[k][cam.foco]; if (q) { sx = q[0]; sy = q[1]; n = 1; } }
    if (n) { fx = sx / n; fy = sy / n - 60; }
  }
  let tx = clamp(W / 2 - fx * z, W - W * z, 0), ty = clamp(H / 2 - fy * z, H - H * z, 0);
  if (cam.sacudir && t < cam.sacudir) { const a = (1 - t / cam.sacudir) * 22; tx = clamp(tx + Math.sin(t * 71) * a, W - W * z, 0); ty = clamp(ty + Math.cos(t * 53) * a, H - H * z, 0); }
  const nitido = Math.abs(z - Math.round(z)) < 1e-3;

  /* el mosaico: un filtro SVG toma un punto de cada bloque y lo agranda al bloque entero (pintar chico y
     agrandar con will-change no sirve: Chromium vuelve a dibujar la imagen a tamaño completo) */
  const me = TRANSICION.mosaico / 2;
  let bloque = 1;
  if (P.entra === 'mosaico' && t < me) bloque = 1 + Math.round(30 * (1 - t / me));
  if (P.salida === 'mosaico' && t > P.largoS - me) bloque = Math.max(bloque, 1 + Math.round(30 * ((t - (P.largoS - me)) / me)));
  /* el glitch: bandas de la imagen corridas, más fuerte cerca del corte */
  const ge = TRANSICION.glitch / 2;
  let gl = 0;
  if (P.entra === 'glitch' && t < ge) gl = 1 - t / ge;
  if (P.salida === 'glitch' && t > P.largoS - ge) gl = Math.max(gl, (t - (P.largoS - ge)) / ge);

  const imagen = (
    <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
      <OffthreadVideo src={src} trimBefore={i0} muted style={{ width: '100%', height: '100%', imageRendering: nitido ? 'pixelated' : 'auto' }} />
    </div>
  );
  const b = bloque > 1 ? Math.round(bloque * 2) : 0, idF = `mosaico-${P.id}`;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {b
        ? <>
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <filter id={idF} x="0" y="0" width={W} height={H} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse">
                <feFlood x={Math.floor(b / 2)} y={Math.floor(b / 2)} width="1" height="1" floodColor="#fff" />
                <feComposite width={b} height={b} />
                <feTile result="puntos" />
                <feComposite in="SourceGraphic" in2="puntos" operator="in" />
                <feMorphology operator="dilate" radius={Math.ceil(b / 2)} />
              </filter>
            </svg>
            <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, filter: `url(#${idF})` }}>{imagen}</div>
          </>
        : imagen}
      {gl > 0 && bandasGlitch(gl, cuadro, H).map((g, k) => (
        <div key={k} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, clipPath: `inset(${g.y}px 0 ${Math.max(0, H - g.y - g.alto)}px 0)`, transform: `translateX(${g.dx}px)`, filter: k % 2 ? 'grayscale(1) contrast(1.4)' : 'none' }}>{imagen}</div>
      ))}
      <Velo W={W} H={H} />
      <Cartel P={P} t={t} cuadro={cuadro} ctx={ctx} />
    </AbsoluteFill>
  );
}
