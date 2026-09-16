/* La lista de la zona de donantes. Solo contesta con un pase valido.
 *
 * Los items salen de la variable ZONA_ITEMS (un JSON), no del codigo, para que
 * agregar el launcher cuando este listo sea pegar una linea en el panel de
 * Cloudflare y no un despliegue.
 *
 * ADVERTENCIA QUE VA EN EL CODIGO PARA QUE NO SE OLVIDE: si el `url` de un item
 * es un enlace publico (Drive, Mega, el propio sitio), el pase protege la LISTA,
 * no el archivo. El primero que entre puede pasar el enlace. Para que el archivo
 * tambien este atras del pase hay que servirlo desde R2 con un binding y
 * revisar el pase en cada descarga. Con un APK igual no hay candado que valga:
 * el que lo baja lo puede volver a subir. Vale la pena saberlo antes que
 * despues.
 */
import { leerPase } from "./_firma.js";

export const onRequestGet = async ({ request, env }) => {
  const pase = new URL(request.url).searchParams.get("pase");
  const ok = env.SECRETO && (await leerPase(env.SECRETO, pase));
  if (!ok)
    return new Response(JSON.stringify({ error: "sin acceso" }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });

  let items = [];
  try { items = JSON.parse(env.ZONA_ITEMS || "[]"); } catch {}

  return new Response(JSON.stringify({ via: ok.via, items }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
};
