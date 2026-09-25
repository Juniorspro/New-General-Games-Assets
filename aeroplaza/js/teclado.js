/* ============================================================================
   aeroplaza/js/teclado.js — el teclado propio, para el celu: horizontal y
   completo, de vidrio brilloso como todo lo Aero. Con el juego acostado
   (pantalla.js) el teclado del sistema sale parado y tapa todo: este va
   adentro de #app y se acuesta con el juego.
   - Letras con ñ, números arriba, símbolos (?123) y emojis (😊).
   - Mantener apretada una vocal (o la c, la n) abre los acentos: á é í ó ú
     ü ç ã õ â ê ô…; se elige deslizando o tocando.
   - ⇧ una vez: la próxima mayúscula; dos veces seguidas: todo en mayúsculas.
     La primera letra va sola en mayúscula.
   - ⌫ sostenido borra rápido. ↵ envía.
   - Cada tecla, al tocarla, muestra la letra en una burbuja arriba y hace la
     onda de luz (ui.js); el teclado entra rebotando y se va hundiéndose.
   ========================================================================== */
const LETRAS = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'], ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'], ['?123', '😊', ',', ' ', '.', '↵']];
const SIMBOLOS = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['@', '#', '$', '%', '&', '*', '-', '+', '(', ')'], ['!', '"', "'", ':', ';', '/', '?', '_', '¿', '¡'], ['=', '~', '[', ']', '<', '>', '♥', '★', '⌫'], ['ABC', '😊', ',', ' ', '.', '↵']];
const EMOJIS = [['😀', '😂', '🥰', '😎', '🤩', '😭', '😡', '🤔', '😴', '🥳'], ['👋', '👍', '👏', '🙌', '💪', '🙏', '❤️', '💙', '💚', '✨'], ['🫧', '🌊', '🌈', '☀️', '🌙', '⭐', '🌸', '🍄', '🐬', '🎵'], ['🎉', '🔥', '💯', '👀', '🤝', '🥺', '😅', '😇', '⌫'], ['ABC', '?123', ',', ' ', '.', '↵']];
const ACENTOS = { a: 'áàâäã', e: 'éèêë', i: 'íìîï', o: 'óòôöõ', u: 'úùûü', c: 'ç', n: 'ñ', y: 'ý', '?': '¿', '!': '¡' };
const ESPECIAL = { '⇧': 'mayus', '⌫': 'borra', '?123': 'simbolos', 'ABC': 'letras', '😊': 'emojis', '↵': 'enviar', ' ': 'espacio' };

export const Teclado = {
  abierto: null,
  /* input: el campo que se llena. o: { alEnviar, alCerrar, sonido(tecla) } */
  abrir(input, o = {}) {
    this.cerrar(true);
    const app = document.getElementById('app') || document.body;
    const raiz = document.createElement('div'); raiz.className = 'teclado-aero';
    raiz.innerHTML = '<div class="tec-barra"><div class="tec-texto"><span></span><i class="tec-cursor"></i></div><button class="tec-cerrar" aria-label="cerrar">⌄</button></div><div class="tec-filas"></div><div class="tec-burbujas"></div>';
    for (let i = 0; i < 9; i++) { const b = document.createElement('i'); b.style.left = (5 + i * 11) + '%'; b.style.animationDelay = (-i * 0.9) + 's'; b.style.setProperty('--t', (6 + (i % 4) * 1.5) + 's'); raiz.querySelector('.tec-burbujas').appendChild(b); }
    app.appendChild(raiz);
    const E = this.abierto = { raiz, input, o, capa: 'letras', mayus: input.value.length === 0 ? 1 : 0, bloqueo: false, tMayus: 0 };
    input.readOnly = true; input.setAttribute('inputmode', 'none'); input.blur();
    const texto = raiz.querySelector('.tec-texto span');
    E.pintarTexto = () => { texto.textContent = input.value || ''; texto.parentElement.classList.toggle('vacio', !input.value); texto.parentElement.dataset.ph = input.placeholder || ''; texto.parentElement.scrollLeft = 1e5; };
    raiz.querySelector('.tec-cerrar').onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); this.cerrar(); };
    raiz.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.dibujar(); E.pintarTexto();
    requestAnimationFrame(() => raiz.classList.add('dentro'));
    return raiz;
  },
  cerrar(sinAviso = false) {
    const E = this.abierto; if (!E) return;
    this.abierto = null;
    clearInterval(E.repite); clearTimeout(E.tLargo);
    E.input.readOnly = false; E.input.removeAttribute('inputmode');
    E.raiz.classList.remove('dentro'); E.raiz.classList.add('fuera');
    setTimeout(() => E.raiz.remove(), 260);
    if (!sinAviso && E.o.alCerrar) E.o.alCerrar();
  },
  dibujar() {
    const E = this.abierto, filas = E.raiz.querySelector('.tec-filas');
    const capa = E.capa === 'simbolos' ? SIMBOLOS : E.capa === 'emojis' ? EMOJIS : LETRAS;
    filas.innerHTML = '';
    E.raiz.classList.toggle('mayus', E.mayus > 0); E.raiz.classList.toggle('bloqueo', E.bloqueo);
    capa.forEach((fila, j) => {
      const f = document.createElement('div'); f.className = 'tec-fila f' + j;
      for (const k of fila) {
        const b = document.createElement('button'); b.className = 'tecla-aero'; b.type = 'button';
        const esp = ESPECIAL[k];
        if (esp) b.classList.add('esp', esp);
        const vis = k === ' ' ? '' : !esp && E.capa === 'letras' && E.mayus ? k.toUpperCase() : k;
        b.innerHTML = `<span>${vis}</span>`;
        if (k === ' ') b.innerHTML = '<span class="barra-esp"></span>';
        b.dataset.k = k;
        this.enganchar(b, k);
        f.appendChild(b);
      }
      filas.appendChild(f);
    });
  },
  enganchar(b, k) {
    const E = this.abierto;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!this.abierto) return;
      b.classList.add('apretada');
      this.globo(b, k);
      E.o.sonido && E.o.sonido(k);
      if (navigator.vibrate) try { navigator.vibrate(8); } catch { /* nada */ }
      /* sostenido: ⌫ repite; una vocal abre los acentos */
      if (k === '⌫') { this.tecla(k); E.repite = setTimeout(() => { E.repite = setInterval(() => this.tecla('⌫'), 55); }, 380); return; }
      const acentos = E.capa === 'letras' ? ACENTOS[k] : E.capa === 'simbolos' ? ACENTOS[k] : null;
      E.tLargo = acentos ? setTimeout(() => { E.acentoDe = k; this.mostrarAcentos(b, acentos); }, 420) : null;
    });
    const soltar = (e, vale = true) => {
      if (!b.classList.contains('apretada')) return;
      b.classList.remove('apretada'); clearTimeout(E.tLargo); clearTimeout(E.repite); clearInterval(E.repite);
      E.raiz.querySelector('.tec-globo')?.remove();
      if (k === '⌫') return;
      if (E.acentos) { const elegido = E.acentos.querySelector('.si'); const v = elegido ? elegido.dataset.v : null; E.acentos.remove(); E.acentos = null; if (v && vale) this.escribir(v); return; }
      if (vale) this.tecla(k);
    };
    b.addEventListener('pointerup', (e) => soltar(e));
    b.addEventListener('pointercancel', (e) => soltar(e, false));
    b.addEventListener('pointerleave', () => { if (!E.acentos) { b.classList.remove('apretada'); clearTimeout(E.tLargo); clearTimeout(E.repite); clearInterval(E.repite); E.raiz.querySelector('.tec-globo')?.remove(); } });
    /* deslizar sobre los acentos marca el elegido */
    b.addEventListener('pointermove', (e) => {
      if (!E.acentos) return;
      let mejor = null, md = 1e9;
      for (const q of E.acentos.children) { const r = q.getBoundingClientRect(), d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); if (d < md) { md = d; mejor = q; } }
      for (const q of E.acentos.children) q.classList.toggle('si', q === mejor);
    });
  },
  /* la burbuja con la letra, arriba de la tecla */
  globo(b, k) {
    const E = this.abierto; if (ESPECIAL[k]) return;
    E.raiz.querySelector('.tec-globo')?.remove();
    const g = document.createElement('div'); g.className = 'tec-globo';
    g.textContent = E.capa === 'letras' && E.mayus ? k.toUpperCase() : k;
    g.style.left = (b.offsetLeft + b.offsetWidth / 2) + 'px'; g.style.top = (b.offsetTop + b.parentElement.offsetTop) + 'px';
    E.raiz.querySelector('.tec-filas').appendChild(g);
  },
  mostrarAcentos(b, lista) {
    const E = this.abierto;
    E.raiz.querySelector('.tec-globo')?.remove();
    const p = document.createElement('div'); p.className = 'tec-acentos';
    const mayus = E.capa === 'letras' && E.mayus;
    [...lista].forEach((c, i) => { const q = document.createElement('span'); q.dataset.v = mayus ? c.toUpperCase() : c; q.textContent = q.dataset.v; if (i === 0) q.classList.add('si'); p.appendChild(q); });
    p.style.left = (b.offsetLeft + b.offsetWidth / 2) + 'px'; p.style.top = (b.offsetTop + b.parentElement.offsetTop) + 'px';
    E.raiz.querySelector('.tec-filas').appendChild(p);
    E.acentos = p;
  },
  escribir(c) {
    const E = this.abierto, I = E.input, max = +I.maxLength > 0 ? +I.maxLength : 999;
    if ([...I.value].length >= max) { E.raiz.classList.add('lleno'); setTimeout(() => E.raiz.classList.remove('lleno'), 300); return; }
    I.value += c;
    I.dispatchEvent(new Event('input', { bubbles: true }));
    if (E.mayus === 1 && !E.bloqueo && E.capa === 'letras') { E.mayus = 0; this.dibujar(); }
    E.pintarTexto();
  },
  tecla(k) {
    const E = this.abierto; if (!E) return;
    const I = E.input;
    switch (ESPECIAL[k]) {
      case 'mayus': {
        const ahora = performance.now();
        if (E.bloqueo) { E.bloqueo = false; E.mayus = 0; }
        else if (E.mayus && ahora - E.tMayus < 350) E.bloqueo = true;
        else E.mayus = E.mayus ? 0 : 1;
        E.tMayus = ahora; this.dibujar(); return;
      }
      case 'borra': { const c = [...I.value]; c.pop(); I.value = c.join(''); I.dispatchEvent(new Event('input', { bubbles: true })); if (!I.value && E.capa === 'letras' && !E.mayus) { E.mayus = 1; this.dibujar(); } E.pintarTexto(); return; }
      case 'simbolos': E.capa = 'simbolos'; this.dibujar(); return;
      case 'letras': E.capa = 'letras'; this.dibujar(); return;
      case 'emojis': E.capa = 'emojis'; this.dibujar(); return;
      case 'espacio': this.escribir(' '); return;
      case 'enviar': { const f = E.o.alEnviar; this.cerrar(true); if (f) f(); return; }
    }
    this.escribir(E.capa === 'letras' && E.mayus ? k.toUpperCase() : k);
    /* después de un signo de fin de frase, la próxima va en mayúscula */
    if (E.capa !== 'letras' && '.!?'.includes(k)) { E.capa = 'letras'; E.mayus = 1; this.dibujar(); }
  },
};
