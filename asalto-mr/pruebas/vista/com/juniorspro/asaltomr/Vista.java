package com.juniorspro.asaltomr;

import android.opengl.GLES20;

import java.io.FileWriter;
import java.io.IOException;
import java.util.List;
import java.util.Locale;

/**
 * Arma los datos de la vista previa: escanea la escena de prueba, malla, pone
 * soldados (corriendo, apuntando, uno cayendo de un tiro) y corre Figuras.java
 * DE VERDAD con un GLES20 que graba las cajas. pruebas/vista.mjs lo dibuja.
 */
public class Vista {
    static float[] perspectiva(float fovy, float asp, float cerca, float lejos) {
        float f = (float) (1 / Math.tan(Math.toRadians(fovy) / 2));
        float[] m = new float[16];
        m[0] = f / asp; m[5] = f; m[10] = (lejos + cerca) / (cerca - lejos); m[11] = -1; m[14] = 2 * lejos * cerca / (cerca - lejos);
        return m;
    }

    /** Vista mirando de o hacia p (como setLookAtM). */
    static float[] mirar(float[] o, float[] p) {
        float fx = p[0] - o[0], fy = p[1] - o[1], fz = p[2] - o[2];
        float l = (float) Math.sqrt(fx * fx + fy * fy + fz * fz);
        fx /= l; fy /= l; fz /= l;
        float sx = fy * 0 - fz * 1, sy = fz * 0 - fx * 0, sz = fx * 1 - fy * 0;   // f × arriba
        l = (float) Math.sqrt(sx * sx + sy * sy + sz * sz);
        sx /= l; sy /= l; sz /= l;
        float ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
        float[] m = new float[16];
        m[0] = sx; m[4] = sy; m[8] = sz;
        m[1] = ux; m[5] = uy; m[9] = uz;
        m[2] = -fx; m[6] = -fy; m[10] = -fz;
        m[12] = -(sx * o[0] + sy * o[1] + sz * o[2]);
        m[13] = -(ux * o[0] + uy * o[1] + uz * o[2]);
        m[14] = (fx * o[0] + fy * o[1] + fz * o[2]);
        m[15] = 1;
        return m;
    }

    static void arr(StringBuilder s, float[] a, int n) {
        s.append('[');
        for (int i = 0; i < n; i++) { if (i > 0) s.append(','); s.append(String.format(Locale.ROOT, "%.4f", a[i])); }
        s.append(']');
    }

    public static void main(String[] a) throws Exception {
        Tsdf tsdf = new Tsdf(0.07f);
        java.lang.reflect.Method esc = Class.forName("PruebaEscaneo").getDeclaredMethod("escanear", Tsdf.class, int.class);
        esc.setAccessible(true);
        esc.invoke(null, tsdf, 60);
        tsdf.propagarBordes();
        List<Tsdf.Bloque> bloques = tsdf.tomarSucios();
        Mallador mal = new Mallador();
        StringBuilder v = new StringBuilder("["), tri = new StringBuilder("["), lin = new StringBuilder("[");
        int base = 0;
        boolean primero = true, primeroT = true, primeroL = true;
        for (Tsdf.Bloque b : bloques) {
            Mallador.Malla m = mal.mallar(tsdf, b);
            if (m == null) continue;
            for (int i = 0; i < m.nVert * 6; i++) { if (!primero) v.append(','); primero = false; v.append(String.format(Locale.ROOT, "%.3f", m.vert[i])); }
            for (int i = 0; i < m.nTri; i++) { if (!primeroT) tri.append(','); primeroT = false; tri.append(base + (m.tri[i] & 0xFFFF)); }
            for (int i = 0; i < m.nLin; i++) { if (!primeroL) lin.append(','); primeroL = false; lin.append(base + (m.lin[i] & 0xFFFF)); }
            base += m.nVert;
        }
        v.append(']'); tri.append(']'); lin.append(']');

        // el juego: tres soldados puestos a mano, a uno se le dispara
        final float JX = 0, JY = 1.5f, JZ = 1.2f;
        Juego j = new Juego(4);
        j.pisoRespaldo = 0;
        j.empezar();
        j.soldados.clear();
        Juego.Soldado corre = new Juego.Soldado();
        corre.x = -1.0f; corre.z = -2.6f; corre.yaw = (float) Math.atan2(JX - corre.x, JZ - corre.z) + 0.6f; corre.fase = 1.2f;
        Juego.Soldado apunta = new Juego.Soldado();
        apunta.x = 2.0f; apunta.z = -3.0f; apunta.yaw = (float) Math.atan2(JX - apunta.x, JZ - apunta.z); apunta.estado = Juego.APUNTA; apunta.apunta = 1; apunta.fogonazo = 0.05f;
        Juego.Soldado cae = new Juego.Soldado();
        cae.x = 0.1f; cae.z = -1.0f; cae.yaw = (float) Math.atan2(JX - cae.x, JZ - cae.z); cae.fase = 3f;
        Juego.Soldado detras = new Juego.Soldado();   // medio tapado por el tronco
        detras.x = -1.75f; detras.z = -2.7f; detras.yaw = 0.3f; detras.fase = 0.4f;
        j.soldados.add(corre); j.soldados.add(apunta); j.soldados.add(cae); j.soldados.add(detras);
        Juego.Entorno e = new Juego.Entorno() {
            public float suelo(float x, float z, float y0, float y1) { return tsdf.suelo(x, z, y0, y1); }
            public float rayo(float ox, float oy, float oz, float dx, float dy, float dz, float m) { return tsdf.rayo(ox, oy, oz, dx, dy, dz, m); }
            public boolean ocupado(float x, float y, float z) { return tsdf.ocupado(x, y, z); }
        };
        float tx = cae.x - JX, ty = 1.1f - JY, tz = cae.z - JZ;
        float tl = (float) Math.sqrt(tx * tx + ty * ty + tz * tz);
        Juego.Impacto imp = j.disparar(JX, JY, JZ, tx / tl, ty / tl, tz / tl, JX + 0.13f, JY - 0.12f, JZ - 0.5f, e);
        // otro tiro a la pared de atrás: chispas y polvo en la superficie real
        for (int i = 0; i < 4; i++) j.actualizar(0.05f, JX, JY, JZ, 0, -1, e);
        j.disparar(JX, JY, JZ, 0.35f, -0.05f, -0.94f, JX + 0.13f, JY - 0.12f, JZ - 0.5f, e);
        for (int i = 0; i < 2; i++) j.actualizar(0.05f, JX, JY, JZ, 0, -1, e);
        corre.estado = Juego.CORRE; apunta.estado = Juego.APUNTA; apunta.fogonazo = 0.05f;   // que no se muevan de la foto
        System.out.println("impacto: tipo " + imp.tipo + ", cayendo: estado " + cae.estado + String.format(Locale.ROOT, " caida %.0f° y %.2f", Math.toDegrees(cae.caida), cae.y));

        // las vistas: pantalla (2340×1080) y los dos ojos de SBS
        float[] ojo = {JX, JY, JZ}, hacia = {0.25f, 0.75f, -2.5f};
        float[] vistaM = mirar(ojo, hacia);
        Figuras fig = new Figuras();
        fig.crear();
        StringBuilder s = new StringBuilder("{\"malla\":{\"v\":").append(v).append(",\"tri\":").append(tri).append(",\"lin\":").append(lin).append("},\"vistas\":{");
        String[] nombres = {"pantalla", "izq", "der"};
        for (int k = 0; k < 3; k++) {
            float asp = k == 0 ? 2340f / 1080f : 1076f / 994f;
            float[] proy = k == 0 ? perspectiva(34f, asp, 0.05f, 80f) : perspectiva(50f, asp, 0.05f, 80f);
            float lado = k == 0 ? 0 : k == 1 ? -1 : 1;
            float[] desp = new float[16];
            android.opengl.Matrix.setIdentityM(desp, 0);
            android.opengl.Matrix.translateM(desp, 0, -lado * 0.0315f, 0, 0);
            float[] vOjo = new float[16], vp = new float[16], pOjo = new float[16];
            android.opengl.Matrix.multiplyMM(vOjo, 0, desp, 0, vistaM, 0);
            android.opengl.Matrix.multiplyMM(vp, 0, proy, 0, vOjo, 0);
            android.opengl.Matrix.multiplyMM(pOjo, 0, proy, 0, desp, 0);
            GLES20.cajas.clear();
            fig.dibujarSoldados(j.soldados, vp);
            int nSold = GLES20.cajas.size();
            fig.dibujarPistola(pOjo, 0.6f, 0, 1.3f);
            if (k > 0) s.append(',');
            s.append('"').append(nombres[k]).append("\":{\"vp\":");
            arr(s, vp, 16);
            s.append(",\"vista\":");
            arr(s, vOjo, 16);
            s.append(",\"nSoldados\":").append(nSold).append(",\"cajas\":[");
            for (int i = 0; i < GLES20.cajas.size(); i++) { if (i > 0) s.append(','); arr(s, GLES20.cajas.get(i), 36); }
            s.append("]}");
        }
        // la cámara del teléfono en SBS: el ojo del medio, con la proyección de un ojo
        float[] vpCam = new float[16];
        android.opengl.Matrix.multiplyMM(vpCam, 0, perspectiva(50f, 1076f / 994f, 0.05f, 80f), 0, vistaM, 0);
        s.append(",\"camaraSbs\":");
        arr(s, vpCam, 16);
        s.append("},\"particulas\":[");
        boolean pp = true;
        for (Juego.Particula p : j.particulas) {
            if (!pp) s.append(',');
            pp = false;
            s.append(String.format(Locale.ROOT, "[%.3f,%.3f,%.3f,%.3f,%d,%.2f]", p.x, p.y, p.z, p.tam, p.tipo, p.vida / p.vidaMax));
        }
        s.append("],\"jugador\":");
        arr(s, ojo, 3);
        s.append('}');
        try (FileWriter w = new FileWriter(a[0])) { w.write(s.toString()); }
        System.out.println("vista: " + base + " vértices, " + j.soldados.size() + " soldados, " + j.particulas.size() + " partículas → " + a[0]);
    }
}
