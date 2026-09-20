import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile } from "remotion";
import { loadFont } from "../load-font";
import { Tipografia } from "./index";

loadFont();

export const DURACION_TIPO = 270;

/**
 * Prueba de la tipografia sobre un fondo de verdad.
 *
 * El orden de las capas importa y no es decorativo: el video y la mascota se
 * pintan ANTES y en el MISMO contexto de apilado que el texto. Si alguna de
 * las dos se envolviera en algo que cree contexto por encima del texto, la
 * inversion dejaria de verlas.
 */

const PALABRAS: { texto: string; desde: number; dura: number }[] = [
  { texto: "ESTE", desde: 6, dura: 26 },
  { texto: "FORMATO", desde: 32, dura: 30 },
  { texto: "SE LEE", desde: 62, dura: 28 },
  { texto: "INVIRTIENDO", desde: 90, dura: 34 },
  { texto: "LO QUE", desde: 124, dura: 26 },
  { texto: "TIENE", desde: 150, dura: 26 },
  { texto: "DETRAS", desde: 176, dura: 34 },
  { texto: "ClaudEdits", desde: 214, dura: 48 },
];

export const TipografiaDemo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    {/* 1. el video, al fondo */}
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile("t2.mp4")}
        muted
        playbackRate={0.5}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>

    {/* 2. la mascota, grande y muy desenfocada, DETRAS DEL TEXTO
           El texto se planta al 62 % y despues se viene hacia la camara; lo que
           tiene que descubrir al pasar es pelo y capucha. Asi que la cabeza va
           justo ahi, no pegada al techo: arriba del todo el texto no descubre
           nada y la mascota se lee como un adorno suelto. */}
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <Img
        src={staticFile("mascota.png")}
        style={{
          // Tres intentos para encontrar esto:
          //  - pegada arriba: el texto no descubre nada, queda de adorno;
          //  - centrada y enorme: una mancha borrosa que tapa todo el cuadro;
          //  - asi: la cabeza arriba del texto, mas chica y translucida, y el
          //    video se sigue leyendo alrededor. Eso es profundidad y no un velo.
          width: "88%",
          marginTop: "-14%",
          filter: "blur(15px) brightness(1.06)",
          opacity: 0.62,
        }}
      />
    </AbsoluteFill>

    {/* 3. el texto, que invierte todo lo de arriba */}
    {PALABRAS.map((p, i) => (
      <Sequence key={i} from={p.desde} durationInFrames={p.dura} name={p.texto}>
        <Tipografia texto={p.texto} duracion={p.dura} altura={62} tamano={128} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
