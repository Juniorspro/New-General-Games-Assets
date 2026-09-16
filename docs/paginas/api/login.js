import { json, preflight, derivar, iguales, emitirSesion } from "./_comun.js";
export const onRequestOptions = preflight;

const VENTANA = 15 * 60e3;   // 15 minutos
const TOPE_IP = 8;           // fallos desde una misma IP
const TOPE_USUARIO = 25;     // fallos contra el mismo usuario, venga de donde venga

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.SECRETO) return json({ error: "sin base de datos" }, 503);

  const ip = request.headers.get("CF-Connecting-IP") || "desconocida";
  const desde = Date.now() - VENTANA;

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  const usuario = String(b.usuario || "").trim().toLowerCase();
  const clave = String(b.clave || "");

  const frenado = await env.DB.prepare(
    "SELECT SUM(ip = ?) AS porIp, SUM(quien = ?) AS porUsuario FROM intentos WHERE cuando > ?"
  ).bind(ip, usuario, desde).first();
  if ((frenado?.porIp || 0) >= TOPE_IP || (frenado?.porUsuario || 0) >= TOPE_USUARIO)
    return json({ error: "Demasiados intentos fallidos. Esperá 15 minutos y probá de nuevo." }, 429);

  const u = await env.DB.prepare("SELECT usuario, hash, sal FROM usuarios WHERE usuario = ?")
    .bind(usuario).first();

  async function rechazar() {
    await env.DB.prepare("INSERT INTO intentos (ip, quien, cuando) VALUES (?,?,?)")
      .bind(ip, usuario, Date.now()).run();
    return json({ error: "Usuario o contraseña incorrectos." }, 401);
  }
  // si el usuario no existe igual derivamos, para que tarde lo mismo y no se pueda adivinar
  if (!u) { await derivar(clave, "sal-falsa-para-tardar-lo-mismo"); return rechazar(); }
  if (!iguales(await derivar(clave, u.sal), u.hash)) return rechazar();

  // entró bien: se limpia el historial de esa IP y de paso lo viejo de todos
  await env.DB.batch([
    env.DB.prepare("DELETE FROM intentos WHERE ip = ? OR quien = ?").bind(ip, usuario),
    env.DB.prepare("DELETE FROM intentos WHERE cuando < ?").bind(Date.now() - 24 * 3600e3),
  ]);
  return json({ usuario: u.usuario, sesion: await emitirSesion(u.usuario, env.SECRETO) });
}
