// Las skins: treinta con monedas y tres con plata de verdad.
//
// LAS TREINTA SE HACEN CON CODIGO Y PESAN CERO. Treinta dibujos nuevos serían
// medio megabyte adentro del archivo único —más que el juego entero— y encima
// treinta pedidos a un generador que devuelve treinta personajes que no se
// parecen entre sí. Acá cada skin es una TABLA: de qué color se tiñe cada pieza
// del muñeco, qué accesorio vectorial lleva en la cabeza, qué aura deja atrás y
// de qué color queda el paraguas. Con seis accesorios, siete auras y una paleta
// se arma toda la variedad que hace falta, y el muñeco sigue siendo el mismo
// muñeco — que es lo que hace que una skin se lea como la misma persona
// disfrazada y no como otro juego.
//
// LAS TRES PAGAS SON LAS UNICAS CON DIBUJO PROPIO, y esa es exactamente la razón
// por la que se pueden cobrar aparte: lo que se paga es algo que el juego no
// puede generar solo. Una skin paga que fuera "las mismas piezas pero doradas"
// sería cobrar por un número más alto.
//
// EL PRECIO SALE DE UNA MEDICION, no de la nada. Un robot con el control de
// verdad junta 190 monedas en 66 segundos; una persona junta menos, digamos
// cien por minuto. Con eso, una común son cinco minutos y una legendaria son
// entre siete y veinte horas. Están caras a propósito: una tienda donde todo se
// compra en una tarde deja de ser una tienda a la tarde siguiente.

export const RANGOS = ["comun", "rara", "epica", "legendaria", "paga"];

// Los accesorios y las auras que sabe dibujar `heroe.js`. Vivir acá y no allá
// hace que agregar una skin sea agregar un renglón a una tabla.
export const ACCESORIOS = ["", "gorra", "corona", "aureola", "cuernos", "casco",
                           "antena", "vincha", "sombrero", "auriculares"];
export const AURAS = ["", "chispas", "fuego", "hielo", "estatica", "humo", "estrellas", "burbujas"];

/**
 * Una skin.
 *
 * `pelo` tiñe la cabeza, `bata` el torso y los brazos, `pata` las piernas y
 * `paraguas` el paraguas. `fuerza` es cuánto pesa el tinte: al 1 la pieza queda
 * del color plano y se pierde el dibujo, así que las piezas de piel van bajas y
 * las de ropa altas.
 */
const s = (id, rango, precio, pelo, bata, pata, paraguas, accesorio = "", aura = "", extra = {}) =>
  ({ id, rango, precio, pelo, bata, pata, paraguas, accesorio, aura, ...extra });

export const SKINS = [
  // --- la de fábrica, gratis --------------------------------------------
  s("base", "comun", 0, null, null, null, null),

  // --- comunes: 400 a 1.400 ---------------------------------------------
  s("lab", "comun", 400, "#cfd8e6", "#e8f0fa", "#5a6478", "#9fb4c8"),
  s("obrero", "comun", 500, "#8b5a2b", "#e08b2c", "#3d4657", "#e08b2c", "casco"),
  s("menta", "comun", 600, "#a8f0d0", "#5fd9a6", "#2f6b52", "#5fd9a6"),
  s("ladrillo", "comun", 700, "#d98a6a", "#a8422c", "#4a2118", "#a8422c", "gorra"),
  s("tinta", "comun", 850, "#4a4a5e", "#1c1c28", "#101018", "#2a2a3c", "", "humo"),
  s("durazno", "comun", 1000, "#ffd9c0", "#ff9f6e", "#7a4a30", "#ffb98c", "vincha"),
  s("pizarra", "comun", 1200, "#8f9bb3", "#39425c", "#232a3e", "#5a6札", "gorra"),
  s("limon", "comun", 1400, "#f2f7a0", "#d8e64a", "#6b7520", "#d8e64a", "", "chispas"),

  // --- raras: 2.500 a 7.000 ---------------------------------------------
  s("neon", "rara", 2500, "#7bf5ff", "#0f3a4a", "#07202b", "#22d3ee", "auriculares", "estatica"),
  s("rosa", "rara", 3000, "#ffc2e8", "#ff5fb8", "#7a2a58", "#ff5fb8", "vincha", "burbujas"),
  s("selva", "rara", 3400, "#b7f07a", "#2f6b2a", "#1b3d18", "#4e9e3e", "", "humo"),
  s("oxido", "rara", 3900, "#c98a4a", "#7a3f1c", "#3d2010", "#a85c22", "casco", "chispas"),
  s("abismo", "rara", 4400, "#6a7ae0", "#141a3a", "#0a0d22", "#2a3670", "", "estrellas"),
  s("cereza", "rara", 4900, "#ff8f9f", "#c41e3a", "#5e0e1c", "#e02a48", "corona"),
  s("arena", "rara", 5400, "#f0dda8", "#c9a martillo", "#6b5a30", "#d9bd6a", "sombrero"),
  s("acero", "rara", 6200, "#dbe3ee", "#7d8794", "#3a4049", "#9aa4b2", "casco", "chispas"),
  s("veneno", "rara", 7000, "#c8ff4a", "#4a7a0a", "#243a06", "#8fd118", "", "fuego"),

  // --- épicas: 12.000 a 30.000 ------------------------------------------
  s("hielo", "epica", 12000, "#dff6ff", "#7ec8e3", "#2a5a78", "#a8e6ff", "corona", "hielo"),
  s("brasa", "epica", 14500, "#ffd08a", "#e03e1a", "#6b1a08", "#ff6a2a", "cuernos", "fuego"),
  s("tormenta", "epica", 17000, "#d8e4ff", "#2a3a6e", "#141d3a", "#5a78d8", "antena", "estatica"),
  s("jade", "epica", 19500, "#c8ffe8", "#00a878", "#00543c", "#00d89a", "corona", "chispas"),
  s("obsidiana", "epica", 22000, "#7a7a8f", "#0d0d14", "#050508", "#1a1a26", "cuernos", "humo"),
  s("aurora", "epica", 24500, "#c0ffe8", "#7a5ad8", "#3a2a6e", "#9f7aff", "aureola", "estrellas"),
  s("coral", "epica", 27000, "#ffd4c8", "#ff5a3c", "#7a2a18", "#ff8a6a", "vincha", "burbujas"),
  s("plomo", "epica", 30000, "#b0b6c0", "#4a4f5a", "#26292f", "#6e7580", "casco", "humo"),

  // --- legendarias: 45.000 a 120.000 ------------------------------------
  s("oro", "legendaria", 45000, "#fff0a8", "#e0b020", "#6b5208", "#ffd24a", "corona", "chispas",
    { brillo: "#ffd24a" }),
  s("espectro", "legendaria", 60000, "#dff6ff", "#3a5a7a", "#1a2a3a", "#8fd8ff", "aureola", "humo",
    { brillo: "#8fd8ff", alfa: 0.62 }),
  s("prisma", "legendaria", 78000, "#ffffff", "#e8e8f8", "#9a9ab8", "#ffffff", "corona", "estrellas",
    { arcoiris: true }),
  s("titan", "legendaria", 98000, "#e8ecf2", "#2a2f3a", "#14171d", "#4a5160", "casco", "estatica",
    { brillo: "#9fe8ff" }),
  s("fenix", "legendaria", 120000, "#ffe08a", "#ff3a0a", "#7a1a00", "#ff7a2a", "cuernos", "fuego",
    { brillo: "#ff7a2a" }),

  // --- las tres pagas ----------------------------------------------------
  //
  // `precio` es null y `producto` es el identificador que el cobro de verdad va
  // a usar. El juego NO sabe nada de plata: pregunta si la skin está habilitada
  // y muestra un botón que llama a `compras.js`. Todo lo que tenga que ver con
  // cobrar vive detrás de ese archivo, y hoy ese archivo no cobra nada.
  s("cromo", "paga", null, "#dfe8f2", "#c8d4e0", "#8f9aa8", "#dfe8f2", "", "estatica",
    { producto: "paraguas.skin.cromo", arte: "pro_cromo", brillo: "#bfe8ff" }),
  s("magma", "paga", null, "#ffb070", "#3a1a10", "#1a0c06", "#ff6a1a", "", "fuego",
    { producto: "paraguas.skin.magma", arte: "pro_magma", brillo: "#ff6a1a" }),
  s("vacio", "paga", null, "#c0a8ff", "#0a0616", "#05030c", "#3a1a6e", "", "estrellas",
    { producto: "paraguas.skin.vacio", arte: "pro_vacio", brillo: "#9f7aff" }),
];

// Un error de tipeo en un color no rompe nada visible: el navegador ignora el
// valor y deja el anterior, así que la skin se ve como la de al lado y nadie se
// entera. Se corrigen acá, con nombre, en vez de esconderlos.
SKINS.find((k) => k.id === "pizarra").paraguas = "#5a6478";
SKINS.find((k) => k.id === "arena").bata = "#c9a24a";

export const porId = (id) => SKINS.find((k) => k.id === id) || SKINS[0];
export const esPaga = (k) => k.rango === "paga";
export const conMonedas = () => SKINS.filter((k) => !esPaga(k) && k.precio > 0);

/** Lo que cuesta comprarlas TODAS con monedas. Va en la tienda, como aviso. */
export const costoTotal = () => conMonedas().reduce((a, k) => a + k.precio, 0);
