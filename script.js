import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDFTRTBj7WRVn4gG9OwDCPjHP0B_NYFpCc",
  authDomain: "unotfm.firebaseapp.com",
  projectId: "unotfm",
  storageBucket: "unotfm.firebasestorage.app",
  messagingSenderId: "1035668265410",
  appId: "1:1035668265410:web:710e61682014f9d46a1e5b",
  measurementId: "G-DRQ1T05JFB",
  databaseURL: "https://unotfm-default-rtdb.firebaseio.com"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app, "https://unotfm-default-rtdb.firebaseio.com");

console.log("Conectado ao banco:", db.app.options.databaseURL);

// Seleção dos elementos do HTML
const btnCriar = document.getElementById('btnCriar');
const btnEntrar = document.getElementById('btnEntrar'); // Botão de Entrar
const inputNick = document.getElementById('username');
const inputSala = document.getElementById('roomCode'); // Input do código da sala

// --- FUNÇÃO: CRIAR MESA ---
btnCriar.onclick = async () => {
    const nick = inputNick.value.trim();
    if (!nick) return alert("Digite seu apelido!");

    const codigoSala = Math.random().toString(36).substring(2, 6).toUpperCase();
    console.log("Tentando gravar sala: " + codigoSala);

    try {
        const salaRef = ref(db, 'salas/' + codigoSala);
        await set(salaRef, {
            status: "aguardando",
            dono: nick,
            jogadores: {
                [nick]: { pronto: true }
            }
        });

        console.log("Sala criada com sucesso!");
        localStorage.setItem('meuNick', nick);
        localStorage.setItem('salaID', codigoSala);
        window.location.href = "sala.html";
    } catch (error) {
        console.error("ERRO CRÍTICO FIREBASE:", error);
        alert("Erro: " + error.message);
    }
};

// --- FUNÇÃO: ENTRAR EM SALA EXISTENTE ---
btnEntrar.onclick = async () => {
    const nick = inputNick.value.trim();
    const codigo = inputSala.value.trim().toUpperCase();

    if (!nick || !codigo) {
        return alert("Preencha seu nick e o código da sala para entrar!");
    }

    console.log("Buscando sala: " + codigo);

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `salas/${codigo}`));

        if (snapshot.exists()) {
            // Se a sala existe, adiciona você na lista de jogadores daquela sala
            await set(ref(db, `salas/${codigo}/jogadores/${nick}`), {
                pronto: true
            });

            localStorage.setItem('meuNick', nick);
            localStorage.setItem('salaID', codigo);
            
            console.log("Entrou na sala!");
            window.location.href = "sala.html";
        } else {
            alert("Sala não encontrada! Verifique o código.");
        }
    } catch (error) {
        console.error("Erro ao entrar:", error);
        alert("Erro de conexão ao tentar entrar.");
    }
};
