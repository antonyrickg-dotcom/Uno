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

const explicacoes = {
    "Acumular +2": "Permite acumular cartas +2.",
    "7 Roda a Mão": "Quando sai 7, os jogadores trocam as mãos.",
    "0 Troca Tudo": "Quando sai 0, todas as mãos são trocadas.",
    "Bater no 9": "Regra especial ao bater no 9."
};

const tooltip = document.getElementById("tooltip");

window.mostrarInfo = (texto) => {
    tooltip.innerText = texto;
    tooltip.classList.add("show");
    setTimeout(() => tooltip.classList.remove("show"), 4000);
};

document.addEventListener("click", e => {
    if (!e.target.classList.contains("info-btn")) {
        tooltip.classList.remove("show");
    }
});

const salaRef = ref(db, 'salas/' + salaID);

onValue(salaRef, snapshot => {
    const dados = snapshot.val();
    if (!dados) return;

    const divRegras = document.getElementById("listaRegrasAtivas");
    divRegras.innerHTML = "";

    if (dados.regras) {
        Object.values(dados.regras).forEach(regra => {
            divRegras.innerHTML += `
                <div class="regra-item">
                    <span>⚠️ ${regra}</span>
                    <span class="info-btn" onclick="mostrarInfo('${explicacoes[regra] || "Regra personalizada."}')">ℹ️</span>
                </div>
            `;
        });
    }
});

window.alternarRegra = async (nome) => {
    const snap = await get(salaRef);
    const dados = snap.val();
    if (dados.dono !== meuNick) return;

    let regras = dados.regras || {};
    const chave = nome.replace(/\s+/g, '_').toLowerCase();

    if (Object.values(regras).includes(nome)) {
        const key = Object.keys(regras).find(k => regras[k] === nome);
        set(ref(db, `salas/${salaID}/regras/${key}`), null);
    } else {
        update(ref(db, `salas/${salaID}/regras`), { [chave]: nome });
    }
};
