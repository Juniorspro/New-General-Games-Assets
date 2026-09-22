// flota.js — varios modelos en vez de uno, con cambio automático.
//
// EL PROBLEMA QUE RESUELVE. El motor gratis es UNA bolsa compartida por todos
// los que usan la app sin llave. Cuando te frena, la 1.0 te tiraba el error y
// ahí quedabas. Acá hay una flota: si uno te frena, se enfría y la llamada
// sigue por otro, sin que vos hagas nada.
//
// LO QUE NO SE PUEDE, DICHO DE ENTRADA. Modelos buenos, públicos y SIN NINGUNA
// llave hay uno solo: Pollinations (medido el 22/9: su catálogo anónimo tiene
// 1 modelo, GPT-OSS 20B). Todos los demás piden una llave, aunque sea gratis.
// Con una sola llave gratis de OpenRouter se suman 21 modelos más, y ahí sí hay
// flota de verdad. No hay forma de tener quince modelos sin pegar ni una llave:
// si alguien lo promete, está mintiendo o está usando la llave de otro.
//
// CÓMO ELIGE. No a ojo: el catálogo de OpenRouter publica, por modelo, el largo
// de contexto, si acepta herramientas, y los índices de referencia de
// Artificial Analysis (inteligencia, código, agente). El ruteo ordena por el
// índice que le sirve a la tarea.

// Ámbito propio: son <script> clásicos y comparten el global.
(function(){
'use strict';

const N=window.PeakNucleo;
const {G,escribir,leer}=N;

// ── los proveedores ──────────────────────────────────────────────────────────
// `sinLlave` es el único que anda sin configurar nada.
const BASE=[
  {id:'pollinations', nombre:'El de fábrica', activo:true, sinLlave:true,
   chat:'https://text.pollinations.ai/openai',
   catalogo:'https://text.pollinations.ai/models',
   resumen:'Viene andando, no hay que hacer nada. Es el que se llena y te frena.',
   web:''},
  {id:'huggingface', nombre:'Hugging Face', activo:false,
   chat:'https://router.huggingface.co/v1/chat/completions',
   catalogo:'https://router.huggingface.co/v1/models',
   resumen:'El que más modelos suma. La cuenta y la llave son gratis.',
   web:'https://huggingface.co/settings/tokens'},
  {id:'openrouter', nombre:'OpenRouter', activo:false, soloGratis:true,
   chat:'https://openrouter.ai/api/v1/chat/completions',
   catalogo:'https://openrouter.ai/api/v1/models',
   resumen:'Solo usa los modelos que son gratis, así que no te puede cobrar.',
   web:'https://openrouter.ai/keys'},
  {id:'groq', nombre:'Groq', activo:false,
   chat:'https://api.groq.com/openai/v1/chat/completions',
   catalogo:'https://api.groq.com/openai/v1/models',
   resumen:'El más rápido de todos. La llave es gratis.',
   web:'https://console.groq.com/keys'},
  {id:'cerebras', nombre:'Cerebras', activo:false,
   chat:'https://api.cerebras.ai/v1/chat/completions',
   catalogo:'https://api.cerebras.ai/v1/models',
   resumen:'Rápido y gratis, con menos modelos.',
   web:'https://cloud.cerebras.ai'},
  {id:'deepinfra', nombre:'DeepInfra', activo:false,
   chat:'https://api.deepinfra.com/v1/openai/chat/completions',
   catalogo:'https://api.deepinfra.com/v1/openai/models',
   resumen:'Muchos modelos. Regala crédito al abrir la cuenta.',
   web:'https://deepinfra.com/dash/api_keys'},
  // Tu propio OmniRoute: una máquina tuya que junta muchos modelos. No lleva
  // una llave que pegás vos, sino la dirección del servidor y su contraseña;
  // OmniRoute emite su propia llave y esta app la guarda sola.
  {id:'omniroute', nombre:'Tu propio motor', activo:false, esOmni:true,
   resumen:'Tu servidor OmniRoute. Junta muchos modelos gratis en una máquina tuya.',
   web:'https://huggingface.co/new-space?sdk=docker'},
];

function guardado(){ try{ return JSON.parse(leer('flota','{}')); }catch(e){ return {}; } }
const _g=guardado();
const Flota={
  auto:leer('flotaAuto','1')==='1',        // ¿rotar solo?
  proveedores:BASE.map(p=>Object.assign({}, p, _g[p.id]||{})),
  modelos:[],                              // catálogo unido de los prendidos
  enfriados:{},                            // id de modelo -> hasta cuándo
  ultimo:null,                             // quién contestó la última vez

  guardar(){
    const o={};
    for(const p of this.proveedores){
      o[p.id]={llave:p.llave||'', activo:!!p.activo};
      if(p.esOmni){ o[p.id].url=p.url||''; o[p.id].clave=p.clave||'';
                    o[p.id].chat=p.chat||''; o[p.id].catalogo=p.catalogo||''; }
    }
    escribir('flota',JSON.stringify(o));
    escribir('flotaAuto',this.auto?'1':'0');
  },
  por(id){ return this.proveedores.find(p=>p.id===id); },
  listos(){ return this.proveedores.filter(p=>p.activo&&(p.sinLlave||p.llave)&&p.catalogo); }
};

// ── OmniRoute: cambia dirección+contraseña por una llave ──────────────────────
// El login va por el puente (Peak.http), no por fetch(): un OmniRoute recién
// desplegado no manda los encabezados CORS para un origen file://.
async function conectarOmni(prov){
  const M=window.PeakMCP;
  const base=String(prov.url||'').replace(/\/+$/,'').replace(/\/v1$/,'');
  if(!/^https?:\/\//.test(base)) throw new Error('Falta la dirección del servidor');
  const login=await M.http('POST', base+'/api/auth/login',
    {'Content-Type':'application/json'}, JSON.stringify({password:prov.clave||''}));
  if(login.estado<200||login.estado>=300)
    throw new Error(login.estado===401?'la contraseña no entró':'no respondió el login (HTTP '+login.estado+')');
  // la cookie de sesión vuelve en set-cookie; se repite en la llamada que emite la llave
  const cookie=(login.cabeceras&&login.cabeceras['set-cookie'])||'';
  const ck=cookie?{'Cookie':cookie.split(';')[0]}:{};
  const emite=await M.http('POST', base+'/api/keys',
    Object.assign({'Content-Type':'application/json'}, ck),
    JSON.stringify({name:'PeakCode '+new Date().toISOString().slice(0,10)}));
  if(emite.estado<200||emite.estado>=300)
    throw new Error('no me dio la llave (HTTP '+emite.estado+')');
  const j=JSON.parse(emite.cuerpo||'{}');
  const k=j.key||j.apiKey||j.api_key||(j.data&&j.data.key);
  if(!k) throw new Error('el servidor contestó pero sin llave adentro');
  prov.llave=k;
  prov.chat=base+'/v1/chat/completions';
  prov.catalogo=base+'/v1/models';
  Flota.guardar();
  return k;
}

// ── traer los catálogos ──────────────────────────────────────────────────────
async function traerJSON(url, llave){
  const M=window.PeakMCP;
  const cab=llave?{Authorization:'Bearer '+llave}:{};
  const r=await M.http('GET', url, cab, '');
  if(r.estado<200||r.estado>=300) throw new Error('HTTP '+r.estado);
  return JSON.parse(r.cuerpo||'{}');
}

/** Normaliza lo que devuelve cada proveedor a un modelo nuestro. */
function normalizar(prov, m){
  const id=m.id||m.name;
  if(!id) return null;
  // Hugging Face devuelve los proveedores adentro de cada modelo
  const hf=(m.providers&&m.providers[0])||null;
  const sp=m.supported_parameters||[];
  const ba=(m.benchmarks&&m.benchmarks.artificial_analysis)||{};
  return {
    prov:prov.id,
    id,
    nom:(m.name||id).replace(/\s*\(free\)\s*$/i,''),
    ctx:m.context_length||(m.top_provider&&m.top_provider.context_length)||
        (hf&&hf.context_length)||m.max_context_length||0,
    herramientas:sp.includes('tools')||!!m.tool_use||prov.id==='pollinations'||
        (hf&&hf.supports_tools)||false,
    razona:sp.includes('reasoning')||!!m.reasoning,
    // los índices salen del catálogo, no de mi opinión
    ix:{
      general:+ba.intelligence_index||0,
      codigo:+ba.coding_index||0,
      agente:+ba.agentic_index||0
    }
  };
}

async function cargarCatalogos(alPaso){
  const out=[];
  for(const p of Flota.listos()){
    try{
      if(alPaso) alPaso(p.nombre);
      const d=await traerJSON(p.catalogo, p.llave);
      let xs=Array.isArray(d)?d:(d.data||d.models||[]);
      if(p.soloGratis) xs=xs.filter(m=>String(m.id||'').endsWith(':free'));
      p.error=null;
      for(const m of xs){ const n=normalizar(p,m); if(n) out.push(n); }
    }catch(e){ p.error=e.message; }
  }
  Flota.modelos=out;
  return out;
}

// ── de qué va el pedido ──────────────────────────────────────────────────────
/**
 * Clasifica sin gastar una llamada: mirando el texto y el modo. Es a propósito
 * grosero — si se equivoca, el peor caso es que use un modelo igual de bueno.
 */
function clasificar(texto, modo){
  const t=String(texto||'');
  if(modo==='agente'||modo==='flujo') return 'agente';
  if(t.length>12000) return 'largo';
  if(/```|\b(function|const |def |class |import |SELECT |<\/?\w+>)|\.(js|py|java|html|css|json|sql)\b|compil|stacktrace|error:/i.test(t))
    return 'codigo';
  if(/\b(por qué|porque|analiz|demostr|razon|calcul|paso a paso|compar|convien)/i.test(t))
    return 'razonar';
  return 'general';
}

const AHORA=()=>Date.now();
function enfriado(m){ const h=Flota.enfriados[m.prov+'|'+m.id]; return h&&h>AHORA(); }
function enfriar(m, segundos){ Flota.enfriados[m.prov+'|'+m.id]=AHORA()+segundos*1000; }

/** Los modelos que sirven para esta tarea, del mejor al peor. */
function candidatos(tarea){
  let xs=Flota.modelos.filter(m=>!enfriado(m));
  if(!xs.length) xs=Flota.modelos.slice();          // todos fríos: igual probamos
  if(tarea==='agente')  xs=xs.filter(m=>m.herramientas).concat(xs.filter(m=>!m.herramientas));
  if(tarea==='largo')   xs=xs.slice().sort((a,b)=>b.ctx-a.ctx);
  else if(tarea==='codigo')  xs=xs.slice().sort((a,b)=>(b.ix.codigo||b.ix.general)-(a.ix.codigo||a.ix.general));
  else if(tarea==='agente')  xs=xs.slice().sort((a,b)=>(b.ix.agente||b.ix.general)-(a.ix.agente||a.ix.general));
  else if(tarea==='razonar') xs=xs.slice().sort((a,b)=>(b.razona-a.razona)||(b.ix.general-a.ix.general));
  else                       xs=xs.slice().sort((a,b)=>b.ix.general-a.ix.general);
  return xs;
}

/** ¿Vale la pena probar con otro, o el error es del pedido? */
function recuperable(msg){
  const m=String(msg);
  if(/HTTP 429|rate.?limit|too many/i.test(m)) return 90;      // frenado: 90 s
  if(/HTTP 5\d\d|overload|unavailable/i.test(m)) return 30;
  if(/no contestó|timeout|tardó/i.test(m)) return 45;
  if(/HTTP 40[13]/.test(m)) return 600;                        // llave mala: 10 min
  if(/HTTP 404|no such model|does not exist/i.test(m)) return 3600;
  return 0;                                                    // 400 y demás: es el pedido
}

// ── el enrutador ─────────────────────────────────────────────────────────────
/**
 * Prueba con un modelo, y si lo frenan sigue con el que viene. Lo que cambia
 * para el usuario: donde antes salía "te frenaron por límite de uso", ahora
 * hay otro modelo contestando.
 */
async function pedirRuteado(op){
  if(!Flota.auto || !Flota.modelos.length) return N.pedir(op);
  const tarea=op.tarea||clasificar(
    (op.mensajes||[]).filter(m=>m.role==='user').slice(-1)[0]?.content||'', G.modo);
  const lista=candidatos(tarea);
  if(!lista.length) return N.pedir(op);
  let ultimo=null;
  const cuantos=Math.min(lista.length, 6);
  for(let i=0;i<cuantos;i++){
    const m=lista[i];
    const p=Flota.por(m.prov);
    if(!p) continue;
    try{
      const r=await N.pedir({...op, destino:{chat:p.chat, key:p.llave||'', modelo:m.id}});
      Flota.ultimo={prov:p.nombre, modelo:m.nom, id:m.id, tarea, intento:i+1};
      if(op.onRuta) op.onRuta(Flota.ultimo);
      return r;
    }catch(e){
      ultimo=e;
      const seg=recuperable(e.message);
      if(!seg) throw e;                       // el error es del pedido: no rota
      enfriar(m, seg);
      if(op.onCambio) op.onCambio({de:m.nom, motivo:e.message, quedan:cuantos-i-1});
    }
  }
  throw ultimo||new Error('no quedó ningún modelo disponible');
}

window.PeakFlota={Flota, cargarCatalogos, clasificar, candidatos, pedirRuteado, conectarOmni,
  recuperable, enfriar, enfriado, normalizar, BASE};
// el núcleo lo usa si está; si no, sigue como antes
N.enrutador=pedirRuteado;

})();
