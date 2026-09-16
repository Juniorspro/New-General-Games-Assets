import { json, preflight, exigirSesion } from "./_comun.js";
import { CADA, sincronizar } from "./_ig.js";
export const onRequestOptions = preflight;

/* La grilla de la portada.
   Sale de la tabla `ig`, donde conviven dos cosas distintas:

   - los **posteos** del feed, que los trae `sincronizar()`;
   - las **historias**, que las deja ahí el buscador de sugerencias como caché,
     para que al publicar una la app mande sólo el código y la foto no viaje de
     vuelta.

   Las historias nunca estuvieron pensadas para la web, y sin embargo salían:
   se guardan con `publicado = ahora`, así que quedaban siempre arriba de todo y
   además empujaban a los posteos de verdad fuera de la grilla. Ahora duran 24
   horas, como en Instagram, y después se borran solas. */
const DIA = 24 * 3600e3;

export async function onRequestGet({ env, request }) {
  if (!env.DB) return json({ posts: [] });
  const forzar = new URL(request.url).searchParams.get("ahora") === "1";
  const est = await env.DB.prepare("SELECT ultima FROM estado_ig WHERE id = 1").first();
  const vencido = !est || Date.now() - est.ultima > CADA;

  let aviso = null;
  if (vencido || forzar) {
    try { aviso = await sincronizar(env); }
    catch (e) { aviso = { error: String(e).slice(0, 120) }; }
  }

  /* Se borran de verdad y no se esconden: cada historia lleva su foto en
     base64 adentro de la fila, y guardar para siempre lo que ya nadie va a ver
     engorda la base sin motivo. */
  await env.DB.prepare(
    "DELETE FROM ig WHERE tipo = 'historia' AND publicado < ?"
  ).bind(Date.now() - DIA).run();

  const r = await env.DB.prepare(
    "SELECT codigo, texto, imagen, tipo, publicado FROM ig WHERE oculto = 0 ORDER BY publicado DESC LIMIT 40"
  ).all();
  return new Response(JSON.stringify({ posts: r.results || [], sync: aviso }), {
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json; charset=utf-8",
               "Cache-Control": "public, max-age=120" },
  });
}

/* Sacar algo de la grilla desde el panel. No se borra la fila: la próxima
   sincronización la traería de vuelta y el dueño la vería aparecer otra vez sin
   entender por qué. Se marca escondida y listo. */
export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  const codigo = new URL(request.url).searchParams.get("codigo");
  if (!codigo) return json({ error: "falta el código" }, 400);
  const r = await env.DB.prepare("UPDATE ig SET oculto = 1 WHERE codigo = ?").bind(codigo).run();
  if (!r.meta?.changes) return json({ error: "Esa ya no está." }, 404);
  return json({ listo: true });
}
