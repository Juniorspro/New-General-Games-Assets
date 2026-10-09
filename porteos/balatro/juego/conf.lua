-- porteo: la configuración de Balatro (balatro_conf.lua, el conf.lua del juego) con lo que cambia en
-- el navegador. Sin el módulo de hilos de LÖVE (porteo_web.lua pone uno con corrutinas: sin
-- SharedArrayBuffer, un hilo de verdad colgaba la página) ni el de video (la intro en video es sólo
-- de Apple Arcade).
require 'balatro_conf'

local conf_juego = love.conf
function love.conf(t)
	conf_juego(t)
	t.identity = 'balatro'
	t.modules.thread = false
	t.modules.video = false
	t.modules.physics = false
	-- la ventana sigue al lienzo de la página (ver modoWeb en porteo_web.lua)
	t.window.highdpi = true
	t.window.resizable = true
	t.window.fullscreen = false
end
