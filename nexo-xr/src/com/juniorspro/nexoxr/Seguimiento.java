package com.juniorspro.nexoxr;

/**
 * NEXO TRACK: la capa entre ARCore y lo que se dibuja, para que el mundo no
 * "se mueva solo". ARCore no se puede tocar por dentro (es cerrado); esto
 * arregla lo que pasa entre su pose y la pantalla:
 *
 *  1. LA DEMORA. La pose de ARCore es la de cuando se sacó la foto (30 a
 *     80 ms antes) y la imagen llega a los ojos un cuadro después. En el visor,
 *     girando la cabeza a 100°/s, son 5 a 10° de atraso: todo se arrastra con
 *     vos y vuelve. Acá, la rotación de esa foto se lleva hasta el momento en
 *     que se va a ver con el giroscopio del teléfono (200 veces por segundo),
 *     y un poco más adelante (la predicción). La posición sigue siendo la de
 *     ARCore (se nota mucho menos).
 *  2. LAS CORRECCIONES. Cuando ARCore reconoce un lugar ya visto, corrige su
 *     mapa y todo lo que no está anclado salta o se desliza. El escritorio se
 *     cuelga de un ANCLA: ARCore la mueve con sus correcciones y todo se
 *     acomoda con ella (queda pegado al lugar de verdad, sin saltar).
 *  3. LAS PÉRDIDAS. Si ARCore pierde el seguimiento (poca luz, la cámara
 *     tapada, moverse rápido) nada desaparece: se sigue girando con el
 *     giroscopio con la posición quieta; cuando vuelve, el salto se funde en
 *     medio segundo. Lo mismo con cualquier salto imposible (más de 12 cm de
 *     un cuadro al otro).
 *  5. 3DoF (Sólo girar): {@link #tres} no usa ARCore para nada: la cabeza
 *     sale sólo del giroscopio (GAME_ROTATION_VECTOR, con la gravedad: no se
 *     inclina nunca) y el cuello queda quieto. Nunca "se mueve solo" ni se
 *     pierde, y anda aunque ARCore no siga (poca luz, pared lisa). ARCore
 *     queda sólo para la cámara (el passthrough y las manos).
 *  4. LOS OJOS. En el visor los ojos no están donde la cámara: están unos
 *     7 cm atrás y a un costado (la cámara está en una punta del teléfono).
 *     Dibujar desde la cámara hace que al girar la cabeza lo cercano se
 *     deslice. La posición de los ojos la da {@link Cuello} (sola, mirando
 *     cómo girás) o los ajustes.
 *
 * Sin Android (se prueba en la PC). Matrices 4×4 por columnas (como OpenGL y
 * ARCore). "Mundo" = el de ARCore; "escritorio" = el del ancla (lo que se
 * dibuja). La pose del "display" es la de la cámara girada como la pantalla
 * (x a la derecha, y arriba, −z adelante).
 */
final class Seguimiento {
    static final int NADA = 0, SEIS = 1, GIRO = 2, TRES = 3;   // sin pose / ARCore 6DoF / perdido: sólo girar / 3DoF (sólo el giroscopio)

    // ── el giroscopio: las orientaciones del teléfono (cuaterniones x, y, z, w; del teléfono al mundo) ──
    private static final int N = 512;
    private final long[] gt = new long[N];
    private final float[][] gq = new float[N][4];
    private int gn, gi;

    /** Una muestra del GAME_ROTATION_VECTOR (la hora en ns, en la misma base que las fotos). */
    synchronized void giro(long t, float x, float y, float z, float w) {
        float l = (float) Math.sqrt(x * x + y * y + z * z + w * w);
        if (l < 1e-6f) return;
        x /= l; y /= l; z /= l; w /= l;
        if (gn > 0) {
            int u = (gi - 1 + N) % N;
            if (t <= gt[u]) return;
            float[] p = gq[u];
            if (p[0] * x + p[1] * y + p[2] * z + p[3] * w < 0) { x = -x; y = -y; z = -z; w = -w; }   // el mismo hemisferio (interpolar bien)
        }
        gt[gi] = t;
        gq[gi][0] = x; gq[gi][1] = y; gq[gi][2] = z; gq[gi][3] = w;
        gi = (gi + 1) % N;
        if (gn < N) gn++;
    }

    boolean hayGiro() { return gn >= 2; }

    /**
     * Si t cae donde hay giroscopio (hasta 0.3 s más adelante que la última
     * muestra). Si la hora de las fotos viniera en otra base (algún teléfono
     * raro), no se usa el giroscopio: mejor sin predecir que girar cualquier cosa.
     */
    synchronized boolean cubre(long t) {
        if (gn < 2) return false;
        int u = (gi - 1 + N) % N, pri = (gi - gn + N) % N;
        return t >= gt[pri] && t <= gt[u] + 300_000_000L;
    }

    /**
     * La orientación en t: interpolada entre muestras, o estirada con la
     * velocidad de giro de los últimos 20 ms (hasta 80 ms hacia adelante).
     */
    synchronized boolean orientacion(long t, float[] q) {
        if (gn < 2) return false;
        int u = (gi - 1 + N) % N, pri = (gi - gn + N) % N;
        if (t >= gt[u]) {
            // hacia adelante: con la velocidad de giro (de una muestra de ~20 ms antes, para que no tiemble)
            int a = u;
            for (int k = 1; k < gn; k++) { a = (u - k + N) % N; if (gt[u] - gt[a] >= 20_000_000L) break; }
            long dtm = gt[u] - gt[a];
            if (dtm <= 0) { System.arraycopy(gq[u], 0, q, 0, 4); return true; }
            float[] d = new float[4];
            mulQ(conjQ(gq[a]), gq[u], d);
            float f = Math.min(t - gt[u], 80_000_000L) / (float) dtm;
            potQ(d, f, d);
            mulQ(gq[u], d, q);
            return true;
        }
        if (t <= gt[pri]) { System.arraycopy(gq[pri], 0, q, 0, 4); return true; }
        // búsqueda desde la más nueva (casi siempre es de las últimas)
        int b = u;
        for (int k = 1; k < gn; k++) {
            int a = (u - k + N) % N;
            if (gt[a] <= t) { float f = (t - gt[a]) / (float) (gt[b] - gt[a]); slerp(gq[a], gq[b], f, q); return true; }
            b = a;
        }
        System.arraycopy(gq[pri], 0, q, 0, 4);
        return true;
    }

    /** La velocidad de giro ahora (°/s), para mostrar. */
    synchronized float velocidad() {
        if (gn < 2) return 0;
        int u = (gi - 1 + N) % N, a = (u - 1 + N) % N;
        float[] d = new float[4];
        mulQ(conjQ(gq[a]), gq[u], d);
        float ang = 2 * (float) Math.acos(Math.min(1, Math.abs(d[3])));
        return (float) Math.toDegrees(ang) / Math.max(1e-4f, (gt[u] - gt[a]) / 1e9f);
    }

    // ── el estado ──
    int modo = NADA;
    /** Cuántas veces se perdió, y cuánto hace. */
    int perdidas;
    long perdidoDesde;
    /** Lo último que se calculó (para mostrar). */
    float demoraMs, correccionCm, correccionGrados;

    private final float[] wsBase = new float[16], sd = new float[16], qBase = new float[4];
    private boolean hayQBase;
    private long tBase;

    // el ancla: C = A_ahora · A_ref⁻¹ (suavizada); escritorio = C⁻¹ · mundo
    private final float[] cPos = new float[3], cRot = {0, 0, 0, 1};
    private final float[] aRefPos = new float[3], aRefRot = {0, 0, 0, 1};
    private boolean hayAncla;

    // el fundido de los saltos (en el escritorio)
    private final float[] bPos = new float[3], bRot = {0, 0, 0, 1};
    private final float[] salPos = new float[3], salRot = {0, 0, 0, 1};
    private final float[] crudoPos = new float[3];
    private boolean haySalida;
    private long tUltimo;

    /** La salida: dónde está la pantalla en el escritorio al verse, y la foto (sin predicción) en el escritorio. */
    final float[] pose = new float[16], poseFoto = new float[16];

    /**
     * TU MESA: si false, la posición NO sigue a ARCore: el cuello queda donde
     * estaba y la cabeza sólo gira (con ARCore y el giroscopio). Lo pone el
     * sistema cada cuadro: true si la cámara está viendo la mesa marcada (o no
     * se usa la mesa). Así no hay nada que "adivinar": mirando la pared lisa o
     * el techo, nada se desliza; al volver a ver la mesa, se acomoda suave.
     */
    volatile boolean puedeMoverse = true;
    /** Si la posición está fija ahora (para mostrar), y dónde quedó el cuello. */
    volatile boolean fijo;
    final float[] cuelloFijo = new float[3];

    /**
     * Cada cuadro.
     * @param tFoto     la hora de la foto de ARCore (ns, la base del giroscopio)
     * @param rastrea   ARCore dice TRACKING
     * @param wSensor   la pose del teléfono (ejes de los sensores de Android) en el mundo, en esa foto
     * @param wDisplay  la pose de la cámara girada como la pantalla, en el mundo, en esa foto
     * @param tVer      cuándo se va a ver (ns): ahora + la predicción; = tFoto para no predecir
     * @return          si hay pose para dibujar
     */
    boolean cuadro(long tFoto, boolean rastrea, float[] wSensor, float[] wDisplay, long tVer) {
        int antes = modo;
        if (rastrea) {
            System.arraycopy(wSensor, 0, wsBase, 0, 16);
            float[] inv = new float[16];
            invRigida(wSensor, inv);
            mul(inv, wDisplay, sd);
            tBase = tFoto;
            hayQBase = cubre(tFoto) && orientacion(tFoto, qBase);
            modo = SEIS;
            haySeis = true;
        } else if (modo != NADA && haySeis) {
            if (modo == SEIS) { perdidas++; perdidoDesde = tVer; }
            modo = GIRO;
        } else return false;
        // de 3DoF (o del arranque, antes de que ARCore siga) a 6DoF sin ancla todavía: el escritorio se
        // pone justo donde lo estabas viendo (sin saltar ni girar: el rumbo del giroscopio no es el de ARCore)
        if (antes == TRES && modo == SEIS && !hayAncla && haySalida) {
            float[] w0 = new float[16], pi = new float[16], c = new float[16];
            llevar(tVer, w0);
            invRigida(pose, pi);
            mul(w0, pi, c);
            aCuat(c, cRot);
            cPos[0] = c[12]; cPos[1] = c[13]; cPos[2] = c[14];
        }
        // la foto y el momento de verse: la base llevada con el giroscopio
        float[] w = new float[16];
        llevar(tFoto, w);
        aEscritorio(w, poseFoto);
        llevar(tVer, w);
        float[] crudo = new float[16];
        aEscritorio(w, crudo);
        demoraMs = (tVer - tFoto) / 1e6f;

        // la mesa: sin verla, el cuello se queda quieto (sólo se gira)
        boolean estabaFijo = fijo;
        boolean fijar = !puedeMoverse && haySalida;
        if (fijar) {
            float[] cu = aplicarPunto(crudo, pivote);
            if (!estabaFijo) System.arraycopy(cu, 0, cuelloFijo, 0, 3);
            crudo[12] += cuelloFijo[0] - cu[0]; crudo[13] += cuelloFijo[1] - cu[1]; crudo[14] += cuelloFijo[2] - cu[2];
        }
        fijo = fijar;

        // los saltos: al volver de una pérdida, al volver a ver la mesa, o uno imposible, se funden
        float dt = tUltimo == 0 ? 0 : Math.min(0.2f, (tVer - tUltimo) / 1e9f);
        tUltimo = tVer;
        float[] rp = {crudo[12], crudo[13], crudo[14]}, rr = new float[4];
        aCuat(crudo, rr);
        boolean salto = haySalida && ((antes == GIRO && modo == SEIS) || antes == TRES || (estabaFijo && !fijar)
                || (modo == SEIS && dist(rp, crudoPos) > 0.12f));
        if (salto) {
            for (int k = 0; k < 3; k++) bPos[k] = salPos[k] - rp[k];
            mulQ(salRot, conjQ(rr), bRot);
        } else if (dt > 0) {
            float f = (float) Math.exp(-dt / 0.18f);
            for (int k = 0; k < 3; k++) bPos[k] *= f;
            slerp(new float[]{0, 0, 0, 1}, bRot, f, bRot);
        }
        System.arraycopy(rp, 0, crudoPos, 0, 3);
        for (int k = 0; k < 3; k++) salPos[k] = rp[k] + bPos[k];
        mulQ(bRot, rr, salRot);
        normQ(salRot);
        deCuat(salRot, salPos, pose);
        haySalida = true;
        return true;
    }

    // ── 3DoF: sólo el giroscopio ──

    /** Del mundo de los sensores (x este, y norte, z arriba) al de OpenGL (y arriba, −z norte), por columnas. */
    static final float[] ENU_A_GL = {1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1};
    /** La pantalla en el marco del teléfono, acostado (ROTATION_90: la parte de arriba del teléfono a la izquierda) o al revés (270). */
    static final float[] PANTALLA_90 = {0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};
    static final float[] PANTALLA_270 = {0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};
    private boolean haySeis;
    private float tresRumbo;
    private final float[] tresCuello = new float[3];

    /** La pantalla en el mundo de OpenGL según el giroscopio en t (sin rumbo ni posición). */
    boolean pantallaGiro(long t, boolean al270, float[] out) {
        float[] q = new float[4];
        if (!orientacion(t, q)) return false;
        float[] r = new float[16], a = new float[16];
        deCuat(q, new float[3], r);
        mul(ENU_A_GL, r, a);
        mul(a, al270 ? PANTALLA_270 : PANTALLA_90, out);
        return true;
    }

    /** Hacia dónde mira (el ángulo alrededor de Y; 0 = −Z, positivo a la izquierda). */
    static float rumbo(float[] m) { return (float) Math.atan2(m[8], m[10]); }

    /**
     * 3DoF: la cabeza sólo gira (el giroscopio), el cuello quieto. Al entrar desde 6DoF queda mirando
     * para el mismo lado y el cuello donde estaba (no salta); al volver a 6DoF el salto se funde.
     * @param tFoto la hora de la foto de la cámara (para las manos), o = tVer si no hay cámara
     * @return si hay pose (hace falta el giroscopio)
     */
    boolean tres(long tFoto, long tVer, boolean al270) {
        float[] v = new float[16], f = new float[16];
        if (!pantallaGiro(tVer, al270, v)) return false;
        if (!pantallaGiro(tFoto, al270, f)) System.arraycopy(v, 0, f, 0, 16);
        if (modo != TRES) {
            tresRumbo = haySalida ? rumbo(pose) - rumbo(v) : 0;
            float[] c = haySalida ? aplicarPunto(pose, pivote) : new float[3];
            System.arraycopy(c, 0, tresCuello, 0, 3);
            modo = TRES;
        }
        colocar(v, pose);
        colocar(f, poseFoto);
        demoraMs = (tVer - tFoto) / 1e6f;
        // lo que sale, para que al volver a 6DoF se funda desde acá
        salPos[0] = pose[12]; salPos[1] = pose[13]; salPos[2] = pose[14];
        aCuat(pose, salRot);
        System.arraycopy(salPos, 0, crudoPos, 0, 3);
        bPos[0] = bPos[1] = bPos[2] = 0;
        bRot[0] = bRot[1] = bRot[2] = 0; bRot[3] = 1;
        haySalida = true;
        tUltimo = tVer;
        fijo = true;
        System.arraycopy(tresCuello, 0, cuelloFijo, 0, 3);
        return true;
    }

    private void colocar(float[] m, float[] out) {
        float[] ry = new float[16];
        float h = tresRumbo / 2;
        deCuat(new float[]{0, (float) Math.sin(h), 0, (float) Math.cos(h)}, new float[3], ry);
        mul(ry, m, out);
        float[] p = aplicarPunto(out, pivote);
        out[12] += tresCuello[0] - p[0]; out[13] += tresCuello[1] - p[1]; out[14] += tresCuello[2] - p[2];
    }

    /**
     * Alrededor de qué se gira (el cuello, en el marco de la pantalla): al
     * llevar la pose con el giroscopio, ese punto queda quieto, como pasa de
     * verdad (la cámara da la vuelta alrededor del cuello, no de sí misma).
     */
    final float[] pivote = {Cuello.OJOS_NORMAL[0], Cuello.OJOS_NORMAL[1] - Cuello.OJO_Y, Cuello.OJOS_NORMAL[2] - Cuello.OJO_Z};

    /** La base (la última foto con seguimiento) llevada hasta t con el giroscopio. */
    private void llevar(long t, float[] w) {
        float[] q = new float[4];
        mul(wsBase, sd, w);
        if (!(hayQBase && cubre(t) && orientacion(t, q))) return;
        float[] base = w.clone();
        float[] d = new float[4], r = new float[16], ws = new float[16];
        mulQ(conjQ(qBase), q, d);   // del teléfono en t al teléfono en la base
        deCuat(d, new float[3], r);
        mul(wsBase, r, ws);
        mul(ws, sd, w);
        // el cuello no se mueve: donde estaba en la base, sigue
        float[] pb = aplicarPunto(base, pivote), pt = aplicarPunto(w, pivote);
        w[12] += pb[0] - pt[0]; w[13] += pb[1] - pt[1]; w[14] += pb[2] - pt[2];
    }

    static float[] aplicarPunto(float[] m, float[] p) {
        return new float[]{m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]};
    }

    // ── el ancla ──

    /** Un ancla nueva (su pose en el mundo ahora): el escritorio no se mueve al cambiarla. */
    void nuevaAncla(float[] a) {
        // A_ref = C⁻¹ · A  →  C sigue igual
        float[] c = new float[16], ci = new float[16], ref = new float[16];
        deCuat(cRot, cPos, c);
        invRigida(c, ci);
        mul(ci, a, ref);
        aCuat(ref, aRefRot);
        aRefPos[0] = ref[12]; aRefPos[1] = ref[13]; aRefPos[2] = ref[14];
        hayAncla = true;
    }

    /** Cada cuadro, la pose del ancla (o null si ARCore no la está siguiendo: queda la última corrección). */
    void ancla(float[] a, float dt) {
        if (!hayAncla || a == null) return;
        float[] ref = new float[16], refi = new float[16], c = new float[16];
        deCuat(aRefRot, aRefPos, ref);
        invRigida(ref, refi);
        mul(a, refi, c);
        float[] qc = new float[4], pc = {c[12], c[13], c[14]};
        aCuat(c, qc);
        // al toque, sin suavizar: ARCore corrige el ancla y la cámara en el mismo cuadro, así que la
        // corrección entera deja la cabeza donde estaba (la cabeza no se movió: el que se corrigió fue el
        // mapa). Si alguna vez llegan en cuadros distintos, el salto se funde en cuadro() como cualquier otro.
        System.arraycopy(pc, 0, cPos, 0, 3);
        System.arraycopy(qc, 0, cRot, 0, 4);
        correccionCm = (float) Math.sqrt(cPos[0] * cPos[0] + cPos[1] * cPos[1] + cPos[2] * cPos[2]) * 100;
        correccionGrados = (float) Math.toDegrees(2 * Math.acos(Math.min(1, Math.abs(cRot[3]))));
    }

    /** La matriz del mundo de ARCore al escritorio (C⁻¹): para dibujar lo que ARCore da en el mundo (planos, puntos). */
    void desdeMundo(float[] out) {
        float[] c = new float[16];
        deCuat(cRot, cPos, c);
        invRigida(c, out);
    }

    /** Una pose del mundo de ARCore al escritorio. */
    void aEscritorio(float[] w, float[] out) {
        float[] c = new float[16], ci = new float[16];
        deCuat(cRot, cPos, c);
        invRigida(c, ci);
        mul(ci, w, out);
    }

    /** Un punto del mundo de ARCore al escritorio (in situ). */
    void puntoAEscritorio(float[] p) {
        float[] c = new float[16], ci = new float[16], out = new float[16], m = new float[16];
        deCuat(cRot, cPos, c);
        invRigida(c, ci);
        ident(m); m[12] = p[0]; m[13] = p[1]; m[14] = p[2];
        mul(ci, m, out);
        p[0] = out[12]; p[1] = out[13]; p[2] = out[14];
    }

    /** Los ojos: la pose de la pantalla corrida (x, y, z en su marco: derecha, arriba, atrás). */
    static void ojos(float[] pose, float x, float y, float z, float[] out) {
        float[] t = new float[16];
        ident(t); t[12] = x; t[13] = y; t[14] = z;
        mul(pose, t, out);
    }

    // ───────────────────────── cuentas ─────────────────────────

    static void ident(float[] m) { for (int i = 0; i < 16; i++) m[i] = i % 5 == 0 ? 1 : 0; }

    static void mul(float[] a, float[] b, float[] out) {
        float[] r = new float[16];
        for (int c = 0; c < 4; c++) for (int f = 0; f < 4; f++) {
            float s = 0;
            for (int k = 0; k < 4; k++) s += a[k * 4 + f] * b[c * 4 + k];
            r[c * 4 + f] = s;
        }
        System.arraycopy(r, 0, out, 0, 16);
    }

    /** La inversa de una pose (rotación + traslación). */
    static void invRigida(float[] m, float[] out) {
        float[] r = new float[16];
        for (int c = 0; c < 3; c++) for (int f = 0; f < 3; f++) r[c * 4 + f] = m[f * 4 + c];
        for (int f = 0; f < 3; f++) r[12 + f] = -(r[f] * m[12] + r[4 + f] * m[13] + r[8 + f] * m[14]);
        r[3] = r[7] = r[11] = 0; r[15] = 1;
        System.arraycopy(r, 0, out, 0, 16);
    }

    static float dist(float[] a, float[] b) {
        float x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2];
        return (float) Math.sqrt(x * x + y * y + z * z);
    }

    // cuaterniones (x, y, z, w)
    static float[] conjQ(float[] q) { return new float[]{-q[0], -q[1], -q[2], q[3]}; }

    static void mulQ(float[] a, float[] b, float[] out) {
        float x = a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1];
        float y = a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0];
        float z = a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3];
        float w = a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2];
        out[0] = x; out[1] = y; out[2] = z; out[3] = w;
    }

    static void normQ(float[] q) {
        float l = (float) Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
        if (l < 1e-9f) { q[0] = q[1] = q[2] = 0; q[3] = 1; return; }
        for (int i = 0; i < 4; i++) q[i] /= l;
    }

    /** q elevado a f (el mismo eje, f veces el ángulo). */
    static void potQ(float[] q, float f, float[] out) {
        float w = Math.max(-1, Math.min(1, q[3]));
        float s = (float) Math.sqrt(Math.max(0, 1 - w * w));
        if (s < 1e-7f) { out[0] = out[1] = out[2] = 0; out[3] = 1; return; }
        float ang = 2 * (float) Math.acos(w) * f;
        float ns = (float) Math.sin(ang / 2) / s;
        out[0] = q[0] * ns; out[1] = q[1] * ns; out[2] = q[2] * ns; out[3] = (float) Math.cos(ang / 2);
    }

    static void slerp(float[] a, float[] b, float f, float[] out) {
        float d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
        float[] bb = b.clone();
        if (d < 0) { d = -d; for (int i = 0; i < 4; i++) bb[i] = -bb[i]; }
        float ka, kb;
        if (d > 0.9995f) { ka = 1 - f; kb = f; }
        else {
            float th = (float) Math.acos(d), s = (float) Math.sin(th);
            ka = (float) Math.sin((1 - f) * th) / s;
            kb = (float) Math.sin(f * th) / s;
        }
        for (int i = 0; i < 4; i++) out[i] = ka * a[i] + kb * bb[i];
        normQ(out);
    }

    /** La rotación de una matriz → cuaternión. */
    static void aCuat(float[] m, float[] q) {
        float m00 = m[0], m11 = m[5], m22 = m[10], tr = m00 + m11 + m22;
        // m[c*4+f]: fila f, columna c
        float m01 = m[4], m02 = m[8], m10 = m[1], m12 = m[9], m20 = m[2], m21 = m[6];
        if (tr > 0) {
            float s = (float) Math.sqrt(tr + 1) * 2;
            q[3] = 0.25f * s; q[0] = (m21 - m12) / s; q[1] = (m02 - m20) / s; q[2] = (m10 - m01) / s;
        } else if (m00 > m11 && m00 > m22) {
            float s = (float) Math.sqrt(1 + m00 - m11 - m22) * 2;
            q[3] = (m21 - m12) / s; q[0] = 0.25f * s; q[1] = (m01 + m10) / s; q[2] = (m02 + m20) / s;
        } else if (m11 > m22) {
            float s = (float) Math.sqrt(1 + m11 - m00 - m22) * 2;
            q[3] = (m02 - m20) / s; q[0] = (m01 + m10) / s; q[1] = 0.25f * s; q[2] = (m12 + m21) / s;
        } else {
            float s = (float) Math.sqrt(1 + m22 - m00 - m11) * 2;
            q[3] = (m10 - m01) / s; q[0] = (m02 + m20) / s; q[1] = (m12 + m21) / s; q[2] = 0.25f * s;
        }
        normQ(q);
    }

    /** Cuaternión + posición → matriz. */
    static void deCuat(float[] q, float[] p, float[] m) {
        float x = q[0], y = q[1], z = q[2], w = q[3];
        m[0] = 1 - 2 * (y * y + z * z); m[1] = 2 * (x * y + z * w); m[2] = 2 * (x * z - y * w); m[3] = 0;
        m[4] = 2 * (x * y - z * w); m[5] = 1 - 2 * (x * x + z * z); m[6] = 2 * (y * z + x * w); m[7] = 0;
        m[8] = 2 * (x * z + y * w); m[9] = 2 * (y * z - x * w); m[10] = 1 - 2 * (x * x + y * y); m[11] = 0;
        m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1;
    }
}
