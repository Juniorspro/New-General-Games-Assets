package ar.aeroplaza;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;

import java.util.Locale;

/* los sensores del celu para la cabeza (vuelta 39; la cuenta es Fusion): el vector de rotación "de juego" (el
   giróscopo y el acelerómetro juntos, sin la brújula, que tira con los imanes y los parlantes) y el giróscopo
   (la velocidad, para adelantar), a 200 por segundo. El juego lo lee con AeroplazaNativo.cabeza, sin
   esperar mensajes: la pose es la de ese instante */
class Cabeza implements SensorEventListener {
  /* (vuelta 41, "se me cierra la app al entrar al ARCore") a 200 por segundo (5 ms): lo más que deja Android 12+
     sin el permiso de muestreo alto. Con SENSOR_DELAY_FASTEST (0 ms) una APK depurable tira SecurityException al
     pedir el giróscopo (y la de la tienda lo baja a 200 igual). Y en su propio hilo: cientos de avisos por
     segundo iban al de la interfaz, el mismo que arranca ARCore y le pasa todo al juego */
  static final int PERIODO_US = 5000;
  final Fusion f = new Fusion();
  final SensorManager sm;
  final Sensor rot, giro;
  boolean prendida;
  String falla = "";
  private HandlerThread hilo;
  private Handler h;
  private final float[] q4 = new float[4], out = new float[7];

  Cabeza(Context c) {
    sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
    rot = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
    giro = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
  }
  /* (nunca rompe: si los sensores no se pueden, el juego sigue con la pose de ARCore, como antes) */
  void prender() {
    if (prendida || sm == null || rot == null) return;
    try {
      if (hilo == null) { hilo = new HandlerThread("cabeza"); hilo.start(); h = new Handler(hilo.getLooper()); }
      prendida = true;
      if (!sm.registerListener(this, rot, PERIODO_US, h)) { falla = "rot"; apagar(); return; }
      if (giro != null && !sm.registerListener(this, giro, PERIODO_US, h)) falla = "giro";
    } catch (Throwable t) { falla = t.getClass().getSimpleName(); apagar(); }
  }
  void apagar() { try { if (prendida && sm != null) sm.unregisterListener(this); } catch (Throwable t) { /* nada */ } prendida = false; }
  void cerrar() { apagar(); try { if (hilo != null) hilo.quitSafely(); } catch (Throwable t) { /* nada */ } hilo = null; h = null; }

  @Override public void onSensorChanged(SensorEvent e) {
    try {
      if (e.sensor.getType() == Sensor.TYPE_GAME_ROTATION_VECTOR) {
        /* (getQuaternionFromVector da w, x, y, z) */
        SensorManager.getQuaternionFromVector(q4, e.values);
        f.rotacion(e.timestamp, q4[1], q4[2], q4[3], q4[0]);
      } else if (e.sensor.getType() == Sensor.TYPE_GYROSCOPE) f.giro(e.timestamp, e.values[0], e.values[1], e.values[2]);
    } catch (Throwable t) { falla = t.getClass().getSimpleName(); }
  }
  @Override public void onAccuracyChanged(Sensor s, int a) { }

  /* para el juego: "qx,qy,qz,qw,x,y,z" (el giro de la cámara orientada a la pantalla y los ojos, en el mundo de
     ARCore) a ahora + adelanto ms; "" si todavía no */
  String leer(double adelantoMs) {
    try {
      long ahora = SystemClock.elapsedRealtimeNanos();
      synchronized (out) {
        if (!f.leer(ahora, (long) (adelantoMs * 1e6), out)) return "";
        return String.format(Locale.US, "%.6f,%.6f,%.6f,%.6f,%.4f,%.4f,%.4f", out[0], out[1], out[2], out[3], out[4], out[5], out[6]);
      }
    } catch (Throwable t) { return ""; }
  }
  /* (vuelta 43) el giro de hace msAtras ms (la hora de la foto de las manos): "qx,qy,qz,qw" o "" */
  private final float[] g4 = new float[4];
  String giroAntes(double msAtras) {
    try {
      long t = SystemClock.elapsedRealtimeNanos() - (long) (Math.max(0, Math.min(1500, msAtras)) * 1e6);
      synchronized (g4) {
        if (!f.giroEn(t, g4)) return "";
        return String.format(Locale.US, "%.6f,%.6f,%.6f,%.6f", g4[0], g4[1], g4[2], g4[3]);
      }
    } catch (Throwable x) { return ""; }
  }
  /* (para el diagnóstico: los ejes elegidos, las fotos y las muestras) */
  String estado() { synchronized (f) { return String.format(Locale.US, "%d %d %d %.2f %s", f.c, f.fotos, f.nI, f.c >= 0 ? f.err[f.c] : -1.0, falla.isEmpty() ? "-" : falla); } }
}
