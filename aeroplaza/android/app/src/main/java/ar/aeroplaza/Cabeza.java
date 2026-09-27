package ar.aeroplaza;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.SystemClock;

import java.util.Locale;

/* los sensores del celu para la cabeza (vuelta 39; la cuenta es Fusion): el vector de rotación "de juego" (el
   giróscopo y el acelerómetro juntos, sin la brújula, que tira con los imanes y los parlantes) y el giróscopo
   (la velocidad, para adelantar), lo más rápido que den. El juego lo lee con AeroplazaNativo.cabeza, sin
   esperar mensajes: la pose es la de ese instante */
class Cabeza implements SensorEventListener {
  final Fusion f = new Fusion();
  final SensorManager sm;
  final Sensor rot, giro;
  boolean prendida;
  private final float[] q4 = new float[4], out = new float[7];

  Cabeza(Context c) {
    sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
    rot = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
    giro = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_GYROSCOPE);
  }
  void prender() {
    if (prendida || sm == null || rot == null) return;
    sm.registerListener(this, rot, SensorManager.SENSOR_DELAY_FASTEST);
    if (giro != null) sm.registerListener(this, giro, SensorManager.SENSOR_DELAY_FASTEST);
    prendida = true;
  }
  void apagar() { if (prendida && sm != null) sm.unregisterListener(this); prendida = false; }

  @Override public void onSensorChanged(SensorEvent e) {
    if (e.sensor.getType() == Sensor.TYPE_GAME_ROTATION_VECTOR) {
      /* (getQuaternionFromVector da w, x, y, z) */
      SensorManager.getQuaternionFromVector(q4, e.values);
      f.rotacion(e.timestamp, q4[1], q4[2], q4[3], q4[0]);
    } else if (e.sensor.getType() == Sensor.TYPE_GYROSCOPE) f.giro(e.timestamp, e.values[0], e.values[1], e.values[2]);
  }
  @Override public void onAccuracyChanged(Sensor s, int a) { }

  /* para el juego: "qx,qy,qz,qw,x,y,z" (el giro de la cámara orientada a la pantalla y los ojos, en el mundo de
     ARCore) a ahora + adelanto ms; "" si todavía no */
  String leer(double adelantoMs) {
    long ahora = SystemClock.elapsedRealtimeNanos();
    if (!f.leer(ahora, (long) (adelantoMs * 1e6), out)) return "";
    return String.format(Locale.US, "%.6f,%.6f,%.6f,%.6f,%.4f,%.4f,%.4f", out[0], out[1], out[2], out[3], out[4], out[5], out[6]);
  }
  /* (para el diagnóstico: los ejes elegidos, las fotos y las muestras) */
  String estado() { synchronized (f) { return String.format(Locale.US, "%d %d %d %.2f", f.c, f.fotos, f.nI, f.c >= 0 ? f.err[f.c] : -1.0); } }
}
