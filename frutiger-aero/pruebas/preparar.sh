#!/bin/bash
# Deja la maquina lista para correr las pruebas. Es idempotente: correrlo dos
# veces no rompe nada.
#
# Hace tres cosas que si no hay que acordarse a mano, y olvidarse de cualquiera
# produce fallas que NO parecen lo que son: una base sin las columnas nuevas da
# 500 en /api/cuenta, y de ahi la pantalla se queda sin sesion y las pruebas
# fallan con "401" sin decir por que.
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
cd "$AQUI/.."

echo "== 1. el esquema completo, en orden =="
for f in esquema.sql esquema2.sql esquema3.sql esquema4.sql esquema5.sql esquema6.sql \
         esquema7.sql esquema8.sql esquema9.sql esquema10.sql esquema11.sql esquema12.sql; do
  [ -f "$f" ] || continue
  npx wrangler d1 execute frutiger-social --local --file="$f" >/dev/null 2>&1 \
    && echo "   $f" || echo "   $f  (ya estaba, o fallo: mirá a mano)"
done

echo "== 2. dos cuentas de prueba: 1 jefe, 2 donante comun =="
npx wrangler d1 execute frutiger-social --local --command \
"INSERT OR IGNORE INTO usuarios (id,usuario,nombre,clave,creado,acceso,jefe)
   VALUES (1,'probador','Probador','llave-sin-clave',1,1,1);
 INSERT OR IGNORE INTO usuarios (id,usuario,nombre,clave,creado,acceso,jefe)
   VALUES (2,'otro','Otro','llave-sin-clave',1,1,0);
 UPDATE usuarios SET acceso=1, jefe=1, bloqueado=0 WHERE id=1;
 UPDATE usuarios SET acceso=1, jefe=0, bloqueado=0 WHERE id=2;" >/dev/null 2>&1
echo "   listo"

echo "== 3. los pases firmados =="
python3 "$AQUI/pases.py"

echo
echo "Ahora, en otra terminal:   npx wrangler pages dev --port 8788 --local"
echo "Y despues:                 cd pruebas && node navegacion.mjs"
