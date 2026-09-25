/* ============================================================================
   aeroplaza/trailer/remotion/src/kit.jsx — las piezas del tráiler, con el estilo
   de la interfaz de AEROPLAZA (no el de BRILLO): tarjetas blancas estilo Wii con
   rayas grises, el logo AERO/PLAZA azul y verde, los avisos de Windows 7, el
   botón Frutiger con onda de luz, la mano de Wii y las ventanas de error de
   Aero.exe. Todo sale del número de cuadro (nada de animaciones de CSS): así
   Remotion dibuja cualquier cuadro suelto igual.
   ========================================================================== */
import React from 'react';

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const suave = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const sale = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const rebote = (x) => { x = clamp(x); const c = 1.70158 * 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
export const azar = (i, k = 0) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

export const LETRA = 'Nunito, "Open Sans", sans-serif';
export const C = { azul: '#34bef0', azul2: '#1aa0d8', verde: '#56d05a', tinta: '#5b6168', tinta2: '#8a9098', gris2: '#d9dde1', fondo: '#eceff2', rosa: '#ff6fb0', aqua: '#43d8cd' };
/* la zona segura de TikTok: nada importante arriba de 220 px, abajo de 1500 ni en los 120 px de la derecha */
export const ZONA = { x0: 60, x1: 960, y0: 240, y1: 1480, cx: 510 };
export const lleno = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };

/* las rayas grises finas del fondo de la interfaz (la precarga y las tarjetas) */
export const RAYAS = 'repeating-linear-gradient(0deg, #f4f6f8 0 3px, #e9ecef 3px 4px)';

/* ------------------------------------------------------------ el logo: AERO azul, PLAZA verde */
export function Logo({ f, tam = 150, entra = 0, brillo = true, style }) {
  const k = rebote((f - entra) / 16), barrido = ((f - entra - 10) % 75) / 75;
  const letra = (txt, col, i0) => txt.split('').map((ch, i) => {
    const j = i0 + i, u = rebote((f - entra - j * 1.6) / 14);
    return <span key={j} style={{ display: 'inline-block', color: col, transform: `translateY(${(1 - u) * 60}px) scale(${0.6 + 0.4 * u})`, opacity: clamp(u * 1.5) }}>{ch}</span>;
  });
  return (
    <div style={{ position: 'relative', fontFamily: LETRA, fontWeight: 900, fontSize: tam, letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap', transform: `scale(${0.85 + 0.15 * k})`,
      WebkitTextStroke: `${Math.round(tam * 0.06)}px #ffffff`, paintOrder: 'stroke fill',
      textShadow: `0 ${tam * 0.05}px 0 rgba(20,90,150,0.35), 0 ${tam * 0.1}px ${tam * 0.22}px rgba(0,60,120,0.45)`, ...style }}>
      {letra('AERO', C.azul, 0)}{letra('PLAZA', C.verde, 4)}
      {brillo && barrido > 0 && barrido < 0.35 && (
        <div style={{ ...lleno, background: `linear-gradient(105deg, transparent ${barrido * 300 - 30}%, rgba(255,255,255,0.85) ${barrido * 300 - 10}%, transparent ${barrido * 300 + 10}%)`, mixBlendMode: 'screen', WebkitMaskImage: 'linear-gradient(#000,#000)', pointerEvents: 'none' }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ la tarjeta blanca estilo Wii */
export function Tarjeta({ children, style, rayas = false }) {
  return (
    <div style={{ background: rayas ? RAYAS : 'linear-gradient(#ffffff, #f2f4f6)', border: `5px solid ${C.gris2}`, borderRadius: 44, boxShadow: '0 6px 0 rgba(0,0,0,0.06), 0 18px 50px rgba(40,60,80,0.28)', color: C.tinta, fontFamily: LETRA, fontWeight: 800, ...style }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ el aviso de Windows 7 (el de arriba del juego) */
export function Aviso({ f, entra = 0, sale: salida = 999, icono = '🔔', txt, sub }) {
  const u = sale((f - entra) / 8), v = 1 - sale((f - salida) / 8);
  if (f < entra || f > salida + 8) return null;
  return (
    <div style={{ position: 'absolute', left: ZONA.cx - 330, top: 250 + (1 - u) * -40, width: 660, opacity: Math.min(u, v), display: 'flex', gap: 22, alignItems: 'center', padding: '20px 28px', borderRadius: 18,
      background: 'linear-gradient(180deg, rgba(255,255,255,0.97), rgba(226,244,255,0.95) 55%, rgba(210,236,252,0.95))', border: '2px solid #fff', boxShadow: '0 0 0 2px rgba(70,140,200,0.35), 0 16px 40px rgba(20,60,110,0.3)', fontFamily: LETRA, color: '#1d4a6e' }}>
      <div style={{ fontSize: 58, lineHeight: 1 }}>{icono}</div>
      <div><div style={{ fontSize: 40, fontWeight: 900 }}>{txt}</div>{sub && <div style={{ fontSize: 28, fontWeight: 700, color: '#4a7394' }}>{sub}</div>}</div>
    </div>
  );
}

/* ------------------------------------------------------------ el botón Frutiger con su onda de luz */
export function Boton({ f, txt, color = C.verde, onda = -1, style }) {
  const t = f - onda, r = onda >= 0 && t >= 0 ? sale(t / 18) : 0;
  return (
    <div style={{ position: 'relative', display: 'inline-block', padding: '30px 80px', borderRadius: 999, fontFamily: LETRA, fontWeight: 900, fontSize: 64, color: '#fff', letterSpacing: '0.02em',
      background: `linear-gradient(180deg, #ffffff66 0%, #ffffff22 45%, transparent 50%), linear-gradient(180deg, ${color}, ${color}cc)`, border: '5px solid #ffffffcc',
      boxShadow: `0 10px 0 rgba(0,0,0,0.12), 0 20px 50px ${color}88, inset 0 -8px 16px rgba(0,0,0,0.12)`, textShadow: '0 3px 0 rgba(0,0,0,0.18)', transform: `scale(${1 - (t >= 0 && t < 6 ? 0.06 * Math.sin(t / 6 * Math.PI) : 0)})`, ...style }}>
      {txt}
      {r > 0 && r < 1 && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 900 * r, height: 900 * r, marginLeft: -450 * r, marginTop: -450 * r, borderRadius: '50%', border: `${10 * (1 - r)}px solid rgba(255,255,255,${0.9 * (1 - r)})`, pointerEvents: 'none' }} />}
    </div>
  );
}

/* ------------------------------------------------------------ la mano de Wii (el puntero) */
export function Mano({ x, y, aprieta = 0, style }) {
  return (
    <div style={{ position: 'absolute', left: x - 30, top: y - 12, fontSize: 120, transform: `rotate(-18deg) scale(${1 - aprieta * 0.12})`, filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.3))', ...style }}>👆</div>
  );
}

/* ------------------------------------------------------------ burbujas que suben (brillo de jabón) */
export function Burbujas({ f, n = 16, semilla = 1, alfa = 1, tam = [40, 140], velocidad = 1 }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = tam[0] + azar(i, semilla) * (tam[1] - tam[0]), v = (0.6 + azar(i, semilla + 1) * 0.9) * velocidad;
    const y = 1980 - ((azar(i, semilla + 2) * 2200 + f * v * 4.2) % 2300), x = azar(i, semilla + 3) * 1080 + Math.sin(f * 0.03 + i) * 30;
    out.push(
      <div key={i} style={{ position: 'absolute', left: x - r / 2, top: y - r / 2, width: r, height: r, borderRadius: '50%', opacity: alfa,
        background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.95) 0 8%, rgba(255,255,255,0.15) 16%, transparent 45%), radial-gradient(circle at 50% 50%, transparent 58%, rgba(190,235,255,0.35) 72%, rgba(255,190,240,0.45) 86%, rgba(255,255,255,0.7) 100%)',
        boxShadow: 'inset 0 0 12px rgba(255,255,255,0.35)' }} />,
    );
  }
  return <div style={lleno}>{out}</div>;
}

/* ------------------------------------------------------------ la ventana de error de Aero.exe (Windows 7) */
export function VentanaError({ x, y, w = 760, titulo = 'Aero.exe', txt, f = 0, tiembla = 0, escala = 1 }) {
  const dx = tiembla ? (azar(f, 3) - 0.5) * tiembla : 0, dy = tiembla ? (azar(f, 5) - 0.5) * tiembla : 0;
  return (
    <div style={{ position: 'absolute', left: x + dx, top: y + dy, width: w, transform: `scale(${escala})`, transformOrigin: 'center', borderRadius: 14, overflow: 'hidden', fontFamily: '"Segoe UI", "Open Sans", sans-serif',
      boxShadow: '0 0 0 2px rgba(0,0,0,0.35), 0 24px 60px rgba(0,0,0,0.45)', background: 'linear-gradient(180deg, rgba(160,200,235,0.92), rgba(120,170,215,0.92))' }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 20px', color: '#fff', fontSize: 30, fontWeight: 700, textShadow: '0 0 8px rgba(0,0,0,0.5)', background: 'linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.05))' }}>
        {titulo}<div style={{ marginLeft: 'auto', width: 64, height: 38, borderRadius: 8, background: 'linear-gradient(180deg, #f08a7a, #c8321e)', border: '2px solid rgba(255,255,255,0.7)', display: 'grid', placeItems: 'center', fontSize: 26 }}>✕</div>
      </div>
      <div style={{ margin: '0 10px 10px', background: '#fff', borderRadius: 6, padding: '30px 30px 26px', display: 'flex', gap: 26, alignItems: 'center' }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #ff9a8a, #d11f1f 60%, #8a0b0b)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 58, fontWeight: 900, flex: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>✕</div>
        <div style={{ fontSize: 34, color: '#1b2b3a', lineHeight: 1.25 }}>{txt}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, padding: '0 20px 20px' }}>
        {['Cerrar programa', 'Esperar'].map((b) => <div key={b} style={{ padding: '10px 26px', borderRadius: 6, border: '2px solid #7f9db9', background: 'linear-gradient(#fdfdfd, #dfe7ef)', fontSize: 26, color: '#1b2b3a' }}>{b}</div>)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ la palabra gigante rota (DESPIERTA, WAKE UP…) */
export function Palabra({ f, txt, tam: tam0 = 230, color = '#ffffff', y = 820, semilla = 1 }) {
  /* (que entre en 960 px: Nunito Black ocupa ~0,66 em por letra en mayúsculas) */
  const tam = Math.min(tam0, 960 / (txt.length * 0.66));
  const N = 7, alto = tam * 1.15, t = Math.floor(f / 2);
  const capa = (col, dx, blend) => (
    <div style={{ position: 'absolute', left: 0, width: 1080, textAlign: 'center', top: 0, color: col, mixBlendMode: blend, transform: `translateX(${dx}px)` }}>{txt}</div>
  );
  const franjas = [];
  for (let i = 0; i < N; i++) {
    const d = (azar(i + t * 7, semilla) - 0.5) * (f < 5 ? 140 : 40);
    franjas.push(
      <div key={i} style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: alto, clipPath: `inset(${(i / N) * 100}% 0 ${100 - ((i + 1) / N) * 100}% 0)`, transform: `translateX(${d}px)` }}>
        {capa('#ff0038', -10, 'screen')}{capa('#00f0ff', 10, 'screen')}{capa(color, 0, 'normal')}
      </div>,
    );
  }
  return (
    <div style={{ position: 'absolute', left: 0, top: y - alto / 2, width: 1080, height: alto, fontFamily: LETRA, fontWeight: 900, fontSize: tam, lineHeight: `${alto}px`, letterSpacing: '0.01em',
      transform: `scale(${1 + Math.max(0, 1 - f / 4) * 0.18})` }}>
      {franjas}
      <div style={{ ...lleno, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0 2px, transparent 2px 6px)' }} />
    </div>
  );
}

/* ------------------------------------------------------------ líneas de tele y ruido (para lo roto) */
export function Tele({ f, fuerza = 1 }) {
  return (
    <>
      <div style={{ ...lleno, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 5px)', opacity: 0.5 * fuerza }} />
      <div style={{ ...lleno, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(40,0,30,0.65) 100%)', opacity: fuerza }} />
      <div style={{ position: 'absolute', left: 0, width: '100%', top: ((f * 37) % 1920), height: 90, background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.12), transparent)', opacity: fuerza }} />
    </>
  );
}
