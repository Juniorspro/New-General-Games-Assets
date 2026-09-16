/* Piezas compartidas de lo social: contrasenias, sesion y validacion.
 *
 * LA CONTRASENIA NO SE GUARDA NUNCA. Se guarda el resultado de pasarla 100.000
 * veces por PBKDF2 con una sal distinta por persona. Si alguien se lleva la
 * base, no se lleva contrasenias: se lleva ruido carisimo de revertir. Un hash
 * simple (md5, sha256 pelado) no sirve: una placa de video prueba miles de
 * millones por segundo. Lo que hace segura a PBKDF2 es que es LENTA a proposito.
 */
import { firmar, iguales, darPase, leerPase } from "./_firma.js";

const cod = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const VUELTAS = 100000;

export async function guardarClave(clave) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const k = await crypto.subtle.importKey("raw", cod.encode(clave), "PBKDF2", false, ["deriveBits"]);
  const b = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: VUELTAS, hash: "SHA-256" }, k, 256);
  return "pbkdf2$" + VUELTAS + "$" + hex(sal) + "$" + hex(b);
}

export async function claveVale(clave, guardada) {
  const p = String(guardada || "").split("$");
  if (p.length !== 4 || p[0] !== "pbkdf2") return false;
  const vueltas = parseInt(p[1], 10);
  const sal = new Uint8Array(p[2].match(/../g).map((h) => parseInt(h, 16)));
  const k = await crypto.subtle.importKey("raw", cod.encode(clave), "PBKDF2", false, ["deriveBits"]);
  const b = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: vueltas, hash: "SHA-256" }, k, 256);
  return iguales(hex(b), p[3]);
}

/* --- la sesion: el mismo pase firmado que ya usa el acceso anticipado --- */
export const darSesion = (secreto, id, usuario) =>
  darPase(secreto, { u: id, n: usuario }, 90);

export async function quienEs(env, request) {
  if (!env.SECRETO) return null;
  const cab = request.headers.get("authorization") || "";
  const pase = cab.startsWith("Bearer ") ? cab.slice(7) : null;
  const d = pase && (await leerPase(env.SECRETO, pase));
  return d && d.u ? d : null;
}

/* --- validacion --- */
export const RE_USUARIO = /^[a-z0-9](?:[a-z0-9_.]{1,18}[a-z0-9])$/;

/* Nombres que no puede tomar cualquiera: son rutas del sitio o dan a entender
   que quien los usa es el que manda. Un perfil «admin» pidiendo plata es la
   estafa mas vieja que hay. */
export const RESERVADOS = new Set([
  "admin", "administrador", "api", "zona", "soporte", "ayuda", "staff", "oficial",
  "frutiger", "frutigeraero", "moderador", "mod", "root", "sistema", "null",
]);

export const limpio = (t, max) => String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, max);

/* Solo se aceptan enlaces de cobro http(s). Sin esto entra `javascript:` en el
   perfil de cualquiera y se convierte en un agujero para todos los que miren. */
export function enlaceVale(u) {
  if (!u) return "";
  try {
    const x = new URL(String(u).trim());
    return (x.protocol === "http:" || x.protocol === "https:") ? x.href.slice(0, 300) : "";
  } catch { return ""; }
}

export const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export { firmar, iguales };
