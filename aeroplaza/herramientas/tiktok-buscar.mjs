// Busca videos en TikTok (páginas de hashtag y búsqueda) para MIRAR la estética:
// junta la lista (items.json) y baja los más vistos a crudo/videos/ (no se
// commitea). Solo imagen: el audio de TikTok ajeno no se usa (memoria/INDICE.md).
// Sin captcha el 24/09; si aparece uno, no se saltea.
//     node aeroplaza/herramientas/tiktok-buscar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const SP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../crudo/videos'); fs.mkdirSync(SP, { recursive: true });
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await nav.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', viewport: { width: 1280, height: 900 }, locale: 'en-US' });
await ctx.route('**/*', (r) => r.fetch().then((x) => r.fulfill({ response: x })).catch(() => r.abort()));
const pag = await ctx.newPage();
const items = new Map();
pag.on('response', async (r) => {
  if (!/\/api\/(challenge|search|post|recommend|explore)[^?]*item_list|\/api\/search\/(general|item)\/full/.test(r.url())) return;
  try {
    const j = await r.json();
    const lista = j.itemList || (j.data || []).map((d) => d.item).filter(Boolean) || [];
    for (const it of lista) items.set(it.id, { id: it.id, autor: it.author?.uniqueId, desc: it.desc, dur: it.video?.duration, vistas: it.stats?.playCount, play: it.video?.playAddr, portada: it.video?.cover });
  } catch (e) {}
});
for (const url of ['https://www.tiktok.com/tag/frutigeraero', 'https://www.tiktok.com/tag/frutigeraerogame', 'https://www.tiktok.com/search?q=frutiger%20aero%20game']) {
  try {
    await pag.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pag.waitForTimeout(7000);
    for (let i = 0; i < 6; i++) { await pag.mouse.wheel(0, 2500); await pag.waitForTimeout(1500); }
    const captcha = await pag.$('[id*="captcha"], .captcha_verify_container, #captcha-verify-container-main-page');
    const enlaces = await pag.$$eval('a[href*="/video/"]', (as) => [...new Set(as.map((a) => a.href))]);
    console.log(url, '· captcha:', !!captcha, '· enlaces:', enlaces.length, '· items:', items.size);
    await pag.screenshot({ path: `${SP}/pag-${items.size}.png` });
  } catch (e) { console.log(url, 'falló', e.message.slice(0, 80)); }
}
fs.writeFileSync(`${SP}/items.json`, JSON.stringify([...items.values()], null, 1));
/* bajar los más vistos (solo imagen: se sacan cuadros, el audio no se usa) */
const top = [...items.values()].filter((i) => i.play).sort((a, b) => (b.vistas || 0) - (a.vistas || 0)).slice(0, 14);
for (const it of top) {
  try {
    const r = await ctx.request.get(it.play, { headers: { Referer: 'https://www.tiktok.com/' }, timeout: 60000 });
    if (r.ok()) { fs.writeFileSync(`${SP}/v-${it.id}.mp4`, await r.body()); console.log('bajado', it.id, it.autor, (it.vistas || 0), (it.desc || '').slice(0, 70)); }
    else console.log('no', it.id, r.status());
  } catch (e) { console.log('no', it.id, e.message.slice(0, 60)); }
}
await nav.close();
