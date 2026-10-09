-- porteo: el arranque de la versión web. Primero la capa del navegador (porteo_web.lua: lo que la
-- versión de Android tiene en su LÖVE propio y en LuaJIT), después el main.lua del juego, que el
-- empaquetado deja como balatro_main.lua, y al final los retoques sobre el juego ya cargado
-- (porteo_despues.lua), antes de que LÖVE llame a love.load.
require 'porteo_web'
require 'balatro_main'
require 'porteo_despues'
