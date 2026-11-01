"use strict";
// ════════════════════════════════════════════════════════════════════════
// Textos: de lo que escribe la persona (en castellano) sale
//  - la descripción en inglés para los motores de imagen (los gratis entienden
//    mucho mejor el inglés), y
//  - el título grande de la miniatura, si no lo escribió.
// Lo pide a un modelo de texto gratis (Pollinations, 1 pedido cada 30 s por
// conexión, ~20 s de demora) y, si no contesta, se arregla solo acá.
// ════════════════════════════════════════════════════════════════════════
const Textos = (() => {
  const ESTILOS = {
    auto: { nombre: "Automático", en: "" },
    realista: { nombre: "Realista", en: "photorealistic, professional photography, dramatic lighting, vivid colors, high contrast, sharp focus" },
    cine: { nombre: "Cine", en: "cinematic film still, anamorphic lens, moody dramatic lighting, teal and orange color grading" },
    noticiero: { nombre: "Noticiero", en: "breaking news photojournalism, dramatic real scene, high contrast, documentary photo" },
    vibrante: { nombre: "Colores fuertes", en: "hyper vibrant saturated colors, punchy contrast, youtube thumbnail style, dramatic lighting" },
    anime: { nombre: "Anime", en: "anime style illustration, vibrant colors, detailed, dynamic composition" },
    dibujo: { nombre: "Dibujo", en: "cartoon illustration, bold clean outlines, flat vivid colors, fun" },
    "3d": { nombre: "3D", en: "3D render, pixar style, soft studio lighting, cute and detailed" },
    terror: { nombre: "Terror", en: "dark horror atmosphere, eerie fog, ominous red lighting, creepy, cinematic" },
    gamer: { nombre: "Gamer", en: "epic video game key art, neon lights, action scene, glowing effects" },
  };
  const NEGATIVO = "text, letters, words, caption, watermark, logo, signature, blurry, lowres, jpeg artifacts, deformed, disfigured, extra fingers, bad hands, nsfw, nude";

  // Diccionario mínimo para cuando el modelo de texto no contesta (temas de noticias y de miniaturas).
  const DIC = {
    hombre: "man", mujer: "woman", nene: "kid", niño: "child", niña: "girl", chico: "boy", chica: "girl", viejo: "old man", abuelo: "grandfather", abuela: "grandmother", gente: "people", vecinos: "neighbors", policía: "police officer", policia: "police officer", bomberos: "firefighters", médico: "doctor", político: "politician", diputado: "politician", concejal: "politician", presidente: "president", periodista: "journalist",
    auto: "car", autos: "cars", camión: "truck", colectivo: "bus", moto: "motorcycle", ruta: "highway", calle: "street", casa: "house", barrio: "neighborhood", ciudad: "city", campo: "countryside", río: "river", rio: "river", puente: "bridge", escuela: "school", hospital: "hospital", plaza: "square", congreso: "parliament", concejo: "city council", estadio: "stadium", cancha: "football pitch", mercado: "market", tienda: "shop", oficina: "office", cocina: "kitchen",
    fuego: "fire", llamas: "flames", incendio: "fire", humo: "smoke", agua: "water", lluvia: "rain", tormenta: "storm", inundación: "flood", inundacion: "flood", nieve: "snow", viento: "wind", noche: "night", día: "day", atardecer: "sunset", sol: "sun", cielo: "sky", rayo: "lightning",
    choque: "car crash", accidente: "accident", pelea: "fight", robo: "robbery", ladrón: "thief", ladron: "thief", corte: "road block", protesta: "protest", marcha: "protest march", fiesta: "party", partido: "football match", gol: "goal", dinero: "money", plata: "money", dólar: "dollar", dolar: "dollars", precio: "price", comida: "food", asado: "argentine barbecue", mate: "mate tea", perro: "dog", gato: "cat", caballo: "horse", vaca: "cow",
    asustado: "scared", asustada: "scared", sorprendido: "shocked", sorprendida: "shocked", enojado: "angry", feliz: "happy", triste: "sad", llorando: "crying", gritando: "screaming", mirando: "looking at", corriendo: "running", explotando: "exploding", grande: "huge", gigante: "giant", rojo: "red", azul: "blue", oscuro: "dark", misterioso: "mysterious", "en llamas": "on fire", "prendido fuego": "on fire",
  };
  function traducirLocal(es) {
    let t = " " + es.toLowerCase().replace(/[¿?¡!.,;:"«»]/g, " ") + " ";
    for (const [k, v] of Object.entries(DIC).sort((a, b) => b[0].length - a[0].length)) t = t.split(" " + k + " ").join(" " + v + " ");
    const vacias = /\b(un|una|unos|unas|el|la|los|las|de|del|en|y|con|que|por|para|al|a|se|su|sus|muy|mi|tu)\b/g;
    return t.replace(vacias, " ").replace(/\s+/g, " ").trim();
  }
  // Títulos de respaldo por tema (el *asterisco* marca la palabra resaltada).
  const TEMAS = [
    [/fuego|llamas|incendi|explot|humo/i, ["¡SE PRENDIÓ *FUEGO*!", "*TERRIBLE* INCENDIO", "¡NADIE LO *CREE*!"]],
    [/choque|accident|ruta|camión|colectivo|moto/i, ["*TERRIBLE* CHOQUE", "¡CORTARON LA *RUTA*!", "LO QUE *PASÓ*"]],
    [/concejo|político|polític|gobierno|diputad|concejal|escándalo|escandalo/i, ["*ESCÁNDALO* TOTAL", "SE *PUDRIÓ* TODO", "¡LO QUE *DIJO*!"]],
    [/lluvia|tormenta|inundac|viento|granizo|nieve/i, ["*TORMENTA* FEROZ", "¡SE *INUNDÓ* TODO!", "ALERTA *ROJA*"]],
    [/fantasma|miedo|terror|misterio|extraño|raro|ovni/i, ["¿QUÉ ES *ESTO*?", "*NADIE* LO EXPLICA", "¡DA *MIEDO*!"]],
    [/plata|dinero|dólar|dolar|precio|sueldo|inflación/i, ["*SUBIÓ* TODO", "¡MIRÁ EL *PRECIO*!", "LO QUE *CUESTA*"]],
    [/fútbol|futbol|gol|partido|cancha|club/i, ["¡QUÉ *GOLAZO*!", "*HISTÓRICO*", "¡NO PUEDE *SER*!"]],
    [/comida|asado|receta|cocina/i, ["*IRRESISTIBLE*", "¡PROBALO *YA*!", "EL *SECRETO*"]],
    [/perro|gato|caballo|vaca|animal/i, ["¡MIRÁ LO QUE *HIZO*!", "*INCREÍBLE*", "¡QUÉ *TERNURA*!"]],
  ];
  const GENERALES = ["¡MIRÁ *ESTO*!", "*INCREÍBLE*", "NADIE LO *ESPERABA*", "*ÚLTIMO* MOMENTO", "¡NO PUEDE *SER*!", "LO QUE *PASÓ*"];
  function tituloLocal(es, semilla = 1) {
    const r = azar(semilla), t = TEMAS.find(([re]) => re.test(es)), l = t ? t[1] : GENERALES;
    return l[Math.floor(r() * l.length)];
  }

  // ── El modelo de texto gratis (uno a la vez; respeta su ritmo de 30 s por conexión).
  let ultimo = leerLS("texto-ultimo", 0), cola = Promise.resolve();
  const cache = new Map();
  function preguntar(instruccion, ms = 28000) {
    const tarea = cola.then(async () => {
      const falta = ultimo + 31000 - Date.now(); if (falta > 0) await esperar(falta);
      ultimo = Date.now(); guardarLS("texto-ultimo", ultimo);
      const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
      try {
        const r = await fetch("https://text.pollinations.ai/" + encodeURIComponent(instruccion) + "?seed=" + semillaNueva(), { signal: c.signal });
        const tx = await r.text(); if (!r.ok) throw new Error("texto " + r.status); return tx;
      } finally { clearTimeout(t); }
    });
    cola = tarea.catch(() => {});
    return tarea;
  }
  // Devuelve { en, titulo, de: "ia"|"local" }. Nunca falla: si no hay IA, sale lo local.
  async function preparar(es, { conTitulo = true, semilla = 1 } = {}) {
    const clave = es.trim().toLowerCase() + "|" + conTitulo;
    if (cache.has(clave)) return cache.get(clave);
    const local = { en: traducirLocal(es), titulo: tituloLocal(es, semilla), de: "local" };
    const instr = `Respondé SOLO con JSON válido, sin nada más, con esta forma: {"en": "...", "titulo": "..."}. ` +
      `en: descripción en inglés de la imagen de fondo para una miniatura de YouTube sobre «${es.slice(0, 400)}», muy visual y concreta, de 20 a 40 palabras, sin texto ni letras en la imagen. ` +
      (conTitulo ? `titulo: título de 2 a 4 palabras en mayúsculas, en castellano rioplatense, que dé curiosidad o emoción y ganas de hacer clic (no repitas la descripción), sin emojis ni comillas; poné entre asteriscos la palabra más fuerte. Ejemplos del tono: ¡SE PRENDIÓ *FUEGO*! · *NADIE* LO ESPERABA · ¡NO PUEDE *SER*! · LO QUE *PASÓ* EN LA RUTA.` : `titulo: "".`);
    try {
      const tx = await preguntar(instr), m = tx.match(/\{[\s\S]*\}/); if (!m) throw new Error("sin JSON");
      const j = JSON.parse(m[0]);
      const en = String(j.en || "").replace(/\s+/g, " ").trim().slice(0, 400);
      let titulo = String(j.titulo || "").replace(/["“”«»]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
      if (titulo.split(" ").length > 6 || titulo.length > 42) titulo = local.titulo;
      const r = { en: en.length > 12 ? en : local.en, titulo: conTitulo ? titulo || local.titulo : "", de: "ia" };
      cache.set(clave, r); return r;
    } catch (e) { return local; }
  }
  // La descripción final para un motor de imagen.
  function promptImagen(escenaEn, estilo, formato, diseno) {
    const est = ESTILOS[estilo] || ESTILOS.realista, partes = [escenaEn];
    partes.push(est.en || ESTILOS.realista.en);
    if (diseno === "grito" || diseno === "noticia") partes.push(formato === "vertical" ? "main subject in the lower half, empty space at the top" : "main subject on the right side, empty space on the left side");
    if (formato === "vertical") partes.push("vertical composition");
    partes.push("eye-catching youtube thumbnail background, no text");
    return partes.filter(Boolean).join(", ");
  }
  const IDEAS = [
    "Un hombre asustado mirando un auto en llamas en la ruta",
    "Vecinos cortando la ruta con gomas prendidas fuego, de noche",
    "Una tormenta enorme llegando a un pueblo, cielo verde",
    "Un perro salvando a un nene en el río",
    "Escándalo en el concejo deliberante, políticos discutiendo",
    "Una luz extraña en el cielo sobre el campo, de noche",
    "Un asado gigante para todo el barrio",
    "El dólar por las nubes, billetes volando",
  ];
  return { ESTILOS, NEGATIVO, preparar, promptImagen, traducirLocal, tituloLocal, IDEAS };
})();
