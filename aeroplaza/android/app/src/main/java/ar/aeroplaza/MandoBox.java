package ar.aeroplaza;

/* (vuelta 44) EL MANDO VR BOX, y cualquier mando Bluetooth. La WebView no le pasa los mandos a la página: la Gamepad
   API de Chrome necesita que la actividad le reenvíe los eventos, y en una WebView nadie lo hace. Acá se traducen las
   teclas y la palanca de Android a un mando "estándar" (los números de botón de la Gamepad API) y el juego los lee igual
   que un mando del navegador (mando-box.js).
   - Modo juego (el VR Box con @+B): los botones A, B, X, Y, L1, R1, start… y la palanca (AXIS_X/Y, o la cruz
     AXIS_HAT_X/Y).
   - Modo música (@+A): arriba/abajo llegan como volumen +/−, izquierda/derecha como tema anterior/siguiente y el
     gatillo como play/pausa. Eso se toma solo en el VR: afuera, el volumen tiene que andar como siempre.
   - Lo que no es de un mando (las flechas del modo teclas, el mouse del modo mouse) sigue a la WebView tal cual.
   Sin nada de Android adentro: así se prueba con javac (pruebas/mando/PruebaMando.java). */
final class MandoBox {
  /* los KeyEvent.KEYCODE_* de Android que importan (copiados: son fijos desde la API 1-12) */
  static final int K_DPAD_UP = 19, K_DPAD_DOWN = 20, K_DPAD_LEFT = 21, K_DPAD_RIGHT = 22, K_DPAD_CENTER = 23;
  static final int K_VOL_UP = 24, K_VOL_DOWN = 25, K_ENTER = 66, K_HEADSETHOOK = 79, K_PLAY_PAUSE = 85, K_NEXT = 87,
    K_PREVIOUS = 88, K_REWIND = 89, K_FAST_FORWARD = 90, K_PLAY = 126, K_PAUSE = 127;
  static final int K_BUTTON_A = 96, K_BUTTON_B = 97, K_BUTTON_C = 98, K_BUTTON_X = 99, K_BUTTON_Y = 100, K_BUTTON_Z = 101,
    K_L1 = 102, K_R1 = 103, K_L2 = 104, K_R2 = 105, K_THUMBL = 106, K_THUMBR = 107, K_START = 108, K_SELECT = 109, K_MODE = 110;
  static final int K_BUTTON_1 = 188, K_BUTTON_16 = 203;
  /* los botones "de más" (no están en la Gamepad API): los del modo música y el OK de la cruz */
  static final int ADELANTE = 20, ATRAS = 21, GIRA_IZQ = 22, GIRA_DER = 23, PLAY = 24, OK = 25;

  /* la tecla → el botón estándar (0 A · 1 B · 2 X · 3 Y · 4 L1 · 5 R1 · 6 L2 · 7 R2 · 8 select · 9 start ·
     10/11 las palancas · 12-15 la cruz · 16 modo) o uno de más (20-25); −1: no es del mando (sigue a la WebView).
     deMando: la tecla vino de un mando (la fuente es gamepad o joystick); enVR: el juego está en el VR */
  static int boton(int k, boolean deMando, boolean enVR) {
    switch (k) {
      case K_BUTTON_A: return 0; case K_BUTTON_B: return 1; case K_BUTTON_X: return 2; case K_BUTTON_Y: return 3;
      case K_BUTTON_C: return 2; case K_BUTTON_Z: return 3;
      case K_L1: return 4; case K_R1: return 5; case K_L2: return 6; case K_R2: return 7;
      case K_SELECT: return 8; case K_START: return 9; case K_THUMBL: return 10; case K_THUMBR: return 11; case K_MODE: return 16;
      default: break;
    }
    if (k >= K_BUTTON_1 && k <= K_BUTTON_16) return k - K_BUTTON_1;   // (los genéricos BUTTON_1..16, de mandos sin nombre)
    /* la cruz: si es de un mando, es el mando; si es de un teclado (el modo teclas), las flechas siguen a la página */
    if (deMando) switch (k) {
      case K_DPAD_UP: return 12; case K_DPAD_DOWN: return 13; case K_DPAD_LEFT: return 14; case K_DPAD_RIGHT: return 15;
      case K_DPAD_CENTER: case K_ENTER: return OK;
      default: break;
    }
    /* el modo música: solo en el VR */
    if (enVR) switch (k) {
      case K_VOL_UP: return ADELANTE; case K_VOL_DOWN: return ATRAS;
      case K_PREVIOUS: case K_REWIND: return GIRA_IZQ; case K_NEXT: case K_FAST_FORWARD: return GIRA_DER;
      case K_PLAY_PAUSE: case K_PLAY: case K_PAUSE: case K_HEADSETHOOK: return PLAY;
      case K_DPAD_CENTER: case K_ENTER: return OK;
      default: break;
    }
    return -1;
  }

  /* el mensaje al juego por una tecla (null: nada que mandar). repeticion: la tecla sostenida que Android repite (ya se
     sabe que está apretada: no se manda, pero se consume) */
  static String tecla(int k, boolean abajo, int repeticion, boolean deMando, boolean enVR) {
    int b = boton(k, deMando, enVR);
    if (b < 0 || (abajo && repeticion > 0)) return null;
    return "__nativo&&__nativo.mandoBoton&&__nativo.mandoBoton(" + b + "," + (abajo ? 1 : 0) + ")";
  }

  /* la palanca: la de verdad, o la cruz si la palanca está quieta (el VR Box, según el firmware, da una o la otra).
     Solo se manda si cambió (más de 0,02) o si volvió al medio */
  private float ux = 0, uy = 0;
  String eje(float x, float y, float hx, float hy) {
    if (Math.abs(x) < 0.12f && Math.abs(y) < 0.12f) { x = hx; y = hy; }
    if (Math.abs(x) < 0.12f) x = 0; if (Math.abs(y) < 0.12f) y = 0;
    boolean medio = x == 0 && y == 0, antesMedio = ux == 0 && uy == 0;
    if (Math.abs(x - ux) < 0.02f && Math.abs(y - uy) < 0.02f && medio == antesMedio) return null;
    ux = x; uy = y;
    return String.format(java.util.Locale.ROOT, "__nativo&&__nativo.mandoEje&&__nativo.mandoEje(%.3f,%.3f)", x, y);
  }
}
