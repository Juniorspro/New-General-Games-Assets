-- La fabrica de fondos: lo que cada uno se genero, y cuanto genero hoy.
--
-- LA IMAGEN SE GUARDA ACA Y NO EN EL NAVEGADOR. Un fondo hecho a pedido tarda
-- unos segundos y gasta cuota; si viviera en `localStorage` se perderia al
-- limpiar el navegador y no aparaceria al entrar desde el telefono, que es
-- justo donde se usa un fondo de pantalla.
--
-- SE GUARDA EN TEXTO (base64) Y NO EN BINARIO A PROPOSITO. D1 tiene un tope de
-- ~1 MB por fila; por eso el modelo que se usa devuelve JPEG y no PNG, que a
-- este tamano se pasaria. Si algun dia entra R2, esta columna se cambia por una
-- clave y no hay que tocar nada mas.
--
-- HAY UN TOPE DE CUANTOS SE GUARDAN (ver `TOPE_GUARDADOS`). Sin tope, una
-- persona sola puede llenar la base: no por mala fe, sino por probar ideas.
-- Cuando se pasa, se borra el mas viejo, que es lo que uno espera de una
-- carpeta de pruebas.
CREATE TABLE IF NOT EXISTS fondos_ia (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  idea    TEXT NOT NULL,             -- lo que pidio la persona, tal cual
  forma   TEXT NOT NULL,             -- telefono | escritorio | cuadrado
  imagen  TEXT NOT NULL,             -- JPEG en base64, sin el "data:"
  creado  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS fondos_ia_usuario ON fondos_ia(usuario, creado DESC);

-- El gasto del dia. Es una tabla y no una cuenta sobre `fondos_ia` porque lo
-- que hay que limitar es lo que se PIDE, no lo que se guarda: si contara los
-- guardados, borrar uno devolveria cuota y el limite no serviria de nada.
CREATE TABLE IF NOT EXISTS fondos_gasto (
  usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  dia     TEXT NOT NULL,             -- AAAA-MM-DD en UTC
  cuantos INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario, dia)
);
