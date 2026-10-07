/* Los datos del juego: en desarrollo, archivos al lado (datos/…); en el HTML de un solo archivo van
   adentro, en base64 (los JSON y los .bin, comprimidos con gzip), y se convierten en blobs al arrancar.
   Todo lo que se pide (fetch, texturas, audio) pasa por url(). */
const BLOBS = new Map();

export async function prepararEmbebidos(progreso = () => {}) {
  const E = window.__EMBEBIDOS;
  if (!E) return;
  const claves = Object.keys(E);
  let n = 0;
  for (const p of claves) {
    const { b, z, t } = E[p];
    const bin = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
    let blob = new Blob([bin], { type: t || 'application/octet-stream' });
    if (z) blob = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
    BLOBS.set(p, URL.createObjectURL(blob));
    delete E[p];
    if (++n % 8 === 0) { progreso(n / claves.length); await new Promise((r) => setTimeout(r, 0)); }
  }
  window.__EMBEBIDOS = null;
}

export const url = (p) => BLOBS.get(p) || p;

export async function traer(p, tipo = 'json') {
  const r = await fetch(url(p));
  if (!r.ok) throw new Error(p + ' ' + r.status);
  return r[tipo]();
}
