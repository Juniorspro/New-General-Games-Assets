package com.juniorspro.mundoar;

import android.opengl.GLES11Ext;
import android.opengl.GLES20;

import com.google.ar.core.Coordinates2d;
import com.google.ar.core.Frame;

import java.nio.FloatBuffer;

/**
 * La imagen de la cámara de fondo. ARCore escribe cada cuadro en una textura
 * "externa" (OES) y dice cómo recortarla y rotarla para la pantalla:
 * transformCoordinates2d hace esa cuenta cada vez que cambia la geometría
 * (girar el teléfono de un lado al otro, por ejemplo).
 */
final class Fondo {
    private static final float[] CUADRO = {-1f, -1f, +1f, -1f, -1f, +1f, +1f, +1f};

    private final FloatBuffer vertices = Gl.bufer(CUADRO);
    private final FloatBuffer coordTex = Gl.bufer(8);
    private int textura;
    private int programa, aPos, aTex, uTex;

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
        aPos = GLES20.glGetAttribLocation(programa, "aPos");
        aTex = GLES20.glGetAttribLocation(programa, "aTex");
        uTex = GLES20.glGetUniformLocation(programa, "uTex");
    }

    void dibujar(Frame cuadro) {
        if (cuadro.hasDisplayGeometryChanged()) {
            vertices.position(0);
            coordTex.position(0);
            cuadro.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES, vertices,
                    Coordinates2d.TEXTURE_NORMALIZED, coordTex);
        }
        // Los primeros cuadros pueden llegar sin imagen todavía.
        if (cuadro.getTimestamp() == 0) return;
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
}
