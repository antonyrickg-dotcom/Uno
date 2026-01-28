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
let cartaPendente = null;
let indicePendente = null;

if (!salaID || !meuNick) window.location.href = "index.html";
document.getElementById('txtSalaID').innerText = salaID;

function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    
    // 15% de chance de vir um Curinga
    if (Math.random() < 0.15) {
        const curingas = ['wild', 'wild_draw4'];
        return { cor: 'black', valor: curingas[Math.floor(Math.random() * curingas.length)] };
    }

    return { 
        cor: cores[Math.floor(Math.random() * cores.length)], 
        valor: valores[Math.floor(Math.random() * valores.length)] 
    };
}

function getNomeImagem(c) {
    if (c.cor === 'black') return `cartas/${c.valor}.png`;
    // Se a carta for um curinga que já teve a cor escolhida (originalCor salva que era preto)
    if (c.originalCor === 'black') return `cartas/${c.valor}_${c.cor}.png`;
    
    const esp = ['skip', 'reverse', 'draw2'];
    return esp.includes(c.valor) ? `cartas/${c.valor}_${c.cor}.png` : `cartas/${c.cor}_${c.valor}.png`;
}

function calcProx(atual, total, sentido, pulos = 1) {
    return (((atual + (sentido * pulos)) % total) + total) % total;
}

// ESCUTAR MUDANÇAS NO JOGO
onValue(ref(db, `salas/${salaID}`), async (snapshot) => {
    const dados = snapshot.val();
    if (!dados || !dados.jogadores) return;

    if (dados.vencedor) {
        document.getElementById('telaVitoria').style.display = 'flex';
        document.getElementById('txtVencedor').innerText = dados.vencedor === meuNick ? "VOCÊ VENCEU!" : `${dados.vencedor} VENCEU!`;
        return;
    } else {
        document.getElementById('telaVitoria').style.display = 'none';
    }

    const nicks = Object.keys(dados.jogadores);
    
    const listaDiv = document.getElementById('listaJogadores');
    if (listaDiv) {
        listaDiv.innerHTML = "";
        nicks.forEach(nick => {
            const qtdCartas = dados.jogadores[nick].mao ? dados.jogadores[nick].mao.length : 0;
            const isVezDele = dados.turno === nick;
            const item = document.createElement('div');
            item.className = `jogador-item ${isVezDele ? 'vez-dele' : ''}`;
            item.innerHTML = `<span>${nick === meuNick ? 'Você' : nick}</span><span class="badge-cartas">${qtdCartas} 🗂️</span>`;
            listaDiv.appendChild(item);
        });
    }

    if (!dados.jogadores[meuNick].mao || dados.jogadores[meuNick].mao.length === 0) {
        let novaMao = [];
        for (let i = 0; i < 7; i++) novaMao.push(gerarCarta());
        await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: novaMao });
        return;
    }

    if (!dados.turno && meuNick === nicks[0]) {
        await update(ref(db, `salas/${salaID}`), { turno: nicks[0], cartaNaMesa: gerarCarta(), sentido: 1, acumulado: 0 });
        return;
    }

    const isMinhaVez = dados.turno === meuNick;
    const mao = dados.jogadores[meuNick].mao || [];
    
    document.getElementById('btnUno').style.display = (isMinhaVez && mao.length === 2) ? 'block' : 'none';
    document.getElementById('btnPassar').style.display = (isMinhaVez && dados.comprouNaVez && (dados.acumulado || 0) === 0) ? 'block' : 'none';
    
    const vitima = nicks.find(n => dados.jogadores[n].esqueceuUno === true);
    document.getElementById('btnDenunciar').style.display = (vitima && vitima !== meuNick) ? 'block' : 'none';

    const seta = (dados.sentido || 1) === 1 ? "➡" : "⬅";
    document.getElementById('txtVez').innerHTML = isMinhaVez ? `<b style="color:#4caf50">SUA VEZ! ${seta}</b>` : `Vez de ${dados.turno} ${seta}`;

    if (dados.cartaNaMesa) document.getElementById('cartaMesa').innerHTML = `<img src="${getNomeImagem(dados.cartaNaMesa)}">`;

    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    mao.forEach((c, i) => {
        const slot = document.createElement('div');
        slot.className = "carta-slot";
        slot.innerHTML = `<img src="${getNomeImagem(c)}">`;
        slot.onclick = () => preVerificarJogada(c, i, dados);
        minhaMaoDiv.appendChild(slot);
    });
});

// FUNÇÃO PARA ABRIR MODAL SE FOR CURINGA
function preVerificarJogada(carta, index, dados) {
    if (dados.turno !== meuNick) return;

    // Se for curinga (preto), abre o modal antes de processar
    if (carta.cor === 'black') {
        cartaPendente = carta;
        indicePendente = index;
        document.getElementById('modalCores').style.display = 'flex';
        return;
    }

    // Se for carta normal, segue o fluxo
    processarJogada(carta, index, dados);
}

// FUNÇÃO CHAMADA PELO HTML (MODAL)
window.escolherNovaCor = async (corEscolhida) => {
    document.getElementById('modalCores').style.display = 'none';
    const snap = await get(ref(db, `salas/${salaID}`));
    const dados = snap.val();

    if (cartaPendente) {
        const cartaComCor = { 
            ...cartaPendente, 
            cor: corEscolhida, 
            originalCor: 'black' 
        };
        processarJogada(cartaComCor, indicePendente, dados);
        cartaPendente = null;
        indicePendente = null;
    }
};

async function processarJogada(carta, index, dados) {
    const acumulado = dados.acumulado || 0;

    // Validação de regras (Curingas ignoram cor na mesa ao serem lançados)
    if (carta.originalCor !== 'black') {
        if (acumulado > 0 && carta.valor !== 'draw2') return alert("Compre as cartas ou jogue +2!");
        if (acumulado === 0 && carta.cor !== dados.cartaNaMesa.cor && carta.valor !== dados.cartaNaMesa.valor) return alert("Carta inválida!");
    }

    let novaMao = [...dados.jogadores[meuNick].mao];
    novaMao.splice(index, 1);
    
    if (novaMao.length === 0) {
        await update(ref(db, `salas/${salaID}`), { vencedor: meuNick });
        return;
    }

    const nicks = Object.keys(dados.jogadores);
    let sentido = dados.sentido || 1;
    let novoAcumulado = acumulado;
    let proximo;

    if (carta.valor === 'draw2') { 
        novoAcumulado += 2; 
        proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1); 
    }
    else if (carta.valor === 'wild_draw4') {
        novoAcumulado += 4;
        proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1);
    }
    else if (carta.valor === 'reverse') { 
        sentido *= -1; 
        proximo = (nicks.length === 2) ? nicks.indexOf(meuNick) : calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1); 
    }
    else if (carta.valor === 'skip') { 
        proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 2); 
    }
    else { 
        proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1); 
    }

    const updates = {};
    updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = novaMao;
    updates[`salas/${salaID}/cartaNaMesa`] = carta;
    updates[`salas/${salaID}/turno`] = nicks[proximo];
    updates[`salas/${salaID}/sentido`] = sentido;
    updates[`salas/${salaID}/acumulado`] = novoAcumulado;
    updates[`salas/${salaID}/comprouNaVez`] = false;

    if (novaMao.length === 1 && !apertouUno) {
        updates[`salas/${salaID}/jogadores/${meuNick}/esqueceuUno`] = true;
        setTimeout(() => {
            update(ref(db), {[`salas/${salaID}/jogadores/${meuNick}/esqueceuUno`]: false});
        }, 5000);
    }

    apertouUno = false;
    await update(ref(db), updates);
}

// BOTOES E ACOES RESTANTES
document.getElementById('btnUno').onclick = () => { apertouUno = true; alert("UNO!"); };

document.getElementById('btnDenunciar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    const vitima = Object.keys(d.jogadores).find(n => d.jogadores[n].esqueceuUno === true);
    if (vitima) {
        let mV = d.jogadores[vitima].mao || [];
        mV.push(gerarCarta()); mV.push(gerarCarta());
        await update(ref(db), { [`salas/${salaID}/jogadores/${vitima}/mao`]: mV, [`salas/${salaID}/jogadores/${vitima}/esqueceuUno`]: false });
    }
};

document.getElementById('btnComprar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    if (d.turno !== meuNick || d.comprouNaVez) return;
    let m = d.jogadores[meuNick].mao || [];
    const ups = {};
    if (d.acumulado > 0) {
        for(let i=0; i < d.acumulado; i++) m.push(gerarCarta());
        ups[`salas/${salaID}/acumulado`] = 0;
        ups[`salas/${salaID}/turno`] = Object.keys(d.jogadores)[calcProx(Object.keys(d.jogadores).indexOf(meuNick), Object.keys(d.jogadores).length, d.sentido || 1, 1)];
    } else {
        m.push(gerarCarta());
        ups[`salas/${salaID}/comprouNaVez`] = true;
    }
    ups[`salas/${salaID}/jogadores/${meuNick}/mao`] = m;
    await update(ref(db), ups);
};

document.getElementById('btnPassar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    const prox = Object.keys(d.jogadores)[calcProx(Object.keys(d.jogadores).indexOf(meuNick), Object.keys(d.jogadores).length, d.sentido || 1, 1)];
    await update(ref(db), { [`salas/${salaID}/turno`] : prox, [`salas/${salaID}/comprouNaVez`]: false });
};

document.getElementById('btnSair').onclick = () => window.location.href = "index.html";
