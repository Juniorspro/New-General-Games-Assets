/* la composición del tráiler para TikTok (1080×1920) y su portada. Cuánto dura sale del guion;
   el chat, los sonidos y dónde están Nick y Mora en cada toma los guardó tomas.js */
import React from 'react';
import { Composition, staticFile } from 'remotion';
import { ANCHO, ALTO, FPS, tiempos } from '../../guion.js';
import { Trailer } from './Trailer.jsx';
import { Portada } from './Portada.jsx';
import './fuentes.js';

const leer = async (u) => (await fetch(staticFile(u))).json();
const calcular = async ({ props }) => {
  const [datos, comun] = await Promise.all([leer(`tomas/${props.idioma}.json`), leer('tomas/comun.json')]);
  return { durationInFrames: tiempos().total, props: { ...props, datos, comun } };
};

export const Root = () => (
  <>
    <Composition id="Trailer" component={Trailer} width={ANCHO} height={ALTO} fps={FPS} durationInFrames={1700}
      defaultProps={{ idioma: 'es', datos: null, comun: null }} calculateMetadata={calcular} />
    <Composition id="Portada" component={Portada} width={ANCHO} height={ALTO} fps={FPS} durationInFrames={1}
      defaultProps={{ idioma: 'es', datos: null, comun: null }} calculateMetadata={calcular} />
  </>
);
