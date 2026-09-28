package com.juniorspro.nexoxr;

import android.opengl.GLES20;

import java.io.FileWriter;
import java.util.Locale;

/**
 * Los datos de la vista previa (pruebas/vista.mjs los dibuja con WebGL): los
 * shaders DE VERDAD de Entornos y VentanasGl, y dónde pone el Escritorio cada
 * ventana (el dock, tres apps), vistas desde la cabeza.
 */
public class Vista {
    static void arr(StringBuilder s, float[] a) {
        s.append('[');
        for (int i = 0; i < a.length; i++) { if (i > 0) s.append(','); s.append(String.format(Locale.ROOT, "%.5f", a[i])); }
        s.append(']');
    }

    static String js(String x) { return "\"" + x.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""; }

    public static void main(String[] a) throws Exception {
        new Entornos().crear();
        new VentanasGl().crear();
        StringBuilder s = new StringBuilder("{\"programas\":[");
        for (int i = 0; i + 1 < GLES20.fuentes.size(); i += 2) {
            if (i > 0) s.append(',');
            s.append("{\"vs\":").append(js(GLES20.fuentes.get(i))).append(",\"fs\":").append(js(GLES20.fuentes.get(i + 1))).append('}');
        }
        Escritorio e = new Escritorio();
        e.recentrar(0, 1.6f, 0, 0);
        e.ponerDock(1400, 170, 0.66f, 0);
        e.abrir("navegador", 1280, 800, 1);
        e.abrir("galeria", 1280, 800, 2);
        e.abrir("ajustes", 1100, 800, 3);
        s.append("],\"ventanas\":[");
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
        s.append("]}");
        try (FileWriter w = new FileWriter(a[0])) { w.write(s.toString()); }
        System.out.println("vista: " + GLES20.fuentes.size() / 2 + " programas, " + e.ventanas.size() + " ventanas");
    }
}
