/* El sitemap se calcula, no se escribe a mano.
 *
 * POR QUE: la unica via que le queda a Google para enterarse de que algo
 * cambio, sin pedirle indexacion a mano, es este archivo. Y de todo lo que
 * lleva adentro Google mira UNA sola cosa: `lastmod`. `changefreq` y `priority`
 * los ignora —lo dice en su propia documentacion— asi que no estan.
 *
 * EL PROBLEMA DE ESCRIBIRLO A MANO es que la fecha se queda quieta. Cuando todas
 * las direcciones dicen la misma fecha de hace meses, Google aprende que este
 * sitemap no dice la verdad y le deja de creer: a partir de ahi, publicar una
 * fiesta nueva no le avisa a nadie. Peor todavia es lo contrario, poner «hoy»
 * en todo, que es mentirle y que tambien se nota.
 *
 * Asi que cada pagina lleva la fecha de lo ULTIMO que la cambio de verdad, que
 * son dos cosas distintas:
 *   - su propio archivo, que cambia cuando se publica el sitio: esa fecha la
 *     calcula `armar-sitio.sh` desde git y la deja en `_fechas.js`.
 *   - los datos que muestra: una fiesta nueva cambia la portada y la pagina de
 *     publicaciones aunque el HTML sea identico. Eso se pregunta a la base.
 * De las dos, gana la mas nueva.
 */
import { FECHAS } from "./_fechas.js";

const RAIZ = "https://iblo-eventos.pages.dev";

/* Que mira cada pagina. Las que no leen nada de la base no estan: su fecha es
   la del archivo y punto. Inventarles un dato para que «parezcan frescas»
   seria justamente la mentira que hace que dejen de creerle al sitemap. */
const MIRAN = {
  "": ["publicaciones", "archivo"],       /* la portada: el cartel y las fotos */
  "iblo-publicaciones": ["publicaciones"],
  "iblo-archivo": ["archivo"],
  "iblo-esteticas": [],
  "iblo-servicios": [],
  "iblo-reels": [],
};

/* `publicaciones` lleva `tocado`, que se escribe en cada cambio; `archivo` solo
   tiene `creado`, asi que ahi una foto editada no mueve la fecha. Es lo que
   hay: es preferible una fecha que se queda corta a una inventada. */
const CONSULTA = {
  publicaciones: "SELECT MAX(tocado) AS m FROM publicaciones WHERE estado = 'publicada'",
  archivo: "SELECT MAX(x) AS m FROM (" +
           "  SELECT MAX(creado) AS x FROM archivo WHERE estado = 'publicada'" +
           "  UNION ALL SELECT MAX(creado) FROM secciones)",
};

const comoFecha = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "+00:00");

export async function onRequestGet({ env }) {
  const dato = {};
  if (env.DB) {
    for (const [clave, sql] of Object.entries(CONSULTA)) {
      /* si una consulta falla, esa pagina se queda con la fecha de su archivo:
         un sitemap con una fecha vieja sirve, uno que devuelve error no */
      try { dato[clave] = (await env.DB.prepare(sql).first())?.m || 0; }
      catch { dato[clave] = 0; }
    }
  }

  const filas = Object.entries(MIRAN).map(([ruta, fuentes]) => {
    const delArchivo = FECHAS[ruta] || FECHAS[""] || 0;
    const delDato = Math.max(0, ...fuentes.map((f) => dato[f] || 0));
    return "  <url>\n" +
           "    <loc>" + RAIZ + "/" + ruta + "</loc>\n" +
           "    <lastmod>" + comoFecha(Math.max(delArchivo, delDato)) + "</lastmod>\n" +
           "  </url>";
  });

  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    filas.join("\n") + "\n</urlset>\n",
    { headers: {
        "content-type": "application/xml; charset=utf-8",
        /* media hora: si se publica una fiesta, que Google pueda verlo pronto,
           pero sin recalcularlo en cada visita de cada rastreador */
        "cache-control": "public, max-age=1800",
      } }
  );
}
