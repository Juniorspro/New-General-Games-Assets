// sesiones.js — conversaciones guardadas, como el panel lateral de Claude.
//
// Hasta la 0.9 había UN historial (`hist` en localStorage) y el botón ✚ lo
// borraba. Acá cada conversación es una sesión con su nombre, su historial y
// su propio taller de archivos, así que los archivos de un trabajo no se
// mezclan con los de otro.
//
// Guardado: `ses.lista` con los encabezados (para pintar el panel sin leer
// todo) y `ses.d.<id>` con el contenido de cada una. Así abrir el panel no
// levanta megabytes de charlas viejas.

// Ámbito propio: son <script> clásicos y comparten el global.
(function(){
'use strict';

const CLAVE_LISTA='ses.lista', CLAVE_ACTIVA='ses.activa', PRE='ses.d.';

function leerJSON(k,porDefecto){
  try{ const v=localStorage.getItem(k); return v?JSON.parse(v):porDefecto; }
  catch(e){ return porDefecto; }
}
function escribirJSON(k,v){
  try{ localStorage.setItem(k,JSON.stringify(v)); return true; }
  catch(e){ return false; }   // localStorage lleno: seguimos en memoria
}

const Sesiones={
  lista:leerJSON(CLAVE_LISTA,[]),           // [{id,titulo,cuando,tocada,auto}]
  activa:(()=>{ try{ return localStorage.getItem(CLAVE_ACTIVA)||null; }catch(e){ return null; } })(),

  _guardarLista(){ escribirJSON(CLAVE_LISTA,this.lista); },

  encabezado(id){ return this.lista.find(s=>s.id===id)||null; },

  /** {mensajes, taller} de una sesión. */
  datos(id){ return leerJSON(PRE+id,{mensajes:[],taller:{}}); },
  guardarDatos(id,d){ return escribirJSON(PRE+id,d); },

  nueva(titulo){
    const id='s'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const s={id, titulo:titulo||'Conversación nueva', cuando:Date.now(),
             tocada:Date.now(), auto:true};
    this.lista.unshift(s); this._guardarLista();
    this.guardarDatos(id,{mensajes:[],taller:{}});
    this.abrir(id);
    return s;
  },

  abrir(id){ this.activa=id; try{ localStorage.setItem(CLAVE_ACTIVA,id); }catch(e){} },

  borrar(id){
    this.lista=this.lista.filter(s=>s.id!==id); this._guardarLista();
    try{ localStorage.removeItem(PRE+id); }catch(e){}
    if(this.activa===id) this.activa=null;
  },

  renombrar(id,t){
    const s=this.encabezado(id);
    if(!s) return;
    s.titulo=String(t).trim().slice(0,90)||s.titulo;
    s.auto=false;                       // ya lo nombró una persona: no lo pisamos
    this._guardarLista();
  },

  /** La sube al tope de la lista, como hace Claude al escribir en una. */
  tocar(id){
    const s=this.encabezado(id); if(!s) return;
    s.tocada=Date.now();
    this.lista=[s,...this.lista.filter(x=>x.id!==id)];
    this._guardarLista();
  },

  /** Título provisorio sacado del primer mensaje, sin gastar una llamada. */
  tituloDe(texto){
    const t=String(texto||'').replace(/\s+/g,' ').trim();
    if(!t) return 'Conversación nueva';
    return t.length>46?t.slice(0,46).replace(/\s\S*$/,'')+'…':t;
  },

  buscar(q){
    const t=q.trim().toLowerCase();
    if(!t) return this.lista;
    return this.lista.filter(s=>{
      if(s.titulo.toLowerCase().includes(t)) return true;
      const d=this.datos(s.id);
      return d.mensajes.some(m=>(m.content||'').toLowerCase().includes(t));
    });
  },

  /**
   * Agrupa por fecha como el panel de Claude: Hoy, Ayer, Últimos 7 días,
   * Últimos 30 días y después por mes.
   */
  agrupar(xs){
    const hoy=new Date(); hoy.setHours(0,0,0,0);
    const dia=86400000;
    const grupos=new Map();
    const meter=(g,s)=>{ if(!grupos.has(g)) grupos.set(g,[]); grupos.get(g).push(s); };
    for(const s of xs){
      const d=s.tocada||s.cuando;
      const dias=Math.floor((hoy-new Date(d).setHours(0,0,0,0))/dia);
      if(dias<=0) meter('Hoy',s);
      else if(dias===1) meter('Ayer',s);
      else if(dias<7) meter('Últimos 7 días',s);
      else if(dias<30) meter('Últimos 30 días',s);
      else meter(new Date(d).toLocaleDateString('es-AR',{month:'long',year:'numeric'}),s);
    }
    return [...grupos.entries()];
  }
};

window.PeakSesiones={Sesiones};

})();
