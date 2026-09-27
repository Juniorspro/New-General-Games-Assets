import com.juniorspro.asaltomr.Menu;

/**
 * El menú en el mundo: dónde queda, qué botón toca cada rayo (la mirada, el
 * láser desde la mano a la altura de la cadera, un toque en la pantalla), la
 * elección mirando 1.3 s o con el gatillo, y que te siga si te das vuelta.
 */
public class PruebaMenu {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    static float[] hacia(float ox, float oy, float oz, float[] p) {
        float dx = p[0] - ox, dy = p[1] - oy, dz = p[2] - oz, l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        return new float[]{dx / l, dy / l, dz / l};
    }

    static Menu armar() {
        Menu m = new Menu();
        m.limpiar("principal", "ASALTO MR");
        m.linea("Escaneo completo ✓");
        m.opcion("oleadas", "Oleadas", "récord 1200");
        m.opcion("contra", "Contrarreloj");
        m.opcion("practica", "Práctica");
        m.opcion("arma", "Arma: Pistola");
        m.opcion("escanear", "Seguir escaneando");
        return m;
    }

    public static void main(String[] a) {
        final float PX = 0.3f, PY = 1.55f, PZ = 0.8f;
        Menu m = armar();
        // mirando hacia −Z, un poco a la derecha
        float fx = 0.2f, fz = -1f;
        m.abrir(PX, PY, PZ, fx, fz);
        float d = (float) Math.hypot(m.cx - PX, m.cz - PZ);
        ver(Math.abs(d - Menu.DISTANCIA) < 1e-3f, String.format("queda a %.2f m, adelante", d));
        ver((m.cx - PX) * fx + (m.cz - PZ) * fz > 0, "del lado al que mirás");
        ver(m.alto() > 0.5f && m.alto() < 1.2f, String.format("de un tamaño que se ve entero (%.2f m de alto)", m.alto()));

        // 1) la mirada al centro de cada botón toca ese botón
        int bien = 0;
        float[] c = new float[3];
        for (int i = 0; i < m.opciones.size(); i++) {
            m.centroOpcion(i, c);
            float[] r = hacia(PX, PY, PZ, c);
            if (m.opcionEn(PX, PY, PZ, r[0], r[1], r[2]) == i) bien++;
        }
        ver(bien == m.opciones.size(), "mirando cada botón, se toca ése (" + bien + "/" + m.opciones.size() + ")");

        // 2) desde la mano (a la altura de la cadera, a la derecha) también
        float hx = PX + 0.25f, hy = PY - 0.5f, hz = PZ - 0.3f;
        bien = 0;
        for (int i = 0; i < m.opciones.size(); i++) {
            m.centroOpcion(i, c);
            float[] r = hacia(hx, hy, hz, c);
            if (m.opcionEn(hx, hy, hz, r[0], r[1], r[2]) == i) bien++;
        }
        ver(bien == m.opciones.size(), "con el láser desde la mano, también (" + bien + "/" + m.opciones.size() + ")");

        // 3) afuera, de atrás y entre botones: nada
        ver(m.opcionEn(PX, PY, PZ, -fx, 0, -fz) < 0, "mirando para atrás no toca nada");
        ver(m.opcionEn(PX, PY, PZ, 0, 1, 0) < 0, "mirando al cielo no toca nada");
        m.centroOpcion(0, c);
        float entre = Menu.ALTO / 2 + Menu.SEP / 2;
        float[] r = hacia(PX, PY, PZ, new float[]{c[0], c[1] - entre, c[2]});
        ver(m.opcionEn(PX, PY, PZ, r[0], r[1], r[2]) < 0 && m.tocaPanel, "entre dos botones: toca el panel, pero ningún botón");
        // atrás del panel (el rayo sale desde el otro lado)
        float bx = m.cx - m.nx * 1f, bz = m.cz - m.nz * 1f;
        m.centroOpcion(1, c);
        r = hacia(bx, PY, bz, c);
        ver(m.opcionEn(bx, PY, bz, r[0], r[1], r[2]) < 0, "desde atrás del panel no se elige");

        // 4) elegir mirando 1.3 s; con la mano, sólo con el gatillo
        m.centroOpcion(2, c);
        r = hacia(PX, PY, PZ, c);
        String elegido = null;
        float t = 0;
        while (elegido == null && t < 5) {
            elegido = m.actualizar(1 / 30f, PX, PY, PZ, r[0], r[1], r[2], true, false);
            t += 1 / 30f;
        }
        ver("practica".equals(elegido) && Math.abs(t - Menu.PERMANENCIA) < 0.1f, String.format("mirando %.2f s se elige \"%s\"", t, elegido));
        // enseguida no se vuelve a elegir
        String otra = null;
        for (int i = 0; i < 15; i++) otra = otra != null ? otra : m.actualizar(1 / 30f, PX, PY, PZ, r[0], r[1], r[2], true, false);
        ver(otra == null, "no se vuelve a elegir sola al instante");
        // con la mano: apuntar 3 s sin gatillo no elige; con el gatillo, sí
        Menu h = armar();
        h.abrir(PX, PY, PZ, fx, fz);
        h.centroOpcion(0, c);
        r = hacia(hx, hy, hz, c);
        String e = null;
        for (int i = 0; i < 90 && e == null; i++) e = h.actualizar(1 / 30f, hx, hy, hz, r[0], r[1], r[2], false, false);
        ver(e == null, "con la mano, apuntar solo no elige (no se dispara sin querer)");
        e = h.actualizar(1 / 30f, hx, hy, hz, r[0], r[1], r[2], false, true);
        ver("oleadas".equals(e), "con la mano, el gatillo elige (" + e + ")");
        // mirar un botón y pasar a otro antes de tiempo reinicia la cuenta
        Menu g = armar();
        g.abrir(PX, PY, PZ, fx, fz);
        float[] c0 = new float[3], c1 = new float[3];
        g.centroOpcion(0, c0);
        g.centroOpcion(1, c1);
        float[] r0 = hacia(PX, PY, PZ, c0), r1 = hacia(PX, PY, PZ, c1);
        e = null;
        for (int i = 0; i < 30 && e == null; i++) e = g.actualizar(1 / 30f, PX, PY, PZ, r0[0], r0[1], r0[2], true, false);
        for (int i = 0; i < 30 && e == null; i++) e = g.actualizar(1 / 30f, PX, PY, PZ, r1[0], r1[1], r1[2], true, false);
        ver(e == null, "1 s en uno y 1 s en otro: no elige ninguno");

        // 5) si te das vuelta, el panel te sigue
        Menu s = armar();
        s.abrir(PX, PY, PZ, 0, -1);
        float ax = s.cx;
        for (int i = 0; i < 12; i++) s.seguir(1 / 30f, PX, PY, PZ, 1, 0);
        ver(Math.abs(s.cx - ax) < 1e-4f, "girar un momento no lo mueve");
        for (int i = 0; i < 30; i++) s.seguir(1 / 30f, PX, PY, PZ, 1, 0);
        ver(s.cx > PX + 1f && Math.abs(s.cz - PZ) < 0.01f, String.format("de espaldas un rato, vuelve adelante (x %.2f)", s.cx - PX));
        for (int i = 0; i < 60; i++) s.seguir(1 / 30f, PX, PY, PZ, 1, 0.3f);
        ver(s.cx > PX + 1f, "mirándolo un poco de costado no se mueve");

        System.out.println();
        System.out.println(fallas == 0 ? "✓ todo bien" : "✗ " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
