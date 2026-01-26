import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDFTRTBj7WRVn4gG9OwDCPjHP0B_NYFpCc",
    authDomain: "unotfm.firebaseapp.com",
    databaseURL: "https://unotfm-default-rtdb.firebaseio.com",
    projectId: "unotfm",
    storageBucket: "unotfm.firebasestorage.app",
    messagingSenderId: "1035668265410",
    appId: "1:1035668265410:web:710e61682014f9d46a1e5b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const salaID = localStorage.getItem('salaID');
const meuNick = localStorage.getItem('meuNick');

if (!salaID || !meuNick) window.location.href = "index.html";

document.getElementById('txtSalaID').innerText = salaID;

// --- FUNÇÃO PARA GERAR UMA CARTA ALEATÓRIA ---
function gerarCarta() {
    // Cores que você tem (conforme o print: blue e red)
    // Se adicionar green e yellow depois, é só manter aqui
    const cores = ['red', 'blue', 'green', 'yellow']; 
    
    // Nomes exatos dos arquivos que vi no seu print (draw2, reverse, skip)
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    
    return {
        cor: cores[Math.floor(Math.random() * cores.length)],
        valor: valores[Math.floor(Math.random() * valores.length)]
    };
}

// --- INICIALIZAÇÃO DA PARTIDA ---
async function setupInicial() {
    const salaRef = ref(db, `salas/${salaID}`);
    const snapshot = await get(salaRef);
    const dados = snapshot.val();

    if (!dados) return;

    if (!dados.jogadores[meuNick].mao) {
        let novaMao = [];
        for (let i = 0; i < 7; i++) {
            novaMao.push(gerarCarta());
        }
        await set(ref(db, `salas/${salaID}/jogadores/${meuNick}/mao`), novaMao);
    }

    if (dados.dono === meuNick && !dados.cartaNaMesa) {
        await update(ref(db, `salas/${salaID}`), {
            cartaNaMesa: gerarCarta(),
            turno: dados.dono
        });
    }
}

setupInicial();

// --- ESCUTAR MUDANÇAS NO JOGO ---
onValue(ref(db, `salas/${salaID}`), (snapshot) => {
    const dados = snapshot.val();
    if (!dados) return;

    // 1. Atualiza a carta da mesa
    const cartaMesaDiv = document.getElementById('cartaMesa');
    if (dados.cartaNaMesa) {
        cartaMesaDiv.style.background = "transparent";
        cartaMesaDiv.style.border = "none";
        cartaMesaDiv.style.boxShadow = "none";
        
        // Ajustado para o padrão do seu print: valor_cor ou cor_valor
        // Como no print está "draw2_red", a lógica é ${valor}_${cor}
        cartaMesaDiv.innerHTML = `
            <img src="cartas/${dados.cartaNaMesa.valor}_${dados.cartaNaMesa.cor}.png" 
                 onerror="this.src='cartas/${dados.cartaNaMesa.cor}_${dados.cartaNaMesa.valor}.png'"
                 style="width: 120px; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.7));">
        `;
    }

    // 2. Atualiza de quem é a vez
    const txtVez = document.getElementById('txtVez');
    txtVez.innerText = dados.turno === meuNick ? "SUA VEZ!" : `Vez de ${dados.turno}`;
    txtVez.style.color = dados.turno === meuNick ? "#4caf50" : "#ffeb3b";

    // 3. Renderiza minha mão
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    const minhasCartas = dados.jogadores[meuNick].mao || [];

    minhasCartas.forEach((carta, index) => {
        const cardImg = document.createElement('img');
        
        // Tenta carregar valor_cor (ex: draw2_red) e se falhar tenta cor_valor (ex: red_0)
        cardImg.src = `cartas/${carta.valor}_${carta.cor}.png`;
        cardImg.onerror = () => {
            cardImg.src = `cartas/${carta.cor}_${carta.valor}.png`;
        };
        
        cardImg.style.width = "110px";
        cardImg.style.cursor = "pointer";
        cardImg.style.transition = "all 0.2s ease";
        cardImg.style.filter = "drop-shadow(0 5px 10px rgba(0,0,0,0.5))";
        
        cardImg.onmouseover = () => {
            cardImg.style.transform = "translateY(-35px) scale(1.1)";
            cardImg.style.zIndex = "100";
        };
        cardImg.onmouseout = () => {
            cardImg.style.transform = "translateY(0) scale(1)";
            cardImg.style.zIndex = "1";
        };

        cardImg.onclick = () => tentarJogarCarta(carta, index, dados);
        minhaMaoDiv.appendChild(cardImg);
    });
});

// --- LÓGICA DE JOGAR A CARTA ---
async function tentarJogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return alert("Não é sua vez!");

    const naMesa = dados.cartaNaMesa;

    // Lógica básica do Uno: cor igual ou valor igual
    if (carta.cor === naMesa.cor || carta.valor === naMesa.valor) {
        let novaMao = [...dados.jogadores[meuNick].mao];
        novaMao.splice(index, 1);

        const listaNomes = Object.keys(dados.jogadores);
        let meuIndex = listaNomes.indexOf(meuNick);
        let proximoIndex = (meuIndex + 1) % listaNomes.length;
        let proximoTurno = listaNomes[proximoIndex];

        const updates = {};
        updates[`salas/${salaID}/cartaNaMesa`] = carta;
        updates[`salas/${salaID}/turno`] = proximoTurno;
        updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = novaMao;

        await update(ref(db), updates);
    } else {
        alert("Esta carta não pode ser jogada agora!");
    }
}

// --- BOTÃO DE COMPRAR ---
document.getElementById('btnComprar').onclick = async () => {
    const snapshot = await get(ref(db, `salas/${salaID}`));
    const dados = snapshot.val();
    
    if (dados.turno !== meuNick) return alert("Espere sua vez!");

    let maoAtual = dados.jogadores[meuNick].mao || [];
    maoAtual.push(gerarCarta());

    await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), {
        mao: maoAtual
    });
};

// --- BOTÃO SAIR ---
document.getElementById('btnSair').onclick = () => {
    if(confirm("Deseja sair da partida?")) window.location.href = "index.html";
};
