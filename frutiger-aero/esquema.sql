-- La base de lo social. Tres tablas y ninguna de mas.
--
-- LA CONTRASENIA NO SE GUARDA. Se guarda el resultado de pasarla 100.000 veces
-- por PBKDF2 con una sal distinta por persona. Si algun dia alguien se lleva
-- esta base, no se lleva las contrasenias: se lleva ruido que tardaria anios en
-- volverse util. Guardar el texto tal cual, o un md5, es regalar las
-- contrasenias que la gente repite en su correo y en su banco.

CREATE TABLE IF NOT EXISTS usuarios (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario   TEXT NOT NULL UNIQUE,      -- en minusculas, es la direccion del perfil
  nombre    TEXT NOT NULL,
  clave     TEXT NOT NULL,             -- pbkdf2$iteraciones$sal$hash
  retrato   TEXT,                      -- id de una pose, o una direccion
  sobre     TEXT DEFAULT '',
  cobro     TEXT DEFAULT '',           -- SU enlace de cobro, no el nuestro
  creado    INTEGER NOT NULL,
  bloqueado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS publicaciones (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  autor    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo   TEXT NOT NULL,
  cuerpo   TEXT NOT NULL,
  cobro    TEXT DEFAULT '',            -- a donde va el apoyo de ESTA publicacion
  meta     TEXT DEFAULT '',            -- que quiere hacer con la plata
  creado   INTEGER NOT NULL,
  oculto   INTEGER NOT NULL DEFAULT 0
);
-- el muro se lee siempre por fecha: sin este indice, cada carga recorre todo
CREATE INDEX IF NOT EXISTS pub_fecha ON publicaciones(oculto, creado DESC);
CREATE INDEX IF NOT EXISTS pub_autor ON publicaciones(autor, creado DESC);

CREATE TABLE IF NOT EXISTS apoyos (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  pub     INTEGER NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  quien   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  creado  INTEGER NOT NULL,
  UNIQUE(pub, quien)                   -- un apoyo por persona por publicacion
);
CREATE INDEX IF NOT EXISTS apoyo_pub ON apoyos(pub);
