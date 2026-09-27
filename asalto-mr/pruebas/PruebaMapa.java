import com.juniorspro.asaltomr.Mallador;
import com.juniorspro.asaltomr.Mapa;
import com.juniorspro.asaltomr.Tsdf;

import java.util.List;
import java.util.Random;

/**
 * La IA del entorno contra la escena de prueba (piso de pasto con un charco,
 * pared, mesa, tronco), escaneada sólo de adelante —como pasa de verdad: lo de
 * atrás de la mesa y del árbol nunca se ve—. Se compara con la escena real:
 * qué es cada zona, el completado de lo no visto, las rutas, las cubiertas y
 * la cobertura del escaneo.
 */
public class PruebaMapa {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    // la verdad de la escena en el plano (x, z)
    static boolean enMesa(float x, float z) { return x > 0.5f && x < 1.5f && z > -2.5f && z < -1.5f; }

    static boolean enTronco(float x, float z) { return Math.hypot(x + 1.5f, z + 2f) < 0.25f; }

    static int verdad(float x, float z) {
        if (z < -4f || enMesa(x, z) || enTronco(x, z)) return Mapa.OBSTACULO;
        return PruebaEscaneo.charco(x, z) ? Mapa.AGUA : Mapa.SUELO;
    }

    /** ¿La celda está lejos de un borde (ahí la verdad es ambigua)? */
    static boolean clara(float x, float z) {
        float m = 0.2f;
        int v = verdad(x, z);
        return verdad(x + m, z) == v && verdad(x - m, z) == v && verdad(x, z + m) == v && verdad(x, z - m) == v;
    }

    /** {fracción del piso real a < 6 m que se vio, dirección media del piso real no visto (x, z)}. */
    static float[] vistoDeVerdad(Mapa.Grilla g, float jx, float jz) {
        int visto = 0, tot = 0;
        float fx = 0, fz = 0;
        for (int c = 0; c < Mapa.N * Mapa.N; c++) {
            float x = g.x(c % Mapa.N), z = g.z(c / Mapa.N);
            float d = (float) Math.hypot(x - jx, z - jz);
            if (d > 6f || d < 0.5f || verdad(x, z) == Mapa.OBSTACULO) continue;
            tot++;
            if (g.clase[c] != Mapa.DESCONOCIDO) visto++;
            else { fx += (x - jx) / d; fz += (z - jz) / d; }
        }
        float l = (float) Math.hypot(fx, fz);
        return new float[]{visto / (float) Math.max(1, tot), l > 0 ? fx / l : 0, l > 0 ? fz / l : 0};
    }

    public static void main(String[] a) {
        final float JX = 0, JY = 1.5f, JZ = 1.2f;
        Tsdf t = new Tsdf(0.07f);
        PruebaEscaneo.escanear(t, 60, true);
        Mapa sin = new Mapa();
        sin.rellenar = false;
        long t0 = System.nanoTime();
        Mapa.Grilla g0 = sin.actualizar(t, JX, JY, JZ, 0, -1);
        double ms = (System.nanoTime() - t0) / 1e6;
        System.out.printf("mapa: %.0f ms · %d celdas vistas · piso del lugar %.3f m%n", ms, g0.vistas, g0.pisoRef);
        ver(ms < 600, "armar el mapa tarda menos de 600 ms en la PC");
        ver(Math.abs(g0.pisoRef) < 0.03f, String.format("encuentra el piso del lugar (%.3f m, real 0)", g0.pisoRef));

        // 1) lo visto: ¿qué es cada zona?
        int bien = 0, total = 0, pasto = 0, pisoVisto = 0, arbolBien = 0, arbolTot = 0, mesaBien = 0, mesaTot = 0;
        for (int c = 0; c < Mapa.N * Mapa.N; c++) {
            if (g0.clase[c] == Mapa.DESCONOCIDO) continue;
            float x = g0.x(c % Mapa.N), z = g0.z(c / Mapa.N);
            if (!clara(x, z)) continue;
            total++;
            if (g0.clase[c] == verdad(x, z)) bien++;
            if (g0.clase[c] == Mapa.SUELO) { pisoVisto++; if (g0.etiqueta[c] == Tsdf.PASTO) pasto++; }
            if (enMesa(x, z) && g0.clase[c] == Mapa.OBSTACULO) { mesaTot++; if (g0.etiqueta[c] == Tsdf.OBJETO) mesaBien++; }
        }
        for (int c = 0; c < Mapa.N * Mapa.N; c++) {   // el tronco es finito: todas sus celdas, no sólo las "claras"
            float x = g0.x(c % Mapa.N), z = g0.z(c / Mapa.N);
            if (enTronco(x, z) && g0.clase[c] == Mapa.OBSTACULO) { arbolTot++; if (g0.etiqueta[c] == Tsdf.ARBOL) arbolBien++; }
        }
        System.out.printf("zonas vistas: %d de %d bien · piso con etiqueta pasto %d/%d · árbol %d/%d · mesa %d/%d%n",
                bien, total, pasto, pisoVisto, arbolBien, arbolTot, mesaBien, mesaTot);
        ver(bien >= total * 0.93, "lo visto se clasifica bien (≥ 93 % de las celdas)");
        ver(pasto >= pisoVisto * 0.85, "la red semántica dice pasto en el piso (≥ 85 %, con 10 % de ruido en la red)");
        ver(arbolTot > 0 && arbolBien >= arbolTot * 0.6, "el tronco sale como árbol");
        ver(mesaTot > 0 && mesaBien >= mesaTot * 0.6, "la mesa sale como objeto");
        int agua = 0, aguaTot = 0;
        for (int c = 0; c < Mapa.N * Mapa.N; c++) {
            float x = g0.x(c % Mapa.N), z = g0.z(c / Mapa.N);
            if (!PruebaEscaneo.charco(x, z) || !clara(x, z) || g0.clase[c] == Mapa.DESCONOCIDO) continue;
            aguaTot++;
            if (g0.clase[c] == Mapa.AGUA) agua++;
        }
        ver(aguaTot > 0 && agua >= aguaTot * 0.7, "el charco sale como agua (" + agua + "/" + aguaTot + ")");

        // 2) el completado de lo que no se ve
        Mapa con = new Mapa();
        Mapa.Grilla g = con.actualizar(t, JX, JY, JZ, 0, -1);
        int pisoAntes = 0, pisoDespues = 0, pisoTot = 0, infBien = 0, infTot = 0, mesaObs = 0, mesaCel = 0, troncoObs = 0, troncoCel = 0;
        for (int c = 0; c < Mapa.N * Mapa.N; c++) {
            float x = g.x(c % Mapa.N), z = g.z(c / Mapa.N);
            if (x < -3f || x > 3f || z < -3.9f || z > 1f || !clara(x, z)) continue;
            int v = verdad(x, z);
            if (v != Mapa.OBSTACULO) {
                pisoTot++;
                if (g0.clase[c] == Mapa.SUELO || g0.clase[c] == Mapa.AGUA) pisoAntes++;
                if (g.clase[c] == Mapa.SUELO || g.clase[c] == Mapa.AGUA) pisoDespues++;
            }
            if (g.inferida[c]) { infTot++; if (g.clase[c] == v || (v == Mapa.AGUA && g.clase[c] == Mapa.SUELO)) infBien++; }
            if (enMesa(x, z)) { mesaCel++; if (g.clase[c] == Mapa.OBSTACULO) mesaObs++; }
        }
        for (int c = 0; c < Mapa.N * Mapa.N; c++) {
            float x = g.x(c % Mapa.N), z = g.z(c / Mapa.N);
            if (enTronco(x, z)) { troncoCel++; if (g.clase[c] == Mapa.OBSTACULO) troncoObs++; }
        }
        System.out.printf("completado: piso %d → %d de %d · %d celdas supuestas, %d bien · mesa %d/%d · tronco %d/%d%n",
                pisoAntes, pisoDespues, pisoTot, infTot, infBien, mesaObs, mesaCel, troncoObs, troncoCel);
        ver(pisoDespues > pisoAntes, "el completado agrega piso donde no se veía");
        ver(pisoDespues >= pisoTot * 0.9, String.format("con el completado, el piso cubre ≥ 90 %% del lugar (%.0f %%)", 100.0 * pisoDespues / pisoTot));
        ver(infTot > 0 && infBien >= infTot * 0.85, String.format("lo supuesto acierta ≥ 85 %% (%.0f %%)", 100.0 * infBien / Math.max(1, infTot)));
        ver(mesaObs >= mesaCel * 0.85, "la mesa entera es obstáculo (también su parte de atrás, que no se vio)");
        ver(troncoCel > 0 && troncoObs >= troncoCel * 0.75, "el tronco entero es obstáculo");

        // la malla con lo supuesto
        t.propagarBordes();
        List<Tsdf.Bloque> sucios = t.tomarSucios();
        Mallador mal = new Mallador();
        int nInf = 0, cerca10 = 0;
        double errInf = 0;
        for (Tsdf.Bloque b : sucios) {
            Mallador.Malla m = mal.mallar(t, b);
            if (m == null) continue;
            for (int i = 0; i < m.nVert; i++) {
                if (m.vert[i * Mallador.PASO + 6] < 0.5f) continue;
                float x = m.vert[i * Mallador.PASO], y = m.vert[i * Mallador.PASO + 1], z = m.vert[i * Mallador.PASO + 2];
                double e = Math.abs(PruebaEscaneo.escena(x, y, z));
                nInf++; errInf += e;
                if (e < 0.1) cerca10++;
            }
        }
        System.out.printf("malla supuesta: %d vértices, error medio %.1f cm, %.0f %% a menos de 10 cm%n", nInf, errInf / Math.max(1, nInf) * 100, 100.0 * cerca10 / Math.max(1, nInf));
        ver(nInf > 300, "la malla incluye lo supuesto (" + nInf + " vértices)");
        ver(cerca10 >= nInf * 0.85, "lo supuesto queda cerca de lo real (≥ 85 % a menos de 10 cm)");
        con.actualizar(t, JX, JY, JZ, 0, -1);
        t.propagarBordes();
        int reMallar = t.tomarSucios().size();
        ver(reMallar == 0, "sin datos nuevos, volver a armar el mapa no cambia nada (" + reMallar + " bloques)");

        // 3) una medición de verdad gana a lo supuesto
        {
            Tsdf u = new Tsdf(0.07f);
            int gx = (int) Math.floor(0.0 / 0.07), gy = (int) Math.floor(0.0 / 0.07), gz = (int) Math.floor(-1.0 / 0.07);
            u.inferir(gx, gy, gz, 0.9f, Tsdf.AGUA);
            ver(u.inferido(gx, gy, gz), "un voxel supuesto queda marcado");
            PruebaEscaneo.escanear(u, 6);
            ver(!u.inferido(gx, gy, gz) && u.peso(gx, gy, gz) > 0, "al verlo de verdad deja de ser supuesto");
        }

        // 4) rutas
        {
            float[] r = g.camino(-2.4f, -3.3f, JX, JZ - 0.3f);
            ver(r != null, "hay ruta desde detrás del árbol hasta el jugador");
            if (r != null) {
                boolean choca = false;
                float largo = 0, ax = -2.4f, az = -3.3f;
                for (int j = 0; j < r.length / 3; j++) {
                    float x = r[j * 3], z = r[j * 3 + 2];
                    // el tramo entero, no sólo los puntos
                    for (int q = 0; q <= 10; q++) {
                        float qx = ax + (x - ax) * q / 10f, qz = az + (z - az) * q / 10f;
                        if (verdad(qx, qz) == Mapa.OBSTACULO) choca = true;
                    }
                    largo += Math.hypot(x - ax, z - az);
                    ax = x; az = z;
                }
                System.out.printf("ruta: %d puntos, %.2f m (recto %.2f m)%n", r.length / 3, largo, Math.hypot(JX + 2.4f, JZ - 0.3f + 3.3f));
                ver(!choca, "la ruta no atraviesa el árbol ni la mesa");
            }
            float[] rc = g.camino(-0.5f, -1.8f, -0.5f, 0.0f);
            if (rc != null) {
                boolean moja = false;
                for (int j = 0; j < rc.length / 3; j++) if (PruebaEscaneo.charco(rc[j * 3], rc[j * 3 + 2])) moja = true;
                ver(!moja, "la ruta rodea el charco");
            } else ver(false, "hay ruta para rodear el charco");
        }

        // 5) cubiertas y lugares para aparecer
        {
            int buenas = 0;
            for (int c = 0; c < Mapa.N * Mapa.N; c++) {
                if (!g.cubierta[c]) continue;
                float x = g.x(c % Mapa.N), z = g.z(c / Mapa.N), y = g.piso[c] + 0.8f;
                float dx = x - JX, dy = y - JY, dz = z - JZ, l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
                float tr = PruebaEscaneo.trazar(JX, JY, JZ, dx / l, dy / l, dz / l);
                if (tr > 0 && tr < l - 0.1f) buenas++;
            }
            System.out.printf("cubiertas: %d (de verdad tapadas: %d)%n", g.cubiertas, buenas);
            ver(g.cubiertas > 0, "encuentra cubiertas (detrás de la mesa y del árbol)");
            ver(buenas >= g.cubiertas * 0.9, "las cubiertas tapan de verdad la línea de tiro (≥ 90 %)");
            Random azar = new Random(1);
            int ok = 0;
            for (int i = 0; i < 20; i++) {
                float[] p = g.lugarParaAparecer(azar, JX, JZ, 0, -1, 3f, 9f);
                if (p != null && verdad(p[0], p[2]) == Mapa.SUELO && Math.abs(p[1]) < 0.05f) ok++;
                else if (p != null) System.out.printf("  aparece mal en (%.2f, %.2f, %.2f), verdad %d%n", p[0], p[1], p[2], verdad(p[0], p[2]));
            }
            ver(ok == 20, "los lugares para aparecer son piso de verdad (" + ok + "/20)");
        }

        // 6) cobertura del escaneo: se compara con la verdad (cuánto piso real, a menos de 6 m, se vio)
        {
            Tsdf poco = new Tsdf(0.07f);
            PruebaEscaneo.escanear(poco, 20, true, 0.25f);   // sólo el primer cuarto del recorrido
            Mapa mp = new Mapa();
            mp.rellenar = false;   // se compara lo visto, sin lo supuesto
            Mapa.Grilla gp = mp.actualizar(poco, JX, JY, JZ, 0, -1);
            float[] vpoco = vistoDeVerdad(gp, JX, JZ), vtodo = vistoDeVerdad(g0, JX, JZ);
            System.out.printf("cobertura: poco escaneo %.0f %% (visto de verdad %.0f %%) · todo %.0f %% (visto %.0f %%)%n",
                    gp.cobertura * 100, vpoco[0] * 100, g0.cobertura * 100, vtodo[0] * 100);
            ver(g0.cobertura > gp.cobertura, "más escaneo, más cobertura");
            ver(Math.abs(g0.cobertura - vtodo[0]) < 0.1f && Math.abs(gp.cobertura - vpoco[0]) < 0.1f, "la cobertura que dice sigue a la de verdad (±10 puntos)");
            // seguir la guía: escanear hacia donde dice que falta tiene que cubrir más que hacia el otro lado
            float yawGuia = (float) Math.atan2(-gp.faltaX, -gp.faltaZ);
            float cab = gp.faltaCerca > 0.4f ? -0.9f : -0.45f;   // "mirá abajo" si lo que falta está a tus pies
            float[] res = new float[2];
            for (int q = 0; q < 2; q++) {
                Tsdf u = new Tsdf(0.07f);
                PruebaEscaneo.escanear(u, 20, true, 0.25f);
                PruebaEscaneo.escanearDesde(u, JX, JY, JZ, yawGuia + (q == 0 ? 0 : (float) Math.PI), cab, 12);
                Mapa mu = new Mapa();
                mu.rellenar = false;
                res[q] = vistoDeVerdad(mu.actualizar(u, JX, JY, JZ, 0, -1), JX, JZ)[0];
            }
            System.out.printf("guía: falta hacia (%.2f, %.2f), %.0f %% cerca · siguiéndola se ve %.0f %% del piso real, al revés %.0f %%%n",
                    gp.faltaX, gp.faltaZ, gp.faltaCerca * 100, res[0] * 100, res[1] * 100);
            ver(res[0] > res[1], "seguir la guía de escaneo cubre más que ir para el otro lado");
        }

        System.out.println(fallas == 0 ? "\n✓ todo bien" : "\n✗ " + fallas + " fallas");
        System.exit(fallas == 0 ? 0 : 1);
    }
}
