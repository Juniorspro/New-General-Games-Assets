/* Entrar con una llave de acceso: sin contrasenia y sin depender de nadie.
 *
 * POR QUE ESTA PUERTA Y NO OTRA: entrar con Google exige una cuenta en su
 * consola para la nube, y esa pide mayoria de edad. Esto no le pide permiso a
 * nadie —ni a Google, ni a Discord, ni a un servicio de correo— porque no hay
 * tercero: la llave la guarda el aparato de cada uno y la comprobacion pasa
 * entera entre este sitio y ese aparato.
 *
 * LO QUE SE GUARDA ACA NO SIRVE PARA ENTRAR. Es la clave publica. Si alguien se
 * lleva esta base no se lleva con que hacerse pasar por nadie, que es
 * exactamente lo que si pasa con las contrasenias, por mejor guardadas que
 * esten: siempre queda algo contra lo que probar a la fuerza.
 *
 * NO SE PUEDE PESCAR. La firma lleva adentro de que sitio salio, asi que una
 * copia de esta pagina en otra direccion no puede usar las llaves de esta,
 * aunque la persona caiga y apoye el dedo. Eso una contrasenia no lo tiene.
 */
import { darNumero, numeroVale, darPase, leerPase } from "./_firma.js";
import { darSesion, quienEs, RE_USUARIO, RESERVADOS, limpio, json } from "./_social.js";
import { deB64u, aB64u, firmaVale, leerAuth, sitioVale, leerCliente } from "./_llave.js";

const VIVE = 5 * 60e3;    /* el reto dura cinco minutos: es apoyar un dedo */

/* el identificador que queda guardado junto a la llave en el aparato: al azar,
   y no el numero de fila, para no andar contandole a cada telefono cuantas
   cuentas tiene este sitio */
const handleNuevo = () => aB64u(crypto.getRandomValues(new Uint8Array(16)));

async function handleDe(env, u) {
  if (u.handle) return u.handle;
  const h = handleNuevo();
  await env.DB.prepare("UPDATE usuarios SET handle = ? WHERE id = ?").bind(h, u.id).run();
  return h;
}

const comoYo = (u) => ({ id: u.id, usuario: u.usuario, nombre: u.nombre,
                         retrato: u.retrato, sobre: u.sobre, cobro: u.cobro });

/* --------------------------------------------------------------- mis llaves */
export const onRequestGet = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);
  const yo = await quienEs(env, request);
  if (!yo) return json({ error: "sin sesión" }, 401);
  const { results } = await env.DB.prepare(
    "SELECT id, nombre, creado, usado FROM llaves WHERE usuario = ? ORDER BY creado")
    .bind(yo.u).all();
  return json({ llaves: results });
};

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  /* ------------------------------------------------------- pedir un reto
     Para entrar no hace falta decir quien sos: la llave sabe a que cuenta
     pertenece y el aparato muestra la lista. Por eso este paso no lleva
     usuario y no revela si alguien tiene cuenta aca o no. */
  if (c.hacer === "reto")
    return json({ reto: await darNumero(env.SECRETO, "l") });

  /* --------------------------------------------- empezar una llave nueva
     Dos casos: alguien que ya entro y suma un aparato, o alguien que se esta
     creando la cuenta. En el segundo caso la cuenta TODAVIA NO EXISTE: se
     aparta el nombre en un ticket firmado y se crea recien cuando la llave
     ya esta hecha, para no dejar cuentas huerfanas a las que nadie pueda
     entrar si la persona cancela el dialogo del navegador. */
  if (c.hacer === "empezar") {
    const yo = await quienEs(env, request);
    if (yo) {
      const u = await env.DB.prepare("SELECT * FROM usuarios WHERE id = ?").bind(yo.u).first();
      if (!u) return json({ error: "sin sesión" }, 401);
      const { results } = await env.DB.prepare(
        "SELECT cred FROM llaves WHERE usuario = ?").bind(u.id).all();
      return json({ reto: await darNumero(env.SECRETO, "l"),
                    handle: await handleDe(env, u), usuario: u.usuario, nombre: u.nombre,
                    /* las que ya tiene, para que el aparato no ofrezca repetir
                       una llave que ya esta puesta en esta misma cuenta */
                    tiene: results.map((r) => r.cred),
                    ticket: await darPase(env.SECRETO, { v: u.id }, VIVE / 86400e3) });
    }

    const usuario = String(c.usuario || "").toLowerCase().trim();
    if (!RE_USUARIO.test(usuario))
      return json({ error: "El usuario va en minúsculas, de 3 a 20, sin espacios." }, 400);
    if (RESERVADOS.has(usuario)) return json({ error: "Ese nombre está reservado." }, 400);
    const ya = await env.DB.prepare("SELECT id FROM usuarios WHERE usuario = ?")
      .bind(usuario).first();
    if (ya) return json({ error: "Ese usuario ya está tomado." }, 409);

    const handle = handleNuevo();
    return json({ reto: await darNumero(env.SECRETO, "l"), handle, usuario,
                  nombre: limpio(c.nombre, 40) || usuario, tiene: [],
                  ticket: await darPase(env.SECRETO,
                    { u: usuario, h: handle, m: limpio(c.nombre, 40) || usuario,
                      r: limpio(c.retrato, 60) || "m-saludando" }, VIVE / 86400e3) });
  }

  /* ------------------------------------------------------- guardar la llave */
  if (c.hacer === "guardar") {
    const t = await leerPase(env.SECRETO, String(c.ticket || ""));
    if (!t) return json({ error: "Se venció. Probá de nuevo." }, 401);

    const cli = leerCliente(deB64u(c.cliente), request, "webauthn.create");
    if (!cli) return json({ error: "La llave no es de este sitio." }, 400);
    if (!(await numeroVale(env.SECRETO, cli.reto, "l", VIVE)))
      return json({ error: "Se venció el pedido. Probá de nuevo." }, 401);

    const cred = String(c.cred || "");
    const alg = parseInt(c.alg, 10);
    if (!cred || cred.length > 400 || !c.clave)
      return json({ error: "llave incompleta" }, 400);
    if (alg !== -7 && alg !== -257)
      return json({ error: "Tu dispositivo usó un tipo de llave que no manejamos." }, 400);
    const repetida = await env.DB.prepare("SELECT id FROM llaves WHERE cred = ?")
      .bind(cred).first();
    if (repetida) return json({ error: "Esa llave ya está registrada." }, 409);

    let u;
    if (t.v) {                       /* suma un aparato a la cuenta que ya tiene */
      u = await env.DB.prepare("SELECT * FROM usuarios WHERE id = ?").bind(t.v).first();
      if (!u) return json({ error: "sin sesión" }, 401);
    } else {                         /* recien ahora se crea la cuenta */
      const otra = await env.DB.prepare("SELECT id FROM usuarios WHERE usuario = ?")
        .bind(t.u).first();
      if (otra) return json({ error: "Ese usuario ya está tomado." }, 409);
      /* la columna de la contrasenia lleva algo que `claveVale` NUNCA acepta:
         esta cuenta no se puede abrir escribiendo nada en el otro formulario */
      const r = await env.DB.prepare(
        "INSERT INTO usuarios (usuario, nombre, clave, retrato, handle, creado) " +
        "VALUES (?,?,?,?,?,?)")
        .bind(t.u, t.m, "llave-sin-clave", t.r, t.h, Date.now()).run();
      u = { id: r.meta.last_row_id, usuario: t.u, nombre: t.m, retrato: t.r,
            sobre: "", cobro: "" };
    }

    await env.DB.prepare(
      "INSERT INTO llaves (usuario, cred, clave, alg, contador, nombre, creado) " +
      "VALUES (?,?,?,?,?,?,?)")
      .bind(u.id, cred, String(c.clave).slice(0, 1000), alg,
            parseInt(c.contador, 10) || 0, limpio(c.nombre, 40) || "Este dispositivo",
            Date.now()).run();

    return json({ pase: await darSesion(env.SECRETO, u.id, u.usuario), yo: comoYo(u) });
  }

  /* -------------------------------------------------------------- entrar */
  if (c.hacer === "entrar") {
    const auth = deB64u(c.auth);
    const cliBytes = deB64u(c.cliente);
    const cli = leerCliente(cliBytes, request, "webauthn.get");
    if (!cli) return json({ error: "La firma no es de este sitio." }, 400);
    if (!(await numeroVale(env.SECRETO, cli.reto, "l", VIVE)))
      return json({ error: "Se venció el pedido. Probá de nuevo." }, 401);
    if (!(await sitioVale(request, auth))) return json({ error: "otro sitio" }, 400);

    const a = leerAuth(auth);
    if (!a.presente) return json({ error: "Nadie tocó el dispositivo." }, 400);

    const k = await env.DB.prepare("SELECT * FROM llaves WHERE cred = ?")
      .bind(String(c.cred || "")).first();
    if (!k) return json({ error: "Esa llave no está registrada acá." }, 404);

    if (!(await firmaVale(k.clave, k.alg, auth, cliBytes, deB64u(c.firma))))
      return json({ error: "La firma no da." }, 401);

    /* El contador solo sube. Si vuelve mas bajo que la ultima vez, o la llave
       fue clonada o algo se copio: no se deja entrar. Los aparatos que no
       llevan la cuenta mandan siempre cero, y a esos no se les puede exigir. */
    if (a.contador && k.contador && a.contador <= k.contador)
      return json({ error: "Esa llave está duplicada. Borrala y hacé una nueva." }, 401);

    const u = await env.DB.prepare("SELECT * FROM usuarios WHERE id = ?")
      .bind(k.usuario).first();
    if (!u) return json({ error: "La cuenta ya no existe." }, 404);
    if (u.bloqueado) return json({ error: "Esta cuenta está suspendida." }, 403);

    await env.DB.prepare("UPDATE llaves SET contador = ?, usado = ? WHERE id = ?")
      .bind(a.contador, Date.now(), k.id).run();

    return json({ pase: await darSesion(env.SECRETO, u.id, u.usuario), yo: comoYo(u) });
  }

  /* -------------------------------------------------------------- borrar
     Se puede quedar sin ninguna: entonces vuelve a entrar por donde entro la
     primera vez. Lo que NO se puede es borrar la unica forma de entrar sin
     avisar, asi que si no tiene contrasenia ni Google ni Discord, se le dice. */
  if (c.hacer === "borrar") {
    const yo = await quienEs(env, request);
    if (!yo) return json({ error: "sin sesión" }, 401);
    const u = await env.DB.prepare("SELECT * FROM usuarios WHERE id = ?").bind(yo.u).first();
    const n = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM llaves WHERE usuario = ?").bind(yo.u).first();
    const otraPuerta = (u.clave || "").startsWith("pbkdf2$") || u.google || u.discord;
    if (n.n <= 1 && !otraPuerta && !c.seguro)
      return json({ error: "Es tu única forma de entrar. Poné antes una contraseña, " +
                           "o agregá otro dispositivo.", avisar: true }, 409);
    await env.DB.prepare("DELETE FROM llaves WHERE id = ? AND usuario = ?")
      .bind(parseInt(c.id, 10), yo.u).run();
    return json({ ok: true });
  }

  return json({ error: "no sé qué hacer" }, 400);
};
