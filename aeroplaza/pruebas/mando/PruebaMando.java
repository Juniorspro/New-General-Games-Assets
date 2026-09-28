package ar.aeroplaza;

/* (vuelta 44) MandoBox.java sin Android: qué tecla es qué botón, en cada modo del VR Box, y la palanca.
     javac -d <dir> android/app/src/main/java/ar/aeroplaza/MandoBox.java pruebas/mando/PruebaMando.java
     java -cp <dir> ar.aeroplaza.PruebaMando */
public class PruebaMando {
  static int bien = 0, mal = 0;
  static void prueba(String n, boolean ok, String extra) { if (ok) bien++; else mal++; System.out.println((ok ? "✓ " : "✗ ") + n + (extra.isEmpty() ? "" : " · " + extra)); }
  public static void main(String[] a) {
    /* modo juego: los botones con nombre y los genéricos */
    int[][] juego = { { 96, 0 }, { 97, 1 }, { 99, 2 }, { 100, 3 }, { 102, 4 }, { 103, 5 }, { 104, 6 }, { 105, 7 }, { 109, 8 }, { 108, 9 }, { 188, 0 }, { 192, 4 }, { 203, 15 } };
    boolean ok = true; StringBuilder s = new StringBuilder();
    for (int[] j : juego) { int b = MandoBox.boton(j[0], true, false); if (b != j[1]) { ok = false; s.append(j[0]).append("→").append(b).append(' '); } }
    prueba("modo juego: A, B, X, Y, L1, R1, L2, R2, select, start y los genéricos van a su botón estándar", ok, s.toString());
    prueba("la cruz de un mando es la cruz (12 a 15) y su OK es 25",
      MandoBox.boton(19, true, false) == 12 && MandoBox.boton(20, true, false) == 13 && MandoBox.boton(21, true, false) == 14 && MandoBox.boton(22, true, false) == 15 && MandoBox.boton(23, true, false) == 25, "");
    prueba("las flechas y el Enter de un teclado (el modo teclas) siguen a la página fuera del VR",
      MandoBox.boton(19, false, false) == -1 && MandoBox.boton(66, false, false) == -1, "");
    /* modo música: solo en el VR */
    prueba("modo música en el VR: volumen +/− caminan (20, 21), los temas giran (22, 23), play/pausa usa (24)",
      MandoBox.boton(24, false, true) == 20 && MandoBox.boton(25, false, true) == 21 && MandoBox.boton(88, false, true) == 22 && MandoBox.boton(87, false, true) == 23
      && MandoBox.boton(85, false, true) == 24 && MandoBox.boton(79, false, true) == 24 && MandoBox.boton(66, false, true) == 25, "");
    prueba("fuera del VR el volumen y los temas son lo de siempre (no se toman)",
      MandoBox.boton(24, false, false) == -1 && MandoBox.boton(25, false, false) == -1 && MandoBox.boton(85, false, false) == -1 && MandoBox.boton(87, false, false) == -1, "");
    prueba("atrás, inicio y las letras nunca se toman", MandoBox.boton(4, true, true) == -1 && MandoBox.boton(3, true, true) == -1 && MandoBox.boton(29, false, true) == -1, "");
    /* el mensaje */
    String d = MandoBox.tecla(96, true, 0, true, false), u = MandoBox.tecla(96, false, 0, true, false), r = MandoBox.tecla(96, true, 3, true, false);
    prueba("apretar y soltar mandan el botón; la repetición de Android no se manda",
      d != null && d.endsWith("mandoBoton(0,1)") && u != null && u.endsWith("mandoBoton(0,0)") && r == null, d + " | " + u + " | " + r);
    /* la palanca */
    MandoBox m = new MandoBox();
    String e1 = m.eje(0f, -1f, 0f, 0f), e2 = m.eje(0.005f, -0.995f, 0f, 0f), e3 = m.eje(0.05f, 0.05f, 0f, 0f), e4 = m.eje(0f, 0f, 0f, 0f);
    prueba("la palanca manda solo si cambia, y una vez al volver al medio (lo que tiembla cerca del medio es 0)",
      e1 != null && e1.endsWith("mandoEje(0.000,-1.000)") && e2 == null && e3 != null && e3.endsWith("mandoEje(0.000,0.000)") && e4 == null, e1 + " | " + e2 + " | " + e3 + " | " + e4);
    String h = m.eje(0f, 0f, 1f, 0f);
    prueba("con la palanca quieta, la cruz (AXIS_HAT) mueve", h != null && h.endsWith("mandoEje(1.000,0.000)"), h);
    System.out.println(bien + " bien, " + mal + " mal");
    System.exit(mal == 0 ? 0 : 1);
  }
}
