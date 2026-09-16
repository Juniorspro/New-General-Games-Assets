/* El catálogo de la tienda: leerlo lo puede cualquiera que tenga acceso, y
 * cargarlo sólo el jefe.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. El catálogo vivía adentro de `aeromas.js`, así
 * que publicar una app era editar código y desplegar. O sea que el dueño del
 * sitio no podía subir nada sin que otro le tocara el repositorio: una tienda
 * que sólo carga el que programa no es una tienda, es una lista.
 *
 * LAS DOS FORMAS DE PONER EL ARCHIVO NO SON LA MISMA COSA, y esto es lo único
 * importante de todo el archivo:
 *
 *   `archivo` — vive en /apps/ de este sitio y pasa por la puerta de
 *               `functions/apps/`: sin pase válido contesta 403. Es lo único
 *               que de verdad queda para los que colaboraron. Hay que
 *               desplegarlo, o sea que lo carga quien tenga el repositorio.
 *
 *   `enlace`  — vive afuera (MediaFire, Drive, lo que sea). Se carga en el
 *               momento y sin desplegar nada, pero ES PÚBLICO: cualquiera con
 *               el link lo baja, tenga cuenta o no. La pantalla lo dice con
 *               todas las letras antes de guardar, porque es una decisión de
 *               quien publica y no un detalle técnico que se pueda esconder.
 *
 * Si están los dos, manda `archivo`, que es el que protege.
 */
import { quienEs, limpio, json } from "./_social.js";
import { esEditor } from "./editor.js";

const TOPE_APPS = 60;
const TOPE_PENDIENTES = 3;   /* propuestas sin revisar por persona */

/* PUBLICAR UNA APP PAGA PIDE LA CUOTA AL DIA. Se comprueba acá, del lado del
   servidor, y en los dos caminos —proponer y guardar—: si viviera en la
   pantalla, destildar una casilla desde la consola alcanzaría para publicar
   gratis lo que se cobra. Lo que se cobra es PUBLICAR: la plata de las ventas
   va del que compra al que hizo la app, por afuera de este sitio. */
async function puedeCobrar(env, u, quiereCobrar) {
  if (!quiereCobrar) return null;
  if (await esEditor(env, u.id)) return null;
  return json({ error: "Para publicar una app que cobra hace falta la cuota de " +
                       "editor al día. Se paga desde la Tienda." }, 402);
}

/* Un sha256 en hexadecimal y nada más. */
const HUELLA_VALE = /^[a-f0-9]{64}$/i;

async function quienSos(env, request) {
  const yo = await quienEs(env, request);
  if (!yo) return null;
  const u = await env.DB.prepare(
    "SELECT id, acceso, jefe, bloqueado FROM usuarios WHERE id = ?").bind(yo.u).first();
  if (!u || u.bloqueado) return null;
  return (u.acceso || u.jefe) ? u : null;
}

/* Un nombre de archivo y nada más. Esto se pega adentro de «/apps/<archivo>»,
   así que una barra o un «..» acá serían una forma de pedir cualquier cosa del
   sitio desde una fila de la base. */
const ARCHIVO_VALE = /^[A-Za-z0-9._-]{1,120}$/;

/* Sólo http y https. El enlace termina en el `href` de un botón: un
   `javascript:` guardado en la base sería código de alguien ejecutándose en la
   pantalla del que entra. Se comprueba acá aunque la página también lo mire,
   porque la página se puede saltear y esto no. */
function enlaceVale(u) {
  if (!u) return true;                       /* vacío es válido: no hay enlace */
  if (u.length > 500) return false;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:";
  } catch { return false; }
}

export const onRequestGet = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);
  const u = await quienSos(env, request);
  if (!u) return json({ error: "Esto es para los que colaboraron." }, 403);
  const t = await leerTienda(env, u);
  return json({ ...t, jefe: !!u.jefe, hayRevision: !!env.VIRUSTOTAL, topePropias: TOPE_PENDIENTES });
};

const FILAS = "id, nombre, version, que, para, peso, archivo, enlace, icono, " +
              "permisos, aviso, origen, estado, motivo, huella, escaneo, escaneo_cuando, " +
              "autor, paga, precio";

function acomodar(a, quien) {
  return {
    ...a,
    /* los permisos se guardan uno por línea y viajan como lista: la pantalla no
       tiene por qué saber cómo están guardados */
    permisos: String(a.permisos || "").split("\n").map((x) => x.trim()).filter(Boolean),
    mia: !!(quien && a.autor === quien.id),
    /* el número de quién la propuso no le sirve a nadie del otro lado y es un
       dato de una persona: se manda si es tuya o si sos el jefe, y si no, no */
    autor: quien && (quien.jefe || a.autor === quien.id) ? a.autor : undefined,
  };
}

/* LO QUE VE CADA UNO. Sólo lo aprobado se muestra en la tienda. Lo que está
   esperando revisión lo ve el jefe —que es quien la hace— y quien lo propuso
   —que si no, manda algo y no vuelve a saber nada de eso nunca más—. */
export async function leerTienda(env, quien) {
  const { results } = await env.DB.prepare(
    "SELECT " + FILAS + " FROM tienda ORDER BY orden, id").all();
  const todas = (results || []).map((a) => acomodar(a, quien));
  const puedeVer = (a) => a.estado === "aprobada" ||
    (quien && (quien.jefe || a.autor === quien.id));
  return {
    sitio:     todas.filter((a) => a.origen === "sitio" && a.estado === "aprobada"),
    comunidad: todas.filter((a) => a.origen === "comunidad" && a.estado === "aprobada"),
    esperando: todas.filter((a) => a.estado !== "aprobada" && puedeVer(a)),
  };
}

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);
  const u = await quienSos(env, request);
  if (!u) return json({ error: "Esto es para los que colaboraron." }, 403);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  /* proponer lo puede cualquiera que tenga acceso; todo lo demás, sólo el jefe */
  if (c.hacer === "proponer") return proponer(env, c, u);
  if (!u.jefe) return json({ error: "Eso lo hace el dueño del sitio." }, 403);
  if (c.hacer === "revisar")  return revisar(env, c, u);
  if (c.hacer === "escanear") return escanear(env, c, u);

  if (c.hacer === "borrar") {
    const id = parseInt(c.id, 10);
    if (!id) return json({ error: "cuál" }, 400);
    await env.DB.prepare("DELETE FROM tienda WHERE id = ?").bind(id).run();
    return json({ tienda: await leerTienda(env) });
  }

  if (c.hacer !== "guardar") return json({ error: "no sé hacer eso" }, 400);

  const nombre = limpio(c.nombre, 60);
  if (nombre.length < 2) return json({ error: "Ponele un nombre a la app." }, 400);

  const archivo = limpio(c.archivo, 120);
  if (archivo && !ARCHIVO_VALE.test(archivo)) {
    return json({ error: "El nombre del archivo sólo puede tener letras, números, punto, guion y guion bajo." }, 400);
  }

  const enlace = limpio(c.enlace, 500);
  if (!enlaceVale(enlace)) {
    return json({ error: "El enlace tiene que empezar con https:// (o http://)." }, 400);
  }
  if (!archivo && !enlace) {
    return json({ error: "Falta de dónde se baja: un archivo de /apps/ o un enlace." }, 400);
  }

  /* los permisos llegan como texto de varias líneas y se guardan igual */
  const permisos = String(c.permisos == null ? "" : c.permisos)
    .split("\n").map((x) => limpio(x, 120)).filter(Boolean).slice(0, 12).join("\n");

  const paga = c.paga ? 1 : 0;
  const noPuede = await puedeCobrar(env, u, paga);
  if (noPuede) return noPuede;

  const campos = {
    nombre,
    version: limpio(c.version, 30),
    que: limpio(c.que, 400),
    para: limpio(c.para, 40),
    peso: limpio(c.peso, 20),
    archivo, enlace,
    icono: limpio(c.icono, 200),
    permisos,
    aviso: limpio(c.aviso, 400),
    orden: Math.min(999, Math.max(0, parseInt(c.orden, 10) || 0)),
    paga, precio: limpio(c.precio, 40),
  };

  const id = parseInt(c.id, 10);
  const ahora = Date.now();

  if (id) {
    await env.DB.prepare(
      "UPDATE tienda SET nombre=?, version=?, que=?, para=?, peso=?, archivo=?, " +
      "enlace=?, icono=?, permisos=?, aviso=?, orden=?, paga=?, precio=?, tocado=? WHERE id=?")
      .bind(campos.nombre, campos.version, campos.que, campos.para, campos.peso,
            campos.archivo, campos.enlace, campos.icono, campos.permisos,
            campos.aviso, campos.orden, campos.paga, campos.precio, ahora, id).run();
  } else {
    /* un tope, porque una tienda de mil filas es una base llena por accidente */
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM tienda").first();
    if (n.n >= TOPE_APPS) return json({ error: "Ya hay " + TOPE_APPS + " apps; borrá alguna." }, 400);
    await env.DB.prepare(
      "INSERT INTO tienda (nombre, version, que, para, peso, archivo, enlace, " +
      "icono, permisos, aviso, orden, creado, tocado, autor, origen, estado, huella, " +
      "paga, precio) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'sitio','aprobada',?,?,?)")
      .bind(campos.nombre, campos.version, campos.que, campos.para, campos.peso,
            campos.archivo, campos.enlace, campos.icono, campos.permisos,
            campos.aviso, campos.orden, ahora, ahora, u.id,
            HUELLA_VALE.test(String(c.huella || "")) ? String(c.huella).toLowerCase() : "",
            campos.paga, campos.precio).run();
  }

  return json(await leerTienda(env, u));
};

/* ------------------------------------------------------- proponer una app
   Cualquiera que tenga acceso puede mandar una, y queda esperando revisión.

   LA HUELLA ES OBLIGATORIA Y NO ES BUROCRACIA. Una app de la comunidad se
   publica con un enlace a otro sitio, o sea que nosotros no tenemos el archivo:
   sin el sha256 no hay NADA que revisar —mirar la página de descarga y decir
   «sin virus» sería inventar una seguridad que no existe—. Con la huella se le
   puede preguntar a un servicio de análisis por ese archivo exacto, y además
   cualquiera que lo baje puede sacarle el sha256 al suyo y comparar: si el
   enlace cambia por otro archivo, se nota. */
async function proponer(env, c, u) {
  const nombre = limpio(c.nombre, 60);
  if (nombre.length < 2) return json({ error: "Ponele un nombre a la app." }, 400);

  const enlace = limpio(c.enlace, 500);
  if (!enlace) return json({ error: "Falta el enlace de descarga." }, 400);
  if (!enlaceVale(enlace)) {
    return json({ error: "El enlace tiene que empezar con https:// (o http://)." }, 400);
  }

  const huella = String(c.huella || "").toLowerCase();
  if (!HUELLA_VALE.test(huella)) {
    return json({ error: "Falta la huella del archivo. Elegí el APK en el formulario: " +
                         "se calcula en tu máquina y no se sube a ningún lado. Sin eso " +
                         "no hay forma de revisar lo que estás compartiendo." }, 400);
  }

  const n = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM tienda WHERE autor = ? AND estado = 'pendiente'")
    .bind(u.id).first();
  if (n.n >= TOPE_PENDIENTES) {
    return json({ error: "Ya tenés " + TOPE_PENDIENTES + " esperando revisión. " +
                         "Esperá a que se revisen esas." }, 429);
  }

  const paga = c.paga ? 1 : 0;
  const noPuede = await puedeCobrar(env, u, paga);
  if (noPuede) return noPuede;

  const permisos = String(c.permisos == null ? "" : c.permisos)
    .split("\n").map((x) => limpio(x, 120)).filter(Boolean).slice(0, 12).join("\n");
  const ahora = Date.now();

  await env.DB.prepare(
    "INSERT INTO tienda (nombre, version, que, para, peso, archivo, enlace, icono, " +
    "permisos, aviso, orden, creado, tocado, autor, origen, estado, huella, paga, precio) " +
    "VALUES (?,?,?,?,?,'',?,'',?,?,500,?,?,?,'comunidad','pendiente',?,?,?)")
    .bind(nombre, limpio(c.version, 30), limpio(c.que, 400), limpio(c.para, 40),
          limpio(c.peso, 20), enlace, permisos, limpio(c.aviso, 400),
          ahora, ahora, u.id, huella, paga, limpio(c.precio, 40)).run();

  return json(await leerTienda(env, u));
}

/* ------------------------------------------------------- aprobar o rechazar
   Rechazar PIDE un motivo. Un rechazo sin motivo deja a la persona sin saber si
   le faltó un dato o si le encontraron algo, y la única salida que le queda es
   volver a mandar lo mismo. */
async function revisar(env, c, u) {
  const id = parseInt(c.id, 10);
  if (!id) return json({ error: "cuál" }, 400);
  const aprobar = c.decision === "aprobar";
  const motivo = limpio(c.motivo, 300);
  if (!aprobar && motivo.length < 3) {
    return json({ error: "Decile por qué la rechazás: si no, sólo va a volver a mandarla igual." }, 400);
  }
  await env.DB.prepare(
    "UPDATE tienda SET estado = ?, motivo = ?, revisada = ?, tocado = ? WHERE id = ?")
    .bind(aprobar ? "aprobada" : "rechazada", aprobar ? "" : motivo,
          Date.now(), Date.now(), id).run();
  return json(await leerTienda(env, u));
}

/* ------------------------------------------------- preguntar por la huella
   Se le pregunta a VirusTotal por ESE archivo exacto. Tres resultados posibles
   y los tres se guardan tal cual:

   · lo conoce y lo marcan          -> cuántos motores y cuáles
   · lo conoce y no lo marca nadie  -> eso sí es una revisión pasada
   · NO LO CONOCE                   -> no es «limpio». Es que nadie lo analizó
     todavía, que es lo más común con una app recién hecha. Guardar eso como
     verde sería el peor error posible acá: convertir «no sabemos» en «está
     bien» justo en la pantalla donde alguien decide instalar algo. */
async function escanear(env, c, u) {
  const id = parseInt(c.id, 10);
  if (!id) return json({ error: "cuál" }, 400);
  const a = await env.DB.prepare("SELECT id, huella FROM tienda WHERE id = ?").bind(id).first();
  if (!a) return json({ error: "no está" }, 404);
  if (!HUELLA_VALE.test(String(a.huella || ""))) {
    return json({ error: "Esta app no tiene huella, así que no hay nada que preguntar." }, 400);
  }
  if (!env.VIRUSTOTAL) {
    return json({ error: "Todavía no hay revisión automática configurada (falta la llave de VirusTotal)." }, 503);
  }

  let texto;
  try {
    const r = await fetch("https://www.virustotal.com/api/v3/files/" + a.huella,
      { headers: { "x-apikey": env.VIRUSTOTAL } });
    if (r.status === 404) {
      texto = "No lo conoce: nadie lo analizó todavía. Eso NO quiere decir que esté limpio.";
    } else if (!r.ok) {
      texto = "No se pudo preguntar (error " + r.status + ").";
    } else {
      const j = await r.json();
      const e = (j.data && j.data.attributes && j.data.attributes.last_analysis_stats) || {};
      const malos = (e.malicious || 0) + (e.suspicious || 0);
      const total = malos + (e.harmless || 0) + (e.undetected || 0);
      texto = malos > 0
        ? "Lo marcan " + malos + " de " + total + " motores. No lo publiques."
        : "Ninguno de los " + total + " motores lo marca.";
    }
  } catch (e) {
    texto = "No se pudo preguntar (no hubo respuesta).";
  }

  await env.DB.prepare("UPDATE tienda SET escaneo = ?, escaneo_cuando = ? WHERE id = ?")
    .bind(texto, Date.now(), id).run();
  return json(await leerTienda(env, u));
}
