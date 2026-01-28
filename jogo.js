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

let apertouUno = false;

if (!salaID || !meuNick) window.location.href = "index.html";
document.getElementById('txtSalaID').innerText = salaID;

// --- UTILITÁRIOS ---
function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    return { 
        cor: cores[Math.floor(Math.random() * cores.length)], 
        valor: valores[Math.floor(Math.random() * valores.length)] 
    };
}

function getNomeImagem(carta) {
    const especiais = ['skip', 'reverse', 'draw2'];
    return especiais.includes(carta.valor) ? `cartas/${carta.valor}_${carta.cor}.png` : `cartas/${carta.cor}_${carta.valor}.png`;
}

function calcularIndiceProximo(indiceAtual, totalJogadores, sentido, pulos = 1) {
    return (((indiceAtual + (sentido * pulos)) % totalJogadores) + totalJogadores) % totalJogadores;
}

// --- LOOP PRINCIPAL (onValue) ---
onValue(ref(db, `salas/${salaID}`), async (snapshot) => {
    const dados = snapshot.val();
    if (!dados) return;

    const nicks = Object.keys(dados.jogadores);
    const isMinhaVez = dados.turno === meuNick;
    const mao = dados.jogadores[meuNick].mao || [];
    const acumulado = dados.acumulado || 0;

    // --- LÓGICA DOS BOTÕES EXTRAS ---
    // Botão UNO!: Aparece se for sua vez e você tiver 2 cartas
    document.getElementById('btnUno').style.display = (isMinhaVez && mao.length === 2) ? 'block' : 'none';
    
    // Botão Passar: Aparece se já comprou na vez e não tem punição de +2 pendente
    document.getElementById('btnPassar').style.display = (isMinhaVez && dados.comprouNaVez && acumulado === 0) ? 'block' : 'none';
    
    // Botão Desafiar: Aparece para você se OUTRO jogador esqueceu o UNO
    const vitima = nicks.find(n => dados.jogadores[n].esqueceuUno === true);
    document.getElementById('btnDenunciar').style.display = (vitima && vitima !== meuNick) ? 'block' : 'none';

    // Status da Vez e Sentido
    const seta = (dados.sentido || 1) === 1 ? "➡" : "⬅";
    let msgStatus = isMinhaVez ? `<b style="color:#4caf50">SUA VEZ! ${seta}</b>` : `Vez de ${dados.turno} ${seta}`;
    if (acumulado > 0) msgStatus += `<br><span style="color:#ff4444">+${acumulado} ACUMULADO!</span>`;
    document.getElementById('txtVez').innerHTML = msgStatus;

    // Carta na Mesa
    if (dados.cartaNaMesa) {
        document.getElementById('cartaMesa').innerHTML = `<img src="${getNomeImagem(dados.cartaNaMesa)}" style="width:110px;">`;
    }

    // Renderizar Minha Mão
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    mao.forEach((c, i) => {
        const slot = document.createElement('div');
        slot.className = "carta-slot";
        slot.innerHTML = `<img src="${getNomeImagem(c)}">`;
        slot.onclick = () => jogarCarta(c, i, dados);
        minhaMaoDiv.appendChild(slot);
    });
});

// --- AÇÃO: JOGAR CARTA ---
async function jogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return;
    
    const mesa = dados.cartaNaMesa;
    const acumulado = dados.acumulado || 0;

    // Regra de Defesa: Se tem +2 na mesa, só pode jogar outro +2
    if (acumulado > 0 && carta.valor !== 'draw2') {
        return alert(`Defenda com +2 ou compre ${acumulado} cartas!`);
    }

    // Validação de cor/valor normal
    if (acumulado === 0 && carta.cor !== mesa.cor && carta.valor !== mesa.valor) {
        return alert("Carta inválida!");
    }

    let novaMao = [...dados.jogadores[meuNick].mao];
    novaMao.splice(index, 1);
    
    const nicks = Object.keys(dados.jogadores);
    let meuIndice = nicks.indexOf(meuNick);
    let sentido = dados.sentido || 1;
    let novoAcumulado = acumulado;
    let proximoIndice;
    const updates = {};

    // Efeitos das Cartas
    if (carta.valor === 'draw2') {
        novoAcumulado += 2;
        proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentido, 1);
    } else if (carta.valor === 'reverse') {
        sentido *= -1;
        updates[`salas/${salaID}/sentido`] = sentido;
        proximoIndice = (nicks.length === 2) ? meuIndice : calcularIndiceProximo(meuIndice, nicks.length, sentido, 1);
    } else if (carta.valor === 'skip') {
        proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentido, 2);
    } else {
        proximoIndice = calcularIndiceProximo(meuIndice, nicks.length, sentido, 1);
    }

    // Lógica de Esquecer UNO
    if (novaMao.length === 1 && !apertouUno) {
        updates[`salas/${salaID}/jogadores/${meuNick}/esqueceuUno`] = true;
        // Dá 4 segundos para alguém desafiar antes de sumir
        setTimeout(() => update(ref(db), {[`salas/${salaID}/jogadores/${meuNick}/esqueceuUno`]: false}), 4000);
    }
    apertouUno = false;

    updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = novaMao;
    updates[`salas/${salaID}/cartaNaMesa`] = carta;
    updates[`salas/${salaID}/acumulado`] = novoAcumulado;
    updates[`salas/${salaID}/turno`] = nicks[proximoIndice];
    updates[`salas/${salaID}/comprouNaVez`] = false;

    await update(ref(db), updates);
}

// --- AÇÕES DOS BOTÕES ---

document.getElementById('btnUno').onclick = () => {
    apertouUno = true;
    alert("Você gritou UNO!");
};

document.getElementById('btnComprar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    if (d.turno !== meuNick || d.comprouNaVez) return;

    const acumulado = d.acumulado || 0;
    let novaMao = d.jogadores[meuNick].mao || [];
    const updates = {};

    if (acumulado > 0) {
        for(let i=0; i<acumulado; i++) novaMao.push(gerarCarta());
        updates[`salas/${salaID}/acumulado`] = 0;
        // Se comprou acumulado, passa a vez direto
        const nicks = Object.keys(d.jogadores);
        const prox = calcularIndiceProximo(nicks.indexOf(meuNick), nicks.length, d.sentido || 1, 1);
        updates[`salas/${salaID}/turno`] = nicks[prox];
    } else {
        novaMao.push(gerarCarta());
        updates[`salas/${salaID}/comprouNaVez`] = true;
    }

    updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = novaMao;
    await update(ref(db), updates);
};

document.getElementById('btnPassar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    const nicks = Object.keys(d.jogadores);
    const prox = calcularIndiceProximo(nicks.indexOf(meuNick), nicks.length, d.sentido || 1, 1);
    await update(ref(db), { 
        [`salas/${salaID}/turno`]: nicks[prox], 
        [`salas/${salaID}/comprouNaVez`]: false 
    });
};

document.getElementById('btnDenunciar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    const vitima = Object.keys(d.jogadores).find(n => d.jogadores[n].esqueceuUno === true);
    
    if (vitima) {
        let m = d.jogadores[vitima].mao || [];
        m.push(gerarCarta(), gerarCarta()); // Punição +2
        await update(ref(db), { 
            [`salas/${salaID}/jogadores/${vitima}/mao`]: m,
            [`salas/${salaID}/jogadores/${vitima}/esqueceuUno`]: false 
        });
        alert(`Você desafiou ${vitima}! Eles compraram +2 cartas.`);
    }
};

document.getElementById('btnSair').onclick = () => { 
    if(confirm("Deseja sair da partida?")) window.location.href = "index.html"; 
};
