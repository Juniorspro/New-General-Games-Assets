// La camara de tercera persona.
//
// PERSIGUE, NO ESTA PEGADA. Una camara clavada detras del perro gira cuando el
// perro gira, y eso marea: el mundo entero barre la pantalla porque el bicho
// movio la cabeza. Persiguiendo con retraso, los giros chicos casi no la mueven
// y los grandes la arrastran despacio.
//
// Y SE PERSIGUE EL RUMBO DEL MOVIMIENTO, NO EL DEL PERRO. Son distintos justo
// cuando importa: el perro encara antes de arrancar, y si la camara sigue a su
// nariz, empieza a girar mientras el perro todavia esta parado.
import * as THREE from "../vendor/three.module.min.js";
import { M } from "./mundo.js";
import { altura } from "./terreno.js";

const OBJ = new THREE.Vector3(), MIRA = new THREE.Vector3();

export function armaCamara(cam) {
  let rumbo = 0, arranco = false;

  return {
    /** Hacia donde mira la camara, en el plano del piso.
     *
     *  LO NECESITA EL JOYSTICK. El dedo dice "arriba" y arriba en la pantalla
     *  es hacia donde mira la CAMARA, no el eje +Z del mundo. Tomando el eje
     *  del mundo, el control anda bien mientras no gires y se da vuelta en
     *  cuanto el perro encara para el otro lado: empujar arriba lo trae hacia
     *  vos. Es exactamente lo que se siente como "el joystick esta invertido". */
    rumbo: () => rumbo,
    /** @param dt segundos; @param p {x,y,z} del perro; @param rumboMov hacia
     *  donde va; @param andando si se esta moviendo */
    paso(dt, px, pz, rumboMov, andando) {
      if (!arranco) { rumbo = rumboMov; arranco = true; }
      if (andando) {
        // El angulo se interpola por el camino corto. Sin esto, pasar de +179
        // a -179 grados hace que la camara de una vuelta entera por el otro
        // lado — un solo cuadro, pero se ve como un latigazo.
        let d = rumboMov - rumbo;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        rumbo += d * Math.min(1, dt * 2.6);
      }

      const px2 = px - Math.sin(rumbo) * M.CAM_DIST;
      const pz2 = pz - Math.cos(rumbo) * M.CAM_DIST;
      const suelo = altura(px2, pz2);
      // LA CAMARA NO SE METE ADENTRO DE LA LOMA. Detras de una subida, el punto
      // donde le tocaria ir queda bajo tierra y se ve el interior del terreno.
      // Se la sube a lo que sea mas alto: su altura normal o el suelo de ahi.
      const y = Math.max(altura(px, pz) + M.CAM_ALTO, suelo + 1.5);
      OBJ.set(px2, y, pz2);

      const k = 1 - Math.exp(-M.CAM_SUAVE * dt);   // suavizado independiente
      cam.position.lerp(OBJ, k);                    // de los cuadros por segundo
      MIRA.set(px, altura(px, pz) + M.CAM_MIRA, pz);
      cam.lookAt(MIRA);
    },
    /** Para el menu: una vuelta lenta alrededor del perro.
     *  MIRA MAS ABAJO DEL PERRO A PROPOSITO: al apuntar por debajo, el perro
     *  sube en el cuadro y queda arriba de la tarjeta, que ocupa la mitad de
     *  abajo. Apuntandole al lomo quedaba justo detras del papel. */
    vitrina(t, px, pz) {
      const a = t * 0.22;
      // MAS LEJOS QUE EN PARTIDA, NO MAS CERCA. La primera version acercaba la
      // camara para "lucir" al perro y lo dejaba tapando la pantalla entera:
      // desde 6 unidades, un bicho de 1,35 de alto con lente de 58 grados no
      // entra en cuadro. Desde 11 entra entero y ademas se ve el campo, que es
      // la otra mitad de lo que el menu tiene para mostrar.
      const d = M.CAM_DIST * 1.35;
      const x = px - Math.sin(a) * d, z = pz - Math.cos(a) * d;
      cam.position.set(x, Math.max(altura(px, pz) + 3.1, altura(x, z) + 1.4), z);
      // y se apunta un poco por debajo del perro para que suba en el cuadro y
      // quede arriba de la tarjeta, que ocupa la mitad de abajo
      MIRA.set(px, altura(px, pz) - 0.55, pz);
      cam.lookAt(MIRA);
      rumbo = a; arranco = true;
    },
  };
}
