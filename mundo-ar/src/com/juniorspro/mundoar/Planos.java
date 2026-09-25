package com.juniorspro.mundoar;

import android.opengl.GLES20;
import android.opengl.Matrix;

import com.google.ar.core.Plane;
import com.google.ar.core.TrackingState;

import java.nio.FloatBuffer;
import java.util.Collection;

/**
 * Los planos que va encontrando ARCore, dibujados como una grilla celeste
 * translúcida. Sirve para VER que el 6DoF anda: si la grilla se queda pegada
 * al piso mientras caminás, el seguimiento está bien.
 */
final class Planos {
    private FloatBuffer puntos = Gl.bufer(2 * 64);
    private int programa, aXZ, uMvp, uAlfa;
    private final float[] modelo = new float[16], mvp = new float[16];

    void crear() {
        programa = Gl.programa(
                "uniform mat4 uMvp; attribute vec2 aXZ; varying vec2 vXZ;\n"
                        + "void main() { vXZ = aXZ; gl_Position = uMvp * vec4(aXZ.x, 0.0, aXZ.y, 1.0); }",
                "precision mediump float; varying vec2 vXZ; uniform float uAlfa;\n"
                        + "void main() {\n"
                        + "  vec2 g = abs(fract(vXZ * 5.0) - 0.5);\n"
                        + "  float linea = 1.0 - smoothstep(0.0, 0.06, min(g.x, g.y));\n"
                        + "  gl_FragColor = vec4(0.35, 0.85, 1.0, (0.10 + 0.55 * linea) * uAlfa);\n"
                        + "}");
        aXZ = GLES20.glGetAttribLocation(programa, "aXZ");
        uMvp = GLES20.glGetUniformLocation(programa, "uMvp");
        uAlfa = GLES20.glGetUniformLocation(programa, "uAlfa");
    }

    /** Devuelve cuántos planos dibujó. */
    int dibujar(Collection<Plane> planos, float[] vistaProy, float alfa) {
        int n = 0;
        GLES20.glUseProgram(programa);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glDepthMask(false);
        GLES20.glEnableVertexAttribArray(aXZ);
        for (Plane p : planos) {
            if (p.getTrackingState() != TrackingState.TRACKING || p.getSubsumedBy() != null) continue;
            FloatBuffer poli = p.getPolygon();
            int cant = poli.limit() / 2;
            if (cant < 3) continue;
            // Abanico: el centro del plano y después el borde, cerrando la vuelta.
            int floats = 2 * (cant + 2);
            if (puntos.capacity() < floats) puntos = Gl.bufer(floats * 2);
            puntos.clear();
            puntos.put(0f).put(0f);
            poli.rewind();
            for (int i = 0; i < cant; i++) puntos.put(poli.get()).put(poli.get());
            puntos.put(poli.get(0)).put(poli.get(1));
            puntos.flip();
            p.getCenterPose().toMatrix(modelo, 0);
            Matrix.multiplyMM(mvp, 0, vistaProy, 0, modelo, 0);
            GLES20.glUniformMatrix4fv(uMvp, 1, false, mvp, 0);
            GLES20.glUniform1f(uAlfa, alfa);
            GLES20.glVertexAttribPointer(aXZ, 2, GLES20.GL_FLOAT, false, 0, puntos);
            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_FAN, 0, cant + 2);
            n++;
        }
        GLES20.glDisableVertexAttribArray(aXZ);
        GLES20.glDepthMask(true);
        GLES20.glDisable(GLES20.GL_BLEND);
        return n;
    }
}
