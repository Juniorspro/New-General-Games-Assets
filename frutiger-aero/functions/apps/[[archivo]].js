/* La puerta de la tienda: los archivos de `/apps/` no se sirven a cualquiera.
 *
 * ESTO SI PROTEGE EL ARCHIVO, y no solo la lista. Una funcion de Pages corre
 * ANTES de que se sirva el archivo estatico que esta debajo, asi que se puede
 * mirar quien pide y recien despues dejar pasar con `context.next()`. Poner el
 * candado solo en la pantalla que muestra los enlaces protege la lista, no la
 * descarga: el primero que entra copia la direccion y la reparte.
 *
 * EL PASE VIAJA EN LA DIRECCION y no en una cabecera, porque esto se abre con
 * un enlace comun y un enlace no puede mandar cabeceras. Es un texto firmado y
 * con fecha, igual que el de las demas puertas.
 *
 * LO QUE ESTO NO ARREGLA, y hay que saberlo antes que despues: el que baja el
 * APK lo puede volver a subir a cualquier lado. No hay candado que lo impida,
 * ni aca ni en ninguna tienda. Esto evita que la direccion circule sola, no
 * que alguien decida compartir el archivo.
 */
import { leerPase } from "../api/_firma.js";

export const onRequest = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.SECRETO) return new Response("sin configurar", { status: 503 });

  const pase = url.searchParams.get("pase") || "";
  const d = pase && (await leerPase(env.SECRETO, pase));
  if (!d) {
    /* 403 y no 404: esconder que existe no lo protege mas, y deja al que tiene
       derecho a entrar sin entender por que no puede */
    return new Response("Esto es para los que colaboraron. Entrá con tu cuenta.",
      { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  /* el pase puede ser de la cuenta o de un codigo; si es de cuenta, ademas se
     comprueba que la cuenta siga teniendo acceso —lo pudo perder— */
  if (d.u && env.DB) {
    const u = await env.DB.prepare("SELECT acceso, jefe, bloqueado FROM usuarios WHERE id = ?")
      .bind(d.u).first();
    /* el jefe baja lo que el mismo publica sin haber donado: ver `aeromas.js` */
    if (!u || !(u.acceso || u.jefe) || u.bloqueado)
      return new Response("Esa cuenta ya no tiene acceso.",
        { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const r = await context.next();
  const con = new Response(r.body, r);
  con.headers.set("content-disposition",
    'attachment; filename="' + url.pathname.split("/").pop() + '"');
  con.headers.set("cache-control", "no-store");
  con.headers.set("x-robots-tag", "noindex");
  return con;
};
