// interfaz.js — la pantalla: chat, renglones de actividad, hojas y vista previa.
//
// El detalle que pidió el usuario y que define cómo se ve todo esto: cuando un
// agente escribe un archivo, el contenido NO se muestra. Se ve un renglón que
// dice "ejecutando" y cuánto lleva escrito, y cuando termina se convierte en un
// tilde con la ruta. Igual que la terminal de Claude Code.

// Cada módulo va adentro de su propia función: son <script> clásicos y
// comparten el ámbito global, así que sin esto el `const G` de nucleo.js
// choca con el `const {G}` de los demás y no carga ninguno.
(function(){
'use strict';

const $=s=>document.querySelector(s);
const {G,LIBRE,TOPES,Taller,pedir,pedirLargo,compactar,salvar,Corte,abortar,reanudar}=window.PeakNucleo;
const {correrAgente,human}=window.PeakAgente;
const {correrFlujo}=window.PeakFlujo;
const FMT=window.PeakFormatos;

let hist=JSON.parse(localStorage.getItem('hist')||'[]');
let trabajando=false;
function guardarHist(){ try{ localStorage.setItem('hist',JSON.stringify(hist.slice(-40))); }catch(e){} }
function pintarCab(){
  const m=(G.preset==='free'?'gratis · ':'')+(G.modelo||'—');
  $('#cabModelo').textContent=m+(G.modo==='chat'?'':' · '+(G.modo==='agente'?'agente':'workflow'));
}
function abajo(){ $('#hilo').scrollTop=1e9; }

// ── burbujas ─────────────────────────────────────────────────────────────────
function poner(t,q,guardable){
  const d=document.createElement('div'); d.className='msg '+q;
  if(q==='el'&&guardable) pintarAsistente(d,t); else d.textContent=t;
  if(guardable){
    const b=document.createElement('button'); b.className='guardar'; b.textContent='⤓ guardar';
    b.onclick=()=>menuFormato(d.dataset.crudo||d.textContent);
    d.dataset.crudo=t; d.appendChild(b);
  }
  $('#hilo').appendChild(d); abajo(); return d;
}
function repintar(){
  $('#hilo').innerHTML='';
  if(!hist.length) poner('Hola. Escribí lo que necesites.\n\n'+
    '💬 Chat: charla normal.\n'+
    '⚡ Agente: hace el trabajo solo y te deja los archivos hechos.\n'+
    '🧩 Workflow: parte la tarea entre varios agentes en paralelo.','el');
  hist.forEach(m=>poner(m.content,m.role==='user'?'yo':'el',m.role!=='user'));
}

// ── renglones de actividad ───────────────────────────────────────────────────
function panelActs(){
  const d=document.createElement('div'); d.className='msg el';
  const a=document.createElement('div'); a.className='acts';
  d.appendChild(a); $('#hilo').appendChild(d); abajo();
  return a;
}
/** Un renglón. estado: 'corre' | 'hecho' | 'mal' */
function renglon(panel, texto, det, estado, etiqueta){
  const f=document.createElement('div'); f.className='act '+(estado||'');
  const p=document.createElement('span'); p.className='pip'+(estado==='corre'?' lat':'');
  p.textContent=estado==='hecho'?'✓':estado==='mal'?'✗':'⏺';
  const q=document.createElement('span'); q.className='qué';
  if(etiqueta){ const e=document.createElement('span'); e.className='agente-tag';
                e.textContent=etiqueta; q.appendChild(e); }
  const t=document.createElement('span'); t.textContent=texto; q.appendChild(t);
  const s=document.createElement('span'); s.className='det'; if(det) s.textContent=' '+det;
  q.appendChild(s);
  f.appendChild(p); f.appendChild(q); panel.appendChild(f); abajo();
  return {
    nodo:f, detNodo:s, pipNodo:p, txtNodo:t,
    detalle(x){ s.textContent=' '+x; },
    texto(x){ t.textContent=x; },
    estado(e){ f.className='act '+e; p.className='pip'+(e==='corre'?' lat':'');
               p.textContent=e==='hecho'?'✓':e==='mal'?'✗':'⏺'; }
  };
}
function sangria(panel, texto){
  const d=document.createElement('div'); d.className='sangria'; d.textContent=texto;
  panel.appendChild(d); abajo(); return d;
}

const VERBO={crear:'Escribiendo', anexar:'Ampliando', leer:'Leyendo', listar:'Mirando el taller',
  borrar:'Borrando', buscar:'Buscando', guardar:'Exportando', plan:'Plan', pensar:'Pensando',
  listo:'Cerrando', agente:'Largando agente'};

/**
 * Engancha los eventos del agente a la pantalla.
 * Acá está la regla: el contenido de <peak:crear> nunca llega al DOM, solo
 * su tamaño. Lo que se ve es "ejecutando".
 */
function pintor(panel){
  const filas=new Map();          // id de acción -> renglón
  let prosaNodo=null, prosaTxt='';
  let pasoVivo=null;              // el paso del workflow que está corriendo
  const cerrarPaso=()=>{ if(pasoVivo){ pasoVivo.estado('hecho'); pasoVivo.detalle(''); pasoVivo=null; } };
  const al=(evento,d)=>{
    const et=d.etiqueta&&d.etiqueta!=='principal'?d.etiqueta:'';
    switch(evento){
      case 'prosa': {
        const t=d.texto;
        if(!t.trim()&&!prosaNodo) return;
        if(!prosaNodo){ prosaNodo=sangria(panel,''); prosaTxt=''; }
        prosaTxt+=t; prosaNodo.textContent=prosaTxt.trim(); abajo();
        return;
      }
      case 'abrir': {
        prosaNodo=null; prosaTxt='';
        const a=d.accion;
        const qué=VERBO[a.nombre]||a.nombre;
        const obj=a.attrs.archivo||a.attrs.nombre||a.attrs.texto||'';
        filas.set(a.id, renglon(panel, qué+(obj?' '+obj:''), 'ejecutando', 'corre', et));
        return;
      }
      case 'avance': {
        const f=filas.get(d.accion.id);
        // esto es todo lo que se ve del archivo mientras se escribe: su peso
        if(f) f.detalle('ejecutando · '+human(d.bytes));
        return;
      }
      case 'cerrar': {
        const f=filas.get(d.accion.id);
        if(f&&d.accion.nombre==='plan'){
          f.estado('hecho'); f.detalle('');
          sangria(panel, d.accion.texto.trim());
        }
        return;
      }
      case 'resultado': {
        const f=filas.get(d.accion.id); if(!f) return;
        const mal=/^(ERROR|Falló|No existe|No hay)/.test(d.salida);
        f.estado(mal?'mal':'hecho');
        const a=d.accion;
        if(a.nombre==='crear'||a.nombre==='anexar'||a.nombre==='guardar')
          f.detalle(human((a.texto||'').length)+(a.ruta&&!String(a.ruta).startsWith('ERROR')
            ?' → '+a.ruta:''));
        else if(a.nombre==='listo'){ f.detalle(''); }
        else f.detalle(d.salida.split('\n')[0].slice(0,70));
        return;
      }
      case 'seguir':
        renglon(panel,'Se cortó por largo, sigo escribiendo',
                'continuación '+d.n+' · '+human(d.largo),'hecho',et);
        return;
      case 'compactando': renglon(panel,'Compactando el contexto','','hecho',et); return;
      case 'delegando': renglon(panel,'Largando '+d.cuantos+' agentes en paralelo','','hecho',et); return;
      case 'paso':
        // el paso anterior recién se da por hecho cuando arranca el siguiente
        cerrarPaso();
        pasoVivo=renglon(panel,d.nombre,'ejecutando','corre','');
        return;
      case 'plan': sangria(panel, d.pedazos.map((p,i)=>(i+1)+'. '+p).join('\n')); return;
      case 'cortado': renglon(panel,'Cortado','','mal',et); return;
      case 'vuelta': prosaNodo=null; prosaTxt=''; return;
    }
  };
  al.cerrar=cerrarPaso;
  return al;
}

// ── mandar ───────────────────────────────────────────────────────────────────
function ocupado(v){
  trabajando=v;
  $('#bEnviar').classList.toggle('oculto',v);
  $('#bDetener').classList.toggle('oculto',!v);
}
$('#bDetener').onclick=()=>{ abortar(); Peak.aviso('Cortando…'); };

async function enviar(){
  const ta=$('#entrada'), txt=ta.value.trim();
  if(!txt||trabajando) return;
  ta.value=''; ta.style.height='auto';
  hist.push({role:'user',content:txt}); poner(txt,'yo'); guardarHist();
  reanudar(); ocupado(true);
  try{
    if(G.modo==='chat') await modoChat();
    else await modoAgente(txt, G.modo==='flujo');
  }catch(e){
    poner('Error: '+pista(e.message),'err');
  }finally{ ocupado(false); }
}
function pista(m){
  m=String(m);
  if(/HTTP 401|HTTP 403/.test(m)) return 'la llave no sirve. Revisá el motor en ⚙.';
  if(/HTTP 429/.test(m))          return 'te frenaron por límite de uso. Probá en un rato.';
  if(/HTTP 5\d\d/.test(m))        return 'el motor tuvo un problema: '+m;
  if(/cortado/.test(m))           return 'cortado.';
  return 'no pude conectar. '+m;
}

async function modoChat(){
  const caja=poner('…','el',false);
  hist=await compactar(hist, ()=>{ caja.textContent='(compactando el contexto…)'; });
  let texto='';
  const r=await pedirLargo({
    mensajes:hist,
    onTexto:(d,t)=>{ texto=t; caja.textContent=t; abajo(); },
    incompleto:()=>false
  });
  const fin=(r.texto||texto||'(el modelo no devolvió nada)').trim();
  hist.push({role:'assistant',content:fin}); guardarHist();
  caja.remove(); repintar();
}

async function modoAgente(tarea, enFlujo){
  const panel=panelActs();
  const al=pintor(panel);
  const contexto=hist.slice(-8,-1).filter(m=>m.content&&m.content.length<4000);
  let r;
  try{
    if(enFlujo) r=await correrFlujo({tarea, al});
    else        r=await correrAgente({tarea, contexto, al, etiqueta:'principal'});
  } finally { al.cerrar(); }
  const resumen=(r.resumen||'Listo.').trim();
  hist.push({role:'assistant',content:resumen}); guardarHist();
  poner(resumen,'el',true);
  pintarTaller();
}

$('#bEnviar').onclick=enviar;
$('#entrada').addEventListener('input',e=>{ e.target.style.height='auto';
  e.target.style.height=Math.min(e.target.scrollHeight,innerHeight*.38)+'px'; });

// ── modos ────────────────────────────────────────────────────────────────────
const MODOS={mChat:'chat', mAgente:'agente', mFlujo:'flujo'};
function pintarModo(){
  for(const [id,m] of Object.entries(MODOS)) $('#'+id).classList.toggle('sel',G.modo===m);
  pintarCab();
}
for(const [id,m] of Object.entries(MODOS))
  $('#'+id).onclick=()=>{ G.modo=m; salvar(); pintarModo(); };

// ── adjuntar: va al taller, no al contexto ───────────────────────────────────
// Antes el archivo entero se metía en el historial y reventaba la ventana del
// modelo. Ahora se guarda en el taller y el agente lee los pedazos que precisa.
$('#bAdjuntar').onclick=()=>Peak.abrir();
window.peakArchivoLeido=d=>{
  if(d.error){ poner('No pude leer el archivo: '+d.error,'err'); return; }
  const nom=Taller.escribir(d.nombre||'adjunto.txt', d.texto);
  const aviso='📎 '+nom+' ('+d.texto.length.toLocaleString('es-AR')+' caracteres) '+
    'quedó en el taller.'+(d.cortado?' (se cortó: el archivo era más grande que el techo)':'');
  poner(aviso,'yo');
  hist.push({role:'user',content:
    'Adjunté el archivo "'+nom+'" al taller ('+d.texto.length+' caracteres). '+
    'Leelo con <peak:leer archivo="'+nom+'"> cuando lo necesites.\n\n'+
    'Primeras líneas:\n'+d.texto.slice(0,900)});
  guardarHist(); pintarTaller();
};
$('#bLimpiar').onclick=()=>{ hist=[]; guardarHist(); repintar(); };

// ── artifacts ────────────────────────────────────────────────────────────────
const EXT_LANG={html:'html',xml:'xml',svg:'svg',js:'js',javascript:'js',ts:'ts',
 typescript:'ts',css:'css',py:'py',python:'py',json:'json',java:'java',c:'c',cpp:'cpp',
 sh:'sh',bash:'sh',md:'md',markdown:'md',sql:'sql',csv:'csv',php:'php',go:'go',rs:'rs'};
let _pvTexto='', _pvExt='html', _pvNom='pagina';
function verPreview(codigo, ext, titulo){
  _pvTexto=codigo; _pvExt=ext; _pvNom=(titulo||'archivo').replace(/[^A-Za-z0-9._-]/g,'_');
  let doc=codigo;
  if(ext==='svg') doc='<!doctype html><meta charset=utf-8><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#fff">'+codigo+'</body>';
  else if(ext==='md'||ext==='txt') doc='<!doctype html><meta charset=utf-8><body style="font:16px system-ui;max-width:44em;margin:1.5em auto;padding:0 1em;white-space:pre-wrap">'+codigo.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</body>';
  else if(!/^\s*<(!doctype|html)/i.test(codigo)) doc='<!doctype html><meta charset=utf-8>'+codigo;
  $('#pvFrame').srcdoc=doc;
  $('#pvTit').textContent=titulo||'Vista previa';
  $('#preview').classList.add('ver');
}
$('#pvCerrar').onclick=()=>{ $('#preview').classList.remove('ver'); $('#pvFrame').srcdoc=''; };
$('#pvBajar').onclick=()=>{
  const nom=_pvNom.endsWith('.'+_pvExt)?_pvNom:_pvNom+'.'+_pvExt;
  const r=window.PeakAgente.guardarEnDisco(nom,_pvTexto);
  Peak.aviso(String(r).startsWith('ERROR')?r:'Guardado en '+r);
};
function pintarAsistente(cont, texto){
  cont.textContent='';
  const re=/```([^\n`]*)\n?([\s\S]*?)```/g;
  let i=0,m,idx=0;
  while((m=re.exec(texto))){
    if(m.index>i){ const t=document.createElement('span'); t.textContent=texto.slice(i,m.index); cont.appendChild(t); }
    const lang=(m[1]||'').trim().toLowerCase();
    const ext=EXT_LANG[lang]||(lang||'txt');
    cont.appendChild(cuadro(m[2].replace(/\n$/,''), ext, ++idx));
    i=re.lastIndex;
  }
  if(i<texto.length){ const t=document.createElement('span'); t.textContent=texto.slice(i); cont.appendChild(t); }
  if(idx===0) cont.textContent=texto;
}
function cuadro(codigo, ext, n){
  const box=document.createElement('div'); box.className='bloque';
  const cab=document.createElement('div'); cab.className='bloque-cab';
  const et=document.createElement('span'); et.className='lang'; et.textContent=ext.toUpperCase();
  cab.appendChild(et);
  if(['html','svg','md','xml','txt'].includes(ext)){
    const bp=document.createElement('button'); bp.className='prev'; bp.textContent='▷ Vista previa';
    bp.onclick=()=>verPreview(codigo, ext==='xml'?'html':ext, 'Bloque '+n);
    cab.appendChild(bp);
  }
  const bd=document.createElement('button'); bd.textContent='⤓ '+ext;
  bd.onclick=()=>{ const r=window.PeakAgente.guardarEnDisco('peakcode_'+n+'.'+ext, codigo);
    Peak.aviso(String(r).startsWith('ERROR')?r:'Guardado en '+r); };
  cab.appendChild(bd);
  const pre=document.createElement('pre'); pre.textContent=codigo;
  box.appendChild(cab); box.appendChild(pre);
  return box;
}

// ── hoja de formatos ─────────────────────────────────────────────────────────
let _guardarTexto='';
function menuFormato(texto){
  _guardarTexto=texto;
  const l=$('#fmtLista'); l.innerHTML='';
  let grupo='';
  FMT.FORMATOS.forEach(f=>{
    if(f.grupo!==grupo){ grupo=f.grupo;
      const g=document.createElement('div'); g.className='grupo'; g.textContent=grupo; l.appendChild(g); }
    const d=document.createElement('div'); d.className='mod';
    d.innerHTML='<div class=ava></div><div class=cuerpo><div class=nom></div>'+
      '<div class=desc></div></div>';
    d.querySelector('.ava').textContent=f.ext.toUpperCase().slice(0,2);
    d.querySelector('.nom').textContent=f.nom;
    d.querySelector('.desc').textContent='.'+f.ext;
    d.onclick=()=>{ cerrarFmt(); hacerArchivo(f); };
    l.appendChild(d);
  });
  $('#sheetFmt').classList.add('ver'); $('#velo').classList.add('ver');
}
function cerrarFmt(){ $('#sheetFmt').classList.remove('ver'); cerrarVeloSiSobra(); }
function hacerArchivo(f){
  if(f.taller) return bajarZip();
  const base=(prompt('Nombre del archivo:', 'peakcode.'+f.ext)||'').trim();
  if(!base) return;
  const nom=base.endsWith('.'+f.ext)?base:base+'.'+f.ext;
  const r=window.PeakAgente.guardarEnDisco(nom, _guardarTexto);
  Peak.aviso(String(r).startsWith('ERROR')?r:'Guardado en '+r);
}

// ── taller ───────────────────────────────────────────────────────────────────
function pintarTaller(){
  const l=$('#tallerLista'); if(!l) return;
  l.innerHTML='';
  const xs=Taller.listar();
  if(!xs.length){ const d=document.createElement('div'); d.className='sh-tit';
    d.textContent='Todavía no hay nada. Los agentes dejan acá lo que hacen.';
    l.appendChild(d); return; }
  xs.forEach(x=>{
    const f=document.createElement('div'); f.className='tallerfila';
    const n=document.createElement('div'); n.className='n'; n.textContent=x.nombre;
    const t=document.createElement('div'); t.className='t'; t.textContent=human(x.largo);
    const bv=document.createElement('button'); bv.textContent='▷';
    bv.onclick=()=>{ cerrarTaller(); verPreview(Taller.leer(x.nombre),
      FMT.normExt((x.nombre.match(/\.([A-Za-z0-9]+)$/)||[,'txt'])[1]), x.nombre); };
    const bg=document.createElement('button'); bg.textContent='⤓';
    bg.onclick=()=>{ cerrarTaller(); menuFormato(Taller.leer(x.nombre)); };
    const bb=document.createElement('button'); bb.textContent='✕';
    bb.onclick=()=>{ Taller.borrar(x.nombre); pintarTaller(); };
    f.appendChild(n); f.appendChild(t); f.appendChild(bv); f.appendChild(bg); f.appendChild(bb);
    l.appendChild(f);
  });
}
function bajarZip(){
  const xs=Taller.listar();
  if(!xs.length) return Peak.aviso('El taller está vacío.');
  const bytes=FMT.zip(xs.map(x=>({nombre:x.nombre, texto:Taller.leer(x.nombre)})));
  const r=Peak.guardarBinario('peakcode-taller.zip', FMT.b64(bytes), 'application/zip');
  Peak.aviso(String(r).startsWith('ERROR')?r:'Guardado en '+r);
}
$('#bTaller').onclick=()=>{ pintarTaller();
  $('#sheetTaller').classList.add('ver'); $('#velo').classList.add('ver'); };
function cerrarTaller(){ $('#sheetTaller').classList.remove('ver'); cerrarVeloSiSobra(); }
$('#bTallerZip').onclick=bajarZip;
$('#bTallerVaciar').onclick=()=>{ if(confirm('¿Vaciar el taller?')){ Taller.vaciar(); pintarTaller(); } };

function cerrarVeloSiSobra(){
  const abierta=['#sheet','#sheetFmt','#sheetTaller'].some(s=>$(s)?.classList.contains('ver'));
  if(!abierta) $('#velo').classList.remove('ver');
}

// ── ajustes ──────────────────────────────────────────────────────────────────
function pintarZonas(){
  const omni=$('#cPreset').value==='omni';
  $('#zonaOmni').classList.toggle('oculto',!omni);
  $('#zonaFree').classList.toggle('oculto',omni);
}
$('#cPreset').onchange=pintarZonas;
$('#bAjustes').onclick=()=>{
  $('#cPreset').value=G.preset;
  $('#cURL').value=G.preset==='omni'?G.chat.replace(/\/chat\/completions$/,''):'';
  $('#cClave').value=localStorage.getItem('clave')||'';
  $('#cObreros').value=String(G.obreros);
  pintarZonas(); $('#ajustes').classList.add('ver');
};
$('#bCerrar').onclick=()=>$('#ajustes').classList.remove('ver');
$('#bConectar').onclick=async()=>{
  const base=$('#cURL').value.trim().replace(/\/+$/,'').replace(/\/v1$/,'');
  const clave=$('#cClave').value;
  const e=$('#eOmni'); e.classList.remove('oculto','ok','no'); e.textContent='Conectando…';
  try{
    const r1=await fetch(base+'/api/auth/login',{method:'POST',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:clave})});
    if(!r1.ok) throw new Error('la contraseña no entró (HTTP '+r1.status+')');
    const r2=await fetch(base+'/api/keys',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:'PeakCode '+new Date().toISOString().slice(0,10)})});
    if(!r2.ok) throw new Error('no me dio la llave (HTTP '+r2.status+')');
    const j=await r2.json();
    const k=j.key||j.apiKey||j.api_key||(j.data&&j.data.key);
    if(!k) throw new Error('contestó pero sin llave adentro');
    G.key=k; localStorage.setItem('clave',clave);
    e.classList.add('ok'); e.textContent='Listo. Llave guardada.';
    traerModelos(base);
  }catch(err){ e.classList.add('no'); e.textContent='No salió: '+err.message; }
};
async function traerModelos(base){
  try{
    const r=await fetch(base+'/v1/models',{headers:{Authorization:'Bearer '+G.key}});
    const xs=((await r.json()).data||[]).map(m=>m.id).sort();
    const sel=$('#cModelo'); sel.innerHTML='';
    xs.forEach(id=>{ const o=document.createElement('option'); o.value=id; o.textContent=id; sel.appendChild(o); });
  }catch(e){}
}
$('#bTraer').onclick=()=>traerModelos($('#cURL').value.trim().replace(/\/+$/,'').replace(/\/v1$/,''));
$('#bGuardar').onclick=()=>{
  G.obreros=+$('#cObreros').value||3;
  if($('#cPreset').value==='free'){ Object.assign(G,LIBRE); }
  else{
    const base=$('#cURL').value.trim().replace(/\/+$/,'').replace(/\/v1$/,'');
    G.preset='omni'; G.chat=base+'/v1/chat/completions';
    if($('#cModelo').value) G.modelo=$('#cModelo').value;
  }
  salvar(); pintarCab(); $('#ajustes').classList.remove('ver'); Peak.aviso('Guardado');
};

// ── selector de modelos ──────────────────────────────────────────────────────
let CATALOGO=[];
function lindo(id){
  const b=id.split('/').pop().replace(/[-_]/g,' ');
  return b.charAt(0).toUpperCase()+b.slice(1);
}
async function cargarCatalogo(){
  CATALOGO=[];
  try{
    if(G.preset==='free'){
      const r=await fetch('https://text.pollinations.ai/models');
      const d=await r.json();
      CATALOGO=(Array.isArray(d)?d:[]).map(m=>({id:m.name||m.id, nom:lindo(m.name||m.id),
        desc:(m.description||'')+(m.reasoning?' · razona':'')}));
    }else{
      const base=G.chat.replace(/\/chat\/completions$/,'');
      const r=await fetch(base+'/models',{headers:{Authorization:'Bearer '+G.key}});
      const xs=((await r.json()).data||[]).map(m=>m.id);
      xs.sort((a,b)=>(b.startsWith('auto/')-a.startsWith('auto/'))||a.localeCompare(b));
      CATALOGO=xs.map(id=>({id, nom:lindo(id),
        desc:id.startsWith('auto/')?'ruteo: elige el mejor disponible solo':''}));
    }
  }catch(e){}
  if(!CATALOGO.length) CATALOGO=[{id:G.modelo||'openai',nom:lindo(G.modelo||'openai'),desc:''}];
  if(!CATALOGO.find(m=>m.id===G.modelo)) G.modelo=CATALOGO[0].id;
}
function abrirSheet(){
  const l=$('#shLista'); l.innerHTML='';
  CATALOGO.forEach(m=>{
    const d=document.createElement('div'); d.className='mod'+(m.id===G.modelo?' sel':'');
    d.innerHTML='<div class=ava></div><div class=cuerpo><div class=nom></div><div class=desc></div></div>'+
      (m.id===G.modelo?'<div class=tick>✓</div>':'');
    d.querySelector('.ava').textContent=(m.nom[0]||'?').toUpperCase();
    d.querySelector('.nom').textContent=m.nom;
    d.querySelector('.desc').textContent=m.desc||m.id;
    d.onclick=()=>{ G.modelo=m.id; salvar(); pintarCab(); pintarChip(); cerrarSheet(); };
    l.appendChild(d);
  });
  $('#sheet').classList.add('ver'); $('#velo').classList.add('ver');
}
function cerrarSheet(){ $('#sheet').classList.remove('ver'); cerrarVeloSiSobra(); }
$('#velo').onclick=()=>{ cerrarSheet(); cerrarFmt(); cerrarTaller(); };
$('#bModelo').onclick=async()=>{ if(!CATALOGO.length) await cargarCatalogo(); abrirSheet(); };
function pintarChip(){ $('#bModelo .n').textContent=lindo(G.modelo||'—'); }

// ── arranque ─────────────────────────────────────────────────────────────────
cargarCatalogo().then(pintarChip);
pintarModo(); pintarCab(); repintar(); pintarTaller();

})();
