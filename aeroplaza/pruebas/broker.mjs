// Un broker MQTT 3.1.1 sobre WebSocket, chiquito y en Node puro, para probar
// el multijugador acá adentro: el contenedor no llega a wss://broker.emqx.io
// (el proxy no deja pasar WebSocket ni el puerto 8084). Hace lo que usa el
// juego: CONNECT, SUBSCRIBE (con + y #), UNSUBSCRIBE, PUBLISH qos 0 (con
// retenidos), PINGREQ y DISCONNECT. No es un broker de verdad: no hay qos 1/2
// ni sesiones guardadas.
//     node pruebas/broker.mjs [puerto]      (o importarlo: broker(puerto))
import http from 'node:http';
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function coincide(filtro, tema) {
  const f = filtro.split('/'), t = tema.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (i >= t.length) return false;
    if (f[i] !== '+' && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}
const largo = (n) => { const b = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; b.push(d); } while (n > 0); return Buffer.from(b); };
const texto = (s) => { const b = Buffer.from(s, 'utf8'); return Buffer.concat([Buffer.from([b.length >> 8, b.length & 255]), b]); };
const paquete = (cab, cuerpo) => Buffer.concat([Buffer.from([cab]), largo(cuerpo.length), cuerpo]);

export async function broker(puerto = 0, { verboso = false } = {}) {
  const clientes = new Set(), retenidos = new Map();
  let mensajes = 0; const porTema = new Map();
  const srv = http.createServer((q, r) => { r.writeHead(426); r.end('solo websocket'); });
  srv.on('upgrade', (req, sock) => {
    const clave = req.headers['sec-websocket-key'];
    if (!clave) { sock.destroy(); return; }
    const acepta = crypto.createHash('sha1').update(clave + GUID).digest('base64');
    const proto = (req.headers['sec-websocket-protocol'] || '').split(',').map((s) => s.trim()).find((p) => p.startsWith('mqtt'));
    sock.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acepta}`, ...(proto ? [`Sec-WebSocket-Protocol: ${proto}`] : []), '', ''].join('\r\n'));
    sock.setNoDelay(true);
    const c = { sock, subs: new Set(), id: '?', ws: Buffer.alloc(0), mq: Buffer.alloc(0), frag: [] };
    clientes.add(c);
    const mandarWS = (datos, op = 2) => {
      const n = datos.length, cab = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | op, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
      if (!sock.destroyed) sock.write(Buffer.concat([cab, datos]));
    };
    c.mandar = (p) => mandarWS(p);
    const cerrar = () => { clientes.delete(c); sock.destroy(); };
    sock.on('close', () => clientes.delete(c));
    sock.on('error', () => clientes.delete(c));
    sock.on('data', (d) => {
      c.ws = Buffer.concat([c.ws, d]);
      /* los cuadros de WebSocket (los del cliente vienen enmascarados) */
      for (;;) {
        const b = c.ws; if (b.length < 2) return;
        const fin = b[0] & 0x80, op = b[0] & 15, masc = b[1] & 0x80;
        let n = b[1] & 127, i = 2;
        if (n === 126) { if (b.length < 4) return; n = b.readUInt16BE(2); i = 4; }
        else if (n === 127) { if (b.length < 10) return; n = Number(b.readBigUInt64BE(2)); i = 10; }
        const m = masc ? b.subarray(i, i + 4) : null; if (masc) i += 4;
        if (b.length < i + n) return;
        const carga = Buffer.from(b.subarray(i, i + n)); if (m) for (let k = 0; k < n; k++) carga[k] ^= m[k & 3];
        c.ws = b.subarray(i + n);
        if (op === 8) { mandarWS(Buffer.alloc(0), 8); cerrar(); return; }
        if (op === 9) { mandarWS(carga, 10); continue; }
        if (op === 10) continue;
        c.frag.push(carga);
        if (!fin) continue;
        c.mq = Buffer.concat([c.mq, ...c.frag]); c.frag = [];
        leerMQTT(c);
      }
    });
  });
  function leerMQTT(c) {
    for (;;) {
      const b = c.mq; if (b.length < 2) return;
      let mult = 1, n = 0, i = 1, d;
      do { if (i >= b.length) return; d = b[i++]; n += (d & 127) * mult; mult *= 128; } while (d & 128);
      if (b.length < i + n) return;
      const tipo = b[0] >> 4, banderas = b[0] & 15, cuerpo = b.subarray(i, i + n);
      c.mq = b.subarray(i + n);
      tratar(c, tipo, banderas, cuerpo);
    }
  }
  function tratar(c, tipo, banderas, q) {
    if (tipo === 1) {                       // CONNECT
      const lp = q.readUInt16BE(0), off = 2 + lp + 1 + 1 + 2;   // nombre del protocolo, nivel, banderas, keepalive
      const li = q.readUInt16BE(off); c.id = q.subarray(off + 2, off + 2 + li).toString();
      c.mandar(Buffer.from([0x20, 2, 0, 0]));
      if (verboso) console.log('broker: entra', c.id);
    } else if (tipo === 3) {                // PUBLISH
      const qos = (banderas >> 1) & 3, ret = banderas & 1;
      const lt = q.readUInt16BE(0), tema = q.subarray(2, 2 + lt).toString();
      let off = 2 + lt; if (qos > 0) off += 2;
      const carga = q.subarray(off);
      if (ret) { if (carga.length) retenidos.set(tema, Buffer.from(carga)); else retenidos.delete(tema); }
      const p = paquete(0x30, Buffer.concat([texto(tema), carga]));
      mensajes++; const corto = tema.split('/').slice(-1)[0]; porTema.set(corto, (porTema.get(corto) || 0) + 1);
      for (const o of clientes) for (const f of o.subs) if (coincide(f, tema)) { o.mandar(p); break; }
    } else if (tipo === 8) {                // SUBSCRIBE
      const pid = q.readUInt16BE(0); let off = 2; const dados = [], nuevos = [];
      while (off < q.length) { const l = q.readUInt16BE(off); const f = q.subarray(off + 2, off + 2 + l).toString(); off += 2 + l + 1; c.subs.add(f); nuevos.push(f); dados.push(0); }
      c.mandar(paquete(0x90, Buffer.from([pid >> 8, pid & 255, ...dados])));
      for (const [tema, carga] of retenidos) if (nuevos.some((f) => coincide(f, tema))) c.mandar(paquete(0x31, Buffer.concat([texto(tema), carga])));
    } else if (tipo === 10) {               // UNSUBSCRIBE
      const pid = q.readUInt16BE(0); let off = 2;
      while (off < q.length) { const l = q.readUInt16BE(off); c.subs.delete(q.subarray(off + 2, off + 2 + l).toString()); off += 2 + l; }
      c.mandar(Buffer.from([0xb0, 2, pid >> 8, pid & 255]));
    } else if (tipo === 12) c.mandar(Buffer.from([0xd0, 0]));   // PINGREQ
    else if (tipo === 14) { clientes.delete(c); c.sock.end(); } // DISCONNECT
  }
  await new Promise((r) => srv.listen(puerto, '127.0.0.1', r));
  return { url: `ws://127.0.0.1:${srv.address().port}`, puerto: srv.address().port, get clientes() { return clientes.size; }, get mensajes() { return mensajes; }, porTema, cerrar: () => { for (const c of clientes) c.sock.destroy(); srv.close(); } };
}

if (process.argv[1] && process.argv[1].endsWith('broker.mjs')) {
  const b = await broker(+(process.argv[2] || 1883), { verboso: true });
  console.log('broker MQTT por WebSocket en', b.url);
}
