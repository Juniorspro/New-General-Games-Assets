import { json, preflight, exigirSesion } from "./_comun.js";
export const onRequestOptions = preflight;

/* ---------------------------------------------------------------------------
   El archivo de eventos: fotos y videos ordenados por sección.

   Lo que pidió el dueño de la fiesta, textual: «que cada cosa vaya al lugar que
   corresponda, no subir y que quede ahí random». Así que la sección no es un
   campo opcional: sin una sección que exista, no se sube nada.

   Dónde vive cada cosa, y por qué:

   - El archivo pesado —la foto original, el video— va a **KV**, no a D1. Un
     video de celular son decenas de megas y en una fila de base no entra; y
     aunque entrara, D1 corta el tamaño de la respuesta de una consulta, así que
     pedir una grilla de treinta fotos con los originales adentro fallaría.
   - En **D1** queda la ficha (sección, título, descripción) y la **miniatura**,
     que es lo único que necesita la grilla. La miniatura la hace el teléfono
     antes de subir: unos 15 KB contra los 300 del original.
   - Al tocar una foto se pide el original por su cuenta, a `?id=`.

   Con eso la grilla es una consulta a D1 y ni toca KV.

   **Los videos cortos sí se suben acá**, hasta 24 MB, que es lo que entra en un
   valor de KV. Los largos van a YouTube o a MediaFire y se pega el link; en la
   app el botón igual dice «Subir video», porque para el dueño es lo mismo. Las
   razones para no subir los largos son dos: el depósito gratis es 1 GB y un
   puñado de videos de fiesta se lo come, y un video servido desde acá no tiene
   la reproducción
   progresiva que sí le da YouTube. De los de YouTube se saca la tapa sola, de la
   dirección de la miniatura, sin pedir ninguna clave.
   --------------------------------------------------------------------------- */

const TOPE_MEDIO = 24 * 1024 * 1024;   /* KV no guarda valores de más de 25 MB */
const TOPE_MINI  = 120 * 1024;
const POR_PAGINA = 24;

const limpio = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);

/* La clave de una sección nueva se saca del nombre: «Fiesta de la Primavera»
   queda 'fiesta-de-la-primavera'. Sin acentos ni espacios, para que se pueda
   poner en una dirección. */
export function claveDe(nombre) {
  return String(nombre || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/* De qué servicio es el link y, si se puede, de dónde sacar la tapa.
   Sólo YouTube regala la miniatura por dirección fija; de los demás no hay forma
   de sacarla sin clave, así que en la grilla se muestra la tapa que suba el dueño
   o, si no sube ninguna, el cartelito de video. */
export function leerEnlace(url) {
  const u = String(url || "").trim();
  if (!/^https:\/\//i.test(u)) return null;

  let m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/i);
  if (m) return { de: "youtube", id: m[1], enlace: u,
                  tapa: "https://i.ytimg.com/vi/" + m[1] + "/hqdefault.jpg",
                  incrustar: "https://www.youtube-nocookie.com/embed/" + m[1] };

  m = u.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,60})/i);
  if (m) return { de: "drive", id: m[1], enlace: u, tapa: "",
                  incrustar: "https://drive.google.com/file/d/" + m[1] + "/preview" };

  m = u.match(/streamable\.com\/([A-Za-z0-9]{4,12})/i);
  if (m) return { de: "streamable", id: m[1], enlace: u, tapa: "",
                  incrustar: "https://streamable.com/e/" + m[1] };

  if (/mediafire\.com\//i.test(u)) return { de: "mediafire", id: "", enlace: u, tapa: "", incrustar: "" };
  if (/(instagram\.com|facebook\.com|vimeo\.com|tiktok\.com|dailymotion\.com|1drv\.ms|dropbox\.com)/i.test(u))
    return { de: "otro", id: "", enlace: u, tapa: "", incrustar: "" };

  return { de: "otro", id: "", enlace: u, tapa: "", incrustar: "" };
}

/* ------------------------------- leer ------------------------------- */

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const u = new URL(request.url);

  /* un medio suelto: el original, tal como se subió */
  const id = u.searchParams.get("id");
  if (id) return await servirMedio(env, id, u.searchParams.get("descargar") === "1");

  const seccion = limpio(u.searchParams.get("seccion"), 40);
  const album = u.searchParams.get("album");
  const pagina = Math.max(0, parseInt(u.searchParams.get("pagina") || "0", 10) || 0);

  /* Las secciones, con cuántas cosas tiene cada una. Las vacías no se muestran
     en la web —una sección con cero fotos es una promesa incumplida— pero sí se
     le muestran al dueño en la app, que es donde las tiene que llenar. */
  /* La tapa: primero la que eligió el dueño; si no eligió ninguna, la última
     FOTO —nunca un video, porque su miniatura suele ser un cuadro apagado y era
     justo lo que se veía mal—. */
  const secs = ((await env.DB.prepare(
    `SELECT s.clave, s.nombre, s.bajada, s.color, s.icono, s.orden,
            (SELECT COUNT(*) FROM archivo a WHERE a.seccion = s.clave AND a.estado = 'publicada') AS cuantas,
            COALESCE(
              (SELECT a.miniatura FROM archivo a
                 WHERE a.id = s.portada AND a.seccion = s.clave AND a.estado = 'publicada'),
              (SELECT a.miniatura FROM archivo a
                 WHERE a.seccion = s.clave AND a.estado = 'publicada' AND a.tipo = 'foto' AND a.miniatura <> ''
                 ORDER BY a.orden DESC, a.id DESC LIMIT 1),
              (SELECT a.miniatura FROM archivo a
                 WHERE a.seccion = s.clave AND a.estado = 'publicada' AND a.miniatura <> ''
                 ORDER BY a.orden DESC, a.id DESC LIMIT 1),
              /* y si la sección está vacía, la foto que le pusimos de fábrica:
                 la de esa misma estética, que ya vive en la portada del sitio */
              s.tapa_defecto,
              '') AS tapa,
            s.portada
       FROM secciones s ORDER BY s.orden, s.nombre`
  ).all()).results || []);

  if (!seccion) return json({ secciones: secs });

  const laSeccion = secs.find((s) => s.clave === seccion) || null;

  /* ---- adentro de una sección hay ÁLBUMES, no un montón de fotos sueltas ----

     Un álbum es un evento: «Casamiento de Ana y Juan», «15 de Sofía». No hace
     falta una tabla nueva ni un paso más al subir: el álbum ES el título que el
     dueño ya escribe. Sube veinte fotos con el mismo título y quedan las veinte
     en el mismo álbum, que es lo que hace sin que nadie se lo explique.

     Se agrupa por el título en minúsculas y sin espacios de más, así «Casamiento
     Che Roga» y «casamiento che roga  » no salen como dos eventos distintos. Lo
     que se muestra es como lo escribió la primera vez. */
  if (album === null) {
    const r = await env.DB.prepare(
      `SELECT lower(trim(titulo)) AS clave,
              MIN(titulo)         AS nombre,
              COUNT(*)            AS cuantas,
              MAX(descripcion)    AS descripcion,
              MAX(creado)         AS ultimo,
              SUM(CASE WHEN tipo = 'video' THEN 1 ELSE 0 END) AS videos
         FROM archivo
        WHERE seccion = ? AND estado = 'publicada'
        GROUP BY lower(trim(titulo))
        ORDER BY MAX(orden) DESC, MAX(id) DESC`
    ).bind(seccion).all();

    /* la tapa de cada álbum: su última foto, y si son todos videos, la del video */
    const albumes = [];
    for (const a of r.results || []) {
      const t = await env.DB.prepare(
        `SELECT miniatura FROM archivo
          WHERE seccion = ? AND lower(trim(titulo)) = ? AND estado = 'publicada' AND miniatura <> ''
          ORDER BY (tipo = 'foto') DESC, orden DESC, id DESC LIMIT 1`
      ).bind(seccion, a.clave).first();
      albumes.push({ ...a, nombre: a.nombre || "Sueltas", tapa: t ? t.miniatura : "" });
    }
    return json({ secciones: secs, seccion: laSeccion, albumes });
  }

  /* ---- adentro de un álbum, sus fotos ---- */
  const clave = String(album).trim().toLowerCase().slice(0, 90);
  const r = await env.DB.prepare(
    `SELECT id, seccion, tipo, titulo, descripcion, miniatura, mime, enlace, ancho, alto, creado
       FROM archivo WHERE seccion = ? AND lower(trim(titulo)) = ? AND estado = 'publicada'
      ORDER BY orden DESC, id DESC LIMIT ? OFFSET ?`
  ).bind(seccion, clave, POR_PAGINA + 1, pagina * POR_PAGINA).all();

  const filas = r.results || [];
  const hayMas = filas.length > POR_PAGINA;

  /* el nombre del álbum es el mismo que se muestra en la lista —el primero que
     se escribió—, no el de la fila que salga primero: si una tanda vino en
     minúsculas, adentro se veía en minúsculas y afuera no */
  const ficha = await env.DB.prepare(
    `SELECT MIN(titulo) AS nombre, MAX(descripcion) AS descripcion FROM archivo
      WHERE seccion = ? AND lower(trim(titulo)) = ? AND estado = 'publicada'`
  ).bind(seccion, clave).first();

  return json({
    secciones: secs,
    seccion: laSeccion,
    album: { clave, nombre: (ficha && ficha.nombre) || "Sueltas",
             descripcion: (ficha && ficha.descripcion) || "" },
    medios: filas.slice(0, POR_PAGINA),
    pagina, hayMas,
  });
}

/* El original sale de KV con su tipo de verdad, así el navegador lo muestra
   como foto o lo reproduce como video sin que se lo tengamos que explicar. */
async function servirMedio(env, id, descargar) {
  const f = await env.DB.prepare(
    "SELECT llave, mime, tipo, titulo FROM archivo WHERE id = ? AND estado = 'publicada'"
  ).bind(id).first();
  if (!f || !f.llave) return json({ error: "no existe" }, 404);
  if (!env.MEDIOS) return json({ error: "sin depósito de medios" }, 503);

  const cuerpo = await env.MEDIOS.get(f.llave, { type: "stream" });
  if (!cuerpo) return json({ error: "el archivo no está" }, 404);

  const cab = {
    "Content-Type": f.mime || "application/octet-stream",
    /* el original nunca cambia: se puede cachear para siempre */
    "Cache-Control": "public, max-age=31536000, immutable",
    "Access-Control-Allow-Origin": "*",
  };
  if (descargar) {
    const nombre = (claveDe(f.titulo) || "iblo-" + id) + "." +
      ((f.mime || "").split("/")[1] || "bin").replace("quicktime", "mov");
    cab["Content-Disposition"] = 'attachment; filename="' + nombre + '"';
  }
  return new Response(cuerpo, { headers: cab });
}

/* ------------------------------- subir ------------------------------- */

export async function onRequestPost({ request, env }) {
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  if (!env.MEDIOS) return json({ error: "sin depósito de medios" }, 503);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }

  /* crear una sección nueva */
  if (b.nuevaSeccion) {
    const nombre = limpio(b.nuevaSeccion, 40);
    const clave = claveDe(nombre);
    if (!clave) return json({ error: "Ponele un nombre a la sección." }, 400);
    const ultima = await env.DB.prepare("SELECT MAX(orden) AS m FROM secciones").first();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO secciones (clave,nombre,bajada,orden,creado) VALUES (?,?,?,?,?)"
    ).bind(clave, nombre, limpio(b.bajada, 140), (ultima?.m || 0) + 10, Date.now()).run();
    return json({ seccion: { clave, nombre } });
  }

  const seccion = limpio(b.seccion, 40);
  if (!seccion) return json({ error: "Elegí a qué sección va." }, 400);
  /* la sección tiene que existir: es lo que evita que algo quede colgado */
  const existe = await env.DB.prepare("SELECT clave FROM secciones WHERE clave = ?").bind(seccion).first();
  if (!existe) return json({ error: "Esa sección no existe." }, 400);

  /* ---- video por link: no viaja ningún archivo ---- */
  if (b.enlace) {
    const e = leerEnlace(b.enlace);
    if (!e) return json({ error: "Pegá la dirección completa, la que arranca con https://" }, 400);

    /* la tapa: la que sacamos de YouTube, o la foto que haya subido el dueño */
    let mini = e.tapa;
    const suya = String(b.miniatura || "");
    if (suya && /^data:image\/(jpeg|png|webp);base64,/.test(suya) && suya.length <= TOPE_MINI) mini = suya;

    const ultimo0 = await env.DB.prepare(
      "SELECT MAX(orden) AS m FROM archivo WHERE seccion = ?").bind(seccion).first();
    const res0 = await env.DB.prepare(
      `INSERT INTO archivo (seccion,tipo,titulo,descripcion,miniatura,llave,mime,enlace,peso,ancho,alto,orden,estado,creado)
       VALUES (?, 'video', ?, ?, ?, '', '', ?, 0, 0, 0, ?, 'publicada', ?)`
    ).bind(seccion, limpio(b.titulo, 90), limpio(b.descripcion, 600), mini,
           e.enlace, (ultimo0?.m || 0) + 1, Date.now()).run();

    return json({ id: res0.meta?.last_row_id, seccion, tipo: "video", de: e.de, conTapa: !!mini });
  }

  const medio = String(b.medio || "");
  const m = medio.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!m) return json({ error: "Mandame la foto o el video." }, 400);

  const mime = m[1].toLowerCase();
  if (!/^(image\/(jpeg|png|webp)|video\/(mp4|webm|quicktime))$/.test(mime))
    return json({ error: "Se pueden subir fotos (JPG, PNG, WEBP) y videos (MP4, WEBM, MOV)." }, 400);

  let bytes;
  try { bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)); }
  catch { return json({ error: "El archivo llegó cortado. Probá de nuevo." }, 400); }

  if (bytes.length > TOPE_MEDIO)
    return json({ error: "Ese archivo pesa " + Math.round(bytes.length / 1048576) +
                         " MB y el tope es 24 MB. Si es un video largo, recortalo." }, 413);

  const mini = String(b.miniatura || "");
  if (mini && (!/^data:image\/(jpeg|png|webp);base64,/.test(mini) || mini.length > TOPE_MINI))
    return json({ error: "La miniatura no sirve." }, 400);

  const tipo = mime.startsWith("video/") ? "video" : "foto";
  const llave = "arch/" + seccion + "/" + Date.now() + "-" +
                Math.random().toString(36).slice(2, 8);

  await env.MEDIOS.put(llave, bytes, { metadata: { mime, seccion } });

  const ultimo = await env.DB.prepare(
    "SELECT MAX(orden) AS m FROM archivo WHERE seccion = ?"
  ).bind(seccion).first();

  const res = await env.DB.prepare(
    `INSERT INTO archivo (seccion,tipo,titulo,descripcion,miniatura,llave,mime,peso,ancho,alto,orden,estado,creado)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,'publicada',?)`
  ).bind(seccion, tipo, limpio(b.titulo, 90), limpio(b.descripcion, 600), mini, llave, mime,
         bytes.length, parseInt(b.ancho, 10) || 0, parseInt(b.alto, 10) || 0,
         (ultimo?.m || 0) + 1, Date.now()).run();

  return json({ id: res.meta?.last_row_id, seccion, tipo, peso: bytes.length });
}

/* ------------------------- retocar y dar de baja ------------------------- */

/* Cambiarle el texto o pasarlo de sección sin volver a subir el archivo: es lo
   que hace falta cuando algo cayó en el lugar equivocado. */
export async function onRequestPut({ request, env }) {
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  if (!env.DB) return json({ error: "sin base de datos" }, 503);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }

  /* poner una foto de portada de su sección */
  if (b.portadaDe) {
    const idp = parseInt(b.portada, 10) || 0;
    const sec = limpio(b.portadaDe, 40);
    if (idp) {
      const f = await env.DB.prepare(
        "SELECT id FROM archivo WHERE id = ? AND seccion = ? AND estado = 'publicada'").bind(idp, sec).first();
      if (!f) return json({ error: "Esa foto no está en esa sección." }, 400);
    }
    await env.DB.prepare("UPDATE secciones SET portada = ? WHERE clave = ?").bind(idp, sec).run();
    return json({ seccion: sec, portada: idp });
  }

  const id = parseInt(b.id, 10);
  if (!id) return json({ error: "falta el id" }, 400);

  const campos = [], args = [];
  if (b.titulo != null)      { campos.push("titulo = ?");      args.push(limpio(b.titulo, 90)); }
  if (b.descripcion != null) { campos.push("descripcion = ?"); args.push(limpio(b.descripcion, 600)); }
  if (b.seccion != null) {
    const s = limpio(b.seccion, 40);
    const existe = await env.DB.prepare("SELECT clave FROM secciones WHERE clave = ?").bind(s).first();
    if (!existe) return json({ error: "Esa sección no existe." }, 400);
    campos.push("seccion = ?"); args.push(s);
  }
  if (!campos.length) return json({ error: "no hay nada que cambiar" }, 400);

  args.push(id);
  await env.DB.prepare("UPDATE archivo SET " + campos.join(", ") + " WHERE id = ?").bind(...args).run();
  return json({ id, listo: true });
}

export async function onRequestDelete({ request, env }) {
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const u = new URL(request.url);

  /* borrar un evento entero. Va ANTES que el borrado de sección porque los dos
     leen `seccion`: sin el corte, pedir «sacá este álbum» caía en «sacá la
     sección», que rebota porque tiene cosas adentro. */
  const album = u.searchParams.get("album");
  if (album !== null) {
    const sec0 = limpio(u.searchParams.get("seccion"), 40);
    if (!sec0) return json({ error: "falta la sección" }, 400);
    const clave = String(album).trim().toLowerCase().slice(0, 90);
    const r = await env.DB.prepare(
      "SELECT id, llave FROM archivo WHERE seccion = ? AND lower(trim(titulo)) = ?"
    ).bind(sec0, clave).all();
    const filas = r.results || [];
    if (!filas.length) return json({ error: "Ese evento ya no está." }, 404);
    for (const f of filas) {
      if (f.llave && env.MEDIOS) await env.MEDIOS.delete(f.llave).catch(() => {});
      await env.DB.prepare("DELETE FROM archivo WHERE id = ?").bind(f.id).run();
      await env.DB.prepare("UPDATE secciones SET portada = 0 WHERE portada = ?").bind(f.id).run();
    }
    return json({ listo: true, sacadas: filas.length });
  }

  /* borrar una sección: sólo si está vacía, para no dejar fotos huérfanas */
  const sec = u.searchParams.get("seccion");
  if (sec) {
    const c = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM archivo WHERE seccion = ? AND estado = 'publicada'"
    ).bind(sec).first();
    if ((c?.n || 0) > 0)
      return json({ error: "Esa sección tiene " + c.n + " cosas adentro. Sacalas primero." }, 409);
    await env.DB.prepare("DELETE FROM secciones WHERE clave = ?").bind(sec).run();
    return json({ listo: true });
  }

  const id = parseInt(u.searchParams.get("id") || "", 10);
  if (!id) return json({ error: "falta el id" }, 400);

  /* El archivo grande se borra de verdad: si sólo se marcara de baja, el
     depósito se llenaría de cosas que ya nadie ve. */
  const f = await env.DB.prepare("SELECT llave FROM archivo WHERE id = ?").bind(id).first();
  if (f?.llave && env.MEDIOS) await env.MEDIOS.delete(f.llave).catch(() => {});
  await env.DB.prepare("DELETE FROM archivo WHERE id = ?").bind(id).run();
  /* si era la portada de su sección, se vuelve a la automática */
  await env.DB.prepare("UPDATE secciones SET portada = 0 WHERE portada = ?").bind(id).run();
  return json({ listo: true });
}
