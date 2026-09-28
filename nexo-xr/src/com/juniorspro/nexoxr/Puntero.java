package com.juniorspro.nexoxr;

/**
 * EL PUNTERO: de las manos, la mirada, el control y el dedo en la pantalla a
 * TOQUES en las ventanas (bajar, mover, subir: lo que entiende Android, así un
 * pellizco rápido es un clic y pellizcar y mover es arrastrar o hacer scroll).
 *
 * Cada fuente trae un rayo y si está apretando:
 *  - MANO (izquierda / derecha): el rayo sale del punto de mira por los
 *    nudillos, y aprieta con el PELLIZCO (pulgar con índice). Además, si la
 *    punta del índice llega a una ventana, TOCA con el dedo (como una pantalla
 *    táctil): bajar al cruzar el plano, subir al salir.
 *  - MIRADA: el centro de la vista; aprieta con el control o, si no hay nada
 *    más, MIRANDO FIJO un botón 1.1 s.
 *  - PANTALLA: el dedo en el teléfono (sin visor), como un mouse.
 *
 * Tres cosas para que el clic caiga donde apuntabas (como en los visores):
 *  1. al pellizcar la mano se mueve: el clic usa el rayo de hace 80 ms (o,
 *     con el doble pellizco, el de antes del PRIMER pellizco si desde ahí el
 *     rayo no se fue más de 4°: los dos pellizcos corren la mano dos veces);
 *  2. hasta que el rayo se mueve más de 1.2° (o el dedo 1.2 cm) se sigue
 *     informando el punto donde se bajó: un clic no se vuelve un arrastre;
 *  3. lo que se agarró queda agarrado hasta soltar (aunque el rayo se salga).
 *
 * Sin Android: se prueba en la PC (pruebas/PruebaPuntero.java).
 */
public final class Puntero {
    public static final int MANO_IZQ = 0, MANO_DER = 1, MIRADA = 2, PANTALLA = 3;
    public static final int BAJA = 0, MUEVE = 1, SUBE = 2, CANCELA = 3;
    static final float SLOP = (float) Math.toRadians(1.2), SLOP_DEDO = 0.012f;
    static final long ATRAS_MS = 80;
    static final float FIJO = (float) Math.cos(Math.toRadians(4));
    /** El dedo: toca a menos de TOCA del plano; suelta a más de SUELTA; lo "sobrevuela" hasta CERCA. */
    static final float TOCA = 0.012f, SUELTA = 0.03f, CERCA = 0.07f, DETRAS = -0.06f;
    public static final float MIRADA_S = 1.1f;

    public interface Oyente {
        /** Un toque en el contenido de v (u, v ∈ 0..1). */
        void toque(Ventana v, int accion, float u, float w, int fuente);
        /** Se tocó un botón de la ventana (CERRAR, AMPLIAR). */
        void boton(Ventana v, int que);
        /** Un pellizco (o clic) en la nada: corto (largo = false) o sostenido 0.8 s (largo = true). */
        void enLaNada(int fuente, boolean largo);
    }

    public static final class Fuente {
        // lo que entra, cada cuadro
        public boolean activa, aprieta, conDedo;
        public float ox, oy, oz, dx, dy, dz;
        /** La punta del índice (para tocar con el dedo). */
        public float tx, ty, tz;
        /** El rayo de antes del primer pellizco (doble pellizco): el clic va ahí si no te moviste. */
        public boolean fijoVale;
        public float fox, foy, foz, fdx, fdy, fdz;

        // lo que sale (para dibujar el cursor)
        public Ventana sobre;
        public int que;
        public float u, v, hx, hy, hz, dist;
        /** Tocando con el dedo (o sobrevolando: la distancia del dedo al plano). */
        public boolean tocando, dedoCerca;
        public float dedoDist;
        /** Mirada fija: cuánto va (0..1). */
        public float carga;
        public boolean apretado;

        // estado
        Ventana captura;
        int queCaptura;
        float bajaU, bajaV, bajaDx, bajaDy, bajaDz, bajaTx, bajaTy, bajaTz;
        boolean pasoSlop;
        float nadaDesde = -1;
        boolean nadaLarga;
        // el rayo de los últimos cuadros (para el clic estable)
        final float[][] hist = new float[16][7];
        int nh;
        // mirada fija
        Ventana cargaV;
        int cargaQue;
        float cargaU, cargaV2, enfriar;

        void guardar(long ms) {
            float[] h = hist[nh % hist.length];
            h[0] = ms; h[1] = ox; h[2] = oy; h[3] = oz; h[4] = dx; h[5] = dy; h[6] = dz;
            nh++;
        }

        /** El rayo de hace 'atras' ms (o el más viejo que haya). */
        void rayoDe(long ms, float[] o) {
            int n = Math.min(nh, hist.length);
            float[] mejor = null;
            for (int k = 1; k <= n; k++) {
                float[] h = hist[(nh - k) % hist.length];
                mejor = h;
                if (ms - h[0] >= ATRAS_MS) break;
            }
            if (mejor == null) { o[0] = ox; o[1] = oy; o[2] = oz; o[3] = dx; o[4] = dy; o[5] = dz; return; }
            System.arraycopy(mejor, 1, o, 0, 6);
        }
    }

    public final Fuente[] fuentes = {new Fuente(), new Fuente(), new Fuente(), new Fuente()};
    /** Mirar fijo para hacer clic (si no hay manos ni control ni pantalla apretando). */
    public boolean clicConMirada = true;
    /** Tocar con el dedo. */
    public boolean conDedo = true;
    private final float[] s = new float[6], r0 = new float[6], uv = new float[2];

    /** Un paso: lee cada fuente, dispara los toques. hx..: la cabeza (para arrastrar de frente a vos). */
    public void paso(Escritorio e, float dt, long ms, float hx, float hy, float hz, Oyente o) {
        boolean algoApretando = false;
        for (int k = 0; k < fuentes.length; k++) if (k != MIRADA && fuentes[k].activa && (fuentes[k].apretado || fuentes[k].tocando)) algoApretando = true;
        boolean algunaMano = fuentes[MANO_IZQ].activa || fuentes[MANO_DER].activa;
        for (int k = 0; k < fuentes.length; k++) {
            Fuente f = fuentes[k];
            if (!f.activa) { soltar(e, f, k, o, true); f.sobre = null; f.carga = 0; f.dedoCerca = false; f.nh = 0; continue; }
            f.guardar(ms);
            // ── el dedo: si está cerca de una ventana, manda el dedo (no el rayo) ──
            if ((k == MANO_IZQ || k == MANO_DER) && conDedo && f.conDedo && dedo(e, f, k, o)) continue;
            // ── el rayo ──
            Ventana v = f.captura != null ? f.captura : e.impacto(f.ox, f.oy, f.oz, f.dx, f.dy, f.dz, s);
            if (f.captura != null) {
                // agarrada: se sigue el plano de la que se agarró
                float t = f.captura.impacto(f.ox, f.oy, f.oz, f.dx, f.dy, f.dz, s);
                if (t < 0) planoSinLimite(f.captura, f, s);
                else s[5] = t;
            }
            f.sobre = v;
            f.que = v == null ? Ventana.NADA : (int) s[0];
            if (v != null) {
                f.u = s[1]; f.v = s[2]; f.dist = s[5];
                f.hx = f.ox + f.dx * s[5]; f.hy = f.oy + f.dy * s[5]; f.hz = f.oz + f.dz * s[5];
            }
            boolean aprieta = f.aprieta;
            if (aprieta && !f.apretado) {
                f.apretado = true;
                // el clic, con el rayo de hace un rato (al pellizcar la mano se corre)
                Ventana vb = v;
                if (k == MANO_IZQ || k == MANO_DER) {
                    f.rayoDe(ms, r0);
                    if (f.fijoVale && f.dx * f.fdx + f.dy * f.fdy + f.dz * f.fdz > FIJO) {
                        r0[0] = f.fox; r0[1] = f.foy; r0[2] = f.foz; r0[3] = f.fdx; r0[4] = f.fdy; r0[5] = f.fdz;
                    }
                    Ventana vv = e.impacto(r0[0], r0[1], r0[2], r0[3], r0[4], r0[5], s);
                    if (vv != null) { vb = vv; f.que = (int) s[0]; f.u = s[1]; f.v = s[2]; }
                }
                bajar(e, f, k, vb, f.que, f.u, f.v, s[3], s[4], ms, o);
            } else if (aprieta && f.apretado) {
                mover(e, f, k, hx, hy, hz, o);
            } else if (!aprieta && f.apretado) {
                f.apretado = false;
                soltar(e, f, k, o, false);
            }
            // pellizco sostenido en la nada
            if (f.apretado && f.captura == null && f.queCaptura == Ventana.NADA && f.nadaDesde >= 0) {
                f.nadaDesde += dt;
                if (!f.nadaLarga && f.nadaDesde > 0.8f) { f.nadaLarga = true; o.enLaNada(k, true); }
            }
            // ── mirar fijo (sólo la mirada, y sólo si nada más está en uso) ──
            if (k == MIRADA) mirada(e, f, dt, clicConMirada && !algoApretando && !algunaMano && !f.apretado, o);
        }
    }

    private void bajar(Escritorio e, Fuente f, int k, Ventana v, int que, float u, float w, float x, float y, long ms, Oyente o) {
        f.captura = null;
        f.queCaptura = Ventana.NADA;
        f.nadaDesde = -1;
        f.nadaLarga = false;
        if (v == null) { f.nadaDesde = 0; return; }
        // una ventana ya agarrada por otra fuente: no
        for (Fuente g : fuentes) if (g != f && g.captura == v && g.queCaptura == que) return;
        f.captura = v;
        f.queCaptura = que;
        if (v.tipo == Ventana.APP) e.enfocar(v);
        f.bajaDx = f.dx; f.bajaDy = f.dy; f.bajaDz = f.dz;
        f.pasoSlop = false;
        if (que == Ventana.CONTENIDO) {
            f.bajaU = u; f.bajaV = w;
            o.toque(v, BAJA, u, w, k);
        } else if (que == Ventana.BARRA) {
            e.empezarArrastre(v, f.ox, f.oy, f.oz, x, y);
        }
    }

    private void mover(Escritorio e, Fuente f, int k, float hx, float hy, float hz, Oyente o) {
        Ventana v = f.captura;
        if (v == null) return;
        if (f.queCaptura == Ventana.BARRA) { e.arrastrar(f.ox, f.oy, f.oz, f.dx, f.dy, f.dz, hx, hy, hz); return; }
        if (f.queCaptura != Ventana.CONTENIDO) return;
        if (!f.pasoSlop) {
            float c = f.dx * f.bajaDx + f.dy * f.bajaDy + f.dz * f.bajaDz;
            if (c < Math.cos(SLOP)) f.pasoSlop = true;
        }
        float uu = f.pasoSlop ? f.u : f.bajaU, vv = f.pasoSlop ? f.v : f.bajaV;
        o.toque(v, MUEVE, clamp(uu), clamp(vv), k);
    }

    private void soltar(Escritorio e, Fuente f, int k, Oyente o, boolean cancelar) {
        Ventana v = f.captura;
        if (f.tocando) {
            f.tocando = false;
            if (v != null) o.toque(v, cancelar ? CANCELA : SUBE, clamp(f.pasoSlop ? f.u : f.bajaU), clamp(f.pasoSlop ? f.v : f.bajaV), k);
            f.captura = null;
            return;
        }
        if (v != null) {
            if (f.queCaptura == Ventana.CONTENIDO) {
                float uu = f.pasoSlop ? f.u : f.bajaU, vv = f.pasoSlop ? f.v : f.bajaV;
                o.toque(v, cancelar ? CANCELA : SUBE, clamp(uu), clamp(vv), k);
            } else if (f.queCaptura == Ventana.BARRA) {
                e.soltarArrastre();
            } else if (!cancelar && (f.queCaptura == Ventana.CERRAR || f.queCaptura == Ventana.AMPLIAR) && f.sobre == v && f.que == f.queCaptura) {
                o.boton(v, f.queCaptura);
            }
        } else if (!cancelar && f.nadaDesde >= 0 && !f.nadaLarga) {
            o.enLaNada(k, false);
        }
        f.captura = null;
        f.queCaptura = Ventana.NADA;
        f.nadaDesde = -1;
        f.apretado = false;
    }

    /** El dedo cerca de una ventana: tocar como en una pantalla. true si el dedo manda (el rayo no se usa). */
    private boolean dedo(Escritorio e, Fuente f, int k, Oyente o) {
        if (f.tocando) {
            Ventana v = f.captura;
            float d = v.distancia(f.tx, f.ty, f.tz, uv);
            f.dedoDist = d;
            f.u = uv[0]; f.v = uv[1];
            if (!f.pasoSlop) {
                float mx = f.tx - f.bajaTx, my = f.ty - f.bajaTy, mz = f.tz - f.bajaTz;
                // lo que se movió en el plano (no hacia adentro)
                float adentro = mx * v.n[0] + my * v.n[1] + mz * v.n[2];
                float lat2 = mx * mx + my * my + mz * mz - adentro * adentro;
                if (lat2 > SLOP_DEDO * SLOP_DEDO) f.pasoSlop = true;
            }
            f.hx = f.tx - v.n[0] * d; f.hy = f.ty - v.n[1] * d; f.hz = f.tz - v.n[2] * d;
            if (d > SUELTA || d < DETRAS) {
                soltar(e, f, k, o, d < DETRAS);
                return true;
            }
            o.toque(v, MUEVE, clamp(f.pasoSlop ? f.u : f.bajaU), clamp(f.pasoSlop ? f.v : f.bajaV), k);
            return true;
        }
        if (f.apretado) return false;   // pellizcando con el rayo: sigue el rayo
        // ¿alguna ventana con el dedo encima, cerca?
        Ventana mejor = null;
        float md = CERCA, mu = 0, mv = 0;
        for (Ventana v : e.ventanas) {
            if (!v.visible) continue;
            float d = v.distancia(f.tx, f.ty, f.tz, uv);
            if (d < DETRAS || d > md || uv[0] < 0 || uv[0] > 1 || uv[1] < 0 || uv[1] > 1) continue;
            md = d; mejor = v; mu = uv[0]; mv = uv[1];
        }
        f.dedoCerca = mejor != null;
        if (mejor == null) return false;
        f.sobre = mejor;
        f.que = Ventana.CONTENIDO;
        f.u = mu; f.v = mv;
        f.dedoDist = md;
        f.hx = f.tx - mejor.n[0] * md; f.hy = f.ty - mejor.n[1] * md; f.hz = f.tz - mejor.n[2] * md;
        if (md < TOCA) {
            f.tocando = true;
            f.captura = mejor;
            f.queCaptura = Ventana.CONTENIDO;
            f.bajaU = mu; f.bajaV = mv;
            f.bajaTx = f.tx; f.bajaTy = f.ty; f.bajaTz = f.tz;
            f.pasoSlop = false;
            if (mejor.tipo == Ventana.APP) e.enfocar(mejor);
            o.toque(mejor, BAJA, mu, mv, k);
        }
        return true;
    }

    /** Mirar fijo un botón (o un lugar de una ventana) MIRADA_S segundos: un clic. */
    private void mirada(Escritorio e, Fuente f, float dt, boolean habilitada, Oyente o) {
        if (f.enfriar > 0) f.enfriar -= dt;
        if (!habilitada || f.sobre == null || f.enfriar > 0) { f.carga = 0; f.cargaV = null; return; }
        boolean mismo = f.cargaV == f.sobre && f.cargaQue == f.que
                && (f.que != Ventana.CONTENIDO || Math.abs(f.u - f.cargaU) * f.sobre.ancho + Math.abs(f.v - f.cargaV2) * f.sobre.alto < 0.035f);
        if (!mismo) { f.cargaV = f.sobre; f.cargaQue = f.que; f.cargaU = f.u; f.cargaV2 = f.v; f.carga = 0; return; }
        f.carga += dt / MIRADA_S;
        if (f.carga < 1) return;
        f.carga = 0;
        f.enfriar = 1.2f;
        Ventana v = f.sobre;
        if (f.que == Ventana.CONTENIDO) {
            o.toque(v, BAJA, f.cargaU, f.cargaV2, MIRADA);
            o.toque(v, SUBE, f.cargaU, f.cargaV2, MIRADA);
            if (v.tipo == Ventana.APP) e.enfocar(v);
        } else if (f.que == Ventana.CERRAR || f.que == Ventana.AMPLIAR) o.boton(v, f.que);
    }

    /** Dónde cae el rayo en el plano (infinito) de v: para seguir un arrastre aunque se salga. */
    private static void planoSinLimite(Ventana v, Fuente f, float[] s) {
        float den = f.dx * v.n[0] + f.dy * v.n[1] + f.dz * v.n[2];
        if (Math.abs(den) < 1e-4f) return;
        float t = ((v.cx - f.ox) * v.n[0] + (v.cy - f.oy) * v.n[1] + (v.cz - f.oz) * v.n[2]) / den;
        if (t < 0) return;
        float hx = f.ox + f.dx * t - v.cx, hy = f.oy + f.dy * t - v.cy, hz = f.oz + f.dz * t - v.cz;
        float x = hx * v.r[0] + hy * v.r[1] + hz * v.r[2], y = hx * v.u[0] + hy * v.u[1] + hz * v.u[2];
        s[0] = Ventana.CONTENIDO; s[1] = x / v.ancho + 0.5f; s[2] = 0.5f - y / v.alto; s[3] = x; s[4] = y; s[5] = t;
    }

    private static float clamp(float x) { return Math.max(-0.02f, Math.min(1.02f, x)); }
}
