package com.juniorspro.asaltomr;

import android.opengl.GLES20;

import java.nio.FloatBuffer;
import java.nio.ShortBuffer;

/**
 * La mano "fantasma" como la de un Meta Quest (la misma de Aeroplaza): cada
 * hueso es una cápsula (dos medias esferas unidas por un cilindro) con el
 * radio de cada articulación, y el shader deja casi sólo el BORDE que brilla
 * (fresnel): tu mano real se sigue viendo en la cámara y encima, transparente,
 * el contorno que dice que la mano está rastreada. Las puntas del pulgar y el
 * índice se encienden al apretar el gatillo.
 *
 * Y una PASADA DE PROFUNDIDAD: la mano escribe su profundidad (sin color)
 * antes de lo virtual, así lo que está detrás de tu mano no se dibuja y tu
 * mano de verdad queda ADELANTE de los soldados; y otra vez antes del arma,
 * así los dedos tapan el mango (el arma queda agarrada, no pegada encima).
 *
 * Shaders portados de Aeroplaza (three.js) a GLES 2.0: sin instancias (una
 * cápsula por hueso con uniformes), y el borde suavizado en un píxel con
 * fwidth si el teléfono tiene GL_OES_standard_derivatives.
 */
final class ManosGl {
    /** Los huesos que se dibujan (los de Aeroplaza: los dedos, la palma y tres "telas" de la palma, más gruesas). */
    static final int[][] HUESOS = {{0, 1}, {1, 2}, {2, 3}, {3, 4}, {0, 5}, {5, 6}, {6, 7}, {7, 8}, {5, 9}, {9, 10}, {10, 11}, {11, 12},
            {9, 13}, {13, 14}, {14, 15}, {15, 16}, {13, 17}, {0, 17}, {17, 18}, {18, 19}, {19, 20}, {0, 9}, {0, 13}, {1, 5}};
    /** Radio de cada articulación (m), el de Aeroplaza. */
    static final float[] RADIO = {0.02f, 0.013f, 0.0118f, 0.0105f, 0.0092f, 0.0112f, 0.0102f, 0.0094f, 0.0084f, 0.0114f, 0.0104f,
            0.0095f, 0.0085f, 0.0108f, 0.0099f, 0.009f, 0.0081f, 0.0096f, 0.0088f, 0.008f, 0.0072f};
    /** Las "telas" de la palma (0-9, 0-13, 1-5) van 35 % más gruesas: la palma se ve llena. */
    static boolean esTela(int k) { return k >= 21; }
    /** Color, borde y opacidad (los de Aeroplaza). fantasma: 1 = casi sólo el borde (la mano real se ve en la cámara). */
    static final float[] COLOR = {0.8f, 0.88f, 0.96f}, BORDE = {0.72f, 0.97f, 1f};
    static final float OPACIDAD = 0.88f;
    float fantasma = 1f;

    private FloatBuffer vert;
    private ShortBuffer ind;
    private int nInd;
    private int progProf, progVidrio;
    private int pNrm, pLado, pVista, pProy, pA, pB, pR, pBr, pCorte;
    private int vNrm, vLado, vVista, vProy, vA, vB, vR, vBr, vCorte, vColor, vBorde, vOpacidad, vFantasma;

    /** La cápsula (Aeroplaza: ox(10, 4)): 2 medias esferas × 5 anillos × 11 puntos; normal y de qué punta es. */
    static float[] geometria() {
        int n = 10, e = 4;
        float[] v = new float[2 * (e + 1) * (n + 1) * 4];
        int k = 0;
        for (int l = 0; l < 2; l++)
            for (int c = 0; c <= e; c++) {
                double u = l == 0 ? -Math.PI / 2 + (c / (double) e) * Math.PI / 2 : (c / (double) e) * Math.PI / 2;
                for (int f = 0; f <= n; f++) {
                    double m = f / (double) n * Math.PI * 2;
                    v[k++] = (float) (Math.cos(u) * Math.cos(m));
                    v[k++] = (float) (Math.cos(u) * Math.sin(m));
                    v[k++] = (float) Math.sin(u);
                    v[k++] = l;
                }
            }
        return v;
    }

    static short[] indices() {
        int n = 10, anillos = 10;
        short[] o = new short[(anillos - 1) * n * 6];
        int k = 0;
        for (int l = 0; l < anillos - 1; l++)
            for (int c = 0; c < n; c++) {
                short u = (short) (l * (n + 1) + c), h = (short) (u + 1), f = (short) ((l + 1) * (n + 1) + c), m = (short) (f + 1);
                o[k++] = u; o[k++] = h; o[k++] = f; o[k++] = h; o[k++] = m; o[k++] = f;
            }
        return o;
    }

    void crear() {
        vert = Gl.bufer(geometria());
        short[] is = indices();
        nInd = is.length;
        ind = java.nio.ByteBuffer.allocateDirect(is.length * 2).order(java.nio.ByteOrder.nativeOrder()).asShortBuffer();
        ind.put(is).position(0);
        progProf = Gl.programa(
                "uniform mat4 uVista; uniform mat4 uProy; uniform vec3 uA; uniform vec3 uB; uniform vec2 uR; uniform vec2 uBr; uniform float uCorte;\n"
                        + "attribute vec3 aNrm; attribute float aLado;\n"
                        + "void main() {\n"
                        + "  if (uBr.y < uCorte) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }\n"
                        + "  vec3 d = uB - uA; float L = length(d); vec3 w = L > 1e-5 ? d / L : vec3(0.0, 1.0, 0.0);\n"
                        + "  vec3 up = abs(w.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);\n"
                        + "  vec3 u = normalize(cross(up, w)), v = cross(w, u);\n"
                        + "  vec3 n = u * aNrm.x + v * aNrm.y + w * aNrm.z;\n"
                        + "  vec3 p = (aLado < 0.5 ? uA : uB) + n * (aLado < 0.5 ? uR.x : uR.y);\n"
                        + "  gl_Position = uProy * (uVista * vec4(p, 1.0));\n"
                        + "}",
                "precision mediump float; void main() { gl_FragColor = vec4(0.0); }");
        pNrm = Gl.atributo(progProf, "aNrm"); pLado = Gl.atributo(progProf, "aLado");
        pVista = Gl.uniforme(progProf, "uVista"); pProy = Gl.uniforme(progProf, "uProy");
        pA = Gl.uniforme(progProf, "uA"); pB = Gl.uniforme(progProf, "uB"); pR = Gl.uniforme(progProf, "uR");
        pBr = Gl.uniforme(progProf, "uBr"); pCorte = Gl.uniforme(progProf, "uCorte");
        // el vidrio: con el borde suavizado en un píxel (fwidth) si se puede; si no, sin eso
        String ext = GLES20.glGetString(GLES20.GL_EXTENSIONS);
        boolean derivadas = ext != null && ext.contains("GL_OES_standard_derivatives");
        int p = 0;
        if (derivadas) {
            try {
                p = Gl.programa(
                        "uniform mat4 uVista; uniform mat4 uProy; uniform vec3 uA; uniform vec3 uB; uniform vec2 uR; uniform vec2 uBr; uniform float uCorte;\n"
                                + "attribute vec3 aNrm; attribute float aLado;\n"
                                + "varying vec3 vN; varying vec3 vV; varying float vBr; varying float vAlfa;\n"
                                + "void main() {\n"
                                + "  if (uBr.y < uCorte) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }\n"
                                + "  vec3 d = uB - uA; float L = length(d); vec3 w = L > 1e-5 ? d / L : vec3(0.0, 1.0, 0.0);\n"
                                + "  vec3 up = abs(w.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);\n"
                                + "  vec3 u = normalize(cross(up, w)), v = cross(w, u);\n"
                                + "  vec3 n = u * aNrm.x + v * aNrm.y + w * aNrm.z;\n"
                                + "  vec3 p = (aLado < 0.5 ? uA : uB) + n * (aLado < 0.5 ? uR.x : uR.y);\n"
                                + "  vec4 mv = uVista * vec4(p, 1.0);\n"
                                + "  vN = normalize(mat3(uVista[0].xyz, uVista[1].xyz, uVista[2].xyz) * n); vV = normalize(-mv.xyz); vBr = uBr.x; vAlfa = uBr.y;\n"
                                + "  gl_Position = uProy * mv;\n"
                                + "}",
                        "#extension GL_OES_standard_derivatives : enable\n"
                                + "precision mediump float;\n"
                                + "uniform vec3 uColor; uniform vec3 uBorde; uniform float uOpacidad; uniform float uFantasma;\n"
                                + "varying vec3 vN; varying vec3 vV; varying float vBr; varying float vAlfa;\n"
                                + "void main() {\n"
                                + "  vec3 n = normalize(vN), v = normalize(vV);\n"
                                + "  float f = pow(1.0 - max(0.0, dot(n, v)), 2.0);\n"
                                + "  float luz = max(0.0, dot(n, normalize(vec3(-0.35, 0.85, 0.4)))), cielo = 0.5 + 0.5 * n.y;\n"
                                + "  float brillo = pow(max(0.0, dot(reflect(-v, n), normalize(vec3(-0.3, 0.8, 0.5)))), 28.0);\n"
                                + "  vec3 c = mix(vec3(0.34, 0.43, 0.55), uColor, 0.18 + 0.62 * luz + 0.2 * cielo);\n"
                                + "  c = mix(c, uBorde, smoothstep(0.22, 0.88, f) * 0.88) + vec3(1.0) * brillo * 0.5;\n"
                                + "  c = mix(c, vec3(0.5, 1.0, 1.0), vBr * (0.4 + 0.6 * f));\n"
                                + "  float ndv = max(0.0, dot(n, v)), aa = clamp(ndv / max(fwidth(ndv) * 1.5, 1e-4), 0.0, 1.0);\n"
                                + "  float a = mix(uOpacidad * (0.72 + 0.28 * f), 0.05 + 0.7 * smoothstep(0.3, 0.95, f), uFantasma);\n"
                                + "  c = mix(c, uBorde, uFantasma * 0.55);\n"
                                + "  gl_FragColor = vec4(c, clamp((a + vBr * 0.25) * vAlfa * aa, 0.0, 1.0));\n"
                                + "}");
            } catch (RuntimeException e) {
                p = 0;
            }
        }
        if (p == 0) p = Gl.programa(
                "uniform mat4 uVista; uniform mat4 uProy; uniform vec3 uA; uniform vec3 uB; uniform vec2 uR; uniform vec2 uBr; uniform float uCorte;\n"
                        + "attribute vec3 aNrm; attribute float aLado;\n"
                        + "varying vec3 vN; varying vec3 vV; varying float vBr; varying float vAlfa;\n"
                        + "void main() {\n"
                        + "  if (uBr.y < uCorte) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }\n"
                        + "  vec3 d = uB - uA; float L = length(d); vec3 w = L > 1e-5 ? d / L : vec3(0.0, 1.0, 0.0);\n"
                        + "  vec3 up = abs(w.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);\n"
                        + "  vec3 u = normalize(cross(up, w)), v = cross(w, u);\n"
                        + "  vec3 n = u * aNrm.x + v * aNrm.y + w * aNrm.z;\n"
                        + "  vec3 p = (aLado < 0.5 ? uA : uB) + n * (aLado < 0.5 ? uR.x : uR.y);\n"
                        + "  vec4 mv = uVista * vec4(p, 1.0);\n"
                        + "  vN = normalize(mat3(uVista[0].xyz, uVista[1].xyz, uVista[2].xyz) * n); vV = normalize(-mv.xyz); vBr = uBr.x; vAlfa = uBr.y;\n"
                        + "  gl_Position = uProy * mv;\n"
                        + "}",
                "precision mediump float;\n"
                        + "uniform vec3 uColor; uniform vec3 uBorde; uniform float uOpacidad; uniform float uFantasma;\n"
                        + "varying vec3 vN; varying vec3 vV; varying float vBr; varying float vAlfa;\n"
                        + "void main() {\n"
                        + "  vec3 n = normalize(vN), v = normalize(vV);\n"
                        + "  float f = pow(1.0 - max(0.0, dot(n, v)), 2.0);\n"
                        + "  float luz = max(0.0, dot(n, normalize(vec3(-0.35, 0.85, 0.4)))), cielo = 0.5 + 0.5 * n.y;\n"
                        + "  float brillo = pow(max(0.0, dot(reflect(-v, n), normalize(vec3(-0.3, 0.8, 0.5)))), 28.0);\n"
                        + "  vec3 c = mix(vec3(0.34, 0.43, 0.55), uColor, 0.18 + 0.62 * luz + 0.2 * cielo);\n"
                        + "  c = mix(c, uBorde, smoothstep(0.22, 0.88, f) * 0.88) + vec3(1.0) * brillo * 0.5;\n"
                        + "  c = mix(c, vec3(0.5, 1.0, 1.0), vBr * (0.4 + 0.6 * f));\n"
                        + "  float a = mix(uOpacidad * (0.72 + 0.28 * f), 0.05 + 0.7 * smoothstep(0.3, 0.95, f), uFantasma);\n"
                        + "  c = mix(c, uBorde, uFantasma * 0.55);\n"
                        + "  gl_FragColor = vec4(c, clamp((a + vBr * 0.25) * vAlfa, 0.0, 1.0));\n"
                        + "}");
        progVidrio = p;
        vNrm = Gl.atributo(p, "aNrm"); vLado = Gl.atributo(p, "aLado");
        vVista = Gl.uniforme(p, "uVista"); vProy = Gl.uniforme(p, "uProy");
        vA = Gl.uniforme(p, "uA"); vB = Gl.uniforme(p, "uB"); vR = Gl.uniforme(p, "uR");
        vBr = Gl.uniforme(p, "uBr"); vCorte = Gl.uniforme(p, "uCorte");
        vColor = Gl.uniforme(p, "uColor"); vBorde = Gl.uniforme(p, "uBorde");
        vOpacidad = Gl.uniforme(p, "uOpacidad"); vFantasma = Gl.uniforme(p, "uFantasma");
    }

    private void atributos(int nrm, int lado) {
        vert.position(0);
        GLES20.glVertexAttribPointer(nrm, 3, GLES20.GL_FLOAT, false, 16, vert);
        vert.position(3);
        GLES20.glVertexAttribPointer(lado, 1, GLES20.GL_FLOAT, false, 16, vert);
        GLES20.glEnableVertexAttribArray(nrm);
        GLES20.glEnableVertexAttribArray(lado);
    }

    private void capsulas(float[][] p, float alfa, float brillo, int uA, int uB, int uR, int uBr) {
        for (int k = 0; k < HUESOS.length; k++) {
            int h = HUESOS[k][0], f = HUESOS[k][1];
            float m = esTela(k) ? 1.35f : 1f;
            GLES20.glUniform3f(uA, p[h][0], p[h][1], p[h][2]);
            GLES20.glUniform3f(uB, p[f][0], p[f][1], p[f][2]);
            GLES20.glUniform2f(uR, RADIO[h] * m, RADIO[f] * m);
            // las puntas del pulgar y del índice se encienden con el gatillo (Aeroplaza: con el pellizco)
            boolean punta = f == 3 || f == 4 || f == 7 || f == 8;
            GLES20.glUniform2f(uBr, punta ? brillo : 0, alfa);
            ind.position(0);
            GLES20.glDrawElements(GLES20.GL_TRIANGLES, nInd, GLES20.GL_UNSIGNED_SHORT, ind);
        }
    }

    /**
     * La profundidad de las manos (sin color): lo que venga después y quede
     * detrás de una mano no se dibuja. Sólo manos que se ven bien (alfa ≥ 0.6:
     * una que se está yendo no tapa).
     */
    void profundidad(float[] vista, float[] proy, float[][][] manos, float[] alfas, int n) {
        GLES20.glUseProgram(progProf);
        GLES20.glUniformMatrix4fv(pVista, 1, false, vista, 0);
        GLES20.glUniformMatrix4fv(pProy, 1, false, proy, 0);
        GLES20.glUniform1f(pCorte, 0.6f);
        atributos(pNrm, pLado);
        GLES20.glColorMask(false, false, false, false);
        GLES20.glDepthMask(true);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
        for (int k = 0; k < n; k++) if (alfas[k] > 0.01f) capsulas(manos[k], alfas[k], 0, pA, pB, pR, pBr);
        GLES20.glColorMask(true, true, true, true);
        GLES20.glDisableVertexAttribArray(pNrm);
        GLES20.glDisableVertexAttribArray(pLado);
    }

    /** El vidrio: la mano transparente con el borde que brilla (después de lo demás). */
    void vidrio(float[] vista, float[] proy, float[][][] manos, float[] alfas, float[] brillos, int n) {
        GLES20.glUseProgram(progVidrio);
        GLES20.glUniformMatrix4fv(vVista, 1, false, vista, 0);
        GLES20.glUniformMatrix4fv(vProy, 1, false, proy, 0);
        GLES20.glUniform1f(vCorte, -1f);
        GLES20.glUniform3f(vColor, COLOR[0], COLOR[1], COLOR[2]);
        GLES20.glUniform3f(vBorde, BORDE[0], BORDE[1], BORDE[2]);
        GLES20.glUniform1f(vOpacidad, OPACIDAD);
        GLES20.glUniform1f(vFantasma, fantasma);
        atributos(vNrm, vLado);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glDepthMask(false);
        GLES20.glDepthFunc(GLES20.GL_LEQUAL);
        for (int k = 0; k < n; k++) if (alfas[k] > 0.01f) capsulas(manos[k], alfas[k], brillos[k], vA, vB, vR, vBr);
        GLES20.glDepthFunc(GLES20.GL_LESS);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDisableVertexAttribArray(vNrm);
        GLES20.glDisableVertexAttribArray(vLado);
    }
}
