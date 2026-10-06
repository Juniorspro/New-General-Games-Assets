/* La historia de Pizza Delivery v0.2: los scripts de su Assembly-UnityScript.dll pasados a JS, con
   los diálogos por número (J.sub(n) = la línea n de datos/textos.json, que sale del juego), con
   los mismos tiempos (WaitForSeconds) y las mismas condiciones (los "static var" de MainScript, que
   sobreviven entre escenas como en Unity). Cada script es una función que recibe el juego (J), el nodo
   y sus campos; devuelve lo que necesita: onTrigger(otro), update(dt) o nada (solo corrutinas). */
import * as THREE from 'three';

export const G = { gamma: false }; // MainScript: static var
export function reiniciarEstado(nivel) {
  if (nivel === 'DollHouse' || nivel === 'end') return;
  Object.assign(G, {
    isMenuOpen: false, enteredKitchen: false, closetEntered: false, moneyGot: false, girlSpoken: false, remote: false, matchGot: false, wokeUp: false,
    girlSeen: false, sawCount: 0, isDead: false, moveLock: false, doorShut: false, pizzaKept: false, currentGone: false, shotsHeared: false,
    candleTaken: false, corpseSeen: false, pizzaOpenedSeen: false, mobileTaken: false, callEnded: false, conversationStarted: false,
    conversationOver: false, keySearched: false, moreShots: false, guyCorpseSeen: false, tvOn: false, telephoneRang: false, telephoneUsed: false,
    textSeen: false, ghostPresent: false, onGrass: true, onFloor: false,
  });
}
reiniciarEstado('');

const esJugador = (otro) => otro === 'Player';

/* las corrutinas: cada "yield WaitForSeconds(n)" es un await J.esperar(n) */
export const GUIONES = {
  DoorOpenClose(J, i, g) {
    let doorAnimate = true;
    return { async onTrigger(otro) {
      if (esJugador(otro) && doorAnimate) {
        doorAnimate = false;
        J.sonar(g.dingDong);
        await J.esperar(5); J.sub(0);
        await J.esperar(2); J.sub(1);
        await J.esperar(2); J.sub(2);
        await J.esperar(4); J.sub('');
        J.animar(i, 'DoorOpen'); J.sonar(g.doorOpenSound);
      } else if (esJugador(otro) && G.doorShut && !G.keySearched) {
        J.sonar(g.doorLocked); J.sub(3);
        await J.esperar(1); J.sub('');
      } else if (esJugador(otro) && G.keySearched) {
        J.animar(J.buscar('MainDoor'), 'DoorOpen'); J.sonar(g.doorOpenSound);
      }
    } };
  },
  lobbyTrigger(J, i, g) {
    return { async onTrigger(otro) {
      if (esJugador(otro) && G.corpseSeen && !G.pizzaOpenedSeen) {
        J.activoRec(g.girlTree, false); G.pizzaOpenedSeen = true;
        J.sub(40);
        await J.esperar(5); J.sub('');
        await J.esperar(3); J.sub(41);
        await J.esperar(3); J.sub('');
        J.loop(g.vibration, true); J.sonar(g.vibration);
        await J.esperar(3); J.sub(42);
        J.spawn();
      } else if (esJugador(otro) && !G.doorShut) {
        G.doorShut = true;
        J.animar(J.buscar('MainDoor'), 'DoorClose');
        J.sub(43);
        await J.esperar(2); J.sonar(g.doorCloseSound);
      } else if (esJugador(otro) && G.guyCorpseSeen && !G.tvOn) {
        G.tvOn = true; J.activoRec(g.tvNoise, true);
        await J.esperar(15); J.sonar(g.phoneRing); G.telephoneRang = true;
      } else if (esJugador(otro) && !G.pizzaKept) {
        J.sub(43);
      } else if (esJugador(otro) && G.mobileTaken && !G.enteredKitchen) {
        J.activoRec(g.ghostKitchen, true);
      }
    } };
  },
  PlacePizza(J, i, g) {
    return { async onTrigger(otro) {
      if (esJugador(otro) && G.doorShut && !G.pizzaKept) {
        J.sub('');
        J.activoRec(g.pizzaOnHand, false); J.activoRec(g.pizzaBox, true); J.sonar(g.pizzaPlaceSound);
        G.pizzaKept = true;
        await J.esperar(10); J.activoRec(g.electricity, false); G.currentGone = true;
        await J.esperar(4); J.sub(4);
        await J.esperar(3); J.sub('');
        await J.esperar(1); J.sub(5);
        await J.esperar(4); J.sub('');
        await J.esperar(1); J.sub(6);
        await J.esperar(3); J.sub('');
        await J.esperar(5); J.sub(7);
        await J.esperar(5); J.sub('');
        await J.esperar(4); J.sub(8); J.efecto('blur', true); J.sonar(g.insaneSound);
        await J.esperar(4); J.sub('');
        J.sub(9);
        await J.esperar(3); J.sub('');
        await J.esperar(4); J.sub(10);
        await J.esperar(5); J.sub('');
        await J.esperar(1); J.sub(11);
        await J.esperar(3); J.sub('');
        await J.esperar(3); J.sub(12);
        await J.esperar(4); J.sub(13);
        await J.esperar(5); J.sonar(g.crySound);
        await J.esperar(3); J.sub(14); G.shotsHeared = true;
        await J.esperar(3); J.sub('');
      } else if (esJugador(otro) && G.shotsHeared && !G.candleTaken) {
        J.spawn();
        J.activoRec(g.candleOnTable, false); J.activoRec(g.candleWithPlayer, true); G.candleTaken = true;
        J.activoRec(g.block1, false); J.sonar(g.candleSound); J.efecto('blur', false);
        J.sub(15); J.spawn();
        await J.esperar(3); J.sub('');
      }
    } };
  },
  remoteTakenTrigger(J, i) {
    return { onTrigger(otro) {
      if (esJugador(otro) && !G.currentGone && !G.pizzaKept && !G.remote) { J.sub(45); G.remote = true; J.destruir(i); }
    } };
  },
  playMovie(J, i, g) {
    J.renderOn(i, false);
    return { onTrigger(otro) {
      if (esJugador(otro) && G.remote) { J.renderOn(i, true); J.video(i, true); J.sonar(g.noise); J.sonar(g.girlSong); G.remote = false; }
    } };
  },
  roomTrigger(J, i, g) {
    return { async onTrigger(otro) {
      if (esJugador(otro) && !G.corpseSeen) {
        J.activoRec(g.girltree, true); J.activoRec(g.pizzaOpened, true); J.activoRec(g.pizzaBox, false);
        G.corpseSeen = true; J.sonar(g.buildUpSound);
        await J.esperar(4); J.sub(46);
        await J.esperar(7); J.sub(''); J.spawn();
      } else if (esJugador(otro) && G.moreShots && !G.guyCorpseSeen) { G.guyCorpseSeen = true; J.sonar(g.psychoSound); }
      else if (esJugador(otro) && G.conversationStarted && !G.keySearched) J.sonar(g.bassSound);
    } };
  },
  itsFromUpstairsMessage(J) {
    return { async onTrigger(otro) {
      if (esJugador(otro) && G.pizzaOpenedSeen && !G.mobileTaken) { J.sub(28); await J.esperar(3); J.sub(''); }
    } };
  },
  upstairMessage(J) {
    return { async onTrigger(otro) {
      if (esJugador(otro) && !G.currentGone) { J.sub(47); await J.esperar(2); J.sub(''); }
    } };
  },
  attendCell(J, i, g) {
    return { async onTrigger(otro) {
      if (esJugador(otro) && G.pizzaOpenedSeen && !G.mobileTaken) {
        J.sub(''); G.mobileTaken = true;
        J.parar(g.vibrate); J.activoRec(g.cellPhone, false); J.activoRec(g.textOnWall, true);
        J.sonar(g.answer);
        await J.esperar(1); J.sonar(g.phoneTalk); G.callEnded = true; J.spawn();
      }
    } };
  },
  textOnWallTrigger(J) {
    return { onTrigger(otro) { if (esJugador(otro) && !G.textSeen && G.mobileTaken) { G.textSeen = true; J.spawn(); } } };
  },
  attendPhone(J, i, g) {
    return { async onTrigger(otro) {
      if (esJugador(otro) && G.telephoneRang && !G.telephoneUsed) {
        G.telephoneUsed = true; J.activoRec(g.tvNoise, false); J.parar(g.telephoneRing); J.sonar(g.turnAround);
        J.sub(16);
        await J.esperar(3); J.sub(''); J.activoRec(g.lurker, true);
        await J.esperar(2); J.cargarNivel('Scene2');
      }
    } };
  },
  kitchenGhostTrigger(J, i, g) {
    return { async onTrigger(otro) {
      if (!(esJugador(otro) && !G.enteredKitchen && G.mobileTaken)) return;
      J.controles(false); J.mirarA(g.ghostHead); G.moveLock = true; G.enteredKitchen = true;
      J.sonar(g.slurpSound); J.animar(g.kitchenGhost, 'body180');
      await J.esperar(3); J.sonar(g.jumpSound);
      await J.esperar(1.5); J.destruir(g.kitchenGhost); J.parar(g.slurpSound); J.parar(g.jumpSound);
      J.controles(true); J.mirarA(null); J.efecto('blur', true); G.moveLock = false;
      J.sonar(g.heartBeat);
      await J.esperar(10); J.sub(29);
      await J.esperar(3); J.sub('');
      await J.esperar(2); J.sub(30); J.spawn();
      await J.esperar(5); J.sub('');
      await J.esperar(2); J.sub(31);
      await J.esperar(5); J.noTeMuevas(true);
      await J.esperar(5); J.sub('');
      J.animar(J.conTag('Fader'), 'fadeToBlack');
      await J.esperar(20); J.noTeMuevas(false);
      J.controles(false); G.moveLock = true;
      J.activoRec(g.candleWithPlayer, false); J.ambienteAzul(0.4);
      await J.esperar(5); J.sub(32);
      await J.esperar(3); J.sub('');
      await J.esperar(2); J.sub(33);
      await J.esperar(3); J.sub('');
      await J.esperar(2); J.sub(34);
      await J.esperar(3); J.sub('');
      await J.esperar(2); J.sub(35);
      await J.esperar(4); J.sub('');
      await J.esperar(2); J.animar(J.conTag('Fader'), 'fadeToWhite');
      await J.esperar(10); G.wokeUp = true; J.controles(true); G.moveLock = false;
      await J.esperar(5); J.sub(36);
      await J.esperar(4); J.sub('');
      await J.esperar(3); J.sub(37);
      await J.esperar(5); J.sub('');
      await J.esperar(3); J.sub(38);
      await J.esperar(10); J.sub('');
    } };
  },
  dontMoveKill(J) { return { update(dt, inp) { if (J.guionOn(this) && (inp.x || inp.y)) G.isDead = true; } }; },
  matchBoxTrigger(J, i, g) {
    return { async onTrigger(otro) {
      if (esJugador(otro) && G.wokeUp && !G.matchGot) {
        J.sonar(g.matchSound);
        await J.esperar(1); J.ambienteAzul(0.05); J.activoRec(g.candleWithPlayer, true); J.efecto('blur', false); G.matchGot = true; J.activoRec(g.girl, true);
      } else if (esJugador(otro) && !G.moneyGot) {
        G.moneyGot = true; J.destruir(g.money); J.sub(44);
        await J.esperar(3); J.sub('');
      }
    } };
  },
  girlTalkTrigger(J, i, g) {
    return { async onTrigger(otro) {
      if (!(esJugador(otro) && G.matchGot && !G.girlSpoken)) return;
      J.activoRec(g.key, true); J.controles(false); J.mirarA(g.girl); G.moveLock = true;
      await J.esperar(5); J.sub(23);
      await J.esperar(4); J.sub(24);
      await J.esperar(4); J.sub(25);
      await J.esperar(4); J.sub(26);
      await J.esperar(4); J.sub('');
      await J.esperar(1); J.sub(27);
      await J.esperar(4); J.sub('');
      J.activoRec(g.pictures, true); J.animar(g.girl, 'girlFloat'); G.girlSpoken = true;
      J.controles(true); J.mirarA(null); G.moveLock = false;
    } };
  },
  getKeyTrigger(J, i, g) {
    return { async onTrigger(otro) {
      if (!(esJugador(otro) && !G.keySearched && G.girlSpoken)) return;
      J.destruir(g.key); G.keySearched = true; J.sub(20); J.sonar(g.keySound); J.destruir(g.girlGhost);
      await J.esperar(3); J.sub('');
      await J.esperar(1); J.sonar(g.roar); J.loop(g.windBlow, true); J.sonar(g.windBlow);
      J.ambienteAzul(0.4); J.activoRec(g.candle, false); J.activoRec(g.stairBlocker, true); J.ambienteAzul(0.4);
      J.activoRec(g.monster, true); J.sub(21);
      await J.esperar(3); J.sub('');
      await J.esperar(3); J.sub(22);
      await J.esperar(3); J.sub('');
    } };
  },
  cupboardSearch(J, i, g) {
    return { async onTrigger(otro) {
      if (esJugador(otro) && G.conversationOver && !G.keySearched) {
        J.activoRec(g.jeep, false); G.keySearched = true; J.activoRec(g.pizzaPieces, true); J.activoRec(g.openPizza, false);
        await J.esperar(5); J.sub(18);
        await J.esperar(7); J.sub('');
      }
    } };
  },
  closetTrigger(J, i, g) {
    return { onTrigger(otro) { if (esJugador(otro) && G.keySearched && !G.closetEntered) J.animar(g.closet, 'closetOpenClose'); } };
  },
  closetInsideTrigger(J, i, g) {
    return { async onTrigger(otro) {
      if (!(esJugador(otro) && !G.closetEntered)) return;
      G.closetEntered = true; J.sonar(g.heartBeat); J.pararNodo(g.keyFindTrigger);
      await J.esperar(5); J.sub(17);
      await J.esperar(5); J.activoRec(g.finalDemon, true);
    } };
  },
  finalDemon(J) { return { onTrigger(otro) { if (esJugador(otro)) J.cargarNivel('Scene2'); } }; },
  pizzaPile(J) { return { onTrigger() { /* LoadLevel('Scene3'): no está en el build, no pasa nada */ } }; },
  deathAnimation(J, i, g) {
    let plug = false;
    return { update() {
      if (!G.isDead || plug || !J.guionOn(this)) return;
      plug = true; G.moveLock = true;
      (async () => {
        J.sonar(g.neckBreakSound); J.efecto('sepia', true); J.controles(false); J.mirarA(g.deathLookTarget);
        J.sangre();
        await J.esperar(5);
        if (J.nivel === 'NewScene1') J.cargarNivel('Menu'); else if (J.nivel === 'Scene2') J.cargarNivel('DollHouse');
      })().catch(J.cancelada);
    } };
  },
  /* el visor de enemigos (un disparador delante de la cámara) */
  sawGhost(J, i, g) {
    return { async onTriggerObj(o) {
      if (o.tag === 'Ghost' && J.nivel === 'NewScene1') {
        await J.esperar(0.5); J.sonar(g.jumpSound); G.ghostPresent = false; G.sawCount++; J.destruir(o.i);
      } else if (o.tag === 'FinalDemon' && J.nivel === 'Scene2') {
        J.sonar(g.roarSound); J.crossFade(o.i, 'roarM', 0.4); J.controles(false);
        J.mirarA(J.buscarEn(o.i, 'Bip001 Head') ?? o.i);
        await J.esperar(3); G.isDead = true;
      }
    } };
  },
  enemyFollow(J, i, g) {
    const r = J.O(i), q = new THREE.Quaternion(), m = new THREE.Matrix4(), adelante = new THREE.Vector3(), arriba = new THREE.Vector3(0, 1, 0);
    return { update(dt) {
      if (!J.guionOn(this) || !J.vivo(i)) return;
      const objetivo = J.jugadorPos();
      // Quaternion.LookRotation(target - pos): en three (z al revés) el "adelante" de Unity es -z
      m.lookAt(r.position, objetivo, arriba); q.setFromRotationMatrix(m);
      r.quaternion.slerp(q, Math.min(1, g.rotationSpeed * dt));
      adelante.set(0, 0, -1).applyQuaternion(r.quaternion);
      const d = r.position.distanceTo(objetivo);
      if (d > g.range) r.position.addScaledVector(adelante, g.moveSpeed * dt);
      else r.position.addScaledVector(adelante, -g.moveSpeed * dt);
      if (J.toca(i)) G.isDead = true;
    } };
  },
  enemyFollow1(J, i, g) {
    let plug = false;
    const r = J.O(i), q = new THREE.Quaternion(), m = new THREE.Matrix4(), adelante = new THREE.Vector3(), arriba = new THREE.Vector3(0, 1, 0);
    return { update(dt, inp) {
      if (plug || !J.guionOn(this) || !J.vivo(i)) return;
      if (inp.x || inp.y) {
        J.crossFade(i, 'walkM', 0.4); J.sonarSiNo(g.stepSound);
        const objetivo = J.posTag('PlayerPoint') || J.jugadorPos();
        m.lookAt(r.position, objetivo, arriba); q.setFromRotationMatrix(m);
        r.quaternion.slerp(q, Math.min(1, g.rotationSpeed * dt));
        adelante.set(0, 0, -1).applyQuaternion(r.quaternion);
        r.position.addScaledVector(adelante, g.moveSpeed * dt);
      } else if (!G.isDead) { J.parar(g.stepSound); J.crossFade(i, 'idleM', 0.4); }
      else { J.parar(g.stepSound); J.crossFade(i, 'roarM', 0.4); plug = true; }
      if (J.toca(i)) G.isDead = true;
    } };
  },
  zombieTrigger(J, i, g) {
    return { onTrigger(otro) {
      if (!esJugador(otro)) return;
      J.activoRec(g.zombies, true);
      const p = J.O(g.spawnPoint?.nodo)?.getWorldPosition(new THREE.Vector3());
      if (p) { p.y = 1; J.instanciar(g.demon, p, J.O(g.spawnPoint.nodo).getWorldQuaternion(new THREE.Quaternion())); }
    } };
  },
  followThePieces(J) {
    (async () => { await J.esperar(3); J.sub(19); await J.esperar(5); J.sub(''); })().catch(J.cancelada);
  },
  flashLightMove(J, i, g) {
    const r = J.O(i), p = new THREE.Vector3(), q = new THREE.Quaternion();
    return { update(dt) {
      const t = J.conTag('FlashLightPos'); if (t == null) return;
      J.O(t).getWorldPosition(p); J.O(t).getWorldQuaternion(q);
      r.position.lerp(p, Math.min(1, g.rotationSpeed * dt)); r.quaternion.slerp(q, Math.min(1, g.rotationSpeed * dt));
    } };
  },
  lightFlicker(J, i, g) {
    (async () => { for (;;) { J.luz(i, true); await J.esperar(g.minFlickerSpeed + Math.random() * (g.maxFlickerSpeed - g.minFlickerSpeed)); J.luz(i, false); await J.esperar(g.minFlickerSpeed + Math.random() * (g.maxFlickerSpeed - g.minFlickerSpeed)); } })().catch(J.cancelada);
  },
  SceneCutTo(J, i, g) { (async () => { await J.esperar(g.seconds); J.cargarNivel(g.cutToScene); })().catch(J.cancelada); },
  loadMenu(J, i) {
    (async () => {
      await J.esperar(2); J.sub(39);
      await J.esperar(3); J.sub(''); J.animar(i, 'fadeToWhite');
      await J.esperar(10); J.cargarNivel('Menu');
    })().catch(J.cancelada);
  },
  fader(J) { (async () => { await J.esperar(10); J.cargarNivel('end'); })().catch(J.cancelada); },
  clickDismissLoadingScreen(J, i, g) {
    J.controles(false); G.moveLock = true;
    return { update(dt, inp) {
      if (!inp.toque) return;
      J.controles(true); G.moveLock = false; J.destruir(i); J.activoRec(g.onScreentext, true, false);
    } };
  },
  inroText(J, i, g) {
    (async () => { await J.esperar(4); J.activoRec(g.secondText, true, false); await J.esperar(4); J.activoRec(g.thirdText, true, false); })().catch(J.cancelada);
  },
  cameraAnimator(J, i) {
    return { update(dt, inp) {
      if (!J.guionOn(this)) return;
      J.crossFade(i, (inp.x || inp.y) && !G.isDead && !G.moveLock ? 'walkCameraJunk' : 'idleCamera', 0.3);
    } };
  },
  walkRunSounds(J, i, g) {
    let plug = false;
    return { update(dt, inp) {
      if (!J.guionOn(this)) return;
      if ((inp.x || inp.y) && !G.isDead && !G.moveLock) {
        if (G.doorShut && !G.telephoneUsed) J.sonarSiNo(g.walkWoodClip); else J.sonarSiNo(g.runGrassClip);
      } else { J.parar(g.runGrassClip); J.parar(g.walkWoodClip); }
      if (G.doorShut && !plug) { J.parar(g.outSound); J.loop(g.inSound, true); J.sonar(g.inSound); plug = true; }
    } };
  },
  MainScript(J, i, g) {
    reiniciarEstado(J.nivel);
    if (J.nivel !== 'DollHouse' && J.nivel !== 'end') J.ambienteAzul(0.05);
    J.fantasmas = g.ghost || [];
  },
};
