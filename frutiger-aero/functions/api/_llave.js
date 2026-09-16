/* Las cuentas de la criptografia de las llaves de acceso (passkeys).
 *
 * QUE ES UNA LLAVE DE ACCESO, en una linea: el telefono o la computadora
 * guardan una clave privada que nunca sale de ahi, este servidor guarda la
 * publica, y entrar es firmar un numero al azar. Lo que hay guardado aca NO
 * SIRVE PARA ENTRAR: si alguien se lleva esta base, no se lleva nada con lo que
 * pueda hacerse pasar por nadie. Con contrasenias, aunque esten bien guardadas,
 * siempre queda algo que se puede probar a la fuerza.
 *
 * LA CLAVE PUBLICA LA MANDA EL NAVEGADOR YA MASTICADA. El estandar la entrega
 * envuelta en CBOR dentro del «attestationObject», y desarmar eso a mano es
 * donde se cometen los errores. Pero desde hace anios el navegador ofrece
 * `getPublicKey()`, que devuelve la misma clave en el formato que entiende
 * WebCrypto. Se usa eso. No es confiar en el navegador: la clave publica no es
 * un secreto, y quien la registra solo puede perjudicarse a si mismo. Lo que
 * SI se comprueba, y es lo que importa, es la firma de cada entrada.
 */

const cod = new TextEncoder();

export const deB64u = (t) => {
  const s = String(t || "").replace(/-/g, "+").replace(/_/g, "/");
  const b = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
};
export const aB64u = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const sha = (b) => crypto.subtle.digest("SHA-256", b);

/* Una firma ECDSA sale del autenticador envuelta en ASN.1 («SEQUENCE de dos
   enteros»), y WebCrypto la quiere pelada: los dos numeros pegados, de 32 bytes
   cada uno. Sin esta traduccion NINGUNA firma da, y el sintoma es de los que
   hacen perder una tarde: no hay error, simplemente todas las entradas fallan.

   Los enteros de ASN.1 llevan un cero adelante cuando empiezan con el bit alto
   prendido, para no leerse como negativos. Ese cero hay que sacarlo. */
function firmaPelada(der) {
  if (der[0] !== 0x30) return der;               /* ya venia pelada */
  let i = 2;
  if (der[1] & 0x80) i += der[1] & 0x7f;         /* largo en formato largo */
  const leer = () => {
    if (der[i++] !== 0x02) return null;
    let n = der[i++];
    let v = der.slice(i, i + n);
    i += n;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);   /* el cero de signo */
    const p = new Uint8Array(32);
    p.set(v, 32 - v.length);                              /* o rellenar */
    return p;
  };
  const r = leer(), s = leer();
  if (!r || !s) return der;
  const out = new Uint8Array(64);
  out.set(r, 0); out.set(s, 32);
  return out;
}

const COMO = {
  "-7":    { imp: { name: "ECDSA", namedCurve: "P-256" }, ver: { name: "ECDSA", hash: "SHA-256" } },
  "-257":  { imp: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, ver: { name: "RSASSA-PKCS1-v1_5" } },
};

/* Lo que se firma es: los datos del autenticador, y pegado atras el resumen de
   lo que vio el navegador. Por eso no se puede reusar una firma de otro sitio:
   el origen viaja adentro de ese resumen. */
export async function firmaVale(spki, alg, authData, clientDataJSON, firma) {
  const c = COMO[String(alg)];
  if (!c) return false;
  const k = await crypto.subtle.importKey("spki", deB64u(spki), c.imp, false, ["verify"]);
  const resumen = new Uint8Array(await sha(clientDataJSON));
  const datos = new Uint8Array(authData.length + 32);
  datos.set(authData, 0); datos.set(resumen, authData.length);
  const f = alg === -7 ? firmaPelada(firma) : firma;
  return crypto.subtle.verify(c.ver, k, f, datos);
}

/* Los 37 bytes fijos del principio: de que sitio es, y en que estado estaba el
   autenticador. El resto (la credencial nueva) no hace falta leerlo. */
export function leerAuth(b) {
  return {
    rp: b.slice(0, 32),
    presente: !!(b[32] & 0x01),        /* alguien toco el aparato */
    verificado: !!(b[32] & 0x04),      /* ademas puso huella, cara o PIN */
    contador: (b[33] << 24 | b[34] << 16 | b[35] << 8 | b[36]) >>> 0,
  };
}

export const rpDe = (request) => new URL(request.url).hostname;

/* Que el sitio sea este, y no uno parecido. Es la comprobacion que evita que
   una copia del sitio en otra direccion pueda usar las llaves de esta. */
export async function sitioVale(request, authData) {
  const rp = rpDe(request);
  const esperado = new Uint8Array(await sha(cod.encode(rp)));
  const a = leerAuth(authData).rp;
  let d = 0;
  for (let i = 0; i < 32; i++) d |= a[i] ^ esperado[i];
  return d === 0;
}

/* El JSON que arma el navegador y que el autenticador firma sin poder tocarlo:
   dice para que era la firma, contra que numero y en que sitio. */
export function leerCliente(bytes, request, tipo) {
  let d;
  try { d = JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
  if (d.type !== tipo) return null;
  /* El origen esperado es EXACTAMENTE aquel por el que llegó este pedido, no
     uno escrito a mano: así no hay una lista que se olvide de actualizar el
     día que cambie el dominio, y el puerto entra en la comparación solo. */
  if (d.origin !== new URL(request.url).origin) return null;
  /* Cross-origin: la ceremonia tiene que pasar en la pagina, no dentro de un
     marco de otro sitio que la haya metido adentro sin que se vea. */
  if (d.crossOrigin) return null;
  try { d.reto = new TextDecoder().decode(deB64u(d.challenge)); } catch { return null; }
  return d;
}
