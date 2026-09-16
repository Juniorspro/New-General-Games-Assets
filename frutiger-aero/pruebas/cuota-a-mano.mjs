import { chromium } from 'playwright';
import fs from 'node:fs';
const pase = fs.readFileSync('/tmp/pase.txt','utf8').trim();
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let ok=0, mal=0;
const cmp=(q,c,d)=>{ if(c){ok++;console.log('  OK   '+q);} else {mal++;console.log('  FALLA '+q+(d?'  -> '+d:''));} };
const ctx=await b.newContext({viewport:{width:1280,height:900}, serviceWorkers:'block'});
const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(([pase])=>{
  localStorage.setItem('fa.sesion',JSON.stringify({pase,usuario:'probador'}));
  localStorage.setItem('fa.usuario',JSON.stringify({nombre:'Probador',via:'cuenta'}));
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
cmp('el jefe ve el formulario de dar cuota', t.includes('Darle la cuota a alguien'), t.slice(-500));
cmp('explica por que existe (transferencia que no avisa)', t.includes('ninguna pasarela te va a avisar'));
cmp('avisa lo del comprobante', t.includes('no suma dos meses'));

// darle la cuota a @otro desde la pantalla
await p.evaluate(()=>{
  const e=[...document.querySelectorAll('#am-panel input[type=text]')];
  const c=e.find(x=>(x.placeholder||'').includes('@usuario'));
  const m=e.find(x=>(x.placeholder||'')==='meses');
  const r=e.find(x=>(x.placeholder||'').includes('comprobante'));
  c.value='@otro'; m.value='2'; r.value='desde-la-pantalla-1';
  [...document.querySelectorAll('#am-panel button')].find(b=>b.textContent==='Dar cuota').click();
});
await p.waitForTimeout(1500);
const t2 = await p.evaluate(()=>document.getElementById('am-panel').innerText);
cmp('confirma a quien se la dio y hasta cuando', /@otro puede publicar apps que cobran hasta el/.test(t2), t2.slice(-300));

// el mismo comprobante de nuevo
await p.evaluate(()=>{
  const e=[...document.querySelectorAll('#am-panel input[type=text]')];
  e.find(x=>(x.placeholder||'').includes('@usuario')).value='@otro';
  e.find(x=>(x.placeholder||'').includes('comprobante')).value='desde-la-pantalla-1';
  [...document.querySelectorAll('#am-panel button')].find(b=>b.textContent==='Dar cuota').click();
});
await p.waitForTimeout(1500);
const t3 = await p.evaluate(()=>document.getElementById('am-panel').innerText);
cmp('con el mismo comprobante avisa que ya estaba y no suma', t3.includes('ya estaba cargado'), t3.slice(-300));
cmp('sin errores de consola', errs.length===0, errs.join(' | '));
await p.screenshot({path:'/tmp/pw2/dar.png'});
console.log('\n---- '+ok+' bien, '+mal+' mal');
await b.close(); process.exit(mal?1:0);
