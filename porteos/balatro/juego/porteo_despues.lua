-- porteo: retoques sobre el juego ya cargado (corre después del main.lua de Balatro y antes de
-- love.load).

-- El cartel de error. El del juego (love.errhand) se queda en un bucle propio hasta que se cierra la
-- ventana: en el navegador eso cuelga la pestaña sin mostrar nada. Este es como el de LÖVE 11:
-- devuelve una función que se llama una vez por cuadro. Cuenta el error en la consola, que la página
-- manda al registro.
function love.errhand(msg)
	msg = tostring(msg)
	local traza = debug.traceback('', 2)
	print('porteo: error: ' .. msg .. '\n' .. traza)
	if not love.window or not love.graphics or not love.event then return end
	if not love.graphics.isCreated() or not love.window.isOpen() then
		if not pcall(love.window.setMode, 800, 600) then return end
	end
	if love.mouse then
		love.mouse.setVisible(true)
		love.mouse.setGrabbed(false)
		love.mouse.setRelativeMode(false)
	end
	if love.audio then love.audio.stop() end
	love.graphics.reset()
	local ok, fuente = pcall(love.graphics.setNewFont, 'resources/fonts/m6x11plus.ttf', 22)
	if not ok then love.graphics.setNewFont(18) end
	local texto = 'Se rompió algo / Something went wrong:\n\n' .. msg .. '\n' .. traza:gsub('\t', '  ')
	return function()
		love.event.pump()
		for e in love.event.poll() do
			if e == 'quit' then return 1 end
		end
		love.graphics.origin()
		love.graphics.clear(0.13, 0.17, 0.2)
		love.graphics.setColor(1, 1, 1)
		love.graphics.printf(texto, 30, 30, love.graphics.getWidth() - 60)
		love.graphics.present()
	end
end
love.errorhandler = love.errhand

-- Medir: cuánto tarda por cuadro la lógica y el dibujo, cada 30 s (cada 5 si la página deja
-- /porteo/medir). Va a la consola y la página lo manda al registro: así se ve qué frena en el
-- teléfono del dueño, el Lua (sin JIT acá) o la GPU
do
	local f = io.open('/porteo/medir', 'r')
	local cada = f and 5 or 30
	if f then f:close() end
	local actualizar, dibujar = love.update, love.draw
	local tu, td, n, desde = 0, 0, 0, love.timer.getTime()
	love.update = function(dt)
		local t = love.timer.getTime()
		actualizar(dt)
		tu = tu + love.timer.getTime() - t
	end
	love.draw = function()
		local t = love.timer.getTime()
		dibujar()
		td = td + love.timer.getTime() - t
		n = n + 1
		local ahora = love.timer.getTime()
		if ahora - desde >= cada then
			print(string.format('porteo: %.1f cuadros/s · update %.2f ms · draw %.2f ms · memoria Lua %.1f MB',
				n / (ahora - desde), 1000 * tu / n, 1000 * td / n, collectgarbage('count') / 1024))
			tu, td, n, desde = 0, 0, 0, ahora
		end
	end
end

-- Los idiomas. La versión web no trae las fuentes chinas, japonesa, coreana ni las Go Noto (61 MB de
-- los 104 del APK): esos idiomas salen de la lista. Y la primera vez, el del navegador (la página lo
-- deja en /porteo/idioma.txt, fuera de lo que ve love.filesystem), no inglés.
local IDIOMAS = { es = 'es_419', ['es-es'] = 'es_ES', pt = 'pt_BR', fr = 'fr', de = 'de', it = 'it', nl = 'nl',
	pl = 'pl', ru = 'ru', id = 'id', en = 'en-us' }

local function idiomaDelNavegador()
	local f = io.open('/porteo/idioma.txt', 'r')
	if not f then return nil end
	local t = f:read('*a')
	f:close()
	if not t or t == '' then return nil end
	t = t:lower():gsub('%s', ''):gsub('_', '-')
	return IDIOMAS[t] or IDIOMAS[t:match('^(%a+)') or '']
end

local poner_idioma = Game.set_language
function Game:set_language()
	if not self.LANGUAGES and not love.filesystem.getInfo('settings.jkr') and not G.porteo_idioma then
		G.porteo_idioma = true
		local i = idiomaDelNavegador()
		if i then G.SETTINGS.language = i end
	end
	poner_idioma(self)
	for k, v in pairs(self.LANGUAGES) do
		if not v.omit and type(v.font) == 'table' and not v.font.FONT then self.LANGUAGES[k] = nil end
	end
	if not self.LANGUAGES[G.SETTINGS.language] then
		G.SETTINGS.language = 'en-us'
		self.LANG = self.LANGUAGES['en-us']
	end
end
