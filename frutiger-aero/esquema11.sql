-- La tienda se parte en dos —lo del sitio y lo de la comunidad— y lo de la
-- comunidad se revisa antes de aparecer.
--
-- LA HUELLA (sha256) ES LO QUE HACE POSIBLE UNA REVISION HONESTA. Una app de
-- la comunidad se publica con un enlace a otro sitio, asi que nosotros NO
-- tenemos el archivo: revisar el enlace es revisar una pagina de descarga, no
-- el APK que hay atras. Mirar la pagina y decir "sin virus" seria dar una
-- seguridad que no se tiene, que es peor que no decir nada.
--
-- Por eso el que propone la app elige el APK en su maquina y el NAVEGADOR le
-- saca el sha256 sin subir nada. Con esa huella pasan dos cosas de verdad:
--   1. se le puede preguntar a un servicio de analisis por ESE archivo exacto;
--   2. cualquiera que lo baje puede sacarle el sha256 al suyo y comparar, asi
--      que si el enlace cambia por otro archivo, se nota.
-- Sin huella no hay revision posible, y la pantalla lo dice asi.
--
-- `escaneo` guarda el resultado en texto, incluido "no se pudo" y "no lo
-- conoce". Un campo que solo guardara los verdes convertiria la ausencia de
-- dato en un visto bueno.
ALTER TABLE tienda ADD COLUMN autor INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE tienda ADD COLUMN origen TEXT NOT NULL DEFAULT 'sitio';     -- sitio | comunidad
ALTER TABLE tienda ADD COLUMN estado TEXT NOT NULL DEFAULT 'aprobada';  -- pendiente | aprobada | rechazada
ALTER TABLE tienda ADD COLUMN motivo TEXT NOT NULL DEFAULT '';
ALTER TABLE tienda ADD COLUMN revisada INTEGER;
ALTER TABLE tienda ADD COLUMN huella TEXT NOT NULL DEFAULT '';          -- sha256 del APK
ALTER TABLE tienda ADD COLUMN escaneo TEXT NOT NULL DEFAULT '';
ALTER TABLE tienda ADD COLUMN escaneo_cuando INTEGER;
CREATE INDEX IF NOT EXISTS tienda_estado ON tienda(estado, origen, orden, id);
