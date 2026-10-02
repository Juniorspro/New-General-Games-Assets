/* ============================================================================
   videos/remotion/src/Duo.jsx — un video de TikTok de dos juegos (1080×1920):
   el gancho en pantalla partida, cada juego con su cartel de título, sus
   planos cortados donde lo pide la voz, círculos que siguen al personaje,
   el dedo que corta, toca o desliza, la cortina entre un juego y el otro, y
   el final con "comentá 1 o 2" y JXSTUDIOS. La música de cada juego suena en
   su parte y baja cuando habla la voz. Qué va en cada video: duos.js.
   ========================================================================== */
import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { DUOS } from './duos.js';
import { Chip, Golpe, Karaoke, Narrador, Barra, Destello, clamp, suave } from './kit.jsx';
import { FPS, camara, aPantalla, Toma, Partida, Titular, TituloJuego, Cortina, Sigue, Dedo, Arrastre, Marco, Salta, Chispas, Encuesta, Final } from './kit2.jsx';

const HUECO = 0.18;          // silencio entre línea y línea (s)
const INICIO = 0.55;         // la pantalla partida entra antes de que hable

/* cuándo dice una palabra la línea (s desde que empieza la línea) */
const cuandoDice = (V, pal, cual = 't0') => {
  const limpia = (s) => s.replace(/[¿¡.,:;!?…]/g, '').toLowerCase();
  const w = V.palabras.find((x) => limpia(x.p) === limpia(pal));
  if (!w) { console.warn(`no está la palabra "${pal}" en ${V.archivo}`); return 0; }
  return w[cual];
};

/* la línea de tiempo: dónde empieza cada línea, sus planos (enganchados a palabras o
   repartidos por peso), sus extras y el final */
export function armarDuo(id, lineas) {
  const M = DUOS[id];
  let t = INICIO;
  const L = lineas.map((V, i) => {
    const m = M.lineas[i], ini = i === 0 ? 0 : t, largo = (i === 0 ? INICIO : 0) + V.dur + HUECO + (m.pausa || 0);
    const voz = i === 0 ? INICIO : 0;          // la primera línea arranca después de la entrada
    const pl = (m.planos || []).map(([toma, desde, op = {}]) => ({ toma, desde, ...op }));
    /* los arranques: el primero al principio; los que dicen `en` a esa palabra; el resto, por peso */
    const arr = pl.map((p, k) => (k === 0 ? 0 : p.en ? voz + cuandoDice(V, p.en) - (p.antes ?? 0.1) : null));
    for (let k = 1; k <= pl.length; k++) {
      if (k < pl.length && arr[k] === null) continue;
      let a = k - 1; while (arr[a] === null) a--;
      const fin = k < pl.length ? arr[k] : largo, pesos = pl.slice(a, k).map((p) => p.peso ?? 1), total = pesos.reduce((s, x) => s + x, 0);
      let u = arr[a];
      for (let j = a; j < k; j++) { arr[j] = u; u += ((fin - arr[a]) * pesos[j - a]) / total; }
    }
    const planos = pl.map((p, k) => ({ ...p, t0: ini + arr[k], t1: ini + (k < pl.length - 1 ? arr[k + 1] : largo) }));
    const extras = (m.extras || []).map((e) => ({ ...e, t0: ini + voz + (e.palabra ? cuandoDice(V, e.palabra) : 0) + (e.mas || 0) }));
    const r = { ...V, ...m, i, ini, voz: ini + voz, fin: ini + largo, planos, extras };
    t = ini + largo;
    return r;
  });
  const cierre = { ini: t, fin: t + M.cierre.dur };
  /* dónde cambia de juego (la cortina) */
  const corte = L.find((l) => l.cortina);
  return { M, L, cierre, corte: corte ? corte.ini : null, total: Math.ceil(cierre.fin * FPS) };
}

export function Duo({ id, lineas, datos = {}, sinMusica }) {
  const A = useMemo(() => armarDuo(id, lineas), [id, lineas]);
  const f = useCurrentFrame(), t = f / FPS;
  const { M, L, cierre, corte } = A;
  const J = M.juegos, [K1, K2] = Object.keys(J), J1 = J[K1], J2 = J[K2];
  const actual = L.find((l) => t >= l.ini && t < l.fin) || (t >= cierre.ini ? L[L.length - 1] : L[0]);
  const Jl = J[actual.juego] || J1;
  const tl = t - actual.voz;
  /* la altura de los subtítulos: la del plano que se ve, la de la línea o la del juego */
  const planoAhora = actual.planos.find((P) => t >= P.t0 && t < P.t1);
  const yTexto = (planoAhora && planoAhora.yTexto) || actual.yTexto || (actual.forma !== 'partida' && Jl.yTexto) || M.yTexto || 1185;
  const hablando = actual.palabras.some((w) => tl >= w.t0 && tl < w.t1 + 0.05);
  const enFinal = t >= cierre.ini;
  /* mientras el cartel del título está en pantalla, los subtítulos esperan; si van arriba, hasta
     que el cartel (que se va para arriba) termina de salir, que si no lo pisan un par de cuadros */
  const conTitulo = actual.titulo && t - actual.ini - (actual.tituloMas || 0) < (actual.tituloDur || 1.9) - (yTexto < 1000 ? -0.03 : 0.25);
  const vozEn = (s) => L.some((l) => s >= l.voz && s < l.voz + l.dur);
  const fundidoFinal = (s) => 1 - suave((s - cierre.fin + 1.4) / 1.3);
  const musica = (k) => (fr) => {
    const s = fr / FPS, base = vozEn(s) ? (M.volVoz ?? 0.34) : (M.volSola ?? 0.8);
    const parte = corte === null ? 1 : k === 0 ? 1 - suave((s - corte - 0.1) / 0.6) : suave((s - corte + 0.25) / 0.4);
    return base * parte * suave(s / 0.5) * fundidoFinal(s);
  };
  const seq = (from, dur, hijo, key) => <Sequence key={key} from={Math.round(from * FPS)} durationInFrames={Math.max(1, Math.round(dur * FPS))}>{hijo}</Sequence>;

  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* los planos a pantalla entera, cada uno con lo que lo sigue (círculos, dedos) */}
      {L.flatMap((l) => (l.forma === 'partida' ? [] : l.planos.map((P, k) => seq(P.t0, P.t1 - P.t0, <Plano P={P} juego={P.toma.split('/')[0]} J={J[P.toma.split('/')[0]] || Jl} datos={datos[P.toma]} extras={l.extras} />, `p${l.i}-${k}`))))}
      {/* la pantalla partida (el gancho y el final) */}
      {L.filter((l) => l.forma === 'partida').map((l) => seq(l.ini, l.fin - l.ini + (l.i === L.length - 1 ? cierre.fin - cierre.ini : 0), <PartidaLinea l={l} J1={J1} J2={J2} />, 'pt' + l.i))}
      <Chispas t={t} colores={[Jl.color, Jl.color2 || '#fff']} a={0.45} />
      {/* entre línea y línea, un destello del color del juego (menos donde hay cortina) */}
      {L.slice(1).filter((l) => !l.cortina && l.forma !== 'partida').map((l) => { const u = (t - l.ini + 0.1) / 0.28; return u > 0 && u < 1 ? <Destello key={'d' + l.i} u={u} color={(J[l.juego] || J1).color} /> : null; })}
      {/* extras de pantalla (los que siguen algo van dentro del plano) */}
      {L.flatMap((l) => l.extras.map((e, k) => {
        const te = t - e.t0, Je = J[l.juego] || J1;
        if (e.tipo === 'chip') return <Chip key={l.i + '-' + k} texto={e.texto} t={te} dur={e.dur || 2} color={Je.color} tinta={Je.tinta} y={e.y || Je.yChip || 250} />;
        if (e.tipo === 'golpe') return <Golpe key={l.i + '-' + k} texto={e.texto} t={te} color={Je.color} tam={e.tam} />;
        if (e.tipo === 'salta') return <Salta key={l.i + '-' + k} t={te} texto={e.texto} color={Je.color} x={e.x} y={e.y} giro={e.giro} tam={e.tam} dur={e.dur} />;
        if (e.tipo === 'marco') return <Marco key={l.i + '-' + k} t={te} dur={e.dur || 2} rect={e.rect} texto={e.texto} color={Je.color} tinta={Je.tinta} arriba={e.arriba} />;
        return null;
      }))}
      {/* el título de cada juego y la cortina entre los dos */}
      {L.filter((l) => l.titulo).map((l) => <TituloJuego key={'t' + l.i} t={t - l.ini - (l.tituloMas || 0)} J={J[l.juego]} numero={l.juego === K1 ? '1' : '2'} dur={l.tituloDur || 1.9} />)}
      {corte !== null && <Cortina t={t - corte} J={J2} numero="2" />}
      {/* el gancho, los subtítulos, el narrador y la barra */}
      {L[0].forma === 'partida' && <Titular t={t} lineas={M.gancho} J1={J1} J2={J2} hasta={L[0].fin - 0.15} />}
      {!enFinal && !conTitulo && t >= actual.voz - 0.05 && <Karaoke linea={actual} t={tl} x={540} y={yTexto} color={Jl.color} tam={78} />}
      {actual.i === L.length - 1 && !enFinal && <Encuesta t={t - actual.ini} J1={J1} J2={J2} />}
      {enFinal && <Final t={t - cierre.ini} J1={J1} J2={J2} />}
      {!enFinal && actual.sticker && <Narrador cara={actual.sticker} desdeCambio={t - actual.ini} t={t} hablando={hablando} x={18} y={M.ySticker || 1330} tam={M.tamSticker || 290} />}
      <Barra u={clamp(t / cierre.fin)} color={Jl.color} />

      {/* el sonido: la música de cada juego en su parte, la voz y los efectos */}
      {!sinMusica && <Audio src={staticFile(J1.musica)} volume={musica(0)} />}
      {!sinMusica && corte !== null && seq(Math.max(0, corte - 0.3), cierre.fin - corte + 0.3, <Audio src={staticFile(J2.musica)} volume={(fr) => musica(1)(fr + Math.round(Math.max(0, corte - 0.3) * FPS))} />, 'm2')}
      {L.map((l) => seq(l.voz, l.dur + 0.3, <Audio src={staticFile(`${M.voz}/${l.archivo}`)} volume={1} />, 'v' + l.i))}
      {L.map((l) => seq(l.ini, 0.4, <Audio src={staticFile('sfx/pop.wav')} volume={0.3} />, 'po' + l.i))}
      {L.slice(1).map((l) => seq(Math.max(0, l.ini - 0.12), 0.5, <Audio src={staticFile('sfx/whoosh.wav')} volume={l.cortina ? 0.7 : 0.35} />, 'w' + l.i))}
      {L.filter((l) => l.titulo).map((l) => seq(l.ini + 0.2 + (l.tituloMas || 0), 0.9, <Audio src={staticFile('sfx/golpe.wav')} volume={0.5} />, 'tg' + l.i))}
      {L.flatMap((l) => l.extras.filter((e) => ['chip', 'golpe', 'salta', 'marco'].includes(e.tipo)).map((e, k) => seq(e.t0, 0.9, <Audio src={staticFile(`sfx/${e.tipo === 'golpe' ? 'golpe' : e.tipo === 'salta' ? 'pop' : 'ding'}.wav`)} volume={e.tipo === 'golpe' ? 0.55 : 0.3} />, 'x' + l.i + '-' + k)))}
      {seq(cierre.ini, 1.1, <Audio src={staticFile('sfx/ding.wav')} volume={0.5} />, 'fin')}
    </AbsoluteFill>
  );
}

/* un plano: el pedazo de toma con su cámara, y lo que va enganchado a lo que se ve en él */
function Plano({ P, J, datos, extras }) {
  const f = useCurrentFrame(), t = f / FPS, c = camara(P, t);
  const k = Math.max(0, Math.round((P.desde + t) * FPS));
  const dato = (n) => (datos ? datos[Math.min(datos.length - 1, Math.max(0, n))] : null);
  const enPantalla = (campo, n = k) => { const d = dato(n); return d && d[campo] ? aPantalla(c, d[campo]) : null; };
  /* lo que sigue algo del plano: los extras de la línea con `toma` igual a este plano */
  const mios = (extras || []).filter((e) => e.toma === P.toma && ['sigue', 'arrastre'].includes(e.tipo));
  /* los toques del bot (cortes, toques, deslizamientos) que caen dentro del plano */
  const toques = [];
  if (datos && P.dedos !== false) {
    const k0 = Math.round(P.desde * FPS), k1 = k0 + Math.round((P.t1 - P.t0) * FPS);
    for (let n = Math.max(0, k0 - 4); n < Math.min(datos.length, k1); n++) {
      const d = datos[n];
      if (!d) continue;
      for (const q of d.toques || []) toques.push({ n, tipo: q.tipo, en: aPantalla(camara(P, (n - k0) / FPS), q.en) });
      for (const dir of d.desliza || []) toques.push({ n, tipo: 'desliza', en: [540, 1395], dir });
    }
  }
  return (
    <AbsoluteFill>
      <Toma src={staticFile(`tomas/${P.toma}.mp4`)} desde={P.desde} c={c} />
      {toques.map((q, i) => <Dedo key={i} t={t - (q.n - Math.round(P.desde * FPS)) / FPS} tipo={q.tipo} en={q.en} dir={q.dir} />)}
      {mios.map((e, i) => {
        const te = (P.t0 + t) - e.t0;
        if (e.tipo === 'sigue') {
          /* suavizado: el promedio de tres cuadros, así el anillo no tiembla */
          const ps = [k - 1, k, k + 1].map((n) => enPantalla(e.campo, n)).filter(Boolean);
          const pos = ps.length ? [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length] : null;
          return <Sigue key={'s' + i} t={te} dur={e.dur || 1.8} pos={pos} texto={e.texto} color={J.color} tinta={J.tinta} r={e.r} lado={e.lado || 1} />;
        }
        const d = dato(k);
        const rel = d && d.e && d.g ? [(d.e[0] - d.g[0]) * 2.5, (d.e[1] - d.g[1]) * 2.5] : null;
        return <Arrastre key={'a' + i} t={te} dur={e.dur || 2} rel={rel} />;
      })}
    </AbsoluteFill>
  );
}

/* la pantalla partida de una línea (gancho o final) */
function PartidaLinea({ l, J1, J2 }) {
  const f = useCurrentFrame(), t = f / FPS;
  return <Partida t={t} arriba={l.arriba} abajo={l.abajo} J1={J1} J2={J2} junta={l.junta ? l.fin - l.ini - 0.5 : null} numeros />;
}
