// flujo.js — el modo workflow: varios agentes con papeles distintos.
//
// El modo "agente" ya puede delegar solo, cuando se le canta. Esto es lo otro:
// una cadena fija que siempre hace los mismos cuatro pasos. Sirve para tareas
// grandes, donde dejar que el modelo decida si divide o no sale caro.
//
//   planificador ──▶ obrero 1 ┐
//                   obrero 2 ├─▶ integrador ──▶ revisor
//                   obrero 3 ┘
//                   (en paralelo, un hilo de Java cada uno)

// Cada módulo va adentro de su propia función: son <script> clásicos y
// comparten el ámbito global, así que sin esto el `const G` de nucleo.js
// choca con el `const {G}` de los demás y no carga ninguno.
(function(){
'use strict';

const {G,TOPES,Taller,pedir}=window.PeakNucleo;
const {correrAgente}=window.PeakAgente;

/** Le pide al modelo que parta la tarea. Devuelve un arreglo de subtareas. */
async function planificar(tarea, al){
  al('paso',{nombre:'Planificando', etiqueta:'plan'});
  const cuantos=Math.max(2,Math.min(G.obreros,TOPES.obrerosMax));
  const r=await pedir({mensajes:[
    {role:'system',content:
      'Partís trabajos en pedazos independientes para repartir entre agentes '+
      'que trabajan a la vez y NO se ven entre ellos.'},
    {role:'user',content:
      'Tarea:\n'+tarea+'\n\n'+
      'Partila en entre 2 y '+cuantos+' pedazos que se puedan hacer en paralelo, '+
      'sin que uno dependa del resultado del otro.\n'+
      'Contestá SOLO la lista, un pedazo por renglón, arrancando cada uno con "- ". '+
      'Cada renglón tiene que ser una instrucción completa y entendible sola, '+
      'incluyendo qué archivo dejar hecho. Nada más que la lista.'}
  ]});
  const pedazos=r.texto.split('\n')
    .map(l=>l.replace(/^\s*(?:[-*+]|\d+[.)])\s*/,'').trim())
    .filter(l=>l.length>12)
    .slice(0,cuantos);
  return pedazos.length>=2?pedazos:[tarea];     // si no supo partir, va derecho
}

/**
 * Corre el flujo completo. Devuelve {resumen, plan, partes}.
 * op: {tarea, al(evento,datos)}
 */
async function correrFlujo(op){
  const al=op.al||(()=>{});
  const plan=await planificar(op.tarea, al);
  al('plan',{pedazos:plan});

  // ── los obreros, todos a la vez ───────────────────────────────────────────
  al('paso',{nombre:plan.length+' agentes en paralelo', etiqueta:'obreros'});
  const partes=await Promise.all(plan.map((p,i)=>
    correrAgente({
      tarea:p+'\n\n(Sos uno de '+plan.length+' agentes trabajando a la vez sobre '+
            'la misma tarea grande: "'+op.tarea+'". Ocupate SOLO de tu pedazo y '+
            'dejalo hecho en un archivo del taller.)',
      profundidad:1,                       // no vuelven a delegar
      etiqueta:'obrero '+(i+1),
      al:op.al
    }).then(r=>({pedazo:p, resumen:r.resumen, ok:true}))
     .catch(e=>({pedazo:p, resumen:'Falló: '+e.message, ok:false}))
  ));

  // ── integrar ──────────────────────────────────────────────────────────────
  al('paso',{nombre:'Integrando', etiqueta:'integrador'});
  const inventario=Taller.listar().map(x=>'- '+x.nombre+' ('+x.largo+' caracteres)').join('\n')||'(vacío)';
  const integrado=await correrAgente({
    tarea:'Pedido original:\n'+op.tarea+'\n\n'+
      'Trabajaron '+partes.length+' agentes en paralelo. Esto dejó cada uno:\n\n'+
      partes.map((p,i)=>(i+1)+'. '+p.pedazo+'\n   → '+p.resumen).join('\n\n')+
      '\n\nArchivos en el taller:\n'+inventario+
      '\n\nUní todo en el resultado final que pidió la persona. Leé los archivos '+
      'que necesites, sacá lo repetido, y dejá el entregable hecho con '+
      '<peak:crear>. No rehagas lo que ya está bien.',
    profundidad:1, etiqueta:'integrador', al:op.al
  });

  // ── revisar ───────────────────────────────────────────────────────────────
  al('paso',{nombre:'Revisando', etiqueta:'revisor'});
  const revision=await correrAgente({
    tarea:'Pedido original:\n'+op.tarea+'\n\n'+
      'Ya está armado. Esto dice el integrador:\n'+integrado.resumen+'\n\n'+
      'Archivos en el taller:\n'+
      (Taller.listar().map(x=>'- '+x.nombre+' ('+x.largo+' caracteres)').join('\n')||'(vacío)')+
      '\n\nRevisá contra el pedido: ¿está todo lo que pidió? ¿quedó algo a medias, '+
      'repetido o mal? Leé lo que haga falta. Si hay algo para arreglar, '+
      'arreglalo vos con <peak:crear>. Si está bien, no toques nada. '+
      'Cerrá con <peak:listo> diciendo en dos renglones qué quedó y dónde.',
    profundidad:1, etiqueta:'revisor', al:op.al
  });

  return {
    resumen:revision.resumen||integrado.resumen,
    plan, partes,
    archivos:Taller.listar()
  };
}

window.PeakFlujo={correrFlujo, planificar};

})();
