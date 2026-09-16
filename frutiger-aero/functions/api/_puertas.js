/* Lo que comparten las puertas de afuera: Google y Discord.
 *
 * Las dos hacen lo mismo una vez que el de afuera dijo quien es: buscar la
 * cuenta, o pegarsela a la que ya tiene abierta, o —si es la primera vez—
 * pedirle que elija su nombre de usuario. Escribir eso dos veces es garantizar
 * que un dia se arreglen distinto y una de las dos quede con el agujero.
 *
 * SE GUARDA EL NUMERO DE LA CUENTA, NUNCA EL CORREO NI EL NOMBRE. El correo de
 * Google se puede cambiar, el nombre de Discord tambien, y una direccion de
 * escuela o de trabajo se le reasigna a otra persona cuando el primero se va.
 * Atar el perfil a algo que cambia es dejar que el que herede ese algo herede
 * el perfil, las publicaciones y el acceso pagado.
 */
import { darPase, leerPase } from "./_firma.js";
import { darSesion, quienEs, claveVale,
         RE_USUARIO, RESERVADOS, limpio, json } from "./_social.js";

export const TICKET_VIVE = 15 * 60e3;

const COLUMNA = { google: "google", discord: "discord" };
const COMO_SE_LLAMA = { google: "Google", discord: "Discord" };

export const comoYo = (u) => ({ id: u.id, usuario: u.usuario, nombre: u.nombre,
                                retrato: u.retrato, sobre: u.sobre, cobro: u.cobro });

/* lo que se guarda del que ya se identifico pero todavia no eligio usuario */
export const darTicket = (secreto, q) =>
  darPase(secreto, { p: q.puerta, i: q.id, c: q.correo || "", m: q.nombre || "" },
          TICKET_VIVE / 86400e3);

/* «tomas.perez@gmail.com» -> «tomasperez», libre. Es una sugerencia nomas: se
   borra y se pone cualquier otra cosa. Derivarlo a la fuerza publicaria medio
   correo de cada uno como direccion del perfil. */
export async function sugerir(env, q) {
  let base = ((q.correo || "").split("@")[0] || q.nombre || "")
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "").slice(0, 14);
  if (base.length < 3) base = "aero" + base;
  for (let i = 0; i < 12; i++) {
    const n = i ? base + i : base;
    if (RESERVADOS.has(n) || !RE_USUARIO.test(n)) continue;
    const ya = await env.DB.prepare("SELECT id FROM usuarios WHERE usuario = ?").bind(n).first();
    if (!ya) return n;
  }
  return "";
}

/* --------------------------------------------------------------------------
   Ya sabemos quien es del otro lado. Hay tres finales posibles. */
export async function abrirPuerta(env, request, q) {
  const col = COLUMNA[q.puerta];
  const u = await env.DB.prepare(`SELECT * FROM usuarios WHERE ${col} = ?`).bind(q.id).first();

  if (u) {
    if (u.bloqueado) return { error: "Esta cuenta está suspendida.", codigo: 403 };
    if (q.correo && q.correo !== u.correo)
      await env.DB.prepare("UPDATE usuarios SET correo = ? WHERE id = ?")
        .bind(q.correo, u.id).run();
    return { pase: await darSesion(env.SECRETO, u.id, u.usuario), yo: comoYo(u), foto: q.foto };
  }

  /* ya esta adentro con su cuenta y usa la otra puerta: se pegan, sin preguntar */
  const yo = await quienEs(env, request);
  if (yo) {
    const mia = await env.DB.prepare("SELECT * FROM usuarios WHERE id = ?").bind(yo.u).first();
    if (mia && !mia[col]) {
      await env.DB.prepare(`UPDATE usuarios SET ${col} = ?, correo = ? WHERE id = ?`)
        .bind(q.id, q.correo || mia.correo || "", mia.id).run();
      return { pase: await darSesion(env.SECRETO, mia.id, mia.usuario),
               yo: comoYo(mia), foto: q.foto, pegada: true };
    }
  }

  return { nuevo: true, puerta: q.puerta, ticket: await darTicket(env.SECRETO, q),
           sugerido: await sugerir(env, q), nombre: q.nombre, correo: q.correo, foto: q.foto };
}

/* --------------------------------------------------------------------------
   El segundo paso: eligio su nombre de usuario, o dijo que ya tenia cuenta. */
export async function terminarPuerta(env, c) {
  const t = await leerPase(env.SECRETO, String(c.ticket || ""));
  if (!t || !t.i || !COLUMNA[t.p])
    return json({ error: "Se venció el registro. Volvé a empezar." }, 401);
  const col = COLUMNA[t.p];

  const tomada = await env.DB.prepare(`SELECT id FROM usuarios WHERE ${col} = ?`)
    .bind(t.i).first();
  if (tomada) return json({ error: `Esa cuenta de ${COMO_SE_LLAMA[t.p]} ya está en uso.` }, 409);

  /* «ya tengo cuenta aca»: se pega la puerta nueva a la que existe, pero recien
     despues de la contrasenia. Si alcanzara con decir el nombre de usuario,
     esto seria una forma de meterse en la cuenta de cualquiera. */
  if (c.hacer === "vincular") {
    const usuario = String(c.usuario || "").toLowerCase().trim();
    const u = await env.DB.prepare("SELECT * FROM usuarios WHERE usuario = ?")
      .bind(usuario).first();
    const guardada = u ? u.clave : "pbkdf2$100000$" + "00".repeat(16) + "$" + "00".repeat(32);
    const bien = await claveVale(String(c.clave || ""), guardada);
    if (!u || !bien) return json({ error: "Usuario o contraseña incorrectos." }, 403);
    if (u.bloqueado) return json({ error: "Esta cuenta está suspendida." }, 403);
    if (u[col]) return json({ error: `Esa cuenta ya tiene otro ${COMO_SE_LLAMA[t.p]} pegado.` }, 409);

    await env.DB.prepare(`UPDATE usuarios SET ${col} = ?, correo = ? WHERE id = ?`)
      .bind(t.i, t.c || u.correo || "", u.id).run();
    return json({ pase: await darSesion(env.SECRETO, u.id, u.usuario), yo: comoYo(u) });
  }

  const usuario = String(c.usuario || "").toLowerCase().trim();
  if (!RE_USUARIO.test(usuario))
    return json({ error: "El usuario va en minúsculas, de 3 a 20, sin espacios." }, 400);
  if (RESERVADOS.has(usuario)) return json({ error: "Ese nombre está reservado." }, 400);
  const ya = await env.DB.prepare("SELECT id FROM usuarios WHERE usuario = ?")
    .bind(usuario).first();
  if (ya) return json({ error: "Ese usuario ya está tomado." }, 409);

  /* en la columna de la contrasenia va algo que `claveVale` NUNCA acepta: esta
     cuenta no se puede abrir escribiendo nada en el formulario de siempre */
  const nombre = limpio(c.nombre, 40) || t.m || usuario;
  const retrato = limpio(c.retrato, 60) || "m-saludando";
  const r = await env.DB.prepare(
    `INSERT INTO usuarios (usuario, nombre, clave, retrato, correo, ${col}, creado) ` +
    "VALUES (?,?,?,?,?,?,?)")
    .bind(usuario, nombre, "sin-clave-" + t.p, retrato, t.c || "", t.i, Date.now()).run();

  const id = r.meta.last_row_id;
  return json({ pase: await darSesion(env.SECRETO, id, usuario),
                yo: { id, usuario, nombre, retrato } });
}
