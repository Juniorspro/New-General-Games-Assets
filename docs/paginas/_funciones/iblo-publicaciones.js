/* La página de publicaciones, con las publicaciones YA ADENTRO del HTML.
 *
 * EL AGUJERO QUE TAPA, y era el peor del sitio: esta página no traía ni una
 * publicación. Las pedía por JavaScript a `/api/publicaciones`, y `robots.txt`
 * tenía esa dirección bloqueada. O sea que el buscador entraba, no podía pedir
 * los datos, le saltaba el `catch`, y LA PÁGINA QUE GOOGLE INDEXÓ DECÍA «No se
 * pudieron cargar». La ficha estructurada de los eventos, que se arma después
 * de ese pedido, directamente no existía nunca.
 *
 * Lo primero ya está arreglado en `robots.txt`. Pero que el buscador PUEDA
 * pedir los datos no alcanza: renderizar JavaScript es un segundo paso, va en
 * otra cola, tarda, y no está garantizado. Lo único que se indexa seguro es lo
 * que viene en el HTML. Así que viene en el HTML.
 *
 * Se inyecta TEXTO, no las fotos: las imágenes son webp en base64 guardados en
 * la base y meterlas acá haría una página de varios megas para no agregar una
 * sola palabra que se pueda buscar. Las fotos las sigue poniendo la página
 * cuando carga, para el que la mira.
 */
const esc = (t) => String(t == null ? "" : t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const RAIZ = "https://iblo-eventos.pages.dev";
const GRACIA = 6 * 3600e3;    /* una fiesta no desaparece mientras se hace */

/* Lo mismo que ordena la API: primero lo que todavía no pasó, por fecha, y los
   avisos sin fecha por cuándo se cargaron. */
const SQL =
  "SELECT id, tipo, titulo, subtitulo, detalle, fecha, cuando, lugar, hora, precio, creado " +
  "FROM publicaciones WHERE estado = 'publicada' " +
  "ORDER BY (cuando IS NULL OR cuando = 0) ASC, cuando ASC, creado DESC LIMIT 30";

function comoTarjeta(p) {
  const linea = [];
  if (p.fecha)  linea.push(esc(p.fecha));
  if (p.lugar)  linea.push(esc(p.lugar));
  if (p.hora)   linea.push(esc(p.hora));
  if (p.precio) linea.push(esc(p.precio));
  return '<article class="ent pub">' +
    '<div class="cuerpo">' +
      "<h3>" + esc(p.titulo) + "</h3>" +
      (p.subtitulo ? '<span class="baja2">' + esc(p.subtitulo) + "</span>" : "") +
      (linea.length ? '<div class="datos">' +
        linea.map((x) => '<span class="dato">' + x + "</span>").join("") + "</div>" : "") +
      (p.detalle ? "<p>" + esc(p.detalle) + "</p>" : "") +
    "</div></article>";
}

/* La ficha de eventos, con los mismos dos cuidados que ya tenía la versión de
   JavaScript: sin repetidos —hay publicaciones cargadas dos veces y Google
   marca los eventos duplicados como error— y sin imágenes `data:`, que Google
   no puede descargar y pesan cientos de miles de caracteres. */
function fichaDeEventos(lista) {
  const vistos = new Set();
  const eventos = lista.filter((p) => {
    if (!(p.cuando > Date.now())) return false;
    const llave = (p.titulo || "").trim().toLowerCase() + "|" + p.cuando;
    if (vistos.has(llave)) return false;
    vistos.add(llave);
    return true;
  }).slice(0, 20).map((p) => {
    const e = {
      "@context": "https://schema.org", "@type": "Event", name: p.titulo,
      startDate: new Date(p.cuando).toISOString(),
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      organizer: { "@type": "Organization", name: "IBLO Eventos", url: RAIZ + "/" },
      location: { "@type": "Place", name: p.lugar || "Margarita Belén, Chaco",
                  address: { "@type": "PostalAddress",
                             addressLocality: "Margarita Belén",
                             addressRegion: "Chaco", addressCountry: "AR" } },
      image: [RAIZ + "/og-iblo.jpg"],
      url: RAIZ + "/iblo-publicaciones",
    };
    if (p.detalle) e.description = p.detalle;
    if (p.precio) e.offers = { "@type": "Offer", price: String(p.precio).replace(/[^\d.]/g, "") || undefined,
                               priceCurrency: "ARS", availability: "https://schema.org/InStock",
                               url: RAIZ + "/iblo-publicaciones" };
    return e;
  });
  return eventos.length
    ? '<script type="application/ld+json" data-eventos="servidor">' +
      /* `<` escapado: si un título trajera «</script>» cortaría la etiqueta y
         se llevaría puesta media página */
      JSON.stringify(eventos).replace(/</g, "\\u003c") + "<\/script>"
    : "";
}

export async function onRequest(context) {
  const res = await context.next();
  const tipo = res.headers.get("content-type") || "";
  if (!tipo.includes("text/html") || !context.env.DB) return res;

  let filas;
  /* si la base no contesta, se sirve la página tal cual y la arma el navegador:
     media página es mejor que un error */
  try { filas = (await context.env.DB.prepare(SQL).all()).results || []; }
  catch { return res; }
  if (!filas.length) return res;

  const cuerpo = filas.map(comoTarjeta).join("");
  const ficha = fichaDeEventos(filas);

  return new HTMLRewriter()
    .on("#pubs-lista", {
      element(e) {
        e.setAttribute("data-servidor", "1");
        e.setInnerContent(cuerpo, { html: true });
      },
    })
    .on("head", { element(e) { if (ficha) e.append(ficha, { html: true }); } })
    .transform(res);
}
