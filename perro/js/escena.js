// La escena: luz, sombras, cielo y niebla.
import * as THREE from "../vendor/three.module.min.js";
import { M } from "./mundo.js";
import { armaTerreno } from "./terreno.js";
import { armaPasto, cuantasMatas } from "./pasto.js";
import { ruta } from "./assets.js";

export function armaEscena(lienzo) {
  const ren = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: false });
  // EL PIXEL RATIO SE TAPA EN 2. Un telefono moderno declara 3 o 3,5, y
  // dibujar a esa resolucion cuesta el triple de pixeles para una diferencia
  // que a treinta centimetros de la cara no se ve. Es el ajuste que mas
  // cuadros por segundo devuelve por linea escrita.
  ren.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  ren.shadowMap.enabled = true;
  ren.shadowMap.type = THREE.PCFSoftShadowMap;
  ren.outputColorSpace = THREE.SRGBColorSpace;
  ren.toneMapping = THREE.ACESFilmicToneMapping;
  ren.toneMappingExposure = 1.06;

  const esc = new THREE.Scene();
  // LA NIEBLA NO ES ADORNO: es lo que esconde el borde del campo. Sin ella se
  // ve donde termina el pasto y empieza el cielo, y el campo deja de parecer
  // grande. El color es el del horizonte del cielo para que funda parejo.
  // LA NIEBLA EMPIEZA DONDE SE TERMINA EL PASTO. Ahi esta el corte feo: de
  // golpe hay matas y de golpe hay solo terreno pintado. Entrando la niebla
  // justo en ese radio, el corte queda adentro del degrade y no se ve.
  esc.fog = new THREE.Fog(0xbcd3e6, M.PASTO_RADIO * 0.95, M.PASTO_RADIO * 3.6);

  const cam = new THREE.PerspectiveCamera(58, 1, 0.1, 620);

  /* --- luz --------------------------------------------------------------
     Tres luces y ninguna mas: sol, cielo y relleno. Cada luz extra multiplica
     el costo de cada pixel del pasto. */
  const sol = new THREE.DirectionalLight(0xfff2d6, 2.35);
  sol.position.set(48, 62, 26);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  // LA CAJA DE SOMBRA ES CHICA Y SIGUE AL PERRO. Una caja que cubra las 260
  // unidades del campo reparte los 2048 pixeles del mapa entre todo el campo y
  // la sombra del perro sale como un borron de escalones. Cubriendo 26
  // unidades alrededor del perro, esos mismos pixeles caen donde se mira.
  const S = 13;
  Object.assign(sol.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 190 });
  sol.shadow.bias = -0.0016;      // sin esto la sombra raya al propio perro
  sol.shadow.normalBias = 0.035;  // y sin esto se despega en las pendientes
  esc.add(sol, sol.target);

  // Cielo arriba, verde rebotado abajo: el pasto le devuelve luz a la panza del
  // perro y sin eso la parte de abajo queda negra y se ve recortado.
  esc.add(new THREE.HemisphereLight(0xbfe0ff, 0x4a6b2a, 1.15));
  const relleno = new THREE.DirectionalLight(0xdce8ff, 0.42);
  relleno.position.set(-40, 26, -34);
  esc.add(relleno);

  const terreno = armaTerreno();
  esc.add(terreno);

  const pasto = armaPasto(cuantasMatas());
  esc.add(pasto.malla);

  /* --- el cielo 360 -----------------------------------------------------
     La imagen equirectangular va de fondo de la escena. Se carga DESPUES de
     que el juego ya anda: hasta que llega, el fondo es el color del horizonte
     y no se ve ningun agujero. */
  esc.background = new THREE.Color(0xbcd3e6);
  const carga = new THREE.TextureLoader();
  carga.load(ruta("assets/cielo360.webp"), (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    esc.background = tex;
  }, undefined, () => { /* sin cielo se sigue viendo el color liso */ });

  function tamano() {
    const w = lienzo.clientWidth || innerWidth, h = lienzo.clientHeight || innerHeight;
    ren.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  addEventListener("resize", tamano);
  tamano();

  return { ren, esc, cam, sol, terreno, pasto, tamano };
}

/** Deja la caja de sombra centrada en el perro. Se llama una vez por cuadro. */
export function sigueSombra(sol, x, y, z) {
  sol.position.set(x + 48, y + 62, z + 26);
  sol.target.position.set(x, y, z);
  sol.target.updateMatrixWorld();
}
