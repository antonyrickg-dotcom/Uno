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

// --- FUNÇÕES DE JOGO ---

function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    if (Math.random() < 0.15) {
        const curingas = ['wild', 'wild_draw4'];
        return { cor: 'black', valor: curingas[Math.floor(Math.random() * curingas.length)] };
    }
    return { cor: cores[Math.floor(Math.random() * cores.length)], valor: valores[Math.floor(Math.random() * valores.length)] };
}

function getNomeImagem(c) {
    if (c.cor === 'black') return `cartas/${c.valor}.png`;
    if (c.originalCor === 'black') return `cartas/${c.valor}_${c.cor}.png`;
    const esp = ['skip', 'reverse', 'draw2'];
    return esp.includes(c.valor) ? `cartas/${c.valor}_${c.cor}.png` : `cartas/${c.cor}_${c.valor}.png`;
}

function calcProx(atual, total, sentido, pulos = 1) {
    return (((atual + (sentido * pulos)) % total) + total) % total;
}

// --- ESCUTAR FIREBASE ---

onValue(ref(db, `salas/${salaID}`), async (snapshot) => {
    const dados = snapshot.val();
    if (!dados || !dados.jogadores) return;

    // Atualizar Chat
    const chatDiv = document.getElementById('mensagensChat');
    if (dados.chat) {
        chatDiv.innerHTML = dados.chat.map(m => `<div class="msg-item"><b>${m.nick}:</b> ${m.msg}</div>`).join('');
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }

    if (dados.vencedor) {
        document.getElementById('telaVitoria').style.display = 'flex';
        document.getElementById('txtVencedor').innerText = dados.vencedor === meuNick ? "VOCÊ VENCEU!" : `${dados.vencedor} VENCEU!`;
        return;
    }

    const nicks = Object.keys(dados.jogadores);
    
    // Lista Jogadores
    const listaDiv = document.getElementById('listaJogadores');
    listaDiv.innerHTML = nicks.map(nick => {
        const qtd = dados.jogadores[nick].mao ? dados.jogadores[nick].mao.length : 0;
        const vez = dados.turno === nick ? 'vez-dele' : '';
        return `<div class="jogador-item ${vez}"><span>${nick === meuNick ? 'Você' : nick}</span><span class="badge-cartas">${qtd} 🗂️</span></div>`;
    }).join('');

    // Cartas Iniciais
    if (!dados.jogadores[meuNick].mao) {
        let novaMao = Array.from({length: 7}, gerarCarta);
        await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: novaMao });
        return;
    }

    // Iniciar Turno
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

    document.getElementById('txtVez').innerHTML = isMinhaVez ? `<b style="color:#4caf50">SUA VEZ!</b>` : `Vez de ${dados.turno}`;
    if (dados.cartaNaMesa) document.getElementById('cartaMesa').innerHTML = `<img src="${getNomeImagem(dados.cartaNaMesa)}">`;

    // Renderizar Mão
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

// --- LÓGICA DE JOGADAS ---

function preVerificarJogada(carta, index, dados) {
    if (dados.turno !== meuNick) return;
    
    // CORREÇÃO: Abre o modal para qualquer carta preta (wild ou wild_draw4)
    if (carta.cor === 'black' || carta.valor.includes('wild')) {
        cartaPendente = carta; 
        indicePendente = index;
        document.getElementById('modalCores').style.display = 'flex';
        return;
    }
    processarJogada(carta, index, dados);
}

window.escolherNovaCor = async (cor) => {
    document.getElementById('modalCores').style.display = 'none';
    const snap = await get(ref(db, `salas/${salaID}`));
    if (cartaPendente) {
        const cartaComCor = { ...cartaPendente, cor: cor, originalCor: 'black' };
        processarJogada(cartaComCor, indicePendente, snap.val());
        cartaPendente = null;
    }
};

async function processarJogada(carta, index, dados) {
    const acumulado = dados.acumulado || 0;

    // CORREÇÃO: Ignora validação de cor se a carta for Curinga
    if (carta.originalCor !== 'black' && carta.cor !== 'black') {
        if (acumulado > 0 && carta.valor !== 'draw2') return alert("Compre ou jogue +2!");
        if (carta.cor !== dados.cartaNaMesa.cor && carta.valor !== dados.cartaNaMesa.valor) return alert("Inválida!");
    }

    let novaMao = [...dados.jogadores[meuNick].mao];
    novaMao.splice(index, 1);
    
    if (novaMao.length === 0) return await update(ref(db, `salas/${salaID}`), { vencedor: meuNick });

    const nicks = Object.keys(dados.jogadores);
    let sentido = dados.sentido || 1;
    let novoAcumulado = (carta.valor === 'draw2') ? acumulado + 2 : (carta.valor === 'wild_draw4' ? acumulado + 4 : acumulado);
    
    let proximo;
    if (carta.valor === 'skip') proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 2);
    else if (carta.valor === 'reverse') {
        sentido *= -1;
        proximo = (nicks.length === 2) ? nicks.indexOf(meuNick) : calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1);
    } else proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1);

    await update(ref(db, `salas/${salaID}`), {
        [`jogadores/${meuNick}/mao`]: novaMao,
        cartaNaMesa: carta,
        turno: nicks[proximo],
        sentido: sentido,
        acumulado: novoAcumulado,
        comprouNaVez: false
    });
}

// --- CHAT E ARRASTE ---

const containerChat = document.getElementById('containerChat');
const headerChat = document.getElementById('headerChat');
const campoMsg = document.getElementById('campoMsg');
const btnAbrirChat = document.getElementById('btnAbrirChat');

// Corrigido: Toggle de abertura no mobile
btnAbrirChat.addEventListener('click', () => {
    containerChat.classList.toggle('aberto');
    if(containerChat.classList.contains('aberto')) containerChat.style.display = 'flex';
    else containerChat.style.display = 'none';
});

// Corrigido: Enviar mensagem no PC
campoMsg.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        const txt = campoMsg.value.trim();
        if (!txt) return;
        const chatRef = ref(db, `salas/${salaID}/chat`);
        const snap = await get(chatRef);
        let msgs = snap.val() || [];
        if (msgs.length > 25) msgs.shift();
        msgs.push({ nick: meuNick, msg: txt });
        await set(chatRef, msgs);
        campoMsg.value = "";
    }
});

let isDragging = false;
let startX, startY, initialX, initialY;

const startMove = (e) => {
    isDragging = true;
    const pos = e.type.includes('touch') ? e.touches[0] : e;
    startX = pos.clientX;
    startY = pos.clientY;
    initialX = containerChat.offsetLeft;
    initialY = containerChat.offsetTop;
    containerChat.style.transition = 'none';
};

const doMove = (e) => {
    if (!isDragging) return;
    const pos = e.type.includes('touch') ? e.touches[0] : e;
    const dx = pos.clientX - startX;
    const dy = pos.clientY - startY;
    containerChat.style.left = (initialX + dx) + 'px';
    containerChat.style.top = (initialY + dy) + 'px';
    containerChat.style.right = 'auto';
    containerChat.style.bottom = 'auto';
};

headerChat.addEventListener('mousedown', startMove);
headerChat.addEventListener('touchstart', startMove, {passive: true});
window.addEventListener('mousemove', doMove);
window.addEventListener('touchmove', doMove, {passive: false});
window.addEventListener('mouseup', () => isDragging = false);
window.addEventListener('touchend', () => isDragging = false);

// --- OUTROS BOTÕES ---

document.getElementById('btnComprar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    if (d.turno !== meuNick || d.comprouNaVez) return;
    let m = d.jogadores[meuNick].mao || [];
    if (d.acumulado > 0) {
        for(let i=0; i<d.acumulado; i++) m.push(gerarCarta());
        await update(ref(db, `salas/${salaID}`), { [`jogadores/${meuNick}/mao`]: m, acumulado: 0, turno: Object.keys(d.jogadores)[calcProx(Object.keys(d.jogadores).indexOf(meuNick), Object.keys(d.jogadores).length, d.sentido, 1)] });
    } else {
        m.push(gerarCarta());
        await update(ref(db, `salas/${salaID}`), { [`jogadores/${meuNick}/mao`]: m, comprouNaVez: true });
    }
};

document.getElementById('btnPassar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    await update(ref(db, `salas/${salaID}`), { turno: Object.keys(d.jogadores)[calcProx(Object.keys(d.jogadores).indexOf(meuNick), Object.keys(d.jogadores).length, d.sentido, 1)], comprouNaVez: false });
};

document.getElementById('btnSair').onclick = () => window.location.href = "index.html";
