/* Las clases estáticas de Unity que usan los guiones portados (Physics, Camera.main, Screen,
   SceneManager, ReInput, Input, RenderSettings, Cursor, Application) sobre el mundo actual. */
import { DEFAULT_RAYCAST } from './fisica.js';

export const U = { mundo: null };
export const ControllerType = { Keyboard: 'Keyboard', Mouse: 'Mouse', Joystick: 'Joystick', Custom: 'Custom' };
export const QueryTriggerInteraction = { UseGlobal: null, Ignore: false, Collide: true };
export const Physics = {
  // devuelve el golpe (point, distance, collider, transform) o null
  Raycast(...a) {
    const F = U.mundo.fisica;
    if (a[0]?.origin) return F.Raycast(a[0].origin, a[0].direction, a[1] ?? Infinity, a[2] ?? DEFAULT_RAYCAST, a[3] ?? null);
    return F.Raycast(a[0], a[1], a[2] ?? Infinity, a[3] ?? DEFAULT_RAYCAST, a[4] ?? null);
  },
};
export const Camera = { get main() { return U.mundo.render.principal; } };
export const Screen = { get width() { return U.mundo.ui.W; }, get height() { return U.mundo.ui.H; } };
// el rayo del centro de la pantalla (lo que miran los guiones para tocar cosas)
export const rayoCentro = () => Camera.main?.ScreenPointToRay({ x: Screen.width / 2, y: Screen.height / 2 });
export const SceneManager = { LoadScene(n) { U.mundo.LoadScene(n); }, LoadSceneAsync(n) { U.mundo.LoadScene(n); } };
export const ReInput = {
  players: { GetPlayer: () => U.mundo.entrada },
  controllers: { GetLastActiveControllerType: () => U.mundo.entrada.ultimo, GetAnyButton: () => U.mundo.entrada.GetAnyButton() },
};
export const Input = {
  GetKeyDown: (k) => U.mundo.entrada.GetKeyDown(k),
  get touchCount() { return U.mundo.ui.punteros.size > 0 && U.mundo.ui.tactil ? U.mundo.ui.punteros.size : (U.mundo.entrada.usandoTactil ? 1 : 0); },
};
export const RenderSettings = {
  get ambientLight() { return U.mundo.escena.render.ambiente; },
  set ambientLight(c) { U.mundo.escena.render.ambiente = [...c]; U.mundo.escena.render.ambiente_modo = 3; U.mundo.render.aplicarAjustes(U.mundo.escena.render); },
  get fog() { return !!U.mundo.escena.render.niebla; },
  set fog(b) { U.mundo.escena.render.niebla = !!b; U.mundo.render.aplicarAjustes(U.mundo.escena.render); },
  get skybox() { return U.mundo.escena.render.cielo; },
  set skybox(m) { U.mundo.escena.render.cielo = m?.id || null; U.mundo.render.cielo(m?.id || null); },
};
export const CursorLockMode = { None: 0, Locked: 1, Confined: 2 };
export const Cursor = {
  _l: 0, visible: true,
  get lockState() { return this._l; },
  set lockState(v) { this._l = v; U.mundo.entrada.ponerBloqueo(v === CursorLockMode.Locked); },
};
// en el navegador no hay "salir": vuelve al menú
export const Application = { Quit() { U.mundo.LoadScene('MainMenu'); } };
export const Instantiate = (o, p, r) => U.mundo.Instantiate(o, p, r);
export const Destroy = (o, t) => U.mundo.Destroy(o, t);
export const DontDestroyOnLoad = (n) => { n.noDestruir = true; };
