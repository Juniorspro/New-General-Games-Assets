-- La tienda deja de vivir en el codigo y pasa a la base.
--
-- POR QUE: el catalogo estaba escrito adentro de aeromas.js, asi que agregar
-- una app era editar codigo y desplegar. O sea: el dueño del sitio no podia
-- publicar nada sin que otro le tocara el repositorio. Una tienda que solo
-- puede cargar el que programa no es una tienda, es una lista.
--
-- DOS FORMAS DE GUARDAR EL ARCHIVO, Y NO SON LO MISMO:
--
--   `archivo`  el archivo vive en /apps/ de este sitio y pasa por la puerta de
--              functions/apps/: sin un pase valido contesta 403. Es lo unico
--              que de verdad queda para los que colaboraron.
--
--   `enlace`   el archivo vive afuera (MediaFire, Drive, lo que sea). Es comodo
--              porque se carga sin desplegar nada, pero ES PUBLICO: cualquiera
--              con el link lo baja, tenga cuenta o no. La pantalla lo dice con
--              todas las letras al cargarlo, porque es una decision de quien
--              publica y no un detalle tecnico que se pueda esconder.
--
-- Se usa uno o el otro. Si estan los dos, manda `archivo`, que es el que
-- protege.
CREATE TABLE IF NOT EXISTS tienda (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre   TEXT NOT NULL,
  version  TEXT NOT NULL DEFAULT '',
  que      TEXT NOT NULL DEFAULT '',
  para     TEXT NOT NULL DEFAULT '',
  peso     TEXT NOT NULL DEFAULT '',
  archivo  TEXT NOT NULL DEFAULT '',
  enlace   TEXT NOT NULL DEFAULT '',
  icono    TEXT NOT NULL DEFAULT '',
  permisos TEXT NOT NULL DEFAULT '',   -- uno por linea
  aviso    TEXT NOT NULL DEFAULT '',
  orden    INTEGER NOT NULL DEFAULT 0,
  creado   INTEGER NOT NULL,
  tocado   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tienda_orden ON tienda(orden, id);

-- El launcher que ya estaba en el codigo, para no perderlo en la mudanza.
-- El WHERE NOT EXISTS es para que correr este archivo dos veces no lo duplique.
INSERT INTO tienda (nombre, version, que, para, peso, archivo, icono, permisos, aviso, orden, creado, tocado)
SELECT 'Aero Launcher', 'beta 39',
  'El escritorio de Frutiger Aero, pero de verdad: reemplaza la pantalla de inicio de tu telefono Android.',
  'Android', '2,2 MB', 'aero-launcher-39.apk', 'img/zona/app-launcher.webp',
  'Accesibilidad — para poder bloquear la pantalla y abrir apps' || char(10) ||
  'Notificaciones — para mostrarlas en el escritorio' || char(10) ||
  'Camara — para el fondo en vivo' || char(10) ||
  'Desinstalar apps — para el boton de quitar del menu',
  'Esta en beta y la hago yo. Android te va a avisar que viene de fuera de Play Store: es normal cuando el que la hizo te la pasa directo.',
  0, 1757000000000, 1757000000000
WHERE NOT EXISTS (SELECT 1 FROM tienda WHERE archivo = 'aero-launcher-39.apk');
