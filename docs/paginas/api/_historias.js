/* ---------------------------------------------------------------------------
   Las historias de Instagram.

   La ruta del feed anda sin sesión, pero las historias no: `highlights_tray`,
   `reels_tray` y `reels_media` devuelven vacío sin cuenta. Así que salen de los
   visores públicos, que es lo que usa cualquiera para verlas sin loguearse.

   El problema de esos visores es que casi todos están detrás de un captcha de
   Cloudflare —probados: anonyig, dumpor, imginn, storiesig, iganony— y un Worker
   es justo el bot que bloquean. `insta-story-viewer.io` contesta con un GET pelado
   y sin captcha, así que va primero. Igual esto es una cadena y no un solo sitio:
   el día que se caiga o se ponga captcha, se prueba el siguiente, y si no anda
   ninguno la app lo dice en vez de quedarse muda. Las publicaciones del feed no
   dependen de esto.
   --------------------------------------------------------------------------- */

const CABECERAS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*",
  "Accept-Language": "es-AR,es;q=0.9",
};

const ESPEJOS = [
  {
    nombre: "insta-story-viewer",
    url: (c) => "https://insta-story-viewer.io/content.php?url=" +
                encodeURIComponent(c) + "&method=allstories",
    leer: async (r) => {
      const j = await r.json();
      return j && j.status === "ok" ? String(j.html || "") : "";
    },
  },
];

/* De cada tarjeta sacamos el id de la historia, la foto fija y el video.
   El id sale del link de descarga («…_iblo_eventos_3978118787522027567»): es el
   id del medio en Instagram, así que sirve para no proponer dos veces lo mismo. */
export function leerTarjetas(html) {
  const salida = [];
  const trozos = String(html).split('<div class="col-md-4');
  for (const t of trozos) {
    const id = (t.match(/[&?]name=[^"'&]*?_(\d{8,25})\b/) || [])[1];
    if (!id) continue;
    const foto = (t.match(/poster="([^"]+)"/) || [])[1] || "";
    const video = (t.match(/<source[^>]+src="([^"]+)"/) || [])[1] || "";
    const suelta = (t.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "";
    const medio = foto || suelta;
    if (!medio) continue;
    salida.push({ id, medio: entidades(medio), video: entidades(video), esVideo: !!video });
  }
  /* el mismo medio puede venir repetido entre la tira y el detalle */
  const vistos = new Set();
  return salida.filter((x) => (vistos.has(x.id) ? false : vistos.add(x.id)));
}

const entidades = (s) =>
  String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");

/* Trae las historias de la cuenta. Devuelve { historias, espejo } o { error }. */
export async function traerHistorias(cuenta) {
  let ultimo = "";
  for (const e of ESPEJOS) {
    try {
      const r = await fetch(e.url(cuenta), { headers: CABECERAS, cf: { cacheTtl: 0 } });
      if (!r.ok) { ultimo = e.nombre + " " + r.status; continue; }
      const html = await e.leer(r);
      if (!html) { ultimo = e.nombre + " sin contenido"; continue; }
      const historias = leerTarjetas(html);
      if (!historias.length) {
        /* que conteste bien y no haya nada es un resultado válido: no hay historias */
        return { historias: [], espejo: e.nombre };
      }
      return { historias, espejo: e.nombre };
    } catch (err) {
      ultimo = e.nombre + " " + String(err).slice(0, 60);
    }
  }
  return { error: "No pude entrar a ver las historias" + (ultimo ? " (" + ultimo + ")" : "") + "." };
}

/* Baja la foto fija de una historia y la deja como data URI para la IA.
   Va por el proxy del propio visor, que es el que tiene la firma del CDN. */
export async function bajarMedio(url, tope = 900000) {
  const r = await fetch(url, { headers: { "User-Agent": CABECERAS["User-Agent"] } });
  if (!r.ok) return "";
  const tipo = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!/^image\/(jpeg|png|webp)$/.test(tipo)) return "";
  const buf = await r.arrayBuffer();
  if (buf.byteLength > tope) return "";
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return "data:" + tipo + ";base64," + btoa(s);
}
