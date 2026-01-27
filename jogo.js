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

// --- FUNÇÃO PARA GERAR UMA CARTA ---
function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    let valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const cor = cores[Math.floor(Math.random() * cores.length)];
    if (cor === 'red') valores = [...valores, 'skip', 'reverse', 'draw2'];
    return { cor, valor: valores[Math.floor(Math.random() * valores.length)] };
}

// --- DESENHAR CARTA CASO A IMAGEM FALHE ---
function criarCartaReserva(carta, largura) {
    const corHex = { 'red': '#ff4444', 'blue': '#4444ff', 'green': '#44aa44', 'yellow': '#ffaa00' }[carta.cor];
    return `<div style="width: ${largura}px; height: ${largura * 1.4}px; background: ${corHex}; border: 2px solid white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${carta.valor}</div>`;
}

// --- CRONÔMETRO ---
function iniciarCronometro(turnoAtual, dados) {
    if (cronometroLocal) clearInterval(cronometroLocal);
    let tempo = TEMPO_TURNO;
    cronometroLocal = setInterval(() => {
        const el = document.getElementById(`tempo-${turnoAtual}`);
        if (el) el.innerText = `${tempo}s`;
        if (tempo <= 0) {
            clearInterval(cronometroLocal);
            if (turnoAtual === meuNick) passarVez(dados);
        }
        tempo--;
    }, 1000);
}

async function passarVez(dados) {
    const vivos = Object.keys(dados.jogadores).filter(n => !dados.jogadores[n].eliminado);
    const proximo = vivos[(vivos.indexOf(meuNick) + 1) % vivos.length];
    await update(ref(db, `salas/${salaID}`), { turno: proximo });
}

// --- ATUALIZAÇÃO DO JOGO ---
onValue(ref(db, `salas/${salaID}`), (snapshot) => {
    const dados = snapshot.val();
    if (!dados) return;

    document.getElementById('txtSalaID').innerText = salaID;

    // 1. Lista de Jogadores (Topo)
    const listaJogDiv = document.getElementById('lista-jogadores');
    listaJogDiv.innerHTML = "";
    Object.keys(dados.jogadores).forEach(nick => {
        const jog = dados.jogadores[nick];
        const ativo = dados.turno === nick;
        const div = document.createElement('div');
        div.style.cssText = `padding: 5px 10px; background: ${ativo ? '#4caf50' : '#333'}; border-radius: 5px; font-size: 12px; text-align: center;`;
        div.innerHTML = `${nick}<br><span id="tempo-${nick}" style="font-weight:bold; color:#ffeb3b"></span>`;
        listaJogDiv.appendChild(div);
    });

    iniciarCronometro(dados.turno, dados);

    // 2. Carta da Mesa (Centro) - Tentando os dois formatos de nome
    const cartaMesaDiv = document.getElementById('cartaMesa');
    if (dados.cartaNaMesa) {
        const c = dados.cartaNaMesa;
        cartaMesaDiv.innerHTML = `<img src="cartas/${c.cor}_${c.valor}.png" style="width: 100px;" 
            onerror="this.src='cartas/${c.valor}_${c.cor}.png'; this.onerror=()=>this.parentElement.innerHTML='${criarCartaReserva(c, 80)}'">`;
    }

    // 3. Botão Comprar (jota.png)
    const btnComp = document.getElementById('btnComprar');
    btnComp.innerHTML = `<img src="cartas/jota.png" style="width: 80px; border-radius: 8px; border: 2px solid white;"><br>COMPRAR`;

    // 4. Minha Mão (Rodapé)
    const minhaMaoDiv = document.getElementById('minhaMao');
    minhaMaoDiv.innerHTML = "";
    const cartas = dados.jogadores[meuNick].mao || [];
    
    // Ajuste dinâmico de largura para caber no celular
    let largura = 80;
    if (cartas.length > 6) largura = Math.max(40, (window.innerWidth - 60) / cartas.length);

    cartas.forEach((c, i) => {
        const img = document.createElement('img');
        img.src = `cartas/${c.cor}_${c.valor}.png`;
        img.style.width = `${largura}px`;
        img.style.marginLeft = i === 0 ? "0" : `-${largura/3}px`;
        img.style.cursor = "pointer";
        img.style.transition = "0.2s";
        
        img.onerror = () => { 
            const fallback = document.createElement('div');
            fallback.innerHTML = criarCartaReserva(c, largura);
            fallback.onclick = () => jogarCarta(c, i, dados);
            minhaMaoDiv.appendChild(fallback);
            img.remove();
        };

        img.onclick = () => jogarCarta(c, i, dados);
        img.onmouseenter = () => img.style.transform = "translateY(-20px)";
        img.onmouseleave = () => img.style.transform = "translateY(0)";
        
        minhaMaoDiv.appendChild(img);
    });

    document.getElementById('txtVez').innerText = dados.turno === meuNick ? "SUA VEZ!" : `Vez de ${dados.turno}`;
});

async function jogarCarta(carta, index, dados) {
    if (dados.turno !== meuNick) return;
    const mesa = dados.cartaNaMesa;
    
    if (carta.cor === mesa.cor || carta.valor === mesa.valor) {
        let novaMao = [...dados.jogadores[meuNick].mao];
        novaMao.splice(index, 1);
        
        const vivos = Object.keys(dados.jogadores).filter(n => !dados.jogadores[n].eliminado);
        const proximo = vivos[(vivos.indexOf(meuNick) + 1) % vivos.length];

        await update(ref(db, `salas/${salaID}`), {
            cartaNaMesa: carta,
            turno: proximo,
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
