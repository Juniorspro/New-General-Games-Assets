import "./index.css";
import { Composition, staticFile } from "remotion";
import {
  CaptionedVideo,
  calculateCaptionedVideoMetadata,
  captionedVideoSchema,
} from "./CaptionedVideo";
import { DURACION, MortyEdit } from "./MortyEdit";
import { DURACION_TECNICA, Tecnica } from "./Tecnica";

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
