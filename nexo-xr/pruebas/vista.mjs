// Vista previa sin teléfono: los ENTORNOS y las VENTANAS con los shaders de
// verdad (sacados de Entornos.java y VentanasGl.java por pruebas/vista/Vista.java)
// y las ventanas donde las pone Escritorio.java. Lo que muestra cada ventana es
// una maqueta dibujada acá (en el teléfono son las pantallas de Android).
//
//   ./pruebas/vista.sh   → salida/vista-*.png
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "../../mundo-ar/node_modules/playwright");

const [datosRuta, salida] = process.argv.slice(2);
const datos = JSON.parse(readFileSync(datosRuta, "utf8"));
const W = 1920, H = 1080;
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const pag = await nav.newPage({ viewport: { width: W, height: H } });
await pag.setContent(`<body style="margin:0;background:#000"><canvas id="c" width="${W}" height="${H}"></canvas></body>`);

async function foto(entorno, nombre, mirar, extra) {
  const err = await pag.evaluate(({ datos, entorno, W, H, mirar, extra }) => {
    const gl = document.getElementById("c").getContext("webgl", { preserveDrawingBuffer: true, antialias: true });
    const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = (p) => { const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, p.vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, p.fs)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); return pr; };
    const U = (p, n) => gl.getUniformLocation(p, n), A = (p, n) => gl.getAttribLocation(p, n);
    const ojos = extra.sbs ? [-1, 1] : [0];
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (const lado of ojos) {
    if (extra.sbs) { gl.enable(gl.SCISSOR_TEST); const x0 = lado < 0 ? 0 : W / 2; gl.scissor(x0, 0, W / 2, H); gl.viewport(x0 + W * 0.02, H * 0.04, W / 2 - W * 0.04, H * 0.92); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
    // la cámara
    const ojo = [lado * 0.0315, 1.6, 0];
    const f = (() => { const [x, y, z] = mirar; const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nrm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
    const sx = nrm(cross(f, [0, 1, 0])), ux = cross(sx, f);
    const vista = [sx[0], ux[0], -f[0], 0, sx[1], ux[1], -f[1], 0, sx[2], ux[2], -f[2], 0,
      -(sx[0] * ojo[0] + sx[1] * ojo[1] + sx[2] * ojo[2]), -(ux[0] * ojo[0] + ux[1] * ojo[1] + ux[2] * ojo[2]), f[0] * ojo[0] + f[1] * ojo[1] + f[2] * ojo[2], 1];
    const fov = (extra.sbs ? 90 : 70) * Math.PI / 180, asp = extra.sbs ? (W / 2 - W * 0.04) / (H * 0.92) : W / H, cerca = 0.05, lejos = 200, fy = 1 / Math.tan(fov / 2);
    const proy = [fy / asp, 0, 0, 0, 0, fy, 0, 0, 0, 0, (lejos + cerca) / (cerca - lejos), -1, 0, 0, 2 * lejos * cerca / (cerca - lejos), 0];
    const mul = (a, b) => { const r = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) r[c * 4 + rr] += a[k * 4 + rr] * b[c * 4 + k]; return r; };
    const vp = mul(proy, vista);
    const inv = (m) => { const r = new Float32Array(16), [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33] = m;
      const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
        b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
      const det=1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
      r[0]=(a11*b11-a12*b10+a13*b09)*det; r[1]=(a02*b10-a01*b11-a03*b09)*det; r[2]=(a31*b05-a32*b04+a33*b03)*det; r[3]=(a22*b04-a21*b05-a23*b03)*det;
      r[4]=(a12*b08-a10*b11-a13*b07)*det; r[5]=(a00*b11-a02*b08+a03*b07)*det; r[6]=(a32*b02-a30*b05-a33*b01)*det; r[7]=(a20*b05-a22*b02+a23*b01)*det;
      r[8]=(a10*b10-a11*b08+a13*b06)*det; r[9]=(a01*b08-a00*b10-a03*b06)*det; r[10]=(a30*b04-a31*b02+a33*b00)*det; r[11]=(a21*b02-a20*b04-a23*b00)*det;
      r[12]=(a11*b07-a10*b09-a12*b06)*det; r[13]=(a00*b09-a01*b07+a02*b06)*det; r[14]=(a31*b01-a30*b03-a32*b00)*det; r[15]=(a20*b03-a21*b01+a22*b00)*det; return r; };
    // el entorno (programas 0..2 = Espacio, Lago, Living; -1 = "passthrough": una foto de una pieza cualquiera, gris)
    const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    if (entorno >= 0) {
      const P = prog(datos.programas[entorno]); gl.useProgram(P);
      gl.uniformMatrix4fv(U(P, "uInv"), false, inv(vp)); gl.uniform3fv(U(P, "uOjo"), ojo); gl.uniform1f(U(P, "uT"), 12.3);
      gl.uniform1f(U(P, "uPiso"), 0); gl.uniform2f(U(P, "uAncla"), 0, 0); gl.uniform1f(U(P, "uLuz"), extra.luz ?? 1);
      const a = A(P, "aPos"); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(a);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // las ventanas
    const V = prog(datos.programas[datos.programas.length - 1]);
    gl.useProgram(V); gl.uniformMatrix4fv(U(V, "uVp"), false, vp);
    gl.bindBuffer(gl.ARRAY_BUFFER, q);
    const vq = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vq); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    const ap = A(V, "aPos"); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(ap);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST);
    const setU = (n, ...v) => { const l = U(V, n); if (v.length === 1) gl.uniform1f(l, v[0]); else if (v.length === 2) gl.uniform2f(l, ...v); else if (v.length === 3) gl.uniform3f(l, ...v); else gl.uniform4f(l, ...v); };
    const rect = (w, x, y, z, ww, hh) => {
      const c = [0, 1, 2].map((k) => w.c[k] + w.r[k] * x + w.u[k] * y + w.n[k] * z);
      setU("uC", ...c); setU("uR", ...w.r.map((v) => v * ww)); setU("uU", ...w.u.map((v) => v * hh)); setU("uTam", ww, hh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    // las maquetas de lo que muestra cada una
    const maqueta = (w) => {
      const cv = document.createElement("canvas"); cv.width = w.px; cv.height = w.py; const g = cv.getContext("2d");
      const fondo = "#1b1c21", texto = "#e8e9ee", gris = "#9a9caa";
      g.fillStyle = fondo; g.fillRect(0, 0, w.px, w.py);
      g.font = "bold 34px sans-serif";
      if (w.app === "dock") {
        g.fillStyle = "#15161b"; g.fillRect(0, 0, w.px, w.py);
        const ic = ["#4d8bff", "#ff7a59", "#35c28b", "#b58cff", "#f1c14b", "#8a8f9e"];
        ic.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(90 + i * 125, w.py / 2, 42, 0, 7); g.fill(); });
        g.fillStyle = texto; g.font = "bold 44px sans-serif"; g.fillText("21:45", w.px - 330, w.py / 2 + 16);
        g.fillStyle = gris; g.fillRect(w.px - 170, w.py / 2 - 14, 60, 28); g.fillRect(w.px - 90, w.py / 2 - 20, 40, 40);
      } else if (w.app === "navegador") {
        g.fillStyle = "#26272e"; g.fillRect(0, 0, w.px, 90);
        g.fillStyle = "#3a3c46"; g.beginPath(); g.roundRect(170, 18, w.px - 360, 54, 27); g.fill();
        g.fillStyle = gris; g.font = "28px sans-serif"; g.fillText("google.com", 205, 55);
        g.fillStyle = "#fff"; g.fillRect(0, 90, w.px, w.py - 90);
        g.fillStyle = "#4285f4"; g.font = "bold 110px sans-serif"; g.fillText("Buscar", w.px / 2 - 180, 330);
        g.strokeStyle = "#ccc"; g.lineWidth = 3; g.beginPath(); g.roundRect(w.px / 2 - 330, 400, 660, 70, 35); g.stroke();
        ["YouTube", "Wikipedia", "Mapas", "Noticias"].forEach((t, i) => { g.fillStyle = ["#ff3d3d", "#666", "#2ea55a", "#4285f4"][i]; g.beginPath(); g.arc(w.px / 2 - 330 + i * 220, 600, 50, 0, 7); g.fill(); g.fillStyle = "#333"; g.font = "26px sans-serif"; g.fillText(t, w.px / 2 - 380 + i * 220, 690); });
      } else if (w.app === "galeria") {
        g.fillStyle = texto; g.fillText("Galería", 40, 64);
        for (let i = 0; i < 12; i++) { const x = 40 + (i % 4) * 305, y = 100 + Math.floor(i / 4) * 230;
          const gr = g.createLinearGradient(x, y, x + 290, y + 215); gr.addColorStop(0, `hsl(${i * 37},55%,55%)`); gr.addColorStop(1, `hsl(${i * 37 + 60},60%,30%)`);
          g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, 290, 215, 14); g.fill(); }
      } else {
        g.fillStyle = "#15161b"; g.fillRect(0, 0, 300, w.py);
        ["Entorno", "Visor", "Manos", "Control", "Sonido", "Acerca de"].forEach((t, i) => { g.fillStyle = i === 0 ? "#2f5fd0" : "transparent"; g.beginPath(); g.roundRect(14, 30 + i * 80, 272, 64, 14); g.fill(); g.fillStyle = texto; g.font = "30px sans-serif"; g.fillText(t, 40, 72 + i * 80); });
        g.fillStyle = texto; g.font = "bold 40px sans-serif"; g.fillText("Entorno", 340, 80);
        ["#101c3a", "#e98b52", "#6b4a31", "#777"].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.roundRect(340 + (i % 2) * 370, 120 + Math.floor(i / 2) * 290, 350, 260, 18); g.fill(); });
      }
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    // de lejos a cerca
    const orden = datos.ventanas.slice().sort((a, b) => Math.hypot(b.c[0] - ojo[0], b.c[1] - ojo[1], b.c[2] - ojo[2]) - Math.hypot(a.c[0] - ojo[0], a.c[1] - ojo[1], a.c[2] - ojo[2]));
    for (const w of orden) {
      const hover = w.app === extra.hover ? 1 : 0;
      setU("uAlfa", 1); setU("uCarga", 0); setU("uFuerza", 1);
      gl.depthMask(false); setU("uModo", 1); setU("uRadio", 0.03); setU("uColor", hover ? 0.35 : 0, hover ? 0.55 : 0, hover ? 0.9 : 0, 0.28 + 0.2 * hover);
      rect(w, 0, 0, -0.004, w.w + 0.12, w.h + 0.12); gl.depthMask(true);
      setU("uModo", 0); setU("uRadio", w.radio); setU("uHover", hover);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maqueta(w)); gl.uniform1i(U(V, "uTex"), 0);
      rect(w, 0, 0, 0, w.w, w.h);
      if (w.tipo === 0) {
        const cerca = hover ? 1 : 0.2;
        gl.depthMask(false); setU("uModo", 2); setU("uAlfa", 0.45 + 0.55 * cerca); setU("uColor", 0.85, 0.85, 0.85, 0.7);
        rect(w, 0, w.barraY, 0.002, w.barraAncho, 0.022);
        if (hover) { setU("uModo", 3); setU("uAlfa", 1); setU("uIcono", 0); setU("uHover", 0); rect(w, w.cerrarX, w.barraY, 0.002, 0.038, 0.038);
          setU("uIcono", 1); rect(w, w.ampliarX, w.barraY, 0.002, 0.038, 0.038); }
        gl.depthMask(true);
      }
      if (w.app === extra.hover) {
        // el rayo desde la mano derecha y el cursor en (0.62, 0.42)
        const x = (0.62 - 0.5) * w.w, y = (0.5 - 0.42) * w.h;
        const hit = [0, 1, 2].map((k) => w.c[k] + w.r[k] * x + w.u[k] * y);
        const mano = [0.22, 1.25, -0.35];
        const d = [0, 1, 2].map((k) => hit[k] - mano[k]);
        const e = [0, 1, 2].map((k) => ojo[k] - (hit[k] + mano[k]) / 2);
        let s = cross(d, e); const sl = Math.hypot(...s); s = s.map((v) => v * 0.004 / sl);
        gl.depthMask(false); setU("uModo", 6); setU("uAlfa", 1); setU("uColor", 1, 1, 1, 0.45);
        setU("uC", ...[0, 1, 2].map((k) => (hit[k] + mano[k]) / 2)); setU("uR", ...d); setU("uU", ...s); setU("uTam", 1, 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        setU("uModo", 4); setU("uFuerza", extra.fuerza ?? 1); setU("uColor", 1, 1, 1, 1); const tam = Math.max(0.012, 1.1 * 0.022);
        rect(w, x, y, 0.004, tam, tam); gl.depthMask(true);
      }
    }
    }
    gl.disable(gl.SCISSOR_TEST);
    return gl.getError();
  }, { datos, entorno, W, H, mirar, extra: extra || {} });
  await pag.screenshot({ path: `${salida}/vista-${nombre}.png` });
  console.log(`✓ vista-${nombre}.png (error GL ${err})`);
}

await foto(0, "espacio", [0, -0.05, -1], { hover: "navegador" });
await foto(1, "lago", [0, -0.05, -1], { hover: "galeria", fuerza: 0.2 });
await foto(2, "living", [0, -0.05, -1], { hover: "ajustes" });
await foto(2, "living-atras", [0.3, 0.05, 1], {});
await foto(1, "lago-abajo", [0.2, -0.6, -1], {});
await foto(1, "sbs", [0, -0.05, -1], { sbs: true, hover: "navegador" });
await nav.close();
