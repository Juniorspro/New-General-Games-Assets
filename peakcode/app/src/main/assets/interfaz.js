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
const {G,LIBRE,TOPES,Taller,pedir,mandar,pedirLargo,compactar,salvar,Corte,abortar,reanudar}=window.PeakNucleo;
const {correrAgente,human}=window.PeakAgente;
const {correrFlujo}=window.PeakFlujo;
const FMT=window.PeakFormatos;
const {Sesiones}=window.PeakSesiones;
const {Conectores,interpretar,conectar}=window.PeakMCP;
const {Flota,cargarCatalogos,clasificar}=window.PeakFlota;

let hist=[];
let trabajando=false;

// El taller no decide dónde se guarda: lo guarda la sesión que está abierta.
Taller.alCambiar=()=>guardarSesion();

function guardarSesion(){
  const id=Sesiones.activa; if(!id) return;
  Sesiones.guardarDatos(id,{mensajes:hist.slice(-60), taller:Taller.archivos});
}
function guardarHist(){ guardarSesion(); }

/** Abre una conversación: carga su historial y su taller. */
function abrirSesion(id){
  if(!Sesiones.encabezado(id)) return;
  Sesiones.abrir(id);
  const d=Sesiones.datos(id);
  hist=d.mensajes||[];
  Taller.cargarDe(d.taller||{});
  repintar(); pintarTaller(); pintarCajon(); pintarCab();
}
function nuevaSesion(){
  Sesiones.nueva();
  hist=[]; Taller.cargarDe({});
  repintar(); pintarTaller(); pintarCajon(); pintarCab();
}
/** Arranque: la última abierta, o una nueva si es la primera vez. */
function arrancarSesiones(){
  // migración de la 0.9: si había un historial suelto, se convierte en la primera
  const viejo=(()=>{ try{ return JSON.parse(localStorage.getItem('hist')||'[]'); }catch(e){ return []; } })();
  if(!Sesiones.lista.length){
    const s=Sesiones.nueva(viejo.length?Sesiones.tituloDe(viejo[0].content):'Conversación nueva');
    if(viejo.length){
      const tallerViejo=(()=>{ try{ return JSON.parse(localStorage.getItem('taller')||'{}'); }catch(e){ return {}; } })();
      Sesiones.guardarDatos(s.id,{mensajes:viejo, taller:tallerViejo});
      try{ localStorage.removeItem('hist'); localStorage.removeItem('taller'); }catch(e){}
    }
  }
  const id=Sesiones.activa&&Sesiones.encabezado(Sesiones.activa)
    ? Sesiones.activa : Sesiones.lista[0].id;
  Sesiones.abrir(id);
  const d=Sesiones.datos(id);
  hist=d.mensajes||[]; Taller.cargarDe(d.taller||{});
}
function pintarCab(){
  const s=Sesiones.encabezado(Sesiones.activa);
  const modo=G.modo==='chat'?'':' · '+(G.modo==='agente'?'agente':'workflow');
  $('#cabModelo').textContent=(s?s.titulo:'')+modo;
}
function abajo(){ $('#hilo').scrollTop=1e9; }

// ── burbujas ─────────────────────────────────────────────────────────────────
function poner(t,q,guardable){
  const d=document.createElement('div'); d.className='msg '+q;
  if(q==='el'&&guardable) pintarAsistente(d,t); else d.textContent=t;
  if(guardable){
    d.dataset.crudo=t;
    const fila=document.createElement('div'); fila.className='acciones-msg';
    const bc=document.createElement('button'); bc.textContent='⧉ copiar';
    bc.onclick=()=>{ Peak.copiar(t); Peak.aviso('Copiado'); };
    const bg=document.createElement('button'); bg.textContent='⤓ guardar';
    bg.onclick=()=>menuFormato(t);
    const br=document.createElement('button'); br.textContent='↻ rehacer';
    br.onclick=()=>rehacer();
    fila.appendChild(bc); fila.appendChild(bg); fila.appendChild(br);
    d.appendChild(fila);
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
      case 'cambio-modelo':
        renglon(panel,d.de+' está frenado, sigo con otro',
                d.quedan+' modelo'+(d.quedan===1?'':'s')+' más para probar','hecho',et);
        return;
      case 'ruta':
        if(Flota.auto) renglon(panel,d.modelo,'elegido para "'+d.tarea+'"','hecho',et);
        return;
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

function renglonQuien(nodo){
  if(!Flota.ultimo||!Flota.auto) return;
  const q=document.createElement('div'); q.className='quien';
  q.textContent=Flota.ultimo.modelo+' · '+Flota.ultimo.prov+
    (Flota.ultimo.intento>1?' (los '+(Flota.ultimo.intento-1)+' anteriores estaban frenados)':'');
  nodo.appendChild(q);
}

async function modoChat(){
  const caja=poner('…','el',false);
  hist=await compactar(hist, ()=>{ caja.textContent='(compactando el contexto…)'; });
  let texto='';
  const r=await pedirLargo({
    mensajes:hist,
    onTexto:(d,t)=>{ texto=t; caja.textContent=t; abajo(); },
    incompleto:()=>false,
    onCambio:c=>{ caja.textContent='('+c.de+' está frenado, sigo con otro…)'; },
    onRuta:()=>{}
  });
  const fin=(r.texto||texto||'(el modelo no devolvió nada)').trim();
  hist.push({role:'assistant',content:fin}); guardarHist();
  caja.remove(); repintar();
  const ultima=$('#hilo').lastElementChild; if(ultima) renglonQuien(ultima);
  Sesiones.tocar(Sesiones.activa); autoTitular();
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
  pintarTaller(); Sesiones.tocar(Sesiones.activa); autoTitular();
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
$('#bLimpiar').onclick=nuevaSesion;

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

// ── rehacer la última respuesta ──────────────────────────────────────────────
async function rehacer(){
  if(trabajando) return;
  // saca las respuestas del final hasta encontrar el último pedido
  while(hist.length && hist[hist.length-1].role!=='user') hist.pop();
  if(!hist.length) return;
  const pedido=hist[hist.length-1].content;
  hist.pop(); guardarHist(); repintar();
  $('#entrada').value=pedido;
  enviar();
}

// ── panel lateral de conversaciones ──────────────────────────────────────────
let _filtro='';
function pintarCajon(){
  const l=$('#cajonLista'); if(!l) return;
  l.innerHTML='';
  const xs=Sesiones.buscar(_filtro);
  if(!xs.length){
    const v=document.createElement('div'); v.className='vacio';
    v.textContent=_filtro?'No encontré nada con "'+_filtro+'".':'Todavía no hay conversaciones.';
    l.appendChild(v); return;
  }
  for(const [titulo,grupo] of Sesiones.agrupar(xs)){
    const g=document.createElement('div'); g.className='grupo-fecha'; g.textContent=titulo;
    l.appendChild(g);
    for(const ses of grupo){
      const f=document.createElement('div');
      f.className='charla'+(ses.id===Sesiones.activa?' sel':'');
      const t=document.createElement('div'); t.className='t'; t.textContent=ses.titulo;
      t.onclick=()=>{ abrirSesion(ses.id); cerrarCajon(); };
      const m=document.createElement('button'); m.className='mas'; m.textContent='⋯';
      m.onclick=e=>{ e.stopPropagation(); menuCharla(ses); };
      f.appendChild(t); f.appendChild(m); l.appendChild(f);
    }
  }
}
function menuCharla(ses){
  const q=prompt('Nombre de la conversación (dejalo vacío para borrarla):', ses.titulo);
  if(q===null) return;
  if(!q.trim()){
    if(!confirm('¿Borrar "'+ses.titulo+'" y sus archivos?')) return;
    Sesiones.borrar(ses.id);
    if(!Sesiones.lista.length) nuevaSesion();
    else if(!Sesiones.activa) abrirSesion(Sesiones.lista[0].id);
    else { pintarCajon(); pintarCab(); }
    return;
  }
  Sesiones.renombrar(ses.id,q); pintarCajon(); pintarCab();
}
function abrirCajon(){ pintarCajon(); $('#cajon').classList.add('ver');
  $('#veloCajon').classList.add('ver'); }
function cerrarCajon(){ $('#cajon').classList.remove('ver');
  $('#veloCajon').classList.remove('ver'); }
$('#bCajon').onclick=abrirCajon;
$('#veloCajon').onclick=cerrarCajon;
$('#bNuevaCharla').onclick=()=>{ nuevaSesion(); cerrarCajon(); };
$('#cBuscar').addEventListener('input',e=>{ _filtro=e.target.value; pintarCajon(); });
$('#bAjustes2').onclick=()=>{ cerrarCajon(); $('#bAjustes').click(); };

/**
 * Le pone nombre a la charla con el modelo, como hace Claude. Es una llamada
 * chica y aparte: si falla, queda el título recortado del primer mensaje.
 */
async function autoTitular(){
  const ses=Sesiones.encabezado(Sesiones.activa);
  if(!ses||!ses.auto||hist.length<2) return;
  const primero=hist.find(m=>m.role==='user');
  if(!primero) return;
  Sesiones.renombrar(ses.id, Sesiones.tituloDe(primero.content));
  ses.auto=true; Sesiones._guardarLista();       // sigue siendo automático
  pintarCab(); pintarCajon();
  try{
    const r=await mandar({mensajes:[{role:'user',content:
      'Poné un título de 3 a 6 palabras para esta conversación. Sin comillas, '+
      'sin punto final, sin explicar nada. Solo el título.\n\n'+
      primero.content.slice(0,700)}]});
    const t=(r.texto||'').trim().split('\n')[0].replace(/^["'«]|["'».]$/g,'').trim();
    if(t && t.length<70 && ses.auto){
      Sesiones.renombrar(ses.id,t); ses.auto=true; Sesiones._guardarLista();
      pintarCab(); pintarCajon();
    }
  }catch(e){ /* queda el recorte del primer mensaje */ }
}

// ── conectores ───────────────────────────────────────────────────────────────
function pintarConectores(){
  const l=$('#listaConectores'); if(!l) return;
  l.innerHTML='';
  if(!Conectores.lista.length){
    const v=document.createElement('div'); v.className='pista';
    v.textContent='Todavía no hay conectores.'; l.appendChild(v); return;
  }
  Conectores.lista.forEach(c=>{
    const d=document.createElement('div'); d.className='conector';
    const f1=document.createElement('div'); f1.className='fila1';
    const n=document.createElement('div'); n.className='nom'; n.textContent=c.nombre;
    const p=document.createElement('span');
    const hs=(c.herramientas||[]).length;
    if(c.tipo!=='http'){ p.className='pastilla off'; p.textContent='no se puede'; }
    else if(hs){ p.className='pastilla on'; p.textContent=hs+' herramienta'+(hs>1?'s':''); }
    else { p.className='pastilla gris'; p.textContent='sin conectar'; }
    f1.appendChild(n); f1.appendChild(p);
    d.appendChild(f1);
    if(c.url){ const u=document.createElement('div'); u.className='url'; u.textContent=c.url;
               d.appendChild(u); }
    if(c.motivo){ const m=document.createElement('div'); m.className='hs'; m.textContent=c.motivo;
                  d.appendChild(m); }
    if(hs){ const h=document.createElement('div'); h.className='hs';
            h.textContent=c.herramientas.map(x=>x.nombre).join(' · '); d.appendChild(h); }
    const fila=document.createElement('div'); fila.className='acciones-msg';
    if(c.tipo==='http'){
      const bp=document.createElement('button'); bp.textContent='Probar';
      bp.onclick=async()=>{ bp.textContent='…';
        try{ const r=await conectar(c); avisoMCP('ok','"'+c.nombre+'": '+r.length+' herramientas.'); }
        catch(e){ avisoMCP('no','"'+c.nombre+'": '+e.message); }
        bp.textContent='Probar'; pintarConectores(); };
      const ba=document.createElement('button');
      ba.textContent=c.activo?'Apagar':'Prender';
      ba.onclick=()=>{ c.activo=!c.activo; Conectores._guardar(); pintarConectores(); };
      fila.appendChild(bp); fila.appendChild(ba);
    }
    const bb=document.createElement('button'); bb.textContent='Quitar';
    bb.onclick=()=>{ Conectores.borrar(c.id); pintarConectores(); };
    fila.appendChild(bb);
    d.appendChild(fila);
    l.appendChild(d);
  });
}
function avisoMCP(clase,texto){
  const e=$('#eMCP'); e.classList.remove('oculto','ok','no');
  if(clase) e.classList.add(clase);
  e.textContent=texto;
}
$('#bConectores').onclick=()=>{ cerrarCajon(); pintarConectores();
  $('#conectores').classList.add('ver'); };
$('#bCerrarConectores').onclick=()=>$('#conectores').classList.remove('ver');
$('#bPegarMCP').onclick=async()=>{
  const {servidores,avisos}=interpretar($('#cPegar').value);
  if(!servidores.length){ avisoMCP('no', avisos.join(' ')); return; }
  avisoMCP('', 'Conectando…');
  const partes=[...avisos];
  for(const srv of servidores){
    const c=Conectores.agregar(srv);
    if(c.tipo!=='http') continue;
    try{ const hs=await conectar(c); partes.push('"'+c.nombre+'": '+hs.length+' herramientas.'); }
    catch(e){ c.estado='mal'; partes.push('"'+c.nombre+'": no conectó — '+e.message); }
  }
  const todoBien=!partes.some(x=>/no conect|stdio/.test(x));
  avisoMCP(todoBien?'ok':'no', partes.join(' '));
  $('#cPegar').value=''; pintarConectores();
};

// ── motores ──────────────────────────────────────────────────────────────────
function pintarMotores(){
  $('#cAuto').checked=Flota.auto;
  const l=$('#listaMotores'); l.innerHTML='';
  Flota.proveedores.forEach(p=>{
    const d=document.createElement('div'); d.className='motor';
    const f=document.createElement('div'); f.className='fila1';
    const n=document.createElement('div'); n.className='nom'; n.textContent=p.nombre;
    const cuantos=Flota.modelos.filter(m=>m.prov===p.id).length;
    const pa=document.createElement('span');
    if(p.activo&&(p.sinLlave||p.llave)){
      pa.className='pastilla '+(cuantos?'on':'gris');
      pa.textContent=cuantos?cuantos+' modelos':'sin catálogo';
    }else{ pa.className='pastilla gris'; pa.textContent=p.sinLlave?'apagado':'falta la llave'; }
    const sw=document.createElement('input'); sw.type='checkbox'; sw.checked=!!p.activo;
    sw.style.cssText='width:auto;flex:0 0 auto';
    sw.onchange=()=>{ p.activo=sw.checked; Flota.guardar(); pintarMotores(); };
    f.appendChild(n); f.appendChild(pa); f.appendChild(sw);
    d.appendChild(f);
    if(!p.sinLlave){
      const i=document.createElement('input'); i.type='password';
      i.placeholder='pegá acá la llave'; i.value=p.llave||'';
      i.onchange=()=>{ p.llave=i.value.trim(); Flota.guardar(); pintarMotores(); };
      d.appendChild(i);
    }
    const c=document.createElement('div'); c.className='comor'; c.textContent=p.sacar;
    d.appendChild(c);
    if(p.error){ const e=document.createElement('div'); e.className='err';
                 e.textContent='Último intento: '+p.error; d.appendChild(e); }
    l.appendChild(d);
  });
  const r=$('#resumenFlota');
  const tot=Flota.modelos.length;
  if(!tot) r.textContent='Todavía no hay catálogos cargados. Tocá "Actualizar los catálogos".';
  else{
    const conH=Flota.modelos.filter(m=>m.herramientas).length;
    const grande=Flota.modelos.reduce((a,m)=>Math.max(a,m.ctx||0),0);
    r.textContent=tot+' modelos en la flota · '+conH+' sirven para el modo agente · '+
      'el de más contexto aguanta '+grande.toLocaleString('es-AR')+' tokens.';
  }
}
$('#bMotores').onclick=()=>{ cerrarCajon(); pintarMotores(); $('#motores').classList.add('ver'); };
$('#bCerrarMotores').onclick=()=>$('#motores').classList.remove('ver');
$('#cAuto').onchange=e=>{ Flota.auto=e.target.checked; Flota.guardar(); pintarCab(); };
$('#bRecargarCat').onclick=async()=>{
  const e=$('#eMotores'); e.classList.remove('oculto','ok','no'); e.textContent='Buscando…';
  await cargarCatalogos(nom=>{ e.textContent='Preguntándole a '+nom+'…'; });
  const malos=Flota.proveedores.filter(p=>p.error&&p.activo&&(p.sinLlave||p.llave));
  e.classList.add(Flota.modelos.length?(malos.length?'no':'ok'):'no');
  e.textContent=Flota.modelos.length
    ? Flota.modelos.length+' modelos listos.'+(malos.length?' No entraron: '+
        malos.map(p=>p.nombre+' ('+p.error+')').join(', '):'')
    : 'No entró ninguno. '+(malos.map(p=>p.nombre+': '+p.error).join(' · ')||'');
  pintarMotores();
};

// ── arranque ─────────────────────────────────────────────────────────────────
arrancarSesiones();
cargarCatalogo().then(pintarChip);
// los catálogos de la flota se traen en segundo plano: si no llegan, la app
// sigue andando con el motor configurado a mano
if(Flota.auto) cargarCatalogos().then(()=>{ if($('#motores').classList.contains('ver')) pintarMotores(); });
pintarModo(); pintarCab(); repintar(); pintarTaller(); pintarCajon();

})();
