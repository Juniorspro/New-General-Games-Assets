package android.opengl;

/**
 * Sólo para la PC: las mismas cuentas que android.opengl.Matrix (por columnas,
 * y las transformaciones se multiplican a la derecha), para correr Figuras.java
 * tal cual fuera del teléfono.
 */
public final class Matrix {
    public static void setIdentityM(float[] m, int o) {
        for (int i = 0; i < 16; i++) m[o + i] = (i % 5 == 0) ? 1 : 0;
    }

    public static void multiplyMM(float[] r, int ro, float[] a, int ao, float[] b, int bo) {
        float[] t = new float[16];
        for (int c = 0; c < 4; c++) for (int f = 0; f < 4; f++) {
            float s = 0;
            for (int k = 0; k < 4; k++) s += a[ao + k * 4 + f] * b[bo + c * 4 + k];
            t[c * 4 + f] = s;
        }
        System.arraycopy(t, 0, r, ro, 16);
    }

    public static void translateM(float[] m, int o, float x, float y, float z) {
        for (int i = 0; i < 4; i++) m[o + 12 + i] += m[o + i] * x + m[o + 4 + i] * y + m[o + 8 + i] * z;
    }

    public static void scaleM(float[] m, int o, float x, float y, float z) {
        for (int i = 0; i < 4; i++) { m[o + i] *= x; m[o + 4 + i] *= y; m[o + 8 + i] *= z; }
    }

    public static void setRotateM(float[] r, int o, float a, float x, float y, float z) {
        setIdentityM(r, o);
        double rad = Math.toRadians(a);
        float s = (float) Math.sin(rad), c = (float) Math.cos(rad);
        float l = (float) Math.sqrt(x * x + y * y + z * z);
        x /= l; y /= l; z /= l;
        float nc = 1 - c;
        r[o] = x * x * nc + c;     r[o + 4] = x * y * nc - z * s; r[o + 8] = z * x * nc + y * s;
        r[o + 1] = x * y * nc + z * s; r[o + 5] = y * y * nc + c; r[o + 9] = y * z * nc - x * s;
        r[o + 2] = z * x * nc - y * s; r[o + 6] = y * z * nc + x * s; r[o + 10] = z * z * nc + c;
    }

    public static void rotateM(float[] m, int o, float a, float x, float y, float z) {
        float[] r = new float[16];
        setRotateM(r, 0, a, x, y, z);
        multiplyMM(m, o, m.clone(), o, r, 0);
    }
    public static boolean invertM(float[] r, int ro, float[] m, int mo) { return true; }
}
