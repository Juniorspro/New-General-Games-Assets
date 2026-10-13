// broker MQTT local para probar el multijugador (el juego usa el público; acá no hay salida al 8084)
const aedes = require('aedes')();
const http = require('http');
const ws = require('websocket-stream');
const server = http.createServer();
ws.createServer({ server }, aedes.handle);
let n = 0;
aedes.on('publish', (p, c) => { if (c) n++; });
setInterval(() => { if (n) { console.log('mensajes', n); n = 0; } }, 5000);
server.listen(8883, '127.0.0.1', () => console.log('broker ws://127.0.0.1:8883/mqtt'));
