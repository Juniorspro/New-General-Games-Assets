
/* ====================== animación del arma en primera persona ======================
   Un clip son pistas con cuadros clave (tiempo en segundos, a la duración nominal; se reproduce estirado a la del juego):
     a:  [t, dx, dy, dz, rx, ry, rz]    el arma: corrimiento en la cámara (m) y giro en grados alrededor del agarre
     pz: {pieza: [[t, dx, dy, dz, rx, ry, rz]…]}   cada pieza en su propio marco, desde su reposo
     mI / mD: [[t, destino, pose, transición]]      a dónde va la mano: 'agarre' / 'apoyo' (su lugar), 'enchufe:mano' (un
              enchufe del arma con esa forma de mano, y si el enchufe se mueve con una pieza la mano la acompaña) o 'fuera'
     ev: [[t, 'son', id] | [t, 'bala'] | [t, 'fin']]
   Las curvas son Catmull-Rom (velocidad continua). Encima van las capas: respiración, inercia al girar, paso, retroceso con
   resorte, aterrizaje y agachado. Entre clips se funde en 0,12 s para que nada salte. */
const VMA = {clip:null, id:'', t:0, vel:1, alFin:null, fundido:0, previo:null, vacio:false, vista:null, bobF:0, respF:0,
  sw:V3(), swV:V3(), sr:V3(), srV:V3(), rp:V3(), rpV:V3(), rr:V3(), rrV:V3(), caida:0, caidaV:0, ag:0, disparos:0, eventosHechos:0};
const _cr = (p0, p1, p2, p3, u)=>{ const u2 = u*u, u3 = u2*u; return 0.5*(2*p1 + (-p0 + p2)*u + (2*p0 - 5*p1 + 4*p2 - p3)*u2 + (-p0 + 3*p1 - 3*p2 + p3)*u3); };
function muestra(pista, t, out){ const n = pista.length, m = pista[0].length - 1;
  if(n === 1 || t <= pista[0][0]){ for(let j=0;j<m;j++) out[j] = pista[0][j+1]; return out; }
  if(t >= pista[n-1][0]){ for(let j=0;j<m;j++) out[j] = pista[n-1][j+1]; return out; }
  let i = 0; while(i < n - 2 && pista[i+1][0] <= t) i++;
  const a = pista[Math.max(0, i-1)], b = pista[i], c = pista[i+1], d = pista[Math.min(n-1, i+2)], u = (t - b[0])/Math.max(1e-4, c[0] - b[0]);
  for(let j=0;j<m;j++) out[j] = _cr(a[j+1], b[j+1], c[j+1], d[j+1], u);
  return out; }
/* ---------- clips por clase ---------- */
const CERO = [0, 0, 0, 0, 0, 0];
function clipsDe(id){
  const A = ARMAS[id] || {}, cl = A.clase, AR = VM.arma, carrera = AR && AR.d.carrera || 0.03;
  const C = {};
  if(cl === 'pistola'){
    C.sacar = {dur:0.8, a:[[0, 0.03, -0.22, 0.06, 38, -8, -28], [0.32, 0, -0.01, 0, -7, 2, 4], [0.5, 0, 0.004, 0, 1.5, 0, -1], [0.8, ...CERO]],
      mI:[[0, 'fuera', 'relajada', 0], [0.22, 'apoyo', 'apoyo', 0.3]], ev:[[0, 'son', 'desenfundar']]};
    C.disparo = {dur:0.2, a:[[0, ...CERO], [0.03, 0, 0.003, 0.022, 4.5, 0.4, 0.8], [0.2, ...CERO]],
      pz:{corredera:[[0, 0, 0, 0, 0, 0, 0], [0.018, 0, 0, carrera, 0, 0, 0], [0.05, 0, 0, carrera, 0, 0, 0], [0.09, 0, 0, 0, 0, 0, 0]]}};
    C.recarga = {dur:2.2, a:[[0, ...CERO], [0.25, -0.02, 0.025, 0.01, 12, 10, -20], [0.95, -0.02, 0.03, 0.01, 14, 10, -22], [1.12, -0.015, 0.036, 0.0, 19, 8, -18],
        [1.25, -0.02, 0.024, 0.01, 10, 7, -15], [1.7, -0.01, 0.02, 0.01, 5, 3, -7], [2.2, ...CERO]],
      pz:{cargador:[[0, 0, 0, 0, 0, 0, 0], [0.28, 0, 0, 0, 0, 0, 0], [0.36, 0, -0.035, 0, 0, 0, 0], [0.55, 0.03, -0.42, 0.06, -30, 0, 25], [0.56, 0, -0.34, 0.02, 10, 0, 0],
        [0.9, 0, -0.07, 0.006, 4, 0, 0], [1.05, 0, -0.012, 0, 0, 0, 0], [1.1, 0, 0, 0, 0, 0, 0]], corredera:[[0, 0, 0, 0, 0, 0, 0]]},
      mI:[[0, 'apoyo', 'apoyo', 0], [0.2, 'fuera', 'relajada', 0.3], [0.58, 'mano_cargador:cargador_i', 'cargador', 0.12], [1.1, 'mano_cargador:cargador_i', 'plana', 0.04], [1.18, 'apoyo', 'apoyo', 0.34]],
      ev:[[0.32, 'son', 'mag_fuera_pistola'], [1.08, 'son', 'mag_dentro_pistola'], [1.1, 'bala'], [1.3, 'son', 'corredera']]};
    C.recargaVacia = Object.assign({}, C.recarga, {nombre:'recargaVacia', pz:Object.assign({}, C.recarga.pz, {corredera:[[0, 0, 0, carrera, 0, 0, 0], [1.14, 0, 0, carrera, 0, 0, 0], [1.19, 0, 0, 0, 0, 0, 0]]}),
      ev:[[0.32, 'son', 'mag_fuera_pistola'], [1.08, 'son', 'mag_dentro_pistola'], [1.1, 'bala'], [1.16, 'son', 'corredera']]});
    C.inspeccionar = {dur:3.4, a:[[0, ...CERO], [0.45, -0.045, 0.035, 0.02, 8, 30, -62], [1.4, -0.045, 0.04, 0.02, 6, 36, -66], [1.85, -0.03, 0.03, 0.02, -4, -14, 42], [2.7, -0.03, 0.032, 0.02, -6, -18, 46], [3.2, ...CERO], [3.4, ...CERO]],
      mI:[[0, 'apoyo', 'apoyo', 0], [0.12, 'fuera', 'relajada', 0.35], [2.85, 'apoyo', 'apoyo', 0.4]]};
  } else if(cl === 'smg'){
    C.sacar = {dur:0.9, a:[[0, 0.03, -0.24, 0.07, 32, -12, -26], [0.36, 0, -0.01, 0, -6, 2, 3], [0.55, 0, 0.004, 0, 1, 0, -1], [0.9, ...CERO]],
      mI:[[0, 'fuera', 'relajada', 0], [0.28, 'apoyo', MANO_EN[VM.apoyo] ? MANO_EN[VM.apoyo].pose : 'guardamano', 0.3]], ev:[[0, 'son', 'desenfundar']]};
    C.disparo = {dur:0.1, a:[[0, ...CERO], [0.02, 0, 0.002, 0.012, 1.5, 0.3, 0.5], [0.1, ...CERO]],
      pz:{cerrojo:[[0, 0, 0, 0, 0, 0, 0], [0.015, 0, 0, carrera*0.8, 0, 0, 0], [0.03, 0, 0, carrera*0.8, 0, 0, 0], [0.06, 0, 0, 0, 0, 0, 0]]}};
    C.recarga = {dur:2.4, a:[[0, ...CERO], [0.3, -0.02, 0.03, 0.01, 10, 10, -18], [1.2, -0.02, 0.035, 0.01, 12, 10, -20], [1.35, -0.015, 0.04, 0.0, 16, 8, -16], [1.5, -0.01, 0.03, 0.01, 8, 5, -10], [1.9, 0, 0.01, 0, 3, 2, -3], [2.4, ...CERO]],
      pz:{cargador:[[0, 0, 0, 0, 0, 0, 0], [0.32, 0, 0, 0, 0, 0, 0], [0.42, 0, -0.05, 0, 0, 0, 0], [0.62, 0.03, -0.5, 0.06, -25, 0, 20], [0.63, 0, -0.42, 0.02, 8, 0, 0],
        [1.05, 0, -0.09, 0.006, 4, 0, 0], [1.25, 0, -0.012, 0, 0, 0, 0], [1.3, 0, 0, 0, 0, 0, 0]], cerrojo:[[1.55, 0, 0, 0, 0, 0, 0], [1.62, 0, 0, carrera, 0, 0, 0], [1.66, 0, 0, carrera, 0, 0, 0], [1.72, 0, 0, 0, 0, 0, 0]]},
      mI:[[0, 'apoyo', MANO_EN[VM.apoyo] ? MANO_EN[VM.apoyo].pose : 'guardamano', 0], [0.22, 'fuera', 'relajada', 0.3], [0.66, 'mano_cargador:cargador_i', 'cargador', 0.12], [1.3, 'mano_cargador:cargador_i', 'plana', 0.04],
        [1.36, 'cerrojo_mano:cerrojo_i', 'pinza', 0.18], [1.74, 'cerrojo_mano:cerrojo_i', 'pinza', 0], [1.8, 'apoyo', MANO_EN[VM.apoyo] ? MANO_EN[VM.apoyo].pose : 'guardamano', 0.35]],
      ev:[[0.36, 'son', 'mag_fuera_pistola'], [1.26, 'son', 'mag_dentro_pistola'], [1.3, 'bala'], [1.6, 'son', 'manipular']]};
  } else if(cl === 'rifle'){
    const ak = id === 'ak47';
    C.sacar = {dur:1.1, a:[[0, 0.04, -0.26, 0.08, 30, -14, -30], [0.36, 0, -0.01, 0, -5, 2, 4], [0.52, 0, 0.004, 0, 1, 0, -1], [1.1, ...CERO]],
      mI:[[0, 'fuera', 'relajada', 0], [0.3, 'cerrojo_mano:cerrojo_i', 'pinza', 0.2], [0.62, 'cerrojo_mano:cerrojo_i', 'pinza', 0], [0.7, 'apoyo', 'guardamano', 0.3]],
      pz:{cerrojo:[[0.52, 0, 0, 0, 0, 0, 0], [0.58, 0, 0, carrera, 0, 0, 0], [0.62, 0, 0, carrera, 0, 0, 0], [0.67, 0, 0, 0, 0, 0, 0]]},
      ev:[[0, 'son', 'desenfundar'], [0.56, 'son', ak ? 'cerrojo_ak' : 'manija_m4']]};
    C.disparo = {dur:0.1, a:[[0, ...CERO], [0.02, 0, 0.002, 0.012, 1.2, 0.2, 0.4], [0.1, ...CERO]],
      pz:ak ? {cerrojo:[[0, 0, 0, 0, 0, 0, 0], [0.015, 0, 0, carrera*0.9, 0, 0, 0], [0.035, 0, 0, carrera*0.9, 0, 0, 0], [0.065, 0, 0, 0, 0, 0, 0]]} : null};
    C.recarga = {dur:2.4, a:[[0, ...CERO], [0.3, 0.01, 0.022, 0.0, 8, -10, 20], [1.4, 0.01, 0.026, 0.0, 10, -12, 22], [1.7, 0, 0.02, 0, 6, -8, 14], [2.4, ...CERO]],
      pz:{cargador:[[0, 0, 0, 0, 0, 0, 0], [0.48, 0, 0, 0, 0, 0, 0], [0.56, 0, -0.008, 0.012, 12, 0, 0], [0.78, 0.02, -0.38, 0.06, 30, 0, 10], [0.79, 0, -0.3, -0.02, 20, 0, 0],
        [1.05, 0, -0.08, -0.012, 14, 0, 0], [1.2, 0, -0.006, 0.002, 8, 0, 0], [1.3, 0, 0, 0, 0, 0, 0]],
        cerrojo:[[1.55, 0, 0, 0, 0, 0, 0], [1.62, 0, 0, carrera, 0, 0, 0], [1.66, 0, 0, carrera, 0, 0, 0], [1.72, 0, 0, 0, 0, 0, 0]]},
      mI:[[0, 'apoyo', 'guardamano', 0], [0.28, 'mano_cargador:cargadorR_i', 'cargador', 0.2], [1.3, 'mano_cargador:cargadorR_i', 'cargador', 0], [1.36, 'cerrojo_mano:cerrojo_i', 'pinza', 0.18],
        [1.74, 'cerrojo_mano:cerrojo_i', 'pinza', 0], [1.8, 'apoyo', 'guardamano', 0.35]],
      ev:[[0.56, 'son', 'mag_fuera_rifle'], [1.22, 'son', 'mag_dentro_rifle'], [1.3, 'bala'], [1.6, 'son', ak ? 'cerrojo_ak' : 'manija_m4']]};
    C.inspeccionar = {dur:4.0, a:[[0, ...CERO], [0.55, -0.05, 0.04, 0.03, 8, 20, 36], [1.7, -0.05, 0.045, 0.03, 10, 22, 38], [2.2, -0.03, 0.03, 0.02, -4, -12, -30], [3.3, -0.03, 0.032, 0.02, -6, -14, -32], [3.85, ...CERO], [4.0, ...CERO]]};
  } else if(cl === 'francotirador'){
    C.sacar = {dur:1.25, a:[[0, 0.04, -0.26, 0.08, 28, -14, -30], [0.42, 0, -0.01, 0, -5, 2, 4], [0.6, 0, 0.004, 0, 1, 0, -1], [1.25, ...CERO]],
      mI:[[0, 'fuera', 'relajada', 0], [0.34, 'apoyo', 'guardamano', 0.3]], ev:[[0, 'son', 'desenfundar']]};
    /* el tiro y el cerrojo: la derecha deja la empuñadura, levanta la manija, tira, empuja, baja y vuelve */
    C.disparo = {dur:1.46, a:[[0, ...CERO], [0.03, 0, 0.007, 0.034, 6, 0.5, 1], [0.26, 0, 0, 0.01, 2, -4, -10], [0.98, 0, 0, 0.01, 2, -4, -10], [1.3, ...CERO], [1.46, ...CERO]],
      pz:{cerrojo:[[0.42, 0, 0, 0, 0, 0, 0], [0.5, 0, 0, 0, 0, 0, 62], [0.62, 0, 0, 0.09, 0, 0, 62], [0.72, 0, 0, 0.09, 0, 0, 62], [0.83, 0, 0, 0, 0, 0, 62], [0.92, 0, 0, 0, 0, 0, 0]]},
      mD:[[0, 'agarre', 'pistola', 0], [0.24, 'cerrojo_mano:cerrojo_d', 'pinza', 0.16], [1.0, 'cerrojo_mano:cerrojo_d', 'pinza', 0], [1.04, 'agarre', 'pistola', 0.26]],
      ev:[[0.5, 'son', 'cerrojo_awp']]};
    C.recarga = {dur:3.6, a:[[0, ...CERO], [0.35, 0.01, 0.03, 0.0, 6, -8, 16], [2.3, 0.01, 0.034, 0.0, 8, -10, 18], [2.6, 0, 0.02, 0, 4, -6, 10], [3.6, ...CERO]],
      pz:{cargador:[[0, 0, 0, 0, 0, 0, 0], [0.62, 0, 0, 0, 0, 0, 0], [0.72, 0, -0.03, 0, 0, 0, 0], [0.95, 0.02, -0.4, 0.04, 20, 0, 10], [0.96, 0, -0.34, 0.0, 6, 0, 0],
        [1.5, 0, -0.07, 0.0, 2, 0, 0], [1.7, 0, -0.008, 0, 0, 0, 0], [1.78, 0, 0, 0, 0, 0, 0]],
        cerrojo:[[2.1, 0, 0, 0, 0, 0, 0], [2.18, 0, 0, 0, 0, 0, 62], [2.3, 0, 0, 0.09, 0, 0, 62], [2.4, 0, 0, 0.09, 0, 0, 62], [2.5, 0, 0, 0, 0, 0, 62], [2.58, 0, 0, 0, 0, 0, 0]]},
      mI:[[0, 'apoyo', 'guardamano', 0], [0.3, 'fuera', 'relajada', 0.3], [0.98, 'mano_cargador:cargador_i', 'cargador', 0.14], [1.78, 'mano_cargador:cargador_i', 'plana', 0.04], [1.86, 'apoyo', 'guardamano', 0.4]],
      mD:[[0, 'agarre', 'pistola', 0], [1.92, 'cerrojo_mano:cerrojo_d', 'pinza', 0.16], [2.62, 'cerrojo_mano:cerrojo_d', 'pinza', 0], [2.66, 'agarre', 'pistola', 0.26]],
      ev:[[0.7, 'son', 'mag_fuera_rifle'], [1.74, 'son', 'mag_dentro_rifle'], [1.8, 'bala'], [2.2, 'son', 'cerrojo_awp']]};
    C.inspeccionar = {dur:4.0, a:[[0, ...CERO], [0.55, -0.05, 0.035, 0.03, 6, 16, 32], [1.8, -0.05, 0.04, 0.03, 8, 18, 34], [2.3, -0.03, 0.03, 0.02, -4, -10, -26], [3.3, -0.03, 0.03, 0.02, -5, -12, -28], [3.85, ...CERO], [4.0, ...CERO]]};
  } else if(cl === 'cuchillo'){
    C.sacar = {dur:0.9, a:[[0, 0.05, -0.2, 0.05, 40, -20, -30], [0.36, 0, 0, 0, -6, 2, 2], [0.55, 0, 0.004, 0, 1, 0, 0], [0.9, ...CERO]], ev:[[0, 'son', 'cuchillo_sacar']]};
    C.ataque1 = {dur:0.5, a:[[0, ...CERO], [0.08, 0.06, 0.03, 0.02, 10, -40, 20], [0.2, -0.16, -0.02, -0.08, -10, 64, -32], [0.5, ...CERO]], ev:[[0.08, 'son', 'cuchillo_tajo'], [0.14, 'golpe']]};
    C.ataque2 = {dur:1.0, a:[[0, ...CERO], [0.22, 0.02, 0.04, 0.06, 25, 10, 0], [0.36, -0.03, 0.0, -0.18, -15, -5, 0], [1.0, ...CERO]], ev:[[0.3, 'son', 'cuchillo_tajo'], [0.36, 'golpe']]};
    C.inspeccionar = {dur:3.0, a:[[0, ...CERO], [0.4, -0.03, 0.05, 0, 0, 30, -62], [1.2, -0.03, 0.05, 0, 0, 30, -70], [1.6, -0.02, 0.04, 0, 0, -20, 80], [2.4, -0.02, 0.04, 0, 0, -25, 86], [3.0, ...CERO]]};
  } else if(cl === 'granada'){
    C.sacar = {dur:0.6, a:[[0, 0.03, -0.2, 0.05, 30, 0, -20], [0.35, 0, 0, 0, -3, 0, 0], [0.6, ...CERO]], ev:[[0, 'son', 'granada_sacar']]};
    C.preparar = {dur:0.6, a:[[0, ...CERO], [0.6, 0.02, 0.05, 0.08, -16, 0, 10]], mI:[[0, 'fuera', 'relajada', 0], [0.04, 'anilla_mano:anilla_i', 'anilla', 0.2], [0.3, 'anilla_mano:anilla_i', 'anilla', 0], [0.32, 'fuera', 'anilla', 0.3]],
      pz:{anilla:[[0.3, 0, 0, 0, 0, 0, 0], [0.55, -0.12, -0.2, 0.06, 0, 0, 0]]}, ev:[[0.28, 'son', 'granada_anilla']]};
    C.lanzar = {dur:0.45, a:[[0, 0.02, 0.05, 0.08, -16, 0, 10], [0.12, 0, 0.1, -0.22, 30, 0, 0], [0.3, 0, -0.3, -0.2, 62, 0, 0], [0.45, 0, -0.34, -0.2, 62, 0, 0]], ev:[[0.12, 'son', 'granada_lanzar'], [0.14, 'soltar']]};
  } else if(cl === 'c4'){
    C.sacar = {dur:0.9, a:[[0, 0, -0.2, 0.05, 50, 0, 0], [0.5, 0, 0, 0, -3, 0, 0], [0.9, ...CERO]], mI:[[0, 'apoyo', 'guardamano', 0]]};
    C.plantar = {dur:3.2, a:[[0, ...CERO], [0.4, 0, -0.1, -0.06, 28, 0, 0], [2.9, 0, -0.1, -0.06, 28, 0, 0], [3.2, 0, -0.14, -0.08, 34, 0, 0]], mI:[[0, 'apoyo', 'guardamano', 0]],
      mD:[[0, 'agarre', 'guardamano', 0], [0.4, 'teclado:teclado_d', 'senalar', 0.2], [2.8, 'teclado:teclado_d', 'senalar', 0], [2.9, 'agarre', 'guardamano', 0.25]],
      ev:[[0.7, 'son', 'c4_tecla'], [1.0, 'son', 'c4_tecla'], [1.3, 'son', 'c4_tecla'], [1.6, 'son', 'c4_tecla'], [1.9, 'son', 'c4_tecla'], [2.2, 'son', 'c4_tecla'], [2.5, 'son', 'c4_tecla']]};
  }
  if(C.recarga && !C.recargaVacia) C.recargaVacia = C.recarga;
  for(const k in C){ const c = C[k]; c.nombre = k; }
  return C;
}
/* dónde está la mano fuera de cuadro (abajo, afuera) */
const FUERA = {I:{p:V3(-0.17, -0.44, -0.24), q:quatDeEjes([0.3, 0.7, -0.6], [-0.6, 0.3, 0.7])}, D:{p:V3(0.22, -0.46, -0.2), q:quatDeEjes([-0.3, 0.7, -0.6], [0.6, 0.3, 0.7])}};
function destinoMano(lado, dest, out){
  const A = VM.arma;
  if(dest !== 'fuera'){
    let enchufe, def;
    if(dest === 'agarre'){ enchufe = 'agarre'; def = VM.agarre; } else if(dest === 'apoyo'){ enchufe = 'apoyo'; def = VM.apoyo; }
    else { const i = dest.indexOf(':'); enchufe = dest.slice(0, i); def = dest.slice(i + 1); }
    if(A && A.e[enchufe] && MANO_EN[def]){ manoEnEnchufe(A, enchufe, MANO_EN[def], out.pos, out.q); out.contacto = true; return out; }
  }
  const f = FUERA[lado]; out.pos.copy(f.p); out.q.copy(f.q); out.contacto = false; return out;
}
/* ---------- reproducir ---------- */
function vmClip(nombre, op){ op = op || {}; const c = VMA.clips && VMA.clips[nombre]; if(!c) return false;
  VMA.previo = VMA.ultimo ? {pos:VMA.ultimo.pos.clone(), q:VMA.ultimo.q.clone(), D:VMA.ultimo.D && {pos:VMA.ultimo.D.pos.clone(), q:VMA.ultimo.D.q.clone()}, I:VMA.ultimo.I && {pos:VMA.ultimo.I.pos.clone(), q:VMA.ultimo.I.q.clone()}} : null;
  VMA.fundido = op.sinFundido || !VMA.previo ? 0 : 0.12; VMA.clip = c; VMA.id = nombre; VMA.t = 0; VMA.hechos = 0; VMA.vel = c.dur/Math.max(0.05, op.dur || c.dur); VMA.alFin = op.alFin || null; VMA.alEvento = op.alEvento || null;
  return true; }
function vmSacar(id){ vmArma(id); VMA.clips = clipsDe(id); VMA.ultimo = null; VMA.vacio = false; vmClip('sacar', {dur:(ARMAS[id] && ARMAS[id].sacar) || 0.8, sinFundido:true}); }
/* retroceso: impulso en los resortes (lo llama el disparo) */
function vmRetroceso(fuerza){ const f = fuerza || 1; VMA.rpV.z += 0.55*f; VMA.rpV.y += 0.06*f; VMA.rrV.x += 70*f; VMA.rrV.y += (Math.random() - 0.5)*18*f; VMA.rrV.z += (Math.random() - 0.5)*24*f; }
function vmAterrizar(v){ VMA.caidaV -= lim(v, 0, 8)*0.09; }
/* resorte amortiguado por componente */
function resorte3(x, v, k, d, dt){ v.x += (-k*x.x - d*v.x)*dt; v.y += (-k*x.y - d*v.y)*dt; v.z += (-k*x.z - d*v.z)*dt; x.x += v.x*dt; x.y += v.y*dt; x.z += v.z*dt; }
const _o = new Array(8).fill(0);
const _dA = {pos:V3(), q:new THREE.Quaternion(), contacto:false}, _dB = {pos:V3(), q:new THREE.Quaternion(), contacto:false};
/* resuelve una pista de mano en t: {pos, q, pose, contacto} */
function manoEnPista(lado, pista, t, defDest, defPose, out){
  if(!pista){ destinoMano(lado, defDest, out); out.pose = POSE_MANO[defPose]; return out; }
  let i = 0; while(i < pista.length - 1 && pista[i+1][0] <= t) i++;
  const cur = pista[i], prev = i > 0 ? pista[i-1] : null, u = cur[3] > 0 && prev ? suave(lim((t - cur[0])/cur[3], 0, 1)) : 1;
  destinoMano(lado, cur[1], _dB);
  if(u < 1 && prev){ destinoMano(lado, prev[1], _dA); out.pos.copy(_dA.pos).lerp(_dB.pos, u); out.q.copy(_dA.q).slerp(_dB.q, u); out.contacto = false; out.pose = poseMezcla(prev[2], cur[2], u); }
  else { out.pos.copy(_dB.pos); out.q.copy(_dB.q); out.contacto = _dB.contacto; out.pose = POSE_MANO[cur[2]] || POSE_MANO.relajada; }
  return out; }
/* ---------- un cuadro ----------
   info: {dt, giroX, giroY (rad/s), vel (m/s horizontal), suelo, agachado} */
function vmCuadro(info){
  const A = VM.arma; if(!A) return; const dt = info.dt || DT, c = VMA.clip;
  /* tiempo del clip y eventos */
  if(c){ VMA.t += dt*VMA.vel;
    if(c.ev) while(VMA.hechos < c.ev.length && c.ev[VMA.hechos][0] <= VMA.t){ const e = c.ev[VMA.hechos++]; if(e[1] === 'son' && window.sonarVM) sonarVM(e[2]); if(VMA.alEvento) VMA.alEvento(e); }
    if(VMA.t >= c.dur){ const fin = VMA.alFin; VMA.clip = null; VMA.id = ''; VMA.alFin = null; if(fin) fin(); } }
  const cc = VMA.clip, t = VMA.t;
  /* capas */
  const sx = lim(-(info.giroY || 0)*0.011, -0.03, 0.03), sy = lim((info.giroX || 0)*0.009, -0.022, 0.022);
  VMA.swV.x += ((sx - VMA.sw.x)*90 - VMA.swV.x*13)*dt; VMA.swV.y += ((sy - VMA.sw.y)*90 - VMA.swV.y*13)*dt; VMA.sw.x += VMA.swV.x*dt; VMA.sw.y += VMA.swV.y*dt;
  const rz = lim((info.giroY || 0)*2.2, -7, 7); VMA.srV.z += ((rz - VMA.sr.z)*70 - VMA.srV.z*12)*dt; VMA.sr.z += VMA.srV.z*dt;
  resorte3(VMA.rp, VMA.rpV, 260, 24, dt); resorte3(VMA.rr, VMA.rrV, 240, 22, dt);
  VMA.caidaV += (-VMA.caida*160 - VMA.caidaV*16)*dt; VMA.caida += VMA.caidaV*dt;
  const vel = info.suelo ? Math.min(1.3, (info.vel || 0)/(250*U)) : 0; VMA.bobA = lerp(VMA.bobA || 0, vel, 1 - Math.exp(-dt*8)); VMA.bobF += dt*(info.vel || 0)*(TAU/1.45);
  VMA.respF += dt*1.3; VMA.ag = lerp(VMA.ag, info.agachado ? 1 : 0, 1 - Math.exp(-dt*9));
  const bx = Math.sin(VMA.bobF)*0.009*VMA.bobA, by = -Math.abs(Math.cos(VMA.bobF))*0.007*VMA.bobA + Math.sin(VMA.respF)*0.0014;
  /* pose del arma */
  const r = VM_REPOSO[VM.id] || VM_REPOSO.ak47; muestra(cc && cc.a ? cc.a : [[0, ...CERO]], t, _o);
  const qR = quatDeGrados(r.r), qOff = quatDeGrados([_o[3] + VMA.rr.x + Math.sin(VMA.respF)*0.25, _o[4] + VMA.rr.y + VMA.sw.x*120, _o[5] + VMA.rr.z + VMA.sr.z + bx*90]);
  const qT = qR.clone().multiply(qOff), piv = A.e.agarre ? A.e.agarre.position : V3();
  const pos = V3(r.p[0] + _o[0] + VMA.sw.x + bx - VMA.ag*0.006, r.p[1] + _o[1] + VMA.sw.y + by + VMA.caida - VMA.rp.y*0 - VMA.ag*0.01, r.p[2] + _o[2] + VMA.rp.z);
  pos.add(piv.clone().applyQuaternion(qR)).sub(piv.clone().applyQuaternion(qT));
  /* fundido desde el cuadro anterior al cambiar de clip */
  let fu = 0; if(VMA.fundido > 0 && VMA.previo){ VMA.fundido = Math.max(0, VMA.fundido - dt); fu = suave(VMA.fundido/0.12); pos.lerp(VMA.previo.pos, fu); qT.slerp(VMA.previo.q, fu); }
  /* piezas: reposo + corrimiento en su propio marco */
  for(const k in A.p){ const o = A.p[k], p0 = A.reposo.pos[k], q0 = A.reposo.rot[k]; let pista = cc && cc.pz && cc.pz[k];
    if(!pista && k === 'corredera' && VMA.vacio && ARMAS[VM.id] && ARMAS[VM.id].clase === 'pistola') pista = [[0, 0, 0, A.d.carrera, 0, 0, 0]];
    if(pista){ muestra(pista, t, _o); o.position.copy(p0).add(_v2.set(_o[0], _o[1], _o[2]).applyQuaternion(q0)); o.quaternion.copy(q0).multiply(quatDeGrados([_o[3], _o[4], _o[5]])); }
    else { o.position.copy(p0); o.quaternion.copy(q0); } }
  const poseArma = {pos, q:qT};
  A.g.position.copy(pos); A.g.quaternion.copy(qT); A.g.updateMatrixWorld(true);
  /* manos */
  const D = manoEnPista('D', cc && cc.mD, t, 'agarre', MANO_EN[VM.agarre].pose, {pos:V3(), q:new THREE.Quaternion()});
  const hayI = !!(cc && cc.mI) || !!VM.apoyo, I = hayI ? manoEnPista('I', cc && cc.mI, t, VM.apoyo ? 'apoyo' : 'fuera', VM.apoyo ? MANO_EN[VM.apoyo].pose : 'relajada', {pos:V3(), q:new THREE.Quaternion()}) : null;
  if(fu > 0){ if(VMA.previo.D){ D.pos.lerp(VMA.previo.D.pos, fu); D.q.slerp(VMA.previo.D.q, fu); D.contacto = false; } if(I && VMA.previo.I){ I.pos.lerp(VMA.previo.I.pos, fu); I.q.slerp(VMA.previo.I.q, fu); I.contacto = false; } }
  vmPoner(poseArma, {libre:true, pos:D.pos, q:D.q, contacto:D.contacto}, I ? {libre:true, pos:I.pos, q:I.q, contacto:I.contacto} : null, D.pose, I ? I.pose : null);
  VMA.ultimo = {pos:pos.clone(), q:qT.clone(), D:{pos:VM.manoD.malla.position.clone(), q:VM.manoD.malla.quaternion.clone()}, I:I ? {pos:VM.manoI.malla.position.clone(), q:VM.manoI.malla.quaternion.clone()} : null};
  vmEfectos(dt);
}
/* ---------- fogonazo y vainas ---------- */
const FX_VM = {fog:null, fogT:0, luz:null, vainas:[], humo:[]};
function texFogonazo(){ const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.translate(64, 64);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.18, 'rgba(255,210,120,0.95)'); gr.addColorStop(0.5, 'rgba(255,140,40,0.35)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
  for(let i=0;i<7;i++){ g.rotate(TAU/7 + Math.random()*0.3); g.beginPath(); g.moveTo(0, -5); g.lineTo(62*(0.6 + Math.random()*0.4), 0); g.lineTo(0, 5); g.closePath(); g.fillStyle = gr; g.fill(); }
  g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.fillStyle = gr; g.fill(); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
function vmFogonazo(){
  const A = VM.arma; if(!A || !A.e.boca) return;
  if(!FX_VM.fog){ const mat = new THREE.MeshBasicMaterial({map:texFogonazo(), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, color:new THREE.Color(3.2, 2.6, 1.8)});
    const g = new THREE.Group(); for(let i=0;i<3;i++){ const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); if(i === 1) m.rotation.y = Math.PI/2; if(i === 2){ m.rotation.x = Math.PI/2; m.scale.setScalar(0.7); } g.add(m); }
    FX_VM.fog = g; FX_VM.luz = new THREE.PointLight(0xffb060, 0, 1.6, 1.6); escVM.add(FX_VM.luz); }
  const ARM = ARMAS[VM.id] || {}, s = ARM.silenciada ? 0.35 : ARM.clase === 'pistola' ? 0.9 : ARM.clase === 'francotirador' ? 1.5 : 1.15;
  if(FX_VM.fog.parent !== A.e.boca) A.e.boca.add(FX_VM.fog);
  FX_VM.fog.visible = true; FX_VM.fog.scale.set(0.07*s, 0.07*s, 0.16*s); FX_VM.fog.position.set(0, 0, -0.04*s); FX_VM.fog.rotation.z = Math.random()*TAU; FX_VM.fogT = 0.045;
  FX_VM.luz.intensity = ARM.silenciada ? 0.6 : 3.5; A.e.boca.getWorldPosition(FX_VM.luz.position); FX_VM.luz.position.applyMatrix4(new THREE.Matrix4().copy(escVM.matrixWorld).invert());
  if(ARM.clase !== 'francotirador') vmVaina();
}
let GEO_VAINA = null, MAT_VAINA = null;
function vmVaina(){
  const A = VM.arma; if(!A || !A.e.eyeccion) return;
  if(!GEO_VAINA){ GEO_VAINA = cilindro(0.0045, 0.019, 8); MAT_VAINA = matArma('bronce'); }
  let v = FX_VM.vainas.find(v=> !v.vivo); if(!v){ if(FX_VM.vainas.length > 10) return; v = {m:new THREE.Mesh(GEO_VAINA, MAT_VAINA), vel:V3(), giro:V3()}; v.m.frustumCulled = false; VM.raiz.add(v.m); FX_VM.vainas.push(v); }
  const ey = A.e.eyeccion; ey.updateMatrixWorld(true); v.m.position.copy(ey.getWorldPosition(V3()).applyMatrix4(new THREE.Matrix4().copy(VM.raiz.matrixWorld).invert()));
  const q = A.g.quaternion; v.vel.set(1.6 + Math.random()*0.6, 1.1 + Math.random()*0.5, 0.3 + Math.random()*0.3).applyQuaternion(q); v.giro.set(Math.random()*20, Math.random()*30, 10 + Math.random()*20);
  v.m.quaternion.copy(q); v.t = 0; v.vivo = true; v.m.visible = true;
}
function vmEfectos(dt){
  if(FX_VM.fog && FX_VM.fog.visible){ FX_VM.fogT -= dt; if(FX_VM.fogT <= 0){ FX_VM.fog.visible = false; } }
  if(FX_VM.luz) FX_VM.luz.intensity *= Math.exp(-dt*40);
  for(const v of FX_VM.vainas){ if(!v.vivo) continue; v.t += dt; v.vel.y -= 9.8*dt; v.m.position.addScaledVector(v.vel, dt); v.m.rotation.x += v.giro.x*dt; v.m.rotation.y += v.giro.y*dt; v.m.rotation.z += v.giro.z*dt;
    if(v.t > 0.7){ v.vivo = false; v.m.visible = false; if(window.sonarVM && Math.random() < 0.7) sonarVM('casquillo_' + (1 + Math.floor(Math.random()*3)), 0.5); } }
}
