/* ============================================================================
   aeroplaza/js/joyas.js — las joyas (💎), la moneda de la ropa especial:
   - el regalo del día: 10 joyas la primera vez que se entra cada día;
   - la tienda de joyas: un anuncio con premio (+5, hasta 5 por día) y los
     paquetes (caja.js decide si es TikTok o el modo de prueba);
   - el anuncio de prueba (5 s, se ve entero o no hay premio) y la ventana de
     compra de prueba, que dicen bien grande que no cobran nada.
   Los orbes se siguen ganando jugando; las joyas son para lo que cuesta 100 o
   más en el probador (catalogo.js › PRECIO_JOYAS).
   ========================================================================== */
import { t, sumar } from './textos.js';
import { Guardado } from './guardar.js';
import { Caja, PRODUCTOS, LIMITE_ANUNCIOS, JOYAS_POR_ANUNCIO, hoy } from './caja.js';

sumar({
  es: {
    joyas: 'joyas', mas_joyas: '+{n} 💎', regalo_dia: '🎁 Regalo del día: +{n} 💎', tienda_joyas: 'Joyas',
    tj_saldo: 'Tenés', tj_anuncio: 'Mirá un anuncio', tj_anuncio_d: '+{n} 💎 · te quedan {q} hoy', tj_sin_anuncios: 'Ya viste los anuncios de hoy', tj_no_hay: 'No hay anuncios ahora',
    tj_paquetes: 'Paquetes', tj_extra: '+{n} de regalo', tj_popular: 'El más elegido', tj_bienvenida: 'Bienvenida', tj_bienvenida_d: '300 💎 y 500 orbes · una sola vez', tj_comprar: 'Comprar', tj_comprado: 'Ya lo compraste',
    tj_prueba: 'Modo de prueba: no se cobra nada. En TikTok se paga con Beans.', tj_sin_servidor: 'Las compras todavía no están disponibles acá', tj_fallo: 'La compra no se hizo: {m}', tj_listo: '¡Listo! +{n} 💎',
    ad_titulo: 'Anuncio de prueba', ad_texto: 'Acá va el anuncio de verdad (en TikTok)', ad_falta: 'Premio en {s}', ad_listo: '¡Premio ganado!', ad_cerrar: 'Cerrar', ad_sin_premio: 'Se cerró antes: sin premio',
    cp_titulo: 'Compra de prueba', cp_texto: 'Esto es una prueba: no se cobra nada.', cp_si: 'Confirmar', cp_no: 'Cancelar',
    pp_probando: 'Te estás probando', pp_mision: 'con misión', pp_comprar: 'Comprar', pp_sacar: 'Sacar', pp_faltan: 'Te faltan {n}', pp_conseguir: 'Conseguir 💎', pp_ver_anuncio: '📺 +{n} orbes', pp_se_saco: 'Lo que no compraste se sacó', pp_gastar: '¿Gastar {n} 💎?',
    ad_duplicar: '📺 Duplicar', ad_duplicado: '¡Duplicado! +{n} orbes',
  },
  en: {
    joyas: 'gems', mas_joyas: '+{n} 💎', regalo_dia: '🎁 Daily gift: +{n} 💎', tienda_joyas: 'Gems',
    tj_saldo: 'You have', tj_anuncio: 'Watch an ad', tj_anuncio_d: '+{n} 💎 · {q} left today', tj_sin_anuncios: 'You already watched today’s ads', tj_no_hay: 'No ads right now',
    tj_paquetes: 'Packs', tj_extra: '+{n} bonus', tj_popular: 'Most popular', tj_bienvenida: 'Welcome', tj_bienvenida_d: '300 💎 and 500 orbs · only once', tj_comprar: 'Buy', tj_comprado: 'Already bought',
    tj_prueba: 'Test mode: nothing is charged. On TikTok you pay with Beans.', tj_sin_servidor: 'Purchases aren’t available here yet', tj_fallo: 'The purchase didn’t go through: {m}', tj_listo: 'Done! +{n} 💎',
    ad_titulo: 'Test ad', ad_texto: 'The real ad goes here (on TikTok)', ad_falta: 'Reward in {s}', ad_listo: 'Reward earned!', ad_cerrar: 'Close', ad_sin_premio: 'Closed early: no reward',
    cp_titulo: 'Test purchase', cp_texto: 'This is a test: nothing is charged.', cp_si: 'Confirm', cp_no: 'Cancel',
    pp_probando: 'Trying on', pp_mision: 'quest', pp_comprar: 'Buy', pp_sacar: 'Take off', pp_faltan: 'You need {n}', pp_conseguir: 'Get 💎', pp_ver_anuncio: '📺 +{n} orbs', pp_se_saco: 'What you didn’t buy was taken off', pp_gastar: 'Spend {n} 💎?',
    ad_duplicar: '📺 Double it', ad_duplicado: 'Doubled! +{n} orbs',
  },
  pt: {
    joyas: 'joias', mas_joyas: '+{n} 💎', regalo_dia: '🎁 Presente do dia: +{n} 💎', tienda_joyas: 'Joias',
    tj_saldo: 'Você tem', tj_anuncio: 'Veja um anúncio', tj_anuncio_d: '+{n} 💎 · restam {q} hoje', tj_sin_anuncios: 'Você já viu os anúncios de hoje', tj_no_hay: 'Sem anúncios agora',
    tj_paquetes: 'Pacotes', tj_extra: '+{n} de presente', tj_popular: 'O mais escolhido', tj_bienvenida: 'Boas-vindas', tj_bienvenida_d: '300 💎 e 500 orbes · uma vez só', tj_comprar: 'Comprar', tj_comprado: 'Já comprado',
    tj_prueba: 'Modo de teste: nada é cobrado. No TikTok se paga com Beans.', tj_sin_servidor: 'As compras ainda não estão disponíveis aqui', tj_fallo: 'A compra não foi feita: {m}', tj_listo: 'Pronto! +{n} 💎',
    ad_titulo: 'Anúncio de teste', ad_texto: 'Aqui vai o anúncio de verdade (no TikTok)', ad_falta: 'Prêmio em {s}', ad_listo: 'Prêmio ganho!', ad_cerrar: 'Fechar', ad_sin_premio: 'Fechou antes: sem prêmio',
    cp_titulo: 'Compra de teste', cp_texto: 'Isto é um teste: nada é cobrado.', cp_si: 'Confirmar', cp_no: 'Cancelar',
    pp_probando: 'Provando', pp_mision: 'missão', pp_comprar: 'Comprar', pp_sacar: 'Tirar', pp_faltan: 'Faltam {n}', pp_conseguir: 'Conseguir 💎', pp_ver_anuncio: '📺 +{n} orbes', pp_se_saco: 'O que você não comprou foi tirado', pp_gastar: 'Gastar {n} 💎?',
    ad_duplicar: '📺 Dobrar', ad_duplicado: 'Dobrado! +{n} orbes',
  },
});

const $ = (sel, raiz = document) => raiz.querySelector(sel);
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

/* los anuncios de hoy (se reinicia la cuenta al cambiar el día) */
function cuenta(G) { const d = hoy(); if (!G.anuncios || G.anuncios.dia !== d) G.anuncios = { dia: d, n: 0 }; return G.anuncios; }
export const anunciosQuedan = (G) => Math.max(0, LIMITE_ANUNCIOS - cuenta(G).n);

/* ------------------------------------------------------------ el regalo del día */
export function regaloDelDia(J, UI) {
  const G = J.G, d = hoy();
  if (G.regalo === d) return false;
  G.regalo = d; G.joyas = (G.joyas || 0) + 10; Guardado.guardar();
  setTimeout(() => { UI.avisar(t('regalo_dia', { n: 10 }), 'bien'); J.sfx('restaura'); UI.actualizarHud(); UI.hud?.querySelector('.joyas-p')?.classList.add('late'); }, 1800);
  return true;
}

/* ------------------------------------------------------------ el anuncio de prueba */
/* 5 s con burbujas; el ✕ se puede tocar siempre, pero antes de tiempo no hay premio */
function anuncioDePrueba(UI) {
  return new Promise((listo) => {
    const v = UI.poner(el(`<div class="anuncio-prueba"><div class="ap-caja"><div class="ap-cinta">${t('ad_titulo')}</div><div class="ap-burbujas">${'<i></i>'.repeat(9)}</div>
      <div class="ap-logo">AERO<b>PLAZA</b></div><p>${t('ad_texto')}</p><div class="ap-barra"><i></i></div><div class="ap-pie"><span class="ap-falta"></span><button class="boton chico" data-a="x">${t('ad_cerrar')}</button></div></div></div>`));
    const T = 5, t0 = performance.now(); let fin = false;
    const barra = $('.ap-barra i', v), falta = $('.ap-falta', v);
    const paso = () => {
      if (fin) return;
      const s = (performance.now() - t0) / 1000;
      barra.style.width = Math.min(100, s / T * 100) + '%';
      falta.textContent = s < T ? t('ad_falta', { s: Math.ceil(T - s) }) : t('ad_listo');
      if (s >= T) v.classList.add('listo');
      requestAnimationFrame(paso);
    };
    paso();
    $('[data-a=x]', v).onclick = () => { fin = true; const ok = (performance.now() - t0) / 1000 >= T; v.remove(); if (!ok) UI.avisar(t('ad_sin_premio')); listo(ok); };
  });
}

/* un anuncio con premio, con el tope del día: devuelve true si hay que dar el premio */
export async function verAnuncio(J, UI) {
  const G = J.G;
  if (anunciosQuedan(G) <= 0) { UI.avisar(t('tj_sin_anuncios')); J.sfx('no'); return false; }
  if (!Caja.hayAnuncios()) { UI.avisar(t('tj_no_hay')); return false; }
  const ok = await Caja.anuncio(() => anuncioDePrueba(UI));
  if (ok) { cuenta(G).n++; Guardado.guardar(); }
  return ok;
}

/* ------------------------------------------------------------ la compra de prueba */
function compraDePrueba(UI, P) {
  return new Promise((listo) => {
    const nombre = P.id === 'bienvenida' ? t('tj_bienvenida') : `${P.joyas + P.extra} 💎`;
    const v = UI.poner(el(`<div class="velo compra-prueba"><div class="ventana" style="width:min(420px,94vw)"><div class="cabeza"><h2>${t('cp_titulo')}</h2></div><div class="cuerpo">
      <div class="cp-producto" style="--c:${P.color}"><i class="joya-icono grande"></i><b></b></div><p class="cp-aviso">${t('cp_texto')}</p>
      <div class="fila-botones"><button class="boton" data-a="no">${t('cp_no')}</button><button class="boton primario" data-a="si">${t('cp_si')}</button></div></div></div></div>`));
    $('.cp-producto b', v).textContent = nombre;
    const cerrar = (si) => { v.remove(); listo(si); };
    $('[data-a=si]', v).onclick = () => cerrar(true);
    $('[data-a=no]', v).onclick = () => cerrar(false);
  });
}

/* ------------------------------------------------------------ la tienda de joyas */
export function tiendaJoyas(J, UI, { alCerrar } = {}) {
  const G = J.G, c = el('<div class="tienda-joyas"></div>');
  const dibujar = () => {
    const quedan = anunciosQuedan(G), ads = Caja.hayAnuncios(), compras = Caja.hayCompras();
    c.innerHTML = `<div class="tj-saldo"><span>${t('tj_saldo')}</span><i class="joya-icono grande"></i><b>${G.joyas || 0}</b><span class="tj-orbes"><i class="orbe-icono"></i>${G.orbes}</span></div>
      <button class="tj-anuncio" data-a="anuncio" ${quedan && ads ? '' : 'disabled'}><span class="tj-tele">📺</span><span><b>${t('tj_anuncio')}</b><small>${quedan ? t('tj_anuncio_d', { n: JOYAS_POR_ANUNCIO, q: quedan }) : t('tj_sin_anuncios')}</small></span></button>
      <h3>${t('tj_paquetes')}</h3><div class="tj-paquetes"></div>
      <p class="tj-nota">${Caja.proveedor === 'prueba' ? t('tj_prueba') : compras ? '' : t('tj_sin_servidor')}</p>`;
    const L = $('.tj-paquetes', c);
    for (const P of PRODUCTOS) {
      const ya = P.unaVez && (G.compras || []).includes(P.id);
      const b = el(`<button class="tj-paquete ${P.popular ? 'popular' : ''}" style="--c:${P.color}" ${ya || !compras ? 'disabled' : ''}>
        ${P.popular ? `<span class="tj-cinta">${t('tj_popular')}</span>` : ''}<i class="joya-icono grande"></i>
        <b>${P.id === 'bienvenida' ? t('tj_bienvenida') : P.joyas}</b><small>${P.id === 'bienvenida' ? t('tj_bienvenida_d') : P.extra ? t('tj_extra', { n: P.extra }) : '&nbsp;'}</small>
        <span class="tj-precio">${ya ? t('tj_comprado') : t('tj_comprar')}</span></button>`);
      b.onclick = async () => {
        J.sfx('elegir');
        const r = await Caja.comprar(P, (p) => compraDePrueba(UI, p));
        if (!r.ok) { if (r.motivo !== 'cancelada') UI.avisar(r.motivo === 'sin_servidor' ? t('tj_sin_servidor') : t('tj_fallo', { m: r.motivo })); return; }
        G.joyas = (G.joyas || 0) + r.joyas; G.orbes += r.orbes || 0;
        G.compras = [...(G.compras || []), P.id]; Guardado.ya();
        UI.avisar(t('tj_listo', { n: r.joyas }), 'bien'); J.sfx('restaura'); UI.actualizarHud(); dibujar(); UI._alCambiarJoyas?.();
      };
      L.appendChild(b);
    }
    $('[data-a=anuncio]', c).onclick = async () => {
      if (await verAnuncio(J, UI)) { G.joyas = (G.joyas || 0) + JOYAS_POR_ANUNCIO; Guardado.guardar(); UI.avisar(t('mas_joyas', { n: JOYAS_POR_ANUNCIO }), 'bien'); J.sfx('orbe'); UI.actualizarHud(); UI._alCambiarJoyas?.(); }
      if (c.isConnected) dibujar();
    };
  };
  dibujar();
  return UI.ventana(t('tienda_joyas'), c, { ancho: 520, alCerrar });
}
