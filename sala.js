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

if (!salaID) window.location.href = "index.html";

document.getElementById('displayCodigo').innerText = salaID;
const salaRef = ref(db, 'salas/' + salaID);

onValue(salaRef, (snapshot) => {
    const dados = snapshot.val();
    if (!dados) return;

    if (dados.status === "em_jogo") {
        window.location.href = "jogo.html";
        return;
    }

    // 1. Atualiza Jogadores
    const lista = document.getElementById('listaJogadores');
    lista.innerHTML = "";
    for (let j in dados.jogadores) {
        const isMestre = j === dados.dono;
        lista.innerHTML += `
            <li class="jogador-item">
                <span>🎴 ${j}</span>
                ${isMestre ? '<small style="color:#ffeb3b; font-size:0.7rem; margin-left:5px;">(MESTRE)</small>' : ''}
            </li>`;
    }

    // 2. Atualiza Regras Ativas (para todos)
    const divRegras = document.getElementById('listaRegrasAtivas');
    divRegras.innerHTML = "";
    if (dados.regras) {
        Object.values(dados.regras).forEach(regra => {
            divRegras.innerHTML += `<div class="regra-item">⚠️ ${regra}</div>`;
        });
    } else {
        divRegras.innerHTML = "<p style='color:#555; font-size:0.8rem;'>Regras padrão ativadas.</p>";
    }

    // 3. Painel do Dono
    if (dados.dono === meuNick) {
        document.getElementById('painelDono').style.display = "block";
        document.getElementById('btnComeçar').style.display = "block";
        document.getElementById('waitMsg').style.display = "none";
        
        const regrasAtivas = dados.regras ? Object.values(dados.regras) : [];
        const configBotoes = {
            'Acumular +2': 'regra_acumular',
            '7 Roda a Mão': 'regra_sete_roda',
            '0 Troca Tudo': 'regra_zero_troca',
            'Bater no 9': 'regra_bater_nove'
        };

        for (let [nome, id] of Object.entries(configBotoes)) {
            const btn = document.getElementById(id);
            if (btn) {
                const ativa = regrasAtivas.includes(nome);
                btn.querySelector('.txt-btn').innerText = `${nome.toUpperCase()}: ${ativa ? "ON" : "OFF"}`;
                btn.className = ativa ? "btn-modo btn-on" : "btn-modo btn-off";
            }
        }
    }
});

window.alternarRegra = async (nomeRegra) => {
    const snap = await get(salaRef);
    const dados = snap.val();
    if (dados.dono !== meuNick) return;

    let regras = dados.regras || {};
    const chave = nomeRegra.replace(/\s+/g, '_').toLowerCase();

    if (Object.values(regras).includes(nomeRegra)) {
        const keyRemover = Object.keys(regras).find(k => regras[k] === nomeRegra);
        set(ref(db, `salas/${salaID}/regras/${keyRemover}`), null);
    } else {
        update(ref(db, `salas/${salaID}/regras`), { [chave]: nomeRegra });
    }
};

document.getElementById('btnComeçar').onclick = () => {
    update(ref(db, `salas/${salaID}`), { status: "em_jogo" });
};
