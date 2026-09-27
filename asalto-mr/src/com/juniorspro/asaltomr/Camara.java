package com.juniorspro.asaltomr;

import android.content.Context;
import android.graphics.Rect;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.media.Image;
import android.media.ImageReader;
import android.os.Build;
import android.os.Handler;
import android.util.Range;
import android.util.Size;
import android.util.SizeF;
import android.view.Surface;

import com.google.ar.core.CameraConfig;
import com.google.ar.core.CameraConfigFilter;
import com.google.ar.core.Session;
import com.google.ar.core.SharedCamera;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;

/**
 * La cámara.
 *
 * LO QUE SE PUEDE: ARCore ofrece varias configuraciones de la cámara trasera
 * (resolución de la textura, fps, sensor de profundidad). La textura 16:9
 * recorta el sensor 4:3 arriba y abajo; la 4:3 lo usa entero: más campo visual,
 * con el mismo lente. "Más ancha" elige la de más campo (se mide con la focal
 * y el tamaño del sensor que informa Camera2).
 *
 * LO QUE ES UN INTENTO: ARCore sólo corre sobre la cámara que tiene calibrada
 * (la principal); no deja elegir la ultra angular. "Ultra angular" abre la
 * cámara en modo compartido (SharedCamera) y le pide a Camera2 zoom < 1×
 * (CONTROL_ZOOM_RATIO), que en los teléfonos que lo permiten cambia al lente
 * ultra angular del mismo módulo lógico. Si el teléfono no lo permite, no pasa
 * nada; si lo permite, ARCore sigue creyendo que es la principal: la imagen se
 * ve más ancha pero las poses, la profundidad y la alineación de lo virtual
 * pueden quedar mal. Por eso es experimental y se informa qué pasó.
 */
final class Camara {

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
     * La configuración de más campo visual (a igual campo: con sensor de
     * profundidad, después la de más resolución). null si no hay dónde elegir.
     */
    static CameraConfig masAncha(Context ctx, Session s) {
        CameraConfigFilter filtro = new CameraConfigFilter(s);
        filtro.setFacingDirection(CameraConfig.FacingDirection.BACK);
        filtro.setTargetFps(EnumSet.of(CameraConfig.TargetFps.TARGET_FPS_30));
        List<CameraConfig> todas = s.getSupportedCameraConfigs(filtro);
        if (todas.isEmpty()) todas = s.getSupportedCameraConfigs();
        CameraConfig mejor = null;
        float mejorPuntos = -1;
        for (CameraConfig c : todas) {
            if (c.getFacingDirection() != CameraConfig.FacingDirection.BACK) continue;
            float[] fov = campo(ctx, c);
            float area = fov == null ? 0 : fov[0] * fov[1];
            Size t = c.getTextureSize();
            float puntos = area * 1000f
                    + (c.getDepthSensorUsage() == CameraConfig.DepthSensorUsage.REQUIRE_AND_USE ? 500f : 0f)
                    + Math.min(t.getWidth() * t.getHeight(), 1920 * 1440) / 10000f;
            if (puntos > mejorPuntos) { mejorPuntos = puntos; mejor = c; }
        }
        return mejor;
    }

    // ───────────────────────── modo compartido (ultra angular) ─────────────────────────

    /** Lo que le avisa a la actividad. */
    interface Aviso {
        void camaraLista();              // ya se puede hacer session.resume()

        void camaraFallo(String por);
    }

    private final Session sesion;
    private final SharedCamera compartida;
    private final String id;
    private final Handler manejador;
    private final Aviso aviso;
    private final Context ctx;
    private CameraDevice dispositivo;
    private CameraCaptureSession captura;
    private CaptureRequest.Builder pedido;
    private ImageReader lector;
    volatile String estado = "";
    boolean linterna;

    Camara(Context ctx, Session sesion, Handler manejador, Aviso aviso) {
        this.ctx = ctx;
        this.sesion = sesion;
        this.compartida = sesion.getSharedCamera();
        this.id = sesion.getCameraConfig().getCameraId();
        this.manejador = manejador;
        this.aviso = aviso;
    }

    private static final class Vaciar implements ImageReader.OnImageAvailableListener {
        @Override
        public void onImageAvailable(ImageReader r) {
            Image i = r.acquireLatestImage();
            if (i != null) i.close();
        }
    }

    private static final class AlAbrir extends CameraDevice.StateCallback {
        final Camara c;

        AlAbrir(Camara c) { this.c = c; }

        @Override
        public void onOpened(CameraDevice d) { c.dispositivo = d; c.armarCaptura(); }

        @Override
        public void onDisconnected(CameraDevice d) { d.close(); c.dispositivo = null; }

        @Override
        public void onError(CameraDevice d, int error) {
            d.close();
            c.dispositivo = null;
            c.aviso.camaraFallo("la cámara dio error " + error);
        }
    }

    private static final class AlConfigurar extends CameraCaptureSession.StateCallback {
        final Camara c;

        AlConfigurar(Camara c) { this.c = c; }

        @Override
        public void onConfigured(CameraCaptureSession s) { c.captura = s; c.aviso.camaraLista(); }

        @Override
        public void onConfigureFailed(CameraCaptureSession s) { c.aviso.camaraFallo("no se pudo configurar la captura"); }
    }

    /** Abre la cámara (pide permiso antes). */
    @SuppressWarnings("MissingPermission")
    void abrir() throws Exception {
        Size tam = sesion.getCameraConfig().getImageSize();
        lector = ImageReader.newInstance(tam.getWidth(), tam.getHeight(), android.graphics.ImageFormat.YUV_420_888, 2);
        lector.setOnImageAvailableListener(new Vaciar(), manejador);
        ArrayList<Surface> propias = new ArrayList<>();
        propias.add(lector.getSurface());
        compartida.setAppSurfaces(id, propias);
        CameraManager cm = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
        cm.openCamera(id, compartida.createARDeviceStateCallback(new AlAbrir(this), manejador), manejador);
    }

    private void armarCaptura() {
        try {
            pedido = dispositivo.createCaptureRequest(CameraDevice.TEMPLATE_RECORD);
            List<Surface> sup = new ArrayList<>(compartida.getArCoreSurfaces());
            sup.add(lector.getSurface());
            for (Surface s : sup) pedido.addTarget(s);
            estado = pedirZoom();
            dispositivo.createCaptureSession(sup, compartida.createARSessionStateCallback(new AlConfigurar(this), manejador), manejador);
        } catch (Exception e) {
            aviso.camaraFallo("captura: " + e.getMessage());
        }
    }

    /** Pide el zoom más chico que acepte la cámara; devuelve qué pasó, en criollo. */
    private String pedirZoom() {
        try {
            CameraManager cm = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
            CameraCharacteristics ch = cm.getCameraCharacteristics(id);
            int fisicas = Build.VERSION.SDK_INT >= 28 ? ch.getPhysicalCameraIds().size() : 0;
            if (Build.VERSION.SDK_INT < 30) return "ultra angular: hace falta Android 11 o más (zoom < 1×)";
            Range<Float> r = ch.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE);
            if (r == null || r.getLower() >= 0.99f)
                return String.format(Locale.ROOT, "ultra angular: la cámara %s de ARCore no baja de 1× (%d lentes físicos): tu teléfono no la da", id, fisicas);
            pedido.set(CaptureRequest.CONTROL_ZOOM_RATIO, r.getLower());
            return String.format(Locale.ROOT, "ultra angular: pedido zoom %.2f× en la cámara %s (%d lentes). Si el seguimiento falla, volvé a \"Más ancha\"", r.getLower(), id, fisicas);
        } catch (Exception e) {
            return "ultra angular: " + e.getMessage();
        }
    }

    /** Ya con session.resume() hecho: arranca la captura continua. */
    void repetir() {
        try {
            if (captura == null || pedido == null) return;
            pedido.set(CaptureRequest.FLASH_MODE, linterna ? CaptureRequest.FLASH_MODE_TORCH : CaptureRequest.FLASH_MODE_OFF);
            captura.setRepeatingRequest(pedido.build(), null, manejador);
        } catch (Exception e) {
            aviso.camaraFallo("repetir: " + e.getMessage());
        }
    }

    void cerrar() {
        try { if (captura != null) captura.close(); } catch (Exception ignorada) { }
        captura = null;
        if (dispositivo != null) dispositivo.close();
        dispositivo = null;
        if (lector != null) lector.close();
        lector = null;
    }
}
