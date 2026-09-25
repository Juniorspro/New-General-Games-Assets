package com.juniorspro.mundoar;

import android.opengl.GLES20;
import android.opengl.Matrix;

import java.nio.FloatBuffer;

/**
 * Un cubo de 1 m de lado (se escala a lo que haga falta) con "luz horneada":
 * la sombra de cada cara sale de una dirección de luz FIJA en el shader. Sin
 * luces dinámicas ni sombras en tiempo real: en un teléfono de gama baja eso
 * es lo que más cuesta, y el cubo se lee igual de volumétrico.
 */
final class Cubo {
    private final FloatBuffer datos;
    private int programa, aPos, aNormal, uMvp, uModelo, uColor, uBrillo, uAlfa;
    private final float[] mvp = new float[16];

    Cubo() {
        float[][] caras = {
                {0, 0, 1}, {0, 0, -1}, {1, 0, 0}, {-1, 0, 0}, {0, 1, 0}, {0, -1, 0},
        };
        float[] v = new float[36 * 6];
        int k = 0;
        for (float[] n : caras) {
            // Dos ejes del plano de la cara.
            float[] u = Math.abs(n[1]) > 0.5f ? new float[]{1, 0, 0} : new float[]{0, 1, 0};
            float[] w = {n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]};
            float[][] esq = new float[4][3];
            float[][] s = {{-1, -1}, {1, -1}, {1, 1}, {-1, 1}};
            for (int i = 0; i < 4; i++) for (int c = 0; c < 3; c++)
                esq[i][c] = 0.5f * (n[c] + s[i][0] * u[c] + s[i][1] * w[c]);
            int[] orden = {0, 1, 2, 0, 2, 3};
            for (int i : orden) {
                v[k++] = esq[i][0]; v[k++] = esq[i][1]; v[k++] = esq[i][2];
                v[k++] = n[0]; v[k++] = n[1]; v[k++] = n[2];
            }
        }
        datos = Gl.bufer(v);
    }

    void crear() {
        programa = Gl.programa(
                "uniform mat4 uMvp; uniform mat4 uModelo; uniform vec3 uColor; uniform float uBrillo;\n"
                        + "attribute vec3 aPos; attribute vec3 aNormal; varying vec3 vColor;\n"
                        + "void main() {\n"
                        + "  vec3 n = normalize((uModelo * vec4(aNormal, 0.0)).xyz);\n"
                        + "  float luz = 0.42 + 0.58 * max(dot(n, normalize(vec3(0.35, 0.9, 0.25))), 0.0);\n"
                        + "  vColor = uColor * luz + vec3(uBrillo);\n"
                        + "  gl_Position = uMvp * vec4(aPos, 1.0);\n"
                        + "}",
                "precision mediump float; varying vec3 vColor; uniform float uAlfa;\n"
                        + "void main() { gl_FragColor = vec4(vColor, uAlfa); }");
        aPos = GLES20.glGetAttribLocation(programa, "aPos");
        aNormal = GLES20.glGetAttribLocation(programa, "aNormal");
        uMvp = GLES20.glGetUniformLocation(programa, "uMvp");
        uModelo = GLES20.glGetUniformLocation(programa, "uModelo");
        uColor = GLES20.glGetUniformLocation(programa, "uColor");
        uBrillo = GLES20.glGetUniformLocation(programa, "uBrillo");
        uAlfa = GLES20.glGetUniformLocation(programa, "uAlfa");
    }

    void empezar() {
        GLES20.glUseProgram(programa);
        datos.position(0);
        GLES20.glVertexAttribPointer(aPos, 3, GLES20.GL_FLOAT, false, 24, datos);
        datos.position(3);
        GLES20.glVertexAttribPointer(aNormal, 3, GLES20.GL_FLOAT, false, 24, datos);
        GLES20.glEnableVertexAttribArray(aPos);
        GLES20.glEnableVertexAttribArray(aNormal);
    }

    void dibujar(float[] vistaProy, float[] modelo, float r, float g, float b, float brillo, float alfa) {
        Matrix.multiplyMM(mvp, 0, vistaProy, 0, modelo, 0);
        GLES20.glUniformMatrix4fv(uMvp, 1, false, mvp, 0);
        GLES20.glUniformMatrix4fv(uModelo, 1, false, modelo, 0);
        GLES20.glUniform3f(uColor, r, g, b);
        GLES20.glUniform1f(uBrillo, brillo);
        GLES20.glUniform1f(uAlfa, alfa);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, 36);
    }

    void terminar() {
        GLES20.glDisableVertexAttribArray(aPos);
        GLES20.glDisableVertexAttribArray(aNormal);
    }
}
