// mcp.js — conectores: servidores MCP remotos, por HTTP.
//
// QUÉ ANDA Y QUÉ NO, DE ENTRADA:
//
// Un servidor MCP puede ser de dos clases. Los "stdio" son un programa que
// corre en tu máquina (`npx algo`, `python -m algo`) y se habla por la entrada
// y salida estándar. En Android una app no puede lanzar procesos, así que esos
// NO se pueden usar: si pegás una config con "command", la app la muestra y te
// dice por qué no la puede levantar, en vez de fallar callada.
//
// Los remotos por HTTP sí andan, y son estos. Se implementa el transporte
// "Streamable HTTP": todo va por POST al mismo endpoint, y el servidor
// contesta o un JSON suelto o un text/event-stream.
//
// Hace falta el puente nativo (Peak.http) y no fetch(): fetch tiene CORS y
// casi ningún servidor MCP manda los encabezados para permitir un origen
// file://. Por el puente no hay CORS, que es el mismo truco que usa el chat.

// Ámbito propio: son <script> clásicos y comparten el global.
(function(){
'use strict';

const VERSION_MCP='2025-06-18';

// ── HTTP por el puente ───────────────────────────────────────────────────────
const _esperando=new Map();
let _nh=0;
window.peakHttp=(id,json)=>{
  const f=_esperando.get(id); if(!f) return;
  _esperando.delete(id);
  try{ f.listo(JSON.parse(json)); }catch(e){ f.falla(new Error('respuesta ilegible')); }
};
function http(metodo,url,cabeceras,cuerpo){
  return new Promise((listo,falla)=>{
    const id='h'+(++_nh)+'_'+Date.now();
    const reloj=setTimeout(()=>{ _esperando.delete(id);
      falla(new Error('el servidor no contestó en 2 minutos')); },125000);
    _esperando.set(id,{
      listo:r=>{ clearTimeout(reloj); r.error?falla(new Error(r.error)):listo(r); },
      falla:e=>{ clearTimeout(reloj); falla(e); }
    });
    try{ Peak.http(id, metodo, url, JSON.stringify(cabeceras||{}), cuerpo||''); }
    catch(e){ clearTimeout(reloj); _esperando.delete(id); falla(e); }
  });
}

/** Saca el objeto JSON-RPC de una respuesta, venga suelta o en un SSE. */
function sacarRespuesta(r){
  const tipo=(r.cabeceras&&r.cabeceras['content-type'])||'';
  const cuerpo=r.cuerpo||'';
  if(tipo.includes('text/event-stream')){
    // puede venir el resultado mezclado con notificaciones: nos quedamos con
    // el primer mensaje que traiga "result" o "error"
    for(const linea of cuerpo.split('\n')){
      if(!linea.startsWith('data:')) continue;
      try{
        const j=JSON.parse(linea.slice(5).trim());
        if(j && (j.result!==undefined || j.error!==undefined)) return j;
      }catch(e){}
    }
    return null;
  }
  if(!cuerpo.trim()) return null;
  try{ return JSON.parse(cuerpo); }catch(e){ return null; }
}

// ── el registro de conectores ────────────────────────────────────────────────
const Conectores={
  lista:(()=>{ try{ return JSON.parse(localStorage.getItem('conectores')||'[]'); }
               catch(e){ return []; } })(),
  _guardar(){ try{ localStorage.setItem('conectores',JSON.stringify(
    this.lista.map(c=>({id:c.id,nombre:c.nombre,url:c.url,cabeceras:c.cabeceras,
                        activo:c.activo,tipo:c.tipo,motivo:c.motivo,
                        herramientas:c.herramientas||[]})))); }catch(e){} },
  agregar(c){
    c.id=c.id||('c'+Date.now()+'_'+Math.random().toString(36).slice(2,6));
    const ya=this.lista.find(x=>x.url&&x.url===c.url);
    if(ya){ Object.assign(ya,c,{id:ya.id}); this._guardar(); return ya; }
    this.lista.push(c); this._guardar(); return c;
  },
  borrar(id){ this.lista=this.lista.filter(c=>c.id!==id); this._guardar(); },
  por(nombre){ return this.lista.find(c=>c.nombre===nombre||c.id===nombre); },
  activos(){ return this.lista.filter(c=>c.activo&&c.tipo==='http'&&(c.herramientas||[]).length); },
  /** Todas las herramientas disponibles, con su servidor adelante. */
  herramientas(){
    const r=[];
    for(const c of this.activos())
      for(const h of c.herramientas) r.push({servidor:c.nombre, ...h});
    return r;
  }
};

// ── pegar una configuración ──────────────────────────────────────────────────
/**
 * Entiende lo que uno pega de verdad: una URL pelada, el bloque
 * {"mcpServers":{…}} de Claude Desktop, un {"nombre":{…}} suelto o un
 * {"url":…} directo. Devuelve {servidores:[], avisos:[]}.
 */
function interpretar(texto){
  const t=String(texto||'').trim();
  const servidores=[], avisos=[];
  if(!t) return {servidores, avisos:['No pegaste nada.']};

  if(/^https?:\/\/\S+$/i.test(t)){
    servidores.push({nombre:nombreDeUrl(t), url:t, cabeceras:{}, tipo:'http', activo:true});
    return {servidores, avisos};
  }

  let j;
  try{ j=JSON.parse(t); }
  catch(e){ return {servidores, avisos:['No es ni una URL ni un JSON válido: '+e.message]}; }

  // desenvolver las formas conocidas
  let mapa=j.mcpServers||j.servers||j.mcp||null;
  if(!mapa){
    if(j.url||j.command) mapa={[j.name||j.nombre||nombreDeUrl(j.url||'servidor')]:j};
    else mapa=j;                       // {"nombre":{…}}
  }

  for(const [nombre,cfg] of Object.entries(mapa)){
    if(!cfg||typeof cfg!=='object'){ avisos.push('"'+nombre+'": no entendí la forma.'); continue; }
    const url=cfg.url||cfg.endpoint||cfg.serverUrl;
    if(url){
      const cab={};
      // la clave puede venir con varios nombres según quién escribió la config
      Object.assign(cab, cfg.headers||cfg.cabeceras||{});
      if(cfg.apiKey&&!cab.Authorization) cab.Authorization='Bearer '+cfg.apiKey;
      if(cfg.token&&!cab.Authorization)  cab.Authorization='Bearer '+cfg.token;
      servidores.push({nombre, url, cabeceras:cab, tipo:'http', activo:true});
    }else if(cfg.command){
      servidores.push({nombre, tipo:'stdio', activo:false,
        motivo:'Es un servidor local ("'+cfg.command+'"). Android no puede lanzar '+
               'procesos, así que este no se puede usar desde el teléfono. '+
               'Necesita una versión remota por HTTP.'});
      avisos.push('"'+nombre+'" es stdio (local): queda anotado pero apagado.');
    }else{
      avisos.push('"'+nombre+'": no tiene ni url ni command.');
    }
  }
  if(!servidores.length&&!avisos.length) avisos.push('No encontré ningún servidor adentro.');
  return {servidores, avisos};
}
function nombreDeUrl(u){
  try{ return new URL(u).hostname.replace(/^www\./,'').split('.')[0]||'servidor'; }
  catch(e){ return 'servidor'; }
}

// ── el protocolo ─────────────────────────────────────────────────────────────
let _rpc=0;
function cabecerasDe(c){
  return Object.assign({
    'Content-Type':'application/json',
    // los dos, porque el servidor elige con cuál contesta
    'Accept':'application/json, text/event-stream',
    'MCP-Protocol-Version':VERSION_MCP
  }, c.sesion?{'Mcp-Session-Id':c.sesion}:{}, c.cabeceras||{});
}
async function rpc(c, metodo, params, esAviso){
  const msg={jsonrpc:'2.0', method:metodo};
  if(params) msg.params=params;
  if(!esAviso) msg.id=++_rpc;                 // un aviso no lleva id ni espera respuesta
  const r=await http('POST', c.url, cabecerasDe(c), JSON.stringify(msg));
  // el id de sesión llega en la respuesta del initialize y hay que repetirlo
  const dado=r.cabeceras&&r.cabeceras['mcp-session-id'];
  if(dado) c.sesion=dado;
  if(r.estado===404&&c.sesion){ c.sesion=null; throw new Error('el servidor perdió la sesión'); }
  if(r.estado<200||r.estado>=300){
    const pista=r.estado===401||r.estado===403
      ? 'no te deja entrar: falta la llave o no sirve'
      : r.estado===405 ? 'no acepta POST acá: puede ser un servidor con el '+
                         'transporte viejo (SSE), que esta versión no habla'
      : 'HTTP '+r.estado;
    throw new Error(pista+(r.cuerpo?' · '+r.cuerpo.slice(0,180):''));
  }
  if(esAviso) return null;
  const j=sacarRespuesta(r);
  if(!j) throw new Error('contestó algo que no es JSON-RPC');
  if(j.error) throw new Error(j.error.message||JSON.stringify(j.error));
  return j.result;
}

/** initialize + initialized + tools/list. Deja las herramientas en c. */
async function conectar(c){
  c.sesion=null;
  const ini=await rpc(c,'initialize',{
    protocolVersion:VERSION_MCP,
    capabilities:{},
    clientInfo:{name:'PeakCode', version:'1.0'}
  });
  c.servidor=(ini&&ini.serverInfo)||{};
  c.protocolo=(ini&&ini.protocolVersion)||VERSION_MCP;
  try{ await rpc(c,'notifications/initialized',{},true); }catch(e){}

  const hs=[]; let cursor;
  do{
    const r=await rpc(c,'tools/list', cursor?{cursor}:{});
    for(const h of (r.tools||[]))
      hs.push({nombre:h.name, desc:h.description||h.title||'', esquema:h.inputSchema||null});
    cursor=r.nextCursor;
  }while(cursor&&hs.length<200);
  c.herramientas=hs;
  c.estado='ok';
  Conectores._guardar();
  return hs;
}

/** Llama una herramienta. Devuelve el texto del resultado. */
async function usar(nombreServidor, nombreHerramienta, argumentos){
  const c=Conectores.por(nombreServidor);
  if(!c) return 'No hay ningún conector que se llame "'+nombreServidor+'".';
  if(c.tipo!=='http') return 'El conector "'+nombreServidor+'" no se puede usar: '+(c.motivo||'');
  try{
    if(!c.sesion&&!(c.herramientas||[]).length) await conectar(c);
    const r=await rpc(c,'tools/call',{name:nombreHerramienta, arguments:argumentos||{}});
    const partes=(r&&r.content)||[];
    const texto=partes.map(p=>{
      if(p.type==='text') return p.text;
      if(p.type==='resource') return '[recurso '+(p.resource?.uri||'')+']\n'+(p.resource?.text||'');
      if(p.type==='image') return '[imagen '+(p.mimeType||'')+', no la puedo mostrar acá]';
      return '['+p.type+']';
    }).join('\n').trim();
    const cuerpo=texto||JSON.stringify(r&&r.structuredContent||r||{}).slice(0,4000);
    return (r&&r.isError?'La herramienta devolvió un error: ':'')+cuerpo;
  }catch(e){
    return 'Falló la llamada a '+nombreServidor+'.'+nombreHerramienta+': '+e.message;
  }
}

window.PeakMCP={Conectores, interpretar, conectar, usar, rpc, http, VERSION_MCP, sacarRespuesta};

})();
