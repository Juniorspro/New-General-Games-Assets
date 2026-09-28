// Vista previa de NEXO INICIO sin teléfono: una pieza sentada con una mesa de
// verdad (dibujada acá, como si fuera la cámara) y encima lo de la app con sus
// shaders DE VERDAD (SuperficiesGl: los planos, la nube, tu mesa marcada con su
// onda y la etiqueta; ManosGl: las manos de guía; VentanasGl: el panel del
// inicio y el escritorio con la barra apoyada en la mesa). La geometría (el
// polígono de la mesa, su malla, las guías, dónde va cada ventana) la calculan
// Mesa, SuperficiesGl y Escritorio en pruebas/vista/Vista.java.
//
//   ./pruebas/vista.sh   → salida/vista-inicio-*.png
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

async function foto(nombre, mirar, extra) {
  const err = await pag.evaluate(({ datos, W, H, mirar, extra }) => {
    const gl = document.getElementById("c").getContext("webgl", { preserveDrawingBuffer: true, antialias: true });
    const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) + "\n" + s); return o; };
    const prog = (p) => { const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, p.vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, p.fs)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); return pr; };
    const U = (p, n) => gl.getUniformLocation(p, n), A = (p, n) => gl.getAttribLocation(p, n);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nrm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
    const mul = (a, b) => { const r = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) r[c * 4 + rr] += a[k * 4 + rr] * b[c * 4 + k]; return r; };
    const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // la cámara: sentado, los ojos a 1.2 m
    const ojo = [0, 1.2, 0];
    const f = nrm(mirar);
    const sx = nrm(cross(f, [0, 1, 0])), ux = cross(sx, f);
    const vista = [sx[0], ux[0], -f[0], 0, sx[1], ux[1], -f[1], 0, sx[2], ux[2], -f[2], 0,
      -(sx[0] * ojo[0] + sx[1] * ojo[1] + sx[2] * ojo[2]), -(ux[0] * ojo[0] + ux[1] * ojo[1] + ux[2] * ojo[2]), f[0] * ojo[0] + f[1] * ojo[1] + f[2] * ojo[2], 1];
    const fov = 72 * Math.PI / 180, asp = W / H, cerca = 0.05, lejos = 60, fy = 1 / Math.tan(fov / 2);
    const proy = [fy / asp, 0, 0, 0, 0, fy, 0, 0, 0, 0, (lejos + cerca) / (cerca - lejos), -1, 0, 0, 2 * lejos * cerca / (cerca - lejos), 0];
    const vp = mul(proy, vista);

    // ── la pieza "de verdad" (lo que vería la cámara): piso, paredes, la mesa y cosas encima ──
    const PR = prog({
      vs: "attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol; uniform mat4 uVp; varying vec3 vN; varying vec3 vC; varying vec3 vP;\n" +
        "void main(){ vN = aNrm; vC = aCol; vP = aPos; gl_Position = uVp * vec4(aPos, 1.0); }",
      fs: "precision mediump float; varying vec3 vN; varying vec3 vC; varying vec3 vP;\n" +
        "float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n" +
        "void main(){ vec3 l = normalize(vec3(-0.4, 0.9, 0.35)); float d = 0.45 + 0.55 * max(0.0, dot(normalize(vN), l));\n" +
        "  float veta = 0.92 + 0.08 * sin(vP.x * 38.0 + sin(vP.z * 9.0) * 2.0);\n" +
        "  float ao = mix(0.72, 1.0, smoothstep(0.0, 0.5, vP.y));\n" +
        "  vec3 c = vC * d * ao * (vC.r > vC.b + 0.12 ? veta : 1.0);\n" +
        "  c *= 0.93 + 0.07 * h(gl_FragCoord.xy);\n" +
        "  gl_FragColor = vec4(c, 1.0); }",
    });
    const tri = [];
    const quad = (p0, p1, p2, p3, n, c) => { for (const p of [p0, p1, p2, p0, p2, p3]) tri.push(...p, ...n, ...c); };
    const caja = (x0, y0, z0, x1, y1, z1, c) => {
      quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], c);
      quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], c.map((v) => v * 0.85));
      quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], c.map((v) => v * 0.75));
      quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], c.map((v) => v * 0.75));
    };
    quad([-4, 0, 3], [4, 0, 3], [4, 0, -1.9], [-4, 0, -1.9], [0, 1, 0], [0.36, 0.33, 0.31]);          // el piso
    quad([-4, 0, -1.9], [4, 0, -1.9], [4, 2.6, -1.9], [-4, 2.6, -1.9], [0, 0, 1], [0.62, 0.62, 0.6]);   // la pared
    quad([-2.2, 0, 3], [-2.2, 0, -1.9], [-2.2, 2.6, -1.9], [-2.2, 2.6, 3], [1, 0, 0], [0.55, 0.56, 0.55]);
    quad([2.4, 0, -1.9], [2.4, 0, 3], [2.4, 2.6, 3], [2.4, 2.6, -1.9], [-1, 0, 0], [0.55, 0.56, 0.55]);
    const madera = [0.55, 0.38, 0.24];
    caja(-0.6, 0.72, -1.1, 0.64, 0.75, -0.38, madera);                                                  // la tabla
    for (const [x, z] of [[-0.55, -1.05], [0.59, -1.05], [-0.55, -0.43], [0.59, -0.43]]) caja(x - 0.025, 0, z - 0.025, x + 0.025, 0.72, z + 0.025, madera.map((v) => v * 0.8));
    caja(0.32, 0.75, -1.02, 0.5, 0.86, -0.9, [0.85, 0.85, 0.82]);                                       // una taza
    caja(-0.46, 0.75, -1.05, -0.2, 0.77, -0.86, [0.25, 0.3, 0.45]);                                     // un libro
    caja(-0.3, 0.75, -1.08, 0.2, 0.76, -0.98, [0.12, 0.12, 0.13]);                                      // un teclado
    const bp = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bp); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tri), gl.STATIC_DRAW);
    gl.useProgram(PR); gl.uniformMatrix4fv(U(PR, "uVp"), false, vp);
    for (const [n, k] of [["aPos", 0], ["aNrm", 3], ["aCol", 6]]) { const a = A(PR, n); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 36, k * 4); gl.enableVertexAttribArray(a); }
    gl.enable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, tri.length / 9);
    for (const n of ["aPos", "aNrm", "aCol"]) gl.disableVertexAttribArray(A(PR, n));

    // ── las superficies (SuperficiesGl) ──
    const [SP, SQ, SE] = datos.superficies.map(prog);
    const colores = { 0: [[0.55, 0.60, 0.72], [0.70, 0.75, 0.85]], 1: [[0.45, 0.70, 1.0], [0.75, 0.92, 1.0]], 2: [[0.40, 0.78, 1.0], [1.0, 0.82, 0.45]], 3: [[0.55, 0.50, 1.0], [0.80, 0.70, 1.0]] };
    const plano = (malla, tipo, alfa, onda) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(malla), gl.STATIC_DRAW);
      gl.useProgram(SP);
      gl.uniformMatrix4fv(U(SP, "uVp"), false, vp); gl.uniformMatrix4fv(U(SP, "uModelo"), false, ident);
      gl.uniform3fv(U(SP, "uColor"), colores[tipo][0]); gl.uniform3fv(U(SP, "uColor2"), colores[tipo][1]);
      gl.uniform1f(U(SP, "uAlfa"), alfa * (tipo === 0 ? 0.35 : 1)); gl.uniform1f(U(SP, "uT"), extra.t ?? 2.3);
      gl.uniform1f(U(SP, "uMesa"), tipo === 2 ? 1 : 0); gl.uniform1f(U(SP, "uPaso"), tipo === 2 ? 0.05 : 0.1);
      gl.uniform3fv(U(SP, "uOnda"), onda || [0, 0, -1]);
      const ap = A(SP, "aPos"), ad = A(SP, "aDato");
      gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(ap);
      gl.vertexAttribPointer(ad, 3, gl.FLOAT, false, 24, 12); gl.enableVertexAttribArray(ad);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
      gl.drawArrays(gl.TRIANGLES, 0, malla.length / 6);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
      gl.disableVertexAttribArray(ap); gl.disableVertexAttribArray(ad);
    };
    const I = datos.inicio;
    if (extra.planos) {
      plano(I.piso, 0, 1); plano(I.pared, 0, 1);
      plano(I.mesa, extra.mesa ? 2 : 1, extra.alfaMesa ?? 1, extra.onda ? I.onda : null);
    } else if (extra.mesa) plano(I.mesa, 2, extra.alfaMesa ?? 1, extra.onda ? I.onda : null);
    if (extra.nube) {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(I.nube), gl.STATIC_DRAW);
      gl.useProgram(SQ);
      gl.uniformMatrix4fv(U(SQ, "uVp"), false, vp); gl.uniformMatrix4fv(U(SQ, "uModelo"), false, ident);
      gl.uniform1f(U(SQ, "uT"), 1.7); gl.uniform1f(U(SQ, "uTam"), H / 150); gl.uniform3f(U(SQ, "uColor"), 0.62, 0.9, 1); gl.uniform1f(U(SQ, "uAlfa"), 0.9);
      const ap = A(SQ, "aPos"); gl.vertexAttribPointer(ap, 4, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(ap);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
      gl.drawArrays(gl.POINTS, 0, I.nube.length / 4);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disableVertexAttribArray(ap);
    }
    if (extra.etiqueta) {
      // la textura: como Etiqueta.java (una píldora, un punto, "Tu mesa" y el subtítulo), premultiplicada
      const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128; const g = cv.getContext("2d");
      const gr = g.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, "rgba(20,24,36,0.9)"); gr.addColorStop(1, "rgba(29,36,54,0.9)");
      g.fillStyle = gr; g.beginPath(); g.roundRect(6, 10, 500, 108, 54); g.fill();
      g.strokeStyle = "#ffd27a"; g.lineWidth = 4; g.stroke();
      g.fillStyle = "rgba(255,255,255,0.33)"; g.beginPath(); g.arc(64, 64, 30, 0, 7); g.fill();
      g.fillStyle = "#ffd27a"; g.beginPath(); g.arc(64, 64, 18, 0, 7); g.fill();
      g.fillStyle = "#f1f3f8"; g.font = "bold 44px sans-serif"; g.fillText("Tu mesa", 112, 66);
      g.fillStyle = "#a6acbd"; g.font = "26px sans-serif"; g.fillText("Nexo se mueve cuando la ve", 114, 100);
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
      gl.useProgram(SE);
      gl.uniformMatrix4fv(U(SE, "uVp"), false, vp); gl.uniformMatrix4fv(U(SE, "uModelo"), false, ident);
      gl.uniform3fv(U(SE, "uC"), I.etiqueta.c); gl.uniform3fv(U(SE, "uR"), I.etiqueta.r); gl.uniform3fv(U(SE, "uU"), I.etiqueta.u);
      gl.uniform1f(U(SE, "uAlfa"), 1); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(U(SE, "uTex"), 0);
      const ap = A(SE, "aPos"); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(ap);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disableVertexAttribArray(ap);
    }

    // ── las ventanas (VentanasGl) y sus maquetas ──
    const V = prog(datos.programas[datos.programas.length - 1]);
    const vq = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vq); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    const setU = (n, ...v) => { const l = U(V, n); if (v.length === 1) gl.uniform1f(l, v[0]); else if (v.length === 2) gl.uniform2f(l, ...v); else if (v.length === 3) gl.uniform3f(l, ...v); else gl.uniform4f(l, ...v); };
    const rect = (w, x, y, z, ww, hh) => {
      const c = [0, 1, 2].map((k) => w.c[k] + w.r[k] * x + w.u[k] * y + w.n[k] * z);
      setU("uC", ...c); setU("uR", ...w.r.map((v) => v * ww)); setU("uU", ...w.u.map((v) => v * hh)); setU("uTam", ww, hh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const texto = "#edeef3", gris = "#a2a5b4";
    const anillo = (g, cx, cy, r, prog0, icono) => {
      g.lineCap = "round";
      g.strokeStyle = "rgba(255,255,255,0.15)"; g.lineWidth = r * 0.14; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
      const gr = g.createConicGradient(-Math.PI / 2, cx, cy); gr.addColorStop(0, "#6fb6ff"); gr.addColorStop(0.5, "#a78bff"); gr.addColorStop(1, "#ffd27a");
      g.strokeStyle = gr; g.globalAlpha = 0.2; g.lineWidth = r * 0.36; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + prog0 * Math.PI * 2); g.stroke();
      g.globalAlpha = 1; g.lineWidth = r * 0.14; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + prog0 * Math.PI * 2); g.stroke();
      const a = -Math.PI / 2 + prog0 * Math.PI * 2; g.fillStyle = "#fff"; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.09, 0, 7); g.fill();
      const gi = g.createLinearGradient(0, cy - r, 0, cy + r); gi.addColorStop(0, "rgba(61,123,255,0.25)"); gi.addColorStop(1, "rgba(0,0,0,0.05)");
      g.fillStyle = gi; g.beginPath(); g.arc(cx, cy, r * 0.83, 0, 7); g.fill();
      g.fillStyle = texto; g.font = `bold ${Math.round(r * 0.36)}px sans-serif`; g.textAlign = "center"; g.fillText(Math.round(prog0 * 100) + "%", cx, cy + r * 0.52);
      g.strokeStyle = "#fff"; g.lineWidth = r * 0.07; icono(g, cx, cy - r * 0.2, r * 0.36); g.textAlign = "left";
    };
    const iconoMesa = (g, cx, cy, s) => { g.beginPath(); g.moveTo(cx - s, cy - s * 0.1); g.lineTo(cx + s, cy - s * 0.1); g.lineTo(cx + s * 0.7, cy - s * 0.55); g.lineTo(cx - s * 0.7, cy - s * 0.55); g.closePath();
      g.moveTo(cx - s * 0.8, cy - s * 0.1); g.lineTo(cx - s * 0.8, cy + s * 0.8); g.moveTo(cx + s * 0.8, cy - s * 0.1); g.lineTo(cx + s * 0.8, cy + s * 0.8); g.stroke(); };
    const iconoMano = (g, cx, cy, s) => { g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(cx - s * 0.45 + i * s * 0.3, cy); g.lineTo(cx - s * 0.45 + i * s * 0.3, cy - s * (0.6 + (i === 1 || i === 2 ? 0.25 : 0))); }
      g.moveTo(cx - s * 0.6, cy); g.quadraticCurveTo(cx - s * 0.6, cy + s * 0.8, cx, cy + s * 0.8); g.quadraticCurveTo(cx + s * 0.55, cy + s * 0.8, cx + s * 0.5, cy); g.stroke(); };
    const panel = (g, w, paso) => {
      const fondo = g.createLinearGradient(0, 0, w.px, w.py); fondo.addColorStop(0, "#1a2140"); fondo.addColorStop(0.5, "#141722"); fondo.addColorStop(1, "#10121a");
      g.fillStyle = fondo; g.fillRect(0, 0, w.px, w.py);
      // la cabecera: la marca, Nexo, los pasos
      const mg = g.createConicGradient(0, 62, 58); mg.addColorStop(0, "#7aa6ff"); mg.addColorStop(0.4, "#b38cff"); mg.addColorStop(0.7, "#ffd27a"); mg.addColorStop(1, "#7aa6ff");
      g.strokeStyle = mg; g.lineWidth = 8; g.beginPath(); g.arc(62, 58, 18, 0, 7); g.stroke(); g.fillStyle = "#fff"; g.beginPath(); g.arc(62, 58, 5, 0, 7); g.fill();
      g.fillStyle = texto; g.font = "bold 32px sans-serif"; g.fillText("Nexo", 96, 70);
      const n = 4, k = paso;
      for (let i = 0; i < n; i++) { const ahora = i === k - 1, hecho = i < k - 1; g.fillStyle = hecho ? "#35c28b" : ahora ? "#7aa6ff" : "#3a3e4c";
        const x = w.px - 60 - (n - 1 - i) * 30 - (ahora ? 26 : 0); g.beginPath(); g.roundRect(x, 50, ahora ? 42 : 15, 15, 8); g.fill(); }
      g.fillStyle = "#6f7486"; g.font = "21px sans-serif"; g.textAlign = "center"; g.fillText("Podés volver a prepararlo en Ajustes → Espacio", w.px / 2, w.py - 26); g.textAlign = "left";
      if (paso === 0) {
        g.fillStyle = texto; g.font = "bold 48px sans-serif"; g.fillText("Prepará tu espacio", 42, 160);
        g.fillStyle = gris; g.font = "27px sans-serif"; g.fillText("¿Cómo vas a usar Nexo?", 42, 204);
        const cards = [["Mesa", ["Sentado. Escaneás tu mesa", "y Nexo sólo se mueve", "cuando la ve: nada se desliza."], ["#3d7bff", "#7a4dff"], true],
          ["Cuarto", ["Parado o caminando.", "Escaneás el piso", "y las paredes."], ["#1fa37a", "#1d6fa8"], false],
          ["Sólo girar", ["Sin escanear: la cabeza", "queda fija y sólo girás."], ["#5c6275", "#3a3f4f"], false]];
        const cw = (w.px - 84 - 2 * 24) / 3;
        cards.forEach(([t, lineas, [c1, c2], rec], i) => {
          const x = 42 + i * (cw + 24), y = 236, hh = w.py - 236 - 76;
          const gr = g.createLinearGradient(x, y, x + cw, y + hh); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
          g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, cw, hh, 38); g.fill();
          if (rec) { g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 4; g.stroke();
            g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.roundRect(x + cw - 200, y + 22, 178, 40, 20); g.fill(); g.fillStyle = "#fff"; g.font = "bold 20px sans-serif"; g.fillText("Recomendado", x + cw - 182, y + 49); }
          g.strokeStyle = "#fff"; g.lineWidth = 6;
          if (i === 0) iconoMesa(g, x + 72, y + 86, 38);
          else if (i === 1) { g.beginPath(); g.moveTo(x + 72, y + 46); g.lineTo(x + 112, y + 66); g.lineTo(x + 112, y + 112); g.lineTo(x + 72, y + 132); g.lineTo(x + 32, y + 112); g.lineTo(x + 32, y + 66); g.closePath(); g.moveTo(x + 32, y + 66); g.lineTo(x + 72, y + 86); g.lineTo(x + 112, y + 66); g.moveTo(x + 72, y + 86); g.lineTo(x + 72, y + 132); g.stroke(); }
          else { g.beginPath(); g.arc(x + 72, y + 86, 16, 0, 7); g.stroke(); g.beginPath(); g.arc(x + 72, y + 90, 42, Math.PI * 1.1, Math.PI * 2.8); g.stroke(); }
          g.fillStyle = "#fff"; g.font = "bold 38px sans-serif"; g.fillText(t, x + 28, y + hh - 118);
          g.font = "23px sans-serif"; g.fillStyle = "rgba(255,255,255,0.9)"; lineas.forEach((l, j) => g.fillText(l, x + 28, y + hh - 78 + j * 30));
        });
      } else {
        const datosPaso = paso === 1 ? ["Escaneá tu mesa", ["Mirá tu mesa y mové la cabeza despacio", "de lado a lado. Cuando la vea entera,", "la marco sola."], "Encontré una superficie de 106 × 60 cm", 0.62, iconoMesa, "Esta es mi mesa"]
          : ["Apoyá las manos", ["Apoyá las dos manos en la mesa sobre las", "guías, los dedos para adelante, y quedate", "quieto. Así Nexo aprende a qué distancia", "están tus manos."], "izquierda ✓    derecha…", 0.45, iconoMano, "Otra mesa"];
        anillo(g, 200, 400, 132, datosPaso[3], datosPaso[4]);
        g.fillStyle = texto; g.font = "bold 46px sans-serif"; g.fillText(datosPaso[0], 400, 250);
        g.fillStyle = gris; g.font = "27px sans-serif"; datosPaso[1].forEach((l, j) => g.fillText(l, 400, 306 + j * 38));
        const y0 = 306 + datosPaso[1].length * 38 + 20;
        g.fillStyle = "#7aa6ff"; g.font = "bold 27px sans-serif"; g.fillText(datosPaso[2], 400, y0);
        g.fillStyle = paso === 1 ? "#3d7bff" : "#2a2b34"; g.beginPath(); g.roundRect(400, y0 + 36, paso === 1 ? 300 : 210, 66, 33); g.fill();
        g.fillStyle = "#fff"; g.font = "bold 27px sans-serif"; g.fillText(datosPaso[5], 440, y0 + 79);
        g.fillStyle = "#2a2b34"; g.beginPath(); g.roundRect(400 + (paso === 1 ? 320 : 230), y0 + 36, 150, 66, 33); g.fill();
        g.fillStyle = "#fff"; g.fillText("Saltar", 400 + (paso === 1 ? 350 : 262), y0 + 79);
      }
    };
    const maqueta = (w) => {
      const cv = document.createElement("canvas"); cv.width = w.px; cv.height = w.py; const g = cv.getContext("2d");
      g.fillStyle = "#1b1c21"; g.fillRect(0, 0, w.px, w.py);
      if (w.app === "inicio") panel(g, w, extra.paso ?? 0);
      else if (w.app === "dock") {
        g.fillStyle = "#15161b"; g.fillRect(0, 0, w.px, w.py);
        ["#4d8bff", "#ff7a59", "#35c28b", "#b58cff"].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(90 + i * 125, w.py / 2, 42, 0, 7); g.fill(); });
        g.fillStyle = texto; g.font = "bold 44px sans-serif"; g.fillText("21:45", w.px - 330, w.py / 2 + 16);
        g.fillStyle = gris; g.fillRect(w.px - 170, w.py / 2 - 14, 60, 28); g.fillRect(w.px - 90, w.py / 2 - 20, 40, 40);
      } else if (w.app === "navegador") {
        g.fillStyle = "#26272e"; g.fillRect(0, 0, w.px, 150);
        ["YouTube", "Nexo", "Wikipedia"].forEach((t, i) => { g.fillStyle = i === 1 ? "#1b1c21" : "#2f3039"; g.beginPath(); g.roundRect(20 + i * 260, 14, 245, 52, 14); g.fill(); g.fillStyle = gris; g.font = "24px sans-serif"; g.fillText(t, 50 + i * 260, 48); });
        g.fillStyle = "#3a3c46"; g.beginPath(); g.roundRect(170, 82, w.px - 360, 54, 27); g.fill();
        g.fillStyle = gris; g.font = "28px sans-serif"; g.fillText("Buscá o escribí una dirección", 205, 119);
        const gr = g.createRadialGradient(w.px / 2, -100, 50, w.px / 2, 200, 900); gr.addColorStop(0, "#2b3a66"); gr.addColorStop(1, "#15161b");
        g.fillStyle = gr; g.fillRect(0, 150, w.px, w.py - 150);
        g.fillStyle = texto; g.font = "bold 64px sans-serif"; g.textAlign = "center"; g.fillText("Apps web", w.px / 2, 270); g.textAlign = "left";
        const apps = [["YouTube", "#ff3d3d"], ["WhatsApp", "#25a35a"], ["Mapas", "#2ea55a"], ["Gmail", "#d04535"], ["Música", "#ff5b8a"], ["Twitch", "#9146ff"], ["Wikipedia", "#8a8f9e"], ["Noticias", "#f1a33b"]];
        apps.forEach(([t, c], i) => { const x = w.px / 2 - 420 + (i % 4) * 220, y = 360 + Math.floor(i / 4) * 190; g.fillStyle = c; g.beginPath(); g.roundRect(x, y, 110, 110, 30); g.fill();
          g.fillStyle = "#fff"; g.font = "bold 50px sans-serif"; g.textAlign = "center"; g.fillText(t[0], x + 55, y + 72); g.fillStyle = texto; g.font = "24px sans-serif"; g.fillText(t, x + 55, y + 150); g.textAlign = "left"; });
      } else if (w.app === "galeria") {
        g.fillStyle = texto; g.font = "bold 34px sans-serif"; g.fillText("Galería", 40, 64);
        for (let i = 0; i < 12; i++) { const x = 40 + (i % 4) * 305, y = 100 + Math.floor(i / 4) * 230;
          const gr = g.createLinearGradient(x, y, x + 290, y + 215); gr.addColorStop(0, `hsl(${i * 37},55%,55%)`); gr.addColorStop(1, `hsl(${i * 37 + 60},60%,30%)`);
          g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, 290, 215, 14); g.fill(); }
      } else {
        g.fillStyle = "#15161b"; g.fillRect(0, 0, 300, w.py);
        ["Entorno", "Espacio", "Visor", "Manos", "Sonido", "Acerca de"].forEach((t, i) => { g.fillStyle = i === 1 ? "#2f5fd0" : "transparent"; g.beginPath(); g.roundRect(14, 30 + i * 80, 272, 64, 14); g.fill(); g.fillStyle = texto; g.font = "30px sans-serif"; g.fillText(t, 40, 72 + i * 80); });
        g.fillStyle = texto; g.font = "bold 40px sans-serif"; g.fillText("Espacio", 340, 80);
        ["Preparar el espacio ahora", "Preparar el espacio al empezar", "Sólo moverse cuando veo tu mesa", "Ver la mesa marcada", "La barra de abajo sobre la mesa"].forEach((t, i) => {
          g.fillStyle = "#2a2b34"; g.beginPath(); g.roundRect(340, 120 + i * 120, w.px - 380, 104, 22); g.fill();
          g.fillStyle = texto; g.font = "bold 28px sans-serif"; g.fillText(t, 370, 182 + i * 120);
          g.fillStyle = i === 0 ? "#3d7bff" : "#3d7bff"; g.beginPath(); g.roundRect(w.px - 150, 150 + i * 120, 88, 48, 24); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(w.px - 86, 174 + i * 120, 18, 0, 7); g.fill(); });
      }
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const ventanas = extra.ventanas === "escritorio" ? datos.inicio.escritorio : extra.ventanas === "panel" ? datos.inicio.panel : [];
    gl.useProgram(V); gl.uniformMatrix4fv(U(V, "uVp"), false, vp);
    gl.bindBuffer(gl.ARRAY_BUFFER, vq);
    const apv = A(V, "aPos"); gl.vertexAttribPointer(apv, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(apv);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const orden = ventanas.slice().sort((a, b) => Math.hypot(b.c[0] - ojo[0], b.c[1] - ojo[1], b.c[2] - ojo[2]) - Math.hypot(a.c[0] - ojo[0], a.c[1] - ojo[1], a.c[2] - ojo[2]));
    for (const w of orden) {
      setU("uAlfa", 1); setU("uCarga", 0); setU("uFuerza", 1);
      gl.depthMask(false); setU("uModo", 1); setU("uRadio", 0.03); setU("uColor", 0, 0, 0, 0.28);
      rect(w, 0, 0, -0.004, w.w + 0.12, w.h + 0.12); gl.depthMask(true);
      setU("uModo", 0); setU("uRadio", w.radio); setU("uHover", 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, maqueta(w)); gl.uniform1i(U(V, "uTex"), 0);
      rect(w, 0, 0, 0, w.w, w.h);
      if (w.tipo === 0) { gl.depthMask(false); setU("uModo", 2); setU("uAlfa", 0.55); setU("uColor", 0.85, 0.85, 0.85, 0.7); rect(w, 0, w.barraY, 0.002, w.barraAncho, 0.022); gl.depthMask(true); }
    }
    gl.disableVertexAttribArray(apv); gl.disable(gl.BLEND);

    // ── las manos de guía (ManosGl, el vidrio) ──
    if (extra.guias) {
      const M = prog(datos.manos[datos.manos.length - 1]);
      gl.useProgram(M);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos.inicio.capsula), gl.STATIC_DRAW);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(datos.inicio.indices), gl.STATIC_DRAW);
      const an = A(M, "aNrm"), al = A(M, "aLado");
      gl.vertexAttribPointer(an, 3, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(an);
      gl.vertexAttribPointer(al, 1, gl.FLOAT, false, 16, 12); gl.enableVertexAttribArray(al);
      gl.uniformMatrix4fv(U(M, "uVista"), false, vista); gl.uniformMatrix4fv(U(M, "uProy"), false, proy);
      gl.uniform1f(U(M, "uCorte"), -1); gl.uniform1f(U(M, "uOpacidad"), 0.88); gl.uniform1f(U(M, "uFantasma"), 1);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      datos.inicio.guias.forEach((mano, g) => {
        const ok = g === 0;   // la izquierda ya está apoyada (verde), la derecha todavía no (dorada)
        const c = ok ? [0.45, 1, 0.7] : [1, 0.83, 0.45], bd = ok ? [0.45, 1, 0.7] : [1, 0.9, 0.6];
        gl.uniform3fv(U(M, "uColor"), c); gl.uniform3fv(U(M, "uBorde"), bd);
        datos.inicio.huesos.forEach(([h, f], k) => {
          const m = k >= 21 ? 1.35 : 1;
          gl.uniform3fv(U(M, "uA"), mano[h]); gl.uniform3fv(U(M, "uB"), mano[f]);
          gl.uniform2f(U(M, "uR"), datos.inicio.radio[h] * m, datos.inicio.radio[f] * m);
          gl.uniform2f(U(M, "uBr"), ok ? 1 : 0.35, 0.8);
          gl.drawElements(gl.TRIANGLES, datos.inicio.indices.length, gl.UNSIGNED_SHORT, 0);
        });
      });
      gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
    }
    // un poco de "cámara": viñeta
    return gl.getError();
  }, { datos, W, H, mirar, extra: extra || {} });
  await pag.screenshot({ path: `${salida}/vista-inicio-${nombre}.png` });
  console.log(`✓ vista-inicio-${nombre}.png (error GL ${err})`);
}

await foto("elegir", [0, -0.2, -1], { ventanas: "panel", paso: 0 });
await foto("escanear", [0.05, -0.75, -0.66], { planos: true, nube: true, ventanas: "panel", paso: 1 });
await foto("manos", [0.03, -0.8, -0.6], { mesa: true, onda: true, etiqueta: true, guias: true, ventanas: "panel", paso: 2, t: 1.1 });
await foto("escritorio", [0, -0.42, -1], { mesa: true, alfaMesa: 0.5, etiqueta: true, ventanas: "escritorio" });
await nav.close();
