import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ruido } from "./efectos";

/**
 * La firma. Dos formas del mismo nombre:
 *  - <Portada>  la placa grande del arranque, con glitch;
 *  - <Firma>    la marca chica de la esquina, que queda todo el video.
 */

const VERDE = "#8cff3f";
const CIAN = "#00e5ff";

export const Portada: React.FC<{ duracion: number }> = ({ duracion }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ent = spring({ frame: f, fps, config: { damping: 14, mass: 0.6 } });
  const escala = interpolate(ent, [0, 1], [0.55, 1]);
  const giroX = interpolate(ent, [0, 1], [-85, 0]);

  // Glitch: saltos laterales en cuadros sueltos, no en todos.
  const glitchea = ruido(Math.floor(f / 2), 7) > 0.45;
  const saltoX = glitchea ? ruido(f, 11) * 26 : 0;
  const abre = glitchea ? 16 : interpolate(ent, [0, 1], [22, 4]);

  // Los ultimos cuadros la placa se va en un fogonazo.
  const salida = interpolate(f, [duracion - 10, duracion], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const destello = interpolate(f, [duracion - 7, duracion - 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const base: React.CSSProperties = {
    fontFamily: "TheBoldFont, sans-serif",
    fontSize: 170,
    letterSpacing: -6,
    lineHeight: 0.9,
    textTransform: "uppercase",
    margin: 0,
    whiteSpace: "pre",
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#04060a" }}>
      {/* portal verde de fondo */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 46%, ${VERDE}55 0%, ${VERDE}18 22%, transparent 52%)`,
          transform: `scale(${interpolate(ent, [0, 1], [0.4, 1.15])})`,
          filter: "blur(18px)",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          perspective: 900,
          opacity: 1 - salida,
        }}
      >
        <div
          style={{
            transform: `translateX(${saltoX}px) scale(${escala}) rotateX(${giroX}deg)`,
          }}
        >
          <div style={{ position: "relative" }}>
            <div style={{ ...base, position: "absolute", left: -abre, top: 0, color: "#ff0048", mixBlendMode: "screen" }}>
              {"CLAUD\nEDITS"}
            </div>
            <div style={{ ...base, position: "absolute", left: abre, top: 0, color: CIAN, mixBlendMode: "screen" }}>
              {"CLAUD\nEDITS"}
            </div>
            <div
              style={{
                ...base,
                position: "relative",
                color: "#ffffff",
                WebkitTextStroke: "4px #04060a",
                filter: `drop-shadow(0 0 22px ${VERDE}) drop-shadow(0 0 60px ${VERDE})`,
              }}
            >
              {"CLAUD\nEDITS"}
            </div>
          </div>
          <div
            style={{
              fontFamily: "TheBoldFont, sans-serif",
              fontSize: 34,
              letterSpacing: 14,
              color: VERDE,
              textAlign: "center",
              marginTop: 26,
              opacity: interpolate(ent, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" }),
            }}
          >
            PRESENTA
          </div>
        </div>
      </AbsoluteFill>
      {/* el fogonazo del corte */}
      <AbsoluteFill style={{ backgroundColor: "#ffffff", opacity: destello }} />
    </AbsoluteFill>
  );
};

export const Firma: React.FC = () => {
  const f = useCurrentFrame();
  const latido = 0.62 + Math.sin(f / 14) * 0.12;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 96,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "TheBoldFont, sans-serif",
          fontSize: 40,
          letterSpacing: 7,
          color: "#ffffff",
          opacity: latido,
          textTransform: "uppercase",
          WebkitTextStroke: "1.5px rgba(0,0,0,.6)",
          filter: `drop-shadow(0 0 14px ${VERDE})`,
        }}
      >
        ClaudEdits
      </div>
    </AbsoluteFill>
  );
};
