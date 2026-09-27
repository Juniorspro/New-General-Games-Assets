package com.juniorspro.asaltomr;

import android.opengl.GLES20;

import java.nio.FloatBuffer;
import java.util.List;

/**
 * La VISTA DE SELLADO: los huecos del escaneo pintados sobre su pared, piso o
 * mesa, un cuadrito por celda (de un voxel), apenas delante de la superficie:
 *
 *   magenta, late    POR SELLAR: un hueco encerrado que se puede cerrar con el plano
 *   celeste          SELLADO: ya se cerró solo (destella al sellarse)
 *   naranja, late    FALTA ESCANEAR: un hueco demasiado grande para suponerlo: miralo
 *   gris             ABERTURA: se ve a través (una ventana, una puerta): no se sella
 *
 * Lo que está detrás de algo (la pared detrás del sillón) se ve igual, más
 * tenue: una pasada normal y otra "rayos X" donde la malla lo tapa.
 */
final class SellosGl {
    static final int FLOTANTES = 8;          // x, y, z, r, g, b, a, efecto (0 nada, 1 late, 2 destella)
    /** Los colores de cada estado (Sellador.POR_SELLAR … ABERTURA), también los del minimapa. */
    static final float[][] COLORES = {
            {1f, 0.15f, 0.85f, 0.7f},    // por sellar
            {0.3f, 0.9f, 1f, 0.22f},     // sellado
            {1f, 0.55f, 0.1f, 0.5f},     // falta escanear
            {0.75f, 0.75f, 0.8f, 0.12f}, // abertura
    };
    private int prog, aPos, aCol, aEfecto, uVp, uT, uDest, uRayosX;
    private FloatBuffer datos = Gl.bufer(6 * FLOTANTES * 1024);
    private int vertices;
    private List<Sellador.Hueco> ultima;
    private long armadoMs;

    void crear() {
        ultima = null;
        prog = Gl.programa(
                "uniform mat4 uVp; uniform float uT; uniform float uDest; uniform float uRayosX;\n"
                        + "attribute vec3 aPos; attribute vec4 aCol; attribute float aEfecto; varying vec4 vCol;\n"
                        + "void main() {\n"
                        + "  gl_Position = uVp * vec4(aPos, 1.0);\n"
                        + "  vec3 c = aCol.rgb; float a = aCol.a;\n"
                        + "  if (aEfecto > 0.5 && aEfecto < 1.5) a *= 0.6 + 0.4 * sin(uT * 5.0 + aPos.x * 2.0 + aPos.z * 2.0);\n"
                        + "  if (aEfecto > 1.5) { c = mix(c, vec3(1.0), uDest * 0.7); a = mix(a, 0.85, uDest); }\n"
                        + "  vCol = vec4(c, a * uRayosX);\n"
                        + "}",
                "precision mediump float; varying vec4 vCol; void main() { gl_FragColor = vCol; }");
        aPos = Gl.atributo(prog, "aPos");
        aCol = Gl.atributo(prog, "aCol");
        aEfecto = Gl.atributo(prog, "aEfecto");
        uVp = Gl.uniforme(prog, "uVp");
        uT = Gl.uniforme(prog, "uT");
        uDest = Gl.uniforme(prog, "uDest");
        uRayosX = Gl.uniforme(prog, "uRayosX");
    }

    /** Cuántos flotantes hacen falta para dibujar estos huecos. */
    static int tamano(List<Sellador.Hueco> hs) {
        int n = 0;
        for (Sellador.Hueco h : hs) n += (h.estado <= Sellador.SELLADO ? h.celdas.length / 2 : h.abiertas) * 6 * FLOTANTES;
        return n;
    }

    /**
     * Los cuadritos de los huecos (dos triángulos por celda, 1.5 cm delante del
     * plano). Lo que se sella se dibuja entero (con lo tapado alrededor); lo demás,
     * sólo lo que no se sabe. Devuelve cuántos flotantes escribió.
     */
    static int armar(List<Sellador.Hueco> hs, FloatBuffer b) {
        int ini = b.position();
        for (Sellador.Hueco h : hs) {
            float[] c = COLORES[h.estado];
            float efecto = h.estado == Sellador.POR_SELLAR || h.estado == Sellador.FALTA ? 1 : h.recien ? 2 : 0;
            int n = h.estado <= Sellador.SELLADO ? h.celdas.length / 2 : h.abiertas;
            float s = h.celda, m = s * 0.1f;   // margen: se ven las celdas separadas
            float ox = h.ox + h.nx * 0.015f, oy = h.oy + h.ny * 0.015f, oz = h.oz + h.nz * 0.015f;
            for (int q = 0; q < n; q++) {
                float i0 = h.celdas[q * 2] * s + m, j0 = h.celdas[q * 2 + 1] * s + m, i1 = i0 + s - 2 * m, j1 = j0 + s - 2 * m;
                float[][] esq = {{i0, j0}, {i1, j0}, {i1, j1}, {i0, j0}, {i1, j1}, {i0, j1}};
                for (float[] e : esq) {
                    b.put(ox + h.ux * e[0] + h.vx * e[1]).put(oy + h.uy * e[0] + h.vy * e[1]).put(oz + h.uz * e[0] + h.vz * e[1]);
                    b.put(c[0]).put(c[1]).put(c[2]).put(c[3]).put(efecto);
                }
            }
        }
        return b.position() - ini;
    }

    /** Rearma los cuadritos si el sellador encontró huecos nuevos. */
    void actualizar(Sellador s, long ahora) {
        List<Sellador.Hueco> hs = s.huecos;
        if (hs == ultima) return;
        ultima = hs;
        armadoMs = ahora;
        int n = tamano(hs);
        if (datos.capacity() < n) datos = Gl.bufer(n + 1024);
        datos.position(0);
        vertices = armar(hs, datos) / FLOTANTES;
    }

    void dibujar(float[] vp, float t, long ahora) {
        if (vertices == 0) return;
        GLES20.glUseProgram(prog);
        GLES20.glUniformMatrix4fv(uVp, 1, false, vp, 0);
        GLES20.glUniform1f(uT, t);
        GLES20.glUniform1f(uDest, Math.max(0, 1 - (ahora - armadoMs) / 1200f));
        datos.position(0);
        GLES20.glVertexAttribPointer(aPos, 3, GLES20.GL_FLOAT, false, FLOTANTES * 4, datos);
        datos.position(3);
        GLES20.glVertexAttribPointer(aCol, 4, GLES20.GL_FLOAT, false, FLOTANTES * 4, datos);
        datos.position(7);
        GLES20.glVertexAttribPointer(aEfecto, 1, GLES20.GL_FLOAT, false, FLOTANTES * 4, datos);
        GLES20.glEnableVertexAttribArray(aPos);
        GLES20.glEnableVertexAttribArray(aCol);
        GLES20.glEnableVertexAttribArray(aEfecto);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glDepthMask(false);
        // lo que se ve, y lo que está detrás de algo (más tenue)
        GLES20.glDepthFunc(GLES20.GL_LEQUAL);
        GLES20.glUniform1f(uRayosX, 1f);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, vertices);
        GLES20.glDepthFunc(GLES20.GL_GREATER);
        GLES20.glUniform1f(uRayosX, 0.5f);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, vertices);
        GLES20.glDepthFunc(GLES20.GL_LESS);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(aPos);
        GLES20.glDisableVertexAttribArray(aCol);
        GLES20.glDisableVertexAttribArray(aEfecto);
    }
}
