import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * Los efectos del edit, cada uno envolviendo a sus hijos.
 *
 * Todo se hace con CSS y capas, no con filtros de video: el navegador compone
 * en GPU (o en llvmpipe acá) y ademas se puede previsualizar en vivo, que es
 * justamente lo que una linea de tiempo a mano no deja hacer.
 */

/** Ruido determinista: el mismo cuadro da siempre el mismo valor. */
export const ruido = (n: number, semilla = 1) => {
  const x = Math.sin(n * 12.9898 + semilla * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/**
 * Resplandor. Una copia borrosa y sobreexpuesta encima del original, en modo
 * pantalla. Es lo que en los edits llaman "glow" o "bloom": las luces se
 * derraman sobre lo que tienen al lado.
 */
export const Resplandor: React.FC<{
  children: React.ReactNode;
  radio?: number;
  fuerza?: number;
}> = ({ children, radio = 18, fuerza = 0.55 }) => (
  <AbsoluteFill>
    <AbsoluteFill>{children}</AbsoluteFill>
    <AbsoluteFill
      style={{
        filter: `blur(${radio}px) brightness(1.6) saturate(1.4)`,
        mixBlendMode: "screen",
        opacity: fuerza,
        pointerEvents: "none",
      }}
    >
      {children}
    </AbsoluteFill>
  </AbsoluteFill>
);

/**
 * Aberracion cromatica: el rojo y el cian se separan unos pocos pixeles.
 * La referencia del genero dice 0,5 a 1 px en reposo y mas en los golpes;
 * `px` es cuanto se abren.
 */
export const Aberracion: React.FC<{
  children: React.ReactNode;
  px: number;
}> = ({ children, px }) => {
  if (px < 0.05) return <AbsoluteFill>{children}</AbsoluteFill>;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translateX(${-px}px)`,
          filter: "url(#solo-rojo)",
          mixBlendMode: "screen",
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translateX(${px}px)`,
          filter: "url(#solo-cian)",
          mixBlendMode: "screen",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Los filtros de canal que usa <Aberracion>. Va una sola vez por composicion. */
export const FiltrosSvg: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <defs>
      <filter id="solo-rojo">
        <feColorMatrix
          type="matrix"
          values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
        />
      </filter>
      <filter id="solo-cian">
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
        />
      </filter>
    </defs>
  </svg>
);

/** Temblor de camara. `fuerza` en pixeles; 0 lo deja quieto. */
export const Temblor: React.FC<{
  children: React.ReactNode;
  fuerza: number;
}> = ({ children, fuerza }) => {
  const f = useCurrentFrame();
  const x = ruido(f, 1) * fuerza;
  const y = ruido(f, 2) * fuerza;
  const giro = ruido(f, 3) * fuerza * 0.06;
  return (
    <AbsoluteFill
      style={{ transform: `translate(${x}px, ${y}px) rotate(${giro}deg)` }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Viñeta: oscurece las esquinas y manda el ojo al centro. */
export const Vineta: React.FC<{ fuerza?: number }> = ({ fuerza = 0.75 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 38%, rgba(0,0,0,${fuerza}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** Grano de pelicula, animado para que no se vea como una textura pegada. */
export const Grano: React.FC<{ opacidad?: number }> = ({ opacidad = 0.07 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: opacidad,
        mixBlendMode: "overlay",
        pointerEvents: "none",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundPosition: `${(f * 37) % 180}px ${(f * 53) % 180}px`,
      }}
    />
  );
};

/** Lineas de barrido, muy tenues: le da textura de pantalla. */
export const Barrido: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity: 0.16,
      mixBlendMode: "overlay",
      background:
        "repeating-linear-gradient(to bottom, rgba(255,255,255,.25) 0px, rgba(255,255,255,.25) 1px, transparent 1px, transparent 3px)",
    }}
  />
);
