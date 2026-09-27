import com.juniorspro.asaltomr.Juego;
import com.juniorspro.asaltomr.Tsdf;

/**
 * El juego contra la escena escaneada de PruebaEscaneo (piso, pared, mesa,
 * tronco): los soldados tienen que aparecer y caminar sobre el piso real, no
 * meterse adentro de la mesa ni del árbol, caer sobre el piso cuando les
 * pegás, y los tiros tienen que pegar en la superficie real.
 */
public class PruebaJuego {
    static int fallas = 0;

    static void ver(boolean ok, String s) {
        System.out.println((ok ? "✓ " : "✗ ") + s);
        if (!ok) fallas++;
    }

    public static void main(String[] a) {
        final Tsdf tsdf = new Tsdf(0.07f);
        PruebaEscaneo.escanear(tsdf, 60);
        Juego.Entorno e = new Juego.Entorno() {
            public float suelo(float x, float z, float y0, float y1) { return tsdf.suelo(x, z, y0, y1); }
            public float rayo(float ox, float oy, float oz, float dx, float dy, float dz, float m) { return tsdf.rayo(ox, oy, oz, dx, dy, dz, m); }
            public boolean ocupado(float x, float y, float z) { return tsdf.ocupado(x, y, z); }
        };

        // el jugador parado en (0, 1.5, 1.2) mirando a −Z (hacia la escena)
        final float JX = 0, JY = 1.5f, JZ = 1.2f;
        Juego j = new Juego(3);
        j.dificultad = 1;
        j.pisoRespaldo = 0;   // en la app sale del plano más bajo de ARCore
        j.empezar();
        ver(j.estado == Juego.JUEGA && j.oleada == 1, "empieza la oleada 1");

        // 1) correr 20 s sin disparar: aparecen, caminan por el piso, no atraviesan nada
        int vistos = 0, adentro = 0, fueraDelPiso = 0, pasos = 0, disparos = 0;
        java.util.HashSet<Integer> ids = new java.util.HashSet<>();
        float dt = 1 / 30f;
        double recorrido = 0;
        java.util.HashMap<Integer, float[]> antes = new java.util.HashMap<>();
        for (int k = 0; k < 600; k++) {
            j.actualizar(dt, JX, JY, JZ, 0, -1, e);
            int ev = j.tomarEventos();
            if ((ev & Juego.EV_ENEMIGO_DISPARA) != 0) disparos++;
            for (Juego.Soldado s : j.soldados) {
                ids.add(s.id);
                pasos++;
                if (tsdf.ocupado(s.x, s.y + 0.9f, s.z)) adentro++;
                float piso = tsdf.suelo(s.x, s.z, s.y + 0.5f, s.y - 1f);
                if (piso == piso && Math.abs(piso - s.y) > 0.12f) fueraDelPiso++;
                float[] p = antes.get(s.id);
                if (p != null) recorrido += Math.hypot(s.x - p[0], s.z - p[1]);
                antes.put(s.id, new float[]{s.x, s.z});
            }
        }
        vistos = ids.size();
        System.out.printf("20 s: %d soldados, %.1f m recorridos, %d disparos enemigos, vida %.0f%n", vistos, recorrido, disparos, j.vidaJugador);
        ver(vistos >= 3, "aparecieron soldados (" + vistos + ")");
        ver(recorrido > 5, "se movieron (" + String.format("%.1f", recorrido) + " m)");
        ver(adentro == 0, "ninguno metido adentro de la mesa, el tronco o la pared (" + adentro + " de " + pasos + ")");
        ver(fueraDelPiso < pasos * 0.02, "caminan sobre el piso escaneado (" + fueraDelPiso + " de " + pasos + " fuera)");
        ver(disparos > 0 && j.vidaJugador < 100, "te tiran y a veces te pegan (vida " + (int) j.vidaJugador + ")");
        ver(j.estado == Juego.JUEGA, "en normal, 20 s quieto sin disparar no alcanza para matarte");
        for (Juego.Soldado s : j.soldados) {
            float dJ = (float) Math.hypot(s.x - JX, s.z - JZ);
            if (dJ < 1.5f) { ver(false, "un soldado se te vino encima (" + dJ + " m)"); break; }
        }

        // 2) apuntarle a uno y dispararle al pecho
        Juego.Soldado blanco = null;
        for (Juego.Soldado s : j.soldados) if (s.estado == Juego.CORRE || s.estado == Juego.APUNTA) { blanco = s; break; }
        ver(blanco != null, "hay a quién tirarle");
        if (blanco != null) {
            float tx = blanco.x - JX, ty = blanco.y + 1.1f - JY, tz = blanco.z - JZ;
            float l = (float) Math.sqrt(tx * tx + ty * ty + tz * tz);
            int puntosAntes = j.puntos;
            Juego.Impacto imp = j.disparar(JX, JY, JZ, tx / l, ty / l, tz / l, JX + 0.2f, JY - 0.2f, JZ - 0.3f, e);
            int ev = j.tomarEventos();
            // si justo lo tapa algo (el tronco), el tiro pega en el entorno: también vale
            if (imp.tipo == Juego.Impacto.SOLDADO) {
                ver(blanco.estado == Juego.CAE, "al pegarle sale volando");
                ver((ev & Juego.EV_MUERTE) != 0 && j.puntos > puntosAntes, "suma puntos (" + j.puntos + ")");
                // cae para atrás (se aleja del jugador) y termina en el piso
                float d0 = (float) Math.hypot(blanco.x - JX, blanco.z - JZ);
                for (int k = 0; k < 150; k++) j.actualizar(dt, JX, JY, JZ, 0, -1, e);
                float d1 = (float) Math.hypot(blanco.x - JX, blanco.z - JZ);
                float piso = tsdf.suelo(blanco.x, blanco.z, blanco.y + 0.8f, blanco.y - 1.5f);
                ver(d1 > d0 + 0.3f, String.format("cae para atrás: de %.2f a %.2f m del jugador", d0, d1));
                ver(blanco.estado == Juego.TIRADO || blanco.desvanecer > 0 || !j.soldados.contains(blanco), "queda tirado");
                ver(piso != piso || Math.abs(blanco.y - piso) < 0.1f, String.format("tirado sobre el piso real (y %.2f, piso %.2f)", blanco.y, piso));
                ver(blanco.caida < -1.4f, String.format("de espaldas (%.0f°)", Math.toDegrees(blanco.caida)));
            } else {
                System.out.println("  (el tiro pegó en el entorno: " + imp.tipo + ")");
            }
        }

        // 3) tiro a la mesa: pega en la superficie real
        {
            Juego k = new Juego(1);
            k.empezar();
            k.soldados.clear();
            float ox = 0, oy = 1.5f, oz = 0.5f, dx = 1.0f, dy = 0.4f - 1.5f, dz = -2.0f - 0.5f;
            float l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
            Juego.Impacto imp = k.disparar(ox, oy, oz, dx / l, dy / l, dz / l, ox, oy, oz, e);
            ver(imp.tipo == Juego.Impacto.ENTORNO, "el tiro a la mesa pega en el entorno");
            float real = PruebaEscaneo.trazar(ox, oy, oz, dx / l, dy / l, dz / l);
            ver(Math.abs(imp.distancia - real) < 0.05f && Math.abs(PruebaEscaneo.caja(imp.x, imp.y, imp.z, 0.5f, 0f, -2.5f, 1.5f, 0.8f, -1.5f)) < 0.05f,
                    String.format("pega en la cara de la mesa (%.2f, %.2f, %.2f), a %.3f m (real %.3f)", imp.x, imp.y, imp.z, imp.distancia, real));
            ver(k.particulas.size() > 5, "salen chispas y polvo (" + k.particulas.size() + ")");
            // cabeza
            k.soldados.clear();
            Juego.Soldado s = new Juego.Soldado();
            s.x = -0.5f; s.y = 0; s.z = -1.0f; s.estado = Juego.CORRE;
            k.soldados.add(s);
            for (int i = 0; i < 10; i++) k.actualizar(0.2f, ox, oy, oz, 0, -1, e);   // que pase la cadencia
            float hx = s.x - ox, hy = s.y + Juego.CABEZA_Y - oy, hz = s.z - oz;
            float hl = (float) Math.sqrt(hx * hx + hy * hy + hz * hz);
            k.tomarEventos();
            Juego.Impacto ic = k.disparar(ox, oy, oz, hx / hl, hy / hl, hz / hl, ox, oy, oz, e);
            ver(ic.tipo == Juego.Impacto.CABEZA && (k.tomarEventos() & Juego.EV_CABEZA) != 0, "tiro a la cabeza cuenta como cabeza");
            // cargador y recarga
            Juego r = new Juego(2);
            r.empezar();
            r.soldados.clear();
            int tiros = 0;
            for (int i = 0; i < 40; i++) {
                r.actualizar(0.2f, 0, 1.5f, 0.5f, 0, -1, e);
                if (r.puedeDisparar()) { r.disparar(0, 1.5f, 0.5f, 0, 0, -1, 0, 1.5f, 0.5f, e); tiros++; }
            }
            ver(tiros > Juego.CARGADOR, "el cargador se recarga solo (" + tiros + " tiros en 8 s)");
        }

        // 4) si te matan, termina
        {
            Juego m = new Juego(5);
            m.dificultad = 2;
            m.pisoRespaldo = 0;
            m.empezar();
            int fin = 0;
            for (int k = 0; k < 30 * 180 && m.estado == Juego.JUEGA; k++) {
                m.actualizar(dt, JX, JY, JZ, 0, -1, e);
                if ((m.tomarEventos() & Juego.EV_FIN) != 0) fin++;
            }
            ver(m.estado == Juego.FIN && fin == 1, "en difícil, sin disparar, te terminan matando (y avisa una vez)");
            m.empezar();
            ver(m.estado == Juego.JUEGA && m.vidaJugador == 100 && m.puntos == 0, "volver a empezar deja todo en cero");
        }

        // 5) oleadas: matándolos a todos, sube la oleada
        {
            Juego o = new Juego(9);
            o.dificultad = 0;
            o.pisoRespaldo = 0;
            o.empezar();
            int oleadaMax = 1;
            for (int k = 0; k < 30 * 90; k++) {
                o.actualizar(dt, JX, JY, JZ, 0, -1, e);
                for (Juego.Soldado s : o.soldados) {
                    if ((s.estado == Juego.CORRE || s.estado == Juego.APUNTA) && o.puedeDisparar()) {
                        float tx = s.x - JX, ty = s.y + 1.1f - JY, tz = s.z - JZ;
                        float l = (float) Math.sqrt(tx * tx + ty * ty + tz * tz);
                        o.disparar(JX, JY, JZ, tx / l, ty / l, tz / l, JX, JY, JZ, e);
                        break;
                    }
                }
                o.vidaJugador = 100;   // acá sólo se prueban las oleadas
                oleadaMax = Math.max(oleadaMax, o.oleada);
            }
            System.out.printf("90 s tirando: oleada %d, %d bajas, %d puntos%n", oleadaMax, o.bajas, o.puntos);
            ver(oleadaMax >= 3, "limpiando las oleadas se pasa a la siguiente (llegó a la " + oleadaMax + ")");
        }

        // 6) con el mapa de zonas: IA táctica (rutas, cubiertas, agacharse, asomarse)
        {
            final Tsdf t2 = new Tsdf(0.07f);
            PruebaEscaneo.escanear(t2, 60, true);
            Juego.Entorno e2 = new Juego.Entorno() {
                public float suelo(float x, float z, float y0, float y1) { return t2.suelo(x, z, y0, y1); }
                public float rayo(float ox, float oy, float oz, float dx, float dy, float dz, float m) { return t2.rayo(ox, oy, oz, dx, dy, dz, m); }
                public boolean ocupado(float x, float y, float z) { return t2.ocupado(x, y, z); }
            };
            com.juniorspro.asaltomr.Mapa mapa = new com.juniorspro.asaltomr.Mapa();
            Juego tj = new Juego(8);
            tj.dificultad = 2;          // difícil: buscan cubierta más seguido
            tj.pisoRespaldo = 0;
            tj.grilla = mapa.actualizar(t2, JX, JY, JZ, 0, -1);
            tj.empezar();
            int enCubierta = 0, tapados = 0, pasosCharco = 0, adentro2 = 0, pasos2 = 0, conRuta = 0;
            java.util.HashSet<Integer> cubiertos = new java.util.HashSet<>();
            for (int k = 0; k < 30 * 40; k++) {
                tj.actualizar(1 / 30f, JX, JY, JZ, 0, -1, e2);
                tj.tomarEventos();
                tj.vidaJugador = 100;
                for (Juego.Soldado s : tj.soldados) {
                    if (!Juego.enPie(s)) continue;
                    pasos2++;
                    if (s.ruta != null) conRuta++;
                    if (PruebaEscaneo.charco(s.x, s.z)) pasosCharco++;
                    if (PruebaMapa.verdad(s.x, s.z) == com.juniorspro.asaltomr.Mapa.OBSTACULO) adentro2++;
                    if (s.estado == Juego.CUBIERTA && s.agachado > 0.9f) {
                        enCubierta++;
                        cubiertos.add(s.id);
                        // ¿de verdad no lo ves? rayo de tu cara a su pecho agachado, contra la escena real
                        float cy = s.y + 1.1f - Juego.BAJA_AGACHADO;
                        float dx = s.x - JX, dy = cy - JY, dz = s.z - JZ, l = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
                        float tr = PruebaEscaneo.trazar(JX, JY, JZ, dx / l, dy / l, dz / l);
                        if (tr > 0 && tr < l - 0.2f) tapados++;
                    }
                }
            }
            System.out.printf("IA táctica 40 s: %d soldados se cubrieron, %.0f %% del tiempo con ruta, cubiertos de verdad %d/%d%n",
                    cubiertos.size(), 100.0 * conRuta / Math.max(1, pasos2), tapados, enCubierta);
            ver(cubiertos.size() >= 2, "los soldados buscan cubierta (" + cubiertos.size() + ")");
            ver(enCubierta > 0 && tapados >= enCubierta * 0.8, "agachados en la cubierta, de verdad no los ves (≥ 80 % del tiempo)");
            ver(pasosCharco == 0, "nunca pisan el charco (" + pasosCharco + ")");
            ver(adentro2 == 0, "nunca se meten en la mesa, el árbol o la pared (" + adentro2 + " de " + pasos2 + ")");
            // agachado recibe menos: el tiro a la altura del pecho parado le pasa por arriba
            Juego.Soldado ag = null;
            for (Juego.Soldado s : tj.soldados) if (s.estado == Juego.CUBIERTA && s.agachado > 0.9f) ag = s;
            if (ag != null) {
                Juego tiro = new Juego(1);
                tiro.soldados.add(ag);
                tiro.empezar();
                tiro.soldados.clear();
                tiro.soldados.add(ag);
                float hx = ag.x - JX, hy = ag.y + 1.45f - JY, hz = ag.z - JZ, hl = (float) Math.sqrt(hx * hx + hy * hy + hz * hz);
                Juego.Impacto im = tiro.disparar(JX, JY, JZ, hx / hl, hy / hl, hz / hl, JX, JY, JZ, e2);
                ver(im.tipo != Juego.Impacto.SOLDADO && im.tipo != Juego.Impacto.CABEZA, "agachado, el tiro a la altura del pecho parado no le pega");
            }
        }

        System.out.println(fallas == 0 ? "\n✓ todo bien" : "\n✗ " + fallas + " fallas");
        System.exit(fallas == 0 ? 0 : 1);
    }
}
