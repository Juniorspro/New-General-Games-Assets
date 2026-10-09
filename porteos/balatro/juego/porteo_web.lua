-- porteo: la capa del navegador para Balatro (la versión de Android). Lo que el juego espera de su
-- LÖVE propio (love.platform: guardado en la nube, logros) y de LuaJIT (jit, hilos de verdad), con lo
-- que hay en el LÖVE para la web (Lua 5.1, sin hilos). Se carga antes que el main.lua del juego.

-- LuaJIT: el juego apaga el JIT en ARM (jit.off) y nada más
jit = jit or { arch = 'wasm32', os = 'Web', version = 'Lua 5.1 (porteo)', status = function() return false end,
	off = function() end, on = function() end, flush = function() end }

-- el sistema: Android, así el juego se arma como en el teléfono (interfaz táctil, sonido en el hilo
-- principal, sin opciones de video, guardado cada 10 s)
love.system.porteoOS = love.system.getOS
love.system.getOS = function() return 'Android' end

-- La ventana es el lienzo de la página, y su tamaño lo pone el CSS (con el teléfono en vertical, el
-- lienzo girado: más ancho que alto). El juego arranca en "Borderless" (pantalla completa) con
-- highdpi sólo en Apple y pide la ventana del tamaño de la pantalla física: en el navegador eso
-- rehacía la ventana con el tamaño vertical y el lienzo girado quedaba negro. Acá siempre en
-- ventana, redimensionable (SDL sigue al CSS), con highdpi y del tamaño que tiene el lienzo; la
-- pantalla completa la pide la página al primer toque.
local function modoWeb(_, _, op)
	op = op or {}
	op.fullscreen = false
	op.fullscreentype = nil
	op.borderless = false
	op.resizable = true
	op.highdpi = true
	local w, h = love.graphics.getDimensions()
	return w, h, op
end
local actualizarModo, ponerModo = love.window.updateMode, love.window.setMode
love.window.updateMode = function(w, h, op) return actualizarModo(modoWeb(w, h, op)) end
love.window.setMode = function(w, h, op) return ponerModo(modoWeb(w, h, op)) end

-- Los shaders van como GLSL ES 1.00 (WebGL 1), y WebGL hace cumplir lo que los drivers del teléfono
-- dejan pasar: el índice de un for tiene que arrancar en una constante. El holográfico (el de
-- Holographic) arranca en -glow_samples, una variable que vale siempre 4: como constante da lo mismo.
-- Y un salto de línea al final (algunos terminan en "#endif" sin él)
local ARREGLOS_SHADER = {
	['MY_HIGHP_OR_MEDIUMP int glow_samples = 4;'] = 'const int glow_samples = 4;',
}
local nuevoShader = love.graphics.newShader
love.graphics.newShader = function(a, b, ...)
	local function arreglar(s)
		if type(s) ~= 'string' then return s end
		if not s:find('\n') and love.filesystem.getInfo(s) then s = love.filesystem.read(s) end
		for viejo, nuevo in pairs(ARREGLOS_SHADER) do
			local i, f = s:find(viejo, 1, true)
			if i then s = s:sub(1, i - 1) .. nuevo .. s:sub(f + 1) end
		end
		return s .. '\n'
	end
	return nuevoShader(arreglar(a), arreglar(b), ...)
end

--||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- Hilos: corrutinas en el hilo principal
--||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- El juego abre el cargador y el guardador de partidas (engine/load_manager.lua, save_manager.lua)
-- como hilos que leen un canal, hacen lo suyo y duermen 10 ms. Acá cada uno es una corrutina con sus
-- propias globales (como un hilo de LÖVE, que tiene su estado de Lua aparte) que corre un paso por
-- cuadro (después de love.event.pump) y cede en love.timer.sleep o en un demand sin nada.

local hilos = {}
local actual = nil   -- la corrutina-hilo que está corriendo, o nil en el hilo principal

-- pcall y xpcall que dejan ceder: en Lua 5.1 no se puede hacer yield a través de un pcall de C, y los
-- dos hilos del juego tienen todo su bucle adentro de un pcall
local function sacar(t, n) return unpack(t, 1, n) end
local function resultados(...) return { n = select('#', ...), ... } end

local function copcall(f, ...)
	local co = coroutine.create(f)
	local r = resultados(coroutine.resume(co, ...))
	while true do
		if not r[1] then return false, r[2] end
		if coroutine.status(co) == 'dead' then return sacar(r, r.n) end
		r = resultados(coroutine.resume(co, coroutine.yield(select(2, sacar(r, r.n)))))
	end
end

local function coxpcall(f, manejador, ...)
	local r = resultados(copcall(f, ...))
	if not r[1] then return false, manejador(r[2]) end
	return sacar(r, r.n)
end

-- lo que pasa por un canal se copia, como en LÖVE (sin metatablas ni funciones): el que lo recibe no
-- ve cambios que se hagan después
local function copiar(v, vistos)
	if type(v) ~= 'table' then
		local t = type(v)
		if t == 'function' or t == 'thread' then return nil end
		return v
	end
	vistos = vistos or {}
	if vistos[v] then return vistos[v] end
	local c = {}
	vistos[v] = c
	for k, x in pairs(v) do
		local ck = copiar(k, vistos)
		if ck ~= nil then c[ck] = copiar(x, vistos) end
	end
	return c
end

-- que corran los hilos: un paso cada uno
local function pasoHilos()
	for i = #hilos, 1, -1 do
		local h = hilos[i]
		if h.co and coroutine.status(h.co) ~= 'dead' then
			local antes = actual
			actual = h
			local ok, err = coroutine.resume(h.co)
			actual = antes
			if not ok then
				h.error = tostring(err)
				print('porteo: el hilo ' .. tostring(h.nombre) .. ' falló: ' .. h.error)
			end
		end
		if not h.co or coroutine.status(h.co) == 'dead' then table.remove(hilos, i) end
	end
end

-- esperar: un hilo cede hasta el próximo cuadro; el principal no puede esperar (el navegador no
-- dibuja mientras), así que les da una vuelta a los hilos y sigue
local function ceder()
	if actual then coroutine.yield(); return true end
	pasoHilos()
	return false
end

local Canal = {}
Canal.__index = Canal
local canales = {}

local function nuevoCanal()
	return setmetatable({ cola = {}, primero = 1, ultimo = 0, empujados = 0, leidos = 0 }, Canal)
end

function Canal:push(v)
	self.ultimo = self.ultimo + 1
	self.cola[self.ultimo] = copiar(v)
	self.empujados = self.empujados + 1
	return self.empujados
end
function Canal:getCount() return self.ultimo - self.primero + 1 end
function Canal:pop()
	if self.primero > self.ultimo then return nil end
	local v = self.cola[self.primero]
	self.cola[self.primero] = nil
	self.primero = self.primero + 1
	self.leidos = self.leidos + 1
	return v
end
function Canal:peek()
	if self.primero > self.ultimo then return nil end
	return self.cola[self.primero]
end
function Canal:clear() self.cola, self.primero, self.ultimo = {}, 1, 0 end
function Canal:hasRead(id) return self.leidos >= id end
function Canal:demand(espera)
	local fin = espera and (love.timer.getTime() + espera)
	local vueltas = 0
	while self:getCount() == 0 do
		if fin and love.timer.getTime() >= fin then return nil end
		-- en el principal, una espera sin fin colgaría la página: unas vueltas a los hilos y nada
		if not ceder() then
			vueltas = vueltas + 1
			if vueltas > 64 then return nil end
		end
	end
	return self:pop()
end
function Canal:supply(v, espera)
	local id = self:push(v)
	local fin = espera and (love.timer.getTime() + espera)
	local vueltas = 0
	while not self:hasRead(id) do
		if fin and love.timer.getTime() >= fin then return false end
		if not ceder() then
			vueltas = vueltas + 1
			if vueltas > 64 then return false end
		end
	end
	return true
end
function Canal:performAtomic(f, ...) return f(self, ...) end
function Canal:release() return true end
function Canal:type() return 'Channel' end
function Canal:typeOf(t) return t == 'Channel' or t == 'Object' end

local Hilo = {}
Hilo.__index = Hilo

function Hilo:start(...)
	if self.co then return end
	local f
	if type(self.fuente) == 'string' and love.filesystem.getInfo(self.fuente) then
		f = assert(love.filesystem.load(self.fuente))
	else
		f = assert(loadstring(type(self.fuente) == 'string' and self.fuente or self.fuente:getString(), 'hilo'))
	end
	-- sus globales aparte (los dos hilos del juego usan IN_CHANNEL, OUT_CHANNEL, FOS...), lo demás del
	-- principal; y los pcall que dejan ceder
	local propias = { pcall = copcall, xpcall = coxpcall }
	propias._G = propias
	setfenv(f, setmetatable(propias, { __index = _G }))
	local args = { n = select('#', ...), ... }
	self.co = coroutine.create(function() return f(sacar(args, args.n)) end)
	self.error = nil
	hilos[#hilos + 1] = self
	-- como un hilo que arranca: corre hasta la primera espera
	local antes = actual
	actual = self
	local ok, err = coroutine.resume(self.co)
	actual = antes
	if not ok then
		self.error = tostring(err)
		print('porteo: el hilo ' .. tostring(self.nombre) .. ' falló: ' .. self.error)
	end
	return true
end
function Hilo:isRunning() return self.co ~= nil and coroutine.status(self.co) ~= 'dead' end
function Hilo:getError() return self.error end
function Hilo:wait()
	local vueltas = 0
	while self:isRunning() and vueltas < 1000 do pasoHilos(); vueltas = vueltas + 1 end
end
function Hilo:release() return true end
function Hilo:type() return 'Thread' end
function Hilo:typeOf(t) return t == 'Thread' or t == 'Object' end

love.thread = {
	newThread = function(fuente)
		return setmetatable({ fuente = fuente, nombre = type(fuente) == 'string' and fuente:sub(1, 40) or 'código' }, Hilo)
	end,
	getChannel = function(nombre)
		canales[nombre] = canales[nombre] or nuevoCanal()
		return canales[nombre]
	end,
	newChannel = nuevoCanal,
}
package.loaded['love.thread'] = love.thread

-- dormir: en un hilo, ceder; en el principal, nada (el ritmo lo da el navegador, y SDL_Delay sin
-- hilos es una espera activa que se come el cuadro)
love.timer.sleep = function()
	if actual then coroutine.yield() end
end

-- un paso de los hilos por cuadro: el bucle del juego (love.run) bombea los eventos una vez por cuadro
-- (y ahí también se mira si llegó la música, ver "Sonido")
local mirarTarde
local bombear = love.event.pump
love.event.pump = function(...)
	bombear(...)
	pasoHilos()
	if mirarTarde then mirarTarde() end
end

--||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- Sonido
--||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- Sin el hilo de sonido (en Android va en el principal) el juego hace un Source nuevo cada vez que
-- suena algo: los efectos "static" se decodificaban enteros (OGG a PCM) en cada toque. Acá se
-- decodifica cada uno una vez y se clona (los clones comparten el audio ya decodificado).
--
-- La música y el ambiente (15,6 MB) no se esperan: el .love trae silencios con el mismo nombre y la
-- página baja los de verdad por detrás a la carpeta de guardado, que LÖVE mira antes que el .love.
-- La lista de esos archivos va en /porteo/tarde.txt; cuando están todos la página deja
-- /porteo/tarde-listo, y entonces se cortan los silencios que estén sonando: el juego ve la música
-- parada y la vuelve a arrancar (RESTART_MUSIC), ya con los archivos de verdad y todas juntas.
local fuenteNueva = love.audio.newSource
local estaticos = {}
local tarde, provisorias, tardeListo = {}, {}, false
do
	local f = io.open('/porteo/tarde.txt', 'r')
	if f then
		for linea in f:lines() do
			if linea ~= '' then tarde[linea] = true end
		end
		f:close()
	else
		tardeListo = true
	end
end

love.audio.newSource = function(a, tipo, ...)
	if type(a) == 'string' and tipo == 'static' then
		local p = estaticos[a]
		if not p then
			p = fuenteNueva(a, 'static')
			estaticos[a] = p
		end
		return p:clone()
	end
	local s = fuenteNueva(a, tipo, ...)
	if not tardeListo and type(a) == 'string' and tarde[a] then
		local real = love.filesystem.getRealDirectory(a)
		if real and real:sub(-5) == '.love' then provisorias[#provisorias + 1] = s end
	end
	return s
end

local cuadros = 0
function mirarTarde()
	if tardeListo then return end
	cuadros = cuadros + 1
	if cuadros % 60 ~= 0 then return end
	local f = io.open('/porteo/tarde-listo', 'r')
	if not f then return end
	f:close()
	tardeListo = true
	for _, s in ipairs(provisorias) do
		if s:isPlaying() then s:stop() end
	end
	provisorias = {}
end

--||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- love.platform: lo de la nube, en el teléfono
--||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
-- La versión de Android guarda perfil y metadatos en la nube (Google Play) con callbacks que el hilo
-- de guardado y el de carga corren cada vuelta. Acá van a la carpeta de guardado de LÖVE (que la
-- página pasa a IndexedDB) y los callbacks contestan "listo" o "no está".
local OK, NO_ESTA = 0, 6
local alGuardar, alCargar
local guardados, cargados = {}, {}

local function escribir(archivo, datos)
	local carpeta = archivo:match('^(.*)/[^/]*$')
	if carpeta and not love.filesystem.getInfo(carpeta) then love.filesystem.createDirectory(carpeta) end
	return love.filesystem.write(archivo, datos)
end

local function leer(archivo)
	if not love.filesystem.getInfo(archivo) then return nil end
	return (love.filesystem.read(archivo))
end

local function nada() end

love.platform = {
	earlyInit = nada,
	isArcade = function() return false end,
	hideSplashScreen = nada,
	anyButtonPressed = function() return false end,
	isFirstTimePlaying = function() return false end,
	isOffline = function() return false end,
	isPremium = function() return true end,
	getNotchPosition = function() return nil end,
	event = nada,
	authenticateLocalPlayer = nada,
	setProfileButtonActive = nada,
	requestReview = nada,
	requestTrackingPermission = nada,
	showLocalPlayerProfile = nada,
	unlockAchievement = nada,

	setSaveGameCallback = function(f) alGuardar = f end,
	setLoadGameCallback = function(f) alCargar = f end,
	saveGameFile = function(archivo, datos)
		escribir(archivo, datos)
		guardados[#guardados + 1] = archivo
	end,
	runSaveGameCallbacks = function()
		local l = guardados
		guardados = {}
		for _, archivo in ipairs(l) do
			if alGuardar then alGuardar(archivo, OK, '', nil, nil, nil) end
		end
	end,
	loadGameFile = function(archivo)
		cargados[#cargados + 1] = { archivo, leer(archivo) }
	end,
	runLoadGameCallbacks = function()
		local l = cargados
		cargados = {}
		for _, c in ipairs(l) do
			if alCargar then alCargar(c[1], c[2] and OK or NO_ESTA, '', c[2], nil, nil) end
		end
	end,
	resolveConflict = function(archivo, datos) escribir(archivo, datos) end,

	localGetInfo = function(archivo) return love.filesystem.getInfo(archivo) end,
	localRead = function(archivo) return love.filesystem.read(archivo) end,
	localWrite = function(archivo, datos) return escribir(archivo, datos) end,
	localRemove = function(archivo) return love.filesystem.remove(archivo) end,
}
package.loaded['love.platform'] = love.platform
