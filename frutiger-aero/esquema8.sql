-- Quien esta mirando el sitio, y cuanto se queda.
--
-- UNA FILA POR VISITA, no por persona. El que entra sin cuenta no tiene un
-- "quien" que mostrar: es un desconocido, y lo unico honesto es contarlo. Por
-- eso la columna se llama `visitas` y no `personas`, y la pantalla dice
-- "visitas" y no "personas unicas": llamarlo distinto seria inventar una
-- precision que el dato no tiene.
--
-- NO SE GUARDA LA IP. Distinguir a un desconocido por su IP es guardar un dato
-- personal —en Argentina, Ley 25.326— y no agrega nada que el numero no diga.
-- Lo que identifica una visita es un numero al azar que vive en la pestaña y
-- se muere al cerrarla.
--
-- `ultimo` se pisa cada tanto mientras la pestaña esta a la vista. El tiempo
-- adentro es `ultimo - inicio`, asi que una pestaña abierta y olvidada suma
-- hasta que deja de avisar, y no para siempre.
CREATE TABLE IF NOT EXISTS visitas (
  id      TEXT PRIMARY KEY,          -- al azar, de la pestaña
  usuario INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  inicio  INTEGER NOT NULL,
  ultimo  INTEGER NOT NULL,
  vistas  INTEGER NOT NULL DEFAULT 1,
  movil   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS visitas_ultimo ON visitas(ultimo DESC);
CREATE INDEX IF NOT EXISTS visitas_usuario ON visitas(usuario, ultimo DESC);
