import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Texto en perspectiva: entra desde el fondo girando en 3D y se planta.
 *
 * Dos cosas lo hacen ver "de edit" y no de presentacion de oficina:
 *  - la perspectiva es CORTA (700px, no 3000), asi la deformacion se nota;
 *  - el giro nunca vuelve del todo a cero, queda una inclinacion viva.
 *
 * La aberracion cromatica se arma acá apilando tres copias del mismo texto
 * (roja corrida a un lado, cian al otro, y la buena encima) en vez de con
 * filtros SVG: sobre texto plano se ve igual y cuesta muchisimo menos.
 */
export const TextoPerspectiva: React.FC<{
  texto: string;
  desde?: "izquierda" | "derecha" | "abajo";
  color?: string;
  tamano?: number;
  y?: number;
  duracion?: number;
}> = ({
  texto,
  desde = "izquierda",
  color = "#eaff00",
  tamano = 150,
  y = 0,
  duracion = 70,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrada = spring({ frame: f, fps, config: { damping: 13, mass: 0.7 } });
  const signo = desde === "derecha" ? -1 : 1;

  const giroY = desde === "abajo" ? 0 : interpolate(entrada, [0, 1], [signo * 78, signo * 9]);
  const giroX = desde === "abajo" ? interpolate(entrada, [0, 1], [-72, -7]) : -5;
  const desplX = desde === "abajo" ? 0 : interpolate(entrada, [0, 1], [signo * 620, 0]);

  // Se va escapandose hacia la camara.
  const salida = interpolate(f, [duracion - 18, duracion], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const z = interpolate(entrada, [0, 1], [-900, 0]) + salida * 800;
  const opacidad =
    (1 - salida) * interpolate(f, [0, 4], [0, 1], { extrapolateRight: "clamp" });

  // En el golpe de entrada la aberracion se abre fuerte y despues cierra.
  const abre = interpolate(entrada, [0, 0.45, 1], [26, 9, 2.5]);

  const base: React.CSSProperties = {
    fontFamily: "TheBoldFont, sans-serif",
    fontSize: tamano,
    lineHeight: 0.95,
    letterSpacing: -2,
    textTransform: "uppercase",
    textAlign: "center",
    whiteSpace: "pre",
    margin: 0,
  };

  const copia = (c: string, dx: number): React.CSSProperties => ({
    ...base,
    position: "absolute",
    left: dx,
    top: 0,
    color: c,
    mixBlendMode: "screen",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        perspective: 700,
        opacity: opacidad,
      }}
    >
      <div
        style={{
          transform: `translateY(${y}px) translateX(${desplX}px) translateZ(${z}px) rotateY(${giroY}deg) rotateX(${giroX}deg)`,
        }}
      >
        <div style={{ position: "relative" }}>
          {/* las dos copias corridas: rojo a un lado, cian al otro */}
          <div style={copia("#ff0040", -abre)}>{texto}</div>
          <div style={copia("#00fff0", abre)}>{texto}</div>
          {/* la buena, con contorno y resplandor */}
          <div
            style={{
              ...base,
              position: "relative",
              color,
              WebkitTextStroke: "3px rgba(0,0,0,.9)",
              filter: `drop-shadow(0 0 18px ${color}) drop-shadow(0 0 42px ${color}) drop-shadow(0 16px 38px rgba(0,0,0,.8))`,
            }}
          >
            {texto}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
