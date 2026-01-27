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

if (!salaID || !meuNick) {
    window.location.href = "index.html";
}

let cronometroLocal = null;

function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return { 
        cor: cores[Math.floor(Math.random() * cores.length)], 
        valor: valores[Math.floor(Math.random() * valores.length)] 
    };
}

function criarCartaReserva(carta, largura) {
    const corHex = { 'red': '#ff4444', 'blue': '#4444ff', 'green': '#44aa44', 'yellow': '#ffaa00' }[carta.cor] || '#555';
    return `<div style="width:${largura}px; height:${largura*1.4}px; background:${corHex}; border:2px solid white; border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:12px;">${carta.valor}</div>`;
}

// Escuta a sala
onValue(ref(db, `salas/${salaID}`), (snapshot) => {
    const dados = snapshot.val();
    
    if (!dados) {
        document.getElementById('txtVez').innerText = "Erro: Sala não encontrada!";
        return;
    }

    // --- SEGURANÇA: Configura a mesa se estiver vazia ---
    if (!dados.cartaNaMesa || !dados.turno) {
        const primeiroJogador = Object.keys(dados.jogadores)[0];
        if (meuNick === primeiroJogador) {
            const updates = {};
            if (!dados.cartaNaMesa) updates.cartaNaMesa = gerarCarta();
            if (!dados.turno) updates.turno = primeiroJogador;
            update(ref(db, `salas/${salaID}`), updates);
        }
        document.getElementById('txtVez').innerText = "Iniciando partida...";
        return; // Sai e espera a próxima atualização do banco
    }

    // --- INTERFACE ---
    document.getElementById('txtSalaID').innerText = salaID;

    // Jogadores
    const listaJogDiv = document.getElementById('lista-jogadores');
    listaJogDiv.innerHTML = "";
    Object.keys(dados.jogadores).forEach(nick => {
        const jog = dados.jogadores[nick];
        const ativo = dados.turno === nick;
        listaJogDiv.innerHTML += `
            <div style="padding:5px 10px; background:${ativo ? '#4caf50' : '#333'}; border-radius:5px; margin:5px; font-size:12px; border:${ativo ? '2px solid white' : 'none'}">
                ${nick} (${jog.mao ? jog.mao.length : 0})
            </div>`;
    });

    // Mesa
    const cartaMesaDiv = document.getElementById('cartaMesa');
    const cM = dados.cartaNaMesa;
    cartaMesaDiv.innerHTML = `<img src="cartas/${cM.cor}_${cM.valor}.png" style="width:100px;" 
        onerror="this.src='cartas/${cM.valor}_${cM.cor}.png'; this.onerror=()=>this.parentElement.innerHTML='${criarCartaReserva(cM, 80)}'">`;

    // Minha Mão (Filtrado pelo meuNick)
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    const minhasCartas = (dados.jogadores[meuNick] && dados.jogadores[meuNick].mao) ? dados.jogadores[meuNick].mao : [];
    
    minhasCartas.forEach((c, i) => {
        const img = document.createElement('img');
        img.src = `cartas/${c.cor}_${c.valor}.png`;
        img.style.width = "75px";
        img.style.margin = "0 3px";
        img.style.cursor = "pointer";
        img.onclick = () => jogarCarta(c, i, dados);
        img.onerror = () => {
            const div = document.createElement('div');
            div.innerHTML = criarCartaReserva(c, 70);
            div.onclick = () => jogarCarta(c, i, dados);
            minhaMaoDiv.appendChild(div);
            img.remove();
        };
        minhaMaoDiv.appendChild(img);
    });

    const txtVez = document.getElementById('txtVez');
    txtVez.innerText = dados.turno === meuNick ? "⭐ SUA VEZ!" : `Vez de ${dados.turno}`;
    txtVez.style.color = dados.turno === meuNick ? "#4caf50" : "white";
});

async function jogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return;
    const mesa = dados.cartaNaMesa;
    if (carta.cor === mesa.cor || carta.valor === mesa.valor) {
        let novaMao = [...dados.jogadores[meuNick].mao];
        novaMao.splice(index, 1);
        const nicks = Object.keys(dados.jogadores);
        const prox = nicks[(nicks.indexOf(meuNick) + 1) % nicks.length];
        await update(ref(db, `salas/${salaID}`), {
            cartaNaMesa: carta,
            turno: prox,
            [`jogadores/${meuNick}/mao`]: novaMao
        });
    }
}

document.getElementById('btnComprar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    if (!d || d.turno !== meuNick) return;
    let m = d.jogadores[meuNick].mao || [];
    m.push(gerarCarta());
    await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: m });
};

document.getElementById('btnSair').onclick = () => { if(confirm("Sair?")) window.location.href = "index.html"; };
