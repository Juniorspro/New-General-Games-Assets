/* Entrar con Discord.
 *
 * POR QUE DISCORD Y NO SOLO GOOGLE: para tener un identificador de cliente de
 * Google hay que abrir una cuenta en su consola para la nube, y esa pide
 * mayoria de edad. El portal de desarrolladores de Discord se abre desde los 13
 * con la misma cuenta de siempre. Es la puerta que de verdad esta al alcance
 * del que hizo este sitio, y ademas es donde ya esta la gente a la que le gusta
 * esto.
 *
 * ESTO NO ES EL BOTON DE GOOGLE. Aca no llega un token firmado que se pueda
 * comprobar en el momento: llega un CODIGO de un solo uso que hay que
 * cambiarle a Discord por un permiso, y recien con ese permiso se le pregunta
 * quien es. Ese cambio pasa entre servidores y lleva el secreto de la
 * aplicacion, que por eso NO puede estar en el navegador.
 *
 * EL `state` NO ES DECORACION. Sin el, cualquier pagina puede mandar a alguien
 * a la vuelta de este circuito con un codigo suyo y dejarlo con la sesion de
 * otro sin que se de cuenta. Va firmado por este servidor y con fecha.
 */
import { darNumero, numeroVale } from "./_firma.js";
import { limpio, json } from "./_social.js";
import { abrirPuerta } from "./_puertas.js";

const AUTORIZA = "https://discord.com/oauth2/authorize";
const TOKEN = "https://discord.com/api/oauth2/token";
const YO = "https://discord.com/api/users/@me";

const vuelta = (url) => new URL("/api/discord", url).href;

/* La respuesta vuelve por una direccion del navegador, asi que el pase viaja en
   el pedacito de despues del `#`. Eso NO se manda a ningun servidor —ni al
   nuestro, ni al de en medio— y la pagina lo borra apenas lo lee. En la parte
   de antes del `?` quedaria escrito en los registros de todo el camino. */
const irA = (url, trozo) =>
  new Response(null, { status: 302, headers: { location: new URL("/" + trozo, url).href,
                                               "cache-control": "no-store" } });

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_SECRET)
    return json({ error: "Discord no está configurado en este sitio." }, 503);

  /* Primero lo que vuelve MAL. Si esto se preguntara despues de «no hay
     codigo», el que aprieta «cancelar» en Discord volveria sin codigo y lo
     mandariamos de nuevo a Discord: una calesita de la que no se baja. */
  if (url.searchParams.get("error"))
    return irA(url, "#mal=" + encodeURIComponent("Cancelaste el permiso en Discord."));

  /* ------------------------------------------------------------- de ida */
  const codigo = url.searchParams.get("code");
  if (!codigo) {
    const d = new URL(AUTORIZA);
    d.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
    d.searchParams.set("response_type", "code");
    d.searchParams.set("redirect_uri", vuelta(url));
    d.searchParams.set("scope", "identify");     /* el nombre y nada mas */
    d.searchParams.set("state", await darNumero(env.SECRETO, "d"));
    return new Response(null, { status: 302,
      headers: { location: d.href, "cache-control": "no-store" } });
  }

  /* ---------------------------------------------------------- de vuelta */
  if (!(await numeroVale(env.SECRETO, url.searchParams.get("state"), "d")))
    return irA(url, "#mal=" + encodeURIComponent("Se venció el inicio de sesión. Probá de nuevo."));

  const t = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded",
               authorization: "Basic " + btoa(env.DISCORD_CLIENT_ID + ":" + env.DISCORD_SECRET) },
    body: new URLSearchParams({ grant_type: "authorization_code",
                                code: codigo, redirect_uri: vuelta(url) }),
  });
  if (!t.ok) return irA(url, "#mal=" + encodeURIComponent("Discord no aceptó el código."));
  const permiso = await t.json();

  const r = await fetch(YO, { headers: { authorization: "Bearer " + permiso.access_token } });
  if (!r.ok) return irA(url, "#mal=" + encodeURIComponent("Discord no quiso decir quién sos."));
  const d = await r.json();
  if (!d.id) return irA(url, "#mal=" + encodeURIComponent("Discord no devolvió una cuenta."));

  const res = await abrirPuerta(env, request, {
    puerta: "discord", id: String(d.id),
    /* el correo solo si esta confirmado, y solo para mostrarlo */
    correo: d.verified && d.email ? limpio(d.email, 120) : "",
    nombre: limpio(d.global_name || d.username, 40) || "Invitado",
    foto: d.avatar
      ? "https://cdn.discordapp.com/avatars/" + d.id + "/" + d.avatar + ".png?size=128"
      : null,
  });

  if (res.error) return irA(url, "#mal=" + encodeURIComponent(res.error));
  if (res.nuevo) return irA(url, "#nuevo=" + encodeURIComponent(JSON.stringify({
    puerta: "discord", ticket: res.ticket, sugerido: res.sugerido,
    nombre: res.nombre, correo: res.correo, foto: res.foto })));
  return irA(url, "#entra=" + encodeURIComponent(JSON.stringify({
    pase: res.pase, yo: res.yo, foto: res.foto })));
};
