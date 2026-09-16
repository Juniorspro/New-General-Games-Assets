/* El muro: publicaciones y perfiles.
 *
 * EL DINERO NO PASA POR ACA, Y ES A PROPOSITO. Cada publicacion lleva EL
 * enlace de cobro de quien la escribio, y el que quiere apoyar va directo a esa
 * cuenta. Si la plata pasara por la del sitio, esto seria un intermediario de
 * pagos —con todo lo que eso implica— y habria que responder por proyectos que
 * no son nuestros. Asi, el sitio pone la vidriera y nada mas.
 *
 * Por lo mismo el contador de apoyos NO es dinero: es cuanta gente dijo que
 * apoya. Mostrarlo como plata recaudada seria inventar una cifra que este
 * servidor no tiene forma de conocer.
 */
import { quienEs, limpio, enlaceVale, json } from "./_social.js";

const PAGINA = 20;

export const onRequestGet = async ({ request, env }) => {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const q = new URL(request.url).searchParams;
  const yo = await quienEs(env, request);

  /* ------------------------------------------------------- un perfil */
  if (q.get("perfil")) {
    const u = await env.DB.prepare(
      "SELECT id, usuario, nombre, retrato, sobre, cobro, creado, " +
      "       marco, banda, lema, acceso FROM usuarios " +
      "WHERE usuario = ? AND bloqueado = 0").bind(q.get("perfil").toLowerCase()).first();
    if (!u) return json({ error: "No existe ese perfil." }, 404);
    const { results } = await env.DB.prepare(
      "SELECT p.*, (SELECT COUNT(*) FROM apoyos a WHERE a.pub = p.id) AS apoyos " +
      "FROM publicaciones p WHERE p.autor = ? AND p.oculto = 0 " +
      "ORDER BY p.creado DESC LIMIT ?").bind(u.id, PAGINA).all();
    return json({ perfil: u, publicaciones: results, yo: yo ? yo.u : null });
  }

  /* -------------------------------------------------------- buscar
     La caja de arriba del escritorio busca ACÁ y no en internet: lo que hay
     para encontrar son las publicaciones y la gente de este sitio. Un buscador
     que no busca lo que tenés delante es un adorno.

     Se escapan `%` y `_` antes de armar el LIKE: sin eso, alguien que busca
     «%» pide todas las filas, y «_» le pega a cualquier cosa. No es un agujero
     grave, pero es una consulta que no hace lo que dice. */
  const busca = (q.get("busca") || "").trim().slice(0, 60);
  if (busca) {
    const como = "%" + busca.replace(/[\\%_]/g, (x) => "\\" + x) + "%";
    const { results } = await env.DB.prepare(
      "SELECT p.*, u.usuario, u.nombre, u.retrato, u.marco, u.lema, u.acceso, " +
      "  (SELECT COUNT(*) FROM apoyos a WHERE a.pub = p.id) AS apoyos " +
      "FROM publicaciones p JOIN usuarios u ON u.id = p.autor " +
      "WHERE p.oculto = 0 AND u.bloqueado = 0 AND (" +
      "  p.titulo LIKE ?1 ESCAPE '\\' OR p.cuerpo LIKE ?1 ESCAPE '\\' OR " +
      "  u.usuario LIKE ?1 ESCAPE '\\' OR u.nombre LIKE ?1 ESCAPE '\\') " +
      "ORDER BY p.creado DESC LIMIT ?2").bind(como, PAGINA).all();

    const gente = await env.DB.prepare(
      "SELECT usuario, nombre, retrato, marco, lema, acceso FROM usuarios " +
      "WHERE bloqueado = 0 AND (usuario LIKE ?1 ESCAPE '\\' OR nombre LIKE ?1 ESCAPE '\\') " +
      "LIMIT 6").bind(como).all();

    return json({ publicaciones: results, gente: gente.results || [],
                  busca, yo: yo ? yo.u : null });
  }

  /* --------------------------------------------------------- el muro */
  const antes = parseInt(q.get("antes") || "0", 10) || Date.now();
  const { results } = await env.DB.prepare(
    /* el marco y la insignia viajan con cada publicación: son de quien la
       escribió y se ven acá, que es donde los mira el resto */
    "SELECT p.*, u.usuario, u.nombre, u.retrato, u.marco, u.lema, u.acceso, " +
    "  (SELECT COUNT(*) FROM apoyos a WHERE a.pub = p.id) AS apoyos " +
    "FROM publicaciones p JOIN usuarios u ON u.id = p.autor " +
    "WHERE p.oculto = 0 AND u.bloqueado = 0 AND p.creado < ? " +
    "ORDER BY p.creado DESC LIMIT ?").bind(antes, PAGINA).all();
  return json({ publicaciones: results, yo: yo ? yo.u : null });
};

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const yo = await quienEs(env, request);
  if (!yo) return json({ error: "Entrá con tu cuenta para publicar." }, 401);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  /* ---------------------------------------------------------- publicar */
  if (c.hacer === "publicar") {
    const titulo = limpio(c.titulo, 90);
    const cuerpo = limpio(c.cuerpo, 1500);
    if (titulo.length < 4) return json({ error: "Poné un título de al menos 4 letras." }, 400);
    if (cuerpo.length < 10) return json({ error: "Contá un poco más qué querés hacer." }, 400);

    /* freno simple: una publicacion cada dos minutos por persona. Sin esto, un
       guion llena el muro en un rato y no queda nada que leer */
    const ultima = await env.DB.prepare(
      "SELECT creado FROM publicaciones WHERE autor = ? ORDER BY creado DESC LIMIT 1")
      .bind(yo.u).first();
    if (ultima && Date.now() - ultima.creado < 120000)
      return json({ error: "Esperá un par de minutos entre publicaciones." }, 429);

    /* si no puso enlace en la publicacion, se usa el de su perfil */
    let cobro = enlaceVale(c.cobro);
    if (!cobro) {
      const u = await env.DB.prepare("SELECT cobro FROM usuarios WHERE id = ?").bind(yo.u).first();
      cobro = (u && u.cobro) || "";
    }

    const r = await env.DB.prepare(
      "INSERT INTO publicaciones (autor, titulo, cuerpo, cobro, meta, creado) VALUES (?,?,?,?,?,?)")
      .bind(yo.u, titulo, cuerpo, cobro, limpio(c.meta, 60), Date.now()).run();
    return json({ id: r.meta.last_row_id });
  }

  /* ------------------------------------------------------------ apoyar */
  if (c.hacer === "apoyar") {
    const pub = parseInt(c.pub, 10);
    if (!pub) return json({ error: "publicación inválida" }, 400);
    /* OR IGNORE: apretar dos veces no suma dos. Lo garantiza el UNIQUE de la
       tabla, no el navegador */
    await env.DB.prepare(
      "INSERT OR IGNORE INTO apoyos (pub, quien, creado) VALUES (?,?,?)")
      .bind(pub, yo.u, Date.now()).run();
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM apoyos WHERE pub = ?")
      .bind(pub).first();
    return json({ apoyos: n.n });
  }

  /* ------------------------------------------------------------ borrar */
  if (c.hacer === "borrar") {
    const pub = parseInt(c.pub, 10);
    /* el `AND autor = ?` es la autorizacion: sin eso, mandando un numero
       cualquiera se borra la publicacion de otro */
    const r = await env.DB.prepare("DELETE FROM publicaciones WHERE id = ? AND autor = ?")
      .bind(pub, yo.u).run();
    if (!r.meta.changes) return json({ error: "No es tuya." }, 403);
    return json({ ok: true });
  }

  return json({ error: "no sé qué hacer" }, 400);
};
