-- Pedidos de acceso a revisar a mano.
--
-- POR QUE ESTO EXISTE: ninguna billetera que pueda usar un menor de edad en
-- Argentina entrega credenciales de cobro automatico. Mercado Pago abre cuentas
-- desde los 13 con permiso de un adulto y deja RECIBIR transferencias, pero no
-- vender: no hay Checkout Pro, no hay token, no hay webhook. Asi que la unica
-- verificacion posible en pesos es que una persona mire el comprobante.
--
-- Lo que si se puede es que esa revision cueste dos toques en vez de una
-- conversacion por WhatsApp: el que transfirio deja el numero de operacion aca,
-- queda en una cola, y de un boton se le habilita el acceso a SU CUENTA.

CREATE TABLE IF NOT EXISTS reclamos (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  medio    TEXT NOT NULL,              -- 'transferencia', 'paypal', 'otro'
  refer    TEXT NOT NULL,              -- numero de operacion o comprobante
  monto    TEXT DEFAULT '',
  nota     TEXT DEFAULT '',
  estado   TEXT NOT NULL DEFAULT 'espera',   -- espera | aprobado | rechazado
  creado   INTEGER NOT NULL,
  visto    INTEGER
);
CREATE INDEX IF NOT EXISTS rec_estado ON reclamos(estado, creado DESC);
-- un pedido en espera por persona: sin esto, insistir llena la cola
CREATE UNIQUE INDEX IF NOT EXISTS rec_uno ON reclamos(usuario) WHERE estado = 'espera';
