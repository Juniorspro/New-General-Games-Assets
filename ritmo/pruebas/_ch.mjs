// Contador compartido: cada prueba lo importa y reporta igual.
let ok = 0, mal = 0;
export const ch = (n, c, d = "") => {
  c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
    : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`));
};
export const cerrar = () => { console.log(`\n  ${ok}/${ok + mal}`); process.exit(mal ? 1 : 0); };
