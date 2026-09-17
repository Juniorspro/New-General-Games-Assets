// El dibujo. Todo vectorial menos el bicho y el vestido de los menús.
//
// LOS PISOS DE LA TORRE. Cada doscientos metros cambia el color, y no es
// decoración: en un juego sin final, lo único que le dice al jugador que avanzó
// es que el lugar cambió. Un número subiendo no alcanza — se mira una vez y se
// deja de mirar.

import { F, ANCHO, VISTA, mezcla } from "./mundo.js";
import { PARED } from "./juego.js";
import { ruta } from "./assets.js";

const PISOS = [
  { clave: "piso.sotano",  cielo: ["#0b1020", "#161f3c"], pared: "#26335c", luz: "#5ad8ff" },
  { clave: "piso.oficinas", cielo: ["#141026", "#2a1f47"], pared: "#443066", luz: "#c77bff" },
  { clave: "piso.taller",  cielo: ["#1a1208", "#3a2610"], pared: "#5c4020", luz: "#ffb54a" },
  { clave: "piso.antenas", cielo: ["#04161c", "#0c3340"], pared: "#145364", luz: "#4ffbdf" },
  { clave: "piso.nubes",   cielo: ["#191a2e", "#333category"], pared: "#4a4d78", luz: "#ffd1f0" },
];
// Un color mal escrito no tira error: el navegador lo ignora y deja el anterior.
PISOS[4].cielo[1] = "#3a3d63";
const ALTO_PISO = 20000;                     // 200 metros

// El módulo TIENE que ser positivo: la altura arranca en cero y baja a números
// negativos apenas se sube, y en JavaScript `-1 % 5` es -1, no 4.
export const pisoDe = (alto) =>
  PISOS[((Math.floor(alto / ALTO_PISO) % PISOS.length) + PISOS.length) % PISOS.length];

const mezclarColor = (a, b, t) => {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  return `rgb(${Math.round(mezcla(r1, r2, t))},${Math.round(mezcla(g1, g2, t))},${Math.round(mezcla(b1, b2, t))})`;
};

// El polvo del fondo: cuatrocientos números que no cambian nunca. Generarlos en
// cada cuadro costaría lo mismo que dibujarlos y además parpadearían.
const frac = (x) => x - Math.floor(x);
const POLVO = [];
for (let i = 0; i < 400; i++)
  POLVO.push({ x: frac(Math.sin(i * 12.9898) * 43758.5453) * ANCHO,
               y: frac(Math.sin(i * 78.233) * 43758.5453) * 4000,
               r: 0.5 + frac(Math.sin(i * 3.123) * 17231.1) * 1.6 });

const arte = {};
export function registrarArte(nombre, imagen) { if (imagen) arte[nombre] = imagen; }

/**
 * El fondo de la torre, a media velocidad y teñido con el color del piso.
 *
 * SE REPITE ESPEJADO, dando vuelta una copia sí y una no. Pedirle a un generador
 * una textura que empalme consigo misma no funciona —siempre se ve la costura— y
 * arreglarla a mano cuesta una tarde. Espejada, la costura es la imagen contra sí
 * misma: coincide por construcción, y en una maraña de vigas nadie nota la
 * simetría.
 *
 * Y SE TIÑE en vez de tener una textura por piso: cinco imágenes son cinco veces
 * el peso, y además se desincronizan con los colores del código apenas alguien
 * toca un piso.
 */
function dibujarFondo(ctx, piso, sig, t, cam, al) {
  const im = arte.fondo_torre;
  if (!im) return;
  const alto = im.height;
  const desp = cam * 0.45;
  const primera = Math.floor(desp / alto);
  ctx.save();
  ctx.globalAlpha = 0.42;
  for (let k = -1; k <= Math.ceil(al / alto); k++) {
    const i = primera + k;
    const y = i * alto - desp;
    if (y > al || y + alto < 0) continue;
    ctx.save();
    // El módulo tiene que ser POSITIVO: la torre sube, así que la cámara es
    // negativa, y en JavaScript `-1 % 2` es -1, no 1.
    if (((i % 2) + 2) % 2 === 1) { ctx.translate(0, y + alto); ctx.scale(1, -1); }
    else ctx.translate(0, y);
    ctx.drawImage(im, 0, 0, ANCHO, alto);
    ctx.restore();
  }
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = mezclarColor(piso.pared, sig.pared, t);
  ctx.fillRect(0, 0, ANCHO, al);
  ctx.restore();
}
export const rutaArte = (n) => ruta(`assets/arte/${n}.webp`);

export function dibujar(ctx, p) {
  const al = VISTA.alto;
  const cam = p.cam;
  const piso = pisoDe(p.alto);
  const sig = PISOS[(PISOS.indexOf(piso) + 1) % PISOS.length];
  // El cambio de piso se MEZCLA en los últimos veinte metros en vez de cortar
  // seco: un corte de color a mitad de un swing se lee como un error de dibujo.
  const dentro = (p.alto % ALTO_PISO) / ALTO_PISO;
  const t = dentro > 0.9 ? (dentro - 0.9) / 0.1 : 0;

  ctx.save();
  const sac = p.sacude;
  if (sac > 0.4) ctx.translate((Math.random() - 0.5) * sac, (Math.random() - 0.5) * sac);

  const g = ctx.createLinearGradient(0, 0, 0, al);
  g.addColorStop(0, mezclarColor(piso.cielo[0], sig.cielo[0], t));
  g.addColorStop(1, mezclarColor(piso.cielo[1], sig.cielo[1], t));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, al);

  // Polvo, con parallax: se mueve a la mitad para que la torre se sienta honda.
  ctx.fillStyle = "rgba(255,255,255,.10)";
  for (const d of POLVO) {
    const y = ((d.y - cam * 0.5) % 4000 + 4000) % 4000;
    if (y > al) continue;
    ctx.beginPath(); ctx.arc(d.x, y, d.r, 0, 7); ctx.fill();
  }

  dibujarFondo(ctx, piso, sig, t, cam, al);
  dibujarParedes(ctx, p, piso, sig, t, cam, al);
  dibujarTuercas(ctx, p, cam);
  dibujarArgollas(ctx, p, piso, cam, al);
  dibujarSoga(ctx, p, cam);
  dibujarEstela(ctx, p, cam);
  dibujarBicho(ctx, p, cam);
  dibujarChispas(ctx, p, cam);
  dibujarVelocidad(ctx, p, al);
  dibujarMarea(ctx, p, al);
  ctx.restore();
}

function dibujarParedes(ctx, p, piso, sig, t, cam, al) {
  const color = mezclarColor(piso.pared, sig.pared, t);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, PARED, al);
  ctx.fillRect(ANCHO - PARED, 0, PARED, al);
  // Las juntas de los ladrillos dan la referencia de velocidad: sin ellas, con
  // el fondo liso, no se nota si estás subiendo rápido o despacio.
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 2;
  const paso = 46;
  const y0 = -(((cam % paso) + paso) % paso);
  ctx.beginPath();
  for (let y = y0; y < al; y += paso) {
    ctx.moveTo(0, y); ctx.lineTo(PARED, y);
    ctx.moveTo(ANCHO - PARED, y); ctx.lineTo(ANCHO, y);
  }
  ctx.stroke();
  const luz = ctx.createLinearGradient(0, 0, PARED + 26, 0);
  luz.addColorStop(0, piso.luz + "33"); luz.addColorStop(1, "transparent");
  ctx.fillStyle = luz; ctx.fillRect(0, 0, PARED + 26, al);
}

function dibujarArgollas(ctx, p, piso, cam, al) {
  for (const a of p.torre.argollas) {
    const y = a.y - cam;
    if (y < -40 || y > al + 40 || a.rota) continue;
    const viva = p.ancla === a;
    // UNA ARGOLLA OXIDADA SE VE OXIDADA DESDE LEJOS, y además muestra cuánto le
    // queda mientras estás colgado. Un peligro que sólo se entiende cuando ya
    // te pasó no es un peligro: es una trampa.
    const col = a.oxidada ? "#e08b2c" : piso.luz;
    if (viva) {
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 16;
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = a.oxidada ? 3.5 : 3;
    ctx.beginPath(); ctx.arc(a.x, y, F.ARGOLLA, 0, 7); ctx.stroke();
    if (a.oxidada) {
      ctx.strokeStyle = "#3a2a14"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(a.x, y, F.ARGOLLA, 0.6, 2.2); ctx.stroke();
      if (viva) {
        const queda = 1 - (p.t - a.tocada) / F.VIDA_OXIDADA;
        ctx.strokeStyle = "#ff6b6b"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(a.x, y, F.ARGOLLA + 5, -Math.PI / 2, -Math.PI / 2 + Math.max(0, queda) * 6.283);
        ctx.stroke();
      }
    }
    if (viva) ctx.restore();
    // El gancho clavado: un tornillo en el centro, para que se vea DONDE está
    // enganchado y no sólo que lo está.
    if (viva) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(a.x, y, 3.2, 0, 7); ctx.fill(); }
  }
}

function dibujarTuercas(ctx, p, cam) {
  ctx.lineWidth = 2;
  for (const t of p.torre.tuercas) {
    if (t.tomada) continue;
    const y = t.y - cam;
    if (y < -20 || y > VISTA.alto + 20) continue;
    ctx.save();
    ctx.translate(t.x, y);
    ctx.rotate(p.t * 0.05);
    ctx.fillStyle = "#ffd84a"; ctx.strokeStyle = "#7a5a10";
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const an = (i / 6) * 6.283;
      ctx[i ? "lineTo" : "moveTo"](Math.cos(an) * 8, Math.sin(an) * 8);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#2a2010";
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();
    ctx.restore();
  }
}

function dibujarSoga(ctx, p, cam) {
  if (!p.ancla) return;
  const a = p.ancla;
  // LA SOGA SE DIBUJA COLGANDO cuando está floja y tirante cuando está
  // estirada, porque esa es información: floja quiere decir que la soga no está
  // haciendo nada y que estás en caída libre alrededor de la argolla.
  const d = Math.hypot(p.x - a.x, p.y - a.y);
  const floja = Math.max(0, p.largo - d);
  ctx.strokeStyle = "#d9d2c4"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - cam);
  if (floja > 2) {
    const mx = (a.x + p.x) / 2, my = (a.y + p.y) / 2 - cam + floja * 0.55;
    ctx.quadraticCurveTo(mx, my, p.x, p.y - cam);
  } else ctx.lineTo(p.x, p.y - cam);
  ctx.stroke();
}

function dibujarBicho(ctx, p, cam) {
  const y = p.y - cam;
  const im = arte.bicho;
  ctx.save();
  ctx.translate(p.x, y);
  // Se inclina con la velocidad: sin eso es una pelota y con eso es alguien
  // volando. Cuesta una rotación por cuadro.
  ctx.rotate(Math.atan2(p.vx, Math.max(1, -p.vy + 6)) * 0.55);
  if (im) {
    const h = F.BICHO * 3.4, w = h * (im.width / im.height);
    ctx.drawImage(im, -w / 2, -h * 0.46, w, h);
  } else {
    ctx.fillStyle = "#ffe9c9"; ctx.strokeStyle = "#1a1408"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, F.BICHO, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#1a1408";
    ctx.beginPath(); ctx.arc(-3.5, -2, 1.8, 0, 7); ctx.arc(3.5, -2, 1.8, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/**
 * La estela: por dónde venís.
 *
 * ES LA AYUDA MAS GRANDE QUE DA LA PANTALLA en un juego de soltar en el momento
 * justo. Un péndulo se ve como una bolita quieta en el aire; con la cola de los
 * últimos cuadros se ve el ARCO, y viendo el arco se puede predecir por dónde
 * vas a salir — que es exactamente la decisión del juego. Sin ella hay que
 * soltar de memoria.
 */
function dibujarEstela(ctx, p, cam) {
  const e = p.estela;
  if (!e || e.length < 2) return;
  ctx.lineCap = "round";
  for (let i = 1; i < e.length; i++) {
    const k = i / e.length;
    ctx.globalAlpha = k * 0.5;
    ctx.strokeStyle = p.ancla ? "#b6f0ff" : "#ffd1a0";
    ctx.lineWidth = 1 + k * 4;
    ctx.beginPath();
    ctx.moveTo(e[i - 1].x, e[i - 1].y - cam);
    ctx.lineTo(e[i].x, e[i].y - cam);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Rayas de aire cuando venís rápido. El mismo truco que en Paraguas: a esta
 *  velocidad el fondo ya no se percibe como movimiento. */
function dibujarVelocidad(ctx, p, al) {
  const v = Math.hypot(p.vx, p.vy) / F.VEL_MAX;
  if (v < 0.45) return;
  const int = (v - 0.45) / 0.55;
  ctx.strokeStyle = `rgba(255,255,255,${0.04 + int * 0.13})`;
  ctx.lineWidth = 1.4;
  const an = Math.atan2(p.vy, p.vx);
  for (let i = 0; i < 10; i++) {
    const rx = frac(Math.sin((i + Math.floor(p.t / 3) * 0.37) * 91.7) * 7331) * ANCHO;
    const ry = frac(Math.sin((i * 3.7 + Math.floor(p.t / 3) * 0.91)) * 4331) * al;
    const largo = 16 + int * 54;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - Math.cos(an) * largo, ry - Math.sin(an) * largo);
    ctx.stroke();
  }
}

function dibujarChispas(ctx, p, cam) {
  for (const c of p.chispas) {
    ctx.globalAlpha = Math.min(1, c.vida / 22);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - 2, c.y - cam - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function dibujarMarea(ctx, p, al) {
  if (!p.sube) return;
  // El borde de abajo se pinta cuando empieza a subir solo. Es lo único que
  // avisa que ahora hay apuro, y tiene que verse sin leer nada.
  const g = ctx.createLinearGradient(0, al - 70, 0, al);
  g.addColorStop(0, "rgba(255,60,60,0)");
  g.addColorStop(1, `rgba(255,60,60,${0.18 + 0.16 * Math.sin(p.t * 0.12)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, al - 70, ANCHO, 70);
}
