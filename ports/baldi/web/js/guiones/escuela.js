/* Los guiones de la escuela de Baldi's Basics Classic 1.4.3 (Micah McGonigal), pasados de C# a JS tal
   cual: mismos campos, mismos números y el mismo orden. Lo único cambiado: "Physics.Raycast(..., out
   hit)" devuelve el golpe o null, y los vectores se suman con V. */
import { MonoBehaviour, Time, Mathf, Random, V, v3, Quat, PlayerPrefs, WaitForEndOfFrame, Color } from '../motor.js';
import { registrar } from '../mundo.js';
import { Physics, Camera, SceneManager, ReInput, ControllerType, Input, RenderSettings, Instantiate, Destroy, rayoCentro } from '../unity.js';

const NPC_MASCARA = 769;
const IGNORAR = false; // QueryTriggerInteraction.Ignore

export class GameControllerScript extends MonoBehaviour {
  constructor(n, d) {
    super(n, d);
    this.item = [0, 0, 0];
    this.itemNames = ['Nothing', 'Energy flavored Zesty Bar', 'Yellow Door Lock', "Principal's Keys", 'BSODA', 'Quarter', 'Baldi Anti Hearing and Disorienting Tape', 'Alarm Clock', 'WD-NoSquee (Door Type)', 'Safety Scissors', "Big Ol' Boots"];
    this.itemSelectOffset = [-80, -40, 0];
    this.gamePaused = false; this.learningActive = false; this.gameOverDelay = 0;
  }
  Start() {
    this.playerInput = ReInput.players.GetPlayer(0);
    this.cullingMask = this.camera.cullingMask;
    this.audioDevice = this.GetComponent('AudioSource');
    this.mode = PlayerPrefs.GetString('CurrentMode');
    if (this.mode === 'endless') this.baldiScrpt.endless = true;
    this.schoolMusic.Play();
    this.LockMouse();
    this.UpdateNotebookCount();
    this.itemSelected = 0;
    this.gameOverDelay = 0.5;
  }
  Update() {
    const pi = this.playerInput;
    if (!this.learningActive) {
      if (pi.GetButtonDown('Pause')) { if (!this.gamePaused) this.PauseGame(); else this.UnpauseGame(); }
      if (Input.GetKeyDown('y') && this.gamePaused) this.ExitGame();
      else if (Input.GetKeyDown('n') && this.gamePaused) this.UnpauseGame();
      if (!this.gamePaused && Time.timeScale !== 1) Time.timeScale = 1;
      if (pi.GetButtonDown('Item') && Time.timeScale !== 0) this.UseItem();
      if ((pi.GetAxis('ItemSelect') > 0 || pi.GetButtonDown('ItemSelectLeft')) && Time.timeScale !== 0) this.DecreaseItemSelection();
      else if ((pi.GetAxis('ItemSelect') < 0 || pi.GetButtonDown('ItemSelectRight')) && Time.timeScale !== 0) this.IncreaseItemSelection();
      if (Time.timeScale !== 0) {
        if (pi.GetButtonDown('Item1')) { this.itemSelected = 0; this.UpdateItemSelection(); }
        else if (pi.GetButtonDown('Item2')) { this.itemSelected = 1; this.UpdateItemSelection(); }
        else if (pi.GetButtonDown('Item3')) { this.itemSelected = 2; this.UpdateItemSelection(); }
      }
    } else {
      if (Time.timeScale !== 0) Time.timeScale = 0;
      if (ReInput.controllers.GetLastActiveControllerType() === ControllerType.Joystick) this.cursorController.LockCursor();
      else this.cursorController.UnlockCursor();
    }
    if (this.player.stamina < 0 && !this.warning.activeSelf) this.warning.SetActive(true);
    else if (this.player.stamina > 0 && this.warning.activeSelf) this.warning.SetActive(false);
    if (this.player.gameOver) {
      if (this.mode === 'endless' && this.notebooks > PlayerPrefs.GetInt('HighBooks') && !this.highScoreText.activeSelf) this.highScoreText.SetActive(true);
      Time.timeScale = 0;
      this.gameOverDelay -= Time.unscaledDeltaTime * 0.5;
      this.camera.farClipPlane = this.gameOverDelay * 400;
      this.audioDevice.PlayOneShot(this.aud_buzz);
      if (PlayerPrefs.GetInt('Rumble') === 1) { pi.SetVibration(0, 1, 0.5); pi.SetVibration(1, 1, 0.5); }
      if (this.gameOverDelay <= 0) {
        if (this.mode === 'endless') {
          if (this.notebooks > PlayerPrefs.GetInt('HighBooks')) PlayerPrefs.SetInt('HighBooks', this.notebooks);
          PlayerPrefs.SetInt('CurrentBooks', this.notebooks);
        }
        Time.timeScale = 1;
        SceneManager.LoadScene('GameOver');
      }
    }
    if (this.finaleMode && !this.audioDevice.isPlaying && this.exitsReached === 3) {
      this.audioDevice.clip = this.aud_MachineLoop; this.audioDevice.loop = true; this.audioDevice.Play();
    }
  }
  UpdateNotebookCount() {
    if (this.mode === 'story') this.notebookCount.text = this.notebooks + '/7 Notebooks';
    else this.notebookCount.text = this.notebooks + ' Notebooks';
    if (this.notebooks === 7 && this.mode === 'story') this.ActivateFinaleMode();
  }
  CollectNotebook() { this.notebooks++; this.UpdateNotebookCount(); }
  LockMouse() { if (!this.learningActive) { this.cursorController.LockCursor(); this.mouseLocked = true; this.reticle.SetActive(true); } }
  UnlockMouse() { this.cursorController.UnlockCursor(); this.mouseLocked = false; this.reticle.SetActive(false); }
  PauseGame() {
    if (!this.learningActive) {
      if (ReInput.controllers.GetLastActiveControllerType() !== ControllerType.Joystick) this.UnlockMouse();
      Time.timeScale = 0; this.gamePaused = true; this.pauseMenu.SetActive(true);
    }
  }
  ExitGame() { SceneManager.LoadScene('MainMenu'); }
  UnpauseGame() { Time.timeScale = 1; this.gamePaused = false; this.pauseMenu.SetActive(false); this.LockMouse(); }
  ActivateSpoopMode() {
    this.spoopMode = true;
    this.entrance_0.Lower(); this.entrance_1.Lower(); this.entrance_2.Lower(); this.entrance_3.Lower();
    this.baldiTutor.SetActive(false); this.baldi.SetActive(true); this.principal.SetActive(true); this.crafters.SetActive(true);
    this.playtime.SetActive(true); this.gottaSweep.SetActive(true); this.bully.SetActive(true); this.firstPrize.SetActive(true);
    this.audioDevice.PlayOneShot(this.aud_Hang);
    this.learnMusic.Stop(); this.schoolMusic.Stop();
  }
  ActivateFinaleMode() { this.finaleMode = true; this.entrance_0.Raise(); this.entrance_1.Raise(); this.entrance_2.Raise(); this.entrance_3.Raise(); }
  GetAngry(value) { if (!this.spoopMode) this.ActivateSpoopMode(); this.baldiScrpt.GetAngry(value); }
  ActivateLearningGame() {
    this.camera.cullingMask = 0;
    this.learningActive = true;
    if (ReInput.controllers.GetLastActiveControllerType() !== ControllerType.Joystick) this.UnlockMouse();
    this.tutorBaldi.Stop();
    if (!this.spoopMode) { this.schoolMusic.Stop(); this.learnMusic.Play(); }
  }
  DeactivateLearningGame(subject) {
    this.camera.cullingMask = this.cullingMask;
    this.learningActive = false;
    Destroy(subject);
    this.LockMouse();
    if (this.player.stamina < 100) this.player.stamina = 100;
    if (!this.spoopMode) { this.schoolMusic.Play(); this.learnMusic.Stop(); }
    if (this.notebooks === 1 && !this.spoopMode) { this.quarter.SetActive(true); this.tutorBaldi.PlayOneShot(this.aud_Prize); }
    else if (this.notebooks === 7 && this.mode === 'story') this.audioDevice.PlayOneShot(this.aud_AllNotebooks, 0.8);
  }
  IncreaseItemSelection() { this.itemSelected++; if (this.itemSelected > 2) this.itemSelected = 0; this.itemSelect.anchoredPosition = v3(this.itemSelectOffset[this.itemSelected], 0, 0); this.UpdateItemName(); }
  DecreaseItemSelection() { this.itemSelected--; if (this.itemSelected < 0) this.itemSelected = 2; this.itemSelect.anchoredPosition = v3(this.itemSelectOffset[this.itemSelected], 0, 0); this.UpdateItemName(); }
  UpdateItemSelection() { this.itemSelect.anchoredPosition = v3(this.itemSelectOffset[this.itemSelected], 0, 0); this.UpdateItemName(); }
  CollectItem(id) {
    if (this.item[0] === 0) { this.item[0] = id; this.itemSlot[0].texture = this.itemTextures[id]; }
    else if (this.item[1] === 0) { this.item[1] = id; this.itemSlot[1].texture = this.itemTextures[id]; }
    else if (this.item[2] === 0) { this.item[2] = id; this.itemSlot[2].texture = this.itemTextures[id]; }
    else { this.item[this.itemSelected] = id; this.itemSlot[this.itemSelected].texture = this.itemTextures[id]; }
    this.UpdateItemName();
  }
  UseItem() {
    const it = this.item[this.itemSelected];
    if (it === 0) return;
    const pp = this.playerTransform.position;
    if (it === 1) { this.player.stamina = this.player.maxStamina * 2; this.ResetItem(); }
    else if (it === 2) {
      const h = Physics.Raycast(rayoCentro());
      if (h && h.collider.tag === 'SwingingDoor' && V.dist(pp, h.transform.position) <= 10) { h.collider.gameObject.GetComponent('SwingingDoorScript').LockDoor(15); this.ResetItem(); }
    } else if (it === 3) {
      const h = Physics.Raycast(rayoCentro());
      if (h && h.collider.tag === 'Door' && V.dist(pp, h.transform.position) <= 10) {
        const c = h.collider.gameObject.GetComponent('DoorScript');
        if (c.DoorLocked) { c.UnlockDoor(); c.OpenDoor(); this.ResetItem(); }
      }
    } else if (it === 4) {
      Instantiate(this.bsodaSpray, pp, this.cameraTransform.rotation);
      this.ResetItem(); this.player.ResetGuilt('drink', 1); this.audioDevice.PlayOneShot(this.aud_Soda);
    } else if (it === 5) {
      const h = Physics.Raycast(rayoCentro());
      if (h) {
        if (h.collider.name === 'BSODAMachine' && V.dist(pp, h.transform.position) <= 10) { this.ResetItem(); this.CollectItem(4); }
        else if (h.collider.name === 'ZestyMachine' && V.dist(pp, h.transform.position) <= 10) { this.ResetItem(); this.CollectItem(1); }
        else if (h.collider.name === 'PayPhone' && V.dist(pp, h.transform.position) <= 10) { h.collider.gameObject.GetComponent('TapePlayerScript').Play(); this.ResetItem(); }
      }
    } else if (it === 6) {
      const h = Physics.Raycast(rayoCentro());
      if (h && h.collider.name === 'TapePlayer' && V.dist(pp, h.transform.position) <= 10) { h.collider.gameObject.GetComponent('TapePlayerScript').Play(); this.ResetItem(); }
    } else if (it === 7) {
      const g = Instantiate(this.alarmClock, pp, this.cameraTransform.rotation);
      g.GetComponent('AlarmClockScript').baldi = this.baldiScrpt;
      this.ResetItem();
    } else if (it === 8) {
      const h = Physics.Raycast(rayoCentro());
      if (h && h.collider.tag === 'Door' && V.dist(pp, h.transform.position) <= 10) { h.collider.gameObject.GetComponent('DoorScript').SilenceDoor(); this.ResetItem(); this.audioDevice.PlayOneShot(this.aud_Spray); }
    } else if (it === 9) {
      if (this.player.jumpRope) { this.player.DeactivateJumpRope(); this.playtimeScript.Disappoint(); this.ResetItem(); }
      else { const h = Physics.Raycast(rayoCentro()); if (h && h.collider.name === '1st Prize') { this.firstPrizeScript.GoCrazy(); this.ResetItem(); } }
    } else if (it === 10) { this.player.ActivateBoots(); this.StartCoroutine(this.BootAnimation()); this.ResetItem(); }
  }
  *BootAnimation() {
    let time = 15, height = 375;
    const b = this.boots;
    b.gameObject.SetActive(true);
    while (height > -375) { height -= 375 * Time.deltaTime; time -= Time.deltaTime; const p = b.localPosition; p.y = height; b.localPosition = p; yield null; }
    let p = b.localPosition; p.y = -375; b.localPosition = p;
    b.gameObject.SetActive(false);
    while (time > 0) { time -= Time.deltaTime; yield null; }
    b.gameObject.SetActive(true);
    while (height < 375) { height += 375 * Time.deltaTime; p = b.localPosition; p.y = height; b.localPosition = p; yield null; }
    p = b.localPosition; p.y = 375; b.localPosition = p;
    b.gameObject.SetActive(false);
  }
  ResetItem() { this.item[this.itemSelected] = 0; this.itemSlot[this.itemSelected].texture = this.itemTextures[0]; this.UpdateItemName(); }
  LoseItem(id) { this.item[id] = 0; this.itemSlot[id].texture = this.itemTextures[0]; this.UpdateItemName(); }
  UpdateItemName() { this.itemText.text = this.itemNames[this.item[this.itemSelected]]; }
  ExitReached() {
    this.exitsReached++;
    if (this.exitsReached === 1) {
      RenderSettings.ambientLight = Color.red; RenderSettings.fog = true;
      this.audioDevice.PlayOneShot(this.aud_Switch, 0.8);
      this.audioDevice.clip = this.aud_MachineQuiet; this.audioDevice.loop = true; this.audioDevice.Play();
    }
    if (this.exitsReached === 2) { this.audioDevice.volume = 0.8; this.audioDevice.clip = this.aud_MachineStart; this.audioDevice.loop = true; this.audioDevice.Play(); }
    if (this.exitsReached === 3) { this.audioDevice.clip = this.aud_MachineRev; this.audioDevice.loop = false; this.audioDevice.Play(); }
  }
  DespawnCrafters() { this.crafters.SetActive(false); }
  Fliparoo() { this.player.height = 6; this.player.fliparoo = 180; this.player.flipaturn = -1; Camera.main.GetComponent('CameraScript').offset = v3(0, -1, 0); }
}

export class PlayerScript extends MonoBehaviour {
  Start() {
    if (PlayerPrefs.GetInt('AnalogMove') === 1) this.sensitivityActive = true;
    this.height = this.transform.position.y;
    this.player = ReInput.players.GetPlayer(0);
    this.stamina = this.maxStamina;
    this.playerRotation = this.transform.rotation;
    this.mouseSensitivity = PlayerPrefs.GetFloat('MouseSensitivity');
    this.principalBugFixer = 1;
    this.flipaturn = 1;
  }
  Update() {
    const p = this.transform.position; this.transform.position = v3(p.x, this.height, p.z);
    this.MouseMove(); this.PlayerMove(); this.StaminaCheck(); this.GuiltCheck();
    if (V.mag(this.cc.velocity) > 0) this.gc.LockMouse();
    if (this.jumpRope && V.mag(V.sub(this.transform.position, this.frozenPosition)) >= 1) this.DeactivateJumpRope();
    if (this.sweepingFailsave > 0) { this.sweepingFailsave -= Time.deltaTime; return; }
    this.sweeping = false; this.hugging = false;
  }
  MouseMove() {
    const e = Quat.euler(this.playerRotation);
    this.playerRotation = Quat.Euler(e.x, e.y + this.player.GetAxis('Turn') * this.mouseSensitivity * Time.timeScale * this.flipaturn, this.fliparoo);
    this.transform.rotation = this.playerRotation;
  }
  PlayerMove() {
    const vector = V.mul(this.transform.forward, this.player.GetAxis('Forward'));
    const vector2 = V.mul(this.transform.right, this.player.GetAxis('Strafe'));
    const analogo = () => (this.sensitivityActive ? Mathf.Clamp(V.mag(V.add(vector2, vector)), 0, 1) : 1);
    if (this.stamina > 0) {
      if (this.player.GetButton('Run')) {
        this.playerSpeed = this.runSpeed; this.sensitivity = 1;
        if (V.mag(this.cc.velocity) > 0.1 && !this.hugging && !this.sweeping) this.ResetGuilt('running', 0.1);
      } else { this.playerSpeed = this.walkSpeed; this.sensitivity = analogo(); }
    } else { this.playerSpeed = this.walkSpeed; this.sensitivity = analogo(); }
    this.playerSpeed *= Time.deltaTime;
    this.moveDirection = V.mul(V.norm(V.add(vector, vector2)), this.playerSpeed * this.sensitivity);
    if (!(!this.jumpRope && !this.sweeping && !this.hugging)) {
      if (this.sweeping && !this.bootsActive) this.moveDirection = V.add(V.mul(this.gottaSweep.velocity, Time.deltaTime), V.mul(this.moveDirection, 0.3));
      else if (this.hugging && !this.bootsActive) {
        const fp = this.firstPrizeTransform.position, ff = this.firstPrizeTransform.forward;
        const meta = V.add(v3(fp.x, this.height, fp.z), V.mul(v3(Mathf.RoundToInt(ff.x), 0, Mathf.RoundToInt(ff.z)), 3));
        this.moveDirection = V.mul(V.add(V.mul(this.firstPrize.velocity, 1.2 * Time.deltaTime), V.sub(meta, this.transform.position)), this.principalBugFixer);
      } else if (this.jumpRope) this.moveDirection = v3();
    }
    this.cc.Move(this.moveDirection);
  }
  StaminaCheck() {
    if (V.mag(this.cc.velocity) > 0.1) {
      if (this.player.GetButton('Run') && this.stamina > 0) this.stamina -= this.staminaRate * Time.deltaTime;
      if (this.stamina < 0 && this.stamina > -5) this.stamina = -5;
    } else if (this.stamina < this.maxStamina) this.stamina += this.staminaRate * Time.deltaTime;
    this.staminaBar.value = this.stamina / this.maxStamina * 100;
  }
  OnTriggerEnter(other) {
    if (other.transform.name === 'Baldi' && !this.gc.debugMode) { this.gameOver = true; RenderSettings.skybox = this.blackSky; this.StartCoroutine(this.KeepTheHudOff()); }
    else if (other.transform.name === 'Playtime' && !this.jumpRope && this.playtime.playCool <= 0) this.ActivateJumpRope();
  }
  *KeepTheHudOff() {
    while (this.gameOver) { this.hud.enabled = false; this.mobile1.enabled = false; this.mobile2.enabled = false; this.jumpRopeScreen.SetActive(false); yield WaitForEndOfFrame(); }
  }
  OnTriggerStay(other) {
    if (other.transform.name === 'Gotta Sweep') { this.sweeping = true; this.sweepingFailsave = 1; }
    else if (other.transform.name === '1st Prize' && V.mag(this.firstPrize.velocity) > 5) { this.hugging = true; this.sweepingFailsave = 1; }
  }
  OnTriggerExit(other) {
    if (other.transform.name === 'Office Trigger') this.ResetGuilt('escape', this.door.lockTime);
    else if (other.transform.name === 'Gotta Sweep') this.sweeping = false;
    else if (other.transform.name === '1st Prize') this.hugging = false;
  }
  ResetGuilt(type, amount) { if (amount >= this.guilt) { this.guilt = amount; this.guiltType = type; } }
  GuiltCheck() { if (this.guilt > 0) this.guilt -= Time.deltaTime; }
  ActivateJumpRope() { this.jumpRopeScreen.SetActive(true); this.jumpRope = true; this.frozenPosition = this.transform.position; }
  DeactivateJumpRope() { this.jumpRopeScreen.SetActive(false); this.jumpRope = false; }
  ActivateBoots() { this.bootsActive = true; this.StartCoroutine(this.BootTimer()); }
  *BootTimer() { let time = 15; while (time > 0) { time -= Time.deltaTime; yield null; } this.bootsActive = false; }
}

export class CameraScript extends MonoBehaviour {
  Start() { this.playerInput = ReInput.players.GetPlayer(0); this.offset = V.sub(this.transform.position, this.player.transform.position); this.lookBehind = 0; }
  Update() {
    if (this.ps.jumpRope) {
      this.velocity -= this.gravity * Time.deltaTime;
      this.jumpHeight += this.velocity * Time.deltaTime;
      if (this.jumpHeight <= 0) { this.jumpHeight = 0; if (this.playerInput.GetButton('Jump')) this.velocity = this.initVelocity; }
      this.jumpHeightV3 = v3(0, this.jumpHeight, 0);
    } else if (this.playerInput.GetButton('LookBack')) this.lookBehind = 180;
    else this.lookBehind = 0;
  }
  LateUpdate() {
    const pt = this.player.transform;
    this.transform.position = V.add(pt.position, this.offset);
    if (!this.ps.gameOver && !this.ps.jumpRope) { this.transform.position = V.add(pt.position, this.offset); this.transform.rotation = Quat.mul(pt.rotation, Quat.Euler(0, this.lookBehind, 0)); }
    else if (this.ps.gameOver) {
      const b = this.baldi; this.transform.position = V.add(V.add(b.position, V.mul(b.forward, 2)), v3(0, 5, 0));
      this.transform.LookAt(v3(b.position.x, b.position.y + 5, b.position.z));
    } else if (this.ps.jumpRope) { this.transform.position = V.add(V.add(pt.position, this.offset), this.jumpHeightV3 || v3()); this.transform.rotation = pt.rotation; }
  }
}

export class BaldiScript extends MonoBehaviour {
  constructor(n, d) { super(n, d); this.moveFrames = 0; this.currentPriority = 0; this.previous = v3(); this.rumble = false; }
  Start() {
    this.baldiAudio = this.GetComponent('AudioSource');
    this.agent = this.GetComponent('NavMeshAgent');
    this.timeToMove = this.baseTime;
    this.Wander();
    this.controller = ReInput.players.GetPlayer(0);
    if (PlayerPrefs.GetInt('Rumble') === 1) this.rumble = true;
  }
  Update() {
    if (this.timeToMove > 0) this.timeToMove -= 1 * Time.deltaTime; else this.Move();
    if (this.coolDown > 0) this.coolDown -= 1 * Time.deltaTime;
    if (this.baldiTempAnger > 0) this.baldiTempAnger -= 0.02 * Time.deltaTime; else this.baldiTempAnger = 0;
    if (this.antiHearingTime > 0) this.antiHearingTime -= Time.deltaTime; else this.antiHearing = false;
    if (this.endless) {
      if (this.timeToAnger > 0) { this.timeToAnger -= 1 * Time.deltaTime; return; }
      this.timeToAnger = this.angerFrequency; this.GetAngry(this.angerRate); this.angerRate += this.angerRateRate;
    }
  }
  FixedUpdate() {
    if (this.moveFrames > 0) { this.moveFrames--; this.agent.speed = this.speed; } else this.agent.speed = 0;
    const dir = V.sub(this.player.position, this.transform.position);
    const h = Physics.Raycast(V.add(this.transform.position, V.mul(V.up(), 2)), dir, Infinity, NPC_MASCARA, IGNORAR);
    if (h && h.transform.tag === 'Player') { this.db = true; this.TargetPlayer(); } else this.db = false;
  }
  Wander() { this.wanderer.GetNewTarget(); this.agent.SetDestination(this.wanderTarget.position); this.coolDown = 1; this.currentPriority = 0; }
  TargetPlayer() { this.agent.SetDestination(this.player.position); this.coolDown = 1; this.currentPriority = 0; }
  Move() {
    if (V.eq(this.transform.position, this.previous) && this.coolDown < 0) this.Wander();
    this.moveFrames = 10;
    this.timeToMove = this.baldiWait - this.baldiTempAnger;
    this.previous = this.transform.position;
    this.baldiAudio.PlayOneShot(this.slap);
    this.baldiAnimator.SetTrigger('slap');
    if (this.rumble) {
      const num = V.dist(this.transform.position, this.player.position);
      if (num < this.vibrationDistance) { const m = 1 - num / this.vibrationDistance; this.controller.SetVibration(0, m, 0.2); this.controller.SetVibration(1, m, 0.2); }
    }
  }
  GetAngry(value) {
    this.baldiAnger += value;
    if (this.baldiAnger < 0.5) this.baldiAnger = 0.5;
    this.baldiWait = -3 * this.baldiAnger / (this.baldiAnger + 2 / this.baldiSpeedScale) + 3;
  }
  GetTempAngry(value) { this.baldiTempAnger += value; }
  Hear(soundLocation, priority) { if (!this.antiHearing && priority >= this.currentPriority) { this.agent.SetDestination(soundLocation); this.currentPriority = priority; } }
  ActivateAntiHearing(t) { this.Wander(); this.antiHearing = true; this.antiHearingTime = t; }
}

export class PrincipalScript extends MonoBehaviour {
  constructor(n, d) { super(n, d); this.detentions = 0; this.lockTime = [15, 30, 45, 60, 99]; }
  Start() { this.agent = this.GetComponent('NavMeshAgent'); this.audioQueue = this.GetComponent('AudioQueueScript'); this.audioDevice = this.GetComponent('AudioSource'); }
  Update() {
    if (this.seesRuleBreak) {
      this.timeSeenRuleBreak += 1 * Time.deltaTime;
      if (this.timeSeenRuleBreak >= 0.5 && !this.angry) { this.angry = true; this.seesRuleBreak = false; this.timeSeenRuleBreak = 0; this.TargetPlayer(); this.CorrectPlayer(); }
    } else this.timeSeenRuleBreak = 0;
    if (this.coolDown > 0) this.coolDown -= 1 * Time.deltaTime;
  }
  FixedUpdate() {
    if (!this.angry) {
      let aim = V.sub(this.player.position, this.transform.position);
      let h = Physics.Raycast(this.transform.position, aim, Infinity, NPC_MASCARA, IGNORAR);
      if (h && h.transform.tag === 'Player' && this.playerScript.guilt > 0 && !this.inOffice && !this.angry) this.seesRuleBreak = true;
      else {
        this.seesRuleBreak = false;
        if (V.mag(this.agent.velocity) <= 1 && this.coolDown <= 0) this.Wander();
      }
      aim = V.sub(this.bully.position, this.transform.position);
      h = Physics.Raycast(this.transform.position, aim, Infinity, NPC_MASCARA);
      if (h && h.transform.name === 'Its a Bully' && this.bullyScript.guilt > 0 && !this.inOffice && !this.angry) this.TargetBully();
    } else this.TargetPlayer();
  }
  Wander() {
    this.playerScript.principalBugFixer = 1;
    this.wanderer.GetNewTarget();
    this.agent.SetDestination(this.wanderTarget.position);
    if (this.agent.isStopped) this.agent.isStopped = false;
    this.coolDown = 1;
    if (Random.Range(0, 10) <= 1) this.quietAudioDevice.PlayOneShot(this.aud_Whistle);
  }
  TargetPlayer() { this.agent.SetDestination(this.player.position); this.coolDown = 1; }
  TargetBully() { if (!this.bullySeen) { this.agent.SetDestination(this.bully.position); this.audioQueue.QueueAudio(this.audNoBullying); this.bullySeen = true; } }
  CorrectPlayer() {
    this.audioQueue.ClearAudioQueue();
    const t = this.playerScript.guiltType;
    if (t === 'faculty') this.audioQueue.QueueAudio(this.audNoFaculty);
    else if (t === 'running') this.audioQueue.QueueAudio(this.audNoRunning);
    else if (t === 'drink') this.audioQueue.QueueAudio(this.audNoDrinking);
    else if (t === 'escape') this.audioQueue.QueueAudio(this.audNoEscaping);
  }
  OnTriggerStay(other) {
    if (other.name === 'Office Trigger') this.inOffice = true;
    if (other.tag === 'Player' && this.angry && !this.inOffice) {
      this.inOffice = true;
      this.playerScript.principalBugFixer = 0;
      this.agent.Warp(v3(10, 0, 170));
      this.agent.isStopped = true;
      other.transform.position = v3(10, 4, 160);
      other.transform.LookAt(v3(this.transform.position.x, other.transform.position.y, this.transform.position.z));
      this.audioQueue.QueueAudio(this.aud_Delay);
      this.audioQueue.QueueAudio(this.audTimes[this.detentions]);
      this.audioQueue.QueueAudio(this.audDetention);
      const num = Mathf.RoundToInt(Random.Range(0, 2));
      this.audioQueue.QueueAudio(this.audScolds[num]);
      this.officeDoor.LockDoor(this.lockTime[this.detentions]);
      this.baldiScript.Hear(this.transform.position, 8);
      this.coolDown = 5; this.angry = false; this.detentions++;
      if (this.detentions > 4) this.detentions = 4;
    }
  }
  OnTriggerExit(other) { if (other.name === 'Office Trigger') this.inOffice = false; if (other.name === 'Its a Bully') this.bullySeen = false; }
}

export class PlaytimeScript extends MonoBehaviour {
  Start() { this.agent = this.GetComponent('NavMeshAgent'); this.audioDevice = this.GetComponent('AudioSource'); this.Wander(); }
  Update() {
    if (this.coolDown > 0) this.coolDown -= 1 * Time.deltaTime;
    if (this.playCool >= 0) this.playCool -= Time.deltaTime;
    else if (this.animator.GetBool('disappointed')) { this.playCool = 0; this.animator.SetBool('disappointed', false); }
  }
  FixedUpdate() {
    if (!this.ps.jumpRope) {
      const dir = V.sub(this.player.position, this.transform.position);
      const h = Physics.Raycast(this.transform.position, dir, Infinity, NPC_MASCARA, IGNORAR);
      if (h && h.transform.tag === 'Player' && V.mag(V.sub(this.transform.position, this.player.position)) <= 80 && this.playCool <= 0) { this.playerSeen = true; this.TargetPlayer(); }
      else if (this.playerSeen && this.coolDown <= 0) { this.playerSeen = false; this.Wander(); }
      else if (V.mag(this.agent.velocity) <= 1 && this.coolDown <= 0) this.Wander();
      this.jumpRopeStarted = false;
    } else {
      if (!this.jumpRopeStarted) this.agent.Warp(V.sub(this.transform.position, V.mul(this.transform.forward, 10)));
      this.jumpRopeStarted = true; this.agent.speed = 0; this.playCool = 15;
    }
  }
  Wander() {
    this.wanderer.GetNewTargetHallway();
    this.agent.SetDestination(this.wanderTarget.position);
    this.agent.speed = 15; this.playerSpotted = false;
    this.audVal = Mathf.RoundToInt(Random.Range(0, 1));
    if (!this.audioDevice.isPlaying) this.audioDevice.PlayOneShot(this.aud_Random[this.audVal]);
    this.coolDown = 1;
  }
  TargetPlayer() {
    this.animator.SetBool('disappointed', false);
    this.agent.SetDestination(this.player.position);
    this.agent.speed = 20; this.coolDown = 0.2;
    if (!this.playerSpotted) { this.playerSpotted = true; this.audioDevice.PlayOneShot(this.aud_LetsPlay); }
  }
  Disappoint() { this.animator.SetBool('disappointed', true); this.audioDevice.Stop(); this.audioDevice.PlayOneShot(this.aud_Sad); }
}

export class FirstPrizeScript extends MonoBehaviour {
  Start() { this.agent = this.GetComponent('NavMeshAgent'); this.coolDown = 1; this.Wander(); }
  Update() {
    if (this.coolDown > 0) this.coolDown -= 1 * Time.deltaTime;
    if (this.autoBrakeCool > 0) this.autoBrakeCool -= 1 * Time.deltaTime; else this.agent.autoBraking = true;
    const st = this.agent.steeringTarget, p = this.transform.position;
    this.angleDiff = Mathf.DeltaAngle(this.transform.eulerAngles.y, Math.atan2(st.x - p.x, st.z - p.z) * 57.29578);
    if (this.crazyTime <= 0) {
      if (Math.abs(this.angleDiff) < 5) { this.transform.LookAt(v3(st.x, p.y, st.z)); this.agent.speed = this.currentSpeed; }
      else { this.transform.Rotate(v3(0, this.turnSpeed * Mathf.Sign(this.angleDiff) * Time.deltaTime, 0)); this.agent.speed = 0; }
    } else { this.agent.speed = 0; this.transform.Rotate(v3(0, 180 * Time.deltaTime, 0)); this.crazyTime -= Time.deltaTime; }
    this.motorAudio.pitch = (V.mag(this.agent.velocity) + 1) * Time.timeScale;
  }
  FixedUpdate() {
    const dir = V.sub(this.player.position, this.transform.position);
    const h = Physics.Raycast(this.transform.position, dir, Infinity, NPC_MASCARA, IGNORAR);
    if (h && h.transform.tag === 'Player') {
      if (!this.playerSeen && !this.audioDevice.isPlaying) this.audioDevice.PlayOneShot(this.aud_Found[Mathf.RoundToInt(Random.Range(0, 1))]);
      this.playerSeen = true; this.TargetPlayer(); this.currentSpeed = this.runSpeed;
      return;
    }
    this.currentSpeed = this.normSpeed;
    if (this.playerSeen && this.coolDown <= 0) {
      if (!this.audioDevice.isPlaying) this.audioDevice.PlayOneShot(this.aud_Lost[Mathf.RoundToInt(Random.Range(0, 1))]);
      this.playerSeen = false; this.Wander();
    } else if (V.mag(this.agent.velocity) <= 1 && this.coolDown <= 0 && V.mag(V.sub(this.transform.position, this.agent.destination)) < 5) this.Wander();
  }
  Wander() {
    this.wanderer.GetNewTargetHallway();
    this.agent.SetDestination(this.wanderTarget.position);
    this.hugAnnounced = false;
    const num = Mathf.RoundToInt(Random.Range(0, 9));
    if (!this.audioDevice.isPlaying && num === 0 && this.coolDown <= 0) this.audioDevice.PlayOneShot(this.aud_Random[Mathf.RoundToInt(Random.Range(0, 1))]);
    this.coolDown = 1;
  }
  TargetPlayer() { this.agent.SetDestination(this.player.position); this.coolDown = 0.5; }
  OnTriggerEnter(other) {
    if (other.tag === 'Player') {
      if (!this.audioDevice.isPlaying && !this.hugAnnounced) { this.audioDevice.PlayOneShot(this.aud_Hug[Mathf.RoundToInt(Random.Range(0, 1))]); this.hugAnnounced = true; }
      this.agent.autoBraking = false;
    }
  }
  OnTriggerExit(other) { if (other.tag === 'Player') this.autoBrakeCool = 1; }
  GoCrazy() { this.crazyTime = 15; }
}

export class FirstPrizeSpriteScript extends MonoBehaviour {
  Start() { this.sprite = this.GetComponent('SpriteRenderer'); }
  Update() {
    const c = this.cam.position, b = this.body.position;
    this.angleF = Math.atan2(c.z - b.z, c.x - b.x) * 57.29578;
    if (this.angleF < 0) this.angleF += 360;
    this.debug = this.body.eulerAngles.y;
    this.angleF += this.body.eulerAngles.y;
    this.angle = Mathf.RoundToInt(this.angleF / 22.5);
    while (this.angle < 0 || this.angle >= 16) this.angle += Math.trunc(-16 * Mathf.Sign(this.angle));
    this.sprite.sprite = this.sprites[this.angle];
  }
}

export class CraftersScript extends MonoBehaviour {
  Start() { this.audioDevice = this.GetComponent('AudioSource'); this.sprite.SetActive(false); this.forceShowTime = 0; }
  Update() {
    if (this.forceShowTime > 0) this.forceShowTime -= Time.deltaTime;
    if (this.gettingAngry) {
      this.anger += Time.deltaTime;
      if (this.anger >= 1 && !this.angry) { this.angry = true; this.audioDevice.PlayOneShot(this.aud_Intro); this.spriteImage.sprite = this.angrySprite; }
    } else if (this.anger > 0) this.anger -= Time.deltaTime;
    if (!this.angry) {
      if ((V.mag(V.sub(this.transform.position, this.agent.destination)) <= 20 && V.mag(V.sub(this.transform.position, this.player.position)) >= 60) || this.forceShowTime > 0) this.sprite.SetActive(true);
      else this.sprite.SetActive(false);
      return;
    }
    this.agent.speed += 60 * Time.deltaTime;
    this.TargetPlayer();
    if (!this.audioDevice.isPlaying) this.audioDevice.PlayOneShot(this.aud_Loop);
  }
  FixedUpdate() {
    if (this.gc.notebooks >= 7) {
      const dir = V.sub(this.player.position, this.transform.position);
      const h = Physics.Raycast(V.add(this.transform.position, V.mul(V.up(), 2)), dir, Infinity, NPC_MASCARA, IGNORAR);
      this.gettingAngry = !!(h && h.transform.tag === 'Player' && this.craftersRenderer.isVisible && this.sprite.activeSelf);
    }
  }
  GiveLocation(location, flee) { if (!this.angry && this.agent.isActiveAndEnabled) { this.agent.SetDestination(location); if (flee) this.forceShowTime = 3; } }
  TargetPlayer() { this.agent.SetDestination(this.player.position); }
  OnTriggerEnter(other) {
    if (other.tag === 'Player' && this.angry) {
      this.player.position = v3(5, this.player.position.y, 80);
      this.baldiAgent.Warp(v3(5, this.baldi.position.y, 125));
      this.player.LookAt(v3(this.baldi.position.x, this.player.position.y, this.baldi.position.z));
      this.gc.DespawnCrafters();
    }
  }
}
export class CraftersTriggerScript extends MonoBehaviour {
  OnTriggerEnter(other) { if (other.tag === 'Player') this.crafters.GiveLocation(this.goTarget.position, false); }
  OnTriggerExit(other) { if (other.tag === 'Player') this.crafters.GiveLocation(this.fleeTarget.position, true); }
}

export class BullyScript extends MonoBehaviour {
  Start() { this.audioDevice = this.GetComponent('AudioSource'); this.waitTime = Random.Range(60, 120); }
  Update() {
    if (this.waitTime > 0) this.waitTime -= Time.deltaTime; else if (!this.active) this.Activate();
    if (this.active) { this.activeTime += Time.deltaTime; if (this.activeTime >= 180 && V.mag(V.sub(this.transform.position, this.player.position)) >= 120) this.Reset(); }
    if (this.guilt > 0) this.guilt -= Time.deltaTime;
  }
  FixedUpdate() {
    const dir = V.sub(this.player.position, this.transform.position);
    const h = Physics.Raycast(V.add(this.transform.position, v3(0, 4, 0)), dir, Infinity, NPC_MASCARA, IGNORAR);
    if (h && h.transform.tag === 'Player' && V.mag(V.sub(this.transform.position, this.player.position)) <= 30 && this.active) {
      if (!this.spoken) { this.audioDevice.PlayOneShot(this.aud_Taunts[Mathf.RoundToInt(Random.Range(0, 1))]); this.spoken = true; }
      this.guilt = 10;
    }
  }
  Activate() {
    this.wanderer.GetNewTargetHallway();
    this.transform.position = V.add(this.wanderTarget.position, v3(0, 5, 0));
    while (V.mag(V.sub(this.transform.position, this.player.position)) < 20) { this.wanderer.GetNewTargetHallway(); this.transform.position = V.add(this.wanderTarget.position, v3(0, 5, 0)); }
    this.active = true;
  }
  OnTriggerEnter(other) {
    if (other.transform.tag !== 'Player') return;
    const gc = this.gc;
    if (gc.item[0] === 0 && gc.item[1] === 0 && gc.item[2] === 0) { this.audioDevice.PlayOneShot(this.aud_Denied); return; }
    let num = Mathf.RoundToInt(Random.Range(0, 2));
    while (gc.item[num] === 0) num = Mathf.RoundToInt(Random.Range(0, 2));
    gc.LoseItem(num);
    this.audioDevice.PlayOneShot(this.aud_Thanks[Mathf.RoundToInt(Random.Range(0, 1))]);
    this.Reset();
  }
  OnTriggerStay(other) { if (other.transform.name === 'Principal of the Thing' && this.guilt > 0) this.Reset(); }
  Reset() { this.transform.position = V.sub(this.transform.position, v3(0, 20, 0)); this.waitTime = Random.Range(60, 120); this.active = false; this.activeTime = 0; this.spoken = false; }
}

export class SweepScript extends MonoBehaviour {
  Start() { this.agent = this.GetComponent('NavMeshAgent'); this.audioDevice = this.GetComponent('AudioSource'); this.origin = this.transform.position; this.waitTime = Random.Range(120, 180); }
  Update() {
    if (this.coolDown > 0) this.coolDown -= 1 * Time.deltaTime;
    if (this.waitTime > 0) this.waitTime -= Time.deltaTime;
    else if (!this.active) { this.active = true; this.wanders = 0; this.Wander(); this.audioDevice.PlayOneShot(this.aud_Intro); }
  }
  FixedUpdate() {
    if (V.mag(this.agent.velocity) <= 0.1 && this.coolDown <= 0 && this.wanders < 5 && this.active) this.Wander();
    else if (this.wanders >= 5) this.GoHome();
  }
  Wander() { this.wanderer.GetNewTargetHallway(); this.agent.SetDestination(this.wanderTarget.position); this.coolDown = 1; this.wanders++; }
  GoHome() { this.agent.SetDestination(this.origin); this.waitTime = Random.Range(120, 180); this.wanders = 0; this.active = false; }
  OnTriggerEnter(other) { if (other.tag === 'NPC' || other.tag === 'Player') this.audioDevice.PlayOneShot(this.aud_Sweep); }
}

export class JumpRopeScript extends MonoBehaviour {
  OnEnable() {
    this.jumpDelay = 1; this.ropeHit = true; this.jumpStarted = false; this.jumps = 0;
    this.jumpCount.text = '0/5';
    this.cs.jumpHeight = 0;
    this.playtime.audioDevice.PlayOneShot(this.playtime.aud_ReadyGo);
  }
  Update() {
    if (this.jumpDelay > 0) this.jumpDelay -= Time.deltaTime;
    else if (!this.jumpStarted) { this.jumpStarted = true; this.ropePosition = 1; this.rope.SetTrigger('ActivateJumpRope'); this.ropeHit = false; }
    if (this.ropePosition > 0) this.ropePosition -= Time.deltaTime;
    else if (!this.ropeHit) this.RopeHit();
  }
  RopeHit() { this.ropeHit = true; if (this.cs.jumpHeight <= 0.2) this.Fail(); else this.Success(); this.jumpStarted = false; }
  Success() {
    const pt = this.playtime;
    pt.audioDevice.Stop(); pt.audioDevice.PlayOneShot(pt.aud_Numbers[this.jumps]);
    this.jumps++; this.jumpCount.text = this.jumps + '/5'; this.jumpDelay = 0.5;
    if (this.jumps >= 5) { pt.audioDevice.Stop(); pt.audioDevice.PlayOneShot(pt.aud_Congrats); this.ps.DeactivateJumpRope(); }
  }
  Fail() { this.jumps = 0; this.jumpCount.text = this.jumps + '/5'; this.jumpDelay = 2; this.playtime.audioDevice.PlayOneShot(this.playtime.aud_Oops); }
}

export class MathGameScript extends MonoBehaviour {
  constructor(n, d) {
    super(n, d);
    this.problem = 0; this.audioInQueue = 0; this.audioQueue = []; this.problemsWrong = 0; this.endDelay = 0;
    this.hintText = ['I GET ANGRIER FOR EVERY PROBLEM YOU GET WRONG', 'I HEAR EVERY DOOR YOU OPEN'];
    this.endlessHintText = ["That's more like it...", 'Keep up the good work or see me after class...'];
    this.questionInProgress = false; this.impossibleMode = false;
  }
  Start() {
    this.gc.ActivateLearningGame();
    if (this.gc.notebooks === 1) { this.QueueAudio(this.bal_intro); this.QueueAudio(this.bal_howto); }
    this.NewProblem();
    if (this.gc.spoopMode) this.baldiFeedTransform.position = v3(-1000, -1000, 0);
    if (ReInput.controllers.GetLastActiveControllerType() === ControllerType.Joystick) this.joystickEnabled = true;
  }
  Update() {
    if (!this.baldiAudio.isPlaying) {
      if (this.audioInQueue > 0 && !this.gc.spoopMode) this.PlayQueue();
      this.baldiFeed.SetBool('talking', false);
    } else this.baldiFeed.SetBool('talking', true);
    if ((Input.GetKeyDown('return') || Input.GetKeyDown('enter')) && this.questionInProgress) { this.questionInProgress = false; this.CheckAnswer(); }
    if (this.problem > 3) { this.endDelay -= 1 * Time.unscaledDeltaTime; if (this.endDelay <= 0) this.ExitGame(); }
  }
  NewProblem() {
    this.playerAnswer.text = '';
    this.problem++;
    this.playerAnswer.ActivateInputField();
    const gc = this.gc, R = (a, b) => Random.Range(a, b), num = (x) => String(Math.round(x * 1e4) / 1e4);
    if (this.problem <= 3) {
      this.QueueAudio(this.bal_problems[this.problem - 1]);
      if ((gc.mode === 'story' && (this.problem <= 2 || gc.notebooks <= 1)) || (gc.mode === 'endless' && (this.problem <= 2 || gc.notebooks !== 2))) {
        this.num1 = Mathf.RoundToInt(R(0, 9)); this.num2 = Mathf.RoundToInt(R(0, 9)); this.sign = Mathf.RoundToInt(R(0, 1));
        this.QueueAudio(this.bal_numbers[Mathf.RoundToInt(this.num1)]);
        if (this.sign === 0) { this.solution = this.num1 + this.num2; this.questionText.text = 'SOLVE MATH Q' + this.problem + ': \n \n' + this.num1 + '+' + this.num2 + '='; this.QueueAudio(this.bal_plus); }
        else if (this.sign === 1) { this.solution = this.num1 - this.num2; this.questionText.text = 'SOLVE MATH Q' + this.problem + ': \n \n' + this.num1 + '-' + this.num2 + '='; this.QueueAudio(this.bal_minus); }
        this.QueueAudio(this.bal_numbers[Mathf.RoundToInt(this.num2)]);
        this.QueueAudio(this.bal_equals);
      } else {
        this.impossibleMode = true;
        // (en el original el signo de los imposibles sale de Random.Range(0, 1) de enteros: siempre 0)
        const imposible = (t) => { this.num1 = R(1, 9999); this.num2 = R(1, 9999); this.num3 = R(1, 9999); this.sign = Random.RangeI(0, 1); t.text = this.sign === 0 ? 'SOLVE MATH Q' + this.problem + ': \n' + num(this.num1) + '+(' + num(this.num2) + 'X' + num(this.num3) + '=' : 'SOLVE MATH Q' + this.problem + ': \n (' + num(this.num1) + '/' + num(this.num2) + ')+' + num(this.num3) + '='; };
        imposible(this.questionText);
        this.QueueAudio(this.bal_screech);
        if (this.sign === 0) { this.QueueAudio(this.bal_plus); this.QueueAudio(this.bal_screech); this.QueueAudio(this.bal_times); this.QueueAudio(this.bal_screech); }
        else { this.QueueAudio(this.bal_divided); this.QueueAudio(this.bal_screech); this.QueueAudio(this.bal_plus); this.QueueAudio(this.bal_screech); }
        imposible(this.questionText2); imposible(this.questionText3);
        this.QueueAudio(this.bal_equals);
      }
      this.questionInProgress = true;
    } else {
      this.endDelay = 5;
      if (!gc.spoopMode) this.questionText.text = 'WOW! YOU EXIST!';
      else if (gc.mode === 'endless' && this.problemsWrong <= 0) this.questionText.text = this.endlessHintText[Mathf.RoundToInt(R(0, 1))];
      else if (gc.mode === 'story' && this.problemsWrong >= 3) {
        this.questionText.text = 'I HEAR MATH THAT BAD'; this.questionText2.text = ''; this.questionText3.text = '';
        this.baldiScript.Hear(this.playerPosition, 7); gc.failedNotebooks++;
      } else { this.questionText.text = this.hintText[Mathf.RoundToInt(R(0, 1))]; this.questionText2.text = ''; this.questionText3.text = ''; }
    }
  }
  OKButton() { this.CheckAnswer(); }
  CheckAnswer() {
    if (this.playerAnswer.text === '31718') { this.StartCoroutine(this.CheatText('THIS IS WHERE IT ALL BEGAN')); SceneManager.LoadSceneAsync('TestRoom'); }
    else if (this.playerAnswer.text === '53045009') { this.StartCoroutine(this.CheatText('USE THESE TO STICK TO THE CEILING!')); this.gc.Fliparoo(); }
    if (this.problem > 3) return;
    if (this.playerAnswer.text === String(this.solution) && !this.impossibleMode) {
      this.results[this.problem - 1].texture = this.correct;
      this.baldiAudio.Stop(); this.ClearAudioQueue();
      this.QueueAudio(this.bal_praises[Mathf.RoundToInt(Random.Range(0, 4))]);
      this.NewProblem();
      return;
    }
    this.problemsWrong++;
    this.results[this.problem - 1].texture = this.incorrect;
    if (!this.gc.spoopMode) { this.baldiFeed.SetTrigger('angry'); this.gc.ActivateSpoopMode(); }
    if (this.gc.mode === 'story') { if (this.problem === 3) this.baldiScript.GetAngry(1); else this.baldiScript.GetTempAngry(0.25); }
    else this.baldiScript.GetAngry(1);
    this.ClearAudioQueue(); this.baldiAudio.Stop();
    this.NewProblem();
  }
  QueueAudio(s) { this.audioQueue[this.audioInQueue] = s; this.audioInQueue++; }
  PlayQueue() { this.baldiAudio.PlayOneShot(this.audioQueue[0]); this.UnqueueAudio(); }
  UnqueueAudio() { for (let i = 1; i < this.audioInQueue; i++) this.audioQueue[i - 1] = this.audioQueue[i]; this.audioInQueue--; }
  ClearAudioQueue() { this.audioInQueue = 0; }
  ExitGame() { if (this.problemsWrong <= 0 && this.gc.mode === 'endless') this.baldiScript.GetAngry(-1); this.gc.DeactivateLearningGame(this.gameObject); }
  ButtonPress(value) {
    if (value >= 0 && value <= 9) this.playerAnswer.text += value;
    else if (value === -1) this.playerAnswer.text += '-';
    else this.playerAnswer.text = '';
  }
  *CheatText(text) { while (true) { this.questionText.text = text; this.questionText2.text = ''; this.questionText3.text = ''; yield WaitForEndOfFrame(); } }
}

export class NotebookScript extends MonoBehaviour {
  Start() { this.playerInput = ReInput.players.GetPlayer(0); this.up = true; }
  Update() {
    if (this.gc.mode === 'endless') {
      if (this.respawnTime > 0) { if (V.mag(V.sub(this.transform.position, this.player.position)) > 60) this.respawnTime -= Time.deltaTime; }
      else if (!this.up) { const p = this.transform.position; this.transform.position = v3(p.x, 4, p.z); this.up = true; this.audioDevice.Play(); }
    }
    if (this.playerInput.GetButtonDown('Interact') && Time.timeScale !== 0) {
      const h = Physics.Raycast(rayoCentro());
      if (h && h.transform.tag === 'Notebook' && V.dist(this.player.position, this.transform.position) < this.openingDistance) {
        const p = this.transform.position; this.transform.position = v3(p.x, -20, p.z);
        this.up = false; this.respawnTime = 120;
        this.gc.CollectNotebook();
        const g = Instantiate(this.learningGame);
        const m = g.GetComponent('MathGameScript');
        m.gc = this.gc; m.baldiScript = this.bsc; m.playerPosition = this.player.position;
      }
    }
  }
}

const PICKUPS = { Pickup_EnergyFlavoredZestyBar: 1, Pickup_YellowDoorLock: 2, Pickup_Key: 3, Pickup_BSODA: 4, Pickup_Quarter: 5, Pickup_Tape: 6, Pickup_AlarmClock: 7, 'Pickup_WD-3D': 8, Pickup_SafetyScissors: 9, Pickup_BigBoots: 10 };
export class PickupScript extends MonoBehaviour {
  Start() { this.playerInput = ReInput.players.GetPlayer(0); }
  Update() {
    if (!this.playerInput.GetButtonDown('Interact') || Time.timeScale === 0) return;
    const h = Physics.Raycast(rayoCentro());
    if (!h) return;
    const id = PICKUPS[h.transform.name];
    if (id && V.dist(this.player.position, this.transform.position) < 10) { h.transform.gameObject.SetActive(false); this.gc.CollectItem(id); }
  }
}

export class DoorScript extends MonoBehaviour {
  get DoorLocked() { return this.bDoorLocked; }
  Start() { this.playerInput = ReInput.players.GetPlayer(0); this.myAudio = this.GetComponent('AudioSource'); this.openTime = 0; this.bDoorOpen = false; this.bDoorLocked = false; }
  Update() {
    if (this.lockTime > 0) this.lockTime -= 1 * Time.deltaTime; else if (this.bDoorLocked) this.UnlockDoor();
    if (this.openTime > 0) this.openTime -= 1 * Time.deltaTime;
    if (this.openTime <= 0 && this.bDoorOpen) {
      this.barrier.enabled = true; this.invisibleBarrier.enabled = true; this.bDoorOpen = false;
      this.inside.material = this.closed; this.outside.material = this.closed;
      if (this.silentOpens <= 0) this.myAudio.PlayOneShot(this.doorClose, 1);
    }
    if (!this.playerInput.GetButtonDown('Interact') || Time.timeScale === 0) return;
    const h = Physics.Raycast(rayoCentro());
    if (h && h.collider === this.trigger && V.dist(this.player.position, this.transform.position) < this.openingDistance && !this.bDoorLocked) {
      if (this.baldi.isActiveAndEnabled && this.silentOpens <= 0) this.baldi.Hear(this.transform.position, 1);
      this.OpenDoor();
      if (this.silentOpens > 0) this.silentOpens--;
    }
  }
  OpenDoor() {
    if (this.silentOpens <= 0 && !this.bDoorOpen) this.myAudio.PlayOneShot(this.doorOpen, 1);
    this.barrier.enabled = false; this.invisibleBarrier.enabled = false; this.bDoorOpen = true;
    this.inside.material = this.open; this.outside.material = this.open; this.openTime = 3;
  }
  OnTriggerStay(other) { if (!this.bDoorLocked && other.CompareTag('NPC')) this.OpenDoor(); }
  LockDoor(time) { this.bDoorLocked = true; this.lockTime = time; }
  UnlockDoor() { this.bDoorLocked = false; }
  SilenceDoor() { this.silentOpens = 4; }
}

export class SwingingDoorScript extends MonoBehaviour {
  Start() { this.myAudio = this.GetComponent('AudioSource'); this.bDoorLocked = true; this.openTime = 0; this.lockTime = 0; this.requirementMet = false; }
  Update() {
    if (!this.requirementMet && this.gc.notebooks >= 2) { this.requirementMet = true; this.UnlockDoor(); }
    if (this.openTime > 0) this.openTime -= 1 * Time.deltaTime;
    if (this.lockTime > 0) this.lockTime -= Time.deltaTime; else if (this.bDoorLocked && this.requirementMet) this.UnlockDoor();
    if (this.openTime <= 0 && this.bDoorOpen && !this.bDoorLocked) { this.bDoorOpen = false; this.inside.material = this.closed; this.outside.material = this.closed; }
  }
  OnTriggerStay() { if (!this.bDoorLocked) { this.bDoorOpen = true; this.inside.material = this.open; this.outside.material = this.open; this.openTime = 2; } }
  OnTriggerEnter(other) {
    if (!(this.gc.notebooks < 2 && other.tag === 'Player') && !this.bDoorLocked) {
      this.myAudio.PlayOneShot(this.doorOpen, 1);
      if (other.tag === 'Player' && this.baldi.isActiveAndEnabled) this.baldi.Hear(this.transform.position, 1);
    }
  }
  LockDoor(time) { this.barrier.enabled = true; this.obstacle.SetActive(true); this.bDoorLocked = true; this.lockTime = time; this.inside.material = this.locked; this.outside.material = this.locked; }
  UnlockDoor() { this.barrier.enabled = false; this.obstacle.SetActive(false); this.bDoorLocked = false; this.inside.material = this.closed; this.outside.material = this.closed; }
}

export class DarkDoorScript extends MonoBehaviour {
  Update() { this.mesh.material = this.door.bDoorOpen ? this.lightDoo60 : this.door.bDoorLocked ? this.lightDooLock : this.lightDoo0; }
}
export class EntranceScript extends MonoBehaviour {
  Lower() { this.transform.position = V.sub(this.transform.position, v3(0, 10, 0)); if (this.gc.finaleMode) this.wall.material = this.map; }
  Raise() { this.transform.position = V.add(this.transform.position, v3(0, 10, 0)); }
}
export class ExitTriggerScript extends MonoBehaviour {
  OnTriggerEnter(other) { if (this.gc.notebooks >= 7 && other.tag === 'Player') SceneManager.LoadScene(this.gc.failedNotebooks >= 7 ? 'Secret' : 'Results'); }
}
export class NearExitTriggerScript extends MonoBehaviour {
  OnTriggerEnter(other) { if (this.gc.exitsReached < 3 && this.gc.finaleMode && other.tag === 'Player') { this.gc.ExitReached(); this.es.Lower(); this.gc.baldiScrpt.Hear(this.transform.position, 8); } }
}
export class FacultyTriggerScript extends MonoBehaviour {
  Start() { this.hitBox = this.GetComponent('BoxCollider'); }
  OnTriggerStay(other) { if (other.gameObject.CompareTag('Player')) this.ps.ResetGuilt('faculty', 1); }
}
export class NeedMoreScript extends MonoBehaviour {
  OnTriggerEnter(other) { if (this.gc.notebooks < 2 && other.tag === 'Player') this.audioDevice.PlayOneShot(this.baldiDoor, 1); }
}
export class AILocationSelectorScript extends MonoBehaviour {
  GetNewTarget() { this.id = Mathf.RoundToInt(Random.Range(0, 28)); this.transform.position = this.newLocation[this.id].position; this.ambience.PlayAudio(); }
  GetNewTargetHallway() { this.id = Mathf.RoundToInt(Random.Range(0, 15)); this.transform.position = this.newLocation[this.id].position; this.ambience.PlayAudio(); }
  QuarterExclusive() { this.id = Mathf.RoundToInt(Random.Range(1, 15)); this.transform.position = this.newLocation[this.id].position; }
}
export class AmbienceScript extends MonoBehaviour {
  PlayAudio() {
    const num = Mathf.RoundToInt(Random.Range(0, 49));
    if (!this.audioDevice.isPlaying && num === 0) { this.transform.position = this.aiLocation.position; this.audioDevice.PlayOneShot(this.sounds[Mathf.RoundToInt(Random.Range(0, this.sounds.length - 1))]); }
  }
}
export class AudioQueueScript extends MonoBehaviour {
  constructor(n, d) { super(n, d); this.audioInQueue = 0; this.audioQueue = []; }
  Start() { this.audioDevice = this.GetComponent('AudioSource'); }
  Update() { if (!this.audioDevice.isPlaying && this.audioInQueue > 0) this.PlayQueue(); }
  QueueAudio(s) { this.audioQueue[this.audioInQueue] = s; this.audioInQueue++; }
  PlayQueue() { this.audioDevice.PlayOneShot(this.audioQueue[0]); this.UnqueueAudio(); }
  UnqueueAudio() { for (let i = 1; i < this.audioInQueue; i++) this.audioQueue[i - 1] = this.audioQueue[i]; this.audioInQueue--; }
  ClearAudioQueue() { this.audioInQueue = 0; }
}
export class Billboard extends MonoBehaviour {
  Start() { this.m_Camera = Camera.main; }
  LateUpdate() { const c = this.m_Camera?.nodo?.destruido === false ? this.m_Camera : (this.m_Camera = Camera.main); if (!c) return; this.transform.LookAt(V.add(this.transform.position, Quat.rot(c.transform.rotation, V.forward()))); }
}
export class PickupAnimationScript extends MonoBehaviour {
  Start() { this.itemPosition = this.transform; }
  Update() { this.itemPosition.localPosition = v3(0, Math.sin(Time.frameCount * (Math.PI / 180)) / 2 + 1, 0); }
}
export class TapePlayerScript extends MonoBehaviour {
  Start() { this.audioDevice = this.GetComponent('AudioSource'); }
  Update() {
    if (this.audioDevice.isPlaying && Time.timeScale === 0) this.audioDevice.Pause();
    else if (Time.timeScale > 0 && this.baldi.antiHearingTime > 0) this.audioDevice.UnPause();
  }
  Play() { this.sprite.sprite = this.closedSprite; this.audioDevice.Play(); this.baldi.ActivateAntiHearing(30); }
}
export class QuarterSpawnScript extends MonoBehaviour {
  Start() { this.wanderer.QuarterExclusive(); this.transform.position = V.add(this.location.position, V.mul(V.up(), 4)); }
}
export class BsodaEffectScript extends MonoBehaviour {
  Start() { this.agent = this.GetComponent('NavMeshAgent'); this.inBsoda = false; this.failSave = 0; }
  Update() {
    if (this.inBsoda) this.agent.velocity = this.otherVelocity;
    if (this.failSave > 0) this.failSave -= Time.deltaTime; else this.inBsoda = false;
  }
  OnTriggerStay(other) {
    if (other.tag === 'BSODA') { this.inBsoda = true; this.otherVelocity = other.GetComponent('Rigidbody')?.velocity || other.attachedRigidbody?.velocity || v3(); this.failSave = 1; }
    else if (other.transform.name === 'Gotta Sweep') { this.inBsoda = true; this.otherVelocity = V.add(V.mul(this.transform.forward, this.agent.speed * 0.1), other.GetComponent('NavMeshAgent').velocity); this.failSave = 1; }
  }
  OnTriggerExit() { this.inBsoda = false; }
}
export class BsodaSparyScript extends MonoBehaviour {
  Start() { this.rb = this.GetComponent('Rigidbody'); this.rb.velocity = V.mul(this.transform.forward, this.speed); this.lifeSpan = 30; }
  Update() { this.rb.velocity = V.mul(this.transform.forward, this.speed); this.lifeSpan -= Time.deltaTime; if (this.lifeSpan < 0) Destroy(this.gameObject, 0); }
}
export class AlarmClockScript extends MonoBehaviour {
  Start() { this.timeLeft = 30; this.lifeSpan = 35; this.rang = false; }
  Update() {
    if (this.timeLeft >= 0) this.timeLeft -= Time.deltaTime; else if (!this.rang) this.Alarm();
    if (this.lifeSpan >= 0) this.lifeSpan -= Time.deltaTime; else Destroy(this.gameObject, 0);
  }
  Alarm() { this.rang = true; this.baldi.Hear(this.transform.position, 8); this.audioDevice.clip = this.ring; this.audioDevice.loop = false; this.audioDevice.Play(); }
}
export class DetentionTextScript extends MonoBehaviour {
  Start() { this.text = this.GetComponent('TMP_Text'); }
  Update() { this.text.text = this.door.lockTime > 0 ? 'You have detention! \n' + Math.ceil(this.door.lockTime) + ' seconds remain!' : ''; }
}
export class ItemImageScript extends MonoBehaviour {
  Update() {
    if (this.gs) { const t = this.gs.itemSlot[this.gs.itemSelected].texture; this.sprite.texture = t === this.blankSprite ? this.noItemSprite : t; }
    else this.sprite.texture = this.noItemSprite;
  }
}
// Script.cs (el final secreto): suena y vuelve al menú
export class Script extends MonoBehaviour {
  Update() { if (!this.audioDevice.isPlaying && this.played) SceneManager.LoadScene('MainMenu'); }
  OnTriggerEnter(other) { if (other.name === 'Player' && !this.played) { this.audioDevice.Play(); this.played = true; } }
}

registrar(GameControllerScript, PlayerScript, CameraScript, BaldiScript, PrincipalScript, PlaytimeScript, FirstPrizeScript, FirstPrizeSpriteScript, CraftersScript, CraftersTriggerScript,
  BullyScript, SweepScript, JumpRopeScript, MathGameScript, NotebookScript, PickupScript, DoorScript, SwingingDoorScript, DarkDoorScript, EntranceScript, ExitTriggerScript,
  NearExitTriggerScript, FacultyTriggerScript, NeedMoreScript, AILocationSelectorScript, AmbienceScript, AudioQueueScript, Billboard, PickupAnimationScript, TapePlayerScript,
  QuarterSpawnScript, BsodaEffectScript, BsodaSparyScript, AlarmClockScript, DetentionTextScript, ItemImageScript, Script);
