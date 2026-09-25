/* ============================================================================
   aeroplaza/js/caja.js — los anuncios con premio (IAA) y las compras (IAP).
   Dos proveedores con la misma cara:
   - 'tiktok': dentro de TikTok Minis (hay window.TTMinis). Lo que se usa sale
     de la documentación de TikTok for Developers (leída el 25/09/2026):
       · anuncio: TTMinis.createRewardedVideoAd({ adUnitId }) → show() (promesa),
         onClose(res) con res.isEnded === true si se vio entero, onError(err).
         Cada instancia se muestra una sola vez: se crea una por anuncio.
       · compra: el servidor propio crea la orden (POST open.tiktokapis.com/v2/
         minis/trade_order/create/, con el token del usuario) y devuelve el
         trade_order_id; el juego llama TTMinis.game.pay({ trade_order_id,
         success, fail, complete }); lo comprado se entrega recién cuando el
         servidor recibe el aviso de TikTok (webhook). El juego le pregunta al
         servidor si ya está (GET /entrega) antes de sumar las joyas.
       · el login (TTMinis.game.login) da el código que el servidor cambia por
         el token. La forma exacta de lo que devuelve hay que verla en el
         DevTool: acá se manda al servidor lo que venga.
     Lo que se configura va en window.AEROPLAZA_CAJA (lo pone la página que
     envuelve el juego, nunca en el repo): { tiktok: { anuncio: 'id del
     bloque de anuncios', servidor: 'https://…' } }. Sin servidor no hay
     compras (se dice), sin id de anuncio no hay anuncios.
   - 'prueba': en el navegador. El anuncio es una pantalla propia de 5 s y la
     compra, una ventana que dice que es de prueba y no cobra nada. Sirve para
     probar todo el recorrido sin plataforma.
   ========================================================================== */
import { miId } from './guardar.js';

/* los paquetes: cuántas joyas da cada uno (el precio en Beans lo decide el servidor al crear la orden) */
export const PRODUCTOS = [
  { id: 'joyas_100', joyas: 100, extra: 0, color: '#39d6ff' },
  { id: 'joyas_550', joyas: 500, extra: 50, color: '#9b7bff', popular: true },
  { id: 'joyas_1200', joyas: 1000, extra: 200, color: '#ff6fb0' },
  { id: 'bienvenida', joyas: 300, extra: 0, orbes: 500, unaVez: true, color: '#56e05a' },
];
export const LIMITE_ANUNCIOS = 5;       // por día, en total
export const JOYAS_POR_ANUNCIO = 5;

const conf = () => (typeof window !== 'undefined' && window.AEROPLAZA_CAJA) || {};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export const Caja = {
  get proveedor() { return typeof window !== 'undefined' && window.TTMinis ? 'tiktok' : 'prueba'; },
  /* ¿se puede mostrar un anuncio? (en TikTok hace falta el id del bloque) */
  hayAnuncios() { return this.proveedor === 'prueba' || !!conf().tiktok?.anuncio; },
  hayCompras() { return this.proveedor === 'prueba' || !!conf().tiktok?.servidor; },

  /* muestra un anuncio con premio; resuelve true solo si se vio entero.
     mostrarPrueba(): la pantalla del modo prueba (la pone joyas.js), resuelve lo mismo */
  anuncio(mostrarPrueba) {
    if (this.proveedor === 'prueba') return mostrarPrueba();
    const id = conf().tiktok?.anuncio;
    if (!id) return Promise.resolve(false);
    return new Promise((listo) => {
      let hecho = false; const fin = (v) => { if (!hecho) { hecho = true; listo(v); } };
      try {
        const ad = window.TTMinis.createRewardedVideoAd({ adUnitId: id });
        ad.onClose((res) => fin(res?.isEnded === true));
        ad.onError(() => fin(false));
        ad.show().catch(() => fin(false));
      } catch { fin(false); }
    });
  },

  /* compra un paquete; resuelve { ok, joyas, orbes } (o { ok: false, motivo }).
     confirmarPrueba(producto): la ventana del modo prueba, resuelve true o false */
  async comprar(producto, confirmarPrueba) {
    if (this.proveedor === 'prueba') {
      const si = await confirmarPrueba(producto);
      return si ? { ok: true, joyas: producto.joyas + producto.extra, orbes: producto.orbes || 0 } : { ok: false, motivo: 'cancelada' };
    }
    const srv = conf().tiktok?.servidor;
    if (!srv) return { ok: false, motivo: 'sin_servidor' };
    const T = window.TTMinis;
    try {
      /* 1. el login (el servidor cambia el código por el token de este usuario) */
      const login = await new Promise((r) => { try { const q = T.game.login({ success: r, fail: () => r(null) }); if (q && q.then) q.then(r, () => r(null)); } catch { r(null); } });
      /* 2. la orden, en el servidor propio */
      const res = await fetch(srv + '/orden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ producto: producto.id, jugador: miId(), login }) });
      const orden = await res.json();
      if (!orden?.trade_order_id) return { ok: false, motivo: 'orden' };
      /* 3. pagar con Beans */
      const pago = await new Promise((r) => { try { T.game.pay({ trade_order_id: orden.trade_order_id, success: () => r(true), fail: () => r(false) }); } catch { r(false); } });
      if (!pago) return { ok: false, motivo: 'pago' };
      /* 4. lo entrega el servidor cuando le llega el aviso de TikTok: se pregunta un rato */
      for (let i = 0; i < 20; i++) {
        const e = await (await fetch(srv + '/entrega?orden=' + encodeURIComponent(orden.orden || orden.trade_order_id))).json().catch(() => null);
        if (e?.entregado) return { ok: true, joyas: e.joyas ?? producto.joyas + producto.extra, orbes: e.orbes ?? producto.orbes ?? 0 };
        await esperar(1500);
      }
      return { ok: false, motivo: 'demora' };
    } catch { return { ok: false, motivo: 'red' }; }
  },
};

/* la fecha local del día (el regalo y el tope de anuncios van por día del que juega) */
export const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
