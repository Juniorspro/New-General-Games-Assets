/* Los guiones de los menús y pantallas sueltas de Baldi's Basics Classic 1.4.3, pasados de C# a JS.
   Cambios para el navegador: Application.Quit vuelve al menú, y los controles de celular se prenden
   solos al tocar la pantalla (como en la versión de celular; la de PC los apagaba al empezar). */
import { MonoBehaviour, Time, Mathf, Random, v3, PlayerPrefs, WaitForEndOfFrame, Color } from '../motor.js';
import { registrar } from '../mundo.js';
import { SceneManager, ReInput, ControllerType, Input, Cursor, CursorLockMode, Application, DontDestroyOnLoad, U } from '../unity.js';
import { evento } from '../ui.js';

export class WarningScreenScript extends MonoBehaviour {
  Start() { this.player = ReInput.players.GetPlayer(0); this.espera = 0.3; }
  Update() { this.espera -= Time.unscaledDeltaTime; if (this.espera <= 0 && this.player.GetAnyButton()) SceneManager.LoadScene('MainMenu'); }
}
export class CursorControllerScript extends MonoBehaviour {
  LockCursor() { Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false; }
  UnlockCursor() { Cursor.lockState = CursorLockMode.None; Cursor.visible = true; }
}
export class UIController extends MonoBehaviour {
  Start() { this.player = ReInput.players.GetPlayer(0); if (this.unlockOnStart && !this.joystickEnabled) this.cc.UnlockCursor(); }
  OnEnable() { this.UpdateControllerType(); }
  Update() { this.UpdateControllerType(); }
  SwitchMenu() { this.UpdateControllerType(); }
  UpdateControllerType() {
    const j = ReInput.controllers.GetLastActiveControllerType() === ControllerType.Joystick;
    if (!this.joystickEnabled && j) { this.joystickEnabled = true; if (this.controlMouse) this.cc.LockCursor(); }
    else if (this.joystickEnabled && !j) { this.joystickEnabled = false; if (this.controlMouse) this.cc.UnlockCursor(); }
  }
  EnableControl() { this.uiControlEnabled = true; }
  DisableControl() { this.uiControlEnabled = false; }
}
export class MenuController extends MonoBehaviour {
  Start() { this.player = ReInput.players.GetPlayer(0); }
  OnEnable() { if (this.uc) { this.uc.firstButton = this.firstButton; this.uc.dummyButtonPC = this.dummyButtonPC; this.uc.dummyButtonElse = this.dummyButtonElse; this.uc.SwitchMenu(); } }
  Update() { if (this.player.GetButtonDown('UICancel') && this.back) { this.back.SetActive(true); this.gameObject.SetActive(false); } }
}
export class StartButton extends MonoBehaviour {
  StartGame() { PlayerPrefs.SetString('CurrentMode', this.currentMode === 0 ? 'story' : 'endless'); SceneManager.LoadSceneAsync('School'); }
}
export class OptionsManager extends MonoBehaviour {
  Start() {
    if (PlayerPrefs.HasKey('OptionsSet')) {
      this.slider.value = PlayerPrefs.GetFloat('MouseSensitivity');
      this.rumble.isOn = PlayerPrefs.GetInt('Rumble') === 1;
      this.analog.isOn = PlayerPrefs.GetInt('AnalogMove') === 1;
    } else PlayerPrefs.SetInt('OptionsSet', 1);
  }
  Update() {
    PlayerPrefs.SetFloat('MouseSensitivity', this.slider.value);
    PlayerPrefs.SetInt('Rumble', this.rumble.isOn ? 1 : 0);
    PlayerPrefs.SetInt('AnalogMove', this.analog.isOn ? 1 : 0);
  }
}
export class UiSettings extends MonoBehaviour {
  UpdateState() {
    if (this.sAuto.isOn) PlayerPrefs.SetInt('UiSize', 0); else if (this.sXLarge.isOn) PlayerPrefs.SetInt('UiSize', 1); else if (this.sLarge.isOn) PlayerPrefs.SetInt('UiSize', 2);
    else if (this.sMed.isOn) PlayerPrefs.SetInt('UiSize', 3); else if (this.sSmall.isOn) PlayerPrefs.SetInt('UiSize', 4);
    if (this.hLow.isOn) PlayerPrefs.SetInt('UiHeight', 0); else if (this.hMed.isOn) PlayerPrefs.SetInt('UiHeight', 1); else if (this.hHigh.isOn) PlayerPrefs.SetInt('UiHeight', 2);
  }
  RestoreState() {
    const size = PlayerPrefs.GetInt('UiSize'), height = PlayerPrefs.GetInt('UiHeight');
    [this.sAuto, this.sXLarge, this.sLarge, this.sMed, this.sSmall][size] && ([this.sAuto, this.sXLarge, this.sLarge, this.sMed, this.sSmall][size].isOn = true);
    [this.hLow, this.hMed, this.hHigh][height] && ([this.hLow, this.hMed, this.hHigh][height].isOn = true);
  }
}
export class BackButtonScript extends MonoBehaviour {
  Start() { this.button = this.GetComponent('Button'); this.button.onClick.AddListener(() => this.CloseScreen()); }
  CloseScreen() { this.screen.SetActive(false); }
}
export class BasicButtonScript extends MonoBehaviour {
  Start() { this.button = this.GetComponent('Button'); this.button.onClick.AddListener(() => this.OpenScreen()); }
  OpenScreen() { this.screen.SetActive(true); }
}
export class MouseoverScript extends MonoBehaviour {
  Awake() { this.mouseOver = evento(this.mouseOver, U.mundo); this.mouseLeave = evento(this.mouseLeave, U.mundo); }
  OnSelect() { this.mouseOver.Invoke(); }
  OnPointerEnter() { this.mouseOver.Invoke(); }
  OnDeselect() { this.mouseLeave.Invoke(); }
  OnPointerExit() { this.mouseLeave.Invoke(); }
}
export class TextUnderliner extends MonoBehaviour {
  Underline() { this.text.fontStyle = 4; }
  Ununderline() { this.text.fontStyle = 0; }
}
export class EndlessTextScript extends MonoBehaviour {
  Start() { if (this.text) this.text.text = this.text.text + '\nHigh Score: ' + PlayerPrefs.GetInt('HighBooks') + ' Notebooks'; }
}
export class OnAwakeTrigger extends MonoBehaviour {
  Awake() { this.OnEnableEvent = evento(this.OnEnableEvent, U.mundo); }
  OnEnable() { this.OnEnableEvent.Invoke(); }
}
export class PlatformSpecificMenu extends MonoBehaviour {
  Start() { (U.mundo.entrada.usandoTactil || matchMedia('(pointer: coarse)').matches ? this.mobile || this.pC : this.pC).SetActive(true); }
}
export class iOSDisabler extends MonoBehaviour {}
export class DefaultSettingsScript extends MonoBehaviour {
  Start() { if (!PlayerPrefs.HasKey('OptionsSet')) { this.options.SetActive(true); this.StartCoroutine(this.CloseOptions()); this.canvas.enabled = false; } }
  *CloseOptions() { yield WaitForEndOfFrame(); this.canvas.enabled = true; this.options.SetActive(false); }
}
export class ExitButtonScript extends MonoBehaviour { ExitGame() { Application.Quit(); } }
export class SecretScript extends MonoBehaviour { LoadScene() { SceneManager.LoadScene('Secret'); } }
export class MouseSliderScript extends MonoBehaviour {
  Start() { if (PlayerPrefs.GetFloat('MouseSensitivity') < 100) PlayerPrefs.SetFloat('MouseSensitivity', 200); this.slider.value = PlayerPrefs.GetFloat('MouseSensitivity'); }
  Update() { PlayerPrefs.SetFloat('MouseSensitivity', this.slider.value); }
}
export class InputTypeManager extends MonoBehaviour {
  static itm = null;
  static usingTouch = false;
  Awake() {
    if (!InputTypeManager.itm || InputTypeManager.itm.nodo.destruido) { InputTypeManager.itm = this; DontDestroyOnLoad(this.gameObject); }
    else if (InputTypeManager.itm !== this) U.mundo.Destroy(this.gameObject);
  }
  Update() {
    if (Input.touchCount > 0 && !InputTypeManager.usingTouch) InputTypeManager.usingTouch = true;
    else if (ReInput.controllers.GetAnyButton() && ReInput.controllers.GetLastActiveControllerType() !== ControllerType.Custom && InputTypeManager.usingTouch && !U.mundo.entrada.usandoTactil) InputTypeManager.usingTouch = false;
  }
}
export class MobileController extends MonoBehaviour {
  Update() {
    const tactil = InputTypeManager.usingTouch || U.mundo.entrada.usandoTactil;
    if (tactil) { if (!this.active) { this.simpleControls.SetActive(true); this.active = true; } }
    else if (this.active) { this.proControls.SetActive(false); this.simpleControls.SetActive(false); this.active = false; }
  }
}
export class UiManager extends MonoBehaviour {
  Start() {
    const num = PlayerPrefs.GetInt('UiSize'), num2 = PlayerPrefs.GetInt('UiHeight');
    const res = { 1: [640, 480], 2: [800, 600], 3: [900, 720], 4: [1024, 720] }[num];
    if (res && this.normScaler) this.normScaler.referenceResolution = { x: res[0], y: res[1] };
    if (num2 === 1 || num2 === 2) for (const r of this.transforms || []) if (r?.ui) r.ui.pos[1] += (num2 === 1 ? 1 / 8 : 1 / 4) * 480;
  }
}
export class PauseMenuScript extends MonoBehaviour {
  Update() {
    if (ReInput.controllers.GetLastActiveControllerType() === ControllerType.Joystick) { if (!this.gc.mouseLocked) this.gc.LockMouse(); }
    else if (this.gc.mouseLocked) this.gc.UnlockMouse();
  }
}
export class GameOverScript extends MonoBehaviour {
  Start() {
    this.image = this.GetComponent('Image'); this.audioDevice = this.GetComponent('AudioSource');
    this.delay = 5; this.chance = Random.Range(1, 99);
    if (this.chance < 98) this.image.sprite = this.images[Mathf.RoundToInt(Random.Range(0, 4))]; else this.image.sprite = this.rare;
  }
  Update() {
    this.delay -= 1 * Time.deltaTime;
    if (!(this.delay <= 0)) return;
    if (this.chance < 98) { SceneManager.LoadScene('MainMenu'); return; }
    this.image.transform.localScale = v3(5, 5, 1); this.image.color = [...Color.red];
    if (!this.audioDevice.isPlaying) this.audioDevice.Play();
    if (this.delay <= -5) Application.Quit();
  }
}
export class YouWonScript extends MonoBehaviour {
  Start() { this.delay = 10; }
  Update() { this.delay -= Time.deltaTime; if (this.delay <= 0) Application.Quit(); }
}
export class ScoreScript extends MonoBehaviour {
  Start() { if (PlayerPrefs.GetString('CurrentMode') === 'endless') { this.scoreText.SetActive(true); this.text.text = 'Score:\n' + PlayerPrefs.GetInt('CurrentBooks') + ' Notebooks'; } }
}

registrar(WarningScreenScript, CursorControllerScript, UIController, MenuController, StartButton, OptionsManager, UiSettings, BackButtonScript, BasicButtonScript, MouseoverScript,
  TextUnderliner, EndlessTextScript, OnAwakeTrigger, PlatformSpecificMenu, iOSDisabler, DefaultSettingsScript, ExitButtonScript, SecretScript, MouseSliderScript, InputTypeManager,
  MobileController, UiManager, PauseMenuScript, GameOverScript, YouWonScript, ScoreScript);
