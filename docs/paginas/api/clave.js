import { json, preflight, derivar, iguales, nuevaSal, exigirSesion } from "./_comun.js";
export const onRequestOptions = preflight;
/* cambiar la contraseña, sabiendo la actual */
export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.SECRETO) return json({ error: "sin base de datos" }, 503);
  const quien = await exigirSesion(request, env);
  if (!quien) return json({ error: "Volvé a iniciar sesión." }, 401);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  const actual = String(b.actual || ""), nueva = String(b.nueva || "");
  if (nueva.length < 8) return json({ error: "La nueva necesita al menos 8 caracteres." }, 400);
  if (nueva === actual) return json({ error: "La nueva tiene que ser distinta de la de ahora." }, 400);

  const u = await env.DB.prepare("SELECT hash, sal FROM usuarios WHERE usuario = ?").bind(quien).first();
  if (!u) return json({ error: "No existe el usuario." }, 404);
  if (!iguales(await derivar(actual, u.sal), u.hash))
    return json({ error: "La contraseña de ahora no es esa." }, 401);

  const sal = nuevaSal();
  await env.DB.prepare("UPDATE usuarios SET hash = ?, sal = ? WHERE usuario = ?")
    .bind(await derivar(nueva, sal), sal, quien).run();
  return json({ ok: true });
}
