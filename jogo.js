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

const TEMPO_TURNO = 20;
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
    return `<div style="width:${largura}px; height:${largura*1.4}px; background:${corHex}; border:2px solid white; border-radius:8px; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:12px; text-transform:uppercase;">${carta.valor}</div>`;
}

function iniciarCronometro(turnoAtual, dados) {
    if (cronometroLocal) clearInterval(cronometroLocal);
    if (!turnoAtual) return;
    let tempo = TEMPO_TURNO;
    cronometroLocal = setInterval(() => {
        const el = document.getElementById(`tempo-${turnoAtual}`);
        if (el) el.innerText = `${tempo}s`;
        if (tempo <= 0) {
            clearInterval(cronometroLocal);
            if (turnoAtual === meuNick) passarVezAutomatico(dados);
        }
        tempo--;
    }, 1000);
}

async function passarVezAutomatico(dados) {
    const nicks = Object.keys(dados.jogadores).filter(n => !dados.jogadores[n].eliminado);
    const prox = nicks[(nicks.indexOf(meuNick) + 1) % nicks.length];
    await update(ref(db, `salas/${salaID}`), { turno: prox });
}

onValue(ref(db, `salas/${salaID}`), async (snapshot) => {
    const dados = snapshot.val();
    if (!dados) return;

    // --- 1. INICIALIZAÇÃO DA MESA (Se estiver vazia) ---
    if (!dados.cartaNaMesa) {
        const donoDaSala = Object.keys(dados.jogadores)[0];
        if (meuNick === donoDaSala) {
            await update(ref(db, `salas/${salaID}`), { cartaNaMesa: gerarCarta() });
        }
        return;
    }

    // --- 2. INICIALIZAÇÃO DO TURNO ---
    if (!dados.turno) {
        const primeiro = Object.keys(dados.jogadores)[0];
        await update(ref(db, `salas/${salaID}`), { turno: primeiro });
        return;
    }

    document.getElementById('txtSalaID').innerText = salaID;

    // --- 3. LISTA DE JOGADORES ---
    const listaJogDiv = document.getElementById('lista-jogadores');
    listaJogDiv.innerHTML = "";
    Object.keys(dados.jogadores).forEach(nick => {
        const jog = dados.jogadores[nick];
        const ativo = dados.turno === nick;
        const div = document.createElement('div');
        div.style.cssText = `padding:5px 10px; background:${ativo ? '#4caf50' : '#333'}; border-radius:5px; text-align:center; min-width:70px; border: 2px solid ${ativo ? 'white' : 'transparent'}`;
        div.innerHTML = `${nick} (${jog.mao ? jog.mao.length : 0})<br><span id="tempo-${nick}" style="font-weight:bold; color:#ffeb3b">${ativo ? '20s' : ''}</span>`;
        listaJogDiv.appendChild(div);
    });

    iniciarCronometro(dados.turno, dados);

    // --- 4. CARTA DA MESA ---
    const cartaMesaDiv = document.getElementById('cartaMesa');
    const cM = dados.cartaNaMesa;
    cartaMesaDiv.innerHTML = `<img src="cartas/${cM.cor}_${cM.valor}.png" style="width:100px;" 
        onerror="this.src='cartas/${cM.valor}_${cM.cor}.png'; this.onerror=()=>this.parentElement.innerHTML='${criarCartaReserva(cM, 80)}'">`;

    // --- 5. MINHA MÃO (PRIVADO) ---
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    
    // Pegamos apenas a mão do usuário logado neste navegador
    const minhasCartas = dados.jogadores[meuNick].mao || [];
    
    minhasCartas.forEach((c, i) => {
        const img = document.createElement('img');
        img.src = `cartas/${c.cor}_${c.valor}.png`;
        img.style.width = "75px";
        img.style.margin = "0 2px";
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
    if (txtVez) {
        txtVez.innerText = dados.turno === meuNick ? "⭐ SUA VEZ!" : `Vez de ${dados.turno}`;
        txtVez.style.color = dados.turno === meuNick ? "#4caf50" : "white";
    }
});

async function jogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return;
    const mesa = dados.cartaNaMesa;
    
    if (carta.cor === mesa.cor || carta.valor === mesa.valor) {
        let novaMao = [...dados.jogadores[meuNick].mao];
        novaMao.splice(index, 1);
        
        const nicks = Object.keys(dados.jogadores).filter(n => !dados.jogadores[n].eliminado);
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
    if (d.turno !== meuNick) return;
    let m = d.jogadores[meuNick].mao || [];
    m.push(gerarCarta());
    await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: m });
};

document.getElementById('btnSair').onclick = () => { if(confirm("Sair?")) window.location.href = "index.html"; };
