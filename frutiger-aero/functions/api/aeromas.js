/* Aero+, la zona de donantes: lo que hay adentro y lo que cada uno se guarda.
 *
 * EL ACCESO SE PREGUNTA ACÁ, NO SE CREE. La pantalla puede mentir —basta con
 * abrir la consola y poner `acceso = true`— así que cada respuesta de este
 * archivo mira la columna `acceso` de la base antes de contestar. Si alguien
 * fuerza la interfaz, la ve vacía: no hay nada que sacar de una pantalla que no
 * trae los datos.
 *
 * LO QUE SE PERSONALIZA SE GUARDA EN LA CUENTA, NO EN EL NAVEGADOR. El marco y
 * la banda se ven en el muro, o sea que los tiene que ver otra gente: guardarlos
 * en `localStorage` sería que cada uno se viera lindo solo para sí mismo. El
 * tema del escritorio sí es de cada uno, pero también va en la cuenta, para que
 * te siga cuando entrás desde el teléfono.
 */
import { quienEs, limpio, json } from "./_social.js";
import { darPase } from "./_firma.js";
import { leerTienda } from "./tienda.js";

/* Lo que se puede elegir vive acá y NO en el navegador. Si la lista estuviera
   del lado de la página, cualquiera podría pedir «marco: el-que-yo-invente» y
   guardarlo; después el muro pinta eso y ya es un agujero para todos los que
   miren. Se comprueba contra estas listas y lo que no está, no entra. */
export const MARCOS = ["", "agua", "oro", "vidrio"];
export const BANDAS = ["", "cristal", "pasto", "nocturno", "oceano", "cielo"];
export const FONDOS = ["cristal", "pasto", "nocturno", "oceano", "cielo"];

/* LA TIENDA YA NO VIVE ACÁ. Estaba escrita como una constante en este archivo,
   así que publicar una app era editar código y desplegar: el dueño del sitio no
   podía cargar nada por su cuenta. Ahora el catálogo está en la tabla `tienda`
   y lo lee `./tienda.js`, que además es el único que lo deja escribir —y sólo
   al jefe—. Se sigue mandando desde acá en la misma respuesta para no hacer dos
   viajes al abrir Aero+. */

const APPS = [
  { id: "temas",   nombre: "Estudio de temas",  icono: "i-vidrio",
    que: "Cambiá el fondo, el color del vidrio y guardalo en tu cuenta." },
  { id: "perfil",  nombre: "Perfil+",           icono: "i-personaje",
    que: "Marco del retrato, banda y lema. Se ve en el muro." },
  { id: "galeria", nombre: "Galería",           icono: "i-ventana",
    que: "Los fondos en grande, para bajar y usar donde quieras." },
  { id: "fabrica", nombre: "Fábrica de fondos",  icono: "i-fabrica",
    que: "Pedí un fondo con palabras y la máquina te lo dibuja." },
  { id: "tienda",  nombre: "Tienda",            icono: "i-orbe",
    que: "Las apps que hago, gratis para vos por haber colaborado." },
];

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
    "SELECT id, usuario, nombre, acceso, jefe, bloqueado, marco, banda, lema, tema, zona_desde " +
    "FROM usuarios WHERE id = ?").bind(yo.u).first();
  return u && (u.acceso || u.jefe) && !u.bloqueado ? u : null;
}

export const onRequestGet = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);
  const u = await donante(env, request);
  if (!u) return json({ error: "Esto es para los que colaboraron." }, 403);

  /* la primera vez se anota, y sirve para saludar distinto */
  let estrena = false;
  if (!u.zona_desde) {
    estrena = true;
    await env.DB.prepare("UPDATE usuarios SET zona_desde = ? WHERE id = ?")
      .bind(Date.now(), u.id).run();
  }

  const n = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM usuarios WHERE zona_desde IS NOT NULL").first();

  /* `leerTienda` ya devuelve {sitio, comunidad, esperando} y filtra por quién
     pregunta: lo que espera revisión lo ve el jefe y quien lo propuso, nadie más */
  const t = await leerTienda(env, u);
  return json({ apps: APPS, tienda: t.sitio, comunidad: t.comunidad,
                esperando: t.esperando, hayRevision: !!env.VIRUSTOTAL,
                pase: await darPase(env.SECRETO, { u: u.id }, 2),
                fondos: FONDOS, marcos: MARCOS.filter(Boolean),
                bandas: BANDAS.filter(Boolean), estrena, cuantos: n.n,
                /* la pantalla necesita saberlo para mostrar el panel de carga;
                   que se pueda mentir del lado del navegador no importa, porque
                   quien decide si la carga entra es `tienda.js` */
                jefe: !!u.jefe,
                yo: { usuario: u.usuario, nombre: u.nombre, marco: u.marco,
                      banda: u.banda, lema: u.lema, tema: u.tema } });
};

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB || !env.SECRETO) return json({ error: "sin configurar" }, 503);
  const u = await donante(env, request);
  if (!u) return json({ error: "Esto es para los que colaboraron." }, 403);

  let c;
  try { c = await request.json(); } catch { return json({ error: "cuerpo ilegible" }, 400); }

  if (c.hacer === "guardar") {
    const marco = MARCOS.includes(c.marco) ? c.marco : "";
    const banda = BANDAS.includes(c.banda) ? c.banda : "";
    const lema = limpio(c.lema, 80);

    /* el tema es del navegador y no lo mira nadie más, pero igual se recorta:
       una cadena sin tope es una forma barata de llenarle la base a alguien */
    let tema = "";
    try {
      const t = JSON.parse(String(c.tema || "{}"));
      tema = JSON.stringify({
        fondo: FONDOS.includes(t.fondo) ? t.fondo : "cristal",
        tono: Math.min(360, Math.max(0, parseInt(t.tono, 10) || 210)),
        sat: Math.min(100, Math.max(0, parseInt(t.sat, 10) || 52)),
        vidrio: Math.min(100, Math.max(0, parseInt(t.vidrio, 10) || 82)),
      });
    } catch { tema = ""; }

    await env.DB.prepare(
      "UPDATE usuarios SET marco = ?, banda = ?, lema = ?, tema = ? WHERE id = ?")
      .bind(marco, banda, lema, tema, u.id).run();
    return json({ ok: true, marco, banda, lema, tema });
  }

  return json({ error: "no sé qué hacer" }, 400);
};
