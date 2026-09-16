import { chromium } from 'playwright';
import fs from 'node:fs';
const pase = fs.readFileSync('/tmp/pase.txt','utf8').trim();
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let fallos = 0, ok = 0;
const comprobar = (q, cond, detalle) => {
  if (cond) { ok++; console.log('  OK   ' + q); }
  else { fallos++; console.log('  FALLA ' + q + (detalle ? '  -> ' + detalle : '')); }
};

async function sesion(ancho, alto){
  const ctx = await b.newContext({ viewport:{width:ancho,height:alto}, isMobile:ancho<720, hasTouch:ancho<720, deviceScaleFactor:1, serviceWorkers:'block' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([pase]) => {
    localStorage.setItem('fa.sesion', JSON.stringify({ pase, usuario:'probador' }));
    localStorage.setItem('fa.usuario', JSON.stringify({ nombre:'Probador', via:'cuenta' }));
    localStorage.setItem('fa.aeromas','true');
    localStorage.setItem('fa.colaboro','1');            // que no salte sola la de donar
  }, [pase]);
  await p.goto('http://localhost:8788/', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(2200);
  p.errs = errs;
  return { ctx, p };
}
const abiertas = p => p.evaluate(()=>[...document.querySelectorAll('#escritorio .ventana')].filter(v=>!v.hidden).map(v=>v.id));
const enSitio = p => p.evaluate(()=>!!document.getElementById('escritorio'));
const toca = (p, sel) => p.evaluate(s=>document.querySelector(s).click(), sel);

// ============================================ TELEFONO
console.log('\n=== TELEFONO 412x892');
{
  const { ctx, p } = await sesion(412, 892);
  await toca(p, '[data-abrir="v-bloc"]'); await p.waitForTimeout(400);
  comprobar('abre una app', (await abiertas(p)).join()==='v-bloc', (await abiertas(p)).join());

  // la cruz tiene que RECIBIR el toque, no solo existir: antes la tapaba la barra
  const cruz = await p.evaluate(() => {
    const x = document.querySelector('#v-bloc [data-cerrar]');
    const r = x.getBoundingClientRect();
    const e = document.elementFromPoint(Math.round(r.x+r.width/2), Math.round(r.y+r.height/2));
    return { alcanzable: x === e || x.contains(e),
             tapadaPor: e ? (e.id || e.className || e.tagName) : 'nada',
             donde: Math.round(r.x)+','+Math.round(r.y) };
  });
  comprobar('la cruz recibe el toque (no la tapa la barra)', cruz.alcanzable, 'la tapa ' + cruz.tapadaPor + ' en ' + cruz.donde);
  await p.evaluate(()=>document.querySelector('#v-bloc [data-cerrar]').click()); await p.waitForTimeout(500);
  comprobar('tocar la cruz cierra de verdad', (await abiertas(p)).length===0, (await abiertas(p)).join());
  await toca(p, '[data-abrir="v-bloc"]'); await p.waitForTimeout(400);

  await toca(p, '[data-abrir="v-minas"]'); await p.waitForTimeout(400);
  comprobar('la segunda REEMPLAZA a la primera (no se apilan)',
            (await abiertas(p)).join()==='v-minas', (await abiertas(p)).join());

  await p.goBack(); await p.waitForTimeout(500);
  comprobar('atras cierra la app', (await abiertas(p)).length===0, (await abiertas(p)).join());
  comprobar('atras NO saca del sitio', await enSitio(p));

  // el muelle (lo abre social.js)
  await toca(p, '#muelle [data-muelle="muro"]'); await p.waitForTimeout(700);
  comprobar('el muelle tambien entra a la pila', (await abiertas(p)).includes('v-muro'), (await abiertas(p)).join());
  await p.goBack(); await p.waitForTimeout(500);
  comprobar('atras cierra lo del muelle', (await abiertas(p)).length===0, (await abiertas(p)).join());
  comprobar('sigue en el sitio', await enSitio(p));

  // cerrar con la cruz no deja basura en el historial
  const h0 = await p.evaluate(()=>history.length);
  await toca(p, '[data-abrir="v-bloc"]'); await p.waitForTimeout(400);
  await p.evaluate(()=>document.querySelector('#v-bloc [data-cerrar]').click()); await p.waitForTimeout(600);
  const h1 = await p.evaluate(()=>history.length);
  comprobar('la cruz cierra', (await abiertas(p)).length===0, (await abiertas(p)).join());
  comprobar('la cruz no deja entradas de mas en el historial', h1<=h0, 'antes '+h0+' despues '+h1);

  // Aero+
  await toca(p, '#ic-zona'); await p.waitForTimeout(1600);
  comprobar('Aero+ abre', await p.evaluate(()=>!document.getElementById('aeromas').hidden));
  await p.goBack(); await p.waitForTimeout(600);
  comprobar('atras sale de Aero+', await p.evaluate(()=>document.getElementById('aeromas').hidden));
  comprobar('sigue en el sitio', await enSitio(p));

  comprobar('sin errores de consola', p.errs.length===0, p.errs.join(' | '));
  await ctx.close();
}

// ============================================ ESCRITORIO
console.log('\n=== ESCRITORIO 1280x860');
{
  const { ctx, p } = await sesion(1280, 860);
  // en escritorio la pagina arranca con sus secciones abiertas: esa es la base
  const base = (await abiertas(p)).sort().join();
  console.log('  (base de escritorio: ' + base + ')');
  await toca(p, '[data-abrir="v-bloc"]');
  await toca(p, '[data-abrir="v-minas"]');
  await toca(p, '[data-abrir="v-repro"]'); await p.waitForTimeout(500);
  comprobar('en escritorio SI se abren varias', (await abiertas(p)).length>=3, (await abiertas(p)).join());

  // cerrar una del medio con su cruz, y despues atras
  await p.evaluate(()=>document.querySelector('#v-minas [data-cerrar]').click()); await p.waitForTimeout(400);
  comprobar('la cruz cierra la del medio', !(await abiertas(p)).includes('v-minas'), (await abiertas(p)).join());
  await p.goBack(); await p.waitForTimeout(500);
  comprobar('atras cierra la de arriba (no se desincroniza)',
            !(await abiertas(p)).includes('v-repro') && (await abiertas(p)).includes('v-bloc'), (await abiertas(p)).join());
  await p.goBack(); await p.waitForTimeout(500);
  {
    const v = await abiertas(p);
    comprobar('atras cierra la ultima que quedaba en la pila',
      !v.includes('v-bloc') && !v.includes('v-minas') && !v.includes('v-repro') && v.includes('v-inicio'), v.join());
  }
  comprobar('sigue en el sitio', await enSitio(p));

  // Escape cierra lo de arriba
  await toca(p, '[data-abrir="v-bloc"]'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  comprobar('Escape cierra lo de arriba', !(await abiertas(p)).includes('v-bloc'), (await abiertas(p)).join());

  comprobar('sin errores de consola', p.errs.length===0, p.errs.join(' | '));
  await ctx.close();
}
console.log('\n---- ' + ok + ' bien, ' + fallos + ' mal');
await b.close();
process.exit(fallos ? 1 : 0);
