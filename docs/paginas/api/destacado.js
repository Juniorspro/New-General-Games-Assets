import { json, preflight, exigirSesion } from "./_comun.js";
import { COLORES, limpiarPublicacion, guardar } from "./_pub.js";
export const onRequestOptions = preflight;

/* El cartel de la portada. Es el «próximamente» marcado como destacado.
   Vive en la tabla `publicaciones` igual que todo lo demás, pero esta ruta
   sigue devolviendo los mismos campos que antes para no tocar la portada. */
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ destacado: null, colores: COLORES });
  /* Por defecto manda la fiesta más cercana que todavía no pasó, así el dueño
     publica y aparece sola en la portada. Si fijó una a mano (destacado = 1) y
     sigue vigente, esa le gana. */
  const vigente = Date.now() - 6 * 3600e3;
  const campos = "titulo, subtitulo, fecha, cuando, lugar, hora, detalle, color";
  const d =
    (await env.DB.prepare(
      `SELECT ${campos} FROM publicaciones
       WHERE estado = 'publicada' AND destacado = 1 AND cuando > ?
       ORDER BY cuando ASC LIMIT 1`
    ).bind(vigente).first()) ||
    (await env.DB.prepare(
      `SELECT ${campos} FROM publicaciones
       WHERE estado = 'publicada' AND cuando > ?
       ORDER BY cuando ASC LIMIT 1`
    ).bind(vigente).first());
  return new Response(
    JSON.stringify({ destacado: d ? { ...d, activo: 1 } : null, colores: COLORES }),
    { headers: { "Access-Control-Allow-Origin": "*",
                 "Content-Type": "application/json; charset=utf-8",
                 "Cache-Control": "public, max-age=30" } }
  );
}

/* Sigue existiendo para la app vieja: guarda un «próximamente» destacado. */
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const usuario = await exigirSesion(request, env);
  if (!usuario) return json({ error: "Volvé a iniciar sesión." }, 401);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }

  /* activo:false ya no borra nada: baja el destacado que esté puesto */
  if (b.activo === false) {
    await env.DB.prepare(
      "UPDATE publicaciones SET estado = 'baja', tocado = ? WHERE destacado = 1"
    ).bind(Date.now()).run();
    return json({ ok: true });
  }

  const { error, fila } = limpiarPublicacion({ ...b, tipo: "proximamente", destacado: true });
  if (error) return json({ error }, 400);
  const id = await guardar(env, fila, usuario);
  return json({ ok: true, id });
}
