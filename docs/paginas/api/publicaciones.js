import { json, preflight, exigirSesion } from "./_comun.js";
import { TIPOS, COLORES, CAMPOS, ORDEN, SOLAPAS, filtroSolapa, limpiarPublicacion, guardar } from "./_pub.js";
export const onRequestOptions = preflight;

/* Lo que lee la web. Sin sesión: es público. `?tipo=` filtra una solapa. */
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ publicaciones: [], colores: COLORES });

  const q = new URL(request.url).searchParams;
  const solapa = q.get("solapa") || "";
  const tipo = q.get("tipo") || "";

  /* `solapa` es lo que usa la web; `tipo` queda para lo que ya lo pedía así */
  const f = SOLAPAS.includes(solapa) ? filtroSolapa(solapa) : null;
  const porTipo = !f && TIPOS.includes(tipo);
  const donde = f ? f.donde : porTipo ? "tipo = ?" : "1 = 1";
  const args = f ? f.args : porTipo ? [tipo] : [];

  const r = await env.DB.prepare(
    `SELECT ${CAMPOS} FROM publicaciones
     WHERE estado = 'publicada' AND (${donde}) ${f ? f.orden : ORDEN} LIMIT 60`
  ).bind(...args).all();

  return new Response(
    JSON.stringify({ publicaciones: r.results || [], colores: COLORES }),
    { headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=30",
      } }
  );
}

/* Publicar. Sólo con sesión. */
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const usuario = await exigirSesion(request, env);
  if (!usuario) return json({ error: "Volvé a iniciar sesión." }, 401);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }

  /* Cuando la publicación sale de un posteo de Instagram, la foto ya está
     guardada del lado del servidor: la app manda el código y no la vuelve a
     subir, que serían cientos de kilobytes de ida y de vuelta. */
  const origen = String(b.origen || "").slice(0, 40);
  if (origen && !b.imagen) {
    const post = await env.DB.prepare("SELECT imagen FROM ig WHERE codigo = ?").bind(origen).first();
    if (post && post.imagen) b = { ...b, imagen: post.imagen };
  }

  const { error, fila } = limpiarPublicacion(b);
  if (error) return json({ error }, 400);

  /* Actualizar una que ya está en vez de subir otra igual. Pasa seguido con las
     historias: el dueño ya cargó la fiesta y la historia trae un dato nuevo
     —el precio, casi siempre—. Sólo se pisan los campos que vienen con algo. */
  const actualizar = Number(b.actualizar || 0);
  if (actualizar) {
    const antes = await env.DB.prepare(
      "SELECT * FROM publicaciones WHERE id = ?"
    ).bind(actualizar).first();
    if (!antes) return json({ error: "Esa publicación ya no está." }, 404);

    /* Sólo se completa lo que está vacío. Nunca se pisa lo que el dueño ya
       cargó: la primera versión reemplazaba el lugar que él había escrito bien
       («Club Juventud, Margarita Belén») por la lectura del flyer, que venía
       peor. Agregar sí, sobrescribir no. */
    const campos = ["subtitulo","detalle","fecha","cuando","lugar","hora",
                    "precio","imagen","adorno","adorno_pos"];
    const nuevos = campos.filter((c) => fila[c] && !antes[c]);
    if (!nuevos.length) return json({ error: "No hay nada nuevo que ponerle." }, 400);

    await env.DB.prepare(
      "UPDATE publicaciones SET " + nuevos.map((c) => c + " = ?").join(", ") +
      ", origen = COALESCE(origen, ?), tocado = ? WHERE id = ?"
    ).bind(...nuevos.map((c) => fila[c]), origen || null, Date.now(), actualizar).run();

    return json({ ok: true, id: actualizar, actualizada: true, cambio: nuevos });
  }

  const id = await guardar(env, fila, usuario, origen || null);
  const { imagen, adorno, ...liviana } = fila;
  return json({ ok: true, id, publicacion: { id, ...liviana, conFoto: !!imagen, conAdorno: !!adorno } });
}

/* Bajar una publicación. */
/* Elegir cuál de las publicaciones es «la próxima fecha», la que ocupa el cartel
   de la portada. Hace falta DESPUÉS de publicar: el dueño carga cinco cosas de la
   misma fiesta y recién viéndolas juntas decide cuál va arriba. Sin esto, la
   portada la elegía sola la que tuviera la fecha más cercana. */
export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  const id = Number(b.id || 0);
  if (!id) return json({ error: "falta el id" }, 400);

  /* Volver a subir algo bajado. `DELETE` sólo marca `estado = 'baja'`, así que
     la publicación sigue entera; sin esta vuelta había que cargarla de nuevo a
     mano, con foto y todo, para un cambio de opinión. */
  if (b.estado === "publicada") {
    const r = await env.DB.prepare(
      "UPDATE publicaciones SET estado = 'publicada', tocado = ? WHERE id = ?"
    ).bind(Date.now(), id).run();
    if (!r.meta?.changes) return json({ error: "Esa publicación ya no está." }, 404);
    return json({ listo: true, estado: "publicada" });
  }

  if (b.destacado === false) {
    await env.DB.prepare("UPDATE publicaciones SET destacado = 0, tocado = ? WHERE id = ?")
      .bind(Date.now(), id).run();
    return json({ listo: true, destacado: 0 });
  }

  const p = await env.DB.prepare(
    "SELECT id, cuando FROM publicaciones WHERE id = ? AND estado = 'publicada'").bind(id).first();
  if (!p) return json({ error: "Esa publicación ya no está." }, 404);
  if (!p.cuando) return json({ error: "Para ir a la portada tiene que tener fecha." }, 400);

  /* el cartel es uno solo: al poner esta, se le cae a la anterior */
  await env.DB.prepare("UPDATE publicaciones SET destacado = 0 WHERE destacado = 1").run();
  await env.DB.prepare("UPDATE publicaciones SET destacado = 1, tocado = ? WHERE id = ?")
    .bind(Date.now(), id).run();
  return json({ listo: true, destacado: 1 });
}

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
