/* Los avisos de quien esta mirando. */
import { quienEs, json } from "./_social.js";

export const onRequestGet = async ({ request, env }) => {
  if (!env.DB) return json({ avisos: [] });
  const yo = await quienEs(env, request);
  if (!yo) return json({ avisos: [] });
  const { results } = await env.DB.prepare(
    "SELECT id, texto, tipo, leido, creado FROM avisos WHERE usuario = ? " +
    "ORDER BY creado DESC LIMIT 20").bind(yo.u).all();
  return json({ avisos: results, sinLeer: results.filter((a) => !a.leido).length });
};

/* Marcar como leido. Con `id` marca ESE aviso y no los demas: cada aviso se
   muestra como una ventanita que se cierra sola, y cerrar una no puede hacer
   desaparecer las otras. Sin `id` marca todos, que es lo que hace abrir la
   lista completa.

   El `usuario = ?` del WHERE no sobra aunque venga un id: sin el, cualquiera
   con sesion podria marcar como leidos los avisos de otro pasando su numero. */
export const onRequestPost = async ({ request, env }) => {
  if (!env.DB) return json({ ok: true });
  const yo = await quienEs(env, request);
  if (!yo) return json({ error: "sin sesión" }, 401);

  let c = {};
  try { c = await request.json(); } catch {}
  const id = parseInt(c.id, 10);

  if (id) {
    await env.DB.prepare("UPDATE avisos SET leido = 1 WHERE id = ? AND usuario = ?")
      .bind(id, yo.u).run();
  } else {
    await env.DB.prepare("UPDATE avisos SET leido = 1 WHERE usuario = ?").bind(yo.u).run();
  }
  return json({ ok: true });
};
