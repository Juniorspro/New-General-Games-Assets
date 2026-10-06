/* El "mundo" de Unreal sobre three.js: actores y componentes como UObj de la VM, jugador, cámara,
   entrada, ticks, latentes y temporizadores. Los métodos nativos están en nat/motor.js. */
import * as THREE from 'three';
import { VM, UObj, Clase, copiar, valorDefecto } from './vm.js';
import { LIBS, Timers, V } from './nat/libs.js';
import { pUE, pT, qUE, qT, sT, rotT, rotUE, mundoUE, ponerMundo } from './conv.js';
import { armarNivel } from './ue.js';
import { Luces } from './luces.js';
import { NATIVOS, METODOS, PROPS, iniciarComponente } from './nat/motor.js';

/* Herencia de clases nativas (para casts y búsqueda de métodos) */
export const PADRE = {
  Actor: 'Object', Pawn: 'Actor', Character: 'Pawn', DefaultPawn: 'Pawn', SpectatorPawn: 'DefaultPawn', Controller: 'Actor', PlayerController: 'Controller', AIController: 'Controller',
  PlayerCameraManager: 'Actor', Info: 'Actor', GameModeBase: 'Info', GameMode: 'GameModeBase', GameStateBase: 'Info', GameState: 'GameStateBase', WorldSettings: 'Info',
  LevelScriptActor: 'Actor', StaticMeshActor: 'Actor', SkeletalMeshActor: 'Actor', CameraActor: 'Actor', CineCameraActor: 'CameraActor', MatineeActor: 'Actor',
  AmbientSound: 'Actor', Light: 'Actor', PointLight: 'Light', SpotLight: 'Light', DirectionalLight: 'Light', SkyLight: 'Info', Emitter: 'Actor', TargetPoint: 'Actor',
  Brush: 'Actor', Volume: 'Brush', TriggerVolume: 'Volume', PostProcessVolume: 'Volume', AudioVolume: 'Volume', BlockingVolume: 'Volume', TriggerBase: 'Actor', TriggerBox: 'TriggerBase',
  TriggerSphere: 'TriggerBase', TriggerCapsule: 'TriggerBase', DecalActor: 'Actor', LevelSequenceActor: 'Actor', PlayerStart: 'Actor', ExponentialHeightFog: 'Info', HUD: 'Actor',
  NavigationData: 'Actor', RecastNavMesh: 'NavigationData', AbstractNavData: 'NavigationData', ReflectionCapture: 'Actor', BoxReflectionCapture: 'ReflectionCapture',
  ActorComponent: 'Object', SceneComponent: 'ActorComponent', PrimitiveComponent: 'SceneComponent', MeshComponent: 'PrimitiveComponent', StaticMeshComponent: 'MeshComponent',
  InstancedStaticMeshComponent: 'StaticMeshComponent', HierarchicalInstancedStaticMeshComponent: 'InstancedStaticMeshComponent', FoliageInstancedStaticMeshComponent: 'HierarchicalInstancedStaticMeshComponent',
  SkinnedMeshComponent: 'MeshComponent', SkeletalMeshComponent: 'SkinnedMeshComponent', PoseableMeshComponent: 'SkinnedMeshComponent', ShapeComponent: 'PrimitiveComponent', BoxComponent: 'ShapeComponent',
  SphereComponent: 'ShapeComponent', CapsuleComponent: 'ShapeComponent', BrushComponent: 'PrimitiveComponent', ModelComponent: 'PrimitiveComponent',
  LightComponentBase: 'SceneComponent', LightComponent: 'LightComponentBase', LocalLightComponent: 'LightComponent', PointLightComponent: 'LocalLightComponent',
  SpotLightComponent: 'PointLightComponent', DirectionalLightComponent: 'LightComponent', SkyLightComponent: 'LightComponentBase', AudioComponent: 'SceneComponent',
  CameraComponent: 'SceneComponent', CineCameraComponent: 'CameraComponent', TextRenderComponent: 'PrimitiveComponent', ParticleSystemComponent: 'PrimitiveComponent',
  BillboardComponent: 'PrimitiveComponent', MaterialBillboardComponent: 'PrimitiveComponent', ArrowComponent: 'PrimitiveComponent', DecalComponent: 'SceneComponent',
  SpringArmComponent: 'SceneComponent', WidgetComponent: 'MeshComponent', PostProcessComponent: 'SceneComponent', ExponentialHeightFogComponent: 'SceneComponent',
  SceneCaptureComponent2D: 'SceneComponent', ChildActorComponent: 'SceneComponent', MovementComponent: 'ActorComponent', PawnMovementComponent: 'MovementComponent',
  CharacterMovementComponent: 'PawnMovementComponent', FloatingPawnMovement: 'PawnMovementComponent', RotatingMovementComponent: 'MovementComponent', TimelineComponent: 'ActorComponent',
  InputComponent: 'ActorComponent', ReflectionCaptureComponent: 'SceneComponent', BoxReflectionCaptureComponent: 'ReflectionCaptureComponent', PhysicsConstraintComponent: 'SceneComponent',
  Visual: 'Object', Widget: 'Visual', UserWidget: 'Widget', PanelWidget: 'Widget', ContentWidget: 'PanelWidget', CanvasPanel: 'PanelWidget', Overlay: 'PanelWidget', VerticalBox: 'PanelWidget',
  HorizontalBox: 'PanelWidget', ScrollBox: 'PanelWidget', UniformGridPanel: 'PanelWidget', GridPanel: 'PanelWidget', WrapBox: 'PanelWidget', WidgetSwitcher: 'PanelWidget',
  Border: 'ContentWidget', Button: 'ContentWidget', SizeBox: 'ContentWidget', ScaleBox: 'ContentWidget', BackgroundBlur: 'ContentWidget', CheckBox: 'ContentWidget',
  Image: 'Widget', TextLayoutWidget: 'Widget', TextBlock: 'TextLayoutWidget', RichTextBlock: 'TextLayoutWidget', ProgressBar: 'Widget', Slider: 'Widget', Spacer: 'Widget', Throbber: 'Widget',
  EditableText: 'Widget', EditableTextBox: 'Widget', ComboBoxString: 'Widget',
  MaterialInterface: 'Object', Material: 'MaterialInterface', MaterialInstance: 'MaterialInterface', MaterialInstanceConstant: 'MaterialInstance', MaterialInstanceDynamic: 'MaterialInstance',
  SoundBase: 'Object', SoundWave: 'SoundBase', SoundCue: 'SoundBase', SaveGame: 'Object', Texture: 'Object', Texture2D: 'Texture', TextureRenderTarget2D: 'Texture',
  AnimationAsset: 'Object', AnimSequenceBase: 'AnimationAsset', AnimSequence: 'AnimSequenceBase', AnimMontage: 'AnimSequenceBase', AnimInstance: 'Object',
  CameraShake: 'Object', MovieSceneSequencePlayer: 'Object', LevelSequencePlayer: 'MovieSceneSequencePlayer', LevelSequence: 'Object',
};
export function natHereda(nat, n) { for (let c = nat; c; c = PADRE[c]) if (c === n) return true; return n === 'Object'; }
/* Componente por defecto que cada actor nativo expone como propiedad */
const COMP_DE_ACTOR = {
  StaticMeshComponent: 'StaticMeshComponent', SkeletalMeshComponent: 'SkeletalMeshComponent', LightComponent: 'LightComponent', PointLightComponent: 'PointLightComponent',
  SpotLightComponent: 'SpotLightComponent', AudioComponent: 'AudioComponent', CameraComponent: 'CameraComponent', ParticleSystemComponent: 'ParticleSystemComponent',
  Mesh: 'SkeletalMeshComponent', CapsuleComponent: 'CapsuleComponent', CollisionComponent: 'ShapeComponent', TextRender: 'TextRenderComponent', Decal: 'DecalComponent',
  BrushComponent: 'BrushComponent', SkyLightComponent: 'SkyLightComponent', Component: 'ExponentialHeightFogComponent', SpriteComponent: 'BillboardComponent',
};

export class Mundo {
  constructor(o) {
    Object.assign(this, o); // renderer, R (Recursos), escena, camara, audio, ui, textos, guardado, base
    this.vm = new VM({ cargar: (n) => this.cargarClase(n), nativos: { ...LIBS, ...NATIVOS }, mundo: this, log: o.log });
    this.timers = new Timers(this.vm);
    this.actores = []; this.porNombre = new Map(); this.assets = new Map(); this.pausado = false;
    this.tiempo = 0; this.dilatacion = 1; this.ejes = {}; this.teclasApretadas = new Set();
    this.luces = new Luces(this.escena, o.nPuntos ?? 4, o.nFocos ?? 3);
    this.clasesJson = new Map();
  }
  async cargarClase(n) {
    if (this.clasesJson.has(n)) return this.clasesJson.get(n);
    try { const r = await fetch(this.base + 'c/' + n + '.json'); if (!r.ok) return null; const j = await r.json(); this.clasesJson.set(n, j); return j; } catch { return null; }
  }
  naturalHereda(nat, n) { return natHereda(nat, n); }
  log(...a) { console.warn('[mundo]', ...a); }
  depurar(...a) { if (this.verbose) console.log('[bp]', ...a); }
  texto(src, key) { return this.textos ? this.textos(src, key) : src; }
  set textosFn(f) { this.textos = f; }
  /* ---------------- valores ---------------- */
  asset(ruta, tipo) {
    if (!ruta) return null;
    let a = this.assets.get(ruta);
    if (!a) { a = { __ref: true, asset: ruta, nat: tipo || 'Object', nombre: ruta.split('.').pop(), id: 'a:' + ruta }; this.assets.set(ruta, a); }
    if (tipo && a.nat === 'Object') a.nat = tipo;
    return a;
  }
  claseNativa(n) { return { __ref: true, nativa: n, nat: n, n, esClase: true, id: 'n:' + n }; }
  resolverValor(v, ctx) {
    if (v === null || v === undefined || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map((x) => this.resolverValor(x, ctx));
    if (v.__ref) return v;
    if ('actor' in v && Object.keys(v).length === 1) return typeof v.actor === 'number' ? (this.indice?.[v.actor] || null) : (this.porNombre.get(v.actor) || null);
    if ('nodo' in v && Object.keys(v).length === 1) return this.comps?.[v.nodo] || null;
    if ('clase' in v && Object.keys(v).length === 1) return this.vm.claseSync(v.clase);
    if ('nat' in v && v.tipo !== undefined) {
      if (v.tipo === 'Class' || v.tipo === 'ScriptStruct') return this.claseNativa(v.nat);
      return { __ref: true, lib: v.nat, nat: v.nat, id: 'l:' + v.nat };
    }
    if ('asset' in v && v.tipo !== undefined) {
      // subobjeto por defecto del CDO (componente propio de la instancia)
      if (ctx?.actor && ctx.paquetes?.some((p) => v.asset.startsWith(p + '.'))) {
        const n = v.asset.split('.').pop(); const c = ctx.actor.comps.find((x) => x.nombre === n);
        if (c) return c;
      }
      if (/Component$|^CharacterMovement/.test(v.tipo || '') && ctx?.actor) { const n = v.asset.split('.').pop(); const c = ctx.actor.comps.find((x) => x.nombre === n); if (c) return c; }
      if (v.tipo === 'BlueprintGeneratedClass' || v.tipo === 'WidgetBlueprintGeneratedClass') return this.vm.claseSync(v.asset.split('.').pop()) || null;
      if (v.tipo.endsWith('_C') && v.asset.endsWith('.' + v.tipo)) return this.vm.claseSync(v.tipo) || null;
      return this.asset(v.asset, v.tipo);
    }
    if (Array.isArray(v.InvocationList)) return v.InvocationList.map((d) => ({ __ref: true, obj: this.resolverValor(d.Object, ctx), fn: d.FunctionName })).filter((d) => d.obj);
    if ('soft' in v) { const p = v.soft.replace(/^\/Game\//, 'TJoC_SM/Content/'); return this.asset(p + '.' + p.split('/').pop()); }
    if ('export' in v) return null;
    const o = {}; for (const k in v) o[k] = this.resolverValor(v[k], ctx); return o;
  }
  /* ---------------- propiedades ---------------- */
  leer(o, n) {
    if (o == null) return undefined;
    if (o.v && n in o.v) return o.v[n];
    for (let c = o.nat; c; c = PADRE[c]) { const g = PROPS[c]?.[n]; if (g) return g.get ? g.get(o, this) : g(o, this); }
    if (o.comps) {
      const c = o.comps.find((x) => x.nombre === n); if (c) return c;
      const t = COMP_DE_ACTOR[n]; if (t) { const c2 = o.comps.find((x) => natHereda(x.nat, t)); if (c2) return c2; }
    }
    if (o.widgets && o.widgets.has(n)) return o.widgets.get(n);
    if (o.v) { this.vm.falta('prop ' + o.nat + '.' + n); }
    return undefined;
  }
  escribir(o, n, v) {
    if (o == null) return;
    for (let c = o.nat; c; c = PADRE[c]) { const g = PROPS[c]?.[n]; if (g && g.set) { g.set(o, v, this); return; } }
    if (o.v) o.v[n] = v;
  }
  metodo(o, n) {
    if (!o) return null;
    for (let c = o.nat; c; c = PADRE[c]) { const m = METODOS[c]?.[n]; if (m) return (obj, vals, refs, F) => m.call(this, obj, vals, refs, F); }
    if (o.lib) { const f = NATIVOS[o.lib + ':' + n]; if (f) return (obj, vals, refs, F) => f(obj, vals, refs, F, this.vm); }
    return null;
  }
  /* ---------------- actores y componentes ---------------- */
  nuevoActor(nat, clase, nombre) {
    const a = new UObj(clase, clase ? clase.nativa : nat);
    if (!clase) a.nat = nat;
    a.nombre = nombre || (clase?.n || nat) + '_' + a.id; a.comps = []; a.tags = []; a.esActor = true; a.mundo = this;
    a.tickActivo = true; a.input = false;
    return a;
  }
  nuevoComp(actor, nat, nombre, o3) {
    const c = new UObj(null, nat); c.nombre = nombre; c.actor = actor; c.o3 = o3 || new THREE.Object3D(); c.esComp = true;
    c.o3.userData.comp = c; c.vis = true; c.ocultoJuego = false; c.activo = true;
    actor.comps.push(c);
    return c;
  }
  registrar(a) {
    this.actores.push(a);
    if (!this.porNombre.has(a.nombre)) this.porNombre.set(a.nombre, a);
  }
  /* Carga un nivel completo (geometría + actores + clases) y arranca el juego. */
  async cargarNivel(nombre, opciones = {}) {
    this.descargar();
    this.nombreNivel = nombre;
    const N = await (await fetch(this.base + 'n/' + nombre + '.json')).json();
    this.N = N;
    // clases necesarias
    const nombresClase = new Set([nombre + '_C']);
    for (const a of N.actores) if (a.clase?.endsWith('_C')) nombresClase.add(a.clase);
    for (const c of N.clases || []) nombresClase.add(c);
    await this.vm.precargar([...nombresClase]);
    // actores que los guiones tocan: no se juntan en la geometría estática
    const tocados = new Set();
    const lsc = this.vm.claseSync(nombre + '_C');
    const refs = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(refs); if (typeof x.actor === 'string') { const i = N.actores.findIndex((a) => a.n === x.actor); if (i >= 0) tocados.add(i); } if (typeof x.actor === 'number') tocados.add(x.actor); for (const k in x) refs(x[k]); };
    refs(lsc?.j.cdo);
    N.actores.forEach((a, i) => { if (a.clase?.endsWith('_C') || a.matinee || a.clase === 'SkeletalMeshActor' || a.clase === 'Emitter') tocados.add(i); refs(a.props); refs(a.matinee); });
    this.nivel = await armarNivel(this.R, N, { tocados, lm: this.lm ?? 4 * Math.PI });
    this.escena.add(this.nivel.raiz);
    // UObj por actor y por componente
    this.indice = []; this.comps = [];
    N.actores.forEach((ad, i) => {
      const clase = ad.clase?.endsWith('_C') ? this.vm.claseSync(ad.clase) : null;
      const a = this.nuevoActor(ad.nativa || ad.clase, clase, ad.n);
      if (!clase) a.nat = ad.clase;
      a.datos = ad; a.tags = ad.tags || []; a.ocultoJuego = !!ad.oculto;
      this.indice[i] = a;
    });
    N.nodos.forEach((nd, i) => {
      const a = this.indice[nd.a]; const o3 = this.nivel.nodos[i];
      const c = this.nuevoComp(a, nd.tipo, nd.n, o3); c.nodo = nd; c.malla = o3.userData.malla || null;
      c.vis = nd.vis !== false; c.ocultoJuego = !!nd.oculto;
      this.comps[i] = c;
    });
    N.actores.forEach((ad, i) => { const a = this.indice[i]; a.raiz = ad.raiz !== undefined ? this.comps[ad.raiz] : a.comps[0] || null; if (!a.raiz) { const c = this.nuevoComp(a, 'SceneComponent', 'Raiz'); this.nivel.raiz.add(c.o3); a.raiz = c; } });
    for (const c of this.comps) if (c) iniciarComponente(this, c);
    for (const l of this.nivel.luces) { const c = this.comps[l.i]; if (c) { c.luz = l; l.comp = c; } }
    this.luces.usar(this.nivel.luces);
    // variables de los Blueprints (defecto de la clase + lo que pisa la instancia)
    N.actores.forEach((ad, i) => { const a = this.indice[i]; if (!this.porNombre.has(a.nombre)) this.porNombre.set(a.nombre, a); });
    N.actores.forEach((ad, i) => {
      const a = this.indice[i];
      if (a.clase) {
        const ctx = { actor: a, paquetes: a.clase.cadena().map((n) => this.vm.claseSync(n)?.j.paquete).filter(Boolean) };
        this.vm.iniciarVars(a, a.clase, (v) => this.resolverValor(v, ctx));
        this.varsDeComps(a);
        for (const [k, v] of Object.entries(ad.props || {})) a.v[k] = this.resolverValor(v, ctx);
        this.prepararTimelines(a);
      } else for (const [k, v] of Object.entries(ad.props || {})) a.v[k] = this.resolverValor(v, { actor: a });
      this.actores.push(a);
    });
    for (const a of this.actores) if (a.datos?.matinee) a.matinee = this.crearMatinee(a, a.datos.matinee);
    // juego: GameMode, controlador, cámara, peón
    await this.armarJugador(N);
    if (opciones.antesDeEmpezar) await opciones.antesDeEmpezar(this);
    this.empezar();
  }
  descargar() {
    if (this.nivel) { this.escena.remove(this.nivel.raiz); }
    this.audio?.pararTodo?.();
    this.ui?.limpiar?.();
    for (const a of this.actores) a.vivo = false;
    this.actores = []; this.porNombre.clear(); this.vm.latentes.clear(); this.timers.limpiar();
    this.nivel = null; this.matinees = []; this.efectos = [];
  }
  /* Las variables de Blueprint con nombre de componente apuntan al componente de la instancia */
  varsDeComps(a) {
    const nombres = new Set(a.clase.vars().map((v) => v.n));
    for (const c of a.comps) if (nombres.has(c.nombre)) a.v[c.nombre] = c;
  }
  prepararTimelines(a) { /* en nat/motor.js vía iniciarTimelines */ this.iniciarTimelines?.(a); }
  async armarJugador(N) {
    const ws = N.actores.find((x) => x.clase === 'WorldSettings');
    let gmClase = null;
    const dg = ws?.props?.DefaultGameMode;
    if (dg?.asset) gmClase = await this.vm.clase(dg.asset.split('.').pop());
    this.gameMode = this.spawnSimple(gmClase, 'GameModeBase', 'GameMode');
    const pcClase = this.gameMode.v.PlayerControllerClass instanceof Clase ? this.gameMode.v.PlayerControllerClass : null;
    if (pcClase) await this.vm.precargar([pcClase.n]);
    this.pc = this.spawnSimple(pcClase, 'PlayerController', 'PlayerController0');
    this.pc.rotControl = { Pitch: 0, Yaw: 0, Roll: 0 }; this.pc.input = true; this.pc.yawEsc = 2.5; this.pc.pitchEsc = -2.5;
    const cmC = this.pc.v.PlayerCameraManagerClass instanceof Clase ? this.pc.v.PlayerCameraManagerClass : null;
    this.cm = this.spawnSimple(cmC, 'PlayerCameraManager', 'PlayerCameraManager0');
    this.cm.pitchMin = this.cm.v.ViewPitchMin ?? -89.9; this.cm.pitchMax = this.cm.v.ViewPitchMax ?? 89.9;
    this.cm.yawMin = this.cm.v.ViewYawMin ?? 0; this.cm.yawMax = this.cm.v.ViewYawMax ?? 359.999;
    this.cm.fade = { color: { R: 0, G: 0, B: 0, A: 1 }, alfa: 0, desde: 0, hasta: 0, t: 0, dur: 0 };
    this.cm.sacudidas = [];
    // peón: uno colocado con AutoPossessPlayer, o el DefaultPawnClass en un PlayerStart
    let peon = this.actores.find((a) => (a.v?.AutoPossessPlayer || '').includes('Player0'));
    if (!peon) {
      const dp = this.gameMode.v.DefaultPawnClass;
      const ps = this.actores.find((a) => a.nat === 'PlayerStart');
      if (dp instanceof Clase) { await this.vm.precargar([dp.n]); peon = this.spawnActor(dp, ps ? mundoUE(ps.raiz.o3) : null); }
    }
    if (peon) this.poseer(this.pc, peon);
    this.cm.vista = { obj: peon || null };
  }
  spawnSimple(clase, nat, nombre) {
    const a = this.nuevoActor(nat, clase, nombre);
    if (clase) { a.nat = clase.nativa || nat; this.vm.iniciarVars(a, clase, (v) => this.resolverValor(v, { actor: a, paquetes: clase.cadena().map((n) => this.vm.claseSync(n)?.j.paquete) })); }
    const c = this.nuevoComp(a, 'SceneComponent', 'DefaultSceneRoot'); a.raiz = c; this.escena.add(c.o3);
    this.registrar(a); a.esSistema = true;
    return a;
  }
  poseer(pc, peon) {
    if (pc.peon && pc.peon !== peon) pc.peon.controlador = null;
    pc.peon = peon; peon.controlador = pc;
    const r = rotUE(peon.raiz.o3.getWorldQuaternion(new THREE.Quaternion()));
    pc.rotControl = { Pitch: r.Pitch, Yaw: r.Yaw, Roll: 0 };
    if (this.cm) this.cm.vista = { obj: peon };
    peon.input = true;
  }
  empezar() {
    this.empezado = false;
    const lsa = this.actores.find((a) => a.clase && a.clase.n === this.nombreNivel + '_C');
    this.lsa = lsa; if (lsa) lsa.input = true;
    const orden = [this.gameMode, ...this.actores.filter((a) => a !== this.gameMode && a !== lsa), ...(lsa ? [lsa] : [])];
    for (const a of orden) this.beginPlay(a);
    this.empezado = true;
  }
  beginPlay(a) {
    if (a.empezo || !a.vivo) return; a.empezo = true;
    for (const c of a.comps) this.activarComp?.(c, true);
    if (a.clase) {
      if (this.vm.tiene(a, 'UserConstructionScript')) try { this.vm.llamar(a, 'UserConstructionScript', []); } catch (e) { this.log(e); }
      if (this.vm.tiene(a, 'ReceiveBeginPlay')) this.vm.llamar(a, 'ReceiveBeginPlay', []);
      for (const w of a.widgetsCreados || []) void w;
    }
    a.matinee?.alEmpezar?.();
  }
  /* Spawn de un actor desde una clase (BP o nativa) con transform UE {Translation, Rotation, Scale3D}. */
  spawnActor(clase, t, opciones = {}) {
    const nat = clase instanceof Clase ? clase.nativa : (clase?.nativa || clase?.nat || 'Actor');
    const a = this.nuevoActor(nat, clase instanceof Clase ? clase : null, null);
    this.construir?.(a, clase, t);
    if (clase instanceof Clase) {
      const ctx = { actor: a, paquetes: clase.cadena().map((n) => this.vm.claseSync(n)?.j.paquete).filter(Boolean) };
      this.vm.iniciarVars(a, clase, (v) => this.resolverValor(v, ctx));
      this.varsDeComps(a);
      this.prepararTimelines(a);
    }
    this.registrar(a);
    if (!opciones.diferido && this.empezado) this.beginPlay(a);
    return a;
  }
  destruir(a) {
    if (!a || !a.vivo) return;
    if (a.clase && this.vm.tiene(a, 'ReceiveDestroyed')) this.vm.llamar(a, 'ReceiveDestroyed', []);
    a.vivo = false;
    for (const c of a.comps) { c.vivo = false; this.desactivarComp?.(c); }
    a.raiz?.o3.removeFromParent();
    this.timers.limpiar(a); this.vm.cancelarLatentes(a);
    this.actores = this.actores.filter((x) => x !== a);
    if (this.porNombre.get(a.nombre) === a) this.porNombre.delete(a.nombre);
  }
  /* ---------------- tick ---------------- */
  tick(dtReal) {
    const dt = Math.min(0.1, dtReal) * this.dilatacion;
    this.dtUltimo = dt;
    if (!this.pausado) this.tiempo += dt;
    this.procesarEntrada?.(dt);
    if (!this.pausado) {
      for (const a of this.actores.slice()) {
        if (!a.vivo || !a.empezo || !a.clase || a.tickActivo === false) continue;
        if (a.v.PrimaryActorTick && a.v.PrimaryActorTick.bCanEverTick === false) continue;
        if (this.vm.tiene(a, 'ReceiveTick')) this.vm.llamar(a, 'ReceiveTick', [dt]);
      }
      this.tickComponentes?.(dt);
    }
    this.vm.tickLatentes(this.pausado ? 0 : dt);
    this.timers.tick(dt, this.pausado);
    this.tickWidgets?.(dtReal);
    this.actualizarCamara?.(dtReal);
  }
}
