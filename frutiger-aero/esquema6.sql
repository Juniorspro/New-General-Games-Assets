-- Dos puertas mas, y ninguna que dependa de tener 18 anios.
--
-- LLAVES DE ACCESO (passkeys). No hay tercero: el navegador guarda una clave
-- privada en el telefono o en la computadora, este sitio guarda la publica, y
-- entrar es firmar un numero al azar con la huella o la cara. No hay consola de
-- nadie que registrar, no hay secreto que se pueda filtrar, y no hay
-- contrasenia que robar: lo que guardamos aca no sirve para entrar.
CREATE TABLE IF NOT EXISTS llaves (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cred     TEXT NOT NULL UNIQUE,      -- id de la credencial, base64url
  clave    TEXT NOT NULL,             -- la clave PUBLICA, en SPKI base64
  alg      INTEGER NOT NULL,          -- -7 = ECDSA P-256, -257 = RSA
  contador INTEGER NOT NULL DEFAULT 0,
  nombre   TEXT DEFAULT '',           -- «iPhone de Tomás», para poder borrarla
  creado   INTEGER NOT NULL,
  usado    INTEGER
);
CREATE INDEX IF NOT EXISTS llaves_usuario ON llaves(usuario);

-- El identificador que el autenticador guarda junto a la llave. Es al azar y no
-- es el numero de fila: si fuera el id, el telefono de cualquiera guardaria
-- «sos el usuario 7 de este sitio», que es contar de mas sin necesidad.
ALTER TABLE usuarios ADD COLUMN handle TEXT DEFAULT '';

-- ENTRAR CON DISCORD. Se guarda el id de la cuenta, que no cambia nunca; el
-- nombre de usuario de Discord si se puede cambiar, asi que no sirve de ancla.
ALTER TABLE usuarios ADD COLUMN discord TEXT DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_discord ON usuarios(discord) WHERE discord <> '';
