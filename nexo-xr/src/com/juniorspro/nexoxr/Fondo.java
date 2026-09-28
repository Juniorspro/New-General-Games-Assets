package com.juniorspro.nexoxr;

import android.opengl.GLES11Ext;
import android.opengl.GLES20;

import com.google.ar.core.Coordinates2d;
import com.google.ar.core.Frame;

import java.nio.FloatBuffer;

/**
 * La imagen de la cámara de fondo. ARCore la escribe en una textura externa
 * (OES) y dice cómo recortarla y rotarla para la vista (transformCoordinates2d).
 *
 * También guarda esa correspondencia pantalla → textura como una afinidad
 * (origen + dos ejes): la usa la malla "reproyectada" para pintarse con la
 * imagen de la cámara vista desde cada ojo.
 */
final class Fondo {
    private static final float[] CUADRO = {-1f, -1f, +1f, -1f, -1f, +1f, +1f, +1f};

    private final FloatBuffer vertices = Gl.bufer(CUADRO);
    private final FloatBuffer coordTex = Gl.bufer(8);
    /** tex = t0 + (ndc.x+1)/2 · ejeX + (ndc.y+1)/2 · ejeY */
    final float[] t0 = new float[2], ejeX = new float[2], ejeY = new float[2];
    private int textura;
    private int programa, aPos, aTex, uTex;
    private int progMundo, mPos, mTex, mVp, mTexU, mAlfa;
    private final FloatBuffer esquinas = Gl.bufer(12);
    boolean hayImagen;

    int textura() { return textura; }

    void crear() {
        int[] t = new int[1];
        GLES20.glGenTextures(1, t, 0);
        textura = t[0];
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textura);
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        programa = Gl.programa(
                "attribute vec4 aPos; attribute vec2 aTex; varying vec2 vTex;\n"
                        + "void main() { gl_Position = aPos; vTex = aTex; }",
                "#extension GL_OES_EGL_image_external : require\n"
                        + "precision mediump float; uniform samplerExternalOES uTex; varying vec2 vTex;\n"
                        + "void main() { gl_FragColor = texture2D(uTex, vTex); }");
        progMundo = Gl.programa(
                "uniform mat4 uVp; attribute vec3 aPos; attribute vec2 aTex; varying vec2 vTex;\n"
                        + "void main() { gl_Position = uVp * vec4(aPos, 1.0); vTex = aTex; }",
                "#extension GL_OES_EGL_image_external : require\n"
                        + "precision mediump float; uniform samplerExternalOES uTex; uniform float uAlfa; varying vec2 vTex;\n"
                        + "void main() { gl_FragColor = vec4(texture2D(uTex, vTex).rgb * uAlfa, 1.0); }");
        mPos = Gl.atributo(progMundo, "aPos");
        mTex = Gl.atributo(progMundo, "aTex");
        mVp = Gl.uniforme(progMundo, "uVp");
        mTexU = Gl.uniforme(progMundo, "uTex");
        mAlfa = Gl.uniforme(progMundo, "uAlfa");
        aPos = Gl.atributo(programa, "aPos");
        aTex = Gl.atributo(programa, "aTex");
        uTex = Gl.uniforme(programa, "uTex");
    }

    /** Llamar en cada cuadro (antes de dibujar): recalcula si cambió la geometría. */
    void actualizar(Frame cuadro) {
        if (cuadro.hasDisplayGeometryChanged() || !hayImagen) {
            vertices.position(0);
            coordTex.position(0);
            cuadro.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES, vertices,
                    Coordinates2d.TEXTURE_NORMALIZED, coordTex);
            // vértices: (−1,−1) (1,−1) (−1,1) (1,1) → la afinidad sale de los tres primeros
            t0[0] = coordTex.get(0); t0[1] = coordTex.get(1);
            ejeX[0] = coordTex.get(2) - t0[0]; ejeX[1] = coordTex.get(3) - t0[1];
            ejeY[0] = coordTex.get(4) - t0[0]; ejeY[1] = coordTex.get(5) - t0[1];
        }
        hayImagen = cuadro.getTimestamp() != 0;   // los primeros cuadros llegan sin imagen
    }

    void dibujar() {
        if (!hayImagen) return;
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDepthMask(false);
        GLES20.glUseProgram(programa);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textura);
        GLES20.glUniform1i(uTex, 0);
        vertices.position(0);
        coordTex.position(0);
        GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 0, vertices);
        GLES20.glVertexAttribPointer(aTex, 2, GLES20.GL_FLOAT, false, 0, coordTex);
        GLES20.glEnableVertexAttribArray(aPos);
        GLES20.glEnableVertexAttribArray(aTex);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(aPos);
        GLES20.glDisableVertexAttribArray(aTex);
        GLES20.glDepthMask(true);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }

    /**
     * La imagen de la cámara EN EL MUNDO: un rectángulo a D metros delante de
     * la cámara, del tamaño exacto de lo que ve (sale de su proyección). Así,
     * en el visor, cada ojo la ve con su propia proyección y en su escala
     * justa (a 8 m, sin paralaje que se note).
     * @param poseCam la cámara → mundo (4×4 por columnas); proyCam su proyección.
     */
    void dibujarEnMundo(float[] vp, float[] poseCam, float[] proyCam, float d, float alfa) {
        if (!hayImagen) return;
        float[] ndc = {-1, -1, 1, -1, -1, 1, 1, 1};
        esquinas.position(0);
        for (int k = 0; k < 4; k++) {
            // en la cámara: x = (ndc + p8)·d / p0, y = (ndc + p9)·d / p5, z = −d
            float x = (ndc[k * 2] + proyCam[8]) * d / proyCam[0], y = (ndc[k * 2 + 1] + proyCam[9]) * d / proyCam[5], z = -d;
            for (int i = 0; i < 3; i++) esquinas.put(poseCam[i] * x + poseCam[4 + i] * y + poseCam[8 + i] * z + poseCam[12 + i]);
        }
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDepthMask(false);
        GLES20.glUseProgram(progMundo);
        GLES20.glUniformMatrix4fv(mVp, 1, false, vp, 0);
        GLES20.glUniform1f(mAlfa, alfa);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textura);
        GLES20.glUniform1i(mTexU, 0);
        esquinas.position(0);
        coordTex.position(0);
        GLES20.glVertexAttribPointer(mPos, 3, GLES20.GL_FLOAT, false, 0, esquinas);
        GLES20.glVertexAttribPointer(mTex, 2, GLES20.GL_FLOAT, false, 0, coordTex);
        GLES20.glEnableVertexAttribArray(mPos);
        GLES20.glEnableVertexAttribArray(mTex);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(mPos);
        GLES20.glDisableVertexAttribArray(mTex);
        GLES20.glDepthMask(true);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }
}
