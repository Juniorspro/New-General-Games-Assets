import "./index.css";
import { Composition, staticFile } from "remotion";
import {
  CaptionedVideo,
  calculateCaptionedVideoMetadata,
  captionedVideoSchema,
} from "./CaptionedVideo";
import { DURACION, MortyEdit } from "./MortyEdit";
import { DURACION_TECNICA, Tecnica } from "./Tecnica";
import { DURACION_EDIT, EditMorty, editMortySchema } from "./EditMorty";
import { Formato, formatoSchema, repartir } from "./Formato";
import { DURACION_TIPO, TipografiaDemo } from "./Tipografia/Demo";
import { DURACION_COMPLETO, EditCompleto, editCompletoSchema, FPS } from "./EditCompleto";

// Cada <Composition> es una entrada en la barra lateral del estudio.

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EditCompleto"
        component={EditCompleto}
        schema={editCompletoSchema}
        durationInFrames={DURACION_COMPLETO}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          clip: "clip_150.mp4",
          musica: "",
          velocidad: 0.4,
          // drop fuera de rango: la inversion neon sobre material YA turquesa
          // da magenta barroso. El efecto esta bien; no es para este clip.
          drop: 9999,
          golpes: [0, 76, 152, 228],
          mascota: "mascota.png",
          palabras: [
            { texto: "EL CORTE", desde: 12, dura: 68 },
            { texto: "NO ES", desde: 84, dura: 60 },
            { texto: "EL RITMO", desde: 148, dura: 68 },
            { texto: "ClaudEdits", desde: 220, dura: 76 },
          ],
        }}
      />
      <Composition
        id="MortyEdit"
        component={MortyEdit}
        durationInFrames={DURACION}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Tipografia"
        component={TipografiaDemo}
        durationInFrames={DURACION_TIPO}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Formato"
        component={Formato}
        schema={formatoSchema}
        durationInFrames={330}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          fondo: "blanco" as const,
          audio: "",
          guion: repartir(
            "este juego tiene mas lag que mi paciencia un martes a la manana y todavia dicen que esta optimizado",
            18,
            13,
          ),
          inserts: [
            { tipo: "sticker" as const, archivo: "pose-piensa.png", desde: 20, dura: 95, x: 50, y: 34, ancho: 52, giro: -4 },
            { tipo: "video" as const, archivo: "t2.mp4", desde: 120, dura: 90, x: 50, y: 30, ancho: 74, giro: 3 },
            { tipo: "sticker" as const, archivo: "pose-shock.png", desde: 132, dura: 78, x: 74, y: 58, ancho: 40, giro: 6 },
            { tipo: "sticker" as const, archivo: "pose-aprueba.png", desde: 225, dura: 95, x: 50, y: 36, ancho: 54, giro: -3 },
          ],
        }}
      />
      <Composition
        id="EditMorty"
        component={EditMorty}
        schema={editMortySchema}
        durationInFrames={DURACION_EDIT}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          clip: "t1.mp4",
          musica: "",
          velocidad: 0.4,
          drop: 150,
          golpes: [0, 60, 104, 150, 196, 244, 300],
          titulo: "EVIL\nMORTY",
          remate: "EL UNICO\nQUE SOBRA",
          colorTitulo: "#eaff00",
          colorRemate: "#8cff3f",
        }}
      />
      <Composition
        id="Tecnica"
        component={Tecnica}
        durationInFrames={DURACION_TECNICA}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="CaptionedVideo"
        component={CaptionedVideo}
        calculateMetadata={calculateCaptionedVideoMetadata}
        schema={captionedVideoSchema}
        width={1080}
        height={1920}
        defaultProps={{
          src: staticFile("sample-video.mp4"),
        }}
      />
    </>
  );
};
