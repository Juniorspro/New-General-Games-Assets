/* ============================================================================
   luz-mala/js/jefes.js — los tres que guardan los faroles.
   El Torito (escarabajo torito): carga, salta y cornea; contra la pared queda
   mareado y se le caen piedras. La Viuda: baja del techo, escupe tela, larga
   crías. La Reina de la Marabunta: manda obreras, escupe ácido, golpea el
   piso y, a la mitad, apaga la luz. Cada ataque se anuncia antes (el aviso es
   lo que lo hace justo).
   ========================================================================== */

const JEFES = {
  torito: { nombre: 'EL TORITO', w: 30, h: 20, vida: 30, farol: 'raices', da: 'aleteo' },
  viuda: { nombre: 'LA VIUDA', w: 22, h: 16, vida: 32, farol: 'tela', da: 'resina' },
  reina: { nombre: 'LA REINA DE LA MARABUNTA', w: 40, h: 30, vida: 44, farol: 'madre', da: null },
};

function crearJefe(tipo, m) {
  const d = JEFES[tipo], a = m.jefeEn;
  const j = Object.assign({}, d, {
    tipo, x: a.x - d.w / 2, y: a.y + 8 - d.h, rx: 0, ry: 0, vx: 0, vy: 0, dir: -1, vidaMax: d.vida,
    fase: 1, est: 'presenta', t: 0, muerto: false, flash: 0, historial: [], toca: true, cuenta: 0,
  });
  /* la Viuda cuelga a media altura: desde los tablones (o con un salto) se le llega con el golpe para arriba */
  if (tipo === 'viuda') { j.y = 20; j.est = 'presenta'; j.techo = 60; }
  if (tipo === 'reina') { j.x = m.w * 8 - d.w - 20; j.dir = -1; }
  return j;
}

function danarJefe(m, j, d) {
  if (j.est === 'presenta' || j.muerto) return;
  j.vida -= d; j.flash = 0.1;
  eventoLM(m, 'pegaJefe', { x: j.x + j.w / 2, y: j.y + j.h / 2 });
  const f = j.vida / j.vidaMax;
  const nueva = j.tipo === 'reina' ? (f <= 0.25 ? 3 : f <= 0.6 ? 2 : 1) : (f <= 0.5 ? 2 : 1);
  if (nueva > j.fase) { j.fase = nueva; eventoLM(m, 'jefeFase', { fase: nueva }); m.congelar = 10; }
  if (j.vida <= 0) { j.muerto = true; j.est = 'muere'; j.t = 0; j.toca = false; eventoLM(m, 'jefeMuere', { tipo: j.tipo, x: j.x + j.w / 2, y: j.y + j.h / 2 }); m.congelar = 20; }
}

function elegirAtaque(m, j, opciones) {
  /* pesos, sin repetir el mismo tres veces seguidas */
  let total = 0;
  const ultimos = j.historial.slice(-2);
  const ok = opciones.filter(([a]) => !(ultimos.length === 2 && ultimos[0] === a && ultimos[1] === a));
  for (const [, p] of ok) total += p;
  let r = m.rnd() * total;
  for (const [a, p] of ok) { r -= p; if (r <= 0) { j.historial.push(a); return a; } }
  j.historial.push(ok[0][0]);
  return ok[0][0];
}

function pasarJefe(m) {
  const j = m.jefe;
  if (!j) return;
  j.t += DT;
  if (j.flash > 0) j.flash -= DT;
  if (j.muerto) { if (j.t > 2.2 && !j.cerrado) { j.cerrado = true; eventoLM(m, 'jefeFin', { tipo: j.tipo }); } return; }
  if (j.tipo === 'torito') pasarTorito(m, j);
  else if (j.tipo === 'viuda') pasarViuda(m, j);
  else pasarReina(m, j);
}

function cambiar(j, est) { j.est = est; j.t = 0; }
const rapido = (j) => j.fase >= 2 ? 1.28 : 1;

/* ---------------- El Torito ---------------- */
function pasarTorito(m, j) {
  const p = m.p, dx = p.x + 4 - (j.x + j.w / 2), k = rapido(j);
  const suelo = pisaLM(m, j);
  j.vy = Math.min(420, j.vy + 1100 * DT);
  switch (j.est) {
    case 'presenta': j.dir = sig(dx) || -1; if (j.t > 1.6) { cambiar(j, 'espera'); eventoLM(m, 'rugido', { x: j.x + j.w / 2, y: j.y }); } break;
    case 'espera':
      j.vx = 0; j.dir = sig(dx) || j.dir;
      if (j.t > (j.fase >= 2 ? 0.45 : 0.8)) {
        /* de cerca cornea o salta por encima, para no quedar contra la pared cuerneando siempre */
        const a = Math.abs(dx) < 42 ? elegirAtaque(m, j, [['cornada', 6], ['salto', 3]]) : elegirAtaque(m, j, [['carga', 5], ['salto', 4]]);
        cambiar(j, a + 'Prep');
        eventoLM(m, 'aviso', { ataque: a, x: j.x + j.w / 2, y: j.y });
      }
      break;
    case 'cargaPrep': j.vx = 0; if (j.t > 0.55 / k) { cambiar(j, 'carga'); j.vx = j.dir * 250 * k; eventoLM(m, 'carga', {}); } break;
    case 'carga':
      if (moverXLM(m, j, j.vx * DT)) {
        eventoLM(m, 'choca', { x: j.x + (j.dir > 0 ? j.w : 0), y: j.y + j.h / 2 });
        m.congelar = 6;
        /* se aflojan piedras del techo: se avisan con polvo 0,6 s antes */
        const n = j.fase >= 2 ? 5 : 3;
        for (let i = 0; i < n; i++) m.balas.push({ tipo: 'roca', x: 24 + m.rnd() * (m.w * 8 - 48), y: 10, vx: 0, vy: 0, g: 0, r: 4, vida: 4, aviso: 0.6, cae: 0.6 + i * 0.12, danio: 1 });
        if (j.fase >= 2 && !j.dobleHecho) { j.dobleHecho = true; j.dir = -j.dir; cambiar(j, 'cargaPrep'); }
        else { j.dobleHecho = false; cambiar(j, 'mareado'); }
        j.vx = 0;
      }
      break;
    case 'mareado': if (j.t > 1.0) cambiar(j, 'espera'); break;
    case 'saltoPrep': j.vx = 0; if (j.t > 0.35 / k) { cambiar(j, 'salto'); j.vy = -390; j.vx = lim(dx / 0.75, -200, 200); eventoLM(m, 'saltoJefe', {}); } break;
    case 'salto':
      moverXLM(m, j, j.vx * DT, () => { j.vx = 0; });
      if (suelo && j.vy >= 0 && j.t > 0.2) {
        cambiar(j, 'aterriza'); j.vx = 0;
        eventoLM(m, 'tierra', { x: j.x + j.w / 2, y: j.y + j.h });
        m.congelar = 5;
        for (const d of [-1, 1]) m.balas.push({ tipo: 'onda', x: j.x + j.w / 2 + d * j.w / 2, y: j.y + j.h - 4, y0: j.y + j.h - 4, vx: d * 150 * k, vy: 0, r: 5, alto: 4, vida: 2.2, danio: 1 });
      }
      break;
    case 'aterriza': if (j.t > 0.5) cambiar(j, 'espera'); break;
    case 'cornadaPrep': j.vx = 0; if (j.t > 0.32 / k) { cambiar(j, 'cornada'); eventoLM(m, 'cornada', {}); } break;
    case 'cornada':
      if (j.t < 0.18 && cruza(p.x, p.y, p.w, p.h, j.dir > 0 ? j.x + j.w - 4 : j.x - 20, j.y - 8, 24, j.h)) lastimar(m, j.x + j.w / 2, 1);
      if (j.t > 0.45) cambiar(j, 'espera');
      break;
  }
  if (j.est !== 'carga' && j.est !== 'salto') moverXLM(m, j, j.vx * DT);
  moverYLM(m, j, j.vy * DT, () => { j.vy = 0; });
  /* las rocas avisadas empiezan a caer después del polvo */
  for (const b of m.balas) if (b.tipo === 'roca' && b.cae != null) { b.cae -= DT; if (b.cae <= 0) { b.cae = null; b.g = 700; } }
}

/* ---------------- La Viuda ---------------- */
function pasarViuda(m, j) {
  const p = m.p, dx = p.x + 4 - (j.x + j.w / 2), k = rapido(j);
  switch (j.est) {
    case 'presenta': j.toca = false; if (j.t > 1.8) { cambiar(j, 'arriba'); j.toca = true; eventoLM(m, 'rugido', {}); } break;
    case 'arriba': {
      j.y = acercar(j.y, j.techo, 160 * DT);
      j.vx = acercar(j.vx, sig(dx) * 70 * k, 200 * DT);
      moverXLM(m, j, j.vx * DT, () => { j.vx = 0; });
      if (j.t > (j.fase >= 2 ? 0.9 : 1.4)) {
        const vivas = m.bichos.filter((b) => !b.muerto && b.tipo === 'aranita').length;
        const a = elegirAtaque(m, j, [['baja', 5], ['escupe', 4], ['crias', vivas < 3 ? 2 : 0]]);
        cambiar(j, a + 'Prep'); j.vx = 0;
        eventoLM(m, 'aviso', { ataque: a, x: j.x + j.w / 2, y: j.y + j.h });
      }
      break;
    }
    case 'bajaPrep': if (j.t > 0.45 / k) { cambiar(j, 'baja'); j.vy = 60; } break;
    case 'baja':
      j.vy = Math.min(380, j.vy + 900 * DT);
      /* baja colgada del hilo hasta el piso: los tablones no la frenan */
      if (moverYLM(m, j, j.vy * DT, null, true)) { cambiar(j, 'suelo'); j.vy = 0; eventoLM(m, 'tierra', { x: j.x + j.w / 2, y: j.y + j.h }); m.congelar = 4; }
      break;
    case 'suelo': if (j.t > (j.fase >= 2 ? 0.9 : 1.3)) { if (j.fase >= 2 && !j.dobleHecho) { j.dobleHecho = true; cambiar(j, 'sube'); j.otra = true; } else { j.dobleHecho = false; cambiar(j, 'sube'); } } break;
    case 'sube':
      j.y = acercar(j.y, j.techo, 170 * DT);
      if (j.y <= j.techo + 0.5) { if (j.otra) { j.otra = false; j.x = lim(p.x - j.w / 2, 8, m.w * 8 - j.w - 8); cambiar(j, 'bajaPrep'); } else cambiar(j, 'arriba'); }
      break;
    case 'escupePrep': if (j.t > 0.4 / k) {
      const n = j.fase >= 2 ? 5 : 3, cx = j.x + j.w / 2, cy = j.y + j.h;
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(p.y + 6 - cy, p.x + 4 - cx) + (i - (n - 1) / 2) * 0.28;
        m.balas.push({ tipo: 'tela', x: cx, y: cy, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, g: 60, r: 3, vida: 3, danio: 1, rompible: true });
      }
      eventoLM(m, 'escupe', { x: cx, y: cy });
      cambiar(j, 'arriba');
    } break;
    case 'criasPrep': if (j.t > 0.5) {
      for (let i = 0; i < 2; i++) { const b = crearBicho('a', lim(j.x + (i ? 30 : -24), 8, m.w * 8 - 16), j.techo + 4, m); b.est = 'cae'; b.vy = 30; m.bichos.push(b); }
      eventoLM(m, 'crias', {});
      cambiar(j, 'arriba');
    } break;
  }
}

/* ---------------- La Reina de la Marabunta ---------------- */
function pasarReina(m, j) {
  const p = m.p, k = j.fase >= 3 ? 1.4 : j.fase >= 2 ? 1.2 : 1, cx = j.x + j.w / 2;
  j.vy = Math.min(420, j.vy + 1100 * DT);
  moverYLM(m, j, j.vy * DT, () => { j.vy = 0; });
  m.oscuro = j.fase >= 2;
  switch (j.est) {
    case 'presenta': j.toca = false; if (j.t > 2.2) { cambiar(j, 'espera'); j.toca = true; eventoLM(m, 'rugido', {}); } break;
    case 'espera':
      if (j.t > 1.1 / k) {
        const ops = [['oleada', 3], ['acido', 4], ['golpe', 3]];
        if (j.fase >= 3) ops.push(['embestida', 3]);
        const a = elegirAtaque(m, j, ops);
        cambiar(j, a + 'Prep');
        eventoLM(m, 'aviso', { ataque: a, x: cx, y: j.y });
      }
      break;
    case 'oleadaPrep': if (j.t > 0.6) {
      /* en fila y separadas: de a una se matan, todas juntas no */
      const n = j.fase >= 3 ? 4 : 3;
      for (let i = 0; i < n; i++) { const b = crearBicho('w', j.x - 6 - i * 24, j.y + j.h - 8, m); b.dir = -1; m.bichos.push(b); }
      eventoLM(m, 'oleada', {});
      cambiar(j, j.fase >= 3 ? 'acidoPrep' : 'espera');
    } break;
    case 'acidoPrep': if (j.t > 0.45 / k) {
      const n = j.fase >= 2 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const t = 0.8 + i * 0.18, g = 520, tx = p.x + 4 + (i - 1) * 22, ty = p.y + 6;
        m.balas.push({ tipo: 'acido', x: j.x + 6, y: j.y + 8, vx: (tx - j.x - 6) / t, vy: (ty - j.y - 8 - 0.5 * g * t * t) / t, g, r: 3, vida: 3, danio: 1 });
      }
      eventoLM(m, 'escupe', { x: j.x + 6, y: j.y + 8 });
      cambiar(j, 'espera');
    } break;
    case 'golpePrep': if (j.t > 0.5 / k) {
      eventoLM(m, 'tierra', { x: j.x, y: j.y + j.h }); m.congelar = 6;
      m.balas.push({ tipo: 'onda', x: j.x, y: j.y + j.h - 4, y0: j.y + j.h - 4, vx: -170 * k, vy: 0, r: 6, alto: 5, vida: 2.4, danio: 1 });
      if (j.fase >= 2) m.balas.push({ tipo: 'onda', x: j.x - 40, y: j.y + j.h - 4, y0: j.y + j.h - 4, vx: -120 * k, vy: 0, r: 6, alto: 5, vida: 2.4, danio: 1 });
      cambiar(j, 'espera');
    } break;
    case 'embestidaPrep': if (j.t > 0.5) { cambiar(j, 'embestida'); j.x0 = j.x; } break;
    case 'embestida':
      if (j.t < 0.35) moverXLM(m, j, -300 * DT);
      else if (j.t < 1.1) j.x = acercar(j.x, j.x0, 120 * DT);
      else cambiar(j, 'espera');
      break;
  }
}
