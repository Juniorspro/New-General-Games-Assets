/* ============================================================================
   La intro de JXSTUDIOS en tinta sumi-e: trazo caligráfico con pincel mojado,
   sello rojo japonés que se estampa con un golpe, agua que cae.
   ========================================================================== */

function trazoSuave(g, puntos, grosor, alfa) {
  if (puntos.length < 2) return;
  g.globalAlpha = alfa || 1;
  g.strokeStyle = 'rgba(21, 18, 16, 0.8)';
  g.lineWidth = grosor;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(puntos[0].x, puntos[0].y);
  for (let i = 1; i < puntos.length; i++) {
    const p = puntos[i], pp = puntos[i - 1];
    const cx = (pp.x + p.x) / 2, cy = (pp.y + p.y) / 2;
    g.quadraticCurveTo(pp.x, pp.y, cx, cy);
  }
  g.stroke();
}

function selloRojo(g, cx, cy, r, presion) {
  g.save();
  g.globalAlpha = Math.min(1, presion * 2);
  g.fillStyle = '#c41e3a';

  g.translate(cx, cy);
  g.rotate(Math.random() * 0.2 - 0.1);

  for (let i = 0; i < 3; i++) {
    const rr = r - i * 4;
    g.globalAlpha = Math.min(1, presion * 2) * (1 - i * 0.3);
    g.fillRect(-rr, -rr, rr * 2, rr * 2);
  }

  g.globalAlpha = Math.min(1, presion * 2) * 0.6;
  g.fillStyle = '#8b0000';
  g.fillRect(-r * 0.4, -r * 0.1, r * 0.8, r * 0.2);
  g.fillRect(-r * 0.1, -r * 0.4, r * 0.2, r * 0.8);

  g.restore();
}

const ESTILO_SUMI = {
  negro: '#f5f5f0',
  chispa: 1,
  anchoLogo: (Wl) => Math.round(Wl * 0.7),
  puntas: ['#151210', '#4a4540', '#7a6f68'],
  golpe: ['#c41e3a', '#8b0000', '#ff6b6b', '#ff8c8c', '#ffa8a8'],
  destello: 'rgba(0,0,0,0.1)',
  fondo(Wl, Hl) {
    const [c, g] = lienzoHD(Wl, Hl);
    const gr = g.createLinearGradient(0, 0, 0, Hl);
    gr.addColorStop(0, '#faf8f4');
    gr.addColorStop(0.5, '#f5f3f0');
    gr.addColorStop(1, '#f0ede8');
    g.fillStyle = gr;
    g.fillRect(0, 0, Wl, Hl);

    for (let i = 0; i < 20; i++) {
      g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.03) + ')';
      g.fillRect(Math.random() * Wl, Math.random() * Hl, 50 + Math.random() * 100, 1);
    }
    return c;
  },
  logo(g, i) {
    const t = i.avance, golpe = i.golpe ? i.tGolpe : 0;
    const ox = i.x0, oy = i.y0;

    if (t < 0.3) {
      const tt = t / 0.3;
      const puntos = [];
      const pasos = Math.floor(tt * 20);
      for (let j = 0; j <= pasos; j++) {
        const tt2 = j / 20;
        puntos.push({
          x: ox - i.esc * 40 + tt2 * i.esc * 80,
          y: oy - i.esc * 20 + Math.sin(tt2 * 3.14) * i.esc * 20
        });
      }
      trazoSuave(g, puntos, i.esc * 8, tt);
    } else if (t < 0.6) {
      const tt = (t - 0.3) / 0.3;
      const puntos = [];
      for (let j = 0; j <= 20; j++) {
        const tt2 = j / 20;
        puntos.push({
          x: ox - i.esc * 40 + tt2 * i.esc * 80,
          y: oy - i.esc * 20 + Math.sin(tt2 * 3.14) * i.esc * 20
        });
      }
      trazoSuave(g, puntos, i.esc * 8, 1 - tt * 0.3);
    }

    if (t > 0.5) {
      selloRojo(g, i.cx, i.y0 + i.esc * 50, i.esc * 20, Math.min(1, (t - 0.5) * 2));
    }

    if (i.golpe && golpe < 0.3) {
      g.globalAlpha = (1 - golpe / 0.3) * 0.4;
      g.fillStyle = '#c41e3a';
      g.fillRect(i.x0 - i.esc * 80, i.y0 - i.esc * 40, i.esc * 160, i.esc * 120);
    }
  },
  letras(g, parte, I, t, y) {
    const tam = 28;
    g.globalAlpha = Math.min(1, Math.max(0, (t - 0.4) * 3));
    texto(g, parte, I.cx, y, { tam, alin: 'center', col: '#151210', cursiva: false, peso: 'bold' });
  },
  presentaTxt(g, txt, I, t, y) {
    g.globalAlpha = Math.min(1, Math.max(0, (t - 0.55) * 2));
    texto(g, txt.toUpperCase(), I.cx, y + 30, { tam: 12, col: '#7a6f68', cursiva: false, peso: '700' });
  },
  jingle(ctx, bus, t0, tg, h) {
    const { tono, soplo, T } = h;
    tono('sine', 82, 0, 1.5, 30, t0 + 0.2);
    soplo(0.3, 0.2, 'lowpass', 4000, 800, t0 + 0.2);
    [0, 3, 7].forEach((d, i) => {
      tono('triangle', 164 * Math.pow(2, d / 12), 0, 0.8, 0.3, tg + i * 0.15);
    });
  },
};
