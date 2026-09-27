
'use strict';
/* =====================================================================
   CONTRAGOLPE — tirador táctico por rondas al estilo Counter-Strike.
   Un archivo, sin red: three.js r128, lo dibujado por código y lo generado con Rezona (imágenes y sonido) van adentro.
   Mundo en metros, arriba es +y. Un personaje mira hacia −z en su marco; +x es su derecha.
   Medidas de CS: 1 unidad de Source = 0,0254 m (el jugador mide 72 u = 1,83 m y corre a 250 u/s con cuchillo).
   ===================================================================== */
const $ = id => document.getElementById(id);
const lim=(v,a,b)=> v<a?a:(v>b?b:v), lerp=(a,b,t)=> a+(b-a)*t, TAU = Math.PI*2, sig = v=> v<0?-1:(v>0?1:0);
const angDif=(a,b)=>{ let d=(b-a)%TAU; if(d>Math.PI) d-=TAU; if(d<-Math.PI) d+=TAU; return d; };
const suave = t=> t<=0 ? 0 : t>=1 ? 1 : t*t*(3-2*t);
const suave5 = t=> t<=0 ? 0 : t>=1 ? 1 : t*t*t*(t*(t*6-15)+10);
function mulberry(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function semilla32(s){ let h=1779033703^s.length; for(let i=0;i<s.length;i++){ h=Math.imul(h^s.charCodeAt(i),3432918353); h=h<<13|h>>>19; } return h>>>0; }
let rnd = mulberry(1);
const rf=(a,b)=> a+rnd()*(b-a), ri=(a,b)=> a+Math.floor(rnd()*(b-a+1)), elegir = a=> a[Math.floor(rnd()*a.length)];
const vr=(a,b)=> a+Math.random()*(b-a), vri=(a,b)=> a+Math.floor(Math.random()*(b-a+1)), velegir = a=> a[Math.floor(Math.random()*a.length)];
const V3 = (x,y,z)=> new THREE.Vector3(x,y,z);
const DT = 1/60, U = 0.0254;
const GRAD = Math.PI/180;
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m1 = new THREE.Matrix4(), _e1 = new THREE.Euler();

/* ---------- guardado ---------- */
const CLAVE = 'contragolpe.v1';
function cargar(){
  const b = {nombre:'JUGADOR', sens:5, estilo:'tinta', graficos:'auto', sonido:true, mira:'verde', idioma:null, calAuto:0, dificultad:'normal',
    modo:'bomba', mapa:'nuclear', bando:'ct', largo:'corta', xp:0, partidas:0, victorias:0, bajas:0, muertes:0, tiros:0, cabezas:0, jugadas:0};
  try{ const o = JSON.parse(localStorage.getItem(CLAVE)); if(o) return Object.assign(b, o); }catch(e){}
  return b;
}
function guardar(){ try{ localStorage.setItem(CLAVE, JSON.stringify(G)); }catch(e){} }
const G = cargar();

/* ---------- movimiento de Source en metros ---------- */
const MOV = {
  friccion:5.2, parada:80*U, acel:5.5, acelAire:12, tapaAire:30*U, grav:800*U, salto:301.993*U, escalon:18*U,
  alto:72*U, altoAg:54*U, ojo:64*U, ojoAg:46*U, ancho:32*U, caminar:0.52, agachado:0.34, tiempoAg:0.18,
};

/* ---------- armas (valores de CS:GO/CS2; velocidades en m/s, tiempos en s, ángulos en grados) ----------
   dmg: daño base · ap: parte del daño que pasa el chaleco · rpm · rango: se multiplica por rango^(d/12,7 m) · pen: poder para atravesar
   impr: imprecisión {quieto, agachado, caminando, corriendo, aire} y 'tiro': lo que suma cada disparo seguido (se recupera en 'recup' s)
   patron: desplazamiento acumulado del spray por disparo [x derecha, y arriba] en grados; la cámara sube 'patada' de eso. */
const PAT_AK = [[0,0],[0,.22],[.05,.62],[.12,1.12],[.16,1.7],[.1,2.38],[0,3.05],[-.1,3.66],[-.04,4.24],[.12,4.74],
  [-.28,5.08],[-.82,5.3],[-1.32,5.48],[-1.8,5.62],[-2.12,5.78],[-1.82,5.9],[-1.2,5.98],[-.5,6.02],[.3,6.08],[1.02,6.12],
  [1.62,6.2],[2.02,6.26],[1.8,6.3],[1.22,6.38],[.52,6.42],[-.2,6.48],[-.82,6.52],[-1.22,6.58],[-1.02,6.62],[-.62,6.68]];
const PAT_M4 = [[0,0],[0,.18],[.04,.52],[.08,.92],[.06,1.38],[-.02,1.86],[-.1,2.3],[-.04,2.68],[.14,3.0],[.36,3.26],
  [.2,3.46],[-.18,3.62],[-.56,3.74],[-.8,3.84],[-.6,3.92],[-.2,3.98],[.22,4.04],[.52,4.1],[.4,4.14],[.1,4.18]];
const PAT_SMG = (n, alto, lado)=>{ const p = []; let x = 0, y = 0; for(let i=0;i<n;i++){ y += i < 8 ? alto*(0.08 + i*0.018) : alto*0.018; x = lado*Math.sin(i*0.55)*Math.min(1, i/8); p.push([+x.toFixed(3), +y.toFixed(3)]); } return p; };
const PAT_PISTOLA = (n, kick)=>{ const p = []; for(let i=0;i<n;i++) p.push([+(Math.sin(i*1.7)*kick*0.25*Math.min(1,i/3)).toFixed(3), +(i*kick).toFixed(3)]); return p; };
const ARMAS = {
  cuchillo:{nom:'CUCHILLO', ranura:3, clase:'cuchillo', precio:0, dmg:40, vel:250*U, recompensa:1500, sacar:0.9, equipo:'ambos'},
  glock:{nom:'GLOCK-18', ranura:2, clase:'pistola', precio:200, dmg:30, ap:0.47, rpm:400, semi:true, carg:20, res:120, recarga:2.27, sacar:0.95, vel:240*U, rango:0.85, pen:1.0,
    recompensa:300, impr:{quieto:.32, agachado:.26, caminando:.9, corriendo:2.4, aire:6, tiro:.6, recup:.32}, patron:PAT_PISTOLA(20, .75), patada:.5, equipo:'t'},
  usps:{nom:'USP-S', ranura:2, clase:'pistola', precio:200, dmg:35, ap:0.505, rpm:352, semi:true, carg:12, res:24, recarga:2.2, sacar:0.95, vel:240*U, rango:0.91, pen:1.0,
    recompensa:300, impr:{quieto:.2, agachado:.16, caminando:.7, corriendo:2.1, aire:6, tiro:.55, recup:.36}, patron:PAT_PISTOLA(12, .7), patada:.5, silenciada:true, equipo:'ct'},
  deagle:{nom:'DESERT EAGLE', ranura:2, clase:'pistola', precio:700, dmg:53, ap:0.932, rpm:267, semi:true, carg:7, res:35, recarga:2.2, sacar:1.0, vel:230*U, rango:0.81, pen:2.0,
    recompensa:300, impr:{quieto:.28, agachado:.22, caminando:1.4, corriendo:3.6, aire:7, tiro:2.2, recup:.5}, patron:PAT_PISTOLA(7, 1.9), patada:.55, equipo:'ambos'},
  mac10:{nom:'MAC-10', ranura:1, clase:'smg', precio:1050, dmg:29, ap:0.575, rpm:800, carg:30, res:100, recarga:2.6, sacar:1.0, vel:240*U, rango:0.8, pen:1.0,
    recompensa:600, impr:{quieto:.9, agachado:.75, caminando:1.1, corriendo:1.9, aire:5, tiro:.12, recup:.3}, patron:PAT_SMG(30, 3.4, .9), patada:.5, equipo:'t'},
  mp9:{nom:'MP9', ranura:1, clase:'smg', precio:1250, dmg:26, ap:0.6, rpm:857, carg:30, res:120, recarga:2.13, sacar:1.0, vel:240*U, rango:0.87, pen:1.0,
    recompensa:600, impr:{quieto:.8, agachado:.66, caminando:1.0, corriendo:1.7, aire:5, tiro:.11, recup:.3}, patron:PAT_SMG(30, 3.1, .7), patada:.5, equipo:'ct'},
  ak47:{nom:'AK-47', ranura:1, clase:'rifle', precio:2700, dmg:36, ap:0.775, rpm:600, carg:30, res:90, recarga:2.43, sacar:1.1, vel:215*U, rango:0.98, pen:2.0,
    recompensa:300, impr:{quieto:.15, agachado:.1, caminando:1.6, corriendo:6.5, aire:12, tiro:.12, recup:.36}, patron:PAT_AK, patada:.45, equipo:'t'},
  m4s:{nom:'M4A1-S', ranura:1, clase:'rifle', precio:2900, dmg:38, ap:0.70, rpm:600, carg:20, res:80, recarga:3.07, sacar:1.1, vel:225*U, rango:0.99, pen:2.0,
    recompensa:300, impr:{quieto:.12, agachado:.08, caminando:1.4, corriendo:5.6, aire:11, tiro:.1, recup:.34}, patron:PAT_M4, patada:.45, silenciada:true, equipo:'ct'},
  awp:{nom:'AWP', ranura:1, clase:'francotirador', precio:4750, dmg:115, ap:0.975, rpm:41, semi:true, carg:5, res:30, recarga:3.67, sacar:1.25, vel:200*U, velMira:100*U, rango:0.99, pen:2.5,
    recompensa:100, impr:{quieto:4.5, agachado:4.2, caminando:5, corriendo:8, aire:14, tiro:0, recup:.3, mira:.03, miraMov:4}, patron:[[0,0],[0,2.5]], patada:.9, mira:[40, 10], equipo:'ambos'},
  he:{nom:'GRANADA HE', ranura:4, clase:'granada', precio:300, vel:245*U, sacar:0.6, recompensa:300, equipo:'ambos'},
  flash:{nom:'FLASH', ranura:4, clase:'granada', precio:200, vel:245*U, sacar:0.6, recompensa:300, equipo:'ambos'},
  humo:{nom:'HUMO', ranura:4, clase:'granada', precio:300, vel:245*U, sacar:0.6, recompensa:300, equipo:'ambos'},
  c4:{nom:'C4', ranura:5, clase:'c4', precio:0, vel:250*U, sacar:0.9, equipo:'t'},
};
const EQUIPO = {kevlar:{nom:'CHALECO', precio:650}, casco:{nom:'CHALECO Y CASCO', precio:1000}, kit:{nom:'KIT DE DESACTIVACIÓN', precio:400}};
for(const k in ARMAS){ const a = ARMAS[k]; a.id = k; if(a.rpm) a.ciclo = 60/a.rpm; }
const MULT_ZONA = {cabeza:4, pecho:1, estomago:1.25, brazo:1, pierna:0.75};

/* ---------- economía de CS ---------- */
const ECO = {inicio:800, tope:16000, ganaElim:3250, ganaBomba:3500, ganaDesact:3500, ganaTiempo:3250, perdida:[1400, 1900, 2400, 2900, 3400], plantar:300, plantaPerdida:800};
const RONDA = {congelado:10, compra:20, tiempo:115, bomba:40, desact:10, desactKit:5, plantar:3.2, finRonda:6};

/* ---------- modos y mapas ---------- */
const MODOS = {
  bomba:{nom:'DESACTIVACIÓN', txt:'5 contra 5 por rondas. Los terroristas plantan la bomba en A o B; los antiterroristas la defienden o la desactivan. Compra, dinero y una sola vida por ronda.', equipos:true, arte:'arte_modo_bomba'},
  dm:{nom:'COMBATE A MUERTE', txt:'Todos contra todos, reaparecés a los dos segundos con el arma que elijas. Gana el primero en llegar a 30 bajas o el que más tenga a los 8 minutos.', equipos:false, arte:'arte_modo_dm'},
  armas:{nom:'CARRERA DE ARMAS', txt:'Cada baja te cambia el arma por la siguiente, de los rifles a la pistola. Gana el primero que remata con el cuchillo dorado. Si te acuchillan, bajás un escalón.', equipos:false, arte:'arte_modo_armas'},
};
const ESCALERA_ARMAS = ['ak47', 'm4s', 'awp', 'mp9', 'mac10', 'deagle', 'usps', 'glock', 'cuchillo'];
const ORDEN_MAPAS = ['nuclear', 'desierto', 'almacen'];
const NOMBRES_BOT = ['ORTIZ', 'MAYA', 'RULO', 'TANO', 'CHINO', 'PERLA', 'GORDO', 'NENA', 'COLO', 'PELADO', 'FLACO', 'RUSO', 'TUCU', 'MONO', 'LALO', 'PIPA', 'VASCO', 'NEGRO', 'CHULO', 'BETO'];
const DIFICULTAD = {
  facil:{nom:'FÁCIL', reaccion:[0.55, 0.85], punteria:0.35, giro:4.5, cabeza:0.08, control:0.25, frena:0.2},
  normal:{nom:'NORMAL', reaccion:[0.32, 0.55], punteria:0.6, giro:7, cabeza:0.22, control:0.55, frena:0.6},
  dificil:{nom:'DIFÍCIL', reaccion:[0.2, 0.34], punteria:0.82, giro:10, cabeza:0.4, control:0.8, frena:0.9},
};
