package com.juniorspro.nexoxr;

import java.util.Random;

/**
 * NEXO TRACK con una cabeza simulada: gira (hasta ~170°/s), la cámara saca
 * fotos a 30 por segundo que llegan 60 ms tarde, el giroscopio a 200 por
 * segundo, la pantalla a 60 y lo que se dibuja se ve 25 ms después. Se compara
 * lo que se dibuja con dónde está la cabeza de verdad cuando se ve:
 *   · sin la capa (la pose de la última foto), con la capa (giroscopio + cuello);
 *   · se pierde el seguimiento 1.5 s caminando: no desaparece, sigue girando,
 *     y al volver no salta;
 *   · ARCore corrige el mapa (5 cm y 2°): con el ancla, el escritorio no salta;
 *   · un salto imposible de un cuadro: se funde;
 *   · los ojos: se encuentran solos girando la cabeza; caminando no se mide.
 */
public class PruebaSeguimiento {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    // ── la cabeza de verdad ──
    static final float[] PIVOTE = {0.06f, -0.06f, 0.155f};     // el cuello en el marco de la pantalla (la cámara, a 6 cm de costado)
    static final float[] SD = new float[16];                    // la pantalla en el marco de los sensores
    static final float[] G = new float[16];                     // el mundo del giroscopio ≠ el de ARCore
    static {
        rot(SD, 0, 0, 1, 90); SD[12] = 0.02f; SD[13] = 0.05f;
        rot(G, 0.3f, 1, 0.2f, 70);
    }
    static float cuelloX = 0, cuelloZ = 0;   // el cuello se mueve si se camina

    static float yaw(double t) { return (float) (40 * Math.sin(2 * Math.PI * t / 1.6)); }
    static float pitch(double t) { return (float) (15 * Math.sin(2 * Math.PI * t / 2.3)); }

    /** La pantalla en el mundo de verdad a los t segundos. */
    static float[] display(double t, float[] cuello) {
        float[] ry = new float[16], rx = new float[16], r = new float[16];
        rot(ry, 0, 1, 0, yaw(t));
        rot(rx, 1, 0, 0, pitch(t));
        Seguimiento.mul(ry, rx, r);
        float[] p = Seguimiento.aplicarPunto(r, PIVOTE);
        r[12] = cuello[0] - p[0]; r[13] = cuello[1] - p[1]; r[14] = cuello[2] - p[2];
        return r;
    }

    static float[] sensor(float[] d) {
        float[] inv = new float[16], s = new float[16];
        Seguimiento.invRigida(SD, inv);
        Seguimiento.mul(d, inv, s);
        return s;
    }

    static void rot(float[] m, float x, float y, float z, float grados) {
        float l = (float) Math.sqrt(x * x + y * y + z * z);
        float h = (float) Math.toRadians(grados) / 2, s = (float) Math.sin(h) / l;
        Seguimiento.deCuat(new float[]{x * s, y * s, z * s, (float) Math.cos(h)}, new float[3], m);
    }

    static float angulo(float[] a, float[] b) {
        float[] qa = new float[4], qb = new float[4];
        Seguimiento.aCuat(a, qa);
        Seguimiento.aCuat(b, qb);
        float d = Math.abs(qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3]);
        return (float) Math.toDegrees(2 * Math.acos(Math.min(1, d)));
    }

    static float distancia(float[] a, float[] b) {
        return Seguimiento.dist(new float[]{a[12], a[13], a[14]}, new float[]{b[12], b[13], b[14]});
    }

    interface Cuello3 { float[] en(double t); }
    interface Rastrea { boolean en(double t); }
    interface Mapa { float[] en(double t); }   // la corrección del mapa de ARCore (K): mundo de ARCore = K · de verdad

    /** Una corrida. Devuelve {ángulo máx sin capa, ángulo máx con capa, dist máx sin, dist máx con, ángulo medio con} (en la parte medida). */
    static float[] correr(Seguimiento s, double desde, double hasta, Cuello3 cuello, Rastrea rastrea, Mapa mapa, boolean conAncla,
                          double medirDesde, double medirHasta, float[] saltoMax, float[] finalErr) {
        final double foto = 1 / 30.0, llega = 0.060, ver = 0.025, pantalla = 1 / 60.0, giro = 1 / 200.0;
        double tg = desde;
        float maxSin = 0, maxCon = 0, dSin = 0, dCon = 0, suma = 0;
        int cuenta = 0;
        float[] antes = null;
        float[] ancla = new float[16];
        Seguimiento.ident(ancla); ancla[12] = 0; ancla[13] = 1.5f; ancla[14] = -1.1f;
        boolean anclada = false;
        double ultimo = desde;
        for (int paso = 0; desde + paso * pantalla < hasta - 1e-9; paso++) {
            double tr = desde + paso * pantalla;
            ultimo = tr;
            // el giroscopio: lo que llegó hasta ahora (5 ms de demora)
            for (; tg <= tr - 0.005; tg += giro) {
                float[] m = new float[16], q = new float[4];
                Seguimiento.mul(G, sensor(display(tg, cuello.en(tg))), m);
                Seguimiento.aCuat(m, q);
                s.giro((long) (tg * 1e9), q[0], q[1], q[2], q[3]);
            }
            // la última foto que llegó
            double tf = Math.floor((tr - llega) / foto) * foto;
            float[] k = mapa.en(tf);
            float[] dv = display(tf, cuello.en(tf)), da = new float[16], sa = new float[16];
            Seguimiento.mul(k, dv, da);
            Seguimiento.mul(k, sensor(dv), sa);
            if (conAncla && !anclada) { s.nuevaAncla(ancla); anclada = true; }
            if (conAncla) { float[] a = new float[16]; Seguimiento.mul(k, ancla, a); s.ancla(a, (float) pantalla); }
            s.cuadro((long) (tf * 1e9), rastrea.en(tf), sa, da, (long) ((tr + ver) * 1e9));
            float[] verdad = display(tr + ver, cuello.en(tr + ver));
            if (antes != null && tr >= medirDesde && tr < medirHasta && saltoMax != null) saltoMax[0] = Math.max(saltoMax[0], distancia(antes, s.pose));
            antes = s.pose.clone();
            if (tr < medirDesde || tr >= medirHasta) continue;
            // sin la capa: la pose de la foto, tal cual (en el mundo de ARCore, que sin ancla es el que se dibuja)
            maxSin = Math.max(maxSin, angulo(da, verdad));
            dSin = Math.max(dSin, distancia(da, verdad));
            float e = angulo(s.pose, verdad);
            maxCon = Math.max(maxCon, e);
            dCon = Math.max(dCon, distancia(s.pose, verdad));
            suma += e; cuenta++;
        }
        if (finalErr != null) { float[] v = display(ultimo + ver, cuello.en(ultimo + ver)); finalErr[0] = distancia(s.pose, v); finalErr[1] = angulo(s.pose, v); }
        return new float[]{maxSin, maxCon, dSin, dCon, suma / Math.max(1, cuenta)};
    }

    // ── 3DoF: sólo el giroscopio ──

    /** Un teléfono acostado con esta rotación (columnas: los ejes del teléfono en el mundo de los sensores, x este, y norte, z arriba). */
    static void darGiro(Seguimiento s, long ns, float[] telefonoEnu) {
        float[] q = new float[4];
        Seguimiento.aCuat(telefonoEnu, q);
        s.giro(ns, q[0], q[1], q[2], q[3]);
    }

    static float[] cols(float[] x, float[] y, float[] z) {
        return new float[]{x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1};
    }

    /** El mundo del giroscopio de la simulación: el de ARCore (OpenGL) girado 25° (el norte no es el −Z de ARCore). */
    static float[] giroDe(float[] telefonoGl) {
        float[] ry = new float[16], a = new float[16], b = new float[16], glAEnu = new float[16];
        rot(ry, 0, 1, 0, 25);
        Seguimiento.invRigida(Seguimiento.ENU_A_GL, glAEnu);
        Seguimiento.mul(glAEnu, ry, a);
        Seguimiento.mul(a, telefonoGl, b);
        return b;
    }

    static void tres() {
        System.out.println("   3DoF (sólo el giroscopio):");
        // 1. los ejes: acostado mirando al norte, derecho
        for (int k = 0; k < 2; k++) {
            boolean al270 = k == 1;
            float[] tel = al270 ? cols(new float[]{0, 0, -1}, new float[]{1, 0, 0}, new float[]{0, -1, 0})   // la parte de arriba a la derecha
                    : cols(new float[]{0, 0, 1}, new float[]{-1, 0, 0}, new float[]{0, -1, 0});                 // la parte de arriba a la izquierda
            Seguimiento s = new Seguimiento();
            for (int i = 0; i < 20; i++) darGiro(s, i * 5_000_000L, tel);
            boolean ok = s.tres(90_000_000L, 90_000_000L, al270);
            float[] m = s.pose;
            boolean ejes = ok && Math.abs(m[0] - 1) < 1e-3f && Math.abs(m[5] - 1) < 1e-3f && Math.abs(m[10] - 1) < 1e-3f;
            ver(ejes, (al270 ? "al revés (270°)" : "acostado (90°)") + String.format(java.util.Locale.ROOT,
                    ": mira adelante (−Z), la derecha es +X y arriba +Y (adelante %.2f %.2f %.2f)", -m[8], -m[9], -m[10]));
            // girar 30° a la izquierda (alrededor de arriba)
            float[] rz = new float[16], t2 = new float[16];
            rot(rz, 0, 0, 1, 30);
            Seguimiento.mul(rz, tel, t2);
            for (int i = 20; i < 40; i++) darGiro(s, i * 5_000_000L, t2);
            s.tres(195_000_000L, 195_000_000L, al270);
            float ex = (float) -Math.sin(Math.toRadians(30)), ez = (float) -Math.cos(Math.toRadians(30));
            if (k == 0) ver(Math.abs(-s.pose[8] - ex) < 2e-3f && Math.abs(-s.pose[10] - ez) < 2e-3f && Math.abs(s.pose[9]) < 2e-3f,
                    "girando 30° a la izquierda mira 30° a la izquierda (sin inclinarse)");
        }
        // 2. una cabeza de verdad: 6DoF con ARCore, pasa a 3DoF, sigue girando, vuelve a 6DoF
        final double foto = 1 / 30.0, llega = 0.060, verse = 0.025, pantalla = 1 / 60.0, giro = 1 / 200.0;
        float[] cuello = {0.1f, 1.5f, -0.2f};
        float[] pan90inv = new float[16];
        Seguimiento.invRigida(Seguimiento.PANTALLA_90, pan90inv);
        Seguimiento s = nuevo();
        double tg = 0;
        float[] antes = null;
        float saltoEntrar = 0, saltoEntrarAng = 0, saltoSalir = 0, saltoSalirAng = 0, errTres = 0, errFoto = 0, cuelloMov = 0;
        float[] cuello0 = null, ry = null;
        for (int paso = 0; paso * pantalla < 9; paso++) {
            double tr = paso * pantalla;
            boolean enTres = tr >= 3 && tr < 6;
            for (; tg <= tr - 0.005; tg += giro) {
                float[] tel = new float[16];
                Seguimiento.mul(display(tg, cuello), pan90inv, tel);
                darGiro(s, (long) (tg * 1e9), giroDe(tel));
            }
            double tf = Math.floor((tr - llega) / foto) * foto;
            float[] dv = display(tf, cuello), sv = new float[16];
            Seguimiento.mul(dv, pan90inv, sv);
            if (enTres) s.tres((long) (tf * 1e9), (long) ((tr + verse) * 1e9), false);
            else s.cuadro((long) (tf * 1e9), true, sv, dv, (long) ((tr + verse) * 1e9));
            if (antes != null && Math.abs(tr - 3) < 1e-6) { saltoEntrar = distancia(antes, s.pose); saltoEntrarAng = angulo(antes, s.pose); }
            if (antes != null && Math.abs(tr - 6) < 1e-6) { saltoSalir = distancia(antes, s.pose); saltoSalirAng = angulo(antes, s.pose); }
            if (enTres && ry == null) {
                // el marco del escritorio en 3DoF está girado (lo que se alineó al entrar): se mide una vez, con una foto
                float[] f = display(tf, cuello);
                float g = (float) Math.toDegrees(Math.atan2(s.poseFoto[8], s.poseFoto[10]) - Math.atan2(f[8], f[10]));
                ry = new float[16];
                rot(ry, 0, 1, 0, g);
            }
            if (enTres && tr > 3.5) {
                // lo que se ve contra la cabeza de verdad (con la predicción: 25 ms adelante)
                float[] vv = new float[16], ff = new float[16];
                Seguimiento.mul(ry, display(tr + verse, cuello), vv);
                errTres = Math.max(errTres, angulo(vv, s.pose));
                Seguimiento.mul(ry, display(tf, cuello), ff);
                errFoto = Math.max(errFoto, angulo(ff, s.poseFoto));
                float[] c = Seguimiento.aplicarPunto(s.pose, s.pivote);
                if (cuello0 == null) cuello0 = c;
                cuelloMov = Math.max(cuelloMov, Seguimiento.dist(c, cuello0));
            }
            antes = s.pose.clone();
        }
        ver(saltoEntrar < 0.01f && saltoEntrarAng < 1.5f, String.format(java.util.Locale.ROOT,
                "de 6DoF a 3DoF no salta (%.1f mm, %.2f°: lo que gira la cabeza en un cuadro)", saltoEntrar * 1000, saltoEntrarAng));
        ver(errTres < 1f, String.format(java.util.Locale.ROOT, "en 3DoF la cabeza gira bien sin ARCore: error máx %.2f° con la predicción (girando hasta 157°/s)", errTres));
        ver(cuelloMov < 1e-4f, String.format(java.util.Locale.ROOT, "y el cuello no se mueve nada (%.2f mm): nada se desliza", cuelloMov * 1000));
        ver(errFoto < 0.05f, String.format(java.util.Locale.ROOT, "la cámara a la hora de cada foto (para las manos): error máx %.2f°", errFoto));
        ver(saltoSalir < 0.03f && saltoSalirAng < 3f, String.format(java.util.Locale.ROOT,
                "de 3DoF a 6DoF (sin ancla) tampoco salta (%.1f mm, %.2f°)", saltoSalir * 1000, saltoSalirAng));
        // 3. arrancando sin que ARCore siga nunca (poca luz): igual hay imagen
        Seguimiento n = new Seguimiento();
        for (int i = 0; i < 10; i++) darGiro(n, i * 5_000_000L, cols(new float[]{0, 0, 1}, new float[]{-1, 0, 0}, new float[]{0, -1, 0}));
        boolean sin6 = !n.cuadro(50_000_000L, false, new float[16], new float[16], 60_000_000L);
        ver(sin6 && n.tres(50_000_000L, 60_000_000L, false) && n.modo == Seguimiento.TRES,
                "sin que ARCore haya seguido nunca, 6DoF no tiene pose pero 3DoF sí (no queda en negro)");
    }

    /** Con el cuello ya medido (ver 5): así se mide sólo lo de cada prueba. */
    static Seguimiento nuevo() { Seguimiento s = new Seguimiento(); System.arraycopy(PIVOTE, 0, s.pivote, 0, 3); return s; }

    public static void main(String[] a) {
        float[] quieto = {0, 1.5f, 0};
        float[] ident = new float[16];
        Seguimiento.ident(ident);

        // 1. la demora
        {
            Seguimiento sn = new Seguimiento();
            float[] rn = correr(sn, 0, 6, t -> quieto, t -> true, t -> ident, false, 1, 6, null, null);
            Seguimiento s = new Seguimiento();
            // el cuello que midió Cuello (ver 5)
            System.arraycopy(PIVOTE, 0, s.pivote, 0, 3);
            float[] r = correr(s, 0, 6, t -> quieto, t -> true, t -> ident, false, 1, 6, null, null);
            System.out.printf("   girando la cabeza (hasta %.0f°/s):%n", 40 * 2 * Math.PI / 1.6);
            System.out.printf("     sin la capa: se atrasa hasta %.1f° y %.1f cm%n", r[0], r[2] * 100);
            System.out.printf("     con la capa: hasta %.2f° (en promedio %.2f°) y %.2f cm%n", r[1], r[4], r[3] * 100);
            ver(r[0] > 8, "sin la capa el atraso es grande (lo que se ve \"moverse solo\")");
            ver(r[1] < 1.0f, "con giroscopio y predicción, menos de 1° de error girando rápido");
            System.out.printf("     (con el cuello de siempre, sin medir: %.2f° y %.2f cm)%n", rn[1], rn[3] * 100);
            ver(r[3] < 0.006f, "y la posición (girando alrededor del cuello medido), menos de 6 mm");
            ver(rn[3] < r[3] + 0.02f && rn[1] < 1.0f, "con el cuello sin medir, igual mucho mejor que sin la capa");
        }

        // 2. se pierde el seguimiento 1.5 s, caminando 20 cm
        {
            Seguimiento s = nuevo();
            Cuello3 camina = t -> t < 2 ? quieto : t < 3.5 ? new float[]{(float) ((t - 2) / 1.5 * 0.2), 1.5f, 0} : new float[]{0.2f, 1.5f, 0};
            float[] salto = new float[1], fin = new float[2];
            float[] r = correr(s, 0, 2.0, camina, t -> true, t -> ident, false, 1, 2, null, null);
            float[] perdido = correr(s, 2.0, 3.5, camina, t -> t < 2.0, t -> ident, false, 2.1, 3.5, null, null);
            ver(s.modo == Seguimiento.GIRO, "perdido: sigue dibujando, sólo girando (no se va a negro)");
            ver(perdido[1] < 1.5f, String.format("perdido: la rotación sigue bien con el giroscopio (máx %.2f°)", perdido[1]));
            float[] vuelta = correr(s, 3.5, 5.0, camina, t -> true, t -> ident, false, 3.5, 5.0, salto, fin);
            ver(s.modo == Seguimiento.SEIS, "vuelve a 6 grados de libertad");
            ver(salto[0] < 0.035f, String.format("al volver no salta: el paso más grande de un cuadro es %.1f cm (el salto era 20 cm)", salto[0] * 100));
            ver(fin[0] < 0.006f, String.format("y medio segundo después está donde tiene que estar (%.1f mm)", fin[0] * 1000));
            ver(s.perdidas == 1, "se cuenta la pérdida");
        }

        // 3. ARCore corrige el mapa: 5 cm y 2°
        {
            float[] k = new float[16];
            rot(k, 0, 1, 0, 2); k[12] = 0.05f; k[14] = -0.02f;
            Mapa corrige = t -> t < 2 ? ident : k;
            float[] salto = new float[1], fin = new float[2];
            Seguimiento sin = new Seguimiento();
            correr(sin, 0, 2.0, t -> quieto, t -> true, corrige, false, 1, 2, null, null);
            float[] saltoSin = new float[1], finSin = new float[2];
            correr(sin, 2.0, 3.5, t -> quieto, t -> true, corrige, false, 2.0, 3.5, saltoSin, finSin);
            Seguimiento con = nuevo();
            correr(con, 0, 2.0, t -> quieto, t -> true, corrige, true, 1, 2, null, null);
            correr(con, 2.0, 3.5, t -> quieto, t -> true, corrige, true, 2.0, 3.5, salto, fin);
            System.out.printf("   ARCore corrige el mapa: sin ancla el escritorio queda corrido %.1f cm; con ancla, %.1f mm%n", finSin[0] * 100, fin[0] * 1000);
            ver(fin[0] < 0.004f && fin[1] < 0.8f, String.format("con el ancla, el escritorio vuelve a su lugar de verdad (%.1f mm, %.2f°; la corrección era de 2°)", fin[0] * 1000, fin[1]));
            ver(salto[0] < 0.035f, String.format("y sin saltar (paso máx de un cuadro %.1f cm)", salto[0] * 100));
            ver(con.correccionCm > 3, String.format("la corrección se ve en el estado (%.1f cm)", con.correccionCm));
        }

        // 4. un salto imposible de un cuadro (30 cm)
        {
            Seguimiento s = nuevo();
            float[] k = new float[16];
            Seguimiento.ident(k); k[12] = 0.3f;
            Mapa glitch = t -> (t > 2.0 && t < 2.04) ? k : ident;
            correr(s, 0, 2.0, t -> quieto, t -> true, glitch, false, 1, 2, null, null);
            float[] salto = new float[1], fin = new float[2];
            correr(s, 2.0, 3.0, t -> quieto, t -> true, glitch, false, 2.0, 3.0, salto, fin);
            ver(salto[0] < 0.08f, String.format("un salto de 30 cm de un cuadro no se ve de golpe (paso máx %.1f cm)", salto[0] * 100));
            ver(fin[0] < 0.006f, String.format("y todo vuelve a su lugar (%.1f mm)", fin[0] * 1000));
        }

        // 4c. TU MESA: sin verla, el cuello queda quieto aunque la cabeza se incline 15 cm o ARCore se deslice
        {
            Seguimiento s = nuevo();
            Cuello3 inclina = t -> t < 2 ? quieto : t < 3.5 ? new float[]{(float) ((t - 2) / 1.5 * 0.15), 1.5f, 0} : new float[]{0.15f, 1.5f, 0};
            correr(s, 0, 2.0, inclina, t -> true, t -> ident, false, 1, 2, null, null);
            s.puedeMoverse = false;
            float[] cuello0 = null;
            float maxDesvio = 0, maxAng = 0;
            // ARCore además se desliza 20 cm (mirando una pared lisa): con la mesa fuera de la vista no se nota
            float[] deriva = new float[16];
            Seguimiento.ident(deriva);
            for (int k = 0; k < 45; k++) {
                double t0 = 2.0 + k / 30.0;
                deriva[12] = (float) (k / 45.0 * 0.2);
                final float[] d = deriva.clone();
                correr(s, t0, t0 + 1 / 30.0, inclina, t -> true, t -> d, false, 99, 99, null, null);
                float[] cu = Seguimiento.aplicarPunto(s.pose, s.pivote);
                if (cuello0 == null) cuello0 = cu;
                maxDesvio = Math.max(maxDesvio, Seguimiento.dist(cu, cuello0));
                float[] v = display(t0 + 1 / 30.0 - 1 / 60.0 + 0.025, inclina.en(t0));
                maxAng = Math.max(maxAng, angulo(s.pose, v));
            }
            ver(s.fijo, "sin ver la mesa: la posición queda fija");
            ver(maxDesvio < 0.003f, String.format("el cuello no se movió (%.1f mm) aunque ARCore se deslizó 20 cm y la cabeza se inclinó", maxDesvio * 1000));
            ver(maxAng < 1.5f, String.format("y la cabeza sigue girando bien (máx %.2f°)", maxAng));
            s.puedeMoverse = true;
            float[] salto = new float[1], fin = new float[2];
            correr(s, 3.5, 5.0, inclina, t -> true, t -> ident, false, 3.5, 5.0, salto, fin);
            ver(!s.fijo && salto[0] < 0.035f, String.format("al volver a ver la mesa se acomoda sin saltar (paso máx %.1f cm)", salto[0] * 100));
            ver(fin[0] < 0.006f, String.format("y queda donde tiene que estar (%.1f mm)", fin[0] * 1000));
        }

        // 4b. la hora de las fotos en otra base (10 s corrida): no se usa el giroscopio, no gira cualquier cosa
        {
            Seguimiento s = nuevo();
            float[] ref = new float[16];
            for (double tg = 0; tg < 2; tg += 0.005) {
                float[] m = new float[16], q = new float[4];
                Seguimiento.mul(G, sensor(display(tg, quieto)), m);
                Seguimiento.aCuat(m, q);
                s.giro((long) (tg * 1e9), q[0], q[1], q[2], q[3]);
            }
            float[] dv = display(1.9, quieto);
            s.cuadro((long) (1.9e9) - 10_000_000_000L, true, sensor(dv), dv, (long) (1.95e9));
            ver(angulo(s.pose, dv) < 0.01f, "con la hora de las fotos en otra base, queda la pose de ARCore tal cual (sin girar cualquier cosa)");
        }

        // 5. los ojos
        {
            Cuello c = new Cuello();
            Random rnd = new Random(3);
            for (double t = 0; t < 12; t += 0.02) {
                float[] d = display(t, quieto);
                d[12] += rnd.nextGaussian() * 0.003; d[13] += rnd.nextGaussian() * 0.003; d[14] += rnd.nextGaussian() * 0.003;
                c.pose((long) (t * 1000), d);
                if (((int) (t * 50)) % 50 == 0) c.medir();
            }
            float[] verdad = {PIVOTE[0], PIVOTE[1] + Cuello.OJO_Y, PIVOTE[2] + Cuello.OJO_Z};
            System.out.printf("   los ojos: medidos (%.1f, %.1f, %.1f) cm, de verdad (%.1f, %.1f, %.1f) cm; %d medidas, error %.2f cm%n",
                    c.ojos[0] * 100, c.ojos[1] * 100, c.ojos[2] * 100, verdad[0] * 100, verdad[1] * 100, verdad[2] * 100, c.medidas, c.errorCm);
            ver(c.medidas >= 5, "se mide sola girando la cabeza");
            ver(Math.abs(c.ojos[0] - verdad[0]) < 0.01f, "el costado (lo que más importa) con menos de 1 cm de error");
            ver(Math.abs(c.ojos[1] - verdad[1]) < 0.02f && Math.abs(c.ojos[2] - verdad[2]) < 0.02f, "arriba/abajo y adelante/atrás con menos de 2 cm");
            Cuello w = new Cuello();
            for (double t = 0; t < 8; t += 0.02) {
                float[] d = display(t, new float[]{(float) (t * 0.5), 1.5f, (float) (t * 0.2)});
                w.pose((long) (t * 1000), d);
                if (((int) (t * 50)) % 50 == 0) w.medir();
            }
            ver(w.medidas == 0, String.format("caminando no se mide (error %.1f cm): no se ensucia", w.errorCm));
        }

        tres();

        System.out.println(fallas == 0 ? "\n✓ todo bien" : "\n✗ " + fallas + " fallas");
        System.exit(fallas == 0 ? 0 : 1);
    }
}
