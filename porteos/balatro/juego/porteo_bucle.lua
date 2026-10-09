-- porteo: el bucle de cuadros. Reemplaza el love.run de Balatro (main.lua): hace lo mismo que el del
-- juego (eventos, lógica, dibujo, recolector) y, en los teléfonos que no llegan a 60, corre la lógica
-- a 30 por segundo con la imagen a 60, interpolada. Ver porteos/balatro/LEEME.md, "Rendimiento".
--
-- Sin JIT (acá Lua 5.1 en WebAssembly; en Android, LuaJIT) la lógica de Balatro (G:update: los
-- eventos, el mando, mover y actualizar unos 470 objetos) cuesta más que el dibujo, y en un teléfono
-- las dos juntas no entran en los 16,7 ms de un cuadro. Los modos:
-- - "normal": como el juego, lógica y dibujo en cada cuadro. Si sobra (una computadora).
-- - "interpolado": el cuadro sólo dibuja, y la lógica corre un cuadro sí y uno no, en una tarea que
--   la página lanza apenas termina el cuadro (porteo_llamar, ver motor/parchar.py): si se pasa de los
--   16,7 ms se come el tiempo libre del cuadro siguiente, que sólo dibuja, en vez de demorar uno que ya
--   estaba listo. El cuadro que sigue a la lógica dibuja todo a mitad de camino entre lo de antes y lo
--   de ahora (de cada objeto lo visible: posición, tamaño, giro y escala; y los relojes de los
--   shaders); el otro, lo de ahora. Salen 60 cuadros parejos con la mitad de lógica, y lo que se toca
--   se ve igual de rápido (a mitad de camino en el primer cuadro).
-- - "lento": como el juego pero a 30 parejos (la página saltea un cuadro de cada dos), si ni
--   interpolando llega.
-- El modo sale de lo que tardan la lógica y el dibujo en este teléfono, medido sobre la marcha.

local modo = 'normal'
local conPagina = false        -- la página llama a porteo_llamar después de cada cuadro
local apagado = false          -- la interpolación falló una vez: no se usa más
local tocaLogica = false       -- el último cuadro dibujó lo último de la lógica: toca otra vuelta
local aMitad = false           -- corrió la lógica desde el último cuadro: el que viene va a mitad de camino
local errorPendiente, salida
local acumulado = 0            -- tiempo de juego que todavía no pasó por la lógica

-- lo que tardan la lógica y el dibujo y cada cuánto sale un cuadro (ms, promedios que se mueven),
-- para elegir el modo
local mu, md, mf = 8, 5, 16.7
local cuadrosTotal, ultimoCambio, cambios = 0, 0, 0

-- la medición que va a la consola (y la página al registro): cada 30 s, o cada 5 si la página deja
-- /porteo/medir (las pruebas)
local medir = io.open('/porteo/medir', 'r')
if medir then medir:close() end
local cada = medir and 5 or 30
local tu, td, nl, nc, desde, adentro = 0, 0, 0, 0, 0, 0

-- para las pruebas (sólo con ?medir): la página puede dejar un /porteo/orden.lua, que corre una vez
local function orden()
	local f = io.open('/porteo/orden.lua', 'r')
	if not f then return end
	local s = f:read('*a')
	f:close()
	os.remove('/porteo/orden.lua')
	local fn, err = loadstring(s, 'orden')
	local ok, res = false, err
	if fn then ok, res = pcall(fn) end
	print('porteo: orden ' .. (ok and 'bien' or 'mal') .. ' ' .. tostring(res))
end

-- los eventos, como en el love.run del juego (el toque se junta con el clic que lo acompaña), con un
-- arreglo: el juego deja el apoyar en cola hasta su lógica (queue_L_cursor_press) y atiende el soltar
-- en el acto, así que si los dos llegan en la misma vuelta suelta antes de apoyar y el toque se pierde
-- (queda apretado). Con la lógica a 30 un toque rápido entra entero en una vuelta: ese soltar pasa a
-- la vuelta siguiente, cuando el juego ya vio el apoyar.
local soltarDespues
local function eventos()
	if love.event and G and G.CONTROLLER then
		love.event.pump()
		if soltarDespues then
			local s = soltarDespues
			soltarDespues = nil
			love.handlers['mousereleased'](s[1], s[2], s[3], s[4], s[5], s[6])
		end
		local _n, _a, _b, _c, _d, _e, _f, touched
		for name, a, b, c, d, e, f in love.event.poll() do
			if name == 'quit' and love.system.getOS() ~= 'iOS' then
				if not love.quit or not love.quit() then
					return a or 0
				end
			end
			if name == 'touchpressed' then
				touched = true
			elseif name == 'mousepressed' then
				_n, _a, _b, _c, _d, _e, _f = name, a, b, c, d, e, f
			elseif name == 'mousereleased' and not soltarDespues and (_n or G.CONTROLLER.L_cursor_queue) then
				soltarDespues = { a, b, c, d, e, f }
			else
				love.handlers[name](a, b, c, d, e, f)
			end
		end
		if _n then
			love.handlers['mousepressed'](_a, _b, _c, touched)
		end
	end
end

local function logica(dt)
	local t = love.timer.getTime()
	if love.update then love.update(dt) end
	local ms = 1000 * (love.timer.getTime() - t)
	mu = mu + 0.05 * (math.min(ms, 60) - mu)   -- tope: que la carga no cuente como el juego
	tu, nl = tu + ms, nl + 1
end

local function dibujo()
	if love.graphics and love.graphics.isActive() then
		if medir then orden() end
		local t = love.timer.getTime()
		if love.draw then love.draw() end
		local ms = 1000 * (love.timer.getTime() - t)
		md = md + 0.05 * (math.min(ms, 60) - md)
		td = td + ms
		if nuGC then nuGC(nil, nil, true) end
		love.graphics.present()
	end
	nc = nc + 1
	cuadrosTotal = cuadrosTotal + 1
end

--||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- La interpolación. Antes de la lógica, una foto de lo visible de cada objeto (VT: x, y, w, h, r,
-- scale) en un arreglo plano (siete lugares por objeto: lo más barato en Lua 5.1; con ~470 objetos,
-- 0,2 ms). En el cuadro de mitad de camino se pone el promedio en los que cambiaron, se dibuja y se
-- devuelve lo de ahora, en orden inverso (si dos objetos compartieran el VT, queda el valor bueno).
-- Un objeto que se movió más de SALTO de una vez saltó (hard_set_T): no se lo pasea por el medio.
--||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
local SALTO = 2.5   -- unidades del juego; una carta mide 2,4 de ancho y se mueve hasta 2,3 por paso a 30
local RELOJES = { 'REAL', 'REAL_SHADER', 'UPTIME', 'BACKGROUND', 'TOTAL' }
local foto, nfoto = {}, 0
local puestos, npuestos = {}, 0
local relojesAntes, relojesAhora = {}, {}

local function sacarFoto()
	local L, f, j = G.MOVEABLES, foto, 0
	for i = 1, #L do
		local vt = L[i].VT
		f[j + 1], f[j + 2], f[j + 3], f[j + 4], f[j + 5], f[j + 6], f[j + 7] = vt, vt.x, vt.y, vt.w, vt.h, vt.r, vt.scale
		j = j + 7
	end
	for k = j + 1, nfoto do f[k] = nil end   -- que no queden vivos los que ya no están
	nfoto = j
	local T = G.TIMERS
	for i = 1, #RELOJES do relojesAntes[i] = T[RELOJES[i]] end
end

local function ponerMitad()
	local f, p, n = foto, puestos, 0
	for j = 1, nfoto, 7 do
		local vt = f[j]
		local x, y, w, h, r, s = vt.x, vt.y, vt.w, vt.h, vt.r, vt.scale
		local px, py, pw, ph, pr, ps = f[j + 1], f[j + 2], f[j + 3], f[j + 4], f[j + 5], f[j + 6]
		if x ~= px or y ~= py or w ~= pw or h ~= ph or r ~= pr or s ~= ps then
			local dx, dy = x - px, y - py
			if dx < SALTO and dx > -SALTO and dy < SALTO and dy > -SALTO then
				p[n + 1], p[n + 2], p[n + 3], p[n + 4], p[n + 5], p[n + 6], p[n + 7] = vt, x, y, w, h, r, s
				n = n + 7
				npuestos = n
				vt.x, vt.y, vt.w, vt.h = px + 0.5 * dx, py + 0.5 * dy, 0.5 * (w + pw), 0.5 * (h + ph)
				vt.r, vt.scale = 0.5 * (r + pr), 0.5 * (s + ps)
			end
		end
	end
	local T = G.TIMERS
	for i = 1, #RELOJES do
		local k = RELOJES[i]
		local antes, ahora = relojesAntes[i], T[k]
		relojesAhora[i] = ahora
		if antes and ahora then T[k] = 0.5 * (antes + ahora) end
	end
end

local function devolver()
	local p = puestos
	for j = npuestos - 6, 1, -7 do
		local vt = p[j]
		vt.x, vt.y, vt.w, vt.h, vt.r, vt.scale = p[j + 1], p[j + 2], p[j + 3], p[j + 4], p[j + 5], p[j + 6]
		p[j] = nil
	end
	npuestos = 0
	local T = G.TIMERS
	for i = 1, #RELOJES do
		if relojesAhora[i] then T[RELOJES[i]] = relojesAhora[i] end
		relojesAhora[i] = nil
	end
end

-- una vuelta de lógica en modo interpolado: con todo el tiempo que pasó desde la anterior. Si la foto
-- falla (algo que no se esperaba en un objeto), se sigue sin interpolar: el juego no se entera
local function paso()
	if not apagado then
		local ok, err = pcall(sacarFoto)
		if not ok then
			apagado, nfoto = true, 0
			print('porteo: sin interpolar: ' .. tostring(err))
		end
	end
	local q = eventos()
	if q then salida = q end
	local dt = math.min(acumulado, 0.1)   -- el mismo tope que el del juego
	acumulado = 0
	logica(dt)
	aMitad = true
end

local function cambiar(nuevo)
	if nuevo == modo then return end
	modo = nuevo
	tocaLogica, aMitad, acumulado = false, false, 0
	print('porteo: cuadros ' .. modo)
end

-- Interpolado si lo que frena es el procesador: lógica y dibujo no entran holgados en un cuadro y se
-- comen casi todo el tiempo entre cuadros (en un teléfono, aunque entren: con la mitad de trabajo se
-- calienta menos y no baja después). Normal otra vez si sobra, o si lo que frena es otra cosa (la
-- GPU): con menos de ~42 cuadros la lógica quedaría por debajo de 21 pasos por segundo, y el
-- movimiento del juego (resortes calculados por paso) se pone a temblar con pasos largos. Lento sólo
-- si interpolando no pasaría de ~45 por segundo (cada dos cuadros, una lógica y dos dibujos): ahí 30
-- parejos se ven mejor que 40 desparejos. Entre cambio y cambio, 3 s la primera vez y el doble cada
-- vez (hasta 24 s), para no ir y venir en un teléfono que queda justo en el borde
local function elegir()
	-- las pruebas pueden fijar el modo (con ?medir, por /porteo/orden.lua)
	if PORTEO_MODO and not apagado then
		if modo ~= PORTEO_MODO then cambiar(PORTEO_MODO) end
		return
	end
	if apagado or not conPagina then
		if modo ~= 'normal' then cambiar('normal') end
		return
	end
	if cuadrosTotal < 180 then return end   -- los primeros segundos son de carga
	local ahora = love.timer.getTime()
	if ahora - ultimoCambio < 3 * 2 ^ math.min(cambios, 3) then return end
	local u, d, f = mu, md, mf
	local nuevo = modo
	if modo == 'normal' then
		if u + d > 9 and u + d + 2 > 0.75 * f then nuevo = 'interpolado' end
	elseif modo == 'interpolado' then
		if u + 2 * d > 44 then nuevo = 'lento'
		elseif u + d < 6 or (f > 24 and u / 2 + d + 2 < 0.5 * f) then nuevo = 'normal' end
	elseif u + 2 * d < 36 then
		nuevo = 'interpolado'
	end
	if nuevo ~= modo then
		ultimoCambio, cambios = ahora, cambios + 1
		cambiar(nuevo)
	end
end

local function informe()
	local ahora = love.timer.getTime()
	if desde == 0 then desde = ahora end
	if ahora - desde < cada then return end
	print(string.format('porteo: %.1f cuadros/s · update %.2f ms · draw %.2f ms · memoria Lua %.1f MB · texturas %.1f MB · %s, lógica %.1f/s%s',
		nc / (ahora - desde), tu / math.max(nl, 1), td / math.max(nc, 1), collectgarbage('count') / 1024,
		love.graphics.getStats().texturememory / 1048576, modo, nl / (ahora - desde),
		adentro > 0 and string.format(' (%d adentro del cuadro)', adentro) or ''))
	tu, td, nl, nc, desde, adentro = 0, 0, 0, 0, ahora, 0
end

-- la página, después de cada cuadro (motor/parchar.py). Devuelve 1 para ir a 30 parejos
function porteo_llamar()
	conPagina = true
	if modo == 'interpolado' and tocaLogica and not errorPendiente and not salida then
		tocaLogica = false
		local ok, err = xpcall(paso, debug.traceback)
		if not ok then errorPendiente = tostring(err) end
	end
	return modo == 'lento' and 1 or 0
end

function love.run()
	if love.load then love.load(love.arg.parseGameArguments(arg), arg) end
	-- que el primer dt no cuente lo que tardó love.load
	if love.timer then love.timer.step() end
	local dt_smooth = 1 / 100

	return function()
		-- un error de la lógica que corrió afuera del cuadro sale acá, en el manejo de errores de LÖVE
		if errorPendiente then
			local e = errorPendiente
			errorPendiente = nil
			error(e, 0)
		end
		if salida then return salida end

		local dt = love.timer.step()
		dt_smooth = math.min(0.8 * dt_smooth + 0.2 * dt, 0.1)
		mf = mf + 0.05 * (math.min(1000 * dt, 100) - mf)
		if G then G.FPS_CAP = G.FPS_CAP or (G.F_MOBILE and 60 or 200) end

		if modo == 'interpolado' then
			acumulado = acumulado + dt_smooth
			-- la página no llamó después del cuadro anterior: la lógica acá
			if tocaLogica then
				tocaLogica = false
				adentro = adentro + 1
				paso()
			end
			if aMitad then
				aMitad = false
				local ok, err = pcall(ponerMitad)
				if not ok then
					devolver()
					apagado = true
					print('porteo: sin interpolar: ' .. tostring(err))
				end
				dibujo()
				devolver()
			else
				dibujo()
				tocaLogica = true
			end
		else
			local q = eventos()
			if q then return q end
			logica(dt_smooth)
			dibujo()
		end
		elegir()
		informe()
	end
end
