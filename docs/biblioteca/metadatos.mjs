// Rellena tipografías y paleta de las fichas que las tengan vacías.
// No captura imágenes: solo abre la página y lee el CSS calculado.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(new URL(import.meta.url).pathname);
const SALIDA = path.join(RAIZ, 'catalogo.json');
const catalogo = JSON.parse(fs.readFileSync(SALIDA, 'utf8'));
const pendientes = catalogo.filter((r) => r.estado !== 'fallo' && !r.fondo);
console.log(`${pendientes.length} fichas sin metadatos`);

const BASE = ['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking',
  '--disable-component-update','--disable-sync','--no-first-run','--no-pings',
  '--disable-domain-reliability','--safebrowsing-disable-auto-update',
  '--disable-features=Translate,OptimizationHints,MediaRouter'];
const lanzar = (args) => chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  proxy:{ server: process.env.HTTPS_PROXY }, args });
const navs = { a: await lanzar([...BASE, '--ssl-version-max=tls1.2']), b: await lanzar(BASE) };

const leer = (page) => page.evaluate(() => {
  const primeraFuente = (sel) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g,'').trim() || null : null;
  };
  const aHex = (c) => {
    const m = c.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return null;
    if (m[3] !== undefined && parseFloat(m[3]) < 0.5) return null;
    return '#' + m.slice(0,3).map((n) => (+n).toString(16).padStart(2,'0')).join('');
  };
  const cuenta = new Map();
  for (const el of Array.from(document.querySelectorAll('a,button,[class*=btn],[class*=button],h1,h2,svg')).slice(0,400)) {
    const cs = getComputedStyle(el);
    for (const c of [cs.backgroundColor, cs.color, cs.borderTopColor]) {
      const hex = aHex(c); if (!hex) continue;
      const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
      if (Math.max(r,g,b) - Math.min(r,g,b) < 28) continue;
      cuenta.set(hex, (cuenta.get(hex)||0)+1);
    }
  }
  const cuerpo = getComputedStyle(document.body);
  return {
    titulo: document.title.slice(0,120),
    descripcion: (document.querySelector('meta[name=description]')?.content || '').slice(0,200),
    fondo: aHex(cuerpo.backgroundColor) || '#ffffff',
    texto: aHex(cuerpo.color) || '#000000',
    fuenteTitular: primeraFuente('h1') || primeraFuente('h2'),
    fuenteCuerpo: cuerpo.fontFamily.split(',')[0].replace(/["']/g,'').trim(),
    acentos: [...cuenta.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([c])=>c),
  };
});

async function una(r, intento = 0) {
  const nav = intento === 0 ? navs.a : navs.b;
  const ctx = await nav.newContext({ viewport:{width:1440,height:900}, ignoreHTTPSErrors:true, locale:'en-US' });
  const page = await ctx.newPage();
  try {
    await page.goto(r.url, { waitUntil:'domcontentloaded', timeout:30000 });
    await page.waitForTimeout(1400);
    const est = await leer(page);
    await ctx.close();
    return est;
  } catch (e) {
    await ctx.close().catch(()=>{});
    if (intento === 0) return una(r, 1);
    return null;
  }
}

let i = 0, hechos = 0;
async function trabajador() {
  while (i < pendientes.length) {
    const r = pendientes[i++];
    const est = await una(r);
    if (est) Object.assign(r, est);
    hechos++;
    if (hechos % 10 === 0 || hechos === pendientes.length) {
      console.log(`  ${hechos}/${pendientes.length}`);
      fs.writeFileSync(SALIDA, JSON.stringify(catalogo, null, 2));
    }
  }
}
await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()]);
fs.writeFileSync(SALIDA, JSON.stringify(catalogo, null, 2));
await navs.a.close(); await navs.b.close();
const con = catalogo.filter((r) => r.fondo).length;
console.log(`\n═══ ${con}/${catalogo.length} fichas con paleta y tipografías ═══`);
