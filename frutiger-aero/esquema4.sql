-- 1. El administrador es una CUENTA, no una contrasenia compartida.
--    Escribir la misma clave en cada pantalla es como tener una llave suelta:
--    no se sabe quien entro, no se puede sacar el acceso a uno solo, y si se
--    filtra hay que cambiarla para todos. Con una cuenta marcada, se entra con
--    el mismo usuario y contrasenia que todo el mundo y se sabe quien hizo que.
ALTER TABLE usuarios ADD COLUMN jefe INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN correo TEXT DEFAULT '';

-- 2. El comprobante: la imagen vive en R2 y aca queda su nombre.
ALTER TABLE reclamos ADD COLUMN imagen TEXT DEFAULT '';
ALTER TABLE reclamos ADD COLUMN quien_vio INTEGER;

-- 3. Los avisos. Aprobar tiene que NOTIFICAR, no esperar a que la persona
--    vuelva a mirar por las dudas.
CREATE TABLE IF NOT EXISTS avisos (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto   TEXT NOT NULL,
  tipo    TEXT NOT NULL DEFAULT 'info',   -- info | bueno | malo
  leido   INTEGER NOT NULL DEFAULT 0,
  creado  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS aviso_usuario ON avisos(usuario, leido, creado DESC);
