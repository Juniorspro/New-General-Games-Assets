package com.juniorspro.nexoxr;

/**
 * NEXO INICIO: los pasos para preparar el espacio antes de empezar.
 *
 *   ELEGIR   → Mesa (sentado) · Cuarto (parado, caminando) · Sólo girar
 *   ESCANEAR → mirás la mesa (o el cuarto) y ARCore la encuentra; la mesa se
 *              confirma sola cuando es grande y no cambia 1.2 s (o con "Esta es")
 *   MANOS    → apoyás las manos en la mesa, sobre las guías: con la mesa se
 *              mide a qué distancia están, y con eso el tamaño de tus manos
 *   CABEZA   → mirás al frente, quieto 1.2 s: ahí quedan tus pantallas
 *   LISTO    → "Empezar"
 *
 * Lo llama el hilo de dibujo (con lo que ve ARCore) y lo lee la ventana del
 * inicio (en el hilo de la app): por eso lo que se muestra es volatile.
 * Sin Android (se prueba en la PC).
 */
public final class Inicio {
    public static final int ELEGIR = 0, ESCANEAR = 1, MANOS = 2, CABEZA = 3, LISTO = 4, FUERA = 5;
    public static final int MESA = 1, CUARTO = 2, GIRAR = 3;

    static final long ESTABLE_MS = 1200, QUIETO_MS = 1200, MANOS_MAX_MS = 25000;
    /** Muestras de la escala por mano (unas 2 s con la mano quieta). */
    static final int MUESTRAS = 20;
    /** El cuarto: con esto de planos (m²) y el piso, está. */
    static final float AREA_CUARTO = 3.5f;
    /** Quieto: menos de esto de giro (°/s) y de movimiento (m/s). */
    static final float GIRO_QUIETO = 9f, MUEVE_QUIETO = 0.08f;

    public volatile int paso = ELEGIR, modo = MESA;
    /** 0..1 del paso actual. */
    public volatile float progreso;

    // ── escanear ──
    /** La candidata (el id del plano) o 0; su área (m²) y medidas (m: largo, ancho). */
    public volatile int candidata;
    public volatile float area;
    public volatile float[] medidas = {0, 0};
    private long candidataDesde;
    /** La que se eligió (el id del plano de ARCore). */
    public volatile int mesa;
    /** La interfaz pidió "Esta es mi mesa". */
    public volatile boolean pidioConfirmar;
    /** Cuándo se confirmó (para la onda que recorre la mesa). */
    public volatile long confirmadaEn = -1;
    // el cuarto
    public volatile float areaCuarto;
    public volatile boolean hayPiso;
    public volatile int planosCuarto;

    // ── manos ──
    private final float[][] muestras = new float[2][MUESTRAS * 2];
    private final int[] cuantas = new int[2];
    private long manosDesde = -1;
    /** Si cada mano está sobre su guía ahora (para pintarla). */
    public volatile boolean izqSobre, derSobre;
    /** El resultado: la escala de cada mano y la de las dos (NaN si no se midió). */
    public volatile float escalaIzq = Float.NaN, escalaDer = Float.NaN, escala = Float.NaN;

    // ── cabeza ──
    private long quietoDesde = -1;
    public final float[] cabeza = new float[3];
    public volatile float yaw;
    public volatile boolean cabezaFija;

    /** Lo último que pasó (una línea para mostrar). */
    public volatile String estado = "";

    public int muestrasIzq() { return cuantas[0]; }
    public int muestrasDer() { return cuantas[1]; }

    // ───────────────────────── los pasos ─────────────────────────

    /** Se eligió cómo usarlo. */
    public synchronized void elegir(int m, long ms) {
        modo = m;
        progreso = 0;
        candidata = 0;
        mesa = 0;
        area = 0;
        candidataDesde = -1;
        confirmadaEn = -1;
        pidioConfirmar = false;
        estado = "";
        paso = m == GIRAR ? CABEZA : ESCANEAR;
        quietoDesde = -1;
    }

    /**
     * ESCANEAR la mesa, cada cuadro: la mejor candidata (id del plano, 0 si no
     * hay), su área y medidas. Se confirma sola cuando es buena y no cambia
     * 1.2 s, o cuando se pide. true si se confirmó en este cuadro.
     */
    public synchronized boolean escanearMesa(int id, float a, float[] med, long ms) {
        if (paso != ESCANEAR || modo != MESA) return false;
        if (id != candidata) { candidata = id; candidataDesde = ms; }
        area = id == 0 ? 0 : a;
        if (med != null) medidas = med.clone();
        if (id == 0) {
            progreso = 0;
            estado = "Buscando una superficie…";
            pidioConfirmar = false;
            return false;
        }
        float estable = Math.min(1, (ms - candidataDesde) / (float) ESTABLE_MS);
        float tam = Math.min(1, a / Mesa.AREA_BUENA);
        progreso = 0.75f * tam + 0.25f * estable;
        estado = String.format(java.util.Locale.ROOT, "Encontré una superficie de %.0f × %.0f cm", medidas[0] * 100, medidas[1] * 100);
        boolean sola = tam >= 1 && estable >= 1;
        boolean pedida = pidioConfirmar && a >= Mesa.AREA_MIN;
        pidioConfirmar = false;
        if (sola || pedida) {
            mesa = id;
            confirmadaEn = ms;
            progreso = 1;
            estado = "¡Tu mesa!";
            paso = MANOS;
            manosDesde = ms;
            cuantas[0] = cuantas[1] = 0;
            return true;
        }
        return false;
    }

    /** ESCANEAR el cuarto, cada cuadro: el área de los planos y si ya está el piso. true cuando alcanza. */
    public synchronized boolean escanearCuarto(float a, int planos, boolean piso, long ms) {
        if (paso != ESCANEAR || modo != CUARTO) return false;
        areaCuarto = a;
        hayPiso = piso;
        planosCuarto = planos;
        progreso = Math.min(piso ? 1 : 0.8f, a / AREA_CUARTO);
        estado = String.format(java.util.Locale.ROOT, "%d superficies · %.1f m²%s", planos, a, piso ? " · el piso ✓" : " · falta el piso");
        if ((piso && a >= AREA_CUARTO) || (pidioConfirmar && piso)) {
            pidioConfirmar = false;
            progreso = 1;
            confirmadaEn = ms;
            paso = CABEZA;
            quietoDesde = -1;
            return true;
        }
        pidioConfirmar = false;
        return false;
    }

    /**
     * MANOS: si cada mano está sobre su guía, y la escala medida en esta imagen
     * (NaN si no se pudo). Con las muestras de las dos manos (o muchas de una)
     * termina; a los 25 s, igual con lo que haya.
     */
    public synchronized void manos(boolean izqSobre, boolean derSobre, float escIzq, float escDer, long ms) {
        if (paso != MANOS) return;
        this.izqSobre = izqSobre;
        this.derSobre = derSobre;
        if (izqSobre && escIzq == escIzq) agregar(0, escIzq);
        if (derSobre && escDer == escDer) agregar(1, escDer);
        int a = cuantas[0], b = cuantas[1];
        progreso = Math.min(1, (Math.min(a, MUESTRAS) + Math.min(b, MUESTRAS)) / (2f * MUESTRAS));
        boolean dos = a >= MUESTRAS && b >= MUESTRAS, una = a >= 2 * MUESTRAS || b >= 2 * MUESTRAS;
        boolean tarde = manosDesde >= 0 && ms - manosDesde > MANOS_MAX_MS && (a + b) >= MUESTRAS / 2;
        estado = (izqSobre ? "izquierda ✓" : "izquierda…") + "   " + (derSobre ? "derecha ✓" : "derecha…");
        if (dos || una || tarde) terminarManos();
    }

    private void agregar(int lado, float s) {
        if (cuantas[lado] < muestras[lado].length) muestras[lado][cuantas[lado]++] = s;
    }

    private void terminarManos() {
        escalaIzq = mediana(muestras[0], cuantas[0]);
        escalaDer = mediana(muestras[1], cuantas[1]);
        float[] todas = new float[cuantas[0] + cuantas[1]];
        System.arraycopy(muestras[0], 0, todas, 0, cuantas[0]);
        System.arraycopy(muestras[1], 0, todas, cuantas[0], cuantas[1]);
        escala = mediana(todas, todas.length);
        estado = escala == escala ? String.format(java.util.Locale.ROOT, "Manos medidas (×%.2f)", escala) : "";
        paso = CABEZA;
        progreso = 0;
        quietoDesde = -1;
    }

    static float mediana(float[] v, int n) {
        if (n <= 0) return Float.NaN;
        float[] o = java.util.Arrays.copyOf(v, n);
        java.util.Arrays.sort(o);
        return n % 2 == 1 ? o[n / 2] : (o[n / 2 - 1] + o[n / 2]) / 2;
    }

    /**
     * CABEZA: la velocidad de giro (°/s) y de la posición (m/s) ahora, dónde
     * está y hacia dónde mira (yaw). Quieto 1.2 s: queda fija. true si se fijó.
     */
    public synchronized boolean cabeza(float giro, float mueve, float[] pos, float yawAhora, long ms) {
        if (paso != CABEZA) return false;
        if (giro < GIRO_QUIETO && mueve < MUEVE_QUIETO) {
            if (quietoDesde < 0) quietoDesde = ms;
        } else quietoDesde = -1;
        progreso = quietoDesde < 0 ? 0 : Math.min(1, (ms - quietoDesde) / (float) QUIETO_MS);
        estado = quietoDesde < 0 ? "Quedate quieto un momento…" : "Así…";
        if (progreso >= 1) {
            System.arraycopy(pos, 0, cabeza, 0, 3);
            yaw = yawAhora;
            cabezaFija = true;
            paso = LISTO;
            progreso = 1;
            estado = "";
            return true;
        }
        return false;
    }

    /** "Saltar": al paso que sigue (sin lo de este). */
    public synchronized void saltar(long ms) {
        switch (paso) {
            case ELEGIR: elegir(GIRAR, ms); break;
            case ESCANEAR:
                if (modo == MESA) { modo = GIRAR; mesa = 0; }
                paso = CABEZA; progreso = 0; quietoDesde = -1; break;
            case MANOS: terminarManos(); break;
            case CABEZA: paso = LISTO; progreso = 1; break;
            default: paso = FUERA;
        }
    }

    /** "Otra": volver a escanear (la mesa elegida no era). */
    public synchronized void rehacer(long ms) {
        if (modo == GIRAR) modo = MESA;
        elegir(modo, ms);
    }

    /** "Empezar". */
    public synchronized void empezar() { paso = FUERA; }

    /** Cuántos pasos se muestran (los puntitos de arriba) y en cuál está. */
    public int pasos() { return modo == MESA ? 4 : modo == CUARTO ? 3 : 2; }

    public int numero() {
        switch (paso) {
            case ELEGIR: return 0;
            case ESCANEAR: return 1;
            case MANOS: return 2;
            case CABEZA: return modo == MESA ? 3 : modo == CUARTO ? 2 : 1;
            default: return pasos();
        }
    }
}
