// agente.js — el protocolo de herramientas, el lector incremental y el bucle.
//
// Por qué un protocolo de texto y no "function calling" de OpenAI: el motor
// gratis (Pollinations) y varios de los 492 de OmniRoute no lo soportan o lo
// soportan mal. Un protocolo de etiquetas anda con cualquier modelo que sepa
// escribir texto, que son todos.
//
// La etiqueta se lee MIENTRAS llega. Eso es lo que permite no mostrar el
// contenido de un archivo mientras el modelo lo escribe: apenas se ve la
// apertura <peak:crear>, lo que sigue deja de ir a la pantalla y pasa a un
// renglón de actividad que dice "ejecutando".

// Cada módulo va adentro de su propia función: son <script> clásicos y
// comparten el ámbito global, así que sin esto el `const G` de nucleo.js
// choca con el `const {G}` de los demás y no carga ninguno.
(function(){
'use strict';

const {G,TOPES,Taller,pedir,pedirLargo,compactar,Corte}=window.PeakNucleo;
const FMT=window.PeakFormatos;

// ── el lector incremental ────────────────────────────────────────────────────
/** El sufijo más largo de `buf` que podría ser el arranque de `marca`. */
function colaParcial(buf,marca){
  const max=Math.min(buf.length,marca.length-1);
  for(let n=max;n>0;n--) if(marca.startsWith(buf.slice(buf.length-n))) return n;
  return 0;
}
/** Índice del '>' que cierra el tag, salteando el que esté entre comillas. */
function finDeTag(s){
  let com=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==='"') com=!com;
    else if(c==='>'&&!com) return i;
  }
  return -1;
}
function atributos(s){
  const a={}; let m;
  const re=/([a-zA-ZáéíóúñA-Z_][\w-]*)\s*=\s*"([^"]*)"/g;
  while((m=re.exec(s))) a[m[1].toLowerCase()]=m[2];
  return a;
}

// Contador global de acciones. Con índice+milisegundo dos agentes en paralelo
// podían sacar el mismo id y pisarse el renglón en pantalla: uno quedaba
// colgado en "ejecutando" para siempre. Se ve solo con varios agentes a la vez.
let _idAccion=0;

class Lector{
  /** manejadores: {prosa, abrir, contenido, cerrar} */
  constructor(man){ this.man=man; this.buf=''; this.dentro=null; this.acciones=[]; }
  get incompleto(){ return this.dentro!==null; }

  empujar(d){
    this.buf+=d;
    for(;;){
      if(!this.dentro){
        const i=this.buf.indexOf('<peak:');
        if(i===-1){
          const g=colaParcial(this.buf,'<peak:');
          const salida=this.buf.slice(0,this.buf.length-g);
          if(salida) this.man.prosa?.(salida);
          this.buf=this.buf.slice(this.buf.length-g);
          return;
        }
        if(i>0){ this.man.prosa?.(this.buf.slice(0,i)); this.buf=this.buf.slice(i); }
        const j=finDeTag(this.buf);
        if(j===-1) return;                       // el tag todavía no llegó entero
        const crudo=this.buf.slice(0,j+1);
        const nombre=(crudo.match(/^<peak:([\w-]+)/)||[,''])[1].toLowerCase();
        const acc={nombre, attrs:atributos(crudo.slice(6+nombre.length)), texto:'',
                   id:'a'+(++_idAccion)};
        this.buf=this.buf.slice(j+1);
        if(crudo.endsWith('/>')){                // <peak:listar/>
          this.acciones.push(acc); this.man.abrir?.(acc); this.man.cerrar?.(acc);
        }else{
          acc.cierre='</peak:'+nombre+'>';
          this.dentro=acc; this.acciones.push(acc); this.man.abrir?.(acc);
        }
      }else{
        const cierre=this.dentro.cierre;
        const k=this.buf.indexOf(cierre);
        if(k===-1){
          const g=colaParcial(this.buf,cierre);
          const trozo=this.buf.slice(0,this.buf.length-g);
          if(trozo){ this.dentro.texto+=trozo; this.man.contenido?.(this.dentro,trozo); }
          this.buf=this.buf.slice(this.buf.length-g);
          return;
        }
        const trozo=this.buf.slice(0,k);
        if(trozo){ this.dentro.texto+=trozo; this.man.contenido?.(this.dentro,trozo); }
        this.buf=this.buf.slice(k+cierre.length);
        const acc=this.dentro; this.dentro=null; this.man.cerrar?.(acc);
      }
    }
  }
  /** Cierra el lector. Si quedó un bloque abierto, `incompleto` queda en true. */
  terminar(){
    if(!this.dentro && this.buf){ this.man.prosa?.(this.buf); this.buf=''; }
    return this.acciones;
  }
}

// ── las herramientas ─────────────────────────────────────────────────────────
function human(n){ return n<1024?n+' B':(n/1024).toFixed(1).replace('.',',')+' KB'; }

/** Escribe en el taller Y en Descargas. Devuelve {texto, ruta}. */
function guardarEnDisco(nombre, texto){
  const ext=FMT.normExt((nombre.match(/\.([A-Za-z0-9]+)$/)||[,'txt'])[1]);
  const hecho=FMT.construir(ext, texto, nombre.replace(/\.[^.]+$/,''));
  let ruta;
  if(hecho.bytes) ruta=Peak.guardarBinario(nombre, FMT.b64(hecho.bytes), hecho.mime);
  else            ruta=Peak.guardar(nombre, hecho.texto);
  return ruta;
}

const HERRAMIENTAS={
  plan(a){ return 'Plan anotado.'; },
  pensar(a){ return 'Anotado.'; },

  crear(a){
    const nom=Taller.escribir(a.attrs.archivo||a.attrs.nombre||'archivo.txt', a.texto);
    const ruta=guardarEnDisco(nom, a.texto);
    a.ruta=ruta;
    if(String(ruta).startsWith('ERROR'))
      return 'Quedó en el taller ('+a.texto.length+' caracteres) pero no se pudo '+
             'guardar en el teléfono: '+ruta;
    return 'Creado '+nom+', '+a.texto.length+' caracteres. Guardado en '+ruta;
  },
  anexar(a){
    const nom=Taller.anexar(a.attrs.archivo, a.texto);
    const ruta=guardarEnDisco(nom, Taller.leer(nom));
    a.ruta=ruta;
    return 'Ampliado '+nom+', ahora '+Taller.leer(nom).length+' caracteres.';
  },
  leer(a){
    const nom=a.attrs.archivo;
    if(!Taller.existe(nom)) return 'No existe "'+nom+'" en el taller. Usá <peak:listar/>.';
    const desde=+(a.attrs.desde||0), tope=+(a.attrs.hasta||desde+6000);
    const todo=Taller.leer(nom);
    const trozo=todo.slice(desde,tope);
    const cola=todo.length>tope?'\n[…quedan '+(todo.length-tope)+' caracteres; pedí desde="'+tope+'"]':'';
    return 'Contenido de '+nom+' ('+desde+'-'+Math.min(tope,todo.length)+' de '+todo.length+'):\n'+trozo+cola;
  },
  listar(a){
    const l=Taller.listar();
    if(!l.length) return 'El taller está vacío.';
    return 'Archivos en el taller:\n'+l.map(x=>'- '+x.nombre+' ('+x.largo+' caracteres)').join('\n');
  },
  borrar(a){ return Taller.borrar(a.attrs.archivo)?'Borrado '+a.attrs.archivo:'No existía.'; },
  buscar(a){
    const q=a.attrs.texto||a.texto.trim();
    const r=Taller.buscar(q);
    if(!r.length) return 'Sin resultados para "'+q+'".';
    return r.map(x=>x.archivo+':'+x.linea+': '+x.texto).join('\n');
  },
  guardar(a){
    const nom=a.attrs.archivo;
    const base=(nom||'archivo').replace(/\.[^.]+$/,'');
    const ext=FMT.normExt(a.attrs.formato||'txt');
    const texto=Taller.existe(nom)?Taller.leer(nom):(a.texto||'');
    if(!texto) return 'No hay contenido para guardar.';
    const destino=base+'.'+ext;
    const ruta=guardarEnDisco(destino, texto);
    a.ruta=ruta;
    return String(ruta).startsWith('ERROR')?ruta:'Guardado '+destino+' en '+ruta;
  },
  listo(a){ return 'Listo.'; }
};

// ── el sistema que le enseña el protocolo al modelo ──────────────────────────
function sistema(puedeDelegar){
  const exts=[...new Set(FMT.FORMATOS.map(f=>f.ext))].join(', ');
  return `Sos PeakCode, un agente que trabaja en un teléfono. No charlás: hacés.

Tenés herramientas. Se usan escribiendo etiquetas en tu respuesta. La app las
ejecuta de verdad y te devuelve el resultado, y ahí seguís.

<peak:plan>lo que vas a hacer, en renglones cortos</peak:plan>
<peak:crear archivo="informe.md">…contenido completo…</peak:crear>
<peak:anexar archivo="informe.md">…más contenido al final…</peak:anexar>
<peak:leer archivo="datos.csv" desde="0" hasta="6000"></peak:leer>
<peak:listar/>
<peak:buscar texto="ventas"/>
<peak:borrar archivo="viejo.txt"/>
<peak:guardar archivo="informe.md" formato="pdf"/>${puedeDelegar?`
<peak:agente nombre="investigador" tarea="qué tiene que lograr">contexto extra</peak:agente>`:''}
<peak:listo>resumen de una o dos líneas de lo que quedó hecho</peak:listo>

Reglas:
1. <peak:crear> escribe el archivo de verdad en el teléfono, en Descargas/PeakCode.
   El formato sale de la extensión. Podés usar: ${exts}.
   Los formatos armados (pdf, docx, xlsx, pptx, odt, ods, epub, rtf) se generan
   desde texto: escribí Markdown para documentos y CSV para planillas, que la app
   los convierte. Para pptx, cada "# título" es una lámina.
2. Adentro de <peak:crear> va SOLO el contenido del archivo. Sin explicaciones,
   sin \`\`\`, sin comentarios tuyos. Eso va afuera de la etiqueta.
3. Escribí el archivo entero de una. Si te cortan por largo, te van a pedir que
   sigas: retomá exacto donde quedaste, no repitas y no vuelvas a abrir la etiqueta.
4. Un archivo grande no se relee entero: usá <peak:leer> con desde/hasta.
5. Cuando terminaste, cerrá con <peak:listo>. Sin eso la app sigue esperando.
6. Nada de inventar resultados de herramientas: esperá a que te los devuelvan.${puedeDelegar?`
7. Para tareas que se pueden partir, largá varios <peak:agente> en la MISMA
   respuesta: corren en paralelo. Dales tareas independientes y concretas.
   Los subagentes no pueden delegar de nuevo.`:''}

Hablás rioplatense, directo y corto.`;
}

// ── el bucle ─────────────────────────────────────────────────────────────────
/**
 * Corre una tarea hasta terminarla.
 * op: {tarea, contexto:[], al(evento,datos), profundidad, modelo, etiqueta}
 * Devuelve {resumen, acciones, vueltas}
 */
async function correrAgente(op){
  const prof=op.profundidad||0;
  const puedeDelegar=prof<TOPES.profundidad-1;
  let mensajes=[{role:'system',content:sistema(puedeDelegar)},
                ...(op.contexto||[]),
                {role:'user',content:op.tarea}];
  const al=op.al||(()=>{});
  const hechas=[]; let resumen='';

  for(let vuelta=1; vuelta<=TOPES.vueltas; vuelta++){
    if(Corte.pedido){ al('cortado',{etiqueta:op.etiqueta});
      return {resumen:'Cortado. Lo que llegó a hacerse quedó en el taller.',
              acciones:hechas, vueltas:vuelta}; }
    al('vuelta',{n:vuelta, etiqueta:op.etiqueta});
    mensajes=await compactar(mensajes, ()=>al('compactando',{}));

    const lector=new Lector({
      prosa:t=>al('prosa',{texto:t, etiqueta:op.etiqueta}),
      abrir:a=>al('abrir',{accion:a, etiqueta:op.etiqueta}),
      contenido:(a,t)=>al('avance',{accion:a, bytes:a.texto.length, etiqueta:op.etiqueta}),
      cerrar:a=>al('cerrar',{accion:a, etiqueta:op.etiqueta})
    });

    const r=await pedirLargo({
      mensajes, modelo:op.modelo,
      onTexto:d=>lector.empujar(d),
      incompleto:()=>lector.incompleto,
      onSeguir:(n,largo)=>al('seguir',{n, largo, etiqueta:op.etiqueta})
    });
    const acciones=lector.terminar();

    if(!acciones.length){                       // contestó de una, sin herramientas
      resumen=r.texto.trim();
      al('fin',{resumen, etiqueta:op.etiqueta});
      return {resumen, acciones:hechas, vueltas:vuelta};
    }

    // Las locales, en orden. Los subagentes, todos juntos.
    const resultados=[];
    const delegadas=[];
    for(const a of acciones){
      if(a.nombre==='agente'&&puedeDelegar){ delegadas.push(a); continue; }
      let salida;
      try{
        const h=HERRAMIENTAS[a.nombre];
        salida=h?h(a):'No existe la herramienta "'+a.nombre+'".';
      }catch(e){ salida='Falló: '+e.message; }
      a.resultado=salida;
      hechas.push(a);
      al('resultado',{accion:a, salida, etiqueta:op.etiqueta});
      resultados.push({de:a.nombre, archivo:a.attrs.archivo||'', salida});
    }

    if(delegadas.length){
      al('delegando',{cuantos:delegadas.length, etiqueta:op.etiqueta});
      const tanda=delegadas.slice(0, Math.max(1,Math.min(G.obreros,TOPES.obrerosMax)));
      const sobran=delegadas.slice(tanda.length);
      const salidas=await Promise.all(tanda.map(a=>
        correrAgente({
          tarea:(a.attrs.tarea||a.texto||'').trim()+(a.texto&&a.attrs.tarea?'\n\nContexto:\n'+a.texto:''),
          profundidad:prof+1, al:op.al, modelo:op.modelo,
          etiqueta:a.attrs.nombre||('agente '+(tanda.indexOf(a)+1))
        }).then(x=>({de:'agente', archivo:a.attrs.nombre||'', salida:x.resumen}))
         .catch(e=>({de:'agente', archivo:a.attrs.nombre||'', salida:'Falló: '+e.message}))
      ));
      resultados.push(...salidas);
      for(const a of sobran) resultados.push({de:'agente', archivo:a.attrs.nombre||'',
        salida:'No se ejecutó: hay un tope de '+tanda.length+' agentes por vuelta.'});
    }

    if(Corte.pedido){ al('cortado',{etiqueta:op.etiqueta});
      return {resumen:'Cortado. Lo que llegó a hacerse quedó en el taller.',
              acciones:hechas, vueltas:vuelta}; }

    const cierre=acciones.find(a=>a.nombre==='listo');
    if(cierre){
      resumen=cierre.texto.trim()||'Listo.';
      al('fin',{resumen, etiqueta:op.etiqueta});
      return {resumen, acciones:hechas, vueltas:vuelta};
    }

    mensajes.push({role:'assistant',content:r.texto});
    mensajes.push({role:'user',content:resultados.map(x=>
      '<peak:resultado de="'+x.de+'"'+(x.archivo?' archivo="'+x.archivo+'"':'')+'>\n'+
      x.salida+'\n</peak:resultado>').join('\n')+
      '\n\nSeguí. Si ya está todo, cerrá con <peak:listo>.'});
  }
  resumen='Me frené en el tope de '+TOPES.vueltas+' pasos. Lo que quedó hecho está en el taller.';
  al('fin',{resumen, etiqueta:op.etiqueta});
  return {resumen, acciones:hechas, vueltas:TOPES.vueltas};
}

window.PeakAgente={Lector,correrAgente,HERRAMIENTAS,sistema,guardarEnDisco,human,
  colaParcial,finDeTag,atributos};

})();
