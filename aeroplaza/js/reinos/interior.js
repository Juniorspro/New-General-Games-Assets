/* ============================================================================
   aeroplaza/js/reinos/interior.js — adentro de los edificios, en primera
   persona: la cámara va en los ojos y un punto en el medio dice qué se puede
   usar (se apunta y se aprieta usar). Tres clases de interiores:
   · el HOTEL (los cinco de la Ciudad de Vidrio): lobby con recepción y timbre,
     columna-acuario, sillones, piano y pantalla de noticias; un ascensor de
     vidrio que sube por afuera de los pisos (se llama con el botón y adentro se
     elige el piso); la suite del piso 12 con cama, tele, lámpara, heladera y
     jacuzzi de burbujas; y la azotea con pileta, reposeras, bar y telescopio.
   · el CAFÉ del pabellón octogonal: barra con cafetera, mesas con sillas para
     sentarse, rocola que cambia la canción y un pizarrón con el menú.
   · la CASA de los vecinos del barrio: sala redonda con ojos de buey, sillón,
     tele, lámpara, biblioteca con libros para leer, pecera, heladera y
     tocadiscos.
   Afuera de las ventanas hay un telón con la ciudad (de noche se prenden las
   ventanas). Lo que se mueve (el ascensor) es un sólido del mundo que te lleva.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Mundo, azar } from '../mundo.js';
import { brilloso, materialVidrio, materialBurbuja, UNI } from '../naturaleza.js';
import { Cardumen, Burbujas, Chispas, pecera } from '../objetos.js';
import { modelo } from '../modelos.js';
import { letrero, fundir } from '../edificios.js';
import { sumar, t } from '../textos.js';

sumar({
  es: {
    int_pc: 'Usar la compu', int_mail: '📧 Un mensaje nuevo: «¡Bienvenida, bienvenido a la suite! Pedí lo que quieras»',
    accion_salir_edificio: 'Salir a la isla', lugar_hotel: 'Hotel Aero', lugar_cafe: 'Café Burbuja', lugar_casa: 'La casa de {n}',
    entrar_hotel: 'Entrar al hotel', entrar_cafe: 'Entrar al café', entrar_casa: 'Tocar el timbre y entrar', salir_edificio: 'Salir',
    asc_llamar: 'Llamar el ascensor', asc_pb: 'Planta baja', asc_suite: 'Piso 12 · Suite', asc_azotea: 'Azotea', asc_llega: 'Llegaste: {n}', asc_sube: 'Subiendo…', asc_baja: 'Bajando…',
    int_timbre: 'Tocar el timbre', int_piano: 'Tocar el piano', int_peces: 'Mirar los peces', int_tele_si: 'Prender la tele', int_tele_no: 'Apagar la tele', int_luz: 'Prender o apagar la luz',
    int_heladera: 'Abrir la heladera', int_jugo: '🧃 Un jugo de mango: te sentís liviano', int_jacuzzi: 'Prender las burbujas', int_telescopio: 'Mirar por el telescopio', int_bar: 'Pedir un licuado', int_licuado: '🥤 Licuado de frutilla. ¡Rico!',
    int_cafe: 'Pedir un café', int_cafe_listo: '☕ Un café con espuma de corazón', int_sentarse: 'Sentarse', int_rocola: 'Cambiar la canción', int_libro: 'Leer un libro', int_disco: 'Poner un disco', int_pantalla: 'Ver las noticias',
    libro_1: '«El delfín que aprendió a volar» — Un delfín de Aqua miraba las auroras cada noche, hasta que una estrella le enseñó a saltar tan alto que no volvió a bajar…',
    libro_2: '«Guía de la isla» — Consejo 12: el monorriel pasa cada minuto y medio. Consejo 13: los hongos del bosque rebotan más si venís corriendo.',
    libro_3: '«Recetas de burbujas» — Agua, jabón, una gota de miel y soplar despacio. Si sale redonda, pedí un deseo.',
    noticias: 'AEROPLAZA HOY · Abrió la Zona de Juegos con PARKOUR AERO · El monorriel ya da la vuelta a la isla · Mañana: sol, burbujas y viento suave · ',
    npc_recepcion: 'Perla', npc_barista: 'Moka', npc_vecina: 'Rulo', npc_vecino: 'Nube',
    d_recepcion_0: '¡Bienvenida, bienvenido al Hotel Aero! Soy Perla.|El ascensor de vidrio sube a la suite y a la azotea. ¡La pileta de arriba tiene la mejor vista de la isla!',
    d_barista_0: '¡Hola! Soy Moka. Acá el café sale con espuma de corazón.|Apuntá a la cafetera y pedí uno. La rocola cambia la canción.',
    d_vecina_0: '¡Pasá, pasá! Soy Rulo. Ponete cómodo.|Tengo libros en la biblioteca y un tocadiscos. Y la tele agarra el canal de las burbujas.',
    d_vecino_0: 'Hola, soy Nube. Vivo acá desde que se armó la plaza.|Si mirás por los ojos de buey se ven las mariposas del barrio.',
  },
  en: {
    int_pc: 'Use the computer', int_mail: '📧 New message: “Welcome to the suite! Ask for anything”',
    accion_salir_edificio: 'Back to the island', lugar_hotel: 'Hotel Aero', lugar_cafe: 'Bubble Café', lugar_casa: "{n}'s house",
    entrar_hotel: 'Enter the hotel', entrar_cafe: 'Enter the café', entrar_casa: 'Ring and come in', salir_edificio: 'Leave',
    asc_llamar: 'Call the elevator', asc_pb: 'Ground floor', asc_suite: 'Floor 12 · Suite', asc_azotea: 'Rooftop', asc_llega: 'You arrived: {n}', asc_sube: 'Going up…', asc_baja: 'Going down…',
    int_timbre: 'Ring the bell', int_piano: 'Play the piano', int_peces: 'Watch the fish', int_tele_si: 'Turn on the TV', int_tele_no: 'Turn off the TV', int_luz: 'Switch the light',
    int_heladera: 'Open the fridge', int_jugo: '🧃 A mango juice: you feel light', int_jacuzzi: 'Turn on the bubbles', int_telescopio: 'Look through the telescope', int_bar: 'Order a smoothie', int_licuado: '🥤 Strawberry smoothie. Yum!',
    int_cafe: 'Order a coffee', int_cafe_listo: '☕ A coffee with heart-shaped foam', int_sentarse: 'Sit down', int_rocola: 'Change the song', int_libro: 'Read a book', int_disco: 'Play a record', int_pantalla: 'Watch the news',
    libro_1: '“The dolphin who learned to fly” — A dolphin from Aqua watched the auroras every night, until a star taught it to jump so high it never came down…',
    libro_2: '“Island guide” — Tip 12: the monorail comes every minute and a half. Tip 13: forest mushrooms bounce higher if you come running.',
    libro_3: '“Bubble recipes” — Water, soap, a drop of honey and blow gently. If it comes out round, make a wish.',
    noticias: 'AEROPLAZA TODAY · The Game Zone opened with AERO PARKOUR · The monorail now circles the island · Tomorrow: sun, bubbles and a soft breeze · ',
    npc_recepcion: 'Pearl', npc_barista: 'Mocha', npc_vecina: 'Curl', npc_vecino: 'Cloud',
    d_recepcion_0: "Welcome to Hotel Aero! I'm Pearl.|The glass elevator goes up to the suite and the rooftop. The pool up there has the best view of the island!",
    d_barista_0: "Hi! I'm Mocha. Our coffee comes with heart-shaped foam.|Aim at the coffee machine and order one. The jukebox changes the song.",
    d_vecina_0: "Come in, come in! I'm Curl. Make yourself at home.|There are books on the shelf and a record player. And the TV gets the bubble channel.",
    d_vecino_0: "Hi, I'm Cloud. I've lived here since the plaza was built.|Look through the portholes and you'll see the neighborhood butterflies.",
  },
  pt: {
    int_pc: 'Usar o computador', int_mail: '📧 Nova mensagem: «Bem-vindo à suíte! Peça o que quiser»',
    accion_salir_edificio: 'Voltar para a ilha', lugar_hotel: 'Hotel Aero', lugar_cafe: 'Café Bolha', lugar_casa: 'A casa de {n}',
    entrar_hotel: 'Entrar no hotel', entrar_cafe: 'Entrar no café', entrar_casa: 'Tocar a campainha e entrar', salir_edificio: 'Sair',
    asc_llamar: 'Chamar o elevador', asc_pb: 'Térreo', asc_suite: 'Andar 12 · Suíte', asc_azotea: 'Terraço', asc_llega: 'Você chegou: {n}', asc_sube: 'Subindo…', asc_baja: 'Descendo…',
    int_timbre: 'Tocar a campainha', int_piano: 'Tocar o piano', int_peces: 'Olhar os peixes', int_tele_si: 'Ligar a TV', int_tele_no: 'Desligar a TV', int_luz: 'Acender ou apagar a luz',
    int_heladera: 'Abrir a geladeira', int_jugo: '🧃 Um suco de manga: você se sente leve', int_jacuzzi: 'Ligar as bolhas', int_telescopio: 'Olhar pelo telescópio', int_bar: 'Pedir uma vitamina', int_licuado: '🥤 Vitamina de morango. Delícia!',
    int_cafe: 'Pedir um café', int_cafe_listo: '☕ Um café com espuma de coração', int_sentarse: 'Sentar', int_rocola: 'Trocar a música', int_libro: 'Ler um livro', int_disco: 'Pôr um disco', int_pantalla: 'Ver as notícias',
    libro_1: '“O golfinho que aprendeu a voar” — Um golfinho de Aqua olhava as auroras toda noite, até que uma estrela o ensinou a pular tão alto que nunca mais desceu…',
    libro_2: '“Guia da ilha” — Dica 12: o monotrilho passa a cada minuto e meio. Dica 13: os cogumelos do bosque quicam mais se você vier correndo.',
    libro_3: '“Receitas de bolhas” — Água, sabão, uma gota de mel e soprar devagar. Se sair redonda, faça um pedido.',
    noticias: 'AEROPLAZA HOJE · Abriu a Zona de Jogos com o PARKOUR AERO · O monotrilho já dá a volta na ilha · Amanhã: sol, bolhas e brisa suave · ',
    npc_recepcion: 'Pérola', npc_barista: 'Moca', npc_vecina: 'Cacho', npc_vecino: 'Nuvem',
    d_recepcion_0: 'Bem-vindo ao Hotel Aero! Sou a Pérola.|O elevador de vidro sobe até a suíte e o terraço. A piscina lá de cima tem a melhor vista da ilha!',
    d_barista_0: 'Oi! Sou a Moca. Aqui o café vem com espuma de coração.|Mire na cafeteira e peça um. A jukebox troca a música.',
    d_vecina_0: 'Entra, entra! Sou o Cacho. Fique à vontade.|Tenho livros na estante e uma vitrola. E a TV pega o canal das bolhas.',
    d_vecino_0: 'Oi, sou o Nuvem. Moro aqui desde que a praça foi feita.|Olhando pelas escotilhas dá para ver as borboletas do bairro.',
  },
});

/* ---------------------------------------------------------------- texturas */
function lienzo(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; }
const texBaldosas = (a, b, n = 4) => { const tx = lienzo(256, 256, (g, W) => { const s = W / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.strokeRect(i * s + 1, j * s + 1, s - 2, s - 2); } }); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return tx; };
const texMadera = () => { const tx = lienzo(256, 256, (g, W, H) => { for (let i = 0; i < 8; i++) { g.fillStyle = ['#e8c89a', '#dcb886', '#efd2a6', '#e2c090'][i % 4]; g.fillRect(0, i * H / 8, W, H / 8); g.fillStyle = 'rgba(120,80,40,0.18)'; g.fillRect(0, i * H / 8, W, 2); for (let k = 0; k < 4; k++) g.fillRect((i * 67 + k * 90) % W, i * H / 8, 2, H / 8); } }); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return tx; };
/* el telón de afuera: el piso lejano, la ciudad y arriba transparente (se ve el cielo) */
function texCiudad() {
  return lienzo(2048, 512, (g, W, H) => {
    const r = azar(4);
    const suelo = g.createLinearGradient(0, H * 0.6, 0, H); suelo.addColorStop(0, '#7fd0ff'); suelo.addColorStop(1, '#3f9fe0'); g.fillStyle = suelo; g.fillRect(0, H * 0.62, W, H * 0.38);
    for (let capa = 0; capa < 2; capa++) for (let x = 0; x < W;) {
      const w = 40 + r() * 90, h = (capa ? 60 : 110) + r() * (capa ? 90 : 170), y = H * 0.63 - h;
      g.fillStyle = capa ? '#9fd6f2' : '#5fa8d8'; g.beginPath(); g.roundRect(x, y, w, h + 4, capa ? 6 : [w / 2, w / 2, 0, 0].map((q) => Math.min(q, 24))); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; for (let yy = y + 8; yy < y + h - 6; yy += 12) for (let xx = x + 6; xx < x + w - 6; xx += 10) if (r() < 0.6) g.fillRect(xx, yy, 5, 6);
      x += w + (capa ? 30 : 6) + r() * 20;
    }
  });
}

/* las torres de afuera: cajas y cilindros de vidrio con ventanas, con tapa blanca; todo fundido en pocas mallas */
function ciudadAfuera(r0) {
  const q = new THREE.Group(), rr = azar(77);
  const texV = lienzo(128, 256, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); for (let y = 8; y < H - 8; y += 21) for (let x = 7; x < W - 7; x += 19) { c.fillStyle = rr() < 0.65 ? '#b9e6ff' : '#fff2c4'; c.fillRect(x, y, 12, 13); } });
  texV.wrapS = texV.wrapT = THREE.RepeatWrapping;
  const mats = ['#6fc6f5', '#4fb0ec', '#8fdcff', '#c9efff'].map((col) => new THREE.MeshStandardMaterial({ color: col, map: texV, emissive: '#ffe7a8', emissiveMap: texV, emissiveIntensity: 0, roughness: 0.12, metalness: 0.35 }));
  const tapa = brilloso('#ffffff', { roughness: 0.2 }), verde = brilloso('#56e05a', { roughness: 0.4 });
  for (let k = 0; k < 30; k++) {
    const a = k / 30 * Math.PI * 2 + rr() * 0.12, d = r0 + 8 + rr() * 58, h = 12 + rr() * (d < r0 + 30 ? 40 : 80), w = 6 + rr() * 8, redonda = rr() < 0.4;
    const geo = redonda ? new THREE.CylinderGeometry(w / 2, w / 2, h, 20, 1, true) : new THREE.BoxGeometry(w, h, w * (0.7 + rr() * 0.5));
    const U = geo.attributes.uv; for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) * Math.max(1, Math.round(w / (redonda ? 1.3 : 4))), U.getY(i) * Math.max(1, Math.round(h / 7)));
    const x = Math.sin(a) * d, z = Math.cos(a) * d, ry = rr() * 3;
    const m = new THREE.Mesh(geo, mats[k % 4]); m.position.set(x, h / 2, z); m.rotation.y = ry; q.add(m);
    const c = new THREE.Mesh(redonda ? new THREE.SphereGeometry(w / 2 * 1.04, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2) : new RoundedBoxGeometry(w * 1.06, 1, geo.parameters.depth * 1.06, 2, 0.3), tapa);
    c.position.set(x, h + (redonda ? 0 : 0.4), z); c.rotation.y = ry; q.add(c);
    /* algunas con jardín arriba */
    if (!redonda && rr() < 0.4) for (let j = 0; j < 3; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.9 + rr() * 0.6, 10, 8), verde); b.position.set(x + (rr() - 0.5) * w * 0.6, h + 1.2, z + (rr() - 0.5) * w * 0.5); q.add(b); }
  }
  return { grupo: fundir(q), mats };
}

/* ---------------------------------------------------------------- el armado */
export function crearInterior(ctx, tipo = 'hotel', o = {}) {
  const mundo = new Mundo(() => 0); mundo.agua = null; mundo.limite = 60; mundo.sinRejilla = true;
  const g = new THREE.Group(), r = azar(3 + (o.i || 0));
  const acc = [], npcs = [], vivos = [];
  const MAT = new Map(), B = (c, op) => { const k = c + JSON.stringify(op || {}); if (!MAT.has(k)) MAT.set(k, brilloso(c, op)); return MAT.get(k); };
  const vidrio = materialVidrio('#e6fbff', 0.16); vidrio.side = THREE.DoubleSide;
  const caja = (w, h, d, rr = 0.06) => new RoundedBoxGeometry(w, h, d, 2, Math.min(rr, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const poner = (geo, m, x, y, z, ry = 0, padre = g) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); q.rotation.y = ry; q.castShadow = true; q.receiveShadow = true; padre.add(q); return q; };
  /* algo que se usa: obj (malla o grupo), texto (o función), alUsar(J) */
  const usar = (obj, texto, alUsar, dist = 3.4) => { const a = { obj, texto, alUsar, dist }; obj.traverse((q) => { q.userData.acc = a; }); acc.push(a); return a; };
  /* las piezas de adentro de un grupo que se mueve entero (la araña, el piano…) van fundidas en pocas mallas */
  const fundirDentro = (q) => {
    const hijos = q.children.filter((m) => m.isMesh && !m.isInstancedMesh && !m.userData.vivo && (!m.userData.acc || m.userData.acc === q.userData.acc));
    if (hijos.length < 3) return q;
    const F = new THREE.Group(); for (const m of hijos) F.add(m);
    const R = fundir(F); R.traverse((m) => { if (q.userData.acc) m.userData.acc = q.userData.acc; if (m.material?.transparent) m.renderOrder = 3; }); q.add(R);
    return q;
  };
  /* los muebles de modelos.js: fundidos (menos la tele, que cambia la pantalla) */
  const muebles = (n, x, y, z, ry, op) => {
    let m = modelo(n, op);
    if (n !== 'm-tele') { const u = m.userData, R = fundir(m); R.userData = u; m = R; }
    m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
  };
  const chispas = new Chispas(g, '#ffffff', 80);

  /* una sala rectangular: piso, techo y paredes (con sólidos). ventanas: lados de vidrio ('n','s','e','o') */
  function sala(x0, x1, z0, z1, y, alto, { piso, pared = B('#f6fbff', { roughness: 0.6, borde: 0 }), techo = B('#ffffff', { roughness: 0.7, borde: 0 }), ventanas = [], hueco = null, sinTecho = false, sinPiso = false } = {}) {
    const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (!sinPiso) { const p = poner(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), piso, cx, y + 0.001, cz); p.castShadow = false; }
    if (!sinTecho) { const t0 = poner(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), techo, cx, y + alto, cz); t0.castShadow = false; }
    const lados = { n: [cx, z0, W, 0], s: [cx, z1, W, Math.PI], o: [x0, cz, D, Math.PI / 2], e: [x1, cz, D, -Math.PI / 2] };
    for (const [k, [px, pz, L, ry]] of Object.entries(lados)) {
      if (ventanas.includes(k)) {
        const v = poner(new THREE.PlaneGeometry(L, alto), vidrio, px, y + alto / 2, pz, ry); v.renderOrder = 3; v.castShadow = false;
        for (let u = -L / 2; u <= L / 2 + 0.01; u += L / Math.max(1, Math.round(L / 3.2))) { const par = poner(caja(0.14, alto, 0.14, 0.04), B('#ffffff', { roughness: 0.2 }), 0, y + alto / 2, 0); if (k === 'n' || k === 's') par.position.set(px + u, y + alto / 2, pz); else par.position.set(px, y + alto / 2, pz + u); }
        poner(caja(k === 'n' || k === 's' ? L : 0.2, 0.25, k === 'n' || k === 's' ? 0.2 : L, 0.05), B('#ffffff'), px, y + 0.12, pz);
      } else {
        const m = poner(new THREE.PlaneGeometry(L, alto), pared, px, y + alto / 2, pz, ry); m.castShadow = false;
        const z = poner(new THREE.PlaneGeometry(L, 0.3), B('#43d8cd', { roughness: 0.3 }), 0, y + 0.15, 0, ry); z.position.set(px + Math.sin(ry) * 0.01, y + 0.15, pz + Math.cos(ry) * 0.01);
      }
      /* el sólido de la pared (con el hueco de la salida si hay) */
      if (hueco && hueco.lado === k) {
        const a = (L - hueco.ancho) / 2;
        for (const s of [-1, 1]) { const off = s * (hueco.ancho / 2 + a / 2); if (k === 'n' || k === 's') mundo.caja(px + off, pz, a / 2, 0.25, y - 1, y + alto); else mundo.caja(px, pz + off, 0.25, a / 2, y - 1, y + alto); }
      } else if (k === 'n' || k === 's') mundo.caja(px, pz, W / 2 + 0.3, 0.25, y - 1, y + alto); else mundo.caja(px, pz, 0.25, D / 2 + 0.3, y - 1, y + alto);
    }
  }
  /* el telón de la ciudad alrededor (y el piso lejano) */
  /* afuera (hotel y café): el piso de la calle, torres de verdad alrededor (de noche se prenden las
     ventanas) y el telón de la ciudad lejana. La casa del barrio no tiene ventanas grandes: nada de esto */
  const conCiudad = tipo !== 'casa';
  let telon = null, sueloLejos = null, torres = null;
  if (conCiudad) {
    telon = new THREE.Mesh(new THREE.CylinderGeometry(130, 130, 90, 48, 1, true), new THREE.MeshBasicMaterial({ map: texCiudad(), side: THREE.BackSide, transparent: true, alphaTest: 0.02, fog: false }));
    telon.position.y = 11; telon.renderOrder = -2; g.add(telon); telon.userData.sinApunte = true;
    sueloLejos = new THREE.Mesh(new THREE.CircleGeometry(130, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: (() => { const q = texBaldosas('#d8f1ff', '#c4e8fb', 2); q.repeat.set(60, 60); return q; })(), roughness: 0.6 }));
    sueloLejos.position.y = -0.03; sueloLejos.receiveShadow = true; g.add(sueloLejos); sueloLejos.userData.sinApunte = true;
    torres = ciudadAfuera(tipo === 'hotel' ? 36 : 26); g.add(torres.grupo);
  }

  let inicio = new THREE.Vector3(0, 0, 0), rumboInicio = Math.PI, musica = 'ciudad', salidaPos = null;
  const luces = [];
  const luz = (x, y, z, c = '#fff4dc', i = 18, d = 22) => { const L = new THREE.PointLight(c, i, d, 1.6); L.position.set(x, y, z); g.add(L); luces.push(L); return L; };
  let ascensor = null;

  if (tipo === 'hotel') {
    /* ============================== EL HOTEL ============================== */
    musica = 'ciudad';
    const PISOS = [0, 24, 48], NOMBRES = ['asc_pb', 'asc_suite', 'asc_azotea'];
    const piso0 = new THREE.MeshStandardMaterial({ map: (() => { const q = texBaldosas('#ffffff', '#dff4ff', 4); q.repeat.set(7, 5); return q; })(), roughness: 0.12, metalness: 0.05 });
    /* ---- el lobby (y = 0), la salida al sur (+z) ---- */
    sala(-13, 13, -10, 10, 0, 7, { piso: piso0, ventanas: ['s', 'e'], hueco: { lado: 's', ancho: 3 } });
    salidaPos = new THREE.Vector3(0, 0, 8.6); inicio = new THREE.Vector3(0, 0.02, 5.6); rumboInicio = Math.PI;
    /* la puerta giratoria de la salida */
    const giratoria = new THREE.Group(); giratoria.position.set(0, 0, 10); g.add(giratoria);
    poner(new THREE.CylinderGeometry(1.6, 1.6, 3, 24, 1, true), vidrio, 0, 1.5, 0, 0, giratoria).renderOrder = 3;
    for (let k = 0; k < 4; k++) { const hoja = poner(caja(0.06, 2.8, 1.5, 0.02), vidrio, 0, 1.4, 0, 0, giratoria); hoja.position.set(Math.sin(k * Math.PI / 2) * 0.75, 1.4, Math.cos(k * Math.PI / 2) * 0.75); hoja.rotation.y = k * Math.PI / 2; }
    poner(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 24), B('#ffffff'), 0, 3.1, 0, 0, giratoria);
    mundo.cilindro(0, 10.45, 1.7, -1, 3.2);
    vivos.push((tt) => { giratoria.children.forEach((q, i) => { if (i > 0 && i < 5) { const a = tt * 0.6 + (i - 1) * Math.PI / 2; q.position.set(Math.sin(a) * 0.75, 1.4, Math.cos(a) * 0.75); q.rotation.y = a; } }); });
    /* la recepción: un mostrador curvo con la tira que brilla, el timbre y Perla */
    const mostrador = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.15, 40, 1, true, -1.1, 2.2), B('#ffffff', { roughness: 0.15, side: THREE.DoubleSide }));
    mostrador.position.set(-8, 0.58, -3); mostrador.rotation.y = Math.PI / 2; g.add(mostrador);
    poner(new THREE.RingGeometry(2.75, 3.6, 40, 1, -1.1, 2.2).rotateX(-Math.PI / 2), B('#ffffff', { roughness: 0.1, side: THREE.DoubleSide }), -8, 1.16, -3);
    poner(new THREE.CylinderGeometry(3.62, 3.62, 0.08, 40, 1, true, Math.PI / 2 - 1.1, 2.2), B('#43d8cd', { emissive: '#1fb0ea', emissiveIntensity: 0.6, side: THREE.DoubleSide }), -8, 1.12, -3);
    for (const a of [-0.9, -0.3, 0.3, 0.9]) mundo.cilindro(-8 + Math.cos(a) * 3.4, -3 + Math.sin(a) * 3.4, 0.5, -1, 1.15);
    const timbre = new THREE.Group(); timbre.userData.fundir = true; timbre.position.set(-8 + Math.cos(0.25) * 3.15, 1.17, -3 + Math.sin(0.25) * 3.15); g.add(timbre);
    poner(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 20), B('#ffd23f', { metalness: 1, roughness: 0.15 }), 0, 0.02, 0, 0, timbre);
    poner(new THREE.SphereGeometry(0.14, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), B('#ffd23f', { metalness: 1, roughness: 0.1 }), 0, 0.04, 0, 0, timbre);
    usar(timbre, () => t('int_timbre'), (J) => { J.sfx('guino'); J.sfx('gota', { k: 8 }); J.hablarCon && J.hablarCon('recepcion'); }, 3.2);
    npcs.push({ id: 'recepcion', pos: [-6.1, -3], rot: Math.PI / 2, y: 0 });
    /* la columna acuario en el medio, de piso a techo */
    const acuario = new THREE.Group(); acuario.position.set(0, 0, 1.5); g.add(acuario);
    poner(new THREE.CylinderGeometry(1.7, 1.9, 0.6, 32), B('#ffffff'), 0, 0.3, 0, 0, acuario);
    poner(new THREE.CylinderGeometry(1.7, 1.9, 0.6, 32), B('#ffffff'), 0, 6.7, 0, 0, acuario);
    const agua = poner(new THREE.CylinderGeometry(1.55, 1.55, 5.8, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: '#39d6ff', roughness: 0.05, transparent: true, opacity: 0.35, emissive: '#0a8fc0', emissiveIntensity: 0.35, side: THREE.DoubleSide, depthWrite: false }), 0, 3.5, 0, 0, acuario); agua.renderOrder = 3;
    const cardu = new Cardumen(g, new THREE.Vector3(0, 3.5, 1.5), { radio: 0.6, n: 14, alto: 2.4, largo: 0.28 });
    for (const q of cardu.p) q.o.multiplyScalar(0.25);
    vivos.push((tt, dt) => { cardu.vel += (Math.sign(cardu.vel) * 0.25 - cardu.vel) * Math.min(1, dt * 0.8); cardu.actualizar(dt); });
    const burbA = new Burbujas(g, [[0, 0.7, 1.5, 1.8, 0]], { n: 24, alto: 5.8, tam: [0.05, 0.16] });
    vivos.push((tt, dt) => burbA.actualizar(dt, null));
    usar(agua, () => t('int_peces'), (J) => { cardu.vel = -Math.sign(cardu.vel || 1) * 1.6; J.sfx('burbuja'); });
    mundo.cilindro(0, 1.5, 1.9, -1, 7);
    /* los sillones, la mesa ratona y las plantas */
    muebles('m-sofa', 8, 0, -1.5, -Math.PI / 2, { ancho: 3.2 }); muebles('m-sofa', 8, 0, 4, -Math.PI / 2, { ancho: 3.2 }); muebles('m-sillon', 5, 0, 1.2, Math.PI / 2, { alto: 1.4 });
    for (const [x, z] of [[8, -1.5], [8, 4]]) { mundo.caja(x, z, 0.6, 1.6, -1, 0.55); }
    const mesa = poner(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 32), vidrio, 7.2, 0.5, 1.2); mesa.renderOrder = 3; poner(new THREE.CylinderGeometry(0.08, 0.3, 0.5, 12), B('#ffffff'), 7.2, 0.25, 1.2);
    for (const [x, z] of [[-12, -9], [12, -9], [-12, 9], [12, 9], [4, -9]]) { poner(new THREE.CylinderGeometry(0.5, 0.4, 0.8, 20), B('#ffffff'), x, 0.4, z); for (let k = 0; k < 6; k++) poner(new THREE.SphereGeometry(0.45 - k * 0.04, 14, 10), B(k % 2 ? '#3fb536' : '#56e05a', { roughness: 0.4 }), x + Math.cos(k * 2.3) * 0.3, 1.1 + k * 0.32, z + Math.sin(k * 2.3) * 0.3); mundo.cilindro(x, z, 0.55, -1, 0.8); }
    /* la araña de burbujas del techo */
    const arana = new THREE.Group(); arana.position.set(0, 5.6, 1.5); g.add(arana);
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2, rr = 2.4 + (k % 3) * 0.5, b = poner(new THREE.SphereGeometry(0.22 + (k % 2) * 0.1, 16, 12), materialBurbuja(1), Math.cos(a) * rr, -0.3 - (k % 4) * 0.25, Math.sin(a) * rr, 0, arana); b.renderOrder = 3; poner(new THREE.CylinderGeometry(0.008, 0.008, 1.4, 4), B('#e8eef4'), Math.cos(a) * rr, 0.4, Math.sin(a) * rr, 0, arana); }
    fundirDentro(arana); vivos.push((tt) => { arana.rotation.y = tt * 0.1; });
    /* el piano blanco */
    const piano = new THREE.Group(); piano.userData.fundir = true; piano.position.set(9, 0, -7.2); piano.rotation.y = -0.4; g.add(piano);
    poner(caja(2, 1, 1.4, 0.1), B('#ffffff', { roughness: 0.08 }), 0, 0.6, 0, 0, piano); poner(caja(2, 0.06, 0.3, 0.02), B('#fafafa'), 0, 1.02, 0.7, 0, piano);
    for (let k = 0; k < 10; k++) poner(caja(0.08, 0.05, 0.18, 0.01), B('#22262b'), -0.85 + k * 0.19, 1.07, 0.66, 0, piano);
    poner(caja(1.9, 0.9, 0.08, 0.04), B('#ffffff', { roughness: 0.08 }), 0, 1.5, -0.6, 0, piano);
    mundo.caja(9, -7.2, 1.1, 0.8, -1, 1.1, -0.4);
    let nota = 0;
    usar(piano, () => t('int_piano'), (J) => { const esc = [0, 2, 4, 5, 7, 9, 11, 12]; J.sfx('letra', { f: 440 * Math.pow(2, esc[nota % 8] / 12) }); J.sfx('gota', { k: nota % 8 }); nota++; chispas.soltar(new THREE.Vector3(9, 1.8, -6.8), 8, 1.5); });
    /* la pantalla de noticias en la pared oeste, con el texto que corre */
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const cg = cv.getContext('2d'); const txN = new THREE.CanvasTexture(cv); txN.colorSpace = THREE.SRGBColorSpace;
    const pant = poner(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: txN, toneMapped: false }), -12.88, 4.4, 3, Math.PI / 2);
    poner(caja(0.12, 1.8, 6.3, 0.06), B('#ffffff'), -12.97, 4.4, 3);
    let dx = 0; const texto = t('noticias');
    vivos.push((tt, dt) => { dx -= dt * 90; cg.fillStyle = '#0f5f9f'; cg.fillRect(0, 0, 1024, 256); const gr = cg.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 1024, 256); cg.font = '800 80px "Nunito","Segoe UI",sans-serif'; cg.fillStyle = '#ffffff'; cg.textBaseline = 'middle'; const w = cg.measureText(texto).width; if (dx < -w) dx += w; cg.fillText(texto + texto, dx, 128); txN.needsUpdate = true; });
    usar(pant, () => t('int_pantalla'), (J) => { dx -= 300; J.sfx('aviso'); }, 6);
    /* el carrito de valijas */
    poner(caja(1.4, 0.1, 0.8, 0.04), B('#ffd23f', { metalness: 1, roughness: 0.2 }), -3, 0.35, -8.4); for (const s of [-1, 1]) poner(new THREE.TorusGeometry(0.7, 0.04, 6, 20, Math.PI), B('#ffd23f', { metalness: 1, roughness: 0.2 }), -3 + s * 0.65, 0.4, -8.4, Math.PI / 2);
    for (const [c, h, x] of [['#ff6fb0', 0.6, -3.3], ['#39d6ff', 0.8, -2.8]]) poner(caja(0.45, h, 0.6, 0.1), B(c), x, 0.4 + h / 2, -8.4);
    luz(0, 6, 1.5, '#fff4dc', 30, 26); luz(-8, 5, -3, '#dff4ff', 12, 14);
    const cartelH = letrero('HOTEL AERO', { ancho: 5.5, alto: 1.1, tinta: '#1a78c2', borde: '#7fd3ff' }); cartelH.position.set(-8, 4.5, -9.9); g.add(cartelH);

    /* ---- la suite del piso 12 (y = 24): ventanal al sur y al este ---- */
    const Y1 = PISOS[1], madera = new THREE.MeshStandardMaterial({ map: (() => { const q = texMadera(); q.repeat.set(6, 5); return q; })(), roughness: 0.4 });
    const papel = new THREE.MeshStandardMaterial({ map: (() => { const q = lienzo(256, 256, (c, W) => { const gr = c.createLinearGradient(0, 0, 0, W); gr.addColorStop(0, '#e9fbff'); gr.addColorStop(1, '#c8f0f7'); c.fillStyle = gr; c.fillRect(0, 0, W, W); for (let k = 0; k < 14; k++) { const x = (k * 97) % W, y = (k * 61) % W, rr2 = 10 + (k % 4) * 7; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, rr2, 0, 7); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x - rr2 * 0.3, y - rr2 * 0.3, rr2 * 0.3, 0, 7); c.fill(); } }); q.wrapS = q.wrapT = THREE.RepeatWrapping; q.repeat.set(6, 1); return q; })(), roughness: 0.6 });
    sala(-13, 13, -10, 10, Y1, 4.2, { piso: madera, pared: papel, ventanas: ['s', 'e'], sinPiso: true });
    pisoConHueco(Y1, null, madera);
    const cama = muebles('m-cama', -8, Y1, -5.5, 0, { ancho: 3.2 }); mundo.caja(-8, -5.5, 1.2, 1.5, Y1 - 1, Y1 + 0.55);
    const tele = muebles('m-tele', -8, Y1, 3.5, Math.PI, { ancho: 2.4 }); mundo.caja(-8, 3.5, 1.2, 0.35, Y1 - 1, Y1 + 0.8);
    const pantT = tele.userData.pantalla, matOff = new THREE.MeshStandardMaterial({ color: '#1a2230', roughness: 0.1 }), matOn = pantT ? pantT.material : null;
    let teleOn = true;
    const cvT = document.createElement('canvas'); cvT.width = 256; cvT.height = 160; const ctT = cvT.getContext('2d'); const txT = new THREE.CanvasTexture(cvT); txT.colorSpace = THREE.SRGBColorSpace;
    const matTV = new THREE.MeshBasicMaterial({ map: txT, toneMapped: false }); if (pantT) pantT.material = matTV;
    vivos.push((tt) => { if (!teleOn || !pantT) return; ctT.fillStyle = `hsl(${(tt * 30) % 360},80%,70%)`; ctT.fillRect(0, 0, 256, 160); for (let i = 0; i < 7; i++) { const a = tt * (0.5 + i * 0.13) + i, x = 128 + Math.cos(a) * (40 + i * 10), y = 80 + Math.sin(a * 1.3) * 40; ctT.strokeStyle = 'rgba(255,255,255,0.9)'; ctT.lineWidth = 4; ctT.beginPath(); ctT.arc(x, y, 10 + i * 3, 0, 7); ctT.stroke(); } txT.needsUpdate = true; });
    usar(tele, () => t(teleOn ? 'int_tele_no' : 'int_tele_si'), (J) => { teleOn = !teleOn; if (pantT) pantT.material = teleOn ? matTV : matOff; J.sfx('elegir'); });
    const lampara = muebles('m-lampara', -11, Y1, -8.5, 0, { alto: 1.8 }); const luzL = luz(-11, Y1 + 1.8, -8.5, '#ffe9c2', 14, 12);
    usar(lampara, () => t('int_luz'), (J) => { luzL.intensity = luzL.intensity > 0 ? 0 : 14; J.sfx('elegir'); });
    muebles('m-sofa', 7, Y1, -4, 0, { ancho: 3.4 }); mundo.caja(7, -4, 1.7, 0.6, Y1 - 1, Y1 + 0.55);
    muebles('m-sillon', 10.5, Y1, 0, -Math.PI / 2, { alto: 1.4 });
    /* la heladera del minibar: se abre y da un jugo */
    const hel = new THREE.Group(); hel.position.set(11.8, Y1, -8.6); g.add(hel);
    poner(caja(1, 1.8, 0.9, 0.12), B('#e8f4ff', { roughness: 0.15 }), 0, 0.9, 0, 0, hel);
    const puertaH = new THREE.Group(); puertaH.position.set(-0.5, 0, 0.46); hel.add(puertaH); poner(caja(1, 1.75, 0.08, 0.06), B('#ffffff', { roughness: 0.1 }), 0.5, 0.9, 0, 0, puertaH); poner(caja(0.05, 0.6, 0.06, 0.02), B('#b8c4ce', { metalness: 0.8 }), 0.9, 1.1, 0.06, 0, puertaH);
    mundo.caja(11.8, -8.6, 0.55, 0.5, Y1 - 1, Y1 + 1.8);
    let abierta = 0;
    usar(hel, () => t('int_heladera'), (J) => { abierta = 2.5; J.sfx('guino'); J.avisar(t('int_jugo'), 'bien'); J.efecto && J.efecto('liviano'); });
    vivos.push((tt, dt) => { abierta = Math.max(0, abierta - dt); puertaH.rotation.y += ((abierta > 0 ? -1.6 : 0) - puertaH.rotation.y) * Math.min(1, dt * 6); });
    /* el jacuzzi redondo con burbujas */
    const jac = new THREE.Group(); jac.userData.fundir = true; jac.position.set(-9.5, Y1, 6.8); g.add(jac);
    poner(new THREE.CylinderGeometry(1.8, 1.9, 0.7, 32, 1, true), B('#ffffff', { side: THREE.DoubleSide }), 0, 0.35, 0, 0, jac);
    poner(new THREE.TorusGeometry(1.8, 0.12, 8, 40).rotateX(Math.PI / 2), B('#ffffff'), 0, 0.7, 0, 0, jac);
    poner(new THREE.CircleGeometry(1.75, 32).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#5fe0ff', roughness: 0.05, transparent: true, opacity: 0.75, emissive: '#1fb0ea', emissiveIntensity: 0.3 }), 0, 0.55, 0, 0, jac);
    mundo.cilindro(-9.5, 6.8, 1.9, Y1 - 1, Y1 + 0.7);
    const burbJ = new Burbujas(g, [[-9.5, Y1 + 0.5, 6.8, 2.8, 0]], { n: 40, alto: 2.2, tam: [0.05, 0.2] }); let jacOn = 0;
    vivos.push((tt, dt) => { jacOn = Math.max(0, jacOn - dt); burbJ.im.visible = jacOn > 0; if (jacOn > 0) burbJ.actualizar(dt, null); });
    usar(jac, () => t('int_jacuzzi'), (J) => { jacOn = 20; J.sfx('burbuja'); });
    luz(0, Y1 + 3.6, 0, '#fff4dc', 20, 24);
    /* la alfombra redonda, la mesita de vidrio y el aro de luz del techo */
    poner(new THREE.CircleGeometry(2.6, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: lienzo(256, 256, (c, W) => { for (let k = 6; k > 0; k--) { c.fillStyle = k % 2 ? '#7fe0ea' : '#e9fbff'; c.beginPath(); c.arc(W / 2, W / 2, W / 2 * k / 6, 0, 7); c.fill(); } }), roughness: 0.9 }), 7, Y1 + 0.012, -1.2).castShadow = false;
    const mesita = poner(new THREE.CylinderGeometry(0.8, 0.8, 0.07, 32), vidrio, 7, Y1 + 0.45, -1.2); mesita.renderOrder = 3; poner(new THREE.CylinderGeometry(0.07, 0.25, 0.44, 12), B('#ffffff'), 7, Y1 + 0.22, -1.2);
    poner(new THREE.SphereGeometry(0.16, 16, 12), B('#ff6fb0', { roughness: 0.1 }), 7.2, Y1 + 0.6, -1.1); poner(new THREE.SphereGeometry(0.12, 16, 12), B('#ffe14a', { roughness: 0.1 }), 6.8, Y1 + 0.57, -1.3);
    mundo.cilindro(7, -1.2, 0.8, Y1 - 1, Y1 + 0.5);
    poner(new THREE.TorusGeometry(1.6, 0.07, 10, 48).rotateX(Math.PI / 2), B('#fff6dc', { emissive: '#fff1c2', emissiveIntensity: 1.4 }), 0, Y1 + 4.05, 0);
    /* los cuadros sobre la cama: un atardecer, una aurora y un pez */
    const cuadro = (x, z, ry, dibujo) => { const f = new THREE.Group(); f.position.set(x, Y1 + 2.5, z); f.rotation.y = ry; g.add(f); poner(caja(1.5, 1.1, 0.06, 0.03), B('#ffffff'), 0, 0, 0, 0, f); const p = poner(new THREE.PlaneGeometry(1.3, 0.9), new THREE.MeshBasicMaterial({ map: lienzo(260, 180, dibujo) }), 0, 0, 0.035, 0, f); p.castShadow = false; };
    cuadro(-9.6, -9.9, 0, (c, W, H) => { const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ff9ad8'); gr.addColorStop(0.6, '#ffd27a'); gr.addColorStop(1, '#39d6ff'); c.fillStyle = gr; c.fillRect(0, 0, W, H); c.fillStyle = '#fff6c2'; c.beginPath(); c.arc(W / 2, H * 0.62, 34, 0, 7); c.fill(); });
    cuadro(-6.4, -9.9, 0, (c, W, H) => { c.fillStyle = '#0d2a5c'; c.fillRect(0, 0, W, H); for (let k = 0; k < 3; k++) { c.strokeStyle = ['#56e0a0', '#39d6ff', '#b58cff'][k]; c.lineWidth = 16; c.globalAlpha = 0.7; c.beginPath(); c.moveTo(0, 60 + k * 22); c.bezierCurveTo(80, 10 + k * 20, 170, 110 + k * 10, W, 40 + k * 20); c.stroke(); } c.globalAlpha = 1; c.fillStyle = '#fff'; for (let k = 0; k < 30; k++) c.fillRect((k * 53) % W, (k * 29) % H, 2, 2); });
    cuadro(-12.93, -3.2, Math.PI / 2, (c, W, H) => { c.fillStyle = '#39d6ff'; c.fillRect(0, 0, W, H); c.fillStyle = '#ff8a3d'; c.beginPath(); c.ellipse(W / 2, H / 2, 60, 34, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(W / 2 + 50, H / 2); c.lineTo(W / 2 + 95, H / 2 - 30); c.lineTo(W / 2 + 95, H / 2 + 30); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(W / 2 - 30, H / 2 - 6, 9, 0, 7); c.fill(); });
    /* el escritorio con la compu Aero: la pantalla cambia de fondo y trae un mensaje */
    const esc = new THREE.Group(); esc.userData.fundir = true; esc.position.set(4.2, Y1, -9.2); g.add(esc);
    poner(caja(2.4, 0.08, 0.9, 0.03), B('#ffffff', { roughness: 0.15 }), 0, 0.86, 0, 0, esc); for (const sx of [-1.1, 1.1]) poner(caja(0.08, 0.86, 0.8, 0.03), B('#ffffff'), sx, 0.43, 0, 0, esc);
    poner(caja(1.3, 0.85, 0.07, 0.05), B('#e8eef4', { metalness: 0.6, roughness: 0.2 }), 0, 1.5, -0.2, 0, esc); poner(new THREE.CylinderGeometry(0.06, 0.2, 0.55, 12), B('#e8eef4', { metalness: 0.6 }), 0, 1.1, -0.25, 0, esc);
    const cvP = document.createElement('canvas'); cvP.width = 320; cvP.height = 200; const cp = cvP.getContext('2d'), txP = new THREE.CanvasTexture(cvP); txP.colorSpace = THREE.SRGBColorSpace;
    let fondo = 0;
    const pintarPC = () => {
      const F = [['#1fa2ff', '#12d8fa', '#a6ffcb'], ['#ff9ad8', '#ffd27a', '#fff6c2'], ['#0d2a5c', '#3a7bd5', '#56e0a0']][fondo % 3];
      const gr = cp.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, F[0]); gr.addColorStop(0.6, F[1]); gr.addColorStop(1, F[2]); cp.fillStyle = gr; cp.fillRect(0, 0, 320, 200);
      cp.fillStyle = '#56e05a'; cp.beginPath(); cp.ellipse(160, 230, 260, 90, 0, 0, 7); cp.fill();
      const o = cp.createRadialGradient(150, 70, 4, 160, 80, 40); o.addColorStop(0, '#ffffff'); o.addColorStop(1, 'rgba(255,255,255,0.1)'); cp.fillStyle = o; cp.beginPath(); cp.arc(160, 80, 38, 0, 7); cp.fill();
      cp.fillStyle = 'rgba(255,255,255,0.85)'; cp.fillRect(0, 180, 320, 20); cp.fillStyle = '#2aa9e0'; cp.beginPath(); cp.arc(14, 190, 8, 0, 7); cp.fill();
      cp.font = '700 13px "Nunito",sans-serif'; cp.fillStyle = '#1a5f8f'; cp.fillText('AeroOS', 28, 195); txP.needsUpdate = true;
    };
    pintarPC();
    const pantPC = poner(new THREE.PlaneGeometry(1.18, 0.74), new THREE.MeshBasicMaterial({ map: txP, toneMapped: false }), 0, 1.5, -0.16, 0, esc); pantPC.castShadow = false;
    poner(caja(0.8, 0.03, 0.28, 0.01), B('#ffffff'), 0, 0.92, 0.2, 0, esc);
    mundo.caja(4.2, -9.2, 1.2, 0.45, Y1 - 1, Y1 + 0.9);
    usar(esc, () => t('int_pc'), (J) => { fondo++; pintarPC(); J.sfx('guino'); if (fondo === 1) J.avisar(t('int_mail'), 'azul'); });
    /* las cortinas de las ventanas, que se mecen un poco */
    const cortina = B('#ffffff', { roughness: 0.8, transparent: true, opacity: 0.85, side: THREE.DoubleSide, borde: 0 });
    const cortinas = [[-12.3, 9.75, 0], [12.75, 9.3, -Math.PI / 2], [12.75, -9.3, -Math.PI / 2]].map(([x, z, ry]) => poner(new THREE.PlaneGeometry(1.2, 4, 6, 1), cortina, x, Y1 + 2.05, z, ry)); for (const q of cortinas) q.userData.vivo = true;
    vivos.push((tt) => cortinas.forEach((q, i) => { q.rotation.z = Math.sin(tt * 0.8 + i) * 0.015; q.scale.x = 1 + Math.sin(tt * 1.3 + i * 2) * 0.05; }));

    /* ---- la azotea (y = 48): al aire libre, con pileta, bar y telescopio ---- */
    const Y2 = PISOS[2];
    const pisoAz = new THREE.MeshStandardMaterial({ map: (() => { const q = texBaldosas('#ffffff', '#e6f7ff', 4); q.repeat.set(13, 10); return q; })(), roughness: 0.3 });
    pisoConHueco(Y2, [3, 9, -1, 5], pisoAz);
    /* la baranda de vidrio del borde */
    for (const [x, z, w, d] of [[0, -10, 26, 0.1], [0, 10, 26, 0.1], [-13, 0, 0.1, 20], [13, 0, 0.1, 20]]) { const v = poner(caja(w, 1.2, d, 0.02), vidrio, x, Y2 + 0.6, z); v.renderOrder = 3; poner(caja(Math.max(w, 0.14), 0.1, Math.max(d, 0.14), 0.04), B('#ffffff'), x, Y2 + 1.22, z); mundo.caja(x, z, w / 2 + 0.1, d / 2 + 0.15, Y2 - 1, Y2 + 5); }
    /* la pileta: agua que brilla, poco honda (0,4 m: se sale caminando) */
    const azulejo = new THREE.MeshStandardMaterial({ map: (() => { const q = texBaldosas('#bdf1ff', '#9fe6ff', 8); q.repeat.set(2, 2); return q; })(), roughness: 0.2, side: THREE.DoubleSide });
    poner(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), azulejo, 6, Y2 - 0.4, 2).castShadow = false;
    for (const [x, z, ry] of [[6, -1, 0], [6, 5, Math.PI], [3, 2, Math.PI / 2], [9, 2, -Math.PI / 2]]) poner(new THREE.PlaneGeometry(6, 0.4), azulejo, x, Y2 - 0.2, z, ry).castShadow = false;
    for (const [x, z, w, d] of [[6, -1.1, 6.4, 0.22], [6, 5.1, 6.4, 0.22], [2.9, 2, 0.22, 6], [9.1, 2, 0.22, 6]]) poner(caja(w, 0.1, d, 0.04), B('#ffffff', { roughness: 0.15 }), x, Y2 + 0.04, z);
    const aguaP = poner(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, uniforms: { uT: UNI.uT }, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'uniform float uT; varying vec2 vU; void main(){ vec2 q = vU * 9.0; float c = pow(abs(sin(q.x + sin(q.y + uT) * 1.4) * sin(q.y * 1.1 + sin(q.x * 0.8 - uT * 0.9) * 1.3)), 5.0); vec3 col = mix(vec3(0.2, 0.75, 1.0), vec3(0.85, 1.0, 1.0), c * 0.8); gl_FragColor = vec4(col, 0.72); }' }), 6, Y2 - 0.1, 2);
    aguaP.castShadow = false;
    mundo.caja(6, 2, 3, 3, Y2 - 1, Y2 - 0.4);
    for (const [x, z] of [[-2, 6], [-4.5, 6], [-7, 6]]) { const q = muebles('reposera', x, Y2, z, Math.PI, { alto: 0.9 }); mundo.caja(x, z, 0.4, 0.9, Y2 - 1, Y2 + 0.4); }
    for (const [x, z] of [[-3.2, 7.5], [-8, 7.5]]) { muebles('sombrilla', x, Y2, z, 0, { alto: 3 }); mundo.cilindro(x, z, 0.1, Y2, Y2 + 2.6); }
    for (const [x, z] of [[-11.5, -8], [11.5, 8.5], [11.5, -8]]) { poner(new THREE.CylinderGeometry(0.7, 0.55, 0.9, 20), B('#ffffff'), x, Y2 + 0.45, z); muebles('palmera', x, Y2 + 0.9, z, r() * 6, { alto: 4.5 }); mundo.cilindro(x, z, 0.7, Y2 - 1, Y2 + 0.9); }
    /* el bar de licuados */
    const bar = new THREE.Group(); bar.userData.fundir = true; bar.position.set(-7.5, Y2, -6.5); g.add(bar);
    poner(new THREE.CylinderGeometry(1.8, 1.8, 1.1, 32, 1, false, 0, Math.PI), B('#ffffff', { roughness: 0.15 }), 0, 0.55, 0, 0, bar);
    poner(new THREE.CylinderGeometry(1.85, 1.85, 0.08, 32, 1, false, 0, Math.PI), B('#ff6fb0'), 0, 1.12, 0, 0, bar);
    for (const [c, x] of [['#ff6fb0', -0.8], ['#ffe14a', -0.3], ['#56e05a', 0.3]]) { poner(new THREE.CylinderGeometry(0.1, 0.08, 0.3, 12), B(c), x, 1.3, 1.2, 0, bar); }
    mundo.cilindro(-7.5, -6.5, 1.8, Y2 - 1, Y2 + 1.1);
    usar(bar, () => t('int_bar'), (J) => { J.sfx('hongo'); J.avisar(t('int_licuado'), 'bien'); chispas.soltar(new THREE.Vector3(-7.5, Y2 + 1.6, -6.5), 12, 2); });
    /* el telescopio: al mirar, la cámara se cierra (menos campo) un rato */
    const tel = new THREE.Group(); tel.userData.fundir = true; tel.position.set(11, Y2, 0); tel.rotation.y = -Math.PI / 2; g.add(tel);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2, p = poner(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), B('#b8c4ce', { metalness: 0.8 }), Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3, 0, tel); p.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); }
    const tubo = poner(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 20), B('#1d8fd8', { roughness: 0.15 }), 0, 1.35, 0, 0, tel); tubo.rotation.x = -1.1;
    mundo.cilindro(11, 0, 0.4, Y2 - 1, Y2 + 1.2);
    usar(tel, () => t('int_telescopio'), (J) => { J.zoom && J.zoom(5); J.sfx('guino'); });
    /* la fuente redonda con burbujas y los canteros de flores del borde */
    const fu = muebles('fuente', -6.5, Y2, 1, 0, { ancho: 3.6 }); mundo.cilindro(-6.5, 1, 1.8, Y2 - 1, Y2 + (fu.userData.borde || 0.6));
    const burbF = new Burbujas(g, [[-6.5, Y2 + 0.8, 1, 1.2, 0]], { n: 20, alto: 5, tam: [0.08, 0.3] }); vivos.push((tt, dt) => burbF.actualizar(dt, null));
    for (const [x, z, w, d] of [[-8, 9.3, 7, 0.9], [7, -9.3, 8, 0.9], [12.3, 4, 0.9, 4]]) {
      poner(caja(w, 0.6, d, 0.12), B('#ffffff'), x, Y2 + 0.3, z); mundo.caja(x, z, w / 2, d / 2, Y2 - 1, Y2 + 0.6);
      for (let k = 0; k < Math.max(w, d) * 1.4; k++) { const u = (k + 0.5) / (Math.max(w, d) * 1.4) - 0.5, fx = x + (w > d ? u * w : 0), fz = z + (w > d ? 0 : u * d); poner(new THREE.SphereGeometry(0.22 + (k % 3) * 0.06, 10, 8), B(['#ff6fb0', '#ffe14a', '#ffffff', '#b58cff'][k % 4], { roughness: 0.4 }), fx, Y2 + 0.72 + (k % 2) * 0.1, fz); poner(new THREE.SphereGeometry(0.3, 8, 6), B('#56e05a', { roughness: 0.5 }), fx + 0.15, Y2 + 0.62, fz + 0.1); }
    }
    /* guirnalda de luces */
    for (let i = 0; i < 24; i++) { const u = i / 23, x = -12 + u * 24, y = Y2 + 3.2 - Math.sin(u * Math.PI) * 0.8; poner(new THREE.SphereGeometry(0.1, 8, 6), B('#fff1c2', { emissive: '#ffd98a', emissiveIntensity: 1.5 }), x, y, -9.6); }
    for (const s of [-1, 1]) { poner(new THREE.CylinderGeometry(0.06, 0.06, 3.3, 8), B('#ffffff'), s * 12.3, Y2 + 1.65, -9.6); }

    /* ---- el ascensor de vidrio: sube por el fondo (x = 0, z de -10 a -6,8) ---- */
    ascensor = armarAscensor(PISOS, NOMBRES);
    /* el edificio por fuera (desde la azotea se ve la fachada): una caja sin tapas que desde adentro no se ve */
    const texF = lienzo(128, 128, (c, W) => { c.fillStyle = '#e8f7ff'; c.fillRect(0, 0, W, W); c.fillStyle = '#5fb8f0'; c.fillRect(8, 10, W - 16, W - 26); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(8, 10, W - 16, 10); });
    texF.wrapS = texF.wrapT = THREE.RepeatWrapping; texF.repeat.set(8, 16);
    const casco = new THREE.Mesh(new THREE.BoxGeometry(26.6, Y2 - 0.3, 20.6), new THREE.MeshStandardMaterial({ map: texF, roughness: 0.2, metalness: 0.2 }));
    casco.geometry.groups = casco.geometry.groups.filter((q, i) => i !== 2 && i !== 3); casco.position.y = (Y2 - 0.3) / 2; casco.userData.sinApunte = true; g.add(casco);
  } else if (tipo === 'cafe') {
    /* ============================== EL CAFÉ ============================== */
    musica = 'titulo';
    const R = 8.5, H = 4.4, madera = new THREE.MeshStandardMaterial({ map: (() => { const q = texMadera(); q.repeat.set(5, 5); return q; })(), roughness: 0.45 });
    poner(new THREE.CircleGeometry(R, 8).rotateX(-Math.PI / 2).rotateY(Math.PI / 8), madera, 0, 0.001, 0).castShadow = false;
    poner(new THREE.CircleGeometry(R, 8).rotateX(Math.PI / 2).rotateY(Math.PI / 8), B('#ffffff', { roughness: 0.7, borde: 0 }), 0, H, 0).castShadow = false;
    for (let k = 0; k < 8; k++) {
      const a0 = k / 8 * Math.PI * 2 + Math.PI / 8, a1 = a0 + Math.PI / 4, x0 = Math.sin(a0) * R, z0 = Math.cos(a0) * R, x1 = Math.sin(a1) * R, z1 = Math.cos(a1) * R;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, L = Math.hypot(x1 - x0, z1 - z0), giro = Math.atan2(mx, mz) + Math.PI;
      if (k !== 7) { const v = poner(new THREE.PlaneGeometry(L, H), vidrio, mx, H / 2, mz, giro); v.renderOrder = 3; mundo.caja(mx, mz, L / 2, 0.25, -1, H, giro); }
      else { for (const s of [-1, 1]) mundo.caja(mx + Math.cos(giro) * s * L * 0.38, mz - Math.sin(giro) * s * L * 0.38, L * 0.12, 0.25, -1, H, giro); }
      poner(caja(0.2, H, 0.2, 0.05), B('#ffffff'), x0, H / 2, z0);
    }
    const Rc = R * Math.cos(Math.PI / 8);
    salidaPos = new THREE.Vector3(0, 0, Rc - 0.9); inicio = new THREE.Vector3(0, 0.02, Rc - 3.2); rumboInicio = Math.PI;
    mundo.caja(0, Rc - 0.05, 2.4, 0.2, -1, H);
    poner(caja(2.6, 2.5, 0.08, 0.3), B('#79c0e6'), 0, 1.25, Rc + 0.05);
    /* la barra con la cafetera cromada y Moka */
    const barra = new THREE.Group(); barra.position.set(0, 0, -5.2); g.add(barra);
    poner(caja(6, 1.1, 1.1, 0.2), B('#ffffff', { roughness: 0.15 }), 0, 0.55, 0, 0, barra); poner(caja(6.1, 0.1, 1.2, 0.05), madera, 0, 1.13, 0, 0, barra);
    poner(caja(6.05, 0.12, 1.15, 0.05), B('#43d8cd', { emissive: '#1fb0ea', emissiveIntensity: 0.4 }), 0, 0.3, 0, 0, barra);
    mundo.caja(0, -5.2, 3, 0.55, -1, 1.1);
    const maq = new THREE.Group(); maq.userData.fundir = true; maq.position.set(-1.6, 1.18, -5.3); g.add(maq);
    poner(caja(0.9, 0.7, 0.6, 0.12), B('#e8eef4', { metalness: 0.9, roughness: 0.15 }), 0, 0.35, 0, 0, maq); poner(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), B('#22262b'), -0.2, 0.05, 0.3, 0, maq); poner(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), B('#22262b'), 0.2, 0.05, 0.3, 0, maq);
    poner(new THREE.SphereGeometry(0.1, 12, 8), B('#ff4f6e', { emissive: '#ff2040', emissiveIntensity: 0.8 }), 0.3, 0.55, 0.31, 0, maq);
    const tazas = [];
    usar(maq, () => t('int_cafe'), (J) => {
      J.sfx('burbuja'); J.avisar(t('int_cafe_listo'), 'bien');
      const tz = new THREE.Group(); tz.position.set(-0.6 + tazas.length * 0.45, 1.18, -4.8); g.add(tz); tazas.push(tz);
      poner(new THREE.CylinderGeometry(0.12, 0.09, 0.16, 16), B('#ffffff'), 0, 0.08, 0, 0, tz); poner(new THREE.CircleGeometry(0.11, 16).rotateX(-Math.PI / 2), B('#c8905a'), 0, 0.155, 0, 0, tz);
      poner(new THREE.TorusGeometry(0.05, 0.015, 6, 12), B('#ffffff'), 0.14, 0.08, 0, 0, tz); if (tazas.length > 6) tazas.shift().removeFromParent();
      chispas.soltar(new THREE.Vector3(-1.6, 1.9, -5.3), 10, 1.2);
    }, 3.6);
    npcs.push({ id: 'barista', pos: [0.8, -6.3], rot: 0, y: 0 });
    /* el pizarrón del menú */
    const piz = poner(new THREE.PlaneGeometry(3.4, 1.8), new THREE.MeshStandardMaterial({ map: lienzo(512, 272, (c, W, Hh) => { c.fillStyle = '#23523a'; c.fillRect(0, 0, W, Hh); c.strokeStyle = '#e8d3a0'; c.lineWidth = 12; c.strokeRect(6, 6, W - 12, Hh - 12); c.fillStyle = '#fff'; c.font = '800 34px "Nunito",sans-serif'; c.fillText('MENÚ ☕', 30, 52); c.font = '700 26px "Nunito",sans-serif'; ['Café espuma ♥ ...... 3', 'Licuado burbuja ... 4', 'Medialuna aero ..... 2', 'Té de nube ........ 3'].forEach((l, i) => c.fillText(l, 30, 100 + i * 42)); }), roughness: 0.8 }), 0, 2.9, -7.7);
    piz.castShadow = false;
    /* las mesas redondas con sillas para sentarse */
    for (const [x, z] of [[-4.2, 0], [4.2, 0], [-2.5, 3.8], [2.5, 3.8]]) {
      poner(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 28), B('#ffffff', { roughness: 0.12 }), x, 0.78, z); poner(new THREE.CylinderGeometry(0.06, 0.35, 0.75, 12), B('#b8c4ce', { metalness: 0.7 }), x, 0.38, z);
      mundo.cilindro(x, z, 0.7, -1, 0.8);
      const flor = poner(new THREE.SphereGeometry(0.1, 10, 8), B('#ff6fb0'), x, 0.95, z); flor.userData.vivo = true;
      for (const a of [0, Math.PI]) {
        const sx = x + Math.cos(a + 0.5) * 1.1, sz = z + Math.sin(a + 0.5) * 1.1, silla = new THREE.Group(); silla.position.set(sx, 0, sz); silla.rotation.y = Math.atan2(x - sx, z - sz); g.add(silla);
        poner(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 20), B('#43d8cd'), 0, 0.48, 0, 0, silla); poner(caja(0.5, 0.5, 0.06, 0.04), B('#43d8cd'), 0, 0.78, -0.24, 0, silla); poner(new THREE.CylinderGeometry(0.04, 0.2, 0.45, 8), B('#b8c4ce', { metalness: 0.7 }), 0, 0.22, 0, 0, silla);
        usar(silla, () => t('int_sentarse'), (J) => J.sentarseEn && J.sentarseEn(new THREE.Vector3(sx, 0.02, sz), silla.rotation.y), 2.6);
      }
      vivos.push((tt) => { flor.rotation.y = tt; });
    }
    /* la rocola brillante que cambia la canción */
    const roc = new THREE.Group(); roc.position.set(6.2, 0, -3.6); roc.rotation.y = -0.9; g.add(roc);
    poner(caja(1.3, 1.8, 0.7, 0.3), B('#ff6fb0', { roughness: 0.15 }), 0, 0.9, 0, 0, roc);
    const arcoR = poner(new THREE.TorusGeometry(0.55, 0.08, 10, 30, Math.PI), B('#ffe14a', { emissive: '#ffb000', emissiveIntensity: 0.9 }), 0, 1.5, 0.36, 0, roc);
    poner(new THREE.CircleGeometry(0.45, 24), B('#8ff4ff', { emissive: '#3fd0ff', emissiveIntensity: 0.7 }), 0, 1.0, 0.36, 0, roc);
    mundo.caja(6.2, -3.6, 0.7, 0.4, -1, 1.8, -0.9);
    usar(roc, () => t('int_rocola'), (J) => { J.siguienteCancion && J.siguienteCancion(); J.sfx('elegir'); });
    vivos.push((tt) => { arcoR.material.emissiveIntensity = 0.6 + Math.sin(tt * 4) * 0.4; });
    /* plantas colgantes */
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, x = Math.sin(a) * 6, z = Math.cos(a) * 6; poner(new THREE.CylinderGeometry(0.01, 0.01, 1, 4), B('#e8eef4'), x, H - 0.5, z); poner(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), B('#ffffff'), x, H - 1, z); for (let j = 0; j < 5; j++) poner(new THREE.SphereGeometry(0.18, 10, 8), B(j % 2 ? '#3fb536' : '#56e05a'), x + Math.cos(j * 1.3) * 0.25, H - 1.05 - j * 0.12, z + Math.sin(j * 1.3) * 0.25); }
    luz(0, H - 0.6, 0, '#ffe9c2', 26, 22);
  } else {
    /* ============================== LA CASA DEL VECINO ============================== */
    musica = 'casa';
    const R = 6.4, H = 3.6;
    poner(new THREE.CircleGeometry(R, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: (() => { const q = texMadera(); q.repeat.set(4, 4); return q; })(), roughness: 0.45 }), 0, 0.001, 0).castShadow = false;
    poner(new THREE.CylinderGeometry(R, R, H, 48, 1, true), B('#fff8ef', { roughness: 0.7, borde: 0, side: THREE.BackSide }), 0, H / 2, 0).castShadow = false;
    poner(new THREE.SphereGeometry(R, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), B('#e6f7ff', { roughness: 0.6, borde: 0, side: THREE.BackSide }), 0, H, 0).castShadow = false;
    poner(new THREE.TorusGeometry(R - 0.02, 0.1, 6, 60).rotateX(Math.PI / 2), B('#43d8cd'), 0, 0.12, 0);
    for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3) continue; mundo.cilindro(Math.sin(a) * (R + 0.2), Math.cos(a) * (R + 0.2), 0.45, -1, H); }
    /* los ojos de buey: ventanitas redondas con el jardín atrás */
    for (let k = 0; k < 6; k++) { const a = (k + 0.5) / 6 * Math.PI * 2 + 0.3; const x = Math.sin(a) * (R - 0.03), z = Math.cos(a) * (R - 0.03); const ob = poner(new THREE.CircleGeometry(0.55, 28), new THREE.MeshBasicMaterial({ color: '#9fe8a8' }), x, 1.9, z, a + Math.PI); ob.castShadow = false; poner(new THREE.TorusGeometry(0.58, 0.07, 8, 30), B('#ffffff'), x, 1.9, z, a + Math.PI); }
    salidaPos = new THREE.Vector3(0, 0, R - 0.6); inicio = new THREE.Vector3(0, 0.02, R - 3); rumboInicio = Math.PI;
    mundo.caja(0, R - 0.1, 2.1, 0.2, -1, H);
    poner(caja(1.2, 2.2, 0.08, 0.3), B('#79c0e6'), 0, 1.1, R - 0.05);
    muebles('m-sofa', -3.2, 0, -1.8, 0.5, { ancho: 2.8 }); mundo.caja(-3.2, -1.8, 1.4, 0.5, -1, 0.55, 0.5);
    muebles('m-sillon', 2.8, 0, -3.4, -0.4, { alto: 1.3 });
    const tele = muebles('m-tele', -1, 0, -5.2, 0.15, { ancho: 1.8 });
    const pantT = tele.userData.pantalla, matOff = new THREE.MeshStandardMaterial({ color: '#1a2230' }); let teleOn = false; const matOn = pantT?.material;
    if (pantT) pantT.material = matOff;
    usar(tele, () => t(teleOn ? 'int_tele_no' : 'int_tele_si'), (J) => { teleOn = !teleOn; if (pantT) pantT.material = teleOn ? matOn : matOff; J.sfx('elegir'); });
    const lamp = muebles('m-lampara', 4.4, 0, 1.2, 0, { alto: 1.6 }); const luzL = luz(4.4, 1.6, 1.2, '#ffe9c2', 10, 10);
    usar(lamp, () => t('int_luz'), (J) => { luzL.intensity = luzL.intensity > 0 ? 0 : 10; J.sfx('elegir'); });
    /* la biblioteca con libros para leer */
    const bib = new THREE.Group(); bib.position.set(-4.6, 0, 3.4); bib.rotation.y = 2.2; g.add(bib);
    poner(caja(2.2, 2.4, 0.5, 0.08), B('#ffffff'), 0, 1.2, 0, 0, bib);
    for (let f = 0; f < 3; f++) for (let k = 0; k < 8; k++) poner(caja(0.2, 0.5 + (k % 3) * 0.08, 0.36, 0.03), B(['#ff6fb0', '#39d6ff', '#ffe14a', '#56e05a', '#9b7bff'][(k + f) % 5]), -0.8 + k * 0.23, 0.5 + f * 0.75, 0.1, 0, bib);
    mundo.caja(-4.6, 3.4, 1.1, 0.3, -1, 2.4, 2.2);
    let libro = 0;
    usar(bib, () => t('int_libro'), (J) => { J.leer && J.leer('📖', t('libro_' + (1 + libro % 3))); libro++; });
    const pz = pecera(3.8, 0, 3.6, 0.7); g.add(pz); vivos.push((tt) => pz.userData.actualizar(tt)); mundo.cilindro(3.8, 3.6, 0.8, -1, 1.2);
    /* el tocadiscos */
    const toc = new THREE.Group(); toc.position.set(1.6, 0, -5.4); g.add(toc);
    poner(caja(1, 0.8, 0.6, 0.08), B('#e9d7b4'), 0, 0.4, 0, 0, toc); const disco = poner(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 24), B('#22262b', { roughness: 0.2 }), 0, 0.82, 0, 0, toc);
    let gira = false; usar(toc, () => t('int_disco'), (J) => { gira = !gira; J.siguienteCancion && J.siguienteCancion(); J.sfx('elegir'); });
    vivos.push((tt, dt) => { if (gira) disco.rotation.y += dt * 3.5; });
    mundo.caja(1.6, -5.4, 0.5, 0.3, -1, 0.8);
    /* la cama y la heladera de la cocinita */
    muebles('m-cama', 3.6, 0, -0.6, -Math.PI / 2, { ancho: 2.6 }); mundo.caja(3.6, -0.6, 1.2, 0.8, -1, 0.5, -Math.PI / 2);
    const hel = new THREE.Group(); hel.position.set(-5.4, 0, -1.8); hel.rotation.y = 1.3; g.add(hel);
    poner(caja(0.9, 1.7, 0.8, 0.15), B('#bff0ff', { roughness: 0.15 }), 0, 0.85, 0, 0, hel);
    usar(hel, () => t('int_heladera'), (J) => { J.sfx('guino'); J.avisar(t('int_jugo'), 'bien'); J.efecto && J.efecto('liviano'); });
    npcs.push({ id: o.i === 2 ? 'vecino' : 'vecina', pos: [0.8, -2], rot: Math.PI, y: 0 });
    luz(0, H - 0.3, 0, '#fff4dc', 16, 16);
  }

  /* la salida: el lugar para salir (vuelve a la isla, delante de la puerta) */
  if (salidaPos) mundo.interactivo({ id: 'salida', pos: salidaPos, radio: 1.9, accion: 'salir_edificio', icono: '🚪' });

  /* el piso de un piso alto: sólido con el hueco del ascensor (y opcional, el de la pileta) */
  function pisoConHueco(y, pileta = null, mat = null) {
    const piezas = [[-13, 13, -6.7, 10], [-13, -1.7, -10, -6.7], [1.7, 13, -10, -6.7]], todas = [];
    for (const [x0, x1, z0, z1] of piezas) {
      if (pileta && x0 <= pileta[0] && x1 >= pileta[1] && z0 <= pileta[2] && z1 >= pileta[3]) {
        /* se parte alrededor de la pileta */
        const [px0, px1, pz0, pz1] = pileta;
        for (const q of [[x0, px0, z0, z1], [px1, x1, z0, z1], [px0, px1, z0, pz0], [px0, px1, pz1, z1]]) if (q[1] > q[0] && q[3] > q[2]) todas.push(q);
      } else todas.push([x0, x1, z0, z1]);
    }
    for (const [x0, x1, z0, z1] of todas) {
      mundo.caja((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2, y - 1, y);
      if (!mat) continue;
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2), P = geo.attributes.position, U = geo.attributes.uv;
      for (let i = 0; i < P.count; i++) U.setXY(i, (P.getX(i) + 13) / 26, 1 - (P.getZ(i) + 10) / 20);
      poner(geo, mat, 0, y + 0.001, 0).castShadow = false;
    }
    if (y > 0) poner(new THREE.PlaneGeometry(26, 20).rotateX(Math.PI / 2), B('#ffffff', { roughness: 0.7, borde: 0 }), 0, y - 0.3, 0).castShadow = false;
  }

  /* ------------------------------------------ el ascensor */
  function armarAscensor(PISOS, NOMBRES) {
    const A = { piso: 0, y: 0, destino: null, fase: 'abierta', puerta: 1, t: 0, desde: 0, hacia: 0, eventos: [] };
    const cab = new THREE.Group(); g.add(cab);
    const X = 0, Z = -8.35, M = 1.4;
    /* la cabina: piso, techo con luz, tres paredes de vidrio con marco, las puertas que se corren y el tablero */
    poner(caja(2.9, 0.2, 2.9, 0.06), B('#ffffff', { roughness: 0.15 }), X, -0.075, Z, 0, cab);
    poner(caja(2.9, 0.2, 2.9, 0.06), B('#ffffff', { roughness: 0.15 }), X, 3.0, Z, 0, cab);
    poner(new THREE.CircleGeometry(0.9, 24).rotateX(Math.PI / 2), B('#fff6dc', { emissive: '#fff1c2', emissiveIntensity: 1.2 }), X, 2.89, Z, 0, cab);
    for (const [x, z, w, d] of [[X - M, Z, 0.06, 2.8], [X + M, Z, 0.06, 2.8], [X, Z - M, 2.8, 0.06]]) { const v = poner(caja(w, 2.9, d, 0.02), vidrio, x, 1.45, z, 0, cab); v.renderOrder = 3; }
    for (const [x, z] of [[X - M, Z - M], [X + M, Z - M], [X - M, Z + M], [X + M, Z + M]]) poner(caja(0.12, 3.1, 0.12, 0.04), B('#ffffff'), x, 1.45, z, 0, cab);
    const hojas = [-1, 1].map((s) => { const h = poner(caja(1.3, 2.8, 0.06, 0.02), vidrio, X + s * 0.7, 1.4, Z + M, 0, cab); h.renderOrder = 3; poner(caja(0.08, 2.8, 0.08, 0.02), B('#43d8cd'), -s * 0.62, 0, 0.02, 0, h); return h; });
    /* el tablero: tres botones redondos que se prenden */
    const tab = new THREE.Group(); tab.position.set(X + M - 0.08, 1.35, Z + 0.5); tab.rotation.y = -Math.PI / 2; cab.add(tab);
    poner(caja(0.5, 0.95, 0.05, 0.04), B('#e8eef4', { metalness: 0.7, roughness: 0.2 }), 0, 0, 0, 0, tab);
    const botones = PISOS.map((_, k) => {
      const b = poner(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7fe6ff', emissiveIntensity: 0.3 }), 0, 0.3 - k * 0.28, 0.04, 0, tab);
      b.rotation.x = Math.PI / 2;
      usar(b, () => '⬆ ' + t(NOMBRES[k]), (J) => { if (A.fase === 'abierta' && k !== A.piso) { A.destino = k; J.sfx('elegir'); } }, 2.2);
      return b;
    });
    /* el piso de la cabina (te lleva) y la puerta (cerrada, no se sale) */
    const suelo = mundo.caja(X, Z, M, M, -1, 0);
    const trabaPuerta = mundo.caja(X, Z + M + 0.05, M, 0.06, 0, 3.2), techoCab = mundo.caja(X, Z, M, M, 2.95, 3.2);
    /* el hueco: paredes de vidrio de arriba a abajo y, en cada piso, la puerta de afuera con su botón */
    const hueco = new THREE.Mesh(new THREE.BoxGeometry(3.3, PISOS[PISOS.length - 1] + 4, 3.3), vidrio); hueco.position.set(X, (PISOS[PISOS.length - 1] + 4) / 2, Z); hueco.renderOrder = 3; hueco.geometry.groups = hueco.geometry.groups.filter((q, i) => i < 2 || i === 5); g.add(hueco);
    const HH = PISOS[PISOS.length - 1] + 4, marco = new THREE.Group();
    for (let y = 3; y < HH; y += 3) for (const [x, z, w, d] of [[X, Z - 1.65, 3.44, 0.1], [X, Z + 1.65, 3.44, 0.1], [X - 1.65, Z, 0.1, 3.3], [X + 1.65, Z, 0.1, 3.3]]) poner(new THREE.BoxGeometry(w, 0.1, d), B('#ffffff'), x, y, z, 0, marco);
    for (const [x, z] of [[X - 1.65, Z - 1.65], [X + 1.65, Z - 1.65], [X - 1.65, Z + 1.65], [X + 1.65, Z + 1.65]]) poner(new THREE.BoxGeometry(0.14, HH, 0.14), B('#ffffff'), x, HH / 2, z, 0, marco);
    g.add(fundir(marco));
    for (const s of [-1, 1]) mundo.caja(X + s * (M + 0.1), Z, 0.08, M + 0.3, -1, HH);
    mundo.caja(X, Z - M - 0.1, M + 0.2, 0.08, -1, HH);
    const afuera = PISOS.map((y, k) => {
      const traba = mundo.caja(X, Z + M + 0.35, M + 0.3, 0.12, y, y + 3);
      const llamar = new THREE.Group(); llamar.position.set(X + 2.1, y + 1.3, Z + M + 0.35); g.add(llamar);
      poner(caja(0.34, 0.5, 0.06, 0.04), B('#e8eef4', { metalness: 0.7 }), 0, 0, 0, 0, llamar);
      const bl = poner(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7fe6ff', emissiveIntensity: 0.3 }), 0, 0, 0.04, 0, llamar); bl.rotation.x = Math.PI / 2;
      usar(llamar, () => t('asc_llamar'), (J) => { if (A.fase === 'abierta' && A.piso !== k) { A.destino = k; J.sfx('elegir'); bl.material.emissiveIntensity = 1.5; } }, 2.6);
      /* el marco de la puerta de afuera */
      poner(caja(3.2, 0.2, 0.2, 0.06), B('#ffffff'), X, y + 3.05, Z + M + 0.35); for (const s of [-1, 1]) poner(caja(0.2, 3.1, 0.2, 0.06), B('#ffffff'), X + s * 1.6, y + 1.55, Z + M + 0.35);
      return { traba, bl };
    });
    A.antes = (dt, yo) => {
      const dentro = Math.abs(yo.p.x - X) < M && Math.abs(yo.p.z - Z) < M;
      if (A.fase === 'abierta' && A.destino != null && A.destino !== A.piso) { A.fase = 'cierra'; }
      if (A.fase === 'cierra') { A.puerta = Math.max(0, A.puerta - dt * 1.7); if (!A.puerta) { A.fase = 'viaja'; A.desde = A.y; A.hacia = PISOS[A.destino]; A.t = 0; A.dur = 2.2 + Math.abs(A.hacia - A.desde) / 14; A.eventos.push({ tipo: A.hacia > A.desde ? 'sube' : 'baja' }); } }
      else if (A.fase === 'viaja') {
        A.t = Math.min(1, A.t + dt / A.dur); const u = A.t * A.t * (3 - 2 * A.t), y = A.desde + (A.hacia - A.desde) * u, d = y - A.y; A.y = y;
        if (dentro && yo.p.y > y - d - 1 && yo.p.y < y - d + 1.5) { yo.p.y = Math.max(yo.p.y + d, y); yo.v.y = Math.max(yo.v.y, 0); }
        if (A.t >= 1) { A.piso = A.destino; A.destino = null; A.fase = 'abre'; A.eventos.push({ tipo: 'llega', n: NOMBRES[A.piso] }); for (const q of afuera) q.bl.material.emissiveIntensity = 0.3; }
      } else if (A.fase === 'abre') { A.puerta = Math.min(1, A.puerta + dt * 1.7); if (A.puerta >= 1) A.fase = 'abierta'; }
      suelo.y1 = A.y; suelo.y0 = A.y - 1; trabaPuerta.y0 = A.y; trabaPuerta.y1 = A.y + 3.2; techoCab.y0 = A.y + 2.95; techoCab.y1 = A.y + 3.2; trabaPuerta.fantasma = A.puerta > 0.7;
      afuera.forEach((q, k) => { q.traba.fantasma = A.piso === k && A.puerta > 0.7 && A.fase !== 'viaja'; });
      cab.position.y = A.y;
      hojas.forEach((h, i) => { const s = i ? 1 : -1; h.position.x = X + s * (0.7 + A.puerta * 0.62); });
      botones.forEach((b, k) => { b.material.emissiveIntensity = k === A.piso ? 1.4 : k === A.destino ? 1.0 : 0.3; });
    };
    return A;
  }

  for (const q of g.children) if (q.isGroup && q.userData.fundir) fundirDentro(q);
  /* lo que no se mueve ni se usa (paredes, zócalos, plantas, canteros…) va fundido: de ~420 dibujos a menos de la mitad */
  const fijos = g.children.filter((q) => q.isMesh && !q.isInstancedMesh && !q.userData.acc && !q.userData.vivo && !q.userData.sinApunte && !Array.isArray(q.material) && !q.material.transparent && !q.material.isShaderMaterial);
  if (fijos.length > 8) { const F = new THREE.Group(); for (const q of fijos) F.add(q); g.add(fundir(F)); }

  let tt = 0;
  return {
    id: 'interior', tipo, i: o.i || 0, mundo, grupo: g, inicio, rumboInicio, musica, interior: true, primeraPersona: true,
    cielo: { interior: true, nubes: 1 }, accionables: acc, npcs, discos: [], orbes: null, ascensor,
    salida: o.salida || null, rumboSalida: o.rumbo ?? 0,
    antesDelJugador(dt, yo) { tt += dt; if (ascensor) ascensor.antes(dt, yo); },
    actualizar(dt, jp, cielo) {
      for (const f of vivos) f(tt, dt, jp);
      chispas.actualizar(dt);
      /* de noche, la ciudad de afuera se ve más oscura (las ventanas brillan igual) */
      if (telon) { telon.material.color.setScalar(0.35 + cielo.dia * 0.65); for (const m of torres.mats) m.emissiveIntensity = (1 - cielo.dia) * 1.1; }
    },
  };
}
