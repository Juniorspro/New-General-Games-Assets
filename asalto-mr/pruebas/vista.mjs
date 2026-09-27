// Vista previa sin teléfono: dibuja con WebGL (Chromium) lo que arma
// pruebas/vista/Vista.java —la malla escaneada de verdad y las cajas que
// dibuja Figuras.java de verdad— con LOS MISMOS shaders de la app (sacados de
// los .java). La "cámara" es la escena de prueba dibujada por trazado de rayos.
//
//   ./pruebas/vista.sh      → salida/vista-*.png
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extraerProgramas } from "./extraer.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "../../mundo-ar/node_modules/playwright");

const [datosRuta, salida] = process.argv.slice(2);   // [3] = carpeta con las fotos de manos (opcional)
const datos = JSON.parse(readFileSync(datosRuta, "utf8"));
const P = extraerProgramas();
const buscar = (archivo, f) => { const p = P.find((p) => p.archivo === archivo && f(p)); if (!p) throw new Error("no encuentro un programa de " + archivo); return p; };
const sh = {
  prof: buscar("MallaGl.java", (p) => p.fs.includes("vec4(0.0)")),
  lin: buscar("MallaGl.java", (p) => p.vs.includes("uCentro")),
  rep: buscar("MallaGl.java", (p) => p.vs.includes("uVpCam")),
  caja: buscar("Figuras.java", (p) => p.vs.includes("uModelo")),
  punto: buscar("Figuras.java", (p) => p.vs.includes("aTam")),
  lentes: buscar("Lentes.java", () => true),
  mira: buscar("Hud.java", (p) => p.fs.includes("uColor")),
  zonas: buscar("ZonasGl.java", () => true),
  sellos: buscar("SellosGl.java", () => true),
  linea: buscar("Figuras.java", (p) => p.vs.includes("aCol") && !p.vs.includes("aTam")),
  manoProf: buscar("ManosGl.java", (p) => p.fs.includes("vec4(0.0)")),
  manoVidrio: buscar("ManosGl.java", (p) => p.fs.includes("fwidth")),
  manoVidrioSin: buscar("ManosGl.java", (p) => p.fs.includes("uFantasma") && !p.fs.includes("fwidth")),
};

const W = 2340, H = 1080;
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const pag = await nav.newPage({ viewport: { width: W, height: H } });
await pag.setContent(`<body style="margin:0;background:#000"><canvas id="c" width="${W}" height="${H}"></canvas></body>`);

async function foto(modo, nombre) {
  const err = await pag.evaluate(({ datos, sh, modo, W, H }) => {
    const c = document.getElementById("c");
    const gl = c.getContext("webgl", { preserveDrawingBuffer: true, antialias: true });
    const prog = (p) => {
      const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram();
      gl.attachShader(pr, mk(gl.VERTEX_SHADER, p.vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, p.fs)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      return pr;
    };
    const U = (pr, n) => gl.getUniformLocation(pr, n), A = (pr, n) => gl.getAttribLocation(pr, n);
    // ── la "cámara": la escena de prueba (piso, pared, mesa, tronco) por trazado de rayos ──
    const camara = prog({
      vs: "attribute vec2 aPos; varying vec2 vP; void main(){ gl_Position=vec4(aPos,0.0,1.0); vP=aPos; }",
      fs: `precision highp float; uniform mat4 uInv; varying vec2 vP;
        float caja(vec3 p, vec3 a, vec3 b){ vec3 c=(a+b)*0.5, e=(b-a)*0.5; vec3 q=abs(p-c)-e; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0); }
        float esc(vec3 p, out int id){ float d=p.y; id=0; float w=p.z+4.0; if(w<d){d=w;id=1;}
          float m=caja(p,vec3(0.5,0.0,-2.5),vec3(1.5,0.8,-1.5)); if(m<d){d=m;id=2;}
          float t=length(p.xz-vec2(-1.5,-2.0))-0.25; if(t<d){d=t;id=3;} return d; }
        float ruido(vec2 p){ return fract(sin(dot(floor(p),vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          vec4 a=uInv*vec4(vP,-1.0,1.0), b=uInv*vec4(vP,1.0,1.0); vec3 o=a.xyz/a.w, d=normalize(b.xyz/b.w-o);
          float t=0.0; int id=-1; for(int i=0;i<160;i++){ int k; float h=esc(o+d*t,k); if(h<0.001){id=k;break;} t+=h; if(t>40.0)break; }
          vec3 col = mix(vec3(0.62,0.78,0.95), vec3(0.32,0.55,0.9), clamp(d.y*2.0,0.0,1.0));
          if(id>=0){ vec3 p=o+d*t; int k; vec2 e=vec2(0.002,0.0);
            vec3 n=normalize(vec3(esc(p+e.xyy,k)-esc(p-e.xyy,k),esc(p+e.yxy,k)-esc(p-e.yxy,k),esc(p+e.yyx,k)-esc(p-e.yyx,k)));
            float r=ruido(p.xz*18.0)*0.5+ruido(p.xz*5.0)*0.5;
            vec3 base = id==0 ? mix(vec3(0.33,0.42,0.18),vec3(0.45,0.36,0.24),smoothstep(0.3,0.8,ruido(p.xz*1.3))) *(0.8+0.4*r)
                      : id==1 ? vec3(0.82,0.79,0.72)*(0.92+0.08*ruido(p.xy*9.0))
                      : id==2 ? vec3(0.45,0.3,0.18)*(0.85+0.15*ruido(p.xz*30.0))
                      : vec3(0.3,0.24,0.18)*(0.7+0.5*ruido(vec2(atan(p.z+2.0,p.x+1.5)*20.0,p.y*30.0)));
            float luz = 0.45+0.65*max(dot(n,normalize(vec3(0.4,0.9,0.35))),0.0);
            col = mix(base*luz, col, smoothstep(12.0,40.0,t)); }
          gl_FragColor=vec4(col,1.0); }`,
    });
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const inv = (m) => { // inversa 4×4 por columnas
      const r = new Float32Array(16), [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33] = m;
      const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
        b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
      const det=1/(b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06);
      r[0]=(a11*b11-a12*b10+a13*b09)*det; r[1]=(a02*b10-a01*b11-a03*b09)*det; r[2]=(a31*b05-a32*b04+a33*b03)*det; r[3]=(a22*b04-a21*b05-a23*b03)*det;
      r[4]=(a12*b08-a10*b11-a13*b07)*det; r[5]=(a00*b11-a02*b08+a03*b07)*det; r[6]=(a32*b02-a30*b05-a33*b01)*det; r[7]=(a20*b05-a22*b02+a23*b01)*det;
      r[8]=(a10*b10-a11*b08+a13*b06)*det; r[9]=(a01*b08-a00*b10-a03*b06)*det; r[10]=(a30*b04-a31*b02+a33*b00)*det; r[11]=(a21*b02-a20*b04-a23*b00)*det;
      r[12]=(a11*b07-a10*b09-a12*b06)*det; r[13]=(a00*b09-a01*b07+a02*b06)*det; r[14]=(a31*b01-a30*b03-a32*b00)*det; r[15]=(a20*b03-a21*b01+a22*b00)*det;
      return r;
    };
    const dibujarCamara = (vp) => {
      gl.useProgram(camara); gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.uniformMatrix4fv(U(camara, "uInv"), false, inv(vp));
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); const a = A(camara, "aPos"); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(a);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.depthMask(true); gl.enable(gl.DEPTH_TEST);
    };
    // ── la malla ──
    const mv = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, mv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos.malla.v), gl.STATIC_DRAW);
    const mt = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mt); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(datos.malla.tri), gl.STATIC_DRAW);
    const ml = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ml); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(datos.malla.lin), gl.STATIC_DRAW);
    gl.getExtension("OES_standard_derivatives");
    // (el vidrio con derivadas sólo si la extensión está: si no, queda afuera; la mano usa el de respaldo)
    const P = Object.fromEntries(Object.entries(sh).map(([k, p]) => { try { return [k, prog(p)]; } catch (e) { if (k === "manoVidrio") return [k, null]; throw e; } }));
    const atrMalla = (pr, nor) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, mv);
      const a = A(pr, "aPos"); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(a);
      if (nor) { const n = A(pr, "aNor"); gl.vertexAttribPointer(n, 3, gl.FLOAT, false, 28, 12); gl.enableVertexAttribArray(n); }
      const inf = A(pr, "aInf"); if (inf >= 0) { gl.vertexAttribPointer(inf, 1, gl.FLOAT, false, 28, 24); gl.enableVertexAttribArray(inf); }
    };
    const soltarMalla = (pr) => { for (const n of ["aNor", "aInf"]) { const x = A(pr, n); if (x >= 0) gl.disableVertexAttribArray(x); } };
    const profundidad = (vp) => {
      gl.useProgram(P.prof); gl.uniformMatrix4fv(U(P.prof, "uVp"), false, vp); atrMalla(P.prof, false);
      gl.colorMask(false, false, false, false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mt); gl.drawElements(gl.TRIANGLES, datos.malla.tri.length, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true, true, true, true);
    };
    const reproyectada = (vp, vpCam, tex) => {
      gl.useProgram(P.rep); gl.uniformMatrix4fv(U(P.rep, "uVp"), false, vp); gl.uniformMatrix4fv(U(P.rep, "uVpCam"), false, vpCam);
      gl.uniform2f(U(P.rep, "uT0"), 0, 0); gl.uniform2f(U(P.rep, "uEjeX"), 1, 0); gl.uniform2f(U(P.rep, "uEjeY"), 0, 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U(P.rep, "uTex"), 0);
      atrMalla(P.rep, false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 2);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mt); gl.drawElements(gl.TRIANGLES, datos.malla.tri.length, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    };
    const lineas = (vp, radio, alfa) => {
      gl.useProgram(P.lin); gl.uniformMatrix4fv(U(P.lin, "uVp"), false, vp);
      gl.uniform3fv(U(P.lin, "uCentro"), datos.jugador); gl.uniform1f(U(P.lin, "uRadio"), radio); gl.uniform1f(U(P.lin, "uAlfa"), alfa); gl.uniform1f(U(P.lin, "uAncho"), 0.45);
      atrMalla(P.lin, true); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ml); gl.drawElements(gl.LINES, datos.malla.lin.length, gl.UNSIGNED_SHORT, 0);
      gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
      soltarMalla(P.lin);
    };
    // ── las zonas de la IA (mismos colores que ZonasGl.java) ──
    const colorZona = { S: [0.2, 0.95, 0.5, 0.16], s: [0.25, 0.8, 0.95, 0.12], C: [1, 0.85, 0.2, 0.45], A: [0.2, 0.5, 1, 0.4], a: [0.2, 0.5, 1, 0.4], O: [1, 0.25, 0.2, 0.25], o: [1, 0.25, 0.2, 0.15], F: [1, 0.2, 0.9, 0.35] };
    const zonas = (vp, m) => {
      const v = [], cel = m.celda, mg = cel * 0.08;
      for (let c = 0; c < m.n * m.n; c++) {
        const ch = m.c[c], col = colorZona[ch]; if (!col) continue;
        const x0 = (m.i0 + (c % m.n)) * cel + mg, z0 = (m.k0 + Math.floor(c / m.n)) * cel + mg, x1 = x0 + cel - 2 * mg, z1 = z0 + cel - 2 * mg;
        const y = (ch === "F" ? m.pisoRef : m.piso[c]) + 0.03;
        for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]]) v.push(x, y, z, ...col);
      }
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
      gl.useProgram(P.zonas); gl.uniformMatrix4fv(U(P.zonas, "uVp"), false, vp);
      const a = A(P.zonas, "aPos"), co = A(P.zonas, "aCol");
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(co, 4, gl.FLOAT, false, 28, 12); gl.enableVertexAttribArray(co);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, 0, v.length / 7);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.disableVertexAttribArray(co);
    };
    // ── los huecos (SellosGl.armar de verdad, con su shader): lo visible y, más tenue, lo tapado ──
    const sellos = (vp, v, t, dest) => {
      if (!v.length) return;
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
      const pr = P.sellos; gl.useProgram(pr); gl.uniformMatrix4fv(U(pr, "uVp"), false, vp);
      gl.uniform1f(U(pr, "uT"), t); gl.uniform1f(U(pr, "uDest"), dest);
      const a = A(pr, "aPos"), co = A(pr, "aCol"), ef = A(pr, "aEfecto");
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(co, 4, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(co);
      gl.vertexAttribPointer(ef, 1, gl.FLOAT, false, 32, 28); gl.enableVertexAttribArray(ef);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL); gl.uniform1f(U(pr, "uRayosX"), 1); gl.drawArrays(gl.TRIANGLES, 0, v.length / 8);
      gl.depthFunc(gl.GREATER); gl.uniform1f(U(pr, "uRayosX"), 0.5); gl.drawArrays(gl.TRIANGLES, 0, v.length / 8);
      gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND); gl.disableVertexAttribArray(co); gl.disableVertexAttribArray(ef);
    };
    const rutas = (vp) => {
      const v = [];
      for (const r of datos.rutas) for (let j = 0; j + 5 < r.length; j += 3) v.push(r[j], r[j + 1] + 0.06, r[j + 2], 1, 0.85, 0.2, 0.9, r[j + 3], r[j + 4] + 0.06, r[j + 5], 1, 0.85, 0.2, 0.9);
      if (!v.length) return;
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
      gl.useProgram(P.linea); gl.uniformMatrix4fv(U(P.linea, "uVp"), false, vp);
      const a = A(P.linea, "aPos"), co = A(P.linea, "aCol");
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(co, 4, gl.FLOAT, false, 28, 12); gl.enableVertexAttribArray(co);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.lineWidth(5);
      gl.drawArrays(gl.LINES, 0, v.length / 7);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.disableVertexAttribArray(co);
    };
    // ── cajas (lo que grabó Figuras.java) ──
    const cubo = []; const caras = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const n of caras) { const u = Math.abs(n[1]) > 0.5 ? [1,0,0] : [0,1,0]; const w = [n[1]*u[2]-n[2]*u[1], n[2]*u[0]-n[0]*u[2], n[0]*u[1]-n[1]*u[0]];
      const s = [[-1,-1],[1,-1],[1,1],[-1,1]]; const e = s.map(([a,b]) => [0,1,2].map((k) => 0.5*(n[k]+a*u[k]+b*w[k])));
      for (const i of [0,1,2,0,2,3]) cubo.push(...e[i], ...n); }
    const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubo), gl.STATIC_DRAW);
    const cajas = (lista) => {
      gl.useProgram(P.caja); gl.bindBuffer(gl.ARRAY_BUFFER, cb);
      const a = A(P.caja, "aPos"), n = A(P.caja, "aNor");
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(n, 3, gl.FLOAT, false, 24, 12); gl.enableVertexAttribArray(n);
      gl.uniform3f(U(P.caja, "uLuz"), 0.37, 0.84, 0.4);
      for (const k of lista) {
        gl.uniformMatrix4fv(U(P.caja, "uMvp"), false, k.slice(0, 16)); gl.uniformMatrix4fv(U(P.caja, "uModelo"), false, k.slice(16, 32));
        gl.uniform4f(U(P.caja, "uColor"), k[32], k[33], k[34], k[35]); gl.drawArrays(gl.TRIANGLES, 0, 36);
      }
      gl.disableVertexAttribArray(n);
    };
    // ── discos (los blancos de práctica que grabó Figuras.dibujarBlancos) ──
    const fb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos.vistas.disco || [0]), gl.STATIC_DRAW);
    const discos = (lista) => {
      if (!lista || !lista.length) return;
      gl.useProgram(P.caja); gl.bindBuffer(gl.ARRAY_BUFFER, fb);
      const a = A(P.caja, "aPos"), n = A(P.caja, "aNor");
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(n, 3, gl.FLOAT, false, 24, 12); gl.enableVertexAttribArray(n);
      gl.uniform3f(U(P.caja, "uLuz"), 0.37, 0.84, 0.4);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      for (const k of lista) {
        gl.polygonOffset(k[36], k[37]);
        gl.uniformMatrix4fv(U(P.caja, "uMvp"), false, k.slice(0, 16)); gl.uniformMatrix4fv(U(P.caja, "uModelo"), false, k.slice(16, 32));
        gl.uniform4f(U(P.caja, "uColor"), k[32], k[33], k[34], k[35]); gl.drawArrays(k[38], k[39], k[40]);
      }
      gl.disable(gl.BLEND); gl.disable(gl.POLYGON_OFFSET_FILL); gl.disableVertexAttribArray(n);
    };
    // ── partículas (con el shader de Figuras) ──
    const colores = [[1,0.75,0.3],[0.55,0.47,0.36],[0.07,0.06,0.05],[0.75,0.75,0.72],[1,0.85,0.45],[1,0.6,0.2]];
    const pts = []; for (const [x,y,z,t,tipo,f] of datos.particulas) { const c = colores[tipo]; const a = tipo===0?f:tipo===1?0.55*f:tipo===2?Math.min(1,f*3):tipo===4?1:0.35*f; pts.push(x,y,z,t,...c,a); }
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    const particulas = (vp, escala) => {
      gl.useProgram(P.punto); gl.uniformMatrix4fv(U(P.punto, "uVp"), false, vp); gl.uniform1f(U(P.punto, "uEscala"), escala);
      gl.bindBuffer(gl.ARRAY_BUFFER, pb);
      const a = A(P.punto, "aPos"), t = A(P.punto, "aTam"), c = A(P.punto, "aCol");
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(t, 1, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(t);
      gl.vertexAttribPointer(c, 4, gl.FLOAT, false, 32, 16); gl.enableVertexAttribArray(c);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, datos.particulas.length);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.disableVertexAttribArray(t); gl.disableVertexAttribArray(c);
    };
    const mira = (asp) => {
      const s = 0.018, g = 0.02, ax = 1 / asp;
      const v = [-(g+s)*ax,0,-g*ax,0, (g+s)*ax,0,g*ax,0, 0,-(g+s),0,-g, 0,g+s,0,g, -0.002*ax,0,0.002*ax,0, 0,-0.002,0,0.002];
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
      gl.useProgram(P.mira); gl.uniform4f(U(P.mira, "uColor"), 1, 0.3, 0.25, 1);
      const a = A(P.mira, "aPos"); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 8, 0); gl.enableVertexAttribArray(a);
      gl.disable(gl.DEPTH_TEST); gl.lineWidth(4); gl.drawArrays(gl.LINES, 0, 12); gl.enable(gl.DEPTH_TEST);
    };
    const escena = (v, vpFondo, fondoTex, alfaMalla, soldados, eyeH, ia) => {
      dibujarCamara(vpFondo);
      if (fondoTex) reproyectada(v.vp, datos.vistas.camaraSbs, fondoTex); else profundidad(v.vp);
      if (soldados) cajas(v.cajas.slice(0, v.nSoldados));
      if (ia) { zonas(v.vp, datos.mapas.ia); rutas(v.vp); }
      if (soldados) particulas(v.vp, (fondoTex ? 2.1445 : 3.2709) * eyeH / 2);
      lineas(v.vp, soldados ? 3.2 : 2.6, alfaMalla);
      if (soldados) { gl.clear(gl.DEPTH_BUFFER_BIT); cajas(v.cajas.slice(v.nSoldados)); }
    };
    gl.enable(gl.DEPTH_TEST);
    if (modo === "sbs") {
      // la imagen "de la cámara" (el ojo del medio) a una textura, como la da ARCore
      const mkTex = (w, h) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
      const fbo = (tex, w, h) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d); return f; };
      const camTex = mkTex(1076, 994); const camF = fbo(camTex, 1076, 994);
      gl.viewport(0, 0, 1076, 994); dibujarCamara(datos.vistas.camaraSbs);
      const todo = mkTex(W, H); const todoF = fbo(todo, W, H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, todoF); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const sep = 63 / 25.4 * 400, ew = 1076, eh = 994;
      const ojos = [];
      ["izq", "der"].forEach((n, o) => {
        const cx = W / 2 + (o === 0 ? -sep / 2 : sep / 2), cy = H / 2;
        gl.enable(gl.SCISSOR_TEST); gl.scissor(o === 0 ? 0 : W / 2, 0, W / 2, H);
        gl.viewport(Math.round(cx - ew / 2), Math.round(cy - eh / 2), ew, eh); gl.clear(gl.DEPTH_BUFFER_BIT);
        // fondo: la imagen de la cámara, igual en los dos ojos
        gl.useProgram(P.lentes); // reusar un quad texturado: el de lentes con k = 0 hace de copia
        gl.uniform1i(U(P.lentes, "uTex"), 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, camTex);
        gl.uniform2f(U(P.lentes, "uTam"), ew, eh); gl.uniform2f(U(P.lentes, "uK"), 0, 0); gl.uniform2f(U(P.lentes, "uCentro"), ew / 2, eh / 2); gl.uniform1f(U(P.lentes, "uRadio"), ew);
        gl.uniform2f(U(P.lentes, "uMin"), 0, 0); gl.uniform2f(U(P.lentes, "uMax"), ew, eh);
        gl.bindBuffer(gl.ARRAY_BUFFER, quad); const a = A(P.lentes, "aPos"); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 8, 0); gl.enableVertexAttribArray(a);
        gl.disable(gl.DEPTH_TEST); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.enable(gl.DEPTH_TEST);
        const v = datos.vistas[n];
        reproyectada(v.vp, datos.vistas.camaraSbs, camTex);
        cajas(v.cajas.slice(0, v.nSoldados));
        particulas(v.vp, 2.1445 * eh / 2);
        lineas(v.vp, 3.2, 0.1);
        gl.clear(gl.DEPTH_BUFFER_BIT); cajas(v.cajas.slice(v.nSoldados));
        mira(ew / eh);
        ojos.push([o === 0 ? 0 : W / 2, 0, o === 0 ? W / 2 : W, H, cx, cy]);
      });
      gl.disable(gl.SCISSOR_TEST);
      // los lentes (Lentes.java): cada mitad deformada en barril
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(P.lentes); gl.bindTexture(gl.TEXTURE_2D, todo); gl.uniform2f(U(P.lentes, "uTam"), W, H); gl.uniform2f(U(P.lentes, "uK"), 0.22, 0.12);
      gl.enable(gl.SCISSOR_TEST); gl.disable(gl.DEPTH_TEST);
      for (const o of ojos) {
        gl.scissor(o[0], o[1], o[2] - o[0], o[3] - o[1]);
        gl.uniform2f(U(P.lentes, "uCentro"), o[4], o[5]); gl.uniform1f(U(P.lentes, "uRadio"), Math.max(o[4] - o[0], o[2] - o[4]));
        gl.uniform2f(U(P.lentes, "uMin"), o[0], o[1]); gl.uniform2f(U(P.lentes, "uMax"), o[2], o[3]);
        gl.bindBuffer(gl.ARRAY_BUFFER, quad); const a = A(P.lentes, "aPos"); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 8, 0); gl.enableVertexAttribArray(a);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.disable(gl.SCISSOR_TEST);
    } else if (modo === "sellado-antes" || modo === "sellado") {
      gl.viewport(0, 0, W, H); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const v = datos.vistas.pantalla;
      dibujarCamara(v.vp); profundidad(v.vp);
      lineas(v.vp, 2.6, 0.3);
      if (modo === "sellado-antes") sellos(v.vp, datos.sellos.antes, 0.1, 0);
      else sellos(v.vp, datos.sellos.despues, 0, 0.6);
    } else if (modo === "armas") {
      // las cuatro armas, una por cuadro (cada cuadro con la misma proporción de la pantalla)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      datos.vistas.armas.forEach((v, k) => {
        const x = (k % 2) * W / 2, y = (k < 2 ? 1 : 0) * H / 2;
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x, y, W / 2, H / 2); gl.viewport(x, y, W / 2, H / 2); gl.clear(gl.DEPTH_BUFFER_BIT);
        dibujarCamara(v.vp); profundidad(v.vp);
        cajas(v.cajas.slice(0, v.nSoldados));
        discos(v.discos);
        lineas(v.vp, 3.2, 0.1);
        gl.clear(gl.DEPTH_BUFFER_BIT); cajas(v.cajas.slice(v.nSoldados));
        mira(W / H);
      });
      gl.disable(gl.SCISSOR_TEST);
    } else {
      gl.viewport(0, 0, W, H); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const v = datos.vistas.pantalla;
      escena(v, v.vp, null, modo === "escaneo" ? 0.4 : modo === "ia" ? 0.22 : 0.1, modo !== "escaneo", H, modo === "ia");
      if (modo !== "escaneo") mira(W / H);
    }
    return gl.getError();
  }, { datos, sh, modo, W, H });
  await pag.screenshot({ path: `${salida}/vista-${nombre}.png` });
  console.log(`✓ vista-${nombre}.png (error GL ${err})`);
}

// el mapa de la IA visto desde arriba: lo que se vio, y lo que completó
async function fotoMapa() {
  await pag.evaluate(({ datos, W, H }) => {
    let c2 = document.getElementById("c2");
    if (!c2) { c2 = document.createElement("canvas"); c2.id = "c2"; c2.width = W; c2.height = H; c2.style.cssText = "position:absolute;left:0;top:0"; document.body.appendChild(c2); }
    const g = c2.getContext("2d");
    g.fillStyle = "#07030F"; g.fillRect(0, 0, W, H);
    const colores = { S: "#33e680", s: "#40c8f0", C: "#ffd84a", A: "#3080ff", a: "#3080ff", O: "#ff4030", o: "#b0503f", F: "#ff40e0", "?": "#1a1428" };
    const panel = (m, ox, titulo) => {
      const esc = 42, cx = ox + 560, cz = 610;   // 42 px por metro
      g.font = "bold 44px sans-serif"; g.fillStyle = "#fff"; g.fillText(titulo, ox + 60, 80);
      for (let c = 0; c < m.n * m.n; c++) {
        const x = (m.i0 + (c % m.n) + 0.5) * m.celda, z = (m.k0 + Math.floor(c / m.n) + 0.5) * m.celda;
        const sx = cx + x * esc, sy = cz + (z - 1.2) * esc;   // arriba = adonde mira el jugador (−z)
        if (sx < ox + 20 || sx > ox + 1120 || sy < 110 || sy > H - 20) continue;
        g.fillStyle = colores[m.c[c]] || "#000";
        const l = m.celda * esc - 1.5;
        g.fillRect(sx - l / 2, sy - l / 2, l, l);
        if (m.c[c] === "s" || m.c[c] === "o") { g.strokeStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.moveTo(sx - l / 2, sy + l / 2); g.lineTo(sx + l / 2, sy - l / 2); g.stroke(); }
      }
      // el jugador
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo(cx, cz - 16); g.lineTo(cx - 11, cz + 11); g.lineTo(cx + 11, cz + 11); g.fill();
      g.font = "30px sans-serif"; g.fillStyle = "#c9b0ff"; g.fillText("cobertura " + Math.round(m.cobertura * 100) + " %", ox + 60, H - 40);
    };
    panel(datos.mapas.visto, 0, "Lo que se vio");
    panel(datos.mapas.ia, 1170, "+ lo que completó la IA");
    // leyenda
    const ley = [["S", "piso (visto)"], ["s", "piso (supuesto)"], ["C", "cubierta"], ["A", "agua"], ["O", "obstáculo"], ["o", "obstáculo supuesto"], ["F", "falta escanear"]];
    g.font = "26px sans-serif";
    ley.forEach(([k, t], i) => { const x = 1180 + (i % 4) * 280, y = H - 110 + Math.floor(i / 4) * 40; g.fillStyle = colores[k]; g.fillRect(x, y - 20, 26, 26); g.fillStyle = "#ddd"; g.fillText(t, x + 36, y + 2); });
  }, { datos, W, H });
  await pag.screenshot({ path: `${salida}/vista-mapa.png` });
  await pag.evaluate(() => document.getElementById("c2").remove());
  console.log("✓ vista-mapa.png");
}

// la pistola en la mano, dibujada sobre fotos reales de manos (lo que ve la cámara)
async function fotoMano(dirFotos) {
  const partes = [];
  for (const m of datos.manos) for (const fantasma of [1, 0.35]) {
    const archivo = `${dirFotos}/${m.foto}.jpg`;
    const url = "data:image/jpeg;base64," + readFileSync(archivo).toString("base64");
    const esc = 720 / Math.max(m.w, m.h), w = Math.round(m.w * esc), h = Math.round(m.h * esc);
    await pag.setViewportSize({ width: w, height: h });
    await pag.setContent(`<body style="margin:0;background:#000"><canvas id="c" width="${w}" height="${h}"></canvas></body>`);
    await pag.evaluate(async ({ m, url, sh, w, h, fantasma, capsula, capsulaInd, huesosMano }) => {
      const img = new Image(); img.src = url; await img.decode();
      const gl = document.getElementById("c").getContext("webgl", { preserveDrawingBuffer: true, antialias: true, depth: true });
      const derivadas = gl.getExtension("OES_standard_derivatives");
      const prog = (p) => { const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
        const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, p.vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, p.fs)); gl.linkProgram(pr); return pr; };
      const U = (pr, n) => gl.getUniformLocation(pr, n), A = (pr, n) => gl.getAttribLocation(pr, n);
      gl.viewport(0, 0, w, h);
      // la foto de fondo (con el shader de lentes con k = 0: una copia)
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const L = prog(sh.lentes); gl.useProgram(L);
      gl.uniform1i(U(L, "uTex"), 0); gl.uniform2f(U(L, "uTam"), w, h); gl.uniform2f(U(L, "uK"), 0, 0); gl.uniform2f(U(L, "uCentro"), w / 2, h / 2); gl.uniform1f(U(L, "uRadio"), w);
      gl.uniform2f(U(L, "uMin"), 0, 0); gl.uniform2f(U(L, "uMax"), w, h);
      const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      let a = A(L, "aPos"); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 8, 0); gl.enableVertexAttribArray(a);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // la mano fantasma (ManosGl: los mismos shaders y la misma cápsula): primero su profundidad
      const cv = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(capsula), gl.STATIC_DRAW);
      const cix = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cix); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(capsulaInd), gl.STATIC_DRAW);
      const ident = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
      const mano = (P, brillo) => {
        gl.useProgram(P);
        gl.uniformMatrix4fv(U(P, "uVista"), false, ident); gl.uniformMatrix4fv(U(P, "uProy"), false, m.vp);
        gl.bindBuffer(gl.ARRAY_BUFFER, cv); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cix);
        const an = A(P, "aNrm"), al = A(P, "aLado");
        gl.vertexAttribPointer(an, 3, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(an);
        gl.vertexAttribPointer(al, 1, gl.FLOAT, false, 16, 12); gl.enableVertexAttribArray(al);
        for (const [hh, ff, ra, rb] of huesosMano) {
          gl.uniform3fv(U(P, "uA"), m.puntos[hh]); gl.uniform3fv(U(P, "uB"), m.puntos[ff]); gl.uniform2f(U(P, "uR"), ra, rb);
          const punta = ff === 3 || ff === 4 || ff === 7 || ff === 8;
          gl.uniform2f(U(P, "uBr"), punta ? brillo : 0, 1);
          gl.drawElements(gl.TRIANGLES, capsulaInd.length, gl.UNSIGNED_SHORT, 0);
        }
        gl.disableVertexAttribArray(an); gl.disableVertexAttribArray(al);
      };
      // (sin la extensión de derivadas, el vidrio de respaldo: el mismo que usa un teléfono que no la tiene)
      const MP = prog(sh.manoProf), MV = prog(derivadas ? sh.manoVidrio : sh.manoVidrioSin);
      gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(MP); gl.uniform1f(U(MP, "uCorte"), 0.6);
      gl.colorMask(false, false, false, false); mano(MP, 0); gl.colorMask(true, true, true, true);
      // el láser (con el shader de líneas)
      const LIN = prog(sh.linea); gl.useProgram(LIN); gl.uniformMatrix4fv(U(LIN, "uVp"), false, m.vp);
      const v = [];
      v.push(...m.boca, 1, 0.15, 0.1, 0.1, ...m.fin, 1, 0.15, 0.1, 0.9);   // el láser
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
      a = A(LIN, "aPos"); const co = A(LIN, "aCol");
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(co, 4, gl.FLOAT, false, 28, 12); gl.enableVertexAttribArray(co);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.lineWidth(3);
      gl.drawArrays(gl.LINES, 0, v.length / 7); gl.disableVertexAttribArray(co); gl.disable(gl.BLEND);
      // la pistola (las cajas que dibujó Figuras.dibujarPistolaEnMano)
      const C = prog(sh.caja);
      const cubo = []; const caras = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      for (const n of caras) { const u = Math.abs(n[1]) > 0.5 ? [1,0,0] : [0,1,0]; const ww = [n[1]*u[2]-n[2]*u[1], n[2]*u[0]-n[0]*u[2], n[0]*u[1]-n[1]*u[0]];
        const e = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => [0,1,2].map((k) => 0.5*(n[k]+x*u[k]+y*ww[k]))); for (const i of [0,1,2,0,2,3]) cubo.push(...e[i], ...n); }
      const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubo), gl.STATIC_DRAW);
      gl.useProgram(C); a = A(C, "aPos"); const nn = A(C, "aNor");
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(nn, 3, gl.FLOAT, false, 24, 12); gl.enableVertexAttribArray(nn);
      gl.uniform3f(U(C, "uLuz"), 0.37, 0.84, 0.4); gl.enable(gl.DEPTH_TEST);
      for (const k of m.cajas) { gl.uniformMatrix4fv(U(C, "uMvp"), false, k.slice(0, 16)); gl.uniformMatrix4fv(U(C, "uModelo"), false, k.slice(16, 32)); gl.uniform4f(U(C, "uColor"), k[32], k[33], k[34], k[35]); gl.drawArrays(gl.TRIANGLES, 0, 36); }
      gl.disableVertexAttribArray(nn);
      // y encima, el vidrio de la mano (el borde que brilla)
      gl.useProgram(MV);
      gl.uniform1f(U(MV, "uCorte"), -1); gl.uniform3f(U(MV, "uColor"), 0.8, 0.88, 0.96); gl.uniform3f(U(MV, "uBorde"), 0.72, 0.97, 1);
      gl.uniform1f(U(MV, "uOpacidad"), 0.88); gl.uniform1f(U(MV, "uFantasma"), fantasma);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      mano(MV, m.pose === "aprieta" ? 1 : 0);
      gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND);
    }, { m, url, sh, w, h, fantasma, capsula: datos.capsula, capsulaInd: datos.capsulaInd, huesosMano: datos.huesosMano });
    const f = `${salida}/vista-mano-${m.foto}${fantasma < 1 ? "-vidrio" : ""}.png`;
    await pag.screenshot({ path: f });
    partes.push(f);
    console.log(`✓ vista-mano-${m.foto}${fantasma < 1 ? "-vidrio" : ""}.png (${m.pose}, a ${m.dist} m, fantasma ${fantasma})`);
  }
  await pag.setViewportSize({ width: W, height: H });
  await pag.setContent(`<body style="margin:0;background:#000"><canvas id="c" width="${W}" height="${H}"></canvas></body>`);
  return partes;
}

await foto("juego", "juego");
await foto("ia", "ia");
await foto("escaneo", "escaneo");
await foto("sbs", "sbs");
await foto("armas", "armas");
await foto("sellado-antes", "sellado-antes");
await foto("sellado", "sellado");
await fotoMapa();
if (process.argv[4]) await fotoMano(process.argv[4]);
await nav.close();
