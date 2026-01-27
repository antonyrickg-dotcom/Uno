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

// --- UTILITÁRIOS ---
function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    // Adicionei mais peso para cartas numéricas para balancear
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2', 'skip', 'reverse', 'draw2'];
    
    return { 
        cor: cores[Math.floor(Math.random() * cores.length)], 
        valor: valores[Math.floor(Math.random() * valores.length)] 
    };
}

function getNomeImagem(carta) {
    const especiais = ['skip', 'reverse', 'draw2'];
    if (especiais.includes(carta.valor)) {
        return `cartas/${carta.valor}_${carta.cor}.png`; // Ex: skip_red.png
    }
    return `cartas/${carta.cor}_${carta.valor}.png`; // Ex: red_0.png
}

function criarCartaReserva(carta, tamanho) {
    const nomesEspeciais = { 'skip': '🚫', 'reverse': '🔄', 'draw2': '+2' };
    const label = nomesEspeciais[carta.valor] || carta.valor;
    const corHex = { 'red': '#ff5555', 'blue': '#5555ff', 'green': '#55aa55', 'yellow': '#ffaa00' }[carta.cor];
    return `<div style="width:${tamanho}px; height:${tamanho*1.4}px; background:${corHex}; border:3px solid white; border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:24px;">${label}</div>`;
}

// --- LÓGICA DE LISTA CIRCULAR (Para lidar com Reverse e Loop) ---
function calcularIndiceProximo(indiceAtual, totalJogadores, sentido, pulos = 1) {
    // A mágica matemática para o índice nunca sair da lista (mesmo negativo)
    return (((indiceAtual + (sentido * pulos)) % totalJogadores) + totalJogadores) % totalJogadores;
}

// --- LOOP PRINCIPAL DO JOGO ---
onValue(ref(db, `salas/${salaID}`), async (snapshot) => {
    const dados = snapshot.val();
    if (!dados) {
        document.getElementById('txtVez').innerText = "Sala fechada ou inexistente.";
        return;
    }

    // --- SETUP INICIAL (Garante que sentido e turno existam) ---
    const nicks = Object.keys(dados.jogadores);
    if ((!dados.cartaNaMesa || !dados.turno || dados.sentido === undefined) && meuNick === nicks[0]) {
        const updates = {};
        if (!dados.cartaNaMesa) updates['cartaNaMesa'] = gerarCarta();
        if (!dados.turno) updates['turno'] = nicks[0];
        if (dados.sentido === undefined) updates['sentido'] = 1; // 1 = Horário, -1 = Anti-horário
        await update(ref(db, `salas/${salaID}`), updates);
        return;
    }

    // Se sou novo, crio minha mão
    if (!dados.jogadores[meuNick] || !dados.jogadores[meuNick].mao) {
        let novaMao = [];
        for(let i=0; i<7; i++) novaMao.push(gerarCarta());
        await set(ref(db, `salas/${salaID}/jogadores/${meuNick}/mao`), novaMao);
        return;
    }

    // --- INTERFACE ---
    // Carta da Mesa
    const cartaMesaDiv = document.getElementById('cartaMesa');
    const cM = dados.cartaNaMesa;
    if (cM) {
        cartaMesaDiv.innerHTML = `<img src="${getNomeImagem(cM)}" style="width:120px; filter:drop-shadow(0 0 10px rgba(255,255,255,0.3));" 
            onerror="this.parentElement.innerHTML='${criarCartaReserva(cM, 120).replace(/"/g, "'")}'">`;
    }

    // Texto de Turno (Com seta de direção)
    const txtVez = document.getElementById('txtVez');
    const seta = dados.sentido === 1 ? "➡" : "⬅"; // Seta visual
    txtVez.innerText = dados.turno === meuNick ? `⭐ SUA VEZ! (${seta})` : `Vez de ${dados.turno} (${seta})`;
    txtVez.style.color = dados.turno === meuNick ? "#4caf50" : "white";

    // Minha Mão
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    const minhasCartas = dados.jogadores[meuNick].mao || [];

    minhasCartas.forEach((c, i) => {
        const div = document.createElement('div');
        div.style.display = 'inline-block';
        div.style.margin = '0 5px';
        div.style.cursor = 'pointer';
        div.innerHTML = `<img src="${getNomeImagem(c)}" style="width:90px; transition: transform 0.2s;" onerror="this.style.display='none'">`;
        
        // Fallback se imagem falhar (ele esconde a img e mostra o div colorido)
        const img = div.querySelector('img');
        img.onerror = () => { div.innerHTML = criarCartaReserva(c, 90); div.onclick = () => jogarCarta(c, i, dados); };
        
        div.onmouseover = () => { div.style.transform = "translateY(-20px)"; };
        div.onmouseout = () => { div.style.transform = "translateY(0)"; };
        div.onclick = () => jogarCarta(c, i, dados);
        
        minhaMaoDiv.appendChild(div);
    });
});

// --- LÓGICA COMPLEXA DE JOGADA ---
async function jogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return alert("Não é sua vez!");

    const mesa = dados.cartaNaMesa;
    // Regra Básica de Validação
    if (carta.cor !== mesa.cor && carta.valor !== mesa.valor) {
        return alert("Carta inválida! Cor ou Valor devem coincidir.");
    }

    // 1. Preparar dados
    const nicks = Object.keys(dados.jogadores);
    let meuIndice = nicks.indexOf(meuNick);
    let sentidoAtual = dados.sentido || 1;
    let proximoIndice;
    
    // Objeto de atualizações para enviar tudo de uma vez ao Firebase
    const updates = {};
    
    // Remover minha carta
    let minhaNovaMao = [...dados.jogadores[meuNick].mao];
    minhaNovaMao.splice(index, 1);
    updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = minhaNovaMao;
    updates[`salas/${salaID}/cartaNaMesa`] = carta;

    // --- 2. EFEITOS ESPECIAIS ---
    
    if (carta.valor === 'reverse') {
        // Se só tem 2 jogadores, Reverse age como Skip (Pula o outro)
        if (nicks.length === 2) {
            proximoIndice = meuIndice; // Volta pra mim
        } else {
            sentidoAtual *= -1; // Inverte direção
            updates[`salas/${salaID}/sentido`] = sentidoAtual;
            proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentidoAtual, 1);
        }
    } 
    
    else if (carta.valor === 'skip') {
        // Pula 1 pessoa (avança 2 posições)
        proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentidoAtual, 2);
    } 
    
    else if (carta.valor === 'draw2') {
        // 1. Acha quem vai tomar o +2
        let indiceVitima = calcularIndiceProximo(meuIndice, nicks.length, sentidoAtual, 1);
        let nickVitima = nicks[indiceVitima];
        
        // 2. Dá as cartas pra vitima
        let maoVitima = dados.jogadores[nickVitima].mao || [];
        maoVitima.push(gerarCarta());
        maoVitima.push(gerarCarta());
        updates[`salas/${salaID}/jogadores/${nickVitima}/mao`] = maoVitima;

        // 3. Pula a vez da vítima (quem joga é o próximo depois dela)
        proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentidoAtual, 2);
    } 
    
    else {
        // Carta Normal
        proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentidoAtual, 1);
    }

    // Definir quem joga agora
    updates[`salas/${salaID}/turno`] = nicks[proximoIndice];

    // Enviar tudo pro Firebase
    await update(ref(db), updates);
}

document.getElementById('btnComprar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    if (d.turno !== meuNick) return alert("Espere sua vez!");

    let m = d.jogadores[meuNick].mao || [];
    m.push(gerarCarta());
    await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: m });
};

document.getElementById('btnSair').onclick = () => { if(confirm("Sair?")) window.location.href = "index.html"; };
