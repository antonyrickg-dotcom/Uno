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
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    return {
        cor: cores[Math.floor(Math.random() * cores.length)],
        valor: valores[Math.floor(Math.random() * valores.length)]
    };
}

// --- FUNÇÃO PARA DESENHAR CARTA CASO A IMAGEM NÃO EXISTA ---
function criarCartaReserva(carta, tamanho) {
    const nomesEspeciais = { 'skip': '🚫', 'reverse': '🔄', 'draw2': '+2' };
    const label = nomesEspeciais[carta.valor] || carta.valor;
    const corHex = { 'red': '#ff5555', 'blue': '#5555ff', 'green': '#55aa55', 'yellow': '#ffaa00' }[carta.cor];

    return `
        <div style="width: ${tamanho}px; height: ${tamanho * 1.5}px; 
                    background: ${corHex}; border: 4px solid white; 
                    border-radius: 10px; display: flex; align-items: center; 
                    justify-content: center; color: white; font-family: Arial; 
                    font-weight: bold; font-size: 30px; box-shadow: 0 4px 8px rgba(0,0,0,0.5);">
            ${label}
        </div>`;
}

// --- INICIALIZAÇÃO DA PARTIDA ---
async function setupInicial() {
    const salaRef = ref(db, `salas/${salaID}`);
    const snapshot = await get(salaRef);
    const dados = snapshot.val();
    if (!dados) return;

    if (!dados.jogadores[meuNick].mao) {
        let novaMao = [];
        for (let i = 0; i < 7; i++) novaMao.push(gerarCarta());
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
        const c = dados.cartaNaMesa;
        const imgPath = `cartas/${c.valor}_${c.cor}.png`;
        const imgPathAlt = `cartas/${c.cor}_${c.valor}.png`;

        cartaMesaDiv.innerHTML = `<img src="${imgPath}" id="imgMesa" style="width: 120px; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.7));">`;
        
        const imgEl = document.getElementById('imgMesa');
        imgEl.onerror = () => {
            // Se falhar o primeiro caminho, tenta o segundo
            if (imgEl.src.includes(imgPath)) {
                imgEl.src = imgPathAlt;
            } else {
                // Se ambos falharem, desenha a carta reserva
                cartaMesaDiv.innerHTML = criarCartaReserva(c, 120);
            }
        };
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
        const container = document.createElement('div');
        container.style.display = "inline-block";
        container.style.margin = "5px";
        container.style.transition = "all 0.2s ease";
        container.style.cursor = "pointer";

        const imgPath = `cartas/${carta.valor}_${carta.cor}.png`;
        const imgPathAlt = `cartas/${carta.cor}_${carta.valor}.png`;

        const img = document.createElement('img');
        img.src = imgPath;
        img.style.width = "110px";
        img.style.filter = "drop-shadow(0 5px 10px rgba(0,0,0,0.5))";

        img.onerror = () => {
            if (img.src.includes(imgPath)) {
                img.src = imgPathAlt;
            } else {
                container.innerHTML = criarCartaReserva(carta, 110);
            }
        };

        container.onmouseover = () => { container.style.transform = "translateY(-30px) scale(1.1)"; container.style.zIndex = "100"; };
        container.onmouseout = () => { container.style.transform = "translateY(0) scale(1)"; container.style.zIndex = "1"; };
        container.onclick = () => tentarJogarCarta(carta, index, dados);

        container.appendChild(img);
        minhaMaoDiv.appendChild(container);
    });
});

// --- LÓGICA DE JOGAR A CARTA ---
async function tentarJogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return alert("Não é sua vez!");
    const naMesa = dados.cartaNaMesa;

    if (carta.cor === naMesa.cor || carta.valor === naMesa.valor) {
        let novaMao = [...dados.jogadores[meuNick].mao];
        novaMao.splice(index, 1);

        const listaNomes = Object.keys(dados.jogadores);
        let proximoTurno = listaNomes[(listaNomes.indexOf(meuNick) + 1) % listaNomes.length];

        const updates = {};
        updates[`salas/${salaID}/cartaNaMesa`] = carta;
        updates[`salas/${salaID}/turno`] = proximoTurno;
        updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = novaMao;
        await update(ref(db), updates);
    } else {
        alert("Esta carta não pode ser jogada agora!");
    }
}

document.getElementById('btnComprar').onclick = async () => {
    const snapshot = await get(ref(db, `salas/${salaID}`));
    const dados = snapshot.val();
    if (dados.turno !== meuNick) return alert("Espere sua vez!");
    let maoAtual = dados.jogadores[meuNick].mao || [];
    maoAtual.push(gerarCarta());
    await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: maoAtual });
};

document.getElementById('btnSair').onclick = () => { if(confirm("Deseja sair?")) window.location.href = "index.html"; };
