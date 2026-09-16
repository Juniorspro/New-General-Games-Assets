import { json, preflight, exigirSesion } from "./_comun.js";
import { pedirIA, vaciaElCupo } from "./_modelos.js";
export const onRequestOptions = preflight;

/* «Quiero una estética Y2K» y que salga cargada.
 *
 * El dueño no tiene por qué saber qué es un hexadecimal ni escribir una bajada
 * publicitaria. Le dice a la app de qué va la fiesta y esto devuelve la
 * propuesta entera: nombre corto, bajada, descripción, las fichas y LOS OCHO
 * COLORES. No guarda nada: la app la muestra, el dueño la corrige y recién ahí
 * la sube. Es la misma regla que ya tiene `/api/sugerir`.
 *
 * Los colores se validan uno por uno y lo que no sea un `#rrggbb` se reemplaza
 * por el de la paleta base. Un modelo que contesta «violeta neón» en vez de
 * «#c34bff» no puede escribir eso en una variable CSS: rompe la hoja de
 * estilos de toda la página, no sólo la de esa fiesta.
 */

const COLOR = /^#[0-9a-fA-F]{6}$/;
const TONOS = ["ac", "ac2", "ac3", "tinta", "tinta2", "humo", "linea", "papel"];
const BASE = { ac: "#ff1e8e", ac2: "#8b2fd6", ac3: "#ffd23f", tinta: "#08070c",
               tinta2: "#100d18", humo: "#1a1622", linea: "#2b2436", papel: "#f4f1f6" };

const t = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

/* El modelo suele envolver el JSON en explicaciones o en ```json. Se busca la
   llave de apertura y la de cierre en vez de confiar en que venga limpio. */
function sacarJSON(texto) {
  const s = String(texto || "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

export async function onRequestPost({ request, env }) {
  const usuario = await exigirSesion(request, env);
  if (!usuario) return json({ error: "Volvé a iniciar sesión." }, 401);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  const idea = t(b.idea, 400);
  if (!idea) return json({ error: "Contame de qué va la fiesta." }, 400);

  const pedido =
    "Devolvé SOLO un objeto JSON, sin explicaciones y sin ```. Campos exactos:\n" +
    '{"n":"nombre corto de la estética (1 o 2 palabras)",' +
    '"sub":"bajada de una línea, tipo: Cowboy Night · 06.06.2026",' +
    '"des":"descripción de 2 o 3 frases, máximo 55 palabras",' +
    '"f":[["Lugar","..."],["Arranca","..."],["Cabina","..."],["Adentro","..."]],' +
    '"wsp":"mensaje de WhatsApp de una línea, en primera persona, para pedir esa fiesta",' +
    '"paleta":{"ac":"#rrggbb","ac2":"#rrggbb","ac3":"#rrggbb","tinta":"#rrggbb",' +
    '"tinta2":"#rrggbb","humo":"#rrggbb","linea":"#rrggbb","papel":"#rrggbb"}}' + "\n\n" +
    "La paleta es para una web de fiestas SOBRE FONDO OSCURO: `ac` es el acento fuerte, " +
    "`ac2` un acento secundario más apagado, `ac3` un tercero claro para detalles, " +
    "`tinta` el fondo (muy oscuro, casi negro, teñido del color de la fiesta), `tinta2` un " +
    "escalón más claro, `humo` las tarjetas, `linea` los bordes, `papel` el texto (casi blanco). " +
    "Los cuatro oscuros tienen que ser oscuros de verdad y el texto tiene que leerse encima.";

  let prop = null, de = "";
  try {
    const r = await pedirIA(env, [
      { role: "system", content:
        "Armás estéticas de fiesta para IBLO Eventos, productora de Margarita Belén, Chaco. " +
        "Español rioplatense con voseo, con energía y sin exagerar. Sin emojis, sin hashtags, " +
        "sin comillas adentro de los textos. Nunca inventes fechas ni precios que no te den." },
      { role: "user", content: pedido + "\n\nLa fiesta es: " + idea },
    ], { tope: 700, calor: 0.6 });
    prop = sacarJSON(r.texto);
    de = r.de || "";
  } catch (e) {
    return json({ error: vaciaElCupo(e)
      ? "Se acabó el cupo de IA por hoy. Podés cargarla a mano igual."
      : String((e && e.message) || e).slice(0, 180), cupo: vaciaElCupo(e) }, 502);
  }
  if (!prop) return json({ error: "La IA contestó algo que no pude leer. Probá de nuevo." }, 502);

  const n = t(prop.n, 40) || "Nueva";
  /* La clave sale del nombre, no de la IA: es lo que va en el ancla del enlace
     y en el atributo del tema, y tiene que ser previsible. */
  const k = n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
             .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "nueva";

  const paleta = {};
  let inventados = 0;
  for (const x of TONOS) {
    const v = t((prop.paleta || {})[x], 7);
    if (COLOR.test(v)) paleta[x] = v.toLowerCase();
    else { paleta[x] = BASE[x]; inventados++; }
  }
  const f = Array.isArray(prop.f) ? prop.f.slice(0, 8)
      .map((p) => [t(p && p[0], 30), t(p && p[1], 90)])
      .filter((p) => p[0] && p[1]) : [];

  return json({ ok: true, de, coloresInventados: inventados, estetica: {
    k, n,
    sub: t(prop.sub, 90),
    des: t(prop.des, 700),
    wsp: t(prop.wsp, 300) || ("Hola IBLO! Quiero una fiesta " + n + ". ¿Me pasás info?"),
    f, paleta,
    flyer: "", flyerUrl: "", pieza: null, dec: null, clip: null,
    mov: "flota", oculta: false,
  } });
}
