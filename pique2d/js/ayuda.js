// El texto largo de "Cómo se juega", en los tres idiomas.
//
// Vive aparte de idioma.js porque es mas texto que todo el resto de la tabla
// junto, y mezclarlo con los botones y los rotulos hacia imposible encontrar
// nada. Se inserta como HTML —tiene <dl>, <b> y <code> adentro— y por eso
// TIENE QUE SEGUIR SIENDO TEXTO NUESTRO: nada de esto viene del jugador.

export const AYUDA = {
es: `
<p class="destacado">Casi todo sale del <b>botón de saltar</b>: tocar la pantalla, el botón <b>A</b>, o la barra espaciadora. Lo demás sale de cuánto lo mantenés apretado y de dónde estás parado cuando lo tocás. Las flechas <b>◀ ▶</b> de la izquierda mandan para dónde vas.</p>

<h3>Los movimientos</h3>
<dl class="movs">
  <dt>Salto corto</dt><dd>Un toque seco: sube unos 2 tiles y medio.</dd>
  <dt>Salto alto</dt><dd>Mantenerlo apretado: casi 5 tiles. Se corta en cuanto soltás.</dd>
  <dt>Vault</dt><dd><b>Solo.</b> Los obstáculos de un tile y los huecos de uno o dos se pasan sin tocar nada. De tres para arriba hay que saltar.</dd>
  <dt>Vault con toque</dt><dd>Tocar <em>justo</em> mientras vaulteás: salto más alto y te llevás puesto al enemigo. Es la maniobra que más paga.</dd>
  <dt>Trepada</dt><dd><b>Sola.</b> Si caés justo sobre el filo de una plataforma, te subís en vez de rebotar contra el costado.</dd>
  <dt>Los botones</dt><dd><b>◀ ▶</b> te mueven y <b>A</b> salta — tocar la pantalla también. Sin tocar nada te quedás quieto. Si preferís que corra solo —como las primeras versiones— está en Ajustes → Movimiento → Corredor.</dd>
  <dt>Salto de pared</dt><dd>Tocar pegado a una pared: rebotás y <b>das vuelta la carrera</b>. Así se suben los pozos y las torres, en zigzag.</dd>
  <dt>Doble salto</dt><dd>Tocar otra vez en el aire: segundo impulso, con su propia vuelta de carnero.</dd>
  <dt>Triple salto</dt><dd>Y una tercera vez: el más alto de los tres, con un backflip. Encadenados llegan a 9 tiles. Pisar un enemigo te devuelve los dos saltos de aire.</dd>
  <dt>Tobogán</dt><dd>Caer sobre una bajada: acelerás y arrasás con lo que se cruce.</dd>
  <dt>Resorte</dt><dd>Pisarlo te dispara para arriba: casi 7 tiles, más que cualquier salto.</dd>
</dl>

<h3>Los bloques</h3>
<dl class="movs">
  <dt class="b-pausa">Pausa</dt><dd>Parado encima te frena a vos <b>y al reloj</b>. Tocá para salir. Es el único lugar donde podés pensar.</dd>
  <dt class="b-preg">?</dt><dd>Monedas, y a veces una burbuja o un <b>hongo</b>. Cada bloque da siempre lo mismo: el nivel se puede aprender.</dd>
  <dt class="b-tiempo">Reloj</dt><dd>Suma 10 segundos, hasta 99.</dd>
  <dt class="b-largo">Salto largo</dt><dd>Arco bajo y lejos: cruza huecos que ningún salto normal cruza.</dd>
  <dt class="b-volt">Voltereta</dt><dd>La subida más alta del juego. Para lo que quedó arriba de todo.</dd>
</dl>

<h3>Los hongos</h3>
<p>Salen de los bloques <code>?</code> y <b>vuelan hasta vos</b>: no se escapan. Uno de cada cuatro bloques tiene uno, y siempre el mismo bloque: el nivel se puede aprender. El común te hace grande, y estando grande un golpe no te cuesta una burbuja — solo volvés a tamaño normal.</p>
<p>El <b>hongo arcoíris</b> es otra cosa: hay <b>uno solo por mundo</b>, en el primer nivel de cada uno, y te hace gigante por nueve segundos. Arrasás con bloques, tubos y enemigos con solo caminar. El pozo y el reloj te matan igual, seas del tamaño que seas.</p>

<h3>Las burbujas</h3>
<p>No hay vidas. Cuando te matan entrás en una <b>burbuja</b> que vuelve para atrás y perdés 5 monedas; tocá para pincharla donde quieras. Arrancás con dos y los bloques <code>?</code> a veces dan más. Sin burbujas, se terminó.</p>

<h3>Las monedas de color</h3>
<p>Cinco por nivel, escondidas. Juntá las cinco <b class="c-rosa">rosas</b> en una sola corrida y se habilitan las <b class="c-violeta">violetas</b>, que están peor puestas; con esas, las <b class="c-negra">negras</b>. Es el mismo nivel tres veces, cada vez más exigente.</p>

<h3>El mástil</h3>
<p>Cuanto más alto lo agarrás, más monedas: hasta 10. En los niveles de jefe el mástil está <b>trabado</b> hasta que lo derrotes.</p>

<h3>De dónde salen los niveles</h3>
<p>Ninguno está dibujado a mano. Cada uno se arma con piezas parametrizadas a partir de un número —el mismo número siempre, así que el 3-2 es siempre el 3-2— y después <b>se juega entero por dentro</b> con una búsqueda que corre la física de verdad, para comprobar que se puede terminar y que las cinco monedas se pueden alcanzar. Si no pasa, se tira y se arma otro. El tiempo límite sale de lo que tarda ese camino, no de un número inventado.</p>
`,

en: `
<p class="destacado">Almost everything comes out of the <b>jump button</b>: tap the screen, the <b>A</b> button, or the spacebar. The rest comes from how long you hold it and where you are standing when you press it. The <b>◀ ▶</b> arrows on the left say which way you go.</p>

<h3>The moves</h3>
<dl class="movs">
  <dt>Short jump</dt><dd>A quick tap: about two and a half tiles up.</dd>
  <dt>High jump</dt><dd>Hold it down: almost 5 tiles. It cuts off the moment you let go.</dd>
  <dt>Vault</dt><dd><b>Automatic.</b> One-tile obstacles and gaps of one or two are cleared without touching anything. Three or more and you have to jump.</dd>
  <dt>Vault with a tap</dt><dd>Tap <em>right</em> while vaulting: a higher jump, and you take the enemy with you. It is the move that pays the most.</dd>
  <dt>Ledge climb</dt><dd><b>Automatic.</b> If you land right on the edge of a platform you pull yourself up instead of bouncing off the side.</dd>
  <dt>The buttons</dt><dd><b>◀ ▶</b> move you and <b>A</b> jumps — tapping the screen works too. Touch nothing and you stand still. If you would rather it ran on its own —like the earliest versions— it is under Settings → Movement → Runner.</dd>
  <dt>Wall jump</dt><dd>Tap while hugging a wall: you bounce off and <b>turn your run around</b>. That is how pits and towers are climbed, in a zigzag.</dd>
  <dt>Double jump</dt><dd>Tap again in mid-air: a second push, with a somersault of its own.</dd>
  <dt>Triple jump</dt><dd>And a third time: the highest of the three, with a backflip. Chained together they reach 9 tiles. Stomping an enemy gives both air jumps back.</dd>
  <dt>Slide</dt><dd>Land on a slope going down: you pick up speed and flatten whatever gets in the way.</dd>
  <dt>Spring</dt><dd>Step on it and it fires you up: nearly 7 tiles, higher than any jump.</dd>
</dl>

<h3>The blocks</h3>
<dl class="movs">
  <dt class="b-pausa">Pause</dt><dd>Standing on it stops you <b>and the clock</b>. Tap to leave. It is the only place where you get to think.</dd>
  <dt class="b-preg">?</dt><dd>Coins, and sometimes a bubble or a <b>mushroom</b>. Each block always gives the same thing: the level can be learned.</dd>
  <dt class="b-tiempo">Clock</dt><dd>Adds 10 seconds, up to 99.</dd>
  <dt class="b-largo">Long jump</dt><dd>A low, far arc: it crosses gaps no normal jump crosses.</dd>
  <dt class="b-volt">Somersault</dt><dd>The highest climb in the game. For whatever is left up at the top.</dd>
</dl>

<h3>The mushrooms</h3>
<p>They come out of the <code>?</code> blocks and <b>fly to you</b>: they do not get away. One block in four has one, and always the same block: the level can be learned. The plain one makes you big, and while big a hit does not cost you a bubble — you just go back to normal size.</p>
<p>The <b>rainbow mushroom</b> is another matter: there is <b>only one per world</b>, in its first level, and it makes you gigantic for nine seconds. You flatten blocks, pipes and enemies just by walking. The pit and the clock still kill you, whatever size you are.</p>

<h3>The bubbles</h3>
<p>There are no lives. When you are killed you go into a <b>bubble</b> that floats back the way you came and you lose 5 coins; tap to pop it wherever you like. You start with two and the <code>?</code> blocks sometimes give more. Out of bubbles, it is over.</p>

<h3>The coloured coins</h3>
<p>Five per level, hidden. Collect all five <b class="c-rosa">pink</b> ones in a single run and the <b class="c-violeta">purple</b> ones open up, which are worse placed; with those, the <b class="c-negra">black</b> ones. It is the same level three times, harder each time.</p>

<h3>The flagpole</h3>
<p>The higher you grab it, the more coins: up to 10. In boss levels the flagpole is <b>locked</b> until you beat the boss.</p>

<h3>Where the levels come from</h3>
<p>None of them is drawn by hand. Each one is assembled from parameterised pieces starting from a number —always the same number, so 3-2 is always 3-2— and then <b>played all the way through internally</b> by a search that runs the real physics, to prove that it can be finished and that all five coins can be reached. If it does not pass, it is thrown away and another is built. The time limit comes from how long that path takes, not from a number someone made up.</p>
`,

pt: `
<p class="destacado">Quase tudo sai do <b>botão de pular</b>: tocar a tela, o botão <b>A</b>, ou a barra de espaço. O resto vem de quanto tempo você segura e de onde está quando aperta. As setas <b>◀ ▶</b> da esquerda mandam para onde você vai.</p>

<h3>Os movimentos</h3>
<dl class="movs">
  <dt>Pulo curto</dt><dd>Um toque seco: sobe uns dois tiles e meio.</dd>
  <dt>Pulo alto</dt><dd>Segurando: quase 5 tiles. Corta assim que você solta.</dd>
  <dt>Vault</dt><dd><b>Sozinho.</b> Obstáculos de um tile e buracos de um ou dois passam sem tocar em nada. De três para cima tem que pular.</dd>
  <dt>Vault com toque</dt><dd>Tocar <em>na hora certa</em> durante o vault: pulo mais alto e você leva o inimigo junto. É a manobra que mais rende.</dd>
  <dt>Escalada de beirada</dt><dd><b>Sozinha.</b> Se você cai bem na beirada de uma plataforma, sobe em vez de bater na lateral.</dd>
  <dt>Os botões</dt><dd><b>◀ ▶</b> movem e <b>A</b> pula — tocar a tela também. Sem tocar nada você fica parado. Se preferir que corra sozinho —como nas primeiras versões— está em Ajustes → Movimento → Corredor.</dd>
  <dt>Pulo de parede</dt><dd>Tocar colado numa parede: você rebate e <b>inverte a corrida</b>. É assim que se sobem os poços e as torres, em ziguezague.</dd>
  <dt>Pulo duplo</dt><dd>Tocar de novo no ar: segundo impulso, com a sua própria cambalhota.</dd>
  <dt>Pulo triplo</dt><dd>E uma terceira vez: o mais alto dos três, com um backflip. Encadeados chegam a 9 tiles. Pisar num inimigo devolve os dois pulos de ar.</dd>
  <dt>Escorregada</dt><dd>Cair numa descida: você acelera e atropela o que aparecer.</dd>
  <dt>Mola</dt><dd>Pisar nela te dispara para cima: quase 7 tiles, mais que qualquer pulo.</dd>
</dl>

<h3>Os blocos</h3>
<dl class="movs">
  <dt class="b-pausa">Pausa</dt><dd>Em cima dele você para <b>e o relógio também</b>. Toque para sair. É o único lugar onde dá para pensar.</dd>
  <dt class="b-preg">?</dt><dd>Moedas, e às vezes uma bolha ou um <b>cogumelo</b>. Cada bloco dá sempre a mesma coisa: a fase pode ser aprendida.</dd>
  <dt class="b-tiempo">Relógio</dt><dd>Soma 10 segundos, até 99.</dd>
  <dt class="b-largo">Pulo longo</dt><dd>Arco baixo e longe: cruza buracos que nenhum pulo normal cruza.</dd>
  <dt class="b-volt">Cambalhota</dt><dd>A subida mais alta do jogo. Para o que ficou lá em cima.</dd>
</dl>

<h3>Os cogumelos</h3>
<p>Saem dos blocos <code>?</code> e <b>voam até você</b>: não escapam. Um em cada quatro blocos tem um, e sempre o mesmo bloco: a fase pode ser aprendida. O comum te deixa grande, e estando grande um golpe não custa uma bolha — você só volta ao tamanho normal.</p>
<p>O <b>cogumelo arco-íris</b> é outra coisa: há <b>um só por mundo</b>, na primeira fase de cada um, e te deixa gigante por nove segundos. Você atropela blocos, canos e inimigos só de andar. O poço e o relógio matam do mesmo jeito, seja qual for o tamanho.</p>

<h3>As bolhas</h3>
<p>Não há vidas. Quando você morre entra numa <b>bolha</b> que volta pelo caminho e perde 5 moedas; toque para estourá-la onde quiser. Você começa com duas e os blocos <code>?</code> às vezes dão mais. Sem bolhas, acabou.</p>

<h3>As moedas coloridas</h3>
<p>Cinco por fase, escondidas. Junte as cinco <b class="c-rosa">rosas</b> numa única corrida e liberam-se as <b class="c-violeta">roxas</b>, que estão pior colocadas; com essas, as <b class="c-negra">pretas</b>. É a mesma fase três vezes, cada vez mais exigente.</p>

<h3>O mastro</h3>
<p>Quanto mais alto você agarra, mais moedas: até 10. Nas fases de chefe o mastro fica <b>travado</b> até você vencê-lo.</p>

<h3>De onde saem as fases</h3>
<p>Nenhuma é desenhada à mão. Cada uma é montada com peças parametrizadas a partir de um número —sempre o mesmo número, então a 3-2 é sempre a 3-2— e depois <b>é jogada inteira por dentro</b> por uma busca que roda a física de verdade, para provar que dá para terminar e que as cinco moedas dá para alcançar. Se não passa, joga-se fora e monta-se outra. O tempo limite sai do que esse caminho demora, não de um número inventado.</p>
`,
};
