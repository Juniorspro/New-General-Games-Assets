/* «Bajala, pero no la indexes».
 *
 * `robots.txt` permite las direcciones de lectura de la API, y tiene que
 * permitirlas: las páginas arman su contenido pidiéndoles los datos, y un
 * buscador que no las puede bajar renderiza la página vacía. Pero permitir que
 * las baje no es querer que salgan en los resultados: lo que hay ahí es JSON
 * crudo, y «iblo-eventos.pages.dev/api/publicaciones» apareciendo en Google
 * como si fuera una página del sitio es basura para el que la encuentra.
 *
 * VA ACÁ Y NO EN `_headers` PORQUE `_headers` NO LAS TOCA. Ese archivo sólo
 * manda sobre los archivos estáticos; todo lo que sale de una función se va sin
 * mirarlo. La regla estaba puesta ahí y no hacía absolutamente nada —el header
 * no llegaba— que es la peor clase de protección: la que se ve en el código y
 * no existe en la respuesta.
 */
export async function onRequest(context) {
  const res = await context.next();
  const con = new Response(res.body, res);
  con.headers.set("X-Robots-Tag", "noindex");
  return con;
}
