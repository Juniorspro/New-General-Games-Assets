package com.juniorspro.nexoxr;

import java.util.ArrayList;
import java.util.Random;

/**
 * TU MESA: elegirla entre los planos (no el piso, no una repisa, la de
 * adelante), contar los puntos de ARCore que caen sobre ella, saber si entra en
 * la vista, la histéresis (sin parpadear), dónde van las manos de guía, medir
 * la escala de la mano apoyada, y los pasos del inicio.
 */
public class PruebaMesa {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    /** Un plano horizontal a la altura y, centrado en (cx, cz), de ancho × largo, girado yaw (°). */
    static Mesa.Plano plano(int id, float cx, float y, float cz, float ancho, float largo, float yaw, boolean ccw) {
        Mesa.Plano p = new Mesa.Plano();
        p.id = id;
        p.horizontal = true;
        float c = (float) Math.cos(Math.toRadians(yaw)), s = (float) Math.sin(Math.toRadians(yaw));
        // la pose: +Y arriba, girada en yaw alrededor de Y
        Seguimiento.ident(p.pose);
        p.pose[0] = c; p.pose[2] = -s; p.pose[8] = s; p.pose[10] = c;
        p.pose[12] = cx; p.pose[13] = y; p.pose[14] = cz;
        float a = ancho / 2, l = largo / 2;
        p.poligono = ccw ? new float[]{-a, -l, -a, l, a, l, a, -l} : new float[]{-a, -l, a, -l, a, l, -a, l};
        return p;
    }

    public static void main(String[] args) {
        // ── el plano ──
        Mesa.Plano m = plano(1, 0, 0.75f, -0.5f, 0.8f, 0.5f, 20, true);
        ver(Math.abs(m.area() - 0.4f) < 1e-4f, String.format("el área de una mesa de 80 × 50 cm: %.3f m²", m.area()));
        ver(m.adentro(0, 0, 0) && !m.adentro(0.5f, 0, 0) && m.adentro(0.41f, 0, 0.02f) && !m.adentro(0.39f, 0, -0.02f),
                "adentro / afuera del polígono, con margen para afuera y para adentro");
        Mesa.Plano cw = plano(2, 0, 0.75f, -0.5f, 0.8f, 0.5f, 20, false);
        ver(cw.adentro(0, 0, 0) && !cw.adentro(0.5f, 0, 0), "igual con el polígono al revés (horario)");
        float[] w = new float[3], l = new float[3];
        m.aMundo(0.3f, -0.2f, w);
        m.aLocal(w[0], w[1] + 0.02f, w[2], l);
        ver(Math.abs(l[0] - 0.3f) < 1e-5f && Math.abs(l[1] - 0.02f) < 1e-5f && Math.abs(l[2] + 0.2f) < 1e-5f, "del marco del plano al mundo y de vuelta (la altura sobre el plano)");

        // ── elegir la mesa ──
        float[] cabeza = {0, 1.2f, 0}, adelante = {0, -0.5f, -0.87f};   // sentado, mirando la mesa
        ArrayList<Mesa.Plano> ps = new ArrayList<>();
        ps.add(plano(10, 0, 0.0f, -0.6f, 3, 3, 0, true));            // el piso (1.2 m abajo)
        ps.add(plano(11, 0.5f, 1.0f, -0.4f, 0.2f, 0.15f, 0, true));  // una repisa chiquita
        ps.add(plano(12, 0, 0.74f, 0.9f, 1.0f, 0.6f, 0, true));      // una mesa atrás
        ps.add(plano(13, 0.05f, 0.75f, -0.55f, 0.9f, 0.6f, 5, true)); // LA mesa, adelante
        Mesa.Plano pared = plano(14, 0, 1.2f, -1.5f, 2, 2, 0, true);
        pared.horizontal = false; pared.vertical = true;
        ps.add(pared);
        int e = Mesa.elegir(ps, cabeza, adelante, null);
        ver(e >= 0 && ps.get(e).id == 13, "elige la mesa de adelante (no el piso, ni la repisa, ni la de atrás, ni la pared)");
        ArrayList<Mesa.Plano> soloPiso = new ArrayList<>();
        soloPiso.add(ps.get(0));
        ver(Mesa.elegir(soloPiso, cabeza, adelante, null) < 0, "si sólo está el piso, no hay mesa");
        float[] parado = {0, 1.65f, 0};
        ArrayList<Mesa.Plano> dos = new ArrayList<>();
        dos.add(ps.get(0)); dos.add(ps.get(3));
        e = Mesa.elegir(dos, parado, adelante, null);
        ver(e == 1, "parado (ojos a 1.65 m) también la encuentra (0.9 m abajo), y no el piso");

        // ── los puntos sobre la mesa ──
        Mesa.Plano mesa = ps.get(3);
        Random r = new Random(7);
        float[] nube = new float[4 * 300];
        int n = 0, deMesa = 0;
        for (int i = 0; i < 120; i++) {   // sobre la mesa, con ruido de 5 mm
            float x = (r.nextFloat() - 0.5f) * 0.85f, z = (r.nextFloat() - 0.5f) * 0.55f;
            mesa.aMundo(x, z, w);
            nube[n * 4] = w[0]; nube[n * 4 + 1] = w[1] + (float) r.nextGaussian() * 0.005f; nube[n * 4 + 2] = w[2]; nube[n * 4 + 3] = 0.8f;
            n++; deMesa++;
        }
        for (int i = 0; i < 80; i++) {   // el piso y una pared
            nube[n * 4] = (r.nextFloat() - 0.5f) * 3; nube[n * 4 + 1] = i < 40 ? 0 : 0.5f + r.nextFloat(); nube[n * 4 + 2] = i < 40 ? -0.6f : -1.5f; nube[n * 4 + 3] = 0.8f;
            n++;
        }
        for (int i = 0; i < 40; i++) {   // cosas encima de la mesa (una taza, un monitor): 10 a 40 cm arriba
            mesa.aMundo((r.nextFloat() - 0.5f) * 0.6f, (r.nextFloat() - 0.5f) * 0.4f, w);
            nube[n * 4] = w[0]; nube[n * 4 + 1] = w[1] + 0.1f + r.nextFloat() * 0.3f; nube[n * 4 + 2] = w[2]; nube[n * 4 + 3] = 0.8f;
            n++;
        }
        int sobre = Mesa.puntosSobre(mesa, nube, n, 0.2f);
        ver(sobre == deMesa, String.format("de %d puntos, cuenta los %d que están sobre la mesa (%d)", n, deMesa, sobre));
        for (int i = 0; i < n; i++) nube[i * 4 + 3] = 0.1f;
        ver(Mesa.puntosSobre(mesa, nube, n, 0.2f) == 0, "los de poca confianza no cuentan");

        // ── ¿entra en la vista? ──
        float[] vp = vistaProyeccion(cabeza, new float[]{0, -0.6f, -0.8f});
        float fv = Mesa.fraccionVisible(mesa, vp, cabeza);
        ver(fv >= 0.6f, String.format("mirándola: se ve el %.0f %% (la mesa es más grande que la vista, de cerca)", fv * 100));
        float fa = Mesa.fraccionVisible(mesa, vistaProyeccion(cabeza, new float[]{0, 0.8f, -0.6f}), cabeza);
        float fc = Mesa.fraccionVisible(mesa, vistaProyeccion(cabeza, new float[]{1, 0.1f, 0}), cabeza);
        float fd = Mesa.fraccionVisible(mesa, vistaProyeccion(cabeza, new float[]{0, 0, 1}), cabeza);
        ver(fa == 0 && fc < 0.2f && fd == 0, String.format("mirando el techo %.0f %%, al costado %.0f %%, atrás %.0f %%", fa * 100, fc * 100, fd * 100));
        ver(Mesa.detectada(true, 20, 0) && Mesa.detectada(true, 3, 0.8f) && !Mesa.detectada(true, 1, 0.9f) && !Mesa.detectada(false, 50, 1),
                "la regla: muchos puntos, o bien a la vista con algunos; y nunca sin seguimiento");

        // ── la histéresis ──
        Mesa h = new Mesa();
        h.paso(true, 0);
        boolean unoSolo = h.vista;
        h.paso(true, 33);
        boolean dosSeguidos = h.vista;
        h.paso(false, 66); h.paso(false, 100); h.paso(false, 300);
        boolean hueco = h.vista;
        h.paso(true, 330); h.paso(true, 360);
        for (int t = 400; t <= 900; t += 33) h.paso(false, t);
        boolean seFue = !h.vista;
        ver(!unoSolo && dosSeguidos, "se prende con 2 cuadros seguidos (uno solo no alcanza)");
        ver(hueco, "un hueco de 250 ms no la apaga (no parpadea)");
        ver(seFue, "450 ms sin verla: se apaga (y Nexo deja de moverse)");

        // ── dónde van las cosas ──
        float[] q = new float[3];
        Mesa.puntoAdelante(mesa, cabeza, adelante, 0.35f, q);
        mesa.aLocal(q[0], q[1], q[2], l);
        ver(Math.abs(l[1]) < 1e-4f && mesa.adentro(l[0], l[2], -0.05f), "el punto de adelante está en la mesa (y a más de 5 cm del borde)");
        float[] lejos = {3, 1.2f, 3};
        Mesa.puntoAdelante(mesa, lejos, adelante, 0.35f, q);
        mesa.aLocal(q[0], q[1], q[2], l);
        ver(mesa.adentro(l[0], l[2], -0.05f), "desde lejos, igual cae adentro de la mesa");
        float[][][] guia = new float[2][21][3];
        float[] arriba = {0, 1, 0};
        Mesa.puntoAdelante(mesa, cabeza, adelante, 0.35f, q);
        Mesa.manosGuia(q, new float[]{0, 0, -1}, arriba, guia);
        boolean derechaALaDerecha = guia[1][0][0] > guia[0][0][0] + 0.2f;
        boolean dedosAdelante = guia[1][12][2] < guia[1][0][2] - 0.15f && guia[0][12][2] < guia[0][0][2] - 0.15f;
        boolean pulgaresAdentro = guia[1][4][0] < guia[1][0][0] && guia[0][4][0] > guia[0][0][0];
        float minY = 9, maxY = -9;
        for (float[][] mm : guia) for (float[] p : mm) { minY = Math.min(minY, p[1] - q[1]); maxY = Math.max(maxY, p[1] - q[1]); }
        ver(derechaALaDerecha && dedosAdelante && pulgaresAdentro, "las guías: la derecha a la derecha, los dedos para adelante, los pulgares hacia adentro");
        ver(minY > 0.008f && maxY < 0.025f, String.format("apoyadas: entre %.1f y %.1f cm sobre la mesa", minY * 100, maxY * 100));

        // ── la escala de la mano, con la mesa ──
        {
            float sVerdad = 1.15f;   // la red cree la mano más chica: la pone más cerca
            float[] pose = poseCamara(cabeza, q);
            float[] inv = new float[16];
            Seguimiento.invRigida(pose, inv);
            float[] ptsCam = new float[63];
            for (int i = 0; i < 21; i++) {
                float[] pc = Seguimiento.aplicarPunto(inv, guia[1][i]);
                for (int k = 0; k < 3; k++) ptsCam[i * 3 + k] = pc[k] / sVerdad;
            }
            float[] p0 = q.clone(), nn = {0, 1, 0};
            float s = Mano.escalaSobrePlano(ptsCam, pose, p0, nn, 0.02f);
            ver(Math.abs(s / sVerdad - 1) < 0.03f, String.format("la mano apoyada: la escala medida %.3f (de verdad %.3f)", s, sVerdad));
            // con ruido de la red (5 mm en la forma)
            Random rr = new Random(3);
            int buenas = 0;
            float peor = 0;
            for (int k = 0; k < 200; k++) {
                float[] ruido = ptsCam.clone();
                for (int i = 0; i < 63; i++) ruido[i] += (float) rr.nextGaussian() * 0.004f;
                float sr = Mano.escalaSobrePlano(ruido, pose, p0, nn, 0.02f);
                if (sr == sr) { buenas++; peor = Math.max(peor, Math.abs(sr / sVerdad - 1)); }
            }
            ver(buenas > 100 && peor < 0.08f, String.format("con temblor de la red: %d de 200 aceptadas, error máximo %.1f %%", buenas, peor * 100));
            // la mano inclinada (girada sobre su largo, apoyada en el canto del meñique): de 25° en adelante no se usa
            float[] resultado = new float[5];
            int[] angulos = {0, 8, 25, 45, 70};
            for (int ai = 0; ai < angulos.length; ai++) {
                float ca = (float) Math.cos(Math.toRadians(angulos[ai])), sa = (float) Math.sin(Math.toRadians(angulos[ai]));
                float[][] g = new float[21][3];
                float bajo = 9;
                for (int i = 0; i < 21; i++) {
                    float dx = guia[1][i][0] - guia[1][9][0], dy = guia[1][i][1] - q[1];
                    g[i][0] = guia[1][9][0] + dx * ca - dy * sa; g[i][1] = dx * sa + dy * ca; g[i][2] = guia[1][i][2];
                    bajo = Math.min(bajo, g[i][1]);
                }
                for (int i = 0; i < 21; i++) {
                    g[i][1] += q[1] - bajo + 0.01f;
                    float[] pc = Seguimiento.aplicarPunto(inv, g[i]);
                    for (int k = 0; k < 3; k++) ptsCam[i * 3 + k] = pc[k] / sVerdad;
                }
                resultado[ai] = Mano.escalaSobrePlano(ptsCam, pose, p0, nn, 0.02f);
            }
            ver(resultado[0] == resultado[0] && resultado[1] == resultado[1] && Math.abs(resultado[1] / sVerdad - 1) < 0.04f,
                    String.format("plana o casi (8°): se usa (%.3f y %.3f)", resultado[0], resultado[1]));
            ver(resultado[2] != resultado[2] && resultado[3] != resultado[3] && resultado[4] != resultado[4],
                    "inclinada 25°, 45° o de canto: no se usa (la palma no está apoyada en la mesa)");
            // sobre la guía: el corte del rayo con la mesa no depende de la escala
            for (int i = 0; i < 21; i++) {
                float[] pc = Seguimiento.aplicarPunto(inv, guia[1][i]);
                for (int k = 0; k < 3; k++) ptsCam[i * 3 + k] = pc[k] / 1.4f;   // la red muy equivocada con la distancia
            }
            float[] en0 = new float[3], en9 = new float[3];
            boolean ok = Mano.puntoEnPlano(ptsCam, 0, pose, p0, nn, 0.018f, en0) && Mano.puntoEnPlano(ptsCam, 9, pose, p0, nn, 0.022f, en9);
            ver(ok && Seguimiento.dist(en0, guia[1][0]) < 0.01f && Seguimiento.dist(en9, guia[1][9]) < 0.01f,
                    "sobre la guía: el rayo de la muñeca y del nudillo corta la mesa donde está la guía, aunque la escala esté 40 % mal");
        }

        // ── los pasos del inicio ──
        {
            Inicio in = new Inicio();
            ver(in.paso == Inicio.ELEGIR, "empieza eligiendo");
            in.elegir(Inicio.MESA, 0);
            ver(in.paso == Inicio.ESCANEAR, "Mesa → a escanear");
            boolean conf = false;
            conf |= in.escanearMesa(0, 0, null, 100);
            conf |= in.escanearMesa(13, 0.05f, new float[]{0.3f, 0.2f}, 200);
            ver(!conf && in.progreso < 0.5f, "una superficie chica: todavía no");
            long t = 300;
            for (; t < 1400; t += 33) conf |= in.escanearMesa(13, 0.3f, new float[]{0.8f, 0.5f}, t);
            ver(!conf, "grande pero recién aparecida: espera a que no cambie");
            conf |= in.escanearMesa(99, 0.3f, new float[]{0.8f, 0.5f}, t);
            ver(!conf && in.candidata == 99, "si cambia la candidata, vuelve a esperar");
            for (t += 33; t < 3000 && !conf; t += 33) conf |= in.escanearMesa(99, 0.3f, new float[]{0.8f, 0.5f}, t);
            ver(conf && in.mesa == 99 && in.paso == Inicio.MANOS, String.format("estable 1.2 s: se confirma sola (a los %d ms) y pasa a las manos", t));
            for (int k = 0; k < 19; k++) in.manos(true, true, 1.10f + (k % 3) * 0.01f, 1.08f, t += 50);
            ver(in.paso == Inicio.MANOS, "con pocas muestras sigue esperando las manos");
            in.manos(true, false, 1.11f, 1.5f, t += 50);
            ver(in.muestrasDer() == 19, "la mano que no está sobre su guía no suma");
            in.manos(true, true, 1.11f, 1.08f, t += 50);
            ver(in.paso == Inicio.CABEZA && Math.abs(in.escala - 1.095f) < 0.03f, String.format("con 20 de cada una: escala %.3f, pasa a la cabeza", in.escala));
            float[] pos = {0, 1.2f, 0};
            boolean fija = false;
            for (int k = 0; k < 10; k++) fija |= in.cabeza(30, 0.01f, pos, 0, t += 50);
            ver(!fija && in.progreso == 0, "girando la cabeza no se fija");
            for (int k = 0; k < 40 && !fija; k++) fija |= in.cabeza(3, 0.01f, pos, 0.4f, t += 50);
            ver(fija && in.paso == Inicio.LISTO && in.yaw == 0.4f, "quieta 1.2 s: se fija (y guarda hacia dónde mirabas)");
            in.empezar();
            ver(in.paso == Inicio.FUERA, "Empezar");
        }
        {
            Inicio in = new Inicio();
            in.elegir(Inicio.MESA, 0);
            in.escanearMesa(5, 0.08f, new float[]{0.35f, 0.25f}, 100);
            in.pidioConfirmar = true;
            boolean c = in.escanearMesa(5, 0.08f, new float[]{0.35f, 0.25f}, 150);
            ver(c && in.mesa == 5, "\"Esta es mi mesa\": se confirma aunque sea chica");
            in.manos(false, false, Float.NaN, Float.NaN, 30000);
            in.manos(false, false, Float.NaN, Float.NaN, 60000);
            ver(in.paso == Inicio.MANOS, "sin muestras no sigue sola");
            in.saltar(60000);
            ver(in.paso == Inicio.CABEZA && in.escala != in.escala, "Saltar las manos: sigue sin escala");
        }
        {
            Inicio in = new Inicio();
            in.elegir(Inicio.CUARTO, 0);
            boolean c = in.escanearCuarto(4, 5, false, 100);
            ver(!c && in.progreso <= 0.8f, "el cuarto sin el piso no alcanza");
            c = in.escanearCuarto(4, 6, true, 200);
            ver(c && in.paso == Inicio.CABEZA, "con el piso y 3.5 m²: a la cabeza");
            Inicio g = new Inicio();
            g.elegir(Inicio.GIRAR, 0);
            ver(g.paso == Inicio.CABEZA && g.pasos() == 2, "Sólo girar: directo a la cabeza");
            Inicio s = new Inicio();
            s.elegir(Inicio.MESA, 0);
            s.saltar(10);
            ver(s.paso == Inicio.CABEZA && s.modo == Inicio.GIRAR, "saltar el escaneo de la mesa: queda sólo girando");
        }

        System.out.println(fallas == 0 ? "\n✓ todo bien" : "\n✗ " + fallas + " fallas");
        System.exit(fallas == 0 ? 0 : 1);
    }

    /** Una cámara en ojo mirando en f (60° vertical, 4:3): proyección · vista, por columnas. */
    static float[] vistaProyeccion(float[] ojo, float[] f) {
        float[] pose = mirar(ojo, f);
        float[] vista = new float[16];
        Seguimiento.invRigida(pose, vista);
        float fy = 1 / (float) Math.tan(Math.toRadians(30)), asp = 4 / 3f, n = 0.05f, lj = 100;
        float[] p = new float[16];
        p[0] = fy / asp; p[5] = fy; p[10] = (lj + n) / (n - lj); p[11] = -1; p[14] = 2 * lj * n / (n - lj);
        float[] o = new float[16];
        Seguimiento.mul(p, vista, o);
        return o;
    }

    /** La pose de una cámara (−Z adelante) en ojo mirando hacia el punto a. */
    static float[] poseCamara(float[] ojo, float[] a) {
        return mirar(ojo, new float[]{a[0] - ojo[0], a[1] - ojo[1], a[2] - ojo[2]});
    }

    static float[] mirar(float[] ojo, float[] f0) {
        float fl = (float) Math.sqrt(f0[0] * f0[0] + f0[1] * f0[1] + f0[2] * f0[2]);
        float[] f = {f0[0] / fl, f0[1] / fl, f0[2] / fl};
        float[] up = {0, 1, 0};
        float[] x = {f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]};
        float xl = (float) Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
        if (xl < 1e-4f) { x = new float[]{1, 0, 0}; xl = 1; }
        x[0] /= xl; x[1] /= xl; x[2] /= xl;
        float[] y = {x[1] * f[2] - x[2] * f[1], x[2] * f[0] - x[0] * f[2], x[0] * f[1] - x[1] * f[0]};
        return new float[]{x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, -f[0], -f[1], -f[2], 0, ojo[0], ojo[1], ojo[2], 1};
    }
}
