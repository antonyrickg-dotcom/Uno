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
    const cores = ['red', 'blue', 'green', 'yellow'];
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '🚫', '🔄', '+2'];
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

    // Se eu ainda não tenho cartas, recebo 7 agora
    if (!dados.jogadores[meuNick].mao) {
        let novaMao = [];
        for (let i = 0; i < 7; i++) {
            novaMao.push(gerarCarta());
        }
        await set(ref(db, `salas/${salaID}/jogadores/${meuNick}/mao`), novaMao);
    }

    // Se sou o dono e não tem carta na mesa, coloco a primeira
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
        cartaMesaDiv.className = dados.cartaNaMesa.cor;
        cartaMesaDiv.innerText = dados.cartaNaMesa.valor;
    }

    // 2. Atualiza de quem é a vez
    document.getElementById('txtVez').innerText = dados.turno === meuNick ? "SUA VEZ!" : `Vez de ${dados.turno}`;
    document.getElementById('txtVez').style.color = dados.turno === meuNick ? "#4caf50" : "#ffeb3b";

    // 3. Renderiza minha mão
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    const minhasCartas = dados.jogadores[meuNick].mao || [];

    minhasCartas.forEach((carta, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = `card ${carta.cor}`;
        cardEl.innerHTML = `<span>${carta.valor}</span>`;
        
        // Clique para jogar a carta
        cardEl.onclick = () => tentarJogarCarta(carta, index, dados);
        
        minhaMaoDiv.appendChild(cardEl);
    });
});

// --- LÓGICA DE JOGAR A CARTA ---
async function tentarJogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return alert("Não é sua vez!");

    const naMesa = dados.cartaNaMesa;

    // Regra do UNO: Cor igual ou Valor igual
    if (carta.cor === naMesa.cor || carta.valor === naMesa.valor) {
        // 1. Remove a carta da minha mão
        let novaMao = [...dados.jogadores[meuNick].mao];
        novaMao.splice(index, 1);

        // 2. Define o próximo jogador (lógica simples de rodízio)
        const listaNomes = Object.keys(dados.jogadores);
        let meuIndex = listaNomes.indexOf(meuNick);
        let proximoIndex = (meuIndex + 1) % listaNomes.length;
        let proximoTurno = listaNomes[proximoIndex];

        // 3. Atualiza o Firebase
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
