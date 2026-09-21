// nucleo.js — el estado, el taller de archivos y el multiplexor de streams.
//
// El cambio grande contra la versión 0.8: antes había UNA sola conversación en
// curso (`enCurso`), así que no podían correr dos agentes a la vez. Acá las
// llamadas se registran por id en un Map, y como el puente de Java ya lanza un
// hilo por llamada, varios agentes trabajan de verdad en paralelo.

// Cada módulo va adentro de su propia función: son <script> clásicos y
// comparten el ámbito global, así que sin esto el `const G` de nucleo.js
// choca con el `const {G}` de los demás y no carga ninguno.
(function(){
'use strict';

// ── configuración ────────────────────────────────────────────────────────────
const LIBRE={chat:'https://text.pollinations.ai/openai', key:'', modelo:'openai', preset:'free'};
const G={
  preset:localStorage.getItem('preset')||'free',
  chat:localStorage.getItem('chat')||LIBRE.chat,
  key:localStorage.getItem('key')||'',
  modelo:localStorage.getItem('modelo')||LIBRE.modelo,
  modo:localStorage.getItem('modo')||'chat',        // chat | agente | flujo
  obreros:+(localStorage.getItem('obreros')||3)     // cuántos agentes en paralelo
};
function salvar(){ for(const k of ['preset','chat','key','modelo','modo','obreros'])
  localStorage.setItem(k,G[k]); }

// Techos. No son del modelo: son las riendas para que un agente no se dispare.
const TOPES={
  vueltas:24,        // pasos de herramienta por tarea
  continuaciones:40, // cuántas veces se le pide "seguí" a una respuesta cortada
  profundidad:2,     // agente -> subagente -> y ahí se corta
  obrerosMax:6,
  contexto:52000,    // caracteres antes de compactar
  recientes:6        // mensajes que la compactación nunca toca
};

// ── el taller: los archivos con los que trabajan los agentes ─────────────────
// Vive en memoria y se espeja en localStorage. Es lo que hace que el contexto
// no explote: el contenido largo queda acá y el modelo lee pedazos cuando los
// necesita, en vez de arrastrar todo en cada mensaje.
const Taller={
  archivos:JSON.parse(localStorage.getItem('taller')||'{}'),
  _guardar(){
    try{ localStorage.setItem('taller',JSON.stringify(this.archivos)); }
    catch(e){ /* se llenó el localStorage: seguimos en memoria */ }
  },
  escribir(nombre,texto){
    nombre=this.limpio(nombre);
    this.archivos[nombre]={texto:String(texto), cuando:Date.now()};
    this._guardar(); return nombre;
  },
  anexar(nombre,texto){
    nombre=this.limpio(nombre);
    const v=this.archivos[nombre];
    return this.escribir(nombre,(v?v.texto+'\n':'')+texto);
  },
  leer(nombre,desde,hasta){
    const a=this.archivos[this.limpio(nombre)];
    if(!a) return null;
    if(desde==null&&hasta==null) return a.texto;
    return a.texto.slice(desde||0, hasta==null?undefined:hasta);
  },
  existe(n){ return !!this.archivos[this.limpio(n)]; },
  borrar(n){ n=this.limpio(n); const h=!!this.archivos[n];
    delete this.archivos[n]; this._guardar(); return h; },
  listar(){ return Object.entries(this.archivos)
    .map(([n,a])=>({nombre:n, largo:a.texto.length, cuando:a.cuando}))
    .sort((x,y)=>y.cuando-x.cuando); },
  buscar(q){
    const r=[]; const t=q.toLowerCase();
    for(const [n,a] of Object.entries(this.archivos)){
      const lineas=a.texto.split('\n');
      lineas.forEach((l,i)=>{ if(l.toLowerCase().includes(t))
        r.push({archivo:n, linea:i+1, texto:l.trim().slice(0,160)}); });
    }
    return r.slice(0,60);
  },
  vaciar(){ this.archivos={}; this._guardar(); },
  // nada de rutas raras: el taller es plano
  limpio(n){ return String(n||'sin-nombre').trim().replace(/^[./\\]+/,'')
    .replace(/[\\/]+/g,'-').replace(/[\x00-\x1f]/g,'').slice(0,120) || 'sin-nombre'; }
};

// ── corte ────────────────────────────────────────────────────────────────────
// El puente de Java no sabe cancelar una llamada a medio camino, así que esto
// es un corte blando: se deja de escuchar y el bucle se frena en el próximo
// control. El hilo de Java termina solo y su respuesta se tira.
const Corte={pedido:false};
function abortar(){
  Corte.pedido=true;
  for(const s of enVuelo.values()) s.error('cortado');
  enVuelo.clear();
}
function reanudar(){ Corte.pedido=false; }

// ── multiplexor de llamadas al modelo ────────────────────────────────────────
const enVuelo=new Map();
let _n=0;
window.peakChunk=(id,data)=>{ const s=enVuelo.get(id); if(s) s.trozo(data); };
window.peakFin  =(id)=>{ const s=enVuelo.get(id); if(s) s.fin(); };
window.peakErr  =(id,msg)=>{ const s=enVuelo.get(id); if(s) s.error(msg); };

/**
 * Una llamada al modelo. Devuelve una promesa con el texto completo.
 * opciones: {mensajes, modelo, onTexto(delta,total), temperatura}
 * Varias de estas pueden correr a la vez: cada una tiene su id.
 */
function pedir(op){
  return new Promise((listo,falla)=>{
    const id='p'+(++_n)+'_'+Date.now();
    let texto='', motivoFin='', vivo=true;
    const cerrar=()=>{ vivo=false; enVuelo.delete(id); clearTimeout(reloj); };
    // Si el puente se queda mudo (se cortó la red y nunca llega peakErr) esto
    // evita que la promesa quede colgada para siempre.
    const reloj=setTimeout(()=>{ if(vivo){ cerrar();
      falla(new Error('el motor no contestó en 3 minutos')); } }, 185000);

    enVuelo.set(id,{
      trozo(data){
        if(!vivo) return;
        if(data.startsWith('__PLANO__')){            // respuesta no-SSE
          const crudo=data.slice(9);
          try{ const j=JSON.parse(crudo);
               texto=j.choices?.[0]?.message?.content ?? crudo;
               motivoFin=j.choices?.[0]?.finish_reason||'';
          }catch(e){ texto=crudo; }
          if(op.onTexto) op.onTexto(texto,texto);
          return;
        }
        if(data==='[DONE]') return;
        try{
          const j=JSON.parse(data);
          const c=j.choices?.[0];
          if(c?.finish_reason) motivoFin=c.finish_reason;
          const t=c?.delta?.content ?? c?.message?.content ?? '';
          if(t){ texto+=t; if(op.onTexto) op.onTexto(t,texto); }
        }catch(e){}
      },
      fin(){ if(!vivo)return; cerrar(); listo({texto, motivoFin}); },
      error(msg){ if(!vivo)return; cerrar(); falla(new Error(msg)); }
    });

    const cuerpo={ model:op.modelo||G.modelo||undefined,
                   messages:op.mensajes, stream:true };
    if(op.temperatura!=null) cuerpo.temperature=op.temperatura;
    try{ Peak.stream(id, G.chat, G.key, JSON.stringify(cuerpo)); }
    catch(e){ cerrar(); falla(e); }
  });
}

/**
 * Lo mismo, pero sin techo de escritura: si la respuesta viene cortada, le
 * pide "seguí" y pega los pedazos hasta que cierre.
 *
 * Qué cuenta como cortada: que el lector del protocolo diga que quedó un
 * bloque abierto, o que el motor devuelva finish_reason "length". No es que el
 * modelo deje de tener un techo por respuesta: es que se encadenan respuestas
 * hasta terminar el archivo, que es lo mismo que hace Claude Code.
 */
async function pedirLargo(op){
  const mensajes=op.mensajes.slice();
  let entero='', vueltas=0;
  const cortada=()=>op.incompleto?op.incompleto():false;
  while(true){
    const r=await pedir({...op, mensajes});
    entero+=r.texto;
    if(Corte.pedido) return {texto:entero, vueltas};
    const hayQueSeguir=(r.motivoFin==='length'||cortada()) && r.texto.trim()!=='';
    if(!hayQueSeguir || ++vueltas>TOPES.continuaciones) return {texto:entero, vueltas};
    if(op.onSeguir) op.onSeguir(vueltas, entero.length);
    // Se le manda lo último que escribió para que retome el hilo exacto.
    const cola=entero.slice(-1800);
    mensajes.push({role:'assistant', content:cola});
    mensajes.push({role:'user', content:
      'Te cortaste. Seguí EXACTAMENTE desde el último carácter, sin repetir '+
      'nada de lo anterior, sin saludar y sin explicar. Si estabas adentro de '+
      'un bloque <peak:…>, seguí adentro y acordate de cerrarlo.'});
  }
}

// ── contexto: compactar en vez de reventar ───────────────────────────────────
function pesoDe(mensajes){ return mensajes.reduce((a,m)=>a+(m.content||'').length,0); }

/**
 * Cuando la charla se pasa del techo, resume lo viejo en una nota y deja
 * intactos los últimos mensajes. No es "contexto infinito": es que la
 * conversación deja de chocar contra la ventana del modelo.
 */
async function compactar(hist, avisar){
  if(pesoDe(hist)<TOPES.contexto) return hist;
  const recientes=hist.slice(-TOPES.recientes);
  const viejos=hist.slice(0,-TOPES.recientes);
  if(!viejos.length) return hist;
  if(avisar) avisar('compactando');
  const crudo=viejos.map(m=>(m.role==='user'?'USUARIO: ':'ASISTENTE: ')+m.content).join('\n\n');
  let resumen;
  try{
    const r=await pedir({mensajes:[{role:'user',content:
      'Resumí esta conversación en menos de 1200 palabras. Guardá: qué pidió la '+
      'persona, qué se decidió, qué archivos se crearon y qué falta. Sin '+
      'preámbulo, solo el resumen.\n\n'+crudo.slice(-90000)}]});
    resumen=r.texto;
  }catch(e){
    // si falla el resumen, mejor recortar que romper la charla
    resumen='(no se pudo resumir; se recortó lo viejo)';
  }
  return [{role:'user',content:'[Resumen de lo que veníamos hablando]\n'+resumen},
          ...recientes];
}

window.PeakNucleo={G,LIBRE,TOPES,Taller,pedir,pedirLargo,compactar,pesoDe,salvar,
  enVuelo,Corte,abortar,reanudar};

})();
