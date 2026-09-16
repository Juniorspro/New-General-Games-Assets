// Motor de comandos. No sabe nada de WhatsApp: recibe texto, devuelve texto.
// Por eso sirve igual con el proveedor "web" que con "cloud", y se puede
// probar desde la terminal sin conectar ningún teléfono.

const ARRANQUE = Date.now();
let atendidos = 0;

const PREFIJO = "/";

// ── Utilidades ────────────────────────────────────────────────────────

function duracion(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const partes = [];
  if (d) partes.push(`${d} d`);
  if (h) partes.push(`${h} h`);
  if (m) partes.push(`${m} min`);
  partes.push(`${s % 60} s`);
  return partes.join(" ");
}

function tabla(filas) {
  const ancho = Math.max(...filas.map(([k]) => k.length));
  return filas.map(([k, v]) => `${k.padEnd(ancho)}  ${v}`).join("\n");
}

// ── Comandos ──────────────────────────────────────────────────────────
// Cada comando: { descripcion, uso, ejecutar(args, ctx) -> string | Promise<string> }

export const comandos = {
  bot: {
    descripcion: "Muestra este menú",
    uso: "/bot",
    ejecutar() {
      const lista = Object.entries(comandos)
        .map(([nombre, c]) => `• *${PREFIJO}${nombre}* — ${c.descripcion}\n   _${c.uso}_`)
        .join("\n");
      return (
        "🤖 *Bot activo*\n" +
        "Comandos de prueba disponibles:\n\n" +
        lista +
        "\n\nEscribe cualquiera de ellos en este chat."
      );
    },
  },

  ping: {
    descripcion: "Comprueba que el bot responde y mide la latencia",
    uso: "/ping",
    ejecutar(_args, ctx) {
      const ms = ctx.recibidoEn ? Date.now() - ctx.recibidoEn : null;
      return `🏓 pong${ms !== null ? `\nTardó *${ms} ms* desde que llegó tu mensaje.` : ""}`;
    },
  },

  hora: {
    descripcion: "Fecha y hora del servidor",
    uso: "/hora",
    ejecutar() {
      const ahora = new Date();
      return (
        "🕒 *Hora del servidor*\n```\n" +
        tabla([
          ["Local", ahora.toLocaleString("es-MX", { dateStyle: "full", timeStyle: "medium" })],
          ["UTC", ahora.toISOString()],
          ["Zona", Intl.DateTimeFormat().resolvedOptions().timeZone],
        ]) +
        "\n```"
      );
    },
  },

  eco: {
    descripcion: "Repite lo que le escribas",
    uso: "/eco hola mundo",
    ejecutar(args) {
      if (!args) return "Dime qué repetir.\nEjemplo: `/eco hola mundo`";
      return `🔁 ${args}`;
    },
  },

  dado: {
    descripcion: "Tira un dado (6 caras por defecto)",
    uso: "/dado 20",
    ejecutar(args) {
      const caras = Math.min(Math.max(parseInt(args, 10) || 6, 2), 1000);
      const cae = 1 + Math.floor(Math.random() * caras);
      return `🎲 *${cae}*  _(de ${caras})_`;
    },
  },

  id: {
    descripcion: "Muestra tus datos, útil para depurar",
    uso: "/id",
    ejecutar(_args, ctx) {
      return (
        "🪪 *Datos de este chat*\n```\n" +
        tabla([
          ["Nombre", ctx.nombre || "(sin nombre)"],
          ["Número", ctx.de || "?"],
          ["Chat", ctx.chatId || "?"],
          ["Proveedor", ctx.proveedor],
        ]) +
        "\n```"
      );
    },
  },

  estado: {
    descripcion: "Salud del bot: tiempo encendido y memoria",
    uso: "/estado",
    async ejecutar(_args, ctx) {
      const mem = process.memoryUsage().rss / 1024 / 1024;
      const { activo } = await import("./ia.js");
      let prov = null;
      try { prov = activo(); } catch { prov = null; }
      ctx.ia = prov ? `${prov.nombre} · ${prov.modelo}` : "apagada";
      return (
        "📊 *Estado*\n```\n" +
        tabla([
          ["Encendido", duracion(Date.now() - ARRANQUE)],
          ["Atendidos", `${atendidos} mensajes`],
          ["Memoria", `${mem.toFixed(0)} MB`],
          ["Node", process.version],
          ["Proveedor", ctx.proveedor],
          ["IA", ctx.ia || "apagada"],
        ]) +
        "\n```"
      );
    },
  },

  ia: {
    descripcion: "Le pregunta a una IA (Groq, Gemini, Claude...)",
    uso: "/ia ¿por qué el cielo es azul?",
    async ejecutar(args) {
      if (!args) return "Escribe la pregunta.\nEjemplo: `/ia resume qué es una API`";
      const { activo, preguntar } = await import("./ia.js");
      if (!activo()) {
        const { PROVEEDORES } = await import("./ia.js");
        const opciones = Object.values(PROVEEDORES)
          .filter((p) => p.clave !== "IA_API_KEY")
          .map((p) => `• *${p.nombre}* — \`${p.clave}\``)
          .join("\n");
        return (
          "🔌 La IA está apagada.\nPon *una* de estas claves en el archivo `.env`:\n\n" +
          opciones +
          "\n\nVarias son gratis. El bot detecta sola cuál pusiste."
        );
      }
      try {
        const { texto, prov } = await preguntar(args);
        return `${texto}\n\n_— ${prov.nombre} · ${prov.modelo}_`;
      } catch (error) {
        return `⚠️ ${error?.message || error}`;
      }
    },
  },

  modelos: {
    descripcion: "Lista los modelos del proveedor de IA activo",
    uso: "/modelos",
    async ejecutar() {
      try {
        const { listarModelos } = await import("./ia.js");
        const { prov, modelos } = await listarModelos();
        if (!modelos.length) return `${prov.nombre} no devolvió ningún modelo.`;
        const lista = modelos.slice(0, 40).map((m) => `• \`${m}\``).join("\n");
        const sobran = modelos.length > 40 ? `\n_…y ${modelos.length - 40} más._` : "";
        return (
          `🧠 *${prov.nombre}* — ${modelos.length} modelos\n` +
          `Usando ahora: \`${prov.modelo}\`\n\n${lista}${sobran}\n\n` +
          "_Cambia el que uses con `IA_MODELO=` en el `.env`._"
        );
      } catch (error) {
        return `⚠️ ${error?.message || error}`;
      }
    },
  },
};

// ── Enrutador ─────────────────────────────────────────────────────────

/**
 * Decide qué responder a un mensaje entrante.
 * @returns {Promise<string|null>} texto a enviar, o null si hay que ignorarlo
 */
export async function responder(mensaje) {
  const texto = (mensaje.texto || "").trim();
  if (!texto.startsWith(PREFIJO)) return null; // no es un comando: no molestamos

  const [crudo, ...resto] = texto.slice(PREFIJO.length).split(/\s+/);
  const nombre = crudo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const args = resto.join(" ").trim();

  const comando = comandos[nombre];
  if (!comando) {
    return `No conozco *${PREFIJO}${crudo}*.\nEscribe *${PREFIJO}bot* para ver la lista.`;
  }

  atendidos += 1;
  const ctx = {
    de: mensaje.de,
    nombre: mensaje.nombre,
    chatId: mensaje.chatId,
    proveedor: mensaje.proveedor || "?",
    recibidoEn: mensaje.recibidoEn,
  };

  try {
    return await comando.ejecutar(args, ctx);
  } catch (error) {
    console.error(`[comando ${nombre}]`, error);
    return `⚠️ El comando *${PREFIJO}${nombre}* falló: ${error?.message || error}`;
  }
}
