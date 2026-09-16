import { json, preflight, exigirSesion } from "./_comun.js";
import { CAMPOS } from "./_pub.js";
export const onRequestOptions = preflight;

/* Todo lo que subió el dueño, incluso lo dado de baja. Sólo con sesión. */
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ publicaciones: [] });
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  const r = await env.DB.prepare(
    `SELECT ${CAMPOS}, estado, tocado FROM publicaciones ORDER BY creado DESC LIMIT 120`
  ).all();
  const publicaciones = r.results || [];
  /* `entradas` es el nombre que usaba la app anterior */
  return json({ publicaciones, entradas: publicaciones });
}
