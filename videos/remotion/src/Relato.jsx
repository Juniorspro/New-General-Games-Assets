/* ============================================================================
   videos/remotion/src/Relato.jsx — un video de TikTok relatado (1080×1920):
   el gameplay de fondo cortado en planos, la voz línea por línea, el sticker
   que cuenta, subtítulos tipo karaoke, carteles, memes, golpes, destellos
   entre líneas y la música del juego de fondo (baja cuando habla la voz).
   ========================================================================== */
import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { MONTAJES } from './montajes.js';
import { Barra, Chip, Cierre, Destello, Gancho, Golpe, Guardas, Karaoke, Luciernagas, Meme, Narrador, Papelitos, clamp, sale, suave } from './kit.jsx';

export const FPS = 30;
const HUECO = 0.18;          // silencio entre línea y línea (s)
const INICIO = 0.12;

/* la línea de tiempo: dónde empieza cada línea, sus planos, sus extras y el cierre */
export function armar(id, lineas) {
  const M = MONTAJES[id];
  let t = INICIO;
  const L = lineas.map((V, i) => {
    const m = M.lineas[i], ini = t, largo = V.dur + HUECO + (m.pausa || 0);
    const peso = m.planos.reduce((s, p) => s + p[2], 0);
    let u = ini;
    const planos = m.planos.map(([toma, desde, p, enfoque]) => { const d = (largo * p) / peso, P = { toma, desde, enfoque, t0: u, t1: u + d }; u += d; return P; });
    /* los extras pueden engancharse a una palabra del texto */
    const cuando = (pal) => { const w = V.palabras.find((x) => x.p === pal || x.p.replace(/[¿¡.,!?]/g, '') === pal.replace(/[¿¡.,!?]/g, '')); return w ? w.t0 : 0; };
    const extras = (m.extras || []).map((e) => ({ ...e, t0: ini + (e.palabra ? cuando(e.palabra) : e.desdePalabra ? cuando(e.desdePalabra) + (e.mas || 0) : e.en || 0) }));
    t = ini + largo;
    return { ...V, ...m, i, ini, fin: ini + largo, planos, extras };
  });
  const cierre = { ini: t, fin: t + M.cierre.dur };
  return { M, L, cierre, total: Math.ceil(cierre.fin * FPS) };
}

export function Relato({ id, lineas, sinMusica }) {
  const { width: W, height: H } = useVideoConfig();
  const A = useMemo(() => armar(id, lineas), [id, lineas]);
  const f = useCurrentFrame(), t = f / FPS;
  const { M, L, cierre } = A;
  const actual = L.find((l) => t >= l.ini && t < l.fin) || (t >= cierre.ini ? L[L.length - 1] : L[0]);
  const tl = t - actual.ini;
  const hablando = actual.palabras.some((w) => tl >= w.t0 && tl < w.t1 + 0.05);
  /* la música baja cuando habla la voz */
  const vozEn = (s) => L.some((l) => s >= l.ini && s < l.ini + l.dur);
  const volMusica = (fr) => { const s = fr / FPS; const base = vozEn(s) ? (M.volVoz ?? 0.42) : (M.volSola ?? 0.9); return base * suave(s / 0.6) * (1 - suave((s - cierre.fin + 1.6) / 1.5)); };
  const planos = [...L.flatMap((l) => l.planos), { toma: M.cierre.toma[0], desde: M.cierre.toma[1], enfoque: M.cierre.toma[2], t0: cierre.ini, t1: cierre.fin, cierre: true }];
  const franja = M.formato === 'franja';
  const tramo = (P, k, hijo) => (
    <Sequence key={k} from={Math.round(P.t0 * FPS)} durationInFrames={Math.max(1, Math.round((P.t1 - P.t0) * FPS))} name={`${P.toma} ${P.desde}`}>{hijo}</Sequence>
  );
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* el gameplay: cada plano con un golpecito de zoom al entrar. El juego vertical va a
          pantalla entera; el acostado, en una franja sobre su propio fondo desenfocado */}
      {!franja && planos.map((P, k) => tramo(P, k, <Plano P={P} dir={M.tomas} />))}
      {franja && planos.map((P, k) => tramo(P, 'f' + k, <Fondo P={P} dir={M.tomas} />))}
      {M.particulas === 'luciernagas' && <Luciernagas t={t} a={t < 3.5 || t > cierre.ini ? 1 : 0.45} />}
      {M.particulas === 'papelitos' && <Papelitos t={t} />}
      {franja && planos.map((P, k) => tramo(P, 'j' + k, <PlanoFranja P={P} dir={M.tomas} F={M.franja} />))}
      {franja && <Guardas F={M.franja} />}
      {/* entre línea y línea, un destello del color del juego */}
      {L.slice(1).map((l) => { const u = (t - l.ini + 0.1) / 0.28; return u > 0 && u < 1 ? <Destello key={l.i} u={u} color={M.color2} /> : null; })}
      {/* extras */}
      {L.flatMap((l) => l.extras.map((e, k) => {
        const te = t - e.t0;
        if (e.tipo === 'chip') return <Chip key={l.i + '-' + k} texto={e.texto} t={te} dur={e.dur || 2} color={M.color} tinta={M.tinta} y={M.yChip} />;
        if (e.tipo === 'golpe') return <Golpe key={l.i + '-' + k} texto={e.texto} t={te} color={M.color} tam={e.tam} />;
        if (e.tipo === 'meme') return <Meme key={l.i + '-' + k} archivo={memeArchivo(e.meme)} texto={e.texto} paneles={e.paneles} ancho={e.ancho} tamPanel={e.tamPanel} t={te} dur={e.dur || 1.5} />;
        return null;
      }))}
      {M.gancho && <Gancho texto={M.gancho.texto} t={t} hasta={M.gancho.hasta} color={M.color} tinta={M.tinta} y={M.yGancho} />}
      {t < cierre.ini && <Karaoke linea={actual} t={tl} x={540} y={M.yTexto || 1130} color={M.color} />}
      {t >= cierre.ini && <Cierre t={t - cierre.ini} cta={M.cierre.cta} nombre={M.cierre.nombre} color={M.color} tinta={M.tinta} y={M.yCierre} />}
      <Narrador cara={actual.sticker} desdeCambio={t - actual.ini} t={t} hablando={hablando && t < cierre.ini} x={24} y={M.ySticker || 1250} tam={M.tamSticker || 360} />
      <Barra u={clamp(t / cierre.fin)} color={M.color} />
      {/* el sonido: música del juego, la voz y los efectos del montaje */}
      {!sinMusica && <Audio src={staticFile(M.musica)} volume={volMusica} />}
      {L.map((l) => (
        <Sequence key={'v' + l.i} from={Math.round(l.ini * FPS)} durationInFrames={Math.ceil((l.dur + 0.3) * FPS)}>
          <Audio src={staticFile(`${M.voz}/${l.archivo}`)} volume={1} />
        </Sequence>
      ))}
      {L.map((l) => <Sequence key={'p' + l.i} from={Math.round(l.ini * FPS)} durationInFrames={12}><Audio src={staticFile('sfx/pop.wav')} volume={0.35} /></Sequence>)}
      {L.slice(1).map((l) => <Sequence key={'w' + l.i} from={Math.max(0, Math.round((l.ini - 0.12) * FPS))} durationInFrames={14}><Audio src={staticFile('sfx/whoosh.wav')} volume={0.4} /></Sequence>)}
      {L.flatMap((l) => l.extras.map((e, k) => {
        const s = e.tipo === 'golpe' ? 'golpe' : e.tipo === 'meme' ? 'golpe' : 'ding';
        return <Sequence key={'x' + l.i + k} from={Math.round(e.t0 * FPS)} durationInFrames={27}><Audio src={staticFile(`sfx/${s}.wav`)} volume={e.tipo === 'chip' ? 0.3 : 0.55} /></Sequence>;
      }))}
      <Sequence from={Math.round(cierre.ini * FPS)} durationInFrames={33}><Audio src={staticFile('sfx/ding.wav')} volume={0.5} /></Sequence>
    </AbsoluteFill>
  );
}

const MEMES = { 'cine-absoluto': 'cine-absoluto.png', 'doge-cheems': 'doge-cheems.png', 'leo-riendo': 'leo-riendo.png', megamind: 'megamind.png', panik: 'panik.png', 'siempre-lo-fue': 'siempre-lo-fue.png' };
export const memeArchivo = (n) => MEMES[n] || n + '.jpg';

/* un plano: el pedazo de toma, a pantalla entera, con el golpecito de zoom al entrar */
function Plano({ P, dir }) {
  const f = useCurrentFrame(), t = f / FPS, dur = P.t1 - P.t0;
  const z = 1.06 - 0.06 * sale(t / 0.3) + (P.cierre ? 0.04 * suave(t / dur) : 0.02 * (t / dur));
  return (
    <AbsoluteFill style={{ transform: `scale(${z})` }}>
      <OffthreadVideo src={staticFile(`${dir}/${P.toma}.mp4`)} trimBefore={Math.round(P.desde * FPS)} muted style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
}

/* el juego acostado (KUNTUR, 16:9): su fondo desenfocado a pantalla entera… */
function Fondo({ P, dir }) {
  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(`${dir}/${P.toma}.fondo.mp4`)} trimBefore={Math.round(P.desde * FPS)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <AbsoluteFill style={{ background: 'rgba(20,8,4,0.28)' }} />
    </AbsoluteFill>
  );
}

/* …y el juego en una franja: con el golpecito de zoom y, si el plano lo pide, acercándose a
   un punto (enfoque [x, y, zoom] en fracciones del cuadro, para que Killa no quede chiquita) */
function PlanoFranja({ P, dir, F }) {
  const f = useCurrentFrame(), t = f / FPS, dur = P.t1 - P.t0;
  const [cx, cy, zz] = P.enfoque || [0.5, 0.5, 1];
  const z = (1.06 - 0.06 * sale(t / 0.3) + (P.cierre ? 0.04 * suave(t / dur) : 0.025 * (t / dur))) * zz;
  const vh = F.alto * z, vw = (vh * 16) / 9;
  const left = Math.min(0, Math.max(1080 - vw, 540 - cx * vw)), top = Math.min(0, Math.max(F.alto - vh, F.alto / 2 - cy * vh));
  return (
    <div style={{ position: 'absolute', left: 0, top: F.y, width: 1080, height: F.alto, overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.55)' }}>
      <OffthreadVideo src={staticFile(`${dir}/${P.toma}.mp4`)} trimBefore={Math.round(P.desde * FPS)} muted style={{ position: 'absolute', left, top, width: vw, height: vh }} />
    </div>
  );
}

