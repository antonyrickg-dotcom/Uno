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

// --- INJETAR CSS PARA CELULAR E LAYOUT ---
const style = document.createElement('style');
style.innerHTML = `
    body { margin: 0; overflow: hidden; background: #1a1a1a; font-family: sans-serif; }
    #container-jogo { display: flex; flex-direction: column; height: 100vh; width: 100vw; }
    
    #lista-jogadores { display: flex; justify-content: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.3); }
    .card-jogador { padding: 5px 10px; border-radius: 5px; background: #333; color: white; text-align: center; border: 2px solid transparent; transition: 0.3s; }
    .jogador-ativo { border-color: #4caf50; box-shadow: 0 0 10px #4caf50; transform: scale(1.1); }
    .tempo-texto { font-weight: bold; font-size: 12px; color: #ffeb3b; display: block; }
    .status-eliminado { text-decoration: line-through; color: #ff5555 !important; }

    #mesa { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; }
    #cartaMesa { transition: 0.3s; }

    #minhaMao { 
        display: flex; justify-content: center; align-items: flex-end; 
        padding: 10px; height: 160px; width: 100%; box-sizing: border-box;
        overflow-x: auto; overflow-y: hidden; white-space: nowrap;
    }
    .carta-container { transition: transform 0.2s; position: relative; }
    
    @media (max-width: 600px) {
        #minhaMao { height: 120px; padding: 5px; }
        .card-jogador { font-size: 10px; }
    }
`;
document.head.appendChild(style);

function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    return { cor: cores[Math.floor(Math.random() * cores.length)], valor: valores[Math.floor(Math.random() * valores.length)] };
}

function criarCartaReserva(carta, tamanho) {
    const nomesEspeciais = { 'skip': '🚫', 'reverse': '🔄', 'draw2': '+2' };
    const label = nomesEspeciais[carta.valor] || carta.valor;
    const corHex = { 'red': '#ff5555', 'blue': '#5555ff', 'green': '#55aa55', 'yellow': '#ffaa00' }[carta.cor];
    return `<div style="width: ${tamanho}px; height: ${tamanho * 1.5}px; background: ${corHex}; border: 3px solid white; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${tamanho/3}px;">${label}</div>`;
}

// --- LOGICA DO CRONÔMETRO ---
async function iniciarCronometro(turnoAtual, dados) {
    if (cronometroLocal) clearInterval(cronometroLocal);
    let tempoRestante = TEMPO_TURNO;
    
    cronometroLocal = setInterval(async () => {
        const elTempo = document.getElementById(`tempo-${turnoAtual}`);
        if (elTempo) elTempo.innerText = `${tempoRestante}s`;

        if (tempoRestante <= 0) {
            clearInterval(cronometroLocal);
            if (turnoAtual === meuNick) {
                passarVezAutomatico(dados);
            }
        }
        tempoRestante--;
    }, 1000);
}

async function passarVezAutomatico(dados) {
    const jogador = dados.jogadores[meuNick];
    const pulos = (jogador.pulos || 0) + 1;

    if (pulos >= 3) {
        alert("Você foi eliminado por inatividade!");
        // Marcar como eliminado (lógica simples: zerar a mão)
        await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { eliminado: true, mao: [] });
    } else {
        await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { pulos: pulos });
    }
    
    // Passa a vez
    const listaNomes = Object.keys(dados.jogadores).filter(n => !dados.jogadores[n].eliminado);
    let proximoTurno = listaNomes[(listaNomes.indexOf(meuNick) + 1) % listaNomes.length];
    await update(ref(db, `salas/${salaID}`), { turno: proximoTurno });
}

// --- ESCUTAR JOGO ---
onValue(ref(db, `salas/${salaID}`), (snapshot) => {
    const dados = snapshot.val();
    if (!dados) return;

    // 1. Jogadores e Tempo
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
            <div style="font-size: 8px">Faltas: ${jog.pulos || 0}/3</div>
        `;
        listaJogDiv.appendChild(div);
    });

    iniciarCronometro(dados.turno, dados);

    // 2. Carta da Mesa
    const cartaMesaDiv = document.getElementById('cartaMesa');
    if (dados.cartaNaMesa) {
        const c = dados.cartaNaMesa;
        cartaMesaDiv.innerHTML = `<img src="cartas/${c.valor}_${c.cor}.png" onerror="this.src='cartas/${c.cor}_${c.valor}.png'; this.onerror=function(){this.parentElement.innerHTML='${criarCartaReserva(c, 100)}'}" style="width: 100px;">`;
    }

    // 3. Minha Mão (Escalonamento Dinâmico)
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    const minhasCartas = dados.jogadores[meuNick].mao || [];
    
    // Calculo do tamanho: se tiver muita carta, elas diminuem
    let larguraCarta = 100;
    if (minhasCartas.length > 7) larguraCarta = Math.max(50, 800 / minhasCartas.length);
    let overlap = minhasCartas.length > 8 ? -larguraCarta * 0.3 : 5;

    minhasCartas.forEach((carta, index) => {
        const container = document.createElement('div');
        container.className = "carta-container";
        container.style.marginLeft = `${overlap}px`;

        const img = document.createElement('img');
        img.src = `cartas/${carta.valor}_${carta.cor}.png`;
        img.style.width = `${larguraCarta}px`;
        img.onerror = () => { img.parentElement.innerHTML = criarCartaReserva(carta, larguraCarta); };

        container.onmouseover = () => { container.style.transform = "translateY(-20px)"; container.style.zIndex = "100"; };
        container.onmouseout = () => { container.style.transform = "translateY(0)"; container.style.zIndex = "1"; };
        container.onclick = () => tentarJogarCarta(carta, index, dados);

        container.appendChild(img);
        minhaMaoDiv.appendChild(container);
    });
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
        // Se jogou, reseta os pulos de inatividade
        updates[`salas/${salaID}/jogadores/${meuNick}/pulos`] = 0;

        await update(ref(db), updates);
    }
}

// BOTÃO COMPRAR COM FOTO DE TRÁS (jota.png)
const btnComprar = document.getElementById('btnComprar');
btnComprar.innerHTML = `<img src="cartas/jota.png" style="width: 60px; display: block; margin: auto;"> Comprar`;
btnComprar.onclick = async () => {
    const snapshot = await get(ref(db, `salas/${salaID}`));
    const dados = snapshot.val();
    if (dados.turno !== meuNick || dados.jogadores[meuNick].eliminado) return;
    let maoAtual = dados.jogadores[meuNick].mao || [];
    maoAtual.push(gerarCarta());
    await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: maoAtual, pulos: 0 });
};
