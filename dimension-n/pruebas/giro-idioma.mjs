// El giro, los idiomas, el menú y las grabaciones, sobre el archivo único.
//
// Se abre dimension-n-en-un-archivo.html desde file:// con la red cortada (si
// algo pide internet, falla acá y no en el teléfono de alguien) en tres
// pantallas: compu, teléfono acostado (el juego va girado −90°) y teléfono
// parado (derecho). En cada una se pasa por los tres idiomas.
//
// LO QUE IMPORTA DEL GIRO NO ES QUE SE VEA GIRADO, es que el dedo caiga donde
// el juego cree. Por eso los toques se mandan a un punto calculado en
// coordenadas DEL JUEGO, pasado a pantalla con la cuenta inversa, y se mira
// qué punto recibió el juego: el dedo del reactor (entrada.dedoX) y el toque
// del disparo de portal (ultimoTiro) tienen que coincidir con lo que se pidió.
//
//     node pruebas/giro-idioma.mjs [carpeta-para-fotos]
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const FOTOS = process.argv[2] || "";
if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
const ARCHIVO = "file://" + path.resolve("dimension-n-en-un-archivo.html");
const nav = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };
const esperar = (pg, ms) => pg.waitForTimeout(ms);

// Un punto del juego (en unidades del lienzo, 360 de ancho) a la pantalla.
const aPantalla = (pg, gx, gy) => pg.evaluate(([gx, gy]) => {
  const { GIRO, esc } = window.DN, l = document.querySelector("#lienzo");
  const an = parseFloat(l.style.width), al = parseFloat(l.style.height);
  const lx = (GIRO.ancho() - an) / 2 + gx * esc, ly = (GIRO.alto() - al) / 2 + gy * esc;
  if (!GIRO.activo) return [lx, ly];
  return GIRO.signo < 0 ? [ly, innerHeight - lx] : [innerWidth - ly, lx];
}, [gx, gy]);

// Dedos de verdad (touchStart/Move/End por CDP): Playwright sólo sabe "tap".
async function dedo(pg, cdp, tactil, puntos, sostener) {
  if (!tactil) {
    await pg.mouse.move(puntos[0][0], puntos[0][1]); await pg.mouse.down();
    for (const p of puntos.slice(1)) await pg.mouse.move(p[0], p[1], { steps: 4 });
    if (sostener) await esperar(pg, sostener);
    return () => pg.mouse.up();
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: puntos[0][0], y: puntos[0][1], id: 1 }] });
  for (const p of puntos.slice(1))
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p[0], y: p[1], id: 1 }] });
  if (sostener) await esperar(pg, sostener);
  return () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

const VISTAS = [
  { nom: "pc", w: 1200, h: 680, tactil: false, girado: false },
  { nom: "tel", w: 844, h: 390, tactil: true, girado: true },
  { nom: "vertical", w: 390, h: 844, tactil: true, girado: false },
];
const COD = ["es", "en", "pt"];
const TAB = { es: "Récords", en: "Records", pt: "Recordes" };

for (const v of VISTAS) {
  console.log(`\n── ${v.nom} ${v.w}×${v.h} ──`);
  const cx = await nav.newContext({ viewport: { width: v.w, height: v.h }, hasTouch: v.tactil, isMobile: v.tactil });
  const pg = await cx.newPage();
  const cdp = await cx.newCDPSession(pg);
  const err = [], red = [];
  pg.on("pageerror", (e) => err.push(e.message));
  // La red cortada: lo único que se deja pasar es el propio archivo.
  await pg.route("**/*", (r) => {
    if (r.request().url().startsWith("file://")) return r.continue();
    red.push(r.request().url()); return r.abort();
  });

  for (let i = 0; i < 3; i++) {
    const cod = COD[i];
    await pg.goto(ARCHIVO);
    await pg.waitForFunction(() => !!window.DN, { timeout: 30000 });
    // La pantalla de idioma sale en CADA arranque, con la elección anterior marcada.
    const idi = await pg.evaluate(() => ({
      visible: !document.querySelector("#p-idioma").hidden,
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

    // Las cinco pestañas: que cada una muestre SU panel y que no quede ninguna
    // clave sin traducir a la vista ("rec.caida" en pantalla es un error).
    const pest = ["jugar", "records", "opciones", "como", "creditos"];
    let bien = 0, claves = [];
    for (const p of pest) {
      await pg.locator(`[data-pestana="${p}"]`).click();
      const r = await pg.evaluate((p) => {
        const panel = document.querySelector(`[data-panel="${p}"]`);
        // Se mira el estilo calculado y no el atributo: un `display` del CSS le
        // gana a `hidden` y el panel "oculto" queda a la vista (pasó).
        const visto = (x) => getComputedStyle(x).display !== "none";
        const otros = [...document.querySelectorAll("[data-panel]")].filter((x) => x !== panel && visto(x)).length;
        const txt = document.querySelector("#p-menu").innerText;
        return { ok: visto(panel) && otros === 0 && panel.innerText.trim().length > 20,
                 claves: txt.match(/\b(?:tab|pozo|portales|rec|op|cre|como|menu|niv|hud|fin|dlg|cap)\.[\w.-]+/g) || [] };
      }, p);
      if (r.ok) bien++;
      claves.push(...r.claves);
      if (FOTOS && (p === "jugar" || i === 0)) { await esperar(pg, p === "jugar" ? 4200 : 1500);
        await pg.screenshot({ path: `${FOTOS}/${v.nom}-${cod}-menu-${p}.png` }); }
    }
    ch(`${v.nom}/${cod}: las 5 pestañas muestran su panel`, bien === 5, `${bien}/5`);
    ch(`${v.nom}/${cod}: ninguna clave sin traducir`, claves.length === 0, claves.slice(0, 3).join(", "));
    const minimo = await pg.evaluate(() => Math.min(...[...document.querySelectorAll("#p-menu button")]
      .filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); })));
    if (v.tactil) ch(`${v.nom}/${cod}: botones del menú de 44 px o más`, minimo >= 43.5, `el más chico: ${minimo.toFixed(1)} px`);
    await pg.locator('[data-pestana="jugar"]').click();

    // Las grabaciones: con el primer toque ya hubo gesto y se crea el audio.
    const buffers = await pg.waitForFunction(() => window.DN.decodificadas() >= 21, null, { timeout: 15000 })
      .then(() => pg.evaluate(() => window.DN.decodificadas())).catch(() => pg.evaluate(() => window.DN.decodificadas()));
    ch(`${v.nom}/${cod}: grabaciones decodificadas`, buffers >= 21, `${buffers}/21 buffers`);

    // ── El pozo: un dedo a la derecha de Rilo, en coordenadas del juego.
    await pg.click("#m-jugar");
    await esperar(pg, 300);
    const x0 = await pg.evaluate(() => window.DN.partida.rilo.p.pecho.x);
    const gx = Math.min(345, x0 + 110), gy = await pg.evaluate(() => window.DN.VISTA.alto * 0.6);
    const [sx, sy] = await aPantalla(pg, gx, gy);
    const suelta = await dedo(pg, cdp, v.tactil, [[sx, sy]], 450);
    const leido = await pg.evaluate(() => window.DN.entrada.dedoX);
    const x1 = await pg.evaluate(() => window.DN.partida.rilo.p.pecho.x);
    await suelta();
    ch(`${v.nom}/${cod}: el dedo llega al juego donde se tocó`, leido != null && Math.abs(leido - gx) < 1.5,
       `pedido x=${gx.toFixed(1)}, leído ${leido == null ? "nada" : leido.toFixed(1)}`);
    ch(`${v.nom}/${cod}: el reactor empuja para ese lado`, x1 > x0 + 12, `${x0.toFixed(0)} → ${x1.toFixed(0)}`);
    if (FOTOS && i === 1) { await esperar(pg, 600); await pg.screenshot({ path: `${FOTOS}/${v.nom}-${cod}-pozo.png` }); }

    // ── Portales: un toque corto en un punto del escenario = un disparo allí.
    await pg.evaluate(() => window.DN.portal(0));
    await esperar(pg, 400);
    const [tx, ty] = [60, 200];
    const [px, py] = await aPantalla(pg, tx, ty);
    const tiros0 = await pg.evaluate(() => window.DN.escena.tiros);
    const suelta2 = await dedo(pg, cdp, v.tactil, [[px, py]], 0);
    await suelta2();
    await esperar(pg, 250);
    const tiro = await pg.evaluate(() => ({ t: window.DN.ultimoTiro, n: window.DN.escena.tiros }));
    ch(`${v.nom}/${cod}: el toque dispara al punto tocado`, tiro.t && Math.abs(tiro.t.gx - tx) < 1.5 && Math.abs(tiro.t.gy - ty) < 1.5,
       tiro.t ? `pedido (${tx}, ${ty}), leído (${tiro.t.gx.toFixed(1)}, ${tiro.t.gy.toFixed(1)}), tiros ${tiros0}→${tiro.n}` : "no disparó");
    if (FOTOS && i === 2) { await esperar(pg, 300); await pg.screenshot({ path: `${FOTOS}/${v.nom}-${cod}-portales.png` }); }

    // ── El final: se los deja al lado del último portal.
    await pg.evaluate(() => window.DN.jugar(0));
    await esperar(pg, 200);
    await pg.evaluate(() => {
      const P = window.DN.partida, ult = window.DN.nivel.portales[6];
      P.reiniciarEn(6);
      const dx = ult.x - P.rilo.p.pecho.x, dy = ult.y - 20 - P.rilo.p.pecho.y;
      for (const q of P.puntos) { q.x += dx; q.y += dy; q.px += dx; q.py += dy; }
    });
    await pg.waitForSelector("#p-fin:not([hidden])", { timeout: 20000 });
    const fin = await pg.evaluate(() => ({ h: document.querySelector("#p-fin h2").textContent,
      charla: document.querySelector("#f-dialogo").textContent }));
    const TIT = { es: "Llegaron", en: "They made it", pt: "Chegaram" };
    ch(`${v.nom}/${cod}: pantalla de fin traducida`, fin.h === TIT[cod] && fin.charla.length > 60, `"${fin.h}"`);
    if (FOTOS && i === 0) { await esperar(pg, 4200); await pg.screenshot({ path: `${FOTOS}/${v.nom}-${cod}-fin.png` }); }
    await pg.click("#f-menu");
    await pg.waitForSelector("#p-menu:not([hidden])");
  }
  ch(`${v.nom}: sin pedidos a la red`, red.length === 0, red.slice(0, 2).join(", "));
  ch(`${v.nom}: cero pageerror`, err.length === 0, err.slice(0, 2).join(" · "));
  await cx.close();
}

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
