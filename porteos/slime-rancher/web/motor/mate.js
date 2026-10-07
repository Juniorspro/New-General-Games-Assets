// porteo: matemática con las convenciones de Unity (mano izquierda, Y arriba, matrices por
// columnas como las sube Unity a los shaders: hlslcc_mtx4x4 = 4 columnas vec4).
'use strict';
var Mate = (function () {
  function m4() { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
  // out = a·b (columnas)
  function mul(out, a, b) {
    var r = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var f = 0; f < 4; f++) {
      r[c * 4 + f] = a[f] * b[c * 4] + a[4 + f] * b[c * 4 + 1] + a[8 + f] * b[c * 4 + 2] + a[12 + f] * b[c * 4 + 3];
    }
    out.set(r); return out;
  }
  // T·R·S con un cuaternión de Unity (x, y, z, w)
  function trs(out, p, q, s) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var sx = s ? s[0] : 1, sy = s ? s[1] : 1, sz = s ? s[2] : 1;
    out[0] = (1 - 2 * (y * y + z * z)) * sx; out[1] = 2 * (x * y + z * w) * sx; out[2] = 2 * (x * z - y * w) * sx; out[3] = 0;
    out[4] = 2 * (x * y - z * w) * sy; out[5] = (1 - 2 * (x * x + z * z)) * sy; out[6] = 2 * (y * z + x * w) * sy; out[7] = 0;
    out[8] = 2 * (x * z + y * w) * sz; out[9] = 2 * (y * z - x * w) * sz; out[10] = (1 - 2 * (x * x + y * y)) * sz; out[11] = 0;
    out[12] = p[0]; out[13] = p[1]; out[14] = p[2]; out[15] = 1;
    return out;
  }
  function invertir(out, m) {
    var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
        a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }
  // Proyección de OpenGL (la que usa Unity en GLES/WebGL), fov vertical en grados.
  function perspectiva(out, fov, aspecto, cerca, lejos) {
    var f = 1 / Math.tan(fov * Math.PI / 360), nf = 1 / (cerca - lejos);
    out.fill(0);
    out[0] = f / aspecto; out[5] = f; out[10] = (lejos + cerca) * nf; out[11] = -1; out[14] = 2 * lejos * cerca * nf;
    return out;
  }
  // Camera.worldToCameraMatrix de Unity: la vista es de mano derecha (mira hacia -Z), por eso la Z se da vuelta.
  function vistaDeUnity(out, pos, rot) {
    var c = trs(m4(), pos, rot, null);
    invertir(out, c);
    out[2] = -out[2]; out[6] = -out[6]; out[10] = -out[10]; out[14] = -out[14];
    return out;
  }
  // cuaternión de Unity desde ángulos de Euler (grados; orden Z, X, Y como Quaternion.Euler)
  function euler(x, y, z) {
    var cx = Math.cos(x * Math.PI / 360), sx = Math.sin(x * Math.PI / 360);
    var cy = Math.cos(y * Math.PI / 360), sy = Math.sin(y * Math.PI / 360);
    var cz = Math.cos(z * Math.PI / 360), sz = Math.sin(z * Math.PI / 360);
    return [cy * sx * cz + sy * cx * sz, sy * cx * cz - cy * sx * sz, cy * cx * sz - sy * sx * cz, cy * cx * cz + sy * sx * sz];
  }
  // rota un vector con un cuaternión de Unity
  function rotar(q, v) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  }
  return { m4: m4, mul: mul, trs: trs, invertir: invertir, perspectiva: perspectiva, vistaDeUnity: vistaDeUnity, euler: euler, rotar: rotar };
})();
