package com.juniorspro.asaltomr;

import java.util.HashMap;
import java.util.Map;

/**
 * El CONTROL BLUETOOTH (el blanco del VR Box, un joystick, un teclado): qué
 * hace cada botón.
 *
 * El control del VR Box manda cosas distintas según su modo (@ + A/B/C/D, o
 * la llave M/G): teclas de música (play/pausa, siguiente, volumen), botones de
 * gamepad (A, B, R1…), el joystick como ejes o como flechas, o un mouse. Por
 * eso hay un mapa por defecto que cubre todos esos modos y, además, se pueden
 * APRENDER los botones: el juego pide "apretá el botón para disparar" y se
 * queda con el que llegue.
 *
 * El joystick analógico (y los gatillos analógicos) se vuelven "teclas" de
 * mentira (JOY_IZQ…, GATILLO_DER…) con histéresis, así se aprenden igual.
 *
 * Sin Android: los códigos son los de android.view.KeyEvent (comprobados contra
 * android.jar); se prueba en la PC (pruebas/PruebaControl.java).
 */
public final class Control {
    public static final int NADA = 0, DISPARAR = 1, RECARGAR = 2, SIGUIENTE = 3, ANTERIOR = 4, MENU = 5;
    public static final String[] ACCIONES = {"—", "disparar", "recargar", "arma siguiente", "arma anterior", "menú"};
    /** Lo que se aprende, en orden (lo demás queda como venía). */
    public static final int[] PASOS = {DISPARAR, RECARGAR, SIGUIENTE, MENU};
    /** Cuánto se espera en cada paso antes de saltearlo (ms). */
    public static final long ESPERA_PASO = 8000;

    // las "teclas" del joystick y de los gatillos analógicos
    public static final int JOY_IZQ = 10001, JOY_DER = 10002, JOY_ARR = 10003, JOY_ABA = 10004, GATILLO_DER = 10005, GATILLO_IZQ = 10006;
    static final float PRENDE = 0.6f, APAGA = 0.35f;

    // android.view.KeyEvent
    static final int BACK = 4, DPAD_UP = 19, DPAD_DOWN = 20, DPAD_LEFT = 21, DPAD_RIGHT = 22, DPAD_CENTER = 23,
            VOLUME_UP = 24, VOLUME_DOWN = 25, CAMERA = 27, TAB = 61, SPACE = 62, ENTER = 66, HEADSETHOOK = 79, MENU_TECLA = 82,
            MEDIA_PLAY_PAUSE = 85, MEDIA_STOP = 86, MEDIA_NEXT = 87, MEDIA_PREVIOUS = 88, MEDIA_REWIND = 89, MEDIA_FAST_FORWARD = 90,
            BUTTON_A = 96, BUTTON_B = 97, BUTTON_C = 98, BUTTON_X = 99, BUTTON_Y = 100, BUTTON_Z = 101, BUTTON_L1 = 102, BUTTON_R1 = 103,
            BUTTON_L2 = 104, BUTTON_R2 = 105, BUTTON_THUMBL = 106, BUTTON_THUMBR = 107, BUTTON_START = 108, BUTTON_SELECT = 109,
            BUTTON_MODE = 110, MEDIA_PLAY = 126, MEDIA_PAUSE = 127, NUMPAD_ENTER = 160, BUTTON_1 = 188, BUTTON_2 = 189, BUTTON_3 = 190,
            BUTTON_4 = 191;

    private static final HashMap<Integer, Integer> DEFECTO = new HashMap<>();

    private static void por(int accion, int... codigos) { for (int c : codigos) DEFECTO.put(c, accion); }

    static {
        // disparar: el gatillo del VR Box en cualquier modo (música: play/pausa; gamepad: A o R1/R2; teclado: Enter),
        // el volumen del teléfono y el disparador de selfie
        por(DISPARAR, VOLUME_UP, VOLUME_DOWN, CAMERA, BUTTON_A, BUTTON_R1, BUTTON_R2, BUTTON_THUMBR, BUTTON_1, ENTER, NUMPAD_ENTER,
                DPAD_CENTER, SPACE, MEDIA_PLAY_PAUSE, MEDIA_PLAY, MEDIA_PAUSE, HEADSETHOOK, GATILLO_DER);
        por(RECARGAR, BUTTON_B, BUTTON_X, BUTTON_L2, BUTTON_2, MEDIA_STOP, DPAD_DOWN, JOY_ABA, GATILLO_IZQ);
        por(SIGUIENTE, BUTTON_Y, BUTTON_L1, BUTTON_3, TAB, MEDIA_NEXT, MEDIA_FAST_FORWARD, DPAD_RIGHT, JOY_DER);
        por(ANTERIOR, BUTTON_4, MEDIA_PREVIOUS, MEDIA_REWIND, DPAD_LEFT, JOY_IZQ);
        // el menú (también "Atrás" que venga del control: el clic derecho del modo mouse, o su botón de volver)
        por(MENU, BUTTON_START, BUTTON_SELECT, BUTTON_MODE, BUTTON_C, BUTTON_Z, BUTTON_THUMBL, MENU_TECLA, BACK);
    }

    /** Lo aprendido (le gana al mapa por defecto). */
    private final HashMap<Integer, Integer> aprendido = new HashMap<>();

    public int accion(int codigo) {
        Integer a = aprendido.get(codigo);
        if (a != null) return a;
        a = DEFECTO.get(codigo);
        return a == null ? NADA : a;
    }

    /** codigo hace accion (lo que ese botón hacía antes, deja de hacerlo). */
    public void asignar(int accion, int codigo) { aprendido.put(codigo, accion); }

    public void olvidar() { aprendido.clear(); }

    /** Lo aprendido como texto ("103:1,97:2"), para guardarlo. */
    public String guardar() {
        StringBuilder s = new StringBuilder();
        for (Map.Entry<Integer, Integer> e : aprendido.entrySet()) {
            if (s.length() > 0) s.append(',');
            s.append(e.getKey()).append(':').append(e.getValue());
        }
        return s.toString();
    }

    public void cargar(String s) {
        aprendido.clear();
        if (s == null || s.isEmpty()) return;
        for (String p : s.split(",")) {
            String[] kv = p.split(":");
            if (kv.length != 2) continue;
            try {
                int a = Integer.parseInt(kv[1]);
                if (a > NADA && a <= MENU) aprendido.put(Integer.parseInt(kv[0]), a);
            } catch (NumberFormatException e) { /* se ignora */ }
        }
    }

    // ── el joystick y los gatillos analógicos → "teclas" ──

    private final boolean[] prendida = new boolean[6];

    /**
     * Los ejes del control (x, y ∈ −1..1, y para abajo positivo como Android;
     * gatillos 0..1). Devuelve los cambios: +código = se apretó, −código = se soltó.
     */
    public int[] ejes(float x, float y, float der, float izq) {
        float[] v = {-x, x, -y, y, der, izq};
        int[] cambios = new int[6];
        int n = 0;
        for (int k = 0; k < 6; k++) {
            boolean p = prendida[k] ? v[k] > APAGA : v[k] > PRENDE;
            if (p != prendida[k]) { prendida[k] = p; cambios[n++] = p ? JOY_IZQ + k : -(JOY_IZQ + k); }
        }
        return java.util.Arrays.copyOf(cambios, n);
    }

    // ── el disparo sostenido (el fusil tira mientras esté apretado) ──

    private final java.util.HashSet<Integer> disparando = new java.util.HashSet<>();

    /**
     * Un botón que se apretó (baja) o se soltó. Devuelve la acción que hay que
     * hacer AHORA (NADA si no hay que hacer nada: se soltó, o es una repetición).
     * repite: la tecla sigue apretada (Android repite).
     */
    public int evento(int codigo, boolean baja, boolean repite, long ahoraMs) {
        if (aprendiendo()) {
            if (baja && !repite) aprender(codigo, ahoraMs);
            return NADA;
        }
        int a = accion(codigo);
        if (a == DISPARAR) { if (baja) disparando.add(codigo); else disparando.remove(codigo); }
        if (!baja || repite) return NADA;
        return a;
    }

    /** ¿Hay algún botón de disparar apretado? */
    public boolean sostenido() { return !disparando.isEmpty(); }

    public void soltarTodo() { disparando.clear(); java.util.Arrays.fill(prendida, false); }

    // ── aprender los botones ──

    private int paso = -1;
    private long desdePaso;
    private final java.util.HashSet<Integer> usados = new java.util.HashSet<>();
    /** Qué se aprendió en la última configuración ("disparar: BUTTON_R1"…), para mostrarlo. */
    public final int[] aprendidos = new int[PASOS.length];

    public void empezarAprender(long ahoraMs) {
        paso = 0;
        desdePaso = ahoraMs;
        usados.clear();
        java.util.Arrays.fill(aprendidos, 0);
        soltarTodo();
    }

    public boolean aprendiendo() { return paso >= 0; }

    /** El paso (0..) y la acción que se está pidiendo, o NADA. */
    public int pasoActual() { return paso; }

    public int pidiendo() { return paso >= 0 ? PASOS[paso] : NADA; }

    /** Cuánto falta para saltear este paso (ms). */
    public long falta(long ahoraMs) { return Math.max(0, ESPERA_PASO - (ahoraMs - desdePaso)); }

    /** Pasa el tiempo: si nadie apretó nada, se saltea el paso (queda lo que había). Devuelve true si se terminó. */
    public boolean esperar(long ahoraMs) {
        if (paso < 0) return false;
        if (ahoraMs - desdePaso > ESPERA_PASO) return avanzar(ahoraMs);
        return false;
    }

    private void aprender(int codigo, long ahoraMs) {
        if (usados.contains(codigo)) return;   // el mismo botón no hace dos cosas
        usados.add(codigo);
        asignar(PASOS[paso], codigo);
        aprendidos[paso] = codigo;
        avanzar(ahoraMs);
    }

    private boolean avanzar(long ahoraMs) {
        paso++;
        desdePaso = ahoraMs;
        if (paso >= PASOS.length) { paso = -1; return true; }
        return false;
    }

    /** El nombre de las teclas de mentira (las de verdad las nombra Android). */
    public static String nombre(int codigo) {
        switch (codigo) {
            case JOY_IZQ: return "joystick ←";
            case JOY_DER: return "joystick →";
            case JOY_ARR: return "joystick ↑";
            case JOY_ABA: return "joystick ↓";
            case GATILLO_DER: return "gatillo derecho";
            case GATILLO_IZQ: return "gatillo izquierdo";
            default: return null;
        }
    }
}
