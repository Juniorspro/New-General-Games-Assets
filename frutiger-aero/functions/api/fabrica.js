/* La Fábrica de fondos: pedís un fondo con palabras y la máquina lo dibuja.
 *
 * POR QUÉ ESTÁ DETRÁS DE LA MISMA PUERTA QUE AERO+. Cada dibujo gasta cuota de
 * verdad —la del sitio, no la de quien lo pide—, así que si estuviera abierto,
 * un rato de gente probando lo deja sin cuota para todos. Se pregunta `acceso`
 * en la base igual que en `aeromas.js`: la pantalla no decide nada.
 *
 * EL ESTILO NO LO ESCRIBE LA PERSONA, LO PONE ESTE ARCHIVO. La idea de cada uno
 * se mete adentro de una descripción de Frutiger Aero que está acá abajo. Si el
 * estilo viniera del navegador, «Frutiger Aero» sería una sugerencia y no lo
 * único por lo que la fábrica existe.
 *
 * POR QUÉ SON DOS PASOS —dibujar y después guardar— Y NO UNO. El modelo que
 * sabe de medidas devuelve PNG, y un PNG de 768×1344 pesa 1,4 MB: no entra en
 * una fila de D1, que corta cerca de 1 MB. Recomprimirlo del lado del servidor
 * pide otro enlace de Cloudflare y otra factura. El navegador ya sabe hacerlo
 * —un `canvas` y `toBlob`— así que dibuja el servidor, achica el navegador, y
 * vuelve un JPEG de unos cientos de kilobytes que sí entra. El costo de esta
 * decisión está dicho abajo, en `guardar`: lo que vuelve en el segundo paso hay
 * que comprobarlo, porque viene de afuera.
 */
import { quienEs, limpio, json } from "./_social.js";
import { darPase, leerPase } from "./_firma.js";

/* Dos modelos y no uno, por una razón concreta:
   - flux da mejor imagen pero NO acepta medidas (probado: contesta 400
     «Additional properties /width, /height not allowed»). Sirve para el cuadrado.
   - sdxl sí acepta ancho y alto, que es TODO el punto de un fondo de pantalla:
     un teléfono es 9:16 y recortar un cuadrado a 9:16 tira casi la mitad del
     dibujo, justo la parte que el modelo compuso. */
const MODELO_MEDIDAS = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const MODELO_CUADRADO = "@cf/black-forest-labs/flux-1-schnell";

const TOPE_DIA = 10;        /* dibujos por persona por día */
const TOPE_GUARDADOS = 8;   /* cuántos le quedan guardados; el más viejo se cae */
const TOPE_PESO = 800000;   /* lo que se acepta guardar, en bytes */

export const FORMAS = {
  telefono:   { ancho: 768,  alto: 1344, que: "Teléfono (9:16)" },
  escritorio: { ancho: 1344, alto: 768,  que: "Escritorio (16:9)" },
  cuadrado:   { ancho: 1024, alto: 1024, que: "Cuadrado" },
};

/* El envoltorio de estilo, separado de la idea para que se lea de un vistazo
   qué pone el sitio y qué pone la persona. */
const ESTILO =
  "Frutiger Aero aesthetic, early 2000s Windows Vista wallpaper, glossy " +
  "translucent glass and water, aqua blue and fresh green, crystal bubbles, " +
  "clean bright sky, lens flare, high gloss reflections, optimistic, " +
  "digital render, very high detail";
const NO_QUIERO = "text, words, letters, watermark, signature, logo, ugly, " +
  "blurry, low quality, dark, gloomy, people, faces";

const hoy = () => new Date().toISOString().slice(0, 10);

/* EL JEFE ENTRA SIN HABER DONADO. Es el dueño del sitio: pedirle que se done a
   sí mismo para ver lo que él mismo publica es una vuelta que no protege nada,
   y peor, es la clase de detalle que se arregla a mano metiendo un 1 en la base
   —y entonces el permiso vive en una fila que nadie se acuerda de por qué está—.
   La columna `jefe` ya existe desde esquema4.sql justo para esto: el
   administrador es una CUENTA, no una contraseña suelta. */
async function donante(env, request) {
  const yo = await quienEs(env, request);
  if (!yo) return null;
  const u = await env.DB.prepare(
    "SELECT id, acceso, jefe, bloqueado FROM usuarios WHERE id = ?").bind(yo.u).first();
  return u && (u.acceso || u.jefe) && !u.bloqueado ? u : null;
}

async function gastoDeHoy(env, uid) {
  const r = await env.DB.prepare(
    "SELECT cuantos FROM fondos_gasto WHERE usuario = ? AND dia = ?")
    .bind(uid, hoy()).first();
  return r ? r.cuantos : 0;
}

/* La lista NO trae las imágenes. Ocho fondos en base64 son varios megabytes en
   una sola respuesta, y el navegador los vuelve a pedir igual, uno por uno,
   cuando pinta los `<img>`. Cada uno se busca por su dirección —que además el
   navegador cachea— así que mandarlos juntos sería hacer el trabajo dos veces. */
export const onRequestGet = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);

  const url = new URL(request.url);
  const id = parseInt(url.searchParams.get("id"), 10);

  /* UNA IMAGEN SOLA. Acá la puerta no puede ser la cabecera `Authorization`:
     estas direcciones las pide un `<img src=…>` y un `<a download>`, y ni uno
     ni otro pueden mandar cabeceras. Es el mismo problema que tiene la tienda
     de apps, y la misma solución: un pase firmado, corto, que viaja en la
     dirección. Sin esto la pantalla se ve entera y todas las miniaturas dan
     403, que es de los errores más molestos de leer porque la pantalla parece
     andar.

     El pase lleva la marca `f` para que un pase de sesión —que dura noventa
     días— no sirva de llave para las imágenes por el solo hecho de aparecer en
     una dirección. */
  if (id) {
    const pase = url.searchParams.get("pase") || "";
    const d = pase && (await leerPase(env.SECRETO, pase));
    const dueno = d && d.f === 1 && d.u ? { id: d.u } : await donante(env, request);
    if (!dueno) return new Response("no está", { status: 404 });

    /* el `usuario = ?` no es de adorno: sin eso, cambiar el número de la
       dirección sería mirar los fondos de otro */
    const f = await env.DB.prepare(
      "SELECT imagen FROM fondos_ia WHERE id = ? AND usuario = ?")
      .bind(id, dueno.id).first();
    if (!f) return new Response("no está", { status: 404 });
    const cruda = atob(f.imagen);
    const bytes = new Uint8Array(cruda.length);
    for (let i = 0; i < cruda.length; i++) bytes[i] = cruda.charCodeAt(i);
    return new Response(bytes, { headers: {
      "content-type": "image/jpeg",
      /* privado: es de esta persona, no lo puede guardar un intermediario */
      "cache-control": "private, max-age=31536000, immutable",
    }});
  }

  const u = await donante(env, request);
  if (!u) return json({ error: "Esto es para los que colaboraron." }, 403);

  const { results } = await env.DB.prepare(
    "SELECT id, idea, forma, creado FROM fondos_ia WHERE usuario = ? " +
    "ORDER BY creado DESC").bind(u.id).all();

  return json({ fondos: results || [], formas: FORMAS,
                hechos: await gastoDeHoy(env, u.id), tope: TOPE_DIA,
                guarda: TOPE_GUARDADOS, hay: !!env.AI,
                /* un día: lo que dura una sesión mirando fondos, no noventa */
                pase: await darPase(env.SECRETO, { u: u.id, f: 1 }, 1) });
};

export const onRequestPost = async (context) => {
  const { request, env } = context;
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);
  const u = await donante(env, request);
  if (!u) return json({ error: "Esto es para los que colaboraron." }, 403);

  const url = new URL(request.url);
  const hacer = url.searchParams.get("hacer") || "";

  if (hacer === "dibujar")  return dibujar(env, request, u);
  if (hacer === "guardar")  return guardar(env, request, u, url);
  if (hacer === "borrar") {
    const id = parseInt(url.searchParams.get("id"), 10);
    if (!id) return json({ error: "cuál" }, 400);
    await env.DB.prepare("DELETE FROM fondos_ia WHERE id = ? AND usuario = ?")
      .bind(id, u.id).run();
    return json({ listo: true });
  }
  return json({ error: "no sé hacer eso" }, 400);
};

/* ------------------------------------------------------------- paso 1
   Dibuja y devuelve la imagen CRUDA, sin guardar nada. Va en binario y no en
   JSON: meter un PNG de 1,4 MB en base64 adentro de un JSON lo infla a casi 2 MB
   para que el navegador lo tenga que desarmar de vuelta. */
async function dibujar(env, request, u) {
  if (!env.AI) return json({ error: "La fábrica no está enchufada todavía." }, 503);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  const idea = limpio(c.idea, 160);
  if (idea.length < 3) return json({ error: "Contame qué querés ver, aunque sea corto." }, 400);

  const forma = FORMAS[c.forma] ? c.forma : "telefono";
  const med = FORMAS[forma];

  /* El tope se comprueba ANTES de llamar al modelo: comprobarlo después sería
     gastar el dibujo para recién entonces decir que no había cuota. */
  const gasto = await gastoDeHoy(env, u.id);
  if (gasto >= TOPE_DIA) {
    return json({ error: "Ya hiciste " + TOPE_DIA + " fondos hoy. Mañana se " +
                         "reinicia. El tope existe porque la cuota es del sitio " +
                         "y la compartimos todos." }, 429);
  }

  /* Se anota el gasto antes de dibujar y no después: si fuera después, dos
     pedidos al mismo tiempo pasarían los dos por el mismo hueco. Si el dibujo
     falla se devuelve, que es el caso raro. */
  await env.DB.prepare(
    "INSERT INTO fondos_gasto (usuario, dia, cuantos) VALUES (?, ?, 1) " +
    "ON CONFLICT(usuario, dia) DO UPDATE SET cuantos = cuantos + 1")
    .bind(u.id, hoy()).run();

  const pedido = idea + ". " + ESTILO;
  let cuerpo = null, tipo = "image/png";
  try {
    if (forma === "cuadrado") {
      const r = await env.AI.run(MODELO_CUADRADO, { prompt: pedido, steps: 8 });
      if (r && r.image) {
        const cruda = atob(r.image);
        cuerpo = new Uint8Array(cruda.length);
        for (let i = 0; i < cruda.length; i++) cuerpo[i] = cruda.charCodeAt(i);
        tipo = "image/jpeg";
      }
    } else {
      /* este devuelve un chorro de bytes, no un objeto */
      const r = await env.AI.run(MODELO_MEDIDAS, {
        prompt: pedido, negative_prompt: NO_QUIERO, num_steps: 20,
        width: med.ancho, height: med.alto,
      });
      cuerpo = new Uint8Array(await new Response(r).arrayBuffer());
      if (!cuerpo.length) cuerpo = null;
    }
  } catch (e) { cuerpo = null; }

  if (!cuerpo) {
    await env.DB.prepare(
      "UPDATE fondos_gasto SET cuantos = MAX(0, cuantos - 1) WHERE usuario = ? AND dia = ?")
      .bind(u.id, hoy()).run();
    return json({ error: "No salió. A veces el dibujante dice que no a una idea; " +
                         "probá con otras palabras." }, 502);
  }

  return new Response(cuerpo, { headers: {
    "content-type": tipo,
    "cache-control": "no-store",
    /* la cuota viaja en la cabecera porque el cuerpo ya es la imagen */
    "x-hechos": String(gasto + 1),
  }});
}

/* ------------------------------------------------------------- paso 2
   Guarda lo que el navegador achicó. ESTO VIENE DE AFUERA: que el paso 1 lo
   haya dibujado el servidor no significa que lo que vuelve sea eso mismo.
   Cualquiera con la sesión puede mandar los bytes que quiera, así que se
   comprueba el tamaño y que empiece como un JPEG, y se guarda sólo en la fila
   de esa persona, con el mismo tope de ocho. No es una prueba de que la imagen
   salió de acá —eso pediría firmar el dibujo— pero acota el daño a lo que uno
   se puede hacer a sí mismo. */
async function guardar(env, request, u, url) {
  const idea = limpio(url.searchParams.get("idea"), 160);
  if (idea.length < 3) return json({ error: "falta la idea" }, 400);
  const forma = FORMAS[url.searchParams.get("forma")] ? url.searchParams.get("forma") : "telefono";

  const buf = new Uint8Array(await request.arrayBuffer());
  if (!buf.length) return json({ error: "vino vacío" }, 400);
  if (buf.length > TOPE_PESO) {
    return json({ error: "Pesa demasiado para guardarlo." }, 413);
  }
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) {
    return json({ error: "eso no es un JPEG" }, 400);
  }

  /* a base64 de a pedazos: `String.fromCharCode(...buf)` con medio millón de
     bytes revienta la pila de argumentos */
  let s = "";
  for (let i = 0; i < buf.length; i += 8192) {
    s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
  }
  const b64 = btoa(s);

  const creado = Date.now();
  const ins = await env.DB.prepare(
    "INSERT INTO fondos_ia (usuario, idea, forma, imagen, creado) VALUES (?, ?, ?, ?, ?)")
    .bind(u.id, idea, forma, b64, creado).run();
  const id = ins.meta.last_row_id;

  /* la carpeta no crece para siempre: se cae el más viejo */
  await env.DB.prepare(
    "DELETE FROM fondos_ia WHERE usuario = ?1 AND id NOT IN " +
    "(SELECT id FROM fondos_ia WHERE usuario = ?1 ORDER BY creado DESC LIMIT ?2)")
    .bind(u.id, TOPE_GUARDADOS).run();

  return json({ fondo: { id, idea, forma, creado },
                hechos: await gastoDeHoy(env, u.id), tope: TOPE_DIA });
}
