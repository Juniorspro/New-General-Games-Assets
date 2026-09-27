package ar.aeroplaza;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/* (vuelta 42, "sobre todo la cámara debe usarse en 0.5x") CÓMO LLEGAR A LA ULTRA ANCHA. Java puro: se prueba en la
   compu (pruebas/ancha/PruebaAncha.java); lo que lee Android lo arma CamaraManos.describir.
   Como AngleCam (la app que mandó quien pide: se miró su código, no se copió): el campo de cada cámara sale de su
   focal y del tamaño del sensor, 2·atan(lado / 2f), y hay tres caminos, del mejor al peor:
   - "id": el celu da la ultra ancha como una cámara más (getCameraIdList, de atrás): se abre esa;
   - "zoom": la cámara lógica de atrás baja el zoom de 1 (CONTROL_ZOOM_RATIO_RANGE, Android 11+, 0,5-0,6): se
     pide ese zoom y el celu pasa solo a la lente ancha. El campo queda 2·atan(tan(campo/2) / zoom);
   - "fisica": la lógica tiene lentes físicas (getPhysicalCameraIds) y una es más ancha: solo con un flujo de
     esa lente dentro de la sesión de la lógica (se anota; no se usa, casi ningún celu lo deja junto con ARCore).
   Una cámara cuenta como ultra ancha si abre al menos MAS grados más que la principal */
final class Ancha {
  static final double MAS = 15;
  private Ancha() { }

  /* lo que se sabe de una cámara */
  static final class Cam {
    String id; boolean atras; float focal; float sensorW, sensorH; float zoomMin = 1; boolean logica; List<String> fisicas = new ArrayList<>();
    /* (una lente física que no está en getCameraIdList no se puede abrir sola) */
    boolean abrible = true;
    Cam(String id, boolean atras, float focal, float sensorW, float sensorH) { this.id = id; this.atras = atras; this.focal = focal; this.sensorW = sensorW; this.sensorH = sensorH; }
    /* el campo del lado largo (grados), sin zoom */
    double campo() { return focal <= 0 || sensorW <= 0 ? 0 : Math.toDegrees(2 * Math.atan(Math.max(sensorW, sensorH) / (2 * focal))); }
  }

  /* el camino elegido */
  static final class Eleccion {
    final String via, id; final float zoom; final double campo, campoPrincipal;
    Eleccion(String via, String id, float zoom, double campo, double campoPrincipal) { this.via = via; this.id = id; this.zoom = zoom; this.campo = campo; this.campoPrincipal = campoPrincipal; }
    boolean hay() { return !"no".equals(via); }
    @Override public String toString() { return String.format(Locale.US, "%s %s %.2f %.0f %.0f", via, id == null ? "-" : id, zoom, campo, campoPrincipal); }
  }

  static double conZoom(double campo, double zoom) { return zoom <= 0 ? campo : Math.toDegrees(2 * Math.atan(Math.tan(Math.toRadians(campo) / 2) / zoom)); }

  /* principal: la de atrás que usa ARCore (o la primera de atrás) */
  static Eleccion elegir(List<Cam> cams, String principal) {
    Cam p = null;
    for (Cam c : cams) if (c.atras && c.id.equals(principal)) p = c;
    if (p == null) for (Cam c : cams) if (c.atras) { p = c; break; }
    if (p == null) return new Eleccion("no", null, 1, 0, 0);
    double cp = p.campo();
    /* 1) otra cámara de atrás, más ancha (la más ancha de todas) */
    Cam mejor = null;
    for (Cam c : cams) if (c.atras && c.abrible && c != p && c.campo() >= cp + MAS && (mejor == null || c.campo() > mejor.campo())) mejor = c;
    Eleccion porId = mejor == null ? null : new Eleccion("id", mejor.id, 1, mejor.campo(), cp);
    /* 2) el zoom de la principal (o de otra lógica de atrás) menor que 1 */
    Eleccion porZoom = null;
    for (Cam c : cams) {
      if (!c.atras || !c.abrible || c.zoomMin >= 0.95f || c.zoomMin <= 0) continue;
      double g = conZoom(c.campo(), c.zoomMin);
      if (g >= cp + MAS && (porZoom == null || g > porZoom.campo)) porZoom = new Eleccion("zoom", c.id, c.zoomMin, g, cp);
    }
    /* (el zoom primero si abre casi lo mismo: la cámara lógica enfoca y expone mejor, y la calibración es la suya) */
    if (porZoom != null && (porId == null || porZoom.campo >= porId.campo - 5)) return porZoom;
    if (porId != null) return porId;
    /* 3) una lente física más ancha de una lógica */
    for (Cam c : cams) if (c.atras && c.logica) for (String f : c.fisicas) for (Cam x : cams) if (x.id.equals(f) && x.campo() >= cp + MAS) return new Eleccion("fisica", c.id + ":" + f, 1, x.campo(), cp);
    return new Eleccion("no", null, 1, cp, cp);
  }
}
