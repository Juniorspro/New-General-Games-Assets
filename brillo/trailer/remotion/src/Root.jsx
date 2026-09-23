/* las dos composiciones: la horizontal (YouTube, web) y la vertical (TikTok, Reels, Shorts).
   Cuánto dura sale del guion y de lo que midió tomas.js (la Actualización dura lo que duran sus charlas). */
import React from 'react';
import { Composition, staticFile } from 'remotion';
import { FPS, tiempos } from '../../guion.js';
import { Trailer } from './Trailer.jsx';
import './fuentes.js';

const calcular = async ({ props }) => {
  const datos = await (await fetch(staticFile(`tomas/${props.idioma}.json`))).json();
  return { durationInFrames: tiempos(datos.medidas).total, props: { ...props, datos } };
};

export const Root = () => (
  <>
    <Composition id="Trailer" component={Trailer} width={1920} height={1080} fps={FPS} durationInFrames={2700}
      defaultProps={{ idioma: 'es', vertical: false, datos: null }} calculateMetadata={calcular} />
    <Composition id="TrailerVertical" component={Trailer} width={1080} height={1920} fps={FPS} durationInFrames={2700}
      defaultProps={{ idioma: 'es', vertical: true, datos: null }} calculateMetadata={calcular} />
  </>
);
