package android.opengl;

import java.util.ArrayList;
import java.util.HashMap;

/**
 * Sólo para la PC: un GLES20 de mentira que no dibuja nada, pero GRABA cada
 * caja que dibuja Figuras (su matriz y su color). Así pruebas/Vista.java corre
 * el código de verdad de los soldados y la pistola, y la página de vista
 * previa las dibuja con WebGL.
 */
public final class GLES20 {
    public static final int GL_BLEND = 0x0BE2, GL_COMPILE_STATUS = 0x8B81, GL_FLOAT = 0x1406, GL_FRAGMENT_SHADER = 0x8B30,
            GL_LINES = 1, GL_LINK_STATUS = 0x8B82, GL_ONE = 1, GL_ONE_MINUS_SRC_ALPHA = 0x0303, GL_POINTS = 0,
            GL_SRC_ALPHA = 0x0302, GL_TRIANGLES = 4, GL_VERTEX_SHADER = 0x8B31, GL_DEPTH_TEST = 0x0B71,
            GL_TRIANGLE_FAN = 6, GL_TRIANGLE_STRIP = 5, GL_EXTENSIONS = 0x1F03, GL_LEQUAL = 0x0203, GL_LESS = 0x0201, GL_UNSIGNED_SHORT = 0x1403, GL_CULL_FACE = 0x0B44, GL_POLYGON_OFFSET_FILL = 0x8037;

    /** Una caja grabada: mvp (16), modelo (16), color (4). */
    public static final ArrayList<float[]> cajas = new ArrayList<>();
    /** Un pedazo de disco grabado (los blancos): mvp (16), modelo (16), color (4), polygon offset (2), modo, primero, cantidad. */
    public static final ArrayList<float[]> discos = new ArrayList<>();
    private static float offF, offU;
    private static final HashMap<Integer, String> nombres = new HashMap<>();
    private static final HashMap<String, float[]> valores = new HashMap<>();
    private static int siguiente = 1;

    public static int glCreateShader(int t) { return siguiente++; }
    public static void glShaderSource(int s, String f) { }
    public static void glCompileShader(int s) { }
    public static void glGetShaderiv(int s, int p, int[] v, int o) { v[o] = 1; }
    public static String glGetShaderInfoLog(int s) { return ""; }
    public static void glDeleteShader(int s) { }
    public static int glCreateProgram() { return siguiente++; }
    public static void glAttachShader(int p, int s) { }
    public static void glLinkProgram(int p) { }
    public static void glGetProgramiv(int p, int q, int[] v, int o) { v[o] = 1; }
    public static String glGetProgramInfoLog(int p) { return ""; }
    public static void glDeleteProgram(int p) { }
    public static int glGetAttribLocation(int p, String n) { return siguiente++; }
    public static int glGetUniformLocation(int p, String n) { int id = siguiente++; nombres.put(id, n); return id; }
    public static void glUseProgram(int p) { }
    public static void glVertexAttribPointer(int i, int n, int t, boolean norm, int paso, java.nio.Buffer b) { }
    public static void glEnableVertexAttribArray(int i) { }
    public static void glDisableVertexAttribArray(int i) { }
    public static void glUniform1f(int u, float a) { valores.put(nombres.get(u), new float[]{a}); }
    public static void glUniform3f(int u, float a, float b, float c) { valores.put(nombres.get(u), new float[]{a, b, c}); }
    public static void glUniform4f(int u, float a, float b, float c, float d) { valores.put(nombres.get(u), new float[]{a, b, c, d}); }
    public static void glUniformMatrix4fv(int u, int n, boolean t, float[] v, int o) {
        float[] m = new float[16];
        System.arraycopy(v, o, m, 0, 16);
        valores.put(nombres.get(u), m);
    }
    public static void glEnable(int c) { }
    public static void glDisable(int c) { }
    public static void glBlendFunc(int a, int b) { }
    public static void glDepthMask(boolean b) { }
    public static void glLineWidth(float w) { }
    public static void glPolygonOffset(float f, float u) { offF = f; offU = u; }
    public static String glGetString(int n) { return ""; }
    public static void glColorMask(boolean r, boolean g, boolean b, boolean a) { }
    public static void glDepthFunc(int f) { }
    public static void glUniform2f(int u, float a, float b) { valores.put(nombres.get(u), new float[]{a, b}); }
    public static void glDrawElements(int modo, int n, int tipo, java.nio.Buffer b) { }

    public static void glDrawArrays(int modo, int primero, int n) {
        if (modo == GL_TRIANGLE_FAN || modo == GL_TRIANGLE_STRIP) {
            float[] c = new float[41];
            System.arraycopy(valores.get("uMvp"), 0, c, 0, 16);
            System.arraycopy(valores.get("uModelo"), 0, c, 16, 16);
            System.arraycopy(valores.get("uColor"), 0, c, 32, 4);
            c[36] = offF; c[37] = offU; c[38] = modo; c[39] = primero; c[40] = n;
            discos.add(c);
            return;
        }
        if (modo != GL_TRIANGLES || n != 36) return;
        float[] c = new float[36];
        System.arraycopy(valores.get("uMvp"), 0, c, 0, 16);
        System.arraycopy(valores.get("uModelo"), 0, c, 16, 16);
        System.arraycopy(valores.get("uColor"), 0, c, 32, 4);
        cajas.add(c);
    }
}
