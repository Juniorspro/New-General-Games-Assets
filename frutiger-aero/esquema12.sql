-- La cuota de quien publica apps pagas.
--
-- EL MODELO: el que quiere vender su app en esta tienda le paga una cuota
-- mensual al dueño del sitio. La plata de las VENTAS no pasa por aca: va del
-- que compra al que hizo la app, por fuera. Eso es a proposito y es lo que hace
-- que esto se pueda sostener: el sitio cobra por publicar, no intermedia plata
-- ajena. Manejar la plata de otro es otra cosa completamente distinta —hay que
-- devolver, hay que responder por lo que no llega, y las pasarelas lo tratan
-- como pagos a terceros—.
--
-- `editor_hasta` es una FECHA y no un si/no. Un booleano "es editor" hay que
-- apagarlo a mano cuando vence, o sea que alguien se tiene que acordar todos
-- los meses; con una fecha, vencer es que pase el tiempo y no hay nada que
-- recordar.
ALTER TABLE usuarios ADD COLUMN editor_hasta INTEGER NOT NULL DEFAULT 0;

-- Que la app cobre, y cuanto. `precio` es TEXTO porque lo escribe una persona
-- ("US$ 3", "gratis con anuncios") y acá no se hace ninguna cuenta con eso: es
-- para que el que baja sepa con que se va a encontrar.
ALTER TABLE tienda ADD COLUMN paga INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tienda ADD COLUMN precio TEXT NOT NULL DEFAULT '';

-- Cada pago de cuota, uno por fila.
--
-- `ref` ES UNICA Y ESE ES EL PUNTO DEL ARCHIVO. Extender una suscripcion NO es
-- idempotente: si alguien recarga la pagina despues de pagar, PayPal contesta
-- con la misma orden ya capturada y el codigo la volveria a sumar. Treinta dias
-- por recarga. Con `ref` unica, el segundo intento no inserta nada, y solo se
-- extiende cuando la insercion de verdad agrego una fila.
CREATE TABLE IF NOT EXISTS cuotas (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  medio   TEXT NOT NULL,              -- paypal | mano
  ref     TEXT NOT NULL UNIQUE,       -- numero de orden, o lo que puso el jefe
  monto   REAL NOT NULL DEFAULT 0,
  moneda  TEXT NOT NULL DEFAULT 'USD',
  desde   INTEGER NOT NULL,
  hasta   INTEGER NOT NULL,
  creado  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cuotas_usuario ON cuotas(usuario, creado DESC);
