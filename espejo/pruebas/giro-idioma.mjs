// El giro, los idiomas, el menú y las grabaciones, sobre el archivo único.
//
// Se abre espejo-en-un-archivo.html desde file:// con la red cortada, en tres
// pantallas: compu, teléfono acostado (el juego va girado −90°) y teléfono
// parado (derecho). En cada una se pasa por los tres idiomas, las cinco
// pestañas del menú, se gana el nivel 1 TOCANDO la pantalla y se mira el final.
//
// LO QUE IMPORTA DEL GIRO ES QUE EL DEDO CAIGA EN LA CELDA QUE SE VE. El toque
// se manda a un punto calculado en coordenadas DEL JUEGO (el centro de la celda
// que dice la pista), pasado a la pantalla con la cuenta inversa del giro, y se
// comprueba qué punto leyó el juego y que el nivel se haya ganado: un toque en
// la celda de al lado da vuelta otro espejo y no gana.
//
//     node pruebas/giro-idioma.mjs [carpeta-para-fotos]
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const FOTOS = process.argv[2] || "";
if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
const ARCHIVO = "file://" + path.resolve("espejo-en-un-archivo.html");
const nav = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };
const esperar = (pg, ms) => pg.waitForTimeout(ms);

// El centro de la celda de la pista, en coordenadas del juego y en pantalla.
// Las cuentas de `medidas()` se rehacen acá a propósito: si se importara la
// función, un error adentro de ella pasaría desapercibido.
const puntoPista = (pg) => pg.evaluate(() => {
  const E = window.ESPEJO, p = E.partida, n = p.nivel, e = p.pista(), { GIRO, esc } = E;
  const alto = Math.round(Math.min(GIRO.alto() / esc, 1000));
  const lado = Math.floor(Math.min((360 - 28) / n.ancho, (alto - 150) / n.alto));
  const x0 = Math.round((360 - lado * n.ancho) / 2), y0 = Math.round((alto - lado * n.alto) / 2 + 14);
  const gx = x0 + e.c * lado + lado / 2, gy = y0 + e.f * lado + lado / 2;
  const l = document.querySelector("#lienzo");
  const an = parseFloat(l.style.width), al = parseFloat(l.style.height);
  const lx = (GIRO.ancho() - an) / 2 + gx * esc, ly = (GIRO.alto() - al) / 2 + gy * esc;
  const [sx, sy] = !GIRO.activo ? [lx, ly] : GIRO.signo < 0 ? [ly, innerHeight - lx] : [innerWidth - ly, lx];
  return { gx, gy, sx, sy, celda: Math.round(lado * esc), cel: e };
});

const VISTAS = [
  { nom: "pc", w: 1200, h: 680, tactil: false, girado: false },
  { nom: "tel", w: 844, h: 390, tactil: true, girado: true },
  { nom: "vertical", w: 390, h: 844, tactil: true, girado: false },
];
const COD = ["es", "en", "pt"];
const TAB = { es: "Récords", en: "Records", pt: "Recordes" };
const FIN = { es: "¡Listo!", en: "Solved!", pt: "Resolvido!" };

for (const v of VISTAS) {
  console.log(`\n── ${v.nom} ${v.w}×${v.h} ──`);
  const cx = await nav.newContext({ viewport: { width: v.w, height: v.h }, hasTouch: v.tactil, isMobile: v.tactil });
  const pg = await cx.newPage();
  const err = [], red = [];
  pg.on("pageerror", (e) => err.push(e.message));
  await pg.route("**/*", (r) => {
    if (r.request().url().startsWith("file://") || r.request().url().startsWith("data:")) return r.continue();
    red.push(r.request().url()); return r.abort();
  });

  for (let i = 0; i < 3; i++) {
    const cod = COD[i];
    await pg.goto(ARCHIVO);
    await pg.waitForFunction(() => !!window.ESPEJO, { timeout: 30000 });
    const idi = await pg.evaluate(() => ({
      visible: getComputedStyle(document.querySelector("#p-idioma")).display !== "none",
      botones: document.querySelectorAll(".idioma-btn").length,
      marcado: [...document.querySelectorAll(".idioma-btn.activo")].map((b) => b.dataset.idioma),
      foco: document.activeElement && document.activeElement.dataset.idioma,
      girado: document.documentElement.classList.contains("girado"),
    }));
    ch(`${v.nom}/${cod}: sale la pantalla de idioma`, idi.visible && idi.botones === 3);
    if (i > 0) ch(`${v.nom}/${cod}: la elección anterior va marcada y con foco`,
                  idi.marcado.join() === COD[i - 1] && idi.foco === COD[i - 1], `${idi.marcado} · foco ${idi.foco}`);
    ch(`${v.nom}/${cod}: ${v.girado ? "girado" : "derecho"}`, idi.girado === v.girado);
    if (i === 0 && FOTOS) { await esperar(pg, 4200); await pg.screenshot({ path: `${FOTOS}/${v.nom}-idioma.png` }); }

    await pg.locator(".idioma-btn").nth(i).click();
    await pg.waitForSelector("#p-menu:not([hidden])");
    const menu = await pg.evaluate(() => ({ lang: document.documentElement.lang,
      tab: document.querySelector("#m-tab-records span").textContent }));
    ch(`${v.nom}/${cod}: el menú en ${cod}`, menu.lang.startsWith(cod) && menu.tab === TAB[cod], `${menu.lang} · "${menu.tab}"`);

    // La grilla: cuarenta niveles con sus luces, en la pestaña de jugar.
    const grilla = await pg.evaluate(() => ({ n: document.querySelectorAll("#pn-jugar .celda-niv").length,
      luces: document.querySelector("#m-luces").textContent }));
    ch(`${v.nom}/${cod}: la grilla de los 40 niveles con las luces`, grilla.n === 40, `${grilla.n} · "${grilla.luces}"`);

    const pest = ["jugar", "records", "opciones", "como", "creditos"];
    let bien = 0; const claves = [];
    for (const p of pest) {
      await pg.locator(`[data-pestana="${p}"]`).click();
      const r = await pg.evaluate((p) => {
        const visto = (x) => getComputedStyle(x).display !== "none";
        const panel = document.querySelector(`[data-panel="${p}"]`);
        const otros = [...document.querySelectorAll("[data-panel]")].filter((x) => x !== panel && visto(x)).length;
        const txt = document.querySelector("#p-menu").innerText;
        return { ok: visto(panel) && otros === 0 && panel.innerText.trim().length > 20,
                 claves: txt.match(/\b(?:tab|tabs|menu|rec|op|cre|como|niv|hud|fin|doc|err)\.[\w-]+/g) || [] };
      }, p);
      if (r.ok) bien++;
      claves.push(...r.claves);
      if (FOTOS && (p === "jugar" || i === 0)) { await esperar(pg, p === "jugar" ? 4200 : 1500);
        await pg.screenshot({ path: `${FOTOS}/${v.nom}-${cod}-menu-${p}.png` }); }
    }
    ch(`${v.nom}/${cod}: las 5 pestañas muestran su panel`, bien === 5, `${bien}/5`);
    ch(`${v.nom}/${cod}: ninguna clave sin traducir`, claves.length === 0, claves.slice(0, 3).join(", "));
    if (v.tactil) {
      const minimo = await pg.evaluate(() => {
        const bs = [...document.querySelectorAll("#p-menu button")].filter((b) => b.offsetParent);
        return Math.min(...bs.map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
      });
      ch(`${v.nom}/${cod}: botones del menú de 44 px o más`, minimo >= 43.5, `el más chico: ${minimo.toFixed(1)} px`);
    }
    await pg.locator('[data-pestana="jugar"]').click();

    const buffers = await pg.waitForFunction(() => window.ESPEJO.decodificadas() >= 10, null, { timeout: 15000 })
      .then(() => pg.evaluate(() => window.ESPEJO.decodificadas())).catch(() => pg.evaluate(() => window.ESPEJO.decodificadas()));
    ch(`${v.nom}/${cod}: grabaciones decodificadas`, buffers >= 10, `${buffers}/10 buffers`);

    // Se juega el nivel 1 tocando el centro de la celda que dice la pista.
    await pg.evaluate(() => window.ESPEJO.jugar(0));
    await esperar(pg, 400);
    const pt = await puntoPista(pg);
    if (v.tactil) await pg.touchscreen.tap(pt.sx, pt.sy); else await pg.mouse.click(pt.sx, pt.sy);
    await esperar(pg, 150);
    const leido = await pg.evaluate(() => window.ESPEJO.ultimoToque);
    ch(`${v.nom}/${cod}: el toque llega al juego donde se tocó`,
       leido && Math.abs(leido.x - pt.gx) < 1.5 && Math.abs(leido.y - pt.gy) < 1.5,
       leido ? `pedido (${pt.gx.toFixed(1)}, ${pt.gy.toFixed(1)}), leído (${leido.x.toFixed(1)}, ${leido.y.toFixed(1)}) · celda de ${pt.celda} px` : "nada");
    if (FOTOS && i === 1) await pg.screenshot({ path: `${FOTOS}/${v.nom}-${cod}-juego.png` });
    const gano = await pg.waitForSelector("#p-fin:not([hidden])", { timeout: 8000 }).then(() => true).catch(() => false);
    ch(`${v.nom}/${cod}: ese toque gana el nivel (cayó en la celda justa)`, gano);
    if (gano) {
      const fin = await pg.evaluate(() => document.querySelector("#p-fin h2").textContent);
      ch(`${v.nom}/${cod}: pantalla de fin traducida`, fin === FIN[cod], `"${fin}"`);
      if (FOTOS && i === 0) { await esperar(pg, 4200); await pg.screenshot({ path: `${FOTOS}/${v.nom}-${cod}-fin.png` }); }
      await pg.click("#f-niveles");
      await pg.waitForSelector("#p-menu:not([hidden])");
      const luz = await pg.evaluate(() => document.querySelector(".celda-niv .luces").textContent);
      ch(`${v.nom}/${cod}: la grilla muestra las luces guardadas`, luz === "●●●", luz);
    }
  }
  ch(`${v.nom}: sin pedidos a la red`, red.length === 0, red.slice(0, 2).join(", "));
  ch(`${v.nom}: cero pageerror`, err.length === 0, err.slice(0, 2).join(" · "));
  await cx.close();
}

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
