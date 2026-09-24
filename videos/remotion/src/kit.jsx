/* ============================================================================
   videos/remotion/src/kit.jsx — las piezas de los videos relatados: el
   sticker que cuenta (cambia de cara en cada línea y rebota cuando habla),
   los subtítulos tipo karaoke, los carteles que entran de costado, el golpe
   de texto, los memes que aparecen en el remate, la barra de progreso, el
   gancho del principio, las luciérnagas y el cierre. Todo depende solo del
   cuadro, así Remotion puede dibujar cualquiera suelto.
   ========================================================================== */
import React from 'react';
import { Img, staticFile } from 'remotion';

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const suave = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const sale = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const rebote = (x) => { x = clamp(x); const c = 1.70158 * 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
export const azar = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
export const LETRA = 'Nunito, "Noto Color Emoji", sans-serif';
export const SANS = '"Open Sans", "Noto Color Emoji", sans-serif';
const lleno = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };

/* texto grueso con borde y sombra dura, como los subtítulos de TikTok */
export function Grueso({ texto, tam, color = '#fff', borde = '#000', sombra = 'rgba(0,0,0,0.55)', style }) {
  const base = { font: `900 ${tam}px ${LETRA}`, lineHeight: 1.05, whiteSpace: 'pre', letterSpacing: tam * 0.01 };
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <div style={{ ...base, color: borde, WebkitTextStroke: `${tam * 0.2}px ${borde}`, transform: `translateY(${tam * 0.07}px)`, filter: `drop-shadow(0 ${tam * 0.06}px ${tam * 0.05}px ${sombra})` }}>{texto}</div>
      <div style={{ ...base, position: 'absolute', left: 0, top: 0, color }}>{texto}</div>
    </div>
  );
}

/* ------------------------------------------------------------ subtítulos tipo karaoke */
/* las palabras de la línea en tandas de hasta 3 (o 16 letras), cortando en los signos */
export function tandas(palabras) {
  const out = []; let cur = [];
  for (const w of palabras) {
    const largo = cur.reduce((s, x) => s + x.p.length + 1, 0) + w.p.length;
    if (cur.length && (cur.length >= 3 || largo > 16)) { out.push(cur); cur = []; }
    cur.push(w);
    if (/[.,:;!?…]$/.test(w.p)) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}
export function Karaoke({ linea, t, x, y, color, tam = 84 }) {
  const ts = tandas(linea.palabras);
  let k = ts.findIndex((g, i) => t >= g[0].t0 - 0.05 && (i === ts.length - 1 || t < ts[i + 1][0].t0 - 0.05));
  if (k < 0) return null;
  const g = ts[k], t0 = g[0].t0, fin = g[g.length - 1].t1;
  if (k === ts.length - 1 && t > fin + 0.5) return null;
  const e = rebote((t - t0 + 0.05) / 0.22);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${0.85 + 0.15 * e})`, maxWidth: 1000, width: 'max-content', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `4px ${tam * 0.42}px`,
      padding: `${tam * 0.18}px ${tam * 0.45}px ${tam * 0.3}px`, borderRadius: tam * 0.5, background: 'rgba(0,0,0,0.42)' }}>
      {g.map((w, i) => {
        const activa = t >= w.t0 - 0.03 && t < (g[i + 1] ? g[i + 1].t0 : w.t1 + 0.4);
        const txt = w.p.toUpperCase();
        return <Grueso key={i} texto={txt} tam={tam} color={activa ? color : '#ffffff'} style={{ transform: `scale(${activa ? 1.08 : 1})`, transition: 'none' }} />;
      })}
    </div>
  );
}

/* ------------------------------------------------------------ el sticker que cuenta */
/* cambia de cara con un saltito; mientras habla, se hamaca un poco con cada palabra */
export function Narrador({ cara, desdeCambio, t, hablando, x, y, tam = 420, lado = 'izq' }) {
  const e = rebote(desdeCambio / 0.35);
  const bob = hablando ? Math.abs(Math.sin(t * 9)) * 10 : Math.sin(t * 2) * 4;
  const giro = Math.sin(t * 1.7) * 3 + (1 - clamp(desdeCambio / 0.3)) * (lado === 'izq' ? -10 : 10);
  return (
    <div style={{ position: 'absolute', left: x, top: y - bob, width: tam, height: tam, transform: `scale(${0.6 + 0.4 * e}) rotate(${giro}deg)`, transformOrigin: '50% 100%' }}>
      <Img src={staticFile(`stickers/${cara}.png`)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.45))' }} />
    </div>
  );
}

/* ------------------------------------------------------------ cartel que entra de costado */
export function Chip({ texto, t, dur, color, tinta, y = 330 }) {
  if (t < 0 || t > dur) return null;
  const a = sale(t / 0.3), b = 1 - suave((t - dur + 0.25) / 0.25);
  return (
    <div style={{ position: 'absolute', left: 40 - (1 - a) * 600, top: y, opacity: b, transform: `rotate(${-3 + 3 * a}deg) scale(${0.9 + 0.1 * rebote(t / 0.4)})`, transformOrigin: '0 50%',
      padding: '18px 34px', borderRadius: 999, background: color, boxShadow: `0 10px 0 ${tinta}, 0 18px 30px rgba(0,0,0,0.45)`, border: `5px solid ${tinta}` }}>
      <span style={{ font: `900 58px ${LETRA}`, color: tinta, whiteSpace: 'nowrap' }}>{texto}</span>
    </div>
  );
}

/* ------------------------------------------------------------ golpe de texto (con temblor) */
export function Golpe({ texto, t, color, tam = 230 }) {
  if (t < 0 || t > 1.1) return null;
  const k = 1.8 - 0.8 * sale(t / 0.18), a = 1 - suave((t - 0.85) / 0.25);
  const dx = (azar(Math.floor(t * 60), 1) - 0.5) * 30 * (1 - clamp(t / 0.5)), dy = (azar(Math.floor(t * 60), 2) - 0.5) * 30 * (1 - clamp(t / 0.5));
  return (
    <div style={{ position: 'absolute', left: 540 + dx, top: 760 + dy, transform: `translate(-50%, -50%) scale(${k}) rotate(-6deg)`, opacity: a }}>
      <Grueso texto={texto} tam={tam} color={color} borde="#000" />
    </div>
  );
}

/* ------------------------------------------------------------ el meme que aparece en el remate */
/* texto: el renglón de arriba; paneles: los textos dentro de la plantilla, como
   [x0, y0, x1, y1, texto] en fracciones de la imagen (Drake, Panik…), que van
   apareciendo de a uno */
export function Meme({ archivo, texto, t, dur, paneles, ancho = 760, tamPanel = 46 }) {
  if (t < 0 || t > dur) return null;
  const e = rebote(t / 0.35), b = 1 - suave((t - dur + 0.2) / 0.2);
  const giro = (azar(archivo.length, 3) - 0.5) * (paneles ? 6 : 12);
  const paso = paneles ? Math.min(0.55, (dur - 0.9) / paneles.length) : 0;
  return (
    <div style={{ position: 'absolute', left: 540, top: 640, transform: `translate(-50%, -50%) scale(${e * (0.97 + 0.03 * Math.sin(t * 20))}) rotate(${giro}deg)`, opacity: b,
      padding: 14, background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
      {texto && <div style={{ width: ancho, padding: '6px 10px 14px', font: `900 52px ${LETRA}`, lineHeight: 1.1, color: '#111', textAlign: 'center' }}>{texto}</div>}
      <div style={{ position: 'relative', width: ancho }}>
        <Img src={staticFile(`memes/${archivo}`)} style={{ display: 'block', width: ancho, maxHeight: paneles ? 'none' : 660, objectFit: 'contain', borderRadius: 8 }} />
        {(paneles || []).map(([x0, y0, x1, y1, txt], i) => {
          const u = sale((t - 0.25 - i * paso) / 0.2);
          return (
            <div key={i} style={{ position: 'absolute', left: `${x0 * 100}%`, top: `${y0 * 100}%`, width: `${(x1 - x0) * 100}%`, height: `${(y1 - y0) * 100}%`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 10, boxSizing: 'border-box', textAlign: 'center', font: `900 ${tamPanel}px ${LETRA}`, lineHeight: 1.08, color: '#111', opacity: u, transform: `scale(${0.8 + 0.2 * u})` }}>{txt}</div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ el gancho del principio */
export function Gancho({ texto, t, hasta, color, tinta, y = 300 }) {
  if (t > hasta) return null;
  const e = rebote(t / 0.45), b = 1 - suave((t - hasta + 0.3) / 0.3);
  return (
    <div style={{ position: 'absolute', left: 540, top: y, transform: `translate(-50%, -50%) scale(${e}) rotate(-2deg)`, opacity: b, padding: '22px 40px', borderRadius: 26,
      background: '#fff', boxShadow: `0 12px 0 ${tinta}, 0 24px 40px rgba(0,0,0,0.5)`, border: `6px solid ${tinta}`, whiteSpace: 'pre', textAlign: 'center', lineHeight: 1.05 }}>
      <span style={{ font: `900 80px ${LETRA}`, color: tinta }}>{texto}</span>
    </div>
  );
}

/* ------------------------------------------------------------ barra de progreso arriba */
export function Barra({ u, color }) {
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 12, background: 'rgba(0,0,0,0.35)' }}>
      <div style={{ width: `${u * 100}%`, height: '100%', background: color, boxShadow: `0 0 16px ${color}` }} />
    </div>
  );
}

/* ------------------------------------------------------------ luciérnagas (LUZ MALA) */
export function Luciernagas({ t, cuantas = 26, a = 1 }) {
  return (
    <div style={{ ...lleno, pointerEvents: 'none', mixBlendMode: 'screen', opacity: a }}>
      {Array.from({ length: cuantas }, (_, i) => {
        const x = azar(i, 1) * 1080 + Math.sin(t * (0.4 + azar(i, 2)) + i) * 60, y = 1920 - ((azar(i, 3) * 1920 + t * (30 + azar(i, 4) * 50)) % 2100);
        const k = 0.5 + 0.5 * Math.sin(t * (2 + azar(i, 5) * 3) + i * 2), r = 6 + azar(i, 6) * 10;
        return <div key={i} style={{ position: 'absolute', left: x - r * 3, top: y - r * 3, width: r * 6, height: r * 6, borderRadius: '50%', opacity: k,
          background: 'radial-gradient(circle, rgba(255,250,190,1) 0%, rgba(255,210,90,0.6) 18%, rgba(255,160,40,0) 60%)' }} />;
      })}
    </div>
  );
}

/* ------------------------------------------------------------ papelitos (KUNTUR) */
/* papel picado de colores de aguayo que cae despacio, dando vueltas */
const AGUAYO = ['#e8364f', '#f7931e', '#ffd23f', '#2bb673', '#2f6fdf', '#8e3fbf', '#ff5fa2'];
export function Papelitos({ t, cuantos = 34 }) {
  return (
    <div style={{ ...lleno, pointerEvents: 'none' }}>
      {Array.from({ length: cuantos }, (_, i) => {
        const x = azar(i, 1) * 1080 + Math.sin(t * (0.5 + azar(i, 2)) + i) * 50, y = ((azar(i, 3) * 2100 + t * (45 + azar(i, 4) * 60)) % 2100) - 90;
        const w = 16 + azar(i, 5) * 18, h = w * (0.5 + azar(i, 6) * 0.4), giro = t * (60 + azar(i, 7) * 120) + i * 40, voltea = Math.cos(t * (2 + azar(i, 8) * 2) + i);
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: AGUAYO[i % AGUAYO.length], opacity: 0.85,
          transform: `rotate(${giro}deg) scaleY(${voltea})`, boxShadow: '0 2px 4px rgba(0,0,0,0.25)' }} />;
      })}
    </div>
  );
}

/* las guardas tejidas arriba y abajo de la franja del juego (KUNTUR) */
export function Guardas({ F }) {
  const guarda = { position: 'absolute', left: 0, width: 1080, height: 18,
    background: `repeating-linear-gradient(90deg, ${AGUAYO.map((c, i) => `${c} ${i * 18}px, ${c} ${(i + 1) * 18}px`).join(', ')})`,
    boxShadow: '0 3px 0 rgba(0,0,0,0.35), 0 -3px 0 rgba(0,0,0,0.35)' };
  const rombos = { position: 'absolute', left: 0, width: 1080, height: 10, background: 'repeating-linear-gradient(135deg, #fff5e0 0 7px, #7a1d2e 7px 14px)' };
  return (
    <>
      <div style={{ ...guarda, top: F.y - 18 }} /><div style={{ ...rombos, top: F.y - 28 }} />
      <div style={{ ...guarda, top: F.y + F.alto }} /><div style={{ ...rombos, top: F.y + F.alto + 18 }} />
    </>
  );
}

/* ------------------------------------------------------------ destello entre líneas */
export function Destello({ u, color }) {
  if (u <= 0 || u >= 1) return null;
  const a = u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65;
  return <div style={{ ...lleno, opacity: a * 0.85, background: `radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.95), ${color} 35%, rgba(0,0,0,0) 75%)`, mixBlendMode: 'screen' }} />;
}

/* ------------------------------------------------------------ el cierre */
export function Cierre({ t, cta, nombre, color, tinta }) {
  const e1 = rebote((t - 0.1) / 0.4), e2 = rebote((t - 0.45) / 0.4);
  return (
    <>
      <div style={{ ...lleno, background: 'linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.65))' }} />
      <div style={{ position: 'absolute', left: 540, top: 1180, transform: `translate(-50%, -50%) scale(${e1})`, padding: '26px 50px', borderRadius: 999, background: color,
        border: `7px solid ${tinta}`, boxShadow: `0 14px 0 ${tinta}, 0 26px 40px rgba(0,0,0,0.5)`, whiteSpace: 'nowrap' }}>
        <span style={{ font: `900 84px ${LETRA}`, color: tinta }}>{cta[0]}</span>
      </div>
      <div style={{ position: 'absolute', left: 540, top: 1330, transform: `translate(-50%, -50%) scale(${e2})` }}>
        <Grueso texto={cta[1]} tam={66} />
      </div>
    </>
  );
}
