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

// CONFIGURAÇÕES DO JOGO
const TEMPO_TURNO = 20;
let cronometroLocal = null;

// --- CSS DINÂMICO ---
const style = document.createElement('style');
style.innerHTML = `
    body { margin: 0; overflow: hidden; background: #1a1a1a; font-family: sans-serif; color: white; }
    #container-jogo { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
    
    #lista-jogadores { display: flex; justify-content: center; gap: 8px; padding: 10px; background: rgba(0,0,0,0.5); flex-wrap: wrap; }
    .card-jogador { padding: 5px 10px; border-radius: 6px; background: #333; min-width: 80px; text-align: center; border: 2px solid transparent; transition: 0.3s; font-size: 12px; }
    .jogador-ativo { border-color: #4caf50; box-shadow: 0 0 10px #4caf50; transform: scale(1.05); }
    .tempo-texto { font-weight: bold; color: #ffeb3b; display: block; font-size: 14px; margin-top: 2px; }
    .status-eliminado { text-decoration: line-through; opacity: 0.5; color: #ff5555 !important; }

    #mesa { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; gap: 15px; }
    #cartaMesa img { width: 100px; filter: drop-shadow(0 0 15px rgba(0,0,0,0.8)); transition: 0.3s; }

    #minhaMao { 
        display: flex; justify-content: center; align-items: flex-end; 
        padding: 20px 10px; min-height: 140px; width: 100%; box-sizing: border-box;
        overflow-x: auto; overflow-y: hidden; white-space: nowrap;
        background: rgba(0,0,0,0.2);
    }
    .carta-container { transition: transform 0.2s; cursor: pointer; display: inline-block; }
    
    #btnComprar { background: none; border: none; color: white; cursor: pointer; text-align: center; font-size: 12px; }
    #btnComprar img { border: 2px solid white; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.5); }

    @media (max-width: 600px) {
        #minhaMao { min-height: 110px; padding: 10px 5px; }
        #cartaMesa img { width: 85px; }
    }
`;
document.head.appendChild(style);

// --- LÓGICA DE CARTAS ---
function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    let valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const corSorteada = cores[Math.floor(Math.random() * cores.length)];
    
    // Conforme sua regra: especiais apenas em cartas vermelhas (red)
    if (corSorteada === 'red') {
        valores = [...valores, 'skip', 'reverse', 'draw2'];
    }

    return { cor: corSorteada, valor: valores[Math.floor(Math.random() * valores.length)] };
}

function criarCartaReserva(carta, largura) {
    const nomesEspeciais = { 'skip': '🚫', 'reverse': '🔄', 'draw2': '+2' };
    const label = nomesEspeciais[carta.valor] || carta.valor;
    const corHex = { 'red': '#ff4444', 'blue': '#4444ff', 'green': '#44aa44', 'yellow': '#ffaa00' }[carta.cor];
    return `<div style="width: ${largura}px; height: ${largura * 1.5}px; background: ${corHex}; border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${largura/2.5}px;">${label}</div>`;
}

// --- CRONÔMETRO E ELIMINAÇÃO ---
async function iniciarCronometro(turnoAtual, dados) {
    if (cronometroLocal) clearInterval(cronometroLocal);
    let tempoRestante = TEMPO_TURNO;
    
    cronometroLocal = setInterval(async () => {
        const elTempo = document.getElementById(`tempo-${turnoAtual}`);
        if (elTempo) elTempo.innerText = `${tempoRestante}s`;

        if (tempoRestante <= 0) {
            clearInterval(cronometroLocal);
            if (turnoAtual === meuNick) passarVezAutomatico(dados);
        }
        tempoRestante--;
    }, 1000);
}

async function passarVezAutomatico(dados) {
    const jogador = dados.jogadores[meuNick];
    const pulos = (jogador.pulos || 0) + 1;
    const updates = {};

    if (pulos >= 3) {
        alert("Eliminado por inatividade!");
        updates[`salas/${salaID}/jogadores/${meuNick}/eliminado`] = true;
        updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = [];
    } else {
        updates[`salas/${salaID}/jogadores/${meuNick}/pulos`] = pulos;
    }
    
    const listaVivos = Object.keys(dados.jogadores).filter(n => !dados.jogadores[n].eliminado);
    let proximoTurno = listaVivos[(listaVivos.indexOf(meuNick) + 1) % listaVivos.length];
    
    updates[`salas/${salaID}/turno`] = proximoTurno;
    await update(ref(db), updates);
}

// --- ATUALIZAÇÃO EM TEMPO REAL ---
onValue(ref(db, `salas/${salaID}`), (snapshot) => {
    const dados = snapshot.val();
    if (!dados) return;

    // 1. Jogadores
    const listaJogDiv = document.getElementById('lista-jogadores');
    listaJogDiv.innerHTML = "";
    Object.keys(dados.jogadores).forEach(nick => {
        const jog = dados.jogadores[nick];
        const ativo = dados.turno === nick;
        const div = document.createElement('div');
        div.className = `card-jogador ${ativo ? 'jogador-ativo' : ''}`;
        div.innerHTML = `
            <span class="${jog.eliminado ? 'status-eliminado' : ''}">${nick} (${jog.mao ? jog.mao.length : 0})</span>
            <span class="tempo-texto" id="tempo-${nick}">${ativo ? '20s' : ''}</span>
            <div style="font-size: 9px; opacity: 0.7">Faltas: ${jog.pulos || 0}/3</div>
        `;
        listaJogDiv.appendChild(div);
    });

    iniciarCronometro(dados.turno, dados);

    // 2. Mesa
    const cartaMesaDiv = document.getElementById('cartaMesa');
    if (dados.cartaNaMesa) {
        const c = dados.cartaNaMesa;
        cartaMesaDiv.innerHTML = `<img src="cartas/${c.valor}_${c.cor}.png" 
            onerror="this.src='cartas/${c.cor}_${c.valor}.png'; this.onerror=function(){this.parentElement.innerHTML='${criarCartaReserva(c, 90)}'}">`;
    }

    // 3. Minha Mão (Escalonamento Dinâmico)
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    const minhasCartas = dados.jogadores[meuNick].mao || [];
    
    let larguraCarta = 90;
    const larguraDisponivel = window.innerWidth - 40;
    if ((minhasCartas.length * larguraCarta) > larguraDisponivel) {
        larguraCarta = Math.max(40, larguraDisponivel / minhasCartas.length);
    }
    
    const overlap = minhasCartas.length > 7 ? -(larguraCarta * 0.25) : 5;

    minhasCartas.forEach((carta, index) => {
        const container = document.createElement('div');
        container.className = "carta-container";
        container.style.marginLeft = index === 0 ? "0" : `${overlap}px`;

        const img = document.createElement('img');
        img.src = `cartas/${carta.valor}_${carta.cor}.png`;
        img.style.width = `${larguraCarta}px`;
        img.onerror = () => { img.src = `cartas/${carta.cor}_${carta.valor}.png`; img.onerror = () => { container.innerHTML = criarCartaReserva(carta, larguraCarta); }};

        container.onclick = () => tentarJogarCarta(carta, index, dados);
        container.onmouseenter = () => { container.style.transform = "translateY(-25px)"; container.style.zIndex = "100"; };
        container.onmouseleave = () => { container.style.transform = "translateY(0)"; container.style.zIndex = "1"; };

        container.appendChild(img);
        minhaMaoDiv.appendChild(container);
    });

    const txtVez = document.getElementById('txtVez');
    if (txtVez) txtVez.innerText = dados.turno === meuNick ? "SUA VEZ!" : `Vez de ${dados.turno}`;
});

async function tentarJogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick || dados.jogadores[meuNick].eliminado) return;
    const naMesa = dados.cartaNaMesa;

    if (carta.cor === naMesa.cor || carta.valor === naMesa.valor) {
        let novaMao = [...dados.jogadores[meuNick].mao];
        novaMao.splice(index, 1);

        const listaVivos = Object.keys(dados.jogadores).filter(n => !dados.jogadores[n].eliminado);
        let proximoTurno = listaVivos[(listaVivos.indexOf(meuNick) + 1) % listaVivos.length];

        const updates = {};
        updates[`salas/${salaID}/cartaNaMesa`] = carta;
        updates[`salas/${salaID}/turno`] = proximoTurno;
        updates[`salas/${salaID}/jogadores/${meuNick}/mao`] = novaMao;
        updates[`salas/${salaID}/jogadores/${meuNick}/pulos`] = 0;

        await update(ref(db), updates);
    }
}

// BOTÃO COMPRAR (jota.png)
const btnComprar = document.getElementById('btnComprar');
if (btnComprar) {
    btnComprar.innerHTML = `<img src="cartas/jota.png" style="width: 75px; display: block; margin: 0 auto 5px;"><b style="color:#ffeb3b">COMPRAR</b>`;
    btnComprar.onclick = async () => {
        const snap = await get(ref(db, `salas/${salaID}`));
        const dados = snap.val();
        if (dados.turno !== meuNick || dados.jogadores[meuNick].eliminado) return;
        
        let maoAtual = dados.jogadores[meuNick].mao || [];
        maoAtual.push(gerarCarta());
        await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: maoAtual, pulos: 0 });
    };
}

document.getElementById('btnSair').onclick = () => { if(confirm("Sair da partida?")) window.location.href = "index.html"; };
