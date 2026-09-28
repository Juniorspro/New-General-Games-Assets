package com.juniorspro.nexoxr;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.media.Image;
import android.net.Uri;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Camera;
import com.google.ar.core.CameraIntrinsics;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.Plane;
import com.google.ar.core.PointCloud;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingFailureReason;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.NotYetAvailableException;

import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.concurrent.ConcurrentLinkedQueue;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * NEXO XR: el sistema. Un escritorio en el espacio como el de los visores de
 * realidad mixta, en el teléfono (a mano, o adentro de un visor tipo VR Box):
 *
 *  - SEGUIMIENTO: ARCore (6 grados de libertad: caminás y todo queda en su
 *    lugar) o, si no hay, los sensores del teléfono (sólo girar la cabeza);
 *  - EL MUNDO: passthrough (la cámara) o un entorno 3D (espacio, lago, living);
 *  - LAS VENTANAS: pantallas de Android de verdad (navegador, galería,
 *    ajustes, apps), el dock, los ajustes rápidos y el teclado, cada una en su
 *    pantalla virtual, dibujadas donde las pone el Escritorio;
 *  - LA ENTRADA: tus manos (pellizcar, tocar con el dedo), mirar fijo, el
 *    dedo en la pantalla del teléfono y el control Bluetooth; el Puntero lo
 *    convierte en toques;
 *  - EL VISOR: dos ojos con su distancia, su campo visual y la corrección de
 *    los lentes.
 */
public class Principal extends Activity implements GLSurfaceView.Renderer, Sistema, Teclado.Destino, Puntero.Oyente, SensorEventListener {
    static final int DPI = 300, PERMISO_CAMARA = 1, PERMISO_FOTOS = 2;

    private final Ajustes ajustes = new Ajustes();
    private volatile Ajustes vistos;
    private GLSurfaceView vista;
    private TextView aviso;

    // el seguimiento
    private Session sesion;
    private boolean pidioInstalar, texturaPuesta, conArcore;
    private Config config;
    /** La linterna: la que se quiere y la que quedó (si el teléfono no la deja con ARCore, se apaga). */
    private volatile boolean linterna;
    private volatile boolean geometria = true;
    private SensorManager sensores;
    private final float[] rotSensor = new float[16];
    private volatile boolean hayRotSensor;

    // Nexo Track: la capa entre ARCore y lo que se ve (el giroscopio, el ancla, las pérdidas, los ojos)
    private final Seguimiento seg = new Seguimiento();
    private final Cuello cuello = new Cuello();
    private com.google.ar.core.Anchor anclaAr;
    private final float[] wSensor = new float[16], wDisplay = new float[16], poseOjos = new float[16], anclaM = new float[16];
    private long ultimaFoto, medidoCuello, perdidoEn, ultimoAvisoPerdida;
    private String fallaSeguimiento;
    private volatile float edadFotoMs;
    private String textoCamara = "la de ARCore";
    private final Diagnostico diag = new Diagnostico();
    private final boolean[] pellizcaAhora = new boolean[2];

    // Nexo Inicio: el espacio (tu mesa o el cuarto) y los pasos para prepararlo
    private volatile Inicio inicio;
    /** Cómo quedó: 0 = sin preparar (se mueve como siempre); si no, Inicio.MESA / CUARTO / GIRAR. */
    private volatile int modoEspacio;
    private Plane planoMesa;
    private final Mesa.Plano mesaNum = new Mesa.Plano(), planoTmp = new Mesa.Plano();
    private volatile boolean hayMesa;
    private boolean anclaEsMesa;
    private final Mesa mesaVista = new Mesa();
    private final ArrayList<Mesa.Plano> planosNum = new ArrayList<>();
    private final HashMap<Integer, Plane> planosAr = new HashMap<>();
    private final ArrayList<Plane> referencias = new ArrayList<>();
    private final SuperficiesGl superficies = new SuperficiesGl();
    private float[] nube = new float[4 * 1024];
    private int nubeN, cuadroPlanos;
    private final float[] desdeMundo = new float[16], vistaAr = new float[16], vpAr = new float[16];
    private int etiquetaMesa;
    private final float[] etqC = new float[3], etqR = new float[3], etqU = new float[3];
    private final float[][][] guias = new float[2][21][3];
    private boolean hayGuias;
    private final boolean[] guiaSobre = new boolean[2];
    private final long[] vistoMesa = new long[2];
    private final float[] ondaMesa = new float[2];
    private long ondaDesde = -1;
    private final float[] cabezaAntes = new float[3];
    private float velCabeza;
    private Ventana reticula;
    static final float[] GUIA = {1f, 0.83f, 0.45f}, GUIA_BORDE = {1f, 0.9f, 0.6f}, GUIA_OK = {0.45f, 1f, 0.7f};

    // lo que se dibuja
    private final Fondo fondo = new Fondo();
    private final Entornos entornos = new Entornos();
    private final VentanasGl vgl = new VentanasGl();
    private final Lentes lentes = new Lentes();
    private final ManosGl manosGl = new ManosGl();
    private final Sonido sonido = new Sonido();
    private ManoRastreo manos;
    private final Control control = new Control();

    // el escritorio (del hilo de dibujo)
    private final Escritorio escritorio = new Escritorio();
    private final Puntero puntero = new Puntero();
    private final Gestos[] gestos = {new Gestos(), new Gestos()};
    private final HashMap<Ventana, PanelVirtual> paneles = new HashMap<>();
    private final Dock dock = new Dock();
    private final Rapidos rapidos = new Rapidos();
    private final Teclado teclado = new Teclado();
    private Navegador navegador;
    private volatile PanelVirtual panelFoco;
    private boolean armado, escribiaAntes;
    private long dejoDeEscribir;
    private final ConcurrentLinkedQueue<Runnable> tareas = new ConcurrentLinkedQueue<>();

    // el entorno
    private volatile int entorno = Entornos.LAGO;
    private int ultimoVirtual = Entornos.LAGO, entornoDibujado = -1;
    private float fundido = 1, luz = 1;
    private float piso = Float.NaN;

    // la pantalla y los ojos
    private int ancho = 1, alto = 1;
    private float xdpi = 400;
    private long t0 = SystemClock.elapsedRealtime(), ultimoCuadro, arrancoEn;
    private final float[] proy = new float[16], vistaM = new float[16], vp = new float[16], vistaOjo = new float[16], proyOjo = new float[16],
            vpOjo = new float[16], desplazar = new float[16], poseCam = new float[16], proyCam = new float[16], poseMano = new float[16];
    private final float[] ojo = new float[3], cabeza = new float[3], adelante = new float[3], ojoEste = new float[3];
    private final float[][] ojos = new float[2][6];
    private final int[][] vistaOjos = new int[2][4];
    private Throwable errorGl;

    {
        Matrix.setIdentityM(vistaM, 0);
        Matrix.setIdentityM(poseCam, 0);
        Matrix.perspectiveM(proyCam, 0, 60, 16 / 9f, 0.05f, 200f);
        adelante[2] = -1;
    }

    // las manos
    private final float[][][] puntosMano = new float[2][21][3];
    private final float[] alfaMano = new float[2], brilloMano = new float[2];
    private short[] profMano = new short[0];
    private final float[] imagenAProf = new float[6];
    private final Ventana[] sobreAntes = new Ventana[4];
    private final int[] queAntes = new int[4];

    // el toque en la pantalla del teléfono (sin visor) y el control
    private volatile float toqueX, toqueY;
    private volatile boolean tocando;
    private volatile boolean gatilloControl;
    private volatile float rodar;
    private volatile boolean pedirCaptura;
    private String nombreControl;

    // ───────────────────────── la actividad ─────────────────────────

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Fallo.instalar(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
        ajustes.cargar(this);
        vistos = ajustes.copia();
        cuello.ojos[0] = ajustes.ojoX / 1000f; cuello.ojos[1] = ajustes.ojoY / 1000f; cuello.ojos[2] = ajustes.ojoZ / 1000f;
        entorno = ajustes.entorno;
        if (entorno != Entornos.PASSTHROUGH) ultimoVirtual = entorno;
        String error = Fallo.leer(this);
        DisplayMetrics dm = getResources().getDisplayMetrics();
        xdpi = dm.xdpi > 100 ? dm.xdpi : dm.densityDpi;
        sonido.cargar(this);
        sonido.activo = ajustes.sonido == 1;
        control.cargar(getSharedPreferences("control", MODE_PRIVATE).getString("mapa", ""));
        sensores = (SensorManager) getSystemService(SENSOR_SERVICE);

        FrameLayout raiz = new FrameLayout(this);
        vista = new GLSurfaceView(this);
        vista.setPreserveEGLContextOnPause(true);
        vista.setEGLContextClientVersion(2);
        vista.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        vista.setRenderer(this);
        vista.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        vista.setOnTouchListener((v, e) -> {
            int a = e.getActionMasked();
            toqueX = e.getX(); toqueY = e.getY();
            if (a == MotionEvent.ACTION_DOWN) tocando = true;
            else if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) tocando = false;
            return true;
        });
        raiz.addView(vista);
        aviso = new TextView(this);
        aviso.setTextColor(Color.WHITE);
        aviso.setTextSize(15);
        aviso.setBackgroundColor(0xCC15161B);
        aviso.setPadding(40, 24, 40, 24);
        aviso.setVisibility(View.GONE);
        aviso.setOnClickListener(v -> v.setVisibility(View.GONE));
        raiz.addView(aviso, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        setContentView(raiz);
        if (error != null) avisar("La vez anterior Nexo se cerró por un error (tocá para ocultar):\n" + error);
        if (ajustes.manos == 1) { manos = new ManoRastreo(this); manos.escala(ajustes.escalaMano / 1000f); }
        // las actualizaciones: si hay una nueva, se abre su ventana (con "Actualizar")
        Actualizador act = Actualizador.de(this);
        act.alHaber = () -> { tareas.add(() -> abrirCuandoSePueda("actualizar")); sonido.tocar(Sonido.ABRIR); };
        String nov = act.novedades();
        if (nov != null && error == null) avisar(nov);
        pantallaCompleta();
    }

    @Override
    protected void onResume() {
        super.onResume();
        pantallaCompleta();
        Sensor rv = sensores.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
        if (rv == null) rv = sensores.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        // cada 5 ms (200 por segundo): Nexo Track lleva la pose de ARCore hasta el momento en que se ve
        if (rv != null) sensores.registerListener(this, rv, 5000);
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, PERMISO_CAMARA);
        } else if (sesion == null) crearSesion();
        if (sesion != null) {
            try { sesion.resume(); conArcore = true; } catch (Exception e) { avisar("La cámara está ocupada por otra app."); sesion = null; conArcore = false; }
        }
        // al volver, la linterna como estaba (ARCore la apaga al pausar)
        if (linterna) linterna(true);
        if (manos != null && conArcore) manos.arrancar();
        vista.onResume();
        Actualizador act = Actualizador.de(this);
        // volviendo del permiso de instalar: seguir con la actualización
        if (act.estado == Actualizador.PERMISO && (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls())) act.actualizar();
        else act.quizas();
    }

    @Override
    protected void onPause() {
        super.onPause();
        sensores.unregisterListener(this);
        if (manos != null) manos.parar();
        if (linterna && sesion == null) try { linterna(false); linterna = true; } catch (Throwable ignorada) { }   // se vuelve a prender al volver
        vista.onPause();
        if (sesion != null) sesion.pause();
        synchronized (ajustes) { ajustes.guardar(this); }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        for (PanelVirtual p : paneles.values()) p.cerrar();
        if (sesion != null) sesion.close();
        sonido.liberar();
    }

    private void crearSesion() {
        try {
            if (ArCoreApk.getInstance().requestInstall(this, !pidioInstalar) == ArCoreApk.InstallStatus.INSTALL_REQUESTED) { pidioInstalar = true; return; }
            sesion = new Session(this);
            // la cámara de más fps (60 si hay) y la imagen cerca de 640×480, como Asalto MR
            try { CamaraArcore.elegir(this, sesion, false); textoCamara = CamaraArcore.describir(this, sesion.getCameraConfig()) + " · " + sesion.getCameraConfig().getFpsRange().getUpper() + " fps"; }
            catch (Throwable e) { textoCamara = "la de ARCore"; }
            Config c = new Config(sesion);
            config = c;
            c.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
            c.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);
            c.setFocusMode(Config.FocusMode.AUTO);
            c.setLightEstimationMode(Config.LightEstimationMode.DISABLED);
            boolean prof = sesion.isDepthModeSupported(Config.DepthMode.AUTOMATIC);
            c.setDepthMode(prof ? Config.DepthMode.AUTOMATIC : Config.DepthMode.DISABLED);
            sesion.configure(c);
            texturaPuesta = false;
        } catch (Throwable e) {
            sesion = null;
            avisar("Sin ARCore (" + e.getClass().getSimpleName() + "): sólo se gira la cabeza, sin passthrough ni manos.");
        }
    }

    @Override
    public void onRequestPermissionsResult(int cod, String[] p, int[] r) {
        if (cod == PERMISO_CAMARA) {
            if (r.length > 0 && r[0] == PackageManager.PERMISSION_GRANTED) { crearSesion(); if (sesion != null) try { sesion.resume(); conArcore = true; if (manos != null) manos.arrancar(); } catch (Exception e) { sesion = null; } }
            else avisar("Sin la cámara no hay passthrough ni manos: se usa la mirada, la pantalla y el control.");
        } else if (cod == PERMISO_FOTOS) {
            tareas.add(() -> { for (Ventana v : new ArrayList<>(escritorio.ventanas)) if (v.app.equals("galeria")) { cerrarVentana(v); abrirEnGl("galeria"); } });
        }
    }

    private void pantallaCompleta() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) pantallaCompleta(); }

    private void avisar(String s) {
        runOnUiThread(() -> { aviso.setText(s); aviso.setVisibility(View.VISIBLE); aviso.postDelayed(() -> aviso.setVisibility(View.GONE), 9000); });
    }

    /** Del mundo de OpenGL (Y arriba, −Z al norte) al de los sensores (X este, Y norte, Z arriba), por columnas. */
    private static final float[] GL_A_ENU = {1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1};
    private volatile int rotacion = android.view.Surface.ROTATION_90;

    // los sensores (sin ARCore: sólo girar)
    @Override
    public void onSensorChanged(SensorEvent e) {
        float[] qw = new float[4];
        SensorManager.getQuaternionFromVector(qw, e.values);   // (w, x, y, z)
        seg.giro(aBoot(e.timestamp), qw[1], qw[2], qw[3], qw[0]);
        float[] m = new float[16], r = new float[16], v = new float[16];
        SensorManager.getRotationMatrixFromVector(m, e.values);
        // el teléfono acostado: los ejes de la pantalla (derecha, arriba) según para qué lado está
        if (rotacion == android.view.Surface.ROTATION_270) SensorManager.remapCoordinateSystem(m, SensorManager.AXIS_MINUS_Y, SensorManager.AXIS_X, r);
        else SensorManager.remapCoordinateSystem(m, SensorManager.AXIS_Y, SensorManager.AXIS_MINUS_X, r);
        // r (por filas) va del teléfono al mundo; leída por columnas (como OpenGL) es al revés: del mundo
        // al teléfono, o sea la vista (la cámara de atrás mira por −Z del teléfono, como la de OpenGL)
        Matrix.multiplyMM(v, 0, r, 0, GL_A_ENU, 0);
        synchronized (rotSensor) { System.arraycopy(v, 0, rotSensor, 0, 16); }
        hayRotSensor = true;
    }

    @Override public void onAccuracyChanged(Sensor s, int a) { }

    // ───────────────────────── teclas y control ─────────────────────────

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode(), a = e.getAction();
        if (k == KeyEvent.KEYCODE_HOME || k == KeyEvent.KEYCODE_POWER) return super.dispatchKeyEvent(e);
        InputDevice d = e.getDevice();
        boolean deControl = d != null && !d.isVirtual() && (Build.VERSION.SDK_INT < 29 || d.isExternal());
        if (k == KeyEvent.KEYCODE_BACK && !deControl) {
            if (a == KeyEvent.ACTION_UP) tareas.add(() -> { if (escritorio.rapidos != null && escritorio.rapidos.visible) escritorio.rapidos.visible = false; else if (escritorio.dock != null) escritorio.dock.visible = !escritorio.dock.visible; });
            return true;
        }
        if (a != KeyEvent.ACTION_DOWN && a != KeyEvent.ACTION_UP) return super.dispatchKeyEvent(e);
        int acc;
        synchronized (control) { acc = control.evento(k, a == KeyEvent.ACTION_DOWN, e.getRepeatCount() > 0, SystemClock.elapsedRealtime()); gatilloControl = control.sostenido(); }
        if (d != null && deControl) nombreControl = d.getName();
        if (acc == Control.NADA && control.accion(k) == Control.NADA && !control.aprendiendo()) return super.dispatchKeyEvent(e);
        accionControl(acc);
        return true;
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent e) {
        if ((e.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK && e.getAction() == MotionEvent.ACTION_MOVE) {
            float x = e.getAxisValue(MotionEvent.AXIS_X), y = e.getAxisValue(MotionEvent.AXIS_Y);
            float hy = e.getAxisValue(MotionEvent.AXIS_HAT_Y);
            if (Math.abs(hy) > Math.abs(y)) y = hy;
            // el joystick para arriba y abajo: scroll de lo que se apunta
            rodar = Math.abs(y) > 0.3f ? -y : 0;
            float der = Math.max(e.getAxisValue(MotionEvent.AXIS_RTRIGGER), e.getAxisValue(MotionEvent.AXIS_GAS));
            int[] cambios;
            synchronized (control) { cambios = control.ejes(x, 0, der, 0); }
            for (int c : cambios) {
                int acc;
                synchronized (control) { acc = control.evento(Math.abs(c), c > 0, false, SystemClock.elapsedRealtime()); gatilloControl = control.sostenido(); }
                accionControl(acc);
            }
            return true;
        }
        return super.dispatchGenericMotionEvent(e);
    }

    /** Lo que hace cada botón del control en el sistema: el gatillo es el clic (con la mirada), menú = el dock. */
    private void accionControl(int acc) {
        switch (acc) {
            case Control.MENU: tareas.add(() -> { if (escritorio.dock != null) escritorio.dock.visible = !escritorio.dock.visible; }); break;
            case Control.RECARGAR: tareas.add(this::recentrarEnGl); break;   // (el "B": recentrar)
            case Control.SIGUIENTE: case Control.ANTERIOR: tareas.add(() -> { Ventana v = escritorio.enfocada; if (v != null) escritorio.cine(v, !v.cine); }); break;
            default: break;
        }
    }

    // ───────────────────────── Sistema (lo piden las pantallas) ─────────────────────────

    @Override public void abrir(String app) { tareas.add(() -> abrirEnGl(app)); }

    @Override public void abrirUrl(String url) { tareas.add(() -> { abrirEnGl("navegador"); if (navegador != null) runOnUiThread(() -> navegador.ir(url)); }); }

    @Override public void entorno(int cual) {
        entorno = cual;
        if (cual != Entornos.PASSTHROUGH) ultimoVirtual = cual;
        synchronized (ajustes) { ajustes.entorno = cual; vistos = ajustes.copia(); }
    }

    @Override public int entorno() { return entorno; }

    @Override public void alternarPassthrough() { entorno(entorno == Entornos.PASSTHROUGH ? ultimoVirtual : Entornos.PASSTHROUGH); }

    @Override public void recentrar() { tareas.add(this::recentrarEnGl); }

    @Override public void captura() { pedirCaptura = true; }

    @Override public boolean linterna() { return linterna; }

    /**
     * Prende o apaga el flash de la cámara. Con ARCore, por su configuración
     * (la cámara la tiene ARCore: así no se corta el seguimiento); sin ARCore,
     * directo con la cámara del teléfono.
     */
    @Override public void linterna(boolean si) {
        if (sesion != null && config != null) {
            vista.queueEvent(() -> {
                try {
                    config.setFlashMode(si ? Config.FlashMode.TORCH : Config.FlashMode.OFF);
                    sesion.configure(config);
                    linterna = si;
                } catch (Throwable e) {
                    try { config.setFlashMode(Config.FlashMode.OFF); sesion.configure(config); } catch (Throwable ignorada) { /* queda como estaba */ }
                    linterna = false;
                    avisar("Este teléfono no deja prender la linterna mientras ARCore usa la cámara.");
                }
            });
            return;
        }
        try {
            android.hardware.camera2.CameraManager cm = (android.hardware.camera2.CameraManager) getSystemService(CAMERA_SERVICE);
            for (String id : cm.getCameraIdList()) {
                android.hardware.camera2.CameraCharacteristics cc = cm.getCameraCharacteristics(id);
                Boolean hay = cc.get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE);
                Integer lado = cc.get(android.hardware.camera2.CameraCharacteristics.LENS_FACING);
                if (Boolean.TRUE.equals(hay) && lado != null && lado == android.hardware.camera2.CameraCharacteristics.LENS_FACING_BACK) {
                    cm.setTorchMode(id, si);
                    linterna = si;
                    return;
                }
            }
            avisar("Este teléfono no tiene flash atrás.");
        } catch (Throwable e) {
            linterna = false;
            avisar("No se pudo prender la linterna: " + e.getMessage());
        }
    }

    @Override public void visor(boolean sbs) { cambio("sbs", sbs ? 1 : 0); }

    @Override public boolean visor() { return vistos.sbs == 1; }

    @Override public void mostrarRapidos(boolean si) { tareas.add(() -> { if (escritorio.rapidos != null) { escritorio.acomodar(escritorio.rapidos); escritorio.rapidos.visible = si; escritorio.rapidos.aparece = 0; } }); }

    @Override public void mostrarTeclado(boolean si) { tareas.add(() -> escritorio.mostrarTeclado(si)); }

    @Override public void cambio(String clave, int valor) {
        synchronized (ajustes) { ajustes.poner(clave, valor); vistos = ajustes.copia(); ajustes.guardar(this); }
        if (clave.equals("sonido")) sonido.activo = valor == 1;
        if (clave.equals("manos")) runOnUiThread(() -> {
            if (valor == 1 && manos == null) { manos = new ManoRastreo(this); manos.escala(vistos.escalaMano / 1000f); if (conArcore) manos.arrancar(); }
            else if (valor == 0 && manos != null) { manos.parar(); manos = null; }
        });
    }

    @Override public Ajustes ajustes() { return vistos; }

    @Override public String estado() {
        StringBuilder b = new StringBuilder();
        if (conArcore) {
            Ajustes a = vistos;
            float[] o = ojosAhora(a);
            b.append(seg.modo == Seguimiento.GIRO ? "Seguimiento: PERDIDO, sólo girando (" + fallaSeguimiento + ")" : "Seguimiento: Nexo Track sobre ARCore (6 DoF)");
            b.append(String.format(Locale.ROOT, " · la foto llega %.0f ms tarde, se lleva %.0f ms con el giroscopio · el ancla corrigió %.1f cm · perdido %d veces · cámara: %s",
                    edadFotoMs, seg.demoraMs, seg.correccionCm, seg.perdidas, textoCamara));
            if (a.sbs == 1) b.append(String.format(Locale.ROOT, " · ojos %s (%.1f, %.1f, %.1f) cm%s", a.ojoAuto == 1 ? "medidos" : "a mano",
                    o[0] * 100, o[1] * 100, o[2] * 100, a.ojoAuto == 1 ? " en " + cuello.medidas + " medidas" : ""));
        } else b.append("Seguimiento: sensores (sólo girar)");
        switch (modoEspacio) {
            case Inicio.MESA:
                b.append(!hayMesa ? " · Mesa: perdida (prepará el espacio de nuevo en Ajustes → Espacio)"
                        : mesaVista.vista ? " · Mesa: la veo (" + mesaVista.puntos + " puntos): te podés mover" : " · Mesa: no la veo: posición fija, sólo girás");
                break;
            case Inicio.CUARTO: b.append(mesaVista.vista ? " · Cuarto: lo reconozco" : " · Cuarto: no lo reconozco: posición fija"); break;
            case Inicio.GIRAR: b.append(" · Sólo girar: la cabeza fija"); break;
            default:
        }
        ManoRastreo m = manos;
        b.append(" · Manos: ").append(m == null ? "apagadas" : m.anda ? "andando (" + m.delegado + ")" : m.estado);
        if (nombreControl != null) b.append(" · Control: ").append(nombreControl);
        return b.toString();
    }

    @Override public void aprenderControl() {
        synchronized (control) { control.empezarAprender(SystemClock.elapsedRealtime()); }
        avisar("Control: apretá el botón para hacer CLIC, después RECENTRAR, CINE y MENÚ (8 s cada uno para saltear).");
    }

    @Override public void sonido(int cual) { sonido.tocar(cual); }

    @Override public void permisoFotos() {
        runOnUiThread(() -> requestPermissions(Build.VERSION.SDK_INT >= 33
                ? new String[]{Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO}
                : new String[]{Manifest.permission.READ_EXTERNAL_STORAGE}, PERMISO_FOTOS));
    }

    // ── el teclado escribe en la ventana con el foco ──

    @Override public void escribir(String s) { PanelVirtual p = panelFoco; if (p != null) p.escribir(s); }

    @Override public void tecla(int codigo) { PanelVirtual p = panelFoco; if (p != null) p.tecla(codigo); }

    @Override public void ocultar() { mostrarTeclado(false); }

    @Override public void sonido() { sonido.tocar(Sonido.TECLA); }

    // ───────────────────────── el escritorio (hilo de dibujo) ─────────────────────────

    private int[] tamano(String app) {
        switch (app) {
            case "ajustes": return new int[]{1180, 800};
            case "bienvenida": return new int[]{1100, 800};
            case "actualizar": return new int[]{1000, 680};
            case "inicio": return new int[]{1100, 720};
            default: return new int[]{1280, 800};
        }
    }

    private PanelVirtual.Fabrica fabrica(String app) {
        switch (app) {
            case "navegador": return c -> { navegador = new Navegador(); return navegador.crear(c, this, null); };
            case "galeria": return c -> new Galeria().crear(c, this);
            case "ajustes": return c -> new AjustesApp().crear(c, this);
            case "bienvenida": return c -> new Bienvenida().crear(c, this, () -> {
                cambio("tutorial", 1);
                tareas.add(() -> { for (Ventana v : new ArrayList<>(escritorio.ventanas)) if (v.app.equals("bienvenida")) cerrarVentana(v); });
            });
            case "inicio": { Inicio in = inicio; return c -> new InicioApp().crear(c, this, in != null ? in : new Inicio()); }
            case "actualizar": return c -> new ActualizarApp().crear(c, this,
                    () -> tareas.add(() -> { for (Ventana v : new ArrayList<>(escritorio.ventanas)) if (v.app.equals("actualizar")) cerrarVentana(v); }));
            default: return c -> new Biblioteca().crear(c, this);
        }
    }

    /** Antes de que esté el escritorio (el primer cuadro con posición), queda para después. */
    private String pendiente;
    private void abrirCuandoSePueda(String app) { if (armado) abrirEnGl(app); else pendiente = app; }

    private void abrirEnGl(String app) {
        HashSet<Ventana> antes = new HashSet<>(escritorio.ventanas);
        boolean yaEstaba = false;
        for (Ventana v : antes) if (v.app.equals(app)) yaEstaba = true;
        int[] t = tamano(app);
        Ventana v = escritorio.abrir(app, t[0], t[1], SystemClock.elapsedRealtime());
        // si se fue una (había 3), su pantalla también
        for (Ventana w : antes) if (!escritorio.ventanas.contains(w)) { PanelVirtual p = paneles.remove(w); if (p != null) { p.liberarGl(); p.cerrar(); } }
        if (yaEstaba) { v.visible = true; return; }
        PanelVirtual p = new PanelVirtual(this, v, fabrica(app), DPI);
        p.crearGl();
        paneles.put(v, p);
        v.aparece = 0;
        sonido.tocar(Sonido.ABRIR);
        actualizarDock();
    }

    private void cerrarVentana(Ventana v) {
        PanelVirtual p = paneles.remove(v);
        if (p != null) { p.liberarGl(); p.cerrar(); }
        escritorio.cerrar(v);
        Inicio in = inicio;
        if (in != null && v.app.equals("inicio")) in.empezar();   // ✕: se sigue con lo que haya
        sonido.tocar(Sonido.CERRAR);
        actualizarDock();
    }

    private void actualizarDock() {
        HashSet<String> abiertas = new HashSet<>();
        for (Ventana v : escritorio.ventanas) if (v.tipo == Ventana.APP) abiertas.add(v.app);
        dock.abiertas(abiertas);
    }

    // ── Nexo Track ──

    /** Las horas de los sensores y de las fotos a una sola base (la del arranque del teléfono). */
    private static long aBoot(long ts) {
        long boot = SystemClock.elapsedRealtimeNanos(), mono = System.nanoTime();
        return Math.abs(mono - ts) < Math.abs(boot - ts) ? ts + (boot - mono) : ts;
    }

    /** Un ancla de ARCore donde está el escritorio (1.1 m adelante): con sus correcciones, todo queda en su lugar. */
    private void anclar() {
        if (sesion == null) return;
        try {
            float hl = (float) Math.hypot(wDisplay[8], wDisplay[10]);
            float fx = hl > 1e-3f ? -wDisplay[8] / hl : 0, fz = hl > 1e-3f ? -wDisplay[10] / hl : -1;
            com.google.ar.core.Anchor nueva = sesion.createAnchor(Pose.makeTranslation(wDisplay[12] + fx * 1.1f, wDisplay[13], wDisplay[14] + fz * 1.1f));
            float[] m = new float[16];
            nueva.getPose().toMatrix(m, 0);
            seg.nuevaAncla(m);
            if (anclaAr != null) anclaAr.detach();
            anclaAr = nueva;
        } catch (Throwable e) { /* sin ancla por ahora: se intenta el próximo cuadro */ }
    }

    /** Dónde están los ojos desde la cámara (marco de la pantalla): medidos solos o los de los ajustes. */
    private float[] ojosAhora(Ajustes a) {
        return a.ojoAuto == 1 ? cuello.ojos : new float[]{a.ojoX / 1000f, a.ojoY / 1000f, a.ojoZ / 1000f};
    }

    private void guardarOjos() {
        int x = Math.round(cuello.ojos[0] * 1000), y = Math.round(cuello.ojos[1] * 1000), z = Math.round(cuello.ojos[2] * 1000);
        Ajustes a = vistos;
        if (Math.abs(x - a.ojoX) + Math.abs(y - a.ojoY) + Math.abs(z - a.ojoZ) < 3) return;
        cambio("ojoX", x); cambio("ojoY", y); cambio("ojoZ", z);
    }

    private static String nombreFalla(TrackingFailureReason r) {
        if (r == null) return "ARCore se está ubicando";
        switch (r) {
            case INSUFFICIENT_LIGHT: return "poca luz: prendé una luz o la linterna";
            case EXCESSIVE_MOTION: return "te moviste muy rápido";
            case INSUFFICIENT_FEATURES: return "la cámara ve poco: una pared lisa, o la tapa del visor le tapa la cámara";
            case CAMERA_UNAVAILABLE: return "otra app está usando la cámara";
            case BAD_STATE: return "ARCore se reinició";
            default: return "ARCore se está ubicando";
        }
    }

    /** Si se pierde más de 0.8 s, se avisa por qué (una vez cada 20 s como mucho). */
    private void avisarPerdida(long ahora) {
        if (seg.modo != Seguimiento.GIRO) { perdidoEn = 0; return; }
        if (perdidoEn == 0) perdidoEn = ahora;
        if (ahora - perdidoEn > 800 && ahora - ultimoAvisoPerdida > 20000) {
            ultimoAvisoPerdida = ahora;
            avisar("Se perdió el seguimiento (" + (fallaSeguimiento != null ? fallaSeguimiento : "?") + "). Mientras tanto sólo gira; al volver se acomoda solo.");
        }
    }

    @Override public void grabarDiagnostico() {
        tareas.add(() -> {
            if (diag.grabando) return;
            Ajustes a = vistos;
            String cab = String.format(Locale.ROOT,
                    "{\"nexo\":\"%s\",\"modelo\":\"%s %s\",\"android\":%d,\"camara\":\"%s\",\"arcore\":%b,\"sbs\":%d,\"fov\":%d,\"anticipo\":%d,\"ojoAuto\":%d,\"ojos\":[%.3f,%.3f,%.3f],\"cuello\":{\"medidas\":%d,\"errorCm\":%.2f},\"entorno\":%d,\"manos\":%d}",
                    Actualizador.de(this).instaladaNombre, Build.MANUFACTURER, Build.MODEL, Build.VERSION.SDK_INT, textoCamara.replace('"', '\''), conArcore,
                    a.sbs, a.fov, a.anticipo, a.ojoAuto, ojosAhora(a)[0], ojosAhora(a)[1], ojosAhora(a)[2], cuello.medidas, cuello.errorCm, entorno, a.manos);
            diag.empezar(SystemClock.elapsedRealtime(), cab);
            avisar("Grabando el diagnóstico 20 s: usá Nexo normal (girá la cabeza, quedate quieto un rato, mové las manos, pellizcá).");
        });
    }


    // ───────────────────────── Nexo Inicio: el espacio ─────────────────────────

    /** Prepara el espacio (al empezar, o desde Ajustes → Espacio): la ventana del inicio y los pasos. */
    private void empezarInicio() {
        Inicio in = new Inicio();
        int m = vistos.modoEspacio;
        in.modo = m == Inicio.CUARTO || m == Inicio.GIRAR ? m : Inicio.MESA;
        planoMesa = null;
        hayMesa = false;
        hayGuias = false;
        referencias.clear();
        planosNum.clear();
        planosAr.clear();
        ondaDesde = -1;
        if (manos != null) manos.mesaCal = null;
        for (Ventana v : new ArrayList<>(escritorio.ventanas)) if (v.app.equals("inicio")) cerrarVentana(v);
        inicio = in;
        escritorio.mesa = null;
        if (escritorio.dock != null) { escritorio.dock.visible = false; escritorio.acomodar(escritorio.dock); }
        abrirEnGl("inicio");
    }

    @Override public void prepararEspacio() {
        if (!conArcore) { avisar("Para escanear tu mesa hace falta ARCore y la cámara."); return; }
        tareas.add(this::empezarInicio);
    }

    /** Cada cuadro con ARCore: la nube, la mesa, los pasos del inicio y si Nexo se puede mover. */
    private void espacio(Frame cuadro, Camera camara, boolean rastrea, long ahora, float dt, Ajustes a) {
        seg.desdeMundo(desdeMundo);
        float dl = Seguimiento.dist(cabeza, cabezaAntes);
        System.arraycopy(cabeza, 0, cabezaAntes, 0, 3);
        if (dt > 0) velCabeza += (Math.min(2, dl / dt) - velCabeza) * Math.min(1, dt * 6);
        Inicio in = inicio;
        nubeN = 0;
        if (rastrea && (in != null || modoEspacio == Inicio.MESA || modoEspacio == Inicio.CUARTO)) leerNube(cuadro);
        // la cámara en el mundo de ARCore
        float[] cabW = {wDisplay[12], wDisplay[13], wDisplay[14]}, adeW = {-wDisplay[8], -wDisplay[9], -wDisplay[10]};
        // la mesa: el plano de ARCore (si se juntó con otro, el que quedó)
        if (planoMesa != null) {
            while (planoMesa.getSubsumedBy() != null) planoMesa = planoMesa.getSubsumedBy();
            TrackingState em = planoMesa.getTrackingState();
            if (em == TrackingState.TRACKING) { llenar(mesaNum, planoMesa); hayMesa = true; }
            else if (em == TrackingState.STOPPED) { planoMesa = null; hayMesa = false; }
        } else if (modoEspacio == Inicio.MESA && mesaNum.lados() >= 3 && rastrea && ++cuadroPlanos % 30 == 0) buscarMesaPerdida();
        if (in != null) pasoInicio(in, rastrea, ahora, cabW, adeW);
        // ¿se puede mover? Sólo si ve lo que escaneaste (la mesa, o el cuarto)
        if (inicio != null) { seg.puedeMoverse = true; return; }
        switch (modoEspacio) {
            case Inicio.MESA:
                if (hayMesa) {
                    camara.getViewMatrix(vistaAr, 0);
                    Matrix.multiplyMM(vpAr, 0, proyCam, 0, vistaAr, 0);
                    int pts = Mesa.puntosSobre(mesaNum, nube, nubeN, 0.25f);
                    float vis = Mesa.fraccionVisible(mesaNum, vpAr, cabW);
                    mesaVista.puntos = pts;
                    mesaVista.paso(Mesa.detectada(rastrea, pts, vis), ahora);
                } else mesaVista.paso(false, ahora);
                seg.puedeMoverse = a.soloConMesa == 0 || mesaVista.vista;
                break;
            case Inicio.CUARTO: {
                int pts = 0;
                for (int i = 0; i < referencias.size(); i++) {
                    Plane p = referencias.get(i);
                    while (p.getSubsumedBy() != null) p = p.getSubsumedBy();
                    referencias.set(i, p);
                    if (p.getTrackingState() != TrackingState.TRACKING) continue;
                    llenar(planoTmp, p);
                    pts += Mesa.puntosSobre(planoTmp, nube, nubeN, 0.25f);
                }
                mesaVista.puntos = pts;
                mesaVista.paso(rastrea && pts >= Mesa.PUNTOS_VE, ahora);
                seg.puedeMoverse = a.soloConMesa == 0 || mesaVista.vista;
                break;
            }
            case Inicio.GIRAR: seg.puedeMoverse = false; break;
            default: seg.puedeMoverse = true;
        }
    }

    /** La nube de puntos de ESTA foto (x, y, z, confianza), en el mundo de ARCore. */
    private void leerNube(Frame cuadro) {
        PointCloud pc = null;
        try {
            pc = cuadro.acquirePointCloud();
            FloatBuffer b = pc.getPoints();
            b.rewind();
            int n = Math.min(b.remaining() / 4, 2048);
            if (nube.length < n * 4) nube = new float[n * 4];
            b.get(nube, 0, n * 4);
            nubeN = n;
        } catch (Throwable e) {
            nubeN = 0;
        } finally {
            if (pc != null) pc.release();
        }
    }

    /**
     * Si ARCore dejó de seguir el plano de la mesa (se reinició, se perdió),
     * la vuelve a encontrar sola: un plano horizontal a la misma altura (±5 cm)
     * y cerca de donde estaba.
     */
    private void buscarMesaPerdida() {
        float[] c = new float[2], w = new float[3], wv = new float[3];
        mesaNum.centroLocal(c);
        mesaNum.aMundo(c[0], c[1], w);
        Plane mejor = null;
        float md = 0.6f;
        for (Plane p : sesion.getAllTrackables(Plane.class)) {
            if (p.getTrackingState() != TrackingState.TRACKING || p.getSubsumedBy() != null || p.getType() != Plane.Type.HORIZONTAL_UPWARD_FACING) continue;
            llenar(planoTmp, p);
            if (Math.abs(planoTmp.pose[13] - mesaNum.pose[13]) > 0.05f || planoTmp.area() < Mesa.AREA_MIN) continue;
            planoTmp.centroLocal(c);
            planoTmp.aMundo(c[0], c[1], wv);
            float d = (float) Math.hypot(wv[0] - w[0], wv[2] - w[2]);
            if (d < md) { md = d; mejor = p; }
        }
        if (mejor != null) { planoMesa = mejor; llenar(mesaNum, mejor); hayMesa = true; }
    }

    /** Todos los planos que ARCore sigue (sin los que se juntaron con otro). */
    private void leerPlanos() {
        planosNum.clear();
        planosAr.clear();
        for (Plane p : sesion.getAllTrackables(Plane.class)) {
            if (p.getTrackingState() != TrackingState.TRACKING || p.getSubsumedBy() != null) continue;
            Mesa.Plano n = new Mesa.Plano();
            llenar(n, p);
            planosNum.add(n);
            planosAr.put(n.id, p);
        }
    }

    /** Un plano de ARCore en números. */
    private static void llenar(Mesa.Plano o, Plane p) {
        p.getCenterPose().toMatrix(o.pose, 0);
        FloatBuffer b = p.getPolygon();
        b.rewind();
        int n = b.remaining();
        if (o.poligono.length != n) o.poligono = new float[n];
        b.get(o.poligono);
        o.horizontal = p.getType() == Plane.Type.HORIZONTAL_UPWARD_FACING;
        o.vertical = p.getType() == Plane.Type.VERTICAL;
        o.id = System.identityHashCode(p);
    }

    /** Los pasos del inicio, con lo que ve ARCore. */
    private void pasoInicio(Inicio in, boolean rastrea, long ahora, float[] cabW, float[] adeW) {
        switch (in.paso) {
            case Inicio.ESCANEAR:
                if (!rastrea) break;
                if (++cuadroPlanos % 3 == 0 || planosNum.isEmpty()) leerPlanos();
                if (in.modo == Inicio.MESA) {
                    int i = Mesa.elegir(planosNum, cabW, adeW, null);
                    Mesa.Plano p = i >= 0 ? planosNum.get(i) : null;
                    int antes = in.candidata;
                    boolean ok = in.escanearMesa(p == null ? 0 : p.id, p == null ? 0 : p.area(), p == null ? null : p.medidas(), ahora);
                    if (p != null && antes != p.id) sonido.tocar(Sonido.TIC);
                    if (ok) confirmarMesa(p, cabW, adeW, ahora);
                } else {
                    float area = 0;
                    boolean piso = false;
                    for (Mesa.Plano p : planosNum) {
                        float ar = p.area();
                        area += ar;
                        if (p.horizontal && cabW[1] - p.pose[13] > 1.1f && ar > 0.5f) piso = true;
                    }
                    if (in.escanearCuarto(area, planosNum.size(), piso, ahora)) {
                        referencias.clear();
                        for (Mesa.Plano p : planosNum) { Plane pl = planosAr.get(p.id); if (pl != null) referencias.add(pl); }
                        sonido.tocar(Sonido.LOGRO);
                        vibrar();
                    }
                }
                break;
            case Inicio.MANOS: manosEnMesa(in, ahora, cabW, adeW); break;
            case Inicio.CABEZA:
                if (in.cabeza(seg.velocidad(), velCabeza, cabeza, yawDe(adelante), ahora)) fijarCabeza(in);
                break;
            case Inicio.FUERA: terminarInicio(in); break;
            default:
        }
    }

    /** "¡Tu mesa!": el ancla del escritorio pasa a ser la mesa, la onda sale de donde mirabas, y la etiqueta. */
    private void confirmarMesa(Mesa.Plano p, float[] cabW, float[] adeW, long ahora) {
        Plane pl = planosAr.get(p.id);
        if (pl == null) return;
        planoMesa = pl;
        llenar(mesaNum, pl);
        hayMesa = true;
        try {
            com.google.ar.core.Anchor nueva = pl.createAnchor(pl.getCenterPose());
            float[] m = new float[16];
            nueva.getPose().toMatrix(m, 0);
            seg.nuevaAncla(m);
            if (anclaAr != null) anclaAr.detach();
            anclaAr = nueva;
            anclaEsMesa = true;
        } catch (Throwable e) { /* queda el ancla de antes */ }
        // la onda: donde la mirada corta la mesa (o el centro)
        float[] l = new float[3];
        if (adeW[1] < -0.05f) {
            float tt = (mesaNum.pose[13] - cabW[1]) / adeW[1];
            mesaNum.aLocal(cabW[0] + adeW[0] * tt, mesaNum.pose[13], cabW[2] + adeW[2] * tt, l);
            ondaMesa[0] = l[0]; ondaMesa[1] = l[2];
        } else { mesaNum.centroLocal(ondaMesa); }
        ondaDesde = ahora;
        // la etiqueta, apoyada cerca del borde de tu lado, de frente a vos
        float[] q = new float[3];
        Mesa.puntoAdelante(mesaNum, cabW, adeW, 0.6f, q);   // más allá de las manos y de la barra
        float fl = (float) Math.hypot(adeW[0], adeW[2]);
        float fx = fl > 1e-3f ? adeW[0] / fl : 0, fz = fl > 1e-3f ? adeW[2] / fl : -1;
        float ancho = 0.2f, alto = ancho * Etiqueta.H / Etiqueta.W;
        etqC[0] = q[0]; etqC[1] = q[1] + 0.004f; etqC[2] = q[2];
        etqR[0] = -fz * ancho; etqR[1] = 0; etqR[2] = fx * ancho;
        etqU[0] = fx * alto; etqU[1] = 0; etqU[2] = fz * alto;
        sonido.tocar(Sonido.LOGRO);
        vibrar();
    }

    /** MANOS: las guías sobre la mesa; cada mano que se apoya en la suya da muestras de su tamaño. */
    private void manosEnMesa(Inicio in, long ahora, float[] cabW, float[] adeW) {
        if (manos == null) { in.saltar(ahora); return; }   // sin hand tracking: este paso no va
        if (!hayMesa || !manos.anda) { in.manos(false, false, Float.NaN, Float.NaN, ahora); return; }
        if (!hayGuias) colocarGuias(cabW, adeW);
        boolean[] sobre = new boolean[2];
        float[] esc = {Float.NaN, Float.NaN};
        synchronized (manos.enMesa) {
            for (int s = 0; s < 2; s++) {
                long h = manos.enMesaHora[s];
                if (ahora - h > 250) continue;
                float[] w = manos.enMesa[s];
                float[] mu = {w[0], w[1], w[2]}, nu = {w[3], w[4], w[5]};
                for (int g = 0; g < 2; g++) {
                    if (Seguimiento.dist(mu, guias[g][0]) < 0.08f && Seguimiento.dist(nu, guias[g][9]) < 0.08f) {
                        sobre[g] = true;
                        // una muestra por imagen nueva de la red (no una por cuadro de dibujo)
                        if (h != vistoMesa[s]) { esc[g] = manos.escalaMesa[s]; vistoMesa[s] = h; }
                    }
                }
            }
        }
        if (sobre[0] && !guiaSobre[0] || sobre[1] && !guiaSobre[1]) sonido.tocar(Sonido.TIC);
        guiaSobre[0] = sobre[0]; guiaSobre[1] = sobre[1];
        in.manos(sobre[0], sobre[1], esc[0], esc[1], ahora);
        if (in.paso != Inicio.MANOS) {
            manos.mesaCal = null;
            if (in.escala == in.escala) { manos.escala(in.escala); cambio("escalaMano", Math.round(in.escala * 1000)); }
            sonido.tocar(Sonido.LOGRO);
        }
    }

    /** Las manos de guía sobre la mesa, delante tuyo (en el escritorio), y la mesa para medir. */
    private void colocarGuias(float[] cabW, float[] adeW) {
        float[] q = new float[3];
        Mesa.puntoAdelante(mesaNum, cabW, adeW, 0.34f, q);
        seg.puntoAEscritorio(q);
        float[] n = new float[3], nd = new float[4];
        mesaNum.normal(n);
        Matrix.multiplyMV(nd, 0, desdeMundo, 0, new float[]{n[0], n[1], n[2], 0}, 0);
        float[] arriba = {nd[0], nd[1], nd[2]};
        Mesa.manosGuia(q, adelante, arriba, guias);
        hayGuias = true;
        if (manos != null) manos.mesaCal = new float[]{q[0], q[1], q[2], arriba[0], arriba[1], arriba[2]};
    }

    /** CABEZA: las pantallas delante de donde quedó mirando; la barra, a la mesa. */
    private void fijarCabeza(Inicio in) {
        escritorio.recentrar(cabeza[0], cabeza[1], cabeza[2], yawDe(adelante));
        if (seg.modo == Seguimiento.SEIS && !anclaEsMesa) anclar();
        if (in.modo == Inicio.MESA && hayMesa) ponerBarraEnMesa();
        sonido.tocar(Sonido.ABRIR);
    }

    /** Terminó el inicio ("Empezar"): cómo quedó, la barra, y las apps. */
    private void terminarInicio(Inicio in) {
        inicio = null;
        int m = in.modo;
        if (m == Inicio.MESA && !hayMesa) m = Inicio.GIRAR;
        modoEspacio = m;
        if (manos != null) manos.mesaCal = null;
        for (Ventana v : new ArrayList<>(escritorio.ventanas)) if (v.app.equals("inicio")) cerrarVentana(v);
        if (m == Inicio.MESA) ponerBarraEnMesa();
        if (escritorio.dock != null) { escritorio.dock.visible = true; escritorio.acomodar(escritorio.dock); escritorio.dock.aparece = 0; }
        if (vistos.tutorial == 0) abrirEnGl("bienvenida");
        abrirEnGl("biblioteca");
        mesaVista.vista = true;
        avisar(m == Inicio.MESA ? "Listo: Nexo se mueve sólo cuando ve tu mesa. La barra de abajo está apoyada en la mesa."
                : m == Inicio.CUARTO ? "Listo: Nexo se mueve cuando reconoce el cuarto." : "Listo: la cabeza queda fija, sólo girás.");
    }

    /** La barra de abajo apoyada en la mesa, delante tuyo (si está la opción). */
    private void ponerBarraEnMesa() {
        if (!hayMesa || vistos.barraEnMesa == 0) escritorio.mesa = null;
        else {
            float[] q = new float[3];
            Mesa.puntoAdelante(mesaNum, new float[]{wDisplay[12], wDisplay[13], wDisplay[14]}, new float[]{-wDisplay[8], -wDisplay[9], -wDisplay[10]}, 0.36f, q);
            seg.puntoAEscritorio(q);
            escritorio.mesa = q;
        }
        if (escritorio.dock != null) escritorio.acomodar(escritorio.dock);
    }

    /** Lo que se escanea y tu mesa marcada (después del fondo, antes de las ventanas). */
    private void dibujarEspacio(float[] vpO, float t, long ahora) {
        Inicio in = inicio;
        try {
            if (in != null && in.paso == Inicio.ESCANEAR) {
                for (Mesa.Plano p : planosNum) {
                    int tipo = in.modo == Inicio.CUARTO ? SuperficiesGl.CUARTO : p.id == in.candidata ? SuperficiesGl.CANDIDATA : SuperficiesGl.OTRO;
                    superficies.plano(p, tipo, vpO, desdeMundo, 1, t, null);
                }
                superficies.puntos(nube, nubeN, vpO, desdeMundo, 0.9f, t, alto / 150f);
            }
            boolean mesa = hayMesa && (in != null ? in.paso > Inicio.ESCANEAR && in.modo == Inicio.MESA : modoEspacio == Inicio.MESA && vistos.verMesa == 1);
            if (mesa) {
                float[] onda = null;
                if (ondaDesde >= 0) {
                    float r = (ahora - ondaDesde) / 1000f * 0.9f;
                    if (r < 1.8f) onda = new float[]{ondaMesa[0], ondaMesa[1], r};
                    else ondaDesde = -1;
                }
                float alfa = in != null ? 1 : mesaVista.vista ? 0.5f : 0.22f;
                superficies.plano(mesaNum, SuperficiesGl.MESA, vpO, desdeMundo, alfa, t, onda);
                if (etiquetaMesa == 0) etiquetaMesa = Etiqueta.crear("Tu mesa", "Nexo se mueve cuando la ve", 0xFFFFD27A);
                superficies.etiqueta(etiquetaMesa, etqC, etqR, etqU, vpO, desdeMundo, in != null ? 1 : 0.6f * alfa + 0.2f);
            }
        } catch (Throwable e) {
            Fallo.guardar("dibujar el espacio", e);
        }
    }

    /** Las manos de guía (MANOS) y la retícula que se llena (CABEZA). */
    private void dibujarGuias(float[] vista, float[] proy, float t) {
        Inicio in = inicio;
        if (in == null) return;
        if (in.paso == Inicio.MANOS && hayGuias) {
            float[] c0 = manosGl.color, b0 = manosGl.borde;
            float pulso = 0.5f + 0.5f * (float) Math.sin(t * 3.5f);
            for (int g = 0; g < 2; g++) {
                manosGl.color = guiaSobre[g] ? GUIA_OK : GUIA;
                manosGl.borde = guiaSobre[g] ? GUIA_OK : GUIA_BORDE;
                manosGl.fantasma = 1f;
                manosGl.vidrio(vista, proy, new float[][][]{guias[g]}, new float[]{0.55f + 0.35f * pulso}, new float[]{guiaSobre[g] ? 1 : pulso * 0.6f}, 1);
            }
            manosGl.color = c0; manosGl.borde = b0;
        }
        if (in.paso == Inicio.CABEZA) {
            if (reticula == null) reticula = new Ventana(0, Ventana.AVISO, "reticula", 0.5f, 100, 100);
            float d = 1.2f;
            reticula.cx = ojoEste[0] + adelante[0] * d; reticula.cy = ojoEste[1] + adelante[1] * d; reticula.cz = ojoEste[2] + adelante[2] * d;
            reticula.mirarA(ojoEste[0], ojoEste[1], ojoEste[2]);
            GLES20.glDisable(GLES20.GL_DEPTH_TEST);
            vgl.empezar(vpOjo);
            vgl.cursor(reticula, 0, 0, d / 0.022f * 0.07f, 1, Math.max(0.02f, in.progreso), false);
            vgl.terminar();
            GLES20.glEnable(GLES20.GL_DEPTH_TEST);
        }
    }

    /** El primer cuadro con posición: se arma el escritorio delante tuyo. */
    private void armarEscritorio() {
        armado = true;
        escritorio.recentrar(cabeza[0], cabeza[1], cabeza[2], yawDe(adelante));
        long ahora = SystemClock.elapsedRealtime();
        Ventana d = escritorio.ponerDock(1400, 170, 0.66f, ahora);
        crearPanel(d, c -> dock.crear(c, this));
        Ventana r = escritorio.ponerRapidos(1040, 760, 0.52f, ahora);
        crearPanel(r, c -> rapidos.crear(c, this));
        Ventana k = escritorio.ponerTeclado(1400, 460, 0.7f, ahora);
        crearPanel(k, c -> teclado.crear(c, this));
        // con la cámara: primero preparar el espacio (Nexo Inicio); después, las apps
        if (conArcore && vistos.prepararEspacio == 1) empezarInicio();
        else {
            if (vistos.tutorial == 0) abrirEnGl("bienvenida");
            abrirEnGl("biblioteca");
        }
        if (pendiente != null) { abrirEnGl(pendiente); pendiente = null; }
    }

    private void crearPanel(Ventana v, PanelVirtual.Fabrica f) {
        PanelVirtual p = new PanelVirtual(this, v, f, DPI);
        p.crearGl();
        paneles.put(v, p);
    }

    private void recentrarEnGl() {
        escritorio.recentrar(cabeza[0], cabeza[1], cabeza[2], yawDe(adelante));
        if (seg.modo == Seguimiento.SEIS && !anclaEsMesa) anclar();
        if (modoEspacio == Inicio.MESA) ponerBarraEnMesa();
        if (escritorio.dock != null && inicio == null) escritorio.dock.visible = true;
        sonido.tocar(Sonido.ABRIR);
    }

    private static float yawDe(float[] f) { return (float) Math.atan2(-f[0], -f[2]); }

    // ── lo que llega del puntero ──

    @Override public void toque(Ventana v, int accion, float u, float w, int fuente) {
        PanelVirtual p = paneles.get(v);
        if (p != null) p.tocar(accion, u, w);
        if (accion == Puntero.BAJA && fuente != Puntero.PANTALLA) vibrar();
    }

    @Override public void boton(Ventana v, int que) {
        sonido.tocar(Sonido.CLIC);
        if (que == Ventana.CERRAR) cerrarVentana(v);
        else if (que == Ventana.AMPLIAR) escritorio.cine(v, !v.cine);
    }

    @Override public void enLaNada(int fuente, boolean largo) {
        if (largo) recentrarEnGl();
        else if (escritorio.dock != null) {
            if (escritorio.rapidos != null && escritorio.rapidos.visible) escritorio.rapidos.visible = false;
            else { escritorio.dock.visible = !escritorio.dock.visible; if (escritorio.dock.visible) { escritorio.acomodar(escritorio.dock); escritorio.dock.aparece = 0; } }
            sonido.tocar(Sonido.CLIC);
        }
    }

    private void vibrar() { }

    // ───────────────────────── el dibujo ─────────────────────────

    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig c) {
        GLES20.glClearColor(0, 0, 0, 1);
        try {
            fondo.crear();
            entornos.crear();
            vgl.crear();
            lentes.crear();
            manosGl.crear();
            superficies.crear();
        } catch (Throwable e) {
            errorGl = e;
            Fallo.guardar("OpenGL", e);
            avisar("Tu teléfono no pudo preparar los gráficos: " + e.getMessage());
            return;
        }
        texturaPuesta = false;
        etiquetaMesa = 0;   // se perdió con el contexto
        for (PanelVirtual p : paneles.values()) p.crearGl();   // se perdió el contexto: todas las texturas de nuevo
        arrancoEn = SystemClock.elapsedRealtime();
    }

    @Override
    public void onSurfaceChanged(GL10 gl, int w, int h) {
        ancho = w; alto = h; geometria = true;
        rotacion = getWindowManager().getDefaultDisplay().getRotation();
    }

    @Override
    public void onDrawFrame(GL10 gl) {
        if (errorGl != null) { GLES20.glClearColor(0.15f, 0, 0, 1); GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT); return; }
        try { cuadro(); } catch (Throwable e) { errorGl = e; Fallo.guardar("dibujo", e); avisar("Error dibujando: " + e); }
    }

    private void cuadro() {
        long ahora = SystemClock.elapsedRealtime();
        float t = (ahora - t0) / 1000f, dt = ultimoCuadro == 0 ? 0 : Math.min(0.1f, (ahora - ultimoCuadro) / 1000f);
        ultimoCuadro = ahora;
        Ajustes a = vistos;
        for (Runnable r; (r = tareas.poll()) != null; ) r.run();

        // ── el seguimiento: ARCore (la cabeza + la cámara) o los sensores ──
        boolean sigue = false;
        Frame cuadro = null;
        Camera camara = null;
        if (sesion != null && conArcore) {
            if (!texturaPuesta) { sesion.setCameraTextureName(fondo.textura()); texturaPuesta = true; geometria = true; }
            try {
                if (geometria) { sesion.setDisplayGeometry(getWindowManager().getDefaultDisplay().getRotation(), ancho, alto); geometria = false; }
                cuadro = sesion.update();
                camara = cuadro.getCamera();
                fondo.actualizar(cuadro);
                sigue = camara.getTrackingState() == TrackingState.TRACKING;
            } catch (Exception e) { cuadro = null; }
        }
        // Nexo Track: la pose de la foto → el escritorio (el ancla) → hasta cuando se ve (el giroscopio)
        boolean rastrea = sigue, fotoNueva = false;
        sigue = false;
        if (cuadro != null) {
            long tFoto = aBoot(cuadro.getTimestamp());
            fotoNueva = tFoto != ultimaFoto;
            edadFotoMs = (SystemClock.elapsedRealtimeNanos() - tFoto) / 1e6f;
            ultimaFoto = tFoto;
            if (rastrea) {
                cuadro.getAndroidSensorPose().toMatrix(wSensor, 0);
                camara.getDisplayOrientedPose().toMatrix(wDisplay, 0);
            }
            fallaSeguimiento = rastrea ? null : nombreFalla(camara.getTrackingFailureReason());
            if (anclaAr != null) {
                TrackingState ea = anclaAr.getTrackingState();
                if (ea == TrackingState.TRACKING) { anclaAr.getPose().toMatrix(anclaM, 0); seg.ancla(anclaM, dt); }
                else if (ea == TrackingState.STOPPED) anclaAr = null;
            }
            boolean sbs = a.sbs == 1;
            // en el teléfono con la cámara, lo que se ve ES la foto: ahí no se predice
            boolean predecir = (sbs || entorno != Entornos.PASSTHROUGH) && seg.hayGiro();
            float[] o = ojosAhora(a);
            if (sbs) { seg.pivote[0] = o[0]; seg.pivote[1] = o[1] - Cuello.OJO_Y; seg.pivote[2] = o[2] - Cuello.OJO_Z; }
            else { seg.pivote[0] = 0; seg.pivote[1] = 0; seg.pivote[2] = 0; }
            long tVer = predecir ? SystemClock.elapsedRealtimeNanos() + a.anticipo * 1_000_000L : tFoto;
            sigue = seg.cuadro(tFoto, rastrea, wSensor, wDisplay, tVer);
            if (sigue) {
                if (sbs) Seguimiento.ojos(seg.pose, o[0], o[1], o[2], poseOjos);
                else System.arraycopy(seg.pose, 0, poseOjos, 0, 16);
                Seguimiento.invRigida(poseOjos, vistaM);
                cabeza[0] = poseOjos[12]; cabeza[1] = poseOjos[13]; cabeza[2] = poseOjos[14];
                adelante[0] = -poseOjos[8]; adelante[1] = -poseOjos[9]; adelante[2] = -poseOjos[10];
                System.arraycopy(seg.poseFoto, 0, poseCam, 0, 16);
                camara.getProjectionMatrix(proyCam, 0, 0.05f, 200f);
                if (rastrea && (Float.isNaN(piso) || ((ahora / 500) % 4 == 0))) buscarPiso();
                // los ojos, solos: con las poses de ARCore tal cual (las fotos), mientras girás la cabeza en el visor
                if (sbs && rastrea && fotoNueva && a.ojoAuto == 1) {
                    cuello.pose(tFoto / 1_000_000L, seg.poseFoto);
                    if (ahora - medidoCuello > 1000) { medidoCuello = ahora; if (cuello.medir()) guardarOjos(); }
                }
            }
            if (armado && rastrea && anclaAr == null) anclar();
            if (sigue) espacio(cuadro, camara, rastrea, ahora, dt, a);
            avisarPerdida(ahora);
        }
        if (!sigue && !conArcore && hayRotSensor) {
            // sin ARCore: la cabeza quieta a 1.6 m, girando
            synchronized (rotSensor) { System.arraycopy(rotSensor, 0, vistaM, 0, 16); }
            Matrix.translateM(vistaM, 0, 0, -1.6f, 0);
            Matrix.invertM(poseCam, 0, vistaM, 0);
            cabeza[0] = 0; cabeza[1] = 1.6f; cabeza[2] = 0;
            adelante[0] = -poseCam[8]; adelante[1] = -poseCam[9]; adelante[2] = -poseCam[10];
            Matrix.perspectiveM(proyCam, 0, 60, ancho / (float) alto, 0.05f, 200f);
            sigue = true;
        }
        if (sigue && !armado) armarEscritorio();
        if (Float.isNaN(piso) && sigue) piso = cabeza[1] - 1.5f;

        // ── las manos ──
        boolean conManos = manos != null && manos.anda && cuadro != null && a.manos == 1;
        if (conManos && manos.libre() && sigue) darMano(cuadro, camara, ahora);
        leerManos(ahora, dt, conManos, a);
        if (diag.grabando) {
            diag.cuadro(ahora, seg.modo, rastrea, fallaSeguimiento, seg.demoraMs, rastrea ? wDisplay : null, sigue ? poseOjos : null,
                    seg.correccionCm, seg.correccionGrados, seg.velocidad(), fotoNueva, conManos ? manos.manos : null, pellizcaAhora);
            if (diag.termino(ahora)) {
                diag.grabando = false;
                new Thread(() -> { String donde = diag.terminar(this); avisar(donde != null ? "Diagnóstico guardado en " + donde + ": mandámelo." : "No se pudo guardar el diagnóstico."); }, "diagnostico").start();
            }
        }

        // ── la mirada, la pantalla, el control ──
        Puntero.Fuente mir = puntero.fuentes[Puntero.MIRADA];
        mir.activa = sigue && armado;
        mir.ox = cabeza[0]; mir.oy = cabeza[1]; mir.oz = cabeza[2];
        mir.dx = adelante[0]; mir.dy = adelante[1]; mir.dz = adelante[2];
        mir.aprieta = gatilloControl;
        Puntero.Fuente pan = puntero.fuentes[Puntero.PANTALLA];
        pan.activa = sigue && armado && a.sbs == 0 && (tocando || pan.apretado);
        if (pan.activa) rayoDePantalla(toqueX, toqueY, pan);
        pan.aprieta = tocando;
        puntero.clicConMirada = a.mirada == 1 && a.sbs == 1;
        puntero.conDedo = a.dedo == 1;
        if (armado) puntero.paso(escritorio, dt, ahora, cabeza[0], cabeza[1], cabeza[2], this);
        // el joystick del control: scroll de lo que mira
        if (rodar != 0 && mir.sobre != null && mir.que == Ventana.CONTENIDO) { PanelVirtual p = paneles.get(mir.sobre); if (p != null) p.rodar(mir.u, mir.v, rodar * dt * 12); }
        sonidosDeHover();

        // ── las pantallas: imágenes nuevas, el teclado solo, las animaciones ──
        for (PanelVirtual p : paneles.values()) p.actualizar();
        panelFoco = escritorio.enfocada != null ? paneles.get(escritorio.enfocada) : null;
        boolean escribe = panelFoco != null && panelFoco.escribiendo;
        if (escribe && !escribiaAntes) escritorio.mostrarTeclado(true);
        if (!escribe && escribiaAntes) dejoDeEscribir = ahora;
        if (!escribe && dejoDeEscribir > 0 && ahora - dejoDeEscribir > 900) { escritorio.mostrarTeclado(false); dejoDeEscribir = 0; }
        escribiaAntes = escribe;
        for (Ventana v : escritorio.ventanas) v.aparece = Math.min(1, v.aparece + dt * 5);
        // el entorno: fundido al cambiar; más oscuro en el modo cine
        int e = entorno;
        if (e != entornoDibujado) { fundido = Math.max(0, fundido - dt * 4); if (fundido == 0) entornoDibujado = e; }
        else fundido = Math.min(1, fundido + dt * 3);
        float luzQuiere = escritorio.enCine() != null ? 0.35f : 1f;
        luz += (luzQuiere - luz) * Math.min(1, dt * 3);

        // ── dibujar ──
        boolean sbs = a.sbs == 1;
        boolean conLentes = sbs && a.corregirLentes == 1;
        if (sbs) acomodarOjos(a);
        if (conLentes) lentes.empezar(ancho, alto);
        GLES20.glViewport(0, 0, ancho, alto);
        GLES20.glClearColor(0, 0, 0, 1);
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        int nOjos = sbs ? 2 : 1;
        if (sbs) GLES20.glEnable(GLES20.GL_SCISSOR_TEST);
        for (int o = 0; o < nOjos; o++) {
            float lado = sbs ? (o == 0 ? -1 : 1) : 0;
            if (sbs) {
                GLES20.glScissor((int) ojos[o][0], 0, (int) (ojos[o][2] - ojos[o][0]), alto);
                GLES20.glViewport(vistaOjos[o][0], vistaOjos[o][1], vistaOjos[o][2], vistaOjos[o][3]);
                GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
                Matrix.perspectiveM(proy, 0, a.fov, vistaOjos[o][2] / (float) vistaOjos[o][3], 0.05f, 200f);
            } else System.arraycopy(proyCam, 0, proy, 0, 16);
            Matrix.setIdentityM(desplazar, 0);
            Matrix.translateM(desplazar, 0, -lado * a.ipdMm / 2000f, 0, 0);
            Matrix.multiplyMM(vistaOjo, 0, desplazar, 0, vistaM, 0);
            Matrix.multiplyMM(vpOjo, 0, proy, 0, vistaOjo, 0);
            // dónde está este ojo
            float[] inv = new float[16];
            Matrix.invertM(inv, 0, vistaOjo, 0);
            ojoEste[0] = inv[12]; ojoEste[1] = inv[13]; ojoEste[2] = inv[14];
            if (!sigue) { dibujarArranque(t); continue; }
            dibujarMundo(vpOjo, t, sbs);
            if (conArcore) dibujarEspacio(vpOjo, t, ahora);
            dibujarVentanas(vpOjo, t, ahora);
            if (a.verManos == 1 && conManos) {
                manosGl.fantasma = 1f;
                manosGl.vidrio(vistaOjo, proy, puntosMano, alfaMano, brilloMano, 2);
            }
            dibujarGuias(vistaOjo, proy, t);
            if (ahora - arrancoEn < 2600) dibujarArranque(t);
        }
        if (sbs) GLES20.glDisable(GLES20.GL_SCISSOR_TEST);
        if (conLentes) lentes.terminar(ancho, alto, ojos, a.k1 / 100f, a.k2 / 100f);
        if (pedirCaptura) { pedirCaptura = false; capturar(); }
    }

    private void acomodarOjos(Ajustes a) {
        int mitad = ancho / 2;
        float sep = a.ipdMm / 25.4f * xdpi;
        float tt = a.tamano / 100f;
        int ew = Math.round(mitad * tt), eh = Math.round(alto * tt);
        for (int o = 0; o < 2; o++) {
            float cx = ancho / 2f + (o == 0 ? -sep / 2 : sep / 2), cy = alto / 2f;
            vistaOjos[o][0] = Math.round(cx - ew / 2f);
            vistaOjos[o][1] = Math.round(cy - eh / 2f);
            vistaOjos[o][2] = ew;
            vistaOjos[o][3] = eh;
            ojos[o][0] = o == 0 ? 0 : mitad; ojos[o][1] = 0; ojos[o][2] = o == 0 ? mitad : ancho; ojos[o][3] = alto;
            ojos[o][4] = cx; ojos[o][5] = cy;
        }
    }

    /** El fondo: la cámara (passthrough) o el entorno 3D, con el fundido al cambiar. */
    private void dibujarMundo(float[] vpO, float t, boolean sbs) {
        int e = entornoDibujado < 0 ? entorno : entornoDibujado;
        if (e == Entornos.PASSTHROUGH && !conArcore) e = ultimoVirtual;   // sin cámara no hay passthrough
        float f = fundido * luz;
        if (e == Entornos.PASSTHROUGH) {
            // la imagen de la cámara en el mundo, a 8 m, de su tamaño justo (en el visor, cada ojo con su proyección)
            fondo.dibujarEnMundo(vpO, poseCam, proyCam, 8f, f);
        } else {
            float pisoY = Float.isNaN(piso) ? cabeza[1] - 1.5f : piso;
            entornos.dibujar(e, vpO, ojoEste, t, pisoY, escritorio.ax, escritorio.az, f);
        }
    }

    private final ArrayList<Ventana> orden = new ArrayList<>();

    private void dibujarVentanas(float[] vpO, float t, long ahora) {
        orden.clear();
        for (Ventana v : escritorio.ventanas) if (v.visible) orden.add(v);
        // de lejos a cerca (las transparencias)
        orden.sort((x, y) -> Float.compare(dist2(y), dist2(x)));
        vgl.empezar(vpO);
        for (Ventana v : orden) {
            PanelVirtual p = paneles.get(v);
            float hover = 0, hb = 0, hc = 0, ha = 0, cerca = 0;
            for (Puntero.Fuente f : puntero.fuentes) {
                if (!f.activa || f.sobre != v) continue;
                if (f.que == Ventana.CONTENIDO) hover = Math.max(hover, 1);
                if (f.que == Ventana.BARRA) hb = 1;
                if (f.que == Ventana.CERRAR) hc = 1;
                if (f.que == Ventana.AMPLIAR) ha = 1;
                cerca = 1;
            }
            if (v.tipo != Ventana.APP) hover *= 0.5f;
            float alfa = v.aparece;
            vgl.ventana(v, p == null ? 0 : p.textura(), p != null && p.tieneImagen, hover, alfa, t);
            vgl.barra(v, hb, hc, ha, cerca, alfa);
        }
        // los cursores y los rayos
        for (int k = 0; k < puntero.fuentes.length; k++) {
            Puntero.Fuente f = puntero.fuentes[k];
            if (!f.activa) continue;
            boolean mano = k == Puntero.MANO_IZQ || k == Puntero.MANO_DER;
            if (k == Puntero.MIRADA && (puntero.fuentes[0].activa || puntero.fuentes[1].activa) && !f.apretado && f.carga == 0) continue;   // con manos, la mirada no muestra cursor
            if (k == Puntero.PANTALLA) continue;
            if (f.sobre != null && f.que != Ventana.NADA) {
                float[] uv = new float[2];
                f.sobre.distancia(f.hx, f.hy, f.hz, uv);
                float x = (uv[0] - 0.5f) * f.sobre.ancho, y = (0.5f - uv[1]) * f.sobre.alto;
                float fuerza = mano ? gestos[k].fuerza : f.apretado ? 0.2f : 1f;
                vgl.cursor(f.sobre, x, y, Math.max(0.3f, f.dist), f.tocando ? 0.2f : fuerza, k == Puntero.MIRADA ? f.carga : 0, f.dedoCerca || f.tocando);
                if (mano && !f.dedoCerca && !f.tocando) vgl.rayo(f.ox + f.dx * 0.08f, f.oy + f.dy * 0.08f, f.oz + f.dz * 0.08f, f.hx, f.hy, f.hz, ojoEste, 1, f.apretado);
            } else if (mano && !f.dedoCerca) {
                vgl.rayo(f.ox + f.dx * 0.08f, f.oy + f.dy * 0.08f, f.oz + f.dz * 0.08f, f.ox + f.dx * 0.9f, f.oy + f.dy * 0.9f, f.oz + f.dz * 0.9f, ojoEste, 0.6f, f.apretado);
            }
        }
        vgl.terminar();
    }

    private float dist2(Ventana v) {
        float x = v.cx - cabeza[0], y = v.cy - cabeza[1], z = v.cz - cabeza[2];
        return x * x + y * y + z * z;
    }

    // el arranque: el anillo que se abre, en el centro de la vista
    private Ventana logo;

    private void dibujarArranque(float t) {
        float s = (SystemClock.elapsedRealtime() - arrancoEn) / 1000f;
        float a = s < 0.3f ? s / 0.3f : s > 2.0f ? Math.max(0, 1 - (s - 2.0f) / 0.6f) : 1;
        if (!armado) a = 1;
        if (a <= 0) return;
        if (logo == null) logo = new Ventana(0, Ventana.AVISO, "logo", 0.5f, 100, 100);
        logo.cx = ojoEste[0] + adelante[0] * 1.6f; logo.cy = ojoEste[1] + adelante[1] * 1.6f; logo.cz = ojoEste[2] + adelante[2] * 1.6f;
        logo.mirarA(ojoEste[0], ojoEste[1], ojoEste[2]);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        vgl.empezar(vpOjo);
        vgl.cursor(logo, 0, 0, 1.6f / 0.022f * 0.25f * (0.8f + 0.2f * Math.min(1, s)), 1 - Math.min(1, s * 0.8f), Math.min(1, s / 1.8f), false);
        vgl.terminar();
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }

    /** El piso: el plano horizontal más bajo que vio ARCore (si está a más de 60 cm debajo tuyo). */
    private void buscarPiso() {
        if (sesion == null) return;
        float mejor = Float.NaN;
        for (Plane p : sesion.getAllTrackables(Plane.class)) {
            if (p.getTrackingState() != TrackingState.TRACKING || p.getType() != Plane.Type.HORIZONTAL_UPWARD_FACING) continue;
            Pose c = p.getCenterPose();
            float[] pt = {c.tx(), c.ty(), c.tz()};
            seg.puntoAEscritorio(pt);
            float y = pt[1];
            if (y < cabeza[1] - 0.6f && (mejor != mejor || y < mejor)) mejor = y;
        }
        if (mejor == mejor) piso = mejor;
    }

    /** El rayo del dedo en la pantalla del teléfono: de la cámara por ese píxel. */
    private void rayoDePantalla(float x, float y, Puntero.Fuente f) {
        Matrix.multiplyMM(vp, 0, proyCam, 0, vistaM, 0);
        float[] inv = new float[16];
        if (!Matrix.invertM(inv, 0, vp, 0)) return;
        float nx = 2 * x / ancho - 1, ny = 1 - 2 * y / alto;
        float[] c = {nx, ny, -1, 1}, l = {nx, ny, 1, 1}, a = new float[4], b = new float[4];
        Matrix.multiplyMV(a, 0, inv, 0, c, 0);
        Matrix.multiplyMV(b, 0, inv, 0, l, 0);
        float ax = a[0] / a[3], ay = a[1] / a[3], az = a[2] / a[3];
        float dx = b[0] / b[3] - ax, dy = b[1] / b[3] - ay, dz = b[2] / b[3] - az, dl = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        f.ox = ax; f.oy = ay; f.oz = az; f.dx = dx / dl; f.dy = dy / dl; f.dz = dz / dl;
    }

    private void sonidosDeHover() {
        for (int k = 0; k < puntero.fuentes.length; k++) {
            Puntero.Fuente f = puntero.fuentes[k];
            boolean boton = f.sobre != null && (f.que == Ventana.CERRAR || f.que == Ventana.AMPLIAR || f.que == Ventana.BARRA);
            if (boton && (f.sobre != sobreAntes[k] || f.que != queAntes[k])) sonido.tocar(Sonido.TIC);
            sobreAntes[k] = f.sobre;
            queAntes[k] = f.que;
        }
    }

    // ── las manos: la imagen de la cámara → MediaPipe → el rayo, el pellizco, el dedo ──

    private void darMano(Frame cuadro, Camera camara, long ahora) {
        Image img = null, prof = null;
        try {
            img = cuadro.acquireCameraImage();
            CameraIntrinsics in = camara.getImageIntrinsics();
            float[] f = in.getFocalLength(), c = in.getPrincipalPoint();
            int[] dim = in.getImageDimensions();
            float kx = img.getWidth() / (float) dim[0], ky = img.getHeight() / (float) dim[1];
            { float[] w = new float[16]; camara.getPose().toMatrix(w, 0); seg.aEscritorio(w, poseMano); }
            short[] pd = null;
            int pw = 0, ph = 0;
            try {
                prof = cuadro.acquireDepthImage16Bits();
                pw = prof.getWidth(); ph = prof.getHeight();
                Image.Plane pl = prof.getPlanes()[0];
                java.nio.ShortBuffer sb = pl.getBuffer().order(ByteOrder.LITTLE_ENDIAN).asShortBuffer();
                int fila = pl.getRowStride() / 2;
                if (profMano.length != pw * ph) profMano = new short[pw * ph];
                for (int v = 0; v < ph; v++) { sb.position(v * fila); sb.get(profMano, v * pw, pw); }
                pd = profMano;
                float[] ent = {0, 0, 1, 0, 0, 1}, sal = new float[6];
                cuadro.transformCoordinates2d(com.google.ar.core.Coordinates2d.IMAGE_NORMALIZED, ent, com.google.ar.core.Coordinates2d.TEXTURE_NORMALIZED, sal);
                imagenAProf[0] = sal[0]; imagenAProf[1] = sal[2] - sal[0]; imagenAProf[2] = sal[4] - sal[0];
                imagenAProf[3] = sal[1]; imagenAProf[4] = sal[3] - sal[1]; imagenAProf[5] = sal[5] - sal[1];
            } catch (Exception e) { pd = null; }
            boolean girada = getWindowManager().getDefaultDisplay().getRotation() == android.view.Surface.ROTATION_270;
            long tFoto = cuadro.getTimestamp() / 1_000_000L;
            if (Math.abs(ahora - tFoto) > 500) tFoto = ahora;
            manos.dejar(img, f[0] * kx, f[1] * ky, c[0] * kx, c[1] * ky, poseMano, girada, tFoto, pd, pw, ph, imagenAProf);
        } catch (NotYetAvailableException e) {
            // todavía no
        } catch (Exception e) {
            // se saltea
        } finally {
            if (img != null) img.close();
            if (prof != null) prof.close();
        }
    }

    private void leerManos(long ahora, float dt, boolean conManos, Ajustes a) {
        for (int s = 0; s < 2; s++) {
            Puntero.Fuente f = puntero.fuentes[s];
            if (!conManos) { f.activa = false; alfaMano[s] = 0; continue; }
            Mano m = manos.manos[s];
            synchronized (m) {
                m.salida(ahora, dt);
                alfaMano[s] = m.filtro.alfa;
                boolean ve = m.hay && m.filtro.visible;
                if (m.filtro.alfa > 0) for (int i = 0; i < 21; i++) System.arraycopy(m.mundo[i], 0, puntosMano[s][i], 0, 3);
                f.activa = ve && armado;
                if (!ve) { gestos[s].soltar(); continue; }
                boolean pellizca = gestos[s].paso(m.mundo);
                pellizcaAhora[s] = pellizca;
                brilloMano[s] += ((pellizca ? 1f : 0f) - brilloMano[s]) * Math.min(1, dt * 18);
                // el rayo: del punto de mira (debajo de la vista) por los nudillos
                float[] q = new float[3];
                Gestos.puntoRayo(m.mundo, q);
                // (en el visor la cabeza ya es el punto entre los ojos: Nexo Track los corre desde la cámara)
                float abajo = a.apuntarAbajo / 100f * (a.sbs == 1 ? 0.6f : 1f);
                float ox = cabeza[0], oy = cabeza[1] - abajo, oz = cabeza[2];
                float dx = q[0] - ox, dy = q[1] - oy, dz = q[2] - oz, dl = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dl < 0.05f) { f.activa = false; continue; }
                f.ox = q[0]; f.oy = q[1]; f.oz = q[2];   // el rayo sale de la mano (se ve salir de ahí)
                f.dx = dx / dl; f.dy = dy / dl; f.dz = dz / dl;
                f.aprieta = pellizca;
                f.conDedo = Gestos.indiceEstirado(m.mundo) && !pellizca;
                f.tx = m.mundo[8][0]; f.ty = m.mundo[8][1]; f.tz = m.mundo[8][2];
            }
        }
    }

    // ── la captura: lo que se ve, a la galería ──

    private void capturar() {
        int w = ancho, h = alto;
        ByteBuffer b = ByteBuffer.allocateDirect(w * h * 4).order(ByteOrder.nativeOrder());
        GLES20.glReadPixels(0, 0, w, h, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, b);
        sonido.tocar(Sonido.CAPTURA);
        new Thread(() -> {
            try {
                int[] px = new int[w * h];
                b.position(0);
                for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
                    int r = b.get() & 0xFF, g = b.get() & 0xFF, bl = b.get() & 0xFF;
                    b.get();
                    px[(h - 1 - y) * w + x] = 0xFF000000 | (r << 16) | (g << 8) | bl;
                }
                Bitmap bm = Bitmap.createBitmap(px, w, h, Bitmap.Config.ARGB_8888);
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, "Nexo_" + System.currentTimeMillis() + ".jpg");
                cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                if (Build.VERSION.SDK_INT >= 29) cv.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Nexo");
                Uri u = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (u != null) try (OutputStream o = getContentResolver().openOutputStream(u)) { bm.compress(Bitmap.CompressFormat.JPEG, 92, o); }
                avisar(String.format(Locale.ROOT, "Captura guardada en la galería (%d×%d)", w, h));
            } catch (Throwable e) {
                avisar("No se pudo guardar la captura: " + e.getMessage());
            }
        }, "captura").start();
    }
}
