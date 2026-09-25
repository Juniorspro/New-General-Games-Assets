/* la composición del tráiler para TikTok (1080×1920, 30 fps) y su portada (en 9:16 y en el 3:4 de la grilla). Cuánto dura sale del guion */
import React from 'react';
import { Composition } from 'remotion';
import { ANCHO, ALTO, FPS, CUADROS } from '../../guion.js';
import { Trailer } from './Trailer.jsx';
import { Portada } from './Portada.jsx';
import './fuentes.js';

export const Root = () => (
  <>
    <Composition id="Trailer" component={Trailer} width={ANCHO} height={ALTO} fps={FPS} durationInFrames={CUADROS} defaultProps={{ sinMusica: false }} />
    <Composition id="Portada" component={Portada} width={ANCHO} height={ALTO} fps={FPS} durationInFrames={1} defaultProps={{}} />
    <Composition id="Portada34" component={Portada} width={ANCHO} height={1440} fps={FPS} durationInFrames={1} defaultProps={{}} />
  </>
);
