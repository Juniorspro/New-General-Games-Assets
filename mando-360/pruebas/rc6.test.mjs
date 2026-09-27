// Prueba del protocolo: cada botón se codifica a µs y se decodifica de
// vuelta; tiene que dar el mismo número. También revisa la cabecera y que el
// bit de rastreo se invierta.
import { BOTONES, TOGGLE, patron, decodificar, T } from "./rc6.mjs";

let fallas = 0;
const ver = (ok, s) => { console.log((ok ? "✓ " : "✗ ") + s); if (!ok) fallas++; };

// Ida y vuelta de cada botón.
for (const [nombre, valor] of Object.entries(BOTONES)) {
  const pat = patron(valor);
  const vuelta = decodificar(pat);
  ver(vuelta === valor, `${nombre.padEnd(11)} 0x${valor.toString(16)} → ${pat.length} tramos → 0x${vuelta === null ? "null" : vuelta.toString(16)}`);
}

// La cabecera: primer tramo 6t (marca), segundo 2t (espacio).
{
  const pat = patron(BOTONES.a);
  ver(Math.abs(pat[0] - 6 * T) < 20 && Math.abs(pat[1] - 2 * T) < 20, `cabecera 6t/2t (${pat[0]}/${pat[1]} µs)`);
}

// El bit de rastreo invertido también decodifica, y a otro valor.
{
  const conToggle = BOTONES.a ^ TOGGLE;
  ver(decodificar(patron(conToggle)) === conToggle, "con el toggle invertido, ida y vuelta OK");
  ver(conToggle !== BOTONES.a, "el toggle cambia el valor enviado");
}

// El patrón siempre empieza y termina en marca (cantidad par de tramos + guarda impar).
{
  const pat = patron(BOTONES.guia);
  ver(pat.length % 2 === 1, `cantidad impar de tramos (${pat.length}): arranca y termina en marca`);
  ver(pat.every((v) => v > 0 && v < 10000), "todos los tramos entre 0 y 10 ms");
}

console.log(fallas ? `\n✗ ${fallas} fallas` : "\n✓ todo bien");
process.exit(fallas ? 1 : 0);
