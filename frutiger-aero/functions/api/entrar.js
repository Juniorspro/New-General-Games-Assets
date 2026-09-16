/* Entrar con Google.
 *
 * EL TOKEN SE COMPRUEBA DEL LADO DEL SERVIDOR. Un JWT es texto firmado, y
 * leerlo sin verificar la firma es leer lo que el que lo mando quiso escribir:
 * cualquiera se arma uno con el correo del vecino y entra como el. Aca se lo
 * damos a Google para que diga si es suyo, y ademas se comprueba `aud` —para
 * quien es—, que es el chequeo que casi siempre falta: un token valido de OTRA
 * aplicacion tambien esta firmado por Google.
 *
 * Lo que pasa despues —buscar la cuenta, pegarla, o pedir un nombre de usuario
 * si es la primera vez— es igual para Google y para Discord y esta en
 * `_puertas.js`, escrito una sola vez.
 */
import { iguales, darNumero, numeroVale } from "./_firma.js";
import { limpio, json } from "./_social.js";
import { abrirPuerta, terminarPuerta } from "./_puertas.js";

export const onRequestGet = async ({ env }) => {
  if (!env.SECRETO) return json({ error: "sin SECRETO" }, 503);
  return json({ numero: await darNumero(env.SECRETO, "g") });
};

/* le pregunta a Google si el token es suyo y si es para nosotros */
async function abrirToken(env, token, numero) {
  if (typeof token !== "string" || token.length > 4096) return { error: "falta el token" };

  /* Se le consulta a Google en vez de verificar la firma aca con sus claves
     publicas. Es un viaje de red mas por inicio de sesion, y a mucho volumen
     conviene lo otro; a esta escala, cambiarlo seria escribir un cache de
     claves para ahorrar 200 ms una vez por persona por dia. */
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" +
                        encodeURIComponent(token));
  if (!r.ok) return { error: "Google rechazó el token", codigo: 401 };
  const d = await r.json();

  if (d.aud !== env.GOOGLE_CLIENT_ID) return { error: "el token es de otra aplicación", codigo: 401 };
  if (d.iss !== "accounts.google.com" && d.iss !== "https://accounts.google.com")
    return { error: "emisor inesperado", codigo: 401 };
  if (Number(d.exp) * 1000 < Date.now()) return { error: "token vencido", codigo: 401 };
  if (!d.sub) return { error: "token sin cuenta", codigo: 401 };
  /* un correo sin confirmar no prueba nada: no se usa para nada que importe */
  if (d.email && d.email_verified !== "true" && d.email_verified !== true) d.email = "";

  /* el numero tiene que ser el que pidio ESTA pagina hace un rato, y tiene que
     venir adentro del token: si viniera solo al costado, cualquiera lo copia */
  if (!iguales(String(d.nonce || ""), String(numero || "")) ||
      !(await numeroVale(env.SECRETO, numero, "g")))
    return { error: "Se venció el inicio de sesión. Probá de nuevo.", codigo: 401 };

  return { puerta: "google", id: String(d.sub), correo: limpio(d.email, 120),
           nombre: limpio(d.name || d.given_name, 40) ||
                   limpio((d.email || "").split("@")[0], 40) || "Invitado",
           foto: /^https:\/\//.test(d.picture || "") ? d.picture : null };
}

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  if (c.hacer === "registrar" || c.hacer === "vincular") return terminarPuerta(env, c);

  if (!env.GOOGLE_CLIENT_ID)
    return json({ error: "Google no está configurado en este sitio." }, 503);

  const q = await abrirToken(env, c.credential, c.numero);
  if (q.error) return json({ error: q.error }, q.codigo || 400);

  const r = await abrirPuerta(env, request, q);
  return json(r, r.error ? (r.codigo || 400) : 200);
};
