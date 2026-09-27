
/* ====================== armas por código (medidas reales, en metros) ======================
   Cada arma devuelve {g, p:{piezas}, e:{enchufes}, d:{datos}}. El origen está en el agarre (donde va la mano derecha).
   Piezas: cuerpo (fijo), cargador, corredera / cerrojo / manija (se mueven), gatillo. Enchufes: agarre, apoyo, boca, eyeccion,
   cargador (hueco del cargador), mano_cargador (donde lo toma la mano izquierda), cerrojo (manija), mira. */
function nuevaArma(id){ const g = new THREE.Group(); g.name = id; return {id, g, p:{}, e:{}, d:{}}; }
function pieza(A, nombre, partes, mat, padre, x, y, z){ const o = new THREE.Group(); o.name = nombre; o.position.set(x || 0, y || 0, z || 0); (padre || A.g).add(o);
  for(const [geos, m] of partes) if(geos && geos.length) o.add(piezaDe(geos, m));
  A.p[nombre] = o; return o; }
/* volúmenes de choque para el agarre (los dedos se cierran hasta tocarlos): perfil extruido, caja redondeada o cápsula, en el marco de 'obj' */
function vol(A, obj, v){ v.obj = obj || A.g; (A.vol || (A.vol = [])).push(v); return v; }
function enc(A, nombre, x, y, z, rx, ry, rz, padre){ A.e[nombre] = enchufe(padre || A.g, nombre, x, y, z, rx, ry, rz); return A.e[nombre]; }
/* balas a la vista (arriba del cargador) */
function balas(n, r, largo, x0, y0, dz){ const out = []; for(let i=0;i<n;i++){ const b = torno([[0, 0], [r, 0.002], [r, largo*0.65], [r*0.75, largo*0.85], [r*0.3, largo], [0, largo]], 8); b.rotateX(0); mover(b, x0 + (i % 2 ? r*0.9 : -r*0.9), y0 - i*r*1.6, dz); out.push(b); } return out; }

/* ---------- Glock-18: armazón de polímero, corredera cuadrada con estrías atrás ---------- */
function armaGlock(){
  const A = nuevaArma('glock'), ang = 17.5*GRAD;
  /* armazón: guardapolvo, guardamonte cuadrado y empuñadura inclinada con escalones de dedos */
  const pArm = [[-0.078, -0.004], [0.104, -0.004], [0.104, -0.016], [0.046, -0.016], [0.048, -0.032], [0.044, -0.05], [-0.004, -0.052], [-0.016, -0.044],
    [-0.019, -0.056], [-0.0225, -0.062], [-0.022, -0.068], [-0.0265, -0.078], [-0.029, -0.084], [-0.0285, -0.09], [-0.033, -0.1], [-0.037, -0.109], [-0.042, -0.118],
    [-0.093, -0.118], [-0.09, -0.1], [-0.082, -0.07], [-0.074, -0.045], [-0.07, -0.032], [-0.074, -0.02], [-0.084, -0.012], [-0.086, -0.004]];
  const armazon = extruir(pArm, 0.028, 0.004);
  const hueco = extruir([[0.052, -0.02], [0.054, -0.04], [0.016, -0.042], [0.01, -0.022]], 0.03, 0.001);
  const riel = mover(caja(0.02, 0.004, 0.05), 0, -0.018, -0.075);
  /* textura de agarre en los costados (placas apenas levantadas) */
  const pPlaca = [[-0.022, -0.058], [-0.07, -0.04], [-0.088, -0.108], [-0.04, -0.11]];
  const placaI = mover(extruir(pPlaca, 0.002, 0.0006), 0.0145, 0, 0), placaD = mover(extruir(pPlaca, 0.002, 0.0006), -0.0145, 0, 0);
  pieza(A, 'cuerpo', [[[armazon, riel], 'polimero'], [[placaI, placaD], 'goma']]);
  /* la empuñadura queda inclinada: se gira el armazón entero alrededor del agarre no; se dibujó ya inclinada */
  /* corredera */
  const pCorr = [[-0.08, 0.0], [0.108, 0.0], [0.108, 0.02], [0.103, 0.028], [-0.08, 0.028]], corr = extruir(pCorr, 0.0255, 0.003);
  const puerto = mover(caja(0.004, 0.012, 0.032), 0.012, 0.02, -0.018);
  const estrias = []; for(let i=0;i<7;i++) estrias.push(mover(caja(0.027, 0.018, 0.0016), 0, 0.014, 0.058 + i*0.0034));
  const miraT = mover(extruir([[-0.076, 0.028], [-0.062, 0.028], [-0.064, 0.034], [-0.074, 0.034]], 0.016, 0.001), 0, 0, 0);
  const miraD = mover(caja(0.003, 0.005, 0.005), 0, 0.03, -0.1);
  const canon = mover(cilindro(0.0075, 0.012, 12), 0, 0.014, -0.108);
  const cuerpoCorr = pieza(A, 'corredera', [[[corr, miraT, miraD], 'pavon'], [[puerto, ...estrias, canon], 'negro']]);
  /* cargador: sale para abajo siguiendo la inclinación de la empuñadura */
  const cg = new THREE.Group(); cg.name = 'cargador'; cg.position.set(0, -0.03, 0.041); cg.rotation.x = -ang; A.g.add(cg); A.p.cargador = cg;
  const cuerpoCg = mover(cajaR(0.022, 0.1, 0.03, 0.004), 0, -0.04, 0); const base = mover(cajaR(0.03, 0.012, 0.042, 0.004), 0, -0.094, 0.002);
  cg.add(piezaDe([cuerpoCg], 'negro')); cg.add(piezaDe([base], 'polimero')); cg.add(piezaDe(balas(1, 0.0045, 0.019, 0, 0.012, -0.004).map(b=> girar(b, -Math.PI/2 + 0.2, 0, 0)), 'bronce'));
  const gat = pieza(A, 'gatillo', [[[extruir([[0.006, -0.018], [0.014, -0.018], [0.012, -0.042], [0.007, -0.04]], 0.006, 0.001)], 'negro']]);
  enc(A, 'agarre', 0, -0.07, 0.053, -ang); enc(A, 'boca', 0, 0.014, -0.112); enc(A, 'eyeccion', 0.014, 0.022, -0.018);
  enc(A, 'cargador_pozo', 0, -0.03, 0.041, -ang); enc(A, 'mira', 0, 0.034, 0); enc(A, 'corredera_mano', 0, 0.018, 0.06);
  enc(A, 'mano_cargador', 0, -0.098, 0.002, 0, 0, 0, cg);
  vol(A, null, {t:'perfil', P:pArm, hw:0.014}); vol(A, A.p.corredera, {t:'perfil', P:pCorr, hw:0.0128});
  vol(A, cg, {t:'caja', c:[0, -0.094, 0.002], h:[0.015, 0.006, 0.021], r:0.004}); vol(A, cg, {t:'caja', c:[0, -0.04, 0], h:[0.011, 0.05, 0.015], r:0.004});
  A.d = {carrera:0.024, clase:'pistola', largo:0.19};
  return A;
}
/* ---------- USP-S: más larga, martillo afuera y silenciador ---------- */
function armaUSP(){
  const A = nuevaArma('usps'), ang = 18*GRAD;
  const pArm = [[-0.08, -0.004], [0.11, -0.004], [0.112, -0.018], [0.05, -0.018], [0.052, -0.036], [0.047, -0.054], [-0.004, -0.056], [-0.017, -0.047],
    [-0.021, -0.062], [-0.027, -0.082], [-0.033, -0.1], [-0.038, -0.112], [-0.044, -0.12],
    [-0.095, -0.12], [-0.091, -0.1], [-0.083, -0.07], [-0.075, -0.044], [-0.072, -0.03], [-0.076, -0.018], [-0.088, -0.01], [-0.09, -0.004]];
  const armazon = extruir(pArm, 0.03, 0.004);
  const riel = mover(caja(0.022, 0.005, 0.06), 0, -0.02, -0.08);
  const martillo = mover(extruir([[-0.086, 0.0], [-0.094, 0.012], [-0.1, 0.018], [-0.096, 0.02], [-0.088, 0.012], [-0.082, 0.004]], 0.008, 0.0015), 0, 0, 0);
  pieza(A, 'cuerpo', [[[armazon, riel], 'polimero'], [[martillo], 'metal']]);
  const pCorr = [[-0.084, 0.0], [0.118, 0.0], [0.118, 0.022], [0.108, 0.03], [-0.084, 0.03]], corr = extruir(pCorr, 0.027, 0.004);
  const estrias = []; for(let i=0;i<8;i++) estrias.push(mover(caja(0.0285, 0.02, 0.0014), 0, 0.016, 0.06 + i*0.003));
  const puerto = mover(caja(0.004, 0.012, 0.03), 0.013, 0.021, -0.02);
  const miras = [mover(caja(0.016, 0.006, 0.008), 0, 0.033, 0.076), mover(caja(0.004, 0.006, 0.006), 0, 0.033, -0.108)];
  pieza(A, 'corredera', [[[corr, ...miras], 'pavon'], [[...estrias, puerto], 'negro']]);
  /* silenciador fijo al caño */
  const sil = torno([[0.0, 0.0], [0.0165, 0.0], [0.0175, 0.004], [0.0175, 0.128], [0.016, 0.134], [0.006, 0.134], [0.006, 0.136], [0, 0.136]], 20);
  mover(sil, 0, 0.015, -0.118); const rosca = mover(cilindro(0.009, 0.01, 12), 0, 0.015, -0.112);
  pieza(A, 'silenciador', [[[sil], 'negro'], [[rosca], 'metal']]);
  const cg = new THREE.Group(); cg.name = 'cargador'; cg.position.set(0, -0.032, 0.044); cg.rotation.x = -ang; A.g.add(cg); A.p.cargador = cg;
  cg.add(piezaDe([mover(cajaR(0.023, 0.1, 0.031, 0.004), 0, -0.04, 0)], 'negro')); cg.add(piezaDe([mover(cajaR(0.03, 0.011, 0.04, 0.004), 0, -0.095, 0.002)], 'polimero'));
  pieza(A, 'gatillo', [[[extruir([[0.006, -0.02], [0.014, -0.02], [0.012, -0.046], [0.007, -0.044]], 0.006, 0.001)], 'negro']]);
  enc(A, 'agarre', 0, -0.072, 0.055, -ang); enc(A, 'boca', 0, 0.015, -0.256); enc(A, 'eyeccion', 0.015, 0.023, -0.02);
  enc(A, 'cargador_pozo', 0, -0.032, 0.044, -ang); enc(A, 'mira', 0, 0.036, 0); enc(A, 'corredera_mano', 0, 0.02, 0.064);
  enc(A, 'mano_cargador', 0, -0.1, 0.002, 0, 0, 0, cg);
  vol(A, null, {t:'perfil', P:pArm, hw:0.015}); vol(A, A.p.corredera, {t:'perfil', P:pCorr, hw:0.0135}); vol(A, A.p.silenciador, {t:'cap', a:[0, 0.015, -0.124], b:[0, 0.015, -0.248], r:0.0175});
  vol(A, cg, {t:'caja', c:[0, -0.095, 0.002], h:[0.015, 0.0055, 0.02], r:0.004}); vol(A, cg, {t:'caja', c:[0, -0.04, 0], h:[0.0115, 0.05, 0.0155], r:0.004});
  A.d = {carrera:0.026, clase:'pistola', largo:0.33};
  return A;
}
/* ---------- Desert Eagle: corredera enorme, caño triangular, martillo ---------- */
function armaDeagle(){
  const A = nuevaArma('deagle'), ang = 16*GRAD;
  const pArm = [[-0.095, -0.006], [0.15, -0.006], [0.15, -0.02], [0.06, -0.02], [0.063, -0.04], [0.058, -0.062], [0.0, -0.064], [-0.018, -0.052],
    [-0.021, -0.066], [-0.026, -0.086], [-0.031, -0.104], [-0.036, -0.118], [-0.042, -0.132],
    [-0.1, -0.132], [-0.097, -0.11], [-0.091, -0.08], [-0.086, -0.05], [-0.085, -0.034], [-0.09, -0.024], [-0.1, -0.016], [-0.102, -0.006]];
  const armazon = extruir(pArm, 0.034, 0.004);
  const pCacha = [[-0.024, -0.066], [-0.08, -0.046], [-0.096, -0.124], [-0.042, -0.126]];
  const cachas = [mover(extruir(pCacha, 0.003, 0.001), 0.0165, 0, 0), mover(extruir(pCacha, 0.003, 0.001), -0.0165, 0, 0)];
  const martillo = extruir([[-0.1, 0.004], [-0.11, 0.02], [-0.116, 0.026], [-0.11, 0.028], [-0.1, 0.018], [-0.094, 0.008]], 0.01, 0.002);
  pieza(A, 'cuerpo', [[[armazon], 'acero'], [[...cachas], 'goma'], [[martillo], 'pavon']]);
  /* caño fijo con el lomo triangular y la corredera atrás */
  const pLomo = [[0.03, 0.0], [0.152, 0.0], [0.152, 0.03], [0.146, 0.038], [0.03, 0.038]], lomo = extruir(pLomo, 0.032, 0.004);
  const cresta = mover(extruir([[0.034, 0.038], [0.15, 0.038], [0.15, 0.046], [0.034, 0.046]], 0.01, 0.003), 0, 0, 0);
  const boca = mover(cilindro(0.008, 0.004, 12), 0, 0.02, -0.152);
  const pCorr = [[-0.1, 0.0], [0.03, 0.0], [0.03, 0.038], [-0.1, 0.038]], corr = extruir(pCorr, 0.033, 0.004);
  const estrias = []; for(let i=0;i<8;i++) estrias.push(mover(caja(0.0345, 0.028, 0.0018), 0, 0.02, 0.06 + i*0.0042));
  const mira = [mover(caja(0.018, 0.008, 0.008), 0, 0.042, 0.094), mover(caja(0.005, 0.008, 0.006), 0, 0.05, -0.146)];
  pieza(A, 'canon', [[[lomo, cresta, mira[1]], 'acero'], [[boca], 'negro']]);
  pieza(A, 'corredera', [[[corr, mira[0]], 'acero'], [[...estrias], 'pavon']]);
  const cg = new THREE.Group(); cg.name = 'cargador'; cg.position.set(0, -0.034, 0.051); cg.rotation.x = -ang; A.g.add(cg); A.p.cargador = cg;
  cg.add(piezaDe([mover(cajaR(0.024, 0.1, 0.034, 0.004), 0, -0.044, 0)], 'acero')); cg.add(piezaDe([mover(cajaR(0.032, 0.012, 0.044, 0.004), 0, -0.1, 0.003)], 'negro'));
  pieza(A, 'gatillo', [[[extruir([[0.008, -0.024], [0.016, -0.024], [0.014, -0.052], [0.009, -0.05]], 0.007, 0.001)], 'pavon']]);
  enc(A, 'agarre', 0, -0.078, 0.058, -ang); enc(A, 'boca', 0, 0.02, -0.156); enc(A, 'eyeccion', 0.017, 0.026, -0.0);
  enc(A, 'cargador_pozo', 0, -0.034, 0.051, -ang); enc(A, 'mira', 0, 0.05, 0); enc(A, 'corredera_mano', 0, 0.022, 0.07);
  enc(A, 'mano_cargador', 0, -0.106, 0.003, 0, 0, 0, cg);
  vol(A, null, {t:'perfil', P:pArm, hw:0.0185}); vol(A, A.p.canon, {t:'perfil', P:pLomo, hw:0.016}); vol(A, A.p.corredera, {t:'perfil', P:pCorr, hw:0.0165});
  vol(A, cg, {t:'caja', c:[0, -0.1, 0.003], h:[0.016, 0.006, 0.022], r:0.004}); vol(A, cg, {t:'caja', c:[0, -0.044, 0], h:[0.012, 0.05, 0.017], r:0.004});
  A.d = {carrera:0.028, clase:'pistola', largo:0.27};
  return A;
}
/* ---------- MAC-10: cajón de chapa, cargador en la empuñadura, culata de alambre plegada ---------- */
function armaMac10(){
  const A = nuevaArma('mac10');
  const cajon = cajaR(0.05, 0.062, 0.27, 0.006, 0.003); mover(cajon, 0, 0.03, -0.075);
  const pEmpu = [[-0.028, 0.0], [0.022, 0.0], [0.018, -0.1], [-0.03, -0.1]], empu = extruir(pEmpu, 0.046, 0.005);
  const guarda = extruir([[0.022, -0.002], [0.078, -0.002], [0.078, -0.012], [0.07, -0.038], [0.028, -0.04], [0.026, -0.012]], 0.012, 0.002, 2, [[[0.03, -0.012], [0.066, -0.012], [0.062, -0.032], [0.032, -0.032]]]);
  const pCorrea = [[0.15, 0.0], [0.19, 0.0], [0.19, -0.012], [0.186, -0.022], [0.154, -0.022], [0.15, -0.012]], hCorrea = [[0.156, -0.004], [0.184, -0.004], [0.182, -0.016], [0.158, -0.016]];
  const correa = extruir(pCorrea, 0.03, 0.003, 2, [hCorrea]);
  const rosca = mover(cilindro(0.009, 0.035, 12), 0, 0.034, -0.21);
  const culata = []; for(const x of [-0.026, 0.026]) culata.push(mover(cilindro(0.003, 0.26, 6), x, 0.05, 0.07));
  culata.push(mover(caja(0.056, 0.008, 0.006), 0, 0.05, 0.075)); culata.push(mover(cajaR(0.058, 0.03, 0.012, 0.004), 0, 0.045, -0.19));
  pieza(A, 'cuerpo', [[[cajon, guarda, correa], 'metal'], [[empu], 'polimero'], [[rosca, ...culata], 'pavon']]);
  const manija = pieza(A, 'cerrojo', [[[mover(cilindro(0.006, 0.012, 10), 0, 0.068, 0), mover(caja(0.004, 0.012, 0.004), 0, 0.064, -0.006)], 'negro']], null, 0, 0, -0.14);
  const cg = new THREE.Group(); cg.name = 'cargador'; cg.position.set(0, -0.004, -0.004); A.g.add(cg); A.p.cargador = cg;
  cg.add(piezaDe([mover(cajaR(0.03, 0.2, 0.032, 0.003), 0, -0.1, 0)], 'negro')); cg.add(piezaDe(balas(1, 0.0045, 0.019, 0, 0.004, 0).map(b=> girar(b, -Math.PI/2 + 0.1, 0, 0)), 'bronce'));
  pieza(A, 'gatillo', [[[extruir([[0.042, -0.006], [0.05, -0.006], [0.048, -0.028], [0.043, -0.026]], 0.006, 0.001)], 'negro']]);
  enc(A, 'agarre', 0, -0.052, 0.002); enc(A, 'apoyo', 0, -0.012, -0.17, 0, 0, 0); enc(A, 'boca', 0, 0.034, -0.228); enc(A, 'eyeccion', 0.026, 0.04, -0.05);
  enc(A, 'cargador_pozo', 0, -0.004, -0.004); enc(A, 'mira', 0, 0.075, 0); enc(A, 'cerrojo_mano', 0, 0.07, -0.14);
  enc(A, 'mano_cargador', 0, -0.2, 0, 0, 0, 0, cg);
  vol(A, null, {t:'caja', c:[0, 0.03, -0.075], h:[0.025, 0.031, 0.135], r:0.006}); vol(A, null, {t:'perfil', P:pEmpu, hw:0.023}); vol(A, null, {t:'perfil', P:pCorrea, H:[hCorrea], hw:0.015});
  vol(A, cg, {t:'caja', c:[0, -0.1, 0], h:[0.015, 0.1, 0.016], r:0.003});
  A.d = {carrera:0.07, clase:'smg', largo:0.34};
  return A;
}
/* ---------- MP9: polímero, riel arriba, empuñadura delantera plegable y culata plegada al costado ---------- */
function armaMP9(){
  const A = nuevaArma('mp9');
  const pSup = [[-0.07, 0.0], [0.17, 0.0], [0.176, 0.012], [0.176, 0.046], [0.16, 0.052], [-0.064, 0.052], [-0.074, 0.04]], sup = extruir(pSup, 0.04, 0.005);
  const riel = []; for(let i=0;i<11;i++) riel.push(mover(caja(0.022, 0.006, 0.008), 0, 0.056, 0.05 - i*0.018));
  const pInf = [[-0.034, 0.002], [0.02, 0.002], [0.022, -0.012], [0.07, -0.012], [0.08, -0.04], [0.03, -0.042], [0.018, -0.016], [0.014, -0.1], [-0.036, -0.1], [-0.03, -0.016]], hInf = [[0.03, -0.016], [0.068, -0.016], [0.064, -0.034], [0.034, -0.034]];
  const inf = extruir(pInf, 0.036, 0.005, 2, [hInf]);
  const pDel = [[0.1, -0.0], [0.13, -0.0], [0.124, -0.05], [0.106, -0.05]], delantera = extruir(pDel, 0.022, 0.004);
  const canon = mover(cilindro(0.008, 0.03, 12), 0, 0.026, -0.17);
  const culata = [mover(cajaR(0.012, 0.03, 0.2, 0.004), 0.028, 0.022, -0.02), mover(cajaR(0.012, 0.05, 0.02, 0.004), 0.028, 0.012, 0.082)];
  pieza(A, 'cuerpo', [[[sup, inf, delantera, ...culata], 'polimero'], [[...riel, canon], 'negro']]);
  pieza(A, 'cerrojo', [[[mover(caja(0.05, 0.01, 0.012), 0, 0.03, 0.0), mover(caja(0.012, 0.014, 0.014), 0, 0.03, 0.0)], 'negro']], null, 0, 0, 0.074);
  const cg = new THREE.Group(); cg.name = 'cargador'; cg.position.set(0, -0.004, 0.0); A.g.add(cg); A.p.cargador = cg;
  cg.add(piezaDe([mover(cajaR(0.026, 0.19, 0.03, 0.003), 0, -0.095, 0.004)], 'negro'));
  pieza(A, 'gatillo', [[[extruir([[0.036, -0.014], [0.044, -0.014], [0.042, -0.034], [0.037, -0.032]], 0.006, 0.001)], 'negro']]);
  enc(A, 'agarre', 0, -0.055, 0.008); enc(A, 'apoyo', 0, -0.03, -0.115); enc(A, 'boca', 0, 0.026, -0.2); enc(A, 'eyeccion', 0.022, 0.032, -0.04);
  enc(A, 'cargador_pozo', 0, -0.004, 0.0); enc(A, 'mira', 0, 0.062, 0); enc(A, 'cerrojo_mano', 0, 0.03, 0.08);
  enc(A, 'mano_cargador', 0, -0.19, 0.004, 0, 0, 0, cg);
  vol(A, null, {t:'perfil', P:pSup, hw:0.02}); vol(A, null, {t:'perfil', P:pInf, H:[hInf], hw:0.018}); vol(A, null, {t:'perfil', P:pDel, hw:0.011});
  vol(A, cg, {t:'caja', c:[0, -0.095, 0.004], h:[0.013, 0.095, 0.015], r:0.003});
  A.d = {carrera:0.05, clase:'smg', largo:0.35};
  return A;
}
/* ---------- AK-47: cajón estampado, madera laqueada, cargador curvo, freno de boca oblicuo ---------- */
function armaAK(){
  const A = nuevaArma('ak47');
  /* el cajón: guardapolvo con nervios, trunnion y el costado con el selector */
  const pCajon = [[-0.13, -0.004], [0.13, -0.004], [0.13, 0.034], [0.118, 0.04], [-0.13, 0.04]], cajon = extruir(pCajon, 0.034, 0.003);
  const pTapa = [[-0.13, 0.034], [0.112, 0.034], [0.112, 0.05], [0.104, 0.058], [-0.118, 0.058], [-0.13, 0.05]], tapa = extruir(pTapa, 0.03, 0.007, 3);
  const nervios = []; for(let i=0;i<3;i++) nervios.push(mover(caja(0.024, 0.004, 0.012), 0, 0.058, 0.07 - i*0.035));
  const selector = mover(extruir([[-0.1, 0.006], [0.07, 0.01], [0.072, 0.02], [-0.098, 0.024], [-0.104, 0.016]], 0.003, 0.001), 0.0185, 0, 0);
  const guarda = extruir([[0.0, -0.002], [0.07, -0.002], [0.07, -0.01], [0.062, -0.036], [0.01, -0.036], [0.004, -0.01]], 0.012, 0.002, 2, [[[0.01, -0.01], [0.058, -0.01], [0.054, -0.03], [0.014, -0.03]]]);
  const trunnion = mover(caja(0.034, 0.03, 0.02), 0, 0.02, -0.13);
  const miraT = extruir([[0.098, 0.04], [0.14, 0.04], [0.14, 0.068], [0.132, 0.072], [0.1, 0.05]], 0.022, 0.002);
  const bloqueGas = mover(cajaR(0.022, 0.04, 0.03, 0.006), 0, 0.034, -0.33);
  const tuboGas = mover(cilindro(0.008, 0.12, 12), 0, 0.052, -0.215);
  const miraD = [mover(cajaR(0.02, 0.028, 0.026, 0.004), 0, 0.035, -0.35), mover(caja(0.003, 0.03, 0.003), 0, 0.064, -0.352), mover(caja(0.002, 0.024, 0.008), 0.008, 0.06, -0.352), mover(caja(0.002, 0.024, 0.008), -0.008, 0.06, -0.352)];
  const canon = mover(cilindro(0.0095, 0.26, 14), 0, 0.02, -0.13);
  const freno = torno([[0.0, 0.0], [0.0115, 0.0], [0.0115, 0.028], [0.009, 0.034], [0.004, 0.036], [0, 0.036]], 12); mover(freno, 0, 0.02, -0.39);
  const buloneria = [mover(cilindro(0.0035, 0.036, 8), 0, 0.012, 0.03), mover(cilindro(0.0035, 0.036, 8), 0, 0.012, -0.05)].map(g=> girar(g, 0, Math.PI/2, 0));
  pieza(A, 'cuerpo', [[[cajon, trunnion, guarda, bloqueGas, tuboGas, ...miraD, canon, freno, ...buloneria], 'metal'], [[tapa, ...nervios, miraT, selector], 'pavon']]);
  /* madera: culata, empuñadura, guardamano de abajo y de arriba */
  const culata = extruir([[-0.13, 0.036], [-0.2, 0.03], [-0.49, 0.004], [-0.495, -0.004], [-0.495, -0.118], [-0.486, -0.126], [-0.44, -0.11], [-0.22, -0.034], [-0.16, -0.014], [-0.13, -0.004]], 0.036, 0.008, 3);
  const cantonera = mover(extruir([[-0.495, 0.006], [-0.51, 0.004], [-0.51, -0.12], [-0.495, -0.12]], 0.038, 0.004), 0, 0, 0);
  const pEmpu = [[-0.04, -0.004], [-0.004, -0.004], [-0.014, -0.05], [-0.03, -0.11], [-0.048, -0.118], [-0.07, -0.112], [-0.058, -0.05], [-0.052, -0.004]], empu = extruir(pEmpu, 0.03, 0.006, 3);
  const pGm = [[0.13, -0.004], [0.3, -0.004], [0.3, 0.028], [0.13, 0.03]], gmAbajo = extruir(pGm, 0.044, 0.012, 3);
  const surcos = []; for(let i=0;i<4;i++) surcos.push(mover(caja(0.046, 0.003, 0.016), 0, -0.005, -0.2 - i*0.022));
  const gmArriba = mover(cajaR(0.03, 0.02, 0.17, 0.008), 0, 0.052, -0.215);
  pieza(A, 'madera', [[[culata, empu, gmAbajo, gmArriba], 'madera'], [[cantonera, ...surcos], 'metal']]);
  /* cargador curvo: se arma con tramos inclinados que siguen un arco */
  const cg = new THREE.Group(); cg.name = 'cargador'; cg.position.set(0, 0.0, -0.105); A.g.add(cg); A.p.cargador = cg;
  /* cargador curvo: el frente avanza con el cuadrado de la bajada (7,5 cm al pie en 23 cm), el lomo un poco menos */
  const tramos = [], k = 1.37, seg = 0.026, n = 9, fr = d=> 0.036 + k*d*d, at = d=> -0.034 + k*0.88*d*d;
  for(let i=0;i<n;i++){ const d0 = i*seg, d1 = (i + 1)*seg; tramos.push(extruir([[at(d0), -d0], [fr(d0), -d0], [fr(d1), -d1 - 0.0005], [at(d1), -d1 - 0.0005]], 0.028, 0.003)); }
  const nerviosCg = []; for(let i=0;i<3;i++){ const d = 0.06 + i*0.055; nerviosCg.push(mover(caja(0.03, 0.03, 0.004), 0, -d, -(fr(d) + at(d))/2)); }
  const dPie = n*seg, pie = mover(cajaR(0.03, 0.008, 0.066, 0.003), 0, -dPie - 0.003, -(fr(dPie) + at(dPie))/2);
  cg.add(piezaDe([...tramos, ...nerviosCg, pie], 'metal'));
  cg.add(piezaDe(balas(2, 0.0055, 0.03, 0, 0.004, 0.0).map(b=> girar(b, -Math.PI/2, 0, 0)), 'bronce'));
  /* manija del cerrojo (lado derecho), corre 12 cm */
  pieza(A, 'cerrojo', [[[mover(caja(0.018, 0.008, 0.012), 0.024, 0.03, 0), mover(cilindro(0.006, 0.016, 10), 0.032, 0.03, 0.008).rotateY(Math.PI/2)], 'metal']], null, 0, 0, -0.09);
  pieza(A, 'gatillo', [[[extruir([[0.02, -0.006], [0.028, -0.006], [0.026, -0.03], [0.021, -0.028]], 0.006, 0.001)], 'metal']]);
  enc(A, 'agarre', 0, -0.055, 0.03, -0.3); enc(A, 'apoyo', 0, -0.004, -0.225); enc(A, 'boca', 0, 0.02, -0.43); enc(A, 'eyeccion', 0.018, 0.036, -0.03);
  enc(A, 'cargador_pozo', 0, 0.0, -0.105); enc(A, 'mano_cargador', 0, -0.12, -0.04, 0, 0, 0, cg); enc(A, 'mira', 0, 0.075, -0.1); enc(A, 'cerrojo_mano', 0.034, 0.03, -0.09);
  vol(A, null, {t:'perfil', P:pCajon, hw:0.017}); vol(A, null, {t:'perfil', P:pTapa, hw:0.015}); vol(A, null, {t:'perfil', P:pEmpu, hw:0.015}); vol(A, null, {t:'perfil', P:pGm, hw:0.022});
  vol(A, null, {t:'caja', c:[0, 0.052, -0.215], h:[0.015, 0.01, 0.085], r:0.008}); vol(A, null, {t:'cap', a:[0, 0.02, -0.3], b:[0, 0.02, -0.39], r:0.0095});
  { const P = []; for(let i=0;i<=n;i++) P.push([fr(i*seg), -i*seg]); for(let i=n;i>=0;i--) P.push([at(i*seg), -i*seg]); vol(A, cg, {t:'perfil', P, hw:0.014}); }
  A.d = {carrera:0.12, clase:'rifle', largo:0.9};
  return A;
}
/* ---------- M4A1-S: cajón superior con riel, culata telescópica, guardamano redondo y silenciador largo ---------- */
function armaM4(){
  const A = nuevaArma('m4s');
  const pSup = [[-0.1, 0.0], [0.13, 0.0], [0.13, 0.036], [-0.1, 0.036]], sup = extruir(pSup, 0.03, 0.003);
  const riel = []; for(let i=0;i<13;i++) riel.push(mover(caja(0.022, 0.007, 0.01), 0, 0.04, 0.09 - i*0.017));
  const base = mover(caja(0.018, 0.004, 0.23), 0, 0.037, -0.015);
  const pInf = [[-0.08, 0.0], [0.09, 0.0], [0.09, -0.052], [0.03, -0.054], [0.028, -0.024], [0.004, -0.02], [-0.07, -0.02], [-0.084, -0.008]], inf = extruir(pInf, 0.028, 0.004);
  const guarda = extruir([[0.0, -0.018], [0.03, -0.018], [0.028, -0.042], [-0.024, -0.042], [-0.026, -0.024]], 0.01, 0.002, 2, [[[-0.02, -0.024], [0.024, -0.024], [0.022, -0.036], [-0.018, -0.036]]]);
  const pEmpu = [[-0.02, -0.018], [-0.052, -0.018], [-0.074, -0.104], [-0.058, -0.112], [-0.034, -0.1], [-0.016, -0.03]], empu = extruir(pEmpu, 0.028, 0.006, 3);
  const tubo = mover(cilindro(0.0145, 0.2, 14), 0, 0.018, 0.1).rotateY(0);
  const culata = extruir([[0.2, 0.034], [0.34, 0.03], [0.345, -0.08], [0.33, -0.086], [0.3, -0.03], [0.21, -0.004]], 0.036, 0.006, 3);
  const guardamano = mover(cilindro(0.021, 0.19, 16), 0, 0.018, -0.13);
  const rielesGm = []; for(let i=0;i<7;i++) for(const [x, y] of [[0, 0.041], [0.023, 0.018], [-0.023, 0.018], [0, -0.005]]) rielesGm.push(mover(caja(x ? 0.006 : 0.014, x ? 0.012 : 0.005, 0.01), x, y, -0.15 - i*0.022));
  const canon = mover(cilindro(0.008, 0.06, 12), 0, 0.018, -0.32);
  const sil = torno([[0, 0], [0.017, 0], [0.018, 0.004], [0.018, 0.19], [0.016, 0.196], [0.007, 0.196], [0, 0.197]], 20); mover(sil, 0, 0.018, -0.38);
  const miraT = mover(extruir([[-0.09, 0.045], [-0.07, 0.045], [-0.072, 0.056], [-0.086, 0.056]], 0.016, 0.002), 0, 0, 0);
  const miraD = mover(extruir([[0.24, 0.04], [0.28, 0.04], [0.278, 0.062], [0.262, 0.064]], 0.012, 0.002), 0, 0, 0);
  const asist = mover(cilindro(0.005, 0.02, 8), 0.02, 0.022, -0.06);
  pieza(A, 'cuerpo', [[[sup, base, inf, guarda, asist], 'metal'], [[...riel, ...rielesGm, miraT, miraD], 'pavon'], [[empu, culata], 'polimero'], [[tubo, guardamano, canon, sil], 'negro']]);
  pieza(A, 'cerrojo', [[[mover(caja(0.04, 0.008, 0.014), 0, 0.03, 0), mover(caja(0.012, 0.01, 0.02), 0, 0.03, -0.008)], 'metal']], null, 0, 0, 0.104);
  const cg = new THREE.Group(); cg.name = 'cargador'; cg.position.set(0, -0.005, -0.05); A.g.add(cg); A.p.cargador = cg;
  const tramos = []; for(let i=0;i<6;i++) tramos.push(extruir([[-0.028 + i*0.004, -i*0.026], [0.024 + i*0.004, -i*0.026], [0.028 + i*0.004, -(i + 1)*0.026 - 0.0005], [-0.024 + i*0.004, -(i + 1)*0.026 - 0.0005]], 0.024, 0.002));
  cg.add(piezaDe([...tramos, mover(cajaR(0.028, 0.008, 0.058, 0.003), 0, -0.158, -0.012)], 'metal'));
  cg.add(piezaDe(balas(2, 0.0048, 0.028, 0, 0.004, 0).map(b=> girar(b, -Math.PI/2, 0, 0)), 'bronce'));
  pieza(A, 'gatillo', [[[extruir([[0.0, -0.02], [0.007, -0.02], [0.005, -0.036], [0.001, -0.034]], 0.006, 0.001)], 'metal']]);
  enc(A, 'agarre', 0, -0.06, 0.042, -0.36); enc(A, 'apoyo', 0, -0.006, -0.17); enc(A, 'boca', 0, 0.018, -0.58); enc(A, 'eyeccion', 0.016, 0.022, -0.02);
  enc(A, 'cargador_pozo', 0, -0.005, -0.05); enc(A, 'mano_cargador', 0, -0.095, -0.01, 0, 0, 0, cg); enc(A, 'mira', 0, 0.06, 0); enc(A, 'cerrojo_mano', 0, 0.034, 0.12);
  vol(A, null, {t:'perfil', P:pSup, hw:0.015}); vol(A, null, {t:'perfil', P:pInf, hw:0.014}); vol(A, null, {t:'perfil', P:pEmpu, hw:0.014});
  vol(A, null, {t:'cap', a:[0, 0.018, -0.042], b:[0, 0.018, -0.218], r:0.0225}); vol(A, null, {t:'cap', a:[0, 0.018, -0.39], b:[0, 0.018, -0.57], r:0.018});
  vol(A, cg, {t:'perfil', P:[[-0.028, 0], [0.024, 0], [0.048, -0.156], [-0.004, -0.156]], hw:0.012}); vol(A, cg, {t:'caja', c:[0, -0.158, -0.012], h:[0.014, 0.004, 0.029], r:0.003});
  A.d = {carrera:0.07, clase:'rifle', largo:0.9};
  return A;
}
/* ---------- AWP: culata verde de agujero para el pulgar, caño pesado, mira grande y cerrojo ---------- */
function armaAWP(){
  const A = nuevaArma('awp');
  const pCh = [[0.3, 0.014], [0.3, -0.03], [0.06, -0.036], [0.05, -0.05], [0.0, -0.052], [-0.02, -0.03], [-0.03, -0.12], [-0.05, -0.13], [-0.1, -0.12], [-0.12, -0.05], [-0.2, -0.05],
    [-0.46, -0.13], [-0.56, -0.13], [-0.56, 0.02], [-0.5, 0.04], [-0.32, 0.036], [-0.2, 0.01], [-0.14, 0.012], [-0.12, 0.02], [0.3, 0.02]];
  const hCh = [[[-0.14, -0.035], [-0.21, -0.035], [-0.42, -0.1], [-0.36, -0.03]], [[-0.022, -0.04], [-0.1, -0.04], [-0.11, -0.1], [-0.05, -0.11]]];
  const chasis = extruir(pCh, 0.05, 0.008, 3, hCh);
  const cantonera = mover(caja(0.052, 0.15, 0.02), 0, -0.055, 0.565);
  const cajon = mover(cilindro(0.018, 0.22, 16), 0, 0.03, 0.12);
  const canon = torno([[0, 0], [0.015, 0], [0.013, 0.12], [0.011, 0.52], [0, 0.52]], 16); mover(canon, 0, 0.03, -0.1);
  const freno = torno([[0, 0], [0.017, 0], [0.017, 0.07], [0, 0.07]], 12); mover(freno, 0, 0.03, -0.62);
  const ranuras = []; for(let i=0;i<3;i++) ranuras.push(mover(caja(0.036, 0.006, 0.01), 0, 0.03, -0.635 - i*0.02));
  const aros = [mover(cajaR(0.012, 0.05, 0.02, 0.004), 0, 0.058, 0.07), mover(cajaR(0.012, 0.05, 0.02, 0.004), 0, 0.058, -0.06)];
  const tuboMira = mover(cilindro(0.0155, 0.24, 18), 0, 0.085, 0.13);
  const objetivo = torno([[0.0155, 0], [0.028, 0.05], [0.029, 0.1], [0.026, 0.104], [0, 0.104]], 20); mover(objetivo, 0, 0.085, -0.11);
  const ocular = torno([[0, 0], [0.022, 0], [0.022, 0.05], [0.0155, 0.07]], 18); mover(ocular, 0, 0.085, 0.2); girar(ocular, 0, 0, 0);
  const torretas = [mover(cilindro(0.011, 0.024, 12).rotateX(Math.PI/2), 0, 0.105, 0.0), mover(cilindro(0.011, 0.024, 12).rotateZ(Math.PI/2).rotateY(0), 0.024, 0.085, 0.0)];
  const lentes = [mover(cilindro(0.026, 0.002, 18), 0, 0.085, -0.212), mover(cilindro(0.019, 0.002, 18), 0, 0.085, 0.25)];
  pieza(A, 'cuerpo', [[[chasis], 'verde'], [[cantonera], 'goma'], [[cajon, canon, freno, ...ranuras, ...aros], 'metal'], [[tuboMira, objetivo, ocular, ...torretas], 'negro'], [[...lentes], 'lente']]);
  /* cerrojo: la manija gira sobre el eje del cajón y después corre para atrás */
  const cerr = new THREE.Group(); cerr.name = 'cerrojo'; cerr.position.set(0, 0.03, 0.15); A.g.add(cerr); A.p.cerrojo = cerr;
  cerr.add(piezaDe([mover(cilindro(0.004, 0.05, 8).rotateZ(Math.PI/2).rotateY(0), 0.045, -0.012, 0).rotateZ(0), mover(new THREE.SphereGeometry(0.011, 10, 8), 0.072, -0.022, 0)], 'metal'));
  const cg = new THREE.Group(); cg.name = 'cargador'; cg.position.set(0, -0.01, -0.02); A.g.add(cg); A.p.cargador = cg;
  cg.add(piezaDe([mover(cajaR(0.034, 0.05, 0.1, 0.004), 0, -0.03, 0)], 'negro'));
  pieza(A, 'gatillo', [[[extruir([[-0.02, -0.04], [-0.013, -0.04], [-0.015, -0.06], [-0.019, -0.058]], 0.006, 0.001)], 'metal']]);
  enc(A, 'agarre', 0, -0.075, 0.075, -0.25); enc(A, 'apoyo', 0, -0.014, -0.2); enc(A, 'boca', 0, 0.03, -0.69); enc(A, 'eyeccion', 0.02, 0.04, 0.12);
  enc(A, 'cargador_pozo', 0, -0.01, -0.02); enc(A, 'mira', 0, 0.085, 0.22); enc(A, 'cerrojo_mano', 0.072, 0.008, 0.15);
  enc(A, 'mano_cargador', 0, -0.055, 0, 0, 0, 0, cg);
  vol(A, null, {t:'perfil', P:pCh, H:hCh, hw:0.025}); vol(A, null, {t:'cap', a:[0, 0.03, 0.01], b:[0, 0.03, 0.23], r:0.018}); vol(A, null, {t:'cap', a:[0, 0.03, -0.1], b:[0, 0.03, -0.62], r:0.014});
  vol(A, null, {t:'cap', a:[0, 0.085, 0.01], b:[0, 0.085, 0.25], r:0.0165}); vol(A, null, {t:'cap', a:[0, 0.085, -0.13], b:[0, 0.085, -0.2], r:0.028});
  vol(A, cg, {t:'caja', c:[0, -0.03, 0], h:[0.017, 0.025, 0.05], r:0.004});
  A.d = {carrera:0.09, clase:'francotirador', largo:1.22};
  return A;
}
/* ---------- cuchillos: CT táctico negro con punta tanto; T tipo bowie de hoja clara ---------- */
function armaCuchillo(equipo){
  const A = nuevaArma('cuchillo'), ct = equipo === 'ct';
  const hoja = ct ? extruir([[0.0, 0.0], [0.15, 0.004], [0.172, 0.014], [0.166, 0.03], [0.02, 0.03], [0.0, 0.024]], 0.005, 0.0018, 2)
                  : extruir([[0.0, 0.0], [0.14, -0.002], [0.18, 0.012], [0.15, 0.024], [0.12, 0.022], [0.02, 0.032], [0.0, 0.028]], 0.005, 0.0018, 2);
  const filo = ct ? mover(extruir([[0.02, 0.0], [0.15, 0.004], [0.16, 0.008], [0.02, 0.006]], 0.0056, 0.0006), 0, 0, 0) : mover(extruir([[0.02, 0.0], [0.14, -0.002], [0.17, 0.008], [0.02, 0.006]], 0.0056, 0.0006), 0, 0, 0);
  const guarda = mover(cajaR(0.018, 0.05, 0.01, 0.003), 0, 0.014, 0.002);
  const pMango = [[0.0, 0.004], [-0.11, 0.0], [-0.12, 0.006], [-0.122, 0.024], [-0.11, 0.032], [0.0, 0.028]], mango = extruir(pMango, 0.024, 0.006, 3);
  const pomo = mover(cajaR(0.026, 0.034, 0.012, 0.004), 0, 0.016, 0.122);
  const anillos = []; for(let i=0;i<5;i++) anillos.push(mover(caja(0.026, 0.034, 0.003), 0, 0.016, 0.02 + i*0.018));
  pieza(A, 'cuerpo', [[[hoja], ct ? 'hojaNegra' : 'hoja'], [[filo], 'hoja'], [[guarda, pomo], 'metal'], [[mango], ct ? 'goma' : 'negro'], [[...anillos], 'polimero']]);
  A.g.children.forEach(o=> o.position.set(0, 0, 0));
  enc(A, 'agarre', 0, 0.016, 0.06, 0); enc(A, 'boca', 0, 0.016, -0.17);
  vol(A, null, {t:'perfil', P:pMango, hw:0.012}); vol(A, null, {t:'caja', c:[0, 0.014, 0.002], h:[0.009, 0.025, 0.005], r:0.003}); vol(A, null, {t:'caja', c:[0, 0.016, 0.122], h:[0.013, 0.017, 0.006], r:0.004});
  A.d = {clase:'cuchillo', largo:0.3};
  return A;
}
/* ---------- granadas ---------- */
function armaGranada(tipo){
  const A = nuevaArma(tipo);
  let cuerpo, mat = 'oliva';
  if(tipo === 'he'){ cuerpo = [new THREE.SphereGeometry(0.032, 18, 14), mover(cilindro(0.012, 0.02, 12).rotateX(Math.PI/2), 0, 0.034, 0)]; }
  else if(tipo === 'flash'){ cuerpo = [mover(cilindro(0.021, 0.1, 16).rotateX(-Math.PI/2), 0, 0.05, 0)]; mat = 'metal';
    for(let i=0;i<6;i++) for(let k=0;k<2;k++){ const a = i/6*TAU; cuerpo.push(mover(cilindro(0.005, 0.004, 8).rotateZ(Math.PI/2).rotateY(a), Math.cos(a)*0.021, -0.03 + k*0.05, Math.sin(a)*0.021)); } }
  else { cuerpo = [mover(cilindro(0.024, 0.12, 16).rotateX(-Math.PI/2), 0, 0.06, 0)]; mat = 'gris'; }
  /* cabeza de la espoleta arriba del cuerpo y la cuchara pegada al costado de adelante */
  const tope = tipo === 'he' ? 0.03 : tipo === 'flash' ? 0.05 : 0.06, radio = tipo === 'he' ? 0.02 : tipo === 'flash' ? 0.021 : 0.024;
  const cabeza = mover(cilindro(0.012, 0.02, 12).rotateX(-Math.PI/2), 0, tope + 0.018, 0);
  const cuchara = extruir([[0.0, 0.0], [0.008, 0.002], [radio + 0.004, -0.012], [radio + 0.004, -0.07], [radio - 0.001, -0.075], [radio - 0.002, -0.014], [0.0, -0.004]], 0.014, 0.0015); mover(cuchara, 0, tope + 0.012, 0);
  pieza(A, 'cuerpo', [[cuerpo, mat === 'gris' ? 'metal' : mat], [[cabeza, cuchara], 'metal']]);
  const anilla = pieza(A, 'anilla', [[[mover(new THREE.TorusGeometry(0.011, 0.0016, 6, 16), 0.016, tope + 0.01, 0)], 'metal']]);
  enc(A, 'agarre', 0, -0.0, 0.0); enc(A, 'anilla_mano', 0.016, tope + 0.01, 0);
  if(tipo === 'he') vol(A, null, {t:'cap', a:[0, 0, 0], b:[0, 0.0, 0], r:0.032}); else vol(A, null, {t:'cap', a:[0, -tope + radio*0.5, 0], b:[0, tope - radio*0.5, 0], r:radio});
  vol(A, null, {t:'cap', a:[0, tope, 0], b:[0, tope + 0.018, 0], r:0.012});
  A.d = {clase:'granada', largo:0.12};
  return A;
}
/* ---------- C4: panes de explosivo con cinta, teclado y pantalla ---------- */
function armaC4(){
  const A = nuevaArma('c4');
  const panes = [mover(cajaR(0.075, 0.05, 0.16, 0.008), -0.04, 0, 0), mover(cajaR(0.075, 0.05, 0.16, 0.008), 0.04, 0, 0)];
  const cinta = [mover(caja(0.162, 0.053, 0.02), 0, 0, -0.05), mover(caja(0.162, 0.053, 0.02), 0, 0, 0.05)];
  const caja_ = mover(cajaR(0.1, 0.018, 0.09, 0.004), 0, 0.034, 0.0);
  const teclas = []; for(let i=0;i<4;i++) for(let j=0;j<3;j++) teclas.push(mover(cajaR(0.014, 0.004, 0.011, 0.002), -0.018 + j*0.018, 0.045, 0.012 + i*0.013));
  const pantalla = mover(caja(0.06, 0.003, 0.018), 0, 0.044, -0.03);
  const cables = [mover(cilindro(0.0022, 0.12, 6).rotateY(0.3), -0.045, 0.03, 0.0), mover(cilindro(0.0022, 0.12, 6).rotateY(-0.2), 0.045, 0.03, 0.02)];
  pieza(A, 'cuerpo', [[panes, 'blanco'], [cinta, 'negro'], [[caja_], 'polimero'], [teclas, 'goma'], [[pantalla], 'pantalla'], [[cables[0]], 'rojo'], [[cables[1]], 'naranja']]);
  enc(A, 'agarre', 0.05, -0.02, 0.03); enc(A, 'apoyo', -0.05, -0.02, 0.03); enc(A, 'teclado', 0, 0.05, 0.03);
  vol(A, null, {t:'caja', c:[0, 0, 0], h:[0.0785, 0.026, 0.08], r:0.008}); vol(A, null, {t:'caja', c:[0, 0.034, 0], h:[0.05, 0.009, 0.045], r:0.004});
  A.d = {clase:'c4', largo:0.18};
  return A;
}
const FABRICA = {glock:armaGlock, usps:armaUSP, deagle:armaDeagle, mac10:armaMac10, mp9:armaMP9, ak47:armaAK, m4s:armaM4, awp:armaAWP,
  cuchillo:()=> armaCuchillo('ct'), cuchillo_t:()=> armaCuchillo('t'), he:()=> armaGranada('he'), flash:()=> armaGranada('flash'), humo:()=> armaGranada('humo'), c4:armaC4};
/* EL ARMA EN TERCERA PERSONA (la de los bots, la tirada, la granada en el aire): ninguna pieza se mueve, así que va fundida en una
   malla por material y armada una sola vez por tipo. Armada pieza por pieza eran 85 mallas en la escena (y otras tantas en la
   sombra), cada cambio de arma de un bot construía todo de nuevo, y lo viejo quedaba en la placa (nunca se soltaba). Los enchufes
   se copian con la misma posición: el personaje lee agarre y apoyo de ahí */
const ARMA3 = {};
function armaTercera(id){
  let b = ARMA3[id];
  if(!b){ const A = FABRICA[id](); A.g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(A.g.matrixWorld).invert(), por = new Map();
    A.g.traverse(o=>{ if(!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if(!por.has(o.material)) por.set(o.material, []); por.get(o.material).push(g); });
    b = ARMA3[id] = {mallas:[...por].map(([m, gs])=> [fundir(gs), m]), e:A.e, d:A.d}; }
  const g = new THREE.Group(); g.name = id;
  for(const [geo, m] of b.mallas){ const me = new THREE.Mesh(geo, m); me.castShadow = true; g.add(me); }
  const e = {}; for(const k in b.e) e[k] = b.e[k].clone(false);
  return {id, g, p:{}, e, d:b.d};
}
const FABRICA3 = {}; for(const k in FABRICA) FABRICA3[k] = ()=> armaTercera(k);
