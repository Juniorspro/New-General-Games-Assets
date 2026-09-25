/* ============================================================================
   aeroplaza/js/misiones.js — los vecinos (NPC), lo que dicen y lo que piden.
   Cada misión cuenta un tipo de cosa (mariposas, frutas, burbujas, aros,
   estrellas, géiseres, discos) y da orbes y algo para ponerse que no se vende.
   Estados: nueva → activa → lista (ya juntó todo) → hecha.
   ========================================================================== */
import { sumar, t } from './textos.js';

export const NPCS = {
  nimbo: { A: { color: '#ffffff', color2: '#9fe3ff', motivo: 'nubes', cubre: 0.5, material: 'gelatina', sombrero: 'gorro', peinado: 'ninguno', anteojos: 'redondos', espalda: 'ninguno', particulas: 'ninguna' }, mision: { tipo: 'mariposa', meta: 3, orbes: 20, cosas: ['sombrero:flor'] } },
  lima: { A: { color: '#9bff3d', color2: '#fff27a', motivo: 'hojas', cubre: 0.35, material: 'gelatina', sombrero: 'brote', peinado: 'ninguno', anteojos: 'ninguno', espalda: 'ninguno', particulas: 'hojas' }, mision: { tipo: 'fruta', meta: 3, orbes: 15, cosas: ['peinado:rulos'] } },
  burbu: { A: { color: '#8ff0ff', color2: '#ffffff', motivo: 'burbujas', cubre: 0.6, material: 'vidrio', sombrero: 'casco', peinado: 'ninguno', anteojos: 'ninguno', espalda: 'mochila', particulas: 'burbujas' }, mision: { tipo: 'burbuja', meta: 5, orbes: 10, cosas: ['motivo:burbujas'] } },
  vendedora: { A: { color: '#56e05a', color2: '#ffffff', motivo: 'ninguno', cubre: 0.3, material: 'perla', sombrero: 'gorra', peinado: 'colitas', colorPelo: '#ff9a3d', anteojos: 'ninguno', espalda: 'ninguno', particulas: 'ninguna' }, tienda: true },
  coral: { A: { color: '#ff7a8a', color2: '#ffe0b0', motivo: 'agua', cubre: 0.4, material: 'gelatina', sombrero: 'conico', peinado: 'melena', colorPelo: '#ffd23f', anteojos: 'sol', espalda: 'ninguno', particulas: 'ninguna' }, mision: { tipo: 'carrera', meta: 1, orbes: 25, cosas: ['espalda:aleta'] } },
  estela: { A: { color: '#9b7bff', color2: '#d9f7ff', motivo: 'galaxia', cubre: 0.7, material: 'neon', sombrero: 'ninguno', peinado: 'nube', colorPelo: '#ffffff', anteojos: 'visor', espalda: 'alas', particulas: 'estrellas' }, mision: { tipo: 'estrella', meta: 5, orbes: 20, cosas: ['sombrero:aureola', 'motivo:galaxia'] } },
  loto: { A: { color: '#ff9ad8', color2: '#fff6c2', motivo: 'flores', cubre: 0.45, material: 'perla', sombrero: 'flor', peinado: 'rodete', colorPelo: '#ffffff', anteojos: 'ninguno', espalda: 'ninguno', particulas: 'ninguna' }, mision: { tipo: 'geiser', meta: 3, orbes: 20, cosas: ['motivo:aurora'] } },
  guia: { A: { color: '#ffe14a', color2: '#ffffff', motivo: 'ninguno', cubre: 0.3, material: 'cromo', sombrero: 'auriculares', peinado: 'pinches', colorPelo: '#22262b', anteojos: 'ninguno', espalda: 'ninguno', particulas: 'notas' }, mision: { tipo: 'disco', meta: 6, orbes: 30, cosas: ['particulas:notas'] } },
  /* los de la isla grande: la exploradora del spawn, la de los molinos, el del bosque y la del faro */
  brujula: { A: { color: '#ffb13d', color2: '#fff6c2', motivo: 'tierra', cubre: 0.4, material: 'gelatina', sombrero: 'explorador', peinado: 'colitas', colorPelo: '#6b3f1f', anteojos: 'redondos', espalda: 'mochila', particulas: 'ninguna' }, mision: { tipo: 'lugar', meta: 6, orbes: 40, cosas: ['sombrero:explorador'] } },
  brisa: { A: { color: '#d9fff5', color2: '#39d6ff', motivo: 'nubes', cubre: 0.55, material: 'vidrio', sombrero: 'ninguno', peinado: 'nube', colorPelo: '#ffffff', anteojos: 'ninguno', espalda: 'molinete', particulas: 'hojas' }, mision: { tipo: 'molino', meta: 4, orbes: 25, cosas: ['espalda:molinete'] } },
  musgo: { A: { color: '#2f7a2f', color2: '#b6f03a', motivo: 'hojas', cubre: 0.5, material: 'mate', sombrero: 'hongo', peinado: 'ninguno', anteojos: 'ninguno', espalda: 'ninguno', particulas: 'hojas' }, mision: { tipo: 'hongo', meta: 5, orbes: 25, cosas: ['sombrero:hongo'] } },
  marea: { A: { color: '#1d4fbf', color2: '#ffffff', motivo: 'agua', cubre: 0.45, material: 'perla', sombrero: 'capitan', peinado: 'melena', colorPelo: '#ffd23f', anteojos: 'sol', espalda: 'ninguno', particulas: 'burbujas' }, mision: { tipo: 'botella', meta: 3, orbes: 30, cosas: ['sombrero:capitan'] } },
};

/* lo que dice cada uno, en los tres idiomas: saludo (y pide), recuerda, gracias, charla */
sumar({
  es: {
    d_nimbo_0: '¡Hola, recién llegado! Soy Nimbo. Esta es la plaza: acá se junta todo el mundo.|Me encantan las mariposas azules que andan por las flores… ¿Me atrapás 3? Pasá bien cerca de ellas.',
    d_nimbo_1: 'Las mariposas andan por las flores, cerca de los árboles. Llevás {n} de {m}.', d_nimbo_2: '¡Qué lindas! Tomá, una flor para la cabeza. Probátela en el probador.', d_nimbo_3: 'Si te aburrís, subite a una burbuja de la fuente: se manejan con el palito.',
    d_lima_0: 'Uy, hola. Soy Lima y cuido la huerta.|Las frutas de acá tienen poderes: una te agranda, otra te achica, otra te pinta… ¿Me probás 3 y me contás?',
    d_lima_1: 'Acercate a un árbol de la huerta y apretá usar para comer. Van {n} de {m}.', d_lima_2: '¡Sos de las mías! Te regalo unos rulos.', d_lima_3: 'La fruta dorada te hace brillar de noche. Probala cuando baje el sol.',
    d_burbu_0: 'Blub… ¡hola! Soy Burbu. Del lago salen burbujas enormes.|Reventame 5 de las grandes, tocándolas. ¡Me dan risa cuando hacen pop!',
    d_burbu_1: 'Las grandes suben del lago. Nadá o saltá hasta ellas. Van {n} de {m}.', d_burbu_2: '¡Pop pop pop! Tomá: un motivo de burbujas para tu cuerpo.', d_burbu_3: 'Con el burbujero (tecla F o ◎) podés tirarle burbujas a tus amigos. Sin lastimar, ¿eh?',
    d_vendedora_0: '¡Bienvenido a Aero·Mart! Soy Menta. Tengo ropa, anteojos, alas y más. Mirá lo que quieras.', d_vendedora_3: '¡Volvé cuando tengas más orbes!',
    d_coral_0: '¡Ey! Soy Coral. ¿Viste los aros dorados sobre el agua?|Si montás un delfín y pasás por todos, te doy mi aleta. El primer aro está junto al muelle.',
    d_coral_1: 'Montá un delfín (usar, cerca de uno) y pasá por los aros en orden.', d_coral_2: '¡Qué velocidad! La aleta es tuya.', d_coral_3: 'Abajo del agua hay un arrecife. Apretá bajar para bucear.',
    d_estela_0: 'Shh… acá siempre es de noche. Soy Estela.|Caen pedacitos de estrella. Si juntás 5 y los traés al cristal del centro, soñamos todos juntos.',
    d_estela_1: 'Buscá los destellos que caen del cielo. Llevás {n} de {m}.', d_estela_2: 'Brillás como ellas. Tomá una aureola y un motivo de galaxia.', d_estela_3: 'Cuantas más personas donan estrellas al cristal, antes llega el sueño colectivo.',
    d_loto_0: 'Bienvenida, bienvenido al jardín. Soy Loto.|Los géiseres te llevan al cielo si te parás encima cuando soplan. Subí con 3 distintos.',
    d_loto_1: 'Pará arriba de un géiser y esperá el chorro. Van {n} de {m}.', d_loto_2: '¡Volaste! Te regalo el motivo aurora.', d_loto_3: 'Las flores gigantes rebotan. Probá saltar de una a otra.',
    d_guia_0: '¡Hola! Soy la Guía. Colecciono música.|Hay 6 discos escondidos en los reinos. Cada uno trae una canción. ¿Los encontrás?',
    d_guia_1: 'Llevás {n} de {m} discos. Buscá cosas que brillen y giren.', d_guia_2: '¡La colección completa! Tomá: notas musicales que te siguen.', d_guia_3: 'Con la tecla 3 o el botón de música cambiás la canción que suena.',
    d_brujula_0: '¡Bienvenida, bienvenido a la isla! Soy Brújula y dibujé ese mapa.|La isla es enorme: hay una ciudad de vidrio, una bahía con faro, molinos, un bosque de hongos y un monte con cascada. ¿Me visitás seis lugares?',
    d_brujula_1: 'Mirá el mapa (tecla 5 o el cartel) y andá a los lugares: van {n} de {m}. El monorriel te lleva rápido.', d_brujula_2: '¡Conocés la isla mejor que yo! Tomá mi sombrero de explorador.', d_brujula_3: 'Desde la glorieta del monte se ve todo. Subí de noche: el faro gira.',
    d_brisa_0: 'Fiuuu… ¡hola! Soy Brisa. Los molinos de la pradera andan medio dormidos.|¿Me soplás cuatro? Acercate a la base y apretá usar.',
    d_brisa_1: 'Soplá los molinos de la pradera. Van {n} de {m}.', d_brisa_2: '¡Mirá cómo giran! Te regalo mi molinete: gira más cuando corrés.', d_brisa_3: 'Cuando sopla fuerte, los árboles de toda la isla se mecen juntos.',
    d_musgo_0: 'Shh, que se despiertan los hongos… Soy Musgo.|Si saltás arriba de un hongo, te tira bien alto. Rebotá en cinco distintos.',
    d_musgo_1: 'Saltá en los sombreritos de los hongos. Van {n} de {m}.', d_musgo_2: '¡Boing! Te ganaste un sombrero hongo, igual al mío.', d_musgo_3: 'Arriba de la casa del árbol hay algo que brilla y gira.',
    d_marea_0: '¡Ahoy! Soy Marea, cuido el faro.|El mar trae botellas con mensajes a las orillas de la isla. Encontrame tres y leelas.',
    d_marea_1: 'Buscá botellas en las playas, bien en la orilla. Van {n} de {m}.', d_marea_2: '¡Qué lindos mensajes! Tomá mi gorra de capitán.', d_marea_3: 'Si nadás hasta el islote del faro, vas a encontrar un disco.',
    premio_orbes: '{n} orbes',
  },
  en: {
    d_nimbo_0: "Hi, newcomer! I'm Nimbo. This is the plaza: everyone hangs out here.|I love the blue butterflies around the flowers… Could you catch 3 for me? Just get really close.",
    d_nimbo_1: 'Butterflies hover over the flowers, near the trees. {n} of {m} so far.', d_nimbo_2: 'So pretty! Here, a flower for your head. Try it on in the dressing room.', d_nimbo_3: "If you get bored, hop into a bubble at the fountain: you steer it with the stick.",
    d_lima_0: "Oh, hi. I'm Lime, I look after the orchard.|The fruit here has powers: one makes you big, one makes you small, one paints you… Try 3 and tell me?",
    d_lima_1: 'Walk up to an orchard tree and press use to eat. {n} of {m}.', d_lima_2: "You're one of us! Have some curls.", d_lima_3: 'The golden fruit makes you glow at night. Try it after sunset.',
    d_burbu_0: "Blub… hi! I'm Bubs. Huge bubbles rise from the lake.|Pop 5 of the big ones by touching them. They make me laugh when they pop!",
    d_burbu_1: 'The big ones rise from the lake. Swim or jump to them. {n} of {m}.', d_burbu_2: 'Pop pop pop! Here: a bubble pattern for your body.', d_burbu_3: 'With the bubbler (F key or ◎) you can throw bubbles at your friends. Gently, okay?',
    d_vendedora_0: "Welcome to Aero·Mart! I'm Mint. I've got clothes, glasses, wings and more. Have a look.", d_vendedora_3: 'Come back when you have more orbs!',
    d_coral_0: "Hey! I'm Coral. See the golden rings over the water?|Ride a dolphin through all of them and I'll give you my fin. The first ring is by the pier.",
    d_coral_1: 'Ride a dolphin (use, next to one) and go through the rings in order.', d_coral_2: 'What speed! The fin is yours.', d_coral_3: "There's a reef underwater. Press down to dive.",
    d_estela_0: "Shh… it's always night here. I'm Stella.|Star pieces fall from the sky. Bring 5 to the crystal in the middle and we'll all dream together.",
    d_estela_1: 'Look for the sparkles falling from the sky. {n} of {m}.', d_estela_2: 'You shine like them. Take a halo and a galaxy pattern.', d_estela_3: 'The more people give stars to the crystal, the sooner the collective dream comes.',
    d_loto_0: "Welcome to the garden. I'm Lotus.|The geysers launch you into the sky if you stand on them when they blow. Ride 3 different ones.",
    d_loto_1: 'Stand on a geyser and wait for the burst. {n} of {m}.', d_loto_2: 'You flew! Have the aurora pattern.', d_loto_3: 'The giant flowers are bouncy. Try jumping from one to another.',
    d_guia_0: "Hello! I'm the Guide. I collect music.|There are 6 discs hidden across the realms. Each one has a song. Can you find them?",
    d_guia_1: 'You have {n} of {m} discs. Look for things that shine and spin.', d_guia_2: 'The full collection! Take these music notes that follow you.', d_guia_3: 'Press 3 or the music button to change the song.',
    d_brujula_0: "Welcome to the island! I'm Compass and I drew that map.|The island is huge: there's a glass city, a bay with a lighthouse, windmills, a mushroom forest and a mountain with a waterfall. Will you visit six places for me?",
    d_brujula_1: 'Check the map (key 5 or the sign) and go explore: {n} of {m}. The monorail gets you there fast.', d_brujula_2: 'You know the island better than me! Take my explorer hat.', d_brujula_3: 'You can see everything from the mountain gazebo. Go up at night: the lighthouse spins.',
    d_brisa_0: "Whoosh… hi! I'm Breeze. The meadow windmills are half asleep.|Could you blow four of them? Walk up to the base and press use.",
    d_brisa_1: 'Blow the meadow windmills. {n} of {m}.', d_brisa_2: 'Look at them spin! Have my pinwheel: it spins faster when you run.', d_brisa_3: 'When the wind blows hard, the trees of the whole island sway together.',
    d_musgo_0: "Shh, don't wake the mushrooms… I'm Moss.|Jump on a mushroom and it bounces you way up. Bounce on five different ones.",
    d_musgo_1: 'Jump on the mushroom caps. {n} of {m}.', d_musgo_2: 'Boing! You earned a mushroom hat, just like mine.', d_musgo_3: "There's something shiny spinning up in the tree house.",
    d_marea_0: "Ahoy! I'm Tide, I keep the lighthouse.|The sea brings bottles with messages to the island shores. Find three and read them.",
    d_marea_1: 'Look for bottles on the beaches, right by the water. {n} of {m}.', d_marea_2: 'What lovely messages! Take my captain cap.', d_marea_3: "Swim to the lighthouse islet and you'll find a disc.",
    premio_orbes: '{n} orbs',
  },
  pt: {
    d_nimbo_0: 'Oi, recém-chegado! Sou o Nimbo. Esta é a praça: aqui todo mundo se encontra.|Adoro as borboletas azuis das flores… Pega 3 para mim? É só passar bem pertinho.',
    d_nimbo_1: 'As borboletas ficam nas flores, perto das árvores. Você tem {n} de {m}.', d_nimbo_2: 'Que lindas! Toma, uma flor para a cabeça. Experimente no provador.', d_nimbo_3: 'Se ficar entediado, entre numa bolha da fonte: dá para guiar com a alavanca.',
    d_lima_0: 'Ah, oi. Sou a Lima e cuido do pomar.|As frutas daqui têm poderes: uma te aumenta, outra te diminui, outra te pinta… Prova 3 e me conta?',
    d_lima_1: 'Chegue perto de uma árvore do pomar e aperte usar para comer. {n} de {m}.', d_lima_2: 'Você é dos meus! Te dou uns cachos.', d_lima_3: 'A fruta dourada faz você brilhar de noite. Prove quando o sol se pôr.',
    d_burbu_0: 'Blub… oi! Sou a Bolhinha. Do lago saem bolhas enormes.|Estoure 5 das grandes, encostando nelas. Eu rio quando fazem pop!',
    d_burbu_1: 'As grandes sobem do lago. Nade ou pule até elas. {n} de {m}.', d_burbu_2: 'Pop pop pop! Toma: uma estampa de bolhas para o seu corpo.', d_burbu_3: 'Com o bolheiro (tecla F ou ◎) você joga bolhas nos amigos. Sem machucar, hein?',
    d_vendedora_0: 'Bem-vindo à Aero·Mart! Sou a Menta. Tenho roupas, óculos, asas e mais. Olhe à vontade.', d_vendedora_3: 'Volte quando tiver mais orbes!',
    d_coral_0: 'Ei! Sou a Coral. Viu os aros dourados sobre a água?|Se montar num golfinho e passar por todos, te dou minha barbatana. O primeiro aro fica no píer.',
    d_coral_1: 'Monte num golfinho (usar, perto de um) e passe pelos aros em ordem.', d_coral_2: 'Que velocidade! A barbatana é sua.', d_coral_3: 'Embaixo da água tem um recife. Aperte descer para mergulhar.',
    d_estela_0: 'Shh… aqui é sempre noite. Sou a Estela.|Caem pedacinhos de estrela. Se juntar 5 e trouxer ao cristal do centro, sonhamos todos juntos.',
    d_estela_1: 'Procure os brilhos que caem do céu. Você tem {n} de {m}.', d_estela_2: 'Você brilha como elas. Toma uma auréola e uma estampa de galáxia.', d_estela_3: 'Quanto mais gente doa estrelas ao cristal, mais cedo chega o sonho coletivo.',
    d_loto_0: 'Bem-vindo ao jardim. Sou o Lótus.|Os gêiseres te levam ao céu se você ficar em cima quando sopram. Suba com 3 diferentes.',
    d_loto_1: 'Fique em cima de um gêiser e espere o jato. {n} de {m}.', d_loto_2: 'Você voou! Te dou a estampa aurora.', d_loto_3: 'As flores gigantes quicam. Tente pular de uma para outra.',
    d_guia_0: 'Olá! Sou a Guia. Coleciono música.|Há 6 discos escondidos nos reinos. Cada um traz uma música. Você encontra?',
    d_guia_1: 'Você tem {n} de {m} discos. Procure coisas que brilham e giram.', d_guia_2: 'A coleção completa! Toma: notas musicais que te seguem.', d_guia_3: 'Com a tecla 3 ou o botão de música você troca a canção.',
    d_brujula_0: 'Bem-vindo à ilha! Sou a Bússola e desenhei aquele mapa.|A ilha é enorme: tem uma cidade de vidro, uma baía com farol, moinhos, um bosque de cogumelos e um monte com cachoeira. Visita seis lugares para mim?',
    d_brujula_1: 'Olhe o mapa (tecla 5 ou a placa) e vá explorar: {n} de {m}. O monotrilho te leva rápido.', d_brujula_2: 'Você conhece a ilha melhor que eu! Toma meu chapéu de explorador.', d_brujula_3: 'Do coreto do monte dá para ver tudo. Suba de noite: o farol gira.',
    d_brisa_0: 'Fiuuu… oi! Sou a Brisa. Os moinhos da pradaria estão meio dormindo.|Sopra quatro para mim? Chegue perto da base e aperte usar.',
    d_brisa_1: 'Sopre os moinhos da pradaria. {n} de {m}.', d_brisa_2: 'Olha como giram! Te dou meu cata-vento: gira mais quando você corre.', d_brisa_3: 'Quando venta forte, as árvores da ilha toda balançam juntas.',
    d_musgo_0: 'Shh, não acorde os cogumelos… Sou o Musgo.|Se você pular em cima de um cogumelo, ele te joga bem alto. Quique em cinco diferentes.',
    d_musgo_1: 'Pule nos chapeuzinhos dos cogumelos. {n} de {m}.', d_musgo_2: 'Boing! Você ganhou um chapéu cogumelo, igual ao meu.', d_musgo_3: 'Lá em cima da casa da árvore tem algo que brilha e gira.',
    d_marea_0: 'Ahoy! Sou a Maré, cuido do farol.|O mar traz garrafas com mensagens para as praias da ilha. Encontre três e leia.',
    d_marea_1: 'Procure garrafas nas praias, bem na beira. {n} de {m}.', d_marea_2: 'Que mensagens lindas! Toma meu quepe de capitão.', d_marea_3: 'Se você nadar até a ilhota do farol, vai achar um disco.',
    premio_orbes: '{n} orbes',
  },
});

export const Misiones = {
  G: null,
  estado(id) { return (this.G.misiones[id] ||= { e: 'nueva', n: 0 }); },
  /* lo que dice al hablarle, y qué pasa: 'ofrece' | 'recuerda' | 'premia' | 'charla' | 'tienda' */
  hablar(id) {
    const N = NPCS[id];
    if (N.tienda) return { lineas: t('d_' + id + '_0').split('|'), que: 'tienda' };
    const s = this.estado(id), M = N.mision;
    if (s.e === 'nueva') return { lineas: t('d_' + id + '_0').split('|'), que: 'ofrece' };
    if (s.e === 'activa') return { lineas: [t('d_' + id + '_1', { n: s.n, m: M.meta })], que: 'recuerda' };
    if (s.e === 'lista') return { lineas: [t('d_' + id + '_2')], que: 'premia' };
    return { lineas: [t('d_' + id + '_3')], que: 'charla' };
  },
  aceptar(id) {
    const s = this.estado(id); if (s.e !== 'nueva') return;
    s.e = 'activa';
    /* los discos que ya tenía cuentan */
    if (NPCS[id].mision.tipo === 'disco') { s.n = this.G.discos.length; if (s.n >= NPCS[id].mision.meta) s.e = 'lista'; }
  },
  /* da el premio y devuelve lo que se ganó */
  premiar(id) {
    const s = this.estado(id); if (s.e !== 'lista') return null;
    const M = NPCS[id].mision; s.e = 'hecha';
    this.G.orbes += M.orbes;
    for (const c of M.cosas) if (!this.G.tengo.includes(c)) this.G.tengo.push(c);
    return M;
  },
  /* pasó algo que puede contar: devuelve [{id, lista}] para avisar */
  contar(tipo, k = 1, clave = null) {
    const avisos = [];
    for (const [id, N] of Object.entries(NPCS)) {
      const M = N.mision; if (!M || M.tipo !== tipo) continue;
      const s = this.estado(id); if (s.e !== 'activa') continue;
      /* los géiseres cuentan distintos: se guarda cuáles */
      if (clave) { s.vistos ||= []; if (s.vistos.includes(clave)) continue; s.vistos.push(clave); }
      s.n = Math.min(M.meta, s.n + k);
      if (s.n >= M.meta) { s.e = 'lista'; avisos.push({ id, lista: true }); } else avisos.push({ id, lista: false, n: s.n, m: M.meta });
    }
    return avisos;
  },
  activas() { return Object.entries(NPCS).filter(([id, N]) => N.mision && ['activa', 'lista'].includes(this.estado(id).e)).map(([id, N]) => ({ id, ...this.estado(id), meta: N.mision.meta, tipo: N.mision.tipo })); },
};
