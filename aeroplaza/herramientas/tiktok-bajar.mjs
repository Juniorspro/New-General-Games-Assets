// Baja videos puntuales de la lista de tiktok-buscar.mjs (por id). La dirección
// del video vence: se abre la página del video para tener cookies y una nueva.
//     node aeroplaza/herramientas/tiktok-bajar.mjs <id> [<id>…]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const SP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../crudo/videos'); fs.mkdirSync(SP, { recursive: true });
const ids = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } });
const ctx = await nav.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', viewport: { width: 1280, height: 900 }, locale: 'en-US' });
await ctx.route('**/*', (r) => r.fetch().then((x) => r.fulfill({ response: x })).catch(() => r.abort()));
const pag = await ctx.newPage();
const items = JSON.parse(fs.readFileSync(`${SP}/items.json`, 'utf8'));
for (const id of ids) {
  if (fs.existsSync(`${SP}/v-${id}.mp4`)) continue;
  const it = items.find((i) => i.id === id);
  try {
    /* la dirección del video vence: se abre la página para que TikTok dé cookies frescas y una nueva */
    await pag.goto(`https://www.tiktok.com/@${it.autor}/video/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pag.waitForTimeout(3000);
    const play = await pag.evaluate(() => { try { const d = JSON.parse(document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__').textContent); return d.__DEFAULT_SCOPE__['webapp.video-detail'].itemInfo.itemStruct.video.playAddr; } catch (e) { return null; } }) || it.play;
    const r = await ctx.request.get(play, { headers: { Referer: 'https://www.tiktok.com/' }, timeout: 60000 });
    if (r.ok()) { fs.writeFileSync(`${SP}/v-${id}.mp4`, await r.body()); console.log('bajado', id, it.autor); } else console.log('no', id, r.status());
  } catch (e) { console.log('no', id, e.message.slice(0, 60)); }
}
await nav.close();
