-- Los pagos, para que no se pierda ninguno.
--
-- EL AGUJERO QUE TAPA: hasta ahora el acceso se daba cuando el que pagaba
-- VOLVIA al sitio con el identificador en la direccion. Si cerraba la pestania,
-- se le cortaba el 4G o Mercado Pago tardaba en devolverlo, pagaba y no recibia
-- nada. Y del lado de aca no quedaba ni rastro de que habia pagado.
--
-- Ahora la pasarela avisa por su cuenta (webhook) y el pago queda anotado
-- ANTES de que la persona vuelva. Si vuelve, ya esta; si no vuelve, el acceso
-- la espera la proxima vez que entre con su cuenta.

CREATE TABLE IF NOT EXISTS pagos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  medio     TEXT NOT NULL,             -- 'mp' o 'paypal'
  ref       TEXT NOT NULL,             -- el identificador de la pasarela
  usuario   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  monto     REAL NOT NULL,
  moneda    TEXT NOT NULL,
  estado    TEXT NOT NULL,
  creado    INTEGER NOT NULL,
  UNIQUE(medio, ref)                   -- el aviso puede llegar dos veces
);
CREATE INDEX IF NOT EXISTS pago_usuario ON pagos(usuario, creado DESC);

-- quien tiene acceso anticipado, para no recalcularlo en cada carga
ALTER TABLE usuarios ADD COLUMN acceso INTEGER NOT NULL DEFAULT 0;
