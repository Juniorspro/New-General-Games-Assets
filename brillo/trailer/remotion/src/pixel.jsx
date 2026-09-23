/* ============================================================================
   remotion/src/pixel.jsx — los motion graphics en pixel art, a la misma escala
   que el juego (un píxel del juego = 6 px del video): chispas, la transición
   de cuadraditos, el texto que entra palabra por palabra con sombra dura, el
   glitch del Plano y los tres puntitos de "escribiendo".
   ========================================================================== */
import React from 'react';
import { azar, clamp, rebote, sale, suave, REDONDA, MONO } from './aero.jsx';

export const PX = 6;
const lleno = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };

/* ------------------------------------------------------------ chispas */
/* una chispa de pixel art: una cruz de cuadraditos que crece, brilla y se apaga */
function Chispa({ x, y, k, color = '#ffffff', borde = '#7fd8ff' }) {
  if (k <= 0) return null;
  const n = Math.max(1, Math.round(3 * Math.sin(Math.PI * clamp(k)))), c = [];
  const cx = Math.round(x / PX) * PX, cy = Math.round(y / PX) * PX;
  for (let i = -n; i <= n; i++) {
    const f = Math.abs(i) === n ? borde : color;
    c.push(<rect key={'h' + i} x={cx + i * PX} y={cy} width={PX} height={PX} fill={f} />);
    if (i) c.push(<rect key={'v' + i} x={cx} y={cy + i * PX} width={PX} height={PX} fill={f} />);
  }
  if (n >= 2) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) c.push(<rect key={`d${dx}${dy}`} x={cx + dx * PX} y={cy + dy * PX} width={PX} height={PX} fill={borde} opacity={0.7} />);
  return <g>{c}</g>;
}
/* un estallido de chispas alrededor de (x, y), que arranca en t = 0 */
export function Chispas({ W, H, x, y, t, radio = 220, cuantas = 10, semilla = 1, dur = 0.9, color, borde }) {
  if (t < 0 || t > dur + 0.6) return null;
  return (
    <svg style={lleno} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">
      {Array.from({ length: cuantas }, (_, i) => {
        const an = azar(semilla + i, 1) * Math.PI * 2, r = radio * (0.45 + azar(semilla + i, 2) * 0.55);
        const t0 = azar(semilla + i, 3) * 0.35, k = (t - t0) / (dur * (0.6 + azar(semilla + i, 4) * 0.4));
        const d = sale(k) * r;
        return <Chispa key={i} x={x + Math.cos(an) * d} y={y + Math.sin(an) * d} k={k} color={color} borde={borde} />;
      })}
    </svg>
  );
}
/* chispas que titilan quietas en una zona (para el logo y el cierre) */
export function Titilan({ W, H, t, zona, cuantas = 14, semilla = 7 }) {
  return (
    <svg style={lleno} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">
      {Array.from({ length: cuantas }, (_, i) => {
        const per = 1.1 + azar(semilla + i, 5) * 1.2, k = ((t + azar(semilla + i, 6) * per) % per) / per;
        return <Chispa key={i} x={zona.x + azar(semilla + i, 7) * zona.w} y={zona.y + azar(semilla + i, 8) * zona.h} k={k} />;
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ la transición de cuadraditos */
/* u va de 0 a 1 a lo largo de la transición: en la primera mitad los cuadros tapan lo viejo
   (en diagonal, de abajo a la izquierda), en la segunda se van y aparece lo nuevo */
const COLORES = ['#ffffff', '#bfeaff', '#7fd0ff', '#3fa6ee'];
export function Cuadraditos({ W, H, u, lado = 120 }) {
  if (u <= 0 || u >= 1) return null;
  const cols = Math.ceil(W / lado), filas = Math.ceil(H / lado), cs = [];
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    const umbral = ((c / cols) * 0.45 + ((filas - f) / filas) * 0.45 + azar(c * 31 + f, 9) * 0.1);
    const tapa = u < 0.5 ? clamp((u * 2 - umbral) / 0.18) : 1 - clamp(((u - 0.5) * 2 - umbral) / 0.18);
    if (tapa <= 0) continue;
    const s = Math.round((lado * tapa) / PX) * PX, o = (lado - s) / 2;
    cs.push(<rect key={f * cols + c} x={c * lado + o} y={f * lado + o} width={s} height={s} fill={COLORES[(c + f * 3) % 4]} />);
  }
  return <svg style={lleno} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">{cs}</svg>;
}

/* ------------------------------------------------------------ texto con sombra dura */
/* Nunito gruesa, borde azul oscuro y una sombra de pixel art (sin desenfoque), como los carteles del juego */
export function Titular({ texto, tam = 120, color = '#ffffff', borde = '#0b3f8f', sombra = '#062a66', mono = false, style }) {
  const base = { font: `900 ${tam}px ${mono ? MONO : REDONDA}`, lineHeight: 1.08, whiteSpace: 'pre-wrap', textAlign: 'center', letterSpacing: mono ? tam * 0.02 : 0 };
  const cap = { ...base, position: 'absolute', left: 0, top: 0, width: '100%' };
  const d = Math.max(PX, Math.round(tam * 0.07 / PX) * PX);
  return (
    <div style={{ position: 'relative', ...style }}>
      <div style={{ ...base, color: sombra, WebkitTextStroke: `${tam * 0.16}px ${sombra}`, transform: `translate(${d}px, ${d}px)` }}>{texto}</div>
      <div style={{ ...cap, color: borde, WebkitTextStroke: `${tam * 0.16}px ${borde}` }}>{texto}</div>
      <div style={{ ...cap, color }}>{texto}</div>
    </div>
  );
}
/* palabra por palabra: cada una salta en su momento (t en s desde que empieza) */
export function Palabras({ texto, t, paso = 0.09, tam = 120, ancho = 940, color, borde, sombra, mono, alinear = 'center' }) {
  const ps = texto.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: alinear, gap: `0 ${tam * 0.28}px`, width: ancho }}>
      {ps.map((p, i) => {
        const tp = t - i * paso;
        if (tp <= 0) return <div key={i} style={{ opacity: 0 }}><Titular texto={p} tam={tam} mono={mono} /></div>;
        return (
          <div key={i} style={{ transform: `translateY(${(1 - sale(tp / 0.25)) * tam * 0.35}px) scale(${rebote(tp / 0.32)})`, opacity: clamp(tp / 0.08) }}>
            <Titular texto={p} tam={tam} color={color} borde={borde} sombra={sombra} mono={mono} />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ "escribiendo…" */
export function Puntitos({ t, color = '#6a7c94' }) {
  return (
    <div style={{ display: 'flex', gap: PX * 2, alignItems: 'flex-end', height: PX * 5 }}>
      {[0, 1, 2].map((i) => <div key={i} style={{ width: PX * 2, height: PX * 2, background: color, transform: `translateY(${-Math.round(Math.max(0, Math.sin(t * 9 - i * 0.9)) * 2) * PX}px)` }} />)}
    </div>
  );
}

/* ------------------------------------------------------------ las rayas de glitch del Plano */
/* g de 0 a 1: cuánto glitch hay. Devuelve bandas (y, alto, corrimiento) siempre iguales para el mismo cuadro */
export function bandasGlitch(g, cuadro, H) {
  if (g <= 0) return [];
  const n = 3 + Math.round(g * 5), out = [];
  for (let i = 0; i < n; i++) {
    const y = Math.floor(azar(cuadro * 7 + i, 1) * H / PX) * PX, alto = Math.max(PX * 4, Math.floor(azar(cuadro * 7 + i, 2) * 140 * g / PX) * PX);
    out.push({ y, alto, dx: Math.round((azar(cuadro * 7 + i, 3) - 0.5) * 160 * g / PX) * PX });
  }
  return out;
}
export function Rayas({ g, cuadro, W, H }) {
  if (g <= 0) return null;
  return (
    <svg style={{ ...lleno, mixBlendMode: 'screen' }} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">
      {bandasGlitch(g, cuadro + 101, H).map((b, i) => <rect key={i} x={0} y={b.y} width={W} height={Math.max(PX, b.alto / 4)} fill={i % 2 ? 'rgba(255,40,90,0.55)' : 'rgba(40,230,255,0.55)'} />)}
    </svg>
  );
}
