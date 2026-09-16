import { leerFecha, casoNormal } from "./_pub.js";
import { pedirIA } from "./_modelos.js";

/* ---------------------------------------------------------------------------
   Lo que convierte texto suelto (y el flyer, si hay) en una publicación.
   Lo usan las dos rutas que piensan: /api/asistente, cuando el dueño le cuenta
   algo, y /api/sugerir, cuando el botón «Nuevo» lee los posteos de Instagram.
   Está acá y no repetido en cada una porque cada arreglo de calidad tiene que
   valer para las dos.
   --------------------------------------------------------------------------- */

export const COLORES = ["magenta","violeta","oro","verde","cian","rojo","naranja","blanco"];

const ESQUEMA = {
  type: "object",
  properties: {
    titulo: { type: "string",
      description: "Nombre corto de la fiesta, dos a seis palabras, sin emojis ni hashtags ni arrobas ni " +
        "comillas. Ej: Halloween 2026, Cowboy Night, Fiesta Zonal de la Primavera. OJO: «IBLO», «IbLo» e " +
        "«IBLO Eventos» son la productora que organiza, NUNCA el nombre de la fiesta. Nunca copies el texto " +
        "entero acá, ni una descripción de colores o de estética." },
    subtitulo: { type: "string",
      description: "Bajada de cuatro a ocho palabras. Vacío si no hay con qué armarla." },
    fecha: { type: "string",
      description: "La fecha del evento en formato DD.MM.AA, por ejemplo 25.10.26. Vacío si el texto no dice fecha." },
    cuando: { type: "string",
      description: "La misma fecha y hora en formato AAAA-MM-DDTHH:MM de 24 horas, por ejemplo 2026-10-25T00:00. Si no dijeron hora usá 22:00. Vacío si no hay fecha." },
    lugar: { type: "string",
      description: "Dónde es, tal como lo nombraron. Ej: Club Juventud. Vacío si no lo dicen." },
    hora: { type: "string",
      description: "La hora tal como la dijeron, por ejemplo '00:00 hs' o 'open 00:30'. Vacío si no la dicen." },
    detalle: { type: "string",
      description: "Dos o tres frases en español rioplatense con voseo, con energía pero sin exagerar, usando SOLO datos del texto. Sin emojis, sin hashtags, sin comillas." },
    precio: { type: "string",
      description: "El precio tal como lo dijeron, con signo $ y separador de miles. Ej: $10.000 general. Vacío si no hablan de plata." },
    color: { type: "string", enum: COLORES,
      description: "El que pegue con la temática: Halloween rojo, primavera o realeza oro, cowboy o wéstern naranja, invierno o hielo cian, glitter o euphoria violeta. Si no hay pista, magenta." },
  },
  required: ["titulo","subtitulo","fecha","cuando","lugar","hora","detalle","precio","color"],
};

/* El modelo a veces escribe la palabra «falta» en vez de dejar el campo vacío. */
const VACIO = /^(falta|faltante|no especificado|sin datos|n\/?a|ninguno|desconocido|-{1,3})$/i;
const limpiar = (v, n) => {
  const t = String(v == null ? "" : v)
    /* el modelo a veces escapa comillas y acentos y quedaba «Margarita Bel\'en» */
    .replace(/\\(['"`])/g, "$1")
    .replace(/\\(?=[a-záéíóúñ])/gi, "")
    .replace(/^["'\s,.:;]+|["'\s,.:;]+$/g, "")
    .slice(0, n);
  return VACIO.test(t) ? "" : t;
};
/* los pies de foto de Instagram vienen cargados de emojis, hashtags y arrobas */
export const sinAdornos = (t) =>
  String(t || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/#[\wÀ-ſ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/* El modelo devuelve «8000» o «8 mil» tan seguido como «$8.000». Lo dejamos
   siempre con signo y separador de miles, que es como se lee un precio acá. */
export function precioSano(v) {
  let t = limpiar(v, 60);
  if (!t) return "";
  t = t.replace(/\b(\d{1,3})\s*mil\b/gi, (_, n) => String(+n * 1000));
  /* sin \s en el patrón: si se come el espacio de antes queda «y$15.000» */
  return t.replace(/(\$ ?)?(\d[\d.,]*)/g, (todo, signo, num) => {
    const digitos = num.replace(/\D/g, "");
    if (!digitos || digitos.length > 9) return todo;
    const n = Number(digitos);
    if (n < 100) return todo;                      // «2x1», «$50» no se tocan
    return "$" + n.toLocaleString("es-AR");
  }).trim();
}

/* Un título de más de ocho palabras es el texto entero copiado, no un nombre. */
function tituloSano(t) {
  const limpio = limpiar(t, 90).replace(/@\S+/g, "").replace(/\s+/g, " ").trim();
  if (!limpio) return "";
  if (limpio.split(" ").length > 8) return "";
  if (/^ib\s*lo( eventos)?$/i.test(limpio)) return "";   // es la productora, no la fiesta
  return casoNormal(limpio);
}

/* El modelo completa bien lugar, hora y fecha pero cada dos por tres deja
   `titulo` vacío y mete el nombre de la fiesta en `detalle`. Visto y medido: de
   seis lecturas de la misma historia, tres salían así. En vez de reintentar y
   rezar, lo buscamos donde lo pone. */
function rescatarTitulo(d, delFlyer) {
  const corto = (t) => {
    const v = limpiar(t, 90).replace(/@\S+/g, "").trim();
    return v && v.split(/\s+/).length <= 8 ? v : "";
  };
  const deDetalle = corto(d.detalle);
  if (deDetalle) return deDetalle;
  const deSub = corto(d.subtitulo);
  if (deSub) return deSub;
  /* última: el primer renglón del flyer que no sea una fecha, una hora o un precio */
  for (const linea of String(delFlyer || "").split("\n")) {
    const l = linea.replace(/^[^:]{0,22}:\s*/, "").trim();     // «Nombre de la fiesta: X»
    if (!l || l.length < 3) continue;
    if (/^\W*[\d.:/$-]+\W*$/.test(l)) continue;                 // 05.12.26, 23:00 HS, $9.000
    if (/^\s*(open|hora|fecha|lugar|precio|entradas?)\b/i.test(l)) continue;
    const v = corto(l);
    if (v) return v;
  }
  return "";
}

/* Mira el flyer y devuelve lo que dice, en texto plano. No decide nada. */
async function leerFlyer(env, imagen) {
  const r = await pedirIA(env, [{ role: "user", content: [
      { type: "text", text:
        "Es el flyer de una fiesta. Transcribí en castellano TODO el texto que se lee: nombre de la " +
        "fiesta, fecha, hora, lugar, precios, quién toca. Después, en una línea aparte que empiece con " +
        "«Onda:», describí en pocas palabras la estética (colores, temática). No inventes nada que no se lea." },
      { type: "image_url", image_url: { url: imagen } },
    ] }], { conImagen: true, tope: 400, calor: 0.1 });
  const t = String(r.texto || "").trim().slice(0, 1200);
  /* La línea «Onda:» es andamiaje nuestro, para elegir el color. Va aparte y bien
     rotulada: mezclada con la transcripción, el extractor la tomaba de título
     («Onda: azul oscuro a negro degradé» quedó como nombre de una fiesta). */
  const corte = t.search(/^\s*onda\s*:/im);
  if (corte < 0) return { texto: t, onda: "" };
  const antes = t.slice(0, corte).trim();
  const onda = t.slice(corte).replace(/^\s*onda\s*:/i, "").trim().slice(0, 120);
  /* A veces contesta sólo la estética y se olvida de transcribir. Mejor mandar
     todo junto que quedarse sin fuente. */
  return antes ? { texto: antes, onda } : { texto: t, onda: "" };
}

/* Escribe el texto del aviso. Suelto, no dentro del esquema: en modo json_schema
   el modelo contesta de dos palabras. */
async function escribirDetalle(env, p, fuente) {
  const datos = [
    "Evento: " + p.titulo,
    p.subtitulo ? "De qué va: " + p.subtitulo : "",
    p.fecha  ? "Fecha: " + p.fecha : "",
    p.lugar  ? "Lugar: " + p.lugar : "",
    p.hora   ? "Hora: " + p.hora : "",
    p.precio ? "Entradas: " + p.precio : "",
  ].filter(Boolean).join(". ");
  const r = await pedirIA(env, [
      { role: "system", content:
        "Escribís el texto de un aviso para IBLO Eventos, productora de fiestas de Margarita Belén, Chaco. " +
        "Español rioplatense con voseo, con energía pero sin exagerar. Dos o tres frases, máximo 45 palabras. " +
        "Usá SOLO los datos que te doy, no agregues ninguno. Sin emojis, sin hashtags, sin arrobas, " +
        "sin comillas. Devolvé únicamente el texto." },
      { role: "user", content: datos + "\n" + fuente },
    ], { tope: 200, calor: 0.55 });
  const t = String(r.texto || "").trim()
    .replace(/^["'«»]+|["'«»]+$/g, "").replace(/@\S+/g, "").replace(/\s+/g, " ");
  return t.length > 20 ? t.slice(0, 400) : "";
}

/* El plan gratis de Workers AI trae 10.000 «neuronas» por día y las lecturas de
   imagen las gastan rápido. Cuando se acaban, el error que devuelve no le dice
   nada al dueño, así que lo traducimos: no está roto, se repone mañana. */
export function traducirFalla(e) {
  const t = String((e && e.message) || e || "");
  if (/neurons|daily free allocation|exceeded.*limit|3040/i.test(t)) {
    return "Por hoy se acabó el cupo gratis de la IA. Se repone mañana. " +
           "Mientras tanto podés cargarla a mano.";
  }
  if (/capacity|overload|503|429/i.test(t)) {
    return "La IA está saturada en este momento. Probá en un rato.";
  }
  return "La IA no respondió. Probá de nuevo o cargalo a mano.";
}

/* Red de seguridad contra el invento. Si el modelo devuelve un título o una
   fecha que no aparecen por ningún lado en lo que le dimos, no es una lectura:
   es una alucinación. Pasó de verdad —con varias imágenes a la vez las llamadas
   se degradaban y copiaba el ejemplo que tenía el prompt— así que además de
   sacar el ejemplo, esto lo agarra venga de donde venga. */
function saleDeLaFuente(valor, fuente) {
  if (!valor) return true;
  const limpio = (t) => t.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, "");
  const f = limpio(fuente);
  /* alcanza con que dos palabras del título estén en la fuente */
  const palabras = valor.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  if (!palabras.length) return limpio(valor).length < 4 || f.includes(limpio(valor));
  const dentro = palabras.filter((w) => f.includes(limpio(w))).length;
  return dentro >= Math.min(2, palabras.length);
}

/* El corazón. Devuelve { propuesta, cuandoMs, leyoFlyer } o { error, codigo }. */
export async function proponer(env, texto, imagen, opc) {
  opc = opc || {};
  texto = sinAdornos(texto).slice(0, 900);
  if (!texto && !imagen) return { error: "Contame qué querés publicar.", codigo: 400 };

  let delFlyer = "", onda = "";
  if (imagen) {
    try { const l = await leerFlyer(env, imagen); delFlyer = l.texto; onda = l.onda; } catch {}
    /* Leer la imagen es el paso que más falla: un par de veces de cada cinco
       volvía casi vacío y la publicación se perdía por eso. Un reintento. */
    if (delFlyer.length < 15) {
      try { const l = await leerFlyer(env, imagen); if (l.texto.length > delFlyer.length) {
        delFlyer = l.texto; onda = l.onda || onda;
      } } catch {}
    }
  }

  const fuente = [
    texto ? "Lo que escribió el dueño: " + texto : "",
    delFlyer ? "Lo que dice el flyer que mandó: " + delFlyer : "",
    onda ? "Estética del flyer (esto es SÓLO para elegir el color, no es el nombre " +
           "de la fiesta ni va en ningún otro campo): " + onda : "",
  ].filter(Boolean).join("\n");
  if (!fuente) return { error: "No pude leer ni el texto ni la imagen. Escribime qué querés publicar.", codigo: 422 };

  /* De cuándo es el aviso, no de cuándo lo estamos mirando.

     Un posteo de Instagram de mayo que dice «06/06» habla del 6 de junio de ESE
     año. Anclando en «hoy», en septiembre se leía como junio del año siguiente:
     una fiesta que ya pasó volvía a aparecer como próxima, y encima no la
     descartaba el filtro de fechas viejas porque la fecha había quedado en el
     futuro. Se vio con el FIESTÓN wéstern del 06/06/26, que reaparecía como
     06.06.27. Por eso el ancla es la fecha en que se publicó el aviso. */
  const ancla = Number(opc.desde) > 0 ? Number(opc.desde) : Date.now();
  const dia = new Date(ancla).toISOString().slice(0, 10);
  const sistema =
    "Extraés datos de avisos de fiestas de IBLO Eventos, una productora de Margarita Belén, Chaco. " +
    "Completás cada campo del esquema con lo que dice el texto. NO INVENTES: si un dato no está, dejá el campo vacío. " +
    "Este aviso se publicó el " + dia + "; si dicen día y mes sin año, usá el primer año en que ese " +
    "día y mes caen en esa fecha o después. Nunca un año más adelante que ése. " +
    "Si además te paso lo que dice un flyer y no coincide con lo que escribió el dueño, MANDA LO QUE ESCRIBIÓ EL DUEÑO: " +
    "el flyer sólo sirve para completar lo que él no dijo.";

  async function extraer(fuenteTexto, calor) {
    const r = await pedirIA(env, [
      { role: "system", content: sistema },
      { role: "user", content: fuenteTexto },
    ], { esquema: ESQUEMA, tope: 700, calor: calor == null ? 0.2 : calor });
    const crudo = r.texto;
    const a = crudo.indexOf("{"), z = crudo.lastIndexOf("}");
    if (a < 0 || z <= a) return null;
    try { return JSON.parse(crudo.slice(a, z + 1)); } catch { return null; }
  }

  let d = null;
  try {
    d = await extraer(fuente);
    /* Si el flyer contradice al dueño el modelo a veces se planta y devuelve el
       título vacío. En ese caso probamos otra vez con lo que él escribió, nada más. */
    if ((!d || !tituloSano(d.titulo)) && texto && delFlyer) {
      d = await extraer("Lo que escribió el dueño: " + texto);
    }
    /* Y si sigue sin título, un reintento en frío. Con fuentes cortas —una
       historia que sólo dice nombre, fecha y lugar— devolvía el título vacío
       dos de cada tres veces; con el reintento entra casi siempre. */
    if (!d || !tituloSano(d.titulo)) d = await extraer(fuente, 0);
  } catch (e) {
    return { error: traducirFalla(e), codigo: 502 };
  }
  if (!d) return { error: "No pude entender eso. Probá contándolo más simple.", codigo: 422 };

  if (!tituloSano(d.titulo)) {
    const rescatado = rescatarTitulo(d, delFlyer);
    /* si el nombre estaba en el detalle, ese campo se vuelve a escribir más abajo */
    if (rescatado) d = { ...d, titulo: rescatado };
  }

  const p = {
    titulo: tituloSano(d.titulo),
    subtitulo: casoNormal(limpiar(d.subtitulo, 90)),
    fecha: "",
    cuando: "",
    lugar: casoNormal(limpiar(d.lugar, 90)),
    hora: limpiar(d.hora, 30),
    detalle: limpiar(d.detalle, 400),
    precio: precioSano(d.precio),
    color: COLORES.indexOf(String(d.color || "").trim()) >= 0 ? String(d.color).trim() : "magenta",
  };

  /* La fecha la entendemos nosotros: el modelo la escribe en cualquier formato. */
  let fech = leerFecha(d.cuando, p.hora, ancla) || leerFecha(d.fecha, p.hora, ancla);

  /* Al modelo hay que corregirle el año igual. Aunque el sistema le diga de
     cuándo es el aviso, escribe el año que viene: «19/09» en una historia de
     septiembre salió como 19.09.27. Acá no se le pide, se le arregla: si la
     fecha cae a más de once meses del aviso, se rehace con el día y el mes
     solos, que es lo único que dijo la fuente. Once meses porque IBLO no
     anuncia una fiesta con un año de anticipación; el dueño sí puede escribir
     a mano la fecha que se le antoje, y eso no pasa por acá. */
  if (fech && fech.ms > ancla + 330 * 86400e3) {
    const cerca = leerFecha(fech.texto.slice(0, 5), p.hora, ancla);
    if (cerca) fech = cerca;
  }
  if (fech) {
    p.fecha = fech.texto;
    p.cuando = new Date(fech.ms - 3 * 3600e3).toISOString().slice(0, 16);
    if (!p.hora) p.hora = fech.hora;
  }

  /* «22:00» solo queda seco en la web; «22:00 hs» es como se dice */
  if (/^\d{1,2}[:.]\d{2}$/.test(p.hora)) p.hora = p.hora.replace(".", ":") + " hs";

  if (p.titulo && !saleDeLaFuente(p.titulo, fuente)) {
    return { error: "Lo que leí no coincide con lo que me mandaste. Probá de nuevo, de a una imagen.",
             codigo: 422 };
  }
  /* A la fecha NO se le aplica esta guardia: «6 de diciembre» sale como
     «06.12.26» y nunca va a coincidir literal con la fuente. Borraba fechas
     buenas. De la fecha ya se encarga `leerFecha`, que sólo acepta lo que el
     modelo escribió con forma de fecha. */

  if (!p.titulo) {
    return { error: imagen
      ? "De esa foto no saqué el nombre de la fiesta. Escribime abajo cómo se llama y de qué va."
      : "No saqué de ahí ni el nombre del evento. Contame un poco más.", codigo: 422 };
  }

  /* El tipo lo decide el código, no el modelo: en el esquema se equivocaba siempre.
     Igual pesa poco: en la web las solapas miran el contenido, así que una fiesta
     con entradas a la venta aparece en «Próximamente» y en «Entradas» a la vez. */
  p.tipo = fech ? "proximamente" : p.precio ? "entrada" : "aviso";

  /* La segunda llamada, la que redacta el aviso, es un tercio del tiempo total.
     Cuando esto es sólo un candidato que el dueño todavía no miró, no se hace:
     se redacta al publicar. Así buscar en Instagram es bastante más rápido. */
  if (!opc.sinRedactar) {
    try {
      const t = await escribirDetalle(env, p, fuente);
      if (t) p.detalle = t;
    } catch {}
  }

  /* Lo que falta lo sacamos de la salida, no de lo que diga el modelo:
     listaba campos que sí había completado. */
  const NOMBRES = { fecha:"la fecha", lugar:"el lugar", hora:"la hora", precio:"el precio",
                    subtitulo:"una bajada", detalle:"el texto" };
  p.falta = Object.keys(NOMBRES).filter((k) => !p[k]).map((k) => NOMBRES[k]);

  return { propuesta: p, cuandoMs: fech ? fech.ms : 0, leyoFlyer: !!delFlyer };
}
