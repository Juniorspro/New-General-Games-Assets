/* El multijugador del original (Network de Unity 4: Connect/InitializeServer con IP, Network.Instantiate,
   NetworkView, RPC) sin servidor propio: un broker MQTT público hace de correo, como en AEROPLAZA.
   - La IP pasa a ser un código de sala de 4 letras: "Host" lo inventa y lo muestra; "Connect" lo pide.
     La sala dice en qué escena se juega (el original no lo controlaba: había que elegir la misma).
   - Cada cliente es dueño de su muñeco (y, en cooperativo, del Tinky que crea al entrar: CreatePlayer del
     original hace Network.Instantiate de un Tinky por cada jugador que llega). Cada ~100 ms manda dónde está.
   - Network.Instantiate (los carteles de 1/10…, "un jugador juntó todo", "atraparon a uno", los sustos)
     viaja como evento y cada uno lo crea en su escena. Las natillas son de cada uno (el original usaba
     Destroy, no Network.Destroy): cada víctima junta sus 10 y, cuando alguna llega, ganan todos.
   - El que deja de mandar 6 s desaparece. Sin red (o si no carga el cliente MQTT) se juega solo. */
import * as THREE from 'three';
import { GUIONES } from './guiones.js';

const NS = 'slendytubbies_v2_';
const BROKER = 'wss://broker.emqx.io:8084/mqtt';
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function cargarMqtt() {
  if (window.mqtt?.connect) return Promise.resolve(true);
  const probar = (src) => new Promise((res) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(!!window.mqtt?.connect); s.onerror = () => res(false); document.head.appendChild(s); });
  return probar('https://unpkg.com/mqtt@5/dist/mqtt.min.js').then((ok) => ok || probar('https://cdn.jsdelivr.net/npm/mqtt@5/dist/mqtt.min.js'));
}

export function crearRed(J, U) {
  const id = Math.random().toString(36).slice(2, 10);
  const R = { activa: false, id, sala: null, modo: null, cli: null, remotos: new Map(), tinkys: new Map(), tEnvio: 0, rol: 'victima' };
  const tema = (t) => NS + R.sala + '/' + t;
  const publicar = (t, o) => { if (R.cli?.connected) try { R.cli.publish(tema(t), JSON.stringify({ id, ...o }), { qos: 0 }); } catch { /* */ } };

  /* GameMenu / GameMenuVerses: el GUILayout de arriba a la izquierda (IP → código) */
  R.menu = (J2, i, g, modo) => {
    let hecho = false;
    const crear = (rol) => {
      if (hecho) return; hecho = true;
      U.red?.(null);
      const [p, q] = [J.posicion(i), J.S.O[i].getWorldQuaternion(new THREE.Quaternion())];
      if (rol === 'tinky') {
        const sp = J.idx(g.TinkySpawn);
        const base = J.instanciar(g.TinkyPrefab, sp != null ? J.posicion(sp) : p, sp != null ? J.S.O[sp].getWorldQuaternion(new THREE.Quaternion()) : q);
        if (base == null) return;
        J.ponerJugador(base); J.soyTinky = true; R.rol = 'tinky';
        const [pp, qq] = [J.posicion(i), q]; J.instanciar(g.NoFog, pp, qq);
        const cam = J.S.hijos[base].find((k) => J.S.N[k].n === 'Camera');
        for (const [c] of J.camOn) J.camOn.set(c, false);
        if (cam != null) { J.camaraOn(cam, true); const l = J.S.luces.find((x) => x.i === cam); if (l) l.on = true; }
      } else {
        const base = J.instanciar(g.PlayerPrefab, p, q);
        if (base == null) return;
        J.ponerJugador(base); J.soyTinky = false; R.rol = 'victima';
        const cam = J.S.hijos[base].find((k) => J.S.N[k].n === 'Camera');
        for (const [c] of J.camOn) J.camOn.set(c, false);
        if (cam != null) J.camaraOn(cam, true);
        // cooperativo: cada jugador que llega trae un Tinky (de la IA, que mueve su dueño)
        if (modo === 'coop' && g.TinkyPrefab) {
          const sp = J.idx(g.Tinkyspawn);
          const bt = J.instanciar(g.TinkyPrefab, sp != null ? J.posicion(sp) : p, sp != null ? J.S.O[sp].getWorldQuaternion(new THREE.Quaternion()) : q);
          if (bt != null) R.tinkys.set(id + ':0', { base: bt, mio: true });
        }
      }
      J.ui.alJugador?.();
    };
    return {
      start() {
        R.modo = modo;
        const host = modo === 'versus' ? 'hostTinky' : 'hostVictima';
        U.red?.({ modo, host, alHost: () => R.entrar(null, () => crear(modo === 'versus' ? 'tinky' : 'victima'), modo), alConectar: (cod) => R.entrar(cod, () => crear('victima'), modo), solo: () => crear(modo === 'versus' ? 'tinky' : 'victima') });
      },
      fin() { U.red?.(null); },
    };
  };

  /* entrar a una sala (sin código: se crea una) */
  R.entrar = async (codigo, listo, modo) => {
    const sala = codigo ? codigo.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
    if (sala.length !== 4) { U.redEstado?.('codigoMalo'); return; }
    U.redEstado?.('conectando');
    const ok = await cargarMqtt();
    if (!ok) { U.redEstado?.('sinRed'); return; }
    R.sala = sala + '_' + J.nivel; R.codigo = sala;
    try { R.cli = window.mqtt.connect(window.SLENDY_BROKER || BROKER, { clientId: NS + id, keepalive: 30, reconnectPeriod: 4000, connectTimeout: 9000, clean: true }); }
    catch { U.redEstado?.('sinRed'); return; }
    let primero = true;
    R.cli.on('connect', () => {
      R.cli.subscribe([tema('estado'), tema('evento'), tema('chat')], { qos: 0 });
      R.activa = true;
      if (primero) { primero = false; U.redEstado?.('enSala', sala); listo(true); }
    });
    R.cli.on('error', () => U.redEstado?.('sinRed'));
    R.cli.on('message', (t, m) => { let o; try { o = JSON.parse(m.toString()); } catch { return; } if (!o || o.id === id) return; recibir(t.slice(t.lastIndexOf('/') + 1), o); });
    setTimeout(() => { if (!R.activa) U.redEstado?.('sinRed'); }, 10000);
    void modo;
  };
  R.chatSistema = (sala) => U.chat?.({ sistema: true, t: sala });

  R.salir = () => {
    if (R.cli) { publicar('evento', { ev: 'chau' }); try { R.cli.end(true); } catch { /* */ } }
    R.cli = null; R.activa = false; R.sala = null; R.remotos.clear(); R.tinkys.clear(); J.soyTinky = false;
    U.chat?.(null);
  };

  /* Network.Instantiate: acá y en todos */
  R.instanciar = (ref, pos, quat) => {
    const b = J.instanciar(ref, pos, quat);
    if (ref?.prefab) publicar('evento', { ev: 'inst', pf: ref.prefab, p: pos.toArray(), q: quat ? quat.toArray() : null });
    return b;
  };
  R.destruir = (i) => J.destruir(i);
  R.chat = (texto) => publicar('chat', { t: String(texto).slice(0, 200) });

  /* lo que llega */
  function recibir(cual, o) {
    if (!J.S || J.cargando) return;
    if (cual === 'chat') { if (typeof o.t === 'string') U.chat?.({ t: o.t, mio: false }); return; }
    if (cual === 'evento') {
      if (o.ev === 'inst' && typeof o.pf === 'string' && J.R.C.prefabs[o.pf] && Array.isArray(o.p)) J.instanciar({ prefab: o.pf }, new THREE.Vector3().fromArray(o.p), o.q ? new THREE.Quaternion().fromArray(o.q) : null);
      if (o.ev === 'chau') quitar(o.id);
      return;
    }
    if (cual === 'estado') estado(o);
  }
  function estado(o) {
    if (!Array.isArray(o.p) || o.p.length !== 3 || !o.p.every(Number.isFinite)) return;
    let r = R.remotos.get(o.id);
    if (!r) {
      const pf = o.rol === 'tinky' ? J.prefabTinkyJugador : J.prefabJugador;
      if (!pf) return;
      const base = J.instanciar({ prefab: pf }, new THREE.Vector3().fromArray(o.p), new THREE.Quaternion(), { remoto: true });
      if (base == null) return;
      r = { base, cont: J.S.O[base].parent, rol: o.rol, p: new THREE.Vector3().fromArray(o.p), yaw: o.yaw || 0, t: J.t };
      R.remotos.set(o.id, r);
      // el muñeco remoto: sin cámaras ni controles; la linterna se ve como luz de la escena
      for (let k = base; k < J.S.N.length; k++) if (J.S.N[k].cam) J.camOn.set(k, false);
    }
    r.p.fromArray(o.p); r.yaw = +o.yaw || 0; r.t = J.t; r.mov = !!o.mov;
    if (o.col && typeof o.col === 'object' && JSON.stringify(o.col) !== r.col) { r.col = JSON.stringify(o.col); J.colores(r.base, o.col); }
    const lin = J.S.luces.find((l) => l.i > r.base && J.S.N[l.i].n === 'Spotlight' && J.dentroDe(l.i, r.base));
    if (lin) lin.on = !!o.lin;
    // los Tinky de la IA que mueve ese jugador
    for (const tk of Array.isArray(o.tk) ? o.tk.slice(0, 4) : []) {
      if (!Array.isArray(tk.p) || !tk.p.every(Number.isFinite)) continue;
      const k = o.id + ':' + tk.k;
      let t = R.tinkys.get(k);
      if (!t) {
        if (!J.prefabTinky) continue;
        const b = J.instanciar({ prefab: J.prefabTinky }, new THREE.Vector3().fromArray(tk.p), new THREE.Quaternion(), { ajeno: true });
        if (b == null) continue;
        t = { base: b, mio: false, p: new THREE.Vector3() }; R.tinkys.set(k, t);
      }
      t.p.fromArray(tk.p); t.yaw = +tk.yaw || 0; t.t = J.t;
    }
  }
  function quitar(otro) {
    const r = R.remotos.get(otro);
    if (r) { J.destruir(r.base); R.remotos.delete(otro); }
    for (const [k, t] of R.tinkys) if (k.startsWith(otro + ':')) { J.destruir(t.base); R.tinkys.delete(k); }
  }

  /* cada cuadro: mandar lo propio, acercar lo ajeno */
  R.update = (dt) => {
    if (!R.activa || !J.S) return;
    R.tEnvio += dt;
    if (R.tEnvio > 0.1 && J.jug) {
      R.tEnvio = 0;
      const p = J.jug.o.position;
      const lin = J.S.luces.find((l) => l.i === J.iLinterna);
      const tk = [...R.tinkys.values()].filter((t) => t.mio && J.vivo(t.base)).map((t, k) => { const o = J.S.O[t.base]; return { k, p: o.getWorldPosition(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)), yaw: +o.rotation.y.toFixed(3) }; });
      publicar('estado', { rol: R.rol, p: [p.x, p.y, p.z].map((x) => +x.toFixed(2)), yaw: +J.jug.yaw.toFixed(3), mov: !!J.jug.moviendo, lin: !!lin?.on, col: J.coloresMios || null, tk });
    }
    const k = Math.min(1, dt * 12);
    for (const [otro, r] of R.remotos) {
      if (J.t - r.t > 6 || !J.vivo(r.base)) { quitar(otro); continue; }
      r.cont.position.lerp(r.p, k);
      let d = r.yaw - r.cont.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      r.cont.rotation.set(0, r.cont.rotation.y + d * k, 0);
    }
    for (const [, t] of R.tinkys) if (!t.mio && J.vivo(t.base)) { const o = J.S.O[t.base]; o.position.lerp(t.p, k); o.rotation.set(0, t.yaw, 0); }
  };
  void GUIONES;
  return R;
}
