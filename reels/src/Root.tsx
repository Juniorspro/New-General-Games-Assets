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

// Cada <Composition> es una entrada en la barra lateral del estudio.

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MortyEdit"
        component={MortyEdit}
        durationInFrames={DURACION}
        fps={30}
        width={1080}
        height={1920}
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
