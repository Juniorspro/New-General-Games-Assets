export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};
export const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
export const preflight = () => new Response(null, { headers: CORS });

const cod = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/* contraseña: PBKDF2-SHA256, 150 mil vueltas */
export async function derivar(clave, sal) {
  const k = await crypto.subtle.importKey("raw", cod.encode(clave), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: cod.encode(sal), iterations: 25000, hash: "SHA-256" }, k, 256);
  return hex(bits);
}
export const nuevaSal = () => hex(crypto.getRandomValues(new Uint8Array(16)));

/* comparación en tiempo constante */
export function iguales(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* sesión: usuario.vence.firma */
const b64u = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function firmar(msg, secreto) {
  const k = await crypto.subtle.importKey("raw", cod.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, cod.encode(msg)));
}
export async function emitirSesion(usuario, secreto, horas = 720) {
  const vence = Date.now() + horas * 3600e3;
  const cuerpo = b64u(usuario) + "." + vence;
  return cuerpo + "." + (await firmar(cuerpo, secreto));
}
export async function leerSesion(request, secreto) {
  const cab = request.headers.get("Authorization") || "";
  const t = cab.startsWith("Bearer ") ? cab.slice(7) : "";
  const p = t.split(".");
  if (p.length !== 3) return null;
  const cuerpo = p[0] + "." + p[1];
  if (!iguales(p[2], await firmar(cuerpo, secreto))) return null;
  if (Number(p[1]) < Date.now()) return null;
  try { return atob(p[0].replace(/-/g, "+").replace(/_/g, "/")); } catch { return null; }
}
export async function exigirSesion(request, env) {
  if (!env.SECRETO) return null;
  return await leerSesion(request, env.SECRETO);
}
