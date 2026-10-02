/* ============================================================================
   videos/remotion/src/kit2.jsx — las piezas de los videos "dúo" (dos juegos
   por video): la cámara de cada plano (golpecito de zoom y acercarse a un
   punto) y cómo pasar un punto de la toma a la pantalla, la pantalla partida
   del gancho y del final, el cartel del título de cada juego, la cortina
   entre un juego y el otro, el círculo que sigue a lo que se mueve, el dedo
   que corta, toca o desliza donde el bot lo hizo, el marco que señala una
   parte de la pantalla, las chispas del color del juego y el cartel final.
   Todo depende solo del cuadro: Remotion puede dibujar cualquiera suelto.
   ========================================================================== */
import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile } from 'remotion';
import { clamp, suave, sale, rebote, azar, LETRA, Grueso } from './kit.jsx';

export const FPS = 30;
const lleno = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };

/* la cámara de un plano: entra con un golpecito de zoom y se acerca despacio; con
   enfoque [cx, cy, zoom] se acerca a ese punto (fracciones del cuadro) sin mostrar bordes */
export function camara(P, t) {
  const dur = Math.max(0.01, P.t1 - P.t0);
  const [cx, cy, zz] = P.enfoque || [0.5, 0.5, 1];
  const z = (1.06 - 0.06 * sale(t / 0.3) + (P.quieto ? 0 : 0.025 * clamp(t / dur))) * zz;
  const tx = Math.min(0, Math.max(1080 - 1080 * z, 540 - cx * 1080 * z));
  const ty = Math.min(0, Math.max(1920 - 1920 * z, 960 - cy * 1920 * z));
  return { z, tx, ty };
}
/* un punto de la toma (en CSS de 432×768, como lo anota el bot) a la pantalla de 1080×1920 */
export const aPantalla = (c, p) => [c.tx + p[0] * 2.5 * c.z, c.ty + p[1] * 2.5 * c.z];

/* el plano a pantalla entera */
export function Toma({ src, desde, c }) {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformOrigin: '0 0', transform: `translate(${c.tx}px, ${c.ty}px) scale(${c.z})` }}>
        <OffthreadVideo src={src} trimBefore={Math.round(desde * FPS)} muted style={{ width: 1080, height: 1920 }} />
      </div>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------ pantalla partida */
/* arriba el juego 1, abajo el juego 2, cada uno con su número; entran de costados
   opuestos y, si `junta` corre, el de abajo se va y el de arriba ocupa todo. Cada mitad
   es [toma, desde, recorte] o una tira de esos con su duración: [[toma, desde, recorte, dur], …]
   (para cuando una toma sola no alcanza) */
export const tramosDe = (M) => (Array.isArray(M[0]) ? M : [M]);
export function Partida({ t, arriba, abajo, J1, J2, junta = null, numeros = true }) {
  const e1 = sale(t / 0.4), e2 = sale((t - 0.12) / 0.4);
  const j = junta === null ? 0 : suave((t - junta) / 0.45);
  const alto1 = 960 + 960 * j;
  const videos = (M, h) => {
    let ini = 0;
    return tramosDe(M).map((m, i, todos) => {
      const desde = ini; ini += m[3] || 0;
      const v = <OffthreadVideo src={staticFile(`tomas/${m[0]}.mp4`)} trimBefore={Math.round(m[1] * FPS)} muted style={{ width: 1080, height: 1920, position: 'absolute', left: 0, top: -(m[2] ?? 0.3) * (1920 - h) }} />;
      return todos.length === 1 ? <React.Fragment key={i}>{v}</React.Fragment> : (
        <Sequence key={i} layout="none" from={Math.round(desde * FPS)} durationInFrames={i < todos.length - 1 ? Math.round(m[3] * FPS) : undefined}>{v}</Sequence>
      );
    });
  };
  const mitad = (M, y, h, dx, num, J, k) => (
    <div style={{ position: 'absolute', left: 0, top: y, width: 1080, height: h, overflow: 'hidden', transform: `translateX(${dx}px)` }}>
      {videos(M, h)}
      {numeros && (
        <div style={{ position: 'absolute', left: 34, top: k ? 34 : h - 210, width: 170, height: 170, borderRadius: '50%', background: J.color, border: `9px solid ${J.tinta}`,
          boxShadow: `0 10px 0 ${J.tinta}, 0 20px 40px rgba(0,0,0,0.5)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${rebote((t - 0.35 - k * 0.12) / 0.4) * (1 - j)})` }}>
          <span style={{ font: `900 118px ${LETRA}`, color: J.tinta, marginTop: -8 }}>{num}</span>
        </div>
      )}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {mitad(arriba, 0, alto1, (1 - e1) * -1100, '1', J1, 1)}
      {j < 1 && mitad(abajo, 960 + 960 * j, 960, (1 - e2) * 1100, '2', J2, 0)}
      {/* la raya del medio, con brillo */}
      {j < 1 && <div style={{ position: 'absolute', left: -40, top: 960 + 960 * j - 9, width: 1160, height: 18, background: '#fff', transform: `scaleX(${sale((t - 0.2) / 0.35)})`,
        boxShadow: `0 0 30px ${J1.color}, 0 0 60px ${J2.color}` }} />}
    </AbsoluteFill>
  );
}

/* el titular del gancho: dos renglones que caen con rebote sobre la raya del medio */
export function Titular({ t, lineas, J1, J2, hasta, y = 960 }) {
  if (t > hasta) return null;
  const fuera = suave((t - hasta + 0.3) / 0.3);
  return (
    <div style={{ position: 'absolute', left: 540, top: y, transform: `translate(-50%, -50%) rotate(-3deg) scale(${1 - 0.2 * fuera})`, opacity: 1 - fuera, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {lineas.map((l, i) => {
        const e = rebote((t - 0.35 - i * 0.18) / 0.45);
        return (
          <div key={i} style={{ transform: `scale(${e})`, padding: i ? '10px 34px 18px' : 0, borderRadius: 24, background: i ? '#fff' : 'transparent', boxShadow: i ? `0 12px 0 ${J2.tinta}, 0 24px 40px rgba(0,0,0,0.5)` : 'none' }}>
            {i ? <span style={{ font: `900 ${Math.min(90, Math.floor(1420 / [...l].length))}px ${LETRA}`, color: J1.tinta, whiteSpace: 'nowrap' }}>{l}</span> : <Grueso texto={l} tam={Math.min(150, Math.floor(1300 / [...l].length))} color="#fff" />}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ el título de cada juego */
/* una banda inclinada del color del juego cruza la pantalla; el nombre cae letra por letra,
   con el número del juego en un círculo y el género abajo; después se va para arriba */
export function TituloJuego({ t, J, numero, dur = 1.9 }) {
  if (t < 0 || t > dur) return null;
  const entra = sale(t / 0.28), fuera = suave((t - dur + 0.4) / 0.4);
  const letras = [...J.nombre];
  const tam = J.nombre.length > 10 ? 132 : 158;
  return (
    <div style={{ ...lleno, transform: `translateY(${-fuera * 1300}px)` }}>
      <div style={{ position: 'absolute', left: -240, top: 730, width: 1560, height: 430, background: J.color, transform: `translateX(${(1 - entra) * -1700}px) rotate(-7deg)`,
        borderTop: `14px solid ${J.tinta}`, borderBottom: `14px solid ${J.tinta}`, boxShadow: '0 40px 80px rgba(0,0,0,0.55)' }}>
        <div style={{ ...lleno, background: `repeating-linear-gradient(-45deg, rgba(255,255,255,0.12) 0 22px, rgba(255,255,255,0) 22px 44px)`, transform: `translateX(${(t * 60) % 62}px)` }} />
      </div>
      <div style={{ position: 'absolute', left: 540, top: 945, transform: 'translate(-50%, -50%) rotate(-7deg)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ transform: `scale(${rebote((t - 0.12) / 0.35)})`, marginBottom: 12, padding: '8px 30px', borderRadius: 999, background: J.tinta }}>
          <span style={{ font: `900 46px ${LETRA}`, color: J.color, letterSpacing: 6, whiteSpace: 'nowrap' }}>{`JUEGO ${numero}`}</span>
        </div>
        <div style={{ display: 'flex', whiteSpace: 'pre' }}>
          {letras.map((ch, i) => {
            const e = rebote((t - 0.2 - i * 0.035) / 0.32);
            return <div key={i} style={{ transform: `translateY(${(1 - clamp(e)) * -260}px) scale(${0.4 + 0.6 * e})`, opacity: clamp(e * 3) }}><Grueso texto={ch} tam={tam} color="#fff" borde={J.tinta} /></div>;
          })}
        </div>
        <div style={{ marginTop: 18, transform: `scale(${rebote((t - 0.55) / 0.35)})` }}>
          <Grueso texto={J.tag} tam={52} color={J.color2 || '#fff'} borde={J.tinta} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ la cortina entre juegos */
/* un círculo del color del juego que llega crece desde el centro con su número enorme,
   tapa todo justo en el corte y después se va para arriba, inclinado */
export function Cortina({ t, J, numero }) {
  if (t < -0.32 || t > 0.5) return null;
  const crece = sale((t + 0.32) / 0.3), sube = suave(t / 0.45);
  return (
    <div style={{ ...lleno, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 540, top: 960, width: 2600, height: 2600, marginLeft: -1300, marginTop: -1300, borderRadius: '50%', background: J.color,
        transform: `translateY(${-sube * 2900}px) scale(${crece})`, boxShadow: `0 0 0 40px ${J.tinta}` }}>
        <div style={{ position: 'absolute', left: 1300, top: 1300, transform: `translate(-50%, -50%) rotate(${-12 + 12 * crece}deg) scale(${0.6 + 0.4 * crece})` }}>
          <Grueso texto={numero} tam={620} color="#fff" borde={J.tinta} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ el círculo que sigue */
/* un anillo que late alrededor de lo que se mueve (posiciones del bot, cuadro a cuadro)
   y un cartelito con una rayita; entra con rebote y se va desinflándose */
export function Sigue({ t, dur, pos, texto, color, tinta, r = 78, lado = 1 }) {
  if (t < 0 || t > dur || !pos) return null;
  const e = rebote(t / 0.35), b = 1 - suave((t - dur + 0.25) / 0.25), late = 1 + 0.06 * Math.sin(t * 9);
  const [x, y] = pos;
  const lx = x + lado * 150, ly = y - 170;
  return (
    <div style={{ ...lleno, opacity: b }}>
      <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', border: `9px solid ${color}`, transform: `scale(${e * late})`,
        boxShadow: `0 0 0 5px ${tinta}, inset 0 0 0 5px ${tinta}, 0 0 30px ${color}` }} />
      {texto && <>
        <svg style={{ ...lleno, overflow: 'visible' }} width="1080" height="1920"><line x1={x + lado * r * 0.72} y1={y - r * 0.72} x2={lx} y2={ly + 40} stroke={tinta} strokeWidth="14" strokeLinecap="round" opacity={clamp(e)} />
          <line x1={x + lado * r * 0.72} y1={y - r * 0.72} x2={lx} y2={ly + 40} stroke={color} strokeWidth="7" strokeLinecap="round" opacity={clamp(e)} /></svg>
        <div style={{ position: 'absolute', left: lx, top: ly, transform: `translate(${lado > 0 ? '-10%' : '-90%'}, -50%) scale(${e})`, padding: '10px 26px 14px', borderRadius: 999, background: color, border: `6px solid ${tinta}`, whiteSpace: 'nowrap', boxShadow: '0 12px 30px rgba(0,0,0,0.45)' }}>
          <span style={{ font: `900 50px ${LETRA}`, color: tinta }}>{texto}</span>
        </div>
      </>}
    </div>
  );
}

/* ------------------------------------------------------------ el dedo */
/* corte: el dedo cruza el punto dejando una estela blanca; toque: baja, aprieta y deja una
   onda; desliza: una flecha y el dedo que se corre para ese lado (CRIPTA) */
const DEDO = ({ x, y, k = 1, giro = -20, a = 1 }) => (
  <div style={{ position: 'absolute', left: x - 70, top: y - 20, width: 140, height: 160, transform: `rotate(${giro}deg) scale(${k})`, transformOrigin: '50% 10%', opacity: a,
    font: `130px "Noto Color Emoji"`, lineHeight: 1, filter: 'drop-shadow(0 10px 12px rgba(0,0,0,0.5))' }}>👆</div>
);
export function Dedo({ t, tipo, en, dir = [1, 0] }) {
  if (t < -0.15 || t > 0.75) return null;
  const [x, y] = en;
  if (tipo === 'corte') {
    const u = sale((t + 0.15) / 0.35), x0 = x - 170, y0 = y - 120, x1 = x + 170, y1 = y + 120;
    const fx = x0 + (x1 - x0) * u, fy = y0 + (y1 - y0) * u, a = 1 - suave((t - 0.45) / 0.3);
    return (
      <div style={{ ...lleno, opacity: a }}>
        <svg style={{ ...lleno, overflow: 'visible' }} width="1080" height="1920">
          <line x1={x0 + (x1 - x0) * Math.max(0, u - 0.55)} y1={y0 + (y1 - y0) * Math.max(0, u - 0.55)} x2={fx} y2={fy} stroke="#fff" strokeWidth="16" strokeLinecap="round" opacity="0.9" />
        </svg>
        <DEDO x={fx} y={fy} />
      </div>
    );
  }
  if (tipo === 'toque') {
    const baja = sale((t + 0.15) / 0.15), onda = clamp(t / 0.45), a = 1 - suave((t - 0.45) / 0.3);
    return (
      <div style={{ ...lleno, opacity: a }}>
        <div style={{ position: 'absolute', left: x - 90, top: y - 90, width: 180, height: 180, borderRadius: '50%', border: '10px solid #fff', transform: `scale(${0.3 + onda * 1.2})`, opacity: 1 - onda }} />
        <DEDO x={x + 10} y={y + 10 + (1 - baja) * 120} k={t > 0 && t < 0.12 ? 0.9 : 1} giro={-12} />
      </div>
    );
  }
  /* desliza: abajo al medio, donde va el pulgar */
  const u = sale((t + 0.1) / 0.3), a = 1 - suave((t - 0.4) / 0.3), cx = 540, cy = 1395, L = 200;
  const fx = cx + dir[0] * (u - 0.5) * L, fy = cy + dir[1] * (u - 0.5) * L;
  const ang = Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
  return (
    <div style={{ ...lleno, opacity: a }}>
      <div style={{ position: 'absolute', left: cx, top: cy, transform: `translate(-50%, -50%) rotate(${ang}deg) scale(${0.8 + 0.2 * u})` }}>
        <svg width="320" height="120" style={{ overflow: 'visible' }}><path d="M 0 60 L 240 60 M 200 20 L 250 60 L 200 100" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 0 60 L 240 60 M 200 20 L 250 60 L 200 100" fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <DEDO x={fx} y={fy + 40} giro={-10} />
    </div>
  );
}

/* el dedo que arrastra (GLOBO): abajo, sigue lo que se corre el escudo desde el globo */
export function Arrastre({ t, dur, rel }) {
  if (t < 0 || t > dur || !rel) return null;
  const a = suave(t / 0.25) * (1 - suave((t - dur + 0.25) / 0.25));
  const x = 790 + rel[0] * 0.9, y = 1630 + rel[1] * 0.25;
  return (
    <div style={{ ...lleno, opacity: a }}>
      <div style={{ position: 'absolute', left: x - 75, top: y - 75, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', border: '6px solid rgba(255,255,255,0.7)' }} />
      <DEDO x={x + 6} y={y - 6} giro={-14} />
    </div>
  );
}

/* ------------------------------------------------------------ marco que señala una zona */
export function Marco({ t, dur, rect, texto, color, tinta, arriba = false }) {
  if (t < 0 || t > dur) return null;
  const e = rebote(t / 0.35), b = 1 - suave((t - dur + 0.25) / 0.25);
  const [x, y, w, h] = rect;
  return (
    <div style={{ ...lleno, opacity: b }}>
      <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 26, border: `10px solid ${color}`, transform: `scale(${0.9 + 0.1 * e})`,
        boxShadow: `0 0 0 6px ${tinta}, inset 0 0 0 6px ${tinta}, 0 0 40px ${color}` }} />
      {texto && <div style={{ position: 'absolute', left: Math.max(300, Math.min(760, x + w / 2)), top: arriba ? y - 36 : y + h + 36, transform: `translate(-50%, ${arriba ? '-100%' : '0'}) scale(${e})`, padding: '10px 28px 14px', borderRadius: 999, background: color, border: `6px solid ${tinta}`, whiteSpace: 'nowrap' }}>
        <span style={{ font: `900 50px ${LETRA}`, color: tinta }}>{texto}</span></div>}
    </div>
  );
}

/* ------------------------------------------------------------ palabras que saltan */
/* para las listas que dice la voz ("cajas, ladrillos y péndulos"): cada palabra salta
   inclinada en un lugar distinto, del color del juego */
export function Salta({ t, texto, color, x = 540, y = 760, giro = -6, tam = 120, dur = 1.1 }) {
  if (t < 0 || t > dur) return null;
  const e = rebote(t / 0.3), b = 1 - suave((t - dur + 0.25) / 0.25);
  return (
    <div style={{ position: 'absolute', left: x, top: y - (1 - b) * 60, transform: `translate(-50%, -50%) rotate(${giro}deg) scale(${e})`, opacity: b }}>
      <Grueso texto={texto} tam={tam} color={color} borde="#000" />
    </div>
  );
}

/* ------------------------------------------------------------ chispas del color del juego */
export function Chispas({ t, colores, cuantas = 22, a = 0.7 }) {
  return (
    <div style={{ ...lleno, pointerEvents: 'none', opacity: a }}>
      {Array.from({ length: cuantas }, (_, i) => {
        const x = azar(i, 1) * 1080 + Math.sin(t * (0.5 + azar(i, 2)) + i) * 40;
        const y = 1920 - ((azar(i, 3) * 2000 + t * (40 + azar(i, 4) * 70)) % 2050);
        const r = 5 + azar(i, 5) * 9, k = 0.4 + 0.6 * Math.abs(Math.sin(t * (1.5 + azar(i, 6) * 2) + i));
        const c = colores[i % colores.length];
        return <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: c, opacity: k, boxShadow: `0 0 ${r * 2.5}px ${c}` }} />;
      })}
    </div>
  );
}

/* ------------------------------------------------------------ comentá 1 o 2 */
export function Encuesta({ t, J1, J2 }) {
  const e1 = rebote((t - 0.25) / 0.4), e2 = rebote((t - 0.45) / 0.4), e3 = rebote((t - 0.8) / 0.4);
  const fila = (J, n, e, y) => (
    <div style={{ position: 'absolute', left: 540, top: y, transform: `translate(-50%, -50%) scale(${e})`, display: 'flex', alignItems: 'center', gap: 22, padding: '16px 40px 22px 18px', borderRadius: 999, background: '#fff', border: `8px solid ${J.tinta}`, boxShadow: `0 12px 0 ${J.tinta}, 0 24px 40px rgba(0,0,0,0.5)`, whiteSpace: 'nowrap' }}>
      <div style={{ width: 104, height: 104, borderRadius: '50%', background: J.color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `6px solid ${J.tinta}` }}><span style={{ font: `900 72px ${LETRA}`, color: J.tinta, marginTop: -6 }}>{n}</span></div>
      <span style={{ font: `900 70px ${LETRA}`, color: J.tinta }}>{J.nombre}</span>
    </div>
  );
  return (
    <>
      {fila(J1, '1', e1, 760)}
      {fila(J2, '2', e2, 960)}
      <div style={{ position: 'absolute', left: 540, top: 1150, transform: `translate(-50%, -50%) scale(${e3}) rotate(-2deg)` }}><Grueso texto="COMENTA 1 o 2 👇" tam={78} color="#fff" /></div>
    </>
  );
}

/* el cartel del final: JXSTUDIOS y seguir para más */
export function Final({ t, J1, J2 }) {
  const e1 = rebote((t - 0.1) / 0.45), e2 = rebote((t - 0.5) / 0.4), brillo = clamp((t - 0.6) / 0.8);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 44%, rgba(0,0,0,${0.35 * clamp(t / 0.4)}), rgba(0,0,0,${0.8 * clamp(t / 0.4)}) 72%)` }}>
      <div style={{ position: 'absolute', left: 540, top: 760, transform: `translate(-50%, -50%) scale(${e1})`, textAlign: 'center' }}>
        <div style={{ font: `900 150px ${LETRA}`, color: '#fff', letterSpacing: 14, textShadow: `0 0 40px ${J1.color}, 0 10px 0 rgba(0,0,0,0.5)`,
          backgroundImage: `linear-gradient(100deg, #fff 0%, #fff ${brillo * 100 - 12}%, ${J2.color} ${brillo * 100}%, #fff ${brillo * 100 + 12}%, #fff 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>JXSTUDIOS</div>
      </div>
      <div style={{ position: 'absolute', left: 540, top: 960, transform: `translate(-50%, -50%) scale(${e2})` }}><Grueso texto="Sígueme para más juegos 👾" tam={70} color="#fff" /></div>
    </AbsoluteFill>
  );
}
