/* los videos relatados para TikTok (1080×1920, 30 fps). Cuánto dura cada uno sale de su
   relato (medios/voz/<video>/lineas.json) y de su montaje (montajes.js) */
import React from 'react';
import { Composition, Still, staticFile } from 'remotion';
import { Relato, armar, FPS } from './Relato.jsx';
import { LARGO_TOMAS } from './montajes.js';
import { Portada } from './Portada.jsx';
import { PortadaArte } from './PortadaArte.jsx';
import './fuentes.js';

const calcular = async ({ props }) => {
  const { lineas } = await (await fetch(staticFile(`voz/${props.id}/lineas.json`))).json();
  const A = armar(props.id, lineas);
  /* que ningún plano le pida a su toma más de lo que se grabó */
  const largos = LARGO_TOMAS[props.id] || {};
  for (const l of A.L) for (const p of l.planos) if (largos[p.toma] && p.desde + (p.t1 - p.t0) > largos[p.toma] + 0.05) console.warn(`plano ${p.toma} desde ${p.desde} pide ${(p.desde + p.t1 - p.t0).toFixed(2)} s y hay ${largos[p.toma]}`);
  return { durationInFrames: A.total, props: { ...props, lineas } };
};

export const Root = () => (
  <>
    <Composition id="LuzMala" component={Relato} width={1080} height={1920} fps={FPS} durationInFrames={1800}
      defaultProps={{ id: 'luz-mala', lineas: [] }} calculateMetadata={calcular} />
    <Composition id="Kuntur" component={Relato} width={1080} height={1920} fps={FPS} durationInFrames={1800}
      defaultProps={{ id: 'kuntur', lineas: [] }} calculateMetadata={calcular} />
    <Still id="PortadaLuzMala" component={Portada} width={1080} height={1920} defaultProps={{ id: 'luz-mala' }} />
    <Still id="PortadaKuntur" component={Portada} width={1080} height={1920} defaultProps={{ id: 'kuntur' }} />
    <Still id="ArteLuzMala" component={PortadaArte} width={1080} height={1920} defaultProps={{ id: 'luz-mala' }} />
    <Still id="ArteKuntur" component={PortadaArte} width={1080} height={1920} defaultProps={{ id: 'kuntur' }} />
    <Still id="ArteBrillo" component={PortadaArte} width={1080} height={1920} defaultProps={{ id: 'brillo' }} />
  </>
);
