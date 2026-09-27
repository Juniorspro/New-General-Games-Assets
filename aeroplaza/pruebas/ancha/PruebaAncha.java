package ar.aeroplaza;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/* (vuelta 42) Ancha.java en la compu: con celus de mentira (sus cámaras como las da Android), qué camino elige
   para la ultra ancha. Los números son de celus reales (focal y sensor de la ficha técnica, aproximados) */
public class PruebaAncha {
  static int bien, mal;
  static void prueba(String n, boolean ok, String extra) { if (ok) bien++; else mal++; System.out.println((ok ? "✓ " : "✗ ") + n + (extra.isEmpty() ? "" : " · " + extra)); }
  static Ancha.Cam cam(String id, boolean atras, float f, float w, float h) { return new Ancha.Cam(id, atras, f, w, h); }

  public static void main(String[] a) {
    /* la principal típica: 1/1.56" (6,4 × 4,8 mm) y 4,6 mm → ~70° del lado largo; la ultra: 1/3" (4,0 × 3,0 mm) y 1,5 mm → ~106° */
    Ancha.Cam p = cam("0", true, 4.6f, 6.4f, 4.8f), ultra = cam("2", true, 1.5f, 4.0f, 3.0f), frente = cam("1", false, 2.7f, 3.6f, 2.7f), tele = cam("3", true, 12f, 4.0f, 3.0f);
    System.out.println(String.format("  (principal %.0f°, ultra %.0f°, tele %.0f°)", p.campo(), ultra.campo(), tele.campo()));
    /* 1) la ultra como una cámara más (muchos Samsung, Motorola, Xiaomi) */
    Ancha.Eleccion e1 = Ancha.elegir(Arrays.asList(p, frente, ultra, tele), "0");
    prueba("la ultra con su propio número: se abre esa", e1.via.equals("id") && e1.id.equals("2") && e1.campo > 100, e1.toString());
    /* 2) solo la lógica, que baja el zoom a 0,6 (Pixel y Samsung nuevos) */
    Ancha.Cam logica = cam("0", true, 4.6f, 6.4f, 4.8f); logica.zoomMin = 0.6f; logica.logica = true;
    Ancha.Eleccion e2 = Ancha.elegir(Arrays.asList(logica, frente), "0");
    prueba("la lógica con zoom 0,6: por zoom, y el campo abre como 1/0,6", e2.via.equals("zoom") && Math.abs(e2.zoom - 0.6f) < 1e-4 && e2.campo > 95 && e2.campo < 110, e2.toString());
    /* 3) las dos: si el zoom abre casi lo mismo, el zoom (la cámara lógica enfoca mejor) */
    Ancha.Cam logica2 = cam("0", true, 4.6f, 6.4f, 4.8f); logica2.zoomMin = 0.5f;
    Ancha.Eleccion e3 = Ancha.elegir(Arrays.asList(logica2, ultra, frente), "0");
    prueba("con las dos y el zoom 0,5 abriendo parecido: el zoom", e3.via.equals("zoom"), e3.toString());
    /* 4) solo lentes físicas escondidas (no se abren solas) */
    Ancha.Cam log3 = cam("0", true, 4.6f, 6.4f, 4.8f); log3.logica = true; log3.fisicas = new ArrayList<>(Arrays.asList("2", "3"));
    Ancha.Cam u3 = cam("2", true, 1.5f, 4.0f, 3.0f); u3.abrible = false;
    Ancha.Eleccion e4 = Ancha.elegir(Arrays.asList(log3, frente, u3), "0");
    prueba("la ultra solo como lente física (no se abre sola): se anota como física", e4.via.equals("fisica") && e4.id.equals("0:2"), e4.toString());
    /* 5) nada más ancho (celus con una cámara, o la tele) */
    Ancha.Eleccion e5 = Ancha.elegir(Arrays.asList(p, frente, tele), "0");
    prueba("sin ultra ancha: no", !e5.hay() && Math.abs(e5.campo - p.campo()) < 0.01, e5.toString());
    /* 6) la de adelante nunca, aunque sea más ancha */
    Ancha.Cam selfie = cam("1", false, 1.8f, 4.0f, 3.0f);
    prueba("la de adelante no cuenta aunque abra más", !Ancha.elegir(Arrays.asList(p, selfie), "0").hay(), "");
    /* 7) sin datos de la lente: no rompe */
    Ancha.Cam rota = cam("0", true, 0, 0, 0);
    prueba("sin focal ni sensor: no, sin romper", !Ancha.elegir(new ArrayList<>(Arrays.asList(rota)), "0").hay() && !Ancha.elegir(new ArrayList<>(), "0").hay(), "");
    System.out.println(bien + " bien, " + mal + " mal");
    System.exit(mal > 0 ? 1 : 0);
  }
}
