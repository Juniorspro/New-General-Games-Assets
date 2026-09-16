import { json, preflight, exigirSesion } from "./_comun.js";
import { traducirFalla } from "./_ia.js";
export const onRequestOptions = preflight;

/* Genera el adorno de una publicación: un objeto suelto sobre pantalla verde.
   El recorte lo hace la app en el teléfono, con canvas: el verde se saca ahí y
   no acá, porque el plan gratis de Workers corta a los 10 ms de CPU y pasar un
   millón de píxeles no entra.

   Cada adorno cuesta ~250 neuronas: doce veces lo que cuesta leer un flyer, y
   con 10.000 por día son apenas 40. Por eso hay biblioteca: el recorte terminado
   se guarda en `adornos` con el nombre del objeto como clave, y la próxima vez
   que toque el mismo sombrero de vaquero sale de ahí, sin gastar nada. El
   botón «Otro» manda `rehacer` y sí genera uno nuevo, que reemplaza al guardado.
   La elección del objeto (la llamada de texto) se guarda en `cache_ia`, así la
   segunda vez tampoco cuesta esa. */

const MODELO = "@cf/black-forest-labs/flux-1-schnell";
const MODELO_TEXTO = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/* Las estéticas de la casa, resueltas sin gastar una llamada. La clave es lo que
   se busca en el título y en el texto; el valor es qué objeto pedirle al modelo. */
const CONOCIDOS = [
  [/west|wést|cowboy|vaquer|far ?west|rodeo/i,        "a brown leather cowboy hat"],
  [/halloween|terror|zombi|calabaza/i,                 "a carved glowing Halloween pumpkin"],
  [/primavera|flor|jardin|jardín/i,                    "a bouquet of bright spring flowers"],
  [/rey|reina|realeza|corona|coronaci/i,               "a golden royal crown with red velvet"],
  [/euphoria|glitter|brillo|purpurina/i,               "a shiny disco ball covered in glitter"],
  [/ice|hielo|invierno|nieve|frozen/i,                 "a cluster of blue ice crystals"],
  [/pirata|corsario|calavera/i,                        "a black pirate tricorn hat"],
  [/semaforo|semáforo/i,                               "a small traffic light with glowing lights"],
  [/audio ?car|parlante|sonido|bass/i,                 "a big black concert speaker"],
  [/egresad|promo|graduaci/i,                          "a graduation cap with a golden tassel"],
  [/amigo|amistad/i,                                   "two clinking beer mugs"],
  [/cumple|aniversario/i,                              "a slice of birthday cake with a candle"],
  [/navidad|fin de año|año nuevo/i,                    "a bunch of golden party balloons"],
  [/carnaval|murga|comparsa/i,                         "a colorful feathered carnival mask"],
  [/verano|playa|pool|pileta/i,                        "a pair of sunglasses and a tropical drink"],
];

/* Si no pega ninguna, que lo elija la IA: una cosa sola, nombrada en inglés. */
async function elegirObjeto(env, pista) {
  const r = await env.AI.run(MODELO_TEXTO, {
    messages: [
      { role: "system", content:
        "You name ONE physical prop object that represents a party theme, for a product photo. " +
        "Answer with a short English noun phrase and nothing else, 3 to 7 words, starting with 'a' or 'an'. " +
        "It must be a single inanimate object. Never people, never faces, never text or logos. " +
        "Examples: a brown leather cowboy hat / a carved glowing pumpkin / a golden royal crown." },
      { role: "user", content: pista },
    ],
    max_tokens: 40,
    temperature: 0.4,
  });
  const t = String(r?.response || "").trim().split("\n")[0]
    .replace(/^["'`\s.\-*]+|["'`\s.]+$/g, "").slice(0, 70);
  return /^(a|an|the)\s/i.test(t) ? t : "";
}

export function objetoDe(texto) {
  for (const [re, objeto] of CONOCIDOS) if (re.test(texto)) return objeto;
  return "";
}

const ENCUADRE =
  ", single object, centered, full object visible with margin around it, studio product photo, " +
  "sharp focus, isolated on a completely flat solid chroma key green screen background, " +
  "pure bright #00FF00 green, uniform background with no gradient, no vignette, no shadow on the " +
  "background, no floor, no text, no watermark, no people, " +
  /* el rebote verde de la pantalla sobre el objeto es lo que dejaba halo al recortar */
  "the object itself has no green tint and no green reflections on it, flat even lighting";

/* la clave con la que se guarda: el objeto, sin mayúsculas ni espacios de más */
function claveDe(objeto) {
  return String(objeto).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 90);
}

/* La biblioteca es de conveniencia: si la base falla, se genera y listo. */
async function deLaBiblioteca(env, clave) {
  if (!env.DB) return "";
  try {
    const f = await env.DB.prepare("SELECT imagen FROM adornos WHERE concepto = ?").bind(clave).first();
    if (!f || !f.imagen) return "";
    await env.DB.prepare("UPDATE adornos SET usos = usos + 1 WHERE concepto = ?").bind(clave).run();
    return String(f.imagen);
  } catch { return ""; }
}

async function objetoRecordado(env, pista) {
  if (!env.DB) return "";
  try {
    const f = await env.DB.prepare("SELECT salida FROM cache_ia WHERE huella = ?")
      .bind("objeto:" + claveDe(pista)).first();
    return f ? String(f.salida) : "";
  } catch { return ""; }
}

/* Cuántos adornos nuevos por día. A ~250 neuronas cada uno son 3.000 de las
   10.000, y quedan 7.000 —unas 350 llamadas— para leer flyers y escribir avisos. */
const TOPE_DIA = 12;

const hoy = () => new Date().toISOString().slice(0, 10);

async function gastadosHoy(env) {
  if (!env.DB) return 0;
  try {
    const f = await env.DB.prepare("SELECT salida FROM cache_ia WHERE huella = ?")
      .bind("adornos:" + hoy()).first();
    return f ? Number(f.salida) || 0 : 0;
  } catch { return 0; }
}

async function anotarGasto(env) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      "INSERT INTO cache_ia (huella, salida, creado) VALUES (?, '1', ?) " +
      "ON CONFLICT(huella) DO UPDATE SET salida = CAST(CAST(salida AS INTEGER) + 1 AS TEXT)"
    ).bind("adornos:" + hoy(), Date.now()).run();
  } catch {}
}

async function recordarObjeto(env, pista, objeto) {
  if (!env.DB) return;
  try {
    await env.DB.prepare("INSERT OR REPLACE INTO cache_ia (huella, salida, creado) VALUES (?, ?, ?)")
      .bind("objeto:" + claveDe(pista), objeto, Date.now()).run();
  } catch {}
}

export async function onRequestPost({ request, env }) {
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  if (!env.AI) return json({ error: "La IA no está disponible." }, 503);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  const pista = String(b.pista || "").slice(0, 300).trim();
  /* el dueño puede escribir él mismo qué quiere: «un sombrero de paja» */
  const pedido = String(b.objeto || "").slice(0, 90).trim();

  if (!pista && !pedido) return json({ error: "Decime de qué va la fiesta." }, 400);

  let objeto = pedido;
  let deDonde = "pedido";
  if (!objeto) {
    objeto = objetoDe(pista);
    deDonde = "tabla";
    if (!objeto) {
      objeto = await objetoRecordado(env, pista);
      if (objeto) deDonde = "recordado";
    }
    if (!objeto) {
      try {
        objeto = await elegirObjeto(env, pista);
        deDonde = "ia";
        if (objeto) await recordarObjeto(env, pista, objeto);
      } catch {}
    }
    if (!objeto) { objeto = "a shiny disco ball"; deDonde = "por defecto"; }
  }

  const clave = claveDe(objeto);

  /* lo mismo ya recortado de otra vez: sale gratis y al instante */
  if (!b.rehacer) {
    const guardado = await deLaBiblioteca(env, clave);
    if (guardado) return json({ objeto, clave, deDonde, recortado: guardado, deLaBase: true });
  }

  /* generar uno nuevo sí gasta, y el cupo lo comparte con el que lee y escribe */
  const gastados = await gastadosHoy(env);
  if (gastados >= TOPE_DIA) {
    return json({ error:
      "Por hoy ya se generaron " + TOPE_DIA + " adornos nuevos, que es lo que se " +
      "puede sin dejar a la IA sin cupo para leer flyers y escribir avisos. Mañana " +
      "se repone. Los adornos que ya están guardados los podés seguir usando." }, 429);
  }

  let img = "";
  try {
    const r = await env.AI.run(MODELO, { prompt: objeto + ENCUADRE, steps: 6 });
    img = String(r?.image || "");
  } catch (e) {
    return json({ error: traducirFalla(e) }, 502);
  }
  if (!img) return json({ error: "El generador no devolvió nada. Probá de nuevo." }, 502);
  await anotarGasto(env);

  return json({ objeto, clave, deDonde, quedan: TOPE_DIA - gastados - 1,
                imagen: "data:image/jpeg;base64," + img });
}

/* La app manda acá el recorte ya hecho, para que el próximo que pida lo mismo no
   gaste. Si no se puede guardar no pasa nada: el adorno ya lo tiene el dueño. */
export async function onRequestPut({ request, env }) {
  if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
  if (!env.DB) return json({ guardado: false });

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  const clave = claveDe(b.clave || "");
  const recortado = String(b.recortado || "");
  if (!clave || !recortado.startsWith("data:image/")) return json({ error: "falta el recorte" }, 400);
  /* una fila de D1 no es lugar para un archivo grande; el recorte de 420 px
     entra holgado, y si algún día no entra se deja pasar sin guardar */
  if (recortado.length > 700000) return json({ guardado: false, motivo: "pesa demasiado" });

  try {
    await env.DB.prepare(
      "INSERT INTO adornos (concepto, imagen, usos, creado) VALUES (?, ?, 0, ?) " +
      "ON CONFLICT(concepto) DO UPDATE SET imagen = excluded.imagen, creado = excluded.creado"
    ).bind(clave, recortado, Date.now()).run();
    return json({ guardado: true, clave });
  } catch (e) {
    return json({ guardado: false, motivo: String(e && e.message || e).slice(0, 120) });
  }
}
