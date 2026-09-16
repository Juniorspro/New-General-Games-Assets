/* La verificacion de Google Search Console, servida por una funcion.
 *
 * POR QUE NO ALCANZA CON DEJAR EL ARCHIVO: Cloudflare Pages le saca el `.html`
 * a cualquier archivo y contesta 308 hacia la version sin extension. Google
 * pide que el archivo de verificacion NO redirija, y una regla de reescritura
 * en `_redirects` tampoco gana: el recorte de la extension pasa antes.
 *
 * Las funciones SI corren antes que el servicio de archivos, asi que esta ruta
 * contesta 200 en la direccion exacta, que es lo unico que Google mira. El
 * nombre del archivo es la ruta: `google....html.js` sirve `/google....html`.
 */
export const onRequestGet = () =>
  new Response("google-site-verification: google68e443a4715e78cb.html", {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
