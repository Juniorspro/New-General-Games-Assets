package com.juniorspro.nexoxr;

import android.opengl.GLES20;

import java.nio.FloatBuffer;

/**
 * El dibujo de las ventanas en el espacio: la pantalla con las esquinas
 * redondeadas y una sombra suave, un borde que se enciende cuando la apuntás,
 * la barra de abajo para moverla con CERRAR y AMPLIAR a los costados, el
 * cursor y el rayo que sale de la mano.
 *
 * EL INDICADOR DE LA MANO (tres piezas que hablan igual):
 *  - entre la punta del pulgar y la del índice, un ANILLO que va de un dedo al
 *    otro: se achica al juntarlos y se llena al pellizcar (ves el pellizco
 *    antes de que cuente);
 *  - el RAYO sale de ahí: más grueso en la mano, fino en la punta, se prende a
 *    medida que cerrás los dedos;
 *  - el CURSOR donde pega: un punto y un anillo que se cierra sobre el punto
 *    al pellizcar (se llena mirando fijo).
 * Con el doble pellizco, después del primero los tres se ponen CELESTES, el
 * cursor muestra la cuenta de lo que queda para el segundo (un arco que se
 * acaba) y por el rayo corre un pulso hacia el cursor; apretando, azul lleno.
 *
 * Un solo programa: cada cosa es un rectángulo en el espacio (centro + dos
 * ejes) y el fragment shader la dibuja con distancias (bordes suaves a
 * cualquier distancia, sin texturas).
 */
final class VentanasGl {
    static final float CONTENIDO = 0, SOMBRA = 1, PILDORA = 2, BOTON = 3, CURSOR = 4, RAYO = 6, PLACA = 5;
    private int prog, aPos, uVp, uC, uR, uU, uModo, uTam, uRadio, uColor, uHover, uTex, uAlfa, uIcono, uFuerza, uCarga, uArmado;
    private final FloatBuffer cuadro = Gl.bufer(new float[]{-0.5f, -0.5f, 0.5f, -0.5f, -0.5f, 0.5f, 0.5f, 0.5f});
    private final float[] p = new float[3];

    void crear() {
        prog = Gl.programa(
                "uniform mat4 uVp; uniform vec3 uC; uniform vec3 uR; uniform vec3 uU; attribute vec2 aPos; varying vec2 vUv;\n"
                        + "void main() { vec3 w = uC + aPos.x * uR + aPos.y * uU; gl_Position = uVp * vec4(w, 1.0); vUv = aPos + 0.5; }",
                "precision mediump float;\n"
                        + "uniform sampler2D uTex; uniform float uModo; uniform vec2 uTam; uniform float uRadio; uniform vec4 uColor;\n"
                        + "uniform float uHover; uniform float uAlfa; uniform float uIcono; uniform float uFuerza; uniform float uCarga; uniform float uArmado; varying vec2 vUv;\n"
                        + "float caja(vec2 q, vec2 b, float r) { vec2 d = abs(q) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }\n"
                        + "float segmento(vec2 q, vec2 a, vec2 b) { vec2 pa = q - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }\n"
                        + "void main() {\n"
                        + "  vec2 q = (vUv - 0.5) * uTam;\n"
                        + "  float aa = max(uTam.x, uTam.y) * 0.004 + 0.0006;\n"
                        + "  if (uModo < 0.5) {\n"                                   // la pantalla
                        + "    float d = caja(q, uTam * 0.5, uRadio);\n"
                        + "    float a = 1.0 - smoothstep(-aa, 0.0, d);\n"
                        + "    vec3 c = texture2D(uTex, vUv).rgb;\n"
                        + "    float borde = (1.0 - smoothstep(0.0, 0.006, abs(d + 0.0025))) * uHover;\n"
                        + "    c = mix(c, vec3(0.62, 0.8, 1.0), borde * 0.7);\n"
                        + "    gl_FragColor = vec4(c, a * uAlfa);\n"
                        + "  } else if (uModo < 1.5) {\n"                             // la sombra (o el brillo) alrededor
                        + "    float d = caja(q, uTam * 0.5 - uRadio * 2.0, uRadio);\n"
                        + "    float a = 1.0 - smoothstep(0.0, uRadio * 2.0, d);\n"
                        + "    gl_FragColor = vec4(uColor.rgb, uColor.a * a * a * uAlfa);\n"
                        + "  } else if (uModo < 2.5) {\n"                             // la barra (píldora)
                        + "    float d = caja(q, uTam * 0.5, uTam.y * 0.5);\n"
                        + "    float a = 1.0 - smoothstep(-aa, 0.0, d);\n"
                        + "    gl_FragColor = vec4(uColor.rgb, uColor.a * a * uAlfa);\n"
                        + "  } else if (uModo < 3.5) {\n"                             // un botón redondo con su ícono
                        + "    float r = uTam.x * 0.5;\n"
                        + "    float d = length(q) - r;\n"
                        + "    float a = 1.0 - smoothstep(-aa, 0.0, d);\n"
                        + "    float s = r * 0.42, ic;\n"
                        + "    if (uIcono < 0.5) ic = min(segmento(q, vec2(-s), vec2(s)), segmento(q, vec2(-s, s), vec2(s, -s)));\n"   // X
                        + "    else { vec2 z = abs(q); ic = min(segmento(z, vec2(s * 0.35, s), vec2(s)), segmento(z, vec2(s, s * 0.35), vec2(s))); }\n"   // ampliar: 4 esquinas
                        + "    float linea = 1.0 - smoothstep(r * 0.07, r * 0.07 + aa, ic);\n"
                        + "    vec3 fondo = mix(vec3(0.16, 0.17, 0.2), vec3(0.3, 0.33, 0.4), uHover);\n"
                        + "    gl_FragColor = vec4(mix(fondo, vec3(1.0), linea), a * uAlfa * (0.75 + 0.25 * uHover));\n"
                        + "  } else if (uModo < 4.5) {\n"                             // el cursor (y el anillo entre los dedos)
                        + "    float r = length(q) / (uTam.x * 0.5);\n"
                        + "    float px = 1.0 / max(uTam.x * 0.5, 1e-4) * aa;\n"
                        + "    vec3 celeste = vec3(0.36, 0.86, 1.0);\n"
                        + "    float arm = step(0.001, uArmado);\n"
                        + "    vec3 col = mix(uColor.rgb, celeste, arm);\n"
                        + "    float ra = mix(0.30, 0.70, uFuerza);\n"                 // el anillo se cierra sobre el punto al pellizcar
                        + "    float g = 0.075 + 0.03 * (1.0 - uFuerza);\n"
                        + "    float anillo = 1.0 - smoothstep(g, g + 0.05 + px, abs(r - ra));\n"
                        + "    float punto = 1.0 - smoothstep(0.17, 0.23 + px, r);\n"
                        + "    float lleno = (1.0 - smoothstep(ra, ra + 0.06, r)) * (1.0 - uFuerza) * 0.55;\n"
                        + "    float ang = atan(q.x, q.y) / 6.2831853 + 0.5;\n"
                        + "    float cuenta = arm * step(ang, uArmado) * (1.0 - smoothstep(0.045, 0.085 + px, abs(r - 0.9)));\n"
                        + "    float surco = arm * (1.0 - smoothstep(0.03, 0.06 + px, abs(r - 0.9))) * 0.3;\n"
                        + "    float carga = uCarga > 0.0 && ang < uCarga ? 1.0 - smoothstep(0.06, 0.12, abs(r - 0.9)) : 0.0;\n"
                        + "    float sombra = (1.0 - smoothstep(0.6, 1.0, r)) * 0.5;\n"
                        + "    float a = max(max(max(anillo, punto), max(carga, cuenta)), max(lleno, surco));\n"
                        + "    vec3 c = mix(vec3(0.0), col, a / max(a + sombra * (1.0 - a), 0.001));\n"
                        + "    gl_FragColor = vec4(c, max(a, sombra) * uAlfa * uColor.a);\n"
                        + "  } else if (uModo < 5.5) {\n"                             // una placa (mientras carga la pantalla)
                        + "    float d = caja(q, uTam * 0.5, uRadio);\n"
                        + "    float a = 1.0 - smoothstep(-aa, 0.0, d);\n"
                        + "    float brillo = 0.5 + 0.5 * sin(vUv.x * 6.0 - uCarga * 4.0);\n"
                        + "    gl_FragColor = vec4(uColor.rgb * (0.85 + 0.15 * brillo), a * uColor.a * uAlfa);\n"
                        + "  } else {\n"                                               // el rayo: de la mano (x = 0) a donde pega (x = 1)
                        + "    float x = vUv.x, yy = abs(vUv.y - 0.5) * 2.0;\n"
                        + "    float w = mix(0.5, 0.16, x);\n"                                // grueso en la mano, fino en la punta
                        + "    float nucleo = 1.0 - smoothstep(w * 0.4, w, yy);\n"
                        + "    float halo = (1.0 - yy) * (1.0 - yy) * 0.35;\n"
                        + "    float largo = smoothstep(0.0, 0.18, x) * (1.0 - 0.45 * smoothstep(0.85, 1.0, x));\n"
                        + "    float prende = 0.6 + 0.4 * (1.0 - uFuerza);\n"
                        + "    float arm = step(0.001, uArmado);\n"
                        + "    float pb = max(0.0, 1.0 - abs(fract(x * 1.6 - uCarga * 2.4) - 0.5) * 6.0);\n"
                        + "    float pulso = arm * pb * pb;\n"
                        + "    vec3 col = mix(uColor.rgb, vec3(0.36, 0.86, 1.0), arm);\n"
                        + "    float a = (nucleo + halo) * largo * prende + pulso * nucleo * 0.9 * largo;\n"
                        + "    gl_FragColor = vec4(mix(col, vec3(1.0), nucleo * 0.35), min(1.0, uColor.a * a) * uAlfa);\n"
                        + "  }\n"
                        + "}");
        aPos = Gl.atributo(prog, "aPos");
        uVp = Gl.uniforme(prog, "uVp");
        uC = Gl.uniforme(prog, "uC");
        uR = Gl.uniforme(prog, "uR");
        uU = Gl.uniforme(prog, "uU");
        uModo = Gl.uniforme(prog, "uModo");
        uTam = Gl.uniforme(prog, "uTam");
        uRadio = Gl.uniforme(prog, "uRadio");
        uColor = Gl.uniforme(prog, "uColor");
        uHover = Gl.uniforme(prog, "uHover");
        uTex = Gl.uniforme(prog, "uTex");
        uAlfa = Gl.uniforme(prog, "uAlfa");
        uIcono = Gl.uniforme(prog, "uIcono");
        uFuerza = Gl.uniforme(prog, "uFuerza");
        uCarga = Gl.uniforme(prog, "uCarga");
        uArmado = Gl.uniforme(prog, "uArmado");
    }

    /** Empieza un grupo de dibujos con la matriz del ojo. */
    void empezar(float[] vp) {
        GLES20.glUseProgram(prog);
        GLES20.glUniformMatrix4fv(uVp, 1, false, vp, 0);
        cuadro.position(0);
        GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 0, cuadro);
        GLES20.glEnableVertexAttribArray(aPos);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);
        GLES20.glUniform1i(uTex, 0);
        GLES20.glUniform1f(uCarga, 0);
        GLES20.glUniform1f(uFuerza, 1);
        GLES20.glUniform1f(uArmado, 0);
    }

    void terminar() {
        GLES20.glDisableVertexAttribArray(aPos);
        GLES20.glDisable(GLES20.GL_BLEND);
        GLES20.glDepthMask(true);
    }

    /** Un rectángulo: centro (x, y en el plano de v, corrido z hacia adelante), tamaño en metros. */
    private void rect(Ventana v, float x, float y, float z, float w, float h) {
        v.aMundo(x, y, p);
        GLES20.glUniform3f(uC, p[0] + v.n[0] * z, p[1] + v.n[1] * z, p[2] + v.n[2] * z);
        GLES20.glUniform3f(uR, v.r[0] * w, v.r[1] * w, v.r[2] * w);
        GLES20.glUniform3f(uU, v.u[0] * h, v.u[1] * h, v.u[2] * h);
        GLES20.glUniform2f(uTam, w, h);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
    }

    static float radio(Ventana v) {
        return v.tipo == Ventana.DOCK ? Math.min(v.alto * 0.5f, 0.05f) : v.tipo == Ventana.TECLADO ? 0.025f : Math.min(0.035f, v.alto * 0.08f);
    }

    /** La ventana: la sombra, la pantalla (o una placa mientras carga) y el borde si la apuntan. */
    void ventana(Ventana v, int tex, boolean conImagen, float hover, float alfa, float t) {
        float esc = 0.94f + 0.06f * v.aparece, w = v.ancho * esc, h = v.alto * esc;
        float r = radio(v);
        // la sombra: más grande, suave, detrás
        GLES20.glDepthMask(false);
        GLES20.glUniform1f(uModo, SOMBRA);
        GLES20.glUniform1f(uRadio, 0.03f);
        GLES20.glUniform4f(uColor, hover > 0 ? 0.35f : 0f, hover > 0 ? 0.55f : 0f, hover > 0 ? 0.9f : 0f, 0.28f + 0.2f * hover);
        GLES20.glUniform1f(uAlfa, alfa);
        rect(v, 0, 0, -0.004f, w + 0.12f, h + 0.12f);
        GLES20.glDepthMask(true);
        GLES20.glUniform1f(uRadio, r);
        GLES20.glUniform1f(uHover, hover);
        if (conImagen) {
            GLES20.glUniform1f(uModo, CONTENIDO);
            GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex);
        } else {
            GLES20.glUniform1f(uModo, PLACA);
            GLES20.glUniform4f(uColor, 0.12f, 0.13f, 0.16f, 0.96f);
            GLES20.glUniform1f(uCarga, t);
        }
        rect(v, 0, 0, 0, w, h);
        GLES20.glUniform1f(uCarga, 0);
    }

    /** La barra de debajo y sus dos botones (se ven más al acercarse el cursor). */
    void barra(Ventana v, float hBarra, float hCerrar, float hAmpliar, float cerca, float alfa) {
        if (!v.tieneBarra()) return;
        float by = v.barraY(), a = alfa * (0.45f + 0.55f * cerca);
        GLES20.glDepthMask(false);
        GLES20.glUniform1f(uAlfa, a);
        GLES20.glUniform1f(uModo, PILDORA);
        float g = 0.72f + 0.28f * hBarra;
        GLES20.glUniform4f(uColor, g, g, g, 0.55f + 0.4f * hBarra);
        rect(v, 0, by, 0.002f, v.barraAncho() * (1 + 0.08f * hBarra), Ventana.BARRA_ALTO * (1 + 0.25f * hBarra));
        if (cerca > 0.05f) {
            GLES20.glUniform1f(uAlfa, alfa * cerca);
            GLES20.glUniform1f(uModo, BOTON);
            float d = Ventana.BOTON_R * 2;
            GLES20.glUniform1f(uIcono, 0);
            GLES20.glUniform1f(uHover, hCerrar);
            rect(v, v.cerrarX(), by, 0.002f, d * (1 + 0.15f * hCerrar), d * (1 + 0.15f * hCerrar));
            GLES20.glUniform1f(uIcono, 1);
            GLES20.glUniform1f(uHover, hAmpliar);
            rect(v, v.ampliarX(), by, 0.002f, d * (1 + 0.15f * hAmpliar), d * (1 + 0.15f * hAmpliar));
        }
        GLES20.glDepthMask(true);
    }

    /**
     * El cursor donde pega el rayo (sobre el plano de v): fuerza 1 = suelto, 0 = pellizcando; carga 0..1
     * mirando fijo; armado 1..0 = ya se hizo el primer pellizco y lo que queda para el segundo.
     */
    void cursor(Ventana v, float x, float y, float dist, float fuerza, float carga, boolean dedo) { cursor(v, x, y, dist, fuerza, carga, dedo, 0, false); }

    void cursor(Ventana v, float x, float y, float dist, float fuerza, float carga, boolean dedo, float armado, boolean apretando) {
        float tam = Math.max(0.022f, dist * 0.05f) * (dedo ? 0.8f : 1f);
        GLES20.glDepthMask(false);
        GLES20.glUniform1f(uModo, CURSOR);
        GLES20.glUniform1f(uAlfa, 1);
        GLES20.glUniform1f(uFuerza, fuerza);
        GLES20.glUniform1f(uCarga, carga);
        GLES20.glUniform1f(uArmado, armado);
        if (apretando) GLES20.glUniform4f(uColor, 0.45f, 0.72f, 1f, 1);
        else if (dedo) GLES20.glUniform4f(uColor, 0.55f, 0.85f, 1f, 1);
        else GLES20.glUniform4f(uColor, 1, 1, 1, 1);
        rect(v, x, y, 0.004f, tam, tam);
        GLES20.glUniform1f(uCarga, 0);
        GLES20.glUniform1f(uFuerza, 1);
        GLES20.glUniform1f(uArmado, 0);
        GLES20.glDepthMask(true);
    }

    /**
     * El anillo entre las puntas del pulgar (a) y del índice (b), de frente al ojo: va de un dedo al otro
     * (se achica al juntarlos), se llena pellizcando, celeste si está armado.
     */
    void pinza(float[] a, float[] b, float[] ojo, float fuerza, float armado, boolean apretando, float alfa) {
        float cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, cz = (a[2] + b[2]) / 2;
        float dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
        float tam = Math.max(0.016f, Math.min(0.06f, (float) Math.sqrt(dx * dx + dy * dy + dz * dz) * 1.15f + 0.008f));
        // de frente al ojo
        float vx = cx - ojo[0], vy = cy - ojo[1], vz = cz - ojo[2];
        float vl = (float) Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (vl < 1e-4f) return;
        vx /= vl; vy /= vl; vz /= vl;
        float rx = -vz, rz = vx, rl = (float) Math.sqrt(rx * rx + rz * rz);   // (v × arriba)
        if (rl < 1e-4f) { rx = 1; rz = 0; rl = 1; }
        rx /= rl; rz /= rl;
        float ux = -rz * vy, uy = rz * vx - rx * vz, uz = rx * vy;               // (r × v)
        GLES20.glDepthMask(false);
        GLES20.glUniform1f(uModo, CURSOR);
        GLES20.glUniform1f(uAlfa, alfa);
        GLES20.glUniform1f(uFuerza, fuerza);
        GLES20.glUniform1f(uArmado, armado);
        if (apretando) GLES20.glUniform4f(uColor, 0.45f, 0.72f, 1f, 0.95f);
        else GLES20.glUniform4f(uColor, 1, 1, 1, 0.8f);
        GLES20.glUniform3f(uC, cx, cy, cz);
        GLES20.glUniform3f(uR, rx * tam, 0, rz * tam);
        GLES20.glUniform3f(uU, ux * tam, uy * tam, uz * tam);
        GLES20.glUniform2f(uTam, tam, tam);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glUniform1f(uFuerza, 1);
        GLES20.glUniform1f(uArmado, 0);
        GLES20.glDepthMask(true);
    }

    /** El rayo de la mano: de a (cerca de la mano) a b (donde pega), mirado desde el ojo. */
    void rayo(float ax, float ay, float az, float bx, float by, float bz, float[] ojo, float alfa, boolean apretando) {
        rayo(ax, ay, az, bx, by, bz, ojo, alfa, apretando ? 0 : 1, 0, apretando, 0);
    }

    /** fuerza: 1 = dedos sueltos, 0 = pellizcando (se prende); armado > 0: celeste con un pulso que corre (t en s). */
    void rayo(float ax, float ay, float az, float bx, float by, float bz, float[] ojo, float alfa, float fuerza, float armado, boolean apretando, float t) {
        float dx = bx - ax, dy = by - ay, dz = bz - az;
        float ex = ojo[0] - (ax + bx) / 2, ey = ojo[1] - (ay + by) / 2, ez = ojo[2] - (az + bz) / 2;
        // de costado: perpendicular al rayo y a la mirada
        float sx = dy * ez - dz * ey, sy = dz * ex - dx * ez, sz = dx * ey - dy * ex;
        float sl = (float) Math.sqrt(sx * sx + sy * sy + sz * sz);
        if (sl < 1e-6f) return;
        float ancho = 0.011f;   // con el halo (el núcleo va de 3 mm en la mano a 1 mm en la punta)
        sx *= ancho / sl; sy *= ancho / sl; sz *= ancho / sl;
        GLES20.glDepthMask(false);
        GLES20.glUniform1f(uModo, RAYO);
        GLES20.glUniform1f(uAlfa, alfa);
        GLES20.glUniform1f(uFuerza, fuerza);
        GLES20.glUniform1f(uArmado, armado);
        GLES20.glUniform1f(uCarga, t % 1000f);
        if (apretando) GLES20.glUniform4f(uColor, 0.45f, 0.72f, 1f, 0.95f);
        else GLES20.glUniform4f(uColor, 1f, 1f, 1f, 0.8f);
        GLES20.glUniform3f(uC, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
        GLES20.glUniform3f(uR, dx, dy, dz);
        GLES20.glUniform3f(uU, sx, sy, sz);
        GLES20.glUniform2f(uTam, 1, 1);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glUniform1f(uCarga, 0);
        GLES20.glUniform1f(uFuerza, 1);
        GLES20.glUniform1f(uArmado, 0);
        GLES20.glDepthMask(true);
    }
}
