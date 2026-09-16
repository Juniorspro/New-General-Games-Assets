import { json, preflight } from "./_comun.js";
import { traducirFalla } from "./_ia.js";
import { pedirIA } from "./_modelos.js";

export const onRequestOptions = preflight;

/* Reescribe el texto del aviso. Antes le hablaba a Workers AI directo, así que el
   día que se acababa el cupo devolvía el error crudo del proveedor —«4006: you
   have used up your daily free allocation»— y encima no aprovechaba la cadena.
   Ahora pasa por `pedirIA` como todo lo demás: si Cloudflare está sin cupo sigue
   con el que le toque, y si no hay ninguno el dueño lee algo en castellano. */
export async function onRequestPost({ request, env }) {
  let cuerpo;
  try { cuerpo = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  const texto = String(cuerpo.texto || "").slice(0, 900).trim();
  if (!texto) return json({ error: "falta el texto" }, 400);

  const sistema =
    "Sos el community manager de IBLO Eventos, una productora de fiestas de Margarita Belén, Chaco. " +
    "Reescribís avisos de venta de entradas en español rioplatense (voseo), con energía pero sin exagerar. " +
    "Reglas estrictas: no inventes datos que no estén en el texto (ni fechas, ni lugares, ni precios, ni nombres). " +
    "Máximo 40 palabras, dos o tres frases. Sin hashtags, sin emojis, sin comillas. " +
    "Devolvé únicamente el texto final, nada más.";

  try {
    const { texto: salida, de } = await pedirIA(env, [
      { role: "system", content: sistema },
      { role: "user", content: texto },
    ], { tope: 180, calor: 0.6 });

    /* sólo se sacan las comillas que envuelven todo el aviso: sacar la primera
       que apareciera dejaba la de adentro suelta */
    const pares = { '"': '"', "'": "'", "«": "»", "“": "”" };
    let limpio = String(salida).trim().replace(/\s+/g, " ");
    const f = limpio.charAt(0);
    if (pares[f] && limpio.endsWith(pares[f])) limpio = limpio.slice(1, -1).trim();
    if (!limpio) return json({ error: "La IA contestó vacío. Probá de nuevo." }, 502);
    return json({ texto: limpio, de });
  } catch (e) {
    return json({ error: traducirFalla(e) }, 502);
  }
}
