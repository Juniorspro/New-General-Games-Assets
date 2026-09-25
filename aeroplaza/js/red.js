/* ============================================================================
   aeroplaza/js/red.js — el multijugador, sin servidor propio.
   Un broker MQTT público hace de correo (wss://broker.emqx.io:8084/mqtt, el
   mismo recurso que usan los juegos H5 casuales). No hay anfitrión: cada
   cliente es dueño solo de su muñeco y le cuenta a la sala dónde está.
   - Todos los temas llevan el prefijo NS: otro juego nunca se cruza con este.
   - Salas: NS + nombre (p. ej. 'aeroplaza_v1_plaza-1'), con /state, /chat y
     /action. Son públicas y sin código: al entrar a un reino se elige sola la
     sala más llena que todavía tenga lugar (lo cuenta el tema del vestíbulo).
   - El estado va cada ~100 ms y solo si cambió algo (moverse, espuma, gesto);
     igual se manda un latido cada 1,5 s para que no nos den por idos (a los
     5 s sin noticias, un jugador se borra).
   - Los mensajes propios que vuelven del broker se ignoran (data.id === MY_ID).
   - Si el cliente MQTT no carga (sin internet) o no conecta, el juego sigue
     solo: la red es una capa encima, nunca la condición para jugar.
   ========================================================================== */
export const NS = 'aeroplaza_v1_';
export const BROKER = 'wss://broker.emqx.io:8084/mqtt';
export const MAX_SALA = 14;

export class Red {
  constructor({ id, nombre }) {
    this.id = id; this.nombre = nombre;
    this.estado = 'conectando';      // conectando | en_linea | sin_red
    this.sala = null; this.cli = null;
    this.alEstado = () => {}; this.alRemoto = () => {}; this.alChat = () => {}; this.alAccion = () => {}; this.alVestibulo = () => {}; this.alCasa = () => {};
    this.ultimo = null; this.tUltimo = 0; this.tLatido = 0;
    this.vestibulo = new Map();      // id → { sala, reino, nombre, casa, t }
    this.tPresencia = 0; this.reino = null;
    this.limite = new Map();         // id → [t0, cuenta] (para ignorar al que manda de más)
    this.desde = 0;
  }
  ponerEstado(e) { if (this.estado !== e) { this.estado = e; this.alEstado(e); } }

  /* ------------------------------------------------------------ conectar */
  conectar(url = BROKER) {
    const intentar = (vueltas) => {
      if (window.mqtt && window.mqtt.connect) return this._conectar(url);
      /* si unpkg no respondió en 4 s, se prueba la misma biblioteca desde jsDelivr */
      if (vueltas === 15 && !document.getElementById('mqtt-respaldo')) { const s = document.createElement('script'); s.id = 'mqtt-respaldo'; s.async = true; s.src = 'https://cdn.jsdelivr.net/npm/mqtt@5/dist/mqtt.min.js'; document.head.appendChild(s); }
      if (vueltas <= 0) { this.ponerEstado('sin_red'); return; }
      setTimeout(() => intentar(vueltas - 1), 400);
    };
    this.ponerEstado('conectando');
    intentar(25);   // el <script async> del cliente puede tardar unos segundos
  }
  _conectar(url) {
    try {
      this.cli = window.mqtt.connect(url, {
        clientId: NS + this.id + '_' + Math.random().toString(16).slice(2, 6),
        keepalive: 30, reconnectPeriod: 4000, connectTimeout: 9000, clean: true,
      });
    } catch (e) { console.warn('red: no conecta', e); this.ponerEstado('sin_red'); return; }
    const c = this.cli;
    c.on('connect', () => {
      this.ponerEstado('en_linea'); this.desde = performance.now();
      c.subscribe(NS + 'vestibulo', { qos: 0 });
      if (this.sala) this.suscribir(this.sala);
      if (this.casaMirada) c.subscribe(NS + 'casa/' + this.casaMirada, { qos: 0 });
      this.presencia(true);
    });
    c.on('reconnect', () => this.ponerEstado('conectando'));
    /* si nunca conectó y ya falló 4 veces (sin internet, o una página que no deja abrir WebSocket), se deja de insistir */
    let fallos = 0, alguna = false;
    c.on('connect', () => { alguna = true; });
    c.on('close', () => {
      if (!alguna && ++fallos >= 4) { try { c.end(true); } catch { /* nada */ } this.ponerEstado('sin_red'); return; }
      this.ponerEstado(this.cli && this.cli.reconnecting ? 'conectando' : 'sin_red');
    });
    c.on('offline', () => this.ponerEstado('sin_red'));
    c.on('error', (e) => { console.warn('red:', e && e.message); this.ponerEstado('sin_red'); });
    c.on('message', (tema, datos) => this.recibir(tema, datos));
  }
  get conectado() { return !!(this.cli && this.cli.connected); }

  /* ----------------------------------------------------------- las salas */
  suscribir(sala) { if (!this.conectado) return; const R = NS + sala; this.cli.subscribe([R + '/state', R + '/chat', R + '/action'], { qos: 0 }); }
  entrar(sala, reino) {
    if (this.sala && this.conectado) { const R = NS + this.sala; this.accion({ type: 'chau' }); this.cli.unsubscribe([R + '/state', R + '/chat', R + '/action']); }
    this.sala = sala; this.reino = reino; this.ultimo = null;
    this.suscribir(sala);
    this.presencia(true);
  }
  /* la sala pública de un reino: la más llena que todavía tenga lugar; si no, una nueva */
  elegirSala(reino) {
    const cuenta = new Map();
    for (const v of this.vestibulo.values()) if (v.reino === reino) cuenta.set(v.sala, (cuenta.get(v.sala) || 0) + 1);
    let mejor = null, n = -1;
    for (const [s, k] of cuenta) if (k < MAX_SALA && k > n) { mejor = s; n = k; }
    if (mejor) return mejor;
    for (let i = 1; i < 99; i++) if (!cuenta.has(reino + '-' + i)) return reino + '-' + i;
    return reino + '-1';
  }
  cuantosEn(reino) { let k = 0; for (const v of this.vestibulo.values()) if (!reino || v.reino === reino) k++; return k; }
  casasAbiertas() { return [...this.vestibulo.entries()].filter(([, v]) => v.casa).map(([id, v]) => ({ id, nombre: v.nombre, gente: [...this.vestibulo.values()].filter((q) => q.sala === 'casa-' + id).length })); }
  /* en el vestíbulo cada uno cuenta dónde está (cada 4 s); así se cuentan las salas */
  presencia(ya = false) {
    if (!this.conectado) return;
    const now = performance.now();
    if (!ya && now - this.tPresencia < 4000) return;
    this.tPresencia = now;
    this.publicar(NS + 'vestibulo', { id: this.id, name: this.nombre, sala: this.sala, reino: this.reino, casa: !!this.casaAbierta });
  }

  /* ---------------------------------------------------------- publicar */
  publicar(tema, o) { if (!this.conectado) return; try { this.cli.publish(tema, JSON.stringify(o), { qos: 0 }); } catch (e) { console.warn('red: publicar', e); } }
  /* s: { x, y, z, hp, facingAngle, isMoving, estado, gesto, esc, ... }. Se llama cada cuadro; decide acá si manda */
  publicarEstado(s, ahora = performance.now()) {
    this.presencia();
    if (!this.sala || !this.conectado) return;
    if (ahora - this.tUltimo < 100) return;
    const u = this.ultimo;
    const cambio = !u || Math.abs(u.x - s.x) + Math.abs(u.y - s.y) + Math.abs(u.z - s.z) > 0.02 || Math.abs(u.facingAngle - s.facingAngle) > 0.05 ||
      u.hp !== s.hp || u.estado !== s.estado || u.gesto !== s.gesto || u.av !== s.av || u.esc !== s.esc || u.ef !== s.ef || u.voz !== s.voz;
    if (!cambio && ahora - this.tLatido < 1500) return;
    this.tUltimo = ahora; this.tLatido = ahora;
    this.ultimo = { ...s };
    this.publicar(NS + this.sala + '/state', { id: this.id, name: this.nombre, ...s });
  }
  accion(o) { if (this.sala) this.publicar(NS + this.sala + '/action', { id: this.id, ...o }); }
  chat(texto) { const x = String(texto).trim().slice(0, 120); if (x && this.sala) this.publicar(NS + this.sala + '/chat', { id: this.id, name: this.nombre, text: x }); return x; }
  /* la casa: el plano queda guardado en el broker (retenido), así se puede visitar */
  publicarCasa(plano) { if (!this.conectado) return; try { this.cli.publish(NS + 'casa/' + this.id, JSON.stringify({ id: this.id, name: this.nombre, plano }), { qos: 0, retain: true }); } catch { /* nada */ } }
  mirarCasa(id) {
    if (this.casaMirada && this.conectado) this.cli.unsubscribe(NS + 'casa/' + this.casaMirada);
    this.casaMirada = id;
    if (id && this.conectado) this.cli.subscribe(NS + 'casa/' + id, { qos: 0 });
  }

  /* ---------------------------------------------------------- recibir */
  recibir(tema, datos) {
    let d;
    try { d = JSON.parse(datos.toString()); } catch { return; }
    if (!d || typeof d !== 'object' || d.id === this.id) return;   // lo propio, que vuelve
    if (typeof d.id !== 'string' || d.id.length > 40) return;
    /* nadie manda más de 40 mensajes por segundo */
    const ahora = performance.now(), L = this.limite.get(d.id) || [ahora, 0];
    if (ahora - L[0] > 1000) { L[0] = ahora; L[1] = 0; }
    if (++L[1] > 40) return;
    this.limite.set(d.id, L);
    if (tema === NS + 'vestibulo') {
      this.vestibulo.set(d.id, { sala: String(d.sala || ''), reino: String(d.reino || ''), nombre: String(d.name || '').slice(0, 20), casa: !!d.casa, t: ahora });
      this.alVestibulo(); return;
    }
    if (tema.startsWith(NS + 'casa/')) { this.alCasa(d); return; }
    if (!this.sala) return;
    const R = NS + this.sala;
    if (tema === R + '/state') this.alRemoto(d);
    else if (tema === R + '/chat') this.alChat({ id: d.id, name: String(d.name || '?').slice(0, 20), text: String(d.text || '').slice(0, 120) });
    else if (tema === R + '/action') this.alAccion(d);
  }
  /* se borra del vestíbulo quien no avisó en 12 s */
  limpiar() {
    const ahora = performance.now();
    let cambio = false;
    for (const [id, v] of this.vestibulo) if (ahora - v.t > 12000) { this.vestibulo.delete(id); cambio = true; }
    if (cambio) this.alVestibulo();
  }
}
