import React from "react";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont } from "../load-font";
import { Barrido, Grano, Resplandor, Temblor, Vineta } from "./efectos";
import { Firma, Portada } from "./MarcaAgua";
import { TextoPerspectiva } from "./TextoPerspectiva";

loadFont();

export const DURACION = 360; // 12 s a 30 fps
const ENTRA_ESCENA = 46;

/** Los golpes donde cae el corte. Todo lo demas cuelga de acá. */
const GOLPES = [46, 92, 138, 184, 230, 276, 304, 330];

/**
 * Cuanta energia hay en este cuadro: 1 justo en el golpe, cayendo rapido.
 * Es lo que hace que el zoom, el temblor y la aberracion respiren juntos en
 * vez de ir cada uno por su lado.
 */
const energia = (f: number, caida = 11) => {
  let e = 0;
  for (const g of GOLPES) {
    if (f >= g) e = Math.max(e, Math.max(0, 1 - (f - g) / caida));
  }
  return e;
};

/** La escena: copia borrosa atras para llenar el 9:16, la buena adelante. */
const Escena: React.FC = () => {
  const f = useCurrentFrame();
  const e = energia(f + ENTRA_ESCENA);

  // Empuje lento continuo + el tiron de cada golpe.
  const zoom = 1.04 + f * 0.00055 + e * 0.085;
  const src = staticFile("evilmorty.mp4");

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* relleno: la misma escena reventada y borrosa */}
      <AbsoluteFill>
        <OffthreadVideo
          src={src}
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(46px) brightness(0.45) saturate(1.5)",
            transform: "scale(1.35)",
          }}
        />
      </AbsoluteFill>

      {/* la escena de verdad, cuadrada y centrada */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: 1080,
            height: 1080,
            transform: `scale(${zoom})`,
            overflow: "hidden",
            boxShadow: "0 40px 120px rgba(0,0,0,.8)",
          }}
        >
          <OffthreadVideo
            src={src}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Rick recortado del verde, entrando desde abajo a la derecha. */
const RickChroma: React.FC = () => {
  const f = useCurrentFrame();
  const entra = interpolate(f, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sale = interpolate(f, [120, 148], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(entra, [0, 1], [640, 0]) + sale * 520;
  const flota = Math.sin(f / 18) * 12;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "flex-end",
        opacity: 1 - sale,
      }}
    >
      <Resplandor radio={22} fuerza={0.38}>
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-end" }}>
          <OffthreadVideo
            src={staticFile("rick_alpha.webm")}
            transparent
            muted
            style={{
              width: 760,
              transform: `translate(60px, ${y + flota}px)`,
              filter: "drop-shadow(-18px 10px 28px rgba(0,0,0,.65))",
            }}
          />
        </AbsoluteFill>
      </Resplandor>
    </AbsoluteFill>
  );
};

/** Cierre: destello, negro y la firma. */
const Cierre: React.FC<{ duracion: number }> = ({ duracion }) => {
  const f = useCurrentFrame();
  const negro = interpolate(f, [0, 10, duracion - 22, duracion], [0, 0.15, 0.15, 1], {
    extrapolateRight: "clamp",
  });
  const destello = interpolate(f, [0, 5], [0.85, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: negro }} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: destello }} />
    </AbsoluteFill>
  );
};

export const MortyEdit: React.FC = () => {
  const f = useCurrentFrame();
  const e = energia(f);

  // El temblor global vive de la misma energia que el zoom.
  const temblor = e * 13 + (f > ENTRA_ESCENA ? 1.1 : 0);

  // Parpadeo de exposicion en el golpe: como si la camara se pasara de luz.
  // Flojo a proposito: con 0.26 el cuadro entero se iba a blanco amarillento,
  // porque la escena ya trae mucha luz propia.
  const sobre = e * 0.11;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Temblor fuerza={temblor}>
        <Sequence from={ENTRA_ESCENA} durationInFrames={270} name="escena">
          <Escena />
        </Sequence>

        <Sequence from={150} durationInFrames={150} name="rick">
          <RickChroma />
        </Sequence>
      </Temblor>

      {/* textos: por fuera del temblor de camara, con el suyo propio */}
      <Sequence from={62} durationInFrames={72} name="texto-1">
        <TextoPerspectiva texto={"EVIL\nMORTY"} desde="izquierda" color="#eaff00" tamano={190} y={-450} duracion={72} />
      </Sequence>

      <Sequence from={196} durationInFrames={66} name="texto-2">
        <TextoPerspectiva texto={"EL UNICO\nQUE SOBRA"} desde="derecha" color="#8cff3f" tamano={120} y={430} duracion={66} />
      </Sequence>

      {/* capas de acabado */}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: sobre, mixBlendMode: "overlay", pointerEvents: "none" }} />
      <Vineta fuerza={0.62} />
      <Barrido />
      <Grano opacidad={0.055} />

      <Sequence from={ENTRA_ESCENA} name="firma">
        <Firma />
      </Sequence>

      <Sequence from={0} durationInFrames={52} name="portada">
        <Portada duracion={52} />
      </Sequence>

      <Sequence from={306} durationInFrames={DURACION - 306} name="cierre">
        <Cierre duracion={DURACION - 306} />
      </Sequence>

      <Sequence from={ENTRA_ESCENA}>
        <Audio src={staticFile("escena-audio.m4a")} volume={0.9} />
      </Sequence>
    </AbsoluteFill>
  );
};
