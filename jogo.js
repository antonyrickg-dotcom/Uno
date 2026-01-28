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

function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    return { cor: cores[Math.floor(Math.random() * cores.length)], valor: valores[Math.floor(Math.random() * valores.length)] };
}

function getNomeImagem(c) {
    const esp = ['skip', 'reverse', 'draw2'];
    return esp.includes(c.valor) ? `cartas/${c.valor}_${c.cor}.png` : `cartas/${c.cor}_${c.valor}.png`;
}

function calcProx(atual, total, sentido, pulos = 1) {
    return (((atual + (sentido * pulos)) % total) + total) % total;
}

// LOOP PRINCIPAL
onValue(ref(db, `salas/${salaID}`), async (snapshot) => {
    const dados = snapshot.val();
    
    // CORREÇÃO DO UNDEFINED: Se os dados não existirem ou o turno não for definido, para aqui.
    if (!dados || !dados.jogadores) return;

    const nicks = Object.keys(dados.jogadores);
    
    // Configuração inicial da partida
    if (!dados.turno && meuNick === nicks[0]) {
        await update(ref(db, `salas/${salaID}`), {
            turno: nicks[0],
            cartaNaMesa: gerarCarta(),
            sentido: 1,
            acumulado: 0
        });
        return;
    }

    // Se o turno ainda não veio do banco, não faz nada para evitar o "undefined"
    if (!dados.turno) return;

    const isMinhaVez = dados.turno === meuNick;
    const mao = dados.jogadores[meuNick].mao || [];
    const acumulado = dados.acumulado || 0;

    // Interface dos botões extras
    document.getElementById('btnUno').style.display = (isMinhaVez && mao.length === 2) ? 'block' : 'none';
    document.getElementById('btnPassar').style.display = (isMinhaVez && dados.comprouNaVez && acumulado === 0) ? 'block' : 'none';
    
    const vitima = nicks.find(n => dados.jogadores[n].esqueceuUno === true);
    document.getElementById('btnDenunciar').style.display = (vitima && vitima !== meuNick) ? 'block' : 'none';

    // Status do Turno
    const seta = (dados.sentido || 1) === 1 ? "➡" : "⬅";
    let statusHTML = isMinhaVez ? `<b style="color:#4caf50">SUA VEZ! ${seta}</b>` : `Vez de ${dados.turno} ${seta}`;
    if (acumulado > 0) statusHTML += `<br><span style="color:#ff4444">+${acumulado} CARTAS!</span>`;
    document.getElementById('txtVez').innerHTML = statusHTML;

    // Carta na Mesa
    if (dados.cartaNaMesa) {
        document.getElementById('cartaMesa').innerHTML = `<img src="${getNomeImagem(dados.cartaNaMesa)}">`;
    }

    // Minha Mão
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

async function jogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return;
    const acumulado = dados.acumulado || 0;

    if (acumulado > 0 && carta.valor !== 'draw2') return alert(`Compre as +${acumulado} cartas ou jogue outro +2!`);
    if (acumulado === 0 && carta.cor !== dados.cartaNaMesa.cor && carta.valor !== dados.cartaNaMesa.valor) return alert("Carta inválida!");

    let novaMao = [...dados.jogadores[meuNick].mao];
    novaMao.splice(index, 1);
    
    const nicks = Object.keys(dados.jogadores);
    let sentido = dados.sentido || 1;
    let novoAcumulado = acumulado;
    let proximo;

    if (carta.valor === 'draw2') {
        novoAcumulado += 2;
        proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1);
    } else if (carta.valor === 'reverse') {
        sentido *= -1;
        proximo = (nicks.length === 2) ? nicks.indexOf(meuNick) : calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1);
    } else if (carta.valor === 'skip') {
        proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 2);
    } else {
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
        setTimeout(() => update(ref(db), {[`salas/${salaID}/jogadores/${meuNick}/esqueceuUno`]: false}), 4000);
    }
    apertouUno = false;

    await update(ref(db), updates);
}

document.getElementById('btnUno').onclick = () => { apertouUno = true; alert("Você gritou UNO!"); };

document.getElementById('btnComprar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    if (d.turno !== meuNick || d.comprouNaVez) return;

    const acumulado = d.acumulado || 0;
    let m = d.jogadores[meuNick].mao || [];
    const ups = {};

    if (acumulado > 0) {
        for(let i=0; i<acumulado; i++) m.push(gerarCarta());
        ups[`salas/${salaID}/acumulado`] = 0;
        const nicks = Object.keys(d.jogadores);
        ups[`salas/${salaID}/turno`] = nicks[calcProx(nicks.indexOf(meuNick), nicks.length, d.sentido || 1, 1)];
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
    const nicks = Object.keys(d.jogadores);
    const prox = nicks[calcProx(nicks.indexOf(meuNick), nicks.length, d.sentido || 1, 1)];
    await update(ref(db), { [`salas/${salaID}/turno`]: prox, [`salas/${salaID}/comprouNaVez`]: false });
};

document.getElementById('btnDenunciar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    const vitima = Object.keys(d.jogadores).find(n => d.jogadores[n].esqueceuUno === true);
    if (vitima) {
        let m = d.jogadores[vitima].mao || [];
        m.push(gerarCarta(), gerarCarta());
        await update(ref(db), { [`salas/${salaID}/jogadores/${vitima}/mao`]: m, [`salas/${salaID}/jogadores/${vitima}/esqueceuUno`]: false });
        alert(`DESAFIO! ${vitima} não disse UNO e comprou +2.`);
    }
};

document.getElementById('btnSair').onclick = () => { if(confirm("Sair?")) window.location.href = "index.html"; };
