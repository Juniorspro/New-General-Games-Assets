/* ============================================================================
   ruta40/js/ui.js — las pantallas, hechas con carteles de ruta (ver ruta40.css).
   Cada pantalla es una función que arma su DOM adentro de #ui y recibe lo que
   tiene que hacer cada botón. El que decide adónde se va es main.js.
   ========================================================================== */
import { t, num, idioma, IDIOMAS } from './textos.js';
import { url, IMG, ok } from './arte.js';
import { P, guardar, PARA_ABRIR } from './partida.js';
import { VEHICULOS, ORDEN_VEHICULOS, MEJORAS, NIVEL_MAX, precioMejora } from './vehiculos.js';
import { TRAMOS } from './ruta.js';
import { Sonido } from './sonido.js';
import { picada } from './juego.js';

const UI = () => document.getElementById('ui');
export function h(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
/* un botón-cartel que hace ruido de chapa */
export function boton(clase, contenido, alTocar, extra = {}) {
  return h('button', { class: 'cartel ' + clase, ...extra, onclick: (e) => { e.stopPropagation(); Sonido.efecto('clic'); alTocar && alTocar(e); } }, contenido);
}
const moneda = () => h('img', { src: url('moneda100'), alt: '' });
export function plata() { return h('div', { class: 'plata' }, moneda(), h('span', { class: 'plataN', text: num(P.monedas) })); }
export function refrescarPlata() { for (const e of document.querySelectorAll('.plataN')) e.textContent = num(P.monedas); }

/* el escudo de Ruta Nacional, en SVG */
export function escudo(numero = '40') {
  const s = `<svg class="escudo" viewBox="0 0 120 140"><path d="M8 10 Q60 -2 112 10 L112 70 Q112 112 60 136 Q8 112 8 70 Z" fill="#fff" stroke="#161616" stroke-width="7"/>
  <path d="M20 22 Q60 14 100 22 L100 40 L20 40 Z" fill="#161616"/><text x="60" y="36" font-family="Overpass,sans-serif" font-weight="900" font-size="12" fill="#fff" text-anchor="middle" letter-spacing="1">RUTA NAC.</text>
  <text x="60" y="100" font-family="Overpass,sans-serif" font-weight="900" font-size="54" fill="#161616" text-anchor="middle">${numero}</text></svg>`;
  return h('div', { html: s });
}
const icono = {
  flecha: '<svg class="icono" viewBox="0 0 24 24"><path d="M12 3 L20 12 L15 12 L15 21 L9 21 L9 12 L4 12 Z" fill="#fff"/></svg>',
  bandera: '<svg class="icono" viewBox="0 0 24 24"><path d="M5 2v20" stroke="#fff" stroke-width="2.5"/><path d="M6 3h13l-3 4 3 4H6z" fill="#fff"/></svg>',
  llave: '<svg class="icono" viewBox="0 0 24 24"><path d="M21 7a5 5 0 0 1-7 4.6L6 19.5a2 2 0 0 1-2.9-2.9L11 8.8A5 5 0 0 1 17.3 2l-3 3 1.6 3.2L19 9.6z" fill="#fff"/></svg>',
  rueda: '<svg class="icono" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="3"/><circle cx="12" cy="12" r="3.5" fill="#fff"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6" stroke="#fff" stroke-width="2"/></svg>',
  engranaje: '<svg class="icono" viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 5.5v-3l-2.4-.6-.7-1.7 1.3-2.1-2.1-2.1-2.1 1.3-1.7-.7L13.5 2h-3l-.6 2.4-1.7.7-2.1-1.3-2.1 2.1 1.3 2.1-.7 1.7L2 10.5v3l2.4.6.7 1.7-1.3 2.1 2.1 2.1 2.1-1.3 1.7.7.8 2.6h3l.6-2.4 1.7-.7 2.1 1.3 2.1-2.1-1.3-2.1.7-1.7z" fill="#fff"/></svg>',
  libro: '<svg class="icono" viewBox="0 0 24 24"><path d="M4 4h7v16H4zM13 4h7v16h-7z" fill="none" stroke="#fff" stroke-width="2.4"/></svg>',
  atras: '<svg class="icono" viewBox="0 0 24 24"><path d="M3 12 L11 4 L11 9 L21 9 L21 15 L11 15 L11 20 Z" fill="#fff"/></svg>',
};
const ico = (n) => h('span', { html: icono[n], style: { display: 'contents' } });

let actual = null;
export function mostrar(el) {
  const ui = UI();
  ui.innerHTML = '';
  if (el) { el.classList.add('entra'); ui.append(el); }
  actual = el;
  return el;
}
export const limpiar = () => mostrar(null);

/* ------------------------------------------------------------------ la polvareda (transición) */
export const Polvo = {
  c: null, puf: [], estado: 'nada', t: 0,
  iniciar() { this.c = document.getElementById('polvareda'); this.x = this.c.getContext('2d'); },
  /* cubre la pantalla con una nube de tierra de izquierda a derecha; resuelve cuando está tapada */
  cubrir() {
    return new Promise((res) => {
      const W = this.c.width = this.c.clientWidth, H = this.c.height = this.c.clientHeight;
      this.puf = []; for (let i = 0; i < 70; i++) this.puf.push({ x: -W * 0.6 - Math.random() * W * 0.5, y: Math.random() * H, r: H * (0.18 + Math.random() * 0.25), v: W * (1.6 + Math.random() * 0.8), tono: Math.random() });
      this.estado = 'cubre'; this.t = 0; this.alCubrir = res;
      Sonido.efecto('papel');
      if (!this.corriendo) { this.corriendo = true; let ant = performance.now(); const f = (ahora) => { const dt = Math.min(0.12, (ahora - ant) / 1000); ant = ahora; if (this.cuadro(dt)) requestAnimationFrame(f); else this.corriendo = false; }; requestAnimationFrame(f); }
    });
  },
  destapar() { this.estado = 'destapa'; },
  cuadro(dt) {
    const x = this.x, W = this.c.width, H = this.c.height;
    this.t += dt;
    x.clearRect(0, 0, W, H);
    for (const p of this.puf) {
      if (this.estado === 'cubre') { p.x = Math.min(p.x + p.v * dt, W * 0.5 + (p.tono - 0.5) * W * 1.1); }
      else if (this.estado === 'destapa') p.x += p.v * dt * 1.1;
      const g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      const c = p.tono < 0.5 ? '190,150,100' : '160,118,76';
      g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(0.65, `rgba(${c},0.95)`); g.addColorStop(1, `rgba(${c},0)`);
      x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.3); x.fill();
    }
    /* cuando las nubes llegan, se rellena el fondo para que no quede ningún agujero; al destapar se va */
    this.relleno = this.estado === 'cubre' ? Math.max(0, Math.min(1, (this.t - 0.25) / 0.2)) : Math.max(0, (this.relleno || 0) - dt * 3.5);
    if (this.relleno > 0) { x.globalCompositeOperation = 'destination-over'; x.fillStyle = `rgba(175,134,88,${this.relleno})`; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; }
    if (this.estado === 'cubre' && this.relleno >= 1 && this.alCubrir) { const r = this.alCubrir; this.alCubrir = null; r(); }
    if (this.estado === 'destapa' && this.puf.every((p) => p.x - p.r > W)) { this.estado = 'nada'; x.clearRect(0, 0, W, H); return false; }
    return this.estado !== 'nada';
  },
  /* con ?prueba en la dirección no hay polvareda (en un navegador sin placa de video tarda y tapa las capturas) */
  async pasar(accion) { if (location.search.includes('prueba')) { await accion(); return; } await this.cubrir(); await accion(); await new Promise((r) => setTimeout(r, 80)); this.destapar(); },
};

/* ------------------------------------------------------------------ carga */
export function pantallaCarga() {
  const barra = h('i', { class: 'barra' }), autito = h('img', { class: 'autito', src: url('auto-chata'), alt: '' });
  const el = h('div', { class: 'pantalla', id: 'carga' }, escudo(), h('div', { class: 'ruta' }, barra, autito), h('p', { text: 'Ruta 40 · Route 40 · Rota 40' }));
  mostrar(el);
  return { progreso(f) { barra.style.width = f * 100 + '%'; autito.style.left = f * 100 + '%'; } };
}

/* ------------------------------------------------------------------ idioma */
export function pantallaIdioma(alElegir) {
  const hola = { es: '¡Hola! Elegí el idioma', en: 'Hi! Choose your language', pt: 'Oi! Escolha o idioma' };
  const lados = { es: '', en: 'izq', pt: '' };
  const el = h('div', { class: 'pantalla', id: 'idioma' },
    h('img', { class: 'fondoImg kenburns', src: url('portada'), alt: '' }), h('div', { class: 'velo' }),
    h('div', { class: 'centro' },
      h('div', { class: 'poste' }),
      h('div', { class: 'cae' }, escudo()),
      h('h1', { class: 'cae', text: 'RUTA 40' }),
      h('div', { class: 'carteles' }, ...['es', 'en', 'pt'].map((i) => boton('salida ' + lados[i] + ' cae' + ((P.idioma || 'es') === i ? ' elegido' : ''), [h('span', {}, IDIOMAS[i].idiomaNombre, h('small', { class: 'hola', text: hola[i] }))], () => alElegir(i))))));
  return mostrar(el);
}

/* ------------------------------------------------------------------ menú */
export function pantallaMenu(o) {
  const el = h('div', { class: 'pantalla', id: 'menu' },
    h('div', { class: 'velo', style: { background: 'linear-gradient(90deg, rgba(20,10,4,.55), rgba(20,10,4,.05) 45%, rgba(20,10,4,.35))' } }),
    h('div', { class: 'marca' }, h('div', { class: 'cae' }, escudo()), h('h1', { class: 'cae', text: t('titulo') }), h('p', { class: 'cae', text: t('sub') })),
    h('div', { class: 'botones' },
      boton('grande cae', [ico('flecha'), t('viajar')], o.viajar),
      boton('cae', [ico('bandera'), t('picadas')], o.picadas),
      boton('azul cae', [ico('llave'), t('gomeria')], o.gomeria),
      boton('azul cae', [ico('engranaje'), t('ajustes')], o.ajustes),
      boton('marron chico cae', [ico('libro'), t('historia')], o.historia)),
    plata(),
    h('div', { class: 'chiquito', text: matchMedia('(pointer: coarse)').matches ? '' : t('teclas') }));
  return mostrar(el);
}

/* ------------------------------------------------------------------ el mapa de la Ruta 40 */
export function pantallaMapa(o) {
  const cam = h('div', { class: 'camino' });
  const pts = TRAMOS.map((T, i) => ({ x: 7 + i * (86 / (TRAMOS.length - 1)), y: i % 2 ? 66 : 34 }));
  /* la ruta: una curva por las paradas (Catmull-Rom a Bézier) */
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  cam.append(h('div', { html: `<svg class="linea" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#6b5b48" stroke-width="7" vector-effect="non-scaling-stroke" stroke-linecap="round" style="stroke-width:calc(22 * var(--u))"/><path d="${d}" fill="none" stroke="#3b3b3b" stroke-linecap="round" vector-effect="non-scaling-stroke" style="stroke-width:calc(16 * var(--u))"/><path d="${d}" fill="none" stroke="#f5c400" stroke-dasharray="6 8" vector-effect="non-scaling-stroke" style="stroke-width:calc(2.5 * var(--u))"/></svg>`, style: { position: 'absolute', inset: 0 } }));
  let postal = null;
  const paradas = TRAMOS.map((T, i) => {
    const abierto = !!P.abiertos[T.id], rec = P.record[T.id];
    const foto = h('div', { class: 'foto', style: { backgroundImage: `url(${url('lejos-' + T.id)})` } }, !abierto && h('div', { class: 'candado', text: '🔒' }), P.llego[T.id] && h('div', { class: 'bandera', text: '✓' }));
    const el = h('button', { class: 'parada', style: { left: pts[i].x + '%', top: pts[i].y + '%' }, onclick: () => { Sonido.efecto('clic'); elegir(T.id); } },
      foto, h('span', { class: 'cartel marron chico sinBulones nombre', text: t('t_' + T.id) }), h('span', { class: 'rec', text: rec ? `${t('record')}: ${num(rec)} m` : '' }));
    el.dataset.id = T.id;
    cam.append(el);
    return el;
  });
  const el = h('div', { class: 'pantalla', id: 'mapa' },
    h('div', { class: 'arriba' }, boton('marron chico', [ico('atras'), t('volver')], o.volver), h('h2', { text: t('mapa') })),
    cam, plata());
  function elegir(id) {
    P.tramo = id; guardar();
    for (const p of paradas) p.classList.toggle('elegida', p.dataset.id === id);
    if (postal) postal.remove();
    const i = TRAMOS.findIndex((T) => T.id === id), abierto = !!P.abiertos[id], rec = P.record[id] || 0;
    const previo = i > 0 ? TRAMOS[i - 1].id : null;
    postal = h('div', { class: 'postal' },
      h('div', { class: 'img', style: { backgroundImage: `url(${url('lejos-' + id)})` } }),
      h('div', {}, h('h3', { text: t('t_' + id) }), h('p', { text: abierto ? t('p_' + id) : t('bloqueado', { n: num(PARA_ABRIR), lugar: t('t_' + previo) }) }),
        h('div', { class: 'datos', text: abierto ? `${t('record')}: ${rec ? num(rec) + ' m' : t('sinRecord')} · 5.000 m${P.llego[id] ? ' · ✓ ' + t('llegaste') : ''}` : '' })),
      h('div', { class: 'acciones' }, boton('grande', [ico('flecha'), t('viajarA')], () => o.viajar(id), { disabled: !abierto }), boton('', [ico('bandera'), t('picadaA')], () => o.picada(id), { disabled: !abierto })),
      h('div', { class: 'sello', html: `RUTA<br>40<br>${i + 1}/7` }));
    el.append(postal);
  }
  mostrar(el);
  elegir(P.abiertos[P.tramo] ? P.tramo : 'puna');
  return el;
}

/* ------------------------------------------------------------------ la gomería */
function estadisticas(id, niv) {
  const D = VEHICULOS[id], k = (m) => (niv[m] || 0) / NIVEL_MAX;
  return {
    e_vel: [D.motor.giro / 27, D.motor.giro * (1 + 0.35 * k('motor')) / 27],
    e_agarre: [D.agarre / 2.4, D.agarre * (1 + 0.45 * k('llantas')) / 2.4],
    e_trepa: [D.motor.torque / D.masa / 10, D.motor.torque * (1 + 0.9 * k('motor')) / D.masa / 10],
    e_nafta: [D.tanque / D.consumo / 95, D.tanque * (1 + 1.2 * k('tanque')) / D.consumo / 95],
  };
}
export function pantallaGomeria(o) {
  let i = Math.max(0, ORDEN_VEHICULOS.indexOf(P.vehiculo));
  const vitrina = h('canvas', { class: 'vitrina' });
  const panel = h('div', { class: 'panel' }), cabeza = h('div', { class: 'plataVeh' });
  const el = h('div', { class: 'pantalla', id: 'gomeria' },
    h('img', { class: 'fondoImg', src: url('gomeria'), alt: '' }), vitrina,
    h('div', { class: 'izq' }, boton('marron chico', [ico('atras'), t('volver')], o.volver)),
    cabeza,
    h('div', { class: 'flechas' },
      h('button', { class: 'chevron', html: '<svg viewBox="0 0 24 24"><path d="M16 3 L7 12 L16 21" fill="none" stroke="#161616" stroke-width="4"/></svg>', onclick: () => { Sonido.efecto('clic'); i = (i + ORDEN_VEHICULOS.length - 1) % ORDEN_VEHICULOS.length; armar(); } }),
      h('button', { class: 'chevron', html: '<svg viewBox="0 0 24 24"><path d="M8 3 L17 12 L8 21" fill="none" stroke="#161616" stroke-width="4"/></svg>', onclick: () => { Sonido.efecto('clic'); i = (i + 1) % ORDEN_VEHICULOS.length; armar(); } })),
    panel, plata());
  function armar() {
    const id = ORDEN_VEHICULOS[i], D = VEHICULOS[id], tengo = !!P.tengo[id], niv = P.mejoras[id];
    cabeza.innerHTML = '';
    cabeza.append(h('div', { class: 'patente' }, h('div', { class: 'banda' }, h('span', { text: 'REPÚBLICA ARGENTINA' }), h('i')), h('div', { class: 'num', text: D.placa }), h('div', { class: 'nombre', text: t('v_' + id) })),
      h('div', { class: 'desc', text: t('d_' + id) }));
    panel.innerHTML = '';
    const st = estadisticas(id, niv), stats = h('div', { class: 'stats' });
    for (const [k, [a, b]] of Object.entries(st)) stats.append(h('span', { text: t(k) }), h('div', { class: 'b', style: { position: 'relative' } }, h('i', { class: 'mas', style: { width: Math.min(100, b * 100) + '%', position: 'absolute' } }), h('i', { style: { width: Math.min(100, a * 100) + '%', position: 'relative' } })));
    panel.append(stats);
    if (tengo) {
      for (const m of MEJORAS) {
        const n = niv[m] || 0, precio = precioMejora(id, n), alcanza = P.monedas >= precio;
        const pips = h('div', { class: 'pips' }, ...Array.from({ length: NIVEL_MAX }, (_, k) => h('i', { class: k < n ? 'si' : '' })));
        panel.append(h('div', { class: 'mejora' }, h('span', { class: 'n', text: t('mj_' + m) }), pips,
          boton('chico' + (alcanza ? '' : ' gris'), n >= NIVEL_MAX ? t('maximo') : `▲ ${t('moneda')}${num(precio)}`, () => {
            if (n >= NIVEL_MAX) return;
            if (!alcanza) { Sonido.efecto('no'); aviso(t('faltan', { n: t('moneda') + num(precio - P.monedas) })); return; }
            P.monedas -= precio; niv[m] = n + 1; guardar(); Sonido.efecto('caja'); refrescarPlata(); armar();
          }, { disabled: n >= NIVEL_MAX })));
      }
      panel.append(boton('comprar ' + (P.vehiculo === id ? 'gris' : ''), P.vehiculo === id ? t('elegido') : t('usar'), () => { P.vehiculo = id; guardar(); armar(); }, { disabled: P.vehiculo === id }));
    } else {
      const alcanza = P.monedas >= D.precio;
      panel.append(h('div', { style: { flex: 1 } }), boton('comprar grande ' + (alcanza ? '' : 'gris'), `${t('comprar')} ${t('moneda')}${num(D.precio)}`, () => {
        if (!alcanza) { Sonido.efecto('no'); aviso(t('faltan', { n: t('moneda') + num(D.precio - P.monedas) })); return; }
        P.monedas -= D.precio; P.tengo[id] = true; P.vehiculo = id; guardar(); Sonido.efecto('caja'); refrescarPlata(); armar();
      }));
    }
    vitrinaVeh = id; vitrinaT = 0;
  }
  function aviso(txt) {
    const a = h('div', { class: 'tutoCartel', style: { left: '32%', top: '40%', transform: 'translateX(-50%)' } }, h('div', { class: 'rombo', text: '$' }), h('p', { text: txt }));
    el.append(a); setTimeout(() => a.remove(), 1600);
  }
  let vitrinaVeh = null, vitrinaT = 0, vivo = true, antes = performance.now();
  const dibujar = (ahora = performance.now()) => {
    if (!vivo || !el.isConnected) return;
    const dt = Math.min(0.1, (ahora - antes) / 1000); antes = ahora;
    const W = vitrina.clientWidth, H = vitrina.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (vitrina.width !== Math.round(W * dpr)) { vitrina.width = Math.round(W * dpr); vitrina.height = Math.round(H * dpr); }
    vitrinaT += dt;
    const x = vitrina.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, vitrina.width, vitrina.height);
    const D = VEHICULOS[vitrinaVeh];
    const e = Math.min(vitrina.width / (D.largo * 1.35), vitrina.height * 0.26);
    const entra = Math.min(1, vitrinaT * 2.2), rebote = Math.sin(vitrinaT * 3) * 0.015 * e + (1 - entra) * -e * 2;
    dibujarVehiculo(x, D, vitrina.width * 0.52 + (1 - entra) * vitrina.width * 0.4, vitrina.height * 0.78, e, rebote, vitrinaT);
    requestAnimationFrame(dibujar);
  };
  mostrar(el);
  armar();
  requestAnimationFrame(dibujar);
  el.cerrar = () => { vivo = false; };
  return el;
}
/* un vehículo quieto (para la gomería y la historia): sombra, conductor, chasis y ruedas.
   Parado en el plano, cada rueda toca el piso: de ahí sale dónde queda el centro de masa. */
export function dibujarVehiculo(x, D, px, piso, e, rebote, tt) {
  const sp = D.sprite, r0 = D.ruedas[0];
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.beginPath(); x.ellipse(px, piso, D.largo * 0.5 * e, 0.18 * e, 0, 0, 6.3); x.fill();
  const comY = piso - r0.r * e + r0.yDib * e + rebote;
  const k = e / sp.ppm;
  if (ok('conductor')) { const an = (D.chofer || 0.7) * e, al = an * 256 / 243; x.drawImage(IMG.conductor, px + D.cabeza.x * e - an * 0.33, comY - D.cabeza.y * e - al * 0.25 + Math.sin(tt * 2) * 0.01 * e, an, al); }
  if (ok(sp.img)) x.drawImage(IMG[sp.img], px - sp.ox * k, comY - sp.oy * k, sp.w * k, sp.h * k);
  const ll = 'llanta-' + D.llanta;
  for (const r of D.ruedas) { x.save(); x.translate(px + r.x * e, piso - r.r * e); x.rotate(Math.sin(tt * 0.8) * 0.05); if (ok(ll)) x.drawImage(IMG[ll], -r.r * e, -r.r * e, 2 * r.r * e, 2 * r.r * e); x.restore(); }
}

/* ------------------------------------------------------------------ picadas */
export function pantallaPicadas(tramo, o) {
  const ganadas = P.picadas[tramo] || 0;
  const cajas = [0, 1, 2].map((n) => {
    const pc = picada(tramo, n), bloq = n > ganadas, hecha = n < ganadas;
    return h('div', { class: 'carrera' + (bloq ? ' bloq' : '') },
      h('h3', { text: t('pc_nivel')[n] }),
      ...pc.rivales.map((r) => h('div', { class: 'riv' }, h('span', { text: r.nombre }), h('span', { text: t('v_' + r.vehiculo) }))),
      h('div', { class: 'premio', text: `${t('pc_premio')}: ${t('moneda')}${num(pc.premio)}` }),
      hecha ? h('div', { class: 'ok', text: '✓ ' + t('pc_ganada') }) : null,
      boton(bloq ? 'gris chico' : 'chico', bloq ? '🔒' : t('pc_correr'), () => !bloq && o.correr(n), { disabled: bloq }));
  });
  const el = h('div', { class: 'pantalla oscuro', id: 'picadas' },
    h('div', { class: 'tablero cae' }, h('h2', {}, h('span', { text: `${t('pc_titulo')} · ${t('t_' + tramo)}` })), h('p', { style: { margin: '0 0 10px', fontWeight: 700 }, text: t('pc_sub') }), h('div', { class: 'carreras' }, ...cajas),
      h('div', { class: 'barraBotones' }, boton('marron chico', [ico('atras'), t('volver')], o.volver))));
  return mostrar(el);
}

/* ------------------------------------------------------------------ ajustes */
export function pantallaAjustes(o) {
  const O = P.opciones;
  const deslizador = (clave, alCambiar) => h('div', { class: 'carril' }, h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: O[clave], oninput: (e) => { O[clave] = +e.target.value; alCambiar(O[clave]); }, onchange: () => { guardar(); Sonido.efecto('clic'); } }));
  const opciones = (lista, valor, alElegir) => {
    const cont = h('div', { class: 'opciones' });
    const pintar = (v) => { cont.innerHTML = ''; for (const [k, txt] of lista) cont.append(h('button', { class: 'opcion' + (k === v ? ' si' : ''), text: txt, onclick: () => { Sonido.efecto('clic'); alElegir(k); pintar(k); guardar(); } })); };
    pintar(valor); return cont;
  };
  const el = h('div', { class: 'pantalla oscuro', id: 'ajustes' },
    h('div', { class: 'tablero cae' },
      h('h2', {}, h('span', { text: t('a_titulo') })),
      h('div', { class: 'fila' }, h('span', { text: t('a_musica') }), deslizador('musica', (v) => Sonido.ponerVol('musica', v))),
      h('div', { class: 'fila' }, h('span', { text: t('a_motor') }), deslizador('motor', (v) => Sonido.ponerVol('motor', v))),
      h('div', { class: 'fila' }, h('span', { text: t('a_efectos') }), deslizador('efectos', (v) => Sonido.ponerVol('efectos', v))),
      h('div', { class: 'fila' }, h('span', { text: t('a_radio') }), opciones([[true, t('si')], [false, t('no')]], O.radio, (v) => { O.radio = v; Sonido.radio = v; })),
      h('div', { class: 'fila' }, h('span', { text: t('a_estilo') }), opciones([['folk', t('a_estiloFolk')], ['16bits', t('a_estilo16')]], O.estilo, (v) => { O.estilo = v; o.estilo(v); })),
      h('div', { class: 'fila' }, h('span', { text: t('a_idioma') }), opciones([['es', 'Español'], ['en', 'English'], ['pt', 'Português']], idioma(), (v) => o.idioma(v))),
      h('div', { class: 'fila' }, h('span', { text: t('a_calidad') }), opciones([['alta', t('a_alta')], ['media', t('a_media')], ['baja', t('a_baja')]], O.calidad, (v) => { O.calidad = v; o.calidad(v); })),
      h('div', { class: 'fila' }, h('span', { text: t('a_giro') }), opciones([['auto', t('a_auto')], ['normal', t('a_normal')], ['reves', t('a_reves')]], O.giro, (v) => { O.giro = v; o.giro(v); })),
      h('div', { class: 'fila' }, h('span', { text: t('a_controles') }), h('div', {}, boton('azul chico', t('a_controles'), o.controles))),
      h('div', { class: 'fila' }, h('span', { text: t('a_borrar') }), h('div', {}, boton('rojo chico', t('a_borrar'), (e) => { const b = e.currentTarget; if (b.dataset.seguro) { o.borrar(); } else { b.dataset.seguro = '1'; b.textContent = t('a_borrarSeguro'); } }))),
      h('div', { class: 'barraBotones' }, boton('', t('listo'), o.volver))));
  return mostrar(el);
}

/* ------------------------------------------------------------------ el editor de controles */
export function pantallaControles(o) {
  const C = P.controles;
  const opciones = (lista, valor, alElegir) => {
    const cont = h('div', { class: 'opciones' });
    const pintar = (v) => { cont.innerHTML = ''; for (const [k, txt] of lista) cont.append(h('button', { class: 'opcion' + (k === v ? ' si' : ''), text: txt, onclick: () => { Sonido.efecto('clic'); alElegir(k); pintar(k); guardar(); } })); };
    pintar(valor); return cont;
  };
  const rango = (clave, min, max) => h('div', { class: 'carril' }, h('input', { type: 'range', min, max, step: 0.05, value: C[clave], oninput: (e) => { C[clave] = +e.target.value; o.aplicar(); }, onchange: () => guardar() }));
  const el = h('div', { class: 'pantalla', id: 'controles' },
    h('div', { class: 'tablero cae' },
      h('h2', {}, h('span', { text: t('c_titulo') })),
      h('p', { class: 'ayuda', text: t('c_ayuda') }),
      h('div', { class: 'fila' }, h('span', { text: t('c_modo') }), opciones([['pedales', t('c_pedales')], ['mitades', t('c_mitades')]], C.modo, (v) => { C.modo = v; o.aplicar(); })),
      h('div', { class: 'fila' }, h('span', { text: t('c_tam') }), rango('tam', 0.6, 1.6)),
      h('div', { class: 'fila' }, h('span', { text: t('c_alfa') }), rango('alfa', 0.25, 1)),
      h('div', { class: 'fila' }, h('span', { text: t('a_vibrar') }), opciones([[true, t('si')], [false, t('no')]], C.vibrar, (v) => { C.vibrar = v; if (v && navigator.vibrate) navigator.vibrate(30); })),
      h('div', { class: 'barraBotones' }, boton('azul chico', t('c_lado'), () => { o.lado(); guardar(); }), boton('marron chico', t('c_reset'), () => { o.reset(); guardar(); }), boton('chico', t('listo'), o.volver))));
  return mostrar(el);
}

/* ------------------------------------------------------------------ pausa */
export function pantallaPausa(o) {
  const el = h('div', { class: 'pantalla oscuro', id: 'pausa' },
    h('div', { class: 'pare' }, h('span', { text: t('pausa') })),
    h('div', { class: 'barraBotones' }, boton('grande', t('seguir'), o.seguir), boton('azul', t('reiniciar'), o.reiniciar), boton('marron', t('salir'), o.salir)));
  return mostrar(el);
}

/* ------------------------------------------------------------------ el resultado */
export function pantallaResultado(r, o) {
  const icon = { cabeza: '💫', nafta: '⛽', volco: '↻', llego: '🏁', meta: '🏁' }[r.causa] || '!';
  const titulo = r.picada ? (r.puesto === 1 ? t('pc_ganaste') : t('pc_puesto', { n: r.puesto || 4 })) : { cabeza: t('cabeza'), nafta: t('sinNafta'), volco: t('volco'), llego: t('llegada') }[r.causa];
  const linea = (k, v, clase = '') => { const b = h('b', { text: '0' }); b.dataset.v = v; return h('div', { class: 'l ' + clase }, h('span', { text: k }), b); };
  const cuentas = h('div', { class: 'cuentas' },
    linea(t('distancia'), r.metros, 'metros'),
    r.picada ? linea(t('pc_premio'), r.premio) : linea(t('monedas'), r.deMonedas),
    r.picada ? null : linea(t('mojones'), r.deMojones),
    r.picada ? null : linea(t('trucos'), r.deTrucos),
    linea(t('total'), r.total, 'total'),
    r.nuevo ? h('div', { class: 'sello', text: t('nuevoRecord') }) : null);
  const el = h('div', { class: 'pantalla oscuro', id: 'resultado' },
    h('div', { class: 'causa cae' }, h('div', { class: 'rombo' }, h('span', { text: icon })), h('h2', { text: titulo }),
      r.abrio ? h('div', { class: 'cartel marron chico abrio', text: t('abriste', { lugar: t('t_' + r.abrio) }) }) : null),
    h('div', { class: 'cae' }, cuentas, h('div', { class: 'botonesRes' },
      boton('grande', t('otraVez'), o.otra),
      h('div', { style: { display: 'flex', gap: '10px' } }, boton('azul', [ico('llave'), t('gomeria')], o.gomeria), boton('marron', t('alMapa'), o.mapa)))));
  mostrar(el);
  /* los números que suben, con ruidito de monedas */
  const bs = [...cuentas.querySelectorAll('b')];
  let k = 0;
  const subir = () => {
    if (k >= bs.length || !el.isConnected) return;
    const b = bs[k], fin = +b.dataset.v, m = b.parentElement.classList.contains('metros');
    let tt = 0; const dur = 0.55;
    const paso = () => {
      if (!el.isConnected) return;
      tt += 1 / 60; const f = Math.min(1, tt / dur), v = fin * (1 - Math.pow(1 - f, 3));
      b.textContent = m ? `${num(v)} m` : `${t('moneda')}${num(v)}`;
      if (Math.random() < 0.3 && !m && fin > 0) Sonido.efecto('moneda', { v: 5 });
      if (f < 1) requestAnimationFrame(paso); else { k++; setTimeout(subir, 120); }
    };
    paso();
  };
  setTimeout(subir, 450);
  return el;
}

/* ------------------------------------------------------------------ la historia (el principio y el final) */
export function pantallaHistoria(cual, alTerminar) {
  const cuadros = cual === 'intro'
    ? [['portada', 'h1', false], ['gomeria', 'h2', true], ['lejos-puna', 'h3', false]]
    : [['lejos-glaciar', 'fin1', false], ['lejos-glaciar', 'fin2', true], ['medio-glaciar', 'fin3', true], ['lejos-cuyo', 'creditos', false]];
  let i = 0;
  const cuadro = h('div', { class: 'cuadro' }), texto = h('p'), puntos = h('div', { class: 'puntos' });
  const el = h('div', { class: 'pantalla', id: 'historia', onclick: () => avanzar() }, cuadro, texto, puntos, boton('marron chico saltar', t('saltar'), () => alTerminar()));
  function pintar() {
    const [img, k, conChofer] = cuadros[i];
    cuadro.style.backgroundImage = `url(${url(img)})`;
    cuadro.innerHTML = ''; if (conChofer) cuadro.append(h('img', { src: url('conductor'), alt: '' }));
    texto.textContent = ''; const frase = t(k); let n = 0;
    clearInterval(el.escribe); el.escribe = setInterval(() => { n += 2; texto.textContent = frase.slice(0, n); if (n >= frase.length) clearInterval(el.escribe); }, 28);
    puntos.innerHTML = ''; cuadros.forEach((_, j) => puntos.append(h('i', { class: j === i ? 'si' : '' })));
    Sonido.efecto('papel');
  }
  function avanzar() { i++; if (i >= cuadros.length) { clearInterval(el.escribe); alTerminar(); } else pintar(); }
  mostrar(el); pintar();
  return el;
}
