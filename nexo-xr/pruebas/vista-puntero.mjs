// Vista previa del INDICADOR DE LA MANO sin teléfono: la mano (ManosGl, el
// vidrio), el anillo entre el pulgar y el índice, el rayo y el cursor, con los
// shaders DE VERDAD de VentanasGl y los mismos números que Principal.rayoMano
// y VentanasGl.cursor/pinza/rayo. Cuatro momentos del doble pellizco:
//   suelto → cerrando los dedos → armado (después del primero) → apretando.
//
//   ./pruebas/vista.sh   → salida/vista-puntero-*.png y salida/vista-puntero.png (los cuatro juntos)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "../../mundo-ar/node_modules/playwright");

const [datosRuta, salida] = process.argv.slice(2);
const datos = JSON.parse(readFileSync(datosRuta, "utf8"));
const W = 960, H = 600;
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const pag = await nav.newPage({ viewport: { width: W, height: H } });
await pag.setContent(`<body style="margin:0;background:#000"><canvas id="c" width="${W}" height="${H}"></canvas></body>`);

async function foto(nombre, estado) {
  const err = await pag.evaluate(({ datos, W, H, estado }) => {
    const gl = document.getElementById("c").getContext("webgl", { preserveDrawingBuffer: true, antialias: true });
    const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = (p) => { const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, p.vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, p.fs)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); return pr; };
    const U = (p, n) => gl.getUniformLocation(p, n), A = (p, n) => gl.getAttribLocation(p, n);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const nrm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], esc = (a, k) => a.map((v) => v * k);
    const mix3 = (a, b, k) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * k);
    const mul = (a, b) => { const r = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) r[c * 4 + rr] += a[k * 4 + rr] * b[c * 4 + k]; return r; };

    // ── la escena: la ventana del navegador adelante, la mano derecha apuntándole ──
    const win = datos.ventanas.find((w) => w.app === "navegador");
    const ojo = [0.0315, 1.6, 0];
    const u0 = 0.62, v0 = 0.42;
    const hit = [0, 1, 2].map((k) => win.c[k] + win.r[k] * (u0 - 0.5) * win.w + win.u[k] * (0.5 - v0) * win.h);
    // la mano: la guía derecha de Mesa.manosGuia (la palma para abajo, los dedos para adelante), llevada al aire
    const guia = datos.inicio.guias[1];
    const nud = esc(add(guia[5], guia[9]), 0.5);
    const donde = [0.14, 1.38, -0.34];
    // (un poco girada: los dedos apuntan hacia la ventana, la muñeca más baja)
    const ang = -0.35, cA = Math.cos(ang), sA = Math.sin(ang);
    const mano = guia.map((p) => { const q = sub(p, nud); const y = q[1] * cA - q[2] * sA, z = q[1] * sA + q[2] * cA; return add([q[0], y, z], donde); });
    // pellizcar: el pulgar y el índice hacia su punto medio
    const medio = esc(add(mano[4], mano[8]), 0.5);
    const cierre = estado.cierre;
    for (const [i, k] of [[4, 0.97], [3, 0.45], [8, 0.97], [7, 0.4]]) mano[i] = mix3(mano[i], medio, cierre * k);

    // la cámara: desde el ojo derecho, hacia entre la mano y el cursor
    const mira = nrm(sub(mix3(mano[9], hit, 0.36), ojo));
    const sx = nrm(cross(mira, [0, 1, 0])), ux = cross(sx, mira);
    const vista = [sx[0], ux[0], -mira[0], 0, sx[1], ux[1], -mira[1], 0, sx[2], ux[2], -mira[2], 0,
      -(sx[0] * ojo[0] + sx[1] * ojo[1] + sx[2] * ojo[2]), -(ux[0] * ojo[0] + ux[1] * ojo[1] + ux[2] * ojo[2]), mira[0] * ojo[0] + mira[1] * ojo[1] + mira[2] * ojo[2], 1];
    const fov = 62 * Math.PI / 180, asp = W / H, cerca = 0.03, lejos = 100, fy = 1 / Math.tan(fov / 2);
    const proy = [fy / asp, 0, 0, 0, 0, fy, 0, 0, 0, 0, (lejos + cerca) / (cerca - lejos), -1, 0, 0, 2 * lejos * cerca / (cerca - lejos), 0];
    const vp = mul(proy, vista);

    gl.viewport(0, 0, W, H);
    gl.clearColor(0.09, 0.1, 0.13, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // el fondo: el entorno "Espacio"
    const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    {
      const inv = (m) => { const r = new Float32Array(16), [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33] = m;
        const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
          b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
        const det=1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
        r[0]=(a11*b11-a12*b10+a13*b09)*det; r[1]=(a02*b10-a01*b11-a03*b09)*det; r[2]=(a31*b05-a32*b04+a33*b03)*det; r[3]=(a22*b04-a21*b05-a23*b03)*det;
        r[4]=(a12*b08-a10*b11-a13*b07)*det; r[5]=(a00*b11-a02*b08+a03*b07)*det; r[6]=(a32*b02-a30*b05-a33*b01)*det; r[7]=(a20*b05-a22*b02+a23*b01)*det;
        r[8]=(a10*b10-a11*b08+a13*b06)*det; r[9]=(a01*b08-a00*b10-a03*b06)*det; r[10]=(a30*b04-a31*b02+a33*b00)*det; r[11]=(a21*b02-a20*b04-a23*b00)*det;
        r[12]=(a11*b07-a10*b09-a12*b06)*det; r[13]=(a00*b09-a01*b07+a02*b06)*det; r[14]=(a31*b01-a30*b03-a32*b00)*det; r[15]=(a20*b03-a21*b01+a22*b00)*det; return r; };
      const P = prog(datos.programas[0]); gl.useProgram(P);
      gl.uniformMatrix4fv(U(P, "uInv"), false, inv(vp)); gl.uniform3fv(U(P, "uOjo"), ojo); gl.uniform1f(U(P, "uT"), 12.3);
      gl.uniform1f(U(P, "uPiso"), 0); gl.uniform2f(U(P, "uAncla"), 0, 0); gl.uniform1f(U(P, "uLuz"), 1);
      const a = A(P, "aPos"); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(a);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(a);
    }

    // ── VentanasGl ──
    const V = prog(datos.programas[datos.programas.length - 1]);
    const vq = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vq); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    const usarV = () => {
      gl.useProgram(V); gl.uniformMatrix4fv(U(V, "uVp"), false, vp);
      gl.bindBuffer(gl.ARRAY_BUFFER, vq);
      const ap = A(V, "aPos"); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(ap);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.DEPTH_TEST);
      return ap;
    };
    const setU = (n, ...v) => { const l = U(V, n); if (v.length === 1) gl.uniform1f(l, v[0]); else if (v.length === 2) gl.uniform2f(l, ...v); else if (v.length === 3) gl.uniform3f(l, ...v); else gl.uniform4f(l, ...v); };
    const rect = (w, x, y, z, ww, hh) => {
      const c = [0, 1, 2].map((k) => w.c[k] + w.r[k] * x + w.u[k] * y + w.n[k] * z);
      setU("uC", ...c); setU("uR", ...w.r.map((v) => v * ww)); setU("uU", ...w.u.map((v) => v * hh)); setU("uTam", ww, hh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    let ap = usarV();
    setU("uAlfa", 1); setU("uCarga", 0); setU("uFuerza", 1); setU("uArmado", 0);
    // la ventana (una página de maqueta)
    const cv = document.createElement("canvas"); cv.width = win.px; cv.height = win.py; const g = cv.getContext("2d");
    g.fillStyle = "#26272e"; g.fillRect(0, 0, win.px, 90);
    g.fillStyle = "#3a3c46"; g.beginPath(); g.roundRect(170, 18, win.px - 360, 54, 27); g.fill();
    g.fillStyle = "#9a9caa"; g.font = "28px sans-serif"; g.fillText("google.com", 205, 55);
    g.fillStyle = "#fff"; g.fillRect(0, 90, win.px, win.py - 90);
    g.fillStyle = "#4285f4"; g.font = "bold 110px sans-serif"; g.fillText("Buscar", win.px / 2 - 180, 330);
    g.strokeStyle = "#ccc"; g.lineWidth = 3; g.beginPath(); g.roundRect(win.px / 2 - 330, 400, 660, 70, 35); g.stroke();
    ["YouTube", "Wikipedia", "Mapas", "Noticias"].forEach((t, i) => { g.fillStyle = ["#ff3d3d", "#666", "#2ea55a", "#4285f4"][i]; g.beginPath(); g.arc(win.px / 2 - 330 + i * 220, 600, 50, 0, 7); g.fill(); g.fillStyle = "#333"; g.font = "26px sans-serif"; g.fillText(t, win.px / 2 - 380 + i * 220, 690); });
    const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.depthMask(false); setU("uModo", 1); setU("uRadio", 0.03); setU("uColor", 0.35, 0.55, 0.9, 0.48);
    rect(win, 0, 0, -0.004, win.w + 0.12, win.h + 0.12); gl.depthMask(true);
    setU("uModo", 0); setU("uRadio", win.radio); setU("uHover", 1); gl.uniform1i(U(V, "uTex"), 0);
    rect(win, 0, 0, 0, win.w, win.h);
    gl.disableVertexAttribArray(ap);

    // ── la mano (ManosGl: el vidrio con el borde que brilla) ──
    {
      const M = prog(datos.manos[datos.manos.length - 1]);
      gl.useProgram(M);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos.inicio.capsula), gl.STATIC_DRAW);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(datos.inicio.indices), gl.STATIC_DRAW);
      const an = A(M, "aNrm"), al = A(M, "aLado");
      gl.vertexAttribPointer(an, 3, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(an);
      gl.vertexAttribPointer(al, 1, gl.FLOAT, false, 16, 12); gl.enableVertexAttribArray(al);
      gl.uniformMatrix4fv(U(M, "uVista"), false, vista); gl.uniformMatrix4fv(U(M, "uProy"), false, proy);
      gl.uniform1f(U(M, "uCorte"), -1); gl.uniform1f(U(M, "uOpacidad"), 0.85); gl.uniform1f(U(M, "uFantasma"), 1);
      gl.uniform3fv(U(M, "uColor"), [0.78, 0.84, 0.95]); gl.uniform3fv(U(M, "uBorde"), [0.75, 0.88, 1]);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      datos.inicio.huesos.forEach(([h, f], k) => {
        const m = k >= 21 ? 1.35 : 1;
        gl.uniform3fv(U(M, "uA"), mano[h]); gl.uniform3fv(U(M, "uB"), mano[f]);
        gl.uniform2f(U(M, "uR"), datos.inicio.radio[h] * m, datos.inicio.radio[f] * m);
        gl.uniform2f(U(M, "uBr"), estado.apretando ? 1 : 0.35, 0.8);
        gl.drawElements(gl.TRIANGLES, datos.inicio.indices.length, gl.UNSIGNED_SHORT, 0);
      });
      gl.disableVertexAttribArray(an); gl.disableVertexAttribArray(al);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      gl.depthFunc(gl.LESS); gl.depthMask(true);
    }

    // ── el indicador (lo mismo que Principal.rayoMano → VentanasGl.pinza, rayo y cursor) ──
    ap = usarV();
    const { fuerza, armado, apretando } = estado, t = estado.t;
    gl.depthMask(false);
    // el anillo entre el pulgar y el índice
    {
      const a = mano[4], b = mano[8], c = esc(add(a, b), 0.5);
      const tam = Math.max(0.016, Math.min(0.06, Math.hypot(...sub(a, b)) * 1.15 + 0.008));
      const v = nrm(sub(c, ojo));
      let r = [-v[2], 0, v[0]]; r = nrm(r);
      const u = [-r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1]];
      setU("uModo", 4); setU("uAlfa", 1); setU("uFuerza", fuerza); setU("uArmado", armado); setU("uCarga", 0);
      if (apretando) setU("uColor", 0.45, 0.72, 1, 0.95); else setU("uColor", 1, 1, 1, 0.8);
      setU("uC", ...c); setU("uR", ...esc(r, tam)); setU("uU", ...esc(u, tam)); setU("uTam", tam, tam);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // el rayo: justo delante del anillo, hasta donde pega
      const dir = nrm(sub(hit, c)), A0 = add(c, esc(dir, 0.025));
      const d = sub(hit, A0), e = sub(ojo, esc(add(A0, hit), 0.5));
      let s = cross(d, e); const sl = Math.hypot(...s); s = s.map((x) => x * 0.011 / sl);
      setU("uModo", 6); setU("uAlfa", 1); setU("uFuerza", fuerza); setU("uArmado", armado); setU("uCarga", t % 1000);
      if (apretando) setU("uColor", 0.45, 0.72, 1, 0.95); else setU("uColor", 1, 1, 1, 0.8);
      setU("uC", ...esc(add(A0, hit), 0.5)); setU("uR", ...d); setU("uU", ...s); setU("uTam", 1, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // el cursor
    {
      const dist = Math.hypot(...sub(hit, mano[9]));
      const tam = Math.max(0.022, Math.max(0.3, dist) * 0.05);
      setU("uModo", 4); setU("uAlfa", 1); setU("uFuerza", fuerza); setU("uCarga", 0); setU("uArmado", armado);
      if (apretando) setU("uColor", 0.45, 0.72, 1, 1); else setU("uColor", 1, 1, 1, 1);
      rect(win, (u0 - 0.5) * win.w, (0.5 - v0) * win.h, 0.004, tam, tam);
    }
    gl.depthMask(true);
    gl.disableVertexAttribArray(ap);
    return gl.getError();
  }, { datos, W, H, estado });
  await pag.screenshot({ path: `${salida}/vista-puntero-${nombre}.png` });
  console.log(`✓ vista-puntero-${nombre}.png (error GL ${err})`);
}

const estados = [
  ["1-suelto", "Apuntando (dedos sueltos)", { cierre: 0, fuerza: 1, armado: 0, apretando: false, t: 0 }],
  ["2-cerrando", "Cerrando los dedos", { cierre: 0.62, fuerza: 0.35, armado: 0, apretando: false, t: 0 }],
  ["3-armado", "Primer pellizco hecho: falta el segundo", { cierre: 0.15, fuerza: 0.9, armado: 0.62, apretando: false, t: 0.31 }],
  ["4-apretando", "Segundo pellizco: clic (sostené para arrastrar)", { cierre: 1, fuerza: 0, armado: 0, apretando: true, t: 0 }],
];
for (const [n, , e] of estados) await foto(n, e);

// los cuatro juntos, con su título
const imgs = estados.map(([n, titulo]) => ({ titulo, src: "data:image/png;base64," + readFileSync(`${salida}/vista-puntero-${n}.png`).toString("base64") }));
const junta = await nav.newPage({ viewport: { width: W * 2, height: H * 2 + 80 } });
await junta.setContent(`<body style="margin:0;background:#101114;font:600 30px system-ui,sans-serif;color:#e8e9ee">
<div style="height:80px;display:flex;align-items:center;padding-left:28px">El clic con la mano: doble pellizco</div>
<div style="display:grid;grid-template-columns:${W}px ${W}px">${imgs.map((i) => `<div style="position:relative;width:${W}px;height:${H}px"><img src="${i.src}" style="display:block">
<div style="position:absolute;left:18px;bottom:16px;background:#000a;padding:8px 14px;border-radius:12px;font-size:24px">${i.titulo}</div></div>`).join("")}</div></body>`);
await junta.screenshot({ path: `${salida}/vista-puntero.png` });
console.log("✓ vista-puntero.png");
await nav.close();
