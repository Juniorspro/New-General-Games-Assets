// puente.js — si no estamos adentro del APK, se arma un Peak de mentira.
//
// Adentro de Android, MainActivity ya inyectó `Peak` antes de que cargue la
// página, así que esto no hace nada. Afuera (un navegador de escritorio, una
// prueba automatizada) fabrica el mismo contrato con fetch y descargas del
// navegador, y así la misma página se puede abrir y probar sin compilar el APK.
//
// Ojo con la diferencia real: acá el fetch del navegador SÍ tiene CORS, y por
// eso el motor gratis puede fallar desde el escritorio y andar en el teléfono.

// Cada módulo va adentro de su propia función: son <script> clásicos y
// comparten el ámbito global, así que sin esto el `const G` de nucleo.js
// choca con el `const {G}` de los demás y no carga ninguno.
(function(){
'use strict';
if(!window.Peak){
  const bajar=(nombre, blob)=>{
    const u=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=u; a.download=nombre; a.click();
    setTimeout(()=>URL.revokeObjectURL(u),4000);
    return 'Descargas/'+nombre;
  };
  window.Peak={
    guardar(nombre, contenido){
      try{ return bajar(nombre, new Blob([contenido],{type:'text/plain;charset=utf-8'})); }
      catch(e){ return 'ERROR: '+e.message; }
    },
    guardarBinario(nombre, base64, mime){
      try{
        const bin=atob(base64), u=new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
        return bajar(nombre, new Blob([u],{type:mime||'application/octet-stream'}));
      }catch(e){ return 'ERROR: '+e.message; }
    },
    abrir(){
      const i=document.createElement('input'); i.type='file';
      i.onchange=()=>{ const f=i.files[0]; if(!f) return;
        const r=new FileReader();
        r.onload=()=>window.peakArchivoLeido({nombre:f.name, texto:String(r.result)});
        r.onerror=()=>window.peakArchivoLeido({error:'no se pudo leer'});
        r.readAsText(f); };
      i.click();
    },
    copiar(t){ navigator.clipboard?.writeText(t); },
    abrirWeb(u){ try{ window.open(u,'_blank'); }catch(e){} },
    hayTermux(){ return false; },
    correrEnTermux(){ return false; },
    abrirTermux(){},
    aviso(t){ console.log('[aviso]', t); },
    // mismo contrato que el puente de Java: trozos a peakChunk, cierre a peakFin
    async stream(id, url, apiKey, bodyJson){
      try{
        const r=await fetch(url,{method:'POST',
          headers:Object.assign({'Content-Type':'application/json','Accept':'text/event-stream'},
                                apiKey?{Authorization:'Bearer '+apiKey}:{}),
          body:bodyJson});
        if(!r.ok){ window.peakErr(id,'HTTP '+r.status+' '+(await r.text()).slice(0,300)); return; }
        const lec=r.body.getReader(), dec=new TextDecoder();
        let resto='', huboSSE=false, plano='';
        for(;;){
          const {value,done}=await lec.read(); if(done) break;
          resto+=dec.decode(value,{stream:true});
          const lineas=resto.split('\n'); resto=lineas.pop();
          for(const l of lineas){
            if(l.startsWith('data:')){ huboSSE=true; window.peakChunk(id, l.slice(5).trim()); }
            else if(l.trim()) plano+=l+'\n';
          }
        }
        if(!huboSSE && plano) window.peakChunk(id,'__PLANO__'+plano);
        window.peakFin(id,'');
      }catch(e){ window.peakErr(id, String(e.message)); }
    }
  };
}

})();
