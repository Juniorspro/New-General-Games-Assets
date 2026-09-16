/* Quien esta mirando el sitio, y cuanto se queda.
 *
 * EL LATIDO. La pagina avisa cada tanto que sigue ahi, y solo mientras la
 * pestaña esta a la vista. Con eso alcanza para dos cosas que un contador de
 * visitas suelto no da: quien esta AHORA, y cuanto tiempo se queda cada uno.
 * Sin el latido, una pestaña abierta y olvidada contaria horas de "uso".
 *
 * NO SE GUARDA LA IP NI NADA QUE IDENTIFIQUE A UN DESCONOCIDO. El que entra sin
 * cuenta no tiene un "quien" que mostrar; lo unico honesto es contarlo. Lo que
 * identifica una visita es un numero al azar que vive en la pestaña y se muere
 * al cerrarla, asi que ni siquiera sirve para seguir a alguien entre dias.
 *
 * SE BORRA SOLO lo de mas de 30 dias. Una tabla que nadie limpia crece para
 * siempre, y guardar por las dudas el paso de gente de hace un anio no le sirve
 * a nadie y es justo lo que no hay que tener guardado.
 */
import { quienEs, json } from "./_social.js";

const VIVO = 90e3;              /* si no late en 90 s, ya no esta */
const GUARDAR = 30 * 86400e3;   /* lo mas viejo que se conserva */

/* ------------------------------------------------------------- el latido */
export const onRequestPost = async ({ request, env }) => {
  if (!env.DB) return json({ ok: true });

  let c;
  try { c = await request.json(); } catch { return json({ ok: true }); }

  /* el id lo hace la pestaña. Se recorta y se limpia igual: es lo unico que
     llega de afuera y va a la clave primaria */
  const id = String(c.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  if (id.length < 8) return json({ ok: true });

  const yo = await quienEs(env, request);
  const ahora = Date.now();
  const movil = c.movil ? 1 : 0;

  /* Un solo viaje a la base: si es la primera vez inserta, y si ya estaba
     mueve `ultimo` y suma una vista. El `usuario` se pisa siempre porque
     alguien puede entrar con su cuenta a mitad de la visita, y entonces la
     visita pasa a tener nombre desde ese momento. */
  await env.DB.prepare(
    "INSERT INTO visitas (id, usuario, inicio, ultimo, vistas, movil) " +
    "VALUES (?1, ?2, ?3, ?3, 1, ?4) " +
    "ON CONFLICT(id) DO UPDATE SET ultimo = ?3, vistas = vistas + 1, " +
    "  usuario = COALESCE(?2, usuario)")
    .bind(id, yo ? yo.u : null, ahora, movil).run();

  /* la limpieza va acá y no en una tarea aparte: no hay donde correr una tarea
     aparte, y una de cada cien visitas es suficiente para que no crezca */
  if (Math.random() < 0.01)
    await env.DB.prepare("DELETE FROM visitas WHERE ultimo < ?")
      .bind(ahora - GUARDAR).run();

  return json({ ok: true });
};

/* --------------------------------------------------------- el panel, para vos */
export const onRequestGet = async ({ request, env }) => {
  if (!env.DB) return json({ error: "sin base" }, 503);
  const yo = await quienEs(env, request);
  if (!yo) return json({ error: "sin sesión" }, 401);
  const u = await env.DB.prepare("SELECT jefe FROM usuarios WHERE id = ?").bind(yo.u).first();
  if (!u || !u.jefe) return json({ error: "No sos administrador." }, 403);

  const ahora = Date.now();
  const dia = ahora - 86400e3, semana = ahora - 7 * 86400e3;

  /* los que estan AHORA, con nombre si tienen cuenta */
  const { results: vivos } = await env.DB.prepare(
    "SELECT v.id, v.inicio, v.ultimo, v.vistas, v.movil, u.usuario, u.nombre " +
    "FROM visitas v LEFT JOIN usuarios u ON u.id = v.usuario " +
    "WHERE v.ultimo > ? ORDER BY v.inicio").bind(ahora - VIVO).all();

  const cuenta = async (desde) => (await env.DB.prepare(
    "SELECT COUNT(*) AS visitas, " +
    "       COUNT(DISTINCT usuario) AS conCuenta, " +
    "       SUM(ultimo - inicio) AS tiempo, " +
    "       SUM(vistas) AS latidos, " +
    "       SUM(movil) AS enCelu " +
    "FROM visitas WHERE ultimo > ?").bind(desde).first());

  /* los que tienen cuenta, cuando vinieron por ultima vez y cuanto se quedaron */
  const { results: gente } = await env.DB.prepare(
    "SELECT u.usuario, u.nombre, u.acceso, " +
    "       MAX(v.ultimo) AS ultima, COUNT(*) AS veces, " +
    "       SUM(v.ultimo - v.inicio) AS tiempo " +
    "FROM visitas v JOIN usuarios u ON u.id = v.usuario " +
    "WHERE v.ultimo > ? GROUP BY u.id ORDER BY ultima DESC LIMIT 30")
    .bind(semana).all();

  return json({
    ahora: vivos.map((v) => ({
      usuario: v.usuario || null, nombre: v.nombre || null,
      desde: v.inicio, movil: !!v.movil, vistas: v.vistas,
    })),
    hoy: await cuenta(dia),
    semana: await cuenta(semana),
    gente,
    /* para que la pantalla no invente precisión que el dato no tiene */
    nota: "Una fila por visita, no por persona. Sin cuenta no hay nombre que mostrar.",
  });
};
