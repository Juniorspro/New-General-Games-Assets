/* ============================================================================
   aeroplaza/trailer/remotion/src/Trailer.jsx — el montaje: cada plano del guion
   es su toma (el juego de verdad, grabado cuadro por cuadro) con su cartel
   encima. Las cuatro partes siguen a sus canciones (guion.js):
     A · bosque: la bienvenida, el logo, el muñeco, los mundos y las acciones;
     B · juegos: la Zona de Juegos, los amigos y el Estelario;
     C · el breakcore: Aero.exe se rompe (ventanas de error, golpes, palabras);
     D · Wii Party: todo vuelve a brillar y el cartel final.
   ========================================================================== */
import React from 'react';
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { tiempos, enGolpe, aCuadro, PARTES, SUSTO_T, TEXTO_BIENVENIDA, CUADROS, FPS } from '../../guion.js';
import { clamp, suave, sale, rebote, azar, LETRA, C, ZONA, lleno, RAYAS, Logo, Tarjeta, Aviso, Boton, Mano, Burbujas, VentanaError, Palabra, Tele } from './kit.jsx';

const PLANOS = tiempos();
/* los golpes de una parte, en cuadros del tráiler */
const golpesDe = (id) => { const P = PARTES.find((q) => q.id === id), out = []; for (let n = 0; n <= P.golpes; n++) out.push(aCuadro(enGolpe(id, n))); return out; };
const GOLPES_C = golpesDe('C');
const cuadroGolpe = (id, n) => aCuadro(enGolpe(id, n));

/* ------------------------------------------------------------ la toma, con su movimiento */
function Toma({ q, f, L }) {
  const u = f / Math.max(1, L);
  let escala = 1.02 + 0.035 * u, brillo = 1, recorte = 0;
  const canal = ['mundo', 'juego', 'accion'].includes(q.cartel);
  /* la entrada: un golpe de zoom con destello (los mundos se abren como un canal de Wii) */
  if (canal) { const k = sale(f / 7); recorte = (1 - k) * 12; brillo = 1 + (1 - k) * 0.35; }
  else if (f < 6 && q.cartel !== 'bienvenida') { escala += 0.08 * (1 - sale(f / 6)); brillo = 1 + 0.3 * (1 - f / 6); }
  /* en el breakcore: un golpe de zoom en cada golpe de la canción */
  if (q.parte === 'C' && q.cartel !== 'error') {
    const g = q.c0 + f, ultimo = GOLPES_C.filter((c) => c <= g).pop() ?? -99, d = g - ultimo;
    escala += 0.07 * Math.exp(-d / 2.5);
  }
  /* (el cielo del Estelario sale oscuro en el video: se levanta un poco) */
  const filtro = q.cartel === 'cielo' ? `brightness(${(1.45 * brillo).toFixed(3)}) contrast(1.15) saturate(1.2)` : brillo !== 1 ? `brightness(${brillo.toFixed(3)})` : undefined;
  const video = (
    <OffthreadVideo src={staticFile(`tomas/${q.toma}.mp4`)} startFrom={Math.round(q.en)} muted
      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${escala})`, filter: filtro }} />
  );
  if (!canal) return <AbsoluteFill>{video}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ background: RAYAS }}>
      <div style={{ position: 'absolute', inset: `${recorte}% ${recorte * 0.9}%`, borderRadius: 70 * (recorte / 12), overflow: 'hidden', border: recorte > 0.3 ? `${8 * recorte / 12}px solid #fff` : 'none', boxShadow: recorte > 0.3 ? '0 20px 60px rgba(40,60,80,0.35)' : 'none' }}>{video}</div>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------ los carteles de cada plano */
const MUNECO = ['Colores', 'Coronas y anteojos', 'Alas y peinados', 'Galaxia y galera', 'Flores y mochilas', 'Vidrio y cascos', 'Explorador', 'Aureola y partículas'];
const EMOJI_JUEGO = { Damas: '♟️', 'Fútbol': '⚽', Trampolines: '🤸', 'Tobogán': '🛝' };
const ERRORES = ['aeroplaza.exe dejó de funcionar', 'Error 0x000F7A: el cielo no responde', 'No se encontró la textura', 'Aero.exe no responde', '¿Seguís ahí?', 'Fallo en la realidad'];
const ROTAS = ['WAKE UP', 'DESPIERTA', 'WAKE UP', '¿SEGUÍS AHÍ?', 'DESPIERTA', 'NO ES REAL', 'WAKE UP', 'DESPIERTA'];

function Pastilla({ f, txt, sub, emoji, y = 1300 }) {
  const u = rebote(f / 10);
  return (
    <div style={{ position: 'absolute', left: ZONA.cx - 420, width: 840, top: y + (1 - u) * 120, opacity: clamp(f / 4), display: 'flex', justifyContent: 'center' }}>
      <Tarjeta style={{ padding: '22px 46px', display: 'flex', alignItems: 'center', gap: 22, transform: `scale(${0.8 + 0.2 * u})` }}>
        {emoji && <span style={{ fontSize: 70 }}>{emoji}</span>}
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 72, fontWeight: 900, color: C.azul2, lineHeight: 1.05 }}>{txt}</div>
          {sub && <div style={{ fontSize: 36, fontWeight: 800, color: C.tinta2 }}>{sub}</div>}
        </div>
      </Tarjeta>
    </div>
  );
}

function Cartel({ q, f, L }) {
  switch (q.cartel) {
    case 'bienvenida': {
      const t = f / FPS, n = clamp(Math.floor((t - 0.6) / 0.075) + 1, 0, TEXTO_BIENVENIDA.length), cursor = Math.floor(f / 8) % 2 === 0;
      const sube = sale((f - (L - 10)) / 10);
      return (
        <>
          <div style={{ ...lleno, background: '#fff', opacity: 1 - sale(f / 14) }} />
          <Burbujas f={f} n={10} semilla={3} alfa={0.75} />
          <div style={{ position: 'absolute', left: 0, width: 1080, top: 760 - sube * 60, display: 'flex', justifyContent: 'center', opacity: 1 - sube }}>
            <Tarjeta rayas style={{ padding: '34px 60px', fontSize: 92, fontWeight: 900 }}>{TEXTO_BIENVENIDA.slice(0, n)}<span style={{ color: C.azul, opacity: cursor ? 1 : 0 }}>|</span></Tarjeta>
          </div>
        </>
      );
    }
    case 'logo': {
      const sal = sale((f - (L - 14)) / 14);
      return (
        <>
          <Burbujas f={f + 131} n={14} semilla={4} alfa={0.8} />
          <div style={{ ...lleno, background: '#fff', opacity: 0.9 * Math.max(0, 1 - f / 5) }} />
          <div style={{ position: 'absolute', left: 0, width: 1080, top: 640 - sal * 260, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${1 - sal * 0.35})` }}>
            <Logo f={f} tam={128} />
            <div style={{ marginTop: 44, opacity: clamp((f - 16) / 8), transform: `translateY(${(1 - sale((f - 16) / 10)) * 30}px)` }}>
              <Tarjeta style={{ padding: '16px 34px', fontSize: 40 }}>la plaza Frutiger Aero para jugar con amigos</Tarjeta>
            </div>
          </div>
        </>
      );
    }
    case 'muneco': {
      const b = Math.min(7, Math.floor(f / 15.65)), fb = f - b * 15.65;
      return (
        <>
          <div style={{ position: 'absolute', left: 0, width: 1080, top: 262, display: 'flex', justifyContent: 'center', opacity: clamp(f / 5) }}>
            <Tarjeta style={{ padding: '18px 44px', fontSize: 66, fontWeight: 900, color: C.azul2, transform: `translateY(${(1 - sale(f / 8)) * -40}px)` }}>Armá tu muñeco</Tarjeta>
          </div>
          <Pastilla f={fb} txt={MUNECO[b]} y={1370} />
          {f > 15.65 * 5 && <div style={{ position: 'absolute', left: 0, width: 1080, top: 1300, textAlign: 'center', fontFamily: LETRA, fontWeight: 900, fontSize: 38, color: '#fff', textShadow: '0 3px 10px rgba(0,40,80,0.6)', opacity: clamp((f - 15.65 * 5) / 8) }}>más de 2 millones de combinaciones</div>}
        </>
      );
    }
    case 'mundo': return <Pastilla f={f - 3} txt={q.txt} sub={q.sub} emoji="📍" />;
    case 'accion': {
      const u = rebote((f - 2) / 9);
      return (
        <div style={{ position: 'absolute', left: 0, width: 1080, top: 1180, textAlign: 'center', fontFamily: LETRA, fontWeight: 900, fontSize: 132, color: '#fff', transform: `rotate(-5deg) scale(${0.5 + 0.5 * u})`, opacity: clamp(f / 3),
          WebkitTextStroke: `10px ${C.azul2}`, paintOrder: 'stroke fill', textShadow: '0 12px 0 rgba(0,60,120,0.35), 0 20px 40px rgba(0,40,80,0.4)' }}>¡{q.txt}!</div>
      );
    }
    case 'zona': {
      const cuenta = (n, i) => { const t0 = 14 + i * 21, u = sale((f - t0) / 14); return f < t0 ? null : <Tarjeta key={i} style={{ padding: '14px 30px', fontSize: 50, transform: `scale(${0.6 + 0.4 * rebote((f - t0) / 10)})`, opacity: clamp((f - t0) / 4) }}>{n.replace(/\d+/, (m) => Math.round(+m * u))}</Tarjeta>; };
      return (
        <>
          <div style={{ position: 'absolute', left: 0, width: 1080, top: 280, display: 'flex', justifyContent: 'center' }}>
            <Tarjeta rayas style={{ padding: '22px 50px', fontSize: 84, fontWeight: 900, color: C.azul2, transform: `scale(${0.7 + 0.3 * rebote(f / 12)})` }}>🎮 Zona de Juegos</Tarjeta>
          </div>
          <div style={{ position: 'absolute', left: ZONA.x0, width: ZONA.x1 - ZONA.x0, top: 1250, display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center' }}>
            {['11 puertas', '+10 juegos', '6 mesas de a dos'].map(cuenta)}
          </div>
        </>
      );
    }
    case 'juego': return <Pastilla f={f - 1} txt={q.txt} emoji={EMOJI_JUEGO[q.txt]} y={1330} />;
    case 'social': {
      const ondas = [0, 1, 2, 3, 4].map((i) => 18 + 30 * Math.abs(Math.sin(f * 0.35 + i * 1.3)));
      return (
        <>
          <Aviso f={f} entra={2} sale={44} icono="👋" txt="Luli se unió a la sala" sub="Plaza Central · 5 personas" />
          <div style={{ position: 'absolute', left: 0, width: 1080, top: 1180, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <Tarjeta style={{ padding: '20px 44px', fontSize: 70, fontWeight: 900, color: C.azul2, transform: `scale(${0.7 + 0.3 * rebote((f - 6) / 12)})`, opacity: clamp((f - 6) / 4) }}>Jugá con tus amigos</Tarjeta>
            <div style={{ display: 'flex', gap: 16, opacity: clamp((f - 24) / 6) }}>
              <Tarjeta style={{ padding: '12px 26px', fontSize: 38 }}>💬 chat</Tarjeta>
              <Tarjeta style={{ padding: '12px 26px', fontSize: 38 }}>💃 gestos</Tarjeta>
              <Tarjeta style={{ padding: '12px 26px', fontSize: 38, display: 'flex', alignItems: 'center', gap: 10 }}>🎤 voz{ondas.map((h, i) => <span key={i} style={{ width: 8, height: h, borderRadius: 4, background: C.verde, display: 'inline-block' }} />)}</Tarjeta>
            </div>
          </div>
        </>
      );
    }
    case 'cielo': return (
      <>
        <div style={{ ...lleno, background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,10,30,0.6) 100%)' }} />
        <div style={{ position: 'absolute', left: 0, width: 1080, top: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <div style={{ fontFamily: LETRA, fontWeight: 900, fontSize: 72, color: '#fff', textShadow: '0 0 24px rgba(120,190,255,0.9), 0 4px 0 rgba(0,0,0,0.3)', opacity: clamp((f - 4) / 8), transform: `translateY(${(1 - sale((f - 4) / 12)) * 40}px)` }}>🔭 Mirá el cielo de verdad</div>
          <div style={{ fontFamily: LETRA, fontWeight: 800, fontSize: 40, color: '#cfe6ff', opacity: clamp((f - 20) / 8) }}>5044 estrellas · 88 constelaciones · Buenos Aires</div>
        </div>
      </>
    );
    case 'error': {
      const bs = [0, 2, 4, 5, 6, 7].map((n) => cuadroGolpe('C', n) - q.c0);
      return (
        <>
          {bs.map((b, i) => f >= b && <VentanaError key={i} x={140 + i * 36 - (i > 2 ? 60 : 0)} y={560 + i * 70} f={f} tiembla={i === 0 ? 18 : 8} escala={0.7 + 0.3 * rebote((f - b) / 6)} titulo={i % 2 ? 'explorer.exe' : 'Aero.exe'} txt={ERRORES[i]} />)}
          {f > 12 && <Palabra f={f - 12} txt="AERO.EXE" tam={150} y={1380} semilla={9} color="#ffffff" />}
        </>
      );
    }
    case 'despierta': {
      const g = q.c0 + f, ultimo = GOLPES_C.filter((c) => c <= g).pop() ?? -99, n = GOLPES_C.indexOf(ultimo), d = g - ultimo;
      const susto = aCuadro(SUSTO_T) - q.c0;
      return (
        <>
          <Tele f={f} fuerza={0.55} />
          {/* el golpe fuerte de cada compás: un destello rosa de un cuadro */}
          {n % 4 === 0 && d < 2 && <div style={{ ...lleno, background: '#ff2fa0', opacity: 0.22 }} />}
          {f >= susto && f < susto + 2 && <div style={{ ...lleno, background: '#fff' }} />}
          {[24, 28].includes(n) && d < 8 && <Palabra f={d} txt={n === 24 ? 'WAKE UP' : 'DESPIERTA'} tam={200} y={1250} semilla={n} />}
        </>
      );
    }
    case 'final-roto': {
      const g = q.c0 + f, ultimo = GOLPES_C.filter((c) => c <= g).pop() ?? -99, n = GOLPES_C.indexOf(ultimo), d = g - ultimo, k = n - 32;
      return (
        <>
          <Tele f={f} fuerza={0.9} />
          {k >= 0 && k < 8 && d < 9 && <Palabra f={d} txt={ROTAS[k]} tam={k === 3 ? 150 : 210} y={900 + (k % 2 ? 220 : -120)} semilla={k + 3} color={k % 3 === 0 ? '#ff2a3c' : '#ffffff'} />}
          {f > L - 4 && <div style={{ ...lleno, background: '#fff' }} />}
        </>
      );
    }
    case 'vuelve': return (
      <>
        <div style={{ ...lleno, background: '#fff', opacity: 1 - sale(f / 20) }} />
        <Burbujas f={f} n={16} semilla={8} alfa={0.85} />
        <div style={{ position: 'absolute', left: 0, width: 1080, top: 1240, textAlign: 'center', fontFamily: LETRA, fontWeight: 900, fontSize: 74, color: '#fff', textShadow: '0 4px 0 rgba(26,160,216,0.7), 0 10px 30px rgba(0,60,120,0.45)', opacity: clamp((f - 14) / 10), transform: `translateY(${(1 - sale((f - 14) / 14)) * 50}px)` }}>Todo vuelve a brillar ✨</div>
      </>
    );
    case 'cierre': {
      const cl = 64, clic = f >= cl && f < cl + 6 ? 1 : 0;
      const mx = 900 - sale((f - 30) / 30) * 330, my = 1500 - sale((f - 30) / 30) * 380;
      const fin = sale((f - (L - 16)) / 16);
      return (
        <>
          <div style={{ ...lleno, background: 'linear-gradient(180deg, rgba(236,239,242,0.1), rgba(236,239,242,0.72) 30%, rgba(236,239,242,0.82) 70%, rgba(236,239,242,0.35))', opacity: clamp(f / 12) }} />
          <Burbujas f={f + 400} n={12} semilla={11} alfa={0.7} />
          <div style={{ position: 'absolute', left: 0, width: 1080, top: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
            <Logo f={f} tam={124} />
            <div style={{ fontFamily: LETRA, fontWeight: 800, fontSize: 42, color: C.tinta2, opacity: clamp((f - 14) / 8) }}>plaza · mundos · juegos · amigos</div>
          </div>
          <div style={{ position: 'absolute', left: 0, width: 1080, top: 1010, display: 'flex', justifyContent: 'center', opacity: clamp((f - 20) / 6), transform: `scale(${0.6 + 0.4 * rebote((f - 20) / 12)})` }}>
            <Boton f={f} txt="¡Jugá gratis!" onda={cl} />
          </div>
          <div style={{ position: 'absolute', left: ZONA.x0, width: ZONA.x1 - ZONA.x0, top: 1230, display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', opacity: clamp((f - 40) / 8) }}>
            {['🌍 3 idiomas', '👥 multijugador', '📱 anda en cualquier celu'].map((s) => <Tarjeta key={s} style={{ padding: '12px 26px', fontSize: 38 }}>{s}</Tarjeta>)}
          </div>
          <div style={{ position: 'absolute', left: 0, width: 1080, top: 1410, textAlign: 'center', fontFamily: LETRA, fontWeight: 900, fontSize: 46, color: C.azul2, opacity: clamp((f - 70) / 8) }}>link en la bio ⬇</div>
          {f > 26 && f < L - 20 && <Mano x={mx} y={my} aprieta={clic} />}
          <div style={{ ...lleno, background: '#fff', opacity: fin }} />
        </>
      );
    }
    default: return null;
  }
}

function Plano({ q }) {
  const f = useCurrentFrame(), L = q.c1 - q.c0;
  return (
    <AbsoluteFill>
      <Toma q={q} f={f} L={L} />
      <Cartel q={q} f={f} L={L} />
    </AbsoluteFill>
  );
}

export const Trailer = ({ sinMusica }) => (
  <AbsoluteFill style={{ background: '#000' }}>
    {PLANOS.map((q) => (
      <Sequence key={q.i} from={q.c0} durationInFrames={Math.max(1, q.c1 - q.c0)} layout="none">
        <Plano q={q} />
      </Sequence>
    ))}
    {/* la cola: el último plano (cierre) sigue hasta el final del tráiler */}
    {!sinMusica && <Audio src={staticFile('audio/musica.wav')} />}
  </AbsoluteFill>
);
