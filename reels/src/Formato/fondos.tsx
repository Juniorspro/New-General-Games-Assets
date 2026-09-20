import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * Los dos fondos del formato.
 *
 * El topografico se dibuja solo, con SVG: son elipses concentricas deformadas
 * que se desplazan despacio. Asi no depende de ninguna imagen, se ve nitido a
 * cualquier tamaño y se le puede cambiar el color de una linea.
 */

export const FondoBlanco: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
    {/* un vineteado clarito para que el sticker no flote en la nada */}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,.055) 100%)",
      }}
    />
  </AbsoluteFill>
);

export const FondoTopografico: React.FC<{ color?: string; velocidad?: number }> = ({
  color = "#2a2a2a",
  velocidad = 0.12,
}) => {
  const f = useCurrentFrame();
  const desp = f * velocidad;

  // 16 curvas concentricas, cada una un poco mas grande y mas deformada.
  const curvas = Array.from({ length: 16 }, (_, i) => {
    const r = 120 + i * 78;
    const deform = 1 + i * 0.045;
    return (
      <ellipse
        key={i}
        cx={540 + Math.sin((i + desp) / 3.1) * 70}
        cy={960 + Math.cos((i + desp) / 4.3) * 110}
        rx={r}
        ry={r * 0.72 * deform}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        transform={`rotate(${18 + i * 2.5 + desp} 540 960)`}
      />
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        {curvas}
      </svg>
    </AbsoluteFill>
  );
};
