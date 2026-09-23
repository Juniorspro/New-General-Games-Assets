/* las letras del tráiler (Open Sans y Nunito, OFL): Remotion no dibuja hasta que cargan */
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';

const espera = delayRender('fuentes');
const caras = [
  new FontFace('Open Sans', `url('${staticFile('fuentes/opensans.woff2')}') format('woff2')`, { weight: '400 800' }),
  new FontFace('Nunito', `url('${staticFile('fuentes/nunito.woff2')}') format('woff2')`, { weight: '800 900' }),
];
Promise.all(caras.map((c) => c.load()))
  .then((cs) => { cs.forEach((c) => document.fonts.add(c)); continueRender(espera); })
  .catch((e) => cancelRender(e));
