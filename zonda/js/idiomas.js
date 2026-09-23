/* ============================================================================
   zonda/js/idiomas.js — ZONDA en español, inglés y portugués (de Brasil).
   Las tablas del juego (DIALOGOS, CARTAS, nombres de salas…) están escritas
   en español en su lugar; al elegir idioma se reemplaza su texto en el mismo
   objeto, así el resto del código no se entera. Los textos de la interfaz van
   por tr('clave').
   ========================================================================== */

const UI_ZONDA = {
  es: {
    jugar: 'JUGAR', seguirPartida: 'SEGUIR', capitulos: 'CAPÍTULOS', cartas: 'CARTAS', opciones: 'OPCIONES', creditos: 'CRÉDITOS', volver: 'VOLVER',
    pausa: 'PAUSA', seguir: 'SEGUIR', reintentar: 'REINTENTAR SALA', salirMenu: 'SALIR AL MENÚ',
    capituloCompleto: 'CAPÍTULO {0} COMPLETO', tiempoMuertes: 'TIEMPO {0} · MUERTES {1}', cartasDe: 'CARTAS {0} DE {1}',
    carta: 'CARTA {0}/{1}', pausaTxt: '{0} · SALA {1}/{2} · MUERTES {3} · {4}', capInfo: 'CARTAS {0}/{1} · MUERTES {2}', mejor: ' · MEJOR {0}',
    todaviaNo: 'TODAVÍA NO', encontraste: 'ENCONTRASTE {0} DE {1}', deA: 'DE {0} PARA {1}',
    musica: 'MÚSICA', efectos: 'EFECTOS', temblor: 'TEMBLOR', velocidad: 'VELOCIDAD', dashInf: 'DASH INFINITO', invencible: 'INVENCIBLE', reloj: 'RELOJ',
    si: 'SÍ', no: 'NO', idioma: 'IDIOMA',
    ayudas: 'VELOCIDAD, DASH INFINITO E INVENCIBLE SON AYUDAS: EL CERRO SE PUEDE SUBIR IGUAL CON ELLAS.',
    teclado: 'TECLADO: FLECHAS O WASD · C, K O ESPACIO SALTA · X O J DASH · Z, L O SHIFT AGARRA · ESC PAUSA',
    mando: 'MANDO: A SALTA · X DASH · GATILLOS AGARRAN',
    toque: 'TOQUE: EL PULGAR IZQUIERDO MUEVE Y APUNTA · A LA DERECHA SALTO, DASH Y AGARRE',
    lema: 'UNA CHICA, UN CERRO Y EL VIENTO', capitulo: 'CAPÍTULO {0}',
  },
  en: {
    jugar: 'PLAY', seguirPartida: 'CONTINUE', capitulos: 'CHAPTERS', cartas: 'LETTERS', opciones: 'OPTIONS', creditos: 'CREDITS', volver: 'BACK',
    pausa: 'PAUSE', seguir: 'RESUME', reintentar: 'RETRY ROOM', salirMenu: 'QUIT TO MENU',
    capituloCompleto: 'CHAPTER {0} COMPLETE', tiempoMuertes: 'TIME {0} · DEATHS {1}', cartasDe: 'LETTERS {0} OF {1}',
    carta: 'LETTER {0}/{1}', pausaTxt: '{0} · ROOM {1}/{2} · DEATHS {3} · {4}', capInfo: 'LETTERS {0}/{1} · DEATHS {2}', mejor: ' · BEST {0}',
    todaviaNo: 'NOT YET', encontraste: 'YOU FOUND {0} OF {1}', deA: 'FROM {0} TO {1}',
    musica: 'MUSIC', efectos: 'SOUND', temblor: 'SHAKE', velocidad: 'SPEED', dashInf: 'INFINITE DASH', invencible: 'INVINCIBLE', reloj: 'TIMER',
    si: 'YES', no: 'NO', idioma: 'LANGUAGE',
    ayudas: 'SPEED, INFINITE DASH AND INVINCIBLE ARE ASSISTS: THE MOUNTAIN CAN STILL BE CLIMBED WITH THEM.',
    teclado: 'KEYBOARD: ARROWS OR WASD · C, K OR SPACE JUMPS · X OR J DASHES · Z, L OR SHIFT GRABS · ESC PAUSES',
    mando: 'GAMEPAD: A JUMPS · X DASHES · TRIGGERS GRAB',
    toque: 'TOUCH: THE LEFT THUMB MOVES AND AIMS · ON THE RIGHT, JUMP, DASH AND GRAB',
    lema: 'A GIRL, A MOUNTAIN AND THE WIND', capitulo: 'CHAPTER {0}',
  },
  pt: {
    jugar: 'JOGAR', seguirPartida: 'CONTINUAR', capitulos: 'CAPÍTULOS', cartas: 'CARTAS', opciones: 'OPÇÕES', creditos: 'CRÉDITOS', volver: 'VOLTAR',
    pausa: 'PAUSA', seguir: 'CONTINUAR', reintentar: 'REPETIR SALA', salirMenu: 'SAIR PARA O MENU',
    capituloCompleto: 'CAPÍTULO {0} COMPLETO', tiempoMuertes: 'TEMPO {0} · MORTES {1}', cartasDe: 'CARTAS {0} DE {1}',
    carta: 'CARTA {0}/{1}', pausaTxt: '{0} · SALA {1}/{2} · MORTES {3} · {4}', capInfo: 'CARTAS {0}/{1} · MORTES {2}', mejor: ' · MELHOR {0}',
    todaviaNo: 'AINDA NÃO', encontraste: 'VOCÊ ENCONTROU {0} DE {1}', deA: 'DE {0} PARA {1}',
    musica: 'MÚSICA', efectos: 'EFEITOS', temblor: 'TREMOR', velocidad: 'VELOCIDADE', dashInf: 'DASH INFINITO', invencible: 'INVENCÍVEL', reloj: 'CRONÔMETRO',
    si: 'SIM', no: 'NÃO', idioma: 'IDIOMA',
    ayudas: 'VELOCIDADE, DASH INFINITO E INVENCÍVEL SÃO AJUDAS: DÁ PARA SUBIR A MONTANHA MESMO COM ELAS.',
    teclado: 'TECLADO: SETAS OU WASD · C, K OU ESPAÇO PULA · X OU J DASH · Z, L OU SHIFT AGARRA · ESC PAUSA',
    mando: 'CONTROLE: A PULA · X DASH · GATILHOS AGARRAM',
    toque: 'TOQUE: O POLEGAR ESQUERDO MOVE E MIRA · À DIREITA, PULO, DASH E AGARRAR',
    lema: 'UMA GAROTA, UMA MONTANHA E O VENTO', capitulo: 'CAPÍTULO {0}',
  },
};

/* la historia, con la misma forma que en historia.js: los diálogos van línea
   por línea en el mismo orden, y cada carta es [de, para, texto] */
const TEXTOS_ZONDA = {
  en: {
    CAP_SUB: { 1: 'Where the mountain begins', 2: 'What was left down below', 3: 'The ice remembers', 4: 'What the wind carries away' },
    NOMBRES: { ayelen: 'AYELÉN', zonda: 'THE ZONDA', rosa: 'ROSA' },
    capitulos: ['The Gorge', 'The Mine', 'The Glacier', 'The Summit'],
    salas: {
      '1-1': 'At the foot of the mountain', '1-2': 'The chimney', '1-3': 'The first wind', '1-4': 'Wind stones', '1-5': 'The apacheta',
      '2-1': 'The mouth of the mine', '2-2': 'Rotten planks', '2-3': 'The mine carts', '2-4': 'The shaft', '2-5': 'The way out',
      '3-1': 'Old snow', '3-2': 'Headwind', '3-3': 'Gusts', '3-4': 'Ice mirrors', '3-5': 'The pass',
      '4-1': 'The storm', '4-2': 'Two breaths', '4-3': 'All together', '4-4': 'The wind carries you', '4-5': 'The summit',
    },
    DIALOGOS: {
      inicio: [
        'Grandma Rosa climbed this mountain for forty years, with the mailbag on her shoulder.',
        'The night she passed away, the Zonda rose and carried the bag up the mountain.',
        "I'm going to find them. And leave her stone on the apacheta at the summit, the way it's done.",
      ],
      viento1: ['And who are you, climbing at night?', "Ayelén. Rosa's granddaughter.", "Rosa doesn't climb anymore. Go home. What the wind takes never comes back.", "Then I'll go and get it."],
      apacheta1: ['An apacheta. Grandma left a stone on every one.', 'I leave one too. So the mountain lets me through.', 'The mountain owes you nothing, little one.'],
      mina: ["The Quispe mine. Grandma brought them their families' letters.", 'Nobody has come in here for thirty years. No letters, no people.'],
      mina2: ['I found letters. They were never opened.', 'Because there was no one left. I keep them. Someone has to keep them.', 'Did you take them to look after them?', 'Keep climbing, if you want to know so badly.'],
      glaciar: ['So cold. Grandma used to say the ice remembers everything.', "The ice remembers. I forget. That's why I blow."],
      glaciar2: ['Rosa asked me for one thing, the last time she came up.', 'What did she ask?', 'Not to let you climb alone. And look: here you are. Alone.', "I'm not alone. You're here, and you never stop talking."],
      regalo: ["Up there it blows harder than me. You won't make it alone.", "Here. I'll lend you a breath: you'll be able to push yourself twice in the air.", 'Thank you, Zonda.', "Don't thank me. Climb."],
      lleva: ["Don't fight me now. Let me carry you."],
      cumbre: ['The summit.', 'The bag is at the apacheta. Rosa left it there. I only looked after it.'],
      final: [
        "There's a letter with my name on it.",
        'Ayelén: if you are reading this, you made it up here. I always knew you would.',
        "Leave the stone, look at the sun and go down light. The wind delivers what we can't.",
        'I love you. Rosa.',
        'Zonda... are you the one who delivers them?',
        'Each one, to wherever it has to go.',
      ],
    },
    CARTAS: {
      '1-1': ['Tomás', 'his mother', "Mom: I got to the mine safely. Up here the sky is so close it's scary to touch. Send me the wool socks. Tomás, 1971."],
      '1-2': ['Anselmo', 'Don Aurelio', "Don Aurelio: I owe you three llamas and an apology. I have the llamas. The apology I'll say in person when I come down."],
      '1-3': ['Julián', 'Elena', 'Dear Elena: the wind up here messes up everything except what I feel. Wait for me at carnival.'],
      '1-4': ['the night shift', 'Rosa', 'Rosa: thank you for climbing through the snow. Without your letters this mine would just be a hole.'],
      '1-5': ['Dad', 'his daughter', 'Daughter: on the apacheta of the gorge there is a stone of mine. When you pass, leave one of yours beside it. That way we keep each other company.'],
      '2-1': ['Ramón', 'Martina', 'Martina: today we found silver. Not much. Just enough for the roof of the house. The rest, for the party.'],
      '2-2': ['F. Quispe', 'the mine boss', "Dear boss: I quit. I'm off to play the charango in Humahuaca. Don't look for me. What you owe me, though, you will pay me."],
      '2-3': ['Beto', 'Tito', "Tito: the cart on the north vein starts by itself. If you come up, don't get on it. If you get on it, hold on."],
      '2-4': ['Nicanor', 'his mom', 'Mom: the shaft is deep but the people are good. We eat together, we sing together. I miss your locro. Nicanor, 1983.'],
      '2-5': ['the mine', 'whoever finds this', "Today we close the mine. The letters that were never delivered stay in Rosa's bag. She will know what to do."],
      '3-1': ['a shepherdess from Iruya', 'Rosa', 'Rosa: the ice keeps the footprints of those who climbed before. I stepped in yours.'],
      '3-2': ['Esteban', 'his love', "My love: if the headwind won't let me come back, I'll come back walking backwards. But I'll come back."],
      '3-3': ['Grandpa Ceferino', 'his grandson', 'Grandson: you get through the gusts crouching down and counting to three. Same as with sorrows.'],
      '3-4': ['Pedro', 'Clara', 'Clara: in the glacier I saw myself reflected a thousand times. In none of them was I without you. Awful. Come back.'],
      '3-5': ['Justina', 'Rosa', 'Rosa, my friend: if one day you stop climbing, someone of your blood will climb for you. I know you.'],
      '4-1': ['someone', 'someone', "The storm isn't bad, my grandmother says. It's just the sky tidying up."],
      '4-2': ['a guide', 'Rosa', 'Whoever climbs with company has two breaths: one for themselves and one for whoever comes behind.'],
      '4-3': ['Tomás', 'his mother', "Mom: I reached the summit. There's nothing here. Just the sun, the wind and me. It's the most beautiful thing I've ever seen. Tomás, 1972."],
      '4-4': ['Rosa', 'the wind', "To the wind: thank you for carrying me when I couldn't. Rosa."],
    },
    CREDITOS: [
      'ZONDA',
      'A girl, a mountain and the wind.',
      'Everything you see is drawn with code and everything you hear is synthesized: there is not a single image or audio file.',
      'Every room was checked by a solver that uses the same physics as the game.',
      'For Rosa, and for every mail carrier of the mountain.',
    ],
  },
  pt: {
    CAP_SUB: { 1: 'Onde a montanha começa', 2: 'O que ficou lá embaixo', 3: 'O gelo se lembra', 4: 'O que o vento leva' },
    NOMBRES: { ayelen: 'AYELÉN', zonda: 'O ZONDA', rosa: 'ROSA' },
    capitulos: ['A Quebrada', 'A Mina', 'O Glaciar', 'O Cume'],
    salas: {
      '1-1': 'No pé da montanha', '1-2': 'A chaminé', '1-3': 'O primeiro vento', '1-4': 'Pedras de vento', '1-5': 'A apacheta',
      '2-1': 'A boca da mina', '2-2': 'Tábuas podres', '2-3': 'Os vagonetes', '2-4': 'O poço', '2-5': 'A saída',
      '3-1': 'Neve velha', '3-2': 'Vento contra', '3-3': 'Rajadas', '3-4': 'Espelhos de gelo', '3-5': 'A passagem',
      '4-1': 'A tempestade', '4-2': 'Dois fôlegos', '4-3': 'Tudo junto', '4-4': 'O vento te leva', '4-5': 'O cume',
    },
    DIALOGOS: {
      inicio: [
        'A vó Rosa subiu esta montanha por quarenta anos, com a bolsa das cartas no ombro.',
        'Na noite em que ela se foi, o Zonda se levantou e levou a bolsa montanha acima.',
        'Vou buscar as cartas. E deixar a pedra dela na apacheta do cume, como se faz.',
      ],
      viento1: ['E quem é você, pra subir de noite?', 'Ayelén. A neta da Rosa.', 'A Rosa não sobe mais. Volte. O que o vento leva não volta.', 'Então eu vou buscar.'],
      apacheta1: ['Uma apacheta. A vó deixava uma pedra em cada uma.', 'Deixo uma. Pra montanha me deixar passar.', 'A montanha não te deve nada, menina.'],
      mina: ['A mina dos Quispe. A vó trazia as cartas das famílias deles.', 'Faz trinta anos que ninguém entra aqui. Nem cartas, nem gente.'],
      mina2: ['Encontrei cartas. Nunca foram abertas.', 'Porque não sobrou ninguém. Eu guardo as cartas. Alguém tem que guardar.', 'Você levou as cartas pra cuidar delas?', 'Continue subindo, se quer tanto saber.'],
      glaciar: ['Que frio. A vó dizia que o gelo se lembra de tudo.', 'O gelo se lembra. Eu esqueço. Por isso eu sopro.'],
      glaciar2: ['A Rosa me pediu uma coisa, da última vez que subiu.', 'O que ela pediu?', 'Que eu não te deixasse subir sozinha. E olha só: aqui está você. Sozinha.', 'Não estou sozinha. Tem você, que não para de falar.'],
      regalo: ['Lá em cima sopra mais forte que eu. Sozinha você não vai conseguir.', 'Tome. Te empresto um fôlego: duas vezes você vai poder se impulsionar no ar.', 'Obrigada, Zonda.', 'Não me agradeça. Suba.'],
      lleva: ['Agora não brigue comigo. Deixe o vento te levar.'],
      cumbre: ['O cume.', 'A bolsa está na apacheta. A Rosa deixou ali. Eu só cuidei dela.'],
      final: [
        'Tem uma carta com o meu nome.',
        'Ayelén: se você está lendo isto, é porque subiu. Eu já sabia.',
        'Deixe a pedra, olhe o sol e desça leve. O vento entrega o que nós não conseguimos.',
        'Te amo. Rosa.',
        'Zonda... é você quem entrega as cartas?',
        'Cada uma, pra onde tiver que chegar.',
      ],
    },
    CARTAS: {
      '1-1': ['Tomás', 'sua mãe', 'Mãe: cheguei bem à mina. Aqui em cima o céu está tão perto que dá medo de tocar. Me mande as meias de lã. Tomás, 1971.'],
      '1-2': ['Anselmo', 'seu Aurelio', 'Seu Aurelio: eu lhe devo três lhamas e um pedido de desculpas. As lhamas eu tenho. As desculpas eu peço pessoalmente quando descer.'],
      '1-3': ['Julián', 'Elena', 'Querida Elena: o vento daqui bagunça tudo, menos o que eu sinto. Me espere no carnaval.'],
      '1-4': ['o turno da noite', 'Rosa', 'Rosa: obrigado por subir com a neve. Sem as suas cartas, esta mina seria só um buraco.'],
      '1-5': ['o pai', 'sua filha', 'Filha: na apacheta da quebrada tem uma pedra minha. Quando passar, deixe uma sua ao lado. Assim a gente se faz companhia.'],
      '2-1': ['Ramón', 'Martina', 'Martina: hoje encontramos prata. Não muita. O suficiente para o telhado da casa. O resto, para a festa.'],
      '2-2': ['F. Quispe', 'o chefe da mina', 'Senhor chefe: eu me demito. Vou tocar charango em Humahuaca. Não me procurem. O que me devem, isso sim, me paguem.'],
      '2-3': ['Beto', 'Tito', 'Tito: o vagonete do veio norte anda sozinho. Se você subir, não entre nele. Se entrar nele, segure firme.'],
      '2-4': ['Nicanor', 'sua mãezinha', 'Mãezinha: o poço é fundo, mas o pessoal é bom. Comemos juntos, cantamos juntos. Sinto falta do seu locro. Nicanor, 1983.'],
      '2-5': ['a mina', 'quem encontrar', 'Hoje fechamos a mina. As cartas que não foram entregues ficam na bolsa da Rosa. Ela vai saber o que fazer.'],
      '3-1': ['uma pastora de Iruya', 'Rosa', 'Rosa: o gelo guarda as pegadas de quem subiu antes. Eu pisei nas suas.'],
      '3-2': ['Esteban', 'seu amor', 'Amor: se o vento contra não me deixar voltar, eu volto de costas. Mas volto.'],
      '3-3': ['o avô Ceferino', 'seu neto', 'Neto: as rajadas se aguentam agachado e contando até três. Como as tristezas.'],
      '3-4': ['Pedro', 'Clara', 'Clara: no glaciar me vi refletido mil vezes. Em nenhuma eu estava sem você. Horrível. Volte.'],
      '3-5': ['Justina', 'Rosa', 'Rosa, amiga: se um dia você não subir mais, alguém do seu sangue vai subir por você. Eu te conheço.'],
      '4-1': ['alguém', 'alguém', 'A tempestade não é ruim, diz a minha avó. É o céu fazendo faxina.'],
      '4-2': ['um guia', 'Rosa', 'Quem sobe acompanhado tem dois fôlegos: um para si e outro para quem vem atrás.'],
      '4-3': ['Tomás', 'sua mãe', 'Mãe: cheguei ao cume. Não tem nada. Só o sol, o vento e eu. É a coisa mais linda que já vi na vida. Tomás, 1972.'],
      '4-4': ['Rosa', 'o vento', 'Ao vento: obrigada por me levar quando eu não conseguia. Rosa.'],
    },
    CREDITOS: [
      'ZONDA',
      'Uma garota, uma montanha e o vento.',
      'Tudo o que se vê é desenhado com código e tudo o que se ouve é sintetizado: não há uma única imagem nem um único arquivo de áudio.',
      'Todas as salas foram verificadas por um solucionador que usa a mesma física do jogo.',
      'Para a Rosa, e para todas as carteiras e carteiros da montanha.',
    ],
  },
};

/* el español original, tomado de las tablas antes de tocarlas */
const TEXTOS_ES = {
  CAP_SUB: Object.assign({}, CAP_SUB),
  NOMBRES: Object.assign({}, NOMBRES),
  capitulos: CAPITULOS.map((c) => c.nombre),
  salas: Object.fromEntries(CAPITULOS.flatMap((c) => c.salas.map((s) => [s.id, s.nombre]))),
  DIALOGOS: Object.fromEntries(Object.entries(DIALOGOS).map(([k, v]) => [k, v.map((l) => l.t)])),
  CARTAS: Object.fromEntries(Object.entries(CARTAS).map(([k, c]) => [k, [c.de, c.a, c.t]])),
  CREDITOS: CREDITOS.slice(),
};

function aplicarIdiomaZonda(l) {
  const T = l === 'es' ? TEXTOS_ES : TEXTOS_ZONDA[l];
  Object.assign(CAP_SUB, T.CAP_SUB);
  Object.assign(NOMBRES, T.NOMBRES);
  CAPITULOS.forEach((c, i) => { c.nombre = T.capitulos[i]; for (const s of c.salas) s.nombre = T.salas[s.id]; });
  for (const k in DIALOGOS) DIALOGOS[k].forEach((ln, i) => { ln.t = T.DIALOGOS[k][i]; });
  for (const k in CARTAS) { const [de, a, t] = T.CARTAS[k]; Object.assign(CARTAS[k], { de, a, t }); }
  CREDITOS.length = 0; CREDITOS.push(...T.CREDITOS);
  Idioma.traducirDOM();
}
