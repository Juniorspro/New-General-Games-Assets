"use strict";
// ════════════════════════════════════════════════════════════════════════
// Quién viene en cada vehículo: la verdad (lo que hay que descubrir) y los
// papeles que entrega (que pueden mentir). También dibuja las caras: la foto
// del DNI, la del sistema, la de la ventanilla y la de la cabeza 3D salen de
// los mismos rasgos, así una identidad falsa "se parece pero no es".
// ════════════════════════════════════════════════════════════════════════
const NOMBRES_H = ["RAMÓN ALBERTO", "JUAN CARLOS", "MIGUEL ÁNGEL", "SERGIO DANIEL", "WALTER HUGO", "LUIS ALBERTO", "DIEGO MARTÍN", "MARCELO FABIÁN", "CLAUDIO RAÚL", "RUBÉN DARÍO", "JOSÉ LUIS", "HÉCTOR OMAR", "CRISTIAN JAVIER", "ÁNGEL GABRIEL", "NÉSTOR RAÚL", "FACUNDO EZEQUIEL", "MAXIMILIANO", "JORGE ANTONIO"];
const NOMBRES_M = ["ANA MARÍA", "MARÍA LAURA", "SILVIA BEATRIZ", "GLADYS NOEMÍ", "NORMA BEATRIZ", "ROMINA SOLEDAD", "MARIELA ALEJANDRA", "DANIELA ESTER", "CARINA ELIZABETH", "ROCÍO BELÉN", "MARÍA JOSÉ"];
const APELLIDOS = ["GONZÁLEZ", "RODRÍGUEZ", "FERNÁNDEZ", "LÓPEZ", "BENÍTEZ", "ROMERO", "ACOSTA", "SOSA", "RAMÍREZ", "GÓMEZ", "OJEDA", "DUARTE", "AQUINO", "CARDOZO", "MAIDANA", "ZALAZAR", "ESPÍNOLA", "GIMÉNEZ", "VALLEJOS", "LEIVA", "VILLALBA", "LEDESMA", "ESCOBAR", "FRANCO", "ALEGRE", "SOTELO", "CÁCERES", "BRITEZ"];
const LUGARES = ["Resistencia", "Formosa", "Clorinda", "Presidencia Roca", "Pampa del Indio", "General San Martín", "Castelli", "Sáenz Peña", "Corrientes", "Laguna Blanca", "Villa Ángela", "Reconquista", "Santa Fe", "Makallé", "La Leonesa", "El Colorado", "Pirané"];
// Cada modelo del juego apunta a un modelo 3D de Rezona.
const MODELOS = [
  { nombre: "Toyota Hilux", malla: "pickup", tipo: "camioneta" }, { nombre: "Ford Ranger", malla: "pickup", tipo: "camioneta" },
  { nombre: "Renault 12", malla: "sedan", tipo: "auto" }, { nombre: "Fiat Siena", malla: "compacto", tipo: "auto" }, { nombre: "Chevrolet Prisma", malla: "compacto", tipo: "auto" },
  { nombre: "Fiat Uno", malla: "hatch", tipo: "auto" }, { nombre: "VW Gol", malla: "hatch", tipo: "auto" },
  { nombre: "Mercedes-Benz 1114", malla: "camion", tipo: "camion" }, { nombre: "Honda Wave 110", malla: "moto", tipo: "moto" },
  // El gaucho viene sentado en el modelo (una sola malla); al bajarse se cambia por el cuatri vacío.
  { nombre: "Cuatriciclo 250 cc", malla: "cuatrigaucho", tipo: "cuatri" },
];
const COLORES = [["Blanco", "#f2f2ee"], ["Gris plata", "#a9adb3"], ["Negro", "#222326"], ["Rojo", "#b3261e"], ["Azul", "#2a4f9a"], ["Verde", "#3b6e44"], ["Celeste", "#86b6d8"], ["Bordó", "#6a1522"], ["Beige", "#d8c7a0"]];
const ASEGURADORAS = ["La Segunda", "Sancor Seguros", "Federación Patronal", "Rivadavia Seguros", "La Caja", "Mercantil Andina"];
const CARGAS_CAMPO = ["Un rollo de alambre y el mate", "Sal para la hacienda", "Nada, oficial, voy al campo de un vecino", "Unas bolsas de alimento para los terneros", "El lazo y el poncho, nomás"];
const CARGAS = ["Mercadería para el almacén", "Bolsos con ropa", "Herramientas de trabajo", "Verduras y frutas", "Una garrafa y el auxilio", "Nada, oficial, el auxilio nomás", "Repuestos para el campo", "Cajas de la mudanza"];
const OBJETOS_BAUL = [["Bolso deportivo", "#2d3d6b"], ["Caja de cartón", "#b58b55"], ["Rueda de auxilio", "#1c1c1e"], ["Cajón de verdura", "#7a9a3a"], ["Garrafa", "#3a78c8"], ["Caja de herramientas", "#c0392b"], ["Bolsa de mercadería", "#e8e2d0"], ["Mochila", "#4a4a4a"]];

// ── faltas ──
const FALTAS = {
  sinCinturon: { nombre: "Sin cinturón de seguridad", gravedad: "leve", monto: 60000, puntos: 4 },
  lucesQuemadas: { nombre: "Luces reglamentarias quemadas", gravedad: "leve", monto: 35000, puntos: 2 },
  sinSeguro: { nombre: "Sin seguro obligatorio vigente", gravedad: "leve", monto: 120000, puntos: 2 },
  licenciaVencida: { nombre: "Licencia vencida (menos de 1 año)", gravedad: "leve", monto: 45000, puntos: 2 },
  alcohol: { nombre: "Alcoholemia positiva (más de 0,5 g/l)", gravedad: "grave" },
  licenciaVieja: { nombre: "Licencia vencida hace más de 1 año", gravedad: "grave" },
  sinCedula: { nombre: "Sin cédula del vehículo", gravedad: "grave" },
  sinLicencia: { nombre: "Sin licencia habilitante para ese vehículo", gravedad: "grave" },
  captura: { nombre: "Pedido de captura vigente", gravedad: "delito" },
  drogas: { nombre: "Transporte de estupefacientes", gravedad: "delito" },
  armas: { nombre: "Arma de fuego sin permiso", gravedad: "delito" },
  identidad: { nombre: "Documento de identidad adulterado", gravedad: "delito" },
  robado: { nombre: "Vehículo con pedido de secuestro", gravedad: "delito" },
};
const LEVES = ["sinCinturon", "lucesQuemadas", "sinSeguro", "licenciaVencida"];
function resolucionCorrecta(faltas) {
  let r = "pasar";
  for (const f of faltas) { const g = FALTAS[f].gravedad; if (g === "delito") return "arrestar"; if (g === "grave") r = "retener"; else if (r === "pasar") r = "multar"; }
  return r;
}
const NOMBRE_RESOLUCION = { pasar: "Dejar pasar", multar: "Multar", retener: "Retener vehículo", arrestar: "Arrestar" };

// ════════════════════════════════════════════════════════════════════════
// Rostros
// ════════════════════════════════════════════════════════════════════════
const PIELES = ["#f4cdb0", "#e3b08c", "#c98e66", "#9f6b48", "#7a5036"], PELOS = ["#1b1512", "#3b2717", "#6b4523", "#a8834a", "#8a8a8a", "#d8d6d0"], OJOS = ["#4a2e1a", "#2a1a0e", "#4e7040", "#3d6690"];
function rostroAzar(r, mujer, edad) {
  return {
    mujer, edad, piel: elegir(r, PIELES), pelo: edad > 58 && r() < 0.6 ? elegir(r, PELOS.slice(4)) : elegir(r, PELOS.slice(0, 4)), ojos: elegir(r, OJOS),
    peinado: mujer ? (r() < 0.6 ? 3 : r() < 0.5 ? 4 : 6) : elegir(r, [0, 1, 1, 2, 2, 4, 5]), // el 3 (pelo largo) lo hacía parecer mujer barba: mujer ? 0 : r() < 0.45 ? 0 : 1 + Math.floor(r() * 3),
    anteojos: r() < 0.2, ancho: 0.86 + r() * 0.26, mandibula: 0.8 + r() * 0.4, nariz: 0.8 + r() * 0.5, cejas: 0.6 + r() * 0.8, ropa: `hsl(${Math.floor(r() * 360)},${30 + Math.floor(r() * 40)}%,${30 + Math.floor(r() * 30)}%)`,
  };
}
// Una cara "parecida": cambia algunos rasgos (0 = igual, 1 = otra persona).
function varianteRostro(f, r, k) {
  const v = Object.assign({}, f);
  if (r() < k) v.peinado = f.mujer ? elegir(r, [3, 4, 6].filter((x) => x !== f.peinado)) : elegir(r, [0, 1, 2, 4, 5].filter((x) => x !== f.peinado));
  if (!f.mujer && r() < k) v.barba = (f.barba + 1 + Math.floor(r() * 3)) % 4;
  if (r() < k * 0.6) v.anteojos = !f.anteojos;
  v.ancho = clamp(f.ancho + (r() - 0.5) * k * 0.4, 0.84, 1.14); v.nariz = clamp(f.nariz + (r() - 0.5) * k, 0.8, 1.3); v.mandibula = clamp(f.mandibula + (r() - 0.5) * k * 0.6, 0.8, 1.2);
  if (r() < k * 0.5) v.pelo = elegir(r, PELOS);
  return v;
}
// Dibuja la cara en un canvas 2D. o: { cx, cy, s (alto de cabeza en px), foto, ojosRojos, mx, my (mirada -1..1), parpado 0..1, sudor 0..1, boca: "normal"|"tensa"|"floja"|"habla", abre 0..1 }
function dibujarRostro(g, f, o) {
  const s = o.s, cx = o.cx, cy = o.cy, w = s * 0.36 * f.ancho, hh = s * 0.5;
  g.save();
  // Hombros y camisa.
  g.fillStyle = f.ropa; g.beginPath(); g.moveTo(cx - s * 0.75, cy + s * 1.3); g.quadraticCurveTo(cx - s * 0.72, cy + s * 0.55, cx - s * 0.18, cy + s * 0.5); g.lineTo(cx + s * 0.18, cy + s * 0.5); g.quadraticCurveTo(cx + s * 0.72, cy + s * 0.55, cx + s * 0.75, cy + s * 1.3); g.fill();
  g.fillStyle = "rgba(0,0,0,0.18)"; g.beginPath(); g.moveTo(cx - s * 0.16, cy + s * 0.5); g.lineTo(cx, cy + s * 0.72); g.lineTo(cx + s * 0.16, cy + s * 0.5); g.fill();
  // Cuello.
  g.fillStyle = f.piel; g.fillRect(cx - s * 0.13, cy + s * 0.25, s * 0.26, s * 0.32);
  g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(cx - s * 0.13, cy + s * 0.25, s * 0.26, s * 0.08);
  // Pelo de atrás (largo).
  if (f.peinado === 3 || f.peinado === 6) { g.fillStyle = f.pelo; g.beginPath(); g.ellipse(cx, cy + s * (f.peinado === 3 ? 0.1 : 0), w * 1.22, hh * (f.peinado === 3 ? 1.12 : 0.95), 0, 0, Math.PI * 2); g.fill(); if (f.peinado === 3) g.fillRect(cx - w * 1.2, cy, w * 2.4, s * 0.5); }
  // Orejas.
  g.fillStyle = f.piel; for (const l of [-1, 1]) { g.beginPath(); g.ellipse(cx + l * w * 0.98, cy + s * 0.02, s * 0.06, s * 0.1, 0, 0, Math.PI * 2); g.fill(); }
  // Cabeza con mandíbula.
  const gr = g.createRadialGradient(cx - w * 0.3, cy - hh * 0.4, s * 0.05, cx, cy, s * 0.7); gr.addColorStop(0, aclarar(f.piel, 0.12)); gr.addColorStop(1, aclarar(f.piel, -0.12));
  g.fillStyle = gr; g.beginPath(); g.moveTo(cx - w, cy - hh * 0.2);
  g.bezierCurveTo(cx - w, cy - hh * 1.05, cx + w, cy - hh * 1.05, cx + w, cy - hh * 0.2);
  g.bezierCurveTo(cx + w, cy + hh * 0.45 * f.mandibula, cx + w * 0.45, cy + hh * 0.85, cx, cy + hh * 0.88);
  g.bezierCurveTo(cx - w * 0.45, cy + hh * 0.85, cx - w, cy + hh * 0.45 * f.mandibula, cx - w, cy - hh * 0.2); g.fill();
  // Arrugas con la edad.
  if (f.edad > 50) { g.strokeStyle = "rgba(90,50,30,0.25)"; g.lineWidth = s * 0.008; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(cx - w * 0.45, cy - hh * (0.55 - k * 0.08)); g.quadraticCurveTo(cx, cy - hh * (0.6 - k * 0.08), cx + w * 0.45, cy - hh * (0.55 - k * 0.08)); g.stroke(); } }
  // Barba (abajo del pelo y de la boca).
  if (f.barba >= 2) { g.fillStyle = f.barba === 3 ? f.pelo : hexA(f.pelo, 0.55); g.beginPath(); g.moveTo(cx - w * 0.95, cy + hh * 0.05); g.bezierCurveTo(cx - w * 0.9, cy + hh * (f.barba === 3 ? 1.15 : 0.9), cx + w * 0.9, cy + hh * (f.barba === 3 ? 1.15 : 0.9), cx + w * 0.95, cy + hh * 0.05); g.bezierCurveTo(cx + w * 0.5, cy + hh * 0.35, cx - w * 0.5, cy + hh * 0.35, cx - w * 0.95, cy + hh * 0.05); g.fill(); }
  // Ojos, cejas y párpados.
  const ey = cy - hh * 0.12, mx = (o.mx || 0) * s * 0.02, my = (o.my || 0) * s * 0.015;
  for (const l of [-1, 1]) {
    const ex = cx + l * w * 0.42;
    g.fillStyle = o.ojosRojos ? "#f2b3a8" : "#fbfaf7"; g.beginPath(); g.ellipse(ex, ey, s * 0.07, s * 0.04, 0, 0, Math.PI * 2); g.fill();
    if (o.ojosRojos) { g.strokeStyle = "rgba(200,40,40,0.6)"; g.lineWidth = s * 0.004; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(ex + l * s * 0.07, ey - s * 0.01 + k * s * 0.01); g.lineTo(ex + l * s * 0.03, ey + k * s * 0.005); g.stroke(); } }
    g.fillStyle = f.ojos; g.beginPath(); g.arc(ex + mx, ey + my, s * 0.026, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0c0c0c"; g.beginPath(); g.arc(ex + mx, ey + my, s * 0.012, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(ex + mx - s * 0.008, ey + my - s * 0.009, s * 0.006, 0, Math.PI * 2); g.fill();
    const p = clamp(o.parpado || 0, 0, 1) + (o.ojosRojos ? 0.35 : 0);
    if (p > 0) { g.fillStyle = aclarar(f.piel, -0.05); g.fillRect(ex - s * 0.075, ey - s * 0.045, s * 0.15, s * 0.09 * Math.min(1, p)); }
    g.strokeStyle = aclarar(f.pelo, -0.1); g.lineWidth = s * 0.018 * f.cejas; g.lineCap = "round";
    const tension = o.boca === "tensa" ? 0.012 : 0; g.beginPath(); g.moveTo(ex - s * 0.07, ey - s * 0.07 + (l < 0 ? tension : -tension) * s * 0.2); g.lineTo(ex + s * 0.07, ey - s * (0.078 + (l > 0 ? tension : 0))); g.stroke();
  }
  // Nariz.
  g.strokeStyle = aclarar(f.piel, -0.25); g.lineWidth = s * 0.012; g.beginPath(); g.moveTo(cx, ey + s * 0.02); g.quadraticCurveTo(cx + s * 0.03 * f.nariz, ey + s * 0.14 * f.nariz, cx - s * 0.02, ey + s * 0.16 * f.nariz); g.stroke();
  g.fillStyle = "rgba(60,30,20,0.35)"; for (const l of [-1, 1]) { g.beginPath(); g.arc(cx + l * s * 0.03, ey + s * 0.165 * f.nariz, s * 0.012, 0, Math.PI * 2); g.fill(); }
  // Boca.
  const by = cy + hh * 0.42, abre = o.abre || 0;
  if (f.barba === 1 || f.barba === 3) { g.fillStyle = f.pelo; g.beginPath(); g.ellipse(cx, by - s * 0.045, w * 0.42, s * 0.028, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = "#8a3b35"; g.fillStyle = "#5a1c1a"; g.lineWidth = s * 0.014;
  if (abre > 0.05) { g.beginPath(); g.ellipse(cx, by, w * 0.22, s * 0.025 * abre + s * 0.004, 0, 0, Math.PI * 2); g.fill(); }
  else { g.beginPath(); const c = o.boca === "tensa" ? -0.006 : o.boca === "floja" ? 0.018 : 0.01; g.moveTo(cx - w * 0.26, by); g.quadraticCurveTo(cx, by + s * c * (o.boca === "floja" ? -1 : 1), cx + w * 0.26, by + (o.boca === "floja" ? s * 0.012 : 0)); g.stroke(); }
  // Cachetes colorados (alcohol).
  if (o.ojosRojos) { g.fillStyle = "rgba(220,70,60,0.22)"; for (const l of [-1, 1]) { g.beginPath(); g.ellipse(cx + l * w * 0.6, cy + hh * 0.18, s * 0.08, s * 0.05, 0, 0, Math.PI * 2); g.fill(); } }
  // Pelo de adelante.
  dibujarPelo(g, f, cx, cy, w, hh, s);
  if (!o.foto) dibujarGorro(g, f, cx, cy, w, hh, s); // en la foto del DNI, sin gorro
  if (f.panuelo) { g.fillStyle = "#b3261e"; g.beginPath(); g.moveTo(cx - s * 0.2, cy + s * 0.5); g.lineTo(cx + s * 0.2, cy + s * 0.5); g.lineTo(cx, cy + s * 0.78); g.fill(); g.fillRect(cx - s * 0.16, cy + s * 0.44, s * 0.32, s * 0.08); }
  // Anteojos.
  if (f.anteojos) { g.strokeStyle = "#1a1a1a"; g.lineWidth = s * 0.012; for (const l of [-1, 1]) { g.beginPath(); g.roundRect ? g.roundRect(cx + l * w * 0.42 - s * 0.09, ey - s * 0.06, s * 0.18, s * 0.12, s * 0.03) : g.rect(cx + l * w * 0.42 - s * 0.09, ey - s * 0.06, s * 0.18, s * 0.12); g.stroke(); } g.beginPath(); g.moveTo(cx - w * 0.42 + s * 0.09, ey - s * 0.01); g.lineTo(cx + w * 0.42 - s * 0.09, ey - s * 0.01); g.stroke(); }
  // Transpiración (nervios).
  if (o.sudor > 0.05) { g.fillStyle = `rgba(200,230,255,${0.7 * o.sudor})`; for (const [dx, dy] of [[-0.55, -0.55], [0.6, -0.35], [0.7, 0.05]]) { const x = cx + dx * w, y = cy + dy * hh; g.beginPath(); g.moveTo(x, y - s * 0.03); g.quadraticCurveTo(x + s * 0.018, y + s * 0.01, x, y + s * 0.018); g.quadraticCurveTo(x - s * 0.018, y + s * 0.01, x, y - s * 0.03); g.fill(); } }
  g.restore();
}
function dibujarPelo(g, f, cx, cy, w, hh, s) {
  g.fillStyle = f.pelo;
  const tapa = (alto, baja) => { g.beginPath(); g.moveTo(cx - w * 1.04, cy - hh * baja); g.bezierCurveTo(cx - w * 1.1, cy - hh * (1.05 + alto), cx + w * 1.1, cy - hh * (1.05 + alto), cx + w * 1.04, cy - hh * baja); g.bezierCurveTo(cx + w * 0.7, cy - hh * 0.62, cx - w * 0.7, cy - hh * 0.62, cx - w * 1.04, cy - hh * baja); g.fill(); };
  switch (f.peinado) {
    case 0: g.fillStyle = hexA(f.pelo, 0.25); tapa(0, 0.35); break;
    case 1: tapa(0.08, 0.3); break;
    case 2: tapa(0.12, 0.2); g.beginPath(); g.moveTo(cx - w * 0.2, cy - hh * 1.02); g.quadraticCurveTo(cx + w * 0.5, cy - hh * 0.95, cx + w * 1.05, cy - hh * 0.35); g.lineTo(cx + w * 1.05, cy - hh * 0.6); g.fill(); break;
    case 3: case 6: tapa(0.15, 0.05); if (f.peinado === 6) { g.beginPath(); g.arc(cx + w * 0.2, cy - hh * 1.12, s * 0.1, 0, Math.PI * 2); g.fill(); } break;
    case 4: for (let k = 0; k < 16; k++) { const a = Math.PI * (0.05 + (k / 15) * 0.9); g.beginPath(); g.arc(cx - Math.cos(a) * w * 1.02, cy - hh * 0.25 - Math.sin(a) * hh * 0.82, s * 0.09, 0, Math.PI * 2); g.fill(); } break;
    case 5: g.fillStyle = "#1f3a78"; tapa(0.18, 0.28); g.fillStyle = "#16295a"; g.beginPath(); g.ellipse(cx + w * 0.15, cy - hh * 0.68, w * 0.9, s * 0.04, -0.05, 0, Math.PI * 2); g.fill(); break;
  }
}
// Boina del gaucho, gorra del camionero, gorra plana del señor mayor.
function dibujarGorro(g, f, cx, cy, w, hh, s) {
  if (!f.gorro) return;
  if (f.gorro === "boina") { g.fillStyle = "#15161a"; g.beginPath(); g.ellipse(cx + w * 0.12, cy - hh * 0.78, w * 1.2, hh * 0.34, -0.08, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(cx + w * 0.1, cy - hh * 1.1, s * 0.02, 0, Math.PI * 2); g.fill(); }
  else if (f.gorro === "gorra") { g.fillStyle = "#b3261e"; g.beginPath(); g.ellipse(cx, cy - hh * 0.72, w * 1.05, hh * 0.42, 0, Math.PI, Math.PI * 2); g.fill(); g.fillRect(cx - w * 1.05, cy - hh * 0.74, w * 2.1, hh * 0.1); g.fillStyle = "#8f1d17"; g.beginPath(); g.ellipse(cx, cy - hh * 0.62, w * 0.95, hh * 0.1, 0, 0, Math.PI); g.fill(); }
  else if (f.gorro === "plana") { g.fillStyle = "#3a3b3f"; g.beginPath(); g.moveTo(cx - w * 1.08, cy - hh * 0.55); g.quadraticCurveTo(cx - w * 0.2, cy - hh * 1.25, cx + w * 1.0, cy - hh * 0.8); g.lineTo(cx + w * 1.1, cy - hh * 0.55); g.closePath(); g.fill(); }
}
function aclarar(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  const f = (c) => clamp(Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)), 0, 255);
  return `rgb(${f(r)},${f(gg)},${f(b)})`;
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
// Foto carnet (DNI o sistema): cara de frente sobre fondo celeste.
const FOTOS = new WeakMap();
function fotoCarnet(f, tam = 160) {
  if (FOTOS.has(f)) return FOTOS.get(f);
  const c = document.createElement("canvas"); c.width = tam; c.height = Math.round(tam * 1.25); const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, "#dbe7f1"); gr.addColorStop(1, "#b9cad8"); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  dibujarRostro(g, f, { cx: tam / 2, cy: c.height * 0.42, s: tam * 0.62, foto: true });
  const url = c.toDataURL("image/png"); FOTOS.set(f, url); return url;
}

// ════════════════════════════════════════════════════════════════════════
// Conductores
// ════════════════════════════════════════════════════════════════════════
const nombreAzar = (r, mujer) => elegir(r, APELLIDOS) + ", " + elegir(r, mujer ? NOMBRES_M : NOMBRES_H);
const dniAzar = (r, anio) => clamp((anio - 1940) * 780000, 5000000, 48000000) + Math.floor(r() * 700000);
const dniTexto = (n) => n.toLocaleString("es-AR");
function patenteAzar(r) {
  const L = "ABCDEFGHJKLMNPRSTUVWXYZ", c = () => L[Math.floor(r() * L.length)], n = () => String(100 + Math.floor(r() * 900));
  return r() < 0.5 ? `${c()}${c()}${c()} ${n()}` : `A${c()} ${n()} ${c()}${c()}`;
}
const normalizar = (s) => String(s || "").replace(/[\s.]/g, "").toUpperCase();
function nombreLindo(nombreDni) { const [ap, no] = nombreDni.split(","); return (no ? no.trim().split(" ")[0] + " " : "") + ap.trim().charAt(0) + ap.trim().slice(1).toLowerCase(); }

function crearRegistro() { const personas = new Map(), vehiculos = new Map(); return { personas, vehiculos, persona: (d) => personas.get(normalizar(d)), vehiculo: (p) => vehiculos.get(normalizar(p)), agregarPersona: (p) => personas.set(normalizar(p.dni), p), agregarVehiculo: (v) => vehiculos.set(normalizar(v.patente), v) }; }

// 30 % sospechosos, como pide el diseño. Devuelve el perfil y lo carga en el registro.
function generarConductor(r, registro, dificultad = 1) {
  const modelo = elegir(r, MODELOS), gaucho = modelo.tipo === "cuatri";
  const mujer = !gaucho && r() < 0.28, edad = gaucho ? 30 + Math.floor(r() * 35) : 19 + Math.floor(r() * 52), nac = sumarDias(HOY, -Math.floor(edad * 365.25 + r() * 365));
  const [colorNombre, color] = gaucho ? ["Rojo", "#b3261e"] : elegir(r, COLORES);
  const p = { mujer, edad, nacimiento: nac, rostro: rostroAzar(r, mujer, edad), nombre: nombreAzar(r, mujer), modelo, colorNombre, color, patente: patenteAzar(r) };
  p.dni = dniAzar(r, nac.getFullYear());
  p.origen = elegir(r, LUGARES); do p.destino = elegir(r, LUGARES); while (p.destino === p.origen);
  p.carga = elegir(r, gaucho ? CARGAS_CAMPO : CARGAS);
  // Qué personaje 3D baja del vehículo (la cara 2D sale de los mismos rasgos).
  p.figura = gaucho ? "gaucho" : modelo.tipo === "camion" && !mujer ? "camionero" : mujer ? (edad >= 55 ? "senora" : "conductora") : edad >= 58 ? "mayor" : edad < 30 ? "joven" : "conductor";
  if (gaucho) { p.rostro.gorro = "boina"; p.rostro.barba = 1; p.rostro.peinado = 1; p.rostro.panuelo = true; p.rostro.ropa = "#8fb3d9"; if (r() < 0.6) { p.origen = elegir(r, ["Presidencia Roca", "Pampa del Indio", "El Colorado"]); p.destino = elegir(r, ["un campo sobre la 11", "la estancia de los Benítez", "Presidencia Roca"]); } }
  else if (p.figura === "camionero") { p.rostro.gorro = "gorra"; p.rostro.barba = 2; p.rostro.ropa = "#243a6b"; }
  else if (p.figura === "mayor") { p.rostro.gorro = "plana"; p.rostro.barba = 1; p.rostro.pelo = "#8a8a8a"; p.rostro.ropa = "#8b6a44"; }
  else if (p.figura === "senora") { p.rostro.anteojos = true; p.rostro.pelo = "#8f857c"; p.rostro.peinado = 4; p.rostro.ropa = "#b79acb"; }
  else if (p.figura === "joven") { p.rostro.barba = 2; p.rostro.peinado = 0; p.rostro.ropa = "#2f5a3b"; }
  const cat = modelo.tipo === "moto" ? "A.2.1" : modelo.tipo === "cuatri" ? "A.3" : modelo.tipo === "camion" ? "C.1" : r() < 0.7 ? "B.1" : "B.2";
  p.docs = {
    dni: { numero: p.dni, nombre: p.nombre, nacimiento: nac, rostro: p.rostro },
    licencia: { presente: true, numero: p.dni, nombre: p.nombre, categoria: cat, vence: sumarDias(HOY, 60 + Math.floor(r() * 1500)) },
    cedula: { presente: true, patente: p.patente, titular: r() < 0.8 ? p.nombre : nombreAzar(r, r() < 0.5), modelo: modelo.nombre, color: colorNombre },
    seguro: { presente: true, compania: elegir(r, ASEGURADORAS), poliza: String(100000 + Math.floor(r() * 899999)), vence: sumarDias(HOY, 15 + Math.floor(r() * 300)) },
  };
  // Faltas comunes.
  p.sinCinturon = modelo.tipo !== "moto" && !gaucho && r() < 0.15; p.sinCasco = modelo.tipo === "moto" ? r() < 0.3 : gaucho && r() < 0.55;
  p.lucesQuemadas = r() < 0.12;
  if (r() < 0.1) { if (r() < 0.5) p.docs.seguro.presente = false; else p.docs.seguro.vence = sumarDias(HOY, -10 - Math.floor(r() * 200)); }
  const lic = r(); if (lic < 0.08) p.docs.licencia.vence = sumarDias(HOY, -5 - Math.floor(r() * 300)); else if (lic < 0.13) p.docs.licencia.vence = sumarDias(HOY, -400 - Math.floor(r() * 900));
  if (r() < 0.04) p.docs.licencia.presente = false;
  if (r() < 0.05) p.docs.cedula.presente = false;
  p.alcohol = r() < 0.13 ? 0.6 + r() * 1.8 : r() < 0.2 ? r() * 0.35 : 0;
  // Baúl con lo normal.
  p.baul = []; const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const [nom, col] = elegir(r, OBJETOS_BAUL); p.baul.push({ nombre: nom, color: col, ilegal: false }); }
  // Sospechosos: algunos esconden algo, otros son nerviosos nomás (para que no sea obvio).
  p.sospechoso = r() < 0.3;
  if (p.sospechoso) {
    const q = r();
    if (q < 0.33) identidadFalsa(p, r, registro);
    else if (q < 0.68) {
      const droga = r() < 0.7, cant = droga ? 2 + Math.floor(r() * 5) : 1;
      for (let i = 0; i < cant; i++) p.baul.push({ nombre: droga ? "Paquete rectangular encintado" : "Arma de fuego", color: droga ? "#c9b27a" : "#1a1a1a", ilegal: droga ? "drogas" : "armas", escondido: r() < 0.65 });
      if (r() < 0.4) p.carga = "Nada, nada. Ropa nomás.";
    } else if (q < 0.8) p.captura = true;
    else if (q < 0.9) { p.robado = true; p.docs.cedula.patente = patenteAzar(r); }
  }
  p.estado = p.identidad ? "falso" : p.alcohol > 0.5 ? "borracho" : p.sospechoso ? "nervioso" : "normal";
  registro.agregarPersona({ dni: p.dni, nombre: p.nombre, nacimiento: nac, rostro: p.rostro, captura: !!p.captura, motivo: p.captura ? elegir(r, ["Robo calificado — Juzgado de Garantías de Resistencia", "Abuso de armas — Fiscalía de Sáenz Peña", "Evasión — Juzgado Federal de Formosa", "Homicidio en grado de tentativa — Juzgado de Charata"]) : "", antecedentes: r() < 0.15 ? "Contravención de tránsito (2023)" : "Sin antecedentes" });
  registro.agregarVehiculo({ patente: p.patente, titular: p.docs.cedula.titular, modelo: modelo.nombre, color: colorNombre, robado: !!p.robado });
  return p;
}
// El DNI es de otra persona registrada (otro nombre en el sistema) y la foto se le parece, pero no es.
function identidadFalsa(p, r, registro) {
  p.identidad = true;
  const prestado = { dni: dniAzar(r, p.nacimiento.getFullYear() - 3 + Math.floor(r() * 6)), nombre: nombreAzar(r, p.mujer), nacimiento: sumarDias(p.nacimiento, Math.floor((r() - 0.5) * 1800)), rostro: rostroAzar(r, p.mujer, p.edad), captura: false, antecedentes: "Sin antecedentes", motivo: "" };
  registro.agregarPersona(prestado);
  let alias; do alias = nombreAzar(r, p.mujer); while (alias === prestado.nombre || alias === p.nombre);
  p.alias = alias;
  p.docs.dni = { numero: prestado.dni, nombre: alias, nacimiento: prestado.nacimiento, rostro: varianteRostro(p.rostro, r, 0.45) };
  p.docs.licencia.nombre = alias; p.docs.licencia.numero = prestado.dni;
  if (p.docs.cedula.titular === p.nombre) p.docs.cedula.titular = alias;
  p.captura = r() < 0.5; // muchas veces el que usa un DNI falso es porque lo buscan
}
function faltasReales(p) {
  const f = [], d = p.docs;
  if (p.sinCinturon || p.sinCasco) f.push("sinCinturon");
  if (p.lucesQuemadas) f.push("lucesQuemadas");
  if (!d.seguro.presente || d.seguro.vence < HOY) f.push("sinSeguro");
  const habilita = d.licencia.presente && (p.modelo.tipo === "moto" || p.modelo.tipo === "cuatri" ? d.licencia.categoria.startsWith("A") : p.modelo.tipo === "camion" ? /^[CE]/.test(d.licencia.categoria) : /^[BCDE]/.test(d.licencia.categoria));
  const dias = d.licencia.presente ? diasEntre(d.licencia.vence, HOY) : 0;
  if (!habilita) f.push("sinLicencia"); else if (dias > 365) f.push("licenciaVieja"); else if (dias > 0) f.push("licenciaVencida");
  if (p.alcohol > 0.5) f.push("alcohol");
  if (!d.cedula.presente) f.push("sinCedula");
  if (p.captura) f.push("captura");
  if (p.baul.some((o) => o.ilegal === "drogas")) f.push("drogas");
  if (p.baul.some((o) => o.ilegal === "armas")) f.push("armas");
  if (p.identidad) f.push("identidad");
  if (p.robado) f.push("robado");
  return f;
}

// ── lo que contesta (los sospechosos cambian la historia, al falso se le escapa el nombre) ──
const PREGUNTAS = [["origen", "¿De dónde viene?"], ["destino", "¿A dónde va?"], ["baul", "¿Qué lleva en el baúl?"], ["alcohol", "¿Tomó alcohol?"], ["nombre", "¿Su nombre completo?"], ["motivo", "¿Motivo del viaje?"]];
function responder(p, q, veces, r) {
  const miente = p.estado === "nervioso" || p.estado === "falso", otro = elegir(r, LUGARES.filter((l) => l !== p.origen)), llevaAlgo = p.baul.some((o) => o.ilegal);
  let t;
  switch (q) {
    case "origen": t = !miente ? `Vengo de ${p.origen}, oficial.` : veces === 0 ? `Eh... de ${p.origen}. Bueno, de ${otro} en realidad, pasé por ahí.` : `De ${otro}. Ya le dije, ¿no?`; break;
    case "destino": t = !miente ? `Voy para ${p.destino}, a lo de un pariente.` : veces === 0 ? `A ${p.destino}... a hacer unos trámites. O a lo de mi primo, depende.` : `Para ${otro}, oficial. ¿Por qué pregunta tanto?`; break;
    case "baul": t = llevaAlgo && veces > 0 ? "Nada, nada. ¿Tiene que revisar? Estoy apurado." : p.carga; break;
    case "alcohol": t = p.alcohol > 0.5 ? "No, oficial... bueno, una cervecita en el almuerzo nomás." : miente ? "¿Alcohol? No, no... nada. ¿Me va a hacer soplar?" : "No, oficial. Nada."; break;
    case "nombre":
      if (p.identidad) { const real = p.nombre.split(",")[1].trim().split(" ")[0]; t = veces === 0 ? `${cap(real)}... digo, ${nombreLindo(p.alias)}.` : `${nombreLindo(p.alias)}. Está ahí en el documento.`; }
      else t = `${nombreLindo(p.nombre)}, oficial.`;
      break;
    case "motivo": t = !miente ? elegir(r, ["Trabajo, llevo mercadería.", "Visita familiar.", "Voy al médico en la ciudad.", "Vuelvo del campo."]) : elegir(r, ["Trabajo... bueno, un favor para un amigo.", "Paseo. Nada más. ¿Hay algún problema?", "Tengo que entregar unas cosas... ropa."]); break;
    case "abrir": t = llevaAlgo ? "¿El baúl? Está trabado, oficial... bueno, dele. Ábralo." : "Sí, cómo no. Ahí le abro."; break;
    case "bajar": t = p.estado === "normal" ? "¿Pasó algo, oficial? Bueno, ahí bajo." : p.estado === "borracho" ? "Eshtá bien, eshtá bien..." : "¿Por qué? Yo no hice nada... Bueno."; break;
    case "soplar": t = p.alcohol > 0.5 ? "Fuuuuu... ¿ya está?" : "Fuuuuuuuuu."; break;
    case "multa": t = elegir(r, ["Uh... bueno, está bien. Buenas tardes.", "¿Otra multa? Bueno, qué le vamos a hacer.", "Disculpe, oficial, no se va a repetir."]); break;
    case "pasar": t = elegir(r, ["Gracias, oficial. Buen turno.", "Gracias, que ande bien.", "Buenas tardes, gracias."]); break;
    case "esposas": t = p.estado === "normal" ? "¡Pero oficial, yo no hice nada! ¡Esto es un error!" : p.estado === "borracho" ? "Eshto no puede sher..." : "..."; break;
    default: t = "...";
  }
  return p.estado === "borracho" ? arrastrar(t, r) : t;
}
function cap(s) { s = s.toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
// Voz borrosa: se le traban las eses, estira vocales y se le escapa un hipo.
function arrastrar(s, r) { let o = ""; for (const c of s) { if (c === "s" && r() < 0.5) o += "sh"; else if ("aeiou".includes(c) && r() < 0.16) o += c + c; else o += c; } return o + (r() < 0.5 ? " *hip*" : ""); }
