// Capa de IA con varios proveedores intercambiables.
//
// Casi todos los servicios gratuitos hablan el mismo dialecto (el de OpenAI),
// así que con un solo cliente de fetch cubrimos Groq, Gemini, OpenRouter,
// Cerebras y Mistral. Claude va aparte porque usa su SDK oficial.
//
// Pones UNA clave en .env y el bot detecta solo cuál usar.

export const PROVEEDORES = {
  groq: {
    nombre: "Groq",
    clave: "GROQ_API_KEY",
    base: "https://api.groq.com/openai/v1",
    modelo: "llama-3.3-70b-versatile",
    nota: "El más rápido. Gratis con límite por minuto.",
  },
  gemini: {
    nombre: "Google Gemini",
    clave: "GEMINI_API_KEY",
    base: "https://generativelanguage.googleapis.com/v1beta/openai/",
    modelo: "gemini-2.0-flash",
    nota: "Capa gratuita amplia y con visión. La mejor para analizar fotos.",
  },
  openrouter: {
    nombre: "OpenRouter",
    clave: "OPENROUTER_API_KEY",
    base: "https://openrouter.ai/api/v1",
    modelo: "meta-llama/llama-3.3-70b-instruct:free",
    nota: "Muchos modelos; los que acaban en :free no cobran.",
  },
  cerebras: {
    nombre: "Cerebras",
    clave: "CEREBRAS_API_KEY",
    base: "https://api.cerebras.ai/v1",
    modelo: "llama3.1-8b",
    nota: "Muy rápido, catálogo pequeño.",
  },
  mistral: {
    nombre: "Mistral",
    clave: "MISTRAL_API_KEY",
    base: "https://api.mistral.ai/v1",
    modelo: "mistral-small-latest",
    nota: "Capa gratuita de La Plateforme.",
  },
  claude: {
    nombre: "Claude",
    clave: "ANTHROPIC_API_KEY",
    base: null, // usa el SDK oficial, no el dialecto de OpenAI
    modelo: "claude-opus-5",
    nota: "De pago por uso. El más capaz.",
  },
  custom: {
    nombre: "Personalizado",
    clave: "IA_API_KEY",
    base: null, // lo pones tú en IA_BASE_URL
    modelo: null, // y el modelo en IA_MODELO
    nota: "Cualquier API compatible con OpenAI.",
  },
};

const SISTEMA =
  "Respondes dentro de WhatsApp. Sé breve y directo: máximo 6 líneas, sin " +
  "encabezados ni listas largas. Usa *negrita* de WhatsApp si hace falta. " +
  "Escribe en español neutro.";

/** Elige proveedor: el de IA_PROVEEDOR, o el primero que tenga clave puesta. */
export function activo() {
  const forzado = (process.env.IA_PROVEEDOR || "").toLowerCase();
  if (forzado) {
    const p = PROVEEDORES[forzado];
    if (!p) throw new Error(`IA_PROVEEDOR="${forzado}" no existe.`);
    if (!process.env[p.clave]) throw new Error(`Falta ${p.clave} en .env.`);
    return { id: forzado, ...resolver(forzado, p) };
  }
  for (const [id, p] of Object.entries(PROVEEDORES)) {
    if (process.env[p.clave]) return { id, ...resolver(id, p) };
  }
  return null;
}

function resolver(id, p) {
  return {
    nombre: p.nombre,
    apiKey: process.env[p.clave],
    base: id === "custom" ? process.env.IA_BASE_URL : p.base,
    modelo: process.env.IA_MODELO || p.modelo,
  };
}

// ── Dialecto OpenAI (Groq, Gemini, OpenRouter, Cerebras, Mistral, ...) ──

async function llamarOpenAI(prov, mensajes, maxTokens = 700) {
  if (!prov.base) throw new Error(`Falta IA_BASE_URL para el proveedor "${prov.id}".`);
  if (!prov.modelo) throw new Error("Falta IA_MODELO en .env.");

  const respuesta = await fetch(`${prov.base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${prov.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: prov.modelo,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: SISTEMA }, ...mensajes],
    }),
  });

  const cuerpo = await respuesta.text();
  if (!respuesta.ok) {
    // El error crudo del proveedor dice si el modelo no existe o se acabó la cuota.
    throw new Error(`${prov.nombre} devolvió ${respuesta.status}: ${cuerpo.slice(0, 400)}`);
  }
  const datos = JSON.parse(cuerpo);
  return (datos.choices?.[0]?.message?.content || "").trim();
}

// ── Claude (SDK oficial) ────────────────────────────────────────────────

async function llamarClaude(prov, mensajes, maxTokens = 700) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const cliente = new Anthropic({ apiKey: prov.apiKey });
  const respuesta = await cliente.messages.create({
    model: prov.modelo,
    max_tokens: maxTokens,
    system: SISTEMA,
    messages: mensajes,
  });
  return respuesta.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// ── API pública ─────────────────────────────────────────────────────────

/** Pregunta de texto. Devuelve la respuesta ya lista para WhatsApp. */
export async function preguntar(texto) {
  const prov = activo();
  if (!prov) throw new Error("Sin proveedor: pon una clave en .env.");
  const mensajes = [{ role: "user", content: texto }];
  const salida =
    prov.id === "claude"
      ? await llamarClaude(prov, mensajes)
      : await llamarOpenAI(prov, mensajes);
  return { texto: salida || "(respuesta vacía)", prov };
}

/**
 * Describe una foto. Este es el puente al proyecto de la señora:
 * foto de producto -> nombre y descripción listos para publicar.
 * Necesita un modelo con visión (Gemini y Claude la tienen).
 */
export async function describirImagen(base64, mimeType, instruccion) {
  const prov = activo();
  if (!prov) throw new Error("Sin proveedor: pon una clave en .env.");
  const pide =
    instruccion ||
    "Mira la foto de este producto y devuelve un nombre comercial corto y una " +
      "descripción de venta de máximo 2 frases. No inventes precio ni marca si no se ven.";

  if (prov.id === "claude") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const cliente = new Anthropic({ apiKey: prov.apiKey });
    const respuesta = await cliente.messages.create({
      model: prov.modelo,
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            { type: "text", text: pide },
          ],
        },
      ],
    });
    return respuesta.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  }

  const salida = await llamarOpenAI(prov, [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: "text", text: pide },
      ],
    },
  ]);
  return salida;
}

/** Lista los modelos que ofrece el proveedor activo, para no adivinar nombres. */
export async function listarModelos() {
  const prov = activo();
  if (!prov) throw new Error("Sin proveedor: pon una clave en .env.");
  if (prov.id === "claude") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const cliente = new Anthropic({ apiKey: prov.apiKey });
    const pagina = await cliente.models.list();
    return { prov, modelos: pagina.data.map((m) => m.id) };
  }
  const respuesta = await fetch(`${prov.base.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${prov.apiKey}` },
  });
  if (!respuesta.ok) {
    throw new Error(`${prov.nombre} devolvió ${respuesta.status} al listar modelos.`);
  }
  const datos = await respuesta.json();
  const modelos = (datos.data || datos.models || []).map((m) => m.id || m.name).filter(Boolean);
  return { prov, modelos };
}
