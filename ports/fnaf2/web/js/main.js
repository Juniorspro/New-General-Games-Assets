/* FNaF 2 (port): intro de JXStudios y arranque directo como el original (en inglés), el lienzo 4:3 (girado 90° con el celu parado), teclado, mouse y toques
   (el dedo hace de mouse: al soltar, el puntero se va de la pantalla para que los «mouse encima» se suelten),
   botones de dedo para las teclas que usa cada pantalla, ajustes y el bucle a 60 loops por segundo. */
import { prepararEmbebidos, url, traer } from './archivos.js';
import { Motor } from './motor.js';
import { Sonido } from './sonido.js';
import { t, ponerIdioma, idioma } from './textos.js';
import { crearControles } from './controles.js';
import { P, revisarGiro } from './pantalla.js';

const $ = (s) => document.querySelector(s);
const CLAVE = 'fnaf2.v1';
let aj = {}; try { aj = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { aj = {}; }
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(aj)); } catch { /* sin almacenamiento */ } };

const VK = { Escape: 27, Enter: 13, NumpadEnter: 13, ControlLeft: 17, ControlRight: 17, ShiftLeft: 16, ShiftRight: 16, Space: 32, Delete: 46, Backspace: 8,
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, NumpadAdd: 107, NumpadSubtract: 109, Tab: 9 };
const vkDe = (e) => VK[e.code] ?? (/^Key[A-Z]$/.test(e.code) ? e.code.charCodeAt(3) : /^Digit\d$/.test(e.code) ? e.code.charCodeAt(5) : /^Numpad\d$/.test(e.code) ? 96 + +e.code[6] : null);

/* ---------------- INI del juego (kcini) en localStorage */
const ini = {
  archivo: 'freddy2', grupo: 'freddy2', item: '',
  datos: (() => { try { return JSON.parse(localStorage.getItem('fnaf2.ini') || '{}'); } catch { return {}; } })(),
  clave(item) { return this.archivo + '|' + this.grupo + '|' + item; },
  valor(item) { const v = this.datos[this.clave(item)]; return v == null ? 0 : Number(v) || 0; },
  texto(item) { const v = this.datos[this.clave(item)]; return v == null ? '' : String(v); },
  poner(item, v) { this.datos[this.clave(item)] = v; try { localStorage.setItem('fnaf2.ini', JSON.stringify(this.datos)); } catch { /* */ } },
};

/* ---------------- imágenes: se piden cuando hacen falta; cada frame decodifica antes las del arranque */
const IMGS = new Map();
function imagen(h) {
  let x = IMGS.get(h);
  if (!x) { x = new Image(); x.decoding = 'async'; x.src = url('datos/img/' + h + '.webp'); IMGS.set(h, x); }
  return x.complete && x.naturalWidth ? x : null;
}
const decodificar = (h) => { imagen(h); const x = IMGS.get(h); return x.decode().catch(() => {}); };
function imagenesDe(J, oi) {
  const o = J.objetos[oi]; if (!o) return [];
  if (o.t === 1) return [o.img];
  const r = [];
  if (o.anims) for (const ds of Object.values(o.anims)) for (const d of Object.values(ds)) r.push(...d.cuadros);
  if (o.imgs) r.push(...o.imgs);
  return r;
}
function primeraImagen(J, oi) {
  const o = J.objetos[oi]; if (!o) return [];
  if (o.t === 1) return [o.img];
  if (o.imgs) return o.imgs;
  const ds = o.anims && (o.anims[0] || Object.values(o.anims)[0]); const d = ds && Object.values(ds)[0];
  return d ? d.cuadros.slice(0, 1) : [];
}

/* ---------------- la «zona de toque» del celular: como en FNaF 2 para móvil, mantener el dedo en el medio de la
   pantalla (donde no hay nada que tocar) prende la linterna (Ctrl en la compu). */
const zona = {
  activa: false, botones: new Set(), dedo: null,
  frame(f) {
    this.activa = (f.eventos || []).some((ev) => ev.c.some((c) => c[0] === -6 && (c[1] === -1 || c[1] === -2) && c[6]?.[1]?.[0] === 17));
    this.botones = new Set();
    for (const ev of f.eventos || []) for (const c of ev.c) if (c[0] === -6 && (c[1] === -4 || c[1] === -7)) for (const p of c.slice(6)) if (p[1]?.oi != null) this.botones.add(p[1].oi);
  },
  libre(x, y) {
    if (!this.activa || x < 0 || y < 0 || x > 1024 || y > 768) return false;
    const v = M.F.inst.find((i) => i.o.n === 'viewing');
    const camaras = v && v.valor > 0;
    const enZona = camaras ? x > 40 && x < 560 && y > 90 && y < 690 : x > 250 && x < 774 && y > 70 && y < 650;
    if (!enZona) return false;
    for (const i of M.F.inst) {
      if (!this.botones.has(i.oi) || i.destruido) continue;
      const c = M.caja(i); if (c[2] * c[3] > 1024 * 768 * 0.3) continue;
      if (M.mouseEn(i)) return false;
    }
    return true;
  },
};

/* ---------------- arranque */
const sonido = new Sonido((h) => url('datos/snd/' + h + '.ogg'));
const lienzo = $('#juego'), g = lienzo.getContext('2d', { alpha: false });
const copia = document.createElement('canvas'); copia.width = lienzo.width; copia.height = lienzo.height;
let M = null, J = null, ctl = null, pausado = false;
const caja = { x: 0, y: 0, w: 1, h: 1 };

function acomodar() {
  revisarGiro();
  const W = P.W, H = P.H, k = Math.min(W / 1024, H / 768);
  caja.w = Math.round(1024 * k); caja.h = Math.round(768 * k); caja.x = Math.round((W - caja.w) / 2); caja.y = Math.round((H - caja.h) / 2);
  Object.assign(lienzo.style, { left: caja.x + 'px', top: caja.y + 'px', width: caja.w + 'px', height: caja.h + 'px' });
  // la monedita de JXStudios (abre los ajustes): en la franja negra del costado, o arriba al centro si no hay franja
  const lado = (W - caja.w) / 2, rueda = $('#engranaje');
  if (lado >= 46) Object.assign(rueda.style, { left: caja.x + caja.w + (lado - 34) / 2 + 'px', top: '10px', right: 'auto' });
  else Object.assign(rueda.style, { left: W / 2 - 17 + 'px', top: '6px', right: 'auto' });
  ctl?.ubicar();
}
addEventListener('resize', acomodar);

function pantalla(id) { for (const p of document.querySelectorAll('.pantalla')) p.hidden = p.id !== id; }

/* Intro de JXStudios (unos 4 segundos; un toque la saltea) mientras se cargan los datos. */
function intro() {
  return new Promise((ok) => {
    const el = $('#intro'); el.hidden = false;
    el.querySelector('.presenta').textContent = t('presenta');
    el.querySelector('.creditos').textContent = t('aviso');
    let listo = false;
    const salir = () => { if (listo) return; listo = true; el.classList.add('fuera'); setTimeout(() => { el.hidden = true; ok(); }, 550); };
    const tm = setTimeout(salir, 4300);
    el.addEventListener('pointerdown', () => { clearTimeout(tm); salir(); }, { once: true });
  });
}

async function main() {
  ponerIdioma(idioma());
  acomodar();
  sonido.iniciar(); // (queda en pausa hasta el primer toque o tecla; ahí arranca todo el sonido)
  const cargar = (async () => {
    await prepararEmbebidos((x) => { $('#carga i').style.width = Math.round(x * 100) + '%'; });
    J = await traer('datos/juego.json');
    sonido.ponerUsuario((aj.volumen ?? 100) / 100);
  })();
  pantalla(null);
  await intro();
  pantalla('carga'); $('#carga span').textContent = t('cargando');
  await cargar;
  M = new Motor(J, {
    imagen, sonido, ini,
    alSalir: () => {},
    alFrame: async (idx, f) => {
      $('#carga').hidden = false;
      const usados = new Set(f.inst.map((d) => d.oi));
      for (const ev of f.eventos || []) for (const a of ev.a) if (a[0] === -5) for (const p of a.slice(6)) if (p[1]?.oi != null) usados.add(p[1].oi);
      const iniciales = [];
      for (const d of f.inst) iniciales.push(...primeraImagen(J, d.oi));
      const snd = new Set();
      for (const ev of f.eventos || []) for (const a of ev.a) if (a[0] === -2) for (const p of a.slice(6)) if (p[0] === 6) snd.add(p[1].h);
      await Promise.race([Promise.all([...iniciales.map(decodificar), ...[...snd].map((h) => sonido.cargar(h))]), new Promise((r) => setTimeout(r, 8000))]);
      // el resto, de a poco
      const resto = [...usados].flatMap((oi) => imagenesDe(J, oi));
      (async () => { for (let k = 0; k < resto.length; k += 6) { await Promise.all(resto.slice(k, k + 6).map(decodificar)); await new Promise((r) => setTimeout(r, 30)); } })();
      ctl?.paraFrame(f);
      zona.frame(f);
      $('#carga').hidden = true;
    },
  });
  ctl = crearControles(M, aj, guardar, () => caja);
  window.__fnaf2 = { M, J, listo: true };
  await M.ir(0);
  bucle();
}

/* ---------------- bucle */
let antes = 0, acum = 0;
function bucle(ts = performance.now()) {
  requestAnimationFrame(bucle);
  if (!M) return;
  const dt = Math.min(250, ts - (antes || ts)); antes = ts;
  if (!pausado && !window.__fnaf2?.congelar) {
    acum += dt;
    let n = 0;
    const x = window.__fnaf2?.acelerar || 1;   // (pruebas: loops extra por cuadro)
    while (acum >= 1000 / 60 && n < 6 * x) { for (let k = 0; k < x; k++) M.paso(); acum -= 1000 / 60; n += x; }
    if (n >= 6 * x) acum = 0;
  }
  if (M.cargando) { g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 768); return; }
  M.dibujar(g, copia);
}

/* ---------------- entrada */
addEventListener('keydown', (e) => {
  if (!M || e.repeat) return;
  const vk = vkDe(e); if (vk == null) return;
  if (vk === 27 && document.querySelector('#ajustes:not([hidden])')) return;
  M.tecla(vk, true); if (vk === 17 || vk === 32 || (vk >= 37 && vk <= 40)) e.preventDefault();
});
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => sonido.iniciar(), true);
addEventListener('keyup', (e) => { const vk = vkDe(e); if (M && vk != null) M.tecla(vk, false); });
let ultimoToque = 0;
const logico = (e) => { const p = P.ev(e); return [((p.x - caja.x) / caja.w) * 1024, ((p.y - caja.y) / caja.h) * 768]; };
lienzo.addEventListener('pointerdown', (e) => {
  if (!M) return; sonido.iniciar();
  const [x, y] = logico(e); M.puntero(x, y); M.boton(e.button === 2 ? 2 : 0, true);
  if (e.pointerType !== 'mouse') { ultimoToque = performance.now(); if (zona.dedo == null && zona.libre(x, y)) { zona.dedo = e.pointerId; M.tecla(17, true); } }
  try { lienzo.setPointerCapture(e.pointerId); } catch { /* */ }
  e.preventDefault();
});
lienzo.addEventListener('pointermove', (e) => { if (!M) return; if (e.pointerType !== 'mouse' && !(e.buttons & 1)) return; const [x, y] = logico(e); M.puntero(x, y); });
const soltar = (e) => {
  if (!M) return; M.boton(e.button === 2 ? 2 : 0, false);
  if (zona.dedo === e.pointerId) { zona.dedo = null; M.tecla(17, false); }
  if (e.pointerType !== 'mouse') {
    // al soltar, el puntero pasa un momento por la zona que rearma las barras (como el mouse al alejarse) y se va
    const t0 = performance.now(); ultimoToque = t0;
    const r = M.F?.inst.find((i) => i.o.n === 'button reset' && !i.destruido);
    setTimeout(() => {
      if (ultimoToque !== t0) return;
      if (r) { const c = M.caja(r); M.puntero(c[0] + c[2] / 2, c[1] + c[3] / 2); }
      setTimeout(() => { if (ultimoToque === t0) M.puntero(-9999, -9999); }, r ? 70 : 0);
    }, 60);
  }
};
lienzo.addEventListener('pointerup', soltar); lienzo.addEventListener('pointercancel', soltar);
lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { pausado = document.hidden; sonido.pausar(document.hidden); });

main().catch((e) => { console.error(e); $('#carga span').textContent = 'Error: ' + e.message; });
