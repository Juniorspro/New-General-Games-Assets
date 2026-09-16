/* Crear cuenta, entrar, y saber quien soy.
 *
 * El nombre de usuario se guarda en minusculas y es la direccion del perfil.
 * Se comprueba contra una lista de reservados: un perfil llamado «admin»
 * pidiendo plata es la estafa mas vieja que existe, y sale gratis prevenirla.
 *
 * AL FALLAR NO SE DICE QUE FALLO. «Usuario o contrasenia incorrectos», nunca
 * «ese usuario no existe»: lo segundo deja averiguar quien tiene cuenta aca
 * probando nombres, que es informacion de la gente que no es nuestra para dar.
 */
import { darPase } from "./_firma.js";
import { guardarClave, claveVale, darSesion, quienEs,
         RE_USUARIO, RESERVADOS, limpio, enlaceVale, json } from "./_social.js";

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  if (!env.SECRETO) return json({ error: "sin SECRETO" }, 503);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  const usuario = String(c.usuario || "").toLowerCase().trim();
  const clave = String(c.clave || "");

  /* ------------------------------------------------------------- crear */
  if (c.hacer === "crear") {
    if (!RE_USUARIO.test(usuario))
      return json({ error: "El usuario va en minúsculas, de 3 a 20, sin espacios." }, 400);
    if (RESERVADOS.has(usuario))
      return json({ error: "Ese nombre está reservado." }, 400);
    if (clave.length < 8)
      return json({ error: "La contraseña necesita 8 caracteres o más." }, 400);

    const nombre = limpio(c.nombre, 40) || usuario;
    const ya = await env.DB.prepare("SELECT id FROM usuarios WHERE usuario = ?")
      .bind(usuario).first();
    if (ya) return json({ error: "Ese usuario ya está tomado." }, 409);

    const r = await env.DB.prepare(
      "INSERT INTO usuarios (usuario, nombre, clave, retrato, creado) VALUES (?,?,?,?,?)")
      .bind(usuario, nombre, await guardarClave(clave),
            limpio(c.retrato, 60) || "m-saludando", Date.now()).run();

    const id = r.meta.last_row_id;
    return json({ pase: await darSesion(env.SECRETO, id, usuario),
                  yo: { id, usuario, nombre, retrato: limpio(c.retrato, 60) || "m-saludando" } });
  }

  /* ------------------------------------------------------------- entrar */
  if (c.hacer === "entrar") {
    const u = await env.DB.prepare("SELECT * FROM usuarios WHERE usuario = ?")
      .bind(usuario).first();
    /* se comprueba la clave IGUAL si no existe el usuario, contra un hash
       inventado: si no, la respuesta vuelve mucho mas rapido cuando el usuario
       no existe y eso mismo delata quien tiene cuenta */
    const guardada = u ? u.clave : "pbkdf2$100000$" + "00".repeat(16) + "$" + "00".repeat(32);
    const bien = await claveVale(clave, guardada);
    if (!u || !bien) return json({ error: "Usuario o contraseña incorrectos." }, 403);
    if (u.bloqueado) return json({ error: "Esta cuenta está suspendida." }, 403);

    return json({ pase: await darSesion(env.SECRETO, u.id, u.usuario),
                  yo: { id: u.id, usuario: u.usuario, nombre: u.nombre,
                        retrato: u.retrato, sobre: u.sobre, cobro: u.cobro } });
  }

  /* -------------------------------------------------------- editar perfil */
  if (c.hacer === "editar") {
    const yo = await quienEs(env, request);
    if (!yo) return json({ error: "sin sesión" }, 401);
    await env.DB.prepare(
      "UPDATE usuarios SET nombre = ?, sobre = ?, cobro = ?, retrato = ? WHERE id = ?")
      .bind(limpio(c.nombre, 40) || yo.n, limpio(c.sobre, 300),
            enlaceVale(c.cobro), limpio(c.retrato, 60) || "m-saludando", yo.u).run();
    return json({ ok: true });
  }

  return json({ error: "no sé qué hacer" }, 400);
};

/* quien soy, para cuando se recarga la pagina con un pase guardado */
export const onRequestGet = async ({ request, env }) => {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const yo = await quienEs(env, request);
  if (!yo) return json({ error: "sin sesión" }, 401);
  const u = await env.DB.prepare(
    "SELECT id, usuario, nombre, retrato, sobre, cobro, bloqueado, acceso FROM usuarios WHERE id = ?")
    .bind(yo.u).first();
  if (!u || u.bloqueado) return json({ error: "sin sesión" }, 401);

  /* si ya pago alguna vez, el pase viaja con la cuenta: entrar desde otro
     telefono no lo obliga a pagar de nuevo, que es lo que pasaria si el acceso
     viviera solo en el navegador donde pago */
  const extra = u.acceso && env.SECRETO
    ? { pase: await darPase(env.SECRETO, { via: "cuenta", u: u.id }) } : {};
  return json({ yo: u, ...extra });
};
