import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

// Esta prueba SE DA su propia cuota antes de mirar nada. Antes daba por hecha
// la que dejaba cuota-a-mano.mjs, asi que pasaba sola y fallaba cuando se
// corrian las cinco en orden: la peor clase de falla, porque el codigo estaba
// bien y la prueba decia que no.
{
  const jefe = fs.readFileSync('/tmp/pase.txt','utf8').trim();
  const r = await fetch('http://localhost:8788/api/editor', { method:'POST',
    headers:{'content-type':'application/json', authorization:'Bearer '+jefe},
    body: JSON.stringify({ hacer:'dar', usuario:2, meses:1, ref:'fixture-cuota-'+Date.now() }) });
  if (!r.ok) throw new Error('no pude sembrar la cuota: ' + (await r.text()));
}
let ok=0, mal=0;
const cmp=(q,c,d)=>{ if(c){ok++;console.log('  OK   '+q);} else {mal++;console.log('  FALLA '+q+(d?'  -> '+d:''));} };

async function comoQuien(archivoPase, etiqueta){
  const pase = fs.readFileSync(archivoPase,'utf8').trim();
  const ctx=await b.newContext({viewport:{width:1280,height:900}, serviceWorkers:'block'});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([pase])=>{
    localStorage.setItem('fa.sesion',JSON.stringify({pase,usuario:'x'}));
    localStorage.setItem('fa.usuario',JSON.stringify({nombre:'X',via:'cuenta'}));
    localStorage.setItem('fa.aeromas','true'); localStorage.setItem('fa.colaboro','1');
  },[pase]);
  await p.goto('http://localhost:8788/',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{const l=document.getElementById('logon'); if(l) l.hidden=true;});
  await p.evaluate(()=>document.getElementById('ic-zona').click());
  await p.waitForSelector('#aeromas:not([hidden])',{timeout:15000});
  await p.evaluate(()=>[...document.querySelectorAll('#am-apps button')].find(x=>x.dataset.app==='tienda').click());
  await p.waitForTimeout(1800);
  const t = await p.evaluate(()=>document.getElementById('am-panel').innerText);
  console.log('\n--- ' + etiqueta);
  return { p, ctx, t, errs };
}

{
  const { p, ctx, t, errs } = await comoQuien('/tmp/pase.txt', 'como JEFE');
  cmp('hay panel de cuota', t.includes('Publicar apps que cobran'), t.slice(-400));
  cmp('al jefe le dice que no paga cuota', t.includes('sin cuota'), t.slice(-400));
  cmp('sin errores de consola', errs.length===0, errs.join(' | '));
  await ctx.close();
}
{
  const { p, ctx, t, errs } = await comoQuien('/tmp/pase2.txt', 'como EDITOR con cuota al dia');
  cmp('dice hasta cuando le vale', /al d[íi]a hasta el/.test(t), t.slice(-500));
  cmp('aclara que la plata de las ventas no pasa por el sitio',
      t.includes('por afuera') && t.includes('no pasa plata'), t.slice(-500));
  cmp('dice el precio de la cuota', t.includes('US$ 10'), t.slice(-500));
  // el formulario de proponer trae la casilla de cobro
  await p.evaluate(()=>[...document.querySelectorAll('#am-panel button')].find(b=>b.textContent==='Proponer una app').click());
  await p.waitForTimeout(500);
  const f = await p.evaluate(()=>document.getElementById('am-panel').innerText);
  cmp('el formulario tiene la casilla de que cobra', f.includes('Esta app cobra'), f.slice(0,400));
  cmp('aclara que las gratis no piden nada', f.includes('las gratis no piden nada'));
  cmp('tiene campo de precio', await p.evaluate(()=>
    [...document.querySelectorAll('#am-panel input')].some(i=>(i.placeholder||'').includes('US$ 3'))));
  cmp('sin errores de consola', errs.length===0, errs.join(' | '));
  await p.screenshot({path:'/tmp/pw2/cuota.png'});
  await ctx.close();
}
console.log('\n---- '+ok+' bien, '+mal+' mal');
await b.close(); process.exit(mal?1:0);
