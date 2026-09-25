/* ============================================================================
   aeroplaza/js/aparato.js — qué aparato es y qué calidad le va, antes de
   dibujar el primer cuadro. Se mira el nombre de la placa de video (WebGL lo
   da con WEBGL_debug_renderer_info), la memoria, los núcleos, cuántos píxeles
   tiene la pantalla y si es táctil, y se suman puntos. Después la calidad
   automática de main.js mide los cuadros de verdad y corrige para abajo o para
   arriba: esto solo evita arrancar mal (un celu flojo en alta se traba antes
   de poder medir; una compu buena en media se ve peor sin razón).
   ========================================================================== */
import { TACTIL } from './motor.js';

export function detectarAparato(r) {
  let gpu = '', maxTex = 4096;
  try {
    const gl = r.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
  } catch { /* sin datos: se decide con lo demás */ }
  const g = gpu.toLowerCase(), mem = navigator.deviceMemory || 0, nucleos = navigator.hardwareConcurrency || 4;
  const dpr = devicePixelRatio || 1, pixeles = (screen.width || innerWidth) * (screen.height || innerHeight) * dpr * dpr;
  const A = { gpu, mem, nucleos, dpr: +dpr.toFixed(2), tactil: TACTIL, pixeles: Math.round(pixeles), puntos: 0, calidad: 'media' };
  /* por software (sin placa): lo más liviano, siempre */
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(g)) return { ...A, calidad: 'minima', motivo: 'software' };
  let p = 0;
  const num = (re) => { const m = g.match(re); return m ? +m[1] : 0; };
  if (/nvidia|geforce|quadro|rtx|gtx/.test(g)) p += 3;
  else if (/radeon/.test(g)) p += /vega|graphics/.test(g) && !/rx/.test(g) ? 2 : 3;
  else if (/apple (m\d|gpu)/.test(g)) p += 3;
  else if (/intel/.test(g)) p += /iris|arc|xe/.test(g) ? 2 : 1;
  else if (/adreno/.test(g)) { const n = num(/adreno[^\d]*(\d{3})/); p += n >= 640 ? 2 : n >= 610 ? 1 : -1; }
  else if (/mali/.test(g)) { const n = num(/mali-g(\d+)/); p += n >= 76 ? 2 : n >= 57 ? 1 : -1; }
  else if (/immortalis|xclipse/.test(g)) p += 2;
  else if (/powervr|sgx|videocore|vivante/.test(g)) p -= 1;
  if (mem) p += mem >= 8 ? 2 : mem >= 4 ? 1 : -1;
  p += nucleos >= 8 ? 1 : nucleos <= 4 ? -1 : 0;
  if (TACTIL) p -= 1;
  /* pantallas con muchísimos píxeles cuestan más de llenar */
  if (pixeles > 9e6) p -= 1;
  if (maxTex < 8192) p -= 1;
  A.puntos = p;
  /* (26/09) los más flojos (placa vieja, 2 GB, 4 núcleos) arrancan en mínima: sin posproceso ni brillos */
  A.calidad = p >= 4 ? 'alta' : p >= 1 ? 'media' : p >= -1 ? 'baja' : 'minima';
  return A;
}
