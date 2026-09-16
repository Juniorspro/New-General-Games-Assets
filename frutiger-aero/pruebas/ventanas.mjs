import { chromium } from 'playwright';
import fs from 'node:fs';
const pase = fs.readFileSync('/tmp/pase.txt','utf8').trim();
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let ok=0, mal=0;
const cmp=(q,c,d)=>{ if(c){ok++;console.log('  OK   '+q);} else {mal++;console.log('  FALLA '+q+(d?'  -> '+d:''));} };

async function pagina(w,h){
  const ctx=await b.newContext({viewport:{width:w,height:h}, isMobile:w<720, hasTouch:w<720, serviceWorkers:'block'});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([pase])=>{
    localStorage.setItem('fa.sesion',JSON.stringify({pase,usuario:'probador'}));
    localStorage.setItem('fa.usuario',JSON.stringify({nombre:'Probador',via:'cuenta'}));
    localStorage.setItem('fa.aeromas','true'); localStorage.setItem('fa.colaboro','1');
  },[pase]);
  await p.goto('http://localhost:8788/',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2200); p.errs=errs; p.ctx=ctx; return p;
}
const caja=(p,id)=>p.evaluate(i=>{const v=document.getElementById(i);const r=v.getBoundingClientRect();
  return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
          suelta:v.classList.contains('suelta'),pos:getComputedStyle(v).position};},id);

// dispara los eventos de puntero sobre la barra, tal como los manda el navegador
const arrastrar=(p,id,dx,dy)=>p.evaluate(([i,dx,dy])=>{
  const t=document.querySelector('#'+i+' > .titulo');
  const r=t.getBoundingClientRect();
  const x=r.x+60, y=r.y+18;
  const ev=(tipo,cx,cy)=>t.dispatchEvent(new PointerEvent(tipo,{bubbles:true,cancelable:true,
    clientX:cx,clientY:cy,pointerId:1,button:0,buttons:1,isPrimary:true}));
  ev('pointerdown',x,y); ev('pointermove',x+dx/2,y+dy/2); ev('pointermove',x+dx,y+dy); ev('pointerup',x+dx,y+dy);
},[id,dx,dy]).then(()=>p.waitForTimeout(200));

// el punto donde se agarra, ¿lo recibe la barra de verdad?
const agarrable=(p,id)=>p.evaluate(i=>{
  const t=document.querySelector('#'+i+' > .titulo'), r=t.getBoundingClientRect();
  const e=document.elementFromPoint(Math.round(r.x+60),Math.round(r.y+18));
  return {si:!!(e&&e.closest('#'+i+' > .titulo')), quien:e?(e.id||e.className||e.tagName):'nada'};},id);
const cruzAlcanzable=(p,id)=>p.evaluate(i=>{
  const x=document.querySelector('#'+i+' [data-cerrar]'), r=x.getBoundingClientRect();
  const e=document.elementFromPoint(Math.round(r.x+r.width/2),Math.round(r.y+r.height/2));
  return {si:x===e||x.contains(e), quien:e?(e.id||e.className||e.tagName):'nada'};},id);

console.log('\n=== ESCRITORIO 1280x900');
{
  const p=await pagina(1280,900);
  const antes=await caja(p,'v-bloc');
  cmp('arranca pegada a la pagina', !antes.suelta && antes.pos!=='fixed', antes.pos);

  await arrastrar(p,'v-bloc',180,-120);
  const d=await caja(p,'v-bloc');
  cmp('arrastrar la despega', d.suelta && d.pos==='fixed', d.pos);
  cmp('se movio a donde la llevaste', Math.abs(d.x-(antes.x+180))<8, 'x '+antes.x+' -> '+d.x);

  await p.evaluate(()=>scrollBy(0,600)); await p.waitForTimeout(350);
  cmp('se queda quieta cuando bajas la pagina', (await caja(p,'v-bloc')).y===d.y);
  await p.evaluate(()=>scrollTo(0,0)); await p.waitForTimeout(250);

  // el corral: contra cada borde, la barra tiene que seguir agarrable
  for (const [nom,dx,dy] of [['arriba',0,-4000],['abajo',0,4000],['izquierda',-4000,0],['derecha',4000,0]]){
    await arrastrar(p,'v-bloc',dx,dy);
    const g=await agarrable(p,'v-bloc'), c=await cruzAlcanzable(p,'v-bloc'), q=await caja(p,'v-bloc');
    cmp('contra el borde de '+nom+': la barra sigue agarrable', g.si, 'la tapa '+g.quien+' (ventana en '+q.x+','+q.y+')');
    cmp('contra el borde de '+nom+': la cruz sigue tocable', c.si, 'la tapa '+c.quien);
  }

  const lugar=await caja(p,'v-bloc');
  await p.evaluate(()=>document.querySelector('#v-bloc [data-cerrar]').click()); await p.waitForTimeout(300);
  cmp('la cruz cierra una ventana movida', await p.evaluate(()=>document.getElementById('v-bloc').hidden));
  await p.evaluate(()=>document.querySelector('[data-abrir="v-bloc"]').click()); await p.waitForTimeout(400);
  const re=await caja(p,'v-bloc');
  cmp('al reabrir aparece donde la dejaste', re.suelta && Math.abs(re.x-lugar.x)<8, lugar.x+' -> '+re.x);

  await p.evaluate(()=>document.querySelector('#v-bloc > .titulo')
    .dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
  await p.waitForTimeout(300);
  const vu=await caja(p,'v-bloc');
  cmp('doble clic la devuelve a su lugar en la pagina', !vu.suelta && vu.pos!=='fixed', vu.pos);

  await arrastrar(p,'v-minas',220,-60);
  const g=await caja(p,'v-minas');
  await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(2000);
  const tr=await caja(p,'v-minas');
  cmp('la posicion sobrevive a recargar', tr.suelta && Math.abs(tr.x-g.x)<8, g.x+','+g.y+' -> '+tr.x+','+tr.y);

  cmp('sin errores de consola', p.errs.length===0, p.errs.join(' | '));
  await p.ctx.close();
}

console.log('\n=== TELEFONO 412x892');
{
  const p=await pagina(412,892);
  await p.evaluate(()=>localStorage.setItem('fa.lugares',JSON.stringify({'v-bloc':{x:700,y:300,w:838}})));
  await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(2000);
  await p.evaluate(()=>document.querySelector('[data-abrir="v-bloc"]').click()); await p.waitForTimeout(400);
  const c=await caja(p,'v-bloc');
  cmp('no hereda la posicion de la compu', !c.suelta && c.x===0, 'x='+c.x+' suelta='+c.suelta);
  cmp('sigue a pantalla completa', c.w>=400, 'ancho '+c.w);
  cmp('la cruz sigue alcanzable', (await cruzAlcanzable(p,'v-bloc')).si);
  await arrastrar(p,'v-bloc',100,100);
  cmp('en el telefono NO se mueve', !(await caja(p,'v-bloc')).suelta);
  cmp('sin errores de consola', p.errs.length===0, p.errs.join(' | '));
  await p.ctx.close();
}
console.log('\n---- '+ok+' bien, '+mal+' mal');
await b.close(); process.exit(mal?1:0);
