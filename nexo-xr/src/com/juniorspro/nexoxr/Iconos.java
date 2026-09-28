package com.juniorspro.nexoxr;

import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;

/**
 * Los íconos del sistema, dibujados con trazos (sin imágenes): se ven nítidos
 * a cualquier tamaño. Grilla de 24×24, trazo redondeado.
 */
final class Iconos extends Drawable {
    static final int APPS = 0, WEB = 1, GALERIA = 2, AJUSTES = 3, RAPIDOS = 4, WIFI = 5, ATRAS = 6, ADELANTE = 7, RECARGAR = 8,
            CASA = 9, TECLADO = 10, CERRAR = 11, PLAY = 12, PAUSA = 13, CAPTURA = 14, RECENTRAR = 15, OJO = 16, MONTANA = 17,
            VISOR = 18, MANO = 19, SONIDO = 20, INFO = 21, BUSCAR = 22, ESTRELLA = 23, BORRAR = 24, ENTER = 25, MAYUS = 26,
            CINE = 27, CONTROL = 28, TELEFONO = 29, BATERIA = 30, BRILLO = 31, VIDEO = 32, LINTERNA = 33, ACTUALIZAR = 34,
            MESA = 35, CUARTO = 36, GIRAR = 37, LISTO = 38, MUSICA = 39, NOTAS = 40, CALCULADORA = 41, RELOJ = 42, CLIMA = 43,
            ARCHIVOS = 44, PESTANAS = 45, MAS = 46, ESCRITORIO = 47, SIGUIENTE = 48, ANTERIOR = 49, MEZCLAR = 50, CRONOMETRO = 51,
            CARPETA = 52, DOCUMENTO = 53, NUBE = 54, LLUVIA = 55, TORMENTA = 56, NIEVE = 57, NIEBLA = 58, LUNA = 59, SOL = 60, ESPACIO = 61;

    private final int tipo;
    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path c = new Path();
    private final RectF r = new RectF();
    /** Para la batería: 0..1. */
    float nivel = 1;

    Iconos(int tipo, int color) {
        this.tipo = tipo;
        p.setColor(color);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setStrokeJoin(Paint.Join.ROUND);
    }

    void color(int c) { p.setColor(c); invalidateSelf(); }

    @Override
    public void draw(Canvas k) {
        float w = getBounds().width(), h = getBounds().height(), s = Math.min(w, h) / 24f;
        k.save();
        k.translate(getBounds().left + (w - 24 * s) / 2, getBounds().top + (h - 24 * s) / 2);
        k.scale(s, s);
        p.setStrokeWidth(1.9f);
        p.setStyle(Paint.Style.STROKE);
        c.reset();
        switch (tipo) {
            case APPS:
                p.setStyle(Paint.Style.FILL);
                for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) k.drawCircle(5 + i * 7, 5 + j * 7, 2.1f, p);
                break;
            case WEB:
                k.drawCircle(12, 12, 9, p);
                r.set(7.5f, 3, 16.5f, 21); k.drawOval(r, p);
                k.drawLine(3, 12, 21, 12, p);
                c.moveTo(4.5f, 7.5f); c.quadTo(12, 9.5f, 19.5f, 7.5f); c.moveTo(4.5f, 16.5f); c.quadTo(12, 14.5f, 19.5f, 16.5f); k.drawPath(c, p);
                break;
            case GALERIA:
                r.set(3, 5, 21, 19); k.drawRoundRect(r, 2.5f, 2.5f, p);
                c.moveTo(4, 17); c.lineTo(9.5f, 11); c.lineTo(13.5f, 15); c.lineTo(16, 12.5f); c.lineTo(20, 16.5f); k.drawPath(c, p);
                p.setStyle(Paint.Style.FILL); k.drawCircle(16, 9, 1.6f, p);
                break;
            case AJUSTES:
                for (int i = 0; i < 8; i++) {
                    double a = i * Math.PI / 4;
                    k.drawLine(12 + (float) Math.cos(a) * 6.5f, 12 + (float) Math.sin(a) * 6.5f, 12 + (float) Math.cos(a) * 9f, 12 + (float) Math.sin(a) * 9f, p);
                }
                k.drawCircle(12, 12, 6.3f, p);
                k.drawCircle(12, 12, 2.6f, p);
                break;
            case RAPIDOS:
                k.drawLine(4, 7, 20, 7, p); k.drawLine(4, 17, 20, 17, p);
                p.setStyle(Paint.Style.FILL); p.setColor(p.getColor());
                k.drawCircle(15, 7, 2.6f, p); k.drawCircle(9, 17, 2.6f, p);
                break;
            case WIFI:
                r.set(2, 5, 22, 25); k.drawArc(r, 225, 90, false, p);
                r.set(5.5f, 8.5f, 18.5f, 21.5f); k.drawArc(r, 225, 90, false, p);
                r.set(9, 12, 15, 18); k.drawArc(r, 225, 90, false, p);
                p.setStyle(Paint.Style.FILL); k.drawCircle(12, 19, 1.4f, p);
                break;
            case ATRAS: c.moveTo(15, 5); c.lineTo(8, 12); c.lineTo(15, 19); k.drawPath(c, p); break;
            case ADELANTE: c.moveTo(9, 5); c.lineTo(16, 12); c.lineTo(9, 19); k.drawPath(c, p); break;
            case RECARGAR:
                r.set(5, 5, 19, 19); k.drawArc(r, -60, 300, false, p);
                c.moveTo(19, 4); c.lineTo(19, 9); c.lineTo(14, 9); k.drawPath(c, p);
                break;
            case CASA:
                c.moveTo(4, 11); c.lineTo(12, 4); c.lineTo(20, 11); c.moveTo(6.5f, 9.5f); c.lineTo(6.5f, 20); c.lineTo(17.5f, 20); c.lineTo(17.5f, 9.5f);
                c.moveTo(10, 20); c.lineTo(10, 14.5f); c.lineTo(14, 14.5f); c.lineTo(14, 20); k.drawPath(c, p);
                break;
            case TECLADO:
                r.set(2.5f, 6, 21.5f, 18); k.drawRoundRect(r, 2, 2, p);
                p.setStyle(Paint.Style.FILL);
                for (int i = 0; i < 5; i++) k.drawCircle(6 + i * 3, 10, 0.9f, p);
                p.setStyle(Paint.Style.STROKE); k.drawLine(8, 14.5f, 16, 14.5f, p);
                break;
            case CERRAR: k.drawLine(6, 6, 18, 18, p); k.drawLine(18, 6, 6, 18, p); break;
            case PLAY: p.setStyle(Paint.Style.FILL); c.moveTo(8, 5); c.lineTo(19, 12); c.lineTo(8, 19); c.close(); k.drawPath(c, p); break;
            case PAUSA: p.setStyle(Paint.Style.FILL); r.set(6.5f, 5, 10, 19); k.drawRoundRect(r, 1, 1, p); r.set(14, 5, 17.5f, 19); k.drawRoundRect(r, 1, 1, p); break;
            case CAPTURA:
                r.set(3, 7, 21, 19); k.drawRoundRect(r, 2.5f, 2.5f, p);
                c.moveTo(8, 7); c.lineTo(9.5f, 4.5f); c.lineTo(14.5f, 4.5f); c.lineTo(16, 7); k.drawPath(c, p);
                k.drawCircle(12, 13, 3.4f, p);
                break;
            case RECENTRAR:
                k.drawCircle(12, 12, 7, p);
                k.drawLine(12, 2, 12, 6, p); k.drawLine(12, 18, 12, 22, p); k.drawLine(2, 12, 6, 12, p); k.drawLine(18, 12, 22, 12, p);
                p.setStyle(Paint.Style.FILL); k.drawCircle(12, 12, 2.2f, p);
                break;
            case OJO:
                c.moveTo(2.5f, 12); c.quadTo(12, 3, 21.5f, 12); c.quadTo(12, 21, 2.5f, 12); k.drawPath(c, p);
                k.drawCircle(12, 12, 3.3f, p);
                break;
            case MONTANA:
                c.moveTo(2, 19); c.lineTo(9, 8); c.lineTo(13, 14); c.lineTo(15.5f, 10.5f); c.lineTo(22, 19); c.close(); k.drawPath(c, p);
                k.drawCircle(17.5f, 5.5f, 1.8f, p);
                break;
            case VISOR:
                r.set(2.5f, 7, 21.5f, 17.5f); k.drawRoundRect(r, 4, 4, p);
                k.drawCircle(8, 12.2f, 2.3f, p); k.drawCircle(16, 12.2f, 2.3f, p);
                break;
            case MANO:
                c.moveTo(8, 12); c.lineTo(8, 5.5f); c.moveTo(11, 11); c.lineTo(11, 3.5f); c.moveTo(14, 11); c.lineTo(14, 4.5f); c.moveTo(17, 12); c.lineTo(17, 7);
                c.moveTo(8, 12); c.lineTo(5.5f, 10); c.moveTo(17, 12); c.quadTo(17.5f, 21, 11.5f, 21); c.quadTo(7, 21, 5.5f, 15); c.lineTo(5.5f, 10);
                k.drawPath(c, p);
                break;
            case SONIDO:
                c.moveTo(4, 9.5f); c.lineTo(7.5f, 9.5f); c.lineTo(12, 5.5f); c.lineTo(12, 18.5f); c.lineTo(7.5f, 14.5f); c.lineTo(4, 14.5f); c.close(); k.drawPath(c, p);
                r.set(11, 8, 17, 16); k.drawArc(r, -60, 120, false, p);
                r.set(11, 5, 20, 19); k.drawArc(r, -60, 120, false, p);
                break;
            case INFO:
                k.drawCircle(12, 12, 9, p); k.drawLine(12, 11, 12, 17, p);
                p.setStyle(Paint.Style.FILL); k.drawCircle(12, 7.6f, 1.2f, p);
                break;
            case BUSCAR: k.drawCircle(10.5f, 10.5f, 6, p); k.drawLine(15, 15, 20.5f, 20.5f, p); break;
            case ESTRELLA:
                for (int i = 0; i < 10; i++) {
                    double a = -Math.PI / 2 + i * Math.PI / 5;
                    float rr = i % 2 == 0 ? 9 : 4;
                    float x = 12 + (float) Math.cos(a) * rr, y = 12.5f + (float) Math.sin(a) * rr;
                    if (i == 0) c.moveTo(x, y); else c.lineTo(x, y);
                }
                c.close(); k.drawPath(c, p);
                break;
            case BORRAR:
                c.moveTo(8, 5); c.lineTo(21, 5); c.lineTo(21, 19); c.lineTo(8, 19); c.lineTo(2.5f, 12); c.close(); k.drawPath(c, p);
                k.drawLine(11.5f, 9, 17, 15, p); k.drawLine(17, 9, 11.5f, 15, p);
                break;
            case ENTER: c.moveTo(19, 5); c.lineTo(19, 14); c.lineTo(5, 14); c.moveTo(9, 10); c.lineTo(5, 14); c.lineTo(9, 18); k.drawPath(c, p); break;
            case MAYUS: c.moveTo(12, 4); c.lineTo(20, 12); c.lineTo(15.5f, 12); c.lineTo(15.5f, 19); c.lineTo(8.5f, 19); c.lineTo(8.5f, 12); c.lineTo(4, 12); c.close(); k.drawPath(c, p); break;
            case CINE:
                r.set(2.5f, 5, 21.5f, 16); k.drawRoundRect(r, 1.5f, 1.5f, p);
                k.drawLine(8, 20, 16, 20, p); k.drawLine(12, 16, 12, 20, p);
                break;
            case CONTROL:
                r.set(2.5f, 7, 21.5f, 18); k.drawRoundRect(r, 5.5f, 5.5f, p);
                k.drawLine(6.5f, 12.5f, 10.5f, 12.5f, p); k.drawLine(8.5f, 10.5f, 8.5f, 14.5f, p);
                p.setStyle(Paint.Style.FILL); k.drawCircle(15.5f, 11.3f, 1.3f, p); k.drawCircle(17.8f, 13.8f, 1.3f, p);
                break;
            case TELEFONO:
                r.set(7, 2.5f, 17, 21.5f); k.drawRoundRect(r, 2.5f, 2.5f, p);
                k.drawLine(10.5f, 18.5f, 13.5f, 18.5f, p);
                break;
            case BATERIA: {
                r.set(2.5f, 7, 19.5f, 17); k.drawRoundRect(r, 2.5f, 2.5f, p);
                k.drawLine(21.5f, 10.5f, 21.5f, 13.5f, p);
                p.setStyle(Paint.Style.FILL);
                r.set(4.6f, 9.1f, 4.6f + 12.8f * Math.max(0.06f, Math.min(1, nivel)), 14.9f);
                k.drawRoundRect(r, 1, 1, p);
                break;
            }
            case BRILLO:
                k.drawCircle(12, 12, 4, p);
                for (int i = 0; i < 8; i++) {
                    double a = i * Math.PI / 4;
                    k.drawLine(12 + (float) Math.cos(a) * 7, 12 + (float) Math.sin(a) * 7, 12 + (float) Math.cos(a) * 9.5f, 12 + (float) Math.sin(a) * 9.5f, p);
                }
                break;
            case LINTERNA:
                // el cabezal, el cuerpo y el botón, con la luz saliendo
                c.moveTo(7, 3); c.lineTo(17, 3); c.lineTo(17, 6); c.lineTo(14.5f, 10); c.lineTo(14.5f, 21); c.lineTo(9.5f, 21); c.lineTo(9.5f, 10); c.lineTo(7, 6); c.close();
                k.drawPath(c, p);
                k.drawLine(7, 6, 17, 6, p);
                p.setStyle(Paint.Style.FILL); k.drawCircle(12, 14, 1.2f, p);
                break;
            case ACTUALIZAR:
                // la flecha que baja a la bandeja
                k.drawLine(12, 3, 12, 15, p);
                c.moveTo(7, 10); c.lineTo(12, 15); c.lineTo(17, 10); k.drawPath(c, p);
                c.reset(); c.moveTo(4, 15); c.lineTo(4, 20); c.lineTo(20, 20); c.lineTo(20, 15); k.drawPath(c, p);
                break;
            case MESA:
                // la tabla en perspectiva y las patas, con la marca que brilla
                c.moveTo(3, 10); c.lineTo(21, 10); c.lineTo(18, 6.5f); c.lineTo(6, 6.5f); c.close(); k.drawPath(c, p);
                k.drawLine(5, 10, 5, 19, p); k.drawLine(19, 10, 19, 19, p); k.drawLine(8, 10, 8, 15.5f, p); k.drawLine(16, 10, 16, 15.5f, p);
                break;
            case CUARTO:
                // un cubo abierto: el piso y dos paredes
                c.moveTo(12, 3.5f); c.lineTo(20.5f, 7.5f); c.lineTo(20.5f, 16.5f); c.lineTo(12, 20.5f); c.lineTo(3.5f, 16.5f); c.lineTo(3.5f, 7.5f); c.close(); k.drawPath(c, p);
                c.reset(); c.moveTo(3.5f, 7.5f); c.lineTo(12, 11.5f); c.lineTo(20.5f, 7.5f); c.moveTo(12, 11.5f); c.lineTo(12, 20.5f); k.drawPath(c, p);
                break;
            case GIRAR:
                // la cabeza y una flecha que la rodea
                k.drawCircle(12, 11, 3.6f, p);
                r.set(3, 5, 21, 20); k.drawArc(r, 200, 300, false, p);
                c.moveTo(17.2f, 17.8f); c.lineTo(19.6f, 17.6f); c.lineTo(19.2f, 15.2f); k.drawPath(c, p);
                break;
            case LISTO:
                c.moveTo(5, 12.5f); c.lineTo(10, 17.5f); c.lineTo(19.5f, 7); k.drawPath(c, p);
                break;
            case MUSICA:
                c.moveTo(9, 17.5f); c.lineTo(9, 5.5f); c.lineTo(19, 3.5f); c.lineTo(19, 15.5f); k.drawPath(c, p);
                k.drawLine(9, 9, 19, 7, p);
                p.setStyle(Paint.Style.FILL); k.drawCircle(6.5f, 17.5f, 2.6f, p); k.drawCircle(16.5f, 15.5f, 2.6f, p);
                break;
            case NOTAS:
                r.set(5, 3, 19, 21); k.drawRoundRect(r, 2, 2, p);
                k.drawLine(8.5f, 8, 15.5f, 8, p); k.drawLine(8.5f, 12, 15.5f, 12, p); k.drawLine(8.5f, 16, 12.5f, 16, p);
                break;
            case CALCULADORA:
                r.set(5, 2.5f, 19, 21.5f); k.drawRoundRect(r, 2, 2, p);
                r.set(8, 5.5f, 16, 9); k.drawRoundRect(r, 0.8f, 0.8f, p);
                p.setStyle(Paint.Style.FILL);
                for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) k.drawCircle(8.8f + i * 3.2f, 12.3f + j * 3.1f, 0.95f, p);
                break;
            case RELOJ:
                k.drawCircle(12, 12, 9, p);
                c.moveTo(12, 7); c.lineTo(12, 12); c.lineTo(15.5f, 14); k.drawPath(c, p);
                break;
            case CRONOMETRO:
                k.drawCircle(12, 13.5f, 7.5f, p);
                k.drawLine(10, 2.8f, 14, 2.8f, p); k.drawLine(12, 2.8f, 12, 6, p); k.drawLine(18, 6.5f, 19.5f, 5, p);
                k.drawLine(12, 13.5f, 14.5f, 10.5f, p);
                break;
            case CLIMA: case SOL:
                k.drawCircle(12, 12, 4.2f, p);
                for (int i = 0; i < 8; i++) {
                    double a = i * Math.PI / 4;
                    k.drawLine(12 + (float) Math.cos(a) * 6.8f, 12 + (float) Math.sin(a) * 6.8f, 12 + (float) Math.cos(a) * 9.2f, 12 + (float) Math.sin(a) * 9.2f, p);
                }
                break;
            case NUBE: case LLUVIA: case TORMENTA: case NIEVE: case NIEBLA: {
                float y0 = tipo == NUBE ? 2 : 0;
                c.moveTo(7, 15 + y0); c.quadTo(3, 15 + y0, 3.2f, 11.5f + y0); c.quadTo(3.6f, 8 + y0, 7.5f, 8.5f + y0); c.quadTo(9, 4 + y0, 13.5f, 4.5f + y0);
                c.quadTo(17.5f, 5 + y0, 18, 9 + y0); c.quadTo(21.3f, 9.5f + y0, 21, 12.5f + y0); c.quadTo(20.7f, 15 + y0, 17.5f, 15 + y0); c.close();
                k.drawPath(c, p);
                if (tipo == LLUVIA) { k.drawLine(8, 18, 7, 21, p); k.drawLine(12, 18, 11, 21, p); k.drawLine(16, 18, 15, 21, p); }
                else if (tipo == TORMENTA) { c.reset(); c.moveTo(13, 16.5f); c.lineTo(10.5f, 19.5f); c.lineTo(13.5f, 19.5f); c.lineTo(11, 22.5f); k.drawPath(c, p); }
                else if (tipo == NIEVE) { p.setStyle(Paint.Style.FILL); k.drawCircle(8, 19, 1.1f, p); k.drawCircle(12, 20.5f, 1.1f, p); k.drawCircle(16, 19, 1.1f, p); }
                else if (tipo == NIEBLA) { k.drawLine(5, 18.5f, 19, 18.5f, p); k.drawLine(7, 21.5f, 17, 21.5f, p); }
                break;
            }
            case LUNA:
                c.moveTo(15.5f, 3.5f); c.quadTo(8, 4.5f, 8, 12); c.quadTo(8.5f, 19.5f, 16.5f, 20.5f); c.quadTo(9, 23.5f, 4.5f, 17);
                c.quadTo(1, 9.5f, 7, 5); c.quadTo(10.5f, 2.8f, 15.5f, 3.5f); c.close(); k.drawPath(c, p);
                break;
            case ARCHIVOS: case CARPETA:
                c.moveTo(3, 7); c.lineTo(3, 18.5f); c.lineTo(21, 18.5f); c.lineTo(21, 8.5f); c.lineTo(11.5f, 8.5f); c.lineTo(9.5f, 5.5f); c.lineTo(3, 5.5f); c.close();
                k.drawPath(c, p);
                break;
            case DOCUMENTO:
                c.moveTo(6, 2.5f); c.lineTo(14, 2.5f); c.lineTo(19, 7.5f); c.lineTo(19, 21.5f); c.lineTo(6, 21.5f); c.close(); k.drawPath(c, p);
                c.reset(); c.moveTo(14, 2.5f); c.lineTo(14, 7.5f); c.lineTo(19, 7.5f); k.drawPath(c, p);
                k.drawLine(9, 12.5f, 16, 12.5f, p); k.drawLine(9, 16.5f, 16, 16.5f, p);
                break;
            case PESTANAS:
                r.set(3, 8, 17, 20); k.drawRoundRect(r, 2, 2, p);
                c.moveTo(7, 8); c.lineTo(7, 5); c.lineTo(21, 5); c.lineTo(21, 16); c.lineTo(17, 16); k.drawPath(c, p);
                break;
            case MAS: k.drawLine(12, 5, 12, 19, p); k.drawLine(5, 12, 19, 12, p); break;
            case ESCRITORIO:
                r.set(3, 4.5f, 21, 16); k.drawRoundRect(r, 1.5f, 1.5f, p);
                k.drawLine(12, 16, 12, 19.5f, p); k.drawLine(8, 19.5f, 16, 19.5f, p);
                break;
            case SIGUIENTE:
                p.setStyle(Paint.Style.FILL); c.moveTo(5, 5.5f); c.lineTo(14, 12); c.lineTo(5, 18.5f); c.close(); k.drawPath(c, p);
                r.set(15.5f, 5.5f, 18.5f, 18.5f); k.drawRoundRect(r, 0.8f, 0.8f, p);
                break;
            case ANTERIOR:
                p.setStyle(Paint.Style.FILL); c.moveTo(19, 5.5f); c.lineTo(10, 12); c.lineTo(19, 18.5f); c.close(); k.drawPath(c, p);
                r.set(5.5f, 5.5f, 8.5f, 18.5f); k.drawRoundRect(r, 0.8f, 0.8f, p);
                break;
            case MEZCLAR:
                c.moveTo(3, 7); c.lineTo(7, 7); c.cubicTo(12, 7, 12, 17, 17, 17); c.lineTo(21, 17);
                c.moveTo(3, 17); c.lineTo(7, 17); c.cubicTo(12, 17, 12, 7, 17, 7); c.lineTo(21, 7);
                c.moveTo(18.5f, 4.5f); c.lineTo(21, 7); c.lineTo(18.5f, 9.5f); c.moveTo(18.5f, 14.5f); c.lineTo(21, 17); c.lineTo(18.5f, 19.5f);
                k.drawPath(c, p);
                break;
            case ESPACIO:
                // un planeta con su anillo
                k.drawCircle(12, 12, 5.5f, p);
                r.set(2, 9, 22, 15); k.drawArc(r, 200, 140, false, p); k.drawArc(r, 20, 140, false, p);
                break;
            case VIDEO:
                r.set(2.5f, 6, 16, 18); k.drawRoundRect(r, 2, 2, p);
                c.moveTo(16, 10.5f); c.lineTo(21.5f, 7.5f); c.lineTo(21.5f, 16.5f); c.lineTo(16, 13.5f); k.drawPath(c, p);
                break;
            default:
                k.drawCircle(12, 12, 8, p);
        }
        k.restore();
    }

    @Override public void setAlpha(int a) { p.setAlpha(a); }
    @Override public void setColorFilter(ColorFilter f) { p.setColorFilter(f); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
}
