package com.juniorspro.nexoxr;

import android.opengl.GLES20;
import android.opengl.Matrix;

import java.nio.FloatBuffer;

/**
 * Los ENTORNOS 3D (como las casas virtuales de los visores): el lugar donde
 * flotan las pantallas. Cada uno es un shader que calcula, para cada píxel, qué
 * se ve en esa dirección (cielo, estrellas, un planeta, el agua, las paredes de
 * un living), con cuentas cerradas (esferas, planos, cajas) y ruido: nada de
 * mallas ni texturas, se ve igual de nítido en los dos ojos y anda rápido.
 *
 *   ESPACIO   estrellas, una nebulosa, un planeta con su atmósfera, una luna y
 *             una plataforma de vidrio bajo tus pies;
 *   LAGO      atardecer: el sol bajo, nubes, montañas, un muelle de madera y
 *             el agua que refleja el cielo;
 *   LIVING    piso de madera con alfombra, paredes, una ventana enorme al
 *             bosque, una chimenea encendida, un sillón y una mesa ratona.
 *
 * (PASSTHROUGH, la cámara, lo dibuja Fondo.)
 */
final class Entornos {
    static final int PASSTHROUGH = 0, ESPACIO = 1, LAGO = 2, LIVING = 3;
    static final String[] NOMBRES = {"Passthrough", "Espacio", "Lago al atardecer", "Living"};
    static final int CANTIDAD = 4;

    static final String VS = "attribute vec2 aPos; varying vec2 vNdc; void main() { gl_Position = vec4(aPos, 0.9999, 1.0); vNdc = aPos; }";

    /** Lo común: precisión, el rayo de cada píxel, ruido. */
    static final String COMUN =
            "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n"
                    + "uniform mat4 uInv; uniform vec3 uOjo; uniform float uT; uniform float uPiso; uniform vec2 uAncla; uniform float uLuz; varying vec2 vNdc;\n"
                    + "vec3 rayo() { vec4 a = uInv * vec4(vNdc, -1.0, 1.0); vec4 b = uInv * vec4(vNdc, 1.0, 1.0); return normalize(b.xyz / b.w - a.xyz / a.w); }\n"
                    + "float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\n"
                    + "float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\n"
                    + "float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\n"
                    + "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }\n"
                    + "float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * ruido(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }\n"
                    + "vec3 terminar(vec3 c) { c = c / (1.0 + c * 0.25); return pow(max(c, 0.0), vec3(0.95)) * uLuz; }\n";

    static final String ESPACIO_FS = COMUN
            + "vec3 estrellas(vec3 d) {\n"
            + "  vec3 c = vec3(0.0);\n"
            + "  for (int k = 0; k < 2; k++) {\n"
            + "    float esc = k == 0 ? 90.0 : 220.0;\n"
            + "    vec3 q = d * esc, i = floor(q), f = fract(q) - 0.5;\n"
            + "    float h = hash3(i + float(k) * 17.0);\n"
            + "    if (h > 0.965) {\n"
            + "      vec3 o = vec3(hash3(i + 3.1), hash3(i + 7.7), hash3(i + 1.3)) - 0.5;\n"
            + "      float r = length(f - o * 0.6);\n"
            + "      float b = (h - 0.965) / 0.035; b = b * b * (k == 0 ? 2.2 : 1.0);\n"
            + "      float tw = 0.75 + 0.25 * sin(uT * (1.0 + h * 3.0) + h * 40.0);\n"
            + "      vec3 col = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), hash3(i + 5.5));\n"
            + "      c += col * b * tw * smoothstep(0.09, 0.0, r);\n"
            + "    }\n"
            + "  }\n"
            + "  return c;\n"
            + "}\n"
            + "void main() {\n"
            + "  vec3 d = rayo();\n"
            + "  vec3 sol = normalize(vec3(0.6, 0.35, -0.7));\n"
            + "  // la nebulosa y el fondo\n"
            + "  vec2 uv = vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0))) * 1.6;\n"
            + "  float n1 = fbm(uv * 1.3 + 3.0), n2 = fbm(uv * 2.6 - 7.0);\n"
            + "  vec3 c = vec3(0.004, 0.006, 0.02) + vec3(0.25, 0.07, 0.35) * pow(n1, 3.0) * 1.4 + vec3(0.02, 0.2, 0.28) * pow(n2, 4.0) * 1.6;\n"
            + "  c += estrellas(d);\n"
            + "  // el sol lejano\n"
            + "  float s = max(dot(d, sol), 0.0);\n"
            + "  c += vec3(1.0, 0.9, 0.75) * (smoothstep(0.99985, 0.9999, s) * 4.0 + pow(s, 400.0) * 0.6 + pow(s, 40.0) * 0.05);\n"
            + "  // el planeta (y su atmósfera)\n"
            + "  vec3 pc = vec3(uAncla.x - 9.0, uPiso + 4.0, uAncla.y - 28.0); float pr = 8.5;\n"
            + "  vec3 oc = uOjo - pc; float b = dot(oc, d), h = b * b - dot(oc, oc) + pr * pr;\n"
            + "  float cerca = length(cross(pc - uOjo, d));\n"
            + "  float atm = smoothstep(pr + 1.6, pr, cerca) * (1.0 - smoothstep(pr, pr - 0.3, cerca));\n"
            + "  if (h > 0.0) {\n"
            + "    float t = -b - sqrt(h); vec3 p = uOjo + d * t, n = normalize(p - pc);\n"
            + "    float lat = n.y * 3.0 + fbm(n.xz * 3.0) * 1.2;\n"
            + "    vec3 base = mix(vec3(0.75, 0.45, 0.28), vec3(0.95, 0.8, 0.6), 0.5 + 0.5 * sin(lat * 3.0));\n"
            + "    base = mix(base, vec3(0.5, 0.3, 0.25), smoothstep(0.55, 0.8, fbm(n.xy * 5.0 + 2.0)));\n"
            + "    float luz = max(dot(n, sol), 0.0);\n"
            + "    float rim = pow(1.0 - max(dot(n, -d), 0.0), 3.0);\n"
            + "    c = base * (0.02 + 1.1 * luz) + vec3(0.35, 0.55, 1.0) * rim * (0.2 + luz);\n"
            + "  } else c += vec3(0.3, 0.5, 1.0) * atm * 0.5;\n"
            + "  // la luna\n"
            + "  vec3 lc = vec3(uAncla.x + 14.0, uPiso + 9.0, uAncla.y - 30.0); float lr = 1.6;\n"
            + "  oc = uOjo - lc; b = dot(oc, d); h = b * b - dot(oc, oc) + lr * lr;\n"
            + "  if (h > 0.0) { vec3 p = uOjo + d * (-b - sqrt(h)), n = normalize(p - lc);\n"
            + "    float cr = smoothstep(0.55, 0.75, fbm(n.xy * 9.0 + n.z * 4.0));\n"
            + "    c = vec3(0.8, 0.8, 0.82) * (1.0 - 0.35 * cr) * (0.03 + max(dot(n, sol), 0.0)); }\n"
            + "  // la plataforma de vidrio (un disco bajo tus pies)\n"
            + "  if (d.y < -0.001) {\n"
            + "    float t = (uPiso - uOjo.y) / d.y; vec3 p = uOjo + d * t; vec2 q = p.xz - uAncla; float r = length(q);\n"
            + "    if (r < 2.6) {\n"
            + "      float anillos = 1.0 - smoothstep(0.0, 0.02, abs(fract(r * 2.0) - 0.5) - 0.47);\n"
            + "      float borde = smoothstep(2.35, 2.6, r);\n"
            + "      vec3 vidrio = vec3(0.03, 0.05, 0.09) + vec3(0.1, 0.35, 0.6) * (anillos * 0.25 + borde * 1.2);\n"
            + "      c = mix(c, vidrio + estrellas(reflect(d, vec3(0.0, 1.0, 0.0))) * 0.25, 0.88 * (1.0 - smoothstep(2.5, 2.6, r)));\n"
            + "    }\n"
            + "  }\n"
            + "  gl_FragColor = vec4(terminar(c), 1.0);\n"
            + "}\n";

    static final String LAGO_FS = COMUN
            + "vec3 sol() { return normalize(vec3(-0.25, 0.07, -1.0)); }\n"
            + "float montes(float az) { return 0.035 + 0.075 * fbm(vec2(az * 2.2, 1.0)) + 0.05 * fbm(vec2(az * 6.0, 3.0)) * 0.5; }\n"
            + "vec3 cielo(vec3 d) {\n"
            + "  vec3 s = sol(); float y = max(d.y, 0.0);\n"
            + "  vec3 c = mix(vec3(1.0, 0.55, 0.3), vec3(0.18, 0.28, 0.55), pow(y, 0.45));\n"
            + "  c = mix(c, vec3(0.05, 0.08, 0.22), smoothstep(0.35, 1.0, y));\n"
            + "  float m = max(dot(d, s), 0.0);\n"
            + "  c += vec3(1.0, 0.6, 0.3) * pow(m, 8.0) * 0.6 + vec3(1.0, 0.85, 0.6) * pow(m, 90.0) * 1.2 + vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9996, m) * 5.0;\n"
            + "  // las nubes: una capa arriba\n"
            + "  if (d.y > 0.02) {\n"
            + "    vec2 q = d.xz / d.y * 1.2 + vec2(uT * 0.01, 0.0);\n"
            + "    float n = fbm(q * 0.9);\n"
            + "    float nube = smoothstep(0.5, 0.78, n) * smoothstep(0.02, 0.2, d.y);\n"
            + "    vec3 cn = mix(vec3(0.35, 0.22, 0.32), vec3(1.0, 0.62, 0.4), pow(m, 3.0) * 0.8 + 0.2 * n);\n"
            + "    c = mix(c, cn, nube * 0.85);\n"
            + "  }\n"
            + "  return c;\n"
            + "}\n"
            + "void main() {\n"
            + "  vec3 d = rayo();\n"
            + "  vec3 c;\n"
            + "  float az = atan(d.x, -d.z);\n"
            + "  float el = asin(clamp(d.y, -1.0, 1.0));\n"
            + "  float mt = montes(az);\n"
            + "  if (el > mt) c = cielo(d);\n"
            + "  else if (el > 0.0) {\n"
            + "    float neblina = smoothstep(0.0, mt, el);\n"
            + "    c = mix(vec3(0.62, 0.38, 0.4), vec3(0.16, 0.12, 0.2), neblina);\n"
            + "    c += vec3(1.0, 0.5, 0.25) * pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sol().x, 0.0, sol().z))), 0.0), 20.0) * 0.25 * (1.0 - neblina);\n"
            + "  } else {\n"
            + "    // el muelle (madera) o el agua\n"
            + "    float tm = (uPiso - uOjo.y) / min(d.y, -0.0001); vec3 pm = uOjo + d * tm; vec2 qm = pm.xz - uAncla;\n"
            + "    if (abs(qm.x) < 1.4 && qm.y < 1.8 && qm.y > -3.2) {\n"
            + "      float tabla = floor(qm.x * 5.0);\n"
            + "      float veta = fbm(vec2(qm.x * 40.0, qm.y * 2.0 + tabla * 13.0));\n"
            + "      vec3 madera = mix(vec3(0.3, 0.17, 0.09), vec3(0.5, 0.3, 0.16), veta) * (0.85 + 0.3 * hash(vec2(tabla, 2.0)));\n"
            + "      madera *= 1.0 - 0.6 * smoothstep(0.42, 0.5, abs(fract(qm.x * 5.0) - 0.5));\n"
            + "      c = madera * (0.5 + 0.7 * max(dot(vec3(0.0, 1.0, 0.0), sol()), 0.0) + 0.25) * vec3(1.1, 0.85, 0.75);\n"
            + "      c *= 1.0 - 0.5 * smoothstep(1.2, 1.4, abs(qm.x));\n"
            + "    } else {\n"
            + "      float ta = (uPiso - 0.35 - uOjo.y) / min(d.y, -0.0001); vec3 p = uOjo + d * ta;\n"
            + "      vec2 w = p.xz * 1.5;\n"
            + "      vec3 n = normalize(vec3(0.05 * sin(w.x * 2.1 + uT * 1.3) + 0.04 * sin(w.y * 3.3 - uT * 1.1) + 0.03 * (ruido(w * 3.0 + uT) - 0.5),\n"
            + "                              1.0, 0.05 * cos(w.y * 1.7 + uT * 0.9) + 0.03 * sin(w.x * 4.1 + uT * 1.7) + 0.03 * (ruido(w * 3.0 - uT) - 0.5)));\n"
            + "      vec3 r = reflect(d, n); r.y = abs(r.y);\n"
            + "      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-d, n), 0.0), 5.0);\n"
            + "      vec3 refl = el > -mt ? cielo(r) : cielo(r);\n"
            + "      float azr = atan(r.x, -r.z), elr = asin(clamp(r.y, 0.0, 1.0));\n"
            + "      if (elr < montes(azr)) refl = vec3(0.18, 0.12, 0.2);\n"
            + "      c = mix(vec3(0.03, 0.07, 0.1), refl, fres * 0.8 + 0.22);\n"
            + "      c += vec3(1.0, 0.75, 0.45) * pow(max(dot(r, sol()), 0.0), 300.0) * 3.0;\n"
            + "      c = mix(c, vec3(0.62, 0.38, 0.4), smoothstep(12.0, 60.0, ta) * 0.6);\n"
            + "    }\n"
            + "  }\n"
            + "  gl_FragColor = vec4(terminar(c), 1.0);\n"
            + "}\n";

    static final String LIVING_FS = COMUN
            + "// una caja: t de entrada, normal\n"
            + "float caja(vec3 o, vec3 d, vec3 a, vec3 b, out vec3 n) {\n"
            + "  vec3 i = 1.0 / d, t0 = (a - o) * i, t1 = (b - o) * i, tmin = min(t0, t1), tmax = max(t0, t1);\n"
            + "  float te = max(max(tmin.x, tmin.y), tmin.z), ts = min(min(tmax.x, tmax.y), tmax.z);\n"
            + "  if (te > ts || ts < 0.0) return -1.0;\n"
            + "  n = te == tmin.x ? vec3(-sign(d.x), 0.0, 0.0) : te == tmin.y ? vec3(0.0, -sign(d.y), 0.0) : vec3(0.0, 0.0, -sign(d.z));\n"
            + "  return te;\n"
            + "}\n"
            + "vec3 afuera(vec3 d) {\n"
            + "  vec3 c = mix(vec3(0.75, 0.85, 0.95), vec3(0.35, 0.55, 0.85), clamp(d.y * 1.5, 0.0, 1.0));\n"
            + "  float az = atan(d.x, -d.z), el = d.y;\n"
            + "  float lomas = -0.02 + 0.08 * fbm(vec2(az * 3.0, 0.0));\n"
            + "  float pinos = lomas + 0.06 * pow(abs(sin(az * 60.0 + fbm(vec2(az * 20.0, 1.0)) * 6.0)), 6.0) * fbm(vec2(az * 9.0, 4.0));\n"
            + "  if (el < pinos) c = mix(vec3(0.1, 0.22, 0.14), vec3(0.3, 0.42, 0.35), smoothstep(-0.2, 0.1, el));\n"
            + "  return c;\n"
            + "}\n"
            + "void main() {\n"
            + "  vec3 d = rayo();\n"
            + "  vec3 o = uOjo;\n"
            + "  vec3 A = vec3(uAncla.x - 4.0, uPiso, uAncla.y - 5.0), B = vec3(uAncla.x + 4.0, uPiso + 3.0, uAncla.y + 3.2);\n"
            + "  // la pieza por dentro: dónde sale el rayo\n"
            + "  vec3 i = 1.0 / d, t0 = (A - o) * i, t1 = (B - o) * i, tmax = max(t0, t1);\n"
            + "  float t = min(min(tmax.x, tmax.y), tmax.z);\n"
            + "  vec3 n = t == tmax.x ? vec3(-sign(d.x), 0.0, 0.0) : t == tmax.y ? vec3(0.0, -sign(d.y), 0.0) : vec3(0.0, 0.0, -sign(d.z));\n"
            + "  vec3 p = o + d * t, q = p - vec3(uAncla.x, uPiso, uAncla.y);\n"
            + "  vec3 c; float esquina = 1.0;\n"
            + "  vec3 luzCalida = vec3(1.0, 0.78, 0.55), fuego = vec3(-3.95, 0.55, -1.0);\n"
            + "  if (n.y > 0.5) {\n"                                                    // el piso
            + "    float tabla = floor(q.z * 4.0);\n"
            + "    float veta = fbm(vec2(q.x * 3.0 + hash(vec2(tabla, 1.0)) * 50.0, q.z * 30.0));\n"
            + "    c = mix(vec3(0.33, 0.19, 0.1), vec3(0.52, 0.32, 0.18), veta) * (0.85 + 0.25 * hash(vec2(tabla, 7.0)));\n"
            + "    c *= 1.0 - 0.5 * smoothstep(0.44, 0.5, abs(fract(q.z * 4.0) - 0.5));\n"
            + "    float alf = length((q.xz - vec2(0.0, -1.2)) * vec2(0.55, 0.8));\n"
            + "    if (alf < 1.0) { float dib = 0.5 + 0.5 * sin(alf * 28.0); c = mix(vec3(0.45, 0.12, 0.1), vec3(0.75, 0.55, 0.35), dib * 0.35) * (1.0 - 0.3 * smoothstep(0.9, 1.0, alf)); }\n"
            + "  } else if (n.y < -0.5) {\n"                                            // el techo con vigas
            + "    c = vec3(0.85, 0.8, 0.72) * 0.55;\n"
            + "    if (abs(fract(q.x * 0.5) - 0.5) > 0.44) c = vec3(0.3, 0.18, 0.1);\n"
            + "  } else {\n"                                                             // las paredes
            + "    vec2 w = abs(n.x) > 0.5 ? q.zy : q.xy;\n"
            + "    c = vec3(0.86, 0.8, 0.7) * (0.92 + 0.08 * fbm(w * 6.0));\n"
            + "    if (q.y < 0.9) c = vec3(0.42, 0.26, 0.15) * (0.9 + 0.1 * sin(w.x * 18.0));\n"   // el zócalo de madera
            + "    if (abs(q.y - 0.9) < 0.02) c *= 0.6;\n"
            + "    // la ventana grande (pared del frente)\n"
            + "    if (n.z > 0.5 && abs(q.x) < 2.3 && q.y > 0.95 && q.y < 2.55) {\n"
            + "      bool marco = abs(q.x) > 2.22 || q.y < 1.02 || q.y > 2.48 || abs(q.x) < 0.04 || abs(q.y - 1.75) < 0.03 || abs(abs(q.x) - 1.15) < 0.03;\n"
            + "      c = marco ? vec3(0.3, 0.2, 0.12) : afuera(d) * 1.25;\n"
            + "    }\n"
            + "    // la chimenea (pared izquierda)\n"
            + "    if (n.x > 0.5 && abs(q.z + 1.0) < 0.9 && q.y < 1.4) {\n"
            + "      c = vec3(0.35, 0.3, 0.28) * (0.8 + 0.2 * hash(floor(q.zy * vec2(8.0, 6.0))));\n"
            + "      if (abs(q.z + 1.0) < 0.5 && q.y > 0.15 && q.y < 0.95) {\n"
            + "        float llama = fbm(vec2(q.z * 6.0, q.y * 3.0 - uT * 2.5)) * (1.0 - (q.y - 0.15) / 0.8);\n"
            + "        c = mix(vec3(0.05, 0.02, 0.01), vec3(1.0, 0.45, 0.1) * 2.0, smoothstep(0.25, 0.6, llama));\n"
            + "      }\n"
            + "    }\n"
            + "    // la biblioteca y la puerta (pared de atrás)\n"
            + "    if (n.z < -0.5) {\n"
            + "      if (q.x > -3.0 && q.x < -0.6 && q.y < 2.3) {\n"
            + "        float estante = fract(q.y / 0.46);\n"
            + "        float lib = floor(q.x * 22.0), alto = 0.55 + 0.35 * hash(vec2(lib, floor(q.y / 0.46)));\n"
            + "        vec3 lomo = vec3(0.25 + 0.5 * hash(vec2(lib, 3.0)), 0.18 + 0.3 * hash(vec2(lib, 5.0)), 0.12 + 0.35 * hash(vec2(lib, 9.0)));\n"
            + "        c = estante < 0.08 || abs(q.x + 1.8) > 1.15 ? vec3(0.36, 0.22, 0.12) : estante < 0.08 + alto * 0.9 ? lomo * (0.8 + 0.2 * fract(q.x * 22.0)) : vec3(0.12, 0.08, 0.05);\n"
            + "      }\n"
            + "      if (q.x > 1.0 && q.x < 2.0 && q.y < 2.1) {\n"
            + "        c = vec3(0.45, 0.28, 0.15) * (0.9 + 0.1 * fbm(vec2(q.x * 3.0, q.y * 20.0)));\n"
            + "        if (abs(q.x - 1.5) > 0.44 || q.y > 2.04) c = vec3(0.28, 0.17, 0.09);\n"
            + "        if (length(vec2(q.x - 1.88, q.y - 1.0)) < 0.035) c = vec3(0.85, 0.7, 0.35);\n"
            + "      }\n"
            + "    }\n"
            + "    // un cuadro (pared derecha)\n"
            + "    if (n.x < -0.5 && abs(q.z + 1.2) < 0.7 && abs(q.y - 1.7) < 0.45) {\n"
            + "      c = abs(q.z + 1.2) > 0.64 || abs(q.y - 1.7) > 0.39 ? vec3(0.55, 0.42, 0.2) : mix(vec3(0.15, 0.3, 0.5), vec3(0.9, 0.6, 0.3), fbm(vec2(q.z, q.y) * 3.0));\n"
            + "    }\n"
            + "  }\n"
            + "  // el sillón y la mesa (se ven delante de las paredes)\n"
            + "  vec3 nb; vec3 an = vec3(uAncla.x, uPiso, uAncla.y);\n"
            + "  float ts = caja(o, d, an + vec3(2.9, 0.0, -2.2), an + vec3(3.9, 0.45, 0.4), nb);\n"
            + "  float tr = caja(o, d, an + vec3(3.55, 0.45, -2.2), an + vec3(3.9, 0.95, 0.4), nb);\n"
            + "  float tm = caja(o, d, an + vec3(-1.6, 0.0, -2.1), an + vec3(-0.6, 0.42, -1.4), nb);\n"
            + "  float mejor = t; vec3 nm = n; vec3 cm = c; bool obj = false;\n"
            + "  if (ts > 0.0 && ts < mejor) { mejor = ts; caja(o, d, an + vec3(2.9, 0.0, -2.2), an + vec3(3.9, 0.45, 0.4), nm); cm = vec3(0.22, 0.32, 0.4); obj = true; }\n"
            + "  if (tr > 0.0 && tr < mejor) { mejor = tr; caja(o, d, an + vec3(3.55, 0.45, -2.2), an + vec3(3.9, 0.95, 0.4), nm); cm = vec3(0.2, 0.29, 0.37); obj = true; }\n"
            + "  if (tm > 0.0 && tm < mejor) { mejor = tm; caja(o, d, an + vec3(-1.6, 0.0, -2.1), an + vec3(-0.6, 0.42, -1.4), nm); cm = vec3(0.35, 0.2, 0.11); obj = true; }\n"
            + "  if (obj) { p = o + d * mejor; q = p - an; n = nm; c = cm * (0.9 + 0.1 * fbm(q.xz * 20.0 + q.y * 10.0)); }\n"
            + "  // la luz: ambiente cálido, la de la ventana, la del fuego; y las esquinas más oscuras\n"
            + "  float dVentana = length(vec2(q.x * 0.35, (q.z + 5.0) * 0.5));\n"
            + "  vec3 luz = vec3(0.35, 0.33, 0.32) + vec3(0.9, 0.95, 1.0) * 0.7 * exp(-dVentana * 0.9) * max(0.3, n.z + 0.4 * n.y + 0.6);\n"
            + "  vec3 aF = fuego - q; float dF = length(aF);\n"
            + "  luz += vec3(1.0, 0.5, 0.2) * (0.8 + 0.2 * sin(uT * 9.0) * sin(uT * 5.3)) * max(dot(n, aF / dF), 0.0) * 1.6 / (1.0 + dF * dF * 0.35);\n"
            + "  luz += luzCalida * 0.45 * max(n.y, 0.0);\n"
            + "  vec3 aL = vec3(3.3, 1.7, 2.6) - q; float dL = length(aL);\n"                       // la lámpara del rincón
            + "  luz += luzCalida * 1.3 * max(dot(n, aL / dL), 0.0) / (1.0 + dL * dL * 0.5);\n"
            + "  float bordes = min(min(q.y, 3.0 - q.y), min(min(q.x + 4.0, 4.0 - q.x), min(q.z + 5.0, 3.2 - q.z)));\n"
            + "  if (!obj) esquina = 0.55 + 0.45 * smoothstep(0.0, 0.6, bordes);\n"
            + "  bool vidrio = !obj && n.z > 0.5 && abs(q.x) < 2.22 && q.y > 1.02 && q.y < 2.48 && abs(q.x) > 0.04 && abs(q.y - 1.75) > 0.03 && abs(abs(q.x) - 1.15) > 0.03;\n"
            + "  bool llama = !obj && n.x > 0.5 && abs(q.z + 1.0) < 0.5 && q.y > 0.15 && q.y < 0.95;\n"
            + "  if (!vidrio && !llama) c *= luz * esquina;\n"
            + "  gl_FragColor = vec4(terminar(c), 1.0);\n"
            + "}\n";

    private final int[] prog = new int[CANTIDAD];
    private final int[][] u = new int[CANTIDAD][7];
    private final FloatBuffer cuadro = Gl.bufer(new float[]{-1, -1, 1, -1, -1, 1, 1, 1});
    private final float[] inv = new float[16];

    boolean anda(int cual) { return cual == PASSTHROUGH || (cual > 0 && cual < CANTIDAD && prog[cual] != 0); }

    void crear() {
        String[] fs = {null, ESPACIO_FS, LAGO_FS, LIVING_FS};
        for (int k = 1; k < CANTIDAD; k++) {
            // si la GPU de un teléfono no compila uno, ese entorno no se ofrece (no se cae todo)
            try { prog[k] = Gl.programa(VS, fs[k]); } catch (RuntimeException e) { prog[k] = 0; Fallo.guardar("entorno " + NOMBRES[k], e); continue; }
            String[] n = {"uInv", "uOjo", "uT", "uPiso", "uAncla", "uLuz"};
            for (int j = 0; j < n.length; j++) u[k][j] = Gl.uniforme(prog[k], n[j]);
        }
    }

    /** Dibuja el entorno de fondo para un ojo (vp: la matriz de ese ojo; ojo: dónde está). */
    void dibujar(int cual, float[] vp, float[] ojo, float t, float piso, float ax, float az, float luz) {
        if (cual <= PASSTHROUGH || cual >= CANTIDAD || prog[cual] == 0) return;
        if (!Matrix.invertM(inv, 0, vp, 0)) return;
        int p = prog[cual];
        GLES20.glUseProgram(p);
        GLES20.glUniformMatrix4fv(u[cual][0], 1, false, inv, 0);
        GLES20.glUniform3f(u[cual][1], ojo[0], ojo[1], ojo[2]);
        GLES20.glUniform1f(u[cual][2], t);
        GLES20.glUniform1f(u[cual][3], piso);
        GLES20.glUniform2f(u[cual][4], ax, az);
        GLES20.glUniform1f(u[cual][5], luz);
        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDepthMask(false);
        int a = GLES20.glGetAttribLocation(p, "aPos");
        cuadro.position(0);
        GLES20.glVertexAttribPointer(a, 2, GLES20.GL_FLOAT, false, 0, cuadro);
        GLES20.glEnableVertexAttribArray(a);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(a);
        GLES20.glDepthMask(true);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }
}
