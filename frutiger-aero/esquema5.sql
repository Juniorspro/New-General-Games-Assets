-- Entrar con Google, sin que sea una segunda puerta a otro lado.
--
-- SE GUARDA EL `sub`, NO EL CORREO. El `sub` es el numero de la cuenta de
-- Google y no cambia nunca. El correo si: la gente lo cambia, y una direccion
-- de una empresa o de una escuela se reasigna a otra persona cuando el primero
-- se va. Atar el perfil al correo es dejar que el que herede la direccion
-- herede tambien el perfil, las publicaciones y el acceso pagado.
--
-- El correo se guarda igual, pero solo para mostrar de que cuenta se trata.
ALTER TABLE usuarios ADD COLUMN google TEXT DEFAULT '';

-- Una cuenta de Google entra a UN solo perfil. Sin esto, dos filas con el mismo
-- `sub` hacen que entrar con Google caiga en cualquiera de las dos segun el
-- orden que devuelva la base, que es la peor clase de error: intermitente.
-- El indice es parcial porque las cuentas con contrasenia tienen la columna
-- vacia y no se pisan entre ellas.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_google ON usuarios(google) WHERE google <> '';
