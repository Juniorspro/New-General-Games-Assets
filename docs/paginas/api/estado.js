import { json, preflight } from "./_comun.js";
import { proveedores } from "./_modelos.js";
export const onRequestOptions = preflight;
/* Para que la app sepa si el servidor y la IA están vivos, y de qué IA dispone. */
export async function onRequestGet({ env }) {
  const hay = proveedores(env);
  const cuantas = Object.values(hay).filter(Boolean).length;
  return json({ ok: !!env.DB, ia: cuantas > 0, proveedores: hay, cuantas });
}
