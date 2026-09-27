
/* ====================== menús y flujo ======================
   Portada con el mapa de fondo y la cámara paneando; JUGAR elige modo, mapa, bando, dificultad y largo con las ilustraciones
   generadas; la carga monta el mapa (luz horneada), la navegación y la partida. Pausa, fin con la tabla, arsenal (el arma en
   primera persona sobre el fondo, con inspección y recarga), cómo se juega, ajustes e idiomas. */
const MENU = {capa:null, t:0, mapaMontado:null, arsenalId:'ak47'};
const TACTIL_DISP = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const TXT = {
  es:{JUGAR:'JUGAR', ARSENAL:'ARSENAL', 'CÓMO SE JUEGA':'CÓMO SE JUEGA', AJUSTES:'AJUSTES', EMPEZAR:'EMPEZAR', VOLVER:'VOLVER'},
  en:{JUGAR:'PLAY', ARSENAL:'ARSENAL', 'CÓMO SE JUEGA':'HOW TO PLAY', AJUSTES:'SETTINGS', EMPEZAR:'START', VOLVER:'BACK', 'MODO DE JUEGO':'GAME MODE', 'ELEGÍ CÓMO':'CHOOSE HOW',
    SEGUIR:'RESUME', ABANDONAR:'QUIT', PAUSA:'PAUSE', 'OTRA PARTIDA':'PLAY AGAIN', 'MENÚ':'MENU', VICTORIA:'VICTORY', DERROTA:'DEFEAT', INSPECCIONAR:'INSPECT', RECARGAR:'RELOAD', COMPRAR:'BUY', CERRAR:'CLOSE',
    'GANAN LOS CT':'COUNTER-TERRORISTS WIN', 'GANAN LOS T':'TERRORISTS WIN', 'BOMBA PLANTADA EN ':'BOMB PLANTED AT ', 'BOMBA DESACTIVADA':'BOMB DEFUSED', 'CAMBIO DE LADO':'SWITCHING SIDES',
    'NO TE ALCANZA':'NOT ENOUGH MONEY', 'YA LO TENÉS':'ALREADY OWNED', 'NO PODÉS COMPRAR ACÁ':'YOU CAN\'T BUY HERE', BAJA:'KILL', '¡A LA CABEZA!':'HEADSHOT!', PISTOLAS:'PISTOLS', SUBFUSILES:'SMGS', RIFLES:'RIFLES', EQUIPO:'GEAR', GRANADAS:'GRENADES',
    'BOMBA':'BOMB', 'COMBATE A MUERTE':'DEATHMATCH', 'CARRERA DE ARMAS':'ARMS RACE', 'FÁCIL':'EASY', 'DIFÍCIL':'HARD', CORTA:'SHORT', LARGA:'LONG', BANDO:'SIDE', DIFICULTAD:'DIFFICULTY', PARTIDA:'MATCH',
    'SENSIBILIDAD':'SENSITIVITY', 'ESTILO':'STYLE', 'HISTORIETA':'COMIC', 'GRÁFICOS':'GRAPHICS', 'SONIDO':'SOUND', 'MIRA':'CROSSHAIR', 'SÍ':'ON', 'NO':'OFF', 'CARGANDO':'LOADING',
    MANDOS:'CONTROLS', OPACIDAD:'OPACITY', ZURDO:'LEFT-HANDED', PALANCA:'STICK', FIJA:'FIXED', FLOTANTE:'FLOATING', VIBRAR:'VIBRATE', RESTABLECER:'RESET', LISTO:'DONE',
    'ARRASTRÁ CADA BOTÓN ADONDE TE QUEDE CÓMODO · TOCALO PARA CAMBIARLE EL TAMAÑO':'DRAG EACH BUTTON WHERE IT FEELS RIGHT · TAP IT TO CHANGE ITS SIZE'},
  pt:{JUGAR:'JOGAR', ARSENAL:'ARSENAL', 'CÓMO SE JUEGA':'COMO JOGAR', AJUSTES:'AJUSTES', EMPEZAR:'COMEÇAR', VOLVER:'VOLTAR', 'MODO DE JUEGO':'MODO DE JOGO', 'ELEGÍ CÓMO':'ESCOLHA COMO',
    SEGUIR:'CONTINUAR', ABANDONAR:'SAIR', PAUSA:'PAUSA', 'OTRA PARTIDA':'JOGAR DE NOVO', 'MENÚ':'MENU', VICTORIA:'VITÓRIA', DERROTA:'DERROTA', INSPECCIONAR:'INSPECIONAR', RECARGAR:'RECARREGAR', COMPRAR:'COMPRAR', CERRAR:'FECHAR',
    'GANAN LOS CT':'CONTRATERRORISTAS VENCEM', 'GANAN LOS T':'TERRORISTAS VENCEM', 'BOMBA PLANTADA EN ':'BOMBA PLANTADA NO ', 'BOMBA DESACTIVADA':'BOMBA DESARMADA', 'CAMBIO DE LADO':'TROCA DE LADO',
    'NO TE ALCANZA':'DINHEIRO INSUFICIENTE', 'YA LO TENÉS':'VOCÊ JÁ TEM', 'NO PODÉS COMPRAR ACÁ':'NÃO PODE COMPRAR AQUI', BAJA:'ABATE', '¡A LA CABEZA!':'NA CABEÇA!', PISTOLAS:'PISTOLAS', SUBFUSILES:'SUBMETRALHADORAS', RIFLES:'FUZIS', EQUIPO:'EQUIPAMENTO', GRANADAS:'GRANADAS',
    'BOMBA':'BOMBA', 'COMBATE A MUERTE':'MATA-MATA', 'CARRERA DE ARMAS':'CORRIDA ARMAMENTISTA', 'FÁCIL':'FÁCIL', 'DIFÍCIL':'DIFÍCIL', CORTA:'CURTA', LARGA:'LONGA', BANDO:'LADO', DIFICULTAD:'DIFICULDADE', PARTIDA:'PARTIDA',
    'SENSIBILIDAD':'SENSIBILIDADE', 'ESTILO':'ESTILO', 'HISTORIETA':'QUADRINHOS', 'GRÁFICOS':'GRÁFICOS', 'SONIDO':'SOM', 'MIRA':'MIRA', 'SÍ':'SIM', 'NO':'NÃO', 'CARGANDO':'CARREGANDO',
    MANDOS:'CONTROLES', OPACIDAD:'OPACIDADE', ZURDO:'CANHOTO', PALANCA:'ANALÓGICO', FIJA:'FIXO', FLOTANTE:'FLUTUANTE', VIBRAR:'VIBRAR', RESTABLECER:'REDEFINIR', LISTO:'PRONTO',
    'ARRASTRÁ CADA BOTÓN ADONDE TE QUEDE CÓMODO · TOCALO PARA CAMBIARLE EL TAMAÑO':'ARRASTE CADA BOTÃO PARA ONDE FICAR CONFORTÁVEL · TOQUE PARA MUDAR O TAMANHO'}};
function tr(s){ const l = G.idioma || 'es', D = TXT[l]; if(!D || l === 'es') return s; if(D[s]) return D[s]; let out = s; for(const k of Object.keys(D).sort((a, b)=> b.length - a.length)) if(k.length > 3 && out.includes(k)) out = out.split(k).join(D[k]); return out; }
function traducirDOM(){ document.querySelectorAll('.capa button span, .capa h2, .capa h2 small').forEach(el=>{ if(!el.dataset.es) el.dataset.es = el.childNodes[el.childNodes.length - 1].textContent; const n = el.childNodes[el.childNodes.length - 1]; if(n.nodeType === 3) n.textContent = tr(el.dataset.es); }); }
function mostrar(id){ if(id && typeof hg !== 'undefined'){ hg.setTransform(1, 0, 0, 1, 0, 0); hg.clearRect(0, 0, cvH.width, cvH.height); } for(const c of document.querySelectorAll('.capa')) c.classList.remove('ver'); if(id){ $(id).classList.add('ver'); } MENU.capa = id; traducirDOM();
  $('mandos').classList.toggle('ver', !id && J.partida && TACTIL_DISP); if(id && document.exitPointerLock) document.exitPointerLock(); }
/* deslizar las capas con el dedo si no entran: con la pantalla girada por CSS el desplazamiento nativo va para el otro lado (y
   touch-action:none lo apaga). Se mide en coordenadas del juego; un arrastre no aprieta el botón donde empezó */
(function(){ let c = null, y0 = 0, s0 = 0, movio = false;
  addEventListener('touchstart', ev=>{ c = null; if(ev.touches.length !== 1 || !ev.target.closest) return; const cp = ev.target.closest('.capa.ver'); if(!cp || cp.scrollHeight <= cp.clientHeight + 2) return;
    c = cp; y0 = aJuego(ev.touches[0]).y; s0 = cp.scrollTop; movio = false; }, {passive:true});
  addEventListener('touchmove', ev=>{ if(!c || !ev.touches[0]) return; const dy = aJuego(ev.touches[0]).y - y0; if(Math.abs(dy) > 8) movio = true; if(movio) c.scrollTop = s0 - dy; }, {passive:true});
  addEventListener('touchend', ()=>{ if(c && movio) MENU.arrastreT = performance.now(); c = null; }, {passive:true});
  addEventListener('click', ev=>{ if(performance.now() - (MENU.arrastreT || -1e9) < 400){ ev.stopPropagation(); ev.preventDefault(); } }, true); })();
/* ---------- fondo de los menús: paneo lento por el mapa montado ---------- */
function pasarMenu(dt){ MENU.t += dt; const O = OBRA, S = (O.spawns.dm.length ? O.spawns.dm : O.spawns.ct), n = S.length || 1, k = Math.floor(MENU.t/9) % n, u = (MENU.t % 9)/9, s = S[k] || {x:0, y:0, z:0};
  cam.position.set(s.x + Math.sin(MENU.t*0.1)*2, s.y + 2.2 + u*0.6, s.z + Math.cos(MENU.t*0.1)*2); cam.rotation.set(-0.08, MENU.t*0.06 + k*1.3, 0, 'YXZ'); if(cam.fov !== 74){ cam.fov = 74; cam.updateProjectionMatrix(); } cam.updateMatrixWorld();
  if(MENU.capa === 'capaArsenal' && VM.arma){ VM.raiz.visible = true; vmCuadro({dt, giroX:0, giroY:Math.sin(MENU.t*0.8)*0.3, vel:0, suelo:true}); luzVM(dt); } else if(VM.raiz) VM.raiz.visible = false; }
/* ---------- JUGAR ---------- */
const ELEC = {modo:G.modo || 'bomba', mapa:G.mapa || 'nuclear', bando:G.bando || 'ct', dificultad:G.dificultad || 'normal', largo:G.largo || 'corta'};
function tarjeta(titulo, sub, img, ya, fn){ const el = document.createElement('div'); el.className = 'tarjeta' + (ya ? ' ya' : ''); el.style.setProperty('--r', ((Math.random() - 0.5)*3).toFixed(1) + 'deg');
  if(ARCH[img]) el.style.backgroundImage = 'url(' + ARCH[img] + ')'; el.innerHTML = '<small>' + sub + '</small><b>' + titulo + '</b>'; el.addEventListener('click', ()=>{ if(window.sonarUI) sonarUI('ui_toque'); fn(); }); return el; }
function armarJugar(){
  const fm = $('filaModos'), fp = $('filaMapas'), el = $('elecciones'); fm.innerHTML = ''; fp.innerHTML = ''; el.innerHTML = '';
  const modos = {bomba:['BOMBA', '5 CONTRA 5', 'arte/arte_modo_bomba'], dm:['COMBATE A MUERTE', 'TODOS CONTRA TODOS', 'arte/arte_modo_dm'], armas:['CARRERA DE ARMAS', '9 ARMAS', 'arte/arte_modo_armas']};
  for(const k in modos) fm.appendChild(tarjeta(tr(modos[k][0]), tr(modos[k][1]), modos[k][2], ELEC.modo === k, ()=>{ ELEC.modo = k; if(!MAPAS[ELEC.mapa].modos.includes(k)) ELEC.mapa = 'nuclear'; armarJugar(); }));
  for(const k in MAPAS){ if(!MAPAS[k].modos.includes(ELEC.modo)) continue; fp.appendChild(tarjeta(MAPAS[k].nombre, tr('MAPA'), 'arte/arte_' + k, ELEC.mapa === k, ()=>{ ELEC.mapa = k; armarJugar(); })); }
  const grupo = (tit, clave, ops)=>{ const g = document.createElement('div'); g.className = 'grupo'; g.innerHTML = '<span>' + tr(tit) + '</span>';
    for(const [v, nom, cl] of ops){ const b = document.createElement('button'); b.className = 'boton chico ' + (cl || '') + (ELEC[clave] === v ? ' ya' : ''); b.innerHTML = '<span>' + tr(nom) + '</span>'; b.addEventListener('click', ()=>{ ELEC[clave] = v; armarJugar(); }); g.appendChild(b); }
    el.appendChild(g); };
  if(ELEC.modo === 'bomba'){ grupo('BANDO', 'bando', [['ct', 'CT', 'ct'], ['t', 'T', 't']]); grupo('PARTIDA', 'largo', [['corta', 'CORTA'], ['larga', 'LARGA']]); }
  grupo('DIFICULTAD', 'dificultad', [['facil', 'FÁCIL'], ['normal', 'NORMAL'], ['dificil', 'DIFÍCIL']]);
}
async function empezarPartida(){
  Object.assign(G, ELEC); guardar(); mostrar(null); const car = $('carga'); car.style.display = 'flex'; if($('consejo')) $('consejo').textContent = tr(['TIRÁ QUIETO: MOVIÉNDOTE LAS BALAS SE ABREN', 'CONTROLÁ EL RETROCESO TIRANDO PARA ABAJO', 'LA CABEZA SACA CUATRO VECES MÁS', 'EL HUMO TAPA LA VISTA DE LOS BOTS', 'CON EL KIT DESACTIVÁS EN 5 SEGUNDOS'][Math.floor(Math.random()*5)]);
  const barra = document.querySelector('#carga .barra2 i');
  await new Promise(r=> setTimeout(r, 30));
  if(MENU.mapaMontado !== G.mapa){ const M = MAPAS[G.mapa]; ponerCielo(M.cielo, M.sol); await montarMapa(G.mapa, M.construir, {}, f=>{ if(barra) barra.style.width = Math.round(f*90) + '%'; }); MENU.mapaMontado = G.mapa; }
  armarNav(); HUD.radar = null; if(barra) barra.style.width = '100%';
  iniciarPartida({modo:G.modo, bando:G.bando}); vmEstilo(PARTIDA.jugador.bando === 't' ? 't' : 'ct'); equipar(PARTIDA.jugador, PARTIDA.jugador.actual); PARTIDA.jugador.saca = 0; vmSacar(PARTIDA.jugador.actual);
  J.partida = true; J.pausa = false; car.style.display = 'none'; mostrar(null); mandosIniciar(); if(window.musica) musica('mus_ronda'); if(window.vozRadio) vozRadio('vamos');
}
window.alTerminarPartida = function(){
  const j = PARTIDA.jugador; let gano;
  if(PARTIDA.modo === 'bomba') gano = PARTIDA.ganadas[j.bando] > PARTIDA.ganadas[j.bando === 't' ? 'ct' : 't'];
  else if(PARTIDA.modo === 'armas') gano = PARTIDA.ganadorArmas === j;
  else gano = ACTORES.slice().sort((a, b)=> b.bajas - a.bajas)[0] === j;
  G.partidas = (G.partidas || 0) + 1; if(gano) G.victorias = (G.victorias || 0) + 1; G.bajas = (G.bajas || 0) + j.bajas; G.muertes = (G.muertes || 0) + j.muertes; G.xp = (G.xp || 0) + j.bajas*20 + (gano ? 300 : 80); guardar();
  setTimeout(()=>{ J.partida = false; $('finTit').textContent = tr(gano ? 'VICTORIA' : 'DERROTA'); $('finSub').textContent = PARTIDA.modo === 'bomba' ? 'CT ' + PARTIDA.ganadas.ct + ' — ' + PARTIDA.ganadas.t + ' T' : j.bajas + ' / ' + j.muertes;
    let h = '<tr><th></th><th>B</th><th>M</th><th>A</th><th>MVP</th></tr>'; for(const a of ACTORES.slice().sort((x, y)=> y.bajas - x.bajas)) h += '<tr style="color:' + (a.bando === 'ct' ? '#b9d0ff' : a.bando === 't' ? '#ffe0a8' : '#fff') + (a === j ? ';background:rgba(255,210,63,.2)' : '') + '"><td>' + a.nombre + '</td><td>' + a.bajas + '</td><td>' + a.muertes + '</td><td>' + a.asist + '</td><td>' + (a.mvp ? '★' + a.mvp : '') + '</td></tr>';
    $('finTabla').innerHTML = h; mostrar('capaFin'); if(window.musica) musica(gano ? 'mus_victoria' : 'mus_derrota'); }, 2500);
};
function pausar(){ if(!J.partida) return; J.pausa = true; mostrar('capaPausa'); }
/* ---------- arsenal ---------- */
function armarArsenal(){ const L = $('arsenalLista'); L.innerHTML = ''; for(const id of ['glock', 'usps', 'deagle', 'mac10', 'mp9', 'ak47', 'm4s', 'awp', 'cuchillo', 'he', 'flash', 'humo', 'c4']){
    const b = document.createElement('button'); b.className = 'boton chico' + (MENU.arsenalId === id ? ' ya' : ''); b.innerHTML = '<span>' + ARMAS[id].nom + '</span>'; b.addEventListener('click', ()=>{ MENU.arsenalId = id; vmSacar(id); armarArsenal(); }); L.appendChild(b); }
  const W = ARMAS[MENU.arsenalId], f = $('arsenalFicha'); const barra = (n, v)=> '<div class="barra"><span>' + n + '</span><i><b style="width:' + Math.round(lim(v, 0, 1)*100) + '%"></b></i></div>';
  f.innerHTML = '<h2 style="font-size:20px"><small>$' + W.precio + '</small>' + W.nom + '</h2>' + (W.dmg ? barra('DAÑO', W.dmg/115) + barra('CADENCIA', (W.rpm || 0)/900) + barra('PRECISIÓN', 1 - ((W.impr && W.impr.quieto) || 1)/5) + barra('MOVILIDAD', (W.vel/U - 180)/80) + (W.carg ? barra('CARGADOR ' + W.carg, W.carg/30) : '') : ''); }
/* ---------- ajustes ---------- */
function armarAjustes(){ guardar(); const s = (id, t)=>{ $(id).querySelector('span').textContent = tr(t); }; s('btMandos', 'MANDOS');
  s('btSens', 'SENSIBILIDAD: ' + G.sens); s('btEstilo', 'ESTILO: ' + (G.estilo === 'tinta' ? 'HISTORIETA' : 'NORMAL')); s('btGraf', 'GRÁFICOS: ' + (G.graficos || 'auto').toUpperCase()); s('btSonido', 'SONIDO: ' + (G.sonido !== false ? 'SÍ' : 'NO')); s('btMiraCol', 'MIRA: ' + (G.mira || 'verde').toUpperCase()); }
function menusIniciar(){
  const clic = (id, fn)=> $(id) && $(id).addEventListener('click', ()=>{ if(window.sonarUI) sonarUI('ui_toque'); fn(); });
  clic('btJugar', ()=>{ armarJugar(); mostrar('capaJugar'); }); clic('btJugarVolver', ()=> mostrar('capaTitulo')); clic('btEmpezar', empezarPartida);
  clic('btArsenal', ()=>{ vmEstilo('ct'); vmSacar(MENU.arsenalId); armarArsenal(); mostrar('capaArsenal'); }); clic('btArsenalVolver', ()=> mostrar('capaTitulo'));
  clic('btInspeccionar', ()=> vmClip(ARMAS[MENU.arsenalId].clase === 'cuchillo' ? 'inspeccionar' : 'inspeccionar')); clic('btRecargarA', ()=>{ const W = ARMAS[MENU.arsenalId]; if(W.carg) vmClip('recarga', {dur:W.recarga}); else if(W.clase === 'cuchillo') vmClip('ataque1'); else if(W.clase === 'granada') vmClip('preparar'); });
  clic('btComo', ()=>{ $('comoTxt').innerHTML = tr('<b>MOVERSE:</b> palanca a la izquierda (poco = caminar sin hacer ruido). <b>MIRAR:</b> arrastrá a la derecha. <b>TIRAR:</b> botón rojo (también mira si lo arrastrás). Tirá quieto o agachado: moviéndote las balas se abren. En ráfaga el arma sube: tirá la mira para abajo.<br><b>BOMBA:</b> los T plantan en A o B (sacá la bomba y mantené fuego adentro del sitio); los CT la desactivan (mantené USAR, con kit en 5 s). Entre rondas se compra con la plata que ganás.<br><b>PC:</b> WASD, mouse, R recarga, F inspecciona, E usar, B comprar, 1-5 armas, TAB marcador, SHIFT caminar, CTRL agacharse.'); mostrar('capaComo'); });
  clic('btComoVolver', ()=> mostrar('capaTitulo'));
  clic('btAjustes', ()=>{ armarAjustes(); MENU.volverAj = 'capaTitulo'; mostrar('capaAjustes'); }); clic('btPausaAjustes', ()=>{ armarAjustes(); MENU.volverAj = 'capaPausa'; mostrar('capaAjustes'); });
  clic('btAjVolver', ()=>{ guardar(); mostrar(MENU.volverAj || 'capaTitulo'); });
  clic('btSens', ()=>{ G.sens = G.sens >= 10 ? 1 : G.sens + 1; armarAjustes(); }); clic('btEstilo', ()=>{ G.estilo = G.estilo === 'tinta' ? 'normal' : 'tinta'; armarAjustes(); });
  clic('btGraf', ()=>{ const o = ['auto', 'altos', 'medios', 'bajos'], i = o.indexOf(G.graficos || 'auto'); G.graficos = o[(i + 1) % 4]; aplicarGraficos(); armarAjustes(); });
  clic('btSonido', ()=>{ volumenGeneral(G.sonido === false); armarAjustes(); }); clic('btMiraCol', ()=>{ const o = ['verde', 'amarillo', 'blanco', 'cian', 'rosa'], i = o.indexOf(G.mira || 'verde'); G.mira = o[(i + 1) % o.length]; armarAjustes(); });
  clic('btSeguir', ()=>{ J.pausa = false; mostrar(null); }); clic('btSalir', ()=>{ J.partida = false; J.pausa = false; for(const a of ACTORES.slice()) quitarActor(a); mostrar('capaTitulo'); if(window.musica) musica('mus_menu'); });
  clic('btFinOtra', ()=>{ armarJugar(); mostrar('capaJugar'); }); clic('btFinMenu', ()=>{ for(const a of ACTORES.slice()) quitarActor(a); mostrar('capaTitulo'); if(window.musica) musica('mus_menu'); });
  clic('btCompraCerrar', ()=> cerrarCompra());
  document.querySelectorAll('#idiomas button').forEach(b=> b.addEventListener('click', ()=>{ G.idioma = b.dataset.l; guardar(); traducirDOM(); document.querySelectorAll('#idiomas button').forEach(x=> x.classList.toggle('ya', x === b)); }));
  /* Escape (y atrás en la APK): cierra lo abierto; en los menús, es el VOLVER de la pantalla que se ve */
  addEventListener('keydown', ev=>{ if(ev.code !== 'Escape') return;
    if(MENU.editando) cerrarEditorMandos(); else if(HUD.compraAbierta) cerrarCompra(); else if(J.partida && !J.pausa) pausar();
    else if(J.pausa && $('capaPausa').classList.contains('ver')) $('btSeguir').click();
    else { const v = document.querySelector('.capa.ver [id$="Volver"]'); if(v) v.click(); } });
  clic('btMandos', abrirEditorMandos);
  if(!G.idioma){ const n = (navigator.language || 'es').slice(0, 2); G.idioma = ['en', 'pt'].includes(n) ? n : 'es'; }
  document.querySelectorAll('#idiomas button').forEach(x=> x.classList.toggle('ya', x.dataset.l === G.idioma));
  const pf = $('perfilDato'); if(pf) pf.textContent = 'NIVEL ' + (1 + Math.floor((G.xp || 0)/1000)) + ' · ' + (G.victorias || 0) + ' VICTORIAS';
}
