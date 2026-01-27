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

// Se não tiver login, volta pro início
if (!salaID || !meuNick) window.location.href = "index.html";

document.getElementById('txtSalaID').innerText = salaID;

// --- GERAR CARTA ---
function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    // Adicionei os especiais na lista
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    
    return { 
        cor: cores[Math.floor(Math.random() * cores.length)], 
        valor: valores[Math.floor(Math.random() * valores.length)] 
    };
}

// --- FUNÇÃO PARA DESCOBRIR O NOME CORRETO DA IMAGEM ---
// Baseado na sua imagem: Números = blue_0.png | Especiais = skip_red.png
function getNomeImagem(carta) {
    const especiais = ['skip', 'reverse', 'draw2'];
    if (especiais.includes(carta.valor)) {
        return `cartas/${carta.valor}_${carta.cor}.png`; // Ex: skip_red.png
    } else {
        return `cartas/${carta.cor}_${carta.valor}.png`; // Ex: red_0.png
    }
}

function criarCartaReserva(carta, tamanho) {
    const nomesEspeciais = { 'skip': '🚫', 'reverse': '🔄', 'draw2': '+2' };
    const label = nomesEspeciais[carta.valor] || carta.valor;
    const corHex = { 'red': '#ff5555', 'blue': '#5555ff', 'green': '#55aa55', 'yellow': '#ffaa00' }[carta.cor];

    return `<div style="width: ${tamanho}px; height: ${tamanho * 1.5}px; 
            background: ${corHex}; border: 4px solid white; 
            border-radius: 10px; display: flex; align-items: center; 
            justify-content: center; color: white; font-family: Arial; 
            font-weight: bold; font-size: 30px; box-shadow: 0 4px 8px rgba(0,0,0,0.5);">
            ${label}
            </div>`;
}

// --- ESCUTA O JOGO (Loop Principal) ---
onValue(ref(db, `salas/${salaID}`), async (snapshot) => {
    const dados = snapshot.val();

    // 1. Se a sala não existe, avisa
    if (!dados) {
        document.getElementById('txtVez').innerText = "Sala não encontrada!";
        return;
    }

    // --- CORREÇÃO DE INICIALIZAÇÃO ---
    // Se não tem carta na mesa OU não tem turno, forçamos o início agora.
    // Usamos o primeiro jogador da lista como "Líder" temporário para fazer isso.
    const listaJogadores = Object.keys(dados.jogadores);
    const primeiroJogador = listaJogadores[0];

    if ((!dados.cartaNaMesa || !dados.turno) && meuNick === primeiroJogador) {
        const updates = {};
        if (!dados.cartaNaMesa) updates['cartaNaMesa'] = gerarCarta();
        if (!dados.turno) updates['turno'] = primeiroJogador;
        
        await update(ref(db, `salas/${salaID}`), updates);
        return; // Reinicia o loop para pegar os dados novos
    }
    
    // Se eu entrei agora e não tenho mão, crio minha mão
    if (!dados.jogadores[meuNick] || !dados.jogadores[meuNick].mao) {
        let novaMao = [];
        for (let i = 0; i < 7; i++) novaMao.push(gerarCarta());
        await set(ref(db, `salas/${salaID}/jogadores/${meuNick}/mao`), novaMao);
        return;
    }

    // --- RENDERIZAÇÃO ---
    
    // 2. Carta da Mesa
    const cartaMesaDiv = document.getElementById('cartaMesa');
    if (dados.cartaNaMesa) {
        const c = dados.cartaNaMesa;
        const srcImg = getNomeImagem(c);
        
        cartaMesaDiv.innerHTML = `<img src="${srcImg}" style="width: 120px; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.7));" 
            onerror="this.parentElement.innerHTML = '${criarCartaReserva(c, 120).replace(/"/g, "'")}'">`;
    }

    // 3. Status do Turno
    const txtVez = document.getElementById('txtVez');
    if (dados.turno) {
        txtVez.innerText = dados.turno === meuNick ? "SUA VEZ!" : `Vez de ${dados.turno}`;
        txtVez.style.color = dados.turno === meuNick ? "#4caf50" : "#ffeb3b";
    } else {
        txtVez.innerText = "Carregando...";
    }

    // 4. Minha Mão (Garante que só vejo a minha)
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    
    // Pega APENAS a mão do meuNick
    const minhasCartas = dados.jogadores[meuNick].mao || [];

    minhasCartas.forEach((carta, index) => {
        const container = document.createElement('div');
        container.style.display = "inline-block";
        container.style.margin = "5px";
        container.style.cursor = "pointer";
        container.style.transition = "transform 0.2s";

        const srcImg = getNomeImagem(carta);

        const img = document.createElement('img');
        img.src = srcImg;
        img.style.width = "100px"; // Um pouco menor para caber no celular
        
        // Se a imagem falhar, desenha o quadrado colorido
        img.onerror = () => {
            container.innerHTML = criarCartaReserva(carta, 100);
        };

        container.onmouseover = () => { container.style.transform = "translateY(-20px)"; };
        container.onmouseout = () => { container.style.transform = "translateY(0)"; };
        container.onclick = () => jogarCarta(carta, index, dados);

        container.appendChild(img);
        minhaMaoDiv.appendChild(container);
    });
});

// --- AÇÕES DO JOGO ---
async function jogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) {
        alert("Espere sua vez!");
        return;
    }

    const mesa = dados.cartaNaMesa;
    
    // Regra básica: mesma cor OU mesmo valor
    if (carta.cor === mesa.cor || carta.valor === mesa.valor) {
        let novaMao = [...dados.jogadores[meuNick].mao];
        novaMao.splice(index, 1); // Remove carta da mão

        // Passa a vez
        const nicks = Object.keys(dados.jogadores);
        let proxIndex = (nicks.indexOf(meuNick) + 1) % nicks.length;
        let proximoNick = nicks[proxIndex];

        // Se for +2, o próximo compra 2 (Lógica simples, podemos melhorar depois)
        if (carta.valor === 'draw2') {
            // Lógica futura... por enquanto só passa a vez
        }

        await update(ref(db, `salas/${salaID}`), {
            cartaNaMesa: carta,
            turno: proximoNick,
            [`jogadores/${meuNick}/mao`]: novaMao
        });
    } else {
        alert("Carta inválida! Deve ser da mesma cor ou valor.");
    }
}

document.getElementById('btnComprar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    
    if (d.turno !== meuNick) return alert("Não é sua vez!");

    let mao = d.jogadores[meuNick].mao || [];
    mao.push(gerarCarta()); // Compra uma
    
    await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: mao });
};

document.getElementById('btnSair').onclick = () => {
    if (confirm("Sair da sala?")) window.location.href = "index.html";
};
