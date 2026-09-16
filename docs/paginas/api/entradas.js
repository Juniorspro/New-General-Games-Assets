import { json, preflight, exigirSesion } from "./_comun.js";
import { CAMPOS, filtroSolapa, limpiarPublicacion, guardar } from "./_pub.js";
export const onRequestOptions = preflight;

/* Las entradas a la venta. Salen de `publicaciones` con tipo 'entrada'.
   La forma de la respuesta es la de antes para no tocar la página de entradas. */
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ entradas: [] });
  const f = filtroSolapa("entradas");
  const r = await env.DB.prepare(
    `SELECT ${CAMPOS} FROM publicaciones
     WHERE estado = 'publicada' AND (${f.donde}) ${f.orden} LIMIT 40`
  ).bind(...f.args).all();
  const entradas = (r.results || []).map((p) => ({ ...p, descripcion: p.detalle }));
  return new Response(JSON.stringify({ entradas }), {
    headers: { "Access-Control-Allow-Origin": "*",
               "Content-Type": "application/json; charset=utf-8",
               "Cache-Control": "public, max-age=30" },
  });
}

/* Publicar una entrada. Sólo con sesión. */
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const usuario = await exigirSesion(request, env);
  if (!usuario) return json({ error: "Volvé a iniciar sesión." }, 401);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  /* la app vieja manda `descripcion`; la nueva manda `detalle` */
  const { error, fila } = limpiarPublicacion({
    ...b, tipo: "entrada", detalle: b.detalle || b.descripcion,
  });
  if (error) return json({ error }, 400);
  if (!fila.detalle) return json({ error: "Falta la descripción." }, 400);

  const id = await guardar(env, fila, usuario);
  return json({ ok: true, id });
}

/* Bajar una entrada. */
export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  const id = Number(new URL(request.url).searchParams.get("id") || 0);
  if (!id) return json({ error: "falta el id" }, 400);
  await env.DB.prepare(
    "UPDATE publicaciones SET estado = 'baja', tocado = ? WHERE id = ?"
  ).bind(Date.now(), id).run();
  return json({ ok: true });
}
