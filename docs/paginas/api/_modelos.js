/* ---------------------------------------------------------------------------
   De dónde sale la IA.

   Workers AI es la de casa: no pide clave y ya está atada al proyecto, pero el
   plan gratis corta a las 10.000 «neuronas» por día y las lecturas de imagen se
   las comen rápido. Cuando eso pasa, la app se queda sin IA hasta el otro día.

   Por eso esto es una cadena y no un proveedor solo. Los de afuera piden una
   clave, así que cada uno entra en juego sólo si la suya está guardada como
   secreto del Worker. Si no hay ninguna, funciona igual que siempre con Workers
   AI sola.

   Pollinations, la única que contesta sin cuenta ni clave, NO está en esta lista
   y no es un olvido: desde un Worker no se puede usar. Todos los Workers salen
   por unas pocas direcciones IP compartidas, y Pollinations limita el escalón
   anónimo a un pedido encolado por IP. Desde acá contesta siempre lo mismo
   —«Queue full for IP: 2a06:98c0:3600::103»—, seis de seis veces que se probó.
   Sí anda desde el teléfono del dueño, que tiene su propia conexión, así que el
   respaldo con Pollinations está en la app y no en el servidor.

   Para agregar una:
     cd sitio && wrangler pages secret put OPENROUTER_API_KEY --project-name iblo-eventos
   y lo mismo con GROQ_API_KEY, GEMINI_API_KEY, CEREBRAS_API_KEY o GITHUB_MODELS_TOKEN.
   --------------------------------------------------------------------------- */

/* ¿el error es «se acabó el cupo» o «está saturado»? Sólo en esos casos vale la
   pena molestar al siguiente de la fila; si el pedido está mal, va a fallar igual. */
export function vaciaElCupo(e) {
  return /neurons|daily free allocation|quota|rate.?limit|too many requests|capacity|overload|\b(402|429|503|529)\b/i
    .test(String((e && e.message) || e || ""));
}

/* Una clave mal puesta o vencida no tiene que dejar sin IA a los que sí andan:
   se saltea ese proveedor y se sigue con el próximo. Probado poniendo una clave
   falsa de Groq: antes cortaba la cadena ahí y devolvía error. */
export function claveMala(e) {
  return /\b(401|403)\b|unauthorized|invalid.{0,12}(api.?)?key|authentication|forbidden/i
    .test(String((e && e.message) || e || ""));
}

/* Todos menos Gemini hablan el dialecto de OpenAI, así que se comparte. */
async function comoOpenAI(url, clave, modelo, mensajes, opc, extra) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + clave, "Content-Type": "application/json", ...(extra || {}) },
    body: JSON.stringify({
      model: modelo,
      messages: mensajes,
      max_tokens: opc.tope || 700,
      temperature: opc.calor == null ? 0.2 : opc.calor,
      /* el esquema completo lo toma poca gente; «devolveme JSON» lo toma todo el mundo */
      ...(opc.esquema ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 140));
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content || "");
}

/* Gemini separa las instrucciones del sistema y quiere la imagen en base64 suelto. */
async function comoGemini(clave, modelo, mensajes, opc) {
  const sistema = mensajes.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const partes = [];
  for (const m of mensajes.filter((x) => x.role !== "system")) {
    if (typeof m.content === "string") { partes.push({ text: m.content }); continue; }
    for (const c of m.content) {
      if (c.type === "text") partes.push({ text: c.text });
      else if (c.type === "image_url") {
        const u = c.image_url.url, coma = u.indexOf(",");
        partes.push({ inline_data: {
          mime_type: (u.match(/^data:([^;]+)/) || [])[1] || "image/jpeg",
          data: u.slice(coma + 1),
        } });
      }
    }
  }
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + modelo +
    ":generateContent?key=" + encodeURIComponent(clave),
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: partes }],
        ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
        generationConfig: {
          maxOutputTokens: opc.tope || 700,
          temperature: opc.calor == null ? 0.2 : opc.calor,
          ...(opc.esquema ? { responseMimeType: "application/json" } : {}),
        },
      }) }
  );
  if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 140));
  const j = await r.json();
  return String(j?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "");
}

/* La fila, en orden. `ojo` dice si ese proveedor sabe mirar imágenes: los que no,
   se saltean cuando lo que se pide es leer un flyer. */
const CADENA = [
  { nombre: "cloudflare", ojo: true, clave: (env) => env.AI && "si",
    correr: (env, m, o) => env.AI.run(
      o.conImagen ? "@cf/meta/llama-4-scout-17b-16e-instruct" : "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      { messages: m, max_tokens: o.tope || 700, temperature: o.calor == null ? 0.2 : o.calor,
        ...(o.esquema ? { response_format: { type: "json_schema", json_schema: o.esquema } } : {}) }
    ).then((r) => typeof r?.response === "string"
      ? r.response
      : String(r?.choices?.[0]?.message?.content ?? JSON.stringify(r?.response ?? ""))) },

  { nombre: "openrouter", ojo: true, clave: (env) => env.OPENROUTER_API_KEY,
    correr: (env, m, o) => comoOpenAI("https://openrouter.ai/api/v1/chat/completions",
      env.OPENROUTER_API_KEY,
      o.conImagen ? "meta-llama/llama-4-scout:free" : "meta-llama/llama-3.3-70b-instruct:free",
      m, o, { "HTTP-Referer": "https://iblo-eventos.pages.dev", "X-Title": "IBLO Panel" }) },

  { nombre: "groq", ojo: true, clave: (env) => env.GROQ_API_KEY,
    correr: (env, m, o) => comoOpenAI("https://api.groq.com/openai/v1/chat/completions",
      env.GROQ_API_KEY,
      o.conImagen ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile", m, o) },

  { nombre: "gemini", ojo: true, clave: (env) => env.GEMINI_API_KEY,
    correr: (env, m, o) => comoGemini(env.GEMINI_API_KEY, "gemini-2.0-flash", m, o) },

  /* Cerebras es sólo texto, pero es el más rápido para lo que no lleva imagen */
  { nombre: "cerebras", ojo: false, clave: (env) => env.CEREBRAS_API_KEY,
    correr: (env, m, o) => comoOpenAI("https://api.cerebras.ai/v1/chat/completions",
      env.CEREBRAS_API_KEY, "llama-3.3-70b", m, o) },

  { nombre: "github", ojo: true, clave: (env) => env.GITHUB_MODELS_TOKEN,
    correr: (env, m, o) => comoOpenAI("https://models.inference.ai.azure.com/chat/completions",
      env.GITHUB_MODELS_TOKEN, "gpt-4o-mini", m, o) },
];

/* Pide lo mismo a quien esté disponible, en orden, hasta que uno conteste.
   Devuelve { texto, de } o tira el último error, que la app traduce al dueño. */
export async function pedirIA(env, mensajes, opc) {
  opc = opc || {};
  let ultimo = new Error("no hay ninguna IA configurada");
  let porCupo = null;   /* el de cupo es el que más le sirve saber al dueño */
  let alguno = false;

  for (const p of CADENA) {
    if (!p.clave(env)) continue;              // sin clave, ni se intenta
    if (opc.conImagen && !p.ojo) continue;    // no sabe mirar imágenes
    alguno = true;
    try {
      const t = await p.correr(env, mensajes, opc);
      if (t && t.trim()) return { texto: t, de: p.nombre };
      ultimo = new Error(p.nombre + " contestó vacío");
    } catch (e) {
      ultimo = new Error(p.nombre + ": " + String((e && e.message) || e).slice(0, 150));
      if (vaciaElCupo(e) && !porCupo) porCupo = ultimo;
      /* si no es cupo, saturación ni clave mala, el pedido está mal armado:
         va a fallar igual con el resto, así que no se insiste */
      if (!vaciaElCupo(e) && !claveMala(e)) throw ultimo;
    }
  }
  if (!alguno) throw new Error("no hay ninguna IA configurada para esto");
  /* «se acabó el cupo» le dice más al dueño que «la clave de tal está mal» */
  throw porCupo || ultimo;
}

/* Qué hay a mano, para mostrarlo en Ajustes. */
export function proveedores(env) {
  const hay = {};
  for (const p of CADENA) hay[p.nombre] = !!p.clave(env);
  return hay;
}
