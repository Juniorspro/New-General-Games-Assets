/* Todo lo que el dueño publica vive en una sola tabla: `publicaciones`.
   El `tipo` decide en qué solapa de la web aparece. */

export const TIPOS = ["proximamente", "entrada", "aviso"];

export const COLORES = {
  magenta: "#ff1e8e", violeta: "#c34bff", oro: "#e8bf4e", verde: "#2ce65a",
  cian: "#2fd8e8", rojo: "#ff2020", naranja: "#e8863a", blanco: "#f4f1f6",
};

export const CAMPOS =
  "id, tipo, titulo, subtitulo, detalle, fecha, cuando, lugar, hora, precio, color, imagen, " +
  "adorno, adorno_pos, destacado, creado";

/* El orden con el que se leen: lo que todavía no pasó primero y por fecha,
   y lo que no tiene fecha (los avisos) por cuándo se cargó. */
export const ORDEN =
  "ORDER BY (cuando IS NULL OR cuando = 0) ASC, cuando ASC, creado DESC";

/* Las solapas de la web no miran el `tipo`, miran el contenido. Así una fiesta
   con entradas a la venta sale en las dos y el dueño no tiene que elegir bien:
     próximamente → todo lo que tiene fecha y todavía no pasó
     entradas     → todo lo que tiene precio y sigue vigente
     avisos       → lo que no tiene ni fecha ni precio
   La gracia de las seis horas es que una fiesta no desaparece de la web
   mientras todavía se está haciendo. */
const GRACIA = 6 * 3600e3;

export function filtroSolapa(solapa, ahora = Date.now()) {
  const vigente = ahora - GRACIA;
  if (solapa === "proximamente")
    return { donde: "cuando > ?", args: [vigente],
             orden: "ORDER BY cuando ASC" };
  if (solapa === "entradas")
    return { donde: "precio <> '' AND (cuando = 0 OR cuando IS NULL OR cuando > ?)", args: [vigente],
             orden: "ORDER BY (cuando IS NULL OR cuando = 0) ASC, cuando ASC, creado DESC" };
  if (solapa === "avisos")
    return { donde: "(precio = '' OR precio IS NULL) AND (cuando = 0 OR cuando IS NULL)", args: [],
             orden: "ORDER BY creado DESC" };
  return { donde: "1 = 1", args: [], orden: ORDEN };
}
export const SOLAPAS = ["proximamente", "entradas", "avisos"];

const t = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

/* dónde se pega el adorno en la tarjeta */
export const ESQUINAS = ["der-arriba", "izq-arriba", "der-abajo", "izq-abajo"];

/* Deja el cuerpo del pedido listo para guardar. Devuelve {error} si algo no va. */
export function limpiarPublicacion(b) {
  const tipo = TIPOS.includes(b.tipo) ? b.tipo : "aviso";
  const titulo = t(b.titulo, 120);
  if (!titulo) return { error: "Falta el título." };

  const imagen = String(b.imagen || "");
  if (imagen && !/^data:image\/(webp|jpeg|png);base64,/.test(imagen))
    return { error: "La imagen no tiene un formato que podamos guardar." };
  if (imagen.length > 900000)
    return { error: "La imagen pesa demasiado, sacale peso o mandá otra." };

  /* el adorno es el recorte con fondo transparente que hizo la app */
  const adorno = String(b.adorno || "");
  if (adorno && !/^data:image\/(webp|png);base64,/.test(adorno))
    return { error: "El adorno tiene que ser un recorte con fondo transparente." };
  if (adorno.length > 500000)
    return { error: "El adorno pesa demasiado." };

  let cuando = Number(b.cuando || 0);
  if (!Number.isFinite(cuando) || cuando < 0) cuando = 0;

  return {
    fila: {
      tipo,
      titulo,
      subtitulo: t(b.subtitulo, 120),
      detalle: t(b.detalle, 1200),
      fecha: t(b.fecha, 30),
      cuando,
      lugar: t(b.lugar, 120),
      hora: t(b.hora, 30),
      precio: t(b.precio, 60),
      color: COLORES[b.color] ? b.color : "magenta",
      imagen,
      adorno,
      adorno_pos: ESQUINAS.indexOf(b.adorno_pos) >= 0 ? b.adorno_pos : "der-arriba",
      /* sólo un «próximamente» puede ocupar el cartel de la portada */
      destacado: tipo === "proximamente" && b.destacado !== false ? 1 : 0,
    },
  };
}

/* Guarda una publicación nueva. Si es la destacada, le saca el cartel a la anterior.
   `origen` es el código del posteo de Instagram del que salió, cuando salió de ahí:
   sirve para no volver a publicar el mismo dos veces. */
export async function guardar(env, fila, autor, origen) {
  const ahora = Date.now();
  if (fila.destacado) {
    await env.DB.prepare(
      "UPDATE publicaciones SET destacado = 0 WHERE destacado = 1"
    ).run();
  }
  const r = await env.DB.prepare(
    `INSERT INTO publicaciones
       (tipo, titulo, subtitulo, detalle, fecha, cuando, lugar, hora, precio,
        color, imagen, adorno, adorno_pos, destacado, estado, autor, creado, tocado, origen)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'publicada',?,?,?,?)`
  ).bind(
    fila.tipo, fila.titulo, fila.subtitulo, fila.detalle, fila.fecha, fila.cuando,
    fila.lugar, fila.hora, fila.precio, fila.color, fila.imagen,
    fila.adorno || "", fila.adorno_pos || "der-arriba", fila.destacado,
    autor, ahora, ahora, origen || null
  ).run();
  return r.meta?.last_row_id;
}

/* ---------------------------------------------------------------------------
   Fechas. El modelo escribe la fecha como se le canta: «2026-09-19T22:00»,
   «19/09/2026», «19.09.26», «19/09». Pedirle un formato exacto no alcanza, así
   que las entendemos todas acá y armamos nosotros el timestamp y el texto que
   se muestra. Siempre día primero, que es como se escribe acá.
   --------------------------------------------------------------------------- */

const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

/* saca la hora de un texto suelto: «22:00 hs», «open 00:30», «23hs» */
export function leerHora(txt) {
  const t = String(txt || "");
  let m = t.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (m) return { h: +m[1], m: +m[2] };
  m = t.match(/(\d{1,2})\s*(?:hs?\b|horas?\b)/i);
  if (m) return { h: +m[1], m: 0 };
  return null;
}

export function leerFecha(txt, hora, ahora = Date.now()) {
  const t = String(txt || "").trim();
  if (!t) return null;

  let a = null, me = null, d = null, h = null, mi = null;

  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) { a = +m[1]; me = +m[2]; d = +m[3]; if (m[4]) { h = +m[4]; mi = +m[5]; } }

  if (a === null) {
    m = t.match(/^(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?:\s*[/.\-]\s*(\d{2,4}))?/);
    if (m) {
      d = +m[1]; me = +m[2];
      if (m[3]) { a = +m[3]; if (a < 100) a += 2000; }
    }
  }
  /* y a veces la escribe con letras: «18 de julio de 2026» */
  if (d === null) {
    m = t.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóú]{3,10})(?:\s*(?:de\s+)?(\d{4}))?/i);
    if (m) {
      const tres = m[2].toLowerCase().slice(0, 3);
      const i = MESES.indexOf(tres === "set" ? "sep" : tres);
      if (i >= 0) { d = +m[1]; me = i + 1; if (m[3]) a = +m[3]; }
    }
  }
  if (d === null || me === null || d < 1 || d > 31 || me < 1 || me > 12) return null;

  /* la hora que dijeron aparte le gana a la que venga pegada a la fecha */
  const hs = leerHora(hora) || (h !== null ? { h, m: mi } : null) || { h: 22, m: 0 };
  if (hs.h > 23 || hs.m > 59) return null;

  /* sin año: el próximo que todavía no pasó */
  if (a === null) {
    const y = new Date(ahora).getFullYear();
    a = y;
    if (Date.UTC(a, me - 1, d, hs.h + 3, hs.m) < ahora - 12 * 3600e3) a = y + 1;
  }
  if (a < 2024 || a > 2100) return null;

  /* Chaco es UTC-3 todo el año */
  const ms = Date.UTC(a, me - 1, d, hs.h + 3, hs.m);
  if (!Number.isFinite(ms)) return null;

  return {
    ms,
    /* como se muestra en la web: 19.09.26 */
    texto: String(d).padStart(2, "0") + "." + String(me).padStart(2, "0") + "." + String(a).slice(2),
    hora: String(hs.h).padStart(2, "0") + ":" + String(hs.m).padStart(2, "0") + " hs",
  };
}

/* Los flyers vienen todos en mayúscula y el título quedaba GRITANDO.
   Sólo la baja si TODO el texto está en mayúscula; si el dueño escribió
   «Halloween IBLO» respetamos su mezcla. */
const CHICAS = new Set(["de","del","la","las","el","los","y","en","a","con","por","para","un","una"]);
/* siglas que se escriben en mayúscula aunque el resto baje */
const SIGLAS = new Set(["iblo","dj","djs","vip","mc","rrpp","led","after","bs","as"]);
export function casoNormal(t) {
  if (!t) return t;
  const puroAlto = t === t.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3}/.test(t);
  const puroBajo = t === t.toLowerCase() && /[a-záéíóúñ]{3}/.test(t);
  if (!puroAlto && !puroBajo) return t;
  return t.toLowerCase().split(/(\s+|[-/])/).map((p, i) => {
    if (!/[a-záéíóúñ]/.test(p)) return p;
    if (SIGLAS.has(p)) return p.toUpperCase();
    if (i > 0 && CHICAS.has(p)) return p;
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join("");
}
