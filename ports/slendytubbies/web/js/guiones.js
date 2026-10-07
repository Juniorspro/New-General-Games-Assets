/* Los scripts de Slendytubbies V2 (UnityScript y C#, decompilados), uno por uno y con sus números.
   Cada uno es una fábrica (J, i, g) → { start, update, fin, onTriggerEnter, onTriggerExit, onMouseDown }:
   J es el juego (juego.js), i el nodo del script y g sus campos tal como estaban en la escena o el prefab.
   Network.Instantiate/Destroy/RPC pasan por J.red (red.js) cuando hay partida en red; si no, son locales. */
import * as THREE from 'three';

const nodo = (J, ref) => J.idx(ref);
const instanciarRed = (J, ref, pos, quat) => (J.red?.activa ? J.red.instanciar(ref, pos, quat) : J.instanciar(ref, pos, quat));
const texDe = (J, ref) => { const pf = ref?.prefab && J.R.C.prefabs[ref.prefab]; for (const n of pf?.nodos || []) for (const g of n.guiones || []) if (g.yourtexture?.tex) return g.yourtexture.tex; return null; };
const enMundo = (J, i) => { const o = J.S.O[i]; return [o.getWorldPosition(new THREE.Vector3()), o.getWorldQuaternion(new THREE.Quaternion())]; };

/* ---------- el menú: cada botón prende una cámara y apaga las otras */
const CAMARAS = ['CameraMenu', 'CameraSettings', 'CameraSingleplayer', 'CameraMultiplayer', 'CameraCoop', 'CameraVerses'];
const boton = (prende, antes) => (J, i, g) => ({
  onMouseDown() {
    antes?.(J, g, i);
    for (const c of CAMARAS) J.camaraOn(g[c], c === prende);
  },
});
const nivel = (n) => (J) => ({ onMouseDown() { J.cargarNivel(n); } });

export const GUIONES = {
  Back: boton('CameraMenu'),
  Backsettings: boton('CameraMenu', (J) => { for (const k of J.conTag('Settings')) J.destruir(k); }),
  'Multiplayerbutton#': boton('CameraMultiplayer'),
  'Singleplayerbutton#': boton('CameraSingleplayer'),
  'coopbutton#': boton('CameraCoop'),
  'versesbutton#': boton('CameraVerses'),
  Settings: boton('CameraSettings', (J, g, i) => { const [p, q] = enMundo(J, i); J.instanciar(g.settingsobject, p, q); }),
  coopday: nivel(1), coopdusk: nivel(2), coopnight: nivel(3),
  versesday: nivel(4), versesdusk: nivel(5), versesnight: nivel(6),
  singleplayerday: nivel(7), singleplayerdusk: nivel(8), singleplayernight: nivel(9),
  createonclick: (J, i, g) => ({ onMouseDown() { const [p, q] = enMundo(J, i); J.instanciar(g.spawn, p, q); } }),
  'Exitcredits&help': (J) => ({ update() { if (J.teclaAbajo('Space')) for (const k of J.conTag('Creditsandhelp')) J.destruir(k); } }),
  // Application.Quit: en el navegador no se cierra la página; Escape abre la pausa (main.js)
  Gamequit: () => ({}),
  setqualitylevel: (J) => ({ start() { J.ui.calidadUnity?.(true); }, fin() { J.ui.calidadUnity?.(false); } }),
  Returntomainmenu: (J) => ({ start() { J.ui.botonVolver?.(true); }, fin() { J.ui.botonVolver?.(false); } }),

  /* ---------- GUI.DrawTexture a pantalla completa (y el sonido del susto) */
  'Popup gui script': (J, i, g) => {
    let img = null;
    const clip = g.popupsound?.audio;
    return {
      start() { img = J.imagen(i, g.yourtexture?.tex); },
      update() { if (clip && !J.sonando(i)) { const f = J.fuente(i); if (f) J.reproducir(f, clip); } },
      fin() { if (img) J.sacarImagen(img); },
    };
  },
  map: (J, i, g) => {
    let img = null;
    return {
      start() { img = J.imagen(i, g.yourtexture?.tex); },
      update() { if (J.teclaArriba('KeyM')) J.destruir(nodo(J, g.objecttodestroy) ?? i); },
      fin() { if (img) J.sacarImagen(img); },
    };
  },
  destoryaftertimer: (J, i, g) => { J.destruir(i, g.timeOut ?? 1); return {}; },
  'disconnect&end': (J, i, g) => { J.destruir(i, g.timeOut ?? 5); return {}; },
  'disconnect&endwon': (J, i, g) => { J.invocar(() => { J.red?.salir(); J.cargarNivel(10); }, g.timeOut ?? 5); return {}; },

  /* los sustos al azar: cada 30 a 200 segundos, una de las 6 imágenes un instante */
  Popups: (J, i, g) => {
    const st = { timer: 0, spawning: false };
    const spawn = async () => {
      st.spawning = true; st.timer = 0;
      const pick = 1 + Math.floor(Math.random() * 6);
      await J.esperar(30 + Math.floor(Math.random() * 170));
      const lugar = g['spawn' + pick];
      const sp = nodo(J, g.spawnpoint) ?? i;
      const [p, q] = enMundo(J, sp);
      instanciarRed(J, lugar, p, q);
      await J.esperar(1);
      st.spawning = false;
    };
    return { update(dt) { if (!st.spawning) st.timer += dt; if (st.timer >= 2) spawn().catch(J.cancelada); } };
  },

  /* ---------- la partida */
  GameMenusingleplayer: (J, i, g) => ({
    start() {
      J.prefabJugador = g.PlayerPrefab?.prefab; // Network.InitializeServer → OnServerInitialized → CreatePlayer
      const [p, q] = enMundo(J, i);
      const base = J.instanciar(g.PlayerPrefab, p, q);
      if (base == null) return;
      J.ponerJugador(base);
      const iCam = J.S.hijos[base].find((k) => J.S.N[k].n === 'Camera');
      for (const [c] of J.camOn) J.camOn.set(c, false);
      if (iCam != null) J.camaraOn(iCam, true);
      J.ui.alJugador?.();
    },
  }),
  GameMenu: (J, i, g) => { J.prefabJugador = g.PlayerPrefab?.prefab; J.prefabTinky = g.TinkyPrefab?.prefab; return J.red ? J.red.menu(J, i, g, 'coop') : GUIONES.GameMenusingleplayer(J, i, g); },
  GameMenuVerses: (J, i, g) => { J.prefabJugador = g.PlayerPrefab?.prefab; J.prefabTinkyJugador = g.TinkyPrefab?.prefab; return J.red ? J.red.menu(J, i, g, 'versus') : GUIONES.GameMenusingleplayer(J, i, g); },
  Chat: (J) => ({ start() { J.ui.chatBoton?.(true); }, update() { if (J.teclaAbajo('KeyT')) J.ui.chatAbrir?.(); }, fin() { J.ui.chatBoton?.(false); } }),
  'Begin game': (J, i) => ({
    start() { J.ui.empezar?.(true); },
    update() { if (J.teclaAbajo('KeyE')) J.destruir(i); },
    fin() { if (!J.instancias.some((x) => x.nombre === 'Begin game' && !x.muerta && x.i !== i)) J.ui.empezar?.(false); },
  }),
  'crouch and run': (J, i, g) => ({
    update() {
      const jg = J.jug; if (!jg || J.iJug !== i) return;
      let to = 1, vel = g.walkSpeed ?? 7;
      if ((jg.est.suelo && J.tecla('ShiftLeft')) || J.tecla('ShiftRight')) vel = g.runSpeed ?? 12;
      if (J.tecla('KeyC')) { to = 0.5; vel = g.crchSpeed ?? 3; }
      jg.velAdelante = vel; jg.agachar = to;
    },
  }),
  flashlight: (J, i, g) => {
    const luz = nodo(J, g.myLight);
    if (luz == null || !J.esMio(i)) return {}; // (el de la luz puntual no tiene luz: en el original tira error)
    J.iLinterna = luz;
    const L = () => J.S.luces.find((x) => x.i === luz);
    const cambiar = () => { const l = L(); if (l) l.on = !l.on; if (g.switchsound?.audio) J.unaVez(i, g.switchsound.audio); J.red?.estado?.({ linterna: L()?.on }); };
    return { update() { if (J.teclaAbajo('KeyF') || J.teclaAbajo('Mouse1')) cambiar(); } };
  },
  playerwalkingsound: (J, i, g) => {
    // el original arranca el loop al apretar W/A/S/D o flechas y lo corta al soltar cualquiera; acá, mientras camina
    const clip = g.walkingsound?.audio;
    return {
      update() {
        const jg = J.jug; if (!jg || !clip || J.iJug !== i) return;
        const f = J.fuente(i); if (!f) return;
        const anda = jg.moviendo && jg.est.suelo;
        if (anda && !f.h?.tocando) { f.def = { ...f.def, loop: true }; J.reproducir(f, clip); }
        else if (!anda && f.h?.tocando) J.parar(i);
      },
    };
  },
  CollectPapers: (J, i, g) => {
    const st = { Paper: g.Paper ?? 0, paperToWin: g.paperToWin ?? 10 };
    J.papeles = st;
    return {
      onTriggerEnter(otro) {
        if (J.S.N[otro]?.tag === 'Paper') { st.Paper++; J.red?.activa ? J.red.destruir(otro) : J.destruir(otro); J.ui.papeles?.(st.Paper, st.paperToWin); }
        const [p, q] = enMundo(J, i);
        if (st.Paper === st.paperToWin) instanciarRed(J, g.allpapersobj, p, q);
        if (st.Paper >= 1 && st.Paper <= 9) instanciarRed(J, g['winobj' + st.Paper], p, q);
      },
    };
  },
  collectsoundscript: (J, i, g) => ({
    onTriggerEnter() { const sp = nodo(J, g.spawnpoint) ?? i; const [p, q] = enMundo(J, sp); J.instanciar(g.collect, p, q); },
    onTriggerExit() { J.destruir(i); },
  }),
  checkcustards: (J, i) => ({ update() { if (J.conTag('Paper').length === 10) J.destruir(i); } }),
  mappopup: (J, i, g) => ({ update() { if (J.teclaAbajo('KeyM') && J.iJug === i) { const [p, q] = enMundo(J, i); J.instanciar(g.ifseesobject, p, q); } } }),
  spawnvictumgui: (J, i, g) => ({ start() { const [p, q] = enMundo(J, i); J.instanciar(g.helpless, p, q); } }),
  spawnslendysgui: (J, i, g) => ({ start() { const [p, q] = enMundo(J, i); J.instanciar(g.guis, p, q); J.instanciar(g.protect, p, q); } }),
  ChangeTextures: (J, i) => ({ start() { if (J.iJug === i) J.ui.personalizar?.(true, (c) => { J.colores(i, c); J.coloresMios = c; }); }, fin() { if (J.iJug === i || J.iJug < 0) J.ui.personalizar?.(false); } }),
  // (el original lo da vuelta dos veces en la compu del Tinky —el prefab y NoFog— y lo apaga en las de las víctimas
  // cuando aparece el Tinky: queda la intención, el Tinky ve sin niebla)
  Tinkyvision: (J, i) => ({ start() { if (J.esMio(i)) J.sinNiebla = true; } }),
  Tinkypopupcontrol: (J, i, g) => ({ update() { if (J.esMio?.(i) !== false && J.teclaAbajo('KeyN')) { const [p, q] = enMundo(J, i); instanciarRed(J, g.popup1, p, q); } } }),

  /* puertas, árboles que caen y el susto de Laa-Laa: al entrar se anima; al salir, el disparador se borra */
  DoorOpen: (J, i, g) => ({
    onTriggerEnter() { J.estaticos.leverswitch = g.trigger; J.animar(nodo(J, g.animated), 'Take 001'); },
    onTriggerExit() { J.destruir(i); },
  }),
  triggertree: (J, i, g) => ({
    onTriggerEnter() { J.animar(nodo(J, g.animated), 'fall'); if (g.fallsound?.audio) J.unaVez(i, g.fallsound.audio); },
    onTriggerExit() { J.destruir(i); },
  }),
  lalascare: (J, i, g) => ({
    onTriggerEnter() { const a = nodo(J, g.animated); J.animar(a, 'scare2'); if (g.fallsound?.audio) J.unaVez(a, g.fallsound.audio); },
    onTriggerExit() { J.destruir(i); },
  }),

  /* Noo-Noo, la aspiradora: acelera hacia el punto, frena al tocarlo, espera y sigue con el próximo */
  hooverscript: (J, i, g) => {
    const st = { vel: 0, estado: 0, idx: 0, frenando: false };
    const wps = (g.waypoints || []).map((w) => nodo(J, w)).filter((w) => w != null);
    const o = J.S.O[i];
    let alto = null;
    const v = new THREE.Vector3(), q = new THREE.Quaternion(), m = new THREE.Matrix4();
    return {
      update(dt) {
        if (!wps.length) return;
        const wp = J.S.O[wps[st.idx]];
        if (alto == null) alto = Math.max(0, o.position.y - J.alturaTerreno(o.position.x, o.position.z));
        if (st.estado === 0) {
          const destino = wp.getWorldPosition(v);
          m.lookAt(destino, o.position, new THREE.Vector3(0, 1, 0)); q.setFromRotationMatrix(m);
          o.quaternion.slerp(q, Math.min(1, dt * (g.rotationDamping ?? 6)));
          st.vel = Math.min(g.speedLimit ?? 10, st.vel + (g.accel ?? 0.8) ** 2);
        } else {
          st.vel *= g.inertia ?? 0.9;
          if (st.vel <= (g.minSpeed ?? 1)) { st.vel = 0; if (!st.frenando) { st.frenando = true; J.invocar(() => { st.estado = 0; st.frenando = false; }, g.stopTime ?? 1); } }
        }
        o.translateZ(-dt * st.vel);
        const h = J.alturaTerreno(o.position.x, o.position.z);
        if (Number.isFinite(h)) o.position.y = h + alto;
        // OnTriggerEnter: la aspiradora entra al disparador del punto
        const p = o.getWorldPosition(v);
        const d = J.S.disparadores.find((x) => x.i === wps[st.idx]);
        const llego = d ? J.fisica.adentro(d, p, 0.5) : p.distanceTo(wp.getWorldPosition(new THREE.Vector3())) < 1.5;
        if (llego && st.estado === 0) { st.estado = 1; st.idx = (st.idx + 1) % wps.length; }
      },
    };
  },

  /* ---------- versus: el Tinky lo maneja un jugador; a la víctima que lo mira de cerca la atrapan */
  EnemyScriptPlayer: (J, i, g) => {
    if (J.esMio(i)) return {}; // (en la compu del Tinky no hay a quién mirar: corre en las víctimas)
    return GUIONES.EnemyScript(J, i, { ...g, quieto: true });
  },

  /* ---------- el Tinky Winky: avanza si no lo mirás o si está lejos; si lo mirás de cerca, te mata */
  EnemyScript: (J, i, g) => {
    const st = { vel: g.speed ?? 5, health: g.health ?? 100, terminado: false };
    const o = J.S.O[i];
    let alto = null, img = null;
    const yo = new THREE.Vector3(), el = new THREE.Vector3(), fw = new THREE.Vector3(), dir = new THREE.Vector3();
    const muerto = async () => {
      st.terminado = true;
      const [p, q] = enMundo(J, i);
      instanciarRed(J, g.endgamepopup, p, q);
      if (!J.red?.activa) o.visible = false;
      J.ui.atrapado?.();
      await J.esperar(2.2); // (en el original la escena cambia en el mismo cuadro; un instante para que se vea)
      J.red?.salir();
      J.cargarNivel(0);
    };
    return {
      estado: st,
      update(dt) {
        if (st.terminado || !J.jug) return;
        const jg = J.jug;
        jg.o.getWorldPosition(yo); o.getWorldPosition(el);
        if (alto == null) alto = Math.max(0, el.y - J.alturaTerreno(el.x, el.z));
        fw.set(-Math.sin(jg.yaw), 0, -Math.cos(jg.yaw)); // thePlayer.forward: el cuerpo (la cámara sube y baja aparte)
        dir.subVectors(el, yo).normalize();
        const punto = fw.dot(dir);
        const d2 = el.distanceToSquared(yo);
        const enRango = d2 < (g.maxVisibleDistance ?? 10) ** 2;
        const mover = () => {
          if (J.tinkyAjeno.has(i) || g.quieto) return; // (lo mueve su dueño: llega por la red)
          const papeles = J.conTag('Paper').length;
          if (papeles === 5) st.vel = g.runspeed ?? 7;
          if (papeles === 2) st.vel = g.sprintspeed ?? 12;
          if (d2 < (g.followDistance ?? 3) ** 2) { mirar(); return; }
          mirar();
          const paso = st.vel * dt, dx = yo.x - el.x, dz = yo.z - el.z, l = Math.hypot(dx, dz) || 1;
          o.position.x += dx / l * paso; o.position.z += dz / l * paso;
          const h = J.alturaTerreno(o.position.x, o.position.z);
          if (Number.isFinite(h)) o.position.y = h + alto;
        };
        const mirar = () => { if (!g.quieto && !J.tinkyAjeno.has(i)) o.rotation.set(0, Math.atan2(-(yo.x - el.x), -(yo.z - el.z)), 0); };
        if (punto < (g.offscreenDotRange ?? 0.7)) { if (img) { J.sacarImagen(img); img = null; } mover(); return; }
        let visible = false;
        if (punto > (g.visibleDotRange ?? 0.8) && enRango) visible = !J.fisica.rayo(el.clone().setY(el.y + 1), yo.clone().setY(yo.y + 1));
        if (!visible && img) { J.sacarImagen(img); img = null; }
        if (visible) {
          st.health -= (g.damage ?? 20) * dt;
          // (el original crea un IffSeeObject por cuadro que vive 0,01 s: la imagen queda fija mientras lo mirás)
          if (!img) img = J.imagen(i, texDe(J, g.ifseesobject));
          if (g.nearbyaudio?.audio && !J.sonando(i)) { const f = J.fuente(i); if (f) J.reproducir(f, g.nearbyaudio.audio); }
          mirar();
          if (st.health <= 0) muerto().catch(J.cancelada);
          return;
        }
        if (!enRango) mover(); else mirar();
      },
    };
  },
};
