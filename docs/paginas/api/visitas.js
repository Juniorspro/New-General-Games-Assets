/* Quien esta mirando la web, y cuanto se queda. Para el panel del dueño.
 *
 * EL LATIDO. La pagina avisa cada tanto que sigue ahi, y SOLO mientras la
 * pestaña esta a la vista. Con eso alcanza para dos cosas que un contador de
 * visitas suelto no da: cuanta gente hay AHORA, y cuanto tiempo se queda. Sin
 * el latido, una pestaña abierta y olvidada contaria horas de "uso" y el numero
 * no diria nada.
 *
 * NO SE GUARDA LA IP NI NADA QUE IDENTIFIQUE A NADIE. Aca no hay cuentas: todo
 * el que entra es un desconocido y no hay ningun "quien" que mostrar. Lo que
 * identifica una visita es un numero al azar que vive en la pestaña y se muere
 * al cerrarla, asi que ni siquiera sirve para reconocer a alguien mañana.
 *
 * SI SE GUARDA DE DONDE VINO Y QUE PAGINA MIRA, porque eso no dice quien es
 * nadie y es lo unico de todo esto que sirve para decidir algo: si la gente
 * llega de Instagram, si miran el archivo o las entradas, a que hora entran.
 */
import { json, preflight, exigirSesion } from "./_comun.js";
export const onRequestOptions = preflight;

const VIVO = 90e3;
const GUARDAR = 60 * 86400e3;   /* dos meses: sirve para comparar una fiesta con la anterior */

/* De donde vino, en limpio. Se guarda el DOMINIO y no la direccion entera: el
   dominio dice «vino de Instagram», que es lo util, y la direccion entera puede
   llevar pegado lo que la persona estaba buscando. */
function deDonde(u) {
  if (!u) return "";
  try {
    const h = new URL(u).hostname.replace(/^www\./, "").toLowerCase();
    if (h.endsWith("iblo-eventos.pages.dev")) return "";     /* de la misma web */
    if (h.includes("instagram")) return "Instagram";
    if (h.includes("facebook") || h === "l.facebook.com") return "Facebook";
    if (h.includes("whatsapp")) return "WhatsApp";
    if (h.includes("google")) return "Google";
    if (h.includes("bing")) return "Bing";
    if (h.includes("tiktok")) return "TikTok";
    if (h.includes("t.co") || h.includes("twitter") || h.includes("x.com")) return "X";
    return h.slice(0, 40);
  } catch { return ""; }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: true });

  let c;
  try { c = await request.json(); } catch { return json({ ok: true }); }

  const id = String(c.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  if (id.length < 8) return json({ ok: true });

  const ahora = Date.now();
  const pagina = String(c.pagina || "").replace(/[^A-Za-z0-9/_-]/g, "").slice(0, 40);
  const vino = deDonde(c.vino);

  /* Un solo viaje: si es nueva inserta, y si ya estaba mueve `ultimo`, suma una
     vista y anota en que pagina esta. `vino` NO se pisa: lo que importa es por
     donde llego, no por donde anduvo despues. */
  await env.DB.prepare(
    "INSERT INTO visitas (id, inicio, ultimo, vistas, movil, pagina, vino) " +
    "VALUES (?1, ?2, ?2, 1, ?3, ?4, ?5) " +
    "ON CONFLICT(id) DO UPDATE SET ultimo = ?2, vistas = vistas + 1, pagina = ?4")
    .bind(id, ahora, c.movil ? 1 : 0, pagina, vino).run();

  /* la limpieza va aca porque no hay donde correr una tarea aparte, y una de
     cada cien visitas alcanza para que la tabla no crezca para siempre */
  if (Math.random() < 0.01)
    await env.DB.prepare("DELETE FROM visitas WHERE ultimo < ?")
      .bind(ahora - GUARDAR).run();

  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "sin base" }, 503);
  const usuario = await exigirSesion(request, env);
  if (!usuario) return json({ error: "Volvé a iniciar sesión." }, 401);

  const ahora = Date.now();
  const dia = ahora - 86400e3, semana = ahora - 7 * 86400e3;

  const { results: vivos } = await env.DB.prepare(
    "SELECT inicio, ultimo, vistas, movil, pagina, vino FROM visitas " +
    "WHERE ultimo > ? ORDER BY inicio").bind(ahora - VIVO).all();

  const cuenta = async (desde) => (await env.DB.prepare(
    "SELECT COUNT(*) AS visitas, SUM(ultimo - inicio) AS tiempo, " +
    "       SUM(movil) AS enCelu FROM visitas WHERE ultimo > ?").bind(desde).first());

  const { results: paginas } = await env.DB.prepare(
    "SELECT pagina, COUNT(*) AS n FROM visitas WHERE ultimo > ? AND pagina <> '' " +
    "GROUP BY pagina ORDER BY n DESC LIMIT 8").bind(semana).all();

  const { results: vienen } = await env.DB.prepare(
    "SELECT vino, COUNT(*) AS n FROM visitas WHERE ultimo > ? AND vino <> '' " +
    "GROUP BY vino ORDER BY n DESC LIMIT 8").bind(semana).all();

  /* por dia, para ver si una fiesta movio la aguja */
  const { results: dias } = await env.DB.prepare(
    "SELECT date(inicio / 1000, 'unixepoch', 'localtime') AS dia, COUNT(*) AS n " +
    "FROM visitas WHERE inicio > ? GROUP BY dia ORDER BY dia").bind(semana).all();

  return json({
    ahora: vivos.map((v) => ({ desde: v.inicio, movil: !!v.movil,
                               pagina: v.pagina, vino: v.vino, vistas: v.vistas })),
    hoy: await cuenta(dia),
    semana: await cuenta(semana),
    paginas, vienen, dias,
    nota: "Una fila por visita, no por persona. No se guarda ninguna IP.",
  });
}
