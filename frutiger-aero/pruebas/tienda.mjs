import { chromium } from 'playwright';
import fs from 'node:fs';
const pase = fs.readFileSync('/tmp/pase.txt','utf8').trim();
const paseDonante = fs.readFileSync('/tmp/pase2.txt','utf8').trim();

// La prueba se arma SU propio dato en vez de confiar en lo que dejo otra corrida:
// una prueba que depende de datos de antes pasa o falla segun el orden en que se
// corran, que es la peor clase de prueba porque miente en las dos direcciones.
const huella = 'a'.repeat(64);
const nombreFixture = 'Fixture comunidad ' + Date.now();
async function sembrar(){
  const r = await fetch('http://localhost:8788/api/tienda', { method:'POST',
    headers:{'content-type':'application/json', authorization:'Bearer '+paseDonante},
    body: JSON.stringify({ hacer:'proponer', nombre:nombreFixture, version:'1.0',
      para:'Android', peso:'4 MB', que:'La propuso alguien de la comunidad.',
      enlace:'https://www.mediafire.com/file/q/x.apk/file', huella }) });
  if (!r.ok) throw new Error('no pude sembrar: ' + (await r.text()));
  const j = await r.json();
  const a = (j.esperando||[]).find(x=>x.nombre===nombreFixture);
  // y aprobarla, para que aparezca en la seccion de comunidad
  const r2 = await fetch('http://localhost:8788/api/tienda', { method:'POST',
    headers:{'content-type':'application/json', authorization:'Bearer '+pase},
    body: JSON.stringify({ hacer:'revisar', id:a.id, decision:'aprobar' }) });
  if (!r2.ok) throw new Error('no pude aprobar el fixture');
  return a.id;
}
async function limpiar(id){
  await fetch('http://localhost:8788/api/tienda', { method:'POST',
    headers:{'content-type':'application/json', authorization:'Bearer '+pase},
    body: JSON.stringify({ hacer:'borrar', id }) });
}
const idFixture = await sembrar();
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
await p.waitForTimeout(900);
const txt = ()=>p.evaluate(()=>document.getElementById('am-panel').innerText);

const t = await txt();
cmp('esta partida en dos secciones', t.includes('Del sitio') && t.includes('De la comunidad'));
cmp('la app del sitio esta en su seccion', t.includes('Aero Launcher'));
cmp('la de la comunidad aparece marcada como tal', t.includes('de la comunidad'));
cmp('muestra la huella del archivo', /sha256\s+[a-f0-9]{16}/.test(t), t.slice(0,200));
cmp('dice que no se reviso todavia, sin fingir un tilde verde', t.includes('Sin revisar todavía'));
cmp('hay boton de proponer para cualquiera', await p.evaluate(()=>
  [...document.querySelectorAll('#am-panel button')].some(b=>b.textContent==='Proponer una app')));

// el formulario de proponer avisa antes de llenar nada
await p.evaluate(()=>[...document.querySelectorAll('#am-panel button')].find(b=>b.textContent==='Proponer una app').click());
await p.waitForTimeout(500);
const f = await txt();
cmp('el formulario avisa que sin huella no se publica', f.includes('no se publica'));
cmp('aclara que el archivo no se sube', f.includes('sin subirlo') || f.includes('no se sube'));
cmp('tiene selector de archivo', await p.evaluate(()=>!!document.querySelector('#am-panel input[type=file]')));

// la huella se calcula en el navegador
const h = await p.evaluate(async ()=>{
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('apk de prueba'));
  return Array.from(new Uint8Array(d)).map(x=>('0'+x.toString(16)).slice(-2)).join('');
});
cmp('el navegador sabe calcular el sha256', h === '86f8878a2840fb22580ccf0b90201422dc3082938a35aaf4b6ca47d76f05ad49', h);

cmp('sin errores de consola', errs.length===0, errs.join(' | '));
await p.evaluate(()=>[...document.querySelectorAll('#am-panel button')].find(b=>b.textContent==='Cancelar').click());
await p.waitForTimeout(600);
await p.screenshot({path:'/tmp/pw2/tienda2.png'});
await limpiar(idFixture);
console.log('\n---- '+ok+' bien, '+mal+' mal');
await b.close(); process.exit(mal?1:0);
