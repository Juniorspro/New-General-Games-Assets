/* ============================================================================
   barro/js/ui.js — las pantallas, con estilo de programa de carrera de cross:
   chapas de número como botones, letras gruesas en cursiva, rayas y
   barridos de tierra entre pantalla y pantalla. Idioma, menú, campeonato
   (4 sedes × 5 pistas), previa, Jam del día, contrarreloj, garage, ajustes,
   editor de controles, pausa y resultados.
   ========================================================================== */
import { PISTAS, numeroJam, pistaJam } from './pistas.js';
import { EQUIPOS, dibujarMoto } from './moto.js';
import { t, setIdioma, IDIOMAS, getIdioma } from './textos.js';
import { editar, restablecer, ubicar } from './controles.js';

const $ = (s, r = document) => r.querySelector(s);
const PRECIOS = [250, 500, 900, 1500, 2400];
const fmt = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`);
const plata = (n) => `$ ${n.toLocaleString('es-AR')}`;
const MEDALLA = ['', '🥇', '🥈', '🥉'];

export function crearUI(api) {
  const { D, K } = api;
  const raiz = $('#pantalla'), hud = $('#hud'), ctl = $('#controles');
  let actual = null;

  const mostrar = (nombre, html, clase = '') => {
    actual = nombre;
    raiz.className = `pantalla p-${nombre} ${clase}`;
    raiz.innerHTML = html;
    raiz.classList.remove('entra'); void raiz.offsetWidth; raiz.classList.add('entra');
    raiz.querySelectorAll('[data-clic]').forEach((b) => b.addEventListener('click', () => api.sfx('clic')));
  };
  const enJuego = (si) => { hud.classList.toggle('oculto', !si); ctl.classList.toggle('oculto', !si); raiz.classList.toggle('oculta', si); };
  const logo = (chico) => `<div class="logo ${chico ? 'chico' : ''}"><span class="l1">BARRO</span><span class="l2">${t('sub')}</span></div>`;
  const desbloqueada = (n) => n === 0 || (D.medallas[PISTAS[n - 1].id] || 0) > 0;
  const toque = () => { api.iniciarSonido(); api.musica('menu'); };

  const UI = {
    idioma() {
      enJuego(false);
      mostrar('idioma', `${logo()}<p class="elige">${t('elegir')}</p>
        <div class="chapas">${IDIOMAS.map(([id, n], i) => `<button class="chapa" data-clic data-i="${id}"><b>${i + 1}</b><span>${n}</span></button>`).join('')}</div>`);
      raiz.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { toque(); D.idioma = b.dataset.i; setIdioma(D.idioma); api.guardar(); relabel(); UI.menu(); });
    },

    menu() {
      enJuego(false);
      const n = numeroJam();
      mostrar('menu', `${logo()}
        <div class="plata">${plata(D.plata)}</div>
        <div class="chapas">
          <button class="chapa grande" data-clic data-ir="campeonato"><b>1</b><span>${t('carrera')}</span></button>
          <button class="chapa" data-clic data-ir="jam"><b>2</b><span>${t('jam')}<small>#${n}</small></span></button>
          <button class="chapa" data-clic data-ir="reloj"><b>3</b><span>${t('reloj')}</span></button>
          <button class="chapa" data-clic data-ir="garage"><b>4</b><span>${t('garage')}</span></button>
          <button class="chapa" data-clic data-ir="ajustes"><b>5</b><span>${t('ajustes')}</span></button>
        </div>
        <p class="creditos">${t('creditos')}</p>`);
      raiz.querySelectorAll('[data-ir]').forEach((b) => b.onclick = () => { toque(); UI[b.dataset.ir](); });
    },

    campeonato(sede) {
      enJuego(false);
      if (sede == null) { sede = 0; for (let s = 0; s < 4; s++) if (desbloqueada(s * 5)) sede = s; }
      const tabs = t('sedes').map((n, s) => `<button class="tab ${s === sede ? 'on' : ''} ${desbloqueada(s * 5) ? '' : 'bloq'}" data-clic data-s="${s}">${n}</button>`).join('');
      const pistas = PISTAS.slice(sede * 5, sede * 5 + 5).map((p) => {
        const ok = desbloqueada(p.n), m = D.medallas[p.id] || 0;
        return `<button class="pista ${ok ? '' : 'bloq'} ${m ? 'm' + m : ''}" data-clic data-n="${p.n}">
          <b>${p.nro === 5 ? t('final') : p.nro}</b><span>${t('pista')} ${p.nro}</span><i>${ok ? (m ? MEDALLA[m] : fmt(D.tiempos[p.id])) : '🔒'}</i></button>`;
      }).join('');
      mostrar('campeonato', `${logo(true)}<div class="tabs">${tabs}</div>
        <div class="sede s${sede}"><h2>${t('sedes')[sede]}</h2><p>${t('lugares')[sede]}</p></div>
        <div class="pistas">${pistas}</div><p class="nota" id="nota"></p>
        <button class="volver" data-clic>${t('volver')}</button>`);
      raiz.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => UI.campeonato(+b.dataset.s));
      raiz.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => {
        const n = +b.dataset.n;
        if (!desbloqueada(n)) { $('#nota').textContent = n % 5 === 0 ? t('sedeBloq') : t('bloqueada'); return; }
        UI.previa(PISTAS[n], 'campeonato');
      });
      $('.volver', raiz).onclick = () => UI.menu();
    },

    jam() { UI.previa(api.jam(), 'jam'); },

    reloj() {
      enJuego(false);
      const lista = PISTAS.filter((p) => desbloqueada(p.n)).map((p) => `<button class="pista" data-clic data-n="${p.n}"><b>${p.nro}</b><span>${t('sedes')[p.sede]} · ${t('pista')} ${p.nro}</span><i>${fmt(D.tiempos[p.id])}</i></button>`).join('');
      mostrar('reloj', `${logo(true)}<h2 class="titulo">${t('reloj')}</h2><p class="nota">${t('relojSub')}</p><div class="pistas lista">${lista}</div><button class="volver" data-clic>${t('volver')}</button>`);
      raiz.querySelectorAll('[data-n]').forEach((b) => b.onclick = () => UI.previa(PISTAS[+b.dataset.n], 'reloj'));
      $('.volver', raiz).onclick = () => UI.menu();
    },

    previa(def, tipo) {
      enJuego(false);
      const titulo = tipo === 'jam' ? t('jamTxt')(def.jam) : `${t('sedes')[def.sede]} · ${def.nro === 5 ? t('final') : t('pista') + ' ' + def.nro}`;
      const sub = tipo === 'jam' ? t('jamSub') : tipo === 'reloj' ? t('relojSub') : t('lugares')[def.sede];
      const mejor = tipo === 'jam' ? D.jam[def.jam] : D.tiempos[def.id];
      const premio = tipo === 'campeonato' ? plata(Math.round(400 * (1 + def.sede * 0.5))) : tipo === 'jam' ? plata(320) : '—';
      const consejo = t('ayuda')[Math.floor(Math.random() * t('ayuda').length)];
      mostrar('previa', `<div class="tarjeta">
          <div class="rayas"></div>
          <h2>${titulo}</h2><p class="sub">${sub}</p>
          <div class="datos"><div><small>${t('premio')}</small><b>${premio}</b></div><div><small>${t('record')}</small><b>${fmt(mejor)}</b></div></div>
          <p class="consejo">💡 ${consejo}</p>
          <button class="chapa grande ir" data-clic><b>GO</b><span>${t('aLaGrilla')}</span></button>
          <button class="volver" data-clic>${t('volver')}</button>
        </div>`);
      $('.ir', raiz).onclick = () => api.empezar(def, tipo);
      $('.volver', raiz).onclick = () => (tipo === 'campeonato' ? UI.campeonato(def.sede) : tipo === 'reloj' ? UI.reloj() : UI.menu());
    },

    carrera() {
      raiz.innerHTML = ''; actual = 'carrera';
      enJuego(true);
      ubicar(K);
      api.armarHUD();
      $('#b-pausa').onclick = () => UI.pausa();
    },

    pausa() {
      api.pausar(true);
      raiz.classList.remove('oculta');
      mostrar('pausa', `<div class="tarjeta chica"><h2>${t('pausa')}</h2>
        <button class="chapa" data-clic data-a="seguir"><b>▶</b><span>${t('seguir')}</span></button>
        <button class="chapa" data-clic data-a="reiniciar"><b>↺</b><span>${t('reiniciar')}</span></button>
        <button class="chapa" data-clic data-a="controles"><b>✋</b><span>${t('controles')}</span></button>
        <button class="chapa" data-clic data-a="salir"><b>✕</b><span>${t('salir')}</span></button></div>`, 'sobre');
      raiz.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'seguir') { raiz.innerHTML = ''; raiz.classList.add('oculta'); api.pausar(false); }
        if (a === 'reiniciar') { api.pausar(false); api.reiniciar(); }
        if (a === 'controles') UI.editor(() => UI.pausa());
        if (a === 'salir') { api.pausar(false); UI.salir(); }
      });
    },

    salir() { api.salirAlMenu(); UI.menu(); },

    resultado(res, def, tipo) {
      enJuego(false);
      const filas = res.lista.map((c) => `<li class="${c.jugador ? 'yo' : ''}"><b class="pos">${c.puesto}</b>
        <i class="num" style="background:${c.colores.moto};color:${c.colores.moto2}">${c.numero}</i><span>${c.nombre}</span><em>${fmt(c.tiempo)}</em></li>`).join('');
      const titulo = tipo === 'reloj' ? t('terminaste') : res.puesto === 1 ? t('ganaste') : res.puesto <= 3 ? t('podio') : t('terminaste');
      const sig = tipo === 'campeonato' && PISTAS[def.n + 1] && desbloqueada(def.n + 1);
      mostrar('resultado', `<div class="tarjeta">
        <div class="rayas"></div>
        <h2 class="${res.puesto <= 3 ? 'oro' : ''}">${titulo}</h2>
        ${tipo !== 'reloj' ? `<div class="puestazo">${t('puesto')(res.puesto)}${res.medalla ? ' ' + MEDALLA[res.medalla] : ''}</div>` : `<div class="puestazo">${fmt(res.tiempo)}</div>`}
        ${res.record ? `<p class="record">${t('nuevoRecord')}</p>` : ''}
        ${tipo !== 'reloj' ? `<ol class="tabla">${filas}</ol>` : ''}
        <div class="datos"><div><small>${t('tiempo')}</small><b>${fmt(res.tiempo)}</b></div><div><small>${t('plata')}</small><b>+${plata(res.plata)}</b></div></div>
        <p class="sub">${t('caidas')}: ${res.caidas} · ${t('mejorSalto')}: ${res.mejorAire.toFixed(1)} s · ${t('perfecto')} ×${res.perfectos}</p>
        ${sig ? `<button class="chapa grande" data-clic data-a="sig"><b>▶</b><span>${t('siguiente')}</span></button>` : ''}
        <button class="chapa" data-clic data-a="otra"><b>↺</b><span>${t('otraVez')}</span></button>
        <button class="volver" data-clic data-a="menu">${t('menu')}</button></div>`);
      if (res.plata) api.sfx('plata');
      raiz.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => {
        const a = b.dataset.a;
        if (a === 'sig') api.siguiente();
        if (a === 'otra') api.reiniciar();
        if (a === 'menu') UI.salir();
      });
    },

    garage(pest = 'mejoras') {
      enJuego(false);
      const tabs = ['mejoras', 'colores', 'numero'].map((p) => `<button class="tab ${p === pest ? 'on' : ''}" data-clic data-p="${p}">${t(p)}</button>`).join('');
      let cuerpo = '';
      if (pest === 'mejoras') {
        cuerpo = Object.keys(D.mejoras).map((k) => {
          const nv = D.mejoras[k], precio = PRECIOS[nv];
          const pips = Array.from({ length: 5 }, (_, i) => `<i class="${i < nv ? 'on' : ''}"></i>`).join('');
          return `<div class="mejora"><div><b>${t('mej')[k][0]}</b><small>${t('mej')[k][1]}</small><div class="pips">${pips}</div></div>
            <button class="comprar" data-clic data-m="${k}" ${nv >= 5 ? 'disabled' : ''}>${nv >= 5 ? t('maximo') : plata(precio)}</button></div>`;
        }).join('');
      } else if (pest === 'colores') {
        cuerpo = `<div class="colores">${EQUIPOS.map((e, i) => `<button class="color ${i === D.equipo ? 'on' : ''}" data-clic data-c="${i}" style="background:linear-gradient(135deg,${e.moto} 50%,${e.moto2} 50%)"></button>`).join('')}</div>`;
      } else {
        cuerpo = `<div class="numero"><button data-clic data-d="-1">−</button><input id="nro" type="number" min="1" max="99" value="${D.numero}"><button data-clic data-d="1">+</button></div>
          <label class="nombre">${t('nombre')}<input id="nombre" maxlength="10" placeholder="${t('tuNombre')}" value="${D.nombre || ''}"></label>`;
      }
      mostrar('garage', `${logo(true)}<div class="plata">${plata(D.plata)}</div><canvas id="vitrina" width="600" height="300"></canvas>
        <div class="tabs">${tabs}</div><div class="cuerpo">${cuerpo}</div><p class="nota" id="nota"></p>
        <button class="volver" data-clic>${t('volver')}</button>`);
      vitrina();
      raiz.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => UI.garage(b.dataset.p));
      raiz.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => {
        const k = b.dataset.m, nv = D.mejoras[k], precio = PRECIOS[nv];
        if (nv >= 5) return;
        if (D.plata < precio) { $('#nota').textContent = t('sinPlata'); return; }
        D.plata -= precio; D.mejoras[k]++; api.guardar(); api.sfx('plata'); UI.garage('mejoras');
      });
      raiz.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { D.equipo = +b.dataset.c; api.guardar(); UI.garage('colores'); });
      raiz.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { D.numero = Math.max(1, Math.min(99, D.numero + +b.dataset.d)); api.guardar(); $('#nro').value = D.numero; });
      const nro = $('#nro'); if (nro) nro.onchange = () => { D.numero = Math.max(1, Math.min(99, Math.round(+nro.value) || 1)); api.guardar(); };
      const nom = $('#nombre'); if (nom) nom.oninput = () => { D.nombre = nom.value.trim().toUpperCase().slice(0, 10); api.guardar(); };
      $('.volver', raiz).onclick = () => { cancelAnimationFrame(UI.anim); UI.menu(); };
    },

    ajustes() {
      enJuego(false);
      const A = D.ajustes;
      const cal = ['baja', 'media', 'alta'].map((c, i) => `<button class="opcion ${A.calidad === i ? 'on' : ''}" data-clic data-q="${i}">${t(c)}</button>`).join('');
      const idi = IDIOMAS.map(([id, n]) => `<button class="opcion ${getIdioma() === id ? 'on' : ''}" data-clic data-i="${id}">${n.slice(0, 3)}</button>`).join('');
      mostrar('ajustes', `${logo(true)}<h2 class="titulo">${t('ajustes')}</h2>
        <label class="fila">${t('musica')}<input type="range" min="0" max="1" step="0.05" value="${A.musica}" id="vm"></label>
        <label class="fila">${t('efectos')}<input type="range" min="0" max="1" step="0.05" value="${A.efectos}" id="ve"></label>
        <label class="fila">${t('vibrar')}<input type="checkbox" id="vv" ${A.vibrar ? 'checked' : ''}></label>
        <div class="fila">${t('calidad')}<div class="opciones">${cal}</div></div>
        <div class="fila">${t('idioma')}<div class="opciones">${idi}</div></div>
        <button class="chapa" data-clic id="ed"><b>✋</b><span>${t('controles')}</span></button>
        <button class="volver" data-clic>${t('volver')}</button>`);
      $('#vm').oninput = (e) => { A.musica = +e.target.value; api.volumen('musica', A.musica); api.guardar(); };
      $('#ve').oninput = (e) => { A.efectos = +e.target.value; api.volumen('efectos', A.efectos); api.guardar(); };
      $('#vv').onchange = (e) => { A.vibrar = e.target.checked; api.guardar(); };
      raiz.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => { api.calidad(+b.dataset.q); UI.ajustes(); });
      raiz.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { D.idioma = b.dataset.i; setIdioma(D.idioma); api.guardar(); UI.ajustes(); relabel(); });
      $('#ed').onclick = () => UI.editor(() => UI.ajustes());
      $('.volver', raiz).onclick = () => UI.menu();
    },

    editor(alTerminar) {
      ctl.classList.remove('oculto');
      editar(K, true);
      mostrar('editor', `<div class="panel-editor"><p>${t('editar')}</p>
        <label>${t('tamano')} <input type="range" id="et" min="0.6" max="1.8" step="0.05"></label>
        <label>${t('opacidad')} <input type="range" id="eo" min="0.2" max="1" step="0.05" value="${K.cfg.opacidad}"></label>
        <label class="fila"><input type="checkbox" id="ez" ${K.cfg.zurdo ? 'checked' : ''}> ${t('zurdo')}</label>
        <label class="fila"><input type="checkbox" id="ev" ${D.ajustes.vibrar ? 'checked' : ''}> ${t('vibrar')}</label>
        <div class="botones"><button class="opcion" data-clic id="er">${t('restablecer')}</button><button class="opcion on" data-clic id="el">${t('listo')}</button></div></div>`, 'sobre editor');
      const tam = $('#et');
      const sync = () => { tam.value = K.cfg.b[K.sel || 'gas'].tam; };
      K.alElegir = sync; sync();
      tam.oninput = () => { K.cfg.b[K.sel || 'gas'].tam = +tam.value; ubicar(K); };
      $('#eo').oninput = (e) => { K.cfg.opacidad = +e.target.value; ubicar(K); };
      $('#ez').onchange = (e) => { K.cfg.zurdo = e.target.checked; ubicar(K); };
      $('#ev').onchange = (e) => { D.ajustes.vibrar = e.target.checked; api.guardar(); };
      $('#er').onclick = () => { restablecer(K); sync(); };
      $('#el').onclick = () => { editar(K, false); if (actual === 'editor') ctl.classList.add('oculto'); alTerminar(); };
    },
  };

  /* la moto del garage, girando las ruedas y echándose atrás y adelante */
  function vitrina() {
    const c = $('#vitrina'); if (!c) return;
    const ctx = c.getContext('2d');
    let t0 = performance.now();
    const paso = () => {
      if (!document.body.contains(c)) return;
      const tt = (performance.now() - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 600, 300);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(300, 262, 190, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(300, 160); ctx.scale(118, -118); ctx.rotate(Math.sin(tt * 0.9) * 0.05);
      dibujarMoto(ctx, { rx: -0.72, ry: -0.42, fx: 0.74, fy: -0.42, giro0: tt * 8, giro1: tt * 8, colores: EQUIPOS[D.equipo], numero: D.numero, pose: { incl: Math.sin(tt * 1.3) * 0.6, agache: (Math.sin(tt * 2.1) + 1) * 0.25 } });
      UI.anim = requestAnimationFrame(paso);
    };
    paso();
  }
  /* los textos de los botones de dedo cambian con el idioma */
  function relabel() { for (const [id, b] of Object.entries(K.botones)) b.querySelector('span').textContent = t(id); }
  return UI;
}
