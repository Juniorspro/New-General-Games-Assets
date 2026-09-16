import { json, preflight, exigirSesion } from "./_comun.js";
import { limpiarPublicacion, guardar } from "./_pub.js";
import { proponer } from "./_ia.js";
export const onRequestOptions = preflight;

/* El dueño le cuenta algo (y le manda el flyer si tiene) y esto arma la
   publicación. Con `publicar: true` la sube él mismo.
   Lo que piensa está en `_ia.js`, compartido con el botón «Nuevo». */

export async function onRequestPost({ request, env }) {
  const usuario = await exigirSesion(request, env);
  if (!usuario) return json({ error: "Volvé a iniciar sesión." }, 401);
  if (!env.AI) return json({ error: "La IA no está disponible." }, 503);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  const texto = String(b.texto || "").slice(0, 900).trim();
  const imagen = String(b.imagen || "");
  const publicar = b.publicar === true;

  if (imagen && !/^data:image\/(webp|jpeg|png);base64,/.test(imagen))
    return json({ error: "Esa imagen no la puedo leer. Mandá una foto o captura común." }, 400);
  if (imagen.length > 900000)
    return json({ error: "La imagen pesa demasiado. Sacale una captura más chica." }, 413);
  if (!texto && !imagen) return json({ error: "Contame qué querés publicar." }, 400);

  const r = await proponer(env, texto, imagen);
  if (r.error) return json({ error: r.error }, r.codigo || 422);

  if (publicar) {
    if (!env.DB) return json({ error: "sin base de datos" }, 503);
    const { error, fila } = limpiarPublicacion({
      ...r.propuesta,
      imagen,
      cuando: r.cuandoMs,
      destacado: false,   // la portada la gana sola la fiesta más cercana
    });
    if (error) return json({ error, propuesta: r.propuesta }, 400);
    const id = await guardar(env, fila, usuario);
    return json({ publicada: { id, ...fila }, propuesta: r.propuesta, leyoFlyer: r.leyoFlyer });
  }

  return json({ propuesta: r.propuesta, leyoFlyer: r.leyoFlyer });
}
