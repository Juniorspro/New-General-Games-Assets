/* Lo que sabe traer las publicaciones de Instagram. Lo usan la ruta /api/instagram
   y el botón «Nuevo» de la app, que necesita los avisos frescos antes de pensar. */


export const CUENTA  = "iblo_eventos";
export const CADA    = 2 * 3600e3;   // se refresca cada 2 horas
const POR_VEZ = 4;            // cuántas fotos nuevas se guardan por visita
const TOPE    = 60;           // cuántas se conservan

const CABECERAS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "X-IG-App-ID": "936619743392459",
  Referer: "https://www.instagram.com/" + CUENTA + "/",
  Accept: "*/*",
};

/* de todos los tamaños, el más chico que sirva */
function miniatura(it) {
  const c = (it.image_versions2 && it.image_versions2.candidates) ||
            (it.carousel_media && it.carousel_media[0] &&
             it.carousel_media[0].image_versions2 &&
             it.carousel_media[0].image_versions2.candidates) || [];
  const utiles = c.filter((x) => x.width >= 300).sort((a, b) => a.width - b.width);
  return (utiles[0] || c[0] || {}).url || null;
}
const b64 = (buf) => {
  const u = new Uint8Array(buf); let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};

export async function sincronizar(env) {
  const r = await fetch(
    "https://www.instagram.com/api/v1/feed/user/" + CUENTA + "/username/?count=12",
    { headers: CABECERAS, cf: { cacheTtl: 0 } }
  );
  if (!r.ok) return { error: "instagram " + r.status };
  const j = await r.json();
  const items = j.items || [];
  if (!items.length) return { error: j.message || "sin publicaciones" };

  let nuevas = 0;
  for (const it of items) {
    if (nuevas >= POR_VEZ) break;
    const codigo = it.code; if (!codigo) continue;
    const ya = await env.DB.prepare("SELECT codigo FROM ig WHERE codigo = ?").bind(codigo).first();
    if (ya) continue;

    const url = miniatura(it);
    let imagen = "";
    if (url) {
      try {
        const f = await fetch(url, { headers: { "User-Agent": CABECERAS["User-Agent"] } });
        if (f.ok) {
          const buf = await f.arrayBuffer();
          if (buf.byteLength < 400000) {
            const tipo = f.headers.get("content-type") || "image/jpeg";
            imagen = "data:" + tipo.split(";")[0] + ";base64," + b64(buf);
          }
        }
      } catch {}
    }
    const texto = ((it.caption && it.caption.text) || "").slice(0, 700);
    const tipo = it.media_type === 2 ? "video" : it.media_type === 8 ? "carrusel" : "foto";
    await env.DB.prepare(
      "INSERT OR IGNORE INTO ig (codigo, texto, imagen, tipo, publicado, guardado) VALUES (?,?,?,?,?,?)"
    ).bind(codigo, texto, imagen, tipo, (it.taken_at || 0) * 1000, Date.now()).run();
    nuevas++;
  }
  await env.DB.prepare(
    "INSERT INTO estado_ig (id, ultima) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET ultima = excluded.ultima"
  ).bind(Date.now()).run();
  /* La poda cuenta SÓLO posteos. Las historias entran con `publicado = ahora`,
     así que si contaran acá serían siempre las más nuevas y echarían de la tabla
     a los posteos de verdad, que es justo lo que hay que conservar. Ellas se van
     solas a las 24 horas, en `instagram.js`. */
  await env.DB.prepare(
    `DELETE FROM ig WHERE tipo <> 'historia' AND codigo NOT IN (
       SELECT codigo FROM ig WHERE tipo <> 'historia' ORDER BY publicado DESC LIMIT ?)`
  ).bind(TOPE).run();
  return { nuevas };
}

