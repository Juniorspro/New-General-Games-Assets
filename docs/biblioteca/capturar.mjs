import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(new URL(import.meta.url).pathname);
const SITIOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sitios.json'), 'utf8'));
const SALIDA = path.join(RAIZ, 'catalogo.json');
const CONCURRENCIA = 4;

const ARGS_BASE = [
  '--no-sandbox', '--disable-dev-shm-usage',
  '--disable-background-networking', '--disable-component-update',
  '--disable-sync', '--no-first-run', '--no-pings',
  '--disable-domain-reliability', '--safebrowsing-disable-auto-update',
  '--disable-features=Translate,OptimizationHints,MediaRouter,InterestFeedContentSuggestions,AutofillServerCommunication',
];
// El relay de esta sesion corta el handshake TLS 1.3 de Chromium, asi que el
// navegador principal va capado a 1.2. Pero hay sitios que solo hablan 1.3 y
// para esos existe el segundo navegador: si uno falla, se reintenta en el otro.
const ARGS_TLS12 = [...ARGS_BASE, '--ssl-version-max=tls1.2'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Aparta banners de cookies para que no tapen la captura.
async function quitarBanners(page) {
  const textos = ['accept', 'aceptar', 'agree', 'got it', 'entendido', 'allow all',
    'permitir', 'i agree', 'ok', 'consent', 'continuar', 'aceitar'];
  try {
    for (const t of textos) {
      const b = page.getByRole('button', { name: new RegExp(`^\\s*${t}`, 'i') }).first();
      if (await b.isVisible({ timeout: 250 }).catch(() => false)) {
        await b.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(350);
        break;
      }
    }
  } catch {}
  // Lo que quede con pinta de banner, fuera.
  await page.evaluate(() => {
    const sospechoso = /cookie|consent|gdpr|banner-privacy|onetrust|cky-/i;
    for (const el of document.querySelectorAll('div,section,aside,dialog')) {
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      const id = `${el.id} ${el.className}`;
      if (typeof id === 'string' && sospechoso.test(id)) el.remove();
    }
  }).catch(() => {});
}

// Lee la identidad visual real de la página: tipografías y colores en uso.
async function leerEstilo(page) {
  return page.evaluate(() => {
    const primeraFuente = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() || null;
    };
    const aHex = (c) => {
      const m = c.match(/\d+(\.\d+)?/g);
      if (!m || m.length < 3) return null;
      if (m[3] !== undefined && parseFloat(m[3]) < 0.5) return null;
      return '#' + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('');
    };
    const cuenta = new Map();
    const vistos = document.querySelectorAll('a,button,[class*=btn],[class*=button],h1,h2,svg');
    for (const el of Array.from(vistos).slice(0, 400)) {
      const cs = getComputedStyle(el);
      for (const c of [cs.backgroundColor, cs.color, cs.borderTopColor]) {
        const hex = aHex(c);
        if (!hex) continue;
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max - min < 28) continue;              // gris: no es acento
        cuenta.set(hex, (cuenta.get(hex) || 0) + 1);
      }
    }
    const acentos = [...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
    const cuerpo = getComputedStyle(document.body);
    return {
      titulo: document.title.slice(0, 120),
      descripcion: (document.querySelector('meta[name=description]')?.content || '').slice(0, 200),
      fondo: aHex(cuerpo.backgroundColor) || '#ffffff',
      texto: aHex(cuerpo.color) || '#000000',
      fuenteTitular: primeraFuente('h1') || primeraFuente('h2'),
      fuenteCuerpo: cuerpo.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      acentos,
      alto: document.body.scrollHeight,
    };
  }).catch(() => null);
}

async function capturar(navs, familia, nombre, url, intento = 0) {
  const navegador = intento === 0 ? navs.tls12 : navs.tls13;
  const id = slug(nombre);
  const destino = path.join(RAIZ, 'img', `${id}.webp`);
  const movilDestino = path.join(RAIZ, 'movil', `${id}.webp`);
  const conMovil = familia === 'movil-android';

  if (fs.existsSync(destino) && (!conMovil || fs.existsSync(movilDestino))) {
    return { id, nombre, url, familia, estado: 'ya-estaba' };
  }

  const ctx = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: UA, ignoreHTTPSErrors: true, locale: 'en-US',
    reducedMotion: 'no-preference',
  });
  ctx.setDefaultTimeout(20000);
  const page = await ctx.newPage();

  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    const codigo = r?.status() ?? 0;
    if (codigo >= 400) throw new Error(`HTTP ${codigo}`);

    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await quitarBanners(page);
    // Un empujón de scroll despierta las animaciones de entrada y las imágenes perezosas.
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(900);

    const estilo = await leerEstilo(page);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    await sharp(buf).webp({ quality: 80 }).toFile(destino);
    await sharp(buf).resize({ width: 560 }).webp({ quality: 58 }).toFile(path.join(RAIZ, 'thumb', `${id}.webp`));

    let movil = false;
    if (conMovil) {
      const m = await navegador.newContext({
        ...devices['Pixel 7'], ignoreHTTPSErrors: true, locale: 'en-US',
      });
      const mp = await m.newPage();
      try {
        await mp.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await mp.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        await quitarBanners(mp);
        await mp.waitForTimeout(1000);
        const mbuf = await mp.screenshot({ type: 'jpeg', quality: 92 });
        await sharp(mbuf).webp({ quality: 80 }).toFile(movilDestino);
        movil = true;
      } catch {}
      await m.close();
    }

    await ctx.close();
    const kb = Math.round(fs.statSync(destino).size / 1024);
    return { id, nombre, url, familia, estado: 'ok', movil, kb, ...(estilo || {}) };
  } catch (error) {
    await ctx.close().catch(() => {});
    const msg = String(error.message || error).split('\n')[0];
    if (intento === 0) return capturar(navs, familia, nombre, url, 1);
    return { id, nombre, url, familia, estado: 'fallo', error: msg.slice(0, 90) };
  }
}

// ── ejecución ────────────────────────────────────────────────────────────
const cola = [];
for (const [familia, lista] of Object.entries(SITIOS)) {
  for (const [nombre, url] of lista) cola.push({ familia, nombre, url });
}
console.log(`${cola.length} sitios en cola, concurrencia ${CONCURRENCIA}\n`);

const lanzar = (args) => chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: { server: process.env.HTTPS_PROXY },
  args,
});
const navs = { tls12: await lanzar(ARGS_TLS12), tls13: await lanzar(ARGS_BASE) };

const resultados = [];
let siguiente = 0, hechos = 0;

async function trabajador(n) {
  while (siguiente < cola.length) {
    const i = siguiente++;
    const { familia, nombre, url } = cola[i];
    const r = await capturar(navs, familia, nombre, url);
    resultados.push(r);
    hechos++;
    const marca = r.estado === 'ok' ? '✅' : r.estado === 'ya-estaba' ? '·' : '❌';
    console.log(`${marca} [${String(hechos).padStart(3)}/${cola.length}] ${nombre}${r.error ? ' — ' + r.error : r.kb ? ` (${r.kb} KB${r.movil ? ' + móvil' : ''})` : ''}`);
    fs.writeFileSync(SALIDA, JSON.stringify(resultados, null, 2));
  }
}

await Promise.all(Array.from({ length: CONCURRENCIA }, (_, n) => trabajador(n)));
await navs.tls12.close(); await navs.tls13.close();

const ok = resultados.filter((r) => r.estado === 'ok' || r.estado === 'ya-estaba').length;
console.log(`\n═══ ${ok}/${cola.length} capturados · ${resultados.filter(r => r.movil).length} con vista Android ═══`);
