package com.juniorspro.nexoxr;

import android.opengl.GLES20;

import java.io.FileWriter;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Random;

/**
 * Los datos de la vista previa (pruebas/vista.mjs y vista-inicio.mjs los
 * dibujan con WebGL): los shaders DE VERDAD de Entornos, VentanasGl,
 * SuperficiesGl y ManosGl, dónde pone el Escritorio cada ventana, y lo de
 * Nexo Inicio con las cuentas de la app (Mesa: el polígono de la mesa y su
 * malla, el piso, una pared, la nube de puntos, las manos de guía, y el
 * escritorio con la barra apoyada en la mesa).
 */
public class Vista {
    static void arr(StringBuilder s, float[] a) { arr(s, a, a.length); }

    static void arr(StringBuilder s, float[] a, int n) {
        s.append('[');
        for (int i = 0; i < n; i++) { if (i > 0) s.append(','); s.append(String.format(Locale.ROOT, "%.5f", a[i])); }
        s.append(']');
    }

    static String js(String x) { return "\"" + x.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""; }

    static void programas(StringBuilder s, int desde, int hasta) {
        s.append('[');
        for (int i = desde; i + 1 < hasta; i += 2) {
            if (i > desde) s.append(',');
            s.append("{\"vs\":").append(js(GLES20.fuentes.get(i))).append(",\"fs\":").append(js(GLES20.fuentes.get(i + 1))).append('}');
        }
        s.append(']');
    }

    static void ventanas(StringBuilder s, Escritorio e) {
        s.append('[');
        boolean pri = true;
        for (Ventana v : e.ventanas) {
            if (!pri) s.append(',');
            pri = false;
            s.append("{\"app\":\"").append(v.app).append("\",\"tipo\":").append(v.tipo).append(",\"c\":");
            arr(s, new float[]{v.cx, v.cy, v.cz});
            s.append(",\"r\":"); arr(s, v.r);
            s.append(",\"u\":"); arr(s, v.u);
            s.append(",\"n\":"); arr(s, v.n);
            s.append(String.format(Locale.ROOT, ",\"w\":%.4f,\"h\":%.4f,\"radio\":%.4f,\"barraY\":%.4f,\"barraAncho\":%.4f,\"cerrarX\":%.4f,\"ampliarX\":%.4f,\"px\":%d,\"py\":%d}",
                    v.ancho, v.alto, VentanasGl.radio(v), v.barraY(), v.barraAncho(), v.cerrarX(), v.ampliarX(), v.px, v.py));
        }
        s.append(']');
    }

    /** Un polígono convexo "como el de ARCore": n puntos de una elipse (a, b) con un poco de ruido, en el marco del plano. */
    static float[] poligono(int n, float a, float b, long semilla) {
        Random r = new Random(semilla);
        float[] p = new float[n * 2];
        for (int i = 0; i < n; i++) {
            double t = i * 2 * Math.PI / n;
            // una "superelipse" (casi rectángulo) como una mesa vista por ARCore
            double c = Math.cos(t), sn = Math.sin(t);
            double x = Math.signum(c) * Math.pow(Math.abs(c), 0.35) * a, z = Math.signum(sn) * Math.pow(Math.abs(sn), 0.35) * b;
            float k = 1 - r.nextFloat() * 0.04f;
            p[i * 2] = (float) x * k; p[i * 2 + 1] = (float) z * k;
        }
        return p;
    }

    static Mesa.Plano plano(float[] pose, float[] poli, boolean horizontal, int id) {
        Mesa.Plano p = new Mesa.Plano();
        System.arraycopy(pose, 0, p.pose, 0, 16);
        p.poligono = poli;
        p.horizontal = horizontal;
        p.vertical = !horizontal;
        p.id = id;
        return p;
    }

    static void malla(StringBuilder s, Mesa.Plano p) {
        float[] o = new float[SuperficiesGl.MAX_LADOS * 9 * 6];
        int n = SuperficiesGl.malla(p, o);
        arr(s, o, n * 6);
    }

    public static void main(String[] a) throws Exception {
        int f0 = GLES20.fuentes.size();
        new Entornos().crear();
        new VentanasGl().crear();
        int f1 = GLES20.fuentes.size();
        new SuperficiesGl().crear();
        int f2 = GLES20.fuentes.size();
        new ManosGl().crear();
        int f3 = GLES20.fuentes.size();
        StringBuilder s = new StringBuilder("{\"programas\":");
        programas(s, f0, f1);
        s.append(",\"superficies\":");
        programas(s, f1, f2);
        s.append(",\"manos\":");
        programas(s, f2, f3);
        Escritorio e = new Escritorio();
        e.recentrar(0, 1.6f, 0, 0);
        e.ponerDock(1400, 170, 0.66f, 0);
        e.abrir("navegador", 1280, 800, 1);
        e.abrir("galeria", 1280, 800, 2);
        e.abrir("ajustes", 1100, 800, 3);
        s.append(",\"ventanas\":");
        ventanas(s, e);

        // ── Nexo Inicio: sentado a una mesa ──
        float[] cabeza = {0, 1.2f, 0}, adelante = {0, -0.55f, -0.83f};
        float[] poseMesa = new float[16];
        Seguimiento.ident(poseMesa);
        poseMesa[12] = 0.02f; poseMesa[13] = 0.75f; poseMesa[14] = -0.74f;
        Mesa.Plano mesa = plano(poseMesa, poligono(18, 0.55f, 0.31f, 3), true, 1);
        float[] posePiso = new float[16];
        Seguimiento.ident(posePiso);
        posePiso[12] = 0.3f; posePiso[13] = 0; posePiso[14] = -1.2f;
        Mesa.Plano piso = plano(posePiso, poligono(22, 1.6f, 1.1f, 5), true, 2);
        // una pared (vertical): su +Y mira hacia vos (+Z)
        float[] posePared = {1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, -0.2f, 1.25f, -1.9f, 1};
        Mesa.Plano pared = plano(posePared, poligono(16, 1.3f, 0.75f, 7), false, 3);
        ArrayList<Mesa.Plano> ps = new ArrayList<>();
        ps.add(piso); ps.add(pared); ps.add(mesa);
        int elegida = Mesa.elegir(ps, cabeza, adelante, null);
        s.append(",\"inicio\":{\"elegida\":").append(elegida < 0 ? -1 : ps.get(elegida).id);
        s.append(",\"mesa\":"); malla(s, mesa);
        s.append(",\"piso\":"); malla(s, piso);
        s.append(",\"pared\":"); malla(s, pared);
        // la nube: sobre la mesa, el piso y la pared (lo que ARCore sigue en una foto), con confianza
        Random r = new Random(11);
        float[] nube = new float[4 * 900];
        int n = 0;
        float[] w = new float[3];
        for (int i = 0; i < 900; i++) {
            Mesa.Plano p = i < 380 ? mesa : i < 700 ? piso : pared;
            float sx = p == mesa ? 0.55f : p == piso ? 1.5f : 1.2f, sz = p == mesa ? 0.3f : p == piso ? 1.0f : 0.7f;
            float x = (r.nextFloat() * 2 - 1) * sx, z = (r.nextFloat() * 2 - 1) * sz;
            if (!p.adentro(x, z, 0)) continue;
            p.aMundo(x, z, w);
            nube[n * 4] = w[0]; nube[n * 4 + 1] = w[1] + (float) r.nextGaussian() * 0.004f; nube[n * 4 + 2] = w[2]; nube[n * 4 + 3] = 0.4f + 0.6f * r.nextFloat();
            n++;
        }
        s.append(",\"nube\":"); arr(s, nube, n * 4);
        s.append(String.format(Locale.ROOT, ",\"puntosSobre\":%d", Mesa.puntosSobre(mesa, nube, n, 0.25f)));
        // las manos de guía
        float[] q = new float[3];
        Mesa.puntoAdelante(mesa, cabeza, adelante, 0.34f, q);
        float[][][] guias = new float[2][21][3];
        Mesa.manosGuia(q, adelante, new float[]{0, 1, 0}, guias);
        s.append(",\"guias\":[");
        for (int g = 0; g < 2; g++) {
            if (g > 0) s.append(',');
            s.append('[');
            for (int i = 0; i < 21; i++) { if (i > 0) s.append(','); arr(s, guias[g][i]); }
            s.append(']');
        }
        s.append(']');
        // la etiqueta, como en Principal.confirmarMesa
        float[] qe = new float[3];
        Mesa.puntoAdelante(mesa, cabeza, adelante, 0.6f, qe);
        float fl = (float) Math.hypot(adelante[0], adelante[2]), fx = adelante[0] / fl, fz = adelante[2] / fl;
        float an = 0.2f, al = an * 128 / 512;
        s.append(",\"etiqueta\":{\"c\":"); arr(s, new float[]{qe[0], qe[1] + 0.004f, qe[2]});
        s.append(",\"r\":"); arr(s, new float[]{-fz * an, 0, fx * an});
        s.append(",\"u\":"); arr(s, new float[]{fx * al, 0, fz * al});
        s.append('}');
        // la onda: donde la mirada corta la mesa
        float tt = (mesa.pose[13] - cabeza[1]) / adelante[1];
        float[] lo = new float[3];
        mesa.aLocal(cabeza[0] + adelante[0] * tt, mesa.pose[13], cabeza[2] + adelante[2] * tt, lo);
        s.append(",\"onda\":"); arr(s, new float[]{lo[0], lo[2], 0.42f});
        // la cápsula de las manos (la de ManosGl) y sus huesos
        s.append(",\"capsula\":"); arr(s, ManosGl.geometria());
        short[] ind = ManosGl.indices();
        s.append(",\"indices\":[");
        for (int i = 0; i < ind.length; i++) { if (i > 0) s.append(','); s.append(ind[i]); }
        s.append("],\"huesos\":[");
        for (int k = 0; k < ManosGl.HUESOS.length; k++) { if (k > 0) s.append(','); s.append('[').append(ManosGl.HUESOS[k][0]).append(',').append(ManosGl.HUESOS[k][1]).append(']'); }
        s.append("],\"radio\":"); arr(s, ManosGl.RADIO);
        // el escritorio después del inicio: las apps delante, la barra apoyada en la mesa
        Escritorio em = new Escritorio();
        em.recentrar(cabeza[0], cabeza[1], cabeza[2], 0);
        float[] qb = new float[3];
        Mesa.puntoAdelante(mesa, cabeza, new float[]{0, 0, -1}, 0.36f, qb);
        em.mesa = qb;
        em.ponerDock(1400, 170, 0.66f, 0);
        em.abrir("navegador", 1280, 800, 1);
        em.abrir("galeria", 1280, 800, 2);
        em.abrir("ajustes", 1100, 800, 3);
        s.append(",\"escritorio\":");
        ventanas(s, em);
        // el inicio, en el lugar del centro
        Escritorio ei = new Escritorio();
        ei.recentrar(cabeza[0], cabeza[1], cabeza[2], 0);
        ei.abrir("inicio", 1100, 720, 1);
        s.append(",\"panel\":");
        ventanas(s, ei);
        s.append("}}");
        try (FileWriter wr = new FileWriter(a[0])) { wr.write(s.toString()); }
        System.out.println("vista: " + (f1 - f0) / 2 + " + " + (f2 - f1) / 2 + " + " + (f3 - f2) / 2 + " programas, "
                + e.ventanas.size() + " ventanas; la mesa elegida: " + (elegida >= 0 ? ps.get(elegida).id : -1)
                + String.format(Locale.ROOT, " (%.2f m²)", mesa.area()));
    }
}
