// La tienda: que la economía cierre y que lo pago no se regale.
//
// UNA TIENDA SE ROMPE DE DOS MANERAS Y NINGUNA SE VE JUGANDO. La primera es que
// una skin se cobre y no se entregue —o al revés— porque descontar y entregar
// son dos pasos y entre los dos el juego se puede cerrar. La segunda es peor:
// que las tres skins pagas se puedan conseguir sin pagar. Eso no se ve nunca
// probando a mano, porque a mano uno prueba el camino que quiere que funcione.
import { chromium } from "playwright";
import path from "path";
import { readFileSync } from "fs";
import { SKINS, conMonedas, esPaga, costoTotal, porId } from "../js/skins.js";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// --- el catálogo, sin navegador ------------------------------------------
ch("hay 34 skins: la de fábrica, 30 con monedas y 3 pagas",
   SKINS.length === 34 && conMonedas().length === 30 && SKINS.filter(esPaga).length === 3,
   `${SKINS.length} · ${conMonedas().length} · ${SKINS.filter(esPaga).length}`);

{
  const ids = SKINS.map((k) => k.id);
  ch("ningún id repetido", new Set(ids).size === ids.length,
     ids.filter((x, i) => ids.indexOf(x) !== i).join(", "));
}
{
  // Un color mal escrito no rompe nada visible: el navegador lo ignora y la
  // pieza queda del color de la skin anterior. O sea, dos skins idénticas y
  // ninguna pista de por qué.
  const malos = [];
  for (const k of SKINS)
    for (const [campo, c] of [["pelo", k.pelo], ["bata", k.bata], ["pata", k.pata], ["paraguas", k.paraguas]])
      if (c && !/^#[0-9a-f]{6}$/i.test(c)) malos.push(`${k.id}.${campo}=${c}`);
  ch("todos los colores están bien escritos", malos.length === 0, malos.slice(0, 3).join(" "));
}
{
  // Los precios tienen que SUBIR con el rango. Una legendaria más barata que una
  // épica no es un error de código: es una tienda que se entiende al revés.
  const orden = ["comun", "rara", "epica", "legendaria"];
  let anterior = -1, rompe = [];
  for (const r of orden) {
    const precios = SKINS.filter((k) => k.rango === r && k.precio > 0).map((k) => k.precio);
    if (Math.min(...precios) <= anterior) rompe.push(r);
    anterior = Math.max(...precios);
  }
  ch("los precios suben rango por rango, sin pisarse", rompe.length === 0, rompe.join(", "));
}
{
  const p = conMonedas().map((k) => k.precio);
  const suben = p.every((v, i) => i === 0 || v > p[i - 1]);
  ch("y dentro de la lista cada una cuesta más que la anterior", suben);
}
// LAS PAGAS NO TIENEN PRECIO EN MONEDAS, Y ESO ES LO QUE LAS HACE IMPOSIBLES DE
// COMPRAR CON MONEDAS: `comprarConMonedas` exige un precio mayor que cero, así
// que darles uno "por si acaso" sería abrir justo el agujero que hay que evitar.
ch("ninguna paga tiene precio en monedas",
   SKINS.filter(esPaga).every((k) => k.precio === null && !!k.producto));
{
  // La medición de la que salen los precios: un robot junta 190 monedas en 66
  // segundos, así que una persona junta del orden de cien por minuto.
  const horas = costoTotal() / 100 / 60;
  ch("juntarlas todas es un objetivo largo, no una tarde", horas > 40 && horas < 300,
     `${costoTotal().toLocaleString("es-AR")} monedas ≈ ${Math.round(horas)} h a 100 por minuto`);
}
{
  // Cada skin tiene nombre en los tres idiomas. Sin esto, una skin nueva se ve
  // en pantalla como `skin.fenix` y no falla nada.
  const src = readFileSync(new URL("../js/idioma.js", import.meta.url), "utf8");
  const faltan = [];
  for (const cod of ["ES", "EN", "PT"]) {
    const i = src.indexOf(`const ${cod} = {`), j = src.indexOf("\n};", i);
    const tabla = src.slice(i, j);
    for (const k of SKINS) if (!tabla.includes(`"skin.${k.id}":`)) faltan.push(`${cod}/${k.id}`);
  }
  ch("las 34 tienen nombre en los tres idiomas", faltan.length === 0, faltan.slice(0, 4).join(" "));
}

// --- y ahora jugando -----------------------------------------------------
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 400, height: 820 }, hasTouch: true });
const err = [];
pg.on("pageerror", (e) => err.push(e.message));
pg.on("console", (m) => { if (m.type() === "error") err.push("consola: " + m.text().slice(0, 140)); });

await pg.goto("file://" + path.resolve("paraguas-en-un-archivo.html"));
await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 30000 });
const idi = await pg.$('#p-idioma:not([hidden]) [data-idioma="es"]');
if (idi) { await idi.click(); await pg.waitForTimeout(300); }

const guardado = () => pg.evaluate(() => JSON.parse(localStorage.getItem("paraguas.v1") || "{}"));
const bolsa = async (n) => {
  await pg.evaluate((m) => {
    const d = JSON.parse(localStorage.getItem("paraguas.v1"));
    d.monedas = m; localStorage.setItem("paraguas.v1", JSON.stringify(d));
  }, n);
  await pg.reload();
  await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 30000 });
};
const tocar = async (nombre) => {
  await pg.evaluate((n) => {
    const b = [...document.querySelectorAll(".skin")].find((x) => x.textContent.includes(n));
    if (b) b.click();
  }, nombre);
  await pg.waitForTimeout(250);
};

await bolsa(0);
await pg.click("#m-tienda");
await pg.waitForTimeout(400);
ch("la tienda muestra las 34", (await pg.evaluate(() => document.querySelectorAll(".skin").length)) === 34);

// SIN MONEDAS NO SE COMPRA NADA, y se dice cuánto falta en vez de "no te
// alcanza": es el mismo toque y la diferencia entre mostrar la meta y negarla.
await tocar("Laboratorio");
{
  const d = await guardado();
  const texto = await pg.$eval("#t-nombre", (e) => e.textContent);
  ch("sin monedas no se compra, y avisa cuánto falta",
     !d.skins.lab && d.monedas === 0 && /400/.test(texto), texto);
}

await bolsa(1000);
await pg.click("#m-tienda"); await pg.waitForTimeout(300);
await tocar("Laboratorio");
{
  const d = await guardado();
  ch("con monedas se compra, se descuenta exacto y queda puesta",
     d.skins.lab === true && d.monedas === 600 && d.skin === "lab", `quedan ${d.monedas}`);
}
// COMPRAR DOS VECES LA MISMA ES EL ERROR CLASICO: el botón ya dice "ponerse",
// pero si la función no lo mira igual descuenta de nuevo.
await tocar("Laboratorio");
ch("volver a tocarla la pone, no la cobra otra vez", (await guardado()).monedas === 600);

// --- LO PAGO NO SE REGALA ------------------------------------------------
for (const nombre of ["Cromo", "Magma", "Vacío"]) {
  await tocar(nombre);
  const d = await guardado();
  ch(`${nombre} no se desbloquea sin tienda conectada`,
     !d.skins[nombre.toLowerCase()] && d.skin === "lab",
     await pg.$eval("#t-nombre", (e) => e.textContent));
}
// Y tampoco por el camino de las monedas, ni teniendo todas las del mundo.
await bolsa(999999999);
await pg.click("#m-tienda"); await pg.waitForTimeout(300);
await tocar("Magma");
{
  const d = await guardado();
  ch("ni con mil millones de monedas se compra una paga",
     !d.skins.magma && d.monedas === 999999999);
}
// El módulo de compras, preguntado directo: sin puente no hay compra y no marca
// nada. Es la última línea de defensa, por debajo de la interfaz.
{
  const r = await pg.evaluate(async () => {
    const m = window.PARAGUAS.compras;
    const antes = m.pagada("paraguas.skin.cromo");
    const res = await m.comprar("paraguas.skin.cromo");
    return { disponible: m.disponible(), ok: res.ok, motivo: res.motivo,
             antes, despues: m.pagada("paraguas.skin.cromo") };
  });
  ch("sin puente, comprar() dice que no y no marca nada",
     r.disponible === false && r.ok === false && r.motivo === "sin-tienda" && r.despues === false,
     JSON.stringify(r));
}
// Y CON un puente conectado sí compra: el enganche existe de verdad, no es un
// comentario. Se conecta uno de mentira, se compra, y se comprueba que el juego
// entrega la skin y la deja ponible.
{
  const r = await pg.evaluate(async () => {
    const m = window.PARAGUAS.compras;
    m.conectar({
      async catalogo(ids) { return ids.map((id) => ({ id, precio: "US$ 2,99" })); },
      async comprar(id) { return { ok: true, id }; },
      async restaurar() { return []; },
    });
    const res = await m.comprar("paraguas.skin.cromo");
    return { ok: res.ok, pagada: m.pagada("paraguas.skin.cromo") };
  });
  ch("con un puente conectado, comprar() entrega la skin", r.ok === true && r.pagada === true);
  await pg.click("[data-volver]"); await pg.waitForTimeout(200);
  await pg.click("#m-tienda"); await pg.waitForTimeout(300);
  await tocar("Cromo");
  ch("y ya comprada se puede poner", (await guardado()).skin === "cromo");
}

// LA CHATARRA DE LA PARTIDA CAE EN LA BILLETERA. Sin esto la tienda es una
// vidriera: hay precios y no hay forma de juntar plata.
await bolsa(0);
await pg.click("#m-jugar"); await pg.waitForTimeout(500);
await pg.evaluate(() => {
  const p = window.PARAGUAS.partida;
  p.monedas = 37;
  p.varillas = 1;
  const f = p.pozo.siguiente(p.y + 60);
  p.x = 20; p.y = f.y - 40; p.vy = 12;
});
await pg.waitForSelector("#p-fin:not([hidden])", { timeout: 20000 });
await pg.waitForTimeout(200);
ch("lo juntado en la partida se suma a la billetera", (await guardado()).monedas === 37,
   `${(await guardado()).monedas}`);

// La skin puesta sobrevive a cerrar el juego: si no, la tienda es una decisión
// que hay que volver a tomar cada vez.
await pg.reload();
await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 30000 });
ch("la skin puesta sobrevive al recargar", (await guardado()).skin === "cromo");

ch("sin errores de javascript", err.length === 0, err.slice(0, 3).join(" · "));
console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
