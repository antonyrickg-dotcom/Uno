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

// --- ESCUTANDO MUDANÇAS NA SALA ---
onValue(salaRef, (snapshot) => {
    const dados = snapshot.val();
    if (!dados) return;

    // 1. Atualiza Jogadores com visual melhorado
    const lista = document.getElementById('listaJogadores');
    lista.innerHTML = "";
    for (let j in dados.jogadores) {
        const isMestre = j === dados.dono;
        lista.innerHTML += `
            <li class="jogador-item">
                <span>🎴 ${j}</span>
                ${isMestre ? '<small style="color:#ffeb3b; font-size:0.7rem;">(MESTRE)</small>' : ''}
            </li>`;
    }

    // 2. Atualiza Regras com as cores e animação
    const divRegras = document.getElementById('listaRegrasAtivas');
    divRegras.innerHTML = "";
    if (dados.regras) {
        Object.values(dados.regras).forEach(regra => {
            divRegras.innerHTML += `<div class="regra-item">⚠️ ${regra}</div>`;
        });
    } else {
        divRegras.innerHTML = "<p style='color:#555; font-size:0.8rem;'>Regras padrão ativadas.</p>";
    }

    // 3. Interface do Dono (Mestre)
    if (dados.dono === meuNick) {
        document.getElementById('painelDono').style.display = "block";
        document.getElementById('btnComeçar').style.display = "block";
        document.getElementById('waitMsg').style.display = "none";
        
        // Atualiza estilo do botão aleatório
        const btnAle = document.getElementById('btnAleatorio');
        btnAle.innerText = dados.modoAleatorio ? "MODO ALEATÓRIO: ON" : "MODO ALEATÓRIO: OFF";
        btnAle.className = dados.modoAleatorio ? "btn-modo btn-on" : "btn-modo btn-off";
    }
});

// --- FUNÇÕES DO DONO ---

// Adicionar regra manual
document.getElementById('btnAddRegra').onclick = () => {
    const texto = document.getElementById('inputNovaRegra').value.trim();
    if (!texto) return;
    const novaRegraKey = Date.now();
    update(ref(db, `salas/${salaID}/regras`), { [novaRegraKey]: texto });
    document.getElementById('inputNovaRegra').value = "";
};

// Modo Aleatório
document.getElementById('btnAleatorio').onclick = async () => {
    const snapshot = await get(ref(db, `salas/${salaID}/modoAleatorio`));
    const isAtivo = snapshot.val() || false;

    if (!isAtivo) {
        const sugestoes = [
            "7 roda a mão", 
            "0 troca tudo", 
            "Acumular +2", 
            "Bater no 9", 
            "Pular próximo se for carta 5",
            "Mão invisível (esconde cartas)"
        ];
        // Sorteia 2 regras da lista
        const sorteadas = sugestoes.sort(() => 0.5 - Math.random()).slice(0, 2);
        update(ref(db, `salas/${salaID}`), {
            modoAleatorio: true,
            regras: { ...sorteadas }
        });
    } else {
        update(ref(db, `salas/${salaID}`), {
            modoAleatorio: false,
            regras: null
        });
    }
};
