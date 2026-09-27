package com.juniorspro.asaltomr;

import android.opengl.GLES20;

import java.nio.FloatBuffer;

/**
 * La corrección de los lentes de un visor tipo Cardboard.
 *
 * Los lentes agrandan y deforman hacia afuera (cojín). Para que se vea
 * derecho, la imagen se dibuja antes deformada al revés (barril): todo se
 * dibuja primero en un búfer de la pantalla entera, y después cada mitad se
 * copia a la pantalla leyendo cada píxel desde un radio mayor:
 *
 *   fuente = centro + (p − centro) · (1 + k1·r² + k2·r⁴)
 *
 * con r medido desde el centro del lente de ese ojo. k1 y k2 se ajustan en la
 * configuración (los valores dependen del visor).
 */
final class Lentes {
    private int fbo, color, profundidad, ancho, alto;
    private int prog, aPos, uTex, uCentro, uRadio, uK, uTam, uMin, uMax;
    private final FloatBuffer quad = Gl.bufer(new float[]{-1, -1, 1, -1, -1, 1, 1, 1});

    void crear() {
        fbo = 0;
        prog = Gl.programa(
                "attribute vec2 aPos; varying vec2 vP; void main() { gl_Position = vec4(aPos, 0.0, 1.0); vP = aPos * 0.5 + 0.5; }",
                "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n"
                        + "uniform sampler2D uTex; uniform vec2 uCentro; uniform float uRadio; uniform vec2 uK;\n"
                        + "uniform vec2 uTam; uniform vec2 uMin; uniform vec2 uMax; varying vec2 vP;\n"
                        + "void main() {\n"
                        + "  vec2 px = vP * uTam;\n"                               // en píxeles
                        + "  vec2 d = (px - uCentro) / uRadio;\n"
                        + "  float r2 = dot(d, d);\n"
                        + "  vec2 f = uCentro + (px - uCentro) * (1.0 + uK.x * r2 + uK.y * r2 * r2);\n"
                        + "  if (f.x < uMin.x || f.y < uMin.y || f.x > uMax.x || f.y > uMax.y) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }\n"
                        + "  gl_FragColor = texture2D(uTex, f / uTam);\n"
                        + "}");
        aPos = Gl.atributo(prog, "aPos");
        uTex = Gl.uniforme(prog, "uTex");
        uCentro = Gl.uniforme(prog, "uCentro");
        uRadio = Gl.uniforme(prog, "uRadio");
        uK = Gl.uniforme(prog, "uK");
        uTam = Gl.uniforme(prog, "uTam");
        uMin = Gl.uniforme(prog, "uMin");
        uMax = Gl.uniforme(prog, "uMax");
    }

    /** Empieza a dibujar al búfer (en vez de a la pantalla). */
    void empezar(int w, int h) {
        if (fbo == 0 || w != ancho || h != alto) armar(w, h);
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fbo);
    }

    private void armar(int w, int h) {
        if (fbo != 0) {
            GLES20.glDeleteFramebuffers(1, new int[]{fbo}, 0);
            GLES20.glDeleteTextures(1, new int[]{color}, 0);
            GLES20.glDeleteRenderbuffers(1, new int[]{profundidad}, 0);
        }
        ancho = w; alto = h;
        int[] i = new int[1];
        GLES20.glGenTextures(1, i, 0);
        color = i[0];
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, color);
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, w, h, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glGenRenderbuffers(1, i, 0);
        profundidad = i[0];
        GLES20.glBindRenderbuffer(GLES20.GL_RENDERBUFFER, profundidad);
        GLES20.glRenderbufferStorage(GLES20.GL_RENDERBUFFER, GLES20.GL_DEPTH_COMPONENT16, w, h);
        GLES20.glGenFramebuffers(1, i, 0);
        fbo = i[0];
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fbo);
        GLES20.glFramebufferTexture2D(GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0, GLES20.GL_TEXTURE_2D, color, 0);
        GLES20.glFramebufferRenderbuffer(GLES20.GL_FRAMEBUFFER, GLES20.GL_DEPTH_ATTACHMENT, GLES20.GL_RENDERBUFFER, profundidad);
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0);
    }

    /**
     * Copia el búfer a la pantalla, deformado, ojo por ojo.
     * @param ojos {x0, y0, x1, y1, cx, cy} por ojo, en píxeles (la mitad de pantalla y el centro del lente)
     */
    void terminar(int w, int h, float[][] ojos, float k1, float k2) {
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0);
        GLES20.glViewport(0, 0, w, h);
        GLES20.glDisable(GLES20.GL_SCISSOR_TEST);
        GLES20.glClearColor(0, 0, 0, 1);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glUseProgram(prog);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, color);
        GLES20.glUniform1i(uTex, 0);
        GLES20.glUniform2f(uTam, w, h);
        GLES20.glUniform2f(uK, k1, k2);
        quad.position(0);
        GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 8, quad);
        GLES20.glEnableVertexAttribArray(aPos);
        GLES20.glEnable(GLES20.GL_SCISSOR_TEST);
        for (float[] o : ojos) {
            GLES20.glScissor((int) o[0], (int) o[1], (int) (o[2] - o[0]), (int) (o[3] - o[1]));
            GLES20.glUniform2f(uCentro, o[4], o[5]);
            // r = 1 en el borde más lejano de la mitad, a lo ancho
            GLES20.glUniform1f(uRadio, Math.max(o[4] - o[0], o[2] - o[4]));
            GLES20.glUniform2f(uMin, o[0], o[1]);
            GLES20.glUniform2f(uMax, o[2], o[3]);
            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        }
        GLES20.glDisable(GLES20.GL_SCISSOR_TEST);
        GLES20.glDisableVertexAttribArray(aPos);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }
}
