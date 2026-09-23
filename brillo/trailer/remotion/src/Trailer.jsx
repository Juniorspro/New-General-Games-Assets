/* ============================================================================
   remotion/src/Trailer.jsx — el tráiler armado: cada escena del guion es una
   Sequence con su toma del juego (public/tomas/…webm), su entrada (corte,
   destello blanco, burbujas o fundido), los carteles de encima y la música
   (public/audio/<idioma>.wav, hecha con el sintetizador de BRILLO).

   Horizontal: la toma entera. Vertical: los paisajes llenan la pantalla; el
   juego va en una ventana de vidrio cuadrada con el mismo cuadro borroso atrás.
   ========================================================================== */
import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS, tiempos } from '../../guion.js';
import { TRAILER } from '../../textos.js';
import { TEXTOS } from '../../../js/textos.js';
import { BurbujasSuben, Velo, clamp, sale, suave } from './aero.jsx';
import { BordesBurbujas, Cartel, caminoBurbujas } from './carteles.jsx';

const disposicion = (vertical) => (vertical
  ? { vertical, arriba: 200, abajo: 1570, ventana: { x: 40, y: 380, w: 1000, h: 1000 } }
  : { vertical, arriba: 151, abajo: 929 });

/* quién es Nick en el chat (su nombre y su avatar), para la respuesta */
function buscarNick(datos) {
  for (const c of datos.chat.actualizacion || []) for (const l of (c && c.lineas) || []) if (l.mia && l.avatar != null) return { nombre: l.quien, avatar: datos.avatares[l.avatar] };
  return { nombre: 'Nick', avatar: null };
}

export function Trailer({ idioma, vertical, datos, sinMusica = false }) {
  const { width: W, height: H } = useVideoConfig();
  const { escenas } = useMemo(() => tiempos(datos.medidas), [datos]);
  const ctx = useMemo(() => ({ idioma, datos, W, H, L: disposicion(vertical), TX: TEXTOS[idioma], TT: TRAILER[idioma], nick: buscarNick(datos) }), [idioma, datos, W, H, vertical]);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {escenas.map((E) => (
        <Sequence key={E.id} from={E.inicio} durationInFrames={E.visible} name={E.id}>
          <Escena E={E} ctx={ctx} />
        </Sequence>
      ))}
      {!sinMusica && <Audio src={staticFile(`audio/${idioma}.wav`)} />}
    </AbsoluteFill>
  );
}

function Escena({ E, ctx }) {
  const frame = useCurrentFrame(), t = frame / FPS;
  const { W, H, L } = ctx;
  const src = staticFile(`tomas/${E.toma.porIdioma ? ctx.idioma : 'comun'}/${E.id}.webm`);
  const u = E.entrada ? clamp(frame / E.entrada) : 1;
  const estilo = {};
  if (E.entra === 'fundido') estilo.opacity = u;
  if (E.entra === 'burbuja' && u < 1) estilo.clipPath = `path('${caminoBurbujas(u, W, H)}')`;
  /* en cada compás la toma entra con un golpecito de zoom */
  const golpe = E.compas ? 1 + 0.035 * (1 - sale(t / 0.4)) : 1;
  const blanco = E.entra === 'blanco' || E.entra === 'blancoCorto';
  return (
    <>
      <AbsoluteFill style={estilo}>
        <Juego src={src} t={t} golpe={golpe} completo={E.toma.tipo === 'paisaje' && !E.toma.zoom} W={W} H={H} L={L} />
        <Velo W={W} H={H} />
        <Cartel E={E} t={t} frame={frame} ctx={ctx} />
        {E.desdeBlanco && <AbsoluteFill style={{ background: '#fff', opacity: 1 - suave(t / 1.2) }} />}
        {E.alNegro && <AbsoluteFill style={{ background: '#000', opacity: suave((t - E.largoS + E.alNegro) / (E.alNegro - 0.1)) }} />}
        {blanco && u < 1 && <AbsoluteFill style={{ background: '#fff', opacity: 1 - suave(u) }} />}
      </AbsoluteFill>
      {E.entra === 'burbuja' && u < 0.95 && <BordesBurbujas u={u} W={W} H={H} />}
    </>
  );
}

/* la toma del juego en el cuadro */
function Juego({ src, t, golpe, completo, W, H, L }) {
  const video = (style) => <OffthreadVideo src={src} muted style={{ width: '100%', height: '100%', ...style }} />;
  if (!L.vertical) return <AbsoluteFill style={{ transform: `scale(${golpe})` }}>{video()}</AbsoluteFill>;
  if (completo) {
    const s = H / 1080;
    return (
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: (W - 1920 * s) / 2, top: 0, width: 1920 * s, height: H, transform: `scale(${golpe})` }}>{video({ imageRendering: 'pixelated' })}</div>
      </AbsoluteFill>
    );
  }
  /* atrás, la misma toma chiquita y desenfocada (grabar.mjs la hace con ffmpeg: <id>.fondo.mp4) */
  const V = L.ventana, s = V.h / 1080;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <OffthreadVideo src={src.replace('.webm', '.fondo.mp4')} muted style={{ width: '100%', height: '100%' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(150,215,255,0.35), rgba(10,60,140,0.4))' }} />
      <BurbujasSuben W={W} H={H} t={t + 7} a={0.55} cuantas={18} escala={1.5} />
      <div style={{ position: 'absolute', left: V.x, top: V.y, width: V.w, height: V.h, borderRadius: 44, overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(0,30,90,0.55), 0 0 0 3px rgba(255,255,255,0.92), 0 0 0 10px rgba(255,255,255,0.22)' }}>
        <div style={{ position: 'absolute', left: -(1920 * s - V.w) / 2, top: 0, width: 1920 * s, height: V.h, transform: `scale(${golpe})` }}>{video()}</div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 32%)' }} />
      </div>
    </AbsoluteFill>
  );
}
