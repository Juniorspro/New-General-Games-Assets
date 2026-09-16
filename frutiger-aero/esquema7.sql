-- La zona de donantes: lo que se personaliza y no existia antes.
--
-- POR QUE COLUMNAS Y NO UN JSON SUELTO: son pocas y fijas, y cada una la lee
-- una consulta distinta —el muro necesita el marco y la insignia sin traerse el
-- resto—. Un JSON obliga a leerlo entero y a que cada lector sepa desarmarlo.
ALTER TABLE usuarios ADD COLUMN marco TEXT DEFAULT '';      -- el aro del retrato
ALTER TABLE usuarios ADD COLUMN banda TEXT DEFAULT '';      -- el fondo del perfil
ALTER TABLE usuarios ADD COLUMN lema  TEXT DEFAULT '';      -- una linea propia
ALTER TABLE usuarios ADD COLUMN tema  TEXT DEFAULT '';      -- su escritorio guardado

-- Cuando se instalo la zona, para saludar distinto la primera vez y para poder
-- contar cuantos la usan de verdad y no cuantos la tienen desbloqueada.
ALTER TABLE usuarios ADD COLUMN zona_desde INTEGER;
