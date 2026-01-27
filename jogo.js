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
    // Mais +2 e especiais para testar a mecânica
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2', 'draw2'];
    return { 
        cor: cores[Math.floor(Math.random() * cores.length)], 
        valor: valores[Math.floor(Math.random() * valores.length)] 
    };
}

function getNomeImagem(carta) {
    const especiais = ['skip', 'reverse', 'draw2'];
    if (especiais.includes(carta.valor)) {
        return `cartas/${carta.valor}_${carta.cor}.png`;
    }
    return `cartas/${carta.cor}_${carta.valor}.png`;
}

function criarCartaReserva(carta, tamanho) {
    const nomesEspeciais = { 'skip': '🚫', 'reverse': '🔄', 'draw2': '+2' };
    const label = nomesEspeciais[carta.valor] || carta.valor;
    const corHex = { 'red': '#ff5555', 'blue': '#5555ff', 'green': '#55aa55', 'yellow': '#ffaa00' }[carta.cor];
    return `<div style="width:${tamanho}px; height:${tamanho*1.4}px; background:${corHex}; border:3px solid white; border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:24px;">${label}</div>`;
}

// Lógica Circular
function calcularIndiceProximo(indiceAtual, totalJogadores, sentido, pulos = 1) {
    return (((indiceAtual + (sentido * pulos)) % totalJogadores) + totalJogadores) % totalJogadores;
}

// --- LOOP PRINCIPAL ---
onValue(ref(db, `salas/${salaID}`), async (snapshot) => {
    const dados = snapshot.val();
    if (!dados) { document.getElementById('txtVez').innerText = "Sala fechada."; return; }

    // SETUP INICIAL
    const nicks = Object.keys(dados.jogadores);
    if ((!dados.cartaNaMesa || !dados.turno) && meuNick === nicks[0]) {
        await update(ref(db, `salas/${salaID}`), {
            cartaNaMesa: gerarCarta(),
            turno: nicks[0],
            sentido: 1,
            acumulado: 0 // Novo campo para somar os +2
        });
        return;
    }

    if (!dados.jogadores[meuNick].mao) {
        let m = []; for(let i=0; i<7; i++) m.push(gerarCarta());
        await set(ref(db, `salas/${salaID}/jogadores/${meuNick}/mao`), m);
    }

    // --- INTERFACE ---
    
    // Mostra se tem ACUMULADO na tela
    const acumulado = dados.acumulado || 0;
    const txtVez = document.getElementById('txtVez');
    const seta = (dados.sentido || 1) === 1 ? "➡" : "⬅";
    
    let msgStatus = dados.turno === meuNick ? `⭐ SUA VEZ! (${seta})` : `Vez de ${dados.turno} (${seta})`;
    
    // Se tiver acumulado, avisa em vermelho
    if (acumulado > 0) {
        msgStatus += ` <br><span style="color:#ff4444; font-weight:bold; font-size:18px;">PERIGO: +${acumulado} CARTAS!</span>`;
    }
    txtVez.innerHTML = msgStatus;
    txtVez.style.color = dados.turno === meuNick ? "#4caf50" : "white";

    // Carta Mesa
    const cM = dados.cartaNaMesa;
    const cartaMesaDiv = document.getElementById('cartaMesa');
    if (cM) {
        cartaMesaDiv.innerHTML = `<img src="${getNomeImagem(cM)}" style="width:120px; filter:drop-shadow(0 0 10px rgba(255,255,255,0.3));" onerror="this.parentElement.innerHTML='${criarCartaReserva(cM, 120).replace(/"/g, "'")}'">`;
    }

    // Minha Mão
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    const mao = dados.jogadores[meuNick].mao || [];

    mao.forEach((c, i) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:inline-block; margin:0 5px; cursor:pointer; transition: transform 0.2s;';
        div.innerHTML = `<img src="${getNomeImagem(c)}" style="width:90px;" onerror="this.style.display='none'">`;
        
        const img = div.querySelector('img');
        img.onerror = () => { div.innerHTML = criarCartaReserva(c, 90); div.onclick = () => jogarCarta(c, i, dados); };
        
        div.onmouseover = () => div.style.transform = "translateY(-20px)";
        div.onmouseout = () => div.style.transform = "translateY(0)";
        div.onclick = () => jogarCarta(c, i, dados);
        minhaMaoDiv.appendChild(div);
    });
});

// --- AÇÃO: JOGAR CARTA ---
async function jogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return alert("Não é sua vez!");

    const mesa = dados.cartaNaMesa;
    const acumulado = dados.acumulado || 0;

    // --- REGRA DE DEFESA DO +2 ---
    // Se tiver acumulado pendente, SÓ pode jogar +2
    if (acumulado > 0 && carta.valor !== 'draw2') {
        return alert(`Você tem +${acumulado} acumulado! Jogue outro +2 para rebater ou compre as cartas.`);
    }

    // Validação normal (Cor ou Valor)
    // Exceção: Se for +2, pode jogar em cima de qualquer cor se tiver acumulado
    if (acumulado === 0 && carta.cor !== mesa.cor && carta.valor !== mesa.valor) {
        return alert("Carta inválida!");
    }

    // PREPARAR ATUALIZAÇÃO
    const nicks = Object.keys(dados.jogadores);
    let meuIndice = nicks.indexOf(meuNick);
    let sentido = dados.sentido || 1;
    let novoAcumulado = acumulado;
    let proximoIndice;
    const updates = {};

    // Remove carta da mão
    let novaMao = [...dados.jogadores[meuNick].mao];
    novaMao.splice(index, 1);
    updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = novaMao;
    updates[`salas/${salaID}/cartaNaMesa`] = carta;

    // --- EFEITOS ---
    if (carta.valor === 'draw2') {
        novoAcumulado += 2; // SOMA NO ACUMULADO
        // Não pula ninguém! Passa a vez pro próximo tentar defender.
        proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentido, 1);
    } 
    else if (carta.valor === 'reverse') {
        if (nicks.length === 2) {
            proximoIndice = meuIndice; // 2 jogadores = funciona como skip
        } else {
            sentido *= -1;
            updates[`salas/${salaID}/sentido`] = sentido;
            proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentido, 1);
        }
    } 
    else if (carta.valor === 'skip') {
        proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentido, 2);
    } 
    else {
        proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentido, 1);
    }

    updates[`salas/${salaID}/acumulado`] = novoAcumulado;
    updates[`salas/${salaID}/turno`] = nicks[proximoIndice];

    await update(ref(db), updates);
}

// --- AÇÃO: COMPRAR (ACEITAR O ACUMULADO OU COMPRAR 1) ---
document.getElementById('btnComprar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    if (d.turno !== meuNick) return alert("Espere sua vez!");

    const acumulado = d.acumulado || 0;
    let qtdComprar = 1;
    let perdeuVez = false;

    // Se tem acumulado, compra tudo e perde a vez
    if (acumulado > 0) {
        if(!confirm(`Você não defendeu! Deseja comprar ${acumulado} cartas?`)) return;
        qtdComprar = acumulado;
        perdeuVez = true; // Aceitou a punição, perde a vez
    }

    let novaMao = d.jogadores[meuNick].mao || [];
    for(let i=0; i<qtdComprar; i++) novaMao.push(gerarCarta());

    const updates = {};
    updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = novaMao;
    
    // Se comprou o acumulado, ZERA ele e PASSA a vez
    if (acumulado > 0) {
        updates[`salas/${salaID}/acumulado`] = 0;
        
        const nicks = Object.keys(d.jogadores);
        const sentido = d.sentido || 1;
        const meuIndice = nicks.indexOf(meuNick);
        const proximo = calcularIndiceProximo(meuIndice, nicks.length, sentido, 1);
        
        updates[`salas/${salaID}/turno`] = nicks[proximo];
    } 
    // Se comprou normal (1 carta), mantém a vez para tentar jogar (opcional, aqui mantive a vez)
    // Se quiser que passe a vez ao comprar 1, descomente as linhas de turno abaixo

    await update(ref(db), updates);
};

document.getElementById('btnSair').onclick = () => { if(confirm("Sair?")) window.location.href = "index.html"; };
