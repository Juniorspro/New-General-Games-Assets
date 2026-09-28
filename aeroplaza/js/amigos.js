/* ============================================================================
   aeroplaza/js/amigos.js — (vuelta 46) LOS AMIGOS, sin servidor propio: las
   solicitudes, los amigos y los mensajes van por el mismo broker MQTT público
   que el multijugador (red.js). Como ahí cualquiera puede publicar cualquier
   cosa, nada se cree porque sí:
   - LA LLAVE (Llave): cada aparato tiene un par ECDH P-256 (WebCrypto). El id
     de la red ES la huella de la llave pública: los primeros 12 hex del
     SHA-256. Quien dice ser a3f9… tiene que mostrar una llave cuya huella sea
     a3f9…, y solo el dueño de esa llave puede cifrar lo que después se abre.
     El id sigue con la misma forma de antes (12 hex) y es el "código de amigo".
   - EL PERFIL (perfil/<id>, retenido): la llave pública, el nombre y el muñeco.
     Sirve para encontrar a alguien por su código aunque no esté conectado. La
     llave se comprueba con la huella; el nombre de ahí se muestra hasta que
     llega una carta (lo de las cartas sí está firmado por el cifrado).
   - LAS CARTAS (buzon/<para>/<de>, retenido: le llega aunque esté
     desconectado): una por par de jugadores y por sentido, con TODO lo que uno
     le dice al otro: si lo quiere de amigo (rel: pide · amigo · no), su nombre
     y su muñeco, los últimos 30 mensajes y hasta cuál leyó ("visto"). Va
     cifrada con AES-GCM y la clave que salen de ECDH entre las dos llaves
     (HKDF): solo esos dos la abren, y abrirla prueba que la escribió el otro.
     Cada carta lleva un número que solo sube (n): una vieja repetida no vale.
   - Amigos = los dos dijeron que sí. Uno pide ('pide'), el otro acepta
     ('amigo') y el primero, al ver el sí, también pasa a 'amigo'. Si los dos se
     piden a la vez, quedan amigos solos. 'no' es rechazar, cancelar o quitar.
   - Quién está en línea y dónde sale del vestíbulo de red.js (la presencia
     que ya mandaba cada uno cada 4 s): ahí el id es el mismo.
   Sin WebCrypto (una página sin https) no hay llave: el juego anda igual, con
   un id al azar como antes, y el celu dice por qué no hay amigos.
   ========================================================================== */
import { NS } from './red.js';

export const ID_RE = /^[0-9a-f]{12}$/;
export const MAX_AMIGOS = 100, MAX_PEDIDOS = 40, MAX_EN_CARTA = 30, MAX_CHARLA = 80, MAX_TXT = 200;
const RELES = ['pide', 'amigo', 'no'];
const TE = new TextEncoder(), TD = new TextDecoder();
const CURVA = { name: 'ECDH', namedCurve: 'P-256' };

/* (de a pedazos: String.fromCharCode(...a) con una carta grande se pasa del máximo de argumentos) */
export function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
export function deB64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
/* la huella de una llave pública (en base64, 65 bytes sin comprimir): el id */
export async function idDe(pub) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', deB64(pub)))).slice(0, 12); }
/* el código como se lee: a3f9·2c81·77de */
export const codigoLindo = (id) => String(id || '').replace(/(.{4})(?=.)/g, '$1·');
/* lo que alguien escribe como código: sin espacios, puntos ni guiones, en minúscula */
export const leerCodigo = (s) => String(s || '').toLowerCase().replace(/[^0-9a-f]/g, '');

/* ------------------------------------------------------------ la llave de este aparato */
export const Llave = {
  lista: false, id: null, pub: null, priv: null, _claves: new Map(),
  async cargar() {
    const S = globalThis.crypto && crypto.subtle;
    if (!S || globalThis.isSecureContext === false) return false;
    try {
      let g = null; try { g = JSON.parse(localStorage.getItem('aeroplaza_llave') || 'null'); } catch { g = null; }
      /* (una guardada que no se puede leer, rota o de otro navegador, se cambia por una nueva) */
      if (g && g.d && typeof g.pub === 'string') {
        try { this.priv = await S.importKey('jwk', g.d, CURVA, false, ['deriveBits']); this.pub = g.pub; } catch { g = null; }
      }
      if (!this.priv) {
        const k = await S.generateKey(CURVA, true, ['deriveBits']);
        const d = await S.exportKey('jwk', k.privateKey);
        this.pub = b64(new Uint8Array(await S.exportKey('raw', k.publicKey)));
        this.priv = await S.importKey('jwk', d, CURVA, false, ['deriveBits']);
        /* (sin poder guardarla, en una ventana privada, la llave dura lo que la página: como el id de antes) */
        try { localStorage.setItem('aeroplaza_llave', JSON.stringify({ d, pub: this.pub })); } catch { /* nada */ }
      }
      this.id = await idDe(this.pub); this.lista = true;
      return true;
    } catch (e) { console.warn('llave:', e && e.message); this.lista = false; return false; }
  },
  /* la clave que comparten dos (la misma de los dos lados): ECDH y después HKDF */
  clave(pubOtro) {
    let p = this._claves.get(pubOtro);
    if (p) return p;
    const S = crypto.subtle;
    p = S.importKey('raw', deB64(pubOtro), CURVA, false, []).then(async (pk) => {
      const bits = await S.deriveBits({ name: 'ECDH', public: pk }, this.priv, 256);
      const base = await S.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
      return S.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: TE.encode('aeroplaza-amigos-v1'), info: new Uint8Array(0) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
    this._claves.set(pubOtro, p); p.catch(() => this._claves.delete(pubOtro));
    return p;
  },
  /* el sobre de una carta: quién la manda, su llave y lo cifrado. El "de>para" va como dato asociado: una carta
     copiada a otro buzón no abre */
  async sellar(para, pubPara, carta) {
    const K = await this.clave(pubPara), iv = crypto.getRandomValues(new Uint8Array(12));
    const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: TE.encode(this.id + '>' + para) }, K, TE.encode(JSON.stringify(carta)));
    return { id: this.id, pub: this.pub, iv: b64(iv), c: b64(new Uint8Array(c)) };
  },
  /* abrir una carta: null si la llave no es la de ese id, si no abre o si no es para mí */
  async abrir(de, s) {
    try {
      if (!s || typeof s.pub !== 'string' || s.pub.length > 120 || typeof s.iv !== 'string' || s.iv.length > 40 || typeof s.c !== 'string' || s.c.length > 90000) return null;
      if (await idDe(s.pub) !== de) return null;
      const K = await this.clave(s.pub);
      const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(s.iv), additionalData: TE.encode(de + '>' + this.id) }, K, deB64(s.c));
      const o = JSON.parse(TD.decode(p));
      return o && typeof o === 'object' && o.de === de && o.para === this.id ? o : null;
    } catch { return null; }
  },
};

/* lo que llega de otro, limpio (el muñeco va al Meeple y al dibujito del celu) */
const COLOR = /^#[0-9a-f]{6}$/i;
/* (sin los de control ni los invisibles que dan vuelta el texto o lo esconden: con eso alguien se disfraza de otro) */
export function limpiarNombre(s) { return String(s || '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '').trim().slice(0, 20); }
export function limpiarA(A) {
  if (!A || typeof A !== 'object') return null;
  const o = {};
  for (const [k, v] of Object.entries(A).slice(0, 24)) {
    if (typeof v === 'string' && v.length <= 24 && /^[\w#-]+$/.test(v)) o[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) o[k] = Math.max(-10, Math.min(10, v));
  }
  if (o.color && !COLOR.test(o.color)) delete o.color;
  if (o.color2 && !COLOR.test(o.color2)) delete o.color2;
  if (o.colorPelo && !COLOR.test(o.colorPelo)) delete o.colorPelo;
  return o;
}

/* ------------------------------------------------------------ los amigos */
/* G.amigos[id] = { nombre, A, pub, mia, suya, pideMio, pideSuya, rechazo, nMia, nSuya, charla: [{ yo, n, t, x }],
   miN, ultN, vio, leido, desde, visto, t, porMandar }
   - mia: lo que yo le digo (pide · amigo · no · null); suya: lo último que me dijo (su carta más nueva, nSuya);
   - pideSuya: el número de su pedido (uno nuevo después de un rechazo vuelve a aparecer; rechazo: el que rechacé);
   - miN / ultN: el número de mi último mensaje y el del suyo que ya tengo; vio: hasta cuál mío leyó; leido: hasta
     cuál suyo leí yo; visto: la última vez que estuvo en línea (ms). */
export function estadoDe(a, bloqueado = false) {
  if (!a) return 'nada';
  if (bloqueado) return 'bloqueado';
  if (a.mia === 'amigo' && (a.suya === 'amigo' || a.suya === 'pide')) return 'amigo';
  if (a.mia === 'pide') return 'enviada';
  if (!a.mia && (a.suya === 'pide' || a.suya === 'amigo')) return 'recibida';
  return 'nada';
}

export class Amigos {
  /* red: la de red.js; G: lo guardado; guardar(); alAviso(tipo, a, extra): lo que se le dice al jugador */
  constructor({ red, G, guardar = () => {}, alAviso = () => {}, alCambio = () => {} }) {
    this.red = red; this.G = G; this.guardar = guardar; this.alAviso = alAviso; this.alCambio = alCambio;
    G.amigos ||= {}; G.bloqueados ||= []; G.amigosOp = { pedidos: 'todos', avisos: true, ...(G.amigosOp || {}) };
    this.buscando = new Map();   // id → { t, nombre, A, pub } (los perfiles pedidos por código)
    this.colas = new Map();      // id → la promesa de la última carta de ese (se abren de a una, en orden)
    this.enLineaAntes = new Set(); this.tConecto = 0;
    red.alBuzon = (de, sobre) => this.recibir(de, sobre);
    red.alPerfil = (d) => this.recibirPerfil(d);
    red.alConectar = () => this.alConectar();
  }
  get listo() { return Llave.lista && Llave.id === this.red.id; }
  get A() { return this.G.amigos; }
  bloqueado(id) { return this.G.bloqueados.includes(id); }
  estado(id) { return estadoDe(this.A[id], this.bloqueado(id)); }
  /* los que tienen algo que ver conmigo, con su estado (los tachados, 'nada', no salen) */
  lista(filtro) { return Object.entries(this.A).map(([id, a]) => ({ id, a, e: this.estado(id) })).filter((q) => q.e !== 'nada' && q.e !== 'bloqueado' && (!filtro || q.e === filtro)); }
  get cuantos() { return this.lista('amigo').length; }
  get recibidas() { return this.lista('recibida').length; }
  noLeidos(id) { const a = this.A[id]; if (!a || this.estado(id) !== 'amigo') return 0; return (a.charla || []).filter((m) => !m.yo && m.n > (a.leido || 0)).length; }
  get sinLeer() { return this.lista('amigo').reduce((s, q) => s + this.noLeidos(q.id), 0); }
  /* ¿está en línea? (en el vestíbulo, visto hace menos de 12 s) y dónde */
  donde(id) { const v = this.red.vestibulo.get(id); return v && performance.now() - v.t < 12000 ? v : null; }
  nombre(id) { return this.A[id]?.nombre || this.red.vestibulo.get(id)?.nombre || this.buscando.get(id)?.nombre || id; }
  /* el número de cada carta: siempre más que el anterior (la hora, o uno más si la hora no avanzó) */
  seq() { this.G.amigosN = Math.max(Date.now(), (this.G.amigosN || 0) + 1); return this.G.amigosN; }
  nuevo(id, nombre = '') {
    /* (los tachados más viejos se van si hay demasiados) */
    const ids = Object.keys(this.A);
    if (ids.length >= 400) for (const k of ids.filter((q) => this.estado(q) === 'nada').sort((x, y) => (this.A[x].t || 0) - (this.A[y].t || 0)).slice(0, 50)) delete this.A[k];
    return (this.A[id] = { nombre: limpiarNombre(nombre), A: null, pub: null, mia: null, suya: null, nMia: 0, nSuya: 0, charla: [], miN: 0, ultN: 0, vio: 0, leido: 0, t: Date.now() }); }

  /* ------------------------------------------------------------ al conectar */
  alConectar() {
    if (!this.listo) return;
    this.tConecto = performance.now();
    this.red.suscribirTema(NS + 'buzon/' + this.red.id + '/+');
    this.publicarPerfil(true);
    for (const [id, a] of Object.entries(this.A)) {
      if (a.porMandar) this.mandar(id);
      else if (!a.pub && a.mia) this.pedirPerfil(id);
    }
  }
  /* mi perfil, retenido (al conectar, y si cambió el nombre o el muñeco; como mucho cada 3 s) */
  publicarPerfil(ya = false) {
    if (!this.listo) return;
    clearTimeout(this._tPerfil);
    const hacer = () => {
      this.red.publicarRetenido(NS + 'perfil/' + this.red.id, { id: this.red.id, pub: Llave.pub, name: this.G.nombre, A: this.G.A, t: Date.now() });
      /* (y a los amigos, en la carta, que es lo que ellos creen: el nombre y el muñeco nuevos) */
      if (!ya) for (const q of this.lista('amigo')) this.mandar(q.id);
    };
    if (ya) hacer(); else this._tPerfil = setTimeout(hacer, 3000);
  }
  pedirPerfil(id) { this.red.suscribirTema(NS + 'perfil/' + id); }
  async recibirPerfil(d) {
    if (!this.listo || !d || !ID_RE.test(d.id) || typeof d.pub !== 'string' || d.pub.length > 120) return;
    const a = this.A[d.id], b = this.buscando.get(d.id);
    if (!a && !b) return;
    let ok = false; try { ok = await idDe(d.pub) === d.id; } catch { ok = false; }
    if (!ok) return;   // (una llave que no es la de ese código: alguien que se hace pasar)
    this.red.desuscribirTema(NS + 'perfil/' + d.id);
    if (b) { b.pub = d.pub; b.nombre = limpiarNombre(d.name) || b.nombre; b.A = limpiarA(d.A); b.encontrado = true; }
    if (a) {
      a.pub = d.pub;
      /* (el nombre del perfil, solo si todavía no hay uno de sus cartas) */
      if (!a.nSuya) { a.nombre = limpiarNombre(d.name) || a.nombre; a.A = limpiarA(d.A) || a.A; }
      if (a.porMandar) this.mandar(d.id);
    }
    this.guardar(); this.alCambio();
  }

  /* ------------------------------------------------------------ lo que hago yo */
  /* mandar una solicitud (por código, o a alguien que está cerca). Devuelve qué pasó */
  pedir(id, nombre = '') {
    id = leerCodigo(id);
    if (!this.listo) return 'sin_llave';
    if (!ID_RE.test(id)) return 'mal';
    if (id === this.red.id) return 'vos';
    if (this.bloqueado(id)) return 'bloqueado';
    const e = this.estado(id);
    if (e === 'amigo') return 'ya';
    if (e === 'recibida') { this.aceptar(id); return 'aceptada'; }
    if (e !== 'enviada' && this.cuantos >= MAX_AMIGOS) return 'lleno';
    const a = this.A[id] || this.nuevo(id, nombre || this.red.vestibulo.get(id)?.nombre || '');
    if (!a.nombre && nombre) a.nombre = limpiarNombre(nombre);
    /* (si ya se lo buscó por el código, su perfil trae la llave: no hay que esperarlo) */
    const b = this.buscando.get(id);
    if (!a.pub && b?.pub) { a.pub = b.pub; a.nombre ||= b.nombre; a.A ||= b.A; }
    /* (si él ya me había dicho que sí, o también me pidió: amigos de una) */
    a.mia = a.suya === 'amigo' || a.suya === 'pide' ? 'amigo' : 'pide';
    a.pideMio = this.seq(); a.t = Date.now();
    if (a.mia === 'amigo') a.desde ||= Date.now();
    this.mandar(id);
    this.guardar(); this.alCambio();
    return a.mia === 'amigo' ? 'aceptada' : a.pub ? 'enviada' : 'buscando';
  }
  aceptar(id) { const a = this.A[id]; if (!a || this.estado(id) !== 'recibida') return false; a.mia = 'amigo'; a.desde = Date.now(); a.t = Date.now(); this.mandar(id); this.guardar(); this.alCambio(); return true; }
  /* rechazar un pedido, cancelar el mío o quitar a un amigo: 'no' (y el registro queda, tachado, para que una
     carta vieja que el broker guarda no lo vuelva a mostrar) */
  decirNo(id) {
    const a = this.A[id]; if (!a) return false;
    /* (y me olvido de lo que me había dicho: si más adelante le pido de nuevo, tiene que volver a aceptar) */
    a.mia = 'no'; a.rechazo = a.pideSuya || 0; a.suya = null; a.charla = []; a.desde = 0; a.t = Date.now();
    this.mandar(id); this.guardar(); this.alCambio();
    return true;
  }
  rechazar(id) { return this.decirNo(id); }
  cancelar(id) { return this.decirNo(id); }
  quitar(id) { return this.decirNo(id); }
  bloquear(id) {
    if (!ID_RE.test(id) || id === this.red.id) return false;
    if (!this.bloqueado(id)) this.G.bloqueados.push(id);
    if (this.G.bloqueados.length > 200) this.G.bloqueados.shift();
    if (this.A[id]) this.decirNo(id); else { this.guardar(); this.alCambio(); }
    return true;
  }
  desbloquear(id) { this.G.bloqueados = this.G.bloqueados.filter((q) => q !== id); this.guardar(); this.alCambio(); }
  /* un mensaje a un amigo */
  escribir(id, texto) {
    const x = String(texto || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, MAX_TXT);
    const a = this.A[id];
    if (!x || !a || this.estado(id) !== 'amigo') return null;
    const m = { yo: true, n: (a.miN = Math.max((a.miN || 0) + 1, 1)), t: Date.now(), x };
    a.charla.push(m); if (a.charla.length > MAX_CHARLA) a.charla.splice(0, a.charla.length - MAX_CHARLA);
    a.t = m.t;
    this.mandar(id); this.guardar(); this.alCambio();
    return m;
  }
  /* abrí la charla: lo suyo queda leído (y se lo digo, para su "visto") */
  leer(id) {
    const a = this.A[id]; if (!a) return;
    const ult = Math.max(0, ...(a.charla || []).filter((m) => !m.yo).map((m) => m.n));
    if (ult > (a.leido || 0)) { a.leido = ult; this.mandar(id); this.guardar(); this.alCambio(); }
  }
  /* la carta que le toca, entera, cifrada y retenida en su buzón. De a una por amigo y en orden: si dos se
     cruzaran, la retenida podría quedar la vieja (sin el último mensaje). Si ya hay una esperando, esa alcanza:
     se arma recién cuando le toca, con lo último */
  mandar(id) {
    const a = this.A[id]; if (!a) return null;
    a.porMandar = true;
    this._espera ||= new Map(); this._envios ||= new Map();
    if (this._espera.has(id)) return this._espera.get(id);
    const p = (this._envios.get(id) || Promise.resolve()).then(() => { this._espera.delete(id); return this._mandar(id); }).catch((e) => console.warn('amigos:', e && e.message));
    this._espera.set(id, p); this._envios.set(id, p);
    return p;
  }
  async _mandar(id) {
    const a = this.A[id]; if (!a || !a.porMandar) return;
    if (!this.listo) return;
    if (!a.pub) { this.pedirPerfil(id); return; }
    if (!this.red.conectado) return;
    const carta = {
      de: this.red.id, para: id, n: this.seq(), rel: a.mia || 'no', pide: a.mia === 'pide' ? a.pideMio : 0,
      nombre: this.G.nombre, A: this.G.A, vi: a.leido || 0,
      msgs: a.mia === 'amigo' ? (a.charla || []).filter((m) => m.yo).slice(-MAX_EN_CARTA).map((m) => ({ n: m.n, t: m.t, x: m.x })) : [],
    };
    a.nMia = carta.n; a.porMandar = false;
    try {
      const sobre = await Llave.sellar(id, a.pub, carta);
      if (!this.red.publicarRetenido(NS + 'buzon/' + id + '/' + this.red.id, sobre)) a.porMandar = true;
    } catch (e) { console.warn('amigos: no se pudo sellar', e && e.message); a.porMandar = true; }
    this.guardar();
  }

  /* ------------------------------------------------------------ lo que llega */
  recibir(de, sobre) {
    if (!this.listo || !ID_RE.test(de) || de === this.red.id || this.bloqueado(de)) return;
    const antes = this.colas.get(de) || Promise.resolve();
    const p = antes.then(() => this._recibir(de, sobre)).catch((e) => console.warn('amigos:', e && e.message));
    this.colas.set(de, p);
    return p;
  }
  async _recibir(de, sobre) {
    const o = await Llave.abrir(de, sobre);
    if (!o || !Number.isFinite(o.n)) return;
    let a = this.A[de];
    const rel = RELES.includes(o.rel) ? o.rel : 'no';
    if (!a) {
      /* alguien nuevo: solo si me pide (o me tiene de amigo), si dejo que me pidan y si no hay demasiados */
      if (rel === 'no' || this.G.amigosOp.pedidos === 'nadie' || this.recibidas >= MAX_PEDIDOS) return;
      a = this.nuevo(de);
    }
    if (!(o.n > (a.nSuya || 0))) return;   // (vieja o repetida)
    const eAntes = this.estado(de);
    a.nSuya = o.n; a.pub = sobre.pub;
    a.nombre = limpiarNombre(o.nombre) || a.nombre; a.A = limpiarA(o.A) || a.A;
    a.suya = rel;
    if (rel === 'pide') a.pideSuya = Number.isFinite(o.pide) && o.pide > 0 ? o.pide : o.n;
    let contestar = false;
    if (rel === 'no') { if (a.mia === 'amigo' || a.mia === 'pide') { a.mia = null; a.charla = []; a.desde = 0; } }
    else {
      /* (un pedido nuevo después de que lo rechacé vuelve a aparecer; el mismo de antes, no) */
      if (a.mia === 'no' && rel === 'pide' && a.pideSuya !== a.rechazo) a.mia = null;
      /* los dos quieren: amigos (me aceptó, o nos pedimos a la vez) */
      if (a.mia === 'pide') { a.mia = 'amigo'; a.desde = Date.now(); contestar = true; }
    }
    const e = this.estado(de);
    let nuevos = [];
    if (e === 'amigo' && Array.isArray(o.msgs)) {
      for (const m of o.msgs.slice(-MAX_EN_CARTA)) {
        if (!m || !Number.isFinite(m.n) || m.n <= (a.ultN || 0) || typeof m.x !== 'string') continue;
        const x = m.x.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, MAX_TXT); if (!x.trim()) continue;
        const q = { yo: false, n: m.n, t: Number.isFinite(m.t) ? Math.min(m.t, Date.now()) : Date.now(), x };
        a.charla.push(q); nuevos.push(q); a.ultN = m.n;
      }
      a.charla.sort((p, q) => p.t - q.t || (p.yo === q.yo ? p.n - q.n : 0));
      if (a.charla.length > MAX_CHARLA) a.charla.splice(0, a.charla.length - MAX_CHARLA);
      if (nuevos.length) a.t = Date.now();
    }
    if (Number.isFinite(o.vi)) a.vio = Math.max(a.vio || 0, Math.min(o.vi, a.miN || 0));
    /* (el que ya no tiene nada conmigo queda tachado, con el número de su última carta: si alguien repite una
       carta suya más vieja, que el broker o un tramposo guardó, no revive un pedido ni una amistad) */
    this.guardar(); this.alCambio();
    if (e === 'recibida' && eAntes !== 'recibida') this.alAviso('solicitud', a, de);
    if (e === 'amigo' && eAntes !== 'amigo') this.alAviso(eAntes === 'enviada' ? 'acepto' : 'amigos', a, de);
    if (nuevos.length) this.alAviso('mensaje', a, de, nuevos);
    if (contestar) this.mandar(de);
  }

  /* ------------------------------------------------------------ quién se conectó */
  /* (lo llama main.js cuando cambia el vestíbulo; los primeros 10 s después de conectar no avisa: ahí llegan todos) */
  revisarEnLinea() {
    if (!this.listo) return;
    const ahora = new Set();
    for (const q of this.lista('amigo')) if (this.donde(q.id)) { ahora.add(q.id); q.a.visto = Date.now(); }
    const callado = performance.now() - this.tConecto < 10000;
    let cambio = ahora.size !== this.enLineaAntes.size;
    for (const id of ahora) if (!this.enLineaAntes.has(id)) { cambio = true; if (!callado && this.G.amigosOp.avisos) this.alAviso('conecto', this.A[id], id); }
    this.enLineaAntes = ahora;
    if (cambio) this.alCambio();
  }
  /* buscar a alguien por su código (para ver quién es antes de pedirle): su perfil retenido */
  buscar(id) {
    id = leerCodigo(id);
    if (!ID_RE.test(id)) return null;
    let b = this.buscando.get(id);
    if (!b) { b = { t: performance.now(), nombre: this.red.vestibulo.get(id)?.nombre || '', A: null, pub: null }; this.buscando.set(id, b); this.pedirPerfil(id); }
    return b;
  }
}
