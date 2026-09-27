package com.juniorspro.asaltomr;

import android.opengl.GLES20;

import java.nio.FloatBuffer;

/**
 * Las zonas de la IA, pintadas sobre el piso real (un cuadrito por celda del
 * mapa, apenas arriba del suelo):
 *
 *   verde      por donde se puede ir (visto)      celeste   por donde se puede ir (supuesto)
 *   amarillo   cubierta (algo te tapa ahí)         azul      agua
 *   rojo       obstáculo                            magenta   frontera: falta escanear
 */
final class ZonasGl {
    private static final int FLOTANTES = 7;          // x, y, z, r, g, b, a
    private int prog, aPos, aCol, uVp;
    private FloatBuffer datos = Gl.bufer(6 * FLOTANTES * 1024);
    private int vertices, version = -1;

    void crear() {
        version = -1;
        prog = Gl.programa(
                "uniform mat4 uVp; attribute vec3 aPos; attribute vec4 aCol; varying vec4 vCol;\n"
                        + "void main() { gl_Position = uVp * vec4(aPos, 1.0); vCol = aCol; }",
                "precision mediump float; varying vec4 vCol; void main() { gl_FragColor = vCol; }");
        aPos = Gl.atributo(prog, "aPos");
        aCol = Gl.atributo(prog, "aCol");
        uVp = Gl.uniforme(prog, "uVp");
    }

    /** Rearma los cuadritos si el mapa cambió. */
    void actualizar(Mapa.Grilla g, boolean conFronteras) {
        if (g == null || g.version == version) return;
        version = g.version;
        int n = 0;
        for (int c = 0; c < g.n * g.n; c++) if (g.clase[c] != Mapa.DESCONOCIDO || (conFronteras && g.frontera[c])) n++;
        if (datos.capacity() < n * 6 * FLOTANTES) datos = Gl.bufer(n * 6 * FLOTANTES + 1024);
        datos.position(0);
        float m = Mapa.CELDA * 0.08f;   // margen: se ven las celdas separadas
        for (int c = 0; c < g.n * g.n; c++) {
            float r, gg, b, a;
            int cl = g.clase[c];
            if (cl == Mapa.SUELO) {
                if (g.cubierta[c]) { r = 1f; gg = 0.85f; b = 0.2f; a = 0.45f; }
                else if (g.inferida[c]) { r = 0.25f; gg = 0.8f; b = 0.95f; a = 0.12f; }
                else { r = 0.2f; gg = 0.95f; b = 0.5f; a = 0.16f; }
            } else if (cl == Mapa.AGUA) { r = 0.2f; gg = 0.5f; b = 1f; a = 0.4f; }
            else if (cl == Mapa.OBSTACULO) { r = 1f; gg = 0.25f; b = 0.2f; a = g.inferida[c] ? 0.15f : 0.25f; }
            else if (conFronteras && g.frontera[c]) { r = 1f; gg = 0.2f; b = 0.9f; a = 0.35f; }
            else continue;
            float x0 = g.x(c % g.n) - Mapa.CELDA / 2 + m, x1 = x0 + Mapa.CELDA - 2 * m;
            float z0 = g.z(c / g.n) - Mapa.CELDA / 2 + m, z1 = z0 + Mapa.CELDA - 2 * m;
            float y = (cl == Mapa.DESCONOCIDO ? g.pisoRef : g.piso[c]) + 0.03f;
            float[][] q = {{x0, z0}, {x1, z0}, {x1, z1}, {x0, z0}, {x1, z1}, {x0, z1}};
            for (float[] v : q) datos.put(v[0]).put(y).put(v[1]).put(r).put(gg).put(b).put(a);
        }
        vertices = datos.position() / FLOTANTES;
    }

    void dibujar(float[] vp) {
        if (vertices == 0) return;
        GLES20.glUseProgram(prog);
        GLES20.glUniformMatrix4fv(uVp, 1, false, vp, 0);
        datos.position(0);
        GLES20.glVertexAttribPointer(aPos, 3, GLES20.GL_FLOAT, false, FLOTANTES * 4, datos);
        datos.position(3);
        GLES20.glVertexAttribPointer(aCol, 4, GLES20.GL_FLOAT, false, FLOTANTES * 4, datos);
        GLES20.glEnableVertexAttribArray(aPos);
        GLES20.glEnableVertexAttribArray(aCol);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glDepthMask(false);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, vertices);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(aPos);
        GLES20.glDisableVertexAttribArray(aCol);
    }
}
