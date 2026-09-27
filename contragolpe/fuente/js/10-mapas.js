
/* ====================== mapas ======================
   Armado por grilla de 1 m: cada mapa declara los lugares caminables (pasillos, plazas, túneles, pasarelas) como rectángulos con
   su piso, su altura y si tienen techo; todo lo que no es caminable es edificio o roca, y sale solo fundido en cajas grandes
   (primero por filas y después hacia abajo). Arriba de eso va la utilería (c3p.js), las luces, las calcomanías y los marcadores
   de juego (apariciones, sitios, zonas de compra y puntos de guardia para los bots). */
function rectsDe(W, H, lleno){ /* lleno(i, j) → true: rectángulos que cubren exacto las celdas llenas */
  const usado = new Uint8Array(W*H), out = [];
  for(let j=0;j<H;j++) for(let i=0;i<W;i++){ if(usado[j*W + i] || !lleno(i, j)) continue; const k = lleno(i, j);
    let i1 = i; while(i1 + 1 < W && !usado[j*W + i1 + 1] && lleno(i1 + 1, j) === k) i1++;
    let j1 = j; ext: while(j1 + 1 < H){ for(let x=i;x<=i1;x++) if(usado[(j1 + 1)*W + x] || lleno(x, j1 + 1) !== k) break ext; j1++; }
    for(let y=j;y<=j1;y++) for(let x=i;x<=i1;x++) usado[y*W + x] = 1; out.push({i0:i, j0:j, i1:i1 + 1, j1:j1 + 1, k}); }
  return out; }
/* def: {x0, z0, x1, z1, alto, matMuro(x, z), areas:[{x0, z0, x1, z1, y, mat, techo, matTecho, hueco}], bajo:{x0, z0, x1, z1, y, alto, areas}} */
function armarRaster(def){
  const X0 = def.x0, Z0 = def.z0, W = def.x1 - def.x0, H = def.z1 - def.z0, cel = new Int16Array(W*H).fill(-1);
  def.areas.forEach((a, k)=>{ for(let z=Math.max(0, Math.floor(a.z0 - Z0)); z<Math.min(H, Math.ceil(a.z1 - Z0)); z++) for(let x=Math.max(0, Math.floor(a.x0 - X0)); x<Math.min(W, Math.ceil(a.x1 - X0)); x++) cel[z*W + x] = k; });
  const A = k=> def.areas[k];
  /* edificios: lo que no es caminable; altura por barrio (varía para que el horizonte no sea una regla) */
  const barrio = (i, j)=>{ const h = semilla32(def.id + ':' + Math.floor(i/9) + ',' + Math.floor(j/9)) % 4; return 1 + h; };
  for(const r of rectsDe(W, H, (i, j)=> cel[j*W + i] < 0 ? barrio(i, j) : 0)){ const x0 = X0 + r.i0, z0 = Z0 + r.j0, x1 = X0 + r.i1, z1 = Z0 + r.j1, alto = def.alto + (r.k - 2)*1.1;
    bloque(x0, def.yBase || 0, z0, x1, alto, z1, def.matMuro((x0 + x1)/2, (z0 + z1)/2, r.k)); }
  /* pisos (por área), plataformas levantadas y techos */
  for(const r of rectsDe(W, H, (i, j)=> cel[j*W + i] + 1)){ const a = A(r.k - 1); if(a.hueco) continue; const x0 = X0 + r.i0, z0 = Z0 + r.j0, x1 = X0 + r.i1, z1 = Z0 + r.j1;
    if(a.y > 0.01) bloque(x0, def.yBase || 0, z0, x1, a.y, z1, a.matLado || a.mat, {texel:0.5}); else piso(x0, z0, x1, z1, a.y || 0, a.mat, {texel:0.5, grosor:a.grosor || 0.3, sin:def.bajo ? [] : ['ny']});   /* con nivel de abajo el piso se ve de los dos lados */
    if(a.techo) bloque(x0, (a.y || 0) + a.techo, z0, x1, Math.max(def.alto + 1.5, (a.y || 0) + a.techo + 0.5), z1, a.matTecho || def.matMuro((x0 + x1)/2, (z0 + z1)/2, 2)); }
  if(def.bajo){ const b = def.bajo, bw = b.x1 - b.x0, bh = b.z1 - b.z0, cb = new Int16Array(bw*bh).fill(-1);
    b.areas.forEach((a, k)=>{ for(let z=Math.max(0, Math.floor(a.z0 - b.z0)); z<Math.min(bh, Math.ceil(a.z1 - b.z0)); z++) for(let x=Math.max(0, Math.floor(a.x0 - b.x0)); x<Math.min(bw, Math.ceil(a.x1 - b.x0)); x++) cb[z*bw + x] = k; });
    for(const r of rectsDe(bw, bh, (i, j)=> cb[j*bw + i] < 0 ? 1 : 0)) bloque(b.x0 + r.i0, b.y, b.z0 + r.j0, b.x0 + r.i1, -0.3, b.z0 + r.j1, b.mat);
    for(const r of rectsDe(bw, bh, (i, j)=> cb[j*bw + i] + 1)){ const a = b.areas[r.k - 1]; piso(b.x0 + r.i0, b.z0 + r.j0, b.x0 + r.i1, b.z0 + r.j1, b.y + (a.y || 0), a.mat, {texel:0.5});
      if(a.y > 0.01) bloque(b.x0 + r.i0, b.y, b.z0 + r.j0, b.x0 + r.i1, b.y + a.y, b.z0 + r.j1, a.mat); } }
}
const U_ = UTIL;
/* cajas para cubrirse: una sola, apiladas o en "L" */
function cajas(x, z, y, n, mat, s){ s = s || 1.25; const pos = [[0, 0, 0], [s, 0, 0], [0, 0, s], [0.1, s, 0.1], [s, 0, s], [s*0.5, s, s*0.4]];
  for(let i=0;i<n;i++){ const [dx, dy, dz] = pos[i]; bloque(x + dx - s/2, y + dy, z + dz - s/2, x + dx + s/2, y + dy + s, z + dz + s/2, mat); } }

/* ====================== DESIERTO (a la Dust2) ======================
   T al sur, CT al norte. Larga A por el este con los portones, corta (pasarela) desde el medio, medio con las puertas, túneles
   de B por el oeste (arriba y abajo, techados), sitio B con cajas y ventana, sitio A con plataforma y rampa. */
function mapaDesierto(){
  const muro = (x, z, k)=> k === 1 ? 'revoque' : k === 3 ? 'adoquin' : 'arenisca';
  armarRaster({id:'desierto', x0:-50, z0:-50, x1:50, z1:50, alto:7.5, matMuro:muro, areas:[
    {x0:-14, z0:34, x1:14, z1:47, mat:'tierra'},                                  /* spawn T */
    {x0:-5, z0:-34, x1:5, z1:34, mat:'adoquin'},                                   /* medio */
    {x0:-9, z0:-4, x1:9, z1:4, mat:'adoquin'},                                     /* puertas de medio (ensanche) */
    {x0:14, z0:20, x1:30, z1:28, mat:'tierra'},                                    /* afuera de larga */
    {x0:28, z0:-14, x1:38, z1:40, mat:'tierra'},                                   /* larga A */
    {x0:18, z0:-42, x1:45, z1:-14, mat:'adoquin'},                                 /* sitio A */
    {x0:20, z0:-40, x1:31, z1:-31, y:1.3, mat:'arenisca'},                         /* plataforma de A */
    {x0:9, z0:-12, x1:18, z1:-5, y:2.1, mat:'madera', matLado:'arenisca'},         /* corta / pasarela */
    {x0:5, z0:-12, x1:9, z1:-5, mat:'adoquin'},                                    /* pie de la subida */
    {x0:-12, z0:-46, x1:12, z1:-33, mat:'adoquin'},                                /* spawn CT */
    {x0:12, z0:-41, x1:18, z1:-34, mat:'adoquin'},                                 /* CT → A */
    {x0:-24, z0:-43, x1:-12, z1:-35, mat:'adoquin'},                               /* CT → B */
    {x0:-44, z0:-45, x1:-18, z1:-18, mat:'tierra'},                                /* sitio B */
    {x0:-40, z0:-18, x1:-30, z1:30, mat:'tierra', techo:3.3, matTecho:'arenisca'}, /* túnel de arriba (techado) */
    {x0:-30, z0:0, x1:-5, z1:6, mat:'hormigon_pared', techo:3.1, matTecho:'revoque'}, /* túnel de abajo */
    {x0:-30, z0:28, x1:-14, z1:40, mat:'tierra'},                                  /* T → túneles */
    {x0:-18, z0:-31, x1:-5, z1:-25, mat:'adoquin'},                                /* medio → B (puertas de B) */
    {x0:4, z0:-34, x1:14, z1:-30, mat:'adoquin'},                                  /* medio → CT */
  ]});
  /* escaleras y rampas */
  rampa(5, -12, 9, -5, 0, 2.1, 'x+', 'madera');                      /* subida a la corta desde el medio */
  escalera(18, -12, 22, -5, 0, 2.1, 'x-', 'arenisca');                /* de A a la corta */
  rampa(31, -40, 36, -34, 0, 1.3, 'x-', 'arenisca');                /* rampa de la plataforma de A */
  escalera(24, -31, 28, -28, 0, 1.3, 'z-', 'arenisca');
  /* sitio A: cajas, carro y cartel */
  cajas(38, -22, 0, 3, 'caja_madera'); cajas(25, -24, 0, 2, 'caja_madera'); cajas(40, -36, 0, 4, 'caja_madera', 1.3); cajas(23, -35, 1.3, 1, 'caja_madera', 1.1);
  U_.auto(33, 0, -20, {mat:'metal_blanco', giro:1}); U_.cartel('A', 44.7, 2.2, -28, 'x-', 1.3);
  /* larga: portones y barriles */
  U_.puerta('x', 12, 28, 38, 0, 3.4, 0.5, {mat:'puerta_azul', abierta:0.8}); U_.barriles(35, 0, 6, 3, {mats:['barril_azul', 'barril_rojo']}); cajas(30, 10, 0, 2, 'caja_madera');
  U_.toldo(28, 30, 33, 34, 3.2, 2.6, 'x+', {mat:'lona_roja'});
  /* medio: puertas de medio con un hueco, cajas */
  cajas(-3, -18, 0, 1, 'caja_madera', 1.2); cajas(2.6, 12, 0, 2, 'caja_madera'); U_.barriles(-3.8, 0, 22, 2, {mats:['barril_verde']});
  /* sitio B: cajas altas, ventana, barriles, auto viejo */
  cajas(-31, -31, 0, 5, 'caja_madera', 1.3); cajas(-40, -24, 0, 2, 'caja_madera'); cajas(-22, -40, 0, 3, 'caja_madera'); U_.auto(-40, 0, -39, {mat:'metal_azul'});
  U_.barriles(-25, 0, -22, 3, {mats:['barril_rojo', 'barril_amarillo']}); U_.cartel('B', -44.7, 2.2, -30, 'x+', 1.3);
  /* T spawn y afuera: palmeras de mentira (matas), toldos */
  for(const [x, z] of [[-10, 44], [10, 44], [0, 42]]) U_.mata(x, 0, z, {alto:1.1}); cajas(6, 37, 0, 2, 'caja_madera');
  /* luces: túneles y portones */
  for(let z=-14;z<28;z+=7) lampara(-35, 3.0, z, '#ffd9a0', 16, 9); for(let x=-26;x<-6;x+=7) lampara(x, 2.8, 3, '#ffd9a0', 14, 8);
  calco(-3.9, 1.6, 26, 1, 0, 0, 1.4, 1.4, 'grafiti_1'); calco(-29.9, 1.4, 3, 1, 0, 0, 1.2, 1.2, 'grafiti_2'); calco(30, 0.02, 15, 0, 1, 0, 1.4, 1.6, 'mancha_2');
  /* marcadores */
  for(let i=0;i<5;i++){ spawn('t', -6 + i*3, 0, 42, 0); spawn('ct', -6 + i*3, 0, -40, Math.PI); }
  sitio('A', 18, -42, 45, -14, 0); sitio('B', -44, -45, -18, -18, 0);
  zona('compra_t', -14, 34, 14, 47); zona('compra_ct', -12, -46, 12, -33);
  for(const [x, z] of [[-10, 40], [10, 40], [0, 20], [0, -20], [33, 20], [33, -8], [30, -25], [40, -40], [-35, 20], [-35, 10], [-35, -12], [-20, 3], [-30, -35], [-40, -20], [-20, -28], [0, -40], [-18, -40], [15, -38]]) spawn('dm', x, 0, z, 0);
  /* guardias: CT sostiene las entradas de los sitios; T después de plantar */
  const g = (b, s, x, z, mx, mz)=> guardia(b, s, x, 0, z, mx, 1.4, mz);
  g('ct', 'A', 40, -18, 33, 5); g('ct', 'A', 22, -20, 12, -8); g('ct', 'A', 26, -36, 33, -5); g('ct', 'A', 42, -30, 33, 0);
  g('ct', 'B', -33, -22, -35, -5); g('ct', 'B', -22, -38, -15, -28); g('ct', 'B', -42, -40, -35, -10); g('ct', 'B', -28, -30, -35, -15);
  g('t', 'A', 30, -30, 15, -38); g('t', 'A', 36, -18, 25, -35); g('t', 'B', -35, -22, -20, -40); g('t', 'B', -30, -40, -20, -28);
}
/* ====================== NUCLEAR (a la Nuke) ======================
   Patio exterior con asfalto, silos y galpones; edificio principal con el SITIO A adentro (galpón alto, casita, pasarela naranja
   arriba, cajones rojos) y el SITIO B abajo (dos pisos de verdad: se baja por la rampa o por la escalera de "secreto"). */
function mapaNuclear(){
  const muro = (x, z, k)=> (x > -22 && x < 22 && z > -22 && z < 12) ? (k % 2 ? 'chapa_blanca' : 'chapa_azul') : (k === 1 ? 'hormigon_pared' : k === 3 ? 'chapa_azul' : 'chapa_blanca');
  armarRaster({id:'nuclear', x0:-55, z0:-50, x1:55, z1:50, alto:10, matMuro:muro, areas:[
    {x0:-40, z0:22, x1:40, z1:47, mat:'asfalto'},                                        /* patio de afuera (T) */
    {x0:-52, z0:-40, x1:-32, z1:22, mat:'grava'},                                        /* afuera oeste ("afuera" de CS) */
    {x0:-18, z0:-20, x1:18, z1:10, mat:'piso_int', techo:9.5, matTecho:'techo'},         /* galpón del sitio A */
    {x0:-8, z0:10, x1:8, z1:22, mat:'piso_int', techo:3.6, matTecho:'chapa_blanca'},     /* entrada principal (lobby) */
    {x0:18, z0:-8, x1:34, z1:0, mat:'piso_int', techo:3.4, matTecho:'chapa_blanca'},     /* "squeaky" / pasillo este */
    {x0:30, z0:0, x1:46, z1:22, mat:'hormigon_piso'},                                    /* patio este (rampa) */
    {x0:-32, z0:-6, x1:-18, z1:0, mat:'piso_int', techo:3.4, matTecho:'chapa_blanca'},   /* "hut" oeste → A */
    {x0:-18, z0:-40, x1:18, z1:-20, mat:'hormigon_piso'},                                /* CT (norte) */
    {x0:-32, z0:-40, x1:-18, z1:-30, mat:'grava'},                                       /* CT → afuera */
    {x0:18, z0:-40, x1:46, z1:-30, mat:'hormigon_piso'},                                 /* CT → este */
    {x0:40, z0:-30, x1:46, z1:0, mat:'hormigon_piso'},
    {x0:36, z0:4, x1:44, z1:18, hueco:true, mat:'semilla'},                               /* boca de la rampa a B */
    {x0:-44, z0:-24, x1:-40, z1:-16, hueco:true, mat:'semilla'},                          /* escalera "secreto" a B */
  ], bajo:{x0:-48, z0:-30, x1:48, z1:20, y:-4.5, mat:'hormigon_pared', areas:[
    {x0:-10, z0:-24, x1:22, z1:0, mat:'piso_int'},                                       /* SITIO B (abajo del galpón) */
    {x0:22, z0:-16, x1:44, z1:-8, mat:'piso_int'},                                       /* pasillo de B a la rampa */
    {x0:36, z0:-8, x1:44, z1:18, mat:'semilla'},                                         /* rampa (abajo) */
    {x0:-44, z0:-24, x1:-10, z1:-16, mat:'piso_int'},                                    /* "secreto" hasta B */
  ]}});
  rampa(36, 4, 44, 18, -4.5, 0, 'z+', 'semilla');
  muro('x', -20, -18, 18, 0, 9.5, 0.6, 'chapa_blanca', [{d0:-3, d1:3, y0:0, y1:3.4}, {d0:12, d1:15, y0:0, y1:3.2}]);   /* pared CT del galpón con dos puertas */                                         /* rampa: sube hacia el patio este */
  escalera(-44, -24, -40, -16, -4.5, 0, 'z+', 'hormigon_pared');
  /* SITIO A: casita (hut) con techo, cajones rojos radiactivos, pasarela naranja arriba con escalera marinera */
  bloque(-2, 0, -12, 6, 3.2, -6, 'pared_verde'); bloque(-2.3, 3.2, -12.3, 6.3, 3.5, -5.7, 'techo');
  cajas(-10, -12, 0, 4, 'caja_roja', 1.35); cajas(10, 2, 0, 3, 'caja_roja', 1.35); cajas(12, -14, 0, 2, 'caja_roja', 1.35); cajas(-12, 4, 0, 1, 'caja_roja', 1.35);
  bloque(-18, 4.2, -20, 18, 4.5, -17, 'acero_naranja'); bloque(15, 4.2, -17, 18, 4.5, 10, 'acero_naranja');     /* pasarela en L */
  U_.baranda(-18, -17, 15, -17, 4.5, {mat:'amarillo'}); U_.baranda(15, -17, 15, 10, 4.5, {mat:'amarillo'});
  escalera(15, 4, 18, 10, 0, 4.2, 'z-', 'acero_naranja');
  for(const x of [-18, -6, 6, 18]) U_.viga([x, 0, 10], [x, 9.5, 10], {mat:'acero_naranja'});
  for(let x=-12;x<=12;x+=8) for(const z of [-14, 0]) lampara(x, 9, z, '#eef3ff', 34, 16);
  U_.cartel('A', 0, 3.5, 9.7, 'z-', 1.4);
  /* SITIO B: cajones, tambores, caños */
  cajas(4, -18, -4.5, 3, 'caja_roja', 1.35); cajas(14, -6, -4.5, 2, 'caja_roja', 1.35); cajas(-4, -6, -4.5, 2, 'caja_madera'); U_.barriles(10, -4.5, -20, 4, {mats:['barril_amarillo', 'barril_negro']});
  for(let x=-6;x<=18;x+=8) for(const z of [-18, -6]) lampara(x, -0.8, z, '#f4f7ff', 22, 11);
  for(let x=24;x<=42;x+=6) lampara(x, -1, -12, '#ffe9c8', 12, 8); lampara(40, -1.5, 8, '#ffe9c8', 14, 9); for(let x=-40;x<=-14;x+=8) lampara(x, -1, -20, '#ffe9c8', 12, 8);
  U_.cartel('B', 21.7, -2.6, -4, 'x-', 1.3); calco(0, -4.48, -12, 0, 1, 0, 2, 2, 'simbolo_radiacion');
  /* patio: silos, tanques, contenedores, galpones chicos */
  U_.tanque(-26, 0, 38, 4.2, 10, {mat:'metal_blanco'}); U_.tanque(-14, 0, 40, 3.2, 8, {mat:'metal_blanco'}); U_.tanqueH(20, 0, 42, 1.6, 8, {mat:'metal_blanco'});
  U_.contenedor(10, 0, 30, {mat:'contenedor_azul'}); U_.contenedor(28, 0, 34, {mat:'contenedor_rojo', eje:'z'}); U_.contenedor(-30, 0, 28, {mat:'contenedor_verde'});
  cajas(0, 30, 0, 2, 'caja_madera'); U_.barriles(-4, 0, 26, 3, {mats:['barril_amarillo', 'barril_azul']});
  /* afuera oeste */
  U_.contenedor(-44, 0, 0, {mat:'contenedor_naranja', eje:'z'}); U_.contenedor(-38, 0, -30, {mat:'contenedor_gris'}); cajas(-46, -12, 0, 2, 'caja_madera');
  /* CT: equipos, cajas */
  U_.equipoAire(-10, 0, -38, {}); U_.equipoAire(-6, 0, -38, {}); cajas(8, -26, 0, 2, 'caja_madera'); cajas(30, -34, 0, 3, 'caja_madera');
  for(const [x, z] of [[-4, 16], [4, 16], [26, -4], [-25, -3]]) lampara(x, 3.3, z, '#eef3ff', 14, 8);
  calco(-40, 0.02, 30, 0, 1, 0, 1.4, 1.4, 'mancha_aceite'); calco(17.9, 2, -2, -1, 0, 0, 1.4, 0.5, 'franjas_peligro');
  /* marcadores */
  for(let i=0;i<5;i++){ spawn('t', -8 + i*4, 0, 42, 0); spawn('ct', -8 + i*4, 0, -36, Math.PI); }
  sitio('A', -18, -20, 18, 10, 0); sitio('B', -10, -24, 22, 0, -4.5);
  zona('compra_t', -40, 34, 40, 47); zona('compra_ct', -18, -40, 18, -28);
  for(const [x, y, z] of [[-30, 0, 40], [30, 0, 40], [0, 0, 20], [-45, 0, 10], [-45, 0, -30], [40, 0, 10], [42, 0, -20], [0, 0, -36], [-10, 0, 0], [10, 0, -15], [0, -4.5, -12], [30, -4.5, -12], [-30, -4.5, -20], [25, 0, -4]]) spawn('dm', x, y, z, 0);
  const g = (b, s, x, y, z, mx, mz)=> guardia(b, s, x, y, z, mx, y + 1.4, mz);
  g('ct', 'A', -14, 0, -16, 0, 16); g('ct', 'A', 12, 4.5, -18, 0, 5); g('ct', 'A', 14, 0, 6, -25, -3); g('ct', 'A', -14, 0, 6, 0, 20);
  g('ct', 'B', 18, -4.5, -20, 30, -12); g('ct', 'B', -6, -4.5, -20, -30, -20); g('ct', 'B', 16, -4.5, -2, 40, -12); g('ct', 'B', 0, -4.5, -8, -30, -20);
  g('t', 'A', 0, 0, -16, 0, -30); g('t', 'A', 12, 0, -2, 0, 16); g('t', 'B', 10, -4.5, -12, 30, -12); g('t', 'B', 0, -4.5, -20, -30, -20);
}
/* ====================== ALMACÉN ======================
   Galpón simétrico para deathmatch y carrera: estanterías altas, cajones apilados, pasarela perimetral con escaleras,
   oficinas con ventanas en las cabeceras y montacargas. */
function mapaAlmacen(){
  armarRaster({id:'almacen', x0:-28, z0:-20, x1:28, z1:20, alto:10, matMuro:(x, z, k)=> k % 2 ? 'hormigon_pared' : 'chapa_azul', areas:[
    {x0:-24, z0:-16, x1:24, z1:16, mat:'piso_int', techo:9.5, matTecho:'techo'}]});
  /* pasarela perimetral a 4 m */
  for(const s of [-1, 1]){ bloque(-24, 4, s*16 - (s > 0 ? 2.2 : -0), 24, 4.3, s*16 + (s > 0 ? 0 : 2.2), 'acero_naranja'); for(const [a0, a1] of s > 0 ? [[-22, 15.8], [20.2, 22]] : [[-22, -20.2], [-15.8, 22]]) U_.baranda(a0, s*(16 - 2.2), a1, s*(16 - 2.2), 4.3, {mat:'amarillo'});
    /* la escalera arranca después de la oficina (antes empezaba en z = ∓1 y la pared y el techo de la oficina la cortaban por la mitad) */
    escalera(s*18 - 2, s*5.5, s*18 + 2, s*(16 - 2.2), 0, 4, s > 0 ? 'z+' : 'z-', 'acero_naranja'); }
  /* estanterías en filas y cajones */
  for(const z of [-8, 8]) for(const x of [-10, 10]) U_.estanteria(x, 0, z, 3, {giro:0});
  for(const [x, z, n] of [[-3, 0, 4], [3, 0, 3], [-22, -3, 2], [22, 3, 2], [0, -12, 2], [0, 12, 2], [-10, 0, 1], [10, 0, 1]]) cajas(x, z, 0, n, (x + z) % 2 ? 'caja_madera' : 'caja_roja', 1.3);
  U_.montacargas(-12, 0, 12, {}); U_.montacargas(12, 0, -12, {giro:2});
  /* oficinas en las cabeceras */
  for(const s of [-1, 1]){ bloque(s*24 - (s > 0 ? 6 : 0), 0, -5, s*24 + (s > 0 ? 0 : 6), 3.2, -4.7, 'revoque'); bloque(s*24 - (s > 0 ? 6 : 0), 0, 4.7, s*24 + (s > 0 ? 0 : 6), 3.2, 5, 'revoque'); bloque(s*24 - (s > 0 ? 6 : 0), 3.2, -5, s*24 + (s > 0 ? 0 : 6), 3.5, 5, 'techo'); }
  /* campanas colgadas del techo; los pasillos de afuera de las escaleras (donde nacen los dos bandos) y lo de abajo de las
     pasarelas no los alcanzaba ninguna lámpara y quedaban negros: campanas y tubos propios */
  for(let x=-18;x<=18;x+=9) for(const z of [-9, 0, 9]) U_.luminaria('campana', x, 8.2, z, {colgar:1.2, fuerza:30, radio:14});
  for(const s of [-1, 1]){ for(const z of [-10.5, 10.5]) U_.luminaria('campana', s*22, 8.2, z, {colgar:1.2, fuerza:20, radio:11});
    for(const x of [-16, 0, 16]) U_.luminaria('tubo', x, 3.9, s*14.9, {fuerza:9, radio:8});
    U_.luminaria('tubo', s*21, 3.1, 0, {fuerza:10, radio:7, eje:'z'}); }
  calco(0, 0.02, 0, 0, 1, 0, 2.4, 2.4, 'mancha_aceite'); calco(-23.9, 2, -10, 1, 0, 0, 2, 0.7, 'franjas_peligro'); calco(23.9, 2, 10, -1, 0, 0, 1.6, 1.6, 'grafiti_2');
  for(const [x, z, y] of [[-22.5, -12, 0], [22.5, 12, 0], [-20, 12, 0], [20, -12, 0], [0, -14, 0], [0, 14, 0], [-12, 0, 0], [12, 0, 0], [-21, 0, 0], [21, 0, 0], [-8, -15, 4.3], [8, 15, 4.3], [-16, 15, 4.3], [16, -15, 4.3]]) spawn('dm', x, y, z, Math.atan2(x, z));
  for(const z of [-13, -9, -1, 2, 10]){ spawn('t', -22.5, 0, z, -Math.PI/2); spawn('ct', 22.5, 0, z, Math.PI/2); }
}
const MAPAS = {
  nuclear:{id:'nuclear', nombre:'NUCLEAR', cielo:'cielo_nuclear', sol:{az:130.7, elev:44.5}, modos:['bomba', 'dm', 'armas'], construir:mapaNuclear},
  desierto:{id:'desierto', nombre:'DESIERTO', cielo:'cielo_desierto', sol:{az:120.4, elev:42.5}, modos:['bomba', 'dm', 'armas'], construir:mapaDesierto},
  almacen:{id:'almacen', nombre:'ALMACÉN', cielo:'cielo_nuclear', sol:{az:130.7, elev:44.5}, modos:['dm', 'armas'], construir:mapaAlmacen, ambiente:0.035},
};
window.MAPAS = MAPAS;
