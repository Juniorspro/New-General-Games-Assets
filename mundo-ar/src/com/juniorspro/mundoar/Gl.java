package com.juniorspro.mundoar;

import android.opengl.GLES20;
import android.util.Log;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;

/** Utilidades de OpenGL ES 2.0: compilar programas y armar búferes. */
final class Gl {
    private Gl() {}

    static int programa(String vs, String fs) {
        int v = compilar(GLES20.GL_VERTEX_SHADER, vs);
        int f = compilar(GLES20.GL_FRAGMENT_SHADER, fs);
        int p = GLES20.glCreateProgram();
        GLES20.glAttachShader(p, v);
        GLES20.glAttachShader(p, f);
        GLES20.glLinkProgram(p);
        int[] ok = new int[1];
        GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0);
        if (ok[0] == 0) {
            String log = GLES20.glGetProgramInfoLog(p);
            GLES20.glDeleteProgram(p);
            throw new RuntimeException("no enlaza el programa: " + log);
        }
        return p;
    }

    private static int compilar(int tipo, String fuente) {
        int s = GLES20.glCreateShader(tipo);
        GLES20.glShaderSource(s, fuente);
        GLES20.glCompileShader(s);
        int[] ok = new int[1];
        GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0);
        if (ok[0] == 0) {
            String log = GLES20.glGetShaderInfoLog(s);
            Log.e("MundoAR", "shader: " + log);
            GLES20.glDeleteShader(s);
            throw new RuntimeException("no compila el shader: " + log);
        }
        return s;
    }

    static FloatBuffer bufer(float[] datos) {
        FloatBuffer b = ByteBuffer.allocateDirect(datos.length * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
        b.put(datos).position(0);
        return b;
    }

    static FloatBuffer bufer(int floats) {
        return ByteBuffer.allocateDirect(floats * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
    }
}
