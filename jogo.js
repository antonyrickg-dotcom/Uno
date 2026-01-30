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

let cartaPendente = null;
let indicePendente = null;
// Variável para evitar múltiplos disparos do timer automático
let processandoAutoCompra = false; 

if (!salaID || !meuNick) window.location.href = "index.html";
document.getElementById('txtSalaID').innerText = salaID;

// --- FUNÇÕES AUXILIARES ---

function gerarCarta() {
    const cores = ['red', 'blue', 'green', 'yellow'];
    const valores = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
    // 15% de chance de vir Curinga
    if (Math.random() < 0.15) {
        const curingas = ['wild', 'wild_draw4'];
        return { cor: 'black', valor: curingas[Math.floor(Math.random() * curingas.length)] };
    }
    return { cor: cores[Math.floor(Math.random() * cores.length)], valor: valores[Math.floor(Math.random() * valores.length)] };
}

function getNomeImagem(c) {
    if (!c) return '';
    if (c.cor === 'black') return `cartas/${c.valor}.png`;
    if (c.originalCor === 'black') return `cartas/${c.valor}_${c.cor}.png`;
    
    const esp = ['skip', 'reverse', 'draw2'];
    return esp.includes(c.valor) ? `cartas/${c.valor}_${c.cor}.png` : `cartas/${c.cor}_${c.valor}.png`;
}

function calcProx(atual, total, sentido, pulos = 1) {
    return (((atual + (sentido * pulos)) % total) + total) % total;
}

// --- ESCUTA FIREBASE (Atualização da Tela) ---

onValue(ref(db, `salas/${salaID}`), async (snapshot) => {
    const dados = snapshot.val();
    if (!dados || !dados.jogadores) return;

    // Chat
    const chatDiv = document.getElementById('mensagensChat');
    if (dados.chat && chatDiv) {
        chatDiv.innerHTML = dados.chat.map(m => `<div class="msg-item"><b>${m.nick}:</b> ${m.msg}</div>`).join('');
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }

    // Vitoria
    if (dados.vencedor) {
        document.getElementById('telaVitoria').style.display = 'flex';
        document.getElementById('txtVencedor').innerText = dados.vencedor === meuNick ? "VOCÊ VENCEU!" : `${dados.vencedor} VENCEU!`;
        return;
    }

    const nicks = Object.keys(dados.jogadores);
    
    // Lista Lateral
    const listaDiv = document.getElementById('listaJogadores');
    if(listaDiv) {
        listaDiv.innerHTML = nicks.map(nick => {
            const qtd = dados.jogadores[nick].mao ? dados.jogadores[nick].mao.length : 0;
            const vez = dados.turno === nick ? 'vez-dele' : '';
            return `<div class="jogador-item ${vez}"><span>${nick === meuNick ? 'Você' : nick}</span><span class="badge-cartas">${qtd} 🗂️</span></div>`;
        }).join('');
    }

    // Inicializar Mão se vazia
    if (!dados.jogadores[meuNick].mao) {
        await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: Array.from({length: 7}, gerarCarta) });
        return;
    }

    // Inicializar Mesa se nova sala
    if (!dados.turno && meuNick === nicks[0]) {
        await update(ref(db, `salas/${salaID}`), { turno: nicks[0], cartaNaMesa: gerarCarta(), sentido: 1, acumulado: 0 });
        return;
    }

    // Controles de Vez
    const isMinhaVez = dados.turno === meuNick;
    const mao = dados.jogadores[meuNick].mao || [];
    
    document.getElementById('btnUno').style.display = (isMinhaVez && mao.length === 2) ? 'block' : 'none';
    document.getElementById('btnPassar').style.display = (isMinhaVez && dados.comprouNaVez && (dados.acumulado || 0) === 0) ? 'block' : 'none';
    
    // --- LÓGICA DO MODAL DE DESAFIO +4 & REGRA "SEM DESAFIAR" ---
    const modalDesafio = document.getElementById('modalDesafio');
    
    // Verifica se a regra está ativa
    const regrasAtivas = dados.regras ? Object.values(dados.regras) : [];
    const regraSemDesafio = regrasAtivas.includes('Sem Desafiar');

    if (dados.statusMais4 === "pendente" && isMinhaVez) {
        if (regraSemDesafio) {
            // Se a regra estiver ON: Não mostra modal e aceita automático
            if(modalDesafio) modalDesafio.style.display = 'none';
            
            if (!processandoAutoCompra) {
                processandoAutoCompra = true;
                // Toast ou log para avisar o jogador
                console.log("Regra Sem Desafio ativa: Comprando +4 automaticamente...");
                
                setTimeout(() => {
                    window.responderDesafio(false); // False = Aceitar o +4
                    processandoAutoCompra = false;
                }, 1500);
            }
        } else {
            // Regra OFF: Mostra o modal para desafiar
            if(modalDesafio) modalDesafio.style.display = 'flex';
        }
    } else {
        if (modalDesafio) modalDesafio.style.display = 'none';
    }

    // Botão Denunciar
    const btnDenunciar = document.getElementById('btnDenunciar');
    if(btnDenunciar) {
        const vitima = nicks.find(n => dados.jogadores[n].esqueceuUno === true);
        btnDenunciar.style.display = (vitima && vitima !== meuNick) ? 'block' : 'none';
    }

    // --- ATUALIZAÇÃO DA JANELA DE REGRAS (NOVO) ---
    const containerRegras = document.getElementById('conteudoRegras');
    if (containerRegras) {
        const explicacoes = {
            'Sem Desafiar': 'O +4 torna-se uma carta absoluta. Quem o recebe é obrigado a comprar as 4 cartas imediatamente, sem direito a desafiar (bluff).',
            'Acumular +2': 'Se jogarem um +2 em você, pode jogar outro +2 para passar a vez e somar a compra para o próximo.',
            '7 Roda a Mão': 'Ao jogar um 7, todos devem passar suas cartas para o jogador ao lado.',
            '0 Troca Tudo': 'Ao jogar um 0, você pode escolher alguém para trocar de mão com você.'
        };

        if (regrasAtivas.length === 0) {
            containerRegras.innerHTML = "<p style='color:#aaa; text-align:center;'>Nenhuma regra especial ativa.<br>Jogue o padrão!</p>";
        } else {
            containerRegras.innerHTML = regrasAtivas.map(regra => {
                const desc = explicacoes[regra] || "Sem descrição disponível.";
                return `
                    <div class="item-regra">
                        <span>⚠️ ${regra.toUpperCase()}</span>
                        <div class="info-wrapper">
                            <div class="info-icon">i</div>
                            <span class="tooltip-text">${desc}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Atualiza interface da mesa
    document.getElementById('txtVez').innerHTML = isMinhaVez ? `<b style="color:#4caf50">SUA VEZ!</b>` : `Vez de ${dados.turno}`;
    if (dados.cartaNaMesa) document.getElementById('cartaMesa').innerHTML = `<img src="${getNomeImagem(dados.cartaNaMesa)}">`;

    // Renderizar Minha Mão
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

// --- LÓGICA DO JOGO ---

function preVerificarJogada(carta, index, dados) {
    if (dados.turno !== meuNick) return;

    // SE FOR CURINGA (PRETA), ABRE O MODAL
    if (carta.cor === 'black' || (carta.valor && carta.valor.includes('wild'))) {
        cartaPendente = carta; 
        indicePendente = index;
        const modal = document.getElementById('modalCores');
        
        if (modal) {
            modal.style.display = 'flex';
        } else {
            alert("ERRO: O Modal de Cores não foi encontrado no HTML.");
        }
        return; // PAUSA AQUI e espera o jogador clicar na cor
    }
    
    // Se não for curinga, segue o jogo normal
    processarJogada(carta, index, dados);
}

// Essa função precisa estar no window para o HTML "enxergar"
window.escolherNovaCor = async (cor) => {
    document.getElementById('modalCores').style.display = 'none';
    
    // Pega os dados mais recentes para evitar conflito
    const snap = await get(ref(db, `salas/${salaID}`));
    const dadosAtuais = snap.val();

    if (cartaPendente) {
        // Cria uma cópia da carta transformando ela na cor escolhida
        const cartaComCor = { 
            ...cartaPendente, 
            cor: cor, 
            originalCor: 'black' // Marca que ela era preta originalmente
        };
        processarJogada(cartaComCor, indicePendente, dadosAtuais);
        cartaPendente = null;
        indicePendente = null;
    }
};

// --- FUNÇÃO DE RESPONDER DESAFIO +4 ---
window.responderDesafio = async (desafiou) => {
    const modal = document.getElementById('modalDesafio');
    if(modal) modal.style.display = 'none';

    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    
    if(!d.statusMais4 || d.statusMais4 === "resolvido") return; // Evita duplo clique

    const atacante = d.quemJogouMais4;
    const corAnterior = d.corAntesDoMais4;
    let minhaMao = [...d.jogadores[meuNick].mao];

    if (desafiou) {
        const maoAtacante = d.jogadores[atacante].mao;
        // Verifica se o atacante tinha a cor que estava na mesa antes do +4
        const mentiu = maoAtacante.some(c => c.cor === corAnterior || c.originalCor === corAnterior);

        if (mentiu) {
            alert(`O DESAFIO VENCEU! ${atacante} tinha a cor e vai comprar 4.`);
            let novaMaoAtacante = [...maoAtacante];
            for(let i=0; i<4; i++) novaMaoAtacante.push(gerarCarta());
            await update(ref(db, `salas/${salaID}/jogadores/${atacante}`), { mao: novaMaoAtacante });
        } else {
            alert("O DESAFIO FALHOU! Você compra 6 cartas (4 do efeito + 2 de penalidade).");
            for(let i=0; i<6; i++) minhaMao.push(gerarCarta());
            await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: minhaMao });
        }
    } else {
        // Apenas aceitou o +4 (Ou foi forçado pela regra)
        for(let i=0; i<4; i++) minhaMao.push(gerarCarta());
        await update(ref(db, `salas/${salaID}/jogadores/${meuNick}`), { mao: minhaMao });
    }

    const nicks = Object.keys(d.jogadores);
    const prox = calcProx(nicks.indexOf(meuNick), nicks.length, d.sentido, 1);
    
    await update(ref(db, `salas/${salaID}`), { 
        turno: nicks[prox], 
        acumulado: 0, 
        statusMais4: "resolvido",
        comprouNaVez: false // Garante que o próximo jogue limpo
    });
};

async function processarJogada(carta, index, dados) {
    const acumulado = dados.acumulado || 0;
    const mesa = dados.cartaNaMesa;

    // Validação básica (Cor ou Valor igual), exceto se for Curinga (que já passou pelo modal)
    if (carta.originalCor !== 'black' && carta.cor !== 'black') {
        if (acumulado > 0 && carta.valor !== 'draw2') return alert("Você precisa comprar ou jogar um +2!");
        if (mesa && (carta.cor !== mesa.cor && carta.valor !== mesa.valor)) return alert("Essa carta não combina!");
    }

    // Remove a carta da mão
    let novaMao = [...dados.jogadores[meuNick].mao];
    novaMao.splice(index, 1);
    
    // Verifica Vitória
    if (novaMao.length === 0) return await update(ref(db, `salas/${salaID}`), { vencedor: meuNick });

    // Calcula próximo jogador e efeitos
    const nicks = Object.keys(dados.jogadores);
    let sentido = dados.sentido || 1;
    let novoAcumulado = acumulado;

    // --- LÓGICA ESPECIAL +4 ---
    if (carta.valor === 'wild_draw4') {
        await update(ref(db, `salas/${salaID}`), {
            [`jogadores/${meuNick}/mao`]: novaMao,
            cartaNaMesa: carta,
            turno: nicks[calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1)],
            statusMais4: "pendente",
            quemJogouMais4: meuNick,
            corAntesDoMais4: mesa.cor
        });
        return;
    }

    // Aplica penalidades normais
    if (carta.valor === 'draw2') novoAcumulado += 2;

    // Calcula Turno
    let proximo;
    if (carta.valor === 'skip') {
        proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 2);
    } else if (carta.valor === 'reverse') {
        sentido *= -1;
        // Se só tem 2 jogadores, Inverter age como Pular
        proximo = (nicks.length === 2) ? nicks.indexOf(meuNick) : calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1);
    } else {
        proximo = calcProx(nicks.indexOf(meuNick), nicks.length, sentido, 1);
    }

    // Envia tudo pro Firebase
    await update(ref(db, `salas/${salaID}`), {
        [`jogadores/${meuNick}/mao`]: novaMao,
        cartaNaMesa: carta,
        turno: nicks[proximo],
        sentido: sentido,
        acumulado: novoAcumulado,
        comprouNaVez: false
    });
}

// --- INTERFACE (CHAT E BOTÕES) ---

const containerChat = document.getElementById('containerChat');
const headerChat = document.getElementById('headerChat');
const campoMsg = document.getElementById('campoMsg');
const btnAbrirChat = document.getElementById('btnAbrirChat');

// Abrir/Fechar Chat Mobile
if(btnAbrirChat) {
    btnAbrirChat.addEventListener('click', () => {
        const isAberto = containerChat.style.display === 'flex';
        containerChat.style.display = isAberto ? 'none' : 'flex';
    });
}

// Enviar Mensagem
if(campoMsg) {
    campoMsg.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const txt = campoMsg.value.trim();
            if (!txt) return;
            const chatRef = ref(db, `salas/${salaID}/chat`);
            const snap = await get(chatRef);
            let msgs = snap.val() || [];
            msgs.push({ nick: meuNick, msg: txt });
            if (msgs.length > 25) msgs.shift();
            await set(chatRef, msgs);
            campoMsg.value = "";
        }
    });
}

// Arrastar Chat
let isDragging = false;
let startX, startY, initialX, initialY;

const startMove = (e) => {
    if(e.target.id !== 'headerChat') return;
    isDragging = true;
    const pos = e.type.includes('touch') ? e.touches[0] : e;
    startX = pos.clientX;
    startY = pos.clientY;
    initialX = containerChat.offsetLeft;
    initialY = containerChat.offsetTop;
};

const doMove = (e) => {
    if (!isDragging) return;
    e.preventDefault(); 
    const pos = e.type.includes('touch') ? e.touches[0] : e;
    const dx = pos.clientX - startX;
    const dy = pos.clientY - startY;
    containerChat.style.left = (initialX + dx) + 'px';
    containerChat.style.top = (initialY + dy) + 'px';
    containerChat.style.right = 'auto'; 
    containerChat.style.bottom = 'auto'; 
};

if(headerChat) {
    headerChat.addEventListener('mousedown', startMove);
    headerChat.addEventListener('touchstart', startMove, {passive: false});
    window.addEventListener('mousemove', doMove);
    window.addEventListener('touchmove', doMove, {passive: false});
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('touchend', () => isDragging = false);
}

// Botões de Jogo
document.getElementById('btnComprar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    if (d.turno !== meuNick || d.comprouNaVez) return;
    
    let m = d.jogadores[meuNick].mao || [];
    
    // Se tem acumulado (+2 ou +4), compra tudo
    if (d.acumulado > 0) {
        for(let i=0; i<d.acumulado; i++) m.push(gerarCarta());
        const prox = calcProx(Object.keys(d.jogadores).indexOf(meuNick), Object.keys(d.jogadores).length, d.sentido, 1);
        
        await update(ref(db, `salas/${salaID}`), { 
            [`jogadores/${meuNick}/mao`]: m, 
            acumulado: 0, 
            turno: Object.keys(d.jogadores)[prox],
            comprouNaVez: false // Reseta
        });
    } else {
        // Compra normal (1 carta)
        m.push(gerarCarta());
        await update(ref(db, `salas/${salaID}`), { 
            [`jogadores/${meuNick}/mao`]: m, 
            comprouNaVez: true 
        });
    }
};

document.getElementById('btnPassar').onclick = async () => {
    const snap = await get(ref(db, `salas/${salaID}`));
    const d = snap.val();
    const prox = calcProx(Object.keys(d.jogadores).indexOf(meuNick), Object.keys(d.jogadores).length, d.sentido, 1);
    await update(ref(db, `salas/${salaID}`), { 
        turno: Object.keys(d.jogadores)[prox], 
        comprouNaVez: false 
    });
};

document.getElementById('btnSair').onclick = () => window.location.href = "index.html";
