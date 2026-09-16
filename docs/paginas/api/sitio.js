import { json, preflight, exigirSesion } from "./_comun.js";
export const onRequestOptions = preflight;

/* LO QUE SE PUEDE CAMBIAR DE LA PÁGINA, SIN TOCAR CÓDIGO.
 *
 * Hasta acá las estéticas, los colores y los textos de las secciones vivían
 * escritos adentro del HTML: las mismas nueve estéticas y los mismos nueve
 * temas de color repetidos en cinco archivos de hasta dos megas. Agregar una
 * fiesta nueva era editar cinco archivos a mano y volver a desplegar. Por eso
 * la página "quedaba siempre así".
 *
 * Ahora ese contenido vive acá, en la base, y la página lo pide al cargar. El
 * HTML conserva su copia como respaldo: si la API no contesta, se ve lo mismo
 * que hoy. Nunca queda en blanco.
 *
 * Tres áreas, cada una un documento JSON:
 *
 *   esteticas  las fiestas: nombre, bajada, descripción, fichas, WhatsApp,
 *              foto del flyer y SU PALETA (ocho colores)
 *   secciones  qué bloques se ven en cada página, en qué orden y con qué
 *              título y texto
 *   marca      lo global: colores de base, tipografías, redondeo, grano
 *
 * Cada guardado deja la versión anterior en el historial, así que "deshacer"
 * siempre existe. Es la diferencia entre un panel que el dueño usa tranquilo y
 * uno que no toca por miedo a romper la web.
 */

const AREAS = ["esteticas", "secciones", "marca"];
const TOPE = 400000;          // por área; un JSON de texto no llega ni cerca
const GUARDA = 20;            // cuántas versiones viejas se conservan

async function tablas(env) {
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sitio (
         area TEXT PRIMARY KEY, valor TEXT NOT NULL,
         tocado INTEGER NOT NULL, quien TEXT )`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sitio_historial (
         id INTEGER PRIMARY KEY AUTOINCREMENT, area TEXT NOT NULL,
         valor TEXT NOT NULL, tocado INTEGER NOT NULL, quien TEXT )`),
    env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS ix_sitio_hist ON sitio_historial (area, id DESC)`),
  ]);
}

const cortar = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const COLOR = /^#[0-9a-fA-F]{6}$/;
const CLAVE = /^[a-z0-9-]{2,32}$/;

/* Los ocho colores de un tema. Se validan uno por uno porque van derecho a una
   variable CSS: cualquier cosa que no sea un color entra como texto en la hoja
   de estilos y rompe la página entera, no sólo esa estética. */
const TONOS = ["ac", "ac2", "ac3", "tinta", "tinta2", "humo", "linea", "papel"];
const BASE = { ac: "#ff1e8e", ac2: "#8b2fd6", ac3: "#ffd23f", tinta: "#08070c",
               tinta2: "#100d18", humo: "#1a1622", linea: "#2b2436", papel: "#f4f1f6" };

function limpiarPaleta(p) {
  const s = {};
  for (const t of TONOS) s[t] = COLOR.test(String((p || {})[t] || "")) ? p[t] : BASE[t];
  return s;
}

function limpiarEstetica(e) {
  const k = cortar(e.k, 32).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!CLAVE.test(k)) return { error: "La estética necesita un nombre corto (letras y guiones)." };
  const n = cortar(e.n, 40);
  if (!n) return { error: "Falta el nombre de la estética." };
  const f = Array.isArray(e.f) ? e.f.slice(0, 10)
      .map((p) => [cortar(p && p[0], 30), cortar(p && p[1], 90)])
      .filter((p) => p[0] || p[1]) : [];
  return { fila: {
    k, n,
    sub: cortar(e.sub, 90),
    des: cortar(e.des, 700),
    wsp: cortar(e.wsp, 300),
    f,
    /* Las piezas 3D, los adornos y los clips son archivos que ya están en el
       repositorio: el dueño elige de una lista, no inventa nombres. Un valor
       que no exista se ignora solo al dibujar. */
    flyer: cortar(e.flyer, 40),
    flyerUrl: cortar(e.flyerUrl, 400),
    pieza: cortar(e.pieza, 40) || null,
    dec: cortar(e.dec, 40) || null,
    clip: cortar(e.clip, 40) || null,
    mov: ["flota", "late", "gira"].includes(e.mov) ? e.mov : "flota",
    oculta: !!e.oculta,
    paleta: limpiarPaleta(e.paleta),
  } };
}

function limpiarSeccion(s) {
  return {
    id: cortar(s.id, 40),
    titulo: cortar(s.titulo, 120),
    texto: cortar(s.texto, 900),
    oculta: !!s.oculta,
  };
}

function limpiar(area, cuerpo) {
  if (area === "esteticas") {
    if (!Array.isArray(cuerpo)) return { error: "Las estéticas tienen que venir en una lista." };
    if (cuerpo.length > 40) return { error: "Cuarenta estéticas es el tope." };
    const vistas = new Set(), salida = [];
    for (const e of cuerpo) {
      const r = limpiarEstetica(e || {});
      if (r.error) return r;
      if (vistas.has(r.fila.k)) return { error: "Hay dos estéticas con el mismo nombre corto: " + r.fila.k };
      vistas.add(r.fila.k);
      salida.push(r.fila);
    }
    return { valor: salida };
  }
  if (area === "secciones") {
    if (!Array.isArray(cuerpo)) return { error: "Las secciones tienen que venir en una lista." };
    return { valor: cuerpo.slice(0, 80).map(limpiarSeccion).filter((s) => s.id) };
  }
  if (area === "marca") {
    const m = cuerpo || {};
    return { valor: {
      paleta: limpiarPaleta(m.paleta),
      curva: Math.max(0, Math.min(40, Number(m.curva) || 18)),
      grano: Math.max(0, Math.min(0.2, Number(m.grano) || 0.045)),
      titular: cortar(m.titular, 60) || "Anton",
      texto: cortar(m.texto, 60) || "Barlow",
    } };
  }
  return { error: "Esa área no existe." };
}

/* ------------------------------------------------------------------ leer */
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const pedida = u.searchParams.get("area");
  if (!env.DB) return json({ areas: {} });
  await tablas(env);

  if (u.searchParams.get("historial")) {
    if (!(await exigirSesion(request, env))) return json({ error: "Volvé a iniciar sesión." }, 401);
    const r = await env.DB.prepare(
      "SELECT id, area, tocado, quien FROM sitio_historial WHERE area = ? ORDER BY id DESC LIMIT 20"
    ).bind(cortar(pedida, 32)).all();
    return json({ historial: r.results || [] });
  }

  const areas = {};
  const filas = await env.DB.prepare("SELECT area, valor, tocado FROM sitio").all();
  for (const f of filas.results || []) {
    if (pedida && f.area !== pedida) continue;
    try { areas[f.area] = JSON.parse(f.valor); } catch { /* una fila rota no tumba el resto */ }
  }
  const ultimo = (filas.results || []).reduce((a, f) => Math.max(a, f.tocado || 0), 0);
  return new Response(JSON.stringify({ areas, tocado: ultimo }), {
    headers: { "Access-Control-Allow-Origin": "*",
               "Content-Type": "application/json; charset=utf-8",
               /* medio minuto: el dueño toca "guardar" y quiere verlo ya, pero
                  tampoco hace falta pegarle a la base en cada visita */
               "Cache-Control": "public, max-age=30" } });
}

/* ---------------------------------------------------------------- guardar */
export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const usuario = await exigirSesion(request, env);
  if (!usuario) return json({ error: "Volvé a iniciar sesión." }, 401);
  await tablas(env);

  let b; try { b = await request.json(); } catch { return json({ error: "cuerpo inválido" }, 400); }
  const area = cortar(b.area, 32);
  if (!AREAS.includes(area)) return json({ error: "Esa área no existe." }, 400);

  const r = limpiar(area, b.valor);
  if (r.error) return json({ error: r.error }, 400);
  const texto = JSON.stringify(r.valor);
  if (texto.length > TOPE) return json({ error: "Quedó demasiado grande para guardarlo de una." }, 400);

  const ahora = Date.now();
  const antes = await env.DB.prepare("SELECT valor, tocado, quien FROM sitio WHERE area = ?").bind(area).first();
  const pasos = [];
  if (antes) {
    pasos.push(env.DB.prepare(
      "INSERT INTO sitio_historial (area, valor, tocado, quien) VALUES (?,?,?,?)"
    ).bind(area, antes.valor, antes.tocado, antes.quien || ""));
  }
  pasos.push(env.DB.prepare(
    `INSERT INTO sitio (area, valor, tocado, quien) VALUES (?,?,?,?)
     ON CONFLICT(area) DO UPDATE SET valor = excluded.valor, tocado = excluded.tocado, quien = excluded.quien`
  ).bind(area, texto, ahora, usuario));
  pasos.push(env.DB.prepare(
    `DELETE FROM sitio_historial WHERE area = ? AND id NOT IN
       (SELECT id FROM sitio_historial WHERE area = ? ORDER BY id DESC LIMIT ?)`
  ).bind(area, area, GUARDA));
  await env.DB.batch(pasos);
  return json({ ok: true, area, tocado: ahora, valor: r.valor });
}

/* --------------------------------------------------------------- deshacer */
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "sin base de datos" }, 503);
  const usuario = await exigirSesion(request, env);
  if (!usuario) return json({ error: "Volvé a iniciar sesión." }, 401);
  await tablas(env);

  let b; try { b = await request.json(); } catch { b = {}; }
  const area = cortar(b.area, 32);
  if (!AREAS.includes(area)) return json({ error: "Esa área no existe." }, 400);

  /* Se puede volver a UNA versión concreta del historial o, sin id, a la
     anterior. Volver también deja historial: deshacer un deshacer tiene que
     poder deshacerse. */
  const fila = b.id
    ? await env.DB.prepare("SELECT valor FROM sitio_historial WHERE id = ? AND area = ?").bind(Number(b.id), area).first()
    : await env.DB.prepare("SELECT valor FROM sitio_historial WHERE area = ? ORDER BY id DESC LIMIT 1").bind(area).first();
  if (!fila) return json({ error: "No hay nada a lo que volver." }, 404);

  const ahora = Date.now();
  const actual = await env.DB.prepare("SELECT valor, tocado, quien FROM sitio WHERE area = ?").bind(area).first();
  const pasos = [];
  if (actual) {
    pasos.push(env.DB.prepare(
      "INSERT INTO sitio_historial (area, valor, tocado, quien) VALUES (?,?,?,?)"
    ).bind(area, actual.valor, actual.tocado, actual.quien || ""));
  }
  pasos.push(env.DB.prepare(
    `INSERT INTO sitio (area, valor, tocado, quien) VALUES (?,?,?,?)
     ON CONFLICT(area) DO UPDATE SET valor = excluded.valor, tocado = excluded.tocado, quien = excluded.quien`
  ).bind(area, fila.valor, ahora, usuario));
  await env.DB.batch(pasos);
  let valor = null; try { valor = JSON.parse(fila.valor); } catch {}
  return json({ ok: true, area, valor });
}
