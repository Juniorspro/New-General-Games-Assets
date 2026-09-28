package com.juniorspro.nexoxr;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.opengl.GLES20;
import android.opengl.GLUtils;

/**
 * Una ETIQUETA en el espacio (una píldora con un ícono de punto y el texto):
 * se dibuja una vez en un Bitmap y se sube como textura. Para "Tu mesa",
 * apoyada sobre la mesa.
 */
final class Etiqueta {
    /** El ancho y el alto de la textura (el alto en metros sale de su proporción). */
    static final int W = 512, H = 128;

    private Etiqueta() {}

    /** En el hilo de dibujo: la textura (0 si no se pudo). */
    static int crear(String texto, String sub, int color) {
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas k = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        RectF r = new RectF(6, 10, W - 6, H - 10);
        p.setShader(new LinearGradient(0, 0, W, 0, 0xE6141824, 0xE61D2436, Shader.TileMode.CLAMP));
        k.drawRoundRect(r, (H - 20) / 2f, (H - 20) / 2f, p);
        p.setShader(null);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(4);
        p.setColor(color);
        k.drawRoundRect(r, (H - 20) / 2f, (H - 20) / 2f, p);
        p.setStyle(Paint.Style.FILL);
        k.drawCircle(64, H / 2f, 18, p);
        p.setColor(0x55FFFFFF);
        k.drawCircle(64, H / 2f, 30, p);
        p.setColor(0xFFF1F3F8);
        p.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        p.setTextSize(sub == null ? 50 : 44);
        k.drawText(texto, 112, sub == null ? H / 2f + 17 : H / 2f + 2, p);
        if (sub != null) {
            p.setTypeface(Typeface.DEFAULT);
            p.setTextSize(26);
            p.setColor(0xFFA6ACBD);
            k.drawText(sub, 114, H / 2f + 36, p);
        }
        int[] t = new int[1];
        GLES20.glGenTextures(1, t, 0);
        if (t[0] == 0) { b.recycle(); return 0; }
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, t[0]);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, b, 0);
        b.recycle();
        return t[0];
    }

    static void borrar(int tex) {
        if (tex != 0) GLES20.glDeleteTextures(1, new int[]{tex}, 0);
    }
}
