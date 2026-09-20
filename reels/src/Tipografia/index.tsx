import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * La tipografia del formato: entra de golpe, se planta, y se va HACIA LA CAMARA
 * desenfocandose, dejando ver lo que tenia atras.
 *
 * ── LA TRAMPA DEL MODO DIFERENCIA ────────────────────────────────────────────
 * `mix-blend-mode: difference` mezcla el elemento con su FONDO INMEDIATO, y ese
 * fondo es lo que se pinto antes DENTRO DEL MISMO contexto de apilado. Y varias
 * propiedades crean un contexto nuevo sin avisar: `perspective`, `opacity`
 * menor a 1, `isolation`, `will-change`, y un `transform` en un ANTECESOR.
 *
 * O sea: si la perspectiva se pone en un div padre —que es lo natural— el texto
 * queda encerrado y la inversion deja de ver el video. Se mezcla contra la nada
 * y se ve blanco plano.
 *
 * Por eso acá la perspectiva va DENTRO del transform del PROPIO texto
 * (`perspective(700px) translateZ(...)`) y no en un padre. El transform propio
 * no aisla; el del padre si. Es la diferencia entre que ande y que no.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type TipoProps = {
  texto: string;
  /** Cuadros que dura en pantalla, incluido el vuelo de salida. */
  duracion: number;
  /** Altura en porcentaje: 62 la deja abajo y centrada, como la referencia. */
  altura?: number;
  tamano?: number;
  /** false = blanco solido con contorno, para fondos claros. */
  invertir?: boolean;
};

export const Tipografia: React.FC<TipoProps> = ({
  texto,
  duracion,
  altura = 62,
  tamano = 118,
  invertir = true,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ENTRADA: dura y con rebote. damping bajo = pasa de largo y vuelve.
  // Con damping alto la aparicion se siente blanda, que es lo que estaba mal.
  const ent = spring({ frame: f, fps, config: { damping: 9, mass: 0.42, stiffness: 190 } });

  // Arranca lejos y chica, y se planta.
  const zEntrada = interpolate(ent, [0, 1], [-520, 0]);

  // SALIDA: se viene encima de la camara, acelerando.
  // El tramo se mide en SEGUNDOS y no en cuadros: clavado en 13 cuadros, a
  // 60 fps duraba la mitad de tiempo que a 30 y el vuelo salia atropellado.
  const cuadrosSalida = Math.round(fps * 0.43);
  const salida = interpolate(f, [duracion - cuadrosSalida, duracion], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const zSalida = salida * salida * 1500; // al cuadrado: arranca lento y se dispara

  // El desenfoque sigue a la distancia: borrosa lejos, nitida en el medio,
  // y cada vez mas borrosa cuando se viene encima. Es lo que la hace pasar
  // "por delante" en vez de simplemente agrandarse.
  const desenfoque = interpolate(ent, [0, 1], [14, 0]) + salida * 26;

  const opacidad =
    interpolate(ent, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }) *
    interpolate(salida, [0.55, 1], [1, 0], { extrapolateLeft: "clamp" });

  const z = zEntrada + zSalida;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: `${altura}%`,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "TheBoldFont, sans-serif",
          fontSize: tamano,
          lineHeight: 0.98,
          letterSpacing: -1,
          textTransform: "uppercase",
          whiteSpace: "pre",

          // Perspectiva EN EL PROPIO transform: ver la nota de arriba.
          transform: `perspective(700px) translate3d(0, -50%, ${z}px)`,

          filter: `blur(${desenfoque}px)`,
          opacity: opacidad,

          ...(invertir
            ? {
                // El truco: blanco + diferencia = invierte lo que hay detras.
                color: "#ffffff",
                mixBlendMode: "difference" as const,
              }
            : {
                color: "#ffffff",
                WebkitTextStroke: "12px #000",
                paintOrder: "stroke fill" as const,
              }),
        }}
      >
        {texto}
      </div>
    </AbsoluteFill>
  );
};
