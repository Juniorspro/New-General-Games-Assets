package com.juniorspro.nexoxr;

import android.content.Context;
import android.graphics.Rect;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.util.Size;
import android.util.SizeF;

import com.google.ar.core.CameraConfig;
import com.google.ar.core.CameraConfigFilter;
import com.google.ar.core.Config;
import com.google.ar.core.Session;

import java.util.List;
import java.util.Locale;

/**
 * LA CÁMARA DE ARCORE (de Asalto MR): de las configuraciones que ofrece, la
 * de más fps (60 si hay: la foto llega antes, el seguimiento y las manos se
 * actualizan el doble de seguido) y la imagen cerca de 640×480 (la que come la
 * red de manos).
 */
final class CamaraArcore {
    /** Campo visual horizontal y vertical (grados) de una configuración. */
    static float[] campo(Context ctx, CameraConfig c) {
        try {
            CameraManager cm = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
            CameraCharacteristics ch = cm.getCameraCharacteristics(c.getCameraId());
            float[] focales = ch.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS);
            SizeF sensor = ch.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE);
            Rect activo = ch.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE);
            if (focales == null || focales.length == 0 || sensor == null) return null;
            float f = focales[0];
            float sw = sensor.getWidth(), sh = sensor.getHeight();
            float aspSensor = activo != null ? activo.width() / (float) activo.height() : sw / sh;
            Size t = c.getTextureSize();
            float asp = t.getWidth() / (float) t.getHeight();
            float w, h;
            if (asp >= aspSensor) { w = sw; h = sw / asp; } else { h = sh; w = sh * asp; }
            return new float[]{(float) Math.toDegrees(2 * Math.atan(w / (2 * f))), (float) Math.toDegrees(2 * Math.atan(h / (2 * f)))};
        } catch (Exception e) {
            return null;
        }
    }

    static String describir(Context ctx, CameraConfig c) {
        Size t = c.getTextureSize();
        float[] fov = campo(ctx, c);
        return String.format(Locale.ROOT, "cámara %s · %d×%d · %s%s", c.getCameraId(), t.getWidth(), t.getHeight(),
                fov == null ? "campo ?" : String.format(Locale.ROOT, "%.0f°×%.0f°", fov[0], fov[1]),
                c.getDepthSensorUsage() == CameraConfig.DepthSensorUsage.REQUIRE_AND_USE ? " · sensor ToF" : "");
    }

    /**
     * Como Aeroplaza (su hand tracking se ve "súper fijo"): la cámara de más
     * campo visual; de sus configuraciones, la de MÁS FPS (60 si hay: la mano
     * se sigue el doble de seguido) y, a igual fps, la imagen de la CPU más
     * cerca de 640×480 (lo que come la red de manos). El juego necesita la
     * profundidad (la malla): se queda con la primera, en ese orden, que la
     * tenga; si ninguna, con la primera.
     * Deja la sesión con esa configuración y la devuelve (o null).
     */
    static CameraConfig elegir(Context ctx, Session s, boolean conProfundidad) {
        CameraConfigFilter filtro = new CameraConfigFilter(s);
        filtro.setFacingDirection(CameraConfig.FacingDirection.BACK);
        List<CameraConfig> todas = new java.util.ArrayList<>(s.getSupportedCameraConfigs(filtro));
        if (todas.isEmpty()) return null;
        // la cámara de más campo (hasta 3° de diferencia cuenta como igual: se queda la primera)
        java.util.HashMap<String, Float> campoDe = new java.util.HashMap<>();
        String mejorId = null;
        float mejorCampo = -1;
        for (CameraConfig c : todas) {
            float[] fov = campo(ctx, c);
            float h = fov == null ? 0 : fov[0];
            Float antes = campoDe.get(c.getCameraId());
            if (antes == null || h > antes) campoDe.put(c.getCameraId(), h);
        }
        for (CameraConfig c : todas) {
            float h = campoDe.get(c.getCameraId());
            if (h > mejorCampo + 3) { mejorCampo = h; mejorId = c.getCameraId(); }
        }
        final String id = mejorId;
        todas.sort((a, b) -> {
            int ia = a.getCameraId().equals(id) ? 0 : 1, ib = b.getCameraId().equals(id) ? 0 : 1;
            if (ia != ib) return ia - ib;
            int fa = a.getFpsRange().getUpper(), fb = b.getFpsRange().getUpper();
            if (fa != fb) return fb - fa;
            long da = Math.abs((long) a.getImageSize().getWidth() * a.getImageSize().getHeight() - 640 * 480);
            long db = Math.abs((long) b.getImageSize().getWidth() * b.getImageSize().getHeight() - 640 * 480);
            return Long.compare(da, db);
        });
        CameraConfig antes = s.getCameraConfig();
        for (CameraConfig c : todas) {
            try {
                s.setCameraConfig(c);
                if (!conProfundidad || s.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) return c;
            } catch (Exception ignorada) { }
        }
        try { s.setCameraConfig(todas.get(0)); return todas.get(0); } catch (Exception e) { s.setCameraConfig(antes); return antes; }
    }

}
